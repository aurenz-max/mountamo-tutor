# backend/app/core/schemas/content_schemas.py
from google.genai.types import Schema

# Master Context Schema
MASTER_CONTEXT_SCHEMA = Schema(
    type="object",
    properties={
        "core_concepts": Schema(
            type="array",
            items=Schema(type="string"),
            description="4-6 core concepts students must understand"
        ),
        "key_terminology": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "term": Schema(type="string", description="The key term"),
                    "definition": Schema(type="string", description="Definition of the term")
                },
                required=["term", "definition"]
            ),
            description="5-8 key terms with precise definitions as an array of term-definition objects"
        ),
        "learning_objectives": Schema(
            type="array",
            items=Schema(type="string"),
            description="4-6 specific, measurable learning objectives"
        ),
        "difficulty_level": Schema(
            type="string",
            description="Difficulty level for this content"
        ),
        "grade_level": Schema(
            type="string",
            description="Target grade level for students"
        ),
        "prerequisites": Schema(
            type="array",
            items=Schema(type="string"),
            description="Required prerequisite knowledge"
        ),
        "real_world_applications": Schema(
            type="array",
            items=Schema(type="string"),
            description="3-5 real-world applications of this knowledge"
        )
    },
    required=["core_concepts", "key_terminology", "learning_objectives", "difficulty_level", "grade_level", "prerequisites", "real_world_applications"]
)

# Reading Content Schema
READING_CONTENT_SCHEMA = Schema(
    type="object",
    properties={
        "title": Schema(type="string", description="Title for the reading content"),
        "sections": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "heading": Schema(type="string", description="Section heading"),
                    "content": Schema(type="string", description="Section content text"),
                    "key_terms_used": Schema(
                        type="array",
                        items=Schema(type="string"),
                        description="Key terms used in this section"
                    ),
                    "concepts_covered": Schema(
                        type="array",
                        items=Schema(type="string"),
                        description="Core concepts covered in this section"
                    ),
                    # Interactive Primitives (all optional)
                    "alerts": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["alert"], description="Primitive type identifier"),
                                "style": Schema(type="string", enum=["info", "warning", "success", "tip"], description="Alert visual style"),
                                "title": Schema(type="string", description="Alert title/heading"),
                                "content": Schema(type="string", description="Alert body content")
                            },
                            required=["type", "style", "title", "content"]
                        ),
                        description="Alert/callout boxes for important information"
                    ),
                    "expandables": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["expandable"], description="Primitive type identifier"),
                                "title": Schema(type="string", description="Expandable section title"),
                                "content": Schema(type="string", description="Hidden content revealed on expansion")
                            },
                            required=["type", "title", "content"]
                        ),
                        description="Expandable sections for optional deeper information"
                    ),
                    "quizzes": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["quiz"], description="Primitive type identifier"),
                                "question": Schema(type="string", description="Quiz question text"),
                                "answer": Schema(type="string", description="Correct answer"),
                                "explanation": Schema(type="string", description="Optional explanation of the answer")
                            },
                            required=["type", "question", "answer"]
                        ),
                        description="Quick knowledge check questions"
                    ),
                    "definitions": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["definition"], description="Primitive type identifier"),
                                "term": Schema(type="string", description="Term to be defined"),
                                "definition": Schema(type="string", description="Definition of the term")
                            },
                            required=["type", "term", "definition"]
                        ),
                        description="Inline term definitions for contextual learning"
                    ),
                    "checklists": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["checklist"], description="Primitive type identifier"),
                                "text": Schema(type="string", description="Checklist item text"),
                                "completed": Schema(type="boolean", default=False, description="Initial completion state")
                            },
                            required=["type", "text"]
                        ),
                        description="Progress tracking checklist items"
                    ),
                    "tables": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["table"], description="Primitive type identifier"),
                                "headers": Schema(
                                    type="array",
                                    items=Schema(type="string"),
                                    description="Table column headers"
                                ),
                                "rows": Schema(
                                    type="array",
                                    items=Schema(
                                        type="array",
                                        items=Schema(type="string")
                                    ),
                                    description="Table row data (array of arrays)"
                                )
                            },
                            required=["type", "headers", "rows"]
                        ),
                        description="Structured data tables"
                    ),
                    "keyvalues": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["keyvalue"], description="Primitive type identifier"),
                                "key": Schema(type="string", description="Fact or statistic label"),
                                "value": Schema(type="string", description="Corresponding value or data")
                            },
                            required=["type", "key", "value"]
                        ),
                        description="Key-value pairs for important facts and statistics"
                    ),
                    # New Enhanced Interactive Primitives
                    "interactive_timelines": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["interactive_timeline"], description="Primitive type identifier"),
                                "title": Schema(type="string", description="Title of the timeline"),
                                "events": Schema(
                                    type="array",
                                    items=Schema(
                                        type="object",
                                        properties={
                                            "date": Schema(type="string", description="Date or time point of the event"),
                                            "title": Schema(type="string", description="Title of the event"),
                                            "description": Schema(type="string", description="Detailed description of the event")
                                        },
                                        required=["date", "title", "description"]
                                    ),
                                    description="A list of events on the timeline"
                                )
                            },
                            required=["type", "title", "events"]
                        ),
                        description="Interactive timelines to visualize sequences of events"
                    ),
                    "carousels": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["carousel"], description="Primitive type identifier"),
                                "title": Schema(type="string", description="Optional title for the carousel"),
                                "items": Schema(
                                    type="array",
                                    items=Schema(
                                        type="object",
                                        properties={
                                            "image_url": Schema(type="string", description="URL for the carousel image"),
                                            "alt_text": Schema(type="string", description="Accessibility text for the image"),
                                            "caption": Schema(type="string", description="A brief caption for the image"),
                                            "description": Schema(type="string", description="Optional detailed description")
                                        },
                                        required=["image_url", "alt_text"]
                                    )
                                )
                            },
                            required=["type", "items"]
                        ),
                        description="Carousels or sliders for displaying a sequence of images or cards"
                    ),
                    "flip_cards": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["flip_card"], description="Primitive type identifier"),
                                "front_content": Schema(type="string", description="Content for the front of the card"),
                                "back_content": Schema(type="string", description="Content for the back of the card")
                            },
                            required=["type", "front_content", "back_content"]
                        ),
                        description="Interactive flip cards for self-assessment and vocabulary"
                    ),
                    "categorization_activities": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["categorization"], description="Primitive type identifier"),
                                "instruction": Schema(type="string", description="Instruction for the activity"),
                                "categories": Schema(
                                    type="array",
                                    items=Schema(type="string"),
                                    description="The categories to sort items into"
                                ),
                                "items": Schema(
                                    type="array",
                                    items=Schema(
                                        type="object",
                                        properties={
                                            "item_text": Schema(type="string", description="The text of the item to be categorized"),
                                            "correct_category": Schema(type="string", description="The correct category for this item")
                                        },
                                        required=["item_text", "correct_category"]
                                    ),
                                    description="The items that need to be sorted"
                                )
                            },
                            required=["type", "instruction", "categories", "items"]
                        ),
                        description="Activities where users sort items into categories"
                    ),
                    "fill_in_the_blanks": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["fill_in_the_blank"], description="Primitive type identifier"),
                                "sentence": Schema(type="string", description="The sentence with a blank, represented by '__'"),
                                "correct_answer": Schema(type="string", description="The word that correctly fills the blank"),
                                "hint": Schema(type="string", description="Optional hint for the student")
                            },
                            required=["type", "sentence", "correct_answer"]
                        ),
                        description="Fill-in-the-blank exercises to test knowledge in context"
                    ),
                    "scenario_questions": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["scenario_question"], description="Primitive type identifier"),
                                "scenario": Schema(type="string", description="A real-world scenario or problem description"),
                                "question": Schema(type="string", description="The question related to the scenario"),
                                "answer_options": Schema(
                                    type="array",
                                    items=Schema(type="string"),
                                    description="A list of possible answers for multiple choice scenarios"
                                ),
                                "correct_answer": Schema(type="string", description="The correct answer"),
                                "explanation": Schema(type="string", description="Explanation of why the answer is correct")
                            },
                            required=["type", "scenario", "question", "correct_answer"]
                        ),
                        description="Questions based on real-world scenarios to promote application of knowledge"
                    ),
                    "tabbed_content": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["tabbed_content"], description="Primitive type identifier"),
                                "tabs": Schema(
                                    type="array",
                                    items=Schema(
                                        type="object",
                                        properties={
                                            "title": Schema(type="string", description="The title of the tab"),
                                            "content": Schema(type="string", description="The content within the tab")
                                        },
                                        required=["title", "content"]
                                    ),
                                    description="A list of tab objects, each with a title and content."
                                )
                            },
                            required=["type", "tabs"]
                        ),
                        description="Tabbed interface for comparing and contrasting related topics."
                    ),
                    "matching_activities": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["matching_activity"], description="Primitive type identifier"),
                                "instruction": Schema(type="string", description="Instruction for the activity, e.g., 'Match the term to its definition.'"),
                                "pairs": Schema(
                                    type="array",
                                    items=Schema(
                                        type="object",
                                        properties={
                                            "prompt": Schema(type="string", description="The item in the first column (e.g., the term)"),
                                            "answer": Schema(type="string", description="The corresponding item in the second column (e.g., the definition)")
                                        },
                                        required=["prompt", "answer"]
                                    ),
                                    description="The list of correct pairs. The front-end will shuffle the answer column."
                                )
                            },
                            required=["type", "instruction", "pairs"]
                        ),
                        description="Interactive matching games to connect concepts."
                    ),
                    "sequencing_activities": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["sequencing_activity"], description="Primitive type identifier"),
                                "instruction": Schema(type="string", description="Instruction for the activity, e.g., 'Arrange the steps of photosynthesis in the correct order.'"),
                                "items": Schema(
                                    type="array",
                                    items=Schema(type="string"),
                                    description="The list of items to be sequenced, provided in the correct order. The front-end will display them shuffled."
                                )
                            },
                            required=["type", "instruction", "items"]
                        ),
                        description="Activities where students must arrange items in the correct order."
                    ),
                    "accordions": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "type": Schema(type="string", enum=["accordion"], description="Primitive type identifier"),
                                "title": Schema(type="string", description="Optional title for the accordion group, e.g., 'Frequently Asked Questions'"),
                                "items": Schema(
                                    type="array",
                                    items=Schema(
                                        type="object",
                                        properties={
                                            "question": Schema(type="string", description="The question or heading for the expandable item"),
                                            "answer": Schema(type="string", description="The content that is revealed")
                                        },
                                        required=["question", "answer"]
                                    ),
                                    description="A list of question/answer pairs."
                                )
                            },
                            required=["type", "items"]
                        ),
                        description="An accordion-style list for FAQs or question-and-answer breakdowns."
                    )
                },
                required=["heading", "content", "key_terms_used", "concepts_covered"]
            )
        ),
        "word_count": Schema(type="integer", description="Estimated word count"),
        "reading_level": Schema(type="string", description="Appropriate reading level"),
        "grade_appropriate_features": Schema(
            type="array",
            items=Schema(type="string"),
            description="Features that make content appropriate for grade level"
        )
    },
    required=["title", "sections", "word_count", "reading_level", "grade_appropriate_features"]
)

# Visual Demo Metadata Schema
VISUAL_METADATA_SCHEMA = Schema(
    type="object",
    properties={
        "description": Schema(
            type="string",
            description="Clear description of what the visualization demonstrates and how it teaches the core concepts"
        ),
        "interactive_elements": Schema(
            type="array",
            items=Schema(type="string"),
            description="Specific interactive elements in the demo"
        ),
        "concepts_demonstrated": Schema(
            type="array",
            items=Schema(type="string"),
            description="Core concepts from master context that are demonstrated"
        ),
        "user_instructions": Schema(
            type="string",
            description="Simple, step-by-step instructions for students on how to interact with the demo"
        ),
        "grade_appropriate_features": Schema(
            type="array",
            items=Schema(type="string"),
            description="Features that make this demo engaging and appropriate for the grade level"
        ),
        "learning_objectives_addressed": Schema(
            type="array",
            items=Schema(type="string"),
            description="How each learning objective is demonstrated in the visualization"
        ),
        "educational_value": Schema(
            type="string",
            description="Explanation of how this demo reinforces the key terminology and concepts"
        )
    },
    required=["description", "interactive_elements", "concepts_demonstrated", "user_instructions", "grade_appropriate_features", "learning_objectives_addressed", "educational_value"]
)

# ============================================================================
# VISUAL GENERATION SCHEMAS - Two-Step Visual Architecture
# ============================================================================
# NOTE: These schemas must be defined BEFORE PRACTICE_PROBLEMS_SCHEMA_STEP1

# Visual Intent Schema - Used in Step 1 to indicate what visuals are needed
VISUAL_INTENT_SCHEMA = Schema(
    type="object",
    properties={
        "needs_visual": Schema(
            type="boolean",
            description="Set to true if this element requires a visual component"
        ),
        "visual_type": Schema(
            type="string",
            description="""If needs_visual is true, specify the MOST APPROPRIATE visual primitive:

✨ FOUNDATIONAL VISUALS (Use FIRST for K-1 content showing/counting objects):
• object-collection: Display groups of objects for counting, identification, simple grouping
• comparison-panel: Side-by-side comparison of two object collections ("Who has more?")

MATH VISUALS:
• bar-model: Comparing ABSTRACT quantities/totals (e.g., "Team A: 15 points vs Team B: 12 points") - NOT for counting physical objects
• number-line: Number sequences, ordering, skip counting
• base-ten-blocks: Place value, multi-digit numbers
• fraction-circles: Part-whole fractions, fraction comparison
• geometric-shape: Shape identification, spatial reasoning

SCIENCE VISUALS:
• labeled-diagram: Parts of complex objects/organisms (plant parts, insect anatomy) - NOT for simple counting
• cycle-diagram: Repeating processes, life cycles
• tree-diagram: Hierarchical classification, branching
• line-graph: Change over time, trends
• thermometer: Temperature measurement

LANGUAGE ARTS VISUALS:
• sentence-diagram: Parts of speech, sentence structure
• story-sequence: Beginning/middle/end narrative structure
• word-web: Vocabulary associations, related concepts
• character-web: Character traits with evidence
• venn-diagram: Compare/contrast two items

ABC/LITERACY VISUALS:
• letter-tracing: Letter formation, stroke order
• letter-picture: Letter-sound correspondence, initial sounds
• alphabet-sequence: Alphabetical order, missing letters
• rhyming-pairs: Rhyme identification, word families
• sight-word-card: High-frequency word recognition
• sound-sort: Phoneme categorization, sound discrimination

⚠️ CRITICAL RULES:
1. For counting/showing physical objects → USE object-collection or comparison-panel
2. For abstract numerical data → USE bar-model
3. Choose the SIMPLEST visual that serves the learning goal""",
            enum=[
                # NEW Foundational Primitives (highest priority)
                "object-collection", "comparison-panel",
                # Math primitives
                "bar-model", "base-ten-blocks", "number-line", "fraction-circles", "geometric-shape",
                # Science primitives
                "labeled-diagram", "cycle-diagram", "tree-diagram", "line-graph", "thermometer",
                # Language Arts primitives
                "sentence-diagram", "story-sequence", "word-web", "character-web", "venn-diagram",
                # ABCs primitives
                "letter-tracing", "letter-picture", "alphabet-sequence", "rhyming-pairs",
                "sight-word-card", "sound-sort"
            ]
        ),
        "visual_purpose": Schema(
            type="string",
            description="A clear, concise instruction for the visual generator on what this visual must show"
        ),
        "visual_id": Schema(
            type="string",
            description="Unique identifier for this visual request (e.g., 'q_1', 'opt_A_1')"
        )
    },
    required=["needs_visual"]
)

