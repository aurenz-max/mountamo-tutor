"""Retest receipt contract regressions; synthetic learner, real submission handler.

The fixtures are place-value shaped (a real compiled plan) but the code under
test is primitive-agnostic: the backend never names a primitive.
"""
import asyncio
from copy import deepcopy
from types import SimpleNamespace
import pytest

from app.services import learning_observations as scoping
from app.services import misconception_receipts as receipts
from app.db.firestore_service import FirestoreService
from app.services.submission_service import SubmissionService
from tests.test_misconception_round_trip import _TracingStore, _submission

SCOPE = dict(subject="MATHEMATICS", grade="4", skill_id="SKILL-1", subskill_id="SUB-1", curriculum_version="synthetic-v1")


def test_status_projection_uses_authenticated_student_and_omits_private_fields(monkeypatch):
    from app.api.endpoints import student_profile as endpoint
    from app.core.middleware import get_user_context
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    scope = dict(subject="MATHEMATICS", grade="4", skill_id="NBT004-01", subskill_id="NBT004-01-b", curriculum_version="live@now")
    async def resolve(*_): return scope
    monkeypatch.setattr(endpoint, "resolve_scope", resolve)
    keys = []
    def collection(student_id):
        assert student_id == 42
        def document(key):
            keys.append(key)
            return SimpleNamespace(get=lambda: SimpleNamespace(exists=True,
                to_dict=lambda: dict(status="resolved", revision=2, scope_context=scope,
                    misconception_text="private", hypothesis_id="secret", resolved_attempt_id="attempt-2")))
        return SimpleNamespace(document=document)
    monkeypatch.setattr(endpoint, "get_firestore_service", lambda: SimpleNamespace(_misconceptions_subcollection=collection))
    app = FastAPI(); app.include_router(endpoint.router)
    client = TestClient(app)
    route = '/misconception-status?primitive_type=place-value-chart&skill_id=NBT004-01'
    assert client.get(route).status_code in (401, 403)
    app.dependency_overrides[get_user_context] = lambda: {"student_id": 42}
    response = client.get(route + '&student_id=999').json()
    assert keys == ['place-value-chart::NBT004-01']
    assert response['status'] == 'resolved' and response['scopeCompatible']
    assert response['resolvedAttemptId'] == 'attempt-2'
    assert 'private' not in str(response) and 'secret' not in str(response)
    assert client.get('/misconception-status?primitive_type=Bad%20Name&skill_id=x').status_code == 422


def test_matching_tag_without_compiled_opportunity_cannot_resolve():
    # Real production-generator draw whose repeated worth was suppressed by the
    # production compiler. The TS contract test independently recompiles it.
    import json
    from pathlib import Path
    artifact = Path(__file__).parents[2] / "my-tutoring-app/qa/misconception/place-value-opportunities/2026-09-12T20-53-11-606Z/targeted-2.json"
    assert json.loads(artifact.read_text())["candidateItems"] is None
    async def run():
        store = _TracingStore()
        await store.add_or_update_misconception(
            990040, "place-value-chart", "skill",
            "The student gives a bare digit for its worth.", "failed-attempt",
            subskill_id="SUB-1", skill_id="SKILL-1", scope_context=SCOPE,
        )
        service = SubmissionService(None, None, firestore_service=store)
        async def fanout(**kwargs):
            store.events.append("fanout")
            assert kwargs["attempt_id"]
            return {"updated": True}
        service._update_competency = fanout
        # A matching manifest tag survives a no-op generator. No receipt exists.
        result = await service.handle_submission(
            _submission(100, "place-value-chart", "SKILL-1", "place-value-chart"),
            {"student_id": 990040, "firebase_uid": "synthetic", "email": "x@test"},
        )
        assert result.competency == {"updated": True}
        assert "fanout" in store.events
        assert "place-value-chart::SKILL-1" in await store.get_active_misconceptions(990040)
        assert not result.review["metadata"].get("remediation_successful")
    asyncio.run(run())


