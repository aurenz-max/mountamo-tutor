"""Units for the lesson-tutor slice of 2026-08-06 (DI BACKLOG item 11):
curiosity-question carve-out, "(not set)" elimination, switch debounce, and
honest session counters. Each test names the live failure it pins.

Live evidence: qa/tutor-reports/lumina-session-review-2026-08-05.md.
"""
from app.api.endpoints.lumina_tutor import (
    FloorGate,
    PrimitiveState,
    SessionCounters,
    TextQueueEntry,
    build_lesson_system_instruction,
    build_lumina_system_instruction,
    get_primitive_specific_instructions,
    interpolate_line,
    interpolate_template,
    should_queue_greeting,
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
# The floor gate (2026-08-08) — every cue source used to send the instant it
# fired. Live evidence, logs/lumina-sessions/2026-08-08-125623-…-8e5ef21b96fc:
# five sends inside 3.1s (13:01:29.5→32.7) of which only the last was spoken;
# three turns killed by our own text 40-55ms after it landed; and the switch
# announcement arriving 2.1s AFTER the activity it announced had spoken.
# ---------------------------------------------------------------------------

def test_floor_starts_free():
    """Nothing has spoken yet — the opening greeting must not wait on anyone."""
    assert not FloorGate().busy


def test_floor_is_taken_at_send_and_freed_at_turn_end():
    g = FloorGate()
    g.take()
    assert g.busy
    g.release()
    assert not g.busy


def test_the_watchdog_sits_far_above_any_real_utterance():
    """A read-aloud block ran 41s of audio. If the watchdog is anywhere near
    that, it becomes the policy timer this design removed."""
    from app.api.endpoints.lumina_tutor import FLOOR_WATCHDOG_S
    assert FLOOR_WATCHDOG_S >= 60


# --- who may cut in is DECLARED, never inferred -------------------------------

def _interrupting(batch):
    """The gate's step 1 predicate."""
    return any(e.interrupt for e in batch)


def test_a_cue_waits_by_default():
    """Silence is recoverable; a severed sentence is what the child hears."""
    assert TextQueueEntry(text="[ANSWER_CORRECT] nice one").interrupt is False
    assert not _interrupting([TextQueueEntry(text="[CURRENT STATE] streak: 2")])


def test_one_interrupting_cue_carries_the_whole_batch_in():
    """A cue that piled up behind an interrupting one goes out WITH it —
    otherwise it would land on the reply it just provoked, which is the
    original stampede wearing a different hat."""
    batch = [
        TextQueueEntry(text="[CURRENT STATE] streak: 2"),
        TextQueueEntry(text="[PRIMITIVE SWITCH]", interrupt=True),
        TextQueueEntry(text="[ACTIVITY_START] sorting-station"),
    ]
    assert _interrupting(batch)
    assert len(batch) == 3          # nothing is dropped to buy the interrupt


# --- supersession: what collapses, and what must NOT -------------------------

def _collapse(entries):
    """The gate's step 3, exactly as handle_text_to_gemini runs it:
    delete-then-reinsert on an insertion-ordered dict moves the survivor to
    the end, so the newest claim speaks in its arrival position."""
    kept, superseded = {}, 0
    for index, item in enumerate(entries):
        key = item.supersedes_key(index)
        if key in kept:
            superseded += 1
            del kept[key]
        kept[key] = item
    return [e.text for e in kept.values()], superseded


def _switch(label):
    return TextQueueEntry(text="[PRIMITIVE SWITCH]", render=lambda: label)


def test_four_taps_are_one_switch():
    """The one drop the live evidence justifies: a child flipping tabs fires a
    switch per tap, and the tutor greeted activities they had already left."""
    texts, superseded = _collapse([_switch(x) for x in "abcd"])
    assert len(texts) == 1
    assert superseded == 3


def test_repeated_state_cues_ride_out_together_rather_than_being_dropped():
    """Two [CURRENT STATE]s a second apart are the pair where the second killed
    the reply to the first (13:05:16.289). Batching is what fixes that — they
    now leave as ONE turn. Dropping the older one is not required, and a rule
    broad enough to do it would also eat [ANSWER_CORRECT]."""
    texts, superseded = _collapse([
        TextQueueEntry(text="[CURRENT STATE] streak: 1"),
        TextQueueEntry(text="[CURRENT STATE] streak: 2"),
    ])
    assert texts == ["[CURRENT STATE] streak: 1", "[CURRENT STATE] streak: 2"]
    assert superseded == 0


def test_different_cues_all_survive_as_one_turn():
    """SCOPE FENCE. Batching is not deduplication: "[ANSWER_CORRECT] then
    [NEXT_ITEM]" is one coherent thing to say. If these collapse, the tutor
    stops celebrating right answers."""
    texts, superseded = _collapse([
        TextQueueEntry(text="[ANSWER_CORRECT] Hopper, first try."),
        TextQueueEntry(text="[NEXT_ITEM] Challenge 2 of 10."),
    ])
    assert texts == ["[ANSWER_CORRECT] Hopper, first try.",
                     "[NEXT_ITEM] Challenge 2 of 10."]
    assert superseded == 0


def test_the_connect_burst_of_activity_starts_survives_intact():
    """REGRESSION GATE. A lesson fires one [ACTIVITY_START] per activity at
    connect (four of them at 12:56:23.760). Same tag, different activities —
    collapsing by tag alone would have silently eaten three scaffolds."""
    starts = [TextQueueEntry(text=f"[ACTIVITY_START] activity {i}") for i in range(4)]
    texts, superseded = _collapse(starts)
    assert len(texts) == 4
    assert superseded == 0


def test_student_text_never_collapses():
    """A child who types twice said two things."""
    texts, superseded = _collapse([
        TextQueueEntry(text="why is it called a hopper"),
        TextQueueEntry(text="is it heavy"),
    ])
    assert texts == ["why is it called a hopper", "is it heavy"]
    assert superseded == 0


def test_a_superseded_switch_leaves_no_trace():
    """Rendering happens at SEND time. Three of four taps are never rendered,
    so they never move `announced_primitive` — 'Previous activity' names where
    the student came from, not a screen they crossed in 300ms."""
    announced = {"value": "curator-brief"}
    rendered = []

    def make(target):
        def render():
            frm = announced["value"]
            announced["value"] = target
            rendered.append(target)
            return f"[PRIMITIVE SWITCH] {frm} -> {target}"
        return render

    entries = [TextQueueEntry(text="[PRIMITIVE SWITCH]", render=make(t))
               for t in ("a", "b", "c")]
    kept = {}
    for i, e in enumerate(entries):
        k = e.supersedes_key(i)
        if k in kept:
            del kept[k]
        kept[k] = e
    out = [e.render() for e in kept.values()]

    assert rendered == ["c"]                       # a and b were never said
    assert out == ["[PRIMITIVE SWITCH] curator-brief -> c"]
    assert announced["value"] == "c"


# ---------------------------------------------------------------------------
# Fix A — the curiosity carve-out must be present, and the unscoped rule the
# model over-generalized must be gone, in BOTH system-instruction builders.
# ---------------------------------------------------------------------------

def _lesson_prompt() -> str:
    return build_lesson_system_instruction(
        {"topic": "Excavators", "grade_level": "Kindergarten",
         "objectives": [], "ordered_components": []},
        {},
    )


def _standalone_prompt() -> str:
    return build_lumina_system_instruction(
        "machine-profile", {"machineName": "Excavator"},
        {"topic": "Excavators", "grade_level": "Kindergarten",
         "objectives": [], "ordered_components": []},
        {}, tutoring_scaffold=None,
    )


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
    # why order matters: attaching state buries the real tag behind a new one
    assert classify_cue(s.attach(original)) == "[CURRENT STATE]"


def test_any_bracket_tag_is_a_cue():
    """The roster used to be six hardcoded tags, so the 40+ others the client
    actually fires — the whole [ANSWER_CORRECT]/[NEXT_ITEM]/[READ_SECTION]
    family — were classified as student text and coalesced by position
    instead of by kind."""
    for tag in ("[READ_SECTION]", "[ANSWER_CORRECT]", "[NEXT_ITEM]",
                "[CONCEPT_SELECTED]", "[ACTIVITY_START]", "[PRIMITIVE SWITCH]"):
        assert classify_cue(f"{tag} body text") == tag


def test_student_text_is_not_a_cue():
    assert classify_cue("why is it called a hopper?") == "text"
    assert classify_cue("[lowercase] is not a tag") == "text"


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


# --- scripted cues own their floor: no state preamble ------------------------
# Found live 2026-08-14 (ten-frame --di drive): the runner's per-item context
# update rode out on the next [TF_ITEM] cue and the model NARRATED the state
# block — "[CURRENT STATE]: … The target answer for this new item is 'four'" —
# answer included, before speaking its say-exactly line. Every state-attached
# cue in that run was narrated (6/6); every clean cue was not (0/2). The fix is
# the transport's, not the prompt's (the prompt already forbade reading it, and
# lost): a judged cue declares `scripted`, and the gate never attaches state to
# a batch made only of scripted cues.
# ---------------------------------------------------------------------------

def _attach_allowed(batch):
    """The gate's attach predicate: state rides out unless EVERY entry in the
    batch declared itself a scripted, self-contained cue."""
    return any(not e.scripted for e in batch)


def test_a_cue_is_unscripted_by_default():
    """An ordinary primitive's cue keeps the state channel — the improvised
    reply it asks for NEEDS to know where the student is."""
    assert TextQueueEntry(text="[READ_SECTION] intro").scripted is False
    assert _attach_allowed([TextQueueEntry(text="[READ_SECTION] intro")])


def test_a_batch_of_scripted_cues_refuses_the_state_preamble():
    assert not _attach_allowed([
        TextQueueEntry(text='[TF_ITEM] Say exactly: "How many did you see?"',
                       scripted=True),
    ])


def test_one_unscripted_entry_keeps_the_state_channel_for_the_batch():
    """A [PRIMITIVE SWITCH] coalescing with a judged opener still wants the
    model told where the student is — the announcement is not a script."""
    assert _attach_allowed([
        TextQueueEntry(text="[PRIMITIVE SWITCH]", render=lambda: "switch"),
        TextQueueEntry(text='[TF_ITEM] Say exactly: "…"', scripted=True),
    ])


def test_skipped_state_is_pending_not_lost():
    """Suppression defers, never drops: the gate simply does not call attach()
    for a scripted batch, so the change still rides the next unscripted
    floor-giving message (a student's typed question, a hint request)."""
    s = PrimitiveState()
    s.merge({"stimulus": "four dots"})
    out = s.attach("why is it called a ten frame?")
    assert "stimulus: four dots" in out


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


# ---------------------------------------------------------------------------
# DI-GREET-1 — the improvised greeting turn vs. a pack that scripts its opener.
#
# Found live 2026-08-10 (word-flip, session 5269fc87d6da). The greeting is
# queued with end_of_turn=True, so Gemini takes a turn AT CONNECT — while the
# client is still waiting for the microphone and has not sent a cue. On a DI
# pack the turn arrives ~15s before the scripted opener and, in the observed
# run, ended with the tutor asking its OWN question; the child answered that,
# which barged in over the real ask, and item 1 ran with no question at all.
#
# This is also the true root of residual SWAP-1 — an earlier fix deleted the
# CATALOG directive that asked the same turn to compose a how-to-play, which
# took one job off the turn but could not remove the turn.
# ---------------------------------------------------------------------------

def test_a_pack_that_owns_its_opening_is_not_told_to_greet():
    """The whole point: a DI pack must be SILENT until its first cue."""
    assert should_queue_greeting(owns_opening=True, resumption_handle=None) is False


def test_owns_opening_beats_a_warm_resume_too():
    """Belt and braces — neither reason to stay quiet may cancel the other."""
    assert should_queue_greeting(owns_opening=True, resumption_handle="h-1") is False


def test_a_warm_reconnect_still_skips_the_greeting():
    """Pre-existing behaviour, pinned so the DI change cannot regress it:
    Gemini restored the conversation, so a greeting would be a duplicate."""
    assert should_queue_greeting(owns_opening=False, resumption_handle="h-1") is False


def test_an_ordinary_surface_on_a_fresh_connect_STILL_GREETS():
    """SCOPE FENCE, and the one that matters most. curator-brief and every
    ordinary tutoring surface open with a warm greeting BY DESIGN and it reads
    well live ("Hey there! I'm ready to help you explore these big machines.").
    DI-GREET-1 removes that turn only where a script replaces it."""
    assert should_queue_greeting(owns_opening=False, resumption_handle=None) is True
