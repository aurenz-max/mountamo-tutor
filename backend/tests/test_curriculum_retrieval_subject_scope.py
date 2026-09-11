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


def test_older_learner_math_packs_use_mathematics_and_deduction_keeps_the_default():
    # /curriculum-fit di-word-problem-setup (2026-09-10): a live G3 session
    # attributed to a LANGUAGE_ARTS subskill because the pack had no override.
    for primitive in ("di-worked-procedure", "di-word-problem-setup"):
        assert (
            CurriculumRetrievalMatcher.subject_for_primitive(primitive, "di")
            == "MATHEMATICS"
        )
    # Deduction spans science, social studies and reading inference — the
    # family default stands until a curriculum home says otherwise.
    assert (
        CurriculumRetrievalMatcher.subject_for_primitive("di-deduction", "di")
        == "LANGUAGE_ARTS"
    )
