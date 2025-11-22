"""
Problem Generator Service - Generates practice problems using Gemini AI

Responsibilities:
- Generate problems using Gemini with structured schemas
- Store in BigQuery with complete generation metadata for replicability
- Support auto-evaluation trigger
- Support regeneration with modified prompts
- Manual editing with edit history tracking
"""

import logging
import json
from uuid import uuid4
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
import time

from google import genai
from google.genai.types import GenerateContentConfig

from app.core.config import settings
from app.core.database import db
from app.models.problems import (
    ProblemInDB,
    ProblemCreate,
    ProblemUpdate
)
from app.models.problem_schemas import (
    PROBLEM_TYPE_METADATA,
    TYPE_SELECTION_SCHEMA,
    ALL_PROBLEM_TYPES
)
from app.services.curriculum_manager import curriculum_manager
from app.services.foundations_service import foundations_service
from app.services.prompt_manager_service import prompt_manager_service

logger = logging.getLogger(__name__)


# Problem type schemas (simplified for MVP - can be expanded)
PROBLEM_TYPE_SCHEMAS = {
    "multiple_choice": {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "question_text": {"type": "string"},
            "options": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 4,
                "maxItems": 4
            },
            "correct_answer_index": {"type": "integer", "minimum": 0, "maximum": 3},
            "explanation": {"type": "string"},
            "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]}
        },
        "required": ["question_text", "options", "correct_answer_index", "explanation", "difficulty"]
    },
    "true_false": {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "statement": {"type": "string"},
            "correct_answer": {"type": "boolean"},
            "explanation": {"type": "string"},
            "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]}
        },
        "required": ["statement", "correct_answer", "explanation", "difficulty"]
    },
    "fill_in_blanks": {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "question_text": {"type": "string"},
            "blanks": {
                "type": "array",
                "items": {"type": "string"}
            },
            "explanation": {"type": "string"},
            "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]}
        },
        "required": ["question_text", "blanks", "explanation", "difficulty"]
    },
    "short_answer": {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "question_text": {"type": "string"},
            "sample_answers": {
                "type": "array",
                "items": {"type": "string"}
            },
            "explanation": {"type": "string"},
            "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]}
        },
        "required": ["question_text", "sample_answers", "explanation", "difficulty"]
    }
}


