# backend/app/api/endpoints/auth.py
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
import firebase_admin
from firebase_admin import auth, credentials
import logging
import json

# Import your existing config
from ...core.config import settings

# Import new security utilities
from ...core.security import (
    SecureUserRegistration, 
    SecurePasswordChangeRequest,
    InputSanitizer,
    check_rate_limit,
    check_user_rate_limit,
    get_client_ip,
    SecurityLogger
)

router = APIRouter()
security = HTTPBearer()
logger = logging.getLogger(__name__)

# Firebase Admin SDK initialization (unchanged)
_firebase_app = None

def initialize_firebase():
    """Initialize Firebase Admin SDK with credentials from JSON env var or file"""
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    try:
        cred = None

        # Option 1: Use JSON credentials from environment variable (Cloud Run + Secret Manager)
        if settings.FIREBASE_ADMIN_CREDENTIALS_JSON:
            logger.info("🔥 Loading Firebase credentials from environment variable (Secret Manager)")
            try:
                credentials_dict = json.loads(settings.FIREBASE_ADMIN_CREDENTIALS_JSON)
                cred = credentials.Certificate(credentials_dict)
                logger.info("✅ Firebase credentials loaded from JSON environment variable")
            except json.JSONDecodeError as e:
                logger.error(f"❌ Failed to parse FIREBASE_ADMIN_CREDENTIALS_JSON: {str(e)}")
                raise ValueError(f"Invalid JSON in FIREBASE_ADMIN_CREDENTIALS_JSON: {str(e)}")

        # Option 2: Use credentials file (Local development)
        elif settings.firebase_credentials_exist:
            logger.info(f"🔥 Loading Firebase credentials from file: {settings.FIREBASE_ADMIN_CREDENTIALS_PATH}")
            cred = credentials.Certificate(settings.firebase_admin_credentials_full_path)
            logger.info(f"✅ Firebase credentials loaded from file")

        else:
            raise FileNotFoundError(
                f"Firebase credentials not found. Either set FIREBASE_ADMIN_CREDENTIALS_JSON "
                f"environment variable or ensure file exists at: {settings.firebase_admin_credentials_full_path}"
            )

        # Initialize Firebase Admin SDK
        _firebase_app = firebase_admin.initialize_app(cred, {
            'projectId': settings.FIREBASE_PROJECT_ID,
        })

        logger.info("🔥 Firebase Admin SDK initialized successfully")
        logger.info(f"📁 Project ID: {settings.FIREBASE_PROJECT_ID}")

        return _firebase_app

    except Exception as e:
        logger.error(f"❌ Failed to initialize Firebase: {str(e)}")
        logger.error(f"📁 FIREBASE_ADMIN_CREDENTIALS_JSON set: {bool(settings.FIREBASE_ADMIN_CREDENTIALS_JSON)}")
        logger.error(f"📁 Credentials file path: {settings.firebase_admin_credentials_full_path}")
        logger.error(f"📁 Credentials file exists: {settings.firebase_credentials_exist}")
        raise HTTPException(
            status_code=500,
            detail=f"Firebase initialization failed: {str(e)}"
        )

def get_firebase_app():
    """Get Firebase app instance"""
    if _firebase_app is None:
        initialize_firebase()
    return _firebase_app

# Initialize Firebase on module load
try:
    initialize_firebase()
except Exception as e:
    logger.warning(f"⚠️ Firebase initialization failed during startup: {str(e)}")

