"""
AI-assisted curriculum authoring API endpoints

Includes:
  - Content generation (generate-unit, generate-skill)
  - Primitive & eval-mode recommendation (suggest-primitives)
  - Scoped edge suggestions (suggest-edges, connect-skills, accept)
  - PRD-driven authoring workflow (author-unit, accept, reject, regenerate)
"""

import json
import logging

from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from pydantic import BaseModel, Field

from google import genai
from google.genai import types as genai_types

from app.core.config import settings
from app.core.security import require_designer
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
logger = logging.getLogger(__name__)

LLM_MODEL = "gemini-3.1-flash-lite-preview"


# ------------------------------------------------------------------ #
#  Primitive & Eval-Mode Recommendation
# ------------------------------------------------------------------ #

class PrimitiveSuggestionRequest(BaseModel):
    """Request body for POST /api/ai/suggest-primitives."""
    subskill_description: str
    difficulty_start: Optional[float] = None
    difficulty_end: Optional[float] = None
    target_difficulty: Optional[float] = None
    grade: str = ""
    subject_id: str = ""
    # The frontend sends the catalog so the LLM knows what's available
    catalog: List[dict] = Field(default_factory=list)


class PrimitiveSuggestion(BaseModel):
    """A single recommended primitive + eval modes."""
    primitive_id: str
    rationale: str = ""
    recommended_eval_modes: List[str] = []
    eval_mode_rationale: str = ""
    confidence: float = 0.8


class PrimitiveSuggestionResponse(BaseModel):
    suggestions: List[PrimitiveSuggestion] = []
    reasoning: str = ""


@router.post("/ai/suggest-primitives", response_model=PrimitiveSuggestionResponse)
async def suggest_primitives(body: PrimitiveSuggestionRequest):
    """Recommend primitives and eval modes for a subskill using Gemini.

    The frontend sends the available catalog (with eval modes) so the LLM
    can reason about the best visual + eval-mode pairing for the subskill.
    """
    if not body.catalog:
        raise HTTPException(status_code=400, detail="Catalog is required")

    # Build a compact catalog summary for the prompt (include eval mode descriptions)
    catalog_lines = []
    for p in body.catalog:
        line = f"- {p['id']} ({p.get('domain', '?')}): {p.get('description', '')}"
        eval_modes = p.get('evalModes', [])
        if eval_modes:
            mode_strs = [
                f"{em['evalMode']}(β{em.get('beta', '?')},S{em.get('scaffoldingMode', '?')}"
                f": {em.get('description', '')})"
                for em in eval_modes
            ]
            line += f"\n  Eval modes: {'; '.join(mode_strs)}"
        catalog_lines.append(line)
    catalog_text = "\n".join(catalog_lines)

    difficulty_note = ""
    if body.target_difficulty is not None:
        difficulty_note = (
            f"\nDifficulty hint: {body.difficulty_start or 0}–{body.difficulty_end or 10}, "
            f"target ≈{body.target_difficulty}. Use β values as a soft guide, not a hard filter."
        )

    prompt = f"""You are an expert curriculum designer for a K-12 adaptive learning platform.

## Task
Given a subskill description, recommend exactly ONE primitive from the catalog below
that most directly teaches or assesses this specific subskill.
Do NOT recommend multiple primitives. The curriculum provides breadth across subskills —
each subskill maps to one focused tool.

## Subskill
Description: {body.subskill_description}
Grade: {body.grade or 'not specified'}
Subject: {body.subject_id or 'not specified'}{difficulty_note}

## Available Primitives Catalog
{catalog_text}

## Instructions
1. Pick exactly ONE primitive. Prefer specialized subject primitives (e.g., number-tracer
   for writing numerals, counting-board for counting) over general knowledge-check primitives.
2. Consider the specific pedagogical concepts a student must practice to master THIS subskill.
   Select 1-2 eval modes that directly exercise those concepts — no more.
   If selecting 2 modes, clearly justify why both are needed for this subskill (e.g., a
   progression from guided to independent practice of the SAME concept).
3. The subskill description is authoritative — if it says "write", select a writing mode.
   Do not go beyond this subskill or select modes for adjacent skills.
4. Return valid primitive IDs and eval mode keys EXACTLY as listed in the catalog.
5. Provide brief rationales (max 20 words each)."""

    schema = genai_types.Schema(
        type=genai_types.Type.OBJECT,
        properties={
            "suggestions": genai_types.Schema(
                type=genai_types.Type.ARRAY,
                items=genai_types.Schema(
                    type=genai_types.Type.OBJECT,
                    properties={
                        "primitive_id": genai_types.Schema(type=genai_types.Type.STRING),
                        "rationale": genai_types.Schema(type=genai_types.Type.STRING),
                        "recommended_eval_modes": genai_types.Schema(
                            type=genai_types.Type.ARRAY,
                            items=genai_types.Schema(type=genai_types.Type.STRING),
                        ),
                        "eval_mode_rationale": genai_types.Schema(type=genai_types.Type.STRING),
                        "confidence": genai_types.Schema(type=genai_types.Type.NUMBER),
                    },
                    required=["primitive_id", "rationale", "recommended_eval_modes", "confidence"],
                ),
            ),
            "reasoning": genai_types.Schema(type=genai_types.Type.STRING),
        },
        required=["suggestions", "reasoning"],
    )

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=LLM_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=2048,
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        result = json.loads(response.text)
        logger.info(
            f"[SUGGEST-PRIMITIVES] {len(result.get('suggestions', []))} suggestions "
            f"for: {body.subskill_description[:80]}"
        )
        return PrimitiveSuggestionResponse(**result)

    except Exception as e:
        logger.error(f"Primitive suggestion failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI suggestion failed: {str(e)}")


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
