# backend/app/core/config.py

from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Tutor"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database settings
    DATABASE_URL: str = "sqlite:///./ai_tutor.db"
    
    # Anthropic API settings
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # Azure Text-to-Speech settings
    TTS_KEY: Optional[str] = None
    TTS_REGION: Optional[str] = None
    
    # Security settings
    SECRET_KEY: str = "your-secret-key-here"  # Change this!
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    COSMOS_ENDPOINT: str
    COSMOS_KEY: str 
    COSMOS_DATABASE: str

    GEMINI_API_KEY: str
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()