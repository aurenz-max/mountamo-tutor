// hooks/useAudioPlayback.ts
import { useRef, useCallback, useEffect } from 'react';

interface UseAudioPlaybackProps {
  sampleRate?: number;
}

const DEFAULT_SAMPLE_RATE = 24000;

/**
 * Minimum audio to accumulate (in seconds) before starting playback.
 * Gives the stream a small runway so the first sound isn't a single tiny
 * chunk with an audible gap after it.  150 ms is imperceptible latency
 * but enough to tile 3-4 Gemini chunks into gapless audio.
 */
const PRE_BUFFER_SECONDS = 0.15;

export const useAudioPlayback = ({ sampleRate = DEFAULT_SAMPLE_RATE }: UseAudioPlaybackProps = {}) => {
  const ctxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const isStreamingRef = useRef(false);
  const preBufferRef = useRef<AudioBuffer[]>([]);
  const preBufferDurationRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  /** Ensure a single AudioContext exists (system sample rate). */
  const ensureContext = useCallback((): AudioContext | null => {
    if (!ctxRef.current) {
      try {
        // System sample rate — avoids Windows WASAPI conflicts with other
        // AudioContexts (SoundManager, AudioCaptureService).  Buffers
        // created at 24 kHz are resampled automatically on playback.
        ctxRef.current = new AudioContext();
      } catch (error) {
        console.error('Error creating audio context:', error);
        return null;
      }
    }

    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }

    return ctxRef.current;
  }, []);

  /** Schedule a single AudioBuffer for gapless playback. */
  const scheduleBuffer = useCallback((ctx: AudioContext, audioBuffer: AudioBuffer) => {
    const now = ctx.currentTime;

    // If we've fallen behind real-time, jump forward to avoid stacking
    // old buffers on top of each other (which would sound like a burst).
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(nextStartTimeRef.current);

    // Track active sources so stopAudioPlayback can cancel them
    activeSourcesRef.current.push(source);
    source.onended = () => {
      const idx = activeSourcesRef.current.indexOf(source);
      if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
    };

    nextStartTimeRef.current += audioBuffer.duration;
  }, []);

  /** Flush the pre-buffer — schedule all accumulated chunks. */
  const flushPreBuffer = useCallback((ctx: AudioContext) => {
    for (const buf of preBufferRef.current) {
      scheduleBuffer(ctx, buf);
    }
    preBufferRef.current = [];
    preBufferDurationRef.current = 0;
    isStreamingRef.current = true;
  }, [scheduleBuffer]);

  const processAndPlayRawAudio = useCallback((base64Data: string, audioSampleRate: number = sampleRate) => {
    try {
      const ctx = ensureContext();
      if (!ctx) return;

      // Decode base64 → Int16 PCM → Float32
      const binaryString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }

      const int16View = new Int16Array(arrayBuffer);
      const numFrames = int16View.length;
      const floatData = new Float32Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        floatData[i] = int16View[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, numFrames, audioSampleRate);
      audioBuffer.copyToChannel(floatData, 0);

      if (isStreamingRef.current) {
        // Already past the pre-buffer phase — schedule immediately (gapless)
        scheduleBuffer(ctx, audioBuffer);
      } else {
        // Accumulate until we have enough runway for smooth playback
        preBufferRef.current.push(audioBuffer);
        preBufferDurationRef.current += audioBuffer.duration;

        if (preBufferDurationRef.current >= PRE_BUFFER_SECONDS) {
          flushPreBuffer(ctx);
        }
      }
    } catch (error) {
      console.error('Error processing raw audio data:', error);
    }
  }, [sampleRate, ensureContext, scheduleBuffer, flushPreBuffer]);

  /**
   * Signal that the current AI turn is done.  Resets pre-buffering so the
   * *next* response also gets the small startup runway, but does NOT cancel
   * audio that is still playing from this turn.
   */
  const resetForNextTurn = useCallback(() => {
    preBufferRef.current = [];
    preBufferDurationRef.current = 0;
    isStreamingRef.current = false;
  }, []);

  const stopAudioPlayback = useCallback(() => {
    // Stop all scheduled sources
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch { /* already stopped */ }
    });
    activeSourcesRef.current = [];

    // Reset state for the next utterance
    preBufferRef.current = [];
    preBufferDurationRef.current = 0;
    isStreamingRef.current = false;
    nextStartTimeRef.current = 0;
  }, []);

  return {
    processAndPlayRawAudio,
    stopAudioPlayback,
    resetForNextTurn,
  };
};
