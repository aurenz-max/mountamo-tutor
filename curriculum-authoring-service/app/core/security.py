"""
Security and authentication for curriculum authoring service
Uses Firebase for designer authentication
"""

import logging
from typing import Optional, Dict
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Firebase Admin
try:
    if settings.FIREBASE_CREDENTIALS_PATH:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    else:
        # Use default credentials
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred, {
        'projectId': settings.FIREBASE_PROJECT_ID
    })
    logger.info("✅ Firebase Admin initialized")
except Exception as e:
    logger.warning(f"⚠️  Firebase initialization failed: {e}")

# HTTP Bearer token scheme
security = HTTPBearer()


async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict:
    """
    Verify Firebase ID token and return user info
    """
    # Bypass auth for local development
    if settings.DISABLE_AUTH:
        logger.warning("⚠️  Authentication disabled - local dev mode")
        return {
            'user_id': 'local-dev-user',
            'email': 'dev@localhost',
            'is_designer': True,
            'is_admin': True,
            'token': {}
        }

    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)

        user_id = decoded_token['uid']
        email = decoded_token.get('email')

        # Check for curriculum designer role (optional - can be added via custom claims)
        custom_claims = decoded_token.get('custom_claims', {})
        is_designer = custom_claims.get('curriculum_designer', False)
        is_admin = custom_claims.get('admin', False)

        return {
            'user_id': user_id,
            'email': email,
            'is_designer': is_designer,
            'is_admin': is_admin,
            'token': decoded_token
        }

    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired"
        )
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )


async def get_current_user(user_info: Dict = Depends(verify_token)) -> Dict:
    """
    Get current authenticated user (any authenticated user can access)
    """
    return user_info


async def require_designer(user_info: Dict = Depends(verify_token)) -> Dict:
    """
    Require curriculum designer role
    """
    if not (user_info.get('is_designer') or user_info.get('is_admin')):
        raise HTTPException(
            status_code=403,
            detail="Curriculum designer role required"
        )
    return user_info


async def require_admin(user_info: Dict = Depends(verify_token)) -> Dict:
    """
    Require admin role (for publishing, version control)
    """
    if not user_info.get('is_admin'):
        raise HTTPException(
            status_code=403,
            detail="Admin role required for this operation"
        )
    return user_info


# Optional: Helper to set custom claims (run once to grant designer role)
def grant_designer_role(user_id: str):
    """Grant curriculum designer role to a user"""
    try:
        auth.set_custom_user_claims(user_id, {'curriculum_designer': True})
        logger.info(f"✅ Granted designer role to user: {user_id}")
    except Exception as e:
        logger.error(f"Failed to grant designer role: {e}")
        raise


def grant_admin_role(user_id: str):
    """Grant admin role to a user"""
    try:
        auth.set_custom_user_claims(user_id, {'admin': True, 'curriculum_designer': True})
        logger.info(f"✅ Granted admin role to user: {user_id}")
    except Exception as e:
        logger.error(f"Failed to grant admin role: {e}")
        raise
