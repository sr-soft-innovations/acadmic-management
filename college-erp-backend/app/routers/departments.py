"""Department CRUD endpoints."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()


class DepartmentCreate(BaseModel):
    name: str
    code: str = ""
    head_of_department: str = ""
    description: str = ""
    established_year: str = ""
    phone: str = ""
    email: str = ""


class DepartmentUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    head_of_department: str | None = None
    description: str | None = None
    established_year: str | None = None
    phone: str | None = None
    email: str | None = None


@router.get("")
def list_departments(current: dict = Depends(_get_current_user)):
    depts = read_json("departments")
    staff = read_json("staff")
    students = read_json("students")
    courses = read_json("courses")
    for d in depts:
        name = d.get("name", "")
        d["staff_count"] = sum(1 for s in staff if (s.get("department") or "") == name)
        d["student_count"] = sum(1 for s in students if (s.get("department") or "") == name)
        d["course_count"] = sum(1 for c in courses if (c.get("department") or "") == name)
    return depts


@router.get("/{dept_id}")
def get_department(dept_id: str, current: dict = Depends(_get_current_user)):
    for d in read_json("departments"):
        if str(d.get("id")) == str(dept_id):
            return d
    raise HTTPException(status_code=404, detail="Department not found")


@router.post("")
def create_department(body: DepartmentCreate, current: dict = Depends(_get_current_user)):
    depts = read_json("departments")
    new_id = next_id("departments")
    item = {
        "id": new_id,
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    depts.append(item)
    write_json("departments", depts)
    return item


@router.put("/{dept_id}")
def update_department(dept_id: str, body: DepartmentUpdate, current: dict = Depends(_get_current_user)):
    depts = read_json("departments")
    for i, d in enumerate(depts):
        if str(d.get("id")) == str(dept_id):
            data = body.model_dump(exclude_unset=True)
            depts[i] = {**d, **data}
            write_json("departments", depts)
            return depts[i]
    raise HTTPException(status_code=404, detail="Department not found")


@router.delete("/{dept_id}")
def delete_department(dept_id: str, current: dict = Depends(_get_current_user)):
    depts = read_json("departments")
    for i, d in enumerate(depts):
        if str(d.get("id")) == str(dept_id):
            depts.pop(i)
            write_json("departments", depts)
            return {"deleted": dept_id}
    raise HTTPException(status_code=404, detail="Department not found")
