"""Image generator — calls FLUX 1.1 Pro to produce images for campaign variants."""

from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import AsyncGenerator

import aiohttp
import aiosqlite
from PIL import Image

from app.config import get_settings
from app.utils.image import resize_for_instagram, overlay_logo

logger = logging.getLogger(__name__)

# backend/static/gen_images/<session_id>/
GEN_IMAGES_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "gen_images"

# Map frontend size names → FLUX API sizes (must be FLUX-supported) → IG format key
SIZE_MAP: dict[str, tuple[str, str]] = {
    "Square":    ("1024x1024", "post"),       # → resize to 1080×1080
    "Portrait":  ("768x1344",  "portrait"),   # → resize to 1080×1350
    "Landscape": ("1344x768",  "landscape"),  # → resize to 1080×566
}


async def _call_flux(prompt: str, size: str) -> bytes:
    """Call FLUX 1.1 Pro API and return image bytes."""
    settings = get_settings()
    endpoint = settings.flux_api_endpoint
    api_key = settings.flux_api_key

    if not endpoint or not api_key:
        raise ValueError("FLUX API endpoint or key not configured")

    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "prompt": prompt,
        "n": 1,
        "size": size,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(endpoint, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=120)) as resp:
            if resp.status != 200:
                body = await resp.text()
                raise RuntimeError(f"FLUX API returned {resp.status}: {body[:500]}")
            data = await resp.json()

    # Response is OpenAI-compatible: {"data": [{"url": "..."}]} or {"data": [{"b64_json": "..."}]}
    img_data = data.get("data", [])
    if not img_data:
        raise RuntimeError("FLUX API returned empty data array")

    entry = img_data[0]
    if entry.get("url"):
        async with aiohttp.ClientSession() as session:
            async with session.get(str(entry["url"]), timeout=aiohttp.ClientTimeout(total=60)) as img_resp:
                if img_resp.status != 200:
                    raise RuntimeError(f"Failed to download FLUX image: {img_resp.status}")
                return await img_resp.read()
    if entry.get("b64_json"):
        import base64
        return base64.b64decode(entry["b64_json"])
    raise RuntimeError("FLUX response has neither 'url' nor 'b64_json'")


def _resolve_logo_path(logo_url: str) -> Path | None:
    """Convert a logo URL like /static/uploads/xyz_logo.png to a local file path."""
    if not logo_url:
        return None
    # Strip host if full URL
    if "://" in logo_url:
        from urllib.parse import urlparse
        path = urlparse(logo_url).path
    else:
        path = logo_url

    # /static/uploads/xyz.png → backend/static/uploads/xyz.png
    if path.startswith("/static/"):
        local = Path(__file__).resolve().parent.parent.parent / "static" / path[len("/static/"):]
        return local if local.exists() else None
    return None


async def generate_images(
    db: aiosqlite.Connection,
    session_id: str,
    ctx: dict,
) -> AsyncGenerator[dict, None]:
    """Generate FLUX images for each variant that needs one.

    Yields SSE progress dicts:
        {"step": "generating_images", "total": N}
        {"step": "image_ready", "variant_id": id, "size": "Square", "image_url": "/static/..."}
        {"step": "image_error", "variant_id": id, "size": "Square", "message": "..."}
        {"step": "images_done", "count": N}
    """
    content_types = ctx.get("content_type", ["post"])
    if isinstance(content_types, str):
        content_types = [content_types]

    # Only generate images if "image" is in the selected content types
    if "image" not in content_types:
        yield {"step": "images_done", "count": 0, "skipped": True}
        return

    image_sizes = ctx.get("image_sizes", ["Square"])
    if not image_sizes:
        image_sizes = ["Square"]

    logo_placement = ctx.get("logo_placement", "Bottom-right corner")
    logo_url = ctx.get("logo_url", "")
    logo_path = _resolve_logo_path(logo_url)
    skip_logo = (logo_placement.lower().startswith("no logo") or logo_path is None)

    # Get all variants for this session
    cur = await db.execute(
        "SELECT id, image_prompt FROM variants WHERE session_id = ? ORDER BY id",
        (session_id,),
    )
    variants = await cur.fetchall()
    if not variants:
        yield {"step": "images_done", "count": 0}
        return

    # Create output directory
    out_dir = GEN_IMAGES_DIR / session_id
    out_dir.mkdir(parents=True, exist_ok=True)

    total = len(variants) * len(image_sizes)
    yield {"step": "generating_images", "total": total}

    count = 0
    for variant in variants:
        vid = variant["id"]
        prompt = variant["image_prompt"] or ""
        if not prompt:
            logger.warning("Variant %d has no image_prompt, skipping", vid)
            continue

        first_image_url = None  # Track first generated image to set as variant's image_url

        for size_name in image_sizes:
            mapping = SIZE_MAP.get(size_name)
            if not mapping:
                logger.warning("Unknown size '%s', skipping", size_name)
                continue

            flux_size, ig_format = mapping
            filename = f"variant_{vid}_{size_name.lower()}.jpg"
            filepath = out_dir / filename

            try:
                # 1. Call FLUX API
                logger.info("Generating image: variant=%d, size=%s (%s)", vid, size_name, flux_size)
                raw_bytes = await _call_flux(prompt, flux_size)

                # 2. Open and resize to exact Instagram specs
                img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
                img = resize_for_instagram(img, ig_format)

                # 3. Overlay logo if requested
                if not skip_logo and logo_path:
                    img = overlay_logo(img, logo_path, logo_placement)

                # 4. Save to disk
                img.save(str(filepath), "JPEG", quality=92)
                logger.info("Saved: %s (%dx%d)", filepath, img.width, img.height)

                image_url = f"/static/gen_images/{session_id}/{filename}"
                count += 1

                if first_image_url is None:
                    first_image_url = image_url

                yield {
                    "step": "image_ready",
                    "variant_id": vid,
                    "size": size_name,
                    "image_url": image_url,
                }

            except Exception as e:
                logger.error("Image generation failed for variant %d size %s: %s", vid, size_name, e)
                yield {
                    "step": "image_error",
                    "variant_id": vid,
                    "size": size_name,
                    "message": str(e),
                }

        # Update the variant's image_url in DB with the first generated image
        if first_image_url:
            await db.execute(
                "UPDATE variants SET image_url = ? WHERE id = ?",
                (first_image_url, vid),
            )
            await db.commit()

    yield {"step": "images_done", "count": count}
