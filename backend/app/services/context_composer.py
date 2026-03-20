"""Compose structured context from session data for AI prompt building."""

from __future__ import annotations

import json

import aiosqlite


async def compose_context(db: aiosqlite.Connection, session_id: str) -> dict:
    """Read session data from DB and return a flat context dict for generators.

    Raises ValueError if the session is missing or incomplete (steps 1-4).
    """
    cursor = await db.execute(
        "SELECT data FROM sessions WHERE session_id = ?",
        (session_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise ValueError(f"Session not found: {session_id}")

    blob = json.loads(row["data"])

    bp = blob.get("business_profile", {})
    aud = blob.get("audience", {})
    goals = blob.get("goals", {})
    creative = blob.get("creative", {})

    # Validate all 4 steps are present
    missing = []
    if not bp:
        missing.append("business_profile (step 1)")
    if not aud:
        missing.append("audience (step 2)")
    if not goals:
        missing.append("goals (step 3)")
    if not creative:
        missing.append("creative (step 4)")
    if missing:
        raise ValueError(f"Incomplete session — missing: {', '.join(missing)}")

    return {
        # Business profile — keys match frontend SetupPage submitStep payload
        "brand_name": bp.get("storeName", ""),
        "website_url": bp.get("websiteUrl", ""),
        "product_category": bp.get("productCategory", ""),
        "store_type": bp.get("storeType", ""),
        "brand_insights": bp.get("brandInsights", ""),
        "brand_colours": bp.get("brandColors", []),
        "logo_url": bp.get("logoUrl", ""),
        "logo_placement": bp.get("logoPlacement", "bottom-right"),
        "typography_style": bp.get("typographyStyle", ""),
        "target_market_location": bp.get("targetMarketLocation", ""),
        "instagram_url": bp.get("instagramUrl", ""),
        # Audience — keys match frontend AudiencePage submitStep payload
        "primary_segment": aud.get("primarySegment", ""),
        "secondary_segment": aud.get("secondarySegment", ""),
        "audience_description": aud.get("description", ""),
        "audience_segments": aud.get("segments", []),
        "geo_targeting": aud.get("geoTargeting", ""),
        "age_range": aud.get("ageRange", []),
        "gender_focus": aud.get("genderFocus", "all"),
        "activity_level": aud.get("activityLevel", ""),
        # Goals — keys match frontend GoalsPage submitStep payload
        "goal_type": goals.get("goalType", ""),
        "budget": goals.get("budget", 0),
        "duration_days": goals.get("durationDays", 30),
        "start_date": goals.get("startDate", ""),
        "formats": goals.get("formats", []),
        # Creative — keys match frontend CreativePage submitStep payload
        "image_style": creative.get("imageStyle", ""),
        "content_type": creative.get("contentType", ["post"]),
        "image_sizes": creative.get("imageSizes", []),
        "variant_count": creative.get("variantCount", 4),
        "tone_of_voice": creative.get("toneOfVoice", ""),
        "hashtag_count": creative.get("hashtagCount", "10-15"),
        "hashtag_mix": creative.get("hashtagMix", "balanced"),
        "seed_hashtags": creative.get("seedHashtags", ""),
    }
