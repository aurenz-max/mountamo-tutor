import type { VoiceTurnConfig } from './voiceTurnMachine';

/**
 * Device-local noise calibration for the lesson voice transport.
 *
 * The first few idle frames form a short measure-before-listening beat. After
 * that, the estimator keeps a bounded rolling sample so a headset swap, fan,
 * speaker-volume change, or browser AGC adjustment can be absorbed without a
 * reload. Medians make the estimate insensitive to an occasional cough or word
 * that lands while the turn machine is idle.
 */
export interface VoiceCalibrationState {
  ambientSamples: number[];
  echoSamples: number[];
  ambientFloor: number;
  echoFloor: number;
}

export interface CalibratedVoiceThresholds {
  ambientOpen: number;
  echoOpen: number;
  ambientReady: boolean;
  echoReady: boolean;
}

export const VOICE_CALIBRATION_MIN_SAMPLES = 8;
const MAX_SAMPLES = 72;
const MIN_OPEN_BAR = 0.008;
const MAX_OPEN_BAR = 0.2;

export const EMPTY_VOICE_CALIBRATION: VoiceCalibrationState = {
  ambientSamples: [],
  echoSamples: [],
  ambientFloor: 0,
  echoFloor: 0,
};

const median = (samples: number[]): number => {
  if (samples.length === 0) return 0;
  const ordered = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
};

export function observeVoiceFloor(
  state: VoiceCalibrationState,
  level: number,
  tutorAudible: boolean,
): VoiceCalibrationState {
  if (!Number.isFinite(level) || level < 0) return state;
  const key = tutorAudible ? 'echoSamples' : 'ambientSamples';
  const samples = [...state[key], Math.min(1, level)].slice(-MAX_SAMPLES);
  return {
    ...state,
    [key]: samples,
    [tutorAudible ? 'echoFloor' : 'ambientFloor']: median(samples),
  };
}

const clamp = (value: number) => Math.min(MAX_OPEN_BAR, Math.max(MIN_OPEN_BAR, value));

export function deriveVoiceThresholds(
  state: VoiceCalibrationState,
  fallback: VoiceTurnConfig,
): CalibratedVoiceThresholds {
  const ambientReady = state.ambientSamples.length >= VOICE_CALIBRATION_MIN_SAMPLES;
  const echoReady = state.echoSamples.length >= VOICE_CALIBRATION_MIN_SAMPLES;
  const ambientOpen = ambientReady
    ? clamp(Math.max(state.ambientFloor * 2.8, state.ambientFloor + 0.006))
    : fallback.silenceThreshold;
  const fallbackEcho = fallback.silenceThreshold * fallback.bargeInMultiplier;
  const echoOpen = echoReady
    ? clamp(Math.max(ambientOpen * 1.35, state.echoFloor * 1.8, state.echoFloor + 0.008))
    : Math.max(ambientOpen * fallback.bargeInMultiplier, fallbackEcho);
  return { ambientOpen, echoOpen, ambientReady, echoReady };
}

