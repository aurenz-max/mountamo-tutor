from run_tutor_live import (
    Beat,
    BeatResult,
    _di_closest_branch,
    _di_extra_words,
    build_lesson_curiosity_journey,
    build_lesson_refer_back_journey,
    build_lesson_resume_continuity_journey,
    report_di_bench,
    report_suffix,
    run_di_oracles,
    run_oracles,
)

from argparse import Namespace


def _result(spoken: str) -> BeatResult:
    return BeatResult(
        beat=Beat(
            "refer_back",
            grounds_in_prior=[
                ["boom"], ["stick"], ["bucket"],
                ["hydraulic", "pressurized fluid", "cylinder"],
            ],
        ),
        transcript=spoken,
        turn_ended=True,
    )


def test_prior_section_oracle_passes_grounded_connection():
    findings = run_oracles(
        [_result("The boom, stick, and bucket move when pressurized hydraulic fluid pushes the cylinders.")],
        ["auth_success", "ai_transcription"],
    )
    assert not any(f["check"] == "grounds-in-prior-section" for f in findings)


def test_prior_section_oracle_reports_missing_prior_facts():
    findings = run_oracles(
        [_result("Hydraulics make the arm move.")],
        ["auth_success", "ai_transcription"],
    )
    matches = [f for f in findings if f["check"] == "grounds-in-prior-section"]
    assert len(matches) == 1
    assert "boom" in matches[0]["detail"]


def test_refer_back_journey_keeps_all_sections_in_one_lesson_session():
    journey = build_lesson_refer_back_journey({}, "Grade 3")
    assert journey["force_lesson"] is True
    assert len(journey["lesson_context"]["ordered_components"]) == 3
    assert journey["beats"][-1].name == "refer_back_to_section_1"
    assert len(journey["beats"][-1].grounds_in_prior) == 4


def _forbid_result(spoken: str) -> BeatResult:
    return BeatResult(
        beat=Beat("post_resume", forbid=[["welcome", "which part do you want"]]),
        transcript=spoken,
        turn_ended=True,
    )


def test_forbid_oracle_fires_on_post_resume_regreeting():
    findings = run_oracles(
        [_forbid_result("Welcome back! Which part do you want to explore first?")],
        ["auth_success", "ai_transcription"],
    )
    matches = [f for f in findings if f["check"] == "forbidden-phrase-spoken"]
    assert len(matches) == 1 and matches[0]["severity"] == "HIGH"


def test_forbid_oracle_passes_a_continuation():
    findings = run_oracles(
        [_forbid_result("…and that strong arm lifts the dirt right into the truck.")],
        ["auth_success", "ai_transcription"],
    )
    assert not any(f["check"] == "forbidden-phrase-spoken" for f in findings)


def test_curiosity_journey_replays_the_real_child_utterance():
    journey = build_lesson_curiosity_journey({}, "Kindergarten")
    assert journey["force_lesson"] is True
    q = next(b for b in journey["beats"] if b.name == "the_question")
    sent = q.sends[0]["content"]
    assert "build a bunch of apartments" in sent          # the real question
    assert "can we go over there" in sent.lower()
    assert q.must_include and q.judge                     # anchors AND judge
    assert q.forbid == [["what do you already know"]]     # the shipped recitation


def test_resume_journey_requires_a_real_resume():
    journey = build_lesson_resume_continuity_journey({}, "Kindergarten")
    assert journey["require_events"] == ["session_resuming", "session_resumed"]
    for b in journey["beats"]:
        if b.name in ("switch_to_profile", "coherence_check"):
            assert b.forbid, f"{b.name} must forbid re-greeting phrases"


# ---------------------------------------------------------------------------
# qa/di/BACKLOG.md item 27, I1 - a pack that scripts SEVERAL corrections
# ---------------------------------------------------------------------------
#
# The three lines below are picture-vocabulary's REAL `association` correction
# branches for the stimulus "sock" on the code-owned hammer/nail model pair
# (pictureVocabularyScript.ts: echoCorrectionFor, categoryCorrectionFor,
# correctionFor), copied byte-for-byte. The bug is only reproducible with the
# real strings: it turns on how much vocabulary the general branch shares with
# the specific ones, and an invented fixture would not have the same overlap.