@pytest.fixture
def contract():
    scope = deepcopy(SCOPE)
    hypothesis = dict(status="active", scope="skill", primitive_type="place-value-chart", skill_id="SKILL-1",
                      hypothesis_id="hypothesis-1", revision=1, scope_context=deepcopy(scope))
    plan = dict(primitive_type="place-value-chart", scope=scope, student_id=990040, instance_id="instance-1", lesson_id="lesson-1",
                hypothesis_id="hypothesis-1", revision=1, capability_id="digit_face_value_for_worth",
                capability_version=1, policy_version="place-value-immediate-retest-v1", compiler_version="place-value-items-v1",
                content_hash="a" * 64, mode="compare", tier="medium", items=[
                    dict(id="a", kind="say_value", target_number=2258, place=2, digit=2, answer_text="two hundred",
                         accepted_answers=["two hundred", "200"], eligible=True),
                    dict(id="b", kind="say_value", target_number=9027, place=1, digit=2, answer_text="twenty",
                         accepted_answers=["twenty", "20"], eligible=True)])
    events = []
    for item in plan["items"]:
        opened = len(events) * 100 + 1
        for e in [dict(kind="presented"), dict(kind="response", source="voice", turn_opened_at=opened, turn_closed_at=opened+1, during_tutor_audio=False),
                  dict(kind="transcript", text=item["answer_text"], turn_opened_at=opened), dict(kind="affirmed", turn_opened_at=opened),
                  dict(kind="completed", solved=True, corrections=0)]:
            events.append(dict(e, seq=len(events), item_id=item["id"]))
    evidence = dict(content_hash=plan["content_hash"], completed=True, events=events)
    binding = {k: plan[k] for k in ("student_id", "instance_id", "lesson_id", "scope", "primitive_type")}
    return plan, hypothesis, evidence, binding


def test_positive_policy_and_legacy(contract):
    plan, hypothesis, evidence, binding = contract
    assert receipts.validate_plan(plan, hypothesis)
    assert receipts.validates_observations(plan, evidence, binding)
    for field in ("hypothesis_id", "revision"):
        legacy = {k: v for k, v in hypothesis.items() if k != field}
        assert not receipts.validate_plan(plan, legacy)


def test_plan_binds_to_the_hypothesis_published_scope(contract):
    plan, hypothesis, _, _ = contract
    # A sibling subskill under the same published skill may host the retest.
    assert receipts.validate_plan({**plan, "scope": {**plan["scope"], "subskill_id": "SUB-2"}}, hypothesis)
    for field in ("subject", "grade", "skill_id", "curriculum_version"):
        assert not receipts.validate_plan({**plan, "scope": {**plan["scope"], field: "different"}}, hypothesis)
    assert not receipts.validate_plan(plan, {**hypothesis, "scope_context": None})


@pytest.mark.parametrize("change", ["empty", "stale", "primitive", "duplicate", "no-eligible", "no-answers",
                                    "blank-answer", "hash", "missing-provenance", "too-many", "not-dicts"])
def test_invalid_certification(contract, change):
    plan, hypothesis, _, _ = contract
    if change == "empty": plan["items"] = []
    if change == "stale": hypothesis["revision"] += 1
    if change == "primitive": plan["primitive_type"] = "base-ten-blocks"
    if change == "duplicate": plan["items"][1]["id"] = "a"
    if change == "no-eligible":
        for item in plan["items"]: item["eligible"] = False
    if change == "no-answers": plan["items"][1].pop("accepted_answers")
    if change == "blank-answer": plan["items"][1]["accepted_answers"] = ["  "]
    if change == "hash": plan["content_hash"] = "not-a-sha256"
    if change == "missing-provenance": plan.pop("compiler_version")
    if change == "too-many": plan["items"] += [dict(id=f"x{i}", eligible=False) for i in range(receipts.MAX_ITEMS)]
    if change == "not-dicts": plan["items"].append("a")
    assert not receipts.validate_plan(plan, hypothesis)


@pytest.mark.parametrize("change", ["wrong", "missing-transcript", "conflicting", "corrected-copy", "hint", "resync", "substitution", "incomplete", "order", "duplicate", "hash", "student", "instance", "lesson", "skill", "primitive", "late-transcript", "audio-overlap", "missing-turn"])
def test_observation_vetoes(contract, change):
    plan, _, evidence, binding = contract
    events = evidence["events"]
    if change == "wrong": events[2]["text"] = "two"
    if change == "missing-transcript": events.pop(2)
    if change == "conflicting": events[3]["kind"] = "corrected"
    if change == "corrected-copy": events.insert(1, dict(kind="corrected", item_id="a"))
    if change == "hint": events.insert(1, dict(kind="repeat", item_id="a"))
    if change == "resync": events.insert(1, dict(kind="resync", item_id="a"))
    if change == "substitution": events[2]["item_id"] = "substituted"
    if change == "incomplete": events.pop()
    if change == "order": events[1], events[2] = events[2], events[1]
    if change == "duplicate": events.insert(2, deepcopy(events[2]))
    if change == "hash": evidence["content_hash"] = "b" * 64
    if change in ("student", "instance", "lesson"): binding[change + "_id"] = "other"
    if change == "skill": binding["scope"] = {**binding["scope"], "skill_id": "other"}
    if change == "primitive": binding["primitive_type"] = "tape-diagram"
    if change == "late-transcript": events[2]["turn_opened_at"] = -1
    if change == "audio-overlap": events[1]["during_tutor_audio"] = True
    if change == "missing-turn": events[1].pop("turn_opened_at")
    for seq, event in enumerate(events): event["seq"] = seq
    assert not receipts.validates_observations(plan, evidence, binding)


