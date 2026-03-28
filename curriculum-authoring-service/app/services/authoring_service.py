"""
PRD-Driven Authoring Service — Generate → Preview → Accept/Reject

All state lives in curriculum_drafts. No separate authoring_previews collection.

  1. author_unit()  → Gemini generates → writes to drafts as pending unit
  2. accept_unit()  → flips status to accepted (1 write)
  3. reject_unit()  → flips status to rejected (1 write)
  4. regenerate()   → marks old rejected, inserts new pending (1 write)
  5. list_previews() → reads from drafts, filters by status
"""

import logging
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

from google import genai
from google.genai import types

from app.core.config import settings
from app.db.draft_curriculum_service import draft_curriculum
from app.services.curriculum_manager import curriculum_manager
from app.services.version_control import version_control
from app.models.authoring import (
    AuthorUnitRequest,
    GenerateSkillRequest,
    UnitPreview,
    GeneratedSkill,
    GeneratedSubskill,
    LuminaCoverage,
)
from app.models.curriculum import SubjectCreate
from app.models.versioning import VersionCreate

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------ #
#  Lumina Primitive Catalog (injected into every Gemini prompt)
# ------------------------------------------------------------------ #

LUMINA_PRIMITIVE_CATALOG = """
## Available Lumina Primitives (151 total)

Source of truth: my-tutoring-app/src/components/lumina/service/manifest/catalog/

### Core (17)
curator-brief, concept-card-grid, comparison-panel, generative-table, custom-visual, formula-card, feature-exhibit, annotated-example, nested-hierarchy, take-home-activity, graph-board, foundation-explorer, fast-fact, fact-file, how-it-works, timeline-explorer, vocabulary-explorer

### Math (42)
bar-model, number-line, base-ten-blocks, fraction-circles, fraction-bar, place-value-chart, area-model, array-grid, double-number-line, tape-diagram, factor-tree, ratio-table, percent-bar, balance-scale, function-machine, coordinate-graph, slope-triangle, systems-equations-visualizer, matrix-display, dot-plot, histogram, two-way-table, ten-frame, counting-board, comparison-builder, pattern-builder, skip-counting-runner, regrouping-workbench, multiplication-explorer, measurement-tools, shape-builder, number-sequencer, number-bond, addition-subtraction-scene, ordinal-line, sorting-station, shape-sorter, 3d-shape-explorer, shape-tracer, math-fact-fluency, strategy-picker, number-tracer

### Engineering (22)
lever-lab, pulley-system-builder, ramp-lab, wheel-axle-explorer, gear-train-builder, bridge-builder, tower-stacker, shape-strength-tester, foundation-builder, excavator-arm-simulator, dump-truck-loader, construction-sequence-planner, blueprint-canvas, machine-profile, flight-forces-explorer, airfoil-lab, vehicle-comparison-lab, propulsion-lab, propulsion-timeline, paper-airplane-designer, engine-explorer, vehicle-design-studio

### Science / Chemistry (12)
molecule-viewer, periodic-table, matter-explorer, reaction-lab, equation-balancer, energy-of-reactions, states-of-matter, mixing-and-dissolving, atom-builder, molecule-constructor, ph-explorer, safety-lab

### Biology (17)
organism-card, species-profile, classification-sorter, life-cycle-sequencer, body-system-explorer, habitat-diorama, bio-compare-contrast, bio-process-animator, microscope-viewer, food-web-builder, adaptation-investigator, cell-builder, inheritance-lab, dna-explorer, protein-folder, energy-cycle-engine, evolution-timeline

### Astronomy (8)
solar-system-explorer, scale-comparator, day-night-seasons, moon-phases-lab, rocket-builder, orbit-mechanics-lab, mission-planner, telescope-simulator

### Physics (1)
motion-diagram

### Literacy (28)
sentence-analyzer, word-builder, phonics-blender, decodable-reader, rhyme-studio, syllable-clapper, phoneme-explorer, sound-swap, letter-spotter, letter-sound-link, cvc-speller, word-workout, story-map, character-web, poetry-lab, genre-explorer, text-structure-analyzer, evidence-finder, paragraph-architect, story-planner, opinion-builder, revision-workshop, listen-and-respond, read-aloud-studio, sentence-builder, context-clues-detective, figurative-language-finder, spelling-pattern-explorer

### Media (4)
media-player, flashcard-deck, image-comparison, image-panel

### Assessment (2)
knowledge-check, scale-spectrum

### General Problem Types (always available)
multiple-choice, true-false, fill-in-blanks, matching-activity, sequencing-activity, categorization-activity, short-answer, drag-and-drop

### AI Tutor Session
ai-tutor-session (Gemini Live — for oral/conversational skills like reading fluency, retelling, oral vocabulary, listening comprehension)
"""

