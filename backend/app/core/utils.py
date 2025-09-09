# backend/app/core/utils.py
"""
Shared utility functions for the application.
"""
import logging
from typing import Dict

logger = logging.getLogger(__name__)

async def authenticate_websocket_token(token: str) -> Dict:
    """
    Authenticate WebSocket connection using token from first message.
    Shared utility used across all WebSocket endpoints.
    """
    try:
        from firebase_admin import auth
        
        # Remove 'Bearer ' prefix if present
        clean_token = token.replace('Bearer ', '')
        decoded_token = auth.verify_id_token(clean_token)
        
        logger.info(f"✅ WebSocket user authenticated: {decoded_token.get('email')}")
        return decoded_token
        
    except Exception as e:
        logger.error(f"❌ WebSocket authentication error: {str(e)}")
        raise Exception("Invalid authentication token")