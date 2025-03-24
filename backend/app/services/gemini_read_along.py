# app/services/gemini_read_along.py - Modified to handle multiple images

from typing import Dict, Any, Optional, Callable, Awaitable, List
import logging
import time
import base64
import re
from google import genai
from google.genai import types
from io import BytesIO
from PIL import Image
from ..core.config import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class GeminiReadAlongIntegration:
    """Integration with Gemini API for read-along content generation"""
    
    def __init__(self):
        self.client = None
        self.read_along_callbacks: List[Callable[[Dict[str, Any]], Awaitable[None]]] = []
        self.image_callbacks: List[Callable[[Dict[str, Any]], Awaitable[None]]] = []
        
    def initialize(self) -> bool:
        """Initialize the Gemini client with API settings"""
        try:
            self.client = genai.Client(
                api_key=settings.GEMINI_GENERATE_KEY,
                http_options={"api_version": "v1alpha"},
            )
            logger.info("Gemini read-along client initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Gemini read-along client: {str(e)}", exc_info=True)
            return False

    def register_read_along_callback(self, callback: Callable[[Dict[str, Any]], Awaitable[None]]) -> None:
        """Register a callback for when read-along content is generated"""
        self.read_along_callbacks.append(callback)
        logger.debug(f"Read-along callback registered, total callbacks: {len(self.read_along_callbacks)}")
    
    def register_image_callback(self, callback: Callable[[Dict[str, Any]], Awaitable[None]]) -> None:
        """Register a callback for when image content is generated"""
        self.image_callbacks.append(callback)
        logger.debug(f"Image callback registered, total callbacks: {len(self.image_callbacks)}")
    
    def unregister_read_along_callback(self, session_id: str) -> None:
        """Unregister callbacks for a specific session"""
        logger.debug(f"Unregister read-along callbacks for session {session_id} called")
    
    def unregister_image_callback(self, session_id: str) -> None:
        """Unregister image callbacks for a specific session"""
        logger.debug(f"Unregister image callbacks for session {session_id} called")
    
    async def _notify_callbacks(self, read_along_data: Dict[str, Any]) -> None:
        """Notify all registered callbacks with the read-along data"""
        for callback in self.read_along_callbacks:
            try:
                await callback(read_along_data)
            except Exception as e:
                logger.error(f"Error in read-along callback: {str(e)}", exc_info=True)
    
    async def _notify_image_callbacks(self, image_data: Dict[str, Any]) -> None:
        """Notify all registered image callbacks with the image data"""
        for callback in self.image_callbacks:
            try:
                await callback(image_data)
            except Exception as e:
                logger.error(f"Error in image callback: {str(e)}", exc_info=True)
    
    async def generate_read_along(
        self,
        session_id: str,
        session_metadata: Dict[str, Any],
        complexity_level: int = 1,
        theme: Optional[str] = None,
        with_image: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a read-along experience with grade-appropriate text and optional images
        """
        try:
            # Verify client is initialized
            if not self.client:
                logger.error(f"[Session {session_id}] Gemini client not initialized")
                return {"status": "error", "message": "Gemini client not initialized"}
            
            # Build prompt for Gemini
            prompt = self._build_read_along_prompt(
                student_grade=session_metadata.get("student_grade", "kindergarten"),
                reading_level=session_metadata.get("reading_level", complexity_level),
                theme=theme,
                complexity_level=complexity_level
            )
            
            # Generate content using Gemini
            if with_image:
                response = await self.client.aio.models.generate_content(
                    model="models/gemini-2.0-flash-exp",
                    contents=prompt,
                    config=types.GenerateContentConfig(response_modalities=['Text', 'Image'])
                )
            else:
                response = await self.client.aio.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
            
            # Check for valid response
            if not response or not response.candidates or not response.candidates[0].content.parts:
                logger.error(f"[Session {session_id}] Empty or invalid response from Gemini")
                return {"status": "error", "message": "Failed to generate read-along content"}
            
            # Just send back the raw response parts directly
            # We'll extract only what's needed for transmission
            parts = []
            for part in response.candidates[0].content.parts:
                if part.text is not None:
                    parts.append({"text": part.text})
                elif part.inline_data is not None:
                    parts.append({
                        "image_base64": base64.b64encode(part.inline_data.data).decode('utf-8'),
                        "mime_type": part.inline_data.mime_type
                    })
            
            # Create minimal result structure
            result = {
                "type": "read_along",
                "id": f"read_along_{session_id}_{theme or 'general'}",
                "session_id": session_id,
                "parts": parts,
                "reading_instructions": "Read each word slowly, following along with your finger. Take a breath at each period."
            }
            
            # Notify callbacks
            await self._notify_callbacks(result)
            
            return {
                "type": "read_along",
                "content": result
            }
            
        except Exception as e:
            logger.error(f"[Session {session_id}] Error in generate_read_along: {str(e)}")
            return {"status": "error", "message": f"Exception in read-along generation: {str(e)}"}
        
    def _build_read_along_prompt(
        self,
        student_grade: str,
        reading_level: int,
        theme: Optional[str],
        complexity_level: int
    ) -> str:
        """
        Build an appropriate prompt for Gemini based on student details
        """
        # Adjust sentence complexity based on reading level
        sentences_per_paragraph = min(complexity_level + 1, 3)
        words_per_sentence = 4 + complexity_level * 2  # 6, 8, 10 words per sentence
        
        theme_text = f" about {theme}" if theme else ""
        
        if complexity_level == 1:
            prompt = (
                f"Create an engaging read-along story about {theme_text} for a kindergarten developing reader. "
                f"Use 1-2 short paragraphs with {sentences_per_paragraph} simple sentences each. "
                f"Each sentence should have about {words_per_sentence} words. "
                f"Generate a story with different scenes, and for each scene create an image. "
                f"Ensure the images are realistic and accurate to their physical characteristics. "
                f"Please just include the story and images, no additional content, and no Scene indicators. "
            )
        elif complexity_level == 2:
            prompt = (
                f"Create an engaging read-along story about {theme_text} for a kindergarten developing reader. "
                f"Write 2 paragraphs with {sentences_per_paragraph} sentences each. "
                f"Each sentence should have about {words_per_sentence} words. "
                f"Generate a story with different scenes, and for each scene create an image. "
                f"Ensure the images are realistic and accurate to their physical characteristics. "
                f"Please just include the story and images, no additional content, and no Scene indicators. "
            )
        else:  # complexity_level == 3
            prompt = (
                f"Create an engaging read-along story about {theme_text} for a kindergarten developing reader. "
                f"Write 2-3 paragraphs with {sentences_per_paragraph} sentences each. "
                f"Each sentence can have up to {words_per_sentence} words. "
                f"Include some compound sentences and richer vocabulary. "
                f"Generate a story with different scenes, and for each scene create an image. "
                f"Ensure the images are realistic and accurate to their physical characteristics. "
                f"Please just include the story and images, no additional content, and no Scene indicators. "
            )
        
        return prompt