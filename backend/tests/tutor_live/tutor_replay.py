"""Tutor replay: what the tutor says at each moment, from a text model, without a Live session (handoff 20 Part C).

A Live journey is the only way to see turn timing and real audio, and it costs a paid session. What the tutor SAYS
given its instructions (states the answer, voices protocol, narrates a change early) is decided by the words it is
sent, and a text call can be sent the same words. This builds each request from the backend's own code, so it
cannot drift from what the Live session gets:

  system   build_lesson_system_instruction + RUNTIME_INSTRUCTION (a --lesson-entry session, lumina_tutor.py)
  tools    runtime_tool({'lesson': True}) (live_runtime_tools.py), minus the Live-only `behavior` field
  turns    [LESSON_START] with the state note PrimitiveState.attach writes (the family's guidance and the
           liveRuntime packet), the observe_runtime call and its response, then one turn per moment: the host
           text and learner words joined as the floor gate joins a batch, with the changed state attached.

Moments come from the dry journey (`TUTOR_REPLAY_OUT=<file> npm test -- journeySweep -t "tutor replay"`) or, with
--calibrate, from saved Live runs, whose actual tutor lines are scored by the same checks (`replay_checks.py`).

    python tutor_replay.py <moments.json> [--primitive number-line] [--samples 5] [--observe]
    python tutor_replay.py --calibrate <live-run.json> [...] [--moments <moments.json>] [--doctrine-rev <git rev>]

Text calls to gemini-3.8-flash (the text model of the Live default gemini-3.8-live), never a Live session.
"""
import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
# The backend's settings read backend/.env relative to the working directory; this runs from anywhere.
from dotenv import load_dotenv  # noqa: E402
load_dotenv(ROOT / 'backend/.env')

import httpx  # noqa: E402
from app.api.endpoints.lumina_tutor import build_lesson_system_instruction, PrimitiveState  # noqa: E402
from app.services.live_runtime_tools import RUNTIME_INSTRUCTION, runtime_tool  # noqa: E402
from replay_checks import CHECKS, score  # noqa: E402

MODEL = 'gemini-3.8-flash'
REPORTS = ROOT / 'my-tutoring-app/qa/tutor-reports/replay'
LESSON_ENTRY = '[LESSON_START] The current lesson workspace is mounted. Call observe_runtime for its task and ongoing state updates, then teach naturally.'
DOCTRINE_FILE = 'my-tutoring-app/src/components/lumina/components/live-activity/adapters/adapterContract.ts'
# The phase a saved Live run labels a tutor turn with, as a moment kind.
PHASES = {'lesson-entry': 'start', 'wrong': 'miss', 'stuck': 'stuck', 'stuck-again': 'stuck', 'lever-told': 'lever',
          'correct': 'credit', 'opening': 'start'}


def client():
    """REST, not the SDK: the backend pins google-genai 1.16.1, which cannot carry the thought signatures
    gemini-3.8 requires on function calls in history."""
    key = os.getenv('GEMINI_API_KEY')
    return httpx.AsyncClient(base_url='https://generativelanguage.googleapis.com/v1beta', params={'key': key}, timeout=120)


def session_config(record):
    """The request body every turn shares: the Live session's system instruction and tools."""
    system = build_lesson_system_instruction({'topic': record.get('topic') or record['primitiveId'],
                                              'grade_level': record.get('gradeLevel') or 'K', 'objectives': [], 'ordered_components': []}, {})
    tool = runtime_tool({'lesson': True}).model_dump(mode='json', exclude_none=True, by_alias=True)
    for declaration in tool['functionDeclarations']:
        declaration.pop('behavior', None)  # Live-only (NON_BLOCKING)
    return {'systemInstruction': {'parts': [{'text': system + '\n' + RUNTIME_INSTRUCTION}]}, 'tools': [tool],
            'generationConfig': {'thinkingConfig': {'thinkingBudget': 0}}}


