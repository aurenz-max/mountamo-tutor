# backend/app/services/gemini_service.py
# Using the new Google Gen AI SDK for Gemini 2.0
from google import genai
from google.genai import types
from ..core.config import settings
from typing import List, Dict, Any, Optional, Union
import json
import base64
import logging
import re  # Add the missing import

from .base_ai_service import BaseAIService

logger = logging.getLogger(__name__)

class GeminiGenerateService(BaseAIService):
    def __init__(self):
        # Initialize with the client approach (similar to gemini_read_along.py)
        try:
            # Configure using Client like in the working gemini_read_along.py
            self.client = genai.Client(
                api_key=settings.GEMINI_GENERATE_KEY,
                http_options={"api_version": "v1alpha"},
            )
            
            # Store model ID for reference
            self.model_id = 'gemini-2.0-flash-lite'
            logger.info("Gemini Generate service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini Generate service: {str(e)}")
            raise
        
    async def generate_response(
        self, 
        prompt: Union[str, List[Dict[str, Any]]], 
        system_instructions: Optional[str] = None,
        clean_json: bool = True  # Default to cleaning JSON responses
    ) -> str:
        """
        Generate a response using Gemini API with compatible interface to AnthropicService
        
        Args:
            prompt: Either a string or a list of message objects
            system_instructions: System instructions (will be prepended to prompt)
            clean_json: Whether to clean JSON responses from markdown formatting
            
        Returns:
            Generated text response
        """
        try:
            print("Generating response with Gemini:", prompt)  # Debug log
            
            # Handle different prompt types (string vs message list)
            if isinstance(prompt, str):
                # For string prompts
                full_prompt = f"{system_instructions}\n\n{prompt}" if system_instructions else prompt
                
                # Use client.aio.models.generate_content pattern
                response = await self.client.aio.models.generate_content(
                    model=f"models/{self.model_id}",
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.6,
                        max_output_tokens=2056
                    )
                )
                
                # Extract text from response
                if response and response.candidates and response.candidates[0].content.parts:
                    text_response = response.candidates[0].content.parts[0].text.strip()
                    # Add debug log to see raw response before cleaning
                    print(f"[DEBUG] Raw Gemini response before cleaning: {text_response[:200]}...")
                    logger.debug(f"Raw Gemini response before cleaning: {text_response[:200]}...")
                    # Clean JSON if needed
                    if clean_json:
                        cleaned_response = self._clean_json_response(text_response)
                        print(f"[DEBUG] Cleaned response: {cleaned_response[:200]}...")
                        return cleaned_response
                    return text_response
                # Add debug log for empty response case
                print("[WARNING] Empty response received from Gemini")
                logger.warning("Empty response received from Gemini")
                return ""  # Only return empty string if no response
                
            else:
                # Handle Anthropic-style message format with potential images
                # Convert to Google's expected format
                google_content = []
                has_images = False
                
                # Process the prompt messages
                for message in prompt:
                    if message["role"] == "user":
                        if isinstance(message["content"], list):
                            # Multi-part content (potentially with images)
                            google_parts = []
                            
                            # First add system instructions if any
                            if system_instructions:
                                google_parts.append(types.Part(text=system_instructions))
                            
                            for part in message["content"]:
                                if part["type"] == "text":
                                    google_parts.append(types.Part(text=part["text"]))
                                elif part["type"] == "image":
                                    has_images = True
                                    # Handle base64 image
                                    if part["source"]["type"] == "base64":
                                        try:
                                            # Decode base64 data before sending to Gemini
                                            image_bytes = base64.b64decode(part["source"]["data"])
                                            google_parts.append(
                                                types.Part(
                                                    inline_data=types.Blob(
                                                        mime_type=part["source"]["media_type"],
                                                        data=image_bytes
                                                    )
                                                )
                                            )
                                        except Exception as e:
                                            logger.error(f"Error processing image: {str(e)}")
                                            raise
                            
                            # Create a content object with the parts
                            google_content.append(
                                types.Content(
                                    parts=google_parts,
                                    role="user"
                                )
                            )
                        else:
                            # Simple text content
                            text_content = message["content"]
                            if system_instructions:
                                text_content = f"{system_instructions}\n\n{text_content}"
                            google_content.append(
                                types.Content(
                                    parts=[types.Part(text=text_content)],
                                    role="user"
                                )
                            )
                
                # Generate content with the properly formatted request
                response = await self.client.aio.models.generate_content(
                    model=f"models/{self.model_id}",
                    contents=google_content,
                    config=types.GenerateContentConfig(
                        temperature=0.6,
                        max_output_tokens=1024
                    )
                )
                
                # Extract text from response
                if response and response.candidates and response.candidates[0].content.parts:
                    text_response = response.candidates[0].content.parts[0].text.strip()
                    # Add debug log to see raw response before cleaning
                    print(f"[DEBUG] Raw Gemini response from message format before cleaning: {text_response[:200]}...")
                    logger.debug(f"Raw Gemini response from message format before cleaning: {text_response[:200]}...")
                    # Clean JSON if needed
                    if clean_json:
                        cleaned_response = self._clean_json_response(text_response)
                        print(f"[DEBUG] Cleaned response from message format: {cleaned_response[:200]}...")
                        return cleaned_response
                    return text_response
                # Add debug log for empty response case
                print("[WARNING] Empty response received from Gemini message format")
                logger.warning("Empty response received from Gemini message format")
                return ""
                
        except Exception as e:
            logger.error(f"Error in Gemini generate_response: {str(e)}")
            raise

    def _clean_json_response(self, response_text: str) -> str:
        """
        Clean Gemini responses that may include markdown code blocks around JSON
        
        Args:
            response_text: The raw response text from Gemini
            
        Returns:
            Cleaned text with markdown formatting removed
        """
        # Log the incoming text
        print(f"[DEBUG] Cleaning JSON response: {response_text[:50]}...")
        
        # Simple cleaning approach without regex if regex causes issues
        if response_text.startswith("```json"):
            # Find the first and last occurrences of ``` and extract the content between them
            start_idx = response_text.find("\n") + 1  # Skip the first line with ```json
            end_idx = response_text.rfind("```")
            if start_idx > 0 and end_idx > start_idx:
                cleaned = response_text[start_idx:end_idx].strip()
                print(f"[DEBUG] Cleaned JSON using string slicing: {cleaned[:50]}...")
                return cleaned
        elif response_text.startswith("```"):
            # Handle case without json specifier
            start_idx = response_text.find("\n") + 1  # Skip the first line with ```
            end_idx = response_text.rfind("```")
            if start_idx > 0 and end_idx > start_idx:
                cleaned = response_text[start_idx:end_idx].strip()
                print(f"[DEBUG] Cleaned JSON using string slicing: {cleaned[:50]}...")
                return cleaned
        
        # Try regex approach if slice method not applicable
        try:
            if response_text.startswith("```json") or response_text.startswith("```"):
                # Remove the markdown code block markers
                cleaned = re.sub(r'^```(?:json)?\s*', '', response_text)
                cleaned = re.sub(r'\s*```$', '', cleaned)
                print(f"[DEBUG] Cleaned JSON using regex: {cleaned[:50]}...")
                return cleaned.strip()
        except Exception as e:
            print(f"[WARNING] Error using regex to clean JSON: {str(e)}")
            logger.warning(f"Error using regex to clean JSON: {str(e)}")
        
        # If not wrapped in code blocks or cleaning failed, return as is
        return response_text

    async def generate_questions(self, content: str, num_questions: int = 5) -> List[str]:
        """Generate questions based on content"""
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
            system_instructions = "You are an expert at creating engaging questions for kindergarten students."
            
            # Generate with system instructions
            full_prompt = f"{system_instructions}\n\n{prompt}"
            
            # Use client.aio.models.generate_content pattern
            response = await self.client.aio.models.generate_content(
                model=f"models/{self.model_id}",
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=1024
                )
            )
            
            # Extract text from response
            if response and response.candidates and response.candidates[0].content.parts:
                text_response = response.candidates[0].content.parts[0].text.strip()
                # Extract questions
                questions = [q.strip() for q in text_response.split('\n') if q.strip()]
                return questions[:num_questions]
            return []
            
        except Exception as e:
            logger.error(f"Error generating questions with Gemini: {str(e)}")
            raise

    async def evaluate_answer(self, question: str, user_answer: str, content: str) -> Dict[str, Any]:
        """Evaluate a user's answer to a question"""
        prompt = f"""Content: {content}
        Question: {question}
        User's answer: {user_answer}

        Evaluate this kindergartener's answer. Provide:
        1. A score (0 or 1)
        2. Brief, encouraging feedback suitable for a 5-year-old
        
        Format: Score: [0/1]
        Feedback: [Your feedback]"""

        try:
            system_instructions = "You are an encouraging teacher evaluating a kindergarten student's answer."
            
            # Generate with system instructions
            full_prompt = f"{system_instructions}\n\n{prompt}"
            
            # Use client.aio.models.generate_content pattern
            response = await self.client.aio.models.generate_content(
                model=f"models/{self.model_id}",
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=1024
                )
            )
            
            # Extract text from response
            if response and response.candidates and response.candidates[0].content.parts:
                text_response = response.candidates[0].content.parts[0].text.strip()
                
                # Parse response to extract score and feedback
                lines = text_response.split('\n')
                score_line = next((line for line in lines if line.lower().startswith('score:')), 'Score: 0')
                feedback_line = next((line for line in lines if line.lower().startswith('feedback:')), 'Feedback: Good try!')
                
                score = int(score_line.split(':')[1].strip())
                feedback = feedback_line.split(':')[1].strip()
                
                return {
                    "score": score,
                    "feedback": feedback
                }
            return {"score": 0, "feedback": "Unable to evaluate the answer."}
            
        except Exception as e:
            logger.error(f"Error evaluating answer with Gemini: {str(e)}")
            raise

    async def summarize_session(self, conversation_text: str) -> str:
        """Summarize a tutoring session"""
        try:
            system_instructions = (
                "You are an assistant that summarizes a tutoring session. "
                "Please provide the main concepts, student's understanding, and next steps. "
                "Ignore timestamps in the conversation and focus on the educational content. "
                "Format your response with clear sections."
            )
            
            user_prompt = f"Summarize this tutoring session:\n\n{conversation_text}"
            
            # Generate with system instructions
            full_prompt = f"{system_instructions}\n\n{user_prompt}"
            
            # Use client.aio.models.generate_content pattern
            response = await self.client.aio.models.generate_content(
                model=f"models/{self.model_id}",
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=600
                )
            )
            
            # Extract text from response
            if response and response.candidates and response.candidates[0].content.parts:
                return response.candidates[0].content.parts[0].text.strip()
            return "Unable to summarize the session."
            
        except Exception as e:
            logger.error(f"Error in Gemini summarize_session: {str(e)}")
            raise