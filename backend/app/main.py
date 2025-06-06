# backend/app/main.py
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket
from .api.endpoints import tutoring, competency, reviews, curriculum, problems, learning_paths, gemini, visual, analytics, playground, education
from .core.config import settings
import logging

# Set up logging
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI Tutor API for kindergarten education"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"], 
)

# Include routers
app.include_router(tutoring.router, prefix="/api/tutoring", tags=["tutoring"])
app.include_router(competency.router, prefix="/api/competency", tags=["competency"])
app.include_router(curriculum.router, prefix="/api/curriculum", tags=["curriculum"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(problems.router, prefix="/api/problems", tags=["problems"])
app.include_router(learning_paths.router, prefix="/api", tags=["learning-paths"])
app.include_router(gemini.router, prefix="/api/gemini", tags=["gemini"])
app.include_router(visual.router, prefix="/api/visual", tags=["visual"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(playground.router, prefix="/api/playground", tags=["playground"])
app.include_router(education.router, prefix="/api/packages", tags=["education"])


@app.get("/")
async def root():
    return {
        "message": "Welcome to AI Tutor API",
        "version": settings.VERSION,
        "docs_url": "/docs"
    }

