# backend/app/services/ai_service_factory.py
from typing import Optional, Dict
import logging
from .base_ai_service import BaseAIService
from .anthropic import AnthropicService
from .gemini_generate import GeminiGenerateService
from ..core.config import settings

logger = logging.getLogger(__name__)

class AIServiceFactory:
    """Factory class for creating AI service instances based on configuration"""
    
    # Cache for service instances
    _services: Dict[str, BaseAIService] = {}
    
    @classmethod
    def get_service(cls, service_type: str = None) -> BaseAIService:
        """
        Get an AI service instance based on the specified type or fallback to configured default
        
        Args:
            service_type: 'anthropic', 'claude', 'gemini', or None (use default from settings)
            
        Returns:
            An instance implementing BaseAIService
        """
        # If no service type specified, use the configured default
        if service_type is None:
            service_type = getattr(settings, "DEFAULT_AI_SERVICE", "anthropic")
        
        service_type = service_type.lower()
        
        # Normalize service type names
        if service_type in ["anthropic", "claude"]:
            service_key = "anthropic"
        elif service_type == "gemini":
            service_key = "gemini"
        else:
            logger.warning(f"Unknown AI service type: {service_type}, defaulting to anthropic")
            service_key = "anthropic"
            
        # Create service if it doesn't exist in cache
        if service_key not in cls._services:
            try:
                if service_key == "anthropic":
                    logger.info("Creating new AnthropicService instance")
                    cls._services[service_key] = AnthropicService()
                elif service_key == "gemini":
                    logger.info("Creating new GeminiGenerateService instance")
                    cls._services[service_key] = GeminiGenerateService()
            except Exception as e:
                logger.error(f"Failed to initialize {service_key} service: {str(e)}")
                
                # Fallback logic for when a service fails to initialize
                if service_key == "anthropic" and "gemini" not in cls._services:
                    # Try to initialize Gemini as fallback
                    try:
                        logger.info("Attempting to initialize Gemini as fallback")
                        cls._services["gemini"] = GeminiGenerateService()
                        return cls._services["gemini"]
                    except Exception as e2:
                        logger.error(f"All AI services failed to initialize: {e}, {e2}")
                        raise RuntimeError(f"All AI services failed to initialize: {e}, {e2}")
                elif service_key == "gemini" and "anthropic" not in cls._services:
                    # Try to initialize Anthropic as fallback
                    try:
                        logger.info("Attempting to initialize Anthropic as fallback")
                        cls._services["anthropic"] = AnthropicService()
                        return cls._services["anthropic"]
                    except Exception as e2:
                        logger.error(f"All AI services failed to initialize: {e}, {e2}")
                        raise RuntimeError(f"All AI services failed to initialize: {e}, {e2}")
                else:
                    # No fallback available
                    raise RuntimeError(f"Failed to initialize AI service and no fallback available: {e}")
                
        return cls._services[service_key]