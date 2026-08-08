# backend/app/services/session_ledger.py
"""Write-only JSONL ledger for Gemini Live tutor sessions.

One file per WebSocket session under backend/logs/lumina-sessions/. This is the
server twin of the client-side DI run log panel: timestamped, structured, and
correlated with the client via `client_run_id` (the client's diRunLog runId,
sent in the auth message).

Contract: strictly passive. Every method swallows every exception — telemetry
must never be able to break a live tutoring session. On Cloud Run the
filesystem is ephemeral, so the ledger complements stdout logging on a dev
machine; it does not replace it.
"""

import json
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# app/services/session_ledger.py -> backend/
LEDGER_DIR = Path(__file__).resolve().parents[2] / "logs" / "lumina-sessions"

# ANY leading [TAG] marks a message as a system cue rather than something the
# student wrote. This was a hardcoded roster of six tags until 2026-08-08. The
# client fires 40+ distinct tags from 1,100+ call sites — [READ_SECTION],
# [ANSWER_CORRECT], [NEXT_ITEM], [CONCEPT_SELECTED], [ACTIVITY_START] — and
# every tag outside the roster classified as student text, which left both the
# ledger and the floor gate blind to most of the traffic they exist to govern.
_CUE_RE = re.compile(r"^\[([A-Z0-9_][A-Z0-9_ ]*)\]")


def classify_cue(text: str) -> str:
    """Name the kind of text being sent to Gemini by its bracket-tag prefix.

    Returns the tag itself (e.g. "[NEXT_ITEM]") for a system cue, or "text"
    for anything the student authored. The tag is also the coalescing identity
    in the floor gate: two cues of the same kind in one batch are one cue.
    """
    match = _CUE_RE.match(text.lstrip())
    return f"[{match.group(1)}]" if match else "text"


class SessionLedger:
    """Append-only JSONL event stream for one tutor WebSocket session."""

    def __init__(self, kind: str = "lumina-tutor"):
        self.run_id = uuid.uuid4().hex[:12]
        self._started = time.monotonic()
        self._seq = 0
        self._file = None
        self.path: Optional[Path] = None
        try:
            LEDGER_DIR.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
            self.path = LEDGER_DIR / f"{stamp}-{kind}-{self.run_id}.jsonl"
            self._file = open(self.path, "a", encoding="utf-8")
            logger.info(f"Session ledger opened: {self.path} (server_run_id={self.run_id})")
        except Exception as e:
            logger.warning(f"Session ledger unavailable ({e}); session continues without one")
            self._file = None

    def write(self, event: str, **fields: Any) -> None:
        """Append one event record. Never raises."""
        try:
            self._seq += 1
            record = {
                "seq": self._seq,
                "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
                "at_ms": round((time.monotonic() - self._started) * 1000),
                "event": event,
                **fields,
            }
            if self._file is not None:
                self._file.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
                self._file.flush()
        except Exception:
            pass

    def close(self) -> None:
        try:
            if self._file is not None:
                self._file.close()
                self._file = None
        except Exception:
            pass
