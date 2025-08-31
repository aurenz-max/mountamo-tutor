from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import logging
import hashlib
import json
import re

from ..schemas.fill_in_blank_problems import (
    FillInBlankGenerationRequest, 
    FillInBlankResponse, 
    BlankAnswer,
    StudentBlankAnswer,
    FillInBlankSubmission,
    BlankEvaluation,
    FillInBlankReview
)
from .recommender import ProblemRecommender
from ..core.config import settings


# Google Gemini SDK imports
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

logger = logging.getLogger(__name__)


class FillInBlankService:
    """
    Service for generating fill-in-the-blank questions using Gemini 2.5 Flash
    with structured output and integration with the recommender system.
    """

    def __init__(self, recommender: ProblemRecommender):
        self.recommender = recommender

        # Gemini-specific configuration
        self._gemini_model = "gemini-2.5-flash"
        self._gemini_client = None

        # Initialize Gemini client
        if genai:
            if settings.GEMINI_API_KEY:
                self._gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            else:
                raise RuntimeError("GEMINI_API_KEY setting required for Fill-in-the-blank service")

    async def generate_fill_in_blank(self,
                                   student_id: int,
                                   request: FillInBlankGenerationRequest) -> Optional[FillInBlankResponse]:
        """
        Generate a fill-in-the-blank question using Gemini 2.5 Flash with structured output.

        Args:
            student_id: The student's ID for personalization
            request: Fill-in-the-blank generation request with subject/unit/skill/subskill context

        Returns:
            FillInBlankResponse or None if generation fails
        """
        try:
            logger.info(f"Generating Fill-in-the-blank for student {student_id}: subject={request.subject}, "
                       f"skill={request.skill_id}, subskill={request.subskill_id}")

            # Generate Fill-in-the-blank using Gemini 2.5 Flash with structured output
            return await self._generate_with_gemini_structured(request)

        except Exception as e:
            logger.error(f"Error generating Fill-in-the-blank: {str(e)}")
            return None

    async def _generate_with_gemini_structured(self, request: FillInBlankGenerationRequest) -> Optional[FillInBlankResponse]:
        """Generate Fill-in-the-blank using Gemini 2.5 Flash with structured output"""

        # Build enhanced system prompt with recommender context
        system_prompt = self._build_fill_in_blank_system_prompt(request)

        # Define structured response schema for Gemini
        response_schema = types.Schema(
            type="object",
            properties={
                "id": {"type": "string"},
                "text_with_blanks": {
                    "type": "string", 
                    "description": "Question text with placeholders like {{B1}}, {{B2}} for blanks"
                },
                "blanks": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 5,
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "Blank ID like B1, B2, B3, etc."
                            },
                            "correct_answers": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 1,
                                "maxItems": 1,
                                "description": "Single expected answer for this blank"
                            },
                            "case_sensitive": {"type": "boolean"},
                        },
                        "required": ["id", "correct_answers", "case_sensitive"],
                    },
                },
                "rationale": {"type": "string"},
                "difficulty": {"type": "string"},
            },
            required=[
                "id",
                "text_with_blanks",
                "blanks",
                "rationale",
                "difficulty"
            ],
        )

        # Configure generation parameters
        gen_cfg = types.GenerateContentConfig(
            temperature=0.6,
            top_p=0.9,
            top_k=40,
            max_output_tokens=4096,
            response_mime_type="application/json",
            response_schema=response_schema
        )

        try:
            # Call Gemini 2.5 Flash
            response = await self._gemini_client.aio.models.generate_content(
                model=self._gemini_model,
                contents=system_prompt,
                config=gen_cfg,
            )

            if not response:
                logger.error("No response from Gemini")
                return None
            
            if not response.text:
                logger.error("Empty response text from Gemini")
                logger.error(f"Response object: {response}")
                if hasattr(response, 'candidates') and response.candidates:
                    logger.error(f"Candidates: {response.candidates}")
                    for i, candidate in enumerate(response.candidates):
                        logger.error(f"Candidate {i}: {candidate}")
                        if hasattr(candidate, 'finish_reason'):
                            logger.error(f"Finish reason: {candidate.finish_reason}")
                return None

            # Parse the structured JSON response
            data = json.loads(response.text)

            # Validate the response has required fields
            if not self._validate_gemini_response(data):
                return None

            # Convert to FillInBlankResponse model
            fill_in_blank_response = await self._convert_gemini_response_to_fill_in_blank(data, request)
            return fill_in_blank_response

        except Exception as e:
            logger.error(f"Fill-in-the-blank generation failed: {str(e)}")
            return None

    def _build_fill_in_blank_system_prompt(self, request: FillInBlankGenerationRequest) -> str:
        """Build system prompt for Fill-in-the-blank generation using recommender context"""

        prompt = f"""You are an expert teacher creating high-quality fill-in-the-blank questions for K-12 students.

CONTEXT INFORMATION:
- Subject: {request.subject}
- Unit: {request.unit_id} - {request.description}
- Skill: {request.skill_id}
- Subskill: {request.subskill_id}
- Concept Group: {request.concept_group}
- Learning Objective: {request.detailed_objective}
- Difficulty Level: {request.difficulty}

QUESTION REQUIREMENTS:
1. Create a clear, educational passage with strategic blanks that test the specified skill
2. Use placeholder format {{B1}}, {{B2}}, {{B3}} etc. for blanks (exactly this format)
3. Provide 1-5 blanks maximum, each testing important concepts
4. Each blank should have ONE expected answer (the AI review will handle variations)
5. Include a comprehensive rationale explaining all correct answers
6. Question should be age-appropriate for K-12 students
7. Text should be engaging and educational

BLANK GUIDELINES:
- Focus on key concepts, terms, or important details from the learning material
- Make blanks test understanding rather than memorization when possible
- Ensure blanks flow naturally within the sentence structure

BLANK ID FORMAT:
- Use exactly: B1, B2, B3, B4, B5 (no variations)
- Start with B1 and increment sequentially
- Match the IDs in text_with_blanks and blanks array

EXPECTED ANSWERS:
- Provide ONE clear expected answer per blank
- Choose the most standard/common form of the answer
- Set case_sensitive to false for most content (true only for proper nouns/specific terms)

Generate a unique question that directly tests the specified skill and helps students learn."""

        return prompt

    def _validate_gemini_response(self, data: Dict[str, Any]) -> bool:
        """Validate Gemini structured response"""

        required_fields = ['id', 'text_with_blanks', 'blanks', 'rationale', 'difficulty']

        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field: {field}")
                return False

        blanks = data.get('blanks', [])
        if not isinstance(blanks, list) or len(blanks) < 1 or len(blanks) > 5:
            logger.error(f"Invalid blanks format: {len(blanks)} blanks")
            return False

        # Validate each blank has required fields
        for blank in blanks:
            if not isinstance(blank, dict):
                logger.error(f"Invalid blank format: {blank}")
                return False
            if 'id' not in blank or 'correct_answers' not in blank:
                logger.error(f"Blank missing required fields: {blank}")
                return False
            if not isinstance(blank['correct_answers'], list) or len(blank['correct_answers']) != 1:
                logger.error(f"Blank should have exactly one correct answer: {blank['correct_answers']}")
                return False

        # Validate that blanks referenced in text exist in blanks array
        text_with_blanks = data.get('text_with_blanks', '')
        blank_ids_in_text = re.findall(r'\{\{([^}]+)\}\}', text_with_blanks)
        blank_ids_in_blanks = [blank['id'] for blank in blanks]

        for blank_id in blank_ids_in_text:
            if blank_id not in blank_ids_in_blanks:
                logger.error(f"Blank '{blank_id}' referenced in text but not defined in blanks")
                return False

        return True

    async def _convert_gemini_response_to_fill_in_blank(self,
                                                      data: Dict[str, Any],
                                                      request: FillInBlankGenerationRequest) -> FillInBlankResponse:
        """Convert Gemini response to FillInBlankResponse model"""

        # Generate deterministic ID
        content_hash = hashlib.md5(
            f"{request.subject}_{request.skill_id}_{request.subskill_id}_{data['text_with_blanks']}".encode()
        ).hexdigest()

        # Convert blanks to BlankAnswer models
        blanks = []
        for blank_data in data['blanks']:
            blanks.append(BlankAnswer(
                id=blank_data['id'],
                correct_answers=blank_data['correct_answers'],
                case_sensitive=blank_data.get('case_sensitive', False)
            ))

        # Create response
        fill_in_blank_response = FillInBlankResponse(
            id=content_hash[:16],  # Use first 16 chars of hash
            subject=request.subject,
            unit_id=request.unit_id,
            skill_id=request.skill_id,
            subskill_id=request.subskill_id,
            difficulty=request.difficulty,
            text_with_blanks=data['text_with_blanks'],
            blanks=blanks,
            rationale=data['rationale'],
            metadata={
                "concept_group": request.concept_group,
                "detailed_objective": request.detailed_objective,
                "description": request.description,
                "blank_style": request.blank_style,
                "generated_at": datetime.utcnow().isoformat()
            }
        )

        logger.info(f"Successfully created Fill-in-the-blank with ID: {fill_in_blank_response.id}")
        return fill_in_blank_response

    async def get_fill_in_blank_from_recommender(self,
                                               student_id: int,
                                               subject: str,
                                               unit_id: Optional[str] = None,
                                               skill_id: Optional[str] = None,
                                               subskill_id: Optional[str] = None,
                                               difficulty: str = "medium",
                                               blank_style: str = "standard") -> Optional[FillInBlankResponse]:
        """
        Get Fill-in-the-blank using recommender to determine optimal subject/unit/skill/subskill
        and retrieve description and concept group information.
        """

        try:
            # Get recommendation from recommender
            recommendation = await self.recommender.get_recommendation(
                student_id=student_id,
                subject=subject,
                unit_filter=unit_id,
                skill_filter=skill_id,
                subskill_filter=subskill_id
            )

            if not recommendation:
                logger.error("Failed to get recommendation from recommender")
                return None

            # Get detailed objectives for concept group
            objectives = await self.recommender.competency_service.get_detailed_objectives(
                subject=subject,
                subskill_id=recommendation['subskill']['id']
            )

            # Create Fill-in-the-blank generation request with recommender context
            generation_request = FillInBlankGenerationRequest(
                subject=subject,
                unit_id=recommendation['unit']['id'],
                skill_id=recommendation['skill']['id'],
                subskill_id=recommendation['subskill']['id'],
                difficulty=difficulty,
                blank_style=blank_style,
                description=recommendation['skill']['description'],
                concept_group=objectives.get('ConceptGroup', 'General'),
                detailed_objective=objectives.get('DetailedObjective', 'Basic understanding')
            )

            # Generate the Fill-in-the-blank
            return await self.generate_fill_in_blank(student_id, generation_request)

        except Exception as e:
            logger.error(f"Error getting Fill-in-the-blank from recommender: {str(e)}")
            return None

    async def evaluate_submission(self, submission: FillInBlankSubmission) -> FillInBlankReview:
        """
        Evaluate a fill-in-the-blank submission with basic string matching.
        This is a fallback method when LLM evaluation is not available.
        
        Args:
            submission: Student's submission with answers for all blanks
            
        Returns:
            FillInBlankReview with detailed evaluation
        """
        try:
            fill_in_blank = submission.fill_in_blank
            student_answers = submission.student_answers
            
            # Create a mapping of blank_id to student answer
            student_answer_map = {answer.blank_id: answer.answer for answer in student_answers}
            
            blank_evaluations = []
            total_blanks = len(fill_in_blank.blanks)
            correct_blanks = 0
            
            # Evaluate each blank
            for blank in fill_in_blank.blanks:
                student_answer = student_answer_map.get(blank.id, "").strip()
                
                # Check if answer is correct using basic string matching
                is_correct = self._check_blank_answer(student_answer, blank)
                
                if is_correct:
                    correct_blanks += 1
                    partial_credit = 1.0
                    feedback = f"Correct! '{student_answer}' is a valid answer."
                else:
                    partial_credit = 0.0
                    expected_answer = blank.correct_answers[0] if blank.correct_answers else "Unknown"
                    feedback = f"Incorrect. Expected: '{expected_answer}'"
                
                blank_evaluations.append(BlankEvaluation(
                    blank_id=blank.id,
                    student_answer=student_answer,
                    correct_answers=blank.correct_answers,
                    is_correct=is_correct,
                    partial_credit=partial_credit,
                    feedback=feedback
                ))
            
            # Calculate overall score
            percentage_correct = (correct_blanks / total_blanks * 100) if total_blanks > 0 else 0
            total_score = correct_blanks / total_blanks * 10  # Scale to 0-10
            overall_correct = correct_blanks == total_blanks
            
            # Generate overall explanation
            if overall_correct:
                explanation = f"Excellent work! You got all {total_blanks} blanks correct. {fill_in_blank.rationale}"
            elif correct_blanks > 0:
                explanation = f"Good effort! You got {correct_blanks} out of {total_blanks} blanks correct. {fill_in_blank.rationale}"
            else:
                explanation = f"Keep trying! Review the concepts and try again. {fill_in_blank.rationale}"
            
            return FillInBlankReview(
                overall_correct=overall_correct,
                total_score=total_score,
                blank_evaluations=blank_evaluations,
                explanation=explanation,
                percentage_correct=percentage_correct,
                metadata={
                    "question_id": fill_in_blank.id,
                    "total_blanks": total_blanks,
                    "correct_blanks": correct_blanks,
                    "submitted_at": submission.submitted_at.isoformat(),
                    "subject": fill_in_blank.subject,
                    "skill_id": fill_in_blank.skill_id,
                    "subskill_id": fill_in_blank.subskill_id,
                    "difficulty": fill_in_blank.difficulty,
                    "evaluation_method": "basic_string_matching"
                }
            )
            
        except Exception as e:
            logger.error(f"Error evaluating fill-in-the-blank submission: {str(e)}")
            # Return a default failed review
            return FillInBlankReview(
                overall_correct=False,
                total_score=0.0,
                blank_evaluations=[],
                explanation=f"Error evaluating submission: {str(e)}",
                percentage_correct=0.0,
                metadata={"error": str(e), "evaluation_method": "error_fallback"}
            )

    def _check_blank_answer(self, student_answer: str, blank: BlankAnswer) -> bool:
        """
        Check if a student's answer matches the expected answer for a blank.
        
        Args:
            student_answer: The student's input
            blank: The BlankAnswer object with correct answers and settings
            
        Returns:
            True if answer is correct, False otherwise
        """
        if not student_answer:
            return False
            
        # Handle numeric answers with tolerance
        if blank.tolerance is not None:
            try:
                student_num = float(student_answer)
                for correct_answer in blank.correct_answers:
                    try:
                        correct_num = float(correct_answer)
                        if abs(student_num - correct_num) <= blank.tolerance:
                            return True
                    except ValueError:
                        continue
                return False
            except ValueError:
                # Not a number, continue with string comparison
                pass
        
        # String comparison
        if blank.case_sensitive:
            student_clean = student_answer.strip()
            return student_clean in [answer.strip() for answer in blank.correct_answers]
        else:
            student_clean = student_answer.strip().lower()
            return student_clean in [answer.strip().lower() for answer in blank.correct_answers]