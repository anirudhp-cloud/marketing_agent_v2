import json
from datetime import datetime, timezone

import aiosqlite

# Maps wizard step number → key in the session JSON blob
STEP_KEYS = {
    1: "business_profile",
    2: "audience",
    3: "goals",
    4: "creative",
    5: "review",
    6: "variants",
    7: "calendar",
    8: "schedule",
    9: "engage",
}


async def upsert_session(
    db: aiosqlite.Connection,
    session_id: str,
    step: int,
    data: dict,
) -> dict:
    """Create or update a session with step data.

    Step data is stored under a step-specific key so each step
    occupies its own namespace inside the JSON blob.
    """
    key = STEP_KEYS.get(step)
    if not key:
        raise ValueError(f"Invalid step: {step}")

    # Strip session_id from data if frontend included it
    clean = {k: v for k, v in data.items() if k != "session_id"}

    cursor = await db.execute(
        "SELECT id, data FROM sessions WHERE session_id = ?",
        (session_id,),
    )
    existing = await cursor.fetchone()
    now = datetime.now(timezone.utc).isoformat()

    if existing:
        current_data = json.loads(existing["data"])
        current_data[key] = clean
        await db.execute(
            """UPDATE sessions
               SET data = ?, current_step = ?, updated_at = ?
               WHERE session_id = ?""",
            (json.dumps(current_data), step, now, session_id),
        )
    else:
        blob = json.dumps({key: clean})
        await db.execute(
            """INSERT INTO sessions (session_id, data, current_step, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, blob, step, now, now),
        )

    await db.commit()
    return {"status": "ok", "next_step": step + 1}


async def get_session(db: aiosqlite.Connection, session_id: str) -> dict | None:
    """Return full AgentState by joining sessions + variants + calendar_posts."""
    cursor = await db.execute(
        "SELECT * FROM sessions WHERE session_id = ?",
        (session_id,),
    )
    row = await cursor.fetchone()
    if not row:
        return None

    session_data = json.loads(row["data"])

    # --- variants (DB → frontend CampaignVariant shape) ---
    variants: list[dict] = []
    cur = await db.execute(
        "SELECT * FROM variants WHERE session_id = ? ORDER BY id",
        (session_id,),
    )
    for v in await cur.fetchall():
        v_hashtags = []
        if v["hashtags"]:
            try:
                v_hashtags = json.loads(v["hashtags"])
            except (json.JSONDecodeError, TypeError):
                v_hashtags = []
        variants.append(
            {
                "id": v["id"],
                "angle": v["angle"],
                "headline": v["headline"],
                "copy": v["copy_text"],
                "cta": v["cta"],
                "targetSegment": v["target_segment"],
                "imageryStyle": v["imagery_style"],
                "imageUrl": v["image_url"],
                "imagePrompt": v["image_prompt"],
                "hashtags": v_hashtags,
                "score": v["score"],
                "recommended": bool(v["is_recommended"]),
                "complianceStatus": v["compliance_status"] or "unchecked",
            }
        )

    # --- calendar posts (DB → frontend CalendarPost shape) ---
    calendar_posts: list[dict] = []
    cur = await db.execute(
        "SELECT * FROM calendar_posts WHERE session_id = ? ORDER BY post_date",
        (session_id,),
    )
    for p in await cur.fetchall():
        calendar_posts.append(
            {
                "id": str(p["id"]),
                "date": p["post_date"],
                "type": p["post_type"],
                "caption": p["caption"],
                "hashtags": json.loads(p["hashtags"]) if p["hashtags"] else [],
                "bestTime": p["best_time"],
                "imageUrl": p["image_url"],
            }
        )

    # --- Build AgentState matching frontend types.ts ---
    return {
        "businessProfile": session_data.get("business_profile", {}),
        "audience": session_data.get("audience", {}),
        "goals": session_data.get("goals", {}),
        "creative": session_data.get("creative", {}),
        "compliancePassed": session_data.get("compliance_passed", False),
        "humanApproved": bool(row["human_approved"]),
        "variants": variants,
        "selectedVariant": session_data.get("selected_variant"),
        "calendarPosts": calendar_posts,
        "executionResults": session_data.get("execution_results", {}),
        "pendingReplies": [],
        "currentStep": row["current_step"],
        "error": None,
    }


async def set_approved(
    db: aiosqlite.Connection,
    session_id: str,
    approved: bool,
) -> bool:
    """Set human_approved flag on a session. Returns True if row existed."""
    now = datetime.now(timezone.utc).isoformat()
    cursor = await db.execute(
        """UPDATE sessions
           SET human_approved = ?, updated_at = ?
           WHERE session_id = ?""",
        (int(approved), now, session_id),
    )
    await db.commit()
    return cursor.rowcount > 0
