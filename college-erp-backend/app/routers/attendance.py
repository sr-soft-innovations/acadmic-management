"""Attendance: daily, period-wise, subject-wise, biometric, monthly/semester reports, shortage alerts, bulk upload, absent alerts. Staff: GPS/geo, IN/OUT."""
from collections import defaultdict
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()

# Geo-fence config (optional): lat, lng, radius_metres. If set, staff punch can validate.
GEO_FENCE = {"lat": None, "lng": None, "radius_metres": 200}  # override via config/file if needed


class AttendanceCreate(BaseModel):
    student_id: str = ""
    date: str = ""
    status: str = "present"
    subject_id: str = ""
    course_id: str = ""
    source: str = "manual"  # manual | biometric
    period_number: int | None = None  # 1-based period/slot
    slot_type: str = "theory"  # theory | lab


class AttendanceUpdate(BaseModel):
    student_id: str | None = None
    date: str | None = None
    status: str | None = None
    subject_id: str | None = None
    course_id: str | None = None
    period_number: int | None = None
    slot_type: str | None = None
    correction_reason: str | None = None  # audit when status corrected


class BiometricPunch(BaseModel):
    student_id: str
    timestamp: str = ""  # ISO or YYYY-MM-DD HH:MM
    device_id: str = ""


def _subject_id(record: dict) -> str:
    return (record.get("subject_id") or record.get("course_id") or "").strip()


def _get_student(student_id: str) -> dict | None:
    for s in read_json("students"):
        if str(s.get("id")) == str(student_id):
            return s
    return None


@router.get("")
def list_attendance(current: dict = Depends(_get_current_user), date: str | None = None, student_id: str | None = None, subject_id: str | None = None):
    # Students can only view their own attendance
    if (current.get("role") or "").lower() == "student":
        sid = None
        for u in read_json("users"):
            if str(u.get("id")) == str(current.get("sub")):
                sid = u.get("linked_student_id")
                break
        student_id = str(sid) if sid else "__none__"  # __none__ ensures no match
    items = read_json("attendance")
    if date:
        items = [a for a in items if (a.get("date") or "")[:10] == date[:10]]
    if student_id:
        items = [a for a in items if str(a.get("student_id")) == str(student_id)]
    if subject_id:
        items = [a for a in items if _subject_id(a) == str(subject_id)]
    items.sort(key=lambda x: (x.get("date") or "", x.get("student_id") or ""))
    return items


@router.get("/daily")
def daily_attendance(date: str, current: dict = Depends(_get_current_user), program: str | None = None, semester: str | None = None):
    """Get attendance for a single day; optionally filter by program/semester via student list."""
    items = read_json("attendance")
    date_prefix = (date or "")[:10]
    items = [a for a in items if (a.get("date") or "")[:10] == date_prefix]
    students = read_json("students")
    if program or semester:
        student_ids = {str(s.get("id")) for s in students if (not program or (s.get("course") or "").strip() == program) and (not semester or str(s.get("semester")) == str(semester))}
        items = [a for a in items if str(a.get("student_id")) in student_ids]
    students_by_id = {str(s.get("id")): s for s in students}
    out = []
    for a in items:
        s = students_by_id.get(str(a.get("student_id")), {})
        out.append({
            **a,
            "student_name": s.get("name"),
            "roll_no": s.get("roll_no"),
            "course": s.get("course"),
            "semester": s.get("semester"),
        })
    out.sort(key=lambda x: (x.get("roll_no") or "", x.get("student_name") or ""))
    return {"date": date_prefix, "records": out}


@router.get("/subject-wise")
def subject_wise_attendance(subject_id: str, current: dict = Depends(_get_current_user), date_from: str | None = None, date_to: str | None = None):
    """Attendance records for a subject in optional date range."""
    items = read_json("attendance")
    items = [a for a in items if _subject_id(a) == str(subject_id)]
    if date_from:
        items = [a for a in items if (a.get("date") or "") >= date_from[:10]]
    if date_to:
        items = [a for a in items if (a.get("date") or "") <= date_to[:10]]
    items.sort(key=lambda x: (x.get("date") or "", x.get("student_id") or ""))
    students = read_json("students")
    students_by_id = {str(s.get("id")): s for s in students}
    out = []
    for a in items:
        s = students_by_id.get(str(a.get("student_id")), {})
        out.append({**a, "student_name": s.get("name"), "roll_no": s.get("roll_no")})
    subjects = read_json("courses")
    sub = next((x for x in subjects if str(x.get("id")) == str(subject_id)), {})
    return {"subject_id": subject_id, "subject_name": sub.get("name"), "records": out}


