import { ai } from '../geminiClient';
import { Modality } from '@google/genai';

export interface TTSOptions {
  voice?: string;
  provider?: 'gemini' | 'auto';
}

export interface TTSResult {
  audioBase64: string | null;
  provider: 'gemini';
  error?: string;
}

/**
 * Generate TTS audio using Gemini
 * Returns base64 PCM audio data (24kHz, 16-bit mono) or null on failure
 */
const generateGeminiTTS = async (
  text: string,
  voiceName: string = 'Fenrir'
): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      console.warn('No audio data returned from Gemini TTS');
      return null;
    }

    return base64Audio;
  } catch (error: any) {
    // Check if it's a rate limit error
    if (error?.message?.includes('quota') || error?.message?.includes('429')) {
      console.warn('Gemini TTS rate limit hit:', error.message);
      throw new Error('RATE_LIMIT');
    }
    // Check if it's an internal server error (500)
    if (error?.status === 500 || error?.message?.includes('INTERNAL')) {
      console.warn('Gemini TTS internal error:', error.message || error.status);
      throw new Error('INTERNAL_ERROR');
    }
    console.error('Error generating Gemini TTS audio:', error);
    throw error;
  }
};

/**
 * Unified TTS service using Gemini
 *
 * @param text - Text to convert to speech
 * @param options - TTS options (voice, provider preference)
 * @returns TTSResult with audio data and provider used
 */
export const generateTTS = async (
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> => {
  const { voice } = options;

  // All modes use Gemini TTS
  try {
    console.log('🎤 Attempting Gemini TTS...');
    const audioBase64 = await generateGeminiTTS(text, voice || 'Fenrir');

    // Check if Gemini actually returned audio data
    if (!audioBase64) {
      console.warn('⚠️ Gemini returned no audio data');
      return {
        audioBase64: null,
        provider: 'gemini',
        error: 'No audio data returned from Gemini TTS',
      };
    }

    console.log('✅ Gemini TTS succeeded');
    return {
      audioBase64,
      provider: 'gemini',
    };
  } catch (error: any) {
    // Return failure with error message
    const errorMessage = error instanceof Error ? error.message : 'Gemini TTS failed';
    console.error('❌ Gemini TTS failed:', errorMessage);
    return {
      audioBase64: null,
      provider: 'gemini',
      error: errorMessage,
    };
  }
};

// Backward compatibility: Export the old function name
export const generateAudioSegment = async (text: string): Promise<string | null> => {
  const result = await generateTTS(text, { provider: 'auto' });
  return result.audioBase64;
};

export const generateTTSAudio = generateAudioSegment;
