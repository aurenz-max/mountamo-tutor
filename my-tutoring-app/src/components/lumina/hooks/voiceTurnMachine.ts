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
 * - App sound effects (a tap, a chime) are output too (`appAudible`, 2026-11-15). While one may be heard, a
 *   turn opens only at the barge-in bar and an open turn holds only at that bar's hold floor, so the echo of
 *   a tap is never a learner turn and taps every half second never keep one open (agent-canvas: a turn held
 *   27 s while the child shaded parts, and the tutor could not answer until it closed).
 * - A turn closes after `silenceCloseMs` below the hold floor. Turns with less
 *   than `minVoiceMs` of VOICED audio are flagged `belowMinVoice` — the activity
 *   brackets were already sent, but consumers should not anchor attempts on them.
 * - Deferred commit (2026-11-15). Gemini cancels the tutor's sentence the moment
 *   it receives activityStart, so a one-frame noise over the echo bar (a cough,
 *   a chair) used to cut her off. While the tutor is audible a turn is now
 *   PENDING until `bargeInCommitMs` of frames at or above the opening bar have
 *   been heard; only then does `open` fire. Only frames at the opening bar
 *   count, not the hold floor, because echo residual sits above the hold floor.
 *   A pending turn with no such frame for `bargeInCommitMs` is discarded. If
 *   the tutor goes quiet while a turn is pending, speech at the silence bar
 *   opens it at once. Answering into silence is unchanged: one frame opens.
 *
 * ⚠ FRAME QUANTISATION (fixed 2026-07-26). The machine sees the mic level once
 * per capture frame — 85.3 ms at 48 kHz / 4096 — so it can only ever place an
 * edge on a frame boundary. `durationMs` spans the FIRST above-bar frame to the
 * LAST, which undercounts the real utterance by exactly one frame: a word
 * occupying N frames measures (N−1) × period, and a one-frame blip measures 0.
 * Against a 120 ms `minVoiceMs` that silently demanded THREE frames (~256 ms) of
 * speech, so single-word answers were rejected as blips while their activityEnd
 * had already gone to Gemini — the judge ruled on turns the client then refused
 * to own (DI sitting 2026-07-26: "five" and "four" measured 89 ms and 81 ms).
 * `voicedMs` adds the closing frame back and is what the gate now reads;
 * `durationMs` is left as the raw inter-edge span it always was.
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
  /** Turns with less than this much VOICED audio are flagged belowMinVoice. */
  minVoiceMs: number;
  /**
   * Duration of one capture frame — the machine's sampling resolution, and so
   * the amount `durationMs` undercuts the real utterance (see the module note).
   * Supplied by the capture service, never guessed.
   *
   * 0 means "unknown", which reproduces the pre-2026-07-26 behaviour exactly:
   * `voicedMs === durationMs`. That is the honest default for a caller that
   * cannot tell us, not a silent stand-in for a typical device.
   */
  framePeriodMs: number;
  /**
   * Voiced audio required before a turn that starts over tutor audio opens.
   * 0 opens on the first frame (the behaviour before 2026-11-15).
   */
  bargeInCommitMs: number;
}

export const DEFAULT_VOICE_TURN_CONFIG: VoiceTurnConfig = {
  // Three 85.3 ms capture frames (256 ms): the third frame over the bar opens.
  bargeInCommitMs: 250,
  silenceThreshold: 0.025,
  bargeInMultiplier: 2,
  hysteresisHoldRatio: 0.6,
  silenceCloseMs: 500,
  // Two capture frames of speech. Unchanged since the bench tuned it in runs
  // 3–4 — what changed is that `voicedMs` now measures what this always meant.
  minVoiceMs: 120,
  framePeriodMs: 0,
};

export interface VoiceTurnState {
  active: boolean;
  /** Sound over tutor audio that has not yet lasted `bargeInCommitMs`. Never true with `active`. */
  pending: boolean;
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
  pending: false,
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
  /** An app sound effect may currently be heard from the speakers (`SoundManager.isAudible`). */
  appAudible?: boolean;
  /** Monotonic timestamp in ms (performance.now()). */
  now: number;
}

