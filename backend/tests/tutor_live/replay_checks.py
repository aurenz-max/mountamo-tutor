"""Code verdicts on one tutor reply to one replay moment (handoff 20 Part C).

A moment is a point where the Live tutor takes a turn: `start` (lesson entry), `miss` (after a wrong answer),
`stuck` (the learner says so), `lever` (the observer pulled one and says what is on screen), `credit` (a right
answer). `tutor_replay.py` samples replies from a text model and scores each here; calibration scores the
tutor's actual lines from saved Live runs with the same functions, so the two rates are comparable.

Each check is True (met), False (missed) or None (does not apply to this moment). A check only knows what code
can see in the words: whether the reply is empty, voices protocol, says the key or the fix before a try, or
narrates a lever change before the screen shows it. Whether the reply teaches well stays with a reader.
"""
import re

PRE_TRY = ('start', 'miss', 'stuck', 'lever')

# The shared wire's tags (run_live_runtime.py SHARED_LEAK), plus what only a text replay can show: ids, JSON,
# the tool names, and the words the lever message forbids ("never call it a lever or a tool").
SHARED_LEAK = r"User['’]s message content|System['’]s response|CURRENT|RUNTIME|\(not set\)|press.{0,20}check answer|wait for (?:the )?(?:student|learner) response|={4,}"
REPLAY_LEAK = r"\blevers?\b|\bthe host\b|actionId|liveRuntime|observe_runtime|perform_runtime_action|pull_lever|begin_help|[{}]|\[[A-Z_]{3,}\]"

NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
                'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
DENOMINATORS = {2: ('half', 'halves'), 3: ('third', 'thirds'), 4: ('fourth', 'fourths', 'quarter', 'quarters'),
                5: ('fifth', 'fifths'), 6: ('sixth', 'sixths'), 8: ('eighth', 'eighths'), 10: ('tenth', 'tenths'),
                12: ('twelfth', 'twelfths')}

# An instruction to change the work by an amount: "Add one more counter", "To show one half, please shade just one".
# The verb opens the sentence, after at most a leading clause and softeners, so a description ("it shows hop 1") is not one.
FIX = re.compile(r"^(?:[^,]{0,30},\s*)?(?:(?:please|just|now|so|then|next|and|ok(?:ay)?|let's|let us|try to|try|you need to|you should|you can|go ahead and)\s+)*"
                 r"(add|put|place|remove|take away|take off|move|shade|colou?r in|jump|hop|slide|drag|count on|count back|go back|go forward)(?:ing)?\b"
                 r"[^.?!]{0,40}?\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+|more|fewer|less|back|forward)\b"
                 r"(?!\s+(?:is|are|was|were|has|shows)\b)", re.I)  # "Hop 1 is now drawn" names a hop, it does not ask for one
# A screen change described as already there: fine after the receipt, not in the reply that asks for it.
CHANGE_DONE = re.compile(r"\bI(?:'ve| have)? (?:drawn|added|put|marked|shown|highlighted|outlined|numbered|pulled)\b"
                         r"|\b(?:now|look,?) (?:you can )?see\b|\bis now (?:drawn|marked|showing|on)\b|\bsee (?:how|the|those) [^.?!]{0,30}\bnow\b", re.I)


def forms(phrase):
    """The ways a tutor can say a key aloud: a number as digits and as a word, a fraction as words."""
    p = str(phrase).strip().lower()
    out = {p}
    n = NUMBER_WORDS.index(p) if p in NUMBER_WORDS else int(p) if p.isdigit() else None
    if n is not None and n < len(NUMBER_WORDS):
        out |= {str(n), NUMBER_WORDS[n]}
    fraction = re.fullmatch(r'(\d+)\s*/\s*(\d+)', p)
    if fraction and int(fraction.group(2)) in DENOMINATORS and int(fraction.group(1)) < len(NUMBER_WORDS):
        top, names = int(fraction.group(1)), DENOMINATORS[int(fraction.group(2))]
        out |= {f'{NUMBER_WORDS[top]} {name}' for name in names} | ({f'a {names[0]}'} if top == 1 else set())
    return out


def says(text, phrase):
    return re.search(rf'(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])', text.lower()) is not None


