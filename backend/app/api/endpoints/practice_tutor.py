# backend/app/api/endpoints/practice_tutor.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
import traceback

from google import genai
from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig, Content

from ...core.config import settings
from ...core.middleware import get_user_context
from ...db.cosmos_db import CosmosDBService

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
)
logger = logging.getLogger(__name__)

# Create separate logger for Gemini interactions
gemini_logger = logging.getLogger('gemini_practice_tutor')
gemini_logger.setLevel(logging.INFO)

# Suppress verbose logging
websockets_logger = logging.getLogger('websockets')
websockets_logger.setLevel(logging.WARNING)

google_genai_logger = logging.getLogger('google_genai')
google_genai_logger.setLevel(logging.WARNING)

# Gemini configuration
client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options={"api_version": "v1alpha"},
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
        
        logger.info(f"✅ Practice Tutor WebSocket user authenticated: {decoded_token.get('email')}")
        return decoded_token
        
    except Exception as e:
        logger.error(f"❌ Practice Tutor WebSocket authentication error: {str(e)}")
        raise Exception("Invalid authentication token")

async def build_topic_tutor_instruction(topic_context: dict) -> str:
    """Builds the main system instruction based on the educational hierarchy."""
    subject = topic_context.get("subject", "learning")
    skill_desc = topic_context.get("skill_description", "the current topic")
    subskill_desc = topic_context.get("subskill_description", "the specific concepts")
    skill_id = topic_context.get("skill_id", "")
    subskill_id = topic_context.get("subskill_id", "")

    instruction = f"""You are an expert AI Practice Tutor for a K-12 student.

**SESSION TOPIC:**
- **Subject:** {subject}
- **Skill:** {skill_desc} (ID: {skill_id})
- **Focus Area:** {subskill_desc} (ID: {subskill_id})

**YOUR CORE ROLE:**
You are a patient, encouraging, and Socratic guide for this entire practice session. Your goal is to help the student build confidence and understanding through practice problems related to this specific topic.

**MANDATORY RULES:**
1. **NEVER give the direct answer to a problem.** Guide, hint, and ask leading questions.
2. **Follow instructions for each turn precisely.** Sometimes you will be asked to read a problem; do that first before doing anything else.
3. **Keep responses short, conversational, and use frequent pauses in your speech.**
4. **Be encouraging.** Praise effort and good thinking, even when answers are incorrect.
5. **Use Socratic questioning.** Ask leading questions that help students discover the answer themselves.

**INTERACTION STYLE:**
- Speak in a warm, supportive teacher voice
- Use age-appropriate language for K-12 students
- Break complex explanations into small, digestible pieces
- Ask "What do you think?" frequently to engage the student
- Celebrate small wins and progress

**PROBLEM INTRODUCTION PROTOCOL:**
When you receive a new problem, your FIRST and ONLY task is to:
1. Read the problem text aloud clearly
2. If there are multiple choice options, read them aloud
3. Then pause and wait for the student to respond or ask for help

**HINT PROTOCOL:**
When asked for a hint:
1. Give the smallest possible nudge toward the solution
2. Ask a guiding question rather than stating facts
3. If the student is still stuck, provide one more level of guidance
4. Never give away the complete answer

**CONCEPT EXPLANATION PROTOCOL:**
When asked to explain a concept:
1. Start with the most fundamental idea
2. Use simple analogies or real-world examples
3. Check for understanding before adding complexity
4. Connect back to the current problem

Remember: You are here to guide learning, not to solve problems for the student. Every interaction should build their confidence and problem-solving skills.
"""
    return instruction

