"""Disposable authenticated number-line observation -> scoped delivery -> Next generation.

Real Firebase auth, real service HMAC, real distiller/planner/generator, real
Firestore. The evidence packet is the production builder's output saved by
my-tutoring-app/scripts/probe-number-line-applicability.mjs. Fictional learner;
no canonical submission or calibration write. Cleanup is verified.
"""
import asyncio
import hashlib
import hmac
import json
import os
import sys
import time
from pathlib import Path
from uuid import uuid4

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
load_dotenv(ROOT / 'backend/.env')
from app.core.config import settings
from app.api.endpoints.auth import initialize_firebase
from firebase_admin import auth
from app.db.firestore_service import FirestoreService
from app.db.cosmos_db import CosmosDBService

NEXT, API = 'http://127.0.0.1:3000/api/lumina', 'http://127.0.0.1:8000'
SCOPE = {'subject': 'MATHEMATICS', 'grade': '1', 'skill_id': 'OPS001-03', 'subskill_id': 'OPS001-03-a'}
BACK = {**SCOPE, 'skill_id': 'OPS001-04', 'subskill_id': 'OPS001-04-a'}
SAVED = json.loads((ROOT / 'artifacts/learning-applicability/number-line/distill-start-counted.json').read_text(encoding='utf-8'))
EVIDENCE = SAVED['evidence']
DIRECTION = json.loads((ROOT / 'artifacts/learning-applicability/number-line/distill-direction.json').read_text(encoding='utf-8'))


def compiled_contrast(challenges):
    """Two single jumps with equal hop and direction, exactly one anchored at zero."""
    rows = []
    for c in challenges:
        op = c['operations'][0]
        landing = op['startValue'] + op['changeValue'] if op['type'] == 'add' else op['startValue'] - op['changeValue']
        assert landing == c['targetValues'][0], 'answer key desync'
        rows.append((op['type'], op['changeValue'], (op['startValue'] if op['type'] == 'add' else landing) == 0))
    return any(a[:2] == b[:2] and a[2] != b[2] for i, a in enumerate(rows) for b in rows[i + 1:])


