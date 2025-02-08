# AI Tutor WebSocket System Documentation

## System Overview

The AI Tutor WebSocket system provides real-time audio-based tutoring using Gemini's multimodal capabilities. The system implements a streaming architecture that enables live voice interaction between students and an AI tutor, with specialized handling for kindergarten-level education.

### Core Technologies
- Backend: FastAPI (Python 3.8+)
- AI Model: Google Gemini 2.0
- Audio Processing: sounddevice, numpy
- WebSocket Protocol: FastAPI WebSocket
- Frontend: React with TypeScript

### Architecture Components

```
Frontend (React/TypeScript) 
   ↓↑  WebSocket Communication
Backend (FastAPI)
   ↓↑  Session Management
TutoringService 
   ↓↑  AI Integration
GeminiService + AudioService
```

## Detailed Component Breakdown

### 1. TutoringService
The core service managing tutoring logic and Gemini interactions.

```python
class TutoringService:
    def __init__(self):
        self.gemini = GeminiService()
        self.audio_manager = AudioSessionManager(self.gemini)
        self._sessions = {}  # Session storage
```

Key Responsibilities:
- Session State Management
  - Tracks active tutoring sessions
  - Manages student progress
  - Handles session cleanup
- Prompt Management
  - Maintains unified prompt for Gemini
  - Contextualizes teaching approach
  - Handles kindergarten-specific language
- Audio Processing
  - Coordinates with AudioService
  - Manages audio streams
  - Handles audio format conversion

### 2. GeminiService
Handles direct interaction with Google's Gemini AI model.

```python
class GeminiService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = "gemini-2.0-flash-exp"
        self.voice = "Puck"
        self.audio_service = AudioService(self.audio_config)
```

Features:
- Gemini Integration
  - Real-time audio streaming
  - Context management
  - Response generation
- Audio Configuration
  - Sample rate: 24000 Hz
  - Channels: 1 (mono)
  - Buffer size: 8192 bytes
  - Latency: 0.1s
- Session Management
  - Connection handling
  - Stream lifecycle
  - Error recovery

### 3. AudioService
Specialized service for audio processing and playback.

```python
class AudioService:
    def __init__(self, config: Optional[AudioConfig] = None):
        self.config = config or AudioConfig()
        self.stream = None
        self.audio_queue = queue.Queue()
```

Features:
- Audio Processing
  - Real-time PCM processing
  - Format conversion (int16 to float32)
  - Buffer management
  - Sample rate adjustment
- Stream Management
  - Queue-based audio buffering
  - Chunk processing
  - Playback control
- Error Handling
  - Buffer underrun protection
  - Stream recovery
  - Format validation

### 4. SessionManager
Manages the lifecycle of tutoring sessions.

```python
class SessionManager:
    def __init__(self, tutoring_service: TutoringService):
        self.tutoring_service = tutoring_service
        self.sessions = {}  # Active sessions
```

Responsibilities:
- Session Lifecycle
  - Creation and initialization
  - State management
  - Cleanup and termination
- Resource Management
  - Memory usage monitoring
  - Connection tracking
  - Resource cleanup
- Error Recovery
  - Session restoration
  - State preservation
  - Connection recovery

### 5. WebSocket Handler
Manages real-time communication between client and server.

```python
@router.websocket("/session")
async def tutoring_websocket(websocket: WebSocket):
    audio_queue = asyncio.Queue()
    quit_event = asyncio.Event()
    tutoring_session = None
```

Features:
- Connection Management
  - WebSocket lifecycle
  - Client authentication
  - Connection monitoring
- Message Handling
  - Binary audio data
  - Control messages
  - Status updates
- Error Management
  - Connection drops
  - Timeout handling
  - Reconnection logic

## Audio Processing Pipeline

1. Client Audio Capture
   ```typescript
   // Frontend audio capture
   const audioChunk = await recorder.read();
   await ws.send(encodeAudio(audioChunk));
   ```

2. Server Processing
   ```python
   # Backend audio handling
   audio_data = await websocket.receive_bytes()
   processed_data = audio_service.process(audio_data)
   await gemini_service.stream_audio(processed_data)
   ```

3. Response Generation
   ```python
   # Gemini response processing
   async for response in gemini.generate_response():
       processed_audio = audio_service.process_response(response)
       await websocket.send_bytes(processed_audio)
   ```

## Performance Optimizations

1. Audio Buffering
   - Optimal buffer size: 8192 bytes
   - Chunk processing
   - Queue management

2. Memory Management
   - Session cleanup
   - Resource pooling
   - Garbage collection

3. Connection Handling
   - Keepalive mechanisms
   - Reconnection strategies
   - State preservation

## Error Handling Strategies

1. Connection Errors
   ```python
   try:
       await websocket.accept()
   except WebSocketDisconnect:
       await cleanup_session()
   ```

2. Audio Processing Errors
   ```python
   try:
       await process_audio(chunk)
   except AudioProcessingError:
       await handle_audio_error()
   ```

3. Session Recovery
   ```python
   async def recover_session(session_id):
       session = await session_manager.restore_session(session_id)
       await reinitialize_audio_stream(session)
   ```

## Monitoring and Logging

1. Performance Metrics
   ```python
   logger.info(f"Audio processing latency: {latency}ms")
   logger.debug(f"Buffer utilization: {buffer_usage}%")
   ```

2. Error Tracking
   ```python
   logger.error(f"Session error: {error}", exc_info=True)
   logger.warning(f"Audio buffer underrun: {session_id}")
   ```

3. Session Analytics
   ```python
   logger.info(f"Session duration: {duration}s")
   logger.debug(f"Audio chunks processed: {chunk_count}")
   ```

## Security Considerations

1. Connection Security
   - WebSocket authentication
   - Session validation
   - Rate limiting

2. Data Protection
   - Audio data encryption
   - Session isolation
   - Access control

3. Resource Protection
   - Connection limits
   - Bandwidth monitoring
   - Resource quotas

## Future Improvements

1. Enhanced Features
   - Multi-modal interaction
   - Advanced audio processing
   - Session persistence

2. Performance Enhancements
   - Audio compression
   - Latency reduction
   - Buffer optimization

3. Monitoring Additions
   - Real-time analytics
   - Performance dashboards
   - Error tracking

## Deployment Considerations

1. System Requirements
   - Python 3.8+
   - FastAPI
   - WebSocket support
   - Audio processing capabilities

2. Environment Setup
   ```bash
   pip install fastapi uvicorn google-generativeai sounddevice numpy
   ```

3. Configuration
   ```python
   # Environment variables
   GEMINI_API_KEY=your_api_key
   AUDIO_SAMPLE_RATE=24000
   BUFFER_SIZE=8192
   ```