import azure.cognitiveservices.speech as speechsdk
import asyncio
import time
from datetime import datetime
import logging
from typing import Optional, Dict, Any, Callable, Awaitable
import json
import uuid
import nltk
from nltk.corpus import cmudict

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG for more verbose logging

class AzureSpeechService:
    def __init__(
        self,
        subscription_key: str,
        region: str,
        transcript_service=None,  # We'll expect your TranscriptService instance
    ):
        # Initialize SpeechConfig
        self.speech_config = speechsdk.SpeechConfig(subscription=subscription_key, region=region)
        
        # Enable intermediate diarization results for streaming
        self.speech_config.set_property(
            property_id=speechsdk.PropertyId.SpeechServiceResponse_DiarizeIntermediateResults, 
            value='true'
        )
        
        # Enable viseme generation
        self.speech_config.set_property(
            property_id=speechsdk.PropertyId.SpeechServiceResponse_RequestSentenceBoundary, 
            value='true'
        )
        
        # Request word level timing
        self.speech_config.request_word_level_timestamps()
        
        # Create the push stream and audio configuration
        self.push_stream = speechsdk.audio.PushAudioInputStream()
        self.audio_config = speechsdk.audio.AudioConfig(stream=self.push_stream)
        self.speech_recognizer = None
        self.speech_synthesizer = None
        
        # Session state
        self.session_id = None
        self.student_id = None
        self.transcript_callback = None
        self.viseme_callback = None
        
        # Transcript tracking
        self.current_utterances = {}  # Track active utterances by speaker
        self.utterance_ids = {}  # Map utterance keys to stable UUIDs

        # We'll rely on transcript_service to store final transcripts
        self.transcript_service = transcript_service
        self.cosmos_db = None  # This will be set later if needed
        
        # Initialize NLTK for phoneme-to-viseme mapping
        try:
            nltk.data.find('corpora/cmudict')
        except LookupError:
            nltk.download('cmudict')
        self.pronunciation_dict = cmudict.dict()
        
        # Define phoneme to viseme mapping
        self.phoneme_to_viseme = {
            'AA': 0, 'AE': 0, 'AH': 0, 'AO': 0, 'AW': 1, 'AY': 2,  # Vowels
            'B': 3, 'CH': 4, 'D': 5, 'DH': 5, 'EH': 6, 'ER': 7,     
            'EY': 8, 'F': 9, 'G': 10, 'HH': 11, 'IH': 6, 'IY': 6,
            'JH': 12, 'K': 10, 'L': 13, 'M': 3, 'N': 5, 'NG': 10,
            'OW': 14, 'OY': 14, 'P': 3, 'R': 15, 'S': 16, 'SH': 17,
            'T': 5, 'TH': 9, 'UH': 14, 'UW': 14, 'V': 9, 'W': 14,
            'Y': 6, 'Z': 16, 'ZH': 17
        }
                
        try:
            self.loop = asyncio.get_running_loop()
            logger.debug(f"Using existing event loop: {self.loop}")
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            logger.debug(f"Created new event loop: {self.loop}")

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
                return current['id']
        
        # Otherwise, create a new utterance ID
        new_id = str(uuid.uuid4())
        return new_id

    def _send_transcript(self, text: str, speaker: str, is_partial: bool, utterance_id: str):
        """Send transcript through callback."""
        try:
            if not self.transcript_callback:
                logger.warning("No transcript callback set, can't send transcript")
                return
                    
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
            
            # Call callback directly (no more lambda needed)
            try:
                self.transcript_callback(response)
                logger.debug("Callback executed!")
            except Exception as e:
                logger.error(f"Error in transcript callback execution: {e}", exc_info=True)
            
        except Exception as e:
            logger.error(f"Error sending transcript: {e}", exc_info=True)

    def _send_viseme(self, viseme_id: int, audio_offset: int, speaker: str, utterance_id: str):
        """Send viseme information through callback with precise timing."""
        try:
            if not self.viseme_callback:
                return
                    
            # Convert from ticks (100ns units) to milliseconds
            audio_offset_ms = audio_offset // 10000
                    
            # Current server time in milliseconds
            server_timestamp = int(time.time() * 1000)
                    
            response = {
                "type": "viseme",
                "session_id": self.session_id,
                "student_id": self.student_id,
                "speaker": speaker,
                "timestamp": datetime.utcnow().isoformat(),
                "success": True,
                "data": {
                    "viseme_id": viseme_id,
                    "audio_offset": audio_offset_ms,
                    "server_timestamp": server_timestamp,
                    "id": utterance_id
                }
            }
            
            # Call callback directly - should be non-blocking
            self.viseme_callback(response)
            
        except Exception as e:
            logger.error(f"Error sending viseme: {e}", exc_info=True)

    def _process_words_for_visemes(self, words_data, speaker, is_partial=False):
        """
        Process word timing data and generate visemes with smarter timing.
        
        Parameters:
            words_data (list): The Words array from Azure's JSON response
            speaker (str): Speaker identifier
            is_partial (bool): Whether this is from partial (transcribing) or final results
        """
        try:
            buffer_ms = 50  # 50ms buffer for real-time visemes
            
            for word_info in words_data:
                word = word_info.get('Word', '').lower()
                if not word or word in ['.', ',', '?', '!']:
                    continue
                    
                # Get the utterance ID
                utterance_id = self._get_utterance_id(speaker, word)
                    
                # Convert timing from 100-nanosecond units to milliseconds
                start_time = int(word_info.get('Offset', 0)) / 10000  # to milliseconds
                duration = int(word_info.get('Duration', 0)) / 10000  # to milliseconds
                
                # Skip if the word is too far in the past (more than 1 second ago)
                current_time = int(datetime.utcnow().timestamp() * 1000)
                word_end_time = start_time + duration
                if current_time > (word_end_time + 1000) and is_partial:
                    logger.debug(f"Skipping viseme for word '{word}' - too far in the past")
                    continue
                    
                # Get phonemes for the word
                if word in self.pronunciation_dict:
                    phonemes = self.pronunciation_dict[word][0]
                    
                    # Use a more intelligent phoneme duration distribution
                    # Vowels typically last longer than consonants
                    if phonemes:
                        # Classify phonemes
                        vowels = ['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']
                        
                        # Count vowels and consonants
                        vowel_count = sum(1 for p in phonemes if p[:2] in vowels)
                        consonant_count = len(phonemes) - vowel_count
                        
                        # Allocate duration: vowels get 1.8x the time of consonants
                        if vowel_count > 0 and consonant_count > 0:
                            vowel_weight = 1.8
                            total_weight = (vowel_count * vowel_weight) + consonant_count
                            consonant_duration = duration / total_weight
                            vowel_duration = consonant_duration * vowel_weight
                        else:
                            # Equal division if no vowels or all vowels
                            vowel_duration = consonant_duration = duration / len(phonemes)
                        
                        # Generate visemes with timing
                        current_offset = start_time
                        for phoneme in phonemes:
                            # Strip stress markers
                            clean_phoneme = ''.join([c for c in phoneme if not c.isdigit()])
                            
                            if clean_phoneme in self.phoneme_to_viseme:
                                viseme_id = self.phoneme_to_viseme[clean_phoneme]
                                
                                # Determine phoneme duration based on type
                                phoneme_duration = vowel_duration if clean_phoneme[:2] in vowels else consonant_duration
                                
                                # Apply realtime buffer for partial results
                                adjusted_offset = current_offset
                                if is_partial:
                                    # Make sure we're not scheduling visemes too far in the past
                                    adjusted_offset = max(current_offset, current_time - buffer_ms)
                                
                                # Send viseme event
                                self._send_viseme(viseme_id, int(adjusted_offset), speaker, utterance_id)
                                
                                # Update offset for next phoneme
                                current_offset += phoneme_duration
                                
        except Exception as e:
            logger.error(f"Error processing words for visemes: {e}", exc_info=True)

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
        """Handle partial transcription results with real-time viseme generation."""
        try:
            text = evt.result.text
            if not text:
                return

            # Get speaker info
            speaker = getattr(evt.result, 'speaker_id', "unknown")
            
            # Get or create stable ID for this utterance
            utterance_id = self._get_utterance_id(speaker, text)
            
            # Extract current words to process
            current_words = []
            if 'prev_text' in self.current_utterances.get(speaker, {}):
                prev_text = self.current_utterances.get(speaker, {}).get('prev_text', '')
                if prev_text and text.startswith(prev_text):
                    # Extract only new words added in this partial update
                    new_text = text[len(prev_text):].strip()
                    current_words = [w.strip('.,!?;:"\'').lower() for w in new_text.split() if w.strip('.,!?;:"\'')]
            else:
                # First partial result, process all words
                current_words = [w.strip('.,!?;:"\'').lower() for w in text.split() if w.strip('.,!?;:"\'')]
                
            # Update current utterance text
            self.current_utterances[speaker] = {
                'text': text,
                'id': utterance_id,
                'last_update': datetime.utcnow(),
                'prev_text': text,  # Store current text as prev for next comparison
                'processed_words': self.current_utterances.get(speaker, {}).get('processed_words', set())
            }
            
            # Send partial transcript
            self._send_transcript(text, speaker, True, utterance_id)
            
            # Immediately generate visemes for new words in a separate thread to avoid blocking
            if current_words:
                # Create a thread-safe function for viseme generation
                def generate_visemes_thread():
                    try:
                        for word in current_words:
                            if word and word not in self.current_utterances[speaker]['processed_words']:
                                self.current_utterances[speaker]['processed_words'].add(word)
                                
                                if word in self.pronunciation_dict:
                                    phonemes = self.pronunciation_dict[word][0]
                                    current_time = int(time.time() * 1000)
                                    
                                    for i, phoneme in enumerate(phonemes):
                                        clean_phoneme = ''.join([c for c in phoneme if not c.isdigit()])
                                        if clean_phoneme in self.phoneme_to_viseme:
                                            viseme_id = self.phoneme_to_viseme[clean_phoneme]
                                            # Use minimal timing offset between visemes
                                            offset = current_time + (i * 30)  # 30ms per phoneme
                                            # Use the sync callback immediately
                                            self._send_viseme(viseme_id, offset * 10000, speaker, utterance_id)
                    except Exception as e:
                        logger.error(f"Error in viseme generation thread: {e}", exc_info=True)
                
                # Start a dedicated thread for viseme generation
                import threading
                viseme_thread = threading.Thread(target=generate_visemes_thread)
                viseme_thread.daemon = True
                viseme_thread.start()
                
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
                        
                    # Process for visemes with is_partial=False (final results)
                    if 'NBest' in j and len(j['NBest']) > 0:
                        best_result = j['NBest'][0]
                        if 'Words' in best_result:
                            self._process_words_for_visemes(best_result['Words'], speaker, is_partial=False)
                except Exception as e:
                    logger.error(f"Error parsing JSON or extracting visemes: {e}", exc_info=True)

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

    def _generate_visemes_from_text(self, text, speaker, utterance_id):
        """Generate visemes from text when timing data isn't available."""
        words = text.strip().lower().split()
        if not words:
            return
            
        # Process only the most recent word for real-time effect
        latest_word = words[-1].strip('.,!?;:"\'')
        if not latest_word or latest_word in self.current_utterances.get(speaker, {}).get('processed_words', set()):
            return
            
        # Mark this word as processed for this utterance
        if 'processed_words' not in self.current_utterances.get(speaker, {}):
            self.current_utterances[speaker]['processed_words'] = set()
        self.current_utterances[speaker]['processed_words'].add(latest_word)
        
        # Generate visemes for this word
        if latest_word in self.pronunciation_dict:
            phonemes = self.pronunciation_dict[latest_word][0]
            # Current time in milliseconds as base for viseme timing
            now_ms = int(time.time() * 1000)
            phoneme_duration = 80  # milliseconds per phoneme for real-time display
            
            for i, phoneme in enumerate(phonemes):
                clean_phoneme = ''.join([c for c in phoneme if not c.isdigit()])
                if clean_phoneme in self.phoneme_to_viseme:
                    viseme_id = self.phoneme_to_viseme[clean_phoneme]
                    # Schedule viseme to display immediately with slight progression
                    offset = now_ms + (i * phoneme_duration)
                    self._send_viseme(viseme_id, offset * 10000, speaker, utterance_id)  # Convert to 100ns units

    def viseme_handler(self, evt: speechsdk.SpeechSynthesisVisemeEventArgs):
        """Handle viseme events from speech synthesis."""
        try:
            viseme_id = evt.viseme_id
            audio_offset = evt.audio_offset
            
            # For synthesis, we need to determine which speaker this is for
            # This might require additional context from your application
            speaker = getattr(evt, 'speaker_id', "tutor")
            
            # We'll need an utterance ID - this might need adaptation for your use case
            # If we're synthesizing for a specific utterance, you should track that
            utterance_id = self.current_synthesis_utterance_id if hasattr(self, 'current_synthesis_utterance_id') else str(uuid.uuid4())
            
            # Send viseme data with animation info for avatar
            self._send_viseme(viseme_id, audio_offset, speaker, utterance_id)
            
        except Exception as e:
            logger.error(f"Error in viseme_handler: {e}", exc_info=True)

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
        transcript_callback: Optional[Callable[[Dict[str, Any]], Any]] = None,
        viseme_callback: Optional[Callable[[Dict[str, Any]], Any]] = None
    ) -> None:
        """
        Start continuous transcription with the given session parameters and optional viseme callback.
        Both callbacks can be either async (coroutine functions) or regular functions.
        """
        try:
            self.session_id = session_id
            self.student_id = student_id
            self.transcript_callback = transcript_callback
            self.viseme_callback = viseme_callback
            
            # Log callback types for debugging
            logger.debug(f"Transcript callback is async: {asyncio.iscoroutinefunction(transcript_callback)}")
            logger.debug(f"Viseme callback is async: {asyncio.iscoroutinefunction(viseme_callback)}")

            # In the start_continuous_transcription method:
            logger.debug(f"Is transcript_callback a coroutine function? {asyncio.iscoroutinefunction(transcript_callback)}")
            logger.debug(f"Transcript callback type: {type(transcript_callback)}")
            logger.debug(f"Transcript callback repr: {repr(transcript_callback)}")
            
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

            # Enable direct viseme capture from recognition process
            self.speech_config.set_property(
                property_id=speechsdk.PropertyId.Speech_SegmentationSilenceTimeoutMs,
                value='500'
            )
            
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
                
            if self.speech_synthesizer:
                # No async method to stop the synthesizer, but we can set it to None
                self.speech_synthesizer = None
                
            # Clear state
            self.current_utterances = {}
            self.utterance_ids = {}
            logger.info(f"Stopped continuous transcription for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Error stopping continuous transcription: {e}", exc_info=True)
            self.speech_recognizer = None
            self.speech_synthesizer = None

    async def cleanup_transcription(self):
        """Alias for stop_continuous_transcription for better API naming."""
        return await self.stop_continuous_transcription()

    async def cleanup(self):
        """Cleanup method to ensure all resources are properly released."""
        await self.stop_continuous_transcription()
        if self.push_stream:
            try:
                self.push_stream.close()
            except Exception as e:
                logger.error(f"Error closing push stream: {e}")
        logger.info("Azure Speech Service resources cleaned up")