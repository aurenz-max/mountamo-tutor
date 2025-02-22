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
from .gemini_problem import GeminiProblemIntegration
from ..services.azure_tts import AzureSpeechService


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


TOOL_CREATE_PROBLEM = {
    "function_declarations": [
        {
            "name": "create_problem",
            "description": "Generate a practice problem for the current skill being taught.",
        }
    ],
    
}

class GeminiService:
    def __init__(self, audio_service: AudioService, azure_speech_service: Optional[AzureSpeechService] = None) -> None:
        # Session-specific resources
        self.input_queue: asyncio.Queue = asyncio.Queue()
        self.quit: asyncio.Event = asyncio.Event()
        self.session_reset_event: asyncio.Event = asyncio.Event()
        
        # Shared services
        self.audio_service = audio_service
        self.azure_speech_service = azure_speech_service
        
        # Problem integration is session-specific
        self.problem_integration = GeminiProblemIntegration()
        
        # Session state
        self._current_session_id: Optional[str] = None
        self._stream_task: Optional[asyncio.Task] = None
        self.current_session = None
        self.session_metadata: Optional[Dict[str, Any]] = None
        
        logger.debug("GeminiService initialized with provided AudioService")
        logger.info(f"GeminiService using provided AzureSpeechService: {self.azure_speech_service is not None}")

    async def stream(self) -> AsyncGenerator[bytes, None]:
        """Helper method to stream input audio to Gemini"""
        try:
            while not self.quit.is_set() and not self.session_reset_event.is_set():
                try:
                    audio = await asyncio.wait_for(self.input_queue.get(), timeout=0.1)
                    if audio is None:  # Signal to end stream
                        break
                    yield audio
                    # Acknowledge processing of the queue item
                    self.input_queue.task_done()
                except asyncio.TimeoutError:
                    # Just a timeout for checking quit condition periodically
                    continue
                except asyncio.CancelledError:
                    logger.debug("Stream cancelled")
                    break
                except Exception as e:
                    logger.error(f"Error in stream: {e}")
                    continue
        finally:
            logger.debug(f"[Session {self._current_session_id}] Audio stream ended")
        return

    async def create_problem(
        self,
        recommendation_data: Optional[Dict] = None,
        objectives_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Initiates problem creation through handle_problem_creation.
        """
        if not self.session_metadata or not self._current_session_id:
            logger.error("No session context available for problem creation")
            return {"status": "error", "message": "No session context"}
        
        try:
            # Call handle_problem_creation with full session metadata and pre-loaded data
            result = await self.problem_integration.handle_problem_creation(
                session_metadata=self.session_metadata,
                session_id=self._current_session_id,
                session_recommendation=recommendation_data,
                session_objectives=objectives_data
            )
            
            if result:
                logger.debug(f"Problem creation successful for session {self._current_session_id}")
                return {"status": "success", "data": result}
            else:
                logger.error(f"Problem creation failed for session {self._current_session_id}")
                return {"status": "error", "message": "Failed to create problem"}
        except Exception as e:
            logger.error(f"Error in create_problem for session {self._current_session_id}: {str(e)}")
            return {"status": "error", "message": "Error during problem creation"}

    async def initialize_session(
        self, 
        session_id: str, 
        session_metadata: Dict[str, Any]
    ) -> None:
        """Initialize service for a specific session"""
        logger.info(f"Initializing GeminiService for session {session_id}")
        
        # Ensure any previous session is cleaned up
        await self.reset_session()
        
        # Set session-specific state
        self._current_session_id = session_id
        self.session_metadata = session_metadata
        
        # Create a new input queue for this session
        self.input_queue = asyncio.Queue()
        self.session_reset_event.clear()
        self.quit.clear()
        
        logger.debug(f"[Session {session_id}] GeminiService initialized with metadata: {session_metadata}")

    async def connect(
        self,
        session_id: str,
        unified_prompt: str,
        session_metadata: Dict[str, Any],
        voice_name: str = "Puck",
    ) -> None:
        """Connect to Gemini and start streaming"""
        try:
            # Initialize the session first
            await self.initialize_session(session_id, session_metadata)
            
            # Validate that audio service has been set up for this session
            if session_id not in self.audio_service.sessions:
                raise RuntimeError(f"No AudioService session found for {session_id}")
            
            # Check speech service status
            if self.azure_speech_service:
                logger.info(f"[Session {session_id}] Azure speech service initialized: {self.azure_speech_service is not None}")
                logger.info(f"[Session {session_id}] Azure push_stream initialized: {self.azure_speech_service.push_stream is not None}")
                logger.info(f"[Session {session_id}] Azure speech_recognizer initialized: {self.azure_speech_service.speech_recognizer is not None}")
            
            # Initialize Gemini client
            client = genai.Client(
                api_key=settings.GEMINI_API_KEY,
                http_options={"api_version": "v1alpha"},
            )
            
            # Configure the session
            config = LiveConnectConfig(
                response_modalities=["AUDIO"],
                speech_config=SpeechConfig(
                    voice_config=VoiceConfig(
                        prebuilt_voice_config=PrebuiltVoiceConfig(
                            voice_name=voice_name,
                        )
                    )
                ),
                system_instruction=Content(parts=[{"text": unified_prompt}]),
                tools=[TOOL_CREATE_PROBLEM]
            )

            # Connect to Gemini and handle the session
            async with client.aio.live.connect(
                model="gemini-2.0-flash-exp", config=config
            ) as session:
                self.current_session = session
                logger.debug(f"[Session {session_id}] Connected to Gemini, starting stream")
                
                try:
                    async for response in session.start_stream(
                        stream=self.stream(), mime_type="audio/pcm;rate=16000"
                    ):
                        # Check if we should terminate the stream
                        if self.quit.is_set() or self.session_reset_event.is_set():
                            logger.debug(f"[Session {session_id}] Terminating stream due to quit or reset event")
                            break
                            
                        # Handle tool calls
                        if response.server_content is None and response.tool_call is not None:
                            logger.debug(f"Tool call received: {response.tool_call}")
                            
                            function_calls = response.tool_call.function_calls
                            function_responses = []
                            
                            for function_call in function_calls:
                                name = function_call.name
                                call_id = function_call.id
                                
                                if name == "create_problem":
                                    try:
                                        # Create problem using session context
                                        result = await self.create_problem(
                                            recommendation_data=self.session_metadata.get('recommendation_data'),
                                            objectives_data=self.session_metadata.get('objectives_data')
                                        )

                                        # Extract just problem and answer
                                        simplified_result = {
                                            "content": f"Problem: {result['data']['problem']}\nAnswer: {result['data']['answer']}"
                                        }

                                        function_responses.append({
                                            "name": name,
                                            "response": {"result": simplified_result},
                                            "id": call_id
                                        })
                                        logger.debug(f"Problem created successfully: {result}")
                                    except Exception as e:
                                        logger.error(f"Error creating problem: {e}")
                                        continue
                            
                            if function_responses:
                                logger.debug(f"Sending function responses: {function_responses}")
                                await session.send(input=function_responses, end_of_turn=True)
                            
                        # Handle regular audio responses (Gemini output)
                        if response.data and self.audio_service:
                            try:
                                # Check if the session still exists
                                if session_id in self.audio_service.sessions:
                                    # Send audio to the audio service
                                    self.audio_service.add_to_queue(session_id, response.data)
                                    
                                    # If speech service is available, send audio for transcription
                                    if self.azure_speech_service and self.azure_speech_service.push_stream:
                                        await self.azure_speech_service.write_audio(response.data, speaker="gemini")
                                        logger.debug(f"[Session {session_id}] Gemini audio sent to Azure transcription")
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
            logger.exception(e)
            raise
        finally:
            # Clean up session
            logger.debug(f"[Session {session_id}] Gemini connect method completed, cleaning up")
            await self.reset_session()

    async def receive(self, frame: tuple[int, np.ndarray]) -> None:
        """Process incoming audio frame from the user"""
        if self.quit.is_set() or self.session_reset_event.is_set():
            logger.debug(f"[Session {self._current_session_id}] Skipping audio frame due to quit/reset state")
            return
            
        try:
            _, array = frame
            array = array.squeeze()
            audio_message = array.tobytes()
            
            # Forward the audio to Gemini's input queue
            try:
                self.input_queue.put_nowait(audio_message)
            except asyncio.QueueFull:
                logger.warning(f"[Session {self._current_session_id}] Input queue full, dropping audio frame")
            
            # Also forward the audio to Azure for transcription
            if self.azure_speech_service and self.azure_speech_service.push_stream:
                await self.azure_speech_service.write_audio(audio_message, speaker="user")
                logger.debug(f"[Session {self._current_session_id}] Audio sent to Azure transcription (speaker: user)")
                
        except Exception as e:
            logger.error(f"[Session {self._current_session_id}] Error processing received audio frame: {e}")

    async def reset_session(self) -> bool:
        """Reset the current session state"""
        logger.info(f"Resetting Gemini session state for session {self._current_session_id}")
        self.session_reset_event.set()
        
        # Close the Gemini session if it exists
        if self.current_session:
            try:
                await self.current_session.close()
            except Exception as e:
                logger.error(f"Error closing Gemini session: {e}")
            finally:
                self.current_session = None
        
        # Clear the input queue
        try:
            while not self.input_queue.empty():
                try:
                    self.input_queue.get_nowait()
                    self.input_queue.task_done()
                except asyncio.QueueEmpty:
                    break
        except Exception as e:
            logger.error(f"Error clearing input queue: {e}")
        
        # Reset session state
        self._current_session_id = None
        self.session_metadata = None
        
        # Reset events
        self.session_reset_event.clear()
        
        return True

    def shutdown(self) -> None:
        """Stop the stream method on shutdown"""
        logger.info(f"Shutting down GeminiService for session {self._current_session_id}")
        self.quit.set()
        
        # Schedule the reset_session to run asynchronously
        if asyncio.get_event_loop().is_running():
            asyncio.create_task(self.reset_session())