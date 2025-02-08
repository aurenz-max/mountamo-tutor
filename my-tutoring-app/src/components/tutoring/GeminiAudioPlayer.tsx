import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '@/lib/use-websocket';
import { AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

const GeminiAudioPlayer = () => {
  const { messages } = useWebSocket();
  const audioContext = useRef(null);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  useEffect(() => {
    // Initialize AudioContext with error handling
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000 // Match backend sample rate
        });
      }
    } catch (err) {
      setError('Failed to initialize audio system. Please check your browser settings.');
      console.error('AudioContext initialization error:', err);
    }

    // Cleanup
    return () => {
      if (audioContext.current?.state === 'running') {
        audioContext.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (isMuted) return;

    const playAudio = async (base64Audio) => {
      if (!audioContext.current || audioContext.current.state === 'closed') {
        return;
      }

      try {
        setIsPlaying(true);
        // Resume context if suspended
        if (audioContext.current.state === 'suspended') {
          await audioContext.current.resume();
        }

        // Decode base64
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Int16Array(len / 2);

        // Convert to 16-bit PCM
        for (let i = 0; i < len; i += 2) {
          bytes[i / 2] = (binaryString.charCodeAt(i) | (binaryString.charCodeAt(i + 1) << 8));
        }

        // Create and configure audio buffer
        const audioBuffer = audioContext.current.createBuffer(
          1, // mono
          bytes.length,
          24000 // sample rate
        );

        // Fill audio buffer
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < bytes.length; i++) {
          channelData[i] = bytes[i] / 32768.0;
        }
        
        // Create and play source
        const source = audioContext.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.current.destination);
        source.onended = () => setIsPlaying(false);
        source.start(0);

      } catch (error) {
        console.error('Audio playback error:', error);
        setError('Failed to play audio message');
        setIsPlaying(false);
      }
    };

    // Process new messages
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.audio && lastMessage?.status === 'streaming') {
      console.log('Processing audio chunk, size:', lastMessage.size);
      playAudio(lastMessage.audio);
    }
  }, [messages, isMuted]);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between p-2 bg-secondary rounded-lg">
        <div className="flex items-center gap-2">
          {isPlaying ? (
            <div className="flex gap-1">
              <div className="w-1 h-4 bg-primary animate-pulse" />
              <div className="w-1 h-4 bg-primary animate-pulse delay-75" />
              <div className="w-1 h-4 bg-primary animate-pulse delay-150" />
            </div>
          ) : (
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm">
            {isPlaying ? 'Playing audio...' : 'Waiting for audio...'}
          </span>
        </div>

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 hover:bg-muted rounded-full"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {messages.map((msg, index) => (
          <div key={index} className={`p-3 rounded-lg ${
            msg.status === 'error' ? 'bg-destructive/10' : 'bg-muted'
          }`}>
            {msg.text && (
              <p className="text-sm">{msg.text}
                <span className="text-xs text-muted-foreground block mt-1">AI response</span>
              </p>
            )}
            {msg.audio && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                <span>Audio message ({Math.round(msg.size / 1024)}KB)</span>
              </div>
            )}
            {msg.error && (
              <p className="text-sm text-destructive">{msg.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeminiAudioPlayer;