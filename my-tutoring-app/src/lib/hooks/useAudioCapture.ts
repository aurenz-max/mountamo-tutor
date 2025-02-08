// lib/hooks/useAudioCapture.ts
import { useCallback, useEffect } from 'react';
import { useWebSocket } from '@/lib/use-websocket';

interface UseAudioCaptureProps {
  onTranscription?: (text: string) => void;
  onError?: (error: Error) => void;
}

export const useAudioCapture = ({
  onTranscription,
  onError,
}: UseAudioCaptureProps) => {
  const { 
    startAudioCapture, 
    stopAudioCapture, 
    isAudioCapturing,
    lastMessage,
    readyState
  } = useWebSocket();

  // Handle incoming transcriptions from the websocket
  useEffect(() => {
    if (lastMessage?.text && onTranscription) {
      onTranscription(lastMessage.text);
    }
  }, [lastMessage, onTranscription]);

  const startCapture = useCallback(async () => {
    try {
      if (readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not connected');
      }
      await startAudioCapture();
    } catch (err) {
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [startAudioCapture, readyState, onError]);

  const stopCapture = useCallback(() => {
    stopAudioCapture();
  }, [stopAudioCapture]);

  return {
    startCapture,
    stopCapture,
    isCapturing: isAudioCapturing
  };
};