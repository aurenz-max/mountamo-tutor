"""
Pydantic models for version control and publishing
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class VersionBase(BaseModel):
    """Base model for Version"""
    subject_id: str
    description: Optional[str] = None


class VersionCreate(VersionBase):
    """Model for creating a new version"""
    change_summary: Optional[str] = None


class Version(VersionBase):
    """Complete version model"""
    version_id: str
    version_number: int
    is_active: bool
    created_at: datetime
    activated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    change_summary: Optional[str] = None

    class Config:
        from_attributes = True


class DraftChange(BaseModel):
    """Represents a single draft change"""
    entity_type: str  # 'subject', 'unit', 'skill', 'subskill', 'prerequisite'
    entity_id: str
    change_type: str  # 'created', 'updated', 'deleted'
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None


class DraftSummary(BaseModel):
    """Summary of all draft changes for a subject"""
    subject_id: str
    draft_version_id: Optional[str] = None
    total_changes: int
    changes: List[DraftChange] = []
    created_count: int = 0
    updated_count: int = 0
    deleted_count: int = 0
    prerequisite_changes: int = 0
    can_publish: bool
    validation_errors: List[str] = []


class PublishRequest(BaseModel):
    """Request to publish draft changes"""
    subject_id: str
    version_description: Optional[str] = None
    change_summary: Optional[str] = None


class PublishResponse(BaseModel):
    """Response after publishing"""
    success: bool
    version_id: str
    version_number: int
    changes_published: int
    activated_at: datetime
    message: str
