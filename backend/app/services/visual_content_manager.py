import asyncio
import logging
from typing import Dict, Any, Optional, List, AsyncGenerator
import uuid

from .visual_content_service import VisualContentService
from .gemini_image import GeminiImageIntegration

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class VisualContentManager:
    """
    Manager class that handles visual content for tutoring sessions.
    Coordinates between the VisualContentService and GeminiImageIntegration.
    """
    
    def __init__(self, visual_content_service: VisualContentService):
        """
        Initialize the Visual Content Manager.
        
        Args:
            visual_content_service: Service for handling image content
        """
        self.visual_service = visual_content_service
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.integration_by_session: Dict[str, GeminiImageIntegration] = {}
        
        logger.info("VisualContentManager initialized")
        
    async def initialize_session(self, session_id: str) -> None:
        if session_id in self.sessions:
            logger.debug(f"Visual content session {session_id} already exists")
            return
            
        # Initialize the underlying service first
        await self.visual_service.initialize_session(session_id)
        
        # Create a GeminiImageIntegration for this session
        integration = GeminiImageIntegration(self, session_id)  # Pass self, not self.visual_service
        
        # Store session info
        self.sessions[session_id] = {
            "active": True,
            "scene_queue": asyncio.Queue(),
            "current_scenes": []
        }
        
        # Store the integration
        self.integration_by_session[session_id] = integration
        
        # Build the image catalog for this session
        await integration.build_image_catalog()
        
        logger.info(f"Initialized visual content session {session_id}")
        
    async def get_integration(self, session_id: str) -> Optional[GeminiImageIntegration]:
        """
        Get the GeminiImageIntegration for a session.
        
        Args:
            session_id: Session ID
            
        Returns:
            GeminiImageIntegration instance or None if not found
        """
        return self.integration_by_session.get(session_id)

    async def create_image_integration(self, session_id: str) -> GeminiImageIntegration:
        """
        Create a new GeminiImageIntegration for a session.
        
        Args:
            session_id: Session ID to associate with the integration
            
        Returns:
            Configured GeminiImageIntegration instance
        """
        if session_id not in self.sessions:
            await self.initialize_session(session_id)
            
        if session_id in self.integration_by_session:
            return self.integration_by_session[session_id]
            
        # Create a new integration for this session
        # Pass 'self' as the visual_content_manager, not self.visual_service
        integration = GeminiImageIntegration(self, session_id)
        
        # Store the integration
        self.integration_by_session[session_id] = integration
        
        # Build the image catalog
        await integration.build_image_catalog()
        
        return integration

    async def enqueue_scene(self, session_id: str, scene_data: Dict[str, Any]) -> None:
        """
        Add a new scene to the session's scene queue.
        
        Args:
            session_id: Session ID
            scene_data: Scene data to enqueue
        """
        if session_id not in self.sessions:
            logger.warning(f"Session {session_id} not found for scene enqueue")
            return
            
        await self.sessions[session_id]["scene_queue"].put(scene_data)
        
        # Add to current scenes list
        self.sessions[session_id]["current_scenes"].append(scene_data["scene_id"])
        
        logger.debug(f"Enqueued scene {scene_data['scene_id']} for session {session_id}")
        
    async def get_scenes(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Get all active scenes for the session.
        
        Args:
            session_id: Session ID
            
        Returns:
            List of scene data
        """
        if session_id not in self.sessions:
            return []
            
        return self.visual_service.get_active_content(session_id)
        
    async def get_scene_updates(self, session_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Get a stream of scene updates for the session.
        
        Args:
            session_id: Session ID
            
        Yields:
            Scene update data
        """
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
            
        queue = self.sessions[session_id]["scene_queue"]
        
        while self.sessions[session_id]["active"]:
            try:
                scene = await queue.get()
                yield scene
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error getting scene update: {e}")
                continue

    async def debug_image_catalog(self, session_id: str) -> Dict[str, Any]:
        """Debug method to directly inspect image catalog state"""
        logger.info(f"Running direct debug for session {session_id}")
        
        if session_id not in self.integration_by_session:
            return {"status": "error", "message": "No integration found for session"}
        
        integration = self.integration_by_session[session_id]
        
        try:
            # Force refresh the catalog to ensure latest data
            catalog = await integration.build_image_catalog(force_refresh=True)
            
            # Count images by category
            category_counts = {cat: len(items) for cat, items in catalog.items()}
            
            # Sample a few objects from each category
            samples = {}
            for cat, items in catalog.items():
                object_samples = list(set(item["object"] for item in items[:5]))
                samples[cat] = object_samples
            
            return {
                "status": "success",
                "session_id": session_id,
                "total_categories": len(catalog),
                "categories": list(catalog.keys()),
                "counts_by_category": category_counts,
                "samples": samples
            }
        except Exception as e:
            logger.error(f"Error debugging image catalog: {str(e)}")
            return {"status": "error", "message": f"Debug error: {str(e)}"}

    async def clear_scene(self, session_id: str, scene_id: str) -> bool:
        """
        Clear a specific scene from the session.
        
        Args:
            session_id: Session ID
            scene_id: Scene ID to clear
            
        Returns:
            True if successful
        """
        if session_id not in self.sessions:
            return False
            
        result = self.visual_service.clear_content(session_id, scene_id)
        
        # Remove from current scenes list if successful
        if result and scene_id in self.sessions[session_id]["current_scenes"]:
            self.sessions[session_id]["current_scenes"].remove(scene_id)
            
        return result
        
    async def cleanup_session(self, session_id: str) -> None:
        """
        Clean up resources for a session.
        
        Args:
            session_id: Session ID
        """
        if session_id not in self.sessions:
            return
            
        # Mark session as inactive
        self.sessions[session_id]["active"] = False
        
        # Clean up the visual service session
        await self.visual_service.reset_session(session_id)
        
        # Remove integration
        if session_id in self.integration_by_session:
            del self.integration_by_session[session_id]
        
        # Remove session data
        del self.sessions[session_id]
        
        logger.info(f"Cleaned up visual content session {session_id}")