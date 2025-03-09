import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import AudioCaptureService from '@/lib/AudioCaptureService';
import { Card } from '@/components/ui/card';
import GeminiControlPanel from './GeminiControlPanel';
import TranscriptionManager from './TranscriptionManager';
import { useAudioState } from '@/components/audio/AudioStateContext';
import { audioSyncManager } from '@/lib/AudioSyncManager';
import { LipSyncManager } from '@/lib/LipSyncManager';


const InteractiveWorkspace = React.lazy(() => import('./InteractiveWorkspace'));

const SAMPLE_RATE = 24000;

interface Transcript {
  id: string | number;
  text: string;
  speaker: string;
  timestamp: string;
  isPartial: boolean;
}

// Add this TypeScript declaration at the top of the file to avoid type errors
declare global {
  interface Window {
    lipSyncManager: any;
    avatarAPI: any;
    debugAvatarConnection: () => void;
    testMouth: (index: number, value?: number) => string;
    animateMouth: (index?: number) => string;
  }
}

const TutoringInterface = ({ studentId, currentTopic }) => {
  const [status, setStatus] = useState('disconnected');
  const [sessionId, setSessionId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [geminiSpeaking, setGeminiSpeaking] = useState(false);
  const lastVisemeTimeRef = useRef<number>(0);
  const currentUtteranceRef = useRef<string | null>(null);
  const lipSyncRef = useRef<LipSyncManager | null>(null);

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
  
    // Update viseme handler based on speaking state
    if (visemeHandlerRef.current) {
      if (!isPlaying && visemeHandlerRef.current.isSpeaking()) {
        // If Gemini stops speaking but mouth is still moving, reset to silence
        visemeHandlerRef.current.setSilence();
      }
    }
  }, [isPlaying, isListening, setAudioState]);

  // Initialize in useEffect
  useEffect(() => {
    // Create instance with desired configuration
    lipSyncRef.current = new LipSyncManager({
      debug: true,  // Set to false in production
      visemeLeadTime: 50,
      silenceVisemeIntensity: 0.1
    });
    
    // Expose to the global window object for the animation loop to access
    if (typeof window !== 'undefined') {
      window.lipSyncManager = lipSyncRef.current;
      console.log('LipSyncManager exposed globally for animation synchronization');
    }
  
    return () => {
      // Clean up on unmount
      if (lipSyncRef.current) {
        lipSyncRef.current.destroy();
      }
      
      // Remove from global
      if (typeof window !== 'undefined') {
        window.lipSyncManager = null;
      }
    };
  }, []);


  // Add this effect to set up the global avatar API
  useEffect(() => {
    // Setup avatar integration when component mounts
    if (typeof window !== 'undefined') {
      // Create global API if it doesn't exist
      if (!window.avatarAPI) {
        window.avatarAPI = {
          avatar: null,
          setAvatar: (avatar) => {
            window.avatarAPI.avatar = avatar;
            console.log('GLOBAL AVATAR API: Avatar set', !!avatar);
            
            // Notify any listeners
            if (window.avatarAPI.onAvatarReady) {
              window.avatarAPI.onAvatarReady(avatar);
            }
          },
          onAvatarReady: null
        };
      }
      
      // If avatar is already available, use it immediately
      if (window.avatarAPI.avatar) {
        console.log('TUTORING INTERFACE: Avatar already available');
        handleAvatarSceneReady({ avatar: window.avatarAPI.avatar });
      }
      
      // Otherwise, set up a listener for when it becomes available
      window.avatarAPI.onAvatarReady = (avatar) => {
        console.log('TUTORING INTERFACE: Avatar became available via global API');
        handleAvatarSceneReady({ avatar });
      };
    }
    
    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined' && window.avatarAPI) {
        window.avatarAPI.onAvatarReady = null;
      }

      if (visemeHandlerRef.current && visemeHandlerRef.current.destroy) {
        visemeHandlerRef.current.destroy();
      }
    };
  }, []);
  

// When avatar is ready
const handleAvatarSceneReady = useCallback((sceneData) => {
  if (sceneData?.avatar && lipSyncRef.current) {
    // Set the avatar for lip syncing
    const success = lipSyncRef.current.setAvatar(sceneData.avatar);
    console.log('Avatar connected to LipSyncManager:', success);
    
    // Optional: Test visemes to confirm setup
    setTimeout(() => {
      if (lipSyncRef.current) {
        // Test a common word sequence like "Hello"
        // SIL → H → EH → L → OW
        lipSyncRef.current.testVisemeSequence([0, 15, 4, 13, 7]);
      }
    }, 500);
  }
}, []);

// Add this useEffect for animation performance
useEffect(() => {
  // Disable viseme updates while audio isn't playing to save performance
  if (lipSyncRef.current) {
    if (isPlaying) {
      // Check if we need to test viseme setup first
      if (!lipSyncRef.current.hasTestedSetup && avatarRef.current) {
        // Quick viseme test to ensure everything is connected
        setTimeout(() => {
          lipSyncRef.current.testViseme(0, 100); // Test silence viseme
        }, 100);
        lipSyncRef.current.hasTestedSetup = true;
      }
    }
  }
}, [isPlaying]);  

useEffect(() => {
  // Create a global debug function we can call from the console
  window.debugAvatarConnection = () => {
    console.log("=== AVATAR CONNECTION DEBUG ===");
    
    // Step 1: Is the avatar available globally?
    console.log("1. Global avatar API:", 
      window.avatarAPI ? "exists" : "missing",
      window.avatarAPI?.avatar ? "has avatar" : "no avatar");
    
    // Step 2: Can we find the head mesh with morph targets?
    if (window.avatarAPI?.avatar) {
      let foundMorphTargets = false;
      window.avatarAPI.avatar.traverse(obj => {
        if (obj.isMesh && obj.morphTargetDictionary) {
          console.log("2. Found mesh with morph targets:", obj.name);
          console.log("   Available morphs:", Object.keys(obj.morphTargetDictionary));
          foundMorphTargets = true;
          
          // Step 3: Can we manually set a morph target?
          const visemeNames = Object.keys(obj.morphTargetDictionary)
            .filter(name => name.startsWith('viseme_'));
          
          if (visemeNames.length > 0) {
            const testViseme = visemeNames[0];
            const index = obj.morphTargetDictionary[testViseme];
            
            // Store original value
            const originalValue = obj.morphTargetInfluences[index];
            
            // Set to 1.0
            console.log(`3. Testing morph target: ${testViseme} (index: ${index})`);
            console.log(`   Original value: ${originalValue}`);
            obj.morphTargetInfluences[index] = 1.0;
            
            // Restore after 2 seconds
            setTimeout(() => {
              obj.morphTargetInfluences[index] = originalValue;
              console.log(`   Restored morph target: ${testViseme}`);
            }, 2000);
            
            return; // Exit after testing one morph
          } else {
            console.log("3. No viseme morphs found in this mesh");
          }
        }
      });
      
      if (!foundMorphTargets) {
        console.log("2. NO MORPH TARGETS FOUND in avatar");
      }
    }
    
    // Step 4: Check LipSyncManager state
    console.log("4. LipSync manager state:", 
      lipSyncRef.current ? "exists" : "missing");
    
    if (lipSyncRef.current) {
      console.log("   Has avatar:", !!lipSyncRef.current.avatar);
      console.log("   Has head mesh:", !!lipSyncRef.current.headMesh);
      console.log("   Viseme indices:", 
        Object.keys(lipSyncRef.current.visemeIndices || {}).length);
    }
  };
  
  // Auto-run after 3 seconds to ensure everything is loaded
  setTimeout(() => {
    console.log("Running automated avatar connection debug...");
    if (window.debugAvatarConnection) window.debugAvatarConnection();
  }, 3000);
  
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

  const handleAudioData = async (audioData, serverTimestamp?: number, duration?: number) => {
    try {
      // Initialize the audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Convert the incoming audio data to PCM format
      let pcmData;
      if (audioData instanceof Blob) {
        // Handle case where audio comes as a Blob (binary data)
        const arrayBuffer = await audioData.arrayBuffer();
        pcmData = new Int16Array(arrayBuffer);
      } else {
        // Handle case where audio comes as base64 encoded string
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pcmData = new Int16Array(bytes.buffer);
      }
      
      // Convert from Int16 PCM to Float32 format for Web Audio API
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0; // Normalize 16-bit PCM to -1.0 to 1.0 range
      }
      
      // Create an audio buffer with the proper sample rate
      const audioBuffer = audioContextRef.current.createBuffer(1, floatData.length, SAMPLE_RATE);
      audioBuffer.copyToChannel(floatData, 0);
      
      // Create a source node to play the audio
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      // Schedule the audio playback with precise timing
      const now = audioContextRef.current.currentTime;
      const audioContextLatency = audioContextRef.current.baseLatency || 0.005;
      const startTime = Math.max(now, endTimeRef.current) + 0.01; // Small gap to prevent overlaps
      source.start(startTime);
      
      // Calculate when this audio chunk will finish playing
      const chunkDuration = floatData.length / SAMPLE_RATE;
      endTimeRef.current = startTime + chunkDuration;
      
      // Calculate duration in milliseconds
      const durationMs = duration || Math.floor(chunkDuration * 1000);
      
      // Use server timestamp if provided, otherwise use current time
      const timestamp = serverTimestamp || Date.now();
      
      // CRITICAL: Dispatch event for LipSyncManager to synchronize visemes with audio
      window.dispatchEvent(new CustomEvent('audio-playback-scheduled', {
        detail: {
          serverTimestamp: timestamp,
          clientTimestamp: Date.now(),
          scheduledPlaybackTime: startTime * 1000, // Convert to ms for consistency
          duration: durationMs,
          visemeLeadTime: lipSyncRef.current?.config?.visemeLeadTime || 50
        }
      }));
      
      // For backwards compatibility - also notify the audioSyncManager
      // This can be removed once everything is migrated to LipSyncManager
      audioSyncManager.notifyAudioScheduled(
        timestamp,
        startTime * 1000,
        durationMs
      );
      
      // Update local component state to show we're playing audio
      setIsPlaying(true);
      
      // Update global audio state context
      setAudioState(prev => ({
        ...prev,
        isGeminiSpeaking: true
      }));
      
      // Update speaking state for viseme processing
      setGeminiSpeaking(true);
      
// Update the source.onended callback in handleAudioData function in TutoringInterface.tsx
source.onended = () => {
  const currentT = audioContextRef.current?.currentTime;
  
  // Check if the audio context's current time has passed our end time
  if (currentT && currentT >= endTimeRef.current) {
    // Update play state
    setIsPlaying(false);
    
    // Update global audio state context
    setAudioState(prev => ({
      ...prev,
      isGeminiSpeaking: false
    }));
    
    // CRITICAL: Dispatch event to signal audio playback has ended
    window.dispatchEvent(new CustomEvent('audio-playback-ended'));
    
    // For backwards compatibility
    audioSyncManager.notifyAudioEnded();
    
    // Add a grace period before considering the utterance complete
    setTimeout(() => {
      // After grace period, update speaking state and clear utterance ID
      setGeminiSpeaking(false);
      currentUtteranceRef.current = null;
      
      // IMPORTANT: Explicitly reset lip sync to silence state to ensure mouth closes
      if (lipSyncRef.current) {
        lipSyncRef.current.setSilence();
      }
    }, 300); // 300ms grace period
  }
};

    } catch (error) {
      console.error('Error processing audio:', error);
      setStatus('error');
    } finally {
      // Ensure processing state is reset even if there was an error
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
          // Check if this message includes timestamp information
          if (response.timestamp !== undefined) {
            // Process with timestamp info
            await handleAudioData(response.data, response.timestamp, response.duration);
          } else {
            // Fallback to original behavior
            await handleAudioData(response.data);
          }
          break;
        case 'text':
          console.log('Received text response:', response.content);
          setProcessing(false);
          break;
        case 'transcript':
          processTranscript(response.content);
          break;
          case 'viseme':
            // Simply forward to the lip sync manager
            if (lipSyncRef.current) {
              lipSyncRef.current.handleVisemeEvent(response);
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
    </div>
  );
};

export default TutoringInterface;