# backend/app/core/tutoring_session.py

import asyncio
import logging
from typing import AsyncGenerator, Dict, Optional, Any
from datetime import datetime

from .base_session import BaseSession
from ..db.cosmos_db import CosmosDBService
from ..services.audio_service import AudioService
from ..services.gemini import GeminiService
from ..services.tutoring import TutoringService
from ..services.azure_tts import AzureSpeechService
from ..services.visual_content_service import VisualContentService
from ..services.visual_content_manager import VisualContentManager

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class TutoringSession(BaseSession):
    """Session type focused on interactive tutoring with AI."""
    
    def __init__(
        self,
        audio_service: AudioService,
        cosmos_db: CosmosDBService,
        visual_content_manager: VisualContentManager,
        subject: str,
        skill_description: str,
        subskill_description: str,
        student_id: int,
        competency_score: float,
        gemini_service: GeminiService,
        tutoring_service: TutoringService,
        speech_service: AzureSpeechService,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None
    ):
        # Initialize the base class
        super().__init__(audio_service, cosmos_db, student_id)
        
        # Tutoring-specific services
        self.visual_content_manager = visual_content_manager
        self.speech_service = speech_service
        self.speech_service.cosmos_db = cosmos_db    
        self.gemini_service = gemini_service
        self.tutoring_service = tutoring_service

        # Session metadata
        self.subject = subject
        self.skill_description = skill_description
        self.subskill_description = subskill_description
        self.competency_score = competency_score
        self.skill_id = skill_id
        self.subskill_id = subskill_id

        # Tutoring-specific queues
        self.problem_queue = asyncio.Queue()
        self.scene_queue = asyncio.Queue()
        self.image_queue = asyncio.Queue()
        
        logger.debug(f"TutoringSession {self.id} initialized with isolated service instances")

    async def handle_scene(self, scene_data: Dict[str, Any]) -> None:
        """Handle visual scene data from Gemini service"""
        try:
            logger.warning(f"[Session {self.id}] handle_scene called with data: {scene_data}")
            if not self._active:
                logger.warning(f"[Session {self.id}] Session not active, ignoring scene")
                return
            logger.warning(f"[Session {self.id}] Adding scene to queue, queue size before: {self.scene_queue.qsize()}")
            await self.scene_queue.put(scene_data)
            logger.warning(f"[Session {self.id}] Scene added to queue, new size: {self.scene_queue.qsize()}")
        except Exception as e:
            logger.error(f"Error handling scene in session {self.id}: {e}", exc_info=True)
            raise

    async def handle_image(self, image_data: Dict[str, Any]) -> None:
        """Handle image data from Gemini service"""
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
                    image = await self.image_queue.get()
                    yield image
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

    async def initialize(self, 
                        recommendation_data: Optional[Dict] = None,
                        objectives_data: Optional[Dict] = None) -> None:
        """Initialize the tutoring session"""
        try:
            logger.debug(f"Starting initialization of session {self.id}")
            
            # Store the event loop that we're running in
            self._event_loop = asyncio.get_running_loop()
            logger.debug(f"[Session {self.id}] Stored event loop: {self._event_loop}")
            
            # Initialize audio service first
            try:
                self.audio_service.create_session(self.id)
            except Exception as e:
                logger.error(f"Failed to initialize audio service for session {self.id}: {e}")
                raise

            # Initialize visual content manager for this session
            try:
                await self.visual_content_manager.initialize_session(self.id)
                
                # Create a GeminiImageIntegration for this session
                visual_integration = await self.visual_content_manager.create_image_integration(self.id)
                
                # Set the visual integration in GeminiService
                self.gemini_service.visual_integration = visual_integration
                
                # Set up callback from GeminiImageIntegration to handle scenes
                async def scene_callback(scene_data: Dict[str, Any]) -> None:
                    logger.warning(f"[Session {self.id}] Scene callback triggered with data: {scene_data}")
                    try:
                        # Using handle_scene method from the class
                        await self.handle_scene(scene_data)  
                    except Exception as e:
                        logger.error(f"[Session {self.id}] Error in scene callback: {e}", exc_info=True)
                        
                # Register scene callback with a different name
                if hasattr(self.gemini_service, 'register_scene_callback'):
                    self.gemini_service.register_scene_callback(scene_callback)
                    logger.warning(f"[Session {self.id}] Scene callback registered with GeminiService")
                    
                logger.info(f"Visual integration set up for session {self.id}")
            except Exception as e:
                logger.error(f"Failed to initialize visual integration for session {self.id}: {e}")
                # Non-fatal, continue with initialization
                
            # Set up callback from TutoringService to handle images
            async def image_callback(session_id: str, image_data: Dict[str, Any]) -> None:
                logger.info(f"[Session {self.id}] Image callback triggered")
                try:
                    await self.handle_image(image_data)
                except Exception as e:
                    logger.error(f"[Session {self.id}] Error in image callback: {e}", exc_info=True)
                    
            # Register image callback
            if hasattr(self.tutoring_service, 'register_image_callback'):
                self.tutoring_service.register_image_callback(image_callback)
                logger.info(f"[Session {self.id}] Image callback registered with TutoringService")

            # Register problem callback using the simple pattern like transcription
            async def problem_callback(problem_data: Dict[str, Any]) -> None:
                try:
                    logger.info(f"[Session {self.id}] Problem callback received")
                    await self.problem_queue.put(problem_data)
                    logger.info(f"[Session {self.id}] Problem added to queue")
                except Exception as e:
                    logger.error(f"[Session {self.id}] Error in problem callback: {str(e)}", exc_info=True)
            
            # Register the problem callback BEFORE initializing tutoring service
            self.gemini_service.register_problem_callback(problem_callback)
            logger.info(f"Problem callback registered for session {self.id}")

            # Initialize tutoring service
            await self.tutoring_service.initialize_session(
                subject=self.subject,
                skill_description=self.skill_description,
                subskill_description=self.subskill_description,
                student_id=self.student_id,
                competency_score=self.competency_score,
                session_id=self.id,
                skill_id=self.skill_id,
                subskill_id=self.subskill_id,
                recommendation_data=recommendation_data,
                objectives_data=objectives_data
            )

            self._active = True
            self._initialization_event.set()
            logger.info(f"Successfully initialized tutoring session {self.id}")

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

            # Start continuous transcription with async callbacks
            await self.speech_service.start_continuous_transcription(
                self.id, 
                self.student_id,
                transcription_callback,  # Direct reference to the function
            )

        except Exception as e:
            logger.error(f"Failed to initialize session {self.id}: {str(e)}")
            self._active = False
            self.quit_event.set()
            raise

    async def get_scenes(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Get visual scene updates from the session"""
        if not self._active:
            raise ValueError("Session is not active")

        try:
            while not self.quit_event.is_set():
                try:
                    scene = await self.scene_queue.get()
                    yield scene
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error getting scene: {e}")
                    continue

        except asyncio.CancelledError:
            logger.info(f"Scene generator cancelled for session {self.id}")
        except Exception as e:
            logger.error(f"Error getting scenes for session {self.id}: {e}")
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
            # Process scene-related messages
            if message.get("type") == "scene_action":
                action = message.get("action")
                if action == "clear_scene":
                    scene_id = message.get("scene_id")
                    if scene_id:
                        await self.visual_content_manager.clear_scene(self.id, scene_id)
                        
            # Process through tutoring service (pass all messages here for consistency)
            await self.tutoring_service.process_message(self.id, message)
            
        except Exception as e:
            logger.error(f"Error processing message in session {self.id}: {e}")
            raise

    async def get_problems(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Get problem responses from the session"""
        if not self._active:
            logger.error(f"[Session {self.id}] get_problems called when session not active")
            raise ValueError("Session is not active")

        logger.info(f"[Session {self.id}] Starting problem generator")
        problem_count = 0
        
        try:
            while not self.quit_event.is_set():
                try:
                    # Add timeout to periodically check if session is still active
                    problem = await asyncio.wait_for(self.problem_queue.get(), timeout=1.0)
                    problem_count += 1
                    logger.info(f"[Session {self.id}] Problem #{problem_count} dequeued and being sent to frontend")
                    yield problem
                except asyncio.TimeoutError:
                    # Just a check - continue waiting
                    continue
                except asyncio.CancelledError:
                    logger.info(f"[Session {self.id}] Problem generator cancelled after sending {problem_count} problems")
                    break
                except Exception as e:
                    logger.error(f"[Session {self.id}] Error getting problem from queue: {e}", exc_info=True)
                    continue

        except asyncio.CancelledError:
            logger.info(f"[Session {self.id}] Problem generator cancelled after sending {problem_count} problems")
        except Exception as e:
            logger.error(f"[Session {self.id}] Error in problem generator: {e}", exc_info=True)
            raise

    async def send_problem(self, problem: Dict[str, Any]) -> None:
        """Queue a problem to be sent to the frontend"""
        try:
            if not self._active:
                logger.warning(f"[Session {self.id}] Cannot send problem - session not active")
                return
            
            logger.debug(f"[Session {self.id}] Queueing problem with keys: {list(problem.keys())}")
            
            # Add timestamp and session info
            problem_with_meta = {
                **problem,
                "timestamp": datetime.utcnow().isoformat(),
                "session_id": self.id
            }
            
            # Ensure queue is working
            queue_size_before = self.problem_queue.qsize()
            await self.problem_queue.put(problem_with_meta)
            queue_size_after = self.problem_queue.qsize()
            
            logger.info(f"[Session {self.id}] Problem queued successfully (queue size: {queue_size_before} → {queue_size_after})")
        except Exception as e:
            logger.error(f"[Session {self.id}] Error in send_problem: {str(e)}", exc_info=True)
            raise

    async def cleanup(self) -> None:
        """Clean up session resources"""
        try:
            # First call the parent class's cleanup
            await super().cleanup()
            
            # Clean up speech service
            try:
                await self.speech_service.cleanup_transcription()
            except Exception as e:
                logger.error(f"Error cleaning up speech service for session {self.id}: {e}")
            
            # Clean up Gemini service
            try:
                await self.gemini_service.reset_session()
            except Exception as e:
                logger.error(f"Error cleaning up Gemini service for session {self.id}: {e}")
            
            # Clean up tutoring service
            try:
                await self.tutoring_service.cleanup_session(self.id)
            except Exception as e:
                logger.error(f"Error cleaning up tutoring service for session {self.id}: {e}")
                
            # Clean up visual content manager
            try:
                await self.visual_content_manager.cleanup_session(self.id)
            except Exception as e:
                logger.error(f"Error cleaning up visual content manager for session {self.id}: {e}")
                
            logger.info(f"Cleaned up tutoring session {self.id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up session {self.id}: {str(e)}")
            raise