"""Admission: online applications, document upload/verification, merit list, approval workflow."""
import shutil
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.permissions import has_permission
from app.routers.auth import _get_current_user

router = APIRouter()

DOCS_DIR = Path(__file__).resolve().parent.parent / "data" / "application_documents"
DOCS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXT = {".pdf", ".jpg", ".jpeg", ".png"}

# Course/program options for admission (could be from config or courses)
DEFAULT_COURSES = ["B.Pharm", "D.Pharm", "M.Pharm", "Pharm.D"]
DEFAULT_DEPARTMENTS = ["Pharmaceutics", "Chemistry", "Pharmacology", "Pharmacognosy", "Other"]
CATEGORIES = ["GEN", "OBC", "SC", "ST"]


class ApplicationCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    course: str = ""
    department: str = ""
    marks_obtained: str = ""
    board: str = ""
    previous_school: str = ""
    category: str = "GEN"
    date_of_birth: str = ""
    gender: str = ""
    address: str = ""
    guardian_name: str = ""
    guardian_phone: str = ""
    guardian_email: str = ""
    payment_status: str = "pending"  # pending | paid | failed
    payment_reference: str = ""


class ApplicationUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    course: str | None = None
    department: str | None = None
    marks_obtained: str | None = None
    board: str | None = None
    previous_school: str | None = None
    category: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    address: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    verification_status: str | None = None  # pending | verified | rejected
    status: str | None = None  # draft | submitted | clerk_verified | hod_approved | approved | rejected
    approval_stage: str | None = None  # clerk_pending | clerk_verified | hod_approved
    payment_status: str | None = None  # pending | paid | failed
    payment_reference: str | None = None


def _applications():
    return read_json("admission_applications")


def _write_applications(data: list):
    write_json("admission_applications", data)


def _numeric_marks(s: str) -> float:
    try:
        return float((s or "0").replace(",", ".").strip())
    except ValueError:
        return 0.0


# Course code for admission number: GPPC/YEAR/COURSE/SEQ
COURSE_CODE_MAP = {"B.Pharm": "BPHARM", "D.Pharm": "DPHARM", "M.Pharm": "MPHARM", "Pharm.D": "PHARMD"}


def _next_admission_number(course: str) -> str:
    """Generate next admission number: GPPC/2026/BPHARM/001."""
    year = str(date.today().year)
    code = COURSE_CODE_MAP.get((course or "").strip()) or "GEN"
    apps = _applications()
    prefix = f"GPPC/{year}/{code}/"
    seq = 0
    for a in apps:
        an = (a.get("admission_number") or "").strip()
        if an.startswith(prefix):
            try:
                seq = max(seq, int(an.split("/")[-1] or 0))
            except ValueError:
                pass
    return f"{prefix}{seq + 1:03d}"


