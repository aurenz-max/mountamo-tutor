# backend/app/api/endpoints/lumina_tutor.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
import traceback

from google import genai
from google.genai import types
from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig, Content

from ...core.config import settings

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
)
logger = logging.getLogger(__name__)

# Create separate logger for Gemini interactions
gemini_logger = logging.getLogger('gemini_lumina_tutor')
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


def format_objectives(objectives: List[Dict]) -> str:
    """Format learning objectives for system prompt."""
    if not objectives:
        return "No specific objectives provided"

    formatted = []
    for obj in objectives:
        verb = obj.get('verb', 'learn')
        text = obj.get('text', '')
        formatted.append(f"- {verb.title()}: {text}")

    return "\n".join(formatted)


def format_activities(activities: List[Dict], results: Optional[List[Dict]] = None) -> str:
    """Format activity list for context."""
    if not activities:
        return "None"

    formatted = []
    for act in activities:
        title = act.get('title', 'Untitled')
        instance_id = act.get('instance_id', '')

        # Check if we have results for this activity
        status = ""
        if results:
            result = next((r for r in results if r.get('instance_id') == instance_id), None)
            if result:
                if result.get('completed'):
                    status = " ✓"
                else:
                    status = " (in progress)"

        formatted.append(f"- {title}{status}")

    return "\n".join(formatted)


def get_primitive_specific_instructions(primitive_type: str, primitive_data: Dict) -> str:
    """
    Get primitive-specific scaffolding instructions.
    This is where we define how the AI should help with each primitive type.
    """

    # Base template for all primitives
    base = f"""
**CURRENT PRIMITIVE: {primitive_type}**
Grade Level: {primitive_data.get('gradeLevel', 'K-6')}
"""

    # Primitive-specific scaffolding strategies
    # TODO: Add more primitives as needed
    specific_instructions = {
        "phonics-blender": f"""
**TASK:** Help student blend phonemes to read words ({primitive_data.get('patternType', 'CVC')} pattern)
Current word: {primitive_data.get('currentWord', '(not set)')}
Target phonemes: {primitive_data.get('targetPhonemes', [])}

**SCAFFOLDING STRATEGY:**
Level 1: Point to first sound, ask "What sound does this letter make?"
Level 2: Model blending first two sounds, have student add third
Level 3: Slow blend demonstration, guide each sound connection

**COMMON STRUGGLES:**
- Skipping sounds → "Let's make sure we say every sound"
- Fast blending → "Try saying it slow-motion first"
- Forgetting sounds → "Let's tap each letter as we say the sound"
""",

        "fraction-bar": f"""
**TASK:** Build and compare fractions
Target: {primitive_data.get('targetFraction', '(not set)')}
Current: {primitive_data.get('currentFraction', '(not set)')}

**SCAFFOLDING STRATEGY:**
Level 1: "How many parts is the whole divided into?"
Level 2: "You need {primitive_data.get('denominator', 'X')} equal pieces. How many should be shaded?"
Level 3: "Denominator = bottom number = total pieces. Numerator = top = shaded pieces."

**COMMON STRUGGLES:**
- Confusing num/denom → Use "out of" language
- Unequal parts → "Are all the pieces the same size?"
- Equivalence → Show different ways to divide same whole
""",

        "story-map": f"""
**TASK:** Map story elements to {primitive_data.get('structureType', 'BME')} structure
Current phase: {primitive_data.get('currentPhase', 'introduction')}
Elements found: {primitive_data.get('elementsIdentified', [])}

**SCAFFOLDING STRATEGY:**
Level 1: "Think about what happens at this part of the story."
Level 2: "Remember when [character] did [action]? Which part does that belong in?"
Level 3: "The [element] usually comes here. Look for clues like [signal words]"

**COMMON STRUGGLES:**
- Confusing parts → Point to visual structure, ask where event fits
- Missing elements → "What haven't we filled in yet?"
- Wrong sequence → "Think about what happened first, next, last"
""",

        "evidence-finder": f"""
**TASK:** Find textual evidence for claims
Claim: {primitive_data.get('currentClaim', '(analyzing)')}

**SCAFFOLDING STRATEGY:**
Level 1: "What part of the text talks about this idea?"
Level 2: "Look for sentences with words like [keywords]"
Level 3: "The evidence is in paragraph X. Highlight the sentence that proves the claim"

**COMMON STRUGGLES:**
- Opinion vs evidence → "Did the author say that, or is it your idea?"
- Weak evidence → "Does this PROVE the claim or just mention it?"
- Wrong section → Direct to correct paragraph
""",

        "balance-scale": f"""
**TASK:** Balance equations using the scale model
Target equation: {primitive_data.get('targetEquation', 'X = Y')}

**SCAFFOLDING STRATEGY:**
Level 1: "What do you notice about the two sides?"
Level 2: "If we add/remove this from one side, what happens to the other?"
Level 3: "We need the same weight on both sides. Let's solve step-by-step."

**COMMON STRUGGLES:**
- One-sided changes → "Remember: what you do to one side, do to the other"
- Goal confusion → "We're trying to get X by itself"
""",
    }

    # Return base + specific if available
    return base + specific_instructions.get(primitive_type, "\nNo specific instructions for this primitive type yet.")