def trigger(moment):
    return '\n\n'.join([*moment.get('host', []), *([moment['learner']] if moment.get('learner') else [])])


def turns(record, moments, replies):
    """The conversation up to and including the last moment. `replies[i]` is the tutor's line after moment i.
    The model makes its own observe_runtime call at lesson start (see `sample`); later turns carry the packet in the state note."""
    state = PrimitiveState()
    state.reset({'teachingGuidance': record['guidance']})
    contents = []
    for i, moment in enumerate(moments):
        state.merge({'liveRuntime': moment['packet']})
        contents.append({'role': 'user', 'parts': [{'text': state.attach(trigger(moment))}]})
        if i < len(moments) - 1 and replies[i]:
            contents.append({'role': 'model', 'parts': [{'text': replies[i]}]})
    return contents


def reply_of(body):
    content = ((body.get('candidates') or [{}])[0].get('content')) or None
    parts = (content or {}).get('parts') or []
    return {'text': ''.join(p['text'] for p in parts if p.get('text') and not p.get('thought')),
            'calls': [{'name': p['functionCall']['name'], 'args': p['functionCall'].get('args') or {}} for p in parts if p.get('functionCall')]}, content


def packet_after(record, call, packet):
    """What the bridge would answer a call with. A lever the sweep also pulled answers with the packet it recorded."""
    lever = (call.get('args') or {}).get('lever')
    pulled = next((m['packet'] for m in (record or {}).get('moments', []) if m['kind'] == 'lever' and (m.get('lever') or {}).get('id') == lever), None)
    return pulled if lever and pulled else packet


async def sample(api, config, contents, n, gate, record=None, packet=None):
    """n replies. A reply that only calls a tool gets the bridge's answer and one more call, as in Live, where the
    tutor speaks after the receipt: `text` is then the spoken line after it, `before` what it said before it.
    Up to two tool rounds: the lesson start is observe_runtime, then possibly an action."""
    async def generate(body):
        for attempt in range(4):
            try:
                response = await api.post(f'/models/{MODEL}:generateContent', json={**config, 'contents': body})
                if response.status_code in (429, 500, 503) and attempt < 3:
                    await asyncio.sleep(3 * (attempt + 1))
                    continue
                response.raise_for_status()
                return reply_of(response.json())
            except Exception as error:
                if attempt == 3:
                    detail = getattr(getattr(error, 'response', None), 'text', '')
                    return {'text': '', 'calls': [], 'error': (repr(error) + ' ' + detail)[:400]}, None
                await asyncio.sleep(3 * (attempt + 1))

    async def one():
        async with gate:
            body, before, calls = list(contents), '', []
            for _ in range(3):
                reply, content = await generate(body)
                calls += reply['calls']
                if reply.get('error') or reply['text'].strip() or not reply['calls'] or content is None:
                    return {**reply, 'calls': calls, **({'before': before} if calls != reply['calls'] else {})}
                before += reply['text']
                body += [content, {'role': 'user', 'parts': [{'functionResponse': {'name': c['name'], 'response': (
                    {'status': 'observing', 'liveRuntime': packet} if c['name'] == 'observe_runtime'
                    else {'status': 'visible', 'liveRuntime': packet_after(record, c, packet)})}} for c in reply['calls']]}]
            return {'text': '', 'before': before, 'calls': calls}
    return await asyncio.gather(*(one() for _ in range(n)))


