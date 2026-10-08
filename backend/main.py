"""
ChainSentinel - Backend API
FastAPI service providing blockchain forensics endpoints,
transaction exploration, pattern detection, and risk assessment.

Endpoints:
  Phase 1/2 (existing, preserved):
    GET /health
    GET /api/info
    GET /transactions
    GET /transactions/{tx_id}

  Phase 3 (detection engine):
    GET /alerts
    GET /alerts/{alert_id}
    GET /wallets/{wallet_id}/risk
    GET /wallets/{wallet_id}/alerts
    GET /wallets/{wallet_id}/transactions
    GET /graph/{wallet_id}
    GET /detection/summary

  Phase 4A (investigation workflow):
    POST /investigations
    GET  /investigations
    GET  /investigations/{case_id}
    PATCH /investigations/{case_id}/status
    PATCH /investigations/{case_id}/notes

  Phase 4B-1 (investigation summary):
    GET  /investigations/{case_id}/summary

  Phase 4B-2 (investigation graph):
    GET  /investigations/{case_id}/graph
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from backend.data.loader import load_transactions, get_dataset_stats
    from backend.detection.engine import DetectionEngine
    from backend.investigations.models import InvestigationCase, CaseStatus, generate_case_id
    from backend.investigations.store import CASE_STORE
except (ImportError, ModuleNotFoundError):
    from data.loader import load_transactions, get_dataset_stats
    from detection.engine import DetectionEngine
    from investigations.models import InvestigationCase, CaseStatus, generate_case_id
    from investigations.store import CASE_STORE

app = FastAPI(
    title="ChainSentinel API",
    description="Forensic investigation and graph analytics API for blockchain transactions",
    version="0.2.0",
)

# Enable CORS for local Vite development and cross-origin access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────────
# Application startup — load data and run detection engine once
# ──────────────────────────────────────────────────────────────────
DATASET = load_transactions()
STATS = get_dataset_stats(DATASET)
ENGINE = DetectionEngine(DATASET)

# Pre-warm the engine cache at startup (runs all detectors once)
_ALL_ALERTS = ENGINE.detect_all()
_ALERTS_BY_ID = {a.alert_id: a for a in _ALL_ALERTS}


# ──────────────────────────────────────────────────────────────────
# Response Models
# ──────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    message: str
    version: str


class CreateInvestigationRequest(BaseModel):
    title: str
    target_wallet: str
    notes: Optional[str] = ""
    alert_ids: Optional[List[str]] = []
    related_wallets: Optional[List[str]] = []


class UpdateCaseStatusRequest(BaseModel):
    status: str


class UpdateCaseNotesRequest(BaseModel):
    notes: str


# ──────────────────────────────────────────────────────────────────
# Phase 1 & 2 Endpoints (preserved, unchanged)
# ──────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint for platform monitoring."""
    return {
        "status": "ok",
        "message": "ChainSentinel Backend Engine Operational",
        "version": "0.2.0",
    }


@app.get("/api/info")
def dataset_info():
    """Returns dataset summary statistics and category breakdown."""
    return STATS


