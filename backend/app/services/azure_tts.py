import azure.cognitiveservices.speech as speechsdk
import asyncio
from datetime import datetime
import logging
from typing import Optional, Dict, Any, Callable, List, Tuple
import json
import uuid

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)
        
class AzureSpeechService:
    def __init__(self, subscription_key: str, region: str):
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
        self.session_id = None
        self.student_id = None
        self.transcript_callback = None
        self.tasks = []  # Keep track of created tasks
        self.partial_ids = {}  # Track partial transcript IDs
        
        # Get the current event loop or create a new one if none exists
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

    async def write_audio(self, audio_data: bytes, speaker: str):
        if not audio_data:
            logger.warning("No audio data provided to write_audio")
            return
        try:
            self.push_stream.write(audio_data)
        except Exception as e:
            logger.error(f"Error writing audio data: {e}")

    def transcribing_handler(self, evt: speechsdk.SpeechRecognitionEventArgs):
        """Handle partial transcription results as they come in"""
        try:
            text = evt.result.text
            if text:
                # Extract speaker ID from the event if available
                speaker = getattr(evt.result, 'speaker_id', "unknown")
                
                # Generate a consistent ID for this partial transcript
                result_id = getattr(evt.result, 'id', str(uuid.uuid4()))
                if result_id not in self.partial_ids:
                    self.partial_ids[result_id] = str(uuid.uuid4())
                
                partial_id = self.partial_ids[result_id]
                
                # Create a task for the partial transcript
                task = asyncio.run_coroutine_threadsafe(
                    self._create_response(
                        transcript=text,
                        speaker_type=speaker,
                        session_id=self.session_id,
                        student_id=self.student_id,
                        callback=self.transcript_callback,
                        is_partial=True,
                        transcript_id=partial_id
                    ),
                    self.loop
                )
                # Store task reference
                self.tasks.append(task)
                # Add a callback to remove the task when it's done
                task.add_done_callback(lambda t: self.tasks.remove(t) if t in self.tasks else None)
        except Exception as e:
            logger.error(f"Error in transcribing_handler: {e}", exc_info=True)

    def transcribed_handler(self, evt: speechsdk.SpeechRecognitionEventArgs):
        """Handle final transcription results"""
        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
            try:
                text = evt.result.text
                if text:
                    # Get speaker ID directly from the event if available
                    speaker = getattr(evt.result, 'speaker_id', "unknown")
                    
                    # Try to extract more info from JSON if available
                    try:
                        result_json = json.loads(evt.result.json)
                        logger.debug(f"Recognized JSON: {result_json}")
                        if not speaker or speaker == "unknown":
                            speaker = result_json.get("SpeakerId", "unknown")
                    except Exception as e:
                        logger.error(f"Error parsing diarization info: {e}")
                    
                    # Get the consistent ID we used for partial transcripts
                    result_id = getattr(evt.result, 'id', "")
                    partial_id = self.partial_ids.get(result_id, str(uuid.uuid4()))
                    
                    # Clean up the ID mapping
                    if result_id in self.partial_ids:
                        del self.partial_ids[result_id]
                    
                    # Create a task for the final transcript
                    task = asyncio.run_coroutine_threadsafe(
                        self._create_response(
                            transcript=text,
                            speaker_type=speaker,
                            session_id=self.session_id,
                            student_id=self.student_id,
                            callback=self.transcript_callback,
                            is_partial=False,
                            transcript_id=partial_id
                        ),
                        self.loop
                    )
                    # Store task reference
                    self.tasks.append(task)
                    # Add a callback to remove the task when it's done
                    task.add_done_callback(lambda t: self.tasks.remove(t) if t in self.tasks else None)
            except Exception as e:
                logger.error(f"Error processing transcribed event: {e}", exc_info=True)

    def session_started_handler(self, evt: speechsdk.SessionEventArgs):
        """Handle session started event"""
        logger.info(f"Speech recognition session started for {self.session_id}")

    def session_stopped_handler(self, evt: speechsdk.SessionEventArgs):
        """Handle session stopped event"""
        logger.info(f"Speech recognition session stopped for {self.session_id}")

    def canceled_handler(self, evt: speechsdk.SessionEventArgs):
        """Handle canceled event"""
        cancellation_details = evt.cancellation_details
        logger.warning(f"Speech recognition canceled: {cancellation_details.reason}")
        if cancellation_details.reason == speechsdk.CancellationReason.Error:
            logger.error(f"Error details: {cancellation_details.error_details}")

    async def _create_response(
        self,
        transcript: Optional[str],
        speaker_type: str,
        session_id: str,
        student_id: int,
        callback: Callable[[Dict[str, Any]], None],
        error: Optional[str] = None,
        is_partial: bool = False,
        transcript_id: str = None
    ) -> None:
        try:
            response_payload = {
                "type": "transcript",
                "session_id": session_id,
                "student_id": student_id,
                "speaker": speaker_type,
                "timestamp": datetime.utcnow().isoformat(),
                "success": error is None,
                "data": {
                    "text": transcript if transcript else "",
                    "error": error,
                    "is_partial": is_partial,
                    "id": transcript_id or str(uuid.uuid4())
                }
            }
            logger.info(f"Creating transcript response: {response_payload}")
            callback(response_payload)
            logger.info(f"Transcript callback executed for session {session_id}")
        except Exception as e:
            logger.error(f"Error in _create_response: {e}")

    async def start_continuous_transcription(
        self,
        session_id: str,
        student_id: int,
        transcript_callback: Callable[[Dict[str, Any]], None]
    ) -> None:
        try:
            self.session_id = session_id
            self.student_id = student_id
            self.transcript_callback = transcript_callback
            self.partial_ids = {}  # Reset partial IDs

            # Always create a new recognizer to ensure clean state
            if self.speech_recognizer:
                await self.stop_continuous_transcription()
                
            # Create a conversation transcriber with diarization enabled
            self.speech_recognizer = speechsdk.transcription.ConversationTranscriber(
                speech_config=self.speech_config,
                audio_config=self.audio_config
            )
            
            # Connect event handlers
            self.speech_recognizer.transcribing.connect(self.transcribing_handler)
            self.speech_recognizer.transcribed.connect(self.transcribed_handler)
            self.speech_recognizer.session_started.connect(self.session_started_handler)
            self.speech_recognizer.session_stopped.connect(self.session_stopped_handler)
            self.speech_recognizer.canceled.connect(self.canceled_handler)

            # Run the blocking .get() in a thread pool
            result = await asyncio.to_thread(
                lambda: self.speech_recognizer.start_transcribing_async().get()
            )
            logger.info(f"Started continuous transcription for session {session_id}")
            return result
        except Exception as e:
            logger.error(f"Error starting continuous transcription: {e}", exc_info=True)
            raise

    async def stop_continuous_transcription(self):
        try:
            if self.speech_recognizer:
                # Run the blocking .get() in a thread pool
                await asyncio.to_thread(
                    lambda: self.speech_recognizer.stop_transcribing_async().get()
                )
                
                # Wait for pending tasks to complete
                if self.tasks:
                    pending_tasks = [task for task in self.tasks if not task.done()]
                    if pending_tasks:
                        logger.info(f"Waiting for {len(pending_tasks)} pending tasks to complete")
                        await asyncio.gather(*[asyncio.wrap_future(task) for task in pending_tasks], 
                                             return_exceptions=True)
                    self.tasks.clear()
                    
                self.speech_recognizer = None
                self.partial_ids = {}  # Clear partial IDs
                logger.info(f"Stopped continuous transcription for session {self.session_id}")
        except Exception as e:
            logger.error(f"Error stopping continuous transcription: {e}", exc_info=True)
            # Make sure to clear resources even on error
            self.speech_recognizer = None
            
    async def cleanup(self):
        """Cleanup method to ensure all resources are properly released"""
        await self.stop_continuous_transcription()
        if self.push_stream:
            try:
                self.push_stream.close()
            except Exception as e:
                logger.error(f"Error closing push stream: {e}")
        logger.info("Azure Speech Service resources cleaned up")