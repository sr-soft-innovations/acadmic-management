"""Role & permission matrix. Resolved from roles.json with fallback to static ROLE_PERMISSIONS.
Supports: read (View), add (Add), edit (Edit), delete (Delete). write implies add+edit+delete."""

from app.db import read_json
from app.modules import WRITE_IMPLIES


def _expand_write_permissions(perms: list[str]) -> list[str]:
    """Expand module:write to module:add, module:edit, module:delete for resolution."""
    out = list(perms)
    for p in perms:
        if p and p.endswith(":write"):
            prefix = p[:-6]  # remove ":write"
            for action in WRITE_IMPLIES:
                expanded = f"{prefix}:{action}"
                if expanded not in out:
                    out.append(expanded)
    return out


# Fallback when roles.json is empty or role not in file
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "super_admin": ["*"],
    "admin": [
        "dashboard:read", "students:read", "students:write", "staff:read", "staff:write",
        "courses:read", "courses:write", "departments:read", "departments:write",
        "attendance:read", "attendance:write", "reports:read", "fees:read", "fees:add", "fees:edit",
        "analytics:read", "approvals:read", "approvals:write",
        "audit:read", "sessions:read", "sessions:write", "users:read", "users:write",
        "scholarship:read", "scholarship:add", "scholarship:edit",
    ],
    "principal": [
        "dashboard:read", "students:read", "students:write", "staff:read", "staff:write",
        "courses:read", "courses:write", "attendance:read", "attendance:write",
        "reports:read", "fees:read", "analytics:read", "approvals:read",
        "audit:read", "sessions:read", "role_management:read",
    ],
    "hod": [
        "dashboard:read", "students:read", "staff:read", "courses:read", "courses:write",
        "attendance:read", "attendance:write", "reports:read", "fees:read", "analytics:read", "audit:read",
    ],
    "staff": [
        "dashboard:read", "students:read", "courses:read", "attendance:read", "attendance:write",
        "academic:read", "academic:add", "notice:read", "notice:add", "messaging:read", "messaging:add",
    ],
    "faculty": [
        "dashboard:read", "students:read", "courses:read", "attendance:read", "attendance:write",
        "academic:read", "academic:add", "notice:read", "notice:add", "messaging:read", "messaging:add",
    ],
    "student": ["dashboard:read", "attendance:read", "student_portal:read", "certificates:read"],
    "parent": ["dashboard:read", "attendance:read", "parent_portal:read"],
    "librarian": [
        "dashboard:read", "courses:read", "reports:read",
    ],
    "lab_assistant": [
        "dashboard:read", "courses:read", "attendance:read", "attendance:write",
    ],
    "non_teaching_staff": [
        "dashboard:read", "attendance:read",
    ],
    "hospital_mentor": [
        "dashboard:read", "students:read", "attendance:read",
    ],
    "guest_faculty": [
        "dashboard:read", "students:read", "courses:read", "attendance:read",
    ],
}


def get_role_permissions(role: str | None) -> list[str]:
    """Resolve permissions for role from roles.json, else ROLE_PERMISSIONS. Expands write to add/edit/delete."""
    if not role:
        return []
    roles = read_json("roles")
    for r in roles:
        if (r.get("slug") or "").lower() == role.lower():
            perms = list(r.get("permissions") or [])
            return _expand_write_permissions(perms)
    base = list(ROLE_PERMISSIONS.get(role, []))
    return _expand_write_permissions(base)


def get_permissions_matrix() -> dict[str, list[str]]:
    """Full matrix: role slug -> list of permissions (from roles.json + fallback)."""
    roles = read_json("roles")
    matrix = {}
    if roles:
        for r in roles:
            matrix[r.get("slug") or ""] = list(r.get("permissions") or [])
    for role, perms in ROLE_PERMISSIONS.items():
        if role not in matrix:
            matrix[role] = list(perms)
    return matrix


def has_permission(role: str | None, permission: str) -> bool:
    """Check if role has permission. write implies add/edit/delete; write check accepts add|edit|delete."""
    if not role:
        return False
    perms = get_role_permissions(role)
    if "*" in perms:
        return True
    if permission in perms:
        return True
    # Check write implies: e.g. students:add is granted by students:write (roles.json may have write)
    if ":" in permission:
        prefix, action = permission.rsplit(":", 1)
        if action in WRITE_IMPLIES:
            # Original perms (before expansion) - check roles.json. write grants add/edit/delete.
            raw = _get_raw_role_permissions(role)
            if f"{prefix}:write" in raw:
                return True
        if action == "write":
            # Checking module:write - accept if role has any of add/edit/delete
            for a in WRITE_IMPLIES:
                if f"{prefix}:{a}" in perms:
                    return True
    return False


def _get_raw_role_permissions(role: str | None) -> list[str]:
    """Raw permissions without write expansion (for has_permission logic)."""
    if not role:
        return []
    roles = read_json("roles")
    for r in roles:
        if (r.get("slug") or "").lower() == role.lower():
            return list(r.get("permissions") or [])
    return list(ROLE_PERMISSIONS.get(role, []))
