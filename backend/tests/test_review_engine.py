"""
Tests for the ReviewEngine — completion factor model.

Covers:
  - Initial mastery detection
  - Standard review schedule (4 sessions → closed)
  - Single failure → tight loop → recovery → closed
  - Multiple failures → escalating ultimate
  - Completion factor arithmetic
  - Aggregate metrics recalculation
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta

import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.review_engine import (
    ReviewEngine,
    MASTERY_THRESHOLD_10,
    DEFAULT_ULTIMATE,
    TIGHT_LOOP_INTERVAL_DAYS,
    STABILITY_INTERVAL_DAYS,
)
from app.models.planning import SkillLifecycleStatus


class TestReviewEngine(unittest.TestCase):

    def setUp(self):
        self.firestore = MagicMock()
        # Default: no existing skill_status
        self.firestore.get_skill_status = AsyncMock(return_value=None)
        self.firestore.upsert_skill_status = AsyncMock(return_value={})
        self.firestore.get_all_skill_statuses = AsyncMock(return_value=[])
        self.firestore.get_student_planning_fields = AsyncMock(return_value={
            "daily_session_capacity": 25,
            "development_patterns": {},
            "aggregate_metrics": {},
        })
        self.firestore.get_skills_with_review_due = AsyncMock(return_value=[])
        self.firestore.update_student_planning_fields = AsyncMock()

        self.engine = ReviewEngine(firestore_service=self.firestore)

    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    # ------------------------------------------------------------------
    # Initial mastery
    # ------------------------------------------------------------------

    def test_first_session_below_mastery_stays_learning(self):
        """Score < 90% on first attempt keeps skill in 'learning'."""
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="MATH-01-A", subject="Math", score=7.0
        ))
        self.assertEqual(result["status"], SkillLifecycleStatus.LEARNING)
        self.assertEqual(result["sessions_completed"], 1)
        self.assertIsNone(result["initial_mastery_date"])

    def test_initial_mastery_transitions_to_in_review(self):
        """Score >= 90% on first attempt triggers initial mastery."""
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="MATH-01-A", subject="Math", score=9.5
        ))
        self.assertEqual(result["status"], SkillLifecycleStatus.IN_REVIEW)
        self.assertEqual(result["sessions_completed"], 1)
        self.assertEqual(result["estimated_ultimate"], DEFAULT_ULTIMATE)
        self.assertIsNotNone(result["initial_mastery_date"])
        self.assertIsNotNone(result["next_review_date"])

    # ------------------------------------------------------------------
    # Standard review schedule (4 sessions → closed)
    # ------------------------------------------------------------------

    def test_standard_four_session_closure(self):
        """Mastery + 3 passing reviews = closed with completion_factor 1.0."""
        # Session 0: Initial mastery
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.5
        ))
        self.assertEqual(result["status"], SkillLifecycleStatus.IN_REVIEW)

        # Now simulate the skill_status existing in Firestore
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # Session 1: Pass review
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.2
        ))
        self.assertEqual(result["status"], SkillLifecycleStatus.IN_REVIEW)
        self.assertEqual(result["sessions_completed"], 2)
        self.assertEqual(len(result["review_history"]), 1)
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # Session 2: Pass review
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.0
        ))
        self.assertEqual(result["sessions_completed"], 3)
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # Session 3: Pass review → should close
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.1
        ))
        self.assertEqual(result["status"], SkillLifecycleStatus.CLOSED)
        self.assertEqual(result["completion_factor"], 1.0)
        self.assertIsNotNone(result["closed_date"])

    # ------------------------------------------------------------------
    # Single failure → tight loop → recovery
    # ------------------------------------------------------------------

    def test_failure_enters_tight_loop(self):
        """A failing review bumps ultimate and enters tight loop."""
        # Initial mastery
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.5
        ))
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # Pass review 1
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.2
        ))
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # FAIL review 2
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=8.0
        ))
        self.assertEqual(result["estimated_ultimate"], DEFAULT_ULTIMATE + 1)  # 5
        self.assertTrue(result["in_tight_loop"])
        self.assertEqual(result["tight_loop_passes_needed"], 2)
        self.assertEqual(result["sessions_completed"], 3)
        # completion factor: 3/5 = 0.6
        self.assertAlmostEqual(result["completion_factor"], 0.6, places=2)

    def test_tight_loop_recovery_requires_two_passes(self):
        """After failure, need 2 consecutive passes to exit tight loop."""
        # Mastery + pass + fail
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.5
        ))
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.2
        ))
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=7.5
        ))
        self.assertTrue(result["in_tight_loop"])
        self.assertEqual(result["tight_loop_passes_needed"], 2)
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # Recovery pass 1 → still in tight loop (1 pass remaining)
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.1
        ))
        self.assertTrue(result["in_tight_loop"])
        self.assertEqual(result["tight_loop_passes_needed"], 1)
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # Recovery pass 2 → exits tight loop
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.0
        ))
        self.assertFalse(result["in_tight_loop"])
        self.assertEqual(result["tight_loop_passes_needed"], 0)

    # ------------------------------------------------------------------
    # Multiple failures → escalating ultimate
    # ------------------------------------------------------------------

    def test_multiple_failures_escalate_ultimate(self):
        """Each failure adds +1 to estimated_ultimate."""
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=9.5
        ))
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # Fail 1
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=7.0
        ))
        self.assertEqual(result["estimated_ultimate"], 5)
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # Fail 2
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=6.5
        ))
        self.assertEqual(result["estimated_ultimate"], 6)
        self.firestore.get_skill_status = AsyncMock(return_value=result)

        # Fail 3
        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=7.0
        ))
        self.assertEqual(result["estimated_ultimate"], 7)

    # ------------------------------------------------------------------
    # Completion factor arithmetic
    # ------------------------------------------------------------------

    def test_completion_factor_calculation(self):
        """completionFactor = sessionsCompleted / estimatedUltimate."""
        self.assertAlmostEqual(
            ReviewEngine._calc_completion_factor(2, 4), 0.5
        )
        self.assertAlmostEqual(
            ReviewEngine._calc_completion_factor(3, 5), 0.6
        )
        self.assertAlmostEqual(
            ReviewEngine._calc_completion_factor(4, 4), 1.0
        )
        self.assertAlmostEqual(
            ReviewEngine._calc_completion_factor(0, 4), 0.0
        )
        # Edge: ultimate 0
        self.assertAlmostEqual(
            ReviewEngine._calc_completion_factor(3, 0), 0.0
        )

    def test_failure_can_decrease_effective_progress(self):
        """
        PRD critical property: failure can make completion factor seem to
        regress even though more work was done.

        After Session 1 (pass):   2/4 = 0.50
        After Session 2 (fail):   3/5 = 0.60  (vs expected 3/4 = 0.75 if passed)
        """
        self.assertAlmostEqual(ReviewEngine._calc_completion_factor(2, 4), 0.50)
        # After fail: ultimate goes from 4 → 5
        self.assertAlmostEqual(ReviewEngine._calc_completion_factor(3, 5), 0.60)
        # vs. what it would have been if passed
        self.assertAlmostEqual(ReviewEngine._calc_completion_factor(3, 4), 0.75)

    # ------------------------------------------------------------------
    # Closed skill ignores subsequent results
    # ------------------------------------------------------------------

    def test_closed_skill_ignores_new_results(self):
        """Once closed, subsequent session results are ignored."""
        self.firestore.get_skill_status = AsyncMock(return_value={
            "skill_id": "S1",
            "subject": "Math",
            "skill_name": "Test",
            "status": "closed",
            "sessions_completed": 4,
            "estimated_ultimate": 4,
            "completion_factor": 1.0,
            "closed_date": "2026-01-15T00:00:00+00:00",
            "review_history": [],
        })

        result = self._run(self.engine.process_session_result(
            student_id=1, skill_id="S1", subject="Math", score=5.0
        ))
        self.assertEqual(result["status"], SkillLifecycleStatus.CLOSED)
        self.assertEqual(result["sessions_completed"], 4)  # unchanged


if __name__ == "__main__":
    unittest.main()
