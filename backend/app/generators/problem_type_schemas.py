# backend/app/generators/problem_type_schemas.py
"""
Individual problem type schemas for scalable problem generation.

This module provides focused schemas for each problem type, enabling:
- Per-type generation to avoid schema complexity limits
- Flexible model selection (Flash Fast vs Flash based on complexity)
- Parallel generation without state-space explosion
"""

from google.genai.types import Schema
from .content_schemas import (
    VISUAL_INTENT_SCHEMA,
    LIVE_INTERACTION_SCHEMA_STEP1,
    LIVE_INTERACTION_CONFIG_SCHEMA
)

# ============================================================================
# INDIVIDUAL PROBLEM TYPE SCHEMAS (Step 1 - with visual intents)
# ============================================================================

# Multiple Choice - Medium Complexity
MULTIPLE_CHOICE_ITEM_SCHEMA = Schema(
    type="object",
    properties={
        "id": Schema(type="string"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),
        "question": Schema(type="string"),
        "question_visual_intent": VISUAL_INTENT_SCHEMA,
        "options": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "text": Schema(type="string")
                },
                required=["id", "text"]
            )
        ),
        "correct_option_id": Schema(type="string"),
        "rationale": Schema(type="string"),
        "teaching_note": Schema(type="string"),
        "success_criteria": Schema(type="array", items=Schema(type="string")),
        "live_interaction_config": LIVE_INTERACTION_CONFIG_SCHEMA
    },
    required=["id", "difficulty", "grade_level", "question", "question_visual_intent", "options", "correct_option_id", "rationale", "teaching_note", "success_criteria"]
)

MULTIPLE_CHOICE_GENERATION_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(type="array", items=MULTIPLE_CHOICE_ITEM_SCHEMA)
    },
    required=["problems"]
)

# True/False - Simple
TRUE_FALSE_ITEM_SCHEMA = Schema(
    type="object",
    properties={
        "id": Schema(type="string"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),
        "statement": Schema(type="string"),
        "statement_visual_intent": VISUAL_INTENT_SCHEMA,
        "correct": Schema(type="boolean"),
        "rationale": Schema(type="string"),
        "teaching_note": Schema(type="string"),
        "success_criteria": Schema(type="array", items=Schema(type="string")),
        "live_interaction_config": LIVE_INTERACTION_CONFIG_SCHEMA
    },
    required=["id", "difficulty", "grade_level", "statement", "statement_visual_intent", "correct", "rationale", "teaching_note", "success_criteria"]
)

TRUE_FALSE_GENERATION_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(type="array", items=TRUE_FALSE_ITEM_SCHEMA)
    },
    required=["problems"]
)

# Fill in Blanks - Simple
FILL_IN_BLANKS_ITEM_SCHEMA = Schema(
    type="object",
    properties={
        "id": Schema(type="string"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),
        "text_with_blanks": Schema(type="string"),
        "blanks": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "correct_answers": Schema(type="array", items=Schema(type="string")),
                    "case_sensitive": Schema(type="boolean")
                },
                required=["id", "correct_answers", "case_sensitive"]
            )
        ),
        "rationale": Schema(type="string"),
        "teaching_note": Schema(type="string"),
        "success_criteria": Schema(type="array", items=Schema(type="string")),
        "live_interaction_config": LIVE_INTERACTION_CONFIG_SCHEMA
    },
    required=["id", "difficulty", "grade_level", "text_with_blanks", "blanks", "rationale", "teaching_note", "success_criteria"]
)

FILL_IN_BLANKS_GENERATION_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(type="array", items=FILL_IN_BLANKS_ITEM_SCHEMA)
    },
    required=["problems"]
)

# Matching Activity - Complex
MATCHING_ACTIVITY_ITEM_SCHEMA = Schema(
    type="object",
    properties={
        "id": Schema(type="string"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),
        "prompt": Schema(type="string"),
        "left_items": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "text": Schema(type="string")
                },
                required=["id", "text"]
            )
        ),
        "right_items": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "text": Schema(type="string")
                },
                required=["id", "text"]
            )
        ),
        "mappings": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "left_id": Schema(type="string"),
                    "right_ids": Schema(type="array", items=Schema(type="string"))
                },
                required=["left_id", "right_ids"]
            )
        ),
        "rationale": Schema(type="string"),
        "teaching_note": Schema(type="string"),
        "success_criteria": Schema(type="array", items=Schema(type="string")),
        "live_interaction_config": LIVE_INTERACTION_CONFIG_SCHEMA
    },
    required=["id", "difficulty", "grade_level", "prompt", "left_items", "right_items", "mappings", "rationale", "teaching_note", "success_criteria"]
)

