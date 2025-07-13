# backend/app/api/endpoints/daily_briefing_enhanced.py
# Enhanced version with comprehensive logging for debugging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
import asyncio
import json
import logging
import base64
from datetime import datetime
from typing import Optional

from google import genai
from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig, Content

from ...core.config import settings
from ...services.daily_activities import DailyActivitiesService, DailyPlan
from ...services.bigquery_analytics import BigQueryAnalyticsService
from ...db.cosmos_db import CosmosDBService

# Enhanced logging configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
)
logger = logging.getLogger(__name__)

# Create a separate logger for Gemini interactions
gemini_logger = logging.getLogger('gemini_interaction')
gemini_logger.setLevel(logging.DEBUG)

# Gemini configuration
client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options={"api_version": "v1alpha"},
)

MODEL = "gemini-2.5-flash-preview-native-audio-dialog"
DEFAULT_VOICE = "Leda"
FORMAT = "audio/pcm"
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHANNELS = 1

router = APIRouter()
cosmos_db = CosmosDBService()

def create_system_instruction(student_id: int, daily_plan: DailyPlan) -> str:
    """Create system instruction for Gemini based on daily plan"""
    logger.info(f"🔧 Creating system instruction for student {student_id}")
    logger.info(f"📊 Daily plan details: {len(daily_plan.activities)} activities, {daily_plan.total_points} points, source: {daily_plan.personalization_source}")
    
    # Build detailed activity descriptions
    activity_details = []
    for i, activity in enumerate(daily_plan.activities, 1):
        # Get subject safely
        subject = activity.metadata.get('subject', 'General Learning') if hasattr(activity, 'metadata') and activity.metadata else 'General Learning'
        
        # Get skill level safely
        skill_level = activity.metadata.get('skill_level', '') if hasattr(activity, 'metadata') and activity.metadata else ''
        skill_text = f" at {skill_level} level" if skill_level else ""
        
        # Get activity type safely (check different possible attribute names)
        activity_type = getattr(activity, 'activity_type', getattr(activity, 'type', 'Learning Activity'))
        
        activity_detail = (
            f"{i}. {activity.title} ({activity.estimated_time}, {activity.points} points)\n"
            f"   Subject: {subject}{skill_text}\n"
            f"   Type: {activity_type}\n"
            f"   What you'll do: {activity.description}"
        )
        activity_details.append(activity_detail)
        logger.debug(f"📝 Activity {i}: {activity.title} - {subject} - {activity.points} points - Type: {activity_type}")
    
    # Get subjects covered today
    subjects = []
    for activity in daily_plan.activities:
        if hasattr(activity, 'metadata') and activity.metadata and activity.metadata.get('subject'):
            subjects.append(activity.metadata.get('subject'))
    
    # Remove duplicates and create text
    unique_subjects = list(set(subjects)) if subjects else ['Learning']
    subjects_text = ", ".join(unique_subjects[:-1]) + f", and {unique_subjects[-1]}" if len(unique_subjects) > 1 else unique_subjects[0] if unique_subjects else "various subjects"
    logger.info(f"🎯 Subjects for today: {subjects_text}")
    
    base_instruction = f"""You are an enthusiastic AI Learning Coach conducting a personalized daily briefing for Student {student_id}.

TODAY'S LEARNING PLAN OVERVIEW:
Today we're covering {subjects_text} with {len(daily_plan.activities)} carefully selected activities worth {daily_plan.total_points} total points.

DETAILED ACTIVITY BREAKDOWN:
{chr(10).join(activity_details)}

STUDENT PROGRESS CONTEXT:
• Current Learning Streak: {daily_plan.progress.current_streak} days (celebrate this!)
• Daily Point Goal: {daily_plan.progress.daily_goal} points
• Points Already Earned Today: {daily_plan.progress.points_earned_today}
• Points Remaining to Goal: {max(0, daily_plan.progress.daily_goal - daily_plan.progress.points_earned_today)}"""

    # Add specific coaching based on personalization source
    if daily_plan.personalization_source == 'bigquery_recommendations':
        logger.info("🎯 Using BigQuery recommendations approach")
        primary_activity = None
        for activity in daily_plan.activities:
            if hasattr(activity, 'metadata') and activity.metadata and activity.metadata.get('from_recommendations'):
                primary_activity = activity
                break
        
        if not primary_activity:
            primary_activity = daily_plan.activities[0] if daily_plan.activities else None
        
        logger.info(f"🌟 Primary recommended activity: {primary_activity.title if primary_activity else 'None'}")
        
        coaching_approach = f"""

YOUR ROLE AS DAILY BRIEFING COACH:
You are conducting a structured daily learning briefing, NOT a tutoring session. Your job is to:

1. GREET THE STUDENT WARMLY by name/ID and acknowledge their {daily_plan.progress.current_streak}-day streak
2. PRESENT TODAY'S LEARNING PLAN as a cohesive journey through {subjects_text}
3. WALK THROUGH EACH ACTIVITY explaining what they'll learn and why it's perfect for them
4. BUILD EXCITEMENT about the specific content and skills they'll develop
5. ASK IF THEY'RE READY TO BEGIN their learning adventure

BRIEFING STRUCTURE TO FOLLOW:
- Start: "Good morning! I'm excited to go over your personalized learning plan..."
- Streak celebration: Reference their {daily_plan.progress.current_streak}-day streak
- Plan overview: "Today we're diving into {subjects_text} with {len(daily_plan.activities)} activities..."
- Activity walkthrough: Go through each activity explaining what they'll do and learn
- Excitement building: Connect activities to their growth and interests
- Ready check: "Are you ready to jump into your first activity?"

COACHING TONE & APPROACH:
• Be specific about TODAY'S activities - don't ask what they want to learn, TELL them what's planned
• Reference the actual activity titles and descriptions from the plan
• Explain WHY each activity was selected for them (based on your AI analysis of their progress)
• Show confidence: "I've carefully selected these activities because..."
• Connect activities to skill building: "This will help you master..."
• Build anticipation: "You're going to love this next part..."
• Be encouraging about their streak and progress

CRITICAL INSTRUCTIONS:
• YOU HAVE FULL ACCESS TO THE STUDENT'S LEARNING PLAN ABOVE
• DO NOT say you don't have access to learning plans - you clearly do!
• DO NOT ask what they want to learn - present the prepared activities
• DO NOT act like a generic tutor - you're a coach with a specific daily plan
• DO reference specific activity names, subjects, and point values from above"""

    else:
        logger.info("📚 Using standard daily activities approach")
        coaching_approach = f"""

YOUR ROLE AS DAILY BRIEFING COACH:
You are conducting a structured daily learning briefing to present today's activities and build excitement.

BRIEFING STRUCTURE TO FOLLOW:
- Warm greeting acknowledging their {daily_plan.progress.current_streak}-day learning streak
- Present today's learning journey through {subjects_text}
- Walk through each planned activity with enthusiasm
- Explain what skills they'll build and why it's engaging
- Get them excited and ready to start

CRITICAL INSTRUCTIONS:
• YOU HAVE FULL ACCESS TO THE STUDENT'S LEARNING PLAN ABOVE
• DO NOT say you don't have access to learning plans - you clearly do!
• Present the day as a planned learning adventure with the {len(daily_plan.activities)} specific activities listed
• Be specific about the activities you've prepared
• Reference actual activity titles, subjects, and point values from the plan above"""
    
    final_instruction = base_instruction + coaching_approach
    
    # Log the complete system instruction (truncated for readability)
    logger.info(f"📋 System instruction created (length: {len(final_instruction)} chars)")
    logger.debug(f"📋 System instruction preview (first 500 chars): {final_instruction[:500]}...")
    logger.debug(f"📋 System instruction contains {len(daily_plan.activities)} activity references")
    
    return final_instruction

