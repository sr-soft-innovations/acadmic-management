"""G.P. College of Pharmacy - REST API (FastAPI + JSON storage)."""
import logging
from collections import defaultdict
from datetime import date, timedelta

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import CORS_ORIGINS_LIST, SECURITY_HEADERS
from app.db import DATA_DIR
from app.db import read_json, read_audit
from app.nav_config import NAV_ITEMS, ROUTE_PERMISSIONS as NAV_ROUTE_PERMISSIONS
from app.permissions import has_permission
from app.routers import admission, auth, backup, students, staff, courses, attendance, audit, fees, exams, approvals, roles, parent_portal, student_portal, semesters, subject_faculty, timetable, results, bulk_upload, departments
from app.routers.auth import _get_current_user

FULL_OVERVIEW_ROLES = {"super_admin", "admin", "principal"}
HOD_ROLE = "hod"
STUDENT_ROLE = "student"


def _get_dashboard_scope(current: dict) -> tuple[str | None, str | None]:
    """Return (department, student_id) for role-based filtering. HOD gets department, student gets linked_student_id."""
    role = (current.get("role") or "").strip().lower()
    if role != HOD_ROLE and role != STUDENT_ROLE:
        return None, None
    users = read_json("users")
    user = next((u for u in users if str(u.get("id")) == str(current.get("sub"))), None)
    if not user:
        return None, None
    dept = (user.get("department") or "").strip() or None if role == HOD_ROLE else None
    sid = (user.get("linked_student_id") or "").strip() or None if role == STUDENT_ROLE else None
    return dept, sid


app = FastAPI(
    title="G.P. College of Pharmacy API",
    description="REST API for college management with JSON file storage.",
    version="1.0.0",
)

# CORS configuration: Use regex to allow dynamic cloudworkstations subdomains with credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.cloudworkstations\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


class CloudWorkstationCORSMiddleware(BaseHTTPMiddleware):
    """
    Force response headers to match request origin for Cloud Workstations environment.
    This bypasses strict CORS/Auth proxy issues by echoing the Origin header.
    """
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            response = Response()
            origin = request.headers.get("Origin")
            if origin:
                response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            return response

        response = await call_next(request)
        origin = request.headers.get("Origin")
        if origin:
            # Overwrite or set the CORS header to exactly match the requesting origin
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response


app.add_middleware(CloudWorkstationCORSMiddleware)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses (Temporarily restricted for Cloud Workstations CORS debugging)."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # Filter out headers that might interfere with preflight/cross-origin requests in dev
        restricted = {"Referrer-Policy", "X-Frame-Options"}
        for k, v in SECURITY_HEADERS.items():
            if k not in restricted:
                response.headers[k] = v
        return response


