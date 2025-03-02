from typing import Dict, Any, Optional, List, Callable, Awaitable
import logging
import json
import asyncio
import random
import concurrent.futures
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class GeminiImageIntegration:
    """
    Integration between Gemini and the VisualContentManager.
    Provides functions for image discovery and scene creation.
    """
    
    def __init__(self, visual_content_manager, session_id: Optional[str] = None):
        """
        Initialize the Gemini Visual Integration.
        
        Args:
            visual_content_manager: The VisualContentManager to use
            session_id: Optional initial session ID
        """
        self.visual_manager = visual_content_manager
        self.visual_service = visual_content_manager.visual_service
        self.session_id = session_id
        self._image_catalog = None
        self._catalog_lock = asyncio.Lock()
        # Thread pool for CPU-bound operations
        self._thread_pool = None
        # Callback for notifying about new scenes
        self._callback: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None
        
    async def set_session_id(self, session_id: str) -> None:
        """
        Update the session ID for this integration.
        
        Args:
            session_id: New session ID to use
        """
        self.session_id = session_id
        logger.debug(f"Updated GeminiImageIntegration session ID to {session_id}")
        
    def set_callback(self, callback: Optional[Callable[[Dict[str, Any]], Awaitable[None]]]) -> None:
        """
        Set a callback to be called when scenes are created.
        
        Args:
            callback: Async function that takes scene_data
        """
        self._callback = callback
        logger.debug("Set scene callback in GeminiImageIntegration")
        
    @property
    def thread_pool(self):
        """Lazy initialization of thread pool"""
        if self._thread_pool is None:
            self._thread_pool = concurrent.futures.ThreadPoolExecutor(
                max_workers=2, 
                thread_name_prefix="gemini_img_"
            )
        return self._thread_pool
        
    async def build_image_catalog(self, force_refresh: bool = False):
        # Use a lock to prevent multiple concurrent catalog builds
        async with self._catalog_lock:
            if self._image_catalog is not None and not force_refresh:
                return self._image_catalog
            
            # Get the original path to log it
            original_path = self.visual_service.image_library_path
            logger.info(f"Original path: {original_path}")
            
            # Fix the path by resolving it relative to the current file
            if not original_path.is_absolute() or str(original_path) == r"\assets\images" or str(original_path) == r"C:\assets\images":
                # Get the current file's directory
                current_file_dir = Path(__file__).resolve().parent
                # Go up to app directory
                app_dir = current_file_dir.parent
                # Go up to backend directory
                backend_dir = app_dir.parent
                # Set correct path
                self.visual_service.image_library_path = backend_dir / "assets" / "images"
                logger.info(f"Fixed path to: {self.visual_service.image_library_path}")
            
            # Get all images
            all_images = await self.visual_service.get_available_images(force_refresh=True)
            logger.info(f"Found {len(all_images)} images")
            
            # Create catalog from the images
            catalog = {}
            for image_id, image_data in all_images.items():
                category = image_data.get("category", "").lower()
                if not category:
                    category = "uncategorized"
                    
                if category not in catalog:
                    catalog[category] = []
                    
                catalog[category].append({
                    "object": image_data.get("name", "").lower(),
                    "image_id": image_id
                })
            
            logger.info(f"Built catalog with {len(catalog)} categories and {len(all_images)} total images")
            self._image_catalog = catalog
            return self._image_catalog
        
    async def get_categories(self) -> List[str]:
        """
        Get all available image categories.
        
        Returns:
            List of category names
        """
        if not self._image_catalog:
            await self.build_image_catalog()
            
        return list(self._image_catalog.keys())
        
    async def get_objects(self, category: str) -> List[str]:
        """
        Get all objects available within a specific category.
        
        Args:
            category: Category to look up
            
        Returns:
            List of object types in the category
        """
        if not self._image_catalog:
            await self.build_image_catalog()
            
        # Normalize the category name for case-insensitive lookup
        category_lower = category.lower().strip()
        
        if category_lower not in self._image_catalog:
            logger.warning(f"Category '{category}' not found in image catalog")
            return []
            
        # Extract unique object types
        object_types = set()
        for item in self._image_catalog[category_lower]:
            object_types.add(item["object"])
            
        return list(object_types)
    
    async def find_images(self, category: str = "", object_type: str = "") -> List[str]:
        """
        Find images matching the given category and/or object type.
        
        Args:
            category: Optional category to filter by
            object_type: Optional object type to filter by
            
        Returns:
            List of matching image IDs
        """
        if not self._image_catalog:
            await self.build_image_catalog()
            
        # Normalize inputs
        category_lower = category.lower().strip() if category else ""
        object_lower = object_type.lower().strip() if object_type else ""
        
        # Log what we're searching for
        logger.info(f"Finding images with category='{category_lower}' and object_type='{object_lower}'")
        
        matching_images = []
        
        # If only category specified
        if category_lower and not object_lower:
            if category_lower in self._image_catalog:
                for item in self._image_catalog[category_lower]:
                    matching_images.append(item["image_id"])
                    
        # If only object specified
        elif object_lower and not category_lower:
            for cat, items in self._image_catalog.items():
                for item in items:
                    if object_lower in item["object"]:
                        matching_images.append(item["image_id"])
                        
        # If both specified
        elif category_lower and object_lower:
            if category_lower in self._image_catalog:
                for item in self._image_catalog[category_lower]:
                    if object_lower in item["object"]:
                        matching_images.append(item["image_id"])
        
        logger.info(f"Found {len(matching_images)} matching images")
        return matching_images
        
    async def create_scene(
            self,
            category: str,
            object_type: str,
            count: int,
            layout: str = "grid",
            title: Optional[str] = None,
            description: Optional[str] = None
        ) -> Dict[str, Any]:
            """
            Create a scene with specific object type and count.
            Enhanced with better error handling and fallback strategies.
            
            Args:
                category: Category of objects to use
                object_type: Type of object to add to the scene
                count: Number of objects to include
                layout: Layout style
                title: Optional title
                description: Optional description
                
            Returns:
                Scene creation result
            """
            # Ensure we have a session ID
            if not self.session_id:
                logger.error("No session ID set for GeminiImageIntegration")
                return {
                    "status": "error",
                    "message": "No session ID set for visual content"
                }
            
            try:
                logger.info(f"Creating scene with category='{category}', object_type='{object_type}', count={count}")
                
                if not self._image_catalog:
                    logger.debug("Building image catalog first")
                    await self.build_image_catalog()
                
                # Normalize the category input (case-insensitive)
                normalized_category = category.lower().strip()
                
                # Special handling for shape category
                if "shape" in normalized_category:
                    normalized_category = "shapes"
                    logger.debug(f"Normalized '{category}' to '{normalized_category}'")
                
                # Check if the normalized category exists
                if normalized_category not in self._image_catalog:
                    logger.warning(f"Category '{normalized_category}' not found")
                                
                # Process the object type with the normalized category
                logger.debug(f"Finding images for '{normalized_category}/{object_type}'")
                
                # First try exact match
                matching_images = await self.find_images(normalized_category, object_type)
                
                # If no results, try fuzzy matching the object type
                if not matching_images:
                    logger.warning(f"No exact matches for object_type='{object_type}' in category='{normalized_category}'")
                    
                    # Normalize the object type for better matching
                    normalized_object = object_type.lower().strip()
                    
                    # Get all available objects in this category
                    if normalized_category in self._image_catalog:
                        available_objects = list(set(item["object"] for item in self._image_catalog[normalized_category]))
                        
                        # Look for similar object types
                        similar_objects = [obj for obj in available_objects 
                                        if normalized_object in obj or obj in normalized_object]
                        
                        if similar_objects:
                            suggestion = similar_objects[0]
                            logger.info(f"Trying similar object: {suggestion}")
                            matching_images = await self.find_images(normalized_category, suggestion)
                
                # Final check if we found any images
                if not matching_images:
                    logger.error(f"Failed to find any images for '{normalized_category}/{object_type}'")
                    return {
                        "status": "error",
                        "message": f"No images found for {object_type} in category {category}"
                    }
                    
                logger.info(f"Found {len(matching_images)} images for '{normalized_category}/{object_type}'")
                
                # Get image data for each ID
                image_tasks = [self.visual_service.get_image_content(img_id) for img_id in matching_images]
                image_results = await asyncio.gather(*image_tasks)
                
                # Filter out None results
                available_images = [img for img in image_results if img is not None]
                
                if not available_images:
                    return {
                        "status": "error",
                        "message": f"Could not load image data for {object_type}"
                    }
                
                # Create scene with selected images
                scene_id = f"scene_{str(uuid.uuid4())[:8]}"
                
                # Ensure session exists
                if self.session_id not in self.visual_service.sessions:
                    await self.visual_service.initialize_session(self.session_id)
                
                # NEW APPROACH: Create object entries that specify how many of each image to display
                object_entries = []
                available_count = len(available_images)
                
                # Distribute the count across available images
                for i in range(count):
                    # Use modulo to cycle through available images
                    image_index = i % available_count
                    image = available_images[image_index]
                    
                    object_entries.append({
                        "id": image["id"],
                        "type": object_type,
                        "count": 1,  # Each entry represents one instance
                        "image": image  # Include full image data for backend use
                    })
                
                # Create scene configuration
                scene_config = {
                    "scene_id": scene_id,
                    "title": title or f"{count} {object_type}",
                    "description": description,
                    "layout": layout,
                    "category": category,
                    "total_count": count,
                    "object_entries": object_entries,
                    "timestamp": asyncio.get_event_loop().time(),
                }
                
                # Add to active content via the manager
                await self.visual_manager.enqueue_scene(self.session_id, scene_config)
                
                # Create a simplified response structure
                # Each unique image gets an entry with its count
                simplified_objects = []
                image_counts = {}
                
                # Count how many instances of each image ID
                for entry in object_entries:
                    image_id = entry["id"]
                    if image_id in image_counts:
                        image_counts[image_id] += 1
                    else:
                        image_counts[image_id] = 1
                
                # Create entries with count for each unique image
                for image_id, instance_count in image_counts.items():
                    simplified_objects.append({
                        "id": image_id,
                        "type": object_type,
                        "count": instance_count  # How many of this image to display
                    })
                
                # Return result with better structure
                result = {
                    "status": "success",
                    "scene_created": True,
                    "message": f"Created a scene with {count} {object_type} using {layout} layout.",
                    "scene_id": scene_id,
                    "total_count": count,  # Total count of all objects
                    "unique_images": len(simplified_objects),  # Number of unique images
                    "layout": layout,
                    "object_type": object_type,
                    # Each object specifies how many instances of it to display
                    "objects": simplified_objects
                }
                
                # Call callback if available
                if self._callback:
                    try:
                        await self._callback(result)
                    except Exception as e:
                        logger.error(f"Error in scene callback: {e}")
                
                return result
                
            except Exception as e:
                logger.error(f"Error creating scene: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
                return {
                    "status": "error",
                    "message": f"Error creating scene: {str(e)}"
                }
