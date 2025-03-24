# backend/app/main.py
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket
from .api.endpoints import tutoring, competency, reviews, curriculum, problems, learning_paths, gemini, visual, progress_reports, analytics
from .core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI Tutor API for kindergarten education"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(tutoring.router, prefix="/api/tutoring", tags=["tutoring"])
app.include_router(competency.router, prefix="/api/competency", tags=["competency"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(problems.router, prefix="/api/problems", tags=["problems"])
app.include_router(learning_paths.router, prefix="/api", tags=["learning-paths"])
app.include_router(gemini.router, prefix="/api/gemini", tags=["gemini"])
app.include_router(visual.router, prefix="/api/visual", tags=["visual"])
app.include_router(progress_reports.router, prefix="/api/progress-reports", tags=["progress-reports"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])

#app.include_router(curriculum.router, prefix="/api/curriculum", tags=["curriculum"])

@app.get("/")
async def root():
    return {
        "message": "Welcome to AI Tutor API",
        "version": settings.VERSION,
        "docs_url": "/docs"
    }