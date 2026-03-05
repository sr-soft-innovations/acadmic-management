"""Role CRUD and assign module permissions. Permissions resolved from roles.json with fallback to static matrix."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import read_json, write_json, next_id
from app.modules import MODULES
from app.permissions import get_role_permissions, has_permission
from app.routers.auth import _get_current_user
from fastapi import Depends

router = APIRouter()


class RoleCreate(BaseModel):
    name: str
    slug: str
    permissions: list[str] = []


class RoleUpdate(BaseModel):
    name: str | None = None
    permissions: list[str] | None = None


def _ensure_roles():
    roles = read_json("roles")
    if not roles:
        default_roles = [
            {"id": "1", "name": "Super Admin", "slug": "super_admin", "permissions": ["*"]},
            {"id": "2", "name": "Admin", "slug": "admin", "permissions": [
                "dashboard:read", "students:read", "students:write", "staff:read", "staff:write",
                "courses:read", "courses:write", "attendance:read", "attendance:write",
                "reports:read", "fees:read", "analytics:read", "approvals:read", "approvals:write",
                "sessions:read", "sessions:write", "audit:read", "users:read", "users:write",
                "role_management:read", "role_management:write",
                "academic:read", "communication:read",
                "library:read", "lab:read", "pharmd:read",
                "hostel:read", "transport:read", "placement:read",
                "payroll:read", "expense:read",
                "scholarship:read", "notice:read", "messaging:read", "events:read", "accreditation:read",
            ]},
            {"id": "3", "name": "Principal", "slug": "principal", "permissions": [
                "dashboard:read", "students:read", "students:write", "staff:read", "staff:write",
                "courses:read", "courses:write", "attendance:read", "attendance:write",
                "reports:read", "fees:read", "analytics:read", "approvals:read",
                "sessions:read", "audit:read", "role_management:read",
                "academic:read", "communication:read",
                "library:read", "lab:read", "pharmd:read",
                "hostel:read", "transport:read", "placement:read",
                "payroll:read", "expense:read",
                "scholarship:read", "notice:read", "messaging:read", "events:read", "accreditation:read",
            ]},
            {"id": "4", "name": "HOD", "slug": "hod", "permissions": [
                "dashboard:read", "students:read", "staff:read", "courses:read", "courses:write",
                "attendance:read", "attendance:write", "reports:read", "fees:read", "analytics:read", "audit:read",
            ]},
            {"id": "5", "name": "Staff", "slug": "staff", "permissions": [
                "dashboard:read", "students:read", "courses:read", "attendance:read", "attendance:write",
            ]},
            {"id": "6", "name": "Student", "slug": "student", "permissions": ["dashboard:read", "attendance:read"]},
            {"id": "7", "name": "Parent", "slug": "parent", "permissions": ["dashboard:read", "attendance:read", "parent_portal:read"]},
            {"id": "8", "name": "Faculty", "slug": "faculty", "permissions": ["dashboard:read", "students:read", "courses:read", "attendance:read", "attendance:write"]},
            {"id": "9", "name": "Librarian", "slug": "librarian", "permissions": ["dashboard:read", "courses:read", "reports:read", "library:read"]},
            {"id": "10", "name": "Lab Assistant", "slug": "lab_assistant", "permissions": ["dashboard:read", "courses:read", "attendance:read", "attendance:write", "lab:read"]},
            {"id": "11", "name": "Non-teaching staff", "slug": "non_teaching_staff", "permissions": ["dashboard:read", "attendance:read"]},
            {"id": "12", "name": "Hospital Mentor (Pharm.D)", "slug": "hospital_mentor", "permissions": ["dashboard:read", "students:read", "attendance:read", "pharmd:read"]},
            {"id": "13", "name": "Guest Faculty", "slug": "guest_faculty", "permissions": ["dashboard:read", "students:read", "courses:read", "attendance:read"]},
            {"id": "14", "name": "Accountant", "slug": "accountant", "permissions": ["dashboard:read", "fees:read", "fees:add", "fees:edit", "reports:read", "expense:read", "expense:add", "expense:edit", "payroll:read", "scholarship:read"]},
        ]
        write_json("roles", default_roles)
        return default_roles
    return roles


@router.get("/modules")
def list_modules(current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "role_management:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    return {"modules": MODULES}


@router.get("")
def list_roles(current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "role_management:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    roles = _ensure_roles()
    return {"roles": roles}


@router.get("/permissions-matrix")
def get_permissions_matrix(current: dict = Depends(_get_current_user)):
    """Current matrix (from roles.json + fallback) for frontend sidebar and guards."""
    roles = _ensure_roles()
    matrix = {}
    for r in roles:
        slug = r.get("slug") or ""
        matrix[slug] = r.get("permissions") or []
    return {"matrix": matrix}


@router.post("")
def create_role(body: RoleCreate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "role_management:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    roles = _ensure_roles()
    slug = (body.slug or "").strip().lower().replace(" ", "_")
    if any((r.get("slug") or "").lower() == slug for r in roles):
        raise HTTPException(status_code=400, detail="Role slug already exists.")
    new_id = next_id("roles")
    roles.append({
        "id": new_id,
        "name": (body.name or "").strip() or slug,
        "slug": slug,
        "permissions": list(body.permissions) if body.permissions else [],
    })
    write_json("roles", roles)
    return roles[-1]


@router.get("/{role_id}")
def get_role(role_id: str, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "role_management:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    roles = _ensure_roles()
    for r in roles:
        if str(r.get("id")) == str(role_id):
            return r
    raise HTTPException(status_code=404, detail="Role not found")


@router.put("/{role_id}")
def update_role(role_id: str, body: RoleUpdate, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "role_management:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    roles = _ensure_roles()
    for i, r in enumerate(roles):
        if str(r.get("id")) == str(role_id):
            if body.name is not None:
                roles[i]["name"] = body.name.strip()
            if body.permissions is not None:
                roles[i]["permissions"] = list(body.permissions)
            write_json("roles", roles)
            return roles[i]
    raise HTTPException(status_code=404, detail="Role not found")


@router.delete("/{role_id}")
def delete_role(role_id: str, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "role_management:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    roles = _ensure_roles()
    for i, r in enumerate(roles):
        if str(r.get("id")) == str(role_id):
            roles.pop(i)
            write_json("roles", roles)
            return {"deleted": role_id}
    raise HTTPException(status_code=404, detail="Role not found")
