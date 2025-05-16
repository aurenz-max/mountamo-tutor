# app/utils/logging_utils.py

from typing import Dict, Any
import copy
import logging

logger = logging.getLogger(__name__)

def sanitize_log_data(data: Dict[str, Any], truncate_length: int = 30) -> Dict[str, Any]:
    """
    Create a copy of the provided data with any base64 image data truncated
    to make logs more readable.
    
    Args:
        data: Dictionary that may contain base64 image data
        truncate_length: Length to truncate base64 strings to
        
    Returns:
        Copy of the dictionary with base64 strings truncated
    """
    if not isinstance(data, dict):
        return data
        
    result = copy.deepcopy(data)
    
    # Check for base64 image at the top level
    for key in result:
        if isinstance(key, str) and 'base64' in key.lower() and isinstance(result[key], str):
            result[key] = result[key][:truncate_length] + '...[truncated]'
        elif key == 'image_base64' and isinstance(result[key], str):
            result[key] = result[key][:truncate_length] + '...[truncated]'
            
    # Check for nested base64 images in 'parts' or similar structures
    if 'parts' in result and isinstance(result['parts'], list):
        for part in result['parts']:
            if isinstance(part, dict):
                for key in part:
                    if isinstance(key, str) and 'base64' in key.lower() and isinstance(part[key], str):
                        part[key] = part[key][:truncate_length] + '...[truncated]'
                    elif key == 'image_base64' and isinstance(part[key], str):
                        part[key] = part[key][:truncate_length] + '...[truncated]'
    
    return result

def log_truncated(logger_instance, level: str, message: str, data: Dict[str, Any] = None):
    """
    Log a message with data, but truncate any base64 strings in the data.
    
    Args:
        logger_instance: Logger to use
        level: Log level (debug, info, warning, error)
        message: Log message
        data: Optional data dictionary that may contain base64 strings
    """
    if data:
        sanitized_data = sanitize_log_data(data)
        if level.lower() == 'debug':
            logger_instance.debug(f"{message} {sanitized_data}")
        elif level.lower() == 'info':
            logger_instance.info(f"{message} {sanitized_data}")
        elif level.lower() == 'warning':
            logger_instance.warning(f"{message} {sanitized_data}")
        elif level.lower() == 'error':
            logger_instance.error(f"{message} {sanitized_data}")
    else:
        if level.lower() == 'debug':
            logger_instance.debug(message)
        elif level.lower() == 'info':
            logger_instance.info(message)
        elif level.lower() == 'warning':
            logger_instance.warning(message)
        elif level.lower() == 'error':
            logger_instance.error(message)
            
# Example usage:
# log_truncated(logger, 'debug', "Received data:", data_with_base64)