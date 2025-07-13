# backend/app/api/endpoints/package_session.py
from google import genai
from google.genai import types
from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig, Content

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, Path, status
import asyncio
import json
import logging
import base64
import uuid
import traceback
from typing import Dict, Any, Optional, List

from ...core.config import settings
from ...db.cosmos_db import CosmosDBService
from ...services.user_profiles import user_profiles_service  # FIXED: Import the service instance
from ...models.user_profiles import ActivityLog  # FIXED: Import ActivityLog model

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options={"api_version": "v1beta"},
)

DEFAULT_VOICE = "Leda"
MODEL = "gemini-2.5-flash-preview-native-audio-dialog"

# Audio constants
FORMAT = "audio/pcm"
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHANNELS = 1

# Router setup
router = APIRouter()

# Initialize Cosmos DB service
cosmos_db = CosmosDBService()

# ADD: Helper function to authenticate WebSocket connections (same as gemini.py)
async def authenticate_websocket_token(token: str) -> dict:
    """Authenticate WebSocket connection using token from first message"""
    try:
        from firebase_admin import auth
        
        # Remove 'Bearer ' prefix if present
        clean_token = token.replace('Bearer ', '')
        decoded_token = auth.verify_id_token(clean_token)
        
        logger.info(f"✅ WebSocket user authenticated: {decoded_token.get('email')}")
        return decoded_token
        
    except Exception as e:
        logger.error(f"❌ WebSocket authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )

# ADD: Connection manager to handle multiple WebSocket connections (enhanced from gemini.py)
class PackageConnectionManager:
    def __init__(self):
        self.active_connections = []
        self.user_connections = {}  # Track connections by user_id
        self._lock = asyncio.Lock()  # Add a lock for thread safety

    async def connect(self, websocket: WebSocket, user_id: str = None):
        await websocket.accept()
        async with self._lock:
            if websocket not in self.active_connections:
                self.active_connections.append(websocket)
                if user_id:
                    self.user_connections[user_id] = websocket
                logger.info(f"Package session client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, user_id: str = None):
        try:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                if user_id and user_id in self.user_connections:
                    del self.user_connections[user_id]
                logger.info(f"Package session client disconnected. Total connections: {len(self.active_connections)}")
            else:
                logger.info("Attempted to disconnect a client that wasn't in the active connections list")
        except Exception as e:
            logger.error(f"Error during connection manager disconnect: {str(e)}")
            
    def is_connected(self, websocket: WebSocket) -> bool:
        return websocket in self.active_connections

# Global connection manager
connection_manager = PackageConnectionManager()

class PackageSessionManager:
    """Manages package-specific learning sessions"""
    
    def __init__(self):
        self.active_sessions = {}
        self._lock = asyncio.Lock()

    async def create_session(self, package_id: str, user_id: str, student_id: Optional[int] = None) -> str:
        """Create a new package learning session"""
        session_id = str(uuid.uuid4())
        
        async with self._lock:
            self.active_sessions[session_id] = {
                "package_id": package_id,
                "user_id": user_id,  # ADD: Track user_id
                "student_id": student_id,
                "created_at": asyncio.get_event_loop().time(),
                "interactions": []
            }
        
        return session_id
    
    async def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session information"""
        return self.active_sessions.get(session_id)
    
    async def log_interaction(self, session_id: str, interaction_data: Dict):
        """Log session interaction"""
        async with self._lock:
            if session_id in self.active_sessions:
                self.active_sessions[session_id]["interactions"].append({
                    "timestamp": asyncio.get_event_loop().time(),
                    **interaction_data
                })
    
    async def end_session(self, session_id: str):
        """End and cleanup session"""
        async with self._lock:
            self.active_sessions.pop(session_id, None)

# Global session manager
session_manager = PackageSessionManager()

async def build_package_instruction(package_id: str, user_id: str, user_email: str) -> str:
    """Build focused system instruction with package context and user info"""
    
    try:
        package = await cosmos_db.get_content_package_by_id(package_id)
        
        if not package:
            logger.warning(f"Package {package_id} not found")
            return "You are an AI tutor. Be helpful, encouraging, and adaptive."
        
        # Extract key package data
        master_context = package.get("master_context", {})
        content = package.get("content", {})
        reading_title = content.get('reading', {}).get('title', 'Learning Content')
        
        # Core concepts (limit to 5 most important)
        core_concepts = master_context.get('core_concepts', [])[:5]
        concepts_text = "\n".join([f"• {concept}" for concept in core_concepts]) if core_concepts else "• General learning concepts"
        
        # Learning objectives (limit to 5)
        objectives = master_context.get('learning_objectives', [])[:5]
        objectives_text = "\n".join([f"• {obj}" for obj in objectives]) if objectives else "• Support student understanding"
        
        # Key terminology (limit to 8 most important terms)
        terminology = master_context.get('key_terminology', {})
        if terminology:
            # Take first 8 terms
            key_terms = list(terminology.items())[:8]
            terms_text = "\n".join([f"• {term}: {definition}" for term, definition in key_terms])
        else:
            terms_text = "• Use standard educational terminology"
        
        # Available resources
        resources = []
        if content.get('reading'):
            resources.append("detailed reading material")
        if content.get('visual'):
            resources.append("interactive visualizations")
        if content.get('audio'):
            resources.append("audio explanations")
        if content.get('practice', {}).get('problems'):
            problem_count = len(content['practice']['problems'])
            resources.append(f"{problem_count} practice problems")
        
        resources_text = ", ".join(resources) if resources else "educational content"
        
        instruction = f"""You are an AI tutor for "{reading_title}" - a {package.get('subject', 'general')} lesson on {package.get('subskill', 'core concepts')}.

STUDENT INFORMATION:
• Student Email: {user_email}
• User ID: {user_id}

LEARNING GOALS:
{objectives_text}

KEY CONCEPTS TO COVER:
{concepts_text}

IMPORTANT TERMS:
{terms_text}

AVAILABLE RESOURCES: {resources_text}

TEACHING APPROACH:
• Start by asking what the student wants to focus on
• Use the key terminology consistently throughout
• Reference available resources when helpful ("Check the reading for..." or "Try the practice problems...")
• Explain concepts clearly and check understanding
• Be encouraging and adaptive to the student's pace
• Connect learning to real-world applications when possible
• Maintain a warm, supportive teaching style

Keep responses conversational and age-appropriate. Focus on helping the student master the learning goals through engaging dialogue."""
        
        return instruction
        
    except Exception as e:
        logger.error(f"Error building package instruction: {str(e)}")
        return "You are an AI tutor. Be helpful, encouraging, and adaptive."

# ENHANCED: WebSocket endpoint for package-specific learning with authentication
@router.websocket("/{package_id}/learn")
async def package_learning_session(
    websocket: WebSocket,
    package_id: str = Path(..., description="Content package ID"),
    student_id: Optional[int] = Query(None, description="Student ID for tracking")
):
    """WebSocket endpoint for package-specific tutoring sessions with authentication"""
    
    # STEP 1: Accept connection first, then authenticate via first message
    await websocket.accept()
    logger.info(f"Package learning WebSocket connection accepted for package {package_id}, waiting for authentication")
    
    # Authentication variables
    user_id = None
    user_email = None
    firebase_user = None
    
    try:
        # STEP 2: Wait for authentication message
        auth_message = await asyncio.wait_for(websocket.receive(), timeout=10.0)
        
        if "text" in auth_message:
            try:
                auth_data = json.loads(auth_message["text"])
                
                if auth_data.get("type") != "authenticate":
                    await websocket.close(code=4001, reason="First message must be authentication")
                    return
                
                token = auth_data.get("token")
                if not token:
                    await websocket.close(code=4001, reason="No authentication token provided")
                    return
                
                # Authenticate the token
                firebase_user = await authenticate_websocket_token(token)
                user_id = firebase_user['uid']
                user_email = firebase_user.get('email', 'Unknown')
                
                # Send authentication success
                await websocket.send_json({
                    "type": "auth_success",
                    "message": "Authentication successful",
                    "package_id": package_id
                })
                
            except json.JSONDecodeError:
                await websocket.close(code=4001, reason="Invalid authentication message format")
                return
            except Exception as auth_error:
                logger.error(f"Authentication failed: {str(auth_error)}")
                await websocket.close(code=4001, reason="Authentication failed")
                return
        else:
            await websocket.close(code=4001, reason="First message must be text")
            return
            
    except asyncio.TimeoutError:
        await websocket.close(code=4001, reason="Authentication timeout")
        return
    except Exception as e:
        logger.error(f"Error during authentication: {str(e)}")
        await websocket.close(code=4001, reason="Authentication error")
        return

    logger.info(f"New package learning session established for user: {user_email}, package: {package_id}")
    
    # STEP 3: Create session with user info
    session_id = await session_manager.create_session(package_id, user_id, student_id)
    
    # STEP 4: Log the tutoring session start
    try:
        # Get package info for activity logging
        package = await cosmos_db.get_content_package_by_id(package_id)
        package_title = "Unknown Package"
        subject = "General"
        if package:
            package_title = package.get('content', {}).get('reading', {}).get('title', 'Unknown Package')
            subject = package.get('subject', 'General')
        
        await log_activity(
            user_id=user_id,
            activity_type="package_tutoring_session",
            activity_name=f"{package_title}",
            points=5,
            metadata={
                "package_id": package_id,
                "package_title": package_title,
                "subject": subject,
                "student_id": student_id,
                "session_type": "package_learning"
            }
        )
    except Exception as e:
        logger.warning(f"Failed to log session start activity: {str(e)}")
    
    # Create queues
    audio_in_queue = asyncio.Queue()
    text_queue = asyncio.Queue()
    client_audio_queue = asyncio.Queue()
    
    session = None
    tasks = []
    
    # Track session time
    session_start_time = asyncio.get_event_loop().time()
    
    try:
        # Build system instruction with user context
        system_instruction_text = await build_package_instruction(package_id, user_id, user_email)
        
        # Configure Gemini Live
        config = LiveConnectConfig(
            response_modalities=["AUDIO"],
            context_window_compression=(
                types.ContextWindowCompressionConfig(
                    sliding_window=types.SlidingWindow(),
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
            realtime_input_config=types.RealtimeInputConfig(turn_coverage="TURN_INCLUDES_ALL_INPUT"),
            media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW,
            system_instruction=Content(parts=[{"text": system_instruction_text}])
        )
        
        # Connect to Gemini
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            logger.info(f"Connected to Gemini for package {package_id}")
            
            async def receive_from_client():
                disconnect_received = False
                
                while not disconnect_received:
                    try:
                        logger.info("Waiting to receive message from client...")
                        message = await asyncio.wait_for(websocket.receive(), timeout=5.0)
                        
                        message_type = message.get("type", "unknown")
                        logger.info(f"Received message type: {message_type}")
                        
                        if message_type == "websocket.disconnect":
                            logger.info("WebSocket disconnect message received")
                            disconnect_received = True
                            break
                        
                        data = None
                        if "text" in message:
                            try:
                                data = json.loads(message["text"])
                                
                                # Skip authentication messages since we already handled that
                                if data.get("type") == "authenticate":
                                    continue
                                    
                                logger.info(f"Parsed message data type: {data.get('type', 'unknown')}")
                            except json.JSONDecodeError as e:
                                logger.error(f"Error decoding JSON: {str(e)}, raw text: {message.get('text', '')[:100]}")
                                continue
                        elif "bytes" in message:
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
                        
                        if data:
                            if data["type"] == "text":
                                text = data.get("content", "")
                                if text:
                                    logger.info(f"Received text: {text[:50]}...")
                                    await text_queue.put(text)
                                    # Log interaction
                                    await session_manager.log_interaction(
                                        session_id, 
                                        {"type": "student_text", "content": text[:100]}
                                    )
                            elif data["type"] == "end_conversation":
                                logger.info("Client requested end of conversation")
                                disconnect_received = True
                                break
                            elif data["type"] == "audio":
                                audio_data = data.get("data")
                                mime_type = data.get("mime_type", FORMAT)
                                
                                if audio_data:
                                    logger.info(f"Received audio data (base64), length: {len(audio_data)}")
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
                    
                    except asyncio.TimeoutError:
                        logger.info("No message received within timeout, but keeping connection open for live session")
                        continue
                    except WebSocketDisconnect as wsd:
                        logger.info(f"WebSocketDisconnect exception caught: {str(wsd)}")
                        disconnect_received = True
                        break
                    except Exception as e:
                        logger.error(f"Error receiving client message: {str(e)}")
            
            async def send_text_to_gemini():
                while True:
                    try:
                        text = await text_queue.get()
                        await session.send(input=text, end_of_turn=True)
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        logger.error(f"Error sending text to Gemini: {str(e)}")
            
            async def send_audio_to_gemini():
                consecutive_errors = 0
                max_consecutive_errors = 5
                
                while True:
                    try:
                        audio_msg = await client_audio_queue.get()
                        
                        data_length = len(audio_msg.get('data', b'')) if 'data' in audio_msg else 0
                        mime_type = audio_msg.get('mime_type', 'unknown')
                        
                        if data_length > 0:
                            logger.info(f"Preparing to send audio to Gemini: {data_length} bytes, mime type: {mime_type}")
                            
                            data = audio_msg.get('data')
                            if hasattr(data, '__len__') and len(data) >= 4:
                                first_bytes = str([b for b in data[:16]])
                                logger.info(f"First bytes of audio data to send: {first_bytes}")
                        
                            formatted_audio_msg = {
                                "data": audio_msg.get('data', b''),
                                "mime_type": mime_type
                            }
                            
                            logger.info(f"Sending audio to Gemini: {len(formatted_audio_msg.get('data', b''))} bytes with mime type: {formatted_audio_msg.get('mime_type')}")
                            
                            await session.send(input=formatted_audio_msg)
                            logger.info(f"Successfully sent audio data to Gemini")
                            
                            consecutive_errors = 0
                        
                    except asyncio.CancelledError:
                        logger.info("Audio sending task cancelled")
                        break
                    except Exception as e:
                        consecutive_errors += 1
                        logger.error(f"Error sending audio to Gemini: {str(e)}")
                        logger.error(f"Exception traceback: {traceback.format_exc()}")
                        
                        if consecutive_errors >= max_consecutive_errors:
                            logger.error(f"Too many consecutive errors ({consecutive_errors}), stopping audio stream")
                            break
                        
                        await asyncio.sleep(0.1)
            
            async def receive_from_gemini():
                while True:
                    try:
                        turn = session.receive()
                        async for response in turn:
                            # Handle audio response
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
                            
                            # Handle text response
                            if hasattr(response, "text") and response.text:
                                await websocket.send_json({
                                    "type": "text",
                                    "content": response.text,
                                    "package_id": package_id,
                                    "session_id": session_id
                                })
                                logger.info(f"Sent text response: {response.text[:50]}...")
                                
                                # Log AI response
                                await session_manager.log_interaction(
                                    session_id,
                                    {"type": "ai_response", "content": response.text[:100]}
                                )
                            
                            # Handle input transcriptions
                            if hasattr(response, "input_transcription") and response.input_transcription:
                                await websocket.send_json({
                                    "type": "input_transcription",
                                    "content": response.input_transcription
                                })
                                logger.info(f"Sent input transcription: {response.input_transcription[:50]}...")
                            
                            # Handle output transcriptions
                            if hasattr(response, "output_transcription") and response.output_transcription:
                                await websocket.send_json({
                                    "type": "output_transcription",
                                    "content": response.output_transcription
                                })
                                logger.info(f"Sent output transcription: {response.output_transcription[:50]}...")
                    
                    except asyncio.CancelledError:
                        logger.info("Gemini receiving task cancelled")
                        break
                    except Exception as e:
                        error_str = str(e)
                        logger.error(f"Error receiving from Gemini: {error_str}")
                        
                        if "Deadline expired" in error_str or "1011" in error_str:
                            logger.info("Deadline exceeded error detected, closing session gracefully")
                            
                            try:
                                await websocket.send_json({
                                    "type": "error",
                                    "content": "The AI service connection timed out. Please refresh to start a new session."
                                })
                            except Exception as ws_err:
                                logger.error(f"Error sending error notification: {str(ws_err)}")
                            
                            return
                        
                        await asyncio.sleep(0.5)
            
            # Start all tasks with names
            logger.info("Starting background tasks for WebSocket communication")
            tasks = [
                asyncio.create_task(receive_from_client(), name="receive_from_client"),
                asyncio.create_task(send_text_to_gemini(), name="send_text_to_gemini"),
                asyncio.create_task(send_audio_to_gemini(), name="send_audio_to_gemini"),
                asyncio.create_task(receive_from_gemini(), name="receive_from_gemini"),
            ]
            logger.info(f"Started {len(tasks)} background tasks")
            
            # Send welcome message
            await send_welcome_message(session, package_id, user_email)
            
            # Wait for the first task to complete
            logger.info("Waiting for any task to complete...")
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            
            for completed_task in done:
                task_name = completed_task.get_name()
                if completed_task.exception():
                    logger.error(f"Task {task_name} completed with exception: {completed_task.exception()}")
                else:
                    logger.info(f"Task {task_name} completed successfully")
            
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
    
    except Exception as e:
        logger.error(f"Error in tutoring session: {str(e)}")
        try:
            await websocket.send_json({
                "type": "error",
                "content": f"Session error: {str(e)}"
            })
        except:
            pass
    
    finally:
        # STEP 5: Log session completion and duration (like gemini.py)
        session_duration = asyncio.get_event_loop().time() - session_start_time
        try:
            # Get package info for completion logging
            package = await cosmos_db.get_content_package_by_id(package_id)
            package_title = "Unknown Package"
            subject = "General"
            if package:
                package_title = package.get('content', {}).get('reading', {}).get('title', 'Unknown Package')
                subject = package.get('subject', 'General')
            
            await log_activity(
                user_id=user_id,
                activity_type="package_tutoring_session_completed",
                activity_name=f"{package_title}",
                points=max(10, int(session_duration / 60 * 2)),  # 2 points per minute, minimum 10
                metadata={
                    "package_id": package_id,
                    "package_title": package_title,
                    "subject": subject,
                    "student_id": student_id,
                    "session_duration_seconds": int(session_duration),
                    "session_type": "package_learning"
                }
            )
        except Exception as e:
            logger.warning(f"Failed to log session completion activity: {str(e)}")
        
        # Cleanup session
        await session_manager.end_session(session_id)
        
        # Disconnect from connection manager
        try:
            connection_manager.disconnect(websocket, user_id)
            logger.info("Disconnected from connection manager")
        except Exception as e:
            logger.error(f"Error during disconnection: {str(e)}")
            
        logger.info(f"Package tutoring session ended: {session_id}")

async def send_welcome_message(session, package_id: str, user_email: str):
    """Send initial welcome message with user context"""
    try:
        package = await cosmos_db.get_content_package_by_id(package_id)
        if package:
            title = package.get('content', {}).get('reading', {}).get('title', 'this lesson')
            welcome = f"Hi! I'm here to help you learn about {title}. What would you like to explore first?"
        else:
            welcome = "Hi! I'm your AI tutor. What would you like to learn about today?"
        
        await session.send(input=welcome, end_of_turn=True)
    except Exception as e:
        logger.error(f"Error sending welcome message: {str(e)}")

# Content package browsing endpoints (unchanged but with better error handling)
@router.get("/content-packages")
async def get_content_packages(
    subject: Optional[str] = Query(None),
    skill: Optional[str] = Query(None), 
    subskill: Optional[str] = Query(None),
    status: str = Query("approved"),
    limit: int = Query(50)
):
    """Get available content packages with filtering"""
    try:
        packages = await cosmos_db.get_content_packages(
            subject=subject,
            skill=skill,
            subskill=subskill,
            status=status,
            limit=limit
        )
        
        # Return simplified metadata for package selection
        simplified_packages = []
        for package in packages:
            simplified_packages.append({
                "id": package.get("id"),
                "subject": package.get("subject"),
                "skill": package.get("skill"),
                "subskill": package.get("subskill"),
                "title": package.get("content", {}).get("reading", {}).get("title", "Untitled"),
                "description": package.get("master_context", {}).get("core_concepts", [])[:2],  # First 2 concepts
                "difficulty_level": package.get("master_context", {}).get("difficulty_level"),
                "learning_objectives": package.get("master_context", {}).get("learning_objectives", [])[:3],  # First 3 objectives
                "has_visual": bool(package.get("content", {}).get("visual")),
                "has_audio": bool(package.get("content", {}).get("audio")),
                "has_practice": bool(package.get("content", {}).get("practice", {}).get("problems")),
                "created_at": package.get("created_at")
            })
        
        return {
            "status": "success",
            "packages": simplified_packages,
            "total_count": len(simplified_packages)
        }
        
    except Exception as e:
        logger.error(f"Error getting content packages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving content packages: {str(e)}")

@router.get("/content-packages/{package_id}")
async def get_content_package_details(package_id: str):
    """Get detailed information about a specific content package"""
    try:
        package = await cosmos_db.get_content_package_by_id(package_id)
        
        if not package:
            raise HTTPException(status_code=404, detail="Content package not found")
        
        return {
            "status": "success",
            "package": package
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting content package details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving content package: {str(e)}")

# ADD: Health check endpoint for package learning service
@router.get("/health")
async def package_learning_health_check():
    """Health check for package learning service"""
    try:
        return {
            "status": "healthy",
            "service": "package_learning",
            "active_sessions": len(session_manager.active_sessions),
            "active_connections": len(connection_manager.active_connections),
            "gemini_model": MODEL,
            "audio_format": FORMAT,
            "features": {
                "authentication": True,
                "activity_logging": True,
                "session_tracking": True,
                "audio_support": True,
                "text_support": True
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "package_learning",
            "error": str(e)
        }