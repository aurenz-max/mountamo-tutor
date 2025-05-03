'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Mic, MicOff, Monitor, MonitorOff, RefreshCw, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Import your existing AudioCaptureService
import AudioCaptureService from '@/lib/AudioCaptureService';

interface EnhancedGeminiTutorProps {
  // Original props
  simulationTitle: string;
  simulationDescription: string;
  subject: string;
  skill: string;
  subskill: string;
  // Add new prop for simulation container
  simulationContainerId?: string;
  apiUrl?: string;
  expanded?: boolean;
  onClose?: () => void;
  className?: string;
}

type MessageRole = 'user' | 'gemini' | 'system';

interface Message {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

const EnhancedGeminiTutor: React.FC<EnhancedGeminiTutorProps> = ({
  simulationTitle,
  simulationDescription,
  subject,
  skill,
  subskill,
  simulationContainerId = 'simulation-container',
  apiUrl = 'ws://localhost:8000/api/gemini/bidirectional',
  expanded = true,
  onClose,
  className = '',
}) => {
  // State management
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Refs
  const socketRef = useRef<WebSocket | null>(null);
  const audioCaptureServiceRef = useRef<AudioCaptureService | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isPlayingRef = useRef(false);
  const screenCaptureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio constants
  const PLAYBACK_SAMPLE_RATE = 24000; // Gemini outputs 24kHz audio

  // Audio constants and refs
  const MIN_BUFFER_LENGTH = 1000; // Minimum buffer size to play independently
  const MAX_BUFFER_QUEUE = 10; // Maximum number of buffers to queue before consolidation
  const BUFFER_GAP = 0.02; // 20ms gap between buffers - more forgiving

  // Add these refs
  const bufferConsolidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScheduledTimeRef = useRef<number>(0);

  // Connect to WebSocket
  const connectWebSocket = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Build the WebSocket URL with query parameters
      const wsParams = new URLSearchParams();
      wsParams.append('subject', subject);
      wsParams.append('skill', skill);
      wsParams.append('subskill', subskill);
      
      const wsUrl = `${apiUrl}?${wsParams.toString()}`;
      console.log(`Attempting to connect to WebSocket at ${wsUrl}`);
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setIsConnecting(false);
        
        // Initialize the audio capture service when websocket is connected
        if (!audioCaptureServiceRef.current) {
          audioCaptureServiceRef.current = new AudioCaptureService();
          audioCaptureServiceRef.current.setCallbacks({
            onStateChange: (state) => {
              setIsListening(state.isCapturing);
            },
            onError: (error) => {
              console.error('Audio capture error:', error);
            }
          });
        }
        
        // Set the WebSocket for the audio capture service
        if (audioCaptureServiceRef.current && socketRef.current) {
          audioCaptureServiceRef.current.setWebSocket(socketRef.current);
        }
        
        // Send initial context about the simulation
        sendSimulationContext();
      };

