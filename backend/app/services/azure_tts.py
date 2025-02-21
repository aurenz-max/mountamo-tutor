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
logger.setLevel(logging.INFO)

class SpeakerTracker:
    def __init__(self, default_speaker: str = "user"):
        self.current_speaker = default_speaker
        logger.info(f"SpeakerTracker initialized with default speaker: {default_speaker}")

    def set_speaker(self, speaker: str) -> None:
        old_speaker = self.current_speaker
        self.current_speaker = speaker
        logger.debug(f"Speaker changed: {old_speaker} -> {speaker}")

    def get_speaker(self) -> str:
        logger.debug(f"Current speaker requested: {self.current_speaker}")
        return self.current_speaker

class AzureSpeechService:
    def __init__(self):
        self.speech_config = speechsdk.SpeechConfig(
            subscription=settings.TTS_KEY,
            region=settings.TTS_REGION
        )
        self.push_stream = None
        self.audio_config = None
        self.speech_recognizer = None
        self.speaker_tracker = SpeakerTracker(default_speaker="user")
        self._transcript_callback = None

    async def start_continuous_transcription(
        self,
        session_id: str,
        student_id: int,
        transcript_callback: Callable[[Dict[str, Any]], None]
    ) -> None:
        """
        Single push stream for both user & gemini.
        We'll label recognized text by whichever speaker was set last.
        """
        logger.info(f"Starting continuous transcription for session {session_id}, student {student_id}")
        self._transcript_callback = transcript_callback

        self.push_stream = speechsdk.audio.PushAudioInputStream()
        self.audio_config = speechsdk.audio.AudioConfig(stream=self.push_stream)

        self.speech_recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=self.audio_config
        )

        def recognized_handler(evt):
            text = evt.result.text
            speaker_type = self.speaker_tracker.get_speaker()
            logger.info(f"Speech recognized for session {session_id}: '{text}' (speaker: {speaker_type})")
            
            # Create a callback that properly handles the async function
            def run_callback():
                loop = asyncio.get_event_loop()
                coroutine = self._create_response(
                    transcript=text,
                    speaker_type=speaker_type,
                    session_id=session_id,
                    student_id=student_id,
                    callback=transcript_callback
                )
                loop.create_task(coroutine)
            
            # Call the callback from the main thread
            run_callback()
        
        # Add handlers for other speech events to help with debugging
        def recognizing_handler(evt):
            logger.debug(f"Session {session_id}: Recognizing speech: {evt.result.text}")
        
        def canceled_handler(evt):
            logger.warning(f"Session {session_id}: Speech recognition canceled. Reason: {evt.result.reason}")
            if evt.result.reason == speechsdk.CancellationReason.Error:
                logger.error(f"Session {session_id}: Speech recognition error: {evt.result.error_details}")
        
        def session_started_handler(evt):
            logger.info(f"Session {session_id}: Speech recognition session started")
        
        def session_stopped_handler(evt):
            logger.info(f"Session {session_id}: Speech recognition session stopped")

        # Connect all event handlers
        self.speech_recognizer.recognized.connect(recognized_handler)
        self.speech_recognizer.recognizing.connect(recognizing_handler)
        self.speech_recognizer.canceled.connect(canceled_handler)
        self.speech_recognizer.session_started.connect(session_started_handler)
        self.speech_recognizer.session_stopped.connect(session_stopped_handler)
        
        logger.info(f"Starting continuous recognition for session {session_id}")
        self.speech_recognizer.start_continuous_recognition()
        logger.info(f"Continuous recognition started for session {session_id}")

    async def stop_continuous_transcription(self) -> None:
        if self.speech_recognizer:
            self.speech_recognizer.stop_continuous_recognition()
        if self.push_stream:
            self.push_stream.close()

    async def write_audio(self, audio_data: bytes, speaker: str = "user") -> None:
        """
        Write to the single push stream, setting a local speaker label.
        If gemini is the one generating audio, call with speaker=\"gemini\".
        """
        if self.push_stream:
            # Set the speaker BEFORE writing data
            previous_speaker = self.speaker_tracker.get_speaker()
            self.speaker_tracker.set_speaker(speaker)
            data_size = len(audio_data)
            logger.debug(f"Writing {data_size} bytes of audio data to push stream. Speaker changed: {previous_speaker} -> {speaker}")
            
            # Write audio after setting speaker
            self.push_stream.write(audio_data)
            
            # Log the current speaker for debugging
            logger.debug(f"Current speaker after write: {self.speaker_tracker.get_speaker()}")
        else:
            logger.warning("Attempted to write audio data but push_stream is None")

    async def _create_response(
        self,
        transcript: Optional[str],
        speaker_type: str,
        session_id: str,
        student_id: int,
        callback: Callable[[Dict[str, Any]], None],
        error: Optional[str] = None
    ) -> None:
        response_payload = {
            "type": "transcript",
            "session_id": session_id,
            "student_id": student_id,
            "speaker": speaker_type,
            "timestamp": datetime.utcnow().isoformat(),
            "success": (error is None),
            "data": {
                "text": transcript if transcript else "",
                "error": error
            }
        }
        logger.info(f"Creating transcript response: {response_payload}")
        callback(response_payload)
        logger.info(f"Transcript callback executed for session {session_id}")