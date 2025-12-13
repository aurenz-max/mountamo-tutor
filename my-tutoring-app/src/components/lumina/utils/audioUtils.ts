/**
 * Audio utility functions for decoding and playing Gemini TTS audio
 */

export const decodeBase64 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> => {
  // Create an empty buffer with the correct size
  // Note: The raw PCM data from Gemini is usually 16-bit integers (Int16)
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;

  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

// Singleton AudioContext to be used across the app
let sharedAudioContext: AudioContext | null = null;

export const getAudioContext = (): AudioContext => {
  if (!sharedAudioContext) {
    // @ts-ignore - webkitAudioContext for Safari
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 24000, // Gemini TTS default
    });
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
};

/**
 * Convert base64 audio data to AudioBuffer
 */
export const base64ToAudioBuffer = async (base64: string): Promise<AudioBuffer> => {
  const audioContext = getAudioContext();
  const rawBytes = decodeBase64(base64);
  return await decodeAudioData(rawBytes, audioContext);
};
