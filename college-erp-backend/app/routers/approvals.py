"""Pending approvals (leave, fee waiver, etc.)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()

APPROVAL_TYPES = ["leave", "fee_waiver", "document", "other"]
STATUSES = ["pending", "approved", "rejected"]


class ApprovalCreate(BaseModel):
    type: str = "leave"
    applicant_id: str = ""
    applicant_name: str = ""
    reason: str = ""
    details: str = ""


class ApprovalUpdate(BaseModel):
    status: str  # approved | rejected
    remarks: str = ""


@router.get("")
def list_approvals(current: dict = Depends(_get_current_user)):
    return read_json("approvals")


@router.get("/pending")
def pending_approvals(current: dict = Depends(_get_current_user)):
    items = read_json("approvals")
    pending = [a for a in items if (a.get("status") or "").lower() == "pending"]
    pending.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"approvals": pending, "count": len(pending)}


@router.post("")
def create_approval(body: ApprovalCreate, current: dict = Depends(_get_current_user)):
    approvals = read_json("approvals")
    new_id = next_id("approvals")
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": new_id,
        "type": (body.type or "leave").strip() or "leave",
        "applicant_id": body.applicant_id,
        "applicant_name": body.applicant_name,
        "reason": body.reason,
        "details": body.details,
        "status": "pending",
        "created_at": now,
        "decided_at": None,
        "remarks": None,
    }
    approvals.append(item)
    write_json("approvals", approvals)
    return item


@router.patch("/{approval_id}")
def update_approval(approval_id: str, body: ApprovalUpdate, current: dict = Depends(_get_current_user)):
    approvals = read_json("approvals")
    status = (body.status or "").strip().lower()
    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be approved or rejected")
    now = datetime.now(timezone.utc).isoformat()
    for i, a in enumerate(approvals):
        if str(a.get("id")) == str(approval_id):
            approvals[i] = {**a, "status": status, "decided_at": now, "remarks": body.remarks or ""}
            write_json("approvals", approvals)
            return approvals[i]
    raise HTTPException(status_code=404, detail="Approval not found")
