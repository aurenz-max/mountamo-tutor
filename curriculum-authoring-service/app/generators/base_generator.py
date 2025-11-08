"""
Base generator class for AI content generation
"""

import logging
from abc import ABC
from datetime import datetime
from typing import Dict, Any

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)


class BaseContentGenerator(ABC):
    """Base class for all content generators with shared functionality"""

    def __init__(self):
        self.client = None
        self.types = types
        self._initialize_gemini()

    def _initialize_gemini(self):
        """Initialize Gemini client with configuration"""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required. Please check your configuration.")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info(f"✨ Gemini client initialized for {self.__class__.__name__}")

    def _extract_grade_info(self, subskill_data) -> str:
        """Extract grade information from subskill data with fallback"""
        grade_level = subskill_data.get('grade_level')
        if grade_level:
            return grade_level
        return "appropriate grade level"

    def _serialize_datetime_fields(self, data):
        """
        Recursively convert all datetime objects to ISO format strings
        """
        if isinstance(data, dict):
            return {key: self._serialize_datetime_fields(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self._serialize_datetime_fields(item) for item in data]
        elif isinstance(data, datetime):
            return data.isoformat()
        else:
            return data

    def _format_terminology_string(self, key_terminology: Dict[str, str]) -> str:
        """Format terminology dictionary into a readable string"""
        return "\n".join([f"- {term}: {defn}" for term, defn in key_terminology.items()])

    def _safe_json_loads(self, response_text: str, operation_name: str):
        """Safely parse JSON response with error handling"""
        try:
            import json
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"{operation_name} JSON parsing failed: {str(e)}")
            logger.error(f"Response text: {response_text[:500]}...")
            raise ValueError(f"{operation_name} returned invalid JSON") from e

    def _handle_generation_error(self, operation_name: str, error: Exception):
        """Standard error handling for generation operations"""
        error_msg = f"{operation_name} failed: {str(error)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from error