# Response models (unchanged)
class AuthResponse(BaseModel):
    message: str
    uid: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Get current authenticated user"""
    return await verify_firebase_token(credentials, request)

# Enhanced authentication utilities
async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    request: Request = None
) -> dict:
    """Enhanced Firebase token verification with security checks"""
    
    client_ip = get_client_ip(request) if request else "unknown"
    
    try:
        # Rate limit token verification attempts
        if request:
            check_rate_limit(request, limit=30, window_seconds=60, key_suffix="token_verify")
        
        # Ensure Firebase is initialized
        if _firebase_app is None:
            initialize_firebase()
        
        # Extract and validate token format
        token = credentials.credentials.replace('Bearer ', '')
        
        if not token or len(token) < 10:
            SecurityLogger.log_security_event(
                event_type="invalid_token_format",
                request=request,
                success=False,
                details={"token_length": len(token) if token else 0},
                severity="WARNING"
            )
            raise HTTPException(status_code=401, detail="Invalid token format")
        
        # Verify with Firebase
        decoded_token = auth.verify_id_token(token)
        
        # Additional security checks
        current_time = datetime.utcnow().timestamp()
        
        # Check if email is verified (if required)
        if settings.AUTH_REQUIRE_EMAIL_VERIFICATION and not decoded_token.get('email_verified', False):
            SecurityLogger.log_security_event(
                event_type="unverified_email_access_attempt",
                request=request,
                user_email=decoded_token.get('email'),
                success=False,
                severity="WARNING"
            )
            raise HTTPException(status_code=401, detail="Email not verified")
        
        # Log successful authentication
        logger.info(f"✅ User authenticated: {decoded_token.get('email')} from {client_ip}")
        
        return decoded_token
        
    except auth.InvalidIdTokenError:
        SecurityLogger.log_security_event(
            event_type="invalid_token_attempt",
            request=request,
            success=False,
            details={"client_ip": client_ip},
            severity="WARNING"
        )
        raise HTTPException(status_code=401, detail="Invalid authentication token")
        
    except auth.ExpiredIdTokenError:
        SecurityLogger.log_security_event(
            event_type="expired_token_attempt",
            request=request,
            success=False,
            details={"client_ip": client_ip},
            severity="INFO"
        )
        raise HTTPException(status_code=401, detail="Authentication token expired")
        
    except HTTPException:
        # Re-raise HTTP exceptions (like rate limiting)
        raise
        
    except Exception as e:
        SecurityLogger.log_security_event(
            event_type="authentication_error",
            request=request,
            success=False,
            details={"error": str(e), "client_ip": client_ip},
            severity="CRITICAL"
        )
        logger.error(f"❌ Authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")

# ============================================================================
# SECURED API ENDPOINTS
# ============================================================================

@router.post("/register", response_model=AuthResponse)
async def register_user(request: Request, user_data: SecureUserRegistration):
    """Register a new user with comprehensive security"""
    
    # Rate limiting: 3 registrations per 5 minutes per IP
    check_rate_limit(request, limit=3, window_seconds=300, key_suffix="register")
    
    client_ip = get_client_ip(request)
    
    try:
        # Ensure Firebase is initialized
        if _firebase_app is None:
            initialize_firebase()
        
        # Additional password validation using settings
        if len(user_data.password) < getattr(settings, 'AUTH_PASSWORD_MIN_LENGTH', 8):
            raise HTTPException(
                status_code=400, 
                detail=f"Password must be at least {getattr(settings, 'AUTH_PASSWORD_MIN_LENGTH', 8)} characters"
            )
        
        # Create user in Firebase Auth
        user_record = auth.create_user(
            email=user_data.email,
            password=user_data.password,
            display_name=user_data.display_name,
            email_verified=not settings.AUTH_REQUIRE_EMAIL_VERIFICATION
        )
        
        # Log successful registration
        SecurityLogger.log_registration_attempt(
            request=request,
            email=user_data.email,
            success=True,
            details={
                "display_name": user_data.display_name,
                "grade_level": user_data.grade_level,
                "firebase_uid": user_record.uid
            }
        )
        
        logger.info(f"🎉 User registered: {user_data.email} from {client_ip}")
        
        return AuthResponse(
            message="User registered successfully",
            uid=user_record.uid,
            email=user_data.email,
            display_name=user_data.display_name
        )
        
    except auth.EmailAlreadyExistsError:
        SecurityLogger.log_registration_attempt(
            request=request,
            email=user_data.email,
            success=False,
            details={"error": "email_already_exists", "client_ip": client_ip}
        )
        raise HTTPException(status_code=400, detail="Email already registered")
        
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors, rate limiting)
        raise
        
    except Exception as e:
        SecurityLogger.log_registration_attempt(
            request=request,
            email=user_data.email,
            success=False,
            details={"error": str(e), "client_ip": client_ip}
        )
        logger.error(f"❌ Registration failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Registration failed")

@router.get("/config")
async def get_firebase_config(request: Request):
    """Get Firebase configuration for frontend with rate limiting"""
    
    # Rate limit config requests: 10 per minute per IP
    check_rate_limit(request, limit=10, window_seconds=60, key_suffix="config")
    
    return {
        "firebase_config": settings.get_firebase_config_for_frontend(),
        "auth_settings": {
            "require_email_verification": settings.AUTH_REQUIRE_EMAIL_VERIFICATION,
            "password_min_length": getattr(settings, 'AUTH_PASSWORD_MIN_LENGTH', 8),
            "session_timeout_minutes": getattr(settings, 'AUTH_SESSION_TIMEOUT_MINUTES', 60)
        }
    }

@router.post("/verify-token")
async def verify_token(
    request: Request,
    firebase_user: dict = Depends(lambda creds=Depends(security): 
        verify_firebase_token(creds, request))
):
    """Verify authentication token is valid"""
    
    # Additional rate limiting per user
    check_user_rate_limit(
        firebase_user['uid'], 
        limit=60, 
        window_seconds=60, 
        action="token_verify"
    )
    
    return {
        "message": "Token is valid",
        "uid": firebase_user['uid'],
        "email": firebase_user['email'],
        "email_verified": firebase_user.get('email_verified', False)
    }

@router.post("/change-password")
async def change_password(
    request: Request,
    password_data: SecurePasswordChangeRequest,
    firebase_user: dict = Depends(lambda creds=Depends(security): 
        verify_firebase_token(creds, request))
):
    """Change user password with enhanced security"""
    
    # Rate limit password changes: 3 per hour per user
    check_user_rate_limit(
        firebase_user['uid'], 
        limit=3, 
        window_seconds=3600, 
        action="password_change"
    )
    
    try:
        # Validate new password strength (already done by Pydantic model)
        # Additional validation using settings
        min_length = getattr(settings, 'AUTH_PASSWORD_MIN_LENGTH', 8)
        if len(password_data.new_password) < min_length:
            raise HTTPException(
                status_code=400, 
                detail=f"Password must be at least {min_length} characters"
            )
        
        # Check if new password is different from current
        if password_data.current_password == password_data.new_password:
            raise HTTPException(
                status_code=400,
                detail="New password must be different from current password"
            )
        
        # Update password in Firebase Auth
        auth.update_user(
            firebase_user['uid'],
            password=password_data.new_password
        )
        
        # Log password change
        SecurityLogger.log_security_event(
            event_type="password_change",
            request=request,
            user_email=firebase_user['email'],
            user_id=firebase_user['uid'],
            success=True
        )
        
        logger.info(f"🔐 Password changed for user: {firebase_user['email']}")
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
        
    except Exception as e:
        SecurityLogger.log_security_event(
            event_type="password_change_failure",
            request=request,
            user_email=firebase_user['email'],
            user_id=firebase_user['uid'],
            success=False,
            details={"error": str(e)},
            severity="WARNING"
        )
        logger.error(f"❌ Failed to change password: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to change password")

@router.post("/logout")
async def logout_user(
    request: Request,
    firebase_user: dict = Depends(lambda creds=Depends(security): 
        verify_firebase_token(creds, request))
):
    """Logout user and revoke tokens"""
    try:
        # Revoke all refresh tokens for user
        auth.revoke_refresh_tokens(firebase_user['uid'])
        
        SecurityLogger.log_security_event(
            event_type="user_logout",
            request=request,
            user_email=firebase_user['email'],
            user_id=firebase_user['uid'],
            success=True
        )
        
        logger.info(f"🚪 User logged out: {firebase_user['email']}")
        
        return {"message": "Logged out successfully"}
        
    except Exception as e:
        SecurityLogger.log_security_event(
            event_type="logout_failure",
            request=request,
            user_email=firebase_user['email'],
            user_id=firebase_user['uid'],
            success=False,
            details={"error": str(e)},
            severity="WARNING"
        )
        logger.error(f"❌ Logout error: {str(e)}")
        raise HTTPException(status_code=500, detail="Logout failed")

@router.delete("/account")
async def delete_user_account(
    request: Request,
    firebase_user: dict = Depends(lambda creds=Depends(security): 
        verify_firebase_token(creds, request))
):
    """Delete user account with enhanced security logging"""
    
    # Rate limit account deletion: 1 per hour per user (prevent abuse)
    check_user_rate_limit(
        firebase_user['uid'], 
        limit=1, 
        window_seconds=3600, 
        action="account_deletion"
    )
    
    try:
        # Delete user from Firebase Auth
        auth.delete_user(firebase_user['uid'])
        
        SecurityLogger.log_security_event(
            event_type="account_deletion",
            request=request,
            user_email=firebase_user['email'],
            user_id=firebase_user['uid'],
            success=True,
            severity="WARNING"  # Account deletion is significant
        )
        
        logger.info(f"🗑️ User account deleted: {firebase_user['email']}")
        
        return {"message": "Account deleted successfully"}
        
    except Exception as e:
        SecurityLogger.log_security_event(
            event_type="account_deletion_failure",
            request=request,
            user_email=firebase_user['email'],
            user_id=firebase_user['uid'],
            success=False,
            details={"error": str(e)},
            severity="CRITICAL"
        )
        logger.error(f"❌ Failed to delete account: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete account")

@router.get("/health")
async def auth_health_check(request: Request):
    """Health check for authentication service"""
    
    # Light rate limiting for health checks
    check_rate_limit(request, limit=60, window_seconds=60, key_suffix="health")
    
    try:
        # Test Firebase connection
        if _firebase_app is None:
            initialize_firebase()
        
        return {
            "status": "healthy",
            "service": "authentication",
            "firebase_initialized": _firebase_app is not None,
            "credentials_exist": settings.firebase_credentials_exist,
            "security_features": {
                "rate_limiting": "enabled",
                "input_sanitization": "enabled",
                "security_logging": "enabled",
                "password_strength_validation": "enabled"
            },
            "config": {
                "require_email_verification": settings.AUTH_REQUIRE_EMAIL_VERIFICATION,
                "password_min_length": getattr(settings, 'AUTH_PASSWORD_MIN_LENGTH', 8),
                "analytics_enabled": getattr(settings, 'AUTH_ANALYTICS_ENABLED', False)
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "authentication",
            "error": str(e),
            "firebase_initialized": _firebase_app is not None,
            "credentials_exist": settings.firebase_credentials_exist
        }