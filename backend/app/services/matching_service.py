from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import logging
import hashlib
import json

from ..schemas.matching_problems import (
    MatchingGenerationRequest, MatchingResponse, AssocItem, 
    LeftToRightMapping, MatchingSubmission, MatchingReview,
    MatchingEvaluation, StudentMatching
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


class MatchingService:
    """
    Service for generating concept matching problems using Gemini 2.5 Flash
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
                raise RuntimeError("GEMINI_API_KEY setting required for Matching service")

    async def generate_matching(self,
                              student_id: int,
                              request: MatchingGenerationRequest,
                              count: int) -> Optional[List[MatchingResponse]]:
        """
        Generate a batch of concept matching problems using Gemini 2.5 Flash with structured output.

        Args:
            student_id: The student's ID for personalization
            request: Matching generation request with subject/unit/skill/subskill context
            count: Number of matching problems to generate

        Returns:
            List[MatchingResponse] or None if generation fails
        """
        try:
            logger.info(f"Generating batch of {count} matching problems for student {student_id}: subject={request.subject}, "
                       f"skill={request.skill_id}, subskill={request.subskill_id}")

            # Generate matching problems using Gemini 2.5 Flash with structured output
            return await self._generate_with_gemini_structured(request, count)

        except Exception as e:
            logger.error(f"Error generating matching problem batch: {str(e)}")
            return None

    async def _generate_with_gemini_structured(self, request: MatchingGenerationRequest, count: int) -> Optional[List[MatchingResponse]]:
        """Generate a batch of matching problems using Gemini 2.5 Flash with structured output"""

        # Build enhanced system prompt with recommender context
        system_prompt = self._build_matching_system_prompt(request, count)

        # Schema for a single matching problem object
        matching_schema = types.Schema(
            type="object",
            properties={
                "id": {"type": "string"},
                "prompt": {"type": "string"},
                "left_items": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 8,
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "Left item ID (e.g., L1, L2, L3)"
                            },
                            "text": {"type": "string"},
                            "image_url": {
                                "type": "string",
                                "description": "Optional image URL"
                            }
                        },
                        "required": ["id", "text"],
                    },
                },
                "right_items": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 10,
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "Right item ID (e.g., R1, R2, R3)"
                            },
                            "text": {"type": "string"},
                            "image_url": {
                                "type": "string",
                                "description": "Optional image URL"
                            }
                        },
                        "required": ["id", "text"],
                    },
                },
                "mappings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "left_id": {"type": "string"},
                            "right_ids": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 1
                            },
                            "rationale": {"type": "string"}
                        },
                        "required": ["left_id", "right_ids", "rationale"],
                    },
                },
                "allow_many_to_one": {"type": "boolean"},
                "include_distractors": {"type": "boolean"},
                "rationale_global": {"type": "string"},
                "difficulty": {"type": "string"}
            },
            required=[
                "id",
                "prompt",
                "left_items",
                "right_items",
                "mappings",
                "allow_many_to_one",
                "include_distractors",
                "rationale_global",
                "difficulty"
            ],
        )

        # The response schema is now an array of the matching schema
        response_schema = types.Schema(type="array", items=matching_schema)

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
            data_list = json.loads(response.text)
            if not isinstance(data_list, list):
                logger.error("Gemini response is not a list for batch generation")
                return None
            
            matching_responses = []
            for data in data_list:
                if self._validate_gemini_response(data):
                    matching_responses.append(await self._convert_gemini_response_to_matching(data, request))
            return matching_responses

        except Exception as e:
            logger.error(f"Matching problem batch generation failed: {str(e)}")
            return None

    def _build_matching_system_prompt(self, request: MatchingGenerationRequest, count: int) -> str:
        """Build system prompt for matching problem batch generation using recommender context"""

        prompt = f"""You are an expert teacher creating a diverse set of high-quality concept matching activities for K-12 students.

CONTEXT INFORMATION:
- Subject: {request.subject}
- Unit: {request.unit_id}
- Skill: {request.skill_id} - {request.description}
- Subskill: {request.subskill_id}
- Concept Group: {request.concept_group}
- Learning Objective: {request.detailed_objective}
- Difficulty Level: {request.difficulty}
- Matching Style: {request.matching_style}

TASK:
Generate a JSON array containing exactly {count} unique matching problems based on the context above.

REQUIREMENTS FOR EACH MATCHING PROBLEM IN THE ARRAY:
1. Ensure each problem is distinct and tests a slightly different aspect of the skill.
2. Create a clear prompt explaining what students need to match (e.g., "Match each organelle to its primary function")
3. Provide 3-6 left items (things to match FROM) with IDs: L1, L2, L3, L4, L5, L6
4. Provide 3-8 right items (things to match TO) with IDs: R1, R2, R3, R4, R5, R6, R7, R8
5. Create correct mappings showing which left items match to which right items
6. Include rationale for each mapping explaining why they go together
7. Add a global rationale explaining the overall learning objective
8. Activity should be age-appropriate for K-12 students

MATCHING STYLE GUIDELINES:
- '{request.matching_style}': """

        if request.matching_style == "one_to_one":
            prompt += """Create exactly one correct match for each left item. No distractors.
            Set allow_many_to_one=false and include_distractors=false."""
        elif request.matching_style == "one_to_many":
            prompt += """Some left items may match to multiple right items, or multiple left items may match to the same right item.
            Set allow_many_to_one=true and include_distractors=false."""
        else:  # with_distractors
            prompt += """Include some right items that don't match any left items to make it more challenging.
            Set allow_many_to_one=true and include_distractors=true."""

        prompt += f"""

CONTENT FOCUS:
Create matching pairs that directly test understanding of {request.skill_id}. 
For {request.subject}, focus on connecting concepts, definitions, examples, causes and effects, or other logical relationships.
Make sure each match teaches something important about the topic.

CRITICAL ANTI-SEQUENCING REQUIREMENTS:
1. NEVER create items where L1 matches R1, L2 matches R2, etc. in sequence
2. RANDOMIZE the order so that correct matches are distributed across different positions
3. Ensure that knowing the position/order provides NO advantage to students
4. Mix up conceptual relationships - don't follow alphabetical, numerical, or chronological patterns
5. The correct mapping should require actual knowledge of the concepts, not pattern recognition

EXAMPLES OF WHAT TO AVOID:
- L1: "First step" → R1: "Beginning of process"
- L2: "Second step" → R2: "Middle of process"  
- L3: "Third step" → R3: "End of process"

EXAMPLES OF GOOD PRACTICE:
- L1: "Photosynthesis" → R3: "Converts sunlight to energy"
- L2: "Mitochondria" → R1: "Powerhouse of cell"
- L3: "Ribosomes" → R2: "Protein synthesis"

Generate a unique matching activity that tests the specified learning objective directly."""

        return prompt

    def _validate_gemini_response(self, data: Dict[str, Any]) -> bool:
        """Validate Gemini structured response"""

        required_fields = ['id', 'prompt', 'left_items', 'right_items', 'mappings', 
                          'allow_many_to_one', 'include_distractors', 'rationale_global', 'difficulty']

        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field: {field}")
                return False

        left_items = data.get('left_items', [])
        right_items = data.get('right_items', [])
        mappings = data.get('mappings', [])

        if not isinstance(left_items, list) or len(left_items) < 3:
            logger.error(f"Invalid left_items format: {len(left_items)} items")
            return False

        if not isinstance(right_items, list) or len(right_items) < 3:
            logger.error(f"Invalid right_items format: {len(right_items)} items")
            return False

        if not isinstance(mappings, list) or len(mappings) == 0:
            logger.error(f"Invalid mappings format: {len(mappings)} mappings")
            return False

        # Validate mapping references
        left_ids = {item.get('id') for item in left_items}
        right_ids = {item.get('id') for item in right_items}
        
        for mapping in mappings:
            left_id = mapping.get('left_id')
            right_ids_list = mapping.get('right_ids', [])
            
            if left_id not in left_ids:
                logger.error(f"Mapping references unknown left_id '{left_id}'")
                return False
                
            for right_id in right_ids_list:
                if right_id not in right_ids:
                    logger.error(f"Mapping references unknown right_id '{right_id}'")
                    return False

        return True

    async def _convert_gemini_response_to_matching(self,
                                                 data: Dict[str, Any],
                                                 request: MatchingGenerationRequest) -> MatchingResponse:
        """Convert Gemini response to MatchingResponse model"""

        # Generate deterministic ID
        content_hash = hashlib.md5(
            f"{request.subject}_{request.skill_id}_{request.subskill_id}_{data['prompt']}".encode()
        ).hexdigest()

        # Convert left items to AssocItem models
        left_items = []
        for item in data['left_items']:
            left_items.append(AssocItem(
                id=item['id'],
                text=item['text'],
                image_url=item.get('image_url'),
                metadata={}
            ))

        # Convert right items to AssocItem models
        right_items = []
        for item in data['right_items']:
            right_items.append(AssocItem(
                id=item['id'],
                text=item['text'],
                image_url=item.get('image_url'),
                metadata={}
            ))

        # Convert mappings to LeftToRightMapping models
        mappings = []
        for mapping in data['mappings']:
            mappings.append(LeftToRightMapping(
                left_id=mapping['left_id'],
                right_ids=mapping['right_ids'],
                rationale=mapping.get('rationale', '')
            ))

        # Create response
        matching_response = MatchingResponse(
            id=content_hash[:16],  # Use first 16 chars of hash
            subject=request.subject,
            unit_id=request.unit_id,
            skill_id=request.skill_id,
            subskill_id=request.subskill_id,
            difficulty=request.difficulty,
            prompt=data['prompt'],
            left_items=left_items,
            right_items=right_items,
            mappings=mappings,
            allow_many_to_one=data['allow_many_to_one'],
            include_distractors=data['include_distractors'],
            shuffle_left=True,
            shuffle_right=True,
            rationale_global=data['rationale_global'],
            metadata={
                "concept_group": request.concept_group,
                "detailed_objective": request.detailed_objective,
                "description": request.description,
                "matching_style": request.matching_style,
                "generated_at": datetime.utcnow().isoformat()
            }
        )

        logger.info(f"Successfully created matching problem with ID: {matching_response.id}")
        return matching_response

    async def get_matching_from_recommender(self,
                                          student_id: int,
                                          subject: str,
                                          count: int,
                                          unit_id: Optional[str] = None,
                                          skill_id: Optional[str] = None,
                                          subskill_id: Optional[str] = None,
                                          difficulty: str = "medium",
                                          matching_style: str = "one_to_one") -> Optional[List[MatchingResponse]]:
        """
        Get a batch of matching problems using recommender to determine optimal subject/unit/skill/subskill
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

            # Create matching generation request with recommender context
            generation_request = MatchingGenerationRequest(
                subject=subject,
                unit_id=recommendation['unit']['id'],
                skill_id=recommendation['skill']['id'],
                subskill_id=recommendation['subskill']['id'],
                difficulty=difficulty,
                matching_style=matching_style,
                description=recommendation['skill']['description'],
                concept_group=objectives.get('ConceptGroup', 'General'),
                detailed_objective=objectives.get('DetailedObjective', 'Basic understanding')
            )

            # Generate the batch of matching problems
            return await self.generate_matching(student_id, generation_request, count)

        except Exception as e:
            logger.error(f"Error getting matching problem from recommender: {str(e)}")
            return None

    async def evaluate_submission(self, submission: MatchingSubmission) -> MatchingReview:
        """
        Basic fallback evaluation for matching submissions.
        NOTE: The endpoint will primarily use the LLM review service for richer feedback.
        This method serves as a fallback if LLM evaluation fails.
        """
        try:
            matching = submission.matching
            student_matches = {match.left_id: match.right_id for match in submission.student_matches}
            
            # Create correct answer mapping for easy lookup
            correct_mappings = {}
            for mapping in matching.mappings:
                correct_mappings[mapping.left_id] = mapping.right_ids

            # Evaluate each student match
            evaluations = []
            correct_count = 0
            
            for left_id, right_id in student_matches.items():
                expected_right_ids = correct_mappings.get(left_id, [])
                is_correct = right_id in expected_right_ids
                
                if is_correct:
                    correct_count += 1

                evaluations.append(MatchingEvaluation(
                    left_id=left_id,
                    right_id=right_id,
                    is_correct=is_correct,
                    expected_right_ids=expected_right_ids,
                    feedback="Basic evaluation - LLM review preferred"
                ))

            # Calculate overall score and percentage
            total_matches = len(student_matches)
            percentage_correct = (correct_count / total_matches * 100) if total_matches > 0 else 0
            overall_correct = correct_count == total_matches
            total_score = (correct_count / total_matches * 10) if total_matches > 0 else 0

            return MatchingReview(
                overall_correct=overall_correct,
                total_score=total_score,
                match_evaluations=evaluations,
                explanation=f"Basic evaluation: {correct_count}/{total_matches} matches correct",
                percentage_correct=percentage_correct,
                metadata={
                    "submitted_at": submission.submitted_at.isoformat(),
                    "total_matches": total_matches,
                    "correct_matches": correct_count,
                    "evaluation_method": "basic_fallback"
                }
            )

        except Exception as e:
            logger.error(f"Error evaluating matching submission: {str(e)}")
            return MatchingReview(
                overall_correct=False,
                total_score=0.0,
                match_evaluations=[],
                explanation=f"Error evaluating your matches: {str(e)}",
                percentage_correct=0.0,
                metadata={"error": str(e)}
            )