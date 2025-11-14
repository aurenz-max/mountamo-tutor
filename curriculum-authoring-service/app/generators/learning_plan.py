"""
Tier 1: Learning Plan Generator
Decomposes learning objectives into a structured teaching plan with section strategies.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai.types import GenerateContentConfig
from app.models.section_types import SectionType


class SectionPlan(BaseModel):
    """Plan for a single content section targeting specific learning objective(s)"""
    section_number: int = Field(description="Order of this section (1-based)")
    section_type: SectionType = Field(description="Meta section type (e.g., intuitive_explanation, worked_examples)")
    primary_objective: str = Field(description="The main learning objective this section teaches")
    teaching_strategy: str = Field(description="How to teach this objective (e.g., 'explicit instruction', 'guided practice', 'application')")
    key_concepts_to_cover: List[str] = Field(description="Core concepts from master context relevant to this objective")
    recommended_primitives: Dict[str, List[str]] = Field(
        description="Specific primitives to use (e.g., {'concrete_objects': ['cat', 'hat'], 'characters': ['Maya']})"
    )
    selected_primitive_schemas: List[str] = Field(
        description="Interactive primitive schema types needed for this section (e.g., ['quizzes', 'definitions', 'flip_cards'])",
        default_factory=list
    )
    builds_on_prior: bool = Field(
        description="Whether this section requires understanding from previous sections"
    )
    success_criteria: str = Field(
        description="How to assess if the objective was successfully taught"
    )


class TeachingPlan(BaseModel):
    """Complete teaching plan for reading content"""
    section_plans: List[SectionPlan] = Field(
        description="Ordered list of section plans (2-6 sections based on pedagogical needs)"
    )
    overall_narrative_arc: str = Field(
        description="The story/flow connecting all sections"
    )
    prerequisite_check: str = Field(
        description="What prior knowledge students need"
    )


class LearningPlanGenerator:
    """Generates teaching plans that map learning objectives to content sections"""

    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    async def generate_teaching_plan(
        self,
        learning_objectives: List[str],
        core_concepts: List[str],
        key_terminology: Dict[str, str],
        context_primitives: Dict[str, Any],
        grade_level: str,
        subskill_description: str,
        subject: Optional[str] = None,
        unit: Optional[str] = None,
        skill: Optional[str] = None
    ) -> TeachingPlan:
        """
        Generate a structured teaching plan that maps learning objectives to sections.

        Args:
            learning_objectives: The specific skills students must learn
            core_concepts: Foundational concepts to cover
            key_terminology: Key terms with definitions
            context_primitives: Available examples (characters, objects, scenarios, etc.)
            grade_level: Target grade level
            subskill_description: Description of the subskill
            subject: Subject area (e.g., "Mathematics", "Reading")
            unit: Unit within subject (e.g., "Phonics", "Number Sense")
            skill: Skill within unit (e.g., "Rhyming", "Addition")

        Returns:
            TeachingPlan with section strategies, types, and primitive assignments
        """

        # Format primitives for prompt
        primitives_summary = self._format_primitives(context_primitives)

        # Build hierarchical context
        context_parts = []
        if subject:
            context_parts.append(f"Subject: {subject}")
        if unit:
            context_parts.append(f"Unit: {unit}")
        if skill:
            context_parts.append(f"Skill: {skill}")
        hierarchical_context = " | ".join(context_parts) if context_parts else "General Education"

        # Available section types
        section_types_desc = """
AVAILABLE SECTION TYPES (choose 2-6 based on pedagogical needs):
1. introduction_motivation - Hook the learner, establish why this matters (150-250 words)
2. intuitive_explanation - Build conceptual understanding before formalism (300-500 words)
3. formal_definition - Provide precise technical definitions (200-400 words)
4. worked_examples - Show concept in action with step-by-step examples (400-800 words)
5. common_errors - Identify and address misconceptions (300-500 words)
6. connections_extensions - Show relationships to other concepts (200-400 words)
"""

        prompt = f"""You are an expert educational content planner for {grade_level} students.

CURRICULUM CONTEXT: {hierarchical_context}
SUBSKILL: {subskill_description}

LEARNING OBJECTIVES (must ALL be explicitly taught):
{self._format_list(learning_objectives)}

CORE CONCEPTS TO COVER:
{self._format_list(core_concepts)}

KEY TERMINOLOGY:
{self._format_dict(key_terminology)}

AVAILABLE CONTEXT PRIMITIVES (use these for concrete examples):
{primitives_summary}

{section_types_desc}

YOUR TASK:
Create a teaching plan that selects the most appropriate 2-6 section types to teach these learning objectives.
The LLM should intelligently choose which section types are pedagogically necessary.

For each section you plan:
1. Choose the appropriate section_type from the 6 available types
2. Define the primary_objective this section will teach
3. Select specific context primitives that make the objective concrete
4. Choose which interactive_primitive_schemas are needed (e.g., ['quizzes', 'definitions', 'flip_cards'])
5. Ensure logical pedagogical flow

SECTION TYPE SELECTION GUIDANCE:
- Not all lessons need all 6 section types - choose based on content
- Conceptual content benefits from: introduction_motivation → intuitive_explanation → formal_definition → connections_extensions
- Procedural content benefits from: introduction_motivation → worked_examples → common_errors
- Choose section types that create a coherent learning arc
- Must include at least 2 sections, maximum 6 sections

