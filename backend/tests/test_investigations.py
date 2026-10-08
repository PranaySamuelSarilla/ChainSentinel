"""
ChainSentinel - Phase 4A & 4B-1 Investigation Workflow Tests

Tests case creation, retrieval, listing, status updates, note edits,
persistence, validation errors, 404 responses, and aggregated case summaries.

Run with:
    pytest backend/tests/test_investigations.py -v
"""

import pytest
from starlette.testclient import TestClient

from backend.main import app, _ALL_ALERTS, DATASET
from backend.investigations.models import CaseStatus, generate_case_id
from backend.investigations.store import CASE_STORE, InvestigationCaseStore


@pytest.fixture(autouse=True)
def clean_case_store():
    """Ensure clean case store state before each test."""
    CASE_STORE.clear()
    yield
    CASE_STORE.clear()


@pytest.fixture
def client():
    return TestClient(app)


# ──────────────────────────────────────────────────────────────────
# Unit Tests: Models & Store
# ──────────────────────────────────────────────────────────────────

def test_generate_case_id_format():
    """Case ID must follow format 'CASE-<hex chars>'."""
    case_id = generate_case_id("0x1234567890abcdef", "2026-10-08T12:00:00+00:00")
    assert case_id.startswith("CASE-")
    assert len(case_id) == 13  # "CASE-" (5) + 8 hex chars = 13


def test_generate_case_id_uniqueness():
    """Rapid invocations with same parameters produce unique case IDs."""
    id1 = generate_case_id("0x1234", "2026-10-08T12:00:00+00:00")
    id2 = generate_case_id("0x1234", "2026-10-08T12:00:00+00:00")
    assert id1 != id2


def test_store_crud_lifecycle():
    """Verify internal store methods: create, get, update_status, update_notes, list_all."""
    store = InvestigationCaseStore()
    store.clear()

    from backend.investigations.models import InvestigationCase
    case = InvestigationCase(
        case_id="CASE-test001",
        title="Test Investigation",
        target_wallet="0xTargetWallet123",
        status=CaseStatus.OPEN,
        notes="Initial suspicion",
        alert_ids=["alert_1", "alert_2"],
        related_wallets=["0xRelatedWallet456"],
        created_at="2026-10-08T10:00:00+00:00",
        updated_at="2026-10-08T10:00:00+00:00",
    )
    store.create(case)
    assert store.count() == 1
    assert store.get("CASE-test001") is not None

    # Duplicate create raises ValueError
    with pytest.raises(ValueError):
        store.create(case)

    # Update status
    updated = store.update_status("CASE-test001", CaseStatus.CLOSED)
    assert updated.status == CaseStatus.CLOSED

    # Update notes
    updated_notes = store.update_notes("CASE-test001", "Updated observation")
    assert updated_notes.notes == "Updated observation"

    # List all
    all_cases = store.list_all()
    assert len(all_cases) == 1

    # Cleanup
    store.clear()


# ──────────────────────────────────────────────────────────────────
# API Endpoint Tests
# ──────────────────────────────────────────────────────────────────

