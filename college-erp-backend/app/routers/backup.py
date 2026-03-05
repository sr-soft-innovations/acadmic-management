"""Backup and restore for JSON data and uploads."""
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.db import DATA_DIR, read_audit, read_json, write_json
from app.permissions import has_permission
from app.routers.auth import _get_current_user

router = APIRouter()

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "data" / "user_photos"
JSON_ENTITIES = [
    "users", "students", "staff", "courses", "attendance", "fee_collections", "fee_structure",
    "exams", "approvals", "sessions", "otps", "semesters", "subject_faculty", "timetable",
    "marks", "admission_applications", "roles", "departments", "assignments", "assignment_submissions",
    "notices", "inspections", "calendar", "timetable_holidays",
]


def _read_json_safe(name: str):
    """Read JSON - handle both list and dict."""
    p = DATA_DIR / f"{name}.json"
    if not p.exists():
        return []
    try:
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else [data]
    except (json.JSONDecodeError, OSError):
        return []


@router.get("/export")
def export_backup(current: dict = Depends(_get_current_user)):
    """Export all data as ZIP. Super Admin / role_management:write only."""
    if not has_permission(current.get("role"), "role_management:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in JSON_ENTITIES:
            data = _read_json_safe(name)
            if data:
                zf.writestr(f"data/{name}.json", json.dumps(data, indent=2, ensure_ascii=False))
        audit_data = read_audit(limit=10000)
        if audit_data:
            zf.writestr("data/audit.json", json.dumps(audit_data, indent=2, ensure_ascii=False))
        if UPLOADS_DIR.exists():
            for f in UPLOADS_DIR.iterdir():
                if f.is_file():
                    zf.write(f, f"uploads/{f.name}")
        zf.writestr("manifest.json", json.dumps({
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "entities": JSON_ENTITIES + ["audit"],
        }, indent=2))
    buf.seek(0)
    fn = f"backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={fn}"},
    )


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...), current: dict = Depends(_get_current_user)):
    """Restore from backup ZIP. Super Admin only. Overwrites existing data."""
    if not has_permission(current.get("role"), "role_management:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    fn = (file.filename or "").lower()
    if not fn.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip backup files allowed.")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB).")
    restored = []
    try:
        with zipfile.ZipFile(io.BytesIO(content), "r") as zf:
            for name in zf.namelist():
                if name.startswith("data/") and name.endswith(".json"):
                    entity = name[5:-5]
                    raw = zf.read(name).decode("utf-8")
                    data = json.loads(raw)
                    if isinstance(data, list):
                        if entity == "audit":
                            p = DATA_DIR / "audit.json"
                            DATA_DIR.mkdir(parents=True, exist_ok=True)
                            with open(p, "w", encoding="utf-8") as f:
                                for line in data:
                                    f.write(json.dumps(line, ensure_ascii=False) + "\n")
                        else:
                            write_json(entity, data)
                        restored.append(entity)
                elif name.startswith("uploads/") and "/" not in name[8:]:
                    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
                    dest = UPLOADS_DIR / Path(name).name
                    dest.write_bytes(zf.read(name))
                    restored.append(f"upload:{Path(name).name}")
    except (zipfile.BadZipFile, json.JSONDecodeError, OSError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid backup file: {e}")
    return {"restored": restored, "message": f"Restored {len(restored)} items."}
