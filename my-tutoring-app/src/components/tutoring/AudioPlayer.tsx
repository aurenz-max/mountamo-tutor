import React from 'react';

export const playBase64Audio = async (
  base64Audio: string,
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  setIsPlaying: (isPlaying: boolean) => void,
  setError: (error: string | null) => void
) => {
  if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
    console.error("Audio context is not available or closed.");
    return;
  }

  try {
    setIsPlaying(true);

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const binaryString = window.atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Int16Array(len / 2);

    for (let i = 0; i < len; i += 2) {
      bytes[i / 2] = (binaryString.charCodeAt(i) | (binaryString.charCodeAt(i + 1) << 8));
    }

    const audioBuffer = audioContextRef.current.createBuffer(
      1,
      bytes.length,
      24000
    );

    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < bytes.length; i++) {
      channelData[i] = bytes[i] / 32768.0;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => setIsPlaying(false);
    source.start(0);

  } catch (error) {
    console.error('Audio playback error:', error);
    setError('Failed to play audio message');
    setIsPlaying(false);
  }
};