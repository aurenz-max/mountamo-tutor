# tools/file_saver.py
import os
from google.adk.tools import FunctionTool

def save_to_folder(content: str, file_name: str, folder_path: str) -> dict:
    """
    Saves generated content to a specified folder.
    
    Args:
        content: The content to save
        file_name: Name for the saved file
        folder_path: Path to destination folder
        
    Returns:
        dict: Status of the save operation
    """
    try:
        full_path = os.path.join(folder_path, file_name + ".txt")
        
        # Create folder if it doesn't exist
        os.makedirs(folder_path, exist_ok=True)
        
        with open(full_path, 'w') as f:
            f.write(content)
            
        return {
            "status": "success",
            "file_path": full_path,
            "message": f"Content saved successfully to {full_path}"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to save content: {str(e)}"
        }

# Create the file_saver tool to be imported by other modules
file_saver_tool = FunctionTool(func=save_to_folder)