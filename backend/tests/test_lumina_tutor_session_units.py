"""Units for the lesson-tutor slice of 2026-08-06 (DI BACKLOG item 11):
curiosity-question carve-out, "(not set)" elimination, switch debounce, and
honest session counters. Each test names the live failure it pins.

Live evidence: qa/tutor-reports/lumina-session-review-2026-08-05.md.
"""
import asyncio

from app.api.endpoints.lumina_tutor import (
    ContextUpdateGate,
    SessionCounters,
    SwitchDebouncer,
    build_lesson_system_instruction,
    build_lumina_system_instruction,
    get_primitive_specific_instructions,
    interpolate_line,
    interpolate_template,
)


# ---------------------------------------------------------------------------
# SessionCounters — the evening session logged turns: 3059 for a ~30-turn
# conversation because every audio FRAME incremented the turn counters.
# ---------------------------------------------------------------------------

def test_counters_ignore_audio_frames():
    c = SessionCounters()
    for _ in range(500):
        c.observe("audio")
    assert c.total_interactions == 0
    assert c.conversation_turns == 0
    assert c.voice_interactions == 0


def test_counters_count_voice_turns_at_activity_start_only():
    c = SessionCounters()
    # one spoken utterance: open bracket, 40 frames, close bracket
    c.observe("activity_start")
    for _ in range(40):
        c.observe("audio")
    c.observe("activity_end")
    assert c.voice_interactions == 1
    assert c.conversation_turns == 1
    assert c.total_interactions == 1


def test_counters_mixed_session_shape():
    c = SessionCounters()
    for _ in range(3):
        c.observe("text")
    for _ in range(2):
        c.observe("activity_start")
        for _ in range(25):
            c.observe("audio")
        c.observe("activity_end")
    c.observe("update_context")
    c.observe("switch_primitive")
    assert c.conversation_turns == 5          # 3 text + 2 voice
    assert c.voice_interactions == 2
    assert c.total_interactions == 7          # 3 text + 2 voice + ctx + switch


# ---------------------------------------------------------------------------
# "(not set)" elimination — the tutor spoke a literal "(not set)" as an entire
# turn (morning session 14:12:44, seq 584). Placeholder text must never enter
# outbound prompt text.
# ---------------------------------------------------------------------------

_SCAFFOLD = {
    "taskDescription": "Exploring a machine profile: {{machineName}} ({{category}}).",
    "contextKeys": ["machineName", "category", "era", "sectionsOpened"],
    "scaffoldingLevels": {
        "level1": '"What do you already know about {{machineName}}?"',
        "level2": '"What part surprises you most?"',
        "level3": '"This machine works by {{howItWorksSummary}}."',
    },
    "commonStruggles": [
        {"pattern": "Stuck", "response": "Talk about {{machineName}}."},
        {"pattern": "Lost", "response": "Re-read {{missingKey}} together."},
    ],
}


def test_scaffold_never_contains_not_set_marker():
    data = {"machineName": "Excavator", "category": "Construction"}
    out = get_primitive_specific_instructions("machine-profile", data, _SCAFFOLD)
    assert "(not set)" not in out


def test_scaffold_omits_unset_context_keys():
    data = {"machineName": "Excavator", "category": "Construction"}
    out = get_primitive_specific_instructions("machine-profile", data, _SCAFFOLD)
    assert "machineName: Excavator" in out
    assert "era" not in out.split("**RUNTIME STATE:**")[1].split("**SCAFFOLDING")[0]


def test_scaffold_drops_script_lines_with_unresolved_placeholders():
    data = {"machineName": "Excavator", "category": "Construction"}
    out = get_primitive_specific_instructions("machine-profile", data, _SCAFFOLD)
    # level3 references howItWorksSummary (absent) — the LINE is dropped, the
    # resolvable levels stay.
    assert "Level 1:" in out and "Level 2:" in out
    assert "Level 3:" not in out
    # struggle with the unresolved response is dropped; the resolvable one stays
    assert "Talk about Excavator." in out
    assert "Re-read" not in out


def test_scaffold_all_keys_unset_yields_placeholder_free_state_section():
    out = get_primitive_specific_instructions("machine-profile", {}, _SCAFFOLD)
    assert "(not set)" not in out
    assert "(no state reported yet)" in out


