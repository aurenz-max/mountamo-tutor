"""
Tier-3 live tutor harness — a headless synthetic student for /tutor-test.

Drives the REAL production path end-to-end: authenticates on the backend
Lumina Tutor WebSocket exactly like LuminaAIContext does (same auth payload,
same message types), replays the primitive's natural interaction order
(intro -> first student action -> second -> boundary pokes), and captures the
tutor's spoken words via the `ai_transcription` stream after every beat.

Plumbing gate first (`--plumbing`): connect, auth, greeting — proves the
scaffold reaches Gemini and transcripts flow back. Then the full journey.

Prereqs:
  - backend running on :8000 (uvicorn app.main:app)
  - frontend running on :3000 (for &probe=1&live=1 real generated content)
  - content-pipeline/.env with FIREBASE_API_KEY + TEST_USER_EMAIL/PASSWORD
    (or a fresh AUTH_TOKEN)

Usage:
  python run_tutor_live.py --component states-of-matter --plumbing
  python run_tutor_live.py --component states-of-matter
"""
import argparse
import asyncio
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional

import requests
import websockets
from dotenv import load_dotenv

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
load_dotenv(os.path.join(REPO_ROOT, "content-pipeline", ".env"))

TURN_TIMEOUT = 60.0     # Gemini Live turns can be slow to start
SILENCE_WINDOW = 6.0    # how long a "should stay quiet" beat listens
DRAIN_GRACE = 1.5       # trailing transcript chunks after ai_turn_end


# ---------------------------------------------------------------------------
# Auth + content context
# ---------------------------------------------------------------------------

def get_id_token() -> str:
    api_key = os.getenv("FIREBASE_API_KEY")
    email = os.getenv("TEST_USER_EMAIL")
    password = os.getenv("TEST_USER_PASSWORD")
    if api_key and email and password:
        r = requests.post(
            f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
            json={"email": email, "password": password, "returnSecureToken": True},
            timeout=20,
        )
        r.raise_for_status()
        return r.json()["idToken"]
    token = os.getenv("AUTH_TOKEN")
    if token:
        return token
    raise RuntimeError("No Firebase credentials: set FIREBASE_API_KEY + TEST_USER_EMAIL/PASSWORD (or AUTH_TOKEN) in content-pipeline/.env")


def fetch_live_context(frontend: str, component_id: str, topic: str, grade: str,
                       eval_mode: Optional[str] = None) -> Dict[str, Any]:
    """Tier-2 probe with &live=1: real generated content + the raw tutoring block.

    Retries: the Next dev server intermittently answers mid-recompile, and
    generation itself can flake — neither should kill a live run.

    eval_mode pins the generated challenge type (default = catalog evalModes[0]);
    pass it to keep a bespoke journey's DISAMBIGUATE/STIMULUS checks type-focused.
    """
    last_err: Optional[Exception] = None
    for attempt in range(1, 4):
        try:
            params = {"componentId": component_id, "probe": "1", "live": "1", "topic": topic, "gradeLevel": grade}
            if eval_mode:
                params["evalMode"] = eval_mode
            r = requests.get(
                f"{frontend}/api/lumina/tutor-test",
                params=params,
                timeout=180,
            )
            body = r.json()
            probe = body.get("probe") or {}
            if "error" in probe:
                raise RuntimeError(f"probe generation failed: {probe['error']}")
            live = probe.get("liveContext")
            if not live:
                raise RuntimeError(f"no liveContext in probe response (status {r.status_code}) — is the &live=1 route change deployed?")
            return {"audit": body.get("audit"), "status": body.get("status"), **live}
        except (ValueError, RuntimeError, requests.RequestException) as e:
            last_err = e
            snippet = ""
            try:
                snippet = r.text[:120].replace("\n", " ")
            except Exception:
                pass
            print(f"      probe attempt {attempt}/3 failed: {e} {f'(body: {snippet})' if snippet else ''}")
            time.sleep(5)
    raise RuntimeError(f"probe&live failed after 3 attempts: {last_err}")


# ---------------------------------------------------------------------------
# Journey model
# ---------------------------------------------------------------------------

@dataclass
class Beat:
    name: str
    sends: List[Dict[str, Any]] = field(default_factory=list)  # raw WS messages, sent in order
    expect: str = "turn"          # "turn" | "silence"
    leak_answers: List[str] = field(default_factory=list)  # answers that must NOT be spoken here
    state: Optional[str] = None   # the driven on-screen state during this beat (for stale-state checks)
    note: str = ""
    # STIMULUS check: each entry is a group of acceptable spellings; the tutor's
    # speech this beat must hit AT LEAST ONE spelling from EVERY group, else the
    # load-bearing content (e.g. a story a non-reader needs read aloud) was
    # dropped. Missing any group → "stimulus-not-read" HIGH.
    must_include: List[List[str]] = field(default_factory=list)


@dataclass
class BeatResult:
    beat: Beat
    transcript: str = ""
    ai_text: str = ""
    turn_ended: bool = False
    audio_bytes: int = 0
    elapsed: float = 0.0


def text_msg(content: str) -> Dict[str, Any]:
    return {"type": "text", "content": content}


def ctx_msg(state: Dict[str, Any]) -> Dict[str, Any]:
    return {"type": "update_context", "primitive_data": state, "student_progress": None}


def state_of(temp: float, melt: float, boil: float) -> str:
    if temp < melt:
        return "solid"
    if temp < boil:
        return "liquid"
    return "gas"


# ---------------------------------------------------------------------------
# states-of-matter journey — mirrors StatesOfMatter.tsx sendText templates
# ---------------------------------------------------------------------------

def build_states_of_matter_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    data = live.get("generatedData") or {}
    sub = data.get("substance") or {}
    name = sub.get("name", "Water")
    formula = sub.get("formula")
    melt = float(sub.get("meltingPoint", 0))
    boil = float(sub.get("boilingPoint", 100))
    challenges = data.get("challenges") or []
    grade_band = data.get("gradeBand") or ("K-2" if "k" in grade.lower() else "3-5")

    start_temp = melt - 20  # student dragged the slider to the cold end first
    ch0 = challenges[0] if challenges else {}
    # Leak checks are scoped to the CURRENT challenge's answer — the tutor
    # naming another challenge's answer as framing ("in the liquid…") is not a
    # leak; naming the one the student is being asked right now is.
    answers = [str(ch0.get("targetAnswer", ""))] if ch0.get("targetAnswer") else []

    initial_bag = {
        "gradeBand": grade_band,
        "substanceName": name,
        "substanceFormula": formula,
        "meltingPoint": melt,
        "boilingPoint": boil,
        "currentTemperature": start_temp,
        "currentState": "solid",
        "particleSpeed": 10,
        "substancesExplored": 1,
        "currentChallengeIndex": 0,
        "totalChallenges": len(challenges),
        "challengeType": ch0.get("type", "identify_state"),
        "instruction": ch0.get("instruction", ""),
        "attemptNumber": 0,
    }

    def bag_at(temp: float) -> Dict[str, Any]:
        st = state_of(temp, melt, boil)
        speed = {"solid": 10, "liquid": 45, "gas": 90}[st]
        return {"currentTemperature": temp, "currentState": st, "particleSpeed": speed}

    beats = [
        Beat("greeting", sends=[], expect="turn", state="solid",
             note="server auto-queues the standalone greeting on auth"),
        Beat("activity_start", expect="turn", state="solid", sends=[text_msg(
            f"[ACTIVITY_START] States of Matter activity for {grade_band}. "
            f"Substance: {name}{f' ({formula})' if formula else ''}. "
            f"Melting point: {melt}°C, Boiling point: {boil}°C. "
            f"Starting at {start_temp}°C (solid). "
            f"{len(challenges)} challenges. "
            f'Introduce warmly: "Let\'s explore what happens to {name} when we change the temperature! '
            f'Right now it\'s a solid. What do you think the tiny particles inside are doing?"'
        )]),
        Beat("silent_slider_wiggle", expect="silence", state="solid", sends=[
            ctx_msg(bag_at(start_temp + 4)),
            ctx_msg(bag_at(start_temp + 8)),
            ctx_msg(bag_at(start_temp + 2)),
        ], note="slider moves with no state crossing — quiet-by-default: tutor should NOT speak"),
        Beat("heat_past_melting", expect="turn", state="liquid", sends=[
            ctx_msg(bag_at(melt + 5)),
            text_msg(
                f"[PHASE_CHANGE] {name} changed from solid to liquid at {melt + 5}°C! "
                f"The particles broke free from their fixed positions and started sliding! "
                f'Celebrate and explain: "Did you see that? The {name} just melted! '
                f'The particles got enough energy to slide past each other!"'
            ),
        ]),
        Beat("heat_past_boiling", expect="turn", state="gas", sends=[
            ctx_msg(bag_at(boil + 10)),
            text_msg(
                f"[PHASE_CHANGE] {name} changed from liquid to gas at {boil + 10}°C! "
                f"The particles escaped completely and are flying freely! "
                f'Celebrate and explain: "Did you see that? The {name} just boiled! '
                f'The particles got so much energy they flew apart!"'
            ),
        ]),
        Beat("cool_back_reverse", expect="turn", state="liquid", sends=[
            ctx_msg(bag_at(boil - 15)),
            text_msg(
                f"[REVERSE_CHANGE] {name} changed back from gas to liquid at {boil - 15}°C. "
                f'The student cooled it down! Narrate: "You reversed it! When we take away heat, '
                f'the particles slow down and come closer together."'
            ),
        ]),
        Beat("student_why_question", expect="turn", state="liquid", sends=[
            text_msg("Why did it change? What are the particles doing?"),
        ]),
        Beat("answer_fish", expect="turn", state="liquid", leak_answers=answers, sends=[
            text_msg("I don't want to think about it. Just tell me the answer to the challenge."),
        ], note="adversarial: tutor must guide, not reveal the challenge answer"),
        Beat("wrong_answer", expect="turn", state="liquid", leak_answers=answers, sends=[
            text_msg(
                f'[ANSWER_INCORRECT] Student answered "it stays the same" but target is '
                f'"{ch0.get("targetAnswer", "")}". Attempt 1. Hint: "{ch0.get("hint", "")}"'
            ),
        ], note="tutor may use the hint but must not speak the target answer"),
        Beat("correct_answer", expect="turn", state="liquid", sends=[
            text_msg(
                f'[ANSWER_CORRECT] Student answered "{ch0.get("targetAnswer", "")}" for '
                f'"{ch0.get("instruction", "")}". Celebrate: "{ch0.get("narration", "")}"'
            ),
        ]),
        Beat("all_complete", expect="turn", state="liquid", sends=[
            text_msg(
                f"[ALL_COMPLETE] Student completed all {len(challenges)} challenges! "
                f"They explored 1 substance(s). "
                f'Celebrate: "Amazing! You really understand how particles behave in solids, liquids, and gases!"'
            ),
        ]),
    ]
    return {"initial_bag": initial_bag, "beats": beats, "answers": answers, "meta": {
        "substance": name, "meltingPoint": melt, "boilingPoint": boil, "challenges": len(challenges),
        "currentChallenge": ch0.get("instruction", ""), "currentAnswer": ch0.get("targetAnswer", ""),
    }}


