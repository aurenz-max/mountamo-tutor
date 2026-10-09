"""replay_checks.score on tutor lines the Live bench actually produced, so a check is pinned to the case it exists for."""
import pytest

from replay_checks import forms, said_fix, score


def check(text, kind, keys=(), ask='', calls=(), before=None, leak=()):
    reply = {'text': text, 'calls': list(calls), **({'before': before} if before is not None else {})}
    return score(reply, {'kind': kind}, {'keys': list(keys), 'ask': ask, 'leakTokens': list(leak)})


PULL = {'name': 'perform_runtime_action', 'args': {'actionId': 'e/3/0', 'lever': 'five_frame'}}


@pytest.mark.parametrize('text,kind,keys,ask,missed', [
    # LB-4 (ten-frame, 3/3 before the doctrine change): the fix after a miss.
    ('Not quite yet, let\'s try again. Add one more counter to the frame so we have two.', 'miss', ['2'], 'Show 2 on the ten frame', 'no_fix_before_try'),
    # LB-11 (fraction-circles): the fix before any try; the ask names a half, not "one slice".
    ('To show one half, please shade just one of the slices in your circle.', 'start', ['1'], 'Shade the circle to show 1/2.', 'no_fix_before_try'),
    # ten-frame lb8-audio-3 (09-27), cut off mid-reply: what to add, after a miss.
    ("Let's add one counter", 'stuck', ['2'], 'Put two counters on the frame. Your turn.', 'no_fix_before_try'),
    # The key in words before a try.
    ('Count them with me: you should get four.', 'miss', ['4'], 'How many apples?', 'no_key_before_try'),
    ('Look, a half is a quarter of two quarters.', 'stuck', ['1/2'], 'Which piece is bigger?', 'no_key_before_try'),
    # The host's word for a lever, spoken to the child.
    ('I pulled a lever to help you. See the numbers?', 'lever', [], 'Jump back 2 from 6', 'no_protocol_leak'),
    ('[ANSWER_CORRECT] Great job!', 'credit', [], '', 'no_protocol_leak'),
    ('', 'miss', [], '', 'not_empty'),
    # counting-board two_hands (09-28 replay): a number word on a pre-numeric hand match whose group is one.
    ('One hand went away to make it easier. Give it another try!', 'lever', ['1'], 'Look at the fish. Your turn. Tap the hand that matches.', 'no_key_before_try'),
    # A function-word sight word said AS the item's word (di-word-reading, 10-03).
    ('This word says "and". Now you read it.', 'stuck', ['and'], 'What word is this? Read it out loud.', 'no_key_before_try'),
    ('My turn: this word is the.', 'miss', ['the'], 'What word is this? Read it out loud.', 'no_key_before_try'),
])
def test_a_known_miss_is_caught(text, kind, keys, ask, missed):
    assert check(text, kind, keys, ask)['checks'][missed] is False


