"""Base-ten-blocks as a second server-delivered observation source (synthetic, in memory)."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.api.endpoints import student_profile as endpoint
from app.db.firestore_service import FirestoreService
from app.services.submission_service import SubmissionService
from tests.test_misconception_generation_context import _run
from tests.test_misconception_round_trip import _TracingStore, _submission

SCOPE = dict(subject='MATHEMATICS', grade='4', skill_id='NBT004-01', subskill_id='NBT004-01-b', curriculum_version='v@t')


def test_blocks_capture_requires_skill_scope_and_stores_the_canonical_scope(monkeypatch):
    store = SimpleNamespace(add_or_update_misconception=AsyncMock(return_value={'misconception_key': 'k', 'status': 'active'}))
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: store)
    body = dict(primitive_type='base-ten-blocks', scope='skill', grade='4', subject='MATHEMATICS', delivery='server', skill_id='NBT004-01',
                subskill_id='NBT004-01-b', misconception_text='Says the bare block count for its worth.', source_attempt_id='a1')
    user = {'student_id': 42, 'firebase_uid': 'u'}
    async def run():
        monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=None))
        assert (await endpoint.record_misconception(endpoint.MisconceptionIn(**body), user)) == {
            'stored': False, 'reason': 'unresolved-canonical-scope'}
        assert (await endpoint.record_misconception(endpoint.MisconceptionIn(**{**body, 'scope': 'primitive'}), user))['reason'] == 'skill-scope-required'
        store.add_or_update_misconception.assert_not_called()
        monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=SCOPE))
        assert (await endpoint.record_misconception(endpoint.MisconceptionIn(**body), user))['stored']
        kwargs = store.add_or_update_misconception.call_args.kwargs
        assert kwargs['primitive_type'] == 'base-ten-blocks' and kwargs['scope_context'] == SCOPE and kwargs['skill_id'] == 'NBT004-01'
    asyncio.run(run())


def test_store_stamps_scope_context_with_a_revisioned_hypothesis_identity(monkeypatch):
    # Every scope-stamped hypothesis gets the same stable identity as place value:
    # re-diagnosis bumps the revision and keeps the hypothesis_id.
    from tests.test_misconception_opportunities import MemoryTransactions
    db = MemoryTransactions()
    monkeypatch.setattr('app.db.firestore_service.firestore.transactional', db.transactional)
    store = FirestoreService.__new__(FirestoreService)
    store.client = db
    store._resolver = SimpleNamespace(resolve=AsyncMock(side_effect=lambda value: value))
    store._ensure_student_document = AsyncMock()
    store._student_doc = lambda sid: db.document(f'students/{sid}')
    store._misconceptions_subcollection = lambda sid: db.document(f'students/{sid}/misconceptions')
    async def write(text):
        return await store.add_or_update_misconception(42, 'base-ten-blocks', 'skill', text, 'a1',
            subskill_id='NBT004-01-b', skill_id='NBT004-01', scope_context=SCOPE)
    first = asyncio.run(write('text'))
    assert first['scope_context'] == SCOPE and first['misconception_key'] == 'base-ten-blocks::NBT004-01'
    assert first['hypothesis_id'] and first['revision'] == 1
    second = asyncio.run(write('text again'))
    assert second['hypothesis_id'] == first['hypothesis_id'] and second['revision'] == 2
    assert db.docs['students/42/misconceptions/base-ten-blocks::NBT004-01']['revision'] == 2


def test_generation_context_never_hands_blocks_prose_to_the_client_manifest(monkeypatch):
    result, _ = _run(monkeypatch, {'base-ten-blocks::SKILL-1': {
        'misconception_text': 'Says the bare block count for its worth.', 'primitive_type': 'base-ten-blocks',
        'scope_context': SCOPE, 'scope': 'skill', 'skill_id': 'SKILL-1', 'subskill_id': 'SUB-1', 'misconception_key': 'base-ten-blocks::SKILL-1'}})
    assert result['activeMisconceptions'][0]['text'] == ''


def test_blocks_scores_and_client_tags_never_resolve_the_source():
    async def run():
        store = _TracingStore()
        await store.add_or_update_misconception(990041, 'base-ten-blocks', 'skill',
            'Says the bare block count for its worth.', 'synthetic-failure', subskill_id='SUB-1', skill_id='SKILL-1',
            scope_context=SCOPE)
        service = SubmissionService(None, None, firestore_service=store)
        async def fanout(**_kwargs):
            store.events.append('fanout')
            return {'updated': True}
        service._update_competency = fanout
        await service.handle_submission(_submission(95, 'base-ten-blocks', 'SKILL-1', primitive_type='base-ten-blocks'),
            {'firebase_uid': 'synthetic', 'student_id': 990041, 'email': 'synthetic@example.test'})
        assert 'fanout' in store.events
        assert 'base-ten-blocks::SKILL-1' in await store.get_active_misconceptions(990041)
        stamped = FirestoreService.__new__(FirestoreService)
        updates = []
        doc = SimpleNamespace(get=lambda: SimpleNamespace(exists=True, to_dict=lambda: dict(status='active', scope_context=SCOPE)),
                              update=updates.append)
        stamped._misconceptions_subcollection = lambda _sid: SimpleNamespace(document=lambda _key: doc)
        assert await stamped.resolve_misconception(990041, 'base-ten-blocks', 'SKILL-1') is False and updates == []
    asyncio.run(run())
