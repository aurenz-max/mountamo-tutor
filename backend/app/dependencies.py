# backend/app/dependencies.py

import logging
from typing import Optional
from fastapi import Depends, BackgroundTasks

from .services.azure_tts import AzureSpeechService
from .services.audio_service import AudioService
from .services.anthropic import AnthropicService
from .services.problems import ProblemService
from .services.competency import CompetencyService
from .services.curriculum_service import CurriculumService
from .services.recommender import ProblemRecommender
from .services.visual_content_service import VisualContentService
from .services.visual_content_manager import VisualContentManager
from .services.gemini_generate import GeminiGenerateService
from .services.base_ai_service import BaseAIService
from .services.ai_service_factory import AIServiceFactory

from .services.gemini_problem import GeminiProblemIntegration
from .services.analytics import AnalyticsExtension
from .services.learning_paths import LearningPathsService
from .services.gemini_read_along import GeminiReadAlongIntegration
from .services.review import ReviewService

from .services.daily_activities import DailyActivitiesService
from .services.bigquery_analytics import BigQueryAnalyticsService

from .db.cosmos_db import CosmosDBService
from .db.blob_storage import blob_storage_service
from .db.problem_optimizer import ProblemOptimizer
from .core.config import settings

# 🔥 UPDATED: Import Firebase authentication utilities and service layer
from .api.endpoints.auth import verify_firebase_token
from .services.user_profiles import user_profiles_service
from .models.user_profiles import ActivityLog

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Shared service singletons
_cosmos_db: Optional[CosmosDBService] = None
_curriculum_service: Optional[CurriculumService] = None
_audio_service: Optional[AudioService] = None 
_anthropic_service: Optional[AnthropicService] = None
_gemini_generate_service: Optional[GeminiGenerateService] = None
_visual_content_service: Optional[VisualContentService] = None
_visual_content_manager: Optional[VisualContentManager] = None
_read_along_integration: Optional[GeminiReadAlongIntegration] = None

# Global services that depend on the above
_competency_service: Optional[CompetencyService] = None
_problem_recommender: Optional[ProblemRecommender] = None
_problem_service: Optional[ProblemService] = None
_learning_paths_service: Optional[LearningPathsService] = None
_problem_optimizer: Optional[ProblemOptimizer] = None
_review_service: Optional[ReviewService] = None

# 🔥 UPDATED: Authentication dependency functions using service layer
async def get_authenticated_user(firebase_user: dict = Depends(verify_firebase_token)) -> dict:
    """Get authenticated user info"""
    return firebase_user

async def get_user_with_profile(firebase_user: dict = Depends(verify_firebase_token)) -> tuple:
    """Get user with profile data using service layer"""
    user_profile = await user_profiles_service.get_user_profile(firebase_user['uid'])
    return firebase_user, user_profile

