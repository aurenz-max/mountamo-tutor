/**
 * judgedLoopModel — pure state machine for the live-judged call-response loop.
 *
 * The capability shape (extracted from the DI bench, runs 1–3 of 2026-07-19/20):
 * a Lumina surface cues the Live tutor to elicit a spoken response; the student
 * answers into an open mic; the Live tutor judges the audio it heard IN-BAND,
 * reporting through canonical sentence openers in its own speech ("Yes," /
 * "My turn." for DI); the client alone decides progression. This module owns
 * the attempt/verdict lifecycle. Progression policy (what advance/retry mean)
 * stays with the consumer.
 *
 * Design rules it encodes, each traced to a live-run failure:
 * - **Voice-anchored attempts (DI-1).** An attempt exists when the LOCAL voice
 *   turn closes — never when Live input transcription arrives. The 2026-07-19
 *   probe run lost a transcript under barge-in: Live affirmed audio it heard,
 *   the bench had nothing to bind the verdict to, dropped it, and desynced
 *   into wrong-item credit. Transcripts now merely ANNOTATE the attempt.
 * - **Sentence-scoped verdict scanning.** The hook-parity run showed a mid-cue
 *   attempt consuming a cue FRAGMENT ("is sam.") as its verdict via prefix
 *   classification. Verdicts are now found by scanning SENTENCE OPENERS in
 *   everything the tutor says after the attempt closes — safe because the
 *   script contract forbids non-verdict sentences from starting with a
 *   sentinel. Off-script is only declared once the tutor has finished a
 *   sentence AND gone quiet without a sentinel (or on timeout).
 * - **Arming (DI-3).** Attempts are only recorded while armed; stray pre-cue
 *   speech ("Good." before the first cue) can no longer become an attempt.
 * - **Resync.** Consecutive misses (off-script / no-verdict) emit a resync
 *   request so the consumer re-cues the current item instead of stalling —
 *   the model and client re-converge on the script.
 */

export interface SentinelPair {
  /** Lowercase token sequences that OPEN an affirmation sentence. */
  affirm: string[][];
  /** Lowercase token sequences that OPEN a correction sentence. */
  correct: string[][];
}

/** The DISTAR pair the DI script uses. */
export const DI_SENTINELS: SentinelPair = {
  affirm: [['yes']],
  correct: [['my', 'turn']],
};

export interface JudgedLoopConfig {
  sentinels: SentinelPair;
  /** Attempt with no verdict after this long → 'no-verdict' miss. */
  verdictTimeoutMs: number;
  /** Consecutive misses (off-script / no-verdict) that trigger a resync. */
  resyncAfterMisses: number;
}

export const DEFAULT_JUDGED_LOOP_CONFIG: JudgedLoopConfig = {
  sentinels: DI_SENTINELS,
  verdictTimeoutMs: 8000,
  resyncAfterMisses: 2,
};

