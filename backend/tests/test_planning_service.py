"""
Tests for the PlanningService — algorithmic weekly & daily planner.

Covers:
  - Weekly pacing calculation with mock mastery lifecycle data
  - School weeks remaining calculation with breaks
  - Behind/ahead detection
  - Daily plan review queue ordering (mastery retests)
  - Capacity allocation (review vs new slots)
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock
from datetime import date, datetime, timedelta, timezone

import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.planning_service import PlanningService
from app.models.planning import SchoolBreak, SchoolYearConfig


def _make_curriculum(units):
    """Build mock curriculum list: [{skills: [{subskills: [...]}]}]."""
    return [
        {
            "id": f"UNIT-{i}",
            "title": f"Unit {i}",
            "skills": [
                {
                    "id": f"SKILL-{i}-{j}",
                    "description": f"Skill {i}.{j}",
                    "subskills": [
                        {"id": f"SUB-{i}-{j}-{k}", "description": f"Sub {i}.{j}.{k}"}
                        for k in range(subs)
                    ],
                }
                for j, subs in enumerate(skills)
            ],
        }
        for i, skills in enumerate(units)
    ]


class TestSchoolWeeksRemaining(unittest.TestCase):
    """Test the static _school_weeks_remaining helper."""

    def test_simple_no_breaks(self):
        today = date(2026, 3, 1)
        year_end = date(2026, 5, 29)
        result = PlanningService._school_weeks_remaining(today, year_end, [])
        # ~89 days / 5 = 17 weeks
        self.assertGreater(result, 10)

    def test_with_break(self):
        today = date(2026, 3, 1)
        year_end = date(2026, 5, 29)
        breaks = [SchoolBreak(name="Spring", start="2026-03-16", end="2026-03-20")]
        result_with = PlanningService._school_weeks_remaining(today, year_end, breaks)
        result_without = PlanningService._school_weeks_remaining(today, year_end, [])
        # With break should be fewer weeks
        self.assertLessEqual(result_with, result_without)

    def test_past_year_end(self):
        today = date(2026, 6, 15)
        year_end = date(2026, 5, 29)
        result = PlanningService._school_weeks_remaining(today, year_end, [])
        self.assertEqual(result, 0)

    def test_break_already_passed(self):
        today = date(2026, 4, 1)
        year_end = date(2026, 5, 29)
        breaks = [SchoolBreak(name="Winter", start="2025-12-20", end="2026-01-05")]
        result = PlanningService._school_weeks_remaining(today, year_end, breaks)
        # Past break should not affect count
        result_no_break = PlanningService._school_weeks_remaining(today, year_end, [])
        self.assertEqual(result, result_no_break)


class TestCountSubskills(unittest.TestCase):
    """Test the static _count_subskills helper."""

    def test_empty(self):
        self.assertEqual(PlanningService._count_subskills([]), 0)

    def test_counts_correctly(self):
        # 2 units: first has 2 skills with 3 subs each, second has 1 skill with 2 subs
        curriculum = _make_curriculum([[3, 3], [2]])
        self.assertEqual(PlanningService._count_subskills(curriculum), 8)


class TestCountByGateStatus(unittest.TestCase):
    """Test the static _count_by_gate_status helper (PRD §5.1)."""

    def test_empty(self):
        closed, in_review, learning, total, lcs = PlanningService._count_by_gate_status([], "Math")
        self.assertEqual((closed, in_review, learning, total), (0, 0, 0, 0))

    def test_gate_mapping(self):
        lifecycles = [
            {"subskill_id": "A", "subject": "Math", "current_gate": 4, "completion_pct": 1.0},
            {"subskill_id": "B", "subject": "Math", "current_gate": 2, "completion_pct": 0.5},
            {"subskill_id": "C", "subject": "Math", "current_gate": 1, "completion_pct": 0.25},
            {"subskill_id": "D", "subject": "Math", "current_gate": 0, "lesson_eval_count": 2},
            {"subskill_id": "E", "subject": "Math", "current_gate": 0, "lesson_eval_count": 0},
            {"subskill_id": "F", "subject": "Science", "current_gate": 4},  # different subject
        ]
        closed, in_review, learning, total, subj_lcs = PlanningService._count_by_gate_status(lifecycles, "Math")
        self.assertEqual(closed, 1)       # Gate 4
        self.assertEqual(in_review, 2)    # Gates 1, 2
        self.assertEqual(learning, 1)     # Gate 0 with lesson_eval_count > 0
        self.assertEqual(total, 5)        # Only Math lifecycles
        self.assertEqual(len(subj_lcs), 5)


class TestWeeklyPlan(unittest.TestCase):
    """Test the weekly plan computation."""

    def setUp(self):
        self.firestore = MagicMock()
        self.curriculum_service = MagicMock()
        self.learning_paths = MagicMock()

        # School year config
        self.firestore.get_school_year_config = AsyncMock(return_value={
            "start_date": "2025-08-25",
            "end_date": "2026-05-29",
            "breaks": [],
            "school_days_per_week": 5,
        })

        # Student planning fields
        self.firestore.get_student_planning_fields = AsyncMock(return_value={
            "daily_session_capacity": 25,
        })

        # Default: no mastery lifecycle records
        self.firestore.get_all_mastery_lifecycles = AsyncMock(return_value=[])

        # Curriculum: one subject with 20 subskills
        self.curriculum_service.get_available_subjects = AsyncMock(return_value=["Math"])
        self.curriculum_service.get_curriculum = AsyncMock(
            return_value=_make_curriculum([[5, 5, 5, 5]])  # 20 subskills
        )

        self.service = PlanningService(
            firestore_service=self.firestore,
            curriculum_service=self.curriculum_service,
            learning_paths_service=self.learning_paths,
        )

    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def test_all_not_started(self):
        """When no lifecycles exist, all should be 'not_started'."""
        plan = self._run(self.service.get_weekly_plan(student_id=1))
        stats = plan.subjects["Math"]
        self.assertEqual(stats.total_skills, 20)
        self.assertEqual(stats.not_started, 20)
        self.assertEqual(stats.closed, 0)
        self.assertEqual(stats.in_review, 0)

    def test_behind_detection(self):
        """If fraction of year elapsed > fraction of skills closed, behind_by > 0."""
        plan = self._run(self.service.get_weekly_plan(student_id=1))
        stats = plan.subjects["Math"]
        # With no skills closed and > 0% of year elapsed, student is behind
        if stats.expected_by_now > 0:
            self.assertGreater(stats.behind_by, 0)

    def test_some_skills_closed(self):
        """Closed skills (gate 4) reduce not_started count."""
        self.firestore.get_all_mastery_lifecycles = AsyncMock(return_value=[
            {"subskill_id": f"SUB-0-0-{i}", "subject": "Math", "current_gate": 4, "completion_pct": 1.0}
            for i in range(5)
        ])
        plan = self._run(self.service.get_weekly_plan(student_id=1))
        stats = plan.subjects["Math"]
        self.assertEqual(stats.closed, 5)
        self.assertEqual(stats.not_started, 15)

    def test_in_review_counted(self):
        """Skills at gates 1-3 count as in_review."""
        self.firestore.get_all_mastery_lifecycles = AsyncMock(return_value=[
            {"subskill_id": "SUB-0-0-0", "subject": "Math", "current_gate": 1, "completion_pct": 0.25,
             "estimated_remaining_attempts": 3},
            {"subskill_id": "SUB-0-0-1", "subject": "Math", "current_gate": 2, "completion_pct": 0.5,
             "estimated_remaining_attempts": 2},
            {"subskill_id": "SUB-0-0-2", "subject": "Math", "current_gate": 3, "completion_pct": 0.75,
             "estimated_remaining_attempts": 1},
        ])
        plan = self._run(self.service.get_weekly_plan(student_id=1))
        stats = plan.subjects["Math"]
        self.assertEqual(stats.in_review, 3)
        self.assertEqual(stats.review_reserve, 6)  # 3 + 2 + 1

    def test_weekly_new_target_nonzero(self):
        """Should recommend introducing some new skills each week."""
        plan = self._run(self.service.get_weekly_plan(student_id=1))
        stats = plan.subjects["Math"]
        self.assertGreater(stats.weekly_new_target, 0)

    def test_school_year_in_response(self):
        """Response includes school year metadata."""
        plan = self._run(self.service.get_weekly_plan(student_id=1))
        self.assertIn("start", plan.school_year)
        self.assertIn("end", plan.school_year)
        self.assertIn("weeksRemaining", plan.school_year)
        self.assertIn("fractionElapsed", plan.school_year)


class TestDailyPlan(unittest.TestCase):
    """Test the daily plan computation."""

    def setUp(self):
        self.firestore = MagicMock()
        self.curriculum_service = MagicMock()
        self.learning_paths = MagicMock()

        # School year config
        self.firestore.get_school_year_config = AsyncMock(return_value={
            "start_date": "2025-08-25",
            "end_date": "2026-05-29",
            "breaks": [],
            "school_days_per_week": 5,
        })

        # Student planning fields
        self.firestore.get_student_planning_fields = AsyncMock(return_value={
            "daily_session_capacity": 25,
        })

        # No mastery lifecycle records
        self.firestore.get_all_mastery_lifecycles = AsyncMock(return_value=[])

        # No mastery retests due
        self.firestore.get_mastery_retests_due = AsyncMock(return_value=[])

        # Curriculum: one subject with 20 subskills
        self.curriculum_service.get_available_subjects = AsyncMock(return_value=["Math"])
        self.curriculum_service.get_curriculum = AsyncMock(
            return_value=_make_curriculum([[5, 5, 5, 5]])
        )

        # Learning paths: return unlocked skills
        self.learning_paths.get_unlocked_entities = AsyncMock(return_value=[
            f"SUB-0-0-{i}" for i in range(10)
        ])

        self.service = PlanningService(
            firestore_service=self.firestore,
            curriculum_service=self.curriculum_service,
            learning_paths_service=self.learning_paths,
        )

    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def test_no_reviews_all_new(self):
        """With no retests due, all slots go to new skills."""
        plan = self._run(self.service.get_daily_plan(student_id=1))
        self.assertEqual(plan.review_slots, 0)
        self.assertGreater(plan.new_slots, 0)
        # All sessions should be 'new' type
        for s in plan.sessions:
            self.assertEqual(s["type"], "new")

    def test_mastery_retests_have_priority(self):
        """Mastery retests appear first in the session list."""
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        self.firestore.get_mastery_retests_due = AsyncMock(return_value=[
            {
                "subskill_id": "R1",
                "subject": "Math",
                "current_gate": 1,
                "completion_pct": 0.25,
                "next_retest_eligible": yesterday,
            }
        ])

        plan = self._run(self.service.get_daily_plan(student_id=1))
        self.assertGreater(plan.review_slots, 0)
        # First session should be a review
        self.assertEqual(plan.sessions[0]["type"], "review")
        self.assertEqual(plan.sessions[0]["reason"], "mastery_retest")

    def test_most_overdue_first(self):
        """Most overdue mastery retests sort before less overdue ones."""
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

        self.firestore.get_mastery_retests_due = AsyncMock(return_value=[
            {
                "subskill_id": "RECENT",
                "subject": "Math",
                "current_gate": 2,
                "completion_pct": 0.5,
                "next_retest_eligible": yesterday,
            },
            {
                "subskill_id": "OVERDUE",
                "subject": "Math",
                "current_gate": 1,
                "completion_pct": 0.25,
                "next_retest_eligible": week_ago,
            },
        ])

        plan = self._run(self.service.get_daily_plan(student_id=1))
        # Most overdue (OVERDUE) should come first
        review_sessions = [s for s in plan.sessions if s["type"] == "review"]
        self.assertEqual(review_sessions[0]["skill_id"], "OVERDUE")

    def test_capacity_respected(self):
        """Total sessions should not exceed daily capacity."""
        plan = self._run(self.service.get_daily_plan(student_id=1))
        self.assertLessEqual(len(plan.sessions), 25)


if __name__ == "__main__":
    unittest.main()
