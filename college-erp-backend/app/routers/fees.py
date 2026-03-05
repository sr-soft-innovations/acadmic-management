"""Fee collections and analytics."""
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.permissions import has_permission
from app.routers.auth import _get_current_user

router = APIRouter()

FEE_TYPES = ["tuition", "exam", "library", "lab", "other"]


class FeeCollectionCreate(BaseModel):
    student_id: str
    student_name: str = ""
    roll_no: str = ""
    course: str = ""
    semester: str = ""
    amount: float
    fee_type: str = "tuition"
    receipt_no: str = ""
    remarks: str = ""


@router.get("")
def list_collections(current: dict = Depends(_get_current_user)):
    """List all fee collections (optional: filter by course, month)."""
    if not has_permission(current.get("role"), "fees:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    return read_json("fee_collections")


@router.get("/analytics")
def fee_analytics(current: dict = Depends(_get_current_user)):
    """Fee collection analytics: totals, by course, by month, by fee type."""
    if not has_permission(current.get("role"), "fees:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    collections = read_json("fee_collections")
    total = sum(float(c.get("amount") or 0) for c in collections)
    by_course = defaultdict(float)
    by_semester = defaultdict(float)
    by_fee_type = defaultdict(float)
    by_month = defaultdict(float)  # key: "YYYY-MM"
    for c in collections:
        amt = float(c.get("amount") or 0)
        course = (c.get("course") or "").strip() or "Not specified"
        semester = (c.get("semester") or "").strip() or "Not specified"
        fee_type = (c.get("fee_type") or "tuition").strip() or "tuition"
        by_course[course] += amt
        by_semester[semester] += amt
        by_fee_type[fee_type] += amt
        paid_at = c.get("paid_at") or c.get("created_at") or ""
        if paid_at:
            try:
                if "T" in paid_at:
                    month_key = paid_at[:7]
                else:
                    month_key = paid_at[:7] if len(paid_at) >= 7 else ""
                if month_key:
                    by_month[month_key] += amt
            except Exception:
                pass
    recent = sorted(collections, key=lambda x: x.get("paid_at") or x.get("created_at") or "", reverse=True)[:15]
    return {
        "total_collected": round(total, 2),
        "transaction_count": len(collections),
        "by_course": dict(sorted(by_course.items(), key=lambda x: (-x[1], x[0]))),
        "by_semester": dict(sorted(by_semester.items(), key=lambda x: (-x[1], x[0]))),
        "by_fee_type": dict(sorted(by_fee_type.items(), key=lambda x: (-x[1], x[0]))),
        "by_month": dict(sorted(by_month.items(), reverse=True)),
        "recent_collections": recent,
    }


@router.post("")
def create_collection(body: FeeCollectionCreate, current: dict = Depends(_get_current_user)):
    """Record a fee payment."""
    if not has_permission(current.get("role"), "fees:add"):
        raise HTTPException(status_code=403, detail="No permission.")
    collections = read_json("fee_collections")
    paid_at = datetime.now(timezone.utc).isoformat()
    new_id = next_id("fee_collections")
    item = {
        "id": new_id,
        "student_id": body.student_id,
        "student_name": body.student_name or "",
        "roll_no": body.roll_no or "",
        "course": body.course or "",
        "semester": body.semester or "",
        "amount": float(body.amount),
        "fee_type": (body.fee_type or "tuition").strip() or "tuition",
        "receipt_no": body.receipt_no or "",
        "remarks": body.remarks or "",
        "paid_at": paid_at,
        "created_at": paid_at,
    }
    collections.append(item)
    write_json("fee_collections", collections)
    return item


@router.get("/fee-types")
def list_fee_types(current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "fees:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    return {"fee_types": FEE_TYPES}


# --- Fee structure CRUD ---
class FeeStructureCreate(BaseModel):
    course: str
    semester: str
    tuition_fee: float = 0
    exam_fee: float = 0
    lab_fee: float = 0


@router.get("/structure")
def list_fee_structure(current: dict = Depends(_get_current_user)):
    """List fee structure by course/semester."""
    if not has_permission(current.get("role"), "fees:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    return read_json("fee_structure")


@router.post("/structure")
def create_fee_structure(body: FeeStructureCreate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "fees:add"):
        raise HTTPException(status_code=403, detail="No permission.")
    items = read_json("fee_structure")
    total = float(body.tuition_fee or 0) + float(body.exam_fee or 0) + float(body.lab_fee or 0)
    new_id = next_id("fee_structure")
    item = {
        "id": new_id,
        "course": (body.course or "").strip(),
        "semester": str(body.semester or "").strip(),
        "tuition_fee": float(body.tuition_fee or 0),
        "exam_fee": float(body.exam_fee or 0),
        "lab_fee": float(body.lab_fee or 0),
        "total": round(total, 2),
    }
    items.append(item)
    write_json("fee_structure", items)
    return item


@router.put("/structure/{item_id}")
def update_fee_structure(item_id: str, body: FeeStructureCreate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "fees:edit"):
        raise HTTPException(status_code=403, detail="No permission.")
    items = read_json("fee_structure")
    idx = next((i for i, x in enumerate(items) if str(x.get("id")) == str(item_id)), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Fee structure not found.")
    total = float(body.tuition_fee or 0) + float(body.exam_fee or 0) + float(body.lab_fee or 0)
    items[idx].update({
        "course": (body.course or "").strip(),
        "semester": str(body.semester or "").strip(),
        "tuition_fee": float(body.tuition_fee or 0),
        "exam_fee": float(body.exam_fee or 0),
        "lab_fee": float(body.lab_fee or 0),
        "total": round(total, 2),
    })
    write_json("fee_structure", items)
    return items[idx]


@router.delete("/structure/{item_id}")
def delete_fee_structure(item_id: str, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "fees:edit"):
        raise HTTPException(status_code=403, detail="No permission.")
    items = read_json("fee_structure")
    items = [x for x in items if str(x.get("id")) != str(item_id)]
    write_json("fee_structure", items)
    return {"deleted": item_id}
