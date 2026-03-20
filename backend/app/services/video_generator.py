"""Video generator — calls Sora 2 to produce short reel videos for campaign variants."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import AsyncGenerator

import aiohttp
import aiosqlite

from app.config import get_settings

logger = logging.getLogger(__name__)

GEN_IMAGES_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "gen_images"

# Sora 2 API constants
SORA_API_VERSION = "2025-04-01-preview"
VIDEO_DURATION_SECONDS = 5
VIDEO_SIZE = "1080x1920"  # Portrait / Reel format


async def _call_sora(prompt: str) -> str:
    """Submit a Sora 2 video generation job and poll until complete.

    Returns the video download URL from the Sora API response.
    """
    settings = get_settings()
    endpoint = settings.sora_api_endpoint.rstrip("/")
    api_key = settings.sora_api_key
    deployment = settings.sora_deployment_name

    if not endpoint or not api_key:
        raise ValueError("Sora API endpoint or key not configured")

    submit_url = (
        f"{endpoint}/openai/deployments/{deployment}"
        f"/videos/generations?api-version={SORA_API_VERSION}"
    )

    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "prompt": prompt,
        "n_seconds": VIDEO_DURATION_SECONDS,
        "height": 1920,
        "width": 1080,
        "n_variants": 1,
    }

    async with aiohttp.ClientSession() as session:
        # 1. Submit the generation job
        async with session.post(
            submit_url,
            json=payload,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            if resp.status not in (200, 201, 202):
                body = await resp.text()
                raise RuntimeError(f"Sora API submit returned {resp.status}: {body[:500]}")
            data = await resp.json()

        job_id = data.get("id", "")
        status = data.get("status", "")

        # If the response already contains the video, return immediately
        if status == "succeeded":
            return _extract_video_url(data)

        if not job_id:
            raise RuntimeError("Sora API returned no job ID")

        # 2. Poll for completion
        poll_url = (
            f"{endpoint}/openai/deployments/{deployment}"
            f"/videos/generations/{job_id}?api-version={SORA_API_VERSION}"
        )
        max_polls = 60  # up to ~5 minutes
        for _ in range(max_polls):
            await _async_sleep(5)
            async with session.get(
                poll_url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as poll_resp:
                if poll_resp.status != 200:
                    body = await poll_resp.text()
                    raise RuntimeError(f"Sora poll returned {poll_resp.status}: {body[:300]}")
                poll_data = await poll_resp.json()

            status = poll_data.get("status", "")
            if status == "succeeded":
                return _extract_video_url(poll_data)
            if status in ("failed", "cancelled"):
                err = poll_data.get("error", {}).get("message", "Unknown error")
                raise RuntimeError(f"Sora video generation {status}: {err}")
            # still running – keep polling

        raise RuntimeError("Sora video generation timed out after polling")


def _extract_video_url(data: dict) -> str:
    """Pull the first video URL from a Sora API response."""
    generations = data.get("data", data.get("generations", []))
    if generations and isinstance(generations, list):
        url = generations[0].get("url", "") or generations[0].get("video_url", "")
        if url:
            return url
    raise RuntimeError("Sora API response has no video URL")


async def _async_sleep(seconds: float) -> None:
    """Non-blocking sleep."""
    import asyncio
    await asyncio.sleep(seconds)


async def _download_video(url: str) -> bytes:
    """Download video bytes from a URL."""
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=120)) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Failed to download Sora video: {resp.status}")
            return await resp.read()


async def generate_videos(
    db: aiosqlite.Connection,
    session_id: str,
    ctx: dict,
) -> AsyncGenerator[dict, None]:
    """Generate Sora 2 reel videos for each variant.

    Yields SSE progress dicts:
        {"step": "generating_videos", "total": N}
        {"step": "video_ready", "variant_id": id, "video_url": "/static/..."}
        {"step": "video_error", "variant_id": id, "message": "..."}
        {"step": "videos_done", "count": N}
    """
    content_types = ctx.get("content_type", ["post"])
    if isinstance(content_types, str):
        content_types = [content_types]

    # Only generate videos if "reel" is in the selected content types
    if "reel" not in content_types:
        yield {"step": "videos_done", "count": 0, "skipped": True}
        return

    # Get all variants for this session
    cur = await db.execute(
        "SELECT id, image_prompt, headline, angle FROM variants WHERE session_id = ? ORDER BY id",
        (session_id,),
    )
    variants = await cur.fetchall()
    if not variants:
        yield {"step": "videos_done", "count": 0}
        return

    # Create output directory
    out_dir = GEN_IMAGES_DIR / session_id
    out_dir.mkdir(parents=True, exist_ok=True)

    total = len(variants)
    yield {"step": "generating_videos", "total": total}

    count = 0
    for variant in variants:
        vid = variant["id"]
        base_prompt = variant["image_prompt"] or ""
        headline = variant["headline"] or ""
        angle = variant["angle"] or ""

        if not base_prompt:
            logger.warning("Variant %d has no image_prompt for video, skipping", vid)
            continue

        # Build a video-specific prompt from the image prompt
        video_prompt = _build_video_prompt(base_prompt, headline, angle, ctx)
        filename = f"variant_{vid}_reel.mp4"
        filepath = out_dir / filename

        try:
            logger.info("Generating reel video: variant=%d", vid)

            # 1. Call Sora API and get video URL
            video_download_url = await _call_sora(video_prompt)

            # 2. Download the video
            video_bytes = await _download_video(video_download_url)

            # 3. Save to disk
            filepath.write_bytes(video_bytes)
            logger.info("Saved reel: %s (%d bytes)", filepath, len(video_bytes))

            video_url = f"/static/gen_images/{session_id}/{filename}"
            count += 1

            # 4. Update DB
            await db.execute(
                "UPDATE variants SET video_url = ? WHERE id = ?",
                (video_url, vid),
            )
            await db.commit()

            yield {
                "step": "video_ready",
                "variant_id": vid,
                "video_url": video_url,
            }

        except Exception as e:
            logger.error("Video generation failed for variant %d: %s", vid, e)
            yield {
                "step": "video_error",
                "variant_id": vid,
                "message": str(e),
            }

    yield {"step": "videos_done", "count": count}


def _build_video_prompt(
    image_prompt: str,
    headline: str,
    angle: str,
    ctx: dict,
) -> str:
    """Adapt the image prompt into a short-form video prompt for Sora 2."""
    brand_name = ctx.get("brand_name", "")
    tone = ctx.get("tone_of_voice", "professional")
    brand_colours = ctx.get("brand_colours", [])
    colours_str = ", ".join(brand_colours) if brand_colours else ""

    parts = [
        f"Create a 5-second Instagram Reel video for the brand '{brand_name}'.",
        f"Creative angle: {angle}." if angle else "",
        f"Headline: {headline}." if headline else "",
        f"Visual direction: {image_prompt}",
        f"Tone: {tone}.",
        f"Brand colours: {colours_str}." if colours_str else "",
        "The video should be vertical (9:16 portrait), cinematic, fast-paced, "
        "and optimised for Instagram Reels. Keep it under 5 seconds with smooth "
        "motion and visually striking transitions. No text overlays.",
    ]
    return " ".join(p for p in parts if p)
