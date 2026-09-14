"""number-line jump observations: deliverable in the launch packet as a stamped same-skill record, no score/tag resolution.
Per-task scope selection is the generation server's (learningObservationPacket.test.ts)."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.api.endpoints import student_profile as endpoint
from app.db.firestore_service import FirestoreService
from app.services.learning_observations import delivery_packet

SCOPE = dict(subject='MATHEMATICS', grade='1', skill_id='OPS001-03', subskill_id='OPS001-03-a', curriculum_version='v@t')
RECORD = dict(primitive_type='number-line', status='active', scope='skill', scope_context=SCOPE,
              misconception_text='Counts the starting number as the first hop.', last_detected_at='2026-09-13T00:00:00',
              learning_observation={'phases': [{'phase': 'single jump', 'challenge': 'Start at 8 and add 3 (3 spaces right)',
                                                'expected': 'landing at 11', 'observed': 'Incorrect: landing placed at 10, 2 spaces right of 8',
                                                'support': 'Start marked; no jump arc drawn; first try'}]})


def test_number_line_observations_enter_the_packet_with_their_stamped_skill():
    records = {'number-line::OPS001-03': dict(RECORD, source_attempt_id='attempt-secret')}
    store = SimpleNamespace(_resolver=SimpleNamespace(resolve=AsyncMock(side_effect=lambda value: value)))
    scopes = [{'subskillId': SCOPE['subskill_id'], 'skillId': SCOPE['skill_id'], 'published': SCOPE}]

    async def packet():
        return await delivery_packet(store, records, scopes, 42)

    async def run():
        result = await packet()
        [row] = result['hypotheses']
        assert row['summary'] == RECORD['misconception_text'] and row['skillId'] == 'OPS001-03' and row['scope'] == SCOPE
        assert 'landing placed at 10' in str(row['evidence'])
        assert 'attempt-secret' not in str(result)
        # Count back (OPS001-04) stays a different skill in the packet; the generation server joins on it.
        records['number-line::OPS001-03'] = {**RECORD, 'scope_context': {**SCOPE, 'skill_id': 'OPS001-04'}}
        assert (await packet())['hypotheses'][0]['skillId'] == 'OPS001-04'
        for patch in ({'scope_context': None}, {'scope': 'primitive'}, {'status': 'resolved'}):
            records['number-line::OPS001-03'] = {**RECORD, **patch}
            assert (await packet())['hypotheses'] == []
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
