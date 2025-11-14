"""
Section type definitions and specifications for curriculum content generation.

Defines the 6 meta section types with their quality criteria, word counts,
and recommended visual primitives.
"""

from enum import Enum
from dataclasses import dataclass
from typing import List, Tuple


class SectionType(str, Enum):
    """
    Meta section types for educational content.

    Each type serves a specific pedagogical purpose and has associated
    quality criteria, word count targets, and visual primitive recommendations.
    """
    INTRODUCTION_MOTIVATION = "introduction_motivation"
    INTUITIVE_EXPLANATION = "intuitive_explanation"
    FORMAL_DEFINITION = "formal_definition"
    WORKED_EXAMPLES = "worked_examples"
    COMMON_ERRORS = "common_errors"
    CONNECTIONS_EXTENSIONS = "connections_extensions"


@dataclass
class SectionTypeSpec:
    """
    Specification for a section type including pedagogical guidance and constraints.
    """
    section_type: SectionType
    purpose: str
    core_elements: List[str]
    quality_criteria: List[str]
    word_count_range: Tuple[int, int]  # (min, max)
    recommended_primitives: List[str]
    tone_and_style: str


# Section type specifications based on detailed pedagogical requirements
SECTION_TYPE_SPECS = {
    SectionType.INTRODUCTION_MOTIVATION: SectionTypeSpec(
        section_type=SectionType.INTRODUCTION_MOTIVATION,
        purpose="Hook the learner and establish *why* this matters before diving into content.",
        core_elements=[
            "Real-world context where this concept appears",
            "A concrete problem or question that this objective will help solve",
            "Connection to learner's existing knowledge",
            "Learning goal stated in plain language"
        ],
        quality_criteria=[
            "Opens with something concrete, not abstract",
            "Avoids jargon or defines terms immediately",
            "Creates curiosity or need-to-know",
            "2-3 paragraphs max"
        ],
        word_count_range=(150, 250),
        recommended_primitives=[
            "contextual-image",
            "scenario",
            "real-world-connection"
        ],
        tone_and_style="Conversational, energizing, connects to real experience"
    ),

    SectionType.INTUITIVE_EXPLANATION: SectionTypeSpec(
        section_type=SectionType.INTUITIVE_EXPLANATION,
        purpose="Build conceptual understanding *before* formalism. Learner should grasp the 'essence' of the idea.",
        core_elements=[
            "Explanation using everyday language and familiar analogies",
            "Multiple representations of the same concept (verbal, visual metaphor, concrete example)",
            "Focus on the 'what' and 'why' rather than 'how to calculate'",
            "Anticipate and address common questions"
        ],
        quality_criteria=[
            "Uses concrete nouns, active verbs, minimal technical vocabulary",
            "Analogies are genuinely illuminating (not just decorative)",
            "Builds intuition that will make formal definition feel inevitable",
            "3-5 paragraphs",
            "Could be understood by someone one skill-level below target"
        ],
        word_count_range=(300, 500),
        recommended_primitives=[
            "analogy-diagram",
            "concept-comparison",
            "visual-metaphor",
            "interactive-model",
            "concept-map"
        ],
        tone_and_style="Everyday language, concrete, builds mental models"
    ),

    SectionType.FORMAL_DEFINITION: SectionTypeSpec(
        section_type=SectionType.FORMAL_DEFINITION,
        purpose="Provide the precise, technical definition that can be referenced and used for problem-solving.",
        core_elements=[
            "Precise mathematical or technical definition",
            "Notation explained explicitly",
            "All terms defined",
            "Conditions, constraints, or domain specified",
            "Connection back to intuitive explanation"
        ],
        quality_criteria=[
            "Unambiguous and complete",
            "Notation is standard for the field",
            "Every symbol and term is defined before use",
            "2-4 paragraphs",
            "Could serve as a reference to look up later"
        ],
        word_count_range=(200, 400),
        recommended_primitives=[
            "formal-notation",
            "definition-diagram",
            "annotated-notation",
            "definition-box",
            "venn-diagram"
        ],
        tone_and_style="Precise, formal, clear, connects to intuition"
    ),

    SectionType.WORKED_EXAMPLES: SectionTypeSpec(
        section_type=SectionType.WORKED_EXAMPLES,
        purpose="Show the concept in action through detailed, step-by-step problem-solving.",
        core_elements=[
            "2-4 examples of increasing complexity",
            "Each example fully worked with explicit reasoning at each step",
            "Explanation of *why* each step (not just showing calculation)",
            "Examples chosen to highlight different aspects or common scenarios",
            "Final answer with sense-check or interpretation"
        ],
        quality_criteria=[
            "Steps are granular enough that learner can follow",
            "Reasoning is explicit ('We do this because...')",
            "Examples are meaningfully different from each other",
            "Progresses from simple to complex"
        ],
        word_count_range=(400, 800),
        recommended_primitives=[
            "problem-setup",
            "step-diagram",
            "solution-path",
            "annotated-work",
            "worked-example"
        ],
        tone_and_style="Clear, step-by-step, explicit reasoning"
    ),

    SectionType.COMMON_ERRORS: SectionTypeSpec(
        section_type=SectionType.COMMON_ERRORS,
        purpose="Explicitly identify and address misconceptions before they become ingrained.",
        core_elements=[
            "2-4 most common mistakes learners make with this concept",
            "What the mistake looks like",
            "Why learners make this mistake (the underlying misconception)",
            "Example showing the error",
            "Correct approach with explanation",
            "How to avoid this error"
        ],
        quality_criteria=[
            "Focuses on conceptual errors, not just calculation slips",
            "Empathetic tone ('This is a natural mistake because...')",
            "Explains the faulty reasoning, not just shows wrong answer",
            "Provides clear contrast with correct approach"
        ],
        word_count_range=(300, 500),
        recommended_primitives=[
            "error-comparison",
            "misconception-diagram",
            "side-by-side",
            "warning-callout",
            "decision-tree"
        ],
        tone_and_style="Empathetic, non-judgmental, clarifying"
    ),

    SectionType.CONNECTIONS_EXTENSIONS: SectionTypeSpec(
        section_type=SectionType.CONNECTIONS_EXTENSIONS,
        purpose="Show how this concept relates to other ideas and where it leads next.",
        core_elements=[
            "Connections to related concepts at same level",
            "References to where this concept appears in other subjects/contexts",
            "Preview of future topics that build on this foundation",
            "Real-world applications beyond textbook problems"
        ],
        quality_criteria=[
            "Makes 3-5 specific connections (not vague hand-waving)",
            "Shows both horizontal connections (related concepts) and vertical (what comes next)",
            "Inspiring without being overwhelming"
        ],
        word_count_range=(200, 400),
        recommended_primitives=[
            "concept-map",
            "pathway-diagram",
            "skill-tree",
            "cross-subject-connection",
            "application-example"
        ],
        tone_and_style="Forward-looking, connections-focused, inspiring"
    )
}


