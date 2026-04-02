"""
Canonical grade codes used across the curriculum system.

Both short codes ("K", "1") and long-form names ("Kindergarten", "1st Grade")
are accepted everywhere. validate_grade() normalises to the canonical form
stored in Firestore for the given subject.
"""

GRADE_CODES = [
    "Pre-K", "Kindergarten",
    "1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade", "6th Grade",
    "7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade",
]

GRADE_LABELS = {code: code for code in GRADE_CODES}

# Map short codes and common aliases to canonical long-form names.
# Firestore may store either form; validate_grade accepts both.
GRADE_ALIASES = {
    "PK": "Pre-K",
    "K": "Kindergarten",
    **{str(i): f"{i}{'st' if i == 1 else 'nd' if i == 2 else 'rd' if i == 3 else 'th'} Grade"
       for i in range(1, 13)},
}


def validate_grade(grade: str) -> str:
    """Validate and return the grade string (canonical or short-code).

    Accepts both short codes ("K", "1") and long-form ("Kindergarten", "1st Grade").
    Returns the input as-is if valid — callers that need a specific form should
    use normalise_grade().
    """
    if grade in GRADE_CODES or grade in GRADE_ALIASES:
        return grade
    raise ValueError(
        f"Invalid grade '{grade}'. Accepted values: short codes ({', '.join(GRADE_ALIASES.keys())}) "
        f"or full names ({', '.join(GRADE_CODES)})"
    )


def normalise_grade(grade: str) -> str:
    """Convert any accepted grade input to its canonical long-form name."""
    validate_grade(grade)
    return GRADE_ALIASES.get(grade, grade)


# Reverse lookup: long-form → short code
_REVERSE_ALIASES = {long: short for short, long in GRADE_ALIASES.items()}


def to_short_grade(grade: str) -> str:
    """Convert any accepted grade input to the short code used as Firestore doc IDs."""
    validate_grade(grade)
    return _REVERSE_ALIASES.get(grade, grade)


def grades_match(a: str, b: str) -> bool:
    """Return True if two grade strings refer to the same grade level.

    Handles any mix of short codes ('1', 'K') and long-form names
    ('1st Grade', 'Kindergarten').
    """
    if a == b:
        return True
    # Normalise both to long-form and compare
    try:
        return normalise_grade(a) == normalise_grade(b)
    except ValueError:
        return False
