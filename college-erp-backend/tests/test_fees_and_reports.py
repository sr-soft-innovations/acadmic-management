"""Fees (list, create, analytics) and report summary."""
import pytest
from fastapi.testclient import TestClient


def test_fees_list_empty(client: TestClient, auth_headers: dict):
    """GET /api/fees returns list of fee collections."""
    resp = client.get("/api/fees", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_fees_analytics(client: TestClient, auth_headers: dict):
    """GET /api/fees/analytics returns totals and breakdowns."""
    resp = client.get("/api/fees/analytics", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_collected" in data
    assert "transaction_count" in data
    assert "by_course" in data
    assert "recent_collections" in data


def test_fees_create_collection(client: TestClient, auth_headers: dict):
    """POST /api/fees creates a fee collection."""
    body = {
        "student_id": "1",
        "student_name": "Fee Test",
        "roll_no": "R101",
        "course": "B.Pharm",
        "semester": "1",
        "amount": 5000.0,
        "fee_type": "tuition",
        "receipt_no": "REC001",
    }
    resp = client.post("/api/fees", json=body, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("amount") == 5000.0
    assert data.get("student_id") == "1"
    assert data.get("id")


def test_reports_summary(client: TestClient, auth_headers: dict):
    """GET /api/reports/summary returns high-level report metrics."""
    resp = client.get("/api/reports/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "students" in data
    assert "staff" in data
    assert "fee_total_collected" in data
    assert "exams_total" in data
    assert "pending_approvals_count" in data
    assert isinstance(data["students"], int)
    assert isinstance(data["fee_total_collected"], (int, float))