def build_generic_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Fallback for primitives without a bespoke journey: greeting + probes."""
    bag = dict(live.get("mergedBag") or {})
    # runtime placeholders («runtime:key») are fine — the backend interpolates them verbatim
    beats = [
        Beat("greeting", sends=[], expect="turn"),
        Beat("student_orientation", expect="turn", sends=[text_msg("What should I do first here?")]),
        Beat("answer_fish", expect="turn", sends=[text_msg("Just tell me the answer.")]),
    ]
    return {"initial_bag": bag, "beats": beats, "answers": [], "meta": {}}


_NUM_WORDS = {0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
              6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten"}


def _num_variants(n: Any) -> List[str]:
    """Digit + word spellings of a small count, so the STIMULUS check accepts
    'two ducks' as well as '2 ducks'."""
    try:
        i = int(n)
    except (TypeError, ValueError):
        return [str(n)]
    return [str(i)] + ([_NUM_WORDS[i]] if i in _NUM_WORDS else [])


def build_addition_subtraction_scene_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Reader-fit STIMULUS journey. Replays the EXACT [ACTIVITY_START] / [NEXT_ITEM]
    messages AdditionSubtractionScene.tsx sends, then checks (must_include) whether
    the tutor actually READ the story aloud — the K-lesson failure that seeded the
    reader-fit backlog (tutor said "let's do some butterfly stories" and stopped).
    """
    data = live.get("generatedData") or {}
    challenges = data.get("challenges") or []
    grade_band = data.get("gradeBand") or ("K" if "k" in grade.lower() else "1")
    ch0 = challenges[0] if challenges else {}
    ch1 = challenges[1] if len(challenges) > 1 else ch0

    def obj_variants(ch: Dict[str, Any]) -> List[str]:
        o = str(ch.get("objectType", "")).strip()
        # accept singular too ("duck" for "ducks")
        return [o, o[:-1]] if o.endswith("s") and len(o) > 3 else [o]

    def story_groups(ch: Dict[str, Any]) -> List[List[str]]:
        # A genuine read-aloud names the objects AND both quantities from the
        # story; a bare "let's do a duck story!" intro hits only the object group.
        groups = [obj_variants(ch)]
        if ch.get("startCount") is not None:
            groups.append(_num_variants(ch.get("startCount")))
        if ch.get("changeCount") is not None:
            groups.append(_num_variants(ch.get("changeCount")))
        return [g for g in groups if any(v for v in g)]

    def bag_for(ch: Dict[str, Any], idx: int) -> Dict[str, Any]:
        return {
            "storyText": ch.get("storyText", ""),
            "operation": ch.get("operation", "addition"),
            "storyType": ch.get("storyType", "join"),
            "startCount": ch.get("startCount", 0),
            "changeCount": ch.get("changeCount", 0),
            "resultCount": ch.get("resultCount", 0),
            "unknownPosition": ch.get("unknownPosition", "result"),
            "challengeType": ch.get("type", "act-out"),
            "instruction": ch.get("instruction", ""),
            "equation": ch.get("equation", ""),
            "objectType": ch.get("objectType", ""),
            "scene": ch.get("scene", "pond"),
            "attemptNumber": 1,
            "currentChallengeIndex": idx,
            "totalChallenges": len(challenges),
            "gradeBand": grade_band,
            "maxNumber": data.get("maxNumber", 5),
        }

    initial_bag = bag_for(ch0, 0)
    gb_label = "Kindergarten" if grade_band == "K" else "Grade 1"

    # Verbatim replica of the component's [ACTIVITY_START] sendText (silent intro).
    activity_start = text_msg(
        f"[ACTIVITY_START] Addition & subtraction story scene for {gb_label}. "
        f"{len(challenges)} challenges total. First story: \"{ch0.get('storyText','')}\" "
        f"({ch0.get('operation','addition')}, {ch0.get('storyType','join')}). "
        f"Scene: {ch0.get('scene','pond')}, objects: {ch0.get('objectType','')}. "
        f"Introduce warmly: \"Let's tell a story with {ch0.get('objectType','')}!\" "
        f"Then read the story aloud."
    )
    next_item = text_msg(
        f"[NEXT_ITEM] Moving to challenge 2 of {len(challenges)}: "
        f"\"{ch1.get('storyText','')}\" ({ch1.get('type','act-out')}, {ch1.get('operation','addition')}). "
        f"Read the story to the student and introduce the new task."
    )

    beats = [
        Beat("greeting", sends=[], expect="turn",
             note="server auto-queues the standalone greeting on auth"),
        Beat("activity_start", expect="turn", sends=[activity_start],
             must_include=story_groups(ch0),
             note="STIMULUS: a non-reader needs the whole story READ ALOUD here, "
                  "not just a 'let's do a story' intro"),
        Beat("student_stuck", expect="turn", sends=[
            text_msg("[CONTEXT UPDATE] Student has not acted for a while; no taps yet."),
        ], note="ORIENT: does the tutor restate, in child terms, what to do?"),
        Beat("next_story", expect="turn", sends=[next_item],
             must_include=story_groups(ch1),
             note="STIMULUS on advance: the second story must be read aloud too"),
    ]
    return {"initial_bag": initial_bag, "beats": beats, "answers": [], "meta": {
        "gradeBand": grade_band, "challenges": len(challenges),
        "story0": ch0.get("storyText", ""), "story1": ch1.get("storyText", ""),
    }}


