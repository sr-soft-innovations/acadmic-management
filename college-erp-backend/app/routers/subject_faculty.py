"""Subject-faculty mapping: assign faculty to subjects."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.routers.auth import _get_current_user

router = APIRouter()


class MappingCreate(BaseModel):
    subject_id: str
    staff_id: str


@router.get("")
def list_mappings(current: dict = Depends(_get_current_user), subject_id: str | None = None, staff_id: str | None = None):
    items = read_json("subject_faculty")
    if subject_id:
        items = [m for m in items if str(m.get("subject_id")) == str(subject_id)]
    if staff_id:
        items = [m for m in items if str(m.get("staff_id")) == str(staff_id)]
    subjects = read_json("courses")
    staff_list = read_json("staff")
    out = []
    for m in items:
        sub = next((s for s in subjects if str(s.get("id")) == str(m.get("subject_id"))), {})
        st = next((s for s in staff_list if str(s.get("id")) == str(m.get("staff_id"))), {})
        out.append({
            **m,
            "subject_name": sub.get("name"),
            "staff_name": st.get("name"),
        })
    return out


@router.post("")
def create_mapping(body: MappingCreate, current: dict = Depends(_get_current_user)):
    subjects = read_json("courses")
    staff_list = read_json("staff")
    if not any(str(s.get("id")) == str(body.subject_id) for s in subjects):
        raise HTTPException(status_code=400, detail="Subject not found")
    if not any(str(s.get("id")) == str(body.staff_id) for s in staff_list):
        raise HTTPException(status_code=400, detail="Staff not found")
    items = read_json("subject_faculty")
    if any(str(m.get("subject_id")) == str(body.subject_id) and str(m.get("staff_id")) == str(body.staff_id) for m in items):
        raise HTTPException(status_code=400, detail="Mapping already exists")
    new_id = next_id("subject_faculty")
    item = {"id": new_id, "subject_id": body.subject_id, "staff_id": body.staff_id}
    items.append(item)
    write_json("subject_faculty", items)
    return item


@router.delete("/{mapping_id}")
def delete_mapping(mapping_id: str, current: dict = Depends(_get_current_user)):
    items = read_json("subject_faculty")
    for i, m in enumerate(items):
        if str(m.get("id")) == str(mapping_id):
            items.pop(i)
            write_json("subject_faculty", items)
            return {"deleted": mapping_id}
    raise HTTPException(status_code=404, detail="Mapping not found")
