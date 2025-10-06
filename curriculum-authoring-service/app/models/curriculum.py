"""
Pydantic models for curriculum entities
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class SubjectBase(BaseModel):
    """Base model for Subject"""
    subject_id: str
    subject_name: str
    description: Optional[str] = None
    grade_level: Optional[str] = None


class SubjectCreate(SubjectBase):
    """Model for creating a new subject"""
    pass


class SubjectUpdate(BaseModel):
    """Model for updating a subject"""
    subject_name: Optional[str] = None
    description: Optional[str] = None
    grade_level: Optional[str] = None


class Subject(SubjectBase):
    """Complete subject model"""
    version_id: str
    is_active: bool
    is_draft: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


class UnitBase(BaseModel):
    """Base model for Unit"""
    unit_id: str
    subject_id: str
    unit_title: str
    unit_order: Optional[int] = None
    description: Optional[str] = None


class UnitCreate(UnitBase):
    """Model for creating a new unit"""
    pass


class UnitUpdate(BaseModel):
    """Model for updating a unit"""
    unit_title: Optional[str] = None
    unit_order: Optional[int] = None
    description: Optional[str] = None


class Unit(UnitBase):
    """Complete unit model"""
    version_id: str
    is_draft: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SkillBase(BaseModel):
    """Base model for Skill"""
    skill_id: str
    unit_id: str
    skill_description: str
    skill_order: Optional[int] = None


class SkillCreate(SkillBase):
    """Model for creating a new skill"""
    pass


class SkillUpdate(BaseModel):
    """Model for updating a skill"""
    skill_description: Optional[str] = None
    skill_order: Optional[int] = None


class Skill(SkillBase):
    """Complete skill model"""
    version_id: str
    is_draft: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubskillBase(BaseModel):
    """Base model for Subskill"""
    subskill_id: str
    skill_id: str
    subskill_description: str
    subskill_order: Optional[int] = None
    difficulty_start: Optional[float] = None
    difficulty_end: Optional[float] = None
    target_difficulty: Optional[float] = None


class SubskillCreate(SubskillBase):
    """Model for creating a new subskill"""
    pass


class SubskillUpdate(BaseModel):
    """Model for updating a subskill"""
    subskill_description: Optional[str] = None
    subskill_order: Optional[int] = None
    difficulty_start: Optional[float] = None
    difficulty_end: Optional[float] = None
    target_difficulty: Optional[float] = None


class Subskill(SubskillBase):
    """Complete subskill model"""
    version_id: str
    is_draft: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Hierarchical models for tree view
class SubskillNode(BaseModel):
    """Subskill node for tree view"""
    id: str
    description: str
    order: Optional[int] = None
    difficulty_range: Optional[dict] = None
    is_draft: bool


class SkillNode(BaseModel):
    """Skill node for tree view"""
    id: str
    description: str
    order: Optional[int] = None
    is_draft: bool
    subskills: List[SubskillNode] = []


class UnitNode(BaseModel):
    """Unit node for tree view"""
    id: str
    title: str
    order: Optional[int] = None
    description: Optional[str] = None
    is_draft: bool
    skills: List[SkillNode] = []


class CurriculumTree(BaseModel):
    """Complete curriculum tree structure"""
    subject_id: str
    subject_name: str
    grade_level: Optional[str] = None
    version_id: str
    units: List[UnitNode] = []
