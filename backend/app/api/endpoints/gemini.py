# backend/app/api/endpoints/gemini.py
from fastapi import APIRouter, WebSocket, WebSocketException, WebSocketDisconnect, HTTPException
from fastapi.requests import Request
import asyncio
import json
import logging
import base64
from ...core.config import settings
from ...services.gemini import GeminiService
from ...services.audio_service import AudioService

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

router = APIRouter()
gemini_service = GeminiService(AudioService)

@router.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    logger.info(f"New WebSocket connection request from {websocket.client}")
    audio_queue = asyncio.Queue()
    text_queue = asyncio.Queue()
    quit_event = asyncio.Event()

    try:
        await websocket.accept()
        logger.info("WebSocket connection accepted")
        
        async def audio_stream():
            while not quit_event.is_set():
                try:
                    data = await audio_queue.get()
                    logger.debug(f"Audio stream yielding chunk of size: {len(data)}")
                    yield data
                except asyncio.CancelledError:
                    logger.info("Audio stream cancelled")
                    break

        async def on_text_callback(text: str):
            logger.debug(f"Sending text response to client: {text[:100]}...")
            await websocket.send_json({
                "text": text,
                "status": "streaming"
            })

        async def on_audio_callback(audio_data: bytes):
            logger.debug(f"Received audio chunk of size: {len(audio_data)}")
            gemini_service.audio_service.add_to_queue(audio_data)
            await websocket.send_json({
                "audio_status": "playing"
            })

        async def handle_incoming_messages():
            try:
                while not quit_event.is_set():
                    message = await websocket.receive()
                    logger.debug(f"Received raw WebSocket message type: {message['type']}")
                    
                    if message["type"] == "websocket.disconnect":
                        logger.info("Received disconnect message")
                        quit_event.set()
                        break
                        
                    if message["type"] != "websocket.receive":
                        continue

                    if message.get("text") == "ResetSession":
                        logger.info("Received reset session request")
                        await gemini_service.reset_session()
                        await websocket.send_json({
                            "status": "session_reset"
                        })
                        continue

                    message_text = message.get("text")
                    if not message_text:
                        logger.warning("Received empty text message")
                        continue
                    
                    try:
                        data = json.loads(message_text)
                        logger.debug(f"Parsed message data: {json.dumps(data, indent=2)}")
                        
                        if "realtime_input" in data:
                            chunks = data["realtime_input"]["media_chunks"]
                            logger.info(f"Processing {len(chunks)} media chunks")
                            
                            for chunk in chunks:
                                mime_type = chunk["mime_type"]
                                chunk_data = chunk["data"]
                                logger.debug(f"Processing chunk with mime_type: {mime_type}")

                                if mime_type.startswith("audio/pcm"):
                                    audio_data = base64.b64decode(chunk_data)
                                    logger.debug(f"Queued PCM audio chunk: {len(audio_data)} bytes")
                                    await audio_queue.put(audio_data)
                                elif mime_type == "text/plain":
                                    logger.info(f"Received text input: {chunk_data[:100]}...")
                                    await text_queue.put(chunk_data)
                                else:
                                    logger.warning(f"Unhandled mime type: {mime_type}")
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse message as JSON: {e}")
                        logger.debug(f"Raw message content: {message_text[:200]}...")
                    except Exception as e:
                        logger.error(f"Error processing message: {str(e)}", exc_info=True)
                        
            except Exception as e:
                logger.error(f"Error in message handler: {str(e)}", exc_info=True)
                quit_event.set()

        logger.info("Starting message handling and processing tasks")
        #await asyncio.gather(
        #     handle_incoming_messages(),
        #     gemini_service.process_conversation(
        #         audio_stream(),
        #         text_queue,
        #         on_text_callback,
        #         on_audio_callback
        #     )
        # )

    except WebSocketDisconnect:
        logger.info("Client disconnected normally")
    except Exception as e:
        logger.error(f"Error in WebSocket handler: {str(e)}", exc_info=True)
        try:
            await websocket.send_json({
                "error": "Internal server error",
                "status": "error"
            })
        except:
            logger.error("Failed to send error message to client")
    finally:
        logger.info("Cleaning up WebSocket connection")
        quit_event.set()
        try:
            await websocket.close()
        except:
            pass
