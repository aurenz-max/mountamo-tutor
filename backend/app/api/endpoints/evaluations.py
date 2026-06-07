# backend/app/api/endpoints/evaluations.py
"""
Evaluations API — student activity history & stats for Lumina primitives.

Read surface over the durable attempt log (Firestore students/{id}/attempts),
plus engagement totals (XP/level/streak) from the user profile. This backs the
Lumina "Student Activity" dev/QA view and resolves the previously-dead
/api/evaluations/student/{id}/history and /stats routes the frontend already calls.

Scope (slice): history + stats only. submit-batch / session-summary / replay are
intentionally deferred to a later PRD.

Response keys are camelCase to match the existing frontend contract in
my-tutoring-app/src/components/lumina/evaluation/api/evaluationApi.ts.
"""

from typing import Optional, List, Dict, Any
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from ...core.middleware import get_user_context
from ...dependencies import get_firestore_service
from ...services.user_profiles import user_profiles_service

router = APIRouter()
logger = logging.getLogger(__name__)

# Caps — keep the dev/QA view bounded. Surfaced via `hasMore`/`total` so the
# client can tell when results were truncated.
_MAX_FETCH = 500
_TREND_DELTA = 5.0  # avg-score points (0-100) that count as a real trend


def _attempt_to_row(a: Dict[str, Any]) -> Dict[str, Any]:
    """Map a stored attempt doc to a camelCase activity row.

    Stored attempt score is on the backend 0-10 scale; the frontend convention
    is 0-100, so we scale here. `success`/`primitive_type`/`eval_mode` are
    promoted onto the attempt doc by the submit path, but historical attempts
    predating that fall back gracefully.
    """
    score10 = a.get('score') or 0
    success = a.get('success')
    if success is None:
        success = score10 >= 8  # legacy fallback (backend 0-10 scale)
    return {
        "attemptId": a.get('id'),
        "primitiveType": a.get('primitive_type') or 'unknown',
        "evalMode": a.get('eval_mode') or 'default',
        "skillId": a.get('skill_id'),
        "subskillId": a.get('subskill_id'),
        "subject": a.get('subject'),
        "score": round(score10 * 10, 1),  # 0-10 → 0-100
        "success": bool(success),
        "source": a.get('source'),
        "completedAt": a.get('timestamp') or a.get('created_at'),
    }


async def _fetch_rows(
    student_id: int,
    primitive_type: Optional[str],
    skill_id: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> List[Dict[str, Any]]:
    """Fetch attempts (already sorted newest-first) and apply Python-side
    filters the Firestore query can't express together."""
    fs = get_firestore_service()
    if start_date or end_date:
        attempts = await fs.get_student_attempts_date_range(
            student_id, start_date=start_date, end_date=end_date, limit=_MAX_FETCH
        )
    else:
        attempts = await fs.get_student_attempts(
            student_id, skill_id=skill_id, limit=_MAX_FETCH
        )

    rows = [_attempt_to_row(a) for a in attempts]
    if primitive_type:
        rows = [r for r in rows if r["primitiveType"] == primitive_type]
    if skill_id:  # also enforce when we went through the date-range path
        rows = [r for r in rows if r["skillId"] == skill_id]
    return rows


def _aggregate(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Per-group success-rate / average-score, plus a coarse recent trend."""
    def group(key: str) -> Dict[str, Dict[str, float]]:
        buckets: Dict[str, List[Dict[str, Any]]] = {}
        for r in rows:
            buckets.setdefault(r.get(key) or 'unknown', []).append(r)
        out: Dict[str, Dict[str, float]] = {}
        for name, items in buckets.items():
            n = len(items)
            out[name] = {
                "attempts": n,
                "successRate": round(sum(1 for i in items if i["success"]) / n, 4),
                "averageScore": round(sum(i["score"] for i in items) / n, 2),
            }
        return out

    total = len(rows)
    if total == 0:
        return {
            "totalAttempts": 0,
            "successRate": 0.0,
            "averageScore": 0.0,
            "byPrimitiveType": {},
            "bySkill": {},
            "recentTrend": "stable",
        }

    # rows arrive newest-first; compare the recent half vs the older half.
    recent_trend = "stable"
    if total >= 4:
        half = total // 2
        recent_avg = sum(r["score"] for r in rows[:half]) / half
        older_avg = sum(r["score"] for r in rows[half:]) / (total - half)
        if recent_avg - older_avg > _TREND_DELTA:
            recent_trend = "improving"
        elif older_avg - recent_avg > _TREND_DELTA:
            recent_trend = "declining"

    return {
        "totalAttempts": total,
        "successRate": round(sum(1 for r in rows if r["success"]) / total, 4),
        "averageScore": round(sum(r["score"] for r in rows) / total, 2),
        "byPrimitiveType": group("primitiveType"),
        "bySkill": group("skillId"),
        "recentTrend": recent_trend,
    }


@router.get("/student/{student_id}/history")
async def get_evaluation_history(
    student_id: int,
    primitive_type: Optional[str] = Query(None),
    skill_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=_MAX_FETCH),
    offset: int = Query(0, ge=0),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user_context: dict = Depends(get_user_context),
) -> Dict[str, Any]:
    """Paginated activity history for a student (newest first)."""
    try:
        rows = await _fetch_rows(student_id, primitive_type, skill_id, start_date, end_date)
        total = len(rows)
        page = rows[offset:offset + limit]
        return {
            "evaluations": page,
            "total": total,
            "hasMore": offset + limit < total,
        }
    except Exception as e:
        logger.error(f"Failed to get evaluation history for student {student_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get evaluation history")


@router.get("/student/{student_id}/stats")
async def get_evaluation_stats(
    student_id: int,
    primitive_type: Optional[str] = Query(None),
    skill_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user_context: dict = Depends(get_user_context),
) -> Dict[str, Any]:
    """Aggregated activity stats + engagement totals for a student."""
    try:
        rows = await _fetch_rows(student_id, primitive_type, skill_id, start_date, end_date)
        stats = _aggregate(rows)

        # Engagement totals (XP/level/streak) live on the user profile (Cosmos).
        engagement = None
        try:
            firebase_uid = user_context.get("firebase_uid")
            profile = await user_profiles_service.get_user_profile(firebase_uid) if firebase_uid else None
            if profile:
                engagement = {
                    "totalXp": getattr(profile, "total_xp", 0),
                    "currentLevel": getattr(profile, "current_level", 1),
                    "currentStreak": getattr(profile, "current_streak", 0),
                }
        except Exception as e:
            logger.warning(f"Could not load engagement profile for stats: {e}")

        stats["engagement"] = engagement
        return stats
    except Exception as e:
        logger.error(f"Failed to get evaluation stats for student {student_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get evaluation stats")
