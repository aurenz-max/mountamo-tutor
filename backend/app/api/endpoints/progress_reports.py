# backend/app/api/endpoints/progress_reports.py

from fastapi import APIRouter, HTTPException, Depends, Query, Path
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging

# Import dependencies
from ...dependencies import get_competency_service, get_learning_analytics_service, get_progress_report_generator
from ...services.competency import CompetencyService
from ...services.learning_analytics import LearningAnalyticsService, ProgressReportGenerator

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

router = APIRouter()

class ReportRequest(BaseModel):
    student_id: int
    format_type: Optional[str] = "markdown"  # Can be "markdown", "html", or "text"
    subject_filter: Optional[str] = None

class TutorBriefRequest(BaseModel):
    student_id: int
    subject: Optional[str] = None
    format_type: Optional[str] = "json"  # Can be "json" or "markdown"

@router.post("/generate")
async def generate_progress_report(
    request: ReportRequest,
    progress_report_generator: ProgressReportGenerator = Depends(get_progress_report_generator)
) -> Dict[str, Any]:
    """Generate a comprehensive progress report for a student"""
    logger.info(f"POST /generate request for student_id: {request.student_id}")
    try:
        # Ensure we're using the provided student_id
        student_id = request.student_id if request.student_id != 0 else 1
        
        report_data = await progress_report_generator.generate_student_report(
            student_id=student_id,
            format_type=request.format_type
        )
        
        # If subject filter is provided, filter the report
        if request.subject_filter and "profile" in report_data:
            # Filter subject data in profile
            if "subjects" in report_data["profile"]:
                filtered_subjects = {}
                for subject, data in report_data["profile"]["subjects"].items():
                    if subject.lower() == request.subject_filter.lower():
                        filtered_subjects[subject] = data
                
                report_data["profile"]["subjects"] = filtered_subjects
            
            # Regenerate formatted report with filtered data
            if request.format_type == "markdown":
                report_data["formatted_report"] = progress_report_generator._format_markdown_report(
                    report_data["profile"], report_data
                )
            elif request.format_type == "html":
                report_data["formatted_report"] = progress_report_generator._format_html_report(
                    report_data["profile"], report_data
                )
            else:
                report_data["formatted_report"] = progress_report_generator._format_text_report(
                    report_data["profile"], report_data
                )
        
        logger.info(f"Successfully generated report for student_id: {student_id}")
        return {
            "student_id": student_id,
            "timestamp": datetime.now().isoformat(),
            "report": report_data
        }
    except Exception as e:
        logger.error(f"Error generating progress report: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}")
async def get_student_progress_report(
    student_id: int = Path(..., description="The ID of the student"),
    format_type: str = Query("markdown", description="Report format: markdown, html, or text"),
    subject: Optional[str] = Query(None, description="Filter report by subject"),
    progress_report_generator: ProgressReportGenerator = Depends(get_progress_report_generator)
) -> Dict[str, Any]:
    """Get a progress report for a student (GET endpoint version)"""
    logger.info(f"GET /student/{student_id} request with format: {format_type}")
    try:
        # Ensure we're using the provided student_id (1 as default if 0)
        student_id = student_id if student_id != 0 else 1
        
        report_data = await progress_report_generator.generate_student_report(
            student_id=student_id,
            format_type=format_type
        )
        
        # Filter by subject if provided
        if subject and "profile" in report_data and "subjects" in report_data["profile"]:
            filtered_subjects = {}
            for subj, data in report_data["profile"]["subjects"].items():
                if subj.lower() == subject.lower():
                    filtered_subjects[subj] = data
            
            report_data["profile"]["subjects"] = filtered_subjects
            
            # Regenerate formatted report with filtered data
            if format_type == "markdown":
                report_data["formatted_report"] = progress_report_generator._format_markdown_report(
                    report_data["profile"], report_data
                )
            elif format_type == "html":
                report_data["formatted_report"] = progress_report_generator._format_html_report(
                    report_data["profile"], report_data
                )
            else:
                report_data["formatted_report"] = progress_report_generator._format_text_report(
                    report_data["profile"], report_data
                )
        
        logger.info(f"Successfully generated report for student_id: {student_id}")
        return {
            "student_id": student_id,
            "timestamp": datetime.now().isoformat(),
            "report": report_data
        }
    except Exception as e:
        logger.error(f"Error getting student progress report: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}/insights")