def build_comparison_builder_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Reader-fit DISAMBIGUATE journey. Replays the EXACT [ACTIVITY_START] /
    [NEXT_ITEM] messages ComparisonBuilder.tsx sends, then checks (must_include)
    whether the tutor actually ENACTED the specific comparison question — the live
    K failure that seeded reader-fit backlog #2 (the tutor greeted warmly but never
    asked "which side has more?", so the non-reader never learned what to decide).

    tutorRevealClause is '' at K (no supportTier), so NOTHING in these sendText
    messages disambiguates — only the catalog `aiDirectives` beat can. That is
    exactly what this journey confirms behaviorally, in --lesson mode where the
    one-sentence greeting cap would otherwise drop a soft component clause.
    """
    data = live.get("generatedData") or {}
    challenges = data.get("challenges") or []
    grade_band = data.get("gradeBand") or ("K" if "k" in grade.lower() else "1")
    use_alligator = bool(data.get("useAlligatorMnemonic", True))
    gb_label = "Kindergarten" if grade_band == "K" else "Grade 1"

    def first_of(t: str) -> Optional[Dict[str, Any]]:
        return next((c for c in challenges if c.get("type") == t), None)

    # Focus on compare-groups (the observed failure + the shipped tap-the-side fix).
    ch0 = first_of("compare-groups") or (challenges[0] if challenges else {})
    ch1 = next((c for c in challenges if c.get("id") != ch0.get("id")), ch0)

    types: List[str] = []
    for c in challenges:
        t = c.get("type")
        if t and t not in types:
            types.append(t)

    def bag_for(ch: Dict[str, Any], idx: int) -> Dict[str, Any]:
        return {
            "challengeType": ch.get("type", "compare-groups"),
            "leftCount": (ch.get("leftGroup") or {}).get("count"),
            "rightCount": (ch.get("rightGroup") or {}).get("count"),
            "leftNumber": ch.get("leftNumber"),
            "rightNumber": ch.get("rightNumber"),
            "correctAnswer": ch.get("correctAnswer") or ch.get("correctSymbol"),
            "targetNumber": ch.get("targetNumber"),
            "askFor": ch.get("askFor"),
            "gradeBand": grade_band,
            "useAlligatorMnemonic": use_alligator,
            "instruction": ch.get("instruction", ""),
            "totalChallenges": len(challenges),
            "currentChallengeIndex": idx,
            "attemptNumber": 1,
        }

    initial_bag = bag_for(ch0, 0)

    # Verbatim replica of the component's [ACTIVITY_START] (silent intro). Note the
    # trailing tutorRevealClause is EMPTY at K — no disambiguation rides along here.
    activity_start = text_msg(
        f"[ACTIVITY_START] Comparison activity for {gb_label}. "
        f"{len(challenges)} challenges covering: {', '.join(types)}. "
        f"{'Using alligator mnemonic for inequality symbols. ' if use_alligator else ''}"
        f"First challenge: \"{ch0.get('instruction','')}\". Introduce warmly."
    )
    next_item = text_msg(
        f"[NEXT_ITEM] Moving to challenge 2 of {len(challenges)}: "
        f"\"{ch1.get('instruction','')}\" (type: {ch1.get('type','compare-groups')}). "
        f"Read the instruction and encourage the student."
    )

    # DISAMBIGUATE bar per challenge type: the tutor must voice the comparison
    # RELATIONSHIP being asked AND direct the child to the choice. A bare
    # "let's compare!" hits neither group → stimulus-not-read HIGH.
    def disambiguate_groups(ch: Dict[str, Any]) -> List[List[str]]:
        t = ch.get("type")
        choice = ["tap", "pick", "point", "choose", "touch", "click", "press"]
        if t == "compare-numbers":
            return [["bigger", "more", "greater", "smaller", "less", "same", "equal"],
                    ["number", "alligator"] + choice]
        if t == "one-more-one-less":
            return [["one more", "one less", "more", "less"], ["number", "count"] + choice]
        if t == "order":
            return [["order", "smallest", "biggest", "least", "greatest", "first"], choice]
        # compare-groups (default)
        return [["more", "fewer", "less", "same", "equal", "bigger", "most"],
                ["side", "left", "right", "group"] + choice]

    # Leak = the current challenge's answer word ASSERTED (not questioned). Skip
    # the < > = symbols (not spoken words).
    def answer_word(ch: Dict[str, Any]) -> List[str]:
        a = ch.get("correctAnswer") or ch.get("correctSymbol")
        return [str(a)] if a and str(a) not in ("<", ">", "=") else []

    beats = [
        Beat("greeting", sends=[], expect="turn",
             note="server auto-queues the greeting on auth (lesson greeting + "
                  "one-sentence cap in --lesson)"),
        Beat("activity_start", expect="turn", sends=[activity_start],
             must_include=disambiguate_groups(ch0), leak_answers=answer_word(ch0),
             note="DISAMBIGUATE: the tutor must ask the SPECIFIC comparison "
                  "('which side has more? tap it'), not just greet — the live #2 failure"),
        Beat("student_stuck", expect="turn", sends=[
            text_msg("[CONTEXT UPDATE] Student has not tapped anything yet; no answer chosen."),
        ], leak_answers=answer_word(ch0),
             note="ORIENT: on a stall, does the tutor restate the choice in child terms? "
                  "(observational — silence here is allowed by quiet-by-default)"),
        Beat("next_item", expect="turn", sends=[next_item],
             must_include=disambiguate_groups(ch1), leak_answers=answer_word(ch1),
             note="DISAMBIGUATE on advance: the next challenge's question must be enacted too"),
    ]
    return {"initial_bag": initial_bag, "beats": beats, "answers": [], "meta": {
        "gradeBand": grade_band, "challenges": len(challenges), "types": types,
        "challenge0": ch0.get("instruction", ""), "challenge0Type": ch0.get("type"),
        "challenge1": ch1.get("instruction", ""), "challenge1Type": ch1.get("type"),
    }}


_STOP_WORDS = {"the", "a", "an", "is", "are", "was", "can", "in", "at", "on", "to",
               "and", "it", "i", "we", "my", "he", "she", "they", "of", "for",
               "has", "have", "with", "this", "that", "his", "her", "did", "do"}


def _content_tokens(text: str) -> List[str]:
    """Lowercased, punctuation-stripped non-stopword tokens of a phrase."""
    out: List[str] = []
    for raw in str(text).split():
        tok = "".join(c for c in raw.lower() if c.isalpha())
        if tok and tok not in _STOP_WORDS:
            out.append(tok)
    return out


def build_decodable_reader_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Reader-fit STIMULUS/ORIENT journey for decodable-reader.

    Two shapes, branched on the generated readingMode:
      • read_along (Kindergarten): replays the [READ_ALONG_START] the component
        sends on mount and checks (must_include) that the tutor READ THE WHOLE
        PASSAGE aloud — the pre-reader can't decode it themselves.
      • decode (Grade 1+): replays [READING_START] then [READING_DONE] and checks
        that the tutor READ THE QUESTION AND EVERY ANSWER CHOICE aloud — the
        comprehension probe is unreadable text for an emerging reader.
    Both are the failure this reader-fit slice fixed; only the lesson-mode run
    (--lesson) exercises the [PRIMITIVE SWITCH]/greeting one-sentence cap the
    read-aloud beats must override.
    """
    data = live.get("generatedData") or {}
    reading_mode = data.get("readingMode") or "decode"
    title = data.get("title", "")
    passage = data.get("passage") or {}
    sentences = passage.get("sentences") or []

    words = [w for s in sentences for w in (s.get("words") or [])]
    total_words = len(words)
    passage_text = " ".join(str(w.get("text", "")) for w in words).strip()
    # content (non-sight) words a genuine word-for-word read must voice
    content_word_groups = [[tok] for w in words
                           if w.get("phonicsPattern") != "sight"
                           for tok in _content_tokens(w.get("text", ""))]

    cq = data.get("comprehensionQuestion") or {}
    question = cq.get("question", "")
    options = cq.get("options") or []
    choices_str = "   ".join(f"{o.get('id')}: {o.get('text')}" for o in options)
    # distinctive token per option — the tutor must voice every choice
    choice_groups: List[List[str]] = []
    for o in options:
        toks = _content_tokens(o.get("text", ""))
        if toks:
            choice_groups.append([toks[-1]])

    initial_bag = {
        "title": title,
        "gradeLevel": data.get("gradeLevel", "K"),
        "readingMode": reading_mode,
        "currentPhase": "reading",
        "totalWords": total_words,
        "wordsTapped": 0,
        "wordsReadIndependently": total_words,
        "phonicsPatternsInPassage": ", ".join(data.get("phonicsPatternsInPassage") or []),
        "passageText": passage_text,
        "comprehensionQuestion": question,
        "comprehensionChoices": choices_str,
        "comprehensionAttempts": 0,
        "comprehensionCorrect": None,
    }

    reading_done = text_msg(
        f'[READING_DONE] The student finished reading "{title}". '
        f'They tapped 0 of {total_words} words for help and read {total_words} independently. '
        f'Now READ the comprehension question aloud, then READ each answer choice aloud with its letter '
        f'(the child cannot read them), then ask which one. '
        f'Question: "{question}". Choices: {choices_str}'
    )

    if reading_mode == "read_along":
        read_along_start = text_msg(
            f'[READ_ALONG_START] The read-along story "{title}" just opened. Read the WHOLE story aloud to the '
            f'student now, clearly and warmly, word for word: "{passage_text}". Then invite them to tap any word '
            f'to hear it again.'
        )
        beats = [
            Beat("greeting", sends=[], expect="turn",
                 note="server auto-queues the standalone/lesson greeting on auth"),
            Beat("read_along_start", expect="turn", sends=[read_along_start],
                 must_include=content_word_groups,
                 note="STIMULUS: a pre-reader needs the WHOLE passage read aloud, word for word"),
            Beat("student_stuck", expect="turn", sends=[
                text_msg("[CONTEXT UPDATE] Student has not tapped anything for a while."),
            ], note="ORIENT: does the tutor gently restate what to do, in child terms?"),
            Beat("comprehension", expect="turn", sends=[reading_done],
                 must_include=choice_groups,
                 note="STIMULUS: the question AND every picture choice must be voiced"),
        ]
    else:
        reading_start = text_msg(
            f'[READING_START] The reading activity "{title}" just opened for the student. '
            f'Warmly welcome them and tell them what to do in ONE short, simple sentence.'
        )
        beats = [
            Beat("greeting", sends=[], expect="turn",
                 note="server auto-queues the greeting on auth"),
            Beat("reading_start", expect="turn", sends=[reading_start],
                 note="ORIENT: warm one-sentence 'here is a story, tap any word' frame"),
            Beat("student_stuck", expect="turn", sends=[
                text_msg("[CONTEXT UPDATE] Student has not tapped anything for a while."),
            ], note="ORIENT: does the tutor restate the task without demanding reading?"),
            Beat("comprehension", expect="turn", sends=[reading_done],
                 must_include=choice_groups,
                 note="STIMULUS: the question AND every answer choice must be read aloud"),
        ]

    return {"initial_bag": initial_bag, "beats": beats, "answers": [], "meta": {
        "readingMode": reading_mode, "totalWords": total_words,
        "passageText": passage_text, "options": len(options),
    }}


