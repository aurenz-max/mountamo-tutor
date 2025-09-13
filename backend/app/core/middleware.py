# backend/app/core/middleware.py - FIXED VERSION
from fastapi import Depends, HTTPException, status
from typing import Dict, Any, Optional
import logging

from ..api.endpoints.auth import verify_firebase_token
from ..db.cosmos_db import CosmosDBService

logger = logging.getLogger(__name__)

# Single global instance
_cosmos_db_service = None

def get_cosmos_db_service() -> CosmosDBService:
    """Get or create Cosmos DB service singleton"""
    global _cosmos_db_service
    if _cosmos_db_service is None:
        _cosmos_db_service = CosmosDBService()
    return _cosmos_db_service

# ============================================================================
# CORE AUTH DEPENDENCIES - Only 3 needed
# ============================================================================

async def require_auth(firebase_user: dict = Depends(verify_firebase_token)) -> dict:
    """Basic authentication - just verify token"""
    return firebase_user

async def get_user_context(firebase_user: dict = Depends(verify_firebase_token)) -> dict:
    """
    Single comprehensive user context function
    This replaces all the specialized auth functions
    """
    try:
        # FIXED: Import the service directly instead of endpoint function
        from ..services.user_profiles import user_profiles_service
        
        # Get user profile using the service
        user_profile = await user_profiles_service.get_user_profile(firebase_user['uid'])
        
        # Get or create student mapping
        cosmos_db = get_cosmos_db_service()
        student_mapping = await cosmos_db.get_or_create_student_mapping(
            firebase_uid=firebase_user['uid'],
            email=firebase_user['email'],
            display_name=firebase_user.get('name') or firebase_user.get('display_name', firebase_user['email'].split('@')[0])
        )
        
        return {
            # Firebase data
            "user_id": firebase_user['uid'],
            "firebase_uid": firebase_user['uid'],
            "email": firebase_user['email'],
            "display_name": firebase_user.get('name') or firebase_user.get('display_name'),
            
            # Student mapping
            "student_id": student_mapping["student_id"],
            
            # Profile data (with defaults for missing profiles)
            "profile": user_profile.dict() if user_profile else None,
            "grade_level": user_profile.grade_level if user_profile else None,
            "total_points": user_profile.total_xp if user_profile else 0,
            "current_streak": user_profile.current_streak if user_profile else 0,
            "badges": user_profile.badges if user_profile else [],
            "preferences": user_profile.preferences if user_profile else {}
        }
        
    except Exception as e:
        logger.error(f"Failed to get user context: {str(e)}")
        # IMPROVED: More specific error handling for debugging
        logger.error(f"Exception type: {type(e).__name__}")
        logger.error(f"Firebase user data: {firebase_user}")
        raise HTTPException(status_code=500, detail="Failed to get user context")

async def validate_student_access(
    requested_student_id: int,
    user_context: Dict[str, Any] = Depends(get_user_context)
) -> dict:
    """Validate user can access the requested student_id"""
    user_student_id = user_context.get("student_id")
    
    if not user_student_id:
        raise HTTPException(status_code=500, detail="No student mapping found")
    
    if user_student_id != requested_student_id:
        # Check if dev mode allows cross-access
        from ..core.config import settings
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ACCESS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {requested_student_id}"
            )
    
    return user_context