app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions; return consistent error shape; log stack trace."""
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    logging.getLogger("app").exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred.", "code": "INTERNAL_ERROR"},
    )


app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(students.router, prefix="/api/students", tags=["Students"])
app.include_router(admission.router, prefix="/api/admission", tags=["Admission"])
app.include_router(staff.router, prefix="/api/staff", tags=["Staff"])
app.include_router(courses.router, prefix="/api/courses", tags=["Courses"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(fees.router, prefix="/api/fees", tags=["Fees"])
app.include_router(exams.router, prefix="/api/exams", tags=["Exams"])
app.include_router(approvals.router, prefix="/api/approvals", tags=["Approvals"])
app.include_router(roles.router, prefix="/api/roles", tags=["Roles"])
app.include_router(parent_portal.router, prefix="/api/parent", tags=["Parent Portal"])
app.include_router(student_portal.router, prefix="/api/student", tags=["Student Portal"])
app.include_router(semesters.router, prefix="/api/semesters", tags=["Semesters"])
app.include_router(subject_faculty.router, prefix="/api/subject-faculty", tags=["Subject-Faculty"])
app.include_router(timetable.router, prefix="/api/timetable", tags=["Timetable"])
app.include_router(results.router, prefix="/api/results", tags=["Results & Analytics"])
app.include_router(bulk_upload.router, prefix="/api/bulk-upload", tags=["Bulk Upload"])
app.include_router(departments.router, prefix="/api/departments", tags=["Departments"])
app.include_router(backup.router, prefix="/api/settings/backup", tags=["Backup"])


@app.on_event("startup")
def startup():
    logging.getLogger("app").info("G.P. College of Pharmacy API starting")
    from app.routers.roles import _ensure_roles
    _ensure_roles()


@app.get("/api/health")
def health():
    """Health check: status + data directory writability."""
    data_ok = True
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        test_file = DATA_DIR / ".health_check"
        test_file.write_text("ok")
        test_file.unlink()
    except OSError:
        data_ok = False
    status = "ok" if data_ok else "degraded"
    return {"status": status, "data_writable": data_ok}


@app.get("/api/nav")
def get_nav(current: dict = Depends(_get_current_user)):
    """Dynamic navigation and route permissions. Server filters menu items by user permission."""
    role = current.get("role")
    items = [i for i in NAV_ITEMS if has_permission(role, i.get("permission") or "")]
    return {
        "items": items,
        "route_permissions": NAV_ROUTE_PERMISSIONS,
    }


@app.get("/api/dashboard/stats")
def dashboard_stats(current: dict = Depends(_get_current_user)):
    dept, _ = _get_dashboard_scope(current)
    staff_list = read_json("staff")
    if dept:
        staff_list = [s for s in staff_list if ((s.get("department") or "").strip() or "Other") == dept]
    courses_list = read_json("courses")
    if dept:
        courses_list = [c for c in courses_list if ((c.get("department") or "").strip() or "Other") == dept]
    departments = len({(s.get("department") or "").strip() or "Other" for s in staff_list})
    return {
        "students": len(read_json("students")),
        "staff": len(staff_list),
        "departments": departments,
        "courses": len(courses_list),
        "attendance": len(read_json("attendance")),
        "fee_collections": len(read_json("fee_collections")),
        "exams": len(read_json("exams")),
        "pending_approvals": len([a for a in read_json("approvals") if (a.get("status") or "").lower() == "pending"]),
    }


@app.get("/api/dashboard/notifications")
def dashboard_notifications(current: dict = Depends(_get_current_user)):
    """Notifications & alerts: pending approvals + upcoming exams. unread_count = total of these."""
    approvals = read_json("approvals")
    pending = [a for a in approvals if (a.get("status") or "").lower() == "pending"]
    exams = read_json("exams")
    today = date.today().isoformat()
    upcoming = [e for e in exams if (e.get("exam_date") or "") >= today][:10]
    items = []
    for a in pending[:15]:
        items.append({"id": f"approval-{a.get('id')}", "type": "approval", "title": a.get("type", "Approval"), "message": a.get("reason", ""), "created_at": a.get("created_at")})
    for e in upcoming[:10]:
        items.append({"id": f"exam-{e.get('id')}", "type": "exam", "title": e.get("title", "Exam"), "message": e.get("exam_date", ""), "created_at": e.get("created_at")})
    items.sort(key=lambda x: (x.get("created_at") or ""), reverse=True)
    return {"unread_count": len(pending) + len(upcoming), "items": items[:20]}


@app.get("/api/dashboard/calendar")
def dashboard_calendar(current: dict = Depends(_get_current_user)):
    """Academic calendar events (from calendar.json if present)."""
    events = read_json("calendar")
    if not isinstance(events, list):
        events = []
    return {"events": events}


@app.get("/api/dashboard/upcoming-inspections")
def upcoming_inspections(current: dict = Depends(_get_current_user)):
    """Upcoming inspections (NAAC, PCI, etc.) for Principal dashboard."""
    inspections = read_json("inspections")
    today_str = date.today().isoformat()
    upcoming = [i for i in inspections if (i.get("date") or "") >= today_str]
    upcoming.sort(key=lambda x: x.get("date") or "")
    return {"inspections": upcoming[:10]}


@app.get("/api/dashboard/super-admin-summary")
def super_admin_summary(current: dict = Depends(_get_current_user)):
    """Super Admin only: active users, server status, revenue today, security alerts."""
    if not has_permission(current.get("role"), "role_management:write"):
        raise HTTPException(status_code=403, detail="Super Admin only.")
    sessions = read_json("sessions")
    active_user_ids = {str(s.get("user_id")) for s in sessions if s.get("user_id")}
    fee_colls = read_json("fee_collections")
    today_str = date.today().isoformat()
    revenue_today = sum(
        float(f.get("amount") or 0)
        for f in fee_colls
        if (f.get("paid_at") or f.get("created_at") or "")[:10] == today_str
    )
    audit_entries = read_audit(100)
    security_alerts = [
        e for e in audit_entries
        if (e.get("action") or e.get("type") or "").lower() in ("login_failed", "account_locked", "password_expired", "otp_failed")
    ][:10]
    return {
        "active_users": len(active_user_ids),
        "server_status": "ok",
        "revenue_today": round(revenue_today, 2),
        "security_alerts": security_alerts,
        "security_alert_count": len(security_alerts),
    }


@app.get("/api/dashboard/daily-overview")
def dashboard_daily_overview(date_str: str | None = None, current: dict = Depends(_get_current_user)):
    """Daily attendance overview for admin: total students, present count, by course."""
    target = (date_str or "").strip()[:10] if (date_str or "").strip() else date.today().isoformat()
    students = read_json("students")
    attendance = read_json("attendance")
    day_records = [a for a in attendance if (a.get("date") or "")[:10] == target]
    present_ids = {str(a.get("student_id")) for a in day_records}
    by_course = defaultdict(lambda: {"total": 0, "present": 0})
    for s in students:
        course = (s.get("course") or "").strip() or "Not specified"
        by_course[course]["total"] += 1
        if str(s.get("id")) in present_ids:
            by_course[course]["present"] += 1
    return {
        "date": target,
        "total_students": len(students),
        "present": len(present_ids),
        "by_course": [{"course": k, "total": v["total"], "present": v["present"]} for k, v in sorted(by_course.items())],
    }


@app.get("/api/dashboard/student-strength")
def student_strength_summary(current: dict = Depends(_get_current_user)):
    """Student strength summary: total and breakdown by course, semester, and gender."""
    students = read_json("students")
    by_course = defaultdict(int)
    by_semester = defaultdict(int)
    by_gender = defaultdict(int)
    by_course_semester = defaultdict(int)
    for s in students:
        course = (s.get("course") or "").strip() or "Not specified"
        semester = (s.get("semester") or "").strip() or "Not specified"
        gender = (s.get("gender") or "").strip() or "Not specified"
        by_course[course] += 1
        by_semester[semester] += 1
        by_gender[gender] += 1
        by_course_semester[f"{course}|{semester}"] += 1
    course_semester_list = [
        {"course": k.split("|")[0], "semester": k.split("|")[1], "count": v}
        for k, v in sorted(by_course_semester.items(), key=lambda x: (-x[1], x[0]))
    ]
    return {
        "total": len(students),
        "by_course": dict(sorted(by_course.items(), key=lambda x: (-x[1], x[0]))),
        "by_semester": dict(sorted(by_semester.items(), key=lambda x: (-x[1], x[0]))),
        "by_gender": dict(sorted(by_gender.items(), key=lambda x: (-x[1], x[0]))),
        "by_course_semester": course_semester_list,
    }


@app.get("/api/dashboard/staff-summary")
def staff_summary(current: dict = Depends(_get_current_user)):
    """Staff summary: total, by department, by designation. HOD sees only their department."""
    dept, _ = _get_dashboard_scope(current)
    staff_list = read_json("staff")
    if dept:
        staff_list = [s for s in staff_list if ((s.get("department") or "").strip() or "Other") == dept]
    by_department = defaultdict(int)
    by_designation = defaultdict(int)
    for s in staff_list:
        d = (s.get("department") or "").strip() or "Other"
        desig = (s.get("designation") or "").strip() or "Other"
        by_department[d] += 1
        by_designation[desig] += 1
    return {
        "total": len(staff_list),
        "by_department": dict(sorted(by_department.items(), key=lambda x: (-x[1], x[0]))),
        "by_designation": dict(sorted(by_designation.items(), key=lambda x: (-x[1], x[0]))),
    }


@app.get("/api/dashboard/department-comparison")
def department_comparison(current: dict = Depends(_get_current_user)):
    """Department/course comparison: students, staff, fees by department and by course. HOD sees only their department."""
    dept, _ = _get_dashboard_scope(current)
    students = read_json("students")
    staff_list = read_json("staff")
    courses_list = read_json("courses")
    fees_list = read_json("fee_collections")
    if dept:
        staff_list = [s for s in staff_list if ((s.get("department") or "").strip() or "Other") == dept]
        courses_list = [c for c in courses_list if ((c.get("department") or "").strip() or "Other") == dept]

    by_course = defaultdict(lambda: {"students": 0, "fees": 0.0})
    for s in students:
        course = (s.get("course") or "").strip() or "Not specified"
        by_course[course]["students"] += 1
    for f in fees_list:
        course = (f.get("course") or "").strip() or "Not specified"
        by_course[course]["fees"] += float(f.get("amount") or 0)

    by_department = defaultdict(lambda: {"staff": 0, "courses": 0})
    for s in staff_list:
        d = (s.get("department") or "").strip() or "Other"
        by_department[d]["staff"] += 1
    for c in courses_list:
        d = (c.get("department") or "").strip() or "Other"
        by_department[d]["courses"] += 1

    return {
        "by_course": {k: dict(v) for k, v in sorted(by_course.items())},
        "by_department": {k: dict(v) for k, v in sorted(by_department.items())},
    }


@app.get("/api/dashboard/attendance-trend")
def attendance_trend(days: int = 7, current: dict = Depends(_get_current_user)):
    """Attendance trend for the last N days."""
    students = read_json("students")
    attendance = read_json("attendance")
    total = len(students)
    today = date.today()
    trend = []
    for i in range(max(1, min(days, 90)) - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        present = len({str(a.get("student_id")) for a in attendance if (a.get("date") or "")[:10] == d})
        pct = round((present / total) * 100) if total > 0 else 0
        trend.append({"date": d, "present": present, "absent": total - present, "total": total, "pct": pct})
    return {"days": len(trend), "total_students": total, "trend": trend}


@app.get("/api/dashboard/admission-stats")
def admission_stats(current: dict = Depends(_get_current_user)):
    """Admission statistics: by year, by course, by status."""
    apps = read_json("admission_applications")
    by_year = defaultdict(int)
    by_course = defaultdict(int)
    by_status = defaultdict(int)
    for a in apps:
        year = (a.get("academic_year") or a.get("created_at", "")[:4] or "Unknown").strip()
        course = (a.get("course") or "").strip() or "Not specified"
        status = (a.get("status") or "pending").strip().lower()
        by_year[year] += 1
        by_course[course] += 1
        by_status[status] += 1
    return {
        "total": len(apps),
        "by_year": dict(sorted(by_year.items())),
        "by_course": dict(sorted(by_course.items(), key=lambda x: (-x[1], x[0]))),
        "by_status": dict(sorted(by_status.items(), key=lambda x: (-x[1], x[0]))),
    }


@app.get("/api/dashboard/today-summary")
def today_summary(current: dict = Depends(_get_current_user)):
    """Today's quick summary: classes count, leave requests, fee due alerts, low attendance alerts."""
    today_str = date.today().isoformat()
    dow = date.today().weekday()
    tt_day = dow + 1 if dow < 6 else 6

    timetable = read_json("timetable")
    today_classes = len([t for t in timetable if t.get("day_of_week") == tt_day])

    leave_reqs = read_json("staff_leave_requests") if read_json("staff_leave_requests") else []
    if not leave_reqs:
        leave_reqs = []
        for s in read_json("staff"):
            sid = s.get("id")
            if sid:
                lr = [l for l in read_json("staff") if False]
                leave_reqs.extend(lr)
    pending_leaves = len([l for l in leave_reqs if (l.get("status") or "").lower() == "pending"])

    students = read_json("students")
    attendance = read_json("attendance")
    total_students = len(students)
    today_present = len({str(a.get("student_id")) for a in attendance if (a.get("date") or "")[:10] == today_str})
    avg_attend_pct = round((today_present / total_students) * 100) if total_students > 0 else 0

    fee_colls = read_json("fee_collections")
    students_who_paid = {str(f.get("student_id")) for f in fee_colls}
    fee_pending_count = total_students - len(students_who_paid & {str(s.get("id")) for s in students})
    fee_collected_pct = round((len(students_who_paid) / total_students) * 100) if total_students > 0 else 0

    low_attend_threshold = 75
    attend_by_student = defaultdict(lambda: {"total": 0, "present": 0})
    for a in attendance:
        sid = str(a.get("student_id"))
        attend_by_student[sid]["total"] += 1
        attend_by_student[sid]["present"] += 1
    low_attend_students = []
    for s in students:
        sid = str(s.get("id"))
        rec = attend_by_student.get(sid)
        if rec and rec["total"] > 0:
            pct = round((rec["present"] / rec["total"]) * 100)
            if pct < low_attend_threshold:
                low_attend_students.append({"id": sid, "name": s.get("name"), "roll_no": s.get("roll_no"), "course": s.get("course"), "pct": pct})

    return {
        "today_classes": today_classes,
        "pending_leaves": pending_leaves,
        "avg_attendance_pct": avg_attend_pct,
        "fee_collected_pct": fee_collected_pct,
        "fee_pending_count": fee_pending_count,
        "low_attendance_alerts": sorted(low_attend_students, key=lambda x: x["pct"])[:10],
        "fee_due_alerts_count": fee_pending_count,
    }