async def build_lumina_system_instruction(
    primitive_type: str,
    primitive_data: Dict,
    lesson_context: Dict,
    student_progress: Dict
) -> str:
    """
    Generate context-aware system prompt with lesson progression.
    This is the core intelligence that makes Lumina AI lesson-aware.
    """

    # Extract lesson info
    topic = lesson_context.get('topic', 'Learning Activity')
    grade_level = lesson_context.get('grade_level', 'K-6')
    objectives = lesson_context.get('objectives', [])
    ordered_components = lesson_context.get('ordered_components', [])
    current_index = lesson_context.get('current_index', 0)
    previous_results = lesson_context.get('previous_results', [])

    # Build lesson progression awareness
    previous_activities = ordered_components[:current_index] if current_index > 0 else []
    current_activity = ordered_components[current_index] if current_index < len(ordered_components) else {}
    upcoming_activities = ordered_components[current_index + 1:] if current_index < len(ordered_components) - 1 else []

    # Student progress context
    attempts = student_progress.get('attempts', 0)
    hints_used = student_progress.get('hints_used', 0)
    success_rate = student_progress.get('success_rate', 0.0)

    # Determine struggle pattern
    struggle_pattern = "just starting"
    if attempts > 3 and success_rate < 0.5:
        struggle_pattern = "needs more support"
    elif attempts > 1 and success_rate > 0.8:
        struggle_pattern = "making good progress"

    # Build the comprehensive system instruction
    system_instruction = f"""You are an AI Learning Assistant for Lumina, an interactive educational platform.

**LESSON CONTEXT:**
Topic: {topic}
Grade Level: {grade_level}
Learning Objectives:
{format_objectives(objectives)}

**LESSON PROGRESSION:**
{len(previous_activities)} activities completed
Current: {current_activity.get('title', 'Unknown')} (Activity {current_index + 1} of {len(ordered_components)})
{len(upcoming_activities)} activities remaining

**PREVIOUS ACTIVITIES:**
{format_activities(previous_activities, previous_results)}

**UPCOMING ACTIVITIES:**
{format_activities(upcoming_activities[:2])}

{get_primitive_specific_instructions(primitive_type, primitive_data)}

**STUDENT CONTEXT:**
- Current attempt: {attempts}
- Hints used: {hints_used}
- Success pattern: {struggle_pattern}
- Success rate: {success_rate * 100:.0f}%

**YOUR ROLE:**
1. **Provide scaffolded hints** - Never give direct answers
2. **Reference lesson context** - Connect to previous activities when relevant ("Remember in the fraction bar earlier when we...")
3. **Preview connections** - Link to upcoming activities ("This will help you with the next challenge where...")
4. **Use Socratic questioning** - Ask guiding questions instead of stating facts
5. **Celebrate progress** - Acknowledge the student's journey through the lesson

**HINT PROGRESSION SYSTEM:**
When the student requests a hint, respond based on the level they request:

- **Level 1 (Gentle Nudge):** Ask a thought-provoking question or give a subtle pointer. Example: "What do you notice about the first sound?"
- **Level 2 (Specific Guidance):** Break down the problem into smaller steps. Example: "Let's focus on just the first two sounds. Can you blend /k/ and /æ/ together?"
- **Level 3 (Detailed Walkthrough):** Provide step-by-step guidance without giving the answer. Example: "Start with /k/, add /æ/ to make 'ca', then add /t/ at the end."

**INTERACTION RULES:**
- Keep responses SHORT (1-2 sentences max)
- Use encouraging, supportive tone appropriate for {grade_level} students
- Ask "What do you think?" frequently to engage thinking
- Reference lesson context naturally without being formulaic
- Use the student's name if provided
- Celebrate small wins and acknowledge effort
- If student is stuck after Level 3 hint, encourage them to try and provide reassurance

**IMPORTANT:**
- NEVER solve the problem for the student
- ALWAYS wait for the student to respond before continuing
- BE PATIENT - learning takes time
- ENCOURAGE mistakes as learning opportunities
"""

    return system_instruction


