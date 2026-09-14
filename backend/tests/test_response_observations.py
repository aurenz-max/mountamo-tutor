import asyncio
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from google.api_core.exceptions import AlreadyExists
from app.api.endpoints import student_profile as endpoint
from app.core.middleware import get_user_context
from app.db.firestore_service import FirestoreService


def packet():
    return dict(primitive_type='place-value-chart', source_attempt_id='client-ref',
        subject='MATHEMATICS', grade='4', skill_id='NBT004-01', subskill_id='NBT004-01-b', eval_mode='compare',
        kind='strength', summary='Tentative value success.', teachingImplication='Use similar tasks.',
        checkNext='Check a fresh item.', evidenceItemIds=['a', 'b'], responses=[dict(itemId=id,
            phase='say_value', challenge='Say value', expected='forty', observed='forty', verdict='affirmed',
            source='voice', priorCorrections=0, hearTapsSoFar=0, support='Other assistance unknown') for id in ['a', 'b']])


def test_owner_storage_projection_and_evidence_gate(monkeypatch):
    saved = {}
    async def save(sid, data):
        saved.setdefault((sid, 'record'), dict(data, created_at='2026-09-12'))
        return 'record'
    async def read(sid):
        return [(id, value) for (owner, id), value in saved.items() if owner == sid]
    store = SimpleNamespace(save_response_observation=save, get_response_observations=read,
        _misconceptions_subcollection=lambda _: SimpleNamespace(limit=lambda _: SimpleNamespace(stream=lambda: [])))
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: store)
    app = FastAPI(); app.include_router(endpoint.router); client = TestClient(app)
    assert client.post('/learning-observations', json=packet()).status_code in (401, 403)
    app.dependency_overrides[get_user_context] = lambda: {'student_id': 42}
    assert client.post('/learning-observations', json=packet()).json()['stored']
    observation = client.get('/learning-observations?student_id=999').json()['observations'][0]
    assert observation['kind'] == 'strength' and observation['status'] == 'suspected'
    assert observation['evidence'][0]['referenceKind'] == 'client-attempt'
    assert 'unverified transcription' in observation['evidence'][0]['response']
    assert 'expected' not in str(observation)
    for change in [{'student_id': 99}, {'status': 'supported'}, {'kind': 'pattern'},
                   {'evidenceItemIds': ['a', 'missing']}, {'evidenceItemIds': ['a', 'a']}, {'kind': 'support'}]:
        assert client.post('/learning-observations', json={**packet(), **change}).status_code == 422
    malformed = packet(); malformed['responses'][1]['phase'] = 'name_place'
    assert client.post('/learning-observations', json=malformed).status_code == 422
    app.dependency_overrides[get_user_context] = lambda: {'student_id': 99}
    assert client.get('/learning-observations').json()['observations'] == []


def test_writer_keeps_distinct_attempts_and_first_inference_on_retry():
    records = {}
    def document(key):
        def create(value):
            if key in records: raise AlreadyExists('duplicate')
            records[key] = deepcopy(value)
        return SimpleNamespace(create=create)
    def collection(name):
        assert name == 'learning_observations'  # No misconception/progress writer.
        return SimpleNamespace(document=document)
    store = object.__new__(FirestoreService)
    store._resolver = SimpleNamespace(resolve=AsyncMock(side_effect=lambda id: id))
    store._student_doc = lambda sid: SimpleNamespace(collection=collection)
    async def run():
        first = await store.save_response_observation(42, packet())
        assert await store.save_response_observation(42, {**packet(), 'summary': 'Changed'}) == first
        second = await store.save_response_observation(42, {**packet(), 'source_attempt_id': 'new-attempt'})
        assert first != second and len(records) == 2
        assert records[first]['summary'] == packet()['summary']
        assert records[first]['source_reference_kind'] == 'client-attempt'
        assert records[first]['schema_version'] == 1
    asyncio.run(run())
