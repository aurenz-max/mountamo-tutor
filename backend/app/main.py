# backend/app/main.py - SIMPLIFIED VERSION

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware

# Import existing endpoints
from .api.endpoints import (
    auth, 
    competency, 
    curriculum, 
    problems, 
    learning_paths, 
    gemini, 
    analytics, 
    playground, 
    education,
    user_profiles,
    daily_activities,
    daily_briefing_live,
    packages,
    practice_tutor
    
)

from .api import etl_routes
from .core.config import settings

# 🔥 SIMPLIFIED: Import only the core auth dependency
from .core.middleware import get_user_context

import logging

# Configure root logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),  # Console output
    ]
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="4.0.0",  # Updated version for simplified auth
    description="AI Tutor API with Simplified Firebase Authentication"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"], 
)

# 3. Basic logging middleware (removing rate limiting for now)
@app.middleware("http")
async def basic_logging(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response

# ============================================================================
# PUBLIC ENDPOINTS - No authentication required
# ============================================================================

app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])

# ============================================================================
# AUTHENTICATED ENDPOINTS - Simple consistent pattern
# ============================================================================

# All authenticated endpoints use the same dependency: Depends(get_user_context)
# Each endpoint handles its own activity logging internally

app.include_router(
    user_profiles.router, 
    prefix="/api/user-profiles", 
    tags=["user-profiles"],
    dependencies=[Depends(get_user_context)]
)

app.include_router(
    competency.router, 
    prefix="/api/competency", 
    tags=["competency"]   
)

app.include_router(
    curriculum.router, 
    prefix="/api/curriculum", 
    tags=["curriculum"],
    dependencies=[Depends(get_user_context)]
)

app.include_router(
    problems.router, 
    prefix="/api/problems", 
    tags=["problems"],
    dependencies=[Depends(get_user_context)]
)

app.include_router(
    learning_paths.router, 
    prefix="/api", 
    tags=["learning-paths"],
    dependencies=[Depends(get_user_context)]
)

app.include_router(
    gemini.router, 
    prefix="/api/gemini", 
    tags=["gemini"],
    dependencies=[Depends(get_user_context)]
)

app.include_router(
    analytics.router, 
    prefix="/api/analytics", 
    tags=["analytics"],
    dependencies=[Depends(get_user_context)]
)

app.include_router(
    playground.router, 
    prefix="/api/playground", 
    tags=["playground"],
    dependencies=[Depends(get_user_context)]
)

app.include_router(
    education.router, 
    prefix="/api/packages", 
    tags=["education"]
    # Note: Auth handled per-route like daily_briefing_live
)

# 🔥 NEW: Packages and Discovery Threads 
app.include_router(
    packages.router, 
    prefix="/api/packages", 
    tags=["packages"],
    dependencies=[Depends(get_user_context)]
)

# 🔥 COMPATIBILITY: Keep discovery threads route for existing frontend
app.include_router(
    packages.router, 
    prefix="/api/discovery", 
    tags=["discovery-threads"],
    dependencies=[Depends(get_user_context)]
)

# 🔥 NEW: Daily Activities Endpoint
app.include_router(
    daily_activities.router, 
    prefix="/api/daily-activities", 
    tags=["daily-activities"],
    dependencies=[Depends(get_user_context)]
)

# Add this router registration
app.include_router(
    daily_briefing_live.router, 
    prefix="/api", 
    tags=["daily-briefing"]
)

# Practice Tutor WebSocket Router (no auth dependency - handled in websocket)
app.include_router(
    practice_tutor.router, 
    prefix="/api", 
    tags=["practice-tutor"]
)


# ============================================================================
# ROOT ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    return {
        "message": "Welcome to AI Tutor API with Simplified Firebase Authentication",
        "version": "4.0.0",
        "docs_url": "/docs",
        "auth_endpoints": {
            "register": "/api/auth/register",
            "config": "/api/auth/config", 
            "verify": "/api/auth/verify-token",
            "profile": "/api/user-profiles/profile",
            "dashboard": "/api/user-profiles/dashboard"
        },
        "authenticated_endpoints": {
            "problems": "/api/problems",
            "visual_problems": "/api/visual-problems",  # 🔥 NEW: Visual Problem Library
            "analytics": "/api/analytics", 
            "curriculum": "/api/curriculum",
            "competency": "/api/competency",
            "daily_activities": "/api/daily-activities",
            "discovery_threads": "/api/discovery"  # 🔥 NEW: Discovery threads for packages
        },
        "features": {
            "simplified_authentication": True,
            "automatic_student_mapping": True,
            "user_profiles": True,
            "activity_tracking": True,
            "points_system": True,
            "badges": True,
            "streaks": True,
            "data_isolation": True,
            "daily_activities": True,
            "discovery_threads": True  # 🔥 NEW: Discovery threads for learning packages
        }
    }

@app.get("/health")
async def health_check():
    """Comprehensive health check"""
    return {
        "status": "healthy",
        "service": "ai_tutor_api",
        "version": "4.0.0",
        "auth_architecture": "simplified",
        "features": {
            "authentication": True,
            "user_profiles": True,
            "activity_tracking": True,
            "competency_system": True,
            "curriculum_engine": True,
            "firebase_integration": True,
            "automatic_student_mapping": True,
            "simplified_dependencies": True,
            "daily_activities": True,
            "discovery_threads": True  # 🔥 NEW: Discovery threads for packages
        },
        "endpoints": {
            "auth": "/api/auth/health",
            "profiles": "/api/user-profiles/health",
            "problems": "/api/problems/health",
            "analytics": "/api/analytics/health",
            "daily_activities": "/api/daily-activities/health",  # 🔥 NEW: Added health endpoint
            "docs": "/docs"
        }
    }

# ============================================================================
# TEST ENDPOINTS - For verifying the simplified auth
# ============================================================================

@app.get("/api/test-auth")
async def test_authentication(user_context: dict = Depends(get_user_context)):
    """Test endpoint to verify simplified authentication"""
    return {
        "message": "🎉 Simplified Authentication successful!",
        "user_id": user_context["user_id"],
        "email": user_context["email"],
        "student_id": user_context["student_id"],
        "grade_level": user_context.get("grade_level"),
        "authenticated": True,
        "auth_version": "simplified_4.0"
    }

@app.get("/api/test-student-mapping")
async def test_student_mapping(user_context: dict = Depends(get_user_context)):
    """Test endpoint to verify student mapping works"""
    return {
        "message": "Student mapping successful",
        "firebase_uid": user_context["firebase_uid"],
        "student_id": user_context["student_id"],
        "user_email": user_context["email"],
        "has_profile": user_context["profile"] is not None,
        "total_points": user_context.get("total_points", 0),
        "current_streak": user_context.get("current_streak", 0)
    }