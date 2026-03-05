"""Pytest fixtures for G.P. College of Pharmacy API tests. Uses a temporary data directory."""
import json
import pytest
from pathlib import Path

from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def use_tmp_data_dir(monkeypatch, tmp_path):
    """Point app.db at a temporary directory so tests don't touch real data."""
    monkeypatch.setattr("app.db.DATA_DIR", tmp_path)
    yield tmp_path


def _hash_password(plain: str) -> str:
    """Hash password for test user (mirrors auth router)."""
    try:
        import bcrypt
        return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    except Exception:
        return plain


@pytest.fixture
def client():
    """Test client for the FastAPI app."""
    from app.main import app
    return TestClient(app)


@pytest.fixture
def auth_headers(use_tmp_data_dir, client):
    """Create test user + session and return headers with X-Session-Id (avoids login mutation)."""
    tmp_path = use_tmp_data_dir
    users = [{
        "id": "1",
        "username": "admin",
        "password": _hash_password("admin123"),
        "role": "super_admin",
        "name": "Admin",
        "email": "admin@test.com",
        "phone": "",
        "failed_attempts": 0,
        "locked_until": None,
        "photo_filename": "",
        "is_enabled": True,
    }]
    sessions = [{
        "id": "test-session-123",
        "user_id": "1",
        "device_id": "",
        "device_info": "",
        "created_at": "2025-01-01T00:00:00Z",
        "expires_at": "2099-01-01T00:00:00Z"
    }]
    (tmp_path / "users.json").write_text(json.dumps(users, indent=2), encoding="utf-8")
    (tmp_path / "sessions.json").write_text(json.dumps(sessions, indent=2), encoding="utf-8")
    return {"X-Session-Id": "test-session-123"}