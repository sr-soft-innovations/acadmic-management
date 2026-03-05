"""JSON file-based database layer for G.P. College of Pharmacy."""
import json
import os
import tempfile
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent / "data"


def _path(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def read_json(name: str) -> list[dict[str, Any]]:
    """Read a JSON list from data/{name}.json. Returns [] if file missing or invalid."""
    p = _path(name)
    if not p.exists():
        return []
    try:
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def write_json(name: str, data: list[dict[str, Any]]) -> None:
    """Write a list to data/{name}.json. Atomic write (temp + rename) to avoid corruption."""
    os.makedirs(DATA_DIR, exist_ok=True)
    payload = data if isinstance(data, list) else []
    p = _path(name)
    fd, tmp = tempfile.mkstemp(dir=DATA_DIR, prefix=".tmp_", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        os.replace(tmp, p)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def next_id(name: str) -> str:
    """Generate next numeric ID for a collection."""
    items = read_json(name)
    if not items:
        return "1"
    ids = []
    for item in items:
        try:
            ids.append(int(item.get("id", 0)))
        except (ValueError, TypeError):
            pass
    return str(max(ids, default=0) + 1)


def append_audit(entry: dict[str, Any]) -> None:
    """Append one audit log entry to data/audit.json (one JSON object per line for easy append)."""
    os.makedirs(DATA_DIR, exist_ok=True)
    p = _path("audit")
    with open(p, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_audit(limit: int = 500) -> list[dict[str, Any]]:
    """Read last `limit` audit entries (newest first)."""
    p = _path("audit")
    if not p.exists():
        return []
    lines = []
    with open(p, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    lines.append(json.loads(line))
                except Exception:
                    pass
    return list(reversed(lines[-limit:]))
