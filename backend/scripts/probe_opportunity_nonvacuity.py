"""Revert the new submit gate in memory; never edits the worktree or a learner.

Run from backend with the backend Python environment. Expected: old gate fails
the no-op regression, restored gate passes. Exit 0 means both checks held.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services import submission_service
from tests.test_misconception_opportunities import test_matching_tag_without_compiled_opportunity_cannot_resolve

source = Path(submission_service.__file__).read_text(encoding="utf-8")
needle = 'if primitive_type == "place-value-chart":'
assert source.count(needle) == 1
namespace = {"__name__": submission_service.__name__, "__package__": submission_service.__package__}
exec(compile(source.replace(needle, 'if False:  # in-memory old score/tag path', 1), "<old-score-tag-path>", "exec"), namespace)
original = submission_service.SubmissionService._handle_lumina_primitive
try:
    submission_service.SubmissionService._handle_lumina_primitive = namespace["SubmissionService"]._handle_lumina_primitive
    try:
        test_matching_tag_without_compiled_opportunity_cannot_resolve()
    except AssertionError:
        print("OLD PATH: regression fails as expected (unexpected resolution after fan-out)")
    else:
        raise AssertionError("Revert did not make the regression fail")
finally:
    submission_service.SubmissionService._handle_lumina_primitive = original
test_matching_tag_without_compiled_opportunity_cannot_resolve()
print("FIXED PATH: regression passes (normal fan-out, hypothesis remains active)")
