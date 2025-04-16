'use client';

// components/GeminiLiveConnect.tsx
import React, { useState, useRef, useEffect } from 'react';
import AudioCaptureService from '@/lib/AudioCaptureService';

// Types for our component and API interactions
type MessageType = 'text' | 'audio' | 'screen' | 'end_conversation';

interface Message {
  type: MessageType;
  content?: string;
  data?: string;
  mime_type?: string;
}

interface GeminiLiveConnectProps {
  apiUrl?: string; // Default to localhost if not provided
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

const GeminiLiveConnect: React.FC<GeminiLiveConnectProps> = ({
  apiUrl = 'ws://localhost:8000/api/gemini/bidirectional', // Default endpoint
  onConnect,
  onDisconnect,
  onError,
}) => {
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'gemini', content: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Refs for our WebSocket, audio context, and media elements
  const socketRef = useRef<WebSocket | null>(null);
  const audioCaptureServiceRef = useRef<AudioCaptureService | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isPlayingRef = useRef(false);
  const screenCaptureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio constants
  const PLAYBACK_SAMPLE_RATE = 24000; // Gemini outputs 24kHz audio

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
    console.log(`Attempting to connect to WebSocket at ${apiUrl}`);

    try {
      socketRef.current = new WebSocket(apiUrl);

      socketRef.current.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setIsConnecting(false);
        onConnect?.();
        
        // Initialize the audio capture service when websocket is connected
        if (!audioCaptureServiceRef.current) {
          audioCaptureServiceRef.current = new AudioCaptureService();
          audioCaptureServiceRef.current.setCallbacks({
            onStateChange: (state) => {
              setIsListening(state.isCapturing);
            },
            onError: (error) => {
              console.error('Audio capture error:', error);
              if (onError) {
                onError(error);
              }
            }
          });
        }
        
        // Set the WebSocket for the audio capture service
        if (audioCaptureServiceRef.current && socketRef.current) {
          audioCaptureServiceRef.current.setWebSocket(socketRef.current);
        }
      };

      socketRef.current.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
        // Reset responding state if it was active when disconnected
        setIsResponding(false);
        onDisconnect?.();
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Failed to connect. Please try again.');
        setIsConnecting(false);
        onError?.(error);
      };

      socketRef.current.onmessage = handleWebSocketMessage;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnecting(false);
      onError?.(error);
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
      
      // Create an audio buffer
      const numFrames = arrayBuffer.byteLength / 2; // 16-bit = 2 bytes per sample
      const audioBuffer = playbackAudioContextRef.current.createBuffer(
        1, // mono
        numFrames,
        sampleRate
      );
      
      // Fill the audio buffer with PCM data
      const channelData = audioBuffer.getChannelData(0);
      const int16View = new Int16Array(arrayBuffer);
      
      // Convert Int16 PCM to Float32 (WebAudio format)
      for (let i = 0; i < numFrames; i++) {
        // Convert from INT16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
        channelData[i] = int16View[i] / 32768.0;
      }
      
