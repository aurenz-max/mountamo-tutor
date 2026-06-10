"""
Repro tests for grade-blindness bugs in the curriculum-authoring service.

Background
----------
Subjects share IDs across grades (e.g. ``MATHEMATICS`` exists at grade "1", "2",
"3"). Several read/write paths dropped the grade dimension — resolving it via
``_resolve_grade`` (which returns the FIRST grade bucket that contains a subject)
or omitting it entirely. The two observable symptoms were WRONG-GRADE reads/writes
and DUPLICATE EDGES.

Each test below asserts the FIXED, grade-aware behavior. Run against the pre-fix
code the grade assertions FAIL (grade dropped / first-grade resolved / fresh uuid
each insert); against the fixed code they PASS. Tests are unit-level — every
collaborator is spied or faked, so no live Firestore or Gemini is required.

Run:
  python -m pytest tests/test_grade_blindness.py -q
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest


def _run(coro):
    """Drive an async coroutine without depending on pytest-asyncio mode."""
    return asyncio.run(coro)


# --------------------------------------------------------------------------- #
#  Minimal Firestore query fake (chained equality .where + .stream)
# --------------------------------------------------------------------------- #

class _FakeDoc:
    def __init__(self, data):
        self._data = data

    def to_dict(self):
        return dict(self._data)

    @property
    def reference(self):
        # Firestore doc reference stub — only .update() is exercised by reads.
        return SimpleNamespace(update=lambda *a, **k: None)


class _FakeQuery:
    """Supports chained ``.where(field, '==', value)`` filters + ``.stream()``."""

    def __init__(self, rows):
        self._rows = list(rows)

    def where(self, field, op, value):
        assert op == "==", f"fake only supports '==', got {op!r}"
        return _FakeQuery([r for r in self._rows if r.get(field) == value])

    def order_by(self, *args, **kwargs):
        return self

    def limit(self, n):
        return _FakeQuery(self._rows[:n])

    def stream(self):
        return [_FakeDoc(r) for r in self._rows]


# =========================================================================== #
#  BUG 1 — curriculum_versions grade-blindness (active-version / history)
#  Path: firestore_curriculum_reader.get_active_version / get_versions
# =========================================================================== #

def test_active_version_is_grade_scoped(monkeypatch):
    """A grade-qualified active-version lookup must return THAT grade's active
    version — not the first grade-stamped doc that happens to be active."""
    from app.db.firestore_curriculum_reader import firestore_reader
    from app.db.firestore_curriculum_service import firestore_curriculum_sync

    rows = [
        {"version_id": "g1", "subject_id": "MATHEMATICS", "grade": "1", "is_active": True, "version_number": 5},
        {"version_id": "g3", "subject_id": "MATHEMATICS", "grade": "3", "is_active": True, "version_number": 2},
    ]
    monkeypatch.setattr(
        firestore_curriculum_sync, "_collections", {"versions": _FakeQuery(rows)}, raising=False
    )

    g3 = _run(firestore_reader.get_active_version("MATHEMATICS", grade="3"))
    assert g3 is not None and g3["version_id"] == "g3"   # grade-3, NOT grade-1

    g1 = _run(firestore_reader.get_active_version("MATHEMATICS", grade="1"))
    assert g1["version_id"] == "g1"

    # A grade with no grade-stamped active version must NOT inherit another
    # grade's active version — that was the grade-blind bug.
    g5 = _run(firestore_reader.get_active_version("MATHEMATICS", grade="5"))
    assert g5 is None


def test_active_version_legacy_fallback(monkeypatch):
    """Backward-compat: legacy version docs without a ``grade`` field are still
    returned (subject-only), so the fix does not break existing data."""
    from app.db.firestore_curriculum_reader import firestore_reader
    from app.db.firestore_curriculum_service import firestore_curriculum_sync

    rows = [
        {"version_id": "legacy", "subject_id": "SCIENCE", "is_active": True, "version_number": 9},
    ]
    monkeypatch.setattr(
        firestore_curriculum_sync, "_collections", {"versions": _FakeQuery(rows)}, raising=False
    )

    got = _run(firestore_reader.get_active_version("SCIENCE", grade="2"))
    assert got is not None and got["version_id"] == "legacy"


def test_get_versions_grade_scoped(monkeypatch):
    """Version history (and therefore max version number) is scoped per grade."""
    from app.db.firestore_curriculum_reader import firestore_reader
    from app.db.firestore_curriculum_service import firestore_curriculum_sync

    rows = [
        {"version_id": "a", "subject_id": "MATHEMATICS", "grade": "1", "version_number": 7},
        {"version_id": "b", "subject_id": "MATHEMATICS", "grade": "3", "version_number": 2},
        {"version_id": "c", "subject_id": "MATHEMATICS", "grade": "3", "version_number": 3},
    ]
    monkeypatch.setattr(
        firestore_curriculum_sync, "_collections", {"versions": _FakeQuery(rows)}, raising=False
    )

    g3 = _run(firestore_reader.get_versions("MATHEMATICS", grade="3"))
    assert {v["version_id"] for v in g3} == {"b", "c"}
    assert _run(firestore_reader.get_max_version_number("MATHEMATICS", grade="3")) == 3
    # Grade 1 must not see grade 3's higher numbers.
    assert _run(firestore_reader.get_max_version_number("MATHEMATICS", grade="1")) == 7


# =========================================================================== #
#  BUG 2 — graph_agent suggestion writes dropped grade (cross-grade corruption)
#  Path: suggest_connections / accept_suggestion / reject_suggestion
# =========================================================================== #

def _make_agent():
    from app.services.graph_agent import CurriculumGraphAgentService
    return CurriculumGraphAgentService(
        edge_manager=MagicMock(),
        graph_cache=MagicMock(),
        suggestion_engine=MagicMock(),
        analysis_engine=MagicMock(),
        firestore_client=MagicMock(),
    )


def test_suggest_connections_threads_grade_to_writes(monkeypatch):
    """Explicit grade must reach BOTH the clear (delete_all_suggestions) and the
    store (sync_suggestion) so the cleared bucket == the written bucket, and must
    NOT be overridden by resolve_grade's first-grade pick."""
    from app.services import graph_agent as ga

    captured = {"delete": [], "sync": []}

    async def fake_delete_all(subject_id, grade=None):
        captured["delete"].append(grade)

    async def fake_sync(subject_id, data, grade=None):
        captured["sync"].append(grade)

    async def fake_resolve(subject_id):
        return "1"  # the WRONG (first) grade — must be ignored when grade given

    monkeypatch.setattr(ga.firestore_curriculum_sync, "delete_all_suggestions", fake_delete_all)
    monkeypatch.setattr(ga.firestore_curriculum_sync, "sync_suggestion", fake_sync)
    monkeypatch.setattr(ga.firestore_reader, "resolve_grade", fake_resolve)

    agent = _make_agent()

    async def fake_get_graph(subject_id, grade, include_drafts=False):
        return SimpleNamespace(nodes=[], edges=[])

    async def fake_generate(subject_id, nodes, edges, max_suggestions):
        return [SimpleNamespace(model_dump=lambda mode="json": {"suggestion_id": "s1"})]

    agent.cache.get_graph = fake_get_graph
    agent.suggestions_engine.generate_suggestions = fake_generate

    _run(agent.suggest_connections("MATHEMATICS", grade="3"))

    assert captured["delete"] == ["3"]
    assert captured["sync"] == ["3"]