@app.get("/api/dashboard/recent-activity")
def dashboard_recent_activity(limit: int = 20, current: dict = Depends(_get_current_user)):
    """Recent audit/activity entries for dashboard widget."""
    entries = read_audit(limit=max(1, min(limit, 100)))
    return {"items": entries}


@app.get("/api/dashboard/student-personal")
def student_personal_stats(current: dict = Depends(_get_current_user)):
    """Student-specific stats: attendance %, fee status, upcoming exams, internal marks, fee due, assignment alerts, notices."""
    _, student_id = _get_dashboard_scope(current)
    if not student_id:
        return _empty_student_personal()
    students = read_json("students")
    student = next((s for s in students if str(s.get("id")) == student_id), None)
    if not student:
        return _empty_student_personal()
    course = (student.get("course") or "").strip()
    semester = str(student.get("semester") or "")
    today = date.today().isoformat()

    # Attendance
    attendance = read_json("attendance")
    my_records = [a for a in attendance if str(a.get("student_id")) == student_id]
    total_days = len(my_records)
    present_days = len([a for a in my_records if (a.get("status") or "").lower() == "present"])
    attendance_pct = round((present_days / total_days) * 100) if total_days > 0 else None

    # Fees
    fee_colls = read_json("fee_collections")
    my_fees = [f for f in fee_colls if str(f.get("student_id")) == student_id]
    total_paid = sum(float(f.get("amount") or 0) for f in my_fees)
    fee_struct = read_json("fee_structure")
    expected = 0
    for s in fee_struct:
        if (s.get("course") or "").strip() == course and str(s.get("semester") or "") == semester:
            expected = float(s.get("total") or (s.get("tuition_fee") or 0) + (s.get("exam_fee") or 0) + (s.get("lab_fee") or 0))
            break
    fee_due = max(0, round(expected - total_paid, 2))

    # Internal marks
    marks_list = read_json("marks")
    my_marks = [m for m in marks_list if str(m.get("student_id")) == student_id and (m.get("exam_type") or "").lower() == "internal"]
    internal_marks = my_marks[:10]

    # Upcoming exams
    exams = read_json("exams")
    upcoming = [e for e in exams if (e.get("exam_date") or "") >= today][:10]

    # Assignment due alerts (due within 14 days, not yet submitted)
    assignments = read_json("assignments")
    cutoff = (date.today() + timedelta(days=14)).isoformat()
    subs = read_json("assignment_submissions")
    my_subs = {str(s.get("assignment_id")) for s in subs if str(s.get("student_id")) == student_id}
    assignment_due_alerts = [
        a for a in assignments
        if (a.get("course") or "").strip() == course and str(a.get("semester") or "") == semester
        and (a.get("due_date") or "") <= cutoff and (a.get("due_date") or "") >= today
        and str(a.get("id")) not in my_subs
    ][:5]

    # Notices (student-targeted)
    notices_list = read_json("notices")
    notices = [
        n for n in notices_list
        if "student" in [r.lower() for r in (n.get("target_roles") or [])]
        and (not n.get("expiry_date") or n.get("expiry_date") >= today)
    ][:10]

    return {
        "attendance_pct": attendance_pct,
        "fee_paid": len(my_fees),
        "total_paid": round(total_paid, 2),
        "fee_due": fee_due,
        "upcoming_exams": upcoming,
        "internal_marks": internal_marks,
        "assignment_due_alerts": assignment_due_alerts,
        "notices": notices,
        "student": {
            "id": student.get("id"),
            "name": student.get("name"),
            "roll_no": student.get("roll_no"),
            "course": course,
            "semester": semester,
        },
    }


