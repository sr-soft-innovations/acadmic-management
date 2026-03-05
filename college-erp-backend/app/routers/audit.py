"""Audit logs - list with optional filters."""
from fastapi import APIRouter, Depends, Query
from app.db import read_audit
from app.routers.auth import _get_current_user

router = APIRouter()


@router.get("")
async def list_audit(
    limit: int = Query(100, ge=1, le=1000),
    current: dict = Depends(_get_current_user),
):
    from app.permissions import has_permission
    if not has_permission(current.get("role"), "audit:read"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="No permission to view audit logs.")
    entries = read_audit(limit=limit)
    return {"audit": entries}
