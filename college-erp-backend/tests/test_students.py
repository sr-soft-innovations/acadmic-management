"""Students CRUD."""
import pytest
from fastapi.testclient import TestClient


def test_list_students_empty(client: TestClient, auth_headers: dict):
    """GET /api/students returns list (empty when no data)."""
    resp = client.get("/api/students", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_student(client: TestClient, auth_headers: dict):
    """POST /api/students creates a student and returns it."""
    body = {
        "name": "Test Student",
        "roll_no": "R001",
        "course": "B.Pharm",
        "semester": "1",
        "email": "test@example.com",
    }
    resp = client.post("/api/students", json=body, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("name") == "Test Student"
    assert data.get("roll_no") == "R001"
    assert data.get("id")


def test_get_student(client: TestClient, auth_headers: dict):
    """GET /api/students/{id} returns the student."""
    # Create first
    create_resp = client.post(
        "/api/students",
        json={"name": "Get Test", "roll_no": "R002", "course": "B.Pharm"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200
    sid = create_resp.json()["id"]

    resp = client.get(f"/api/students/{sid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Get Test"
    assert resp.json()["id"] == sid


def test_get_student_not_found(client: TestClient, auth_headers: dict):
    """GET /api/students/99999 returns 404."""
    resp = client.get("/api/students/99999", headers=auth_headers)
    assert resp.status_code == 404


def test_update_student(client: TestClient, auth_headers: dict):
    """PUT /api/students/{id} updates the student."""
    create_resp = client.post(
        "/api/students",
        json={"name": "Update Test", "roll_no": "R003", "course": "B.Pharm"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200
    sid = create_resp.json()["id"]

    resp = client.put(
        f"/api/students/{sid}",
        json={"name": "Updated Name", "semester": "2"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"
    assert resp.json()["semester"] == "2"


def test_delete_student(client: TestClient, auth_headers: dict):
    """DELETE /api/students/{id} removes the student."""
    create_resp = client.post(
        "/api/students",
        json={"name": "Delete Test", "roll_no": "R004"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200
    sid = create_resp.json()["id"]

    resp = client.delete(f"/api/students/{sid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json().get("deleted") == sid

    get_resp = client.get(f"/api/students/{sid}", headers=auth_headers)
    assert get_resp.status_code == 404
