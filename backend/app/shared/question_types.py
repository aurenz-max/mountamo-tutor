# backend/app/shared/question_types.py
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Union, Literal
from enum import Enum

class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    CATEGORIZATION = "categorization"
    SEQUENCING = "sequencing"
    SHORT_ANSWER = "short_answer"
    SCENARIO = "scenario"
    FILL_IN_BLANKS = "fill_in_blanks"
    MATCHING = "matching"

# Base class
class BaseQuestion(BaseModel):
    id: str
    type: QuestionType
    question_text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    rationale: str = ""
    teaching_note: str = ""
    success_criteria: List[str] = Field(default_factory=list)

# Specific question types with their own answer key structures
class MultipleChoiceQuestion(BaseQuestion):
    type: Literal[QuestionType.MULTIPLE_CHOICE] = QuestionType.MULTIPLE_CHOICE
    options: List[str]
    correct_answer: int  # Index of correct option

class TrueFalseQuestion(BaseQuestion):
    type: Literal[QuestionType.TRUE_FALSE] = QuestionType.TRUE_FALSE
    correct_answer: bool

class CategorizationQuestion(BaseQuestion):
    type: Literal[QuestionType.CATEGORIZATION] = QuestionType.CATEGORIZATION
    items: List[str]
    categories: List[str]
    correct_answer: Dict[str, str]  # item -> category mapping
    instruction: str = ""

class SequencingQuestion(BaseQuestion):
    type: Literal[QuestionType.SEQUENCING] = QuestionType.SEQUENCING
    items: List[str]
    correct_answer: List[str]  # Correct order
    instruction: str = ""

class ShortAnswerQuestion(BaseQuestion):
    type: Literal[QuestionType.SHORT_ANSWER] = QuestionType.SHORT_ANSWER
    correct_answer: str
    accept_partial: bool = True

class ScenarioQuestion(BaseQuestion):
    type: Literal[QuestionType.SCENARIO] = QuestionType.SCENARIO
    scenario_text: str
    correct_answer: str

class FillInBlanksQuestion(BaseQuestion):
    type: Literal[QuestionType.FILL_IN_BLANKS] = QuestionType.FILL_IN_BLANKS
    text_with_blanks: str
    correct_answers: List[str]  # Ordered list of correct answers for each blank
    case_sensitive: bool = False

class MatchingQuestion(BaseQuestion):
    type: Literal[QuestionType.MATCHING] = QuestionType.MATCHING
    left_items: List[str]
    right_items: List[str]
    correct_answer: Dict[str, str]  # left_item -> right_item mapping
    instruction: str = ""

# Discriminated union for all question types
Question = Union[
    MultipleChoiceQuestion,
    TrueFalseQuestion,
    CategorizationQuestion,
    SequencingQuestion,
    ShortAnswerQuestion,
    ScenarioQuestion,
    FillInBlanksQuestion,
    MatchingQuestion
]

# Student responses also need to be polymorphic
class BaseResponse(BaseModel):
    question_id: str
    question_type: QuestionType
    time_spent: int = 0

class MultipleChoiceResponse(BaseResponse):
    question_type: Literal[QuestionType.MULTIPLE_CHOICE] = QuestionType.MULTIPLE_CHOICE
    answer: int  # Selected option index

class TrueFalseResponse(BaseResponse):
    question_type: Literal[QuestionType.TRUE_FALSE] = QuestionType.TRUE_FALSE
    answer: bool

class CategorizationResponse(BaseResponse):
    question_type: Literal[QuestionType.CATEGORIZATION] = QuestionType.CATEGORIZATION
    answer: Dict[str, str]  # item -> category mapping

class SequencingResponse(BaseResponse):
    question_type: Literal[QuestionType.SEQUENCING] = QuestionType.SEQUENCING
    answer: List[str]  # Student's ordering

class ShortAnswerResponse(BaseResponse):
    question_type: Literal[QuestionType.SHORT_ANSWER] = QuestionType.SHORT_ANSWER
    answer: str

class ScenarioResponse(BaseResponse):
    question_type: Literal[QuestionType.SCENARIO] = QuestionType.SCENARIO
    answer: str

class FillInBlanksResponse(BaseResponse):
    question_type: Literal[QuestionType.FILL_IN_BLANKS] = QuestionType.FILL_IN_BLANKS
    answer: List[str]  # Ordered list of student answers for each blank

class MatchingResponse(BaseResponse):
    question_type: Literal[QuestionType.MATCHING] = QuestionType.MATCHING
    answer: Dict[str, str]  # left_item -> right_item mapping

# Discriminated union for all response types
StudentResponse = Union[
    MultipleChoiceResponse,
    TrueFalseResponse,
    CategorizationResponse,
    SequencingResponse,
    ShortAnswerResponse,
    ScenarioResponse,
    FillInBlanksResponse,
    MatchingResponse
]

# Evaluation result
class QuestionEvaluation(BaseModel):
    question_id: str
    question_type: QuestionType
    is_correct: bool
    score: float  # 0-10 scale
    feedback: str
    student_answer: str
    correct_answer: str
    explanation: str = ""