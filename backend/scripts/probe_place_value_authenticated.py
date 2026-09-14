"""Disposable authenticated capture -> Next generation -> persisted opportunity.

Real Firebase authentication and service HMAC; no dependency overrides.
No canonical submission: synthetic answers must not update shared item calibration.
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


async def main():
    initialize_firebase()
    store, cosmos = FirestoreService(), CosmosDBService()
    uid = 'pvc-http-qa-' + uuid4().hex
    report = {'synthetic': True, 'status': 'FAIL', 'tests': [],
              'boundary': 'Real authenticated API and Next generation; synthetic diagnosis. No microphone or canonical learning submission.'}
    folder = ROOT / 'my-tutoring-app/qa/misconception/place-value-opportunities' / uid
    folder.mkdir()
    user_created, student_created, mapping, student = False, False, None, None
    def post(url, body, headers):
        response = requests.post(url, json=body, headers=headers, timeout=120)
        if not response.ok:
            raise RuntimeError(f'API request failed: HTTP {response.status_code}')
        return response.json()
    try:
        auth.create_user(uid=uid, email=uid+'@example.invalid', email_verified=True)
        user_created = True
        custom = auth.create_custom_token(uid).decode()
        login = requests.post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken',
            params={'key': settings.FIREBASE_WEB_API_KEY}, json={'token': custom, 'returnSecureToken': True}, timeout=30)
        if not login.ok: raise RuntimeError(f'Firebase sign-in failed: HTTP {login.status_code}')
        headers = {'Authorization': 'Bearer '+login.json()['idToken']}
        mapping = await cosmos.create_student_mapping(uid, uid+'@example.invalid', 'Disposable place-value QA')
        sid = mapping['student_id']
        student = store.client.collection('students').document(str(sid))
        student.create({'qa_probe_run': uid})
        student_created = True
        report['tests'].append('Firebase user authenticated; collision-checked disposable student reserved')
        scope = {'subject': 'MATHEMATICS', 'grade': '4', 'skill_id': 'NBT004-01', 'subskill_id': 'NBT004-01-b'}
        protected = 'http://localhost:8000/api/student-profile/misconception-opportunity-context'
        rejection = requests.post(protected, json={'scope': scope}, headers=headers, timeout=30)
        assert rejection.status_code == 403, 'Learner token unexpectedly authorizes certification'
        report['tests'].append('Learner token without service signature rejected with HTTP 403')
        if '--blocks-origin' in sys.argv:
            # Base-ten-blocks ORIGINATES the observation: no place-value record exists in this run.
            assert requests.post('http://127.0.0.1:8000/api/student-profile/learning-observation-context',
                json={'scope': scope}, headers=headers, timeout=30).status_code == 403
            saved = json.loads((ROOT/'artifacts/blocks-origin-observation/report.json').read_text(encoding='utf-8'))
            evidence = next(r for r in saved['distill'] if r['name'] == 'bare-count-two-sizes')['evidence']
            diagnosis = post('http://127.0.0.1:3000/api/lumina', {'action': 'distillMisconception', 'params': {
                'evidence': evidence, 'score': 34, 'success': False, 'subskillId': 'NBT004-01-b',
                'evalMode': 'read_blocks', 'gradeLevel': '4'}}, headers)
            (folder/'blocks-origin-diagnosis.json').write_text(json.dumps(dict(evidence=evidence, diagnosis=diagnosis), indent=2), encoding='utf-8')
            assert diagnosis.get('abstain') is False, f'Distiller abstained: {diagnosis}'
            # Same body captureMisconception builds from a mounted read_blocks submission.
            body = dict(grade='4', subject='MATHEMATICS', delivery='server', subskill_id='NBT004-01-b', skill_id='NBT004-01', primitive_type='base-ten-blocks', scope='skill',
                misconception_text=diagnosis['misconceptionText'], confidence=diagnosis['confidence'],
                evidence_tier=diagnosis['evidenceTier'], source_attempt_id=uid+'-blocks',
                learning_observation=dict(subject='MATHEMATICS', grade='4', evalMode='read_blocks',
                    problem=evidence['challengeSummary'][:2000], phases=[{k: p[k] for k in ('itemId', 'phase', 'challenge', 'expected', 'observed', 'support')}
                        for p in evidence['phases'][-12:]],
                    teachingImplication=diagnosis['teachingImplication'] or 'No teaching adjustment was distilled.',
                    checkNext=diagnosis['checkNext'] or 'Collect fresh independent evidence before updating this hypothesis.'))
            url = 'http://127.0.0.1:8000/api/student-profile/misconceptions'
            assert post(url, {**body, 'scope': 'primitive'}, headers) == {'stored': False, 'reason': 'skill-scope-required'}
            assert post(url, {**body, 'subskill_id': 'NBT004-99-z'}, headers) == {'stored': False, 'reason': 'unresolved-canonical-scope'}
            assert post(url, body, headers)['stored']
            record_ref = student.collection('misconceptions').document('base-ten-blocks::NBT004-01')
            record = record_ref.get().to_dict()
            stamped = record.get('scope_context') or {}
            assert record['status'] == 'active' and record['primitive_type'] == 'base-ten-blocks' and record['scope'] == 'skill'
            assert {k: stamped.get(k) for k in ('subject', 'grade', 'skill_id', 'subskill_id')} == {
                'subject': 'MATHEMATICS', 'grade': '4', 'skill_id': 'NBT004-01', 'subskill_id': 'NBT004-01-b'} and stamped.get('curriculum_version')
            assert record['hypothesis_id'] and record['revision'] == 1  # every stamped hypothesis carries a revisioned identity
            assert [s.id for s in student.collection('misconceptions').stream()] == ['base-ten-blocks::NBT004-01']
            report['tests'].append('Real distiller on read_blocks correction evidence -> authenticated capture; primitive scope and unpublished subskill refused; canonical published scope stamped with a revisioned identity')
            raw_url = f'https://firestore.googleapis.com/v1/projects/{store.project_id}/databases/(default)/documents/{record_ref.path}'
            assert requests.get(raw_url, headers=headers, timeout=30).status_code == 403
            assert requests.patch(raw_url, headers=headers, params={'updateMask.fieldPaths': 'qa_denial_probe'},
                json={'fields': {'qa_denial_probe': {'booleanValue': True}}}, timeout=30).status_code == 403
            profile = requests.get('http://127.0.0.1:8000/api/student-profile/learning-observations', headers=headers, timeout=30)
            assert profile.ok
            shown = [o for o in profile.json()['observations'] if o['primitiveType'] == 'base-ten-blocks']
            assert len(shown) == 1 and shown[0]['evalMode'] == 'read_blocks' and shown[0]['status'] == 'suspected'
            assert shown[0]['summary'] == diagnosis['misconceptionText'] and any(e['response'] == 'four' for e in shown[0]['evidence'])
            (folder/'blocks-origin-profile.json').write_text(json.dumps(shown[0], indent=2), encoding='utf-8')
            report['tests'].append('Owner profile shows the blocks-origin observation with its phase evidence; direct client read/write denied')
            demonstrations = []
            for primitive, mode in [('base-ten-blocks', 'read_blocks'), ('place-value-chart', 'compare')]:
                params = dict(componentId=primitive, instanceId=uid+'-origin-'+primitive,
                    topic='Place value in four-digit whole numbers', gradeLevel='Grade 4',
                    config=dict(targetEvalMode=mode, difficulty='medium', objectiveGrade='4', objectiveSubject='MATHEMATICS', skillId='NBT004-01',
                        subskillId='NBT004-01-b', objectiveText='Identify digit place and numeric value in four-digit whole numbers'))
                baseline = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent', 'params': params}, {})
                (folder/f'origin-{primitive}-baseline.json').write_text(json.dumps(baseline, indent=2), encoding='utf-8')
                assert not baseline['data'].get('learningAdaptation')
                successful_draws = 0
                for draw in range(4):
                    generated = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent', 'params': {**params,
                        'instanceId': params['instanceId']+str(draw)}}, headers)
                    (folder/f'origin-{primitive}-authenticated-{draw}.json').write_text(json.dumps(generated, indent=2), encoding='utf-8')
                    data = generated['data']; adaptation = data.get('learningAdaptation') or {}
                    assert data['supportTier'] == 'medium' and not data.get('misconceptionOpportunity')
                    assert diagnosis['misconceptionText'] not in json.dumps(generated) and 'learningObservations' not in json.dumps(generated)
                    if primitive == 'place-value-chart':
                        # The chart consumer is not offered blocks-origin observations and issues no receipt.
                        assert not adaptation, f'Chart unexpectedly adapted: {adaptation}'
                        demonstrations.append(dict(primitive=primitive, draw=draw+1, adaptation=None))
                        break
                    assert adaptation.get('source') == 'saved-observation', f'Missing saved source: {adaptation}'
                    assert adaptation.get('move') == 'contrast_block_count_and_worth'
                    if adaptation.get('status') == 'insufficient-capacity':
                        demonstrations.append(dict(primitive=primitive, draw=draw+1, adaptation=adaptation))
                        continue
                    assert adaptation.get('comparisonCount') == 2 and data['gradeBand'] == '4-5'
                    assert all(c['type'] == mode and 1000 <= c['targetNumber'] <= 9999 and not c['showColumnCounts'] for c in data['challenges'])
                    demonstrations.append(dict(primitive=primitive, draw=draw+1, adaptation=adaptation,
                        numbers=[c['targetNumber'] for c in data['challenges']]))
                    successful_draws += 1
                    if successful_draws == 2:
                        break
                if primitive == 'base-ten-blocks':
                    assert successful_draws == 2, f'Fewer than two legal contrast draws for blocks: {demonstrations}'
            record = record_ref.get().to_dict()
            assert record['status'] == 'active' and 'resolved_at' in record and not record['resolved_at']
            assert not list(student.collection('misconception_opportunities').stream())
            (folder/'blocks-origin-demonstration.json').write_text(json.dumps(demonstrations, indent=2), encoding='utf-8')
            report['tests'].append('Saved blocks-origin observation drives two authenticated blocks draws through shared delivery; unauthenticated baselines unadapted; chart consumer unadapted with no receipt; source stays active and unresolved')
            report['boundary'] = 'Fictional read_blocks responses through the real distiller, authenticated store/profile, shared delivery and generation. No microphone, canonical submission, calibration, or learner transfer/resolution claim.'
            report['status'] = 'PASS'
            return
        source_focus = 'The student gives the bare digit for its worth regardless of position.'
        if '--two-primitive-bridge' in sys.argv:
            diagnosis = post('http://127.0.0.1:3000/api/lumina', {'action': 'distillMisconception', 'params': {
                'score': 30, 'success': False, 'gradeLevel': '4', 'evalMode': 'compare', 'evidence': {
                    'challengeSummary': 'Say the numeric value of highlighted digits in four-digit numbers',
                    'expected': 'The positional numeric value', 'observed': 'Gives the bare digit in each response',
                    'priorAttempts': [{'challenge': 'Value of 2 in the hundreds place of 2258', 'observed': 'two'},
                                      {'challenge': 'Value of 9 in the tens place of 3997', 'observed': 'nine'}]}}}, headers)
            assert not diagnosis['abstain']
            source_focus = diagnosis['misconceptionText']
            (folder/'bridge-diagnosis.json').write_text(json.dumps(diagnosis, indent=2), encoding='utf-8')
        capture = post('http://localhost:8000/api/student-profile/misconceptions', {
            'primitive_type':'place-value-chart', 'scope':'skill', 'grade':'4', 'subject':'MATHEMATICS', 'delivery':'server',
            'skill_id':'NBT004-01', 'subskill_id':'NBT004-01-b',
            'misconception_text':source_focus,
            'source_attempt_id':uid, 'confidence':'high', 'evidence_tier':'judge'}, headers)
        assert capture.get('stored'), 'Diagnosis capture failed'
        report['tests'].append('Authenticated capture stored an active hypothesis at canonical Grade 4 scope')
        status_response = requests.get('http://localhost:8000/api/student-profile/misconception-status?primitive_type=place-value-chart&skill_id=NBT004-01',
                                       headers=headers, timeout=30)
        assert status_response.ok
        status = status_response.json()
        assert status['status'] == 'active' and status['scopeCompatible'] and status['revision'] == 1
        assert 'misconception_text' not in status and 'hypothesis_id' not in status
        report['tests'].append('Tester status endpoint returns own current revision without private diagnosis fields')
        hypothesis = student.collection('misconceptions').document('place-value-chart::NBT004-01')
        raw_url = f'https://firestore.googleapis.com/v1/projects/{store.project_id}/databases/(default)/documents/{hypothesis.path}'
        denial = requests.get(raw_url, headers=headers, timeout=30)
        assert denial.status_code == 403, 'Direct client read unexpectedly allowed'
        report['tests'].append('Authenticated Firebase client denied direct private hypothesis read')
        denial = requests.patch(raw_url, headers=headers, params={'updateMask.fieldPaths': 'qa_denial_probe'},
            json={'fields': {'qa_denial_probe': {'booleanValue': True}}}, timeout=30)
        assert denial.status_code == 403, 'Direct client write unexpectedly allowed'
        report['tests'].append('Authenticated Firebase client denied direct private hypothesis write')
        if '--two-primitive-bridge' in sys.argv:
            demonstrations = []
            for primitive, mode in [('place-value-chart', 'compare'), ('base-ten-blocks', 'read_blocks')]:
                params = dict(componentId=primitive, instanceId=uid+'-'+primitive,
                    topic='Place value in four-digit whole numbers', gradeLevel='Grade 4',
                    config=dict(targetEvalMode=mode, difficulty='medium', objectiveGrade='4', objectiveSubject='MATHEMATICS', skillId='NBT004-01',
                        subskillId='NBT004-01-b', objectiveText='Identify digit place and numeric value in four-digit whole numbers'))
                baseline = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent', 'params': params}, {})
                assert not baseline['data'].get('learningAdaptation')
                (folder/(primitive+'-baseline.json')).write_text(json.dumps(baseline, indent=2), encoding='utf-8')
                successful_draws = 0
                for draw in range(4):
                    generated = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent', 'params': {**params,
                        'instanceId': params['instanceId']+str(draw)}}, headers)
                    (folder/f'{primitive}-targeted-{draw}.json').write_text(json.dumps(generated, indent=2), encoding='utf-8')
                    data = generated['data']; adaptation = data.get('learningAdaptation', {})
                    if primitive == 'place-value-chart':
                        # The older digit-worth path reports trusted delivery via
                        # its issued receipt; learningAdaptation describes the
                        # newer place-name path only. Do not confuse the two.
                        if not data.get('misconceptionOpportunity'):
                            continue
                        adaptation = dict(source='saved-observation', comparisonCount=2,
                            status='certified-generated-contrast', move='contrast_digit_worth')
                    assert adaptation.get('source') == 'saved-observation', f'Missing saved source: {adaptation}'
                    if adaptation.get('status') == 'insufficient-capacity':
                        continue
                    assert adaptation.get('comparisonCount') == 2, f'Wrong contrast count: {adaptation}'
                    assert data['supportTier'] == 'medium'
                    assert source_focus not in json.dumps(generated) and 'remediationFocus' not in json.dumps(generated)
                    if primitive == 'base-ten-blocks':
                        assert not data.get('misconceptionOpportunity')
                        assert data['gradeBand'] == '4-5' and not data.get('decimalMode')
                        pairs = []
                        for index, c in enumerate(data['challenges'][:6]):
                            n = c['targetNumber']
                            assert c['type'] == mode and 1000 <= n <= 9999
                            assert not c['showColumnCounts'] and not c['showBlocksTotal']
                            assert sum((n // 10**p) % 10 == 0 for p in (1,2)) == 1
                            places = [p for p in (3,2,1) if (n // 10**p) % 10]
                            p = places[index % len(places)]; digit = (n // 10**p) % 10
                            pairs.append(dict(number=n, place=p, count=digit, worth=digit*10**p))
                    else:
                        assert data['challengeType'] == mode
                        pairs = [dict(number=c['targetNumber'], place=c['highlightedDigitPlace'],
                            count=(c['targetNumber']//10**c['highlightedDigitPlace'])%10,
                            worth=((c['targetNumber']//10**c['highlightedDigitPlace'])%10)*10**c['highlightedDigitPlace'])
                            for c in data['challenges'][::2]]
                    contrast = next(([a,b] for i,a in enumerate(pairs) for b in pairs[i+1:]
                        if a['place'] != b['place'] and a['count'] == b['count']), None)
                    assert contrast, 'Metadata did not correspond to a compiled worth contrast'
                    demonstrations.append(dict(primitive=primitive, draw=draw+1, contrast=contrast, adaptation=adaptation))
                    successful_draws += 1
                    if successful_draws == 2:
                        break
                assert successful_draws == 2, f'Fewer than two legal contrast draws for {primitive}'
            assert hypothesis.get().to_dict()['status'] == 'active' and hypothesis.get().to_dict()['revision'] == 1
            assert len(list(student.collection('misconceptions').stream())) == 1
            (folder/'two-primitive-demonstration.json').write_text(json.dumps(demonstrations, indent=2), encoding='utf-8')
            report['tests'].append('One real LLM diagnosis stored once drives two chart and two block generation draws; null baselines unadapted; compiled contrasts verified; no copied or resolved hypothesis')
            report['boundary'] = 'Real LLM/auth/store/generation; fictional error evidence. No canonical learning submission, microphone, or learner transfer/resolution claim.'
            report['status'] = 'PASS'
            return
        if '--general-observations' in sys.argv:
            cases = []
            for kind in ('strength', 'support'):
                rows = []
                for item_id, number, place, digit, answer in [('a', 2258, 'hundreds', 2, 'two hundred'), ('b', 3997, 'tens', 9, 'ninety')]:
                    row = dict(itemId=item_id, phase='say_value',
                        challenge=f'Say the value of {digit} in {number}, highlighted in the {place} place',
                        expected=answer, observed=answer, verdict='affirmed', source='voice',
                        priorCorrections=0, hearTapsSoFar=0, support='Other assistance and independence are not established.')
                    if kind == 'support':
                        rows.append({**row, 'observed': str(digit), 'verdict': 'corrected'})
                        row = {**row, 'priorCorrections': 1, 'support': 'One prior tutor correction on this item; other assistance and independence unknown.'}
                    rows.append(row)
                draft = post('http://127.0.0.1:3000/api/lumina', {'action': 'distillLearningObservation', 'params': {'evidence': rows}}, headers)
                assert draft.get('abstain') is False and draft['kind'] == kind
                body = dict(primitive_type='place-value-chart', source_attempt_id=uid+'-'+kind,
                    subject='MATHEMATICS', grade='4', skill_id='NBT004-01', subskill_id='NBT004-01-b', eval_mode='compare',
                    kind=draft['kind'], summary=draft['summary'], teachingImplication=draft['teachingImplication'],
                    checkNext=draft['checkNext'], evidenceItemIds=draft['evidenceItemIds'], responses=rows)
                url = 'http://127.0.0.1:8000/api/student-profile/learning-observations'
                assert requests.post(url, json=body, timeout=30).status_code in (401, 403)
                saved = post(url, body, headers)
                assert saved['stored']
                assert post(url, {**body, 'summary': 'A retry must not replace the saved observation'}, headers) == saved
                assert requests.post(url, json={**body, 'student_id': sid+1}, headers=headers, timeout=30).status_code == 422
                cases.append(dict(kind=kind, draft=draft, observationId=saved['observationId']))
            response = requests.get(url+'?student_id=999', headers=headers, timeout=30)
            assert response.ok
            observations = response.json()['observations']
            assert len(observations) == 2 and {o['kind'] for o in observations} == {'strength', 'support'}
            for case in cases:
                observed = next(o for o in observations if o['id'] == case['observationId'])
                assert observed['summary'] == case['draft']['summary'] and observed['status'] == 'suspected'
                assert observed['evidence'][0]['referenceKind'] == 'client-attempt'
                assert 'expected' not in str(observed)
            assert hypothesis.get().to_dict()['revision'] == 1 and hypothesis.get().to_dict()['status'] == 'active'
            snapshots = list(student.collection('learning_observations').stream())
            assert len(snapshots) == 2
            private_url = f'https://firestore.googleapis.com/v1/projects/{store.project_id}/databases/(default)/documents/{snapshots[0].reference.path}'
            assert requests.get(private_url, headers=headers, timeout=30).status_code == 403
            assert requests.patch(private_url, headers=headers, params={'updateMask.fieldPaths': 'qa_denial_probe'},
                json={'fields': {'qa_denial_probe': {'booleanValue': True}}}, timeout=30).status_code == 403
            (folder/'general-observations.json').write_text(json.dumps(dict(cases=cases, observations=observations), indent=2), encoding='utf-8')
            report['tests'].append('Real Next LLM strength/support -> authenticated immutable per-attempt store -> owner profile; duplicate save stable; keys private; diagnosis unchanged; direct client access denied')
            report['boundary'] = 'Fictional successful/corrected responses; real LLM/auth/store/profile. No canonical learning submission, calibration, microphone or generation adaptation.'
            report['status'] = 'PASS'
            return
        if '--observations-only' in sys.argv:
            phases = [dict(itemId='sample-1', phase='name-place', challenge='Name the place of the second 2 in 2258',
                expected='hundreds', observed='two hundred', support='Correction observation; other assistance unknown'),
                dict(itemId='sample-2', phase='name-place', challenge='Name the place of 9 in 3397',
                expected='tens', observed='ninety', support='Correction observation; other assistance unknown')]
            diagnosis = post('http://127.0.0.1:3000/api/lumina', {'action': 'distillMisconception', 'params': {
                'score': 67, 'success': False, 'gradeLevel': '4', 'evalMode': 'compare', 'evidence': {
                    'challengeSummary': 'Name places in four-digit numbers', 'expected': 'Place names',
                    'observed': 'Says numeric values', 'phases': phases}}}, headers)
            assert not diagnosis['abstain'] and diagnosis['teachingImplication'] and diagnosis['checkNext']
            result = post('http://127.0.0.1:8000/api/student-profile/misconceptions', {
                'primitive_type': 'place-value-chart', 'scope': 'skill', 'grade': '4', 'subject': 'MATHEMATICS', 'delivery': 'server',
                'skill_id': 'NBT004-01', 'subskill_id': 'NBT004-01-b',
                'misconception_text': diagnosis['misconceptionText'], 'source_attempt_id': uid,
                'confidence': diagnosis['confidence'], 'evidence_tier': diagnosis['evidenceTier'],
                'learning_observation': {'subject': 'MATHEMATICS', 'grade': '4', 'evalMode': 'compare',
                    'problem': 'Name places in four-digit numbers', 'phases': phases,
                    'teachingImplication': diagnosis['teachingImplication'], 'checkNext': diagnosis['checkNext']}}, headers)
            assert result['stored']
            response = requests.get('http://127.0.0.1:8000/api/student-profile/learning-observations', headers=headers, timeout=30)
            assert response.ok
            observation = response.json()['observations'][0]
            assert observation['summary'] == diagnosis['misconceptionText']
            assert observation['evidence'][0]['phase'] == 'name-place'
            assert observation['evidence'][0]['response'] == 'two hundred'
            assert observation['status'] == 'suspected' and 'hypothesis_id' not in observation
            (folder/'learning-observation.json').write_text(json.dumps(observation, indent=2), encoding='utf-8')
            report['tests'].append('Real Next LLM distillation -> authenticated Firestore persistence -> owner profile projection preserves phase and guidance')
            if '--generation-context' in sys.argv:
                params = {'componentId': 'place-value-chart', 'instanceId': uid + '-generation',
                    'topic': 'Place value in four-digit whole numbers', 'gradeLevel': 'Grade 4',
                    'config': {'targetEvalMode': 'compare', 'difficulty': 'medium', 'objectiveGrade': '4', 'objectiveSubject': 'MATHEMATICS',
                        'skillId': 'NBT004-01', 'subskillId': 'NBT004-01-b',
                        'objectiveText': 'Identify digit place and numeric value in four-digit whole numbers'}}
                baseline = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent', 'params': params}, {})
                assert 'learningAdaptation' not in baseline['data']
                (folder/'generation-baseline.json').write_text(json.dumps(baseline, indent=2), encoding='utf-8')
                successful_draws = 0
                for draw in range(3):
                    generated = post('http://127.0.0.1:3000/api/lumina', {'action': 'generateComponentContent', 'params': {
                        **params, 'instanceId': uid + f'-generation-{draw}'}}, headers)
                    data = generated['data']
                    (folder/f'generation-targeted-{draw}.json').write_text(json.dumps(generated, indent=2), encoding='utf-8')
                    assert data['challengeType'] == 'compare' and data['supportTier'] == 'medium'
                    assert len(data['challenges']) == len(baseline['data']['challenges'])
                    assert all(1111 <= c['targetNumber'] <= 9999 for c in data['challenges'])
                    assert diagnosis['misconceptionText'] not in json.dumps(generated)
                    assert not data.get('misconceptionOpportunity'), 'Place-name adaptation must not certify digit-worth resolution'
                    adaptation = data.get('learningAdaptation', {})
                    assert adaptation.get('source') == 'saved-observation', 'Stored focus did not reach selection'
                    assert adaptation.get('move') == 'contrast_place_name_and_value'
                    if adaptation['status'] == 'insufficient-capacity':
                        continue
                    assert adaptation['comparisonCount'] == 2
                    # Analyze slots are zero and two; production compiler checks are in TS.
                    a, b = data['challenges'][0], data['challenges'][2]
                    p, q = a['highlightedDigitPlace'], b['highlightedDigitPlace']
                    assert p != q and (a['targetNumber'] // 10**p) % 10 == (b['targetNumber'] // 10**q) % 10
                    successful_draws += 1
                    if successful_draws == 2:
                        break
                assert successful_draws == 2, 'Could not verify two targeted draws within three attempts'
                report['tests'].append('Stored LLM diagnosis drives two real generation draws with paired place-name/value contrasts; baseline unadapted; no resolution credit')
            report['boundary'] = 'Synthetic correction evidence through real LLM and authenticated storage/profile APIs; no microphone, canonical submission or next-generation adaptation.'
            if '--generation-context' in sys.argv:
                report['boundary'] = 'Synthetic evidence through real LLM, authenticated storage and targeted generation. No microphone or resolution certification for place-name confusion.'
            report['status'] = 'PASS'
            return
        published = await store.get_published_curriculum('MATHEMATICS', grade='4')
        objective_text = published['subskill_index']['NBT004-01-b']['subskill_description']
        report['objective_text'] = objective_text
        for draw in range(1,4):
            generated = post('http://localhost:3000/api/lumina', {'action':'generateComponentContent', 'params':{
                'componentId':'place-value-chart', 'instanceId':uid+f'-{draw}',
                'topic':'Place value in four-digit whole numbers', 'gradeLevel':'Grade 4',
                'config':{'targetEvalMode':'compare','difficulty':'medium','objectiveGrade': '4', 'objectiveSubject': 'MATHEMATICS',
                          'skillId':'NBT004-01','subskillId':'NBT004-01-b',
                          'objectiveText':objective_text}}}, headers)
            (folder/f'generated-{draw}.json').write_text(json.dumps(generated,indent=2),encoding='utf-8')
            receipt = generated['data'].get('misconceptionOpportunity')
            if not receipt: continue
            record = student.collection('misconception_opportunities').document(receipt['id']).get().to_dict()
            assert record and record['student_id'] == sid and record['revision'] == hypothesis.get().to_dict()['revision']
            assert sum(i['eligible'] for i in record['items']) == 2
            assert 'bare digit' not in json.dumps(generated)
            report['tests'].append('Next fetched private focus, generated two compiled targets and issued a student/revision-bound receipt')
            report['receipt_draw'] = draw
            report['status'] = 'PASS'
            break
        assert report['status'] == 'PASS', 'No certified receipt after three draws; inspect server configuration or saturation'
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
        (folder/'authenticated-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    print('Report:', str(folder.relative_to(ROOT)))


if __name__ == '__main__':
    asyncio.run(main())
