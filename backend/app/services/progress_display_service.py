"""
Progress Display Service — Contextual Messaging for EL Trajectory (PRD §6.4)

Read-only service that fetches StudentAbility docs from Firestore
and computes phase-aware contextual messages based on the theta_history
trajectory.  No writes — this is purely a display layer.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from ..db.firestore_service import FirestoreService
from ..models.calibration_api import (
    ContextualMessage,
    SkillAbilityResponse,
    StudentAbilitySummaryResponse,
    ThetaHistoryPoint,
)

logger = logging.getLogger(__name__)

# Mastery threshold for contextual messaging (EL at which a skill
# is considered mastered).  Matches IRT_CORRECT_THRESHOLD from calibration.py.
DEFAULT_MASTERY_THRESHOLD = 9.0


class ProgressDisplayService:
    """
    Computes contextual EL trajectory messages for the student dashboard.
    """

    def __init__(self, firestore_service: FirestoreService):
        self.firestore = firestore_service

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_student_abilities_with_messages(
        self,
        student_id: int,
        mastery_threshold: float = DEFAULT_MASTERY_THRESHOLD,
    ) -> StudentAbilitySummaryResponse:
        """Fetch all skill abilities for a student with contextual messages."""
        raw_docs = await self.firestore.get_all_student_abilities(student_id)

        abilities: List[SkillAbilityResponse] = []
        for doc in raw_docs:
            ability = self._doc_to_response(doc, mastery_threshold)
            abilities.append(ability)

        # Sort by most recently updated first
        abilities.sort(key=lambda a: a.updated_at, reverse=True)

        return StudentAbilitySummaryResponse(
            student_id=student_id,
            abilities=abilities,
            count=len(abilities),
            queried_at=datetime.now(timezone.utc).isoformat(),
        )

    async def get_skill_ability_with_message(
        self,
        student_id: int,
        skill_id: str,
        mastery_threshold: float = DEFAULT_MASTERY_THRESHOLD,
    ) -> Optional[SkillAbilityResponse]:
        """Fetch single skill ability with contextual message."""
        doc = await self.firestore.get_student_ability(student_id, skill_id)
        if not doc:
            return None
        return self._doc_to_response(doc, mastery_threshold)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _doc_to_response(
        self,
        doc: dict,
        mastery_threshold: float,
    ) -> SkillAbilityResponse:
        """Convert a raw Firestore ability doc to a response with message."""
        history = [
            ThetaHistoryPoint(**entry)
            for entry in doc.get("theta_history", [])
        ]

        msg = self._compute_contextual_message(doc, mastery_threshold)

        return SkillAbilityResponse(
            skill_id=doc.get("skill_id", ""),
            theta=doc.get("theta", 3.0),
            sigma=doc.get("sigma", 2.0),
            earned_level=doc.get("earned_level", 3.0),
            total_items_seen=doc.get("total_items_seen", 0),
            prior_source=doc.get("prior_source", "default"),
            theta_history=history,
            contextual_message=msg,
            created_at=doc.get("created_at", ""),
            updated_at=doc.get("updated_at", ""),
        )

    def _compute_contextual_message(
        self,
        ability_data: dict,
        mastery_threshold: float,
    ) -> Optional[ContextualMessage]:
        """
        Determine trajectory phase and generate message (PRD §6.4).

        Priority order (highest first):
          1. mastery_achieved  — EL >= threshold
          2. near_target       — EL within 1.0 of threshold
          3. first_assessment  — only 1 history entry
          4. plateau           — last 3+ entries have same rounded EL
          5. early_growth      — EL increased >0.5 since previous session
          6. steady_climb      — EL increased 0.1–0.5
        """
        history: list = ability_data.get("theta_history", [])
        current_el: float = ability_data.get("earned_level", 3.0)
        skill_id: str = ability_data.get("skill_id", "this skill")

        if not history:
            return None

        # 1. Mastery achieved
        if current_el >= mastery_threshold:
            return ContextualMessage(
                phase="mastery_achieved",
                message=(
                    f"You've reached Level {current_el:.1f}! "
                    f"You've demonstrated mastery of {skill_id}."
                ),
                current_el=current_el,
                mastery_threshold=mastery_threshold,
            )

        # 2. Near target
        if mastery_threshold - current_el <= 1.0:
            return ContextualMessage(
                phase="near_target",
                message=(
                    f"You're at {current_el:.1f} \u2014 mastery is at "
                    f"{mastery_threshold:.1f}. Almost there."
                ),
                current_el=current_el,
                mastery_threshold=mastery_threshold,
            )

        # 3. First assessment
        if len(history) == 1:
            return ContextualMessage(
                phase="first_assessment",
                message=(
                    f"You're starting at Level {current_el:.1f}. "
                    "This is your baseline \u2014 let's see how fast you can climb!"
                ),
                current_el=current_el,
                mastery_threshold=mastery_threshold,
            )

        # For remaining phases, compute the previous session EL.
        # "Previous session" = last history entry before the most recent one.
        prev_el = history[-2].get("earned_level", current_el) if len(history) >= 2 else current_el
        delta = current_el - prev_el

        # 4. Plateau — last 3+ entries have same rounded EL
        if len(history) >= 3:
            recent_els = [
                round(entry.get("earned_level", 0), 1) for entry in history[-3:]
            ]
            if len(set(recent_els)) == 1:
                return ContextualMessage(
                    phase="plateau",
                    message=(
                        f"You're holding steady at {current_el:.1f}. "
                        "Let's try a focused practice set to break through."
                    ),
                    previous_el=prev_el,
                    current_el=current_el,
                    mastery_threshold=mastery_threshold,
                )

        # 5. Early growth — delta > 0.5
        if delta > 0.5:
            return ContextualMessage(
                phase="early_growth",
                message=(
                    f"You jumped from {prev_el:.1f} to {current_el:.1f}! "
                    "That's real progress."
                ),
                previous_el=prev_el,
                current_el=current_el,
                mastery_threshold=mastery_threshold,
            )

        # 6. Steady climb — 0.1 <= delta <= 0.5
        if 0.1 <= delta <= 0.5:
            return ContextualMessage(
                phase="steady_climb",
                message=(
                    f"You moved from {prev_el:.1f} to {current_el:.1f}. "
                    "Consistent work is paying off."
                ),
                previous_el=prev_el,
                current_el=current_el,
                mastery_threshold=mastery_threshold,
            )

        # Fallback — no significant change, but not enough for plateau
        return None
