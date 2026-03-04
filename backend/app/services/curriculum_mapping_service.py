"""
Curriculum Mapping Service

Resolves Lumina lesson context (topic, intent, grade level) to curriculum
skill/subskill IDs using Gemini AI. Handles the case where generic primitives
(e.g. compare-contrast) are used to test specific curriculum skills
(e.g. rhyming → phonological awareness).

Results are cached in-memory so each unique topic+intent combination only
triggers one Gemini call.
"""

import json
import logging
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional

from app.services.curriculum_service import CurriculumService
from app.services.gemini_generate import GeminiGenerateService

logger = logging.getLogger(__name__)


@dataclass
class CurriculumMapping:
    """Result of resolving lesson context to a curriculum entry."""
    subject: str
    skill_id: str
    skill_description: str
    subskill_id: str
    subskill_description: str
    confidence: float  # 0.0–1.0
    resolved_by: str   # "cache", "gemini", "fallback"

    def to_dict(self) -> Dict:
        return asdict(self)


# Minimum confidence to accept a Gemini mapping
_CONFIDENCE_THRESHOLD = 0.3


class CurriculumMappingService:
    """Resolves Lumina lesson context to curriculum skill/subskill IDs."""

    def __init__(
        self,
        curriculum_service: CurriculumService,
        gemini_service: GeminiGenerateService,
    ):
        self.curriculum_service = curriculum_service
        self.gemini_service = gemini_service
        # In-memory cache: normalised key → CurriculumMapping
        self._cache: Dict[str, CurriculumMapping] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def resolve_mapping(
        self,
        topic: str,
        component_intent: str,
        grade_level: str,
        primitive_type: str,
        subject_hint: Optional[str] = None,
    ) -> CurriculumMapping:
        """
        Resolve lesson context to a curriculum mapping.

        1. Check in-memory cache.
        2. On miss, load curriculum hierarchy from BigQuery.
        3. Ask Gemini to match topic+intent against the hierarchy.
        4. Cache and return.

        Returns a CurriculumMapping. If confidence < threshold the caller
        should fall back to defaults.
        """
        cache_key = self._build_cache_key(topic, component_intent, grade_level)

        # 1. Cache hit
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            logger.info(f"[CURRICULUM_MAPPING] Cache hit: {cached.subject}/{cached.skill_id}/{cached.subskill_id}")
            return CurriculumMapping(
                subject=cached.subject,
                skill_id=cached.skill_id,
                skill_description=cached.skill_description,
                subskill_id=cached.subskill_id,
                subskill_description=cached.subskill_description,
                confidence=cached.confidence,
                resolved_by="cache",
            )

        # 2. Load curriculum hierarchy
        try:
            if subject_hint:
                subject_names = [subject_hint]
            else:
                # get_available_subjects() returns List[Dict] with subject_id/subject_name —
                # extract the subject_id (e.g. "SCIENCE") which get_curriculum() accepts.
                subject_dicts = await self.curriculum_service.get_available_subjects()
                subject_names = [
                    s.get("subject_id") or s.get("subject_name", "")
                    for s in subject_dicts
                    if isinstance(s, dict)
                ]
                logger.info(f"[CURRICULUM_MAPPING] Resolved {len(subject_names)} subjects: {subject_names}")
            curriculum_summary = await self._build_curriculum_summary(subject_names)
        except Exception as e:
            logger.warning(f"[CURRICULUM_MAPPING] Failed to load curriculum: {e}")
            return self._fallback(primitive_type)

        if not curriculum_summary or curriculum_summary == "[]":
            logger.warning("[CURRICULUM_MAPPING] Empty curriculum — falling back")
            return self._fallback(primitive_type)

        # 3. Ask Gemini
        try:
            mapping = await self._resolve_with_gemini(
                topic=topic,
                component_intent=component_intent,
                grade_level=grade_level,
                primitive_type=primitive_type,
                curriculum_summary=curriculum_summary,
            )
        except Exception as e:
            logger.warning(f"[CURRICULUM_MAPPING] Gemini resolution failed: {e}")
            return self._fallback(primitive_type)

        # 4. Cache and return
        self._cache[cache_key] = mapping
        logger.info(
            f"[CURRICULUM_MAPPING] Resolved via Gemini: "
            f"{mapping.subject}/{mapping.skill_id}/{mapping.subskill_id} "
            f"(confidence={mapping.confidence:.2f})"
        )
        return mapping

    def clear_cache(self) -> None:
        """Clear the mapping cache (e.g. after curriculum data changes)."""
        self._cache.clear()
        logger.info("[CURRICULUM_MAPPING] Cache cleared")

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _build_cache_key(topic: str, intent: str, grade: str) -> str:
        return f"{topic.strip().lower()}|{intent.strip().lower()}|{grade.strip().lower()}"

    async def _build_curriculum_summary(self, subjects: List[str]) -> str:
        """Build a compact JSON summary of the curriculum hierarchy for the Gemini prompt."""
        summary = []
        for subject in subjects:
            try:
                units = await self.curriculum_service.get_curriculum(subject)
                if not units:
                    continue
                subject_entry = {"subject": subject, "skills": []}
                for unit in units:
                    for skill in unit.get("skills", []):
                        skill_entry = {
                            "skill_id": skill["id"],
                            "skill_description": skill["description"],
                            "subskills": [
                                {"id": ss["id"], "description": ss["description"]}
                                for ss in skill.get("subskills", [])
                            ],
                        }
                        subject_entry["skills"].append(skill_entry)
                summary.append(subject_entry)
            except Exception as e:
                logger.warning(f"[CURRICULUM_MAPPING] Skipping subject {subject}: {e}")
        return json.dumps(summary, indent=None)

    async def _resolve_with_gemini(
        self,
        topic: str,
        component_intent: str,
        grade_level: str,
        primitive_type: str,
        curriculum_summary: str,
    ) -> CurriculumMapping:
        """Call Gemini to match lesson context against the curriculum."""
        prompt = f"""You are a curriculum alignment assistant. Given a lesson context and a curriculum hierarchy, find the single best matching curriculum subskill.

LESSON CONTEXT:
- Topic: {topic}
- Grade Level: {grade_level}
- Primitive Type: {primitive_type}
- Component Intent: {component_intent}

CURRICULUM HIERARCHY:
{curriculum_summary}

Return ONLY a JSON object with these fields:
{{
  "subject": "the matching subject",
  "skill_id": "the matching skill ID",
  "skill_description": "the matching skill description",
  "subskill_id": "the matching subskill ID",
  "subskill_description": "the matching subskill description",
  "confidence": 0.0 to 1.0
}}

Rules:
- Pick the SINGLE best match. If no good match exists, set confidence below 0.3.
- The primitive type is generic (e.g. "compare-contrast" can test many skills). Focus on the topic and intent to determine the actual curriculum skill being assessed.
- Return ONLY valid JSON, no explanation."""

        raw = await self.gemini_service.generate_response(prompt, clean_json=True)

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.error(f"[CURRICULUM_MAPPING] Failed to parse Gemini response: {raw[:200]}")
            return self._fallback(primitive_type)

        return CurriculumMapping(
            subject=data.get("subject", "unknown"),
            skill_id=data.get("skill_id", f"{primitive_type}_skill"),
            skill_description=data.get("skill_description", ""),
            subskill_id=data.get("subskill_id", f"{primitive_type}_subskill"),
            subskill_description=data.get("subskill_description", ""),
            confidence=float(data.get("confidence", 0.0)),
            resolved_by="gemini",
        )

    @staticmethod
    def _fallback(primitive_type: str) -> CurriculumMapping:
        """Return a low-confidence fallback mapping."""
        return CurriculumMapping(
            subject="unknown",
            skill_id=f"{primitive_type}_skill",
            skill_description="",
            subskill_id=f"{primitive_type}_subskill",
            subskill_description="",
            confidence=0.0,
            resolved_by="fallback",
        )
