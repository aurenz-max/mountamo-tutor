// File: components/tutoring/AudioProcessor.tsx
// Handles audio playback and synchronization
import React, { useRef, useEffect, useCallback } from 'react';
import { useAudioState } from '@/components/audio/AudioStateContext';

interface AudioProcessorProps {
  onPlaybackStart: () => void;
  onPlaybackEnd: () => void;
}

const AudioProcessor: React.FC<AudioProcessorProps> = ({ 
  onPlaybackStart, 
  onPlaybackEnd 
}) => {
  const { setAudioState } = useAudioState();
  const audioContextRef = useRef<AudioContext | null>(null);
  const endTimeRef = useRef<number>(0);
  const currentUtteranceRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  
  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);
  
  // Handle audio data from WebSocket
  const processAudio = useCallback(async (
    audioData: string | Blob,
    timestamp?: number,
    duration?: number,
    sampleRate: number = 24000
  ) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Convert to PCM data
      let pcmData: Int16Array;
      
      if (audioData instanceof Blob) {
        const arrayBuffer = await audioData.arrayBuffer();
        pcmData = new Int16Array(arrayBuffer);
      } else {
        // Decode base64
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pcmData = new Int16Array(bytes.buffer);
      }
      
      // Convert to float for Web Audio API
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0;
      }
      
      // Create audio buffer
      const audioBuffer = audioContextRef.current.createBuffer(1, floatData.length, sampleRate);
      audioBuffer.copyToChannel(floatData, 0);
      
      // Create source node
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      // Schedule playback with minimal gap
      const now = audioContextRef.current.currentTime;
      const startTime = Math.max(now, endTimeRef.current) + 0.01;
      const chunkDuration = floatData.length / sampleRate;
      endTimeRef.current = startTime + chunkDuration;
      
      // Start playback
      source.start(startTime);
      
      // Update state
      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        setAudioState(prev => ({ ...prev, isGeminiSpeaking: true }));
        onPlaybackStart();
        
        // Start a new utterance if needed
        if (!currentUtteranceRef.current) {
          currentUtteranceRef.current = `gemini-${Date.now()}`;
        }
      }
      
      // Dispatch timing event for viseme synchronization
      window.dispatchEvent(new CustomEvent('audio-playback-scheduled', {
        detail: {
          serverTimestamp: timestamp || Date.now(),
          clientTimestamp: Date.now(),
          scheduledPlaybackTime: startTime * 1000 + audioContextRef.current.baseLatency * 1000,
          duration: duration || chunkDuration * 1000,
          visemeLeadTime: 50 // Default 50ms lead time for visemes
        }
      }));
      
      // Audio end handler
      source.onended = () => {
        const currentT = audioContextRef.current?.currentTime;
        
        if (currentT && currentT >= endTimeRef.current - 0.05) {
          // Add small grace period for smoother transitions
          setTimeout(() => {
            if (currentT >= endTimeRef.current - 0.05) {
              isPlayingRef.current = false;
              setAudioState(prev => ({ ...prev, isGeminiSpeaking: false }));
              currentUtteranceRef.current = null;
              onPlaybackEnd();
            }
          }, 300); // 300ms grace period
        }
      };
      
    } catch (error) {
      console.error('Error processing audio:', error);
      isPlayingRef.current = false;
      setAudioState(prev => ({ ...prev, isGeminiSpeaking: false }));
      onPlaybackEnd();
    }
  }, [onPlaybackStart, onPlaybackEnd, setAudioState]);
  
  // Expose the processAudio method to parent component
  // using React's useImperativeHandle pattern
  React.useImperativeHandle(
    React.useRef<any>(),
    () => ({
      processAudio,
      isPlaying: isPlayingRef.current,
      getCurrentUtterance: () => currentUtteranceRef.current
    }),
    [processAudio]
  );
  
  // This is a "headless" component (no UI)
  return null;
};

export default AudioProcessor;