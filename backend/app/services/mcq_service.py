from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import logging
import hashlib
import json

from ..schemas.mcq_problems import MCQGenerationRequest, MCQResponse, MCQOption
from .recommender import ProblemRecommender
from ..core.config import settings


# Google Gemini SDK imports
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

logger = logging.getLogger(__name__)


class MCQService:
    """
    Service for generating multiple choice questions using Gemini 2.5 Flash
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
                raise RuntimeError("GEMINI_API_KEY setting required for MCQ service")

    async def generate_mcq(self,
                          student_id: int,
                          request: MCQGenerationRequest) -> Optional[MCQResponse]:
        """
        Generate a multiple choice question using Gemini 2.5 Flash with structured output.

        Args:
            student_id: The student's ID for personalization
            request: MCQ generation request with subject/unit/skill/subskill context

        Returns:
            MCQResponse or None if generation fails
        """
        try:
            logger.info(f"Generating MCQ for student {student_id}: subject={request.subject}, "
                       f"skill={request.skill_id}, subskill={request.subskill_id}")

            # Generate MCQ using Gemini 2.5 Flash with structured output
            return await self._generate_with_gemini_structured(request)

        except Exception as e:
            logger.error(f"Error generating MCQ: {str(e)}")
            return None

    async def _generate_with_gemini_structured(self, request: MCQGenerationRequest) -> Optional[MCQResponse]:
        """Generate MCQ using Gemini 2.5 Flash with structured output"""

        # Build enhanced system prompt with recommender context
        system_prompt = self._build_mcq_system_prompt(request)

        # Define structured response schema for Gemini
        response_schema = types.Schema(
            type="object",
            properties={
                "id": {"type": "string"},
                "question": {"type": "string"},
                "options": {
                    "type": "array",
                    "minItems": 4,
                    "maxItems": 6,
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "Single letter option ID (A, B, C, D, E, or F)"
                            },
                            "text": {"type": "string"},
                        },
                        "required": ["id", "text"],
                    },
                },
                "correct_option_id": {
                    "type": "string",
                    "description": "Single letter ID matching one of the options (A, B, C, D, E, or F)"
                },
                "rationale": {"type": "string"},
                "difficulty": {"type": "string"},
            },
            required=[
                "id",
                "question",
                "options",
                "correct_option_id",
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
                # Log response details for debugging
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

            # Convert to MCQResponse model
            mcq_response = await self._convert_gemini_response_to_mcq(data, request)
            return mcq_response

        except Exception as e:
            logger.error(f"MCQ generation failed: {str(e)}")
            return None

    def _build_mcq_system_prompt(self, request: MCQGenerationRequest) -> str:
        """Build system prompt for MCQ generation using recommender context"""

        prompt = f"""You are an expert teacher creating high-quality multiple-choice questions for K-12 students.

CONTEXT INFORMATION:
- Subject: {request.subject}
- Unit: {request.unit_id}
- Skill: {request.skill_id} - {request.description}
- Subskill: {request.subskill_id}
- Concept Group: {request.concept_group}
- Learning Objective: {request.detailed_objective}
- Difficulty Level: {request.difficulty}
- Distractor Style: {request.distractor_style}

QUESTION REQUIREMENTS:
1. Create a clear, focused question that directly tests the specified skill
2. Provide exactly 4 options with IDs EXACTLY: "A", "B", "C", "D" (single letters only)
3. One option must be clearly correct, others should be plausible distractors
4. Include a brief rationale explaining why the correct answer is right
5. Question should be age-appropriate for K-12 students
6. Keep question stem between 15-200 characters
7. Each option should be 10-120 characters

IMPORTANT: Option IDs must be single letters only (A, B, C, D), not prefixed formats like "OPT_A"

DISTRACTOR GUIDELINES:
- '{request.distractor_style}': """

        if request.distractor_style == "plausible":
            prompt += "Create distractors that seem reasonable but are incorrect"
        elif request.distractor_style == "humorous-but-educational":
            prompt += "Make distractors funny but teach an important concept through humor"
        else:  # common-misconception
            prompt += "Base distractors on common student misconceptions about this topic"

        prompt += """

Generate a unique question that hasn't been seen before. Focus on direct application of the skill."""

        return prompt

    def _validate_gemini_response(self, data: Dict[str, Any]) -> bool:
        """Validate Gemini structured response"""

        required_fields = ['id', 'question', 'options', 'correct_option_id', 'rationale', 'difficulty']

        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field: {field}")
                return False

        options = data.get('options', [])
        if not isinstance(options, list) or len(options) < 4 or len(options) > 6:
            logger.error(f"Invalid options format: {len(options)} options")
            return False

        correct_id = data.get('correct_option_id')
        option_ids = [opt.get('id') for opt in options]

        if correct_id not in option_ids:
            logger.error(f"correct_option_id '{correct_id}' not in options: {option_ids}")
            return False

        return True

    async def _convert_gemini_response_to_mcq(self,
                                            data: Dict[str, Any],
                                            request: MCQGenerationRequest) -> MCQResponse:
        """Convert Gemini response to MCQResponse model"""

        # Generate deterministic ID
        content_hash = hashlib.md5(
            f"{request.subject}_{request.skill_id}_{request.subskill_id}_{data['question']}".encode()
        ).hexdigest()

        # Convert options to MCQOption models
        options = []
        for opt in data['options']:
            options.append(MCQOption(
                id=opt['id'].upper(),
                text=opt['text']
            ))

        # Create response
        mcq_response = MCQResponse(
            id=content_hash[:16],  # Use first 16 chars of hash
            subject=request.subject,
            unit_id=request.unit_id,
            skill_id=request.skill_id,
            subskill_id=request.subskill_id,
            difficulty=request.difficulty,
            question=data['question'],
            options=options,
            correct_option_id=data['correct_option_id'].upper(),
            rationale=data['rationale'],
            metadata={
                "concept_group": request.concept_group,
                "detailed_objective": request.detailed_objective,
                "description": request.description,
                "distractor_style": request.distractor_style,
                "generated_at": datetime.utcnow().isoformat()
            }
        )

        logger.info(f"Successfully created MCQ with ID: {mcq_response.id}")
        return mcq_response

    async def get_mcq_from_recommender(self,
                                      student_id: int,
                                      subject: str,
                                      unit_id: Optional[str] = None,
                                      skill_id: Optional[str] = None,
                                      subskill_id: Optional[str] = None,
                                      difficulty: str = "medium",
                                      distractor_style: str = "plausible") -> Optional[MCQResponse]:
        """
        Get MCQ using recommender to determine optimal subject/unit/skill/subskill
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

            # Create MCQ generation request with recommender context
            generation_request = MCQGenerationRequest(
                subject=subject,
                unit_id=recommendation['unit']['id'],
                skill_id=recommendation['skill']['id'],
                subskill_id=recommendation['subskill']['id'],
                difficulty=difficulty,
                distractor_style=distractor_style,
                description=recommendation['skill']['description'],
                concept_group=objectives.get('ConceptGroup', 'General'),
                detailed_objective=objectives.get('DetailedObjective', 'Basic understanding')
            )

            # Generate the MCQ
            return await self.generate_mcq(student_id, generation_request)

        except Exception as e:
            logger.error(f"Error getting MCQ from recommender: {str(e)}")
            return None