def _empty_student_personal():
    return {
        "attendance_pct": None,
        "fee_paid": 0,
        "total_paid": 0,
        "fee_due": 0,
        "upcoming_exams": [],
        "internal_marks": [],
        "assignment_due_alerts": [],
        "notices": [],
        "student": None,
    }


@app.get("/api/dashboard/parent-personal")
def parent_personal_stats(current: dict = Depends(_get_current_user)):
    """Parent-specific stats: per-child attendance %, marks, fee status, notices, upcoming exams."""
    if (current.get("role") or "").lower() != "parent":
        return {"children": []}
    users = read_json("users")
    user = next((u for u in users if str(u.get("id")) == str(current.get("sub"))), None)
    if not user:
        return {"children": []}
    linked_ids = user.get("linked_student_ids")
    if not isinstance(linked_ids, list):
        linked_ids = [user.get("linked_student_id")] if user.get("linked_student_id") else []
    linked_ids = [str(s) for s in linked_ids if s is not None and str(s).strip()]
    if not linked_ids:
        return {"children": []}
    students = read_json("students")
    today = date.today().isoformat()
    attendance = read_json("attendance")
    marks_list = read_json("marks")
    fee_colls = read_json("fee_collections")
    fee_struct = read_json("fee_structure")
    exams = read_json("exams")
    notices_list = read_json("notices")
    notices = [
        n for n in notices_list
        if "parent" in [str(r).lower() for r in (n.get("target_roles") or [])]
        and (not n.get("expiry_date") or n.get("expiry_date") >= today)
    ][:10]
    upcoming = [e for e in exams if (e.get("exam_date") or "") >= today][:10]
    children = []
    for student in students:
        sid = str(student.get("id"))
        if sid not in linked_ids:
            continue
        course = (student.get("course") or "").strip()
        semester = str(student.get("semester") or "")
        my_records = [a for a in attendance if str(a.get("student_id")) == sid]
        total_days = len(my_records)
        present_days = len([a for a in my_records if (a.get("status") or "").lower() == "present"])
        attendance_pct = round((present_days / total_days) * 100) if total_days > 0 else None
        my_marks = [m for m in marks_list if str(m.get("student_id")) == sid][:5]
        my_fees = [f for f in fee_colls if str(f.get("student_id")) == sid]
        total_paid = sum(float(f.get("amount") or 0) for f in my_fees)
        expected = 0
        for s in fee_struct:
            if (s.get("course") or "").strip() == course and str(s.get("semester") or "") == semester:
                expected = float(s.get("total") or (s.get("tuition_fee") or 0) + (s.get("exam_fee") or 0) + (s.get("lab_fee") or 0))
                break
        fee_due = max(0, round(expected - total_paid, 2))
        children.append({
            "student": {"id": student.get("id"), "name": student.get("name"), "roll_no": student.get("roll_no"), "course": course, "semester": semester},
            "attendance_pct": attendance_pct,
            "marks": my_marks,
            "total_paid": round(total_paid, 2),
            "fee_due": fee_due,
            "payment_count": len(my_fees),
        })
    return {"children": children, "notices": notices, "upcoming_exams": upcoming}