# ============================================================================
# CARD GRID SCHEMA - Simple grid layout for live interactions
# ============================================================================
CARD_GRID_SCHEMA = Schema(
    type="object",
    properties={
        "cards": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(
                        type="string",
                        description="""Unique card identifier. CRITICAL: This ID MUST match the target IDs specified in interaction_config.targets.
Examples: 'card_A', 'card_B', 'card_1', 'card_yes', 'card_no'
The frontend will use these IDs to detect which card was clicked and evaluate correctness."""
                    ),
                    "content_type": Schema(
                        type="string",
                        enum=["text", "image", "image_with_label"],
                        description="""Type of content to display on this card:
- "text": Display text only (e.g., "Yes", "No", "A", "Cat")
- "image": Display an emoji or image only (e.g., "🍎", "🐱")
- "image_with_label": Display both image and text label"""
                    ),
                    "primary_value": Schema(
                        type="string",
                        description="""Main content to display on the card:
- For content_type="text": The text to show (e.g., "Yes", "No", "The cat ran")
- For content_type="image": An emoji or image identifier (e.g., "🍎", "🚗", "letter_A")
- For content_type="image_with_label": The image/emoji to show above the label"""
                    ),
                    "label": Schema(
                        type="string",
                        description="""Optional label/caption text:
- Required when content_type="image_with_label"
- Shows below the image as a caption (e.g., image="🍎", label="Apple")
- Omit for "text" and "image" content types"""
                    ),
                    "style": Schema(
                        type="string",
                        enum=["default", "large", "small"],
                        default="default",
                        description="Size variant for the card (default is recommended for most cases)"
                    )
                },
                required=["id", "content_type", "primary_value"]
            ),
            description="""Array of clickable cards. Each card represents one choice/option.
CRITICAL: The number of cards and their IDs must match interaction_config.targets exactly.
Example for Yes/No question: [
  {"id": "card_A", "content_type": "text", "primary_value": "Yes"},
  {"id": "card_B", "content_type": "text", "primary_value": "No"}
]"""
        ),
        "layout": Schema(
            type="string",
            enum=["grid", "row", "column"],
            default="grid",
            description="Layout arrangement: 'row' for horizontal, 'column' for vertical, 'grid' for auto-wrapping"
        ),
        "grid_columns": Schema(
            type="integer",
            description="Number of columns for grid layout (2-4 typical). Use 2 for Yes/No, 3-4 for multiple choice",
            minimum=1,
            maximum=6
        )
    },
    required=["cards"]
)

# ============================================================================
# COMPOSITE VISUAL CONTENT SCHEMA - Multi-layer visuals for live interactions
# ============================================================================

# Composite visual structure supporting display + interaction layers
COMPOSITE_VISUAL_CONTENT_SCHEMA = Schema(
    type="object",
    properties={
        # Display Visual Layer (optional) - Shows informational content
        "display_visual": Schema(
            type="object",
            properties={
                "visual_type": Schema(
                    type="string",
                    description="Type of display visual (rhyming-pairs, object-collection, etc.)"
                ),
                "visual_data": Schema(
                    type="object",
                    description="Data for the display visual matching its schema"
                )
            },
            required=["visual_type", "visual_data"],
            description="Optional informational visual layer (e.g., rhyming pairs to observe)"
        ),
        # Interaction Visual Layer (optional) - Provides answer interface
        "interaction_visual": Schema(
            type="object",
            properties={
                "visual_type": Schema(
                    type="string",
                    description="Type of interaction visual (typically card-grid for click mode)"
                ),
                "visual_data": Schema(
                    type="object",
                    description="Data for the interaction visual matching its schema"
                )
            },
            required=["visual_type", "visual_data"],
            description="Optional clickable interface layer (e.g., Yes/No cards)"
        )
    },
    description="""Composite visual structure for live interactions with multiple layers.

USAGE PATTERNS:
- Display + Interaction: Show content + provide answer buttons (e.g., rhyming-pairs + Yes/No cards)
- Interaction Only: Just answer interface, no separate content display (e.g., letter selection cards)
- Display Only: Just content, student answers via speech (e.g., describe what you see)

BACKWARD COMPATIBILITY:
- Legacy single visual format still supported via visual_type/visual_data at root level
- Frontend checks for display_visual/interaction_visual first, falls back to legacy format"""
)

# Composite visual intent for Phase 1 generation
# NOTE: interaction_visual_intent has been MOVED to interaction_config (see below)
# This now only contains display_visual_intent for informational content
COMPOSITE_VISUAL_INTENT_SCHEMA = Schema(
    type="object",
    properties={
        "display_visual_intent": VISUAL_INTENT_SCHEMA
    },
    description="Visual intent for display layer (informational content). Interaction visuals are now part of interaction_config."
)

# ============================================================================
# LIVE INTERACTION SCHEMAS - Real-time AI-guided interactive problems
# ============================================================================

# STEP 1 Schema: Live interaction with visual intent (for Phase 1 generation)
LIVE_INTERACTION_SCHEMA_STEP1 = Schema(
    type="object",
    properties={
        "id": Schema(type="string", description="Unique identifier for this live interaction problem"),
        "problem_type": Schema(type="string", enum=["live_interaction"], description="Problem type identifier"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),

        # AI Tutor Configuration
        "prompt": Schema(
            type="object",
            properties={
                "system": Schema(
                    type="string",
                    description="System prompt defining the AI tutor's persona and role for this specific interaction"
                ),
                "instruction": Schema(
                    type="string",
                    description="The initial verbal instruction/question the AI tutor will speak to start the problem"
                ),
                "voice": Schema(
                    type="string",
                    default="Leda",
                    description="Voice style for the AI tutor (e.g., 'Leda', 'Kore')"
                )
            },
            required=["system", "instruction"]
        ),

        # Visual Intent (what visuals are needed - actual data generated in Phase 2)
        # COMPOSITE STRUCTURE: Now only contains display_visual_intent
        # interaction_visual_intent has been MOVED to interaction_config below
        "visual_intent": COMPOSITE_VISUAL_INTENT_SCHEMA,

        # Interaction Configuration (NOW INCLUDES INTERACTION VISUAL)
        "interaction_config": Schema(
            type="object",
            properties={
                "mode": Schema(
                    type="string",
                    enum=["click", "speech", "drag", "trace"],
                    description="How the student interacts with the visual"
                ),
                "interaction_visual_intent": Schema(
                    type="object",
                    properties={
                        "needs_visual": Schema(
                            type="boolean",
                            description="""Set to true if this interaction requires a clickable visual interface.
CRITICAL RULES:
- For mode='click': MUST set needs_visual=true and use visual_type='card-grid'
- For mode='speech': Set needs_visual=false (student speaks answer)
- For mode='drag' or 'trace': Set needs_visual=true with appropriate visual type"""
                        ),
                        "visual_type": Schema(
                            type="string",
                            description="""Type of interaction visual:
- 'card-grid': For click mode (Yes/No buttons, multiple choice cards, etc.) - REQUIRED for click mode
- Other types may be added for drag/trace modes in future""",
                            enum=["card-grid"]
                        ),
                        "visual_purpose": Schema(
                            type="string",
                            description="""Clear description of what cards/options to display.
EXAMPLES:
- 'Display two cards: Yes and No for student to click'
- 'Display three cards: A, B, C with answer choices'
- 'Display four cards with images: apple, banana, cat, dog'"""
                        ),
                        "visual_id": Schema(
                            type="string",
                            description="Unique identifier for this interaction visual (e.g., 'interaction_1')"
                        )
                    },
                    required=["needs_visual"],
                    description="""CRITICAL: This defines the clickable answer interface.
For click mode, this MUST be a card-grid with cards matching the targets below.
The visual generation phase will create cards with IDs that match the target IDs."""
                ),
                "targets": Schema(
                    type="array",
                    items=Schema(
                        type="object",
                        properties={
                            "id": Schema(
                                type="string",
                                description="""ID of the interactive element.
CRITICAL: For click mode with card-grid, this MUST match the card ID that will be generated.
Examples: 'card_yes', 'card_no', 'card_A', 'card_B', 'card_1', 'card_2'"""
                            ),
                            "is_correct": Schema(
                                type="boolean",
                                description="Whether selecting/clicking this element is a correct answer"
                            )
                        },
                        required=["id", "is_correct"]
                    ),
                    description="""List of interactive elements and their correctness.
CRITICAL: For click mode, card IDs generated in interaction_visual will match these target IDs exactly."""
                )
            },
            required=["mode", "interaction_visual_intent", "targets"]
        ),

        # Evaluation and Feedback
        "evaluation": Schema(
            type="object",
            properties={
                "feedback": Schema(
                    type="object",
                    properties={
                        "correct": Schema(
                            type="object",
                            properties={
                                "audio": Schema(
                                    type="string",
                                    description="What the AI tutor should say for a correct answer"
                                ),
                                "visual_effect": Schema(
                                    type="string",
                                    enum=["highlight", "celebrate", "bounce", "pulse"],
                                    description="Visual effect to apply on the frontend"
                                )
                            },
                            required=["audio"]
                        ),
                        "incorrect": Schema(
                            type="object",
                            properties={
                                "audio": Schema(
                                    type="string",
                                    description="What the AI tutor should say for an incorrect answer"
                                ),
                                "visual_effect": Schema(
                                    type="string",
                                    enum=["shake", "dim", "fade"],
                                    description="Visual effect to apply on the frontend"
                                ),
                                "hint": Schema(
                                    type="string",
                                    description="Optional hint to guide the student toward the correct answer"
                                )
                            },
                            required=["audio"]
                        )
                    },
                    required=["correct", "incorrect"]
                )
            },
            required=["feedback"]
        ),

        # Metadata
        "metadata": Schema(
            type="object",
            properties={
                "subject": Schema(type="string"),
                "skill": Schema(
                    type="object",
                    properties={
                        "id": Schema(type="string", description="Skill ID"),
                        "description": Schema(type="string", description="Skill description")
                    }
                ),
                "subskill": Schema(
                    type="object",
                    properties={
                        "id": Schema(type="string", description="Subskill ID"),
                        "description": Schema(type="string", description="Subskill description")
                    }
                ),
                "expected_duration_seconds": Schema(
                    type="integer",
                    description="Expected time to complete this interaction"
                )
            }
        ),

        # Educational Context
        "rationale": Schema(
            type="string",
            description="Educational reasoning behind this problem"
        ),
        "teaching_note": Schema(
            type="string",
            description="Tips for educators about this problem"
        ),
        "success_criteria": Schema(
            type="array",
            items=Schema(type="string"),
            description="What student should demonstrate to succeed"
        )
    },
    required=["id", "problem_type", "difficulty", "grade_level", "prompt", "visual_intent", "interaction_config", "evaluation"]
)

