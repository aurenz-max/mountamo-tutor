from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import json
import uuid
from enum import Enum
from typing import Optional
from ...services.gemini import GeminiService

logger = logging.getLogger(__name__)

router = APIRouter()

class WebSocketMessageType(Enum):
    START_TRANSCRIPTION = "start_transcription"
    START_CONVERSATION = "start_conversation"
    AUDIO_DATA = "audio_data"
    TEXT_INPUT = "text_input"
    GENERATE_SPEECH = "generate_speech"
    CLOSE = "close"

@router.websocket("/ws/audio/{feature}")
async def audio_websocket(websocket: WebSocket, feature: str):  # Remove gemini_service dependency
    session_id = str(uuid.uuid4())
    gemini_service = GeminiService()
    manager = AudioSessionManager(gemini_service)
    
    try:
        await websocket.accept()
        logger.info(f"WebSocket connection established for feature: {feature}, session: {session_id}")

        async def send_response(type: str, data: dict):
            await websocket.send_json({
                "type": type,
                "session_id": session_id,
                **data
            })

        async def handle_transcription():
            await manager.start_transcription_session(session_id)
            while True:
                message = await websocket.receive()
                if message["type"] == "bytes":
                    transcription = await manager.handle_audio_chunk(message["bytes"], session_id)
                    if transcription:
                        await send_response("transcription", {"text": transcription})

        async def handle_conversation():
            # Set up callbacks for the conversation
            async def text_callback(text: str):
                await send_response("text", {"content": text})
            
            async def audio_callback(audio: bytes):
                await websocket.send_bytes(audio)

            await manager.start_conversation_session(
                session_id,
                on_text_callback=text_callback,
                on_audio_callback=audio_callback
            )

            while True:
                message = await websocket.receive()
                if message["type"] == "bytes":
                    await manager.handle_audio_chunk(message["bytes"], session_id)
                elif message["type"] == "text":
                    data = json.loads(message["text"])
                    if data["type"] == "text_input":
                        await manager.send_text(data["content"], session_id)

        # Main WebSocket message handling loop
        while True:
            try:
                message = await websocket.receive()
                
                if message["type"] == "text":
                    data = json.loads(message["text"])
                    msg_type = WebSocketMessageType(data["type"])

                    if msg_type == WebSocketMessageType.START_TRANSCRIPTION:
                        await handle_transcription()
                        
                    elif msg_type == WebSocketMessageType.START_CONVERSATION:
                        await handle_conversation()
                        
                    elif msg_type == WebSocketMessageType.GENERATE_SPEECH:
                        audio_data = await manager.generate_speech(
                            data["text"], 
                            data.get("voice", "default")
                        )
                        await websocket.send_bytes(audio_data)
                        
                    elif msg_type == WebSocketMessageType.CLOSE:
                        break

            except json.JSONDecodeError:
                logger.error("Invalid JSON received")
                await send_response("error", {"message": "Invalid JSON format"})
                
            except ValueError as e:
                logger.error(f"Value error: {str(e)}")
                await send_response("error", {"message": str(e)})

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}", exc_info=True)
        await send_response("error", {"message": str(e)})
    finally:
        await manager.close_session(session_id)
        logger.info(f"Cleaned up session: {session_id}")

# Example client usage:
"""
# Start transcription
await ws.send_json({
    "type": "start_transcription"
})

# Start conversation
await ws.send_json({
    "type": "start_conversation"
})

# Send audio data
await ws.send_bytes(audio_chunk)

# Send text input (for conversation)
await ws.send_json({
    "type": "text_input",
    "content": "Hello, how are you?"
})

# Generate speech
await ws.send_json({
    "type": "generate_speech",
    "text": "Hello, this is a test",
    "voice": "en-US-Standard-C"
})

# Close connection
await ws.send_json({
    "type": "close"
})
"""