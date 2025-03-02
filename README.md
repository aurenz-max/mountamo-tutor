# mountamo-tutor

# Educational Platform API

An adaptive learning platform API that provides personalized educational experiences based on student competency levels. The platform includes features for competency tracking, problem generation, tutoring sessions, learning path recommendations, and visual content management.

## Core Features

- **Student Competency Tracking**: Monitor and evaluate student progress across various subjects, skills, and subskills
- **Problem Generation**: Create adaptive problems tailored to student competency levels
- **Real-time Tutoring**: WebSocket-based interactive tutoring sessions with audio support
- **Learning Path Management**: Decision tree-based skill progression recommendations
- **Visual Learning Support**: Visual content generation for interactive learning

## API Endpoints

### Competency Management

```
GET  /competency/student/{student_id}                                     # Get overview of all competencies for a student
GET  /competency/student/{student_id}/subject/{subject}/skill/{skill_id}  # Get competency level for a skill
GET  /competency/student/{student_id}/subject/{subject}/skill/{skill_id}/subskill/{subskill_id}  # Get subskill competency
POST /competency/update                                                   # Update a student's competency
GET  /competency/student/{student_id}/progress                            # Get comprehensive progress data
GET  /competency/student/{student_id}/daily                               # Get daily progress metrics
GET  /competency/student/{student_id}/skills/{subject}                    # Get skill competency analysis
GET  /competency/student/{student_id}/detailed/{subject}                  # Get detailed analytics for a subject
GET  /competency/subjects                                                 # List all available subjects
GET  /competency/curriculum/{subject}                                     # Get complete curriculum structure
GET  /competency/objectives/{subject}/{subskill_id}                       # Get detailed learning objectives
GET  /competency/problem-types/{subject}                                  # Get all available problem types
```

### Problem Generation

```
POST /problems/generate                                                   # Generate a new problem
GET  /problems/history/{student_id}                                       # Get history of problems attempted
POST /problems/submit                                                     # Submit a problem solution for review
POST /problems/difficulty                                                 # Update difficulty settings
```

### Curriculum Management

```
GET  /curriculum/subjects                                                 # List all available subjects
GET  /curriculum/curriculum/{subject}                                     # Get complete curriculum structure
GET  /curriculum/problem-types/{subject}                                  # Get all available problem types
```

### Learning Paths

```
GET  /learning-paths/learning-paths                                       # Get complete learning paths decision tree
GET  /learning-paths/student/{student_id}/subject/{subject}/recommendations  # Get recommended next skills
GET  /learning-paths/prerequisites/{skill_id}                             # Get prerequisites for a skill
```

### Tutoring Sessions

```
WebSocket /tutoring/session                                               # Real-time tutoring session
GET  /reviews/sessions/{student_id}                                       # Get all past sessions for a student
GET  /reviews/session/{session_id}                                        # Get detailed information about a session
```

The tutoring system is the core functionality of the platform, providing real-time, interactive learning experiences through a WebSocket interface. The system combines audio processing, real-time transcription, AI-driven tutoring, problem generation, and visual aids to create an engaging educational experience.

#### Session Flow

1. **Session Initialization**: Client connects via WebSocket and provides initial session parameters (subject, skill, student ID, etc.)
2. **Real-time Communication**: Bidirectional communication allows for:
   - Audio streaming from student to tutor
   - Text and audio responses from the AI tutor
   - Interactive problem generation and evaluation
   - Visual scene creation for enhanced learning

#### Message Types

The WebSocket communication uses a structured message format:

- **Client to Server**:
  - `InitSession`: Initialize a new tutoring session with subject, skill, and student metadata
  - `realtime_input`: Stream audio data from client microphone as base64-encoded chunks
  
- **Server to Client**:
  - `session_started`: Confirmation of session creation with unique session ID
  - `text`: Text response from the AI tutor
  - `audio`: Binary or base64-encoded audio data of the tutor's speech
  - `transcript`: Real-time transcription of both student and tutor speech
  - `problem`: Interactive problem data for student to solve
  - `scene`: Visual content to enhance the learning experience
  - `error`: Error notifications

#### Audio Processing

The tutoring system includes sophisticated audio handling capabilities:
- Real-time audio streaming and processing at 24kHz sample rate
- Speech-to-text conversion of student input with partial transcript support
- Text-to-speech generation for tutor responses via Azure Speech Service
- Concurrent audio processing with buffering to ensure smooth playback

#### AI-Driven Tutoring

Gemini AI integration powers the tutoring experience:
- Dynamic conversation management based on student's skill level
- Adaptive teaching strategies based on competency data
- Personalized explanations tailored to individual learning styles
- Natural language processing to understand student questions

#### Visual Scenes Support

The tutoring experience is enhanced with visual elements:
- Dynamic scene generation for mathematical concepts
- Visual representations of problems (e.g., counting scenes)
- Interactive visual elements synchronized with the tutoring conversation
- Categories of visual content (shapes, objects, etc.) for different learning scenarios

#### Frontend Integration

