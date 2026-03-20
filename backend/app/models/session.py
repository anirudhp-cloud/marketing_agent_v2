from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class StepSubmission(BaseModel):
    session_id: str
    step: int = Field(ge=1, le=9)
    data: dict[str, Any]


class ResumeRequest(BaseModel):
    session_id: str
    human_approved: bool
