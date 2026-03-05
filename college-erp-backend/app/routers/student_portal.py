"""Student portal: self-scoped views for marks, fees, notices, messaging, certificates."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()


def _get_student_id(current: dict) -> str | None:
    """Return student_id linked to current user (student role only)."""
    if (current.get("role") or "").lower() != "student":
        raise HTTPException(status_code=403, detail="Student access only.")
    users = read_json("users")
    user_id = str(current.get("sub") or "")
    for u in users:
        if str(u.get("id")) == user_id:
            return str(u.get("linked_student_id") or "") or None
    return None


def _ensure_student(current: dict) -> tuple[str, dict]:
    """Return (student_id, student) or raise."""
    sid = _get_student_id(current)
    if not sid:
        raise HTTPException(status_code=403, detail="No student linked to your account.")
    students = read_json("students")
    student = next((s for s in students if str(s.get("id")) == sid), None)
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")
    return sid, student


@router.get("/marks")
def get_my_marks(current: dict = Depends(_get_current_user)):
    """View own marks (internal/external)."""
    sid, _ = _ensure_student(current)
    marks = read_json("marks")
    out = [m for m in marks if str(m.get("student_id")) == sid]
    out.sort(key=lambda x: (x.get("exam_date") or "", x.get("subject") or ""), reverse=True)
    return {"marks": out}


@router.get("/fees")
def get_my_fee_status(current: dict = Depends(_get_current_user)):
    """View fee structure and payment history for own record."""
    sid, student = _ensure_student(current)
    course = (student.get("course") or "").strip()
    semester = str(student.get("semester") or "")
    fee_struct = read_json("fee_structure")
    structure = next((s for s in fee_struct if (s.get("course") or "").strip() == course and str(s.get("semester") or "") == semester), None)
    collections = read_json("fee_collections")
    payments = [c for c in collections if str(c.get("student_id")) == sid]
    payments.sort(key=lambda x: x.get("paid_at") or x.get("created_at") or "", reverse=True)
    total_paid = sum(float(c.get("amount") or 0) for c in payments)
    expected = 0
    if structure:
        expected = float(structure.get("total") or (structure.get("tuition_fee") or 0) + (structure.get("exam_fee") or 0) + (structure.get("lab_fee") or 0))
    fee_due = max(0, round(expected - total_paid, 2))
    return {
        "structure": structure,
        "payments": payments,
        "total_paid": round(total_paid, 2),
        "fee_due": fee_due,
    }


@router.get("/notices")
def get_my_notices(current: dict = Depends(_get_current_user)):
    """View notices targeted to students."""
    from datetime import date
    today = date.today().isoformat()
    notices = read_json("notices")
    out = [
        n for n in notices
        if "student" in [str(r).lower() for r in (n.get("target_roles") or [])]
        and (not n.get("expiry_date") or n.get("expiry_date") >= today)
    ]
    out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"notices": out}


@router.get("/assignments")
def get_my_assignments(current: dict = Depends(_get_current_user)):
    """View assignments for own course/semester."""
    _, student = _ensure_student(current)
    course = (student.get("course") or "").strip()
    semester = str(student.get("semester") or "")
    assignments = read_json("assignments")
    out = [a for a in assignments if (a.get("course") or "").strip() == course and str(a.get("semester") or "") == semester]
    out.sort(key=lambda x: x.get("due_date") or "", reverse=True)
    subs = read_json("assignment_submissions")
    my_subs = {str(s.get("assignment_id")): s for s in subs if str(s.get("student_id")) == str(student.get("id"))}
    for a in out:
        a["submitted"] = str(a.get("id")) in my_subs
        a["submission"] = my_subs.get(str(a.get("id")))
    return {"assignments": out}


class AssignmentSubmitBody(BaseModel):
    assignment_id: str
    content: str = ""
    attachment_url: str = ""


@router.post("/assignments/submit")
def submit_assignment(body: AssignmentSubmitBody, current: dict = Depends(_get_current_user)):
    """Submit an assignment."""
    sid, student = _ensure_student(current)
    assignments = read_json("assignments")
    asn = next((a for a in assignments if str(a.get("id")) == body.assignment_id), None)
    if not asn:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    course = (student.get("course") or "").strip()
    semester = str(student.get("semester") or "")
    if (asn.get("course") or "").strip() != course or str(asn.get("semester") or "") != semester:
        raise HTTPException(status_code=403, detail="Assignment not for your course.")
    subs = read_json("assignment_submissions")
    if any(str(s.get("student_id")) == sid and str(s.get("assignment_id")) == body.assignment_id for s in subs):
        raise HTTPException(status_code=400, detail="Already submitted.")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": next_id("assignment_submissions"),
        "student_id": sid,
        "assignment_id": body.assignment_id,
        "content": body.content,
        "attachment_url": body.attachment_url,
        "submitted_at": now,
    }
    subs.append(entry)
    write_json("assignment_submissions", subs)
    return entry


@router.get("/certificates")
def get_my_certificates(current: dict = Depends(_get_current_user)):
    """View available certificates (Bonafide, TC request status)."""
    sid, student = _ensure_student(current)
    certs = read_json("student_certificates")
    out = [c for c in certs if str(c.get("student_id")) == sid]
    return {"certificates": out}


class TCRequestBody(BaseModel):
    reason: str = ""


@router.get("/messaging")
def get_my_messages(current: dict = Depends(_get_current_user)):
    """View messages with faculty."""
    sid, _ = _ensure_student(current)
    user_id = str(current.get("sub") or "")
    messages = read_json("student_messages")
    out = [m for m in messages if str(m.get("from_user_id")) == user_id or str(m.get("to_user_id")) == user_id]
    out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"messages": out[:80]}


class MessageBody(BaseModel):
    subject: str = ""
    body: str = ""
    to_user_id: str | None = None


@router.post("/messaging")
def send_message(body: MessageBody, current: dict = Depends(_get_current_user)):
    """Send message to faculty."""
    sid, _ = _ensure_student(current)
    user_id = str(current.get("sub") or "")
    messages = read_json("student_messages")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": next_id("student_messages"),
        "from_user_id": user_id,
        "to_user_id": body.to_user_id or None,
        "to_role": "staff" if not body.to_user_id else None,
        "student_id": sid,
        "subject": (body.subject or "").strip() or "No subject",
        "body": (body.body or "").strip(),
        "created_at": now,
        "read_at": None,
    }
    messages.append(entry)
    write_json("student_messages", messages)
    return entry


@router.post("/certificates/request-tc")
def request_transfer_certificate(body: TCRequestBody, current: dict = Depends(_get_current_user)):
    """Request Transfer Certificate."""
    sid, student = _ensure_student(current)
    certs = read_json("student_certificates")
    existing = next((c for c in certs if str(c.get("student_id")) == sid and (c.get("type") or "").lower() == "tc_request"), None)
    if existing and (existing.get("status") or "").lower() == "pending":
        raise HTTPException(status_code=400, detail="TC request already pending.")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": next_id("student_certificates"),
        "student_id": sid,
        "type": "tc_request",
        "status": "pending",
        "reason": body.reason,
        "requested_at": now,
    }
    certs.append(entry)
    write_json("student_certificates", certs)
    return entry
