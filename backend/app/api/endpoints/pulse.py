"""
Lumina Pulse API — Adaptive Learning Loop Endpoints

See: Lumina_PRD_Pulse.md §8
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from ...core.middleware import get_user_context
from ...dependencies import get_pulse_engine
from ...models.pulse import (
    CreatePulseSessionRequest,
    PulseResultRequest,
)
from ...services.pulse_engine import PulseEngine

logger = logging.getLogger(__name__)

router = APIRouter()


# --------------------------------------------------------------------------
# POST /sessions — assemble a new Pulse session
# --------------------------------------------------------------------------

@router.post("/sessions")
async def create_pulse_session(
    body: CreatePulseSessionRequest,
    user_context: dict = Depends(get_user_context),
    engine: PulseEngine = Depends(get_pulse_engine),
):
    """Assemble and return a new Pulse session."""
    student_id = user_context["student_id"]

    try:
        logger.info(
            f"POST /pulse/sessions — student {student_id}, "
            f"subject={body.subject}, items={body.item_count}"
        )
        result = await engine.assemble_session(
            student_id=student_id,
            subject=body.subject,
            item_count=body.item_count,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error creating pulse session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create pulse session: {str(e)}",
        )


# --------------------------------------------------------------------------
# GET /sessions/{session_id} — get session state (for resume)
# --------------------------------------------------------------------------

@router.get("/sessions/{session_id}")
async def get_pulse_session(
    session_id: str,
    user_context: dict = Depends(get_user_context),
    engine: PulseEngine = Depends(get_pulse_engine),
):
    """Get a Pulse session by ID."""
    try:
        return await engine.get_session(session_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error getting pulse session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# --------------------------------------------------------------------------
# POST /sessions/{session_id}/result — submit one item result
# --------------------------------------------------------------------------

@router.post("/sessions/{session_id}/result")
async def submit_pulse_result(
    session_id: str,
    body: PulseResultRequest,
    user_context: dict = Depends(get_user_context),
    engine: PulseEngine = Depends(get_pulse_engine),
):
    """Process a single item result and return updates."""
    student_id = user_context["student_id"]

    try:
        logger.info(
            f"POST /pulse/sessions/{session_id}/result — "
            f"student {student_id}, item={body.item_id}, score={body.score}"
        )
        result = await engine.process_result(
            student_id=student_id,
            session_id=session_id,
            result=body,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            f"Error processing pulse result for session {session_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process result: {str(e)}",
        )


# --------------------------------------------------------------------------
# GET /sessions/{session_id}/summary — completed session summary
# --------------------------------------------------------------------------

@router.get("/sessions/{session_id}/summary")
async def get_pulse_session_summary(
    session_id: str,
    user_context: dict = Depends(get_user_context),
    engine: PulseEngine = Depends(get_pulse_engine),
):
    """Get summary of a completed Pulse session."""
    try:
        return await engine.get_session_summary(session_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error getting pulse summary for {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
