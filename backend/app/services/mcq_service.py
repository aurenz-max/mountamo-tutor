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
                          request: MCQGenerationRequest,
                          count: int) -> Optional[List[MCQResponse]]:
        """
        Generate a batch of multiple choice questions using Gemini 2.5 Flash.
        """
        try:
            logger.info(f"Generating batch of {count} MCQs for student {student_id}: subject={request.subject}")
            return await self._generate_with_gemini_structured(request, count)
        except Exception as e:
            logger.error(f"Error generating MCQ batch: {str(e)}")
            return None

    async def _generate_with_gemini_structured(self, request: MCQGenerationRequest, count: int) -> Optional[List[MCQResponse]]:
        """Generate a batch of MCQs using Gemini 2.5 Flash with a structured output schema."""

        system_prompt = self._build_mcq_system_prompt(request, count)

        # Schema for a single MCQ object
        mcq_schema = types.Schema(
            type="object",
            properties={
                "id": {"type": "string"}, "question": {"type": "string"},
                "options": {
                    "type": "array", "minItems": 4, "maxItems": 6,
                    "items": {"type": "object", "properties": {"id": {"type": "string"}, "text": {"type": "string"}}, "required": ["id", "text"]},
                },
                "correct_option_id": {"type": "string"}, "rationale": {"type": "string"}, "difficulty": {"type": "string"},
            },
            required=["id", "question", "options", "correct_option_id", "rationale", "difficulty"],
        )

        # The response schema is now an array of the MCQ schema
        response_schema = types.Schema(type="array", items=mcq_schema)

        gen_cfg = types.GenerateContentConfig(
            temperature=0.7, top_p=0.9, top_k=40, max_output_tokens=8192,
            response_mime_type="application/json", response_schema=response_schema
        )

        try:
            response = await self._gemini_client.aio.models.generate_content(
                model=self._gemini_model, contents=system_prompt, config=gen_cfg,
            )

            if not response or not response.text:
                logger.error("Empty response from Gemini for batch generation")
                return None

            data_list = json.loads(response.text)
            if not isinstance(data_list, list):
                logger.error("Gemini response is not a list for batch generation")
                return None
            
            mcq_responses = []
            for data in data_list:
                if self._validate_gemini_response(data):
                    mcq_responses.append(await self._convert_gemini_response_to_mcq(data, request))
            return mcq_responses

        except Exception as e:
            logger.error(f"MCQ batch generation failed: {str(e)}")
            return None

    def _build_mcq_system_prompt(self, request: MCQGenerationRequest, count: int) -> str:
        """Build system prompt for MCQ batch generation."""

        prompt = f"""You are an expert teacher creating a diverse set of high-quality multiple-choice questions for K-12 students.

CONTEXT INFORMATION:
- Subject: {request.subject}
- Skill: {request.skill_id} - {request.description}
- Difficulty Level: {request.difficulty}
- Distractor Style: {request.distractor_style}

TASK:
Generate a JSON array containing exactly {count} unique multiple-choice questions based on the context above.

REQUIREMENTS FOR EACH QUESTION IN THE ARRAY:
1. Ensure each question is distinct and tests a slightly different aspect of the skill.
2. Provide exactly 4 options with IDs "A", "B", "C", "D".
3. One option must be clearly correct.
4. Distractors must be plausible and based on common misconceptions.
5. Include a brief rationale explaining why the correct answer is right.
"""
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
                                      count: int,
                                      unit_id: Optional[str] = None,
                                      skill_id: Optional[str] = None,
                                      subskill_id: Optional[str] = None,
                                      difficulty: str = "medium",
                                      distractor_style: str = "plausible") -> Optional[List[MCQResponse]]:
        """
        Get a batch of MCQs using recommender to determine optimal context.
        """
        try:
            # Get a single recommendation for the topic
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

            objectives = await self.recommender.competency_service.get_detailed_objectives(
                subject=subject,
                subskill_id=recommendation['subskill']['id']
            )

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

            # Generate the batch of MCQs
            return await self.generate_mcq(student_id, generation_request, count)

        except Exception as e:
            logger.error(f"Error getting MCQ batch from recommender: {str(e)}")
            return None