def numbers_in(text):
    """Digits and number words in a span, as digit strings."""
    found = set(re.findall(r'\d+', text))
    # A compound number word is one number ("thirty-seven" is 37, not 7; base-ten operate replay, 09-28).
    tens = {w: 10 * i for i, w in enumerate(['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']) if w}
    compound = re.compile(rf"\b({'|'.join(tens)})(?:[- ]({'|'.join(NUMBER_WORDS[1:10])}))?\b", re.I)
    for ten, one in compound.findall(text):
        found.add(str(tens[ten.lower()] + (NUMBER_WORDS.index(one.lower()) if one else 0)))
    text = compound.sub(' ', text)
    found |= {str(NUMBER_WORDS.index(w)) for w in re.findall(r'[a-z]+', text.lower()) if w in NUMBER_WORDS}
    return found


def plain_ask(ask):
    """The ask without its fractions: "show 1/2" asks for a half, it does not state 1 or 2 as an amount."""
    words = '|'.join(NUMBER_WORDS)
    names = '|'.join(n for names in DENOMINATORS.values() for n in names)
    ask = re.sub(r'\d+\s*/\s*\d+', ' ', ask or '')
    return re.sub(rf'\b(?:{words}|a)[\s-]+(?:{names})\b', ' ', ask, flags=re.I)


def without_asked_fractions(text, ask):
    """The reply without the fractions the ask states ("shade one-third" restates "show 1/3"); any other fraction stays."""
    for top, bottom in re.findall(r'(\d+)\s*/\s*(\d+)', ask or ''):
        for form in sorted(forms(f'{top}/{bottom}'), key=len, reverse=True):
            spaced = r'[\s-]+'.join(re.escape(word) for word in form.split(' '))  # "one third" also as "one-third"
            text = re.sub(r'(?<![a-z0-9])' + spaced + r'(?![a-z0-9])', ' ', text, flags=re.I)
    return text


# "one" as a pronoun ("this one", "the one that matches") and "move on" name no amount.
PRONOUN_ONE = re.compile(r"\b(?:this|that|next|each|every|which|another|other|last|first|new) one\b|\bthe one (?:that|which|who|you)\b"
                         r"|\bmove on\b|\bone (?:at a time|by one|more time|step)\b", re.I)


# A sight-word key that is also an everyday function word ("and", "the", "is"): a tutor cannot avoid the word in its own
# sentences, so it counts only when it is said AS the item's word: quoted, or after "says" / "is the word"
# (di-word-reading replay 10-03, 19/19 false flags on "and").
FUNCTION_WORD_KEYS = {'a', 'and', 'are', 'at', 'for', 'go', 'he', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'said', 'see',
                      'she', 'the', 'they', 'to', 'was', 'we', 'you', 'have', 'here', 'like', 'look', 'come', 'with', 'what'}


def said_function_word(text, word):
    w = re.escape(word)
    quote = '["“”‘’\']'
    quoted = rf'{quote}{w}[.!?,]?{quote}'
    named = rf"\b(?:says|said|word is|it is|it's|reads)\s+{quote}?{w}(?=\s*{quote}?\s*(?:[.!?,]|$))"
    return re.search(f'{quoted}|{named}', text, re.I) is not None


def said_key(text, keys):
    """The first key the reply says, in any spoken form, or None."""
    # The partitive names which object, not how many ("one of the hands went away", counting-board 09-28). Only here:
    # as an instruction it is an amount ("shade just one of the slices", LB-11), which `said_fix` still catches.
    text = re.sub(r"\bone of (?:the|these|those|your)\b", '', PRONOUN_ONE.sub('', text), flags=re.I)
    # Both answers named as the answer form ("tell me: yes or no?", genre-explorer replay 10-04) say neither.
    text = re.sub(r"\b(?:yes or no|no or yes)\b", '', text, flags=re.I)
    # "one" counting the ten itself ("fill one whole ten-frame"), which a ten-and-ones ask names ("a group of ten"),
    # is not the ones (number-bond ten_frame_part replay, 09-28).
    text = re.sub(r"\bone (?:whole |full |complete )?(?:ten[- ]frames?(?: boxe?s?)?|frames?|group of ten|ten)\b", '', text, flags=re.I)
    return next((k for k in keys if (said_function_word(text, str(k)) if str(k).lower() in FUNCTION_WORD_KEYS
                                     else any(says(text, f) for f in forms(k)))), None)