def test_create_investigation_success(client):
    """POST /investigations successfully creates a case."""
    payload = {
        "title": "Layering Investigation W1",
        "target_wallet": "0x71C8366420A85E1A0F9b123D377De304559B0975",
        "notes": "Suspected origin of circular transaction pattern.",
        "alert_ids": ["alert_circ_01"],
        "related_wallets": ["0x3a4b95d082E484d84f86f77b7389c9d4E00b144F"],
    }
    response = client.post("/investigations", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["case_id"].startswith("CASE-")
    assert data["title"] == payload["title"]
    assert data["target_wallet"] == payload["target_wallet"]
    assert data["status"] == CaseStatus.OPEN
    assert data["notes"] == payload["notes"]
    assert data["alert_ids"] == ["alert_circ_01"]
    assert len(data["related_wallets"]) == 1
    assert "created_at" in data
    assert "updated_at" in data


def test_create_investigation_minimal(client):
    """POST /investigations succeeds with only title and target_wallet."""
    payload = {
        "title": "Quick Triage",
        "target_wallet": "0x981C30E3259838B4268e64cCE608aC68fD573c88",
    }
    response = client.post("/investigations", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["notes"] == ""
    assert data["alert_ids"] == []
    assert data["related_wallets"] == []
    assert data["status"] == "OPEN"


def test_create_investigation_empty_title_fails(client):
    """POST /investigations fails when title is whitespace or empty."""
    payload = {
        "title": "   ",
        "target_wallet": "0x981C30E3259838B4268e64cCE608aC68fD573c88",
    }
    response = client.post("/investigations", json=payload)
    assert response.status_code == 400
    assert "title" in response.json()["detail"].lower()


def test_create_investigation_empty_wallet_fails(client):
    """POST /investigations fails when target_wallet is whitespace or empty."""
    payload = {
        "title": "Valid Title",
        "target_wallet": "",
    }
    response = client.post("/investigations", json=payload)
    assert response.status_code == 400
    assert "target_wallet" in response.json()["detail"].lower()


def test_create_investigation_missing_fields_fails(client):
    """POST /investigations fails with 422 if required keys are missing entirely."""
    response = client.post("/investigations", json={"title": "Missing Wallet"})
    assert response.status_code == 422


def test_get_investigation_by_id(client):
    """GET /investigations/{case_id} retrieves the created case."""
    create_res = client.post("/investigations", json={
        "title": "Case Retrieve Test",
        "target_wallet": "0x1111222233334444555566667777888899990000",
    })
    case_id = create_res.json()["case_id"]

    get_res = client.get(f"/investigations/{case_id}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["case_id"] == case_id
    assert data["title"] == "Case Retrieve Test"


def test_get_investigation_not_found(client):
    """GET /investigations/{case_id} returns 404 for nonexistent case."""
    response = client.get("/investigations/CASE-nonexistent")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_list_investigations_and_filter_status(client):
    """GET /investigations returns all cases and filters by status."""
    c1 = client.post("/investigations", json={"title": "Case 1", "target_wallet": "0xW1"}).json()
    c2 = client.post("/investigations", json={"title": "Case 2", "target_wallet": "0xW2"}).json()
    c3 = client.post("/investigations", json={"title": "Case 3", "target_wallet": "0xW3"}).json()

    # Close case 2
    client.patch(f"/investigations/{c2['case_id']}/status", json={"status": "CLOSED"})

    # List all
    all_res = client.get("/investigations")
    assert all_res.status_code == 200
    assert all_res.json()["total"] == 3

    # Filter OPEN
    open_res = client.get("/investigations?status=OPEN")
    assert open_res.status_code == 200
    assert open_res.json()["total"] == 2
    for c in open_res.json()["investigations"]:
        assert c["status"] == "OPEN"

    # Filter CLOSED
    closed_res = client.get("/investigations?status=CLOSED")
    assert closed_res.status_code == 200
    assert closed_res.json()["total"] == 1
    assert closed_res.json()["investigations"][0]["case_id"] == c2["case_id"]


def test_update_investigation_status(client):
    """PATCH /investigations/{case_id}/status updates case status to CLOSED then OPEN."""
    c = client.post("/investigations", json={"title": "Status Test", "target_wallet": "0xW1"}).json()
    case_id = c["case_id"]

    # Close
    res_close = client.patch(f"/investigations/{case_id}/status", json={"status": "CLOSED"})
    assert res_close.status_code == 200
    assert res_close.json()["status"] == "CLOSED"

    # Re-open (case-insensitive)
    res_open = client.patch(f"/investigations/{case_id}/status", json={"status": "open"})
    assert res_open.status_code == 200
    assert res_open.json()["status"] == "OPEN"


def test_update_investigation_status_invalid(client):
    """PATCH /investigations/{case_id}/status returns 400 for invalid status string."""
    c = client.post("/investigations", json={"title": "Invalid Status", "target_wallet": "0xW1"}).json()
    case_id = c["case_id"]

    response = client.patch(f"/investigations/{case_id}/status", json={"status": "PENDING"})
    assert response.status_code == 400
    assert "must be open or closed" in response.json()["detail"].lower()


def test_update_investigation_status_not_found(client):
    """PATCH /investigations/{case_id}/status returns 404 for nonexistent case."""
    response = client.patch("/investigations/CASE-fake/status", json={"status": "CLOSED"})
    assert response.status_code == 404


def test_update_investigation_notes(client):
    """PATCH /investigations/{case_id}/notes updates analyst notes."""
    c = client.post("/investigations", json={"title": "Notes Test", "target_wallet": "0xW1"}).json()
    case_id = c["case_id"]

    update_res = client.patch(f"/investigations/{case_id}/notes", json={
        "notes": "Verified off-chain entity linked to exchange deposit."
    })
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["notes"] == "Verified off-chain entity linked to exchange deposit."
    assert data["updated_at"] >= data["created_at"]


def test_update_investigation_notes_not_found(client):
    """PATCH /investigations/{case_id}/notes returns 404 for nonexistent case."""
    response = client.patch("/investigations/CASE-fake/notes", json={"notes": "Some notes"})
    assert response.status_code == 404


def test_investigation_json_persistence(client):
    """Test that cases reload from disk store cleanly."""
    c = client.post("/investigations", json={
        "title": "Persistence Test Case",
        "target_wallet": "0xPersistWallet",
        "notes": "Testing disk reload",
    }).json()
    case_id = c["case_id"]

    # Re-instantiate store to test loading from disk
    new_store = InvestigationCaseStore()
    loaded_case = new_store.get(case_id)
    assert loaded_case is not None
    assert loaded_case.title == "Persistence Test Case"
    assert loaded_case.notes == "Testing disk reload"


# ──────────────────────────────────────────────────────────────────
# Phase 4B-1: Summary Endpoint Tests
# ──────────────────────────────────────────────────────────────────

def test_investigation_summary_success(client):
    """GET /investigations/{case_id}/summary returns full aggregated forensic summary."""
    target_wallet = DATASET[0]["from_wallet"]
    sample_alert = _ALL_ALERTS[0]
    related_wallet = DATASET[1]["to_wallet"]

    create_res = client.post("/investigations", json={
        "title": "Summary Aggregation Test",
        "target_wallet": target_wallet,
        "notes": "Analyst examining target wallet flow.",
        "alert_ids": [sample_alert.alert_id],
        "related_wallets": [related_wallet],
    })
    assert create_res.status_code == 201
    case_id = create_res.json()["case_id"]

    res = client.get(f"/investigations/{case_id}/summary")
    assert res.status_code == 200
    data = res.json()

    # 1. Case object
    assert "case" in data
    assert data["case"]["case_id"] == case_id
    assert data["case"]["target_wallet"] == target_wallet

    # 2. Target wallet risk
    assert "target_wallet_risk" in data
    assert data["target_wallet_risk"]["wallet_id"] == target_wallet
    assert "risk_score" in data["target_wallet_risk"]
    assert "risk_level" in data["target_wallet_risk"]
    assert "pattern_types" in data["target_wallet_risk"]

    # 3. Resolved alerts
    assert "resolved_alerts" in data
    assert len(data["resolved_alerts"]) == 1
    assert data["resolved_alerts"][0]["alert_id"] == sample_alert.alert_id
    assert "explanation" in data["resolved_alerts"][0]

    # 4. Target wallet transactions
    assert "wallet_transactions" in data
    assert isinstance(data["wallet_transactions"], list)
    assert len(data["wallet_transactions"]) >= 1
    for tx in data["wallet_transactions"]:
        assert tx["from_wallet"] == target_wallet or tx["to_wallet"] == target_wallet

    # 5. Related wallet risks
    assert "related_wallet_risks" in data
    assert related_wallet in data["related_wallet_risks"]
    assert data["related_wallet_risks"][related_wallet]["wallet_id"] == related_wallet
    assert "risk_score" in data["related_wallet_risks"][related_wallet]
    assert "risk_level" in data["related_wallet_risks"][related_wallet]


def test_investigation_summary_not_found(client):
    """GET /investigations/{case_id}/summary returns 404 for nonexistent case."""
    res = client.get("/investigations/CASE-nonexistent/summary")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_investigation_summary_empty_links(client):
    """GET /investigations/{case_id}/summary succeeds when case has no alerts or related wallets."""
    create_res = client.post("/investigations", json={
        "title": "Minimal Case Summary",
        "target_wallet": DATASET[0]["from_wallet"],
    })
    case_id = create_res.json()["case_id"]

    res = client.get(f"/investigations/{case_id}/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["resolved_alerts"] == []
    assert data["related_wallet_risks"] == {}
    assert len(data["wallet_transactions"]) >= 1


def test_investigation_summary_unknown_alert_id_handled(client):
    """GET /investigations/{case_id}/summary gracefully handles unknown alert IDs."""
    create_res = client.post("/investigations", json={
        "title": "Unknown Alert ID Case",
        "target_wallet": "0xTargetUnknown",
        "alert_ids": ["NON_EXISTENT_ALERT_12345"],
    })
    case_id = create_res.json()["case_id"]

    res = client.get(f"/investigations/{case_id}/summary")
    assert res.status_code == 200
    data = res.json()
    # Unknown alert ID is safely filtered out
    assert data["resolved_alerts"] == []
    # Target with no transactions has empty list and clean LOW risk
    assert data["wallet_transactions"] == []
    assert data["target_wallet_risk"]["risk_score"] == 0
    assert data["target_wallet_risk"]["risk_level"] == "LOW"


def test_investigation_summary_multiple_related_wallets(client):
    """GET /investigations/{case_id}/summary correctly computes risks for multiple related wallets."""
    create_res = client.post("/investigations", json={
        "title": "Multiple Related Wallets Case",
        "target_wallet": "0xW1",
        "related_wallets": ["0xRelA", "0xRelB", "0xRelC"],
    })
    case_id = create_res.json()["case_id"]

    res = client.get(f"/investigations/{case_id}/summary")
    assert res.status_code == 200
    data = res.json()
    assert set(data["related_wallet_risks"].keys()) == {"0xRelA", "0xRelB", "0xRelC"}
    for w in ["0xRelA", "0xRelB", "0xRelC"]:
        assert data["related_wallet_risks"][w]["wallet_id"] == w
        assert "risk_score" in data["related_wallet_risks"][w]
        assert "risk_level" in data["related_wallet_risks"][w]