The frontend implements:
- `AudioCaptureService`: Handles microphone access, recording, and streaming
- `TranscriptionManager`: Manages both partial and complete transcripts
- `InteractiveWorkspace`: Provides problem visualization and submission interface
- `GeminiControlPanel`: UI controls for session management and audio interactions

#### Session Management

- **Concurrent Handler Architecture**: Multiple concurrent event handlers manage different aspects of the session (text, audio, problems, transcripts, and visual scenes)
- **WebSocket Lifecycle Management**: Proper connection, error handling, and cleanup
- **State Management**: React hooks for managing session state, audio status, and transcription data
- **Error Recovery**: Mechanisms to handle connection failures and service disruptions

#### Integration with Competency System

- Sessions are informed by the student's existing competency data
- Session performance updates the competency model in real-time
- Learning path recommendations influence session content
- Problem difficulty adapts based on in-session performance

### Visual Content

```
GET  /visual/categories                                                   # Get a list of available image categories
GET  /visual/images                                                       # Get available images
GET  /visual/image/{image_id}                                             # Get a specific image by ID
POST /visual/scene/counting                                               # Create a counting scene
POST /visual/scene/multi-object                                           # Create a scene with multiple objects
GET  /visual/session/{session_id}/scenes                                  # Get all active scenes for a session
DELETE /visual/scene/{session_id}/{scene_id}                              # Delete a specific scene
```

## Architecture

The platform consists of several services:

1. **CompetencyService**: Tracks and updates student competency levels
2. **ProblemService**: Generates problems based on competency
3. **LearningPathsService**: Manages skill progression
4. **TutoringService**: Handles real-time tutoring sessions
5. **VisualContentService**: Manages visual learning elements
6. **SessionManager**: Manages WebSocket connections and session state

## Technologies

- **FastAPI**: High-performance web framework for building APIs
- **WebSockets**: Real-time communication for tutoring
- **Gemini AI**: Integration for problem review and generation
- **Azure Speech Service**: Text-to-speech capabilities for tutoring
- **CosmosDB**: Database for session storage

## Getting Started

1. Clone the repository
2. Install dependencies with `pip install -r requirements.txt`
3. Configure environment variables in `.env` file
4. Run the application with `uvicorn app.main:app --reload`
5. Access the API documentation at `http://localhost:8000/docs`

## Usage Examples

### Working with Tutoring Sessions

#### React Implementation Example

```tsx
// TutoringInterface.tsx (simplified from the provided code)
import React, { useEffect, useState, useRef, useCallback } from 'react';
import AudioCaptureService from '@/lib/AudioCaptureService';
import TranscriptionManager from './TranscriptionManager';
import InteractiveWorkspace from './InteractiveWorkspace';

const TutoringInterface = ({ studentId, currentTopic }) => {
  // Session state
  const [status, setStatus] = useState('disconnected');
  const [sessionId, setSessionId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  
  // Content state
  const [transcripts, setTranscripts] = useState([]);
  const [partialTranscripts, setPartialTranscripts] = useState({});
  const [currentProblem, setCurrentProblem] = useState(null);
  const [currentScene, setCurrentScene] = useState(null);
  
  // References
  const wsRef = useRef(null);
  const audioCaptureRef = useRef(null);
  const audioContextRef = useRef(null);
  
  // Initialize WebSocket connection
  const initializeSession = async () => {
    setStatus('connecting');
    const ws = new WebSocket('ws://localhost:8000/api/tutoring/session');
    ws.binaryType = 'blob';
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      ws.send(JSON.stringify({
        text: "InitSession",
        data: {
          subject: currentTopic.subject,
          skill_description: currentTopic.skill.description,
          subskill_description: currentTopic.subskill.description,
          student_id: studentId,
          competency_score: currentTopic.competency_score || 7.0,
          skill_id: currentTopic.skill.id,
          subskill_id: currentTopic.subskill.id
        }
      }));
    };
    
    ws.onmessage = handleWebSocketMessage;
    ws.onclose = () => {
      setStatus('disconnected');
      setSessionId(null);
      setIsPlaying(false);
      setIsMicOn(false);
      setIsListening(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('error');
    };
  };
  
  // Handle incoming WebSocket messages
  const handleWebSocketMessage = async (event) => {
    // Handle binary audio data
    if (event.data instanceof Blob) {
      await handleAudioData(event.data);
      return;
    }
    
    // Handle JSON messages
    try {
      const response = JSON.parse(event.data);
      
      switch (response.type) {
        case 'session_started':
          setSessionId(response.session_id);
          setStatus('connected');
          break;
          
        case 'audio':
          await handleAudioData(response.data);
          break;
          
        case 'text':
          console.log('Received text response:', response.content);
          break;
          
        case 'transcript':
          processTranscript(response.content);
          break;
          
        case 'scene':
          console.log('Received scene data:', response.content);
          setCurrentScene(response.content);
          break;
          
        case 'problem':
          console.log('Received problem data:', response.content);
          setCurrentProblem(response.content);
          break;
          
        case 'error':
          setStatus('error');
          break;
      }
    } catch (err) {
      console.error('Error parsing websocket message:', err);
    }
  };
  
  // Process and handle audio data from the server
  const handleAudioData = async (audioData) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Processing omitted for brevity (see full implementation)
      // ...
      
      setIsPlaying(true);
    } catch (error) {
      console.error('Error processing audio:', error);
      setStatus('error');
    }
  };
  
  // Toggle microphone status
  const handleMicToggle = useCallback(async (isActive) => {
    setIsMicOn(isActive);
    if (isActive) {
      try {
        if (!audioCaptureRef.current) {
          audioCaptureRef.current = new AudioCaptureService({
            targetSampleRate: 16000,
            channelCount: 1,
            bufferSize: 4096,
          });
          audioCaptureRef.current.setWebSocket(wsRef.current);
        }
      } catch (err) {
        console.error('Error initializing microphone:', err);
        setStatus('error');
      }
    } else if (isListening) {
      setIsListening(false);
      if (audioCaptureRef.current) audioCaptureRef.current.stopCapture();
    }
  }, [isListening]);
  
  // Start/stop listening for audio
  const handleListeningStateChange = useCallback(async (isActiveListening) => {
    setIsListening(isActiveListening);
    if (isActiveListening && isMicOn) {
      try {
        if (audioCaptureRef.current) {
          await audioCaptureRef.current.startCapture();
        }
      } catch (err) {
        console.error('Error starting audio capture:', err);
        setStatus('error');
      }
    } else if (audioCaptureRef.current) {
      audioCaptureRef.current.stopCapture();
    }
  }, [isMicOn]);
  
  return (
    <div className="flex flex-col space-y-4">
      {/* UI components for tutor controls, workspace, and transcription */}
      <InteractiveWorkspace
        currentTopic={currentTopic}
        studentId={studentId}
        sessionId={sessionId}
        currentProblem={currentProblem}
        currentScene={currentScene}
      />
      
      <TranscriptionManager
        enabled={true}
        transcripts={transcripts}
        partialTranscripts={partialTranscripts}
      />
    </div>
  );
};
```

