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
- Words vs numbers: the `studentProfile` persona (name, interests, streak,
  last session) feeds prompt FRAMING only. Difficulty/scope/phase decisions
  stay with the per-objective IRT state — never with the persona.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

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
    # When the lesson was launched from a known curriculum node (e.g. a daily-
    # session block), the objective's subskill is already known. Supplying it
    # lets the resolver skip embedding retrieval entirely — β becomes a keyed
    # read. skill_id is optional; it's derived from subskill_id when absent.
    subskill_id: Optional[str] = None
    skill_id: Optional[str] = None


class CurriculumContextIn(BaseModel):
    """Single known curriculum node for the whole lesson (single-subskill launch
    from the curriculum browser). Applied to every objective that doesn't carry
    its own subskill_id."""
    skill_id: str
    subskill_id: str


class GenerationContextRequest(BaseModel):
    student_id: int
    topic: str
    grade_level: Optional[str] = None
    subject: Optional[str] = None
    objectives: List[ObjectiveIn] = Field(default_factory=list, max_length=12)
    curriculum_context: Optional[CurriculumContextIn] = None
    # The persona (name, interests, last session) is the SAME on every call for a
    # student — it doesn't depend on the objectives. The lesson pipeline fetches
    # it once up front (for the brief greeting), so the objective-resolving call
    # passes include_persona=False to skip a redundant attempt-log read. Defaults
    # True so standalone callers still get it.
    include_persona: bool = True


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


class _KnownMapping:
    """Stand-in for a CurriculumRetrievalMatcher result when the subskill is
    already known (curriculum-launched lesson). Exposes the same attributes
    _objective_state reads off a real match, so downstream state assembly is
    identical to the retrieval path — only the embedding lookup is skipped."""

    __slots__ = ("subskill_id", "skill_id", "subskill_description", "confidence")

    def __init__(self, subskill_id: str, skill_id: str, description: str):
        self.subskill_id = subskill_id
        self.skill_id = skill_id
        self.subskill_description = description
        self.confidence = 1.0


def _derive_skill_id(subskill_id: str) -> str:
    """Fallback skill_id from a subskill_id when none is supplied — mirrors the
    frontend's dot-trim (App.tsx handleBlockStart). Fail-soft: a wrong guess
    just yields no competency/ability data (treated as new material), never an
    error."""
    dot = subskill_id.rfind(".")
    return subskill_id[:dot] if dot > 0 else subskill_id


# ---------------------------------------------------------------------------
# Student persona (voice personalization — words, not numbers)
#
# The persona block carries identity/engagement facts the manifest prompt can
# use for FRAMING ONLY: greeting by name, interest theming, "last time you
# worked on..." continuity. It never carries model quantities — difficulty and
# phase weighting stay with the IRT objective states above.
#
# NOTE: the persona comes from the AUTHENTICATED user's profile (Cosmos, via
# user_context) while IRT state is keyed by request.student_id. In production
# these are the same student; in dev they can diverge (test student 1004).
# ---------------------------------------------------------------------------

_RECENT_ATTEMPTS_LIMIT = 50


def _first_name(display_name: Optional[str]) -> Optional[str]:
    """First token of the display name; rejects email-shaped values."""
    if not display_name or "@" in display_name:
        return None
    tokens = display_name.strip().split()
    return tokens[0] if tokens else None


