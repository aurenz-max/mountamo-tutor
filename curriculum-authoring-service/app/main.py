"""
Curriculum Authoring Service - Main FastAPI Application
"""

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import db
from app.db.firestore_graph_service import firestore_graph_service
from app.api import curriculum, prerequisites, publishing, ai, graph, foundations, content

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle management for the application"""
    # Startup
    logger.info("🚀 Starting Curriculum Authoring Service")

    try:
        # Initialize BigQuery connection
        db.initialize()

        # Setup database tables
        db.setup_all_tables()

        # Initialize Firestore for graph caching
        firestore_graph_service.initialize()

        logger.info("✅ Service startup complete")

    except Exception as e:
        logger.error(f"❌ Service startup failed: {e}")
        raise

    yield

    # Shutdown
    logger.info("👋 Shutting down Curriculum Authoring Service")


# Create FastAPI app
app = FastAPI(
    title=settings.SERVICE_NAME,
    description="AI-powered curriculum authoring and management platform",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"📥 {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"📤 {response.status_code}")
    return response


# Include routers
app.include_router(
    curriculum.router,
    prefix="/api/curriculum",
    tags=["Curriculum Management"]
)

app.include_router(
    prerequisites.router,
    prefix="/api/prerequisites",
    tags=["Prerequisites & Learning Paths"]
)

app.include_router(
    publishing.router,
    prefix="/api/publishing",
    tags=["Publishing & Version Control"]
)

app.include_router(
    ai.router,
    prefix="/api",
    tags=["AI Assistant"]
)

app.include_router(
    graph.router,
    prefix="/api",
    tags=["Curriculum Graph & Caching"]
)

app.include_router(
    foundations.router,
    prefix="/api",
    tags=["AI Foundations"]
)

app.include_router(
    content.router,
    prefix="/api",
    tags=["Content Generation"]
)


# Root endpoints
@app.get("/")
async def root():
    """Service information"""
    return {
        "service": settings.SERVICE_NAME,
        "version": "1.0.0",
        "description": "Curriculum Authoring Service API",
        "docs": "/docs",
        "status": "operational",
        "features": [
            "Visual curriculum editor",
            "Prerequisite graph management",
            "AI-assisted content generation",
            "AI Foundations (Master Context, Context Primitives)",
            "Reading content generation with interactive primitives",
            "Visual snippet generation (interactive HTML)",
            "Section-level content editing",
            "Version control and publishing",
            "RESTful API"
        ],
        "endpoints": {
            "curriculum": "/api/curriculum",
            "prerequisites": "/api/prerequisites",
            "publishing": "/api/publishing",
            "ai_assistant": "/api/ai",
            "graph": "/api/graph",
            "foundations": "/api/subskills/{subskill_id}/foundations",
            "content": "/api/subskills/{subskill_id}/content"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test BigQuery connection
        test_query = f"SELECT 1 as test"
        await db.execute_query(test_query)

        return {
            "status": "healthy",
            "service": settings.SERVICE_NAME,
            "database": "connected",
            "bigquery_project": settings.GOOGLE_CLOUD_PROJECT,
            "bigquery_dataset": settings.BIGQUERY_DATASET_ID
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.SERVICE_PORT,
        reload=settings.DEBUG
    )
