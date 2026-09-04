"""Calibration parity for the matter-explorer eval-mode ladder.

The one thing here that is not bookkeeping: `change` is a TWO-option spoken
choice, so it needs the true/false guessing floor. Delete the registry override
and the lookup falls back to an inferred c=0.0 with no error at all — a coin
flip scored as clean evidence, which is exactly the shape of failure the
2PL/3PL guessing parameter exists to stop.
"""

from app.config.discrimination_priors import get_discrimination_prior
from app.services.calibration.problem_type_registry import (
    get_primitive_beta_range,
    get_prior_beta,
)


def test_matter_explorer_beta_ladder_matches_catalog_order():
    assert get_prior_beta("matter-explorer", "sort") == -1.0
    assert get_prior_beta("matter-explorer", "property") == 0.5
    assert get_prior_beta("matter-explorer", "change") == 1.2
    assert get_prior_beta("matter-explorer", "mystery") == 2.0
    assert get_primitive_beta_range("matter-explorer") == (-1.0, 2.0)


def test_two_option_change_mode_carries_a_real_guessing_floor():
    change = get_discrimination_prior("matter-explorer", "change")
    assert change.c == 0.50
    assert change.a == 1.0
    # ...and the three-answer modes do not inherit it.
    for mode in ("sort", "property", "mystery"):
        assert get_discrimination_prior("matter-explorer", mode).c == 0.0
