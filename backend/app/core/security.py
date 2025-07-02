# backend/app/core/security.py
"""
Comprehensive security utilities for sanitization and rate limiting
"""
import re
import html
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from fastapi import HTTPException, Request
from pydantic import BaseModel, validator
import json
from collections import defaultdict
import asyncio

logger = logging.getLogger(__name__)

# ============================================================================
# SANITIZATION UTILITIES
# ============================================================================

class InputSanitizer:
    """Comprehensive input sanitization"""
    
    # Dangerous patterns to detect
    XSS_PATTERNS = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe[^>]*>.*?</iframe>',
        r'<object[^>]*>.*?</object>',
        r'<embed[^>]*>.*?</embed>',
        r'<link[^>]*>',
        r'<meta[^>]*>',
    ]
    
    # SQL injection patterns
    SQL_PATTERNS = [
        r'(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bupdate\b)',
        r'(\bor\b|\band\b)\s+\d+\s*=\s*\d+',
        r'[\'";]',
    ]
    
    @classmethod
    def sanitize_string(cls, value: str, max_length: int = 255, allow_html: bool = False) -> str:
        """Sanitize a string input"""
        if not value:
            return ""
        
        # Basic cleanup
        value = value.strip()
        
        # Length check
        if len(value) > max_length:
            raise ValueError(f"Input too long. Maximum {max_length} characters allowed.")
        
        # Check for dangerous patterns
        cls._check_xss_patterns(value)
        cls._check_sql_patterns(value)
        
        # HTML escape if not allowing HTML
        if not allow_html:
            value = html.escape(value)
        
        # Remove null bytes and control characters
        value = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', value)
        
        return value
    
    @classmethod
    def sanitize_email(cls, email: str) -> str:
        """Sanitize email with additional checks"""
        email = cls.sanitize_string(email, max_length=254)
        
        # Additional email-specific validation
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            raise ValueError("Invalid email format")
        
        return email.lower()
    
    @classmethod
    def sanitize_display_name(cls, name: str) -> str:
        """Sanitize display name with specific rules"""
        name = cls.sanitize_string(name, max_length=50)
        
        if len(name) < 2:
            raise ValueError("Display name must be at least 2 characters")
        
        # Only allow letters, numbers, spaces, and basic punctuation
        if not re.match(r'^[a-zA-Z0-9\s\-_.\']+$', name):
            raise ValueError("Display name contains invalid characters")
        
        return name
    
    @classmethod
    def sanitize_grade_level(cls, grade: str) -> str:
        """Sanitize and validate grade level"""
        if not grade:
            return "K"  # Default to Kindergarten
        
        grade = grade.strip().upper()
        
        # Normalize various input formats
        grade_mapping = {
            "KINDERGARTEN": "K",
            "K": "K",
            "1": "1st", "1ST": "1st", "FIRST": "1st",
            "2": "2nd", "2ND": "2nd", "SECOND": "2nd",
            "3": "3rd", "3RD": "3rd", "THIRD": "3rd",
            "4": "4th", "4TH": "4th", "FOURTH": "4th",
            "5": "5th", "5TH": "5th", "FIFTH": "5th",
            "6": "6th", "6TH": "6th", "SIXTH": "6th",
            "7": "7th", "7TH": "7th", "SEVENTH": "7th",
            "8": "8th", "8TH": "8th", "EIGHTH": "8th",
            "9": "9th", "9TH": "9th", "NINTH": "9th",
            "10": "10th", "10TH": "10th", "TENTH": "10th",
            "11": "11th", "11TH": "11th", "ELEVENTH": "11th",
            "12": "12th", "12TH": "12th", "TWELFTH": "12th"
        }
        
        normalized = grade_mapping.get(grade)
        if not normalized:
            # If exact match not found, check if it's already in correct format
            valid_grades = ["K", "1st", "2nd", "3rd", "4th", "5th", "6th", 
                           "7th", "8th", "9th", "10th", "11th", "12th"]
            if grade in valid_grades:
                normalized = grade
            else:
                raise ValueError(f"Invalid grade level: {grade}. Must be K, 1st-12th")
        
        return normalized
    
    @classmethod
    def _check_xss_patterns(cls, value: str):
        """Check for XSS patterns"""
        value_lower = value.lower()
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                logger.warning(f"XSS attempt detected: {pattern}")
                raise ValueError("Input contains potentially dangerous content")
    
    @classmethod
    def _check_sql_patterns(cls, value: str):
        """Check for SQL injection patterns"""
        value_lower = value.lower()
        for pattern in cls.SQL_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                logger.warning(f"SQL injection attempt detected: {pattern}")
                raise ValueError("Input contains potentially dangerous content")

