"""Fresh registry/API draws; checks physics independently, no student writes."""
import concurrent.futures
import json
import math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request

MODES = ['compare_conditions', 'find_threshold', 'plan_fair_test', 'design_with_budget', 'explain_from_trials']
jobs = [{'evalMode': mode} for mode in MODES]
jobs += [{'evalMode': mode, 'difficulty': tier, 'count': 5} for mode in ['plan_fair_test', 'explain_from_trials'] for tier in ['easy', 'hard']]
jobs += [{'evalMode': 'mixed'}, {'evalMode': 'plan_fair_test|explain_from_trials', 'count': 5}]
jobs += [{'intent': 'Plan a fair test of surface friction by choosing settings that change only the surface.'},
         {'intent': 'Explain how surface friction changed the measured push using two recorded trials.'}]

def probe(job):
    query = {'componentId': 'ramp-lab', 'gradeLevel': 'Grade 3', 'grade': '3',
             'topic': 'Investigate how surface friction changes the push needed to move a box', **job}
    request = 'http://localhost:3000/api/lumina/eval-test?' + urlencode(query)
    if 'evalMode' not in job:
        request = Request('http://localhost:3000/api/lumina', data=json.dumps({
            'action': 'generateComponentContent', 'params': {'componentId': 'ramp-lab', 'topic': query['topic'], 'gradeLevel': 'elementary',
                'config': {'objectiveGrade': '3', 'intent': job['intent'], 'objectiveText': job['intent']}}
        }).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    with urlopen(request, timeout=120) as response:
        payload = json.load(response)
    if 'evalMode' in job:
        assert payload['status'] == 'pass', payload
        data = payload['fullData']
    else:
        data = payload.get('data', payload)
    challenges = data['challenges']
    actual = set(ch['mode'] for ch in challenges)
    mode = job.get('evalMode')
    if mode and mode != 'mixed':
        assert actual == set(mode.split('|')), (job, actual)
    if mode == 'mixed':
        assert actual == set(MODES), actual
    if not mode:
        expected = 'plan_fair_test' if job['intent'].startswith('Plan') else 'explain_from_trials'
        assert actual == {expected}, (job, actual)
    if 'count' in job:
        assert len(challenges) == job['count'], (job, len(challenges))
    assert len({ch['id'] for ch in challenges}) == len(challenges)
    for ch in challenges:
        if ch['mode'] not in ['plan_fair_test', 'explain_from_trials']:
            continue
        assert ch['variable'] == 'surface', ch
        a, b = ch['scenarios']['a'], ch['scenarios']['b']
        changes = [key for key in ['angle', 'loadWeight', 'frictionLevel', 'loadType'] if a[key] != b[key]]
        assert changes == ([] if ch['mode'] == 'plan_fair_test' else ['frictionLevel']), ch
        for setup in [a, b]:
            coefficient = {'none': 0, 'low': .1, 'medium': .3, 'high': .5}[setup['frictionLevel']]
            radians = math.radians(setup['angle'])
            force = setup['loadWeight'] * 9.8 * (math.sin(radians) + coefficient * math.cos(radians))
            assert 0 < force < 100
    return {'query': query, 'modes': sorted(actual), 'count': len(challenges), 'status': 'pass', 'payload': payload}

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(probe, jobs))
    Path('qa/eval-reports/ramp-lab-live-draws-2026-09-10.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps({'status': 'pass', 'draws': len(results), 'challenges': sum(r['count'] for r in results)}))
