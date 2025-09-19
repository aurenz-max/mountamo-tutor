# Assessment-Specific Schema Specification

## Overview

Create well-defined schemas specifically for the assessment service that leverage existing `PRACTICE_PROBLEMS_SCHEMA` and `PROBLEM_REVIEW_SCHEMA` from `backend/app/generators/content_schemas.py`. This focuses purely on assessment functionality without modifying the existing problem submission API.

## Current Assessment Service Issues

**Current State in `backend/app/services/assessment_service.py`:**
- Uses loose `Dict[str, Any]` for problem content and reviews
- Creates ad-hoc review structures in `score_assessment()` method
- Missing structured metadata that matches the provided JSON example
- AI Assessment Service expects specific structured format

## Solution: Assessment-Specific Schemas

### Phase 1: Create Assessment Problem Schema

**New File: `backend/app/schemas/assessment_problems.py`**

```python
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

# Union type for all assessment problem types
AssessmentProblemType = Union[
    AssessmentMultipleChoice,
    AssessmentTrueFalse,
    AssessmentFillInBlanks,
    AssessmentMatchingActivity,
    AssessmentSequencingActivity,
    AssessmentCategorizationActivity,
    AssessmentScenarioQuestion,
    AssessmentShortAnswer
]
```

### Phase 2: Create Assessment Review Schema

**New File: `backend/app/schemas/assessment_review.py`**

```python
"""
Assessment-specific review schemas based on PROBLEM_REVIEW_SCHEMA
These match the structure from the provided JSON example
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class AssessmentReviewObservation(BaseModel):
    """Observation section for assessment reviews"""
    canvas_description: str = Field(..., description="Description of visual work (if any)")
    selected_answer: str = Field(..., description="The answer selected/provided by student")
    work_shown: str = Field(..., description="Description of work or reasoning shown")

class AssessmentReviewAnalysis(BaseModel):
    """Analysis section for assessment reviews"""
    understanding: str = Field(..., description="Analysis of student's conceptual understanding")
    approach: str = Field(..., description="Student's problem-solving approach")
    accuracy: str = Field(..., description="Accuracy of student's response")
    creativity: str = Field(..., description="Note any creative or alternative solutions")

class AssessmentReviewEvaluation(BaseModel):
    """Evaluation section for assessment reviews"""
    score: int = Field(..., ge=0, le=10, description="Numerical score from 0-10")
    justification: str = Field(..., description="Explanation of the score")

class AssessmentReviewFeedback(BaseModel):
    """Feedback section for assessment reviews"""
    praise: str = Field(..., description="Specific praise for student's work")
    guidance: str = Field(..., description="Guidance for improvement")
    encouragement: str = Field(..., description="Encouraging message")
    next_steps: str = Field(..., description="Actionable next steps")

class AssessmentProblemReview(BaseModel):
    """Complete assessment problem review matching PROBLEM_REVIEW_SCHEMA"""
    observation: AssessmentReviewObservation
    analysis: AssessmentReviewAnalysis
    evaluation: AssessmentReviewEvaluation
    feedback: AssessmentReviewFeedback

    # Assessment-specific metadata
    skill_id: str
    subject: str
    subskill_id: str
    score: int = Field(..., ge=0, le=10)
    correct: bool
    accuracy_percentage: int = Field(..., ge=0, le=100)

class AssessmentReviewDocument(BaseModel):
    """
    Complete assessment review document matching the provided JSON example structure
    This is the canonical format for assessment problem reviews
    """
    # Core identification
    id: str
    student_id: int
    subject: str
    skill_id: str
    subskill_id: str
    problem_id: str
    timestamp: str

    # Problem content (the original assessment problem)
    problem_content: Dict[str, Any]  # Will contain AssessmentProblemType data

    # Complete review structure
    full_review: AssessmentProblemReview

    # Flattened top-level fields (matching JSON example)
    observation: AssessmentReviewObservation
    analysis: AssessmentReviewAnalysis
    evaluation: AssessmentReviewEvaluation
    feedback: AssessmentReviewFeedback
    score: int

    # Additional metadata
    firebase_uid: str
    created_at: str

    # Cosmos DB fields (optional)
    _rid: Optional[str] = None
    _self: Optional[str] = None
    _etag: Optional[str] = None
    _attachments: Optional[str] = None
    _ts: Optional[int] = None

class AssessmentSubmissionAnswer(BaseModel):
    """Schema for individual assessment answers"""
    problem_id: str
    student_answer: Optional[str] = None
    selected_option_id: Optional[str] = None  # For MCQ
    selected_options: Optional[Dict[str, str]] = None  # For matching, etc.
    answer_data: Optional[Dict[str, Any]] = None  # For complex answer types

class AssessmentSubmissionRequest(BaseModel):
    """Schema for complete assessment submission"""
    assessment_id: str
    student_id: int
    answers: Dict[str, Any]  # Maps problem_id to answer data
    time_taken_minutes: Optional[int] = None
    submitted_at: Optional[str] = None
```

### Phase 3: Update Assessment Service Implementation

#### 3.1 Update `backend/app/services/assessment_service.py`

**Key Changes:**

1. **Import assessment-specific schemas:**
```python
from ..schemas.assessment_problems import AssessmentProblemType, AssessmentMultipleChoice, AssessmentTrueFalse
from ..schemas.assessment_review import (
    AssessmentProblemReview,
    AssessmentReviewDocument,
    AssessmentReviewObservation,
    AssessmentReviewAnalysis,
    AssessmentReviewEvaluation,
    AssessmentReviewFeedback,
    AssessmentSubmissionRequest
)
```

2. **Update `_enrich_problems_with_metadata()` method:**
```python
def _enrich_problems_with_metadata(
    self,
    problems_data: Dict,
    selected_subskills: List[Dict],
    subject: str
) -> List[AssessmentProblemType]:
    """
    Convert generated problems to structured AssessmentProblemType objects
    """
    enriched_problems = []

    # Handle different problem types from the rich schema
    problem_types = ['multiple_choice', 'true_false', 'fill_in_blanks', 'matching_activity',
                    'sequencing_activity', 'categorization_activity', 'scenario_question', 'short_answer']

    subskill_index = 0
    for problem_type in problem_types:
        problems_of_type = problems_data.get(problem_type, [])

        for problem in problems_of_type:
            if subskill_index < len(selected_subskills):
                subskill = selected_subskills[subskill_index]

                # Create the appropriate assessment problem type
                if problem_type == "multiple_choice":
                    assessment_problem = AssessmentMultipleChoice(
                        id=problem.get('id', f"mcq_{subskill_index + 1}"),
                        difficulty=problem.get('difficulty', 'medium'),
                        grade_level=problem.get('grade_level', 'K'),
                        question=problem.get('question', ''),
                        options=[
                            AssessmentMCQOption(id=opt['id'], text=opt['text'])
                            for opt in problem.get('options', [])
                        ],
                        correct_option_id=problem.get('correct_option_id', 'A'),
                        rationale=problem.get('rationale', ''),
                        teaching_note=problem.get('teaching_note', ''),
                        success_criteria=problem.get('success_criteria', []),
                        skill_id=subskill.get('skill_id', 'default_skill'),
                        subskill_id=subskill.get('subskill_id', 'default_subskill'),
                        subject=subject
                    )
                elif problem_type == "true_false":
                    assessment_problem = AssessmentTrueFalse(
                        id=problem.get('id', f"tf_{subskill_index + 1}"),
                        difficulty=problem.get('difficulty', 'medium'),
                        grade_level=problem.get('grade_level', 'K'),
                        statement=problem.get('statement', ''),
                        correct=problem.get('correct', True),
                        rationale=problem.get('rationale', ''),
                        teaching_note=problem.get('teaching_note', ''),
                        success_criteria=problem.get('success_criteria', []),
                        skill_id=subskill.get('skill_id', 'default_skill'),
                        subskill_id=subskill.get('subskill_id', 'default_subskill'),
                        subject=subject
                    )
                # ... handle other problem types similarly

                enriched_problems.append(assessment_problem)
                subskill_index += 1

    return enriched_problems
```

