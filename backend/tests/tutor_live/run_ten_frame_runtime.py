"""Real model + mounted TenFrame/runner/reducer/runtime, with simulated audio edges.

The probe supplies two real generated items. No checked verdict is fabricated:
actual model transcription passes through the frontend speech reducer.
JSDOM paint, voice-turn boundaries and playback are simulated. No mastery writes.
"""
import argparse
import asyncio
import json
import re
import subprocess
import time
import uuid
from pathlib import Path
import websockets
from run_tutor_live import get_id_token, fetch_live_context
from activity_capabilities import fetch_activity_spec

ROOT = Path(__file__).resolve().parents[3]
REPORTS = ROOT / 'my-tutoring-app/qa/tutor-reports'


async def drive(args, token, live, index):
    events = []
    started = time.monotonic()
    def record(kind, **fields):
        events.append({'type': kind, 't': round(time.monotonic() - started, 2), **fields})
    process = subprocess.Popen(['node', 'scripts/ten-frame-runtime-driver.mjs', str(uuid.uuid4())],
        cwd=ROOT/'my-tutoring-app', stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True, encoding='utf-8')
    def exchange(message):
        process.stdin.write(json.dumps(message) + '\n'); process.stdin.flush()
        line = process.stdout.readline()
        if not line:
            raise RuntimeError('Mounted driver ended: ' + process.stderr.read()[-1000:])
        return json.loads(line)
    try:
        await asyncio.to_thread(process.stdout.readline)
        data = {**live['generatedData'], 'challenges': live['generatedData']['challenges'][:2]}
        mounted = await asyncio.to_thread(exchange, {'type': 'poll' if args.startup else 'mount', 'data': data})
        state = mounted['state']
        first_id, second_id = [c['id'] for c in data['challenges']]
        answers = {item['id']: item['answers']['correct'] for item in live['diPlan']['items']}
        async with websockets.connect(args.backend + '/api/lumina-tutor', max_size=2**24) as ws:
            await ws.send(json.dumps({'type': 'authenticate', 'token': token, 'session_mode': 'lesson',
                'runtime_sandbox': {'sessionEpoch': state['sessionEpoch'], 'initialState': state},
                'activity_sandbox': args.activity_spec,
                'primitive_context': {'primitive_type': 'live-activity-sandbox', 'instance_id': 'empty-workspace',
                    'primitive_data': {'workspace': 'empty'}, 'owns_opening': True, 'audio_input': {'manual_activity': True}} if args.startup else {'primitive_type': 'ten-frame', 'instance_id': 'frame',
                    'primitive_data': live.get('primitiveData', {}), 'tutoring': live.get('tutoring'),
                    'grade_level': 'Grade 1', 'owns_opening': True, 'audio_input': {'manual_activity': True}},
                'lesson_context': {'topic': 'Make ten', 'grade_level': 'Grade 1', 'objectives': [], 'ordered_components': []}}))

            async def step(message):
                nonlocal state
                reply = await asyncio.to_thread(exchange, message)
                state = reply['state']
                for output in reply['messages']:
                    await ws.send(json.dumps(output))
                    if output['type'] == 'runtime_result': record('runtime_result', result=output)
                    elif output['type'] == 'text': record('runner_cue', text=output['content'])
                return reply

            async def say(text, answer=False):
                if answer: await step({'type': 'answer', 'text': text})
                await ws.send(json.dumps({'type': 'text', 'content': text, 'interrupt': False}))
                record('learner', text=text, answer=answer)

            phase, transcript, saved = 'starting' if args.startup else 'opening', '', None
            async with asyncio.timeout(300):
                while True:
                    try: event = json.loads(await asyncio.wait_for(ws.recv(), .15))
                    except asyncio.TimeoutError:
                        reply = await step({'type': 'poll'})
                        if reply['submissions']:
                            record('complete', state=state, submissions=reply['submissions']); break
                        continue
                    kind = event.get('type')
                    if kind == 'session_ready':
                        record('ready')
                        if args.startup:
                            await say('[LESSON_START] Begin a ten-frame lesson in make_ten mode for Grade 1. Call request_activity now; the mounted runner will speak the opening. Do not greet first.')
                        else: await step({'type': 'start'})
                    elif kind == 'activity_request' and args.startup:
                        assert event['args']['primitiveId'] == 'ten-frame' and event['args']['mode'] == 'make_ten'
                        record('activity_request', request=event['args'])
                        await step({'type': 'mount', 'data': data})
                        await asyncio.sleep(.08)
                        mounted = await step({'type': 'poll'})
                        assert state['visibleRevision'] == state['revision'], 'Mount was not painted'
                        await ws.send(json.dumps({'type': 'activity_result', 'callId': event['callId'], 'status': 'mounted',
                            'instanceId': 'frame', 'primitiveId': 'ten-frame', 'data': mounted['activityState'], 'tutoring': live.get('tutoring')}))
                        record('mounted_generated_payload', state=state)
                    elif kind == 'activity_ready' and args.startup:
                        record('activity_ready'); phase = 'opening'; await step({'type': 'start'})
                    elif kind == 'runtime_command':
                        record('runtime_command', command=event['command'])
                        await step({'type': 'command', 'command': event['command']})
                        if event['command']['action']['type'] == 'return' and state['status'] == 'active':
                            phase = 'reask'
                    elif kind == 'ai_transcription':
                        transcript += event.get('content', '')
                        await step({'type': 'output', 'text': event.get('content', '')})
                    elif kind == 'ai_turn_end':
                        reply = await step({'type': 'end'})
                        if not transcript.strip(): continue
                        record('tutor', phase=phase, text=transcript, state=state)
                        print(f'Run {index} {phase}: {transcript[:150]}', flush=True)
                        spoken = transcript; transcript = ''
                        if reply['submissions']:
                            record('complete', state=state, submissions=reply['submissions']); break
                        if phase == 'opening':
                            phase = 'wrong'; await say('eleven', True)
                        elif phase == 'wrong':
                            assert spoken.lower().startswith('my turn'), 'Wrong spoken answer was not corrected'
                            assert state['task']['itemId'] == first_id, 'Wrong answer advanced the actual component'
                            phase = 'hint'; await say('Please show me a counting hint for this task.')
                        elif phase == 'hint':
                            if not state['task']['support']['level']: continue
                            phase = 'example'; await say('Please show the worked example and save my unfinished frame.')
                        elif phase == 'example':
                            if state['status'] != 'support': continue
                            record('saved', state=state)
                            saved = state['task']['demand']
                            phase = 'return'; await say('Please close the example and return to my saved frame.')
                        elif phase == 'return':
                            if state['status'] == 'support': continue
                            phase = 'reask'
                        elif phase == 'reask':
                            assert state['task']['itemId'] == first_id, 'Return changed the item'
                            assert state['task']['demand'] == saved, 'Return changed the saved frame'
                            phase = 'right'; await say(answers[first_id], True)
                        elif phase == 'right':
                            if state['task']['itemId'] == second_id: phase = 'next-ask'
                        elif phase == 'next-ask':
                            phase = 'last'; await say(answers[second_id], True)
                        elif phase == 'last': phase = 'closing'
                    elif kind in ('error', 'session_ended', 'session_resuming'):
                        raise RuntimeError(event.get('message', kind))
        results = [e['result'] for e in events if e['type'] == 'runtime_result']
        assert len([r for r in results if r['status'] == 'visible']) >= 3, 'Missing actual visible help/return commands'
        assert any(e['type'] == 'complete' and e['state']['status'] == 'completed' for e in events), 'No settled completion'
        assert next(e for e in events if e['type'] == 'complete')['submissions'] == 1, 'Duplicate completion'
        for turn in [e['text'] for e in events if e['type'] == 'tutor']:
            assert not re.search(r'\[(?:TF_|CURRENT|RUNTIME)|\(not set\)|press.{0,20}check answer', turn, re.I), 'Protocol leakage or button-only grading'
        # This pilot's prepared make-ten example must actually teach its supplied
        # relationship, not merely announce a generic example. Not a grading oracle.
        example = next(e for e in events if e['type'] == 'tutor' and e['phase'] == 'example' and e['state']['status'] == 'support')
        artifact = example['state']['supportArtifact']
        words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
                 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
        for number in (artifact['total'] - artifact['removed'], artifact['removed'], artifact['total']):
            assert re.search(rf'\b(?:{number}|{words[number]})\b', example['text'], re.I), 'Worked example omitted its actual quantities'
        return {'passed': True, 'events': events}
    except Exception as error:
        record('failure', reason=str(error)); return {'passed': False, 'events': events}
    finally:
        process.stdin.close()
        try: await asyncio.to_thread(process.wait, timeout=5)
        except subprocess.TimeoutExpired: process.terminate(); await asyncio.to_thread(process.wait)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runs', type=int, default=3)
    parser.add_argument('--backend', default='ws://localhost:8000')
    parser.add_argument('--frontend', default='http://localhost:3000')
    parser.add_argument('--input', type=Path)
    parser.add_argument('--output', type=Path, help='Keep a separate report for a verification run')
    parser.add_argument('--startup', action='store_true', help='Exercise the real activity-request and silent mount handoff before the runner starts')
    args = parser.parse_args()
    args.activity_spec = fetch_activity_spec(args.frontend, ['ten-frame'])
    token = get_id_token()
    live = json.loads(args.input.read_text(encoding='utf-8')) if args.input else fetch_live_context(
        args.frontend, 'ten-frame', 'Make ten: how many more counters are needed', 'Grade 1', 'make_ten', di=True)
    payload = REPORTS/'ten-frame-runtime-payload-2026-09-17.json'
    payload.write_text(json.dumps(live, indent=2), encoding='utf-8')
    report = args.output or REPORTS/'ten-frame-runtime-live-2026-09-17.json'
    runs = []
    for index in range(1, args.runs + 1):
        result = await drive(args, token, live, index); runs.append(result)
        report.write_text(json.dumps(runs, indent=2), encoding='utf-8')
        print(f'Run {index}: {"PASS" if result["passed"] else "FAIL"}', flush=True)
    print(report, flush=True)
    return 0 if all(run['passed'] for run in runs) else 1

if __name__ == '__main__': raise SystemExit(asyncio.run(main()))
