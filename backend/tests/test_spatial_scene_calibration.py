"""Calibration parity for the spatial-scene evaluation-mode ladder."""

from app.config.discrimination_priors import get_discrimination_prior
from app.services.calibration.problem_type_registry import (
    get_primitive_beta_range,
    get_prior_beta,
)


def test_spatial_scene_spoken_mode_extends_the_existing_beta_ladder():
    assert get_prior_beta("spatial-scene", "identify") == 1.0
    assert get_prior_beta("spatial-scene", "place_in") == 1.5
    assert get_prior_beta("spatial-scene", "place") == 2.0
    assert get_prior_beta("spatial-scene", "describe") == 3.0
    assert get_prior_beta("spatial-scene", "place_between") == 3.5
    assert get_prior_beta("spatial-scene", "follow_directions") == 4.0
    assert get_prior_beta("spatial-scene", "describe_scene") == 4.5
    assert get_primitive_beta_range("spatial-scene") == (1.0, 4.5)


def test_spatial_scene_spoken_mode_uses_constructed_response_prior():
    prior = get_discrimination_prior("spatial-scene", "describe_scene")
    assert prior.a == 1.4
    assert prior.c == 0.0
