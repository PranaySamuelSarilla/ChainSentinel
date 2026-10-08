# ChainSentinel Architecture

## High-Level Architecture

ChainSentinel is structured as a decoupled full-stack platform consisting of a high-performance React forensic user interface and a deterministic Python/FastAPI analytical backend.

```text
┌────────────────────────────────────────────────────────┐
│            React / Vite Frontend (:5173)               │
│  - Forensic Dashboard & Activity Visualizations        │
│  - Cytoscape.js Wallet Graph Interaction               │
│  - Investigation & Evidence Verification Workflows     │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON (via Vite Proxy /api)
                           ▼
┌────────────────────────────────────────────────────────┐
│               FastAPI Backend (:8000)                  │
│  - REST Endpoints (/transactions, /alerts, /graph)     │
│  - In-Memory Response Caching & Pre-warmed Engine      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               Detection Engine Orchestrator            │
│  - Typed Domain Modeling (models.py)                   │
│  - 6 Modular Rule Detectors (NetworkX graph analysis)  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                 Risk Scoring Engine                    │
│  - Additive Pattern Weighting & Severity Thresholds    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                      Data Layer                        │
│  - CSV Transaction Ledger (backend/data/transactions)  │
│  - Pure-Python Ingestion & Validation (loader.py)      │
└────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
ChainSentinel/
├── PROJECT_STATE.md                  # Persistent memory and phase completion record
├── ARCHITECTURE.md                   # System design, data flow, and technical contracts
├── DEVELOPMENT_GUIDE.md              # Engineering rules and handoff guidelines for AI agents
├── README.md                         # Project introduction and quickstart instructions
├── .gitignore                        # Git exclusion rules for node_modules, venv, and cache
├── frontend/                         # Client application
│   ├── package.json                  # React 19, Cytoscape, Lucide React, Tailwind v4
│   ├── vite.config.js                # Vite build config with backend proxy (:8000)
│   ├── index.html                    # Single-page application root HTML
│   ├── src/
│   │   ├── main.jsx                  # React application entry point
│   │   ├── App.jsx                   # Dark cybersecurity shell and status indicator
│   │   └── index.css                 # Tailwind v4 import and custom dark styling
│   └── dist/                         # Verified production bundle build
└── backend/                          # Forensics analytics backend
    ├── requirements.txt              # Backend dependencies (fastapi, uvicorn, networkx, etc.)
    ├── venv/                         # Python 3.12 isolated virtual environment
    ├── main.py                       # FastAPI application, CORS, and REST endpoints
    ├── __init__.py
    ├── data/                         # Ledger data layer
    │   ├── __init__.py
    │   ├── transactions.csv          # 70 simulated transactions (source of truth)
    │   ├── generate_dataset.py       # Deterministic transaction generator
    │   └── loader.py                 # CSV ingestion and metrics calculator
    ├── detection/                    # Forensic pattern detection engine
    │   ├── __init__.py               # Package exports
    │   ├── models.py                 # Dataclasses: Transaction, Alert, Risk, Summary
    │   ├── config.py                 # Centralized detector thresholds and scoring weights
    │   ├── circular.py               # Directed cycle detection via NetworkX
    │   ├── rapid_movement.py         # Low-latency relay hop tracker
    │   ├── burst.py                  # High-frequency transaction sliding window
    │   ├── fanout.py                 # Smurfing dispersal detector
    │   ├── fanin.py                  # Liquidity aggregation detector
    │   ├── clusters.py               # Dense subgraph / community detector
    │   ├── risk.py                   # Additive risk scoring engine
    │   └── engine.py                 # DetectionEngine orchestrator and graph extractor
    ├── crypto/                       # Phase 8 cryptographic evidence verification
    │   └── __init__.py
    └── tests/                        # Automated test suite
        ├── __init__.py
        ├── test_basic.py             # Phase 1/2 tests (7 tests)
        └── test_detection.py         # Phase 3 detection tests (56 tests)
```

---

## Frontend

The frontend is an investigation cockpit built with:
- **Framework**: React 19 bootstrapped with Vite 8.
- **Styling**: Tailwind CSS v4 using a dark cybersecurity theme (`#0b0f19` background, slate cards, and neon severity badges).
- **Graph Renderer**: Cytoscape.js (`cytoscape@^3.34.3`) prepared for interactive node-link network rendering.
- **Iconography**: Lucide React (`lucide-react@^1.53.0`) for cybersecurity and system status indicators.
- **Proxying**: Configured in `vite.config.js` to route all `/api/*` requests directly to `http://127.0.0.1:8000`, eliminating CORS obstacles during local development.

