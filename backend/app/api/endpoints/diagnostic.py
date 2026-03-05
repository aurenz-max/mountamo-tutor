"""
Diagnostic Placement API Endpoints

Exposes the adaptive diagnostic placement engine via REST:
  GET  /sessions                        — List student's diagnostic sessions
  GET  /sessions/latest-profile         — Latest completed knowledge profile
  POST /sessions                        — Create session, get initial probes
  POST /sessions/{id}/probe-result      — Record result, get next probes
  GET  /sessions/{id}                   — Get enriched session state (resume)
  POST /sessions/{id}/complete          — Finalize and seed mastery lifecycle
  GET  /sessions/{id}/knowledge-profile — Get knowledge profile summary
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query, status
from datetime import datetime
import logging

from ...core.middleware import get_user_context
from ...dependencies import get_diagnostic_service
from ...services.diagnostic_service import DiagnosticService
from ...models.diagnostic import (
    CreateDiagnosticSessionRequest,
    ProbeResultRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# LIST SESSIONS (must be before /{session_id} routes)
# ============================================================================

@router.get("/sessions/latest-profile")
async def get_latest_profile(
    user_context: dict = Depends(get_user_context),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    """
    Get the knowledge profile from the student's most recent completed
    diagnostic session. Returns 404 if no completed diagnostic exists.
    """
    student_id = user_context["student_id"]
    try:
        profile = await service.get_latest_profile(student_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No completed diagnostic session found",
            )
        return profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting latest profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/sessions")
async def list_diagnostic_sessions(
    state: Optional[str] = Query(
        default=None,
        description='Filter by state: "in_progress", "completed", or "abandoned"',
    ),
    user_context: dict = Depends(get_user_context),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    """
    List all diagnostic sessions for the authenticated student.

    Optional query parameter `state` filters by session state.
    Results are sorted by created_at descending (most recent first).
    """
    student_id = user_context["student_id"]
    try:
        sessions = await service.list_sessions(student_id, state=state)
        return sessions

    except Exception as e:
        logger.error(f"Error listing diagnostic sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# ============================================================================
# CREATE SESSION
# ============================================================================

@router.post("/sessions")
async def create_diagnostic_session(
    body: CreateDiagnosticSessionRequest,
    user_context: dict = Depends(get_user_context),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    """
    Create a new diagnostic session.

    Analyzes the prerequisite DAG for the requested subjects, computes
    topological midpoints, and returns initial probe points.

    Returns:
        {
            session_id: str,
            student_id: int,
            subjects: [str],
            total_nodes: int,
            probes: [{subskill_id, subject, description, depth, chain_length, reason}]
        }
    """
    student_id = user_context["student_id"]
    grade_level = user_context.get("grade_level")
    try:
        logger.info(
            f"POST /diagnostic/sessions — student {student_id}, "
            f"grade={grade_level}, subjects={body.subjects}"
        )
        result = await service.create_session(
            student_id=student_id,
            subjects=body.subjects,
            grade_level=grade_level,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating diagnostic session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create diagnostic session: {str(e)}",
        )


# ============================================================================
# RECORD PROBE RESULT
# ============================================================================

@router.post("/sessions/{session_id}/probe-result")
async def record_probe_result(
    session_id: str,
    body: ProbeResultRequest,
    user_context: dict = Depends(get_user_context),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    """
    Record a probe result and get next probes.

    After the frontend presents assessment items for a subskill, it reports
    the aggregated score here. The engine runs inference propagation and
    returns the next probe points (or signals completion).

    Returns:
        {
            status: "continue" | "complete",
            classified_count: int,
            total_count: int,
            coverage_pct: float,
            probes: [...],
            inferences_made: [...]
        }
    """
    try:
        logger.info(
            f"POST /diagnostic/sessions/{session_id}/probe-result — "
            f"subskill={body.subskill_id}, score={body.score:.2f}"
        )
        result = await service.record_probe_result(
            session_id=session_id,
            subskill_id=body.subskill_id,
            score=body.score,
            items_completed=body.items_completed,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error recording probe result: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record probe result: {str(e)}",
        )


# ============================================================================
# GET SESSION
# ============================================================================

@router.get("/sessions/{session_id}")
async def get_diagnostic_session(
    session_id: str,
    user_context: dict = Depends(get_user_context),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    """
    Get enriched diagnostic session state.

    For in_progress sessions: includes computed next probes for resume.
    For completed sessions: includes the knowledge profile.

    Used for resuming an interrupted session, displaying the parent
    real-time view, or checking session state.
    """
    try:
        session = await service.get_session_enriched(session_id)
        return session

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting diagnostic session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# ============================================================================
# COMPLETE SESSION
# ============================================================================

@router.post("/sessions/{session_id}/complete")
async def complete_diagnostic_session(
    session_id: str,
    user_context: dict = Depends(get_user_context),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    """
    Finalize the diagnostic session and seed the mastery lifecycle.

    Maps diagnostic classifications to mastery gates:
      - probed_mastered     → Gate 4 (fully mastered, no retests)
      - inferred_mastered   → Gate 2 (skip to practice verification)
      - probed_not_mastered → Gate 0 (needs lessons)
      - inferred_not_mastered → Gate 0 (not started)

    Recalculates unlock state for all subjects after seeding.

    Returns:
        {
            session_id, student_id, seeded_count,
            frontier_skills: [...],
            knowledge_profile: {...}
        }
    """
    try:
        logger.info(f"POST /diagnostic/sessions/{session_id}/complete")
        result = await service.complete_session(session_id)
        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error completing diagnostic session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete diagnostic session: {str(e)}",
        )


# ============================================================================
# KNOWLEDGE PROFILE
# ============================================================================

@router.get("/sessions/{session_id}/knowledge-profile")
async def get_knowledge_profile(
    session_id: str,
    user_context: dict = Depends(get_user_context),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    """
    Get the knowledge profile for a diagnostic session.

    Returns per-subject summaries (mastered/not_mastered/unknown counts),
    frontier skills, and coverage metrics. Suitable for the parent view.
    """
    try:
        profile = await service.get_knowledge_profile(session_id)
        return profile

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting knowledge profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def diagnostic_health():
    """Health check for the diagnostic placement engine."""
    return {
        "status": "healthy",
        "service": "diagnostic_placement",
        "features": {
            "adaptive_probing": True,
            "dag_binary_search": True,
            "inference_propagation": True,
            "mastery_seeding": True,
        },
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }
