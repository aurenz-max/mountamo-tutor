import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.endpoints import student_profile as endpoint
from app.core.middleware import get_user_context


def test_authenticated_problem_phase_round_trip(monkeypatch):
    records = {}
    async def save(**kwargs):
        assert kwargs['student_id'] == 42
        records['demo'] = {**kwargs, 'status': 'active', 'last_detected_at': '2026-09-12',
                           'hypothesis_id': 'private', 'misconception_key': 'demo'}
        return records['demo']
    def collection(student_id):
        assert student_id == 42
        return SimpleNamespace(limit=lambda count: SimpleNamespace(stream=lambda: [
            SimpleNamespace(id=key, to_dict=lambda value=value: value) for key, value in records.items()
        ]))
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: SimpleNamespace(
        add_or_update_misconception=save, _misconceptions_subcollection=collection,
        get_response_observations=AsyncMock(return_value=[])))
    app = FastAPI(); app.include_router(endpoint.router)
    client = TestClient(app)
    assert client.get('/learning-observations').status_code in (401, 403)
    app.dependency_overrides[get_user_context] = lambda: {'student_id': 42}
    # A legacy (client-delivered) capture: no delivery flag, so no published scope is required.
    body = dict(primitive_type='demo-primitive', scope='skill', skill_id='skill', subskill_id='subskill',
                misconception_text='Possible confusion about direction.', source_attempt_id='client-reference',
                learning_observation=dict(subject='MATHEMATICS', grade='4', evalMode='compare', problem='Locate a value',
                    phases=[dict(itemId='item-1', phase='locate', challenge='Locate a value', expected='Right',
                                 observed='Moved left', support='Correction observation')],
                    teachingImplication='Contrast directions.', checkNext='Try a fresh value.'))
    assert client.post('/misconceptions', json=body).json()['stored']
    result = client.get('/learning-observations?student_id=999').json()['observations'][0]
    assert result['status'] == 'suspected'
    assert result['evidence'][0]['phase'] == 'locate'
    assert result['evidence'][0]['response'] == 'Moved left'
    assert result['teachingImplication'] == 'Contrast directions.'
    assert 'private' not in str(result) and 'expected' not in str(result)
    records['legacy'] = {'misconception_text': 'Earlier diagnosis without a structured packet'}
    assert client.get('/learning-observations').json()['legacyCount'] == 1
    body['learning_observation']['phases'] *= 13
    assert client.post('/misconceptions', json=body).status_code == 422


def test_named_miss_is_stored_with_its_phase_and_kept_out_of_delivery_and_profile(monkeypatch):
    from app.services.learning_observations import delivery_packet, project_misconception_observation
    saved = {}
    async def save(**kwargs):
        saved.update(kwargs)
        return {'misconception_key': 'k', 'status': 'active'}
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: SimpleNamespace(add_or_update_misconception=save))
    app = FastAPI(); app.include_router(endpoint.router)
    app.dependency_overrides[get_user_context] = lambda: {'student_id': 42}
    client = TestClient(app)
    phase = dict(itemId='coin-1', phase='count-mixed', challenge='How much money?', expected='35', observed='5', support='s')
    body = dict(primitive_type='demo-primitive', scope='skill', skill_id='skill', subskill_id='subskill',
                misconception_text='Counts coins, not value.', source_attempt_id='ref',
                learning_observation=dict(subject='MATHEMATICS', grade='2', evalMode='count-mixed', problem='p',
                    phases=[{**phase, 'miss': 'counted_coins'}, phase], teachingImplication='t', checkNext='c'))
    assert client.post('/misconceptions', json=body).json()['stored']
    stored = saved['learning_observation']['phases']
    assert stored[0]['miss'] == 'counted_coins' and stored[0]['phase'] == 'count-mixed' and 'miss' not in stored[1]
    record = dict(learning_observation=saved['learning_observation'], misconception_text='x', status='active', scope='skill',
                  primitive_type='demo-primitive', scope_context=dict(skill_id='skill'), hypothesis_id='h')
    assert 'counted_coins' not in str(project_misconception_observation('id', record))
    resolver = SimpleNamespace(_resolver=SimpleNamespace(resolve=AsyncMock(side_effect=lambda v: v)))
    monkeypatch.setattr('app.services.learning_observations.is_server_delivered', lambda r: True)
    packet = asyncio.run(delivery_packet(resolver, {'k': record}, [], 42))
    assert packet['hypotheses'] and 'counted_coins' not in str(packet)
    body['learning_observation']['phases'][0]['miss'] = 'x' * 121
    assert client.post('/misconceptions', json=body).status_code == 422


def test_firestore_writer_preserves_inspectable_packet():
    from app.db.firestore_service import FirestoreService
    store = object.__new__(FirestoreService)
    store._resolver = SimpleNamespace(resolve=AsyncMock(side_effect=lambda value: value))
    store._ensure_student_document = AsyncMock()
    store._add_migration_metadata = lambda value: value
    store._prepare_firestore_data = lambda value: value
    written = []
    doc = SimpleNamespace(get=lambda: SimpleNamespace(exists=False), set=written.append)
    store._misconceptions_subcollection = lambda _: SimpleNamespace(document=lambda _: doc)
    packet = {'problem': 'A task', 'phases': [{'phase': 'compare'}]}
    asyncio.run(store.add_or_update_misconception(42, 'number-line', 'skill', 'A hypothesis', 'ref',
                skill_id='skill', subskill_id='subskill', learning_observation=packet))
    assert written[0]['learning_observation'] == packet


def test_canonical_67_percent_submission_preserves_problem_and_phase_evidence_in_review():
    from app.services.submission_service import SubmissionService
    from tests.test_misconception_round_trip import _submission, _TracingStore
    async def run():
        store = _TracingStore()
        store.save_problem_review = AsyncMock()
        cosmos = SimpleNamespace(save_problem_review=AsyncMock())
        service = SubmissionService(None, None, cosmos_db=cosmos, firestore_service=store)
        service._update_competency = AsyncMock(return_value={'updated': True})
        submission = _submission(67, 'place-value-chart', 'SKILL-1', 'place-value-chart')
        packet = {'problem': {'challengeType': 'compare', 'challenges': [{'targetNumber': 2258}]},
                  'challengeResults': [{'id': 'item-1', 'solved': False}],
                  'diagnosisEvidence': {'phases': [{'phase': 'name-place', 'observed': 'two hundred'}]}}
        submission.primitive_response['student_work'] = packet
        result = await service.handle_submission(submission, {
            'student_id': 990040, 'firebase_uid': 'synthetic', 'email': 'test@example.invalid'})
        assert result.review
        saved = store.save_problem_review.call_args.kwargs
        assert saved['problem_content']['student_work'] == packet
        assert saved['attempt_id'] == service._update_competency.call_args.kwargs['attempt_id']
        assert cosmos.save_problem_review.call_args.kwargs['problem_content']['student_work'] == packet
    asyncio.run(run())
