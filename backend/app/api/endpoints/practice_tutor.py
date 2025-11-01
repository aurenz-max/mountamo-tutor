# backend/app/api/endpoints/practice_tutor.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
import traceback

from google import genai
from google.genai import types  # Add this import for types module
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
    http_options={"api_version": "v1beta"},
)

DEFAULT_VOICE = "Leda"
MODEL = "gemini-2.5-flash-native-audio-preview-09-2025"

# Audio constants
FORMAT = "audio/pcm"
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHANNELS = 1

# Router setup
router = APIRouter()

# Initialize Cosmos DB service
cosmos_db = CosmosDBService()

# Helper function for evaluating live interaction targets
def evaluate_target_interaction(problem: Optional[dict], selected_target_id: str) -> dict:
    """
    Evaluates if the selected target is correct based on interaction_config.

    Args:
        problem: The live_interaction problem object
        selected_target_id: The ID of the element the student clicked/selected

    Returns:
        Dict with: correct (bool), feedback_audio (str), visual_effect (str), hint (str)
    """
    if not problem or problem.get('problem_type') != 'live_interaction':
        return {"error": "Not a live interaction problem"}

    interaction_config = problem.get('interaction_config', {})
    targets = interaction_config.get('targets', [])

    # Find the target that was selected
    for target in targets:
        if target['id'] == selected_target_id:
            is_correct = target['is_correct']
            feedback_key = "correct" if is_correct else "incorrect"
            feedback = problem['evaluation']['feedback'][feedback_key]

            return {
                "correct": is_correct,
                "feedback_audio": feedback['audio'],
                "visual_effect": feedback.get('visual_effect', 'none'),
                "target_id": selected_target_id,
                "hint": feedback.get('hint') if not is_correct else None
            }

    return {"error": f"Target '{selected_target_id}' not found in interaction_config"}

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

async def build_topic_tutor_instruction(topic_context: dict, live_problem: Optional[dict] = None) -> str:
    """Builds the system instruction, prioritizing live problem's prompt if available."""

    # PRIORITY 1: If this is a live interaction problem, use its specific system prompt
    if live_problem and live_problem.get('problem_type') == 'live_interaction':
        problem_prompt = live_problem.get('prompt', {})
        system_instruction = problem_prompt.get('system', "You are an expert AI Practice Tutor.")
        logger.info(f"✅ Using LIVE INTERACTION system prompt: {system_instruction[:100]}...")
        return system_instruction

    # PRIORITY 2: Fall back to topic-based instruction
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

