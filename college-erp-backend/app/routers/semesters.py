"""Semester setup: define semesters per program."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()


class SemesterCreate(BaseModel):
    program: str
    semester_number: int
    name: str = ""


class SemesterUpdate(BaseModel):
    program: str | None = None
    semester_number: int | None = None
    name: str | None = None


@router.get("")
def list_semesters(current: dict = Depends(_get_current_user), program: str | None = None):
    items = read_json("semesters")
    if program:
        items = [s for s in items if (s.get("program") or "").strip() == program.strip()]
    return items


@router.get("/{semester_id}")
def get_semester(semester_id: str, current: dict = Depends(_get_current_user)):
    items = read_json("semesters")
    for s in items:
        if str(s.get("id")) == str(semester_id):
            return s
    raise HTTPException(status_code=404, detail="Semester not found")


@router.post("")
def create_semester(body: SemesterCreate, current: dict = Depends(_get_current_user)):
    items = read_json("semesters")
    new_id = next_id("semesters")
    name = (body.name or "").strip() or f"Semester {body.semester_number}"
    item = {
        "id": new_id,
        "program": (body.program or "").strip(),
        "semester_number": body.semester_number,
        "name": name,
    }
    items.append(item)
    write_json("semesters", items)
    return item


@router.put("/{semester_id}")
def update_semester(semester_id: str, body: SemesterUpdate, current: dict = Depends(_get_current_user)):
    items = read_json("semesters")
    for i, s in enumerate(items):
        if str(s.get("id")) == str(semester_id):
            data = body.model_dump(exclude_unset=True)
            num = data.get("semester_number", s.get("semester_number"))
            if "name" in data and not (data.get("name") or "").strip():
                data["name"] = f"Semester {num}"
            items[i] = {**s, **data}
            write_json("semesters", items)
            return items[i]
    raise HTTPException(status_code=404, detail="Semester not found")


@router.delete("/{semester_id}")
def delete_semester(semester_id: str, current: dict = Depends(_get_current_user)):
    items = read_json("semesters")
    for i, s in enumerate(items):
        if str(s.get("id")) == str(semester_id):
            items.pop(i)
            write_json("semesters", items)
            return {"deleted": semester_id}
    raise HTTPException(status_code=404, detail="Semester not found")
