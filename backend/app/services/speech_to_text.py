# backend/app/services/speech_to_text.py

import asyncio
import base64
import json
import logging
import queue
import threading
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Optional, Dict, Any

import pyaudio
from google.cloud import speech
from google.oauth2 import service_account
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AudioConfig(BaseModel):
    """Configuration for audio processing"""
    encoding: str = "LINEAR16"
    sample_rate: int = 16000
    channels: int = 1
    language_code: str = "en-US"
    enable_interim_results: bool = True
    chunk_size: int = 1600  # 100ms for 16kHz audio
    max_alternatives: int = 1
    enable_automatic_punctuation: bool = True

class AudioBuffer:
    """Thread-safe audio buffer for streaming"""
    def __init__(self):
        self._buffer = queue.Queue()
        self.closed = True

    def put(self, data: bytes) -> None:
        """Add audio data to buffer"""
        if not self.closed:
            self._buffer.put(data)

    def get(self) -> Optional[bytes]:
        """Get audio data from buffer"""
        try:
            return self._buffer.get_nowait()
        except queue.Empty:
            return None

    def clear(self) -> None:
        """Clear all data from buffer"""
        while not self._buffer.empty():
            self._buffer.get_nowait()

class AudioInput:
    """Handles audio input from microphone"""
    def __init__(self, config: AudioConfig):
        self.config = config
        self._audio_interface = None
        self._audio_stream = None
        self._buffer = AudioBuffer()
        
    def __enter__(self):
        self._audio_interface = pyaudio.PyAudio()
        self._audio_stream = self._audio_interface.open(
            format=pyaudio.paInt16,
            channels=self.config.channels,
            rate=self.config.sample_rate,
            input=True,
            frames_per_buffer=self.config.chunk_size,
            stream_callback=self._audio_callback,
        )
        self._buffer.closed = False
        return self._buffer

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._audio_stream:
            self._audio_stream.stop_stream()
            self._audio_stream.close()
        if self._audio_interface:
            self._audio_interface.terminate()
        self._buffer.closed = True

    def _audio_callback(self, in_data, frame_count, time_info, status):
        """Callback for audio stream"""
        self._buffer.put(in_data)
        return (None, pyaudio.paContinue)

class SpeechToText:
    """Main speech-to-text service"""
    def __init__(self, credentials_path: Optional[str] = None):
        self.config = AudioConfig()
        
        # Load credentials if path provided, otherwise use environment variable
        if credentials_path:
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path
            )
            self.client = speech.SpeechClient(credentials=credentials)
        else:
            self.client = speech.SpeechClient()

        # Initialize recognition config
        self.recognition_config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=self.config.sample_rate,
            language_code=self.config.language_code,
            max_alternatives=self.config.max_alternatives,
            enable_automatic_punctuation=self.config.enable_automatic_punctuation,
        )

        self.streaming_config = speech.StreamingRecognitionConfig(
            config=self.recognition_config,
            interim_results=self.config.enable_interim_results
        )

        logger.info("Speech-to-Text service initialized")

    async def transcribe_audio_file(self, audio_path: str) -> str:
        """Transcribe audio from file"""
        try:
            with open(audio_path, 'rb') as audio_file:
                content = audio_file.read()

            audio = speech.RecognitionAudio(content=content)
            response = self.client.recognize(
                config=self.recognition_config,
                audio=audio
            )

            transcripts = []
            for result in response.results:
                transcripts.append(result.alternatives[0].transcript)

            return ' '.join(transcripts)

        except Exception as e:
            logger.error(f"Error transcribing audio file: {str(e)}")
            raise

    async def process_audio_stream(self, websocket) -> AsyncGenerator[Dict[str, Any], None]:
        """Process audio stream from WebSocket"""
        try:
            audio_generator = self._create_audio_generator(websocket)
            requests = self._create_streaming_requests(audio_generator)
            responses = self.client.streaming_recognize(
                self.streaming_config,
                requests
            )

            for response in responses:
                if not response.results:
                    continue

                for result in response.results:
                    if not result.alternatives:
                        continue

                    transcript = result.alternatives[0].transcript

                    yield {
                        'transcript': transcript,
                        'is_final': result.is_final,
                        'confidence': result.alternatives[0].confidence,
                        'timestamp': datetime.utcnow().isoformat(),
                    }

        except Exception as e:
            logger.error(f"Error processing audio stream: {str(e)}")
            yield {
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat(),
            }

    async def _create_audio_generator(self, websocket):
        """Create generator for audio data from websocket"""
        while True:
            try:
                message = await websocket.receive_json()
                if 'audio' in message:
                    audio_data = base64.b64decode(message['audio'])
                    yield audio_data
            except Exception as e:
                logger.error(f"Error receiving audio data: {str(e)}")
                break

    def _create_streaming_requests(self, audio_generator):
        """Create streaming requests from audio generator"""
        for audio_data in audio_generator:
            yield speech.StreamingRecognizeRequest(audio_content=audio_data)

    async def start_microphone_transcription(self):
        """Start transcription from microphone"""
        with AudioInput(self.config) as audio_buffer:
            async def create_requests():
                async for audio_chunk in self._create_microphone_generator(audio_buffer):
                    yield speech.StreamingRecognizeRequest(audio_content=audio_chunk)
            
            # Create request generator
            request_generator = create_requests()
            
            try:
                responses = await self.client.streaming_recognize(
                    self.streaming_config,
                    request_generator
                )

                async for response in responses:
                    if not response.results:
                        continue

                    for result in response.results:
                        if not result.alternatives:
                            continue

                        transcript = result.alternatives[0].transcript
                        if result.is_final:
                            yield {
                                'transcript': transcript,
                                'is_final': True,
                                'confidence': result.alternatives[0].confidence,
                                'timestamp': datetime.utcnow().isoformat(),
                            }
                        else:
                            yield {
                                'transcript': transcript,
                                'is_final': False,
                                'timestamp': datetime.utcnow().isoformat(),
                            }
            except Exception as e:
                logger.error(f"Error in transcription: {str(e)}")
                yield {
                    'error': str(e),
                    'timestamp': datetime.utcnow().isoformat(),
                }

    async def _create_microphone_generator(self, audio_buffer):
        """Create generator for microphone audio data"""
        while not audio_buffer.closed:
            data = audio_buffer.get()
            if data:
                yield data
            else:
                await asyncio.sleep(0.1)