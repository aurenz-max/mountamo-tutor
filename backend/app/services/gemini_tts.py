import asyncio
from datetime import datetime
import logging
from typing import Optional, Dict, Any, Callable, List, Tuple
import json
import uuid
import os
import wave
import google.generativeai as genai
from google.generativeai.types import LiveConnectConfig, Content

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)

class GeminiTTS:
    def __init__(self):
        self._current_session_id = None
        self.current_session = None
        self.session_metadata = None
        self.audio_service = AudioService()  # Assuming this is available
        self.tts_service = GeminiTextToSpeechService()
        self.quit = asyncio.Event()
        self.session_reset_event = asyncio.Event()
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.model = "gemini-2.0-flash-exp"  # or appropriate model version

    async def reset_session(self):
        """Reset the current session"""
        self.session_reset_event.set()
        if self.current_session:
            await self.current_session.close()
        await self.tts_service.cleanup()
        self.session_reset_event.clear()
        logger.debug(f"Session reset completed")

    async def connect(
        self,
        session_id: str,
        unified_prompt: str,
        session_metadata: Dict[str, Any],
        voice_name: str = "Puck",  # Not used with Gemini, but kept for compatibility
    ) -> None:
        """Connect to Gemini service and prepare for text-to-speech conversion"""
        try:
            await self.reset_session()
            
            self._current_session_id = session_id
            self.session_metadata = session_metadata
            logger.debug(f"[Session {session_id}] Connecting to Gemini TTS service with metadata: {session_metadata}")

            if session_id not in self.audio_service.sessions:
                raise RuntimeError(f"No AudioService session found for {session_id}")
            
            # Initialize Gemini client
            client = genai.Client(
                api_key=self.api_key,
                http_options={"api_version": "v1alpha"},
            )
            
            # Configure Gemini for audio responses
            config = LiveConnectConfig(
                response_modalities=["AUDIO"],
                system_instruction=Content(parts=[{"text": unified_prompt or "Please respond exactly with the text I send you, converting it to natural-sounding speech."}])
            )

            # Start TTS service
            await self.tts_service.start_tts_service(
                session_id=session_id,
                student_id=session_metadata.get('student_id', 0),
                audio_callback=self._handle_audio
            )
            
            # Connect to Gemini
            session = await client.aio.live.connect(
                model=self.model,
                config=config
            )
            
            self.current_session = session
            logger.debug(f"[Session {session_id}] Connected to Gemini, ready for text input")
            
        except Exception as e:
            logger.error(f"[Session {session_id}] Failed to connect to Gemini TTS: {e}")
            logger.exception(e)
            raise
            
    async def synthesize_speech(self, text: str) -> bool:
        """Convert text to speech using Gemini's audio modality"""
        if not self.current_session or not self._current_session_id:
            logger.error("No active TTS session")
            return False
            
        try:
            session_id = self._current_session_id
            logger.debug(f"[Session {session_id}] Converting text to speech: {text}")
            
            # Send text to Gemini for speech synthesis
            session = self.current_session
            await session.send(input=text, end_of_turn=True)
            
            # Get audio response from Gemini
            audio_chunks = []
            turn = session.receive()
            
            async for response in turn:
                if response.data is not None:
                    audio_chunks.append(response.data)
            
            if not audio_chunks:
                logger.error(f"[Session {session_id}] No audio data received from Gemini")
                return False
                
            # Combine audio chunks
            audio_data = b''.join(audio_chunks)
            
            # Create a response payload
            response_payload = {
                "type": "audio",
                "session_id": session_id,
                "student_id": self.session_metadata.get('student_id', 0),
                "speaker": "system",
                "timestamp": datetime.utcnow().isoformat(),
                "success": True,
                "data": {
                    "audio": audio_data,
                    "text": text,
                    "error": None,
                    "id": str(uuid.uuid4())
                }
            }
            
            # Send the audio through the audio service
            if session_id in self.audio_service.sessions:
                await self.audio_service.send_audio(session_id, audio_data)
                await self.tts_service.audio_callback(response_payload)
                logger.debug(f"[Session {session_id}] Audio synthesized and sent ({len(audio_data)} bytes)")
                return True
            else:
                logger.warning(f"[Session {session_id}] Audio service session no longer exists")
                return False
                
        except Exception as e:
            logger.error(f"[Session {self._current_session_id}] Error synthesizing speech: {e}")
            
            # Create an error response payload
            error_payload = {
                "type": "audio",
                "session_id": self._current_session_id,
                "student_id": self.session_metadata.get('student_id', 0),
                "speaker": "system",
                "timestamp": datetime.utcnow().isoformat(),
                "success": False,
                "data": {
                    "audio": None,
                    "text": text,
                    "error": f"Synthesis error: {str(e)}",
                    "id": str(uuid.uuid4())
                }
            }
            
            await self.tts_service.audio_callback(error_payload)
            return False

    async def _handle_audio(self, audio_data: Dict[str, Any]):
        """Callback handler for audio data"""
        # This can be customized based on your needs
        logger.info(f"[Session {audio_data['session_id']}] Audio generated for text: {audio_data['data']['text']}")
        # Add additional processing here if needed

    async def shutdown(self):
        """Clean shutdown of the TTS service"""
        self.quit.set()
        await self.reset_session()
        logger.info("Gemini TTS service shut down")


class GeminiTextToSpeechService:
    """Service to handle TTS operations"""
    
    def __init__(self):
        self.sessions = {}
        self.audio_callback = None
        
    async def start_tts_service(self, session_id: str, student_id: int, audio_callback: Callable):
        """Initialize a new TTS session"""
        self.sessions[session_id] = {
            "student_id": student_id,
            "start_time": datetime.utcnow().isoformat()
        }
        self.audio_callback = audio_callback
        logger.debug(f"[Session {session_id}] TTS service started")
        
    async def cleanup(self):
        """Clean up resources"""
        self.sessions = {}
        self.audio_callback = None
        logger.debug("TTS service cleaned up")


class AudioService:
    """Service to handle audio playback"""
    
    def __init__(self):
        self.sessions = {}
        
    async def send_audio(self, session_id: str, audio_data: bytes):
        """Send audio data to the client"""
        if session_id not in self.sessions:
            logger.warning(f"[Session {session_id}] No audio session found")
            return False
            
        # Implementation depends on how you want to deliver the audio
        # This could be websockets, saving to file, or other methods
        try:
            # Example: store in session for retrieval
            self.sessions[session_id]["last_audio"] = audio_data
            
            # Example: If using websockets
            # await self.sessions[session_id]["websocket"].send_bytes(audio_data)
            
            # Example: Save to file (for debugging/testing)
            # with open(f"session_{session_id}_audio.wav", "wb") as f:
            #     f.write(audio_data)
            
            logger.debug(f"[Session {session_id}] Audio data sent ({len(audio_data)} bytes)")
            return True
        except Exception as e:
            logger.error(f"[Session {session_id}] Error sending audio: {e}")
            return False


# Helper function to create a wave file (useful for testing)
def wave_file(filename):
    """Create a wave file with appropriate headers for writing audio data"""
    wav = wave.open(filename, 'wb')
    wav.setnchannels(1)  # Mono audio
    wav.setsampwidth(2)  # 16-bit audio
    wav.setframerate(24000)  # 24kHz sample rate (common for Gemini audio)
    return wav