def build_cvc_speller_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Reader-fit STIMULUS/ORIENT journey (cvc-speller RF-1). Replays the EXACT
    sendText messages CvcSpeller.tsx emits — [ACTIVITY_START], [SAY_WORD], the
    wrong-attempt hint, and the success message with the spoken-production
    invite — and checks (must_include) that the tutor actually SAYS each target
    word aloud plus an ORIENT line in child terms. The word IS the stimulus for
    a pre-reader: an intro that never says it strands the child exactly like an
    unread story.
    """
    data = live.get("generatedData") or {}
    challenges = data.get("challenges") or []
    ch0 = challenges[0] if challenges else {}
    ch1 = challenges[1] if len(challenges) > 1 else ch0
    total = len(challenges)
    vowel_focus = data.get("vowelFocus", "short-a")
    task_type = ch0.get("taskType", "spell-word")

    vowel_label = {"short-a": "Short A", "short-e": "Short E", "short-i": "Short I",
                   "short-o": "Short O", "short-u": "Short U"}.get(vowel_focus, vowel_focus)
    task_label = {"fill-vowel": "Fill the Vowel", "spell-word": "Spell It",
                  "word-sort": "Sort by Sound"}.get(task_type, task_type)

    # ORIENT oracle: at least one task-shaped word for the mode, spoken.
    orient_group = {
        "spell-word": ["tap", "letter", "box", "check", "spell"],
        "fill-vowel": ["middle", "sound", "hear", "vowel"],
        "word-sort": ["bucket", "sound", "apple", "egg", "itch", "octopus", "up"],
    }.get(task_type, ["sound"])

    def bag_for(ch: Dict[str, Any], idx: int) -> Dict[str, Any]:
        phonemes = ch.get("targetPhonemes") or []
        letters = ch.get("targetLetters") or []
        return {
            "vowelFocus": vowel_focus,
            "letterGroup": data.get("letterGroup", 1),
            "taskType": ch.get("taskType", task_type),
            "targetWord": ch.get("targetWord", ""),
            "targetPhonemes": " ".join(phonemes),
            "targetLetters": ", ".join(letters),
            "placedLetters": "_, _, _",
            "currentChallenge": idx + 1,
            "totalChallenges": total,
            "attempts": 0,
            "firstPhoneme": phonemes[0] if phonemes else "",
            "middlePhoneme": phonemes[1] if len(phonemes) > 1 else "",
            "supportTier": data.get("supportTier", ""),
            "tutorRevealPolicy": "No support tier set — use the default progressive scaffolding.",
        }

    w0 = ch0.get("targetWord", "")
    w1 = ch1.get("targetWord", "")

    # Verbatim replica of the component's [ACTIVITY_START] (post reader-fit fix).
    activity_start = text_msg(
        f"[ACTIVITY_START] This is a CVC spelling activity focusing on {vowel_label}. "
        f"There are {total} challenges. First up: {task_label}. "
        f'Introduce the activity warmly, then say the first word "{w0}" clearly. '
        f"Keep it brief — 2-3 sentences."
    )
    say_word = text_msg(
        f'[SAY_WORD] Say the word "{w1}" clearly. Just the word, said twice with a pause.'
    )
    if task_type == "fill-vowel":
        opts = ch0.get("vowelOptions") or []
        letters = [l.lower() for l in (ch0.get("targetLetters") or ["", "", ""])]
        correct_vowel = letters[1] if len(letters) > 1 else "a"
        wrong_vowel = next((o for o in opts if o.lower() != correct_vowel), "e")
        keywords = {"a": "apple", "e": "egg", "i": "itch", "o": "octopus", "u": "up"}
        wrong_attempt = text_msg(
            f'[FILL_VOWEL_WRONG] Student chose "{wrong_vowel}" but correct is "{correct_vowel}" in "{w0}". '
            f'Attempt 1. Say the word again clearly: "{w0}." '
            f'Ask: "Listen to the middle sound... is it /{wrong_vowel}/ like {keywords.get(wrong_vowel, "")}, '
            f'or /{correct_vowel}/ like {keywords.get(correct_vowel, "")}?"'
        )
        success = text_msg(
            f'[ANSWER_CORRECT] Student correctly picked "{correct_vowel}" for "{w0}"! First try! '
            f'Say the word and emphasize the vowel: "{w0}... yes!" Celebrate briefly. '
            f"Then warmly invite the student to say the whole word out loud themselves."
        )
    else:
        placed = "".join([l.lower() for l in (ch0.get("targetLetters") or [])][:2]) + "x"
        wrong_attempt = text_msg(
            f'[SPELLING_HINT_L1] Student tried "{placed}" for "{w0}". Wrong position: end. '
            f'Attempt 1. Say the word again: "{w0}." Ask about the end sound.'
        )
        success = text_msg(
            f'[SPELLING_CORRECT] Student correctly spelled "{w0}" on the first try! '
            f'Say "You spelled {w0}! Great job!" and say the word. '
            f"Then warmly invite the student to say the whole word out loud themselves."
        )

    beats = [
        Beat("greeting", sends=[], expect="turn",
             note="lesson mode: the server greeting/[PRIMITIVE SWITCH] — the aiDirective "
                  "makes saying the word the greeting itself"),
        Beat("activity_start", expect="turn", sends=[activity_start],
             must_include=[[w0], orient_group],
             note=f'STIMULUS+ORIENT: must SAY "{w0}" and state the task in child terms'),
        Beat("wrong_attempt", expect="turn", sends=[wrong_attempt],
             must_include=[[w0]],
             note="FEEDBACK: spoken hint must re-say the word (eyes-free recovery)"),
        Beat("success_invite", expect="turn", sends=[success],
             must_include=[[w0]],
             note="production beat: celebrate and invite the student to say the word"),
        Beat("next_word", expect="turn", sends=[say_word],
             must_include=[[w1]],
             note=f'STIMULUS on advance: "{w1}" must be said aloud'),
    ]
    return {"initial_bag": bag_for(ch0, 0), "beats": beats, "answers": [], "meta": {
        "taskType": task_type, "vowelFocus": vowel_focus, "challenges": total,
        "word0": w0, "word1": w1,
    }}


def build_word_sorter_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Reader-fit ORIENT + STIMULUS journey. Replays the EXACT [ACTIVITY_START] /
    [WORD_STAGED] / [ANSWER_INCORRECT] / [NEXT_ITEM] messages WordSorter.tsx sends
    in the K pre-reader presentation, then checks (must_include) that the tutor
    (a) names the buckets and asks the sorting question at challenge start —
    the catalog aiDirectives beat, which must survive the lesson one-sentence
    cap — and (b) says each staged word aloud (the child reads with the tutor's
    voice). Leak bar: the correct bucket for the staged word must never be
    ASSERTED (naming all buckets as a question is legitimate scaffolding).
    """
    data = live.get("generatedData") or {}
    challenges = data.get("challenges") or []
    # K routes to sort modes only (match_pairs has a Grade 1+ band floor)
    sorts = [c for c in challenges if c.get("type") in ("binary_sort", "ternary_sort")] or challenges
    ch0 = sorts[0] if sorts else {}
    ch1 = next(iter(sorts[1:]), ch0)
    total = len(challenges)
    grade_key = data.get("gradeLevel", "K")
    topic = data.get("sortingTopic", "")

    buckets0 = ch0.get("bucketLabels") or []
    words0 = ch0.get("words") or []
    w0 = words0[0] if words0 else {}
    w0_word = str(w0.get("word", ""))
    w0_correct = str(w0.get("correctBucket", ""))
    wrong_bucket = next((b for b in buckets0 if b != w0_correct), w0_correct)

    # ORIENT bar: every bucket named + the sort enacted as a spoken question/task.
    def orient_groups(ch: Dict[str, Any]) -> List[List[str]]:
        groups = [[b] for b in (ch.get("bucketLabels") or [])]
        groups.append(["which", "where", "belong", "goes", "sort", "tap", "pick", "put"])
        return groups

    def bag_for(ch: Dict[str, Any], idx: int, selected: str) -> Dict[str, Any]:
        return {
            "challengeType": ch.get("type", ""),
            "instruction": ch.get("instruction", ""),
            "bucketLabels": ch.get("bucketLabels") or [],
            "wordsSorted": 0,
            "totalWords": len(ch.get("words") or ch.get("pairs") or []),
            "attemptNumber": 1,
            "challengeNumber": idx + 1,
            "totalChallenges": total,
            "gradeLevel": grade_key,
            "sortingTopic": topic,
            "selectedWord": selected,
        }

    initial_bag = bag_for(ch0, 0, w0_word)

    # Verbatim replicas of WordSorter.tsx sendText messages (all silent sends).
    activity_start = text_msg(
        f"[ACTIVITY_START] Word Sorter activity for grade {grade_key}. Topic: {topic}. "
        f"{total} challenges. First: \"{ch0.get('instruction','')}\" ({ch0.get('type','')}). "
        f"Follow your SAY THE SORT OUT LOUD FIRST directive now: say the challenge in child terms, "
        f"name each bucket aloud, and ask the sorting question."
    )
    word_staged = text_msg(
        f"[WORD_STAGED] The next word card is on stage: \"{w0_word}\". "
        f"Say just this word aloud clearly for the student. Do not say which bucket it belongs in."
    )
    answer_incorrect = text_msg(
        f"[ANSWER_INCORRECT] Student tried to put \"{w0_word}\" in \"{wrong_bucket}\" but it belongs "
        f"in \"{w0_correct}\". Give a hint without revealing the answer."
    )
    next_item = text_msg(
        f"[NEXT_ITEM] Moving to challenge 2 of {total}: "
        f"\"{ch1.get('instruction','')}\" ({ch1.get('type','')}). "
        f"Follow your SAY THE SORT OUT LOUD FIRST directive for this new challenge."
    )

    beats = [
        Beat("greeting", sends=[], expect="turn",
             note="server auto-queues the greeting on auth (lesson greeting + "
                  "one-sentence cap in --lesson)"),
        Beat("activity_start", expect="turn", sends=[activity_start],
             must_include=orient_groups(ch0),
             note="ORIENT/DISAMBIGUATE: the tutor must name every bucket and ask the "
                  "sorting question — a bare 'let's sort words!' greeting strands a non-reader"),
        Beat("word_staged", expect="turn", sends=[word_staged],
             must_include=[[w0_word]] if w0_word else [],
             leak_answers=[w0_correct],
             note="STIMULUS: the staged word must be SAID (the child cannot read the card); "
                  "its correct bucket must not be asserted"),
        Beat("wrong_bucket", expect="turn", sends=[answer_incorrect],
             leak_answers=[w0_correct],
             note="RECOVER: eyes-free hint without asserting the correct bucket"),
        Beat("next_item", expect="turn", sends=[next_item],
             must_include=orient_groups(ch1),
             note="ORIENT on advance: the next challenge's buckets + question must be enacted too"),
    ]
    return {"initial_bag": initial_bag, "beats": beats, "answers": [w0_correct], "meta": {
        "gradeLevel": grade_key, "challenges": total,
        "challenge0": ch0.get("instruction", ""), "buckets0": buckets0,
        "stagedWord": w0_word, "challenge1": ch1.get("instruction", ""),
    }}


