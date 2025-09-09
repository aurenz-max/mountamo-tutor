# backend/app/api/endpoints/package_session.py
from google import genai
from google.genai import types
from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig, Content

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, Path, status, Depends
import asyncio
import json
import logging
import base64
import uuid
import traceback
from typing import Dict, Any, Optional, List

from ...core.config import settings
from ...db.cosmos_db import CosmosDBService
from ...services.user_profiles import user_profiles_service
from ...models.user_profiles import ActivityLog

# 🔥 FIXED: Import the correct auth dependency from your middleware
from ...core.middleware import get_user_context
from ...dependencies import get_problem_service
from ...services.problems import ProblemService

# Enhanced logging configuration - CLEANED UP VERSION (from daily_briefing_live.py)
logging.basicConfig(
    level=logging.INFO,  # Changed from DEBUG to INFO to reduce noise
    format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
)
logger = logging.getLogger(__name__)

# Create a separate logger for Gemini interactions
gemini_logger = logging.getLogger('gemini_interaction')
gemini_logger.setLevel(logging.INFO)

# Suppress verbose websockets logging
websockets_logger = logging.getLogger('websockets')
websockets_logger.setLevel(logging.WARNING)

# Suppress verbose google_genai logging
google_genai_logger = logging.getLogger('google_genai')
google_genai_logger.setLevel(logging.WARNING)

# Updated Gemini configuration (from daily_briefing_live.py)
client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options={"api_version": "v1alpha"},  # Updated API version
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

# Helper function to authenticate WebSocket connections
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

# Enhanced Connection manager
class PackageConnectionManager:
    def __init__(self):
        self.active_connections = []
        self.user_connections = {}
        self._lock = asyncio.Lock()

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
                "user_id": user_id,
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

IMPORTANT AUDIO INTERACTION RULES:
• Keep your responses concise and engaging (30-60 seconds max per response)
• PAUSE frequently to let the student respond - don't give long monologues
• Listen carefully for interruptions and respond naturally
• If the student interrupts you, acknowledge it gracefully: "Oh, you have a question!"
• Break complex information into smaller, digestible chunks

TEACHING APPROACH:
• Start by asking what the student wants to focus on
• Use the key terminology consistently throughout
• Reference available resources when helpful ("Check the reading for..." or "Try the practice problems...")
• Explain concepts clearly and check understanding
• Be encouraging and adaptive to the student's pace
• Connect learning to real-world applications when possible
• Maintain a warm, supportive teaching style
• KEEP RESPONSES SHORT AND CONVERSATIONAL - this is a dialogue, not a lecture

