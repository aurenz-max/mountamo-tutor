// hooks/useWebSocketConnection.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export type MessageRole = 'user' | 'gemini' | 'system';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

interface WebSocketMessage {
  type: 'text' | 'audio' | 'screen' | 'error' | 'end_conversation';
  content?: string;
  data?: string;
  sampleRate?: number;
  error?: string;
  details?: string;
  is_system_message?: boolean;
  end_of_turn?: boolean;
}

interface UseWebSocketProps {
  apiUrl: string;
  initialCurriculum: {
    subject: string;
    skill?: { id: string; };
    subskill?: { id: string; };
  };
  ageGroup: string;
  onMessageReceived?: (message: Message) => void;
  onAudioReceived?: (audioData: string, sampleRate: number) => void;
  onError?: (error: string) => void;
}

export const useWebSocketConnection = ({
  apiUrl,
  initialCurriculum,
  ageGroup,
  onMessageReceived,
  onAudioReceived,
  onError,
}: UseWebSocketProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearResponseTimeout = useCallback(() => {
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.log('Cannot send message - websocket state:', socketRef.current?.readyState);
      return false;
    }

    try {
      socketRef.current.send(JSON.stringify(message));
      setIsResponding(true);
      
      // Set response timeout
      responseTimeoutRef.current = setTimeout(() => {
        console.log('No response received within timeout period');
        setIsResponding(false);
      }, 10000);
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      setIsResponding(false);
      return false;
    }
  }, []);

  const sendTextMessage = useCallback((content: string) => {
    const message: WebSocketMessage = {
      type: 'text',
      content: content.trim()
    };
    
    if (sendMessage(message)) {
      onMessageReceived?.({ 
        role: 'user', 
        content: content.trim(), 
        timestamp: new Date() 
      });
    }
  }, [sendMessage, onMessageReceived]);

  const sendScreenData = useCallback((imageData: string) => {
    return sendMessage({
      type: 'screen',
      data: imageData
    });
  }, [sendMessage]);

  const sendEndOfTurn = useCallback(() => {
    return sendMessage({
      type: 'text',
      content: '',
      end_of_turn: true
    });
  }, [sendMessage]);

  const sendEndConversation = useCallback(() => {
    return sendMessage({
      type: 'end_conversation'
    });
  }, [sendMessage]);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data: WebSocketMessage = JSON.parse(event.data);
      console.log('Received message from server:', data);
      
      clearResponseTimeout();
      
      if (data.type === 'text' && data.content) {
        onMessageReceived?.({ 
          role: 'gemini', 
          content: data.content, 
          timestamp: new Date() 
        });
        setIsResponding(false);
      } else if (data.type === 'audio' && data.data) {
        onAudioReceived?.(data.data, data.sampleRate || 24000);
        setIsResponding(false);
      } else if (data.type === 'error') {
        console.error('Error from server:', data.error, data.details);
        setConnectionError(`Server error: ${data.error}`);
        onError?.(data.error || 'Unknown error');
        setIsResponding(false);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      setIsResponding(false);
    }
  }, [clearResponseTimeout, onMessageReceived, onAudioReceived, onError]);

  const sendInitialContext = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    let contextMessage = `Start a tutoring session for a ${ageGroup} year old student on ${initialCurriculum.subject}.`;
    
    if (initialCurriculum.subskill) {
      contextMessage += ` Focus on: ${initialCurriculum.subskill.id}`;
    } else if (initialCurriculum.skill) {
      contextMessage += ` Focus on: ${initialCurriculum.skill.id}`;
    }
    
    contextMessage += ` Please provide age-appropriate explanations and examples. Start by greeting the student and asking what they'd like to learn about this topic.`;
    
    sendMessage({
      type: 'text',
      content: contextMessage,
      is_system_message: true
    });
    
    // Add system message to UI
    onMessageReceived?.({ 
      role: 'system', 
      content: `[Tutoring session started: ${initialCurriculum.subject}]`, 
      timestamp: new Date() 
    });
  }, [ageGroup, initialCurriculum, sendMessage, onMessageReceived]);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      setIsConnecting(false);
      return;
    }

    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Build WebSocket URL
      const wsParams = new URLSearchParams();
      wsParams.append('subject', initialCurriculum.subject);
      if (initialCurriculum.skill) {
        wsParams.append('skill', initialCurriculum.skill.id);
      }
      if (initialCurriculum.subskill) {
        wsParams.append('subskill', initialCurriculum.subskill.id);
      }
      
      let wsUrl = apiUrl;
      if (apiUrl.startsWith('http://')) {
        wsUrl = apiUrl.replace('http://', 'ws://');
      } else if (apiUrl.startsWith('https://')) {
        wsUrl = apiUrl.replace('https://', 'wss://');
      }
      
      wsUrl = `${wsUrl}?${wsParams.toString()}`;
      console.log(`Attempting to connect to WebSocket at ${wsUrl}`);
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        sendInitialContext();
      };

      socketRef.current.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
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
  }, [apiUrl, initialCurriculum, handleWebSocketMessage, sendInitialContext]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        sendEndConversation();
      }
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsResponding(false);
    clearResponseTimeout();
  }, [sendEndConversation, clearResponseTimeout]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    isConnected,
    isConnecting,
    isResponding,
    connectionError,
    
    // Methods
    connect,
    disconnect,
    sendTextMessage,
    sendScreenData,
    sendEndOfTurn,
    sendEndConversation,
    
    // Direct access to socket (for audio capture service)
    socket: socketRef.current,
  };
};