from typing import Dict, Any, List, Optional
from datetime import datetime

# Don't import directly anymore, they will be injected
# from .anthropic import AnthropicService
# from .competency import CompetencyService
# from .recommender import ProblemRecommender

class ProblemService:
    def __init__(self):
        # Dependencies will be injected - don't initialize here
        self.anthropic = None  # Will be set by dependency injection
        self.competency_service = None  # Will be set by dependency injection
        self.recommender = None  # Will be set by dependency injection
        self.cosmos_db = None  # Will be set by dependency injection
        self._problem_history = {}  # In-memory storage for now

    async def get_problem(
        self,
        student_id: int,
        subject: str,
        context: Optional[Dict] = None
    ) -> Optional[Dict[str, Any]]:
        """Get problem with context awareness and detailed learning objectives"""
        try:
            print(f"[DEBUG] Getting problem with context: {context}")
            
            # Ensure anthropic service is available
            if not self.anthropic:
                print("[ERROR] AnthropicService not initialized")
                return None
                
            # Ensure recommender is available
            if not self.recommender:
                print("[ERROR] ProblemRecommender not initialized")
                return None
                
            # Ensure competency_service is available
            if not self.competency_service:
                print("[ERROR] CompetencyService not initialized")
                return None
            
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
            
            # Now awaiting the async parse method
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
            return None

    # The rest of the methods remain largely the same
    # Only adding dependency checks at the beginning of any method that uses the dependencies

    async def get_problem_with_session_data(
        self,
        student_id: int,
        subject: str,
        session_recommendation: Dict[str, Any],
        session_objectives: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Optimized get_problem that uses pre-loaded session data"""
        try:
            # Ensure anthropic service is available
            if not self.anthropic:
                print("[ERROR] AnthropicService not initialized")
                return None
                
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
            return None

    async def generate_problem(
            self,
            subject: str,
            recommendation: Dict[str, Any]
        ) -> Optional[str]:
            """Generate problem text using AI model"""
            try:
                # Ensure anthropic service is available
                if not self.anthropic:
                    print("[ERROR] AnthropicService not initialized")
                    return None
                    
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
                
                response = await self.anthropic.generate_response(
                    prompt=prompt,
                    system_instructions="You are an expert kindergarten teacher specialized in creating engaging, age-appropriate problems that promote active learning and critical thinking."
                )
                
                print(f"[DEBUG] Got response: {response}")
                return response
                
            except Exception as e:
                print(f"[ERROR] Error generating problem: {str(e)}")
                import traceback
                traceback.print_exc()
                return None

    async def _parse_problem(self, raw_problem: str) -> Dict[str, Any]:
        """Parse the AI response from JSON into a structured problem object."""
        try:
            import json
            from asyncio import to_thread  # For CPU-intensive operations
            
            # Move the intensive parsing operations to a thread pool
            try:
                problem_data = json.loads(raw_problem)
            except json.JSONDecodeError as e:
                print(f"[ERROR] Failed to parse JSON: {str(e)}")
                return None
            
            # Validate that all required fields are present and non-empty
            required_fields = ['problem_type', 'problem', 'answer', 'success_criteria', 'teaching_note']
            missing_fields = [field for field in required_fields if not problem_data.get(field)]
            
            if missing_fields:
                print(f"[ERROR] Missing required fields: {missing_fields}")
                return None
                
            if not isinstance(problem_data['success_criteria'], list):
                print("[ERROR] Success criteria must be a list")
                return None
                
            print(f"[DEBUG] Successfully parsed problem data: {problem_data}")
            
            return problem_data

        except Exception as e:
            print(f"[ERROR] Error in _parse_problem: {str(e)}")
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
            # Ensure anthropic service is available
            if not self.anthropic:
                print("[ERROR] AnthropicService not initialized")
                return {"error": "AnthropicService not initialized"}
                
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
        
    Return your review in this EXACT JSON format:
    {json_format_template}"""
            
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

            print("Sending review request to Claude...")
            response = await self.anthropic.generate_response(
                prompt=prompt,
                system_instructions=system_instructions
            )
            
            print("Received response from Claude")
            
            try:
                # Parse JSON response
                import json
                structured_review = json.loads(response)
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
                        print(f"[DEBUG] {problem}")
                    except Exception as e:
                        print(f"[ERROR] Failed to save review to CosmosDB: {str(e)}")
                
                return structured_review

            except json.JSONDecodeError as e:
                print(f"Error parsing JSON response: {str(e)}")
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