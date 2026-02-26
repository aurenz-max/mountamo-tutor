# backend/app/services/eval_events_service.py
"""
Eval Events Service

Manages evaluation event persistence and subskill progress updates
using Firestore with nested subcollections.

Collection structure:
    students/{student_id}/eval_events/{event_id}       — append-only event log
    students/{student_id}/subskill_progress/{subskill_id} — materialized mastery state
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from ..db.firestore_service import FirestoreService
from ..schemas.lesson_manifest import EvalEventRequest, SubskillProgress

logger = logging.getLogger(__name__)

# Mastery level thresholds
MASTERY_THRESHOLDS = {
    "mastered": 0.90,
    "proficient": 0.75,
    "developing": 0.50,
    "emerging": 0.0,
}

# Rolling window size for recent accuracy
HISTORY_WINDOW_SIZE = 10


def _determine_level(accuracy: float) -> str:
    """Determine mastery level from accuracy."""
    if accuracy >= MASTERY_THRESHOLDS["mastered"]:
        return "mastered"
    elif accuracy >= MASTERY_THRESHOLDS["proficient"]:
        return "proficient"
    elif accuracy >= MASTERY_THRESHOLDS["developing"]:
        return "developing"
    return "emerging"


class EvalEventsService:
    """Manages eval event persistence and subskill progress updates."""

    def __init__(self, firestore_service: FirestoreService):
        self.db = firestore_service.client

    def _student_ref(self, student_id: str):
        return self.db.collection("students").document(student_id)

    def _eval_events_ref(self, student_id: str):
        return self._student_ref(student_id).collection("eval_events")

    def _subskill_progress_ref(self, student_id: str):
        return self._student_ref(student_id).collection("subskill_progress")

    async def log_eval_event(self, event: EvalEventRequest) -> str:
        """
        Log an evaluation event and update subskill progress.

        1. Write the raw event to students/{student_id}/eval_events/{event_id}
        2. For each linked subskill, update subskill_progress
        """
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        event_doc = {
            "event_id": event_id,
            "timestamp": now,
            "student_id": event.student_id,
            "primitive_id": event.primitive_id,
            "primitive_type": event.primitive_type,
            "lesson_id": event.lesson_id,
            "subskill_ids": event.subskill_ids,
            "score": event.score,
            "duration_ms": event.duration_ms,
            "attempts": event.attempts,
            "difficulty_band": event.difficulty_band,
            "challenge_details": event.challenge_details,
        }

        # 1. Write the raw event
        self._eval_events_ref(event.student_id).document(event_id).set(event_doc)
        logger.info(f"Logged eval event {event_id} for student {event.student_id}")

        # 2. Update subskill progress for each linked subskill
        normalized_score = event.score / 100.0  # Convert 0-100 to 0-1

        for subskill_id in event.subskill_ids:
            try:
                self._update_subskill_progress(
                    event.student_id,
                    subskill_id,
                    normalized_score,
                )
            except Exception as e:
                logger.error(
                    f"Failed to update progress for subskill {subskill_id}: {e}"
                )

        return event_id

    def _update_subskill_progress(
        self,
        student_id: str,
        subskill_id: str,
        score: float,
    ) -> None:
        """
        Read-modify-write the materialized subskill progress.
        Uses Firestore transaction for consistency.
        """
        progress_ref = self._subskill_progress_ref(student_id).document(subskill_id)

        @self.db.transactional
        def update_in_transaction(transaction, ref):
            snapshot = ref.get(transaction=transaction)
            now = datetime.now(timezone.utc).isoformat()

            if snapshot.exists:
                data = snapshot.to_dict()
                total_attempts = data.get("total_attempts", 0) + 1
                history = data.get("history_window", [])
                history.append(score)
                # Keep only last N scores
                if len(history) > HISTORY_WINDOW_SIZE:
                    history = history[-HISTORY_WINDOW_SIZE:]
                recent_accuracy = sum(history) / len(history) if history else 0.0
            else:
                total_attempts = 1
                history = [score]
                recent_accuracy = score

            level = _determine_level(recent_accuracy)

            transaction.set(ref, {
                "subskill_id": subskill_id,
                "current_level": level,
                "total_attempts": total_attempts,
                "recent_accuracy": round(recent_accuracy, 4),
                "last_practiced": now,
                "history_window": history,
            })

        transaction = self.db.transaction()
        update_in_transaction(transaction, progress_ref)
        logger.info(f"Updated subskill progress for {student_id}/{subskill_id}")

    async def get_subskill_progress(
        self,
        student_id: str,
        subskill_ids: Optional[list[str]] = None,
    ) -> list[SubskillProgress]:
        """Read subskill progress for a student."""
        progress_ref = self._subskill_progress_ref(student_id)

        if subskill_ids:
            # Fetch specific subskills
            results = []
            for sid in subskill_ids:
                doc = progress_ref.document(sid).get()
                if doc.exists:
                    results.append(SubskillProgress(**doc.to_dict()))
                else:
                    results.append(SubskillProgress(subskill_id=sid))
            return results
        else:
            # Fetch all subskill progress for the student
            docs = progress_ref.stream()
            return [SubskillProgress(**doc.to_dict()) for doc in docs]