# ============================================================================
# ENHANCED PYDANTIC MODELS WITH SANITIZATION
# ============================================================================

class SecureUserRegistration(BaseModel):
    """Enhanced user registration with sanitization - FIXED FOR STRING GRADE LEVELS"""
    email: str
    password: str
    display_name: str
    grade_level: str = "K"  # Changed from Optional[int] to str with default
    
    @validator('email')
    def validate_email(cls, v):
        return InputSanitizer.sanitize_email(v)
    
    @validator('display_name')
    def validate_display_name(cls, v):
        return InputSanitizer.sanitize_display_name(v)
    
    @validator('password')
    def validate_password(cls, v):
        """Strong password validation"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if len(v) > 128:
            raise ValueError('Password too long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        
        # Check for common weak passwords
        weak_passwords = ['password', '12345678', 'qwerty123', 'Password123']
        if v.lower() in [wp.lower() for wp in weak_passwords]:
            raise ValueError('Password is too common')
        
        return v
    
    @validator('grade_level')
    def validate_grade_level(cls, v):
        """Validate and normalize grade level - UPDATED FOR STRING SUPPORT"""
        if v is None:
            return "K"  # Default to Kindergarten
        
        # Convert to string if somehow an int was passed
        if isinstance(v, int):
            if v == 0:
                return "K"
            elif 1 <= v <= 12:
                suffixes = {1: "st", 2: "nd", 3: "rd"}
                suffix = suffixes.get(v, "th")
                return f"{v}{suffix}"
            else:
                raise ValueError('Grade level must be K or 1st-12th')
        
        # Sanitize and validate string input
        return InputSanitizer.sanitize_grade_level(v)

class SecurePasswordChangeRequest(BaseModel):
    """Secure password change request"""
    current_password: str
    new_password: str
    
    @validator('new_password')
    def validate_new_password(cls, v):
        # Reuse the same validation as registration
        return SecureUserRegistration.validate_password(v)
    
    @validator('current_password')
    def validate_current_password(cls, v):
        if len(v) > 128:
            raise ValueError('Invalid current password')
        return v

# ============================================================================
# UTILITY FUNCTIONS FOR GRADE LEVEL CONVERSION
# ============================================================================

def grade_string_to_int(grade_str: str) -> int:
    """Convert grade level string to integer for internal use"""
    grade_mapping = {
        "K": 0,
        "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5,
        "6th": 6, "7th": 7, "8th": 8, "9th": 9, "10th": 10,
        "11th": 11, "12th": 12
    }
    return grade_mapping.get(grade_str, 0)

def grade_int_to_string(grade_int: int) -> str:
    """Convert integer grade to string for display"""
    if grade_int == 0:
        return "K"
    elif 1 <= grade_int <= 12:
        suffixes = {1: "st", 2: "nd", 3: "rd"}
        suffix = suffixes.get(grade_int, "th")
        return f"{grade_int}{suffix}"
    else:
        return "K"  # Default fallback

# ============================================================================
# RATE LIMITING
# ============================================================================

class RateLimiter:
    """In-memory rate limiter with Redis-like interface"""
    
    def __init__(self):
        self.storage: Dict[str, List[datetime]] = defaultdict(list)
        self.blocked_ips: Dict[str, datetime] = {}
        self._cleanup_task = None
        self._start_cleanup()
    
    def _start_cleanup(self):
        """Start background cleanup task"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    async def _cleanup_loop(self):
        """Clean up old entries every 5 minutes"""
        while True:
            try:
                await asyncio.sleep(300)  # 5 minutes
                self._cleanup_old_entries()
            except Exception as e:
                logger.error(f"Rate limiter cleanup error: {e}")
    
    def _cleanup_old_entries(self):
        """Remove old entries to prevent memory leaks"""
        cutoff = datetime.now() - timedelta(hours=1)
        
        # Clean request history
        for key in list(self.storage.keys()):
            self.storage[key] = [
                timestamp for timestamp in self.storage[key] 
                if timestamp > cutoff
            ]
            if not self.storage[key]:
                del self.storage[key]
        
        # Clean blocked IPs
        self.blocked_ips = {
            ip: blocked_until for ip, blocked_until in self.blocked_ips.items()
            if blocked_until > datetime.now()
        }
    
    def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> bool:
        """Check if key is rate limited"""
        now = datetime.now()
        window_start = now - timedelta(seconds=window_seconds)
        
        # Check if IP is blocked
        if key in self.blocked_ips:
            if self.blocked_ips[key] > now:
                return True
            else:
                del self.blocked_ips[key]
        
        # Clean old entries for this key
        self.storage[key] = [
            timestamp for timestamp in self.storage[key] 
            if timestamp > window_start
        ]
        
        # Check rate limit
        if len(self.storage[key]) >= limit:
            # If severely over the limit, block the IP
            if len(self.storage[key]) > limit * 3:
                self.blocked_ips[key] = now + timedelta(minutes=15)
                logger.warning(f"IP blocked for excessive requests: {key}")
            return True
        
        # Record this request
        self.storage[key].append(now)
        return False
    
    def get_remaining_requests(self, key: str, limit: int, window_seconds: int) -> int:
        """Get remaining requests for key"""
        now = datetime.now()
        window_start = now - timedelta(seconds=window_seconds)
        
        recent_requests = [
            timestamp for timestamp in self.storage.get(key, [])
            if timestamp > window_start
        ]
        
        return max(0, limit - len(recent_requests))

