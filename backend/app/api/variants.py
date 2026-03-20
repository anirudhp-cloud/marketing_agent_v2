"""Variants API — list and patch campaign variants."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path

from app.db.database import get_db
from app.db.variant_queries import list_variants, patch_variant
from app.models.campaign import VariantPatch

router = APIRouter()


@router.get("/{session_id}")
async def get_variants(session_id: str = Path(...)):
    """Return all variants for a session."""
    db = await get_db()
    variants = await list_variants(db, session_id)
    return {"variants": variants}


@router.patch("/{variant_id}")
async def update_variant(variant_id: int = Path(...), body: VariantPatch = ...):
    """Update specific fields on a variant."""
    db = await get_db()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await patch_variant(db, variant_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Variant not found")

    return result
