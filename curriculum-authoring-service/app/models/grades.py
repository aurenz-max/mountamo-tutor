"""
Canonical grade codes used across the curriculum system.
"""

GRADE_CODES = [
    "Pre-K", "Kindergarten",
    "1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade", "6th Grade",
    "7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade",
]

GRADE_LABELS = {code: code for code in GRADE_CODES}


def validate_grade(grade: str) -> str:
    """Validate and return canonical grade code."""
    if grade in GRADE_CODES:
        return grade
    raise ValueError(f"Invalid grade '{grade}'. Must be one of: {', '.join(GRADE_CODES)}")
