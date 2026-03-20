from fastapi import APIRouter, HTTPException

from app.db.database import get_db
from app.db.queries import upsert_session, get_session, set_approved
from app.models.session import StepSubmission, ResumeRequest

router = APIRouter()


@router.post("/step")
async def submit_step(body: StepSubmission):
    """Save wizard step data. Creates the session on step 1 (upsert)."""
    db = await get_db()
    result = await upsert_session(db, body.session_id, body.step, body.data)
    return result


@router.get("/state/{session_id}")
async def get_state(session_id: str):
    """Return full AgentState including variants and calendar posts."""
    db = await get_db()
    state = await get_session(db, session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


@router.post("/resume")
async def resume(body: ResumeRequest):
    """Set the human_approved flag on a session."""
    db = await get_db()
    updated = await set_approved(db, body.session_id, body.human_approved)
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "ok", "approved": body.human_approved}
