import asyncio
import logging
import base64
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.core.session_manager import SessionManager
from app.services.gemini import GeminiService
from app.services.tutoring import TutoringService
from app.services.azure_tts import AzureSpeechService
from app.services.gemini_read_along import GeminiReadAlongIntegration  # NEW: import the read-along integration
from app.dependencies import (
    get_session_manager,
    get_gemini_service,
    get_tutoring_service,
    get_azure_speech_service,
    get_read_along_integration  # NEW: import the dependency function
)

router = APIRouter()

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)

# Silence urllib3 logs
logging.getLogger('urllib3').setLevel(logging.WARNING)

# Silence azure logs
logging.getLogger('azure').setLevel(logging.WARNING)
logging.getLogger('azure.core.pipeline.policies.http_logging_policy').setLevel(logging.WARNING)
logging.getLogger('websockets').setLevel(logging.WARNING)

# Keep your application logs at DEBUG level
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

@router.websocket("/session")
async def tutoring_websocket(
    websocket: WebSocket,
    # Let FastAPI inject these:
    session_manager: SessionManager = Depends(get_session_manager),
    gemini_service: GeminiService = Depends(get_gemini_service),
    tutoring_service: TutoringService = Depends(get_tutoring_service),
    azure_speech_service: AzureSpeechService = Depends(get_azure_speech_service),
    read_along_integration: GeminiReadAlongIntegration = Depends(get_read_along_integration),  # NEW: inject the read-along integration
):
    logger.info("New WebSocket connection request")
    await websocket.accept()
    logger.info("WebSocket connection accepted")

    session = None

    try:
        # Wait for session initialization
        init_message = await websocket.receive_json()
        if init_message.get("text") != "InitSession":
            logger.error("Invalid initialization message")
            await websocket.close(code=1003)
            return

        # Extract session data from the message
        session_data = init_message.get("data", {})
        logger.info(f"session data {session_data}")

        try:
            # Create session through session manager, passing the pre-injected services
            session = await session_manager.create_session(
                subject=session_data.get("subject", ""),
                skill_description=session_data.get("skill_description", ""),
                subskill_description=session_data.get("subskill_description", ""),
                student_id=session_data.get("student_id", 0),
                competency_score=session_data.get("competency_score", 5.0),
                skill_id=session_data.get("skill_id"),
                subskill_id=session_data.get("subskill_id"),
                unit_id=session_data.get("unit_id"),
                gemini_service=gemini_service,
                tutoring_service=tutoring_service,
                speech_service=azure_speech_service,
                read_along_integration=read_along_integration,  # NEW: pass the read-along integration
                
            )

            await websocket.send_json({
                "type": "session_started",
                "session_id": session.id
            })
            logger.info(f"Started session {session.id}")
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            await websocket.send_json({
                "type": "error",
                "message": "Failed to initialize session"
            })
            return

        # Now set up your concurrent tasks to handle incoming and outgoing data
        async def handle_client_messages():
            """Receive messages from the client and process them."""
            try:
                while not session.quit_event.is_set():
                    message = await websocket.receive_json()

                    # Check message type
                    if message.get("type") == "realtime_input":
                        media_chunks = message.get("media_chunks", [])
                        await session.process_message(message)
                    # NEW: Handle read-along request
                    elif message.get("type") == "read_along_request":
                        logger.info(f"[Session {session.id}] Read-along request received: {message}")
                        await session.process_message(message)
                    else:
                        logger.warning(f"[Session {session.id}] Unknown message type: {message.get('type')}")

            except WebSocketDisconnect:
                logger.info(f"[Session {session.id}] Client disconnected")
            except Exception as e:
                logger.error(f"[Session {session.id}] Error handling client messages: {e}")
                session.quit_event.set()

        async def handle_text_responses():
            """Handle text responses from the session."""
            try:
                async for text in session.get_responses():
                    if session.quit_event.is_set():
                        break
                    await websocket.send_json({
                        "type": "text",
                        "content": text
                    })
            except asyncio.CancelledError:
                logger.debug(f"[Session {session.id}] Text response handler cancelled")
                raise

        async def handle_problem_responses():
            """Handle problem responses from the session."""
            try:
                async for problem in session.get_problems():
                    if session.quit_event.is_set():
                        break

                    await websocket.send_json({
                        "type": "problem",
                        "content": problem
                    })
                    logger.info(f"[Session {session.id}] Sent problem to client")
            except asyncio.CancelledError:
                logger.debug(f"[Session {session.id}] Problem response handler cancelled")
                raise
            except Exception as e:
                logger.error(f"[Session {session.id}] Error in problem response handler: {e}")
                raise

        # NEW: Add a handler for read-along responses
        async def handle_read_along_responses():
            """Handle read-along responses from the session."""
            try:
                read_along_count = 0
                async for read_along in session.get_read_alongs():
                    if session.quit_event.is_set():
                        break
                    
                    read_along_count += 1
                    #logger.info(f"[Session {session.id}] Sending read-along #{read_along_count} to client")

                    await websocket.send_json({
                        "type": "read_along",
                        "content": read_along
                    })
                    logger.info(f"[Session {session.id}] Sent read-along to client")
            except asyncio.CancelledError:
                logger.debug(f"[Session {session.id}] Read-along response handler cancelled")
                raise
            except Exception as e:
                logger.error(f"[Session {session.id}] Error in read-along response handler: {e}", exc_info=True)
                raise

        async def handle_transcript_responses():
            """Handle transcribed speech from both user and Gemini."""
            try:
                async for transcript in session.get_transcripts():
                    logger.debug(
                        f"[Session {session.id}] Transcript: "
                        f"Speaker={transcript.get('speaker')} "
                        f"Partial={transcript.get('data', {}).get('is_partial')} "
                    )
                    await websocket.send_json({
                        "type": "transcript",
                        "content": transcript
                    })
            except asyncio.CancelledError:
                logger.debug(f"[Session {session.id}] Transcript handler cancelled")
                raise

        async def handle_audio_responses():
            """Handle processed audio from the audio service, preserving timing information."""
            try:
                async for audio_data in session.get_audio():
                    if session.quit_event.is_set():
                        break
                        
                    # Check if we received enhanced audio packet with timing info
                    if isinstance(audio_data, dict) and 'audio_data' in audio_data:
                        # Extract audio data and timing information
                        audio_bytes = audio_data['audio_data']
                        timestamp = audio_data.get('timestamp', int(time.time() * 1000))
                        duration = audio_data.get('duration', 0)
                        sample_rate = audio_data.get('sample_rate', 24000)
                        
                        # Convert to base64 for transmission
                        audio_b64 = base64.b64encode(audio_bytes).decode()
                        
                        # Send to client with timing metadata
                        await websocket.send_json({
                            "type": "audio",
                            "data": audio_b64,
                            "mime_type": f"audio/pcm;rate={sample_rate}",
                            "timestamp": timestamp,
                            "duration": duration
                        })
                    else:
                        # Fall back to original behavior for backward compatibility
                        audio_b64 = base64.b64encode(audio_data).decode()
                        await websocket.send_json({
                            "type": "audio",
                            "data": audio_b64,
                            "mime_type": "audio/pcm;rate=24000"
                        })
            except asyncio.CancelledError:
                logger.debug(f"[Session {session.id}] Audio handler cancelled")
                raise

        async def handle_scene_responses():
            """Handle visual scene updates from the session."""
            try:
                scene_count = 0
                logger.warning(f"[Session {session.id}] Starting scene response handler")
                async for scene in session.get_scenes():
                    if session.quit_event.is_set():
                        logger.warning(f"[Session {session.id}] Quit event set, breaking scene loop")
                        break
                    scene_count += 1
                    logger.warning(f"[Session {session.id}] Got scene #{scene_count}: {scene}")
                    await websocket.send_json({
                        "type": "scene",
                        "content": scene
                    })
                    logger.warning(f"[Session {session.id}] Sent scene #{scene_count} to client")
            except asyncio.CancelledError:
                logger.warning(f"[Session {session.id}] Scene handler cancelled after {scene_count} scenes")
                raise
            except Exception as e:
                logger.error(f"[Session {session.id}] Error handling scenes: {e}", exc_info=True)
                raise

        # Combine the sub-handlers
        async def handle_responses():
            tasks = []
            try:
                tasks = [
                    asyncio.create_task(handle_text_responses()),
                    asyncio.create_task(handle_problem_responses()),
                    asyncio.create_task(handle_transcript_responses()),
                    asyncio.create_task(handle_audio_responses()),
                    asyncio.create_task(handle_scene_responses()),
                    # NEW: Add the read-along response handler
                    asyncio.create_task(handle_read_along_responses()),
                ]
                await asyncio.gather(*tasks)
            except asyncio.CancelledError:
                logger.info(f"[Session {session.id}] Cancelling response handlers")
                for t in tasks:
                    if not t.done():
                        t.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                raise
            except Exception as e:
                logger.error(f"[Session {session.id}] Error in handle_responses: {e}")
                session.quit_event.set()
                raise

        # Run everything concurrently
        await asyncio.gather(
            handle_client_messages(),
            handle_responses()
        )

    except WebSocketDisconnect:
        logger.info("Client disconnected during initialization")
    except Exception as e:
        logger.error(f"Error in WebSocket handler: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        if session:
            await session_manager.cleanup_session(session.id)
        try:
            await websocket.close()
        except:
            pass