def test_reject_suggestion_threads_grade(monkeypatch):
    """reject_suggestion must write the status update to the requesting grade's
    bucket, not whichever grade resolve_grade returns first."""
    from app.services import graph_agent as ga

    captured = {}

    async def fake_update(subject_id, suggestion_id, updates, grade=None):
        captured["grade"] = grade
        captured["status"] = updates.get("status")

    async def fake_resolve(subject_id):
        return "1"  # wrong grade — must be ignored when grade is explicit

    monkeypatch.setattr(ga.firestore_curriculum_sync, "update_suggestion", fake_update)
    monkeypatch.setattr(ga.firestore_reader, "resolve_grade", fake_resolve)

    agent = _make_agent()
    _run(agent.reject_suggestion("MATHEMATICS", "sugg-1", grade="3"))

    assert captured["grade"] == "3"
    assert captured["status"] == "rejected"


# =========================================================================== #
#  BUG 3 — duplicate edges: random uuid id, no dedup by (src,tgt,rel)
#  Path: edge_manager._insert_edge / _edge_identity
# =========================================================================== #

def test_edge_identity_is_deterministic_and_grade_scoped():
    """Re-running connect-skills for the same logical edge must produce the SAME
    id (overwrite, not duplicate). Grade and relationship are part of identity."""
    from app.services.edge_manager import EdgeManager

    edge = SimpleNamespace(
        source_entity_id="MATH-G3-OPS-A",
        target_entity_id="MATH-G3-OPS-B",
        relationship="prerequisite",
    )

    id_a = EdgeManager._edge_identity("3", "MATHEMATICS", edge)
    id_b = EdgeManager._edge_identity("3", "MATHEMATICS", edge)
    assert id_a == id_b                      # idempotent → no duplicate on re-run

    # Same (src,tgt,rel) at a different grade is a DISTINCT edge.
    id_g4 = EdgeManager._edge_identity("4", "MATHEMATICS", edge)
    assert id_a != id_g4

    # Relationship is part of the identity (prerequisite != builds_on).
    edge_builds = SimpleNamespace(
        source_entity_id="MATH-G3-OPS-A",
        target_entity_id="MATH-G3-OPS-B",
        relationship="builds_on",
    )
    assert EdgeManager._edge_identity("3", "MATHEMATICS", edge_builds) != id_a