def test_numeric_transcript_counts_when_the_compiler_accepted_it(contract):
    plan, _, evidence, binding = contract
    evidence["events"][2]["text"] = "200."
    assert receipts.validates_observations(plan, evidence, binding)


class MemoryTransactions:
    """Optimistic transaction model exercising production storage method bodies.

    Not an emulator or a claim about deployed Firestore rules.
    """
    def __init__(self):
        self.docs, self.versions, self.before_commit = {}, {}, None

    def document(self, path):
        db = self
        class Ref:
            def __init__(self, path): self.path = path
            def collection(self, name): return Ref(self.path + "/" + name)
            def document(self, name): return Ref(self.path + "/" + name)
            def get(self, transaction=None):
                if transaction: transaction.reads[self.path] = db.versions.get(self.path, 0)
                value = deepcopy(db.docs.get(self.path))
                return SimpleNamespace(exists=value is not None, to_dict=lambda: value)
        return Ref(path)

    def put(self, path, data):
        self.docs[path] = deepcopy(data)
        self.versions[path] = self.versions.get(path, 0) + 1

    def transaction(self):
        tx = SimpleNamespace(reads={}, writes=[])
        tx.set = lambda ref, data: tx.writes.append(("set", ref.path, data))
        tx.create = lambda ref, data: tx.writes.append(("create", ref.path, data))
        tx.update = lambda ref, data: tx.writes.append(("update", ref.path, data))
        return tx

    def transactional(self, fn):
        def run(tx):
            for _ in range(3):
                tx.reads, tx.writes = {}, []
                result = fn(tx)
                if self.before_commit:
                    hook, self.before_commit = self.before_commit, None
                    hook()
                if any(self.versions.get(p, 0) != v for p, v in tx.reads.items()): continue
                for kind, path, data in tx.writes:
                    if kind == "create": assert path not in self.docs
                    self.put(path, {**self.docs.get(path, {}), **data} if kind == "update" else data)
                return result
            raise RuntimeError("conflict")
        return run


@pytest.fixture
def storage(monkeypatch, contract):
    db = MemoryTransactions()
    monkeypatch.setattr("app.db.firestore_service.firestore.transactional", db.transactional)
    store = object.__new__(FirestoreService)
    store.client = db
    async def canonical_scope(_store, requested):
        return requested
    monkeypatch.setattr(scoping, "resolve_scope", canonical_scope)
    store._student_doc = lambda sid: db.document(f"students/{sid}")
    path = "students/990040/misconceptions/place-value-chart::SKILL-1"
    db.put(path, contract[1])
    return store, db, path


def test_production_storage_issue_submission_and_duplicate(storage, contract):
    async def run():
        store, db, path = storage
        plan, _, evidence, binding = contract
        receipt = await store.issue_misconception_opportunity(990040, plan)
        assert receipt
        service = SubmissionService(None, None, firestore_service=store)
        attempts = []
        async def fanout(**kwargs):
            attempts.append(kwargs["attempt_id"])
            return {"updated": True}
        service._update_competency = fanout
        submission = _submission(100, "place-value-chart", "SKILL-1", "place-value-chart")
        submission.subject = "MATHEMATICS"
        submission.primitive_response.update(instance_id="instance-1", student_work={"misconception_opportunity": {
            **evidence, "opportunity_set_id": receipt, "lesson_id": "lesson-1", "grade": "4", "curriculum_version": "synthetic-v1"}})
        result = await service.handle_submission(submission, {"student_id": 990040, "firebase_uid": "synthetic", "email": "x@test"})
        assert result.review["metadata"]["remediation_successful"]
        assert db.docs[path]["resolved_attempt_id"] == attempts[0]
        assert not await store.resolve_misconception_opportunity(990040, receipt, attempts[0], evidence, binding)
        assert not await store.resolve_misconception_opportunity(990040, receipt, "retry", evidence, binding)
    asyncio.run(run())


