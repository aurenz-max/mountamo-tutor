# backend/app/services/live_sessions/base.py
import asyncio
import json
import base64
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect

from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig, Content
from google import genai

from ...core.config import settings

logger = logging.getLogger(__name__)

# Reusable Gemini Client
client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options={"api_version": "v1alpha"},
)

# Shared Constants
MODEL = "gemini-2.5-flash-preview-native-audio-dialog"
DEFAULT_VOICE = "Leda"
FORMAT = "audio/pcm"
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHANNELS = 1

class GeminiLiveSessionHandler(ABC):
    """
    Abstract Base Class for managing a Gemini Live WebSocket session.
    Handles the machinery, subclasses provide the business logic.
    """
    
    def __init__(self, websocket: WebSocket, user_context: dict, initial_data: dict):
        self.websocket = websocket
        self.user_context = user_context
        self.initial_data = initial_data
        self.text_queue = asyncio.Queue()
        self.audio_queue = asyncio.Queue()
        self.gemini_session = None
        self.session_tasks = []

    @abstractmethod
    async def build_system_instruction(self) -> str:
        """Build the main system instruction for Gemini. Must be implemented by subclasses."""
        pass

    @abstractmethod
    async def get_initial_prompt(self) -> str:
        """Return the first message to send to Gemini to kick off the conversation."""
        pass

    @abstractmethod
    async def handle_client_message(self, message: dict):
        """Process a JSON message from the client. Must be implemented by subclasses."""
        pass

    def get_gemini_config(self, system_instruction_text: str) -> LiveConnectConfig:
        """Returns a standardized Gemini LiveConnectConfig. Can be overridden."""
        return LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=SpeechConfig(
                voice_config=VoiceConfig(
                    prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=DEFAULT_VOICE)
                )
            ),
            system_instruction=Content(parts=[{"text": system_instruction_text}])
        )

    async def run(self):
        """Main entry point to run the entire session lifecycle."""
        try:
            system_instruction = await self.build_system_instruction()
            config = self.get_gemini_config(system_instruction)
            
            logger.info(f"Starting Gemini Live session for user {self.user_context.get('email')}")

            async with client.aio.live.connect(model=MODEL, config=config) as session:
                self.gemini_session = session
                logger.info("✅ Gemini Live session connected successfully")

                await self.websocket.send_json({"type": "session_ready", "message": "AI session is ready"})

                # Start communication tasks
                self.session_tasks = [
                    asyncio.create_task(self._handle_client_messages()),
                    asyncio.create_task(self._send_to_gemini(session)),
                    asyncio.create_task(self._receive_from_gemini(session))
                ]

                # Send initial prompt to kick things off
                initial_prompt = await self.get_initial_prompt()
                if initial_prompt:
                    await session.send(input=initial_prompt, end_of_turn=True)
                    logger.info("✅ Initial prompt sent to Gemini")

                # Wait for any task to complete
                done, pending = await asyncio.wait(self.session_tasks, return_when=asyncio.FIRST_COMPLETED)
                
                # Cancel remaining tasks
                for task in pending:
                    task.cancel()
                    
                # Check for any exceptions
                for task in done:
                    if task.exception():
                        logger.error(f"❌ Task failed with exception: {task.exception()}")

        except WebSocketDisconnect:
            logger.info("🔌 Client disconnected")
        except Exception as e:
            logger.error(f"❌ Unhandled session error: {e}", exc_info=True)
            try:
                await self.websocket.close(code=1011, reason="Internal server error")
            except:
                pass
        finally:
            await self._cleanup()

    async def _cleanup(self):
        """Cleanup session resources."""
        # Cancel all tasks
        for task in self.session_tasks:
            if not task.done():
                task.cancel()
        
        # Wait for tasks to finish
        if self.session_tasks:
            await asyncio.gather(*self.session_tasks, return_exceptions=True)
        
        # End Gemini session
        if self.gemini_session:
            try:
                await self.gemini_session.end()
                logger.info("🔚 Gemini session ended")
            except:
                pass
        
        logger.info("🔚 Session cleanup completed")

    # --- Private helper methods for the machinery ---

    async def _handle_client_messages(self):
        """Generic loop to receive messages from the client websocket."""
        try:
            while True:
                try:
                    # First try to receive as JSON
                    message = await self.websocket.receive_json()
                    
                    # Ensure message is a dictionary
                    if not isinstance(message, dict):
                        logger.warning(f"Received non-dict message: {type(message)} - {message}")
                        continue
                    
                    await self.handle_client_message(message)
                    
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received from client: {e}")
                    # Try to receive as text to see what was sent
                    try:
                        raw_message = await self.websocket.receive_text()
                        logger.error(f"Raw message content: {raw_message}")
                    except:
                        pass
                    continue
                except ValueError as e:
                    logger.error(f"Invalid message format: {e}")
                    continue
                    
        except WebSocketDisconnect:
            logger.info("Client message handler detected disconnect.")
        except Exception as e:
            logger.error(f"Error in client message handler: {e}")

    async def _send_to_gemini(self, session):
        """Generic loop to send text/audio from queues to Gemini."""
        send_count = 0
        while True:
            try:
                # Wait for either text or audio to become available
                text_task = asyncio.create_task(self.text_queue.get())
                audio_task = asyncio.create_task(self.audio_queue.get())
                
                done, pending = await asyncio.wait(
                    {text_task, audio_task}, 
                    return_when=asyncio.FIRST_COMPLETED
                )

                if text_task in done:
                    text = text_task.result()
                    logger.info(f"📤 Sending text to Gemini: {text[:100]}...")
                    await session.send(input=text, end_of_turn=True)
                    # Cancel the audio task if it hasn't completed
                    if not audio_task.done():
                        audio_task.cancel()

                if audio_task in done:
                    audio_data = audio_task.result()
                    send_count += 1
                    
                    # Log audio sends occasionally to reduce spam
                    if send_count % 10 == 0:
                        logger.debug(f"📤 Sending audio batch #{send_count} to Gemini")
                    
                    # Handle different audio data formats
                    if isinstance(audio_data, dict):
                        await session.send(input=audio_data)
                    else:
                        # Assume raw bytes
                        await session.send(input={"mime_type": FORMAT, "data": audio_data})
                    
                    # Cancel text task if it hasn't completed
                    if not text_task.done():
                        text_task.cancel()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ Error sending to Gemini: {e}")

    async def _receive_from_gemini(self, session):
        """Generic loop to receive data from Gemini and forward to client."""
        audio_receive_count = 0
        try:
            async for response in session.receive():
                # Handle audio data
                if response.data:
                    audio_receive_count += 1
                    # Log occasionally to reduce spam
                    if audio_receive_count % 20 == 0:
                        logger.debug(f"📥 Received audio batch #{audio_receive_count} from Gemini")
                    
                    audio_b64 = base64.b64encode(response.data).decode()
                    await self.websocket.send_json({
                        "type": "ai_audio",
                        "data": audio_b64,
                        "format": "raw-pcm",
                        "sampleRate": RECEIVE_SAMPLE_RATE
                    })
                
                # Handle server content (if present)
                if hasattr(response, 'server_content') and response.server_content:
                    await self._handle_server_content(response.server_content)
                    
        except asyncio.CancelledError:
            logger.info("Gemini receive handler cancelled")
        except Exception as e:
            logger.error(f"❌ Error receiving from Gemini: {e}")

    async def _handle_server_content(self, server_content):
        """Handle server content from Gemini responses."""
        try:
            # Handle model turn with parts
            if hasattr(server_content, 'model_turn') and server_content.model_turn:
                model_turn = server_content.model_turn
                if hasattr(model_turn, 'parts') and model_turn.parts:
                    for part in model_turn.parts:
                        # Handle text parts
                        if hasattr(part, 'text') and part.text:
                            logger.info(f"📥 Received text from Gemini: {part.text[:100]}...")
                            await self.websocket.send_json({
                                "type": "ai_text",
                                "content": part.text
                            })
                        
                        # Handle inline audio data
                        elif hasattr(part, 'inline_data') and part.inline_data:
                            if hasattr(part.inline_data, 'data') and part.inline_data.data:
                                audio_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                                await self.websocket.send_json({
                                    "type": "ai_audio",
                                    "format": "raw-pcm",
                                    "sampleRate": RECEIVE_SAMPLE_RATE,
                                    "bitsPerSample": 16,
                                    "channels": CHANNELS,
                                    "data": audio_b64
                                })

            # Handle transcriptions
            if hasattr(server_content, 'input_transcription') and server_content.input_transcription:
                if hasattr(server_content.input_transcription, 'text') and server_content.input_transcription.text:
                    logger.info(f"🎤 User transcription: {server_content.input_transcription.text}")
                    await self.websocket.send_json({
                        "type": "user_transcription",
                        "content": server_content.input_transcription.text
                    })

            if hasattr(server_content, 'output_transcription') and server_content.output_transcription:
                if hasattr(server_content.output_transcription, 'text') and server_content.output_transcription.text:
                    logger.info(f"🎯 AI transcription: {server_content.output_transcription.text}")
                    await self.websocket.send_json({
                        "type": "ai_transcription", 
                        "content": server_content.output_transcription.text
                    })
                    
        except Exception as e:
            logger.error(f"❌ Error handling server content: {e}")

    # Helper methods for common operations
    async def send_text_to_gemini(self, text: str):
        """Helper to queue text for Gemini."""
        await self.text_queue.put(text)

    async def send_audio_to_gemini(self, audio_data):
        """Helper to queue audio for Gemini."""
        await self.audio_queue.put(audio_data)