      socketRef.current.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
        // Reset responding state if it was active when disconnected
        setIsResponding(false);
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Failed to connect. Please try again.');
        setIsConnecting(false);
      };

      socketRef.current.onmessage = handleWebSocketMessage;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  // Send the simulation context as a system message
  const sendSimulationContext = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.log('Cannot send simulation context - WebSocket not connected');
      return;
    }

    try {
      // Create a detailed context message about the simulation
      const contextMessage = {
        type: 'text',
        content: `The student is currently viewing the "${simulationTitle}" simulation. This simulation is about: ${simulationDescription}. The student may ask questions about how this simulation works, the underlying concepts, or related topics.`,
        is_system_message: true
      };
      
      console.log('Sending simulation context to Gemini');
      socketRef.current.send(JSON.stringify(contextMessage));
      
      // Add to messages for UI display with system role
      setMessages(prev => [
        ...prev, 
        { 
          role: 'system', 
          content: `[System: AI Tutor initialized for "${simulationTitle}"]`, 
          timestamp: new Date() 
        }
      ]);
    } catch (error) {
      console.error('Error sending simulation context:', error);
    }
  };

  // Send a system message to Gemini
  const sendSystemMessage = (content: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.log('Cannot send system message - WebSocket not connected');
      return;
    }

    try {
      const message = {
        type: 'text',
        content,
        is_system_message: true
      };
      
      socketRef.current.send(JSON.stringify(message));
      
      // Add to messages for UI display with system role
      setMessages(prev => [
        ...prev, 
        { 
          role: 'system', 
          content: `[System: ${content}]`, 
          timestamp: new Date() 
        }
      ]);
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  };

  /**
   * Process and play audio data from Gemini
   */
  const processAndPlayRawAudio = (base64Data: string, sampleRate: number = PLAYBACK_SAMPLE_RATE): void => {
    try {
      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }
      
      // Create playback audio context if it doesn't exist
      if (!playbackAudioContextRef.current) {
        try {
          playbackAudioContextRef.current = new AudioContext({
            sampleRate: sampleRate,
          });
        } catch (error) {
          console.error('Error creating audio context:', error);
          return;
        }
      }
      
      // Convert to Int16 PCM
      const int16View = new Int16Array(arrayBuffer);
      
      // Convert to Float32 for Web Audio API
      const numFrames = int16View.length;
      const floatData = new Float32Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        floatData[i] = int16View[i] / 32768.0;
      }
      
      // Create an audio buffer
      const audioBuffer = playbackAudioContextRef.current.createBuffer(
        1, // mono
        numFrames,
        sampleRate
      );
      
      // Copy the float data to the buffer
      audioBuffer.copyToChannel(floatData, 0);
      
      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      
      // Check if buffer queue has grown too large
      if (audioQueueRef.current.length > MAX_BUFFER_QUEUE) {
        consolidateBuffers();
      }
      
      // If not currently playing, start playback
      if (!isPlayingRef.current) {
        // Ensure the audio context is in a running state
        if (playbackAudioContextRef.current.state === 'suspended') {
          playbackAudioContextRef.current.resume().catch(error => {
            console.error('Error resuming audio context:', error);
          });
        }
        playNextAudioInQueue();
      }
    } catch (error) {
      console.error('Error processing raw audio data:', error);
    }
  };
  
  /**
   * Consolidate small audio buffers into larger ones for smoother playback
   */
  const consolidateBuffers = () => {
    if (!playbackAudioContextRef.current || audioQueueRef.current.length <= 1) {
      return;
    }
    
    // Calculate total length of all buffers in the queue
    let totalLength = 0;
    audioQueueRef.current.forEach(buffer => {
      totalLength += buffer.length;
    });
    
    // Create a new consolidated buffer
    const consolidatedBuffer = playbackAudioContextRef.current.createBuffer(
      1, // mono
      totalLength,
      playbackAudioContextRef.current.sampleRate
    );
    
    // Copy data from all buffers into the consolidated one
    const outputData = consolidatedBuffer.getChannelData(0);
    let offset = 0;
    
    audioQueueRef.current.forEach(buffer => {
      const bufferData = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        outputData[offset + i] = bufferData[i];
      }
      offset += buffer.length;
    });
    
    // Replace the queue with just the single consolidated buffer
    audioQueueRef.current = [consolidatedBuffer];
    console.log('Consolidated audio buffers for smoother playback');
  };
  
  /**
   * Play the next audio buffer with reliable timing
   */
  const playNextAudioInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
  
    isPlayingRef.current = true;
    
    // Get audio context
    if (!playbackAudioContextRef.current) {
      isPlayingRef.current = false;
      return;
    }
    
    // Get the buffer to play
    const audioBuffer = audioQueueRef.current.shift();
    if (!audioBuffer) {
      isPlayingRef.current = false;
      return;
    }
    
    // Create source
    const source = playbackAudioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackAudioContextRef.current.destination);
    
    // Calculate when to play this buffer
    const currentTime = playbackAudioContextRef.current.currentTime;
    const bufferDuration = audioBuffer.duration;
    
    // For very small buffers (< 50ms), play immediately
    // This prevents excessive scheduling overhead for tiny chunks
    let startTime;
    if (bufferDuration < 0.05) {
      startTime = Math.max(currentTime, lastScheduledTimeRef.current);
    } else {
      // For normal buffers, schedule with a gap
      startTime = Math.max(currentTime, lastScheduledTimeRef.current + BUFFER_GAP);
    }
    
    // Update the last scheduled time
    lastScheduledTimeRef.current = startTime + bufferDuration;
    
    // Store the source node
    audioSourceNodeRef.current = source;
    
    // Start the playback at the calculated time
    source.start(startTime);
    
    // Handle the buffer ending
    source.onended = () => {
      audioSourceNodeRef.current = null;
      
      // If we have more buffers, schedule the next one
      if (audioQueueRef.current.length > 0) {
        // Use a short timeout to give the browser time to process
        // between scheduling audio, which helps prevent audio glitches
        setTimeout(() => {
          playNextAudioInQueue();
        }, 10);
      } else {
        isPlayingRef.current = false;
      }
    };
  };

  // Handle messages from the Gemini API
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received message from server:', data.type);
      
      // Always reset the response timeout to prevent it from firing
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
      
      if (data.type === 'text' && data.content) {
        console.log('Received text message:', data.content.substring(0, 50));
        setMessages(prev => [...prev, { role: 'gemini', content: data.content, timestamp: new Date() }]);
        setIsResponding(false);
      }
      else if (data.type === 'audio' && data.data) {
        console.log('Received audio data of length:', data.data.length);
        // Process raw PCM audio instead of trying to decode it
        processAndPlayRawAudio(
          data.data, 
          data.sampleRate || PLAYBACK_SAMPLE_RATE
        );
        
        // Reset responding state after receiving audio too
        setIsResponding(false);
      }
      else if (data.type === 'error') {
        console.error('Error from server:', data.error, data.details);
        // Reset responding state on error
        setIsResponding(false);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      // Reset responding state on error
      setIsResponding(false);
    }
  };


  // Send text message to Gemini
  const sendTextMessage = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !inputText.trim()) {
      console.log('Cannot send message - websocket state:', socketRef.current?.readyState);
      return;
    }

    const message = {
      type: 'text',
      content: inputText.trim()
    };

    try {
      console.log('Sending text message:', message.content);
      socketRef.current.send(JSON.stringify(message));
      setMessages(prev => [...prev, { role: 'user', content: inputText.trim(), timestamp: new Date() }]);
      setInputText('');
      setIsResponding(true);
      
      // Set a response timeout to reset the responding state if no response is received
      responseTimeoutRef.current = setTimeout(() => {
        console.log('No response received within timeout period');
        setIsResponding(false);
      }, 10000); // 10 seconds timeout
    } catch (error) {
      console.error('Error sending text message:', error);
      setIsResponding(false);
    }
  };

  // Start/stop audio recording
  const toggleMicrophone = async () => {
    if (isListening) {
      stopAudioRecording();
    } else {
      await startAudioRecording();
    }
  };

  // Initialize audio recording using AudioCaptureService
  const startAudioRecording = async () => {
    console.log('Starting audio recording...');
    
    // Check if WebSocket is open
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot start audio recording: WebSocket is not connected');
      return;
    }
    
    try {
      // Start capturing audio
      if (audioCaptureServiceRef.current) {
        await audioCaptureServiceRef.current.startCapture();
        setIsResponding(true);
      }
    } catch (error) {
      console.error('Error starting audio recording:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access to use this feature.');
      } else {
        alert(`Failed to start audio recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Stop audio recording
  const stopAudioRecording = () => {
    console.log('Stopping audio recording...');
    
    // Stop the audio capture service
    if (audioCaptureServiceRef.current) {
      audioCaptureServiceRef.current.stopCapture();
    }
    
    // Send end of turn signal if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('Sending end of turn signal');
      try {
        socketRef.current.send(JSON.stringify({ 
          type: 'text', 
          content: '', 
          end_of_turn: true 
        }));
        
        // Set a response timeout
        responseTimeoutRef.current = setTimeout(() => {
          console.log('No response received after audio recording');
          setIsResponding(false);
        }, 10000); // 10 seconds timeout
      } catch (error) {
        console.error('Error sending end of turn signal:', error);
        setIsResponding(false);
      }
    }
    
    console.log('Audio recording stopped');
  };

  /**
   * Capture and optimize screen content for Gemini
   */
  const captureScreen = async (stream: MediaStream): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        // Create video element to capture the stream
        const video = document.createElement('video');
        
        // Set up video element
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          // Start playing to get current frame
          video.play();
          
          // Create canvas for frame capture
          const canvas = document.createElement('canvas');
          
          // Determine optimal dimensions
          // Limit max dimensions to avoid excessive token usage
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 720;
          
          let width = video.videoWidth;
          let height = video.videoHeight;
          
          // Scale down if necessary
          if (width > MAX_WIDTH) {
            const ratio = MAX_WIDTH / width;
            width = MAX_WIDTH;
            height = Math.floor(height * ratio);
          }
          
          if (height > MAX_HEIGHT) {
            const ratio = MAX_HEIGHT / height;
            height = MAX_HEIGHT;
            width = Math.floor(width * ratio);
          }
          
          // Set canvas dimensions
          canvas.width = width;
          canvas.height = height;
          
          // Draw the video frame to canvas
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, width, height);
          
          // Convert to JPEG and optimize quality
          // Lower quality (0.7) for bandwidth efficiency while maintaining readability
          const imageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
          
          // Stop video playback to release resources
          video.pause();
          video.srcObject = null;
          
          resolve(imageData);
        };
        
        video.onerror = (e) => {
          reject(new Error(`Video error: ${e}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  };

  // Toggle screen sharing
  const toggleScreenSharing = async () => {
    if (isScreenSharing) {
      stopScreenSharing();
    } else {
      await startScreenSharing();
    }
  };

  // Start screen sharing
  const startScreenSharing = async () => {
    // Check if WebSocket is open
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot start screen sharing: WebSocket is not connected');
      return;
    }
    
    try {
      console.log('Requesting screen sharing permission...');
      // Request screen capture permission with specific options for better quality
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          logicalSurface: true,
          frameRate: 5,
        }
      });
      console.log('Screen sharing permission granted');
      
      // Save reference to stream for cleanup
      screenStreamRef.current = stream;
      
      // Handle if user stops sharing through browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen sharing stopped by browser UI');
        stopScreenSharing();
      });
      
      // Set up interval to capture screen and send to Gemini (every 2 seconds)
      screenCaptureIntervalRef.current = setInterval(async () => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          console.log('WebSocket not open, skipping screen capture');
          return;
        }
        
        try {
          // Capture and optimize screen content
          const imageData = await captureScreen(stream);
          
          // Send to server
          const screenMessage = {
            type: 'screen',
            data: imageData
          };
          
          socketRef.current.send(JSON.stringify(screenMessage));
          console.log('Screen capture sent to server');
        } catch (error) {
          console.error('Error capturing screen:', error);
        }
      }, 2000);
      
      setIsScreenSharing(true);
      console.log('Screen sharing started successfully');
    } catch (error) {
      // Handle case where user cancels the screen sharing dialog
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        console.log('Screen sharing permission denied by user');
      } else {
        console.error('Error starting screen sharing:', error);
        alert(`Failed to start screen sharing: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Stop screen sharing
  const stopScreenSharing = () => {
    console.log('Stopping screen sharing...');
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (screenCaptureIntervalRef.current) {
      clearInterval(screenCaptureIntervalRef.current);
      screenCaptureIntervalRef.current = null;
    }
    
    setIsScreenSharing(false);
    console.log('Screen sharing stopped');
  };

  // End conversation
  const endConversation = () => {
    console.log('Ending conversation...');
    
    // Send end conversation message if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ type: 'end_conversation' }));
        socketRef.current.close();
      } catch (error) {
        console.error('Error ending conversation:', error);
      }
    }
    
    // Clean up resources
    stopAudioRecording();
    stopScreenSharing();
    
    // Clean up the audio capture service
    if (audioCaptureServiceRef.current) {
      audioCaptureServiceRef.current.destroy();
      audioCaptureServiceRef.current = null;
    }
    
    setIsConnected(false);
    setMessages([]);
    setIsResponding(false);
    
    console.log('Conversation ended');
  };

  // Scroll to bottom of messages
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Connect on component mount
  useEffect(() => {
    if (isExpanded) {
      console.log('Component mounted and expanded, connecting to WebSocket...');
      connectWebSocket();
    }
    
    // Clean up on unmount
    return () => {
      console.log('Component unmounting, cleaning up resources...');
      
      // Clear response timeout if active
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (audioCaptureServiceRef.current) {
        audioCaptureServiceRef.current.destroy();
      }
      
      stopScreenSharing();
      
      if (playbackAudioContextRef.current) {
        playbackAudioContextRef.current.close().catch(err => {
          console.error('Error closing playback audio context:', err);
        });
      }
    };
  }, [isExpanded, apiUrl, subject, skill, subskill]);

  // Handle key presses for sending messages
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  // Toggle expanded/collapsed state
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    
    // Connect if expanding and not already connected
    if (newState && !isConnected && !isConnecting) {
      connectWebSocket();
    }
  };

  // Format timestamp for message
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // If minimized, show only a button to expand
  if (!isExpanded) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Button 
          onClick={toggleExpanded}
          variant="default"
          className="rounded-full h-14 w-14 bg-blue-600 hover:bg-blue-700 shadow-lg"
        >
          <span className="sr-only">Open AI Tutor</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col rounded-lg border shadow-sm bg-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3 bg-muted/50">
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
          <h3 className="font-medium text-lg">
            AI Tutor - {simulationTitle}
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {/* Status indicators */}
          {isListening && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1 animate-pulse"></span>
              Recording
            </span>
          )}
          {isScreenSharing && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1 animate-pulse"></span>
              Sharing Screen
            </span>
          )}
          
          {/* Controls */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={toggleExpanded}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"></path>
                    <path d="M3 9h18"></path>
                  </svg>
                  <span className="sr-only">Minimize</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Minimize</p>
              </TooltipContent>
            </Tooltip>

            {onClose && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-gray-500 hover:text-gray-900"
                    onClick={onClose}
                  >
                    <X size={16} />
                    <span className="sr-only">Close</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>

      {/* Error Messages */}
      {connectionError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">
          <div className="flex">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p>{connectionError}</p>
          </div>
        </div>
      )}

      {/* Message Area */}
      <ScrollArea className="flex-1 p-4 h-64">
        {messages.length === 0 && !isResponding && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <p className="text-lg font-medium mb-1">Ask the AI Tutor about this simulation</p>
            <p className="text-sm max-w-md">
              Get personalized explanations about {subject} concepts, how to use the simulation, or related scientific principles.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
<Card className={`max-w-[85%] ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : msg.role === 'system'
                    ? 'bg-muted/50 text-muted-foreground text-sm'
                    : 'bg-muted'
              }`}>
                <CardContent className="p-3">
                  <div className="flex flex-col">
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}

          {isResponding && (
            <div className="flex justify-start">
              <Card className="bg-muted">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    <span className="ml-2 text-sm">AI is thinking...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-3">
        {/* Auto-scroll toggle and connection controls */}
        <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={setAutoScroll}
              size="sm"
            />
            <Label htmlFor="auto-scroll" className="text-xs cursor-pointer">Auto-scroll</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isConnected && !isConnecting && (
              <Button 
                onClick={connectWebSocket} 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 text-xs"
                disabled={isConnecting}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reconnect
              </Button>
            )}
          </div>
        </div>
        
        {/* Controls and input field */}
        <div className="flex items-end space-x-2">
          <div className="flex flex-col space-y-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={toggleMicrophone}
                    disabled={!isConnected}
                    variant={isListening ? "destructive" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    <span className="sr-only">{isListening ? 'Stop recording' : 'Start recording'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{isListening ? 'Stop recording' : 'Start recording'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={toggleScreenSharing}
                    disabled={!isConnected}
                    variant={isScreenSharing ? "destructive" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                  >
                    {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                    <span className="sr-only">{isScreenSharing ? 'Stop sharing' : 'Share screen'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex-1 relative">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isConnected ? "Ask about this simulation..." : "Connect to start chatting..."}
              className="min-h-[60px] resize-none pr-10"
              disabled={!isConnected || isResponding}
            />
            <Button
              onClick={sendTextMessage}
              disabled={!isConnected || !inputText.trim() || isResponding}
              size="icon"
              variant="ghost"
              className="absolute right-1 bottom-1 h-8 w-8"
            >
              <SendHorizontal className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedGeminiTutor;