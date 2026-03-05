"""Students REST: profile, academic, guardian, photo upload, certificates, promotion, alumni."""
import io
import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.permissions import has_permission
from app.routers.auth import _get_current_user

router = APIRouter()

# Store uploaded photos under data/student_photos (relative to app)
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "data" / "student_photos"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# --- Schemas ---
class GuardianSchema(BaseModel):
    name: str = ""
    relation: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    occupation: str = ""


class AcademicSchema(BaseModel):
    admission_date: str = ""
    academic_year: str = ""
    previous_school: str = ""
    board: str = ""
    marks_obtained: str = ""


class StudentCreate(BaseModel):
    name: str
    roll_no: str = ""
    course: str = ""
    semester: str = ""
    email: str = ""
    phone: str = ""
    date_of_birth: str = ""
    gender: str = ""
    blood_group: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    admission_date: str = ""
    academic_year: str = ""
    previous_school: str = ""
    board: str = ""
    guardian_name: str = ""
    guardian_relation: str = ""
    guardian_phone: str = ""
    guardian_email: str = ""
    guardian_address: str = ""
    guardian_occupation: str = ""
    category: str = ""  # SC, ST, GEN, OBC
    batch: str = ""
    section: str = ""
    unique_id: str = ""  # optional; if empty, use id
    admission_application_id: str = ""


class StudentUpdate(BaseModel):
    name: str | None = None
    roll_no: str | None = None
    course: str | None = None
    semester: str | None = None
    email: str | None = None
    phone: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    blood_group: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    admission_date: str | None = None
    academic_year: str | None = None
    previous_school: str | None = None
    board: str | None = None
    guardian_name: str | None = None
    guardian_relation: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    guardian_address: str | None = None
    guardian_occupation: str | None = None
    category: str | None = None
    batch: str | None = None
    section: str | None = None
    unique_id: str | None = None
    is_alumni: bool | None = None
    alumni_year: str | None = None


def _student_item(body: StudentCreate, new_id: str) -> dict:
    return {
        "id": new_id,
        "name": body.name,
        "roll_no": body.roll_no,
        "course": body.course,
        "semester": body.semester,
        "email": body.email,
        "phone": body.phone,
        "date_of_birth": getattr(body, "date_of_birth", "") or "",
        "gender": getattr(body, "gender", "") or "",
        "blood_group": getattr(body, "blood_group", "") or "",
        "address": getattr(body, "address", "") or "",
        "city": getattr(body, "city", "") or "",
        "state": getattr(body, "state", "") or "",
        "pincode": getattr(body, "pincode", "") or "",
        "admission_date": getattr(body, "admission_date", "") or "",
        "academic_year": getattr(body, "academic_year", "") or "",
        "previous_school": getattr(body, "previous_school", "") or "",
        "board": getattr(body, "board", "") or "",
        "guardian_name": getattr(body, "guardian_name", "") or "",
        "guardian_relation": getattr(body, "guardian_relation", "") or "",
        "guardian_phone": getattr(body, "guardian_phone", "") or "",
        "guardian_email": getattr(body, "guardian_email", "") or "",
        "guardian_address": getattr(body, "guardian_address", "") or "",
        "guardian_occupation": getattr(body, "guardian_occupation", "") or "",
        "category": getattr(body, "category", "") or "",
        "batch": getattr(body, "batch", "") or "",
        "section": getattr(body, "section", "") or "",
        "unique_id": getattr(body, "unique_id", "") or new_id,
        "admission_application_id": getattr(body, "admission_application_id", "") or "",
        "photo_filename": "",
        "is_alumni": False,
        "alumni_year": "",
    }


@router.get("")
def list_students(current: dict = Depends(_get_current_user), alumni: bool | None = None):
    students = read_json("students")
    if alumni is True:
        return [s for s in students if s.get("is_alumni")]
    if alumni is False:
        return [s for s in students if not s.get("is_alumni")]
    return students


@router.get("/alumni")
def list_alumni(current: dict = Depends(_get_current_user)):
    return [s for s in read_json("students") if s.get("is_alumni")]


@router.get("/{student_id}")
def get_student(student_id: str, current: dict = Depends(_get_current_user)):
    students = read_json("students")
    for s in students:
        if str(s.get("id")) == str(student_id):
            return s
    raise HTTPException(status_code=404, detail="Student not found")


@router.post("")
def create_student(body: StudentCreate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "students:write"):
        raise HTTPException(status_code=403, detail="Admin only: no permission to create students.")
    students = read_json("students")
    new_id = next_id("students")
    item = _student_item(body, new_id)
    students.append(item)
    write_json("students", students)
    return item


@router.put("/{student_id}")
def update_student(student_id: str, body: StudentUpdate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "students:write"):
        raise HTTPException(status_code=403, detail="Admin only: no permission to edit student profile.")
    students = read_json("students")
    for i, s in enumerate(students):
        if str(s.get("id")) == str(student_id):
            data = body.model_dump(exclude_unset=True)
            students[i] = {**s, **data}
            write_json("students", students)
            return students[i]
    raise HTTPException(status_code=404, detail="Student not found")


@router.delete("/{student_id}")
def delete_student(student_id: str, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "students:write"):
        raise HTTPException(status_code=403, detail="Admin only: no permission to delete students.")
    students = read_json("students")
    for i, s in enumerate(students):
        if str(s.get("id")) == str(student_id):
            photo = s.get("photo_filename")
            if photo:
                path = UPLOADS_DIR / photo
                if path.exists():
                    try:
                        path.unlink()
                    except OSError:
                        pass
            students.pop(i)
            write_json("students", students)
            return {"deleted": student_id}
    raise HTTPException(status_code=404, detail="Student not found")


# --- Photo upload ---
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


@router.get("/{student_id}/photo")
def get_photo(student_id: str, current: dict = Depends(_get_current_user)):
    students = read_json("students")
    for s in students:
        if str(s.get("id")) == str(student_id):
            fn = s.get("photo_filename")
            if not fn:
                raise HTTPException(status_code=404, detail="No photo")
            path = UPLOADS_DIR / fn
            if not path.exists():
                raise HTTPException(status_code=404, detail="Photo file not found")
            suffix = path.suffix.lower()
            media = "image/png" if suffix == ".png" else "image/gif" if suffix == ".gif" else "image/webp" if suffix == ".webp" else "image/jpeg"
            return FileResponse(path, media_type=media)
    raise HTTPException(status_code=404, detail="Student not found")


@router.post("/{student_id}/photo")
async def upload_photo(student_id: str, file: UploadFile = File(...), current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "students:write"):
        raise HTTPException(status_code=403, detail="Admin only: no permission to upload student photo.")
    students = read_json("students")
    for i, s in enumerate(students):
        if str(s.get("id")) == str(student_id):
            ext = Path(file.filename or "").suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=400, detail="Invalid file type. Use image (jpg, png, gif, webp).")
            filename = f"student_{student_id}{ext}"
            path = UPLOADS_DIR / filename
            try:
                with path.open("wb") as f:
                    shutil.copyfileobj(file.file, f)
            except OSError as e:
                raise HTTPException(status_code=500, detail="Failed to save file.")
            old = s.get("photo_filename")
            if old and (UPLOADS_DIR / old).exists():
                try:
                    (UPLOADS_DIR / old).unlink()
                except OSError:
                    pass
            students[i]["photo_filename"] = filename
            write_json("students", students)
            return {"photo_filename": filename}
    raise HTTPException(status_code=404, detail="Student not found")


# --- Certificates (transfer & bonafide) ---
def _certificates() -> list:
    return read_json("student_certificates")


def _write_certificates(data: list) -> None:
    write_json("student_certificates", data)


class CertificateIssue(BaseModel):
    student_id: str
    type: str  # "transfer" | "bonafide"
    reference_no: str = ""
    remarks: str = ""


@router.get("/{student_id}/certificates")
def list_student_certificates(student_id: str, current: dict = Depends(_get_current_user)):
    certs = [c for c in _certificates() if str(c.get("student_id")) == str(student_id)]
    return {"certificates": certs}