# ------------------------------------------------------------------ #
#  Response schema for structured JSON output (Gemini JSON mode)
# ------------------------------------------------------------------ #

UNIT_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    description="A curriculum unit containing skills and subskills",
    properties={
        "skills": types.Schema(
            type=types.Type.ARRAY,
            description="Ordered list of skills in pedagogical progression",
            items=types.Schema(
                type=types.Type.OBJECT,
                description="A skill grouping related subskills under one learning goal",
                properties={
                    "skill_id": types.Schema(
                        type=types.Type.STRING,
                        description="Skill identifier following UNIT_ID-XX pattern (e.g., LA001-01)",
                    ),
                    "skill_description": types.Schema(
                        type=types.Type.STRING,
                        description="Short, human-readable skill title for the curriculum browser (e.g., 'Short Vowel CVC Decoding', 'Rhyme Recognition & Production', 'Phoneme Blending'). NOT an internal design note or paragraph.",
                    ),
                    "skill_order": types.Schema(
                        type=types.Type.INTEGER,
                        description="Position in the skill sequence (1-based)",
                    ),
                    "subskills": types.Schema(
                        type=types.Type.ARRAY,
                        description="Ordered list of subskills within this skill",
                        items=types.Schema(
                            type=types.Type.OBJECT,
                            description="A single assessable subskill targeting a Lumina primitive",
                            properties={
                                "subskill_id": types.Schema(
                                    type=types.Type.STRING,
                                    description="Subskill identifier following UNIT_ID-XX-y pattern (e.g., LA001-01-a)",
                                ),
                                "subskill_description": types.Schema(
                                    type=types.Type.STRING,
                                    description="Rich description starting with a natural descriptive sentence (no label prefixes), then Focus, Examples (6-10 concrete items), and Constraints sections. This is the ONLY instruction Lumina uses to generate content.",
                                ),
                                "subskill_order": types.Schema(
                                    type=types.Type.INTEGER,
                                    description="Position within the skill (1-based), ordered from easier to harder",
                                ),
                                "difficulty_start": types.Schema(
                                    type=types.Type.NUMBER,
                                    description="Entry-level difficulty (1.0-3.0 for Grade 1)",
                                ),
                                "difficulty_end": types.Schema(
                                    type=types.Type.NUMBER,
                                    description="Mastery-challenge difficulty (2.0-5.0 for Grade 1)",
                                ),
                                "target_difficulty": types.Schema(
                                    type=types.Type.NUMBER,
                                    description="Sweet-spot difficulty for typical practice (1.0-3.0 for Grade 1)",
                                ),
                                "target_primitive": types.Schema(
                                    type=types.Type.STRING,
                                    description="Lumina primitive name from the catalog (e.g., phonics-blender, cvc-speller, sentence-builder, ai-tutor-session)",
                                ),
                                "standards_alignment": types.Schema(
                                    type=types.Type.STRING,
                                    description="Common Core or NGSS standard code (e.g., 1.RF.3a, 1.L.1f)",
                                ),
                            },
                            required=[
                                "subskill_id", "subskill_description", "subskill_order",
                                "difficulty_start", "difficulty_end", "target_difficulty",
                                "target_primitive", "standards_alignment",
                            ],
                        ),
                    ),
                },
                required=["skill_id", "skill_description", "skill_order", "subskills"],
            ),
        ),
    },
    required=["skills"],
)

