import asyncio
import logging
import base64

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.core.session_manager import SessionManager
from app.services.gemini import GeminiService
from app.services.tutoring import TutoringService
from app.services.azure_tts import AzureSpeechService
from app.dependencies import (
    get_session_manager,
    get_gemini_service,
    get_tutoring_service,
    get_azure_speech_service
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
logger.setLevel(logging.WARNING)

@router.websocket("/session")
async def tutoring_websocket(
    websocket: WebSocket,
    # Let FastAPI inject these:
    session_manager: SessionManager = Depends(get_session_manager),
    gemini_service: GeminiService = Depends(get_gemini_service),
    tutoring_service: TutoringService = Depends(get_tutoring_service),
    azure_speech_service: AzureSpeechService = Depends(get_azure_speech_service),  # NEW
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
                gemini_service=gemini_service,
                tutoring_service=tutoring_service,
                speech_service=azure_speech_service,  # NEW
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
                        if len(media_chunks) > 0:
                            logger.debug(f"[Session {session.id}] Received {len(media_chunks)} media_chunks.")
                        else:
                            logger.debug(f"[Session {session.id}] Received realtime input with no media_chunks.")

                        # Pass message to session
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

        async def handle_transcript_responses():
            """Handle transcribed speech from both user and Gemini."""
            try:
                async for transcript in session.get_transcripts():
                    if session.quit_event.is_set():
                        break
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
            """Handle processed audio from the audio service."""
            try:
                async for audio_chunk in session.get_audio():
                    if session.quit_event.is_set():
                        break
                    audio_b64 = base64.b64encode(audio_chunk).decode()
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