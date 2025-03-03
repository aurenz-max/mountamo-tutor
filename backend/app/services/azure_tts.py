import azure.cognitiveservices.speech as speechsdk
import asyncio
from datetime import datetime
import logging
from typing import Optional, Dict, Any, Callable
import json
import uuid

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)  # Set to DEBUG for more verbose logging

class AzureSpeechService:
    def __init__(
        self,
        subscription_key: str,
        region: str,
        transcript_service,  # We'll expect your TranscriptService instance.
    ):
        # Initialize SpeechConfig
        self.speech_config = speechsdk.SpeechConfig(subscription=subscription_key, region=region)
        
        # Enable intermediate diarization results for streaming
        self.speech_config.set_property(
            property_id=speechsdk.PropertyId.SpeechServiceResponse_DiarizeIntermediateResults, 
            value='true'
        )
        
        # Create the push stream and audio configuration
        self.push_stream = speechsdk.audio.PushAudioInputStream()
        self.audio_config = speechsdk.audio.AudioConfig(stream=self.push_stream)
        self.speech_recognizer = None
        
        # Session state
        self.session_id = None
        self.student_id = None
        self.transcript_callback = None
        
        # Transcript tracking
        self.current_utterances = {}  # Track active utterances by speaker
        self.utterance_ids = {}  # Map utterance keys to stable UUIDs

        # We'll rely on transcript_service to store final transcripts
        self.transcript_service = transcript_service
        
        # Get the current event loop or create a new one
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

    async def write_audio(self, audio_data: bytes, speaker: str):
        """Write audio data to the push stream."""
        if not audio_data:
            logger.warning("No audio data provided to write_audio")
            return
        try:
            self.push_stream.write(audio_data)
        except Exception as e:
            logger.error(f"Error writing audio data: {e}")

    def _get_utterance_id(self, speaker: str, text: str) -> str:
        """Generate or retrieve a stable ID for an utterance based on speaker and content."""
        # If we have an active utterance for this speaker, use that ID
        if speaker in self.current_utterances:
            current = self.current_utterances[speaker]
            # If the new text starts with or is similar to the current text, it's likely the same utterance
            if text.startswith(current['text']) or current['text'].startswith(text):
                #logger.debug(f"Using existing utterance ID for speaker {speaker}")
                return current['id']
        
        # Otherwise, create a new utterance ID
        new_id = str(uuid.uuid4())
        #logger.debug(f"Created new utterance ID for speaker {speaker}: {new_id}")
        return new_id

    def _send_transcript(self, text: str, speaker: str, is_partial: bool, utterance_id: str):
        """Send transcript through callback."""
        try:
            response = {
                "type": "transcript",
                "session_id": self.session_id,
                "student_id": self.student_id,
                "speaker": speaker,
                "timestamp": datetime.utcnow().isoformat(),
                "success": True,
                "data": {
                    "text": text,
                    "error": None,
                    "is_partial": is_partial,
                    "id": utterance_id
                }
            }
            
            logger.debug(
                f"Sending transcript: speaker={speaker}, "
                f"is_partial={is_partial}, id={utterance_id}, "
                f"text={text[:50]}..."
            )
            
            # Execute callback in thread-safe manner
            self.loop.call_soon_threadsafe(self.transcript_callback, response)
            
        except Exception as e:
            logger.error(f"Error sending transcript: {e}", exc_info=True)

    def _handle_transcribed_final(self, text: str, speaker: str):
        """
        This is final recognized speech. We'll pass it to transcript_service.
        We do not store final transcripts ourselves; we delegate to TranscriptService.
        """
        logger.info(f"[Session {self.session_id}] Final transcript: {speaker}: {text}")

        if self.transcript_service:
            # Pass final transcript to transcript_service
            self.loop.call_soon_threadsafe(
                self.transcript_service.handle_final_transcript,
                self.session_id,
                self.student_id,
                speaker,
                text
            )

    def transcribing_handler(self, evt: speechsdk.SpeechRecognitionEventArgs):
        """Handle partial transcription results."""
        try:
            text = evt.result.text
            if not text:
                return

            # Get speaker info
            speaker = getattr(evt.result, 'speaker_id', "unknown")
            
            # Get or create stable ID for this utterance
            utterance_id = self._get_utterance_id(speaker, text)
            
            # Update current utterance text
            self.current_utterances[speaker] = {
                'text': text,  # Store the full current text
                'id': utterance_id,
                'last_update': datetime.utcnow()
            }
            
            # Send partial transcript
            self._send_transcript(text, speaker, True, utterance_id)
            
        except Exception as e:
            logger.error(f"Error in transcribing_handler: {e}", exc_info=True)

    def transcribed_handler(self, evt: speechsdk.SpeechRecognitionEventArgs):
        """Called when Azure says speech is final."""
        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
            try:
                text = evt.result.text
                if not text:
                    return
                speaker = getattr(evt.result, 'speaker_id', 'unknown')
                # parse diarization
                try:
                    j = json.loads(evt.result.json)
                    if speaker == 'unknown' and j.get('SpeakerId'):
                        speaker = j['SpeakerId']
                except:
                    pass

                # Get the stable ID used for partial transcripts
                utterance_id = self._get_utterance_id(speaker, text)
                
                # Send final transcript to frontend
                self._send_transcript(text, speaker, False, utterance_id)

                # Also handle final transcript for storage in transcript_service
                self._handle_transcribed_final(text, speaker)

                # remove partial from current_utterances
                if speaker in self.current_utterances:
                    del self.current_utterances[speaker]
            except Exception as e:
                logger.error(f"Error in transcribed_handler: {e}", exc_info=True)

    def session_started_handler(self, evt: speechsdk.SessionEventArgs):
        """Handle session started event."""
        logger.info(f"Speech recognition session started for {self.session_id}")

    def session_stopped_handler(self, evt: speechsdk.SessionEventArgs):
        """Handle session stopped event."""
        logger.info(f"Speech recognition session stopped for {self.session_id}")

    def canceled_handler(self, evt: speechsdk.SessionEventArgs):
        """Handle canceled event."""
        cancellation_details = evt.cancellation_details
        logger.warning(f"Speech recognition canceled: {cancellation_details.reason}")
        if cancellation_details.reason == speechsdk.CancellationReason.Error:
            logger.error(f"Error details: {cancellation_details.error_details}")

    async def start_continuous_transcription(
        self,
        session_id: str,
        student_id: int,
        transcript_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> None:
        """Start continuous transcription with the given session parameters."""
        try:
            self.session_id = session_id
            self.student_id = student_id
            self.transcript_callback = transcript_callback
            self.current_utterances.clear()
            
            # Clear state
            self.current_utterances = {}
            self.utterance_ids = {}

            # Create new recognizer if needed
            if self.speech_recognizer:
                await self.stop_continuous_transcription()
                
            # Create conversation transcriber
            self.speech_recognizer = speechsdk.transcription.ConversationTranscriber(
                speech_config=self.speech_config,
                audio_config=self.audio_config
            )
            
            # Connect handlers
            self.speech_recognizer.transcribing.connect(self.transcribing_handler)
            self.speech_recognizer.transcribed.connect(self.transcribed_handler)
            self.speech_recognizer.session_started.connect(self.session_started_handler)
            self.speech_recognizer.session_stopped.connect(self.session_stopped_handler)
            self.speech_recognizer.canceled.connect(self.canceled_handler)

            # Start transcription
            result = await asyncio.to_thread(
                lambda: self.speech_recognizer.start_transcribing_async().get()
            )
            logger.info(f"Started continuous transcription for session {session_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error starting continuous transcription: {e}", exc_info=True)
            raise

    async def stop_continuous_transcription(self):
        """Stop continuous transcription and cleanup resources."""
        try:
            if self.speech_recognizer:
                await asyncio.to_thread(
                    lambda: self.speech_recognizer.stop_transcribing_async().get()
                )
                self.speech_recognizer = None
                
            # Clear state
            self.current_utterances = {}
            self.utterance_ids = {}
            logger.info(f"Stopped continuous transcription for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Error stopping continuous transcription: {e}", exc_info=True)
            self.speech_recognizer = None

    async def cleanup(self):
        """Cleanup method to ensure all resources are properly released."""
        await self.stop_continuous_transcription()
        if self.push_stream:
            try:
                self.push_stream.close()
            except Exception as e:
                logger.error(f"Error closing push stream: {e}")
        logger.info("Azure Speech Service resources cleaned up")