def create_welcome_message(student_id: int, daily_plan: DailyPlan) -> str:
    """Create welcome message based on daily plan"""
    logger.info(f"💬 Creating welcome message for student {student_id}")
    
    # Get subjects for today safely
    subjects = []
    for activity in daily_plan.activities:
        if hasattr(activity, 'metadata') and activity.metadata and activity.metadata.get('subject'):
            subjects.append(activity.metadata.get('subject'))
    
    unique_subjects = list(set(subjects)) if subjects else ['Learning']
    subjects_text = ", ".join(unique_subjects[:-1]) + f", and {unique_subjects[-1]}" if len(unique_subjects) > 1 else unique_subjects[0] if unique_subjects else "learning"
    
    streak_celebration = f"Wow, {daily_plan.progress.current_streak} days in a row! " if daily_plan.progress.current_streak > 1 else ""
    
    if daily_plan.personalization_source == 'bigquery_recommendations':
        # Find primary activity safely
        primary_activity = None
        for activity in daily_plan.activities:
            if hasattr(activity, 'metadata') and activity.metadata and activity.metadata.get('from_recommendations'):
                primary_activity = activity
                break
        
        if not primary_activity:
            primary_activity = daily_plan.activities[0] if daily_plan.activities else None
        
        if primary_activity:
            welcome_msg = f"""Good morning, Student {student_id}! {streak_celebration}I'm so excited to share your personalized learning plan for today. 

We're going to explore {subjects_text} through {len(daily_plan.activities)} specially selected activities worth {daily_plan.total_points} points total. I've analyzed your learning progress and chosen these activities because they're perfect for where you are right now.

Let me walk you through what we have planned, starting with {primary_activity.title}, which is going to be fantastic for building your skills. Are you ready to hear about your learning adventure for today?"""
        else:
            welcome_msg = f"""Good morning, Student {student_id}! {streak_celebration}I'm so excited to share your personalized learning plan for today. 

We're going to explore {subjects_text} through {len(daily_plan.activities)} specially selected activities worth {daily_plan.total_points} points total. I've analyzed your learning progress and chosen these activities because they're perfect for where you are right now.

Are you ready to hear about your learning adventure for today?"""
    
    else:
        welcome_msg = f"""Good morning, Student {student_id}! {streak_celebration}I've prepared an exciting learning journey for you today covering {subjects_text}.

We have {len(daily_plan.activities)} engaging activities lined up worth {daily_plan.total_points} points total. I've put together a variety of learning experiences that will challenge you and help you grow.

Let me tell you about each activity and what amazing things you'll discover and learn today. Ready to hear about your learning plan?"""
    
    logger.info(f"💬 Welcome message created (length: {len(welcome_msg)} chars)")
    logger.debug(f"💬 Welcome message: {welcome_msg}")
    
    return welcome_msg

