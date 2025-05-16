# backend/app/services/gemini.py
from google import genai
from typing import List, Dict, Any, Optional, AsyncGenerator, Union
import asyncio
import json
from tenacity import retry, stop_after_attempt, wait_exponential
from ..core.config import settings

class GeminiLiveService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options={'api_version': 'v1alpha'})
        self.model = "gemini-2.0-flash-exp"
        self.active_sessions: Dict[str, "GeminiSessionHandler"] = {}


        print(f"GEMINI_API_KEY present: {bool(settings.GEMINI_API_KEY)}")
        print(f"Model being used: {self.model}")

    async def create_session(
        self,
        session_id: str,
        system_prompt: Optional[str] = None
    ) -> "GeminiSessionHandler":
        if session_id in self.active_sessions:
            return self.active_sessions[session_id]

        handler = GeminiSessionHandler(
            client=self.client,
            model=self.model,
            system_prompt=system_prompt
        )

        await handler.initialize()
        self.active_sessions[session_id] = handler
        return handler

    async def close_session(self, session_id: str):
        if session_id in self.active_sessions:
            await self.active_sessions[session_id].close()
            del self.active_sessions[session_id]

class GeminiSessionHandler:
    def __init__(
        self,
        client: genai.Client,
        model: str,
        system_prompt: Optional[str] = None
    ):
        self.client = client
        self.model = model
        self.system_prompt = system_prompt
        self.session: Optional[genai.AsyncLiveSession] = None
        self.connection = None  # Will hold the persistent connection

    async def initialize(self):
        config = {
            "generation_config": {
                "response_modalities": ["TEXT"],
                "temperature": 0.5
            },
            "model": self.model,
            "system_instruction": self.system_prompt if self.system_prompt else "",
            "tools": []
        }

        self.connection = self.client.aio.live.connect(
            model=self.model,
            config=config["generation_config"]
        )

        async with self.connection as session:
            self.session = session
            print(f"Type of self.session: {type(self.session)}")
            print(f"Value of self.session: {self.session}") # ADDED PRINT STATEMENT
            test_message = "Hello Gemini Live API"
            await self.session.send(test_message)

    async def send_input(self, content):
        """For subsequent messages - use the already established self.session, send BidiGenerateContentClientContent"""
        if self.session: # Check if session is initialized
            client_content_message = {
                "BidiGenerateContentClientContent": {
                    "content": {
                        "parts": [{"text": content}]
                    }
                }
            }
            await self.session.send(json.dumps(client_content_message))
        else:
            print("Error: self.session is not initialized!")

    async def stream_responses(self) -> AsyncGenerator[str, None]:
        if not self.session: # Check if session is initialized
            yield "[SESSION_ERROR: Session not initialized]"
            return

        try:
            async for response in self.session:
                if response.text:
                    yield response.text
                elif response.audio:
                    yield f"[AUDIO_RESPONSE:{len(response.audio)}]"
                elif response.image:
                    yield f"[IMAGE_RESPONSE:{response.image.description}]"
        except genai.APIConnectionError:
            await self._reconnect()
            yield "[SESSION_RECONNECTED]"
        except Exception as e: # Catch general exceptions for streaming
            yield f"[SESSION_ERROR: Streaming error - {e}]"

    async def generate_questions_bidirectional(
        self,
        content: str,
        num_questions: int = 5
    ) -> AsyncGenerator[Dict[str, Any], None]:
        await self.send_input(
            f"Generate {num_questions} questions about: {content}\n"
            "Follow these rules:\n"
            "1. Use simple words\n"
            "2. Encourage creativity\n"
            "3. One question per line"
        )

        collected = []
        async for response in self.stream_responses():
            new_questions = [
                q.strip() for q in response.split('\n')
                if q.strip() and not q.startswith(('1.', '2.', '3.'))
            ]

            for q in new_questions:
                if q not in collected and len(collected) < num_questions:
                    collected.append(q)
                    yield {
                        "status": "partial",
                        "questions": collected.copy(),
                        "completed": False
                    }

            if len(collected) >= num_questions:
                await self.session.interrupt()
                break

        yield {
            "status": "complete",
            "questions": collected[:num_questions],
            "completed": True
        }

    async def evaluate_answer_interactive(
        self,
        question: str,
        user_answer: str,
        content: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        await self.send_input(
            f"Evaluate this kindergarten answer:\n"
            f"Content: {content}\n"
            f"Question: {question}\n"
            f"Answer: {user_answer}\n"
            "Provide feedback in this JSON format:\n"
            "{{\"score\": 0-1, \"feedback\": \"...\"}}\n"
            "Start analysis:"
        )

        buffer = []
        async for response in self.stream_responses():
            buffer.append(response)

            try:
                raw = " ".join(buffer)
                json_str = raw[raw.index('{'):raw.rindex('}')+1]
                result = json.loads(json_str)
                yield {"status": "structured", **result}
                return
            except (ValueError, json.JSONDecodeError):
                continue
            finally:
                yield {
                    "status": "analysis",
                    "feedback": response,
                    "score": None
                }

        # Fallback processing
        final_text = " ".join(buffer)
        score = 1 if any(kw in final_text.lower() for kw in ["good", "correct", "yes"]) else 0
        yield {
            "status": "completed",
            "score": score,
            "feedback": final_text
        }

    async def _reconnect(self):
        await self.close()
        await self.initialize()


      
    async def close(self):
        if self.connection:
            try:
                async with self.connection: # Try to enter context to close
                    pass # Exit context to trigger close
            except Exception as e:
                print(f"Error during connection close (likely already closed): {e}")
                pass
            self.connection = None
        self.session = None

    

