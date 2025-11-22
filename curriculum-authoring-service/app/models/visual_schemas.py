"""
Visual schemas for problem generation - Two-step visual architecture.

This module provides schemas for:
1. Visual intents (Step 1): Describe what visuals are needed
2. Visual data schemas (Step 2): Generated visual content structures
3. Live interaction configurations for AI coach
"""

from typing import Dict, Any, List

# ============================================================================
# VISUAL INTENT SCHEMA - Step 1
# ============================================================================

VISUAL_INTENT_SCHEMA = {
    "type": "object",
    "properties": {
        "needs_visual": {
            "type": "boolean",
            "description": "Set to true if this element requires a visual component"
        },
        "visual_type": {
            "type": "string",
            "description": """If needs_visual is true, specify the MOST APPROPRIATE visual primitive:

✨ FOUNDATIONAL VISUALS (Use FIRST for K-1 content showing/counting objects):
• object-collection: Display groups of objects for counting, identification, simple grouping
• comparison-panel: Side-by-side comparison of two object collections ("Who has more?")

MATH VISUALS:
• bar-model: Comparing ABSTRACT quantities/totals (e.g., "Team A: 15 points vs Team B: 12 points")
• number-line: Number sequences, ordering, skip counting
• base-ten-blocks: Place value, multi-digit numbers
• fraction-circles: Part-whole fractions, fraction comparison
• geometric-shape: Shape identification, spatial reasoning

SCIENCE VISUALS:
• labeled-diagram: Parts of complex objects/organisms (plant parts, insect anatomy)
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

INTERACTIVE VISUALS:
• card-grid: Clickable cards for multiple choice, yes/no, option selection (REQUIRED for click mode)
• character-scene: Character in a scene for story-based problems

⚠️ CRITICAL RULES:
1. For counting/showing physical objects → USE object-collection or comparison-panel
2. For abstract number comparisons → USE bar-model
3. For click interactions → MUST USE card-grid"""
        },
        "visual_purpose": {
            "type": "string",
            "description": """Clear description of what this visual should show.
SCENE-SETTING INSTRUCTIONS ONLY - not directive language.
GOOD: 'Show 5 red apples and 3 green apples in baskets'
BAD: 'Display the following:', 'Click on the correct answer'"""
        },
        "visual_id": {
            "type": "string",
            "description": "Unique identifier for this visual (e.g., 'question_visual_1', 'display_1', 'interaction_1')"
        }
    },
    "required": ["needs_visual"]
}

# Composite visual intent for problems with multiple visual areas
COMPOSITE_VISUAL_INTENT_SCHEMA = {
    "type": "object",
    "properties": {
        "display_visual_intent": VISUAL_INTENT_SCHEMA,
        # Note: interaction_visual_intent has been moved to interaction_config
    },
    "description": "Composite visual structure for problems with display and interaction visuals"
}

# ============================================================================
# LIVE INTERACTION CONFIG SCHEMA
# ============================================================================

LIVE_INTERACTION_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "prompt": {
            "type": "object",
            "properties": {
                "system": {
                    "type": "string",
                    "description": "System prompt defining the AI tutor's persona and role for this specific problem"
                },
                "instruction": {
                    "type": "string",
                    "description": "The initial verbal instruction/question the AI tutor will speak to start the problem"
                },
                "voice": {
                    "type": "string",
                    "default": "Leda",
                    "description": "Voice style for the AI tutor (e.g., 'Leda', 'Kore')"
                }
            },
            "required": ["system", "instruction"]
        },
        "interaction_mode": {
            "type": "string",
            "enum": ["click", "speech", "drag", "trace"],
            "description": "How the student interacts. If omitted, inferred from problem type"
        },
        "targets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "ID of the interactive element (e.g., 'option_0', 'card_yes')"
                    },
                    "is_correct": {
                        "type": "boolean",
                        "description": "Whether selecting this element is a correct answer"
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional description of what this target represents"
                    }
                },
                "required": ["id", "is_correct"]
            },
            "description": "Maps interactive elements to correctness"
        },
        "evaluation": {
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": ["real_time", "post_submission"],
                    "default": "real_time",
                    "description": "When to provide feedback"
                },
                "feedback": {
                    "type": "object",
                    "properties": {
                        "correct": {
                            "type": "object",
                            "properties": {
                                "audio": {
                                    "type": "string",
                                    "description": "What the AI tutor should say for a correct answer"
                                },
                                "visual_effect": {
                                    "type": "string",
                                    "enum": ["highlight", "celebrate", "bounce", "pulse"],
                                    "description": "Visual effect to apply"
                                }
                            },
                            "required": ["audio"]
                        },
                        "incorrect": {
                            "type": "object",
                            "properties": {
                                "audio": {
                                    "type": "string",
                                    "description": "What the AI tutor should say for an incorrect answer"
                                },
                                "visual_effect": {
                                    "type": "string",
                                    "enum": ["shake", "dim", "fade"],
                                    "description": "Visual effect to apply"
                                },
                                "hint": {
                                    "type": "string",
                                    "description": "Optional hint to guide the student"
                                }
                            },
                            "required": ["audio"]
                        }
                    },
                    "required": ["correct", "incorrect"]
                }
            },
            "required": ["feedback"]
        }
    },
    "required": ["prompt", "evaluation"]
}

