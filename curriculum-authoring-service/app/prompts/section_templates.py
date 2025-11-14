"""
Section-specific prompt templates for educational content generation.

Each section type has a detailed prompt template based on pedagogical best practices.
Templates guide the LLM to produce high-quality, focused content with appropriate
visual primitives and word counts.
"""

from app.models.section_types import SectionType
from typing import Dict


def get_introduction_motivation_prompt(
    primary_objective: str,
    key_concepts: list,
    key_terminology: dict,
    grade_level: str,
    subject: str = None,
    unit: str = None,
    skill: str = None,
    subskill_description: str = None,
    context_primitives: dict = None,
    prior_sections_summary: str = None,
    related_concepts: list = None,
    future_topics: list = None
) -> str:
    """Generate prompt for Introduction/Motivation section."""

    context_str = f"Subject: {subject}, Unit: {unit}, Skill: {skill}" if subject else ""

    return f"""Create an Introduction/Motivation section for the following learning objective at {grade_level} level.

{context_str}
Subskill: {subskill_description}

PRIMARY OBJECTIVE: {primary_objective}

KEY CONCEPTS TO INTRODUCE: {', '.join(key_concepts)}

REQUIREMENTS:
- Start with a concrete scenario or question where this concept matters in real life
- Connect to concepts the learner already knows (build from familiar to new)
- State the learning goal in simple, outcome-focused language
- NO formal definitions yet - focus on building motivation and context
- Create curiosity or a "need to know" feeling
- Length: 150-250 words (2-3 paragraphs maximum)

STRUCTURE:
1. [Concrete hook - 1-2 sentences establishing relevance and capturing interest]
2. [Bridge from known to new - 1-2 sentences connecting to prior knowledge]
3. [Learning goal stated plainly - 1 sentence outlining what they'll learn]
4. [What we'll explore - 1-2 sentences outlining the journey ahead]

TONE: Conversational, energizing, connects to real experience

VISUAL PRIMITIVE MARKERS:
Use markers like [VISUAL: contextual-image] or [VISUAL: scenario] to indicate where visuals would enhance understanding.
Only include visual markers where they genuinely add value.

OUTPUT: Generate the section content following these guidelines. Focus on hooking the learner and building motivation."""


def get_intuitive_explanation_prompt(
    primary_objective: str,
    key_concepts: list,
    key_terminology: dict,
    grade_level: str,
    subject: str = None,
    unit: str = None,
    skill: str = None,
    subskill_description: str = None,
    context_primitives: dict = None,
    prior_sections_summary: str = None,
    related_concepts: list = None,
    future_topics: list = None
) -> str:
    """Generate prompt for Intuitive Explanation section."""

    context_str = f"Subject: {subject}, Unit: {unit}, Skill: {skill}" if subject else ""
    prior_context = f"\n\nPRIOR SECTIONS CONTEXT:\n{prior_sections_summary}" if prior_sections_summary else ""

    primitives_str = ""
    if context_primitives:
        primitives_str = "\n\nAVAILABLE CONTEXT PRIMITIVES (use these for concrete examples):\n"
        for category, items in context_primitives.items():
            if items:
                primitives_str += f"- {category}: {', '.join(str(item) for item in items[:5])}\n"

    return f"""Create an Intuitive Explanation section for the following learning objective at {grade_level} level.

{context_str}
Subskill: {subskill_description}
{prior_context}

PRIMARY OBJECTIVE: {primary_objective}

KEY CONCEPTS: {', '.join(key_concepts)}
{primitives_str}

REQUIREMENTS:
- Explain the core idea using EVERYDAY LANGUAGE and familiar analogies
- Provide at least 2 different ways to think about this concept (multiple mental models)
- Use concrete examples from real life - NOT textbook problems yet
- Address: "Why does this concept exist? What problem does it solve?"
- Avoid formal mathematical notation - build conceptual understanding first
- Build intuition that will make the formal definition feel inevitable later
- Length: 300-500 words (3-5 paragraphs)

STRUCTURE:
1. [Core idea stated simply - 2-3 sentences in plain language]
2. [First mental model / analogy - 1 paragraph with concrete example]
   [VISUAL: analogy-diagram] - specify what analogy to visualize
3. [Second mental model / different perspective - 1 paragraph showing another way to think about it]
4. [Connecting the models - 1 paragraph showing these are the same underlying idea]
   [VISUAL: concept-comparison] - show equivalence between perspectives
5. [Why this matters - 1 paragraph on what this concept lets us do]

QUALITY CRITERIA:
- Use concrete nouns and active verbs
- Analogies must be genuinely illuminating, not decorative
- Should be understandable to someone one skill-level below target
- Focus on "what" and "why", not "how to calculate"

TONE: Everyday language, concrete examples, builds mental models naturally

VISUAL PRIMITIVE MARKERS:
- [VISUAL: analogy-diagram] for visualizing analogies
- [VISUAL: concept-comparison] for comparing interpretations
- [VISUAL: concept-map] for showing relationships
Only mark visuals where they genuinely clarify the concept.

OUTPUT: Generate the intuitive explanation following these guidelines."""