INTERACTIVE PRIMITIVE SCHEMAS (choose relevant ones for each section):
Available types: 'alerts', 'expandables', 'quizzes', 'definitions', 'checklists', 'tables',
'keyvalues', 'interactive_timelines', 'carousels', 'flip_cards', 'categorization_activities',
'fill_in_the_blanks', 'scenario_questions', 'tabbed_content', 'matching_activities',
'sequencing_activities', 'accordions'

REQUIREMENTS:
- Create 2-6 sections (choose optimal number for content)
- Every learning objective must be covered
- Use grade-appropriate strategies for {grade_level}
- Select section types that form a coherent pedagogical progression
- For each section, specify which primitive schemas are needed

Return your plan as structured JSON following the TeachingPlan schema."""

        schema = self._get_teaching_plan_schema()

        response = await self.client.aio.models.generate_content(
            model='gemini-flash-lite-latest',
            contents=prompt,
            config=GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=schema,
                temperature=0.3,  # Lower temperature for structured planning
            )
        )

        # Parse response into TeachingPlan
        import json
        plan_data = json.loads(response.text)
        return TeachingPlan(**plan_data)

    def _format_list(self, items: List[str]) -> str:
        """Format list items with bullet points"""
        return '\n'.join(f"  • {item}" for item in items)

    def _format_dict(self, items: Dict[str, str]) -> str:
        """Format dictionary items"""
        return '\n'.join(f"  • {key}: {value}" for key, value in items.items())

    def _format_primitives(self, primitives: Dict[str, Any]) -> str:
        """Format context primitives for the prompt"""
        lines = []

        # Concrete objects (show first 10)
        if primitives.get('concrete_objects'):
            objects = primitives['concrete_objects'][:10]
            lines.append(f"Concrete Objects: {', '.join(objects)}")

        # Living things (show first 8)
        if primitives.get('living_things'):
            living = primitives['living_things'][:8]
            lines.append(f"Living Things: {', '.join(living)}")

        # Characters (show all with details)
        if primitives.get('characters'):
            chars = []
            for char in primitives['characters'][:5]:
                if isinstance(char, dict):
                    name = char.get('name', 'Unknown')
                    age = char.get('age', '')
                    role = char.get('role', '')
                    char_str = f"{name}"
                    if age:
                        char_str += f" (age {age})"
                    if role:
                        char_str += f" - {role}"
                    chars.append(char_str)
            if chars:
                lines.append(f"Characters: {', '.join(chars)}")

        # Scenarios (show first 6)
        if primitives.get('scenarios'):
            scenarios = primitives['scenarios'][:6]
            lines.append(f"Scenarios: {', '.join(scenarios)}")

        # Locations (show first 6)
        if primitives.get('locations'):
            locations = primitives['locations'][:6]
            lines.append(f"Locations: {', '.join(locations)}")

        # Action words (show first 10)
        if primitives.get('action_words'):
            actions = primitives['action_words'][:10]
            lines.append(f"Action Words: {', '.join(actions)}")

        return '\n'.join(lines)

    def _get_teaching_plan_schema(self) -> dict:
        """Get JSON schema for TeachingPlan"""
        return {
            "type": "object",
            "properties": {
                "section_plans": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "section_number": {
                                "type": "integer",
                                "description": "Order of this section (1-6)"
                            },
                            "section_type": {
                                "type": "string",
                                "enum": [
                                    "introduction_motivation",
                                    "intuitive_explanation",
                                    "formal_definition",
                                    "worked_examples",
                                    "common_errors",
                                    "connections_extensions"
                                ],
                                "description": "Meta section type that defines pedagogical approach"
                            },
                            "primary_objective": {
                                "type": "string",
                                "description": "The main learning objective this section teaches"
                            },
                            "teaching_strategy": {
                                "type": "string",
                                "description": "Teaching approach (e.g., 'explicit instruction with audio examples', 'guided practice with scaffolding', 'independent application')"
                            },
                            "key_concepts_to_cover": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Core concepts from master context to address in this section"
                            },
                            "recommended_primitives": {
                                "type": "object",
                                "description": "Specific primitives to use in examples",
                                "properties": {
                                    "concrete_objects": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "characters": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "scenarios": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "living_things": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "action_words": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            },
                            "selected_primitive_schemas": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Interactive primitive schema types needed for this section (e.g., ['quizzes', 'definitions', 'flip_cards'])"
                            },
                            "builds_on_prior": {
                                "type": "boolean",
                                "description": "Whether this section requires understanding from previous sections"
                            },
                            "success_criteria": {
                                "type": "string",
                                "description": "How to assess if objective was taught (what student should be able to do)"
                            }
                        },
                        "required": [
                            "section_number",
                            "section_type",
                            "primary_objective",
                            "teaching_strategy",
                            "key_concepts_to_cover",
                            "recommended_primitives",
                            "selected_primitive_schemas",
                            "builds_on_prior",
                            "success_criteria"
                        ]
                    },
                    "description": "Ordered list of 2-6 section plans"
                },
                "overall_narrative_arc": {
                    "type": "string",
                    "description": "The story/flow connecting all sections (e.g., 'Students progress from recognizing rhymes to producing them independently')"
                },
                "prerequisite_check": {
                    "type": "string",
                    "description": "What prior knowledge students need before starting"
                }
            },
            "required": ["section_plans", "overall_narrative_arc", "prerequisite_check"]
        }