#### Audio Capture Service

```typescript
// AudioCaptureService.ts (simplified)
class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private websocket: WebSocket | null = null;
  private options: AudioCaptureOptions;
  private callbacks: AudioCaptureCallbacks = {};

  constructor(options: AudioCaptureOptions) {
    this.options = {
      targetSampleRate: 16000,
      channelCount: 1,
      bufferSize: 4096,
      ...options
    };
  }

  setWebSocket(ws: WebSocket | null) {
    this.websocket = ws;
  }

  setCallbacks(callbacks: AudioCaptureCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  async startCapture() {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: this.options.channelCount,
          sampleRate: this.options.targetSampleRate
        } 
      });
      
      // Set up MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      this.mediaRecorder.ondataavailable = this.onDataAvailable.bind(this);
      this.mediaRecorder.start(100); // Capture audio in 100ms chunks
      
      if (this.callbacks.onStateChange) {
        this.callbacks.onStateChange({ isCapturing: true });
      }
    } catch (error) {
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      throw error;
    }
  }

  // Process and send audio chunks to the WebSocket
  private onDataAvailable(event: BlobEvent) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.toString().split(',')[1];
      
      this.websocket.send(JSON.stringify({
        type: "realtime_input",
        media_chunks: [base64data],
        mime_type: "audio/webm"
      }));
    };
    
    reader.readAsDataURL(event.data);
  }

  stopCapture() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange({ isCapturing: false });
    }
  }

  destroy() {
    this.stopCapture();
    this.websocket = null;
  }
}

export default AudioCaptureService;
```

#### Visual Content API

```typescript
// visualContentApi.ts
const VISUAL_API_BASE_URL = 'http://localhost:8000/api/visual';

export interface ImageInfo {
  id: string;
  name: string;
  category: string;
  type: string;
  data_uri?: string;
}

export const visualContentApi = {
  // Get available image categories
  getVisualCategories: async () => {
    const response = await fetch(`${VISUAL_API_BASE_URL}/categories`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return await response.json();
  },

  // Get images for a specific category
  getVisualImages: async (category: string) => {
    const response = await fetch(
      `${VISUAL_API_BASE_URL}/images?category=${encodeURIComponent(category)}`
    );
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return await response.json();
  },

  // Create a counting scene
  createCountingScene: async (request: {
    session_id: string;
    object_type: string;
    count: number;
    layout?: string;
  }) => {
    const response = await fetch(`${VISUAL_API_BASE_URL}/scene/counting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    return await response.json();
  },
  
  // Create a multi-object scene
  createMultiObjectScene: async (request: {
    session_id: string;
    object_counts: Record<string, number>;
    layout?: string;
    title?: string;
  }) => {
    const response = await fetch(`${VISUAL_API_BASE_URL}/scene/multi-object`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    return await response.json();
  }
};
```

### Fetching Student Competency

```javascript
// Get a student's competency for a specific skill
const getCompetency = async (studentId, subject, skillId) => {
  const response = await fetch(
    `/competency/student/${studentId}/subject/${subject}/skill/${skillId}`
  );
  return await response.json();
};
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
