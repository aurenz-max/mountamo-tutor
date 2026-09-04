# backend/app/api/endpoints/lumina_tutor.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import base64
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Callable, Dict, Any, Optional, List
import traceback

from google import genai
from google.genai import types
from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig, Content

from ...core.config import settings
from ...services.session_ledger import SessionLedger, classify_cue

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
)
logger = logging.getLogger(__name__)

# Create separate logger for Gemini interactions
gemini_logger = logging.getLogger('gemini_lumina_tutor')
gemini_logger.setLevel(logging.INFO)

# Suppress verbose logging
websockets_logger = logging.getLogger('websockets')
websockets_logger.setLevel(logging.WARNING)

google_genai_logger = logging.getLogger('google_genai')
google_genai_logger.setLevel(logging.WARNING)

# Gemini configuration
client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options={"api_version": "v1beta"},
)

DEFAULT_VOICE = "Leda"
MODEL = "gemini-3.1-flash-live-preview"
# Audio constants
FORMAT = "audio/pcm"
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHANNELS = 1

# Router setup
router = APIRouter()


# ---------------------------------------------------------------------------
# Fault injection — DI BACKLOG item 5's dev-only verification path.
#
# With LUMINA_FAULT_MUTE_S > 0 (and ENVIRONMENT explicitly dev), the FIRST
# cue-classified client text of a session arms a mute window: model output
# (audio, output transcription, text) is dropped on the way to the client for
# that many seconds. The session is otherwise fully live — Gemini still hears
# and responds — which is exactly the observed stall shape: a dead tutor
# behind a healthy socket and a silent "Listening…". One-shot per session;
# LUMINA_FAULT_MUTE_EPISODES caps how many sessions arm per server process
# (1 = the reconnect after ladder level 2 gets a healthy session; 2 = the
# reconnected session stalls too, forcing the level-3 recovery card).
#
# GENERIC by design: arming keys off classify_cue(text) != "text" (any
# bracket-tag cue), never off DI content — transport behavior must not branch
# on DI semantics.
#
# PERSISTENCE GUARD: the flag must arrive in the PROCESS environment (a
# shell-scoped var that dies with the shell). Settings load backend/.env via
# pydantic WITHOUT touching os.environ, so a value that reaches settings but
# not os.environ was persisted in .env — the form that silently mutes the
# first session of every future backend boot. That form is refused, loudly.
# ---------------------------------------------------------------------------
_FAULT_MUTE_SESSIONS_ARMED = {"count": 0}
_FAULT_MUTE_REFUSAL_LOGGED = {"done": False}
_FAULT_DROP_SESSIONS_ARMED = {"count": 0}
_FAULT_DROP_REFUSAL_LOGGED = {"done": False}


def _fault_flag_allowed(setting_name: str, refusal_state: Dict[str, bool]) -> bool:
    """A fault flag refuses to arm unless settings explicitly say dev AND the
    flag was passed shell-scoped (see PERSISTENCE GUARD in the docblock)."""
    try:
        if int(getattr(settings, setting_name, 0) or 0) <= 0:
            return False
        if str(getattr(settings, "ENVIRONMENT", "production")).lower() not in (
            "dev", "development", "local",
        ):
            return False
        if not os.environ.get(setting_name):
            if not refusal_state["done"]:
                refusal_state["done"] = True
                logger.error(
                    f"{setting_name} is persisted in backend/.env - REFUSING "
                    "to arm fault injection. Persisted fault flags silently "
                    "sabotage every future boot; delete the line. To run a fault "
                    "drive, pass it shell-scoped instead, e.g. PowerShell: "
                    f"$env:{setting_name}='25'; uvicorn app.main:app"
                )
            return False
        return True
    except (TypeError, ValueError):
        return False


def _fault_mute_allowed() -> bool:
    return _fault_flag_allowed("LUMINA_FAULT_MUTE_S", _FAULT_MUTE_REFUSAL_LOGGED)


def _fault_drop_allowed() -> bool:
    """Companion fault: forced mid-session Gemini connection drop
    (LUMINA_FAULT_DROP_S). Reproduces the observed 1011/1008 "connection died
    mid-sentence" class so the transparent-resume path and its
    continue-don't-regreet steering can be exercised without waiting for
    Google to fail. Same guards as the mute flag."""
    return _fault_flag_allowed("LUMINA_FAULT_DROP_S", _FAULT_DROP_REFUSAL_LOGGED)


# ---------------------------------------------------------------------------
# Typed text queue entry. end_of_turn marks whether a message is meant to ASK
# the model for a turn. The Live API cannot express "context without the floor"
# — send_realtime_input(text=...) always closes the turn (see :204) — so the
# flag does not change how a message is transmitted. It decides whether the
# current primitive state rides along (state is attached only to messages that
# genuinely give the model the floor) and it is recorded in the ledger, so a
# turn opened by a message we did not intend as a prompt stays diagnosable.
# ---------------------------------------------------------------------------
@dataclass
class TextQueueEntry:
    """Entry for the text queue with control over Gemini turn behavior."""
    text: str = ""
    end_of_turn: bool = True  # True = asking for a response; False = not asking
    # Does this message get to cut the tutor off mid-sentence?
    #
    # Declared by the CLIENT, per message, because only the thing that fired it
    # knows: a student tapping away to a new activity has left the screen the
    # tutor is describing, and waiting is pointless; a slider tick on the
    # CURRENT screen is not worth a severed sentence. The server cannot infer
    # this from a timer — the 8s ceiling that tried to (2026-08-08) just
    # interrupted 41s read-alouds 8 seconds late.
    #
    # It cannot infer it from the message TYPE either, which is why there is
    # exactly one fallback here and not one per handler branch: a per-type
    # default is the same guess wearing a protocol's clothes, and it would have
    # to be migrated again the moment those types collapse. False is the safe
    # fallback for a client that says nothing — silence is recoverable, a
    # severed sentence is what the child actually hears.
    interrupt: bool = False
    # This cue is a SELF-CONTAINED SCRIPT: the caller wrote every word the
    # model should say, so the [CURRENT STATE] preamble must not be attached
    # to it. Found live 2026-08-14 (ten-frame --di drive): a judged pack's
    # per-item context update rode out on the next [TF_ITEM] cue, and the
    # model narrated the whole block — "[CURRENT STATE]: … The target answer
    # for this new item is 'four'" — answer included, before speaking the
    # scripted line. Every state-attached cue in that run was narrated (6/6);
    # every clean cue was not (0/2). Declared by the CLIENT, per message,
    # exactly like `interrupt` and for the same reason: only the thing that
    # fired the cue knows whether it is a say-exactly script (judged packs)
    # or an improvising prompt whose reply NEEDS the state (everything else).
    scripted: bool = False
    # Built at SEND time instead of enqueue time. A message whose wording
    # depends on session state ("Previous activity: X") must not be frozen
    # while it sits in the gate — if it gets superseded there it was never
    # said, and must leave no trace in that state. When set, `text` carries
    # only the cue tag, for coalescing and the ledger.
    render: Optional[Callable[[], str]] = None
    # This entry must NOT take a turn of its own. It stays in the gate until a
    # batch with an unheld entry arrives and then rides out at the front of
    # that message. Used for the [PRIMITIVE SWITCH] into a pack that owns its
    # opening (DI-GREET-1 at the switch boundary, lesson-bench sitting
    # b833c0f89475, 2026-09-03): announced on its own, the switch is a turn
    # the model has to fill, and it filled 57s with an improvised greeting, a
    # made-up "[CUE_1] Say exactly..." and the stage direction read aloud, while
    # the pack's real opener waited 52s for the floor. Merged into the opener's
    # own turn it is context, not a prompt. A later switch still supersedes it
    # (same tag), so a child who walks on through never hears it.
    held: bool = False

    def supersedes_key(self, index: int) -> str:
        """Identity for supersession inside one batch.

        Only RENDERED entries collapse, and only against their own tag. That
        is not a shortcut — an entry with a render is by construction a
        "latest wins" message, built from live state at send time, so an older
        one is not a fact that was lost but a claim that was never true.

        Everything with literal text survives, always. Batching alone fixes
        the stampede (five cues become one turn instead of four cancellations),
        and a drop rule broad enough to also eat [ANSWER_CORRECT] or the four
        distinct [ACTIVITY_START]s a lesson fires at connect would lose things
        the tutor actually needs to know. When in doubt, say it — just say it
        in the same breath as everything else.
        """
        tag = classify_cue(self.text) if self.text else ""
        if self.render and tag != "text":
            return tag
        return f"#{index}"


class SessionCounters:
    """Session interaction metrics. Turns/voice count STUDENT-INITIATED
    conversation events, never transport chunks: one spoken utterance streams
    as hundreds of audio frames, and counting frames logged `turns: 3059` for
    a ~30-turn real session (2026-08-05 session review)."""

    def __init__(self) -> None:
        self.total_interactions = 0   # student-meaningful client messages
        self.conversation_turns = 0   # text turns + opened voice turns
        self.voice_interactions = 0   # voice turns opened (activity_start)

    def observe(self, message_type: str) -> None:
        if message_type == "audio":
            return  # transport frames, not interactions
        if message_type == "activity_end":
            return  # closes the turn already counted at activity_start
        self.total_interactions += 1
        if message_type == "activity_start":
            self.voice_interactions += 1
            self.conversation_turns += 1
        elif message_type == "text":
            self.conversation_turns += 1


