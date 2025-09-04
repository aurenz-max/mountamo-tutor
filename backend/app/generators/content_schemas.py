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