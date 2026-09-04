"""Subject-scope regressions for cross-subject Direct Instruction primitives."""

from app.services.curriculum_retrieval_service import CurriculumRetrievalMatcher


def test_di_dice_roll_uses_mathematics_before_the_di_family_default():
    assert (
        CurriculumRetrievalMatcher.subject_for_primitive("di-dice-roll", "di")
        == "MATHEMATICS"
    )
    assert (
        CurriculumRetrievalMatcher.subject_for_primitive("di-letter-sounds", "di")
        == "LANGUAGE_ARTS"
    )