class FloorGate:
    """Who holds the conversational floor.

    The Live API has exactly ONE floor: send_realtime_input(text=...) always
    closes the turn, so every cue we forward cancels whatever the tutor is
    saying. Each cue source used to send the instant it fired, with no
    arbitration, and the 2026-08-08 lesson session shows what that costs:
    33 sends in 9 minutes, five of them inside 3.1s (13:01:29.5 -> 13:01:32.7)
    of which only the last was ever spoken, and three turns killed outright by
    our own text 40-55ms after it landed.

    This tracks whether the model is mid-utterance so the single sender can
    wait its turn. Held OUTSIDE any one Gemini connection: a transparent
    resume must not leave the gate believing a dead turn still holds the floor.
    """

    def __init__(self) -> None:
        self._quiet = asyncio.Event()
        self._quiet.set()
        self.yielded = 0      # batches that waited for the tutor to finish
        self.superseded = 0   # cues dropped because a newer one replaced them
        self.merged = 0       # cues folded into someone else's turn
        self.interrupted = 0  # batches the CALLER declared worth cutting in for
        self.wedged = 0       # watchdog fires — a turn that never reported an end

    def take(self) -> None:
        """The model has the floor (or is about to — we set this at SEND time,
        before Gemini has answered, because the gap between our send and its
        first audio frame is exactly the window the old code stampeded)."""
        self._quiet.clear()

    def release(self) -> None:
        self._quiet.set()

    @property
    def busy(self) -> bool:
        return not self._quiet.is_set()


class PrimitiveState:
    """The student's CURRENT state inside the primitive they are on.

    Held server-side and never pushed. Until 2026-08-07 every state change was
    forwarded to Gemini as a `[CONTEXT UPDATE]` message, nominally "silent". The
    Live API has no silent mode — send_realtime_input(text=...) always closes the
    turn AND registers as user activity (see :204) — so a slider tick landing
    mid-generation interrupted the tutor. A real session showed 9 of 17 barge-ins
    were caused by our own sends, four of them by these supposedly-silent
    updates; one clipped a celebration at its first word ("Perf—", then a restart
    1.6s later). The prompt then spent budget telling the model to ignore what we
    had just pushed at it, and on a turn longer than the hold ceiling the model
    took the floor with nothing to answer and read the prompt out loud to a child
    (2026-08-06 live session).

    So the notification is gone and the state stays. It rides out on the next
    message that genuinely gives the model the floor — a cue, a hint request, a
    student action — where it is FRESHER than the old push, which landed early
    and got buried under intervening audio. Nothing the model can act on is lost;
    what is lost is the interruption.

    `[PRIMITIVE SWITCH]` is a different channel and is untouched by this: it
    answers "where is the student", carries its own scaffold, and still fires.
    """

    def __init__(self) -> None:
        self._state: Dict[str, Any] = {}
        # Signature of the state the model has already been shown. Seeded on
        # connect/switch because the scaffold in those announcements already
        # carries that data — attaching it again would just spend tokens.
        self._conveyed = ""
        self.attached = 0  # times state rode out on a floor-giving message

    @staticmethod
    def _signature(state: Dict[str, Any]) -> str:
        try:
            return json.dumps(state, sort_keys=True, default=str)
        except Exception:
            return repr(sorted(state.items(), key=lambda kv: str(kv[0])))

    def merge(self, delta: Dict[str, Any]) -> None:
        """Record a within-primitive change. Updates are deltas; a slider
        dragged across twenty positions collapses to one state, not twenty."""
        if delta:
            self._state.update(delta)

    def reset(self, state: Optional[Dict[str, Any]]) -> None:
        """New primitive: its data replaces the old, and counts as conveyed —
        the switch announcement that follows carries it in the scaffold."""
        self._state = dict(state or {})
        self._conveyed = self._signature(self._state)

    def attach(self, text: str) -> str:
        """Prepend the current state to a message that gives the model the
        floor, if it has changed since the model last saw it. The ask stays
        last so it is the most recent thing in the model's context."""
        if not self._state:
            return text
        signature = self._signature(self._state)
        if signature == self._conveyed:
            return text
        self._conveyed = signature
        self.attached += 1
        lines = "\n".join(f"  {k}: {v}" for k, v in self._state.items())
        return f"[CURRENT STATE] Where the student is in this activity:\n{lines}\n\n{text}"


# --- Floor gate timing -----------------------------------------------------
# One trailing settle for ALL outbound text, replacing the switch-only 2.5s
# debounce. That debounce solved tab-flipping but created its own bug: the
# announcement landed AFTER the primitive it announced had already spoken
# (2026-08-08, switch at 13:00:26.1 -> [READ_SECTION] at 26.5 -> announcement
# at 28.7, killing the read). Coalescing in the gate keeps everything in FIFO
# order, so that race cannot exist.
FLOOR_SETTLE_S = 0.5        # quiet gap that ends a batch
FLOOR_SETTLE_MAX_S = 2.5    # a steady drip of cues still has to ship eventually

# NOT a policy knob. Whether a message may cut the tutor off is the CALLER's
# call (TextQueueEntry.interrupt) — only the primitive firing the cue knows
# whether the student just left the screen or merely nudged a slider. This is
# the watchdog underneath that: if a generation never reports an end, the queue
# must not stall forever behind it. It firing is a BUG, not a tuning outcome,
# so it is far above any real utterance (the 2026-08-08 lesson had 41s
# read-alouds; an 8s ceiling there just delayed the interruption by 8s) and it
# logs loudly when it fires.
FLOOR_WATCHDOG_S = 90.0


def should_queue_greeting(
    *,
    owns_opening: bool,
    resumption_handle: Optional[str],
) -> bool:
    """Does this fresh session need the improvised "greet the student" turn?

    Two reasons it must NOT be queued, and they are different in kind:

    1. ``resumption_handle`` — a WARM RECONNECT. Gemini restores the prior
       conversation, so a greeting would duplicate one the child already heard.

    2. ``owns_opening`` — THE PACK OWNS ITS OPENING LINE (DI-GREET-1, found live
       2026-08-10 on word-flip, session ``5269fc87d6da``). The greeting is queued
       with ``end_of_turn=True``, so Gemini takes a turn the instant it connects
       — while the client is still waiting for the microphone and has not sent a
       cue yet. A Direct Instruction pack's first spoken words are a
       hand-authored script that arrives seconds later, and the greeting turn
       beats it there. Observed consequence: 15s of improvised tutoring that
       ended with the tutor asking its OWN question, which the child answered,
       which barged in over the real scripted ask — so item 1 ran with no
       question at all.

       This is the true root of residual SWAP-1 (``qa/di/BACKLOG.md`` item 16).
       An earlier fix deleted the catalog directive that asked the same turn to
       compose a how-to-play; that removed one job from the turn but could not
       remove the turn, because THIS is what asks for it.

    Kept as a module-level predicate rather than an inline ``if`` so it can be
    asserted without standing up a WebSocket — the inline version was untestable,
    which is part of why it went unnoticed through two live runs.
    """
    if owns_opening:
        return False
    if resumption_handle:
        return False
    return True


def held_back(entries: List[TextQueueEntry]) -> bool:
    """Floor-gate step 3.5: does this batch stay in the gate instead of shipping?

    True only when EVERY survivor of supersession is `held`. One unheld entry
    -- the pack's opening cue, a hint request, a student action -- carries the
    held ones out with it, in FIFO order. Module-level for the same reason as
    `should_queue_greeting`: the inline version would be untestable.
    """
    return bool(entries) and all(e.held for e in entries)


def switch_tail(owns_opening: bool, from_type: str) -> str:
    """The instruction that closes a [PRIMITIVE SWITCH] announcement.

    A primitive that improvises is asked for a one-sentence greeting. A pack
    that OWNS its opening line (judged loops, the DI family) is told the
    opposite: its first scripted cue is the transition, and this notice rides
    inside that cue's turn (see TextQueueEntry.held), so the only thing the
    model may say is the cue's quoted line. Before 2026-09-03 the greeting
    tail was unconditional here -- `owns_opening` was honored at session-init
    only -- so every DI block past block 1 of a lesson got the greeting turn
    the connect path had already learned to suppress.
    """
    if owns_opening:
        return (
            "Do not greet the student and do not introduce or describe this "
            "activity: it owns its opening line, which arrives as a scripted "
            "cue. If a cue is in this same message, say only that cue's quoted "
            "line; otherwise say nothing about this switch at all."
        )
    return (
        f"Greet the student briefly for this new activity. Keep it to one sentence. "
        f"If relevant, connect to what they just finished in {from_type}."
    )


def format_objectives(objectives: List[Dict]) -> str:
    """Format learning objectives for system prompt."""
    if not objectives:
        return "No specific objectives provided"

    formatted = []
    for obj in objectives:
        verb = obj.get('verb', 'learn')
        text = obj.get('text', '')
        formatted.append(f"- {verb.title()}: {text}")

    return "\n".join(formatted)


def format_activities(activities: List[Dict], results: Optional[List[Dict]] = None) -> str:
    """Format activity list for context."""
    if not activities:
        return "None"

    formatted = []
    for act in activities:
        title = act.get('title', 'Untitled')
        instance_id = act.get('instance_id', '')

        # Check if we have results for this activity
        status = ""
        if results:
            result = next((r for r in results if r.get('instance_id') == instance_id), None)
            if result:
                if result.get('completed'):
                    status = " ✓"
                else:
                    status = " (in progress)"

        formatted.append(f"- {title}{status}")

    return "\n".join(formatted)


_PLACEHOLDER_RE = re.compile(r'\{\{(\w+)\}\}')


def interpolate_template(template: str, data: Dict) -> str:
    """
    Replace {{key}} placeholders with values from data dict (lenient).
    Unresolved placeholders are dropped. NEVER emit a filler marker: the model
    reads this text, and a real session showed the tutor speaking a literal
    "(not set)" aloud to a 5-year-old (2026-08-05 review, seq 584).
    """
    def replacer(match):
        key = match.group(1).strip()
        value = data.get(key)
        if value is None:
            return ''
        return str(value)
    return _PLACEHOLDER_RE.sub(replacer, template)


def interpolate_line(template: str, data: Dict) -> Optional[str]:
    """
    Strict variant for SCRIPT lines (scaffolding levels, struggle responses):
    a line with an unresolved placeholder is not a usable script — dropping the
    whole line beats shipping a sentence with a hole in it. Returns None when
    any placeholder is unresolved (or the template is empty).
    """
    if not template:
        return None
    if any(data.get(m.group(1).strip()) is None
           for m in _PLACEHOLDER_RE.finditer(template)):
        return None
    return interpolate_template(template, data)