ASSOC_ECHO = (
    "My turn: sock cannot go with itself. A hammer goes with a nail. "
    "Your turn. Tell me something different that goes with sock."
)
ASSOC_CATEGORY = (
    "My turn: that names a whole group. I want one thing. "
    "A hammer goes with a nail. Your turn. What goes with sock?"
)
ASSOC_GENERAL = (
    "My turn: a hammer goes with a nail — we use them together. "
    "Your turn. What goes with sock?"
)
ASSOC_BRANCHES = [ASSOC_ECHO, ASSOC_CATEGORY, ASSOC_GENERAL]

SENTINELS = {"affirm": [["yes"]], "correct": [["my", "turn"]]}
EVENTS = ["auth_success", "ai_transcription"]


def _probe(spoken: str, expected_lines, expect: str = "correct") -> BeatResult:
    """One bench probe beat, shaped the way build_di_bench_journey shapes it."""
    return BeatResult(
        beat=Beat(
            "probe:bench-assoc-sock:echo:sock",
            di={
                "role": "bench-probe",
                "item": "bench-assoc-sock",
                "expect": expect,
                "said": "sock",
                "why": "the stimulus back",
                "bucket": "echo",
                "soft": False,
                "answer_kind": "voice",
                "expected_line": ASSOC_GENERAL,
                "expected_lines": expected_lines,
                "final_attempt": False,
                "is_last_item": False,
            },
        ),
        transcript=spoken,
        turn_ended=True,
    )


def _checks(findings, name):
    return [f for f in findings if f["check"] == name]


def test_i1_the_defect_is_real_against_the_catch_all_alone():
    """The mechanism, pinned: judged against the GENERAL branch, a correctly
    fired ECHO correction looks like 8 added words. This is what produced 8
    bogus WARNs on the 2026-08-21 bench and 5 more on its signature drive."""
    assert len(_di_extra_words(ASSOC_ECHO, ASSOC_GENERAL)) >= 5


def test_i1_specific_branch_is_not_scored_as_embellishment():
    findings = run_di_oracles([_probe(ASSOC_ECHO, ASSOC_BRANCHES)], EVENTS, SENTINELS)
    assert not _checks(findings, "di-verdict-embellished")
    assert not _checks(findings, "di-off-script-verdict")


def test_i1_every_branch_scores_clean_when_spoken_verbatim():
    for line in ASSOC_BRANCHES:
        findings = run_di_oracles([_probe(line, ASSOC_BRANCHES)], EVENTS, SENTINELS)
        assert not _checks(findings, "di-verdict-embellished"), line
        assert not _checks(findings, "di-off-script-verdict"), line


def test_i1_a_genuinely_embellished_branch_still_warns():
    """The widening must not disarm the oracle. `say exactly` is the whole
    mechanism by which a pack controls what a five-year-old hears."""
    padded = ASSOC_ECHO + " You are doing such a wonderful job today, keep going!"
    findings = run_di_oracles([_probe(padded, ASSOC_BRANCHES)], EVENTS, SENTINELS)
    assert len(_checks(findings, "di-verdict-embellished")) == 1
    assert "[branch 1/3]" in _checks(findings, "di-verdict-embellished")[0]["detail"]


def test_i1_one_branch_packs_are_byte_identical_to_before():
    """A pack with a single correction sends no `expected_lines`, and nothing
    about its scoring may change - that is what makes this a pure widening."""
    padded = ASSOC_GENERAL + " Wonderful effort, you are such a good listener!"
    findings = run_di_oracles([_probe(padded, [])], EVENTS, SENTINELS)
    assert len(_checks(findings, "di-verdict-embellished")) == 1
    assert "branch" not in _checks(findings, "di-verdict-embellished")[0]["detail"]


def test_i1_closest_branch_resists_the_subset_trap():
    """THE reason this uses Jaccard and not `_di_overlap`. The general branch
    shares almost all of its words with the echo branch, so one-way overlap
    scores it 1.0 against an utterance of the echo line and would keep picking
    the catch-all - I1 surviving its own fix."""
    assert _di_closest_branch(ASSOC_ECHO, ASSOC_BRANCHES) == ASSOC_ECHO
    assert _di_closest_branch(ASSOC_CATEGORY, ASSOC_BRANCHES) == ASSOC_CATEGORY
    assert _di_closest_branch(ASSOC_GENERAL, ASSOC_BRANCHES) == ASSOC_GENERAL