@router.websocket("/ws/practice-tutor")
async def practice_tutor_session(websocket: WebSocket):
    """
    WebSocket endpoint for AI Practice Tutor sessions.
    Handles session-level context and problem-level interactions.
    """
    await websocket.accept()
    logger.info("🎯 Practice Tutor WebSocket connection accepted")
    
    gemini_session = None
    user_context = None
    
    try:
        # 1. AUTHENTICATION & SESSION CONTEXT
        logger.info("⏳ Waiting for authentication message...")
        init_message = await asyncio.wait_for(websocket.receive_json(), timeout=15.0)
        
        if init_message.get("type") != "authenticate":
            await websocket.close(code=4001, reason="First message must be authentication")
            return
            
        # Authenticate the user
        token = init_message.get("token")
        if not token:
            await websocket.close(code=4002, reason="Authentication token required")
            return
            
        try:
            user_context = await authenticate_websocket_token(token)
            logger.info(f"✅ User authenticated: {user_context.get('email')}")
        except Exception as e:
            await websocket.close(code=4003, reason=f"Authentication failed: {str(e)}")
            return

        # Get topic context from the authentication message
        topic_context = init_message.get("topic_context")
        if not topic_context:
            await websocket.close(code=4004, reason="Topic context is required")
            return

        await websocket.send_json({
            "type": "auth_success", 
            "message": "Practice Tutor connected and ready for the session."
        })

        # 2. BUILD MAIN SYSTEM PROMPT
        system_instruction = await build_topic_tutor_instruction(topic_context)
        logger.info(f"📋 System instruction built for {topic_context.get('subject', 'unknown')} - {topic_context.get('skill_description', 'unknown skill')}")

        # 3. CONFIGURE AND START GEMINI SESSION
        speech_config = SpeechConfig(
            voice_config=VoiceConfig(
                prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=DEFAULT_VOICE)
            )
        )
        
        # Fixed: Use only AUDIO response modality
        config = LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=speech_config,
            system_instruction=Content(parts=[{"text": system_instruction}])
        )
        
        logger.info("🎤 Starting Gemini Live session for practice tutoring...")
        
        logger.info("🔄 About to create Gemini Live session...")
        
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            gemini_session = session
            logger.info("✅ Gemini Live session connected successfully")
            
            # Send initial success message to client
            await websocket.send_json({
                "type": "session_ready", 
                "message": "AI Tutor session is ready"
            })
            
            # Create queues for communication
            text_queue = asyncio.Queue()
            audio_queue = asyncio.Queue()
            
            # Task management
            tasks = []
            
            async def handle_client_messages():
                """Handle messages from the frontend client"""
                try:
                    while True:
                        message = await websocket.receive_json()
                        message_type = message.get("type")
                        
                        logger.info(f"📨 Received client message: {message_type}")
                        
                        if message_type == "new_problem":
                            # Handle new problem introduction
                            problem = message.get("problem_context", {})
                            problem_data = problem.get("problem_data", {})
                            
                            # Extract problem text and options
                            problem_text = (
                                problem_data.get("question") or 
                                problem_data.get("problem") or 
                                problem_data.get("prompt") or 
                                problem_data.get("statement") or
                                problem_data.get("text_with_blanks") or
                                "No problem text found."
                            )
                            
                            options = problem_data.get("options", [])
                            
                            # Build dynamic turn-based instruction
                            prompt_for_gemini = f"""The student has moved to a new problem. Your first and only task right now is to read the following problem aloud clearly. After reading it, wait for the student to respond or ask for help. Do not solve it or provide any guidance yet.

Problem: "{problem_text}" """
                            
                            if options:
                                if isinstance(options[0], dict):
                                    # MCQ format with id/text structure
                                    options_text = ". ".join([f"Option {chr(65+i)}: {opt.get('text', opt)}" for i, opt in enumerate(options)])
                                else:
                                    # Simple array format
                                    options_text = ". ".join([f"Option {chr(65+i)}: {opt}" for i, opt in enumerate(options)])
                                prompt_for_gemini += f"The available options are: {options_text}"
                            
                            # Send instruction to Gemini
                            await text_queue.put(prompt_for_gemini)
                            
                        elif message_type == "text":
                            # Handle regular text interaction
                            content = message.get("content", "")
                            await text_queue.put(content)
                            
                        elif message_type == "hint_request":
                            # Handle hint request
                            await text_queue.put("Can you give me a hint to help me think through this problem?")
                            
                        elif message_type == "concept_explanation":
                            # Handle concept explanation request
                            await text_queue.put("Can you explain the main concept behind this problem?")
                            
                        elif message_type == "check_work":
                            # Handle work checking request
                            work_description = message.get("work_description", "my work")
                            await text_queue.put(f"Can you look at {work_description} and help me check if I'm on the right track?")
                            
                        elif message_type == "result_feedback":
                            # Handle answer result feedback
                            is_correct = message.get("is_correct", False)
                            score = message.get("score", 0)
                            content = message.get("content", "")
                            
                            if is_correct:
                                prompt = f"The student got the problem correct with a score of {score}/10! Please give them encouraging praise and briefly explain what they did well. Keep it enthusiastic but concise."
                            else:
                                prompt = f"The student got the problem wrong with a score of {score}/10. Please give them gentle encouragement, remind them that mistakes help us learn, and offer to help them understand what went wrong. Be supportive and motivating."
                            
                            await text_queue.put(prompt)
                            
                        elif message_type == "audio":
                            # Handle audio input
                            audio_data = message.get("audio_data")
                            if audio_data:
                                await audio_queue.put(audio_data)
                                
                except WebSocketDisconnect:
                    logger.info("🔌 Client disconnected")
                except Exception as e:
                    logger.error(f"❌ Error in client message handler: {e}")
                    await websocket.close(code=1011, reason="Internal server error")

            async def handle_text_to_gemini():
                """Send text messages to Gemini"""
                try:
                    while True:
                        text = await text_queue.get()
                        logger.info(f"📤 Sending text to Gemini: {text[:100]}...")
                        await session.send(input=text, end_of_turn=True)
                except Exception as e:
                    logger.error(f"❌ Error sending text to Gemini: {e}")

            async def handle_audio_to_gemini():
                """Send audio data to Gemini"""
                try:
                    while True:
                        audio_data = await audio_queue.get()
                        if isinstance(audio_data, str):
                            # Decode base64 audio data
                            import base64
                            audio_bytes = base64.b64decode(audio_data)
                            await session.send(input={"mime_type": FORMAT, "data": audio_bytes})
                        else:
                            await session.send(input={"mime_type": FORMAT, "data": audio_data})
                except Exception as e:
                    logger.error(f"❌ Error sending audio to Gemini: {e}")

            async def handle_gemini_responses():
                """Handle responses from Gemini and send to client"""
                try:
                    async for response in session.receive():
                        if response.data:
                            # Handle audio response
                            import base64
                            audio_b64 = base64.b64encode(response.data).decode()
                            await websocket.send_json({
                                "type": "audio_response",
                                "audio_data": audio_b64
                            })
                            
                        # Note: With AUDIO-only modality, we won't get text responses
                        # The frontend will need to handle audio-only interactions
                            
                except Exception as e:
                    logger.error(f"❌ Error handling Gemini responses: {e}")

            # Start all communication tasks
            tasks.append(asyncio.create_task(handle_client_messages()))
            tasks.append(asyncio.create_task(handle_text_to_gemini()))
            tasks.append(asyncio.create_task(handle_audio_to_gemini()))
            tasks.append(asyncio.create_task(handle_gemini_responses()))
            
            logger.info("🚀 All practice tutor communication tasks started")
            
            # Wait for any task to complete (usually means an error or disconnect)
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            
            # Cancel remaining tasks
            for task in pending:
                task.cancel()
                
            # Check for any exceptions
            for task in done:
                if task.exception():
                    logger.error(f"❌ Task failed with exception: {task.exception()}")
                    
    except WebSocketDisconnect:
        logger.info("🔌 Practice Tutor WebSocket disconnected")
    except asyncio.TimeoutError:
        logger.error("⏰ Authentication timeout in practice tutor session")
        try:
            await websocket.close(code=4008, reason="Authentication timeout")
        except:
            pass
    except Exception as e:
        logger.error(f"❌ Practice tutor session error: {e}")
        logger.error(f"❌ Full traceback: {traceback.format_exc()}")
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except:
            pass
    finally:
        if gemini_session:
            try:
                await gemini_session.end()
                logger.info("🔚 Gemini session ended")
            except:
                pass
        logger.info("🔚 Practice tutor session cleanup completed")