export type VoiceTurnEvent =
  /** A turn may be starting over tutor audio. No activityStart yet: hold the outgoing audio. */
  | { kind: 'pending'; at: number }
  /** The pending sound was not speech. Release the held audio; no turn existed. */
  | { kind: 'discard'; at: number }
  /** `at` is when the speech began, which for a deferred turn is before this frame. */
  | { kind: 'open'; at: number; duringTutorAudio: boolean }
  | {
      kind: 'close';
      startedAt: number;
      /** Raw span from the first above-bar frame to the last. Undercounts the
       *  utterance by one frame — prefer `voicedMs` for any judgement. */
      durationMs: number;
      /** `durationMs` plus the closing frame: the speech actually captured. */
      voicedMs: number;
      peak: number;
      duringTutorAudio: boolean;
      belowMinVoice: boolean;
    };

export interface VoiceTurnStep {
  state: VoiceTurnState;
  event: VoiceTurnEvent | null;
}

/** The one place a close event is measured, so the two exits cannot drift. */
const buildClose = (
  state: VoiceTurnState,
  config: VoiceTurnConfig,
): Extract<VoiceTurnEvent, { kind: 'close' }> => {
  const durationMs = Math.max(0, Math.round(state.lastAboveAt - state.startedAt));
  const voicedMs = durationMs + Math.round(config.framePeriodMs);
  return {
    kind: 'close',
    startedAt: state.startedAt,
    durationMs,
    voicedMs,
    peak: state.peak,
    duringTutorAudio: state.duringTutorAudio,
    belowMinVoice: voicedMs < config.minVoiceMs,
  };
};

export function stepVoiceTurn(
  state: VoiceTurnState,
  frame: VoiceFrame,
  config: VoiceTurnConfig,
): VoiceTurnStep {
  const { level, tutorAudible, now } = frame;
  const echoBar = config.silenceThreshold * config.bargeInMultiplier;

  if (state.pending) {
    const peak = Math.max(state.peak, level);
    // The tutor went quiet: this is now an answer into silence, which opens at once.
    if (!tutorAudible && !frame.appAudible && level >= config.silenceThreshold) {
      const next: VoiceTurnState = {
        ...state, active: true, pending: false, lastAboveAt: now, peak,
        duringTutorAudio: false, openBar: config.silenceThreshold,
      };
      return { state: next, event: { kind: 'open', at: state.startedAt, duringTutorAudio: false } };
    }
    if (level >= state.openBar) {
      const voiced = now - state.startedAt + config.framePeriodMs;
      if (voiced >= config.bargeInCommitMs) {
        const next: VoiceTurnState = {
          ...state, active: true, pending: false, lastAboveAt: now, peak, duringTutorAudio: tutorAudible,
        };
        return { state: next, event: { kind: 'open', at: state.startedAt, duringTutorAudio: tutorAudible } };
      }
      return { state: { ...state, lastAboveAt: now, peak }, event: null };
    }
    if (now - state.lastAboveAt > config.bargeInCommitMs) {
      return { state: IDLE_VOICE_TURN, event: { kind: 'discard', at: now } };
    }
    return { state, event: null };
  }

  if (!state.active) {
    const openBar = tutorAudible || frame.appAudible ? echoBar : config.silenceThreshold;
    if (level >= openBar) {
      const next: VoiceTurnState = {
        active: true,
        pending: false,
        startedAt: now,
        lastAboveAt: now,
        peak: level,
        duringTutorAudio: tutorAudible,
        openBar,
      };
      // One frame already covers the commit window when the period is that long.
      if (tutorAudible && config.framePeriodMs < config.bargeInCommitMs) {
        return { state: { ...next, active: false, pending: true }, event: { kind: 'pending', at: now } };
      }
      return { state: next, event: { kind: 'open', at: now, duringTutorAudio: tutorAudible } };
    }
    return { state, event: null };
  }

  // Over a sound effect, only a voice above the echo bar holds the turn.
  const holdFloor = (frame.appAudible ? Math.max(state.openBar, echoBar) : state.openBar) * config.hysteresisHoldRatio;
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
    return { state: IDLE_VOICE_TURN, event: buildClose(state, config) };
  }

  return { state, event: null };
}

export interface VoiceTurnCloseStep {
  state: VoiceTurnState;
  event: Extract<VoiceTurnEvent, { kind: 'close' }> | null;
}

/** Force-close an active turn (stop, disable, unmount). Returns the close
 *  event the consumer should mirror with activityEnd, or null if idle. A
 *  pending turn is dropped with no event: no activityStart was ever sent. */
export function closeVoiceTurn(state: VoiceTurnState, config: VoiceTurnConfig): VoiceTurnCloseStep {
  if (state.pending) return { state: IDLE_VOICE_TURN, event: null };
  if (!state.active) return { state, event: null };
  return { state: IDLE_VOICE_TURN, event: buildClose(state, config) };
}
