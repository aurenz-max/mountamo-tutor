import azure.cognitiveservices.speech as speechsdk
import asyncio
from datetime import datetime
import logging
from typing import Optional, Dict, Any, Callable, List, Tuple
import json
import uuid

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)
        
class GeminiSST:
    def __init__(self):
        self._current_session_id = None
        self.current_session = None
        self.session_metadata = None
        self.audio_service = AudioService()  # Assuming this is available
        self.transcription_service = GeminiTranscriptionService()
        self.quit = asyncio.Event()
        self.session_reset_event = asyncio.Event()

    async def reset_session(self):
        """Reset the current session"""
        self.session_reset_event.set()
        if self.current_session:
            await self.current_session.close()
        await self.transcription_service.cleanup()
        self.session_reset_event.clear()
        logger.debug(f"Session reset completed")

    async def stream(self):
        """Placeholder for audio stream - implement based on your audio source"""
        # This should be implemented based on your audio input source
        # Example: yielding audio chunks from a microphone or file
        raise NotImplementedError("Audio stream method must be implemented")

    async def connect(
        self,
        session_id: str,
        unified_prompt: str,
        session_metadata: Dict[str, Any],
        voice_name: str = "Puck",  # Kept for compatibility, though unused
    ) -> None:
        """Connect to Gemini Live Multimodal and start streaming with text transcription"""
        try:
            await self.reset_session()
            
            self._current_session_id = session_id
            self.session_metadata = session_metadata
            logger.debug(f"[Session {session_id}] Connecting to Gemini service with metadata: {session_metadata}")

            if session_id not in self.audio_service.sessions:
                raise RuntimeError(f"No AudioService session found for {session_id}")
            
            client = genai.Client(
                api_key=settings.GEMINI_API_KEY,
                http_options={"api_version": "v1alpha"},
            )
            
            # System prompt for transcription
            transcription_prompt = """Generate a transcript of the speech.
            Please do not include any other text in the response.
            If you cannot hear the speech, please only say '<Not recognizable>'."""
            
            config = LiveConnectConfig(
                response_modalities=["TEXT"],
                system_instruction=Content(parts=[{"text": transcription_prompt}]),
                tools=[TOOL_CREATE_PROBLEM]
            )

            # Start transcription service
            await self.transcription_service.start_transcription(
                session_id=session_id,
                student_id=session_metadata.get('student_id', 0),
                transcript_callback=self._handle_transcript
            )

            async with client.aio.live.connect(
                model="gemini-2.0-flash-exp",
                config=config
            ) as session:
                self.current_session = session
                logger.debug(f"[Session {session_id}] Connected to Gemini Live, starting stream")
                
                try:
                    async for response in session.start_stream(
                        stream=self.stream(),
                        mime_type="audio/pcm;rate=16000"
                    ):
                        if self.quit.is_set() or self.session_reset_event.is_set():
                            break
                            
                        if response.data:
                            try:
                                if session_id in self.audio_service.sessions:
                                    transcribed_text = response.data.decode('utf-8') if isinstance(response.data, bytes) else response.data
                                    
                                    response_payload = {
                                        "type": "transcript",
                                        "session_id": session_id,
                                        "student_id": self.session_metadata.get('student_id', 0),
                                        "speaker": "user",
                                        "timestamp": datetime.utcnow().isoformat(),
                                        "success": transcribed_text != '<Not recognizable>',
                                        "data": {
                                            "text": transcribed_text,
                                            "error": None if transcribed_text != '<Not recognizable>' else "Unrecognizable speech",
                                            "is_partial": False,
                                            "id": str(uuid.uuid4())
                                        }
                                    }
                                    
                                    await self.transcription_service.transcript_callback(response_payload)
                                    logger.debug(f"[Session {session_id}] Transcribed text: {transcribed_text}")
                                else:
                                    logger.warning(f"[Session {session_id}] Audio service session no longer exists")
                                    break
                            except Exception as e:
                                logger.error(f"[Session {session_id}] Error processing transcription: {e}")
                                continue
                                
                except asyncio.CancelledError:
                    logger.info(f"[Session {session_id}] Gemini stream cancelled")
                except Exception as e:
                    logger.error(f"[Session {session_id}] Error in Gemini stream: {e}")
                    raise

        except Exception as e:
            logger.error(f"[Session {session_id}] Failed to connect to Gemini: {e}")
            logger.exception(e)
            raise
        finally:
            self._current_session_id = None
            self.current_session = None
            self.session_metadata = None
            await self.transcription_service.cleanup()

    async def _handle_transcript(self, transcript_data: Dict[str, Any]):
        """Callback handler for transcript data"""
        # This can be customized based on your needs
        logger.info(f"[Session {transcript_data['session_id']}] Transcript received: {transcript_data['data']['text']}")
        # Add additional processing here if needed

    async def shutdown(self):
        """Clean shutdown of the SST service"""
        self.quit.set()
        await self.reset_session()
        logger.info("Gemini SST service shut down")