@app.get("/transactions")
def list_transactions(
    category: Optional[str] = Query(None, description="Filter by category (e.g., circular, burst, normal)"),
    wallet: Optional[str] = Query(None, description="Filter by wallet address (from or to)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Retrieve simulated blockchain transactions with filtering options."""
    txs = DATASET

    if category:
        txs = [t for t in txs if t["category_label"].lower() == category.lower()]

    if wallet:
        target = wallet.lower()
        txs = [t for t in txs if t["from_wallet"].lower() == target or t["to_wallet"].lower() == target]

    total = len(txs)
    paginated = txs[offset: offset + limit]

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "transactions": paginated,
    }


@app.get("/transactions/{tx_id}")
def get_transaction(tx_id: str):
    """Retrieve single transaction details by transaction hash."""
    target_id = tx_id.lower()
    for tx in DATASET:
        if tx["tx_id"].lower() == target_id:
            return tx

    raise HTTPException(status_code=404, detail=f"Transaction {tx_id} not found")


# ──────────────────────────────────────────────────────────────────
# Phase 3 Endpoints — Detection Engine
# ──────────────────────────────────────────────────────────────────

@app.get("/alerts")
def list_alerts(
    pattern: Optional[str] = Query(None, description="Filter by pattern type (e.g., CIRCULAR_TRANSACTION)"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    wallet: Optional[str] = Query(None, description="Filter alerts containing this wallet"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    List all detected suspicious activity alerts.
    Supports filtering by pattern type, severity level, and wallet address.
    """
    alerts = _ALL_ALERTS

    if pattern:
        alerts = [a for a in alerts if a.pattern.upper() == pattern.upper()]

    if severity:
        alerts = [a for a in alerts if a.severity.upper() == severity.upper()]

    if wallet:
        alerts = [a for a in alerts if wallet in a.wallets]

    total = len(alerts)
    paginated = alerts[offset: offset + limit]

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "alerts": [a.to_dict() for a in paginated],
    }


@app.get("/alerts/{alert_id}")
def get_alert(alert_id: str):
    """Retrieve a single alert by its unique alert_id."""
    for alert in _ALL_ALERTS:
        if alert.alert_id == alert_id:
            return alert.to_dict()
    raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")


@app.get("/wallets/{wallet_id}/risk")
def get_wallet_risk(wallet_id: str):
    """
    Return the risk assessment (score, level, pattern types) for a wallet.
    Score is computed from the additive weight of all detected pattern types.
    """
    risk = ENGINE.get_wallet_risk(wallet_id)
    return risk.to_dict()


@app.get("/wallets/{wallet_id}/alerts")
def get_wallet_alerts(wallet_id: str):
    """Return all alerts that involve the specified wallet address."""
    alerts = ENGINE.detect_for_wallet(wallet_id)
    return {
        "wallet_id": wallet_id,
        "total": len(alerts),
        "alerts": [a.to_dict() for a in alerts],
    }


@app.get("/wallets/{wallet_id}/transactions")
def get_wallet_transactions(
    wallet_id: str,
    limit: int = Query(50, ge=1, le=200),
):
    """Return all transactions (inbound + outbound) for a wallet."""
    txs = [
        t for t in DATASET
        if t["from_wallet"] == wallet_id or t["to_wallet"] == wallet_id
    ]
    return {
        "wallet_id": wallet_id,
        "total": len(txs),
        "transactions": txs[:limit],
    }


@app.get("/graph/{wallet_id}")
def get_wallet_graph(
    wallet_id: str,
    depth: int = Query(2, ge=1, le=3, description="Hop depth for graph expansion"),
):
    """
    Return Cytoscape-compatible graph data (nodes + edges) for a wallet
    and its neighbourhood up to `depth` hops.
    """
    return ENGINE.get_wallet_graph(wallet_id, depth=depth)


@app.get("/detection/summary")
def get_detection_summary():
    """
    Return a high-level summary of all detection results:
    total alerts, breakdown by pattern and severity.
    """
    summary = ENGINE.get_summary()
    return summary.to_dict()


# ──────────────────────────────────────────────────────────────────
# Phase 4A Endpoints — Investigation Workflow
# ──────────────────────────────────────────────────────────────────

@app.post("/investigations", status_code=201)
def create_investigation(payload: CreateInvestigationRequest):
    """
    Create a new investigation case.
    Validates required fields, generates a unique deterministic case ID,
    and stores the case in the investigation repository.
    """
    title = payload.title.strip() if payload.title else ""
    target_wallet = payload.target_wallet.strip() if payload.target_wallet else ""

    if not title:
        raise HTTPException(status_code=400, detail="title cannot be empty")
    if not target_wallet:
        raise HTTPException(status_code=400, detail="target_wallet cannot be empty")

    now_iso = datetime.now(timezone.utc).isoformat()
    case_id = generate_case_id(target_wallet, now_iso)

    case = InvestigationCase(
        case_id=case_id,
        title=title,
        target_wallet=target_wallet,
        status=CaseStatus.OPEN,
        notes=payload.notes.strip() if payload.notes else "",
        alert_ids=payload.alert_ids or [],
        related_wallets=payload.related_wallets or [],
        created_at=now_iso,
        updated_at=now_iso,
    )

    try:
        saved_case = CASE_STORE.create(case)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return saved_case.to_dict()


@app.get("/investigations")
def list_investigations(
    status: Optional[str] = Query(None, description="Filter by status (OPEN, CLOSED)"),
):
    """
    List all investigation cases, ordered newest first.
    Optionally filter by status.
    """
    cases = CASE_STORE.list_all()
    if status:
        norm_status = status.strip().upper()
        cases = [c for c in cases if c.status == norm_status]

    return {
        "total": len(cases),
        "investigations": [c.to_dict() for c in cases],
    }


@app.get("/investigations/{case_id}")
def get_investigation(case_id: str):
    """Retrieve details for a single investigation case by its case_id."""
    case = CASE_STORE.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Investigation case '{case_id}' not found")
    return case.to_dict()


@app.patch("/investigations/{case_id}/status")
def update_investigation_status(case_id: str, payload: UpdateCaseStatusRequest):
    """Update the status of an investigation case (OPEN or CLOSED)."""
    norm_status = payload.status.strip().upper() if payload.status else ""
    if norm_status not in (CaseStatus.OPEN, CaseStatus.CLOSED):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Status must be OPEN or CLOSED.",
        )

    case = CASE_STORE.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Investigation case '{case_id}' not found")

    updated = CASE_STORE.update_status(case_id, norm_status)
    return updated.to_dict()


@app.patch("/investigations/{case_id}/notes")
def update_investigation_notes(case_id: str, payload: UpdateCaseNotesRequest):
    """Update analyst notes for an investigation case."""
    case = CASE_STORE.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Investigation case '{case_id}' not found")

    updated = CASE_STORE.update_notes(case_id, payload.notes)
    return updated.to_dict()


@app.get("/investigations/{case_id}/summary")
def get_investigation_summary(case_id: str):
    """
    Retrieve comprehensive forensic investigation summary for a case.
    Aggregates case metadata, resolved alert objects, target wallet risk assessment,
    inbound and outbound transactions for the target wallet, and risk assessments
    for any tagged related wallets.
    """
    case = CASE_STORE.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Investigation case '{case_id}' not found")

    target_risk = ENGINE.get_wallet_risk(case.target_wallet).to_dict()

    resolved_alerts = [
        _ALERTS_BY_ID[aid].to_dict()
        for aid in case.alert_ids
        if aid in _ALERTS_BY_ID
    ]

    wallet_txs = [
        t for t in DATASET
        if t["from_wallet"] == case.target_wallet or t["to_wallet"] == case.target_wallet
    ]

    related_risks = {
        wallet_addr: ENGINE.get_wallet_risk(wallet_addr).to_dict()
        for wallet_addr in case.related_wallets
    }

    return {
        "case": case.to_dict(),
        "target_wallet_risk": target_risk,
        "resolved_alerts": resolved_alerts,
        "wallet_transactions": wallet_txs,
        "related_wallet_risks": related_risks,
    }


@app.get("/investigations/{case_id}/graph")
def get_investigation_graph(
    case_id: str,
    depth: int = Query(2, ge=1, le=3, description="Hop depth for graph expansion"),
):
    """
    Return Cytoscape-compatible graph data (nodes + edges) for an investigation case,
    centered around the case's target_wallet up to `depth` hops.
    """
    case = CASE_STORE.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Investigation case '{case_id}' not found")

    graph_data = ENGINE.get_wallet_graph(case.target_wallet, depth=depth)
    return {
        "case_id": case.case_id,
        "target_wallet": case.target_wallet,
        **graph_data,
    }

