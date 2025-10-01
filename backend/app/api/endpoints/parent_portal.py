# backend/app/api/endpoints/parent_portal.py
"""
Parent Portal API Endpoints
Provides parents with visibility into student progress and actionable recommendations
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status, Body
from typing import List, Optional, Dict
from pydantic import BaseModel
import logging
from datetime import datetime

from ...core.middleware import get_user_context
from ...services.parent_portal import get_parent_portal_service, ParentPortalService
from ...models.parent_portal import (
    ParentAccount, ParentStudentLink, ParentDashboard,
    TodaysPlanSummary, WeeklySummaryMetrics, WeeklyExplorerResponse
)


# Request models for onboarding
class OnboardingCompleteRequest(BaseModel):
    """Request body for completing onboarding"""
    notification_preferences: Optional[Dict[str, bool]] = None

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================================================
# PARENT ACCOUNT MANAGEMENT
# ============================================================================

@router.post("/account/create")
async def create_parent_account(
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """Create a parent account for the authenticated user"""
    try:
        parent_uid = user_context['firebase_uid']
        email = user_context['email']
        display_name = user_context.get('display_name')

        parent_account = await service.create_parent_account(
            parent_uid=parent_uid,
            email=email,
            display_name=display_name
        )

        return {
            "success": True,
            "message": "Parent account created successfully",
            "parent_account": parent_account.dict()
        }

    except Exception as e:
        logger.error(f"❌ Failed to create parent account: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create parent account: {str(e)}"
        )


@router.get("/account", response_model=ParentAccount)
async def get_parent_account(
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """Get current parent account"""
    try:
        parent_uid = user_context['firebase_uid']
        parent_account = await service.get_parent_account(parent_uid)

        if not parent_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent account not found"
            )

        return parent_account

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get parent account: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get parent account: {str(e)}"
        )


@router.post("/account/onboarding/complete")
async def complete_parent_onboarding(
    request: OnboardingCompleteRequest,
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """Complete parent onboarding and update notification preferences"""
    try:
        parent_uid = user_context['firebase_uid']

        logger.info(f"📝 Completing onboarding for parent {parent_uid}")

        # Update onboarding status and notification preferences
        parent_account = await service.complete_onboarding(
            parent_uid=parent_uid,
            notification_preferences=request.notification_preferences
        )

        return {
            "success": True,
            "message": "Onboarding completed successfully",
            "parent_account": parent_account.dict()
        }

    except Exception as e:
        logger.error(f"❌ Failed to complete onboarding: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete onboarding: {str(e)}"
        )


@router.get("/account/onboarding/status")
async def get_onboarding_status(
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """Get onboarding status for current parent"""
    try:
        parent_uid = user_context['firebase_uid']
        parent_account = await service.get_parent_account(parent_uid)

        if not parent_account:
            return {
                "completed": False,
                "account_exists": False
            }

        return {
            "completed": parent_account.onboarding_completed,
            "account_exists": True,
            "has_linked_students": len(parent_account.linked_student_ids) > 0
        }

    except Exception as e:
        logger.error(f"❌ Failed to get onboarding status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get onboarding status: {str(e)}"
        )


@router.post("/link-student")
async def link_student_to_parent(
    student_id: int = Query(..., description="Student ID to link"),
    relationship: str = Query("parent", description="Relationship type"),
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """Link a student to the parent account"""
    try:
        parent_uid = user_context['firebase_uid']

        # TODO: Add verification flow (e.g., email confirmation, code from student)
        link = await service.link_student_to_parent(
            parent_uid=parent_uid,
            student_id=student_id,
            relationship=relationship
        )

        return {
            "success": True,
            "message": f"Student {student_id} linked successfully",
            "link": link.dict()
        }

    except Exception as e:
        logger.error(f"❌ Failed to link student: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to link student: {str(e)}"
        )


@router.get("/students")
async def get_linked_students(
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """Get all students linked to the parent account"""
    try:
        parent_uid = user_context['firebase_uid']
        parent_account = await service.get_parent_account(parent_uid)

        if not parent_account:
            return {"students": []}

        return {
            "students": parent_account.linked_student_ids,
            "total": len(parent_account.linked_student_ids)
        }

    except Exception as e:
        logger.error(f"❌ Failed to get linked students: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get linked students: {str(e)}"
        )


# ============================================================================
# DASHBOARD ENDPOINTS (Phase 1)
# ============================================================================

@router.get("/dashboard/{student_id}", response_model=ParentDashboard)
async def get_parent_dashboard(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """
    Get complete parent dashboard for a student
    Includes: today's plan, weekly summary, and key insights
    """
    try:
        parent_uid = user_context['firebase_uid']

        logger.info(f"📊 Parent {parent_uid} requesting dashboard for student {student_id}")

        # Verify access and generate dashboard
        dashboard = await service.get_parent_dashboard(
            parent_uid=parent_uid,
            student_id=student_id
        )

        return dashboard

    except PermissionError as e:
        logger.warning(f"⚠️ Access denied: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"❌ Failed to generate parent dashboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate dashboard: {str(e)}"
        )


@router.get("/student/{student_id}/today", response_model=TodaysPlanSummary)
async def get_todays_plan(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """Get today's learning plan summary for a student"""
    try:
        parent_uid = user_context['firebase_uid']

        # Verify access
        has_access = await service.verify_parent_access(parent_uid, student_id)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this student's data"
            )

        todays_plan = await service._get_todays_plan_summary(student_id)
        return todays_plan

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get today's plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get today's plan: {str(e)}"
        )


