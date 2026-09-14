"""bar-model picture_graph observations: deliverable in the launch packet as a stamped record, no score/tag resolution.
Per-task scope selection is the generation server's (learningObservationPacket.test.ts)."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.api.endpoints import student_profile as endpoint
from app.db.firestore_service import FirestoreService
from app.services.learning_observations import delivery_packet

SCOPE = dict(subject='MATHEMATICS', grade='3', skill_id='MEAS003-04', subskill_id='MEAS003-04-a', curriculum_version='v@t')
RECORD = dict(primitive_type='bar-model', status='active', scope='skill', scope_context=SCOPE,
              misconception_text='Reports the icon count as the row total.', last_detected_at='2026-09-13T00:00:00',
              learning_observation={'phases': [{'phase': 'picture_graph', 'challenge': 'Row shows 5 icons; each stands for 5.',
                                                'expected': '25', 'observed': 'Selections in order: 5, 25', 'support': 'highlighted'}]})


def test_bar_model_observations_enter_the_packet_with_their_stamped_scope():
    records = {'bar-model::MEAS003-04': dict(RECORD, source_attempt_id='attempt-secret')}
    store = SimpleNamespace(_resolver=SimpleNamespace(resolve=AsyncMock(side_effect=lambda value: value)))
    scopes = [{'subskillId': SCOPE['subskill_id'], 'skillId': SCOPE['skill_id'], 'published': SCOPE}]

    async def packet():
        return await delivery_packet(store, records, scopes, 42)

    async def run():
        result = await packet()
        [row] = result['hypotheses']
        assert row['summary'] == RECORD['misconception_text'] and row['scope'] == SCOPE and row['skillId'] == 'MEAS003-04'
        assert 'Selections in order: 5, 25' in str(row['evidence'])
        assert 'attempt-secret' not in str(result)
        records['bar-model::MEAS003-04'] = {**RECORD, 'scope_context': {**SCOPE, 'grade': '2'}}
        assert (await packet())['hypotheses'][0]['scope']['grade'] == '2'
        for patch in ({'scope_context': None}, {'scope': 'primitive'}, {'status': 'resolved'}):
            records['bar-model::MEAS003-04'] = {**RECORD, **patch}
            assert (await packet())['hypotheses'] == []
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