# FINAL Schema: Live interaction with actual visual data (for Phase 2 output)
LIVE_INTERACTION_SCHEMA = Schema(
    type="object",
    properties={
        "id": Schema(type="string", description="Unique identifier for this live interaction problem"),
        "problem_type": Schema(type="string", enum=["live_interaction"], description="Problem type identifier"),
        "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
        "grade_level": Schema(type="string"),

        # AI Tutor Configuration
        "prompt": Schema(
            type="object",
            properties={
                "system": Schema(
                    type="string",
                    description="System prompt defining the AI tutor's persona and role for this specific interaction"
                ),
                "instruction": Schema(
                    type="string",
                    description="The initial verbal instruction/question the AI tutor will speak to start the problem"
                ),
                "voice": Schema(
                    type="string",
                    default="Leda",
                    description="Voice style for the AI tutor (e.g., 'Leda', 'Kore')"
                )
            },
            required=["system", "instruction"]
        ),

        # Visual Content (COMPOSITE STRUCTURE for multi-layer visuals)
        # NOTE: interaction_visual has been MOVED to interaction_config
        # This now only contains display_visual (informational layer)
        "visual_content": Schema(
            type="object",
            properties={
                "display_visual": Schema(
                    type="object",
                    properties={
                        "visual_type": Schema(
                            type="string",
                            description="Type of display visual (rhyming-pairs, object-collection, etc.)"
                        ),
                        "visual_data": Schema(
                            type="object",
                            description="Data for the display visual matching its schema"
                        )
                    },
                    required=["visual_type", "visual_data"],
                    description="Optional informational visual layer (e.g., rhyming pairs to observe)"
                )
            },
            description="Display visual content (informational only). Interaction visuals are now in interaction_config."
        ),

        # Interaction Configuration (NOW INCLUDES INTERACTION VISUAL)
        "interaction_config": Schema(
            type="object",
            properties={
                "mode": Schema(
                    type="string",
                    enum=["click", "speech", "drag", "trace"],
                    description="How the student interacts with the visual"
                ),
                "interaction_visual": Schema(
                    type="object",
                    properties={
                        "visual_type": Schema(
                            type="string",
                            description="Type of interaction visual (typically card-grid for click mode)"
                        ),
                        "visual_data": Schema(
                            type="object",
                            description="Data for the interaction visual matching its schema"
                        )
                    },
                    required=["visual_type", "visual_data"],
                    description="Clickable interface visual (e.g., Yes/No cards)"
                ),
                "targets": Schema(
                    type="array",
                    items=Schema(
                        type="object",
                        properties={
                            "id": Schema(
                                type="string",
                                description="ID of the interactive element matching card IDs in interaction_visual"
                            ),
                            "is_correct": Schema(
                                type="boolean",
                                description="Whether selecting/clicking this element is a correct answer"
                            )
                        },
                        required=["id", "is_correct"]
                    ),
                    description="List of interactive elements and their correctness"
                )
            },
            required=["mode", "targets"]
        ),

        # Evaluation and Feedback
        "evaluation": Schema(
            type="object",
            properties={
                "feedback": Schema(
                    type="object",
                    properties={
                        "correct": Schema(
                            type="object",
                            properties={
                                "audio": Schema(
                                    type="string",
                                    description="What the AI tutor should say for a correct answer"
                                ),
                                "visual_effect": Schema(
                                    type="string",
                                    enum=["highlight", "celebrate", "bounce", "pulse"],
                                    description="Visual effect to apply on the frontend"
                                )
                            },
                            required=["audio"]
                        ),
                        "incorrect": Schema(
                            type="object",
                            properties={
                                "audio": Schema(
                                    type="string",
                                    description="What the AI tutor should say for an incorrect answer"
                                ),
                                "visual_effect": Schema(
                                    type="string",
                                    enum=["shake", "dim", "fade"],
                                    description="Visual effect to apply on the frontend"
                                ),
                                "hint": Schema(
                                    type="string",
                                    description="Optional hint to guide the student toward the correct answer"
                                )
                            },
                            required=["audio"]
                        )
                    },
                    required=["correct", "incorrect"]
                )
            },
            required=["feedback"]
        ),

        # Metadata
        "metadata": Schema(
            type="object",
            properties={
                "subject": Schema(type="string"),
                "skill": Schema(
                    type="object",
                    properties={
                        "id": Schema(type="string", description="Skill ID"),
                        "description": Schema(type="string", description="Skill description")
                    }
                ),
                "subskill": Schema(
                    type="object",
                    properties={
                        "id": Schema(type="string", description="Subskill ID"),
                        "description": Schema(type="string", description="Subskill description")
                    }
                ),
                "expected_duration_seconds": Schema(
                    type="integer",
                    description="Expected time to complete this interaction"
                )
            }
        ),

        # Educational Context
        "rationale": Schema(
            type="string",
            description="Educational reasoning behind this problem"
        ),
        "teaching_note": Schema(
            type="string",
            description="Tips for educators about this problem"
        ),
        "success_criteria": Schema(
            type="array",
            items=Schema(type="string"),
            description="What student should demonstrate to succeed"
        )
    },
    required=["id", "problem_type", "difficulty", "grade_level", "prompt", "visual_content", "interaction_config", "evaluation"]
)

# ============================================================================
# DEPRECATED: Monolithic Schema (Kept for Reference Only)
# ============================================================================
# This schema is NO LONGER USED due to Gemini complexity limits (400 errors).
# It has been replaced by individual per-type schemas in problem_type_schemas.py
# with a three-phase generation architecture:
#   Phase 1: LLM selects problem types
#   Phase 2: Generate each type with focused schemas
#   Phase 3: Visual generation (unchanged)
# ============================================================================