async def log_endpoint_activity(
    endpoint_name: str,
    activity_type: str = "endpoint_access",
    points: int = 1,
    firebase_user: dict = Depends(verify_firebase_token),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Log user activity for endpoint access using service layer"""
    def log_activity():
        try:
            import asyncio
            
            # Get student_id from firebase_user or use a default mapping
            # You might need to adjust this based on your user context structure
            student_id = firebase_user.get('student_id')
            if not student_id:
                # If student_id is not in firebase_user, you might need to look it up
                # For now, using uid as fallback (you can adjust this)
                logger.warning(f"No student_id found for user {firebase_user['uid']}, using uid as fallback")
                student_id = hash(firebase_user['uid']) % 1000000  # Simple fallback
            
            activity = ActivityLog(
                activity_type=activity_type,
                activity_id=endpoint_name,
                activity_name=f"Accessed {endpoint_name}",
                points_earned=points,
                metadata={"endpoint": endpoint_name}
            )
            
            # Create new event loop for background task
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                user_profiles_service.log_activity(firebase_user['uid'], student_id, activity)
            )
            loop.close()
            
        except Exception as e:
            logger.error(f"Failed to log activity for {endpoint_name}: {str(e)}")
    
    background_tasks.add_task(log_activity)
    return firebase_user

# 🔥 UPDATED: Service dependencies now include user context
def get_cosmos_db() -> CosmosDBService:
    """Get or create CosmosDB service singleton."""
    global _cosmos_db
    if _cosmos_db is None:
        logger.info("Initializing CosmosDB service")
        _cosmos_db = CosmosDBService()
    return _cosmos_db

def get_blob_storage_service():
    """Get the blob storage service"""
    return blob_storage_service



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

def get_read_along_integration() -> GeminiReadAlongIntegration:
    """Get or create GeminiReadAlongIntegration singleton."""
    global _read_along_integration
    if _read_along_integration is None:
        logger.info("Initializing GeminiReadAlongIntegration")
        _read_along_integration = GeminiReadAlongIntegration()
    return _read_along_integration

# 🔥 UPDATED: Get user profiles service
def get_user_profiles_service():
    """Get the user profiles service singleton"""
    return user_profiles_service

def get_bigquery_analytics_service() -> 'BigQueryAnalyticsService':
    """Get or create BigQuery Analytics service singleton."""
    from .services.bigquery_analytics import BigQueryAnalyticsService
    
    global _bigquery_analytics_service
    if '_bigquery_analytics_service' not in globals() or _bigquery_analytics_service is None:
        logger.info("Initializing BigQuery Analytics Service")
        _bigquery_analytics_service = BigQueryAnalyticsService(
            project_id=settings.GCP_PROJECT_ID,
            dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
        )
    return _bigquery_analytics_service

async def get_curriculum_service() -> CurriculumService:
    """Get or create CurriculumService singleton with BigQuery - CLEAN ASYNC"""
    global _curriculum_service
    if _curriculum_service is None:
        logger.info("Initializing CurriculumService with BigQuery")
        
        # Get BigQuery service (required)
        bigquery_service = get_bigquery_analytics_service()
        
        # Get blob service (optional)
        blob_service = get_blob_storage_service()
        
        # Create curriculum service
        _curriculum_service = CurriculumService(bigquery_service, blob_service)
        
        # Initialize - no asyncio.run() needed, we're already async!
        await _curriculum_service.initialize()
        
        logger.info("✅ CurriculumService with BigQuery initialized successfully")
    
    return _curriculum_service

async def get_competency_service(
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
) -> CompetencyService:
    """Get Competency service with BigQuery curriculum service - CLEAN ASYNC"""
    global _competency_service
    if _competency_service is None:
        logger.info("Initializing CompetencyService")
        
        try:
            # Get curriculum service FIRST - now clean and simple
            curriculum_service = await get_curriculum_service()
            logger.info("✅ Got curriculum service for competency service")
            
            # Create competency service WITH curriculum service
            _competency_service = CompetencyService(curriculum_service)
            _competency_service.cosmos_db = cosmos_db
            
            # Initialize - clean and simple
            await _competency_service.initialize()
            logger.info("✅ CompetencyService initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Error creating CompetencyService: {str(e)}")
            logger.warning("🔄 Creating minimal CompetencyService")
            _competency_service = CompetencyService(None)
            _competency_service.cosmos_db = cosmos_db
    
    return _competency_service

async def get_problem_recommender(
    competency_service: CompetencyService = Depends(get_competency_service)
) -> ProblemRecommender:
    """Get or create ProblemRecommender singleton."""
    global _problem_recommender
    if _problem_recommender is None:
        logger.info("Initializing ProblemRecommender")
        _problem_recommender = ProblemRecommender(competency_service)
    return _problem_recommender

async def get_problem_optimizer(
    cosmos_db: CosmosDBService = Depends(get_cosmos_db),
    recommender: ProblemRecommender = Depends(get_problem_recommender)
) -> ProblemOptimizer:
    """Get or create ProblemOptimizer singleton."""
    global _problem_optimizer
    if _problem_optimizer is None:
        logger.info("Initializing ProblemOptimizer")
        _problem_optimizer = ProblemOptimizer(cosmos_db, recommender)
    
    if not hasattr(_problem_optimizer, 'recommender') or _problem_optimizer.recommender is None:
        logger.info("Setting recommender on ProblemOptimizer")
        _problem_optimizer.recommender = recommender
        
    return _problem_optimizer



async def get_problem_service(
    recommender: ProblemRecommender = Depends(get_problem_recommender),
    cosmos_db: CosmosDBService = Depends(get_cosmos_db),
    competency_service: CompetencyService = Depends(get_competency_service),
    problem_optimizer: ProblemOptimizer = Depends(get_problem_optimizer)
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

# Keep other functions that don't need curriculum/competency services as sync
async def get_learning_paths_service(
    blob_service = Depends(get_blob_storage_service),
    competency_service: CompetencyService = Depends(get_competency_service)
) -> LearningPathsService:
    """Get or create LearningPathsService singleton with cloud storage."""
    global _learning_paths_service
    if _learning_paths_service is None:
        logger.info("Initializing LearningPathsService with cloud storage")
        _learning_paths_service = LearningPathsService(
            competency_service=competency_service
        )
    
    return _learning_paths_service

async def get_analytics_extension(competency_service: CompetencyService = Depends(get_competency_service)):
    """Get or create AnalyticsExtension instance."""
    from .services.analytics import AnalyticsExtension
    
    extension = AnalyticsExtension(competency_service)
    if competency_service.cosmos_db:
        extension.cosmos_db = competency_service.cosmos_db
    
    return extension

def get_daily_activities_service(
    analytics_service: BigQueryAnalyticsService = Depends(get_bigquery_analytics_service),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service),
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
) -> DailyActivitiesService:
    """Get or create Daily Activities service singleton with all dependencies."""
    global _daily_activities_service
    if _daily_activities_service is None:
        logger.info("Initializing Daily Activities Service")
        try:
            _daily_activities_service = DailyActivitiesService(
                analytics_service=analytics_service,
                learning_paths_service=learning_paths_service,
                cosmos_db_service=cosmos_db
            )
            logger.info("✅ Daily Activities Service initialized successfully")
        except Exception as e:
            logger.error(f"❌ Error initializing Daily Activities Service: {str(e)}")
            logger.warning("🔄 Falling back to minimal Daily Activities Service")
            _daily_activities_service = DailyActivitiesService()
    
    return _daily_activities_service

def get_gemini_problem_integration(
    problem_service: ProblemService = Depends(get_problem_service)
) -> GeminiProblemIntegration:
    """Create a new GeminiProblemIntegration instance with injected dependencies."""
    logger.debug("Creating new GeminiProblemIntegration")
    gemini_problem = GeminiProblemIntegration()
    gemini_problem.problem_service = problem_service
    return gemini_problem

async def initialize_services():
    """Initialize all singleton services for ETL processes."""
    logger.info("Initializing all services for ETL processes")
    
    # Initialize base services
    cosmos_db = get_cosmos_db()
    
    # Initialize blob storage
    if not blob_storage_service._initialized:
        await blob_storage_service.initialize()

    # Initialize BigQuery analytics service
    analytics_service = get_bigquery_analytics_service()
    await analytics_service.initialize()

    # Initialize curriculum service
    curriculum_service = await get_curriculum_service()

    # Initialize competency service and connect curriculum service
    competency_service = get_competency_service(cosmos_db)
    competency_service.curriculum_service = curriculum_service  # <-- ADD THIS LINE!
    await competency_service.initialize()
    
    # Initialize dependent services
    competency_service = get_competency_service(cosmos_db)
    problem_recommender = get_problem_recommender(competency_service)
    problem_optimizer = get_problem_optimizer(cosmos_db, problem_recommender)
    review_service = get_review_service(cosmos_db)
    
    # Initialize learning paths service
    learning_paths_service = await get_learning_paths_service(
        blob_storage_service, 
        competency_service
    )
    
    
    # Initialize daily activities service
    daily_activities_service = get_daily_activities_service(
        analytics_service,
        learning_paths_service, 
        cosmos_db
    )
    
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
        "curriculum_service": curriculum_service,
        "competency_service": competency_service,
        "problem_recommender": problem_recommender,
        "problem_service": problem_service,
        "problem_optimizer": problem_optimizer,
        "review_service": review_service,
        "learning_paths_service": learning_paths_service,
        "analytics_service": analytics_service,
        "daily_activities_service": daily_activities_service,
        "user_profiles_service": user_profiles_service  # 🔥 NEW: Include user profiles service
    }