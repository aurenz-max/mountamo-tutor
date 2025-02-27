from typing import Dict, Any, Optional, List, Callable, Awaitable
import logging
import json
import asyncio
import random
import concurrent.futures
import uuid

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
        
    async def build_image_catalog(self, force_refresh: bool = False) -> Dict[str, List[Dict[str, str]]]:
        """
        Build a catalog of all available images organized by category and object type.
        Uses thread pool for CPU-bound operations and file system access.
        
        Args:
            force_refresh: Force a refresh of the catalog
            
        Returns:
            Dict mapping categories to lists of objects with their image IDs
        """
        # Use a lock to prevent multiple concurrent catalog builds
        async with self._catalog_lock:
            if self._image_catalog is not None and not force_refresh:
                return self._image_catalog
            
            # Get all images from the service
            all_images = await self.visual_service.get_available_images(force_refresh=force_refresh)
            
            # Process images in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            
            def process_images():
                # Create catalog structure
                catalog = {}
                
                for image_id, image_data in all_images.items():
                    category = image_data.get("category", "").lower()
                    if not category:
                        continue
                        
                    # Extract object type from name or metadata
                    name = image_data.get("name", "")
                    
                    # Parse patterns like "00041-ALPHABET K A simple flat design letter K"
                    object_type = None
                    
                    # First try to get from the file name directly
                    if "-" in name:
                        parts = name.split("-", 1)
                        if len(parts) >= 2:
                            type_parts = parts[1].split(" ", 1)
                            if len(type_parts) >= 1:
                                object_type = type_parts[0].lower()
                    
                    # If that didn't work, try to extract from the full name
                    if not object_type:
                        # Try to extract meaningful part
                        if "letter" in name.lower():
                            for word in name.split():
                                if len(word) == 1 and word.isalpha():
                                    object_type = f"letter {word.upper()}"
                                    break
                        else:
                            # Use the file name without extension
                            object_type = name.lower()
                    
                    # Add to catalog
                    if category not in catalog:
                        catalog[category] = []
                        
                    catalog[category].append({
                        "object": object_type,
                        "image_id": image_id
                    })
                
                return catalog
                
            # Run the processing in a thread pool
            self._image_catalog = await loop.run_in_executor(self.thread_pool, process_images)
            logger.debug(f"Built image catalog with {len(self._image_catalog)} categories")
            
            return self._image_catalog
        
    async def get_categories(self) -> List[str]:
        """
        Get all available image categories.
        
        Returns:
            List of category names
        """
        if not self._image_catalog:
            await self.build_image_catalog()
            
        # Sort categories in a thread pool to avoid blocking on large catalogs
        loop = asyncio.get_event_loop()
        categories = await loop.run_in_executor(
            self.thread_pool, 
            lambda: sorted(list(self._image_catalog.keys()))
        )
        
        return categories
        
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
            
        if category.lower() not in self._image_catalog:
            return []
            
        # Extract unique object types in a thread pool
        loop = asyncio.get_event_loop()
        
        def extract_objects():
            # Extract unique object types from this category
            objects = set()
            for item in self._image_catalog[category.lower()]:
                objects.add(item["object"])
                
            return sorted(list(objects))
            
        return await loop.run_in_executor(self.thread_pool, extract_objects)
    
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
            
        # If nothing specified, return empty list
        if not category and not object_type:
            return []
            
        # Use a thread pool for filtering to avoid blocking
        loop = asyncio.get_event_loop()
        
        def filter_images():
            matching_images = []
            
            # If only category specified
            if category and not object_type:
                if category.lower() in self._image_catalog:
                    for item in self._image_catalog[category.lower()]:
                        matching_images.append(item["image_id"])
                        
            # If only object specified
            elif object_type and not category:
                for cat, items in self._image_catalog.items():
                    for item in items:
                        if object_type.lower() in item["object"].lower():
                            matching_images.append(item["image_id"])
                            
            # If both specified
            else:
                if category.lower() in self._image_catalog:
                    for item in self._image_catalog[category.lower()]:
                        if object_type.lower() in item["object"].lower():
                            matching_images.append(item["image_id"])
            
            return matching_images
            
        return await loop.run_in_executor(self.thread_pool, filter_images)
        
    async def create_scene(
        self,
        category: str,
        object_types: Dict[str, int],
        layout: str = "grid",
        title: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a scene with specific object types.
        
        Args:
            category: Category of objects to use
            object_types: Dict mapping object types to counts
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
            if not self._image_catalog:
                await self.build_image_catalog()
                
            # Ensure the category exists
            if category.lower() not in self._image_catalog:
                return {
                    "status": "error",
                    "message": f"Category '{category}' not found"
                }
                
            # Find images for each object type - this can be done in parallel
            tasks = []
            
            for object_name, count in object_types.items():
                # Skip if count is 0
                if count <= 0:
                    continue
                    
                # Create task to find and process images for this object type
                task = self._process_object_type(category, object_name, count)
                tasks.append(task)
                
            # Run all image fetch tasks in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Collect successful results
            selected_images = []
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Error processing object type: {result}")
                elif result:  # Skip empty results
                    selected_images.extend(result)
            
            # Create scene with selected images
            scene_id = f"scene_{str(uuid.uuid4())[:8]}"
            
            # Ensure session exists
            if self.session_id not in self.visual_service.sessions:
                await self.visual_service.initialize_session(self.session_id)
                
            # Create scene configuration
            scene_config = {
                "scene_id": scene_id,
                "title": title,
                "description": description,
                "layout": layout,
                "category": category,
                "object_counts": object_types,
                "images": selected_images,
                "timestamp": asyncio.get_event_loop().time(),
            }
            
            # Add to active content via the manager
            await self.visual_manager.enqueue_scene(self.session_id, scene_config)
            
            # Return result in user-friendly format
            counts = []
            for obj, count in object_types.items():
                if count > 0:
                    counts.append(f"{count} {obj}")
                    
            counts_text = ", ".join(counts)
            
            result = {
                "status": "success",
                "scene_created": True,
                "message": f"Created a scene with {counts_text} using {layout} layout.",
                "scene_id": scene_id,
                "image_count": len(selected_images)
            }
            
            # Call callback if available
            if self._callback:
                try:
                    await self._callback(result)
                except Exception as e:
                    logger.error(f"Error in scene callback: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating scene: {e}")
            return {
                "status": "error",
                "message": f"Error creating scene: {str(e)}"
            }
            
    async def _process_object_type(self, category: str, object_name: str, count: int) -> List[Dict[str, Any]]:
        """
        Process a single object type for scene creation.
        Separated to allow parallel processing with asyncio.gather.
        
        Args:
            category: The category to search in
            object_name: The object type to find
            count: How many instances to include
            
        Returns:
            List of image data objects
        """
        # Find matching images
        matching_images = await self.find_images(category, object_name)
        
        if not matching_images:
            logger.warning(f"No images found for {category}/{object_name}")
            return []
            
        # Select random images
        loop = asyncio.get_event_loop()
        
        def select_random():
            # If we have enough unique images
            if len(matching_images) >= count:
                return random.sample(matching_images, count)
            # Otherwise repeat some images
            else:
                result = matching_images.copy()
                needed = count - len(matching_images)
                for _ in range(needed):
                    result.append(random.choice(matching_images))
                return result
                
        selected_ids = await loop.run_in_executor(self.thread_pool, select_random)
        
        # Get image data for each selected ID - use asyncio.gather for parallel fetching
        image_tasks = [self.visual_service.get_image_content(img_id) for img_id in selected_ids]
        image_results = await asyncio.gather(*image_tasks)
        
        # Filter out None results
        return [img for img in image_results if img is not None]
            
    def get_tool_declarations(self) -> Dict[str, Any]:
        """
        Get the tool declarations for Gemini function calling.
        
        Returns:
            Tool declarations dict
        """
        return {
            "function_declarations": [
                {
                    "name": "get_categories",
                    "description": "Get all available image categories",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "get_objects",
                    "description": "Get objects available within a specific category",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "description": "Category name to get objects from"
                            }
                        },
                        "required": ["category"]
                    }
                },
                {
                    "name": "find_images",
                    "description": "Find images matching a category and/or object type",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "description": "Category to filter by (optional)"
                            },
                            "object_type": {
                                "type": "string",
                                "description": "Object type to filter by (optional)"
                            }
                        },
                        "required": []
                    }
                },
                {
                    "name": "create_scene",
                    "description": "Create a visual scene with specific objects",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "description": "Category of objects to use"
                            },
                            "object_types": {
                                "type": "object",
                                "description": "Dictionary mapping object types to counts",
                                "additionalProperties": {
                                    "type": "integer",
                                    "minimum": 0,
                                    "maximum": 10
                                }
                            },
                            "layout": {
                                "type": "string",
                                "enum": ["grid", "random", "circle"],
                                "description": "How to arrange objects in the scene",
                                "default": "grid"
                            },
                            "title": {
                                "type": "string",
                                "description": "Optional title for the scene"
                            },
                            "description": {
                                "type": "string",
                                "description": "Optional description of the scene purpose"
                            }
                        },
                        "required": ["category", "object_types"]
                    }
                }
            ]
        }