def get_primitive_specific_instructions(
    primitive_type: str,
    primitive_data: Dict,
    tutoring_scaffold: Optional[Dict] = None
) -> str:
    """
    Build primitive-specific scaffolding from catalog-provided tutoring metadata.

    The tutoring scaffold is sent by the frontend from the component catalog,
    keeping scaffolding instructions co-located with component definitions
    (single source of truth). If no scaffold is provided, returns a generic fallback.
    """
    # Base template for all primitives
    base = f"""
**CURRENT PRIMITIVE: {primitive_type}**
Grade Level: {primitive_data.get('gradeLevel', 'K-6')}
"""

    if not tutoring_scaffold:
        return base + "\nNo specific scaffolding instructions for this primitive type."

    # Interpolate task description
    task_desc = interpolate_template(
        tutoring_scaffold.get('taskDescription', ''), primitive_data
    )

    # Build context snapshot from specified keys. Unset keys are OMITTED — a
    # placeholder value in RUNTIME STATE ends up in the model's mouth (a real
    # session ledger shows the tutor speaking "(not set)" as an entire turn).
    context_keys = tutoring_scaffold.get('contextKeys')
    if context_keys:
        context_lines = []
        for key in context_keys:
            value = primitive_data.get(key)
            if value is None:
                continue
            context_lines.append(f"  {key}: {value}")
        context_section = "\n".join(context_lines) or "  (no state reported yet)"
    else:
        context_section = "\n".join(
            f"  {k}: {v}" for k, v in primitive_data.items()
        )

    # Scaffolding levels — strict interpolation: a hint script with an
    # unresolved placeholder is dropped rather than shipped with a hole.
    levels = tutoring_scaffold.get('scaffoldingLevels', {})
    level_lines = []
    for i, key in enumerate(('level1', 'level2', 'level3'), 1):
        line = interpolate_line(levels.get(key, ''), primitive_data)
        if line:
            level_lines.append(f"Level {i}: {line}")
    scaffolding_section = "\n".join(level_lines) or "None specified"

    # Common struggles — same strict rule for the scripted responses.
    struggles = tutoring_scaffold.get('commonStruggles', [])
    struggle_lines = []
    for s in struggles:
        pattern = s.get('pattern', '')
        response = interpolate_line(s.get('response', ''), primitive_data)
        if response:
            struggle_lines.append(f'- {pattern} → "{response}"')
    struggles_section = "\n".join(struggle_lines) if struggle_lines else "None specified"

    # AI directives (primitive-specific commands injected by the catalog)
    directives = tutoring_scaffold.get('aiDirectives', [])
    directives_section = ""
    for d in directives:
        title = d.get('title', 'DIRECTIVE')
        instruction = interpolate_template(d.get('instruction', ''), primitive_data)
        directives_section += f"\n**{title}:**\n{instruction}\n"

    return f"""{base}
**TASK:** {task_desc}

**RUNTIME STATE:**
{context_section}

**SCAFFOLDING STRATEGY:**
{scaffolding_section}

**COMMON STRUGGLES:**
{struggles_section}
{directives_section}"""


# ---------------------------------------------------------------------------
# System instruction builders
#
# The blocks below are spliced verbatim into BOTH the standalone and lesson
# prompts. A behavioral prompt fix made in a shared block lands in both modes;
# before extraction the two hand-maintained copies had already drifted (the
# INTERACTION RULES differed by one bullet nobody decided on).
# ---------------------------------------------------------------------------

_QUESTIONS_BLOCK = """**QUESTIONS FROM THE STUDENT — this outranks every scripted beat above:**
When the student asks a question of their OWN — about the scene, the picture, the
topic, or how the world works — ANSWER IT FIRST: one plain, age-appropriate sentence
that actually answers what they asked. Then, if it helps, bridge back to the activity.
- The "never give away the answer" rule protects the active challenge's answer
  ONLY. A student asking "what are they building?" gets a real answer ("It looks
  like they're building a big home for lots of people!"), never a scripted
  prompt, a scaffolding question, or a promise that a later activity will answer
  it.
- Never respond to a genuine question by only praising it, narrating what the
  current page covers, or asking a question back. Answer, THEN engage.
- If the student asks what YOU think ("what do you think they're building?"),
  offer a genuine guess of your own ("I think it might be…") — praising their
  idea and changing the subject is not an answer."""

_CONTEXT_MESSAGES_BLOCK = """**CONTEXT MESSAGES (never speak in response to these):**
- [CURRENT STATE]: where the student is in the activity right now, attached to the message that follows it. Use it to answer that message accurately. Never read it aloud, list it back, or comment on it — answer what was actually asked.
- [SESSION RESUMED]: the connection was briefly restored. Follow its instruction exactly; never say the tag aloud or mention any disconnection to the student.
- Messages that explicitly script a line for you (e.g. 'Celebrate and explain: "..."') are the ONLY state changes you narrate."""

_IMPORTANT_BLOCK = """**IMPORTANT:**
- NEVER solve the problem for the student (their own curiosity questions are not the problem — answer those directly, per QUESTIONS FROM THE STUDENT)
- ALWAYS wait for the student to respond before continuing (except for [PRONOUNCE] commands)
- BE PATIENT - learning takes time
- ENCOURAGE mistakes as learning opportunities
- NEVER invent, create, or advance to new challenges on your own. The app UI controls all challenge progression. After responding, STOP and wait silently. Do not fill silence by presenting new content."""


def _hint_progression(examples: bool) -> str:
    """Hint-level definitions. Standalone mode carries worked examples; lesson
    mode stays primitive-agnostic (the examples are phonics-specific)."""
    ex1 = ' Example: "What do you notice about the first sound?"' if examples else ""
    ex2 = ' Example: "Let\'s focus on just the first two sounds. Can you blend /k/ and /æ/ together?"' if examples else ""
    ex3 = ' Example: "Start with /k/, add /æ/ to make \'ca\', then add /t/ at the end."' if examples else ""
    return f"""**HINT PROGRESSION SYSTEM:**
When the student requests a hint, respond based on the level they request:

- **Level 1 (Gentle Nudge):** Ask a thought-provoking question or give a subtle pointer.{ex1}
- **Level 2 (Specific Guidance):** Break down the problem into smaller steps.{ex2}
- **Level 3 (Detailed Walkthrough):** Provide step-by-step guidance without giving the answer.{ex3}"""


def _interaction_rules(grade_level: str, use_name: bool) -> str:
    name_rule = "\n- Use the student's name if provided" if use_name else ""
    return f"""**INTERACTION RULES:**
- Keep responses SHORT (1-2 sentences max)
- Use encouraging, supportive tone appropriate for {grade_level} students
- Ask AT MOST ONE question per response — never stack two questions in one breath
- Most responses END WITH A STATEMENT, not a question. Save questions for moments that need the student's thinking: a struggle, a misconception, a prediction before they act. After a celebration or an observation, stop — do not add a closing question.
- Reference lesson context naturally without being formulaic{name_rule}
- Celebrate milestones; skip praise for routine moves
- If student is stuck after Level 3 hint, encourage them to try and provide reassurance"""


def build_lumina_system_instruction(
    primitive_type: str,
    primitive_data: Dict,
    lesson_context: Dict,
    student_progress: Dict,
    tutoring_scaffold: Optional[Dict] = None
) -> str:
    """
    Generate context-aware system prompt with lesson progression.
    Used in STANDALONE mode (single primitive, e.g. tester).
    Includes primitive-specific scaffolding in the system instruction.
    """

    # Extract lesson info
    topic = lesson_context.get('topic', 'Learning Activity')
    grade_level = lesson_context.get('grade_level', 'K-6')
    objectives = lesson_context.get('objectives', [])
    ordered_components = lesson_context.get('ordered_components', [])
    current_index = lesson_context.get('current_index', 0)
    previous_results = lesson_context.get('previous_results', [])

    # Build lesson progression awareness (slicing handles both boundaries)
    previous_activities = ordered_components[:current_index]
    current_activity = ordered_components[current_index] if current_index < len(ordered_components) else {}
    upcoming_activities = ordered_components[current_index + 1:]

    # Student progress context
    attempts = student_progress.get('attempts', 0)
    hints_used = student_progress.get('hints_used', 0)
    success_rate = student_progress.get('success_rate', 0.0)

    # Determine struggle pattern
    struggle_pattern = "just starting"
    if attempts > 3 and success_rate < 0.5:
        struggle_pattern = "needs more support"
    elif attempts > 1 and success_rate > 0.8:
        struggle_pattern = "making good progress"

    # Build the comprehensive system instruction
    system_instruction = f"""You are an AI Learning Assistant for Lumina, an interactive educational platform.

**LESSON CONTEXT:**
Topic: {topic}
Grade Level: {grade_level}
Learning Objectives:
{format_objectives(objectives)}

**LESSON PROGRESSION:**
{len(previous_activities)} activities completed
Current: {current_activity.get('title', 'Unknown')} (Activity {current_index + 1} of {len(ordered_components)})
{len(upcoming_activities)} activities remaining

**PREVIOUS ACTIVITIES:**
{format_activities(previous_activities, previous_results)}

**UPCOMING ACTIVITIES:**
{format_activities(upcoming_activities[:2])}

{get_primitive_specific_instructions(primitive_type, primitive_data, tutoring_scaffold)}

**STUDENT CONTEXT:**
- Current attempt: {attempts}
- Hints used: {hints_used}
- Success pattern: {struggle_pattern}
- Success rate: {success_rate * 100:.0f}%

**YOUR ROLE:**
1. **Provide scaffolded hints** - Never give away the active challenge's answer
2. **Reference lesson context** - Connect to previous activities when relevant ("Remember in the fraction bar earlier when we...")
3. **Preview connections** - Link to upcoming activities ("This will help you with the next challenge where...")
4. **Use Socratic questioning on the active challenge** - Ask guiding questions instead of stating facts
5. **Celebrate progress** - Acknowledge the student's journey through the lesson

{_QUESTIONS_BLOCK}

{_hint_progression(examples=True)}

{_CONTEXT_MESSAGES_BLOCK}

{_interaction_rules(grade_level, use_name=True)}

{_IMPORTANT_BLOCK}
"""

    return system_instruction


