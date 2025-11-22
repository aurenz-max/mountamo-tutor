# THREE-PHASE Problem Generation - Implementation Handoff

## Overview

This document provides detailed specifications for implementing the THREE-PHASE problem generation architecture in the curriculum authoring service. This upgrade brings the authoring service to production-level quality matching the main backend system.

**Target File**: `curriculum-authoring-service/app/services/problem_generator_service.py`

**Status**: Database migrations complete, schemas ready, implementation needed

---

## Architecture Summary

### Current State (Single-Phase)
```
generate_problems() → _generate_batch() → Store in BigQuery
```

### Target State (Three-Phase)
```
generate_problems()
  ├─ PHASE 1: _select_problem_types() [AI-driven type selection]
  │   └─ Returns: [{type, count, enable_ai_coach, reasoning}]
  │
  ├─ PHASE 2: _generate_single_type() [Per-type generation]
  │   ├─ _sample_context_primitives() [Variety enforcement]
  │   ├─ Model selection (Flash vs Flash Lite)
  │   ├─ Type-specific prompt + schema
  │   └─ Returns: Problems with visual_intent fields
  │
  └─ PHASE 3: _orchestrate_visual_generation() [Batch visual generation]
      ├─ _build_batch_visual_schema()
      ├─ _generate_batch_visuals()
      └─ _inject_visuals_into_problem()
```

---

## Prerequisites Complete ✅

### 1. Database Schema
- **Tables Created**:
  - `curriculum_problems` - Enhanced with new columns (visual_data, live_interaction_config, rationale, teaching_note, success_criteria)
  - `problem_generation_phases` - Tracks each phase execution
  - `prompt_performance_metrics` - Tracks prompt effectiveness

- **SQL Scripts**: See `docs/bigquery_rebuild_curriculum_problems.sql` and `docs/bigquery_create_new_tables.sql`

### 2. Python Schemas
- **Location**: `app/models/`
  - `visual_schemas.py` - Visual intent and visual data schemas (20+ visual types)
  - `problem_schemas.py` - All 9 problem type schemas + PROBLEM_TYPE_METADATA
  - `problems.py` - Pydantic models (already exists)

### 3. Dependencies
- `google.genai` - Already installed
- `app.services.foundations_service` - Already available
- `app.services.curriculum_manager` - Already available
- `app.services.prompt_manager_service` - Already available

---

## Implementation Tasks

## TASK 1: Implement Phase 1 - Type Selection

### Location
`curriculum-authoring-service/app/services/problem_generator_service.py`

### Method Signature
```python
async def _select_problem_types(
    self,
    subskill: Any,
    subject: Any,
    foundations: Any,
    recommendations: List[Dict[str, Any]],
    total_count: int = 5
) -> List[Dict[str, Any]]:
    """
    Phase 1: Use Gemini to intelligently select problem types.

    Args:
        subskill: Subskill object with description
        subject: Subject object with grade_level
        foundations: Foundations object with master_context
        recommendations: Learning objectives and misconceptions
        total_count: Total number of problems to generate

    Returns:
        List of type selections:
        [{
            "type": "multiple_choice",
            "count": 2,
            "reasoning": "Best for comprehension testing",
            "enable_ai_coach": true,
            "ai_coach_rationale": "K-2 students benefit from verbal guidance"
        }]
    """
```

### Implementation Steps

#### 1.1 Import Required Schema
```python
from app.models.problem_schemas import (
    TYPE_SELECTION_SCHEMA,
    ALL_PROBLEM_TYPES,
    PROBLEM_TYPE_METADATA
)
```

#### 1.2 Get or Build Prompt Template
```python
# Try to get active template
template = await prompt_manager_service.get_active_template(
    template_name="type_selection_v1",
    template_type="type_selection"
)

if template:
    # Render with variables
    variables = {
        "subject": subject.subject_name,
        "grade_level": subject.grade_level,
        "subskill_description": subskill.subskill_description,
        "core_concepts": ", ".join(foundations.master_context.core_concepts),
        "learning_objectives": json.dumps(recommendations, indent=2),
        "total_count": str(total_count),
        "available_types": ", ".join(ALL_PROBLEM_TYPES)
    }
    prompt = prompt_manager_service.render_template(template, variables)
else:
    # Fallback to inline prompt (see Production Prompt below)
    prompt = self._build_type_selection_prompt(...)
```

