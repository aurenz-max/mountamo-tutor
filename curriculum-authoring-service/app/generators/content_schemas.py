"""
JSON schemas for AI-generated content structures
Simplified version for curriculum authoring service
"""

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

# Context Primitives Schema
CONTEXT_PRIMITIVES_SCHEMA = Schema(
    type="object",
    properties={
        "concrete_objects": Schema(
            type="array",
            items=Schema(type="string"),
            description="15-20 concrete objects relevant to the subskill and grade level"
        ),
        "living_things": Schema(
            type="array",
            items=Schema(type="string"),
            description="8-12 living things (animals, plants, people) appropriate for grade level"
        ),
        "locations": Schema(
            type="array",
            items=Schema(type="string"),
            description="6-10 familiar locations/settings where this skill applies"
        ),
        "tools": Schema(
            type="array",
            items=Schema(type="string"),
            description="5-8 tools/materials used in educational contexts"
        ),
        "characters": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "name": Schema(type="string", description="Character name"),
                    "age": Schema(type="integer", description="Character age"),
                    "role": Schema(type="string", description="Character role")
                },
                required=["name"]
            ),
            description="5-8 diverse characters with names, ages, and roles"
        ),
        "scenarios": Schema(
            type="array",
            items=Schema(type="string"),
            description="8-12 realistic scenarios where this skill applies in daily life"
        ),
        "comparison_pairs": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "attribute": Schema(type="string", description="Attribute being compared"),
                    "examples": Schema(
                        type="array",
                        items=Schema(type="string"),
                        description="Example items that can be compared"
                    )
                },
                required=["attribute", "examples"]
            ),
            description="3-5 comparison pairs with specific examples for each attribute"
        ),
        "categories": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "name": Schema(type="string", description="Category name"),
                    "items": Schema(
                        type="array",
                        items=Schema(type="string"),
                        description="Items in this category"
                    )
                },
                required=["name", "items"]
            ),
            description="3-5 categories with 4-6 items each for sorting activities"
        ),
        "sequences": Schema(
            type="array",
            items=Schema(
                type="array",
                items=Schema(type="string")
            ),
            description="2-4 sequences appropriate for the learning objective"
        ),
        "action_words": Schema(
            type="array",
            items=Schema(type="string"),
            description="8-12 action words relevant to the skill"
        ),
        "attributes": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "name": Schema(type="string", description="Attribute name"),
                    "values": Schema(
                        type="array",
                        items=Schema(type="string"),
                        description="Possible values for this attribute"
                    )
                },
                required=["name", "values"]
            ),
            description="4-6 attributes with multiple values each"
        )
    },
    required=[
        "concrete_objects", "living_things", "locations", "tools", "characters",
        "scenarios", "comparison_pairs", "categories", "sequences", "action_words", "attributes"
    ]
)

# Visual Schema Types (for recommendations)
VISUAL_SCHEMA_TYPES = {
    "foundational": ["object-collection", "comparison-panel"],
    "math": ["bar-model", "number-line", "base-ten-blocks", "fraction-circles", "geometric-shape"],
    "science": ["labeled-diagram", "cycle-diagram", "tree-diagram", "line-graph", "thermometer"],
    "language_arts": ["sentence-diagram", "story-sequence", "word-web", "character-web", "venn-diagram"],
    "abcs": ["letter-tracing", "letter-picture", "alphabet-sequence", "rhyming-pairs", "sight-word-card", "sound-sort"]
}

ALL_VISUAL_SCHEMAS = [
    schema
    for schemas in VISUAL_SCHEMA_TYPES.values()
    for schema in schemas
]