# Practice Problems Schema Step 1 - WITH VISUAL INTENTS (DEPRECATED)
PRACTICE_PROBLEMS_SCHEMA_STEP1 = Schema(
    type="object",
    properties={
        # Multiple Choice Problems with Visual Intents
        "multiple_choice": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "question": Schema(type="string"),
                    "question_visual_intent": VISUAL_INTENT_SCHEMA,
                    "options": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "id": Schema(type="string"),
                                "text": Schema(type="string")
                            },
                            required=["id", "text"]
                        )
                    ),
                    "correct_option_id": Schema(type="string"),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "question", "question_visual_intent", "options", "correct_option_id", "rationale", "teaching_note", "success_criteria"]
            )
        ),

        # True/False Problems with Visual Intents
        "true_false": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "statement": Schema(type="string"),
                    "statement_visual_intent": VISUAL_INTENT_SCHEMA,
                    "correct": Schema(type="boolean"),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "statement", "statement_visual_intent", "correct", "rationale", "teaching_note", "success_criteria"]
            )
        ),

        # Fill in the Blanks Problems
        "fill_in_blanks": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "text_with_blanks": Schema(type="string"),
                    "blanks": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "id": Schema(type="string"),
                                "correct_answers": Schema(type="array", items=Schema(type="string")),
                                "case_sensitive": Schema(type="boolean")
                            },
                            required=["id", "correct_answers", "case_sensitive"]
                        )
                    ),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "text_with_blanks", "blanks", "rationale", "teaching_note", "success_criteria"]
            )
        ),

        # Matching Activities
        "matching_activity": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "prompt": Schema(type="string"),
                    "left_items": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "id": Schema(type="string"),
                                "text": Schema(type="string")
                            },
                            required=["id", "text"]
                        )
                    ),
                    "right_items": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "id": Schema(type="string"),
                                "text": Schema(type="string")
                            },
                            required=["id", "text"]
                        )
                    ),
                    "mappings": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "left_id": Schema(type="string"),
                                "right_ids": Schema(type="array", items=Schema(type="string"))
                            },
                            required=["left_id", "right_ids"]
                        )
                    ),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "prompt", "left_items", "right_items", "mappings", "rationale", "teaching_note", "success_criteria"]
            )
        ),

        # Sequencing Activities
        "sequencing_activity": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "instruction": Schema(type="string"),
                    "items": Schema(type="array", items=Schema(type="string")),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "instruction", "items", "rationale", "teaching_note", "success_criteria"]
            )
        ),

        # Categorization Activities
        "categorization_activity": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "instruction": Schema(type="string"),
                    "categories": Schema(type="array", items=Schema(type="string")),
                    "categorization_items": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "item_text": Schema(type="string"),
                                "correct_category": Schema(type="string")
                            },
                            required=["item_text", "correct_category"]
                        )
                    ),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "instruction", "categories", "categorization_items", "rationale", "teaching_note", "success_criteria"]
            )
        ),

        # Scenario Questions
        "scenario_question": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "scenario": Schema(type="string"),
                    "scenario_question": Schema(type="string"),
                    "scenario_answer": Schema(type="string"),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "scenario", "scenario_question", "scenario_answer", "rationale", "teaching_note", "success_criteria"]
            )
        ),

        # Short Answer Questions
        "short_answer": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "question": Schema(type="string"),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "question", "rationale", "teaching_note", "success_criteria"]
            )
        ),

        # Live Interaction Problems (Step 1 - with visual intent)
        "live_interaction": Schema(
            type="array",
            items=LIVE_INTERACTION_SCHEMA_STEP1
        )
    }
)

# Practice Problems Schema - Following reading content pattern with optional arrays
PRACTICE_PROBLEMS_SCHEMA = Schema(
    type="object",
    properties={
        # Multiple Choice Problems
        "multiple_choice": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "question": Schema(type="string"),
                    "options": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "id": Schema(type="string"),
                                "text": Schema(type="string")
                            },
                            required=["id", "text"]
                        )
                    ),
                    "correct_option_id": Schema(type="string"),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "question", "options", "correct_option_id", "rationale", "teaching_note", "success_criteria"]
            )
        ),
        
        # True/False Problems
        "true_false": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "statement": Schema(type="string"),
                    "correct": Schema(type="boolean"),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "statement", "correct", "rationale", "teaching_note", "success_criteria"]
            )
        ),
        
        # Fill in the Blanks Problems
        "fill_in_blanks": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "text_with_blanks": Schema(type="string"),
                    "blanks": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "id": Schema(type="string"),
                                "correct_answers": Schema(type="array", items=Schema(type="string")),
                                "case_sensitive": Schema(type="boolean")
                            },
                            required=["id", "correct_answers", "case_sensitive"]
                        )
                    ),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "text_with_blanks", "blanks", "rationale", "teaching_note", "success_criteria"]
            )
        ),
        
        # Matching Activities
        "matching_activity": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "prompt": Schema(type="string"),
                    "left_items": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "id": Schema(type="string"),
                                "text": Schema(type="string")
                            },
                            required=["id", "text"]
                        )
                    ),
                    "right_items": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "id": Schema(type="string"),
                                "text": Schema(type="string")
                            },
                            required=["id", "text"]
                        )
                    ),
                    "mappings": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "left_id": Schema(type="string"),
                                "right_ids": Schema(type="array", items=Schema(type="string"))
                            },
                            required=["left_id", "right_ids"]
                        )
                    ),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "prompt", "left_items", "right_items", "mappings", "rationale", "teaching_note", "success_criteria"]
            )
        ),
        
        # Sequencing Activities
        "sequencing_activity": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "instruction": Schema(type="string"),
                    "items": Schema(type="array", items=Schema(type="string")),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "instruction", "items", "rationale", "teaching_note", "success_criteria"]
            )
        ),
        
        # Categorization Activities
        "categorization_activity": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "instruction": Schema(type="string"),
                    "categories": Schema(type="array", items=Schema(type="string")),
                    "categorization_items": Schema(
                        type="array",
                        items=Schema(
                            type="object",
                            properties={
                                "item_text": Schema(type="string"),
                                "correct_category": Schema(type="string")
                            },
                            required=["item_text", "correct_category"]
                        )
                    ),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "instruction", "categories", "categorization_items", "rationale", "teaching_note", "success_criteria"]
            )
        ),
        
        # Scenario Questions
        "scenario_question": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "scenario": Schema(type="string"),
                    "scenario_question": Schema(type="string"),
                    "scenario_answer": Schema(type="string"),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "scenario", "scenario_question", "scenario_answer", "rationale", "teaching_note", "success_criteria"]
            )
        ),
        
        # Short Answer Questions
        "short_answer": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "id": Schema(type="string"),
                    "difficulty": Schema(type="string", enum=["easy", "medium", "hard"]),
                    "grade_level": Schema(type="string"),
                    "question": Schema(type="string"),
                    "rationale": Schema(type="string"),
                    "teaching_note": Schema(type="string"),
                    "success_criteria": Schema(type="array", items=Schema(type="string"))
                },
                required=["id", "difficulty", "grade_level", "question", "rationale", "teaching_note", "success_criteria"]
            )
        ),

        # Live Interaction Problems
        "live_interaction": Schema(
            type="array",
            items=LIVE_INTERACTION_SCHEMA
        )
    }
)

# Problem Review Schema
PROBLEM_REVIEW_SCHEMA = Schema(
    type="object",
    properties={
        "observation": Schema(
            type="object",
            properties={
                "canvas_description": Schema(
                    type="string",
                    description="Detailed description of what is seen in the student's canvas solution"
                ),
                "selected_answer": Schema(
                    type="string",
                    description="The multiple-choice answer selected by the student (if applicable)"
                ),
                "work_shown": Schema(
                    type="string",
                    description="Description of additional work or steps shown by the student"
                )
            },
            required=["canvas_description", "selected_answer", "work_shown"]
        ),
        "analysis": Schema(
            type="object",
            properties={
                "understanding": Schema(
                    type="string",
                    description="Analysis of the student's conceptual understanding"
                ),
                "approach": Schema(
                    type="string",
                    description="Description of the problem-solving approach used by the student"
                ),
                "accuracy": Schema(
                    type="string",
                    description="Comparison of student's answer against the expected answer"
                ),
                "creativity": Schema(
                    type="string",
                    description="Note any creative or alternative valid solutions"
                )
            },
            required=["understanding", "approach", "accuracy", "creativity"]
        ),
        "evaluation": Schema(
            type="object",
            properties={
                "score": Schema(
                    type="number",
                    description="Numerical score from 1-10",
                    minimum=1,
                    maximum=10
                ),
                "justification": Schema(
                    type="string",
                    description="Brief explanation of the score given"
                )
            },
            required=["score", "justification"]
        ),
        "feedback": Schema(
            type="object",
            properties={
                "praise": Schema(
                    type="string",
                    description="Specific praise for what the student did well"
                ),
                "guidance": Schema(
                    type="string",
                    description="Age-appropriate suggestions for improvement"
                ),
                "encouragement": Schema(
                    type="string",
                    description="Positive reinforcement message"
                ),
                "next_steps": Schema(
                    type="string",
                    description="Simple, actionable next steps for the student"
                )
            },
            required=["praise", "guidance", "encouragement", "next_steps"]
        )
    },
    required=["observation", "analysis", "evaluation", "feedback"]
)

