"""Generic authenticated smoke for the shared learning-observation path. One script for every consumer:
disposable Firebase user -> authenticated capture -> generation-context issues the signed delivery
packet -> real Next generation reads the packet (no backend call) -> verified cleanup.

    python scripts/misconception_authenticated_smoke.py --case <case.json> [--draws N]

case.json is the replay case (my-tutoring-app/scripts/misconception-harness/replay-delivery.mjs): item,
topic, gradeLevel and packet; the capture body is derived from packet.hypotheses[0] and packet.scopes[0].
Run it when the shared capture, store, packet or delivery code changes (learning_observations.py,
generation_auth.py, the generation-context endpoint, learningObservationPacket.ts, generationRequest.ts,
learningObservationServer.ts, captureMisconception.ts) or before a release. Not part of a per-primitive
slice: the per-primitive facts on this path are covered by the replay tier without a login.

Synthetic, fictional evidence. No canonical submission: nothing touches attempts, competencies or item
calibration. No microphone, browser or resolution claim.
"""
import asyncio
import hashlib
import hmac
import json
import os
import sys
from pathlib import Path
from uuid import uuid4

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
load_dotenv(ROOT / 'backend/.env')
from app.core.config import settings
from app.core.generation_auth import PACKET_SIGNATURE_PREFIX
from app.api.endpoints.auth import initialize_firebase
from firebase_admin import auth
from app.db.firestore_service import FirestoreService
from app.db.cosmos_db import CosmosDBService
from app.services.learning_observations import hypothesis_key

# LUMINA_SMOKE_BACKEND lets the smoke target a backend started from this checkout (e.g. :8001) when :8000 is stale.
BACKEND = os.environ.get('LUMINA_SMOKE_BACKEND', 'http://localhost:8000')
NEXT = 'http://127.0.0.1:3000/api/lumina'


def post(url, body, headers, attempts=3):
    for attempt in range(attempts):  # uvicorn --reload restarts when another session saves backend code
        try:
            response = requests.post(url, json=body, headers=headers, timeout=240)
            if response.ok:
                return response.json()
            raise RuntimeError(f'API request failed: HTTP {response.status_code} {response.text[:200]}')
        except requests.ConnectionError:
            if attempt == attempts - 1:
                raise


