"""Video generator — maps pre-existing reel videos to campaign variants."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import AsyncGenerator

import aiosqlite

logger = logging.getLogger(__name__)

# Directory containing pre-existing reel videos
VIDEOS_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "videos"

# Number of unique (non-placeholder) videos available
MAX_UNIQUE_VIDEOS = 3


def _get_video_files() -> list[str]:
    """Return sorted list of .mp4 filenames in the videos directory.

    The first file in sorted order is treated as the placeholder video.
    """
    if not VIDEOS_DIR.is_dir():
        return []
    return sorted(f.name for f in VIDEOS_DIR.iterdir() if f.suffix == ".mp4")


async def generate_videos(
    db: aiosqlite.Connection,
    session_id: str,
    ctx: dict,
) -> AsyncGenerator[dict, None]:
    """Map pre-existing reel videos to each variant.

    Mapping rules:
      - 3 variants  → each gets a unique video (1:1)
      - 4 variants  → first 3 get unique videos, 4th gets the placeholder (1st video)
      - 5 variants  → first 3 get unique videos, 4th & 5th get the placeholder

    Yields SSE progress dicts:
        {"step": "generating_videos", "total": N}
        {"step": "video_ready", "variant_id": id, "video_url": "/static/..."}
        {"step": "video_error", "variant_id": id, "message": "..."}
        {"step": "videos_done", "count": N}
    """
    content_types = ctx.get("content_type", ["post"])
    if isinstance(content_types, str):
        content_types = [content_types]

    # Only assign videos if "reel" is in the selected content types
    if "reel" not in content_types:
        yield {"step": "videos_done", "count": 0, "skipped": True}
        return

    # Get all variants for this session
    cur = await db.execute(
        "SELECT id FROM variants WHERE session_id = ? ORDER BY id",
        (session_id,),
    )
    variants = await cur.fetchall()
    if not variants:
        yield {"step": "videos_done", "count": 0}
        return

    # Load available video files
    video_files = _get_video_files()
    if not video_files:
        logger.error("No .mp4 files found in %s", VIDEOS_DIR)
        yield {"step": "videos_done", "count": 0}
        return

    placeholder = video_files[0]  # First video is the placeholder

    total = len(variants)
    yield {"step": "generating_videos", "total": total}

    count = 0
    for idx, variant in enumerate(variants):
        vid = variant["id"]

        # First 3 variants get unique videos; the rest get the placeholder
        if idx < MAX_UNIQUE_VIDEOS and idx < len(video_files):
            chosen_file = video_files[idx]
        else:
            chosen_file = placeholder

        video_url = f"/static/videos/{chosen_file}"

        try:
            await db.execute(
                "UPDATE variants SET video_url = ? WHERE id = ?",
                (video_url, vid),
            )
            await db.commit()
            count += 1

            logger.info(
                "Mapped video for variant %d: %s%s",
                vid, chosen_file,
                " (placeholder)" if idx >= MAX_UNIQUE_VIDEOS else "",
            )

            yield {
                "step": "video_ready",
                "variant_id": vid,
                "video_url": video_url,
            }

        except Exception as e:
            logger.error("Video mapping failed for variant %d: %s", vid, e)
            yield {
                "step": "video_error",
                "variant_id": vid,
                "message": str(e),
            }

    yield {"step": "videos_done", "count": count}