Keep responses conversational and age-appropriate. Focus on helping the student master the learning goals through engaging dialogue."""
        
        return instruction
        
    except Exception as e:
        logger.error(f"Error building package instruction: {str(e)}")
        return "You are an AI tutor. Be helpful, encouraging, and adaptive."

# ENHANCED: WebSocket endpoint with improved Gemini Live API usage
@router.websocket("/{package_id}/learn")
async def package_learning_session(
    websocket: WebSocket,
    package_id: str = Path(..., description="Content package ID"),
    student_id: Optional[int] = Query(None, description="Student ID for tracking")
):
    """WebSocket endpoint for package-specific tutoring sessions with authentication"""
    
    logger.info(f"🚀 Package learning WebSocket connection initiated for package {package_id}")
    await websocket.accept()
    user_id = None
    user_email = None
    session_start_time = asyncio.get_event_loop().time()
    gemini_session = None
    
    try:
        # Step 1: Authenticate user (same format as daily_briefing_live)
        logger.info("🔐 Waiting for authentication...")
        try:
            auth_message = await asyncio.wait_for(websocket.receive(), timeout=15.0)
        except asyncio.TimeoutError:
            logger.error("❌ Authentication timeout - client didn't send auth message within 15 seconds")
            await websocket.close(code=4001, reason="Authentication timeout")
            return
        except Exception as e:
            logger.error(f"❌ Error receiving authentication message: {e}")
            await websocket.close(code=4000, reason="Connection error")
            return
            
        logger.info(f"🔍 Received message: {auth_message}")  # Debug log
        
        try:
            auth_data = json.loads(auth_message["text"])
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"❌ Invalid authentication message format: {e}")
            await websocket.close(code=4002, reason="Invalid message format")
            return
            
        logger.info(f"🔍 Parsed auth_data: {auth_data}")  # Debug log
        
        if auth_data.get("type") != "authenticate":
            logger.error(f"❌ Authentication type mismatch: expected 'authenticate', got '{auth_data.get('type')}'")
            await websocket.close(code=4001, reason="Authentication required")
            return
        
        # Use same authentication logic as daily_briefing_live
        from firebase_admin import auth
        token = auth_data.get("token", "").replace('Bearer ', '')
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']
        user_email = decoded_token.get('email', 'Unknown')
        logger.info(f"✅ Authentication successful for user {user_id} ({user_email})")
        
        # Get student_id if not provided (same as daily_briefing_live)
        if not student_id:
            logger.info("🔍 Looking up student mapping...")
            from ..db.cosmos_db import cosmos_db
            student_mapping = await cosmos_db.get_student_mapping(user_id)
            student_id = student_mapping["student_id"] if student_mapping else None
            logger.info(f"📝 Student mapping result: {student_id}")
            
            if not student_id:
                logger.error("❌ No student mapping found")
                await websocket.close(code=4001, reason="No student mapping found")
                return
        
        await websocket.send_json({
            "type": "auth_success", 
            "package_id": package_id,
            "message": "Authentication successful"
        })
        logger.info(f"✅ Authentication complete for package {package_id}")
        
        # Step 2: Create session
        session_id = await session_manager.create_session(package_id, user_id, student_id)
        logger.info(f"📝 Session created: {session_id}")
        
        # Step 3: Configure Gemini session
        logger.info("🤖 Configuring Gemini session...")
        system_instruction_text = await build_package_instruction(package_id, user_id, user_email)
        logger.info(f"📋 System instruction prepared (length: {len(system_instruction_text)})")
        
        # Updated Gemini Live configuration (from daily_briefing_live.py)
        config = LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=SpeechConfig(
                voice_config=VoiceConfig(
                    prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=DEFAULT_VOICE)
                )
            ),
            realtime_input_config=types.RealtimeInputConfig(turn_coverage="TURN_INCLUDES_ALL_INPUT"),
            context_window_compression=types.ContextWindowCompressionConfig(
                trigger_tokens=25600,
                sliding_window=types.SlidingWindow(target_tokens=12800),
            ),
            system_instruction=Content(parts=[{"text": system_instruction_text}])
        )
        logger.info("🔧 Gemini config created")
        
        # Step 4: Start Gemini session
        logger.info(f"🚀 Starting Gemini session with model {MODEL}...")
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            gemini_session = session
            gemini_logger.info(f"✅ Gemini session established for package {package_id}")
            
            # Communication queues - simplified approach from daily_briefing_live.py
            text_queue = asyncio.Queue()
            audio_queue = asyncio.Queue()
            
            # Handle messages from client (improved from daily_briefing_live.py)
            async def handle_client_messages():
                while True:
                    try:
                        message = await asyncio.wait_for(websocket.receive(), timeout=5.0)
                        
                        if message.get("type") == "websocket.disconnect":
                            logger.info("🔌 Client disconnected")
                            break
                            
                        if "text" in message:
                            try:
                                data = json.loads(message["text"])
                            except json.JSONDecodeError:
                                # Handle plain string messages (direct text from user)
                                text_content = message["text"]
                                logger.info(f"💬 Received plain text from client: {text_content[:100]}...")
                                await text_queue.put(text_content)
                                await session_manager.log_interaction(
                                    session_id, 
                                    {"type": "student_text", "content": text_content[:100]}
                                )
                                continue
                            
                            # Skip authentication messages since we already handled that
                            if data.get("type") == "authenticate":
                                continue
                            
                            # Handle text-based chat messages
                            if data.get("type") == "text":
                                text_content = data.get("content", "")
                                logger.info(f"💬 Received text from client: {text_content[:100]}...")
                                await text_queue.put(text_content)
                                
                                # Log interaction
                                await session_manager.log_interaction(
                                    session_id, 
                                    {"type": "student_text", "content": text_content[:100]}
                                )
                            
                            # Handle JSON-wrapped audio messages - LESS VERBOSE
                            elif data.get("type") == "audio":
                                base64_data = data.get("data")
                                if base64_data:
                                    # Only log audio reception occasionally to avoid spam
                                    if hasattr(handle_client_messages, '_audio_count'):
                                        handle_client_messages._audio_count += 1
                                    else:
                                        handle_client_messages._audio_count = 1
                                    
                                    # Log every 10th audio message instead of every one
                                    if handle_client_messages._audio_count % 10 == 0:
                                        logger.debug(f"🎤 Received audio batch #{handle_client_messages._audio_count} ({len(base64_data)} chars)")
                                    
                                    # Decode the base64 string back into binary bytes
                                    audio_bytes = base64.b64decode(base64_data)
                                    
                                    # Format the data for the audio queue
                                    audio_data_for_queue = {
                                        "data": audio_bytes,
                                        "mime_type": data.get("mime_type", f"{FORMAT};rate={SEND_SAMPLE_RATE}")
                                    }
                                    await audio_queue.put(audio_data_for_queue)
                            
                            elif data.get("type") == "end_conversation":
                                logger.info("🔚 End conversation signal received")
                                break
                        
                        elif "bytes" in message:
                            # Handle raw binary audio - LESS VERBOSE
                            audio_data = {
                                "data": message["bytes"], 
                                "mime_type": f"{FORMAT};rate={SEND_SAMPLE_RATE}"
                            }
                            # Only log occasionally
                            if not hasattr(handle_client_messages, '_raw_audio_count'):
                                handle_client_messages._raw_audio_count = 0
                            handle_client_messages._raw_audio_count += 1
                            
                            if handle_client_messages._raw_audio_count % 10 == 0:
                                logger.debug(f"🎤 Received raw audio batch #{handle_client_messages._raw_audio_count} ({len(message['bytes'])} bytes)")
                            
                            await audio_queue.put(audio_data)
                            
                    except asyncio.TimeoutError:
                        continue
                    except WebSocketDisconnect:
                        logger.info("🔌 WebSocket disconnected in client handler")
                        break
                    except Exception as e:
                        logger.error(f"❌ Client message error: {str(e)}")
            
            # Send to gemini (improved from daily_briefing_live.py)
            async def send_to_gemini():
                send_count = 0
                while True:
                    try:
                        # Wait for either a text or audio message to become available
                        text_task = asyncio.create_task(text_queue.get())
                        audio_task = asyncio.create_task(audio_queue.get())

                        done, pending = await asyncio.wait(
                            {text_task, audio_task},
                            return_when=asyncio.FIRST_COMPLETED
                        )

                        if text_task in done:
                            text = text_task.result()
                            gemini_logger.info(f"📤 Sending text to Gemini: {text[:100]}...")
                            await session.send(input=text, end_of_turn=True)
                            # If there was a concurrent audio task, put it back in the queue
                            if not audio_task.done():
                                audio_task.cancel()
                            else:
                                audio = audio_task.result()
                                if len(audio.get('data', b'')) > 0:
                                    send_count += 1
                                    # Only log every 10th audio send to reduce spam
                                    if send_count % 10 == 0:
                                        gemini_logger.debug(f"📤 Sending audio batch #{send_count} to Gemini: {len(audio['data'])} bytes")
                                    await session.send(input=audio)

                        if audio_task in done:
                            audio = audio_task.result()
                            if len(audio.get('data', b'')) > 0:
                                send_count += 1
                                # Only log every 10th audio send to reduce spam
                                if send_count % 10 == 0:
                                    gemini_logger.debug(f"📤 Sending audio batch #{send_count} to Gemini: {len(audio['data'])} bytes")
                                await session.send(input=audio)
                            if not text_task.done():
                                text_task.cancel()

                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        gemini_logger.error(f"❌ Gemini send error: {str(e)}")
            
            # Receive responses from Gemini - MAKE NON-BLOCKING (from daily_briefing_live.py)
            async def receive_from_gemini():
                audio_receive_count = 0
                while True:
                    try:
                        turn = session.receive()
                        async for response in turn:
                            # Check if response has server_content with model_turn
                            if hasattr(response, 'server_content') and response.server_content:
                                # Handle model turn with parts
                                if hasattr(response.server_content, 'model_turn') and response.server_content.model_turn:
                                    model_turn = response.server_content.model_turn
                                    if hasattr(model_turn, 'parts') and model_turn.parts:
                                        for part in model_turn.parts:
                                            # Handle text parts
                                            if hasattr(part, 'text') and part.text:
                                                gemini_logger.info(f"📥 Received text from Gemini: {part.text[:100]}...")
                                                
                                                # Send without awaiting to prevent blocking
                                                asyncio.create_task(websocket.send_json({
                                                    "type": "text",
                                                    "content": part.text,
                                                    "package_id": package_id,
                                                    "session_id": session_id
                                                }))
                                                
                                                # Log AI response
                                                asyncio.create_task(session_manager.log_interaction(
                                                    session_id,
                                                    {"type": "ai_response", "content": part.text[:100]}
                                                ))
                                            
                                            # Handle inline_data (audio) parts - MUCH LESS VERBOSE
                                            elif hasattr(part, 'inline_data') and part.inline_data:
                                                if hasattr(part.inline_data, 'data') and part.inline_data.data:
                                                    audio_receive_count += 1
                                                    # Only log every 20th audio message to significantly reduce spam
                                                    if audio_receive_count % 20 == 0:
                                                        gemini_logger.debug(f"📥 Received audio batch #{audio_receive_count} from Gemini: {len(part.inline_data.data)} bytes")
                                                    
                                                    audio_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                                                    
                                                    # Send without awaiting to prevent blocking
                                                    asyncio.create_task(websocket.send_json({
                                                        "type": "audio",
                                                        "format": "raw-pcm",
                                                        "sampleRate": RECEIVE_SAMPLE_RATE,
                                                        "bitsPerSample": 16,
                                                        "channels": CHANNELS,
                                                        "data": audio_b64
                                                    }))
                                
                                # Handle input transcription
                                if hasattr(response.server_content, 'input_transcription') and response.server_content.input_transcription:
                                    if hasattr(response.server_content.input_transcription, 'text') and response.server_content.input_transcription.text:
                                        logger.info(f"🎤 User transcription: {response.server_content.input_transcription.text}")
                                        
                                        # Send without awaiting to prevent blocking
                                        asyncio.create_task(websocket.send_json({
                                            "type": "input_transcription",
                                            "content": response.server_content.input_transcription.text
                                        }))
                                
                                # Handle output transcription  
                                if hasattr(response.server_content, 'output_transcription') and response.server_content.output_transcription:
                                    if hasattr(response.server_content.output_transcription, 'text') and response.server_content.output_transcription.text:
                                        logger.info(f"🎯 AI transcription: {response.server_content.output_transcription.text}")
                                        
                                        # Send without awaiting to prevent blocking
                                        asyncio.create_task(websocket.send_json({
                                            "type": "output_transcription", 
                                            "content": response.server_content.output_transcription.text
                                        }))
                                        
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        gemini_logger.error(f"❌ Gemini receive error: {str(e)}")
                        break
            
            # Start all communication tasks
            tasks = [
                asyncio.create_task(handle_client_messages()),
                asyncio.create_task(send_to_gemini()),
                asyncio.create_task(receive_from_gemini())
            ]
            
            # Send welcome message to start conversation
            gemini_logger.info("🚀 Sending welcome message to Gemini...")
            welcome_message = await create_welcome_message(package_id, user_email)
            await session.send(input=welcome_message, end_of_turn=True)
            gemini_logger.info("✅ Welcome message sent")
            
            # Wait for any task to complete (usually means session ended)
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            
            # Clean up remaining tasks
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
    
    except Exception as e:
        logger.error(f"❌ Package learning session error: {str(e)}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"Session error: {str(e)}"
            })
        except:
            pass
    
    finally:
        session_duration = asyncio.get_event_loop().time() - session_start_time
        logger.info(f"🏁 Package learning session completed for package {package_id} ({session_duration:.1f}s)")
        if gemini_session:
            gemini_logger.info("🔚 Gemini session ended")
        
        # Cleanup session
        if 'session_id' in locals():
            await session_manager.end_session(session_id)
        
        # Disconnect from connection manager
        try:
            connection_manager.disconnect(websocket, user_id)
        except Exception as e:
            logger.error(f"Error during disconnection: {str(e)}")

async def create_welcome_message(package_id: str, user_email: str) -> str:
    """Create welcome message based on package content"""
    try:
        package = await cosmos_db.get_content_package_by_id(package_id)
        if package:
            title = package.get('content', {}).get('reading', {}).get('title', 'this lesson')
            welcome = f"Hi! I'm here to help you learn about {title}. What would you like to explore first?"
        else:
            welcome = "Hi! I'm your AI tutor. What would you like to learn about today?"
        
        logger.info(f"💬 Welcome message created: {welcome}")
        return welcome
        
    except Exception as e:
        logger.error(f"Error creating welcome message: {str(e)}")
        return "Hi! I'm your AI tutor. What would you like to learn about today?"

# Content package browsing endpoints (unchanged but with better error handling)
@router.get("/content-packages")
async def get_content_packages(
    user_context: dict = Depends(get_user_context),
    subject: Optional[str] = Query(None),
    skill: Optional[str] = Query(None), 
    subskill: Optional[str] = Query(None),
    status: str = Query("approved"),
    limit: int = Query(50)
):
    """Get available content packages with filtering"""
    try:
        logger.info(f"📦 User {user_context['email']} browsing content packages")
        
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
async def get_content_package_details(
    package_id: str,
    user_context: dict = Depends(get_user_context),
    problem_service: ProblemService = Depends(get_problem_service)
):
    """Get detailed information about a specific content package with aggregated visuals"""
    try:
        logger.info(f"📦 User {user_context['email']} viewing package {package_id}")
        
        package = await cosmos_db.get_content_package_by_id(package_id)
        
        if not package:
            raise HTTPException(status_code=404, detail="Content package not found")
        
        # ============================================================================
        # DYNAMIC PROBLEM HYDRATION - TEMPORARILY DISABLED
        # ============================================================================
        # 
        # DISABLED: This section was overriding stored problems from Cosmos DB with dynamic ones.
        # The frontend will now receive the actual cached problems stored in the database.
        # 
        # # Check if package has practice problems to hydrate
        # if package.get("content", {}).get("practice", {}).get("problems"):
        #     try:
        #         logger.info(f"💧 Hydrating practice problems for package: {package_id}")
        #         
        #         practice_blueprint = package["content"]["practice"]
        #         subskill_id = package.get("subskill_id")
        #         subject = package.get("subject")
        #         problem_count = practice_blueprint.get("problem_count", 8)
        #         
        #         # Get user's student_id for personalized problem generation
        #         firebase_uid = user_context.get('uid')
        #         student_mapping = await cosmos_db.get_student_mapping(firebase_uid) if firebase_uid else None
        #         student_id = student_mapping["student_id"] if student_mapping else 1  # Default fallback
        #         
        #         if subskill_id and subject:
        #             # Call ProblemService to get fresh set of problems
        #             new_problems = await problem_service.get_skill_problems(
        #                 student_id=student_id,
        #                 subject=subject,
        #                 skill_id=package.get("skill_id", ""),
        #                 subskill_id=subskill_id,
        #                 count=problem_count
        #             )
        #             
        #             if new_problems:
        #                 # Transform problems to match the expected format
        #                 formatted_problems = []
        #                 for i, problem_data in enumerate(new_problems):
        #                     formatted_problem = {
        #                         "id": f"{package_id}_dynamic_{i+1}",
        #                         "problem_id": f"dyn_{subskill_id}_{i+1}",
        #                         "type": "dynamic",
        #                         "subject": subject,
        #                         "skill_id": package.get("skill_id", ""),
        #                         "subskill_id": subskill_id,
        #                         "difficulty": problem_data.get("metadata", {}).get("difficulty", 5),
        #                         "timestamp": package.get("created_at", ""),
        #                         "problem_data": problem_data
        #                     }
        #                     formatted_problems.append(formatted_problem)
        #                 
        #                 # Replace static problems with dynamic ones
        #                 package["content"]["practice"]["problems"] = formatted_problems
        #                 package["content"]["practice"]["problem_count"] = len(formatted_problems)
        #                 
        #                 logger.info(f"✅ Successfully replaced static problems with {len(formatted_problems)} dynamic problems")
        #             else:
        #                 logger.warning(f"⚠️ ProblemService returned no problems for {subskill_id}. Keeping static problems.")
        #         else:
        #             logger.warning(f"⚠️ Missing subskill_id or subject for dynamic hydration. Keeping static problems.")
        #             
        #     except Exception as e:
        #         logger.error(f"❌ Error hydrating dynamic problems for {package_id}: {e}. Falling back to static problems.")
        #         # Continue with static problems on error
        
        logger.info(f"📦 Using stored problems from Cosmos DB for package: {package_id}")
        
        # ============================================================================
        # VISUAL AGGREGATION (Existing Logic)
        # ============================================================================
        
        # Aggregate visuals: combine existing visuals + saved visualize concepts
        visuals = []
        
        # Add existing visuals if they exist (support both single visual and multiple visuals)
        content = package.get("content", {})
        
        # Check if there are multiple visuals already stored in content.visuals
        if content.get("visuals") and isinstance(content["visuals"], list):
            logger.info(f"📋 Found {len(content['visuals'])} existing visuals in content.visuals")
            for existing_visual in content["visuals"]:
                visuals.append({
                    "description": existing_visual.get("description", "Interactive Visualization"),
                    "p5_code": existing_visual.get("p5_code", ""),
                    "interactive_elements": existing_visual.get("interactive_elements", [])
                })
        
        # Also check for legacy single visual in content.visual (for backward compatibility)
        elif content.get("visual"):
            logger.info(f"📋 Found 1 existing visual in content.visual (legacy format)")
            existing_visual = content["visual"]
            visuals.append({
                "description": existing_visual.get("description", "Interactive Visualization"),
                "p5_code": existing_visual.get("p5_code", ""),
                "interactive_elements": existing_visual.get("interactive_elements", [])
            })
        
        # Add saved visualize concepts for this subskill
        if package.get("subskill_id"):
            try:
                saved_concepts = await cosmos_db.get_visualize_concepts_by_subskill(
                    package["subskill_id"], 
                    firebase_uid=None  # System-wide, not per user
                )
                
                for concept in saved_concepts:
                    # Use html_content as p5_code for consistency with VisualContent component
                    visuals.append({
                        "description": concept.get("section_heading", "Generated Visualization"),
                        "p5_code": concept.get("html_content", ""),
                        "interactive_elements": ["interactive_demo", "ai_generated"]
                    })
                    
                logger.info(f"🎨 Added {len(saved_concepts)} saved visualize concepts to package {package_id}")
            except Exception as e:
                logger.warning(f"⚠️ Could not fetch saved visualize concepts: {str(e)}")
        
        # Add visuals array to package content
        if visuals:
            if "content" not in package:
                package["content"] = {}
            package["content"]["visuals"] = visuals
            logger.info(f"✅ Package {package_id} now has {len(visuals)} visuals available")
        
        return {
            "status": "success",
            "package": package
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting content package details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving content package: {str(e)}")

@router.get("/packages/find-by-curriculum/{curriculum_id}")
async def find_package_by_curriculum_id(
    curriculum_id: str,
    user_context: dict = Depends(get_user_context)
):
    """Find a content package by curriculum ID (e.g., rec-COUNT001-01-A)"""
    try:
        from ..services.daily_activities import CurriculumParser
        
        logger.info(f"🔍 User {user_context['email']} finding package for curriculum ID: {curriculum_id}")
        
        # Parse the curriculum ID to extract subject, unit, skill, subskill
        curriculum_data = CurriculumParser.parse_activity_id(curriculum_id)
        if not curriculum_data:
            raise HTTPException(status_code=400, detail=f"Invalid curriculum ID format: {curriculum_id}")
        
        # Extract the components
        subject = curriculum_data.get('subject')
        unit_id = curriculum_data.get('unit_id')  
        skill_id = curriculum_data.get('skill_id')
        subskill_id = curriculum_data.get('subskill_id')
        
        # Try to find matching content package
        packages = await cosmos_db.get_content_packages(
            subject=subject,
            limit=10  # Get a few to find the best match
        )
        
        # Filter packages that might match the curriculum structure
        matching_packages = []
        for package in packages:
            # Check if this package matches our curriculum structure
            pkg_skill = package.get('skill', '')
            pkg_subskill = package.get('subskill', '')
            
            # Look for packages that contain our skill/subskill pattern
            if (skill_id and skill_id in pkg_skill) or (subskill_id and subskill_id in pkg_subskill):
                matching_packages.append(package)
        
        if not matching_packages:
            # If no exact match, return the first available package for the subject
            if packages:
                matching_packages = [packages[0]]
            else:
                raise HTTPException(status_code=404, detail=f"No content package found for curriculum: {curriculum_id}")
        
        # Return the best match
        best_match = matching_packages[0]
        
        logger.info(f"✅ Found package {best_match.get('id')} for curriculum {curriculum_id}")
        
        return {
            "status": "success",
            "package_id": best_match.get("id"),
            "package": best_match,
            "curriculum_mapping": {
                "curriculum_id": curriculum_id,
                "subject": subject,
                "unit_id": unit_id,
                "skill_id": skill_id,
                "subskill_id": subskill_id
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding package by curriculum ID: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error finding package: {str(e)}")

# Health check endpoint
@router.get("/health")
async def package_learning_health_check():
    """Health check for package learning service"""
    try:
        return {
            "status": "healthy",
            "service": "package_learning_enhanced",
            "active_sessions": len(session_manager.active_sessions),
            "active_connections": len(connection_manager.active_connections),
            "gemini_model": MODEL,
            "audio_format": FORMAT,
            "features": {
                "authentication": True,
                "activity_logging": True,
                "session_tracking": True,
                "audio_support": True,
                "text_support": True,
                "non_blocking_websocket": True,
                "enhanced_gemini_api": True
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "package_learning_enhanced",
            "error": str(e)
        }