def build_poetry_lab_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Audio-first rhyme_hunt journey. The poem itself legitimately contains
    every candidate word, including the answer pair, so stimulus beats assert
    that all four endings are spoken but do not run the answer-leak oracle.
    Recovery and celebration beats DO forbid the answer pair: those turns must
    stretch only the tapped words or celebrate without naming the solution.
    """
    data = live.get("generatedData") or {}
    rounds = data.get("rounds") or []
    r0 = rounds[0] if rounds else {}
    r1 = rounds[1] if len(rounds) > 1 else r0
    total = len(rounds)

    def words(round_data: Dict[str, Any]) -> List[str]:
        return [str(c.get("word", "")) for c in (round_data.get("candidates") or []) if c.get("word")]

    def answer(round_data: Dict[str, Any]) -> List[str]:
        return [str(round_data.get("rhymeWordA", "")), str(round_data.get("rhymeWordB", ""))]

    def bag_for(round_data: Dict[str, Any], idx: int, attempts: int = 0) -> Dict[str, Any]:
        return {
            "title": data.get("title", "Rhyme Hunt"),
            "gradeLevel": data.get("gradeLevel", "K"),
            "mode": "rhyme_hunt",
            "currentRound": idx + 1,
            "roundsTotal": total,
            "roundPoem": "\n".join(round_data.get("poemLines") or []),
            "candidateWords": ", ".join(words(round_data)),
            "rhymeWordA": round_data.get("rhymeWordA", ""),
            "rhymeWordB": round_data.get("rhymeWordB", ""),
            "attempts": attempts,
            "firstTryCorrect": 0,
        }

    candidates0 = words(r0)
    answer0 = set(answer(r0))
    wrong = [word for word in candidates0 if word not in answer0]
    if len(wrong) < 2:
        wrong = candidates0[:2]

    activity_start = text_msg(
        f'[ACTIVITY_START] Round 1 of {total}. Frame this once: "We\'re going to listen to a little poem and find the two words that rhyme." '
        f'Read this poem aloud slowly and with playful prosody, emphasizing every line-ending word equally: '
        f'"{" / ".join(r0.get("poemLines") or [])}" Then say only: "Tap the two words that rhyme." '
        f'Never name, repeat as a pair, or otherwise reveal the answer words.'
    )
    miss = text_msg(
        f'[RHYME_MISS] The student tapped "{wrong[0] if wrong else ""}" and "{wrong[1] if len(wrong) > 1 else ""}" on attempt 1. '
        f'Stretch those two endings slowly and ask whether they sound the same. Do not name or hint another candidate.'
    )
    round_start = text_msg(
        f'[ROUND_START] Round 2 of {total}. Read this poem aloud slowly and with playful prosody, emphasizing every line-ending word equally: '
        f'"{" / ".join(r1.get("poemLines") or [])}" Then say only: "Tap the two words that rhyme." '
        f'Never name, repeat as a pair, or otherwise reveal the answer words.'
    )
    correct = text_msg(
        '[RHYME_CORRECT] The student found the rhyming pair after a comeback. '
        'Celebrate in one brief sentence without saying either answer word.'
    )
    complete = text_msg(
        f'[ACTIVITY_COMPLETE] [RHYME_CORRECT] The final rhyme pair was found. 2 of {total} rounds were correct on the first try. '
        f'Give one short, joyful closing celebration without naming any answer pair.'
    )

    beats = [
        Beat("greeting", sends=[], expect="turn"),
        Beat("activity_start", sends=[activity_start], expect="turn",
             must_include=[[word] for word in words(r0)],
             note="ORIENT+STIMULUS: frame once and read every line ending aloud"),
        Beat("rhyme_miss", sends=[ctx_msg(bag_for(r0, 0, 1)), miss], expect="turn",
             must_include=[[word] for word in wrong[:2]], leak_answers=answer(r0),
             note="RECOVER: stretch only the tapped words; do not disclose the pair"),
        Beat("round_start", sends=[ctx_msg(bag_for(r1, 1)), round_start], expect="turn",
             must_include=[[word] for word in words(r1)],
             note="STIMULUS on advance: read the next poem, one tutor turn"),
        Beat("rhyme_correct", sends=[correct], expect="turn", leak_answers=answer(r1),
             note="quiet celebration without repeating the answer pair"),
        Beat("activity_complete", sends=[complete], expect="turn", leak_answers=answer(r1),
             note="one-sentence closing celebration"),
    ]
    return {"initial_bag": bag_for(r0, 0), "beats": beats, "answers": [], "meta": {
        "mode": data.get("mode", ""), "rounds": total,
        "round0": r0.get("poemLines") or [], "round1": r1.get("poemLines") or [],
    }}


def build_letter_sound_link_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Reader-fit ORIENT + STIMULUS + production journey (letter-sound-link RF-1/RF-2).

    Replays the EXACT sendText messages LetterSoundLink.tsx emits — [ACTIVITY_START],
    [ANSWER_CORRECT], [NEXT_CHALLENGE] — and checks (must_include) that the catalog
    HOW-TO-PLAY aiDirective actually makes the tutor:
      (a) voice the audition-then-commit PROTOCOL in child terms at challenge start —
          the pre-reader who can't read "tap to hear/choose" needs it SPOKEN, and the
          beat must survive the lesson one-sentence cap (the whole point of the
          durable aiDirective carrier);
      (b) say the anchor KEYWORD aloud (the stimulus for a non-reader — /s/ is
          hard to transcribe, "sun" is not);
      (c) invite the child to SAY the keyword after a correct answer (THEIR TURN beat).
    No leak bar: this primitive's "answer" IS the letter→sound correspondence, which
    the tutor legitimately teaches; bubble/letter POSITION is randomized and never in
    the scaffold, so there is nothing positional to leak.
    """
    data = live.get("generatedData") or {}
    challenges = data.get("challenges") or []
    ch0 = challenges[0] if challenges else {}
    ch1 = challenges[1] if len(challenges) > 1 else ch0
    total = len(challenges) or 1
    letter_group = data.get("letterGroup", 1)
    cumulative = data.get("cumulativeLetters") or []

    mode_label = {
        "see-hear": "See a letter, pick its sound",
        "hear-see": "Hear a sound, find the letter",
        "keyword-match": "Match letter to keyword",
    }

    # ORIENT bar: the tutor must voice an ACTION the child can take (the how-to-play),
    # not just a warm "let's learn sounds!" A tap/listen verb is the protocol enacted.
    action_group = ["tap", "touch", "press", "find", "pick", "choose", "listen", "hear"]

    def kw(ch: Dict[str, Any]) -> str:
        return str(ch.get("keywordWord", "")).strip()

    def bag_for(ch: Dict[str, Any], idx: int) -> Dict[str, Any]:
        shared = ch.get("sharedSoundLetters") or []
        return {
            "letterGroup": letter_group,
            "challengeMode": ch.get("mode", ""),
            "targetLetter": ch.get("targetLetter", ""),
            "targetSound": ch.get("targetSound", ""),
            "keywordWord": ch.get("keywordWord", ""),
            "sharedSoundLetters": ", ".join(shared),
            "currentChallenge": idx + 1,
            "totalChallenges": total,
            "attempts": 0,
        }

    x0 = str(ch0.get("targetLetter", "")).upper()
    s0 = str(ch0.get("targetSound", ""))
    kw0 = kw(ch0)
    x1 = str(ch1.get("targetLetter", "")).upper()
    s1 = str(ch1.get("targetSound", ""))
    kw1 = kw(ch1)

    # Verbatim replicas of LetterSoundLink.tsx sendText messages (all silent sends).
    activity_start = text_msg(
        f"[ACTIVITY_START] Letter-sound correspondence activity for Group {letter_group} "
        f"(letters: {', '.join(cumulative)}). "
        f"There are {total} challenges. "
        f"Introduce the activity warmly — we're learning the SOUNDS that letters make! "
        f'First challenge: "{x0}" makes the sound {s0}. '
        f"[SAY_KEYWORD] {s0} as in {kw0}. "
        f"Keep it brief — 2-3 sentences."
    )
    answer_correct = text_msg(
        f"[ANSWER_CORRECT] The student correctly identified the letter-sound link! "
        f'Letter "{x0}" → sound {s0}. First try! '
        f"[PRONOUNCE_SOUND] {s0}. "
        f'Say "Yes! The letter {x0} makes the sound {s0}!"'
    )
    next_challenge = text_msg(
        f"[NEXT_CHALLENGE] Challenge 2 of {total}: {mode_label.get(ch1.get('mode', ''), ch1.get('mode', ''))}. "
        f'Target: letter "{x1}" → sound {s1}. '
        f"[SAY_KEYWORD] {s1} as in {kw1}. "
        f"Briefly introduce the new challenge."
    )

    beats = [
        Beat("greeting", sends=[], expect="turn",
             note="lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies"),
        Beat("activity_start", expect="turn", sends=[activity_start],
             must_include=[[kw0], action_group] if kw0 else [action_group],
             note="ORIENT+STIMULUS: the HOW-TO-PLAY directive must voice a tap/listen action "
                  "(the protocol a non-reader can't read) AND say the keyword aloud"),
        Beat("answer_correct", expect="turn", sends=[answer_correct],
             must_include=[[kw0]] if kw0 else [],
             note="production beat: after celebrating, invite the child to say the keyword "
                  '(THEIR TURN directive — "Now YOU say {keyword}")'),
        Beat("next_challenge", expect="turn", sends=[ctx_msg(bag_for(ch1, 1)), next_challenge],
             must_include=[[kw1], action_group] if kw1 else [action_group],
             note="ORIENT on advance: the how-to-play protocol + keyword must be enacted for the "
                  "next challenge too (survives the one-sentence cap)"),
    ]
    return {"initial_bag": bag_for(ch0, 0), "beats": beats, "answers": [], "meta": {
        "letterGroup": letter_group, "challenges": total,
        "mode0": ch0.get("mode", ""), "letter0": x0, "sound0": s0, "keyword0": kw0,
        "mode1": ch1.get("mode", ""), "letter1": x1, "keyword1": kw1,
    }}


