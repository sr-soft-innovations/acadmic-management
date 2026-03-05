"""Courses REST endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()


class CourseCreate(BaseModel):
    name: str
    code: str = ""
    department: str = ""
    semester: str = ""
    credits: int | float = 0


class CourseUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    department: str | None = None
    semester: str | None = None
    credits: int | float | None = None


@router.get("")
def list_courses(current: dict = Depends(_get_current_user)):
    return read_json("courses")


@router.get("/{course_id}")
def get_course(course_id: str, current: dict = Depends(_get_current_user)):
    courses = read_json("courses")
    for c in courses:
        if str(c.get("id")) == str(course_id):
            return c
    raise HTTPException(status_code=404, detail="Course not found")


@router.post("")
def create_course(body: CourseCreate, current: dict = Depends(_get_current_user)):
    courses = read_json("courses")
    new_id = next_id("courses")
    item = {
        "id": new_id,
        "name": body.name,
        "code": body.code,
        "department": body.department,
        "semester": body.semester,
        "credits": getattr(body, "credits", 0) or 0,
    }
    courses.append(item)
    write_json("courses", courses)
    return item


@router.put("/{course_id}")
def update_course(course_id: str, body: CourseUpdate, current: dict = Depends(_get_current_user)):
    courses = read_json("courses")
    for i, c in enumerate(courses):
        if str(c.get("id")) == str(course_id):
            data = body.model_dump(exclude_unset=True)
            courses[i] = {**c, **data}
            write_json("courses", courses)
            return courses[i]
    raise HTTPException(status_code=404, detail="Course not found")


@router.delete("/{course_id}")
def delete_course(course_id: str, current: dict = Depends(_get_current_user)):
    courses = read_json("courses")
    for i, c in enumerate(courses):
        if str(c.get("id")) == str(course_id):
            courses.pop(i)
            write_json("courses", courses)
            return {"deleted": course_id}
    raise HTTPException(status_code=404, detail="Course not found")