def build_lesson_system_instruction(
    lesson_context: Dict,
    student_progress: Dict,
) -> str:
    """
    Generate a primitive-agnostic system prompt for LESSON mode.
    Primitive-specific scaffolding is injected later via text messages
    when the active primitive switches.
    """

    topic = lesson_context.get('topic', 'Learning Activity')
    grade_level = lesson_context.get('grade_level', 'K-6')
    objectives = lesson_context.get('objectives', [])
    ordered_components = lesson_context.get('ordered_components', [])

    system_instruction = f"""You are an AI Learning Assistant for Lumina, an interactive educational platform.

**SESSION MODE: LESSON**
You are tutoring a student through an entire lesson with multiple activities.
As the student progresses, you will receive [PRIMITIVE SWITCH] messages when they
move to a new activity. Adapt your guidance accordingly. A student working inside
an activity is not addressing you — you will not hear about every move they make,
and you are not meant to. Wait for them.

**LESSON CONTEXT:**
Topic: {topic}
Grade Level: {grade_level}
Learning Objectives:
{format_objectives(objectives)}

**LESSON ACTIVITIES ({len(ordered_components)} total):**
{format_activities(ordered_components)}

**YOUR ROLE:**
1. **Provide scaffolded hints** - Never give away the active challenge's answer
2. **Reference previous activities** - Connect to what the student has already done ("Remember when we...")
3. **Preview connections** - Link to upcoming activities ("This will help you with the next challenge where...")
4. **Use Socratic questioning on the active challenge** - Ask guiding questions instead of stating facts
5. **Celebrate progress** - Acknowledge the student's journey through the lesson
6. **Handle transitions** - When you receive a [PRIMITIVE SWITCH], briefly acknowledge the new activity

{_QUESTIONS_BLOCK}

{_hint_progression(examples=False)}

{_CONTEXT_MESSAGES_BLOCK}

{_interaction_rules(grade_level, use_name=False)}

{_IMPORTANT_BLOCK}
"""

    return system_instruction


