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

# Practice Problems Schema
PRACTICE_PROBLEMS_SCHEMA = Schema(
    type="object",
    properties={
        "problems": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "problem_type": Schema(type="string", description="Type of problem"),
                    "problem": Schema(type="string", description="The actual question/problem statement"),
                    "answer": Schema(type="string", description="The correct answer or solution"),
                    "success_criteria": Schema(
                        type="array",
                        items=Schema(type="string"),
                        description="Criteria that define successful completion"
                    ),
                    "teaching_note": Schema(type="string", description="Note for educators"),
                    "grade_level": Schema(type="string", description="Target grade level")
                },
                required=["problem_type", "problem", "answer", "success_criteria", "teaching_note", "grade_level"]
            )
        )
    },
    required=["problems"]
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