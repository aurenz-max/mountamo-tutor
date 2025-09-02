from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import logging
import hashlib
import json

from ..schemas.true_false_problems import TrueFalsePayload, TrueFalseResponse
from .recommender import ProblemRecommender
from ..core.config import settings

# Google Gemini SDK imports
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

logger = logging.getLogger(__name__)

class TrueFalseGenerationRequest:
    """Internal request model for true/false generation"""
    def __init__(self, subject: str, unit_id: str, skill_id: str, subskill_id: str, 
                 difficulty: str, allow_explain_why: bool, trickiness: str,
                 description: str = "", concept_group: str = "", detailed_objective: str = ""):
        self.subject = subject
        self.unit_id = unit_id
        self.skill_id = skill_id
        self.subskill_id = subskill_id
        self.difficulty = difficulty
        self.allow_explain_why = allow_explain_why
        self.trickiness = trickiness
        self.description = description
        self.concept_group = concept_group
        self.detailed_objective = detailed_objective

class TrueFalseService:
    """
    Service for generating true/false questions using Gemini 2.5 Flash
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
                raise RuntimeError("GEMINI_API_KEY setting required for TrueFalse service")

    async def generate_true_false(self,
                                  student_id: int,
                                  request: TrueFalseGenerationRequest) -> Optional[TrueFalseResponse]:
        """
        Generate a true/false question using Gemini 2.5 Flash with structured output.

        Args:
            student_id: The student's ID for personalization
            request: TrueFalse generation request with subject/unit/skill/subskill context

        Returns:
            TrueFalseResponse or None if generation fails
        """
        try:
            logger.info(f"Generating true/false for student {student_id}: subject={request.subject}, "
                       f"skill={request.skill_id}, subskill={request.subskill_id}")

            # Generate true/false using Gemini 2.5 Flash with structured output
            return await self._generate_with_gemini_structured(request)

        except Exception as e:
            logger.error(f"Error generating true/false: {str(e)}")
            return None

    async def _generate_with_gemini_structured(self, request: TrueFalseGenerationRequest) -> Optional[TrueFalseResponse]:
        """Generate true/false using Gemini 2.5 Flash with structured output"""

        # Build enhanced system prompt with recommender context
        system_prompt = self._build_true_false_system_prompt(request)

        # Define structured response schema for Gemini
        response_schema = types.Schema(
            type="object",
            properties={
                "id": {"type": "string"},
                "statement": {"type": "string"},
                "correct": {"type": "boolean"},
                "prompt": {"type": "string"},
                "rationale": {"type": "string"},
                "allow_explain_why": {"type": "boolean"},
                "trickiness": {"type": "string"},
                "difficulty": {"type": "string"},
                "metadata": {
                    "type": "object",
                    "properties": {
                        "grade_band": {"type": "string"}
                    }
                }
            },
            required=[
                "id",
                "statement", 
                "correct",
                "prompt",
                "rationale",
                "allow_explain_why",
                "trickiness",
                "difficulty"
            ],
        )

        # Configure generation parameters
        gen_cfg = types.GenerateContentConfig(
            temperature=0.6,
            top_p=0.9,
            top_k=40,
            max_output_tokens=2048,
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

            # Convert to TrueFalseResponse model
            tf_response = await self._convert_gemini_response_to_tf(data, request)
            return tf_response

        except Exception as e:
            logger.error(f"True/false generation failed: {str(e)}")
            return None

    def _build_true_false_system_prompt(self, request: TrueFalseGenerationRequest) -> str:
        """Build system prompt for true/false generation using recommender context"""

        prompt = f"""You are an expert teacher creating high-quality true/false questions for K-12 students.

CONTEXT INFORMATION:
- Subject: {request.subject}
- Unit: {request.unit_id}
- Skill: {request.skill_id} - {request.description}
- Subskill: {request.subskill_id}
- Concept Group: {request.concept_group}
- Learning Objective: {request.detailed_objective}
- Difficulty Level: {request.difficulty}
- Allow Explanation: {request.allow_explain_why}
- Trickiness Level: {request.trickiness}

STATEMENT REQUIREMENTS:
1. Create a single, clear, unambiguous statement that directly tests the specified skill
2. Avoid ambiguous language, double negatives, or multi-part claims
3. Statement should be age-appropriate for K-12 students
4. Keep statement between 10-150 characters
5. Provide a 1-3 sentence rationale explaining why the statement is true or false
6. The prompt should always be: "Decide whether the statement is True or False."

