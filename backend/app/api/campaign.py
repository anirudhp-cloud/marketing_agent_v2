"""Campaign generation API — preflight check + SSE generation endpoint."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.db.database import get_db
from app.models.campaign import PreflightRequest, PreflightResponse, RegenerateRequest
from app.services.copy_generator import generate_copy
from app.services.image_generator import generate_images
from app.services.video_generator import generate_videos
from app.services.context_composer import compose_context

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/preflight", response_model=PreflightResponse)
async def preflight(req: PreflightRequest):
    """Check if a session has all 4 steps completed and is ready for generation."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT data FROM sessions WHERE session_id = ?",
        (req.session_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    blob = json.loads(row["data"])
    missing = []
    for key, label in [
        ("business_profile", "Business Profile (step 1)"),
        ("audience", "Audience (step 2)"),
        ("goals", "Campaign Goals (step 3)"),
        ("creative", "Creative Config (step 4)"),
    ]:
        if not blob.get(key):
            missing.append(label)

    return PreflightResponse(ready=len(missing) == 0, missing=missing)


@router.get("/generate")
async def generate(session_id: str = Query(...)):
    """SSE endpoint — streams progress events as campaign copy is generated."""
    db = await get_db()

    # Verify session exists
    cursor = await db.execute(
        "SELECT id FROM sessions WHERE session_id = ?",
        (session_id,),
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_stream():
        try:
            # Phase 1: Generate copy variants
            async for progress in generate_copy(db, session_id):
                yield f"data: {json.dumps(progress)}\n\n"

            ctx = await compose_context(db, session_id)

            # Phase 2: Generate videos (if "reel" in content_type) — reels first
            async for progress in generate_videos(db, session_id, ctx):
                yield f"data: {json.dumps(progress)}\n\n"

            # Phase 3: Generate images (if "image" in content_type)
            async for progress in generate_images(db, session_id, ctx):
                yield f"data: {json.dumps(progress)}\n\n"

        except ValueError as e:
            yield f"data: {json.dumps({'step': 'error', 'message': str(e)})}\n\n"
        except Exception as e:
            logger.exception("Generation failed for session %s", session_id)
            yield f"data: {json.dumps({'step': 'error', 'message': 'Generation failed. Please try again.'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/regenerate")
async def regenerate(req: RegenerateRequest):
    """Regenerate all variants for a session (with optional instruction tweak).

    For now, just re-runs the copy generator. Future: inject instructions into prompt.
    """
    db = await get_db()
    cursor = await db.execute(
        "SELECT id FROM sessions WHERE session_id = ?",
        (req.session_id,),
    )
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_stream():
        try:
            async for progress in generate_copy(db, req.session_id):
                yield f"data: {json.dumps(progress)}\n\n"

            ctx = await compose_context(db, req.session_id)

            async for progress in generate_videos(db, req.session_id, ctx):
                yield f"data: {json.dumps(progress)}\n\n"

            async for progress in generate_images(db, req.session_id, ctx):
                yield f"data: {json.dumps(progress)}\n\n"

        except ValueError as e:
            yield f"data: {json.dumps({'step': 'error', 'message': str(e)})}\n\n"
        except Exception as e:
            logger.exception("Regeneration failed for session %s", req.session_id)
            yield f"data: {json.dumps({'step': 'error', 'message': 'Regeneration failed.'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
