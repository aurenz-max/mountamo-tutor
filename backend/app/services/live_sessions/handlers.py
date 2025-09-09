# backend/app/services/live_sessions/handlers.py
import asyncio
import base64
import logging
import uuid
from typing import Dict, Any, Optional

from google.genai import types
from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig, Content

from .base import GeminiLiveSessionHandler
from ...services.daily_activities import DailyActivitiesService, DailyPlan
from ...services.bigquery_analytics import BigQueryAnalyticsService
from ...db.cosmos_db import CosmosDBService
from ...core.config import settings

logger = logging.getLogger(__name__)

# Initialize shared services
cosmos_db = CosmosDBService()

class PracticeTutorHandler(GeminiLiveSessionHandler):
    """Handler for practice tutoring sessions with problem-specific interactions."""
    
    async def build_system_instruction(self) -> str:
        """Build the system instruction for practice tutoring."""
        topic_context = self.initial_data.get("topic_context", {})
        return await self._build_topic_tutor_instruction(topic_context)
    
    async def get_initial_prompt(self) -> str:
        """Practice tutor waits for a problem, so no initial prompt."""
        return ""
    
    async def handle_client_message(self, message: dict):
        """Handle practice tutor specific client messages."""
        message_type = message.get("type")
        
        logger.info(f"📨 Practice tutor received: {message_type}")
        
        if message_type == "new_problem":
            await self._handle_new_problem(message)
        elif message_type == "text":
            content = message.get("content", "")
            await self.send_text_to_gemini(content)
        elif message_type == "hint_request":
            await self.send_text_to_gemini("Can you give me a hint to help me think through this problem?")
        elif message_type == "concept_explanation":
            await self.send_text_to_gemini("Can you explain the main concept behind this problem?")
        elif message_type == "check_work":
            work_description = message.get("work_description", "my work")
            await self.send_text_to_gemini(f"Can you look at {work_description} and help me check if I'm on the right track?")
        elif message_type == "result_feedback":
            await self._handle_result_feedback(message)
        elif message_type == "audio":
            await self._handle_audio_data(message)
    
    async def _handle_new_problem(self, message: dict):
        """Handle new problem introduction."""
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
        
        await self.send_text_to_gemini(prompt_for_gemini)
    
    async def _handle_result_feedback(self, message: dict):
        """Handle answer result feedback."""
        is_correct = message.get("is_correct", False)
        score = message.get("score", 0)
        
        if is_correct:
            prompt = f"The student got the problem correct with a score of {score}/10! Please give them encouraging praise and briefly explain what they did well. Keep it enthusiastic but concise."
        else:
            prompt = f"The student got the problem wrong with a score of {score}/10. Please give them gentle encouragement, remind them that mistakes help us learn, and offer to help them understand what went wrong. Be supportive and motivating."
        
        await self.send_text_to_gemini(prompt)
    
    async def _handle_audio_data(self, message: dict):
        """Handle audio input with universal format validation."""
        # Universal format validation
        audio_data = message.get("data")
        audio_format = message.get("format", "raw-pcm")
        sample_rate = message.get("sampleRate", 16000)
        channels = message.get("channels", 1)
        
        # Validate universal format
        if not audio_data:
            raise ValueError("Audio data missing")
        if audio_format != "raw-pcm":
            raise ValueError(f"Unsupported audio format: {audio_format}")
        if sample_rate != 16000:
            raise ValueError(f"Unsupported sample rate: {sample_rate}. Expected 16000")
        if channels != 1:
            raise ValueError(f"Unsupported channel count: {channels}. Expected 1")
        
        # Process audio
        if isinstance(audio_data, str):
            # Base64 encoded audio
            audio_bytes = base64.b64decode(audio_data)
            await self.send_audio_to_gemini(audio_bytes)
        else:
            await self.send_audio_to_gemini(audio_data)
    
    async def _build_topic_tutor_instruction(self, topic_context: dict) -> str:
        """Build the system instruction based on the educational hierarchy."""
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

