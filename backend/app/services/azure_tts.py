import azure.cognitiveservices.speech as speechsdk
import asyncio
from datetime import datetime
import json
import logging
from typing import Optional, Dict, Any, Callable
import numpy as np
from ..core.config import settings
from ..db.cosmos_db import CosmosDBService

logger = logging.getLogger(__name__)

class AzureSpeechService:
    def __init__(self):
        self.speech_config = speechsdk.SpeechConfig(
            subscription=settings.TTS_KEY, 
            region=settings.TTS_REGION
        )
        self.speech_recognizer = None
        self.audio_config = None
        self.transcript_callback = None
        self.cosmos_db = CosmosDBService()
        
    async def process_and_store_speech(
        self,
        audio_data: np.ndarray,
        speaker_type: str,
        session_id: str,
        student_id: int
    ) -> Dict[str, Any]:
        """Process speech and store in CosmosDB"""
        try:
            # Convert numpy array to bytes
            audio_bytes = audio_data.tobytes()
            
            # Create push stream
            push_stream = speechsdk.audio.PushAudioInputStream()
            push_stream.write(audio_bytes)
            
            # Configure audio input
            self.audio_config = speechsdk.audio.AudioConfig(stream=push_stream)
            
            # Initialize speech recognizer
            self.speech_recognizer = speechsdk.SpeechRecognizer(
                speech_config=self.speech_config,
                audio_config=self.audio_config
            )
            
            # Create done event
            done = asyncio.Event()
            result = None

            def handle_result(evt):
                nonlocal result
                result = evt.result
                done.set()
                
            # Connect callbacks
            self.speech_recognizer.recognized.connect(handle_result)
            self.speech_recognizer.session_stopped.connect(lambda evt: done.set())
            
            # Start recognition
            self.speech_recognizer.start_continuous_recognition()
            
            # Wait for result or timeout
            try:
                await asyncio.wait_for(done.wait(), timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning(f"Speech recognition timed out for session {session_id}")
                return self._create_response(None, speaker_type, session_id, error="Recognition timeout")
            finally:
                self.speech_recognizer.stop_continuous_recognition()
                push_stream.close()
            
            # Process results
            if result and result.reason == speechsdk.ResultReason.RecognizedSpeech:
                # Create response
                response = self._create_response(result.text, speaker_type, session_id)
                
                # Store in CosmosDB
                timestamp = datetime.utcnow().isoformat()
                await self.cosmos_db.save_conversation_message(
                    session_id=session_id,
                    student_id=student_id,
                    speaker=speaker_type,
                    message=result.text,
                    timestamp=timestamp
                )
                
                return response
            else:
                return self._create_response(None, speaker_type, session_id, error="No speech recognized")
                
        except Exception as e:
            logger.error(f"Error processing speech: {str(e)}")
            return self._create_response(None, speaker_type, session_id, error=str(e))

    def _create_response(
        self,
        text: Optional[str],
        speaker_type: str,
        session_id: str,
        error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create standardized response format"""
        response = {
            "type": "transcript",
            "session_id": session_id,
            "speaker": speaker_type,
            "timestamp": datetime.utcnow().isoformat(),
            "success": error is None,
            "data": {
                "text": text if text else None,
                "error": error if error else None
            }
        }
        return response