@router.websocket("/lumina-tutor")
async def lumina_tutor_session(websocket: WebSocket):
    """
    WebSocket endpoint for Lumina AI Assistant sessions.
    Provides context-aware, lesson-level AI tutoring for Lumina primitives.
    """
    logger.info(f"🔗 Lumina Tutor WebSocket connection attempt from: {websocket.client}")

    await websocket.accept()
    logger.info("🎯 Lumina Tutor WebSocket connection accepted")

    gemini_session = None
    user_context = None

    # Metrics tracking
    hints_given = {"level1": 0, "level2": 0, "level3": 0}
    total_interactions = 0
    conversation_turns = 0
    voice_interactions = 0

    try:
        # Step 1: Authenticate user
        logger.info("🔐 Waiting for authentication...")
        auth_message = await asyncio.wait_for(websocket.receive(), timeout=10.0)
        auth_data = json.loads(auth_message["text"])

        if auth_data.get("type") != "authenticate":
            logger.error("❌ Authentication type mismatch")
            await websocket.close(code=4001, reason="Authentication required")
            return

        # Authenticate using Firebase
        from firebase_admin import auth
        token = auth_data.get("token", "").replace('Bearer ', '')
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']
        user_email = decoded_token.get('email', 'Unknown')
        logger.info(f"✅ Authentication successful for user {user_id} ({user_email})")

        # Extract primitive and lesson context
        primitive_context = auth_data.get("primitive_context", {})
        lesson_context = auth_data.get("lesson_context", {})
        student_progress = auth_data.get("student_progress", {})

        primitive_type = primitive_context.get("primitive_type", "unknown")
        instance_id = primitive_context.get("instance_id", "unknown")
        primitive_data = primitive_context.get("primitive_data", {})

        logger.info(f"🚀 Initializing Lumina AI session for primitive: {primitive_type} (instance: {instance_id})")
        logger.info(f"📚 Lesson: {lesson_context.get('topic', 'Unknown')} - Activity {lesson_context.get('current_index', 0) + 1} of {len(lesson_context.get('ordered_components', []))}")

        # Send authentication success
        await websocket.send_json({
            "type": "auth_success",
            "message": "Lumina AI connected and ready to help!"
        })
        logger.info("✅ Authentication complete for Lumina tutor")

        # Step 2: Build lesson-aware system instruction
        system_instruction = await build_lumina_system_instruction(
            primitive_type,
            primitive_data,
            lesson_context,
            student_progress
        )
        logger.info(f"📋 System instruction built for {primitive_type} in lesson: {lesson_context.get('topic', 'Unknown')}")

        # Step 3: Configure Gemini session
        speech_config = SpeechConfig(
            voice_config=VoiceConfig(
                prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=DEFAULT_VOICE)
            )
        )

        config = LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=speech_config,
            realtime_input_config=types.RealtimeInputConfig(turn_coverage="TURN_INCLUDES_ALL_INPUT"),
            context_window_compression=types.ContextWindowCompressionConfig(
                trigger_tokens=25600,
                sliding_window=types.SlidingWindow(target_tokens=12800),
            ),
            system_instruction=Content(parts=[{"text": system_instruction}]),
        )

        logger.info("🎤 Starting Gemini Live session for Lumina tutoring...")

        async with client.aio.live.connect(model=MODEL, config=config) as session:
            gemini_session = session
            logger.info("✅ Gemini Live session connected successfully")

            # Send session ready message
            asyncio.create_task(websocket.send_json({
                "type": "session_ready",
                "message": "Lumina AI is ready to help you learn!"
            }))

            # Create queues for communication
            text_queue = asyncio.Queue()
            audio_queue = asyncio.Queue()

            # Send initial greeting
            await text_queue.put(
                "Greet the student warmly and let them know you're here to help them "
                "with this activity. Keep it brief and encouraging."
            )
            logger.info("✅ Initial greeting prompt queued")

            # Task management
            tasks = []

            async def handle_client_messages():
                """Handle messages from the frontend client"""
                nonlocal hints_given, total_interactions, conversation_turns, voice_interactions

                try:
                    while True:
                        message = await websocket.receive_json()
                        message_type = message.get("type")

                        # Track interactions
                        total_interactions += 1

                        if message_type == "request_hint":
                            # Handle tiered hint request
                            hint_level = message.get("hint_level", 1)
                            current_state = message.get("current_state", {})

                            # Track hint usage
                            hints_given[f"level{hint_level}"] += 1

                            logger.info(f"💡 Hint request (Level {hint_level}) - Total hints: {sum(hints_given.values())}")

                            # Build hint request for Gemini
                            hint_request = f"The student is requesting a Level {hint_level} hint. "

                            if hint_level == 1:
                                hint_request += "Give a gentle nudge - ask a thought-provoking question or point them in the right direction."
                            elif hint_level == 2:
                                hint_request += "Give specific guidance - break down the problem into smaller steps they can tackle."
                            elif hint_level == 3:
                                hint_request += "Give a detailed walkthrough - guide them step-by-step without revealing the answer directly."

                            # Add current state context if provided
                            if current_state:
                                hint_request += f"\n\nCurrent state: {json.dumps(current_state)}"

                            await text_queue.put(hint_request)

                            # Send metrics update to client
                            asyncio.create_task(websocket.send_json({
                                "type": "metrics_update",
                                "hintsGiven": hints_given,
                                "totalInteractions": total_interactions
                            }))

                        elif message_type == "update_context":
                            # Handle real-time primitive state updates
                            new_state = message.get("primitive_data", {})
                            progress_update = message.get("student_progress", {})

                            logger.info(f"🔄 Context update received for {primitive_type}")

                            # Optionally send context update to Gemini
                            # (Could be used to keep AI aware of student's current work)
                            # For now, we'll just log it

                        elif message_type == "student_action":
                            # Log specific student interactions
                            action = message.get("action", "unknown")
                            details = message.get("details", {})

                            logger.info(f"👆 Student action: {action} - {details}")

                            # Optionally inform AI of specific actions
                            # (e.g., "The student just selected a phoneme", "The student placed a piece")

                        elif message_type == "text":
                            # Handle regular text interaction
                            content = message.get("content", "")
                            conversation_turns += 1
                            await text_queue.put(content)

                        elif message_type == "audio":
                            # Handle audio input
                            audio_data = message.get("data") or message.get("audio_data")
                            if audio_data:
                                voice_interactions += 1
                                conversation_turns += 1
                                await audio_queue.put(audio_data)
                                logger.debug(f"📨 Queued audio data ({len(audio_data)} bytes base64)")

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
                        await session.send(
                            input={
                                "data": audio_data,
                                "mime_type": f"{FORMAT};rate={SEND_SAMPLE_RATE}"
                            },
                            end_of_turn=False  # Keep turn open for streaming
                        )
                        logger.debug(f"📤 Sent audio chunk to Gemini ({len(audio_data)} bytes base64)")
                except Exception as e:
                    logger.error(f"❌ Error sending audio to Gemini: {e}")

            async def handle_gemini_responses():
                """Handle responses from Gemini and send to client"""
                try:
                    while True:
                        async for response in session.receive():
                            if hasattr(response, 'server_content') and response.server_content:
                                # Handle model turn (AI speaking)
                                if hasattr(response.server_content, 'model_turn') and response.server_content.model_turn:
                                    model_turn = response.server_content.model_turn

                                    if hasattr(model_turn, 'parts') and model_turn.parts:
                                        for part in model_turn.parts:
                                            # Handle text parts
                                            if hasattr(part, 'text') and part.text:
                                                gemini_logger.info(f"📥 Received text from Gemini: {part.text[:100]}...")
                                                clean_text = part.text.strip()
                                                if clean_text:
                                                    logger.info(f"🎯 AI speaking: {clean_text}")

                                                    asyncio.create_task(websocket.send_json({
                                                        "type": "ai_response",
                                                        "content": clean_text
                                                    }))

                                            # Handle audio data
                                            elif hasattr(part, 'inline_data') and part.inline_data and hasattr(part.inline_data, 'data') and part.inline_data.data:
                                                import base64
                                                audio_b64 = base64.b64encode(part.inline_data.data).decode()

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

                                        asyncio.create_task(websocket.send_json({
                                            "type": "user_transcription",
                                            "content": response.server_content.input_transcription.text
                                        }))

                                # Handle output transcription
                                if hasattr(response.server_content, 'output_transcription') and response.server_content.output_transcription:
                                    if hasattr(response.server_content.output_transcription, 'text') and response.server_content.output_transcription.text:
                                        logger.info(f"🎯 AI transcription: {response.server_content.output_transcription.text}")

                                        asyncio.create_task(websocket.send_json({
                                            "type": "ai_transcription",
                                            "content": response.server_content.output_transcription.text
                                        }))

                                # Check for end of turn
                                if hasattr(response.server_content, 'end_of_turn') and response.server_content.end_of_turn:
                                    logger.info("✅ AI turn finished.")

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

            logger.info("🚀 All Lumina tutor communication tasks started")

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
        logger.info("🔌 Lumina Tutor WebSocket disconnected")
    except asyncio.TimeoutError:
        logger.error("⏰ Authentication timeout in Lumina tutor session")
        try:
            await websocket.close(code=4008, reason="Authentication timeout")
        except:
            pass
    except Exception as e:
        logger.error(f"❌ Lumina tutor session error: {e}")
        logger.error(f"❌ Full traceback: {traceback.format_exc()}")
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except:
            pass
    finally:
        if gemini_session:
            try:
                await gemini_session.close()
                logger.info("🔚 Gemini session ended")
            except:
                pass

        # Log final metrics
        logger.info(f"📊 Session metrics - Hints: {hints_given}, Interactions: {total_interactions}, Turns: {conversation_turns}, Voice: {voice_interactions}")
        logger.info("🔚 Lumina tutor session cleanup completed")