Remember: You are here to guide learning, not to solve problems for the student. Every interaction should build their confidence and problem-solving skills.
"""
        return instruction


class PackageLearnHandler(GeminiLiveSessionHandler):
    """Handler for content package learning sessions."""
    
    def __init__(self, websocket, user_context, initial_data):
        super().__init__(websocket, user_context, initial_data)
        self.session_id = None
        self.package_id = initial_data.get("package_id")
    
    async def build_system_instruction(self) -> str:
        """Build the system instruction for package learning."""
        package_id = self.package_id
        user_id = self.user_context.get("uid")
        user_email = self.user_context.get("email")
        return await self._build_package_instruction(package_id, user_id, user_email)
    
    async def get_initial_prompt(self) -> str:
        """Create welcome message for package learning."""
        package_id = self.package_id
        user_email = self.user_context.get("email")
        return await self._create_welcome_message(package_id, user_email)
    
    async def handle_client_message(self, message: dict):
        """Handle package learning specific client messages."""
        message_type = message.get("type")
        
        # Skip authentication messages since we already handled that
        if message_type == "authenticate":
            return
        
        if message_type == "text":
            text_content = message.get("content", "")
            logger.info(f"💬 Package learning received text: {text_content[:100]}...")
            await self.send_text_to_gemini(text_content)
        elif message_type == "audio":
            await self._handle_audio_message(message)
        elif message_type == "end_conversation":
            logger.info("🔚 End conversation signal received")
            # Could trigger session cleanup here
    
    async def _handle_audio_message(self, message: dict):
        """Handle audio input for package learning with universal format validation."""
        # Universal format validation
        audio_data = message.get("data")
        audio_format = message.get("format", "raw-pcm")
        sample_rate = message.get("sampleRate", 16000)
        channels = message.get("channels", 1)
        
        # Validate universal format
        if not audio_data:
            raise ValueError("Audio data missing")
        if audio_format != "raw-pcm":
            raise ValueError(f"Unsupported audio format: {audio_format}")
        if sample_rate != 16000:
            raise ValueError(f"Unsupported sample rate: {sample_rate}. Expected 16000")
        if channels != 1:
            raise ValueError(f"Unsupported channel count: {channels}. Expected 1")
        
        # Process audio
        if isinstance(audio_data, str):
            audio_bytes = base64.b64decode(audio_data)
            await self.send_audio_to_gemini(audio_bytes)
        else:
            await self.send_audio_to_gemini(audio_data)
    
    async def _build_package_instruction(self, package_id: str, user_id: str, user_email: str) -> str:
        """Build focused system instruction with package context and user info."""
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
    
    async def _create_welcome_message(self, package_id: str, user_email: str) -> str:
        """Create welcome message based on package content."""
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


class DailyBriefingHandler(GeminiLiveSessionHandler):
    """Handler for daily briefing sessions with learning plans."""
    
    def __init__(self, websocket, user_context, initial_data):
        super().__init__(websocket, user_context, initial_data)
        self.student_id = initial_data.get("student_id")
        self.daily_plan = None
    
    def get_gemini_config(self, system_instruction_text: str):
        """Override to add daily briefing specific config."""
        return LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=SpeechConfig(
                voice_config=VoiceConfig(
                    prebuilt_voice_config=PrebuiltVoiceConfig(voice_name="Leda")
                )
            ),
            realtime_input_config=types.RealtimeInputConfig(turn_coverage="TURN_INCLUDES_ALL_INPUT"),
            context_window_compression=types.ContextWindowCompressionConfig(
                trigger_tokens=25600,
                sliding_window=types.SlidingWindow(target_tokens=12800),
            ),
            system_instruction=Content(parts=[{"text": system_instruction_text}])
        )
    
    async def build_system_instruction(self) -> str:
        """Build the system instruction for daily briefing."""
        # Generate the daily plan first
        student_id = self.student_id
        if not student_id:
            # Try to get student_id from user context
            firebase_uid = self.user_context.get("uid")
            if firebase_uid:
                student_mapping = await cosmos_db.get_student_mapping(firebase_uid)
                student_id = student_mapping["student_id"] if student_mapping else None
        
        if not student_id:
            raise Exception("No student ID found for daily briefing")
        
        # Initialize services
        analytics_service = BigQueryAnalyticsService(
            project_id=settings.GCP_PROJECT_ID,
            dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
        )
        
        daily_activities_service = DailyActivitiesService(
            analytics_service=analytics_service
        )
        
        # Generate the daily plan
        self.daily_plan = await daily_activities_service.generate_daily_plan(student_id)
        logger.info(f"📈 Daily plan generated: {len(self.daily_plan.activities)} activities, {self.daily_plan.total_points} points")
        
        # Send plan details to the client
        await self.websocket.send_json({
            "type": "plan_ready",
            "plan": self.daily_plan.dict()
        })
        
        return self._create_system_instruction(student_id, self.daily_plan)
    
    async def get_initial_prompt(self) -> str:
        """Create welcome message for daily briefing."""
        return self._create_welcome_message(self.student_id, self.daily_plan)
    
    async def handle_client_message(self, message: dict):
        """Handle daily briefing specific client messages."""
        message_type = message.get("type")
        
        if message_type == "text":
            text_content = message.get("content", "")
            logger.info(f"💬 Daily briefing received text: {text_content[:100]}...")
            await self.send_text_to_gemini(text_content)
        elif message_type == "audio":
            await self._handle_audio_message(message)
        elif message_type == "end_briefing":
            logger.info("🔚 End briefing signal received")
    
    async def _handle_audio_message(self, message: dict):
        """Handle audio input for daily briefing with universal format validation."""
        # Universal format validation
        audio_data = message.get("data")
        audio_format = message.get("format", "raw-pcm")
        sample_rate = message.get("sampleRate", 16000)
        channels = message.get("channels", 1)
        
        # Validate universal format
        if not audio_data:
            raise ValueError("Audio data missing")
        if audio_format != "raw-pcm":
            raise ValueError(f"Unsupported audio format: {audio_format}")
        if sample_rate != 16000:
            raise ValueError(f"Unsupported sample rate: {sample_rate}. Expected 16000")
        if channels != 1:
            raise ValueError(f"Unsupported channel count: {channels}. Expected 1")
        
        # Process audio
        if isinstance(audio_data, str):
            audio_bytes = base64.b64decode(audio_data)
            await self.send_audio_to_gemini(audio_bytes)
        else:
            await self.send_audio_to_gemini(audio_data)
    
    def _create_system_instruction(self, student_id: int, daily_plan: DailyPlan) -> str:
        """Create system instruction for Gemini based on daily plan."""
        logger.info(f"🔧 Creating system instruction for student {student_id}")
        
        # Build detailed activity descriptions
        activity_details = []
        for i, activity in enumerate(daily_plan.activities, 1):
            # Get subject safely
            subject = activity.metadata.get('subject', 'General Learning') if hasattr(activity, 'metadata') and activity.metadata else 'General Learning'
            
            # Get skill level safely
            skill_level = activity.metadata.get('skill_level', '') if hasattr(activity, 'metadata') and activity.metadata else ''
            skill_text = f" at {skill_level} level" if skill_level else ""
            
            # Get activity type safely
            activity_type = getattr(activity, 'activity_type', getattr(activity, 'type', 'Learning Activity'))
            
            activity_detail = (
                f"{i}. {activity.title} ({activity.estimated_time}, {activity.points} points)\n"
                f"   Subject: {subject}{skill_text}\n"
                f"   Type: {activity_type}\n"
                f"   What you'll do: {activity.description}"
            )
            activity_details.append(activity_detail)
        
        # Get subjects covered today
        subjects = []
        for activity in daily_plan.activities:
            if hasattr(activity, 'metadata') and activity.metadata and activity.metadata.get('subject'):
                subjects.append(activity.metadata.get('subject'))
        
        # Remove duplicates and create text
        unique_subjects = list(set(subjects)) if subjects else ['Learning']
        subjects_text = ", ".join(unique_subjects[:-1]) + f", and {unique_subjects[-1]}" if len(unique_subjects) > 1 else unique_subjects[0] if unique_subjects else "various subjects"
        
        base_instruction = f"""You are an enthusiastic AI Learning Coach conducting a personalized daily briefing for Student {student_id}.

