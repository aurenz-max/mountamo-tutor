from typing import Dict, Any, List, Optional
from datetime import datetime
from .base_ai_service import BaseAIService
from .ai_service_factory import AIServiceFactory
import logging # Use logging consistently if you have it set up
import json

logger = logging.getLogger(__name__) # Or use print if logging isn't fully configured


class ProblemService:
    def __init__(self):
        # Dependencies will be injected - don't initialize here
        self.ai_service = None  # Will be set by dependency injection
        self.competency_service = None  # Will be set by dependency injection
        self.recommender = None  # Will be set by dependency injection
        self.cosmos_db = None  # Will be set by dependency injection
        self.problem_optimizer = None  # Will be set by dependency injection
        self._problem_history = {}  # In-memory storage for now
        self._current_ai_service_type = "anthropic"  # Default AI service type

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

    async def get_problem(
        self,
        student_id: int,
        subject: str,
        context: Optional[Dict] = None
    ) -> Optional[Dict[str, Any]]:
        """Get problem with context awareness and detailed learning objectives"""
        try:
            print(f"[DEBUG] Getting problem with context: {context}")
            
            # Get the current AI service
            ai_service = self.get_current_ai_service()
            
            # Ensure recommender is available
            if not self.recommender:
                print("[ERROR] ProblemRecommender not initialized")
                return None
                
            # Ensure competency_service is available
            if not self.competency_service:
                print("[ERROR] CompetencyService not initialized")
                return None
            
            # Get recommendation
            recommendation = await self.recommender.get_recommendation(
                student_id=student_id,
                subject=subject,
                unit_filter=context.get('unit'),
                skill_filter=context.get('skill'),
                subskill_filter=context.get('subskill')
            )
            
            print(f"[DEBUG] Got recommendation: {recommendation}")
            
            if not recommendation:
                print("[ERROR] No recommendation generated")
                return None
                
            # Extract skill and subskill IDs for cache lookup
            skill_id = recommendation['skill']['id']
            subskill_id = recommendation['subskill']['id']
            
            # STEP 1: Check if we have a cached problem for this skill/subskill
            cached_problems = []
            if self.cosmos_db:
                print(f"[DEBUG] Looking for cached problems in cosmos_db")
                cached_problems = await self.cosmos_db.get_cached_problems(
                    subject=subject,
                    skill_id=skill_id,
                    subskill_id=subskill_id
                )
                print(f"[DEBUG] Found {len(cached_problems)} cached problems")
                
                # If we have cached problems, select one
                if cached_problems:
                    # Use problem optimizer if available to select the best one
                    if hasattr(self, 'problem_optimizer') and self.problem_optimizer:
                        print(f"[DEBUG] Using problem optimizer to select from {len(cached_problems)} cached problems")
                        
                        # Extract unit_id from recommendation
                        unit_id = recommendation['unit']['id']
                        
                        # Verify problems structure before passing to optimizer
                        processed_problems = []
                        for problem in cached_problems:
                            if "problem_data" in problem and isinstance(problem["problem_data"], dict):
                                processed_problems.append(problem["problem_data"])
                            else:
                                processed_problems.append(problem)
                        
                        # Pass processed problems to optimizer
                        optimal_problems = await self.problem_optimizer.select_optimal_problems(
                            student_id=student_id,
                            subject=subject,
                            skill_id=skill_id,
                            subskill_id=subskill_id,
                            unit_id=unit_id,
                            available_problems=processed_problems,
                            count=1  # We just need one problem
                        )
                        
                        if optimal_problems and len(optimal_problems) > 0:
                            print(f"[DEBUG] Selected an optimal problem from cache")
                            return optimal_problems[0]
                    else:
                        # No optimizer available, just pick a random one
                        import random
                        selected_problem = random.choice(cached_problems)
                        
                        # Extract problem_data if in nested format
                        if "problem_data" in selected_problem and isinstance(selected_problem["problem_data"], dict):
                            return selected_problem["problem_data"]
                        else:
                            return selected_problem

            # If we reach here, we need to generate a new problem
            
            # Get detailed objectives for the recommended subskill - now passing subject
            objectives = await self.competency_service.get_detailed_objectives(
                subject=subject,
                subskill_id=recommendation['subskill']['id']
            )
            
            print(f"[DEBUG] Got objectives: {objectives}")

            # Generate the problem
            raw_problem = await self.generate_problem(
                subject=subject,
                recommendation={
                    **recommendation,
                    'detailed_objectives': objectives
                }
            )
            
            if not raw_problem:
                print("[ERROR] Failed to generate raw problem")
                return None
                
            # Parse the problem
            problem_data = await self._parse_problem(raw_problem)
            if not problem_data:
                print("[ERROR] Failed to parse problem")
                return None
            
            # Add metadata about what was actually selected
            problem_data['metadata'] = {
                'unit': recommendation['unit'],
                'skill': recommendation['skill'],
                'subskill': recommendation['subskill'],
                'difficulty': recommendation['difficulty'],
                'objectives': objectives,  # Include the selected objectives in metadata
                'subject': subject  # Add subject to metadata for easier searching
            }
            
            # STEP 3: Cache the new problem if cosmos_db is available
            if self.cosmos_db:
                await self.cosmos_db.save_cached_problem(
                    subject=subject,
                    skill_id=skill_id,
                    subskill_id=subskill_id,
                    problem_data=problem_data
                )
                print(f"[DEBUG] Saved new problem to cache for {subject}/{skill_id}/{subskill_id}")
            
            print(f"[DEBUG] Final problem data: {problem_data}")
            return problem_data
                
        except Exception as e:
            print(f"[ERROR] Error in get_problem: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Try with a different AI service as fallback
            try:
                # Determine the alternate service type to try
                alternate_service_type = "gemini" if self._current_ai_service_type in ["anthropic", "claude"] else "anthropic"
                print(f"[INFO] Attempting fallback to {alternate_service_type} service")
                
                # Cache the original service type
                original_service_type = self._current_ai_service_type
                
                # Try with the alternate service
                self.set_ai_service(alternate_service_type)
                
                # Attempt the operation again
                result = await self.get_problem(student_id, subject, context)
                
                # If we get here, the fallback worked - restore the original preference
                self.set_ai_service(original_service_type)
                
                return result
            except Exception as fallback_error:
                print(f"[ERROR] Fallback also failed: {str(fallback_error)}")
                return None

    async def get_problem_with_session_data(
        self,
        student_id: int,
        subject: str,
        session_recommendation: Dict[str, Any],
        session_objectives: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Optimized get_problem that uses pre-loaded session data"""
        try:
            print(f"[DEBUG] Using pre-loaded session data for problem generation")
            
            # Extract skill and subskill IDs for cache lookup
            skill_id = session_recommendation['skill']['id']
            subskill_id = session_recommendation['subskill']['id']
            
            # STEP 1: Check if we have a cached problem for this skill/subskill
            cached_problems = []
            if self.cosmos_db:
                print(f"[DEBUG] Looking for cached problems in cosmos_db")
                cached_problems = await self.cosmos_db.get_cached_problems(
                    subject=subject,
                    skill_id=skill_id,
                    subskill_id=subskill_id
                )
                print(f"[DEBUG] Found {len(cached_problems)} cached problems")
                
                # If we have cached problems, select one
                if cached_problems:
                    # Use problem optimizer if available to select the best one
                    if hasattr(self, 'problem_optimizer') and self.problem_optimizer:
                        print(f"[DEBUG] Using problem optimizer to select from {len(cached_problems)} cached problems")
                        
                        # Extract unit_id from recommendation
                        unit_id = session_recommendation['unit']['id']
                        
                        # Verify problems structure before passing to optimizer
                        processed_problems = []
                        for problem in cached_problems:
                            if "problem_data" in problem and isinstance(problem["problem_data"], dict):
                                processed_problems.append(problem["problem_data"])
                            else:
                                processed_problems.append(problem)
                        
                        # Pass processed problems to optimizer
                        optimal_problems = await self.problem_optimizer.select_optimal_problems(
                            student_id=student_id,
                            subject=subject,
                            skill_id=skill_id,
                            subskill_id=subskill_id,
                            unit_id=unit_id,
                            available_problems=processed_problems,
                            count=1  # We just need one problem
                        )
                        
                        if optimal_problems and len(optimal_problems) > 0:
                            print(f"[DEBUG] Selected an optimal problem from cache")
                            return optimal_problems[0]
                    else:
                        # No optimizer available, just pick a random one
                        import random
                        selected_problem = random.choice(cached_problems)
                        
                        # Extract problem_data if in nested format
                        if "problem_data" in selected_problem and isinstance(selected_problem["problem_data"], dict):
                            return selected_problem["problem_data"]
                        else:
                            return selected_problem
            
            # If we reach here, we need to generate a new problem using pre-loaded data
            raw_problem = await self.generate_problem(
                subject=subject,
                recommendation={
                    **session_recommendation,
                    'detailed_objectives': session_objectives
                }
            )
            
            if not raw_problem:
                print("[ERROR] Failed to generate raw problem")
                return None
            
            problem_data = await self._parse_problem(raw_problem)
            if not problem_data:
                print("[ERROR] Failed to parse problem")
                return None
            
            # Add metadata using pre-loaded data
            problem_data['metadata'] = {
                'unit': session_recommendation['unit'],
                'skill': session_recommendation['skill'],
                'subskill': session_recommendation['subskill'],
                'difficulty': session_recommendation['difficulty'],
                'objectives': session_objectives,
                'subject': subject  # Add subject to metadata for easier searching
            }
            
            # STEP 3: Cache the new problem if cosmos_db is available
            if self.cosmos_db:
                await self.cosmos_db.save_cached_problem(
                    subject=subject,
                    skill_id=skill_id,
                    subskill_id=subskill_id,
                    problem_data=problem_data
                )
                print(f"[DEBUG] Saved new problem to cache for {subject}/{skill_id}/{subskill_id}")
            
            print(f"[DEBUG] Final problem data: {problem_data}")
            return problem_data
                
        except Exception as e:
            print(f"[ERROR] Error in get_problem_with_session_data: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Try with a different AI service as fallback
            try:
                # Determine the alternate service type to try
                alternate_service_type = "gemini" if self._current_ai_service_type in ["anthropic", "claude"] else "anthropic"
                print(f"[INFO] Attempting fallback to {alternate_service_type} service")
                
                # Cache the original service type
                original_service_type = self._current_ai_service_type
                
                # Try with the alternate service
                self.set_ai_service(alternate_service_type)
                
                # Attempt the operation again
                result = await self.get_problem_with_session_data(
                    student_id, 
                    subject, 
                    session_recommendation, 
                    session_objectives
                )
                
                # If we get here, the fallback worked - restore the original preference
                self.set_ai_service(original_service_type)
                
                return result
            except Exception as fallback_error:
                print(f"[ERROR] Fallback also failed: {str(fallback_error)}")
                return None

    async def generate_problem(
            self,
            subject: str,
            recommendation: Dict[str, Any]
        ) -> Optional[str]:
            """Generate problem text using AI model"""
            try:
                # Get the current AI service
                ai_service = self.get_current_ai_service()
                
                print(f"[DEBUG] Generating problem with recommendation: {recommendation}")
                
                # Build the enhanced prompt
                prompt = f"""Generate an age-appropriate {subject} problem for a kindergarten student (typically 5-6 years old).

    Learning Context:
    Subject: {subject}
    Unit: {recommendation.get('unit', {}).get('title', '')}
    Skill: {recommendation.get('skill', {}).get('description', '')}
    Subskill: {recommendation.get('subskill', {}).get('description', '')}
    Concept Group: {recommendation.get('detailed_objectives', {}).get('ConceptGroup', 'General')}
    Specific Learning Objective: {recommendation.get('detailed_objectives', {}).get('DetailedObjective', 'Basic understanding')}
    Difficulty Level: {recommendation.get('difficulty', 5.0)} (1-10 scale)

    Consider these problem types:
    1. Direct Application - Student directly demonstrates the skill
    2. Real World Context - Embeds skill in everyday situations
    3. Comparison/Analysis - Finds patterns or differences
    4. Error Detection - Identifies mistakes
    5. Sequencing/Ordering - Arranges items correctly
    6. Sorting/Categorizing - Groups items by attributes
    7. Prediction/Extension - Uses patterns to predict next steps
    8. Transformation - Shows how things change
    9. Assessment/Verification - Checks if something is correct

    The problem should:
    1. Match one of the above problem types (vary with each generation)
    2. Include all necessary information
    3. Have a well-defined answer or solution
    4. Use age-appropriate contexts:
    - Family/Home life
    - Play/Games
    - Animals/Nature
    - Food/Snacks
    - Toys/Objects
    5. Include engagement elements:
    - Character names
    - Familiar situations
    - Action words
    - Simple choices
    6. Be accessible for 5-6 year olds:
    - Short sentences
    - Clear instructions
    - Concrete examples

    
Please provide your response in EXACTLY this format with no additional sections:


Return your response EXACTLY in this JSON format:
{{
    "problem_type": "one of the problem types listed above",
    "problem": "Write a clear, concise problem using age-appropriate language. Include all necessary information. Use engaging elements like character names and familiar situations.",
    "answer": "Provide the complete, specific answer",
    "success_criteria": [
        "First observable behavior showing understanding",
        "Second observable behavior showing application",
        "Third observable behavior showing mastery"
    ],
    "teaching_note": "Brief tip about common misconceptions or support strategies"
}}
    
    DO NOT add any additional sections beyond the five specified above (Problem Type, Problem, Answer, Success Criteria, Teaching Note)"""

                print(f"[DEBUG] Using prompt: {prompt}")
                
                response = await ai_service.generate_response(
                    prompt=prompt,
                    system_instructions="You are an expert kindergarten teacher specialized in creating engaging, age-appropriate problems that promote active learning and critical thinking."
                )
                
                print(f"[DEBUG] Got response: {response}")
                return response
                
            except Exception as e:
                print(f"[ERROR] Error generating problem: {str(e)}")
                import traceback
                traceback.print_exc()
                
                # The fallback is handled at higher level methods
                return None

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
            raw_problem = await self.generate_problem(subject, recommendation)
            if not raw_problem:
                return None
            
            # Parse the problem into structured format
            parsed_problem = await self._parse_problem(raw_problem)
            return parsed_problem
            
        except Exception as e:
            logger.error(f"Error in generate_and_parse_problem: {e}")
            return None

    async def _parse_problem(self, raw_problem: str) -> Dict[str, Any]:
        """
        Parse the AI response, handling both raw JSON and Markdown-wrapped JSON,
        into a structured problem object.
        """
        if not raw_problem:
            logger.error("[ERROR] Received empty raw problem string for parsing.")
            return None

        logger.debug(f"[DEBUG] Raw problem received for parsing:\n---\n{raw_problem}\n---")

        potential_json = raw_problem.strip()

        # --- Strategy: ---
        # 1. Try parsing the stripped string directly (handles raw JSON).
        # 2. If that fails, assume it might be wrapped (e.g., in ```json ... ```)
        #    and try extracting the content between the first '{' and last '}'.

        parsed_data = None

        # --- Attempt 1: Direct Parsing ---
        try:
            # Check if it looks like a JSON object or array start
            if potential_json.startswith('{') and potential_json.endswith('}'):
                parsed_data = json.loads(potential_json)
                logger.debug("[DEBUG] Successfully parsed raw_problem directly after stripping.")
            # Add check for array if your format might ever return a list/array at the top level
            # elif potential_json.startswith('[') and potential_json.endswith(']'):
            #     parsed_data = json.loads(potential_json)
            #     logger.debug("[DEBUG] Successfully parsed raw_problem directly as array after stripping.")
            else:
                # Doesn't start/end like simple JSON, might have wrappers.
                # Fall through to Attempt 2.
                logger.debug("[DEBUG] Stripped string doesn't start/end with {} or []. Will attempt extraction.")
                pass # Explicitly pass to indicate fallback

        except json.JSONDecodeError as e:
            logger.warning(f"[WARN] Direct JSON parsing failed: {e}. Will attempt extraction.")
            # Fall through to Attempt 2

        # --- Attempt 2: Extraction (if direct parsing failed or wasn't applicable) ---
        if parsed_data is None: # Only try extraction if direct parse didn't work
            try:
                start_index = raw_problem.find('{')
                end_index = raw_problem.rfind('}')

                if start_index != -1 and end_index != -1 and start_index < end_index:
                    json_string_extracted = raw_problem[start_index : end_index + 1]
                    logger.debug(f"[DEBUG] Attempting to parse extracted substring:\n---\n{json_string_extracted}\n---")
                    parsed_data = json.loads(json_string_extracted)
                    logger.debug("[DEBUG] Successfully parsed extracted JSON substring.")
                else:
                    # If we couldn't find braces after direct parse failed, it's likely bad format
                    logger.error(f"[ERROR] Could not find valid JSON object delimiters '{{' and '}}' in response after direct parse failed.")
                    logger.debug(f"[DEBUG] Raw response was:\n---\n{raw_problem}\n---")
                    return None

            except json.JSONDecodeError as e:
                logger.error(f"[ERROR] Failed to parse extracted JSON substring: {e}")
                logger.debug(f"[DEBUG] Extracted substring attempted:\n---\n{json_string_extracted}\n---")
                logger.debug(f"[DEBUG] Original raw response was:\n---\n{raw_problem}\n---")
                return None # Failed both direct and extraction parse
            except Exception as e: # Catch any other unexpected error during extraction/parsing
                logger.error(f"[ERROR] Unexpected error during JSON extraction/parsing: {e}")
                import traceback
                logger.error(traceback.format_exc())
                return None


        # --- Validation (runs if either attempt succeeded) ---
        if parsed_data:
            try:
                required_fields = ['problem_type', 'problem', 'answer', 'success_criteria', 'teaching_note']
                missing_fields = [field for field in required_fields if field not in parsed_data or not parsed_data.get(field)] # Check existence and non-emptiness

                if missing_fields:
                    logger.error(f"[ERROR] Parsed JSON is missing required or empty fields: {missing_fields}")
                    logger.debug(f"[DEBUG] Parsed data with missing fields: {parsed_data}")
                    return None

                if not isinstance(parsed_data.get('success_criteria'), list):
                    logger.error("[ERROR] 'success_criteria' field must be a list.")
                    logger.debug(f"[DEBUG] Parsed data with invalid success_criteria: {parsed_data}")
                    return None

                logger.debug(f"[DEBUG] Successfully validated parsed problem data: {parsed_data}")
                return parsed_data # Return the validated data

            except Exception as e: # Catch errors during validation
                logger.error(f"[ERROR] Unexpected error during parsed data validation: {e}")
                import traceback
                logger.error(traceback.format_exc())
                return None
        else:
            # Should not happen if logic above is correct, but as a safeguard
            logger.error("[ERROR] Reached end of parsing function without valid data or explicit failure.")
            return None

    async def get_multiple_problems(
        self,
        student_id: int,
        subject: str,
        recommendations: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Generate multiple problems based on a list of recommendations in a single operation.
        Now with caching support.
        
        Args:
            student_id: The ID of the student
            subject: The subject area
            recommendations: List of recommendation objects from the analytics service
            
        Returns:
            List of problem objects
        """
        try:
            print(f"[DEBUG] Generating multiple problems from {len(recommendations)} recommendations")
            
            # Get the current AI service
            ai_service = self.get_current_ai_service()
            
            # Ensure competency_service is available
            if not self.competency_service:
                print("[ERROR] CompetencyService not initialized")
                return []
            
            # Format the recommendations for the batch request
            formatted_recommendations = []
            for recommendation in recommendations:
                # Get detailed objectives for each recommended subskill
                subskill_id = recommendation.get("subskill_id")
                
                objectives = await self.competency_service.get_detailed_objectives(
                    subject=subject or recommendation.get("subject", ""),
                    subskill_id=subskill_id
                )
                
                formatted_recommendations.append({
                    "unit": {
                        "id": recommendation.get("unit_id"),
                        "title": recommendation.get("unit_title")
                    },
                    "skill": {
                        "id": recommendation.get("skill_id"),
                        "description": recommendation.get("skill_description")
                    },
                    "subskill": {
                        "id": subskill_id,
                        "description": recommendation.get("subskill_description")
                    },
                    "difficulty": 5.0,  # Default difficulty or use recommendation.get("proficiency")
                    "detailed_objectives": objectives,
                    "recommendation_data": {
                        "priority_level": recommendation.get("priority_level"),
                        "readiness_status": recommendation.get("readiness_status"),
                        "proficiency": recommendation.get("proficiency"),
                        "mastery": recommendation.get("mastery")
                    }
                })
            
            # Start with an empty list of selected problems
            final_problems = []
            
            # Track which recommendations need new problems
            new_problem_indices = []
            
            # STEP 1: First, check if we have cached problems for each recommendation
            if self.cosmos_db:
                for i, rec in enumerate(formatted_recommendations):
                    skill_id = rec["skill"]["id"]
                    subskill_id = rec["subskill"]["id"]
                    
                    print(f"[DEBUG] Looking for cached problems for recommendation {i+1}: {skill_id}/{subskill_id}")
                    
                    cached_problems = await self.cosmos_db.get_cached_problems(
                        subject=subject,
                        skill_id=skill_id,
                        subskill_id=subskill_id
                    )
                    
                    if cached_problems:
                        print(f"[DEBUG] Found {len(cached_problems)} cached problems for recommendation {i+1}")
                        
                        # Use problem optimizer if available to select the best one
                        if hasattr(self, 'problem_optimizer') and self.problem_optimizer:
                            # Extract unit_id from recommendation
                            unit_id = rec["unit"]["id"]
                            
                            # Process problems to ensure they have the right format
                            processed_problems = []
                            for problem in cached_problems:
                                if "problem_data" in problem and isinstance(problem["problem_data"], dict):
                                    processed_problems.append(problem["problem_data"])
                                else:
                                    processed_problems.append(problem)
                            
                            # Select an optimal problem
                            optimal_problems = await self.problem_optimizer.select_optimal_problems(
                                student_id=student_id,
                                subject=subject,
                                skill_id=skill_id,
                                subskill_id=subskill_id,
                                unit_id=unit_id,
                                available_problems=processed_problems,
                                count=1
                            )
                            
                            if optimal_problems and len(optimal_problems) > 0:
                                # Add metadata if it doesn't exist
                                selected_problem = optimal_problems[0]
                                if "metadata" not in selected_problem:
                                    selected_problem["metadata"] = {
                                        'unit': rec["unit"],
                                        'skill': rec["skill"],
                                        'subskill': rec["subskill"],
                                        'difficulty': rec["difficulty"],
                                        'objectives': rec["detailed_objectives"],
                                        'recommendation': rec["recommendation_data"],
                                        'subject': subject
                                    }
                                
                                final_problems.append(selected_problem)
                                continue
                        else:
                            # No optimizer available, just pick a random one
                            import random
                            selected_problem = random.choice(cached_problems)
                            
                            # Extract problem_data if in nested format
                            if "problem_data" in selected_problem and isinstance(selected_problem["problem_data"], dict):
                                selected_problem = selected_problem["problem_data"]
                            
                            # Add metadata if it doesn't exist
                            if "metadata" not in selected_problem:
                                selected_problem["metadata"] = {
                                    'unit': rec["unit"],
                                    'skill': rec["skill"],
                                    'subskill': rec["subskill"],
                                    'difficulty': rec["difficulty"],
                                    'objectives': rec["detailed_objectives"],
                                    'recommendation': rec["recommendation_data"],
                                    'subject': subject
                                }
                            
                            final_problems.append(selected_problem)
                            continue
                    
                    # If we get here, we need to generate a new problem for this recommendation
                    new_problem_indices.append(i)
            else:
                # No cosmos_db, need to generate all problems
                new_problem_indices = list(range(len(formatted_recommendations)))
            
            # STEP 2: Generate new problems for recommendations without cached problems
            if new_problem_indices:
                print(f"[DEBUG] Need to generate {len(new_problem_indices)} new problems")
                
                # Extract recommendations that need new problems
                new_recs = [formatted_recommendations[i] for i in new_problem_indices]
                
                # Generate batch of problems
                raw_problems_response = await self.generate_multiple_problems(
                    subject=subject,
                    recommendations=new_recs
                )
                
                if raw_problems_response:
                    try:
                        response_obj = json.loads(raw_problems_response)
                        
                        if isinstance(response_obj, dict) and "problems" in response_obj:
                            raw_problems = response_obj["problems"]
                            
                            # Process each new problem
                            for i, raw_problem in enumerate(raw_problems):
                                if i >= len(new_problem_indices):
                                    break
                                    
                                # Get the original recommendation index
                                rec_index = new_problem_indices[i]
                                rec = formatted_recommendations[rec_index]
                                
                                # Convert to string for _parse_problem if needed
                                if not isinstance(raw_problem, str):
                                    raw_problem = json.dumps(raw_problem)
                                    
                                problem_data = await self._parse_problem(raw_problem)
                                
                                if problem_data:
                                    # Add metadata
                                    problem_data['metadata'] = {
                                        'unit': rec['unit'],
                                        'skill': rec['skill'],
                                        'subskill': rec['subskill'],
                                        'difficulty': rec['difficulty'],
                                        'objectives': rec['detailed_objectives'],
                                        'recommendation': rec['recommendation_data'],
                                        'subject': subject
                                    }
                                    
                                    # Cache the new problem
                                    if self.cosmos_db:
                                        await self.cosmos_db.save_cached_problem(
                                            subject=subject,
                                            skill_id=rec['skill']['id'],
                                            subskill_id=rec['subskill']['id'],
                                            problem_data=problem_data
                                        )
                                        print(f"[DEBUG] Saved new problem to cache for recommendation {rec_index+1}")
                                    
                                    # Insert in the correct position to match the original recommendation order
                                    if rec_index < len(final_problems):
                                        final_problems.insert(rec_index, problem_data)
                                    else:
                                        final_problems.append(problem_data)
                    except Exception as e:
                        print(f"[ERROR] Error processing generated problems: {str(e)}")
                        import traceback
                        traceback.print_exc()
            
            print(f"[DEBUG] Successfully generated {len(final_problems)} problems")
            return final_problems
                
        except Exception as e:
            print(f"[ERROR] Error in get_multiple_problems: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    async def get_skill_problems(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get multiple problems for a specific skill and subskill.
        Uses problem optimizer to select ideal problems for the student.
        
        Flow:
        1. Try to get problems from cache first
        2. Use optimizer to select optimal problems
        3. If not enough, generate new problems and cache them
        """
        try:
            print(f"[DEBUG] Getting {count} problems for skill: {skill_id}, subskill: {subskill_id}")
            
            # Start with an empty list of selected problems
            selected_problems = []
            
            # STEP 1: First, check if we have cached problems
            cached_problems = []
            if self.cosmos_db:
                print(f"[DEBUG] Looking for cached problems in cosmos_db")
                cached_problems = await self.cosmos_db.get_cached_problems(
                    subject=subject,
                    skill_id=skill_id,
                    subskill_id=subskill_id
                )
                print(f"[DEBUG] Found {len(cached_problems)} cached problems with keys: {[list(p.keys()) for p in cached_problems[:2]]}")
                
            # STEP 2: If we have cached problems, use the optimizer to select the best ones
            if cached_problems:
                # Extract unit_id from problem metadata if available
                unit_id = None
                for problem in cached_problems:
                    # Handle both formats: direct problem_data or nested in problem_data field
                    problem_obj = problem.get("problem_data", problem)
                    if problem_obj.get("metadata", {}).get("unit", {}).get("id"):
                        unit_id = problem_obj["metadata"]["unit"]["id"]
                        break
                
                print(f"[DEBUG] Extracted unit_id: {unit_id}")
                
                # Use problem optimizer if available
                if hasattr(self, 'problem_optimizer') and self.problem_optimizer:
                    print(f"[DEBUG] Using problem optimizer to select from {len(cached_problems)} cached problems")
                    
                    # Verify problems structure before passing to optimizer
                    problematic_problems = []
                    for i, problem in enumerate(cached_problems):
                        if not isinstance(problem, dict):
                            print(f"[WARNING] Problem {i} is not a dictionary: {type(problem)}")
                            problematic_problems.append(i)
                        
                    if problematic_problems:
                        print(f"[WARNING] Found {len(problematic_problems)} problematic problems, skipping them")
                        cached_problems = [p for i, p in enumerate(cached_problems) if i not in problematic_problems]
                    
                    # Extract problem data if nested
                    processed_problems = []
                    for problem in cached_problems:
                        if "problem_data" in problem and isinstance(problem["problem_data"], dict):
                            processed_problems.append(problem["problem_data"])
                        else:
                            processed_problems.append(problem)
                    
                    # Pass processed problems to optimizer
                    optimal_problems = await self.problem_optimizer.select_optimal_problems(
                        student_id=student_id,
                        subject=subject,
                        skill_id=skill_id,
                        subskill_id=subskill_id,
                        unit_id=unit_id,
                        available_problems=processed_problems,
                        count=count
                    )
                    
                    if optimal_problems:
                        print(f"[DEBUG] Selected {len(optimal_problems)} optimal problems from cache")
                        selected_problems = optimal_problems
                else:
                    # No optimizer available, just use random selection
                    print(f"[DEBUG] No optimizer available, using random selection from cache")
                    import random
                    random.shuffle(cached_problems)
                    # Extract problem_data if in nested format
                    selected_problems = []
                    for p in cached_problems[:count]:
                        if "problem_data" in p and isinstance(p["problem_data"], dict):
                            selected_problems.append(p["problem_data"])
                        else:
                            selected_problems.append(p)
                
            # Log details of selected problems
            print(f"[DEBUG] Selected problems details:")
            for i, problem in enumerate(selected_problems[:3]):  # Log first 3 for brevity
                print(f"[DEBUG] Problem {i+1} keys: {problem.keys()}")
                print(f"[DEBUG] Problem {i+1} type: {problem.get('problem_type', 'missing')}")
                if 'metadata' in problem:
                    print(f"[DEBUG] Problem {i+1} metadata keys: {problem['metadata'].keys()}")
                
            # Verify problem structure before returning
            valid_problems = []
            for i, problem in enumerate(selected_problems):
                has_issues = False
                
                # Check for required fields
                required_fields = ['problem_type', 'problem', 'answer', 'success_criteria', 'teaching_note']
                missing_fields = [field for field in required_fields if field not in problem]
                
                if missing_fields:
                    print(f"[WARNING] Problem {i} is missing required fields: {missing_fields}")
                    has_issues = True
                    
                # Check if success_criteria is a list
                if 'success_criteria' in problem and not isinstance(problem['success_criteria'], list):
                    print(f"[WARNING] Problem {i} has success_criteria that is not a list: {type(problem['success_criteria'])}")
                    has_issues = True
                    
                if not has_issues:
                    valid_problems.append(problem)
                
            print(f"[DEBUG] Found {len(valid_problems)} valid problems out of {len(selected_problems)} selected")
            
            # STEP 3: If we don't have enough problems, generate more
            problems_needed = max(0, count - len(valid_problems))
            if problems_needed > 0:
                print(f"[DEBUG] Need {problems_needed} more problems, generating new ones")
                
                # Create recommendations list for the missing problems
                recommendations = []
                for i in range(problems_needed):
                    context = {
                        "unit": None,
                        "skill": skill_id,
                        "subskill": subskill_id
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
                        print(f"[ERROR] Failed to get recommendation {i+1}")
                        continue
                        
                    # Get detailed objectives
                    objectives = await self.competency_service.get_detailed_objectives(
                        subject=subject,
                        subskill_id=recommendation['subskill']['id']
                    )
                    
                    # Add to recommendations
                    recommendations.append({
                        **recommendation,
                        'detailed_objectives': objectives
                    })
                
                # Generate the new problems if we have recommendations
                if recommendations:
                    # Generate batch of problems
                    raw_problems_response = await self.generate_multiple_problems(
                        subject=subject,
                        recommendations=recommendations
                    )
                    
                    if raw_problems_response:
                        try:
                            import json
                            response_obj = json.loads(raw_problems_response)
                            
                            if isinstance(response_obj, dict) and "problems" in response_obj:
                                raw_problems = response_obj["problems"]
                                
                                # Parse and process each problem
                                new_problems = []
                                for i, raw_problem in enumerate(raw_problems):
                                    if i >= len(recommendations):
                                        break
                                        
                                    # Convert to string for _parse_problem if needed
                                    if not isinstance(raw_problem, str):
                                        raw_problem = json.dumps(raw_problem)
                                        
                                    problem_data = await self._parse_problem(raw_problem)
                                    
                                    if problem_data:
                                        # Add metadata
                                        problem_data['metadata'] = {
                                            'unit': recommendations[i]['unit'],
                                            'skill': recommendations[i]['skill'],
                                            'subskill': recommendations[i]['subskill'],
                                            'difficulty': recommendations[i]['difficulty'],
                                            'objectives': recommendations[i]['detailed_objectives']
                                        }
                                        
                                        # Cache the new problem - let the cosmos_db service handle ID generation
                                        if self.cosmos_db:
                                            await self.cosmos_db.save_cached_problem(
                                                subject=subject,
                                                skill_id=skill_id,
                                                subskill_id=subskill_id,
                                                problem_data=problem_data
                                            )
                                        
                                        new_problems.append(problem_data)
                                
                                # Append new problems to valid problems
                                valid_problems.extend(new_problems)
                                print(f"[DEBUG] Added {len(new_problems)} newly generated problems")
                                
                        except Exception as e:
                            print(f"[ERROR] Error processing generated problems: {e}")
                            import traceback
                            traceback.print_exc()
                
                # Ensure we don't return more than requested
                if len(valid_problems) > count:
                    valid_problems = valid_problems[:count]
                    
                print(f"[DEBUG] Returning {len(valid_problems)} problems in total")
                
                # Final validation to ensure we're returning correctly structured data
                for i, problem in enumerate(valid_problems[:3]):  # Log first 3 for brevity
                    print(f"[DEBUG] Final problem {i+1} keys: {problem.keys()}")
                    if 'problem_type' in problem:
                        print(f"[DEBUG] Final problem {i+1} type: {problem['problem_type']}")
                    if 'metadata' in problem:
                        print(f"[DEBUG] Final problem {i+1} metadata keys: {problem['metadata'].keys()}")
                
                return valid_problems
            else:
                print(f"[DEBUG] We have enough problems ({len(valid_problems)}), returning them")
                return valid_problems
                    
        except Exception as e:
            print(f"[ERROR] Error in get_skill_problems: {e}")
            import traceback
            traceback.print_exc()
            return []

    async def generate_multiple_problems(
        self,
        subject: str,
        recommendations: List[Dict[str, Any]]
    ) -> str:
        """
        Generate multiple problems in a single call to the AI service.
        
        Args:
            subject: The subject area
            recommendations: List of formatted recommendation objects
            
        Returns:
            JSON string containing the problems
        """
        try:
            # Get the current AI service
            ai_service = self.get_current_ai_service()
            
            print(f"[DEBUG] Generating {len(recommendations)} problems in batch")
            
            # Build the batch prompt with a clear structured format
            prompt = f"""Generate {len(recommendations)} different age-appropriate {subject} problems for a kindergarten student (typically 5-6 years old).

    I will provide you with information about each problem's learning objectives below.

    Your response must be in this EXACT JSON structure:

    {{
    "problems": [
        {{
        "problem_type": "Direct Application",
        "problem": "Problem text for problem 1...",
        "answer": "Answer for problem 1...",
        "success_criteria": [
            "Criterion 1 for problem 1",
            "Criterion 2 for problem 1",
            "Criterion 3 for problem 1"
        ],
        "teaching_note": "Teaching note for problem 1..."
        }},
        {{
        "problem_type": "Real World Context",
        "problem": "Problem text for problem 2...",
        "answer": "Answer for problem 2...",
        "success_criteria": [
            "Criterion 1 for problem 2",
            "Criterion 2 for problem 2",
            "Criterion 3 for problem 2"
        ],
        "teaching_note": "Teaching note for problem 2..."
        }},
        ... and so on for all {len(recommendations)} problems
    ]
    }}

    You must generate exactly {len(recommendations)} problems in your response. Each problem must have all 5 required fields: problem_type, problem, answer, success_criteria (an array of 3 items), and teaching_note.

    Now, here are the specific learning objectives for each problem:

    """
            # Add each recommendation to the prompt
            for i, rec in enumerate(recommendations):
                prompt += f"""
    PROBLEM #{i+1}:
    Learning Context:
    Subject: {subject}
    Unit: {rec['unit']['title']}
    Skill: {rec['skill']['description']}
    Subskill: {rec['subskill']['description']}
    Concept Group: {rec['detailed_objectives'].get('ConceptGroup', 'General')}
    Specific Learning Objective: {rec['detailed_objectives'].get('DetailedObjective', 'Basic understanding')}
    Difficulty Level: {rec['difficulty']} (1-10 scale)

    """

            # Add generation instructions
            prompt += """
    Consider these problem types:
    1. Direct Application - Student directly demonstrates the skill
    2. Real World Context - Embeds skill in everyday situations
    3. Comparison/Analysis - Finds patterns or differences
    4. Error Detection - Identifies mistakes
    5. Sequencing/Ordering - Arranges items correctly
    6. Sorting/Categorizing - Groups items by attributes
    7. Prediction/Extension - Uses patterns to predict next steps
    8. Transformation - Shows how things change
    9. Assessment/Verification - Checks if something is correct

    Each problem should:
    1. Match one of the above problem types (vary across the problems)
    2. Include all necessary information
    3. Have a well-defined answer or solution
    4. Use age-appropriate contexts:
    - Family/Home life
    - Play/Games
    - Animals/Nature
    - Food/Snacks
    - Toys/Objects
    5. Include engagement elements:
    - Character names
    - Familiar situations
    - Action words
    - Simple choices
    6. Be accessible for 5-6 year olds:
    - Short sentences
    - Clear instructions
    - Concrete examples

    IMPORTANT: Your response must contain EXACTLY the JSON structure I specified earlier, with exactly {len(recommendations)} problems in the array. DO NOT add any additional fields or explanatory text outside the JSON structure.
    """

            # Send the batch request to the AI service
            response = await ai_service.generate_response(
                prompt=prompt,
                system_instructions="You are an expert kindergarten teacher specialized in creating engaging, age-appropriate problems that promote active learning and critical thinking. You are also skilled at following strict output format instructions."
            )
            
            # Validate the JSON before returning
            try:
                json.loads(response)
                return response
            except json.JSONDecodeError as e:
                print(f"[ERROR] AI service returned invalid JSON: {str(e)}")
                print(f"Raw response: {response}")
                # Try to extract JSON if it's wrapped in text
                import re
                json_match = re.search(r'({[\s\S]*})', response)
                if json_match:
                    try:
                        json.loads(json_match.group(1))
                        return json_match.group(1)
                    except:
                        pass
                return None
                
        except Exception as e:
            print(f"[ERROR] Error generating multiple problems: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    async def _parse_json_response(self, raw_response: str) -> Optional[Dict[str, Any]]:
        """
        Parse the AI response, handling both raw JSON and Markdown-wrapped JSON,
        into a structured object.
        """
        if not raw_response:
            print("[ERROR] Received empty raw response string for parsing.")
            return None

        print(f"[DEBUG] Raw response received for parsing:\n---\n{raw_response}\n---")

        potential_json = raw_response.strip()

        # --- Strategy: ---
        # 1. Try parsing the stripped string directly (handles raw JSON).
        # 2. If that fails, assume it might be wrapped (e.g., in ```json ... ```)
        #    and try extracting the content between the first '{' and last '}'.

        parsed_data = None

        # --- Attempt 1: Direct Parsing ---
        try:
            # Check if it looks like a JSON object or array start
            if potential_json.startswith('{') and potential_json.endswith('}'):
                parsed_data = json.loads(potential_json)
                print("[DEBUG] Successfully parsed raw_response directly after stripping.")
            # Add check for array if your format might ever return a list/array at the top level
            # elif potential_json.startswith('[') and potential_json.endswith(']'):
            #     parsed_data = json.loads(potential_json)
            #     print("[DEBUG] Successfully parsed raw_response directly as array after stripping.")
            else:
                # Doesn't start/end like simple JSON, might have wrappers.
                # Fall through to Attempt 2.
                print("[DEBUG] Stripped string doesn't start/end with {} or []. Will attempt extraction.")
                pass # Explicitly pass to indicate fallback

        except json.JSONDecodeError as e:
            print(f"[WARN] Direct JSON parsing failed: {e}. Will attempt extraction.")
            # Fall through to Attempt 2

        # --- Attempt 2: Remove markdown code blocks ---
        if parsed_data is None:
            try:
                # Remove markdown code blocks if present
                if potential_json.startswith("```json") or potential_json.startswith("```"):
                    cleaned_json = re.sub(r'^```(?:json)?\s*', '', potential_json)
                    cleaned_json = re.sub(r'\s*```$', '', cleaned_json)
                    print(f"[DEBUG] Cleaned JSON after removing markdown: {cleaned_json[:100]}...")
                    
                    try:
                        parsed_data = json.loads(cleaned_json)
                        print("[DEBUG] Successfully parsed JSON after removing markdown formatting.")
                    except json.JSONDecodeError:
                        # Fall through to next method if this fails
                        pass
            except Exception as e:
                print(f"[WARN] Error during markdown cleanup: {e}")
                # Continue to next method

        # --- Attempt 3: Extraction (if previous attempts failed) ---
        if parsed_data is None: # Only try extraction if previous methods didn't work
            try:
                start_index = raw_response.find('{')
                end_index = raw_response.rfind('}')

                if start_index != -1 and end_index != -1 and start_index < end_index:
                    json_string_extracted = raw_response[start_index : end_index + 1]
                    print(f"[DEBUG] Attempting to parse extracted substring:\n---\n{json_string_extracted[:100]}...\n---")
                    parsed_data = json.loads(json_string_extracted)
                    print("[DEBUG] Successfully parsed extracted JSON substring.")
                else:
                    # If we couldn't find braces after direct parse failed, it's likely bad format
                    print(f"[ERROR] Could not find valid JSON object delimiters '{{' and '}}' in response after direct parse failed.")
                    print(f"[DEBUG] Raw response was:\n---\n{raw_response}\n---")
                    return None

            except json.JSONDecodeError as e:
                print(f"[ERROR] Failed to parse extracted JSON substring: {e}")
                print(f"[DEBUG] Extracted substring attempted:\n---\n{json_string_extracted}\n---")
                print(f"[DEBUG] Original raw response was:\n---\n{raw_response}\n---")
                return None # Failed all parsing attempts
            except Exception as e: # Catch any other unexpected error during extraction/parsing
                print(f"[ERROR] Unexpected error during JSON extraction/parsing: {e}")
                import traceback
                print(traceback.format_exc())
                return None

        # --- Validation (runs if any attempt succeeded) ---
        if parsed_data:
            try:
                # Check if the required sections are present
                required_sections = ['observation', 'analysis', 'evaluation', 'feedback']
                missing_sections = [section for section in required_sections if section not in parsed_data]
                
                if missing_sections:
                    print(f"[ERROR] Parsed JSON is missing required sections: {missing_sections}")
                    print(f"[DEBUG] Parsed data with missing sections: {parsed_data}")
                    # We might want to handle this differently than returning None
                    # For example, we could create default empty sections
                    for section in missing_sections:
                        parsed_data[section] = {}
                
                print(f"[DEBUG] Successfully validated parsed response data")
                return parsed_data # Return the validated data

            except Exception as e: # Catch errors during validation
                print(f"[ERROR] Unexpected error during parsed data validation: {e}")
                import traceback
                print(traceback.format_exc())
                return None
        else:
            # Should not happen if logic above is correct, but as a safeguard
            print("[ERROR] Reached end of parsing function without valid data or explicit failure.")
            return None
                