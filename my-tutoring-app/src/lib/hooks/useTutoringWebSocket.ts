// src/hooks/useTutoringWebSocket.ts

import { useEffect, useRef, useCallback, useState } from 'react';
import { TutoringWebSocket } from '../services/TutoringWebSocket';

interface UseTutoringWebSocketProps {
  baseUrl: string;
  onAudio?: (audioData: ArrayBuffer) => void;
  onStatus?: (status: string) => void;
  onError?: (error: string) => void;
}

interface SessionConfig {
  subject: string;
  skill: string;
  subskill: string;
  student_id: number;
  competency_score: number;
}

export const useTutoringWebSocket = ({
  baseUrl,
  onAudio,
  onStatus,
  onError
}: UseTutoringWebSocketProps) => {
  const wsRef = useRef<TutoringWebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new TutoringWebSocket(
      baseUrl,
      (audioData) => {
        onAudio?.(audioData);
      },
      (status) => {
        onStatus?.(status);
      },
      (error) => {
        setError(error);
        onError?.(error);
      }
    );

    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [baseUrl, onAudio, onStatus, onError]);

  const connect = useCallback(async (config: SessionConfig) => {
    if (!wsRef.current) return;

    try {
      setIsConnecting(true);
      setError(null);
      await wsRef.current.connect(config);
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.disconnect();
    setIsConnected(false);
  }, []);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (!wsRef.current || !isConnected) return;
    wsRef.current.sendAudio(audioData);
  }, [isConnected]);

  return {
    connect,
    disconnect,
    sendAudio,
    isConnected,
    isConnecting,
    error
  };
};

// Example usage in a React component:
/*
const TutoringComponent: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    connect,
    disconnect,
    sendAudio,
    isConnected,
    isConnecting,
    error
  } = useTutoringWebSocket({
    baseUrl: 'wss://your-backend-url/api',
    onAudio: (audioData) => {
      // Handle received audio
      if (audioRef.current) {
        const blob = new Blob([audioData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        audioRef.current.src = url;
        audioRef.current.play();
      }
    },
    onStatus: (status) => {
      console.log('Tutoring status:', status);
    },
    onError: (error) => {
      console.error('Tutoring error:', error);
    }
  });

  useEffect(() => {
    // Start session when component mounts
    connect({
      subject: 'math',
      skill: 'counting',
      subskill: 'numbers 1-10',
      student_id: 123,
      competency_score: 7.0
    });

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Example of sending audio from microphone
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        event.data.arrayBuffer().then(buffer => {
          sendAudio(buffer);
        });
      };

      mediaRecorder.start(100); // Send chunks every 100ms
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  return (
    <div>
      <audio ref={audioRef} />
      {isConnecting && <div>Connecting...</div>}
      {error && <div>Error: {error}</div>}
      {isConnected && (
        <button onClick={startRecording}>
          Start Tutoring Session
        </button>
      )}
    </div>
  );
};
*/