3. **Update `score_assessment()` method:**
```python
async def score_assessment(
    self,
    assessment_id: str,
    student_id: int,
    answers: Dict[str, Any],
    time_taken_minutes: Optional[int] = None,
    firebase_uid: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Score assessment using structured assessment schemas"""

    try:
        assessment = await self.get_assessment(assessment_id, student_id, firebase_uid)
        if not assessment:
            raise ValueError(f"Assessment {assessment_id} not found")

        problems = assessment.get("problems", [])
        problem_reviews = []
        correct_count = 0

        for problem_data in problems:
            # Convert problem to AssessmentProblemType if needed
            problem_id = str(problem_data.get("id"))
            student_answer_raw = answers.get(problem_id)

            # Create assessment review
            review = await self._create_assessment_review(
                problem_data, student_answer_raw, student_id, firebase_uid
            )

            if review.correct:
                correct_count += 1

            # Create review document matching JSON structure
            review_document = AssessmentReviewDocument(
                id=f"{assessment_id}_{problem_id}_{int(datetime.utcnow().timestamp())}",
                student_id=student_id,
                subject=assessment.get("subject", "Unknown"),
                skill_id=problem_data.get("skill_id", "unknown"),
                subskill_id=problem_data.get("subskill_id", "unknown"),
                problem_id=problem_id,
                timestamp=datetime.utcnow().isoformat(),
                problem_content=problem_data,
                full_review=review,
                observation=review.observation,
                analysis=review.analysis,
                evaluation=review.evaluation,
                feedback=review.feedback,
                score=review.score,
                firebase_uid=firebase_uid,
                created_at=datetime.utcnow().isoformat()
            )

            problem_reviews.append(review_document.dict())

        # Calculate final scores and return structured result
        total_questions = len(problems)
        score_percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0

        # ... rest of scoring logic

        return {
            "assessment_id": assessment_id,
            "student_id": student_id,
            "total_questions": total_questions,
            "correct_count": correct_count,
            "score_percentage": round(score_percentage, 2),
            "problem_reviews": problem_reviews,  # Now properly structured
            # ... other fields
        }

    except Exception as e:
        logger.error(f"Failed to score assessment: {e}")
        raise

async def _create_assessment_review(
    self,
    problem_data: Dict[str, Any],
    student_answer: Any,
    student_id: int,
    firebase_uid: str
) -> AssessmentProblemReview:
    """Create structured assessment review for a single problem"""

    problem_type = problem_data.get("problem_type", "unknown")
    is_correct = False
    selected_answer_text = "Not answered"

    if student_answer is not None:
        # Evaluate based on problem type
        if problem_type == "multiple_choice":
            correct_option_id = problem_data.get("correct_option_id")
            is_correct = str(student_answer) == correct_option_id

            # Find the selected option text
            options = problem_data.get("options", [])
            selected_option = next((opt for opt in options if opt.get("id") == str(student_answer)), None)
            selected_answer_text = selected_option.get("text", str(student_answer)) if selected_option else str(student_answer)

        elif problem_type == "true_false":
            correct_answer = problem_data.get("correct")
            is_correct = bool(student_answer) == correct_answer
            selected_answer_text = "True" if student_answer else "False"

        # ... handle other problem types

    score = 10 if is_correct else 3

    # Create structured review
    review = AssessmentProblemReview(
        observation=AssessmentReviewObservation(
            canvas_description="No canvas work for this assessment question",
            selected_answer=selected_answer_text,
            work_shown="Assessment response provided"
        ),
        analysis=AssessmentReviewAnalysis(
            understanding="Good understanding demonstrated" if is_correct else "Needs additional practice",
            approach="Student selected an answer" if student_answer is not None else "No approach shown",
            accuracy="Correct answer" if is_correct else "Incorrect answer",
            creativity="Standard assessment response"
        ),
        evaluation=AssessmentReviewEvaluation(
            score=score,
            justification=f"{'Correct' if is_correct else 'Incorrect'} answer for assessment question"
        ),
        feedback=AssessmentReviewFeedback(
            praise="Good work!" if is_correct else "Good effort!",
            guidance=problem_data.get("rationale", "Review the concept") if not is_correct else "Well done!",
            encouragement="Keep practicing!" if not is_correct else "Excellent!",
            next_steps="Continue to next question" if is_correct else "Review this topic"
        ),
        skill_id=problem_data.get("skill_id", "unknown"),
        subject=problem_data.get("subject", "unknown"),
        subskill_id=problem_data.get("subskill_id", "unknown"),
        score=score,
        correct=is_correct,
        accuracy_percentage=100 if is_correct else 30
    )

    return review
```

## Implementation Benefits

### ✅ **Assessment-Focused Design**
- Schemas specifically designed for assessment workflow
- No unnecessary coupling with existing problem submission API
- Clean separation of concerns

### ✅ **Structured Data**
- All assessment problems are properly typed
- Review documents match the provided JSON example structure
- Eliminates guesswork in data processing

### ✅ **AI Service Compatibility**
- Review structure matches what AI Assessment Service expects
- Consistent data format for all assessment processing
- Better error handling and validation

### ✅ **Maintainable Architecture**
- Clear schema definitions for assessment domain
- Easy to extend with new assessment problem types
- Self-contained assessment functionality

## Implementation Steps

1. **Create the schema files** (`assessment_problems.py`, `assessment_review.py`)
2. **Update AssessmentService** to use structured schemas
3. **Update AI Assessment Service** to expect structured data
4. **Test assessment flow** end-to-end with structured data
5. **Verify review documents** match JSON example structure

This approach gives you clean, well-defined schemas for assessments without the complexity of trying to unify different systems that serve different purposes.