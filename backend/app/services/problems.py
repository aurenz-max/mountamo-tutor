from typing import Dict, Any, List, Optional
from datetime import datetime
from .base_ai_service import BaseAIService
from .ai_service_factory import AIServiceFactory
import logging
import json
import random
from google import genai
from google.genai.types import GenerateContentConfig, Schema
from ..generators.content_schemas import (
    PRACTICE_PROBLEMS_SCHEMA,
    PRACTICE_PROBLEMS_SCHEMA_STEP1,  # DEPRECATED - kept for reference only
    VISUAL_TYPE_TO_SCHEMA
)
from ..generators.problem_type_schemas import (
    TYPE_SELECTION_SCHEMA,
    PROBLEM_TYPE_METADATA,
    ALL_PROBLEM_TYPES
)
from ..generators.content import ContentGenerationRequest
from ..core.config import settings
import asyncio

logger = logging.getLogger(__name__)


class ProblemService:
    def __init__(self):
        # Dependencies will be injected - don't initialize here
        self.ai_service = None  # Will be set by dependency injection
        self.competency_service = None  # Will be set by dependency injection
        self.recommender = None  # Will be set by dependency injection
        self.cosmos_db = None  # Will be set by dependency injection
        self.problem_optimizer = None  # Will be set by dependency injection
        self.master_context_generator = None  # Will be set by dependency injection
        self.context_primitives_generator = None  # Will be set by dependency injection
        self.user_profiles_service = None  # Will be set by dependency injection (for misconceptions)
        self._problem_history = {}  # In-memory storage for now
        self._current_ai_service_type = "gemini"  # Default to Gemini for JSON schema support

        # Initialize Gemini client like the generators do
        self.client = None
        self._initialize_gemini()
    
    def _initialize_gemini(self):
        """Initialize Gemini client with configuration"""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required. Please check your configuration.")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info(f"Gemini client initialized for {self.__class__.__name__}")

    # ============================================================================
    # VISUAL GENERATION PIPELINE - Two-Step Architecture
    # ============================================================================

    def _build_batch_visual_schema(self, intents: List[Dict[str, Any]]) -> Schema:
        """
        Dynamically builds a schema for batch visual generation based on intents.

        Args:
            intents: List of visual intents with visual_id and visual_type
                     Example: [{"visual_id": "q_1", "visual_type": "bar-model"}, ...]

        Returns:
            Schema object with properties for each visual_id
        """
        properties = {}
        required_ids = []

        for intent in intents:
            visual_id = intent.get("visual_id")
            visual_type = intent.get("visual_type")

            if not visual_id or not visual_type:
                logger.warning(f"Intent missing visual_id or visual_type: {intent}")
                continue

            # Get the schema for this visual type
            visual_schema = VISUAL_TYPE_TO_SCHEMA.get(visual_type)
            if not visual_schema:
                logger.warning(f"Unknown visual type: {visual_type}")
                continue

            properties[visual_id] = visual_schema
            required_ids.append(visual_id)

        # Create composite schema
        batch_schema = Schema(
            type="object",
            properties=properties,
            required=required_ids
        )

        logger.info(f"Built batch schema with {len(properties)} visual intents: {list(properties.keys())}")
        return batch_schema

    async def _generate_batch_visuals(
        self,
        problem: Dict[str, Any],
        problem_context: str
    ) -> Dict[str, Dict[str, Any]]:
        """
        Generates all visuals for a single problem in ONE AI call.

        Args:
            problem: Problem dict with visual intents
            problem_context: Context string describing the problem

        Returns:
            Dict mapping visual_id to visual data: {"q_1": {...}, "opt_A": {...}, ...}
        """
        try:
            # Collect all visual intents from the problem
            intents = []

            # Check for live_interaction visual intent (NEW STRUCTURE)
            if problem.get('problem_type') == 'live_interaction':
                visual_intent = problem.get("visual_intent", {})
                interaction_config = problem.get("interaction_config", {})

                # Check for display_visual_intent in visual_intent
                display_intent = visual_intent.get("display_visual_intent")
                if display_intent and display_intent.get("needs_visual"):
                    intents.append(display_intent)
                    logger.info(f"Found display_visual_intent for live_interaction problem {problem.get('id', 'unknown')}")

                # Check for interaction_visual_intent in interaction_config (NEW LOCATION)
                interaction_intent = interaction_config.get("interaction_visual_intent")
                if interaction_intent and interaction_intent.get("needs_visual"):
                    intents.append(interaction_intent)
                    logger.info(f"Found interaction_visual_intent in interaction_config for live_interaction problem {problem.get('id', 'unknown')}")

                # LEGACY FALLBACK: Check old location for backward compatibility
                legacy_interaction_intent = visual_intent.get("interaction_visual_intent")
                if not interaction_intent and legacy_interaction_intent and legacy_interaction_intent.get("needs_visual"):
                    intents.append(legacy_interaction_intent)
                    logger.info(f"Found legacy interaction_visual_intent in visual_intent for problem {problem.get('id', 'unknown')}")

                # LEGACY FALLBACK: Single visual_intent (oldest format)
                if not display_intent and not interaction_intent and not legacy_interaction_intent and visual_intent.get("needs_visual"):
                    intents.append(visual_intent)
                    logger.info(f"Found legacy single visual_intent for live_interaction problem {problem.get('id', 'unknown')}")
            else:
                # Check question/statement visual intent (for other problem types)
                question_intent = problem.get("question_visual_intent") or problem.get("statement_visual_intent")
                if question_intent and question_intent.get("needs_visual"):
                    intents.append(question_intent)

            if not intents:
                logger.info(f"No visual intents found for problem {problem.get('id', 'unknown')}")
                return {}

            logger.info(f"Generating {len(intents)} visuals for problem {problem.get('id', 'unknown')}")

            # Build composite schema
            batch_schema = self._build_batch_visual_schema(intents)

            # Build focused prompt
            prompt_parts = [
                f"Generate visual data for this {problem.get('problem_type', 'problem')}:",
                f"Problem: {problem_context}",
                ""
            ]

            # For live_interaction, include critical context about interaction targets
            if problem.get('problem_type') == 'live_interaction':
                interaction_config = problem.get('interaction_config', {})
                targets = interaction_config.get('targets', [])
                mode = interaction_config.get('mode', 'unknown')

                prompt_parts.extend([
                    "🎯 LIVE INTERACTION CONTEXT:",
                    f"- Interaction mode: {mode}",
                    f"- Number of targets: {len(targets)}",
                    f"- Target IDs that MUST exist in visual: {[t.get('id') for t in targets]}",
                    ""
                ])

                if mode == 'click' and targets:
                    # Extract what the targets represent from their IDs
                    prompt_parts.append("⚠️ CRITICAL FOR CARD-GRID:")
                    prompt_parts.append(f"- You MUST create exactly {len(targets)} cards")
                    prompt_parts.append(f"- Card IDs MUST be: {', '.join([t.get('id') for t in targets])}")
                    prompt_parts.append("- Each card must have: id, content_type, primary_value fields")
                    prompt_parts.append(f"- Instruction from problem: {problem.get('prompt', {}).get('instruction', '')}")
                    prompt_parts.append("")

            prompt_parts.append("You must generate JSON with these exact keys and visual types:")

            for intent in intents:
                visual_id = intent.get("visual_id")
                visual_type = intent.get("visual_type")
                visual_purpose = intent.get("visual_purpose", "No specific purpose provided")
                prompt_parts.append(f"- '{visual_id}': {visual_type} - {visual_purpose}")

            prompt_parts.extend([
                "",
                "IMPORTANT:",
                "- Return ONLY the JSON object with these exact keys",
                "- All visuals in this problem should be stylistically consistent",
                "- Use appropriate colors and sizing for kindergarten students",
                "- Keep visuals simple and clear",
                "",
                "⚠️ CRITICAL - VISUAL INSTRUCTIONS MUST BE SCENE-SETTING ONLY:",
                "- Visual instruction should ONLY describe the SCENARIO/SCENE, not ask the question",
                "- The question/statement from Step 1 drives evaluation - visuals just illustrate",
                "- GOOD: 'Aisha starts with 2 crackers and gets 2 more from mom'",
                "- BAD: 'Show the total number of crackers' or 'Count how many crackers'",
                "- NEVER include directive language (show, count, find, how many) in visual instructions",
                "- Think: What does the student SEE, not what should they DO",
                "",
                "📋 SCHEMA USAGE GUIDELINES:",
                "- Follow the schema descriptions exactly - they contain critical structural rules",
                "- For card-grid: Each card MUST have the exact id specified in the targets list above",
                "- For comparison-panel: Each panel represents ONE distinct entity/group being compared",
                "- For object-collection items: Each item entry represents ONE object type with its total count",
                "- Pay close attention to what belongs together vs what should be separated",
                "- Ensure each visual accurately represents the underlying problem and contains enough information to answer the question"
            ])

            prompt = "\n".join(prompt_parts)

            logger.info(f"Calling Gemini Flash for batch visual generation (model: gemini-flash-lite)")

            # Call Gemini 1.5 Flash for visual generation (cheaper, faster model)
            response = await self.client.aio.models.generate_content(
                model='gemini-flash-lite-latest',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=batch_schema,
                    temperature=0.7,
                    max_output_tokens=4000
                )
            )

            visual_batch = json.loads(response.text)
            logger.info(f"Successfully generated {len(visual_batch)} visuals: {list(visual_batch.keys())}")
            return visual_batch

        except Exception as e:
            logger.error(f"Error in _generate_batch_visuals: {str(e)}")
            import traceback
            traceback.print_exc()
            return {}

    def _inject_visuals_into_problem(
        self,
        problem: Dict[str, Any],
        visual_batch: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Injects visual data into problem, replacing visual intents with visual data.

        Args:
            problem: Problem with visual intents
            visual_batch: Dict mapping visual_id to visual data

        Returns:
            Problem with visual_data fields (intents removed)
        """
        # Handle live_interaction separately (NEW STRUCTURE)
        if problem.get('problem_type') == 'live_interaction':
            visual_intent = problem.get('visual_intent', {})
            interaction_config = problem.get('interaction_config', {})

            # Handle display_visual (goes in visual_content)
            display_intent = visual_intent.get('display_visual_intent')
            if display_intent and display_intent.get('needs_visual'):
                display_id = display_intent.get('visual_id')
                display_type = display_intent.get('visual_type')

                if display_id in visual_batch:
                    problem['visual_content'] = {
                        'display_visual': {
                            'visual_type': display_type,
                            'visual_data': visual_batch[display_id]
                        }
                    }
                    logger.info(f"Injected display_visual ({display_type}) into visual_content")
                else:
                    problem['visual_content'] = None
                    logger.warning(f"Display visual {display_id} not found in batch")
            else:
                problem['visual_content'] = None

            # Handle interaction_visual (NEW: goes in interaction_config)
            interaction_intent = interaction_config.get('interaction_visual_intent')
            if interaction_intent and interaction_intent.get('needs_visual'):
                interaction_id = interaction_intent.get('visual_id')
                interaction_type = interaction_intent.get('visual_type')

                if interaction_id in visual_batch:
                    problem['interaction_config']['interaction_visual'] = {
                        'visual_type': interaction_type,
                        'visual_data': visual_batch[interaction_id]
                    }
                    logger.info(f"Injected interaction_visual ({interaction_type}) into interaction_config")

                    # Remove the intent after injecting data
                    if 'interaction_visual_intent' in problem['interaction_config']:
                        del problem['interaction_config']['interaction_visual_intent']
                else:
                    logger.warning(f"Interaction visual {interaction_id} not found in batch")

            # LEGACY FALLBACK: Check old location for backward compatibility
            else:
                legacy_interaction_intent = visual_intent.get('interaction_visual_intent')
                if legacy_interaction_intent and legacy_interaction_intent.get('needs_visual'):
                    interaction_id = legacy_interaction_intent.get('visual_id')
                    interaction_type = legacy_interaction_intent.get('visual_type')

                    if interaction_id in visual_batch:
                        # Place in NEW location even though intent was in old location
                        problem['interaction_config']['interaction_visual'] = {
                            'visual_type': interaction_type,
                            'visual_data': visual_batch[interaction_id]
                        }
                        logger.info(f"Migrated legacy interaction_visual ({interaction_type}) to interaction_config")
                    else:
                        logger.warning(f"Legacy interaction visual {interaction_id} not found in batch")

            # LEGACY FALLBACK: Single visual (oldest format)
            if not display_intent and not interaction_intent:
                if visual_intent.get('needs_visual'):
                    visual_id = visual_intent.get('visual_id')
                    visual_type = visual_intent.get('visual_type')

                    if visual_id in visual_batch:
                        problem['visual_content'] = {
                            'visual_type': visual_type,
                            'visual_data': visual_batch[visual_id]
                        }
                        logger.info(f"Injected legacy single visual ({visual_type}) for live_interaction")
                    else:
                        logger.warning(f"Legacy visual {visual_id} not found in batch")

            # Remove the visual_intent field
            if 'visual_intent' in problem:
                del problem['visual_intent']

            return problem

        # Handle standard problem types (multiple_choice, true_false, etc.)
        question_intent = problem.get("question_visual_intent") or problem.get("statement_visual_intent")
        intent_field = "question_visual_intent" if "question_visual_intent" in problem else "statement_visual_intent"
        data_field = "question_visual_data" if "question_visual_intent" in problem else "statement_visual_data"

        if question_intent and question_intent.get("needs_visual"):
            visual_id = question_intent.get("visual_id")
            visual_type = question_intent.get("visual_type")

            if visual_id in visual_batch:
                problem[data_field] = {
                    "type": visual_type,
                    "data": visual_batch[visual_id]
                }
                logger.info(f"Injected {visual_type} visual for {data_field} (id: {visual_id})")
            else:
                problem[data_field] = None
                logger.warning(f"Visual {visual_id} not found in batch, setting to null")
        else:
            problem[data_field] = None

        # Remove the intent field
        if intent_field in problem:
            del problem[intent_field]

        return problem

    async def _orchestrate_visual_generation(
        self,
        problems_with_intents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Orchestrates visual generation for multiple problems.
        Each problem's visuals are generated in one batch call for consistency.
        Multiple problems can be processed in parallel.

        Args:
            problems_with_intents: List of problems with visual intents

        Returns:
            List of problems with visual_data embedded (intents removed)
        """
        logger.info(f"Orchestrating visual generation for {len(problems_with_intents)} problems")

        async def process_problem(problem: Dict[str, Any]) -> Dict[str, Any]:
            """Process a single problem's visuals"""
            problem_id = problem.get('id', 'unknown')
            problem_type = problem.get('problem_type', 'unknown')

            # Build context string for this problem
            if problem.get('question'):
                problem_context = f"{problem_type}: {problem.get('question')}"
            elif problem.get('statement'):
                problem_context = f"{problem_type}: {problem.get('statement')}"
            else:
                problem_context = f"{problem_type} problem"

            try:
                # Generate all visuals for this problem in ONE call
                visual_batch = await self._generate_batch_visuals(problem, problem_context)

                # Inject the visuals into the problem
                updated_problem = self._inject_visuals_into_problem(problem, visual_batch)

                return updated_problem

            except Exception as e:
                logger.error(f"Failed to generate visuals for problem {problem_id}: {str(e)}")
                # Graceful degradation: set all visuals to null
                problem = self._inject_visuals_into_problem(problem, {})
                return problem

        # Process all problems in parallel
        updated_problems = await asyncio.gather(*[process_problem(p) for p in problems_with_intents])

        logger.info(f"Visual generation complete for {len(updated_problems)} problems")
        return updated_problems

    def set_ai_service(self, service_type: str) -> None:
        """
        Set the AI service to use for generating problems
        
        Args:
            service_type: 'anthropic', 'claude', or 'gemini'
        """
        self._current_ai_service_type = service_type
        # Update the current service instance
        self.ai_service = AIServiceFactory.get_service(service_type)
        print(f"[INFO] Set AI service to: {service_type}")

    def get_current_ai_service(self) -> BaseAIService:
        """
        Get the current AI service based on the set service type

        Returns:
            The current AI service instance implementing BaseAIService
        """
        if not self.ai_service:
            self.ai_service = AIServiceFactory.get_service(self._current_ai_service_type)
        return self.ai_service

    # ============================================================================
    # THREE-PHASE PROBLEM GENERATION - Scalable Per-Type Architecture
    # ============================================================================

    async def _select_problem_types(
        self,
        subject: str,
        recommendations: List[Dict[str, Any]],
        count: int,
        context_primitives: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        PHASE 1: Use LLM to select optimal problem types for the learning objectives.

        This phase calls Gemini Flash Fast to intelligently choose which problem types
        to generate based on subject, learning objectives, and pedagogical best practices.

        Args:
            subject: The subject area (e.g., "Language Arts", "Math")
            recommendations: List of recommendation objects with learning objectives
            count: Total number of problems to generate
            context_primitives: Optional context primitives for problem variety

        Returns:
            List of selected types with counts and reasoning:
            [
                {"type": "multiple_choice", "count": 2, "reasoning": "..."},
                {"type": "live_interaction", "count": 3, "reasoning": "..."}
            ]
        """
        try:
            logger.info(f"[PHASE_1] Selecting problem types for {count} {subject} problems")

            # Build prompt for type selection
            objectives_summary = []
            for i, rec in enumerate(recommendations[:count]):
                skill_desc = rec.get('skill', {}).get('description', 'Unknown skill')
                subskill_desc = rec.get('subskill', {}).get('description', 'Unknown subskill')
                detailed_obj = rec.get('detailed_objectives', {}).get('DetailedObjective', '')
                misconception = rec.get('misconception_to_address')

                obj_text = f"Problem {i+1}: {skill_desc} → {subskill_desc}"
                if detailed_obj:
                    obj_text += f" ({detailed_obj})"
                if misconception:
                    obj_text += f" [REMEDIATION: {misconception}]"
                objectives_summary.append(obj_text)

            # Build context section
            context_section = ""
            if context_primitives:
                objects_count = len(context_primitives.get('concrete_objects', []))
                scenarios_count = len(context_primitives.get('scenarios', []))
                context_section = f"\n\nAvailable Context Primitives: {objects_count} objects, {scenarios_count} scenarios available for variety"

            prompt = f"""You are an expert educational content designer selecting the optimal mix of problem types for kindergarten students.

Subject: {subject}
Total Problems to Generate: {count}
Grade Level: Kindergarten (ages 5-6)

Learning Objectives:
{chr(10).join(objectives_summary)}
{context_section}

Available Problem Types:
"""
            # Add problem type descriptions
            for ptype, metadata in PROBLEM_TYPE_METADATA.items():
                prompt += f"\n• {ptype}: {metadata['best_for']}"

            prompt += f"""

Your Task:
1. Select 1-{min(count, 5)} different problem types that best align with the learning objectives
2. Distribute the {count} problems across your selected types
3. Explain your pedagogical reasoning for each selection
4. For EACH problem type, decide whether to enable AI Coach (live interaction coaching)

Guidelines:
- Prioritize interactive types (live_interaction) for phonics, letter recognition, and verbal practice
- Use variety to maintain engagement (but focus on 2-3 types for coherence)
- Consider remediation needs (if misconceptions are flagged, choose types that directly address them)
- Match problem types to the nature of skills (e.g., categorization for classification, sequencing for processes)
- For Language Arts phonics/ABC: strongly favor live_interaction and letter-based activities
- Ensure total count adds up to exactly {count}

AI Coach Decision Guidelines:
For each problem type you select, also decide whether to enable the AI Coach feature:
- **STRONGLY FAVOR AI COACH** for:
  * K-2 students (current grade level is Kindergarten)
  * Phonics, reading, letter recognition, rhyming content
  * Simple conceptual problems that benefit from verbal guidance
  * Problems requiring step-by-step support
- **OPTIONALLY ENABLE** for:
  * Skills requiring verbal explanation (e.g., "Why is this the answer?")
  * Problems where immediate feedback enhances learning
- **DISABLE** for:
  * Very simple problems where AI coach may be distracting
  * Problems where independent thinking is the goal
  * Advanced/complex problems better suited for older students

Think about what will be most effective and engaging for 5-6 year olds learning these specific concepts."""

            logger.info(f"[PHASE_1] Calling Gemini Flash Fast for type selection")

            # Call Gemini Flash Fast (cheapest, fastest model for this simple task)
            response = await self.client.aio.models.generate_content(
                model='gemini-flash-lite-latest',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=TYPE_SELECTION_SCHEMA,
                    temperature=0.7,
                    max_output_tokens=1000
                )
            )

            result = json.loads(response.text)
            selected_types = result.get('selected_types', [])
            overall_reasoning = result.get('overall_reasoning', '')

            # Validate total count
            total_selected = sum(t['count'] for t in selected_types)
            if total_selected != count:
                logger.warning(f"[PHASE_1] Type selection returned {total_selected} problems, expected {count}. Adjusting...")
                # Simple adjustment: scale proportionally
                scale_factor = count / total_selected
                for t in selected_types:
                    t['count'] = max(1, round(t['count'] * scale_factor))
                # Final correction
                diff = count - sum(t['count'] for t in selected_types)
                if diff != 0:
                    selected_types[0]['count'] += diff

            logger.info(f"[PHASE_1] ✅ Selected types: {[(t['type'], t['count'], '🎤' if t.get('enable_ai_coach') else '📝') for t in selected_types]}")
            logger.info(f"[PHASE_1] Overall reasoning: {overall_reasoning}")

            for t in selected_types:
                ai_coach_status = "✅ AI Coach ENABLED" if t.get('enable_ai_coach') else "❌ AI Coach disabled"
                logger.info(f"[PHASE_1]   • {t['type']} ({t['count']}): {t['reasoning']}")
                logger.info(f"[PHASE_1]     {ai_coach_status}: {t.get('ai_coach_rationale', 'No rationale provided')}")

            return selected_types

        except Exception as e:
            logger.error(f"[PHASE_1] ❌ Type selection failed: {str(e)}")
            import traceback
            traceback.print_exc()
            raise  # Fail fast in development mode

    async def _generate_single_type(
        self,
        problem_type: str,
        subject: str,
        recommendations: List[Dict[str, Any]],
        num_problems: int,
        context_primitives: Optional[Dict[str, Any]] = None,
        enable_ai_coach: bool = False
    ) -> Dict[str, Any]:
        """
        PHASE 2: Generate problems of a single type using focused schema.

        This phase generates problems for one specific type, using the appropriate
        Gemini model (Flash Fast for simple, Flash for complex) and focused schema.

        Args:
            problem_type: The specific problem type to generate (e.g., "multiple_choice")
            subject: The subject area
            recommendations: List of recommendation objects for this batch
            num_problems: Number of problems of this type to generate
            context_primitives: Optional context primitives for variety
            enable_ai_coach: Whether to add live_interaction_config for AI coaching

        Returns:
            Dict with type and generated problems:
            {"type": "multiple_choice", "problems": [...]}
        """
        try:
            metadata = PROBLEM_TYPE_METADATA[problem_type]
            schema = metadata['schema']
            model = metadata['model']
            max_tokens = metadata['max_tokens']

            logger.info(f"[PHASE_2] Generating {num_problems} {problem_type} problems using {model}")

            # Build context section
            context_section = ""
            if context_primitives:
                all_objects = context_primitives.get('concrete_objects', [])
                all_characters = context_primitives.get('characters', [])
                all_scenarios = context_primitives.get('scenarios', [])
                all_locations = context_primitives.get('locations', [])

                # Random sample for variety
                sampled_objects = random.sample(all_objects, min(10, len(all_objects)))
                sampled_characters = random.sample(all_characters, min(5, len(all_characters)))
                sampled_scenarios = random.sample(all_scenarios, min(8, len(all_scenarios)))
                sampled_locations = random.sample(all_locations, min(6, len(all_locations)))

                objects_sample = ', '.join(sampled_objects)
                characters_sample = [f"{c.get('name', 'Unknown')} ({c.get('age', 'child')})"
                                   for c in sampled_characters]
                scenarios_sample = ', '.join(sampled_scenarios)
                locations_sample = ', '.join(sampled_locations)

                context_section = f"""

CONTEXT PRIMITIVES FOR VARIETY:
✓ Objects: {objects_sample}
✓ Characters: {', '.join(characters_sample)}
✓ Scenarios: {scenarios_sample}
✓ Locations: {locations_sample}

VARIETY INSTRUCTIONS:
- Use DIFFERENT combinations from the context primitives for each problem
- Never reuse the same object-character-scenario combination
- Ensure each problem feels unique and engaging"""

            # Build focused prompt for this specific problem type
            prompt = f"""Generate {num_problems} {problem_type} problems for kindergarten students (ages 5-6) in {subject}.
{context_section}

Learning Objectives:
"""
            # Add recommendations
            for i, rec in enumerate(recommendations[:num_problems]):
                misconception_section = ""
                if rec.get('misconception_to_address'):
                    misconception_section = f"""
🎯 CRITICAL: This problem must address the misconception: "{rec.get('misconception_to_address')}"
- Design the problem to directly challenge this misunderstanding
- Include clear rationale explaining why the misconception is wrong"""

                prompt += f"""
Problem {i+1}:
- Skill: {rec.get('skill', {}).get('description', '')}
- Subskill: {rec.get('subskill', {}).get('description', '')}
- Objective: {rec.get('detailed_objectives', {}).get('DetailedObjective', '')}
- Difficulty: {rec.get('difficulty', 5.0)}/10
{misconception_section}
"""

            # Add type-specific visual guidance based on the problem type
            visual_guidance = self._get_visual_guidance_for_type(problem_type, subject)
            prompt += f"\n{visual_guidance}"

            prompt += f"""

CRITICAL REQUIREMENTS:
- Each problem MUST have a unique id (e.g., "{problem_type[:3]}_001", "{problem_type[:3]}_002")
- Set grade_level as "Kindergarten"
- Set difficulty as "easy" or "medium"
- Include comprehensive rationale and teaching notes
- Provide encouraging success_criteria
- Use simple, clear language appropriate for ages 5-6
"""

            logger.info(f"[PHASE_2] Calling {model} for {problem_type} generation")

            # Call appropriate Gemini model
            response = await self.client.aio.models.generate_content(
                model=model,
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=schema,
                    temperature=0.7,
                    max_output_tokens=max_tokens
                )
            )

            result = json.loads(response.text)
            problems = result.get('problems', [])

            logger.info(f"[PHASE_2] ✅ Generated {len(problems)} {problem_type} problems")

            # POST-PROCESSING: Add AI coach config if enabled
            if enable_ai_coach:
                logger.info(f"[PHASE_2] 🎤 Adding AI coach config to {len(problems)} problems")

                # Build topic context for AI coach config generation
                topic_context = {
                    'skill_description': subject,
                    'grade_level': 'Kindergarten',
                    'recommendations': recommendations
                }

                # Add live_interaction_config to each problem
                for i, problem in enumerate(problems):
                    try:
                        live_config = self.generate_ai_coach_config(
                            problem_type=problem_type,
                            problem_data=problem,
                            topic_context=topic_context
                        )
                        problem['live_interaction_config'] = live_config
                        logger.info(f"[PHASE_2]   ✅ Added AI coach to problem {i+1}/{len(problems)}")
                    except Exception as e:
                        logger.error(f"[PHASE_2]   ❌ Failed to add AI coach to problem {i+1}: {str(e)}")
                        # Continue without AI coach for this problem rather than failing

            return {
                "type": problem_type,
                "problems": problems
            }

        except Exception as e:
            logger.error(f"[PHASE_2] ❌ Failed to generate {problem_type}: {str(e)}")
            import traceback
            traceback.print_exc()
            raise  # Fail fast in development mode

    def _get_visual_guidance_for_type(self, problem_type: str, subject: str) -> str:
        """
        Get type-specific visual generation guidance.

        Args:
            problem_type: The problem type
            subject: The subject area

        Returns:
            Visual guidance text for the prompt
        """
        # Common visual guidance for types that support visuals
        if problem_type in ['multiple_choice', 'true_false']:
            return """
🎨 VISUAL GENERATION INSTRUCTIONS:
For questions that would benefit from visuals:
- Set needs_visual=true in question_visual_intent (or statement_visual_intent for true/false)
- Choose the MOST APPROPRIATE visual type from: object-collection, comparison-panel, bar-model, letter-picture, etc.
- Provide clear visual_purpose describing what the visual should show
- Use unique visual_id (e.g., "q_1", "q_2")

VISUAL SELECTION RULES:
• For counting/showing objects → object-collection or comparison-panel
• For abstract data → bar-model
• For letter/phonics → letter-picture, letter-tracing, rhyming-pairs
• For shapes → geometric-shape
• Keep visuals simple and age-appropriate"""
        elif problem_type == 'live_interaction':
            return """
🎨 VISUAL GENERATION INSTRUCTIONS FOR LIVE INTERACTION - NEW STRUCTURE:

CRITICAL ARCHITECTURAL CHANGE:
• display_visual_intent: Lives in visual_intent (informational content)
• interaction_visual_intent: NOW LIVES IN interaction_config (tightly coupled with targets)

This ensures the clickable interface is always consistent with the interaction logic.

⚡ STRUCTURE PATTERNS:

PATTERN 1: Display + Interaction (Most Common)
```json
{
  "visual_intent": {
    "display_visual_intent": {
      "needs_visual": true,
      "visual_type": "rhyming-pairs",
      "visual_purpose": "Show the words 'cat' and 'hat' with connecting line",
      "visual_id": "display_1"
    }
  },
  "interaction_config": {
    "mode": "click",
    "interaction_visual_intent": {
      "needs_visual": true,
      "visual_type": "card-grid",
      "visual_purpose": "Display two cards: 'Yes' and 'No' for student to click",
      "visual_id": "interaction_1"
    },
    "targets": [
      {"id": "card_yes", "is_correct": true},
      {"id": "card_no", "is_correct": false}
    ]
  }
}
```

PATTERN 2: Interaction Only (No Display Visual)
• visual_intent.display_visual_intent: Set needs_visual=false
• interaction_config.interaction_visual_intent: card-grid with all content

PATTERN 3: Display Only (Speech Mode)
• visual_intent.display_visual_intent: Shows content
• interaction_config.interaction_visual_intent: Set needs_visual=false (student speaks)

🎯 CRITICAL RULES:
• For mode='click': interaction_visual_intent MUST use visual_type='card-grid'
• Card IDs in the generated card-grid MUST match interaction_config.targets IDs exactly
• Card ID format: 'card_yes', 'card_no', 'card_A', 'card_B', 'card_1', 'card_2', etc.
• Each card needs: id, content_type ("text"/"image"/"image_with_label"), primary_value

WHY THIS STRUCTURE:
• Eliminates creative divergence - LLM can't invent wrong interaction visuals
• The interaction visual is generated in the same context as the targets
• Forces consistency between card IDs and target IDs

💬 FEEDBACK DESIGN:
• feedback.correct.audio: Enthusiastic praise
• feedback.incorrect.audio: Gentle encouragement with hint"""
        else:
            return """
🎨 VISUAL NOTES:
This problem type typically doesn't use complex visuals, but simple illustrations may enhance understanding where appropriate."""

    def _aggregate_problem_results(
        self,
        results: List[Dict[str, Any]],
        selected_types: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict]]:
        """
        PHASE 2.5: Aggregate results from parallel/sequential generation into unified structure.

        Args:
            results: List of results from _generate_single_type calls
            selected_types: Original type selection from Phase 1 (for logging/debugging)

        Returns:
            Unified structure matching expected format:
            {
                "multiple_choice": [...],
                "live_interaction": [...],
                ...
            }
        """
        try:
            logger.info(f"[PHASE_2.5] Aggregating {len(results)} result batches")

            # Initialize structure with all possible types
            aggregated = {ptype: [] for ptype in ALL_PROBLEM_TYPES}

            # Merge results
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"[PHASE_2.5] ❌ Skipping failed result: {result}")
                    continue

                problem_type = result.get('type')
                problems = result.get('problems', [])

                if problem_type and problems:
                    aggregated[problem_type].extend(problems)
                    logger.info(f"[PHASE_2.5]   ✅ Added {len(problems)} {problem_type} problems")

            # Remove empty arrays for cleaner output
            aggregated = {k: v for k, v in aggregated.items() if v}

            total_problems = sum(len(v) for v in aggregated.values())
            logger.info(f"[PHASE_2.5] ✅ Aggregated {total_problems} total problems across {len(aggregated)} types")

            return aggregated

        except Exception as e:
            logger.error(f"[PHASE_2.5] ❌ Aggregation failed: {str(e)}")
            import traceback
            traceback.print_exc()
            raise

    async def generate_problem(
        self,
        subject: str,
        recommendations: List[Dict[str, Any]],
        count: int = 5,
        context_primitives: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        THREE-PHASE problem generation using scalable per-type architecture.

        PHASE 1: LLM selects optimal problem types (Gemini Flash Fast)
        PHASE 2: Generate each type with focused schemas (Sequential - Dev Mode)
        PHASE 3: Visual generation (UNCHANGED - existing pipeline)

        Args:
            subject: The subject area
            recommendations: List of recommendation objects
            count: Number of problems to generate
            context_primitives: Optional context primitives for problem variety

        Returns:
            JSON string with problems array organized by type
        """
        try:
            logger.info(f"[GENERATE_PROBLEM] Starting three-phase generation: {count} {subject} problems")
            print(f"[DEBUG] THREE-PHASE GENERATION: {count} problems for {subject}")

            # Handle single recommendation for backward compatibility
            if isinstance(recommendations, dict):
                recommendations = [recommendations]

            # Ensure we have enough recommendations
            if len(recommendations) < count:
                while len(recommendations) < count:
                    recommendations.append(recommendations[-1])

            # ========================================================================
            # PHASE 1: LLM-Driven Type Selection
            # ========================================================================
            logger.info(f"[GENERATE_PROBLEM] ========== PHASE 1: TYPE SELECTION ==========")
            selected_types = await self._select_problem_types(
                subject=subject,
                recommendations=recommendations,
                count=count,
                context_primitives=context_primitives
            )

            # ========================================================================
            # PHASE 2: Sequential Per-Type Generation (Dev Mode)
            # ========================================================================
            logger.info(f"[GENERATE_PROBLEM] ========== PHASE 2: PROBLEM GENERATION ==========")

            generation_results = []
            rec_index = 0  # Track which recommendations we've used

            for type_selection in selected_types:
                problem_type = type_selection['type']
                num_problems = type_selection['count']
                reasoning = type_selection['reasoning']
                enable_ai_coach = type_selection.get('enable_ai_coach', False)
                ai_coach_rationale = type_selection.get('ai_coach_rationale', '')

                ai_coach_indicator = "🎤 with AI Coach" if enable_ai_coach else "📝 without AI Coach"
                logger.info(f"[GENERATE_PROBLEM] Generating {num_problems} {problem_type} problems {ai_coach_indicator} ({reasoning})")
                if enable_ai_coach:
                    logger.info(f"[GENERATE_PROBLEM]   AI Coach rationale: {ai_coach_rationale}")

                # Get recommendations for this batch
                batch_recs = recommendations[rec_index:rec_index + num_problems]
                rec_index += num_problems

                # Generate this type (sequential for dev mode)
                result = await self._generate_single_type(
                    problem_type=problem_type,
                    subject=subject,
                    recommendations=batch_recs,
                    num_problems=num_problems,
                    context_primitives=context_primitives,
                    enable_ai_coach=enable_ai_coach
                )

                generation_results.append(result)

            # Aggregate results into unified structure
            problems_with_intents = self._aggregate_problem_results(
                results=generation_results,
                selected_types=selected_types
            )

            # ========================================================================
            # PHASE 3: Visual Generation (UNCHANGED)
            # ========================================================================
            logger.info(f"[GENERATE_PROBLEM] ========== PHASE 3: VISUAL GENERATION ==========")

            try:
                # Collect all problems across all types
                all_problems = []
                for problem_type in ALL_PROBLEM_TYPES:
                    if problem_type in problems_with_intents and problems_with_intents[problem_type]:
                        for problem in problems_with_intents[problem_type]:
                            problem['problem_type'] = problem_type
                            all_problems.append(problem)

                logger.info(f"[GENERATE_PROBLEM] Found {len(all_problems)} total problems to process for visuals")

                # Generate visuals (existing pipeline - UNCHANGED)
                problems_with_visuals = await self._orchestrate_visual_generation(all_problems)

                # Reassemble the response structure
                final_response = {problem_type: [] for problem_type in problems_with_intents.keys()}
                for problem in problems_with_visuals:
                    problem_type = problem.pop('problem_type', None)
                    if problem_type and problem_type in final_response:
                        final_response[problem_type].append(problem)

                logger.info(f"[GENERATE_PROBLEM] ✅ THREE-PHASE GENERATION COMPLETE")
                logger.info(f"[GENERATE_PROBLEM] Final result: {sum(len(v) for v in final_response.values())} problems across {len(final_response)} types")

                print(f"[DEBUG] ✅ Generation complete: {list(final_response.keys())}")
                return json.dumps(final_response)

            except Exception as e:
                # If visual generation fails, fall back to text-only problems (graceful degradation)
                logger.error(f"[GENERATE_PROBLEM] Visual generation failed, falling back to text-only: {str(e)}")
                print(f"[WARNING] Visual generation failed, returning text-only problems: {str(e)}")
                return json.dumps(problems_with_intents)

        except Exception as e:
            logger.error(f"[GENERATE_PROBLEM] ❌ Generation failed: {str(e)}")
            print(f"[ERROR] Error generating problems: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    async def get_problems(
        self,
        student_id: int,
        subject: str,
        count: int = 5,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        unit_id: Optional[str] = None,
        recommendations: Optional[List[Dict[str, Any]]] = None,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Universal method to get 1 or more problems.
        
        Args:
            student_id: The student ID
            subject: The subject area
            count: Number of problems to return (default 1)
            skill_id: Optional specific skill filter
            subskill_id: Optional specific subskill filter
            unit_id: Optional specific unit filter
            recommendations: Optional pre-computed recommendations
            
        Returns:
            List of problem objects (empty list if none found)
        """
        try:
            logger.info(f"🔵 [PROBLEM_SERVICE] get_problems() called: student_id={student_id}, subject={subject}, count={count}")
            logger.info(f"🔵 [PROBLEM_SERVICE] Filters: skill_id={skill_id}, subskill_id={subskill_id}, unit_id={unit_id}")
            logger.info(f"🔵 [PROBLEM_SERVICE] firebase_uid={'provided' if firebase_uid else 'NOT PROVIDED'}")

            # Ensure dependencies are available
            if not self.recommender or not self.competency_service:
                logger.error(f"❌ [PROBLEM_SERVICE] Required services not initialized - recommender: {bool(self.recommender)}, competency: {bool(self.competency_service)}")
                return []

            logger.info(f"✅ [PROBLEM_SERVICE] Dependencies validated - user_profiles_service: {bool(self.user_profiles_service)}")
            
            final_problems = []
            formatted_recs = []
            
            # If specific recommendations provided, use those
            if recommendations:
                print(f"[DEBUG] Using provided recommendations: {len(recommendations)}")
                for rec in recommendations:
                    subskill_id_rec = rec.get("subskill_id")
                    objectives = await self.competency_service.get_detailed_objectives(
                        subject=subject,
                        subskill_id=subskill_id_rec
                    )
                    
                    formatted_recs.append({
                        "unit": {"id": rec.get("unit_id"), "title": rec.get("unit_title")},
                        "skill": {"id": rec.get("skill_id"), "description": rec.get("skill_description")},
                        "subskill": {"id": subskill_id_rec, "description": rec.get("subskill_description")},
                        "difficulty": 5.0,
                        "detailed_objectives": objectives
                    })
            
            # Otherwise, generate recommendations based on context
            else:
                for i in range(count):
                    # Build context for recommendation
                    context = {
                        'unit': unit_id,
                        'skill': skill_id,
                        'subskill': subskill_id
                    }
                    
                    # Get recommendation
                    recommendation = await self.recommender.get_recommendation(
                        student_id=student_id,
                        subject=subject,
                        unit_filter=context.get('unit'),
                        skill_filter=context.get('skill'),
                        subskill_filter=context.get('subskill')
                    )
                    
                    if not recommendation:
                        print(f"[ERROR] No recommendation for problem {i+1}")
                        continue
                    
                    # DEVELOPMENT: Cache disabled - always generate fresh problems with latest schema
                    print(f"[DEBUG] Cache disabled - generating fresh problem for {recommendation['subskill']['id']}")
                    # cached_problems = []
                    # if self.cosmos_db:
                    #     cached_problems = await self.cosmos_db.get_cached_problems(
                    #         subject=subject,
                    #         skill_id=recommendation['skill']['id'],
                    #         subskill_id=recommendation['subskill']['id']
                    #     )
                    #
                    # if cached_problems:
                    #     # Check if cached problem has rich schema structure (not old text problems)
                    #     import random
                    #     selected = random.choice(cached_problems)
                    #     problem_data = selected.get("problem_data", selected)
                    #
                    #     # Only use cache if it has rich schema fields (options, rationale, etc.)
                    #     if (problem_data.get('options') or problem_data.get('statement') or
                    #         problem_data.get('blanks') or problem_data.get('items')):
                    #         print(f"[DEBUG] Using cached rich schema problem for {recommendation['subskill']['id']}")
                    #         final_problems.append(problem_data)
                    #         continue
                    #     else:
                    #         print(f"[DEBUG] Skipping old cached problem without rich schema for {recommendation['subskill']['id']}")
                    #         # Don't use old cached problems - regenerate with rich schema
                    
                    # Get detailed objectives for this recommendation
                    objectives = await self.competency_service.get_detailed_objectives(
                        subject=subject,
                        subskill_id=recommendation['subskill']['id']
                    )

                    # MISCONCEPTION-DRIVEN PRACTICE ENGINE
                    # Check if student has an active misconception for this subskill
                    misconception_text = None
                    subskill_id_for_check = recommendation['subskill']['id']

                    logger.info(f"🔍 [MISCONCEPTION_ENGINE] Checking for misconceptions - subskill_id={subskill_id_for_check}")
                    logger.info(f"🔍 [MISCONCEPTION_ENGINE] user_profiles_service available: {bool(self.user_profiles_service)}")
                    logger.info(f"🔍 [MISCONCEPTION_ENGINE] firebase_uid available: {bool(firebase_uid)}")

                    if self.user_profiles_service and firebase_uid:
                        logger.info(f"🔍 [MISCONCEPTION_ENGINE] Calling get_active_misconception_for_subskill(uid={firebase_uid[:8]}..., subskill_id={subskill_id_for_check})")
                        misconception = await self.user_profiles_service.get_active_misconception_for_subskill(
                            uid=firebase_uid,
                            subskill_id=subskill_id_for_check
                        )
                        if misconception:
                            misconception_text = misconception.misconception_text
                            logger.info(f"🎯 [MISCONCEPTION_ENGINE] ✅ FOUND active misconception for subskill {subskill_id_for_check}")
                            logger.info(f"🎯 [MISCONCEPTION_ENGINE] Misconception text: {misconception_text[:100]}...")
                        else:
                            logger.info(f"✅ [MISCONCEPTION_ENGINE] No active misconception found for subskill {subskill_id_for_check}")
                    else:
                        if not self.user_profiles_service:
                            logger.warning(f"⚠️ [MISCONCEPTION_ENGINE] user_profiles_service not available - skipping misconception check")
                        if not firebase_uid:
                            logger.warning(f"⚠️ [MISCONCEPTION_ENGINE] firebase_uid not provided - skipping misconception check")

                    formatted_recs.append({
                        **recommendation,
                        'detailed_objectives': objectives,
                        'misconception_to_address': misconception_text  # Add misconception to recommendation
                    })

                    if misconception_text:
                        logger.info(f"📝 [MISCONCEPTION_ENGINE] Added misconception to recommendation for problem generation")
            
            # Generate problems if we have recommendations that need new problems
            if formatted_recs:
                # Get context primitives for variety (using first recommendation)
                context_primitives = None
                if formatted_recs:
                    context_primitives = await self.get_or_generate_context_primitives(subject, formatted_recs[0])
                    if context_primitives:
                        objects_count = len(context_primitives.get('concrete_objects', []))
                        scenarios_count = len(context_primitives.get('scenarios', []))
                        logger.info(f"🚀 [DYNAMIC_VARIETY] Using context primitives for problem generation: {objects_count} objects, {scenarios_count} scenarios")
                    else:
                        logger.info(f"⚠️ [FALLBACK] No context primitives available - using default generation")

                raw_response = await self.generate_problem(subject, formatted_recs, len(formatted_recs), context_primitives)
                if raw_response:
                    try:
                        response_data = json.loads(raw_response)
                        logger.info(f"[PROBLEMS_SERVICE] Generated problems with types: {list(response_data.keys())}")
                        
                        # Use Gemini's structured response directly - just add our metadata
                        problem_types = ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity",
                                       "sequencing_activity", "categorization_activity", "scenario_question",
                                       "short_answer", "live_interaction"]
                        
                        problem_counter = 0
                        for problem_type in problem_types:
                            if problem_type in response_data and response_data[problem_type]:
                                logger.info(f"[PROBLEMS_SERVICE] Processing {len(response_data[problem_type])} {problem_type} problems")
                                
                                for gemini_problem in response_data[problem_type]:
                                    if problem_counter < len(formatted_recs):
                                        # MISCONCEPTION-DRIVEN PRACTICE ENGINE
                                        # Add remediation metadata if this problem targets a misconception
                                        metadata = {
                                            'subject': subject,
                                            'unit': formatted_recs[problem_counter].get('unit'),
                                            'skill': formatted_recs[problem_counter].get('skill'),
                                            'subskill': formatted_recs[problem_counter].get('subskill'),
                                            'difficulty': formatted_recs[problem_counter].get('difficulty'),
                                            'objectives': formatted_recs[problem_counter].get('detailed_objectives')
                                        }

                                        # Add remediation tag if problem targets a misconception
                                        if formatted_recs[problem_counter].get('misconception_to_address'):
                                            subskill_id = formatted_recs[problem_counter]['subskill']['id']
                                            metadata['remediation_for_subskill_id'] = subskill_id
                                            logger.info(f"🏷️ [MISCONCEPTION_ENGINE] ✅ Tagged problem #{problem_counter+1} as REMEDIAL for subskill {subskill_id}")
                                            logger.info(f"🏷️ [MISCONCEPTION_ENGINE] Problem type: {problem_type}, Problem ID: {gemini_problem.get('id', 'unknown')}")
                                        else:
                                            logger.info(f"📝 [PROBLEM_SERVICE] Problem #{problem_counter+1} is standard (not remedial)")

                                        # Take Gemini's structured problem and just add our metadata
                                        enriched_problem = {
                                            **gemini_problem,  # Keep all of Gemini's rich structure
                                            'problem_type': problem_type,
                                            'student_id': student_id,
                                            # Don't set user_id here - let endpoint handle it
                                            'generated_at': datetime.now().isoformat(),
                                            'composable_template': None,
                                            'metadata': metadata
                                        }
                                        
                                        # Cache the problem
                                        if self.cosmos_db and formatted_recs[problem_counter].get('skill'):
                                            await self.cosmos_db.save_cached_problem(
                                                subject=subject,
                                                skill_id=formatted_recs[problem_counter]['skill']['id'],
                                                subskill_id=formatted_recs[problem_counter]['subskill']['id'],
                                                problem_data=enriched_problem
                                            )
                                        
                                        final_problems.append(enriched_problem)
                                        problem_counter += 1
                        
                        logger.info(f"[PROBLEMS_SERVICE] Successfully processed {len(final_problems)} problems")
                        
                    except json.JSONDecodeError as e:
                        print(f"[ERROR] Failed to parse response: {e}")
                        logger.error(f"[PROBLEMS_SERVICE] JSON parsing failed: {e}")
                        logger.error(f"[PROBLEMS_SERVICE] Response text: {raw_response[:500]}...")
            
            print(f"[DEBUG] Returning {len(final_problems)} problems")
            return final_problems[:count]  # Ensure we don't return more than requested
                
        except Exception as e:
            print(f"[ERROR] Error in get_problems: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    async def get_or_generate_context_primitives(self, subject: str, recommendation: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get cached context primitives or generate new ones for a subskill.

        Args:
            subject: The subject area
            recommendation: Recommendation dict with unit, skill, subskill info

        Returns:
            Dict containing context primitives or None if generation fails
        """
        try:
            subskill_id = recommendation.get('subskill', {}).get('id')
            if not subskill_id:
                logger.error("No subskill ID found in recommendation")
                return None

            # Try to get cached primitives first
            if self.cosmos_db:
                cached_primitives = await self.cosmos_db.get_cached_context_primitives(
                    subject=subject,
                    subskill_id=subskill_id
                )
                if cached_primitives:
                    logger.info(f"Using cached context primitives for {subject}:{subskill_id}")
                    return cached_primitives

            # Cache miss - generate new primitives
            logger.info(f"🔄 Cache miss - generating new context primitives for {subject}:{subskill_id}")

            if not self.master_context_generator or not self.context_primitives_generator:
                logger.error("❌ Context generators not initialized - Dynamic Problem Variety Engine disabled")
                logger.error(f"   master_context_generator: {self.master_context_generator is not None}")
                logger.error(f"   context_primitives_generator: {self.context_primitives_generator is not None}")
                return None

            # Create ContentGenerationRequest from recommendation
            unit = recommendation.get('unit', {})
            skill = recommendation.get('skill', {})
            subskill = recommendation.get('subskill', {})

            request = ContentGenerationRequest(
                subject=subject,
                grade=recommendation.get('grade_level', 'Kindergarten'),  # Default to Kindergarten
                unit=unit.get('title', ''),
                skill=skill.get('description', ''),
                subskill=subskill.get('description', ''),
                unit_id=unit.get('id'),
                skill_id=skill.get('id'),
                subskill_id=subskill_id,
                difficulty_level="beginner",  # Most problems are for young learners
                prerequisites=[]
            )

            # Generate master context first
            logger.info(f"🧠 Generating master context for {subskill.get('description', 'unknown subskill')}")
            master_context = await self.master_context_generator.generate_master_context(request)
            logger.info(f"✅ Master context generated with {len(master_context.core_concepts)} core concepts")

            # Generate context primitives using master context
            logger.info(f"🎯 Generating context primitives using master context")
            primitives_data = await self.context_primitives_generator.generate_context_primitives(
                request, master_context
            )

            if primitives_data:
                objects_count = len(primitives_data.get('concrete_objects', []))
                scenarios_count = len(primitives_data.get('scenarios', []))
                characters_count = len(primitives_data.get('characters', []))
                logger.info(f"🎉 Context primitives generated successfully: {objects_count} objects, {scenarios_count} scenarios, {characters_count} characters")
            else:
                logger.error(f"❌ Failed to generate context primitives")
                return None

            # Cache the newly generated primitives
            if self.cosmos_db and primitives_data:
                try:
                    await self.cosmos_db.save_cached_context_primitives(
                        subject=subject,
                        grade_level=request.grade or "Kindergarten",
                        unit_id=unit.get('id', ''),
                        skill_id=skill.get('id', ''),
                        subskill_id=subskill_id,
                        primitives_data=primitives_data
                    )
                    logger.info(f"Successfully cached new context primitives for {subject}:{subskill_id}")
                except Exception as cache_error:
                    logger.error(f"Failed to cache context primitives: {cache_error}")
                    # Don't fail the request if caching fails - just log it

            return primitives_data

        except Exception as e:
            logger.error(f"Error in get_or_generate_context_primitives: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    # Legacy method for backwards compatibility
    async def get_problem(self, student_id: int, subject: str, context: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """Legacy single problem method - calls get_problems with count=1"""
        problems = await self.get_problems(
            student_id=student_id,
            subject=subject,
            count=1,
            skill_id=context.get('skill') if context else None,
            subskill_id=context.get('subskill') if context else None,
            unit_id=context.get('unit') if context else None
        )
        return problems[0] if problems else None

    async def generate_and_parse_problem(
        self,
        subject: str,
        recommendation: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a problem using AI model and parse it into a structured format.
        This is the recommended public method for composable problem generation services.
        
        Returns:
            Dict containing parsed problem data or None if generation/parsing fails
        """
        try:
            # Generate the raw problem
            raw_problem = await self.generate_problem(subject, [recommendation], 1)
            if not raw_problem:
                return None
            
            # Parse the JSON response using new rich schema format
            try:
                schema_data = json.loads(raw_problem)
                logger.info(f"[PROBLEMS_SERVICE] generate_and_parse_problem response types: {list(schema_data.keys())}")
                
                # Find the first problem from any type
                problem_types = ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity",
                               "sequencing_activity", "categorization_activity", "scenario_question", "short_answer", "live_interaction"]
                
                for problem_type in problem_types:
                    if problem_type in schema_data and schema_data[problem_type]:
                        # Return the first problem of this type
                        gemini_problem = schema_data[problem_type][0]
                        # Add the problem type to the response
                        gemini_problem['problem_type'] = problem_type
                        return gemini_problem
                
                logger.error("No problems found in any problem type arrays")
                return None
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini JSON response: {e}")
                return None
            
        except Exception as e:
            logger.error(f"Error in generate_and_parse_problem: {e}")
            return None

    # ============================================================================
    # LIVE INTERACTION AI COACH - Helper Functions
    # ============================================================================

    def generate_feedback_messages(self, problem_type: str, topic_context: dict) -> dict:
        """
        Generate age-appropriate feedback messages for correct and incorrect answers.

        Args:
            problem_type: The type of problem (multiple_choice, true_false, etc.)
            topic_context: Context including grade_level, skill_description

        Returns:
            Dict with 'correct' and 'incorrect' feedback configurations
        """
        grade_level = topic_context.get('grade_level', 'Kindergarten')
        skill_desc = topic_context.get('skill_description', 'this skill')

        # Determine enthusiasm level based on grade
        grade_lower = grade_level.lower()
        is_early_learner = any(g in grade_lower for g in ['k', 'kindergarten', '1', 'first', '2', 'second'])

        if is_early_learner:
            # K-2: Very enthusiastic, simple language
            correct_responses = [
                "Amazing job! You got it right!",
                "Excellent work! That's correct!",
                "Fantastic! You're doing so well!",
                "Perfect! You really understand this!",
                "Great thinking! That's exactly right!"
            ]
            incorrect_responses = [
                "Not quite, but that's okay! Let's try again together.",
                "Good try! Let me help you think about this.",
                "Almost! Let's look at this one more time.",
                "Nice effort! I'll give you a hint to help."
            ]
        else:
            # 3+: More mature, encouraging
            correct_responses = [
                "Excellent! You've got it!",
                "Correct! Well done!",
                "That's right! Great reasoning!",
                "Perfect! You're mastering this concept!",
                "Yes! That's the right answer!"
            ]
            incorrect_responses = [
                "Not quite. Let's think about this together.",
                "That's not correct, but I can help you figure it out.",
                "Try again. Think about what we learned about this.",
                "Good effort! Let me give you a hint."
            ]

        return {
            "correct": {
                "audio": random.choice(correct_responses),
                "visual_effect": "celebrate"
            },
            "incorrect": {
                "audio": random.choice(incorrect_responses),
                "visual_effect": "shake",
                "hint": f"Think carefully about {skill_desc}."
            }
        }

    def extract_targets_from_problem(self, problem_type: str, problem_data: dict) -> List[dict]:
        """
        Auto-extract interaction targets from problem structure.

        Targets define what the student can click/select and whether each option is correct.

        Args:
            problem_type: Type of problem (multiple_choice, true_false, etc.)
            problem_data: The problem data structure

        Returns:
            List of target dicts with: id, is_correct, description
        """
        targets = []

        if problem_type == "multiple_choice":
            # Extract from options array
            options = problem_data.get('options', [])
            correct_option_id = problem_data.get('correct_option_id')

            for option in options:
                targets.append({
                    "id": option.get('id'),
                    "is_correct": option.get('id') == correct_option_id,
                    "description": option.get('text', '')
                })

        elif problem_type == "true_false":
            # Generate True/False targets
            correct_answer = problem_data.get('correct', False)
            targets = [
                {
                    "id": "true",
                    "is_correct": correct_answer == True,
                    "description": "True"
                },
                {
                    "id": "false",
                    "is_correct": correct_answer == False,
                    "description": "False"
                }
            ]

        elif problem_type == "fill_in_blanks":
            # Each blank is a target with its correct answers
            blanks = problem_data.get('blanks', [])
            for i, blank in enumerate(blanks):
                targets.append({
                    "id": blank.get('id', f'blank_{i}'),
                    "is_correct": True,  # Evaluated differently (text matching)
                    "description": f"Blank {i+1}",
                    "correct_answers": blank.get('correct_answers', [])
                })

        elif problem_type == "matching_activity":
            # Extract pairs from mappings
            mappings = problem_data.get('mappings', [])
            for mapping in mappings:
                left_id = mapping.get('left_id')
                right_ids = mapping.get('right_ids', [])
                # Each valid pair is a target
                for right_id in right_ids:
                    targets.append({
                        "id": f"{left_id}:{right_id}",
                        "is_correct": True,
                        "description": f"Match {left_id} to {right_id}"
                    })

        elif problem_type == "sequencing_activity":
            # Correct sequence
            correct_sequence = problem_data.get('correct_sequence', [])
            targets.append({
                "id": "sequence",
                "is_correct": True,
                "description": "Correct sequence",
                "correct_sequence": correct_sequence
            })

        elif problem_type == "categorization_activity":
            # Extract item-category pairs
            items = problem_data.get('items', [])
            for item in items:
                item_id = item.get('id')
                correct_category = item.get('category')
                targets.append({
                    "id": f"{item_id}:{correct_category}",
                    "is_correct": True,
                    "description": f"{item.get('text', item_id)} belongs to {correct_category}"
                })

        logger.info(f"Extracted {len(targets)} targets for {problem_type}")
        return targets

    def generate_ai_coach_config(
        self,
        problem_type: str,
        problem_data: dict,
        topic_context: dict
    ) -> dict:
        """
        Generate complete live_interaction_config for a problem.

        This config enables real-time AI tutoring for any problem type.

        Args:
            problem_type: Type of problem (multiple_choice, true_false, etc.)
            problem_data: The complete problem data
            topic_context: Context including skill_description, grade_level, recommendations

        Returns:
            Complete live_interaction_config dict with prompt, targets, evaluation
        """
        skill_desc = topic_context.get('skill_description', 'this skill')
        grade_level = topic_context.get('grade_level', 'Kindergarten')

        # Build system prompt based on topic context
        system_prompt = f"""You are a patient, encouraging AI tutor helping a {grade_level} student learn {skill_desc}.

Your role is to:
- Provide gentle guidance without giving away answers
- Celebrate correct responses enthusiastically
- Offer helpful hints for incorrect responses
- Use age-appropriate language for {grade_level}
- Keep responses brief and conversational
- Make learning fun and engaging"""

        # Build instruction based on problem type
        question_text = problem_data.get('question', problem_data.get('question_text', ''))

        instruction_map = {
            "multiple_choice": f"Let's work on this multiple choice question together! {question_text}",
            "true_false": f"Think carefully about whether this is true or false: {question_text}",
            "fill_in_blanks": f"Let's fill in the blanks together! {question_text}",
            "matching_activity": "Let's match these items together!",
            "sequencing_activity": "Let's put these in the right order!",
            "categorization_activity": "Let's sort these items into the correct categories!"
        }

        instruction = instruction_map.get(problem_type, f"Let's work on this together! {question_text}")

        # Extract targets from problem structure
        targets = self.extract_targets_from_problem(problem_type, problem_data)

        # Generate feedback messages
        feedback = self.generate_feedback_messages(problem_type, topic_context)

        # Build complete config
        live_interaction_config = {
            "prompt": {
                "system": system_prompt,
                "instruction": instruction,
                "voice": "Leda"  # Default voice for AI coach
            },
            "targets": targets,
            "evaluation": {
                "mode": "real_time",
                "feedback": feedback
            }
        }

        logger.info(f"Generated AI coach config for {problem_type} with {len(targets)} targets")
        return live_interaction_config