TODAY'S LEARNING PLAN OVERVIEW:
Today we're covering {subjects_text} with {len(daily_plan.activities)} carefully selected activities worth {daily_plan.total_points} total points.

DETAILED ACTIVITY BREAKDOWN:
{chr(10).join(activity_details)}

STUDENT PROGRESS CONTEXT:
• Current Learning Streak: {daily_plan.progress.current_streak} days (celebrate this!)
• Daily Point Goal: {daily_plan.progress.daily_goal} points
• Points Already Earned Today: {daily_plan.progress.points_earned_today}
• Points Remaining to Goal: {max(0, daily_plan.progress.daily_goal - daily_plan.progress.points_earned_today)}

YOUR ROLE AS DAILY BRIEFING COACH:
You are conducting a structured daily learning briefing, NOT a tutoring session. Your job is to:

1. GREET THE STUDENT WARMLY by name/ID and acknowledge their {daily_plan.progress.current_streak}-day streak
2. PRESENT TODAY'S LEARNING PLAN as a cohesive journey through {subjects_text}
3. WALK THROUGH EACH ACTIVITY explaining what they'll learn and why it's perfect for them
4. BUILD EXCITEMENT about the specific content and skills they'll develop
5. ASK IF THEY'RE READY TO BEGIN their learning adventure

