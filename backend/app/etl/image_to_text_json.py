import os
import json
import re

def extract_image_info(filename):
    """Extract information from the image filename."""
    # Match pattern like: 00015-FLOWER A simple flat design flower image
    pattern = r'(\d+)-([A-Z]+)(.*)'
    match = re.match(pattern, filename)
    
    if match:
        id_num = match.group(1)
        name = match.group(2)
        description = match.group(3).strip()
        return {
            "id": id_num,
            "name": name.lower(),
            "description": description
        }
    return None

def process_images(base_path):
    """Process all images in the given directory structure."""
    result = {
        "categories": [],
        "items": []
    }
    
    # Get all category folders
    categories = []
    for item in os.listdir(base_path):
        category_path = os.path.join(base_path, item)
        if os.path.isdir(category_path):
            categories.append(item)
    
    # Add categories to result
    result["categories"] = [{"id": i, "name": cat} for i, cat in enumerate(categories)]
    category_dict = {cat: i for i, cat in enumerate(categories)}
    
    # Process each category
    for category in categories:
        category_path = os.path.join(base_path, category)
        
        # Process each image in the category
        for filename in os.listdir(category_path):
            if filename.endswith(('.png', '.jpg', '.jpeg', '.gif')):
                # Extract information from filename
                info = extract_image_info(filename)
                
                if info:
                    # Add category information
                    info["category_id"] = category_dict[category]
                    info["category"] = category
                    
                    # Add image path
                    info["image_path"] = f"assets/images/{category}/{filename}"
                    
                    # Add to items list
                    result["items"].append(info)
    
    return result

def main():
    # Base path for the image assets
    base_path = "assets/images"
    
    # Process the images
    data = process_images(base_path)
    
    # Write output to a JSON file
    with open("reading_app_data.json", "w") as f:
        json.dump(data, f, indent=2)
    
    print(f"Processed {len(data['items'])} items across {len(data['categories'])} categories.")

if __name__ == "__main__":
    main()