@router.post("/biometric")
def biometric_punch(body: BiometricPunch, current: dict = Depends(_get_current_user)):
    """Biometric integration: record punch from device. Marks student present for the date derived from timestamp."""
    if not body.student_id:
        raise HTTPException(status_code=400, detail="student_id required")
    ts = (body.timestamp or "").strip()
    if not ts:
        ts = datetime.utcnow().isoformat()
    if "T" in ts:
        date_str = ts[:10]
    else:
        date_str = ts[:10] if len(ts) >= 10 else datetime.utcnow().strftime("%Y-%m-%d")
    items = read_json("attendance")
    existing = next((a for a in items if str(a.get("student_id")) == str(body.student_id) and (a.get("date") or "")[:10] == date_str), None)
    if existing:
        if existing.get("source") == "biometric":
            return {"message": "Already marked", "record": existing}
        items = [a for a in items if a != existing]
        existing["status"] = "present"
        existing["source"] = "biometric"
        existing["biometric_device_id"] = body.device_id
        existing["biometric_timestamp"] = ts
        items.append(existing)
        write_json("attendance", items)
        return {"message": "Updated", "record": existing}
    new_id = next_id("attendance")
    record = {
        "id": new_id,
        "student_id": body.student_id,
        "date": date_str,
        "status": "present",
        "subject_id": "",
        "course_id": "",
        "source": "biometric",
        "biometric_device_id": body.device_id,
        "biometric_timestamp": ts,
    }
    items.append(record)
    write_json("attendance", items)
    return {"message": "Recorded", "record": record}


def _monthly_report_data(month: str, program: str | None = None, semester: str | None = None):
    """Helper: monthly attendance summary. Used by route and shortage_alerts."""
    year_month = (month or "")[:7]
    if len(year_month) < 7:
        raise HTTPException(status_code=400, detail="month required (YYYY-MM)")
    items = read_json("attendance")
    items = [a for a in items if (a.get("date") or "")[:7] == year_month]
    students = read_json("students")
    if program or semester:
        students = [s for s in students if (not program or (s.get("course") or "").strip() == program) and (not semester or str(s.get("semester")) == str(semester))]
    student_ids = {str(s.get("id")) for s in students}
    items = [a for a in items if str(a.get("student_id")) in student_ids]
    by_student = defaultdict(lambda: {"present": 0, "absent": 0})
    dates_seen = set()
    for a in items:
        sid = str(a.get("student_id"))
        dates_seen.add((a.get("date") or "")[:10])
        if (a.get("status") or "").lower() == "absent":
            by_student[sid]["absent"] += 1
        else:
            by_student[sid]["present"] += 1
    working_days = len(dates_seen) if dates_seen else 1
    report = []
    for s in students:
        sid = str(s.get("id"))
        p = by_student[sid]["present"]
        ab = by_student[sid]["absent"]
        total = p + ab
        pct = round(100 * p / total, 1) if total else 0
        report.append({
            "student_id": sid,
            "student_name": s.get("name"),
            "roll_no": s.get("roll_no"),
            "course": s.get("course"),
            "semester": s.get("semester"),
            "present": p,
            "absent": ab,
            "total_days": total,
            "percentage": pct,
        })
    report.sort(key=lambda x: (x.get("roll_no") or "", x.get("student_name") or ""))
    return {"month": year_month, "working_days": working_days, "students": report}


@router.get("/monthly-report")
def monthly_report(month: str, current: dict = Depends(_get_current_user), program: str | None = None, semester: str | None = None):
    """Monthly attendance summary: by student (total days, present, absent, %). Optional program/semester filter."""
    return _monthly_report_data(month, program, semester)


@router.get("/shortage-alerts")
def shortage_alerts(current: dict = Depends(_get_current_user), month: str | None = None, threshold: float = 75.0, program: str | None = None, semester: str | None = None):
    """Students with attendance percentage below threshold. Default threshold 75%."""
    month_param = (month or "").strip()
    if not month_param:
        month_param = date.today().strftime("%Y-%m")
    data = _monthly_report_data(month_param, program, semester)
    below = [s for s in data.get("students", []) if s.get("percentage", 100) < threshold and (s.get("total_days") or 0) > 0]
    return {"month": month_param, "threshold": threshold, "alerts": below, "count": len(below)}