@router.websocket("/lumina-tutor")
async def lumina_tutor_session(websocket: WebSocket):
    """
    WebSocket endpoint for Lumina AI Assistant sessions.
    Supports two modes:
      - standalone: One Gemini session per primitive (tester / single-primitive use)
      - lesson: One Gemini session per exhibit/lesson (production multi-primitive use)
    """
    logger.info(f"Lumina Tutor WebSocket connection attempt from: {websocket.client}")

    await websocket.accept()
    logger.info("Lumina Tutor WebSocket connection accepted")

    # Structured per-session diagnosis ledger (write-only, never throws).
    ledger = SessionLedger()
    ledger.write("connection-accepted", client=str(websocket.client))

    gemini_session = None

    # Metrics tracking
    counters = SessionCounters()

    # Mutable primitive tracking (updated on switch_primitive)
    primitive_type = "unknown"
    instance_id = "unknown"
    primitive_data: Dict = {}
    tutoring_scaffold: Optional[Dict] = None
    session_mode = "standalone"

    try:
        # Step 1: Authenticate user
        logger.info("Waiting for authentication...")
        auth_message = await asyncio.wait_for(websocket.receive(), timeout=10.0)
        if "text" not in auth_message:
            logger.warning("Received non-text message during auth (likely client disconnected)")
            return
        auth_data = json.loads(auth_message["text"])

        if auth_data.get("type") != "authenticate":
            logger.error("Authentication type mismatch")
            await websocket.close(code=4001, reason="Authentication required")
            return

        # Authenticate using Firebase
        from firebase_admin import auth
        token = auth_data.get("token", "").replace('Bearer ', '')
        # clock_skew_seconds: a freshly-minted token can carry iat ~1s ahead of
        # this server's clock, which hard-fails the whole session ("Token used
        # too early"). Tolerate small skew instead of dying on it.
        decoded_token = auth.verify_id_token(token, clock_skew_seconds=10)
        user_id = decoded_token['uid']
        user_email = decoded_token.get('email', 'Unknown')
        logger.info(f"Authentication successful for user {user_id} ({user_email})")
        ledger.write("auth-ok", uid=user_id, email=user_email)
        # This coroutine frame lives for the whole session; without this, the
        # raw auth frame (the full serialized lesson_context, tens of KB in
        # lesson mode) and the JWT stay pinned alongside the parsed copies.
        del auth_message, token, decoded_token

        # Extract session mode and contexts
        session_mode = auth_data.get("session_mode", "standalone")
        primitive_context = auth_data.get("primitive_context", {})
        lesson_context = auth_data.get("lesson_context", {})
        student_progress = auth_data.get("student_progress", {})
        # Optional resumption handle: present when the client reconnects after its
        # own WebSocket dropped (vs. the server-side transparent resume below).
        # Seeds the Gemini session so the conversation continues warm, not cold.
        initial_resumption_handle = auth_data.get("resumption_handle")

        primitive_type = primitive_context.get("primitive_type", "unknown")
        instance_id = primitive_context.get("instance_id", "unknown")
        primitive_data = primitive_context.get("primitive_data", {})
        tutoring_scaffold = primitive_context.get("tutoring")
        # Optional client-requested tuning of Gemini's automatic voice-activity
        # detection. Generic transport: any surface may send it; values are
        # clamped here and unknown keys ignored.
        audio_input = primitive_context.get("audio_input") or {}
        # THE PACK OWNS ITS OPENING LINE (DI-GREET-1, found live 2026-08-10).
        # Set by any primitive whose first spoken words are a hand-authored
        # script — every Direct Instruction pack and every DI-ported literacy
        # primitive. When true we do NOT queue the improvised greeting below.
        # Default False: an ordinary tutoring surface still greets.
        owns_opening = bool(primitive_context.get("owns_opening"))

        # Client-side correlation key: the diRunLog runId minted by the DI run
        # log (or any future client run recorder). Joins this ledger to the
        # client's own run JSON and to /api/di-run-logs uploads.
        client_run_id = auth_data.get("client_run_id")

        logger.info(f"Initializing Lumina AI session (mode={session_mode}) for primitive: {primitive_type} (instance: {instance_id})")
        logger.info(f"Lesson: {lesson_context.get('topic', 'Unknown')} - {len(lesson_context.get('ordered_components', []))} activities")
        ledger.write(
            "session-init",
            mode=session_mode,
            primitive=primitive_type,
            instance=instance_id,
            client_run_id=client_run_id,
            warm_resume=bool(initial_resumption_handle),
            audio_input=audio_input or None,
            owns_opening=owns_opening,
        )

        # Send authentication success (safe: no concurrency yet)
        await websocket.send_json({
            "type": "auth_success",
            "message": "Lumina AI connected and ready to help!"
        })

        # Step 2: Build system instruction based on session mode
        if session_mode == "lesson":
            system_instruction = build_lesson_system_instruction(
                lesson_context, student_progress
            )
            logger.info(f"Lesson-mode system instruction built for: {lesson_context.get('topic', 'Unknown')}")
        else:
            system_instruction = build_lumina_system_instruction(
                primitive_type,
                primitive_data,
                lesson_context,
                student_progress,
                tutoring_scaffold=tutoring_scaffold
            )
            logger.info(f"Standalone system instruction built for {primitive_type}")

        # Step 3: Configure Gemini session
        speech_config = SpeechConfig(
            voice_config=VoiceConfig(
                prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=DEFAULT_VOICE)
            )
        )

        def build_realtime_input_config() -> Optional[types.RealtimeInputConfig]:
            """Map the client's optional audio_input request onto Gemini's
            automatic-VAD knobs. Returns None when nothing was requested so
            default sessions keep default detection."""
            if not isinstance(audio_input, dict) or not audio_input:
                return None
            # Manual mode: the client's own voice-activity detector brackets
            # every learner turn with activity_start/activity_end messages.
            # Gemini's automatic VAD is fully disabled — no turn exists unless
            # the client opened one, and turns close when the client says so.
            if audio_input.get("manual_activity") is True:
                logger.info("Client requested manual voice-activity signaling; automatic VAD disabled")
                return types.RealtimeInputConfig(
                    automatic_activity_detection=types.AutomaticActivityDetection(disabled=True)
                )
            detection_kwargs: Dict[str, Any] = {}
            start = str(audio_input.get("start_sensitivity", "")).lower()
            if start == "high":
                detection_kwargs["start_of_speech_sensitivity"] = types.StartSensitivity.START_SENSITIVITY_HIGH
            elif start == "low":
                detection_kwargs["start_of_speech_sensitivity"] = types.StartSensitivity.START_SENSITIVITY_LOW
            end = str(audio_input.get("end_sensitivity", "")).lower()
            if end == "high":
                detection_kwargs["end_of_speech_sensitivity"] = types.EndSensitivity.END_SENSITIVITY_HIGH
            elif end == "low":
                detection_kwargs["end_of_speech_sensitivity"] = types.EndSensitivity.END_SENSITIVITY_LOW
            silence_ms = audio_input.get("silence_duration_ms")
            if isinstance(silence_ms, (int, float)):
                detection_kwargs["silence_duration_ms"] = int(max(100, min(5000, silence_ms)))
            prefix_ms = audio_input.get("prefix_padding_ms")
            if isinstance(prefix_ms, (int, float)):
                detection_kwargs["prefix_padding_ms"] = int(max(0, min(1000, prefix_ms)))
            if not detection_kwargs:
                return None
            logger.info(f"Applying client VAD tuning: {detection_kwargs}")
            return types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(**detection_kwargs)
            )

        realtime_input_config = build_realtime_input_config()

        def build_gemini_config(handle: Optional[str]) -> LiveConnectConfig:
            """Build the Live config. Two long-session features are always on:

            - context_window_compression: slides a window over old context so the
              session never hits the context/duration ceiling that triggers the
              1008 "operation was aborted" close. (Audio-only sessions are capped
              at ~15 min WITHOUT this; enabling it removes the duration limit.)
            - session_resumption: asks Gemini to emit resumption handles. Passing
              the latest handle back on `handle` resumes the SAME conversation
              after a drop, instead of restarting cold. handle=None starts fresh.
            """
            return LiveConnectConfig(
                response_modalities=["AUDIO"],
                speech_config=speech_config,
                realtime_input_config=realtime_input_config,
                input_audio_transcription=types.AudioTranscriptionConfig(),
                output_audio_transcription=types.AudioTranscriptionConfig(),
                context_window_compression=types.ContextWindowCompressionConfig(
                    trigger_tokens=104857,
                    sliding_window=types.SlidingWindow(target_tokens=52428),
                ),
                session_resumption=types.SessionResumptionConfig(handle=handle),
                system_instruction=Content(parts=[{"text": system_instruction}]),
            )

        logger.info("Starting Gemini Live session for Lumina tutoring...")

        # --- Shared state that persists ACROSS Gemini (re)connections ---------
        # The client WebSocket, queues, and the latest resumption handle all
        # outlive any single Gemini connection so a transparent resume keeps the
        # student's session unbroken.
        text_queue: asyncio.Queue = asyncio.Queue()
        audio_queue: asyncio.Queue = asyncio.Queue()
        ws_send_queue: asyncio.Queue[dict] = asyncio.Queue()
        # Set when the client disconnects or a fatal error makes resuming moot —
        # breaks the reconnection loop below.
        stop_event = asyncio.Event()
        # Latest resumption handle from Gemini (mutable holder so closures share it).
        resumption_handle: Dict[str, Optional[str]] = {"value": initial_resumption_handle}
        # Fault-injection mute window for THIS session (see module docblock).
        # until=0.0 means never armed; armed once, by the first cue-classified
        # client text, only when _fault_mute_allowed().
        fault_mute: Dict[str, float] = {"until": 0.0, "dropped": 0.0}
        if _fault_mute_allowed():
            logger.warning(
                f"LUMINA_FAULT_MUTE_S={settings.LUMINA_FAULT_MUTE_S} is armed-able "
                f"(ENVIRONMENT={settings.ENVIRONMENT}) — dev fault injection active"
            )
        # Companion fault: forced connection drop at a deadline (at=0.0 = never
        # armed). Armed like the mute — first cue-classified text, dev only.
        fault_drop: Dict[str, float] = {"at": 0.0}
        if _fault_drop_allowed():
            logger.warning(
                f"LUMINA_FAULT_DROP_S={settings.LUMINA_FAULT_DROP_S} is armed-able "
                f"(ENVIRONMENT={settings.ENVIRONMENT}) — forced-drop fault active"
            )
        # Whether the LAST Gemini connection died while a model turn was
        # streaming — decides how the resume steers the tutor (finish the
        # thought vs. silently keep waiting).
        interrupt_state: Dict[str, bool] = {"mid_turn": False}

        # The primitive the model has actually been TOLD about. Only a switch
        # that survives the floor gate moves this — see _switch_render.
        announced_primitive = {"value": primitive_type}
        floor = FloorGate()

        def _switch_render(sw: Dict[str, Any]) -> Callable[[], str]:
            """Build the switch announcement when it SENDS, not when it queues.

            A child tapping through four activities queues four switches; the
            gate keeps the last. Rendering there means "Previous activity"
            names where they came FROM, not a screen they passed through in
            300ms, and the three superseded taps never touch
            `announced_primitive` because their render is never called."""
            def render() -> str:
                from_type = announced_primitive["value"]
                announced_primitive["value"] = sw["primitive_type"]
                scaffold_text = get_primitive_specific_instructions(
                    sw["primitive_type"], sw["primitive_data"], sw["tutoring"]
                )
                ledger.write(
                    "switch-announced",
                    to_primitive=sw["primitive_type"],
                    from_primitive=from_type,
                )
                return (
                    f"[PRIMITIVE SWITCH] The student has moved to a new activity.\n"
                    f"Previous activity: {from_type}\n"
                    f"New activity: {sw['primitive_type']} (instance: {sw['instance_id']})\n\n"
                    f"{scaffold_text}\n\n"
                    f"{switch_tail(bool(sw.get('owns_opening')), from_type)}"
                )
            return render

        # Within-primitive state: kept here, never pushed. Seeded from the
        # primitive the session opened on — the greeting's scaffold carries it.
        primitive_state = PrimitiveState()
        primitive_state.reset(primitive_data)

        # Send session ready message via the send queue
        await ws_send_queue.put({
            "type": "session_ready",
            "message": "Lumina AI is ready to help you learn!"
        })

        # Queue initial greeting based on session mode.
        # Skip it entirely on a warm client reconnect (handle supplied): Gemini
        # restores the prior conversation, so a fresh greeting would duplicate.
        #
        # ⚠️ ALSO SKIP IT WHEN THE PACK OWNS ITS OPENING LINE (DI-GREET-1, found
        # live 2026-08-10 on word-flip, session 5269fc87d6da). This block sends
        # "Greet the student warmly…" with end_of_turn=True, so Gemini TAKES A
        # TURN the moment it connects. For a Direct Instruction pack the first
        # spoken words are a hand-authored script sent seconds later (the client
        # is still waiting on the mic), and the greeting turn gets there first:
        #   - word-flip: 15s of improvised tutoring that ended with the tutor's
        #     OWN question ("What do you see on the 'many' side?"). The child
        #     answered THAT, which barged in over the real scripted ask, so item
        #     1 ran with no question — only the model half was ever spoken.
        #   - sound-swap (a964bccc5ca2): the greeting turn absorbed the catalog's
        #     how-to-play directive too, then improvised its own ask.
        # This is the true root of residual SWAP-1. Deleting the catalog's
        # "compose a how-to-play" directive removed one job from that turn; it
        # could not remove the turn, because the backend is what asks for it.
        # A DI pack must be SILENT until its first cue.
        if not should_queue_greeting(
            owns_opening=owns_opening,
            resumption_handle=initial_resumption_handle,
        ):
            logger.info(
                "Skipping greeting (owns_opening=%s, warm_resume=%s) for %s",
                owns_opening,
                bool(initial_resumption_handle),
                primitive_type,
            )
        else:
            if session_mode == "lesson":
                # Lead with the first primitive's scaffold so the greeting
                # has its specific context.
                first_scaffold = get_primitive_specific_instructions(
                    primitive_type, primitive_data, tutoring_scaffold
                )
                greeting = (
                    f"The student is starting the lesson. Their first activity is: {primitive_type}\n\n"
                    f"{first_scaffold}\n\n"
                    f"Greet the student warmly for this lesson and let them know you're here to help. "
                    f"Keep it brief and encouraging."
                )
            else:
                greeting = (
                    "Greet the student warmly and let them know you're here to help them "
                    "with this activity. Keep it brief and encouraging."
                )
            await text_queue.put(TextQueueEntry(text=greeting, end_of_turn=True))
            logger.info("Initial greeting prompt queued")

        # ------------------------------------------------------------------
        # Serialized WebSocket sender — all outbound messages go through here
        # Fixes race condition from asyncio.create_task(websocket.send_json())
        # ------------------------------------------------------------------
        async def ws_sender():
            """Send messages to the client WebSocket serially."""
            try:
                while True:
                    message = await ws_send_queue.get()
                    await websocket.send_json(message)
            except WebSocketDisconnect:
                logger.info("WebSocket disconnected during send")
            except asyncio.CancelledError:
                logger.info("WebSocket sender cancelled")
            except Exception as e:
                logger.error(f"Error in ws_sender: {e}")

        async def handle_client_messages():
            """Client protocol — the minimal set that drives Gemini Live.

            Anything that is only WORDS for the model arrives as `text`,
            composed by the frontend (hint requests included — the client
            owns the business logic and the wording; it also already owns
            the metrics it used to have echoed back). The other types
            exist because they drive something the client cannot:
            transport (`audio`, `activity_*`), or state the gate applies
            at SEND time (`update_context`, `switch_primitive`).
            """
            nonlocal primitive_type, instance_id, primitive_data, tutoring_scaffold

            try:
                while True:
                    message = await websocket.receive_json()
                    message_type = message.get("type")

                    # Track interactions (audio frames are transport, not turns)
                    counters.observe(message_type)

                    # Whether this message may cut the tutor off is the
                    # CLIENT's call, one flag for every type — see
                    # TextQueueEntry.interrupt.
                    interrupt = bool(message.get("interrupt", False))

                    if message_type == "update_context":
                        # Handle real-time primitive state updates
                        new_state = message.get("primitive_data", {})
                        progress_update = message.get("student_progress", {})

                        logger.info(f"Context update received for {primitive_type}")
                        ledger.write(
                            "context-update",
                            primitive=primitive_type,
                            keys=list(new_state.keys()),
                        )

                        # Recorded, NOT sent. A student exploring is not
                        # addressing the tutor, and this transport cannot
                        # carry a message without handing over the floor —
                        # so pushing state here interrupts the child's own
                        # tutor mid-sentence. The state rides out on the
                        # next message that genuinely asks for a turn (see
                        # PrimitiveState), fresher than this push ever was.
                        primitive_state.merge(new_state)
                        if progress_update:
                            primitive_state.merge({
                                "student progress": json.dumps(progress_update)
                            })

                    elif message_type == "switch_primitive":
                        # Handle primitive context switch within a lesson session
                        new_primitive = message.get("primitive_context", {})
                        old_type = primitive_type

                        # Update tracking variables
                        primitive_type = new_primitive.get("primitive_type", "unknown")
                        instance_id = new_primitive.get("instance_id", "unknown")
                        primitive_data = new_primitive.get("primitive_data", {})
                        tutoring_scaffold = new_primitive.get("tutoring")
                        # Same flag the connect path honors in should_queue_greeting,
                        # now carried per switch (the client resolves it from the
                        # catalog like `tutoring`/`audio_input`).
                        owns_opening = bool(new_primitive.get("owns_opening"))

                        logger.info(f"Switching primitive: {old_type} -> {primitive_type} (instance: {instance_id}, owns_opening={owns_opening})")
                        ledger.write(
                            "switch-primitive",
                            from_primitive=old_type,
                            to_primitive=primitive_type,
                            instance=instance_id,
                        )

                        # The old primitive's state does not describe this
                        # one. The announcement below carries the new data
                        # in its scaffold, so it counts as already conveyed.
                        primitive_state.reset(primitive_data)

                        # Straight into the floor gate, in FIFO order with
                        # the new primitive's own opening cues. Tab-flipping
                        # still collapses (same tag, last wins) — but as a
                        # case of the general rule, not a separate 2.5s
                        # timer that could land the announcement after the
                        # activity it announces has already spoken.
                        #
                        # A pack that owns its opening gets no turn for the
                        # announcement: `held` keeps it in the gate until the
                        # pack's first cue (or any other floor-giving message)
                        # carries it out. `scripted` too -- that cue is a
                        # say-exactly line and the pack's per-item context
                        # update lands between switch and cue, so an unscripted
                        # announcement in the batch would reopen the state
                        # channel and the model would narrate the item, target
                        # answer included (the defect `scripted` exists for).
                        await text_queue.put(TextQueueEntry(
                            text="[PRIMITIVE SWITCH]",
                            interrupt=interrupt,
                            held=owns_opening,
                            scripted=owns_opening,
                            render=_switch_render({
                                "primitive_type": primitive_type,
                                "instance_id": instance_id,
                                "primitive_data": primitive_data,
                                "tutoring": tutoring_scaffold,
                                "owns_opening": owns_opening,
                            }),
                        ))

                        # Confirm switch to frontend immediately (UI state
                        # never waits on the settle window)
                        await ws_send_queue.put({
                            "type": "primitive_switched",
                            "primitive_type": primitive_type,
                            "instance_id": instance_id,
                        })

                    elif message_type == "text":
                        await text_queue.put(TextQueueEntry(
                            text=message.get("content", ""),
                            end_of_turn=True,
                            interrupt=interrupt,
                            scripted=bool(message.get("scripted")),
                        ))

                    elif message_type == "audio":
                        # Handle audio input
                        audio_data = message.get("data") or message.get("audio_data")
                        if audio_data:
                            await audio_queue.put(audio_data)
                            logger.debug("Queued audio data (%d bytes base64)", len(audio_data))

                    elif message_type in ("activity_start", "activity_end"):
                        # Client-driven voice-activity brackets (manual VAD).
                        # Routed through the audio queue so they stay ordered
                        # with the audio frames they delimit.
                        await audio_queue.put({"activity": message_type})
                        logger.info(f"Queued client activity signal: {message_type}")

            except WebSocketDisconnect:
                logger.info("Client disconnected")
                ledger.write("client-disconnected")
                stop_event.set()
            except Exception as e:
                logger.error(f"Error in client message handler: {e}")
                ledger.write("client-handler-error", error=str(e))
                stop_event.set()

        async def _collect(batch: List[TextQueueEntry], timeout: Optional[float]) -> bool:
            """Wait up to `timeout` (None = forever) for one more queued
            entry, then take everything else already waiting behind it.
            True if anything arrived."""
            try:
                batch.append(await asyncio.wait_for(text_queue.get(), timeout))
            except asyncio.TimeoutError:
                return False
            while True:
                try:
                    batch.append(text_queue.get_nowait())
                except asyncio.QueueEmpty:
                    return True

        async def handle_text_to_gemini(session):
            """The floor gate: the ONE place text reaches Gemini.

            Gemini 3.1+ rejects send_client_content mid-session (1007), so
            every message here is a send_realtime_input — which always
            closes the turn. That makes the model's turn the scarce
            resource, and this loop is what rations it:

              1. wait for the tutor to stop speaking (bounded), collecting
                 whatever the lesson fires meanwhile;
              2. settle briefly so a burst of cues becomes one turn;
              3. drop cues a newer one of the same kind superseded;
              4. send ONE message and assume the floor until Gemini's
                 turn ends.

            Before this existed, each cue source sent the instant it fired:
            [ANSWER_CORRECT] cancelled the tutor, [NEXT_ITEM] 2s later
            cancelled the reply to that, and the child heard neither.
            """
            # Entries held back from an earlier pass (TextQueueEntry.held).
            # They lead the next batch so FIFO order survives the hold.
            pending: List[TextQueueEntry] = []
            try:
                while True:
                    batch: List[TextQueueEntry] = []
                    await _collect(batch, None)
                    if pending:
                        batch = pending + batch
                        pending = []

                    # 1. Let the tutor finish — unless the caller said this
                    #    message earns the interruption. Anything the
                    #    lesson fires while we wait joins this batch
                    #    instead of cutting the sentence in half, so a
                    #    cue that arrives behind an interrupting one goes
                    #    out with it rather than chasing it.
                    waited_ms = 0
                    wedged = False
                    interrupting = any(i.interrupt for i in batch)
                    if floor.busy and not interrupting:
                        started = time.monotonic()
                        floor.yielded += 1
                        deadline = started + FLOOR_WATCHDOG_S
                        while floor.busy:
                            remaining = deadline - time.monotonic()
                            if remaining <= 0:
                                wedged = True
                                floor.wedged += 1
                                logger.error(
                                    f"Floor watchdog fired after {FLOOR_WATCHDOG_S}s — "
                                    "a Gemini turn never reported an end. Sending "
                                    "anyway; this is a bug, not backpressure."
                                )
                                break
                            await _collect(batch, min(remaining, 0.2))
                            interrupting = any(i.interrupt for i in batch)
                            if interrupting:
                                break
                        waited_ms = round((time.monotonic() - started) * 1000)

                    # 2. Trailing settle — bounded, so a steady drip of
                    #    cues still ships instead of being held forever.
                    settle_deadline = time.monotonic() + FLOOR_SETTLE_MAX_S
                    while time.monotonic() < settle_deadline:
                        if not await _collect(batch, FLOOR_SETTLE_S):
                            break

                    # 3. Supersede — narrowly. Four taps are one switch.
                    #    Everything else in the batch survives and rides
                    #    out together: "[ANSWER_CORRECT] then [NEXT_ITEM]"
                    #    is one coherent thing to say, not two
                    #    interruptions and not one fact thrown away.
                    kept: Dict[str, TextQueueEntry] = {}
                    for index, item in enumerate(batch):
                        key = item.supersedes_key(index)
                        if key in kept:
                            floor.superseded += 1
                            # delete-then-reinsert moves the survivor to
                            # the END of the (insertion-ordered) dict — the
                            # newest claim speaks in its arrival position.
                            del kept[key]
                        kept[key] = item

                    # 3.5. Hold -- a batch of nothing but held entries is not
                    #    a turn. It waits for the next floor-giving message
                    #    and leads it. Nothing is rendered here, so a held
                    #    switch that a later switch supersedes leaves no
                    #    trace (its render is never called).
                    survivors = list(kept.values())
                    if held_back(survivors):
                        pending = survivors
                        ledger.write(
                            "switch-held",
                            cues=len(survivors),
                            tags=[classify_cue(e.text) for e in survivors],
                        )
                        continue

                    parts = []
                    for item in kept.values():
                        rendered = item.render() if item.render else item.text
                        if rendered:
                            parts.append(rendered)
                    if not parts:
                        continue
                    floor.merged += len(parts) - 1

                    text = "\n\n".join(parts)
                    end_of_turn = any(e.end_of_turn for e in kept.values())

                    # Classify BEFORE attaching state: the cue tag is the
                    # message's identity, and it must survive a state block
                    # being prepended to it.
                    text_kind = classify_cue(text)

                    # This message is asking for a turn, so it is the right
                    # place to tell the model where the student currently
                    # is — no-ops when nothing changed since it last knew.
                    # UNLESS every entry in the batch is a scripted cue: a
                    # say-exactly line owns each word of its floor, and a
                    # state preamble on one gets narrated aloud, target
                    # answer and all (see TextQueueEntry.scripted). Nothing
                    # is lost — the state stays pending and rides the next
                    # unscripted floor-giving message.
                    if end_of_turn and any(not e.scripted for e in kept.values()):
                        text = primitive_state.attach(text)

                    cut_in = interrupting and floor.busy
                    if cut_in:
                        floor.interrupted += 1
                    logger.info(
                        f"Sending text to Gemini (end_of_turn={end_of_turn}, "
                        f"cues={len(parts)}, waited={waited_ms}ms"
                        f"{', CUT IN on the tutor (caller asked)' if cut_in else ''}"
                        f"{', WATCHDOG' if wedged else ''}): {text[:100]}..."
                    )
                    await session.send_realtime_input(text=text)
                    logger.info(f"Text sent to Gemini successfully")
                    ledger.write(
                        "text-to-gemini",
                        kind=text_kind,
                        end_of_turn=end_of_turn,
                        chars=len(text),
                        state_attached=primitive_state.attached,
                        # What the gate did to get here: how many cues went
                        # out as one turn, how many were dropped as stale,
                        # how long we held for the tutor, and whether we
                        # gave up and talked over it.
                        cues=len(parts),
                        superseded=floor.superseded,
                        waited_ms=waited_ms,
                        cut_in=cut_in,
                        wedged=wedged,
                        # 400, not 160. A judged-loop log has to answer "was
                        # the tutor's verdict RIGHT about this item", and the
                        # item rides in the [CURRENT STATE] block that
                        # PrimitiveState prepends — which alone runs ~190
                        # chars, so 160 truncated every cue at exactly the
                        # stimulus. Cost is a dev log file; the loss was a
                        # read-aloud drive whose correction could not be
                        # adjudicated after the fact (HUMAN-CHECKS #95).
                        preview=text[:400],
                    )

                    # The floor is now the model's. Set it here rather than
                    # waiting for its first audio frame: that ~500ms gap is
                    # precisely where back-to-back cues used to stampede.
                    # Unconditional, including end_of_turn=False — this
                    # transport has no way to speak without taking the
                    # floor (see TextQueueEntry), and the gate has to model
                    # what the wire does, not what we wish it did.
                    floor.take()

                    # Fault injection (dev only): the FIRST cue-classified
                    # text of an eligible session arms the mute window.
                    # Generic — keys off the bracket-tag class, never DI
                    # content.
                    if (
                        fault_mute["until"] == 0.0
                        and text_kind != "text"
                        and _fault_mute_allowed()
                        and _FAULT_MUTE_SESSIONS_ARMED["count"]
                            < int(getattr(settings, "LUMINA_FAULT_MUTE_EPISODES", 1) or 1)
                    ):
                        _FAULT_MUTE_SESSIONS_ARMED["count"] += 1
                        fault_mute["until"] = time.monotonic() + settings.LUMINA_FAULT_MUTE_S
                        logger.warning(
                            f"FAULT INJECTION: muting model output for "
                            f"{settings.LUMINA_FAULT_MUTE_S}s (episode "
                            f"{_FAULT_MUTE_SESSIONS_ARMED['count']})"
                        )
                        ledger.write(
                            "fault-mute-armed",
                            seconds=settings.LUMINA_FAULT_MUTE_S,
                            episode=_FAULT_MUTE_SESSIONS_ARMED["count"],
                            trigger=text_kind,
                        )

                    # Companion fault (dev only): forced connection drop N
                    # seconds after the first cue-classified text — drives
                    # the real gemini-error → transparent-resume path.
                    if (
                        fault_drop["at"] == 0.0
                        and text_kind != "text"
                        and _fault_drop_allowed()
                        and _FAULT_DROP_SESSIONS_ARMED["count"]
                            < int(getattr(settings, "LUMINA_FAULT_DROP_EPISODES", 1) or 1)
                    ):
                        _FAULT_DROP_SESSIONS_ARMED["count"] += 1
                        fault_drop["at"] = time.monotonic() + settings.LUMINA_FAULT_DROP_S
                        logger.warning(
                            f"FAULT INJECTION: Gemini connection will be force-dropped in "
                            f"{settings.LUMINA_FAULT_DROP_S}s (episode "
                            f"{_FAULT_DROP_SESSIONS_ARMED['count']})"
                        )
                        ledger.write(
                            "fault-drop-armed",
                            seconds=settings.LUMINA_FAULT_DROP_S,
                            episode=_FAULT_DROP_SESSIONS_ARMED["count"],
                            trigger=text_kind,
                        )
            except Exception as e:
                logger.error(f"Error sending text to Gemini: {e}")
                logger.error(f"Full traceback: {traceback.format_exc()}")

        async def handle_audio_to_gemini(session):
            """Send audio frames and client activity brackets, in order."""
            try:
                while True:
                    item = await audio_queue.get()
                    if isinstance(item, dict) and "activity" in item:
                        if item["activity"] == "activity_start":
                            await session.send_realtime_input(activity_start=types.ActivityStart())
                        else:
                            await session.send_realtime_input(activity_end=types.ActivityEnd())
                        logger.info(f"Sent {item['activity']} to Gemini")
                        ledger.write("activity-signal", signal=item["activity"])
                        continue
                    await session.send_realtime_input(
                        audio=types.Blob(
                            data=item,
                            mime_type=f"{FORMAT};rate={SEND_SAMPLE_RATE}"
                        )
                    )
                    logger.debug("Sent audio chunk to Gemini (%d bytes base64)", len(item))
            except Exception as e:
                logger.error(f"Error sending audio to Gemini: {e}")

        async def handle_gemini_responses(session) -> str:
            """Handle responses from Gemini and send to client via ws_send_queue.

            Returns a signal for the reconnection loop:
              - 'reconnect': Gemini sent GoAway, or the connection aborted while
                we hold a resumption handle — resume the SAME conversation.
              - 'stop': nothing left to resume (no handle) or terminal error.
            """
            def fault_muted() -> bool:
                """Dev fault injection: True while the armed mute window is
                open — the caller drops this piece of MODEL OUTPUT (audio /
                output transcription / text). Everything else (handles,
                GoAway, user transcription, turn ends) flows normally."""
                if fault_mute["until"] and time.monotonic() < fault_mute["until"]:
                    fault_mute["dropped"] += 1
                    return True
                if fault_mute["until"] and fault_mute["dropped"]:
                    ledger.write("fault-mute-expired", dropped=int(fault_mute["dropped"]))
                    fault_mute["dropped"] = 0.0
                return False

            turn_had_content = False
            turn_count = 0
            audio_frames = 0
            audio_bytes = 0

            async def turn_end(via: str) -> None:
                """One epilogue for both turn-end detection paths (explicit
                flag vs iterator exhaustion): log, ledger, free the floor,
                tell the client."""
                logger.info(
                    f"AI turn finished ({via}) — "
                    f"{audio_frames} audio frames, {audio_bytes} bytes."
                )
                ledger.write(
                    "gemini-turn-end", turn=turn_count, via=via,
                    audio_frames=audio_frames, audio_bytes=audio_bytes,
                )
                floor.release()
                await ws_send_queue.put({"type": "ai_turn_end"})

            try:
                while True:
                    turn_count += 1
                    logger.info(f"Waiting for Gemini response (turn {turn_count})...")
                    ledger.write("gemini-turn-start", turn=turn_count, resume=resume_count)
                    go_away_pending = False
                    turn_had_content = False
                    # Per-turn audio accounting. Without this, "the tutor
                    # went silent" could not be answered from telemetry:
                    # audio was logged at DEBUG and never ledgered, so a
                    # turn that transcribed 60 words and shipped ZERO audio
                    # frames looked identical to a healthy one (2026-08-08,
                    # turns 6-16 — eleven dead turns, found only by
                    # comparing turn duration against word count).
                    audio_frames = 0
                    audio_bytes = 0
                    async for response in session.receive():
                        # Dev fault injection: forced drop deadline reached —
                        # raise out of the receive loop, exactly the shape of
                        # a real 1011/1008 mid-generation connection death.
                        if fault_drop["at"] and time.monotonic() >= fault_drop["at"]:
                            fault_drop["at"] = 0.0
                            ledger.write("fault-drop-fired", turn=turn_count)
                            raise RuntimeError(
                                "FAULT INJECTION: forced Gemini connection drop "
                                "(LUMINA_FAULT_DROP_S)"
                            )

                        # Capture the rolling resumption handle. Passing this back
                        # on reconnect restores the conversation transparently.
                        sru = getattr(response, 'session_resumption_update', None)
                        if sru is not None and getattr(sru, 'new_handle', None):
                            resumption_handle["value"] = sru.new_handle
                            gemini_logger.debug("Stored session resumption handle")
                            # Forward to the client too, so that if the whole
                            # client socket drops, its reconnect can resume warm.
                            await ws_send_queue.put({
                                "type": "resumption_handle",
                                "handle": sru.new_handle,
                            })

                        # GoAway = Gemini's native "this connection is about to
                        # close" signal (the real liveness check). Flag it; we
                        # finish processing THIS response, then resume.
                        go_away = getattr(response, 'go_away', None)
                        if go_away is not None:
                            time_left = getattr(go_away, 'time_left', None)
                            logger.warning(f"Gemini GoAway received (time_left={time_left}); will resume")
                            # mid_turn=True means a generation was in flight when
                            # Gemini said goodbye — the resume path currently does
                            # NOT re-cue it (DI BACKLOG item 5 suspect (a)).
                            ledger.write(
                                "go-away",
                                time_left=time_left,
                                turn=turn_count,
                                mid_turn=turn_had_content,
                                pending_text=text_queue.qsize(),
                                pending_audio=audio_queue.qsize(),
                            )
                            go_away_pending = True

                        sc = getattr(response, 'server_content', None)
                        if sc:
                            turn_had_content = True
                            # Barge-in: Gemini cancelled the rest of its generation
                            # because the user started speaking (activity_start under
                            # manual VAD, or automatic VAD detection). Forward it
                            # immediately so the client flushes buffered tutor audio
                            # instead of playing a tail the model already abandoned.
                            if getattr(sc, 'interrupted', False):
                                logger.info("Gemini generation interrupted by user activity (barge-in)")
                                ledger.write("barge-in", turn=turn_count)
                                # The tutor abandoned this turn — the floor
                                # is free NOW, not at turn_complete.
                                floor.release()
                                await ws_send_queue.put({"type": "ai_interrupted"})

                            # Handle model turn (AI speaking)
                            model_turn = getattr(sc, 'model_turn', None)
                            for part in (getattr(model_turn, 'parts', None) or []):
                                # Handle text parts
                                if getattr(part, 'text', None):
                                    # Model thinking is not student-facing
                                    if getattr(part, 'thought', False):
                                        gemini_logger.info(f"Model thinking: {part.text[:100]}...")
                                        continue

                                    gemini_logger.info(f"Received text from Gemini: {part.text[:100]}...")
                                    clean_text = part.text.strip()
                                    if clean_text and not fault_muted():
                                        logger.info(f"AI text response: {clean_text}")

                                        await ws_send_queue.put({
                                            "type": "ai_response",
                                            "content": clean_text
                                        })

                                # Handle audio data
                                if getattr(part, 'inline_data', None):
                                    audio_data = getattr(part.inline_data, 'data', None)
                                    if audio_data:
                                        audio_frames += 1
                                        audio_bytes += len(audio_data)
                                        if not fault_muted():
                                            audio_b64 = base64.b64encode(audio_data).decode()
                                            logger.debug("Sending audio chunk to client (%d bytes)", len(audio_data))

                                            await ws_send_queue.put({
                                                "type": "ai_audio",
                                                "format": "raw-pcm",
                                                "sampleRate": RECEIVE_SAMPLE_RATE,
                                                "bitsPerSample": 16,
                                                "channels": CHANNELS,
                                                "data": audio_b64
                                            })
                                    else:
                                        gemini_logger.warning(f"inline_data present but no data: {part.inline_data}")

                            # Handle user's speech transcription
                            user_text = getattr(getattr(sc, 'input_transcription', None), 'text', None)
                            if user_text:
                                logger.info(f"User transcription: {user_text}")
                                ledger.write("user-transcript", turn=turn_count, text=user_text)

                                await ws_send_queue.put({
                                    "type": "user_transcription",
                                    "content": user_text
                                })

                            # Handle output transcription
                            ai_text = getattr(getattr(sc, 'output_transcription', None), 'text', None)
                            if ai_text:
                                logger.info(f"AI transcription: {ai_text}")
                                # Still ledgered when fault-muted: the ledger
                                # must show what Gemini SAID while the client
                                # heard nothing — that asymmetry IS the
                                # induced stall's diagnosable signature.
                                ledger.write("ai-transcript", turn=turn_count, text=ai_text)

                                if not fault_muted():
                                    await ws_send_queue.put({
                                        "type": "ai_transcription",
                                        "content": ai_text
                                    })

                            # Check for end of turn
                            if getattr(sc, 'turn_complete', False) or getattr(sc, 'end_of_turn', False):
                                await turn_end("flag")

                        # GoAway carried in this response: stop reading and resume.
                        if go_away_pending:
                            interrupt_state["mid_turn"] = turn_had_content
                            # This turn is over whatever it was doing — free
                            # the floor or every queued cue waits out the
                            # watchdog on a connection that no longer exists.
                            floor.release()
                            await ws_send_queue.put({
                                "type": "session_resuming",
                                "message": "Reconnecting to keep your tutor live…",
                            })
                            return 'reconnect'

                    # Fallback: when the receive() iterator completes, the turn is done
                    # even if no explicit end_of_turn flag was set on any response
                    await turn_end("iterator")

            except WebSocketDisconnect:
                logger.info("WebSocket disconnected while receiving from Gemini.")
                return 'stop'
            except asyncio.CancelledError:
                logger.info("Gemini response handler task was cancelled.")
                raise
            except Exception as e:
                # The Gemini connection dropped (e.g. 1008 abort, network).
                # If we hold a resumption handle, resume the conversation;
                # otherwise there's nothing to continue from.
                # Free the floor first: a turn that died with its
                # connection holds it forever otherwise, and every queued
                # cue would sit out the full ceiling before shipping.
                floor.release()
                logger.error(f"Error handling Gemini responses: {e}")
                logger.error(f"Full traceback: {traceback.format_exc()}")
                ledger.write(
                    "gemini-error",
                    error=str(e),
                    will_resume=bool(resumption_handle["value"]),
                )
                if resumption_handle["value"]:
                    logger.info("Resumption handle present — will resume after drop")
                    # A turn was streaming when the connection died → the
                    # student heard the tutor cut off mid-sentence; the
                    # resume must finish the thought, not re-greet.
                    interrupt_state["mid_turn"] = turn_had_content
                    await ws_send_queue.put({
                        "type": "session_resuming",
                        "message": "Reconnecting to keep your tutor live…",
                    })
                    return 'reconnect'
                return 'stop'

        # ------------------------------------------------------------------
        # Client-facing tasks live for the WHOLE session — they read/write the
        # client WebSocket and queues, independent of any single Gemini
        # connection, so they survive transparent Gemini resumes.
        # ------------------------------------------------------------------
        client_tasks = [
            asyncio.create_task(handle_client_messages()),
            asyncio.create_task(ws_sender()),
        ]
        logger.info(f"Client-facing tasks started (mode={session_mode})")

        # Cap on resumes so a flapping connection can't loop forever.
        MAX_RESUMES = 50
        resume_count = 0

        try:
            # Transparent reconnection loop. Each iteration owns one Gemini
            # connection; on GoAway / drop (with a handle) we loop and resume
            # the same conversation without the client noticing.
            while not stop_event.is_set():
                resuming = resumption_handle["value"] is not None
                config = build_gemini_config(resumption_handle["value"])

                try:
                    async with client.aio.live.connect(model=MODEL, config=config) as session:
                        gemini_session = session
                        logger.info(
                            f"Gemini Live session connected "
                            f"({'resuming' if resuming else 'fresh'}, resume #{resume_count})"
                        )
                        ledger.write(
                            "gemini-connected",
                            fresh=not resuming,
                            resume=resume_count,
                            pending_text=text_queue.qsize(),
                            pending_audio=audio_queue.qsize(),
                        )

                        if resuming:
                            await ws_send_queue.put({
                                "type": "session_resumed",
                                "message": "Tutor reconnected — right where you left off.",
                            })
                            # Conversational continuity (2026-08-05 session
                            # review): the transport resumes in ~0.5s but the
                            # model, unsteered, re-greets ("Which part do you
                            # want to explore?") instead of continuing. If it
                            # was cut mid-sentence, give it the floor to
                            # finish the thought; otherwise inject a silent
                            # note so its NEXT turn continues naturally.
                            was_mid_turn = interrupt_state["mid_turn"]
                            interrupt_state["mid_turn"] = False
                            ledger.write("resume-steering", mid_turn=was_mid_turn)
                            if was_mid_turn:
                                await text_queue.put(TextQueueEntry(
                                    text=(
                                        "[SESSION RESUMED] The connection dropped for a moment while "
                                        "you were speaking and is now restored. Pick your answer back "
                                        "up where it was cut off and finish the thought in one or two "
                                        "sentences. Do NOT greet the student again, do NOT re-introduce "
                                        "the activity, and do NOT ask what they want to explore. Never "
                                        "say this tag aloud or mention the disconnection."
                                    ),
                                    end_of_turn=True,
                                ))
                            else:
                                await text_queue.put(TextQueueEntry(
                                    text=(
                                        "[SESSION RESUMED] The connection dropped for a moment and is "
                                        "now restored. Nothing was lost. Stay quiet and keep waiting "
                                        "for the student. When you next speak, continue naturally from "
                                        "where the conversation left off — do NOT greet the student "
                                        "again, re-introduce the activity, or ask what they want to "
                                        "explore. Never say this tag aloud or mention the disconnection."
                                    ),
                                    end_of_turn=False,
                                ))

                        # Per-connection Gemini I/O tasks. Queues persist across
                        # reconnects, so any text/audio queued mid-drop still sends.
                        gemini_tasks = [
                            asyncio.create_task(handle_text_to_gemini(session)),
                            asyncio.create_task(handle_audio_to_gemini(session)),
                        ]
                        response_task = asyncio.create_task(handle_gemini_responses(session))
                        stop_task = asyncio.create_task(stop_event.wait())

                        # End this connection when Gemini's response handler returns
                        # (turn loop ended / GoAway / drop) OR the client disconnects.
                        done, _ = await asyncio.wait(
                            {response_task, stop_task},
                            return_when=asyncio.FIRST_COMPLETED,
                        )

                        for t in (*gemini_tasks, response_task, stop_task):
                            if not t.done():
                                t.cancel()
                        await asyncio.gather(*gemini_tasks, response_task, stop_task,
                                             return_exceptions=True)

                        outcome = response_task.result() if response_task in done else 'stop'
                except Exception as connect_err:
                    # connect() (or its teardown) failed. If we were resuming,
                    # the handle is likely stale/expired — drop it and retry cold
                    # so the student keeps a working tutor instead of a dead one.
                    logger.error(f"Gemini connect failed (resuming={resuming}): {connect_err}")
                    ledger.write("gemini-connect-failed", resuming=resuming, error=str(connect_err))
                    if resuming:
                        logger.info("Discarding stale resumption handle; retrying cold")
                        resumption_handle["value"] = None
                        resume_count += 1
                        if resume_count > MAX_RESUMES:
                            break
                        continue
                    break

                # Client gone → end the whole session.
                if stop_event.is_set():
                    break

                if outcome == 'reconnect' and resumption_handle["value"]:
                    resume_count += 1
                    if resume_count > MAX_RESUMES:
                        logger.warning("Max Gemini resumes reached — ending session")
                        ledger.write("max-resumes", resumes=resume_count)
                        break
                    logger.info(f"Resuming Gemini session (attempt {resume_count})")
                    ledger.write(
                        "gemini-resume",
                        attempt=resume_count,
                        pending_text=text_queue.qsize(),
                        pending_audio=audio_queue.qsize(),
                    )
                    continue

                # No handle / terminal outcome → stop.
                break
        finally:
            ledger.write(
                "floor-gate-summary",
                yielded=floor.yielded,
                superseded=floor.superseded,
                merged=floor.merged,
                interrupted=floor.interrupted,
                wedged=floor.wedged,
            )
            for t in client_tasks:
                if not t.done():
                    t.cancel()
            await asyncio.gather(*client_tasks, return_exceptions=True)

        # Notify the client the tutor session has truly ended (we exhausted
        # resumes or there was nothing to resume). Skipped if the client itself
        # disconnected — there's no one to tell. Without this the socket would
        # just go quiet and the frontend couldn't distinguish "ended" from
        # "still thinking" or offer a fresh reconnect.
        if not stop_event.is_set():
            try:
                await websocket.send_json({
                    "type": "session_ended",
                    "reason": "gemini_session_closed",
                    "message": "The tutor session has ended. Reconnect to keep going.",
                })
                logger.info("Sent session_ended notification to client")
            except Exception as notify_err:
                logger.info(f"Could not send session_ended (client likely gone): {notify_err}")

    except WebSocketDisconnect:
        logger.info("Lumina Tutor WebSocket disconnected")
        ledger.write("ws-disconnected")
    except asyncio.TimeoutError:
        logger.error("Authentication timeout in Lumina tutor session")
        ledger.write("auth-timeout")
        try:
            await websocket.close(code=4008, reason="Authentication timeout")
        except:
            pass
    except Exception as e:
        logger.error(f"Lumina tutor session error: {e}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        ledger.write("session-error", error=str(e), error_type=type(e).__name__)
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except:
            pass
    finally:
        if gemini_session:
            try:
                await gemini_session.close()
                logger.info("Gemini session ended")
            except:
                pass

        # Log final metrics. Hint counts live client-side now (hints arrive as
        # composed `text`); per-send detail is already in the ledger's
        # text-to-gemini events.
        logger.info(f"Session metrics (mode={session_mode}) - Interactions: {counters.total_interactions}, Turns: {counters.conversation_turns}, Voice: {counters.voice_interactions}")
        ledger.write(
            "session-end",
            mode=session_mode,
            primitive=primitive_type,
            interactions=counters.total_interactions,
            turns=counters.conversation_turns,
            voice=counters.voice_interactions,
        )
        ledger.close()
        logger.info("Lumina tutor session cleanup completed")
