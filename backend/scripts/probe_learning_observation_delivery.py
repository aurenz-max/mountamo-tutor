"""Disposable authenticated fraction-bar observation -> scoped delivery -> Next generation.

Real Firebase auth, real service HMAC, real distiller/planner/generator, real
Firestore. Fictional evidence; no canonical submission or calibration write.
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
SCOPE = {'subject': 'MATHEMATICS', 'grade': '3', 'skill_id': 'NF001-03', 'subskill_id': 'NF001-03-b'}
SUPPORT = 'Attempt 1 on this question; 0 hint(s) viewed on this fraction before responding; support tier medium; feedback followed every earlier response in the session.'
PHASES = [
    dict(itemId='fraction-bar-1', phase='numerator', challenge='Fraction 3/4: which number is the numerator? Choices: 3, 4, 2, 5.', expected='3', observed='4', support=SUPPORT),
    dict(itemId='fraction-bar-2', phase='numerator', challenge='Fraction 4/5: which number is the numerator? Choices: 4, 5, 3, 6.', expected='4', observed='5', support=SUPPORT),
    dict(itemId='fraction-bar-3', phase='build', challenge='Fraction 2/6: shade parts of a bar divided into 6 equal parts.', expected='shaded 2 of 6 parts', observed='shaded 6 of 6 parts', support=SUPPORT),
]
EVIDENCE = dict(firstResponseScore=0, phases=PHASES,
    challengeSummary='Fraction bar (build): for each of 3 fractions the student chooses the numerator from four numbers, then the denominator from four numbers, then shades that many equal parts on a bar. A question repeats until answered correctly.',
    expected="Choose the top number as the numerator and the bottom number as the denominator, then shade as many of the bar's equal parts as the numerator.",
    observed='3/4 numerator, attempt 1: 4; 4/5 numerator, attempt 1: 5; 2/6 build, attempt 1: shaded 6 of 6 parts')


def contrast(challenges):
    offers = lambda c: all(v in c['numeratorChoices'] and v in c['denominatorChoices'] for v in (c['numerator'], c['denominator']))
    return any(a['denominator'] == b['numerator'] or a['numerator'] == b['denominator']
               for a, b in zip(challenges, challenges[1:]) if offers(a) and offers(b))


async def main():
    initialize_firebase()
    store, cosmos = FirestoreService(), CosmosDBService()
    uid = 'fb-obs-qa-' + uuid4().hex
    folder = ROOT / 'my-tutoring-app/qa/misconception/fraction-bar' / uid
    folder.mkdir(parents=True)
    report = {'synthetic': True, 'status': 'FAIL', 'tests': []}
    user_created = student_created = False
    mapping = student = None

    def post(url, body, headers):
        response = requests.post(url, json=body, headers=headers, timeout=180)
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
        mapping = await cosmos.create_student_mapping(uid, uid + '@example.invalid', 'Disposable fraction-bar QA')
        student = store.client.collection('students').document(str(mapping['student_id']))
        student.create({'qa_probe_run': uid})
        student_created = True
        report['tests'].append('Firebase user authenticated; disposable student reserved')

        context_path = '/api/student-profile/learning-observation-context'
        assert requests.post(API + context_path, json={'scope': SCOPE}, headers=headers, timeout=30).status_code == 403
        report['tests'].append('Learner token without service signature rejected (403)')

        diagnosis = post(NEXT, {'action': 'distillMisconception', 'params': {'evidence': EVIDENCE, 'score': 87, 'success': True,
            'subskillId': SCOPE['subskill_id'], 'evalMode': 'build', 'gradeLevel': '3'}}, headers)
        assert diagnosis['abstain'] is False, diagnosis
        (folder / 'diagnosis.json').write_text(json.dumps(diagnosis, indent=2), encoding='utf-8')
        packet = dict(subject='MATHEMATICS', grade='3', evalMode='build', problem=EVIDENCE['challengeSummary'], phases=PHASES,
                      teachingImplication=diagnosis['teachingImplication'] or 'n/a', checkNext=diagnosis['checkNext'] or 'n/a')
        stored = post(API + '/api/student-profile/misconceptions', dict(primitive_type='fraction-bar', scope='skill', grade='3', subject='MATHEMATICS', delivery='server',
            skill_id=SCOPE['skill_id'], subskill_id=SCOPE['subskill_id'], misconception_text=diagnosis['misconceptionText'],
            source_attempt_id=uid, confidence=diagnosis['confidence'], evidence_tier=diagnosis['evidenceTier'], learning_observation=packet), headers)
        assert stored['stored'], stored
        other_text = 'Believes the fraction with the larger denominator is the larger fraction.'
        other = post(API + '/api/student-profile/misconceptions', dict(primitive_type='fraction-bar', scope='skill', grade='3', subject='MATHEMATICS', delivery='server',
            skill_id='NF001-06', subskill_id='NF001-06-b', misconception_text=other_text, source_attempt_id=uid + '-other',
            learning_observation={**packet, 'evalMode': 'compare'}), headers)
        assert other['stored'], other
        record = student.collection('misconceptions').document('fraction-bar::NF001-03').get().to_dict()
        assert record['status'] == 'active' and record['scope_context']['grade'] == '3' and record['scope_context']['skill_id'] == 'NF001-03'
        report['tests'].append('Real distiller diagnosed a successful retry-until-correct session (score 87, firstResponseScore 0); two skill-scoped hypotheses stored with published scope stamped')

        delivered = signed(context_path, {'scope': SCOPE}, headers)
        assert delivered['available'] and [o['summary'] for o in delivered['observations']] == [diagnosis['misconceptionText']]
        assert '"observed":"4"' in delivered['observations'][0]['evidence'] and 'fraction-bar' not in delivered['observations'][0]['id']
        sibling = signed(context_path, {'scope': {**SCOPE, 'subskill_id': 'NF001-03-a'}}, headers)
        assert [o['summary'] for o in sibling['observations']] == [diagnosis['misconceptionText']]
        compare = signed(context_path, {'scope': {**SCOPE, 'skill_id': 'NF001-06', 'subskill_id': 'NF001-06-b'}}, headers)
        assert [o['summary'] for o in compare['observations']] == [other_text]
        assert signed(context_path, {'scope': {**SCOPE, 'grade': '4'}}, headers)['available'] is False
        (folder / 'delivery.json').write_text(json.dumps(dict(objective=delivered, sibling=sibling, compare=compare), indent=2), encoding='utf-8')
        report['tests'].append('Signed delivery returns only same-skill hypotheses (sibling subskill included, other skill excluded, unpublished grade refused); opaque IDs')

        params = dict(componentId='fraction-bar', instanceId=uid, topic='Build fractions a/b by shading parts of a bar', gradeLevel='Grade 3',
            config=dict(targetEvalMode='build', difficulty='medium', objectiveGrade='3', objectiveSubject='MATHEMATICS', skillId=SCOPE['skill_id'], subskillId=SCOPE['subskill_id'],
                        objectiveText='Build a fraction a/b by shading the correct number of parts in an area model.'))
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
            assert data['challengeType'] == 'build' and data['supportTier'] == 'medium' and len(challenges) == 3
            assert all(2 <= c['numerator'] < c['denominator'] <= 6 for c in challenges)
            assert len({(c['numerator'], c['denominator']) for c in challenges}) == 3
            assert diagnosis['misconceptionText'] not in text and other_text not in text and 'observation-' not in text
            assert adaptation.get('source') == 'saved-observation' and adaptation.get('move') == 'contrast_shared_digit_roles', adaptation
            draws.append(dict(draw=draw, adaptation=adaptation, fractions=[f"{c['numerator']}/{c['denominator']}" for c in challenges]))
            if adaptation['status'] == 'insufficient-capacity':
                continue
            assert adaptation['comparisonCount'] == 2 and contrast(challenges), 'metadata without a compiled contrast'
            if len([d for d in draws if d['adaptation']['status'] != 'insufficient-capacity']) == 2:
                break
        report['draws'] = draws
        assert len([d for d in draws if d['adaptation']['status'] != 'insufficient-capacity']) == 2
        identify = post(NEXT, {'action': 'generateComponentContent', 'params': {**params, 'instanceId': uid + '-identify',
            'config': {**params['config'], 'targetEvalMode': 'identify'}}}, headers)
        assert not identify['data'].get('learningAdaptation')
        report['tests'].append('Saved hypothesis drives two authenticated build draws with compiled consecutive role contrasts; identify ineligible; no private text in content')

        after = student.collection('misconceptions').document('fraction-bar::NF001-03').get().to_dict()
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