# Global rate limiter instance
rate_limiter = RateLimiter()

# ============================================================================
# RATE LIMITING UTILITIES
# ============================================================================

def get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    # Check for forwarded headers (common in load balancers)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP (original client)
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Fallback to direct connection
    return request.client.host if request.client else "unknown"

def check_rate_limit(request: Request, limit: int, window_seconds: int = 60, 
                    key_suffix: str = "") -> None:
    """Check rate limit and raise exception if exceeded"""
    client_ip = get_client_ip(request)
    key = f"{client_ip}:{key_suffix}" if key_suffix else client_ip
    
    if rate_limiter.is_rate_limited(key, limit, window_seconds):
        remaining_time = window_seconds
        logger.warning(f"Rate limit exceeded for {client_ip} on {key_suffix or 'general'}")
        
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Rate limit exceeded",
                "retry_after": remaining_time,
                "limit": limit,
                "window": window_seconds
            },
            headers={"Retry-After": str(remaining_time)}
        )

def check_user_rate_limit(user_id: str, limit: int, window_seconds: int = 60,
                         action: str = "general") -> None:
    """Check rate limit per user"""
    key = f"user:{user_id}:{action}"
    
    if rate_limiter.is_rate_limited(key, limit, window_seconds):
        logger.warning(f"User rate limit exceeded: {user_id} for {action}")
        raise HTTPException(
            status_code=429,
            detail={
                "message": f"Too many {action} requests",
                "retry_after": window_seconds,
                "limit": limit
            }
        )

# ============================================================================
# SECURITY EVENT LOGGING
# ============================================================================

class SecurityLogger:
    """Enhanced security event logging"""
    
    @staticmethod
    def log_security_event(
        event_type: str,
        request: Request = None,
        user_email: str = None,
        user_id: str = None,
        success: bool = True,
        details: Dict[str, Any] = None,
        severity: str = "INFO"
    ):
        """Log security events with context"""
        
        event_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "success": success,
            "severity": severity,
            "user_email": user_email,
            "user_id": user_id,
            "details": details or {}
        }
        
        # Add request context if available
        if request:
            event_data.update({
                "ip_address": get_client_ip(request),
                "user_agent": request.headers.get("User-Agent", ""),
                "endpoint": str(request.url.path),
                "method": request.method
            })
        
        # Log based on severity
        log_message = f"🔐 Security Event: {json.dumps(event_data, default=str)}"
        
        if severity == "CRITICAL":
            logger.critical(log_message)
        elif severity == "WARNING" or not success:
            logger.warning(log_message)
        else:
            logger.info(log_message)
    
    @staticmethod
    def log_auth_attempt(request: Request, email: str, success: bool, 
                        details: Dict[str, Any] = None):
        """Log authentication attempts"""
        SecurityLogger.log_security_event(
            event_type="authentication_attempt",
            request=request,
            user_email=email,
            success=success,
            details=details,
            severity="WARNING" if not success else "INFO"
        )
    
    @staticmethod
    def log_registration_attempt(request: Request, email: str, success: bool,
                               details: Dict[str, Any] = None):
        """Log registration attempts"""
        SecurityLogger.log_security_event(
            event_type="user_registration",
            request=request,
            user_email=email,
            success=success,
            details=details,
            severity="WARNING" if not success else "INFO"
        )
    
    @staticmethod
    def log_suspicious_activity(request: Request, activity_type: str,
                              details: Dict[str, Any] = None):
        """Log suspicious activity"""
        SecurityLogger.log_security_event(
            event_type=f"suspicious_{activity_type}",
            request=request,
            success=False,
            details=details,
            severity="CRITICAL"
        )