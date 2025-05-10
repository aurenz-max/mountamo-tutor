// hooks/useAudioPlayback.ts
import { useRef, useCallback, useEffect } from 'react';

interface UseAudioPlaybackProps {
  sampleRate?: number;
}

const DEFAULT_SAMPLE_RATE = 24000;
const BUFFER_GAP = 0.02; // 20ms gap between buffers
const MAX_BUFFER_QUEUE = 10;

export const useAudioPlayback = ({ sampleRate = DEFAULT_SAMPLE_RATE }: UseAudioPlaybackProps = {}) => {
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);
  const lastScheduledTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackAudioContextRef.current) {
        playbackAudioContextRef.current.close().catch(err => {
          console.error('Error closing playback audio context:', err);
        });
      }
    };
  }, []);

  const processAndPlayRawAudio = useCallback((base64Data: string, audioSampleRate: number = sampleRate) => {
    try {
      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }
      
      // Create playback audio context if it doesn't exist
      if (!playbackAudioContextRef.current) {
        try {
          playbackAudioContextRef.current = new AudioContext({
            sampleRate: audioSampleRate,
          });
        } catch (error) {
          console.error('Error creating audio context:', error);
          return;
        }
      }
      
      // Convert to Int16 PCM
      const int16View = new Int16Array(arrayBuffer);
      
      // Convert to Float32 for Web Audio API
      const numFrames = int16View.length;
      const floatData = new Float32Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        floatData[i] = int16View[i] / 32768.0;
      }
      
      // Create an audio buffer
      const audioBuffer = playbackAudioContextRef.current.createBuffer(
        1, // mono
        numFrames,
        audioSampleRate
      );
      
      // Copy the float data to the buffer
      audioBuffer.copyToChannel(floatData, 0);
      
      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      
      // Check if buffer queue has grown too large
      if (audioQueueRef.current.length > MAX_BUFFER_QUEUE) {
        consolidateBuffers();
      }
      
      // If not currently playing, start playback
      if (!isPlayingRef.current) {
        // Ensure the audio context is in a running state
        if (playbackAudioContextRef.current.state === 'suspended') {
          playbackAudioContextRef.current.resume().catch(error => {
            console.error('Error resuming audio context:', error);
          });
        }
        playNextAudioInQueue();
      }
    } catch (error) {
      console.error('Error processing raw audio data:', error);
    }
  }, [sampleRate]);

  const consolidateBuffers = useCallback(() => {
    if (!playbackAudioContextRef.current || audioQueueRef.current.length <= 1) {
      return;
    }
    
    // Calculate total length of all buffers in the queue
    let totalLength = 0;
    audioQueueRef.current.forEach(buffer => {
      totalLength += buffer.length;
    });
    
    // Create a new consolidated buffer
    const consolidatedBuffer = playbackAudioContextRef.current.createBuffer(
      1, // mono
      totalLength,
      playbackAudioContextRef.current.sampleRate
    );
    
    // Copy data from all buffers into the consolidated one
    const outputData = consolidatedBuffer.getChannelData(0);
    let offset = 0;
    
    audioQueueRef.current.forEach(buffer => {
      const bufferData = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        outputData[offset + i] = bufferData[i];
      }
      offset += buffer.length;
    });
    
    // Replace the queue with just the single consolidated buffer
    audioQueueRef.current = [consolidatedBuffer];
    console.log('Consolidated audio buffers for smoother playback');
  }, []);

  const playNextAudioInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    
    // Get audio context
    if (!playbackAudioContextRef.current) {
      isPlayingRef.current = false;
      return;
    }
    
    // Get the buffer to play
    const audioBuffer = audioQueueRef.current.shift();
    if (!audioBuffer) {
      isPlayingRef.current = false;
      return;
    }
    
    // Create source
    const source = playbackAudioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackAudioContextRef.current.destination);
    
    // Calculate when to play this buffer
    const currentTime = playbackAudioContextRef.current.currentTime;
    const bufferDuration = audioBuffer.duration;
    
    // For very small buffers (< 50ms), play immediately
    let startTime;
    if (bufferDuration < 0.05) {
      startTime = Math.max(currentTime, lastScheduledTimeRef.current);
    } else {
      // For normal buffers, schedule with a gap
      startTime = Math.max(currentTime, lastScheduledTimeRef.current + BUFFER_GAP);
    }
    
    // Update the last scheduled time
    lastScheduledTimeRef.current = startTime + bufferDuration;
    
    // Store the source node
    audioSourceNodeRef.current = source;
    
    // Start the playback at the calculated time
    source.start(startTime);
    
    // Handle the buffer ending
    source.onended = () => {
      audioSourceNodeRef.current = null;
      
      // If we have more buffers, schedule the next one
      if (audioQueueRef.current.length > 0) {
        // Use a short timeout to give the browser time to process
        setTimeout(() => {
          playNextAudioInQueue();
        }, 10);
      } else {
        isPlayingRef.current = false;
      }
    };
  }, []);

  const stopAudioPlayback = useCallback(() => {
    if (audioSourceNodeRef.current) {
      audioSourceNodeRef.current.stop();
      audioSourceNodeRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    lastScheduledTimeRef.current = 0;
  }, []);

  return {
    processAndPlayRawAudio,
    stopAudioPlayback,
  };
};