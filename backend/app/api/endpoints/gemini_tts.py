# backend/app/api/endpoints/gemini_bidirectional.py
from google import genai
from google.genai.types import (
    Content,
    LiveConnectConfig,
    PrebuiltVoiceConfig,
    SpeechConfig,
    VoiceConfig,
)

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import logging
import base64
import traceback

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

# Simple connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

manager = ConnectionManager()

# WebSocket endpoint for bidirectional audio and screen sharing
@router.websocket("/bidirectional")
async def websocket_bidirectional_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    logger.info("New WebSocket connection established")
    
    session = None
    tasks = []
    client_disconnected = False
    
    try:
        # Set up Gemini config with both audio and text response capabilities
        logger.info(f"Setting up Gemini config for model: {MODEL}")
        config = LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=SpeechConfig(
                voice_config=VoiceConfig(
                    prebuilt_voice_config=PrebuiltVoiceConfig(
                        voice_name=DEFAULT_VOICE,
                    )
                )
            ),
            system_instruction=Content(parts=[{"text": "You are a helpful assistant that responds to user queries with both voice and text."}])
        )
        
        # Connect to the Gemini API
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            logger.info("Successfully connected to Gemini API")
            
            # Define handler for receiving messages from client
            async def handle_client_messages():
                disconnected = False
                while not disconnected:
                    try:
                        # Receive message from client
                        message = await websocket.receive()
                        message_type = message.get("type", "unknown")
                        
                        # Handle websocket disconnect
                        if message_type == "websocket.disconnect":
                            logger.info("WebSocket disconnect message received")
                            disconnected = True
                            break
                        
                        # Process text messages
                        if "text" in message:
                            try:
                                data = json.loads(message["text"])
                                data_type = data.get("type", "unknown")
                                
                                # Handle different message types
                                if data_type == "text":
                                    text = data.get("content", "")
                                    if text:
                                        logger.info(f"Received text: {text[:50]}...")
                                        await session.send(text, end_of_turn=True)
                                
                                elif data_type == "end_conversation":
                                    logger.info("Client requested end of conversation")
                                    disconnected = True
                                    break
                                
                                elif data_type == "screen":
                                    # Handle screen sharing data
                                    screen_data = data.get("data")
                                    if screen_data:
                                        media_msg = {
                                            "mime_type": "image/jpeg",
                                            "data": screen_data
                                        }
                                        await session.send(media_msg)
                                        logger.info("Processed screen data")
                                
                                elif data_type == "audio":
                                    # Process audio data
                                    audio_data = data.get("data")
                                    mime_type = data.get("mime_type", FORMAT)
                                    
                                    if audio_data:
                                        try:
                                            audio_bytes = base64.b64decode(audio_data)
                                            formatted_audio = {
                                                "data": audio_bytes,
                                                "mime_type": mime_type
                                            }
                                            await session.send(input=formatted_audio)
                                            logger.info(f"Sent {len(audio_bytes)} bytes of audio to Gemini")
                                        except Exception as e:
                                            logger.error(f"Error processing audio: {str(e)}")
                            
                            except json.JSONDecodeError as e:
                                logger.error(f"Error decoding JSON: {str(e)}")
                        
                        # Handle binary data (raw audio)
                        elif "bytes" in message:
                            audio_data = message["bytes"]
                            mime_type = f"{FORMAT};rate={SEND_SAMPLE_RATE}"
                            
                            formatted_audio = {
                                "data": audio_data,
                                "mime_type": mime_type
                            }
                            await session.send(input=formatted_audio)
                            logger.info(f"Sent {len(audio_data)} bytes of raw audio to Gemini")
                    
                    except WebSocketDisconnect:
                        logger.info("WebSocket disconnected")
                        break
                    
                    except Exception as e:
                        logger.error(f"Error handling client message: {str(e)}")
                        # Continue receiving messages instead of breaking
            
            # Define handler for receiving responses from Gemini
            async def handle_gemini_responses():
                while True:
                    try:
                        turn = session.receive()
                        async for response in turn:
                            # Handle audio data from Gemini
                            if hasattr(response, "data") and response.data:
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
                            
                            # Handle text response from Gemini
                            if hasattr(response, "text") and response.text:
                                await websocket.send_json({
                                    "type": "text",
                                    "content": response.text
                                })
                                logger.info(f"Sent text response: {response.text[:50]}...")
                    
                    except asyncio.CancelledError:
                        logger.info("Gemini response handler cancelled")
                        break
                    
                    except Exception as e:
                        logger.error(f"Error receiving from Gemini: {str(e)}")
                        break
            
            # Start the two main tasks
            client_task = asyncio.create_task(handle_client_messages(), name="client_messages")
            gemini_task = asyncio.create_task(handle_gemini_responses(), name="gemini_responses")
            
            # Wait for both tasks to complete (they should only complete
            # when the client disconnects or an error occurs)
            done, pending = await asyncio.wait(
                [client_task, gemini_task], 
                return_when=asyncio.FIRST_EXCEPTION
            )
            
            # Log which task completed first (this would typically be due to an error)
            for completed_task in done:
                task_name = completed_task.get_name()
                if completed_task.exception():
                    logger.error(f"Task {task_name} raised an exception: {completed_task.exception()}")
                else:
                    logger.info(f"Task {task_name} completed successfully")
            
            # Cancel any pending tasks
            for task in pending:
                task_name = task.get_name()
                logger.info(f"Cancelling task: {task_name}")
                task.cancel()
                
            # Wait for tasks to be cancelled with a timeout
            try:
                await asyncio.wait_for(
                    asyncio.gather(*pending, return_exceptions=True),
                    timeout=2.0
                )
            except asyncio.TimeoutError:
                logger.warning("Some tasks took too long to cancel")
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected via exception")
    
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
    
    finally:
        # Clean up connection
        manager.disconnect(websocket)
        logger.info("Cleaned up resources")