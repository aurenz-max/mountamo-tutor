"""Calibration parity for the DI dice-roll evaluation-mode ladder."""

from app.config.discrimination_priors import get_discrimination_prior
from app.services.calibration.problem_type_registry import (
    get_primitive_beta_range,
    get_prior_beta,
)


def test_di_dice_roll_beta_ladder_matches_catalog_order():
    assert get_prior_beta("di-dice-roll", "count_pips") == 1.5
    assert get_prior_beta("di-dice-roll", "compare_dice") == 2.5
    assert get_prior_beta("di-dice-roll", "sum_two_dice") == 3.5
    assert get_primitive_beta_range("di-dice-roll") == (1.5, 3.5)


def test_di_dice_roll_modes_use_spoken_constructed_response_prior():
    for mode in ("count_pips", "compare_dice", "sum_two_dice"):
        prior = get_discrimination_prior("di-dice-roll", mode)
        assert prior.a == 1.6
        assert prior.c == 0.0
