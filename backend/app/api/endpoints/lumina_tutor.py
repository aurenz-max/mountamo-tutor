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


def interpolate_template(template: str, data: Dict) -> str:
    """
    Replace {{key}} placeholders with values from data dict.
    Unresolved placeholders are replaced with '(not set)'.
    """
    import re
    def replacer(match):
        key = match.group(1).strip()
        value = data.get(key)
        if value is None:
            return '(not set)'
        return str(value)
    return re.sub(r'\{\{(\w+)\}\}', replacer, template)


def get_primitive_specific_instructions(
    primitive_type: str,
    primitive_data: Dict,
    tutoring_scaffold: Optional[Dict] = None
) -> str:
    """
    Build primitive-specific scaffolding from catalog-provided tutoring metadata.

    The tutoring scaffold is sent by the frontend from the component catalog,
    keeping scaffolding instructions co-located with component definitions
    (single source of truth). If no scaffold is provided, returns a generic fallback.
    """
    # Base template for all primitives
    base = f"""
**CURRENT PRIMITIVE: {primitive_type}**
Grade Level: {primitive_data.get('gradeLevel', 'K-6')}
"""

    if not tutoring_scaffold:
        return base + "\nNo specific scaffolding instructions for this primitive type."

    # Interpolate task description
    task_desc = interpolate_template(
        tutoring_scaffold.get('taskDescription', ''), primitive_data
    )

    # Build context snapshot from specified keys
    context_keys = tutoring_scaffold.get('contextKeys')
    if context_keys:
        context_lines = []
        for key in context_keys:
            value = primitive_data.get(key, '(not set)')
            context_lines.append(f"  {key}: {value}")
        context_section = "\n".join(context_lines)
    else:
        context_section = "\n".join(
            f"  {k}: {v}" for k, v in primitive_data.items()
        )

    # Scaffolding levels
    levels = tutoring_scaffold.get('scaffoldingLevels', {})
    level1 = interpolate_template(levels.get('level1', ''), primitive_data)
    level2 = interpolate_template(levels.get('level2', ''), primitive_data)
    level3 = interpolate_template(levels.get('level3', ''), primitive_data)

    # Common struggles
    struggles = tutoring_scaffold.get('commonStruggles', [])
    struggle_lines = []
    for s in struggles:
        pattern = s.get('pattern', '')
        response = interpolate_template(s.get('response', ''), primitive_data)
        struggle_lines.append(f'- {pattern} → "{response}"')
    struggles_section = "\n".join(struggle_lines) if struggle_lines else "None specified"

    # AI directives (primitive-specific commands injected by the catalog)
    directives = tutoring_scaffold.get('aiDirectives', [])
    directives_section = ""
    for d in directives:
        title = d.get('title', 'DIRECTIVE')
        instruction = interpolate_template(d.get('instruction', ''), primitive_data)
        directives_section += f"\n**{title}:**\n{instruction}\n"

    return f"""{base}
**TASK:** {task_desc}

**RUNTIME STATE:**
{context_section}

**SCAFFOLDING STRATEGY:**
Level 1: {level1}
Level 2: {level2}
Level 3: {level3}

**COMMON STRUGGLES:**
{struggles_section}
{directives_section}"""


async def build_lumina_system_instruction(
    primitive_type: str,
    primitive_data: Dict,
    lesson_context: Dict,
    student_progress: Dict,
    tutoring_scaffold: Optional[Dict] = None
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

{get_primitive_specific_instructions(primitive_type, primitive_data, tutoring_scaffold)}

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
- ALWAYS wait for the student to respond before continuing (except for [PRONOUNCE] commands)
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
        if "text" not in auth_message:
            logger.warning("⚠️ Received non-text message during auth (likely client disconnected)")
            return
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
        tutoring_scaffold = primitive_context.get("tutoring")

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
            student_progress,
            tutoring_scaffold=tutoring_scaffold
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
            output_audio_transcription=types.AudioTranscriptionConfig(),
            realtime_input_config=types.RealtimeInputConfig(turn_coverage="TURN_INCLUDES_ALL_INPUT"),
            context_window_compression=types.ContextWindowCompressionConfig(
                trigger_tokens=25600,
                sliding_window=types.SlidingWindow(target_tokens=12800),
            ),
            system_instruction=Content(parts=[{"text": system_instruction}]),
            thinking_config=types.ThinkingConfig(          # ← Add this block
                thinking_budget=0                          # 0 = thinking fully disabled
                # Optional: include_thoughts=False         # (usually default False in Live; prevents <thinking> tags leaking to output if any internal thoughts surface)
            ),
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
                        logger.info(f"✅ Text sent to Gemini successfully (end_of_turn=True)")
                except Exception as e:
                    logger.error(f"❌ Error sending text to Gemini: {e}")
                    logger.error(f"❌ Full traceback: {traceback.format_exc()}")

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
                    turn_count = 0
                    while True:
                        turn_count += 1
                        logger.info(f"👂 Waiting for Gemini response (turn {turn_count})...")
                        async for response in session.receive():
                            if hasattr(response, 'server_content') and response.server_content:
                                # Handle model turn (AI speaking)
                                if hasattr(response.server_content, 'model_turn') and response.server_content.model_turn:
                                    model_turn = response.server_content.model_turn

                                    if hasattr(model_turn, 'parts') and model_turn.parts:
                                        for part in model_turn.parts:
                                            # Debug: log part attributes
                                            part_attrs = [a for a in dir(part) if not a.startswith('_')]
                                            gemini_logger.debug(f"🔍 Part attributes: {part_attrs}")

                                            # Handle text parts
                                            if hasattr(part, 'text') and part.text:
                                                # Check if this is model thinking (not student-facing)
                                                is_thought = getattr(part, 'thought', False)
                                                if is_thought:
                                                    gemini_logger.info(f"💭 Model thinking: {part.text[:100]}...")
                                                    continue

                                                gemini_logger.info(f"📥 Received text from Gemini: {part.text[:100]}...")
                                                clean_text = part.text.strip()
                                                if clean_text:
                                                    logger.info(f"🎯 AI text response: {clean_text}")

                                                    asyncio.create_task(websocket.send_json({
                                                        "type": "ai_response",
                                                        "content": clean_text
                                                    }))

                                            # Handle audio data
                                            if hasattr(part, 'inline_data') and part.inline_data:
                                                audio_data = getattr(part.inline_data, 'data', None)
                                                if audio_data:
                                                    import base64
                                                    audio_b64 = base64.b64encode(audio_data).decode()
                                                    logger.debug(f"🔊 Sending audio chunk to client ({len(audio_data)} bytes)")

                                                    asyncio.create_task(websocket.send_json({
                                                        "type": "ai_audio",
                                                        "format": "raw-pcm",
                                                        "sampleRate": RECEIVE_SAMPLE_RATE,
                                                        "bitsPerSample": 16,
                                                        "channels": CHANNELS,
                                                        "data": audio_b64
                                                    }))
                                                else:
                                                    gemini_logger.warning(f"⚠️ inline_data present but no data: {part.inline_data}")

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
                                if getattr(response.server_content, 'turn_complete', False) or getattr(response.server_content, 'end_of_turn', False):
                                    logger.info("✅ AI turn finished (flag detected).")
                                    asyncio.create_task(websocket.send_json({"type": "ai_turn_end"}))

                        # Fallback: when the receive() iterator completes, the turn is done
                        # even if no explicit end_of_turn flag was set on any response
                        logger.info("✅ AI turn finished (iterator ended).")
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
