# backend/app/api/endpoints/lumina_tutor.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
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
# Typed text queue entry — allows context updates to be injected into Gemini's
# context window without triggering a response (end_of_turn=False).
# ---------------------------------------------------------------------------
@dataclass
class TextQueueEntry:
    """Entry for the text queue with control over Gemini turn behavior."""
    text: str
    end_of_turn: bool = True  # True = expect a response; False = silent injection


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


class SwitchDebouncer:
    """Coalesce rapid primitive switches so the tutor greets only where the
    student LANDS. A child flipping through lesson tabs generates one switch
    per tap, and announcing each made the tutor greet activities the student
    had already left (observed live 2026-08-05: 7 greetings in ~40s).
    Trailing debounce: every push (re)starts the settle clock; only the final
    switch inside the window is announced."""

    def __init__(self, announce, settle_s: float) -> None:
        self._announce = announce  # async callback(switch_payload: Dict)
        self._settle_s = settle_s
        self._pending: Optional[Dict] = None
        self._task: Optional[asyncio.Task] = None
        self.coalesced = 0  # switches superseded before they were announced

    def push(self, switch_payload: Dict) -> None:
        if self._pending is not None:
            self.coalesced += 1
        self._pending = switch_payload
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = asyncio.create_task(self._flush_later())

    async def _flush_later(self) -> None:
        try:
            await asyncio.sleep(self._settle_s)
        except asyncio.CancelledError:
            return
        pending, self._pending = self._pending, None
        if pending is not None:
            await self._announce(pending)

    async def aclose(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass


class ContextUpdateGate:
    """Hold "silent" state injections until the tutor is not mid-turn.

    Context updates are queued with end_of_turn=False to mean: put this in the
    model's context WITHOUT giving it the floor. The Live API has no such mode —
    send_realtime_input(text=...) always closes the turn AND registers as user
    activity, so an update landing mid-generation interrupts the tutor. A real
    session showed 9 of 17 barge-ins were caused by our own sends, four of them
    by these supposedly-silent updates; one clipped a celebration at its first
    word ("Perf—", then a restart 1.6s later). 2026-08-06 session review.

    So while the model holds the floor the newest update is parked and earlier
    ones dropped — a slider dragged across twenty positions is one state, not
    twenty. The parked update is re-queued when the turn ends, or after
    MAX_HOLD_S if the model answered with silence and no turn end ever arrives.

    Only end_of_turn=False traffic is gated. Cues that deliberately ask for a
    response go straight through; interrupting for those is the point.
    """

    # Longest a state update may sit parked. A normal turn ends well inside
    # this; the ceiling exists so a silent model can't strand the update.
    MAX_HOLD_S = 8.0

    def __init__(self, requeue, ledger) -> None:
        self._requeue = requeue  # async callback(text: str)
        self._ledger = ledger
        self._pending: Optional[str] = None
        self._timer: Optional[asyncio.Task] = None
        self._busy = False
        self.held = 0       # updates parked instead of interrupting
        self.coalesced = 0  # parked updates superseded before release

    def floor_taken(self) -> None:
        """A model turn is in flight — gate silent updates from here."""
        self._busy = True

    async def floor_released(self) -> None:
        """The model's turn ended; anything parked can go now. Idempotent —
        turn ends are signalled twice (turn_complete flag + iterator end)."""
        self._busy = False
        await self._release()

    async def reset(self) -> None:
        """New Gemini connection: nothing is in flight on it."""
        self._busy = False
        await self._release()

    async def admit(self, text: str) -> bool:
        """True → send it now. False → parked until the floor frees."""
        if not self._busy:
            return True
        if self._pending is None:
            self.held += 1
        else:
            self.coalesced += 1
        self._pending = text
        self._cancel_timer()
        self._timer = asyncio.create_task(self._release_later())
        self._ledger.write("context-update-held", held=self.held, coalesced=self.coalesced)
        return False

    async def _release_later(self) -> None:
        try:
            await asyncio.sleep(self.MAX_HOLD_S)
        except asyncio.CancelledError:
            return
        # Clear the handle BEFORE releasing: _release cancels the timer, and
        # this coroutine IS the timer — cancelling ourselves mid-release would
        # abort the re-queue at its first await.
        self._timer = None
        self._ledger.write("context-update-hold-expired", seconds=self.MAX_HOLD_S)
        self._busy = False
        await self._release()

    async def _release(self) -> None:
        self._cancel_timer()
        pending, self._pending = self._pending, None
        if pending is not None:
            await self._requeue(pending)

    def _cancel_timer(self) -> None:
        if self._timer and not self._timer.done():
            self._timer.cancel()
        self._timer = None

    async def aclose(self) -> None:
        self._cancel_timer()


# How long a switch must go un-superseded before the tutor is told about it.
# Long enough to swallow tab-flipping, short enough that a deliberate landing
# still gets a timely greeting.
SWITCH_SETTLE_S = 2.5


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


def interpolate_template(template: str, data: Dict) -> str:
    """
    Replace {{key}} placeholders with values from data dict (lenient).
    Unresolved placeholders are dropped. NEVER emit a filler marker: the model
    reads this text, and a real session showed the tutor speaking a literal
    "(not set)" aloud to a 5-year-old (2026-08-05 review, seq 584).
    """
    import re
    def replacer(match):
        key = match.group(1).strip()
        value = data.get(key)
        if value is None:
            return ''
        return str(value)
    return re.sub(r'\{\{(\w+)\}\}', replacer, template)


def interpolate_line(template: str, data: Dict) -> Optional[str]:
    """
    Strict variant for SCRIPT lines (scaffolding levels, struggle responses):
    a line with an unresolved placeholder is not a usable script — dropping the
    whole line beats shipping a sentence with a hole in it. Returns None when
    any placeholder is unresolved (or the template is empty).
    """
    import re
    if not template:
        return None
    if any(data.get(m.group(1).strip()) is None
           for m in re.finditer(r'\{\{(\w+)\}\}', template)):
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
# ---------------------------------------------------------------------------

async def build_lumina_system_instruction(
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

    # Build lesson progression awareness
    previous_activities = ordered_components[:current_index] if current_index > 0 else []
    current_activity = ordered_components[current_index] if current_index < len(ordered_components) else {}
    upcoming_activities = ordered_components[current_index + 1:] if current_index < len(ordered_components) - 1 else []

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

**QUESTIONS FROM THE STUDENT — this outranks every scripted beat above:**
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
  idea and changing the subject is not an answer.

**HINT PROGRESSION SYSTEM:**
When the student requests a hint, respond based on the level they request:

- **Level 1 (Gentle Nudge):** Ask a thought-provoking question or give a subtle pointer. Example: "What do you notice about the first sound?"
- **Level 2 (Specific Guidance):** Break down the problem into smaller steps. Example: "Let's focus on just the first two sounds. Can you blend /k/ and /æ/ together?"
- **Level 3 (Detailed Walkthrough):** Provide step-by-step guidance without giving the answer. Example: "Start with /k/, add /æ/ to make 'ca', then add /t/ at the end."

**CONTEXT MESSAGES (never speak in response to these):**
- [CONTEXT UPDATE]: silent state change (slider moved, option selected). Note it and STAY SILENT — do not comment, narrate, or ask about it. The student is exploring; narrating every move teaches them to stop and listen instead of play. Only exception: clear struggle (repeated failed attempts on the same thing).
- [STUDENT ACTION]: a logged interaction. Note it silently.
- [SESSION RESUMED]: the connection was briefly restored. Follow its instruction exactly; never say the tag aloud or mention any disconnection to the student.
- Messages that explicitly script a line for you (e.g. 'Celebrate and explain: "..."') are the ONLY state changes you narrate.

**INTERACTION RULES:**
- Keep responses SHORT (1-2 sentences max)
- Use encouraging, supportive tone appropriate for {grade_level} students
- Ask AT MOST ONE question per response — never stack two questions in one breath
- Most responses END WITH A STATEMENT, not a question. Save questions for moments that need the student's thinking: a struggle, a misconception, a prediction before they act. After a celebration or an observation, stop — do not add a closing question.
- Reference lesson context naturally without being formulaic
- Use the student's name if provided
- Celebrate milestones; skip praise for routine moves
- If student is stuck after Level 3 hint, encourage them to try and provide reassurance

**IMPORTANT:**
- NEVER solve the problem for the student (their own curiosity questions are not the problem — answer those directly, per QUESTIONS FROM THE STUDENT)
- ALWAYS wait for the student to respond before continuing (except for [PRONOUNCE] commands)
- BE PATIENT - learning takes time
- ENCOURAGE mistakes as learning opportunities
- NEVER invent, create, or advance to new challenges on your own. The app UI controls all challenge progression. After responding, STOP and wait silently. Do not fill silence by presenting new content.
"""

    return system_instruction


async def build_lesson_system_instruction(
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
move to a new activity, and [CONTEXT UPDATE] messages as their state changes within
an activity. Adapt your guidance accordingly.

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

**QUESTIONS FROM THE STUDENT — this outranks every scripted beat above:**
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
  idea and changing the subject is not an answer.

**HINT PROGRESSION SYSTEM:**
When the student requests a hint, respond based on the level they request:

- **Level 1 (Gentle Nudge):** Ask a thought-provoking question or give a subtle pointer.
- **Level 2 (Specific Guidance):** Break down the problem into smaller steps.
- **Level 3 (Detailed Walkthrough):** Provide step-by-step guidance without giving the answer.

**CONTEXT MESSAGES (never speak in response to these):**
- [CONTEXT UPDATE]: silent state change (slider moved, option selected). Note it and STAY SILENT — do not comment, narrate, or ask about it. The student is exploring; narrating every move teaches them to stop and listen instead of play. Only exception: clear struggle (repeated failed attempts on the same thing).
- [STUDENT ACTION]: a logged interaction. Note it silently.
- [SESSION RESUMED]: the connection was briefly restored. Follow its instruction exactly; never say the tag aloud or mention any disconnection to the student.
- Messages that explicitly script a line for you (e.g. 'Celebrate and explain: "..."') are the ONLY state changes you narrate.

**INTERACTION RULES:**
- Keep responses SHORT (1-2 sentences max)
- Use encouraging, supportive tone appropriate for {grade_level} students
- Ask AT MOST ONE question per response — never stack two questions in one breath
- Most responses END WITH A STATEMENT, not a question. Save questions for moments that need the student's thinking: a struggle, a misconception, a prediction before they act. After a celebration or an observation, stop — do not add a closing question.
- Reference lesson context naturally without being formulaic
- Celebrate milestones; skip praise for routine moves
- If student is stuck after Level 3 hint, encourage them to try and provide reassurance

**IMPORTANT:**
- NEVER solve the problem for the student (their own curiosity questions are not the problem — answer those directly, per QUESTIONS FROM THE STUDENT)
- ALWAYS wait for the student to respond before continuing (except for [PRONOUNCE] commands)
- BE PATIENT - learning takes time
- ENCOURAGE mistakes as learning opportunities
- NEVER invent, create, or advance to new challenges on your own. The app UI controls all challenge progression. After responding, STOP and wait silently. Do not fill silence by presenting new content.
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
    hints_given = {"level1": 0, "level2": 0, "level3": 0}
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
        )

        # Send authentication success (safe: no concurrency yet)
        await websocket.send_json({
            "type": "auth_success",
            "message": "Lumina AI connected and ready to help!"
        })

        # Step 2: Build system instruction based on session mode
        if session_mode == "lesson":
            system_instruction = await build_lesson_system_instruction(
                lesson_context, student_progress
            )
            logger.info(f"Lesson-mode system instruction built for: {lesson_context.get('topic', 'Unknown')}")
        else:
            system_instruction = await build_lumina_system_instruction(
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

        # Debounced primitive-switch announcements: the tutor is only told
        # about the switch the student SETTLES on (see SwitchDebouncer).
        announced_primitive = {"value": primitive_type}

        async def _announce_switch(sw: Dict[str, Any]) -> None:
            scaffold_text = get_primitive_specific_instructions(
                sw["primitive_type"], sw["primitive_data"], sw["tutoring"]
            )
            from_type = announced_primitive["value"]
            announced_primitive["value"] = sw["primitive_type"]
            switch_message = (
                f"[PRIMITIVE SWITCH] The student has moved to a new activity.\n"
                f"Previous activity: {from_type}\n"
                f"New activity: {sw['primitive_type']} (instance: {sw['instance_id']})\n\n"
                f"{scaffold_text}\n\n"
                f"Greet the student briefly for this new activity. Keep it to one sentence. "
                f"If relevant, connect to what they just finished in {from_type}."
            )
            ledger.write(
                "switch-announced",
                to_primitive=sw["primitive_type"],
                from_primitive=from_type,
                coalesced=switch_debouncer.coalesced,
            )
            await text_queue.put(TextQueueEntry(text=switch_message, end_of_turn=True))

        switch_debouncer = SwitchDebouncer(_announce_switch, SWITCH_SETTLE_S)

        async def _requeue_context(text: str) -> None:
            await text_queue.put(TextQueueEntry(text=text, end_of_turn=False))

        # Keeps silent state injections from barging in on the tutor mid-turn.
        context_gate = ContextUpdateGate(_requeue_context, ledger)

        if True:
            # Send session ready message via the send queue
            await ws_send_queue.put({
                "type": "session_ready",
                "message": "Lumina AI is ready to help you learn!"
            })

            # Queue initial greeting based on session mode.
            # Skip it entirely on a warm client reconnect (handle supplied): Gemini
            # restores the prior conversation, so a fresh greeting would duplicate.
            if initial_resumption_handle:
                logger.info("Resumption handle supplied on connect — skipping greeting (warm resume)")
            elif session_mode == "lesson":
                # In lesson mode, send first primitive's scaffold as a text message,
                # then greet. This gives Gemini the specific context.
                first_scaffold = get_primitive_specific_instructions(
                    primitive_type, primitive_data, tutoring_scaffold
                )
                await text_queue.put(TextQueueEntry(
                    text=(
                        f"The student is starting the lesson. Their first activity is: {primitive_type}\n\n"
                        f"{first_scaffold}\n\n"
                        f"Greet the student warmly for this lesson and let them know you're here to help. "
                        f"Keep it brief and encouraging."
                    ),
                    end_of_turn=True,
                ))
                logger.info("Initial greeting prompt queued")
            else:
                await text_queue.put(TextQueueEntry(
                    text=(
                        "Greet the student warmly and let them know you're here to help them "
                        "with this activity. Keep it brief and encouraging."
                    ),
                    end_of_turn=True,
                ))
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
                """Handle messages from the frontend client"""
                nonlocal primitive_type, instance_id, primitive_data, tutoring_scaffold

                try:
                    while True:
                        message = await websocket.receive_json()
                        message_type = message.get("type")

                        # Track interactions (audio frames are transport, not turns)
                        counters.observe(message_type)

                        if message_type == "request_hint":
                            # Handle tiered hint request
                            hint_level = message.get("hint_level", 1)
                            current_state = message.get("current_state", {})

                            # Track hint usage
                            hints_given[f"level{hint_level}"] += 1

                            logger.info(f"Hint request (Level {hint_level}) - Total hints: {sum(hints_given.values())}")

                            # Build hint request for Gemini
                            hint_request = f"The student is requesting a Level {hint_level} hint. "

                            if hint_level == 1:
                                hint_request += "Give a gentle nudge - ask a thought-provoking question or point them in the right direction."
                            elif hint_level == 2:
                                hint_request += "Give specific guidance - break down the problem into smaller steps they can tackle."
                            elif hint_level == 3:
                                hint_request += "Give a detailed walkthrough - guide them step-by-step without revealing the answer directly."

                            # Add current state context if provided
                            if current_state:
                                hint_request += f"\n\nCurrent state: {json.dumps(current_state)}"

                            await text_queue.put(TextQueueEntry(text=hint_request, end_of_turn=True))

                            # Send metrics update to client
                            await ws_send_queue.put({
                                "type": "metrics_update",
                                "hintsGiven": hints_given,
                                "totalInteractions": counters.total_interactions
                            })

                        elif message_type == "update_context":
                            # Handle real-time primitive state updates
                            new_state = message.get("primitive_data", {})
                            progress_update = message.get("student_progress", {})

                            logger.info(f"Context update received for {primitive_type}")
                            ledger.write(
                                "context-update",
                                primitive=primitive_type,
                                keys=list(new_state.keys()),
                            )

                            # Forward state change to Gemini (silent — no response expected).
                            # end_of_turn=False injects context without giving Gemini the
                            # floor; the system prompt also says to ignore [CONTEXT UPDATE]
                            # unless the student is clearly struggling.
                            context_lines = [f"  {k}: {v}" for k, v in new_state.items()]
                            context_summary = (
                                f"[CONTEXT UPDATE] The student's current state has changed:\n"
                                + "\n".join(context_lines)
                            )
                            if progress_update:
                                context_summary += f"\nStudent progress: {json.dumps(progress_update)}"

                            await text_queue.put(TextQueueEntry(
                                text=context_summary,
                                end_of_turn=False,
                            ))

                        elif message_type == "student_action":
                            # Forward pedagogically significant student actions to Gemini
                            action = message.get("action", "unknown")
                            details = message.get("details", {})

                            logger.info(f"Student action: {action} - {details}")

                            action_text = f"[STUDENT ACTION] {action}"
                            if details:
                                action_text += f": {json.dumps(details)}"

                            await text_queue.put(TextQueueEntry(
                                text=action_text,
                                end_of_turn=True,
                            ))

                        elif message_type == "switch_primitive":
                            # Handle primitive context switch within a lesson session
                            new_primitive = message.get("primitive_context", {})
                            old_type = primitive_type

                            # Update tracking variables
                            primitive_type = new_primitive.get("primitive_type", "unknown")
                            instance_id = new_primitive.get("instance_id", "unknown")
                            primitive_data = new_primitive.get("primitive_data", {})
                            tutoring_scaffold = new_primitive.get("tutoring")

                            logger.info(f"Switching primitive: {old_type} -> {primitive_type} (instance: {instance_id})")
                            ledger.write(
                                "switch-primitive",
                                from_primitive=old_type,
                                to_primitive=primitive_type,
                                instance=instance_id,
                            )

                            # Debounced: a child flipping tabs fires a switch
                            # per tap; only the one they SETTLE on is announced
                            # to Gemini (scaffold + one-sentence greeting).
                            switch_debouncer.push({
                                "primitive_type": primitive_type,
                                "instance_id": instance_id,
                                "primitive_data": primitive_data,
                                "tutoring": tutoring_scaffold,
                            })

                            # Confirm switch to frontend immediately (UI state
                            # never waits on the settle window)
                            await ws_send_queue.put({
                                "type": "primitive_switched",
                                "primitive_type": primitive_type,
                                "instance_id": instance_id,
                            })

                        elif message_type == "text":
                            # Handle regular text interaction
                            content = message.get("content", "")
                            await text_queue.put(TextQueueEntry(text=content, end_of_turn=True))

                        elif message_type == "audio":
                            # Handle audio input
                            audio_data = message.get("data") or message.get("audio_data")
                            if audio_data:
                                await audio_queue.put(audio_data)
                                logger.debug(f"Queued audio data ({len(audio_data)} bytes base64)")

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

            async def handle_text_to_gemini(session):
                """Send text messages to Gemini using realtime input.

                Gemini 3.1+ rejects send_client_content mid-session (1007 error).
                Must use send_realtime_input for all mid-session text.
                """
                try:
                    while True:
                        entry = await text_queue.get()

                        # Support both TextQueueEntry and plain strings (backward compat)
                        if isinstance(entry, TextQueueEntry):
                            text = entry.text
                            end_of_turn = entry.end_of_turn
                        else:
                            text = str(entry)
                            end_of_turn = True

                        # end_of_turn=False means "context, not a prompt". The
                        # Live API can't express that — every realtime text send
                        # closes the turn and interrupts an in-flight generation —
                        # so honour it by WAITING instead: park the update until
                        # the tutor stops speaking (see ContextUpdateGate).
                        if not end_of_turn and not await context_gate.admit(text):
                            logger.info(
                                f"Holding context update until the tutor's turn ends: {text[:80]}..."
                            )
                            continue

                        logger.info(f"Sending text to Gemini (end_of_turn={end_of_turn}): {text[:100]}...")
                        await session.send_realtime_input(text=text)
                        logger.info(f"Text sent to Gemini successfully")
                        # We just handed Gemini the floor; gate silent updates
                        # until its turn closes.
                        if end_of_turn:
                            context_gate.floor_taken()
                        text_kind = classify_cue(text)
                        ledger.write(
                            "text-to-gemini",
                            kind=text_kind,
                            end_of_turn=end_of_turn,
                            chars=len(text),
                            preview=text[:160],
                        )

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
                        logger.debug(f"Sent audio chunk to Gemini ({len(item)} bytes base64)")
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
                try:
                    turn_count = 0
                    while True:
                        turn_count += 1
                        logger.info(f"Waiting for Gemini response (turn {turn_count})...")
                        ledger.write("gemini-turn-start", turn=turn_count, resume=resume_count)
                        go_away_pending = False
                        turn_had_content = False
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

                            if hasattr(response, 'server_content') and response.server_content:
                                turn_had_content = True
                                # Barge-in: Gemini cancelled the rest of its generation
                                # because the user started speaking (activity_start under
                                # manual VAD, or automatic VAD detection). Forward it
                                # immediately so the client flushes buffered tutor audio
                                # instead of playing a tail the model already abandoned.
                                if getattr(response.server_content, 'interrupted', False):
                                    logger.info("Gemini generation interrupted by user activity (barge-in)")
                                    ledger.write("barge-in", turn=turn_count)
                                    await ws_send_queue.put({"type": "ai_interrupted"})

                                # Handle model turn (AI speaking)
                                if hasattr(response.server_content, 'model_turn') and response.server_content.model_turn:
                                    model_turn = response.server_content.model_turn
                                    # The tutor is speaking. Catches turns the
                                    # student opened by voice, which no text send
                                    # of ours announced.
                                    context_gate.floor_taken()

                                    if hasattr(model_turn, 'parts') and model_turn.parts:
                                        for part in model_turn.parts:
                                            # Debug: log part attributes
                                            part_attrs = [a for a in dir(part) if not a.startswith('_')]
                                            gemini_logger.debug(f"Part attributes: {part_attrs}")

                                            # Handle text parts
                                            if hasattr(part, 'text') and part.text:
                                                # Check if this is model thinking (not student-facing)
                                                is_thought = getattr(part, 'thought', False)
                                                if is_thought:
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
                                            if hasattr(part, 'inline_data') and part.inline_data:
                                                audio_data = getattr(part.inline_data, 'data', None)
                                                if audio_data:
                                                    if not fault_muted():
                                                        import base64
                                                        audio_b64 = base64.b64encode(audio_data).decode()
                                                        logger.debug(f"Sending audio chunk to client ({len(audio_data)} bytes)")

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
                                if hasattr(response.server_content, 'input_transcription') and response.server_content.input_transcription:
                                    if hasattr(response.server_content.input_transcription, 'text') and response.server_content.input_transcription.text:
                                        logger.info(f"User transcription: {response.server_content.input_transcription.text}")
                                        ledger.write(
                                            "user-transcript",
                                            turn=turn_count,
                                            text=response.server_content.input_transcription.text,
                                        )

                                        await ws_send_queue.put({
                                            "type": "user_transcription",
                                            "content": response.server_content.input_transcription.text
                                        })

                                # Handle output transcription
                                if hasattr(response.server_content, 'output_transcription') and response.server_content.output_transcription:
                                    if hasattr(response.server_content.output_transcription, 'text') and response.server_content.output_transcription.text:
                                        logger.info(f"AI transcription: {response.server_content.output_transcription.text}")
                                        # Still ledgered when fault-muted: the ledger
                                        # must show what Gemini SAID while the client
                                        # heard nothing — that asymmetry IS the
                                        # induced stall's diagnosable signature.
                                        ledger.write(
                                            "ai-transcript",
                                            turn=turn_count,
                                            text=response.server_content.output_transcription.text,
                                        )

                                        if not fault_muted():
                                            await ws_send_queue.put({
                                                "type": "ai_transcription",
                                                "content": response.server_content.output_transcription.text
                                            })

                                # Check for end of turn
                                if getattr(response.server_content, 'turn_complete', False) or getattr(response.server_content, 'end_of_turn', False):
                                    logger.info("AI turn finished (flag detected).")
                                    ledger.write("gemini-turn-end", turn=turn_count, via="flag")
                                    await context_gate.floor_released()
                                    await ws_send_queue.put({"type": "ai_turn_end"})

                            # GoAway carried in this response: stop reading and resume.
                            if go_away_pending:
                                interrupt_state["mid_turn"] = turn_had_content
                                await ws_send_queue.put({
                                    "type": "session_resuming",
                                    "message": "Reconnecting to keep your tutor live…",
                                })
                                return 'reconnect'

                        # Fallback: when the receive() iterator completes, the turn is done
                        # even if no explicit end_of_turn flag was set on any response
                        logger.info("AI turn finished (iterator ended).")
                        ledger.write("gemini-turn-end", turn=turn_count, via="iterator")
                        await context_gate.floor_released()
                        await ws_send_queue.put({"type": "ai_turn_end"})

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
                            # Fresh connection: nothing holds the floor on it, so
                            # anything parked mid-drop is free to go.
                            await context_gate.reset()

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
                            done, pending = await asyncio.wait(
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
                await switch_debouncer.aclose()
                await context_gate.aclose()
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

        # Log final metrics
        logger.info(f"Session metrics (mode={session_mode}) - Hints: {hints_given}, Interactions: {counters.total_interactions}, Turns: {counters.conversation_turns}, Voice: {counters.voice_interactions}")
        ledger.write(
            "session-end",
            mode=session_mode,
            primitive=primitive_type,
            hints=hints_given,
            interactions=counters.total_interactions,
            turns=counters.conversation_turns,
            voice=counters.voice_interactions,
        )
        ledger.close()
        logger.info("Lumina tutor session cleanup completed")
