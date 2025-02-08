import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import { useGeminiService } from '@/lib/useGeminiService';

interface ProblemReaderProps {
  text: string;
  contentType: 'problem' | 'feedback';
  autoRead?: boolean;
  onReadingStateChange?: (isReading: boolean) => void;
}

const ProblemReader = ({ 
  text, 
  contentType, 
  autoRead = false,
  onReadingStateChange
}: ProblemReaderProps) => {
  const [isReading, setIsReading] = useState(false);
  const gemini = useGeminiService();

  useEffect(() => {
    if (!gemini.isConnected() && isReading) {
      setIsReading(false);
      onReadingStateChange?.(false);
    }
  }, [gemini.readyState]);

  useEffect(() => {
    if (autoRead && text && gemini.isConnected()) {
      readText();
    }
  }, [text, autoRead]);

  const readText = async () => {
    try {
      setIsReading(true);
      onReadingStateChange?.(true);
      gemini.textToSpeech(text, contentType);
    } catch (error) {
      console.error('Error reading text:', error);
    } finally {
      setIsReading(false);
      onReadingStateChange?.(false);
    }
  };

  const toggleReading = () => {
    if (isReading) {
      setIsReading(false);
      onReadingStateChange?.(false);
    } else {
      readText();
    }
  };

  return (
    <Button 
      onClick={toggleReading}
      variant={isReading ? "secondary" : "default"}
      disabled={!gemini.isConnected()}
      size="sm"
      className="flex items-center gap-2"
    >
      {isReading ? (
        <>
          <VolumeX className="h-4 w-4" />
          Stop Reading
        </>
      ) : (
        <>
          <Volume2 className="h-4 w-4" />
          Read Aloud
        </>
      )}
    </Button>
  );
};

export default ProblemReader;