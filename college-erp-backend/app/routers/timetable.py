"""Class timetable: slots by day, time, subject, faculty, room. Lab, extra class, holidays, version history, conflict detection."""
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()

DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def _time_minutes(t: str) -> int:
    """Convert 'HH:MM' to minutes since midnight."""
    if not t or ":" not in t:
        return 0
    parts = t.strip().split(":")
    try:
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return 0


def _slots_overlap(s1: dict, s2: dict) -> bool:
    """True if same day and time ranges overlap."""
    if str(s1.get("day_of_week")) != str(s2.get("day_of_week")):
        return False
    start1, end1 = _time_minutes(s1.get("slot_start") or ""), _time_minutes(s1.get("slot_end") or "")
    start2, end2 = _time_minutes(s2.get("slot_start") or ""), _time_minutes(s2.get("slot_end") or "")
    return start1 < end2 and start2 < end1


class SlotCreate(BaseModel):
    day_of_week: int  # 1=Mon .. 6=Sat
    slot_start: str = "09:00"
    slot_end: str = "10:00"
    subject_id: str
    staff_id: str
    room: str = ""
    program: str = ""
    semester: str = ""
    slot_type: str = "theory"  # theory | lab | extra
    lab_batch: str = ""
    is_extra: bool = False
    slot_date: str = ""  # YYYY-MM-DD for extra class on specific date; optional


class SlotUpdate(BaseModel):
    day_of_week: int | None = None
    slot_start: str | None = None
    slot_end: str | None = None
    subject_id: str | None = None
    staff_id: str | None = None
    room: str | None = None
    program: str | None = None
    semester: str | None = None
    slot_type: str | None = None
    lab_batch: str | None = None
    is_extra: bool | None = None
    slot_date: str | None = None


def _enrich(slots):
    subjects = read_json("courses")
    staff_list = read_json("staff")
    out = []
    for s in slots:
        sub = next((x for x in subjects if str(x.get("id")) == str(s.get("subject_id"))), {})
        st = next((x for x in staff_list if str(x.get("id")) == str(s.get("staff_id"))), {})
        out.append({
            **s,
            "subject_name": sub.get("name"),
            "staff_name": st.get("name"),
            "day_name": DAY_NAMES[s.get("day_of_week") or 0] if 0 <= (s.get("day_of_week") or 0) < len(DAY_NAMES) else "",
        })
    return out


@router.get("")
def list_slots(
    current: dict = Depends(_get_current_user),
    program: str | None = None,
    semester: str | None = None,
    day_of_week: int | None = None,
    staff_id: str | None = None,
    slot_type: str | None = None,
):
    slots = read_json("timetable")
    if program:
        slots = [s for s in slots if (s.get("program") or "").strip() == program.strip()]
    if semester:
        slots = [s for s in slots if str(s.get("semester")) == str(semester)]
    if day_of_week is not None:
        slots = [s for s in slots if s.get("day_of_week") == day_of_week]
    if staff_id:
        slots = [s for s in slots if str(s.get("staff_id")) == str(staff_id)]
    if slot_type:
        slots = [s for s in slots if (s.get("slot_type") or "theory").lower() == slot_type.lower()]
    slots.sort(key=lambda x: (x.get("day_of_week") or 0, x.get("slot_start") or ""))
    return _enrich(slots)


# ----- Holidays (block extra class on these dates) -----
def _holidays():
    return read_json("timetable_holidays")


def _write_holidays(data: list):
    write_json("timetable_holidays", data)


class HolidayCreate(BaseModel):
    date: str  # YYYY-MM-DD
    name: str = ""


@router.get("/holidays")
def list_holidays(current: dict = Depends(_get_current_user), year: str | None = None):
    items = _holidays()
    if year:
        items = [h for h in items if (h.get("date") or "")[:4] == str(year)[:4]]
    items.sort(key=lambda x: x.get("date") or "")
    return {"holidays": items}


@router.post("/holidays")
def create_holiday(body: HolidayCreate, current: dict = Depends(_get_current_user)):
    date_str = (body.date or "")[:10]
    if not date_str:
        raise HTTPException(status_code=400, detail="date required (YYYY-MM-DD)")
    items = _holidays()
    if any((h.get("date") or "")[:10] == date_str for h in items):
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    items.append({"id": next_id("timetable_holidays"), "date": date_str, "name": (body.name or "").strip()})
    _write_holidays(items)
    return items[-1]


@router.delete("/holidays/{holiday_id}")
def delete_holiday(holiday_id: str, current: dict = Depends(_get_current_user)):
    items = _holidays()
    for i, h in enumerate(items):
        if str(h.get("id")) == str(holiday_id):
            items.pop(i)
            _write_holidays(items)
            return {"deleted": holiday_id}
    raise HTTPException(status_code=404, detail="Holiday not found")


def _is_holiday(d: str) -> bool:
    return any((h.get("date") or "")[:10] == (d or "")[:10] for h in _holidays())


# ----- Version history -----
def _timetable_versions():
    return read_json("timetable_versions")


def _write_timetable_versions(data: list):
    write_json("timetable_versions", data)


@router.get("/versions")
def list_versions(current: dict = Depends(_get_current_user), limit: int = 20):
    versions = _timetable_versions()
    versions.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"versions": versions[:limit]}


@router.post("/versions")
def create_version_snapshot(current: dict = Depends(_get_current_user)):
    """Save current timetable as a version (snapshot) for history."""
    slots = read_json("timetable")
    v = {
        "id": next_id("timetable_versions"),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "slots": [dict(s) for s in slots],
    }
    versions = _timetable_versions()
    versions.append(v)
    _write_timetable_versions(versions)
    return v


@router.get("/versions/{version_id}")
def get_version(version_id: str, current: dict = Depends(_get_current_user)):
    for v in _timetable_versions():
        if str(v.get("id")) == str(version_id):
            return v
    raise HTTPException(status_code=404, detail="Version not found")


@router.post("/versions/{version_id}/restore")
def restore_version(version_id: str, current: dict = Depends(_get_current_user)):
    """Replace current timetable with this version."""
    versions = _timetable_versions()
    for v in versions:
        if str(v.get("id")) == str(version_id):
            write_json("timetable", v.get("slots") or [])
            return {"restored": version_id, "slots_count": len(v.get("slots") or [])}
    raise HTTPException(status_code=404, detail="Version not found")


# ----- Auto-suggest: suggest slots from subject-faculty mapping and constraints -----
@router.get("/suggest")
def suggest_slots(
    current: dict = Depends(_get_current_user),
    program: str | None = None,
    semester: str | None = None,
):
    """Suggest timetable slots from subject-faculty mapping. Returns possible (subject, staff, room) combinations."""
    mapping = read_json("subject_faculty")
    slots = read_json("timetable")
    subjects = read_json("courses")
    staff_list = read_json("staff")
    existing_by_prog_sem = {(s.get("program"), str(s.get("semester"))): s for s in slots if (program is None or (s.get("program") or "").strip() == program) and (semester is None or str(s.get("semester")) == semester)}
    suggested = []
    for m in mapping:
        if program and (m.get("program") or "").strip() != program:
            continue
        if semester and str(m.get("semester")) != str(semester):
            continue
        sub = next((x for x in subjects if str(x.get("id")) == str(m.get("subject_id"))), {})
        st = next((x for x in staff_list if str(x.get("id")) == str(m.get("staff_id"))), {})
        suggested.append({
            "subject_id": m.get("subject_id"),
            "subject_name": sub.get("name"),
            "staff_id": m.get("staff_id"),
            "staff_name": st.get("name"),
            "program": m.get("program"),
            "semester": m.get("semester"),
        })
    return {"suggested": suggested}


@router.get("/clashes")
def get_clashes(current: dict = Depends(_get_current_user)):
    """Detect faculty clashes (same person two places) and room clashes (same room double-booked)."""
    slots = read_json("timetable")
    enriched = _enrich(slots)
    faculty_clashes = []
    room_clashes = []
    for i, a in enumerate(slots):
        for j, b in enumerate(slots):
            if i >= j:
                continue
            if not _slots_overlap(a, b):
                continue
            if str(a.get("staff_id")) == str(b.get("staff_id")) and a.get("staff_id"):
                faculty_clashes.append({
                    "type": "faculty",
                    "message": f"Faculty has overlapping slots",
                    "staff_id": a.get("staff_id"),
                    "staff_name": next((x.get("staff_name") for x in enriched if str(x.get("id")) == str(a.get("id"))), ""),
                    "slot_a": next((x for x in enriched if str(x.get("id")) == str(a.get("id"))), a),
                    "slot_b": next((x for x in enriched if str(x.get("id")) == str(b.get("id"))), b),
                })
            room_a = (a.get("room") or "").strip()
            room_b = (b.get("room") or "").strip()
            if room_a and room_a == room_b:
                room_clashes.append({
                    "type": "room",
                    "message": f"Room '{room_a}' double-booked",
                    "room": room_a,
                    "slot_a": next((x for x in enriched if str(x.get("id")) == str(a.get("id"))), a),
                    "slot_b": next((x for x in enriched if str(x.get("id")) == str(b.get("id"))), b),
                })
    return {"faculty_clashes": faculty_clashes, "room_clashes": room_clashes}


@router.get("/{slot_id}")
def get_slot(slot_id: str, current: dict = Depends(_get_current_user)):
    slots = read_json("timetable")
    for s in slots:
        if str(s.get("id")) == str(slot_id):
            return _enrich([s])[0]
    raise HTTPException(status_code=404, detail="Slot not found")


@router.post("")
def create_slot(body: SlotCreate, current: dict = Depends(_get_current_user)):
    slot_date = (body.slot_date or "").strip()[:10]
    if slot_date and _is_holiday(slot_date):
        raise HTTPException(status_code=400, detail=f"Date {slot_date} is a holiday; cannot schedule extra class.")
    slots = read_json("timetable")
    new_id = next_id("timetable")
    slot_type = (body.slot_type or "theory").strip().lower() or "theory"
    if body.is_extra:
        slot_type = "extra"
    item = {
        "id": new_id,
        "day_of_week": body.day_of_week,
        "slot_start": (body.slot_start or "09:00").strip(),
        "slot_end": (body.slot_end or "10:00").strip(),
        "subject_id": body.subject_id,
        "staff_id": body.staff_id,
        "room": (body.room or "").strip(),
        "program": (body.program or "").strip(),
        "semester": str(body.semester) if body.semester is not None else "",
        "slot_type": slot_type,
        "lab_batch": (body.lab_batch or "").strip(),
        "is_extra": bool(body.is_extra),
        "slot_date": slot_date,
    }
    slots.append(item)
    write_json("timetable", slots)
    return _enrich([item])[0]


@router.put("/{slot_id}")
def update_slot(slot_id: str, body: SlotUpdate, current: dict = Depends(_get_current_user)):
    slots = read_json("timetable")
    for i, s in enumerate(slots):
        if str(s.get("id")) == str(slot_id):
            data = body.model_dump(exclude_unset=True)
            if "semester" in data and data["semester"] is not None:
                data["semester"] = str(data["semester"])
            if "slot_type" in data and data["slot_type"]:
                data["slot_type"] = (data["slot_type"] or "theory").strip().lower() or "theory"
            if body.is_extra is True:
                data["slot_type"] = "extra"
            slot_date = (data.get("slot_date") or s.get("slot_date") or "").strip()[:10]
            if slot_date and _is_holiday(slot_date):
                raise HTTPException(status_code=400, detail=f"Date {slot_date} is a holiday.")
            slots[i] = {**s, **data}
            write_json("timetable", slots)
            return _enrich([slots[i]])[0]
    raise HTTPException(status_code=404, detail="Slot not found")


@router.delete("/{slot_id}")
def delete_slot(slot_id: str, current: dict = Depends(_get_current_user)):
    slots = read_json("timetable")
    for i, s in enumerate(slots):
        if str(s.get("id")) == str(slot_id):
            slots.pop(i)
            write_json("timetable", slots)
            return {"deleted": slot_id}
    raise HTTPException(status_code=404, detail="Slot not found")
