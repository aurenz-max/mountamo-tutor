# backend/app/core/session_manager.py

import asyncio
import logging
import uuid
from typing import AsyncGenerator, Dict, Optional, Union, Any
from datetime import datetime

from ..db.cosmos_db import CosmosDBService
from ..services.audio_service import AudioService
from app.services.gemini import GeminiService
from app.services.tutoring import TutoringService
from app.services.azure_tts import AzureSpeechService
from ..services.visual_content_service import VisualContentService
from ..services.visual_content_manager import VisualContentManager
from app.core.config import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class TutoringSession:
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
        gemini_service: GeminiService,      # pass in already constructed service
        tutoring_service: TutoringService,  # pass in already constructed service
        speech_service: AzureSpeechService,  # NEW
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None
    ):
       
        self.id = str(uuid.uuid4())
        self.audio_service = audio_service
        self.cosmos_db = cosmos_db
        self.visual_content_manager = visual_content_manager
        
        # Get speech service from dependencies
        self.speech_service = speech_service
        self.speech_service.cosmos_db = cosmos_db     
        self.gemini_service = gemini_service
        self.tutoring_service = tutoring_service


        # Session metadata
        self.subject = subject
        self.skill_description = skill_description
        self.subskill_description = subskill_description
        self.student_id = student_id
        self.competency_score = competency_score
        self.skill_id = skill_id
        self.subskill_id = subskill_id

        # Queues and state management
        self.problem_queue = asyncio.Queue()
        self.text_queue = asyncio.Queue()
        self.transcript_queue = asyncio.Queue()
        self.scene_queue = asyncio.Queue()  # Queue for visual scenes
        
        self._active = False
        self.quit_event = asyncio.Event()
        self._initialization_event = asyncio.Event()
        self._event_loop = asyncio.get_event_loop()
        
        logger.debug(f"TutoringSession {self.id} initialized with isolated service instances")

    async def handle_text(self, text: str) -> None:
        """Handle text response from Gemini service"""
        try:
            if not self._active:
                return
            await self.text_queue.put(text)
        except Exception as e:
            logger.error(f"Error handling text in session {self.id}: {e}")
            raise

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

    async def get_responses(self) -> AsyncGenerator[str, None]:
        """Get text responses from the session"""
        if not self._active:
            raise ValueError("Session is not active")

        try:
            while not self.quit_event.is_set():
                try:
                    text = await self.text_queue.get()
                    yield text
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error getting text response: {e}")
                    continue

        except asyncio.CancelledError:
            logger.info(f"Response generator cancelled for session {self.id}")
        except Exception as e:
            logger.error(f"Error getting responses for session {self.id}: {e}")
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

    async def get_audio(self) -> AsyncGenerator[bytes, None]:
        """Get processed audio from the audio service"""
        session_data = self.audio_service.sessions.get(self.id)
        if not session_data:
            raise ValueError(f"No audio session found for {self.id}")
            
        output_queue = session_data['output_queue']
        while not self.quit_event.is_set():
            try:
                audio_chunk = await output_queue.get()
                yield audio_chunk
            except asyncio.CancelledError:
                break

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

    async def get_transcripts(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Get speech transcripts from the session"""
        if not self._active:
            raise ValueError("Session is not active")

        try:
            logger.debug(f"[Session {self.id}] Starting transcript generator, queue size: {self.transcript_queue.qsize()}")
            transcript_count = 0
            
            while not self.quit_event.is_set():
                try:
                    # Add a timeout to periodically check the quit event
                    transcript = await asyncio.wait_for(self.transcript_queue.get(), timeout=1.0)
                    transcript_count += 1
                    
                    # Log transcript reception for debugging
                    text_preview = transcript.get('data', {}).get('text', '')[:50]
                    speaker = transcript.get('speaker', 'unknown')
                    is_partial = transcript.get('data', {}).get('is_partial', False)
                    
                    logger.info(f"[Session {self.id}] Yielding transcript #{transcript_count}: speaker={speaker}, is_partial={is_partial}, text={text_preview}...")
                    
                    # Mark the task as done before yielding
                    self.transcript_queue.task_done()
                    
                    yield transcript
                except asyncio.TimeoutError:
                    # Just a timeout for checking quit condition periodically
                    continue
                except asyncio.CancelledError:
                    logger.info(f"[Session {self.id}] Transcript generator cancelled after sending {transcript_count} transcripts")
                    break
                except Exception as e:
                    logger.error(f"[Session {self.id}] Error getting transcript: {e}", exc_info=True)
                    continue
        except asyncio.CancelledError:
            logger.info(f"[Session {self.id}] Transcript generator cancelled after sending {transcript_count} transcripts")
        except Exception as e:
            logger.error(f"[Session {self.id}] Error in transcript generator: {e}", exc_info=True)
            raise

    async def cleanup(self) -> None:
        """Clean up session resources"""
        try:
            self._active = False
            self.quit_event.set()
            self._initialization_event.clear()
            
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
                
            logger.info(f"Cleaned up session {self.id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up session {self.id}: {str(e)}")
            raise


class SessionManager:
    def __init__(
        self, 
        audio_service: AudioService,
        cosmos_db: CosmosDBService,
        visual_content_service: VisualContentService
    ):
        self.audio_service = audio_service
        self.cosmos_db = cosmos_db
        self.visual_content_service = visual_content_service
        
        # Get the visual content manager from dependencies
        from ..dependencies import get_visual_content_manager
        self.visual_content_manager = get_visual_content_manager(self.visual_content_service)
        
        self.sessions: Dict[str, TutoringSession] = {}
        logger.info("Session manager initialized with services")

    async def create_session(
        self,
        subject: str,
        skill_description: str,
        subskill_description: str,
        student_id: int,
        competency_score: float,
        gemini_service: GeminiService,    # you want to pass this in
        tutoring_service: TutoringService,# you want to pass this in
        speech_service: AzureSpeechService,# you want to pass this in
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
    ) -> TutoringSession:
        """Create and initialize a new tutoring session with pre-loaded data."""
        # 1. Create the session with all dependencies
        session = TutoringSession(
            audio_service=self.audio_service,
            cosmos_db=self.cosmos_db,
            visual_content_manager=self.visual_content_manager,
            subject=subject,
            skill_description=skill_description,
            subskill_description=subskill_description,
            student_id=student_id,
            competency_score=competency_score,
            gemini_service=gemini_service,
            tutoring_service=tutoring_service,
            speech_service=speech_service,  # <--
            skill_id=skill_id,
            subskill_id=subskill_id
        )

        try:
            # 2. Pre-load data BEFORE initialization
            recommendation_data = await session.gemini_service.problem_integration.problem_service.recommender.get_recommendation(
                student_id=student_id,
                subject=subject,
                unit_filter=None,
                skill_filter=skill_id,
                subskill_filter=subskill_id
            )
            
            objectives_data = None
            if recommendation_data:
                objectives_data = await session.gemini_service.problem_integration.problem_service.competency_service.get_detailed_objectives(
                    subject=subject,
                    subskill_id=recommendation_data['subskill']['id']
                )

            # 3. Now initialize the session with the pre-loaded data
            await session.initialize(
                recommendation_data=recommendation_data,
                objectives_data=objectives_data
            )
            
            # 4. Store the session
            self.sessions[session.id] = session
            logger.info(f"Created new session {session.id} for {subject} - {skill_id}")
            return session
            
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            await self.cleanup_session(session.id)
            raise


    async def cleanup_session(self, session_id: str) -> None:
        """Clean up and remove a session"""
        if session := self.sessions.pop(session_id, None):
            try:
                # Clean up the session (which now handles all service cleanup internally)
                await session.cleanup()
                
                # Clean up audio service separately since it's shared
                try:
                    self.audio_service.remove_session(session_id)
                except Exception as e:
                    logger.error(f"Error cleaning up audio service for session {session_id}: {e}")
                
                # Clean up visual content session
                try:
                    await self.visual_content_manager.cleanup_session(session_id)
                except Exception as e:
                    logger.error(f"Error cleaning up visual content for session {session_id}: {e}")
                
                logger.info(f"Removed session {session_id}")
            except Exception as e:
                logger.error(f"Error during session cleanup {session_id}: {e}")
                raise
        else:
            logger.warning(f"No session found to cleanup: {session_id}")

    async def cleanup_all_sessions(self) -> None:
        """Clean up all active sessions"""
        logger.info("Cleaning up all sessions")
        errors = []
        for session_id in list(self.sessions.keys()):
            try:
                await self.cleanup_session(session_id)
            except Exception as e:
                errors.append((session_id, str(e)))
                
        if errors:
            error_msg = "\n".join([f"Session {sid}: {err}" for sid, err in errors])
            raise RuntimeError(f"Errors during cleanup:\n{error_msg}")
        
    async def shutdown(self) -> None:
        """Shutdown all services and clean up sessions"""
        logger.info("Shutting down session manager and all services")
        try:
            # Clean up all active sessions first
            await self.cleanup_all_sessions()
        except Exception as e:
            logger.error(f"Error during session manager shutdown: {e}")
            raise