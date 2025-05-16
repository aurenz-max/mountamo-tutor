from fastapi import APIRouter, WebSocket
from starlette.websockets import WebSocketDisconnect
import uuid
import json
from google import genai
print(f"Attributes of google.genai: {dir(genai)}") # ADD THIS LINE
from ...services.gemini import GeminiLiveService
from ...core.config import settings

router = APIRouter()
gemini_service = GeminiLiveService()

async def handle_websocket_session(websocket: WebSocket, prompt: str, handler_callback):
    session_id = str(uuid.uuid4())
    await websocket.accept()
    
    try:
        session_handler = await gemini_service.create_session(
            session_id=session_id,
            system_prompt=prompt
        )

        while True:
            try:
                message = await websocket.receive()
                if "text" in message:
                    user_input = message["text"]
                    if user_input.lower() == "exit":
                        break
                    await session_handler.send_input(user_input)
                elif "bytes" in message:
                    await session_handler.send_input(
                        content=message["bytes"],
                        content_type="image"
                    )

                async for response_chunk in session_handler.stream_responses():
                    await websocket.send_text(json.dumps({
                        "type": "text_response",
                        "content": response_chunk
                    }))

            except Exception as e:
                print(f"Caught an exception: {e}") # Print the exception for debugging
                await session_handler._reconnect()
                await websocket.send_text(json.dumps({
                    "type": "system",
                    "content": "Reconnected to AI service due to error"
                }))

    except WebSocketDisconnect:
        pass
    finally:
        await gemini_service.close_session(session_id)
        await websocket.close()

@router.websocket("/ws/tutoring")
async def tutoring_session(websocket: WebSocket):
    await handle_websocket_session(
        websocket,
        settings.GEMINI_TUTOR_PROMPT,
        lambda sh, data: sh.stream_responses()
    )

@router.websocket("/ws/assessment")
async def realtime_assessment(websocket: WebSocket):
    session_id = str(uuid.uuid4())
    await websocket.accept()

    try:
        session_handler = await gemini_service.create_session(
            session_id=session_id,
            system_prompt=settings.GEMINI_ASSESSMENT_PROMPT
        )

        while True:
            try:
                data = await websocket.receive_json()

                if data["type"] == "evaluate_answer":
                    async for update in session_handler.evaluate_answer_interactive(
                        question=data["question"],
                        user_answer=data["answer"],
                        content=data["lesson_content"]
                    ):
                        await websocket.send_json(update)

                elif data["type"] == "generate_questions":
                    async for update in session_handler.generate_questions_bidirectional(
                        content=data["content"],
                        num_questions=data.get("count", 5)
                    ):
                        await websocket.send_json(update)

            except Exception as e: # Changed to catch general Exception
                print(f"Caught an exception: {e}") # Print the exception for debugging
                await session_handler._reconnect()
                await websocket.send_text(json.dumps({
                    "type": "system",
                    "content": "Reconnected to AI service due to error"
                }))

    except WebSocketDisconnect:
        pass
    finally:
        await gemini_service.close_session(session_id)