@router.post("/certificates")
def issue_certificate(body: CertificateIssue, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "students:write"):
        raise HTTPException(status_code=403, detail="Admin only.")
    students = read_json("students")
    if not any(str(s.get("id")) == str(body.student_id) for s in students):
        raise HTTPException(status_code=404, detail="Student not found")
    if body.type not in ("transfer", "bonafide"):
        raise HTTPException(status_code=400, detail="type must be 'transfer' or 'bonafide'")
    from datetime import date
    certs = _certificates()
    new_id = next_id("student_certificates")
    entry = {
        "id": new_id,
        "student_id": body.student_id,
        "type": body.type,
        "reference_no": body.reference_no or "",
        "remarks": body.remarks,
        "issued_date": str(date.today()),
    }
    certs.append(entry)
    _write_certificates(certs)
    return entry


# --- Promotion (year/semester upgrade) ---
class PromoteBody(BaseModel):
    student_ids: list[str]
    target_semester: str
    set_alumni: bool = False
    alumni_year: str = ""


@router.post("/promote")
def promote_students(body: PromoteBody, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "students:write"):
        raise HTTPException(status_code=403, detail="Admin only.")
    from datetime import date
    students = read_json("students")
    ids = set(str(x) for x in body.student_ids)
    alumni_year = body.alumni_year or str(date.today().year)
    promoted = 0
    for s in students:
        if str(s.get("id")) in ids:
            s["semester"] = body.target_semester
            if body.set_alumni:
                s["is_alumni"] = True
                s["alumni_year"] = alumni_year
            promoted += 1
    write_json("students", students)
    return {"promoted": promoted, "target_semester": body.target_semester}


@router.patch("/{student_id}/alumni")
def set_alumni(student_id: str, current: dict = Depends(_get_current_user), is_alumni: bool = True, alumni_year: str = ""):
    if not has_permission(current.get("role"), "students:write"):
        raise HTTPException(status_code=403, detail="Admin only.")
    from datetime import date
    students = read_json("students")
    for s in students:
        if str(s.get("id")) == str(student_id):
            s["is_alumni"] = is_alumni
            s["alumni_year"] = alumni_year or str(date.today().year) if is_alumni else ""
            write_json("students", students)
            return s
    raise HTTPException(status_code=404, detail="Student not found")


# --- TC / Exit process ---
def _tc_requests() -> list:
    return read_json("tc_requests")


def _write_tc_requests(data: list) -> None:
    write_json("tc_requests", data)


class TCRequestCreate(BaseModel):
    reason: str = ""
    remarks: str = ""


@router.get("/{student_id}/tc-requests")
def list_tc_requests(student_id: str, current: dict = Depends(_get_current_user)):
    reqs = [r for r in _tc_requests() if str(r.get("student_id")) == str(student_id)]
    return {"tc_requests": reqs}


@router.post("/{student_id}/tc-request")
def create_tc_request(student_id: str, body: TCRequestCreate, current: dict = Depends(_get_current_user)):
    students = read_json("students")
    if not any(str(s.get("id")) == str(student_id) for s in students):
        raise HTTPException(status_code=404, detail="Student not found")
    reqs = _tc_requests()
    new_id = next_id("tc_requests")
    from datetime import date
    entry = {
        "id": new_id,
        "student_id": student_id,
        "status": "pending",  # pending | approved | issued | rejected
        "reason": body.reason or "",
        "remarks": body.remarks or "",
        "requested_at": str(date.today()),
        "issued_certificate_id": "",
    }
    reqs.append(entry)
    _write_tc_requests(reqs)
    return entry


class TCRequestUpdate(BaseModel):
    status: str  # approved | issued | rejected
    issued_certificate_id: str = ""


@router.patch("/tc-requests/{request_id}")
def update_tc_request(request_id: str, body: TCRequestUpdate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "students:write"):
        raise HTTPException(status_code=403, detail="Admin only.")
    reqs = _tc_requests()
    for i, r in enumerate(reqs):
        if str(r.get("id")) == str(request_id):
            reqs[i]["status"] = body.status
            if body.issued_certificate_id:
                reqs[i]["issued_certificate_id"] = body.issued_certificate_id
            _write_tc_requests(reqs)
            return reqs[i]
    raise HTTPException(status_code=404, detail="TC request not found")
