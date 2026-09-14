"""Delivery packet: what the backend signs at lesson launch, and nothing else.

Owner filtering, record-property gates and lineage resolution happen here; per-task
selection, evidence bounds and the delivered shape are the generation server's
(learningObservationPacket.test.ts). Signature parity with the TypeScript verifier is
pinned by the reference HMAC below and exercised by the replay harness.
"""
import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.endpoints import student_profile as endpoint
from app.core import generation_auth
from app.core.middleware import get_user_context
from app.dependencies import get_competency_service, get_curriculum_mapping_service
from app.services.learning_observations import MAX_PACKET_HYPOTHESES, delivery_packet

SCOPE = dict(subject='MATHEMATICS', grade='3', skill_id='NF001-03', subskill_id='NF001-03-b', curriculum_version='v@1')
PACKET = dict(subject='MATHEMATICS', grade='3', evalMode='build', problem='Fraction bar build', teachingImplication='t', checkNext='c',
              phases=[dict(itemId='fraction-bar-1', phase='numerator', challenge='3/4 numerator?', expected='3', observed='4', support='Attempt 1')])
KEY = 'synthetic-test-secret-never-for-production'


def record(**patch):
    base = dict(primitive_type='fraction-bar', status='active', scope='skill', misconception_text='Swaps numerator and denominator roles.',
                scope_context={**SCOPE, 'subskill_id': 'NF001-03-a', 'curriculum_version': 'older@0'},
                hypothesis_id='h1', revision=2, last_detected_at='2026-09-13T08:00', learning_observation=PACKET,
                source_attempt_id='attempt-secret')
    return {**base, **patch}


def store(lineage=None):
    lineage = lineage or {}
    return SimpleNamespace(_resolver=SimpleNamespace(resolve=AsyncMock(side_effect=lambda value: lineage.get(value, value))))


def test_packet_carries_only_deliverable_records_with_resolved_skill_and_no_attempt_keys():
    records = {
        'fraction-bar::NF001-03': record(),
        'place-value-chart::NBT004-01': record(primitive_type='place-value-chart', scope_context={**SCOPE, 'grade': '4'}, last_detected_at='2026-09-14T08:00'),
        'client-delivered': record(primitive_type='picture-vocabulary', scope_context=None),  # legacy loop: no stamped scope
        'resolved': record(status='resolved'),
        'primitive-scoped': record(scope='primitive'),
        'unstamped': record(scope_context=None),
        'blank': record(misconception_text='  '),
        'renamed': record(scope_context={**SCOPE, 'skill_id': 'OLD-03'}, hypothesis_id='h9', last_detected_at='2026-09-01T08:00'),
    }
    scopes = [{'subskillId': 'NF001-03-b', 'skillId': 'NF001-03', 'published': SCOPE}]
    packet = asyncio.run(delivery_packet(store({'OLD-03': 'NF001-03'}), records, scopes, 42, datetime(2026, 9, 14, 12, tzinfo=timezone.utc)))
    assert packet['v'] == 1 and packet['studentId'] == '42' and packet['scopes'] == scopes
    assert packet['issuedAt'] == '2026-09-14T12:00:00+00:00' and packet['expiresAt'] == '2026-09-14T14:00:00+00:00'
    assert [h['primitiveType'] for h in packet['hypotheses']] == ['place-value-chart', 'fraction-bar', 'fraction-bar']
    fraction = packet['hypotheses'][1]
    assert fraction == {'hypothesisId': 'h1', 'revision': 2, 'primitiveType': 'fraction-bar', 'summary': 'Swaps numerator and denominator roles.',
                        'scope': {**SCOPE, 'subskill_id': 'NF001-03-a', 'curriculum_version': 'older@0'}, 'skillId': 'NF001-03',
                        'lastDetectedAt': '2026-09-13T08:00', 'evidence': {'problem': 'Fraction bar build', 'evalMode': 'build',
                        'phases': [dict(phase='numerator', challenge='3/4 numerator?', expected='3', observed='4', support='Attempt 1')]}}
    assert packet['hypotheses'][2]['skillId'] == 'NF001-03' and packet['hypotheses'][2]['scope']['skill_id'] == 'OLD-03'
    text = json.dumps(packet)
    assert 'attempt-secret' not in text and 'fraction-bar-1' not in text and 'resolved' not in text


def test_packet_is_bounded_and_tolerates_records_without_identity():
    records = {f'r{i}': record(hypothesis_id=None, revision=None, created_at=f'2026-08-{i % 28 + 1:02d}', last_detected_at=f'2026-09-{i % 28 + 1:02d}')
               for i in range(MAX_PACKET_HYPOTHESES + 5)}
    packet = asyncio.run(delivery_packet(store(), records, [], 1))
    assert len(packet['hypotheses']) == MAX_PACKET_HYPOTHESES
    assert all(h['hypothesisId'].startswith('2026-08-') and 'revision' not in h for h in packet['hypotheses'])
    assert [h['lastDetectedAt'] for h in packet['hypotheses']] == sorted((h['lastDetectedAt'] for h in packet['hypotheses']), reverse=True)


