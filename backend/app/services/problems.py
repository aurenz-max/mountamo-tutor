from typing import Dict, Any, List, Optional
from datetime import datetime
from .base_ai_service import BaseAIService
from .ai_service_factory import AIServiceFactory
import logging
import json
import random
from google import genai
from google.genai.types import GenerateContentConfig
from ..generators.content_schemas import PRACTICE_PROBLEMS_SCHEMA
from ..generators.content import ContentGenerationRequest
from ..core.config import settings

logger = logging.getLogger(__name__)


class ProblemService:
    def __init__(self):
        # Dependencies will be injected - don't initialize here
        self.ai_service = None  # Will be set by dependency injection
        self.competency_service = None  # Will be set by dependency injection
        self.recommender = None  # Will be set by dependency injection
        self.cosmos_db = None  # Will be set by dependency injection
        self.problem_optimizer = None  # Will be set by dependency injection
        self.master_context_generator = None  # Will be set by dependency injection
        self.context_primitives_generator = None  # Will be set by dependency injection
        self._problem_history = {}  # In-memory storage for now
        self._current_ai_service_type = "gemini"  # Default to Gemini for JSON schema support

        # Initialize Gemini client like the generators do
        self.client = None
        self._initialize_gemini()
    
    def _initialize_gemini(self):
        """Initialize Gemini client with configuration"""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required. Please check your configuration.")
        
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info(f"Gemini client initialized for {self.__class__.__name__}")

    def set_ai_service(self, service_type: str) -> None:
        """
        Set the AI service to use for generating problems
        
        Args:
            service_type: 'anthropic', 'claude', or 'gemini'
        """
        self._current_ai_service_type = service_type
        # Update the current service instance
        self.ai_service = AIServiceFactory.get_service(service_type)
        print(f"[INFO] Set AI service to: {service_type}")

    def get_current_ai_service(self) -> BaseAIService:
        """
        Get the current AI service based on the set service type
        
        Returns:
            The current AI service instance implementing BaseAIService
        """
        if not self.ai_service:
            self.ai_service = AIServiceFactory.get_service(self._current_ai_service_type)
        return self.ai_service

    async def generate_problem(
        self,
        subject: str,
        recommendations: List[Dict[str, Any]],
        count: int = 5,
        context_primitives: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Universal problem generation method using Gemini with JSON schema and context primitives.

        Args:
            subject: The subject area
            recommendations: List of recommendation objects
            count: Number of problems to generate
            context_primitives: Optional context primitives for problem variety

        Returns:
            JSON string with problems array
        """
        try:
            print(f"[DEBUG] Generating {count} problems for {subject}")
            
            # Handle single recommendation for backward compatibility
            if isinstance(recommendations, dict):
                recommendations = [recommendations]
            
            # Ensure we have enough recommendations
            if len(recommendations) < count:
                # Duplicate the last recommendation if needed
                while len(recommendations) < count:
                    recommendations.append(recommendations[-1])
            
            # Build enhanced prompt with context primitives for variety
            context_section = ""
            if context_primitives:
                # Randomly sample from primitives for variety in each generation
                all_objects = context_primitives.get('concrete_objects', [])
                all_characters = context_primitives.get('characters', [])
                all_scenarios = context_primitives.get('scenarios', [])
                all_locations = context_primitives.get('locations', [])

                # Random sample to ensure different combinations each time
                sampled_objects = random.sample(all_objects, min(10, len(all_objects)))
                sampled_characters = random.sample(all_characters, min(5, len(all_characters)))
                sampled_scenarios = random.sample(all_scenarios, min(8, len(all_scenarios)))
                sampled_locations = random.sample(all_locations, min(6, len(all_locations)))

                # Log the selected primitives for debugging
                logger.info(f"[CONTEXT_PRIMITIVES] Selected objects: {sampled_objects}")
                logger.info(f"[CONTEXT_PRIMITIVES] Selected characters: {[c.get('name', 'Unknown') for c in sampled_characters]}")
                logger.info(f"[CONTEXT_PRIMITIVES] Selected scenarios: {sampled_scenarios}")
                logger.info(f"[CONTEXT_PRIMITIVES] Selected locations: {sampled_locations}")

                # Format for prompt
                objects_sample = ', '.join(sampled_objects)
                characters_sample = [f"{c.get('name', 'Unknown')} ({c.get('age', 'child')})"
                                   for c in sampled_characters]
                scenarios_sample = ', '.join(sampled_scenarios)
                locations_sample = ', '.join(sampled_locations)

                context_section = f"""

CONTEXT PRIMITIVES FOR VARIETY (Use these to create diverse problems):
✓ Objects: {objects_sample}
✓ Characters: {', '.join(characters_sample)}
✓ Scenarios: {scenarios_sample}
✓ Locations: {locations_sample}

VARIETY INSTRUCTIONS:
- For each problem, select DIFFERENT combinations from the context primitives above
- Never reuse the same object-character-scenario combination
- Distribute problems across different locations and contexts
- Ensure each problem feels unique and engaging
"""
            else:
                logger.info("[CONTEXT_PRIMITIVES] No context primitives provided - using default generation")

            # Build the prompt for multiple problems using the new rich schema
            prompt = f"""Generate {count} different age-appropriate {subject} problems for kindergarten students using a variety of problem types.

{context_section}

Your response must use the rich problem schema with separate arrays for each problem type:

### PRACTICE PROBLEM PRIMITIVES (Choose the best types for your material):
- **multiple_choice**: 4-6 option questions - excellent for testing comprehension
- **true_false**: Statement evaluation with rationale - perfect for testing understanding 
- **fill_in_blanks**: Interactive sentences with missing key terms - ideal for vocabulary
- **matching_activity**: Connect related items - great for building relationships
- **sequencing_activity**: Arrange items in correct order - perfect for processes
- **categorization_activity**: Sort items into groups - excellent for classification
- **scenario_question**: Real-world application problems - ideal for connecting theory to practice
- **short_answer**: Open-ended questions requiring brief explanations

Generate problems as separate arrays by type (e.g., "multiple_choice": [...], "true_false": [...]).
Distribute {count} problems across 2-3 different problem types for variety.

Here are the specific learning objectives for each problem:

"""
            # Add each recommendation to the prompt
            for i, rec in enumerate(recommendations[:count]):
                prompt += f"""
PROBLEM #{i+1}:
Subject: {subject}
Unit: {rec.get('unit', {}).get('title', '')}
Skill: {rec.get('skill', {}).get('description', '')}
Subskill: {rec.get('subskill', {}).get('description', '')}
Concept Group: {rec.get('detailed_objectives', {}).get('ConceptGroup', 'General')}
Specific Learning Objective: {rec.get('detailed_objectives', {}).get('DetailedObjective', 'Basic understanding')}
Difficulty Level: {rec.get('difficulty', 5.0)} (1-10 scale)

"""

            # Add generation instructions
            prompt += f"""
Each problem should:
1. Be appropriate for kindergarten students (ages 5-6)
2. Use simple, clear language and familiar contexts
3. Include all required fields for the chosen problem type
4. Have educational value beyond just assessment
5. Provide comprehensive rationale and teaching notes
6. Include encouraging, positive success criteria

For multiple choice: Provide 3-4 options with one clearly correct answer
For true/false: Make statements that test key concepts, not trick questions
For fill-in-blanks: Use context that helps students understand the missing word
For matching: Connect terms to definitions or examples to concepts
For sequencing: Use logical or chronological order that makes sense
For categorization: Use clear categories that students can understand
For scenarios: Use familiar, age-appropriate situations
For short answer: Ask questions that allow for brief, simple responses

IMPORTANT: 
- Generate exactly {count} problems total across multiple problem types
- Each problem must have a unique id (e.g., "mc_001", "tf_001", "fib_001")
- Include grade_level as "Kindergarten" for all problems
- Set difficulty as "easy" or "medium" for kindergarten level
"""

            print(f"[DEBUG] Using rich schema with {count} problems across multiple types")
            logger.info(f"[PROBLEMS_SERVICE] Generating {count} problems using rich schema for subject: {subject}")
            
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash-preview-05-20',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=PRACTICE_PROBLEMS_SCHEMA,
                    temperature=0.5,
                    max_output_tokens=15000
                )
            )
            
            print(f"[DEBUG] Generated {count} problems successfully")
            return response.text
            
        except Exception as e:
            print(f"[ERROR] Error generating problems: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    async def get_problems(
        self,
        student_id: int,
        subject: str,
        count: int = 5,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        unit_id: Optional[str] = None,
        recommendations: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Universal method to get 1 or more problems.
        
        Args:
            student_id: The student ID
            subject: The subject area
            count: Number of problems to return (default 1)
            skill_id: Optional specific skill filter
            subskill_id: Optional specific subskill filter
            unit_id: Optional specific unit filter
            recommendations: Optional pre-computed recommendations
            
        Returns:
            List of problem objects (empty list if none found)
        """
        try:
            print(f"[DEBUG] Getting {count} problems for student {student_id}, subject {subject}")
            
            # Ensure dependencies are available
            if not self.recommender or not self.competency_service:
                print("[ERROR] Required services not initialized")
                return []
            
            final_problems = []
            formatted_recs = []
            
            # If specific recommendations provided, use those
            if recommendations:
                print(f"[DEBUG] Using provided recommendations: {len(recommendations)}")
                for rec in recommendations:
                    subskill_id_rec = rec.get("subskill_id")
                    objectives = await self.competency_service.get_detailed_objectives(
                        subject=subject,
                        subskill_id=subskill_id_rec
                    )
                    
                    formatted_recs.append({
                        "unit": {"id": rec.get("unit_id"), "title": rec.get("unit_title")},
                        "skill": {"id": rec.get("skill_id"), "description": rec.get("skill_description")},
                        "subskill": {"id": subskill_id_rec, "description": rec.get("subskill_description")},
                        "difficulty": 5.0,
                        "detailed_objectives": objectives
                    })
            
            # Otherwise, generate recommendations based on context
            else:
                for i in range(count):
                    # Build context for recommendation
                    context = {
                        'unit': unit_id,
                        'skill': skill_id,
                        'subskill': subskill_id
                    }
                    
                    # Get recommendation
                    recommendation = await self.recommender.get_recommendation(
                        student_id=student_id,
                        subject=subject,
                        unit_filter=context.get('unit'),
                        skill_filter=context.get('skill'),
                        subskill_filter=context.get('subskill')
                    )
                    
                    if not recommendation:
                        print(f"[ERROR] No recommendation for problem {i+1}")
                        continue
                    
                    # Check cache first, but only use if it has rich schema structure
                    cached_problems = []
                    if self.cosmos_db:
                        cached_problems = await self.cosmos_db.get_cached_problems(
                            subject=subject,
                            skill_id=recommendation['skill']['id'],
                            subskill_id=recommendation['subskill']['id']
                        )
                    
                    if cached_problems:
                        # Check if cached problem has rich schema structure (not old text problems)
                        import random
                        selected = random.choice(cached_problems)
                        problem_data = selected.get("problem_data", selected)
                        
                        # Only use cache if it has rich schema fields (options, rationale, etc.)
                        if (problem_data.get('options') or problem_data.get('statement') or 
                            problem_data.get('blanks') or problem_data.get('items')):
                            print(f"[DEBUG] Using cached rich schema problem for {recommendation['subskill']['id']}")
                            final_problems.append(problem_data)
                            continue
                        else:
                            print(f"[DEBUG] Skipping old cached problem without rich schema for {recommendation['subskill']['id']}")
                            # Don't use old cached problems - regenerate with rich schema
                    
                    # Get detailed objectives for this recommendation
                    objectives = await self.competency_service.get_detailed_objectives(
                        subject=subject,
                        subskill_id=recommendation['subskill']['id']
                    )
                    
                    formatted_recs.append({
                        **recommendation,
                        'detailed_objectives': objectives
                    })
            
            # Generate problems if we have recommendations that need new problems
            if formatted_recs:
                # Get context primitives for variety (using first recommendation)
                context_primitives = None
                if formatted_recs:
                    context_primitives = await self.get_or_generate_context_primitives(subject, formatted_recs[0])
                    if context_primitives:
                        objects_count = len(context_primitives.get('concrete_objects', []))
                        scenarios_count = len(context_primitives.get('scenarios', []))
                        logger.info(f"🚀 [DYNAMIC_VARIETY] Using context primitives for problem generation: {objects_count} objects, {scenarios_count} scenarios")
                    else:
                        logger.info(f"⚠️ [FALLBACK] No context primitives available - using default generation")

                raw_response = await self.generate_problem(subject, formatted_recs, len(formatted_recs), context_primitives)
                if raw_response:
                    try:
                        response_data = json.loads(raw_response)
                        logger.info(f"[PROBLEMS_SERVICE] Generated problems with types: {list(response_data.keys())}")
                        
                        # Use Gemini's structured response directly - just add our metadata
                        problem_types = ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity", 
                                       "sequencing_activity", "categorization_activity", "scenario_question", "short_answer"]
                        
                        problem_counter = 0
                        for problem_type in problem_types:
                            if problem_type in response_data and response_data[problem_type]:
                                logger.info(f"[PROBLEMS_SERVICE] Processing {len(response_data[problem_type])} {problem_type} problems")
                                
                                for gemini_problem in response_data[problem_type]:
                                    if problem_counter < len(formatted_recs):
                                        # Take Gemini's structured problem and just add our metadata
                                        enriched_problem = {
                                            **gemini_problem,  # Keep all of Gemini's rich structure
                                            'problem_type': problem_type,
                                            'student_id': student_id,
                                            # Don't set user_id here - let endpoint handle it
                                            'generated_at': datetime.now().isoformat(),
                                            'composable_template': None,
                                            'metadata': {
                                                'subject': subject,
                                                'unit': formatted_recs[problem_counter].get('unit'),
                                                'skill': formatted_recs[problem_counter].get('skill'),
                                                'subskill': formatted_recs[problem_counter].get('subskill'),
                                                'difficulty': formatted_recs[problem_counter].get('difficulty'),
                                                'objectives': formatted_recs[problem_counter].get('detailed_objectives')
                                            }
                                        }
                                        
                                        # Cache the problem
                                        if self.cosmos_db and formatted_recs[problem_counter].get('skill'):
                                            await self.cosmos_db.save_cached_problem(
                                                subject=subject,
                                                skill_id=formatted_recs[problem_counter]['skill']['id'],
                                                subskill_id=formatted_recs[problem_counter]['subskill']['id'],
                                                problem_data=enriched_problem
                                            )
                                        
                                        final_problems.append(enriched_problem)
                                        problem_counter += 1
                        
                        logger.info(f"[PROBLEMS_SERVICE] Successfully processed {len(final_problems)} problems")
                        
                    except json.JSONDecodeError as e:
                        print(f"[ERROR] Failed to parse response: {e}")
                        logger.error(f"[PROBLEMS_SERVICE] JSON parsing failed: {e}")
                        logger.error(f"[PROBLEMS_SERVICE] Response text: {raw_response[:500]}...")
            
            print(f"[DEBUG] Returning {len(final_problems)} problems")
            return final_problems[:count]  # Ensure we don't return more than requested
                
        except Exception as e:
            print(f"[ERROR] Error in get_problems: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    async def get_or_generate_context_primitives(self, subject: str, recommendation: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get cached context primitives or generate new ones for a subskill.

        Args:
            subject: The subject area
            recommendation: Recommendation dict with unit, skill, subskill info

        Returns:
            Dict containing context primitives or None if generation fails
        """
        try:
            subskill_id = recommendation.get('subskill', {}).get('id')
            if not subskill_id:
                logger.error("No subskill ID found in recommendation")
                return None

            # Try to get cached primitives first
            if self.cosmos_db:
                cached_primitives = await self.cosmos_db.get_cached_context_primitives(
                    subject=subject,
                    subskill_id=subskill_id
                )
                if cached_primitives:
                    logger.info(f"Using cached context primitives for {subject}:{subskill_id}")
                    return cached_primitives

            # Cache miss - generate new primitives
            logger.info(f"🔄 Cache miss - generating new context primitives for {subject}:{subskill_id}")

            if not self.master_context_generator or not self.context_primitives_generator:
                logger.error("❌ Context generators not initialized - Dynamic Problem Variety Engine disabled")
                logger.error(f"   master_context_generator: {self.master_context_generator is not None}")
                logger.error(f"   context_primitives_generator: {self.context_primitives_generator is not None}")
                return None

            # Create ContentGenerationRequest from recommendation
            unit = recommendation.get('unit', {})
            skill = recommendation.get('skill', {})
            subskill = recommendation.get('subskill', {})

            request = ContentGenerationRequest(
                subject=subject,
                grade=recommendation.get('grade_level', 'Kindergarten'),  # Default to Kindergarten
                unit=unit.get('title', ''),
                skill=skill.get('description', ''),
                subskill=subskill.get('description', ''),
                unit_id=unit.get('id'),
                skill_id=skill.get('id'),
                subskill_id=subskill_id,
                difficulty_level="beginner",  # Most problems are for young learners
                prerequisites=[]
            )

            # Generate master context first
            logger.info(f"🧠 Generating master context for {subskill.get('description', 'unknown subskill')}")
            master_context = await self.master_context_generator.generate_master_context(request)
            logger.info(f"✅ Master context generated with {len(master_context.core_concepts)} core concepts")

            # Generate context primitives using master context
            logger.info(f"🎯 Generating context primitives using master context")
            primitives_data = await self.context_primitives_generator.generate_context_primitives(
                request, master_context
            )

            if primitives_data:
                objects_count = len(primitives_data.get('concrete_objects', []))
                scenarios_count = len(primitives_data.get('scenarios', []))
                characters_count = len(primitives_data.get('characters', []))
                logger.info(f"🎉 Context primitives generated successfully: {objects_count} objects, {scenarios_count} scenarios, {characters_count} characters")
            else:
                logger.error(f"❌ Failed to generate context primitives")
                return None

            # Cache the newly generated primitives
            if self.cosmos_db and primitives_data:
                try:
                    await self.cosmos_db.save_cached_context_primitives(
                        subject=subject,
                        grade_level=request.grade or "Kindergarten",
                        unit_id=unit.get('id', ''),
                        skill_id=skill.get('id', ''),
                        subskill_id=subskill_id,
                        primitives_data=primitives_data
                    )
                    logger.info(f"Successfully cached new context primitives for {subject}:{subskill_id}")
                except Exception as cache_error:
                    logger.error(f"Failed to cache context primitives: {cache_error}")
                    # Don't fail the request if caching fails - just log it

            return primitives_data

        except Exception as e:
            logger.error(f"Error in get_or_generate_context_primitives: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    # Legacy method for backwards compatibility
    async def get_problem(self, student_id: int, subject: str, context: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """Legacy single problem method - calls get_problems with count=1"""
        problems = await self.get_problems(
            student_id=student_id,
            subject=subject,
            count=1,
            skill_id=context.get('skill') if context else None,
            subskill_id=context.get('subskill') if context else None,
            unit_id=context.get('unit') if context else None
        )
        return problems[0] if problems else None

    async def generate_and_parse_problem(
        self,
        subject: str,
        recommendation: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a problem using AI model and parse it into a structured format.
        This is the recommended public method for composable problem generation services.
        
        Returns:
            Dict containing parsed problem data or None if generation/parsing fails
        """
        try:
            # Generate the raw problem
            raw_problem = await self.generate_problem(subject, [recommendation], 1)
            if not raw_problem:
                return None
            
            # Parse the JSON response using new rich schema format
            try:
                schema_data = json.loads(raw_problem)
                logger.info(f"[PROBLEMS_SERVICE] generate_and_parse_problem response types: {list(schema_data.keys())}")
                
                # Find the first problem from any type
                problem_types = ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity", 
                               "sequencing_activity", "categorization_activity", "scenario_question", "short_answer"]
                
                for problem_type in problem_types:
                    if problem_type in schema_data and schema_data[problem_type]:
                        # Return the first problem of this type
                        gemini_problem = schema_data[problem_type][0]
                        # Add the problem type to the response
                        gemini_problem['problem_type'] = problem_type
                        return gemini_problem
                
                logger.error("No problems found in any problem type arrays")
                return None
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini JSON response: {e}")
                return None
            
        except Exception as e:
            logger.error(f"Error in generate_and_parse_problem: {e}")
            return None