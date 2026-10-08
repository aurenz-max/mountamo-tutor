"""The narrative may only use numbers the report computed (progress_report_narrative)."""

from app.services.progress_report_narrative import build_digest, ungrounded_numbers


def _report(accuracies):
    weeks = [{"week_of": "2026-09-28", "minutes": 30, "active_days": 2, "answers": 10 if a is not None else 0,
              "accuracy": a, "checks_passed": 1, "mastered": 0} for a in accuracies]
    return {
        "grade": "K", "weeks": weeks, "accuracy_recent_weeks": 95, "typical_session_minutes": 6,
        "recent": {"days": 30, "active_days": 13, "minutes": 163, "answers": 50, "mastered": 3},
        "grade_map": [{"name": "Math", "total": 166, "mastered": 17, "learning": 21, "tried": 4,
                       "units": [{"title": "Counting and Cardinality", "total": 37, "mastered": 13, "learning": 7}]}],
        "grade_mix": [{"grade": "K", "answers": 374}, {"grade": "1", "answers": 192}],
        "needs_practice": [], "misconceptions": [], "interests": ["dump trucks"],
    }


def test_numbers_from_the_digest_pass():
    digest = build_digest(_report([95, 98, 92, 100]), "Ava")
    text = {"short_answer": "Ava gets 95 percent right, practiced 13 days, and mastered 17 of 166 math skills."}
    assert ungrounded_numbers(text, digest) == []


def test_an_invented_number_is_rejected():
    digest = build_digest(_report([95, 98, 92, 100]), "Ava")
    # 42 appears nowhere in the facts.
    assert ungrounded_numbers({"lede": "Ava mastered 42 skills."}, digest) == ["42"]


def test_difficulty_verdict_is_computed_not_left_to_the_model():
    assert "harder" in build_digest(_report([95, 98, 92, 100]), "Ava")["difficulty"]
    hard = _report([55, 60, 58, 62])
    hard["accuracy_recent_weeks"] = 59
    assert "hard for them" in build_digest(hard, "Ava")["difficulty"]
