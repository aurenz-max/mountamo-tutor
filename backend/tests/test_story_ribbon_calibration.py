from app.services.calibration.problem_type_registry import (
    get_item_discrimination,
    get_prior_beta,
)


def test_story_ribbon_mode_priors_match_the_l1_catalog() -> None:
    expected = {
        "tell_connected_account": 2.5,
        "tell_present_account": 3.0,
        "tell_future_account": 3.5,
        "tell_past_account": 3.5,
        "story_to_experience": 4.0,
    }
    for mode, beta in expected.items():
        assert get_prior_beta("story-ribbon", mode) == beta


def test_story_ribbon_discrimination_priors_match_response_shape() -> None:
    assert get_item_discrimination("story-ribbon", "tell_connected_account") == (1.0, 0.0)
    assert get_item_discrimination("story-ribbon", "tell_present_account") == (1.6, 0.0)
    assert get_item_discrimination("story-ribbon", "tell_future_account") == (1.6, 0.0)
    assert get_item_discrimination("story-ribbon", "tell_past_account") == (1.6, 0.0)
    assert get_item_discrimination("story-ribbon", "story_to_experience") == (1.0, 0.0)
