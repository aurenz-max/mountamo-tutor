'use client';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAudioCapture } from '@/lib/hooks/useAudioCapture';
import { useState } from 'react';
import { Mic, Square } from 'lucide-react';

export function AudioCapture() {
  const [error, setError] = useState<string>('');
  const [transcription, setTranscription] = useState<string>('');
  
  const { startCapture, stopCapture, isCapturing } = useAudioCapture({
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
          className="gap-2"
        >
          {isCapturing ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isCapturing ? 'Stop Recording' : 'Start Recording'}
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