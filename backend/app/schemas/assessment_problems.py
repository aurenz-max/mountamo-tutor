"""
Assessment-specific problem schemas based on PRACTICE_PROBLEMS_SCHEMA
These are specifically for assessment problems, separate from general problem submission
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Union, Literal, Dict, Any
from enum import Enum

class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

# Base Assessment Problem
class BaseAssessmentProblem(BaseModel):
    """Base class for all assessment problems"""
    id: str
    difficulty: DifficultyLevel
    grade_level: str
    rationale: str
    teaching_note: str
    success_criteria: List[str]

    # Assessment-specific metadata
    skill_id: str
    subskill_id: str
    subject: str

    # Visual and interaction fields (optional for all problem types)
    visual_content: Optional[Dict[str, Any]] = None
    question_visual_data: Optional[Dict[str, Any]] = None
    statement_visual_data: Optional[Dict[str, Any]] = None
    interaction_config: Optional[Dict[str, Any]] = None
    live_interaction_config: Optional[Dict[str, Any]] = None

class AssessmentMCQOption(BaseModel):
    id: str
    text: str

class AssessmentMultipleChoice(BaseAssessmentProblem):
    """Multiple choice assessment problem"""
    problem_type: Literal["multiple_choice"] = "multiple_choice"
    question: str
    options: List[AssessmentMCQOption]
    correct_option_id: str

class AssessmentTrueFalse(BaseAssessmentProblem):
    """True/False assessment problem"""
    problem_type: Literal["true_false"] = "true_false"
    statement: str
    correct: bool

class AssessmentBlankItem(BaseModel):
    id: str
    correct_answers: List[str]
    case_sensitive: bool

class AssessmentFillInBlanks(BaseAssessmentProblem):
    """Fill in blanks assessment problem"""
    problem_type: Literal["fill_in_blanks"] = "fill_in_blanks"
    text_with_blanks: str
    blanks: List[AssessmentBlankItem]

class AssessmentMatchingItem(BaseModel):
    id: str
    text: str

class AssessmentMatchingMapping(BaseModel):
    left_id: str
    right_ids: List[str]

class AssessmentMatchingActivity(BaseAssessmentProblem):
    """Matching activity assessment problem"""
    problem_type: Literal["matching_activity"] = "matching_activity"
    prompt: str
    left_items: List[AssessmentMatchingItem]
    right_items: List[AssessmentMatchingItem]
    mappings: List[AssessmentMatchingMapping]

class AssessmentSequencingActivity(BaseAssessmentProblem):
    """Sequencing activity assessment problem"""
    problem_type: Literal["sequencing_activity"] = "sequencing_activity"
    instruction: str
    items: List[str]

class AssessmentCategorizationItem(BaseModel):
    item_text: str
    correct_category: str

class AssessmentCategorizationActivity(BaseAssessmentProblem):
    """Categorization activity assessment problem"""
    problem_type: Literal["categorization_activity"] = "categorization_activity"
    instruction: str
    categories: List[str]
    categorization_items: List[AssessmentCategorizationItem]

class AssessmentScenarioQuestion(BaseAssessmentProblem):
    """Scenario question assessment problem"""
    problem_type: Literal["scenario_question"] = "scenario_question"
    scenario: str
    scenario_question: str
    scenario_answer: str

class AssessmentShortAnswer(BaseAssessmentProblem):
    """Short answer assessment problem"""
    problem_type: Literal["short_answer"] = "short_answer"
    question: str

class AssessmentLiveInteraction(BaseAssessmentProblem):
    """Live interaction assessment problem with AI coach support"""
    problem_type: Literal["live_interaction"] = "live_interaction"
    prompt: Dict[str, Any]  # Structured prompt with instruction and context

# Union type for all assessment problem types
AssessmentProblemType = Union[
    AssessmentMultipleChoice,
    AssessmentTrueFalse,
    AssessmentFillInBlanks,
    AssessmentMatchingActivity,
    AssessmentSequencingActivity,
    AssessmentCategorizationActivity,
    AssessmentScenarioQuestion,
    AssessmentShortAnswer,
    AssessmentLiveInteraction
]