      // Add to queue and play
      audioQueueRef.current.push(audioBuffer);
      if (!isPlayingRef.current) {
        playNextAudioInQueue();
      }
    } catch (error) {
      console.error('Error processing raw audio data:', error);
      onError?.(error);
    }
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
        setMessages(prev => [...prev, { role: 'gemini', content: data.content }]);
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
        onError?.(data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      // Reset responding state on error
      setIsResponding(false);
    }
  };

  // Play the next audio buffer in the queue
  const playNextAudioInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift();
    
    if (!playbackAudioContextRef.current || !audioBuffer) {
      isPlayingRef.current = false;
      return;
    }

    // Ensure the audio context is resumed (needed due to autoplay policies)
    if (playbackAudioContextRef.current.state === 'suspended') {
      playbackAudioContextRef.current.resume().catch(error => {
        console.error('Error resuming audio context:', error);
      });
    }

    const source = playbackAudioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackAudioContextRef.current.destination);
    audioSourceNodeRef.current = source;
    
    source.onended = () => {
      audioSourceNodeRef.current = null;
      playNextAudioInQueue();
    };
    
    source.start(0);
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
      setMessages(prev => [...prev, { role: 'user', content: inputText.trim() }]);
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
      onError?.(error);
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
          displaySurface: 'monitor', // prefer full screen over application window
          logicalSurface: true,
          frameRate: 5, // Lower framerate is sufficient for Gemini
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
        onError?.(error);
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

  // Connect on component mount
  useEffect(() => {
    console.log('Component mounted, connecting to WebSocket...');
    connectWebSocket();
    
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
  }, [apiUrl]);

  // Handle key presses for sending messages
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 bg-gray-100 flex items-center justify-between">
        <div className="flex items-center">
          {isConnecting ? (
            <div className="flex items-center">
              <div className="animate-pulse w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
              <span className="text-sm font-medium">Connecting...</span>
            </div>
          ) : isConnected ? (
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span className="text-sm font-medium">Connected to Gemini</span>
            </div>
          ) : (
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
              <span className="text-sm font-medium">Disconnected</span>
            </div>
          )}
        </div>
        <div className="flex space-x-1">
          {isListening && (
            <div className="flex items-center">
              <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full mr-1"></div>
              <span className="text-xs text-red-500">Recording</span>
            </div>
          )}
          {isScreenSharing && (
            <div className="flex items-center ml-2">
              <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
              <span className="text-xs text-blue-500">Sharing Screen</span>
            </div>
          )}
        </div>
      </div>
      
      {connectionError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 text-sm">
          {connectionError}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isResponding && (
          <div className="text-center text-gray-500 my-8">
            {isConnected ? 
              "Start a conversation with Gemini..." : 
              "Connect to start chatting with Gemini..."}
          </div>
        )}
        
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`p-3 rounded-lg ${
              message.role === 'user' 
                ? 'bg-blue-100 ml-12' 
                : 'bg-gray-100 mr-12'
            }`}
          >
            <p>{message.content}</p>
          </div>
        ))}
        
        {isResponding && (
          <div className="bg-gray-100 p-3 rounded-lg mr-12 flex items-center">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="ml-2">Gemini is thinking...</p>
          </div>
        )}
      </div>
      
      <div className="border-t p-4">
        <div className="flex items-center space-x-2 mb-2">
          <button
            onClick={toggleMicrophone}
            disabled={!isConnected}
            className={`p-2 rounded-full ${
              !isConnected 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : isListening 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
            }`}
            title={isListening ? 'Stop recording' : 'Start recording'}
          >
            {isListening ? '🎙️ Stop' : '🎙️ Start'}
          </button>
          
          <button
            onClick={toggleScreenSharing}
            disabled={!isConnected}
            className={`p-2 rounded-full ${
              !isConnected 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : isScreenSharing 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
            }`}
            title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
          >
            {isScreenSharing ? '📺 Stop' : '📺 Share'}
          </button>
          
          <button
            onClick={endConversation}
            disabled={!isConnected}
            className={`p-2 rounded-full ${
              !isConnected 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
            title="End conversation"
          >
            ⏹️ End
          </button>
          
          {!isConnected && !isConnecting && (
            <button
              onClick={connectWebSocket}
              className="p-2 rounded-full bg-green-500 text-white"
              title="Reconnect"
              disabled={isConnecting}
            >
              🔄 Reconnect
            </button>
          )}
        </div>
        
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type your message..." : "Connect to start chatting..."}
            className="flex-1 p-2 border rounded-lg"
            disabled={!isConnected || isResponding}
          />
          
          <button
            onClick={sendTextMessage}
            className={`p-2 rounded-lg ${
              !isConnected || !inputText.trim() || isResponding
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
            disabled={!isConnected || !inputText.trim() || isResponding}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeminiLiveConnect;