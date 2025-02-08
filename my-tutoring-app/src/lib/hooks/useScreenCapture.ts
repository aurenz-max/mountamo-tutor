import { useRef, useCallback, useEffect } from 'react';
import { createCaptureClient } from '../capture';
import { CaptureOptions } from '@/types/capture';

interface UseScreenCaptureOptions extends CaptureOptions {
  websocketUrl: string;
  onTranscription?: (text: string) => void;
  onError?: (error: Error) => void;
}

export function useScreenCapture({
  websocketUrl,
  onTranscription,
  onError,
  ...options
}: UseScreenCaptureOptions) {
  const clientRef = useRef<ReturnType<typeof createCaptureClient> | null>(null);

  useEffect(() => {
    const handleTranscription = (event: CustomEvent<string>) => {
      onTranscription?.(event.detail);
    };

    window.addEventListener('transcription', handleTranscription as EventListener);
    return () => {
      window.removeEventListener('transcription', handleTranscription as EventListener);
      clientRef.current?.stopCapture();
    };
  }, [onTranscription]);

  const startCapture = useCallback(async () => {
    try {
      clientRef.current = createCaptureClient(websocketUrl, options);
      await clientRef.current.startCapture();
    } catch (err) {
      onError?.(err as Error);
    }
  }, [websocketUrl, options, onError]);

  const stopCapture = useCallback(() => {
    clientRef.current?.stopCapture();
    clientRef.current = null;
  }, []);

  const isCapturing = clientRef.current?.getStatus().isCapturing || false;

  return {
    startCapture,
    stopCapture,
    isCapturing
  };
}