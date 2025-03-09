# services/audio_service.py
import sounddevice as sd
import numpy as np
from typing import Dict, Optional, Callable, Any
import queue
import threading
from dataclasses import dataclass
import logging
import asyncio
import time

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@dataclass
class AudioConfig:
    sample_rate: int = 24000
    channels: int = 1
    buffer_size: int = 8192
    latency: float = 0.1

class AudioService:
    def __init__(self, config: Optional[AudioConfig] = None):
        self.config = config or AudioConfig()
        self.sessions: Dict[str, Dict[str, Any]] = {}  # session_id -> session data
        self.status_callbacks: Dict[str, Callable] = {}  # session_id -> callback
        logger.debug("AudioService initialized")

    def create_session(self, session_id: str, status_callback: Optional[Callable] = None) -> None:
        """Initialize a new audio session"""
        try:
            if session_id in self.sessions:
                logger.warning(f"Session {session_id} already exists, removing old session")
                self.remove_session(session_id)
                time.sleep(0.1)  # Small delay to ensure cleanup is complete

            logger.debug(f"Creating new audio session {session_id}")
            
            # Create session state with all necessary components
            self.sessions[session_id] = {
                'queue': queue.Queue(),
                'output_queue': asyncio.Queue(),
                'is_playing': False,
                'play_thread': None,
                'should_stop': threading.Event(),
                'stream': None,
                'initialized': threading.Event()
            }

            if status_callback:
                self.status_callbacks[session_id] = status_callback

            # Initialize audio stream first
            self._init_audio_stream(session_id)

            # Then start processing thread
            self.sessions[session_id]['play_thread'] = threading.Thread(
                target=self._playback_loop,
                args=(session_id,),
                daemon=True
            )
            self.sessions[session_id]['play_thread'].start()
            
            # Wait for initialization to complete with timeout
            if not self.sessions[session_id]['initialized'].wait(timeout=2.0):
                logger.error(f"Session {session_id} initialization timed out")
                self.remove_session(session_id)
                raise TimeoutError(f"Session {session_id} initialization timed out")
                
            logger.info(f"Successfully created and initialized audio session {session_id}")

        except Exception as e:
            logger.error(f"Error creating session {session_id}: {e}")
            if session_id in self.sessions:
                self.remove_session(session_id)
            raise

    def _init_audio_stream(self, session_id: str) -> None:
        """Initialize audio stream for a session"""
        try:
            session = self.sessions[session_id]
            session['stream'] = sd.OutputStream(
                samplerate=self.config.sample_rate,
                channels=self.config.channels,
                dtype=np.float32,
                latency=self.config.latency
            )
            session['stream'].start()
            session['initialized'].set()
            logger.debug(f"Audio stream initialized for session {session_id}")
            
        except Exception as e:
            logger.error(f"Error initializing audio stream for session {session_id}: {e}")
            raise

    def _notify_status(self, session_id: str, is_speaking: bool) -> None:
        """Notify status change through callback"""
        try:
            if session_id in self.status_callbacks:
                callback = self.status_callbacks[session_id]
                status = {
                    "type": "audio_status",
                    "status": "speaking" if is_speaking else "idle"
                }
                
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.call_soon_threadsafe(
                        lambda: asyncio.create_task(callback(status))
                    )
                    
        except Exception as e:
            logger.error(f"Error in status notification for session {session_id}: {e}")

    def _playback_loop(self, session_id: str) -> None:
        """Process audio chunks and send to the output queue with precise timing information"""
        try:
            session = self.sessions.get(session_id)
            if not session:
                logger.error(f"No session found for {session_id} in playback loop")
                return
                
            logger.debug(f"Starting playback loop for session {session_id}")
            
            # For tracking continuous audio timing
            audio_timestamp = int(time.time() * 1000)
            
            while not session['should_stop'].is_set():
                try:
                    # Wait for data with timeout
                    audio_data = session['queue'].get(timeout=0.1)
                    
                    if audio_data is not None:
                        # Convert bytes to int16
                        int_array = np.frombuffer(audio_data, dtype=np.int16)
                        # Normalize to float32
                        float_array = (int_array / 32768.0).astype(np.float32)
                        
                        # Ensure proper shape for channels
                        if float_array.ndim == 1:
                            float_array = float_array.reshape(-1, 1)
                        
                        # Notify start of speech with timestamp
                        if not session['is_playing']:
                            session['is_playing'] = True
                            audio_timestamp = int(time.time() * 1000)
                            self._notify_status(session_id, True, audio_timestamp)
                        
                        # Process in chunks and send to output queue with proper timing
                        chunk_size = self.config.buffer_size
                        for i in range(0, len(float_array), chunk_size):
                            if session['should_stop'].is_set():
                                break
                                
                            chunk = float_array[i:i + chunk_size]
                            # Calculate duration based on actual chunk length
                            chunk_duration = len(chunk) / self.config.sample_rate
                            chunk_duration_ms = int(chunk_duration * 1000)
                            
                            # Calculate precise timing for this chunk
                            chunk_timestamp = audio_timestamp
                            
                            # Convert to bytes for output
                            output_bytes = (chunk * 32768.0).astype(np.int16).tobytes()
                            
                            # Create enhanced audio packet with timing information
                            audio_packet = {
                                'audio_data': output_bytes,
                                'timestamp': chunk_timestamp,
                                'duration': chunk_duration_ms,
                                'sample_rate': self.config.sample_rate
                            }
                            
                            # Send to output queue
                            session['output_queue'].put_nowait(audio_packet)
                            
                            # Update timestamp for next chunk based on audio duration
                            audio_timestamp += chunk_duration_ms
                            
                            # Sleep for the duration of the chunk to maintain real-time pacing
                            time.sleep(chunk_duration * 0.90)  # Slightly faster to prevent gaps
                        
                        # If queue is empty, notify end of speech
                        if session['queue'].empty():
                            session['is_playing'] = False
                            self._notify_status(session_id, False, int(time.time() * 1000))
                        
                except queue.Empty:
                    # If we've been playing and queue is empty, notify end
                    if session.get('is_playing', False):
                        session['is_playing'] = False
                        self._notify_status(session_id, False, int(time.time() * 1000))
                    continue
                    
                except Exception as e:
                    logger.error(f"Error in playback loop for session {session_id}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Playback loop terminated for session {session_id}: {e}")
        finally:
            # Ensure status is set to idle when loop ends
            session = self.sessions.get(session_id)
            if session and session.get('is_playing', False):
                session['is_playing'] = False
                self._notify_status(session_id, False, int(time.time() * 1000))

    def add_to_queue(self, session_id: str, audio_data: bytes) -> None:
        """Add audio data to session queue"""
        try:
            if session_id not in self.sessions:
                logger.error(f"Attempted to queue audio for invalid session: {session_id}")
                return
                
            session = self.sessions[session_id]
            if not session['initialized'].is_set():
                logger.error(f"Attempted to queue audio for uninitialized session: {session_id}")
                return
                
            session['queue'].put(audio_data)
            #logger.debug(f"Queued {len(audio_data)} bytes for session {session_id}")
            
        except Exception as e:
            logger.error(f"Error queuing audio for session {session_id}: {e}")
            raise

    def remove_session(self, session_id: str) -> None:
        """Clean up session resources"""
        try:
            if session_id not in self.sessions:
                return
                
            logger.debug(f"Removing session {session_id}")
            session = self.sessions[session_id]
            
            # Signal playback loop to stop
            session['should_stop'].set()
            
            # Clear queue
            while not session['queue'].empty():
                try:
                    session['queue'].get_nowait()
                except queue.Empty:
                    break
            
            # Stop and close stream
            if session.get('stream') is not None:
                try:
                    session['stream'].stop()
                    session['stream'].close()
                except Exception as e:
                    logger.error(f"Error closing stream for session {session_id}: {e}")
            
            # Wait for playback thread to end
            if session.get('play_thread') is not None:
                session['play_thread'].join(timeout=1.0)
            
            # Remove session data
            self.sessions.pop(session_id)
            self.status_callbacks.pop(session_id, None)
            
            logger.info(f"Successfully removed audio session {session_id}")
            
        except Exception as e:
            logger.error(f"Error removing session {session_id}: {e}")
            # Try to remove session data even if cleanup failed
            self.sessions.pop(session_id, None)
            self.status_callbacks.pop(session_id, None)
            raise

    def cleanup(self) -> None:
        """Clean up all sessions"""
        logger.info("Cleaning up all audio sessions")
        for session_id in list(self.sessions.keys()):
            self.remove_session(session_id)