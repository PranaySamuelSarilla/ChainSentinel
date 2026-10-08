# ChainSentinel Project State

## Current Status

- **Phase 1 — Project Foundation**: COMPLETE
- **Phase 2 — Synthetic Transaction Dataset & Basic APIs**: COMPLETE
- **Phase 3 — Rule-Based Detection Engine**: COMPLETE
- **Phase 4A — Investigation Case Model, Storage & Core APIs**: COMPLETE
- **Phase 4B — Summary & Graph APIs + Frontend Data Integration**: COMPLETE
- **Phase 4C — Dashboard & Alert Experience Refinement**: COMPLETE
- **Phase 4D — Wallet Investigation & Case Workflow UI**: COMPLETE
- **Phase 4E — Testing, Verification & Checkpoint**: COMPLETE

**Current Next Phase**: **Phase 5 — Advanced Cybersecurity Visualizations & Activity Charts**

---

## Completed Features

- **React + Vite Frontend (`frontend/`)**: React 19, Vite 8, Tailwind CSS v4, Lucide React icons, Cytoscape.js installed. Development server with backend API proxy (`/api` → `http://127.0.0.1:8000`) and direct fallback. Full frontend API client layer (`frontend/src/api/`) communicating with all backend endpoints. Complete forensic investigation platform across 4 coordinated views:
  - **Dashboard View (`DashboardView.jsx`)**: Cybersecurity command center with live KPI metric strip (21 alerts, 11 high/critical, 9 medium, 1 low), interactive pattern breakdown matrix (6 cards with click-to-filter), top threats feed, and quick forensic jumps.
  - **Alerts Explorer (`AlertsView.jsx` & `AlertDetailModal.jsx`)**: Multi-filter alerts explorer with severity filters (`ALL`, `HIGH`, `MEDIUM`, `LOW`), pattern dropdown, real-time search, sorting by severity/amount/time, and full forensic modal with implicated wallet roles, transaction hashes, and direct "Investigate Wallet" / "Open Case" action buttons.
  - **Wallet Deep Dive (`WalletInvestigationView.jsx`)**: Address search with scenario presets, deterministic risk gauge (0–100) with color-coded levels, contributing pattern breakdown, interactive Cytoscape neighborhood graph with 1–3 hop depth selector, and full inbound/outbound transaction ledger.
  - **Case Management Workspace (`InvestigationsView.jsx` & `CreateCaseModal.jsx`)**: Complete investigation case workflow with status filtering (`ALL`, `OPEN`, `CLOSED`), comprehensive case dossier (`GET /investigations/{case_id}/summary`), embedded case graph visualization (`GET /investigations/{case_id}/graph`), inline editable analyst notes (`PATCH /notes`), and one-click case status toggle (`PATCH /status`).
- **FastAPI Backend (`backend/main.py`)**: Asynchronous REST service with CORS enabled for local development, in-memory pre-warmed detection cache, full endpoints for transactions, alerts, risk scores, graphs, and investigation cases.
- **Investigation Workflow Backend (`backend/investigations/`)**:
  - `InvestigationCase` domain model (`case_id`, `title`, `target_wallet`, `status`, `notes`, `alert_ids`, `related_wallets`, timestamps)
  - `InvestigationCaseStore` singleton (`CASE_STORE`) providing in-memory lookup and JSON file persistence (`cases.json`)
  - Full REST endpoints: create case (`POST /investigations`), list/filter cases (`GET /investigations`), retrieve case (`GET /investigations/{case_id}`), update status (`PATCH /investigations/{case_id}/status`), update analyst notes (`PATCH /investigations/{case_id}/notes`), comprehensive aggregated case summary (`GET /investigations/{case_id}/summary`), and investigation graph visualization (`GET /investigations/{case_id}/graph`)