NEGATION = re.compile(r"\bnot\b|n['’]t\b|\bnever\b", re.I)


def read_as_menu(text, key, menu):
    """True when every sentence that says the key also names another option on screen and denies none: the tutor
    reading the choices ("Morning, Afternoon, Evening, or Night?", time-sequencer replay 10-09) is not the answer.
    "When you play all afternoon, the sun is up for hours" still says it."""
    others = [o for o in menu if str(o).lower() != str(key).lower() and not any(says(o, f) for f in forms(key))]
    sentences = [x for x in re.split(r'(?<=[.!?:])\s+', text) if any(says(x, f) for f in forms(key))]
    return bool(others and sentences) and all(not NEGATION.search(x) and any(says(x, o) for o in others) for x in sentences)


def said_fix(text, ask):
    """A statement (not a question) telling the learner what to change by how much. An amount the ask itself states
    ("put two counters", "jump back 2") is the assignment; "shade one slice" for "show 1/2" is not in the ask."""
    asked = numbers_in(plain_ask(ask))
    text = PRONOUN_ONE.sub('', text)
    # Names with a number in them are not amounts.
    text = re.sub(r"\bten[- ]frames?\b|\bhundreds? chart\b|\bfive[- ]frames?\b", 'frame', text, flags=re.I)
    text = without_asked_fractions(text, ask)  # "shade the circle to show 1/2" restates the ask
    for sentence in re.split(r'(?<=[.!?])\s+', text):
        if sentence.rstrip().endswith('?'):
            continue
        match = FIX.search(sentence.strip())
        amounts = numbers_in(sentence)
        if match and (not amounts or not amounts <= asked):
            return match.group(0)
    return None


def score(reply, moment, record):
    """reply: {'text': str, 'calls': [{'name', 'args'}]}. Returns {check: True/False/None} and the evidence for each miss."""
    text, calls = (reply.get('text') or '').strip(), reply.get('calls') or []
    kind = moment['kind']
    leak = re.compile('|'.join([SHARED_LEAK, REPLAY_LEAK, *(re.escape(t) for t in record.get('leakTokens') or [])]), re.I)
    pulled = any(c['name'] == 'perform_runtime_action' and (c.get('args') or {}).get('lever') for c in calls)
    # A key the ask itself states ("Give me four apples") is the assignment, not a secret.
    ask = record.get('ask') or ''
    secret = [k for k in record.get('keys') or [] if not any(says(without_asked_fractions(ask, ask), f) for f in forms(k))]
    # The reply restating the ask's fraction ("shade one-third") is not the key either.
    key = said_key(without_asked_fractions(text, ask), secret) if kind in PRE_TRY else None
    if key is not None and read_as_menu(text, key, [str(o).strip().lower() for o in record.get('menu') or []]):
        key = None
    fix = said_fix(text, record.get('ask')) if kind in PRE_TRY else None
    leaked = leak.search(text)
    # Words said in the same turn as the pull, before its receipt; a replay's follow-up line comes after it.
    early = CHANGE_DONE.search(reply.get('before', text) or '') if kind == 'stuck' and pulled else None
    checks = {
        'not_empty': bool(text or calls),
        'no_protocol_leak': leaked is None,
        'no_key_before_try': (key is None) if kind in PRE_TRY and secret else None,
        'no_fix_before_try': (fix is None) if kind in PRE_TRY else None,
        'no_change_before_receipt': (early is None) if kind == 'stuck' and pulled else None,
    }
    evidence = {k: v for k, v in {'no_protocol_leak': leaked and leaked.group(0), 'no_key_before_try': key,
                                  'no_fix_before_try': fix, 'no_change_before_receipt': early and early.group(0)}.items() if v}
    return {'checks': checks, 'evidence': evidence, 'pulledLever': pulled if kind == 'stuck' else None}


CHECKS = {
    'not_empty': 'The tutor replied (words or a tool call)',
    'no_protocol_leak': 'No protocol tag, id, JSON, tool name, or the word "lever" spoken',
    'no_key_before_try': 'Before a try, the reply does not say the answer in any spoken form',
    'no_fix_before_try': 'Before a try, the reply does not tell the learner what to change by how much',
    'no_change_before_receipt': 'A reply that pulls a lever does not describe the change as already on screen',
}
