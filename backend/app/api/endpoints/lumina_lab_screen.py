# backend/app/api/endpoints/lumina_lab_screen.py
"""Screen-share lab: the smallest Gemini Live session that SEES the activity.

Experiment (2026-10-06): does a tutor that sees the screen, hears the child and
can point make a count -> total -> numeral item land for a 4-year-old? The page
(/lumina/lab/screen-count) runs the item itself; this socket only relays mic
audio, JPEG frames of the stage, and step events to Live, and relays speech and
pointer tool calls back. No lesson context, scaffold, levers or observers.

Dev-only. Every session is a paid Live session (video frames add input tokens).
"""
import asyncio
import base64
import json
import logging
import os
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

from ...core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

MODEL = os.environ.get("LUMINA_LIVE_MODEL") or "gemini-3.8-live"
VOICE = "Leda"

client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options={"api_version": "v1beta"})

INSTRUCTION = """You are Pip, a friendly helper sitting beside {name}, who is 4 years old.
You can SEE the screen (images arrive about once a second) and HEAR {name}.

The screen runs the activity by itself. Each item has three steps:
1. COUNT: {name} touches each truck. Each touched truck shows its number. The glowing truck is the next one to touch.
2. HOW MANY: after the last touch, a loop goes around the whole group. You ask how many altogether.
3. FIND THE NUMBER: two big numbers appear; {name} taps the one that matches.

Language: speak and write ONLY in English (US), every turn, even if the audio sounds like another language.
Never output anything that is not words for {name}: no other languages, no markup, no "<no speech>" or "{{pause}}" tokens. If you have nothing to say, say nothing.

How to talk:
- Very short: at most 6 words at a time. One idea at a time. Warm, calm, never fast.
- While {name} is counting, stay quiet unless he stops for a long time. You may count WITH him ("three!") only if he is counting out loud.
- Show, don't just talk: use point_at whenever you mention something on screen.
- When an event says he finished counting: ask "How many trucks altogether?" and wait.
  - If he says the right number: say it back ("Four trucks!") and call reveal_numbers.
  - If he says a wrong number or nothing after a while: call point_at("group"), say the total yourself ("Four altogether."), then call reveal_numbers.
- When numbers appear: ask which number says the total (for four: "Which number says four?"). If he picks wrong, call point_at on the right number and say "This one says four." Never shame.
- When an event says he got it, celebrate in 3 words or less.

Events from the screen arrive as text starting with [SCREEN]. They are not {name} talking. Never read them aloud.
"""

TOOLS = [types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name="point_at",
        description="Move Pip's pointing hand to something on screen so the child looks there.",
        parameters=types.Schema(type=types.Type.OBJECT, properties={
            "target": types.Schema(
                type=types.Type.STRING,
                description='"truck-1", "truck-2", ... (left to right), "group" (loop the whole group), "number-left", "number-right"',
            ),
        }, required=["target"]),
    ),
    types.FunctionDeclaration(
        name="reveal_numbers",
        description="Show the two number cards. Call only after the total has been said (by the child or by you).",
        parameters=types.Schema(type=types.Type.OBJECT, properties={}),
    ),
])]


def _dev_backend() -> bool:
    return settings.ENVIRONMENT.lower() in ("dev", "development", "local", "test")


@router.websocket("/lab/screen-tutor")
async def screen_tutor(websocket: WebSocket):
    await websocket.accept()
    if not _dev_backend():
        await websocket.close(code=4003, reason="Lab requires a development backend")
        return
    try:
        auth_data = json.loads(await asyncio.wait_for(websocket.receive_text(), timeout=10.0))
        from firebase_admin import auth
        auth.verify_id_token(str(auth_data.get("token", "")).replace("Bearer ", ""), clock_skew_seconds=10)
    except Exception as error:
        logger.warning(f"[lab] auth failed: {error}")
        await websocket.close(code=4001, reason="Authentication required")
        return

    name = str(auth_data.get("name") or "the child")[:40]
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)),
            language_code="en-US",
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        system_instruction=types.Content(parts=[types.Part(text=INSTRUCTION.format(name=name))]),
        tools=TOOLS,
    )
    counts = {"frames": 0, "audio": 0, "events": 0}

    try:
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            await websocket.send_json({"type": "ready", "model": MODEL})

            async def from_client():
                while True:
                    msg: Dict[str, Any] = await websocket.receive_json()
                    kind = msg.get("type")
                    if kind == "audio":
                        counts["audio"] += 1
                        await session.send_realtime_input(audio=types.Blob(
                            data=base64.b64decode(msg["data"]), mime_type="audio/pcm;rate=16000"))
                    elif kind == "frame":
                        counts["frames"] += 1
                        await session.send_realtime_input(video=types.Blob(
                            data=base64.b64decode(msg["data"]), mime_type="image/jpeg"))
                    elif kind == "event":
                        counts["events"] += 1
                        logger.info(f"[lab] event: {msg.get('text')}")
                        await session.send_realtime_input(text=f"[SCREEN] {msg.get('text', '')}")
                    elif kind == "tool_result":
                        await session.send_tool_response(function_responses=[types.FunctionResponse(
                            id=msg.get("id"), name=msg.get("name"), response={"result": msg.get("result", "ok")})])

            async def from_gemini():
                while True:
                    async for response in session.receive():
                        content = response.server_content
                        if response.tool_call:
                            for call in response.tool_call.function_calls or []:
                                logger.info(f"[lab] tool {call.name}({call.args})")
                                await websocket.send_json({"type": "tool", "id": call.id, "name": call.name, "args": call.args or {}})
                        if not content:
                            continue
                        if content.model_turn:
                            for part in content.model_turn.parts or []:
                                if part.inline_data and part.inline_data.data:
                                    await websocket.send_json({"type": "audio",
                                        "data": base64.b64encode(part.inline_data.data).decode(), "sampleRate": 24000})
                        if content.output_transcription and content.output_transcription.text:
                            await websocket.send_json({"type": "transcript", "role": "pip", "text": content.output_transcription.text})
                        if content.input_transcription and content.input_transcription.text:
                            await websocket.send_json({"type": "transcript", "role": "child", "text": content.input_transcription.text})
                        if content.interrupted:
                            await websocket.send_json({"type": "interrupted"})
                        if content.turn_complete:
                            await websocket.send_json({"type": "turn_end"})

            tasks = [asyncio.create_task(from_client()), asyncio.create_task(from_gemini())]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
            for task in pending:
                task.cancel()
            for task in done:
                if task.exception() and not isinstance(task.exception(), WebSocketDisconnect):
                    raise task.exception()
    except WebSocketDisconnect:
        pass
    except Exception as error:
        logger.error(f"[lab] session error: {error}")
        try:
            await websocket.send_json({"type": "error", "message": str(error)})
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        logger.info(f"[lab] session closed: {counts}")
