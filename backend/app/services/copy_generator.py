"""Copy generator — calls GPT-4o to produce Instagram campaign variants."""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator

import aiosqlite

from app.config import get_settings
from app.utils.llm import get_openai_client
from app.services.context_composer import compose_context
from app.generators.instagram import build_system_prompt, build_user_prompt

logger = logging.getLogger(__name__)


async def generate_copy(
    db: aiosqlite.Connection,
    session_id: str,
) -> AsyncGenerator[dict, None]:
    """Generate copy variants via GPT-4o and insert into the variants table.

    Yields SSE-style progress dicts as generation progresses:
        {"step": "composing_context"}
        {"step": "calling_gpt"}
        {"step": "parsing_response"}
        {"step": "saving_variants", "count": N}
        {"step": "done", "variant_count": N}
    """
    settings = get_settings()

    # 1. Compose context from session
    yield {"step": "composing_context"}
    ctx = await compose_context(db, session_id)
    logger.info("Context composed for session %s: %d keys", session_id, len(ctx))

    # 2. Build prompts
    system_prompt = build_system_prompt()
    user_prompt = build_user_prompt(ctx)

    # 3. Call GPT-4o
    yield {"step": "calling_gpt"}
    client = get_openai_client()
    response = await client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.8,
        max_tokens=4096,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    logger.info("GPT-4o response length: %d chars", len(raw))

    # 4. Parse JSON response
    yield {"step": "parsing_response"}
    parsed = json.loads(raw)
    variants = parsed.get("variants", [])

    if not variants:
        raise ValueError("GPT-4o returned no variants")

    logger.info("Parsed %d variants from GPT response", len(variants))

    # 5. Delete any existing variants for this session (regeneration case)
    await db.execute(
        "DELETE FROM variants WHERE session_id = ?",
        (session_id,),
    )

    # 6. Insert variants into DB
    yield {"step": "saving_variants", "count": len(variants)}
    for v in variants:
        hashtags_json = json.dumps(v.get("hashtags", []))
        await db.execute(
            """INSERT INTO variants
               (session_id, angle, headline, copy_text, cta,
                target_segment, imagery_style, image_url, video_url,
                image_prompt, video_prompt, hashtags, score, is_recommended,
                compliance_status, compliance_issues)
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, 'unchecked', NULL)""",
            (
                session_id,
                v.get("angle", ""),
                v.get("headline", ""),
                v.get("copy_text", ""),
                v.get("cta", ""),
                v.get("target_segment", ""),
                v.get("imagery_style", ""),
                v.get("image_prompt", ""),
                v.get("video_prompt", ""),
                hashtags_json,
                v.get("score", 0),
                int(v.get("is_recommended", False)),
            ),
        )

    await db.commit()

    # 7. Update session pipeline_state
    await db.execute(
        "UPDATE sessions SET pipeline_state = 'copy_done' WHERE session_id = ?",
        (session_id,),
    )
    await db.commit()

    yield {"step": "done", "variant_count": len(variants)}
