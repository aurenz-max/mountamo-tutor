from typing import AsyncGenerator, Dict, Any, Optional, Union, Callable, Awaitable
from .gemini import GeminiService
from .audio_service import AudioService
from ..services.azure_tts import AzureSpeechService

import asyncio
import logging
import base64
import numpy as np

logger = logging.getLogger()  # root logger
logger.setLevel(logging.WARNING)

class TutoringService:
    def __init__(
        self, 
        audio_service: AudioService,
        gemini_service: GeminiService,
        azure_speech_service: Optional[AzureSpeechService] = None
    ):
        """Initialize TutoringService for a specific session"""
        self.audio_service = audio_service
        self.gemini = gemini_service
        self.azure_speech_service = azure_speech_service or gemini_service.azure_speech_service

        # Store session-specific data
        self._sessions: Dict[str, Dict[str, Any]] = {}
        
    def _create_tutoring_prompt(
        self,
        subject: str,
        skill_description: str,
        subskill_description: str,
        competency_score: float
    ) -> str:
        return f"""You are conducting a live kindergarten tutoring session using voice interaction.

Role and Communication Style:
- You are a friendly, encouraging kindergarten tutor speaking with a 5-6 year old
- Keep your speech simple, clear, and age-appropriate
- Use a warm, engaging speaking voice
- Keep responses concise (3-5 sentences) to maintain attention
- Always be positive and encouraging
- Focus on one concept at a time

Current Lesson Focus:
- Subject: {subject}
- Skill: {skill_description}
- Subskill: {subskill_description}
- Student's current competency level: {competency_score}/10

Teaching Guidelines:
1. Start with a warm greeting and introduction to the topic
2. Relate concepts to things familiar in a 5-6 year old's daily life
3. Ask engaging, open-ended questions to encourage participation
4. Provide immediate positive feedback to responses
5. If the student seems confused, gently guide them back to the lesson
6. Include frequent checks for understanding
7. Use simple examples and clear explanations
8. Maintain an encouraging but professional teaching style

Audio Interaction Guidelines:
1. Respond naturally to student's voice input
2. Keep your responses conversational and engaging
3. Use appropriate pauses to allow for student response
4. Maintain consistent energy and enthusiasm in your voice
5. Speak clearly and at an appropriate pace for a young child

Remember:
- This is a live voice conversation - respond naturally to audio input
- Keep the student engaged and interested
- Make learning fun and interactive
- Build confidence through positive reinforcement
- Stay focused on the current skill/subskill
- Never reference ending the session or switching topics"""

    async def initialize_session(
        self,
        subject: str,
        skill_description: str,
        subskill_description: str,
        student_id: int,
        competency_score: float,
        session_id: str,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        difficulty_range: Optional[Dict[str, float]] = None,
        # Add new parameters for pre-loaded data
        recommendation_data: Optional[Dict] = None,
        objectives_data: Optional[Dict] = None,
    ) -> str:
        """Initialize a tutoring session with the given parameters"""
        if not session_id:
            session_id = f"{student_id}_{len(self._sessions) + 1}"

        logger.debug(f"[Session {session_id}] Initializing tutoring session")

        tutoring_prompt = self._create_tutoring_prompt(
            subject, skill_description, subskill_description, competency_score
        )

        # Store session data
        self._sessions[session_id] = {
            "id": session_id,
            "is_active": True,
            "quit_event": asyncio.Event(),
            "gemini_task": None,  # This will store the Gemini task
            "recommendation_data": recommendation_data,
            "objectives_data": objectives_data
        }
        
        # Create session metadata for Gemini
        session_metadata = {
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "skill_description": skill_description,
            "subskill_description": subskill_description,
            "student_id": student_id,
            "competency_score": competency_score,
            "difficulty_range": difficulty_range,
            "recommendation_data": recommendation_data,
            "objectives_data": objectives_data,
        }

        # Create and store the Gemini connection task
        gemini_task = asyncio.create_task(
            self.gemini.connect(
                session_id=session_id,
                unified_prompt=tutoring_prompt,
                session_metadata=session_metadata,
            )
        )
        
        # Store the task for later cleanup
        self._sessions[session_id]["gemini_task"] = gemini_task
        
        logger.info(f"Started tutoring session {session_id}")
        return session_id

    async def process_message(self, session_id: str, message: Dict) -> None:
        """Handle inbound audio from the client for a specific session"""
        session = self._sessions.get(session_id)
        if not session or not session.get("is_active"):
            raise ValueError(f"Session not found or inactive: {session_id}")

        try:
            # Process media chunks
            media_chunks = message.get("media_chunks", [])
            for chunk in media_chunks:
                if b64_data := chunk.get("data"):
                    raw_audio = base64.b64decode(b64_data)
                    # Convert to numpy array for Gemini
                    array = np.frombuffer(raw_audio, dtype=np.int16)

                    await self.gemini.receive((16000, array))

            # Handle legacy audio_data field
            if audio_data_b64 := message.get("audio_data"):
                raw_audio = base64.b64decode(audio_data_b64)
                array = np.frombuffer(raw_audio, dtype=np.int16)
                await self.gemini.receive((16000, array))

        except Exception as e:
            logger.error(f"Error processing message for session {session_id}: {e}")
            logger.exception(e)
            raise

    async def get_transcripts(self, session_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Get transcripts for the specific session"""
        session = self._sessions.get(session_id)
        if not session or not session.get("is_active"):
            raise ValueError(f"Session not found or inactive: {session_id}")
            
        while not session["quit_event"].is_set():
            try:
                transcript = await session["transcript_queue"].get()
                yield transcript
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error getting transcript: {e}")
                continue

    async def cleanup_session(self, session_id: str) -> None:
        """Clean up a tutoring session and all associated resources"""
        logger.info(f"Cleaning up tutoring session {session_id}")
        if session := self._sessions.get(session_id):
            try:
                # Mark session as inactive
                session["is_active"] = False
                session["quit_event"].set()
                
                # Cancel Gemini task if it exists
                if gemini_task := session.get("gemini_task"):
                    if not gemini_task.done():
                        gemini_task.cancel()
                        try:
                            await gemini_task
                        except asyncio.CancelledError:
                            pass
                
                # Cleanup Gemini service
                try:
                    self.gemini.shutdown()
                    await self.gemini.reset_session()
                except Exception as e:
                    logger.error(f"Error cleaning up Gemini service for session {session_id}: {e}")
                
                # Remove session data
                self._sessions.pop(session_id, None)
                logger.info(f"Session {session_id} cleaned up successfully")
                
            except Exception as e:
                logger.error(f"Error during cleanup of session {session_id}: {e}")
                raise