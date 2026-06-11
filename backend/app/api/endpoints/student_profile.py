# backend/app/api/endpoints/student_profile.py
"""
Student profile endpoints — per-student context for content generation.

POST /generation-context is the personalization keystone: given a lesson's
learning objectives (from the curator brief), it resolves each objective to a
curriculum subskill via the existing scoped embedding retrieval (abstain-capable,
never forced), then returns the student's IRT/mastery state for the resolved
nodes in a compact, prompt-embeddable shape.

Design rules (CLAUDE.md / project feedback):
- Retrieval, not generation: objectives map to subskills through
  CurriculumRetrievalMatcher. An abstain means "personalize at grade level
  only" for that objective — never a forced guess.
- Pure IRT: the response surfaces model quantities as-is (theta, P(correct),
  gates, competency). No hand-tuned urgency or priority formulas.
- Fail-soft: any error returns {"available": false}. Callers treat that as
  "generate without personalization" — this endpoint must never block a lesson.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ...core.middleware import get_user_context
from ...dependencies import (
    get_competency_service,
    get_curriculum_mapping_service,
    get_firestore_service,
)
from ...services.calibration_engine import CalibrationEngine, p_correct
from ...config.discrimination_priors import DEFAULT_DISCRIMINATION_PRIOR

logger = logging.getLogger(__name__)

router = APIRouter()

# Canonical curriculum subject IDs (matches CURRICULUM_SUBJECT_IDS on the frontend)
_CANONICAL_SUBJECTS = {"MATHEMATICS", "LANGUAGE_ARTS", "SCIENCE", "SOCIAL_STUDIES"}

# The curator brief emits freeform subject names ("Mathematics", "Earth Science");
# normalize to the canonical IDs the retrieval matcher scopes by.
_SUBJECT_ALIASES: Dict[str, str] = {
    "math": "MATHEMATICS",
    "mathematics": "MATHEMATICS",
    "language arts": "LANGUAGE_ARTS",
    "language_arts": "LANGUAGE_ARTS",
    "english": "LANGUAGE_ARTS",
    "ela": "LANGUAGE_ARTS",
    "literacy": "LANGUAGE_ARTS",
    "reading": "LANGUAGE_ARTS",
    "writing": "LANGUAGE_ARTS",
    "science": "SCIENCE",
    "biology": "SCIENCE",
    "chemistry": "SCIENCE",
    "physics": "SCIENCE",
    "astronomy": "SCIENCE",
    "engineering": "SCIENCE",
    "social studies": "SOCIAL_STUDIES",
    "social_studies": "SOCIAL_STUDIES",
    "history": "SOCIAL_STUDIES",
    "geography": "SOCIAL_STUDIES",
    "civics": "SOCIAL_STUDIES",
    "economics": "SOCIAL_STUDIES",
}


def _normalize_subject(subject: Optional[str]) -> Optional[str]:
    if not subject:
        return None
    s = subject.strip()
    if s.upper() in _CANONICAL_SUBJECTS:
        return s.upper()
    low = s.lower()
    if low in _SUBJECT_ALIASES:
        return _SUBJECT_ALIASES[low]
    # Substring fallback for compounds like "Earth Science" / "U.S. History"
    for alias, canonical in _SUBJECT_ALIASES.items():
        if alias in low:
            return canonical
    return None


class ObjectiveIn(BaseModel):
    id: str
    text: str
    verb: Optional[str] = None


class GenerationContextRequest(BaseModel):
    student_id: int
    topic: str
    grade_level: Optional[str] = None
    subject: Optional[str] = None
    objectives: List[ObjectiveIn] = Field(default_factory=list, max_length=12)


def _objective_state(
    mapping,
    lifecycle: Optional[Dict[str, Any]],
    competency: Optional[Dict[str, Any]],
    ability: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Assemble one objective's student-state entry from the resolved pieces."""
    gate = int((lifecycle or {}).get("current_gate", 0) or 0)
    retention_state = (lifecycle or {}).get("retention_state", "not_started")
    score = float((competency or {}).get("current_score", 0.0) or 0.0)
    credibility = float((competency or {}).get("credibility", 0.0) or 0.0)
    attempts = int((competency or {}).get("total_attempts", 0) or 0)

    theta = (ability or {}).get("theta")
    p_est: Optional[float] = None
    if theta is not None:
        beta = CalibrationEngine.compute_skill_beta_median(ability)
        p_est = round(
            p_correct(
                float(theta),
                DEFAULT_DISCRIMINATION_PRIOR.a,
                beta,
                DEFAULT_DISCRIMINATION_PRIOR.c,
            ),
            3,
        )

    if attempts == 0 and gate == 0 and theta is None:
        perf = "no recorded attempts — treat as new material"
    else:
        perf = (
            f"mastery gate {gate}/4 ({retention_state}), "
            f"competency {score:.1f}/10 over {attempts} attempts "
            f"(credibility {credibility:.2f})"
        )
        if p_est is not None:
            perf += f", estimated P(correct) at typical item difficulty ≈ {p_est:.0%}"

    summary = f'Maps to "{mapping.subskill_description}" ({mapping.subskill_id}): {perf}.'

    return {
        "tier": "exact",
        "subskillId": mapping.subskill_id,
        "subskillDescription": mapping.subskill_description,
        "skillId": mapping.skill_id,
        "confidence": mapping.confidence,
        "masteryGate": gate,
        "retentionState": retention_state,
        "competencyScore": score,
        "credibility": credibility,
        "totalAttempts": attempts,
        "theta": theta,
        "pCorrect": p_est,
        "summary": summary,
    }


