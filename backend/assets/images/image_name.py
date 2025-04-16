import os
import re

def rename_files(directory):
    # Pattern to match the format: digits-NAME (with spaces) followed by " A simple"
    pattern = r'^\d+-([A-Z][A-Z ]+)(?= A simple)'
    
    # List all files in the directory
    for filename in os.listdir(directory):
        # Skip non-image files or hidden files
        if not filename.endswith(('.jpg', '.png', '.jpeg')) or filename.startswith('.'):
            continue
            
        # Try to match the pattern
        match = re.search(pattern, filename)
        if match:
            # Extract just the name part (DUMP TRUCK, CEMENT MIXER, etc.)
            name = match.group(1)
            
            # Get file extension
            _, ext = os.path.splitext(filename)
            
            # Create the new filename
            new_filename = name + ext
            
            # Full paths for rename operation
            old_path = os.path.join(directory, filename)
            new_path = os.path.join(directory, new_filename)
            
            # Rename the file
            os.rename(old_path, new_path)
            print(f"Renamed: {filename} → {new_filename}")

# Execute the function for the current directory
if __name__ == "__main__":
    # Change this to your folder path if needed
    directory = "./shapes"  # Current directory
    rename_files(directory)