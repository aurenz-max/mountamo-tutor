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

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)


TOOL_CREATE_PROBLEM = {
    "function_declarations": [
        {
            "name": "create_problem",
            "description": "Generate a practice problem for the current skill being taught.",
        }
    ],
    
}

class GeminiService:
    def __init__(self, audio_service: AudioService) -> None:
        self.input_queue: asyncio.Queue = asyncio.Queue()
        self.quit: asyncio.Event = asyncio.Event()
        self.session_reset_event: asyncio.Event = asyncio.Event()
        self.audio_service = audio_service
        self.problem_integration = GeminiProblemIntegration()
        self._current_session_id: Optional[str] = None
        self._stream_task: Optional[asyncio.Task] = None
        self.current_session = None
        self.session_metadata: Optional[Dict[str, Any]] = None
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

    async def connect(
        self,
        session_id: str,
        unified_prompt: str,
        session_metadata: Dict[str, Any],
        voice_name: str = "Puck",
    ) -> None:
        """Connect to Gemini and start streaming"""
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
                                print(f"function_responses: {function_responses}")
                                await session.send(input=function_responses, end_of_turn=True)
                            #     continue
                            
                        # Handle regular audio responses
                        if response.data and self.audio_service:
                            try:
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
            logger.exception(e)
            raise
        finally:
            self._current_session_id = None
            self.current_session = None
            self.session_metadata = None

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