"""
Pydantic models for prerequisite relationships
"""

from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel, Field


EntityType = Literal["skill", "subskill"]


class PrerequisiteBase(BaseModel):
    """Base model for Prerequisite"""
    prerequisite_entity_id: str
    prerequisite_entity_type: EntityType
    unlocks_entity_id: str
    unlocks_entity_type: EntityType
    min_proficiency_threshold: Optional[float] = Field(default=0.8, ge=0.0, le=1.0)


class PrerequisiteCreate(PrerequisiteBase):
    """Model for creating a new prerequisite relationship"""
    pass


class Prerequisite(PrerequisiteBase):
    """Complete prerequisite model"""
    prerequisite_id: str
    version_id: str
    is_draft: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EntityPrerequisites(BaseModel):
    """Prerequisites for a specific entity"""
    entity_id: str
    entity_type: EntityType
    prerequisites: List[Prerequisite] = []  # What this entity requires
    unlocks: List[Prerequisite] = []  # What this entity unlocks


class PrerequisiteGraph(BaseModel):
    """Graph representation of prerequisites"""
    nodes: List[dict] = []  # List of {id, type, label}
    edges: List[dict] = []  # List of {source, target, threshold}
