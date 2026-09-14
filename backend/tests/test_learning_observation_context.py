import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.endpoints import student_profile as endpoint
from app.core.generation_auth import require_generation_server
from app.core.middleware import get_user_context
from app.services.learning_observations import scoped_misconception_observations

SCOPE = dict(subject='MATHEMATICS', grade='3', skill_id='NF001-03', subskill_id='NF001-03-b', curriculum_version='v@1')
PACKET = dict(subject='MATHEMATICS', grade='3', evalMode='build', problem='Fraction bar build', teachingImplication='t', checkNext='c',
              phases=[dict(itemId='fraction-bar-1', phase='numerator', challenge='3/4 numerator?', expected='3', observed='4', support='Attempt 1')])


def record(**patch):
    base = dict(primitive_type='fraction-bar', status='active', scope='skill', misconception_text='Swaps numerator and denominator roles.',
                scope_context={**SCOPE, 'subskill_id': 'NF001-03-a', 'curriculum_version': 'older@0'},
                hypothesis_id='h1', last_detected_at='2026-09-13T08:00', learning_observation=PACKET)
    return {**base, **patch}


def store(lineage=None):
    lineage = lineage or {}
    return SimpleNamespace(_resolver=SimpleNamespace(resolve=AsyncMock(side_effect=lambda value: lineage.get(value, value))))


def test_delivers_only_server_delivered_hypotheses_at_the_same_published_skill():
    records = {
        'fraction-bar::NF001-03': record(),
        'place-value-chart::NBT004-01': record(primitive_type='place-value-chart', scope_context={**SCOPE, 'grade': '4'}),
        'client-delivered': record(primitive_type='picture-vocabulary', scope_context=None),  # legacy loop: no stamped scope
        'resolved': record(status='resolved'),
        'primitive-scoped': record(scope='primitive'),
        'other-skill': record(scope_context={**SCOPE, 'skill_id': 'NF001-04'}),
        'unstamped': record(scope_context=None),
        'blank': record(misconception_text='  '),
    }
    rows = asyncio.run(scoped_misconception_observations(store(), records, SCOPE))
    assert len(rows) == 1
    assert rows[0]['id'].startswith('observation-') and 'fraction-bar' not in rows[0]['id']
    assert rows[0]['summary'] == 'Swaps numerator and denominator roles.'
    assert '"observed":"4"' in rows[0]['evidence'] and 'fraction-bar-1' not in rows[0]['evidence']


def test_lineage_resolution_bounds_and_orders_delivery():
    renamed = {f'r{i}': record(scope_context={**SCOPE, 'skill_id': 'OLD-03'}, hypothesis_id=f'h{i}', last_detected_at=f'2026-09-{i:02d}',
                               learning_observation={**PACKET, 'phases': PACKET['phases'] * 60}) for i in range(1, 13)}
    rows = asyncio.run(scoped_misconception_observations(store({'OLD-03': 'NF001-03'}), renamed, SCOPE))
    assert len(rows) == 10
    assert all(len(row['evidence']) <= 7000 for row in rows)
    assert len({row['id'] for row in rows}) == 10


def test_endpoint_requires_signature_and_owner_and_resolves_published_scope(monkeypatch):
    monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(return_value=SCOPE))
    active = AsyncMock(return_value={'fraction-bar::NF001-03': record()})
    fake = store()
    fake.get_active_misconceptions = active
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: fake)
    app = FastAPI(); app.include_router(endpoint.router)
    client = TestClient(app)
    body = {'scope': {k: SCOPE[k] for k in ('subject', 'grade', 'skill_id', 'subskill_id')}}
    app.dependency_overrides[get_user_context] = lambda: {'student_id': 42}
    assert client.post('/learning-observation-context', json=body).status_code in (401, 403)
    app.dependency_overrides[require_generation_server] = lambda: None
    response = client.post('/learning-observation-context', json=body).json()
    assert response['available'] is True and len(response['observations']) == 1
    active.assert_awaited_with(42)
    assert client.post('/learning-observation-context', json={**body, 'student_id': 7}).status_code == 422
    endpoint.resolve_scope.return_value = None
    assert client.post('/learning-observation-context', json=body).json() == {'available': False, 'reason': 'unresolved-published-scope'}
