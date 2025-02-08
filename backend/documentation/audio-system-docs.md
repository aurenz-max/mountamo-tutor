# AI Tutor Audio System Documentation

## Overview

The AI Tutor Audio System enables real-time speech interactions in an educational context, combining speech-to-text (STT), text-to-speech (TTS), and conversational AI capabilities. This system integrates Gemini's audio processing with Claude's tutoring capabilities to create an interactive learning experience.

## System Architecture

### Core Components

#### 1. Frontend Audio API (`audio-api.ts`)
```typescript
class AudioAPI {
    // Core functionality
    async startTranscription(callbacks: AudioCallback): Promise<void>
    async startConversation(callbacks: AudioCallback): Promise<void>
    async sendAudio(audioData: Blob): Promise<void>
    async generateSpeech(text: string, voice?: string): Promise<Blob>
}
```
- Manages WebSocket connections for audio streaming
- Provides typed interfaces for all audio operations
- Handles real-time audio transmission
- Manages callback system for responses

#### 2. Backend Audio Session Manager (`audio_session_manager.py`)
```python
class AudioSessionManager:
    async def start_transcription_session(self, session_id: str) -> None
    async def start_conversation_session(self, session_id: str, callbacks) -> None
    async def generate_speech(self, text: str, voice_name: str = "default") -> bytes
```
- Controls audio session lifecycles
- Manages state transitions
- Coordinates between services
- Ensures proper resource cleanup

#### 3. Gemini Service (`gemini.py`)
```python
class GeminiService:
    async def transcribe_audio(self, audio_data: bytes) -> str
    async def generate_speech(self, text: str) -> bytes
    async def process_conversation(self, audio_stream, callbacks) -> None
```
- Direct interface to Gemini API
- Handles audio processing
- Manages streaming sessions

#### 4. WebSocket Handler (`audio_ws.py`)
```python
@router.websocket("/ws/audio/{feature}")
async def audio_websocket(websocket: WebSocket, feature: str)
```
- Routes audio streams
- Manages WebSocket lifecycle
- Handles message routing

### Integration Points

#### Tutoring Service Integration
```python
class TutoringService:
    async def initialize_session(self, params) -> Dict[str, Any]:
        # Initialize tutoring session
        response = await self.anthropic.generate_response(prompt)
        audio = await self.audio_manager.generate_speech(response)
        return {"response": response, "audio_data": audio}
```
- Converts Claude's responses to speech
- Manages audio session states
- Handles concurrent operations

## Message Flow

1. **Speech-to-Text Flow**
   ```
   Frontend -> Backend: Open WebSocket connection
   Backend -> Gemini STT: Start STT session
   Frontend -> Backend: Stream audio chunks
   Backend -> Gemini STT: Forward chunks
   Gemini STT -> Backend: Final transcription
   Backend -> Claude: Process text
   Claude -> Backend: Response
   Backend -> TTS: Generate audio
   Backend -> Frontend: Send audio response
   ```

2. **Text-to-Speech Flow**
   ```
   Frontend -> Backend: TTS request
   Backend -> TTS Service: Generate speech
   TTS Service -> Backend: Audio data
   Backend -> Frontend: Audio response
   ```

## State Management

### Session States
```python
class SessionState(Enum):
    IDLE = "idle"
    CONNECTING = "connecting"
    ACTIVE = "active"
    ERROR = "error"
    CLOSING = "closing"
```

### Session Modes
```python
class SessionMode(Enum):
    TRANSCRIPTION = "transcription"
    CONVERSATION = "conversation"
    TTS = "text_to_speech"
```

## Error Handling

### Frontend Error Handling
```typescript
try {
    await audioApi.startTranscription({
        onError: (error) => console.error('Error:', error)
    });
} catch (error) {
    // Handle connection errors
}
```

### Backend Error Handling
```python
try:
    audio_data = await self.audio_manager.generate_speech(response)
except Exception as e:
    logger.error(f"TTS generation failed: {str(e)}")
    audio_data = None
```

## Best Practices

1. **Resource Management**
   - Always clean up WebSocket connections
   - Properly close audio sessions
   - Handle timeouts appropriately

2. **Error Recovery**
   - Implement exponential backoff for retries
   - Provide graceful degradation
   - Maintain user experience when audio fails

3. **State Transitions**
   - Validate state transitions
   - Maintain session isolation
   - Handle concurrent operations safely

4. **Performance**
   - Buffer audio appropriately
   - Handle streaming efficiently
   - Manage memory usage for audio data

## Configuration

### Audio Settings
```python
audio_config = ServiceAudioConfig(
    sample_rate=24000,
    channels=1,
    buffer_size=8192,
    latency=0.1
)
```

### Voice Configuration
```python
voice_config = VoiceConfig(
    prebuilt_voice_config=PrebuiltVoiceConfig(
        voice_name="default"
    )
)
```

## Testing Considerations

1. **WebSocket Testing**
   - Test connection handling
   - Verify message flow
   - Check error scenarios

2. **Audio Processing**
   - Test different audio formats
   - Verify streaming behavior
   - Check transcription accuracy

3. **Integration Testing**
   - Verify end-to-end flow
   - Test concurrent sessions
   - Check resource cleanup

## Security Considerations

1. **Audio Data**
   - Secure transmission
   - Proper session isolation
   - Data cleanup after processing

2. **Authentication**
   - WebSocket authentication
   - Session validation
   - API key management

## Monitoring and Logging

- Implement comprehensive logging
- Track session metrics
- Monitor audio quality
- Track API usage

## Future Enhancements

1. **Potential Improvements**
   - Voice selection interface
   - Enhanced error recovery
   - Performance optimizations
   - Additional audio formats

2. **Scalability Considerations**
   - Session pooling
   - Load balancing
   - Resource optimization