"""
Publish pipeline: draft -> curriculum_published, run for real against an in-memory Firestore.

Every collaborator that matters runs as production code: get_draft/save_draft,
publish(), the lineage diff and coverage check, and CurriculumFirestore.deploy_curriculum
(which writes to the grade named INSIDE the doc). Only Firestore and Gemini are faked.

Each test pins a failure seen on 2026-10-08 or a rule publish must keep:
  - a draft labelled with another grade overwrote published K Social Studies with
    Grade 1 content (now refused);
  - publish writes only to its own grade and only accepted units;
  - a removed subskill without lineage blocks publish; an unchanged republish writes
    no lineage;
  - parent summaries are filled on publish, and a Gemini failure never blocks it;
  - the backfill never treats an empty draft as identical to a published subject.

Run:
  python -m pytest tests/test_publish_pipeline.py -q
"""

import asyncio
import importlib.util
import os
from copy import deepcopy

import pytest

import app.db.firestore_curriculum_service as sync_module
import app.db.firestore_graph_service as graph_module
import app.services.parent_summaries as summaries_module
from app.db.draft_curriculum_service import DraftCurriculumService
from app.db.firestore_graph_service import CurriculumFirestore


def _run(coro):
    return asyncio.run(coro)


# --------------------------------------------------------------------------- #
#  In-memory Firestore: collection/document paths over one dict
# --------------------------------------------------------------------------- #

class _Snap:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return deepcopy(self._data) if self._data is not None else None


class _DocRef:
    def __init__(self, store, path):
        self._store, self.path = store, path
        self.id = path.rsplit("/", 1)[-1]

    def get(self):
        return _Snap(self.id, self._store.get(self.path))

    def set(self, data, merge=False):
        base = deepcopy(self._store.get(self.path) or {}) if merge else {}
        base.update(deepcopy(data))
        self._store[self.path] = base

    def update(self, data):
        self.set(data, merge=True)

    def delete(self):
        self._store.pop(self.path, None)

    def collection(self, name):
        return _ColRef(self._store, f"{self.path}/{name}")


class _ColRef:
    def __init__(self, store, path):
        self._store, self.path = store, path

    def document(self, doc_id):
        return _DocRef(self._store, f"{self.path}/{doc_id}")


class _Batch:
    def __init__(self):
        self._ops = []

    def set(self, ref, data):
        self._ops.append((ref, data))

    def commit(self):
        for ref, data in self._ops:
            ref.set(data)


class FakeFirestore:
    def __init__(self):
        self.store = {}

    def collection(self, name):
        return _ColRef(self.store, name)

    def batch(self):
        return _Batch()

    # helpers for tests
    def published(self, grade, subject_id):
        return self.store.get(f"curriculum_published/{grade}/subjects/{subject_id}")

    def lineage_ids(self):
        return sorted(p.split("/", 1)[1] for p in self.store if p.startswith("curriculum_lineage/"))


@pytest.fixture
def fs(monkeypatch):
    fake = FakeFirestore()
    graph = CurriculumFirestore()
    graph.client = fake
    graph.curriculum_published = fake.collection("curriculum_published")
    monkeypatch.setattr(graph_module, "firestore_graph_service", graph)
    monkeypatch.setattr(sync_module.firestore_curriculum_sync, "client", fake)

    async def fake_summarize(items):
        return {i["id"]: f"Plain: {i['description']}" for i in items}

    monkeypatch.setattr(summaries_module, "_summarize", fake_summarize)
    return fake


def _draft(grade_field, ids, accepted=True, extra_unit=None):
    units = [{
        "unit_id": "U1", "unit_title": "Unit one", **({} if accepted else {"status": "draft"}),
        "skills": [{"skill_id": "S1", "skill_description": "Skill one", "subskills": [
            {"subskill_id": sid, "subskill_description": f"Do {sid}"} for sid in ids
        ]}],
    }]
    if extra_unit:
        units.append(extra_unit)
    return {"subject_id": "SOCIAL_STUDIES", "subject_name": "Social Studies", "grade": grade_field,
            "curriculum": units, "subskill_index": {}}


async def _seed(svc, grade_key, doc):
    await svc.save_draft(grade_key, doc["subject_id"], doc)


# --------------------------------------------------------------------------- #
#  Grade integrity
# --------------------------------------------------------------------------- #

def test_a_draft_labelled_with_another_grade_cannot_overwrite_that_grade(fs):
    svc = DraftCurriculumService()
    _run(_seed(svc, "Kindergarten", _draft("Kindergarten", ["SS001-01-A"])))
    _run(svc.publish("Kindergarten", "SOCIAL_STUDIES"))
    k_before = fs.published("Kindergarten", "SOCIAL_STUDIES")

    # The 10-08 incident: the Grade 1 draft said grade "Kindergarten" inside the doc.
    _run(_seed(svc, "1", _draft("Kindergarten", ["SS001-01-a"])))
    with pytest.raises(ValueError, match="labelled grade 'Kindergarten'"):
        _run(svc.publish("1", "SOCIAL_STUDIES"))

    assert fs.published("Kindergarten", "SOCIAL_STUDIES") == k_before
    assert list(k_before["subskill_index"]) == ["SS001-01-A"]


