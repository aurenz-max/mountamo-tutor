import asyncio
import logging
from typing import AsyncGenerator, Callable, Optional, Dict, Any, List, Awaitable
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
from .gemini_image import GeminiImageIntegration

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
# Replace the TOOL_PROBLEM_VISUAL constant in gemini.py with this improved version:

TOOL_PROBLEM_VISUAL = {
    "function_declarations": [
        # Problem creation function
        {
            "name": "create_problem",
            "description": "Generate a practice problem for the current skill being taught."
        },
        # Visual functions with improved descriptions
        {
            "name": "get_categories",
            "description": "Get all available image categories. Always call this first before trying to create scenes to ensure you're using valid categories."
        },
        {
            "name": "get_objects",
            "description": "Get objects available within a specific category. Always call this after get_categories to ensure you're using valid objects for your scene.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category name to get objects from. Use exact category names from get_categories."
                    }
                },
                "required": ["category"]
            }
        },
        {
            "name": "find_images",
            "description": "Find images matching a category and/or object type. This is primarily for information - use create_scene to actually create visual content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category to filter by (optional). Use exact category names from get_categories."
                    },
                    "object_type": {
                        "type": "string",
                        "description": "Object type to filter by (optional). Use object names from get_objects."
                    }
                },
                "required": []
            }
        },
        {
            "name": "create_scene",
            "description": "Create a visual scene with specific objects. Always call get_categories and get_objects first to ensure you're using valid inputs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category of objects to use. Use exact category names from get_categories."
                    },
                    "object_type": {
                        "type": "string",
                        "description": "Type of object to add to the scene (e.g. 'circle', 'triangle'). Use object names from get_objects."
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of objects to include (between 1-10)"
                    },
                    "layout": {
                        "type": "string",
                        "enum": ["grid", "random", "circle"],
                        "description": "How to arrange objects in the scene",
                    },
                    "title": {
                        "type": "string",
                        "description": "Optional title for the scene"
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional description of the scene purpose"
                    }
                },
                "required": ["category", "object_type", "count"]
            }
        }
    ],
}