def get_formal_definition_prompt(
    primary_objective: str,
    key_concepts: list,
    key_terminology: dict,
    grade_level: str,
    subject: str = None,
    unit: str = None,
    skill: str = None,
    subskill_description: str = None,
    context_primitives: dict = None,
    prior_sections_summary: str = None,
    related_concepts: list = None,
    future_topics: list = None
) -> str:
    """Generate prompt for Formal Definition section."""

    context_str = f"Subject: {subject}, Unit: {unit}, Skill: {skill}" if subject else ""
    prior_context = f"\n\nPRIOR SECTIONS CONTEXT (learners already have intuitive understanding):\n{prior_sections_summary}" if prior_sections_summary else ""

    terminology_str = "\n\nKEY TERMINOLOGY TO DEFINE:\n"
    for term, definition in key_terminology.items():
        terminology_str += f"- {term}: {definition}\n"

    return f"""Create a Formal Definition section for the following learning objective at {grade_level} level.

{context_str}
Subskill: {subskill_description}
{prior_context}

PRIMARY OBJECTIVE: {primary_objective}

KEY CONCEPTS: {', '.join(key_concepts)}
{terminology_str}

REQUIREMENTS:
- Provide the PRECISE mathematical or technical definition
- Introduce notation EXPLICITLY and explain what each symbol represents
- Define ALL terms used in the definition before or as you use them
- Specify any conditions, constraints, or domain limitations
- Connect back to intuitive understanding: "This formal definition captures the idea we explored earlier where..."
- This section should serve as a reference students can look up later
- Length: 200-400 words (2-4 paragraphs)

STRUCTURE:
1. [Transition from intuition to formalism - 1-2 sentences acknowledging the intuitive foundation]
2. [Formal definition stated clearly - possibly in display/highlighted format]
3. [Explanation of notation - 1 paragraph explaining what each symbol/term means]
   [VISUAL: formal-notation] - annotated breakdown of complex notation
4. [Explanation of definition components - 1-2 paragraphs walking through each part]
   [VISUAL: definition-diagram] - visual representation of the formal structure
5. [Special cases, constraints, domain notes - 1 paragraph on limitations/boundaries]
6. [Connecting back to intuition - 1-2 sentences bridging formal and intuitive]

QUALITY CRITERIA:
- Unambiguous and complete
- Use standard notation for the field
- Every symbol and term defined before use
- Could serve as a lookup reference

TONE: Precise, formal, clear, connects to earlier intuition

VISUAL PRIMITIVE MARKERS:
- [VISUAL: formal-notation] for annotated notation breakdown
- [VISUAL: definition-diagram] for visualizing formal structure
- [VISUAL: definition-box] for highlighted key definitions
- [VISUAL: venn-diagram] for showing domain/constraints
Only mark where visuals genuinely clarify formal concepts.

OUTPUT: Generate the formal definition section following these guidelines."""


