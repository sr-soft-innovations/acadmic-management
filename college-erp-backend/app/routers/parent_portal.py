"""Parent portal: view attendance, marks, fee status, communication with faculty."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()

STAFF_ROLES = {"admin", "principal", "hod", "staff"}


def _get_parent_student_ids(current: dict) -> list[str]:
    """Return list of student IDs linked to the current user (must be parent role)."""
    if (current.get("role") or "").lower() != "parent":
        raise HTTPException(status_code=403, detail="Parent access only.")
    users = read_json("users")
    user_id = str(current.get("sub") or "")
    for u in users:
        if str(u.get("id")) == user_id:
            linked = u.get("linked_student_ids")
            if isinstance(linked, list):
                return [str(s) for s in linked]
            sid = u.get("linked_student_id")
            return [str(sid)] if sid else []
    return []


def _ensure_linked(current: dict, student_id: str) -> None:
    ids = _get_parent_student_ids(current)
    if str(student_id) not in ids:
        raise HTTPException(status_code=403, detail="Student not linked to your account.")


@router.get("/students")
def list_my_students(current: dict = Depends(_get_current_user)):
    """List students linked to the logged-in parent."""
    ids = _get_parent_student_ids(current)
    students = read_json("students")
    out = [s for s in students if str(s.get("id")) in ids]
    return {"students": out}


@router.get("/students/{student_id}/attendance")
def get_student_attendance(student_id: str, current: dict = Depends(_get_current_user)):
    """View attendance for a linked student."""
    _ensure_linked(current, student_id)
    items = read_json("attendance")
    out = [a for a in items if str(a.get("student_id")) == str(student_id)]
    out.sort(key=lambda x: x.get("date") or "", reverse=True)
    return {"attendance": out[:100]}


@router.get("/students/{student_id}/marks")
def get_student_marks(student_id: str, current: dict = Depends(_get_current_user)):
    """View marks for a linked student."""
    _ensure_linked(current, student_id)
    items = read_json("marks")
    out = [m for m in items if str(m.get("student_id")) == str(student_id)]
    out.sort(key=lambda x: (x.get("exam_date") or "", x.get("subject") or ""), reverse=True)
    return {"marks": out}


@router.get("/students/{student_id}/fees")
def get_student_fee_status(student_id: str, current: dict = Depends(_get_current_user)):
    """View fee payment status for a linked student."""
    _ensure_linked(current, student_id)
    collections = read_json("fee_collections")
    out = [c for c in collections if str(c.get("student_id")) == str(student_id)]
    out.sort(key=lambda x: x.get("paid_at") or x.get("created_at") or "", reverse=True)
    total_paid = sum(float(c.get("amount") or 0) for c in out)
    return {
        "payments": out,
        "total_paid": round(total_paid, 2),
        "transaction_count": len(out),
    }


class PayFeeBody(BaseModel):
    amount: float
    fee_type: str = "tuition"
    remarks: str = ""


@router.post("/students/{student_id}/pay-fee")
def pay_fee(student_id: str, body: PayFeeBody, current: dict = Depends(_get_current_user)):
    """Parent pays fee for a linked student. Records payment; online gateway integration is placeholder."""
    _ensure_linked(current, student_id)
    students = read_json("students")
    student = next((s for s in students if str(s.get("id")) == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")
    collections = read_json("fee_collections")
    paid_at = datetime.now(timezone.utc).isoformat()
    new_id = next_id("fee_collections")
    item = {
        "id": new_id,
        "student_id": student_id,
        "student_name": student.get("name") or "",
        "roll_no": student.get("roll_no") or "",
        "course": student.get("course") or "",
        "semester": str(student.get("semester") or ""),
        "amount": float(body.amount),
        "fee_type": (body.fee_type or "tuition").strip() or "tuition",
        "receipt_no": f"PAR-{new_id}",
        "remarks": (body.remarks or "").strip() or "Parent portal payment",
        "paid_at": paid_at,
        "created_at": paid_at,
        "paid_by_parent_id": str(current.get("sub") or ""),
    }
    collections.append(item)
    write_json("fee_collections", collections)
    return item


# --- Communication with faculty ---
class MessageCreate(BaseModel):
    student_id: str
    subject: str = ""
    body: str = ""
    to_user_id: str | None = None  # optional: specific staff; if null, goes to "faculty" inbox


@router.get("/communication")
def list_communication(student_id: str | None = None, current: dict = Depends(_get_current_user)):
    """List messages (parent ↔ faculty) for the logged-in parent. Optional filter by student_id."""
    ids = _get_parent_student_ids(current)
    user_id = str(current.get("sub") or "")
    messages = read_json("parent_messages")
    out = [
        m
        for m in messages
        if str(m.get("from_user_id")) == user_id or str(m.get("to_user_id")) == user_id
    ]
    if student_id:
        _ensure_linked(current, student_id)
        out = [m for m in out if str(m.get("student_id")) == str(student_id)]
    out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"messages": out[:80]}


@router.post("/communication")
def send_message(body: MessageCreate, current: dict = Depends(_get_current_user)):
    """Parent sends a message (to faculty or specific staff)."""
    _ensure_linked(current, body.student_id)
    user_id = str(current.get("sub") or "")
    messages = read_json("parent_messages")
    new_id = next_id("parent_messages")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": new_id,
        "from_user_id": user_id,
        "to_user_id": body.to_user_id or None,
        "to_role": "staff" if not body.to_user_id else None,
        "student_id": body.student_id,
        "subject": (body.subject or "").strip() or "No subject",
        "body": (body.body or "").strip(),
        "created_at": now,
        "read_at": None,
    }
    messages.append(entry)
    write_json("parent_messages", messages)
    return entry


class ReplyCreate(BaseModel):
    parent_id: str
    student_id: str
    subject: str = ""
    body: str = ""


def _is_staff(current: dict) -> bool:
    return (current.get("role") or "").lower() in STAFF_ROLES


@router.get("/communication/inbox")
def list_faculty_inbox(current: dict = Depends(_get_current_user)):
    """Staff/faculty: list messages from parents (to_role=staff or to_user_id=me)."""
    if not _is_staff(current):
        raise HTTPException(status_code=403, detail="Staff access only.")
    user_id = str(current.get("sub") or "")
    messages = read_json("parent_messages")
    out = [
        m for m in messages
        if str(m.get("to_user_id")) == user_id or (m.get("to_role") == "staff" and not m.get("to_user_id"))
    ]
    out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"messages": out[:80]}


@router.post("/communication/reply")
def faculty_reply(body: ReplyCreate, current: dict = Depends(_get_current_user)):
    """Staff/faculty: reply to a parent."""
    if not _is_staff(current):
        raise HTTPException(status_code=403, detail="Staff access only.")
    user_id = str(current.get("sub") or "")
    messages = read_json("parent_messages")
    new_id = next_id("parent_messages")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": new_id,
        "from_user_id": user_id,
        "to_user_id": body.parent_id,
        "student_id": body.student_id,
        "subject": (body.subject or "").strip() or "Re: Parent enquiry",
        "body": (body.body or "").strip(),
        "created_at": now,
        "read_at": None,
    }
    messages.append(entry)
    write_json("parent_messages", messages)
    return entry
