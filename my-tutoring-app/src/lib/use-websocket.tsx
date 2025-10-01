'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'
import { CaptureClient } from '@/lib/capture'
import AudioCaptureService from '@/lib/AudioCaptureService'

interface Message {
  text?: string;
  audio?: string;
  error?: string;
  status?: string;
  size?: number;
  transcription?: string;
}

interface WebSocketContextType {
  sendMessage: (message: string) => void;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  startAudioCapture: () => Promise<void>;
  stopAudioCapture: () => void;
  isCapturing: boolean;
  isAudioCapturing: boolean;
  readyState: number;
  lastMessage: Message | null;
  messages: Message[];
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

// Close codes that indicate we should not reconnect
const NO_RECONNECT_CODES = new Set([
  1000, // Normal closure
  1008, // Policy violation
  1011  // Server error
])

const CONNECTION_TIMEOUT = 5000 // 5 seconds
const RECONNECT_DELAY = 3000   // 3 seconds

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING)
  const [lastMessage, setLastMessage] = useState<Message | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [isAudioCapturing, setIsAudioCapturing] = useState(false)
  
  const ws = useRef<WebSocket | null>(null)
  const captureClient = useRef<CaptureClient | null>(null)
  const audioCapture = useRef<AudioCaptureService | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const connectionTimeoutRef = useRef<NodeJS.Timeout>()
  const shouldReconnect = useRef<boolean>(true)

  const cleanupResources = () => {
    console.log('Cleaning up WebSocket resources...')
    
    // Clear all timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
      connectionTimeoutRef.current = undefined
    }

    // Clean up capture clients
    if (captureClient.current) {
      console.log('Stopping and cleaning up screen capture')
      captureClient.current.stopCapture()
      captureClient.current = null
      setIsCapturing(false)
    }

    if (audioCapture.current) {
      console.log('Stopping and cleaning up audio capture')
      audioCapture.current.destroy()
      audioCapture.current = null
      setIsAudioCapturing(false)
    }

    // Close WebSocket if it exists
    if (ws.current) {
      if (ws.current.readyState === WebSocket.OPEN) {
        console.log('Closing open WebSocket connection')
        ws.current.close()
      }
      ws.current = null
    }
  }

  const connect = () => {
    console.log('Attempting WebSocket connection...')

    // Prevent multiple concurrent connection attempts
    if (ws.current?.readyState === WebSocket.CONNECTING) {
      console.log('Connection already in progress')
      return
    }
    // Clear any existing timeouts before attempting new connection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }

    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected')
      return
    }

    // Clean up any existing connection first
    cleanupResources();

    // Reset reconnection flag
    shouldReconnect.current = true

      try {
    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    ws.current = new WebSocket(`${wsBaseUrl}/api/gemini/chat`);
    
    ws.current.onopen = () => {
      console.log('WebSocket connection established');
      setReadyState(WebSocket.OPEN);
      
      // Send initial configuration immediately after connection
      const config = {
        setup: {
          response_modalities: ["AUDIO"],
          voice_config: {
            voice_name: "Puck"
          }
        }
      };
      
      try {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify(config));
          console.log('Initial configuration sent');
        }
      } catch (error) {
        console.error('Failed to send initial configuration:', error);
      }
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code);
      setReadyState(WebSocket.CLOSED);
      
      if (NO_RECONNECT_CODES.has(event.code)) {
        console.log('Server indicated no reconnection');
        shouldReconnect.current = false;
      } else if (shouldReconnect.current) {
        console.log('Scheduling reconnection');
        reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

  } catch (error) {
    console.error('Failed to establish WebSocket connection:', error);
    if (shouldReconnect.current) {
      reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
    }
  }
};

  const sendMessage = (content: string) => {
    console.log('Attempting to send message')
    
    if (!ws.current) {
      console.error('No WebSocket instance available')
      return
    }

    if (ws.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message - WebSocket not open. Current state:', ws.current.readyState)
      return
    }

    try {
      const isJson = typeof content === 'string' && content.trim().startsWith('{')
      
      if (isJson && content.includes('"setup"')) {
        ws.current.send(content)
        console.log('Setup message sent successfully')
        return
      }

      const message = {
        realtime_input: {
          media_chunks: [{
            mime_type: 'text/plain',
            data: content
          }]
        }
      }

      const messageStr = JSON.stringify(message)
      ws.current.send(messageStr)
      console.log('Message sent successfully')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const startCapture = async () => {
    console.log('Starting screen capture...')
    
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected. State:', ws.current?.readyState)
      throw new Error('WebSocket not connected')
    }

    try {
      if (!captureClient.current) {
        console.log('Creating new capture client')
        captureClient.current = new CaptureClient({
          frameRate: 1,
          videoQuality: 0.7,
          audioBitsPerSecond: 32000
        })
      }

      captureClient.current.setWebSocket(ws.current)
      await captureClient.current.startCapture()
      setIsCapturing(true)
      console.log('Screen capture started successfully')
    } catch (err) {
      console.error('Failed to start screen capture:', err)
      throw err
    }
  }

  const stopCapture = () => {
    console.log('Stopping screen capture...')
    if (captureClient.current) {
      captureClient.current.stopCapture()
      setIsCapturing(false)
      console.log('Screen capture stopped')
    }
  }

  const startAudioCapture = async () => {
    console.log('Starting audio capture...')
    
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected. State:', ws.current?.readyState)
      throw new Error('WebSocket not connected')
    }

    try {
      if (!audioCapture.current) {
        console.log('Creating new audio capture service')
        audioCapture.current = new AudioCaptureService({
          targetSampleRate: 24000,
          channelCount: 1,
          bitsPerSecond: 32000,
          segmentDuration: 1000
        })
      }

      audioCapture.current.setWebSocket(ws.current)
      audioCapture.current.setCallbacks({
        onStateChange: ({ isCapturing }) => {
          console.log('Audio capture state changed:', isCapturing)
          setIsAudioCapturing(isCapturing)
        },
        onError: (error) => console.error('Audio capture error:', error)
      })

      await audioCapture.current.startCapture()
      console.log('Audio capture started successfully')
    } catch (err) {
      console.error('Failed to start audio capture:', err)
      throw err
    }
  }

  const stopAudioCapture = () => {
    console.log('Stopping audio capture...')
    if (audioCapture.current) {
      audioCapture.current.stopCapture()
      setIsAudioCapturing(false)
      console.log('Audio capture stopped')
    }
  }

  useEffect(() => {
    console.log('WebSocketProvider mounted')
    connect()

    return () => {
      console.log('WebSocketProvider unmounting')
      shouldReconnect.current = false
      cleanupResources()
    }
  }, [])

  return (
    <WebSocketContext.Provider 
      value={{
        sendMessage,
        startCapture,
        stopCapture,
        startAudioCapture,
        stopAudioCapture,
        isCapturing,
        isAudioCapturing,
        readyState,
        lastMessage,
        messages
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}