def get_worked_examples_prompt(
    primary_objective: str,
    key_concepts: list,
    key_terminology: dict,
    grade_level: str,
    subject: str = None,
    unit: str = None,
    skill: str = None,
    subskill_description: str = None,
    context_primitives: dict = None,
    prior_sections_summary: str = None,
    related_concepts: list = None,
    future_topics: list = None
) -> str:
    """Generate prompt for Worked Examples section."""

    context_str = f"Subject: {subject}, Unit: {unit}, Skill: {skill}" if subject else ""
    prior_context = f"\n\nPRIOR SECTIONS CONTEXT:\n{prior_sections_summary}" if prior_sections_summary else ""

    primitives_str = ""
    if context_primitives:
        primitives_str = "\n\nAVAILABLE CONTEXT PRIMITIVES (use these for example scenarios):\n"
        for category, items in context_primitives.items():
            if items:
                primitives_str += f"- {category}: {', '.join(str(item) for item in items[:5])}\n"

    return f"""Create a Worked Examples section for the following learning objective at {grade_level} level.

{context_str}
Subskill: {subskill_description}
{prior_context}

PRIMARY OBJECTIVE: {primary_objective}

KEY CONCEPTS: {', '.join(key_concepts)}
{primitives_str}

REQUIREMENTS:
- Provide 2-3 examples that demonstrate the concept in action
- Examples should vary in context and complexity (easy → medium → challenging)
- For EACH example:
  * State the problem clearly
  * Show EVERY step of the solution
  * Explain the REASONING behind each step (not just what to do, but WHY)
  * Provide the final answer with interpretation/sense-check
- Use concrete, relatable contexts from the available primitives
- Progress from simpler to more complex cases
- Length: 400-800 words total

STRUCTURE:
[Introduction - 1 paragraph explaining what these examples will demonstrate]

**Example 1: [Simple, concrete case]**
[Problem statement]
[VISUAL: problem-setup] - diagram showing the problem situation

Step 1: [Action with explanation of WHY]
Step 2: [Action with explanation of WHY]
[VISUAL: step-diagram] - if geometric/visual steps
...
[Final answer with interpretation - does this make sense?]

**Example 2: [More complex or different context]**
[Problem statement]
[Solution with explicit reasoning at each step]
[Final answer with interpretation]

**Example 3: [Challenging case or interesting edge case - if needed]**
[Problem statement]
[Solution with explicit reasoning]
[Final answer with interpretation]

[Synthesis - 1 paragraph: What patterns do learners notice across examples?]

QUALITY CRITERIA:
- Steps granular enough for learners to follow
- Reasoning is explicit: "We do this because..."
- Examples are meaningfully different from each other
- Clear progression from simple to complex

TONE: Clear, step-by-step, explicit reasoning at every stage

VISUAL PRIMITIVE MARKERS:
- [VISUAL: problem-setup] for diagrams showing problem context
- [VISUAL: step-diagram] for key visual/geometric steps
- [VISUAL: solution-path] for overview of solution approach
- [VISUAL: annotated-work] for showing reasoning visually
Only mark visuals that genuinely aid understanding of steps.

OUTPUT: Generate 2-3 worked examples following these guidelines."""


def get_common_errors_prompt(
    primary_objective: str,
    key_concepts: list,
    key_terminology: dict,
    grade_level: str,
    subject: str = None,
    unit: str = None,
    skill: str = None,
    subskill_description: str = None,
    context_primitives: dict = None,
    prior_sections_summary: str = None,
    related_concepts: list = None,
    future_topics: list = None
) -> str:
    """Generate prompt for Common Errors section."""

    context_str = f"Subject: {subject}, Unit: {unit}, Skill: {skill}" if subject else ""
    prior_context = f"\n\nPRIOR SECTIONS CONTEXT:\n{prior_sections_summary}" if prior_sections_summary else ""

    return f"""Create a Common Errors section for the following learning objective at {grade_level} level.

{context_str}
Subskill: {subskill_description}
{prior_context}

PRIMARY OBJECTIVE: {primary_objective}

KEY CONCEPTS: {', '.join(key_concepts)}

REQUIREMENTS:
- Identify 2-4 common mistakes or misconceptions learners have with this concept
- For EACH error:
  * Describe what the mistake looks like with a concrete example
  * Explain WHY learners make this mistake (underlying misconception)
  * Show the CORRECT approach alongside the error
  * Provide a strategy for avoiding this error in the future
- Use empathetic, non-judgmental tone
- Focus on CONCEPTUAL errors, not just arithmetic mistakes
- Length: 300-500 words

STRUCTURE:
[Introduction - 1 paragraph acknowledging mistakes are learning opportunities]

**Common Error 1: [Name the error pattern]**
[Description of the mistake with concrete example]
[Why learners make this mistake - the underlying misconception]
[VISUAL: error-comparison] - side-by-side wrong vs. right approach
[How to avoid this error - checking strategy]

**Common Error 2: [Name the error pattern]**
[Description with example]
[Underlying misconception]
[Correct approach with reasoning]
[How to avoid it]

**Common Error 3: [Name the error pattern]**
[Description with example]
[Underlying misconception]
[VISUAL: misconception-diagram] - visualize the faulty reasoning
[Correct approach]
[How to avoid it]

[Summary - 1 paragraph with watch-out reminders]

QUALITY CRITERIA:
- Empathetic tone: "This is a natural mistake because..."
- Explains faulty reasoning, not just wrong answer
- Clear contrast with correct approach
- Provides actionable strategies to avoid errors

TONE: Empathetic, non-judgmental, clarifying, supportive

VISUAL PRIMITIVE MARKERS:
- [VISUAL: error-comparison] for side-by-side wrong vs. right
- [VISUAL: misconception-diagram] for visualizing faulty reasoning
- [VISUAL: decision-tree] for checking work strategies
- [VISUAL: warning-callout] for key watch-outs
Only mark where visuals genuinely help identify or correct errors.

OUTPUT: Generate the common errors section following these guidelines."""


