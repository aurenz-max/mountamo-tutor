"""Progress report facts (app/services/progress_report.py) against an in-memory student.

Pins the rules the report exists to keep: mastery comes from lifecycle gates only;
machine bursts are excluded; lowercase ids are their own (Grade 1) subskills; a grade
stored as "3rd" still finds its curriculum; an empty student does not crash.
"""

import asyncio
from datetime import date
from types import SimpleNamespace

import pytest

import app.services.progress_report as pr
from app.services.progress_report import ProgressReportService, _grade_code, _grade_doc_key


class _Doc:
    def __init__(self, doc_id, data, children=None):
        self.id, self._data, self._children = doc_id, data, children or {}
        self.reference = self

    def to_dict(self):
        return dict(self._data)

    def collection(self, name):
        return _Col(self._children.get(name, []))


class _Col:
    def __init__(self, docs):
        self._docs = docs

    def select(self, _fields):
        return self

    def stream(self):
        return iter(self._docs)


def _curriculum(grade_key, grade_label, ids):
    index = {sid: {"subskill_id": sid, "subskill_description": f"Do {sid}", "unit_title": "Unit",
                   "skill_id": "S1", "skill_description": "Skill", "grade": grade_label} for sid in ids}
    tree = [{"unit_title": "Unit", "skills": [{"skill_description": "Skill",
                                                "subskills": [{"subskill_id": sid} for sid in ids]}]}]
    return _Doc(grade_key, {}, {"subjects": [_Doc("MATHEMATICS", {"subskill_index": index, "curriculum": tree})]})


class FakeStore:
    def __init__(self, grades, attempts=(), lifecycle=None, grade_level="K"):
        self._grades, self._attempts, self._lifecycle = grades, list(attempts), lifecycle or {}
        self.client = SimpleNamespace(collection=lambda name: _Col(self._grades))
        self._grade_level = grade_level
        self.competencies_read = False

    def _attempts_subcollection(self, _sid):
        return _Col([_Doc(str(i), a) for i, a in enumerate(self._attempts)])

    def _student_doc(self, _sid):
        return _Doc("s", {}, {"mastery_lifecycle": [_Doc(k, v) for k, v in self._lifecycle.items()]})

    def _competencies_subcollection(self, _sid):
        self.competencies_read = True
        return _Col([])

    async def get_student_planning_fields(self, _sid):
        return {"grade_level": self._grade_level}

    async def get_student_interests(self, _sid):
        return []

    async def get_active_misconceptions(self, _sid):
        return {}


@pytest.fixture(autouse=True)
def fresh_curriculum_cache():
    pr._CURRICULUM_CACHE.update(at=0.0, index=None, trees=None)


def _report(store):
    return asyncio.run(ProgressReportService(store).get_report(1, today=date(2026, 10, 7)))


def _attempt(ts, sid, score=10):
    return {"timestamp": ts, "subskill_id": sid, "subject": "MATHEMATICS", "score": score}


def test_grade_codes_normalize():
    assert [_grade_code(g) for g in ("Kindergarten", "K", "3", "3rd", "3rd Grade", "Grade 3")] == ["K", "K", "3", "3", "3", "3"]
    assert _grade_doc_key("3", {"3rd Grade": {}}) == "3rd Grade"
    assert _grade_doc_key("K", {"Kindergarten": {}, "1": {}}) == "Kindergarten"


def test_a_grade_stored_as_3rd_finds_its_curriculum():
    store = FakeStore([_curriculum("3", "3", ["M3-A", "M3-B"])], grade_level="3rd")
    r = _report(store)
    assert r["grade"] == "3"
    assert r["grade_map"][0]["total"] == 2


def test_mastery_comes_from_lifecycle_gates_only():
    store = FakeStore([_curriculum("Kindergarten", "Kindergarten", ["A", "B", "C"])],
                      attempts=[_attempt("2026-10-01T10:00:00+00:00", "A")],
                      lifecycle={"A": {"current_gate": 4, "gate_history": [
                                     {"gate": 4, "timestamp": "2026-10-01T10:00:00+00:00"}]},
                                 "B": {"current_gate": 2}})
    r = _report(store)
    m = r["grade_map"][0]
    assert (m["mastered"], m["learning"], m["total"]) == (1, 1, 3)
    assert [x["subskill_id"] for x in r["recent_mastered"]] == ["A"]
    assert not store.competencies_read


def test_machine_bursts_are_excluded():
    burst = [_attempt(f"2026-10-02T10:{i // 60:02d}:{i % 60:02d}+00:00", "A") for i in range(120)]
    real = [_attempt("2026-10-03T10:00:00+00:00", "A", 6), _attempt("2026-10-03T10:02:00+00:00", "A", 8)]
    r = _report(FakeStore([_curriculum("Kindergarten", "Kindergarten", ["A"])], attempts=burst + real))
    assert r["evidence"]["answers"] == 2
    assert r["evidence"]["excluded_burst_answers"] == 120
    assert r["evidence"]["burst_days"] == ["2026-10-02"]


def test_lowercase_ids_are_separate_subskills():
    grades = [_curriculum("Kindergarten", "Kindergarten", ["OPS-01-A"]), _curriculum("1", "1", ["OPS-01-a"])]
    store = FakeStore(grades, lifecycle={"OPS-01-a": {"current_gate": 4}})
    r = _report(store)
    assert r["grade_map"][0]["mastered"] == 0  # the G1 twin's mastery is not K mastery


def test_an_empty_student_gets_a_report():
    r = _report(FakeStore([_curriculum("Kindergarten", "Kindergarten", ["A"])]))
    assert r["evidence"]["answers"] == 0
    assert r["typical_session_minutes"] is None and r["accuracy_recent_weeks"] is None
    assert len(r["weeks"]) == 16
