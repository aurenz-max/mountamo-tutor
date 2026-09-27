"""After-run reviewer for the `--lever` bench (handoff 18; the /eval-test -> /eval-fix pattern for live levers).

Reads one journey's events against the six lever checks and writes, for every miss, what went wrong, the layer
that owns it and a proposed fix with its executor skill, into ONE queue: `my-tutoring-app/qa/lever-bench/QUEUE.md`.
A miss the queue already holds is counted again on its row rather than filed twice.

Code decides what code can know (a pull committed, the full item was credited, practice work was flagged, the
session never started). The judge decides only what needs reading: whether the tutor used the change, narrated
it after it was visible, or spoke the answer. The judge never re-decides a code fact.

    python lever_review.py <report.json> [--primitive number-line]   # review saved runs and update the queue
"""
import argparse
import json
import os
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
QUEUE = ROOT / 'my-tutoring-app/qa/lever-bench/QUEUE.md'
JUDGE_MODEL = 'gemini-flash-latest'

CHECKS = {
    1: 'A lever is pulled unprompted (by the tutor or the observer) after a wrong answer and "I am stuck".',
    2: 'The screen changes before the tutor describes it; the tutor then talks about what changed.',
    3: 'Nothing leaks: no lever, frame, fact or tutor sentence states the landing / answer of the full item before the learner gives it.',
    4: 'The attempt after the pull is recorded as assisted, with the lever named.',
    5: 'The learner reaches the full item and answers it correctly; only that answer is credited, never simpler-item work.',
    6: 'The lesson continues normally afterwards.',
}
# The layer that owns a miss, and the skill that executes its fix.
LAYERS = {
    'tutor_instruction': '/add-live-tutor-tools',
    'lever_design': '/add-support-tiers',
    'observer_policy': '/add-live-tutor-tools',
    'content': '/eval-fix',
    'harness': '/add-live-tutor-tools',
}


def _api_key():
    key = os.getenv('GEMINI_API_KEY')
    if not key:
        from dotenv import load_dotenv
        load_dotenv(ROOT / 'backend/.env')
        key = os.getenv('GEMINI_API_KEY')
    return key


def environment_failure(run):
    """A run that never reached the lever: not a lever finding, counted apart (handoff 18 gotchas)."""
    failure = next((e['reason'] for e in run['events'] if e['type'] == 'failure'), '')
    if '1012' in failure:
        return 'uvicorn reloaded mid-drive (ws 1012)'
    if 'TimeoutError' in failure and not any(e['type'] == 'tutor' for e in run['events']):
        return 'the model never spoke its lesson opening'
    return None


def code_facts(run):
    """What the events establish without judgment, per check."""
    events = run['events']
    pulls = [e for e in events if e['type'] == 'lever_pull']
    end = next((e['state'] for e in reversed(events) if e.get('state')), {}) or {}
    workspace = (end.get('task') or {}).get('workspace') or {}
    attempts = workspace.get('attempts', [])
    failure = next((e['reason'] for e in events if e['type'] == 'failure'), None)
    facts = {
        'passed': run['passed'], 'failure': failure,
        'pulls': [{'t': p['t'], 'lever': p['lever'], 'source': p.get('source', 'tutor'), 'itemId': p.get('itemId'),
                   # A simplify pull swaps in an easier item: that IS the screen change, and it draws no lever marks.
                   'screen_change': 'an easier practice item replaced the item' if '~' in str(p.get('itemId')) or p['lever'] == '(simpler item)'
                   else f"{(p.get('dom') or {}).get('leverMarks', 0)} lever marks drawn",
                   'screen': p.get('dom'), 'facts': {k: (p.get('demand') or {}).get(k) for k in ('onScreen', 'practice', 'learnerWork')}}
                  for p in pulls],
        'tutor_refused_pulls': [e for e in events if e['type'] == 'tutor_pull_lever' and not e.get('committed')],
        'items_without_lever': [e['itemId'] for e in events if e['type'] == 'no_lever_item'],
        'attempts': attempts,
    }
    facts['code_verdicts'] = {
        1: bool(pulls),
        4: any(a.get('levers') and a.get('assisted') for a in attempts if not a.get('practice')) if pulls else None,
        5: (any(a['correct'] and not a.get('practice') for a in attempts)
            and all(a.get('practice') for a in attempts if '~' in a['itemId'])) if pulls else None,
        6: any(e['type'] == 'lever_complete' for e in events) if pulls else None,
    }
    return facts