---

## Backend

The backend is built with **FastAPI** (`backend/main.py`), running under **Uvicorn**:
- **Dual-mode Module Imports**: Supports both running directly via `uvicorn main:app` from `backend/` and `uvicorn backend.main:app` from the project root.
- **CORS Configuration**: Wildcard CORS enabled for seamless cross-origin communication.
- **In-Memory Caching**: On startup, transactions are parsed into domain models, the `DetectionEngine` is pre-warmed once, and results are cached in memory for sub-millisecond API response latency.
- **REST Endpoints**:
  - Platform health (`/health`)
  - Ledger discovery (`/api/info`, `/transactions`, `/transactions/{tx_id}`)
  - Detection results (`/alerts`, `/alerts/{alert_id}`, `/detection/summary`)
  - Wallet analytics (`/wallets/{wallet_id}/risk`, `/wallets/{wallet_id}/alerts`, `/wallets/{wallet_id}/transactions`)
  - Topological exploration (`/graph/{wallet_id}`)

---

## Data Layer

The dataset resides in `backend/data/transactions.csv` and is ingested via `backend/data/loader.py`.

### CSV Columns:
1. `tx_id`: Unique 66-character hex hash starting with `0x`.
2. `from_wallet`: Sender address (case-sensitive string).
3. `to_wallet`: Recipient address (case-sensitive string).
4. `amount`: Transaction value in ETH (`float`).
5. `timestamp`: ISO-8601 UTC timestamp string (e.g., `2026-10-08T08:00:00+00:00`).
6. `status`: Transaction execution status (`SUCCESS`).
7. `gas_fee`: Network transaction fee in ETH (`float`).
8. `category_label`: Ground-truth tag (`circular`, `rapid_movement`, `burst`, `split`, `recombination`, `cluster`, `normal`).
9. `description`: Human-readable investigative scenario description.

### Loader Design:
`loader.py` avoids third-party binary compiled dependencies. It parses CSV rows directly using Python's standard `csv.DictReader`, normalizing numerical amounts, timestamps, and computing global volume and category statistics.

---

## Detection Engine

The detection architecture (`backend/detection/`) separates concerns across specialized modules:

1. **`models.py`**:
   - `Transaction`: Typed dataclass representing an immutable blockchain transfer with tz-aware UTC timestamps.
   - `Alert`: Standardized alert object containing `alert_id`, `pattern`, `severity`, `wallets`, `transaction_ids`, `total_amount`, `time_span_seconds`, `explanation`, and `metadata`.
   - `WalletRiskAssessment`: Aggregated profile containing `wallet_id`, `risk_score` (0–100), `risk_level`, `pattern_types`, `alerts`, and narrative `explanation`.
   - `DetectionSummary`: System-level summary of alerts categorized by pattern and severity.
2. **`config.py`**:
   - Central declaration of all time windows, hop limits, thresholds, risk weights, and severity tiers. No magic constants exist in detector logic.
3. **Detectors**:
   - `circular.py`: Constructs NetworkX multigraph, runs elementary cycle enumeration, filters by temporal window ($\le 2$ hours) and path length (3–10 nodes).
   - `rapid_movement.py`: Relational chain-following algorithm tracing rapid passthrough transactions with hold times $\le 300$ seconds.
   - `burst.py`: Sliding-window density evaluation detecting $\ge 5$ transactions in $\le 300$ seconds from a single sender.
   - `fanout.py`: Detects volume dispersal to $\ge 4$ unique destinations within 1 hour, calculating variance ratios to discern batch payroll.
   - `fanin.py`: Detects liquidity aggregation from $\ge 4$ unique sources into a collector within 1 hour.
   - `clusters.py`: Extracts weakly connected components, calculating directed edge density $e / [n(n-1)] \ge 0.30$ to flag mixing networks.
4. **`risk.py`**:
   - Aggregates detected pattern types per wallet using additive weights and maps the resulting score to standardized severity tiers.
5. **`engine.py`**:
   - Coordinates all detectors via `DetectionEngine.detect_all()`.
   - Provides wallet-specific queries via `detect_for_wallet()` and `get_wallet_risk()`.
   - Extracts $k$-hop subgraphs via `get_wallet_graph()` for graph rendering.

