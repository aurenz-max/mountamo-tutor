from functools import wraps
from typing import Callable, Any, Dict
from fastapi import Depends
import logging

from ..services.engagement_service import engagement_service
from ..core.middleware import get_user_context

logger = logging.getLogger(__name__)

def log_engagement_activity(activity_type: str, metadata_extractor: Callable[[Dict[str, Any], Any], Dict[str, Any]]):
    """
    Decorator to automatically process an engagement activity after an endpoint runs.
    
    Args:
        activity_type: The type of activity (e.g., 'problem_submitted').
        metadata_extractor: A function that extracts metadata from the endpoint's
                            kwargs and its return value. It receives two arguments:
                            `kwargs` (from the endpoint) and `result` (from the endpoint).
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 1. Execute the original endpoint function
            endpoint_result = await func(*args, **kwargs)
            
            try:
                # 2. Extract user context from endpoint dependencies
                user_context = kwargs.get('user_context')
                if not user_context:
                    logger.warning(f"No user_context found for engagement activity: {activity_type}")
                    return endpoint_result

                firebase_uid = user_context["firebase_uid"]
                student_id = user_context["student_id"]

                # 3. Extract metadata using the provided function
                metadata = metadata_extractor(kwargs, endpoint_result)

                # 4. Process the activity to get engagement data
                engagement_response = await engagement_service.process_activity(
                    user_id=firebase_uid,
                    student_id=student_id,
                    activity_type=activity_type,
                    metadata=metadata
                )
                
                # 5. Merge engagement data into the final response
                # If the endpoint returns a Pydantic model, convert it to a dict first
                if hasattr(endpoint_result, 'dict'):
                    response_data = endpoint_result.dict()
                else:
                    response_data = endpoint_result if isinstance(endpoint_result, dict) else {}

                # Add engagement data both as nested object and flattened for backward compatibility
                engagement_data = engagement_response.dict()
                response_data['engagement_transaction'] = engagement_data
                
                # Flatten engagement fields to top level for frontend compatibility
                response_data.update({
                    'success': True,
                    'xp_earned': engagement_data.get('xp_earned', 0),
                    'base_xp': engagement_data.get('base_xp', 0),
                    'streak_bonus_xp': engagement_data.get('streak_bonus_xp', 0),
                    'total_xp': engagement_data.get('total_xp', 0),
                    'level_up': engagement_data.get('level_up', False),
                    'new_level': engagement_data.get('new_level', 1),
                    'previous_level': engagement_data.get('previous_level', 1),
                    'current_streak': engagement_data.get('current_streak', 0),
                    'previous_streak': engagement_data.get('previous_streak', 0),
                    'points_earned': engagement_data.get('points_earned', 0)
                })
                
                return response_data

            except Exception as e:
                logger.error(f"Error in engagement decorator for '{activity_type}': {e}", exc_info=True)
                # Return the original result without engagement data on error
                return endpoint_result

        return wrapper
    return decorator