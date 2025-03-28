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
                'objectives': objectives  # Include the selected objectives in metadata
            }
            
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
            
            # Generate the problem using pre-loaded data
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
                'objectives': session_objectives
            }
            
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
            
            # Generate batch of problems in a single call to the AI service
            raw_problems_response = await self.generate_multiple_problems(
                subject=subject,
                recommendations=formatted_recommendations
            )
            
            if not raw_problems_response:
                print("[ERROR] Failed to generate raw problems")
                return []
            
            # Parse the response to get individual problems
            try:
                response_obj = json.loads(raw_problems_response)
                
                if not isinstance(response_obj, dict) or "problems" not in response_obj:
                    print("[ERROR] Response does not contain 'problems' array")
                    return []
                    
                raw_problems = response_obj["problems"]
                if not isinstance(raw_problems, list):
                    print("[ERROR] 'problems' is not an array")
                    return []
            except json.JSONDecodeError as e:
                print(f"[ERROR] Failed to parse JSON response: {str(e)}")
                return []
                
            # Parse the problems
            problems = []
            for i, raw_problem in enumerate(raw_problems):
                if i >= len(formatted_recommendations):
                    # If we have more problems than recommendations, stop processing
                    break
                
                # Convert to string for _parse_problem if it's not already a string
                if not isinstance(raw_problem, str):
                    raw_problem = json.dumps(raw_problem)
                    
                problem_data = await self._parse_problem(raw_problem)
                
                if problem_data:
                    # Add metadata about what was actually selected
                    problem_data['metadata'] = {
                        'unit': formatted_recommendations[i]['unit'],
                        'skill': formatted_recommendations[i]['skill'],
                        'subskill': formatted_recommendations[i]['subskill'],
                        'difficulty': formatted_recommendations[i]['difficulty'],
                        'objectives': formatted_recommendations[i]['detailed_objectives'],
                        'recommendation': formatted_recommendations[i]['recommendation_data']
                    }
                    problems.append(problem_data)
            
            print(f"[DEBUG] Successfully generated {len(problems)} problems")
            return problems
                
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
        Generate multiple problems for a specific skill and subskill.
        
        Args:
            student_id: The ID of the student
            subject: The subject area
            skill_id: The specific skill ID
            subskill_id: The specific subskill ID
            count: Number of problems to generate (default 5)
                
        Returns:
            List of problem objects with varied concept groups
        """
        try:
            print(f"[DEBUG] Generating {count} problems for skill: {skill_id}, subskill: {subskill_id}")
            
            # Create recommendations list
            recommendations = []
            
            # Generate multiple recommendations for the same skill/subskill but with different concept groups
            for i in range(count):
                # Create context with the specific skill and subskill
                context = {
                    "unit": None,
                    "skill": skill_id,
                    "subskill": subskill_id
                }
                
                # Get recommendation using existing method - this should return different concept groups
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
                    
                # Get detailed objectives with potentially different concept groups
                objectives = await self.competency_service.get_detailed_objectives(
                    subject=subject,
                    subskill_id=recommendation['subskill']['id']
                )
                
                print(f"[DEBUG] Got objectives for problem {i+1}: {objectives}")
                
                # Add to recommendations list with the actual concept group from competency service
                recommendations.append({
                    **recommendation,
                    'detailed_objectives': objectives
                })
                
                concept_group = objectives.get("ConceptGroup", "Unknown")
                print(f"[DEBUG] Added recommendation {i+1} with concept group: {concept_group}")
            
            # If we couldn't get enough recommendations, return what we have
            if not recommendations:
                print("[ERROR] Failed to get any recommendations")
                return []
                
            # Generate batch of problems
            raw_problems_response = await self.generate_multiple_problems(
                subject=subject,
                recommendations=recommendations
            )
            
            if not raw_problems_response:
                print("[ERROR] Failed to generate raw problems")
                return []
            
            # Parse the response
            try:
                response_obj = json.loads(raw_problems_response)
                
                if not isinstance(response_obj, dict) or "problems" not in response_obj:
                    print("[ERROR] Response does not contain 'problems' array")
                    return []
                    
                raw_problems = response_obj["problems"]
                if not isinstance(raw_problems, list):
                    print("[ERROR] 'problems' is not an array")
                    return []
            except json.JSONDecodeError as e:
                print(f"[ERROR] Failed to parse JSON response: {str(e)}")
                return []
                
            # Parse each problem
            problems = []
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
                        'objectives': recommendations[i]['detailed_objectives'],
                        'concept_group': recommendations[i]['detailed_objectives'].get('ConceptGroup', 'Unknown')
                    }
                    problems.append(problem_data)
            
            print(f"[DEBUG] Successfully generated {len(problems)} problems with varied concept groups")
            return problems
                
        except Exception as e:
            print(f"[ERROR] Error in get_skill_problems: {str(e)}")
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

    async def get_student_history(self, student_id: int) -> List[Dict[str, Any]]:
        """Get history of problems attempted by a student"""
        if student_id not in self._problem_history:
            return []
        return self._problem_history[student_id]

    async def review_problem(
        self,
        student_id: int,
        subject: str,
        problem: Dict[str, Any],  # Accept full problem object from frontend
        solution_image_base64: str,
        skill_id: str,
        subskill_id: str = None,
        student_answer: str = "",
        canvas_used: bool = True
    ) -> Dict[str, Any]:
        """Review a student's problem solution"""
        try:
            # Get the current AI service
            ai_service = self.get_current_ai_service()
            
            # Ensure cosmos_db service is available
            if not self.cosmos_db:
                print("[WARNING] CosmosDB service not initialized, review will not be saved")
                
            print(f"Review problem called with image data length: {len(solution_image_base64)}")
            print(f"[DEBUG] Problem object received: {problem.keys()}")
            print(f"[DEBUG] Problem metadata: {problem.get('metadata', {}).keys()}")

            # Log problem content details
            if 'problem' in problem:
                print(f"[DEBUG] Problem text available: {problem['problem']} ")
            if 'problem_type' in problem:
                print(f"[DEBUG] Problem type: {problem['problem_type']}")

            # Log before saving to CosmosDB
            problem_id = problem.get("id", f"{subject}_{skill_id}_{datetime.utcnow().isoformat()}")            
            print(f"[DEBUG] About to save review to CosmosDB")
            print(f"[DEBUG] Problem ID being used: {problem_id}")
            print(f"[DEBUG] Including problem_content in save: {'yes' if problem else 'no'}")
            
            system_instructions = """You are an expert kindergarten teacher skilled at reviewing student work.
            Focus on:
            1. Clear, simple language
            2. Positive reinforcement
            3. Age-appropriate feedback
            4. Encouraging growth mindset
            5. Specific, actionable guidance
            """

            # Extract problem text from problem object
            problem_text = problem.get('problem', '')
            
            # Create the prompt in the correct format
            # Use triple double quotes to avoid having to escape curly braces
            json_format_template = """
    {
        "observation": {
            "canvas_description": "If there's a canvas solution, describe in detail what you see in the image",
            "selected_answer": "If there's a multiple-choice answer, state the selected option",
            "work_shown": "Describe any additional work or steps shown by the student"
        },
        "analysis": {
            "understanding": "Analyze the student's conceptual understanding",
            "approach": "Describe the problem-solving approach used",
            "accuracy": "Compare against the expected answer",
            "creativity": "Note any creative or alternative valid solutions"
        },
        "evaluation": {
            "score": "Numerical score 1-10",
            "justification": "Brief explanation of the score"
        },
        "feedback": {
            "praise": "Specific praise for what was done well",
            "guidance": "Age-appropriate suggestions for improvement",
            "encouragement": "Positive reinforcement message",
            "next_steps": "Simple, actionable next steps"
        }
    }"""
            
            prompt_text = f"""Review this {subject} problem and the student's solution:

    Problem: {problem_text}

    Please follow these steps:
    1. For observation:
    - If there's a canvas solution, describe what you see in the image.
    - If there's a multiple-choice answer, state the selected option.
    2. For analysis:
    - Compare the student's answer (canvas work and/or multiple-choice selection) to the provided correct answer.
    - Consider if the student's answer, while different from the provided correct answer, demonstrates a valid conceptual understanding or an alternative correct solution.
    - If both canvas and multiple-choice are used, analyze if they are consistent with each other.
    3. For evaluation:
    - Provide a numerical evaluation from 1 to 10, where 1 is completely incorrect and 10 is perfectly correct.
    - Consider conceptual understanding and creativity in problem-solving, not just matching the provided answer.
    4. For feedback:
    - Provide feedback appropriate for a 5-6 year old student.
    - Address their answer and any work shown on the canvas.
    - If their answer differs from the provided correct answer but demonstrates valid understanding, acknowledge and praise this.
    - If the answer is incorrect, explain why gently and guide them towards understanding.
    - Offer encouragement and positive reinforcement for their effort, creativity, and any correct aspects of their answer.
        
    Return your review in this EXACT JSON format WITHOUT any markdown formatting or code blocks:
    {json_format_template}"""
            
            # Format prompt with image for the AI service
            prompt = [{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": solution_image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt_text
                    }
                ]
            }]

            print("Sending review request to AI service...")
            try:
                response = await ai_service.generate_response(
                    prompt=prompt,
                    system_instructions=system_instructions
                )
                print("Received response from AI service")
            except Exception as e:
                print(f"Error with AI review: {str(e)}")
                
                # Try with a different AI service as fallback
                try:
                    # Determine the alternate service type to try
                    alternate_service_type = "gemini" if self._current_ai_service_type in ["anthropic", "claude"] else "anthropic"
                    print(f"[INFO] Attempting fallback to {alternate_service_type} service for review")
                    
                    # Cache the original service type
                    original_service_type = self._current_ai_service_type
                    
                    # Try with the alternate service
                    self.set_ai_service(alternate_service_type)
                    
                    # Attempt the review again
                    response = await ai_service.generate_response(
                        prompt=prompt,
                        system_instructions=system_instructions
                    )
                    
                    # If we get here, the fallback worked - restore the original preference
                    self.set_ai_service(original_service_type)
                except Exception as fallback_error:
                    print(f"[ERROR] Fallback also failed for review: {fallback_error}")
                    raise  # Re-raise to be caught by the outer try/except
            
            # Parse the response using the robust approach similar to _parse_problem
            structured_review = await self._parse_json_response(response)
            
            if not structured_review:
                # Handle parsing failure with default error response
                error_response = {
                    "error": "Error parsing review response",
                    "observation": {
                        "canvas_description": "Error occurred during review",
                        "selected_answer": "",
                        "work_shown": ""
                    },
                    "analysis": {
                        "understanding": "Error occurred during review",
                        "approach": "",
                        "accuracy": "",
                        "creativity": ""
                    },
                    "evaluation": {
                        "score": 0,
                        "justification": "Error occurred"
                    },
                    "feedback": {
                        "praise": "",
                        "guidance": "",
                        "encouragement": "I'm sorry, I had trouble reviewing your work. Let's try again!",
                        "next_steps": ""
                    },
                    "skill_id": skill_id,
                    "subject": subject,
                    "subskill_id": subskill_id or problem.get("metadata", {}).get("subskill", {}).get("id", "")
                }
                return error_response
            
            print(f"[DEBUG] Parsed JSON structure: {json.dumps(structured_review, indent=2)}")

            # Extract evaluation score and justification
            evaluation_score = 0
            evaluation_justification = ""
            
            if isinstance(structured_review.get('evaluation'), dict):
                print("[DEBUG] Found evaluation as dictionary")
                evaluation_score = float(structured_review['evaluation'].get('score', 0))
                evaluation_justification = structured_review['evaluation'].get('justification', '')
            elif isinstance(structured_review.get('evaluation'), (int, float)):
                print("[DEBUG] Found evaluation as number")
                evaluation_score = float(structured_review.get('evaluation', 0))
                
            # Add required fields for frontend compatibility
            structured_review.update({
                "skill_id": skill_id,
                "subject": subject,
                "subskill_id": subskill_id or problem.get("metadata", {}).get("subskill", {}).get("id", "")
            })
            
            # Save to CosmosDB if available
            if self.cosmos_db: 
                try:
                    # Save the full structured review
                    await self.cosmos_db.save_problem_review(
                        student_id=student_id,
                        subject=subject,
                        skill_id=skill_id,
                        subskill_id=subskill_id or problem.get("metadata", {}).get("subskill", {}).get("id", ""),
                        problem_id=problem_id,
                        review_data=structured_review,
                        problem_content=problem  # Pass the full problem object
                    )
                    print(f"[DEBUG] Successfully saved review to CosmosDB for problem {problem_id}")
                except Exception as e:
                    print(f"[ERROR] Failed to save review to CosmosDB: {str(e)}")
            
            return structured_review

        except Exception as e:
            print(f"Error in review_problem: {str(e)}")
            return {
                "error": f"Error reviewing problem: {str(e)}",
                "observation": {"canvas_description": "Error occurred during review", "selected_answer": "", "work_shown": ""},
                "analysis": {"understanding": "Error occurred during review", "approach": "", "accuracy": "", "creativity": ""},
                "evaluation": {"score": 0, "justification": "Error occurred"},
                "feedback": {"praise": "", "guidance": "", "encouragement": "I'm sorry, I had trouble reviewing your work. Let's try again!", "next_steps": ""},
                "skill_id": skill_id,
                "subject": subject,
                "subskill_id": subskill_id or problem.get("metadata", {}).get("subskill", {}).get("id", "")
            }

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
                
    async def save_problem_attempt(
        self, 
        student_id: int, 
        problem: Dict[str, Any],
        student_answer: str,
        is_correct: bool
    ) -> None:
        """Save a student's problem attempt"""
        # Save to CosmosDB if available
        if self.cosmos_db:
            try:
                # Format the attempt data
                attempt_data = {
                    "student_id": student_id,
                    "subject": problem.get("metadata", {}).get("subject", "unknown"),
                    "skill_id": problem.get("metadata", {}).get("skill", {}).get("id", "unknown"),
                    "subskill_id": problem.get("metadata", {}).get("subskill", {}).get("id", "unknown"),
                    "score": 10.0 if is_correct else 0.0,  # Simple binary scoring
                    "analysis": "Automatic assessment",
                    "feedback": "Automatically scored attempt"
                }
                
                # Save to CosmosDB
                await self.cosmos_db.save_attempt(**attempt_data)
                print(f"[DEBUG] Saved attempt to CosmosDB for student {student_id}")
                
            except Exception as e:
                print(f"[ERROR] Failed to save attempt to CosmosDB: {str(e)}")
                # Fall back to in-memory storage
        
        # Always save to in-memory storage as well
        if student_id not in self._problem_history:
            self._problem_history[student_id] = []
            
        self._problem_history[student_id].append({
            'problem': problem,
            'student_answer': student_answer,
            'is_correct': is_correct,
            'timestamp': datetime.utcnow().isoformat()
        })