def test_signature_is_hmac_over_prefixed_payload_and_absent_without_a_key(monkeypatch):
    monkeypatch.delenv('LUMINA_GENERATION_SIGNING_KEY', raising=False)
    monkeypatch.setattr(generation_auth.settings, 'LUMINA_GENERATION_SIGNING_KEY', '')
    assert generation_auth.sign_learning_observations('{"v":1}') is None
    monkeypatch.setattr(generation_auth.settings, 'LUMINA_GENERATION_SIGNING_KEY', 'too-short')
    assert generation_auth.sign_learning_observations('{"v":1}') is None
    monkeypatch.setenv('LUMINA_GENERATION_SIGNING_KEY', KEY)
    payload = '{"v":1,"hypotheses":[{"summary":"café"}]}'
    expected = hmac.new(KEY.encode(), ('lumina-learning-observations:v1\n' + payload).encode('utf-8'), hashlib.sha256).hexdigest()
    assert generation_auth.sign_learning_observations(payload) == expected
    assert generation_auth.sign_learning_observations(payload + ' ') != expected


def _generation_context_app(monkeypatch, fake):
    monkeypatch.setattr(endpoint, 'get_firestore_service', lambda: fake)
    monkeypatch.setattr(endpoint, 'resolve_scope', AsyncMock(side_effect=lambda _store, requested: (
        SCOPE if requested.get('subskill_id') == 'NF001-03-b' and requested.get('grade') == '3' else None)))
    app = FastAPI(); app.include_router(endpoint.router)
    app.dependency_overrides[get_user_context] = lambda: {'student_id': 42, 'firebase_uid': 'owner'}
    app.dependency_overrides[get_competency_service] = lambda: SimpleNamespace(get_competency=AsyncMock(return_value=None))
    app.dependency_overrides[get_curriculum_mapping_service] = lambda: SimpleNamespace(retrieval_matcher=SimpleNamespace(match=AsyncMock(return_value=None)))
    return TestClient(app)


def test_generation_context_issues_one_signed_packet_per_lesson_and_keeps_private_prose_off_the_client(monkeypatch):
    monkeypatch.setenv('LUMINA_GENERATION_SIGNING_KEY', KEY)
    fake = store()
    fake.get_active_misconceptions = AsyncMock(return_value={'fraction-bar::NF001-03': record(),
                                                             'tape-diagram': record(primitive_type='tape-diagram', scope='primitive', scope_context=None)})
    fake.get_mastery_lifecycles_batch = AsyncMock(return_value={})
    fake.get_student_ability = AsyncMock(return_value=None)
    client = _generation_context_app(monkeypatch, fake)
    body = {'student_id': 42, 'topic': 'Fractions', 'grade_level': 'Grade 3', 'subject': 'Mathematics', 'include_persona': False,
            'objectives': [{'id': 'o1', 'text': 'Build a fraction', 'subskill_id': 'NF001-03-b', 'skill_id': 'NF001-03', 'grade': '3'},
                           {'id': 'o2', 'text': 'Same objective again', 'subskill_id': 'NF001-03-b', 'skill_id': 'NF001-03', 'grade': '3'},
                           {'id': 'o3', 'text': 'Unpublished', 'subskill_id': 'ZZ999-01-a', 'skill_id': 'ZZ999-01'}]}
    response = client.post('/generation-context', json=body).json()
    student, subskills = fake.get_active_misconceptions.await_args.args
    assert student == 42 and sorted(subskills) == ['NF001-03-b', 'ZZ999-01-a']
    signed = response['learningObservations']
    assert set(signed) == {'payload', 'signature'} and len(signed['signature']) == 64
    assert signed['signature'] == hmac.new(KEY.encode(), ('lumina-learning-observations:v1\n' + signed['payload']).encode('utf-8'), hashlib.sha256).hexdigest()
    packet = json.loads(signed['payload'])
    assert packet['studentId'] == '42'
    assert packet['scopes'] == [{'subskillId': 'NF001-03-b', 'skillId': 'NF001-03', 'published': SCOPE},
                                {'subskillId': 'ZZ999-01-a', 'skillId': 'ZZ999-01', 'published': None}]
    assert [h['primitiveType'] for h in packet['hypotheses']] == ['fraction-bar']
    # The legacy client loop still sees its own prose; the server-delivered hypothesis stays blank there.
    by_type = {m['primitiveType']: m['text'] for m in response['activeMisconceptions']}
    assert by_type == {'fraction-bar': '', 'tape-diagram': 'Swaps numerator and denominator roles.'}
    assert client.post('/generation-context', json={**body, 'objectives': []}).json()['learningObservations'] is None
    monkeypatch.delenv('LUMINA_GENERATION_SIGNING_KEY')
    monkeypatch.setattr(generation_auth.settings, 'LUMINA_GENERATION_SIGNING_KEY', '')
    unsigned = client.post('/generation-context', json=body).json()
    assert unsigned['available'] is True and unsigned['learningObservations'] is None


def test_removed_signed_read_routes_are_gone():
    paths = {route.path for route in endpoint.router.routes}
    assert '/learning-observation-context' not in paths and '/misconception-opportunity-context' not in paths
    assert '/misconception-opportunities' in paths
