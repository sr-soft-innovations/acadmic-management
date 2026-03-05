"""Exam schedule, internal/external, hall ticket, seating, marks entry, result publish, revaluation."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()


class ExamCreate(BaseModel):
    title: str
    course: str = ""
    subject: str = ""
    subject_id: str = ""
    exam_type: str = "internal"  # internal | external
    exam_date: str = ""
    start_time: str = ""
    duration_minutes: int = 0
    room: str = ""


class ExamUpdate(BaseModel):
    title: str | None = None
    course: str | None = None
    subject: str | None = None
    subject_id: str | None = None
    exam_type: str | None = None
    exam_date: str | None = None
    start_time: str | None = None
    duration_minutes: int | None = None
    room: str | None = None


class SeatingCreate(BaseModel):
    exam_id: str
    student_id: str
    room: str = ""
    row: str = ""
    seat_number: str = ""


class MarksEntry(BaseModel):
    exam_id: str
    student_id: str
    marks: float
    max_marks: float = 100


class RevaluationCreate(BaseModel):
    student_id: str
    exam_id: str
    subject_id: str = ""
    current_marks: float = 0
    reason: str = ""


class RevaluationUpdate(BaseModel):
    status: str = ""  # pending | approved | rejected
    revised_marks: float | None = None
    remarks: str = ""


@router.get("")
def list_exams(current: dict = Depends(_get_current_user), exam_type: str | None = None, course: str | None = None):
    exams = read_json("exams")
    if exam_type:
        exams = [e for e in exams if (e.get("exam_type") or "internal").lower() == exam_type.lower()]
    if course:
        exams = [e for e in exams if (e.get("course") or "").strip() == course.strip()]
    exams.sort(key=lambda x: (x.get("exam_date") or "", x.get("start_time") or ""))
    return exams


@router.get("/upcoming")
def upcoming_exams(current: dict = Depends(_get_current_user), limit: int = 10, exam_type: str | None = None):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    exams = [e for e in read_json("exams") if (e.get("exam_date") or "") >= today]
    if exam_type:
        exams = [e for e in exams if (e.get("exam_type") or "internal").lower() == exam_type.lower()]
    exams.sort(key=lambda x: (x.get("exam_date") or "", x.get("start_time") or ""))
    return {"exams": exams[:limit]}


@router.get("/schedule")
def exam_schedule(current: dict = Depends(_get_current_user), date_from: str | None = None, date_to: str | None = None, exam_type: str | None = None):
    exams = read_json("exams")
    if date_from:
        exams = [e for e in exams if (e.get("exam_date") or "") >= date_from[:10]]
    if date_to:
        exams = [e for e in exams if (e.get("exam_date") or "") <= date_to[:10]]
    if exam_type:
        exams = [e for e in exams if (e.get("exam_type") or "internal").lower() == exam_type.lower()]
    exams.sort(key=lambda x: (x.get("exam_date") or "", x.get("start_time") or ""))
    return {"schedule": exams}


@router.get("/revaluation")
def list_revaluation(current: dict = Depends(_get_current_user), status: str | None = None):
    items = read_json("revaluation_requests")
    if status:
        items = [r for r in items if (r.get("status") or "pending").lower() == status.lower()]
    students = read_json("students")
    exams = read_json("exams")
    for r in items:
        r["student_name"] = next((s.get("name") for s in students if str(s.get("id")) == str(r.get("student_id"))), "")
        r["exam_title"] = next((e.get("title") for e in exams if str(e.get("id")) == str(r.get("exam_id"))), "")
    return items


@router.post("/revaluation")
def request_revaluation(body: RevaluationCreate, current: dict = Depends(_get_current_user)):
    items = read_json("revaluation_requests")
    new_id = next_id("revaluation_requests")
    now = datetime.now(timezone.utc).isoformat()
    entry = {"id": new_id, "student_id": body.student_id, "exam_id": body.exam_id, "subject_id": (body.subject_id or "").strip(), "current_marks": body.current_marks, "reason": (body.reason or "").strip(), "status": "pending", "requested_at": now, "revised_marks": None, "remarks": ""}
    items.append(entry)
    write_json("revaluation_requests", items)
    return entry


@router.put("/revaluation/{request_id}")
def update_revaluation(request_id: str, body: RevaluationUpdate, current: dict = Depends(_get_current_user)):
    items = read_json("revaluation_requests")
    for i, r in enumerate(items):
        if str(r.get("id")) == str(request_id):
            if body.status:
                items[i]["status"] = body.status.strip().lower()
            if body.revised_marks is not None:
                items[i]["revised_marks"] = body.revised_marks
            if body.remarks is not None:
                items[i]["remarks"] = body.remarks
            write_json("revaluation_requests", items)
            return items[i]
    raise HTTPException(status_code=404, detail="Revaluation request not found")


@router.get("/{exam_id}")
def get_exam(exam_id: str, current: dict = Depends(_get_current_user)):
    for e in read_json("exams"):
        if str(e.get("id")) == str(exam_id):
            return e
    raise HTTPException(status_code=404, detail="Exam not found")


@router.post("")
def create_exam(body: ExamCreate, current: dict = Depends(_get_current_user)):
    exams = read_json("exams")
    new_id = next_id("exams")
    item = {
        "id": new_id,
        "title": body.title,
        "course": (body.course or "").strip(),
        "subject": (body.subject or "").strip(),
        "subject_id": (body.subject_id or "").strip(),
        "exam_type": (body.exam_type or "internal").strip().lower() or "internal",
        "exam_date": (body.exam_date or "")[:10],
        "start_time": (body.start_time or "").strip(),
        "duration_minutes": body.duration_minutes or 0,
        "room": (body.room or "").strip(),
        "result_published": False,
        "result_published_at": None,
    }
    exams.append(item)
    write_json("exams", exams)
    return item


@router.put("/{exam_id}")
def update_exam(exam_id: str, body: ExamUpdate, current: dict = Depends(_get_current_user)):
    exams = read_json("exams")
    for i, e in enumerate(exams):
        if str(e.get("id")) == str(exam_id):
            data = body.model_dump(exclude_unset=True)
            if "exam_type" in data and data["exam_type"]:
                data["exam_type"] = (data["exam_type"] or "internal").strip().lower()
            exams[i] = {**e, **data}
            write_json("exams", exams)
            return exams[i]
    raise HTTPException(status_code=404, detail="Exam not found")


@router.post("/{exam_id}/publish-result")
def publish_result(exam_id: str, current: dict = Depends(_get_current_user)):
    exams = read_json("exams")
    now = datetime.now(timezone.utc).isoformat()
    for i, e in enumerate(exams):
        if str(e.get("id")) == str(exam_id):
            exams[i]["result_published"] = True
            exams[i]["result_published_at"] = now
            write_json("exams", exams)
            return exams[i]
    raise HTTPException(status_code=404, detail="Exam not found")


@router.delete("/{exam_id}")
def delete_exam(exam_id: str, current: dict = Depends(_get_current_user)):
    exams = read_json("exams")
    for i, e in enumerate(exams):
        if str(e.get("id")) == str(exam_id):
            exams.pop(i)
            write_json("exams", exams)
            return {"deleted": exam_id}
    raise HTTPException(status_code=404, detail="Exam not found")


# --- Hall ticket ---
@router.get("/{exam_id}/hall-ticket/{student_id}")
def hall_ticket(exam_id: str, student_id: str, current: dict = Depends(_get_current_user)):
    exams = read_json("exams")
    exam = next((e for e in exams if str(e.get("id")) == str(exam_id)), None)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    students = read_json("students")
    student = next((s for s in students if str(s.get("id")) == str(student_id)), None)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    seating = read_json("exam_seating")
    seat = next((s for s in seating if str(s.get("exam_id")) == str(exam_id) and str(s.get("student_id")) == str(student_id)), None)
    return {
        "exam": exam,
        "student": student,
        "room": (seat or {}).get("room") or exam.get("room"),
        "row": (seat or {}).get("row"),
        "seat_number": (seat or {}).get("seat_number"),
    }


@router.get("/{exam_id}/hall-tickets")
def list_hall_tickets(exam_id: str, current: dict = Depends(_get_current_user)):
    exam = get_exam(exam_id, current)
    seating = [s for s in read_json("exam_seating") if str(s.get("exam_id")) == str(exam_id)]
    students = read_json("students")
    out = []
    for s in seating:
        st = next((x for x in students if str(x.get("id")) == str(s.get("student_id"))), {})
        out.append({"student": st, "room": s.get("room"), "row": s.get("row"), "seat_number": s.get("seat_number")})
    return {"exam": exam, "hall_tickets": out}


# --- Seating arrangement ---
@router.get("/{exam_id}/seating")
def list_seating(exam_id: str, current: dict = Depends(_get_current_user)):
    items = [s for s in read_json("exam_seating") if str(s.get("exam_id")) == str(exam_id)]
    students = read_json("students")
    for s in items:
        st = next((x for x in students if str(x.get("id")) == str(s.get("student_id"))), {})
        s["student_name"] = st.get("name")
        s["roll_no"] = st.get("roll_no")
    items.sort(key=lambda x: (x.get("room") or "", x.get("row") or "", x.get("seat_number") or ""))
    return items


@router.post("/seating")
def add_seating(body: SeatingCreate, current: dict = Depends(_get_current_user)):
    items = read_json("exam_seating")
    if any(str(s.get("exam_id")) == str(body.exam_id) and str(s.get("student_id")) == str(body.student_id) for s in items):
        raise HTTPException(status_code=400, detail="Seat already assigned for this student in this exam")
    new_id = next_id("exam_seating")
    item = {"id": new_id, "exam_id": body.exam_id, "student_id": body.student_id, "room": (body.room or "").strip(), "row": (body.row or "").strip(), "seat_number": (body.seat_number or "").strip()}
    items.append(item)
    write_json("exam_seating", items)
    return item


class SeatingUpdate(BaseModel):
    room: str | None = None
    row: str | None = None
    seat_number: str | None = None


@router.put("/seating/{seating_id}")
def update_seating(seating_id: str, body: SeatingUpdate, current: dict = Depends(_get_current_user)):
    items = read_json("exam_seating")
    for i, s in enumerate(items):
        if str(s.get("id")) == str(seating_id):
            data = body.model_dump(exclude_unset=True)
            items[i] = {**s, **data}
            write_json("exam_seating", items)
            return items[i]
    raise HTTPException(status_code=404, detail="Seating not found")


@router.delete("/seating/{seating_id}")
def delete_seating(seating_id: str, current: dict = Depends(_get_current_user)):
    items = read_json("exam_seating")
    for i, s in enumerate(items):
        if str(s.get("id")) == str(seating_id):
            items.pop(i)
            write_json("exam_seating", items)
            return {"deleted": seating_id}
    raise HTTPException(status_code=404, detail="Seating not found")


# --- Marks entry (by exam) ---
@router.get("/{exam_id}/marks")
def list_marks(exam_id: str, current: dict = Depends(_get_current_user)):
    marks = [m for m in read_json("marks") if str(m.get("exam_id")) == str(exam_id)]
    students = read_json("students")
    for m in marks:
        st = next((x for x in students if str(x.get("id")) == str(m.get("student_id"))), {})
        m["student_name"] = st.get("name")
        m["roll_no"] = st.get("roll_no")
    marks.sort(key=lambda x: (x.get("roll_no") or "", x.get("student_id") or ""))
    return marks


@router.post("/marks")
def enter_marks(body: MarksEntry, current: dict = Depends(_get_current_user)):
    marks_list = read_json("marks")
    exam_id = str(body.exam_id)
    student_id = str(body.student_id)
    existing = next((m for m in marks_list if str(m.get("exam_id")) == exam_id and str(m.get("student_id")) == student_id), None)
    exam = next((e for e in read_json("exams") if str(e.get("id")) == exam_id), {})
    student = next((s for s in read_json("students") if str(s.get("id")) == student_id), {})
    sem = str(student.get("semester") or "").strip() or str(exam.get("semester") or "").strip()
    entry = {
        "exam_id": exam_id, "student_id": student_id, "marks": body.marks, "max_marks": body.max_marks or 100,
        "subject": exam.get("subject"), "subject_id": (exam.get("subject_id") or "").strip(),
        "exam_type": exam.get("exam_type"), "exam_date": exam.get("exam_date"), "semester": sem,
    }
    if existing:
        for i, m in enumerate(marks_list):
            if str(m.get("id")) == str(existing.get("id")):
                marks_list[i] = {**m, **entry}
                write_json("marks", marks_list)
                return marks_list[i]
    new_id = next_id("marks")
    entry["id"] = new_id
    marks_list.append(entry)
    write_json("marks", marks_list)
    return entry