async def main():
    case = json.loads(Path(sys.argv[sys.argv.index('--case') + 1]).read_text(encoding='utf-8'))
    draws = int(sys.argv[sys.argv.index('--draws') + 1]) if '--draws' in sys.argv else 2
    hypothesis, scope_entry = case['packet']['hypotheses'][0], case['packet']['scopes'][0]
    published = scope_entry['published']
    primitive = hypothesis['primitiveType']
    key = os.environ.get('LUMINA_GENERATION_SIGNING_KEY') or settings.LUMINA_GENERATION_SIGNING_KEY
    assert len(key) >= 32, 'LUMINA_GENERATION_SIGNING_KEY is not configured for this backend'
    initialize_firebase()
    store, cosmos = FirestoreService(), CosmosDBService()
    uid = 'obs-smoke-' + uuid4().hex
    folder = ROOT / 'my-tutoring-app/qa/misconception/smoke' / uid
    folder.mkdir(parents=True)
    report = {'synthetic': True, 'status': 'FAIL', 'primitive': primitive, 'tests': [], 'boundary':
              'Fictional evidence through authenticated capture, the signed launch packet and real Next generation. '
              'No microphone, browser, canonical submission or resolution.'}
    user_created = student_created = False
    mapping = student = None
    try:
        auth.create_user(uid=uid, email=uid + '@example.invalid', email_verified=True)
        user_created = True
        login = requests.post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken',
                              params={'key': settings.FIREBASE_WEB_API_KEY},
                              json={'token': auth.create_custom_token(uid).decode(), 'returnSecureToken': True}, timeout=30)
        assert login.ok, f'Firebase sign-in failed: HTTP {login.status_code}'
        headers = {'Authorization': 'Bearer ' + login.json()['idToken']}
        mapping = await cosmos.create_student_mapping(uid, uid + '@example.invalid', 'Disposable observation smoke')
        student = store.client.collection('students').document(str(mapping['student_id']))
        student.create({'qa_probe_run': uid})
        student_created = True
        report['tests'].append('Disposable Firebase user and student reserved')

        evidence = hypothesis.get('evidence') or {'problem': 'n/a', 'evalMode': 'n/a', 'phases': []}
        stored = post(f'{BACKEND}/api/student-profile/misconceptions', {
            'primitive_type': primitive, 'scope': 'skill', 'delivery': 'server', 'grade': published['grade'], 'subject': published['subject'],
            'skill_id': published['skill_id'], 'subskill_id': published['subskill_id'], 'misconception_text': hypothesis['summary'],
            'source_attempt_id': uid, 'confidence': 'high', 'evidence_tier': 'structured',
            'learning_observation': {'subject': published['subject'], 'grade': published['grade'], 'evalMode': evidence['evalMode'] or 'n/a',
                                     'problem': evidence['problem'] or 'n/a',
                                     'phases': [{'itemId': f'item-{i}', **p} for i, p in enumerate(evidence['phases'][:12])],
                                     'teachingImplication': 'n/a', 'checkNext': 'n/a'}}, headers)
        assert stored.get('stored'), f'Capture not stored: {stored}'
        record = student.collection('misconceptions').document(hypothesis_key(primitive, published['skill_id'])).get().to_dict()
        assert record['scope_context']['subskill_id'] == published['subskill_id'] and record['scope_context'].get('curriculum_version'), record.get('scope_context')
        report['tests'].append('Authenticated capture stored an active skill-scoped hypothesis with a resolved published scope')

        config = case['item']['config']
        context = post(f'{BACKEND}/api/student-profile/generation-context', {
            'student_id': mapping['student_id'], 'topic': case['topic'], 'grade_level': case['gradeLevel'], 'subject': published['subject'],
            'include_persona': False, 'objectives': [{'id': 'smoke-objective', 'text': config['objectiveText'], 'verb': 'apply',
                                                       'subskill_id': published['subskill_id'], 'skill_id': published['skill_id'], 'grade': published['grade']}]}, headers)
        (folder / 'generation-context.json').write_text(json.dumps(context, indent=2, ensure_ascii=False), encoding='utf-8')
        signed = context.get('learningObservations')
        assert signed and signed.get('payload') and signed.get('signature'), f'No signed packet in the generation context: {context}'
        expected = hmac.new(key.encode(), (PACKET_SIGNATURE_PREFIX + signed['payload']).encode('utf-8'), hashlib.sha256).hexdigest()
        assert hmac.compare_digest(expected, signed['signature']), 'Packet signature does not verify under the configured key'
        packet = json.loads(signed['payload'])
        assert packet['studentId'] == str(mapping['student_id'])
        [entry] = [s for s in packet['scopes'] if s['subskillId'] == published['subskill_id']]
        assert entry['published'] and entry['published']['skill_id'] == published['skill_id'] and entry['published'].get('curriculum_version'), entry
        [own] = [h for h in packet['hypotheses'] if h['primitiveType'] == primitive]
        assert own['summary'] == hypothesis['summary'] and own['scope'] == record['scope_context'] and own['hypothesisId'] == record.get('hypothesis_id')
        assert uid not in signed['payload'], 'Packet exposed the source attempt reference'
        for m in context['activeMisconceptions']:
            assert m['text'] == '', 'Server-delivered prose reached the legacy client inventory'
        report['tests'].append('generation-context issued one signed packet: verified signature, live published scope with version, '
                               'the stored hypothesis with its stamped scope, no attempt reference; legacy inventory prose blank')

        params = dict(componentId=primitive, topic=case['topic'], gradeLevel=case['gradeLevel'], config=config)
        baseline = post(NEXT, {'action': 'generateComponentContent', 'params': {**params, 'instanceId': uid + '-baseline'}}, {})
        (folder / 'baseline.json').write_text(json.dumps(baseline, indent=2, ensure_ascii=False), encoding='utf-8')
        assert not baseline['data'].get('learningAdaptation')
        report['tests'].append('Generation without a packet is unadapted')

        forged = post(NEXT, {'action': 'generateComponentContent', 'params': {**params, 'instanceId': uid + '-forged', 'config': {
            **config, 'learningObservations': [{'id': 'forged', 'summary': hypothesis['summary']}], 'remediationFocus': hypothesis['summary']}}}, headers)
        assert not forged['data'].get('learningAdaptation'), 'Client-supplied observations or focus reached the planner'
        tampered = post(NEXT, {'action': 'generateComponentContent', 'params': {**params, 'instanceId': uid + '-tampered'},
                               'learningObservations': {**signed, 'payload': signed['payload'].replace('"summary":"', '"summary":"TAMPERED ', 1)}}, headers)
        assert not tampered['data'].get('learningAdaptation'), 'An edited packet was accepted'
        report['tests'].append('Client-forged config observations and an edited packet are both unadapted')

        adapted = []
        for draw in range(draws):
            generated = post(NEXT, {'action': 'generateComponentContent', 'params': {**params, 'instanceId': f'{uid}-{draw}'},
                                    'learningObservations': signed}, headers)
            (folder / f'targeted-{draw}.json').write_text(json.dumps(generated, indent=2, ensure_ascii=False), encoding='utf-8')
            data, text = generated['data'], json.dumps(generated, ensure_ascii=False)
            adaptation = data.get('learningAdaptation') or {}
            assert adaptation.get('source') == 'saved-observation', f'No saved-observation adaptation: {adaptation}'
            assert hypothesis['summary'] not in text and 'learningObservations' not in text and 'remediationFocus' not in text
            adapted.append({'draw': draw, 'adaptation': adaptation})
        report['draws'] = adapted
        report['tests'].append(f'{draws} authenticated draws consumed the packet (source saved-observation), no private text in output')
        still = student.collection('misconceptions').document(hypothesis_key(primitive, published['skill_id'])).get().to_dict()
        assert still['status'] == 'active'
        if not case['item'].get('retest'):
            assert not list(student.collection('misconception_opportunities').limit(1).stream())
            report['tests'].append('Hypothesis still active; no receipt issued (exposure only)')
        report['status'] = 'PASS'
    finally:
        if student_created and student.get().exists:
            assert student.get().to_dict().get('qa_probe_run') == uid, 'Cleanup owner changed'
            for collection in student.collections():
                assert collection.id in ('misconceptions', 'misconception_opportunities', 'learning_observations'), \
                    f'Unexpected learner writes in {collection.id}; cleanup requires inspection'
                for snapshot in collection.stream():
                    snapshot.reference.delete()
            student.delete()
            assert not student.get().exists and not list(student.collections())
        if mapping:
            cosmos.student_mappings.delete_item(item=mapping['id'], partition_key=uid)
            assert await cosmos.get_student_mapping(uid) is None
        if user_created:
            auth.delete_user(uid)
            try:
                auth.get_user(uid)
                raise AssertionError('Firebase cleanup failed')
            except auth.UserNotFoundError:
                pass
        report['cleanup'] = 'verified absent'
        (folder / 'smoke-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print('Report:', str(folder.relative_to(ROOT)))


if __name__ == '__main__':
    asyncio.run(main())