- **Synthetic Transaction Dataset (`backend/data/transactions.csv`)**: 70 transactions across 70 wallets totaling 1,200.45 ETH, containing deliberate examples of 6 suspicious topologies and 4 normal activity patterns.
- **Transaction Loader (`backend/data/loader.py`)**: High-performance dataset loader using Python standard library `csv` and typed records, returning summary metrics without external binary dependencies.
- **Transaction APIs**: `GET /transactions` (with pagination and filtering by category or wallet) and `GET /transactions/{tx_id}`.
- **Detection Engine (`backend/detection/engine.py`)**: `DetectionEngine` orchestrator that converts raw transactions into typed domain models, executes all 6 rule-based detectors, deduplicates alerts, and calculates graph neighbourhoods.
- **Six Rule-Based Detection Patterns**:
  1. `CIRCULAR_TRANSACTION` (directed cycle enumeration with time windows)
  2. `RAPID_MOVEMENT` (hop-by-hop fund forwarding with low hold times)
  3. `TRANSACTION_BURST` (high transaction frequency sliding window)
  4. `FAN_OUT_SPLIT` (smurfing dispersal into multiple accounts)
  5. `FAN_IN_RECOMBINATION` (aggregation from multiple sources into a collector)
  6. `SUSPICIOUS_CLUSTER` (dense interconnected weakly connected components)
- **Risk Scoring (`backend/detection/risk.py`)**: Deterministic additive scoring model with configurable weights and thresholds, mapping scores to `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
- **Wallet Risk Analysis**: `GET /wallets/{wallet_id}/risk` providing score (0–100), severity level, and itemized pattern explanations.
- **Wallet Alert Analysis**: `GET /wallets/{wallet_id}/alerts` returning all alerts mentioning a specific wallet.
- **Wallet Transactions**: `GET /wallets/{wallet_id}/transactions` returning all inbound and outbound transactions for a wallet.
- **Graph API**: `GET /graph/{wallet_id}?depth=2` returning Cytoscape-formatted nodes and directed edges with flagging metadata.
- **Detection Summary API**: `GET /detection/summary` returning global alert counts, breakdown by pattern, and breakdown by severity.
- **Automated Tests (`backend/tests/`)**: 90 automated pytest unit and integration tests covering data loading, topology verification, all detectors, edge cases, risk scoring, REST endpoints, and the complete investigation workflow with summary aggregation and case graphs (100% passing).

---

## Detection Results (Phase 3 on Synthetic Dataset)

- **Test Suite**: **63 / 63 tests passing** (7 from Phase 1/2 + 56 added in Phase 3).
- **Total Alerts Detected**: **21 alerts**

### Pattern Breakdown:
- `CIRCULAR_TRANSACTION`: **12 alerts**
- `FAN_OUT_SPLIT`: **3 alerts**
- `RAPID_MOVEMENT`: **2 alerts**
- `FAN_IN_RECOMBINATION`: **2 alerts**
- `TRANSACTION_BURST`: **1 alert**
- `SUSPICIOUS_CLUSTER`: **1 alert**
- **Total**: **21 alerts**

### Severity Breakdown:
- `HIGH`: **11 alerts**
- `MEDIUM`: **9 alerts**
- `LOW`: **1 alert**
- **Total**: **21 alerts**

---

## Detection Patterns

### 1. `CIRCULAR_TRANSACTION`
- **Algorithm**: Builds a directed MultiDiGraph via NetworkX and applies `nx.simple_cycles()` to find closed loops of transactions.
- **Constraints**: Cycle length between 3 and 10 wallets (`CIRCULAR_MIN_CYCLE_LENGTH` to `CIRCULAR_MAX_CYCLE_LENGTH`), completing within 7,200 seconds (2 hours).
- **Forensic Context**: Layering technique where capital is routed through intermediary mule wallets before returning to the originator to obfuscate fund ownership.

### 2. `RAPID_MOVEMENT`
- **Algorithm**: Follows consecutive transaction chains where recipient wallet $W_i$ forwards funds to $W_{i+1}$ within a tight time delta.
- **Constraints**: Minimum chain length of 3 hops (`RAPID_MIN_HOPS`), maximum inter-hop hold time of 300 seconds / 5 minutes (`RAPID_MAX_HOP_SECONDS`), total chain window of 3,600 seconds.
- **Forensic Context**: Rapid layering / passthrough accounts used to quickly move stolen funds across multiple hops before law enforcement can freeze balances.

### 3. `TRANSACTION_BURST`
- **Algorithm**: Chronological sliding window per sender wallet to measure outbound transaction density.
- **Constraints**: Minimum 5 transactions (`BURST_MIN_TX_COUNT`) within a 300-second / 5-minute sliding window (`BURST_WINDOW_SECONDS`).
- **Forensic Context**: Automated programmatic disbursement or dusting attacks using high-speed script execution.

### 4. `FAN_OUT_SPLIT`
- **Algorithm**: Sliding window analysis of single source distributing funds to many distinct destination wallets.
- **Constraints**: Minimum 4 distinct destinations (`FANOUT_MIN_DESTINATIONS`), minimum 5.0 ETH total amount (`FANOUT_MIN_TOTAL_AMOUNT`), within 3,600 seconds (`FANOUT_WINDOW_SECONDS`). Includes coefficient of variation heuristic on amounts to flag potential automated payroll.
- **Forensic Context**: Smurfing / structuring technique breaking large balances into smaller increments below standard reporting thresholds.

### 5. `FAN_IN_RECOMBINATION`
- **Algorithm**: Sliding window analysis of multiple disparate feeder wallets depositing into a single collector wallet.
- **Constraints**: Minimum 4 distinct source wallets (`FANIN_MIN_SOURCES`), minimum 5.0 ETH total amount (`FANIN_MIN_TOTAL_AMOUNT`), within 3,600 seconds (`FANIN_WINDOW_SECONDS`).
- **Forensic Context**: Liquidity consolidation phase where smurfed or washed funds are gathered back into an operator-controlled collector wallet.

### 6. `SUSPICIOUS_CLUSTER`
- **Algorithm**: Evaluates weakly connected components (WCC) in the directed graph with edge density calculation ($e / [n(n-1)]$).
- **Constraints**: Minimum 3 nodes (`CLUSTER_MIN_NODES`), minimum 5 directed edges (`CLUSTER_MIN_EDGES`), and edge density $\ge 0.30$ (`CLUSTER_MIN_EDGE_DENSITY`).
- **Forensic Context**: Tightly knit mixing rings or wash-trading networks where participants circulate funds reciprocally with no outside economic purpose.

---

## Risk Scoring

Defined in `backend/detection/config.py` and implemented in `backend/detection/risk.py`:

### Pattern Weights:
- `CIRCULAR_TRANSACTION`: **+30 points**
- `SUSPICIOUS_CLUSTER`: **+25 points**
- `FAN_OUT_SPLIT`: **+20 points**
- `FAN_IN_RECOMBINATION`: **+20 points**
- `RAPID_MOVEMENT`: **+20 points**
- `TRANSACTION_BURST`: **+15 points**

### Aggregation Rules:
- Scores are additive per unique pattern type implicated with a wallet (maximum score capped at 100).
- If a wallet is clean (no associated alerts), its score is 0.

### Score to Level Mapping:
- **`CRITICAL`**: Score $\ge 60$
- **`HIGH`**: Score $\ge 40$
- **`MEDIUM`**: Score $\ge 20$
- **`LOW`**: Score $< 20$

---

## Current API Endpoints

| Method | Path | Query / Path Parameters | Description & Return Format |
|---|---|---|---|
| `GET` | `/health` | None | Operational status and API version (`{"status": "ok", ...}`) |
| `GET` | `/api/info` | None | Dataset metrics, wallet counts, volume, and category stats |
| `GET` | `/transactions` | `category`, `wallet`, `limit` (default 100), `offset` (default 0) | Paginated list of transactions with metadata and descriptions |
| `GET` | `/transactions/{tx_id}` | `tx_id` (hash string) | Detailed view of single transaction; returns 404 if missing |
| `GET` | `/alerts` | `pattern`, `severity`, `wallet`, `limit`, `offset` | List of detected alerts with forensic explanations, implicated wallets, and tx IDs |
| `GET` | `/alerts/{alert_id}` | `alert_id` (string) | Details of a single alert by ID; returns 404 if missing |
| `GET` | `/wallets/{wallet_id}/risk` | `wallet_id` (address string) | Wallet risk score (0-100), severity level (`LOW` to `CRITICAL`), and pattern explanations |
| `GET` | `/wallets/{wallet_id}/alerts` | `wallet_id` (address string) | List of alerts implicating the specified wallet |
| `GET` | `/wallets/{wallet_id}/transactions`| `wallet_id`, `limit` (default 50) | Inbound and outbound transactions for the specified wallet |
| `GET` | `/graph/{wallet_id}` | `wallet_id`, `depth` (1-3, default 2) | Subgraph JSON formatted for Cytoscape.js (`nodes`, `edges`, `flagged_wallets`) |
| `GET` | `/detection/summary` | None | Aggregate metrics: `total_alerts`, `alerts_by_pattern`, `alerts_by_severity` |
| `POST` | `/investigations` | Body: `title`, `target_wallet`, optional `notes`, `alert_ids`, `related_wallets` | Create an investigation case (201 Created); returns case object |
| `GET` | `/investigations` | `status` (optional: `OPEN`, `CLOSED`) | List all investigation cases (newest first); returns array and total |
| `GET` | `/investigations/{case_id}` | `case_id` (string) | Retrieve investigation case by ID; returns 404 if not found |
| `PATCH` | `/investigations/{case_id}/status` | Body: `status` (`OPEN` or `CLOSED`) | Update investigation case status; returns updated case object |
| `PATCH` | `/investigations/{case_id}/notes` | Body: `notes` (string) | Update investigation case notes; returns updated case object |
| `GET` | `/investigations/{case_id}/summary` | `case_id` (string) | Comprehensive forensic investigation summary (case, target risk, resolved alerts, transactions, related risks) |
| `GET` | `/investigations/{case_id}/graph` | `case_id` (string), `depth` (1-3, default 2) | Cytoscape graph data centered on case target wallet (reusing Phase 3 graph engine) |

---

## Known Limitations

1. **Synthetic Wallet Addresses with 'S' Characters**:
   Addresses such as `0x3333S0100000000000000000000000000000000` contain the character `S` (non-hexadecimal). These are intentional synthetic identifiers created for retail shopper simulation. The entire platform treats wallet addresses strictly as opaque case-sensitive strings. Do not enforce strict hex decoding on addresses.
2. **DEX Router Generates Low-Severity Fan-In**:
   The Uniswap DEX Router address (`0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`) receives transactions from multiple independent traders within 1 hour. This triggers a `FAN_IN_RECOMBINATION` alert at `LOW` severity. In the MVP this is documented behavior. In future iterations, a verified public contract whitelist can be introduced.
3. **Cluster Generates Sub-Cycles in Circular Detection**:
   The 5-node mixing ring (`0xEE01...` through `0xEE05...`) features 12 interconnected transfers, resulting in multiple sub-cycles detected by `CIRCULAR_TRANSACTION` alongside the primary `SUSPICIOUS_CLUSTER` alert. This is mathematically accurate for cyclic subgraphs and must not be suppressed without a dedicated cycle subsumption rule.

> **CRITICAL RULE**: These limitations are known characteristics of the current deterministic rule-based algorithms. They must NOT be silently altered, bypassed, or removed.

---

## Current Phase

- **Current Status**: **Phase 4 Complete** (Phase 4A: Models & Store, Phase 4B: Summary/Graph APIs & Frontend Integration, Phase 4C: Dashboard & Alerts, Phase 4D: Wallet Deep Dive & Case Management, Phase 4E: Testing, Verification & Checkpoint)
- **Next Task**: **Phase 5 — Advanced Cybersecurity Visualizations & Activity Charts**

> **IMPORTANT RULE**: This file must be updated at the end of each completed phase to maintain persistent project context.
