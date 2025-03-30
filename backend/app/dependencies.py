# backend/app/dependencies.py

import logging
from typing import Optional
from fastapi import Depends

from .services.audio_service import AudioService
from .services.azure_tts import AzureSpeechService
from .services.anthropic import AnthropicService
from .services.problems import ProblemService
from .services.competency import CompetencyService
from .services.recommender import ProblemRecommender
from .services.visual_content_service import VisualContentService
from .services.transcript import TranscriptService
from .services.visual_content_manager import VisualContentManager
from .services.gemini import GeminiService
from .services.gemini_generate import GeminiGenerateService  # Import the generation service with alias
from .services.base_ai_service import BaseAIService
from .services.ai_service_factory import AIServiceFactory

from .services.tutoring import TutoringService
from .services.gemini_problem import GeminiProblemIntegration
from .services.analytics import AnalyticsExtension
from .services.learning_paths import LearningPathsService
from .services.gemini_read_along import GeminiReadAlongIntegration  # NEW: Import the read-along integration
from .services.review import ReviewService

from .db.cosmos_db import CosmosDBService
from .db.problem_optimizer import ProblemOptimizer
from .core.session_manager import SessionManager
from .core.config import settings

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Shared service singletons
_cosmos_db: Optional[CosmosDBService] = None
_audio_service: Optional[AudioService] = None 
_anthropic_service: Optional[AnthropicService] = None
_gemini_generate_service: Optional[GeminiGenerateService] = None  # Add the Gemini Generate service
_visual_content_service: Optional[VisualContentService] = None
_visual_content_manager: Optional[VisualContentManager] = None
_read_along_integration: Optional[GeminiReadAlongIntegration] = None

# Global services that depend on the above
_session_manager: Optional[SessionManager] = None
_competency_service: Optional[CompetencyService] = None
_problem_recommender: Optional[ProblemRecommender] = None
_problem_service: Optional[ProblemService] = None
_learning_paths_service: Optional[LearningPathsService] = None
_problem_optimizer: Optional[ProblemOptimizer] = None
_review_service: Optional[ReviewService] = None


# These services are created per-session but using the dependency pattern
# No global variables needed since they're not singletons

def get_cosmos_db() -> CosmosDBService:
    """Get or create CosmosDB service singleton."""
    global _cosmos_db
    if _cosmos_db is None:
        logger.info("Initializing CosmosDB service")
        _cosmos_db = CosmosDBService()
    return _cosmos_db

def get_audio_service() -> AudioService:
    """Get or create AudioService singleton."""
    global _audio_service
    if _audio_service is None:
        logger.info("Initializing AudioService")
        _audio_service = AudioService()
    return _audio_service

def get_ai_service(service_type: str = None) -> BaseAIService:
    """Get AI service instance based on type or default configuration"""
    if service_type is None:
        service_type = getattr(settings, "DEFAULT_AI_SERVICE", "anthropic")
    return AIServiceFactory.get_service(service_type)

def get_anthropic_service() -> AnthropicService:
    """Get or create AnthropicService singleton."""
    global _anthropic_service
    if _anthropic_service is None:
        logger.info("Initializing AnthropicService")
        _anthropic_service = AnthropicService()
    return _anthropic_service

def get_gemini_generate_service() -> GeminiGenerateService:
    """Get or create GeminiGenerateService singleton."""
    global _gemini_generate_service
    if _gemini_generate_service is None:
        logger.info("Initializing GeminiGenerateService")
        _gemini_generate_service = GeminiGenerateService()
    return _gemini_generate_service

def get_visual_content_service() -> VisualContentService:
    """Get or create VisualContentService singleton."""
    global _visual_content_service
    if _visual_content_service is None:
        logger.info(f"Initializing VisualContentService with path: {settings.IMAGE_LIBRARY_PATH}")
        _visual_content_service = VisualContentService(image_library_path=settings.IMAGE_LIBRARY_PATH)
    return _visual_content_service

def get_visual_content_manager(
    visual_content_service: VisualContentService = Depends(get_visual_content_service)
) -> VisualContentManager:
    """Get or create VisualContentManager singleton."""
    global _visual_content_manager
    if _visual_content_manager is None:
        logger.info("Initializing VisualContentManager")
        _visual_content_manager = VisualContentManager(visual_content_service)
    return _visual_content_manager

# Add this new dependency function
def get_read_along_integration() -> GeminiReadAlongIntegration:
    """Get or create GeminiReadAlongIntegration singleton."""
    global _read_along_integration
    if _read_along_integration is None:
        logger.info("Initializing GeminiReadAlongIntegration")
        _read_along_integration = GeminiReadAlongIntegration()
        # We don't initialize here - it will be initialized when the session starts
    return _read_along_integration