# ============================================================================
# LIVE INTERACTION SCHEMA STEP 1 (with visual intents)
# ============================================================================

LIVE_INTERACTION_SCHEMA_STEP1 = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
        "grade_level": {"type": "string"},

        "prompt": {
            "type": "object",
            "properties": {
                "system": {"type": "string"},
                "instruction": {"type": "string"},
                "voice": {"type": "string", "default": "Leda"}
            },
            "required": ["system", "instruction"]
        },

        "visual_intent": COMPOSITE_VISUAL_INTENT_SCHEMA,

        "interaction_config": {
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": ["click", "speech", "drag", "trace"]
                },
                "interaction_visual_intent": {
                    "type": "object",
                    "properties": {
                        "needs_visual": {
                            "type": "boolean",
                            "description": "For mode='click': MUST be true with visual_type='card-grid'"
                        },
                        "visual_type": {
                            "type": "string",
                            "enum": ["card-grid"],
                            "description": "For click mode: MUST be 'card-grid'"
                        },
                        "visual_purpose": {
                            "type": "string",
                            "description": "Description of cards to display (e.g., 'Display Yes/No cards')"
                        },
                        "visual_id": {
                            "type": "string",
                            "description": "Unique identifier (e.g., 'interaction_1')"
                        }
                    },
                    "required": ["needs_visual"]
                },
                "targets": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "MUST match card ID from card-grid (e.g., 'card_yes')"
                            },
                            "is_correct": {"type": "boolean"}
                        },
                        "required": ["id", "is_correct"]
                    }
                }
            },
            "required": ["mode", "interaction_visual_intent", "targets"]
        },

        "evaluation": {
            "type": "object",
            "properties": {
                "feedback": {
                    "type": "object",
                    "properties": {
                        "correct": {
                            "type": "object",
                            "properties": {
                                "audio": {"type": "string"},
                                "visual_effect": {"type": "string", "enum": ["highlight", "celebrate", "bounce", "pulse"]}
                            },
                            "required": ["audio"]
                        },
                        "incorrect": {
                            "type": "object",
                            "properties": {
                                "audio": {"type": "string"},
                                "visual_effect": {"type": "string", "enum": ["shake", "dim", "fade"]},
                                "hint": {"type": "string"}
                            },
                            "required": ["audio"]
                        }
                    },
                    "required": ["correct", "incorrect"]
                }
            },
            "required": ["feedback"]
        },

        "rationale": {"type": "string"},
        "teaching_note": {"type": "string"},
        "success_criteria": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["id", "difficulty", "grade_level", "prompt", "visual_intent", "interaction_config", "evaluation", "rationale", "teaching_note", "success_criteria"]
}

# ============================================================================
# VISUAL DATA SCHEMAS - Step 2 (Generated visual content)
# ============================================================================