def test_insert_edge_reuses_id_on_resync(monkeypatch):
    """Two inserts of the same logical edge write to the SAME Firestore doc id —
    proving re-sync overwrites instead of creating a second (duplicate) doc."""
    from app.services import edge_manager as em
    from app.models.edges import CurriculumEdgeCreate

    written_ids = []

    async def fake_sync_edge(row, grade=None):
        written_ids.append(row["edge_id"])

    monkeypatch.setattr(em.firestore_curriculum_sync, "sync_edge", fake_sync_edge)

    edge = CurriculumEdgeCreate(
        source_entity_id="A",
        source_entity_type="subskill",
        target_entity_id="B",
        target_entity_type="subskill",
        relationship="prerequisite",
        strength=0.8,
        is_prerequisite=True,
    )

    _run(em.edge_manager.create_edge(edge, "v1", "MATHEMATICS", grade="3"))
    _run(em.edge_manager.create_edge(edge, "v1", "MATHEMATICS", grade="3"))

    assert len(written_ids) == 2
    assert written_ids[0] == written_ids[1]   # same doc id → dedup by identity


# =========================================================================== #
#  BUG 4 — graph cache doc id omitted grade (grade-3 served grade-2's cache)
#  Path: firestore_graph_service._graph_doc_id
# =========================================================================== #

def test_cache_doc_id_includes_grade():
    """The flat-cache document id must include grade so shared-id subjects get
    distinct cache docs instead of colliding on MATHEMATICS_latest_published."""
    from app.db.firestore_graph_service import firestore_graph_service as fgs

    d3 = fgs._graph_doc_id("MATHEMATICS", "3", "latest", "published")
    d4 = fgs._graph_doc_id("MATHEMATICS", "4", "latest", "published")
    assert d3 != d4
    assert "3" in d3.split("_")

    # Legacy callers (no grade) keep the original 3-part id.
    assert fgs._graph_doc_id("MATHEMATICS", None, "latest", "published") == "MATHEMATICS_latest_published"


def test_cache_get_is_grade_filtered(monkeypatch):
    """get_graph_document must not return another grade's (or a grade-blind)
    cached doc when a grade is requested."""
    from app.db.firestore_graph_service import firestore_graph_service as fgs

    rows = [
        {"id": "MATHEMATICS_2_latest_published", "subject_id": "MATHEMATICS", "grade": "2",
         "version_type": "published", "graph": {"nodes": ["g2"], "edges": []},
         "generated_at": "2026-01-02"},
        {"id": "MATHEMATICS_3_latest_published", "subject_id": "MATHEMATICS", "grade": "3",
         "version_type": "published", "graph": {"nodes": ["g3"], "edges": []},
         "generated_at": "2026-01-01"},
    ]

    monkeypatch.setattr(fgs, "curriculum_graphs", _FakeQuery(rows), raising=False)

    got = _run(fgs.get_graph_document("MATHEMATICS", "published", grade="3"))
    assert got is not None and got["graph"]["nodes"] == ["g3"]   # grade-3, despite g2 newer


# =========================================================================== #
#  BUG 5 — draft writes used raw grade (K vs Kindergarten = divergent buckets)
#  Path: draft_curriculum_service._ref
# =========================================================================== #

def test_draft_ref_normalizes_grade(monkeypatch):
    """A write with grade="K" must land on the SAME grade document the reader
    resolves to ("Kindergarten"), not a divergent curriculum_drafts/K bucket."""
    from app.db.draft_curriculum_service import draft_curriculum
    from app.db.firestore_curriculum_service import firestore_curriculum_sync

    class _RecordingColl:
        def __init__(self, recorder):
            self.r = recorder

        def document(self, doc_id):
            self.r.append(doc_id)
            return _RecordingDoc(self.r)

    class _RecordingDoc:
        def __init__(self, recorder):
            self.r = recorder

        def collection(self, name):
            return _RecordingColl(self.r)

    class _FakeClient:
        def __init__(self, recorder):
            self.r = recorder

        def collection(self, name):
            return _RecordingColl(self.r)

    rec_short, rec_long = [], []
    monkeypatch.setattr(firestore_curriculum_sync, "client", _FakeClient(rec_short), raising=False)
    draft_curriculum._ref("K", "MATHEMATICS")

    monkeypatch.setattr(firestore_curriculum_sync, "client", _FakeClient(rec_long), raising=False)
    draft_curriculum._ref("Kindergarten", "MATHEMATICS")

    # First document() call is the GRADE bucket; both must normalise equal.
    assert rec_short[0] == rec_long[0] == "Kindergarten"
