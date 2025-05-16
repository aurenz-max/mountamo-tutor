# backend/app/core/read_along_session.py

import asyncio
import logging
from typing import AsyncGenerator, Dict, Optional, Any, List
from datetime import datetime

from .base_session import BaseSession
from ..db.cosmos_db import CosmosDBService
from ..services.audio_service import AudioService
from ..services.azure_tts import AzureSpeechService
from ..services.gemini_read_along import GeminiReadAlongIntegration

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class ReadAlongSession(BaseSession):
    """Session type focused solely on read-along content with minimal dependencies."""
    
    def __init__(
        self,
        audio_service: AudioService,
        cosmos_db: CosmosDBService,
        speech_service: AzureSpeechService,
        gemini_read_along: GeminiReadAlongIntegration,
        student_id: int,
        student_grade: str = "kindergarten",
        student_interests: Optional[List[str]] = None,
        reading_level: int = 1
    ):
        # Initialize the base class
        super().__init__(audio_service, cosmos_db, student_id)
        
        # Read-along specific services
        self.speech_service = speech_service
        self.speech_service.cosmos_db = cosmos_db
        self.gemini_read_along = gemini_read_along
        
        # Session metadata
        self.student_grade = student_grade
        self.student_interests = student_interests or ["animals", "space", "nature"]
        self.reading_level = reading_level
        
        # Read-along specific queues
        self.read_along_queue = asyncio.Queue()
        self.image_queue = asyncio.Queue()
        
        logger.debug(f"ReadAlongSession {self.id} initialized")

    async def handle_read_along(self, read_along_data: Dict[str, Any]) -> None:
        """Handle read-along data from Gemini Read-Along service"""
        try:
            logger.info(f"[Session {self.id}] handle_read_along called with data type: {read_along_data.get('type', 'unknown')}")
            if not self._active:
                logger.warning(f"[Session {self.id}] Session not active, ignoring read-along")
                return
            await self.read_along_queue.put(read_along_data)
            logger.info(f"[Session {self.id}] Read-along added to queue")
        except Exception as e:
            logger.error(f"Error handling read-along in session {self.id}: {e}", exc_info=True)
            raise

    async def handle_image(self, image_data: Dict[str, Any]) -> None:
        """Handle image data that might come with read-along content"""
        try:
            logger.info(f"[Session {self.id}] handle_image called with data type: {image_data.get('mime_type', 'unknown')}")
            if not self._active:
                logger.warning(f"[Session {self.id}] Session not active, ignoring image")
                return
            await self.image_queue.put(image_data)
            logger.info(f"[Session {self.id}] Image added to queue")
        except Exception as e:
            logger.error(f"Error handling image in session {self.id}: {e}", exc_info=True)
            raise

    async def get_images(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Get image data from the session"""
        if not self._active:
            raise ValueError("Session is not active")

        try:
            while not self.quit_event.is_set():
                try:
                    # Add timeout to periodically check if session is still active
                    image = await asyncio.wait_for(self.image_queue.get(), timeout=1.0)
                    yield image
                except asyncio.TimeoutError:
                    # Just a check - continue waiting
                    continue
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error getting image: {e}")
                    continue

        except asyncio.CancelledError:
            logger.info(f"Image generator cancelled for session {self.id}")
        except Exception as e:
            logger.error(f"Error getting images for session {self.id}: {e}")
            raise

    async def get_read_alongs(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Get read-along content from the session"""
        if not self._active:
            raise ValueError("Session is not active")

        try:
            logger.info(f"[Session {self.id}] Starting read-along generator")
            read_along_count = 0
            
            while not self.quit_event.is_set():
                try:
                    # Add timeout to periodically check if session is still active
                    read_along = await asyncio.wait_for(self.read_along_queue.get(), timeout=1.0)
                    read_along_count += 1
                    logger.info(f"[Session {self.id}] Read-along #{read_along_count} dequeued and being sent to frontend")
                    yield read_along
                except asyncio.TimeoutError:
                    # Just a check - continue waiting
                    continue
                except asyncio.CancelledError:
                    logger.info(f"[Session {self.id}] Read-along generator cancelled after sending {read_along_count} items")
                    break
                except Exception as e:
                    logger.error(f"[Session {self.id}] Error getting read-along from queue: {e}", exc_info=True)
                    continue

        except asyncio.CancelledError:
            logger.info(f"[Session {self.id}] Read-along generator cancelled after sending {read_along_count} items")
        except Exception as e:
            logger.error(f"[Session {self.id}] Error in read-along generator: {e}", exc_info=True)
            raise

    async def initialize(self, **kwargs) -> None:
        """Initialize the read-along session"""
        try:
            logger.debug(f"Starting initialization of read-along session {self.id}")
            
            # Store the event loop that we're running in
            self._event_loop = asyncio.get_running_loop()
            
            # Initialize audio service first
            try:
                self.audio_service.create_session(self.id)
            except Exception as e:
                logger.error(f"Failed to initialize audio service for session {self.id}: {e}")
                raise

            # Register read-along callback
            async def read_along_callback(read_along_data: Dict[str, Any]) -> None:
                logger.info(f"[Session {self.id}] Read-along callback triggered")
                try:
                    await self.handle_read_along(read_along_data)
                except Exception as e:
                    logger.error(f"[Session {self.id}] Error in read-along callback: {e}", exc_info=True)
            
            # Register image callback that might come with read-along content
            async def image_callback(image_data: Dict[str, Any]) -> None:
                logger.info(f"[Session {self.id}] Image callback triggered from read-along")
                try:
                    await self.handle_image(image_data)
                except Exception as e:
                    logger.error(f"[Session {self.id}] Error in image callback: {e}", exc_info=True)
                    
            # Register callbacks with GeminiReadAlongIntegration
            self.gemini_read_along.register_read_along_callback(read_along_callback)
            self.gemini_read_along.register_image_callback(image_callback)
            logger.info(f"[Session {self.id}] Callbacks registered with GeminiReadAlongIntegration")

            # Set up transcription callback for speech recognition
            def transcription_callback(transcript):
                try:
                    logger.debug(f"[Session {self.id}] Transcript received: {transcript.get('data', {}).get('text', '')[:30]}...")
                    # Use run_coroutine_threadsafe instead of create_task
                    asyncio.run_coroutine_threadsafe(
                        self.transcript_queue.put(transcript),
                        self._event_loop
                    )
                    logger.debug(f"[Session {self.id}] Transcript scheduled for queue")
                except Exception as e:
                    logger.error(f"[Session {self.id}] Error in transcript callback: {e}", exc_info=True)

            # Start continuous transcription with async callbacks - lightweight version just for commands
            await self.speech_service.start_continuous_transcription(
                self.id, 
                self.student_id,
                transcription_callback,
                is_command_only=True  # Only listen for specific commands, not continuous transcription
            )

            self._active = True
            self._initialization_event.set()
            logger.info(f"Successfully initialized read-along session {self.id}")

        except Exception as e:
            logger.error(f"Failed to initialize read-along session {self.id}: {str(e)}")
            self._active = False
            self.quit_event.set()
            raise

    async def process_message(self, message: Dict) -> None:
        """Process incoming messages"""
        if not self._active:
            raise ValueError("Session is not active")

        # Wait for full initialization before processing messages
        try:
            await asyncio.wait_for(self._initialization_event.wait(), timeout=2.0)
        except asyncio.TimeoutError:
            raise ValueError("Session initialization incomplete")

        try:
            message_type = message.get("type", "")
            
            # Process read-along specific messages
            if message_type == "generate_read_along":
                options = message.get("options", {})
                
                # Generate the read-along content
                result = await self.gemini_read_along.generate_read_along(
                    session_id=self.id,
                    session_metadata={
                        "student_id": self.student_id,
                        "student_grade": options.get("student_grade", self.student_grade),
                        "student_interests": options.get("student_interests", self.student_interests),
                        "reading_level": options.get("reading_level", self.reading_level)
                    },
                    complexity_level=options.get("reading_level", self.reading_level),
                    theme=options.get("theme"),
                    with_image=options.get("with_image", True)
                )
                
                # Return confirmation message as text
                status_message = f"Read-along generation {result.get('status', 'completed')}: {result.get('message', '')}"
                await self.handle_text(status_message)
                
            elif message_type == "read_text":
                # Text-to-speech request
                text = message.get("text", "")
                if text:
                    voice = message.get("voice", "en-US-JennyMultilingualNeural")
                    try:
                        audio_data = await self.speech_service.text_to_speech(text, voice)
                        # The audio service handles returning this to the client
                        logger.info(f"[Session {self.id}] Generated TTS for: {text[:30]}...")
                    except Exception as e:
                        logger.error(f"[Session {self.id}] Error in TTS: {str(e)}")
                        await self.handle_text(f"Sorry, I couldn't generate speech for that text: {str(e)}")
            
            elif message_type == "realtime_input":
                # Handle voice input - the transcription callback will process this
                pass
                
            else:
                logger.warning(f"[Session {self.id}] Unknown message type: {message_type}")
                
        except Exception as e:
            logger.error(f"Error processing message in read-along session {self.id}: {e}", exc_info=True)
            await self.handle_text(f"Sorry, I encountered an error: {str(e)}")
            raise

    async def cleanup(self) -> None:
        """Clean up session resources"""
        try:
            # Call the base class cleanup first
            await super().cleanup()
            
            # Clean up speech service
            try:
                await self.speech_service.cleanup_transcription()
            except Exception as e:
                logger.error(f"Error cleaning up speech service for session {self.id}: {e}")
                
            # Unregister callbacks from GeminiReadAlongIntegration
            try:
                # Unregister callbacks if the service supports it
                if hasattr(self.gemini_read_along, 'unregister_read_along_callback'):
                    self.gemini_read_along.unregister_read_along_callback(self.id)
                
                if hasattr(self.gemini_read_along, 'unregister_image_callback'):
                    self.gemini_read_along.unregister_image_callback(self.id)
            except Exception as e:
                logger.error(f"Error cleaning up callbacks for session {self.id}: {e}")
                
            logger.info(f"Cleaned up read-along session {self.id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up session {self.id}: {str(e)}")
            raise