@pytest.mark.parametrize('text,kind,keys,ask', [
    # Restating the assignment's own amount is not a fix (number-line lever reply, 09-27 replay).
    ('Look at the line now, it shows hop 1 numbered for you. Try hopping backward 2 spaces to see where you land.', 'lever', ['4'], 'Jump back 2 from 6'),
    # Restating the ask (ten-frame run-5, 09-27): "two" is the assignment.
    ('To start, please put two counters on the ten frame.', 'start', ['2'], 'Put two counters on the frame. Your turn.'),
    ("Whenever you're ready, shade the circle to show 1/2 and tap Check.", 'start', ['1'], 'Shade the circle to show 1/2.'),
    # Restating the ask's operands in compound words (base-ten operate, 09-28): "thirty-seven" is 37, not 7.
    ("Let's add thirty-seven and twenty-five using your blocks. Take your time building them!", 'start', ['62'],
     'Add 37 + 25 using blocks.'),
    # A question is an invitation, not the fix.
    ('How many more counters do you need to add?', 'miss', ['2'], 'Show 2 on the ten frame'),
    # "one" as a pronoun.
    ('Let\'s move on to the next one. Take your time on this one.', 'start', ['3'], 'Show 3'),
    # counting-board two_hands (09-28 replay): "the one that matches" is a pronoun, on a group of one.
    ('I took away a hand that does not match. Take a look at the hands left and pick the one that matches!', 'lever', ['1'],
     'Look at the fish. Your turn. Tap the hand that matches.'),
    # number-bond ten_frame_part (09-28): "one whole frame" counts the ten the ask names, not the ones.
    ('Ten-frame boxes are on the screen now. Can you fill up one whole ten-frame box?', 'lever', ['1'],
     'Can you break 11 into a group of ten and some ones?'),
    # The partitive (5/5 two_hands replies, 09-28): which hand went, not how many fish.
    ('One of the hands went away to give you fewer choices. Look at the fish, and tap the hand that matches!', 'lever', ['1'],
     'Look at the fish. Your turn. Tap the hand that matches.'),
    # After a try, the answer belongs in the credit.
    ('You hopped backward 2 spaces and landed right on 4!', 'credit', ['4'], 'Jump back 2 from 6'),
    # A function-word key in the tutor's own sentence is not the item's word (di-word-reading replay, 10-03: "and").
    ('This is a sight word we remember by looking at the whole word together. Take a close look and give it a try!', 'stuck',
     ['and'], 'What word is this? Read it out loud.'),
    ('That word is not dog. Look at the letters on your card and try reading it again!', 'miss', ['and'],
     'What word is this? Read it out loud.'),
    ('That was not quite it, but that\'s okay! Let\'s try it again together and count back carefully.', 'miss', ['3'], 'Solve 8 minus 5'),
    # The answer form naming both verdicts names neither (genre-explorer check-feature replay, 10-04).
    ('Check each line to see if an animal speaks words, and tell me: yes or no?', 'lever', ['yes'],
     'Does the first one have an animal that speaks words?'),
])
def test_a_clean_line_passes(text, kind, keys, ask):
    result = check(text, kind, keys, ask)
    assert not [k for k, v in result['checks'].items() if v is False], result


def test_a_change_narrated_in_the_pulling_turn_is_early_but_after_the_receipt_is_not():
    early = check('', 'stuck', calls=[PULL], before='I have outlined the top row for you.', ask='Show 7')
    assert early['checks']['no_change_before_receipt'] is False and early['pulledLever']
    after = check('See how the top row is outlined now? Try again.', 'stuck', calls=[PULL], before='', ask='Show 7')
    assert after['checks']['no_change_before_receipt'] is True


def test_checks_that_do_not_apply_are_none():
    result = check('You got it, four!', 'credit', ['4'])
    assert result['checks']['no_key_before_try'] is None and result['checks']['no_fix_before_try'] is None
    assert result['checks']['no_change_before_receipt'] is None


def test_spoken_forms():
    assert {'4', 'four'} <= forms('4') and {'one half', 'a half'} <= forms('1/2')
    assert said_fix('Jump back 2 spaces.', 'Jump back 2 from 6') is None
    assert said_fix('Jump back 3 spaces.', 'Jump back 2 from 6') == 'Jump back'


MENU = ['morning', 'afternoon', 'evening', 'night']


@pytest.mark.parametrize('text,excused', [
    # time-sequencer replay 10-09: reading the choices names the key among the others.
    ('Look at the yummy breakfast! When do we eat this yummy meal: Morning, Afternoon, Evening, or Night?', True),
    ('When the sun first comes up and you get out of bed, is that morning or evening?', True),
    # The key alone in its sentence, or the others denied, is still the answer.
    ('We eat breakfast in the morning. Which one is it?', False),
    ('It is morning, not night.', False),
])
def test_reading_the_menu_is_not_the_key(text, excused):
    reply = {'text': text, 'calls': []}
    result = score(reply, {'kind': 'start'}, {'keys': ['morning'], 'ask': 'When do we eat breakfast?', 'leakTokens': [], 'menu': MENU})
    assert result['checks']['no_key_before_try'] is excused


def test_no_menu_keeps_the_key_check():
    assert check('Morning, afternoon or night?', 'start', ['morning'])['checks']['no_key_before_try'] is False
