# backend/app/api/endpoints/reviews.py

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from pydantic import BaseModel

# Import dependencies
from ...dependencies import get_tutoring_service
from ...services.tutoring import TutoringService

router = APIRouter()

@router.get("/sessions/{student_id}")
async def get_student_sessions(
    student_id: int,
    tutoring_service: TutoringService = Depends(get_tutoring_service)
) -> List[Dict[str, Any]]:
    """Get all past sessions for a student"""
    try:
        # For now, filter in-memory sessions
        sessions = [
            session for session in tutoring_service._sessions.values()
            if session["student_id"] == student_id
        ]
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/session/{session_id}")
async def get_session_details(
    session_id: str,
    tutoring_service: TutoringService = Depends(get_tutoring_service)
) -> Dict[str, Any]:
    """Get detailed information about a specific session"""
    try:
        if session_id not in tutoring_service._sessions:
            raise HTTPException(status_code=404, detail="Session not found")
            
        session = tutoring_service._sessions[session_id]
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))