class BulkAttendanceItem(BaseModel):
    student_id: str
    date: str
    status: str = "present"
    subject_id: str = ""
    period_number: int | None = None
    slot_type: str = "theory"


class BulkAttendanceBody(BaseModel):
    records: list[BulkAttendanceItem]


@router.post("/bulk")
def bulk_upload_attendance(body: BulkAttendanceBody, current: dict = Depends(_get_current_user)):
    """Bulk upload student attendance. Max 500 per request."""
    if len(body.records) > 500:
        raise HTTPException(status_code=400, detail="Max 500 records per bulk upload.")
    items = read_json("attendance")
    students = {str(s.get("id")) for s in read_json("students")}
    created = 0
    for r in body.records:
        if not r.student_id or str(r.student_id) not in students:
            continue
        date_prefix = (r.date or "")[:10]
        if not date_prefix:
            continue
        subject = (r.subject_id or "").strip()
        status = (r.status or "present").strip().lower() or "present"
        slot_type = (r.slot_type or "theory").strip().lower() or "theory"
        new_id = next_id("attendance")
        items.append({
            "id": new_id,
            "student_id": r.student_id,
            "date": date_prefix,
            "status": status,
            "subject_id": subject,
            "course_id": subject,
            "source": "bulk",
            "period_number": r.period_number,
            "slot_type": slot_type,
        })
        created += 1
    write_json("attendance", items)
    return {"created": created, "total_requested": len(body.records)}


def _semester_report_data(date_from: str, date_to: str, program: str | None = None, semester: str | None = None):
    if not date_from or not date_to:
        raise HTTPException(status_code=400, detail="date_from and date_to required (YYYY-MM-DD).")
    from_str = date_from[:10]
    to_str = date_to[:10]
    items = read_json("attendance")
    items = [a for a in items if from_str <= (a.get("date") or "")[:10] <= to_str]
    students = read_json("students")
    if program or semester:
        students = [s for s in students if (not program or (s.get("course") or "").strip() == program) and (not semester or str(s.get("semester")) == str(semester))]
    student_ids = {str(s.get("id")) for s in students}
    items = [a for a in items if str(a.get("student_id")) in student_ids]
    by_student = defaultdict(lambda: {"present": 0, "absent": 0})
    for a in items:
        sid = str(a.get("student_id"))
        if (a.get("status") or "").lower() == "absent":
            by_student[sid]["absent"] += 1
        else:
            by_student[sid]["present"] += 1
    report = []
    for s in students:
        sid = str(s.get("id"))
        p = by_student[sid]["present"]
        ab = by_student[sid]["absent"]
        total = p + ab
        pct = round(100 * p / total, 1) if total else 0
        report.append({
            "student_id": sid,
            "student_name": s.get("name"),
            "roll_no": s.get("roll_no"),
            "course": s.get("course"),
            "semester": s.get("semester"),
            "present": p,
            "absent": ab,
            "total_days": total,
            "percentage": pct,
        })
    report.sort(key=lambda x: (x.get("roll_no") or "", x.get("student_name") or ""))
    return {"date_from": from_str, "date_to": to_str, "students": report}


@router.get("/semester-report")
def semester_report(
    date_from: str,
    date_to: str,
    current: dict = Depends(_get_current_user),
    program: str | None = None,
    semester: str | None = None,
):
    """Semester attendance report: percentage and totals in date range."""
    return _semester_report_data(date_from, date_to, program, semester)


@router.get("/defaulter-list")
def defaulter_list(
    current: dict = Depends(_get_current_user),
    month: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    threshold: float = 75.0,
    program: str | None = None,
    semester: str | None = None,
):
    """Students below attendance threshold. Use month (YYYY-MM) or date_from+date_to."""
    from datetime import timedelta
    if month:
        y, m = month[:4], (month[5:7] or "").strip()
        if not m:
            raise HTTPException(status_code=400, detail="month required (YYYY-MM)")
        start = f"{y}-{m}-01"
        try:
            next_month = date(int(y), int(m), 1) + timedelta(days=32)
            end = (next_month.replace(day=1) - timedelta(days=1)).strftime("%Y-%m-%d")
        except ValueError:
            end = f"{y}-{m}-28"
        data = _semester_report_data(start, end, program, semester)
    elif date_from and date_to:
        data = _semester_report_data(date_from, date_to, program, semester)
    else:
        month = month or date.today().strftime("%Y-%m")
        data = _monthly_report_data(month, program, semester)
    below = [s for s in data.get("students", []) if s.get("percentage", 100) < threshold and (s.get("total_days") or 0) > 0]
    return {"threshold": threshold, "defaulters": below, "count": len(below), "date_from": data.get("date_from"), "date_to": data.get("date_to"), "month": data.get("month")}


