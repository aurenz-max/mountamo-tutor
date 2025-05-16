// hooks/useGeminiWebSocket.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import webSocketService from '@/lib/WebSocketService';

interface UseGeminiWebSocketOptions {
  autoConnect?: boolean;
  enableTranscription?: boolean;
}

interface CurriculumContext {
  subject?: string;
  skill?: string;
  subskill?: string;
  objectives?: any;
}

export function useGeminiWebSocket(options: UseGeminiWebSocketOptions = {}) {
  const [status, setStatus] = useState(webSocketService.getStatus());
  const [messages, setMessages] = useState<any[]>([]);
  const [inputTranscriptions, setInputTranscriptions] = useState<string[]>([]);
  const [outputTranscriptions, setOutputTranscriptions] = useState<string[]>([]);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Set up event listeners when the hook is initialized
  useEffect(() => {
    // Handle status changes
    const statusChangeUnsubscribe = webSocketService.on('statusChange', (newStatus) => {
      setStatus(newStatus);
    });
    
    // Handle text messages
    const textUnsubscribe = webSocketService.on('text', (content) => {
      setMessages(prev => [...prev, { type: 'text', content, isUser: false, timestamp: Date.now() }]);
    });
    
    // Handle input transcriptions
    const inputTranscriptionUnsubscribe = webSocketService.on('inputTranscription', (content) => {
      setInputTranscriptions(prev => [...prev, content]);
    });
    
    // Handle output transcriptions
    const outputTranscriptionUnsubscribe = webSocketService.on('outputTranscription', (content) => {
      setOutputTranscriptions(prev => [...prev, content]);
    });
    
    // Auto-connect if enabled
    if (options.autoConnect) {
      connect({
        enableTranscription: options.enableTranscription
      });
    }
    
    // Clean up listeners when component unmounts
    return () => {
      statusChangeUnsubscribe();
      textUnsubscribe();
      inputTranscriptionUnsubscribe();
      outputTranscriptionUnsubscribe();
      
      // Clean up audio resources
      stopAudioRecording();
      
      // Disconnect WebSocket if connected
      if (webSocketService.isConnected()) {
        webSocketService.disconnect();
      }
    };
  }, [options.autoConnect, options.enableTranscription]);
  
  // Connect to the WebSocket with curriculum context
  const connect = useCallback(async (sessionData: CurriculumContext & { enableTranscription?: boolean } = {}) => {
    try {
      await webSocketService.connect({
        ...sessionData,
        enableTranscription: sessionData.enableTranscription ?? options.enableTranscription ?? true
      });
      
      // Clear previous messages and transcriptions on new connection
      setMessages([]);
      setInputTranscriptions([]);
      setOutputTranscriptions([]);
      
      return true;
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      return false;
    }
  }, [options.enableTranscription]);
  
  // Disconnect from the WebSocket
  const disconnect = useCallback(() => {
    webSocketService.disconnect();
  }, []);
  
  // Send a text message
  const sendTextMessage = useCallback((text: string) => {
    if (webSocketService.sendTextMessage(text)) {
      // Add to messages state
      setMessages(prev => [...prev, { 
        type: 'text', 
        content: text, 
        isUser: true, 
        timestamp: Date.now() 
      }]);
      return true;
    }
    return false;
  }, []);
  
  // Initialize audio recording
  const initializeAudioContext = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 16000, // Use 16kHz for Gemini
        });
      }
      
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      return false;
    }
  }, []);
  
  // Start recording audio
  const startAudioRecording = useCallback(async () => {
    if (isRecordingAudio) return true;
    
    const initialized = await initializeAudioContext();
    if (!initialized) return false;
    
    try {
      const audioContext = audioContextRef.current!;
      const stream = streamRef.current!;
      
      // Create audio source from media stream
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create script processor for audio processing
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      // Set up audio processing callback
      processor.onaudioprocess = (e) => {
        if (!isRecordingAudio) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert float32 audio data to Int16
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        // Send audio data to WebSocket
        webSocketService.sendAudioData(pcmData.buffer);
      };
      
      // Connect the nodes: source -> processor -> destination
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsRecordingAudio(true);
      return true;
    } catch (error) {
      console.error('Error starting audio recording:', error);
      return false;
    }
  }, [isRecordingAudio, initializeAudioContext]);
  
  // Stop recording audio
  const stopAudioRecording = useCallback(() => {
    if (!isRecordingAudio) return;
    
    try {
      if (processorRef.current && audioContextRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      setIsRecordingAudio(false);
    } catch (error) {
      console.error('Error stopping audio recording:', error);
    }
  }, [isRecordingAudio]);
  
  // Send a screen capture
  const sendScreenCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          cursor: 'always',
          displaySurface: 'window'
        } 
      });
      
      // Create video element to capture frame
      const video = document.createElement('video');
      video.srcObject = stream;
      
      return new Promise<boolean>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          
          // Capture a single frame from the video
          setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(video.videoWidth, 1280); // Limit size
            canvas.height = Math.floor(canvas.width * (video.videoHeight / video.videoWidth));
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              stream.getTracks().forEach(track => track.stop());
              resolve(false);
              return;
            }
            
            // Draw the video frame to the canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert to JPEG data URL with reduced quality
            const imageData = canvas.toDataURL('image/jpeg', 0.7);
            
            // Send to WebSocket
            const result = webSocketService.sendScreenCapture(imageData);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
            
            resolve(result);
          }, 100);
        };
      });
    } catch (error) {
      console.error('Error capturing screen:', error);
      return false;
    }
  }, []);
  
  // Clear all messages and transcriptions
  const clear = useCallback(() => {
    setMessages([]);
    setInputTranscriptions([]);
    setOutputTranscriptions([]);
  }, []);

  return {
    status,
    messages,
    inputTranscriptions,
    outputTranscriptions,
    isRecordingAudio,
    connect,
    disconnect,
    sendTextMessage,
    startAudioRecording,
    stopAudioRecording,
    sendScreenCapture,
    isConnected: webSocketService.isConnected.bind(webSocketService),
    clear
  };
}