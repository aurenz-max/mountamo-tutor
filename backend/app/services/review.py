# review_service.py
from typing import Dict, Any, Optional
import json
import re
from datetime import datetime
from .base_ai_service import BaseAIService
from .ai_service_factory import AIServiceFactory

class ReviewService:
    def __init__(self):
        self.cosmos_db = None  # Will be set by dependency injection
        self._current_ai_service_type = None  # Will be set based on config
        self.ai_service = None  # Current AI service instance
        
    def set_ai_service(self, service_type: str) -> None:
        """Set the AI service to use for reviews"""
        self._current_ai_service_type = service_type
        self.ai_service = AIServiceFactory.get_service(service_type)
        print(f"[INFO] Review service set to use: {service_type}")
        
    def get_current_ai_service(self) -> BaseAIService:
        """Get the current AI service based on the set service type"""
        if not self.ai_service:
            if not self._current_ai_service_type:
                # Use the default from settings if not explicitly set
                from ..core.config import settings
                self._current_ai_service_type = getattr(settings, "DEFAULT_AI_REVIEW_SERVICE", "anthropic")
            self.ai_service = AIServiceFactory.get_service(self._current_ai_service_type)
        return self.ai_service
        
    async def review_problem(
        self,
        student_id: int,
        subject: str,
        problem: Dict[str, Any],
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
                    from ..core.config import settings
                    default_review_service = getattr(settings, "DEFAULT_AI_REVIEW_SERVICE", "anthropic")
                    current_service = self._current_ai_service_type or default_review_service
                    
                    # Choose a different service than the current one
                    alternate_service_type = "gemini" if current_service in ["anthropic", "claude"] else "anthropic"
                    print(f"[INFO] Attempting fallback to {alternate_service_type} service for review")
                    
                    # Cache the original service type
                    original_service_type = self._current_ai_service_type
                    
                    # Try with the alternate service
                    self.set_ai_service(alternate_service_type)
                    
                    # Attempt the review again
                    response = await self.ai_service.generate_response(
                        prompt=prompt,
                        system_instructions=system_instructions
                    )
                    
                    # If we get here, the fallback worked - restore the original preference
                    self.set_ai_service(original_service_type)
                except Exception as fallback_error:
                    print(f"[ERROR] Fallback also failed for review: {fallback_error}")
                    raise  # Re-raise to be caught by the outer try/except
            
            # Parse the response using the robust approach
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
                    # Create default empty sections
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
        """Save a student's problem attempt with simplified scoring"""
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