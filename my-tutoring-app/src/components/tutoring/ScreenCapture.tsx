'use client';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useScreenCapture } from '@/lib/hooks/useScreenCapture';
import { useState } from 'react';

export function ScreenCapture() {
  const [error, setError] = useState<string>('');
  const [transcription, setTranscription] = useState<string>('');
  
  const { startCapture, stopCapture, isCapturing } = useScreenCapture({
    websocketUrl: 'ws://localhost:8000/ws/capture', // Replace with your backend URL
    onTranscription: (text) => {
      setTranscription(text);
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Button 
          onClick={isCapturing ? stopCapture : startCapture}
          variant={isCapturing ? "destructive" : "default"}
        >
          {isCapturing ? 'Stop Capture' : 'Start Capture'}
        </Button>
      </div>

      {transcription && (
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm">{transcription}</p>
        </div>
      )}
    </div>
  );
}