# Single-skill schema — returns subskills array directly (no skills wrapper)
SKILL_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    description="A single skill with its subskills",
    properties={
        "skill_description": types.Schema(
            type=types.Type.STRING,
            description="Short, human-readable skill title for the curriculum browser (e.g., 'Soft C and G', 'Silent Letter Patterns'). NOT a paragraph.",
        ),
        "subskills": types.Schema(
            type=types.Type.ARRAY,
            description="Ordered list of subskills within this skill",
            items=types.Schema(
                type=types.Type.OBJECT,
                description="A single assessable subskill targeting a Lumina primitive",
                properties={
                    "subskill_id": types.Schema(
                        type=types.Type.STRING,
                        description="Subskill identifier following SKILL_ID-y pattern (e.g., LA001-10-a)",
                    ),
                    "subskill_description": types.Schema(
                        type=types.Type.STRING,
                        description="Rich description starting with a natural descriptive sentence (no label prefixes), then Focus, Examples (6-10 concrete items), and Constraints sections. This is the ONLY instruction Lumina uses to generate content.",
                    ),
                    "subskill_order": types.Schema(
                        type=types.Type.INTEGER,
                        description="Position within the skill (1-based), ordered from easier to harder",
                    ),
                    "difficulty_start": types.Schema(
                        type=types.Type.NUMBER,
                        description="Entry-level difficulty (1.0-3.0 for Grade 1)",
                    ),
                    "difficulty_end": types.Schema(
                        type=types.Type.NUMBER,
                        description="Mastery-challenge difficulty (2.0-5.0 for Grade 1)",
                    ),
                    "target_difficulty": types.Schema(
                        type=types.Type.NUMBER,
                        description="Sweet-spot difficulty for typical practice",
                    ),
                    "target_primitive": types.Schema(
                        type=types.Type.STRING,
                        description="Lumina primitive name from the catalog (e.g., phonics-blender, cvc-speller)",
                    ),
                    "standards_alignment": types.Schema(
                        type=types.Type.STRING,
                        description="Common Core or NGSS standard code (e.g., 1.RF.3a)",
                    ),
                },
                required=[
                    "subskill_id", "subskill_description", "subskill_order",
                    "difficulty_start", "difficulty_end", "target_difficulty",
                    "target_primitive", "standards_alignment",
                ],
            ),
        ),
    },
    required=["skill_description", "subskills"],
)


