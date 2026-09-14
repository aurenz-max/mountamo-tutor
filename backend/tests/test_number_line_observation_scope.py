"""number-line jump observations: same published skill only, no score/tag resolution."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.api.endpoints import student_profile as endpoint
from app.db.firestore_service import FirestoreService

SCOPE = dict(subject='MATHEMATICS', grade='1', skill_id='OPS001-03', subskill_id='OPS001-03-a', curriculum_version='v@t')
RECORD = dict(primitive_type='number-line', status='active', scope='skill', scope_context=SCOPE,
              misconception_text='Counts the starting number as the first hop.', last_detected_at='2026-09-13T00:00:00',
              learning_observation={'phases': [{'phase': 'single jump', 'challenge': 'Start at 8 and add 3 (3 spaces right)',
                                                'expected': 'landing at 11', 'observed': 'Incorrect: landing placed at 10, 2 spaces right of 8',
                                                'support': 'Start marked; no jump arc drawn; first try'}]})


def test_number_line_observations_reach_only_the_same_published_skill(monkeypatch):
    records = {'number-line::OPS001-03': dict(RECORD, source_attempt_id='attempt-secret')}
    store = SimpleNamespace(_resolver=SimpleNamespace(resolve=AsyncMock(side_effect=lambda value: value)),
                            get_active_misconceptions=AsyncMock(side_effect=lambda _id: records))
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: store)
    monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=SCOPE))

    async def context():
        return await endpoint.learning_observation_context(endpoint.ObservationContextIn(scope=SCOPE), {'student_id': 42})

    async def run():
        result = await context()
        assert result['available'] is True
        [row] = result['observations']
        assert row['summary'] == RECORD['misconception_text']
        assert 'landing placed at 10' in row['evidence']
        assert 'attempt-secret' not in str(result)
        # Count back (OPS001-04) is a different skill: no delivery across it.
        for patch in ({'scope_context': {**SCOPE, 'skill_id': 'OPS001-04'}}, {'scope_context': {**SCOPE, 'grade': '2'}},
                      {'scope_context': None}, {'scope': 'primitive'}, {'status': 'resolved'}):
            records['number-line::OPS001-03'] = {**RECORD, **patch}
            assert (await context())['available'] is False
    asyncio.run(run())


def test_score_or_client_tag_never_resolves_a_number_line_hypothesis():
    store = FirestoreService.__new__(FirestoreService)
    updates = []
    doc = SimpleNamespace(get=lambda: SimpleNamespace(exists=True, to_dict=lambda: dict(RECORD)), update=updates.append)
    store._misconceptions_subcollection = lambda _sid: SimpleNamespace(document=lambda _key: doc)
    assert asyncio.run(store.resolve_misconception(42, 'number-line', 'OPS001-03')) is False
    assert updates == []  # a stamped hypothesis is never flipped by score + tag


def test_capture_requires_a_resolvable_published_skill_scope(monkeypatch):
    stored = AsyncMock(return_value={'misconception_key': 'number-line::OPS001-03', 'status': 'active'})
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: SimpleNamespace(add_or_update_misconception=stored))
    body = dict(grade='1', subject='MATHEMATICS', delivery='server', primitive_type='number-line', scope='skill', subskill_id='OPS001-03-a', skill_id='OPS001-03',
                misconception_text=RECORD['misconception_text'], source_attempt_id='a1')

    async def run():
        monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=None))
        assert (await endpoint.record_misconception(endpoint.MisconceptionIn(**body), {'student_id': 42}))['stored'] is False
        monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=SCOPE))
        assert (await endpoint.record_misconception(endpoint.MisconceptionIn(**body), {'student_id': 42}))['stored'] is True
        assert stored.await_args.kwargs['scope_context'] == SCOPE
    asyncio.run(run())
