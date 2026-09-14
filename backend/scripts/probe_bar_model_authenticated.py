"""Disposable authenticated bar-model picture_graph loop: evidence -> real distiller ->
authenticated store -> signed delivery -> real Next generation. Cleanup verified.

Synthetic, fictional evidence. No canonical submission: nothing touches attempts,
competencies or item calibration. No microphone, browser or resolution claim.
"""
import asyncio
import hashlib
import hmac
import json
import os
import time
from pathlib import Path
import sys
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

SCOPE = {'subject': 'MATHEMATICS', 'grade': '3', 'skill_id': 'MEAS003-04', 'subskill_id': 'MEAS003-04-a'}
GRAPHS = [  # (row label, icons, selections in order); key = 5 per icon
    ('Apples', 5, [5, 25]), ('Pears', 3, [3, 15]), ('Plums', 4, [20]), ('Kiwis', 6, [6, 30]),
]


def evidence():
    phases = [{'itemId': f'bm-{i + 1}', 'phase': 'picture_graph',
               'challenge': f'How many students chose {label}? Each 🍎 stands for 5. Key: each 🍎 stands for 5. '
                            f'Row "{label}" shows {icons} icons. Choices: {icons}, {icons * 5 - 5}, {icons * 5}, {icons * 5 + 5}.',
               'expected': str(icons * 5), 'observed': 'Selections in order: ' + ', '.join(map(str, sel)),
               'support': 'The named row was highlighted. After an incorrect choice the hint was shown and the learner could choose again.'}
              for i, (label, icons, sel) in enumerate(GRAPHS) if sel[0] != icons * 5]
    return {'phases': phases, 'firstResponseScore': 25,
            'challengeSummary': 'Picture graph reading: 4 graphs, each asking for the total of one named row given a key where one icon stands for more than one item. 1 of 4 were answered correctly on the first choice.',
            'expected': phases[0]['challenge'] + ' Correct total: 25.', 'observed': phases[0]['observed'],
            'priorAttempts': [{'challenge': p['challenge'], 'observed': p['observed']} for p in phases[1:]]}