# Context Primitives Schema - For generating diverse problem contexts
CONTEXT_PRIMITIVES_SCHEMA = Schema(
    type="object",
    properties={
        # Object/Entity Primitives
        "concrete_objects": Schema(
            type="array",
            items=Schema(type="string"),
            description="15-20 countable, manipulable items appropriate for the skill/grade level"
        ),
        "living_things": Schema(
            type="array",
            items=Schema(type="string"),
            description="8-12 animals, plants, people relevant to the learning context"
        ),
        "locations": Schema(
            type="array",
            items=Schema(type="string"),
            description="6-10 settings, places, environments where concepts apply"
        ),
        "tools_materials": Schema(
            type="array",
            items=Schema(type="string"),
            description="Instruments, equipment, materials used in educational contexts"
        ),

        # Relationship Primitives
        "comparison_pairs": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "attribute": Schema(type="string", description="What is being compared (size, quantity, etc.)"),
                    "examples": Schema(type="array", items=Schema(type="string"), description="Specific items that can be compared")
                },
                required=["attribute", "examples"]
            ),
            description="Items that can be compared (bigger/smaller, more/less, faster/slower)"
        ),
        "categories": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "category_name": Schema(type="string", description="Name of the category"),
                    "items": Schema(type="array", items=Schema(type="string"), description="4-6 items belonging to this category")
                },
                required=["category_name", "items"]
            ),
            description="3-5 categories with their members for classification activities"
        ),
        "sequences": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "sequence_type": Schema(type="string", description="Type of sequence (time, process, size, etc.)"),
                    "items": Schema(type="array", items=Schema(type="string"), description="Items in correct sequential order")
                },
                required=["sequence_type", "items"]
            ),
            description="2-4 ordered sets for sequencing activities"
        ),

        # Action Primitives
        "actions": Schema(
            type="array",
            items=Schema(type="string"),
            description="Common verbs and actions appropriate for the learning context"
        ),

        # Attribute Primitives
        "attributes": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "attribute_name": Schema(type="string", description="Name of the attribute (color, size, shape, etc.)"),
                    "values": Schema(type="array", items=Schema(type="string"), description="Possible values for this attribute")
                },
                required=["attribute_name", "values"]
            ),
            description="Physical and conceptual attributes with their possible values"
        ),

        # Narrative Primitives
        "characters": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "name": Schema(type="string", description="Character's name"),
                    "age": Schema(type="string", description="Character's age or age group"),
                    "role": Schema(type="string", description="Character's role or occupation")
                },
                required=["name", "age", "role"]
            ),
            description="5-8 age-appropriate characters for scenarios"
        ),
        "scenarios": Schema(
            type="array",
            items=Schema(type="string"),
            description="8-12 realistic situations where this skill applies in daily life"
        ),

        # Subject-Specific Primitives (populated based on subject)
        "subject_specific": Schema(
            type="object",
            properties={
                "math_contexts": Schema(
                    type="array",
                    items=Schema(type="string"),
                    description="Math-specific contexts (measurement, counting, shapes, etc.)"
                ),
                "science_phenomena": Schema(
                    type="array",
                    items=Schema(type="string"),
                    description="Observable scientific phenomena appropriate for grade level"
                ),
                "social_studies_elements": Schema(
                    type="array",
                    items=Schema(type="string"),
                    description="Community, cultural, and social concepts"
                ),
                "language_arts_elements": Schema(
                    type="array",
                    items=Schema(type="string"),
                    description="Reading, writing, speaking, and listening contexts"
                )
            },
            description="Subject-specific primitive elements"
        )
    },
    required=["concrete_objects", "living_things", "locations", "scenarios", "characters"]
)

# ============================================================================
# INDIVIDUAL VISUAL DATA SCHEMAS - Used in Step 2 to generate specific visuals
# ============================================================================
# NOTE: These schemas are defined here after CONTEXT_PRIMITIVES_SCHEMA
# They are used by the visual generation pipeline in problems.py

# Math Visual Schemas
NUMBER_LINE_SCHEMA = Schema(
    type="object",
    properties={
        "min": Schema(type="number", description="Minimum value on number line"),
        "max": Schema(type="number", description="Maximum value on number line"),
        "step": Schema(type="number", description="Step increment between numbers"),
        "markers": Schema(type="array", items=Schema(type="number"), description="Numbers to mark on the line"),
        "markerColors": Schema(type="array", items=Schema(type="string"), description="Colors for each marker"),
        "markerLabels": Schema(type="array", items=Schema(type="string"), description="Labels for markers"),
        "highlightRange": Schema(
            type="object",
            properties={
                "start": Schema(type="number"),
                "end": Schema(type="number"),
                "color": Schema(type="string")
            }
        ),
        "showArrows": Schema(type="boolean", description="Show arrows at ends of number line")
    },
    required=["min", "max", "step"]
)

FRACTION_CIRCLES_SCHEMA = Schema(
    type="object",
    properties={
        "circles": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "segments": Schema(type="integer", description="Total number of segments"),
                    "shaded": Schema(type="integer", description="Number of shaded segments"),
                    "label": Schema(type="string", description="Fraction label (e.g., '1/4')")
                },
                required=["segments", "shaded", "label"]
            )
        ),
        "shadedColor": Schema(type="string", description="Color for shaded segments"),
        "unshadedColor": Schema(type="string", description="Color for unshaded segments")
    },
    required=["circles"]
)

BAR_MODEL_SCHEMA = Schema(
    type="object",
    properties={
        "bars": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "label": Schema(type="string", description="Label for this bar"),
                    "value": Schema(type="number", description="Numeric value represented by bar"),
                    "color": Schema(type="string", description="Color of the bar (hex or CSS color)")
                },
                required=["label", "value", "color"]
            )
        ),
        "showValues": Schema(type="boolean", description="Display numeric values on bars"),
        "orientation": Schema(type="string", enum=["horizontal", "vertical"], description="Bar orientation")
    },
    required=["bars"]
)

GEOMETRIC_SHAPE_SCHEMA = Schema(
    type="object",
    properties={
        "shape": Schema(
            type="string",
            enum=["rectangle", "square", "circle", "triangle"],
            description="Type of geometric shape"
        ),
        "width": Schema(type="number", description="Width dimension"),
        "height": Schema(type="number", description="Height dimension"),
        "unit": Schema(type="string", description="Unit of measurement (e.g., 'cm', 'in')"),
        "color": Schema(type="string", description="Fill color for shape"),
        "showDimensions": Schema(type="boolean", description="Display dimension labels"),
        "showGrid": Schema(type="boolean", description="Show grid overlay for area counting")
    },
    required=["shape", "width", "height"]
)

BASE_TEN_BLOCKS_SCHEMA = Schema(
    type="object",
    properties={
        "hundreds": Schema(type="integer", description="Number of hundred blocks"),
        "tens": Schema(type="integer", description="Number of ten rods"),
        "ones": Schema(type="integer", description="Number of one units"),
        "showLabels": Schema(type="boolean", description="Display labels for each place value")
    },
    required=["hundreds", "tens", "ones"]
)

# Science Visual Schemas
LABELED_DIAGRAM_SCHEMA = Schema(
    type="object",
    properties={
        "imageUrl": Schema(type="string", description="URL to diagram image"),
        "labels": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "text": Schema(type="string", description="Label text"),
                    "x": Schema(type="number", description="X position (percentage)"),
                    "y": Schema(type="number", description="Y position (percentage)"),
                    "lineToX": Schema(type="number", description="X coordinate where line points to"),
                    "lineToY": Schema(type="number", description="Y coordinate where line points to")
                },
                required=["text", "x", "y"]
            )
        )
    },
    required=["imageUrl", "labels"]
)

CYCLE_DIAGRAM_SCHEMA = Schema(
    type="object",
    properties={
        "stages": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "name": Schema(type="string", description="Stage name"),
                    "icon": Schema(type="string", description="Emoji or icon representing stage"),
                    "description": Schema(type="string", description="Brief description of stage")
                },
                required=["name", "description"]
            )
        ),
        "arrangement": Schema(type="string", enum=["circular", "linear"], description="Layout arrangement")
    },
    required=["stages"]
)

TREE_DIAGRAM_SCHEMA = Schema(
    type="object",
    properties={
        "root": Schema(
            type="object",
            properties={
                "label": Schema(type="string", description="Root node label"),
                "icon": Schema(type="string", description="Optional icon for root"),
                "children": Schema(
                    type="array",
                    items=Schema(type="object"),
                    description="Child nodes (recursive structure)"
                )
            },
            required=["label"]
        )
    },
    required=["root"]
)

LINE_GRAPH_SCHEMA = Schema(
    type="object",
    properties={
        "title": Schema(type="string", description="Graph title"),
        "xLabel": Schema(type="string", description="X-axis label"),
        "yLabel": Schema(type="string", description="Y-axis label"),
        "points": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "x": Schema(type="number"),
                    "y": Schema(type="number")
                },
                required=["x", "y"]
            )
        )
    },
    required=["title", "xLabel", "yLabel", "points"]
)

