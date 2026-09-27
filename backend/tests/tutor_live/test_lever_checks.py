"""lever_checks.analyze decides a --lever run from its events alone; these pin the four harness misreads it corrects."""
from lever_checks import analyze

ITEMS = [{'id': 'c1', 'targetCount': 7}]


def run(*events, items=ITEMS):
    return {'items': items, 'events': [{'t': i, **e} for i, e in enumerate(events)]}


def state(item, attempts):
    return {'task': {'itemId': item, 'workspace': {'attempts': attempts}}}


WRONG = {'type': 'learner_input', 'intent': 'wrong'}
STUCK = {'type': 'learner', 'text': "I'm stuck. I don't know how to do this one."}
CORRECT = {'type': 'learner_input', 'intent': 'correct'}
CREDIT = {'itemId': 'c1', 'correct': True, 'levers': ['five_frame'], 'assisted': True}


def test_a_finished_journey_passes():
    r = analyze(run(WRONG, {'type': 'lever_item', 'itemId': 'c1'}, STUCK,
                    {'type': 'lever_pull', 'lever': 'five_frame', 'itemId': 'c1', 'dom': {'leverMarks': 5}, 'demand': {'onScreen': 'a five-frame outline'}},
                    CORRECT, {'type': 'lever_complete', 'state': state('c2', [CREDIT])}))
    assert r['passed'] and not r['missed']


def test_a_refused_call_is_neither_a_pull_nor_an_invisible_action():  # LB-2, LB-7
    r = analyze(run(WRONG, STUCK, {'type': 'runtime_result', 'result': {'status': 'blocked', 'reason': 'pull_lever needs lever'}},
                    {'type': 'lever_pull', 'lever': None, 'itemId': 'c1', 'dom': {'leverMarks': 0}}))
    assert r['checks']['lever_pulled'] is False and r['checks']['pull_changed_screen'] is None
    assert r['checks']['actions_visible'] is True and r['refused'] == ['pull_lever needs lever']


def test_unmeasured_marks_are_not_an_unchanged_screen():  # LB-6
    r = analyze(run(WRONG, STUCK, {'type': 'lever_pull', 'lever': 'five_frame', 'itemId': 'c1', 'dom': {'mounted': True}}))
    assert r['checks']['pull_changed_screen'] is None


def test_an_easier_item_is_the_screen_change():  # LB-10
    r = analyze(run(WRONG, STUCK, {'type': 'lever_pull', 'lever': '(simpler item)', 'itemId': 'c1~smaller', 'dom': {'leverMarks': 0}}))
    assert r['checks']['pull_changed_screen'] is True


def test_a_lever_fact_with_the_answer_is_missed_and_no_items_is_unmeasured():
    pull = {'type': 'lever_pull', 'lever': 'running_count', 'itemId': 'c1', 'dom': {'leverMarks': 1}, 'demand': {'onScreen': 'count to 7'}}
    assert analyze(run(WRONG, STUCK, pull))['checks']['no_answer_in_lever_facts'] is False
    assert analyze(run(WRONG, STUCK, pull, items=[]))['checks']['no_answer_in_lever_facts'] is None
