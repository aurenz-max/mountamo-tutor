# backend/app/services/anthropic.py

from anthropic import Anthropic, AsyncAnthropic
from ..core.config import settings
from .base_ai_service import BaseAIService
from typing import List, Dict, Any, Optional, Union

class AnthropicService(BaseAIService):
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        #self.model = "claude-3-5-haiku-20241022"
        self.model = "claude-3-5-sonnet-20241022"

    async def generate_response(
        self, 
        prompt: Union[str, List[Dict[str, Any]]], 
        system_instructions: Optional[str] = None
    ) -> str:
        try:
            print("Generating response with:", prompt)  # Debug log
            
            # Create messages list in correct format for the API
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                messages=prompt if isinstance(prompt, list) else [{"role": "user", "content": prompt}],
                system=system_instructions if system_instructions else "You are a friendly and encouraging kindergarten tutor.",
                # Add this line to fix the temperature setting:
                temperature=0.6
            )
            return response.content[0].text.strip()
        except Exception as e:
            print(f"Error in generate_response: {str(e)}")
            raise

    # Rest of your methods remain the same...
    async def generate_questions(self, content: str, num_questions: int = 5) -> List[str]:
        prompt = f"""Based on the following content, generate {num_questions} diverse, age-appropriate questions for a 5-year-old. 
        Guidelines:
        1. Vary question types (recall, understanding, application)
        2. Use simple language for kindergarteners
        3. Make questions engaging and relatable
        4. Include creative thinking questions
        5. Ensure questions directly relate to content
        6. Questions should be answerable verbally

        Content:
        {content}

        Generate {num_questions} questions:"""

        try:
            response = await self.generate_response(
                prompt,
                system_instructions="You are an expert at creating engaging questions for kindergarten students."
            )
            questions = [q.strip() for q in response.split('\n') if q.strip()]
            return questions[:num_questions]
        except Exception as e:
            print(f"Error generating questions: {str(e)}")
            raise

    async def evaluate_answer(self, question: str, user_answer: str, content: str) -> Dict[str, Any]:
        prompt = f"""Content: {content}
        Question: {question}
        User's answer: {user_answer}

        Evaluate this kindergartener's answer. Provide:
        1. A score (0 or 1)
        2. Brief, encouraging feedback suitable for a 5-year-old
        
        Format: Score: [0/1]
        Feedback: [Your feedback]"""

        try:
            response = await self.generate_response(
                prompt,
                system_instructions="You are an encouraging teacher evaluating a kindergarten student's answer.",
                
                
            )
            
            # Parse response to extract score and feedback
            lines = response.split('\n')
            score = int(lines[0].split(':')[1].strip())
            feedback = lines[1].split(':')[1].strip()
            
            return {
                "score": score,
                "feedback": feedback
            }
        except Exception as e:
            print(f"Error evaluating answer: {str(e)}")
            raise

    async def summarize_session(self, conversation_text: str) -> str:
        """
        Dedicated method for summarizing tutoring sessions using haiku model.
        
        Args:
            conversation_text: The full conversation text with speaker labels and timestamps
                
        Returns:
            A string containing the session summary
        """
        try:
            # Always use haiku for summaries for performance
            session_model = "claude-3-5-haiku-20241022"
            
            system_instructions = (
                "You are an assistant that summarizes a tutoring session. "
                "Please provide the main concepts, student's understanding, and next steps. "
                "Ignore timestamps in the conversation and focus on the educational content. "
                "Format your response with clear sections."
            )
            
            user_prompt = f"Summarize this tutoring session:\n\n{conversation_text}"
            
            # Create message in the format expected by the API
            messages = [{"role": "user", "content": user_prompt}]
            
            # Call the Anthropic API directly for this specific use case
            response = await self.client.messages.create(
                model=session_model,
                max_tokens=600,  # Shorter summary
                messages=messages,
                system=system_instructions,
                temperature=0.3  # Lower temperature for more consistent summaries
            )
            
            return response.content[0].text.strip()
        except Exception as e:
            print(f"Error in summarize_session: {str(e)}")
            raise
