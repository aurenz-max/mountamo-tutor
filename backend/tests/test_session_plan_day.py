"""C6: the session plan is keyed by the student's local day, not UTC."""
import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.services.planning_service import PlanningService


def _service(now: datetime, stored=None):
    svc = PlanningService.__new__(PlanningService)
    svc.firestore = SimpleNamespace(
        virtual_now=now,
        get_daily_session_plan_doc=AsyncMock(return_value=stored),
        save_daily_session_plan_doc=AsyncMock(),
    )
    return svc


# 2026-10-13 00:30 UTC is 2026-10-12 20:30 in New York.
EVENING_NY = datetime(2026, 10, 13, 0, 30, tzinfo=timezone.utc)


def test_client_day_wins_within_one_day():
    svc = _service(EVENING_NY)
    assert svc._plan_day("2026-10-12").isoformat() == "2026-10-12"


def test_far_or_bad_client_day_falls_back_to_utc():
    svc = _service(EVENING_NY)
    assert svc._plan_day("2026-10-01").isoformat() == "2026-10-13"
    assert svc._plan_day("not-a-date").isoformat() == "2026-10-13"
    assert svc._plan_day(None).isoformat() == "2026-10-13"


def test_plan_is_read_and_built_under_the_client_day():
    svc = _service(EVENING_NY)
    seen = {}
    async def build(_sid, plan_day):
        seen["day"] = plan_day
        return SimpleNamespace(
            date=plan_day.isoformat(), day_of_week=plan_day.strftime("%A"),
            blocks=[], block_times={}, completed_block_ids=[],
        )
    svc._build_daily_session_plan = build
    plan = asyncio.run(svc.get_daily_session_plan(1, plan_date="2026-10-12"))
    svc.firestore.get_daily_session_plan_doc.assert_awaited_with(1, "2026-10-12")
    assert seen["day"].isoformat() == "2026-10-12"
    assert plan.date == "2026-10-12"
    assert plan.day_of_week == "Monday"


def test_builder_stamps_the_day_it_is_given():
    from datetime import date
    from app.services.lesson_group_service import LessonGroupService
    plan = LessonGroupService.build_session_plan(
        student_id=1, candidate_blocks=[], plan_day=date(2026, 10, 12),
    )
    assert plan.date == "2026-10-12" and plan.day_of_week == "Monday"


def test_stored_plan_dated_another_day_is_rebuilt():
    stored = {"student_id": "1", "date": "2026-10-11", "day_of_week": "Sunday",
              "blocks": [], "completed_block_ids": []}
    svc = _service(EVENING_NY, stored=stored)
    calls = []
    async def build(_sid, plan_day):
        calls.append(plan_day)
        return SimpleNamespace(
            date=plan_day.isoformat(), day_of_week=plan_day.strftime("%A"),
            blocks=[], block_times={}, completed_block_ids=[],
        )
    svc._build_daily_session_plan = build
    plan = asyncio.run(svc.get_daily_session_plan(1, plan_date="2026-10-12"))
    assert len(calls) == 1 and plan.date == "2026-10-12"


def test_daily_budget_scales_with_grade():
    from app.models.lesson_plan import daily_budget_minutes
    assert daily_budget_minutes({"grade_level": "Kindergarten"}) == 30
    assert daily_budget_minutes({"grade_level": "K"}) == 30
    assert daily_budget_minutes({"grade_level": "3"}) == 50
    assert daily_budget_minutes({"grade_level": "8"}) == 75
    assert daily_budget_minutes({}) == 75
    assert daily_budget_minutes({"grade_level": "K", "daily_budget_minutes": 45}) == 45
