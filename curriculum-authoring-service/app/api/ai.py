"""
AI-assisted curriculum authoring API endpoints

Includes:
  - Content generation (generate-unit, generate-skill)
  - Legacy prerequisite suggestions
  - Scoped edge suggestions (suggest-edges, connect-skills, accept)
  - PRD-driven authoring workflow (author-unit, accept, reject, regenerate)
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from pydantic import BaseModel

from app.core.security import require_designer
from app.services.ai_assistant import ai_assistant
from app.models.scoped_suggestions import (
    ScopedSuggestionRequest,
    ScopedSuggestionResponse,
    ConnectSkillsRequest,
    ConnectSkillsResponse,
    AcceptScopedSuggestionsRequest,
    AcceptScopedSuggestionsResponse,
)
from app.models.authoring import (
    AuthorSubjectRequest,
    AuthorSubjectResponse,
    AuthorUnitRequest,
    AuthorUnitResponse,
    AcceptUnitRequest,
    AcceptUnitResponse,
    RejectUnitRequest,
    RejectUnitResponse,
    RegenerateUnitRequest,
    ListPreviewsResponse,
    GenerateSkillRequest as AuthoringGenerateSkillRequest,
    GenerateSkillResponse,
)

router = APIRouter()


class GenerateUnitRequest(BaseModel):
    """Request to generate a curriculum unit"""
    subject: str
    grade: str
    topic_prompt: str
    context: Optional[str] = None


class LegacyGenerateSkillRequest(BaseModel):
    """Legacy request model — kept for backwards compat, unused"""
    subject: str
    unit_title: str
    skill_prompt: str


class SuggestPrerequisitesRequest(BaseModel):
    """Request to suggest prerequisites"""
    subject: str
    entity_id: str
    entity_description: str
    available_prerequisites: List[dict]  # [{"id": "...", "description": "..."}]


class ImproveDescriptionRequest(BaseModel):
    """Request to improve a description"""
    original_description: str
    entity_type: str  # 'unit', 'skill', 'subskill'
    subject: str


@router.post("/ai/generate-unit")
async def generate_unit(
    request: GenerateUnitRequest
):
    """Generate a complete curriculum unit using AI"""
    try:
        result = await ai_assistant.generate_unit(
            subject=request.subject,
            grade=request.grade,
            topic_prompt=request.topic_prompt,
            context=request.context
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/ai/generate-skill")
async def generate_skill(
    body: AuthoringGenerateSkillRequest,
    request: Request,
):
    """Generate a skill with subskills using the Gemini authoring pipeline.

    Uses the same rich schema, primitive catalog, and description format
    as author-unit. The generated skill is appended to the specified unit
    in curriculum_drafts.
    """
    service = _get_authoring_service(request)
    try:
        result = await service.generate_skill(body)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI skill generation failed: {str(e)}")


@router.post("/ai/suggest-prerequisites")
async def suggest_prerequisites(
    request: SuggestPrerequisitesRequest
):
    """Get AI suggestions for prerequisite relationships"""
    try:
        suggestions = await ai_assistant.suggest_prerequisites(
            subject=request.subject,
            entity_id=request.entity_id,
            entity_description=request.entity_description,
            available_prerequisites=request.available_prerequisites
        )
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI suggestion failed: {str(e)}")


@router.post("/ai/improve-description")
async def improve_description(
    request: ImproveDescriptionRequest
):
    """Improve a curriculum description using AI"""
    try:
        improved = await ai_assistant.improve_description(
            original_description=request.original_description,
            entity_type=request.entity_type,
            subject=request.subject
        )
        return {
            "original": request.original_description,
            "improved": improved
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI improvement failed: {str(e)}")


# ------------------------------------------------------------------ #
#  Scoped Edge Suggestions (Graph-Aware Authoring)
# ------------------------------------------------------------------ #

def _get_scoped_service(request: Request):
    """Retrieve the ScopedSuggestionService from app state."""
    service = getattr(request.app.state, "scoped_suggestion_service", None)
    if not service:
        raise HTTPException(
            status_code=503,
            detail="Scoped suggestion service not initialized"
        )
    return service


@router.post("/ai/suggest-edges", response_model=ScopedSuggestionResponse)
async def suggest_edges(
    body: ScopedSuggestionRequest,
    request: Request,
):
    """Generate scoped edge suggestions for a narrow set of skills/subskills.

    Lightweight alternative to the bulk suggestion pipeline — runs 1-2
    Gemini calls against the author-defined scope in < 5 seconds.
    """
    service = _get_scoped_service(request)
    try:
        return await service.suggest_edges(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoped suggestion failed: {str(e)}")


@router.post("/ai/connect-skills", response_model=ConnectSkillsResponse)
async def connect_skills(
    body: ConnectSkillsRequest,
    request: Request,
):
    """Find all subskill-level connections between exactly two skills.

    Supports cross-grade connections when source_subject_id != target_subject_id.
    """
    service = _get_scoped_service(request)
    try:
        return await service.connect_skills(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connect skills failed: {str(e)}")


@router.post("/ai/suggest-edges/accept", response_model=AcceptScopedSuggestionsResponse)
async def accept_scoped_suggestions(
    body: AcceptScopedSuggestionsRequest,
    request: Request,
):
    """Accept scoped edge suggestions — creates draft edges via EdgeManager.

    Uses the same EdgeManager.create_edge() and on_mutation hooks as the
    bulk pipeline's accept workflow.
    """
    service = _get_scoped_service(request)
    try:
        return await service.accept_suggestions(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Accept suggestions failed: {str(e)}")


# ================================================================== #
#  PRD-Driven Authoring Workflow
#
#  Flow: ensure-subject -> author-unit (pending in drafts) ->
#        review -> accept/reject/regenerate
#  All state lives in curriculum_drafts — no separate preview collection.
# ================================================================== #

def _get_authoring_service(request: Request):
    """Retrieve the AuthoringService from app state."""
    service = getattr(request.app.state, "authoring_service", None)
    if not service:
        raise HTTPException(
            status_code=503,
            detail="Authoring service not initialized"
        )
    return service


@router.post("/ai/author-subject", response_model=AuthorSubjectResponse)
async def author_subject(
    body: AuthorSubjectRequest,
    request: Request,
):
    """Create or retrieve a subject shell for PRD-driven authoring.

    Call this first before authoring units. Returns the subject with
    any already-authored units so you know where to pick up.
    """
    service = _get_authoring_service(request)
    try:
        result = await service.ensure_subject(
            subject_id=body.subject_id,
            subject_name=body.subject_name,
            grade=body.grade,
            description=body.description,
        )
        return AuthorSubjectResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Subject creation failed: {str(e)}")


@router.post("/ai/author-unit", response_model=AuthorUnitResponse)
async def author_unit(
    body: AuthorUnitRequest,
    request: Request,
):
    """Generate a Lumina-first unit from PRD context.

    The unit is written directly to curriculum_drafts as a pending entry.
    Review and call accept or reject next.
    """
    service = _get_authoring_service(request)
    try:
        preview = await service.author_unit(body)
        return AuthorUnitResponse(
            preview=preview,
            message=f"Generated {preview.unit_id}: {preview.lumina_coverage.total_subskills} subskills, "
                    f"{preview.lumina_coverage.coverage_pct:.0f}% Lumina coverage. "
                    f"Review and call /ai/author-unit/accept or /ai/author-unit/reject.",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unit generation failed: {str(e)}")


@router.post("/ai/author-unit/accept", response_model=AcceptUnitResponse)
async def accept_authored_unit(
    body: AcceptUnitRequest,
    request: Request,
):
    """Accept a pending unit — flips status to accepted in curriculum_drafts.

    After acceptance, the unit's subskills appear in the subskill_index
    and are included in stats. Ready for graph edge building.
    """
    service = _get_authoring_service(request)
    try:
        result = await service.accept_unit(
            preview_id=body.preview_id,
            subject_id=body.subject_id,
            grade=body.grade,
        )
        return AcceptUnitResponse(
            **result,
            message=f"Accepted: {result['skills_created']} skills, "
                    f"{result['subskills_created']} subskills now active in drafts.",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Accept failed: {str(e)}")


@router.post("/ai/author-unit/reject", response_model=RejectUnitResponse)
async def reject_authored_unit(
    body: RejectUnitRequest,
    request: Request,
):
    """Reject a pending unit. Optionally provide feedback for regeneration."""
    service = _get_authoring_service(request)
    try:
        result = await service.reject_unit(
            preview_id=body.preview_id,
            subject_id=body.subject_id,
            grade=body.grade,
            feedback=body.feedback,
        )
        return RejectUnitResponse(
            preview_id=result["preview_id"],
            status=result["status"],
            message="Rejected. Call /ai/author-unit/regenerate to regenerate with feedback.",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reject failed: {str(e)}")


@router.post("/ai/author-unit/regenerate", response_model=AuthorUnitResponse)
async def regenerate_authored_unit(
    body: RegenerateUnitRequest,
    request: Request,
):
    """Regenerate a rejected unit with additional feedback incorporated."""
    service = _get_authoring_service(request)
    try:
        preview = await service.regenerate_unit(
            preview_id=body.preview_id,
            subject_id=body.subject_id,
            grade=body.grade,
            additional_feedback=body.additional_feedback,
            custom_instructions=body.custom_instructions,
        )
        return AuthorUnitResponse(
            preview=preview,
            message=f"Regenerated {preview.unit_id}: {preview.lumina_coverage.total_subskills} subskills, "
                    f"{preview.lumina_coverage.coverage_pct:.0f}% Lumina coverage.",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


@router.get("/ai/author-previews/{subject_id}", response_model=ListPreviewsResponse)
async def list_authored_previews(
    subject_id: str,
    grade: str,
    request: Request,
):
    """List all unit previews for a subject with status counts.

    Use this to see progress: which units are pending review, accepted, or rejected.
    Pass grade as a query parameter.
    """
    service = _get_authoring_service(request)
    try:
        result = await service.list_previews(subject_id, grade)
        return ListPreviewsResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"List previews failed: {str(e)}")