@router.websocket("/practice-tutor")
async def practice_tutor_session(websocket: WebSocket):
    """
    WebSocket endpoint for AI Practice Tutor sessions.
    Uses same authentication flow as daily briefing for consistent audio support.
    """
    logger.info(f"🔗 Practice Tutor WebSocket connection attempt from: {websocket.client}")
    
    await websocket.accept()
    logger.info("🎯 Practice Tutor WebSocket connection accepted")
    
    gemini_session = None
    user_context = None
    
    try:
        # Step 1: Authenticate user (same as daily briefing)
        logger.info("🔐 Waiting for authentication...")
        auth_message = await asyncio.wait_for(websocket.receive(), timeout=10.0)
        auth_data = json.loads(auth_message["text"])
        
        if auth_data.get("type") != "authenticate":
            logger.error("❌ Authentication type mismatch")
            await websocket.close(code=4001, reason="Authentication required")
            return
        
        # Authenticate using Firebase (same as daily briefing)
        from firebase_admin import auth
        token = auth_data.get("token", "").replace('Bearer ', '')
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']
        user_email = decoded_token.get('email', 'Unknown')
        logger.info(f"✅ Authentication successful for user {user_id} ({user_email})")

        # Extract live problem context if provided
        live_problem = auth_data.get("problem_context")
        topic_context = {}

        if live_problem and live_problem.get('problem_type') == 'live_interaction':
            logger.info("🚀 Initializing LIVE INTERACTION session")
            # Extract topic context from problem metadata
            metadata = live_problem.get('metadata', {})
            topic_context = {
                "subject": metadata.get("subject", "General"),
                "skill_description": metadata.get("skill", {}).get("description", "live skill"),
                "subskill_description": metadata.get("subskill", {}).get("description", "live subskill"),
                "skill_id": metadata.get("skill", {}).get("id", ""),
                "subskill_id": metadata.get("subskill", {}).get("id", "")
            }
        else:
            logger.info("🚀 Initializing standard TOPIC TUTOR session")
            live_problem = None
            topic_context = auth_data.get("topic_context", {
                "subject": "mathematics",
                "skill_id": "",
                "subskill_id": ""
            })

        await websocket.send_json({
            "type": "auth_success",
            "message": "Practice Tutor connected and ready for the session."
        })
        logger.info("✅ Authentication complete for practice tutor")

        # Step 2: Build system instruction (now problem-aware)
        system_instruction = await build_topic_tutor_instruction(topic_context, live_problem)
        logger.info(f"📋 System instruction built for {topic_context.get('subject', 'unknown')} - {topic_context.get('skill_description', 'unknown skill')}")

        # Step 3: Configure Gemini session
        speech_config = SpeechConfig(
            voice_config=VoiceConfig(
                prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=DEFAULT_VOICE)
            )
        )
        
        # Fixed: Use only AUDIO response modality with complete configuration
        config = LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=speech_config,
            realtime_input_config=types.RealtimeInputConfig(turn_coverage="TURN_INCLUDES_ALL_INPUT"),
            context_window_compression=types.ContextWindowCompressionConfig(
                trigger_tokens=25600,
                sliding_window=types.SlidingWindow(target_tokens=12800),
            ),
            system_instruction=Content(parts=[{"text": system_instruction}])
        )
        
        logger.info("🎤 Starting Gemini Live session for practice tutoring...")
        
        logger.info("🔄 About to create Gemini Live session...")
        
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            gemini_session = session
            logger.info("✅ Gemini Live session connected successfully")
            
            # Send initial success message to client (non-blocking)
            asyncio.create_task(websocket.send_json({
                "type": "session_ready",
                "message": "AI Tutor session is ready"
            }))

            # Create queues for communication
            text_queue = asyncio.Queue()
            audio_queue = asyncio.Queue()

            # NEW: If this is a live interaction, send the initial instruction
            if live_problem and live_problem.get('prompt', {}).get('instruction'):
                initial_instruction = live_problem['prompt']['instruction']
                await text_queue.put(
                    f"Your first and only task is to read this instruction to the student exactly as written, "
                    f"then wait for their response. Do not add anything else. "
                    f"Instruction: '{initial_instruction}'"
                )
                logger.info(f"✅ Initial LIVE INTERACTION prompt queued: '{initial_instruction}'")
            else:
                # Standard greeting for topic tutoring
                await text_queue.put(
                    "Start the session by greeting the student warmly and letting them "
                    "know you're ready to help with their practice problems."
                )
                logger.info("✅ Initial generic greeting prompt queued")

            # Task management
            tasks = []

            async def handle_client_messages():
                """Handle messages from the frontend client"""
                try:
                    while True:
                        message = await websocket.receive_json()
                        message_type = message.get("type")
                        
                        logger.info(f"📨 Received client message: {message_type}")

                        # NEW: Handle live interaction target selection
                        if message_type == "target_selected":
                            target_id = message.get("target_id")
                            result = evaluate_target_interaction(live_problem, target_id)

                            if result.get("error"):
                                logger.error(f"❌ Target evaluation error: {result['error']}")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": result["error"]
                                })
                            elif result["correct"]:
                                # Correct answer - tell AI and send visual feedback
                                await text_queue.put(
                                    f"The student selected the correct answer! {result['feedback_audio']}"
                                )
                                await websocket.send_json({
                                    "type": "visual_feedback",
                                    "effect": result["visual_effect"],
                                    "target_id": target_id,
                                    "correct": True
                                })
                            else:
                                # Incorrect answer - give feedback and hint
                                feedback_msg = result['feedback_audio']
                                if result.get('hint'):
                                    feedback_msg += f" {result['hint']}"

                                await text_queue.put(feedback_msg)
                                await websocket.send_json({
                                    "type": "visual_feedback",
                                    "effect": result["visual_effect"],
                                    "target_id": target_id,
                                    "correct": False
                                })
                            continue

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
                    # Keep the session alive by continuously listening for turns
                    while True:
                        # The 'async for' loop now correctly handles chunks within a single turn
                        async for response in session.receive():
                            # Correctly parse the complex response object
                            if hasattr(response, 'server_content') and response.server_content:
                                # Handle model turn (AI speaking)
                                if hasattr(response.server_content, 'model_turn') and response.server_content.model_turn:
                                    model_turn = response.server_content.model_turn
                                    if hasattr(model_turn, 'parts') and model_turn.parts:
                                        for part in model_turn.parts:
                                            # Handle text parts
                                            if hasattr(part, 'text') and part.text:
                                                gemini_logger.info(f"📥 Received text from Gemini: {part.text[:100]}...")

                                                # Send without awaiting to prevent blocking
                                                asyncio.create_task(websocket.send_json({
                                                    "type": "ai_text",
                                                    "content": part.text
                                                }))

                                            # Handle audio data
                                            elif hasattr(part, 'inline_data') and part.inline_data and hasattr(part.inline_data, 'data') and part.inline_data.data:
                                                import base64
                                                audio_b64 = base64.b64encode(part.inline_data.data).decode()

                                                # Send without awaiting to prevent blocking
                                                asyncio.create_task(websocket.send_json({
                                                    "type": "ai_audio",
                                                    "format": "raw-pcm",
                                                    "sampleRate": RECEIVE_SAMPLE_RATE,
                                                    "bitsPerSample": 16,
                                                    "channels": CHANNELS,
                                                    "data": audio_b64
                                                }))

                                # Handle user's speech transcription
                                if hasattr(response.server_content, 'input_transcription') and response.server_content.input_transcription:
                                    if hasattr(response.server_content.input_transcription, 'text') and response.server_content.input_transcription.text:
                                        logger.info(f"🎤 User transcription: {response.server_content.input_transcription.text}")

                                        # Send without awaiting to prevent blocking
                                        asyncio.create_task(websocket.send_json({
                                            "type": "user_transcription",
                                            "content": response.server_content.input_transcription.text
                                        }))

                                # Handle output transcription
                                if hasattr(response.server_content, 'output_transcription') and response.server_content.output_transcription:
                                    if hasattr(response.server_content.output_transcription, 'text') and response.server_content.output_transcription.text:
                                        logger.info(f"🎯 AI transcription: {response.server_content.output_transcription.text}")

                                        # Send without awaiting to prevent blocking
                                        asyncio.create_task(websocket.send_json({
                                            "type": "ai_transcription",
                                            "content": response.server_content.output_transcription.text
                                        }))

                                # Check for the end of the AI's turn to update UI state
                                if hasattr(response.server_content, 'end_of_turn') and response.server_content.end_of_turn:
                                    logger.info("✅ AI turn finished.")

                                    # Send without awaiting to prevent blocking
                                    asyncio.create_task(websocket.send_json({"type": "ai_turn_end"}))

                except WebSocketDisconnect:
                    logger.info("🔌 WebSocket disconnected while receiving from Gemini.")
                except asyncio.CancelledError:
                    logger.info("🚫 Gemini response handler task was cancelled.")
                except Exception as e:
                    logger.error(f"❌ Error handling Gemini responses: {e}")
                    logger.error(f"❌ Full traceback: {traceback.format_exc()}")

            # Start all communication tasks
            tasks.append(asyncio.create_task(handle_client_messages()))
            tasks.append(asyncio.create_task(handle_text_to_gemini()))
            tasks.append(asyncio.create_task(handle_audio_to_gemini()))
            tasks.append(asyncio.create_task(handle_gemini_responses()))
            
            logger.info("🚀 All practice tutor communication tasks started")

            # INITIATE THE CONVERSATION FROM THE BACKEND
            await text_queue.put(
                "Start the session by greeting the student warmly and letting them "
                "know you're ready to help with their practice problems."
            )
            logger.info("✅ Initial greeting prompt sent to Gemini session")
            
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