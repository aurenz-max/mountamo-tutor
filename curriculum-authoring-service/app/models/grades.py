"""
Canonical grade codes used across the curriculum system.

Storage: always use the short code (e.g., "K", "3", "PK").
Display: map to label at the UI layer only.
"""

GRADE_CODES = ["PK", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]

GRADE_LABELS = {
    "PK": "Pre-K",
    "K": "Kindergarten",
    "1": "1st Grade",
    "2": "2nd Grade",
    "3": "3rd Grade",
    "4": "4th Grade",
    "5": "5th Grade",
    "6": "6th Grade",
    "7": "7th Grade",
    "8": "8th Grade",
    "9": "9th Grade",
    "10": "10th Grade",
    "11": "11th Grade",
    "12": "12th Grade",
}


def validate_grade(grade: str) -> str:
    """Validate and return canonical grade code."""
    if grade not in GRADE_CODES:
        raise ValueError(f"Invalid grade '{grade}'. Must be one of: {', '.join(GRADE_CODES)}")
    return grade