def test_interpolate_template_drops_unresolved():
    assert interpolate_template("by {{x}}.", {}) == "by ."
    assert interpolate_template("by {{x}}.", {"x": "pistons"}) == "by pistons."


def test_interpolate_line_strict():
    assert interpolate_line("by {{x}}.", {}) is None
    assert interpolate_line("", {"x": 1}) is None
    assert interpolate_line("by {{x}}.", {"x": "pistons"}) == "by pistons."


# ---------------------------------------------------------------------------
# Switch debounce — 7 switches in ~40s each triggered a greeting for a section
# the child had already left (morning session 0:32–1:14).
# ---------------------------------------------------------------------------

def _run(coro):
    return asyncio.run(coro)


def test_rapid_switches_announce_only_the_last():
    async def scenario():
        announced = []

        async def announce(sw):
            announced.append(sw["primitive_type"])

        d = SwitchDebouncer(announce, settle_s=0.05)
        d.push({"primitive_type": "a"})
        await asyncio.sleep(0.01)
        d.push({"primitive_type": "b"})
        await asyncio.sleep(0.01)
        d.push({"primitive_type": "c"})
        await asyncio.sleep(0.2)
        return announced, d.coalesced

    announced, coalesced = _run(scenario())
    assert announced == ["c"]
    assert coalesced == 2


def test_settled_switches_each_announce():
    async def scenario():
        announced = []

        async def announce(sw):
            announced.append(sw["primitive_type"])

        d = SwitchDebouncer(announce, settle_s=0.03)
        d.push({"primitive_type": "a"})
        await asyncio.sleep(0.1)
        d.push({"primitive_type": "b"})
        await asyncio.sleep(0.1)
        return announced

    assert _run(scenario()) == ["a", "b"]


def test_aclose_cancels_pending_announce():
    async def scenario():
        announced = []

        async def announce(sw):
            announced.append(sw["primitive_type"])

        d = SwitchDebouncer(announce, settle_s=0.05)
        d.push({"primitive_type": "a"})
        await d.aclose()
        await asyncio.sleep(0.1)
        return announced

    assert _run(scenario()) == []


# ---------------------------------------------------------------------------
# Fix A — the curiosity carve-out must be present, and the unscoped rule the
# model over-generalized must be gone, in BOTH system-instruction builders.
# ---------------------------------------------------------------------------

def _lesson_prompt() -> str:
    return _run(build_lesson_system_instruction(
        {"topic": "Excavators", "grade_level": "Kindergarten",
         "objectives": [], "ordered_components": []},
        {},
    ))


def _standalone_prompt() -> str:
    return _run(build_lumina_system_instruction(
        "machine-profile", {"machineName": "Excavator"},
        {"topic": "Excavators", "grade_level": "Kindergarten",
         "objectives": [], "ordered_components": []},
        {}, tutoring_scaffold=None,
    ))


def test_lesson_prompt_carries_curiosity_carveout():
    p = _lesson_prompt()
    assert "QUESTIONS FROM THE STUDENT" in p
    assert "ANSWER IT FIRST" in p
    # the unscoped rule the model generalized into deflection is gone
    assert "Never give direct answers" not in p
    assert "active challenge's answer" in p


def test_standalone_prompt_carries_curiosity_carveout():
    p = _standalone_prompt()
    assert "QUESTIONS FROM THE STUDENT" in p
    assert "ANSWER IT FIRST" in p
    assert "Never give direct answers" not in p


def test_prompts_document_session_resumed_tag():
    assert "[SESSION RESUMED]" in _lesson_prompt()
    assert "[SESSION RESUMED]" in _standalone_prompt()


# ---------------------------------------------------------------------------
# ContextUpdateGate — end_of_turn=False was a lie: handle_text_to_gemini logged
# the field and then sent every text the same way, so "silent" state updates
# interrupted the tutor. In the 2026-08-06 lesson, 9 of 17 barge-ins were the
# server interrupting itself; four were [CONTEXT UPDATE]s, one clipping a
# celebration at its first word.
# Live evidence: logs/lumina-sessions/2026-08-06-113439-lumina-tutor-9afd09131cde.jsonl
# ---------------------------------------------------------------------------