class GeminiService:
    def __init__(
        self, 
        audio_service: AudioService, 
        azure_speech_service: Optional[AzureSpeechService] = None,
        visual_integration: Optional[GeminiImageIntegration] = None
    ) -> None:
        """
        Initialize GeminiService with the necessary services.
        
        Args:
            audio_service: Service for handling audio output
            azure_speech_service: Optional service for speech recognition
            visual_integration: Optional GeminiImageIntegration for handling visual content
        """
        # Session-specific resources
        self.input_queue: asyncio.Queue = asyncio.Queue()
        self.quit: asyncio.Event = asyncio.Event()
        self.session_reset_event: asyncio.Event = asyncio.Event()
        
        # Shared services
        self.audio_service = audio_service
        self.azure_speech_service = azure_speech_service
        
        # Problem integration is session-specific
        self.problem_integration = GeminiProblemIntegration()
        
        # Visual integration is provided directly, not created here
        self.visual_integration = visual_integration
        
        # Scene callback for notifying about new scenes
        self._scene_callback: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None

        self._problem_callback: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None
        
        # Session state
        self._current_session_id: Optional[str] = None
        self._stream_task: Optional[asyncio.Task] = None
        self.current_session = None
        self.session_metadata: Optional[Dict[str, Any]] = None
        
        logger.debug("GeminiService initialized with provided AudioService")
        logger.info(f"GeminiService using provided AzureSpeechService: {self.azure_speech_service is not None}")
        logger.info(f"GeminiService using provided GeminiImageIntegration: {self.visual_integration is not None}")



    def register_scene_callback(
        
        self, 
        callback: Callable[[Dict[str, Any]], Awaitable[None]]
    ) -> None:
        """
        Register a callback for handling visual scenes.
        
        Args:
            callback: Async function that takes scene_data
        """
        self._scene_callback = callback
        
        # If we have a visual integration, ensure it can notify us about scenes
        if self.visual_integration:
            # Set up the visual integration to call our callback when scenes are created
            self.visual_integration.set_callback(self._scene_callback)
            logger.debug(f"Registered scene callback with GeminiImageIntegration")

    def register_problem_callback(
        self, 
        callback: Callable[[Dict[str, Any]], Awaitable[None]]
    ) -> None:
        """
        Register a callback for handling problem data.
        
        Args:
            callback: Async function that takes problem_data
        """
        self._problem_callback = callback
        logger.info(f"Problem callback registered in GeminiService: {self._problem_callback is not None}")

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
        logger.info(f"[Session {self._current_session_id}] create_problem called with data available: recommendation={recommendation_data is not None}, objectives={objectives_data is not None}")
        logger.info(f"[Session {self._current_session_id}] Problem callback registered: {hasattr(self, '_problem_callback') and self._problem_callback is not None}")
      
        if not self.session_metadata or not self._current_session_id:
            logger.error("[Session UNKNOWN] No session context available for problem creation")
            return {"status": "error", "message": "No session context"}
        
        try:
            # Call handle_problem_creation with full session metadata and pre-loaded data
            logger.debug(f"[Session {self._current_session_id}] Calling problem_integration.handle_problem_creation")
            result = await self.problem_integration.handle_problem_creation(
                session_metadata=self.session_metadata,
                session_id=self._current_session_id,
                session_recommendation=recommendation_data,
                session_objectives=objectives_data
            )
            
            logger.debug(f"[Session {self._current_session_id}] Problem creation result: {result['status'] if isinstance(result, dict) and 'status' in result else 'None'}")

            if result and isinstance(result, dict) and 'data' in result:
                logger.debug(f"[Session {self._current_session_id}] Problem data received, callback registered: {hasattr(self, '_problem_callback') and self._problem_callback is not None}")
                
                if hasattr(self, '_problem_callback') and self._problem_callback is not None:
                    try:
                        logger.debug(f"[Session {self._current_session_id}] Executing problem callback with data keys: {list(result['data'].keys())}")
                        await self._problem_callback(result['data'])
                        logger.info(f"[Session {self._current_session_id}] Problem callback executed successfully")
                    except Exception as cb_error:
                        logger.error(f"[Session {self._current_session_id}] Error in problem callback: {cb_error}", exc_info=True)
                        # Continue with execution even if callback fails
                else:
                    logger.warning(f"[Session {self._current_session_id}] No problem callback registered")

                logger.info(f"[Session {self._current_session_id}] Problem creation completed successfully")
                return {"status": "success", "data": result}
            else:
                logger.error(f"[Session {self._current_session_id}] Problem creation returned invalid result structure: {result}")
                return {"status": "error", "message": "Failed to create problem - invalid result structure"}
        except Exception as e:
            logger.error(f"[Session {self._current_session_id}] Error in create_problem: {str(e)}", exc_info=True)
            return {"status": "error", "message": f"Error during problem creation: {str(e)}"}

    async def get_categories(self) -> Dict[str, Any]:
        """
        Get available image categories for Gemini.
        This function is called by Gemini via tool invocation.
        
        Returns:
            Dict with status and category information
        """
        if not self.visual_integration:
            logger.warning("Visual integration not available for get_categories")
            return {
                "status": "error",
                "message": "Visual integration not available"
            }
        
        try:
            # Get categories from the visual integration
            categories = await self.visual_integration.get_categories()
            
            # Return with additional helpful information
            return {
                "status": "success",
                "message": f"Found {len(categories)} available categories",
                "categories": categories,
                "instructions": "Use these exact category names when creating scenes"
            }
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            return {
                "status": "error",
                "message": f"Error getting categories: {str(e)}"
            }

    async def get_objects(self, category: str) -> Dict[str, Any]:
        """
        Get objects available in a specific category.
        This function is called by Gemini via tool invocation.
        
        Args:
            category: Category to get objects from
        
        Returns:
            Dict with status and object information
        """
        if not self.visual_integration:
            logger.warning("Visual integration not available for get_objects")
            return {
                "status": "error",
                "message": "Visual integration not available"
            }
        
        try:
            # First check if this category exists
            available_categories = await self.visual_integration.get_categories()
            
            # Normalize category for case-insensitive comparison
            category_lower = category.lower().strip()
            exact_match = False
            
            # Try to find an exact match first
            for avail_category in available_categories:
                if avail_category.lower() == category_lower:
                    category = avail_category  # Use the correctly cased version
                    exact_match = True
                    break
            
            # If no exact match, try fuzzy matching
            if not exact_match:
                similar_categories = [cat for cat in available_categories 
                                    if category_lower in cat.lower() or cat.lower() in category_lower]
                
                if similar_categories:
                    suggested_category = similar_categories[0]
                    logger.info(f"Category '{category}' not found, suggesting '{suggested_category}'")
                    return {
                        "status": "success",
                        "message": f"Category '{category}' not found, but found similar category '{suggested_category}'",
                        "suggested_category": suggested_category,
                        "available_categories": available_categories
                    }
                else:
                    # No similar categories found
                    return {
                        "status": "error",
                        "message": f"Category '{category}' not found. Available categories: {', '.join(available_categories)}",
                        "available_categories": available_categories
                    }
            
            # Get objects for the category
            objects = await self.visual_integration.get_objects(category)
            
            # Return with additional helpful information
            return {
                "status": "success",
                "message": f"Found {len(objects)} objects in category '{category}'",
                "category": category,
                "objects": objects,
                "instructions": "Use these object types when creating scenes with this category"
            }
        except Exception as e:
            logger.error(f"Error getting objects: {e}")
            return {
                "status": "error",
                "message": f"Error getting objects: {str(e)}"
            }

    async def create_scene(
        self,
        category: str,
        object_type: str,
        count: int,
        layout: str = "grid",
        title: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a scene with specific object type and count.
        This function is called by Gemini via tool invocation.
        
        Args:
            category: Category of objects to use
            object_type: Type of object to add to the scene
            count: Number of objects to include
            layout: Layout style
            title: Optional title
            description: Optional description
            
        Returns:
            Dict with scene creation result
        """
        if not self.visual_integration:
            logger.warning("Visual integration not available for create_scene")
            return {
                "status": "error",
                "message": "Visual integration not available"
            }
        
        try:
            # First check if the category and object type are valid
            available_categories = await self.visual_integration.get_categories()
            
            # Normalize for case-insensitive comparison
            category_lower = category.lower().strip()
            matched_category = None
            
            # Try to find an exact category match
            for avail_category in available_categories:
                if avail_category.lower() == category_lower:
                    matched_category = avail_category
                    break
            
            # If no exact match, suggest similar categories
            if not matched_category:
                similar_categories = [cat for cat in available_categories 
                                    if category_lower in cat.lower() or cat.lower() in category_lower]
                
                if similar_categories:
                    suggested_category = similar_categories[0]
                    logger.info(f"Suggesting alternative category: {suggested_category}")
                    matched_category = suggested_category
                else:
                    # Default to a common category if available
                    default_categories = ["shapes", "objects", "basic"]
                    for default_cat in default_categories:
                        if default_cat in available_categories:
                            matched_category = default_cat
                            logger.info(f"Using default category: {matched_category}")
                            break
                    
                    if not matched_category:
                        # No match and no default found, just use the first available
                        if available_categories:
                            matched_category = available_categories[0]
                            logger.info(f"Using first available category: {matched_category}")
            
            # Now use the matched category and create the scene
            if matched_category:
                # Get available objects for validation
                available_objects = await self.visual_integration.get_objects(matched_category)
                
                # Create the scene with validation
                scene_result = await self.visual_integration.create_scene(
                    category=matched_category,
                    object_type=object_type,
                    count=count,
                    layout=layout,
                    title=title,
                    description=description
                )
                
                # Enhance the response with helpful information
                if scene_result.get("status") == "success":
                    scene_result["message"] = (f"Created a scene with {count} {object_type} using {layout} layout "
                                            f"from category '{matched_category}'.")
                    scene_result["note"] = "Scene created successfully."
                else:
                    scene_result["available_categories"] = available_categories
                    if matched_category:
                        scene_result["available_objects"] = available_objects
                
                return scene_result
            else:
                # No suitable category found
                return {
                    "status": "error",
                    "message": f"Could not find a suitable category. Available categories: {', '.join(available_categories)}",
                    "available_categories": available_categories
                }
        except Exception as e:
            logger.error(f"Error creating scene: {e}")
            return {
                "status": "error",
                "message": f"Error creating scene: {str(e)}"
            }

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

        # If we have a visual integration, make sure it's properly configured for this session
        if self.visual_integration and hasattr(self.visual_integration, 'set_session_id'):
            await self.visual_integration.set_session_id(session_id)
            logger.debug(f"[Session {session_id}] Updated session ID in visual integration")

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
                tools=[TOOL_PROBLEM_VISUAL]
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
                                        logger.info(f"[Session {session_id}] Tool call received for create_problem")
                                        # Create problem using session context
                                        result = await self.create_problem(
                                            recommendation_data=self.session_metadata.get('recommendation_data'),
                                            objectives_data=self.session_metadata.get('objectives_data')
                                        )
                                        
                                        logger.debug(f"[Session {session_id}] create_problem result: {result}")

                                        # Properly handle the result structure
                                        if result and isinstance(result, dict) and 'status' in result and result['status'] == 'success':
                                            # Extract problem from the correct location in the structure
                                            if 'data' in result and 'data' in result['data']:
                                                problem_data = result['data']['data']
                                                
                                                # Extract problem and answer safely
                                                problem_text = problem_data.get('problem', 'No problem text available')
                                                answer_text = problem_data.get('answer', 'No answer available')
                                                
                                                simplified_result = {
                                                    "content": f"Problem: {problem_text}\nAnswer: {answer_text}"
                                                }
                                            else:
                                                # Fallback if structure is different
                                                logger.warning(f"[Session {session_id}] Unexpected result structure, trying alternate access paths")
                                                problem_text = result.get('data', {}).get('problem', 'No problem text available')
                                                answer_text = result.get('data', {}).get('answer', 'No problem text available')
                                                
                                                simplified_result = {
                                                    "content": f"Problem: {problem_text}\nAnswer: {answer_text}"
                                                }

                                            function_responses.append({
                                                "name": name,
                                                "response": {"result": simplified_result},
                                                "id": call_id
                                            })
                                            logger.info(f"[Session {session_id}] Problem tool call completed successfully")
                                        else:
                                            logger.error(f"[Session {session_id}] Problem creation failed: {result}")
                                            # Provide error feedback to Gemini
                                            function_responses.append({
                                                "name": name, 
                                                "response": {"error": "Failed to create problem"},
                                                "id": call_id
                                            })
                                    except Exception as e:
                                        logger.error(f"[Session {session_id}] Error handling create_problem tool call: {e}", exc_info=True)
                                        function_responses.append({
                                            "name": name,
                                            "response": {"error": f"Exception: {str(e)}"},
                                            "id": call_id
                                        })
                                
                                # Handle visual tool calls if we have a visual integration
                                elif self.visual_integration and name in ["get_categories", "get_objects", "find_images", "create_scene"]:                                    
                                    try:                                        
                                        # Get arguments from function call
                                        args = {}
                                        if hasattr(function_call, 'args') and function_call.args:
                                            args = function_call.args

                                        logger.info(f"[Session {session_id}] Visual tool '{name}' called with args: {args}")

                                        # Validate the function exists on self
                                        if not hasattr(self, name):
                                            raise AttributeError(f"Function {name} does not exist on GeminiService")   
                                         
                                        # Call the method on visual integration
                                        method = getattr(self, name)
                                        result = await method(**args)
                                        
                                        # Add to function responses
                                        function_responses.append({
                                            "name": name,
                                            "response": {"result": result},
                                            "id": call_id
                                        })
                                        logger.debug(f"Visual tool {name} executed successfully")
                                    except Exception as e:
                                        logger.error(f"Error executing visual tool {name}: {e}")
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