def timeline(run):
    """The journey as the judge reads it: every spoken turn, learner move, host note and pull, in time order."""
    lines = []
    for e in run['events']:
        t = f"{e['t']:>6.1f}s"
        if e['type'] == 'tutor': lines.append(f"{t} TUTOR: {e['text'].strip()}")
        elif e['type'] in ('learner', 'learner_audio'): lines.append(f"{t} LEARNER SAYS: {e['text']}")
        elif e['type'] == 'learner_input': lines.append(f"{t} LEARNER {e['intent'].upper()} ON SCREEN: {e.get('performed')}")
        elif e['type'] == 'host': lines.append(f"{t} HOST TO TUTOR: {e['text'][:200]}")
        elif e['type'] == 'runner_cue': lines.append(f"{t} HOST NOTE TO TUTOR: {e['text'][:300]}")
        elif e['type'] == 'lever_pull': lines.append(f"{t} LEVER PULLED by {e.get('source', 'tutor')}: {e['lever']} (screen now: {e.get('dom')})")
        elif e['type'] == 'tutor_pull_lever' and not e.get('committed'): lines.append(f"{t} TUTOR PULL REFUSED: {e.get('lever')}")
        elif e['type'] == 'runtime_command':
            a = e['command']['action']; lines.append(f"{t} TUTOR TOOL: {a.get('operation') or a['type']} {a.get('input') or ''}")
        elif e['type'] == 'failure': lines.append(f"{t} JOURNEY FAILED: {e['reason'][:200]}")
    return '\n'.join(lines)[-12000:]


def open_rows(text):
    return [line for line in text.splitlines() if line.startswith('| LB-') and '| open |' in line]


def judge(run, facts, primitive, items, queue_rows):
    from google import genai
    key = _api_key()
    if not key:
        return None, 'GEMINI_API_KEY not found; the run was NOT reviewed'
    prompt = f"""You review ONE recorded live tutoring journey on the "{primitive}" primitive for a young child. The journey tests
in-item support levers: the child answers wrong, says "I'm stuck", and a lever (a change the screen makes on the same item) should
be pulled, by the tutor's own tool or by the host observer, and then the child finishes the full item.

The six checks:
{json.dumps(CHECKS, indent=1)}

Facts code already established (do not re-decide them; explain them): {json.dumps(facts['code_verdicts'])}
Pulls: {json.dumps(facts['pulls'])[:3000]}
Refused tutor pulls: {len(facts['tutor_refused_pulls'])}. Items that offered no lever: {facts['items_without_lever']}.
Journey result: {'PASS' if facts['passed'] else 'FAIL: ' + str(facts['failure'])}

The generated items (the answers are here; the child must not be told them): {json.dumps(items)[:3000]}

Timeline:
{timeline(run)}

Open findings already queued (reuse an id when this journey shows the SAME miss):
{chr(10).join(queue_rows[-30:]) or '(none)'}

Name each root cause ONCE. When the journey stopped at some moment, a check it never reached is "n/a", not a finding.
When the journey failed on a harness assertion that contradicts the timeline (for example it says a pull changed nothing while
a pull with a screen change is recorded, or it counted a refused call), the owning layer is harness.

For every check that failed or was only partly met, and for anything else a teacher would call a mistake in how the tutor
used the lever (ignored the change, described something not on screen, talked the child to the answer, spoke a number that is
the answer), write one finding. Judge only from the timeline. Owning layer: tutor_instruction (what the tutor is told: guidance,
tool descriptions, host notes), lever_design (what the lever draws or builds, when it is offered), observer_policy (when the
observer pulls and what it tells the tutor), content (the generated item itself), harness (the journey or its checks were wrong).
proposed_fix: one concrete change in that layer, stated as a principle, never a script for the tutor to recite.

Return STRICT JSON: {{"checks": {{"1": "met|missed|partial|n/a", "2": ..., "3": ..., "4": ..., "5": ..., "6": ...}},
"findings": [{{"existing_id": "LB-n or null", "check": "1-6 or other", "title": "<= 12 words", "what_went_wrong": "one or two sentences
with the moment in time", "evidence": "a short quote from the timeline", "layer": "tutor_instruction|lever_design|observer_policy|content|harness",
"proposed_fix": "one sentence"}}]}}"""
    client = genai.Client(api_key=key)
    response = client.models.generate_content(model=JUDGE_MODEL, contents=prompt,
                                              config={'temperature': 0, 'response_mime_type': 'application/json'})
    return json.loads(response.text), None