TRICKINESS GUIDELINES:
- '{request.trickiness}': """

        if request.trickiness == "negation":
            prompt += "Use careful negation but keep it fair and educational"
        elif request.trickiness == "absolute_terms":
            prompt += "Include words like 'always', 'never', 'all' where appropriate"
        elif request.trickiness == "subtle_detail":
            prompt += "Focus on a subtle but important detail that tests deeper understanding"
        else:  # none
            prompt += "Keep the statement straightforward and clear"

        prompt += """

Generate a unique statement that hasn't been seen before. Focus on direct application of the skill."""

        return prompt

    def _validate_gemini_response(self, data: Dict[str, Any]) -> bool:
        """Validate Gemini structured response"""

        required_fields = ['id', 'statement', 'correct', 'prompt', 'rationale', 'allow_explain_why', 'trickiness', 'difficulty']

        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field: {field}")
                return False

        if not isinstance(data.get('correct'), bool):
            logger.error(f"Field 'correct' must be boolean, got: {type(data.get('correct'))}")
            return False

        if not isinstance(data.get('allow_explain_why'), bool):
            logger.error(f"Field 'allow_explain_why' must be boolean, got: {type(data.get('allow_explain_why'))}")
            return False

        return True

    async def _convert_gemini_response_to_tf(self,
                                           data: Dict[str, Any],
                                           request: TrueFalseGenerationRequest) -> TrueFalseResponse:
        """Convert Gemini response to TrueFalseResponse model"""

        # Generate deterministic ID
        content_hash = hashlib.md5(
            f"{request.subject}_{request.skill_id}_{request.subskill_id}_{data['statement']}".encode()
        ).hexdigest()

        # Merge metadata
        metadata = data.get('metadata', {})
        metadata.update({
            "concept_group": request.concept_group,
            "detailed_objective": request.detailed_objective,
            "description": request.description,
            "generated_at": datetime.utcnow().isoformat()
        })

        # Create response
        tf_response = TrueFalseResponse(
            id=content_hash[:16],  # Use first 16 chars of hash
            subject=request.subject,
            skill_id=request.skill_id,
            subskill_id=request.subskill_id,
            difficulty=request.difficulty,
            statement=data['statement'],
            correct=data['correct'],
            prompt=data['prompt'],
            rationale=data['rationale'],
            allow_explain_why=data['allow_explain_why'],
            trickiness=data['trickiness'],
            metadata=metadata
        )

        logger.info(f"Successfully created true/false with ID: {tf_response.id}")
        return tf_response

    async def get_true_false_from_recommender(self,
                                            student_id: int,
                                            subject: str,
                                            unit_id: Optional[str] = None,
                                            skill_id: Optional[str] = None,
                                            subskill_id: Optional[str] = None,
                                            difficulty: str = "medium",
                                            allow_explain_why: bool = False,
                                            trickiness: str = "none") -> Optional[TrueFalseResponse]:
        """
        Get true/false using recommender to determine optimal subject/unit/skill/subskill
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

            # Create true/false generation request with recommender context
            generation_request = TrueFalseGenerationRequest(
                subject=subject,
                unit_id=recommendation['unit']['id'],
                skill_id=recommendation['skill']['id'],
                subskill_id=recommendation['subskill']['id'],
                difficulty=difficulty,
                allow_explain_why=allow_explain_why,
                trickiness=trickiness,
                description=recommendation['skill']['description'],
                concept_group=objectives.get('ConceptGroup', 'General'),
                detailed_objective=objectives.get('DetailedObjective', 'Basic understanding')
            )

            # Generate the true/false question
            return await self.generate_true_false(student_id, generation_request)

        except Exception as e:
            logger.error(f"Error getting true/false from recommender: {str(e)}")
            return None

    async def evaluate_submission(self, submission) -> Dict[str, Any]:
        """Evaluate a true/false submission (basic implementation)"""
        
        try:
            true_false = submission.true_false
            is_correct = submission.selected_answer == true_false.correct
            
            return {
                "is_correct": is_correct,
                "selected_answer": submission.selected_answer,
                "correct_answer": true_false.correct,
                "explanation": true_false.rationale,
                "student_explanation": getattr(submission, 'explanation', None),
                "metadata": {
                    "problem_id": true_false.id,
                    "subject": true_false.subject,
                    "skill_id": true_false.skill_id,
                    "subskill_id": true_false.subskill_id,
                    "difficulty": true_false.difficulty,
                    "trickiness": true_false.trickiness,
                    "submitted_at": getattr(submission, 'submitted_at', datetime.utcnow()).isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error evaluating true/false submission: {str(e)}")
            return {
                "is_correct": False,
                "explanation": "Error in evaluation",
                "metadata": {"error": str(e)}
            }