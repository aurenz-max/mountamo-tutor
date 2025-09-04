# backend/app/core/generators/practice_problems.py
import json
import logging
from datetime import datetime
from typing import Dict, Any
from google.genai.types import GenerateContentConfig

from .base_generator import BaseContentGenerator
from .content import ContentGenerationRequest, MasterContext, ContentComponent, ComponentType
from .content_schemas import PRACTICE_PROBLEMS_SCHEMA

logger = logging.getLogger(__name__)


class PracticeProblemsGenerator(BaseContentGenerator):
    """Generator for practice problems and assessments"""
    
    async def generate_practice_problems(
        self, 
        request: ContentGenerationRequest,
        master_context: MasterContext,
        reading_comp: ContentComponent,
        visual_comp: ContentComponent,
        package_id: str
    ) -> ContentComponent:
        """Generate practice problems integrating all content - UPDATED WITH GRADE"""
        
        reading_concepts = [concept for section in reading_comp.content.get('sections', []) 
                          for concept in section.get('concepts_covered', [])]
        visual_elements = visual_comp.content.get('interactive_elements', [])
        grade_info = self._extract_grade_info(request)
        
        prompt = f"""
        Create a diverse set of high-quality practice problems for {grade_info} students learning {request.subskill} that integrate multiple learning modes.

        Target Audience: {grade_info} students
        Subject: {request.subject}

        Master Context:
        Key Terms: {', '.join(master_context.key_terminology.keys())}
        Learning Objectives: {', '.join(master_context.learning_objectives)}

        Content Integration:
        Reading covered: {', '.join(reading_concepts)}        

        ### PRACTICE PROBLEM PRIMITIVES (Choose the best types for your material):
        
        **PRIORITIZE THESE for comprehensive assessment and engagement:**
        - **multiple_choice**: 4-6 option questions - excellent for testing comprehension of facts, concepts, and procedures. Great for quick assessment of knowledge retention
        - **true_false**: Statement evaluation with rationale - perfect for testing understanding of key principles, identifying misconceptions, and reinforcing correct understanding
        - **fill_in_blanks**: Interactive sentences with missing key terms - ideal for vocabulary reinforcement, concept application, and testing specific knowledge points
        - **matching_activity**: Connect related items (terms-definitions, causes-effects, examples-concepts) - great for building relationships between ideas and testing comprehension
        - **sequencing_activity**: Arrange items in correct chronological or logical order - perfect for processes, procedures, timelines, or step-by-step understanding
        - **categorization_activity**: Sort items into appropriate groups - excellent for classification skills, understanding relationships, and organizing knowledge
        - **scenario_question**: Real-world application problems with detailed scenarios - ideal for connecting theory to practice, critical thinking, and demonstrating practical understanding
        - **short_answer**: Open-ended questions requiring brief explanations - great for testing deeper understanding and application of concepts

        ### PROBLEM SELECTION STRATEGY:
        Choose problem types based on your material:
        - **Factual content**: Use multiple_choice, true_false, fill_in_blanks
        - **Conceptual relationships**: Use matching_activity, categorization_activity
        - **Procedures/processes**: Use sequencing_activity, fill_in_blanks, scenario_question
        - **Application/critical thinking**: Use scenario_question, short_answer
        - **Vocabulary/terminology**: Use fill_in_blanks, matching_activity, true_false

        Generate 8-10 problems that:
        1. Use a MIX of problem types appropriate for the content and {grade_info} level
        2. Progress from basic knowledge to application suitable for {grade_info}
        3. Test understanding of key terms using {grade_info} appropriate language
        4. Include real-world applications relevant to {grade_info} experience
        5. Reference content from reading and visual materials appropriately
        6. Have clear, age-appropriate instructions and language
        7. Include encouraging, positive success criteria
        8. Provide educational value beyond just assessment

        Grade-specific considerations for {grade_info}:
        - Use vocabulary and sentence structures appropriate for {grade_info}
        - Include visual or concrete examples when possible
        - Make instructions clear and step-by-step
        - Use familiar contexts and scenarios
        - Choose problem types that match cognitive development level
        - Provide positive, encouraging feedback criteria

        ### OUTPUT REQUIREMENTS:
        - Choose appropriate problem types from the available primitives
        - Include all required fields for chosen problem types  
        - Provide comprehensive rationale and teaching notes for each problem
        - Ensure variety in problem types to maintain engagement
        - Make each problem educationally meaningful and aligned with learning objectives
        - Generate problems as separate arrays by type (e.g., "multiple_choice": [...], "true_false": [...])
        """
        
        try:
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash-preview-05-20',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=PRACTICE_PROBLEMS_SCHEMA,
                    temperature=0.5,
                    max_output_tokens=16000
                )
            )
            
            problems_data = self._safe_json_loads(response.text, "Practice problems generation")
            
            # Convert to your required format with grade information
            formatted_problems = []
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
            
            # Handle new schema structure with separate arrays for each problem type
            problem_counter = 0
            problem_types = ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity", 
                           "sequencing_activity", "categorization_activity", "scenario_question", "short_answer"]
            
            for problem_type in problem_types:
                if problem_type in problems_data:
                    for problem in problems_data[problem_type]:
                        problem_uuid = __import__('uuid').uuid4()
                        
                        problem_id = f"{request.subject}_SKILL-{problem_counter+1:02d}_SUBSKILL-{problem_counter+1:02d}-A_{timestamp}_{problem_uuid}"
                        difficulty = round(3.0 + (problem_counter * 0.8), 1)
                        
                        # Extract the relevant problem content based on type
                        problem_content = self._extract_problem_content(problem, problem_type)
                        
                        formatted_problem = {
                            "id": problem_id,
                            "problem_id": problem_id,
                            "type": "cached_problem",
                            "subject": request.subject,
                            "skill_id": request.skill_id or "",
                            "subskill_id": request.subskill_id or "",
                            "difficulty": difficulty,
                            "timestamp": timestamp,
                            "problem_data": {
                                "problem_type": problem_type,
                                "problem": problem_content.get("problem", ""),
                                "answer": problem_content.get("answer", ""),
                                "success_criteria": problem.get("success_criteria", []),
                                "teaching_note": problem.get("teaching_note", ""),
                                "grade_level": grade_info,
                                # Include the full problem structure for frontend rendering
                                "full_problem_data": problem,
                                "metadata": {
                                    "subject": request.subject,
                                    "grade_level": grade_info,
                                    "unit": {
                                        "id": request.unit_id or f"{request.unit.upper().replace(' ', '')}001",
                                        "title": request.unit
                                    },
                                    "skill": {
                                        "id": request.skill_id or f"{request.unit.upper().replace(' ', '')}001-01",
                                        "description": request.skill
                                    },
                                    "subskill": {
                                        "id": request.subskill_id or f"{request.unit.upper().replace(' ', '')}001-01-{chr(65+problem_counter)}",
                                        "description": request.subskill
                                    },
                                    "difficulty": difficulty,
                                    "objectives": {
                                        "ConceptGroup": "Educational Content Integration",
                                        "DetailedObjective": f"Apply understanding of {request.subskill} through multi-modal learning at {grade_info} level",
                                        "SubskillDescription": request.subskill
                                    }
                                },
                                "problem_id": problem_id,
                                "id": problem_id
                            }
                        }
                        
                        formatted_problems.append(formatted_problem)
                        problem_counter += 1
            
            return ContentComponent(
                package_id=package_id,
                component_type=ComponentType.PRACTICE,
                content={
                    "problems": formatted_problems,
                    "problem_count": len(formatted_problems),
                    "estimated_time_minutes": len(formatted_problems) * 2,
                    "grade_level": grade_info
                },
                metadata={
                    "problem_count": len(formatted_problems),
                    "estimated_time": len(formatted_problems) * 2,
                    "format": "structured_problems",
                    "grade_level": grade_info
                }
            )
            
        except Exception as e:
            self._handle_generation_error("Practice problems generation", e)

    async def revise_practice_problems(
        self,
        original_content: Dict[str, Any],
        feedback: str,
        master_context: MasterContext
    ) -> Dict[str, Any]:
        """Revise practice problems based on feedback"""
        
        prompt = f"""
        Revise these practice problems based on the feedback provided.

        ORIGINAL PROBLEMS: {json.dumps(original_content, indent=2)}

        FEEDBACK TO ADDRESS: {feedback}

        REQUIREMENTS (maintain coherence):
        - Test the same key terminology: {', '.join(master_context.key_terminology.keys())}
        - Address the same learning objectives: {', '.join(master_context.learning_objectives)}
        - Maintain the same problem format and structure
        - Keep similar difficulty progression
        - Maintain problem count (around {original_content.get('problem_count', 8-10)} problems)
        
        Apply the feedback while maintaining the same educational purpose and format.
        Return the revised problems in the EXACT same JSON format as the original.
        """
        
        try:
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash-preview-05-20',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    temperature=0.5,
                    max_output_tokens=16000
                )
            )
            
            revised_content = self._safe_json_loads(response.text, "Practice problems revision")
            logger.info("Practice problems revised successfully")
            return revised_content
            
        except Exception as e:
            self._handle_generation_error("Practice problems revision", e)

    def _extract_problem_content(self, problem: Dict[str, Any], problem_type: str) -> Dict[str, str]:
        """Extract problem and answer content based on problem type"""
        
        if problem_type == "multiple_choice":
            return {
                "problem": problem.get("question", ""),
                "answer": problem.get("correct_option_id", "")
            }
        elif problem_type == "true_false":
            return {
                "problem": problem.get("statement", ""),
                "answer": str(problem.get("correct", False))
            }
        elif problem_type == "fill_in_blanks":
            return {
                "problem": problem.get("text_with_blanks", ""),
                "answer": ", ".join([", ".join(blank.get("correct_answers", [])) for blank in problem.get("blanks", [])])
            }
        elif problem_type == "matching_activity":
            return {
                "problem": problem.get("prompt", ""),
                "answer": "See mappings in full_problem_data"
            }
        elif problem_type == "sequencing_activity":
            return {
                "problem": problem.get("instruction", ""),
                "answer": ", ".join(problem.get("items", []))
            }
        elif problem_type == "categorization_activity":
            return {
                "problem": problem.get("instruction", ""),
                "answer": "See categorization_items in full_problem_data"
            }
        elif problem_type == "scenario_question":
            return {
                "problem": f"{problem.get('scenario', '')} {problem.get('scenario_question', '')}",
                "answer": problem.get("scenario_answer", "")
            }
        elif problem_type == "short_answer":
            return {
                "problem": problem.get("question", ""),
                "answer": "Open-ended response expected"
            }
        else:
            return {
                "problem": "",
                "answer": ""
            }