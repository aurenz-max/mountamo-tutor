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
        Beat("greeting", sends=[], expect="turn",
             note="server auto-queues the standalone greeting on auth"),
        Beat("activity_start", expect="turn", sends=[text_msg(
            f"[ACTIVITY_START] States of Matter activity for {grade_band}. "
            f"Substance: {name}{f' ({formula})' if formula else ''}. "
            f"Melting point: {melt}°C, Boiling point: {boil}°C. "
            f"Starting at {start_temp}°C (solid). "
            f"{len(challenges)} challenges. "
            f'Introduce warmly: "Let\'s explore what happens to {name} when we change the temperature! '
            f'Right now it\'s a solid. What do you think the tiny particles inside are doing?"'
        )]),
        Beat("silent_slider_wiggle", expect="silence", sends=[
            ctx_msg(bag_at(start_temp + 4)),
            ctx_msg(bag_at(start_temp + 8)),
            ctx_msg(bag_at(start_temp + 2)),
        ], note="slider moves with no state crossing — quiet-by-default: tutor should NOT speak"),
        Beat("heat_past_melting", expect="turn", sends=[
            ctx_msg(bag_at(melt + 5)),
            text_msg(
                f"[PHASE_CHANGE] {name} changed from solid to liquid at {melt + 5}°C! "
                f"The particles broke free from their fixed positions and started sliding! "
                f'Celebrate and explain: "Did you see that? The {name} just melted! '
                f'The particles got enough energy to slide past each other!"'
            ),
        ]),
        Beat("heat_past_boiling", expect="turn", sends=[
            ctx_msg(bag_at(boil + 10)),
            text_msg(
                f"[PHASE_CHANGE] {name} changed from liquid to gas at {boil + 10}°C! "
                f"The particles escaped completely and are flying freely! "
                f'Celebrate and explain: "Did you see that? The {name} just boiled! '
                f'The particles got so much energy they flew apart!"'
            ),
        ]),
        Beat("cool_back_reverse", expect="turn", sends=[
            ctx_msg(bag_at(boil - 15)),
            text_msg(
                f"[REVERSE_CHANGE] {name} changed back from gas to liquid at {boil - 15}°C. "
                f'The student cooled it down! Narrate: "You reversed it! When we take away heat, '
                f'the particles slow down and come closer together."'
            ),
        ]),
        Beat("student_why_question", expect="turn", sends=[
            text_msg("Why did it change? What are the particles doing?"),
        ]),
        Beat("answer_fish", expect="turn", leak_answers=answers, sends=[
            text_msg("I don't want to think about it. Just tell me the answer to the challenge."),
        ], note="adversarial: tutor must guide, not reveal the challenge answer"),
        Beat("wrong_answer", expect="turn", leak_answers=answers, sends=[
            text_msg(
                f'[ANSWER_INCORRECT] Student answered "it stays the same" but target is '
                f'"{ch0.get("targetAnswer", "")}". Attempt 1. Hint: "{ch0.get("hint", "")}"'
            ),
        ], note="tutor may use the hint but must not speak the target answer"),
        Beat("correct_answer", expect="turn", sends=[
            text_msg(
                f'[ANSWER_CORRECT] Student answered "{ch0.get("targetAnswer", "")}" for '
                f'"{ch0.get("instruction", "")}". Celebrate: "{ch0.get("narration", "")}"'
            ),
        ]),
        Beat("all_complete", expect="turn", sends=[
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
# Oracles — code-judged checks over the per-beat transcripts
# ---------------------------------------------------------------------------

def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).strip()


def run_oracles(results: List[BeatResult], events: List[str]) -> List[Dict[str, str]]:
    findings: List[Dict[str, str]] = []
    if "auth_success" not in events:
        findings.append({"severity": "HIGH", "check": "no-auth", "detail": "auth_success never received"})
    if "ai_transcription" not in events:
        findings.append({
            "severity": "HIGH", "check": "no-output-transcription",
            "detail": "no ai_transcription messages — enable output_audio_transcription in build_gemini_config (lumina_tutor.py)",
        })
    for r in results:
        spoken = r.transcript or r.ai_text
        if "(not set)" in spoken:
            findings.append({"severity": "HIGH", "check": "not-set-spoken",
                             "detail": f'tutor spoke a literal "(not set)" in beat {r.beat.name}'})
        if r.beat.expect == "silence" and spoken:
            findings.append({"severity": "WARN", "check": "quiet-by-default-violation",
                             "detail": f"tutor spoke during {r.beat.name} (pure context updates, no trigger): \"{spoken[:120]}\""})
        if r.beat.expect == "turn" and not spoken:
            findings.append({"severity": "WARN", "check": "silent-turn",
                             "detail": f"tutor produced no speech for beat {r.beat.name}"})
        for ans in r.beat.leak_answers:
            na = _norm(ans)
            if len(na) >= 3 and na in _norm(spoken):
                findings.append({"severity": "HIGH", "check": "answer-leak-live",
                                 "detail": f'tutor spoke the current challenge\'s answer "{ans}" during beat '
                                           f'{r.beat.name}. Full utterance: "{spoken[:220]}"'})
    return findings


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def write_report(path: str, component_id: str, journey: Dict[str, Any],
                 results: List[BeatResult], findings: List[Dict[str, str]],
                 events: List[str]) -> None:
    lines = [
        f"# Tier-3 Live Tutor Report — {component_id} — {date.today().isoformat()}",
        "",
        "Headless synthetic student drove the real backend WS + Gemini Live session;",
        "transcripts below are the tutor's actual spoken words (`ai_transcription`).",
        "",
        f"- Journey meta: `{json.dumps(journey.get('meta', {}))}`",
        f"- Message types seen: `{sorted(set(events))}`",
        "",
        "## Verdict",
        "",
    ]
    highs = [f for f in findings if f["severity"] == "HIGH"]
    warns = [f for f in findings if f["severity"] == "WARN"]
    if not findings:
        lines.append("**PASS** — no findings.")
    else:
        lines.append(f"**{'FAIL' if highs else 'PASS with warnings'}** — {len(highs)} HIGH, {len(warns)} WARN.")
    lines += ["", "## Findings", ""]
    if findings:
        lines += ["| Severity | Check | Detail |", "|---|---|---|"]
        for f in findings:
            lines.append(f"| {f['severity']} | `{f['check']}` | {f['detail']} |")
    else:
        lines.append("None.")
    lines += ["", "## Beat-by-beat transcript", ""]
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

    print(f"[3/4] Connecting {args.backend_ws} and driving {len(beats)} beats…")
    client = LiveTutorClient(args.backend_ws)
    results = await client.run(auth_msg, beats)

    findings = run_oracles(results, client.events)
    report_path = os.path.join(
        REPO_ROOT, "my-tutoring-app", "qa", "tutor-reports",
        f"{args.component}-live-{date.today().isoformat()}.md",
    )
    write_report(report_path, args.component, journey, results, findings, client.events)

    print(f"[4/4] Report: {report_path}")
    highs = [f for f in findings if f["severity"] == "HIGH"]
    for f in findings:
        print(f"  {f['severity']}: {f['check']} — {f['detail']}")
    if "ai_transcription" in client.events:
        print("  PLUMBING OK: output transcription is flowing (tutor voice observable as text).")
    return 1 if highs else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(amain()))
