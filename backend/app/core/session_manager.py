# backend/app/core/session_manager.py

import asyncio
import logging
import uuid
from typing import AsyncGenerator, Dict, Optional, Union

from ..services.tutoring import TutoringService
from ..services.audio_service import AudioService

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class TutoringSession:
    def __init__(
        self,
        tutoring_service: TutoringService,
        audio_service: AudioService,
        subject: str,
        skill_description: str,
        subskill_description: str,
        student_id: int,
        competency_score: float,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None
    ):
        self.id = str(uuid.uuid4())
        self.tutoring_service = tutoring_service
        self.audio_service = audio_service
        self.subject = subject
        self.skill_description = skill_description
        self.subskill_description = subskill_description
        self.student_id = student_id
        self.competency_score = competency_score

        # New fields
        self.skill_id = skill_id
        self.subskill_id = subskill_id

        self._active = False
        self.quit_event = asyncio.Event()
        self.text_queue = asyncio.Queue()
        self._initialization_event = asyncio.Event()  # Add this line

    async def handle_text(self, text: str) -> None:
        """Handle text response from Gemini service"""
        try:
            if not self._active:
                return
            #logger.debug(f"Session {self.id}: Received text response")
            await self.text_queue.put(text)
        except Exception as e:
            logger.error(f"Error handling text in session {self.id}: {e}")
            raise

    async def initialize(self) -> None:
            """Initialize the tutoring session"""
            try:
                #logger.debug(f"Starting initialization of session {self.id}")
                
                # Initialize audio service first
                try:
                    self.audio_service.create_session(self.id)
                    # create_session() already handles initialization verification and timeout
                except Exception as e:
                    #logger.error(f"Failed to initialize audio service for session {self.id}: {e}")
                    raise

                # Initialize tutoring service
                await self.tutoring_service.initialize_session(
                    subject=self.subject,
                    skill_description=self.skill_description,
                    subskill_description=self.subskill_description,
                    student_id=self.student_id,
                    competency_score=self.competency_score,
                    session_id=self.id,
                )

                self._active = True
                self._initialization_event.set()
                #logger.info(f"Successfully initialized tutoring session {self.id}")

            except Exception as e:
                logger.error(f"Failed to initialize session {self.id}: {str(e)}")
                self._active = False
                self.quit_event.set()
                raise

    async def get_responses(self) -> AsyncGenerator[Union[str, bytes], None]:
        """Get responses from the session (now only handles text)"""
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

    async def cleanup(self) -> None:
        """Clean up session resources"""
        try:
            self._active = False
            self.quit_event.set()
            self._initialization_event.clear()  # Clear the initialization event
            
            # Only cleanup tutoring service - let SessionManager handle AudioService
            await self.tutoring_service.cleanup_session(self.id)
                
            logger.info(f"Cleaned up session {self.id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up session {self.id}: {str(e)}")
            raise

class SessionManager:
    def __init__(self, tutoring_service: TutoringService, audio_service: AudioService):
        self.tutoring_service = tutoring_service
        self.audio_service = audio_service
        self.sessions: Dict[str, TutoringSession] = {}
        logger.info("Session manager initialized with provided AudioService")

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
        """Create and initialize a new tutoring session"""
        session = TutoringSession(
            tutoring_service=self.tutoring_service,
            audio_service=self.audio_service,
            subject=subject,
            skill_description=skill_description,
            subskill_description=subskill_description,
            student_id=student_id,
            competency_score=competency_score,
            skill_id=skill_id,
            subskill_id=subskill_id
        )

        try:
            # Initialize the session
            await session.initialize()
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
                # First cleanup the session (tutoring service)
                await session.cleanup()
                
                # Then cleanup the audio service
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