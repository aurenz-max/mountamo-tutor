import asyncio
import logging
from typing import Dict, Any, Optional, AsyncGenerator, Callable, Awaitable
import base64
import numpy as np

from .gemini import GeminiService
from .audio_service import AudioService
from ..services.azure_tts import AzureSpeechService

logger = logging.getLogger(__name__)
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
        
        # Callback for scene handling
        self._scene_callback: Optional[Callable[[str, Dict[str, Any]], Awaitable[None]]] = None
        
    def _create_tutoring_prompt(
        self,
        subject: str,
        skill_description: str,
        subskill_description: str,
        competency_score: float,
        tool_config: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a tutoring prompt based on the tool configuration provided."""
        base_prompt = f"""You are conducting a live kindergarten tutoring session using voice interaction.

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
    5. Speak clearly and at an appropriate pace for a young child"""

        # Add visual capabilities to the prompt only if the tool_config includes visual functions
        visual_prompt = ""
        
        # Check if tool_config includes visual capabilities (create_scene function)
        has_visual = False
        if tool_config and "function_declarations" in tool_config:
            function_names = [f.get("name", "") for f in tool_config["function_declarations"]]
            has_visual = "create_scene" in function_names
        
        if has_visual:
            visual_prompt = """
    Visual Teaching Tools:
    You can create visual counting scenes to assist with teaching. For example:
    1. First call get_categories() to discover available image categories
    2. Then call get_objects(category) to see what objects are in that category 
    3. Finally call create_scene() with specific objects and counts

    When using visuals:
    - Use images that relate to the current teaching topic
    - Create counting exercises with various objects
    - Ask the student to count the objects you show
    - Keep visuals simple and focused on the learning objective
    - Be specific about what the student should look at or count

    IMPORTANT SCENE MANAGEMENT INSTRUCTIONS:

    1. DO NOT create more than one visual scene at a time. Students need time to process and complete each problem.

    2. Always follow this sequence when working with visual content:
    a. Create ONE visual scene for a problem
    b. Wait for the student to complete work on that problem
    c. Listen for explicit verbal confirmation that the student has finished before moving on
    d. Only then create a new scene/problem

    3. Common student completion phrases to listen for:
    - "I'm done"
    - "I finished"
    - "That's [number]"
    - "The answer is [number]"
    - "Next problem"
    - "Next question"

    4. If you're unsure if the student has completed the current problem, ask them directly:
    - "Would you like to try another problem?"
    - "Shall we move on to the next problem?"

    Remember: Pacing is critical for effective learning. Give students adequate time with each problem.
    """

        return f"{base_prompt}\n\n{visual_prompt}\n\nRemember:\n- This is a live voice conversation - respond naturally to audio input\n- Keep the student engaged and interested\n- Make learning fun and interactive\n- Build confidence through positive reinforcement\n- Stay focused on the current skill/subskill\n- Never reference ending the session or switching topics"

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
        unit_id: Optional[str] = None,  # Add unit_id parameter
        tool_config: Optional[Dict[str, Any]] = None,  # Add tool_config parameter
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

        # Set up scene callback for Gemini if visual integration is available
        if self._scene_callback:
            # Create a wrapper function to include session_id in callback
            async def handle_scene_callback(scene_data: Dict[str, Any]) -> None:
                await self._scene_callback(session_id, scene_data)
                
            # Register with GeminiService if it supports scene callbacks
            if hasattr(self.gemini, 'register_scene_callback'):
                self.gemini.register_scene_callback(handle_scene_callback)
                logger.debug(f"[Session {session_id}] Registered scene callback with GeminiService")

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
        """Handle inbound media (audio and images) from the client for a specific session"""
        session = self._sessions.get(session_id)
        if not session or not session.get("is_active"):
            raise ValueError(f"Session not found or inactive: {session_id}")

        try:
            # Handle scene-related messages specifically
            if message.get("type") == "scene_action":
                # These are handled by the TutoringSession class directly
                pass
            # Process realtime input (audio and image data)
            elif message.get("type") == "realtime_input" or message.get("media_chunks"):
                # Process media chunks
                media_chunks = message.get("media_chunks", [])
                
                # If using the nested structure format
                if not media_chunks and message.get("realtime_input", {}).get("media_chunks"):
                    media_chunks = message.get("realtime_input", {}).get("media_chunks", [])
                
                for chunk in media_chunks:
                    mime_type = chunk.get("mime_type", "audio/pcm")  # Default to audio if not specified
                    
                    if b64_data := chunk.get("data"):
                        raw_data = base64.b64decode(b64_data)
                        
                        if mime_type == "audio/pcm":
                            # Process audio data
                            array = np.frombuffer(raw_data, dtype=np.int16)
                            await self.gemini.receive((16000, array))
                        elif mime_type.startswith("image/"):
                            # Process image data
                            # No need to convert to numpy array for images, send raw bytes
                            await self.gemini.receive_image(raw_data, mime_type)
                        else:
                            logger.warning(f"Unsupported mime type received: {mime_type}")

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