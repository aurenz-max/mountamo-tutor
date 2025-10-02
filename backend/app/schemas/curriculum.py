# backend/app/schemas/curriculum.py
"""
Curriculum Pydantic Schemas

These schemas define the curriculum structure used across the application.
They match the frontend TypeScript types exactly to ensure end-to-end type safety.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ============================================================================
# CORE CURRICULUM SCHEMAS
# ============================================================================

class CurriculumUnit(BaseModel):
    """Curriculum unit schema"""
    id: str = Field(..., description="Unit ID (e.g., 'SS001', 'COUNT001')")
    title: str = Field(..., description="Unit title")
    description: Optional[str] = Field(None, description="Unit description")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "SS001",
                "title": "Classroom Routines and Social Skills",
                "description": "Classroom Routines and Social Skills"
            }
        }


class CurriculumSkill(BaseModel):
    """Curriculum skill schema"""
    id: str = Field(..., description="Skill ID (e.g., 'SS001-04', 'COUNT001-01')")
    description: str = Field(..., description="Skill description")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "SS001-04",
                "description": "Local Governance"
            }
        }


class CurriculumSubskill(BaseModel):
    """Curriculum subskill schema"""
    id: str = Field(..., description="Subskill ID (e.g., 'SS001-04-E', 'COUNT001-01-A')")
    description: str = Field(..., description="Subskill description")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "SS001-04-E",
                "description": "Create simple maps showing locations of local public services"
            }
        }


class CurriculumMetadata(BaseModel):
    """
    Complete curriculum metadata attached to activities.
    This is the SOURCE OF TRUTH for curriculum IDs.
    """
    subject: str = Field(..., description="Subject name")
    unit: CurriculumUnit = Field(..., description="Unit information")
    skill: CurriculumSkill = Field(..., description="Skill information")
    subskill: CurriculumSubskill = Field(..., description="Subskill information")

    class Config:
        json_schema_extra = {
            "example": {
                "subject": "Social Studies",
                "unit": {
                    "id": "SS001",
                    "title": "Classroom Routines and Social Skills",
                    "description": "Classroom Routines and Social Skills"
                },
                "skill": {
                    "id": "SS001-04",
                    "description": "Local Governance"
                },
                "subskill": {
                    "id": "SS001-04-E",
                    "description": "Create simple maps showing locations of local public services"
                }
            }
        }


# ============================================================================
# CURRICULUM QUERY/RESPONSE SCHEMAS
# ============================================================================

class CurriculumItem(BaseModel):
    """Individual curriculum item from BigQuery"""
    subject: str
    grade: Optional[str] = None
    unit_id: str
    unit_title: str
    skill_id: str
    skill_description: str
    subskill_id: str
    subskill_description: str
    difficulty_start: Optional[int] = None
    difficulty_end: Optional[int] = None
    target_difficulty: Optional[int] = None

    def to_curriculum_metadata(self) -> CurriculumMetadata:
        """Convert to CurriculumMetadata schema"""
        return CurriculumMetadata(
            subject=self.subject,
            unit=CurriculumUnit(
                id=self.unit_id,
                title=self.unit_title,
                description=self.unit_title
            ),
            skill=CurriculumSkill(
                id=self.skill_id,
                description=self.skill_description
            ),
            subskill=CurriculumSubskill(
                id=self.subskill_id,
                description=self.subskill_description
            )
        )


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_curriculum_metadata(
    subject: str,
    unit_id: str,
    unit_title: str,
    skill_id: str,
    skill_description: str,
    subskill_id: str,
    subskill_description: str,
    unit_description: Optional[str] = None
) -> CurriculumMetadata:
    """Helper to create CurriculumMetadata from individual fields"""
    return CurriculumMetadata(
        subject=subject,
        unit=CurriculumUnit(
            id=unit_id,
            title=unit_title,
            description=unit_description or unit_title
        ),
        skill=CurriculumSkill(
            id=skill_id,
            description=skill_description
        ),
        subskill=CurriculumSubskill(
            id=subskill_id,
            description=subskill_description
        )
    )
