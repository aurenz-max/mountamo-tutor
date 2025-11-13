"""
Tier 2: Section Generator
Generates individual reading sections focused on specific learning objectives.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

from google import genai
from google.genai.types import GenerateContentConfig

from app.models.content import ReadingSection
from app.schemas.interactive_primitives import get_all_primitive_schemas

logger = logging.getLogger(__name__)


class SectionGenerator:
    """Generates focused reading sections that explicitly teach specific learning objectives"""

    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    async def generate_section(
        self,
        section_number: int,
        primary_objective: str,
        teaching_strategy: str,
        key_concepts: List[str],
        key_terminology: Dict[str, str],
        recommended_primitives: Dict[str, List[str]],
        interactive_elements_focus: List[str],
        grade_level: str,
        subskill_description: str,
        prior_sections_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a single reading section focused on one learning objective.

        Args:
            section_number: Order of this section (1-4)
            primary_objective: The specific learning objective this section teaches
            teaching_strategy: How to teach (e.g., "explicit instruction", "guided practice")
            key_concepts: Core concepts to cover from master context
            key_terminology: Key terms with definitions
            recommended_primitives: Specific examples to use (characters, objects, scenarios)
            interactive_elements_focus: Types of interactive primitives to prioritize
            grade_level: Target grade level
            subskill_description: Description of the subskill
            prior_sections_context: Optional summary of what was taught in prior sections

        Returns:
            Dictionary with section data (heading, content, primitives, etc.)
        """
        logger.info(f"📝 Generating section {section_number} for objective: {primary_objective}")

        # Format primitives for the prompt
        primitives_str = self._format_primitives(recommended_primitives)
        terminology_str = self._format_terminology(key_terminology)
        concepts_str = ', '.join(key_concepts)

        # Build context from prior sections
        prior_context = ""
        if prior_sections_context:
            prior_context = f"\n\nPRIOR SECTIONS COVERED:\n{prior_sections_context}\nBuild on this foundation without repeating."

        prompt = f"""You are creating Section {section_number} of reading content for {grade_level} students learning {subskill_description}.

PRIMARY LEARNING OBJECTIVE FOR THIS SECTION:
{primary_objective}

TEACHING STRATEGY:
{teaching_strategy}

CORE CONCEPTS TO TEACH:
{concepts_str}

KEY TERMINOLOGY TO USE:
{terminology_str}

RECOMMENDED EXAMPLES (use these specific items):
{primitives_str}
{prior_context}

YOUR TASK:
Create a reading section that EXPLICITLY TEACHES the learning objective: "{primary_objective}"

CRITICAL REQUIREMENTS:
1. **Directly Address the Objective**: The section content must specifically teach how to {primary_objective.lower()}
2. **Concrete Examples**: Use the recommended primitives (characters, objects, scenarios) to make the objective tangible
3. **Step-by-Step Instruction**: Break down the skill into clear, actionable steps appropriate for {grade_level}
4. **Practice Opportunities**: Include interactive elements where students can try the skill
5. **Clear Success Criteria**: Students should know what success looks like

SECTION STRUCTURE:
- **Heading**: Clear, engaging title that hints at the objective
- **Content Text**: 150-250 words of focused instruction on THIS SPECIFIC OBJECTIVE
  - Start with why this skill matters
  - Explain the skill with concrete examples using recommended primitives
  - Provide step-by-step guidance
  - Use {grade_level}-appropriate language and sentence structure

- **Interactive Primitives**: Include {len(interactive_elements_focus)} interactive elements focused on:
  {', '.join(interactive_elements_focus)}

INTERACTIVE PRIMITIVES TO USE:
- **alerts**: Highlight key points, tips, or warnings (styles: info/warning/success/tip)
- **definitions**: Define key terms when first introduced
- **quizzes**: Quick knowledge checks with questions and answers
- **practice_prompts**: Prompt students to try the skill (use quiz format with open-ended questions)
- **audio_examples**: For listening skills (use alert with style='info' and title like 'Listen and Try')
- **concept_boxes**: Highlight important concepts (use alert with style='success')
- **scenario_questions**: Apply the skill to a scenario using recommended primitives

EXAMPLE for rhyming objective "identify the rhyming word from three spoken words":

```
Heading: "Finding Rhyming Words: Listen for the Match!"

Content: "When you hear three words, your job is to find which two words rhyme! Rhyming words have the same sound at the end. Let's practice together. Imagine you hear: 'cat', 'dog', and 'hat'. Listen to the end of each word. 'Cat' ends with '-at'. 'Dog' ends with '-og'. 'Hat' ends with '-at'. Cat and hat rhyme! They both have that '-at' sound. Now you try! When you hear three words, listen carefully to the endings. Find the two that sound the same."

Interactive Primitives:
- Alert (tip style): "Listening Tip: Focus on the END of each word. That's where rhymes hide!"
- Definition: term="rhyme", definition="Words that have the same sound at the end"
- Quiz: question="Listen: 'star', 'car', 'book'. Which two rhyme?", answer="star and car", explanation="Both 'star' and 'car' end with the '-ar' sound!"
- Alert (info style, simulates audio): title="Try It: Listen and Find the Rhyme", content="Imagine hearing: 'sun', 'run', 'tree'. Which two rhyme? (Answer: sun and run!)"
```

Return structured JSON with:
- heading: Clear section title
- content: 150-250 words of focused instruction
- key_terms_used: List of key terms from terminology that appear in this section
- concepts_covered: List of core concepts addressed
- All interactive primitives as structured objects

Make this section explicitly teach "{primary_objective}" with concrete, grade-appropriate examples."""

        schema = self._get_section_schema()

        response = await self.client.aio.models.generate_content(
            model='gemini-flash-lite-latest',
            contents=prompt,
            config=GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=schema,
                temperature=0.4,
            )
        )

        # Parse response
        section_data = json.loads(response.text)
        logger.info(f"✅ Section {section_number} generated: {section_data['heading']}")

        return section_data

    def _format_primitives(self, primitives: Dict[str, List[str]]) -> str:
        """Format recommended primitives for the prompt"""
        lines = []
        for key, values in primitives.items():
            if values:
                formatted_key = key.replace('_', ' ').title()
                lines.append(f"  • {formatted_key}: {', '.join(values)}")
        return '\n'.join(lines) if lines else "  (Use general examples appropriate for the skill)"

    def _format_terminology(self, terminology: Dict[str, str]) -> str:
        """Format terminology dictionary"""
        return '\n'.join(f"  • {term}: {defn}" for term, defn in terminology.items())

    def _get_section_schema(self) -> dict:
        """Get JSON schema for section generation"""
        # Get all interactive primitive schemas from shared module
        primitive_schemas = get_all_primitive_schemas()

        # Build section properties
        section_properties = {
            "heading": {
                "type": "string",
                "description": "Clear, engaging section heading"
            },
            "content": {
                "type": "string",
                "description": "Main section content (150-250 words focused on the objective)"
            },
            "key_terms_used": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Key terms from terminology used in this section"
            },
            "concepts_covered": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Core concepts covered in this section"
            }
        }

        # Add all 17 interactive primitive schemas
        section_properties.update(primitive_schemas)

        return {
            "type": "object",
            "properties": section_properties,
            "required": ["heading", "content", "key_terms_used", "concepts_covered"]
        }
