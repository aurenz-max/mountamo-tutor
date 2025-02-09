import asyncio
import logging
from typing import AsyncGenerator, Callable, Optional, Dict, Any, List
import base64
import numpy as np
from ..core.config import settings

from google import genai
from google.genai.types import (
    Content,
    LiveConnectConfig,
    PrebuiltVoiceConfig,
    SpeechConfig,
    VoiceConfig,
)

from ..core.config import settings
from .audio_service import AudioService

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class GeminiService:
    def __init__(self, audio_service: AudioService) -> None:
        self.input_queue: asyncio.Queue = asyncio.Queue()
        self.quit: asyncio.Event = asyncio.Event()
        self.session_reset_event: asyncio.Event = asyncio.Event()
        self.audio_service = audio_service
        self._current_session_id: Optional[str] = None
        self._stream_task: Optional[asyncio.Task] = None
        self.current_session = None
        logger.debug("GeminiService initialized with provided AudioService")

    async def stream(self) -> AsyncGenerator[bytes, None]:
        """Helper method to stream input audio to Gemini"""
        while not self.quit.is_set():
            try:
                audio = await self.input_queue.get()
                if audio is None:  # Signal to end stream
                    break
                yield audio
                # Acknowledge processing of the queue item
                self.input_queue.task_done()
                #logger.debug(f"[Frontend Stream being sent to Gemini: {audio}]") 
                
            except asyncio.CancelledError:
                logger.debug("Stream cancelled")
                break
            except Exception as e:
                logger.error(f"Error in stream: {e}")
                continue
        logger.debug("Audio stream ended")
        return

    async def reset_session(self):
        """Reset the current session state"""
        logger.info("Resetting Gemini session state")
        self.session_reset_event.set()  # Signal for session reset
        
        # Wait for current session to close if it exists
        if self.current_session:
            try:
                await self.current_session.close()
            except Exception as e:
                logger.error(f"Error closing session: {e}")
            finally:
                self.current_session = None
        
        # Reset the event for next use
        self.session_reset_event.clear()
        return True

    async def connect(
        self,
        session_id: str,
        unified_prompt: str,
        voice_name: str = "Puck",
    ) -> None:
        """Connect to Gemini and start streaming"""
        try:
            # Reset any existing session first
            await self.reset_session()
            
            self._current_session_id = session_id
            logger.debug(f"[Session {session_id}] Connecting to Gemini service")
            
            # Verify AudioService session exists
            if session_id not in self.audio_service.sessions:
                raise RuntimeError(f"No AudioService session found for {session_id}")
            
            client = genai.Client(
                api_key=settings.GEMINI_API_KEY,
                http_options={"api_version": "v1alpha"},
            )
            
            config = LiveConnectConfig(
                response_modalities=["AUDIO"],
                speech_config=SpeechConfig(
                    voice_config=VoiceConfig(
                        prebuilt_voice_config=PrebuiltVoiceConfig(
                            voice_name=voice_name,
                        )
                    )
                ),
                system_instruction=Content(parts=[{"text": unified_prompt}])
            )

            async with client.aio.live.connect(
                model="gemini-2.0-flash-exp", config=config
            ) as session:
                self.current_session = session
                logger.debug(f"[Session {session_id}] Connected to Gemini, starting stream")
                
                try:
                    async for response in session.start_stream(
                        stream=self.stream(), mime_type="audio/pcm;rate=16000"
                    ):
                        if self.quit.is_set() or self.session_reset_event.is_set():
                            break
                            
                        if response.data and self.audio_service:
                            try:
                                # Verify session still exists before queueing
                                if session_id in self.audio_service.sessions:
                                    self.audio_service.add_to_queue(session_id, response.data)
                                else:
                                    logger.warning(f"[Session {session_id}] Audio service session no longer exists")
                                    break
                            except Exception as e:
                                logger.error(f"[Session {session_id}] Error routing audio to audio service: {e}")
                                continue
                except asyncio.CancelledError:
                    logger.info(f"[Session {session_id}] Gemini stream cancelled")
                except Exception as e:
                    logger.error(f"[Session {session_id}] Error in Gemini stream: {e}")
                    raise

        except Exception as e:
            logger.error(f"[Session {session_id}] Failed to connect to Gemini: {e}")
            logger.exception(e)  # This will print the full stack trace
            raise
        finally:
            self._current_session_id = None
            self.current_session = None

    async def receive(self, frame: tuple[int, np.ndarray]) -> None:
        """Receive audio from the user and put it in the input stream."""
        try:
            if self.quit.is_set():
                return
               
            _, array = frame
            array = array.squeeze()
            audio_message = array.tobytes()
            #logger.debug(f"[Frontend Audio Message being sent to Gemini: {audio_message}]") 
            
            # Use put_nowait to avoid blocking if queue is full
            try:
                self.input_queue.put_nowait(audio_message)
            except asyncio.QueueFull:
                logger.warning("Input queue full, dropping audio frame")
                
        except Exception as e:
            logger.error(f"Error processing received audio frame: {e}")

    def shutdown(self) -> None:
        """Stop the stream method on shutdown"""
        self.quit.set()
        asyncio.create_task(self.reset_session())