def get_connections_extensions_prompt(
    primary_objective: str,
    key_concepts: list,
    key_terminology: dict,
    grade_level: str,
    subject: str = None,
    unit: str = None,
    skill: str = None,
    subskill_description: str = None,
    context_primitives: dict = None,
    prior_sections_summary: str = None,
    related_concepts: list = None,
    future_topics: list = None
) -> str:
    """Generate prompt for Connections/Extensions section."""

    context_str = f"Subject: {subject}, Unit: {unit}, Skill: {skill}" if subject else ""

    related_str = ""
    if related_concepts:
        related_str = f"\n\nRELATED CONCEPTS (same level): {', '.join(related_concepts)}"

    future_str = ""
    if future_topics:
        future_str = f"\n\nFUTURE TOPICS (builds toward): {', '.join(future_topics)}"

    return f"""Create a Connections and Extensions section for the following learning objective at {grade_level} level.

{context_str}
Subskill: {subskill_description}

PRIMARY OBJECTIVE: {primary_objective}

KEY CONCEPTS: {', '.join(key_concepts)}
{related_str}
{future_str}

REQUIREMENTS:
- Show how this concept connects to related ideas at the same level
- Preview how this concept will be used in future topics
- Provide 1-2 examples of how this appears in other contexts (other subjects, real-world)
- Make 3-5 SPECIFIC connections (not vague hand-waving)
- Balance between inspiring further exploration and staying focused
- Show both horizontal connections (related concepts) and vertical (future progression)
- Length: 200-400 words

STRUCTURE:
[Opening - 1-2 sentences acknowledging what learner now knows]

**Related Concepts:**
[How this connects to concepts at similar level - 1 paragraph]
[VISUAL: concept-map] - showing relationships between related ideas

**Building Forward:**
[What future topics depend on this foundation - 1 paragraph]
[VISUAL: pathway-diagram] - showing progression to next skills

**Beyond the Classroom:**
[1-2 real-world applications or appearances in other subjects - 1 paragraph]

[Closing - 1-2 sentences encouraging next steps]

QUALITY CRITERIA:
- Makes 3-5 specific, concrete connections
- Shows both horizontal and vertical connections
- Inspiring but not overwhelming
- Helps learner see "the big picture"

TONE: Forward-looking, connections-focused, inspiring, broadening perspective

VISUAL PRIMITIVE MARKERS:
- [VISUAL: concept-map] for showing relationships
- [VISUAL: pathway-diagram] for showing skill progression
- [VISUAL: skill-tree] for showing dependencies
- [VISUAL: cross-subject-connection] for interdisciplinary links
- [VISUAL: application-example] for real-world applications
Only mark visuals that genuinely clarify connections.

OUTPUT: Generate the connections and extensions section following these guidelines."""


# Template registry
SECTION_PROMPT_TEMPLATES = {
    SectionType.INTRODUCTION_MOTIVATION: get_introduction_motivation_prompt,
    SectionType.INTUITIVE_EXPLANATION: get_intuitive_explanation_prompt,
    SectionType.FORMAL_DEFINITION: get_formal_definition_prompt,
    SectionType.WORKED_EXAMPLES: get_worked_examples_prompt,
    SectionType.COMMON_ERRORS: get_common_errors_prompt,
    SectionType.CONNECTIONS_EXTENSIONS: get_connections_extensions_prompt,
}


def get_section_prompt(
    section_type: SectionType,
    primary_objective: str,
    key_concepts: list,
    key_terminology: dict,
    grade_level: str,
    subject: str = None,
    unit: str = None,
    skill: str = None,
    subskill_description: str = None,
    context_primitives: dict = None,
    prior_sections_summary: str = None,
    related_concepts: list = None,
    future_topics: list = None
) -> str:
    """
    Get the appropriate prompt template for a section type.

    Args:
        section_type: The type of section to generate
        primary_objective: Main learning objective
        key_concepts: Core concepts to cover
        key_terminology: Key terms with definitions
        grade_level: Target grade level
        subject: Subject area (optional)
        unit: Unit within subject (optional)
        skill: Skill within unit (optional)
        subskill_description: Description of subskill
        context_primitives: Available primitives for examples
        prior_sections_summary: Summary of previous sections
        related_concepts: Related concepts at same level
        future_topics: Future topics this builds toward

    Returns:
        Formatted prompt string for the section type
    """
    template_func = SECTION_PROMPT_TEMPLATES.get(section_type)
    if not template_func:
        raise ValueError(f"No template found for section type: {section_type}")

    return template_func(
        primary_objective=primary_objective,
        key_concepts=key_concepts,
        key_terminology=key_terminology,
        grade_level=grade_level,
        subject=subject,
        unit=unit,
        skill=skill,
        subskill_description=subskill_description,
        context_primitives=context_primitives,
        prior_sections_summary=prior_sections_summary,
        related_concepts=related_concepts,
        future_topics=future_topics
    )
