from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["public"])


@router.get("/health")
def health():
    return {"status": "ok"}

