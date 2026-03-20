"""DB queries for campaign variants."""

from __future__ import annotations

import json

import aiosqlite


async def list_variants(db: aiosqlite.Connection, session_id: str) -> list[dict]:
    """Return all variants for a session, formatted for the frontend."""
    cur = await db.execute(
        "SELECT * FROM variants WHERE session_id = ? ORDER BY id",
        (session_id,),
    )
    rows = await cur.fetchall()
    results = []
    for v in rows:
        hashtags = []
        if v["hashtags"]:
            try:
                hashtags = json.loads(v["hashtags"])
            except (json.JSONDecodeError, TypeError):
                hashtags = []
        results.append({
            "id": v["id"],
            "angle": v["angle"],
            "headline": v["headline"],
            "copy": v["copy_text"],
            "cta": v["cta"],
            "target_segment": v["target_segment"],
            "imagery_style": v["imagery_style"],
            "image_url": v["image_url"],
            "video_url": v["video_url"],
            "image_prompt": v["image_prompt"],
            "hashtags": hashtags,
            "score": v["score"],
            "recommended": bool(v["is_recommended"]),
            "compliance_status": v["compliance_status"] or "unchecked",
        })
    return results


async def patch_variant(
    db: aiosqlite.Connection,
    variant_id: int,
    updates: dict,
) -> dict | None:
    """Update specific fields on a variant. Returns the updated variant or None."""
    if not updates:
        return None

    # Build SET clause from provided fields
    allowed = {
        "headline", "copy_text", "cta", "target_segment",
        "imagery_style", "image_prompt", "image_url",
    }
    fields = {k: v for k, v in updates.items() if k in allowed and v is not None}
    if not fields:
        return None

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [variant_id]

    await db.execute(
        f"UPDATE variants SET {set_clause} WHERE id = ?",
        values,
    )
    await db.commit()

    # Return updated row
    cur = await db.execute("SELECT * FROM variants WHERE id = ?", (variant_id,))
    row = await cur.fetchone()
    if not row:
        return None

    hashtags = []
    if row["hashtags"]:
        try:
            hashtags = json.loads(row["hashtags"])
        except (json.JSONDecodeError, TypeError):
            hashtags = []

    return {
        "id": row["id"],
        "angle": row["angle"],
        "headline": row["headline"],
        "copy": row["copy_text"],
        "cta": row["cta"],
        "target_segment": row["target_segment"],
        "imagery_style": row["imagery_style"],
        "image_url": row["image_url"],
        "video_url": row["video_url"],
        "image_prompt": row["image_prompt"],
        "hashtags": hashtags,
        "score": row["score"],
        "recommended": bool(row["is_recommended"]),
        "compliance_status": row["compliance_status"] or "unchecked",
    }
