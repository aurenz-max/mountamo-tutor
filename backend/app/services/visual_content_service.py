import asyncio
import logging
import os
from pathlib import Path
import base64
from typing import Dict, Any, List, Optional, Union
from pathlib import Path
import uuid
import random

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class VisualContentService:
    """
    Service to manage visual content (SVGs, images) for educational purposes.
    Integrates with GeminiService to handle image-based tool requests.
    Uses async operations and thread pools for non-blocking image processing.
    """
    def __init__(self, image_library_path: Optional[str] = None, max_cache_size: int = 100):
        """
        Initialize the Visual Content Service.
        
        Args:
            image_library_path: Path to the directory containing image assets
            max_cache_size: Maximum number of images to keep in memory cache
        """
        # Session storage for active visual content
        self.sessions: Dict[str, Dict[str, Any]] = {}
        
        # Set up image library path using pathlib for cross-platform compatibility
        if image_library_path:
            self.image_library_path = Path(image_library_path)
        else:
            # Get path to the backend root directory (parent of app directory)
            backend_root = Path(__file__).parent.parent.parent
            # Set path to assets/images
            self.image_library_path = backend_root / "assets" / "images"
        
        # Log the resolved path for debugging
        logger.info(f"VisualContentService initialized with image library at: {self.image_library_path}")
        
        # Ensure the directory exists - run in separate thread
        async def setup_directory():
            loop = asyncio.get_event_loop()
            # Convert Path to string when passing to os.makedirs
            await loop.run_in_executor(None, lambda: os.makedirs(str(self.image_library_path), exist_ok=True))
        
        # Schedule directory creation asynchronously
        asyncio.create_task(setup_directory())
        
        # Cache of available images
        self._image_cache = None
        # Cache for image content
        self._content_cache = {}
        self._max_cache_size = max_cache_size
        # Lock for cache operations
        self._cache_lock = asyncio.Lock()
        # Thread pool for file operations
        self._thread_pool = None  # Will be initialized on first use
        
        logger.info(f"VisualContentService initialized with image library at: {self.image_library_path}")
        
    @property
    def thread_pool(self):
        """Lazy initialization of thread pool"""
        if self._thread_pool is None:
            import concurrent.futures
            self._thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="img_svc_")
        return self._thread_pool
    
    async def initialize_session(self, session_id: str) -> None:
        """Initialize service for a specific session"""
        if session_id in self.sessions:
            logger.debug(f"Session {session_id} already exists in VisualContentService")
            return
            
        self.sessions[session_id] = {
            "active_content": [],  # List of currently active visual elements
            "content_history": []  # History of all visual content for this session
        }
        logger.info(f"Initialized visual content session {session_id}")
    
    async def reset_session(self, session_id: str) -> None:
        """Reset session state"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Reset visual content session {session_id}")
    
    async def get_available_images(self, category: Optional[str] = None, force_refresh: bool = False) -> Dict[str, Dict[str, Any]]:
        """
        Get a dictionary of available images in the library.
        
        Args:
            category: Filter images by category
            force_refresh: Force refresh the image cache
            
        Returns:
            Dictionary mapping image_id to image metadata
        """
        # Use a semaphore to prevent multiple concurrent refreshes
        if not hasattr(self, '_refresh_lock'):
            self._refresh_lock = asyncio.Semaphore(1)
            
        if self._image_cache is None or force_refresh:
            async with self._refresh_lock:
                # Another thread might have refreshed while waiting
                if self._image_cache is None or force_refresh:
                    self._image_cache = {}
                    
                    try:
                        # Run filesystem operations in a thread pool to avoid blocking
                        loop = asyncio.get_event_loop()
                        
                        def scan_directory():
                            result = {}
                            # Ensure the path exists before trying to scan it
                            if not self.image_library_path.exists():
                                logger.warning(f"Image library path does not exist: {self.image_library_path}")
                                return result
                                
                            # Use Path.rglob instead of os.walk for better cross-platform compatibility
                            for file_path in self.image_library_path.rglob("*"):
                                if file_path.is_file() and file_path.suffix.lower() in ('.png', '.jpg', '.jpeg', '.svg'):
                                    # Get relative path from the image library root
                                    rel_path = file_path.relative_to(self.image_library_path)
                                    
                                    # If file is in a subdirectory, use that as the category
                                    category = str(rel_path.parent) if rel_path.parent != Path('.') else ""
                                    
                                    # Generate a unique ID for the image
                                    image_id = str(rel_path).replace('\\', '_').replace('/', '_').replace(" ", "_").lower()
                                    
                                    # Store metadata without loading the image data yet
                                    result[image_id] = {
                                        "id": image_id,
                                        "name": file_path.stem,
                                        "path": str(file_path),
                                        "relative_path": str(rel_path),
                                        "category": category,
                                        "type": file_path.suffix[1:].lower()
                                    }
                            
                            logger.info(f"Found {len(result)} images in {self.image_library_path}")
                            return result
                        
                        # Run the directory scan in a thread pool
                        self._image_cache = await loop.run_in_executor(self.thread_pool, scan_directory)
                
                    except Exception as e:
                        logger.error(f"Error scanning image library: {e}")
        
        # Filter by category if specified
        if category:
            return {k: v for k, v in self._image_cache.items() if v["category"] == category}
        
        return self._image_cache
    
    async def get_image_content(self, image_id: str) -> Optional[Dict[str, Any]]:
        """
        Get image content and metadata by ID
        
        Args:
            image_id: The ID of the image to retrieve
            
        Returns:
            Dictionary with image data and metadata, or None if not found
        """
        images = await self.get_available_images()
        
        if image_id not in images:
            logger.warning(f"Image ID {image_id} not found in library")
            return None
            
        image_info = images[image_id]
        
        # Check if we have a content cache
        if not hasattr(self, '_content_cache'):
            self._content_cache = {}
            
        # Check if image is already in our content cache
        if image_id in self._content_cache:
            return self._content_cache[image_id]
            
        try:
            # Run file I/O operations in a thread pool
            loop = asyncio.get_event_loop()
            
            async def load_image():
                def read_file():
                    # Convert to Path object then to string to ensure proper path handling
                    image_path = Path(image_info["path"])
                    with open(image_path, "rb") as f:
                        return f.read()
                
                # Read file in thread pool
                image_data = await loop.run_in_executor(self.thread_pool, read_file)
                
                # Base64 encode the image data (also potentially expensive)
                def process_image():
                    import base64
                    if image_info["type"] != "svg":
                        # For binary image formats
                        b64_data = base64.b64encode(image_data).decode('utf-8')
                        mime_type = f"image/{image_info['type']}"
                        data_uri = f"data:{mime_type};base64,{b64_data}"
                    else:
                        # For SVG, which is already text
                        data_uri = image_data.decode('utf-8')
                    return data_uri
                
                # Process image in thread pool
                data_uri = await loop.run_in_executor(self.thread_pool, process_image)
                
                result = {
                    **image_info,
                    "data_uri": data_uri
                }
                
                # Cache the result
                self._content_cache[image_id] = result
                
                return result
            
            return await load_image()
                
        except Exception as e:
            logger.error(f"Error reading image {image_id}: {e}")
            return None
    
    async def create_counting_scene(
        self, 
        session_id: str, 
        object_type: str,
        count: int,
        layout: str = "random",
        additional_props: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a visual scene with multiple instances of an object for counting exercises.
        Uses async operations for non-blocking execution.
        
        Args:
            session_id: The session ID
            object_type: Type/category of object to display
            count: Number of objects to display
            layout: How to arrange objects (grid, random, circle)
            additional_props: Additional properties for the scene
            
        Returns:
            Scene data to be sent to frontend
        """
        if session_id not in self.sessions:
            await self.initialize_session(session_id)
            
        # Get available images for the requested object type
        available_images = await self.get_available_images(category=object_type)
        
        if not available_images:
            # Fallback to searching by name
            all_images = await self.get_available_images()
            available_images = {k: v for k, v in all_images.items() 
                              if object_type.lower() in v["name"].lower() or 
                                 object_type.lower() in v["id"].lower()}
        
        if not available_images:
            logger.warning(f"No images found for object type: {object_type}")
            return {"status": "error", "message": f"No images found for object type: {object_type}"}
            
        # Choose a random image from available ones for this object type
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        selected_image_id = await loop.run_in_executor(
            self.thread_pool, 
            lambda: random.choice(list(available_images.keys()))
        )
        
        # Get image content asynchronously
        image_data = await self.get_image_content(selected_image_id)
        
        if not image_data:
            return {"status": "error", "message": "Failed to load image data"}
            
        # Create unique ID for this scene - run in thread pool
        scene_id = await loop.run_in_executor(
            self.thread_pool,
            lambda: f"scene_{str(uuid.uuid4())[:8]}"
        )
        
        # Create scene configuration
        scene_config = {
            "scene_id": scene_id,
            "object_type": object_type,
            "count": count,
            "layout": layout,
            "image_data": image_data,
            "timestamp": asyncio.get_event_loop().time(),
            "additional_props": additional_props or {}
        }
        
        # Add to active content
        self.sessions[session_id]["active_content"].append(scene_config)
        self.sessions[session_id]["content_history"].append(scene_config)
        
        # Return scene data to be sent to frontend
        return {
            "status": "success",
            "scene_id": scene_id,
            "content_type": "counting_scene", 
            "data": {
                "object_type": object_type,
                "count": count,
                "image_data": image_data,
                "layout": layout
            }
        }
        
    async def create_svg_scene(
        self,
        session_id: str,
        svg_content: str,
        scene_type: str,
        title: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a custom SVG scene
        
        Args:
            session_id: The session ID
            svg_content: Raw SVG content 
            scene_type: Type of scene (graph, diagram, illustration)
            title: Optional title for the scene
            description: Optional description
            
        Returns:
            Scene data to be sent to frontend
        """
        if session_id not in self.sessions:
            await self.initialize_session(session_id)
            
        # Create unique ID for this scene
        scene_id = f"svg_{str(uuid.uuid4())[:8]}"
        
        # Create scene configuration
        scene_config = {
            "scene_id": scene_id,
            "scene_type": scene_type,
            "title": title,
            "description": description,
            "svg_content": svg_content,
            "timestamp": asyncio.get_event_loop().time(),
        }
        
        # Add to active content
        self.sessions[session_id]["active_content"].append(scene_config)
        self.sessions[session_id]["content_history"].append(scene_config)
        
        # Return scene data to be sent to frontend
        return {
            "status": "success",
            "scene_id": scene_id,
            "content_type": "svg_scene",
            "data": {
                "title": title,
                "description": description,
                "scene_type": scene_type,
                "svg_content": svg_content
            }
        }
        
    async def create_multi_object_scene(
        self,
        session_id: str,
        object_counts: Dict[str, int],
        layout: str = "grid",
        title: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a scene with multiple different types of objects.
        
        Args:
            session_id: The session ID
            object_counts: Dictionary mapping object categories to counts
            layout: How to arrange objects (grid, random, circle)
            title: Optional title for the scene
            description: Optional description
            
        Returns:
            Scene data
        """
        if session_id not in self.sessions:
            await self.initialize_session(session_id)
        
        # Create unique ID for this scene
        scene_id = f"multi_{str(uuid.uuid4())[:8]}"
        
        # Collect all objects for the scene
        scene_objects = []
        
        for category, count in object_counts.items():
            # Skip if count is 0
            if count <= 0:
                continue
                
            # Get images for this category
            category_images = await self.get_available_images(category=category)
            
            if not category_images:
                # Try looking by name/ID
                all_images = await self.get_available_images()
                category_images = {k: v for k, v in all_images.items() 
                                if category.lower() in v["name"].lower() or 
                                   category.lower() in v["id"].lower()}
            
            if not category_images:
                logger.warning(f"No images found for category: {category}")
                continue
                
            # Choose images randomly for this category
            image_ids = list(category_images.keys())
            
            # Ensure we don't try to select more than available
            selection_count = min(count, len(image_ids))
            
            # Use a thread pool to do the random selection
            loop = asyncio.get_event_loop()
            
            # Select random images
            def select_random_images():
                # If count is less than or equal to available images, use random.sample
                if count <= len(image_ids):
                    return random.sample(image_ids, count)
                # Otherwise, sample all and then add additional random choices
                else:
                    result = list(image_ids)  # Get all available
                    additional_needed = count - len(image_ids)
                    result.extend([random.choice(image_ids) for _ in range(additional_needed)])
                    return result
                    
            selected_ids = await loop.run_in_executor(self.thread_pool, select_random_images)
            
            # Get image data for each selected ID - use asyncio.gather for parallel fetching
            image_tasks = [self.get_image_content(img_id) for img_id in selected_ids]
            image_results = await asyncio.gather(*image_tasks)
            
            # Add valid results to scene objects
            scene_objects.extend([img for img in image_results if img is not None])
        
        # Create scene configuration with all objects
        scene_config = {
            "scene_id": scene_id,
            "scene_type": "multi_object",
            "title": title,
            "description": description,
            "layout": layout,
            "object_counts": object_counts,
            "objects": scene_objects,
            "timestamp": asyncio.get_event_loop().time(),
        }
        
        # Add to active content
        self.sessions[session_id]["active_content"].append(scene_config)
        self.sessions[session_id]["content_history"].append(scene_config)
        
        # Return scene data
        return {
            "status": "success",
            "scene_id": scene_id,
            "content_type": "multi_object_scene",
            "data": {
                "title": title,
                "description": description,
                "layout": layout,
                "object_counts": object_counts,
                "object_count": len(scene_objects)
            }
        }
    
    def get_active_content(self, session_id: str) -> List[Dict[str, Any]]:
        """Get currently active visual content for a session"""
        if session_id not in self.sessions:
            return []
        
        return self.sessions[session_id]["active_content"]
    
    def clear_content(self, session_id: str, scene_id: Optional[str] = None) -> bool:
        """
        Clear visual content for a session
        
        Args:
            session_id: The session ID
            scene_id: Optional specific scene to clear, or all if None
            
        Returns:
            True if successful
        """
        if session_id not in self.sessions:
            return False
            
        if scene_id:
            # Remove specific scene
            self.sessions[session_id]["active_content"] = [
                scene for scene in self.sessions[session_id]["active_content"] 
                if scene["scene_id"] != scene_id
            ]
            return True
        else:
            # Clear all active content
            self.sessions[session_id]["active_content"] = []
            return True