def test_issuance_refuses_a_plan_without_a_primitive_or_hypothesis(storage, contract):
    async def run():
        store, _, _ = storage
        plan, _, _, _ = contract
        assert await store.issue_misconception_opportunity(990040, {k: v for k, v in plan.items() if k != "primitive_type"}) is None
        assert await store.issue_misconception_opportunity(990040, {**plan, "primitive_type": "tape-diagram"}) is None
    asyncio.run(run())


def test_concurrent_rediagnosis_retries_without_clearing_new_revision(storage, contract):
    async def run():
        store, db, path = storage
        plan, hypothesis, evidence, binding = contract
        receipt = await store.issue_misconception_opportunity(990040, plan)
        db.before_commit = lambda: db.put(path, {**hypothesis, "revision": 2})
        assert not await store.resolve_misconception_opportunity(990040, receipt, "attempt", evidence, binding)
        assert db.docs[path]["revision"] == 2 and db.docs[path]["status"] == "active"
    asyncio.run(run())


def test_storage_failure_preserves_learning_attempt(contract):
    async def run():
        service = SubmissionService(None, None, firestore_service=SimpleNamespace())
        calls = []
        async def fanout(**kwargs):
            calls.append(kwargs)
            return {"updated": True}
        service._update_competency = fanout
        submission = _submission(100, "place-value-chart", "SKILL-1", "place-value-chart")
        submission.primitive_response["student_work"] = {"misconception_opportunity": {"opportunity_set_id": "unavailable"}}
        result = await service.handle_submission(submission, {"student_id": 990040, "firebase_uid": "synthetic", "email": "x@test"})
        assert len(calls) == 1 and result.competency == {"updated": True}
        assert not result.review["metadata"].get("remediation_successful")
    asyncio.run(run())


def test_service_auth_boundary_and_server_issuance_route(monkeypatch, storage, contract):
    import hashlib
    import hmac
    import json
    import time
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.endpoints import student_profile
    from app.core.middleware import get_user_context

    store, db, path = storage
    plan, hypothesis, _, _ = contract
    monkeypatch.setattr(student_profile, "get_firestore_service", lambda: store)
    async def canonical_scope(_store, requested): return requested
    monkeypatch.setattr(student_profile, "resolve_scope", canonical_scope)
    key = "synthetic-test-secret-never-for-production"
    monkeypatch.setenv("LUMINA_GENERATION_SIGNING_KEY", key)
    app = FastAPI()
    app.include_router(student_profile.router, prefix="/api/student-profile")
    app.dependency_overrides[get_user_context] = lambda: {"student_id": 990040}
    client = TestClient(app)
    route = "/api/student-profile/misconception-opportunities"
    body = json.dumps(plan)
    timestamp = str(int(time.time()))
    authorization = "Bearer synthetic"
    message = f"{route}\n{timestamp}\n{authorization}\n{body}".encode()
    headers = {"authorization": authorization, "content-type": "application/json", "x-lumina-time": timestamp,
               "x-lumina-signature": hmac.new(key.encode(), message, hashlib.sha256).hexdigest()}
    assert client.post(route, content=body, headers={"authorization": authorization}).status_code == 403
    assert client.post(route, content=body + " ", headers=headers).status_code == 403
    assert client.post(route, content=body, headers={**headers, "authorization": "Bearer another"}).status_code == 403
    assert client.post(route, content=body, headers={**headers, "x-lumina-time": "1"}).status_code == 403
    response = client.post(route, content=body, headers=headers)
    assert response.status_code == 200 and response.json()["opportunity_set_id"]
    receipt = db.docs[f"students/990040/misconception_opportunities/{response.json()['opportunity_set_id']}"]
    assert receipt["student_id"] == 990040
    assert db.docs[path]["status"] == "active"
    assert set(response.json()) == {"opportunity_set_id"}
    monkeypatch.delenv("LUMINA_GENERATION_SIGNING_KEY")
    assert client.post(route, content=body, headers=headers).status_code == 403


