"""Disposable authenticated fraction-circles observation -> signed delivery -> Next generation.

Real Firebase authentication, backend store and Next generation; fictional evidence.
No canonical submission: synthetic answers must not update calibration or mastery.
Reads the real distiller output saved by scripts/probe-fraction-circles-applicability.mjs.
"""
import asyncio
import json
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

MOVE = 'contrast_same_numerator_denominators'
GRADE3 = {2, 3, 4, 6, 8}


def same_numerator_pairs(challenges):
    return [c for c in challenges if c['type'] == 'compare' and 1 <= c['numerator'] == c['compareFraction']['numerator']
            and c['denominator'] != c['compareFraction']['denominator']
            and c['numerator'] < min(c['denominator'], c['compareFraction']['denominator'])]


async def main():
    initialize_firebase()
    store, cosmos = FirestoreService(), CosmosDBService()
    uid = 'fc-http-qa-' + uuid4().hex
    report = {'synthetic': True, 'status': 'FAIL', 'tests': [],
              'boundary': 'Real auth/store/delivery/generation; fictional evidence and saved real distiller text. No microphone or canonical learning submission.'}
    folder = ROOT / 'my-tutoring-app/qa/misconception/fraction-circles' / uid
    folder.mkdir(parents=True)
    saved = json.loads((ROOT / 'artifacts/learning-applicability/fraction-circles/distiller.json').read_text(encoding='utf-8'))
    assert saved['diagnosis']['abstain'] is False, 'Distiller output is an abstain; nothing to store'
    focus, evidence = saved['diagnosis']['misconceptionText'], saved['evidence']
    user_created, student_created, mapping, student = False, False, None, None

    def post(url, body, headers):
        response = requests.post(url, json=body, headers=headers, timeout=180)
        if not response.ok:
            raise RuntimeError(f'API request failed: HTTP {response.status_code}')
        return response.json()
    try:
        auth.create_user(uid=uid, email=uid + '@example.invalid', email_verified=True)
        user_created = True
        custom = auth.create_custom_token(uid).decode()
        login = requests.post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken',
            params={'key': settings.FIREBASE_WEB_API_KEY}, json={'token': custom, 'returnSecureToken': True}, timeout=30)
        if not login.ok: raise RuntimeError(f'Firebase sign-in failed: HTTP {login.status_code}')
        headers = {'Authorization': 'Bearer ' + login.json()['idToken']}
        mapping = await cosmos.create_student_mapping(uid, uid + '@example.invalid', 'Disposable fraction-circles QA')
        student = store.client.collection('students').document(str(mapping['student_id']))
        student.create({'qa_probe_run': uid})
        student_created = True
        report['tests'].append('Firebase user authenticated; disposable student reserved')

        scope = {'subject': 'MATHEMATICS', 'grade': '3', 'skill_id': 'NF001-06', 'subskill_id': 'NF001-06-b'}
        import time
        rejection = requests.post('http://localhost:8000/api/student-profile/learning-observation-context', json={'scope': scope},
                                  headers={**headers, 'x-lumina-time': str(int(time.time())), 'x-lumina-signature': '0' * 64}, timeout=30)
        # "unavailable" would mean the server has no key, which also rejects everything; require the signature check itself.
        assert rejection.status_code == 403 and 'Invalid generation certification' in rejection.text, f'Unexpected: {rejection.status_code} {rejection.text[:120]}'
        report['tests'].append('Learner token with a forged service signature rejected by the signature check (HTTP 403)')

        capture = post('http://localhost:8000/api/student-profile/misconceptions', {
            'primitive_type': 'fraction-circles', 'scope': 'skill', 'grade': '3', 'subject': 'MATHEMATICS', 'delivery': 'server',
            'skill_id': 'NF001-06', 'subskill_id': 'NF001-06-b', 'misconception_text': focus,
            'source_attempt_id': uid, 'confidence': saved['diagnosis']['confidence'], 'evidence_tier': 'structured',
            'learning_observation': {'subject': 'MATHEMATICS', 'grade': '3', 'evalMode': 'compare',
                'problem': evidence['challengeSummary'], 'phases': evidence['phases'],
                'teachingImplication': saved['diagnosis'].get('teachingImplication') or 'No teaching adjustment was distilled.',
                'checkNext': saved['diagnosis'].get('checkNext') or 'Collect fresh independent evidence.'}}, headers)
        assert capture.get('stored'), f'Capture failed: {capture}'
        hypothesis = student.collection('misconceptions').document('fraction-circles::NF001-06')
        record = hypothesis.get().to_dict()
        assert record['status'] == 'active' and record['scope_context']['subskill_id'] == 'NF001-06-b'
        report['tests'].append('Authenticated capture stored one active skill-scoped observation with canonical Grade 3 scope')

        # Station split: the signed backend read on its own, before Next is involved.
        def signed_context(requested):
            import hashlib, hmac, os, time
            path = '/api/student-profile/learning-observation-context'
            body = json.dumps({'scope': requested}).encode()
            stamp = str(int(time.time()))
            key = os.environ['LUMINA_GENERATION_SIGNING_KEY'].encode()
            signature = hmac.new(key, (path + '\n' + stamp + '\n' + headers['Authorization'] + '\n').encode() + body, hashlib.sha256).hexdigest()
            started = time.time()
            response = requests.post('http://localhost:8000' + path, data=body, timeout=30, headers={**headers,
                'Content-Type': 'application/json', 'x-lumina-time': stamp, 'x-lumina-signature': signature})
            report.setdefault('signed_context_ms', []).append(round((time.time() - started) * 1000))
            assert response.ok, f'Signed context HTTP {response.status_code}: {response.text[:120]}'
            return response.json()
        direct = signed_context(scope)
        report['signed_context'] = {'available': direct.get('available'), 'count': len(direct.get('observations') or []),
                                    'reason': direct.get('reason')}
        assert direct.get('available') and len(direct['observations']) == 1 and direct['observations'][0]['summary'] == focus, report['signed_context']
        assert not signed_context({**scope, 'skill_id': 'NF001-02', 'subskill_id': 'NF001-02-e'}).get('available')
        report['tests'].append('Signed backend read returns the one saved observation at its skill and nothing for another skill')

        base = dict(componentId='fraction-circles', topic='Comparing fractions', gradeLevel='Grade 3',
                    config=dict(targetEvalMode='compare', difficulty='medium', objectiveGrade='3', objectiveSubject='MATHEMATICS', skillId='NF001-06',
                                subskillId='NF001-06-b', objectiveText='Compare two fractions with the same numerator by reasoning about the size of the parts.'))
        def generate(suffix, config, hdrs):
            started = time.time()
            result = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent',
                'params': {**base, 'instanceId': uid + suffix, 'config': {**base['config'], **config}}}, hdrs)
            report.setdefault('next_ms', {})[suffix] = round((time.time() - started) * 1000)
            return result

        if '--trace' in sys.argv:
            import subprocess, tempfile
            with tempfile.NamedTemporaryFile('w', delete=False, suffix='.token') as handle:
                handle.write(headers['Authorization'])
            try:
                item = {**base, 'instanceId': uid + '-trace'}
                traced = subprocess.run(['node', 'scripts/trace-fraction-circles-delivery.mjs', handle.name, json.dumps(item)],
                                        cwd=ROOT / 'my-tutoring-app', capture_output=True, text=True, timeout=300)
            finally:
                Path(handle.name).unlink()
            report['trace'] = traced.stdout.strip().splitlines()[-1:] or [traced.stderr[-800:]]
            (folder / 'trace.json').write_text(json.dumps(report['trace'], indent=2), encoding='utf-8')
            print('TRACE', report['trace'])
            return

        baseline = generate('-baseline', {}, {})
        (folder / 'baseline.json').write_text(json.dumps(baseline, indent=2), encoding='utf-8')
        assert not baseline['data'].get('learningAdaptation'), 'Unauthenticated baseline was adapted'
        report['tests'].append('Unauthenticated baseline generation received no observation and no adaptation')

        for suffix, patch, why in [('-like-denominators', {'subskillId': 'NF001-06-a'}, 'unreviewed like-denominator objective'),
                                   ('-other-skill', {'skillId': 'NF001-02', 'subskillId': 'NF001-02-e'}, 'reviewed objective in a different skill')]:
            other = generate(suffix, patch, headers)
            (folder / f'boundary{suffix}.json').write_text(json.dumps(other, indent=2), encoding='utf-8')
            assert not other['data'].get('learningAdaptation'), f'Adapted across boundary: {why}'
            report['tests'].append(f'Authenticated generation at {why} was not adapted')

        demonstrations, capacity = [], 0
        for draw in range(5):
            generated = generate(f'-targeted-{draw}', {}, headers)
            (folder / f'targeted-{draw}.json').write_text(json.dumps(generated, indent=2), encoding='utf-8')
            data = generated['data']; adaptation = data.get('learningAdaptation') or {}
            serialized = json.dumps(generated)
            assert focus not in serialized and 'learningObservations' not in serialized and 'remediationFocus' not in serialized
            assert adaptation.get('source') == 'saved-observation' and adaptation.get('move') == MOVE, f'Not delivered: {adaptation}'
            if adaptation['status'] == 'insufficient-capacity':
                capacity += 1
                continue
            pairs = same_numerator_pairs(data['challenges'])
            assert adaptation['comparisonCount'] == len(pairs) >= 2, 'Metadata does not match compiled pairs'
            assert all(c['supportTier'] == 'medium' and c['showFractionLabels'] is False for c in data['challenges'])
            assert all(c['instruction'] == f"Compare {c['numerator']}/{c['denominator']} and {c['compareFraction']['numerator']}/{c['compareFraction']['denominator']}. Which fraction is larger, or are they equal?"
                       for c in data['challenges'])
            if adaptation['status'] == 'targeted':
                assert any({c['denominator'], c['compareFraction']['denominator']} <= GRADE3 for c in pairs)
            demonstrations.append(dict(draw=draw, adaptation=adaptation,
                pairs=[f"{c['numerator']}/{c['denominator']} vs {c['compareFraction']['numerator']}/{c['compareFraction']['denominator']}" for c in data['challenges']]))
            if len(demonstrations) == 2:
                break
        report['capacity_draws'] = capacity
        assert len(demonstrations) == 2, 'Fewer than two delivered, legal contrast draws'
        after = hypothesis.get().to_dict()
        assert after['status'] == 'active' and after.get('resolved_at') is None
        assert len(list(student.collection('misconceptions').stream())) == 1
        assert not list(student.collection('misconception_opportunities').stream())
        (folder / 'demonstration.json').write_text(json.dumps(demonstrations, indent=2), encoding='utf-8')
        report['demonstrations'] = demonstrations
        report['tests'].append('Saved observation reached two real generations through signed delivery; compiled contrasts verified; hypothesis unchanged, no receipt')
        report['status'] = 'PASS'
    finally:
        if student_created and student.get().exists:
            assert student.get().to_dict().get('qa_probe_run') == uid, 'Cleanup owner changed'
            for collection in student.collections():
                assert collection.id in ('misconceptions', 'misconception_opportunities', 'learning_observations'), 'Unexpected learner writes; cleanup requires inspection'
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
