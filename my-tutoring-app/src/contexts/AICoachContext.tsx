'use client';

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import AudioCaptureService from '@/lib/AudioCaptureService';

interface AICoachConnection {
  socket: WebSocket | null;
  audioService: AudioCaptureService | null;
  isConnected: boolean;
  studentId: number | null;
  lastContext: any; // Store the last context sent
}

interface AICoachContextType {
  connection: AICoachConnection;
  connectToAI: (studentId: number, getAuthToken: () => Promise<string | null>) => Promise<void>;
  disconnectFromAI: () => void;
  sendMessage: (message: any) => void;
  isAIConnected: boolean;
  setContext: (context: any) => void; // Method to update context
}

const AICoachContext = createContext<AICoachContextType | null>(null);

export const AICoachProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<WebSocket | null>(null);
  const audioServiceRef = useRef<AudioCaptureService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [lastContext, setLastContext] = useState<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef(false);

  // Auto-reconnect function
  const attemptReconnect = useCallback(async (studentId: number, getAuthToken: () => Promise<string | null>) => {
    if (isReconnectingRef.current) return;
    
    isReconnectingRef.current = true;
    console.log('Attempting to reconnect AI Coach...');
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await connectToAI(studentId, getAuthToken);
      
      // Restore last context if available
      if (lastContext && socketRef.current?.readyState === WebSocket.OPEN) {
        console.log('Restoring AI Coach context after reconnect');
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
      console.error('Failed to reconnect AI Coach:', error);
    } finally {
      isReconnectingRef.current = false;
    }
  }, []);

  const connectToAI = useCallback(async (studentId: number, getAuthToken: () => Promise<string | null>) => {
    // If already connected to the same student, don't reconnect
    if (socketRef.current?.readyState === WebSocket.OPEN && studentId === studentId) {
      console.log('AI Coach already connected to this student');
      return;
    }

    // Clean up existing connection
    if (socketRef.current) {
      socketRef.current.close();
    }

    try {
      const wsUrl = `ws://localhost:8000/api/daily-briefing?student_id=${studentId}`;
      console.log(`AI Coach connecting to WebSocket at ${wsUrl}`);
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = async () => {
        console.log('AI Coach WebSocket connection established globally');
        setIsConnected(true);
        setStudentId(studentId);
        
        // Initialize audio service
        if (!audioServiceRef.current) {
          audioServiceRef.current = new AudioCaptureService();
          audioServiceRef.current.setCallbacks({
            onStateChange: (state) => {},
            onError: (error) => console.error('Audio capture error:', error)
          });
        }
        
        if (audioServiceRef.current && socketRef.current) {
          audioServiceRef.current.setWebSocket(socketRef.current);
        }

        // Send authentication
        try {
          const token = await getAuthToken();
          if (!token) throw new Error('No authentication token available');
          
          socketRef.current!.send(JSON.stringify({
            type: 'authenticate',
            token: token
          }));
        } catch (error) {
          console.error('Error getting auth token for WebSocket:', error);
          setIsConnected(false);
        }
      };

      socketRef.current.onclose = (event) => {
        console.log(`AI Coach WebSocket connection closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        
        // Only attempt reconnection if it wasn't a manual close and we have student info
        if (event.code !== 1000 && studentId && !isReconnectingRef.current) {
          console.log('Connection lost, scheduling reconnect...');
          reconnectTimeoutRef.current = setTimeout(() => {
            attemptReconnect(studentId, getAuthToken);
          }, 3000);
        }
      };

      socketRef.current.onerror = (error) => {
        console.error('AI Coach WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Error connecting to AI Coach globally:', error);
      setIsConnected(false);
    }
  }, [attemptReconnect]);

  const disconnectFromAI = useCallback(() => {
    // Clear reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    isReconnectingRef.current = false;
    
    if (socketRef.current) {
      socketRef.current.close(1000, 'Manual disconnect'); // Normal closure
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
      lastContext
    },
    connectToAI,
    disconnectFromAI,
    sendMessage,
    isAIConnected: isConnected,
    setContext
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