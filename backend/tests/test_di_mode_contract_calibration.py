"""Calibration parity for DI primitives migrated to the shared mode contract."""

from app.config.discrimination_priors import get_discrimination_prior
from app.services.calibration.problem_type_registry import (
    get_primitive_beta_range,
    get_prior_beta,
)


MODE_BETAS = {
    "di-letter-sounds": {
        "letter_sound": 1.5,
        "letter_sound_review": 2.5,
        "first_sound_in_word": 3.5,
    },
    "di-word-reading": {
        "cvc_reading": 2.0,
        "read_word": 2.5,
        "sight_word": 3.0,
        "word_reading_review": 3.5,
    },
    "di-math-facts": {
        "name_numeral": 1.5,
        "counting_next": 1.5,
        "answer_fact": 2.0,
        "fact_review": 2.5,
        "subtraction_fact": 3.0,
    },
    "di-shapes": {
        "name_shape": 1.5,
        "shape_review": 2.5,
        "find_real_object": 3.0,
        "count_sides": 3.0,
        "count_corners": 3.5,
    },
    "di-sentence-reading": {
        "decodable_sentence": 2.5,
        "read_sentence": 3.0,
        "sentence_review": 3.5,
        "sight_phrase_sentence": 4.0,
    },
    "di-spoken-practice": {
        "count_and_say": 1.5,
        "compare_choice": 2.0,
        "read_aloud": 2.5,
        "say_answer": 3.0,
        "explain_concept": 4.0,
    },
    "di-worked-procedure": {
        "subtract_no_regroup": 2.0,
        "subtract_regroup": 3.5,
    },
    "di-deduction": {
        "conclude": 2.5,
        "deny": 3.5,
        "cannot_tell": 4.5,
    },
    "di-word-problem-setup": {
        "find_big_number": 2.5,
        "build_family": 3.5,
        "classify_and_build": 4.5,
    },
}


def test_migrated_di_mode_betas_match_the_catalog_definitions():
    for primitive, modes in MODE_BETAS.items():
        for mode, beta in modes.items():
            assert get_prior_beta(primitive, mode) == beta
        assert get_primitive_beta_range(primitive) == (
            min(modes.values()),
            max(modes.values()),
        )


def test_migrated_di_modes_use_the_omitted_discrimination_default():
    for primitive, modes in MODE_BETAS.items():
        for mode in modes:
            prior = get_discrimination_prior(primitive, mode)
            assert prior.a == 1.4
            assert prior.c == 0.0