async def get_student_insights(
    student_id: int = Path(..., description="The ID of the student"),
    limit: int = Query(5, description="Maximum number of insights to return"),
    analytics_service: LearningAnalyticsService = Depends(get_learning_analytics_service)
) -> Dict[str, Any]:
    """Get key insights for a student"""
    logger.info(f"GET /student/{student_id}/insights request with limit: {limit}")
    try:
        # Ensure we're using the provided student_id (1 as default if 0)
        student_id = student_id if student_id != 0 else 1
        
        # Get student profile
        profile = await analytics_service.get_student_profile(student_id)
        
        # Get top insights
        insights = profile.insights[:limit]
        
        logger.info(f"Successfully retrieved {len(insights)} insights for student_id: {student_id}")
        return {
            "student_id": student_id,
            "timestamp": datetime.now().isoformat(),
            "insights": [insight.dict() for insight in insights]
        }
    except Exception as e:
        logger.error(f"Error getting student insights: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}/focus-areas")
async def get_focus_areas(
    student_id: int = Path(..., description="The ID of the student"),
    analytics_service: LearningAnalyticsService = Depends(get_learning_analytics_service)
) -> Dict[str, Any]:
    """Get recommended focus areas for a student"""
    logger.info(f"GET /student/{student_id}/focus-areas request")
    try:
        # Ensure we're using the provided student_id (1 as default if 0)
        student_id = student_id if student_id != 0 else 1
        
        # Get student profile
        profile = await analytics_service.get_student_profile(student_id)
        
        logger.info(f"Successfully retrieved {len(profile.recommended_focus)} focus areas for student_id: {student_id}")
        return {
            "student_id": student_id,
            "timestamp": datetime.now().isoformat(),
            "focus_areas": profile.recommended_focus
        }
    except Exception as e:
        logger.error(f"Error getting focus areas: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tutor-brief")
async def generate_tutor_brief(
    request: TutorBriefRequest,
    progress_report_generator: ProgressReportGenerator = Depends(get_progress_report_generator)
) -> Dict[str, Any]:
    """Generate a tutor brief for AI tutor integration"""
    logger.info(f"POST /tutor-brief request for student_id: {request.student_id}")
    try:
        # Ensure we're using the provided student_id (1 as default if 0)
        student_id = request.student_id if request.student_id != 0 else 1
        
        # Generate the full report
        report_data = await progress_report_generator.generate_student_report(
            student_id=student_id,
            format_type="markdown"  # We'll use markdown for the formatted section
        )
        
        # Extract the tutor brief
        tutor_brief = report_data["tutor_brief"]
        
        # Filter by subject if provided
        if request.subject and "subjects" in report_data["profile"]:
            # Filter relevant data
            if "areas_of_focus" in tutor_brief:
                tutor_brief["areas_of_focus"] = [
                    area for area in tutor_brief["areas_of_focus"]
                    if area["subject"].lower() == request.subject.lower()
                ]
            
            if "strengths" in tutor_brief:
                tutor_brief["strengths"] = [
                    strength for strength in tutor_brief["strengths"]
                    if "subject" not in strength or strength["subject"].lower() == request.subject.lower()
                ]
        
        # Format response based on requested format
        if request.format_type == "markdown":
            # Generate a markdown version of the tutor brief
            md_brief = f"# Tutor Brief for Student {student_id}\n\n"
            md_brief += f"**Overall Status:** {tutor_brief.get('overall_status', 'N/A')}\n\n"
            
            md_brief += "## Strengths\n\n"
            for strength in tutor_brief.get("strengths", []):
                if "skill_name" in strength:
                    md_brief += f"* **{strength['skill_name']}** ({strength.get('subject', 'N/A')}): {strength.get('mastery_level', 0)*100:.1f}% mastery\n"
                else:
                    md_brief += f"* {strength.get('description', 'N/A')}\n"
            
            md_brief += "\n## Areas of Focus\n\n"
            for area in tutor_brief.get("areas_of_focus", []):
                md_brief += f"* **{area.get('title', 'N/A')}**: {area.get('description', 'N/A')}\n"
            
            md_brief += "\n## Recommendations\n\n"
            for rec in tutor_brief.get("recommendations", []):
                md_brief += f"* {rec.get('description', 'N/A')}\n"
            
            tutor_brief["formatted_brief"] = md_brief
        
        logger.info(f"Successfully generated tutor brief for student_id: {student_id}")
        return {
            "student_id": student_id,
            "timestamp": datetime.now().isoformat(),
            "brief": tutor_brief
        }
    except Exception as e:
        logger.error(f"Error generating tutor brief: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))