#### 1.3 Production Prompt Template (Fallback)
```python
def _build_type_selection_prompt(
    self,
    subskill: Any,
    subject: Any,
    foundations: Any,
    recommendations: List[Dict[str, Any]],
    total_count: int
) -> str:
    """Build type selection prompt when no template available"""

    objectives_text = "\n".join([
        f"- {rec.get('objective', '')}" +
        (f"\n  🎯 Misconception: {rec.get('misconception_to_address')}"
         if rec.get('misconception_to_address') else "")
        for rec in recommendations
    ])

    return f"""You are an expert educational content designer for {subject.grade_level} {subject.subject_name}.

Your task: Select the optimal mix of problem types to generate {total_count} practice problems.

**Learning Context:**
Subskill: {subskill.subskill_description}

Core Concepts:
{chr(10).join(f"- {c}" for c in foundations.master_context.core_concepts)}

Learning Objectives:
{objectives_text}

**Available Problem Types:**
{chr(10).join(f"- {ptype}: {PROBLEM_TYPE_METADATA[ptype]['best_for']}" for ptype in ALL_PROBLEM_TYPES)}

**Selection Guidelines:**
1. Choose 1-3 different problem types that best assess the learning objectives
2. Distribute the {total_count} problems across selected types
3. Consider variety: mix interactive types (live_interaction, matching) with traditional types (multiple_choice)
4. For each type, decide whether to enable AI coach based on:
   - Grade level (K-2 → STRONGLY FAVOR AI coach)
   - Content type (phonics/reading/ABC → STRONGLY FAVOR AI coach)
   - Problem complexity (simpler → benefits more from AI guidance)
   - Skill type (concepts needing verbal explanation → benefits from AI coach)

**Output Requirements:**
- Return 1-3 problem types with counts that sum to {total_count}
- Each type includes: type name, count, reasoning, enable_ai_coach (boolean), ai_coach_rationale
- Provide overall_reasoning for the pedagogical strategy"""
```

#### 1.4 Call Gemini with Schema
```python
from google.genai.types import GenerateContentConfig

config = GenerateContentConfig(
    temperature=0.3,  # Lower temp for consistent type selection
    response_mime_type="application/json",
    response_schema=TYPE_SELECTION_SCHEMA
)

start_time = time.time()
response = self.client.models.generate_content(
    model="gemini-flash-lite-latest",  # Fast model for type selection
    contents=prompt,
    config=config
)

result = json.loads(response.text)
selections = result.get("selected_types", [])
```

#### 1.5 Store Phase Data
```python
phase_id = str(uuid4())
await self._store_phase_data(
    phase_id=phase_id,
    subskill_id=subskill.subskill_id,
    phase_type="type_selection",
    phase_number=1,
    prompt_template_id=template.template_id if template else None,
    prompt_version=template.version if template else None,
    rendered_prompt=prompt,
    model_used="gemini-flash-lite-latest",
    response_raw=response.text,
    response_parsed=result,
    learning_objectives=recommendations,
    execution_time_ms=int((time.time() - start_time) * 1000)
)
```

#### 1.6 Return Selections
```python
logger.info(f"✅ Selected {len(selections)} problem types: {[s['type'] for s in selections]}")
return selections
```

---

## TASK 2: Implement Context Primitives Sampling

### Location
Same file: `problem_generator_service.py`

### Method Signature
```python
async def _sample_context_primitives(
    self,
    foundations: Any,
    num_problems: int
) -> Dict[str, List[Any]]:
    """
    Sample varied context primitives for problem generation.

    Args:
        foundations: Foundations object with context primitives
        num_problems: Number of problems being generated

    Returns:
        {
            'objects': [sampled concrete objects],
            'characters': [sampled characters],
            'scenarios': [sampled scenarios],
            'locations': [sampled locations]
        }
    """
```

### Implementation Steps

#### 2.1 Import and Sample
```python
import random

async def _sample_context_primitives(
    self,
    foundations: Any,
    num_problems: int
) -> Dict[str, List[Any]]:
    """Sample varied primitives for problem generation"""

    # Get primitives from foundations
    primitives = {
        'concrete_objects': getattr(foundations, 'concrete_objects', []),
        'characters': getattr(foundations, 'characters', []),
        'scenarios': getattr(foundations, 'scenarios', []),
        'locations': getattr(foundations, 'locations', [])
    }

    # Sample strategy: Take enough to ensure variety
    # Use 2x num_problems to ensure no repetition
    sample_size = min(num_problems * 2, 10)  # Cap at 10 for prompt size

    sampled = {
        'objects': random.sample(
            primitives['concrete_objects'],
            min(sample_size, len(primitives['concrete_objects']))
        ) if primitives['concrete_objects'] else [],

        'characters': random.sample(
            primitives['characters'],
            min(max(5, sample_size // 2), len(primitives['characters']))
        ) if primitives['characters'] else [],

        'scenarios': random.sample(
            primitives['scenarios'],
            min(max(8, sample_size), len(primitives['scenarios']))
        ) if primitives['scenarios'] else [],

        'locations': random.sample(
            primitives['locations'],
            min(5, len(primitives['locations']))
        ) if primitives['locations'] else []
    }

    logger.info(f"📦 Sampled primitives: {len(sampled['objects'])} objects, "
                f"{len(sampled['characters'])} characters, "
                f"{len(sampled['scenarios'])} scenarios")

    return sampled
```

#### 2.2 Format for Prompt Injection
```python
def _format_primitives_for_prompt(self, sampled: Dict[str, List[Any]]) -> str:
    """Format sampled primitives for prompt injection"""

    sections = []

    if sampled.get('objects'):
        objects_list = ", ".join([obj.get('name', obj) if isinstance(obj, dict) else str(obj)
                                  for obj in sampled['objects']])
        sections.append(f"✓ Objects: {objects_list}")

    if sampled.get('characters'):
        chars_list = ", ".join([char.get('name', char) if isinstance(char, dict) else str(char)
                               for char in sampled['characters']])
        sections.append(f"✓ Characters: {chars_list}")

    if sampled.get('scenarios'):
        scenarios_list = ", ".join([sc.get('description', sc) if isinstance(sc, dict) else str(sc)
                                   for sc in sampled['scenarios']])
        sections.append(f"✓ Scenarios: {scenarios_list}")

    if sampled.get('locations'):
        locs_list = ", ".join([loc.get('name', loc) if isinstance(loc, dict) else str(loc)
                              for loc in sampled['locations']])
        sections.append(f"✓ Locations: {locs_list}")

    return "\n".join(sections)
```

---

## TASK 3: Implement Phase 2 - Per-Type Generation

### Location
Same file: `problem_generator_service.py`

### Method Signature
```python
async def _generate_single_type(
    self,
    problem_type: str,
    count: int,
    enable_ai_coach: bool,
    subskill: Any,
    subject: Any,
    foundations: Any,
    recommendations: List[Dict[str, Any]],
    type_selection_phase_id: str
) -> List[Dict[str, Any]]:
    """
    Phase 2: Generate problems for a single type.

    Args:
        problem_type: Type to generate (e.g., "multiple_choice")
        count: Number of problems to generate
        enable_ai_coach: Whether to add AI coach config
        subskill: Subskill object
        subject: Subject object
        foundations: Foundations with context primitives
        recommendations: Learning objectives with misconceptions
        type_selection_phase_id: Phase ID from type selection

    Returns:
        List of generated problems with visual_intent fields
    """
```

### Implementation Steps

#### 3.1 Get Metadata and Schema
```python
from app.models.problem_schemas import PROBLEM_TYPE_METADATA

async def _generate_single_type(
    self,
    problem_type: str,
    count: int,
    enable_ai_coach: bool,
    subskill: Any,
    subject: Any,
    foundations: Any,
    recommendations: List[Dict[str, Any]],
    type_selection_phase_id: str
) -> List[Dict[str, Any]]:
    """Phase 2: Generate problems for a single type"""

    logger.info(f"🎯 Generating {count} {problem_type} problems...")

    # Get metadata for this type
    metadata = PROBLEM_TYPE_METADATA.get(problem_type)
    if not metadata:
        raise ValueError(f"Unknown problem type: {problem_type}")

    schema = metadata['schema']
    model = metadata['model']  # 'gemini-flash-latest' or 'gemini-flash-lite-latest'
    complexity = metadata['complexity']

    logger.info(f"📊 Using {model} (complexity: {complexity})")
```

#### 3.2 Sample Context Primitives
```python
    # Sample context primitives for variety
    sampled_primitives = await self._sample_context_primitives(foundations, count)
    primitives_text = self._format_primitives_for_prompt(sampled_primitives)
```

#### 3.3 Build Generation Prompt
```python
    # Try to get type-specific template
    template = await prompt_manager_service.get_active_template(
        template_name=f"generation_{problem_type}_v1",
        template_type="problem_generation"
    )

    if template:
        variables = {
            "num_problems": str(count),
            "problem_type": problem_type,
            "subject": subject.subject_name,
            "grade_level": subject.grade_level,
            "subskill_description": subskill.subskill_description,
            "context_primitives": primitives_text,
            "learning_objectives": self._format_objectives_for_prompt(recommendations),
            "visual_guidance": self._get_visual_guidance_for_type(problem_type)
        }
        prompt = prompt_manager_service.render_template(template, variables)
    else:
        # Fallback to inline prompt
        prompt = self._build_generation_prompt(
            problem_type, count, subskill, subject,
            foundations, recommendations, sampled_primitives
        )
```

#### 3.4 Production Prompt Template (Fallback)
```python
def _build_generation_prompt(
    self,
    problem_type: str,
    count: int,
    subskill: Any,
    subject: Any,
    foundations: Any,
    recommendations: List[Dict[str, Any]],
    sampled_primitives: Dict[str, List[Any]]
) -> str:
    """Build generation prompt for a specific problem type"""

    primitives_text = self._format_primitives_for_prompt(sampled_primitives)

    # Build objectives with misconceptions highlighted
    objectives_sections = []
    for i, rec in enumerate(recommendations[:count], 1):
        obj_text = f"""Problem {i}:
- Skill: {rec.get('skill_description', subskill.subskill_description)}
- Objective: {rec.get('objective', 'Master the concept')}
- Difficulty: {rec.get('difficulty', 'medium')}/10"""

        if rec.get('misconception_to_address'):
            obj_text += f"""
🎯 CRITICAL: This problem must address the misconception: "{rec['misconception_to_address']}"
- Design the problem to directly challenge this misunderstanding
- Include clear rationale explaining why the misconception is wrong"""

        objectives_sections.append(obj_text)

    objectives_text = "\n\n".join(objectives_sections)

    # Get visual guidance for this type
    visual_guidance = self._get_visual_guidance_for_type(problem_type)

    return f"""Generate {count} {problem_type} problems for {subject.grade_level} students (ages 5-6) in {subject.subject_name}.

**Subskill**: {subskill.subskill_description}

**CONTEXT PRIMITIVES FOR VARIETY:**
{primitives_text}

**VARIETY INSTRUCTIONS:**
- Use DIFFERENT combinations from context primitives above
- Never reuse the same object-character-scenario combination
- Ensure each problem feels fresh and engaging

**Learning Objectives:**
{objectives_text}

{visual_guidance}

**CRITICAL REQUIREMENTS:**
- Unique id for each problem (e.g., "mc_001", "tf_001")
- Grade level as "{subject.grade_level}"
- Difficulty as "easy", "medium", or "hard"
- Comprehensive rationale explaining why this tests the skill
- Teaching note with guidance for educators
- Success criteria describing what completion looks like
- Simple language appropriate for ages 5-6
- question_visual_intent (or equivalent field) with needs_visual, visual_type, visual_purpose, visual_id

**VISUAL INTENT RULES:**
- For counting/showing objects → use "object-collection" or "comparison-panel"
- For abstract comparisons → use "bar-model"
- For interactive clicks → use "card-grid"
- visual_purpose should be scene-setting, NOT directive
- GOOD: "Show 5 red apples and 3 green apples"
- BAD: "Display the following:", "Click here"
"""
```

#### 3.5 Visual Guidance Helper
```python
def _get_visual_guidance_for_type(self, problem_type: str) -> str:
    """Get type-specific visual generation instructions"""

    guidance = {
        "multiple_choice": """**VISUAL GUIDANCE FOR MULTIPLE CHOICE:**
- question_visual_intent: Visual for the question (if needed)
- Visual types: object-collection, comparison-panel, bar-model, character-scene
- Example: For "How many apples?", use object-collection showing apples""",

        "true_false": """**VISUAL GUIDANCE FOR TRUE/FALSE:**
- statement_visual_intent: Visual showing the statement to evaluate
- Visual types: object-collection, comparison-panel, character-scene
- Example: For "There are 5 apples", show object-collection with apples""",

        "live_interaction": """**VISUAL GUIDANCE FOR LIVE INTERACTION:**
- visual_intent.display_visual_intent: Informational content (optional)
- interaction_config.interaction_visual_intent: Clickable interface (REQUIRED for click mode)
- For click mode: MUST use visual_type="card-grid"
- Card IDs in card-grid MUST match interaction_config.targets IDs exactly
- Example: cards with IDs "card_yes", "card_no" match targets with same IDs""",

        # Add other types as needed
    }

    return guidance.get(problem_type, """**VISUAL GUIDANCE:**
- Include appropriate visual_intent fields where visuals would enhance learning
- Choose visual types that match kindergarten comprehension level""")
```

#### 3.6 Call Gemini with Type-Specific Model
```python
    from google.genai.types import GenerateContentConfig

    config = GenerateContentConfig(
        temperature=0.7,
        response_mime_type="application/json",
        response_schema=schema
    )

    start_time = time.time()
    response = self.client.models.generate_content(
        model=model,  # Use type-specific model from metadata
        contents=prompt,
        config=config
    )

    result = json.loads(response.text)
    problems = result.get("problems", [])

    logger.info(f"✅ Generated {len(problems)} {problem_type} problems")
```

#### 3.7 Post-Process: Add AI Coach Config (if enabled)
```python
    # Add AI coach configuration if enabled
    if enable_ai_coach:
        logger.info(f"🤖 Adding AI coach config to {problem_type} problems...")
        for problem in problems:
            # This will be implemented in a future task
            # For now, placeholder:
            problem['live_interaction_config'] = {
                "prompt": {
                    "system": f"You are a patient, encouraging AI tutor for {subject.grade_level} students.",
                    "instruction": problem.get('question', problem.get('statement', '')),
                    "voice": "Leda"
                },
                "evaluation": {
                    "mode": "real_time",
                    "feedback": {
                        "correct": {
                            "audio": "Amazing job! You got it right! 🎉",
                            "visual_effect": "celebrate"
                        },
                        "incorrect": {
                            "audio": "Not quite, but that's okay! Let's try again. 💪",
                            "visual_effect": "shake",
                            "hint": "Think carefully about the question."
                        }
                    }
                }
            }
```

#### 3.8 Store Phase Data
```python
    phase_id = str(uuid4())
    await self._store_phase_data(
        phase_id=phase_id,
        subskill_id=subskill.subskill_id,
        phase_type="generation",
        phase_number=2,
        problem_type=problem_type,
        prompt_template_id=template.template_id if template else None,
        prompt_version=template.version if template else None,
        rendered_prompt=prompt,
        model_used=model,
        response_raw=response.text,
        response_parsed=result,
        context_primitives=sampled_primitives,
        learning_objectives=recommendations,
        execution_time_ms=int((time.time() - start_time) * 1000),
        metadata={
            "type_selection_phase_id": type_selection_phase_id,
            "enable_ai_coach": enable_ai_coach,
            "complexity": complexity
        }
    )
```

#### 3.9 Return Problems with Metadata
```python
    # Add generation metadata to each problem
    for problem in problems:
        problem['_generation_metadata'] = {
            'phase_id': phase_id,
            'model_used': model,
            'complexity': complexity,
            'sampled_primitives': sampled_primitives
        }

    return problems
```

---

## TASK 4: Implement Phase Data Storage Helper