def test_canonical_scope_uses_published_parent_and_version(monkeypatch):
    async def run():
        async def resolve(value): return {"old-sub": "SUB", "old-skill": "PARENT"}.get(value, value)
        seen = []
        async def published(subject, grade):
            seen.append((subject, grade))
            return {"version_id": "published-version", "deployed_at": "deployment-1", "subskill_index": {"SUB": {"skill_id": "PARENT"}}}
        store = SimpleNamespace(_resolver=SimpleNamespace(resolve=resolve), get_published_curriculum=published,
                                normalize_grade_code=FirestoreService.normalize_grade_code)
        requested = dict(subject="MATHEMATICS", grade="Grade 3", subskill_id="old-sub", skill_id="old-skill")
        result = await scoping.resolve_scope(store, requested)
        assert result == dict(subject="MATHEMATICS", grade="3", subskill_id="SUB", skill_id="PARENT", curriculum_version="published-version@deployment-1")
        assert seen == [("MATHEMATICS", "3")]
        # Any canonical subject resolves through the same path; nothing is math-specific.
        assert (await scoping.resolve_scope(store, {**requested, "subject": "LANGUAGE_ARTS"}))["subject"] == "LANGUAGE_ARTS"
        assert await scoping.resolve_scope(store, {**requested, "skill_id": "guessed-parent"}) is None
        assert await scoping.resolve_scope(store, {**requested, "grade": None}) is None
        assert await scoping.resolve_scope(store, {**requested, "subject": None}) is None
    asyncio.run(run())


def test_rediagnosis_increments_revision_and_replaces_resolution_metadata(storage, contract):
    async def run():
        store, db, path = storage
        async def noop(*args): pass
        async def identity(value): return value
        store._ensure_student_document = noop
        store._resolver = SimpleNamespace(resolve=identity)
        first = await store.add_or_update_misconception(990040, "place-value-chart", "skill", "bare digit for worth",
            "source-2", skill_id="SKILL-1", subskill_id="SUB-1", scope_context=contract[0]["scope"])
        assert first["hypothesis_id"] == "hypothesis-1" and first["revision"] == 2
        db.put(path, {**first, "status": "resolved", "resolved_attempt_id": "old"})
        second = await store.add_or_update_misconception(990040, "place-value-chart", "skill", "bare digit for worth again",
            "source-3", skill_id="SKILL-1", subskill_id="SUB-1", scope_context=contract[0]["scope"])
        assert second["revision"] == 3 and second["status"] == "active"
        assert "resolved_attempt_id" not in second
    asyncio.run(run())


def test_client_cannot_supply_authoritative_state():
    from app.api.endpoints.student_profile import MisconceptionIn
    from pydantic import ValidationError
    for field, value in [("status", "resolved"), ("revision", 99), ("hypothesis_id", "forged"), ("scope_context", {}), ("delivery", "client")]:
        with pytest.raises(ValidationError):
            MisconceptionIn(primitive_type="place-value-chart", scope="skill", misconception_text="observation",
                            source_attempt_id="client-reference", **{field: value})


def test_real_generated_compiler_plan_through_canonical_submission(storage, contract):
    import json
    from pathlib import Path
    artifact = Path(__file__).parents[2] / "my-tutoring-app/qa/misconception/place-value-opportunities/2026-09-12T20-53-11-606Z/targeted-1.json"
    saved = json.loads(artifact.read_text())
    plan, _, evidence, _ = contract
    # The compiler now certifies accepted answers; this artifact predates the field (place-value arithmetic is test-side only).
    plan["items"] = [dict(i, accepted_answers=[i["answer_text"]] + ([str(i["digit"] * 10 ** i["place"])] if i["kind"] == "say_value" else []))
                     for i in saved["candidateItems"]]
    plan["content_hash"] = saved["contentHash"]
    evidence["content_hash"], evidence["events"] = saved["contentHash"], []
    for index, item in enumerate(plan["items"]):
        opened = index * 100 + 1
        for event in [dict(kind="presented"), dict(kind="response", source="voice", turn_opened_at=opened,
                           turn_closed_at=opened+1, during_tutor_audio=False),
                      dict(kind="transcript", text=item["answer_text"], turn_opened_at=opened),
                      dict(kind="affirmed", turn_opened_at=opened), dict(kind="completed", solved=True, corrections=0)]:
            evidence["events"].append(dict(event, seq=len(evidence["events"]), item_id=item["id"]))
    test_production_storage_issue_submission_and_duplicate(storage, contract)
