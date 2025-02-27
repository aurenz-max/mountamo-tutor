import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import base64

from ...core.session_manager import SessionManager
from ...services.audio_service import AudioService
from ...db.cosmos_db import CosmosDBService

from app.core.config import settings

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

# Create only the services that can be shared safely
audio_service = AudioService()
cosmos_db = CosmosDBService()

# Initialize SessionManager with only the services that can be shared
session_manager = SessionManager(audio_service, cosmos_db)

router = APIRouter()

@router.websocket("/session")
async def tutoring_websocket(websocket: WebSocket):
    logger.info("New WebSocket connection request")
    session = None

    try:
        await websocket.accept()
        logger.info("WebSocket connection accepted")

        # Wait for session initialization
        init_message = await websocket.receive_json()
        if init_message.get("text") != "InitSession":
            logger.error("Invalid initialization message")
            await websocket.close(code=1003)
            return

        # Extract session data
        session_data = init_message.get("data", {})
        
        # Create session through session manager
        try:
            session = await session_manager.create_session(
                subject=session_data.get("subject", ""),
                skill_description=session_data.get("skill_description", ""),
                subskill_description=session_data.get("subskill_description", ""),
                student_id=session_data.get("student_id", 0),
                competency_score=session_data.get("competency_score", 5.0),
                skill_id=session_data.get("skill_id"),
                subskill_id=session_data.get("subskill_id")
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

        # Handle incoming messages from the client
        async def handle_client_messages():
            try:
                while not session.quit_event.is_set():
                    message = await websocket.receive_json()
                    #logger.debug(f"[Received {message}.")
                    
                    # Check message type
                    # In tutoring.py websocket handler
                    if message.get("type") == "realtime_input":
                        media_chunks = message.get("media_chunks", [])
                        if len(media_chunks) > 0:
                            logger.debug(f"[Session {session.id}] Received {len(media_chunks)} media_chunks.")
                        else:
                            logger.debug(f"[Session {session.id}] Received realtime input with no media_chunks.")

                        # Process the message in the session
                        await session.process_message(message)

                    else:
                        logger.warning(
                            f"[Session {session.id}] Unknown message type received: "
                            f"{message.get('type')}"
                        )

            except WebSocketDisconnect:
                logger.info(f"[Session {session.id}] Client disconnected")
            except Exception as e:
                logger.error(f"[Session {session.id}] Error handling client messages: {e}")
                session.quit_event.set()


        async def handle_responses():
            """Handle text responses, audio, and problems"""
            tasks = []
            try:
                # Set up concurrent tasks for all response types
                logger.debug(f"[Session {session.id}] Starting response handlers")
                tasks = [
                    asyncio.create_task(handle_text_responses()),
                    asyncio.create_task(handle_audio_responses()),
                    asyncio.create_task(handle_problem_responses()),
                    asyncio.create_task(handle_transcript_responses()),
                    asyncio.create_task(handle_scene_responses())  # Add this line
                ]
                
                await asyncio.gather(*tasks)
                
            except asyncio.CancelledError:
                logger.info(f"[Session {session.id}] Cancelling response handlers")
                # Cancel all tasks
                for task in tasks:
                    if not task.done():
                        task.cancel()
                # Wait for tasks to complete cancellation
                await asyncio.gather(*tasks, return_exceptions=True)
                raise
            except Exception as e:
                logger.error(f"Error in response handler: {e}")
                session.quit_event.set()
                raise
            finally:
                # Ensure all tasks are cancelled in case of any other exit
                for task in tasks:
                    if not task.done():
                        task.cancel()


        async def handle_text_responses():
            """Handle text responses from the session"""
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
            """Handle problem responses from the session"""
            try:
                async for problem in session.get_problems():
                    if session.quit_event.is_set():
                        break
                    
                    # Send problem data directly to frontend - keep it simple
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
            """Handle transcribed speech from both user and Gemini"""
            try:
                async for transcript in session.get_transcripts():
                    if session.quit_event.is_set():
                        break
                    logger.debug(f"[Session {session.id}] Processing transcript: {transcript.get('session_id')} - " + 
                            f"Speaker: {transcript.get('speaker')} - " +
                            f"Partial: {transcript.get('data', {}).get('is_partial')} - " +
                            f"ID: {transcript.get('data', {}).get('id')} - " +
                            f"Text: {transcript.get('data', {}).get('text')[:50]}..."
                    )
                    await websocket.send_json({
                        "type": "transcript",
                        "content": transcript
                    })
            except asyncio.CancelledError:
                logger.debug(f"[Session {session.id}] Transcript response handler cancelled")
                raise

        async def handle_audio_responses():
            """Handle processed audio from the audio service"""
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
                logger.debug(f"[Session {session.id}] Audio response handler cancelled")
                raise

        async def handle_scene_responses():
            """Handle visual scene updates from the session"""
            try:
                async for scene in session.get_scenes():
                    if session.quit_event.is_set():
                        break
                    await websocket.send_json({
                        "type": "scene",
                        "content": scene
                    })
                    logger.debug(f"[Session {session.id}] Sent scene: {scene.get('scene_id')}")
            except asyncio.CancelledError:
                logger.debug(f"[Session {session.id}] Scene response handler cancelled")
                raise
            except Exception as e:
                logger.error(f"[Session {session.id}] Error handling scene responses: {e}")
                raise
        try:
            # Run all handlers concurrently
            logger.debug(f"[Session {session.id}] Client Messenger & Response handler started")
            await asyncio.gather(
                handle_client_messages(),
                handle_responses()
            )
        except Exception as e:
            logger.error(f"[Session {session.id}] Error in WebSocket handlers: {e}")
        finally:
            if session:
                await session_manager.cleanup_session(session.id)

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
