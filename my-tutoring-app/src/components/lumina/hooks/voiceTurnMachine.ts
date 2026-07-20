/**
 * voiceTurnMachine — pure amplitude turn authority for open-mic Live sessions.
 *
 * Extracted from the DI bench (runs 3–4 tuned the constants; the 2026-07-19
 * probe run motivated the dual threshold). Under Gemini `manual_activity`,
 * no learner turn exists unless the client opens one: this machine decides,
 * frame by frame, when a turn opens and closes. The consuming hook translates
 * its events into activityStart/activityEnd signals.
 *
 * Design rules it encodes:
 * - The mic is NEVER gated on tutor audio (no-force-mutes ruling). Speaking
 *   while the tutor is audible opens a turn — that is native barge-in.
 * - DI-2 dual threshold: the bar to open a turn while tutor audio plays is
 *   `silenceThreshold * bargeInMultiplier`. Echo residual that survives AEC
 *   sits just above the silence bar (probe run: echo peaked 0.033 vs real
 *   speech ≥ 0.068), and a human interrupts by speaking UP — so barge-in
 *   demands more energy than answering into silence.
 * - Hysteresis: an open turn holds down to `hysteresisHoldRatio` of the bar
 *   it OPENED at (a hum sitting at the threshold flaps micro-brackets
 *   otherwise). Anchoring to the opening bar keeps a barge-in turn's hold
 *   floor above echo even after the interrupted tutor goes quiet.
 * - A turn closes after `silenceCloseMs` below the hold floor. Turns shorter
 *   than `minVoiceMs` are flagged `belowMinVoice` — the activity brackets
 *   were already sent (the open had to be immediate to interrupt), but
 *   consumers should not log or anchor attempts on them.
 */

export interface VoiceTurnConfig {
  /** RMS bar to open a turn while the tutor is silent. */
  silenceThreshold: number;
  /** Multiplier on silenceThreshold to open while tutor audio plays (DI-2). */
  bargeInMultiplier: number;
  /** An open turn holds down to this fraction of its opening bar. */
  hysteresisHoldRatio: number;
  /** Continuous ms below the hold floor that closes the turn. */
  silenceCloseMs: number;
  /** Turns shorter than this are flagged belowMinVoice on close. */
  minVoiceMs: number;
}

export const DEFAULT_VOICE_TURN_CONFIG: VoiceTurnConfig = {
  silenceThreshold: 0.025,
  bargeInMultiplier: 2,
  hysteresisHoldRatio: 0.6,
  silenceCloseMs: 500,
  minVoiceMs: 120,
};

export interface VoiceTurnState {
  active: boolean;
  startedAt: number;
  lastAboveAt: number;
  peak: number;
  /** The turn opened while tutor audio was audible (barge-in or echo leak). */
  duringTutorAudio: boolean;
  /** The bar this turn opened at; hysteresis holds relative to it. */
  openBar: number;
}

export const IDLE_VOICE_TURN: VoiceTurnState = {
  active: false,
  startedAt: 0,
  lastAboveAt: 0,
  peak: 0,
  duringTutorAudio: false,
  openBar: 0,
};

export interface VoiceFrame {
  /** RMS level of the current capture frame. */
  level: number;
  /** Tutor audio is currently audible from the speakers. */
  tutorAudible: boolean;
  /** Monotonic timestamp in ms (performance.now()). */
  now: number;
}

export type VoiceTurnEvent =
  | { kind: 'open'; at: number; duringTutorAudio: boolean }
  | {
      kind: 'close';
      startedAt: number;
      durationMs: number;
      peak: number;
      duringTutorAudio: boolean;
      belowMinVoice: boolean;
    };

export interface VoiceTurnStep {
  state: VoiceTurnState;
  event: VoiceTurnEvent | null;
}

export function stepVoiceTurn(
  state: VoiceTurnState,
  frame: VoiceFrame,
  config: VoiceTurnConfig,
): VoiceTurnStep {
  const { level, tutorAudible, now } = frame;

  if (!state.active) {
    const openBar = tutorAudible
      ? config.silenceThreshold * config.bargeInMultiplier
      : config.silenceThreshold;
    if (level >= openBar) {
      const next: VoiceTurnState = {
        active: true,
        startedAt: now,
        lastAboveAt: now,
        peak: level,
        duringTutorAudio: tutorAudible,
        openBar,
      };
      return { state: next, event: { kind: 'open', at: now, duringTutorAudio: tutorAudible } };
    }
    return { state, event: null };
  }

  const holdFloor = state.openBar * config.hysteresisHoldRatio;
  if (level >= holdFloor) {
    return {
      state: {
        ...state,
        lastAboveAt: now,
        peak: Math.max(state.peak, level),
      },
      event: null,
    };
  }

  if (now - state.lastAboveAt > config.silenceCloseMs) {
    const durationMs = Math.max(0, Math.round(state.lastAboveAt - state.startedAt));
    return {
      state: IDLE_VOICE_TURN,
      event: {
        kind: 'close',
        startedAt: state.startedAt,
        durationMs,
        peak: state.peak,
        duringTutorAudio: state.duringTutorAudio,
        belowMinVoice: durationMs < config.minVoiceMs,
      },
    };
  }

  return { state, event: null };
}

export interface VoiceTurnCloseStep {
  state: VoiceTurnState;
  event: Extract<VoiceTurnEvent, { kind: 'close' }> | null;
}

/** Force-close an active turn (stop, disable, unmount). Returns the close
 *  event the consumer should mirror with activityEnd, or null if idle. */
export function closeVoiceTurn(state: VoiceTurnState, config: VoiceTurnConfig): VoiceTurnCloseStep {
  if (!state.active) return { state, event: null };
  const durationMs = Math.max(0, Math.round(state.lastAboveAt - state.startedAt));
  return {
    state: IDLE_VOICE_TURN,
    event: {
      kind: 'close',
      startedAt: state.startedAt,
      durationMs,
      peak: state.peak,
      duringTutorAudio: state.duringTutorAudio,
      belowMinVoice: durationMs < config.minVoiceMs,
    },
  };
}
