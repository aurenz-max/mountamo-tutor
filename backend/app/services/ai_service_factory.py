# backend/app/services/ai_service_factory.py
from typing import Dict
import logging
from .base_ai_service import BaseAIService
from .gemini_generate import GeminiGenerateService

logger = logging.getLogger(__name__)


class AIServiceFactory:
    """Factory for the backend's LLM service.

    The backend generates with Gemini only (plus embedding models); there is no
    second-vendor fallback. `service_type` is accepted for call-site compatibility
    and ignored: any value other than "gemini" logs a warning and returns Gemini.
    """

    _services: Dict[str, BaseAIService] = {}

    @classmethod
    def get_service(cls, service_type: str = None) -> BaseAIService:
        if service_type and service_type.lower() != "gemini":
            logger.warning(f"Unknown AI service type: {service_type}; using gemini")
        if "gemini" not in cls._services:
            logger.info("Creating new GeminiGenerateService instance")
            cls._services["gemini"] = GeminiGenerateService()
        return cls._services["gemini"]

    @classmethod
    def clear_cache(cls) -> None:
        """Drop cached service instances (tests / config reload)."""
        cls._services.clear()