THERMOMETER_SCHEMA = Schema(
    type="object",
    properties={
        "min": Schema(type="number", description="Minimum temperature"),
        "max": Schema(type="number", description="Maximum temperature"),
        "unit": Schema(type="string", enum=["°F", "°C"], description="Temperature unit"),
        "currentValue": Schema(type="number", description="Current temperature reading"),
        "markers": Schema(type="array", items=Schema(type="number"), description="Important temperature markers"),
        "markerLabels": Schema(type="array", items=Schema(type="string"), description="Labels for markers")
    },
    required=["min", "max", "unit", "currentValue"]
)

# Language Arts Visual Schemas
SENTENCE_DIAGRAM_SCHEMA = Schema(
    type="object",
    properties={
        "sentence": Schema(type="string", description="The sentence to diagram"),
        "parts": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "word": Schema(type="string", description="Word in sentence"),
                    "type": Schema(
                        type="string",
                        enum=["noun", "verb", "adjective", "adverb", "article", "preposition", "pronoun", "conjunction"],
                        description="Part of speech"
                    ),
                    "color": Schema(type="string", description="Color for this part of speech")
                },
                required=["word", "type", "color"]
            )
        )
    },
    required=["sentence", "parts"]
)

STORY_SEQUENCE_SCHEMA = Schema(
    type="object",
    properties={
        "events": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "stage": Schema(type="string", enum=["Beginning", "Middle", "End"], description="Story stage"),
                    "text": Schema(type="string", description="Event description"),
                    "image": Schema(type="string", description="Emoji or icon for event")
                },
                required=["stage", "text"]
            )
        ),
        "layout": Schema(type="string", enum=["horizontal", "vertical"], description="Layout direction")
    },
    required=["events"]
)

WORD_WEB_SCHEMA = Schema(
    type="object",
    properties={
        "center": Schema(
            type="object",
            properties={
                "word": Schema(type="string", description="Central word"),
                "size": Schema(type="string", enum=["small", "medium", "large"], description="Display size")
            },
            required=["word"]
        ),
        "branches": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "word": Schema(type="string", description="Related word"),
                    "color": Schema(type="string", description="Branch color")
                },
                required=["word"]
            )
        )
    },
    required=["center", "branches"]
)

CHARACTER_WEB_SCHEMA = Schema(
    type="object",
    properties={
        "character": Schema(
            type="object",
            properties={
                "name": Schema(type="string", description="Character name"),
                "icon": Schema(type="string", description="Emoji or icon for character")
            },
            required=["name"]
        ),
        "traits": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "trait": Schema(type="string", description="Character trait"),
                    "evidence": Schema(type="string", description="Evidence from text")
                },
                required=["trait", "evidence"]
            )
        )
    },
    required=["character", "traits"]
)

VENN_DIAGRAM_SCHEMA = Schema(
    type="object",
    properties={
        "circles": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "label": Schema(type="string", description="Circle label"),
                    "color": Schema(type="string", description="Circle color"),
                    "items": Schema(type="array", items=Schema(type="string"), description="Items unique to this circle")
                },
                required=["label", "items"]
            )
        ),
        "overlap": Schema(type="array", items=Schema(type="string"), description="Items in the overlap")
    },
    required=["circles", "overlap"]
)

# ABCs Visual Schemas
LETTER_TRACING_SCHEMA = Schema(
    type="object",
    properties={
        "letter": Schema(type="string", description="Letter to trace"),
        "case": Schema(type="string", enum=["uppercase", "lowercase"], description="Letter case"),
        "showDirectionArrows": Schema(type="boolean", description="Show stroke direction arrows"),
        "showDottedGuide": Schema(type="boolean", description="Show dotted tracing guide"),
        "strokeOrder": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "path": Schema(type="string", description="SVG path data"),
                    "number": Schema(type="integer", description="Stroke order number")
                },
                required=["path", "number"]
            )
        )
    },
    required=["letter", "case"]
)

LETTER_PICTURE_SCHEMA = Schema(
    type="object",
    properties={
        "letter": Schema(type="string", description="Focus letter"),
        "items": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "name": Schema(type="string", description="Item name"),
                    "image": Schema(type="string", description="Emoji or image representing item"),
                    "highlight": Schema(type="boolean", description="True if starts with focus letter")
                },
                required=["name", "image", "highlight"]
            )
        )
    },
    required=["letter", "items"]
)

ALPHABET_SEQUENCE_SCHEMA = Schema(
    type="object",
    properties={
        "sequence": Schema(type="array", items=Schema(type="string"), description="Sequence with blanks as '_'"),
        "missing": Schema(type="array", items=Schema(type="string"), description="Letters that are missing"),
        "highlightMissing": Schema(type="boolean", description="Highlight the missing positions"),
        "showImages": Schema(type="boolean", description="Show images for letters")
    },
    required=["sequence", "missing"]
)

RHYMING_PAIRS_SCHEMA = Schema(
    type="object",
    properties={
        "pairs": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "word1": Schema(type="string", description="First rhyming word"),
                    "image1": Schema(type="string", description="Emoji for first word"),
                    "word2": Schema(type="string", description="Second rhyming word"),
                    "image2": Schema(type="string", description="Emoji for second word")
                },
                required=["word1", "word2"]
            )
        ),
        "showConnectingLines": Schema(type="boolean", description="Draw lines connecting pairs")
    },
    required=["pairs"]
)

SIGHT_WORD_CARD_SCHEMA = Schema(
    type="object",
    properties={
        "word": Schema(type="string", description="The sight word"),
        "fontSize": Schema(type="string", enum=["small", "medium", "large"], description="Text size"),
        "showInContext": Schema(type="boolean", description="Show word in a sentence"),
        "sentence": Schema(type="string", description="Example sentence using the word"),
        "highlightWord": Schema(type="boolean", description="Highlight the word in sentence")
    },
    required=["word"]
)

SOUND_SORT_SCHEMA = Schema(
    type="object",
    properties={
        "targetSound": Schema(type="string", description="The sound being sorted (e.g., 'short a')"),
        "categories": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "label": Schema(type="string", description="Category label"),
                    "words": Schema(type="array", items=Schema(type="string"), description="Words in category")
                },
                required=["label", "words"]
            )
        ),
        "showPictures": Schema(type="boolean", description="Show pictures for words")
    },
    required=["targetSound", "categories"]
)

# ============================================================================
# FOUNDATIONAL VISUAL PRIMITIVES - Simple Illustrations for Early Learning
# ============================================================================
# These are flexible, illustrative primitives designed for K-1 content
# Use BEFORE specialized data visualization primitives

OBJECT_COLLECTION_SCHEMA = Schema(
    type="object",
    properties={
        "instruction": Schema(
            type="string",
            description="Optional scene-setting text describing what is shown (e.g., 'Aisha starts with 2 crackers and gets 2 more'). NEVER use directive language like 'Count', 'Show', 'Find', 'How many' - just describe the SCENARIO being illustrated."
        ),
        "items": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "name": Schema(type="string", description="Name of the object type (e.g., 'apple', 'ball', 'block'). Use the same name for all instances of the same object type."),
                    "count": Schema(type="integer", description="Total number of this specific object type to display in this collection."),
                    "icon": Schema(type="string", description="Suggested emoji or icon identifier (e.g., '🍎', '⚽️', '🧱')."),
                    "attributes": Schema(
                        type="array",
                        items=Schema(type="string"),
                        description="Visual attributes like color or pattern (e.g., ['red', 'shiny'], ['polka dots'])."
                    )
                },
                required=["name", "count"]
            ),
            description="Array of different object types in this collection. Each item represents ONE type of object with its total count. Example: [{name: 'apple', count: 5}, {name: 'orange', count: 3}] shows 5 apples AND 3 oranges in this single collection."
        ),
        "layout": Schema(
            type="string",
            enum=["grid", "scattered", "row"],
            default="grid",
            description="Suggested layout for the frontend to arrange the objects."
        )
    },
    required=["items"]
)

COMPARISON_PANEL_SCHEMA = Schema(
    type="object",
    properties={
        "panels": Schema(
            type="array",
            minItems=2,
            maxItems=2,
            items=Schema(
                type="object",
                properties={
                    "label": Schema(type="string", description="Label identifying what/who this panel represents (e.g., 'Maya's Apples', 'Tom's Tower', 'Group A'). Each panel represents ONE distinct entity being compared."),
                    "collection": OBJECT_COLLECTION_SCHEMA
                },
                required=["label", "collection"]
            ),
            description="EXACTLY 2 panels for side-by-side comparison. CRITICAL: Each panel represents ONE separate group/person/entity. Panel 1 shows items belonging to the first entity, Panel 2 shows items belonging to the second entity. DO NOT put items from both entities in one panel. Example: If comparing Maya's 3 apples to Tom's 5 oranges, Panel 1 = Maya's collection with 3 apples, Panel 2 = Tom's collection with 5 oranges."
        )
    },
    required=["panels"]
)