def test_i1_false_affirmation_still_lands_on_a_multi_branch_pack():
    """The bench's headline number is untouched: branch matching only decides
    which line COMPLIANCE is scored against, never what the verdict was."""
    findings = run_di_oracles(
        [_probe("Yes, that goes with sock - they belong together.", ASSOC_BRANCHES)],
        EVENTS, SENTINELS)
    assert len(_checks(findings, "di-false-affirm")) == 1


# ---------------------------------------------------------------------------
# Item 27, I2 - one filename per kind of run
# ---------------------------------------------------------------------------


def _args(**over):
    base = dict(di=False, di_bench=False, di_bench_item=None, di_wrong="plain",
                di_cap=False, di_cap_item=None, lesson=False)
    base.update(over)
    return Namespace(**base)


def test_i2_a_bench_and_a_plain_drive_do_not_share_a_filename():
    """THE defect: `--di-bench` implies `--di` at the default `--di-wrong`, so
    on 2026-08-21 the gate-8 drive overwrote the gate-7 bench in the same
    session and took a 48-probe matrix with it."""
    bench = report_suffix(_args(di=True, di_bench=True), {})
    drive = report_suffix(_args(di=True), {})
    assert bench != drive
    assert bench == "-di-bench"


def test_i2_narrowed_bench_runs_do_not_overwrite_each_other():
    """`--di-bench-item` exists so a Live session limit can be worked around by
    running the stimuli one at a time. That is only possible if the six records
    survive each other."""
    names = {report_suffix(_args(di=True, di_bench=True, di_bench_item=x), {})
             for x in ("bench-ake-cake", "bench-at-hat", "bench-ig-pig")}
    assert len(names) == 3


def test_i2_every_run_shape_owns_a_distinct_name():
    shapes = [
        _args(),
        _args(lesson=True),
        _args(di=True),
        _args(di=True, di_wrong="signature"),
        _args(di=True, di_cap=True),
        _args(di=True, di_cap=True, di_cap_item="read-1"),
        _args(di=True, di_bench=True),
        _args(di=True, di_bench=True, di_bench_item="bench-assoc-sock"),
    ]
    names = [report_suffix(a, {}) for a in shapes]
    assert len(set(names)) == len(names), names


def test_i2_a_forced_lesson_journey_still_names_itself():
    assert report_suffix(_args(), {"force_lesson": True}) == "-lesson"


# ---------------------------------------------------------------------------
# Item 27, I3 - the bench summary speaks the PORT's vocabulary, not rhyme's
# ---------------------------------------------------------------------------


def _bench_plan():
    return {
        "componentId": "picture-vocabulary",
        "sentinels": SENTINELS,
        "items": [{"id": "bench-assoc-sock", "responseClass": "open_set_word"}],
    }


def _bench_probe(said, bucket, expect, spoken, soft=False):
    return BeatResult(
        beat=Beat(
            f"probe:bench-assoc-sock:{bucket}:{said}",
            di={"role": "bench-probe", "item": "bench-assoc-sock", "expect": expect,
                "said": said, "why": "keyed by the fixture", "bucket": bucket,
                "soft": soft, "answer_kind": "voice"},
        ),
        transcript=spoken,
        turn_ended=True,
    )


def test_i3_no_rhyme_vocabulary_leaks_into_an_association_bench(capsys):
    """The stale-doctrine shape: this function was written for rhyme-studio and
    printed "missed valid rhyme(s)", "slant-rhyme disagreement(s)" and
    "`open_set_word` stays blocked" over an association fixture with no rhymes
    in it, for a class that had been BENCHED (not blocked) for two days."""
    report = report_di_bench([
        _bench_probe("shoe", "partner", "affirm", "My turn: a hammer goes with a nail."),
        _bench_probe("mailman", "rationalised-chain", "correct",
                     "Yes, that goes with sock.", soft=True),
        _bench_probe("sock", "echo", "correct", "My turn: sock cannot go with itself."),
    ], _bench_plan())
    out = capsys.readouterr().out.lower()
    assert "rhyme" not in out
    assert "blocked" not in out
    assert "open_set_word" in out
    assert "picture-vocabulary" in out
    # The soft bucket names itself from the fixture rather than from `near-rime`.
    assert "rationalised-chain" in out
    assert report["missed_valid"] == 1
    assert report["soft_disagreements"] == 1


def test_i3_the_gate_verdict_is_still_zero_false_affirmations():
    report = report_di_bench([
        _bench_probe("sock", "echo", "correct", "Yes, that goes with sock."),
    ], _bench_plan())
    assert report["passed"] is False
    assert report["false_affirmations"] == 1
