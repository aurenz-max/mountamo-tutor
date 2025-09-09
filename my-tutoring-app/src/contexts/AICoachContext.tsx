'use client';

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import AudioCaptureService from '@/lib/AudioCaptureService';
import { authApi } from '@/lib/authApiClient';

type EndpointType = 'daily-planning' | 'practice-tutor';

interface AICoachConnection {
  socket: WebSocket | null;
  audioService: AudioCaptureService | null;
  isConnected: boolean;
  studentId: number | null;
  lastContext: any;
  endpointType: EndpointType;
}

interface AICoachContextType {
  connection: AICoachConnection;
  connectToAI: (studentId: number, getAuthToken: () => Promise<string | null>, endpointType?: EndpointType, endpointContext?: any) => Promise<void>;
  disconnectFromAI: () => void;
  sendMessage: (message: any) => void;
  isAIConnected: boolean;
  setContext: (context: any) => void;
  switchEndpoint: (endpointType: EndpointType, studentId: number, getAuthToken: () => Promise<string | null>, endpointContext?: any) => Promise<void>;
}

const AICoachContext = createContext<AICoachContextType | null>(null);

export const AICoachProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<WebSocket | null>(null);
  const audioServiceRef = useRef<AudioCaptureService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [lastContext, setLastContext] = useState<any>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<EndpointType>('daily-planning');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef(false);

  // Auto-reconnect function
  const attemptReconnect = useCallback(async (endpointType: EndpointType, studentId: number, getAuthToken: () => Promise<string | null>) => {
    if (isReconnectingRef.current) return;
    
    isReconnectingRef.current = true;
    console.log(`Attempting to reconnect AI Coach to ${endpointType}...`);
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await connectToAI(studentId, getAuthToken, endpointType);
      
      // Restore last context if available
      if (lastContext && socketRef.current?.readyState === WebSocket.OPEN) {
        console.log(`Restoring AI Coach context after reconnect for ${endpointType}`);
        sendMessage({
          type: 'context',
          context_type: lastContext.type,
          data: {
            ...lastContext,
            student_id: studentId
          }
        });
      }
    } catch (error) {
      console.error(`Failed to reconnect AI Coach to ${endpointType}:`, error);
    } finally {
      isReconnectingRef.current = false;
    }
  }, [lastContext]);

  const connectToAI = useCallback(async (studentId: number, getAuthToken: () => Promise<string | null>, endpointType: EndpointType = 'daily-planning', endpointContext?: any) => {
    // If already connected to the same endpoint and student, don't reconnect
    if (socketRef.current?.readyState === WebSocket.OPEN && 
        studentId === studentId && 
        currentEndpoint === endpointType) {
      console.log(`AI Coach already connected to ${endpointType} for student ${studentId}`);
      return;
    }

    // Clean up existing connection
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (audioServiceRef.current) {
      audioServiceRef.current.destroy();
      audioServiceRef.current = null;
    }

    try {
      // Initialize audio service for all endpoints that need audio
      audioServiceRef.current = new AudioCaptureService();
      audioServiceRef.current.setCallbacks({
        onStateChange: (state) => {},
        onError: (error) => console.error('Audio capture error:', error)
      });

      let socket: WebSocket;
      
      if (endpointType === 'practice-tutor') {
        // Use direct WebSocket connection like daily planning (FIXED)
        const wsUrl = `ws://localhost:8000/api/practice-tutor`;
        console.log(`AI Coach connecting to practice tutor: ${wsUrl}`);
        
        socket = new WebSocket(wsUrl);
      } else {
        // Daily planning connection
        const wsUrl = `ws://localhost:8000/api/daily-briefing?student_id=${studentId}`;
        console.log(`AI Coach connecting to ${wsUrl}`);
        
        socket = new WebSocket(wsUrl);
      }

      socketRef.current = socket;

      socket.onopen = async () => {
        console.log(`AI Coach WebSocket connection established for ${endpointType}`);
        setIsConnected(true);
        setStudentId(studentId);
        setCurrentEndpoint(endpointType);
        
        // Set up audio service connection for all endpoints
        if (audioServiceRef.current) {
          audioServiceRef.current.setWebSocket(socket);
        }

        // Send authentication for both endpoints
        try {
          const token = await getAuthToken();
          if (!token) throw new Error('No authentication token available');
          
          if (endpointType === 'daily-planning') {
            socket.send(JSON.stringify({
              type: 'authenticate',
              token: token
            }));
          } else if (endpointType === 'practice-tutor') {
            socket.send(JSON.stringify({
              type: 'authenticate',
              token: token,
              topic_context: endpointContext || {
                subject: 'mathematics',
                skill_id: '',
                subskill_id: ''
              }
            }));
          }
        } catch (error) {
          console.error('Error getting auth token for WebSocket:', error);
          setIsConnected(false);
        }
      };

      socket.onclose = (event) => {
        console.log(`AI Coach WebSocket connection closed for ${endpointType}: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        
        // Only attempt reconnection if it wasn't a manual close
        if (event.code !== 1000 && studentId && !isReconnectingRef.current) {
          console.log(`Connection lost for ${endpointType}, scheduling reconnect...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            attemptReconnect(endpointType, studentId, getAuthToken);
          }, 3000);
        }
      };

      socket.onerror = (error) => {
        console.error(`AI Coach WebSocket error for ${endpointType}:`, error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error(`Error connecting to AI Coach ${endpointType}:`, error);
      setIsConnected(false);
    }
  }, [attemptReconnect, currentEndpoint]);

  const disconnectFromAI = useCallback(() => {
    // Clear reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    isReconnectingRef.current = false;
    
    if (socketRef.current) {
      socketRef.current.close(1000, 'Manual disconnect');
      socketRef.current = null;
    }
    
    if (audioServiceRef.current) {
      audioServiceRef.current.destroy();
      audioServiceRef.current = null;
    }
    
    setIsConnected(false);
    setStudentId(null);
    setLastContext(null);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Attempted to send message but WebSocket is not connected');
    }
  }, []);

  const setContext = useCallback((context: any) => {
    setLastContext(context);
    
    // Send context immediately if connected
    if (socketRef.current?.readyState === WebSocket.OPEN && studentId) {
      sendMessage({
        type: 'context',
        context_type: context.type,
        data: {
          ...context,
          student_id: studentId
        }
      });
    }
  }, [sendMessage, studentId]);

  // Switch endpoint method
  const switchEndpoint = useCallback(async (endpointType: EndpointType, studentId: number, getAuthToken: () => Promise<string | null>, endpointContext?: any) => {
    console.log(`Switching AI Coach to ${endpointType}`);
    
    // Connect to the new endpoint (will automatically disconnect from current)
    await connectToAI(studentId, getAuthToken, endpointType, endpointContext);
  }, [connectToAI]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (audioServiceRef.current) {
        audioServiceRef.current.destroy();
      }
    };
  }, []);

  const value: AICoachContextType = {
    connection: {
      socket: socketRef.current,
      audioService: audioServiceRef.current,
      isConnected,
      studentId,
      lastContext,
      endpointType: currentEndpoint
    },
    connectToAI,
    disconnectFromAI,
    sendMessage,
    isAIConnected: isConnected,
    setContext,
    switchEndpoint
  };

  return (
    <AICoachContext.Provider value={value}>
      {children}
    </AICoachContext.Provider>
  );
};

export const useAICoach = () => {
  const context = useContext(AICoachContext);
  if (!context) {
    throw new Error('useAICoach must be used within an AICoachProvider');
  }
  return context;
};