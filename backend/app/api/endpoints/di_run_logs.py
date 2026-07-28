# backend/app/api/endpoints/di_run_logs.py
"""Receive client-side DI run logs and persist them for diagnosis.

The DI run log panel (diRunLog.ts) auto-flushes its run JSON here at run end
and on teardown, so a failed sitting always leaves a diagnosable artifact —
no human Copy-run-JSON click required. Files land next to the server-side
session ledgers (backend/logs/), joined by the shared client run id.

Diagnosis telemetry only: writes are best-effort, bodies are size-capped, and
nothing here feeds any student-facing behavior.
"""

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Body, Depends, HTTPException, status

from ...core.middleware import require_auth

logger = logging.getLogger(__name__)

router = APIRouter()

# app/api/endpoints/di_run_logs.py -> backend/
RUN_LOG_DIR = Path(__file__).resolve().parents[3] / "logs" / "di-runs"

MAX_BYTES = 2_000_000  # a full 600-event run is ~100 KB; 2 MB is generous

_SAFE = re.compile(r"[^A-Za-z0-9_-]+")


def _slug(value: object, fallback: str) -> str:
    text = _SAFE.sub("-", str(value or fallback)).strip("-")
    return text[:48] or fallback


@router.post("")
async def save_di_run_log(
    body: dict = Body(...),
    user: dict = Depends(require_auth),
):
    """Persist one client run-log payload as a JSON file. Returns the filename."""
    serialized = json.dumps(body, ensure_ascii=False, indent=2, default=str)
    if len(serialized.encode("utf-8")) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Run log exceeds size cap",
        )

    meta = body.get("meta") or {}
    run_id = _slug(meta.get("runId") or body.get("runId"), "no-runid")
    primitive = _slug(meta.get("primitiveId"), "unknown-primitive")
    reason = _slug(body.get("flushReason"), "manual")
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
    filename = f"{stamp}-{primitive}-{run_id}-{reason}.json"

    try:
        RUN_LOG_DIR.mkdir(parents=True, exist_ok=True)
        (RUN_LOG_DIR / filename).write_text(serialized, encoding="utf-8")
    except Exception as e:
        logger.error(f"Failed to persist DI run log {filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not persist run log",
        )

    logger.info(
        f"DI run log saved: {filename} "
        f"(uid={user.get('uid', 'unknown')}, events={len(body.get('timeline') or [])})"
    )
    return {"saved": True, "file": filename}
