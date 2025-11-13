"""
Tier 1: Learning Plan Generator
Decomposes learning objectives into a structured teaching plan with section strategies.
"""

from typing import List, Dict, Any
from pydantic import BaseModel, Field
from google import genai
from google.genai.types import GenerateContentConfig


class SectionPlan(BaseModel):
    """Plan for a single content section targeting specific learning objective(s)"""
    section_number: int = Field(description="Order of this section (1-based)")
    primary_objective: str = Field(description="The main learning objective this section teaches")
    teaching_strategy: str = Field(description="How to teach this objective (e.g., 'explicit instruction', 'guided practice', 'application')")
    key_concepts_to_cover: List[str] = Field(description="Core concepts from master context relevant to this objective")
    recommended_primitives: Dict[str, List[str]] = Field(
        description="Specific primitives to use (e.g., {'concrete_objects': ['cat', 'hat'], 'characters': ['Maya']})"
    )
    interactive_elements_focus: List[str] = Field(
        description="Types of interactive elements best suited for this objective"
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
        description="Ordered list of section plans (typically 4 sections)"
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
        subskill_description: str
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

        Returns:
            TeachingPlan with section strategies and primitive assignments
        """

        # Format primitives for prompt
        primitives_summary = self._format_primitives(context_primitives)

        prompt = f"""You are an expert educational content planner for {grade_level} students.

SUBSKILL: {subskill_description}

LEARNING OBJECTIVES (must ALL be explicitly taught):
{self._format_list(learning_objectives)}

CORE CONCEPTS TO COVER:
{self._format_list(core_concepts)}

KEY TERMINOLOGY:
{self._format_dict(key_terminology)}

AVAILABLE CONTEXT PRIMITIVES (use these for concrete examples):
{primitives_summary}

YOUR TASK:
Create a teaching plan that breaks down these learning objectives into 4 content sections.
Each section should:
1. Focus on teaching one specific learning objective explicitly
2. Use a clear teaching strategy (introduction, explicit instruction, guided practice, or application)
3. Select specific context primitives that make the objective concrete and engaging
4. Build logically on prior sections (progression from simple to complex)
5. Include clear success criteria for that objective

REQUIREMENTS:
- Create exactly 4 sections
- Every learning objective must be covered by at least one section
- Complex objectives may span multiple sections (e.g., introduction → practice → mastery)
- Use grade-appropriate teaching strategies for {grade_level}
- Select primitives that are culturally relevant and engaging
- Ensure logical flow (e.g., understand concept → recognize examples → produce own examples → apply in context)

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
                                "description": "Order of this section (1-4)"
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
                            "interactive_elements_focus": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Types of interactive elements best for this objective (e.g., 'audio-example', 'practice-prompt', 'concept-box')"
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
                            "primary_objective",
                            "teaching_strategy",
                            "key_concepts_to_cover",
                            "recommended_primitives",
                            "interactive_elements_focus",
                            "builds_on_prior",
                            "success_criteria"
                        ]
                    },
                    "description": "Ordered list of 4 section plans"
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
