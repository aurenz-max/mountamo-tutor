# backend/app/core/config.py

from pydantic_settings import BaseSettings
from pydantic import Field  # ← ADD THIS IMPORT
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Tutor"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database settings
    DATABASE_URL: str = "sqlite:///./ai_tutor.db"

    DEFAULT_AI_SERVICE: str

    DEFAULT_AI_REVIEW_SERVICE: str
    
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
    GEMINI_GENERATE_KEY: str
    GEMINI_ASSESSMENT_PROMPT: str
    GEMINI_TUTOR_PROMPT: str

    GEMINI_STT_API_KEY: str

    IMAGE_LIBRARY_PATH: str
    
    # Azure Blob Storage Configuration
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AZURE_STORAGE_ACCOUNT_KEY: str = ""
    AZURE_STORAGE_CONTAINER_NAME: str = "audio-files"
    
    # Curriculum-specific storage settings
    CURRICULUM_CONTAINER_NAME: str = "curriculum-data"
    CURRICULUM_CACHE_TTL_MINUTES: int = 60  # Cache curriculum for 1 hour

    LEARNING_PATHS_CONTAINER_NAME: str = "learning-paths-data"

    # BigQuery Configuration
    GCP_PROJECT_ID: str = Field(env="GCP_PROJECT_ID")
    BIGQUERY_DATASET_ID: str = Field(default="analytics", env="BIGQUERY_DATASET_ID")
    
    # Google Cloud Authentication
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = Field(None, env="GOOGLE_APPLICATION_CREDENTIALS")


    # Cache Configuration
    ANALYTICS_CACHE_TTL_MINUTES: int = Field(default=15, env="ANALYTICS_CACHE_TTL_MINUTES")
    ENABLE_QUERY_CACHING: bool = Field(default=True, env="ENABLE_QUERY_CACHING")
    
    # ETL Configuration
    ETL_BATCH_SIZE: int = Field(default=1000, env="ETL_BATCH_SIZE")
    ETL_MAX_RETRIES: int = Field(default=3, env="ETL_MAX_RETRIES")
    
    # Cost Management
    DAILY_QUERY_BUDGET_USD: float = Field(default=1.0, env="DAILY_QUERY_BUDGET_USD")
    ALERT_ON_HIGH_COSTS: bool = Field(default=True, env="ALERT_ON_HIGH_COSTS")

    # # PostgreSQL settings
    PG_HOST: str 
    PG_DATABASE: str 
    PG_USER: str 
    PG_PASSWORD: str 
    PG_PORT: str 


    # ================================
    # 🔥 FIREBASE AUTHENTICATION CONFIG
    # ================================
    
    # Firebase Admin SDK Configuration
    FIREBASE_ADMIN_CREDENTIALS_PATH: str = Field(
        default="backend/credentials/firebase-admin.json",
        env="FIREBASE_ADMIN_CREDENTIALS_PATH"
    )
    
    # Firebase Project Configuration
    FIREBASE_PROJECT_ID: Optional[str] = Field(None, env="FIREBASE_PROJECT_ID")
    FIREBASE_WEB_API_KEY: Optional[str] = Field(None, env="FIREBASE_WEB_API_KEY")
    FIREBASE_AUTH_DOMAIN: Optional[str] = Field(None, env="FIREBASE_AUTH_DOMAIN")
    
    # Authentication Security Settings
    AUTH_PASSWORD_MIN_LENGTH: int = Field(default=8, env="AUTH_PASSWORD_MIN_LENGTH")
    AUTH_REQUIRE_EMAIL_VERIFICATION: bool = Field(default=False, env="AUTH_REQUIRE_EMAIL_VERIFICATION")
    AUTH_ENABLE_MFA: bool = Field(default=False, env="AUTH_ENABLE_MFA")
    AUTH_SESSION_TIMEOUT_MINUTES: int = Field(default=60, env="AUTH_SESSION_TIMEOUT_MINUTES")
    
    # Rate Limiting for Auth Endpoints
    AUTH_RATE_LIMIT_REQUESTS: int = Field(default=5, env="AUTH_RATE_LIMIT_REQUESTS")
    AUTH_RATE_LIMIT_WINDOW_MINUTES: int = Field(default=15, env="AUTH_RATE_LIMIT_WINDOW_MINUTES")
    
    # User Profile Storage Configuration
    USER_PROFILES_CONTAINER_NAME: str = Field(default="user-profiles", env="USER_PROFILES_CONTAINER_NAME")
    AUTH_ANALYTICS_ENABLED: bool = Field(default=True, env="AUTH_ANALYTICS_ENABLED")

    RATE_LIMIT_ENABLED: bool = True
    AUTH_PASSWORD_MIN_LENGTH: int = 8
    
    @property
    def firebase_admin_credentials_full_path(self) -> str:
        """Get the absolute path to Firebase admin credentials"""
        base_dir = Path(__file__).parent.parent.parent  # Go up to project root
        return str(base_dir / self.FIREBASE_ADMIN_CREDENTIALS_PATH)
    
    @property
    def firebase_credentials_exist(self) -> bool:
        """Check if Firebase credentials file exists"""
        return Path(self.firebase_admin_credentials_full_path).exists()
        
    def get_firebase_config_for_frontend(self) -> dict:
        """Get Firebase config for frontend (excluding sensitive data)"""
        return {
            "apiKey": self.FIREBASE_WEB_API_KEY,
            "authDomain": self.FIREBASE_AUTH_DOMAIN,
            "projectId": self.FIREBASE_PROJECT_ID,
        }
    

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()