import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import AudioCaptureService from '@/lib/AudioCaptureService';
import { Card } from '@/components/ui/card';
import GeminiControlPanel from './GeminiControlPanel';
import TranscriptionManager from './TranscriptionManager';
import { useAudioState } from '@/components/audio/AudioStateContext';
import AvatarViseme from '@/components/avatar/AvatarViseme';

const InteractiveWorkspace = React.lazy(() => import('./InteractiveWorkspace'));

const PRE_ROLL_SECONDS = 0.1;
const SAMPLE_RATE = 24000;
const FRAMES_PER_CHUNK = Math.floor(PRE_ROLL_SECONDS * SAMPLE_RATE);

interface Transcript {
  id: string | number;
  text: string;
  speaker: string;
  timestamp: string;
  isPartial: boolean;
}

const TutoringInterface = ({ studentId, currentTopic }) => {
  const [status, setStatus] = useState('disconnected');
  const [sessionId, setSessionId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);

  // Get the audio state context
  const { audioState, setAudioState } = useAudioState();

  // Transcription state managed here with useState
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(true);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [partialTranscripts, setPartialTranscripts] = useState<Record<string, Transcript>>({});

  // Add state for problem data
  const [currentProblem, setCurrentProblem] = useState(null);
  
  // Add state for avatar management
  const [avatarSceneReady, setAvatarSceneReady] = useState(false);
  const [currentScene, setCurrentScene] = useState(null);
  const avatarRef = useRef(null);
  const visemeHandlerRef = useRef<{
    handleVisemeEvent: (data: any) => void;
    currentViseme: string;
    visemeIntensity: number;
  } | null>(null);

  const wsRef = useRef(null);
  const audioCaptureRef = useRef(null);
  const audioContextRef = useRef(null);
  const endTimeRef = useRef(0);
  const workspaceRef = useRef(null);

  // Update global audio state whenever isPlaying or isListening changes
  useEffect(() => {
    setAudioState(prev => ({
      ...prev,
      isGeminiSpeaking: isPlaying,
      isUserSpeaking: isListening
    }));
  }, [isPlaying, isListening, setAudioState]);

  // Handle avatar scene ready callback
  const handleAvatarSceneReady = useCallback((sceneData) => {
    setAvatarSceneReady(true);
    avatarRef.current = sceneData?.avatar; // Make sure the avatar model is exposed
    
    // Initialize viseme handler reference with the avatar model
    visemeHandlerRef.current = AvatarViseme({
      avatar: sceneData?.avatar,
      speakerId: 'gemini', // Adjust this to match the speaker ID from your backend
      enabled: true,
      onVisemeApplied: (viseme, intensity) => {
        // Optional callback for debugging or UI updates
        console.log(`Applied viseme ${viseme} with intensity ${intensity}`);
      }
    });
    
    console.log('Avatar scene ready for visemes');
  }, []);

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (audioCaptureRef.current) audioCaptureRef.current.destroy();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const processTranscript = useCallback((transcriptData: any) => {
    if (!transcriptionEnabled) return;
    
    console.log('Current state before update:', {
      partialTranscriptsCount: Object.keys(partialTranscripts).length,
      transcriptsCount: transcripts.length
    });

    try {
      if (!transcriptData || !transcriptData.data) {
        console.error('Invalid transcript data format:', transcriptData);
        return;
      }
      
      const isPartial = transcriptData.data.is_partial;
      const transcriptId = transcriptData.data.id || Date.now().toString();
      const newText = transcriptData.data.text || '';

      if (isPartial) {
        console.log('Handling partial transcript:', {
          id: transcriptId,
          existingText: partialTranscripts[transcriptId]?.text,
          newText: newText,
          timestamp: transcriptData.timestamp
        });
        setPartialTranscripts(prev => {
          const existingTranscript = prev[transcriptId];
          return {
            ...prev,
            [transcriptId]: {
              id: transcriptId,
              // If there's existing text and the new text starts with it, use the new text
              // Otherwise append the new text to existing text
              text: existingTranscript?.text && newText.startsWith(existingTranscript.text) 
                ? newText 
                : (existingTranscript?.text || '') + newText,
              speaker: transcriptData.speaker || 'unknown',
              timestamp: transcriptData.timestamp || new Date().toISOString(),
              isPartial: true
            }
          };
        });
      } else {
        setPartialTranscripts(prev => {
          const updated = { ...prev };
          delete updated[transcriptId];
          return updated;
        });
        setTranscripts(prev => {
          const newTranscript = {
            id: transcriptId,
            text: newText,
            speaker: transcriptData.speaker || 'unknown',
            timestamp: transcriptData.timestamp || new Date().toISOString(),
            isPartial: false
          };
          const existingIndex = prev.findIndex(t => t.id === newTranscript.id);
          if (existingIndex >= 0) {
            const newTranscripts = [...prev];
            newTranscripts[existingIndex] = newTranscript;
            return newTranscripts;
          }
          return [...prev, newTranscript];
        });
      }
    } catch (error) {
      console.error('Error processing transcript:', error);
    }
  }, [transcriptionEnabled, partialTranscripts, transcripts]);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setPartialTranscripts({});
  }, []);

  const handleAudioData = async (audioData) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      let pcmData;
      if (audioData instanceof Blob) {
        const arrayBuffer = await audioData.arrayBuffer();
        pcmData = new Int16Array(arrayBuffer);
      } else {
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pcmData = new Int16Array(bytes.buffer);
      }
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0;
      }
      const audioBuffer = audioContextRef.current.createBuffer(1, floatData.length, SAMPLE_RATE);
      audioBuffer.copyToChannel(floatData, 0);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      const now = audioContextRef.current.currentTime;
      const startTime = Math.max(now, endTimeRef.current) + 0.01;
      source.start(startTime);
      const chunkDuration = floatData.length / SAMPLE_RATE;
      endTimeRef.current = startTime + chunkDuration;
      setIsPlaying(true); // This will now update the global audio state via useEffect
      source.onended = () => {
        const currentT = audioContextRef.current?.currentTime;
        if (currentT && currentT >= endTimeRef.current) setIsPlaying(false);
      };
    } catch (error) {
      console.error('Error processing audio:', error);
      setStatus('error');
    } finally {
      setProcessing(false);
    }
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = async (event) => {
    if (event.data instanceof Blob) {
      await handleAudioData(event.data);
      return;
    }
    try {
      const response = JSON.parse(event.data);
      switch (response.type) {
        case 'session_started':
          setSessionId(response.session_id);
          setStatus('connected');
          break;
        case 'audio_status':
          setIsPlaying(response.status === 'speaking');
          break;
        case 'audio':
          await handleAudioData(response.data);
          break;
        case 'text':
          console.log('Received text response:', response.content);
          setProcessing(false);
          break;
        case 'transcript':
          processTranscript(response.content);
          break;
        case 'viseme':
          // Handle the viseme data by passing to the avatar viseme handler
          if (visemeHandlerRef.current && avatarSceneReady) {
            visemeHandlerRef.current.handleVisemeEvent(response);
            console.log('Processed viseme:', response.content?.data?.viseme_id);
          } else {
            console.log('Viseme handler not ready, skipping viseme');
          }
          break;
        case 'scene':
          console.log('Received scene data:', response.content);
          setCurrentScene(response.content);
          break;
        case 'problem':
          // Existing problem handling code...
          console.log('Received problem data from WebSocket:', response);
          
          // Extract the problem data
          let problemData = null;
          
          if (response.content && response.content.data) {
            problemData = response.content.data;
          } else if (response.content) {
            problemData = response.content;
          } else if (response.data) {
            problemData = response.data;
          } else if (response.problem) {
            problemData = response;
          }
          
          console.log("Extracted problem data:", problemData);
          
          if (problemData) {
            if (problemData.problem || problemData.problem_type) {
              setCurrentProblem(problemData);
              console.log("Setting current problem:", problemData);
              
              if (workspaceRef.current && typeof workspaceRef.current.setProblemOpen === 'function') {
                workspaceRef.current.setProblemOpen(true);
                console.log("Attempting to open problem panel");
              } else {
                console.warn("Cannot access setProblemOpen method on workspace ref");
              }
            }
          }
          break;
        case 'error':
          setStatus('error');
          break;
        default:
          console.warn('Unknown message type:', response.type);
      }
    } catch (err) {
      console.error('Error parsing websocket message:', err);
    }
  };

  const initializeSession = async () => {
    return new Promise((resolve, reject) => {
      try {
        setStatus('connecting');
        const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/tutoring/session');
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
              competency_score: 7.0,
              skill_id: currentTopic.skill.id,
              subskill_id: currentTopic.subskill.id,
              difficulty_range: currentTopic.difficulty_range
            }
          }));
          resolve();
        };
        ws.onmessage = handleWebSocketMessage;
        ws.onclose = () => {
          setStatus('disconnected');
          setSessionId(null);
          setIsPlaying(false);
          setIsMicOn(false);
          setIsListening(false);
          clearTranscripts();
        };
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setStatus('error');
          reject(error);
        };
      } catch (error) {
        console.error('Failed to initialize session:', error);
        setStatus('error');
        reject(error);
      }
    });
  };

  const handleSessionChange = useCallback(async (newStatus) => {
    if (newStatus === 'connecting') {
      try {
        await initializeSession();
      } catch (error) {
        console.error('Failed to initialize session:', error);
      }
    } else if (newStatus === 'disconnected') {
      if (wsRef.current) wsRef.current.close();
      if (audioCaptureRef.current) {
        audioCaptureRef.current.destroy();
        audioCaptureRef.current = null;
      }
      setStatus('disconnected');
      setSessionId(null);
      clearTranscripts();
    } else {
      setStatus(newStatus);
    }
  }, [clearTranscripts]);

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
          audioCaptureRef.current.setCallbacks({
            onStateChange: ({ isCapturing }) => setIsMicOn(isCapturing),
            onError: (error) => {
              console.error('Audio capture error:', error);
              setStatus('error');
            },
          });
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

  const handleListeningStateChange = useCallback(async (isActiveListening) => {
    setIsListening(isActiveListening);
    if (isActiveListening && isMicOn) {
      try {
        if (audioCaptureRef.current) {
          await audioCaptureRef.current.startCapture();
          setProcessing(true);
        }
      } catch (err) {
        console.error('Error starting audio capture:', err);
        setStatus('error');
      }
    } else if (audioCaptureRef.current) {
      audioCaptureRef.current.stopCapture();
      setProcessing(false);
    }
  }, [isMicOn]);

  const handleTranscriptionToggle = useCallback((isEnabled: boolean) => {
    setTranscriptionEnabled(isEnabled);
    if (!isEnabled) setPartialTranscripts({}); // Clear partials when disabled
  }, []);

  return (
    <div className="flex flex-col space-y-4">
      <GeminiControlPanel
        onSessionChange={handleSessionChange}
        onMicToggle={handleMicToggle}
        onListeningStateChange={handleListeningStateChange}
        onTranscriptionToggle={handleTranscriptionToggle}
        isSpeaking={isPlaying}
        isProcessing={processing}
        transcriptionEnabled={transcriptionEnabled}
      />
      {status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>
            An error occurred. Please try refreshing the page or check your connection.
          </AlertDescription>
        </Alert>
      )}
      <React.Suspense fallback={
        <Card className="p-4">
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </Card>
      }>
      <InteractiveWorkspace
        ref={workspaceRef}
        currentTopic={currentTopic}
        studentId={studentId}
        sessionId={sessionId}
        currentProblem={currentProblem}
        currentScene={currentScene}
        onSubmit={(response) => console.log('Workspace submission:', response)}
        onAvatarSceneReady={handleAvatarSceneReady}
      />
      </React.Suspense>
      {transcriptionEnabled && (
        <TranscriptionManager
          enabled={transcriptionEnabled}
          transcripts={transcripts}
          partialTranscripts={partialTranscripts}
          className="absolute inset-0 pointer-events-none"
        />
      )}
      
      {/* Viseme debug overlay - only in development */}
      {process.env.NODE_ENV === 'development' && visemeHandlerRef.current && (
        <div className="viseme-debug" style={{
          position: 'fixed',
          right: '20px',
          bottom: '270px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '5px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 100
        }}>
          Viseme: {visemeHandlerRef.current.currentViseme} 
          <br />
          Intensity: {visemeHandlerRef.current.visemeIntensity.toFixed(2)}
        </div>
      )}
    </div>
  );
};

export default TutoringInterface;