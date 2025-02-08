import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react'; // Added Loader2
import AudioCaptureService from '@/lib/AudioCaptureService';

const TutoringInterface = ({ studentId, currentTopic }) => {
    const [status, setStatus] = useState('disconnected'); // Combined status
    const [sessionId, setSessionId] = useState(null);
    const [progress, setProgress] = useState(0); // Progress for the loading animation
    const wsRef = useRef(null);
    const audioCaptureRef = useRef(null);
    const audioContextRef = useRef(null);

    // Status values: disconnected, connecting, connected, recording, processing, playing, error
    const [processing, setProcessing] = useState(false); // New state for "thinking"
    const [isPlaying, setIsPlaying] = useState(false);


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
                floatData[i] = pcmData[i] / 32768.0; // Convert from Int16 to Float32, as before
            }

             const audioBuffer = audioContextRef.current.createBuffer(
                1, // mono
                floatData.length,
                24000 // Gemini's output rate
            );

            audioBuffer.copyToChannel(floatData, 0);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start(0);

            source.onended = () => {
              setIsPlaying(false);
            };


        } catch (error) {
            console.error('Error processing audio:', error);
            setStatus('error'); // Set status to error
        } finally {
             setIsPlaying(false);
            setProcessing(false); // Ensure processing stops even on error
        }
    };


    const handleWebSocketMessage = async (event) => {
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
                case 'audio_status':
                     setIsPlaying(response.status === 'speaking');
                    break;
                case 'audio':
                    await handleAudioData(response.data);
                    break;
                  case 'text':
                    console.log('Received text response:', response.content);
                       setProcessing(false); // Stop processing when text is received

                    break;
                case 'error':
                    setStatus('error'); // Set status to error
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
                        competency_score: 7.0
                    }
                }));
                resolve();  //Resolve when session starts
            };

            ws.onmessage = handleWebSocketMessage;

             ws.onclose = () => {
                setStatus('disconnected'); // Set status to disconnected
                setSessionId(null);
                setIsPlaying(false);  //Ensure playing status is up to date

            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                setStatus('error'); // Set status to error
                reject(error); // Reject on error
            };

            // Resolve once connection is established (moved to onopen)
        } catch (error) {
            console.error('Failed to initialize session:', error);
            setStatus('error'); // Set status to error
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
            setStatus('error'); // Set status to error on audio capture error
          },
        });
      }
      await audioCaptureRef.current.startCapture();
        // Set up callbacks, including processing start
       setProcessing(true); // Start processing after recording
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



  useEffect(() => {
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
      }
    };
  }, []);



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
            statusMessage = 'Thinking...'; //Tutor is thinking
            break;
        case 'error':
            statusMessage = 'An error occurred. Please try again.';
            break;
        default:
            statusMessage = 'Unknown status';
    }


   return (
        <div className="space-y-6">
           <div className="p-4 bg-gray-100 rounded-lg text-center">
                {status === 'error' ? (
                    <Alert variant="destructive">
                        <AlertDescription>{statusMessage}</AlertDescription>
                    </Alert>
                ) : (
                    <p className="text-sm text-gray-700">{statusMessage}</p>
                )}
            </div>


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
                            {isPlaying? 'Tutor Speaking' : 'Waiting for Input'}
                        </span>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default TutoringInterface;