"""Result & Analytics: GPA/CGPA, rank list, toppers, pass percentage, subject/department analytics."""
from collections import defaultdict

from fastapi import APIRouter, Depends

from app.db import read_json
from app.routers.auth import _get_current_user

router = APIRouter()

# 10-point scale: 90+ -> 10, 80-89 -> 9, ..., 40-49 -> 5, <40 -> 0 (fail)
PASS_PCT = 40


def _percentage(marks: float, max_marks: float) -> float:
    if not max_marks:
        return 0.0
    return round(100.0 * float(marks) / float(max_marks), 2)


def _grade_point(marks: float, max_marks: float) -> float:
    pct = _percentage(marks, max_marks)
    if pct >= 90:
        return 10.0
    if pct >= 80:
        return 9.0
    if pct >= 70:
        return 8.0
    if pct >= 60:
        return 7.0
    if pct >= 50:
        return 6.0
    if pct >= 40:
        return 5.0
    return 0.0


def _credits_for_subject(courses: list, subject_name: str, subject_id: str, semester: str) -> int:
    """Resolve credits from courses by subject_id or by subject name + semester."""
    sem = str(semester or "").strip()
    if subject_id:
        c = next((x for x in courses if str(x.get("id")) == str(subject_id)), None)
        if c and str(c.get("semester", "")).strip() == sem:
            return int(c.get("credits") or 1)
    sub = (subject_name or "").strip().lower()
    for c in courses:
        if str(c.get("semester", "")).strip() != sem:
            continue
        name = (c.get("name") or "").lower()
        if sub in name or name.startswith(sub) or (sub and name.startswith(sub.split()[0] if sub else "")):
            return int(c.get("credits") or 1)
    return 1


def _marks_with_semester(marks_list: list) -> list:
    """Normalize marks: ensure semester and subject_id for GPA logic."""
    courses = read_json("courses")
    out = []
    for m in marks_list:
        sem = (m.get("semester") or "").strip()
        if not sem:
            continue
        subject = (m.get("subject") or "").strip()
        sub_id = (m.get("subject_id") or "").strip()
        credits = _credits_for_subject(courses, subject, sub_id, sem)
        out.append({
            "student_id": str(m.get("student_id") or ""),
            "subject": subject,
            "subject_id": sub_id,
            "semester": sem,
            "marks": float(m.get("marks") or 0),
            "max_marks": float(m.get("max_marks") or 100),
            "credits": credits,
        })
    return out


@router.get("/gpa")
def list_gpa(current: dict = Depends(_get_current_user), semester: str | None = None, course: str | None = None):
    """GPA per student for a semester. course filters by student's course."""
    marks_list = read_json("marks")
    students = read_json("students")
    normalized = _marks_with_semester(marks_list)
    if semester:
        normalized = [n for n in normalized if n["semester"] == semester]
    # (student_id, semester) -> list of (gp, credits)
    by_student_sem = defaultdict(lambda: {"points": 0.0, "credits": 0.0})
    for n in normalized:
        key = (n["student_id"], n["semester"])
        gp = _grade_point(n["marks"], n["max_marks"])
        by_student_sem[key]["points"] += gp * n["credits"]
        by_student_sem[key]["credits"] += n["credits"]

    result = []
    for (sid, sem), data in by_student_sem.items():
        if not sid:
            continue
        st = next((s for s in students if str(s.get("id")) == sid), None)
        if not st:
            continue
        if course and (st.get("course") or "").strip() != course.strip():
            continue
        total_c = data["credits"]
        gpa = round(data["points"] / total_c, 2) if total_c else 0.0
        result.append({
            "student_id": sid,
            "student_name": st.get("name"),
            "roll_no": st.get("roll_no"),
            "course": st.get("course"),
            "semester": sem,
            "gpa": gpa,
            "credits_total": total_c,
        })
    result.sort(key=lambda x: (-x["gpa"], x["roll_no"] or ""))
    return {"gpa_list": result}


@router.get("/cgpa")
def list_cgpa(current: dict = Depends(_get_current_user), course: str | None = None):
    """CGPA per student (average of semester GPAs or weighted by credits)."""
    gpa_res = list_gpa(course=course)
    by_student = defaultdict(lambda: {"points": 0.0, "credits": 0.0})
    for r in gpa_res["gpa_list"]:
        sid = r["student_id"]
        by_student[sid]["points"] += r["gpa"] * r["credits_total"]
        by_student[sid]["credits"] += r["credits_total"]
        by_student[sid]["name"] = r["student_name"]
        by_student[sid]["roll_no"] = r["roll_no"]
        by_student[sid]["course"] = r["course"]

    result = []
    for sid, data in by_student.items():
        total_c = data["credits"]
        cgpa = round(data["points"] / total_c, 2) if total_c else 0.0
        result.append({
            "student_id": sid,
            "student_name": data["name"],
            "roll_no": data["roll_no"],
            "course": data["course"],
            "cgpa": cgpa,
            "credits_total": total_c,
        })
    result.sort(key=lambda x: (-x["cgpa"], x["roll_no"] or ""))
    return {"cgpa_list": result}


@router.get("/rank-list")
def rank_list(current: dict = Depends(_get_current_user), semester: str | None = None, course: str | None = None, limit: int = 100):
    """Rank list by GPA for the given semester (and optional course)."""
    gpa_res = list_gpa(semester=semester, course=course)
    items = gpa_res["gpa_list"][:limit]
    for i, row in enumerate(items, 1):
        row["rank"] = i
    return {"rank_list": items}


@router.get("/toppers")
def toppers(current: dict = Depends(_get_current_user), semester: str | None = None, course: str | None = None, limit: int = 10):
    """Topper list: top N by GPA for semester (or by CGPA if no semester)."""
    if semester:
        gpa_res = list_gpa(semester=semester, course=course)
        items = gpa_res["gpa_list"][:limit]
    else:
        cgpa_res = list_cgpa(course=course)
        items = cgpa_res["cgpa_list"][:limit]
    for i, row in enumerate(items, 1):
        row["rank"] = i
    return {"toppers": items}


@router.get("/pass-percentage")
def pass_percentage(
    current: dict = Depends(_get_current_user),
    semester: str | None = None,
    subject_id: str | None = None,
    exam_id: str | None = None,
    course: str | None = None,
    threshold: float = 40.0,
):
    """Pass percentage: by semester, subject, or exam. threshold = min % to pass (default 40)."""
    marks_list = read_json("marks")
    students = read_json("students")
    student_courses = {str(s.get("id")): (s.get("course") or "").strip() for s in students}

    if exam_id:
        marks_list = [m for m in marks_list if str(m.get("exam_id")) == str(exam_id)]
    if subject_id:
        marks_list = [m for m in marks_list if str(m.get("subject_id")) == str(subject_id)]
    if semester:
        marks_list = [m for m in marks_list if str(m.get("semester")) == str(semester)]
    if course:
        marks_list = [m for m in marks_list if student_courses.get(str(m.get("student_id")), "") == course.strip()]

    total = len(marks_list)
    passed = sum(
        1 for m in marks_list
        if _percentage(float(m.get("marks") or 0), float(m.get("max_marks") or 100)) >= threshold
    )
    pct = round(100.0 * passed / total, 2) if total else 0.0
    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "pass_percentage": pct,
        "threshold": threshold,
        "filters": {"semester": semester, "subject_id": subject_id, "exam_id": exam_id, "course": course},
    }


@router.get("/subject-performance")
def subject_performance(current: dict = Depends(_get_current_user), semester: str | None = None, course: str | None = None):
    """Subject-wise analytics: avg marks, pass %, student count."""
    marks_list = read_json("marks")
    students = read_json("students")
    student_courses = {str(s.get("id")): (s.get("course") or "").strip() for s in students}

    if semester:
        marks_list = [m for m in marks_list if str(m.get("semester")) == str(semester)]
    if course:
        marks_list = [m for m in marks_list if student_courses.get(str(m.get("student_id")), "") == course.strip()]

    by_subject = defaultdict(lambda: {"marks": [], "max_marks": [], "passed": 0, "total": 0})
    for m in marks_list:
        sub = (m.get("subject") or "Unknown").strip() or "Unknown"
        mar = float(m.get("marks") or 0)
        mx = float(m.get("max_marks") or 100)
        by_subject[sub]["marks"].append(mar)
        by_subject[sub]["max_marks"].append(mx)
        by_subject[sub]["total"] += 1
        if _percentage(mar, mx) >= PASS_PCT:
            by_subject[sub]["passed"] += 1

    result = []
    for sub, data in sorted(by_subject.items()):
        total = data["total"]
        passed = data["passed"]
        avg_marks = round(sum(data["marks"]) / total, 2) if total else 0
        pass_pct = round(100.0 * passed / total, 2) if total else 0
        result.append({
            "subject": sub,
            "total_students": total,
            "passed": passed,
            "failed": total - passed,
            "pass_percentage": pass_pct,
            "average_marks": avg_marks,
        })
    return {"subject_performance": result}


@router.get("/department-comparison")
def department_comparison(current: dict = Depends(_get_current_user), semester: str | None = None):
    """Department/course comparison for results: avg marks, pass %, student count per department/course."""
    marks_list = read_json("marks")
    students = read_json("students")
    courses_list = read_json("courses")

    # Map subject -> department from courses
    subject_dept = {}
    for c in courses_list:
        name = (c.get("name") or "").strip()
        dept = (c.get("department") or "Other").strip()
        subject_dept[name] = dept
    # Also by partial match
    for m in marks_list:
        sub = (m.get("subject") or "").strip()
        if sub not in subject_dept:
            for name, dept in subject_dept.items():
                if sub in name or (name and name.lower().startswith(sub.lower())):
                    subject_dept[sub] = dept
                    break
            if sub and sub not in subject_dept:
                subject_dept[sub] = "General"

    student_course = {str(s.get("id")): (s.get("course") or "Other").strip() for s in students}

    if semester:
        marks_list = [m for m in marks_list if str(m.get("semester")) == str(semester)]

    by_course = defaultdict(lambda: {"marks": [], "passed": 0, "total": 0})
    by_department = defaultdict(lambda: {"marks": [], "passed": 0, "total": 0})

    for m in marks_list:
        sid = str(m.get("student_id") or "")
        course = student_course.get(sid, "Other")
        sub = (m.get("subject") or "").strip()
        dept = subject_dept.get(sub, "General")
        mar = float(m.get("marks") or 0)
        mx = float(m.get("max_marks") or 100)
        pct = _percentage(mar, mx)

        by_course[course]["marks"].append(mar)
        by_course[course]["total"] += 1
        if pct >= PASS_PCT:
            by_course[course]["passed"] += 1

        by_department[dept]["marks"].append(mar)
        by_department[dept]["total"] += 1
        if pct >= PASS_PCT:
            by_department[dept]["passed"] += 1

    def build(name, data):
        total = data["total"]
        passed = data["passed"]
        avg = round(sum(data["marks"]) / total, 2) if total else 0
        pass_pct = round(100.0 * passed / total, 2) if total else 0
        return {"name": name, "total": total, "passed": passed, "pass_percentage": pass_pct, "average_marks": avg}

    return {
        "by_course": [build(k, v) for k, v in sorted(by_course.items())],
        "by_department": [build(k, v) for k, v in sorted(by_department.items())],
    }