const tokenize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** What a scan of tutor text found. 'pending' = a partial sentinel may still
 *  be completing in the stream; 'none' = no sentinel yet (NOT off-script —
 *  that verdict needs quiet or timeout, the reducer's call). */
export type SentinelScan = 'affirmed' | 'corrected' | 'pending' | 'none';

const matchesOpener = (tokens: string[], opener: string[]): boolean =>
  opener.length <= tokens.length && opener.every((word, i) => tokens[i] === word);

/** A trailing (possibly incomplete) sentence could still become this opener. */
const couldBecomeOpener = (tokens: string[], opener: string[]): boolean => {
  if (tokens.length === 0) return true;
  const bound = Math.min(tokens.length, opener.length);
  for (let i = 0; i < bound - 1; i++) if (tokens[i] !== opener[i]) return false;
  const last = tokens[bound - 1];
  if (tokens.length < opener.length) return opener[bound - 1].startsWith(last) || opener[bound - 1] === last;
  // All opener tokens present: the final one must match exactly (handled by
  // matchesOpener) or be a partial prefix still being streamed.
  return tokens.length === opener.length && opener[bound - 1].startsWith(last);
};

/**
 * Scan accumulated tutor text for a verdict sentence. Sentences are split on
 * terminal punctuation; the (unterminated) tail counts as in-flight.
 */
export function scanForSentinel(text: string, sentinels: SentinelPair): SentinelScan {
  const sentences = text.split(/[.!?]+/);
  const tail = sentences.pop() ?? '';
  for (const sentence of sentences) {
    const tokens = tokenize(sentence);
    if (tokens.length === 0) continue;
    if (sentinels.affirm.some((opener) => matchesOpener(tokens, opener))) return 'affirmed';
    if (sentinels.correct.some((opener) => matchesOpener(tokens, opener))) return 'corrected';
  }
  const tailTokens = tokenize(tail);
  if (tailTokens.length > 0) {
    // A complete opener in the tail is already a verdict even before the
    // sentence's punctuation streams in ("Yes, mmm" arriving unterminated).
    if (sentinels.affirm.some((opener) => matchesOpener(tailTokens, opener))) return 'affirmed';
    if (sentinels.correct.some((opener) => matchesOpener(tailTokens, opener))) return 'corrected';
    const couldStill = [...sentinels.affirm, ...sentinels.correct]
      .some((opener) => couldBecomeOpener(tailTokens, opener));
    if (couldStill) return 'pending';
  }
  return 'none';
}

/** A closed local voice turn — the attempt anchor. */
export interface VoiceTurnRecord {
  openedAt: number;
  closedAt: number;
  durationMs: number;
  peak: number;
  duringTutorAudio: boolean;
}

export interface LoopAttempt {
  turn: VoiceTurnRecord;
  /** Live input transcription, attached if/when it arrives. May stay null —
   *  the attempt is still judged (that is the DI-1 fix). */
  transcript: string | null;
  transcriptAt: number | null;
}

export type LoopJudgment = 'affirmed' | 'corrected' | 'off-script' | 'no-verdict';

export interface JudgedLoopState {
  armed: boolean;
  attempt: LoopAttempt | null;
  /** Tutor text accumulated since the pending attempt closed. */
  verdictText: string;
  /** The tutor completed at least one full sentence since the attempt. */
  sawSentenceSinceAttempt: boolean;
  /** Tutor audio has fallen since the attempt closed (off-script gate). */
  sawQuietSinceAttempt: boolean;
  consecutiveMisses: number;
  /** Last tutor audio-fall; consumed by response-time measurement. */
  lastTutorQuietAt: number | null;
}

export const IDLE_JUDGED_LOOP: JudgedLoopState = {
  armed: false,
  attempt: null,
  verdictText: '',
  sawSentenceSinceAttempt: false,
  sawQuietSinceAttempt: false,
  consecutiveMisses: 0,
  lastTutorQuietAt: null,
};

export type LoopEvent =
  | { type: 'arm' }
  | { type: 'disarm' }
  | { type: 'voice-close'; turn: VoiceTurnRecord }
  | { type: 'transcript'; text: string; at: number }
  | { type: 'tutor-text'; text: string; at: number }
  | { type: 'tutor-quiet'; at: number }
  | { type: 'tick'; at: number };

export type LoopEmission =
  | { kind: 'attempt-open'; attempt: LoopAttempt }
  | { kind: 'attempt-superseded'; attempt: LoopAttempt }
  | {
      kind: 'attempt-transcript';
      attempt: LoopAttempt;
      text: string;
      /** Tutor audio-fall → transcript arrival (the lesson-pacing clock). */
      responseMs: number | null;
      /** Local voice open → transcript arrival ("did Gemini hear me, how late"). */
      commitLagMs: number;
    }
  | { kind: 'phantom-transcript'; text: string; at: number }
  | { kind: 'verdict'; judgment: LoopJudgment; attempt: LoopAttempt; misses: number }
  | { kind: 'unanchored-verdict'; judgment: 'affirmed' | 'corrected' }
  | { kind: 'resync'; misses: number };

export interface JudgedLoopStep {
  state: JudgedLoopState;
  emissions: LoopEmission[];
}

const endsSentence = (text: string) => /[.!?]/.test(text);

export function reduceJudgedLoop(
  state: JudgedLoopState,
  event: LoopEvent,
  config: JudgedLoopConfig,
): JudgedLoopStep {
  const emissions: LoopEmission[] = [];

  switch (event.type) {
    case 'arm':
      return { state: { ...IDLE_JUDGED_LOOP, armed: true, lastTutorQuietAt: state.lastTutorQuietAt }, emissions };

    case 'disarm':
      return { state: { ...IDLE_JUDGED_LOOP, lastTutorQuietAt: state.lastTutorQuietAt }, emissions };

    case 'voice-close': {
      if (!state.armed) return { state, emissions };
      const attempt: LoopAttempt = { turn: event.turn, transcript: null, transcriptAt: null };
      if (state.attempt) emissions.push({ kind: 'attempt-superseded', attempt: state.attempt });
      emissions.push({ kind: 'attempt-open', attempt });
      return {
        state: {
          ...state,
          attempt,
          verdictText: '',
          sawSentenceSinceAttempt: false,
          sawQuietSinceAttempt: false,
        },
        emissions,
      };
    }

    case 'transcript': {
      if (!state.armed) return { state, emissions };
      const attempt = state.attempt;
      if (!attempt) {
        emissions.push({ kind: 'phantom-transcript', text: event.text, at: event.at });
        return { state, emissions };
      }
      const text = attempt.transcript ? `${attempt.transcript} ${event.text}` : event.text;
      const annotated: LoopAttempt = { ...attempt, transcript: text, transcriptAt: attempt.transcriptAt ?? event.at };
      if (attempt.transcript === null) {
        emissions.push({
          kind: 'attempt-transcript',
          attempt: annotated,
          text,
          responseMs: state.lastTutorQuietAt == null
            ? null
            : Math.max(0, Math.round(event.at - state.lastTutorQuietAt)),
          commitLagMs: Math.max(0, Math.round(event.at - attempt.turn.openedAt)),
        });
      }
      return {
        state: { ...state, attempt: annotated, lastTutorQuietAt: null },
        emissions,
      };
    }

    case 'tutor-text': {
      if (!state.armed) return { state, emissions };
      if (!state.attempt) {
        // No attempt to bind to. With voice-anchoring this should be rare
        // (it needs a verdict with no local voice at all) — keep it visible.
        const stray = scanForSentinel(event.text, config.sentinels);
        if (stray === 'affirmed' || stray === 'corrected') {
          emissions.push({ kind: 'unanchored-verdict', judgment: stray });
        }
        return { state, emissions };
      }
      const verdictText = `${state.verdictText} ${event.text}`;
      const scan = scanForSentinel(verdictText, config.sentinels);
      if (scan === 'affirmed' || scan === 'corrected') {
        emissions.push({ kind: 'verdict', judgment: scan, attempt: state.attempt, misses: 0 });
        return {
          state: {
            ...state,
            attempt: null,
            verdictText: '',
            sawSentenceSinceAttempt: false,
            sawQuietSinceAttempt: false,
            consecutiveMisses: 0,
          },
          emissions,
        };
      }
      return {
        state: {
          ...state,
          verdictText,
          sawSentenceSinceAttempt: state.sawSentenceSinceAttempt || endsSentence(event.text),
        },
        emissions,
      };
    }

    case 'tutor-quiet': {
      const base = { ...state, lastTutorQuietAt: event.at };
      if (!state.armed || !state.attempt) return { state: base, emissions };
      // Off-script gate: the tutor spoke at least one complete sentence since
      // the attempt and has now gone quiet without a sentinel. (First quiet
      // after the attempt may just be the tail of the cue the attempt
      // interrupted — require sentence + quiet together.)
      if (state.sawSentenceSinceAttempt) {
        const misses = state.consecutiveMisses + 1;
        emissions.push({ kind: 'verdict', judgment: 'off-script', attempt: state.attempt, misses });
        if (misses >= config.resyncAfterMisses) emissions.push({ kind: 'resync', misses });
        return {
          state: {
            ...base,
            attempt: null,
            verdictText: '',
            sawSentenceSinceAttempt: false,
            sawQuietSinceAttempt: false,
            consecutiveMisses: misses,
          },
          emissions,
        };
      }
      return { state: { ...base, sawQuietSinceAttempt: true }, emissions };
    }

    case 'tick': {
      if (!state.armed || !state.attempt) return { state, emissions };
      if (event.at - state.attempt.turn.closedAt < config.verdictTimeoutMs) return { state, emissions };
      const misses = state.consecutiveMisses + 1;
      emissions.push({ kind: 'verdict', judgment: 'no-verdict', attempt: state.attempt, misses });
      if (misses >= config.resyncAfterMisses) emissions.push({ kind: 'resync', misses });
      return {
        state: {
          ...state,
          attempt: null,
          verdictText: '',
          sawSentenceSinceAttempt: false,
          sawQuietSinceAttempt: false,
          consecutiveMisses: misses,
        },
        emissions,
      };
    }
  }
}
