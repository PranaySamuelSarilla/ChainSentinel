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
    GET /graph/{wallet_id}
    GET /detection/summary
"""

from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from backend.data.loader import load_transactions, get_dataset_stats
    from backend.detection.engine import DetectionEngine
except (ImportError, ModuleNotFoundError):
    from data.loader import load_transactions, get_dataset_stats
    from detection.engine import DetectionEngine

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


# ──────────────────────────────────────────────────────────────────
# Response Models
# ──────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    message: str
    version: str


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
