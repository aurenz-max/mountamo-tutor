# backend/app/api/endpoints/eval_events.py
"""
Eval Events Endpoints

Logs evaluation events from Lumina primitive completions
and provides subskill progress reads.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from ...services.eval_events_service import EvalEventsService
from ...schemas.lesson_manifest import (
    EvalEventRequest,
    EvalEventResponse,
    StudentProgressResponse,
)
from ...dependencies import get_eval_events_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=EvalEventResponse)
async def log_eval_event(
    event: EvalEventRequest,
    eval_service: EvalEventsService = Depends(get_eval_events_service),
):
    """
    Log an evaluation event from a primitive completion.

    Writes to Firestore:
    - students/{student_id}/eval_events/{event_id}
    - students/{student_id}/subskill_progress/{subskill_id} (updated for each linked subskill)
    """
    try:
        event_id = await eval_service.log_eval_event(event)
        return EvalEventResponse(event_id=event_id, status="logged")
    except Exception as e:
        logger.error(f"Failed to log eval event: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress/{student_id}", response_model=StudentProgressResponse)
async def get_student_progress(
    student_id: str,
    subskill_ids: Optional[list[str]] = Query(None, description="Filter to specific subskill IDs"),
    eval_service: EvalEventsService = Depends(get_eval_events_service),
):
    """
    Get subskill progress for a student.

    Returns mastery levels, accuracy, and practice history.
    """
    try:
        progress = await eval_service.get_subskill_progress(student_id, subskill_ids)
        return StudentProgressResponse(student_id=student_id, progress=progress)
    except Exception as e:
        logger.error(f"Failed to get progress for {student_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def eval_events_health():
    """Health check for eval events service."""
    return {"status": "healthy", "service": "eval_events"}