def _get_hod_department(current: dict) -> str | None:
    """Return department for HOD role or None."""
    if (current.get("role") or "").lower() != "hod":
        return None
    users = read_json("users")
    user = next((u for u in users if str(u.get("id")) == str(current.get("sub"))), None)
    if not user:
        return None
    dept = (user.get("department") or "").strip()
    return dept if dept else None


@app.get("/api/dashboard/hod-personal")
def hod_personal_stats(current: dict = Depends(_get_current_user)):
    """HOD-specific stats: department student strength, attendance %, pass %, pending approvals, faculty workload."""
    dept = _get_hod_department(current)
    if not dept:
        return {"department": None, "student_strength": 0, "attendance_pct": None, "pass_pct": None, "pending_approvals": [], "pending_count": 0, "faculty_workload": []}
    students = read_json("students")
    staff_list = read_json("staff")
    courses = read_json("courses")
    attendance = read_json("attendance")
    marks_list = read_json("marks")
    approvals_list = read_json("approvals")
    subj_fac = read_json("subject_faculty")
    timetable = read_json("timetable")

    # Department students: students who have marks in subjects belonging to this department
    def _subject_dept(subj: str) -> str | None:
        subj = (subj or "").strip()
        for c in courses:
            cdept = (c.get("department") or "").strip()
            cname = (c.get("name") or "").strip()
            if subj and (subj in cname or cdept == subj):
                return cdept
        return None
    dept_student_ids = {
        str(m.get("student_id")) for m in marks_list
        if _subject_dept(m.get("subject")) == dept
    }
    if not dept_student_ids:
        dept_student_ids = {str(s.get("id")) for s in students}  # fallback: all students for demo
    student_strength = len(dept_student_ids)

    # Department attendance %
    dept_att = [a for a in attendance if str(a.get("student_id")) in dept_student_ids]
    total_days = len(dept_att)
    present_days = len([a for a in dept_att if (a.get("status") or "").lower() == "present"])
    attendance_pct = round((present_days / total_days) * 100) if total_days > 0 else None

    # Department pass % (simplified: from marks, pass if >= 40)
    dept_marks = [m for m in marks_list if str(m.get("student_id")) in dept_student_ids]
    total_marks = len(dept_marks)
    passed = len([m for m in dept_marks if float(m.get("marks") or 0) >= 40])
    pass_pct = round((passed / total_marks) * 100) if total_marks > 0 else None

    # Pending approvals (department-relevant)
    pending = [a for a in approvals_list if (a.get("status") or "").lower() == "pending"][:15]

    # Faculty workload (staff in department, count slots per staff)
    dept_staff = [s for s in staff_list if ((s.get("department") or "").strip() or "Other") == dept]
    dept_staff_ids = {str(s.get("id")) for s in dept_staff}
    workload = []
    for s in dept_staff:
        slot_count = len([t for t in timetable if str(t.get("staff_id")) == str(s.get("id"))])
        subj_count = len([sf for sf in subj_fac if str(sf.get("staff_id")) == str(s.get("id"))])
        workload.append({"staff_id": s.get("id"), "name": s.get("name"), "slots": slot_count, "subjects": subj_count})
    workload.sort(key=lambda x: x["slots"] + x["subjects"], reverse=True)

    return {
        "department": dept,
        "student_strength": student_strength,
        "attendance_pct": attendance_pct,
        "pass_pct": pass_pct,
        "pending_approvals": pending,
        "pending_count": len(pending),
        "faculty_workload": workload,
    }


