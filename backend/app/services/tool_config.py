# app/services/tool_config.py
"""
Centralized tool configuration for Gemini service.
This module provides tool configurations without circular imports.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Base tool that only includes problem creation
TOOL_CREATE_PROBLEM = {
    "function_declarations": [
        {
            "name": "create_problem",
            "description": "Generate a practice problem for the current skill being taught.",
        }
    ],
}

# Enhanced tool that includes visual scene creation
TOOL_PROBLEM_VISUAL = {
    "function_declarations": [
        # Problem creation function
        {
            "name": "create_problem",
            "description": "Generate a practice problem for the current skill being taught."
        },
        # Visual functions
        {
            "name": "get_categories",
            "description": "Get all available image categories. Always call this first before trying to create scenes to ensure you're using valid categories."
        },
        {
            "name": "get_objects",
            "description": "Get objects available within a specific category. Always call this after get_categories to ensure you're using valid objects for your scene.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category name to get objects from. Use exact category names from get_categories."
                    }
                },
                "required": ["category"]
            }
        },
        {
            "name": "find_images",
            "description": "Find images matching a category and/or object type. This is primarily for information - use create_scene to actually create visual content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category to filter by (optional). Use exact category names from get_categories."
                    },
                    "object_type": {
                        "type": "string",
                        "description": "Object type to filter by (optional). Use object names from get_objects."
                    }
                },
                "required": []
            }
        },
        {
            "name": "create_scene",
            "description": "Create a visual scene with specific objects. Always call get_categories and get_objects first to ensure you're using valid inputs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category of objects to use. Use exact category names from get_categories."
                    },
                    "object_type": {
                        "type": "string",
                        "description": "Type of object to add to the scene (e.g. 'circle', 'triangle'). Use object names from get_objects."
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of objects to include (between 1-10)"
                    },
                    "layout": {
                        "type": "string",
                        "enum": ["grid", "random", "circle"],
                        "description": "How to arrange objects in the scene",
                    },
                    "title": {
                        "type": "string",
                        "description": "Optional title for the scene"
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional description of the scene purpose"
                    }
                },
                "required": ["category", "object_type", "count"]
            }
        },
    ],
}

def get_tool_config_for_unit(unit_id: Optional[str], session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get the appropriate tool configuration based on unit ID.
    
    Args:
        unit_id: The ID of the unit (e.g., 'COUNT001')
        session_id: Optional session ID for logging purposes
    
    Returns:
        A dictionary containing the tool configuration for Gemini
    """
    # For counting units, include visual tools
    if unit_id == 'COUNT001':
        if session_id:
            logger.info(f"[Session {session_id}] Using visual tools for counting unit {unit_id}")
        return TOOL_PROBLEM_VISUAL
    
    # For all other units, only include problem creation
    if session_id:
        logger.info(f"[Session {session_id}] Using basic problem tools for unit {unit_id}")
    
    return TOOL_CREATE_PROBLEM