"""Fraction recognition is registered without changing existing fraction priors."""
from app.services.calibration.problem_type_registry import get_prior_beta, get_primitive_beta_range


def test_fraction_touch_and_existing_mode_priors():
    expected = {"touch_fraction": 1.25, "identify": 1.5, "build": 2.5, "compare": 3.5, "equivalent": 4.5}
    for mode, beta in expected.items():
        assert get_prior_beta("fraction-circles", mode) == beta
    assert get_primitive_beta_range("fraction-circles") == (1.25, 4.5)
