from run_tutor_live import (
    Beat,
    BeatResult,
    build_lesson_curiosity_journey,
    build_lesson_refer_back_journey,
    build_lesson_resume_continuity_journey,
    run_oracles,
)


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