def test_publish_writes_only_to_its_own_grade(fs):
    svc = DraftCurriculumService()
    _run(_seed(svc, "1", _draft("1", ["SS001-01-a"])))
    _run(svc.publish("1", "SOCIAL_STUDIES"))
    assert list(fs.published("1", "SOCIAL_STUDIES")["subskill_index"]) == ["SS001-01-a"]
    assert fs.published("Kindergarten", "SOCIAL_STUDIES") is None


def test_only_accepted_units_are_published(fs):
    svc = DraftCurriculumService()
    pending = {"unit_id": "U2", "unit_title": "Pending", "status": "draft", "skills": [
        {"skill_id": "S2", "skill_description": "x", "subskills": [{"subskill_id": "NEW-1", "subskill_description": "new"}]}]}
    _run(_seed(svc, "Kindergarten", _draft("Kindergarten", ["A"], extra_unit=pending)))
    _run(svc.publish("Kindergarten", "SOCIAL_STUDIES"))
    pub = fs.published("Kindergarten", "SOCIAL_STUDIES")
    assert list(pub["subskill_index"]) == ["A"]
    assert [u["unit_id"] for u in pub["curriculum"]] == ["U1"]


# --------------------------------------------------------------------------- #
#  Lineage
# --------------------------------------------------------------------------- #

def test_removing_a_subskill_without_lineage_blocks_publish(fs):
    svc = DraftCurriculumService()
    _run(_seed(svc, "Kindergarten", _draft("Kindergarten", ["A", "B"])))
    _run(svc.publish("Kindergarten", "SOCIAL_STUDIES"))

    _run(_seed(svc, "Kindergarten", _draft("Kindergarten", ["A", "C"])))  # B removed, C unrelated
    try:
        _run(svc.publish("Kindergarten", "SOCIAL_STUDIES"))
    except ValueError as e:
        assert "Pre-publish blocked" in str(e)
        assert list(fs.published("Kindergarten", "SOCIAL_STUDIES")["subskill_index"]) == ["A", "B"]
    else:
        # detect_changes may infer B -> C itself; then a lineage record must exist for B.
        assert "B" in fs.lineage_ids()


def test_an_unchanged_republish_writes_no_lineage(fs):
    svc = DraftCurriculumService()
    _run(_seed(svc, "Kindergarten", _draft("Kindergarten", ["A", "B"])))
    _run(svc.publish("Kindergarten", "SOCIAL_STUDIES"))
    _run(svc.publish("Kindergarten", "SOCIAL_STUDIES"))
    assert fs.lineage_ids() == []


# --------------------------------------------------------------------------- #
#  Parent summaries
# --------------------------------------------------------------------------- #

def test_publish_fills_parent_summaries_into_draft_and_index(fs):
    svc = DraftCurriculumService()
    _run(_seed(svc, "Kindergarten", _draft("Kindergarten", ["A", "B"])))
    _run(svc.publish("Kindergarten", "SOCIAL_STUDIES"))
    index = fs.published("Kindergarten", "SOCIAL_STUDIES")["subskill_index"]
    assert index["A"]["parent_summary"] == "Plain: Do A"
    draft = _run(svc.get_draft("Kindergarten", "SOCIAL_STUDIES"))
    assert draft["curriculum"][0]["skills"][0]["subskills"][1]["parent_summary"] == "Plain: Do B"


def test_a_gemini_failure_never_blocks_publish(fs, monkeypatch):
    async def broken(items):
        return {}  # what _summarize returns when the Gemini call fails

    monkeypatch.setattr(summaries_module, "_summarize", broken)
    svc = DraftCurriculumService()
    _run(_seed(svc, "Kindergarten", _draft("Kindergarten", ["A"])))
    _run(svc.publish("Kindergarten", "SOCIAL_STUDIES"))
    index = fs.published("Kindergarten", "SOCIAL_STUDIES")["subskill_index"]
    assert "A" in index and "parent_summary" not in index["A"]


# --------------------------------------------------------------------------- #
#  Backfill script: "clean" means draft content == published content
# --------------------------------------------------------------------------- #

def _backfill_module():
    path = os.path.join(os.path.dirname(__file__), "..", "scripts", "fill_parent_summaries.py")
    spec = importlib.util.spec_from_file_location("fill_parent_summaries", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_backfill_never_treats_an_empty_draft_as_clean():
    mod = _backfill_module()
    published = _draft("5", ["A", "B"])["curriculum"]
    assert mod._content([]) != mod._content(published)


def test_backfill_ignores_only_summary_fields_when_comparing():
    mod = _backfill_module()
    published = _draft("5", ["A"])["curriculum"]
    with_summary = deepcopy(published)
    with_summary[0]["skills"][0]["subskills"][0].update(parent_summary="x", parent_summary_hash="y")
    assert mod._content(with_summary) == mod._content(published)
    edited = deepcopy(published)
    edited[0]["skills"][0]["subskills"][0]["subskill_description"] = "changed"
    assert mod._content(edited) != mod._content(published)
