// File: hooks/useWebSocketManager.ts
// Handles all the WebSocket communication
import { useState, useRef, useCallback, useEffect } from 'react';

export interface WebSocketMessage {
  type: string;
  content?: any;
  data?: any;
  timestamp?: number;
  duration?: number;
  // Other possible properties
}

interface WebSocketManagerOptions {
  url: string;
  sessionData: any;
  onMessage: (message: WebSocketMessage) => void;
  onStatusChange: (status: string) => void;
  onSessionIdChange: (sessionId: string | null) => void;
}

export function useWebSocketManager(options: WebSocketManagerOptions) {
  const { url, sessionData, onMessage, onStatusChange, onSessionIdChange } = options;
  
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  
  // Set up connection status change callback
  useEffect(() => {
    onStatusChange(connectionStatus);
  }, [connectionStatus, onStatusChange]);
  
  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      
      const ws = new WebSocket(url);
      ws.binaryType = 'blob';
      wsRef.current = ws;
      
      // Set up event handlers
      ws.onopen = () => {
        console.log('WebSocket connection established');
        
        // Send initialization message
        ws.send(JSON.stringify({
          text: "InitSession",
          data: sessionData
        }));
      };
      
      ws.onmessage = (event) => {
        // Handle binary data
        if (event.data instanceof Blob) {
          onMessage({ type: 'binary', data: event.data });
          return;
        }
        
        // Parse JSON message
        try {
          const message = JSON.parse(event.data);
          
          // Handle session initialization
          if (message.type === 'session_started') {
            onSessionIdChange(message.session_id);
            setConnectionStatus('connected');
          }
          
          // Forward all messages to handler
          onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        setConnectionStatus('disconnected');
        onSessionIdChange(null);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };
      
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [url, sessionData, onMessage, onSessionIdChange]);
  
  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);
  
  // Send message through WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  return {
    status: connectionStatus,
    connect,
    disconnect,
    sendMessage,
    getWebSocket: () => wsRef.current
  };
}