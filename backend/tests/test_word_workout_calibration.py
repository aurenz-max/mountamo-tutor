from app.config.discrimination_priors import get_discrimination_prior
from app.services.calibration.problem_type_registry import get_prior_beta


def test_extended_word_workout_priors_match_task_structure() -> None:
    beta_by_mode = {
        "real_vs_nonsense": 2.5,
        "picture_match": 2.5,
        "word_chains": 4.0,
        "read_inflected": (4.5, 1.6, 0.0),
        "read_compound": (4.5, 1.6, 0.0),
        "choose_in_context": (5.0, 1.0, 0.5),
        "sentence_reading": 5.5,
    }

    for mode, expected in beta_by_mode.items():
        beta = expected[0] if isinstance(expected, tuple) else expected
        assert get_prior_beta("word-workout", mode) == beta

    discrimination_by_mode = {
        mode: expected
        for mode, expected in beta_by_mode.items()
        if isinstance(expected, tuple)
    }
    for mode, (_, discrimination, guessing) in discrimination_by_mode.items():
        prior = get_discrimination_prior("word-workout", mode)
        assert prior.a == discrimination
        assert prior.c == guessing
