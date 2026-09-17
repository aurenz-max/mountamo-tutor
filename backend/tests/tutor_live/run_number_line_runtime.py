"""Real Live model -> shared transport -> mounted NumberLine -> real gesture grading.

JSDOM paint and playback edges are simulated. No microphone or mastery writes.
Use --input to replay the exact saved generated payload; reports retain every action.
"""
import argparse
import asyncio
import json
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
    events, state = [], None
    started = time.monotonic()
    def record(kind, **fields):
        events.append({'type': kind, 't': round(time.monotonic() - started, 2), **fields})
    process = subprocess.Popen(['node', 'scripts/primitive-runtime-driver.mjs', str(uuid.uuid4()), 'number-line'],
        cwd=ROOT/'my-tutoring-app', stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True, encoding='utf-8')
    def exchange(message):
        process.stdin.write(json.dumps(message) + '\n'); process.stdin.flush()
        line = process.stdout.readline()
        if not line: raise RuntimeError('Driver ended: ' + process.stderr.read()[-2000:])
        return json.loads(line)
    try:
        ready = json.loads(await asyncio.wait_for(asyncio.to_thread(process.stdout.readline), 30))
        assert ready['ready']
        data = {**live['generatedData'], 'challenges': live['generatedData']['challenges'][:2]}
        assert len(data['challenges']) == 2
        first, second = data['challenges']
        assert all(c['type'] == 'show_jump' and len(c['operations']) == 1 and c['operations'][0]['type'] == 'subtract' for c in data['challenges']), 'Probe needs two simple subtraction jumps'
        mounted = await asyncio.to_thread(exchange, {'type': 'mount', 'data': data})
        state = mounted['state']
        async with websockets.connect(args.backend + '/api/lumina-tutor', max_size=2**24) as ws:
            await ws.send(json.dumps({'type': 'authenticate', 'token': token, 'session_mode': 'lesson',
                'runtime_sandbox': {'sessionEpoch': state['sessionEpoch'], 'initialState': state},
                'activity_sandbox': args.activity_spec,
                'primitive_context': {'primitive_type': 'number-line', 'instance_id': 'line',
                    'primitive_data': mounted['activityState'], 'tutoring': live.get('tutoring'),
                    'grade_level': 'Grade 1', 'owns_opening': True, 'audio_input': {'manual_activity': True}},
                'lesson_context': {'topic': 'Subtraction on a number line', 'grade_level': 'Grade 1', 'objectives': [], 'ordered_components': []}}))
            async def step(message):
                nonlocal state
                reply = await asyncio.to_thread(exchange, message); state = reply['state']
                for output in reply['messages']:
                    await ws.send(json.dumps(output))
                    if output['type'] in ('runtime_result', 'text'): record(output['type'], message=output)
                return reply
            async def turn(label, prompt=None, condition=lambda s: True):
                if prompt:
                    await ws.send(json.dumps({'type': 'text', 'content': prompt, 'interrupt': False}))
                    record('learner', phase=label, text=prompt)
                transcript = ''
                async with asyncio.timeout(55):
                    while True:
                        try: event = json.loads(await asyncio.wait_for(ws.recv(), .15))
                        except asyncio.TimeoutError:
                            await step({'type': 'poll'}); continue
                        kind = event.get('type')
                        if kind == 'runtime_command':
                            record('runtime_command', phase=label, command=event['command'])
                            await step({'type': 'command', 'command': event['command']})
                        elif kind == 'ai_transcription':
                            transcript += event.get('content', '')
                            await step({'type': 'output', 'text': event.get('content', '')})
                        elif kind == 'ai_turn_end':
                            await step({'type': 'end'})
                            if transcript.strip():
                                record('tutor', phase=label, text=transcript, state=state)
                                print(f'Run {index} {label}: {transcript[:170]}', flush=True)
                                if condition(state): return transcript
                                transcript = ''
                        elif kind in ('error', 'session_ended', 'session_resuming'):
                            raise RuntimeError(event.get('message', kind))
                        elif kind in ('activity_command', 'activity_request'):
                            raise AssertionError('Model bypassed the mounted runtime: ' + kind)
            async with asyncio.timeout(30):
                while json.loads(await ws.recv()).get('type') != 'session_ready': pass
            await step({'type': 'poll'})
            await turn('opening', 'Please read my current number-line instruction so I can begin.')
            await step({'type': 'place', 'value': first['targetValues'][0] + 1})
            await step({'type': 'check'})
            assert state['task']['evidence']['correctness'] == 'incorrect', 'Actual component did not reject the wrong landing'
            record('checked_wrong', state=state)
            await turn('wrong')
            assert state['task']['itemId'] == first['id'], 'Wrong answer advanced the task'
            if state['task']['evidence']['correctness'] == 'unknown' and state['task']['demand']['endpoints'] == '[]':
                assert any(e['type'] == 'runtime_command' and e['phase'] == 'wrong' and e['command']['action']['type'] == 'retry' for e in events), 'Response vanished without a retry command'
                record('autonomous_retry', note='Allowed action executed before explicit retry request; review intervention policy separately')
            else:
                await turn('retry', 'Please clear my incorrect response so I can try this same problem again.', lambda s: s['task']['demand']['endpoints'] == '[]')
            await turn('replay', 'Please repeat this same instruction using the replay action.')
            assert (await step({'type': 'poll'}))['dom']['promptFocused'], 'Replay did not focus the mounted instruction'
            await turn('hint', 'Please show the spaces reminder on my screen.', lambda s: s['task']['support']['level'] == 1)
            await turn('fade', 'Please hide the reminder now.', lambda s: s['task']['support']['level'] == 0)
            await step({'type': 'place', 'value': first['targetValues'][0] + 1})
            saved = state['task']['demand']
            await turn('example', 'Please open the worked example and save my unfinished number line.', lambda s: s['status'] == 'support')
            await turn('return', 'Please close the example and return to my saved number line.', lambda s: s['status'] == 'active')
            assert state['task']['itemId'] == first['id'] and state['task']['demand'] == saved
            await step({'type': 'place', 'value': first['targetValues'][0]})
            await step({'type': 'check'})
            await turn('advance', condition=lambda s: s['task']['itemId'] == second['id'])
            assert state['task']['demand']['endpoints'] == '[]', 'Transfer item inherited work'
            await step({'type': 'place', 'value': second['targetValues'][0]})
            reply = await step({'type': 'check'})
            await turn('complete')
            reply = await step({'type': 'poll'})
            assert state['status'] == 'completed' and reply['submissions'] == 1
            record('complete', state=state, submissions=reply['submissions'])
        required = {'retry', 'replay', 'scaffold', 'request_support', 'return', 'advance'}
        called = {e['command']['action']['type'] for e in events if e['type'] == 'runtime_command'}
        assert required <= called, 'Missing model actions: ' + str(required - called)
        receipts = [e['message'] for e in events if e['type'] == 'runtime_result']
        assert len(receipts) >= 7 and all(r['status'] == 'visible' for r in receipts), 'An action did not reach visible'
        return {'passed': True, 'events': events}
    except Exception as error:
        record('failure', reason=repr(error), state=state)
        return {'passed': False, 'events': events}
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
    parser.add_argument('--output', type=Path, default=REPORTS/'number-line-runtime-live-2026-09-17.json')
    args = parser.parse_args()
    args.activity_spec = fetch_activity_spec(args.frontend, ['number-line'])
    token = get_id_token()
    live = json.loads(args.input.read_text(encoding='utf-8')) if args.input else fetch_live_context(
        args.frontend, 'number-line', 'Subtract within 10: two independent single backward jumps, each taking away 1 to 4, starting at 5 to 9. No addition.', 'Grade 1', 'jump')
    (REPORTS/'number-line-runtime-payload-2026-09-17.json').write_text(json.dumps(live, indent=2), encoding='utf-8')
    runs = []
    for index in range(1, args.runs + 1):
        result = await drive(args, token, live, index); runs.append(result)
        args.output.write_text(json.dumps(runs, indent=2), encoding='utf-8')
        print(f'Run {index}: {"PASS" if result["passed"] else "FAIL"}', flush=True)
    return 0 if all(r['passed'] for r in runs) else 1

if __name__ == '__main__': raise SystemExit(asyncio.run(main()))
