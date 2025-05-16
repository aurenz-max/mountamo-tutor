# app/api/endpoints/read_along.py
from fastapi import APIRouter, HTTPException, Depends, WebSocket, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional, AsyncGenerator
import logging
import asyncio
import json
from datetime import datetime
from app.core.session_manager import SessionManager
from app.services.gemini_read_along import GeminiReadAlongIntegration
from app.dependencies import get_session_manager, get_gemini_read_along

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

router = APIRouter()

class ReadAlongRequest(BaseModel):
    """Model for creating a read-along experience."""
    session_id: str
    student_id: int
    student_grade: str = "kindergarten"
    student_interests: List[str] = []
    reading_level: int = 1
    theme: Optional[str] = None
    with_image: bool = True

class ReadAlongDirectRequest(BaseModel):
    """Model for directly generating a read-along without a tutoring session."""
    student_id: int
    student_grade: str = "kindergarten"
    student_interests: List[str] = []
    reading_level: int = 1
    theme: Optional[str] = None
    with_image: bool = True

@router.post("")
async def generate_read_along(
    request: ReadAlongRequest,
    session_manager: SessionManager = Depends(get_session_manager),
    gemini_read_along: GeminiReadAlongIntegration = Depends(get_gemini_read_along)
):
    """Generate a read-along experience for an existing tutoring session."""
    try:
        # Get the session
        session = session_manager.sessions.get(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {request.session_id} not found")
        
        # Prepare session metadata
        session_metadata = {
            "student_id": request.student_id,
            "student_grade": request.student_grade,
            "student_interests": request.student_interests,
            "reading_level": request.reading_level
        }
        
        # Generate read-along content
        result = await gemini_read_along.generate_read_along(
            session_id=request.session_id,
            session_metadata=session_metadata,
            complexity_level=request.reading_level,
            theme=request.theme,
            with_image=request.with_image
        )
        
        if result.get("status") == "success":
            return result
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get("message", "Unknown error in read-along generation")
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating read-along for session {request.session_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate read-along: {str(e)}")

@router.post("/direct")
async def generate_direct_read_along(
    request: ReadAlongDirectRequest,
    gemini_read_along: GeminiReadAlongIntegration = Depends(get_gemini_read_along)
):
    """Generate a read-along experience directly without a tutoring session."""
    try:
        # Generate a temporary session ID
        temp_session_id = f"direct_{datetime.utcnow().timestamp()}"
        
        # Prepare session metadata
        session_metadata = {
            "student_id": request.student_id,
            "student_grade": request.student_grade,
            "student_interests": request.student_interests,
            "reading_level": request.reading_level
        }
        
        # Generate read-along content
        result = await gemini_read_along.generate_read_along(
            session_id=temp_session_id,
            session_metadata=session_metadata,
            complexity_level=request.reading_level,
            theme=request.theme,
            with_image=request.with_image
        )
        
        if result.get("status") == "success":
            return result
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get("message", "Unknown error in read-along generation")
            )
    
    except Exception as e:
        logger.error(f"Error generating direct read-along: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate read-along: {str(e)}")

@router.websocket("/ws/{session_id}")
async def read_along_stream(
    websocket: WebSocket,
    session_id: str,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """Stream read-along content for a session via WebSocket."""
    try:
        await websocket.accept()
        logger.info(f"WebSocket connection accepted for read-along stream, session {session_id}")
        
        # Get the session
        session = session_manager.sessions.get(session_id)
        if not session:
            await websocket.send_json({
                "status": "error",
                "message": f"Session {session_id} not found"
            })
            await websocket.close()
            return
        
        # Stream read-alongs
        try:
            async for read_along in session.get_read_alongs():
                await websocket.send_json({
                    "status": "success",
                    "data": read_along
                })
        except asyncio.CancelledError:
            logger.info(f"Read-along stream cancelled for session {session_id}")
        except Exception as e:
            logger.error(f"Error streaming read-alongs for session {session_id}: {str(e)}", exc_info=True)
            await websocket.send_json({
                "status": "error",
                "message": f"Error streaming read-alongs: {str(e)}"
            })
    
    except Exception as e:
        logger.error(f"WebSocket error for read-along stream, session {session_id}: {str(e)}", exc_info=True)
    finally:
        try:
            await websocket.close()
        except:
            pass
        logger.info(f"WebSocket connection closed for read-along stream, session {session_id}")

@router.get("/{session_id}")
async def get_session_read_alongs(
    session_id: str,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """Get all read-alongs for a session."""
    try:
        # Get the session
        session = session_manager.sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        # This would need to be implemented in the session manager to store and retrieve read-alongs
        # For now, we just return an empty list
        return {
            "status": "success",
            "read_alongs": []  # This would be populated from stored read-alongs
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting read-alongs for session {session_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get read-alongs: {str(e)}")