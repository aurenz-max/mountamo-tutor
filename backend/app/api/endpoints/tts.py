from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, JSONResponse
import asyncio
from typing import Optional
import uuid
import base64
from ...services.audio_session_manager import AudioSessionManager
from ...services.gemini import GeminiService

app = FastAPI()

@app.post("/tts")
async def text_to_speech(text: str, voice_name: Optional[str] = None):
    session_id = str(uuid.uuid4())
    audio_data = None
    
    async def audio_callback(data: bytes):
        nonlocal audio_data
        audio_data = data
    
    async def text_callback(text: str):
        pass  # We don't need text responses for TTS
        
    manager = AudioSessionManager(GeminiService)  # Initialize with your service
    
    try:
        await manager.start_conversation_session(
            session_id=session_id,
            on_text_callback=text_callback,
            on_audio_callback=audio_callback
        )
        
        await manager.send_text(text, session_id)
        
        # Wait for audio response with timeout
        timeout = 30  # seconds
        start_time = asyncio.get_event_loop().time()
        
        while not audio_data:
            if asyncio.get_event_loop().time() - start_time > timeout:
                raise HTTPException(status_code=408, detail="TTS generation timeout")
            await asyncio.sleep(0.1)
            
        # Convert audio data to base64
        base64_audio = base64.b64encode(audio_data).decode('utf-8')
        
        return JSONResponse(content={
            "audio": base64_audio,
            "sampleRate": 24000,  # Matching your frontend's expected sample rate
            "format": "pcm"
        })
        
    finally:
        await manager.close_session(session_id)