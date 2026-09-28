"""The code verdicts for a `--lever` journey, computed from its recorded events alone (user request 2026-09-27).

A live run drives and records; this module decides. Keeping the two apart means a wrong check is fixed here and
re-applied to runs already saved (`analyze_run.py`), never by paying for another Live session. Five of the first
eleven lever-bench findings (LB-2, 5, 6, 7, 10) were harness checks that aborted a run the model had done right.

Each check is True (met), False (missed) or None (the journey never reached it). A run passes when it reached the
end of the journey and no check is False. Judged checks (did the tutor narrate the change, did it speak the answer)
stay with the reviewer in `lever_review.py`.
"""
import re

# Tags the shared wire owns, on top of whatever the primitive's own script declares (same as run_live_runtime.py).
SHARED_LEAK = r"User['’]s message content|System['’]s response|CURRENT|RUNTIME|\(not set\)|press.{0,20}check answer|wait for (?:the )?(?:student|learner) response|={4,}"

CHECKS = {
    'lever_offered': 'An item offered a lever after a wrong answer',
    'lever_pulled': 'A lever was pulled, by the tutor or the observer, after "I am stuck" or a second wrong answer',
    'pull_changed_screen': 'Every pull changed the screen (lever marks drawn, or an easier item opened)',
    'no_answer_in_lever_facts': 'No lever fact states the full item\'s answer numbers',
    'practice_returned': 'An easier practice item returned to the full item',
    'full_item_credited': 'The correct answer on the full item was credited',
    'credit_records_lever': 'The credited attempt is recorded as assisted, with the lever named',
    'practice_ungraded': 'Easier-item work was recorded as practice, never as a session item',
    'lesson_continued': 'The lesson moved on to the next item',
    'actions_visible': 'Every runtime action reached visible',
    'no_protocol_leak': 'No tutor turn voiced a protocol tag',
}


def _item(run):
    """The full item the levers acted on: recorded by the run, or (older runs) the parent of the first pull."""
    marked = next((e['itemId'] for e in run['events'] if e['type'] == 'lever_item'), None)
    if marked:
        return marked
    pull = next((e for e in run['events'] if e['type'] == 'lever_pull'), None)
    return str(pull['itemId']).split('~')[0] if pull and pull.get('itemId') else None


def _landings(run, item_id):
    """The item's own answer numbers, whichever field the primitive keeps them in."""
    challenge = next((c for c in run.get('items', []) if c.get('id') == item_id), {})
    return {str(v) for k in ('targetValues', 'targetCount', 'answer') for v in
            (challenge.get(k) if isinstance(challenge.get(k), list) else [challenge.get(k)]) if isinstance(v, (int, float))}


def analyze(run, leak_tokens=None):
    events = run['events']
    first = _item(run)
    # A refused tutor call (no lever named) was once recorded as a pull with no lever (LB-2): not a pull.
    pulls = [e for e in events if e['type'] == 'lever_pull' and e.get('lever')]
    stop = next((e['reason'] for e in events if e['type'] == 'failure'), None)
    states = [e['state'] for e in events if e.get('state')]
    end = states[-1] if states else {}
    task = (end or {}).get('task') or {}
    attempts = (task.get('workspace') or {}).get('attempts', [])
    on_first = [a for a in attempts if a['itemId'] == first]
    solving = next((a for a in on_first if a.get('correct')), None)
    reached = lambda kind: any(e['type'] == kind for e in events)
    stuck_said = any(e['type'] in ('learner', 'learner_audio') and 'stuck' in e.get('text', '').lower() for e in events)
    wrong_done = any(e['type'] == 'learner_input' and e.get('intent') == 'wrong' for e in events)
    second_wrong = sum(e['type'] == 'learner_input' and e.get('intent') == 'wrong' for e in events) >= 2
    correct_after_pull = pulls and any(e['type'] == 'learner_input' and e.get('intent') == 'correct'
                                       and events.index(e) > events.index(pulls[0]) for e in events)
    landings = _landings(run, first)
    simpler = [p for p in pulls if p['lever'] == '(simpler item)' or '~' in str(p.get('itemId'))]
    last_practice = max((i for i, a in enumerate(attempts) if a.get('practice')), default=-1)
    leak = re.compile('|'.join([SHARED_LEAK, *(re.escape(t) for t in (leak_tokens or run.get('leakTokens') or []))]), re.I)

    def changed(p):
        """True: marks drawn or an easier item opened. None: the run did not measure marks (older ten-frame runs, LB-6)."""
        if p in simpler or (p.get('dom') or {}).get('leverMarks', 0) > 0:
            return True
        return None if 'leverMarks' not in (p.get('dom') or {}) else False

    def facts(p):
        return ' '.join(str((p.get('demand') or {}).get(k, '')) for k in ('onScreen', 'practice'))

    checks = {
        'lever_offered': (False if 'No item offered a lever' in (stop or '') else True if first else None) if wrong_done else None,
        # Missed only once the learner has said they are stuck and nothing was pulled.
        'lever_pulled': True if pulls else (False if stuck_said or second_wrong else None),
        'pull_changed_screen': (False if False in (seen := [changed(p) for p in pulls]) else True if True in seen else None) if pulls else None,
        # None when the run saved no items (runs before 09-27): there is nothing to compare the facts against.
        'no_answer_in_lever_facts': not any(landings & set(re.findall(r'\d+', facts(p))) for p in pulls) if pulls and landings else None,
        # Reached only when an easier item opened: the return is a full-item attempt after the last practice attempt.
        'practice_returned': any(a['itemId'] == first and not a.get('practice') for a in attempts[last_practice + 1:])
                             if simpler and (correct_after_pull or stop) else None,
        'full_item_credited': (solving is not None) if correct_after_pull else None,
        'credit_records_lever': bool(solving.get('levers') and solving.get('assisted')) if solving else None,
        'practice_ungraded': all(a.get('practice') for a in attempts if '~' in a['itemId']) if simpler else None,
        'lesson_continued': (task.get('itemId') not in (None, first) or reached('lever_complete')) if solving else None,
        # A refused call (blocked, or stale after a newer revision) is the runtime working; the reviewer judges the tutor's call.
        'actions_visible': all(e['result']['status'] in ('visible', 'blocked', 'stale') for e in events if e['type'] == 'runtime_result'),
        'no_protocol_leak': not any(leak.search(e['text']) for e in events if e['type'] == 'tutor'),
    }
    missed = [k for k, v in checks.items() if v is False]
    finished = reached('lever_complete') and not stop
    refused = [e['result'].get('reason') for e in events if e['type'] == 'runtime_result' and e['result']['status'] != 'visible']
    return {'checks': checks, 'missed': missed, 'refused': refused, 'stopped': stop, 'finished': finished,
            'passed': finished and not missed}