### Method Signature
```python
async def _store_phase_data(
    self,
    phase_id: str,
    subskill_id: str,
    phase_type: str,
    phase_number: int,
    model_used: str,
    rendered_prompt: str,
    response_raw: str,
    response_parsed: Dict[str, Any],
    execution_time_ms: int,
    problem_id: Optional[str] = None,
    problem_type: Optional[str] = None,
    prompt_template_id: Optional[str] = None,
    prompt_version: Optional[int] = None,
    context_primitives: Optional[Dict[str, List[Any]]] = None,
    learning_objectives: Optional[List[Dict[str, Any]]] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """Store phase execution data in problem_generation_phases table"""
```

### Implementation
```python
async def _store_phase_data(
    self,
    phase_id: str,
    subskill_id: str,
    phase_type: str,
    phase_number: int,
    model_used: str,
    rendered_prompt: str,
    response_raw: str,
    response_parsed: Dict[str, Any],
    execution_time_ms: int,
    problem_id: Optional[str] = None,
    problem_type: Optional[str] = None,
    prompt_template_id: Optional[str] = None,
    prompt_version: Optional[int] = None,
    context_primitives: Optional[Dict[str, List[Any]]] = None,
    learning_objectives: Optional[List[Dict[str, Any]]] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """Store phase execution data"""

    now = datetime.utcnow()

    row = {
        "phase_id": phase_id,
        "problem_id": problem_id,
        "subskill_id": subskill_id,
        "phase_type": phase_type,
        "phase_number": phase_number,
        "problem_type": problem_type,
        "prompt_template_id": prompt_template_id,
        "prompt_version": prompt_version,
        "rendered_prompt": rendered_prompt,
        "model_used": model_used,
        "temperature": 0.7,  # Or pass as parameter
        "response_raw": response_raw,
        "response_parsed": json.dumps(response_parsed),
        "context_primitives": json.dumps(context_primitives) if context_primitives else None,
        "learning_objectives": json.dumps(learning_objectives) if learning_objectives else None,
        "metadata": json.dumps(metadata) if metadata else None,
        "created_at": now.isoformat(),
        "execution_time_ms": execution_time_ms,
        "success": True
    }

    success = await db.insert_rows("problem_generation_phases", [row])

    if success:
        logger.debug(f"✅ Stored phase data: {phase_type} - {phase_id}")
    else:
        logger.error(f"❌ Failed to store phase data: {phase_type} - {phase_id}")

    return success
```

---

## TASK 5: Refactor Main generate_problems() Method

### Update the main orchestrator to use THREE-PHASE flow