HEADER = """# Lever bench queue

Findings from the after-run reviewer (`backend/tests/tutor_live/lever_review.py`) on `run_live_runtime.py --lever` journeys.
One row per distinct miss; a recurrence adds to `Seen`. Work the top open row with its executor skill, re-run the journey,
and mark it `closed` with the commit. Environment failures (session start, reloads) are counted in each run's review, not queued.

| ID | Primitive | Check | Layer | What went wrong | Proposed fix | Executor | Seen | Last run | Status |
|---|---|---|---|---|---|---|---|---|---|
"""


def _cell(text):
    return re.sub(r'\s+', ' ', str(text or '')).replace('|', '/').strip()


def queue(findings, primitive, run_ref):
    text = QUEUE.read_text(encoding='utf-8') if QUEUE.exists() else HEADER
    rows = [l for l in text.splitlines() if l.startswith('| LB-')]
    next_id = max([int(re.match(r'\| LB-(\d+)', r).group(1)) for r in rows] or [0]) + 1
    filed = []
    for f in findings:
        existing = f.get('existing_id')
        match = next((i for i, r in enumerate(rows) if existing and r.startswith(f'| {existing} |')), None)
        if match is not None:
            cells = rows[match].split('|')
            cells[8] = f' {int(cells[8]) + 1} '; cells[9] = f' {run_ref} '
            rows[match] = '|'.join(cells); filed.append(existing); continue
        layer = f.get('layer') if f.get('layer') in LAYERS else 'harness'
        rows.append(f"| LB-{next_id} | {primitive} | {_cell(f.get('check'))} | {layer} | {_cell(f.get('what_went_wrong'))} "
                    f"(\"{_cell(f.get('evidence'))[:160]}\") | {_cell(f.get('proposed_fix'))} | {LAYERS[layer]} | 1 | {run_ref} | open |")
        filed.append(f'LB-{next_id}'); next_id += 1
    head = text.split('| ID |')[0] if '| ID |' in text else HEADER.split('| ID |')[0]
    QUEUE.parent.mkdir(parents=True, exist_ok=True)
    QUEUE.write_text(head + HEADER[HEADER.index('| ID |'):] + ''.join(r + '\n' for r in rows), encoding='utf-8')
    return filed


def review(run, primitive, items, run_ref):
    """Review one run; file its misses. Returns the review, which the caller keeps beside the run."""
    env = environment_failure(run)
    if env:
        return {'environment': env, 'findings': [], 'queued': []}
    facts = code_facts(run)
    queue_text = QUEUE.read_text(encoding='utf-8') if QUEUE.exists() else ''
    try:
        verdict, problem = judge(run, facts, primitive, items, open_rows(queue_text))
    except Exception as error:  # a judge failure must surface, never read as a clean run
        verdict, problem = None, f'judge call failed ({error}); the run was NOT reviewed'
    if not verdict:
        return {'unreviewed': problem, 'code_verdicts': facts['code_verdicts'], 'findings': [], 'queued': []}
    findings = verdict.get('findings') or []
    return {'code_verdicts': facts['code_verdicts'], 'checks': verdict.get('checks'), 'findings': findings,
            'queued': queue(findings, primitive, run_ref)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('report', type=Path)
    parser.add_argument('--primitive', default=None)
    args = parser.parse_args()
    runs = json.loads(args.report.read_text(encoding='utf-8'))
    for index, run in enumerate(runs, 1):
        primitive = args.primitive or run.get('primitiveId', '?')
        result = review(run, primitive, run.get('items', []), f'{args.report.name}#{index}')
        run['review'] = result
        print(f"Run {index}: {result.get('environment') or result.get('unreviewed') or result.get('checks')} -> {result['queued']}")
    args.report.write_text(json.dumps(runs, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