---

## Risk Model

The risk model is deterministic, explainable, and transparent for hackathon demonstration:

### Pattern Weights (`config.py`):
```python
RISK_WEIGHTS = {
    "CIRCULAR_TRANSACTION": 30,
    "SUSPICIOUS_CLUSTER":   25,
    "FAN_OUT_SPLIT":        20,
    "FAN_IN_RECOMBINATION": 20,
    "RAPID_MOVEMENT":       20,
    "TRANSACTION_BURST":    15,
}
```

### Severity Tiers:
```python
RISK_THRESHOLDS = {
    "CRITICAL": 60,   # Score >= 60
    "HIGH":     40,   # Score >= 40
    "MEDIUM":   20,   # Score >= 20
    # Score < 20 -> LOW
}
```

**Scoring Invariant**: Each pattern contributes once per wallet regardless of how many individual alerts it generates, preventing duplicate alert penalties. Scores are strictly capped at 100.

---

## Graph Representation

The platform prepares relationship graphs for frontend visualization with Cytoscape.js:

- **Nodes**: Represent wallets. Node data includes `id` (full address), `label` (truncated address), `flagged` (`boolean` indicating if the wallet is implicated in any alert), and `is_focus` (`boolean` indicating the investigator's query target).
- **Edges**: Represent directed transactions. Edge data includes `id` (`tx_id`), `source` (`from_wallet`), `target` (`to_wallet`), `amount` (float), `label` (formatted ETH), and `category`.
- **Extraction**: `DetectionEngine.get_wallet_graph(wallet_id, depth)` performs breadth-first expansion up to `depth` hops (default 2), assembling a clean subgraph containing only relevant interacting nodes.

---

## Data Flow

```text
transactions.csv
      │
      ▼ (read by loader.py)
List[Dict]
      │
      ▼ (instantiated in engine.py)
List[Transaction]
      │
      ├───────────────────────┬───────────────────────┬───────────────────────┐
      ▼                       ▼                       ▼                       ▼
circular.py             rapid_movement.py        burst.py / fanout.py    clusters.py
      │                       │                       │                       │
      └───────────────────────┴───────────────────────┴───────────────────────┘
                                      │
                                      ▼
                                 List[Alert]
                                      │
                                      ▼ (aggregated by risk.py)
                           Dict[wallet_id, WalletRiskAssessment]
                                      │
                                      ▼ (exposed via main.py)
                        FastAPI REST Endpoints
                                      │
                                      ▼ (consumed by React UI)
                           Investigation Dashboard
```

---

## Architectural Decisions

1. **Rule-Based Deterministic Algorithms instead of ML**:
   For an MVP and hackathon judging, explainability is paramount. Deterministic graph and sliding-window rules yield clear explanations ("Funds moved through 4 wallets and returned in 18 minutes") rather than opaque black-box neural scores.
2. **Synthetic Realistic Dataset instead of Live Blockchain APIs**:
   Live blockchain RPC nodes are rate-limited, slow, and unpredictable during demonstrations. A pre-seeded synthetic dataset guarantees instantaneous responses and reliable reproduction of all 6 suspicious topologies.
3. **Pure-Python Data Ingestion over Pandas**:
   In Windows environments with Application Control (WDAC) policies, compiled binary C-extensions (such as `pandas._libs.hashing.pyd`) can be blocked from running in desktop folders. The system uses Python's standard library `csv` and pure-Python `networkx`, eliminating fragile binary `.dll`/`.pyd` execution risks.
4. **NetworkX for Topology Analysis**:
   NetworkX is a battle-tested, pure-Python graph analytics library that supports directed cycle enumeration (`simple_cycles`), connected components (`weakly_connected_components`), and subgraph density metrics.
5. **FastAPI for Asynchronous Forensics Services**:
   Provides automatic OpenAPI documentation (`/docs`), strong Pydantic typing, high throughput, and zero configuration for CORS.
6. **Cytoscape.js for Graph Visualizations**:
   Cytoscape.js is the gold standard for high-performance canvas-based network graph visualization, supporting custom node badges, edge weights, and path highlighting.
7. **Cryptographic Integrity Verification (Planned for Phase 8)**:
   SHA-256 case hashing and Merkle tree root generation are planned for Phase 8 to provide tamper-proof evidence preservation.
