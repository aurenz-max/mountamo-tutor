from run_tutor_live import Beat, BeatResult, build_lesson_refer_back_journey, run_oracles


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
