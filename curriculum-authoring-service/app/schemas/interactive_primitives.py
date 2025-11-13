"""
Shared Interactive Primitive Schemas for Content Generation

This module provides centralized schema definitions for all interactive primitive types
used across the 3-tier content generation system. This ensures consistency and reduces
duplication across SectionGenerator, ContentIntegrator, and ReadingContentGenerator.
"""

from google.genai.types import Schema


def get_alert_schema() -> dict:
    """Alert/callout boxes for important information"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["alert"], "description": "Primitive type identifier"},
                "style": {"type": "string", "enum": ["info", "warning", "success", "tip"], "description": "Alert visual style"},
                "title": {"type": "string", "description": "Alert title/heading"},
                "content": {"type": "string", "description": "Alert body content"}
            },
            "required": ["type", "style", "title", "content"]
        }
    }


def get_expandable_schema() -> dict:
    """Expandable sections for optional deeper information"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["expandable"], "description": "Primitive type identifier"},
                "title": {"type": "string", "description": "Expandable section title"},
                "content": {"type": "string", "description": "Hidden content revealed on expansion"}
            },
            "required": ["type", "title", "content"]
        }
    }


def get_quiz_schema() -> dict:
    """Quick knowledge check questions"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["quiz"], "description": "Primitive type identifier"},
                "question": {"type": "string", "description": "Quiz question text"},
                "answer": {"type": "string", "description": "Correct answer"},
                "explanation": {"type": "string", "description": "Optional explanation of the answer"}
            },
            "required": ["type", "question", "answer"]
        }
    }


def get_definition_schema() -> dict:
    """Inline term definitions for contextual learning"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["definition"], "description": "Primitive type identifier"},
                "term": {"type": "string", "description": "Term to be defined"},
                "definition": {"type": "string", "description": "Definition of the term"}
            },
            "required": ["type", "term", "definition"]
        }
    }


def get_checklist_schema() -> dict:
    """Progress tracking checklist items"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["checklist"], "description": "Primitive type identifier"},
                "text": {"type": "string", "description": "Checklist item text"},
                "completed": {"type": "boolean", "description": "Initial completion state"}
            },
            "required": ["type", "text"]
        }
    }


def get_table_schema() -> dict:
    """Structured data tables"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["table"], "description": "Primitive type identifier"},
                "headers": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Table column headers"
                },
                "rows": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "description": "Table row data (array of arrays)"
                }
            },
            "required": ["type", "headers", "rows"]
        }
    }


def get_keyvalue_schema() -> dict:
    """Key-value pairs for important facts and statistics"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["keyvalue"], "description": "Primitive type identifier"},
                "key": {"type": "string", "description": "Fact or statistic label"},
                "value": {"type": "string", "description": "Corresponding value or data"}
            },
            "required": ["type", "key", "value"]
        }
    }


def get_interactive_timeline_schema() -> dict:
    """Interactive timelines to visualize sequences of events"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["interactive_timeline"], "description": "Primitive type identifier"},
                "title": {"type": "string", "description": "Title of the timeline"},
                "events": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "date": {"type": "string", "description": "Date or time point of the event"},
                            "title": {"type": "string", "description": "Title of the event"},
                            "description": {"type": "string", "description": "Detailed description of the event"}
                        },
                        "required": ["date", "title", "description"]
                    },
                    "description": "A list of events on the timeline"
                }
            },
            "required": ["type", "title", "events"]
        }
    }


def get_carousel_schema() -> dict:
    """Carousels or sliders for displaying a sequence of images or cards"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["carousel"], "description": "Primitive type identifier"},
                "title": {"type": "string", "description": "Optional title for the carousel"},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "image_url": {"type": "string", "description": "URL for the carousel image"},
                            "alt_text": {"type": "string", "description": "Accessibility text for the image"},
                            "caption": {"type": "string", "description": "A brief caption for the image"},
                            "description": {"type": "string", "description": "Optional detailed description"}
                        },
                        "required": ["image_url", "alt_text"]
                    }
                }
            },
            "required": ["type", "items"]
        }
    }


def get_flip_card_schema() -> dict:
    """Interactive flip cards for self-assessment and vocabulary"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["flip_card"], "description": "Primitive type identifier"},
                "front_content": {"type": "string", "description": "Content for the front of the card"},
                "back_content": {"type": "string", "description": "Content for the back of the card"}
            },
            "required": ["type", "front_content", "back_content"]
        }
    }


