from typing import Dict, Any, List, Optional
from datetime import datetime
from .anthropic import AnthropicService
from .competency import CompetencyService
from .recommender import ProblemRecommender

class ProblemService:
    def __init__(self, competency_service: CompetencyService,recommender: ProblemRecommender,):
        self.anthropic = AnthropicService()
        self._problem_history = {}  # In-memory storage for now
        self.competency_service = competency_service
        self.recommender = recommender

    async def get_problem(
        self,
        student_id: int,
        subject: str,
        context: Optional[Dict] = None
    ) -> Optional[Dict[str, Any]]:
        """Get problem with context awareness and detailed learning objectives"""
        try:
            print(f"[DEBUG] Getting problem with context: {context}")
            
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
            objectives = self.competency_service.get_detailed_objectives(
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
            
            problem_data = self._parse_problem(raw_problem)
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

    async def generate_problem(
            self,
            subject: str,
            recommendation: Dict[str, Any]
        ) -> Optional[str]:
            """Generate problem text using AI model"""
            try:
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

    Format response as:
    Problem Type: [Selected from the list above]
    Problem: [2-3 concise sentences]
    Answer: [Clear solution]
    Success Criteria:
    1. [Observable behavior showing understanding]
    2. [Observable behavior showing application]
    3. [Observable behavior showing mastery]
    Teaching Note: [Brief tip about common misconceptions or support strategies]"""

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

    def _parse_problem(self, raw_problem: str) -> Dict[str, Any]:
        """Parse the AI response into a structured problem object."""
        lines = raw_problem.split('\n')
        problem_data = {
            'problem_type': '',
            'problem': '',
            'answer': '',
            'success_criteria': [],
            'teaching_note': ''
        }
        
        current_section = None
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('Problem Type:'):
                problem_data['problem_type'] = line.split('Problem Type:', 1)[1].strip()
                
            elif line.startswith('Problem:'):
                problem_text = []
                j = i + 1
                while j < len(lines) and not lines[j].strip().startswith(('Answer:', 'Success Criteria:', 'Teaching Note:')):
                    if lines[j].strip():
                        problem_text.append(lines[j].strip())
                    j += 1
                problem_data['problem'] = ' '.join(problem_text)
                
            elif line.startswith('Answer:'):
                answer_text = []
                j = i + 1
                while j < len(lines) and not lines[j].strip().startswith(('Success Criteria:', 'Teaching Note:')):
                    if lines[j].strip():
                        answer_text.append(lines[j].strip())
                    j += 1
                problem_data['answer'] = ' '.join(answer_text)
                
            elif line.startswith('Success Criteria:'):
                current_section = 'success_criteria'
                
            elif line.startswith('Teaching Note:'):
                problem_data['teaching_note'] = line.split('Teaching Note:', 1)[1].strip()
                current_section = None
                
            elif current_section == 'success_criteria' and line[0].isdigit():
                criterion = line.split('.', 1)[1].strip()
                problem_data['success_criteria'].append(criterion)
        print(problem_data)
        return problem_data

    async def get_student_history(self, student_id: int) -> List[Dict[str, Any]]:
        """Get history of problems attempted by a student"""
        if student_id not in self._problem_history:
            return []
        return self._problem_history[student_id]

    async def review_problem(
            self,
            subject: str,
            problem: str,
            solution_image_base64: str,
            skill_id: str,
            student_answer: str = "",
            canvas_used: bool = True
        ) -> Dict[str, Any]:
            """Review a student's problem solution"""
            try:
                print(f"Review problem called with image data length: {len(solution_image_base64)}")
                
                system_instructions = """You are an expert kindergarten teacher skilled at reviewing student work.
                Focus on:
                1. Clear, simple language
                2. Positive reinforcement
                3. Age-appropriate feedback
                4. Encouraging growth mindset
                5. Specific, actionable guidance
                """

                # Create the prompt in the correct format
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
                            "text": f"""Review this {subject} problem and the student's solution:

    Problem: {problem}

Please follow these steps:
1. In <observation> tags:
   - If there's a canvas solution, describe what you see in the image.
   - If there's a multiple-choice answer, state the selected option.
2. In <analysis> tags:
   - Compare the student's answer (canvas work and/or multiple-choice selection) to the provided correct answer.
   - Consider if the student's answer, while different from the provided correct answer, demonstrates a valid conceptual understanding or an alternative correct solution.
   - If both canvas and multiple-choice are used, analyze if they are consistent with each other.
3. In <evaluation> tags:
   - Provide a numerical evaluation from 1 to 10, where 1 is completely incorrect and 10 is perfectly correct.
   - Consider conceptual understanding and creativity in problem-solving, not just matching the provided answer.
4. In <feedback> tags:
   - Provide feedback appropriate for a 5-6 year old student.
   - Address their answer and any work shown on the canvas.
   - If their answer differs from the provided correct answer but demonstrates valid understanding, acknowledge and praise this.
   - If the answer is incorrect, explain why gently and guide them towards understanding.
   - Offer encouragement and positive reinforcement for their effort, creativity, and any correct aspects of their answer.
      
   Begin your response with "I've carefully examined the student's answer and work. Here's my review:"""
                        }
                    ]
                }]

                print("Sending review request to Claude...")
                response = await self.anthropic.generate_response(
                    prompt=prompt,  # Pass as prompt parameter
                    system_instructions=system_instructions
                )
                
                print("Received response from Claude")
                
                # Extract parts from response using regex
                import re
                observation = re.search(r'<observation>(.*?)</observation>', response, re.DOTALL)
                analysis = re.search(r'<analysis>(.*?)</analysis>', response, re.DOTALL)
                evaluation = re.search(r'<evaluation>(.*?)</evaluation>', response, re.DOTALL)
                feedback = re.search(r'<feedback>(.*?)</feedback>', response, re.DOTALL)

                structured_review = {
                    "observation": observation.group(1).strip() if observation else "No observation available",
                    "analysis": analysis.group(1).strip() if analysis else "No analysis available",
                    "evaluation": 0,
                    "feedback": feedback.group(1).strip() if feedback else "No feedback available",
                    "skill_id": skill_id,
                    "subject": subject
                }

                # Parse evaluation score
                if evaluation:
                    try:
                        eval_text = evaluation.group(1).strip()
                        eval_number = re.search(r'\d+', eval_text)
                        if eval_number:
                            structured_review["evaluation"] = int(eval_number.group())
                    except ValueError:
                        print("Warning: Could not parse evaluation score")

                return structured_review

            except Exception as e:
                print(f"Error in review_problem: {str(e)}")
                return {
                    "error": f"Error reviewing problem: {str(e)}",
                    "observation": "Error occurred during review",
                    "analysis": "Error occurred during review",
                    "evaluation": 0,
                    "feedback": "I'm sorry, I had trouble reviewing your work. Let's try again!",
                    "skill_id": skill_id,
                    "subject": subject
                }
            
    async def save_problem_attempt(
        self, 
        student_id: int, 
        problem: Dict[str, Any],
        student_answer: str,
        is_correct: bool
    ) -> None:
        """Save a student's problem attempt"""
        if student_id not in self._problem_history:
            self._problem_history[student_id] = []
            
        self._problem_history[student_id].append({
            'problem': problem,
            'student_answer': student_answer,
            'is_correct': is_correct,
            'timestamp': datetime.utcnow().isoformat()
        })