```python
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
    Generate practice problems using THREE-PHASE architecture.

    PHASE 1: Type Selection (AI-driven)
    PHASE 2: Per-Type Generation (with context primitives)
    PHASE 3: Visual Generation (to be implemented later)
    """
    logger.info(f"🎯 Starting THREE-PHASE generation: {count} problems for {subskill_id}")

    # Get curriculum context
    subskill = await curriculum_manager.get_subskill(subskill_id)
    if not subskill:
        raise ValueError(f"Subskill {subskill_id} not found")

    skill = await curriculum_manager.get_skill(subskill.skill_id)
    unit = await curriculum_manager.get_unit(skill.unit_id) if skill else None
    subject = await curriculum_manager.get_subject(unit.subject_id) if unit else None

    # Get foundations for context primitives
    foundations = await foundations_service.get_foundations(subskill_id, version_id)
    if not foundations:
        logger.info("No foundations found, generating new ones...")
        foundations = await foundations_service.generate_foundations(subskill_id, version_id)

    # Build learning objectives (mock for now - replace with actual)
    recommendations = [
        {
            "objective": f"Master {subskill.subskill_description}",
            "difficulty": 5,
            "skill_description": subskill.subskill_description,
            "misconception_to_address": None  # Would come from curriculum data
        }
        for _ in range(count)
    ]

    # ============================================================================
    # PHASE 1: Type Selection
    # ============================================================================
    if problem_types:
        # Manual type specification (backward compatibility)
        type_selections = [
            {
                "type": ptype,
                "count": count // len(problem_types),
                "reasoning": "Manually specified",
                "enable_ai_coach": False,
                "ai_coach_rationale": "Not using AI selection"
            }
            for ptype in problem_types
        ]
        type_selection_phase_id = None
    else:
        # AI-driven type selection
        type_selections = await self._select_problem_types(
            subskill=subskill,
            subject=subject,
            foundations=foundations,
            recommendations=recommendations,
            total_count=count
        )
        # Get phase_id from the last stored phase (would be returned from _select_problem_types)
        type_selection_phase_id = "phase_1_id"  # TODO: Return from _select_problem_types

    # ============================================================================
    # PHASE 2: Per-Type Generation
    # ============================================================================
    all_generated_problems = []

    for selection in type_selections:
        problem_type = selection['type']
        type_count = selection['count']
        enable_ai_coach = selection.get('enable_ai_coach', False)

        if type_count == 0:
            continue

        # Generate this type
        problems = await self._generate_single_type(
            problem_type=problem_type,
            count=type_count,
            enable_ai_coach=enable_ai_coach,
            subskill=subskill,
            subject=subject,
            foundations=foundations,
            recommendations=recommendations[:type_count],
            type_selection_phase_id=type_selection_phase_id
        )

        all_generated_problems.extend(problems)

    # ============================================================================
    # PHASE 3: Visual Generation (TODO - future task)
    # ============================================================================
    # problems_with_visuals = await self._orchestrate_visual_generation(all_generated_problems)
    problems_with_visuals = all_generated_problems  # Skip for now

    # ============================================================================
    # Store Problems in BigQuery
    # ============================================================================
    stored_problems = []
    start_time = time.time()

    for problem_data in problems_with_visuals:
        # Extract metadata
        gen_metadata = problem_data.pop('_generation_metadata', {})

        problem_db = await self._store_problem(
            subskill_id=subskill_id,
            version_id=version_id,
            problem_type=problem_data.get('problem_type', 'multiple_choice'),
            problem_data=problem_data,
            generation_prompt="THREE-PHASE generation",  # Simplified
            temperature=temperature,
            user_id=user_id,
            generation_duration_ms=int((time.time() - start_time) * 1000),
            generation_metadata=gen_metadata
        )
        stored_problems.append(problem_db)

    logger.info(f"✅ THREE-PHASE generation complete: {len(stored_problems)} problems")

    # Trigger evaluation if requested
    if auto_evaluate:
        logger.info("🔍 Auto-evaluation enabled, triggering evaluation...")
        from app.services.problem_evaluation_service import problem_evaluation_service

        for problem in stored_problems:
            try:
                await problem_evaluation_service.evaluate_problem(problem.problem_id)
            except Exception as e:
                logger.error(f"Evaluation failed for {problem.problem_id}: {e}")

    return stored_problems
```

---

## Testing Checklist

### Unit Tests
- [ ] `_select_problem_types()` returns valid type selections
- [ ] Type selections sum to total_count
- [ ] `_sample_context_primitives()` returns diverse samples
- [ ] `_generate_single_type()` uses correct model based on complexity
- [ ] Generated problems include visual_intent fields
- [ ] AI coach config added when enable_ai_coach=True
- [ ] Phase data stored correctly in BigQuery

### Integration Tests
- [ ] Full THREE-PHASE flow generates problems successfully
- [ ] Problems stored with correct schema in curriculum_problems
- [ ] Phase data tracked in problem_generation_phases table
- [ ] Backward compatibility: manual type specification still works
- [ ] Context primitives prevent repetition across problems

### Manual Testing Script
```python
# Test script for THREE-PHASE generation
import asyncio
from app.services.problem_generator_service import problem_generator_service

async def test_generation():
    problems = await problem_generator_service.generate_problems(
        subskill_id="test_subskill_id",
        version_id="v1",
        count=5,
        problem_types=None,  # Let AI select types
        auto_evaluate=False
    )

    print(f"Generated {len(problems)} problems")
    for p in problems:
        print(f"- {p.problem_type}: {p.problem_id}")
        # Check for new fields
        assert p.problem_json.get('rationale'), "Missing rationale"
        assert p.problem_json.get('teaching_note'), "Missing teaching_note"
        assert p.problem_json.get('success_criteria'), "Missing success_criteria"

        # Check for visual intents
        visual_field = p.problem_json.get('question_visual_intent') or \
                      p.problem_json.get('statement_visual_intent') or \
                      p.problem_json.get('visual_intent')
        assert visual_field, "Missing visual_intent"

asyncio.run(test_generation())
```

