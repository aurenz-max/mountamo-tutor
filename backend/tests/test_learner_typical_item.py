"""The learner model's typical item is the registry's median item."""
import statistics

from app.services.calibration.problem_type_registry import PROBLEM_TYPE_REGISTRY, get_item_discrimination
from app.services.learner_model.engine import MASTERY_MARGIN, TYPICAL_A, sig


def test_typical_a_is_registry_median():
    a = [get_item_discrimination(p, m)[0] for p, modes in PROBLEM_TYPE_REGISTRY.items() for m in modes if m != "default"]
    assert statistics.median(a) == TYPICAL_A


def test_mastery_margin_is_80_percent_on_typical_item():
    assert abs(sig(TYPICAL_A * MASTERY_MARGIN) - 0.8) < 1e-9