def _attendance_alerts():
    return read_json("attendance_alerts")


def _write_attendance_alerts(data: list):
    write_json("attendance_alerts", data)


class AbsentAlertCreate(BaseModel):
    student_id: str
    date: str
    channel: str = "app"  # app | sms
    sent_at: str = ""


@router.post("/alerts/absent")
def record_absent_alert(body: AbsentAlertCreate, current: dict = Depends(_get_current_user)):
    """Record that an absent alert was sent (App/SMS). For tracking and audit."""
    alerts = _attendance_alerts()
    from datetime import timezone
    entry = {
        "id": next_id("attendance_alerts"),
        "student_id": body.student_id,
        "date": body.date[:10],
        "channel": (body.channel or "app").strip().lower(),
        "sent_at": body.sent_at or datetime.now(timezone.utc).isoformat(),
    }
    alerts.append(entry)
    _write_attendance_alerts(alerts)
    return entry


@router.get("/alerts/absent")
def list_absent_alerts(
    current: dict = Depends(_get_current_user),
    student_id: str | None = None,
    date: str | None = None,
    limit: int = 100,
):
    items = _attendance_alerts()
    if student_id:
        items = [a for a in items if str(a.get("student_id")) == str(student_id)]
    if date:
        items = [a for a in items if (a.get("date") or "")[:10] == date[:10]]
    items = items[-limit:]
    return {"alerts": list(reversed(items))}


# ----- Staff attendance: GPS-based IN/OUT, geo-fencing, offline sync, correction -----
def _staff_attendance():
    return read_json("staff_attendance")


def _write_staff_attendance(data: list):
    write_json("staff_attendance", data)


def _geo_fence_ok(lat: float | None, lng: float | None) -> bool:
    if lat is None or lng is None or GEO_FENCE.get("lat") is None or GEO_FENCE.get("lng") is None:
        return True
    import math
    r = GEO_FENCE.get("radius_metres") or 200
    dx = (lat - GEO_FENCE["lat"]) * 111320
    dy = (lng - GEO_FENCE["lng"]) * 111320 * math.cos(math.radians(GEO_FENCE["lat"] or 0))
    return (dx * dx + dy * dy) <= (r * r)


@router.get("/staff/geo-config")
def staff_geo_config(current: dict = Depends(_get_current_user)):
    """Return geo-fence config for client (lat, lng, radius). Enables geo-fencing on app."""
    return {"geo_fence": GEO_FENCE, "enabled": GEO_FENCE.get("lat") is not None and GEO_FENCE.get("lng") is not None}


class StaffPunchBody(BaseModel):
    staff_id: str
    punch_type: str = "IN"  # IN | OUT
    lat: float | None = None
    lng: float | None = None
    timestamp: str = ""
    device_id: str = ""
    source: str = "gps"  # gps | manual | biometric | offline_sync
    offline_sync_id: str = ""  # client id for idempotent offline sync


@router.post("/staff/punch")
def staff_punch(body: StaffPunchBody, current: dict = Depends(_get_current_user)):
    """Staff IN/OUT punch. Optional GPS; geo_fence_ok computed if lat/lng and geo-config set. Offline sync: send offline_sync_id to dedupe."""
    punch_type = (body.punch_type or "IN").strip().upper()
    if punch_type not in ("IN", "OUT"):
        punch_type = "IN"
    ts = (body.timestamp or "").strip() or datetime.utcnow().isoformat()
    date_str = ts[:10] if len(ts) >= 10 else date.today().isoformat()
    staff_list = read_json("staff")
    if not any(str(s.get("id")) == str(body.staff_id) for s in staff_list):
        raise HTTPException(status_code=404, detail="Staff not found")
    items = _staff_attendance()
    if body.offline_sync_id:
        existing = next((p for p in items if p.get("offline_sync_id") == body.offline_sync_id), None)
        if existing:
            return {"message": "Already synced", "record": existing}
    geo_ok = _geo_fence_ok(body.lat, body.lng)
    record = {
        "id": next_id("staff_attendance"),
        "staff_id": body.staff_id,
        "date": date_str,
        "punch_type": punch_type,
        "timestamp": ts,
        "lat": body.lat,
        "lng": body.lng,
        "geo_fence_ok": geo_ok,
        "source": (body.source or "gps").strip().lower(),
        "device_id": (body.device_id or "").strip(),
        "offline_sync_id": (body.offline_sync_id or "").strip(),
    }
    items.append(record)
    _write_staff_attendance(items)
    return {"message": "Recorded", "record": record}