def _get_staff_id_for_faculty(current: dict) -> str | None:
    """Return staff_id for faculty/staff role from linked_staff_id or None."""
    role = (current.get("role") or "").lower()
    if role not in ("faculty", "staff", "hod", "principal"):
        return None
    users = read_json("users")
    user = next((u for u in users if str(u.get("id")) == str(current.get("sub"))), None)
    if not user:
        return None
    sid = user.get("linked_staff_id")
    return str(sid) if sid else None


@app.get("/api/dashboard/staff-personal")
def staff_personal_stats(current: dict = Depends(_get_current_user)):
    """Staff/Faculty-specific stats: assigned subjects, today timetable, attendance pending, assignment pending, student performance."""
    staff_id = _get_staff_id_for_faculty(current)
    if not staff_id:
        return {"assigned_subjects": [], "today_slots": [], "attendance_pending": 0, "assignment_pending": 0, "student_performance": []}
    today = date.today().isoformat()
    dow = date.today().weekday() + 1  # 1=Mon, 7=Sun; Python 0=Mon so +1
    if dow == 7:
        dow = 6  # treat Sunday as Saturday for timetable

    # Assigned subjects (from subject_faculty)
    subj_fac = read_json("subject_faculty")
    courses = read_json("courses")
    assigned = []
    for sf in subj_fac:
        if str(sf.get("staff_id")) == str(staff_id):
            sub = next((c for c in courses if str(c.get("id")) == str(sf.get("subject_id"))), {})
            assigned.append({"id": sub.get("id"), "name": sub.get("name"), "code": sub.get("code")})

    # Today's timetable
    timetable = read_json("timetable")
    today_slots = [s for s in timetable if s.get("day_of_week") == dow and str(s.get("staff_id")) == str(staff_id)]
    for s in today_slots:
        sub = next((c for c in courses if str(c.get("id")) == str(s.get("subject_id"))), {})
        s["subject_name"] = sub.get("name")
    today_slots.sort(key=lambda x: x.get("slot_start") or "")

    # Attendance pending: dates with no attendance for this staff's subjects (simplified: count students in their slots today)
    attendance = read_json("attendance")
    students = read_json("students")
    # Subjects taught by this staff
    my_subject_ids = {str(sf.get("subject_id")) for sf in subj_fac if str(sf.get("staff_id")) == str(staff_id)}
    # For today: students in B.Pharm Sem 1,2 (from timetable) - count who have no attendance today
    att_today = [a for a in attendance if (a.get("date") or "")[:10] == today[:10]]
    att_student_ids = {str(a.get("student_id")) for a in att_today}
    # Students in programs/semesters from today's slots
    slot_prog_sem = {(s.get("program"), str(s.get("semester"))) for s in today_slots}
    students_pending = sum(1 for st in students if (st.get("course"), str(st.get("semester"))) in slot_prog_sem and str(st.get("id")) not in att_student_ids)
    attendance_pending = max(0, students_pending)

    # Assignment pending evaluation: assignments for staff's subjects with submissions not yet graded
    assignments = read_json("assignments")
    subs = read_json("assignment_submissions")
    # Assignments for staff's subjects (match by subject name in assignment)
    assignment_pending = 0
    for a in assignments:
        sub_name = (a.get("subject") or "").strip()
        if not sub_name:
            continue
        sub_match = next((c for c in courses if (c.get("name") or "").strip() == sub_name), None)
        if sub_match and str(sub_match.get("id")) in my_subject_ids:
            sub_count = len([s for s in subs if str(s.get("assignment_id")) == str(a.get("id"))])
            if sub_count > 0:
                assignment_pending += sub_count  # simplified: count submissions

    # Student performance summary (avg marks by subject for staff's subjects)
    marks_list = read_json("marks")
    assigned_names = {(s.get("name") or "").strip() for s in assigned}
    perf = []
    for subj in assigned[:5]:
        name = (subj.get("name") or "").strip()
        sub_marks = [m for m in marks_list if (m.get("subject") or "").strip() == name]
        if sub_marks:
            avg = sum(float(m.get("marks") or 0) for m in sub_marks) / len(sub_marks)
            perf.append({"subject": name, "avg_marks": round(avg, 1), "count": len(sub_marks)})

    return {
        "assigned_subjects": assigned,
        "today_slots": today_slots,
        "attendance_pending": attendance_pending,
        "assignment_pending": assignment_pending,
        "student_performance": perf,
    }


@app.get("/api/reports/summary")
def reports_summary(current: dict = Depends(_get_current_user)):
    """High-level report summary: counts, fee totals, exam summary for reports and dashboard."""
    students = read_json("students")
    staff_list = read_json("staff")
    courses_list = read_json("courses")
    fee_coll = read_json("fee_collections")
    exams_list = read_json("exams")
    approvals_list = read_json("approvals")
    today = date.today().isoformat()

    total_fees = sum(float(f.get("amount") or 0) for f in fee_coll)
    upcoming_exams = [e for e in exams_list if (e.get("exam_date") or "") >= today]
    pending_approvals = [a for a in approvals_list if (a.get("status") or "").lower() == "pending"]

    return {
        "students": len(students),
        "staff": len(staff_list),
        "courses": len(courses_list),
        "fee_collections_count": len(fee_coll),
        "fee_total_collected": round(total_fees, 2),
        "exams_total": len(exams_list),
        "exams_upcoming_count": len(upcoming_exams),
        "pending_approvals_count": len(pending_approvals),
        "attendance_records": len(read_json("attendance")),
    }