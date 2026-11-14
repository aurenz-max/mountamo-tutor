import asyncio
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.endpoints import student_profile as endpoint
from app.core.middleware import get_user_context
from app.dependencies import get_curriculum_mapping_service
from app.db.firestore_service import FirestoreService
from app.services.attempt_notes import note_home, note_record, packet_notes


def body(**change):
    return {**dict(primitive_type='phonics-blender', source_attempt_id='client-1', subject='Language Arts', grade='Kindergarten',
        subskill_id='LA001-02-a', eval_mode='blend', score=70, did='Blended three words.',
        signals=[dict(kind='struggle', what="Said 'sign' when asked to blend the sounds for sun.", evidence='observed: sign')]), **change}


def harness(monkeypatch, index):
    saved = []
    async def resolve(value): return value
    async def save(sid, record):
        saved.append((sid, record)); return 'id'
    async def metadata(subskill, subject): return index.get(subskill)
    store = SimpleNamespace(_resolver=SimpleNamespace(resolve=resolve), save_attempt_note=save,
        normalize_grade_code=FirestoreService.normalize_grade_code)
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: store)
    app = FastAPI(); app.include_router(endpoint.router)
    app.dependency_overrides[get_curriculum_mapping_service] = lambda: SimpleNamespace(
        curriculum_service=SimpleNamespace(get_subskill_metadata=metadata))
    return app, TestClient(app), saved


def test_note_is_filed_under_the_published_home_for_the_signed_in_owner(monkeypatch):
    app, client, saved = harness(monkeypatch, {'LA001-02-a': {'unit_id': 'LA001', 'skill_id': 'LA001-02'}})
    assert client.post('/attempt-notes', json=body()).status_code in (401, 403)
    app.dependency_overrides[get_user_context] = lambda: {'student_id': 42}
    assert client.post('/attempt-notes', json=body()).json() == {
        'stored': True, 'unit_id': 'LA001', 'skill_id': 'LA001-02', 'subskill_id': 'LA001-02-a'}
    sid, record = saved[0]
    assert sid == 42 and record['subject'] == 'LANGUAGE_ARTS' and record['grade'] == 'K' and record['notable'] is True
    assert record['unit_id'] == 'LA001' and record['signals'][0]['kind'] == 'struggle'
    # No home, no write; identity and unknown fields are never accepted from the body.
    assert client.post('/attempt-notes', json=body(subskill_id='free-form')).json()['reason'] == 'no-curriculum-home'
    assert client.post('/attempt-notes', json=body(subskill_id='NOPE-1')).json()['reason'] == 'no-curriculum-home'
    for bad in [dict(student_id=7), dict(unit_id='LA009'), dict(signals=[dict(kind='trait', what='x')]),
                dict(signals=[dict(kind='struggle', what='x')] * 3)]:
        assert client.post('/attempt-notes', json=body(**bad)).status_code == 422
    assert len(saved) == 1


def test_a_note_with_no_signal_is_stored_but_not_notable(monkeypatch):
    app, client, saved = harness(monkeypatch, {'LA001-02-a': {'unit_id': 'LA001', 'skill_id': 'LA001-02'}})
    app.dependency_overrides[get_user_context] = lambda: {'student_id': 42}
    assert client.post('/attempt-notes', json=body(signals=[])).json()['stored']
    assert saved[0][1]['notable'] is False


def test_packet_rows_carry_the_home_and_no_attempt_id_or_evidence():
    home = dict(unit_id='LA001', skill_id='LA001-02', subskill_id='LA001-02-a')
    older = dict(note_record(body(), home, 'LANGUAGE_ARTS', 'K'), created_at='2026-11-01')
    newer = dict(note_record(body(source_attempt_id='client-2', signals=[
        dict(kind='strength', what='Blended cat, map and tap.', evidence='x'), dict(kind='struggle', what='', evidence='')]),
        home, 'LANGUAGE_ARTS', 'K'), created_at='2026-11-05')
    other = dict(note_record(body(), home, 'MATHEMATICS', 'K'), created_at='2026-11-09')
    rows = packet_notes([('a', older), ('b', newer), ('c', other)], 'LANGUAGE_ARTS')
    assert [r['kind'] for r in rows] == ['strength', 'struggle']
    assert rows[0]['unitId'] == 'LA001' and rows[0]['subskillId'] == 'LA001-02-a' and rows[0]['grade'] == 'K'
    assert rows[0]['id'].startswith('note-') and rows[0]['id'] != rows[1]['id']
    assert 'client-' not in str(rows) and 'evidence' not in str(rows) and 'observed' not in str(rows)


def test_home_refuses_placeholders_and_unpublished_ids():
    async def resolve(value): return value
    async def metadata(subskill, subject): return {'unit_id': 'U', 'skill_id': 'S'} if subskill == 'real' else None
    store = SimpleNamespace(_resolver=SimpleNamespace(resolve=resolve))
    service = SimpleNamespace(get_subskill_metadata=metadata)
    assert asyncio.run(note_home(store, service, 'X', 'real')) == {'unit_id': 'U', 'skill_id': 'S', 'subskill_id': 'real'}
    for missing in ['unknown', 'free-form', '', 'gone']:
        assert asyncio.run(note_home(store, service, 'X', missing)) is None