def contrast(data):
    """Independent recompile: one targeted row's icon count equals another's total, bare counts offered."""
    items = []
    for i, c in enumerate(data['challenges']):
        iv, row = c['scale']['iconValue'], c['values'][c['targetBarIndex']]
        assert c['evalMode'] == 'picture_graph' and iv == 5 and row['value'] == c['expectedValue'] and row['value'] % iv == 0
        assert c['expectedValue'] in c['options'] and row['value'] // iv in c['options'] and c['supportTier'] == 'medium'
        items.append((i, row['value'] // iv, c['expectedValue']))
    return next(([a[0], b[0]] for a in items for b in items if a[0] != b[0] and a[1] == b[2] and a[2] != b[2]), None)


async def main():
    initialize_firebase()
    store, cosmos = FirestoreService(), CosmosDBService()
    uid = 'bm-http-qa-' + uuid4().hex
    folder = ROOT / 'my-tutoring-app/qa/misconception/bar-model' / uid
    folder.mkdir(parents=True)
    report = {'synthetic': True, 'status': 'FAIL', 'tests': [], 'boundary':
              'Fictional evidence through the real distiller, authenticated store, signed delivery and Next generation. '
              'No microphone, browser, canonical submission or resolution.'}
    user_created, student_created, mapping, student = False, False, None, None

    def post(url, body, headers, attempts=3):
        for attempt in range(attempts):  # uvicorn --reload restarts when another session saves backend code
            try:
                response = requests.post(url, json=body, headers=headers, timeout=180)
                if response.ok:
                    return response.json()
                raise RuntimeError(f'API request failed: HTTP {response.status_code}')
            except requests.ConnectionError:
                if attempt == attempts - 1:
                    raise
    try:
        auth.create_user(uid=uid, email=uid + '@example.invalid', email_verified=True)
        user_created = True
        login = requests.post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken',
                              params={'key': settings.FIREBASE_WEB_API_KEY},
                              json={'token': auth.create_custom_token(uid).decode(), 'returnSecureToken': True}, timeout=30)
        assert login.ok, f'Firebase sign-in failed: HTTP {login.status_code}'
        headers = {'Authorization': 'Bearer ' + login.json()['idToken']}
        mapping = await cosmos.create_student_mapping(uid, uid + '@example.invalid', 'Disposable bar-model QA')
        student = store.client.collection('students').document(str(mapping['student_id']))
        student.create({'qa_probe_run': uid})
        student_created = True
        report['tests'].append('Disposable Firebase user and student reserved')

        packet = evidence()
        diagnosis = post('http://127.0.0.1:3000/api/lumina', {'action': 'distillMisconception', 'params': {
            'evidence': packet, 'score': 90, 'success': True, 'gradeLevel': '3', 'evalMode': 'picture_graph',
            'subskillId': SCOPE['subskill_id']}}, {})
        (folder / 'diagnosis.json').write_text(json.dumps({'evidence': packet, 'diagnosis': diagnosis}, indent=2, ensure_ascii=False), encoding='utf-8')
        assert not diagnosis.get('abstain'), f"Distiller abstained: {diagnosis.get('reason')}"
        report['tests'].append('Real distiller produced a hypothesis from first-choice evidence on a success=true, score=90 activity')

        stored = post('http://localhost:8000/api/student-profile/misconceptions', {
            'primitive_type': 'bar-model', 'scope': 'skill', 'grade': '3', 'subject': 'MATHEMATICS', 'delivery': 'server', 'skill_id': SCOPE['skill_id'],
            'subskill_id': SCOPE['subskill_id'], 'misconception_text': diagnosis['misconceptionText'],
            'source_attempt_id': uid, 'confidence': diagnosis['confidence'], 'evidence_tier': diagnosis['evidenceTier'],
            'learning_observation': {'subject': 'MATHEMATICS', 'grade': '3', 'evalMode': 'picture_graph',
                                     'problem': packet['challengeSummary'],
                                     'phases': packet['phases'], 'teachingImplication': diagnosis.get('teachingImplication') or 'n/a',
                                     'checkNext': diagnosis.get('checkNext') or 'n/a'}}, headers)
        assert stored.get('stored'), f'Capture not stored: {stored}'
        record = student.collection('misconceptions').document('bar-model::MEAS003-04').get().to_dict()
        assert record['scope_context']['grade'] == '3' and record['scope_context']['subskill_id'] == 'MEAS003-04-a'
        report['tests'].append('Authenticated capture stored an active skill-scoped hypothesis with a resolved published scope')

        unsigned = requests.post('http://localhost:8000/api/student-profile/learning-observation-context', json={'scope': SCOPE},
                                 headers={**headers, 'x-lumina-time': str(int(time.time())), 'x-lumina-signature': '0' * 64}, timeout=30)
        assert unsigned.status_code == 403, f'Unsigned learner token reached delivery: HTTP {unsigned.status_code}'
        # "unavailable" means the server has no key, so the rejection would prove nothing about signatures.
        assert 'Invalid generation certification' in unsigned.text, f'Backend has no signing key: {unsigned.text[:120]}'
        report['tests'].append('Learner token without a valid generation-server signature rejected (403, invalid signature)')

        # Station check with the real service signature: does delivery return the stored observation?
        path, stamp = '/api/student-profile/learning-observation-context', str(int(time.time()))
        body = json.dumps({'scope': SCOPE}).encode()
        signature = hmac.new(os.environ['LUMINA_GENERATION_SIGNING_KEY'].encode(),
                             (path + '\n' + stamp + '\n' + headers['Authorization'] + '\n').encode() + body, hashlib.sha256).hexdigest()
        signed = requests.post('http://localhost:8000' + path, data=body, timeout=30, headers={**headers,
                               'Content-Type': 'application/json', 'x-lumina-time': stamp, 'x-lumina-signature': signature})
        delivered = signed.json() if signed.ok else {'http': signed.status_code, 'detail': signed.text[:200]}
        (folder / 'delivery.json').write_text(json.dumps(delivered, indent=2, ensure_ascii=False), encoding='utf-8')
        assert delivered.get('available') and len(delivered['observations']) == 1, f'Delivery: {delivered}'
        assert uid not in json.dumps(delivered), 'Delivery exposed the source attempt reference'
        report['tests'].append('Signed delivery returned exactly the stored observation (with evidence, without attempt IDs)')

        params = dict(componentId='bar-model', topic='Picture graphs of favorite fruits in our class', gradeLevel='Grade 3',
                      config=dict(targetEvalMode='picture_graph', difficulty='medium', objectiveGrade='3', objectiveSubject='MATHEMATICS',
                                  skillId=SCOPE['skill_id'], subskillId=SCOPE['subskill_id'],
                                  objectiveText='Read scaled picture graphs where one symbol stands for more than one item'))
        baseline = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent',
                                                              'params': {**params, 'instanceId': uid + '-baseline'}}, {})
        (folder / 'baseline.json').write_text(json.dumps(baseline, indent=2, ensure_ascii=False), encoding='utf-8')
        assert not baseline['data'].get('learningAdaptation')
        report['tests'].append('Unauthenticated generation of the same task is unadapted')

        ineligible = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent', 'params': {
            **params, 'instanceId': uid + '-hard', 'config': {**params['config'], 'difficulty': 'hard'}}}, headers)
        (folder / 'ineligible-hard.json').write_text(json.dumps(ineligible, indent=2, ensure_ascii=False), encoding='utf-8')
        assert not ineligible['data'].get('learningAdaptation')
        report['tests'].append('Authenticated hard-tier generation is unadapted (task gate)')

        draws = []
        for draw in range(2):
            generated = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent',
                                                                   'params': {**params, 'instanceId': f'{uid}-{draw}'}}, headers)
            (folder / f'targeted-{draw}.json').write_text(json.dumps(generated, indent=2, ensure_ascii=False), encoding='utf-8')
            data, text = generated['data'], json.dumps(generated, ensure_ascii=False)
            adaptation = data.get('learningAdaptation') or {}
            assert adaptation.get('source') == 'saved-observation', f'No saved-observation adaptation: {adaptation}'
            assert adaptation.get('move') == 'contrast_icon_count_and_row_value' and adaptation.get('comparisonCount') == 2, adaptation
            pair = contrast(data)
            assert pair and len(data['challenges']) == 4
            assert diagnosis['misconceptionText'] not in text and 'learningObservations' not in text and 'remediationFocus' not in text
            draws.append({'draw': draw, 'adaptation': adaptation, 'pair': pair,
                          'expected': [c['expectedValue'] for c in data['challenges']]})
        report['draws'] = draws
        report['tests'].append('Two authenticated draws consumed the saved observation: compiled icon-count/total contrast, '
                               'bare counts offered, medium tier held, no private text in output')
        still = student.collection('misconceptions').document('bar-model::MEAS003-04').get().to_dict()
        assert still['status'] == 'active' and not list(student.collection('misconception_opportunities').limit(1).stream())
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
        (folder / 'authenticated-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print('Report:', str(folder.relative_to(ROOT)))


if __name__ == '__main__':
    asyncio.run(main())
