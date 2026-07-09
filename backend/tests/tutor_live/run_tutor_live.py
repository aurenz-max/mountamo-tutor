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


def fetch_live_context(frontend: str, component_id: str, topic: str, grade: str) -> Dict[str, Any]:
    """Tier-2 probe with &live=1: real generated content + the raw tutoring block.

    Retries: the Next dev server intermittently answers mid-recompile, and
    generation itself can flake — neither should kill a live run.
    """
    last_err: Optional[Exception] = None
    for attempt in range(1, 4):
        try:
            r = requests.get(
                f"{frontend}/api/lumina/tutor-test",
                params={"componentId": component_id, "probe": "1", "live": "1", "topic": topic, "gradeLevel": grade},
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


JOURNEYS = {
    "states-of-matter": build_states_of_matter_journey,
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
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).strip()


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

TAG_SYNTAX_RE = re.compile(r"\[(?:[A-Z][A-Z0-9_]{2,})\]|\bcontext update\b|\bstudent action\b", re.I)


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
    ap.add_argument("--frontend", default="http://localhost:3000")
    ap.add_argument("--backend-ws", default="ws://localhost:8000/api/lumina-tutor")
    args = ap.parse_args()

    print(f"[1/4] Firebase sign-in…")
    token = get_id_token()

    print(f"[2/4] Generating real content + fetching tutoring block (probe&live)…")
    live = fetch_live_context(args.frontend, args.component, args.topic, args.grade)
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
        auth_msg = {
            "type": "authenticate",
            "session_mode": "standalone",
            "token": token,
            "resumption_handle": None,
            "primitive_context": {
                "primitive_type": args.component,
                "instance_id": f"tutor-live-{args.component}-{int(time.time())}",
                "primitive_data": journey["initial_bag"],
                "tutoring": live.get("tutoring"),
            },
            "lesson_context": {},
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
        f"{args.component}-live-{date.today().isoformat()}.md",
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
