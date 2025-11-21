"""
Content API endpoints - Reading content and visual snippet management
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services.content_service import content_service
from app.models.content import (
    GenerateReadingContentRequest,
    RegenerateSectionRequest,
    UpdateSectionRequest,
    GenerateVisualSnippetRequest,
    UpdateVisualSnippetRequest,
    ReadingContentResponse,
    ReadingSectionResponse,
    VisualSnippetResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== READING CONTENT ENDPOINTS ====================

@router.post("/subskills/{subskill_id}/content/generate", response_model=ReadingContentResponse)
async def generate_reading_content(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum"),
    use_foundations: bool = Query(True, description="Whether to use saved foundations")
):
    """
    Generate complete reading content for a subskill.

    This endpoint:
    - Generates all reading sections with interactive primitives
    - Uses saved foundations (or generates new ones if use_foundations=False)
    - Saves the content to BigQuery
    - Returns the complete package for review

    Use this for:
    - Initial content generation for a new subskill
    - Regenerating all content from scratch
    """
    logger.info(f"📖 POST generate reading content for subskill {subskill_id}, version {version_id}")

    try:
        package = await content_service.generate_reading_content(
            subskill_id=subskill_id,
            version_id=version_id,
            use_foundations=use_foundations
        )

        return ReadingContentResponse(
            success=True,
            data=package,
            message=f"Generated {len(package.sections)} sections of reading content"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating reading content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate reading content: {str(e)}")


@router.get("/subskills/{subskill_id}/content", response_model=ReadingContentResponse)
async def get_reading_content(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum")
):
    """
    Get saved reading content for a subskill.

    Returns:
    - All sections in order
    - Interactive primitives for each section
    - Visual snippet flags
    """
    logger.info(f"📖 GET reading content for subskill {subskill_id}, version {version_id}")

    try:
        package = await content_service.get_reading_content(subskill_id, version_id)

        if not package:
            raise HTTPException(
                status_code=404,
                detail=f"No reading content found for subskill {subskill_id}. Use the /generate endpoint to create it."
            )

        return ReadingContentResponse(
            success=True,
            data=package,
            message="Reading content retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving reading content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve reading content: {str(e)}")


@router.delete("/subskills/{subskill_id}/content")
async def delete_reading_content(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum"),
    cascade_delete_visuals: bool = Query(True, description="Also delete associated visual snippets")
):
    """
    Delete all reading content for a subskill.

    This will:
    - Remove all reading sections from BigQuery
    - Optionally remove associated visual snippets (default: True)

    Use with caution - this action cannot be undone.
    """
    logger.info(f"🗑️ DELETE reading content for subskill {subskill_id}, version {version_id}")

    try:
        success = await content_service.delete_reading_content(
            subskill_id=subskill_id,
            version_id=version_id,
            cascade_delete_visuals=cascade_delete_visuals
        )

        if success:
            return {
                "success": True,
                "message": f"Reading content deleted successfully for subskill {subskill_id}"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to delete reading content")

    except Exception as e:
        logger.error(f"Error deleting reading content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete reading content: {str(e)}")


# ==================== SECTION-LEVEL ENDPOINTS ====================

@router.post("/subskills/{subskill_id}/content/sections/{section_id}/regenerate", response_model=ReadingSectionResponse)
async def regenerate_section(
    subskill_id: str,
    section_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum"),
    custom_prompt: Optional[str] = Query(None, description="Optional custom instructions for regeneration")
):
    """
    Regenerate a specific section of reading content.

    Use this when:
    - You don't like the generated content for one section
    - You want to adjust the tone or focus of a section
    - You want to add different examples or explanations

    The section will be regenerated using:
    - The same master context and terminology
    - The same learning objectives
    - Your custom prompt (if provided)
    """
    logger.info(f"🔄 POST regenerate section {section_id} for subskill {subskill_id}")

    try:
        section = await content_service.regenerate_section(
            subskill_id=subskill_id,
            version_id=version_id,
            section_id=section_id,
            custom_prompt=custom_prompt
        )

        return ReadingSectionResponse(
            success=True,
            data=section,
            message=f"Section '{section.heading}' regenerated successfully"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error regenerating section: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to regenerate section: {str(e)}")


@router.put("/subskills/{subskill_id}/content/sections/{section_id}", response_model=ReadingSectionResponse)
async def update_section(
    subskill_id: str,
    section_id: str,
    updates: UpdateSectionRequest,
    version_id: str = Query(..., description="Version ID for the curriculum")
):
    """
    Update a section with manual edits.

    Use this when:
    - You want to manually edit the section text
    - You want to add/remove/edit interactive primitives
    - You want to update key terms or concepts covered

    Only the fields provided in the request will be updated.
    """
    logger.info(f"✏️ PUT update section {section_id} for subskill {subskill_id}")

    try:
        section = await content_service.update_section(
            subskill_id=subskill_id,
            version_id=version_id,
            section_id=section_id,
            updates=updates
        )

        return ReadingSectionResponse(
            success=True,
            data=section,
            message=f"Section '{section.heading}' updated successfully"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating section: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update section: {str(e)}")


# ==================== VISUAL SNIPPET ENDPOINTS ====================

@router.post("/subskills/{subskill_id}/content/sections/{section_id}/visual/generate", response_model=VisualSnippetResponse)
async def generate_visual_snippet(
    subskill_id: str,
    section_id: str,
    request: GenerateVisualSnippetRequest
):
    """
    Generate an interactive HTML visual snippet for a section.

    This endpoint:
    - Generates a complete, self-contained HTML file
    - Includes interactive elements (click, hover, animations)
    - Uses vanilla JS or simple libraries (p5.js)
    - Saves to BigQuery for reuse

    The visual snippet helps learners understand the concept better through interaction.

    Provide:
    - section_id: Which section to generate for
    - custom_prompt (optional): Specific instructions for the visual
    """
    logger.info(f"🎨 POST generate visual snippet for section {section_id}")

    try:
        # Get the section content
        package = await content_service.get_reading_content(subskill_id, "v1")  # TODO: Get version from request
        if not package:
            raise ValueError(f"No reading content found for {subskill_id}")

        section = next((s for s in package.sections if s.section_id == section_id), None)
        if not section:
            raise ValueError(f"Section {section_id} not found")

        # Generate the visual snippet with section metadata
        snippet = await content_service.generate_visual_snippet(
            subskill_id=subskill_id,
            section_id=section_id,
            section_heading=section.heading,
            section_content=section.content_text,
            key_terms=section.key_terms if hasattr(section, 'key_terms') else None,
            concepts_covered=section.concepts_covered if hasattr(section, 'concepts_covered') else None,
            custom_prompt=request.custom_prompt
        )

        # Update section to mark it has visual
        await content_service.update_section(
            subskill_id=subskill_id,
            version_id=package.version_id,
            section_id=section_id,
            updates=UpdateSectionRequest(has_visual_snippet=True)
        )

        return VisualSnippetResponse(
            success=True,
            data=snippet,
            message=f"Visual snippet generated for section '{section.heading}'"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating visual snippet: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate visual snippet: {str(e)}")


@router.get("/subskills/{subskill_id}/content/sections/{section_id}/visual", response_model=VisualSnippetResponse)
async def get_visual_snippet(
    subskill_id: str,
    section_id: str
):
    """
    Get the saved visual snippet for a section.

    Returns:
    - Complete HTML content
    - Generation prompt used
    - Metadata
    """
    logger.info(f"🔍 GET visual snippet for section {section_id}")

    try:
        snippet = await content_service.get_visual_snippet(subskill_id, section_id)

        if not snippet:
            raise HTTPException(
                status_code=404,
                detail=f"No visual snippet found for section {section_id}. Use the /generate endpoint to create one."
            )

        return VisualSnippetResponse(
            success=True,
            data=snippet,
            message="Visual snippet retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving visual snippet: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve visual snippet: {str(e)}")


@router.put("/subskills/{subskill_id}/content/sections/{section_id}/visual", response_model=VisualSnippetResponse)
async def update_visual_snippet(
    subskill_id: str,
    section_id: str,
    request: UpdateVisualSnippetRequest
):
    """
    Update the HTML content of a visual snippet manually.

    Use this when:
    - You want to tweak the generated HTML
    - You want to fix a bug in the visualization
    - You want to add custom features
    """
    logger.info(f"✏️ PUT update visual snippet for section {section_id}")

    try:
        # Get existing snippet
        snippet = await content_service.get_visual_snippet(subskill_id, section_id)
        if not snippet:
            raise ValueError(f"No visual snippet found for section {section_id}")

        # Update HTML content
        snippet.html_content = request.html_content
        snippet.updated_at = datetime.utcnow()

        # Save to BigQuery
        await content_service._save_visual_snippet_to_bigquery(snippet)

        return VisualSnippetResponse(
            success=True,
            data=snippet,
            message="Visual snippet updated successfully"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating visual snippet: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update visual snippet: {str(e)}")


@router.delete("/subskills/{subskill_id}/content/sections/{section_id}/visual")
async def delete_visual_snippet(
    subskill_id: str,
    section_id: str
):
    """
    Delete the visual snippet for a section.

    This will:
    - Remove the snippet from BigQuery
    - Update the section to mark has_visual_snippet=False
    """
    logger.info(f"🗑️ DELETE visual snippet for section {section_id}")

    try:
        # Delete from BigQuery
        from app.core.database import db
        from app.core.config import settings
        from google.cloud import bigquery

        query = f"""
        DELETE FROM `{settings.get_table_id(settings.TABLE_VISUAL_SNIPPETS)}`
        WHERE subskill_id = @subskill_id AND section_id = @section_id
        """

        parameters = [
            bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
            bigquery.ScalarQueryParameter("section_id", "STRING", section_id)
        ]

        await db.execute_query(query, parameters)

        # Update section flag
        package = await content_service.get_reading_content(subskill_id, "v1")  # TODO: Get version
        if package:
            await content_service.update_section(
                subskill_id=subskill_id,
                version_id=package.version_id,
                section_id=section_id,
                updates=UpdateSectionRequest(has_visual_snippet=False)
            )

        return {"success": True, "message": "Visual snippet deleted successfully"}

    except Exception as e:
        logger.error(f"Error deleting visual snippet: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete visual snippet: {str(e)}")