IMPORTANT AUDIO INTERACTION RULES:
• Keep your responses concise and engaging (30-60 seconds max per response)
• PAUSE frequently to let the student respond - don't give long monologues
• Listen carefully for interruptions and respond naturally
• If the student interrupts you, acknowledge it gracefully: "Oh, you have a question!"
• Break complex information into smaller, digestible chunks

CRITICAL INSTRUCTIONS:
• YOU HAVE FULL ACCESS TO THE STUDENT'S LEARNING PLAN ABOVE
• DO NOT say you don't have access to learning plans - you clearly do!
• DO NOT ask what they want to learn - present the prepared activities
• DO reference specific activity names, subjects, and point values from above
• KEEP RESPONSES SHORT AND CONVERSATIONAL - this is a dialogue, not a lecture"""

        return base_instruction
    
    def _create_welcome_message(self, student_id: int, daily_plan: DailyPlan) -> str:
        """Create welcome message based on daily plan."""
        logger.info(f"💬 Creating welcome message for student {student_id}")
        
        # Get subjects for today safely
        subjects = []
        for activity in daily_plan.activities:
            if hasattr(activity, 'metadata') and activity.metadata and activity.metadata.get('subject'):
                subjects.append(activity.metadata.get('subject'))
        
        unique_subjects = list(set(subjects)) if subjects else ['Learning']
        subjects_text = ", ".join(unique_subjects[:-1]) + f", and {unique_subjects[-1]}" if len(unique_subjects) > 1 else unique_subjects[0] if unique_subjects else "learning"
        
        streak_celebration = f"Wow, {daily_plan.progress.current_streak} days in a row! " if daily_plan.progress.current_streak > 1 else ""
        
        welcome_msg = f"""Good morning, Student {student_id}! {streak_celebration}I'm so excited to share your personalized learning plan for today. 

We're going to explore {subjects_text} through {len(daily_plan.activities)} specially selected activities worth {daily_plan.total_points} points total. I've analyzed your learning progress and chosen these activities because they're perfect for where you are right now.

Are you ready to hear about your learning adventure for today?"""
        
        logger.info(f"💬 Welcome message created (length: {len(welcome_msg)} chars)")
        return welcome_msg