def get_section_spec(section_type: SectionType) -> SectionTypeSpec:
    """
    Get the specification for a given section type.

    Args:
        section_type: The section type to get specs for

    Returns:
        SectionTypeSpec with full details
    """
    return SECTION_TYPE_SPECS[section_type]


def get_recommended_primitives_for_section(section_type: SectionType) -> List[str]:
    """
    Get the list of recommended primitive types for a section.

    Args:
        section_type: The section type

    Returns:
        List of primitive type names (e.g., ['analogy-diagram', 'concept-map'])
    """
    spec = get_section_spec(section_type)
    return spec.recommended_primitives


def validate_section_word_count(section_type: SectionType, word_count: int) -> Tuple[bool, str]:
    """
    Validate that a section's word count is within the target range.

    Args:
        section_type: The section type
        word_count: Actual word count of the section

    Returns:
        Tuple of (is_valid, message)
    """
    spec = get_section_spec(section_type)
    min_words, max_words = spec.word_count_range

    if word_count < min_words:
        return False, f"Section is too short ({word_count} words). Target: {min_words}-{max_words} words."
    elif word_count > max_words:
        return False, f"Section is too long ({word_count} words). Target: {min_words}-{max_words} words."
    else:
        return True, f"Word count ({word_count}) is within target range ({min_words}-{max_words})."


def get_all_section_types() -> List[SectionType]:
    """Get all available section types."""
    return list(SectionType)


def get_section_type_description(section_type: SectionType) -> str:
    """
    Get a brief description of a section type's purpose.

    Args:
        section_type: The section type

    Returns:
        Purpose description string
    """
    spec = get_section_spec(section_type)
    return spec.purpose