def get_categorization_schema() -> dict:
    """Activities where users sort items into categories"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["categorization"], "description": "Primitive type identifier"},
                "instruction": {"type": "string", "description": "Instruction for the activity"},
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "The categories to sort items into"
                },
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "item_text": {"type": "string", "description": "The text of the item to be categorized"},
                            "correct_category": {"type": "string", "description": "The correct category for this item"}
                        },
                        "required": ["item_text", "correct_category"]
                    },
                    "description": "The items that need to be sorted"
                }
            },
            "required": ["type", "instruction", "categories", "items"]
        }
    }


def get_fill_in_the_blank_schema() -> dict:
    """Fill-in-the-blank exercises to test knowledge in context"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["fill_in_the_blank"], "description": "Primitive type identifier"},
                "sentence": {"type": "string", "description": "The sentence with a blank, represented by '__'"},
                "correct_answer": {"type": "string", "description": "The word that correctly fills the blank"},
                "hint": {"type": "string", "description": "Optional hint for the student"}
            },
            "required": ["type", "sentence", "correct_answer"]
        }
    }


def get_scenario_question_schema() -> dict:
    """Questions based on real-world scenarios to promote application of knowledge"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["scenario_question"], "description": "Primitive type identifier"},
                "scenario": {"type": "string", "description": "A real-world scenario or problem description"},
                "question": {"type": "string", "description": "The question related to the scenario"},
                "answer_options": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "A list of possible answers for multiple choice scenarios"
                },
                "correct_answer": {"type": "string", "description": "The correct answer"},
                "explanation": {"type": "string", "description": "Explanation of why the answer is correct"}
            },
            "required": ["type", "scenario", "question", "correct_answer"]
        }
    }


def get_tabbed_content_schema() -> dict:
    """Tabbed interface for comparing and contrasting related topics"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["tabbed_content"], "description": "Primitive type identifier"},
                "tabs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "The title of the tab"},
                            "content": {"type": "string", "description": "The content within the tab"}
                        },
                        "required": ["title", "content"]
                    },
                    "description": "A list of tab objects, each with a title and content."
                }
            },
            "required": ["type", "tabs"]
        }
    }


def get_matching_activity_schema() -> dict:
    """Interactive matching games to connect concepts"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["matching_activity"], "description": "Primitive type identifier"},
                "instruction": {"type": "string", "description": "Instruction for the activity, e.g., 'Match the term to its definition.'"},
                "pairs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "prompt": {"type": "string", "description": "The item in the first column (e.g., the term)"},
                            "answer": {"type": "string", "description": "The corresponding item in the second column (e.g., the definition)"}
                        },
                        "required": ["prompt", "answer"]
                    },
                    "description": "The list of correct pairs. The front-end will shuffle the answer column."
                }
            },
            "required": ["type", "instruction", "pairs"]
        }
    }


def get_sequencing_activity_schema() -> dict:
    """Activities where students must arrange items in the correct order"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["sequencing_activity"], "description": "Primitive type identifier"},
                "instruction": {"type": "string", "description": "Instruction for the activity, e.g., 'Arrange the steps of photosynthesis in the correct order.'"},
                "items": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "The list of items to be sequenced, provided in the correct order. The front-end will display them shuffled."
                }
            },
            "required": ["type", "instruction", "items"]
        }
    }


def get_accordion_schema() -> dict:
    """An accordion-style list for FAQs or question-and-answer breakdowns"""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["accordion"], "description": "Primitive type identifier"},
                "title": {"type": "string", "description": "Optional title for the accordion group, e.g., 'Frequently Asked Questions'"},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string", "description": "The question or heading for the expandable item"},
                            "answer": {"type": "string", "description": "The content that is revealed"}
                        },
                        "required": ["question", "answer"]
                    },
                    "description": "A list of question/answer pairs."
                }
            },
            "required": ["type", "items"]
        }
    }


def get_all_primitive_schemas() -> dict:
    """
    Get all interactive primitive schemas as a dictionary.

    Returns:
        dict: Dictionary mapping primitive names to their schema definitions
    """
    return {
        "alerts": get_alert_schema(),
        "expandables": get_expandable_schema(),
        "quizzes": get_quiz_schema(),
        "definitions": get_definition_schema(),
        "checklists": get_checklist_schema(),
        "tables": get_table_schema(),
        "keyvalues": get_keyvalue_schema(),
        "interactive_timelines": get_interactive_timeline_schema(),
        "carousels": get_carousel_schema(),
        "flip_cards": get_flip_card_schema(),
        "categorization_activities": get_categorization_schema(),
        "fill_in_the_blanks": get_fill_in_the_blank_schema(),
        "scenario_questions": get_scenario_question_schema(),
        "tabbed_content": get_tabbed_content_schema(),
        "matching_activities": get_matching_activity_schema(),
        "sequencing_activities": get_sequencing_activity_schema(),
        "accordions": get_accordion_schema()
    }


def get_primitive_schemas_as_genai_schema() -> dict:
    """
    Get all primitive schemas in the format expected by google.genai.types.Schema.

    This is useful for the ReadingContentGenerator which uses Schema objects.

    Returns:
        dict: Dictionary mapping primitive names to Schema objects
    """
    return {
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
    }
