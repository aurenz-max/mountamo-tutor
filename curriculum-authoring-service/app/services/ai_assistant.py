"""
AI-powered curriculum content generation service using Gemini
"""

import logging
import json
from typing import Dict, List, Any, Optional
import google.generativeai as genai

from app.core.config import settings
from app.models.curriculum import UnitCreate, SkillCreate, SubskillCreate

logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)


class AIAssistant:
    """AI assistant for curriculum content generation"""

    def __init__(self):
        self.model = genai.GenerativeModel(settings.GEMINI_MODEL)

    async def generate_unit(
        self,
        subject: str,
        grade_level: str,
        topic_prompt: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a complete curriculum unit from a topic prompt
        Returns: {unit: UnitCreate, skills: [SkillCreate], subskills: [SubskillCreate]}
        """

        system_prompt = f"""You are an expert curriculum designer for {subject} at {grade_level} level.

Generate a complete instructional unit based on the following topic: "{topic_prompt}"

{f'Additional context: {context}' if context else ''}

Your output must be a JSON object with this exact structure:
{{
  "unit": {{
    "unit_id": "UNIQUE_ID",
    "unit_title": "Unit Title",
    "description": "Brief description of the unit"
  }},
  "skills": [
    {{
      "skill_id": "UNIQUE_SKILL_ID",
      "skill_description": "What students will learn",
      "skill_order": 1
    }}
  ],
  "subskills": [
    {{
      "subskill_id": "UNIQUE_SUBSKILL_ID",
      "skill_id": "PARENT_SKILL_ID",
      "subskill_description": "Specific learning objective",
      "subskill_order": 1,
      "difficulty_start": 1,
      "difficulty_end": 5,
      "target_difficulty": 3
    }}
  ]
}}

Guidelines:
1. Use clear, hierarchical ID patterns (e.g., UNIT001, SKILL001-01, SUBSKILL001-01-A)
2. Create 2-4 skills per unit
3. Create 3-7 subskills per skill
4. Difficulty scale: 1 (easiest) to 10 (hardest)
5. Ensure progression: subskills build on each other
6. Be pedagogically sound and age-appropriate

Return ONLY valid JSON, no markdown formatting."""

        try:
            response = self.model.generate_content(
                system_prompt,
                generation_config={
                    "temperature": settings.GEMINI_TEMPERATURE,
                    "max_output_tokens": settings.GEMINI_MAX_TOKENS,
                }
            )

            # Parse the response
            content = response.text.strip()

            # Remove markdown code blocks if present
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()
            elif content.startswith("```"):
                content = content.replace("```", "").strip()

            result = json.loads(content)

            logger.info(f"✅ AI generated unit: {result['unit']['unit_title']}")
            return result

        except Exception as e:
            logger.error(f"❌ AI generation failed: {e}")
            raise

    async def generate_skill(
        self,
        subject: str,
        unit_title: str,
        skill_prompt: str
    ) -> Dict[str, Any]:
        """Generate a single skill with subskills"""

        system_prompt = f"""You are an expert curriculum designer for {subject}.

Generate a skill for the unit "{unit_title}" based on: "{skill_prompt}"

Return JSON with this structure:
{{
  "skill": {{
    "skill_id": "UNIQUE_ID",
    "skill_description": "What students will learn"
  }},
  "subskills": [
    {{
      "subskill_id": "UNIQUE_ID",
      "subskill_description": "Specific objective",
      "difficulty_start": 1,
      "difficulty_end": 5,
      "target_difficulty": 3
    }}
  ]
}}

Return ONLY valid JSON."""

        try:
            response = self.model.generate_content(system_prompt)
            content = response.text.strip()

            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()

            result = json.loads(content)
            return result

        except Exception as e:
            logger.error(f"❌ AI skill generation failed: {e}")
            raise

    async def suggest_prerequisites(
        self,
        subject: str,
        entity_id: str,
        entity_description: str,
        available_prerequisites: List[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """
        Suggest prerequisite relationships for an entity
        """

        prereq_list = "\n".join([
            f"- {p['id']}: {p['description']}"
            for p in available_prerequisites
        ])

        system_prompt = f"""You are a curriculum expert for {subject}.

Given this learning objective:
"{entity_id}: {entity_description}"

And these available prerequisite skills/subskills:
{prereq_list}

Suggest which skills should be prerequisites (mastered before) this objective.

Return JSON array of suggested prerequisites:
[
  {{
    "prerequisite_id": "ID",
    "min_proficiency_threshold": 0.8,
    "reason": "Brief explanation"
  }}
]

Only suggest prerequisites that are genuinely necessary. Return empty array if none needed.
Return ONLY valid JSON."""

        try:
            response = self.model.generate_content(system_prompt)
            content = response.text.strip()

            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()

            result = json.loads(content)
            return result

        except Exception as e:
            logger.error(f"❌ AI prerequisite suggestion failed: {e}")
            return []

    async def improve_description(
        self,
        original_description: str,
        entity_type: str,
        subject: str
    ) -> str:
        """Improve a curriculum description using AI"""

        system_prompt = f"""You are an expert curriculum writer for {subject}.

Improve this {entity_type} description:
"{original_description}"

Make it:
1. Clear and concise
2. Action-oriented (what students will DO)
3. Measurable
4. Age-appropriate

Return ONLY the improved description, no explanations."""

        try:
            response = self.model.generate_content(system_prompt)
            improved = response.text.strip().strip('"')
            return improved

        except Exception as e:
            logger.error(f"❌ AI description improvement failed: {e}")
            return original_description


# Global instance
ai_assistant = AIAssistant()
