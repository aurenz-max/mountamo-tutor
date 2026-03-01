"""
Mastery Lifecycle API Endpoints

Read-only endpoints for querying the 4-gate mastery lifecycle state
per student per subskill (PRD Section 6.2).
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime, timedelta, timezone
import logging

from ...core.middleware import get_user_context
from ...dependencies import get_firestore_service, get_mastery_lifecycle_engine
from ...db.firestore_service import FirestoreService
from ...services.mastery_lifecycle_engine import MasteryLifecycleEngine

logger = logging.getLogger(__name__)
router = APIRouter()


# ==========================================================================
# Debug / seed endpoint
# ==========================================================================


class SeedSubskillRequest(BaseModel):
    """A single subskill to seed with a target gate."""
    subject: str
    skill_id: str
    subskill_id: str
    target_gate: int = Field(ge=0, le=4, description="Target mastery gate (0-4)")


class SeedRequest(BaseModel):
    """Optional body for the seed endpoint. If subskills provided, use those."""
    subskills: Optional[List[SeedSubskillRequest]] = None


# Default seed configuration (used when no custom subskills provided)
_SEED_SUBJECTS: List[Dict] = [
    {
        "subject": "mathematics",
        "skills": [
            {"skill_id": "math_addition", "subskills": ["single_digit_add", "double_digit_add", "word_problems_add"]},
            {"skill_id": "math_subtraction", "subskills": ["single_digit_sub", "double_digit_sub", "word_problems_sub"]},
        ],
    },
    {
        "subject": "language_arts",
        "skills": [
            {"skill_id": "la_reading", "subskills": ["phonics_basics", "sight_words", "reading_comp"]},
            {"skill_id": "la_writing", "subskills": ["sentence_structure", "paragraph_writing", "grammar_rules"]},
        ],
    },
]

# Target gate for each of the 12 subskills (index matches flat order)
_SEED_GATE_TARGETS = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4]


@router.post("/debug/seed/{student_id}")
async def seed_mastery_lifecycle(
    student_id: int,
    body: Optional[SeedRequest] = None,
    user_context: dict = Depends(get_user_context),
    engine: MasteryLifecycleEngine = Depends(get_mastery_lifecycle_engine),
):
    """
    Seed demo mastery lifecycle data for a student.

    If `subskills` is provided in the body, seeds those specific subskills
    at their requested target gates. Otherwise, generates default demo data
    (12 subskills across 2 subjects at various gate levels).
    """
    try:
        now = datetime.now(timezone.utc)
        results = []

        if body and body.subskills:
            # --- Custom subskills mode ---
            for entry in body.subskills:
                result = await _seed_subskill_to_gate(
                    engine=engine,
                    student_id=student_id,
                    subskill_id=entry.subskill_id,
                    subject=entry.subject,
                    skill_id=entry.skill_id,
                    target_gate=entry.target_gate,
                    now=now,
                )
                results.append(result)
        else:
            # --- Default demo data mode ---
            idx = 0
            for subj_cfg in _SEED_SUBJECTS:
                subject = subj_cfg["subject"]
                for skill_cfg in subj_cfg["skills"]:
                    skill_id = skill_cfg["skill_id"]
                    for subskill_id in skill_cfg["subskills"]:
                        target_gate = _SEED_GATE_TARGETS[idx % len(_SEED_GATE_TARGETS)]
                        idx += 1

                        result = await _seed_subskill_to_gate(
                            engine=engine,
                            student_id=student_id,
                            subskill_id=subskill_id,
                            subject=subject,
                            skill_id=skill_id,
                            target_gate=target_gate,
                            now=now,
                        )
                        results.append(result)

        # Update global pass rate after all seeding
        await engine.update_global_pass_rate(student_id)

        # Build summary
        gate_counts = {str(g): 0 for g in range(5)}
        for r in results:
            gate_counts[str(r["final_gate"])] = gate_counts.get(str(r["final_gate"]), 0) + 1

        return {
            "success": True,
            "student_id": student_id,
            "subskills_seeded": len(results),
            "gate_distribution": gate_counts,
            "subjects": list({r["subject"] for r in results}),
            "details": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error seeding mastery data for student {student_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def _seed_subskill_to_gate(
    engine: MasteryLifecycleEngine,
    student_id: int,
    subskill_id: str,
    subject: str,
    skill_id: str,
    target_gate: int,
    now: datetime,
) -> Dict:
    """
    Simulate evaluation events to advance a subskill to the target gate.

    Uses backdated timestamps so the engine's retest eligibility checks pass.
    Sprinkles in occasional practice fails for realism.
    """
    evals_sent = 0

    async def _send(score: float, src: str, ts_str: str):
        nonlocal evals_sent
        await engine.process_eval_result(
            student_id=student_id, subskill_id=subskill_id,
            subject=subject, skill_id=skill_id,
            score=score, source=src, timestamp=ts_str,
        )
        evals_sent += 1

    def _result(final_gate: int) -> Dict:
        return {"subskill_id": subskill_id, "subject": subject, "skill_id": skill_id,
                "target_gate": target_gate, "final_gate": final_gate, "evals_sent": evals_sent}

    # --- Gate 0: send 1-2 lesson evals (not enough for Gate 1) ---
    if target_gate == 0:
        for i in range(2):
            await _send(9.5, "lesson", (now - timedelta(days=30 - i)).isoformat())
        return _result(0)

    # --- Gate 1+: need 3 lesson evals >= 9.0 ---
    for i in range(3):
        await _send(9.5, "lesson", (now - timedelta(days=30 - i)).isoformat())

    if target_gate == 1:
        return _result(1)

    # --- Gate 2+: practice fail then pass after 3-day interval ---
    await _send(7.0, "practice", (now - timedelta(days=25)).isoformat())
    await _send(9.5, "practice", (now - timedelta(days=20)).isoformat())

    if target_gate == 2:
        return _result(2)

    # --- Gate 3+: practice pass after 7-day interval ---
    await _send(9.5, "practice", (now - timedelta(days=10)).isoformat())

    if target_gate == 3:
        return _result(3)

    # --- Gate 4: fail then pass after 14-day interval ---
    await _send(6.5, "practice", (now - timedelta(days=5)).isoformat())
    await _send(9.5, "practice", now.isoformat())

    return _result(4)


# ==========================================================================
# Eval submission endpoint
# ==========================================================================


class EvalSubmission(BaseModel):
    """A single practice or lesson evaluation result from the frontend."""
    subskill_id: str = Field(..., description="Subskill being evaluated")
    subject: str = Field(..., description="Subject name (e.g. 'mathematics')")
    skill_id: str = Field(..., description="Parent skill identifier")
    score: float = Field(..., ge=0, le=10, description="Score on 0-10 scale (9.0 = 90%)")
    source: str = Field("practice", description="'lesson' or 'practice'")


@router.post("/{student_id}/eval")
async def submit_eval_result(
    student_id: int,
    body: EvalSubmission,
    user_context: dict = Depends(get_user_context),
    engine: MasteryLifecycleEngine = Depends(get_mastery_lifecycle_engine),
):
    """
    Record a practice or lesson evaluation result and advance the mastery gate
    if the student meets the threshold (score >= 9.0/10).

    Called by the frontend after a student completes a mastery gate session.
    """
    try:
        result = await engine.process_eval_result(
            student_id=student_id,
            subskill_id=body.subskill_id,
            subject=body.subject,
            skill_id=body.skill_id,
            score=body.score,
            source=body.source,
        )
        return {
            "student_id": student_id,
            "subskill_id": body.subskill_id,
            "result": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing eval for student {student_id}, subskill {body.subskill_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================================================
# Fixed-path routes (MUST come before wildcard /{student_id}/{subskill_id})
# ==========================================================================


@router.get("/{student_id}")
async def get_all_mastery_lifecycles(
    student_id: int,
    subject: Optional[str] = Query(None, description="Filter by subject"),
    user_context: dict = Depends(get_user_context),
    firestore: FirestoreService = Depends(get_firestore_service),
):
    """
    Get all mastery lifecycle documents for a student.

    Returns the gate state, completion factor, and retest schedule for
    every subskill the student has interacted with.
    """
    try:
        if not firestore:
            raise HTTPException(status_code=503, detail="Firestore service unavailable")

        lifecycles = await firestore.get_all_mastery_lifecycles(student_id, subject)

        return {
            "student_id": student_id,
            "count": len(lifecycles),
            "lifecycles": lifecycles,
            "queried_at": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mastery lifecycles for student {student_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{student_id}/summary")
async def get_mastery_summary(
    student_id: int,
    subject: Optional[str] = Query(None, description="Filter by subject"),
    user_context: dict = Depends(get_user_context),
    engine: MasteryLifecycleEngine = Depends(get_mastery_lifecycle_engine),
):
    """
    Aggregated mastery summary for a student (PRD Section 7.4).

    Returns per-subject and per-skill gate counts, completion averages,
    and overall progress metrics.
    """
    try:
        summary = await engine.get_student_mastery_summary(student_id, subject)
        summary["queried_at"] = datetime.now(timezone.utc).isoformat()
        return summary

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mastery summary for student {student_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{student_id}/forecast")
async def get_mastery_forecast(
    student_id: int,
    subject: Optional[str] = Query(None, description="Filter by subject"),
    avg_days: float = Query(5.0, description="Average days between practice attempts"),
    user_context: dict = Depends(get_user_context),
    engine: MasteryLifecycleEngine = Depends(get_mastery_lifecycle_engine),
):
    """
    Workload forecast for a student (PRD Section 7.4).

    Returns per-subskill ETA, per-unit ETA (max of subskill ETAs),
    and per-subject ETA (sum of sequential unit ETAs).
    """
    try:
        forecast = await engine.get_forecast(student_id, subject, avg_days)
        forecast["queried_at"] = datetime.now(timezone.utc).isoformat()
        return forecast

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mastery forecast for student {student_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{student_id}/retests/due")
async def get_mastery_retests_due(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    firestore: FirestoreService = Depends(get_firestore_service),
):
    """
    Get all subskills that have a mastery retest due (next_retest_eligible <= now).

    Used by the planner and frontend to show pending retests.
    """
    try:
        if not firestore:
            raise HTTPException(status_code=503, detail="Firestore service unavailable")

        now_iso = datetime.now(timezone.utc).isoformat()
        retests = await firestore.get_mastery_retests_due(student_id, now_iso)

        return {
            "student_id": student_id,
            "count": len(retests),
            "retests_due": retests,
            "checked_at": now_iso,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mastery retests due for student {student_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{student_id}/pass-rate")
async def get_global_practice_pass_rate(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    firestore: FirestoreService = Depends(get_firestore_service),
):
    """
    Get the student's global practice pass rate (PRD 6.4).

    Used for credibility blending in the actuarial completion factor model.
    """
    try:
        if not firestore:
            raise HTTPException(status_code=503, detail="Firestore service unavailable")

        return await firestore.get_global_practice_pass_rate(student_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting global pass rate for student {student_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================================================
# Wildcard routes (must come AFTER fixed-path routes)
# ==========================================================================


@router.get("/{student_id}/{subskill_id}/history")
async def get_mastery_gate_history(
    student_id: int,
    subskill_id: str,
    user_context: dict = Depends(get_user_context),
    firestore: FirestoreService = Depends(get_firestore_service),
):
    """
    Get the gate history timeline for a specific student + subskill.

    Returns the ordered list of gate evaluation events showing
    progression through the mastery lifecycle.
    """
    try:
        if not firestore:
            raise HTTPException(status_code=503, detail="Firestore service unavailable")

        lifecycle = await firestore.get_mastery_lifecycle(student_id, subskill_id)

        if lifecycle is None:
            return {
                "student_id": student_id,
                "subskill_id": subskill_id,
                "current_gate": 0,
                "gate_history": [],
                "total_events": 0,
            }

        return {
            "student_id": student_id,
            "subskill_id": subskill_id,
            "current_gate": lifecycle.get("current_gate", 0),
            "completion_pct": lifecycle.get("completion_pct", 0.0),
            "gate_history": lifecycle.get("gate_history", []),
            "total_events": len(lifecycle.get("gate_history", [])),
            "created_at": lifecycle.get("created_at"),
            "updated_at": lifecycle.get("updated_at"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting gate history for {subskill_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{student_id}/{subskill_id}")
async def get_mastery_lifecycle(
    student_id: int,
    subskill_id: str,
    user_context: dict = Depends(get_user_context),
    firestore: FirestoreService = Depends(get_firestore_service),
):
    """
    Get the mastery lifecycle for a specific student + subskill.

    Returns gate state, completion factor, pass rate, retest schedule,
    and full gate history.
    """
    try:
        if not firestore:
            raise HTTPException(status_code=503, detail="Firestore service unavailable")

        lifecycle = await firestore.get_mastery_lifecycle(student_id, subskill_id)

        if lifecycle is None:
            return {
                "student_id": student_id,
                "subskill_id": subskill_id,
                "current_gate": 0,
                "completion_pct": 0.0,
                "status": "not_started",
                "message": "No mastery lifecycle record exists for this subskill",
            }

        return lifecycle

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mastery lifecycle for {subskill_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
