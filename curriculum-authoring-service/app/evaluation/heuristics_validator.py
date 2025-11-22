"""
Tier 2: Heuristic Validator

Performs automated quality checks including:
- Readability analysis (Flesch-Kincaid)
- Placeholder detection
- Visual coherence (character limits, word length, UI overflow risks)
"""

import logging
import re
from typing import Dict, Any, List, Tuple
import textstat
from .rubrics import HeuristicReport, VisualCoherence

logger = logging.getLogger(__name__)


class HeuristicValidator:
    """Automated heuristic quality checks"""

    # Visual coherence constraints (based on your UI component limits)
    MAX_QUESTION_CHARS = 500
    MAX_OPTION_CHARS = 100
    MAX_TEACHING_NOTE_CHARS = 800
    MAX_LINE_BREAKS = 10
    MAX_WORD_LENGTH = 25

    # Placeholder patterns to detect
    PLACEHOLDER_PATTERNS = [
        r'\[INSERT\]',
        r'\[TODO\]',
        r'\{[a-zA-Z_]+\}',  # Template variables like {name}
        r'TODO:',
        r'FIXME:',
        # Note: Ellipsis (...) removed - it's pedagogically valid in many contexts
        r'XXX',
    ]

    # Forbidden content patterns
    FORBIDDEN_PATTERNS = [
        r'<[^>]+>',  # HTML tags
        r'&[a-z]+;',  # HTML entities
        r'javascript:',  # Script injection
    ]

    def validate(
        self,
        problem: Dict[str, Any],
        target_grade_level: str = "K"
    ) -> HeuristicReport:
        """
        Perform heuristic validation on a problem

        Args:
            problem: Problem dict to validate
            target_grade_level: Expected grade level (for readability check)

        Returns:
            HeuristicReport with all heuristic metrics
        """
        warnings = []
        failures = []

        # Extract problem text for analysis
        problem_text = self._extract_text_content(problem)

        # 1. Readability Analysis
        readability_score, readability_appropriate = self._check_readability(
            problem_text,
            target_grade_level
        )

        if not readability_appropriate:
            warnings.append(
                f"Readability level ({readability_score:.1f}) may not match target grade {target_grade_level}"
            )

        # 2. Placeholder Detection
        has_placeholders = self._check_placeholders(problem_text)
        if has_placeholders:
            failures.append("Problem contains placeholder text (e.g., [INSERT], TODO, {variable})")

        # 3. Text metrics
        total_char_count = len(problem_text)
        word_count = len(problem_text.split())

        # 4. Visual Coherence Checks
        visual_coherence = self._check_visual_coherence(problem)
        if not visual_coherence.passes_constraints:
            failures.extend(visual_coherence.issues)

        # Overall pass/fail
        passed = not failures and not has_placeholders

        return HeuristicReport(
            readability_score=readability_score,
            readability_appropriate=readability_appropriate,
            has_placeholders=has_placeholders,
            total_char_count=total_char_count,
            word_count=word_count,
            visual_coherence=visual_coherence,
            passed=passed,
            warnings=warnings,
            failures=failures
        )

    def _extract_text_content(self, problem: Dict[str, Any]) -> str:
        """Extract all text content from problem for analysis"""
        texts = []

        # Question or statement
        if "question" in problem:
            texts.append(problem["question"])
        if "statement" in problem:
            texts.append(problem["statement"])

        # Options (for multiple choice)
        if "options" in problem:
            for option in problem["options"]:
                if isinstance(option, dict) and "text" in option:
                    texts.append(option["text"])

        # Rationale and teaching note
        if "rationale" in problem:
            texts.append(problem["rationale"])
        if "teaching_note" in problem:
            texts.append(problem["teaching_note"])

        return " ".join(texts)

    def _check_readability(
        self,
        text: str,
        target_grade: str
    ) -> Tuple[float, bool]:
        """
        Check readability using Flesch-Kincaid grade level

        Args:
            text: Text to analyze
            target_grade: Expected grade level (K, 1, 2, etc.)

        Returns:
            (readability_score, is_appropriate)
        """
        try:
            fk_grade = textstat.flesch_kincaid_grade(text)

            # Convert target grade to numeric
            if target_grade == "K":
                target_numeric = 0
            elif target_grade == "Pre-K":
                target_numeric = -1
            else:
                try:
                    target_numeric = int(target_grade)
                except ValueError:
                    target_numeric = 0

            # Allow +/- 2 grade levels of flexibility
            is_appropriate = abs(fk_grade - target_numeric) <= 2

            return fk_grade, is_appropriate

        except Exception as e:
            logger.warning(f"Error calculating readability: {str(e)}")
            return 0.0, True  # Default to passing if we can't calculate

    def _check_placeholders(self, text: str) -> bool:
        """Check if text contains placeholder patterns"""
        for pattern in self.PLACEHOLDER_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                logger.debug(f"Found placeholder pattern: {pattern}")
                return True
        return False

    def _check_visual_coherence(self, problem: Dict[str, Any]) -> VisualCoherence:
        """
        Check visual coherence and UI rendering constraints

        This is the critical check for your concern about text overflow
        and broken UI formatting.
        """
        issues = []
        has_overflow_risk = False
        has_forbidden_content = False

        # Track metrics
        max_char_count = 0
        longest_word_length = 0
        max_line_breaks = 0

        # Field-specific metrics
        question_char_count = None
        options_max_char = None
        teaching_note_char_count = None

        # Helper function to analyze a field
        def analyze_field(field_name: str, text: str, max_allowed: int) -> None:
            nonlocal max_char_count, longest_word_length, max_line_breaks, has_overflow_risk, has_forbidden_content

            char_count = len(text)
            max_char_count = max(max_char_count, char_count)

            # Check character limit
            if char_count > max_allowed:
                has_overflow_risk = True
                issues.append(
                    f"{field_name} exceeds character limit: {char_count} > {max_allowed}"
                )

            # Check word length
            words = text.split()
            for word in words:
                word_len = len(word)
                longest_word_length = max(longest_word_length, word_len)
                if word_len > self.MAX_WORD_LENGTH:
                    has_overflow_risk = True
                    issues.append(
                        f"{field_name} contains word too long ({word_len} chars): '{word[:30]}...'"
                    )

            # Check line breaks
            line_breaks = text.count('\n')
            max_line_breaks = max(max_line_breaks, line_breaks)
            if line_breaks > self.MAX_LINE_BREAKS:
                has_overflow_risk = True
                issues.append(
                    f"{field_name} has too many line breaks: {line_breaks} > {self.MAX_LINE_BREAKS}"
                )

            # Check for forbidden content
            for pattern in self.FORBIDDEN_PATTERNS:
                if re.search(pattern, text):
                    has_forbidden_content = True
                    issues.append(f"{field_name} contains forbidden content (pattern: {pattern})")

        # Analyze question/statement
        if "question" in problem:
            analyze_field("question", problem["question"], self.MAX_QUESTION_CHARS)
            question_char_count = len(problem["question"])

        if "statement" in problem:
            analyze_field("statement", problem["statement"], self.MAX_QUESTION_CHARS)
            question_char_count = len(problem["statement"])

        # Analyze options
        if "options" in problem:
            option_chars = []
            for i, option in enumerate(problem["options"]):
                if isinstance(option, dict) and "text" in option:
                    analyze_field(f"options[{i}]", option["text"], self.MAX_OPTION_CHARS)
                    option_chars.append(len(option["text"]))

            if option_chars:
                options_max_char = max(option_chars)

        # Analyze teaching note
        if "teaching_note" in problem:
            analyze_field("teaching_note", problem["teaching_note"], self.MAX_TEACHING_NOTE_CHARS)
            teaching_note_char_count = len(problem["teaching_note"])

        # Analyze rationale (use same limit as teaching note)
        if "rationale" in problem:
            analyze_field("rationale", problem["rationale"], self.MAX_TEACHING_NOTE_CHARS)

        # Overall pass/fail
        passes_constraints = not has_overflow_risk and not has_forbidden_content

        return VisualCoherence(
            passes_constraints=passes_constraints,
            max_char_count=max_char_count,
            longest_word_length=longest_word_length,
            max_line_breaks=max_line_breaks,
            has_overflow_risk=has_overflow_risk,
            has_forbidden_content=has_forbidden_content,
            issues=issues,
            question_char_count=question_char_count,
            options_max_char=options_max_char,
            teaching_note_char_count=teaching_note_char_count
        )


# Convenience function
def validate_heuristics(
    problem: Dict[str, Any],
    target_grade_level: str = "K"
) -> HeuristicReport:
    """
    Validate a single problem using heuristic checks

    Args:
        problem: Problem dict to validate
        target_grade_level: Expected grade level

    Returns:
        HeuristicReport
    """
    validator = HeuristicValidator()
    return validator.validate(problem, target_grade_level)