---

## Known Issues & Future Work

### Current Limitations
1. **AI Coach Config**: Basic implementation, needs refinement for production
2. **Visual Generation** (Phase 3): Not yet implemented - problems have visual_intent but not visual_data
3. **Prompt Templates**: Using fallback prompts; need to create initial templates in BigQuery
4. **Error Handling**: Needs retry logic for LLM failures
5. **Cost Optimization**: Monitor token usage across phases

### Future Enhancements
1. Implement Phase 3: Visual generation pipeline
2. Add comprehensive AI coach auto-configuration
3. Create initial prompt templates in BigQuery (see TASK 6 below)
4. Add prompt performance tracking integration
5. Implement parallel generation for Phase 2 (production mode)

---

## TASK 6: Create Initial Prompt Templates (Optional)

### SQL Script to Insert Base Templates

```sql
-- Insert type selection template
INSERT INTO `mountamo-tutor-h7wnta.analytics.prompt_templates`
(template_id, template_name, template_type, template_text, template_variables, version, is_active, phase_type, model_recommendation, complexity_level, created_at, updated_at)
VALUES
(
  GENERATE_UUID(),
  'type_selection_v1',
  'type_selection',
  'You are an expert educational content designer for {{grade_level}} {{subject}}...',  -- Full prompt here
  ['subject', 'grade_level', 'subskill_description', 'core_concepts', 'learning_objectives', 'total_count', 'available_types'],
  1,
  true,
  'type_selection',
  'gemini-flash-lite-latest',
  'simple',
  CURRENT_TIMESTAMP(),
  CURRENT_TIMESTAMP()
);

-- Add templates for each problem type
-- generation_multiple_choice_v1, generation_true_false_v1, etc.
```

---

## Questions & Support

### Contact Points
- **Technical Lead**: [Your name]
- **Database/BigQuery**: [DBA name]
- **Code Review**: [Reviewer name]

### Reference Documentation
- **Production Backend**: `backend/app/services/problems.py` (line 906)
- **Schemas**: `curriculum-authoring-service/app/models/problem_schemas.py`
- **SQL Migrations**: `curriculum-authoring-service/docs/bigquery_*.sql`

### Common Questions

**Q: Why use different models (Flash vs Flash Lite)?**
A: Cost optimization. Simple problem types (true/false, sequencing) can use the faster, cheaper Flash Lite model without quality loss. Complex types (multiple choice, live interaction) need the full Flash model for proper pedagogical design.

**Q: What are context primitives?**
A: Reusable content elements (objects, characters, scenarios) that ensure variety across problems. Sampling prevents "5 problems about apples" syndrome.

**Q: Why store each phase separately?**
A: Enables iteration. If type selection works but generation fails, you can analyze/improve just that phase. Also enables A/B testing of prompts per phase.

**Q: What about backward compatibility?**
A: The refactored `generate_problems()` supports manual type specification via `problem_types` parameter for backward compatibility.

---

## Timeline Estimate

- **TASK 1** (Type Selection): 4-6 hours
- **TASK 2** (Context Primitives): 2-3 hours
- **TASK 3** (Per-Type Generation): 6-8 hours
- **TASK 4** (Phase Storage): 2-3 hours
- **TASK 5** (Main Refactor): 3-4 hours
- **Testing & Bug Fixes**: 4-6 hours

**Total**: ~21-30 hours (3-4 days)

---

## Success Criteria

✅ All 5 tasks implemented and passing tests
✅ Problems generated with complete schemas (rationale, teaching_note, success_criteria)
✅ Visual intents present in generated problems
✅ Phase data tracked in problem_generation_phases table
✅ Model selection working (Flash vs Flash Lite)
✅ Context primitives sampling prevents repetition
✅ Backward compatibility maintained
✅ No regressions in existing functionality

---

**Ready to implement! 🚀**
