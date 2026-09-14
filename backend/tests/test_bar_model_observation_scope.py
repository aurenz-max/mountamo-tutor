"""bar-model picture_graph observations: same-skill delivery, no score/tag resolution."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.api.endpoints import student_profile as endpoint
from app.db.firestore_service import FirestoreService

SCOPE = dict(subject='MATHEMATICS', grade='3', skill_id='MEAS003-04', subskill_id='MEAS003-04-a', curriculum_version='v@t')
RECORD = dict(primitive_type='bar-model', status='active', scope='skill', scope_context=SCOPE,
              misconception_text='Reports the icon count as the row total.', last_detected_at='2026-09-13T00:00:00',
              learning_observation={'phases': [{'phase': 'picture_graph', 'challenge': 'Row shows 5 icons; each stands for 5.',
                                                'expected': '25', 'observed': 'Selections in order: 5, 25', 'support': 'highlighted'}]})


def test_bar_model_observations_reach_the_signed_context_for_the_same_published_skill(monkeypatch):
    records = {'bar-model::MEAS003-04': dict(RECORD, source_attempt_id='attempt-secret')}
    resolver = SimpleNamespace(resolve=AsyncMock(side_effect=lambda value: value))
    store = SimpleNamespace(_resolver=resolver, get_active_misconceptions=AsyncMock(side_effect=lambda _id: records))
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: store)
    monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=SCOPE))

    async def context():
        return await endpoint.learning_observation_context(endpoint.ObservationContextIn(scope=SCOPE), {'student_id': 42})

    async def run():
        result = await context()
        assert result['available'] is True
        [row] = result['observations']
        assert row['summary'] == RECORD['misconception_text']
        assert 'Selections in order: 5, 25' in row['evidence']
        assert 'attempt-secret' not in str(result)
        for patch in ({'scope_context': {**SCOPE, 'grade': '2'}}, {'scope_context': {**SCOPE, 'skill_id': 'MEAS003-05'}},
                      {'scope_context': None}, {'scope': 'primitive'}, {'status': 'resolved'}):
            records['bar-model::MEAS003-04'] = {**RECORD, **patch}
            assert (await context())['available'] is False
    asyncio.run(run())


def test_score_or_client_tag_never_resolves_a_bar_model_hypothesis():
    store = FirestoreService.__new__(FirestoreService)
    updates = []
    doc = SimpleNamespace(get=lambda: SimpleNamespace(exists=True, to_dict=lambda: dict(RECORD)), update=updates.append)
    store._misconceptions_subcollection = lambda _sid: SimpleNamespace(document=lambda _key: doc)
    assert asyncio.run(store.resolve_misconception(42, 'bar-model', 'MEAS003-04')) is False
    assert updates == []  # a stamped hypothesis is never flipped by score + tag


def test_capture_requires_a_resolvable_published_skill_scope(monkeypatch):
    stored = AsyncMock(return_value={'misconception_key': 'bar-model::MEAS003-04', 'status': 'active'})
    store = SimpleNamespace(add_or_update_misconception=stored)
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: store)
    body = dict(grade='3', subject='MATHEMATICS', delivery='server', primitive_type='bar-model', scope='skill', subskill_id='MEAS003-04-a', skill_id='MEAS003-04',
                misconception_text=RECORD['misconception_text'], source_attempt_id='a1')

    async def run():
        monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=None))
        assert (await endpoint.record_misconception(endpoint.MisconceptionIn(**body), {'student_id': 42}))['stored'] is False
        assert (await endpoint.record_misconception(endpoint.MisconceptionIn(**{**body, 'scope': 'primitive'}),
                                                    {'student_id': 42}))['stored'] is False
        monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=SCOPE))
        assert (await endpoint.record_misconception(endpoint.MisconceptionIn(**body), {'student_id': 42}))['stored'] is True
        assert stored.await_args.kwargs['scope_context'] == SCOPE
    asyncio.run(run())