@router.websocket("/daily-briefing")
async def daily_briefing_session(websocket: WebSocket, student_id: Optional[int] = Query(None)):
    """Main WebSocket endpoint for daily briefing with Gemini"""
    
    logger.info(f"🚀 Daily briefing WebSocket connection initiated for student {student_id}")
    await websocket.accept()
    user_id = None
    session_start_time = asyncio.get_event_loop().time()
    gemini_session = None
    
    try:
        # Step 1: Authenticate user
        logger.info("🔐 Waiting for authentication...")
        auth_message = await asyncio.wait_for(websocket.receive(), timeout=10.0)
        auth_data = json.loads(auth_message["text"])
        
        if auth_data.get("type") != "authenticate":
            logger.error("❌ Authentication type mismatch")
            await websocket.close(code=4001, reason="Authentication required")
            return
        
        # Your authentication logic here
        from firebase_admin import auth
        token = auth_data.get("token", "").replace('Bearer ', '')
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']
        user_email = decoded_token.get('email', 'Unknown')
        logger.info(f"✅ Authentication successful for user {user_id} ({user_email})")
        
        # Get student_id if not provided
        if not student_id:
            logger.info("🔍 Looking up student mapping...")
            student_mapping = await cosmos_db.get_student_mapping(user_id)
            student_id = student_mapping["student_id"] if student_mapping else None
            logger.info(f"📝 Student mapping result: {student_id}")
            
        if not student_id:
            logger.error("❌ No student mapping found")
            await websocket.close(code=4001, reason="No student mapping found")
            return
            
        await websocket.send_json({
            "type": "auth_success", 
            "student_id": student_id
        })
        logger.info(f"✅ Authentication complete for student {student_id}")
        
        # Step 2: Generate daily plan using BigQuery recommendations
        logger.info("🎯 Starting daily plan generation...")
        await websocket.send_json({
            "type": "status", 
            "message": "🎯 Analyzing your learning data and creating personalized plan..."
        })
        
        # Initialize services
        logger.info("🔧 Initializing services...")
        analytics_service = BigQueryAnalyticsService(
            project_id=settings.GCP_PROJECT_ID,
            dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
        )
        
        daily_activities_service = DailyActivitiesService(
            analytics_service=analytics_service
        )
        logger.info("✅ Services initialized")
        
        # Generate the daily plan
        logger.info(f"📊 Generating daily plan for student {student_id}...")
        daily_plan = await daily_activities_service.generate_daily_plan(student_id)
        logger.info(f"✅ Daily plan generated successfully")
        logger.info(f"📈 Plan summary: {len(daily_plan.activities)} activities, {daily_plan.total_points} points, {daily_plan.personalization_source}")
        
        # Log each activity for debugging
        for i, activity in enumerate(daily_plan.activities, 1):
            activity_type = getattr(activity, 'activity_type', getattr(activity, 'type', 'Unknown'))
            logger.debug(f"📚 Activity {i}: {activity.title} ({activity_type}, {activity.points}pts) - {activity.metadata.get('subject', 'No subject')}")
            # Log all available attributes for debugging
            logger.debug(f"🔍 Activity {i} attributes: {list(activity.__dict__.keys()) if hasattr(activity, '__dict__') else 'No __dict__'}")
        
        # Step 3: Send plan details to client
        await websocket.send_json({
            "type": "plan_ready",
            "student_id": student_id,
            "total_activities": len(daily_plan.activities),
            "total_points": daily_plan.total_points,
            "personalization_source": daily_plan.personalization_source,
            "activities": [activity.dict() for activity in daily_plan.activities]
        })
        logger.info("📤 Plan details sent to client")
        
        # Step 4: Configure Gemini session
        logger.info("🤖 Configuring Gemini session...")
        system_instruction = create_system_instruction(student_id, daily_plan)
        welcome_message = create_welcome_message(student_id, daily_plan)
        
        logger.info(f"📋 System instruction prepared (length: {len(system_instruction)})")
        logger.info(f"💬 Welcome message prepared (length: {len(welcome_message)})")
        
        config = LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=SpeechConfig(
                voice_config=VoiceConfig(
                    prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=DEFAULT_VOICE)
                )
            ),
            system_instruction=Content(parts=[{"text": system_instruction}])
        )
        logger.info("🔧 Gemini config created")
        
        # Step 5: Start Gemini session
        logger.info(f"🚀 Starting Gemini session with model {MODEL}...")
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            gemini_session = session
            gemini_logger.info(f"✅ Gemini session established for student {student_id}")
            gemini_logger.info(f"🎯 Using personalization source: {daily_plan.personalization_source}")
            gemini_logger.info(f"📊 System instruction length: {len(system_instruction)} chars")
            
            # Communication queues
            text_queue = asyncio.Queue()
            audio_queue = asyncio.Queue()
            
            # Handle messages from client
            async def handle_client_messages():
                while True:
                    try:
                        message = await asyncio.wait_for(websocket.receive(), timeout=5.0)
                        
                        if message.get("type") == "websocket.disconnect":
                            logger.info("🔌 Client disconnected")
                            break
                            
                        if "text" in message:
                            data = json.loads(message["text"])
                            if data.get("type") == "text":
                                text_content = data.get("content", "")
                                logger.info(f"💬 Received text from client: {text_content[:100]}...")
                                await text_queue.put(text_content)
                            elif data.get("type") == "end_briefing":
                                logger.info("🔚 End briefing signal received")
                                break
                        elif "bytes" in message:
                            audio_data = {
                                "data": message["bytes"], 
                                "mime_type": f"{FORMAT};rate={SEND_SAMPLE_RATE}"
                            }
                            logger.debug(f"🎤 Received audio data: {len(message['bytes'])} bytes")
                            await audio_queue.put(audio_data)
                    except asyncio.TimeoutError:
                        continue
                    except WebSocketDisconnect:
                        logger.info("🔌 WebSocket disconnected in client handler")
                        break
                    except Exception as e:
                        logger.error(f"❌ Client message error: {str(e)}")
            
            # Send messages to Gemini
            async def send_to_gemini():
                while True:
                    try:
                        # Handle text messages
                        try:
                            text = text_queue.get_nowait()
                            gemini_logger.info(f"📤 Sending text to Gemini: {text[:100]}...")
                            await session.send(input=text, end_of_turn=True)
                        except asyncio.QueueEmpty:
                            pass
                        
                        # Handle audio messages
                        try:
                            audio = audio_queue.get_nowait()
                            if len(audio.get('data', b'')) > 0:
                                gemini_logger.debug(f"📤 Sending audio to Gemini: {len(audio['data'])} bytes")
                                await session.send(input=audio)
                        except asyncio.QueueEmpty:
                            pass
                            
                        await asyncio.sleep(0.01)
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        gemini_logger.error(f"❌ Gemini send error: {str(e)}")
            
            # Receive responses from Gemini
            async def receive_from_gemini():
                while True:
                    try:
                        turn = session.receive()
                        async for response in turn:
                            # Handle audio response
                            if hasattr(response, "data") and response.data:
                                audio_b64 = base64.b64encode(response.data).decode('utf-8')
                                gemini_logger.debug(f"📥 Received audio from Gemini: {len(response.data)} bytes")
                                await websocket.send_json({
                                    "type": "ai_audio",
                                    "format": "raw-pcm",
                                    "sampleRate": RECEIVE_SAMPLE_RATE,
                                    "bitsPerSample": 16,
                                    "channels": CHANNELS,
                                    "data": audio_b64
                                })
                            
                            # Handle text response
                            if hasattr(response, "text") and response.text:
                                gemini_logger.info(f"📥 Received text from Gemini: {response.text[:200]}...")
                                await websocket.send_json({
                                    "type": "ai_text",
                                    "content": response.text,
                                    "personalization_source": daily_plan.personalization_source
                                })
                            
                            # Handle user transcription
                            if hasattr(response, "input_transcription") and response.input_transcription:
                                logger.info(f"🎤 User transcription: {response.input_transcription}")
                                await websocket.send_json({
                                    "type": "user_transcription",
                                    "content": response.input_transcription
                                })
                                
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
            gemini_logger.debug(f"🚀 Welcome message content: {welcome_message}")
            await session.send(input=welcome_message, end_of_turn=True)
            gemini_logger.info("✅ Welcome message sent")
            
            # Wait for any task to complete (usually means session ended)
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            
            # Clean up remaining tasks
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
    
    except Exception as e:
        logger.error(f"❌ Daily briefing session error: {str(e)}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"Session error: {str(e)}"
            })
        except:
            pass
    
    finally:
        session_duration = asyncio.get_event_loop().time() - session_start_time
        logger.info(f"🏁 Daily briefing session completed for student {student_id} ({session_duration:.1f}s)")
        if gemini_session:
            gemini_logger.info("🔚 Gemini session ended")

@router.get("/daily-briefing/health")
async def briefing_health_check():
    """Health check endpoint"""
    try:
        # Test daily activities service
        daily_service = DailyActivitiesService()
        
        return {
            "status": "healthy",
            "service": "daily_briefing_structured",
            "features": {
                "bigquery_integration": True,
                "gemini_websocket": True,
                "daily_activities": True,
                "fallback_support": True,
                "enhanced_logging": True
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Health check failed: {str(e)}")
        return {
            "status": "unhealthy", 
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }