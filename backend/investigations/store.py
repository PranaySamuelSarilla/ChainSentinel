"""
ChainSentinel - Investigation Case Store

In-memory store for investigation cases with optional JSON file persistence.

Design rationale:
  - MVP uses a simple dict keyed by case_id — no SQLite overhead needed yet.
  - Cases are persisted to a JSON file on disk so they survive server restarts.
  - If the persistence file is missing or malformed, the store starts fresh.
  - SQLite can be layered on top in a later phase without changing the API.

The store is a singleton. Import `CASE_STORE` from this module everywhere.
"""

import json
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional

from .models import InvestigationCase, CaseStatus

# Path for optional JSON persistence, relative to this file's directory
_STORE_FILE = os.path.join(os.path.dirname(__file__), "cases.json")


class InvestigationCaseStore:
    """
    In-memory dictionary store with JSON file persistence.
    Thread-safe for single-worker Uvicorn (MVP assumption).
    """

    def __init__(self) -> None:
        self._cases: Dict[str, InvestigationCase] = {}
        self._load_from_disk()

    # ──────────────────────────────────────────────────────────────
    # CRUD
    # ──────────────────────────────────────────────────────────────

    def create(self, case: InvestigationCase) -> InvestigationCase:
        """Store a new case. Raises ValueError if case_id already exists."""
        if case.case_id in self._cases:
            raise ValueError(f"Case {case.case_id} already exists.")
        self._cases[case.case_id] = case
        self._save_to_disk()
        return case

    def get(self, case_id: str) -> Optional[InvestigationCase]:
        """Return case by ID or None if not found."""
        return self._cases.get(case_id)

    def list_all(self) -> List[InvestigationCase]:
        """Return all cases, newest first (by created_at descending)."""
        return sorted(
            self._cases.values(),
            key=lambda c: c.created_at,
            reverse=True,
        )

    def update_status(self, case_id: str, status: str) -> Optional[InvestigationCase]:
        """Update case status. Returns updated case or None if not found."""
        case = self._cases.get(case_id)
        if case is None:
            return None
        case.status = status
        case.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_to_disk()
        return case

    def update_notes(self, case_id: str, notes: str) -> Optional[InvestigationCase]:
        """Update case analyst notes. Returns updated case or None if not found."""
        case = self._cases.get(case_id)
        if case is None:
            return None
        case.notes = notes
        case.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_to_disk()
        return case

    def count(self) -> int:
        return len(self._cases)

    def clear(self) -> None:
        """Reset the store in-memory and remove persistence file (used for test isolation)."""
        self._cases.clear()
        if os.path.exists(_STORE_FILE):
            try:
                os.remove(_STORE_FILE)
            except Exception:
                pass

    # ──────────────────────────────────────────────────────────────
    # Persistence
    # ──────────────────────────────────────────────────────────────

    def _save_to_disk(self) -> None:
        """Persist current cases to JSON file. Silently skips on write error."""
        try:
            data = [c.to_dict() for c in self._cases.values()]
            with open(_STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass  # persistence failure is non-fatal for MVP

    def _load_from_disk(self) -> None:
        """Load cases from JSON file if it exists and is valid."""
        if not os.path.exists(_STORE_FILE):
            return
        try:
            with open(_STORE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                case = InvestigationCase.from_dict(item)
                self._cases[case.case_id] = case
        except Exception:
            # Corrupted or incompatible file — start fresh
            self._cases = {}


# ──────────────────────────────────────────────────────────────────
# Module-level singleton — import this everywhere
# ──────────────────────────────────────────────────────────────────
CASE_STORE = InvestigationCaseStore()