async def main():
    initialize_firebase()
    store, cosmos = FirestoreService(), CosmosDBService()
    uid = 'nl-obs-qa-' + uuid4().hex
    folder = ROOT / 'my-tutoring-app/qa/misconception/number-line' / uid
    folder.mkdir(parents=True)
    report = {'synthetic': True, 'status': 'FAIL', 'tests': []}
    user_created = student_created = False
    mapping = student = None

    def post(url, body, headers):
        response = requests.post(url, json=body, headers=headers, timeout=240)
        if not response.ok:
            raise RuntimeError(f'{url} failed: HTTP {response.status_code}')
        return response.json()

    def signed(path, body, headers):
        raw = json.dumps(body).encode()
        stamp = str(int(time.time()))
        message = (path + '\n' + stamp + '\n' + headers['Authorization'] + '\n').encode() + raw
        sig = hmac.new(os.environ['LUMINA_GENERATION_SIGNING_KEY'].encode(), message, hashlib.sha256).hexdigest()
        response = requests.post(API + path, data=raw, timeout=30, headers={**headers, 'Content-Type': 'application/json',
                                 'x-lumina-time': stamp, 'x-lumina-signature': sig})
        assert response.ok, f'signed {path}: HTTP {response.status_code} {response.text[:200]}'
        return response.json()

    try:
        auth.create_user(uid=uid, email=uid + '@example.invalid', email_verified=True)
        user_created = True
        login = requests.post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken',
            params={'key': settings.FIREBASE_WEB_API_KEY}, json={'token': auth.create_custom_token(uid).decode(), 'returnSecureToken': True}, timeout=30)
        assert login.ok, f'Firebase sign-in failed: HTTP {login.status_code}'
        headers = {'Authorization': 'Bearer ' + login.json()['idToken']}
        mapping = await cosmos.create_student_mapping(uid, uid + '@example.invalid', 'Disposable number-line QA')
        student = store.client.collection('students').document(str(mapping['student_id']))
        student.create({'qa_probe_run': uid})
        student_created = True
        report['tests'].append('Firebase user authenticated; disposable student reserved')

        context_path = '/api/student-profile/learning-observation-context'
        # Signed first, so the unsigned 403 below cannot pass merely because signing is broken.
        assert signed(context_path, {'scope': SCOPE}, headers)['available'] is False
        assert requests.post(API + context_path, json={'scope': SCOPE}, headers=headers, timeout=30).status_code == 403
        report['tests'].append('Signed request accepted (empty profile: nothing available); learner token without service signature rejected (403)')

        diagnosis = post(NEXT, {'action': 'distillMisconception', 'params': {'evidence': EVIDENCE, 'score': 100, 'success': True,
            'subskillId': SCOPE['subskill_id'], 'evalMode': 'jump', 'gradeLevel': '1'}}, headers)
        assert diagnosis['abstain'] is False, diagnosis
        (folder / 'diagnosis.json').write_text(json.dumps(diagnosis, indent=2), encoding='utf-8')

        def packet(evidence, result):
            return dict(subject='MATHEMATICS', grade='1', evalMode='jump', problem=evidence['challengeSummary'], phases=evidence['phases'],
                        teachingImplication=result['teachingImplication'] or 'n/a', checkNext=result['checkNext'] or 'n/a')
        stored = post(API + '/api/student-profile/misconceptions', dict(primitive_type='number-line', scope='skill', grade='1', subject='MATHEMATICS', delivery='server',
            skill_id=SCOPE['skill_id'], subskill_id=SCOPE['subskill_id'], misconception_text=diagnosis['misconceptionText'],
            source_attempt_id=uid, confidence=diagnosis['confidence'], evidence_tier=diagnosis['evidenceTier'],
            learning_observation=packet(EVIDENCE, diagnosis)), headers)
        assert stored['stored'], stored
        other_text = DIRECTION['result']['misconceptionText']
        other = post(API + '/api/student-profile/misconceptions', dict(primitive_type='number-line', scope='skill', grade='1', subject='MATHEMATICS', delivery='server',
            skill_id=BACK['skill_id'], subskill_id=BACK['subskill_id'], misconception_text=other_text, source_attempt_id=uid + '-back',
            learning_observation=packet(DIRECTION['evidence'], DIRECTION['result'])), headers)
        assert other['stored'], other
        record = student.collection('misconceptions').document('number-line::OPS001-03').get().to_dict()
        assert record['status'] == 'active' and record['scope_context']['grade'] == '1' and record['scope_context']['skill_id'] == 'OPS001-03'
        report['tests'].append('Real distiller diagnosed a solved session from first responses (score 100, firstResponseScore 0); count-on and count-back hypotheses stored with published scope stamped')

        delivered = signed(context_path, {'scope': SCOPE}, headers)
        assert delivered['available'] and [o['summary'] for o in delivered['observations']] == [diagnosis['misconceptionText']]
        assert 'landing placed at 10' in delivered['observations'][0]['evidence'] and 'number-line' not in delivered['observations'][0]['id']
        back = signed(context_path, {'scope': BACK}, headers)
        assert [o['summary'] for o in back['observations']] == [other_text]
        assert signed(context_path, {'scope': {**SCOPE, 'grade': '2'}}, headers)['available'] is False
        (folder / 'delivery.json').write_text(json.dumps(dict(count_on=delivered, count_back=back), indent=2), encoding='utf-8')
        report['tests'].append('Signed delivery returns only the same-skill hypothesis (count-on and count-back kept apart; grade 2 refused); opaque IDs')

        params = dict(componentId='number-line', instanceId=uid, topic='Add within 20 by counting on', gradeLevel='Grade 1',
            config=dict(targetEvalMode='jump', difficulty='medium', objectiveGrade='1', objectiveSubject='MATHEMATICS', skillId=SCOPE['skill_id'], subskillId=SCOPE['subskill_id'],
                        intent='Count on to add on a number line',
                        objectiveText='Add two numbers within 20 by counting on from the larger addend on a number line.'))
        baseline = post(NEXT, {'action': 'generateComponentContent', 'params': params}, {})
        assert not baseline['data'].get('learningAdaptation')
        (folder / 'baseline.json').write_text(json.dumps(baseline, indent=2), encoding='utf-8')
        forged = post(NEXT, {'action': 'generateComponentContent', 'params': {**params, 'config': {**params['config'],
            'learningObservations': [{'id': 'forged', 'summary': diagnosis['misconceptionText']}]}}}, {})
        assert not forged['data'].get('learningAdaptation'), 'client-supplied observations reached the planner'
        report['tests'].append('Unauthenticated baseline unadapted; client-supplied learningObservations ignored')

        draws = []
        for draw in range(4):
            generated = post(NEXT, {'action': 'generateComponentContent', 'params': {**params, 'instanceId': f'{uid}-{draw}'}}, headers)
            (folder / f'targeted-{draw}.json').write_text(json.dumps(generated, indent=2), encoding='utf-8')
            data, text = generated['data'], json.dumps(generated)
            adaptation = data.get('learningAdaptation') or {}
            challenges = data['challenges']
            assert data['supportTier'] == 'medium' and len(challenges) == 4
            assert all(c['type'] == 'show_jump' and len(c['operations']) == 1 and not c['operations'][0]['showJumpArc']
                       and 1 <= c['operations'][0]['changeValue'] <= 5 and data['range']['min'] <= c['targetValues'][0] <= data['range']['max']
                       for c in challenges)
            assert diagnosis['misconceptionText'] not in text and other_text not in text and 'observation-' not in text
            assert adaptation.get('source') == 'saved-observation' and adaptation.get('move') == 'contrast_start_positions', adaptation
            draws.append(dict(draw=draw, adaptation=adaptation, range=data['range'],
                              jumps=[f"{c['operations'][0]['startValue']}{'+' if c['operations'][0]['type'] == 'add' else '-'}{c['operations'][0]['changeValue']}={c['targetValues'][0]}" for c in challenges],
                              instructions=[c['instruction'] for c in challenges]))
            if adaptation['status'] == 'insufficient-capacity':
                continue
            assert adaptation['comparisonCount'] == 2 and compiled_contrast(challenges), 'metadata without a compiled contrast'
            if len([d for d in draws if d['adaptation']['status'] != 'insufficient-capacity']) == 2:
                break
        report['draws'] = draws
        assert len([d for d in draws if d['adaptation']['status'] != 'insufficient-capacity']) == 2
        hard = post(NEXT, {'action': 'generateComponentContent', 'params': {**params, 'instanceId': uid + '-hard',
            'config': {**params['config'], 'difficulty': 'hard'}}}, headers)
        assert not hard['data'].get('learningAdaptation')
        report['tests'].append('Saved hypothesis drives two authenticated jump draws with compiled zero-anchored contrasts; hard tier ineligible; no private text in content')

        after = student.collection('misconceptions').document('number-line::OPS001-03').get().to_dict()
        assert after['status'] == 'active' and after['last_detected_at'] == record['last_detected_at']
        assert {c.id for c in student.collections()} == {'misconceptions'}
        report['tests'].append('Delivery and generation wrote nothing; hypothesis unchanged; no receipt or resolution')
        report['status'] = 'PASS'
    finally:
        if student_created and student.get().exists:
            assert student.get().to_dict().get('qa_probe_run') == uid, 'Cleanup owner changed'
            for collection in student.collections():
                assert collection.id in ('misconceptions', 'learning_observations'), f'Unexpected learner writes: {collection.id}'
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
        (folder / 'authenticated-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    print('Report:', str(folder.relative_to(ROOT)))


if __name__ == '__main__':
    asyncio.run(main())
