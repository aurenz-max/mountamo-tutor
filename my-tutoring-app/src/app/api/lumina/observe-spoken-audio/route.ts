import { observationRoute } from '@/components/lumina/service/typesafe/observationRoute';
import { spokenAudioKind, validSpokenAudioRequest, MAX_AUDIO_BASE64 } from '@/components/lumina/service/typesafe/observeSpokenAudio';

/** PROTOTYPE shadow: spoken_miss judged from the learner's audio by gemini-decision-1. Advisory; commits nothing. */
export const POST = observationRoute(spokenAudioKind, validSpokenAudioRequest, { maxBytes: MAX_AUDIO_BASE64 + 20000, noun: 'answer' });
