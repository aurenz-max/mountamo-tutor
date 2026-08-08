"""Units for the lesson-tutor slice of 2026-08-06 (DI BACKLOG item 11):
curiosity-question carve-out, "(not set)" elimination, switch debounce, and
honest session counters. Each test names the live failure it pins.

Live evidence: qa/tutor-reports/lumina-session-review-2026-08-05.md.
"""
import asyncio

from app.api.endpoints.lumina_tutor import (
    PrimitiveState,
    SessionCounters,
    SwitchDebouncer,
    build_lesson_system_instruction,
    build_lumina_system_instruction,
    get_primitive_specific_instructions,
    interpolate_line,
    interpolate_template,
)
from app.services.session_ledger import classify_cue


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
# PrimitiveState (CTX-1, 2026-08-07) — the tutor is no longer NOTIFIED when the
# student moves something inside a primitive. It was pushed as a "silent"
# [CONTEXT UPDATE], but this transport has no silent mode: every realtime text
# send closes the turn and registers as user activity. In the 2026-08-06 lesson
# 9 of 17 barge-ins were the server interrupting itself, four of them these
# updates — one clipped a celebration at its first word — and on a turn longer
# than the gate's 8s ceiling the model took the floor with nothing to answer and
# read a prompt line aloud to a child.
#
# The state itself is kept and rides out on the next message that genuinely
# asks the model for a turn. These tests pin BOTH halves: the push is gone, and
# the model is still informed.
# Live evidence: logs/lumina-sessions/2026-08-06-113439-lumina-tutor-9afd09131cde.jsonl
# ---------------------------------------------------------------------------

def test_state_is_never_a_message_of_its_own():
    """The deleted channel. Merging state produces nothing to send — the only
    way it reaches Gemini is riding on a message that already wanted a turn."""
    s = PrimitiveState()
    s.merge({"slider": 3})
    assert s.attached == 0


def test_state_rides_out_on_the_next_message_that_asks_for_a_turn():
    s = PrimitiveState()
    s.merge({"problem": "3 + 4"})
    out = s.attach("[DI_ITEM] Judge the student's spoken answer.")
    assert "[CURRENT STATE]" in out
    assert "problem: 3 + 4" in out
    # the ask stays LAST so it is the most recent thing in the model's context
    assert out.rstrip().endswith("Judge the student's spoken answer.")
    assert s.attached == 1


def test_the_cue_tag_survives_attachment():
    """classify_cue reads the leading bracket tag. handle_text_to_gemini
    classifies BEFORE attaching, so [DI_ITEM] stays [DI_ITEM] in the ledger and
    for fault-injection arming even though the sent text now leads with state."""
    s = PrimitiveState()
    s.merge({"problem": "3 + 4"})
    original = "[DI_ITEM] Judge this."
    assert classify_cue(original) == "[DI_ITEM]"
    assert classify_cue(s.attach(original)) == "text"   # why order matters


def test_twenty_slider_positions_collapse_to_one_state():
    """A slider dragged across twenty positions is one state, not twenty — and
    costs one attachment, not twenty interruptions."""
    s = PrimitiveState()
    for i in range(20):
        s.merge({"slider": i})
    out = s.attach("The student asked a question.")
    assert "slider: 19" in out
    assert "slider: 18" not in out
    assert s.attached == 1


def test_unchanged_state_is_not_resent():
    s = PrimitiveState()
    s.merge({"slider": 3})
    first = s.attach("cue one")
    second = s.attach("cue two")
    assert "[CURRENT STATE]" in first
    assert second == "cue two"      # nothing changed; nothing to say
    assert s.attached == 1


def test_a_later_change_is_sent_again():
    s = PrimitiveState()
    s.merge({"slider": 3})
    s.attach("cue one")
    s.merge({"slider": 9})
    assert "slider: 9" in s.attach("cue two")
    assert s.attached == 2


def test_merge_is_a_delta_not_a_replacement():
    """Primitives push partial bags; a DI pack updating `problem` must not
    erase the `challengeType` the tutor still needs."""
    s = PrimitiveState()
    s.merge({"challengeType": "addition", "problem": "3 + 4"})
    s.merge({"problem": "5 + 2"})
    out = s.attach("cue")
    assert "challengeType: addition" in out
    assert "problem: 5 + 2" in out


def test_empty_state_attaches_nothing():
    s = PrimitiveState()
    assert s.attach("cue") == "cue"
    assert s.attached == 0


def test_switch_replaces_state_and_counts_as_already_conveyed():
    """REGRESSION GATE for the CTX-1 scope fence. A new primitive's data
    replaces the old — the last activity's state must never be described as
    this one's — and the [PRIMITIVE SWITCH] announcement already carries it in
    the scaffold, so it is not attached a second time."""
    s = PrimitiveState()
    s.merge({"slider": 3})
    s.reset({"word": "cat"})
    assert s.attach("cue") == "cue"          # scaffold already said it
    s.merge({"word": "dog"})
    out = s.attach("cue two")
    assert "word: dog" in out
    assert "slider" not in out               # the old activity is gone


def test_unserializable_state_still_attaches():
    """The signature is only a change-detector. A primitive pushing something
    JSON can't take must not kill the tutor's state channel."""
    class Opaque:
        def __repr__(self):
            return "<opaque>"

    s = PrimitiveState()
    s.merge({"thing": Opaque()})
    assert "[CURRENT STATE]" in s.attach("cue")
    assert s.attach("cue two") == "cue two"   # and still de-dupes


# --- the prompt no longer advertises a channel that does not exist ----------

def test_prompts_do_not_mention_the_deleted_context_update_channel():
    for p in (_lesson_prompt(), _standalone_prompt()):
        assert "[CONTEXT UPDATE]" not in p


def test_prompts_document_the_current_state_block():
    for p in (_lesson_prompt(), _standalone_prompt()):
        assert "[CURRENT STATE]" in p


def test_lesson_prompt_still_announces_the_primitive_switch_channel():
    """SCOPE FENCE: navigation and within-primitive state are different
    channels. CTX-1 deletes only the second. If the model stops being told it
    will hear about activity changes, the wrong channel was deleted."""
    p = _lesson_prompt()
    assert "[PRIMITIVE SWITCH]" in p
    assert "briefly acknowledge the new activity" in p