# Visual Type Metadata - Guidance for when to use each visual primitive
VISUAL_TYPE_METADATA = {
    # Foundational Visuals (USE FIRST for K-1)
    "object-collection": {
        "best_for": "Counting discrete objects, showing groups of items, simple identification tasks, 'how many' questions",
        "avoid_for": "Abstract numerical data, complex data relationships, multi-step comparisons",
        "example": "Show 5 purple balls, display 3 apples and 2 bananas, count the stars"
    },
    "comparison-panel": {
        "best_for": "Side-by-side comparison of two object groups, 'who has more/less' questions, direct visual comparison of countable items",
        "avoid_for": "Abstract totals without visual objects, single group displays, more than 2 groups",
        "example": "Maya has 3 cookies vs Tom has 5 cookies (show actual cookies in each panel)"
    },

    # Math Visuals
    "bar-model": {
        "best_for": "Comparing ABSTRACT quantities/totals, part-whole relationships with large numbers, data visualization",
        "avoid_for": "Counting discrete physical objects (use object-collection instead), problems where actual objects are more intuitive",
        "example": "Team A scored 15 points vs Team B scored 12 points (abstract totals, not physical items)"
    },
    "number-line": {
        "best_for": "Ordering numbers, skip counting, number sequences, showing intervals or ranges",
        "avoid_for": "Discrete comparisons without sequence, problems not involving order",
        "example": "Finding numbers between 5 and 10, counting by 2s"
    },
    "base-ten-blocks": {
        "best_for": "Place value understanding, regrouping, representing multi-digit numbers visually",
        "avoid_for": "Simple single-digit problems, non-base-10 concepts",
        "example": "Showing 23 as 2 tens and 3 ones"
    },
    "fraction-circles": {
        "best_for": "Part-whole fractions, comparing fraction sizes, visual fraction equivalence",
        "avoid_for": "Whole number problems, complex fraction operations beyond kindergarten level",
        "example": "Showing 1/4 of a circle shaded"
    },
    "geometric-shape": {
        "best_for": "Shape identification, area/perimeter concepts, spatial reasoning",
        "avoid_for": "Problems not involving shapes or spatial properties",
        "example": "Identifying a rectangle with labeled dimensions"
    },

    # Science Visuals
    "labeled-diagram": {
        "best_for": "Showing parts of complex objects, anatomy, multi-component systems, scientific structures",
        "avoid_for": "Simple quantity comparisons, basic counting, problems without structural components",
        "example": "Parts of a plant (roots, stem, leaves), parts of an insect"
    },
    "cycle-diagram": {
        "best_for": "Repeating processes, life cycles, circular sequences that return to start",
        "avoid_for": "Linear sequences, one-time events, simple before/after scenarios",
        "example": "Water cycle, butterfly life cycle"
    },
    "tree-diagram": {
        "best_for": "Hierarchical relationships, classification systems, branching decisions",
        "avoid_for": "Non-hierarchical groupings, simple lists, sequential processes",
        "example": "Animal classification (mammals → dogs/cats), family trees"
    },
    "line-graph": {
        "best_for": "Showing change over time, trends, continuous data relationships",
        "avoid_for": "Static comparisons, categorical data, problems without continuous variables",
        "example": "Temperature throughout the day, plant growth over weeks"
    },
    "thermometer": {
        "best_for": "Temperature-specific problems, reading scales, comparing hot/cold",
        "avoid_for": "Non-temperature measurements, abstract concepts",
        "example": "Reading temperature on a thermometer, comparing winter vs summer temps"
    },

    # Language Arts Visuals
    "sentence-diagram": {
        "best_for": "Parts of speech identification, sentence structure analysis",
        "avoid_for": "Vocabulary without grammar context, simple word recognition",
        "example": "Breaking down 'The cat ran' into noun, article, verb"
    },
    "story-sequence": {
        "best_for": "Narrative structure (beginning/middle/end), event ordering in stories",
        "avoid_for": "Non-narrative texts, single-event descriptions",
        "example": "Sequencing events in a story about a trip to the park"
    },
    "word-web": {
        "best_for": "Vocabulary expansion, word associations, brainstorming related concepts",
        "avoid_for": "Grammar exercises, problems requiring specific definitions",
        "example": "Words related to 'ocean' (waves, fish, sand, shells)"
    },
    "character-web": {
        "best_for": "Character analysis, trait identification with evidence",
        "avoid_for": "Plot summaries, settings, non-character-focused questions",
        "example": "Describing a character's bravery with story evidence"
    },
    "venn-diagram": {
        "best_for": "Comparing/contrasting two items, showing similarities and differences",
        "avoid_for": "Single-item descriptions, more than 2-way comparisons (too complex for K)",
        "example": "Comparing cats and dogs (both pets, cats meow, dogs bark)"
    },

    # ABCs/Early Literacy Visuals
    "letter-tracing": {
        "best_for": "Letter formation practice, handwriting instruction, stroke order",
        "avoid_for": "Letter recognition without writing, phonics without letter formation",
        "example": "Tracing uppercase 'A' with directional arrows"
    },
    "letter-picture": {
        "best_for": "Letter-sound correspondence, initial sound identification, phonics",
        "avoid_for": "Letter formation, problems not involving initial sounds",
        "example": "Pictures of Apple, Ant, Alligator for letter 'A'"
    },
    "alphabet-sequence": {
        "best_for": "Alphabetical order, missing letter identification, sequence completion",
        "avoid_for": "Single letter recognition, phonics without order context",
        "example": "A, B, _, D (finding missing C)"
    },
    "rhyming-pairs": {
        "best_for": "Rhyme identification, phonological awareness, word families",
        "avoid_for": "Non-rhyming word problems, letter recognition",
        "example": "Matching 'cat' with 'hat', showing pictures"
    },
    "sight-word-card": {
        "best_for": "High-frequency word recognition, sight word practice in context",
        "avoid_for": "Decodable words, complex sentences beyond sight word focus",
        "example": "Showing 'the' in large text with sentence 'The cat runs'"
    },
    "sound-sort": {
        "best_for": "Phoneme categorization, sorting by initial/final sounds, vowel sounds",
        "avoid_for": "Letter naming, problems not involving sound discrimination",
        "example": "Sorting words by short 'a' vs short 'e' sounds"
    }
}

# Mapping of visual types to their schemas
VISUAL_TYPE_TO_SCHEMA = {
    # NEW: Card grid for live interactions
    "card-grid": CARD_GRID_SCHEMA,
    # NEW Foundational Primitives
    "object-collection": OBJECT_COLLECTION_SCHEMA,
    "comparison-panel": COMPARISON_PANEL_SCHEMA,
    # Math primitives
    "number-line": NUMBER_LINE_SCHEMA,
    "fraction-circles": FRACTION_CIRCLES_SCHEMA,
    "bar-model": BAR_MODEL_SCHEMA,
    "geometric-shape": GEOMETRIC_SHAPE_SCHEMA,
    "base-ten-blocks": BASE_TEN_BLOCKS_SCHEMA,
    # Science primitives
    "labeled-diagram": LABELED_DIAGRAM_SCHEMA,
    "cycle-diagram": CYCLE_DIAGRAM_SCHEMA,
    "tree-diagram": TREE_DIAGRAM_SCHEMA,
    "line-graph": LINE_GRAPH_SCHEMA,
    "thermometer": THERMOMETER_SCHEMA,
    # Language Arts primitives
    "sentence-diagram": SENTENCE_DIAGRAM_SCHEMA,
    "story-sequence": STORY_SEQUENCE_SCHEMA,
    "word-web": WORD_WEB_SCHEMA,
    "character-web": CHARACTER_WEB_SCHEMA,
    "venn-diagram": VENN_DIAGRAM_SCHEMA,
    # ABCs primitives
    "letter-tracing": LETTER_TRACING_SCHEMA,
    "letter-picture": LETTER_PICTURE_SCHEMA,
    "alphabet-sequence": ALPHABET_SEQUENCE_SCHEMA,
    "rhyming-pairs": RHYMING_PAIRS_SCHEMA,
    "sight-word-card": SIGHT_WORD_CARD_SCHEMA,
    "sound-sort": SOUND_SORT_SCHEMA
}