@router.get("")
def list_applications(
    current: dict = Depends(_get_current_user),
    status: str | None = None,
    course: str | None = None,
):
    if not has_permission(current.get("role"), "students:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    items = _applications()
    if status:
        items = [a for a in items if (a.get("status") or "").lower() == status.lower()]
    if course:
        items = [a for a in items if (a.get("course") or "").strip() == course.strip()]
    return {"applications": items}


@router.post("")
def create_application(body: ApplicationCreate, current: dict = Depends(_get_current_user)):
    apps = _applications()
    new_id = next_id("admission_applications")
    entry = {
        "id": new_id,
        **body.model_dump(),
        "status": "draft",
        "approval_stage": "",
        "verification_status": "pending",
        "documents": [],
        "admission_number": "",
        "payment_status": getattr(body, "payment_status", None) or "pending",
        "payment_reference": getattr(body, "payment_reference", None) or "",
        "created_at": str(date.today()),
        "verified_at": "",
        "approved_at": "",
        "student_id": "",
        "roll_no": "",
        "merit_rank": None,
    }
    apps.append(entry)
    _write_applications(apps)
    return entry


@router.get("/merit-list")
def merit_list(
    current: dict = Depends(_get_current_user),
    course: str | None = None,
    limit: int = 200,
):
    if not has_permission(current.get("role"), "students:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    items = _applications()
    items = [a for a in items if (a.get("status") or "").lower() in ("submitted", "verified", "clerk_verified", "hod_approved")]
    if course:
        items = [a for a in items if (a.get("course") or "").strip() == course.strip()]
    # Sort: category (SC/ST first for reservation), then marks desc
    cat_order = {"SC": 0, "ST": 1, "OBC": 2, "GEN": 3}
    items.sort(key=lambda a: (cat_order.get((a.get("category") or "GEN").upper(), 4), -_numeric_marks(a.get("marks_obtained") or "")))
    for rank, a in enumerate(items[:limit], 1):
        a["merit_rank"] = rank
    return {"merit_list": items[:limit]}


@router.get("/{application_id}")
def get_application(application_id: str, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "students:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    for a in _applications():
        if str(a.get("id")) == str(application_id):
            return a
    raise HTTPException(status_code=404, detail="Application not found")


def _can_clerk_verify(role: str) -> bool:
    return role in ("staff", "super_admin", "admin", "principal", "hod")


def _can_hod_approve(role: str) -> bool:
    return role in ("hod", "super_admin", "admin", "principal")


def _can_principal_approve(role: str) -> bool:
    return role in ("super_admin", "admin", "principal")


@router.put("/{application_id}")
def update_application(application_id: str, body: ApplicationUpdate, current: dict = Depends(_get_current_user)):
    apps = _applications()
    role = current.get("role") or ""
    for i, a in enumerate(apps):
        if str(a.get("id")) != str(application_id):
            continue
        data = body.model_dump(exclude_unset=True)
        # Status: submitted (student submits) — generate admission_number
        if "status" in data and data["status"] == "submitted" and (a.get("status") or "") == "draft":
            apps[i]["status"] = "submitted"
            apps[i]["approval_stage"] = "clerk_pending"
            if not (apps[i].get("admission_number") or "").strip():
                apps[i]["admission_number"] = _next_admission_number(a.get("course") or "")
        elif "status" in data and has_permission(role, "students:write"):
            if data["status"] == "rejected":
                apps[i]["status"] = "rejected"
                apps[i]["approval_stage"] = ""
            else:
                apps[i]["status"] = data["status"]
        # Approval workflow: clerk_verify, hod_approve
        if "approval_stage" in data:
            stage = (data["approval_stage"] or "").strip()
            curr_stage = (a.get("approval_stage") or "").strip()
            if stage == "clerk_verified" and curr_stage == "clerk_pending" and _can_clerk_verify(role):
                apps[i]["approval_stage"] = "clerk_verified"
                apps[i]["status"] = "clerk_verified"
                apps[i]["verification_status"] = "verified"
                apps[i]["verified_at"] = str(date.today())
            elif stage == "hod_approved" and curr_stage == "clerk_verified" and _can_hod_approve(role):
                apps[i]["approval_stage"] = "hod_approved"
                apps[i]["status"] = "hod_approved"
        if "verification_status" in data and has_permission(role, "students:write"):
            apps[i]["verification_status"] = data["verification_status"]
            if data["verification_status"] == "verified" and not apps[i].get("approval_stage"):
                apps[i]["approval_stage"] = "clerk_verified"
                apps[i]["verified_at"] = str(date.today())
        for k, v in data.items():
            if k not in ("verification_status", "status", "approval_stage") and v is not None:
                apps[i][k] = v
        _write_applications(apps)
        return apps[i]
    raise HTTPException(status_code=404, detail="Application not found")


@router.post("/{application_id}/clerk-verify")
def clerk_verify(application_id: str, current: dict = Depends(_get_current_user)):
    """Clerk verifies documents and application. Moves to clerk_verified."""
    if not _can_clerk_verify(current.get("role") or ""):
        raise HTTPException(status_code=403, detail="Clerk/Staff only.")
    apps = _applications()
    for i, a in enumerate(apps):
        if str(a.get("id")) == str(application_id):
            st = (a.get("status") or "").lower()
            stage = (a.get("approval_stage") or "").strip()
            if stage == "clerk_verified" or stage == "hod_approved":
                raise HTTPException(status_code=400, detail="Already verified by clerk.")
            if st != "submitted" and stage != "clerk_pending":
                raise HTTPException(status_code=400, detail="Application must be submitted first.")
            apps[i]["approval_stage"] = "clerk_verified"
            apps[i]["status"] = "clerk_verified"
            apps[i]["verification_status"] = "verified"
            apps[i]["verified_at"] = str(date.today())
            _write_applications(apps)
            return apps[i]
    raise HTTPException(status_code=404, detail="Application not found")


@router.post("/{application_id}/hod-approve")
def hod_approve(application_id: str, current: dict = Depends(_get_current_user)):
    """HOD approves after clerk verification. Moves to hod_approved."""
    if not _can_hod_approve(current.get("role") or ""):
        raise HTTPException(status_code=403, detail="HOD only.")
    apps = _applications()
    for i, a in enumerate(apps):
        if str(a.get("id")) == str(application_id):
            if (a.get("approval_stage") or "").strip() != "clerk_verified":
                raise HTTPException(status_code=400, detail="Clerk must verify first.")
            apps[i]["approval_stage"] = "hod_approved"
            apps[i]["status"] = "hod_approved"
            _write_applications(apps)
            return apps[i]
    raise HTTPException(status_code=404, detail="Application not found")


@router.post("/{application_id}/documents")
async def upload_document(
    application_id: str,
    doc_type: str,
    file: UploadFile = File(...),
    current: dict = Depends(_get_current_user),
):
    apps = _applications()
    app = next((a for a in apps if str(a.get("id")) == str(application_id)), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Use PDF or image (jpg, png).")
    docs = app.get("documents") or []
    doc_id = str(len(docs) + 1)
    filename = f"app_{application_id}_{doc_type}_{doc_id}{ext}"
    path = DOCS_DIR / filename
    try:
        with path.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except OSError:
        raise HTTPException(status_code=500, detail="Failed to save file.")
    doc_entry = {"id": f"{application_id}_{doc_id}", "type": doc_type, "filename": filename, "verified": False}
    for i, a in enumerate(apps):
        if str(a.get("id")) == str(application_id):
            apps[i].setdefault("documents", []).append(doc_entry)
            _write_applications(apps)
            return doc_entry
    raise HTTPException(status_code=404, detail="Application not found")


class VerifyDocBody(BaseModel):
    verified: bool


@router.patch("/{application_id}/documents/{doc_id}")
def verify_document(
    application_id: str,
    doc_id: str,
    body: VerifyDocBody,
    current: dict = Depends(_get_current_user),
):
    if not has_permission(current.get("role"), "students:write"):
        raise HTTPException(status_code=403, detail="Admin only.")
    apps = _applications()
    for i, a in enumerate(apps):
        if str(a.get("id")) != str(application_id):
            continue
        for j, d in enumerate(a.get("documents") or []):
            if str(d.get("id")) == str(doc_id):
                apps[i]["documents"][j]["verified"] = bool(body.verified)
                _write_applications(apps)
                return apps[i]
    raise HTTPException(status_code=404, detail="Document not found")


@router.get("/{application_id}/documents/{doc_id}/file")
def get_document_file(application_id: str, doc_id: str, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "students:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    for a in _applications():
        if str(a.get("id")) != str(application_id):
            continue
        for d in a.get("documents") or []:
            if str(d.get("id")) == str(doc_id):
                path = DOCS_DIR / d.get("filename", "")
                if path.exists():
                    return FileResponse(path, media_type="application/octet-stream", filename=path.name)
                raise HTTPException(status_code=404, detail="File not found")
    raise HTTPException(status_code=404, detail="Document not found")


class ApproveBody(BaseModel):
    roll_no: str = ""
    batch: str = ""
    section: str = ""
    create_login: bool = True
    semester: str = "1"
    academic_year: str = ""


@router.post("/{application_id}/approve")
def approve_application(application_id: str, body: ApproveBody, current: dict = Depends(_get_current_user)):
    if not _can_principal_approve(current.get("role") or ""):
        raise HTTPException(status_code=403, detail="Principal/Admin only: final approval.")
    apps = _applications()
    app = next((a for a in apps if str(a.get("id")) == str(application_id)), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if (app.get("status") or "").lower() == "approved":
        raise HTTPException(status_code=400, detail="Already approved.")
    stage = (app.get("approval_stage") or "").strip()
    st = (app.get("status") or "").lower()
    # Allow: hod_approved (new flow) or verified (legacy / admin override)
    if stage != "hod_approved" and st not in ("verified", "hod_approved"):
        raise HTTPException(status_code=400, detail="Application must pass Clerk → HOD approval first.")
    students = read_json("students")
    new_id = next_id("students")
    year_suffix = str(date.today().year)[-2:]
    course_short = (app.get("course") or "BP").replace(".", "").replace(" ", "")[:6]
    roll_no = (body.roll_no or "").strip() or f"{course_short}{year_suffix}{new_id.zfill(3)}"
    admission_no = (app.get("admission_number") or "").strip() or _next_admission_number(app.get("course") or "")
    student = {
        "id": new_id,
        "name": app.get("name", ""),
        "roll_no": roll_no,
        "admission_number": admission_no,
        "course": app.get("course", ""),
        "semester": body.semester or "1",
        "email": app.get("email", ""),
        "phone": app.get("phone", ""),
        "date_of_birth": app.get("date_of_birth", ""),
        "gender": app.get("gender", ""),
        "address": app.get("address", ""),
        "admission_date": str(date.today()),
        "academic_year": body.academic_year or str(date.today().year),
        "previous_school": app.get("previous_school", ""),
        "board": app.get("board", ""),
        "guardian_name": app.get("guardian_name", ""),
        "guardian_phone": app.get("guardian_phone", ""),
        "guardian_email": app.get("guardian_email", ""),
        "category": app.get("category", "GEN"),
        "batch": body.batch or "",
        "section": body.section or "",
        "unique_id": new_id,
        "admission_application_id": application_id,
        "photo_filename": "",
        "is_alumni": False,
        "alumni_year": "",
    }
    students.append(student)
    write_json("students", students)
    for i, a in enumerate(apps):
        if str(a.get("id")) == str(application_id):
            apps[i]["status"] = "approved"
            apps[i]["approval_stage"] = "principal_approved"
            apps[i]["approved_at"] = str(date.today())
            apps[i]["student_id"] = new_id
            apps[i]["roll_no"] = roll_no
            _write_applications(apps)
            break
    if body.create_login:
        users = read_json("users")
        username = (roll_no or f"stu{new_id}").lower().replace(" ", "_")
        if any((u.get("username") or "").lower() == username for u in users):
            username = f"stu{new_id}"
        from app.routers.auth import _hash_password
        default_pass = "Student@123"
        users.append({
            "id": next_id("users"),
            "username": username,
            "password": _hash_password(default_pass),
            "role": "student",
            "name": app.get("name", ""),
            "email": app.get("email", ""),
            "phone": app.get("phone", ""),
            "photo_filename": "",
            "is_enabled": True,
            "failed_attempts": 0,
            "locked_until": None,
            "linked_student_id": new_id,
        })
        write_json("users", users)
    return {"student": student, "roll_no": roll_no, "login_created": body.create_login}