def _parse_ts(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _last_session_from_attempts(attempts: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Summarize the most recent calendar day of activity from the durable
    attempt log (same docs the evaluations history endpoint reads)."""
    dated = []
    for a in attempts:
        ts = _parse_ts(a.get("timestamp") or a.get("created_at"))
        if ts is not None:
            dated.append((ts, a))
    if not dated:
        return None

    dated.sort(key=lambda pair: pair[0], reverse=True)
    last_day = dated[0][0].date()
    day_attempts = [a for ts, a in dated if ts.date() == last_day]

    successes = 0
    primitive_types: List[str] = []
    for a in day_attempts:
        success = a.get("success")
        if success is None:  # legacy fallback (backend 0-10 scale)
            success = (a.get("score") or 0) >= 8
        if success:
            successes += 1
        prim = a.get("primitive_type")
        if prim and prim not in primitive_types:
            primitive_types.append(prim)

    count = len(day_attempts)
    success_rate = successes / count if count else 0.0
    prim_text = ", ".join(primitive_types[:4]) if primitive_types else "practice activities"
    summary = (
        f"Last session ({last_day.isoformat()}): {count} activities on {prim_text} "
        f"({successes}/{count} successful)."
    )
    return {
        "date": last_day.isoformat(),
        "activityCount": count,
        "successRate": round(success_rate, 3),
        "primitiveTypes": primitive_types,
        "summary": summary,
    }


async def _build_student_persona(
    user_context: Dict[str, Any], firestore, student_id: int
) -> Optional[Dict[str, Any]]:
    """Assemble the voice-personalization persona. Fail-soft: returns None on
    any error or when nothing personally useful exists."""
    try:
        first_name = _first_name(user_context.get("display_name"))
        preferences = user_context.get("preferences") or {}
        onboarding = preferences.get("onboarding") or {}

        # Free-form interests (forward-compatible — not yet collected by
        # onboarding; honored from preferences as soon as something writes it).
        interests = preferences.get("interests") or onboarding.get("interests") or []
        interests = [i for i in interests if isinstance(i, str)][:8]

        learning_goals = [g for g in onboarding.get("learningGoals") or [] if isinstance(g, str)]
        learning_styles = [
            s for s in onboarding.get("preferredLearningStyle") or [] if isinstance(s, str)
        ]
        streak = int(user_context.get("current_streak") or 0)

        try:
            attempts = await firestore.get_student_attempts(
                student_id, limit=_RECENT_ATTEMPTS_LIMIT
            )
        except Exception as e:
            logger.warning(f"[GENERATION_CONTEXT] Recent-attempts fetch failed: {e}")
            attempts = []
        last_session = _last_session_from_attempts(attempts or [])

        # Streak/goals alone aren't enough to be worth a prompt block.
        if not first_name and not interests and not last_session:
            return None

        parts = []
        if first_name:
            parts.append(f"Student goes by {first_name}")
        if interests:
            parts.append(f"interests: {', '.join(interests)}")
        if streak >= 2:
            parts.append(f"on a {streak}-day learning streak")
        if last_session:
            parts.append(last_session["summary"])

        return {
            "firstName": first_name,
            "interests": interests,
            "learningGoals": learning_goals,
            "preferredLearningStyles": learning_styles,
            "currentStreak": streak,
            "lastSession": last_session,
            "summary": ". ".join(parts) + ".",
        }
    except Exception as e:
        logger.warning(f"[GENERATION_CONTEXT] Persona build failed (continuing without): {e}")
        return None


@router.post("/generation-context")
async def get_generation_context(
    request: GenerationContextRequest,
    user_context: dict = Depends(get_user_context),
    competency_service=Depends(get_competency_service),
    mapping_service=Depends(get_curriculum_mapping_service),
):
    """Resolve lesson objectives to curriculum subskills and return the
    student's state on each, plus a voice persona (name, interests, last
    session) for prompt framing. Fail-soft: always 200; `available: false`
    means the caller should generate without personalization. A usable persona
    alone makes the context available even when no objective resolves."""
    firestore = get_firestore_service()
    try:
        subject_id = _normalize_subject(request.subject)
        # Skip the persona build (and its attempt-log read) when the caller
        # already has it — see include_persona on the request model.
        persona = (
            await _build_student_persona(user_context, firestore, request.student_id)
            if request.include_persona
            else None
        )
        base: Dict[str, Any] = {
            "available": persona is not None,
            "studentId": str(request.student_id),
            "subject": subject_id,
            "studentProfile": persona,
            "objectives": [],
        }
        if not request.objectives:
            base["reason"] = "no_objectives"
            return base
        if subject_id is None:
            base["reason"] = "no_subject_scope"
            return base

        # 1. Resolve each objective to a curriculum subskill.
        #    Curriculum-launched lessons already KNOW the subskill (from the
        #    browser or a daily-session block), so they skip embedding retrieval
        #    entirely — β becomes a keyed read below. Only free-form objectives
        #    (no known id) hit the matcher, which stays SEQUENTIAL: its lazy
        #    client and per-(subject,grade) embed cache aren't safe under
        #    concurrent first calls (racing them GC's a client mid-request and
        #    duplicates the warm-up). After warm-up each match is ~100ms.
        ctx = request.curriculum_context
        mappings = []
        for obj in request.objectives:
            known_subskill = obj.subskill_id or (ctx.subskill_id if ctx else None)
            if known_subskill:
                known_skill = (
                    obj.skill_id
                    or (ctx.skill_id if ctx else None)
                    or _derive_skill_id(known_subskill)
                )
                # obj.text is the subskill description on every curriculum-
                # launched path (browser/block/group), so it's a faithful label.
                mappings.append(_KnownMapping(known_subskill, known_skill, obj.text))
                continue
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
        active_misconceptions: Dict[str, Dict[str, Any]] = {}
        if resolved_subskills:
            lifecycles, active_misconceptions = await asyncio.gather(
                firestore.get_mastery_lifecycles_batch(
                    request.student_id, resolved_subskills
                ),
                firestore.get_active_misconceptions(
                    request.student_id, resolved_subskills
                ),
            )
        else:
            # Primitive-scoped diagnoses also apply in explore mode, where no
            # curriculum objective may resolve. Keep this as one session read.
            active_misconceptions = await firestore.get_active_misconceptions(
                request.student_id
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
        for obj, mapping, state in zip(request.objectives, mappings, states):
            entry = {"objectiveId": obj.id, "objectiveText": obj.text}
            entry.update(state)
            objectives_out.append(entry)

        misconceptions_out = [
            {
                "text": item.get("misconception_text"),
                "detectedAt": item.get("last_detected_at"),
                "sourceAttemptId": item.get("source_attempt_id"),
                "primitiveType": item.get("primitive_type"),
                "scope": item.get("scope"),
                "skillId": item.get("skill_id"),
                "subskillId": item.get("subskill_id"),
                "misconceptionKey": item.get("misconception_key") or key,
            }
            for key, item in active_misconceptions.items()
            if item.get("primitive_type") and item.get("scope")
        ]

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
            "studentProfile": persona,
            "objectives": objectives_out,
            "activeMisconceptions": misconceptions_out,
        }

    except Exception as e:
        logger.error(f"[GENERATION_CONTEXT] Failed for student {request.student_id}: {e}")
        return {
            "available": False,
            "studentId": str(request.student_id),
            "reason": "internal_error",
            "objectives": [],
        }


# =============================================================================
# Misconception Loop — S3 transport (PRD_MISCONCEPTION_LOOP.md)
# =============================================================================
# The frontend distiller (S2) POSTs a diagnosed misconception here after the
# submission round-trip has already resolved — fire-and-forget, so this endpoint
# must never grow LLM calls or block on anything slow. Backend's role is store
# only; diagnosis happens at the point of primitive.


class MisconceptionIn(BaseModel):
    primitive_type: str = Field(..., min_length=1, max_length=120, pattern=r"^[a-z0-9-]+$")
    scope: Literal["primitive", "skill"]
    subskill_id: Optional[str] = None
    skill_id: Optional[str] = None
    misconception_text: str = Field(..., min_length=1, max_length=600)
    confidence: Optional[str] = None      # 'high' | 'medium' (distiller echo)
    evidence_tier: Optional[str] = None   # 'judge' | 'structured' (distiller echo)
    source_attempt_id: str


@router.post("/misconceptions")
async def record_misconception(
    request: MisconceptionIn,
    user_context: dict = Depends(get_user_context),
):
    """Store the active misconception for (student, subskill) — one slot,
    overwritten on re-detection. Student identity comes from auth, never the body."""
    firestore = get_firestore_service()
    student_id = user_context.get("student_id")
    if firestore is None or student_id is None:
        # Fail-soft: a dropped write costs one diagnosis, never a submission.
        return {"stored": False, "reason": "unavailable"}

    try:
        stored = await firestore.add_or_update_misconception(
            student_id=int(student_id),
            primitive_type=request.primitive_type,
            scope=request.scope,
            skill_id=(
                request.skill_id or _derive_skill_id(request.subskill_id)
                if request.scope == "skill" and request.subskill_id
                else None
            ),
            subskill_id=request.subskill_id,
            misconception_text=request.misconception_text,
            source_attempt_id=request.source_attempt_id,
            confidence=request.confidence,
            evidence_tier=request.evidence_tier,
            firebase_uid=user_context.get("firebase_uid"),
        )
        return {
            "stored": True,
            "misconceptionKey": stored.get("misconception_key"),
            "status": stored.get("status"),
        }
    except Exception as e:
        logger.error(
            f"[MISCONCEPTION] Store failed for student {student_id}, "
            f"subskill {request.subskill_id}: {e}"
        )
        return {"stored": False, "reason": "internal_error"}