MATCHING_ACTIVITY_GENERATION_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(type="array", items=MATCHING_ACTIVITY_ITEM_SCHEMA)
    },
    required=["problems"]
)

# Sequencing Activity - Simple
SEQUENCING_ACTIVITY_ITEM_SCHEMA = Schema(
    type="object",
    properties={
        "id": Schema(type="string"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),
        "instruction": Schema(type="string"),
        "items": Schema(type="array", items=Schema(type="string")),
        "rationale": Schema(type="string"),
        "teaching_note": Schema(type="string"),
        "success_criteria": Schema(type="array", items=Schema(type="string")),
        "live_interaction_config": LIVE_INTERACTION_CONFIG_SCHEMA
    },
    required=["id", "difficulty", "grade_level", "instruction", "items", "rationale", "teaching_note", "success_criteria"]
)

SEQUENCING_ACTIVITY_GENERATION_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(type="array", items=SEQUENCING_ACTIVITY_ITEM_SCHEMA)
    },
    required=["problems"]
)

# Categorization Activity - Complex
CATEGORIZATION_ACTIVITY_ITEM_SCHEMA = Schema(
    type="object",
    properties={
        "id": Schema(type="string"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),
        "instruction": Schema(type="string"),
        "categories": Schema(type="array", items=Schema(type="string")),
        "categorization_items": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "item_text": Schema(type="string"),
                    "correct_category": Schema(type="string")
                },
                required=["item_text", "correct_category"]
            )
        ),
        "rationale": Schema(type="string"),
        "teaching_note": Schema(type="string"),
        "success_criteria": Schema(type="array", items=Schema(type="string")),
        "live_interaction_config": LIVE_INTERACTION_CONFIG_SCHEMA
    },
    required=["id", "difficulty", "grade_level", "instruction", "categories", "categorization_items", "rationale", "teaching_note", "success_criteria"]
)

CATEGORIZATION_ACTIVITY_GENERATION_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(type="array", items=CATEGORIZATION_ACTIVITY_ITEM_SCHEMA)
    },
    required=["problems"]
)

# Scenario Question - Complex
SCENARIO_QUESTION_ITEM_SCHEMA = Schema(
    type="object",
    properties={
        "id": Schema(type="string"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),
        "scenario": Schema(type="string"),
        "scenario_question": Schema(type="string"),
        "scenario_answer": Schema(type="string"),
        "rationale": Schema(type="string"),
        "teaching_note": Schema(type="string"),
        "success_criteria": Schema(type="array", items=Schema(type="string")),
        "live_interaction_config": LIVE_INTERACTION_CONFIG_SCHEMA
    },
    required=["id", "difficulty", "grade_level", "scenario", "scenario_question", "scenario_answer", "rationale", "teaching_note", "success_criteria"]
)

SCENARIO_QUESTION_GENERATION_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(type="array", items=SCENARIO_QUESTION_ITEM_SCHEMA)
    },
    required=["problems"]
)

# Short Answer - Simple
SHORT_ANSWER_ITEM_SCHEMA = Schema(
    type="object",
    properties={
        "id": Schema(type="string"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),
        "question": Schema(type="string"),
        "rationale": Schema(type="string"),
        "teaching_note": Schema(type="string"),
        "success_criteria": Schema(type="array", items=Schema(type="string")),
        "live_interaction_config": LIVE_INTERACTION_CONFIG_SCHEMA
    },
    required=["id", "difficulty", "grade_level", "question", "rationale", "teaching_note", "success_criteria"]
)

SHORT_ANSWER_GENERATION_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(type="array", items=SHORT_ANSWER_ITEM_SCHEMA)
    },
    required=["problems"]
)

# Live Interaction - Very Complex
LIVE_INTERACTION_GENERATION_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(type="array", items=LIVE_INTERACTION_SCHEMA_STEP1)
    },
    required=["problems"]
)

# ============================================================================
# PHASE 1: TYPE SELECTION SCHEMA
# ============================================================================