def observe(frontend, moment, text):
    """The real dialogue observer's verdict on this reply to a spoken answer: credit must credit, a miss must not."""
    body = {**moment['dialogue'], 'tutor': text[:4000]}
    request = urllib.request.Request(f'{frontend}/api/lumina/observe-dialogue', data=json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            decision = json.loads(response.read())
    except Exception as error:
        return {'error': repr(error)[:200]}
    # resolution / replyFinished: a finished reply below the verdict gate still resolves (user ruling 09-24), not a stall.
    return {k: decision.get(k) for k in ('verdict', 'transition', 'accepted', 'resolution', 'replyFinished', 'reason')}


async def replay_record(api, record, args, gate):
    """Samples every moment of one payload, chaining the first spoken sample as the tutor's line for the next moment."""
    config, moments, replies, out = session_config(record), record['moments'], [], []
    for i, moment in enumerate(moments):
        samples = await sample(api, config, turns(record, moments[:i + 1], replies), args.samples, gate, record, moment['packet'])
        replies.append(next((s['text'] for s in samples if s['text'].strip()), ''))
        scored = []
        for s in samples:
            result = score(s, moment, record)
            if args.observe and moment.get('dialogue') and s['text'].strip():
                seen = await asyncio.to_thread(observe, args.frontend, moment, s['text'])
                want = 'correct' if moment['kind'] == 'credit' else None
                result['observer'] = seen
                result['checks']['observer_agrees'] = (seen.get('verdict') == 'correct') if want else (seen.get('verdict') != 'correct') \
                    if 'verdict' in seen else None
            scored.append({**s, **result})
        out.append({'kind': moment['kind'], 'itemId': moment['itemId'], 'trigger': trigger(moment)[:400], 'miss': moment.get('miss'),
                    'scoredWith': {'keys': record.get('keys'), 'ask': record.get('ask'), 'leakTokens': record.get('leakTokens')},
                    'samples': scored})
    return {'payload': record['payload'], 'primitiveId': record['primitiveId'], 'evalMode': record['evalMode'],
            'keys': record.get('keys'), 'stopped': record.get('stopped'), 'moments': out}


def rates(results):
    """Per moment kind and check: samples that missed / samples it applied to."""
    table = {}
    for r in results:
        for m in r['moments']:
            for s in m['samples']:
                for check, value in s['checks'].items():
                    if value is not None:
                        cell = table.setdefault(m['kind'], {}).setdefault(check, [0, 0])
                        cell[0] += value is False
                        cell[1] += 1
    return table


def print_table(table, title):
    print(f'\n{title}')
    for kind in ('start', 'miss', 'stuck', 'lever', 'credit', 'other'):
        for check, (missed, n) in (table.get(kind) or {}).items():
            flag = '  <--' if missed else ''
            print(f'  {kind:<7} {check:<26} {missed:>3}/{n:<3}{flag}')


# ── Calibration: the same moments, taken from saved Live runs, with the tutor's actual lines ──

def git_show(rev, path):
    return subprocess.run(['git', 'show', f'{rev}:{path}'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout


def doctrine(source):
    """WORKSPACE_DOCTRINE's text: its string literals joined, as TypeScript concatenates them."""
    block = re.search(r"export const WORKSPACE_DOCTRINE = (.*?);\n", source, re.S).group(1)
    return ''.join(re.findall(r"'((?:[^'\\]|\\.)*)'", block)).replace("\\'", "'")


def guidance_for(primitive, mode, args):
    """The family's guidance: from a sweep moments file when given, else from the dev server's capabilities envelope."""
    text = None
    if args.moments:
        records = json.loads(Path(args.moments).read_text(encoding='utf-8'))['records']
        text = next((r['guidance'] for r in records if r['primitiveId'] == primitive and r['evalMode'] == mode), None) \
            or next((r['guidance'] for r in records if r['primitiveId'] == primitive), None)
    if text is None:
        with urllib.request.urlopen(f'{args.frontend}/api/lumina/live-activity/capabilities?primitives={primitive}', timeout=120) as response:
            text = json.loads(response.read())['activities'][0]['guidance']
    if args.doctrine_rev:
        now, then = doctrine((ROOT / DOCTRINE_FILE).read_text(encoding='utf-8')), doctrine(git_show(args.doctrine_rev, DOCTRINE_FILE))
        assert now in text, 'The current WORKSPACE_DOCTRINE is not in this guidance; --doctrine-rev cannot swap it'
        text = text.replace(now, then)
    return text


def item_keys(items, item_id):
    """An item's answer values from the saved challenge, whichever field the primitive keeps them in."""
    challenge = next((c for c in items if c.get('id') == item_id), {}) or {}
    keys = set()
    for field, value in challenge.items():
        if re.search(r'target|answer|correct|landing|result|numerator', field, re.I):
            for v in value if isinstance(value, list) else [value]:
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    keys.add(str(int(v)) if float(v).is_integer() else str(v))
                elif isinstance(v, str) and 0 < len(v) <= 12:
                    keys.add(v.strip().lower())
    return sorted(keys)


def live_moments(run):
    """(moment, actual tutor line) pairs from one saved Live run's events."""
    events, pairs, pending, last_state = run['events'], [], [], None
    for e in events:
        if e['type'] in ('host', 'runner_cue', 'learner', 'learner_audio'):
            pending.append(e)
        elif e['type'] == 'tutor':
            kind = PHASES.get(e.get('phase'), 'other')
            # A reply to "I'm stuck" can pull a lever itself: the packet it answered is the one before its own action.
            packet = (last_state if kind == 'stuck' and last_state else e.get('state')) or last_state
            task = (packet or {}).get('task') or {}
            pairs.append(({'kind': kind, 'itemId': task.get('itemId'), 'packet': packet,
                           'host': [p['text'] for p in pending if p['type'] in ('host', 'runner_cue')],
                           'learner': ' '.join(p['text'] for p in pending if p['type'] in ('learner', 'learner_audio')) or None},
                          e['text']))
            pending = []
        if e.get('state'):
            last_state = e['state']
    return [(m, line) for m, line in pairs if m['packet']]


async def calibrate(api, args, gate):
    results = {'actual': [], 'replay': []}
    for path in args.calibrate:
        for index, run in enumerate(json.loads(Path(path).read_text(encoding='utf-8')), 1):
            pairs = live_moments(run)
            if not pairs:
                continue
            packet = pairs[0][0]['packet']
            primitive, mode = run.get('primitiveId') or packet.get('primitiveId'), packet.get('evalMode')
            first = (packet.get('task') or {})
            record = {'primitiveId': primitive, 'evalMode': mode, 'guidance': guidance_for(primitive, mode, args),
                      'leakTokens': run.get('leakTokens') or [], 'ask': first.get('task', ''), 'gradeLevel': args.grade, 'topic': args.topic,
                      'payload': f'{Path(path).name}#{index}'}
            config, moments = session_config(record), [m for m, _ in pairs]
            actual_lines = [line for _, line in pairs]
            actual, replayed = [], []
            for i, (moment, line) in enumerate(pairs):
                record['keys'] = item_keys(run.get('items') or [], moment['itemId'])
                record['ask'] = ((moment['packet'] or {}).get('task') or {}).get('task', record['ask'])
                scored_with = {'keys': record['keys'], 'ask': record['ask'], 'leakTokens': record['leakTokens']}
                actual.append({'kind': moment['kind'], 'itemId': moment['itemId'], 'trigger': trigger(moment)[:400], 'scoredWith': scored_with,
                               'samples': [{'text': line, 'calls': [], **score({'text': line}, moment, record)}]})
                # The tutor's actual lines are the history: only this moment's reply is the model's.
                samples = await sample(api, config, turns(record, moments[:i + 1], actual_lines), args.samples, gate, None, moment['packet'])
                replayed.append({'kind': moment['kind'], 'itemId': moment['itemId'], 'trigger': trigger(moment)[:400], 'actual': line, 'scoredWith': scored_with,
                                 'samples': [{**s, **score(s, moment, record)} for s in samples]})
            results['actual'].append({'payload': record['payload'], 'primitiveId': primitive, 'evalMode': mode, 'moments': actual})
            results['replay'].append({'payload': record['payload'], 'primitiveId': primitive, 'evalMode': mode, 'moments': replayed})
            print(f"{record['payload']}: {len(pairs)} moments", flush=True)
    return results


async def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('moments_file', nargs='?', type=Path)
    parser.add_argument('--primitive', action='append', help='Only these families (repeatable)')
    parser.add_argument('--payload', action='append', help='Only these payload files (repeatable)')
    parser.add_argument('--samples', type=int, default=5)
    parser.add_argument('--observe', action='store_true', help='Send spoken-answer replies to the real /api/lumina/observe-dialogue')
    parser.add_argument('--frontend', default='http://localhost:3000')
    parser.add_argument('--calibrate', nargs='+', type=Path, help='Saved Live run reports to replay and compare')
    parser.add_argument('--moments', type=Path, help='--calibrate: a sweep moments file to take each family\'s guidance from')
    parser.add_argument('--doctrine-rev', help='--calibrate: swap in WORKSPACE_DOCTRINE as it was at this git rev')
    parser.add_argument('--grade', default='K'); parser.add_argument('--topic')
    parser.add_argument('--concurrency', type=int, default=8)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--rescore', type=Path, help='Re-apply replay_checks to a saved replay or calibration report (free, no model call)')
    args = parser.parse_args()
    if args.rescore:
        saved = json.loads(args.rescore.read_text(encoding='utf-8'))
        parts = saved['results'] if isinstance(saved['results'], dict) else {'replay': saved['results']}
        for label, results in parts.items():
            for r in results:
                for m in r['moments']:
                    for s in m['samples']:
                        s.update(score(s, m, m['scoredWith']))
            print_table(rates(results), f'{label.upper()} rescored (missed / n)')
        args.rescore.write_text(json.dumps(saved, indent=1), encoding='utf-8')
        return 0
    api, gate = client(), asyncio.Semaphore(args.concurrency)
    REPORTS.mkdir(parents=True, exist_ok=True)
    stamp = date.today().isoformat()

    if args.calibrate:
        results = await calibrate(api, args, gate)
        actual, replay = rates(results['actual']), rates(results['replay'])
        print_table(actual, 'ACTUAL Live lines (missed / moments)')
        print_table(replay, f'REPLAY {MODEL} (missed / samples)')
        report = args.output or REPORTS / f'calibration-{stamp}.json'
        report.write_text(json.dumps({'model': MODEL, 'samples': args.samples, 'doctrineRev': args.doctrine_rev, 'runs': [str(p) for p in args.calibrate],
                                      'actual': actual, 'replay': replay, 'results': results}, indent=1), encoding='utf-8')
        print(report)
        return 0

    if not args.moments_file:
        parser.error('Give a moments file, or --calibrate with saved runs')
    records = json.loads(args.moments_file.read_text(encoding='utf-8'))['records']
    records = [r for r in records if (not args.primitive or r['primitiveId'] in args.primitive)
               and (not args.payload or r['payload'] in args.payload) and r['moments']]
    results = await asyncio.gather(*(replay_record(api, r, args, gate) for r in records))
    table = rates(results)
    print_table(table, f'REPLAY {MODEL}, {len(records)} payloads x {args.samples} samples (missed / samples)')
    for r in results:
        for m in r['moments']:
            for s in m['samples']:
                if any(v is False for v in s['checks'].values()):
                    missed = [k for k, v in s['checks'].items() if v is False]
                    print(f"  {r['payload']} {m['kind']}: {missed} {s.get('evidence')} :: {s['text'][:160]!r}")
    name = '+'.join(args.primitive) if args.primitive and len(args.primitive) <= 3 else 'sweep'
    report = args.output or REPORTS / f'{name}-{stamp}.json'
    report.write_text(json.dumps({'model': MODEL, 'samples': args.samples, 'checks': CHECKS, 'rates': table, 'results': results}, indent=1), encoding='utf-8')
    print(report)
    return 1 if any(missed for kind in table.values() for missed, _ in kind.values()) else 0


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