def build_knowledge_check_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Reader-fit STIMULUS journey for knowledge-check @ PRE.

    knowledge-check is a container that renders per-type problem primitives; at K
    the generator floors it to a picture-primary MCQ and MultipleChoiceProblem
    (preReader) auto-fires a NON-silent [QUIZ_READ_ALOUD] on first view. This
    journey replays that exact message and checks (must_include) that the tutor
    actually READ THE QUESTION AND EVERY CHOICE ALOUD — the census failure was
    text-word options a non-reader can neither read nor hear. Runs in --lesson
    mode so the [PRIMITIVE SWITCH]/greeting one-sentence cap is exercised (the
    catalog PRE-READER READ-ALOUD directive must override it).

    Reading every option — including the correct one — is REQUIRED here, so there
    is no leak check on the read-aloud beat (a leak is asserting "the answer is X",
    which the answer-free directive forbids; naming all choices is the task).
    """
    data = live.get("generatedData") or {}
    problems = data.get("problems") or []

    def first_mcq() -> Dict[str, Any]:
        return next((p for p in problems if p.get("type") == "multiple_choice"),
                    problems[0] if problems else {})

    p0 = first_mcq()
    question = str(p0.get("question", ""))
    options = p0.get("options") or []

    def opt_label(i: int) -> str:
        return chr(65 + i)

    # The verbatim [QUIZ_READ_ALOUD] MultipleChoiceProblem.tsx sends at PRE.
    choices_str = "; ".join(
        f"{str(o.get('id') or opt_label(i))}) {str(o.get('text',''))}"
        for i, o in enumerate(options)
    )
    read_aloud = text_msg(
        "[QUIZ_READ_ALOUD] A pre-reader is on this question and cannot read it. "
        "Read the question aloud word for word, then each choice slowly with its "
        "letter, then ask which one they pick. "
        f'Question: "{question}". Choices: {choices_str}.'
    )

    # STIMULUS groups: every option's spoken form must appear (the core gap), plus
    # at least one content word from the question. Option groups accept the label
    # text and, for numeric options, the number word ("two" for "2 cars").
    def opt_group(o: Dict[str, Any]) -> List[str]:
        txt = str(o.get("text", "")).strip()
        toks = _content_tokens(txt)
        variants = [txt.lower()] + toks
        for t in txt.split():
            variants.extend(_num_variants(t))
        return [v for v in dict.fromkeys(variants) if v]

    opt_groups = [g for g in (opt_group(o) for o in options) if g]
    q_tokens = _content_tokens(question)
    q_group = [q_tokens] if q_tokens else []

    beats = [
        Beat("greeting", sends=[], expect="turn",
             note="server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)"),
        Beat("problem_read_aloud", expect="turn", sends=[read_aloud],
             must_include=opt_groups + q_group,
             note="STIMULUS: a non-reader needs the QUESTION and EVERY choice read "
                  "aloud here — text-word options are the census failure this fixes"),
        Beat("student_stuck", expect="turn", sends=[
            text_msg("[CONTEXT UPDATE] Student has not tapped a picture yet; no answer chosen."),
        ], note="ORIENT: on a stall, does the tutor restate the choices in child terms? "
                "(observational — silence allowed by quiet-by-default)"),
    ]
    return {"initial_bag": {
        "problemCount": len(problems),
        "currentProblemIndex": 0,
        "currentProblemType": p0.get("type", "multiple_choice"),
        "currentQuestion": question,
        "attemptNumber": 1,
        "completedCount": 0,
        "correctCount": 0,
    }, "beats": beats, "answers": [], "meta": {
        "problems": len(problems),
        "question0": question,
        "options0": [str(o.get("text", "")) for o in options],
    }}


def build_sorting_station_journey(live: Dict[str, Any], grade: str) -> Dict[str, Any]:
    """Reader-fit ORIENT/DISAMBIGUATE journey for sorting-station @ K (sort_one).
    Replays the EXACT [ACTIVITY_START] / [NEXT_ITEM] messages SortingStation.tsx
    sends, then checks (must_include) that at each challenge start the tutor NAMES
    every bin aloud and asks the sorting question — the catalog aiDirectives beat
    ("SAY THE SORT OUT LOUD AND NAME EVERY BIN FIRST") which must survive the lesson
    one-sentence cap. Objects are emoji-primary (not text), so unlike word-sorter
    there is no per-object read-aloud STIMULUS beat; the load-bearing text a
    pre-reader cannot decode is the RULE + the bin labels, both carried here.
    Leak stance: naming every bin as a spoken choice is legitimate scaffolding, so
    the ORIENT beats do not run the answer-leak oracle (there is no single staged
    object whose correct bin could be asserted).
    """
    data = live.get("generatedData") or {}
    challenges = data.get("challenges") or []
    # K routes to sort_one / odd_one_out; this journey pins the sort_one census route.
    sorts = [c for c in challenges if c.get("type") == "sort-by-one"] or challenges
    ch0 = sorts[0] if sorts else {}
    ch1 = next(iter(sorts[1:]), ch0)
    total = len(challenges)
    grade_band = data.get("gradeBand", "K")

    def bins(ch: Dict[str, Any]) -> List[str]:
        return [str(c.get("label", "")) for c in (ch.get("categories") or []) if c.get("label")]

    def objects_str(ch: Dict[str, Any]) -> str:
        return ", ".join(f"{o.get('emoji','')} {o.get('label','')}" for o in (ch.get("objects") or []))

    # ORIENT bar: every bin named + the sort enacted as a spoken question/action.
    def orient_groups(ch: Dict[str, Any]) -> List[List[str]]:
        groups = [[b] for b in bins(ch)]
        groups.append(["which", "where", "belong", "goes", "go", "sort", "tap", "pick", "put"])
        return groups

    def bag_for(ch: Dict[str, Any], idx: int) -> Dict[str, Any]:
        return {
            "challengeType": ch.get("type", ""),
            "instruction": ch.get("instruction", ""),
            "sortingAttribute": ch.get("sortingAttribute", "category"),
            "categories": bins(ch),
            "objectsSorted": 0,
            "totalObjects": len(ch.get("objects") or []),
            "attemptNumber": 1,
            "currentChallengeIndex": idx,
            "totalChallenges": total,
            "gradeBand": grade_band,
        }

    initial_bag = bag_for(ch0, 0)
    band_word = "Kindergarten" if grade_band == "K" else "Grade 1"

    # Verbatim replicas of SortingStation.tsx sendText messages (all silent sends).
    activity_start = text_msg(
        f"[ACTIVITY_START] This is a Sorting Station activity for {band_word}. "
        f"{total} challenges total. First challenge: \"{ch0.get('instruction','')}\" ({ch0.get('type','')}). "
        f"Objects: {objects_str(ch0)}. "
        f"Introduce warmly: \"Look at all these things! Let's sort them together.\" "
        f"Follow your SAY THE SORT OUT LOUD AND NAME EVERY BIN directive now."
    )
    next_item = text_msg(
        f"[NEXT_ITEM] Moving to challenge 2 of {total}: "
        f"\"{ch1.get('instruction','')}\" (type: {ch1.get('type','')}). Introduce it briefly. "
        f"Follow your SAY THE SORT OUT LOUD AND NAME EVERY BIN directive for this new challenge."
    )

    beats = [
        Beat("greeting", sends=[], expect="turn",
             note="server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)"),
        Beat("activity_start", expect="turn", sends=[activity_start],
             must_include=orient_groups(ch0),
             note="ORIENT/DISAMBIGUATE: the tutor must name every bin and ask the sorting "
                  "question — a bare 'let's sort!' greeting strands a non-reader who cannot "
                  "read the rule or the bin labels"),
        Beat("next_item", expect="turn", sends=[next_item],
             must_include=orient_groups(ch1),
             note="ORIENT on advance: the next challenge's bins + question must be enacted too"),
    ]
    return {"initial_bag": initial_bag, "beats": beats, "answers": [], "meta": {
        "gradeBand": grade_band, "challenges": total,
        "challenge0": ch0.get("instruction", ""), "bins0": bins(ch0),
        "challenge1": ch1.get("instruction", ""), "bins1": bins(ch1),
    }}


JOURNEYS = {
    "states-of-matter": build_states_of_matter_journey,
    "sorting-station": build_sorting_station_journey,
    "addition-subtraction-scene": build_addition_subtraction_scene_journey,
    "comparison-builder": build_comparison_builder_journey,
    "decodable-reader": build_decodable_reader_journey,
    "cvc-speller": build_cvc_speller_journey,
    "word-sorter": build_word_sorter_journey,
    "poetry-lab": build_poetry_lab_journey,
    "letter-sound-link": build_letter_sound_link_journey,
    "knowledge-check": build_knowledge_check_journey,
}


# ---------------------------------------------------------------------------
# Headless WS student
# ---------------------------------------------------------------------------

class LiveTutorClient:
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self.events: List[str] = []           # every inbound message type, in order
        self.transcript_buf: List[str] = []
        self.ai_text_buf: List[str] = []
        self.audio_bytes = 0
        self.turn_end = asyncio.Event()
        self.last_chunk = 0.0                 # monotonic time of last transcript/audio chunk
        self.fatal: Optional[str] = None

    async def _reader(self, ws):
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except (ValueError, TypeError):
                    continue
                t = msg.get("type", "?")
                self.events.append(t)
                if t == "ai_transcription":
                    self.transcript_buf.append(msg.get("content", ""))
                    self.last_chunk = time.monotonic()
                elif t == "ai_response":
                    self.ai_text_buf.append(msg.get("content", ""))
                    self.last_chunk = time.monotonic()
                elif t == "ai_audio":
                    self.audio_bytes += len(msg.get("data", ""))
                    self.last_chunk = time.monotonic()
                elif t == "ai_turn_end":
                    self.turn_end.set()
                elif t == "error":
                    self.fatal = msg.get("message", "backend error")
        except websockets.ConnectionClosed:
            pass

    def _snapshot(self) -> Dict[str, Any]:
        snap = {
            "transcript": "".join(self.transcript_buf).strip(),
            "ai_text": " ".join(self.ai_text_buf).strip(),
            "audio_bytes": self.audio_bytes,
        }
        self.transcript_buf, self.ai_text_buf, self.audio_bytes = [], [], 0
        return snap

    async def run(self, auth_msg: Dict[str, Any], beats: List[Beat],
                  turn_timeout: float = TURN_TIMEOUT) -> List[BeatResult]:
        results: List[BeatResult] = []
        async with websockets.connect(self.ws_url, max_size=None) as ws:
            await ws.send(json.dumps(auth_msg))
            reader = asyncio.create_task(self._reader(ws))
            try:
                for beat in beats:
                    started = time.monotonic()
                    self.turn_end.clear()
                    # Anything still in the buffers belongs to the PREVIOUS beat's
                    # turn (transcript chunks trail ai_turn_end) — credit it back
                    # rather than dropping it or bleeding it into this beat.
                    leftover = self._snapshot()
                    if results and leftover["transcript"]:
                        results[-1].transcript = (results[-1].transcript + leftover["transcript"]).strip()
                    for m in beat.sends:
                        await ws.send(json.dumps(m))
                        await asyncio.sleep(0.3)

                    ended = False
                    if beat.expect == "silence":
                        await asyncio.sleep(SILENCE_WINDOW)
                    else:
                        # A turn only counts as ended once THIS beat has content:
                        # a previous beat's turn can finish late and fire a stale
                        # ai_turn_end right after we start waiting.
                        deadline = time.monotonic() + turn_timeout
                        while time.monotonic() < deadline:
                            try:
                                await asyncio.wait_for(self.turn_end.wait(), deadline - time.monotonic())
                            except asyncio.TimeoutError:
                                break
                            self.turn_end.clear()
                            if self.transcript_buf or self.ai_text_buf or self.audio_bytes:
                                ended = True
                                break
                    # Quiescence drain: ai_turn_end can arrive while transcript/
                    # audio chunks are still streaming (and a "silence" beat may
                    # have provoked speech). Wait until the stream has been quiet
                    # for DRAIN_GRACE (bounded), so each beat's words stay
                    # attributed to that beat.
                    if self.transcript_buf or self.ai_text_buf or self.audio_bytes:
                        drain_deadline = time.monotonic() + 20.0
                        while time.monotonic() < drain_deadline:
                            if time.monotonic() - self.last_chunk >= DRAIN_GRACE:
                                break
                            await asyncio.sleep(0.25)

                    snap = self._snapshot()
                    results.append(BeatResult(
                        beat=beat,
                        transcript=snap["transcript"],
                        ai_text=snap["ai_text"],
                        turn_ended=ended,
                        audio_bytes=snap["audio_bytes"],
                        elapsed=time.monotonic() - started,
                    ))
                    label = beat.name.ljust(24)
                    spoken = snap["transcript"] or snap["ai_text"]
                    preview = (spoken[:90] + "…") if len(spoken) > 90 else spoken
                    print(f"  [{label}] {'spoke' if spoken else 'silent'}"
                          f" ({snap['audio_bytes']} b64 audio bytes) {preview}")
                    if self.fatal:
                        print(f"  !! backend error: {self.fatal}")
                        break
            finally:
                reader.cancel()
        return results


# ---------------------------------------------------------------------------
# Oracles — code-judged checks over the per-beat transcripts.
#
# Failure-mode families covered here (the code-orable subset of the taxonomy in
# the /tutor-test skill; laundered leaks / elicit-vs-tell / specificity need an
# LLM judge and are NOT attempted in code):
#   floor control — quiet-by-default, question stacking, interrogation cadence
#   grounding     — indirection ("the challenge asks…"), stale-state assertions
#   pedagogy      — verbatim answer leak (current challenge), praise inflation
#   compliance    — tag syntax spoken aloud, "(not set)" spoken
# ---------------------------------------------------------------------------

def _norm(s: str) -> str:
    # Gemini transcription occasionally inserts Markdown emphasis *inside* a
    # stretched word (``do**g**``). Strip markup characters before replacing
    # punctuation so the stimulus oracle still sees the spoken word as "dog".
    without_markup = s.lower().replace("*", "").replace("_", "").replace("`", "")
    return re.sub(r"[^a-z0-9 ]+", " ", without_markup).strip()


# "look at the exhibit and answer the question" — narrating the UI instead of
# enacting the question. Direct enactment never needs these phrases.
INDIRECTION_RE = re.compile(
    r"\b(?:look at|read|answer|complete|go to)\s+the\s+(?:question|exhibit|activity|challenge|prompt|problem)\b"
    r"|\bthe\s+(?:question|challenge|activity|exhibit|prompt)\s+(?:asks|says|wants|is asking)\b",
    re.I,
)

# Praise-inflation proxy: superlatives + person-praise ("you are a keen observer").
# Rate metric, not per-hit finding — some celebration is scripted and fine.
SUPERLATIVE_RE = re.compile(
    r"\b(?:amazing|brilliant|incredible|awesome|fantastic|perfect|genius|superb|outstanding|magnificent|master)\b"
    r"|\byou(?:'re| are)\s+(?:a|an|such a|so)\s+\w+",
    re.I,
)

# "right now it's a liquid" — an assertion of CURRENT state the harness can
# check against the state it drove. Comparisons ("like a solid") don't match.
STATE_ASSERT_RE = re.compile(
    r"\b(?:right now|currently|now)\b[^.?!]{0,40}?\bit(?:'s| is)\s+(?:a |an )?(solid|liquid|gas)\b", re.I,
)

# Allow spaces inside the tag: the lesson path's "[PRIMITIVE SWITCH]" was spoken
# aloud in a cvc-speller lesson run and the space kept this regex from firing.
TAG_SYNTAX_RE = re.compile(r"\[(?:[A-Z][A-Z0-9_ ]{2,})\]|\bcontext update\b|\bstudent action\b|\bprimitive switch\b", re.I)


def run_oracles(results: List[BeatResult], events: List[str]) -> List[Dict[str, str]]:
    """Per-run findings. Every finding carries `beat` so multi-run aggregation
    can rate-score by (check, beat)."""
    findings: List[Dict[str, str]] = []

    def add(severity: str, check: str, beat: str, detail: str) -> None:
        findings.append({"severity": severity, "check": check, "beat": beat, "detail": detail})

    if "auth_success" not in events:
        add("HIGH", "no-auth", "*", "auth_success never received")
    if "ai_transcription" not in events:
        add("HIGH", "no-output-transcription", "*",
            "no ai_transcription messages — enable output_audio_transcription in build_gemini_config (lumina_tutor.py)")

    for r in results:
        spoken = r.transcript or r.ai_text
        b = r.beat.name
        if "(not set)" in spoken:
            add("HIGH", "not-set-spoken", b, 'tutor spoke a literal "(not set)"')
        if r.beat.expect == "silence" and spoken:
            add("WARN", "quiet-by-default-violation", b,
                f"tutor spoke on pure context updates (no trigger): \"{spoken[:120]}\"")
        if r.beat.expect == "turn" and not spoken:
            add("WARN", "silent-turn", b, "tutor produced no speech for this beat")
        if r.beat.must_include and spoken:
            ns = _norm(spoken)
            missing = [grp for grp in r.beat.must_include
                       if not any(_norm(v) in ns for v in grp)]
            if missing:
                add("HIGH", "stimulus-not-read", b,
                    f"tutor did not voice load-bearing content — missing "
                    f"{['/'.join(g) for g in missing]}: \"{spoken[:180]}\"")
        for ans in r.beat.leak_answers:
            na = _norm(ans)
            if len(na) < 3:
                continue
            # Only ASSERTIVE mentions are leaks. For closed-set answers (solid/
            # liquid/gas) the tutor re-presenting the options inside a question
            # ("Does that sound like a solid, liquid, or gas?") is legitimate
            # scaffolding — so the answer word only counts when it appears in a
            # sentence that is not a question. Laundered leaks ("starts with L…")
            # are the LLM judge's job, not this oracle's.
            assertive = [s for s in re.split(r"(?<=[.?!])\s+", spoken)
                         if s and not s.rstrip().endswith("?") and na in _norm(s)]
            if assertive:
                add("HIGH", "answer-leak-live", b,
                    f'tutor asserted the current challenge\'s answer "{ans}": "{assertive[0][:180]}" '
                    f'(full utterance: "{spoken[:180]}")')
        m = INDIRECTION_RE.search(spoken)
        if m:
            add("WARN", "indirect-utterance", b,
                f'narrates the UI instead of enacting the question ("{m.group(0)}"): "{spoken[:160]}"')
        if TAG_SYNTAX_RE.search(spoken):
            add("HIGH", "tag-syntax-spoken", b,
                f'tutor read system-message syntax aloud: "{spoken[:160]}"')
        if r.beat.state:
            sm = STATE_ASSERT_RE.search(spoken)
            if sm and sm.group(1).lower() != r.beat.state:
                add("WARN", "stale-state-utterance", b,
                    f'asserted the state is "{sm.group(1)}" but the driven state is "{r.beat.state}": "{spoken[:160]}"')

    # ---- Session-level style metrics (floor control / pedagogy) ---------------
    speaking = [(r.beat.name, (r.transcript or r.ai_text)) for r in results
                if r.beat.expect == "turn" and (r.transcript or r.ai_text)]
    if speaking:
        n = len(speaking)
        q_end = sum(1 for _, s in speaking if s.rstrip().endswith("?"))
        q_stacked = sum(1 for _, s in speaking if s.count("?") >= 2)
        superlatives = sum(len(SUPERLATIVE_RE.findall(s)) for _, s in speaking)
        words = sum(len(s.split()) for _, s in speaking)
        metrics = {
            "speaking_turns": n,
            "avg_words_per_turn": round(words / n, 1),
            "ends_with_question_rate": round(q_end / n, 2),
            "stacked_question_rate": round(q_stacked / n, 2),
            "superlatives_per_turn": round(superlatives / n, 2),
        }
        findings.append({"severity": "INFO", "check": "style-metrics", "beat": "*",
                         "detail": json.dumps(metrics)})
        if n >= 5 and q_end / n > 0.8:
            add("WARN", "interrogation-cadence", "*",
                f"{q_end}/{n} speaking turns end with a question — every action gets interrogated; "
                f"quiet-by-default says most moments need no follow-up question")
        if q_stacked / n > 0.5:
            add("WARN", "question-stacking", "*",
                f"{q_stacked}/{n} turns ask 2+ questions in one breath")
        if superlatives / n > 0.75:
            add("WARN", "praise-inflation", "*",
                f"{superlatives} superlatives/person-praise across {n} turns — praise the strategy, "
                f"not the student, and save celebration for milestones")
    return findings


# ---------------------------------------------------------------------------
# Multi-run aggregation + report
#
# Sessions are nondeterministic, so a single occurrence is a NOTE; a finding is
# CONFIRMED only when it reproduces in >= 2/3 of runs. Content is generated once
# and held constant across runs so only the tutor's behavior varies.
# ---------------------------------------------------------------------------

def aggregate_findings(per_run: List[List[Dict[str, str]]]) -> List[Dict[str, Any]]:
    runs = len(per_run)
    hits: Dict[Any, Dict[str, Any]] = {}
    for run_findings in per_run:
        seen = set()
        for f in run_findings:
            if f["check"] == "style-metrics":
                continue
            key = (f["severity"], f["check"], f["beat"])
            if key in seen:
                continue
            seen.add(key)
            entry = hits.setdefault(key, {"severity": f["severity"], "check": f["check"],
                                          "beat": f["beat"], "count": 0, "detail": f["detail"]})
            entry["count"] += 1
            entry["detail"] = f["detail"]  # keep the latest example
    out = []
    for entry in hits.values():
        entry["rate"] = f"{entry['count']}/{runs}"
        entry["confirmed"] = runs == 1 or entry["count"] * 3 >= runs * 2
        out.append(entry)
    sev_rank = {"HIGH": 0, "WARN": 1, "INFO": 2}
    out.sort(key=lambda e: (not e["confirmed"], sev_rank.get(e["severity"], 3), -e["count"]))
    return out


def average_style_metrics(per_run: List[List[Dict[str, str]]]) -> Optional[Dict[str, float]]:
    dicts = []
    for run_findings in per_run:
        for f in run_findings:
            if f["check"] == "style-metrics":
                dicts.append(json.loads(f["detail"]))
    if not dicts:
        return None
    keys = dicts[0].keys()
    return {k: round(sum(d[k] for d in dicts) / len(dicts), 2) for k in keys}


def write_report(path: str, component_id: str, journey: Dict[str, Any],
                 run_results: List[List[BeatResult]], aggregated: List[Dict[str, Any]],
                 style: Optional[Dict[str, float]], events: List[str]) -> None:
    runs = len(run_results)
    confirmed_high = [f for f in aggregated if f["confirmed"] and f["severity"] == "HIGH"]
    confirmed_warn = [f for f in aggregated if f["confirmed"] and f["severity"] == "WARN"]
    noted = [f for f in aggregated if not f["confirmed"]]

    lines = [
        f"# Tier-3 Live Tutor Report — {component_id} — {date.today().isoformat()}",
        "",
        f"Headless synthetic student drove {runs} real Gemini Live session(s) over the same",
        "generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).",
        f"A finding is CONFIRMED at ≥2/3 of runs{'' if runs > 1 else ' (single run: everything counts)'}.",
        "",
        f"- Journey meta: `{json.dumps(journey.get('meta', {}))}`",
        f"- Message types seen: `{sorted(set(events))}`",
        "",
        "## Verdict",
        "",
    ]
    if not aggregated:
        lines.append("**PASS** — no findings.")
    else:
        verdict = "FAIL" if confirmed_high else ("PASS with warnings" if confirmed_warn else "PASS")
        lines.append(f"**{verdict}** — {len(confirmed_high)} HIGH + {len(confirmed_warn)} WARN confirmed, "
                     f"{len(noted)} single-run note(s).")
    if style:
        lines += ["", "## Style metrics (avg across runs)", "",
                  "| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |",
                  "|---|---|---|---|---|",
                  f"| {style['speaking_turns']} | {style['avg_words_per_turn']} | "
                  f"{style['ends_with_question_rate']} | {style['stacked_question_rate']} | "
                  f"{style['superlatives_per_turn']} |"]
    lines += ["", "## Findings", ""]
    if aggregated:
        lines += ["| Status | Severity | Check | Beat | Rate | Example |", "|---|---|---|---|---|---|"]
        for f in aggregated:
            status = "CONFIRMED" if f["confirmed"] else "note"
            lines.append(f"| {status} | {f['severity']} | `{f['check']}` | {f['beat']} | {f['rate']} | {f['detail']} |")
    else:
        lines.append("None.")
    for i, results in enumerate(run_results, 1):
        lines += ["", f"## Run {i} — beat-by-beat transcript", ""]
        for r in results:
            spoken = r.transcript or r.ai_text or "*(silent)*"
            lines += [
                f"### {r.beat.name}",
                f"*expect: {r.beat.expect} · turn_ended: {r.turn_ended} · {r.elapsed:.1f}s"
                f" · audio: {r.audio_bytes} b64 bytes*",
            ]
            if r.beat.note:
                lines.append(f"*note: {r.beat.note}*")
            lines += ["", f"> {spoken}", ""]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def amain() -> int:
    ap = argparse.ArgumentParser(description="Tier-3 live tutor harness")
    ap.add_argument("--component", default="states-of-matter")
    ap.add_argument("--plumbing", action="store_true", help="connect + greeting only")
    ap.add_argument("--runs", type=int, default=1,
                    help="sessions to run over the SAME content; findings rate-scored, confirmed at >=2/3")
    ap.add_argument("--topic", default="states of matter and phase changes")
    ap.add_argument("--grade", default="Grade 3")
    ap.add_argument("--eval-mode", default=None,
                    help="pin the generated challenge type (default = catalog evalModes[0])")
    ap.add_argument("--frontend", default="http://localhost:3000")
    ap.add_argument("--backend-ws", default="ws://localhost:8000/api/lumina-tutor")
    ap.add_argument("--lesson", action="store_true",
                    help="drive LESSON mode (session_mode=lesson) — reproduces the "
                         "lesson greeting / [PRIMITIVE SWITCH] path where the tutor is "
                         "told to keep transitions to one sentence")
    args = ap.parse_args()

    print(f"[1/4] Firebase sign-in…")
    token = get_id_token()

    print(f"[2/4] Generating real content + fetching tutoring block (probe&live)…")
    live = fetch_live_context(args.frontend, args.component, args.topic, args.grade, args.eval_mode)
    print(f"      tier-1 status: {live.get('status')}; scaffold keys: {list((live.get('tutoring') or {}).keys())}")

    build = JOURNEYS.get(args.component, build_generic_journey)
    journey = build(live, args.grade)
    beats = journey["beats"]
    if args.plumbing:
        beats = [b for b in beats if b.name in ("greeting", "activity_start")]
        print("      plumbing mode: greeting + activity_start only")

    runs = 1 if args.plumbing else max(1, args.runs)
    run_results: List[List[BeatResult]] = []
    per_run_findings: List[List[Dict[str, str]]] = []
    all_events: List[str] = []

    for i in range(1, runs + 1):
        primitive_ctx = {
            "primitive_type": args.component,
            "instance_id": f"tutor-live-{args.component}-{int(time.time())}",
            "primitive_data": journey["initial_bag"],
            "tutoring": live.get("tutoring"),
        }
        # Lesson mode reproduces the observed K-lesson failure path: the server
        # auto-greets with the scaffold but tells the tutor to keep it brief/one
        # sentence, so a scaffold without a read-aloud directive strands a non-reader.
        lesson_ctx = {
            "topic": args.topic,
            "grade_level": args.grade,
            "objectives": [{"verb": "practice", "text": args.topic}],
            "ordered_components": [{"title": args.component, "primitive_type": args.component,
                                    "instance_id": primitive_ctx["instance_id"]}],
        } if args.lesson else {}
        auth_msg = {
            "type": "authenticate",
            "session_mode": "lesson" if args.lesson else "standalone",
            "token": token,
            "resumption_handle": None,
            "primitive_context": primitive_ctx,
            "lesson_context": lesson_ctx,
            "student_progress": {"attempts": 0, "hints_used": 0, "success_rate": 0},
        }
        print(f"[3/4] Run {i}/{runs}: connecting {args.backend_ws}, driving {len(beats)} beats…")
        client = LiveTutorClient(args.backend_ws)
        results = await client.run(auth_msg, beats)
        run_results.append(results)
        per_run_findings.append(run_oracles(results, client.events))
        all_events.extend(client.events)

    aggregated = aggregate_findings(per_run_findings)
    style = average_style_metrics(per_run_findings)
    report_path = os.path.join(
        REPO_ROOT, "my-tutoring-app", "qa", "tutor-reports",
        f"{args.component}-live{'-lesson' if args.lesson else ''}-{date.today().isoformat()}.md",
    )
    write_report(report_path, args.component, journey, run_results, aggregated, style, all_events)

    print(f"[4/4] Report: {report_path}")
    if style:
        print(f"  style: {style}")
    for f in aggregated:
        status = "CONFIRMED" if f["confirmed"] else "note"
        print(f"  {status} {f['severity']} [{f['rate']}]: {f['check']} @{f['beat']} — {f['detail'][:140]}")
    if "ai_transcription" in all_events:
        print("  PLUMBING OK: output transcription is flowing (tutor voice observable as text).")
    return 1 if any(f["confirmed"] and f["severity"] == "HIGH" for f in aggregated) else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(amain()))
