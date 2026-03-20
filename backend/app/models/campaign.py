"""Pydantic models for campaign generation API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class PreflightRequest(BaseModel):
    session_id: str


class PreflightResponse(BaseModel):
    ready: bool
    missing: list[str] = []


class VariantOut(BaseModel):
    id: int
    angle: str
    headline: str
    copy_text: str
    cta: str
    target_segment: str | None = None
    imagery_style: str | None = None
    image_url: str | None = None
    image_prompt: str | None = None
    hashtags: list[str] = []
    score: float | None = None
    recommended: bool = False
    compliance_status: str = "unchecked"


class VariantPatch(BaseModel):
    headline: str | None = None
    copy_text: str | None = None
    cta: str | None = None
    target_segment: str | None = None
    imagery_style: str | None = None
    image_prompt: str | None = None


class RegenerateRequest(BaseModel):
    session_id: str
    instructions: str = ""
