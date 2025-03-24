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
from .services.tutoring import TutoringService
from .services.gemini_problem import GeminiProblemIntegration
from .services.analytics import AnalyticsExtension
from .services.learning_paths import LearningPathsService
from .services.learning_analytics import LearningAnalyticsService, ProgressReportGenerator
from .services.gemini_read_along import GeminiReadAlongIntegration  # NEW: Import the read-along integration

from .db.cosmos_db import CosmosDBService
from .core.session_manager import SessionManager
from .core.config import settings

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Shared service singletons
_cosmos_db: Optional[CosmosDBService] = None
_audio_service: Optional[AudioService] = None 
_anthropic_service: Optional[AnthropicService] = None
_visual_content_service: Optional[VisualContentService] = None
_visual_content_manager: Optional[VisualContentManager] = None
_read_along_integration: Optional[GeminiReadAlongIntegration] = None

# Global services that depend on the above
_session_manager: Optional[SessionManager] = None
_competency_service: Optional[CompetencyService] = None
_problem_recommender: Optional[ProblemRecommender] = None
_problem_service: Optional[ProblemService] = None
_learning_paths_service: Optional[LearningPathsService] = None
_learning_analytics_service: Optional[LearningAnalyticsService] = None
_progress_report_generator: Optional[ProgressReportGenerator] = None

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

def get_anthropic_service() -> AnthropicService:
    """Get or create AnthropicService singleton."""
    global _anthropic_service
    if _anthropic_service is None:
        logger.info("Initializing AnthropicService")
        _anthropic_service = AnthropicService()
    return _anthropic_service

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

def get_problem_service(
    recommender: ProblemRecommender = Depends(get_problem_recommender),
    anthropic_service: AnthropicService = Depends(get_anthropic_service),
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)  # Add CosmosDB dependency
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
        _problem_service.competency_service = recommender.competency_service
        
    if _problem_service.anthropic is None:
        logger.info("Setting anthropic_service on ProblemService")
        _problem_service.anthropic = anthropic_service
    
    # Add CosmosDB service for problem review storage
    if _problem_service.cosmos_db is None:
        logger.info("Setting cosmos_db on ProblemService")
        _problem_service.cosmos_db = cosmos_db
        
    return _problem_service


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

def get_learning_analytics_service(
    competency_service: CompetencyService = Depends(get_competency_service),
    problem_service: ProblemService = Depends(get_problem_service),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service),
    analytics_extension: AnalyticsExtension = Depends(get_analytics_extension)
) -> LearningAnalyticsService:
    """Get or create LearningAnalyticsService singleton."""
    global _learning_analytics_service
    if _learning_analytics_service is None:
        logger.info("Initializing LearningAnalyticsService")
        _learning_analytics_service = LearningAnalyticsService(
            competency_service=competency_service,
            problem_service=problem_service,
            learning_paths_service=learning_paths_service,
            analytics_extension=analytics_extension
        )
    return _learning_analytics_service

def get_progress_report_generator(
    learning_analytics_service: LearningAnalyticsService = Depends(get_learning_analytics_service)
) -> ProgressReportGenerator:
    """Get ProgressReportGenerator instance."""
    # This uses the generator from the LearningAnalyticsService
    return learning_analytics_service.progress_report_generator

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
    learning_analytics_service: LearningAnalyticsService = Depends(get_learning_analytics_service)
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
    gemini_service.learning_analytics_service = learning_analytics_service
    
    return gemini_service

def get_tutoring_service(
    audio_service: AudioService = Depends(get_audio_service),
    gemini_service: GeminiService = Depends(get_gemini_service),
    azure_speech_service: AzureSpeechService = Depends(get_azure_speech_service),
    learning_analytics_service: LearningAnalyticsService = Depends(get_learning_analytics_service)
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
    
    # Add learning_analytics_service for personalized tutoring
    tutoring_service.learning_analytics_service = learning_analytics_service
    
    return tutoring_service