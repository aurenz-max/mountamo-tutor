import { DEFAULT_VOICE_TURN_CONFIG, type VoiceTurnConfig } from './voiceTurnMachine';
import type { AudioInputConfig } from '../types';

export function resolveLessonAudioInput(
  declared?: AudioInputConfig | null,
): AudioInputConfig {
  return { ...(declared ?? {}), manual_activity: true };
}

/** Close timing follows the primitive claimed by the lesson viewport. Opening
 * thresholds remain device-calibrated in useLiveVoiceTurns. */
export function resolveLessonVoiceTurnConfig(
  primitiveType: string | null,
): Partial<VoiceTurnConfig> {
  if (primitiveType === 'di-letter-sounds') return { silenceCloseMs: 300 };
  if (primitiveType === 'di-word-reading' || primitiveType === 'di-math-facts') {
    return { silenceCloseMs: 420 };
  }
  if (primitiveType === 'di-sentence-reading') return { silenceCloseMs: 600 };
  return { silenceCloseMs: 900, minVoiceMs: DEFAULT_VOICE_TURN_CONFIG.minVoiceMs };
}