class AuthoringService:
    """
    Orchestrates PRD-driven curriculum authoring with Gemini.

    All state lives in curriculum_drafts — no separate preview collection.
    """

    # Model for structured curriculum generation
    AUTHORING_MODEL = "gemini-3.1-flash-lite-preview"

    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # ------------------------------------------------------------------ #
    #  Generate Unit Preview → write to drafts as pending
    # ------------------------------------------------------------------ #

    async def author_unit(self, request: AuthorUnitRequest) -> UnitPreview:
        """Generate a Lumina-first unit via Gemini and store as pending in drafts."""

        prompt = self._build_generation_prompt(request)

        try:
            response = self.client.models.generate_content(
                model=self.AUTHORING_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=UNIT_RESPONSE_SCHEMA,
                    temperature=1,
                    max_output_tokens=65536,
                ),
            )

            raw = json.loads(response.text)

            # Parse into typed models
            skills = self._parse_skills(raw.get("skills", []))
            coverage = self._compute_coverage(skills)
            preview_id = str(uuid.uuid4())
            now = datetime.utcnow()

            # Build skills data for the draft document
            skills_data = self._skills_to_draft_format(skills)

            # Write directly to curriculum_drafts as a pending unit
            await draft_curriculum.add_unit_with_content(
                grade=request.grade,
                subject_id=request.subject_id,
                unit={
                    "unit_id": request.unit_id,
                    "unit_title": request.unit_title,
                    "unit_order": request.unit_order,
                    "description": request.unit_description,
                    # Authoring metadata
                    "preview_id": preview_id,
                    "status": "pending",
                    "authoring_created_at": now.isoformat(),
                    "lumina_coverage": coverage.model_dump(),
                },
                skills=skills_data,
            )

            # Build the API response model
            preview = UnitPreview(
                preview_id=preview_id,
                subject_id=request.subject_id,
                grade=request.grade,
                unit_id=request.unit_id,
                unit_title=request.unit_title,
                unit_description=request.unit_description,
                unit_order=request.unit_order,
                skills=skills,
                lumina_coverage=coverage,
                status="pending",
                created_at=now,
            )

            logger.info(
                f"Generated preview {preview_id} for {request.unit_id}: "
                f"{len(skills)} skills, {coverage.total_subskills} subskills, "
                f"{coverage.coverage_pct:.0f}% Lumina coverage → saved to drafts"
            )

            return preview

        except json.JSONDecodeError as e:
            logger.error(f"Gemini returned invalid JSON: {e}")
            logger.error(f"Raw response: {response.text[:500]}")
            raise ValueError(f"AI generation returned invalid JSON: {e}")
        except Exception as e:
            logger.error(f"Unit generation failed: {e}")
            raise

    # ------------------------------------------------------------------ #
    #  Generate Skill → append to existing unit in drafts
    # ------------------------------------------------------------------ #

    async def generate_skill(self, request: GenerateSkillRequest) -> Dict[str, Any]:
        """Generate a single skill with subskills via Gemini and append to an existing unit."""

        # Verify the unit exists
        unit = await draft_curriculum.find_unit(request.grade, request.subject_id, request.unit_id)
        if not unit:
            raise ValueError(f"Unit {request.unit_id} not found in {request.subject_id} (grade {request.grade})")

        # Determine skill_order if not provided
        skill_order = request.skill_order or (len(unit.get("skills", [])) + 1)

        prompt = self._build_skill_prompt(request, skill_order)

        try:
            response = self.client.models.generate_content(
                model=self.AUTHORING_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SKILL_RESPONSE_SCHEMA,
                    temperature=1,
                    max_output_tokens=16384,
                ),
            )

            raw = json.loads(response.text)

            # Build subskills
            subskills = []
            for rss in raw.get("subskills", []):
                subskills.append(GeneratedSubskill(
                    subskill_id=rss.get("subskill_id", ""),
                    subskill_description=rss.get("subskill_description", ""),
                    subskill_order=rss.get("subskill_order", 1),
                    difficulty_start=float(rss.get("difficulty_start", 1.0)),
                    difficulty_end=float(rss.get("difficulty_end", 5.0)),
                    target_difficulty=float(rss.get("target_difficulty", 3.0)),
                    target_primitive=rss.get("target_primitive", ""),
                    standards_alignment=rss.get("standards_alignment"),
                ))

            skill = GeneratedSkill(
                skill_id=request.skill_id,
                skill_description=raw.get("skill_description", request.skill_title),
                skill_order=skill_order,
                subskills=subskills,
            )

            # Compute coverage for just this skill
            coverage = self._compute_coverage([skill])

            # Write to drafts — append skill to the unit
            skill_data = {
                "skill_id": skill.skill_id,
                "skill_description": skill.skill_description,
                "skill_order": skill.skill_order,
                "subskills": [
                    {
                        "subskill_id": ss.subskill_id,
                        "subskill_description": ss.subskill_description,
                        "subskill_order": ss.subskill_order,
                        "difficulty_start": ss.difficulty_start,
                        "difficulty_end": ss.difficulty_end,
                        "target_difficulty": ss.target_difficulty,
                        "target_primitive": ss.target_primitive,
                        "standards_alignment": ss.standards_alignment,
                    }
                    for ss in subskills
                ],
            }

            # Check if skill already exists — if so, append subskills to it
            existing = await draft_curriculum.find_skill(
                request.grade, request.subject_id, request.skill_id
            )
            if existing:
                # Append each subskill to the existing skill
                for ss_data in skill_data["subskills"]:
                    await draft_curriculum.add_subskill(
                        request.grade, request.subject_id, request.skill_id, ss_data
                    )
                action = f"appended {len(subskills)} subskills to existing skill"
            else:
                await draft_curriculum.add_skill(
                    request.grade, request.subject_id, request.unit_id, skill_data
                )
                action = "created new skill"

            logger.info(
                f"Generated skill {request.skill_id} for {request.unit_id}: "
                f"{len(subskills)} subskills, {coverage.coverage_pct:.0f}% Lumina coverage → {action}"
            )

            return {
                "skill": skill,
                "lumina_coverage": coverage,
                "unit_id": request.unit_id,
                "subject_id": request.subject_id,
                "grade": request.grade,
                "message": f"Generated {request.skill_id}: {len(subskills)} subskills, "
                           f"{coverage.coverage_pct:.0f}% Lumina coverage. Appended to {request.unit_id}.",
            }

        except json.JSONDecodeError as e:
            logger.error(f"Gemini returned invalid JSON for skill generation: {e}")
            logger.error(f"Raw response: {response.text[:500]}")
            raise ValueError(f"AI generation returned invalid JSON: {e}")
        except Exception as e:
            logger.error(f"Skill generation failed: {e}")
            raise

    def _build_skill_prompt(self, request: GenerateSkillRequest, skill_order: int) -> str:
        """Build a Gemini prompt for generating a single skill with subskills."""

        return f"""You are an expert curriculum designer authoring content for the Lumina AI tutoring platform.

## Task

Generate subskills for a single skill within an existing curriculum unit.

**Grade:** {request.grade}
**Unit:** {request.unit_id}
**Skill ID:** {request.skill_id}
**Skill Title:** {request.skill_title}
**Skill Order:** {skill_order}
**Number of subskills:** {request.num_subskills}

## PRD Context

{request.prd_context}

## CRITICAL: Lumina-First Design Principle

**Every subskill MUST target a named Lumina primitive, problem type, or AI tutor session.**

A subskill that cannot be rendered, practiced, and evaluated through a Lumina primitive is NOT valid.

{LUMINA_PRIMITIVE_CATALOG}

## ID Convention

- Subskill IDs: `{request.skill_id}-Y` where Y is a lowercase letter (e.g., {request.skill_id}-a, {request.skill_id}-b)

## Difficulty Calibration (Grade {request.grade})

- difficulty_start: 1-3 (entry point)
- difficulty_end: 3-7 (mastery challenge)
- target_difficulty: 2-5 (sweet spot)
- Subskills should progress from easier to harder.

## CRITICAL: Rich Subskill Descriptions

The subskill_description is the ONLY instruction Lumina has to generate content. Every subskill description MUST include ALL of these sections:

1. A natural descriptive sentence — NO label prefix (no "Title:", "Name:", etc.). Just describe what the student does, with concrete examples woven in naturally.
2. **Focus:** — What specifically the student is practicing (one sentence)
3. **Examples:** — 6-10 concrete examples (words, sentences, problems, etc.)
4. **Constraints:** — How to scaffold the activity, what to isolate vs mix, progression notes

The skill_description should be a SHORT, HUMAN-READABLE TITLE suitable for a curriculum browser UI.

## Author Instructions

{request.custom_instructions or "No additional instructions."}

## Quality Checklist

1. Every subskill has a `target_primitive` from the catalog above
2. Every subskill_description starts with a natural descriptive sentence, then includes Focus, Examples, and Constraints
3. No subskill describes a classroom-only or physical activity
4. IDs follow the convention exactly
5. Difficulty values progress across subskills
6. Examples are age-appropriate and grade-level accurate

Return ONLY the JSON object. No markdown, no explanations."""

    # ------------------------------------------------------------------ #
    #  Accept Preview → flip status in drafts
    # ------------------------------------------------------------------ #

    async def accept_unit(self, preview_id: str, subject_id: str, grade: str) -> Dict[str, Any]:
        """Accept a pending unit — flips status to accepted (1 write)."""

        unit_entry = await draft_curriculum.get_unit_by_preview_id(grade, subject_id, preview_id)
        if not unit_entry:
            raise ValueError(f"Preview {preview_id} not found in {subject_id}")

        status = unit_entry.get("status", "accepted")
        if status != "pending":
            raise ValueError(f"Preview {preview_id} is already {status}")

        updated = await draft_curriculum.update_unit_status(
            grade, subject_id, preview_id, "accepted"
        )
        if not updated:
            raise ValueError(f"Failed to update status for {preview_id}")

        # Count skills/subskills
        skills = updated.get("skills", [])
        skills_count = len(skills)
        subskills_count = sum(len(sk.get("subskills", [])) for sk in skills)

        logger.info(
            f"Accepted preview {preview_id}: "
            f"{skills_count} skills, {subskills_count} subskills (1 write)"
        )

        return {
            "preview_id": preview_id,
            "unit_id": updated["unit_id"],
            "skills_created": skills_count,
            "subskills_created": subskills_count,
        }

    # ------------------------------------------------------------------ #
    #  Reject Preview
    # ------------------------------------------------------------------ #

    async def reject_unit(
        self, preview_id: str, subject_id: str, grade: str,
        feedback: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Reject a preview — flips status to rejected (1 write)."""

        updated = await draft_curriculum.update_unit_status(
            grade, subject_id, preview_id, "rejected",
            rejection_feedback=feedback,
        )
        if not updated:
            raise ValueError(f"Preview {preview_id} not found in {subject_id}")

        logger.info(f"Rejected preview {preview_id}: {feedback or 'no feedback'}")

        return {
            "preview_id": preview_id,
            "status": "rejected",
        }

    # ------------------------------------------------------------------ #
    #  Regenerate (reject old + generate new)
    # ------------------------------------------------------------------ #

    async def regenerate_unit(
        self,
        preview_id: str,
        subject_id: str,
        grade: str,
        additional_feedback: Optional[str] = None,
        custom_instructions: Optional[str] = None,
    ) -> UnitPreview:
        """Reject the old preview and generate a new one with feedback."""

        old_unit = await draft_curriculum.get_unit_by_preview_id(grade, subject_id, preview_id)
        if not old_unit:
            raise ValueError(f"Preview {preview_id} not found in {subject_id}")

        # Mark old as rejected
        await draft_curriculum.update_unit_status(
            grade, subject_id, preview_id, "rejected",
            rejection_feedback=additional_feedback,
        )

        # Build a new request from the old unit + feedback
        prd_context = f"""Previous generation was rejected.
Feedback: {additional_feedback or 'No specific feedback — please improve quality.'}

Please address the feedback and generate an improved version."""

        request = AuthorUnitRequest(
            subject_id=subject_id,
            grade=grade,
            unit_id=old_unit["unit_id"],
            unit_title=old_unit["unit_title"],
            unit_description=old_unit.get("description", ""),
            unit_order=old_unit.get("unit_order", 1),
            prd_context=prd_context,
            custom_instructions=custom_instructions,
        )

        return await self.author_unit(request)

    # ------------------------------------------------------------------ #
    #  List Previews (reads from drafts)
    # ------------------------------------------------------------------ #

    async def list_previews(self, subject_id: str, grade: str) -> Dict[str, Any]:
        """List all unit previews for a subject with status counts."""

        units = await draft_curriculum.list_units_with_status(grade, subject_id)

        stats = {"pending": 0, "accepted": 0, "rejected": 0}
        previews = []

        # Get subject context for building UnitPreview models
        for u in units:
            status = u.get("status", "accepted")
            stats[status] = stats.get(status, 0) + 1

            # Reconstruct skills as GeneratedSkill models for the response
            skills = []
            for sk in u.get("skills", []):
                subskills = [
                    GeneratedSubskill(
                        subskill_id=ss.get("subskill_id", ""),
                        subskill_description=ss.get("subskill_description", ""),
                        subskill_order=ss.get("subskill_order", 1),
                        difficulty_start=float(ss.get("difficulty_start", 1.0)),
                        difficulty_end=float(ss.get("difficulty_end", 5.0)),
                        target_difficulty=float(ss.get("target_difficulty", 3.0)),
                        target_primitive=ss.get("target_primitive", ""),
                        standards_alignment=ss.get("standards_alignment"),
                    )
                    for ss in sk.get("subskills", [])
                ]
                skills.append(GeneratedSkill(
                    skill_id=sk.get("skill_id", ""),
                    skill_description=sk.get("skill_description", ""),
                    skill_order=sk.get("skill_order", 1),
                    subskills=subskills,
                ))

            coverage_data = u.get("lumina_coverage", {})
            coverage = LuminaCoverage(**coverage_data) if coverage_data else self._compute_coverage(skills)

            previews.append(UnitPreview(
                preview_id=u.get("preview_id", ""),
                subject_id=subject_id,
                grade=grade,
                unit_id=u.get("unit_id", ""),
                unit_title=u.get("unit_title", ""),
                unit_description=u.get("description", ""),
                unit_order=u.get("unit_order", 1),
                skills=skills,
                lumina_coverage=coverage,
                status=status,
                created_at=datetime.fromisoformat(u["authoring_created_at"])
                    if u.get("authoring_created_at") else datetime.utcnow(),
                rejection_feedback=u.get("rejection_feedback"),
            ))

        # Sort by creation time
        previews.sort(key=lambda p: p.created_at)

        return {"subject_id": subject_id, "previews": previews, "stats": stats}

    # ------------------------------------------------------------------ #
    #  Subject Shell (create-or-get)
    # ------------------------------------------------------------------ #

    async def ensure_subject(
        self,
        subject_id: str,
        subject_name: str,
        grade: str,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create the subject if it doesn't exist, or return existing."""

        existing = await curriculum_manager.get_subject(subject_id, include_drafts=True)
        if existing:
            units = await curriculum_manager.get_units_by_subject(
                subject_id, include_drafts=True
            )
            return {
                "subject_id": existing.subject_id,
                "subject_name": existing.subject_name,
                "grade": existing.grade,
                "version_id": existing.version_id,
                "existing_units": [
                    {"unit_id": u.unit_id, "title": u.unit_title, "order": u.unit_order}
                    for u in units
                ],
                "message": f"Subject '{subject_name}' already exists with {len(units)} units",
            }

        # Create version first
        version = await version_control.create_version(
            VersionCreate(
                subject_id=subject_id,
                description=f"Initial authoring of {subject_name} (Grade {grade})",
            ),
            user_id="authoring-service",
        )

        # Create subject
        subject_create = SubjectCreate(
            subject_id=subject_id,
            subject_name=subject_name,
            grade=grade,
            description=description or f"{subject_name} curriculum for Grade {grade}",
        )
        subject = await curriculum_manager.create_subject(
            subject_create, "authoring-service", version.version_id
        )

        return {
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "grade": subject.grade,
            "version_id": subject.version_id,
            "existing_units": [],
            "message": f"Created new subject '{subject_name}' (Grade {grade})",
        }

    # ================================================================== #
    #  PRIVATE HELPERS
    # ================================================================== #

    @staticmethod
    def _skills_to_draft_format(skills: List[GeneratedSkill]) -> List[Dict[str, Any]]:
        """Convert GeneratedSkill models to the dict format stored in drafts."""
        skills_data = []
        for skill in skills:
            subskills_data = []
            for ss in skill.subskills:
                subskills_data.append({
                    "subskill_id": ss.subskill_id,
                    "subskill_description": ss.subskill_description,
                    "subskill_order": ss.subskill_order,
                    "difficulty_start": ss.difficulty_start,
                    "difficulty_end": ss.difficulty_end,
                    "target_difficulty": ss.target_difficulty,
                    "target_primitive": ss.target_primitive,
                    "standards_alignment": ss.standards_alignment,
                })
            skills_data.append({
                "skill_id": skill.skill_id,
                "skill_description": skill.skill_description,
                "skill_order": skill.skill_order,
                "subskills": subskills_data,
            })
        return skills_data

    def _build_generation_prompt(self, request: AuthorUnitRequest) -> str:
        """Build the Lumina-first Gemini prompt from PRD context."""

        skill_hint = ""
        if request.num_skills:
            skill_hint = f"Target approximately {request.num_skills} skills."
        subskill_hint = ""
        if request.num_subskills_per_skill:
            subskill_hint = f"Target approximately {request.num_subskills_per_skill} subskills per skill."

        return f"""You are an expert curriculum designer authoring content for the Lumina AI tutoring platform.

## Task

Generate a complete curriculum unit for **Grade {request.grade}** in the subject area described below.

**Unit ID:** {request.unit_id}
**Unit Title:** {request.unit_title}
**Unit Description:** {request.unit_description}

## PRD Context (from the grade-level Product Requirements Document)

{request.prd_context}

## CRITICAL: Lumina-First Design Principle

**Every subskill MUST target a named Lumina primitive, problem type, or AI tutor session.**

A subskill that cannot be rendered, practiced, and evaluated through a Lumina primitive is NOT valid.
Apply this renderability test to every subskill:
> "Can a student practice this skill by interacting with a screen and/or talking to the AI tutor?"
> If NO -> rewrite or remove the subskill.

**What gets CUT (do NOT generate these):**
- Physical performance ("track print with a finger")
- Peer collaboration ("participate in collaborative conversations")
- Teacher-mediated ("with guidance and support from adults")
- Physical materials ("use props, costumes, and scenery")
- Vague process outcomes ("plan, draft, revise, and edit writing")
- Classroom behaviors ("follow agreed-upon rules")

{LUMINA_PRIMITIVE_CATALOG}

## ID Convention

- Skill IDs: `{request.unit_id}-XX` (e.g., {request.unit_id}-01, {request.unit_id}-02)
- Subskill IDs: `{request.unit_id}-XX-Y` where Y is a lowercase letter (e.g., {request.unit_id}-01-a, {request.unit_id}-01-b)

## Difficulty Calibration (Grade {request.grade})

- difficulty_start: 1-3 (entry point)
- difficulty_end: 3-7 (mastery challenge)
- target_difficulty: 2-5 (sweet spot)
- Subskills within a skill should progress from easier to harder.

## CRITICAL: Rich Subskill Descriptions

The subskill_description is the ONLY instruction Lumina has to generate content. Thin descriptions like "Decode CVC words" produce garbage. Every subskill description MUST include ALL of these sections:

1. A natural descriptive sentence — NO label prefix (no "Title:", "Name:", etc.). Just describe what the student does, with concrete examples woven in naturally.
2. **Focus:** — What specifically the student is practicing (one sentence)
3. **Examples:** — 6-10 concrete examples (words, sentences, problems, etc.)
4. **Constraints:** — How to scaffold the activity, what to isolate vs mix, progression notes for the content generator

**GOOD example:**
"Decode CVC words with short 'a', including matching spoken words to written forms (cat, map, van, bat). Focus: Reading CVC words containing the short 'a' sound. Examples: cat, map, van, bat, hat, sad, tag, ran. Constraints: Isolate the short 'a' sound for initial learning, then mix with other CVC patterns to test discrimination."

**BAD example (DO NOT DO THIS):**
"Decode CVC words with short vowel sounds."

Skill descriptions should be SHORT, HUMAN-READABLE TITLES suitable for a curriculum browser UI (e.g., "Short Vowel CVC Decoding", "Consonant Blends", "Rhyme Recognition & Production"). NOT paragraphs or internal design notes. Think of how a parent or student would see this in a learning dashboard.

## Output Format

{skill_hint}
{subskill_hint}

Return ONLY valid JSON with this exact structure:

{{
  "skills": [
    {{
      "skill_id": "{request.unit_id}-01",
      "skill_description": "Short Vowel CVC Decoding",
      "skill_order": 1,
      "subskills": [
        {{
          "subskill_id": "{request.unit_id}-01-a",
          "subskill_description": "Practice skill with concrete context, including specific examples woven in naturally. Focus: What specifically is practiced. Examples: word1, word2, word3, word4, word5, word6. Constraints: How to scaffold, what to isolate, progression notes.",
          "subskill_order": 1,
          "difficulty_start": 1.0,
          "difficulty_end": 3.0,
          "target_difficulty": 2.0,
          "target_primitive": "primitive-name",
          "standards_alignment": "1.RF.2a"
        }}
      ]
    }}
  ]
}}

## Author Instructions

{request.custom_instructions or "No additional instructions."}

## Quality Checklist (verify before outputting)

1. Every subskill has a `target_primitive` from the catalog above
2. Every subskill_description starts with a natural descriptive sentence (no label prefixes like "Title:" or "Name:"), then includes Focus, Examples, and Constraints sections
3. No subskill describes a classroom-only or physical activity
4. IDs follow the convention exactly
5. Difficulty values progress within each skill
6. Skills build on each other in a logical pedagogical sequence
7. Examples are age-appropriate and grade-level accurate

Return ONLY the JSON object. No markdown, no explanations."""

    def _parse_skills(self, raw_skills: List[Dict]) -> List[GeneratedSkill]:
        """Parse raw Gemini output into typed models."""
        skills = []
        for rs in raw_skills:
            subskills = []
            for rss in rs.get("subskills", []):
                subskills.append(
                    GeneratedSubskill(
                        subskill_id=rss.get("subskill_id", ""),
                        subskill_description=rss.get("subskill_description", ""),
                        subskill_order=rss.get("subskill_order", 1),
                        difficulty_start=float(rss.get("difficulty_start", 1.0)),
                        difficulty_end=float(rss.get("difficulty_end", 5.0)),
                        target_difficulty=float(rss.get("target_difficulty", 3.0)),
                        target_primitive=rss.get("target_primitive", ""),
                        standards_alignment=rss.get("standards_alignment"),
                    )
                )
            skills.append(
                GeneratedSkill(
                    skill_id=rs.get("skill_id", ""),
                    skill_description=rs.get("skill_description", ""),
                    skill_order=rs.get("skill_order", 1),
                    subskills=subskills,
                )
            )
        return skills

    def _compute_coverage(self, skills: List[GeneratedSkill]) -> LuminaCoverage:
        """Compute Lumina renderability coverage stats."""
        total = 0
        primitive_count = 0
        ai_tutor_count = 0
        problem_type_count = 0
        untargeted = 0
        primitives_used: Dict[str, int] = {}

        problem_types = {
            "multiple-choice", "true-false", "fill-in-blanks",
            "matching-activity", "sequencing-activity",
            "categorization-activity", "short-answer", "drag-and-drop",
        }

        for skill in skills:
            for ss in skill.subskills:
                total += 1
                prim = ss.target_primitive.strip().lower()

                if not prim:
                    untargeted += 1
                elif prim in ("ai-tutor-session", "ai tutor session"):
                    ai_tutor_count += 1
                    primitives_used[prim] = primitives_used.get(prim, 0) + 1
                elif prim in problem_types:
                    problem_type_count += 1
                    primitives_used[prim] = primitives_used.get(prim, 0) + 1
                else:
                    primitive_count += 1
                    primitives_used[prim] = primitives_used.get(prim, 0) + 1

        targeted = primitive_count + ai_tutor_count + problem_type_count
        coverage_pct = (targeted / total * 100) if total > 0 else 0.0

        return LuminaCoverage(
            total_subskills=total,
            primitive_targeted=primitive_count,
            ai_tutor_targeted=ai_tutor_count,
            problem_type_targeted=problem_type_count,
            untargeted=untargeted,
            coverage_pct=coverage_pct,
            primitives_used=primitives_used,
        )
