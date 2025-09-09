# backend/app/api/endpoints/live_sessions.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Path
import asyncio
import json
import logging

from ...services.live_sessions.handlers import (
    PracticeTutorHandler, 
    PackageLearnHandler, 
    DailyBriefingHandler
)
from ...core.utils import authenticate_websocket_token
from ...db.cosmos_db import CosmosDBService

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize shared services
cosmos_db = CosmosDBService()

SESSION_HANDLERS = {
    "practice": PracticeTutorHandler,
    "package": PackageLearnHandler,
    "briefing": DailyBriefingHandler,
}

@router.websocket("/ws/live/{session_type}")
async def unified_live_session(websocket: WebSocket, session_type: str = Path(...)):
    """
    Unified WebSocket endpoint for all Gemini Live sessions.
    - session_type: 'practice', 'package', or 'briefing'
    """
    await websocket.accept()
    
    if session_type not in SESSION_HANDLERS:
        await websocket.close(code=4004, reason="Invalid session type")
        return

    try:
        # 1. Unified Authentication
        logger.info(f"🔐 Waiting for authentication for {session_type} session...")
        init_message = await asyncio.wait_for(websocket.receive_json(), timeout=15.0)
        
        if init_message.get("type") != "authenticate":
            await websocket.close(code=4001, reason="Authentication required")
            return
            
        token = init_message.get("token")
        if not token:
            await websocket.close(code=4002, reason="Authentication token required")
            return
            
        user_context = await authenticate_websocket_token(token)
        
        # Send authentication success
        await websocket.send_json({"type": "auth_success"})
        logger.info(f"✅ Authentication successful for {session_type} session")

        # 2. Handle session-specific data requirements
        initial_data = init_message.get("data", {})
        
        # For practice sessions, require topic_context
        if session_type == "practice":
            if not initial_data.get("topic_context"):
                await websocket.close(code=4005, reason="Topic context required for practice sessions")
                return
        
        # For package sessions, require package_id
        elif session_type == "package":
            if not initial_data.get("package_id"):
                await websocket.close(code=4005, reason="Package ID required for package sessions")
                return
        
        # For briefing sessions, get student_id
        elif session_type == "briefing":
            student_id = initial_data.get("student_id")
            if not student_id:
                # Try to get student_id from user mapping
                firebase_uid = user_context.get("uid")
                if firebase_uid:
                    student_mapping = await cosmos_db.get_student_mapping(firebase_uid)
                    student_id = student_mapping["student_id"] if student_mapping else None
                    if student_id:
                        initial_data["student_id"] = student_id
            
            if not initial_data.get("student_id"):
                await websocket.close(code=4005, reason="Student ID required for briefing sessions")
                return

        # 3. Instantiate and Run the Correct Handler
        handler_class = SESSION_HANDLERS[session_type]
        handler = handler_class(websocket, user_context, initial_data)
        
        logger.info(f"🚀 Starting {session_type} session for user {user_context.get('email')}")
        await handler.run()

    except asyncio.TimeoutError:
        logger.error("Authentication timeout")
        await websocket.close(code=4008, reason="Authentication timeout")
    except Exception as e:
        logger.error(f"Error in unified WebSocket endpoint: {e}", exc_info=True)
        try:
            await websocket.close(code=1011, reason="Server error")
        except:
            pass

# Health check endpoint
@router.get("/live-sessions/health")
async def live_sessions_health_check():
    """Health check for unified live sessions service."""
    try:
        return {
            "status": "healthy",
            "service": "unified_live_sessions",
            "supported_session_types": list(SESSION_HANDLERS.keys()),
            "features": {
                "unified_authentication": True,
                "session_type_routing": True,
                "error_handling": True,
                "gemini_live_integration": True
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }