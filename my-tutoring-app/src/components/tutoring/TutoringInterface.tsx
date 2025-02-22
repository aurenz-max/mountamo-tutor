import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import AudioCaptureService from '@/lib/AudioCaptureService';
import { Card } from '@/components/ui/card';

const InteractiveWorkspace = React.lazy(() => import('./InteractiveWorkspace'));

// ~100ms chunk size
const PRE_ROLL_SECONDS = 0.1; 
const SAMPLE_RATE = 24000;
const FRAMES_PER_CHUNK = Math.floor(PRE_ROLL_SECONDS * SAMPLE_RATE);

const TutoringInterface = ({ studentId, currentTopic }) => {
  //======================
  // State and References
  //======================
  const [status, setStatus] = useState('disconnected');
  const [sessionId, setSessionId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transcripts, setTranscripts] = useState([]);
  const [partialTranscripts, setPartialTranscripts] = useState({});

  const wsRef = useRef(null);
  const audioCaptureRef = useRef(null);
  const audioContextRef = useRef(null);
  const endTimeRef = useRef(0);

  //========================
  // Effects & Initialization
  //========================
  useEffect(() => {
    // Initialize the AudioContext if it doesn't exist
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioCaptureRef.current) {
        audioCaptureRef.current.destroy();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  //==============================
  // handleAudioData
  //==============================
  const handleAudioData = async (audioData) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      // 1) Convert incoming data -> Int16
      let pcmData;
      if (audioData instanceof Blob) {
        // If it's a Blob, convert to ArrayBuffer -> Int16
        const arrayBuffer = await audioData.arrayBuffer();
        pcmData = new Int16Array(arrayBuffer);
      } else {
        // Otherwise assume base64
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pcmData = new Int16Array(bytes.buffer);
      }

      // 2) Convert Int16 -> Float32
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0;
      }

      // 3) Create AudioBuffer from the entire chunk
      const audioBuffer = audioContextRef.current.createBuffer(
        1, // mono
        floatData.length,
        SAMPLE_RATE
      );
      audioBuffer.copyToChannel(floatData, 0);

      // 4) Create a BufferSource
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      // 5) Schedule the chunk to start right after the previous chunk ends
      // or now if we have no backlog
      const now = audioContextRef.current.currentTime;
      // We add a tiny offset (0.01) to avoid a glitch if endTimeRef is very close to now
      const startTime = Math.max(now, endTimeRef.current) + 0.01;
      source.start(startTime);

      // 6) Update the endTimeRef to reflect when this chunk will finish
      const chunkDuration = floatData.length / SAMPLE_RATE;
      endTimeRef.current = startTime + chunkDuration;

      // 7) Mark playing as soon as we schedule a chunk
      setIsPlaying(true);

      // 8) Once chunk ends, if no new chunk extends endTimeRef,
      //    that means playback is done
      source.onended = () => {
        const currentT = audioContextRef.current?.currentTime;
        // If there's no new chunk scheduled and we've passed endTimeRef,
        // then playback is truly finished
        if (currentT && currentT >= endTimeRef.current) {
          setIsPlaying(false);
        }
      };
    } catch (error) {
      console.error('Error processing audio:', error);
      setStatus('error');
    } finally {
      // Don't forcibly set isPlaying(false) here.
      setProcessing(false);
    }
  };

  const handleWebSocketMessage = async (event) => {
    if (event.data instanceof Blob) {
      // If data is a blob, pass it directly.
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
        case 'problem':
          console.log('Received problem:', response.content);
          break;
        case 'transcript':
          const transcriptData = response.content;
          const isPartial = transcriptData.data.is_partial;
          const transcriptId = transcriptData.data.id;
          
          if (isPartial) {
            // Handle partial transcript (streaming)
            setPartialTranscripts(prev => ({
              ...prev,
              [transcriptId]: {
                id: transcriptId,
                text: transcriptData.data.text,
                speaker: transcriptData.speaker,
                timestamp: transcriptData.timestamp
              }
            }));
          } else {
            // Handle final transcript
            // First remove any partial transcript with this ID
            setPartialTranscripts(prev => {
              const updated = { ...prev };
              delete updated[transcriptId];
              return updated;
            });
            
            // Then add the final transcript to the main list
            setTranscripts(prev => {
              const newTranscript = {
                id: transcriptId || Date.now(),
                text: transcriptData.data.text,
                speaker: transcriptData.speaker,
                timestamp: transcriptData.timestamp
              };
              
              // Replace existing transcript with the same ID if exists, otherwise add new
              const existingIndex = prev.findIndex(t => t.id === newTranscript.id);
              if (existingIndex >= 0) {
                const newTranscripts = [...prev];
                newTranscripts[existingIndex] = newTranscript;
                return newTranscripts;
              } else {
                return [...prev, newTranscript];
              }
            });
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
          setPartialTranscripts({});
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

  const startRecording = async () => {
    try {
      // Initialize session if not already connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await initializeSession();
      }

      setStatus('recording');

      // Initialize audio capture if not already done
      if (!audioCaptureRef.current) {
        audioCaptureRef.current = new AudioCaptureService({
          targetSampleRate: 16000,
          channelCount: 1,
          bufferSize: 4096,
        });

        audioCaptureRef.current.setWebSocket(wsRef.current);
        audioCaptureRef.current.setCallbacks({
          onStateChange: ({ isCapturing }) => {
            // Update status based on capturing state, but don't override error
            if (status !== 'error') {
              setStatus(isCapturing ? 'recording' : 'connected');
            }
          },
          onError: (error) => {
            console.error('Audio capture error:', error);
            setStatus('error');
          },
        });
      }
      await audioCaptureRef.current.startCapture();
      setProcessing(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setStatus('error');
    }
  };

  const stopRecording = () => {
    if (audioCaptureRef.current) {
      audioCaptureRef.current.stopCapture();
      setStatus('connected');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioCaptureRef.current) {
        audioCaptureRef.current.destroy();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Merge final and partial transcripts for display
  const allTranscripts = [
    ...transcripts,
    ...Object.values(partialTranscripts)
  ];

  // Determine the message to display based on the status
  let statusMessage;
  switch (status) {
    case 'disconnected':
      statusMessage = 'Not connected';
      break;
    case 'connecting':
      statusMessage = 'Connecting to tutor...';
      break;
    case 'connected':
      statusMessage = sessionId ? `Connected - Session ${sessionId}` : 'Connected';
      break;
    case 'recording':
      statusMessage = 'Recording...';
      break;
    case 'processing':
      statusMessage = 'Thinking...';
      break;
    case 'error':
      statusMessage = 'An error occurred. Please try again.';
      break;
    default:
      statusMessage = 'Unknown status';
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Status Bar */}
      <div className="p-4 bg-gray-100 rounded-lg text-center">
        {status === 'error' ? (
          <Alert variant="destructive">
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-gray-700">{statusMessage}</p>
        )}
      </div>

      {/* Interactive Workspace */}
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
          currentTopic={currentTopic}
          studentId={studentId}
          onSubmit={(response) => console.log('Workspace submission:', response)}
          transcripts={allTranscripts}
        />
      </React.Suspense>

      {/* Audio Controls */}
      <div className="flex flex-col items-center space-y-6">
        {processing && (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="animate-spin h-5 w-5 text-gray-500" />
            <div className="w-10 h-1 bg-gray-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className='text-gray-600 text-sm'>Waiting for Response...</span>
          </div>
        )}

        <div className="flex items-center space-x-4">
          <Button
            onClick={() => {
              if (status === 'recording') {
                stopRecording();
              } else {
                startRecording();
              }
            }}
            variant={status === 'recording' ? 'destructive' : 'default'}
            size="lg"
            className="rounded-full"
            disabled={status === 'connecting' || status === 'processing'}
          >
            {status === 'recording' ? (
              <MicOff className="w-6 h-6 animate-pulse" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </Button>

          <div className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-full">
            {isPlaying ? (
              <Volume2 className="w-4 h-4 text-green-500" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-sm">
              {isPlaying ? 'Tutor Speaking' : 'Waiting for Input'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutoringInterface;