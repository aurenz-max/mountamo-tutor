# backend/app/services/composable_problem_generation.py

from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import logging
from google import genai
from google.genai.types import GenerateContentConfig
from ..core.config import settings
from ..schemas.composable_problems import (
    ComposableProblem, 
    ProblemGenerationRequest, 
    ProblemGenerationResponse,
    InteractiveProblem,
    InteractiveProblemGenerationResponse,
    PrimitiveManifest,
    PrimitiveManifestEntry,
    PrimitiveType
)
from .problems import ProblemService

logger = logging.getLogger(__name__)


class ComposableProblemGenerationService:
    """
    Refined four-step chain for generating composable problems:
    1. LLM 1 (Generator) - Uses existing prompt to generate full problem package
    2. LLM 2 (Decomposer) - Analyzes problem and chooses best primitive
    3. LLM 3 (Primitive Specialist) - Generates JSON for single interactive primitive only
    4. Python (Assembler) - Deterministically assembles final ComposableProblem
    """
    
    def __init__(self):
        self.problem_service = None
        
        # Initialize Gemini client
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required")
        
        self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("ComposableProblemGenerationService initialized with Gemini 2.5 Flash")
    
    def set_problem_service(self, problem_service: ProblemService) -> None:
        """Inject the existing ProblemService for Step 1"""
        self.problem_service = problem_service
    
    async def generate_problem(self, request: ProblemGenerationRequest) -> ProblemGenerationResponse:
        """
        Main orchestrator method implementing the three-step chain
        """
        logger.info(f"Executing refined 4-step problem generation chain for skill {request.skill_id}")
        
        try:
            # Require rich metadata from request - no mock fallback allowed
            if not hasattr(request, 'metadata') or not request.metadata:
                raise ValueError("ProblemGenerationRequest must include rich metadata from ProblemService. No mock data fallback allowed.")
            
            metadata = request.metadata
            recommendation = {
                "skill": metadata.get('skill', {}),
                "subskill": metadata.get('subskill', {}),
                "unit": metadata.get('unit', {}),
                "difficulty": metadata.get('difficulty', request.difficulty_preference or 5.0),
                "detailed_objectives": metadata.get('objectives', {})
            }
            
            # Validate we have proper metadata
            if not recommendation['skill'].get('description') or not recommendation['subskill'].get('description'):
                raise ValueError(f"Rich metadata is incomplete: skill='{recommendation['skill']}', subskill='{recommendation['subskill']}'")
            
            logger.info(f"Using rich metadata: skill='{recommendation['skill']['description']}', subskill='{recommendation['subskill']['description']}'")
            
            # Step 1: Generate problem details using rich metadata
            problem_details = await self._step1_generate_problem_details(metadata.get('subject', 'Math'), recommendation)
            logger.info(f"Step 1/4 [Generator] SUCCESS. Problem: \"{problem_details.get('problem', 'N/A')[:50]}...\"")
            
            # Step 2: Decompose problem into primitives
            manifest = self._get_primitive_manifest()
            decomposition_plan = await self._step2_decompose_problem_to_primitives(problem_details, manifest)
            chosen_primitive = decomposition_plan['decomposition'][1]['primitive_type']
            logger.info(f"Step 2/4 [Decomposer] SUCCESS. Plan uses primitive: {chosen_primitive}")
            
            # Step 3: Generate JSON for ONLY the interactive primitive
            interactive_primitive_type = decomposition_plan['decomposition'][1]['primitive_type']
            interactive_primitive_json = await self._step3_generate_interactive_primitive_json(
                problem_details, interactive_primitive_type
            )
            logger.info(f"Step 3/4 [Primitive Specialist] SUCCESS. Generated JSON for {interactive_primitive_type} primitive.")
            
            # Step 4: Assemble the final problem in Python
            problem_data = self._assemble_final_problem(
                problem_details, interactive_primitive_json
            )
            logger.info("Step 4/4 [Assembler] SUCCESS. Final InteractiveProblem assembled deterministically.")
            
            # Create InteractiveProblem instance
            problem = InteractiveProblem(**problem_data)
            
            # Create response
            response = InteractiveProblemGenerationResponse(
                problem=problem,
                generated_at=datetime.utcnow().isoformat(),
                cache_key=f"interactive_{request.skill_id}_{datetime.utcnow().timestamp()}"
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error during refined 4-step problem generation chain: {e}", exc_info=True)
            raise
    
    async def _step1_generate_problem_details(
        self, 
        subject: str, 
        recommendation: Dict[str, Any]
    ) -> dict:
        """
        Step 1: Generate full problem package using existing, battle-tested prompt
        """
        logger.info(f"Chain Step 1: Generating problem details for skill '{recommendation.get('skill', {}).get('description')}'")
        
        if not self.problem_service:
            raise ValueError("ProblemService not injected. Call set_problem_service() first.")
        
        # Use the new public method that combines generation and parsing
        problem_details = await self.problem_service.generate_and_parse_problem(subject, recommendation)
        
        if not problem_details:
            raise ValueError("Step 1 failed: ProblemService could not generate and parse problem")
        
        logger.debug(f"Step 1 generated: {problem_details}")
        return problem_details
    
    async def _step2_decompose_problem_to_primitives(self, problem_details: dict, manifest: PrimitiveManifest) -> dict:
        """
        Step 2: Analyze problem and choose the best primitive to represent it
        """
        logger.info("Chain Step 2: Decomposing problem into primitives.")
        
        problem_text = problem_details.get('problem', '')
        answer_text = problem_details.get('answer', '')
        
        primitive_descriptions = "\n".join(
            f"- `{p.primitive_type}`: {p.description}. Use for tasks like: {', '.join(p.use_cases)}" 
            for p in manifest.primitives
        )
        
        prompt = f"""
You are a technical system designer. Your job is to convert a word problem into a simple, two-step interactive experience using UI 'primitives'.

Available Primitives:
{primitive_descriptions}

Problem Details:
- Problem Text: "{problem_text}"
- Correct Answer: "{answer_text}"

Your Task:
1. The first step is always to display the problem text. Choose the `StaticText` primitive for this.
2. For the second step, analyze the problem and answer. Choose the *single best interactive primitive* that allows the student to solve the problem. 

Common choices:
- If the problem involves counting objects, `ObjectCounter` is ideal
- If it's choosing between options or comparing values, `MultipleChoice` is best  
- If it involves number recognition or writing, `NumberInput` works well
- If it involves tracing numbers, `NumberTracing` is perfect
- For drag and drop activities, `DragAndDropZone` is great

Output a JSON object with a "decomposition" array containing exactly two steps: the StaticText and the interactive primitive you chose.

Format:
{{
  "decomposition": [
    {{
      "source_text": "{problem_text}",
      "primitive_type": "StaticText",
      "brief_instruction": "{problem_text}"
    }},
    {{
      "source_text": "Interactive part of the problem",
      "primitive_type": "CHOSEN_PRIMITIVE",
      "brief_instruction": "Clear instruction for the student"
    }}
  ]
}}
"""
        
        # Use Gemini 2.5 Flash with JSON mode
        schema = {
            "type": "object",
            "properties": {
                "decomposition": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "source_text": {"type": "string"},
                            "primitive_type": {"type": "string"},
                            "brief_instruction": {"type": "string"}
                        },
                        "required": ["source_text", "primitive_type", "brief_instruction"]
                    }
                }
            },
            "required": ["decomposition"]
        }
        
        try:
            response = await self.gemini_client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=schema,
                    temperature=0.3
                )
            )
            return json.loads(response.text)
            
        except Exception as e:
            logger.error(f"Step 2 Gemini call failed: {e}")
            
            # Fallback: create a basic decomposition with MultipleChoice as common option
            return {
                "decomposition": [
                    {
                        "source_text": problem_text,
                        "primitive_type": "StaticText",
                        "brief_instruction": problem_text
                    },
                    {
                        "source_text": "Choose the correct answer",
                        "primitive_type": "MultipleChoice",
                        "brief_instruction": "Select the right answer"
                    }
                ]
            }
    
    async def _step3_generate_interactive_primitive_json(
        self, 
        problem_details: dict, 
        primitive_type: str
    ) -> dict:
        """
        Step 3: Generate JSON for ONLY the interactive primitive chosen in Step 2.
        This is a much more focused task for the LLM.
        """
        logger.info(f"Chain Step 3: Generating JSON for {primitive_type} primitive.")
        
        prompt = self._create_primitive_generation_prompt(primitive_type, problem_details)
        # CHANGED: Get a specific schema for the requested primitive type
        schema = self._get_schema_for_primitive(primitive_type)
        
        try:
            response = await self.gemini_client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=schema,
                    temperature=0.2
                )
            )
            
            primitive_json = json.loads(response.text)
            
            # Validate the primitive has required fields
            required_fields = ['primitive_id', 'primitive_type', 'parameters']
            if not all(key in primitive_json for key in required_fields):
                raise ValueError(f"Generated primitive missing required fields: {required_fields}")
            
            # Ensure it matches expected type
            if primitive_json['primitive_type'] != primitive_type:
                logger.warning(f"Generated primitive type {primitive_json['primitive_type']} doesn't match expected {primitive_type}")
                primitive_json['primitive_type'] = primitive_type
            
            # Set standard fields
            primitive_json['primitive_id'] = 'step2_interactive'
            primitive_json['visible'] = True
            primitive_json['enabled'] = True
            primitive_json['state_dependencies'] = []
            
            return primitive_json
            
        except Exception as e:
            logger.error(f"Step 3 Primitive Specialist call failed for {primitive_type}: {e}", exc_info=True)
            # Re-raise with more context while preserving the original exception
            raise Exception(f"Step 3 (Primitive Specialist) failed for {primitive_type}") from e
    
    def _create_primitive_generation_prompt(self, primitive_type: str, problem_details: dict) -> str:
        """
        Creates a highly focused prompt for generating a single primitive's JSON.
        """
        problem_text = problem_details.get('problem', '')
        answer_text = problem_details.get('answer', '')
        answer_as_number = self._extract_number_from_answer(answer_text)
        
        if primitive_type == "MultipleChoice":
            return f"""
Generate JSON for a MultipleChoice primitive. Use this EXACT format:

{{
  "primitive_id": "step2_interactive",
  "primitive_type": "MultipleChoice",
  "parameters": {{
    "prompt": "What is the answer?",
    "options": [
      {{"id": "a", "text": "{answer_text}"}},
      {{"id": "b", "text": "Wrong answer 1"}},
      {{"id": "c", "text": "Wrong answer 2"}}
    ],
    "correct_option_id": "a"
  }}
}}

Problem: "{problem_text}"
Correct Answer: "{answer_text}"

Replace the prompt and wrong answers appropriately, but keep the exact JSON structure.
"""
        
        elif primitive_type == "ObjectCounter":
            return f"""
Generate JSON for an ObjectCounter primitive. Use this EXACT format:

{{
  "primitive_id": "step2_interactive",
  "primitive_type": "ObjectCounter",
  "parameters": {{
    "prompt": "Count the objects",
    "object_image_url": "star.svg",
    "target_count": {answer_as_number}
  }}
}}

Problem: "{problem_text}"
Correct Answer: "{answer_text}"

Replace the prompt appropriately, but keep the exact JSON structure.
"""
        
        elif primitive_type == "NumberInput":
            return f"""
Generate JSON for a NumberInput primitive. Use this EXACT format:

{{
  "primitive_id": "step2_interactive",
  "primitive_type": "NumberInput",
  "parameters": {{
    "prompt": "Enter your answer",
    "placeholder": "Enter a number",
    "correct_answer": {answer_as_number}
  }}
}}

Problem: "{problem_text}"
Correct Answer: "{answer_text}"

Replace the prompt appropriately, but keep the exact JSON structure.
"""
        
        elif primitive_type == "NumberTracing":
            return f"""
Generate JSON for a NumberTracing primitive. Use this EXACT format:

{{
  "primitive_id": "step2_interactive",
  "primitive_type": "NumberTracing",
  "parameters": {{
    "prompt": "Trace the number {answer_as_number}",
    "number_to_trace": {answer_as_number},
    "show_stroke_guides": true
  }}
}}

Problem: "{problem_text}"
Correct Answer: "{answer_text}"

Replace the prompt appropriately, but keep the exact JSON structure.
"""
        
        elif primitive_type == "DragAndDropZone":
            return f"""
Generate JSON for a DragAndDropZone primitive. Use this EXACT format:

{{
  "primitive_id": "step2_interactive",
  "primitive_type": "DragAndDropZone",
  "parameters": {{
    "prompt": "Drag {answer_as_number} items to the basket",
    "draggable_items": [
      {{"id": "item1", "image_url": "apple.svg", "label": "Apple"}},
      {{"id": "item2", "image_url": "apple.svg", "label": "Apple"}},
      {{"id": "item3", "image_url": "apple.svg", "label": "Apple"}},
      {{"id": "item4", "image_url": "apple.svg", "label": "Apple"}}
    ],
    "drop_zone": {{"id": "basket", "image_url": "basket.svg", "label": "Basket"}},
    "solution_rule": {{"type": "count", "value": {answer_as_number}}}
  }}
}}

Problem: "{problem_text}"
Correct Answer: "{answer_text}"

Adjust the items and prompt as needed, but keep the exact JSON structure.
"""
        
        elif primitive_type == "NumberLine":
            return f"""
Generate JSON for a NumberLine primitive. Use this EXACT format:

{{
  "primitive_id": "step2_interactive",
  "primitive_type": "NumberLine",
  "parameters": {{
    "prompt": "Place the number {answer_as_number} on the number line",
    "min_value": 0,
    "max_value": 10,
    "target_numbers": [{answer_as_number}]
  }}
}}

Problem: "{problem_text}"
Correct Answer: "{answer_text}"

Replace the prompt appropriately, but keep the exact JSON structure.
"""
        
        else:
            raise NotImplementedError(f"Prompt generation not implemented for primitive type: {primitive_type}")
    
    def _get_schema_for_primitive(self, primitive_type: str) -> Dict[str, Any]:
        """
        Returns a detailed JSON schema for a specific primitive type.
        This ensures the LLM's output is strictly validated against the required structure.
        """
        # Base structure for all primitives
        base_schema = {
            "type": "object",
            "properties": {
                "primitive_id": {"type": "string"},
                "primitive_type": {"type": "string", "enum": [primitive_type]},
                "parameters": {"type": "object"}
            },
            "required": ["primitive_id", "primitive_type", "parameters"]
        }

        # Define specific parameters for each primitive type
        if primitive_type == "MultipleChoice":
            base_schema["properties"]["parameters"] = {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "text": {"type": "string"}
                            },
                            "required": ["id", "text"]
                        }
                    },
                    "correct_option_id": {"type": "string"}
                },
                "required": ["prompt", "options", "correct_option_id"]
            }
        elif primitive_type == "ObjectCounter":
            base_schema["properties"]["parameters"] = {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "object_image_url": {"type": "string"},
                    "target_count": {"type": "integer"}
                },
                "required": ["prompt", "object_image_url", "target_count"]
            }
        elif primitive_type == "NumberInput":
            base_schema["properties"]["parameters"] = {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "placeholder": {"type": "string"},
                    "correct_answer": {"type": "number"}
                },
                "required": ["prompt", "correct_answer"]
            }
        elif primitive_type == "NumberTracing":
            base_schema["properties"]["parameters"] = {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "number_to_trace": {"type": "integer"},
                    "show_stroke_guides": {"type": "boolean"}
                },
                "required": ["prompt", "number_to_trace"]
            }
        elif primitive_type == "NumberLine":
            base_schema["properties"]["parameters"] = {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "min_value": {"type": "integer"},
                    "max_value": {"type": "integer"},
                    "target_numbers": {"type": "array", "items": {"type": "integer"}}
                },
                "required": ["prompt", "target_numbers"]
            }
        elif primitive_type == "DragAndDropZone":
             base_schema["properties"]["parameters"] = {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "draggable_items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "image_url": {"type": "string"},
                                "label": {"type": "string"}
                            },
                            "required": ["id", "image_url", "label"]
                        }
                    },
                    "drop_zone": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "image_url": {"type": "string"},
                            "label": {"type": "string"}
                        },
                        "required": ["id", "image_url", "label"]
                    },
                    "solution_rule": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string", "enum": ["count"]},
                            "value": {"type": "integer"}
                        },
                        "required": ["type", "value"]
                    }
                },
                "required": ["prompt", "draggable_items", "drop_zone", "solution_rule"]
            }
        else:
            # Fallback for any other type (like StaticText, though not used here)
            # This is the same as your original simple schema
            base_schema["properties"]["parameters"] = {
                "type": "object",
                "properties": {"prompt": {"type": "string"}},
            }
            
        return base_schema
    
    def _assemble_final_problem(self, problem_details: dict, interactive_primitive_json: dict) -> dict:
        """
        Deterministically assembles the new, simplified InteractiveProblem.
        This function is much simpler and has no complex logic.
        """
        # The problem text from Step 1 is now the main prompt.
        problem_text = problem_details.get('problem', 'Problem text is missing.')
        
        # The JSON from the "Primitive Specialist" (Step 3) becomes the interaction.
        interaction_type = interactive_primitive_json.get("primitive_type")
        interaction_parameters = interactive_primitive_json.get("parameters", {})

        # Assemble the final dictionary according to the new schema
        return {
            "problem_id": f"prob_{int(datetime.utcnow().timestamp())}",
            "learning_objective": problem_details.get('learning_objective', "Learn basic math concepts"),
            "prompt": problem_text,
            "interaction": {
                "type": interaction_type,
                "parameters": interaction_parameters
            },
            "metadata": {
                "generated_by": "InteractiveProblemService_v1",
                "created_at": datetime.utcnow().isoformat(),
                "original_problem_details": problem_details
            },
            "problem_type": "interactive",
            "subject": problem_details.get("subject", "Math"),
            "grade_level": problem_details.get("grade_level", "Kindergarten"),
            "difficulty": problem_details.get("difficulty", 5.0)
        }
    
    def _extract_number_from_answer(self, answer_text: str) -> Optional[int]:
        """Extract a number from the answer text"""
        import re
        numbers = re.findall(r'\d+', str(answer_text))
        if numbers:
            return int(numbers[0])
        return None
    
    def _create_fallback_composable_problem(self, problem_details: dict, decomposition_plan: dict) -> dict:
        """Create a fallback composable problem structure"""
        logger.warning("Using fallback composable problem structure")
        
        decomposition = decomposition_plan.get("decomposition", [])
        problem_text = problem_details.get('problem', 'Problem text missing')
        answer_text = problem_details.get('answer', '0')
        answer_number = self._extract_number_from_answer(answer_text) or 0
        
        # Determine primitive type and parameters - favor MultipleChoice as common method
        if len(decomposition) >= 2:
            primitive_type = decomposition[1].get('primitive_type', 'MultipleChoice')
        else:
            primitive_type = 'MultipleChoice'
        
        # Configure parameters based on primitive type
        if primitive_type == 'ObjectCounter':
            interactive_params = {
                "prompt": f"Count to find the answer: {answer_text}",
                "object_image_url": "generic_object.svg",
                "target_count": answer_number
            }
            criterion_type = "count_match"
            required_value = str(answer_number)
        elif primitive_type == 'MultipleChoice':
            # Create logical distractors for multiple choice
            correct_answer = str(answer_number)
            options = [
                {"id": "opt1", "text": correct_answer},
                {"id": "opt2", "text": str(max(0, answer_number - 1))},
                {"id": "opt3", "text": str(answer_number + 1)},
                {"id": "opt4", "text": str(max(0, answer_number - 2))}
            ]
            interactive_params = {
                "prompt": "Choose the correct answer:",
                "options": options,
                "correct_option_id": "opt1"
            }
            criterion_type = "exact_match"
            required_value = "opt1"
        else:  # NumberInput or other fallback
            interactive_params = {
                "prompt": "Enter your answer:",
                "correct_answer": answer_number
            }
            criterion_type = "exact_match"
            required_value = str(answer_number)
        
        return {
            "problem_id": f"prob_fallback_{int(datetime.utcnow().timestamp())}",
            "learning_objective": f"Based on problem: {problem_text[:50]}...",
            "layout": {
                "type": "single-column",
                "containers": [{
                    "id": "main",
                    "primitives": [
                        {
                            "primitive_id": "step1_context",
                            "primitive_type": "StaticText",
                            "parameters": {"content": problem_text},
                            "state_dependencies": [],
                            "visible": True,
                            "enabled": True
                        },
                        {
                            "primitive_id": "step2_interactive",
                            "primitive_type": primitive_type,
                            "parameters": interactive_params,
                            "state_dependencies": [],
                            "visible": True,
                            "enabled": True
                        }
                    ]
                }]
            },
            "evaluation_logic": {
                "criteria": [{
                    "primitive_id": "step2_interactive",
                    "criterion_type": criterion_type,
                    "weight": 1.0,
                    "required_value": required_value
                }],
                "passing_score": 1.0,
                "partial_credit_enabled": False
            },
            "metadata": {
                "generated_by": "ComposableProblemGenerationService_Fallback",
                "created_at": datetime.utcnow().isoformat(),
                "original_problem_type": problem_details.get('problem_type', ''),
                "success_criteria": problem_details.get('success_criteria', []),
                "teaching_note": problem_details.get('teaching_note', '')
            },
            "problem_type": "composable",
            "subject": "Math",
            "grade_level": "Kindergarten",
            "difficulty": 5.0
        }
    
    def _get_primitive_manifest(self) -> PrimitiveManifest:
        """
        Get the primitive manifest that describes available primitives to the LLM
        """
        primitives = [
            PrimitiveManifestEntry(
                primitive_type="StaticText",
                description="Display text content with formatting options",
                use_cases=[
                    "Problem instructions",
                    "Context setting",
                    "Educational explanations"
                ],
                parameters_schema={
                    "content": "string (required) - Text to display, supports Markdown",
                    "text_align": "left|center|right (optional) - Text alignment",
                    "font_weight": "normal|bold (optional) - Font weight",
                    "font_size": "small|medium|large (optional) - Font size"
                },
                example_usage={
                    "primitive_type": "StaticText",
                    "parameters": {
                        "content": "Help Sarah count the apples!",
                        "text_align": "center",
                        "font_weight": "bold"
                    }
                }
            ),
            PrimitiveManifestEntry(
                primitive_type="DragAndDropZone",
                description="Interactive drag-and-drop area for counting and sorting activities",
                use_cases=[
                    "Counting objects (put 3 apples in the basket)",
                    "Sorting by attributes", 
                    "Matching exercises",
                    "One-to-one correspondence"
                ],
                parameters_schema={
                    "prompt": "string (required) - Instructions for the activity",
                    "draggable_items": "array (required) - Items that can be dragged",
                    "drop_zone": "object (required) - Target zone for dropping",
                    "solution_rule": "object (required) - How to evaluate correctness"
                },
                example_usage={
                    "primitive_type": "DragAndDropZone", 
                    "parameters": {
                        "prompt": "Put exactly 3 apples in the basket",
                        "draggable_items": [
                            {"id": "apple1", "image_url": "apple.svg", "label": "Apple"},
                            {"id": "apple2", "image_url": "apple.svg", "label": "Apple"},
                            {"id": "apple3", "image_url": "apple.svg", "label": "Apple"},
                            {"id": "apple4", "image_url": "apple.svg", "label": "Apple"}
                        ],
                        "drop_zone": {"id": "basket", "image_url": "basket.svg", "label": "Basket"},
                        "solution_rule": {"type": "count", "value": 3}
                    }
                }
            ),
            PrimitiveManifestEntry(
                primitive_type="NumberTracing",
                description="Interactive number tracing for numeral formation practice",
                use_cases=[
                    "Learning to write numbers",
                    "Number recognition",
                    "Fine motor skill development"
                ],
                parameters_schema={
                    "prompt": "string (required) - Instructions for tracing",
                    "number_to_trace": "integer (required) - Number to trace (0-100)",
                    "show_stroke_guides": "boolean (optional) - Show stroke direction guides",
                    "allow_multiple_attempts": "boolean (optional) - Allow retries"
                },
                example_usage={
                    "primitive_type": "NumberTracing",
                    "parameters": {
                        "prompt": "Trace the number 3 with your finger",
                        "number_to_trace": 3,
                        "show_stroke_guides": True
                    }
                }
            ),
            PrimitiveManifestEntry(
                primitive_type="MultipleChoice",
                description="Multiple choice questions with options",
                use_cases=[
                    "Selecting correct answers",
                    "Concept verification",
                    "Quick assessments"
                ],
                parameters_schema={
                    "prompt": "string (required) - The question text",
                    "options": "array (required) - List of answer options", 
                    "correct_option_id": "string (required) - ID of correct option",
                    "randomize_options": "boolean (optional) - Randomize option order"
                },
                example_usage={
                    "primitive_type": "MultipleChoice",
                    "parameters": {
                        "prompt": "How many legs does a dog have?",
                        "options": [
                            {"id": "opt1", "text": "2 legs"},
                            {"id": "opt2", "text": "4 legs"}, 
                            {"id": "opt3", "text": "6 legs"}
                        ],
                        "correct_option_id": "opt2"
                    }
                }
            ),
            PrimitiveManifestEntry(
                primitive_type="ObjectCounter",
                description="Tap to add/count objects interactively",
                use_cases=[
                    "Basic counting practice",
                    "Number concept building",
                    "Interactive counting games"
                ],
                parameters_schema={
                    "prompt": "string (required) - Counting instructions",
                    "object_image_url": "string (required) - Image of object to count",
                    "max_count": "integer (optional) - Maximum allowed count",
                    "target_count": "integer (optional) - Expected count for evaluation"
                },
                example_usage={
                    "primitive_type": "ObjectCounter",
                    "parameters": {
                        "prompt": "Count to 5 by tapping the stars",
                        "object_image_url": "star.svg",
                        "max_count": 10,
                        "target_count": 5
                    }
                }
            ),
            PrimitiveManifestEntry(
                primitive_type="NumberLine",
                description="Interactive number line for number placement and relationships",
                use_cases=[
                    "Number ordering",
                    "Understanding number sequences",
                    "Greater than/less than concepts"
                ],
                parameters_schema={
                    "prompt": "string (required) - Instructions for number line activity",
                    "min_value": "integer (optional) - Minimum value on line",
                    "max_value": "integer (optional) - Maximum value on line", 
                    "target_numbers": "array (required) - Numbers to be placed",
                    "show_labels": "boolean (optional) - Show number labels"
                },
                example_usage={
                    "primitive_type": "NumberLine",
                    "parameters": {
                        "prompt": "Place the number 7 on the number line",
                        "min_value": 0,
                        "max_value": 10,
                        "target_numbers": [7]
                    }
                }
            ),
            PrimitiveManifestEntry(
                primitive_type="NumberInput",
                description="Text input field for numeric answers",
                use_cases=[
                    "Simple arithmetic answers",
                    "Number entry practice",
                    "Quick numeric assessments"
                ],
                parameters_schema={
                    "prompt": "string (required) - Question or instruction",
                    "placeholder": "string (optional) - Placeholder text",
                    "correct_answer": "number (required) - Expected numeric answer",
                    "min_value": "integer (optional) - Minimum allowed value",
                    "max_value": "integer (optional) - Maximum allowed value"
                },
                example_usage={
                    "primitive_type": "NumberInput",
                    "parameters": {
                        "prompt": "What is 2 + 3?",
                        "placeholder": "Enter your answer",
                        "correct_answer": 5
                    }
                }
            )
        ]
        
        return PrimitiveManifest(
            version="1.0",
            primitives=primitives,
            layout_options=["single-column", "two-column"],
            best_practices=[
                "Start with simple context-setting text",
                "Break complex skills into sequential primitives",
                "Use state_dependencies to guide students step-by-step",
                "Always provide clear, age-appropriate prompts",
                "Use familiar contexts (family, animals, toys)",
                "Limit cognitive load - max 2-3 interactive primitives per problem",
                "Choose the most appropriate primitive for each learning objective"
            ]
        )
    
    def _get_problem_schema(self) -> Dict[str, Any]:
        """
        REMOVED: This method was causing JSON validation errors.
        We now use Python-based validation after JSON generation instead of schema enforcement.
        """
        return None
    
    async def validate_problem(self, problem: ComposableProblem) -> bool:
        """
        Validate that a generated problem is well-formed and educationally sound
        """
        try:
            # Check basic structure
            if not problem.problem_id or not problem.learning_objective:
                return False
            
            # Check that we have primitives
            if not problem.layout.containers:
                return False
            
            total_primitives = sum(len(container.primitives) for container in problem.layout.containers)
            if total_primitives == 0:
                return False
            
            # Check state dependencies reference valid primitive_ids
            all_primitive_ids = set()
            for container in problem.layout.containers:
                for primitive in container.primitives:
                    all_primitive_ids.add(primitive.primitive_id)
            
            for container in problem.layout.containers:
                for primitive in container.primitives:
                    if primitive.state_dependencies:
                        for dep in primitive.state_dependencies:
                            if dep.target_id not in all_primitive_ids:
                                logger.warning(f"Invalid state dependency: {dep.target_id} not found")
                                return False
            
            # Check evaluation logic references valid primitive_ids
            if problem.evaluation_logic.criteria:
                for criterion in problem.evaluation_logic.criteria:
                    if criterion.primitive_id not in all_primitive_ids:
                        logger.warning(f"Invalid evaluation criterion: {criterion.primitive_id} not found")
                        return False
            
            logger.info(f"Problem validation successful for {problem.problem_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error validating problem: {e}")
            return False
    
    async def health_check(self) -> Dict[str, Any]:
        """Check service health"""
        try:
            # Test Gemini connectivity
            test_schema = {
                "type": "object",
                "properties": {
                    "test": {"type": "string"}
                },
                "required": ["test"]
            }
            
            test_response = await self.gemini_client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents="Return JSON with test field set to 'success'",
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=test_schema,
                    max_output_tokens=50
                )
            )
            
            gemini_healthy = test_response and "success" in test_response.text
            
            return {
                "status": "healthy" if gemini_healthy else "degraded",
                "gemini_connection": "healthy" if gemini_healthy else "unhealthy",
                "model": "gemini-2.5-flash",
                "service": "composable_problem_generation",
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "service": "composable_problem_generation",
                "timestamp": datetime.utcnow().isoformat()
            }