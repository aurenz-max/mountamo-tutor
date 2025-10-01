# review_service.py
from typing import Dict, Any, Optional
import json
import re
import base64
import logging
from datetime import datetime
from google import genai
from google.genai.types import GenerateContentConfig, Content, Part, Blob
from google.genai import types
from .base_ai_service import BaseAIService
from .ai_service_factory import AIServiceFactory
from ..generators.content_schemas import PROBLEM_REVIEW_SCHEMA
from ..core.config import settings
from ..db.firestore_service import FirestoreService

logger = logging.getLogger(__name__)

class ReviewService:
    def __init__(self):
        self.cosmos_db = None  # Will be set by dependency injection
        self.firestore_service = None  # Will be set by dependency injection
        # Initialize Gemini client directly (similar to practice problems generator)
        try:
            self.client = genai.Client(
                api_key=settings.GEMINI_GENERATE_KEY,
                http_options={"api_version": "v1alpha"},
            )
            self.model_id = 'gemini-2.5-flash-preview-05-20'
            logger.info("Review service initialized with Gemini Flash")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client for review service: {str(e)}")
            # Fallback to AI service factory approach if direct Gemini fails
            self._current_ai_service_type = None
            self.ai_service = None
            self.client = None
        
    def set_ai_service(self, service_type: str) -> None:
        """Set the AI service to use for reviews (fallback method)"""
        self._current_ai_service_type = service_type
        self.ai_service = AIServiceFactory.get_service(service_type)
        print(f"[INFO] Review service set to use: {service_type}")
        
    def get_current_ai_service(self) -> BaseAIService:
        """Get the current AI service based on the set service type (fallback method)"""
        if not self.ai_service:
            if not self._current_ai_service_type:
                # Use Gemini Flash as the default for review service (better JSON formatting)
                from ..core.config import settings
                self._current_ai_service_type = getattr(settings, "DEFAULT_AI_REVIEW_SERVICE", "gemini")
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
        """Review a student's problem solution using Gemini Flash with structured JSON"""
        try:
            # Ensure cosmos_db service is available
            if not self.cosmos_db:
                logger.warning("CosmosDB service not initialized, review will not be saved")
                
            logger.info(f"Review problem called with image data length: {len(solution_image_base64)}")
            
            if not solution_image_base64:
                logger.error("No image data received!")
                return self._create_error_response(Exception("No image data provided"), skill_id, subject, subskill_id, problem)
            
            problem_id = problem.get("id", f"{subject}_{skill_id}_{datetime.utcnow().isoformat()}")
            problem_text = problem.get('problem', '')
            correct_answer = problem.get('answer', '')
            
            # Create the prompt for structured review
            prompt_text = f"""You are an expert kindergarten teacher reviewing a student's work. 

PROBLEM DETAILS:
- Subject: {subject}
- Problem: {problem_text}
- Correct Answer: {correct_answer}
- Student also provided: {student_answer if student_answer else 'No additional text answer'}

REVIEW INSTRUCTIONS:
1. Look carefully at the image showing the student's work (canvas drawing/writing)
2. Observe what the student drew, wrote, or selected
3. Analyze their understanding and approach
4. Compare their work to the correct answer
5. Provide encouraging, age-appropriate feedback for a 5-6 year old

Focus on:
- Positive reinforcement and encouragement
- Clear, simple language appropriate for kindergarten
- Recognizing effort and creativity
- Gentle guidance for improvement
- Building confidence and growth mindset

Evaluate the student's work holistically, considering both correctness and understanding demonstrated."""

            # Use Gemini Flash with structured JSON response
            if self.client:
                try:
                    # Decode the base64 image
                    image_bytes = base64.b64decode(solution_image_base64)
                    logger.info(f"Decoded image size: {len(image_bytes)} bytes")
                    
                    contents = [
                        types.Part.from_bytes(
                            mime_type="image/png",
                            data=image_bytes
                        ),
                        prompt_text  # Direct string, no need for Part.from_text
                    ]
                    
                    logger.info("Sending review request to Gemini Flash with structured JSON...")
                    
                    # Generate response with structured JSON schema
                    response = await self.client.aio.models.generate_content(
                        model=f'models/{self.model_id}',
                        contents=contents,
                        config=GenerateContentConfig(
                            response_mime_type='application/json',
                            response_schema=PROBLEM_REVIEW_SCHEMA,
                            temperature=0.6,
                            max_output_tokens=2048
                        )
                    )
                    
                    logger.info("Received structured response from Gemini Flash")
                    
                    # Parse the JSON response directly
                    if response and response.candidates and response.candidates[0].content.parts:
                        response_text = response.candidates[0].content.parts[0].text.strip()
                        structured_review = json.loads(response_text)
                        logger.debug(f"Successfully parsed structured JSON: {json.dumps(structured_review, indent=2)}")
                    else:
                        raise Exception("Empty response from Gemini")
                        
                except Exception as e:
                    logger.error(f"Error with Gemini Flash structured review: {str(e)}")
                    # Fall back to the old AI service approach
                    return await self._fallback_review(problem, solution_image_base64, skill_id, subskill_id, student_id, subject)
            else:
                # Use fallback AI service approach if Gemini client not available
                return await self._fallback_review(problem, solution_image_base64, skill_id, subskill_id, student_id, subject)
            
            # Add required fields for frontend compatibility
            structured_review.update({
                "skill_id": skill_id,
                "subject": subject,
                "subskill_id": subskill_id or problem.get("metadata", {}).get("subskill", {}).get("id", ""),
                "score": structured_review.get("evaluation", {}).get("score", 0),
                "correct": structured_review.get("evaluation", {}).get("score", 0) >= 7,  # Consider 7+ as correct
                "accuracy_percentage": structured_review.get("evaluation", {}).get("score", 0) * 10  # Convert to percentage
            })
            
            # Save to both CosmosDB and Firestore (dual write for migration)
            cosmos_success = False
            firestore_success = False
            
            # Save to CosmosDB
            if self.cosmos_db: 
                try:
                    await self.cosmos_db.save_problem_review(
                        student_id=student_id,
                        subject=subject,
                        skill_id=skill_id,
                        subskill_id=subskill_id or problem.get("metadata", {}).get("subskill", {}).get("id", ""),
                        problem_id=problem_id,
                        review_data=structured_review,
                        problem_content=problem
                    )
                    cosmos_success = True
                    logger.info(f"Successfully saved review to CosmosDB for problem {problem_id}")
                except Exception as e:
                    logger.error(f"Failed to save review to CosmosDB: {str(e)}")
            
            # Save to Firestore
            if self.firestore_service:
                try:
                    await self.firestore_service.save_problem_review(
                        student_id=student_id,
                        subject=subject,
                        skill_id=skill_id,
                        subskill_id=subskill_id or problem.get("metadata", {}).get("subskill", {}).get("id", ""),
                        problem_id=problem_id,
                        review_data=structured_review,
                        problem_content=problem
                    )
                    firestore_success = True
                    logger.info(f"Successfully saved review to Firestore for problem {problem_id}")
                except Exception as e:
                    logger.error(f"Failed to save review to Firestore: {str(e)}")
            
            # Log dual write results
            if cosmos_success and firestore_success:
                logger.info(f"Dual write successful for review {problem_id}")
            elif cosmos_success:
                logger.warning(f"Only CosmosDB write successful for review {problem_id}")
            elif firestore_success:
                logger.warning(f"Only Firestore write successful for review {problem_id}")
            else:
                logger.error(f"Both writes failed for review {problem_id}")
            
            return structured_review

        except Exception as e:
            logger.error(f"Error in review_problem: {str(e)}")
            return self._create_error_response(e, skill_id, subject, subskill_id, problem)
    
    def _create_error_response(self, error: Exception, skill_id: str, subject: str, subskill_id: str, problem: Dict[str, Any]) -> Dict[str, Any]:
        """Create a standardized error response"""
        return {
            "error": f"Error reviewing problem: {str(error)}",
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
                "justification": "Error occurred during processing"
            },
            "feedback": {
                "praise": "",
                "guidance": "",
                "encouragement": "I'm sorry, I had trouble reviewing your work. Let's try again!",
                "next_steps": ""
            },
            "skill_id": skill_id,
            "subject": subject,
            "subskill_id": subskill_id or problem.get("metadata", {}).get("subskill", {}).get("id", ""),
            "score": 0,
            "correct": False,
            "accuracy_percentage": 0
        }
    
    async def _fallback_review(self, problem: Dict[str, Any], solution_image_base64: str, 
                              skill_id: str, subskill_id: str, student_id: int, subject: str) -> Dict[str, Any]:
        """Fallback to the original AI service approach if Gemini fails"""
        try:
            logger.info("Using fallback AI service for review")
            ai_service = self.get_current_ai_service()
            
            problem_text = problem.get('problem', '')
            system_instructions = """You are an expert kindergarten teacher skilled at reviewing student work.
            Focus on positive reinforcement, age-appropriate feedback, and encouraging growth mindset.
            Respond with valid JSON only."""

            prompt_text = f"""Review this {subject} problem and the student's solution:
Problem: {problem_text}

Provide detailed, encouraging feedback in the following JSON format:
{{
    "observation": {{
        "canvas_description": "Describe what you see in the student's work",
        "selected_answer": "Any answer they selected",
        "work_shown": "Additional work shown"
    }},
    "analysis": {{
        "understanding": "Their conceptual understanding",
        "approach": "Their problem-solving approach", 
        "accuracy": "Comparison to correct answer",
        "creativity": "Any creative solutions"
    }},
    "evaluation": {{
        "score": 5.0,
        "justification": "Brief score explanation"
    }},
    "feedback": {{
        "praise": "What they did well",
        "guidance": "Suggestions for improvement",
        "encouragement": "Positive message",
        "next_steps": "What to try next"
    }}
}}"""
            
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

            response = await ai_service.generate_response(
                prompt=prompt,
                system_instructions=system_instructions
            )
            
            # Parse the response
            structured_review = await self._parse_json_response(response)
            if not structured_review:
                return self._create_error_response(Exception("Failed to parse fallback response"), skill_id, subject, subskill_id, problem)
                
            return structured_review
            
        except Exception as e:
            logger.error(f"Fallback review also failed: {str(e)}")
            return self._create_error_response(e, skill_id, subject, subskill_id, problem)
            
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

    async def analyze_misconception(
        self,
        question: Any,  # Question object from question_types
        evaluation: Any  # QuestionEvaluation object
    ) -> Optional[str]:
        """
        Analyzes an incorrect submission to diagnose the root misconception.

        This method uses AI to perform root-cause analysis of a student's error,
        identifying their specific conceptual misunderstanding (not just explaining
        the correct answer).

        Args:
            question: Standardized Question object with question_text and correct_answer
            evaluation: QuestionEvaluation object with student_answer, correct_answer, feedback

        Returns:
            A concise string describing the student's misconception, or None if analysis fails
        """
        try:
            logger.info(f"🧠 [MISCONCEPTION_ANALYSIS] ========== AI MISCONCEPTION ANALYSIS START ==========")
            logger.info(f"🧠 [MISCONCEPTION_ANALYSIS] Analyzing student's incorrect answer to diagnose root cause")
            logger.info(f"🧠 [MISCONCEPTION_ANALYSIS] Question type: {question.type}")

            # Extract data from standardized objects
            question_text = question.question_text
            correct_answer = evaluation.correct_answer
            student_answer = evaluation.student_answer
            feedback = evaluation.feedback

            logger.info(f"📋 [MISCONCEPTION_ANALYSIS] Question: {question_text[:100] if question_text else 'N/A'}...")
            logger.info(f"✅ [MISCONCEPTION_ANALYSIS] Correct answer: {correct_answer[:100] if correct_answer else 'N/A'}")
            logger.info(f"❌ [MISCONCEPTION_ANALYSIS] Student's incorrect answer: {student_answer[:100] if student_answer else 'N/A'}...")
            logger.info(f"💬 [MISCONCEPTION_ANALYSIS] Initial feedback: {feedback[:100] if feedback else 'N/A'}...")

            # Build the diagnostic prompt
            logger.info(f"🔧 [MISCONCEPTION_ANALYSIS] Building AI diagnostic prompt...")
            prompt = f"""You are an expert learning diagnostician for young children (ages 5-6). Your task is to analyze an incorrect answer and determine the specific conceptual misunderstanding. Do not provide generic feedback. Pinpoint the root cause of the error.

**Problem Context:**
- Question: "{question_text}"
- Correct Answer: "{correct_answer}"

**Student's Submission:**
- Student's Incorrect Answer: "{student_answer}"
- Initial Feedback Given: "{feedback}"

**Your Task:**
Based on all the information above, what is the student's core misconception? Describe the misunderstanding in a single, concise sentence from the student's point of view if possible.

**Examples of Good Misconception Diagnoses:**
- "The student likely thinks 'fewer' means the smaller number, not the difference between numbers."
- "The student correctly identified the numbers but confused the '+' symbol with the '-' symbol."
- "The student is only counting the items in the last group mentioned, not all the items combined."
- "The student seems to believe all sides of a rectangle must be the same length."

**Output Format:**
Your response MUST be a single JSON object with one key: "misconception_text".

{{
  "misconception_text": "YOUR_DIAGNOSIS_HERE"
}}
"""

            # Use Gemini client for misconception analysis
            if self.client:
                try:
                    logger.info(f"🚀 [MISCONCEPTION_ANALYSIS] Sending diagnostic request to Gemini AI (model: {self.model_id})...")

                    # Define JSON schema for response
                    response_schema = {
                        "type": "object",
                        "properties": {
                            "misconception_text": {"type": "string"}
                        },
                        "required": ["misconception_text"]
                    }

                    # Generate response with structured JSON
                    response = await self.client.aio.models.generate_content(
                        model=f'models/{self.model_id}',
                        contents=[prompt],
                        config=GenerateContentConfig(
                            response_mime_type='application/json',
                            response_schema=response_schema,
                            temperature=0.7,
                            max_output_tokens=512
                        )
                    )

                    logger.info(f"📥 [MISCONCEPTION_ANALYSIS] Received response from Gemini AI")

                    # Parse the JSON response
                    if response and response.candidates and response.candidates[0].content.parts:
                        response_text = response.candidates[0].content.parts[0].text.strip()
                        logger.info(f"📄 [MISCONCEPTION_ANALYSIS] Raw response: {response_text[:200]}...")

                        response_data = json.loads(response_text)
                        misconception_text = response_data.get("misconception_text")

                        if misconception_text:
                            logger.info(f"🎯 [MISCONCEPTION_ANALYSIS] ========== AI DIAGNOSIS COMPLETE ==========")
                            logger.info(f"🎯 [MISCONCEPTION_ANALYSIS] Student-specific misconception identified:")
                            logger.info(f"🎯 [MISCONCEPTION_ANALYSIS] \"{misconception_text}\"")
                            logger.info(f"🎯 [MISCONCEPTION_ANALYSIS] This describes WHY the student got it wrong, not WHAT the right answer is")
                            return misconception_text
                        else:
                            logger.warning(f"⚠️ [MISCONCEPTION_ANALYSIS] AI returned empty misconception_text")
                            logger.warning(f"⚠️ [MISCONCEPTION_ANALYSIS] Response data: {response_data}")
                            return None
                    else:
                        logger.warning(f"⚠️ [MISCONCEPTION_ANALYSIS] Empty or invalid response structure from Gemini")
                        logger.warning(f"⚠️ [MISCONCEPTION_ANALYSIS] Response: {response}")
                        return None

                except json.JSONDecodeError as e:
                    logger.error(f"❌ [MISCONCEPTION_ANALYSIS] Failed to parse JSON response: {str(e)}")
                    logger.error(f"❌ [MISCONCEPTION_ANALYSIS] Raw response text: {response_text if 'response_text' in locals() else 'N/A'}")
                    return None
                except Exception as e:
                    logger.error(f"❌ [MISCONCEPTION_ANALYSIS] Error calling Gemini API: {str(e)}")
                    import traceback
                    logger.error(f"❌ [MISCONCEPTION_ANALYSIS] Traceback: {traceback.format_exc()}")
                    return None
            else:
                logger.error(f"❌ [MISCONCEPTION_ANALYSIS] Gemini client not initialized - cannot perform AI analysis")
                return None

        except Exception as e:
            logger.error(f"❌ [MISCONCEPTION_ANALYSIS] Unexpected error in analyze_misconception: {str(e)}")
            import traceback
            logger.error(f"❌ [MISCONCEPTION_ANALYSIS] Traceback: {traceback.format_exc()}")
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
                
                # Save to both CosmosDB and Firestore (dual write)
                cosmos_success = False
                firestore_success = False
                
                # Save to CosmosDB
                try:
                    await self.cosmos_db.save_attempt(**attempt_data)
                    cosmos_success = True
                    print(f"[DEBUG] Saved attempt to CosmosDB for student {student_id}")
                except Exception as e:
                    print(f"[ERROR] Failed to save attempt to CosmosDB: {str(e)}")
                
                # Save to Firestore
                if self.firestore_service:
                    try:
                        await self.firestore_service.save_attempt(**attempt_data)
                        firestore_success = True
                        print(f"[DEBUG] Saved attempt to Firestore for student {student_id}")
                    except Exception as e:
                        print(f"[ERROR] Failed to save attempt to Firestore: {str(e)}")
                
                # Log dual write results
                if cosmos_success and firestore_success:
                    logger.info(f"Dual write successful for attempt by student {student_id}")
                elif cosmos_success:
                    logger.warning(f"Only CosmosDB write successful for attempt by student {student_id}")
                elif firestore_success:
                    logger.warning(f"Only Firestore write successful for attempt by student {student_id}")
                else:
                    logger.error(f"Both writes failed for attempt by student {student_id}")
                
            except Exception as e:
                print(f"[ERROR] Failed to save attempt: {str(e)}")
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