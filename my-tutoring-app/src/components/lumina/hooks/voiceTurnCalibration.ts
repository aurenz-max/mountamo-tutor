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
/**
 * Hard floor for the BARGE-IN bar only (DI-120-1, 2026-08-06 counting-120
 * sitting): device speaker leakage peaked 0.018 while the calibrated barge bar
 * sat at 0.0108 — two noise blips opened turns over tutor audio, anchored
 * empty attempts, and burned an item the learner never answered. The echo
 * calibration under-measures bursty leakage by construction (a median over
 * mostly-quiet frames: it recorded 0.0002 against live 0.018), so the derived
 * bar needs a floor that no measurement can undercut. Real barge-in speech has
 * measured ≥0.045 on every sitting (0.045–0.116 on 08-06; ≥0.068 on 07-19), so
 * 0.03 — the top of the run report's sanctioned 0.025–0.03 window — rejects
 * every observed leakage class but 07-19's single 0.033 blip while keeping
 * 33%+ headroom under the quietest real answer. The AMBIENT bar is deliberately
 * untouched: answering into silence must stay sensitive for quiet children.
 */
const MIN_BARGE_BAR = 0.03;

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
    ? clamp(Math.max(MIN_BARGE_BAR, ambientOpen * 1.35, state.echoFloor * 1.8, state.echoFloor + 0.008))
    : Math.max(ambientOpen * fallback.bargeInMultiplier, fallbackEcho, MIN_BARGE_BAR);
  return { ambientOpen, echoOpen, ambientReady, echoReady };
}