def get_competency_service(
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
) -> CompetencyService:
    """Get or create CompetencyService singleton."""
    global _competency_service
    if _competency_service is None:
        from pathlib import Path
        DATA_DIR = Path(__file__).parent.parent / "data"
        logger.info(f"Initializing CompetencyService with data dir: {DATA_DIR}")
        _competency_service = CompetencyService(data_dir=str(DATA_DIR))
    
    # Make sure the cosmos_db is set on the competency service
    if _competency_service.cosmos_db is None:
        logger.info("Setting CosmosDB on CompetencyService")
        _competency_service.cosmos_db = cosmos_db
    
    return _competency_service

def get_problem_recommender(
    competency_service: CompetencyService = Depends(get_competency_service)
) -> ProblemRecommender:
    """Get or create ProblemRecommender singleton."""
    global _problem_recommender
    if _problem_recommender is None:
        logger.info("Initializing ProblemRecommender")
        _problem_recommender = ProblemRecommender(competency_service)
    return _problem_recommender

def get_problem_optimizer(
    cosmos_db: CosmosDBService = Depends(get_cosmos_db),
    recommender: ProblemRecommender = Depends(get_problem_recommender)  # Add recommender dependency
) -> ProblemOptimizer:
    """Get or create ProblemOptimizer singleton."""
    global _problem_optimizer
    if _problem_optimizer is None:
        logger.info("Initializing ProblemOptimizer")
        # Pass both cosmos_db and recommender to the constructor
        _problem_optimizer = ProblemOptimizer(cosmos_db, recommender)
    
    # In case the class instance was created but the recommender wasn't set
    if not hasattr(_problem_optimizer, 'recommender') or _problem_optimizer.recommender is None:
        logger.info("Setting recommender on ProblemOptimizer")
        _problem_optimizer.recommender = recommender
        
    return _problem_optimizer

def get_problem_service(
    recommender: ProblemRecommender = Depends(get_problem_recommender),
    cosmos_db: CosmosDBService = Depends(get_cosmos_db),
    competency_service: CompetencyService = Depends(get_competency_service),
    problem_optimizer: ProblemOptimizer = Depends(get_problem_optimizer)  # Add this dependency
) -> ProblemService:
    """Get or create ProblemService singleton."""
    global _problem_service
    if _problem_service is None:
        logger.info("Initializing ProblemService")
        _problem_service = ProblemService()
    
    # Set required dependencies on the problem service
    if _problem_service.recommender is None:
        logger.info("Setting recommender on ProblemService")
        _problem_service.recommender = recommender
        
    if _problem_service.competency_service is None:
        logger.info("Setting competency_service on ProblemService")
        _problem_service.competency_service = competency_service
    
    # Set AI service using factory
    if _problem_service.ai_service is None:
        # Get default AI service type from settings
        default_ai_service = getattr(settings, "DEFAULT_AI_SERVICE", "anthropic").lower()
        logger.info(f"Setting AI service to {default_ai_service} on ProblemService")
        _problem_service.set_ai_service(default_ai_service)
        
    # Add CosmosDB service for problem review storage
    if _problem_service.cosmos_db is None:
        logger.info("Setting cosmos_db on ProblemService")
        _problem_service.cosmos_db = cosmos_db
    
    # Set the problem optimizer
    if not hasattr(_problem_service, 'problem_optimizer') or _problem_service.problem_optimizer is None:
        logger.info("Setting problem_optimizer on ProblemService")
        _problem_service.problem_optimizer = problem_optimizer
        
    return _problem_service

def get_review_service(
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
) -> ReviewService:
    """Get or create ReviewService singleton."""
    global _review_service
    if _review_service is None:
        logger.info("Initializing ReviewService")
        _review_service = ReviewService()
        
        # Set default AI service from config
        default_review_service = getattr(settings, "DEFAULT_AI_REVIEW_SERVICE", "anthropic")
        logger.info(f"Setting default AI service to {default_review_service} for ReviewService")
        _review_service.set_ai_service(default_review_service)
    
    # Make sure the cosmos_db is set
    if _review_service.cosmos_db is None:
        logger.info("Setting CosmosDB on ReviewService")
        _review_service.cosmos_db = cosmos_db
    
    return _review_service

def get_learning_paths_service(
    competency_service: CompetencyService = Depends(get_competency_service)
) -> LearningPathsService:
    """Get or create LearningPathsService singleton."""
    global _learning_paths_service
    if _learning_paths_service is None:
        from pathlib import Path
        DATA_DIR = Path(__file__).parent.parent / "data"
        logger.info(f"Initializing LearningPathsService with data dir: {DATA_DIR}")
        _learning_paths_service = LearningPathsService(
            data_dir=str(DATA_DIR),
            competency_service=competency_service
        )
    return _learning_paths_service