TYPE_SELECTION_SCHEMA = Schema(
    type="object",
    properties={
        "selected_types": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "type": Schema(
                        type="string",
                        enum=[
                            "multiple_choice",
                            "true_false",
                            "fill_in_blanks",
                            "matching_activity",
                            "sequencing_activity",
                            "categorization_activity",
                            "scenario_question",
                            "short_answer",
                            "live_interaction"
                        ],
                        description="The problem type to generate"
                    ),
                    "count": Schema(
                        type="integer",
                        description="Number of problems of this type to generate",
                        minimum=1
                    ),
                    "reasoning": Schema(
                        type="string",
                        description="Brief explanation of why this type is appropriate for the learning objectives"
                    ),
                    "enable_ai_coach": Schema(
                        type="boolean",
                        description="Whether to enable live AI coaching for these problems. Consider: K-2 students (strongly favor), phonics/reading/ABC content (strongly favor), problem complexity (simpler problems benefit more), skill type (concepts requiring verbal explanation benefit most)"
                    ),
                    "ai_coach_rationale": Schema(
                        type="string",
                        description="Brief explanation of why AI coach was enabled or disabled for this problem type"
                    )
                },
                required=["type", "count", "reasoning", "enable_ai_coach", "ai_coach_rationale"]
            ),
            description="List of problem types to generate with counts and AI coach configuration"
        ),
        "overall_reasoning": Schema(
            type="string",
            description="Overall pedagogical reasoning for this combination of problem types"
        )
    },
    required=["selected_types", "overall_reasoning"]
)

# ============================================================================
# PROBLEM TYPE METADATA
# ============================================================================

PROBLEM_TYPE_METADATA = {
    "multiple_choice": {
        "schema": MULTIPLE_CHOICE_GENERATION_SCHEMA,
        "model": "gemini-flash-latest",  # Medium complexity - use Flash
        "complexity": "medium",
        "max_tokens": 10000,
        "best_for": "Comprehension testing, concept assessment, identifying correct answers from options"
    },
    "true_false": {
        "schema": TRUE_FALSE_GENERATION_SCHEMA,
        "model": "gemini-flash-lite-latest",  # Simple - use Flash Fast
        "complexity": "simple",
        "max_tokens": 10000,
        "best_for": "Quick fact checking, misconception identification, binary understanding"
    },
    "fill_in_blanks": {
        "schema": FILL_IN_BLANKS_GENERATION_SCHEMA,
        "model": "gemini-flash-lite-latest",  # Simple - use Flash Fast
        "complexity": "simple",
        "max_tokens": 10000,
        "best_for": "Vocabulary practice, key term recall, context-based learning"
    },
    "matching_activity": {
        "schema": MATCHING_ACTIVITY_GENERATION_SCHEMA,
        "model": "gemini-flash-latest",  # Complex - use Flash
        "complexity": "complex",
        "max_tokens": 10000,
        "best_for": "Building relationships, connecting concepts, pairing terms with definitions"
    },
    "sequencing_activity": {
        "schema": SEQUENCING_ACTIVITY_GENERATION_SCHEMA,
        "model": "gemini-flash-lite-latest",  # Simple - use Flash Fast
        "complexity": "simple",
        "max_tokens": 10000,
        "best_for": "Process understanding, chronological ordering, step-by-step thinking"
    },
    "categorization_activity": {
        "schema": CATEGORIZATION_ACTIVITY_GENERATION_SCHEMA,
        "model": "gemini-flash-latest",  # Complex - use Flash
        "complexity": "complex",
        "max_tokens": 10000,
        "best_for": "Classification skills, grouping by attributes, organizing concepts"
    },
    "scenario_question": {
        "schema": SCENARIO_QUESTION_GENERATION_SCHEMA,
        "model": "gemini-flash-latest",  # Complex - use Flash
        "complexity": "complex",
        "max_tokens": 10000,
        "best_for": "Real-world application, critical thinking, contextual problem solving"
    },
    "short_answer": {
        "schema": SHORT_ANSWER_GENERATION_SCHEMA,
        "model": "gemini-flash-lite-latest",  # Simple - use Flash Fast
        "complexity": "simple",
        "max_tokens": 10000,
        "best_for": "Open-ended responses, explanation practice, brief written expression"
    },
    "live_interaction": {
        "schema": LIVE_INTERACTION_GENERATION_SCHEMA,
        "model": "gemini-flash-latest",  # Very complex - use Flash
        "complexity": "very_complex",
        "max_tokens": 10000,
        "best_for": "Interactive learning, phonics practice, real-time AI guidance, verbal/click responses"
    }
}

# List of all available problem types
ALL_PROBLEM_TYPES = list(PROBLEM_TYPE_METADATA.keys())