class _Ledger:
    """Stand-in for SessionLedger — records events, never throws."""

    def __init__(self):
        self.events = []

    def write(self, event, **fields):
        self.events.append((event, fields))


def _gate(hold_s=None):
    sent = []

    async def requeue(text):
        sent.append(text)

    ledger = _Ledger()
    g = ContextUpdateGate(requeue, ledger)
    if hold_s is not None:
        g.MAX_HOLD_S = hold_s
    return g, sent, ledger


def test_context_update_passes_straight_through_when_tutor_is_idle():
    async def scenario():
        g, sent, _ = _gate()
        assert await g.admit("[CONTEXT UPDATE] slider: 3") is True
        return sent, g.held

    sent, held = _run(scenario())
    assert sent == []      # caller sends it itself; nothing was parked
    assert held == 0


def test_context_update_is_parked_while_the_tutor_holds_the_floor():
    async def scenario():
        g, sent, _ = _gate()
        g.floor_taken()
        admitted = await g.admit("[CONTEXT UPDATE] slider: 3")
        return admitted, sent, g.held

    admitted, sent, held = _run(scenario())
    assert admitted is False   # this is the barge-in that no longer happens
    assert sent == []          # still parked — the turn is still running
    assert held == 1


def test_parked_update_is_requeued_when_the_turn_ends():
    async def scenario():
        g, sent, _ = _gate()
        g.floor_taken()
        await g.admit("[CONTEXT UPDATE] slider: 3")
        await g.floor_released()
        return sent

    assert _run(scenario()) == ["[CONTEXT UPDATE] slider: 3"]


def test_only_the_newest_parked_update_survives():
    """A slider dragged across twenty positions is one state, not twenty."""
    async def scenario():
        g, sent, _ = _gate()
        g.floor_taken()
        for i in range(20):
            await g.admit(f"[CONTEXT UPDATE] slider: {i}")
        await g.floor_released()
        return sent, g.held, g.coalesced

    sent, held, coalesced = _run(scenario())
    assert sent == ["[CONTEXT UPDATE] slider: 19"]
    assert held == 1
    assert coalesced == 19


def test_turn_end_is_idempotent():
    """Turn ends arrive twice — turn_complete flag AND iterator end."""
    async def scenario():
        g, sent, _ = _gate()
        g.floor_taken()
        await g.admit("[CONTEXT UPDATE] slider: 3")
        await g.floor_released()
        await g.floor_released()
        return sent

    assert _run(scenario()) == ["[CONTEXT UPDATE] slider: 3"]


def test_cue_that_wants_a_response_is_never_gated():
    """Only end_of_turn=False traffic is held; a [PROBLEM_SHOWN] must cut in."""
    async def scenario():
        g, sent, _ = _gate()
        g.floor_taken()
        # handle_text_to_gemini only consults the gate for end_of_turn=False,
        # so an answer/problem cue never reaches admit() at all.
        return await g.admit("[CONTEXT UPDATE] x: 1")

    assert _run(scenario()) is False


def test_hold_expires_so_a_silent_model_cannot_strand_the_update():
    """The model may answer a cue with silence; no turn end ever arrives."""
    async def scenario():
        g, sent, ledger = _gate(hold_s=0.05)
        g.floor_taken()
        await g.admit("[CONTEXT UPDATE] slider: 3")
        await asyncio.sleep(0.2)
        return sent, [e for e, _ in ledger.events]

    sent, events = _run(scenario())
    assert sent == ["[CONTEXT UPDATE] slider: 3"]
    assert "context-update-hold-expired" in events


def test_reconnect_releases_anything_parked_mid_drop():
    async def scenario():
        g, sent, _ = _gate()
        g.floor_taken()
        await g.admit("[CONTEXT UPDATE] slider: 3")
        await g.reset()          # new Gemini connection
        return sent

    assert _run(scenario()) == ["[CONTEXT UPDATE] slider: 3"]


def test_aclose_cancels_the_hold_timer():
    async def scenario():
        g, sent, _ = _gate(hold_s=0.05)
        g.floor_taken()
        await g.admit("[CONTEXT UPDATE] slider: 3")
        await g.aclose()
        await asyncio.sleep(0.2)
        return sent

    assert _run(scenario()) == []