async def get_analytics_extension(competency_service: CompetencyService = Depends(get_competency_service)):
    """Get or create AnalyticsExtension instance."""
    # Import the AnalyticsExtension from the new location
    from .services.analytics import AnalyticsExtension
    
    extension = AnalyticsExtension()
    # We don't need to set Cosmos DB reference anymore, as analytics will use PostgreSQL
    # But we might still need it for curriculum data or live competencies
    if competency_service.cosmos_db:
        extension.cosmos_db = competency_service.cosmos_db
    
    return extension

def get_session_manager(
    audio_service: AudioService = Depends(get_audio_service),
    cosmos_db: CosmosDBService = Depends(get_cosmos_db),
    visual_content_service: VisualContentService = Depends(get_visual_content_service)
) -> SessionManager:
    """Get or create SessionManager singleton with its dependencies."""
    global _session_manager
    if _session_manager is None:
        logger.info("Initializing SessionManager")
        _session_manager = SessionManager(
            audio_service=audio_service,
            cosmos_db=cosmos_db,
            visual_content_service=visual_content_service
        )
    return _session_manager

def get_transcript_service(
    cosmos_db: CosmosDBService = Depends(get_cosmos_db),
    anthropic: AnthropicService = Depends(get_anthropic_service)
) -> TranscriptService:
    """
    Create a new TranscriptService instance for each session.
    Each session needs its own instance with its own state.
    """
    logger.debug("Creating new TranscriptService")
    return TranscriptService(
        cosmos_service=cosmos_db,
        anthropic_service=anthropic
    )

def get_azure_speech_service(
    transcript_service: TranscriptService = Depends(get_transcript_service)
) -> AzureSpeechService:
    """Create a new AzureSpeechService instance per request.
    
    This is not a singleton because AzureSpeechService should be per-session.
    """
    logger.debug("Creating new AzureSpeechService")
    return AzureSpeechService(
        subscription_key=settings.TTS_KEY,
        region=settings.TTS_REGION,
        transcript_service=transcript_service
    )



def get_gemini_problem_integration(
    problem_service: ProblemService = Depends(get_problem_service)
) -> GeminiProblemIntegration:
    """Create a new GeminiProblemIntegration instance with injected dependencies.
    
    This is not a singleton because it should be created per-session.
    """
    logger.debug("Creating new GeminiProblemIntegration")
    gemini_problem = GeminiProblemIntegration()
    
    # Inject the properly configured problem_service
    gemini_problem.problem_service = problem_service
    
    return gemini_problem

def get_gemini_service(
    audio_service: AudioService = Depends(get_audio_service),
    azure_speech_service: AzureSpeechService = Depends(get_azure_speech_service),
    visual_integration = None,
    problem_integration: GeminiProblemIntegration = Depends(get_gemini_problem_integration),
) -> GeminiService:
    """Create a new GeminiService instance.
    
    This is not a singleton because GeminiService should be per-session.
    """
    logger.debug("Creating new GeminiService")
    gemini_service = GeminiService(
        audio_service=audio_service,
        azure_speech_service=azure_speech_service,
        visual_integration=visual_integration
    )
    
    # Set the problem_integration
    gemini_service.problem_integration = problem_integration
    
    # Add learning_analytics_service for personalization
    
    return gemini_service

def get_tutoring_service(
    audio_service: AudioService = Depends(get_audio_service),
    gemini_service: GeminiService = Depends(get_gemini_service),
    azure_speech_service: AzureSpeechService = Depends(get_azure_speech_service),
) -> TutoringService:
    """Create a new TutoringService instance.
    
    This is not a singleton because TutoringService should be per-session.
    """
    logger.debug("Creating new TutoringService")
    tutoring_service = TutoringService(
        audio_service=audio_service,
        gemini_service=gemini_service,
        azure_speech_service=azure_speech_service
    )
        
    return tutoring_service

def initialize_services():
    """Initialize all singleton services for ETL processes."""
    logger.info("Initializing all services for ETL processes")
    
    # Initialize base services
    cosmos_db = get_cosmos_db()
    
    # Initialize dependent services
    competency_service = get_competency_service(cosmos_db)
    problem_recommender = get_problem_recommender(competency_service)
    problem_optimizer = get_problem_optimizer(cosmos_db)
    review_service = get_review_service(cosmos_db)  # Add this line
    
    # Initialize problem service with all dependencies
    problem_service = get_problem_service(
        problem_recommender, 
        cosmos_db, 
        competency_service, 
        problem_optimizer
    )
    
    # Return the services in case they're needed
    return {
        "cosmos_db": cosmos_db,
        "competency_service": competency_service,
        "problem_recommender": problem_recommender,
        "problem_service": problem_service,
        "problem_optimizer": problem_optimizer,
        "review_service": review_service  # Add this line
    }