_ABSTAIN_STATE: Dict[str, Any] = {
    "tier": "none",
    "summary": "No confident curriculum match — personalize at grade level only.",
}


@router.post("/generation-context")
async def get_generation_context(
    request: GenerationContextRequest,
    user_context: dict = Depends(get_user_context),
    competency_service=Depends(get_competency_service),
    mapping_service=Depends(get_curriculum_mapping_service),
):
    """Resolve lesson objectives to curriculum subskills and return the
    student's state on each. Fail-soft: always 200; `available: false` means
    the caller should generate without personalization."""
    firestore = get_firestore_service()
    try:
        subject_id = _normalize_subject(request.subject)
        base: Dict[str, Any] = {
            "available": False,
            "studentId": str(request.student_id),
            "subject": subject_id,
            "objectives": [],
        }
        if not request.objectives:
            base["reason"] = "no_objectives"
            return base
        if subject_id is None:
            base["reason"] = "no_subject_scope"
            return base

        # 1. Resolve each objective SEQUENTIALLY. The retrieval matcher's lazy
        #    client and per-(subject,grade) embed cache are not safe under
        #    concurrent first calls (racing them GC's a client mid-request and
        #    duplicates the curriculum embedding warm-up). After warm-up each
        #    match is a single query embedding (~100ms), so serial is cheap.
        mappings = []
        for obj in request.objectives:
            try:
                mappings.append(
                    await mapping_service.retrieval_matcher.match(
                        subject=subject_id,
                        grade_level=request.grade_level,
                        query_text=f"{obj.text}. Topic: {request.topic}",
                        primitive_type=f"objective:{obj.id}",
                    )
                )
            except Exception as e:
                logger.warning(f"[GENERATION_CONTEXT] Resolution failed for {obj.id}: {e}")
                mappings.append(None)

        # 2. Batch the mastery reads, then fetch competency + ability per
        #    resolved node concurrently.
        resolved_subskills = list({m.subskill_id for m in mappings if m})
        lifecycles: Dict[str, Optional[Dict[str, Any]]] = {}
        if resolved_subskills:
            lifecycles = await firestore.get_mastery_lifecycles_batch(
                request.student_id, resolved_subskills
            )

        async def _state_for(mapping):
            if mapping is None:
                return dict(_ABSTAIN_STATE)
            try:
                comp, ability = await asyncio.gather(
                    competency_service.get_competency(
                        student_id=request.student_id,
                        subject=subject_id,
                        skill_id=mapping.skill_id,
                        subskill_id=mapping.subskill_id,
                    ),
                    firestore.get_student_ability(request.student_id, mapping.skill_id),
                )
            except Exception as e:
                logger.warning(
                    f"[GENERATION_CONTEXT] State fetch failed for {mapping.subskill_id}: {e}"
                )
                comp, ability = None, None
            return _objective_state(
                mapping, lifecycles.get(mapping.subskill_id), comp, ability
            )

        states = await asyncio.gather(*[_state_for(m) for m in mappings])

        objectives_out = []
        for obj, state in zip(request.objectives, states):
            entry = {"objectiveId": obj.id, "objectiveText": obj.text}
            entry.update(state)
            objectives_out.append(entry)

        # 3. Factual overall summary — posture guidance lives in the manifest
        #    prompt template, not here.
        resolved = [o for o in objectives_out if o["tier"] == "exact"]
        p_values = [o["pCorrect"] for o in resolved if o.get("pCorrect") is not None]
        parts = [
            f"{len(resolved)} of {len(objectives_out)} objectives resolved to curriculum subskills."
        ]
        if p_values:
            parts.append(
                f"Mean estimated P(correct) across resolved objectives: "
                f"{sum(p_values) / len(p_values):.0%}."
            )
        new_count = sum(
            1 for o in resolved if o.get("totalAttempts", 0) == 0 and o.get("theta") is None
        )
        if new_count:
            parts.append(f"{new_count} resolved objective(s) are new material for this student.")

        logger.info(
            f"[GENERATION_CONTEXT] student={request.student_id} subject={subject_id} "
            f"grade={request.grade_level!r}: {len(resolved)}/{len(objectives_out)} resolved"
        )

        return {
            "available": True,
            "studentId": str(request.student_id),
            "subject": subject_id,
            "gradeLevel": request.grade_level,
            "overallSummary": " ".join(parts),
            "objectives": objectives_out,
        }

    except Exception as e:
        logger.error(f"[GENERATION_CONTEXT] Failed for student {request.student_id}: {e}")
        return {
            "available": False,
            "studentId": str(request.student_id),
            "reason": "internal_error",
            "objectives": [],
        }