# Visual type to schema mapping for dynamic schema generation
VISUAL_TYPE_TO_SCHEMA = {
    # Math Visuals
    "object-collection": {
        "type": "object",
        "properties": {
            "objects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "type": {"type": "string"},
                        "label": {"type": "string"},
                        "count": {"type": "integer"}
                    },
                    "required": ["id", "type", "label", "count"]
                }
            },
            "layout": {"type": "string", "enum": ["grid", "scattered", "grouped"]}
        },
        "required": ["objects", "layout"]
    },

    "comparison-panel": {
        "type": "object",
        "properties": {
            "left_collection": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "objects": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "count": {"type": "integer"}
                            }
                        }
                    }
                },
                "required": ["label", "objects"]
            },
            "right_collection": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "objects": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "count": {"type": "integer"}
                            }
                        }
                    }
                },
                "required": ["label", "objects"]
            }
        },
        "required": ["left_collection", "right_collection"]
    },

    "bar-model": {
        "type": "object",
        "properties": {
            "bars": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "label": {"type": "string"},
                        "value": {"type": "number"},
                        "color": {"type": "string"}
                    },
                    "required": ["id", "label", "value"]
                }
            },
            "max_value": {"type": "number"},
            "axis_label": {"type": "string"}
        },
        "required": ["bars"]
    },

    "number-line": {
        "type": "object",
        "properties": {
            "min": {"type": "number"},
            "max": {"type": "number"},
            "marked_numbers": {
                "type": "array",
                "items": {"type": "number"}
            },
            "highlighted_number": {"type": "number"}
        },
        "required": ["min", "max"]
    },

    # Literacy Visuals
    "letter-card": {
        "type": "object",
        "properties": {
            "letter": {"type": "string"},
            "uppercase": {"type": "boolean"},
            "show_tracing": {"type": "boolean"}
        },
        "required": ["letter"]
    },

    "word-card": {
        "type": "object",
        "properties": {
            "word": {"type": "string"},
            "syllable_breaks": {
                "type": "array",
                "items": {"type": "string"}
            },
            "phonetic": {"type": "string"}
        },
        "required": ["word"]
    },

    "rhyming-pairs": {
        "type": "object",
        "properties": {
            "pairs": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "word1": {"type": "string"},
                        "word2": {"type": "string"},
                        "shared_sound": {"type": "string"}
                    },
                    "required": ["word1", "word2"]
                }
            }
        },
        "required": ["pairs"]
    },

    # Interactive Visuals
    "card-grid": {
        "type": "object",
        "properties": {
            "cards": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "MUST match target IDs in interaction_config.targets"
                        },
                        "label": {"type": "string"},
                        "icon": {"type": "string"},
                        "color": {"type": "string"}
                    },
                    "required": ["id", "label"]
                },
                "description": "Cards for click interaction. IDs must match target IDs exactly."
            },
            "layout": {
                "type": "string",
                "enum": ["2x1", "2x2", "3x1", "4x1"],
                "description": "Grid layout pattern"
            }
        },
        "required": ["cards", "layout"]
    },

    "character-scene": {
        "type": "object",
        "properties": {
            "character": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "emotion": {"type": "string"}
                },
                "required": ["name", "description"]
            },
            "setting": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                    "time_of_day": {"type": "string"},
                    "description": {"type": "string"}
                },
                "required": ["location", "description"]
            },
            "objects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "position": {"type": "string"}
                    }
                }
            }
        },
        "required": ["character", "setting"]
    },

    # Science Visuals
    "labeled-diagram": {
        "type": "object",
        "properties": {
            "diagram_type": {"type": "string"},
            "labels": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "text": {"type": "string"},
                        "position": {"type": "string"}
                    },
                    "required": ["id", "text"]
                }
            }
        },
        "required": ["diagram_type", "labels"]
    },

    # General Visuals
    "story-sequence": {
        "type": "object",
        "properties": {
            "scenes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "order": {"type": "integer"},
                        "description": {"type": "string"},
                        "caption": {"type": "string"}
                    },
                    "required": ["order", "description"]
                }
            }
        },
        "required": ["scenes"]
    }
}

# List of all available visual types
ALL_VISUAL_TYPES = list(VISUAL_TYPE_TO_SCHEMA.keys())

# Visual types by category for easier selection
VISUAL_TYPES_BY_CATEGORY = {
    "math": ["object-collection", "comparison-panel", "bar-model", "number-line", "base-ten-blocks", "fraction-circles", "geometric-shape"],
    "literacy": ["letter-card", "word-card", "rhyming-pairs", "letter-picture", "alphabet-sequence", "sight-word-card", "sound-sort"],
    "science": ["labeled-diagram", "cycle-diagram", "tree-diagram", "line-graph", "thermometer"],
    "language_arts": ["sentence-diagram", "story-sequence", "word-web", "character-web", "venn-diagram"],
    "interactive": ["card-grid", "character-scene"]
}