class ProblemGeneratorService:
    """Generates practice problems using Gemini AI with full metadata tracking"""

    def __init__(self):
        self.client = None
        self._initialize_gemini()

    def _initialize_gemini(self):
        """Initialize Gemini client"""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("✅ Gemini client initialized for ProblemGeneratorService")

    async def generate_problems(
        self,
        subskill_id: str,
        version_id: str,
        count: int = 5,
        problem_types: Optional[List[str]] = None,
        temperature: float = 0.7,
        auto_evaluate: bool = True,
        user_id: Optional[str] = None,
        custom_prompt: Optional[str] = None
    ) -> List[ProblemInDB]:
        """
        Generate practice problems for a subskill.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            count: Number of problems to generate (default 5)
            problem_types: List of problem types to generate (if None, uses multiple_choice)
            temperature: Generation temperature (0.0-1.0)
            auto_evaluate: Whether to trigger evaluation after generation
            user_id: User requesting generation
            custom_prompt: Optional custom prompt override

        Returns:
            List of generated problems with metadata
        """
        logger.info(f"🎯 Generating {count} problems for {subskill_id}")

        # Default to multiple choice if no types specified
        if not problem_types:
            problem_types = ["multiple_choice"]

        # Get subskill details and foundations
        subskill = await curriculum_manager.get_subskill(subskill_id)
        if not subskill:
            raise ValueError(f"Subskill {subskill_id} not found")

        skill = await curriculum_manager.get_skill(subskill.skill_id)
        unit = await curriculum_manager.get_unit(skill.unit_id) if skill else None
        subject = await curriculum_manager.get_subject(unit.subject_id) if unit else None

        # Get foundations for context
        foundations = await foundations_service.get_foundations(subskill_id, version_id)
        if not foundations:
            logger.info("No foundations found, generating new ones...")
            foundations = await foundations_service.generate_foundations(subskill_id, version_id)

        # Build or get generation prompt
        if custom_prompt:
            generation_prompt = custom_prompt
        else:
            # Try to get active template
            template = await prompt_manager_service.get_active_template(
                template_name="default_problem_generation",
                template_type="problem_generation"
            )

            if template:
                # Render template with variables
                variables = {
                    "subskill_description": subskill.subskill_description,
                    "grade_level": subject.grade_level if subject else "Kindergarten",
                    "subject": subject.subject_name if subject else "Unknown",
                    "core_concepts": ", ".join(foundations.master_context.core_concepts) if foundations.master_context else "",
                    "learning_objectives": ", ".join(foundations.master_context.learning_objectives) if foundations.master_context else "",
                    "count": str(count),
                    "problem_types": ", ".join(problem_types)
                }
                generation_prompt = prompt_manager_service.render_template(template, variables)
            else:
                # Fallback to default prompt
                generation_prompt = self._build_default_prompt(
                    subskill, subject, foundations, count, problem_types
                )

        # Generate unique ID for this generation session
        generation_id = str(uuid4())
        generated_problems = []
        overall_start_time = time.time()

        try:
            # THREE-PHASE GENERATION ARCHITECTURE

            # PHASE 1: Intelligent Type Selection
            # If problem_types provided manually, skip Phase 1 (backward compatibility)
            if problem_types:
                logger.info(f"📋 Manual type specification: {problem_types}")
                # Convert manual types to selections format
                grade_level = subject.grade_level if subject else "Kindergarten"
                problems_per_type = count // len(problem_types)
                remainder = count % len(problem_types)

                type_selections = []
                for idx, problem_type in enumerate(problem_types):
                    type_count = problems_per_type + (1 if idx < remainder else 0)
                    if type_count > 0:
                        type_selections.append({
                            "type": problem_type,
                            "count": type_count,
                            "reasoning": "Manually specified",
                            "enable_ai_coach": grade_level in ["Kindergarten", "Grade 1", "Grade 2"],
                            "ai_coach_rationale": "Default: enabled for K-2, disabled otherwise"
                        })
            else:
                # Use AI to select optimal problem types
                type_selections = await self._select_problem_types(
                    generation_id=generation_id,
                    subskill_id=subskill_id,
                    version_id=version_id,
                    total_count=count,
                    subskill=subskill,
                    subject=subject,
                    foundations=foundations
                )

            # PHASE 2: Per-Type Generation with Context Primitives
            all_generated_problems = []

            for selection in type_selections:
                problem_type = selection["type"]
                type_count = selection["count"]
                enable_ai_coach = selection.get("enable_ai_coach", False)
                ai_coach_rationale = selection.get("ai_coach_rationale", "No rationale provided")

                logger.info(f"📝 Generating {type_count} {problem_type} problems "
                          f"(AI coach: {'enabled' if enable_ai_coach else 'disabled'})")

                # Get the model for this problem type from metadata
                type_metadata = PROBLEM_TYPE_METADATA.get(problem_type, {})
                model_name = type_metadata.get("model", "gemini-flash-latest")

                # Generate problems for this type - now returns (problems, actual_prompt)
                problems, actual_prompt = await self._generate_single_type(
                    generation_id=generation_id,
                    problem_type=problem_type,
                    count=type_count,
                    subskill_id=subskill_id,
                    version_id=version_id,
                    subskill=subskill,
                    subject=subject,
                    foundations=foundations,
                    enable_ai_coach=enable_ai_coach,
                    ai_coach_rationale=ai_coach_rationale,
                    temperature=temperature,
                    custom_prompt=custom_prompt
                )

                # Add type and generation metadata to each problem
                # Note: primitives will be added in _generate_single_type
                for problem in problems:
                    problem["_problem_type"] = problem_type
                    problem["_actual_generation_prompt"] = actual_prompt  # Store the actual prompt used
                    # Merge the metadata from generation with overall metadata
                    if "_generation_metadata" not in problem:
                        problem["_generation_metadata"] = {}

                    problem["_generation_metadata"].update({
                        "generation_id": generation_id,
                        "enable_ai_coach": enable_ai_coach,
                        "ai_coach_rationale": ai_coach_rationale,
                        "type_selection_reasoning": selection.get("reasoning"),
                        "model": model_name  # Store the model used
                    })
                    all_generated_problems.append(problem)

            # PHASE 3: Visual Generation (Placeholder - Future Implementation)
            # For now, problems have visual_intent but no actual visual_data
            logger.info("ℹ️ Phase 3 (Visual Generation) - Placeholder: Problems contain visual intents only")
            problems_with_visuals = all_generated_problems

            # STORAGE: Store all generated problems in BigQuery
            logger.info(f"💾 Storing {len(problems_with_visuals)} problems in BigQuery...")

            for problem_data in problems_with_visuals:
                # Extract metadata before storage
                problem_type = problem_data.pop("_problem_type")
                actual_generation_prompt = problem_data.pop("_actual_generation_prompt")  # Use actual prompt with primitives
                generation_metadata = problem_data.pop("_generation_metadata")
                model_used = generation_metadata.get("model", "gemini-flash-latest")

                # Get the primitives used for this problem (stored in metadata)
                primitives_metadata = generation_metadata.get("primitives_used", {})

                # IMPORTANT: Add problem_type back to problem_data for evaluation
                # The evaluator needs this field to detect the problem type
                problem_data["problem_type"] = problem_type

                # Store problem with the actual generation prompt (includes primitives)
                problem_db = await self._store_problem(
                    subskill_id=subskill_id,
                    version_id=version_id,
                    problem_type=problem_type,
                    problem_data=problem_data,
                    generation_prompt=actual_generation_prompt,  # Now using actual prompt with primitives!
                    generation_model=model_used,
                    generation_metadata=generation_metadata,
                    temperature=temperature,
                    user_id=user_id,
                    generation_duration_ms=int((time.time() - overall_start_time) * 1000)
                )
                generated_problems.append(problem_db)

        except Exception as e:
            logger.error(f"❌ Problem generation failed: {e}")
            raise

        logger.info(f"✅ Generated {len(generated_problems)} problems in {time.time() - overall_start_time:.2f}s")

        # Trigger evaluation if requested
        if auto_evaluate:
            logger.info("🔍 Auto-evaluation enabled, triggering evaluation...")
            # Import here to avoid circular dependency
            from app.services.problem_evaluation_service import problem_evaluation_service

            for problem in generated_problems:
                try:
                    await problem_evaluation_service.evaluate_problem(problem.problem_id)
                except Exception as e:
                    logger.error(f"Evaluation failed for {problem.problem_id}: {e}")

        return generated_problems

    async def _generate_batch(
        self,
        problem_type: str,
        prompt: str,
        count: int,
        temperature: float
    ) -> List[Dict[str, Any]]:
        """
        Generate a batch of problems of a single type using Gemini.

        Args:
            problem_type: Type of problem to generate
            prompt: Generation prompt
            count: Number of problems
            temperature: Generation temperature

        Returns:
            List of problem data dictionaries
        """
        # Build schema for response
        schema = {
            "type": "object",
            "properties": {
                "problems": {
                    "type": "array",
                    "items": PROBLEM_TYPE_SCHEMAS.get(problem_type, PROBLEM_TYPE_SCHEMAS["multiple_choice"]),
                    "minItems": count,
                    "maxItems": count
                }
            },
            "required": ["problems"]
        }

        # Build full prompt with schema instructions
        full_prompt = f"""{prompt}

Generate exactly {count} {problem_type} problems following this structure:
- Each problem should be unique and test different aspects of the learning objectives
- Vary difficulty levels across problems
- Ensure explanations are clear and educational

Return as a JSON object with a "problems" array."""

        # Call Gemini
        config = GenerateContentConfig(
            temperature=temperature,
            response_mime_type="application/json",
            response_schema=schema
        )

        response = self.client.models.generate_content(
            model="gemini-flash-lite-latest",
            contents=full_prompt,
            config=config
        )

        # Parse response
        result = json.loads(response.text)
        return result.get("problems", [])

    async def _store_problem(
        self,
        subskill_id: str,
        version_id: str,
        problem_type: str,
        problem_data: Dict[str, Any],
        generation_prompt: str,
        generation_model: str,
        generation_metadata: Dict[str, Any],
        temperature: float,
        user_id: Optional[str],
        generation_duration_ms: int
    ) -> ProblemInDB:
        """
        Store a generated problem in BigQuery with full metadata.

        Args:
            subskill_id: Subskill ID
            version_id: Version ID
            problem_type: Problem type
            problem_data: Problem JSON data
            generation_prompt: Full prompt used for generation
            generation_model: Model name used for generation
            generation_metadata: Extended metadata from generation phases
            temperature: Generation temperature
            user_id: User who generated the problem
            generation_duration_ms: Generation time in milliseconds

        Returns:
            ProblemInDB with database fields populated
        """
        problem_id = str(uuid4())
        now = datetime.utcnow()

        # Prepare row for insertion
        row = {
            "problem_id": problem_id,
            "subskill_id": subskill_id,
            "version_id": version_id,
            "problem_type": problem_type,
            "problem_json": json.dumps(problem_data),
            "generation_prompt": generation_prompt,
            "generation_model": generation_model,
            "generation_metadata": json.dumps(generation_metadata),
            "generation_temperature": temperature,
            "generation_timestamp": now.isoformat(),
            "generation_duration_ms": generation_duration_ms,
            "is_draft": True,
            "is_active": False,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "last_edited_by": user_id,
            "edit_history": None
        }

        # Insert into BigQuery
        success = await db.insert_rows("curriculum_problems", [row])
        if not success:
            raise RuntimeError(f"Failed to insert problem into BigQuery")

        return ProblemInDB(
            problem_id=problem_id,
            subskill_id=subskill_id,
            version_id=version_id,
            problem_type=problem_type,
            problem_json=problem_data,
            generation_prompt=generation_prompt,
            generation_model=generation_model,
            generation_metadata=generation_metadata,
            generation_temperature=temperature,
            generation_timestamp=now,
            generation_duration_ms=generation_duration_ms,
            is_draft=True,
            is_active=False,
            created_at=now,
            updated_at=now,
            last_edited_by=user_id,
            edit_history=None
        )

    async def _store_phase_data(
        self,
        generation_id: str,
        phase_number: int,
        phase_type: str,
        prompt: str,
        model: str,
        response: Dict[str, Any],
        execution_time_ms: int,
        success: bool = True,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Store phase tracking data in problem_generation_phases table.

        Args:
            generation_id: Unique identifier for this generation session
            phase_number: Phase number (1, 2, or 3)
            phase_type: Type of phase (e.g., "type_selection", "problem_generation", "visual_generation")
            prompt: Full prompt used
            model: Model name used
            response: Parsed response from model
            execution_time_ms: Execution time in milliseconds
            success: Whether phase succeeded
            metadata: Optional additional metadata

        Returns:
            True if stored successfully
        """
        phase_id = str(uuid4())
        now = datetime.utcnow()

        row = {
            "phase_id": phase_id,
            "generation_id": generation_id,
            "phase_number": phase_number,
            "phase_type": phase_type,
            "prompt": prompt,
            "model": model,
            "response": json.dumps(response),
            "execution_time_ms": execution_time_ms,
            "success": success,
            "metadata": json.dumps(metadata) if metadata else None,
            "created_at": now.isoformat()
        }

        try:
            success = await db.insert_rows("problem_generation_phases", [row])
            if success:
                logger.info(f"✅ Stored phase {phase_number} data ({phase_type})")
            return success
        except Exception as e:
            logger.error(f"❌ Failed to store phase data: {e}")
            return False

    async def _select_problem_types(
        self,
        generation_id: str,
        subskill_id: str,
        version_id: str,
        total_count: int,
        subskill: Any,
        subject: Any,
        foundations: Any
    ) -> List[Dict[str, Any]]:
        """
        Phase 1: Intelligent problem type selection using Gemini.

        Args:
            generation_id: Generation session ID for tracking
            subskill_id: Subskill identifier
            version_id: Version identifier
            total_count: Total number of problems to generate
            subskill: Subskill object
            subject: Subject object
            foundations: Foundations object

        Returns:
            List of type selections with counts and AI coach recommendations
        """
        logger.info(f"🎯 Phase 1: Selecting problem types for {total_count} problems")

        start_time = time.time()

        # Build prompt for type selection
        core_concepts = ", ".join(foundations.master_context.core_concepts) if foundations and foundations.master_context else "the topic"
        objectives = "\n".join(f"- {obj}" for obj in (foundations.master_context.learning_objectives if foundations and foundations.master_context else []))
        grade_level = subject.grade_level if subject else "Kindergarten"
        subject_name = subject.subject_name if subject else "Unknown"

        prompt = f"""You are an expert educational content strategist selecting problem types for {grade_level} {subject_name} education.

**Learning Context:**
Subskill: {subskill.subskill_description}
Grade Level: {grade_level}
Subject: {subject_name}

Core Concepts: {core_concepts}

Learning Objectives:
{objectives}

**Task:**
Select 1-3 problem types from the available options that will best assess and reinforce these learning objectives. The total count must equal {total_count} problems.

**Available Problem Types:**
- multiple_choice: Comprehension testing, concept assessment, identifying correct answers
- true_false: Quick fact checking, misconception identification, binary understanding
- fill_in_blanks: Vocabulary practice, key term recall, context-based learning
- matching_activity: Building relationships, connecting concepts, pairing terms
- sequencing_activity: Process understanding, chronological ordering, step-by-step thinking
- categorization_activity: Classification skills, grouping by attributes, organizing concepts
- scenario_question: Real-world application, critical thinking, contextual problem solving
- short_answer: Open-ended responses, explanation practice, brief written expression
- live_interaction: Interactive learning with real-time AI guidance, verbal/click responses (BEST for phonics, reading, ABC content, K-2 students)

**AI Coach Decision Factors:**
- K-2 students → STRONGLY FAVOR enabling AI coach
- Phonics/reading/ABC content → STRONGLY FAVOR enabling AI coach
- Simpler problems (true/false, fill_in_blanks) → benefit more from AI guidance
- Concepts requiring verbal explanation → benefit most from AI coach

**Requirements:**
- Select 1-3 problem types that best fit the learning objectives
- Total counts must sum to exactly {total_count}
- Provide clear reasoning for each selection
- For each type, decide whether to enable AI coach based on the factors above
- Ensure pedagogical variety and appropriateness for grade level"""

        # Call Gemini Flash Lite for type selection (fast, cheap)
        config = GenerateContentConfig(
            temperature=0.3,  # Lower temperature for consistency
            response_mime_type="application/json",
            response_schema=TYPE_SELECTION_SCHEMA
        )

        try:
            response = self.client.models.generate_content(
                model="gemini-flash-lite-latest",
                contents=prompt,
                config=config
            )

            # Parse response
            result = json.loads(response.text)
            type_selections = result.get("selected_types", [])

            execution_time_ms = int((time.time() - start_time) * 1000)

            logger.info(f"✅ Phase 1 complete: Selected {len(type_selections)} problem types")
            logger.info(f"   Overall reasoning: {result.get('overall_reasoning', 'N/A')}")

            for selection in type_selections:
                logger.info(f"   - {selection['type']}: {selection['count']} problems, "
                          f"AI coach: {selection['enable_ai_coach']}")

            # Store phase data
            await self._store_phase_data(
                generation_id=generation_id,
                phase_number=1,
                phase_type="type_selection",
                prompt=prompt,
                model="gemini-flash-lite-latest",
                response=result,
                execution_time_ms=execution_time_ms,
                success=True,
                metadata={
                    "total_count": total_count,
                    "num_types_selected": len(type_selections),
                    "overall_reasoning": result.get("overall_reasoning")
                }
            )

            return type_selections

        except Exception as e:
            logger.error(f"❌ Phase 1 failed: {e}")
            # Fall back to default: multiple choice
            logger.info("Falling back to default type: multiple_choice")
            return [{
                "type": "multiple_choice",
                "count": total_count,
                "reasoning": "Fallback due to type selection failure",
                "enable_ai_coach": grade_level in ["Kindergarten", "Grade 1", "Grade 2"],
                "ai_coach_rationale": "Enabled for K-2 grade level"
            }]

    async def _generate_single_type(
        self,
        generation_id: str,
        problem_type: str,
        count: int,
        subskill_id: str,
        version_id: str,
        subskill: Any,
        subject: Any,
        foundations: Any,
        enable_ai_coach: bool,
        ai_coach_rationale: str,
        temperature: float = 0.7,
        custom_prompt: Optional[str] = None
    ) -> tuple[List[Dict[str, Any]], str]:
        """
        Phase 2: Generate problems for a single type with context primitives.

        Args:
            generation_id: Generation session ID for tracking
            problem_type: Type of problem to generate
            count: Number of problems to generate
            subskill_id: Subskill identifier
            version_id: Version identifier
            subskill: Subskill object
            subject: Subject object
            foundations: Foundations object
            enable_ai_coach: Whether to enable AI coach for these problems
            ai_coach_rationale: Reasoning for AI coach decision
            temperature: Generation temperature
            custom_prompt: Optional custom prompt override

        Returns:
            Tuple of (list of generated problems with metadata, actual prompt used including primitives)
        """
        logger.info(f"🎨 Phase 2: Generating {count} {problem_type} problems")

        start_time = time.time()

        # Get problem type metadata
        metadata = PROBLEM_TYPE_METADATA.get(problem_type)
        if not metadata:
            raise ValueError(f"Unknown problem type: {problem_type}")

        schema = metadata["schema"]
        model = metadata["model"]
        complexity = metadata["complexity"]

        # Sample context primitives for variety
        primitives = await self._sample_context_primitives(subskill_id, version_id, count)
        primitives_text = self._format_primitives_for_prompt(primitives)

        # Build generation prompt
        if custom_prompt:
            base_prompt = custom_prompt
        else:
            # Build comprehensive prompt
            core_concepts = ", ".join(foundations.master_context.core_concepts) if foundations and foundations.master_context else "the topic"
            objectives = "\n".join(f"- {obj}" for obj in (foundations.master_context.learning_objectives if foundations and foundations.master_context else []))
            grade_level = subject.grade_level if subject else "Kindergarten"
            subject_name = subject.subject_name if subject else "Unknown"

            base_prompt = f"""You are an expert educational content creator for {grade_level} {subject_name} education.

**Learning Context:**
Subskill: {subskill.subskill_description}
Grade Level: {grade_level}
Subject: {subject_name}

Core Concepts: {core_concepts}

Learning Objectives:
{objectives}

{primitives_text}

**Task:**
Generate exactly {count} high-quality {problem_type} problems that assess and reinforce these learning objectives.

**Quality Requirements:**
- Each problem must be unique and test different aspects of the objectives
- Vary difficulty levels across problems (easy, medium, hard)
- Include clear, educational rationale for each answer
- Provide teaching notes with pedagogical insights
- Define success criteria for assessing student understanding
- Use varied contexts and examples to maintain engagement
- Ensure problems are grade-appropriate and culturally sensitive

**Problem Type Guidance:**
{metadata.get('best_for', 'General assessment')}

**Schema Requirements:**
- Follow the exact schema structure required
- Include visual_intent where applicable (describe what visual would enhance the problem)
- All fields must be complete and meaningful
- Rationale should explain WHY the answer is correct
- Teaching notes should provide pedagogical context for instructors
- Success criteria should be measurable and specific"""

        # Add AI coach guidance if enabled
        if enable_ai_coach:
            base_prompt += f"""

**AI Coach Configuration:**
This problem will use live AI coaching. {ai_coach_rationale}
Ensure the problem structure supports interactive guidance and verbal explanation."""

        # Call Gemini with appropriate model
        config = GenerateContentConfig(
            temperature=temperature,
            response_mime_type="application/json",
            response_schema=schema
        )

        try:
            response = self.client.models.generate_content(
                model=model,
                contents=base_prompt,
                config=config
            )

            # Parse response
            result = json.loads(response.text)
            problems = result.get("problems", [])

            # Post-process: Add AI coach config to each problem
            for problem in problems:
                problem = self._add_ai_coach_config(problem, enable_ai_coach, ai_coach_rationale)
                # Add generation metadata to each problem for later storage
                problem["_generation_metadata"] = {
                    "complexity": complexity,
                    "context_primitives": primitives,
                    "primitives_used": {
                        "objects": len(primitives.get("objects", [])),
                        "characters": len(primitives.get("characters", [])),
                        "scenarios": len(primitives.get("scenarios", [])),
                        "locations": len(primitives.get("locations", []))
                    }
                }

            execution_time_ms = int((time.time() - start_time) * 1000)

            logger.info(f"✅ Phase 2 complete: Generated {len(problems)} {problem_type} problems")

            # Store phase data
            await self._store_phase_data(
                generation_id=generation_id,
                phase_number=2,
                phase_type="problem_generation",
                prompt=base_prompt,
                model=model,
                response=result,
                execution_time_ms=execution_time_ms,
                success=True,
                metadata={
                    "problem_type": problem_type,
                    "count": count,
                    "complexity": complexity,
                    "enable_ai_coach": enable_ai_coach,
                    "primitives_used": {
                        "objects": len(primitives.get("objects", [])),
                        "characters": len(primitives.get("characters", [])),
                        "scenarios": len(primitives.get("scenarios", [])),
                        "locations": len(primitives.get("locations", []))
                    }
                }
            )

            # Return both problems and the actual prompt used (including primitives)
            return problems, base_prompt

        except Exception as e:
            logger.error(f"❌ Phase 2 failed for {problem_type}: {e}")
            raise

    async def _sample_context_primitives(
        self,
        subskill_id: str,
        version_id: str,
        num_problems: int
    ) -> Dict[str, List[str]]:
        """
        Sample context primitives for variety in problem generation.
        Uses 2x sampling strategy to prevent repetition.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            num_problems: Number of problems to generate

        Returns:
            Dictionary with sampled objects, characters, scenarios, locations
        """
        import random

        # Get foundations which contain context primitives
        foundations = await foundations_service.get_foundations(subskill_id, version_id)

        if not foundations or not foundations.context_primitives:
            logger.warning("No foundations found for context primitives sampling")
            return {
                "objects": [],
                "characters": [],
                "scenarios": [],
                "locations": []
            }

        # Sample size: min(num_problems * 2, 10) to cap prompt size
        sample_size = min(num_problems * 2, 10)

        # Sample from each primitive type
        primitives = {}

        # Objects (combine concrete_objects and living_things)
        concrete_objects = foundations.context_primitives.concrete_objects or []
        living_things = foundations.context_primitives.living_things or []
        all_objects = concrete_objects + living_things
        primitives["objects"] = random.sample(all_objects, min(sample_size, len(all_objects))) if all_objects else []

        # Characters (extract names from Character objects)
        characters = foundations.context_primitives.characters or []
        character_names = [char.name if hasattr(char, 'name') else str(char) for char in characters]
        primitives["characters"] = random.sample(character_names, min(sample_size, len(character_names))) if character_names else []

        # Scenarios
        scenarios = foundations.context_primitives.scenarios or []
        primitives["scenarios"] = random.sample(scenarios, min(sample_size, len(scenarios))) if scenarios else []

        # Locations
        locations = foundations.context_primitives.locations or []
        primitives["locations"] = random.sample(locations, min(sample_size, len(locations))) if locations else []

        logger.info(f"Sampled context primitives: {len(primitives['objects'])} objects, "
                   f"{len(primitives['characters'])} characters, {len(primitives['scenarios'])} scenarios, "
                   f"{len(primitives['locations'])} locations")

        return primitives

    def _format_primitives_for_prompt(
        self,
        primitives: Dict[str, List[str]]
    ) -> str:
        """
        Format sampled primitives into readable text for LLM prompts.

        Args:
            primitives: Dictionary of sampled primitives

        Returns:
            Formatted string for prompt injection
        """
        sections = []

        if primitives.get("objects"):
            sections.append(f"**Objects to use**: {', '.join(primitives['objects'])}")

        if primitives.get("characters"):
            sections.append(f"**Characters to feature**: {', '.join(primitives['characters'])}")

        if primitives.get("scenarios"):
            sections.append(f"**Scenarios to incorporate**: {', '.join(primitives['scenarios'])}")

        if primitives.get("locations"):
            sections.append(f"**Locations to reference**: {', '.join(primitives['locations'])}")

        if not sections:
            return ""

        return "\n\n**Context Variety Guidelines**:\n" + "\n".join(sections) + "\n\nPlease vary these elements across problems to create diverse and engaging content."

    def _add_ai_coach_config(
        self,
        problem_data: Dict[str, Any],
        enable_ai_coach: bool,
        ai_coach_rationale: str
    ) -> Dict[str, Any]:
        """
        Add AI coach configuration to a problem.
        This is a basic implementation - production version would be more sophisticated.

        Args:
            problem_data: Problem JSON data
            enable_ai_coach: Whether to enable AI coach
            ai_coach_rationale: Reasoning for the decision

        Returns:
            Problem data with AI coach config added
        """
        if not enable_ai_coach:
            # If not enabled, ensure live_interaction_config is None or minimal
            if "live_interaction_config" in problem_data:
                problem_data["live_interaction_config"] = None
            return problem_data

        # Basic AI coach configuration
        # In production, this would be more sophisticated with custom guidance per problem type
        ai_coach_config = {
            "enabled": True,
            "mode": "adaptive",
            "guidance_level": "moderate",
            "interaction_pattern": "encourage_and_guide",
            "rationale": ai_coach_rationale,
            "hints_enabled": True,
            "verbal_explanation_enabled": True,
            "encouragement_phrases": [
                "You're doing great!",
                "Let's think about this together",
                "What do you notice about...",
                "Can you tell me more about..."
            ]
        }

        # Add to problem data
        problem_data["live_interaction_config"] = ai_coach_config

        return problem_data

    def _build_default_prompt(
        self,
        subskill: Any,
        subject: Any,
        foundations: Any,
        count: int,
        problem_types: List[str]
    ) -> str:
        """Build default generation prompt when no template is available"""
        core_concepts = ", ".join(foundations.master_context.core_concepts) if foundations and foundations.master_context else "the topic"
        objectives = "\n".join(f"- {obj}" for obj in (foundations.master_context.learning_objectives if foundations and foundations.master_context else []))

        return f"""You are an expert educational content creator for {subject.grade_level if subject else 'elementary'} {subject.subject_name if subject else ''} education.

Create practice problems for the following learning objective:
**{subskill.subskill_description}**

Core Concepts:
{core_concepts}

Learning Objectives:
{objectives}

Requirements:
- Generate {count} high-quality practice problems
- Problem types: {', '.join(problem_types)}
- Ensure problems are grade-appropriate and pedagogically sound
- Include clear explanations for each answer
- Vary difficulty levels (easy, medium, hard)
- Test understanding, not just memorization"""

    async def regenerate_problem(
        self,
        problem_id: str,
        modified_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        user_id: Optional[str] = None
    ) -> ProblemInDB:
        """
        Regenerate a single problem, optionally with a modified prompt.

        Args:
            problem_id: Problem to regenerate
            modified_prompt: Optional custom prompt
            temperature: Optional custom temperature
            user_id: User requesting regeneration

        Returns:
            Regenerated problem
        """
        logger.info(f"🔄 Regenerating problem {problem_id}")

        # Get existing problem
        existing = await self.get_problem(problem_id)
        if not existing:
            raise ValueError(f"Problem {problem_id} not found")

        # Use existing prompt/temperature if not provided
        prompt = modified_prompt or existing.generation_prompt
        temp = temperature if temperature is not None else existing.generation_temperature

        # Generate new problem
        start_time = time.time()
        problems = await self._generate_batch(
            problem_type=existing.problem_type,
            prompt=prompt,
            count=1,
            temperature=temp
        )

        if not problems:
            raise RuntimeError("Regeneration produced no problems")

        # Update existing problem in BigQuery
        table_id = settings.get_table_id("curriculum_problems")
        now = datetime.utcnow()

        query = f"""
        UPDATE `{table_id}`
        SET
            problem_json = @problem_json,
            generation_prompt = @generation_prompt,
            generation_temperature = @generation_temperature,
            generation_timestamp = @generation_timestamp,
            generation_duration_ms = @generation_duration_ms,
            updated_at = @updated_at,
            last_edited_by = @last_edited_by
        WHERE problem_id = @problem_id
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("problem_json", "JSON", json.dumps(problems[0])),
                bigquery.ScalarQueryParameter("generation_prompt", "STRING", prompt),
                bigquery.ScalarQueryParameter("generation_temperature", "FLOAT64", temp),
                bigquery.ScalarQueryParameter("generation_timestamp", "TIMESTAMP", now),
                bigquery.ScalarQueryParameter("generation_duration_ms", "INT64", int((time.time() - start_time) * 1000)),
                bigquery.ScalarQueryParameter("updated_at", "TIMESTAMP", now),
                bigquery.ScalarQueryParameter("last_edited_by", "STRING", user_id),
                bigquery.ScalarQueryParameter("problem_id", "STRING", problem_id)
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        query_job.result()

        logger.info(f"✅ Regenerated problem {problem_id}")

        return await self.get_problem(problem_id)

    async def get_problem(
        self,
        problem_id: str
    ) -> Optional[ProblemInDB]:
        """
        Get a specific problem by ID.

        Args:
            problem_id: Problem identifier

        Returns:
            Problem or None if not found
        """
        table_id = settings.get_table_id("curriculum_problems")
        query = f"""
        SELECT *
        FROM `{table_id}`
        WHERE problem_id = @problem_id
        LIMIT 1
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("problem_id", "STRING", problem_id)
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        results = list(query_job.result())

        if not results:
            return None

        row = dict(results[0])
        return self._row_to_problem(row)

    async def list_problems_for_subskill(
        self,
        subskill_id: str,
        version_id: str,
        active_only: bool = False
    ) -> List[ProblemInDB]:
        """
        List all problems for a subskill.

        Args:
            subskill_id: Subskill ID
            version_id: Version ID
            active_only: Only return active problems

        Returns:
            List of problems
        """
        table_id = settings.get_table_id("curriculum_problems")

        where_clause = "WHERE subskill_id = @subskill_id AND version_id = @version_id"
        if active_only:
            where_clause += " AND is_active = TRUE"

        query = f"""
        SELECT *
        FROM `{table_id}`
        {where_clause}
        ORDER BY created_at DESC
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
                bigquery.ScalarQueryParameter("version_id", "STRING", version_id)
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        return [self._row_to_problem(dict(row)) for row in query_job.result()]

    async def update_problem(
        self,
        problem_id: str,
        updates: ProblemUpdate,
        user_id: Optional[str] = None
    ) -> ProblemInDB:
        """
        Update a problem with manual edits.

        Args:
            problem_id: Problem to update
            updates: Fields to update
            user_id: User making the update

        Returns:
            Updated problem
        """
        logger.info(f"✏️ Updating problem {problem_id}")

        # Get existing problem for edit history
        existing = await self.get_problem(problem_id)
        if not existing:
            raise ValueError(f"Problem {problem_id} not found")

        # Build edit history entry
        edit_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "changes": updates.dict(exclude_unset=True)
        }

        # Update using DML
        table_id = settings.get_table_id("curriculum_problems")

        # Build SET clause dynamically
        set_clauses = []
        params = []

        if updates.problem_json is not None:
            set_clauses.append("problem_json = @problem_json")
            params.append(("problem_json", "JSON", json.dumps(updates.problem_json)))

        if updates.is_draft is not None:
            set_clauses.append("is_draft = @is_draft")
            params.append(("is_draft", "BOOL", updates.is_draft))

        if updates.is_active is not None:
            set_clauses.append("is_active = @is_active")
            params.append(("is_active", "BOOL", updates.is_active))

        # Always update metadata
        set_clauses.append("updated_at = @updated_at")
        set_clauses.append("last_edited_by = @last_edited_by")
        params.append(("updated_at", "TIMESTAMP", datetime.utcnow()))
        params.append(("last_edited_by", "STRING", user_id))

        # Append to edit history (note: BigQuery doesn't support array append easily)
        # For now, we'll read-modify-write the edit_history
        current_history = json.loads(existing.edit_history) if existing.edit_history else []
        current_history.append(edit_entry)
        set_clauses.append("edit_history = @edit_history")
        params.append(("edit_history", "JSON", json.dumps(current_history)))

        query = f"""
        UPDATE `{table_id}`
        SET {', '.join(set_clauses)}
        WHERE problem_id = @problem_id
        """

        params.append(("problem_id", "STRING", problem_id))

        from google.cloud import bigquery
        query_params = [
            bigquery.ScalarQueryParameter(name, type_, value)
            for name, type_, value in params
        ]
        job_config = bigquery.QueryJobConfig(query_parameters=query_params)
        query_job = db.client.query(query, job_config=job_config)
        query_job.result()

        logger.info(f"✅ Updated problem {problem_id}")

        return await self.get_problem(problem_id)

    async def delete_problem(
        self,
        problem_id: str
    ) -> bool:
        """
        Delete a problem.

        Args:
            problem_id: Problem to delete

        Returns:
            True if deleted successfully
        """
        table_id = settings.get_table_id("curriculum_problems")
        query = f"""
        DELETE FROM `{table_id}`
        WHERE problem_id = @problem_id
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("problem_id", "STRING", problem_id)
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        query_job.result()

        logger.info(f"🗑️ Deleted problem {problem_id}")
        return True

    def _row_to_problem(self, row: Dict[str, Any]) -> ProblemInDB:
        """Convert BigQuery row to ProblemInDB"""
        problem_json = json.loads(row['problem_json']) if isinstance(row['problem_json'], str) else row['problem_json']
        edit_history = json.loads(row['edit_history']) if row.get('edit_history') and isinstance(row['edit_history'], str) else row.get('edit_history')
        generation_metadata = json.loads(row['generation_metadata']) if row.get('generation_metadata') and isinstance(row['generation_metadata'], str) else row.get('generation_metadata')

        return ProblemInDB(
            problem_id=row['problem_id'],
            subskill_id=row['subskill_id'],
            version_id=row['version_id'],
            problem_type=row['problem_type'],
            problem_json=problem_json,
            generation_prompt=row.get('generation_prompt'),
            generation_model=row.get('generation_model'),
            generation_temperature=row.get('generation_temperature'),
            generation_timestamp=row.get('generation_timestamp'),
            generation_duration_ms=row.get('generation_duration_ms'),
            generation_metadata=generation_metadata,
            is_draft=bool(row.get('is_draft', True)),
            is_active=bool(row.get('is_active', False)),
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            last_edited_by=row.get('last_edited_by'),
            edit_history=edit_history
        )


# Singleton instance
problem_generator_service = ProblemGeneratorService()
