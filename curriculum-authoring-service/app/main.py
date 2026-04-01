"""
Curriculum Authoring Service - Main FastAPI Application
"""

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.firestore_graph_service import firestore_graph_service
from app.db.firestore_curriculum_service import firestore_curriculum_sync
from app.api import curriculum, publishing, ai, graph, edges, agent, lineage

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

    # Initialize Firestore clients
    firestore_graph_service.initialize()
    firestore_curriculum_sync.initialize()

    # Initialize services
    from app.services.edge_manager import edge_manager
    from app.services.graph_cache_manager import graph_cache_manager
    from app.services.graph_analysis import GraphAnalysisEngine
    from app.services.suggestion_engine import SuggestionEngine
    from app.services.graph_agent import CurriculumGraphAgentService
    from app.services.scoped_suggestion_service import ScopedSuggestionService
    from app.services.authoring_service import AuthoringService

    app.state.graph_agent = CurriculumGraphAgentService(
        edge_manager=edge_manager,
        graph_cache=graph_cache_manager,
        suggestion_engine=SuggestionEngine(firestore_client=firestore_curriculum_sync.client),
        analysis_engine=GraphAnalysisEngine(),
        firestore_client=firestore_curriculum_sync.client,
    )
    app.state.scoped_suggestion_service = ScopedSuggestionService(
        edge_manager=edge_manager,
        firestore_client=firestore_curriculum_sync.client,
    )
    app.state.authoring_service = AuthoringService()

    logger.info("✅ Service startup complete")

    yield

    # Shutdown
    logger.info("👋 Shutting down Curriculum Authoring Service")


# Create FastAPI app
app = FastAPI(
    title=settings.SERVICE_NAME,
    description="Curriculum knowledge graph service — defines what students need to master",
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
    edges.router,
    prefix="/api",
    tags=["Knowledge Graph Edges"]
)

app.include_router(
    agent.router,
    prefix="/api/agent",
    tags=["Agentic Graph Analysis"]
)

app.include_router(
    lineage.router,
    prefix="/api/lineage",
    tags=["Curriculum Lineage"]
)


# Root endpoints
@app.get("/")
async def root():
    """Service information"""
    return {
        "service": settings.SERVICE_NAME,
        "version": "2.0.0",
        "description": "Curriculum Knowledge Graph Service — defines what students need to master. Lumina handles how they learn it.",
        "docs": "/docs",
        "status": "operational",
        "features": [
            "Grade-scoped Subject / Unit / Skill / Subskill hierarchy",
            "Canonical grade codes (PK, K, 1-12)",
            "AI-assisted curriculum scaffolding",
            "Lumina primitive assignment",
            "Version control and publishing",
            "Firestore subcollection deployment (curriculum_published/{grade}/subjects/{id})",
            "Knowledge graph edges (prerequisite, builds_on, reinforces, parallel, applies)",
            "Agentic graph analysis (health metrics, anomaly detection, connection suggestions)",
            "Scoped edge suggestions (inline authoring, cross-grade connections)",
            "PRD-driven authoring (generate -> preview -> accept/reject per unit)",
            "Graph caching",
            "RESTful API"
        ],
        "endpoints": {
            "curriculum": "/api/curriculum",
            "edges": "/api/edges",
            "agent": "/api/agent",
            "publishing": "/api/publishing",
            "ai_assistant": "/api/ai",
            "graph": "/api/graph"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.SERVICE_PORT,
        reload=settings.DEBUG
    )
