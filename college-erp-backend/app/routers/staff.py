"""Staff: profile, department & role, subject assignment, workload, qualification, experience, leave, appraisal, publications, exit."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.permissions import has_permission
from app.routers.auth import _get_current_user

router = APIRouter()


# --- Schemas ---
class QualificationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""


class ExperienceItem(BaseModel):
    organization: str = ""
    role: str = ""
    from_year: str = ""
    to_year: str = ""


class StaffCreate(BaseModel):
    name: str
    designation: str = ""
    department: str = ""
    role: str = "Faculty"  # Faculty, HOD, Principal, Lab Assistant, Guest Faculty, Visiting, Substitute
    email: str = ""
    phone: str = ""
    date_of_joining: str = ""
    is_guest_faculty: bool = False
    is_substitute: bool = False
    substitute_for_staff_id: str = ""
    qualifications: list[dict] | None = None
    experience: list[dict] | None = None


class StaffUpdate(BaseModel):
    name: str | None = None
    designation: str | None = None
    department: str | None = None
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    date_of_joining: str | None = None
    is_guest_faculty: bool | None = None
    is_substitute: bool | None = None
    substitute_for_staff_id: str | None = None
    qualifications: list[dict] | None = None
    experience: list[dict] | None = None


def _staff_item(body: StaffCreate, new_id: str) -> dict:
    return {
        "id": new_id,
        "name": body.name,
        "designation": body.designation,
        "department": body.department,
        "role": body.role or "Faculty",
        "email": body.email,
        "phone": body.phone,
        "date_of_joining": body.date_of_joining,
        "is_guest_faculty": getattr(body, "is_guest_faculty", False),
        "is_substitute": getattr(body, "is_substitute", False),
        "substitute_for_staff_id": getattr(body, "substitute_for_staff_id", "") or "",
        "qualifications": body.qualifications if isinstance(body.qualifications, list) else [],
        "experience": body.experience if isinstance(body.experience, list) else [],
    }


@router.get("")
def list_staff(current: dict = Depends(_get_current_user), department: str | None = None, role: str | None = None):
    staff_list = read_json("staff")
    for s in staff_list:
        s.setdefault("role", "Faculty")
        s.setdefault("qualifications", [])
        s.setdefault("experience", [])
        s.setdefault("is_guest_faculty", False)
        s.setdefault("is_substitute", False)
    if department:
        staff_list = [s for s in staff_list if (s.get("department") or "").strip() == department.strip()]
    if role:
        staff_list = [s for s in staff_list if (s.get("role") or "").strip() == role.strip()]
    return staff_list


# --- Leave (literal path before {staff_id}) ---
@router.get("/leave-requests")
def list_all_leave_requests(current: dict = Depends(_get_current_user), status: str | None = None):
    if not has_permission(current.get("role"), "staff:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    items = _leave_requests()
    if status:
        items = [r for r in items if (r.get("status") or "pending").lower() == status.lower()]
    return {"leave_requests": items}


@router.get("/resignations")
def list_resignations(current: dict = Depends(_get_current_user), status: str | None = None):
    if not has_permission(current.get("role"), "staff:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    items = _resignations()
    if status:
        items = [r for r in items if (r.get("status") or "pending").lower() == status.lower()]
    return {"resignations": items}


@router.get("/{staff_id}")
def get_staff_member(staff_id: str, current: dict = Depends(_get_current_user)):
    staff_list = read_json("staff")
    for s in staff_list:
        if str(s.get("id")) == str(staff_id):
            s.setdefault("role", "Faculty")
            s.setdefault("qualifications", [])
            s.setdefault("experience", [])
            return s
    raise HTTPException(status_code=404, detail="Staff not found")


@router.post("")
def create_staff(body: StaffCreate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "staff:write"):
        raise HTTPException(status_code=403, detail="No permission to create staff.")
    staff_list = read_json("staff")
    new_id = next_id("staff")
    item = _staff_item(body, new_id)
    staff_list.append(item)
    write_json("staff", staff_list)
    return item


@router.put("/{staff_id}")
def update_staff(staff_id: str, body: StaffUpdate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "staff:write"):
        raise HTTPException(status_code=403, detail="No permission to edit staff.")
    staff_list = read_json("staff")
    for i, s in enumerate(staff_list):
        if str(s.get("id")) == str(staff_id):
            data = body.model_dump(exclude_unset=True)
            staff_list[i] = {**s, **data}
            write_json("staff", staff_list)
            return staff_list[i]
    raise HTTPException(status_code=404, detail="Staff not found")


@router.delete("/{staff_id}")
def delete_staff(staff_id: str, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "staff:write"):
        raise HTTPException(status_code=403, detail="No permission to delete staff.")
    staff_list = read_json("staff")
    for i, s in enumerate(staff_list):
        if str(s.get("id")) == str(staff_id):
            staff_list.pop(i)
            write_json("staff", staff_list)
            return {"deleted": staff_id}
    raise HTTPException(status_code=404, detail="Staff not found")


# --- Workload (from timetable slots) ---
@router.get("/{staff_id}/workload")
def get_workload(staff_id: str, current: dict = Depends(_get_current_user)):
    slots = read_json("timetable")
    staff_slots = [s for s in slots if str(s.get("staff_id")) == str(staff_id)]
    courses = read_json("courses")
    by_subject = {}
    total_hours = 0
    for s in staff_slots:
        sub_id = s.get("subject_id")
        sub = next((c for c in courses if str(c.get("id")) == str(sub_id)), {})
        name = sub.get("name") or sub_id or "—"
        by_subject[name] = by_subject.get(name, 0) + 1
        start = (s.get("slot_start") or "0:0").replace(":", ".")
        end = (s.get("slot_end") or "0:0").replace(":", ".")
        try:
            h = float(end) - float(start)
            if h < 0:
                h = 1
            total_hours += h
        except ValueError:
            total_hours += 1
    return {"staff_id": staff_id, "total_slots": len(staff_slots), "total_hours_per_week": round(total_hours, 1), "by_subject": by_subject, "slots": staff_slots}


# --- Leave requests ---
def _leave_requests():
    return read_json("staff_leave_requests")


def _write_leave_requests(data: list):
    write_json("staff_leave_requests", data)


class LeaveRequestCreate(BaseModel):
    staff_id: str
    from_date: str
    to_date: str
    leave_type: str = "casual"  # casual, sick, earned, unpaid
    reason: str = ""


@router.post("/leave-requests")
def create_leave_request(body: LeaveRequestCreate, current: dict = Depends(_get_current_user)):
    staff_list = read_json("staff")
    if not any(str(s.get("id")) == str(body.staff_id) for s in staff_list):
        raise HTTPException(status_code=404, detail="Staff not found")
    reqs = _leave_requests()
    new_id = next_id("staff_leave_requests")
    entry = {
        "id": new_id,
        "staff_id": body.staff_id,
        "from_date": body.from_date,
        "to_date": body.to_date,
        "leave_type": body.leave_type,
        "reason": body.reason,
        "status": "pending",
        "created_at": str(date.today()),
        "approved_by": "",
        "remarks": "",
    }
    reqs.append(entry)
    _write_leave_requests(reqs)
    return entry


@router.get("/{staff_id}/leave-requests")
def list_leave_requests(staff_id: str, current: dict = Depends(_get_current_user)):
    items = [r for r in _leave_requests() if str(r.get("staff_id")) == str(staff_id)]
    return {"leave_requests": items}


class LeaveRequestUpdate(BaseModel):
    status: str  # approved | rejected
    remarks: str = ""


@router.patch("/leave-requests/{request_id}")
def update_leave_request(request_id: str, body: LeaveRequestUpdate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "staff:write"):
        raise HTTPException(status_code=403, detail="No permission to approve leave.")
    reqs = _leave_requests()
    for i, r in enumerate(reqs):
        if str(r.get("id")) == str(request_id):
            reqs[i]["status"] = body.status
            reqs[i]["remarks"] = body.remarks or ""
            reqs[i]["approved_by"] = current.get("sub", "")
            _write_leave_requests(reqs)
            return reqs[i]
    raise HTTPException(status_code=404, detail="Leave request not found")


# --- Appraisal & performance ---
def _appraisals():
    return read_json("staff_appraisals")


def _write_appraisals(data: list):
    write_json("staff_appraisals", data)


class AppraisalCreate(BaseModel):
    staff_id: str
    period: str = ""  # e.g. "2024-2025"
    rating: float | None = None
    remarks: str = ""
    goals_achieved: str = ""


@router.get("/{staff_id}/appraisals")
def list_appraisals(staff_id: str, current: dict = Depends(_get_current_user)):
    items = [a for a in _appraisals() if str(a.get("staff_id")) == str(staff_id)]
    return {"appraisals": items}


@router.post("/appraisals")
def create_appraisal(body: AppraisalCreate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "staff:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    staff_list = read_json("staff")
    if not any(str(s.get("id")) == str(body.staff_id) for s in staff_list):
        raise HTTPException(status_code=404, detail="Staff not found")
    appraisals = _appraisals()
    new_id = next_id("staff_appraisals")
    entry = {
        "id": new_id,
        "staff_id": body.staff_id,
        "period": body.period,
        "rating": body.rating,
        "remarks": body.remarks,
        "goals_achieved": body.goals_achieved,
        "created_at": str(date.today()),
    }
    appraisals.append(entry)
    _write_appraisals(appraisals)
    return entry


# --- Research & publications ---
def _publications():
    return read_json("staff_publications")


def _write_publications(data: list):
    write_json("staff_publications", data)


class PublicationCreate(BaseModel):
    staff_id: str
    title: str = ""
    journal_or_conference: str = ""
    year: str = ""
    type: str = "journal"  # journal, conference, book, patent


@router.get("/{staff_id}/publications")
def list_publications(staff_id: str, current: dict = Depends(_get_current_user)):
    items = [p for p in _publications() if str(p.get("staff_id")) == str(staff_id)]
    return {"publications": items}


@router.post("/publications")
def create_publication(body: PublicationCreate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "staff:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    staff_list = read_json("staff")
    if not any(str(s.get("id")) == str(body.staff_id) for s in staff_list):
        raise HTTPException(status_code=404, detail="Staff not found")
    pubs = _publications()
    new_id = next_id("staff_publications")
    entry = {
        "id": new_id,
        "staff_id": body.staff_id,
        "title": body.title,
        "journal_or_conference": body.journal_or_conference,
        "year": body.year,
        "type": body.type,
    }
    pubs.append(entry)
    _write_publications(pubs)
    return entry


# --- Exit / resignation workflow ---
def _resignations():
    return read_json("staff_resignations")


def _write_resignations(data: list):
    write_json("staff_resignations", data)


class ResignationCreate(BaseModel):
    staff_id: str
    last_working_date: str = ""
    reason: str = ""
    notice_date: str = ""


@router.get("/{staff_id}/resignation")
def get_resignation(staff_id: str, current: dict = Depends(_get_current_user)):
    items = [r for r in _resignations() if str(r.get("staff_id")) == str(staff_id)]
    return {"resignation": items[0] if items else None}


@router.post("/resignations")
def create_resignation(body: ResignationCreate, current: dict = Depends(_get_current_user)):
    staff_list = read_json("staff")
    if not any(str(s.get("id")) == str(body.staff_id) for s in staff_list):
        raise HTTPException(status_code=404, detail="Staff not found")
    existing = [r for r in _resignations() if str(r.get("staff_id")) == str(body.staff_id) and (r.get("status") or "pending") in ("pending", "approved")]
    if existing:
        raise HTTPException(status_code=400, detail="Resignation already submitted.")
    res = _resignations()
    new_id = next_id("staff_resignations")
    entry = {
        "id": new_id,
        "staff_id": body.staff_id,
        "last_working_date": body.last_working_date,
        "reason": body.reason,
        "notice_date": body.notice_date or str(date.today()),
        "status": "pending",
        "created_at": str(date.today()),
        "approved_by": "",
        "remarks": "",
    }
    res.append(entry)
    _write_resignations(res)
    return entry


class ResignationUpdate(BaseModel):
    status: str  # approved | rejected | completed
    remarks: str = ""


@router.patch("/resignations/{resignation_id}")
def update_resignation(resignation_id: str, body: ResignationUpdate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "staff:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    res = _resignations()
    for i, r in enumerate(res):
        if str(r.get("id")) == str(resignation_id):
            res[i]["status"] = body.status
            res[i]["remarks"] = body.remarks or ""
            res[i]["approved_by"] = current.get("sub", "")
            _write_resignations(res)
            return res[i]
    raise HTTPException(status_code=404, detail="Resignation not found")
