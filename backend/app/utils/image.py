from __future__ import annotations

import logging
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

# Instagram format specs (width × height)
FORMAT_SPECS = {
    "post": (1080, 1080),
    "story": (1080, 1920),
    "reel": (1080, 1920),
    "portrait": (1080, 1350),
    "landscape": (1080, 566),
}


def resize_for_instagram(img: Image.Image, fmt: str = "post") -> Image.Image:
    """Resize an image to Instagram format specs."""
    target = FORMAT_SPECS.get(fmt, FORMAT_SPECS["post"])
    return img.resize(target, Image.LANCZOS)


def overlay_logo(
    base: Image.Image,
    logo_path: Path,
    position: str = "Bottom-right corner",
) -> Image.Image:
    """Overlay a logo on a base image at the specified position."""
    if not logo_path.exists():
        logger.warning("Logo file does not exist at overlay time: %s", logo_path)
        return base

    logo = Image.open(logo_path).convert("RGBA")

    # Warn if logo is fully transparent (post-processing may have stripped it)
    if logo.getbbox() is None:
        logger.warning("Logo image is fully transparent — overlay will be invisible: %s", logo_path)
        return base

    # Scale logo to ~15% of base width
    ratio = (base.width * 0.15) / logo.width
    new_size = (int(logo.width * ratio), int(logo.height * ratio))
    logo = logo.resize(new_size, Image.LANCZOS)

    positions = {
        "bottom-right corner": (base.width - logo.width - 20, base.height - logo.height - 20),
        "bottom-left corner": (20, base.height - logo.height - 20),
        "top-right corner": (base.width - logo.width - 20, 20),
        "top-left corner": (20, 20),
        "centred": ((base.width - logo.width) // 2, (base.height - logo.height) // 2),
    }
    pos = positions.get(position.lower(), positions["bottom-right corner"])

    base = base.convert("RGBA")
    base.paste(logo, pos, logo)
    return base.convert("RGB")
