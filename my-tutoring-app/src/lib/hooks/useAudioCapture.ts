// hooks/useAudioCapture.ts
import { useRef, useState, useCallback, useEffect } from 'react';
import AudioCaptureService from '@/lib/AudioCaptureService';

interface UseAudioCaptureProps {
  socket: WebSocket | null;
  onError?: (error: Error) => void;
}

export const useAudioCapture = ({ socket, onError }: UseAudioCaptureProps) => {
  const [isListening, setIsListening] = useState(false);
  const audioCaptureServiceRef = useRef<AudioCaptureService | null>(null);
  // Keep track of the actual state without causing re-renders
  const stateRef = useRef({ isCapturing: false });

  // Initialize audio capture service
  useEffect(() => {
    if (!audioCaptureServiceRef.current) {
      console.log('[Hook] Creating AudioCaptureService');
      audioCaptureServiceRef.current = new AudioCaptureService();
      audioCaptureServiceRef.current.setCallbacks({
        onStateChange: (state) => {
          console.log('[Hook] Audio state change:', state);
          stateRef.current = state;
          setIsListening(state.isCapturing);
        },
        onError: (error) => {
          console.error('[Hook] Audio error:', error);
          onError?.(error);
        }
      });
    }

    // Cleanup
    return () => {
      console.log('[Hook] Cleaning up');
      if (audioCaptureServiceRef.current) {
        audioCaptureServiceRef.current.destroy();
        audioCaptureServiceRef.current = null;
      }
    };
  }, []); // Remove onError from dependencies

  // Update WebSocket when it changes
  useEffect(() => {
    if (audioCaptureServiceRef.current && socket) {
      console.log('[Hook] Setting WebSocket on AudioCaptureService');
      audioCaptureServiceRef.current.setWebSocket(socket);
    }
  }, [socket]);

  const startAudioRecording = useCallback(async () => {
    console.log('[Hook] startAudioRecording called');
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error('[Hook] WebSocket not ready:', socket?.readyState);
      return false;
    }

    // Check if already capturing
    if (stateRef.current.isCapturing) {
      console.log('[Hook] Already capturing, ignoring start');
      return true;
    }
    
    try {
      if (audioCaptureServiceRef.current) {
        await audioCaptureServiceRef.current.startCapture();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Hook] Error starting audio:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        onError?.(new Error('Microphone access denied. Please allow microphone access to use this feature.'));
      } else {
        onError?.(error instanceof Error ? error : new Error('Failed to start audio recording'));
      }
      return false;
    }
  }, [socket, onError]);

  const stopAudioRecording = useCallback(() => {
    console.log('[Hook] stopAudioRecording called');
    
    // Check if actually capturing
    if (!stateRef.current.isCapturing) {
      console.log('[Hook] Not capturing, ignoring stop');
      return;
    }
    
    if (audioCaptureServiceRef.current) {
      audioCaptureServiceRef.current.stopCapture();
    }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    console.log('[Hook] toggleMicrophone called. Current state:', stateRef.current.isCapturing);
    
    if (stateRef.current.isCapturing) {
      stopAudioRecording();
      return true;
    } else {
      return await startAudioRecording();
    }
  }, [startAudioRecording, stopAudioRecording]);

  return {
    isListening,
    startAudioRecording,
    stopAudioRecording,
    toggleMicrophone,
  };
};