# backend/app/core/session_manager.py

import asyncio
import logging
import uuid
from typing import AsyncGenerator, Dict, Optional, Union, Any


from ..services.tutoring import TutoringService
from ..services.audio_service import AudioService
from ..services.azure_tts import AzureSpeechService
from ..services.gemini import GeminiService
from ..db.cosmos_db import CosmosDBService

from app.core.config import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)

class TutoringSession:
    def __init__(
        self,
        audio_service: AudioService,
        cosmos_db: CosmosDBService,
        subject: str,
        skill_description: str,
        subskill_description: str,
        student_id: int,
        competency_score: float,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None
    ):
        self.id = str(uuid.uuid4())
        self.audio_service = audio_service
        self.cosmos_db = cosmos_db
        
        # Initialize session-specific services
        self.speech_service = AzureSpeechService(
            subscription_key=settings.TTS_KEY, 
            region=settings.TTS_REGION
        )
        self.speech_service.cosmos_db = cosmos_db
        
        # Initialize GeminiService with the speech_service for this session only
        self.gemini_service = GeminiService(
            audio_service=self.audio_service,
            azure_speech_service=self.speech_service
        )
        
        # Initialize TutoringService for this session only
        self.tutoring_service = TutoringService(
            audio_service=self.audio_service,
            gemini_service=self.gemini_service,
            azure_speech_service=self.speech_service
        )

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
        
        self._active = False
        self.quit_event = asyncio.Event()
        self._initialization_event = asyncio.Event()
        
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

    async def initialize(self, 
                        recommendation_data: Optional[Dict] = None,
                        objectives_data: Optional[Dict] = None) -> None:
        """Initialize the tutoring session"""
        try:
            logger.debug(f"Starting initialization of session {self.id}")
            
            # Initialize audio service first
            try:
                self.audio_service.create_session(self.id)
            except Exception as e:
                logger.error(f"Failed to initialize audio service for session {self.id}: {e}")
                raise

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

            # Define a callback that enqueues transcripts into the session's transcript_queue
            def transcription_callback(transcript: Dict[str, Any]):
                asyncio.create_task(self.transcript_queue.put(transcript))

            # Start continuous transcription
            await self.speech_service.start_continuous_transcription(
                self.id, 
                self.student_id,
                transcription_callback  # Pass the function reference
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
            raise ValueError("Session is not active")

        try:
            while not self.quit_event.is_set():
                try:
                    problem = await self.problem_queue.get()
                    yield problem
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error getting problem response: {e}")
                    continue

        except asyncio.CancelledError:
            logger.info(f"Problem response generator cancelled for session {self.id}")
        except Exception as e:
            logger.error(f"Error getting problem responses for session {self.id}: {e}")
            raise
            
    async def send_problem(self, problem: Dict[str, Any]) -> None:
        """Queue a problem to be sent to the frontend"""
        try:
            if not self._active:
                return
            await self.problem_queue.put(problem)
        except Exception as e:
            logger.error(f"Error handling problem in session {self.id}: {e}")
            raise

    async def get_transcripts(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Get speech transcripts from the session"""
        if not self._active:
            raise ValueError("Session is not active")

        try:
            while not self.quit_event.is_set():
                try:
                    transcript = await self.transcript_queue.get()
                    logger.info(f"Transcript log for session {self.id}  {transcript}")
                    yield transcript
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error getting transcript: {e}")
                    continue
        except asyncio.CancelledError:
            logger.info(f"Transcript generator cancelled for session {self.id}")

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
    def __init__(self, audio_service: AudioService, cosmos_db: CosmosDBService):
        self.audio_service = audio_service
        self.cosmos_db = cosmos_db  # Add this line to store cosmos_db
        self.sessions: Dict[str, TutoringSession] = {}
        logger.info("Session manager initialized with AudioService and CosmosDBService")

    async def create_session(
        self,
        subject: str,
        skill_description: str,
        subskill_description: str,
        student_id: int,
        competency_score: float,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
    ) -> TutoringSession:
        """Create and initialize a new tutoring session with pre-loaded data"""
        session = TutoringSession(
            audio_service=self.audio_service,
            cosmos_db=self.cosmos_db,  # This is now properly accessible
            subject=subject,
            skill_description=skill_description,
            subskill_description=subskill_description,
            student_id=student_id,
            competency_score=competency_score,
            skill_id=skill_id,
            subskill_id=subskill_id
        )

        try:
            # Pre-load data before initialization
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

            # Initialize with pre-loaded data
            await session.initialize(
                recommendation_data=recommendation_data,
                objectives_data=objectives_data
            )
            
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