# backend/app/api/endpoints/gemini_bidirectional.py
from google import genai
from google.genai import types
from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig, Content

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Body, Query, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
import json
import logging
import base64
import io
import traceback

import uuid

import json

from typing import Dict, Any, Optional, List, Union, AsyncGenerator

from ...core.config import settings

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options={"api_version": "v1alpha"},
)

DEFAULT_VOICE = "Leda"
MODEL = "gemini-2.0-flash-live-001"

# Audio constants
FORMAT = "audio/pcm"
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHANNELS = 1

# Router setup
router = APIRouter()

# Connection manager to handle multiple WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections = []
        self._lock = asyncio.Lock()  # Add a lock for thread safety

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            if websocket not in self.active_connections:
                self.active_connections.append(websocket)
                logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        try:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")
            else:
                logger.info("Attempted to disconnect a client that wasn't in the active connections list")
        except Exception as e:
            logger.error(f"Error during connection manager disconnect: {str(e)}")
            
    def is_connected(self, websocket: WebSocket) -> bool:
        return websocket in self.active_connections

manager = ConnectionManager()

# WebSocket endpoint for bidirectional audio and screen sharing
@router.websocket("/bidirectional")
async def websocket_bidirectional_endpoint(websocket: WebSocket,
    subject: str = Query("General Learning", description="The subject being taught"),
    skill: str = Query("Basic Skills", description="The main skill being taught"),
    subskill: str = Query("Introduction", description="The specific subskill being focused on")
):
    await manager.connect(websocket)
    logger.info(f"New WebSocket connection established")
    
    # Create task groups and queues
    audio_in_queue = asyncio.Queue()  # Queue for incoming audio from Gemini
    text_queue = asyncio.Queue()      # Queue for text messages
    media_queue = asyncio.Queue()     # Queue for media (screen/camera)
    client_audio_queue = asyncio.Queue()  # Queue for audio from client
    
    logger.info(f"Queues initialized")
    
    session = None
    tasks = []
    
    # Flag to track if we've already handled a disconnect
    disconnect_handled = False
    
    try:
        # Set up the Gemini config with both audio and text response capabilities
        logger.info(f"Setting up Gemini config for model: {MODEL}")
        config = LiveConnectConfig(
            response_modalities=["AUDIO"],
            context_window_compression=(
        # Configure compression with more appropriate parameters
        types.ContextWindowCompressionConfig(
                    sliding_window=types.SlidingWindow(
                    ),
                    triggerTokens=16000
                )
            ),
            speech_config=SpeechConfig(
                voice_config=VoiceConfig(
                    prebuilt_voice_config=PrebuiltVoiceConfig(
                        voice_name=DEFAULT_VOICE,
                    )
                )
            ),
            media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW,
            system_instruction=Content(parts=[{
            "text": f"""You are conducting a live kindergarten tutoring session using voice interaction.
            
            Role and Communication Style:
            - You are a friendly, encouraging kindergarten tutor speaking with a 5-6 year old
            - Keep your speech simple, clear, and age-appropriate
            - Use a warm, engaging speaking voice
            - Keep responses concise (3-5 sentences) to maintain attention
            - Always be positive and encouraging
            - Focus on one concept at a time
            
            Current Lesson Focus:
            - Subject: {subject}
            - Skill: {skill}
            - Subskill: {subskill}
            
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
        }])
        )
        
        # Connect to the Gemini API
        logger.info(f"Connecting to Gemini API with model: {MODEL}")
        try:
            async with client.aio.live.connect(model=MODEL, config=config) as session:
                logger.info(f"Successfully connected to Gemini API")
                
                # Define all task functions
                async def receive_from_client():
                    # Create a disconnect flag to signal when we should stop receiving
                    disconnect_received = False
                    
                    while not disconnect_received:
                        try:
                            # Use a timeout to avoid blocking forever if client disconnects
                            logger.info("Waiting to receive message from client...")
                            message = await asyncio.wait_for(websocket.receive(), timeout=5.0)
                            
                            # Add debug logging to see exactly what message is received
                            message_type = message.get("type", "unknown")
                            logger.info(f"Received message type: {message_type}")
                            
                            # Handle websocket disconnect message
                            if message_type == "websocket.disconnect":
                                logger.info("WebSocket disconnect message received")
                                disconnect_received = True
                                break
                            
                            # The key change: Handle both text messages and binary messages appropriately
                            data = None
                            if "text" in message:
                                # Try to parse JSON data from text message
                                try:
                                    data = json.loads(message["text"])
                                    logger.info(f"Parsed message data type: {data.get('type', 'unknown')}")
                                except json.JSONDecodeError as e:
                                    logger.error(f"Error decoding JSON: {str(e)}, raw text: {message.get('text', '')[:100]}")
                                    continue
                            elif "bytes" in message:
                                # Handle binary data directly
                                logger.info(f"Received raw binary data: {len(message['bytes'])} bytes")
                                audio_data = message["bytes"]
                                mime_type = f"{FORMAT};rate={SEND_SAMPLE_RATE}"
                                await client_audio_queue.put({
                                    "data": audio_data, 
                                    "mime_type": mime_type
                                })
                                logger.info(f"Queued {len(audio_data)} bytes of raw binary audio data")
                                continue
                            else:
                                logger.warning(f"Unknown message format received: {message.keys()}")
                                continue
                            
                            # Process the JSON data based on its type
                            if data:
                                if data["type"] == "text":
                                    text = data.get("content", "")
                                    if text:
                                        logger.info(f"Received text: {text[:50]}...")
                                        await text_queue.put(text)
                                elif data["type"] == "end_conversation":
                                    logger.info("Client requested end of conversation")
                                    disconnect_received = True
                                    break
                                elif data["type"] == "screen":
                                    # Handle screen sharing data
                                    screen_data = data.get("data")
                                    if screen_data:
                                        # Create media message for Gemini
                                        media_msg = {
                                            "mime_type": "image/jpeg",
                                            "data": base64.b64decode(screen_data)
                                        }
                                        await media_queue.put(media_msg)
                                        logger.info("Processed screen data")
                                elif data["type"] == "audio":
                                    # Process audio data with specific mime type and base64 encoding
                                    audio_data = data.get("data")
                                    mime_type = data.get("mime_type", FORMAT)
                                    
                                    if audio_data:
                                        logger.info(f"Received audio data (base64), length: {len(audio_data)}")
                                        # Decode the base64 data
                                        try:
                                            audio_bytes = base64.b64decode(audio_data)
                                            logger.info(f"Decoded {len(audio_bytes)} bytes of audio data")
                                            
                                            await client_audio_queue.put({
                                                "data": audio_bytes, 
                                                "mime_type": mime_type
                                            })
                                            logger.info(f"Queued {len(audio_bytes)} bytes of audio data with mime type {mime_type}")
                                        except Exception as e:
                                            logger.error(f"Error decoding base64 audio: {str(e)}")
                                            logger.error(f"Base64 data preview: {audio_data[:30]}...")
                        
                        except asyncio.TimeoutError:
                            # Just continue the loop, waiting for the next message
                            logger.info("No message received within timeout, but keeping connection open for live session")
                            continue
                                
                        except WebSocketDisconnect as wsd:
                            logger.info(f"WebSocketDisconnect exception caught: {str(wsd)}")
                            disconnect_received = True
                            break
                            
                        except Exception as e:
                            logger.error(f"Error receiving client message: {str(e)}")
                            # Don't break on other errors - try to continue receiving
                                
                # Create task to send text to Gemini
                async def send_text_to_gemini():
                    while True:
                        try:
                            text = await text_queue.get()
                            try:
                                logger.info(f"Sending text to Gemini: {text[:50]}...")
                                await session.send(input=text, end_of_turn=True)
                            except Exception as e:
                                logger.error(f"Error sending text to Gemini: {str(e)}")
                        except asyncio.CancelledError:
                            logger.info("Text sending task cancelled")
                            break
                        except Exception as e:
                            logger.error(f"Error in send_text_to_gemini: {str(e)}")
                
                # Create task to send audio to Gemini
                async def send_audio_to_gemini():
                    consecutive_errors = 0
                    max_consecutive_errors = 5
                    
                    while True:
                        try:
                            # Get the audio message from the queue
                            audio_msg = await client_audio_queue.get()
                            
                            # Detailed logging about the audio message
                            data_length = len(audio_msg.get('data', b'')) if 'data' in audio_msg else 0
                            mime_type = audio_msg.get('mime_type', 'unknown')
                            
                            if data_length > 0:  # Only log when we have actual audio data
                                logger.info(f"Preparing to send audio to Gemini: {data_length} bytes, mime type: {mime_type}")
                                
                                # If we have data, log a bit more about it
                                data = audio_msg.get('data')
                                # Check if it's raw PCM data by examining the first few bytes
                                if hasattr(data, '__len__') and len(data) >= 4:
                                    first_bytes = str([b for b in data[:16]])
                                    logger.info(f"First bytes of audio data to send: {first_bytes}")
                            
                                # Try to specify format in a way Gemini understands
                                formatted_audio_msg = {
                                    "data": audio_msg.get('data', b''),
                                    "mime_type": mime_type
                                }
                                
                                # Some additional debugging about what we're sending to Gemini
                                logger.info(f"Sending audio to Gemini: {len(formatted_audio_msg.get('data', b''))} bytes with mime type: {formatted_audio_msg.get('mime_type')}")
                                
                                # Send the audio data to Gemini
                                await session.send(input=formatted_audio_msg)
                                logger.info(f"Successfully sent audio data to Gemini")
                                
                                # Reset error counter on success
                                consecutive_errors = 0
                            
                        except asyncio.CancelledError:
                            logger.info("Audio sending task cancelled")
                            break
                        except Exception as e:
                            consecutive_errors += 1
                            logger.error(f"Error sending audio to Gemini: {str(e)}")
                            
                            # Try to log more details about the exception
                            logger.error(f"Exception traceback: {traceback.format_exc()}")
                            
                            if consecutive_errors >= max_consecutive_errors:
                                logger.error(f"Too many consecutive errors ({consecutive_errors}), stopping audio stream")
                                break
                            
                            # Continue the loop to process more audio data
                            # Add a small delay to avoid tight loops on persistent errors
                            await asyncio.sleep(0.1)
                
                # Create task to send media (screen/camera) to Gemini
                async def send_media_to_gemini():
                    while True:
                        try:
                            media = await media_queue.get()
                            try:
                                logger.info(f"Sending media to Gemini: mime type {media.get('mime_type', 'unknown')}")
                                await session.send(input=media)
                            except Exception as e:
                                logger.error(f"Error sending media to Gemini: {str(e)}")
                        except asyncio.CancelledError:
                            logger.info("Media sending task cancelled")
                            break
                        except Exception as e:
                            logger.error(f"Error in send_media_to_gemini: {str(e)}")
                
                async def receive_from_gemini():
                    while True:
                        try:
                            turn = session.receive()
                            async for response in turn:
                                if hasattr(response, "data") and response.data:
                                    # Handle audio data from Gemini
                                    audio_b64 = base64.b64encode(response.data).decode('utf-8')
                                    
                                    await websocket.send_json({
                                        "type": "audio",
                                        "format": "raw-pcm",
                                        "sampleRate": RECEIVE_SAMPLE_RATE,
                                        "bitsPerSample": 16,
                                        "channels": CHANNELS,
                                        "data": audio_b64,
                                    })
                                    
                                    logger.info(f"Sent {len(response.data)} bytes of audio as base64")
                                
                                if hasattr(response, "text") and response.text:
                                    # Handle text response from Gemini
                                    await websocket.send_json({
                                        "type": "text",
                                        "content": response.text
                                    })
                                    
                                    logger.info(f"Sent text response: {response.text[:50]}...")
                        except asyncio.CancelledError:
                            logger.info("Gemini receiving task cancelled")
                            break
                        except Exception as e:
                            error_str = str(e)
                            logger.error(f"Error receiving from Gemini: {error_str}")
                            
                            # Check if it's a deadline exceeded error
                            if "Deadline expired" in error_str or "1011" in error_str:
                                logger.info("Deadline exceeded error detected, closing session gracefully")
                                
                                # Notify client about the error
                                try:
                                    await websocket.send_json({
                                        "type": "error",
                                        "content": "The AI service connection timed out. Please refresh to start a new session."
                                    })
                                except Exception as ws_err:
                                    logger.error(f"Error sending error notification: {str(ws_err)}")
                                
                                # Return from this function to end the task
                                return  # This will trigger task completion and cleanup
                            
                            # For other types of errors, just wait a bit and continue
                            await asyncio.sleep(0.5)
                
                # Start all tasks with names
                logger.info("Starting background tasks for WebSocket communication")
                tasks = [
                    asyncio.create_task(receive_from_client(), name="receive_from_client"),
                    asyncio.create_task(send_text_to_gemini(), name="send_text_to_gemini"),
                    asyncio.create_task(send_audio_to_gemini(), name="send_audio_to_gemini"),
                    asyncio.create_task(send_media_to_gemini(), name="send_media_to_gemini"),
                    asyncio.create_task(receive_from_gemini(), name="receive_from_gemini"),
                ]
                logger.info(f"Started {len(tasks)} background tasks")
                
                # Wait for the first task to complete (usually when client disconnects)
                logger.info("Waiting for any task to complete...")
                done, pending = await asyncio.wait(
                    tasks, 
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                for completed_task in done:
                    task_name = completed_task.get_name()
                    if completed_task.exception():
                        logger.error(f"Task {task_name} completed with exception: {completed_task.exception()}")
                    else:
                        logger.info(f"Task {task_name} completed successfully")
                
                # Set the disconnect flag to avoid duplicate handling
                disconnect_handled = True
                
                # Cancel remaining tasks gracefully
                logger.info(f"Cancelling {len(pending)} remaining tasks")
                for task in pending:
                    task_name = task.get_name()
                    logger.info(f"Cancelling task: {task_name}")
                    task.cancel()
                
                # Wait for tasks to be cancelled with a timeout
                try:
                    logger.info("Waiting for tasks to complete cancellation...")
                    await asyncio.wait_for(
                        asyncio.gather(*pending, return_exceptions=True),
                        timeout=2.0
                    )
                    logger.info("All tasks cancelled successfully")
                except asyncio.TimeoutError:
                    logger.warning("Some tasks took too long to cancel and timed out")
                except Exception as e:
                    logger.error(f"Error during task cancellation: {str(e)}")
        
        except Exception as gemini_connect_error:
            logger.error(f"Error connecting to Gemini API: {str(gemini_connect_error)}")
            logger.error(f"Connection error traceback: {traceback.format_exc()}")
            await websocket.close(code=1011, reason=f"Gemini API connection error: {str(gemini_connect_error)}")
            disconnect_handled = True
            
    except WebSocketDisconnect:
        if not disconnect_handled:
            logger.info("WebSocket disconnected via exception")
            disconnect_handled = True
            # Cancel any running tasks
            for task in tasks:
                task_name = task.get_name() if hasattr(task, 'get_name') else str(task)
                logger.info(f"Cancelling task after disconnect: {task_name}")
                if not task.done():
                    task.cancel()
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        logger.error(f"WebSocket error traceback: {traceback.format_exc()}")
        if not disconnect_handled:
            disconnect_handled = True
            # Cancel any running tasks
            for task in tasks:
                task_name = task.get_name() if hasattr(task, 'get_name') else str(task)
                logger.info(f"Cancelling task after error: {task_name}")
                if not task.done():
                    task.cancel()
    finally:
        # Only try to disconnect if we haven't already been disconnected
        try:
            # Disconnect from connection manager
            manager.disconnect(websocket)
            logger.info("Disconnected from connection manager")
        except ValueError:
            # This happens if the connection was already removed from the manager
            logger.info("Connection was already removed from manager")
        except Exception as e:
            logger.error(f"Error during disconnection: {str(e)}")
            
        # Final status report on any remaining tasks
        for task in tasks:
            task_name = task.get_name() if hasattr(task, 'get_name') else str(task)
            status = "Done" if task.done() else "Not Done"
            logger.info(f"Final task status - {task_name}: {status}")
            
        logger.info("Cleaned up resources")



@router.post("/generate_storybook")
async def generate_storybook(
    theme: Optional[str] = Body(None, description="Theme of the story (optional)"),
    age_group: str = Body(..., description="Target age group (e.g., 4-6, 7-9)"),
    main_character: Optional[str] = Body(None, description="Main character name (optional)"),
    session_id: Optional[str] = Body(None, description="Session ID for tracking")
):
    """
    Generate an interactive digital storybook with text and images
    """
    try:
        # Generate session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())

        client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options={"api_version": "v1alpha"},
        )

        model = "gemini-2.0-flash-exp"
            
        # Simplified prompt focused on story content and illustrations only
        prompt_text = f"""Create a short interactive digital storybook for children aged {age_group}. 
The story should include both text and illustrations.
"""
        
        # Add optional parameters if provided
        if theme:
            prompt_text += f"\nTheme: {theme}"
        else:
            prompt_text += "\nChoose an engaging and age-appropriate theme for the story."
            
        if main_character:
            prompt_text += f"\nMain character: {main_character}"
        else:
            prompt_text += "\nCreate interesting main characters that children will connect with."
            
        prompt_text += f"""

For this storybook:
1. Create a cohesive story with a beginning, middle, and end
2. Use vocabulary appropriate for {age_group} year-olds
3. Include simple interactive elements appropriate for the age group
4. Create colorful, child-friendly illustrations that match the story

IMPORTANT: Your response should ONLY include:
1. Story text divided into logical sections/pages
2. Illustrations that accompany each section of text

DO NOT include any explanations, notes, or other content besides the story text and illustrations.
"""

        gemini_prompt = {
            "parts": [{"text": prompt_text}]
        }
        
        # Set up generation config to request both text and image output
        generation_config = types.GenerateContentConfig(
            response_modalities=["Text", "Image"],
            temperature=0.7,
            top_p=0.95,
            top_k=40,
            max_output_tokens=2048
        )
        
        # Call Gemini API once to generate both text and images
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=gemini_prompt,
            config=generation_config
        )
        
        # Check for valid response
        if not response or not response.candidates or not response.candidates[0].content.parts:
            error_msg = f"[Session {session_id}] Empty or invalid response from Gemini"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        
        # Process the response to extract text and images
        story_parts = []
        current_text = ""
        
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'text') and part.text is not None:
                # Store the current text
                current_text += part.text
            elif hasattr(part, 'inline_data') and part.inline_data is not None:
                # Found an image, create a new story part with the accumulated text and this image
                image_data = base64.b64encode(part.inline_data.data).decode('utf-8')
                
                story_parts.append({
                    "text": current_text.strip(),
                    "image": image_data,
                    "image_mime_type": part.inline_data.mime_type
                })
                
                # Reset text for the next part
                current_text = ""
        
        # Add any remaining text as a final part without an image
        if current_text.strip():
            story_parts.append({
                "text": current_text.strip()
            })
        
        # Add page numbers for ordering
        for i, part in enumerate(story_parts):
            part["page_number"] = i + 1
        
        # Prepare the final response
        result = {
            "status": "success",
            "session_id": session_id,
            "model": model,
            "storybook": {
                "pages": story_parts
            }
        }
        
        return result
    
    except Exception as e:
        error_msg = f"Error generating storybook: {str(e)}"
        logger.error(f"[Session {session_id}] {error_msg}")
        logger.error(f"[Session {session_id}] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/generate_explanation")
async def generate_explanation(
    subject: str = Body(..., description="Academic subject (e.g., Math, Science, History)"),
    skill: str = Body(..., description="Specific skill within the subject (e.g., Fractions, Photosynthesis)"),
    subskill: Optional[str] = Body(None, description="Specific subskill (optional)"),
    age_group: str = Body(..., description="Target age group (e.g., 8-10, 11-13)"),
    session_id: Optional[str] = Body(None, description="Session ID for tracking")
):
    """
    Generate an educational explanation with text and supporting visuals
    """
    try:
        # Generate session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())

        client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options={"api_version": "v1alpha"},
        )

        model = "gemini-2.0-flash-exp"
            
        # Construct prompt for educational explanation
        prompt_text = f"""Create an educational explanation for students aged {age_group} on the following topic:

Current Lesson Focus:
- Subject: {subject}
- Skill: {skill}"""
        
        # Add subskill if provided
        if subskill:
            prompt_text += f"\n- Subskill: {subskill}"
            
        prompt_text += f"""

For this explanation:
1. Create a clear, engaging explanation appropriate for {age_group} year-olds
2. Break down complex concepts into digestible sections
3. Use vocabulary and examples appropriate for the age group
4. Include helpful visuals that support understanding of key concepts
5. Include 2-3 practice questions or interactive elements at the end

IMPORTANT: Your response should include:
1. An introduction to the concept
2. Step-by-step explanation with key points highlighted
3. Visual representations of the concept (diagrams, illustrations, etc.)
4. Real-world examples that students can relate to
5. Practice questions or activities

DO NOT include any meta-commentary or notes outside the actual educational content.
"""

        gemini_prompt = {
            "parts": [{"text": prompt_text}]
        }
        
        # Set up generation config to request both text and image output
        generation_config = types.GenerateContentConfig(
            response_modalities=["Text", "Image"],
            temperature=0.7,
            max_output_tokens=2048
        )
        
        # Call Gemini API to generate both text and images
        response = client.models.generate_content(
            model=model,
            contents=gemini_prompt,
            config=generation_config
        )
        
        # Check for valid response
        if not response or not response.candidates or not response.candidates[0].content.parts:
            error_msg = f"[Session {session_id}] Empty or invalid response from Gemini"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        
        # Process the response to extract text and images
        explanation_parts = []
        current_text = ""
        
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'text') and part.text is not None:
                # Store the current text
                current_text += part.text
            elif hasattr(part, 'inline_data') and part.inline_data is not None:
                # Found an image, create a new explanation part with the accumulated text and this image
                image_data = base64.b64encode(part.inline_data.data).decode('utf-8')
                
                explanation_parts.append({
                    "text": current_text.strip(),
                    "image": image_data,
                    "image_mime_type": part.inline_data.mime_type
                })
                
                # Reset text for the next part
                current_text = ""
        
        # Add any remaining text as a final part without an image
        if current_text.strip():
            explanation_parts.append({
                "text": current_text.strip()
            })
        
        # Add section numbers for ordering
        for i, part in enumerate(explanation_parts):
            part["section_number"] = i + 1
        
        # Prepare the final response
        result = {
            "status": "success",
            "session_id": session_id,
            "model": model,
            "explanation": {
                "subject": subject,
                "skill": skill,
                "subskill": subskill,
                "age_group": age_group,
                "sections": explanation_parts
            }
        }
        
        return result
    
    except Exception as e:
        error_msg = f"Error generating explanation: {str(e)}"
        logger.error(f"[Session {session_id}] {error_msg}")
        logger.error(f"[Session {session_id}] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)