@router.get("/student/{student_id}/weekly-summary", response_model=WeeklySummaryMetrics)
async def get_weekly_summary(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """Get 7-day summary metrics for a student"""
    try:
        parent_uid = user_context['firebase_uid']

        # Verify access
        has_access = await service.verify_parent_access(parent_uid, student_id)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this student's data"
            )

        weekly_summary = await service._get_weekly_summary(student_id)
        return weekly_summary

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get weekly summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get weekly summary: {str(e)}"
        )


# ============================================================================
# DEEP DIVE ANALYTICS (Phase 1 - Proxies to existing analytics)
# ============================================================================

@router.get("/student/{student_id}/analytics/metrics")
async def get_student_metrics_for_parent(
    student_id: int,
    subject: Optional[str] = None,
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """
    Get detailed hierarchical metrics for parent deep-dive
    Proxies to analytics endpoint with parent access verification
    """
    try:
        parent_uid = user_context['firebase_uid']

        # Verify access
        has_access = await service.verify_parent_access(parent_uid, student_id)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this student's data"
            )

        # Fetch hierarchical metrics
        metrics = await service.analytics_service.get_hierarchical_metrics(
            student_id=student_id,
            subject=subject
        )

        return {
            "student_id": student_id,
            "metrics": metrics,
            "parent_view": True,
            "generated_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get student metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get student metrics: {str(e)}"
        )


@router.get("/student/{student_id}/analytics/timeseries")
async def get_student_timeseries_for_parent(
    student_id: int,
    subject: Optional[str] = None,
    interval: str = Query("week", regex="^(day|week|month)$"),
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """
    Get time-series metrics for parent progress tracking
    Proxies to analytics endpoint with parent access verification
    """
    try:
        parent_uid = user_context['firebase_uid']

        # Verify access
        has_access = await service.verify_parent_access(parent_uid, student_id)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this student's data"
            )

        # Fetch timeseries metrics
        timeseries = await service.analytics_service.get_timeseries_metrics(
            student_id=student_id,
            subject=subject,
            interval=interval,
            level="subject"
        )

        return {
            "student_id": student_id,
            "interval": interval,
            "timeseries": timeseries,
            "parent_view": True,
            "generated_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get timeseries: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get timeseries: {str(e)}"
        )


# ============================================================================
# WEEKLY EXPLORER (Phase 3)
# ============================================================================

@router.get("/student/{student_id}/weekly-explorer", response_model=WeeklyExplorerResponse)
async def get_weekly_explorer(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: ParentPortalService = Depends(get_parent_portal_service)
):
    """
    Get Weekly Explorer view with upcoming ready items and suggested projects
    """
    try:
        parent_uid = user_context['firebase_uid']

        weekly_explorer = await service.get_weekly_explorer(
            parent_uid=parent_uid,
            student_id=student_id
        )

        return weekly_explorer

    except PermissionError as e:
        logger.warning(f"⚠️ Access denied: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"❌ Failed to get weekly explorer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get weekly explorer: {str(e)}"
        )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def parent_portal_health():
    """Health check for parent portal service"""
    try:
        service = get_parent_portal_service()

        return {
            "status": "healthy",
            "service": "parent_portal",
            "features": {
                "dashboard": True,
                "weekly_summary": True,
                "deep_dive_analytics": True,
                "weekly_explorer": True,
                "ways_to_help": False,  # Phase 2
                "explorer_projects": False,  # Phase 3
                "session_summaries": False  # Phase 4
            },
            "version": "1.0.0-phase1",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
