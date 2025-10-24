"""
Configuration management for the Curriculum Authoring Service
"""

import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    # Service Configuration
    SERVICE_NAME: str = "curriculum-authoring-service"
    SERVICE_PORT: int = 8001
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    DISABLE_AUTH: bool = False  # Set to True for local development without auth

    # Google Cloud Configuration
    GOOGLE_CLOUD_PROJECT: str
    BIGQUERY_DATASET_ID: str = "curriculum_authoring"
    GOOGLE_APPLICATION_CREDENTIALS: str

    # Firebase Configuration (used for authentication and Firestore graph caching)
    FIREBASE_PROJECT_ID: str
    FIREBASE_CREDENTIALS_PATH: str = Field(default="")  # Path to Firebase service account JSON
    FIREBASE_WEB_API_KEY: str = ""
    FIREBASE_AUTH_DOMAIN: str = ""

    # Gemini AI Configuration
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GEMINI_TEMPERATURE: float = 0.7
    GEMINI_MAX_TOKENS: int = 2048

    # Azure Cosmos DB Configuration (DEPRECATED - migrated to Firestore)
    # These are kept for backward compatibility but are no longer required
    COSMOS_ENDPOINT: str = Field(default="", env="COSMOS_ENDPOINT")
    COSMOS_KEY: str = Field(default="", env="COSMOS_KEY")
    COSMOS_DATABASE: str = Field(default="curriculum_authoring", env="COSMOS_DATABASE")
    COSMOS_GRAPH_CONTAINER: str = Field(default="curriculum_graphs", env="COSMOS_GRAPH_CONTAINER")

    # CORS Configuration
    ALLOWED_ORIGINS: str = "http://localhost:3001"

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS into a list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    # Cache Configuration
    CACHE_TTL_MINUTES: int = 30

    # Version Control
    DEFAULT_VERSION_DESCRIPTION: str = "Initial version"
    AUTO_DRAFT_SAVE: bool = True

    # Database Table Names
    TABLE_SUBJECTS: str = "curriculum_subjects"
    TABLE_UNITS: str = "curriculum_units"
    TABLE_SKILLS: str = "curriculum_skills"
    TABLE_SUBSKILLS: str = "curriculum_subskills"
    TABLE_PREREQUISITES: str = "curriculum_prerequisites"
    TABLE_VERSIONS: str = "curriculum_versions"

    def get_table_id(self, table_name: str) -> str:
        """Get fully qualified BigQuery table ID"""
        return f"{self.GOOGLE_CLOUD_PROJECT}.{self.BIGQUERY_DATASET_ID}.{table_name}"


# Global settings instance
settings = Settings()