@router.get("/staff")
def list_staff_attendance(
    current: dict = Depends(_get_current_user),
    date: str | None = None,
    staff_id: str | None = None,
    limit: int = 200,
):
    """List staff attendance punches. Filter by date and/or staff_id."""
    items = _staff_attendance()
    if date:
        items = [p for p in items if (p.get("date") or "")[:10] == date[:10]]
    if staff_id:
        items = [p for p in items if str(p.get("staff_id")) == str(staff_id)]
    items.sort(key=lambda x: (x.get("date") or "", x.get("timestamp") or ""), reverse=True)
    staff_list = read_json("staff")
    by_id = {str(s.get("id")): s for s in staff_list}
    out = []
    for p in items[:limit]:
        out.append({**p, "staff_name": by_id.get(str(p.get("staff_id")), {}).get("name")})
    return {"records": out}


class StaffPunchCorrection(BaseModel):
    punch_type: str | None = None
    timestamp: str | None = None
    correction_reason: str = ""


@router.patch("/staff/{punch_id}")
def correct_staff_punch(punch_id: str, body: StaffPunchCorrection, current: dict = Depends(_get_current_user)):
    """Attendance correction: update punch type or timestamp. Records correction_reason for audit."""
    items = _staff_attendance()
    for i, p in enumerate(items):
        if str(p.get("id")) == str(punch_id):
            updates = body.model_dump(exclude_unset=True)
            if "punch_type" in updates and updates["punch_type"]:
                updates["punch_type"] = (updates["punch_type"] or "IN").strip().upper()
                if updates["punch_type"] not in ("IN", "OUT"):
                    updates["punch_type"] = p.get("punch_type", "IN")
            items[i] = {**p, **updates, "corrected_at": datetime.utcnow().isoformat()}
            _write_staff_attendance(items)
            return items[i]
    raise HTTPException(status_code=404, detail="Punch record not found")


@router.get("/{attendance_id}")
def get_attendance(attendance_id: str, current: dict = Depends(_get_current_user)):
    items = read_json("attendance")
    for a in items:
        if str(a.get("id")) == str(attendance_id):
            return a
    raise HTTPException(status_code=404, detail="Attendance record not found")


@router.post("")
def create_attendance(body: AttendanceCreate, current: dict = Depends(_get_current_user)):
    items = read_json("attendance")
    new_id = next_id("attendance")
    subject = (body.subject_id or body.course_id or "").strip()
    item = {
        "id": new_id,
        "student_id": body.student_id,
        "date": body.date,
        "status": (body.status or "present").strip().lower() or "present",
        "subject_id": subject,
        "course_id": subject,
        "source": (body.source or "manual").strip().lower() or "manual",
        "period_number": body.period_number,
        "slot_type": (body.slot_type or "theory").strip().lower() or "theory",
    }
    items.append(item)
    write_json("attendance", items)
    return item


@router.put("/{attendance_id}")
def update_attendance(attendance_id: str, body: AttendanceUpdate, current: dict = Depends(_get_current_user)):
    items = read_json("attendance")
    for i, a in enumerate(items):
        if str(a.get("id")) == str(attendance_id):
            data = body.model_dump(exclude_unset=True)
            if "subject_id" in data and "course_id" not in data:
                data["course_id"] = data.get("subject_id") or a.get("course_id")
            if "course_id" in data and "subject_id" not in data:
                data["subject_id"] = data.get("course_id") or a.get("subject_id")
            if "slot_type" in data and data["slot_type"]:
                data["slot_type"] = (data["slot_type"] or "theory").strip().lower() or "theory"
            items[i] = {**a, **data}
            write_json("attendance", items)
            return items[i]
    raise HTTPException(status_code=404, detail="Attendance record not found")


@router.delete("/{attendance_id}")
def delete_attendance(attendance_id: str, current: dict = Depends(_get_current_user)):
    items = read_json("attendance")
    for i, a in enumerate(items):
        if str(a.get("id")) == str(attendance_id):
            items.pop(i)
            write_json("attendance", items)
            return {"deleted": attendance_id}
    raise HTTPException(status_code=404, detail="Attendance record not found")
