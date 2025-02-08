from typing import AsyncGenerator, Dict, Any, Optional, Union, Callable, Awaitable
from .gemini import GeminiService
from .audio_service import AudioService
import asyncio
import logging
import base64
import numpy as np

logger = logging.getLogger()  # root logger
logger.setLevel(logging.DEBUG)

class TutoringService:
    def __init__(self, audio_service: AudioService):
        """Initialize TutoringService with a shared AudioService instance"""
        logger.info("Initializing TutoringService with provided AudioService")
        self.audio_service = audio_service
        # Pass the same AudioService instance to GeminiService
        self.gemini = GeminiService(self.audio_service)
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
        session_id: str = None,
    ) -> str:
        if not session_id:
            session_id = f"{student_id}_{len(self._sessions) + 1}"

        logger.debug(f"[Session {session_id}] Initializing tutoring session")

        if session_id in self._sessions:
            logger.warning(f"Session {session_id} already exists, cleaning up old session")
            await self.cleanup_session(session_id)

        tutoring_prompt = self._create_tutoring_prompt(
            subject, skill_description, subskill_description, competency_score
        )

        self._sessions[session_id] = {
            "id": session_id,
            "is_active": True,
            "quit_event": asyncio.Event()
        }

        try:
            # Start Gemini connection with proper error handling
            gemini_task = asyncio.create_task(
                self.gemini.connect(
                    session_id=session_id,
                    unified_prompt=tutoring_prompt
                )
            )
            await asyncio.wait_for(asyncio.shield(gemini_task), timeout=5.0)
            logger.info(f"Started tutoring session {session_id}")
            return session_id
        except Exception as e:
            logger.error(f"Failed to start Gemini connection for session {session_id}: {e}")
            await self.cleanup_session(session_id)
            raise

    async def process_message(self, session_id: str, message: Dict) -> None:
        """Handle inbound audio from the client"""
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
            raise

    async def cleanup_session(self, session_id: str) -> None:
        """Clean up a tutoring session"""
        logger.info(f"Cleaning up tutoring session {session_id}")
        if session := self._sessions.get(session_id):
            try:
                session["is_active"] = False
                session["quit_event"].set()
                await self.gemini.cleanup()
                self._sessions.pop(session_id, None)
                logger.info(f"Session {session_id} cleaned up successfully")
            except Exception as e:
                logger.error(f"Error during cleanup of session {session_id}: {e}")
                raise