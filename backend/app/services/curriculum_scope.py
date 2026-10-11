"""
Curriculum scope — the one place a (subject, grade) pair is resolved.

Subskill IDs are unique only within a grade (LA001-01-a is "decode CVC" in
Grade 1 and "narrative theme" in Grade 5), and the same subject exists in
every grade doc. Any read that names a subject without a grade is therefore
ambiguous. Every curriculum or graph read goes through a SCOPED subject id
("MATHEMATICS_GK", "LANGUAGE_ARTS_G1") built here; a bare subject is an error,
never a guess.

  grade_key("3rd")               -> "3"            Firestore grade doc id
  grade_key("K")                 -> "Kindergarten"
  scoped_subject_id("Mathematics", "K") -> "MATHEMATICS_GK"
  split_scoped("MATHEMATICS_G1") -> ("MATHEMATICS", "1")
  await student_grade(fs, 1004, "mathematics") -> "Kindergarten"
"""

from __future__ import annotations

import re
from typing import Optional, Tuple

from ..db.firestore_service import FirestoreService


class GradeUnresolved(ValueError):
    """A curriculum read had no grade. Raised instead of guessing one."""


def grade_key(grade: Optional[str]) -> Optional[str]:
    """Any grade spelling -> the curriculum_published grade doc id
    ("Kindergarten", "1".."12"), or None when it cannot be resolved."""
    code = FirestoreService.normalize_grade_code(grade)
    if code == "K":
        return "Kindergarten"
    if code.isdigit():
        return code
    return None


def subject_key(subject: str) -> str:
    """Any subject spelling ("Language Arts", "mathematics", "SCIENCE_G1")
    -> the bare Firestore subject id ("LANGUAGE_ARTS")."""
    return FirestoreService.rollup_subject_key(subject)


_SUFFIX = re.compile(r"_G(K|\d{1,2})$")


def split_scoped(subject_id: str) -> Tuple[str, Optional[str]]:
    """"MATHEMATICS_GK" -> ("MATHEMATICS", "Kindergarten"); no suffix -> grade None."""
    s = re.sub(r"[\s\-]+", "_", subject_id.strip().upper())
    m = _SUFFIX.search(s)
    if not m:
        return s, None
    return s[: m.start()], grade_key(m.group(1))


def scoped_subject_id(subject: str, grade: Optional[str]) -> str:
    """Subject + grade -> "SUBJECT_G<K|n>". A subject that already carries a
    suffix keeps it. Raises GradeUnresolved when no grade is available."""
    bare, suffix_grade = split_scoped(subject)
    g = grade_key(grade) or suffix_grade
    if not g:
        raise GradeUnresolved(f"No grade for subject {subject!r} (got {grade!r})")
    return f"{bare}_G{'K' if g == 'Kindergarten' else g}"


async def student_grade(firestore: FirestoreService, student_id: int, subject: str) -> str:
    """The grade a student studies `subject` at: the per-subject override
    (subject_grade_overrides, set by cross-grade promotion) wins over the grade
    of record (students/{id}.grade_level). Raises GradeUnresolved if neither."""
    fields = await firestore.get_student_planning_fields(student_id)
    overrides = fields.get("subject_grade_overrides") or {}
    g = grade_key(overrides.get(subject_key(subject))) or grade_key(fields.get("grade_level"))
    if not g:
        raise GradeUnresolved(f"Student {student_id} has no grade_level (subject {subject!r})")
    return g


async def student_scoped_subject(firestore: FirestoreService, student_id: int, subject: str) -> str:
    """The scoped subject id for this student's current grade in `subject`.
    A subject that already carries a grade suffix is returned as is."""
    if split_scoped(subject)[1]:
        return scoped_subject_id(subject, None)
    return scoped_subject_id(subject, await student_grade(firestore, student_id, subject))
