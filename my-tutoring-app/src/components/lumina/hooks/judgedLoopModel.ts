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
  /**
   * How recently the learner must have left an UNANCHORED trace (a sub-minimum
   * voice blip, or a transcript with no attempt) for a verdict that lands with
   * no attempt to be retro-anchored to it instead of discarded.
   *
   * The safety net for the class of failure the 2026-07-26 sitting exposed: the
   * client brackets a turn for Gemini and then declines to open an attempt for
   * it, so a correct answer is heard, judged, affirmed — and dropped. Bounded by
   * time because the window's whole job is to distinguish "the tutor is judging
   * the thing the learner just said" from "the tutor said a sentinel
   * spontaneously", which is what `unanchored-verdict` still reports.
   */
  retroAnchorWindowMs: number;
}

export const DEFAULT_JUDGED_LOOP_CONFIG: JudgedLoopConfig = {
  sentinels: DI_SENTINELS,
  verdictTimeoutMs: 8000,
  resyncAfterMisses: 2,
  retroAnchorWindowMs: 4000,
};

const tokenize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** Reassembled tutor speech, tidied for quoting. Output transcription arrives
 *  as sub-word chunks that are joined with a space, so the raw accumulation
 *  carries doubled and leading spaces the reducer never needed to care about —
 *  but anything quoted into evidence does. */
export const normalizeSpeech = (value: string) => value.replace(/\s+/g, ' ').trim();

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
  /**
   * What the learner DID that the tutor is about to judge.
   *
   * 'voice'   — a closed local voice turn (DI-1, the founding anchor). The
   *             learner spoke; Gemini heard the audio and judges it in-band.
   * 'gesture' — the learner committed a MANIPULATION (tiles placed, cards
   *             sorted, a build finished). Gemini heard nothing, so the
   *             consumer's cue carries what was done and the tutor speaks the
   *             verdict; the sentinel scan binds it exactly as for voice.
   *
   * WHY THIS EXISTS (2026-08-09, user ruling). Until this field the loop could
   * only anchor an attempt on speech, so every primitive whose answer is a
   * gesture was locked out of the tutor-owned clock and left with a Check
   * button and a `setTimeout`. That was an ENGINE limit; the DI literacy
   * handoff had written it up as pedagogy ("don't voice-ify a manipulative"),
   * which reads as a reason to leave those primitives broken. A child dragging
   * phoneme tiles deserves the same teacher waiting on them as a child saying a
   * word — so the anchor widened rather than the doctrine narrowing.
   */
  source: 'voice' | 'gesture';
  /**
   * The anchoring voice turn. SYNTHETIC for a gesture attempt (`durationMs` 0,
   * `peak` 0, `openedAt === closedAt === ` the commit instant) so the verdict
   * timeout and every existing consumer keep reading one shape — check
   * `source`, not the turn, to tell the two apart.
   */
  turn: VoiceTurnRecord;
  /** Live input transcription, attached if/when it arrives. May stay null —
   *  the attempt is still judged (that is the DI-1 fix). A gesture attempt
   *  normally has none: nothing was spoken. */
  transcript: string | null;
  transcriptAt: number | null;
}

export type LoopJudgment = 'affirmed' | 'corrected' | 'off-script' | 'no-verdict';

/**
 * Evidence that the learner spoke without the loop opening an attempt for it —
 * a sub-minimum voice blip, a transcript arriving with nothing to bind it to, or
 * both for the same utterance. Held only long enough to retro-anchor a verdict
 * that would otherwise be thrown away.
 */
export interface UnanchoredSignal {
  at: number;
  /** The blip's turn record, when a voice turn is what produced the signal. */
  turn: VoiceTurnRecord | null;
  transcript: string | null;
}

export interface JudgedLoopState {
  armed: boolean;
  attempt: LoopAttempt | null;
  /** Most recent learner trace with no attempt behind it. See UnanchoredSignal. */
  unanchoredSignal: UnanchoredSignal | null;
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
  unanchoredSignal: null,
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
  /** A sub-minimum voice turn. No attempt opens — but its activity brackets
   *  already reached Gemini, so it is evidence the learner spoke. */
  | { type: 'voice-blip'; turn: VoiceTurnRecord }
  /**
   * The learner COMMITTED a manipulation and the ask describing it has gone out
   * to the tutor. Opens an attempt exactly as `voice-close` does, so the verdict
   * binds through the same sentinel scan.
   *
   * The consumer dispatches this at CUE-SEND time, not at commit time
   * (`useJudgedSpeechLoop.submitGestureAttempt` does it for you): the cue may
   * wait for the tutor to stop talking, and an attempt opened before its own ask
   * went out would burn `verdictTimeoutMs` on that wait — and would block the
   * very cue it is waiting for (`schedulePendingCue` refuses to send under an
   * open attempt).
   */
  | { type: 'gesture-close'; at: number }
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
  | {
      kind: 'verdict';
      judgment: LoopJudgment;
      attempt: LoopAttempt;
      misses: number;
      /**
       * The attempt was reconstructed from an UNANCHORED trace (a sub-minimum
       * blip and/or a transcript with nothing to bind it to) rather than from a
       * voice turn the loop accepted. The judgment is the tutor's own and is
       * acted on normally; this flag exists so a run log can distinguish a clean
       * loop from one running on the safety net — a run with these in it has a
       * turn-detection problem even though nothing was lost.
       */
      retroAnchored?: boolean;
      /**
       * The tutor's OWN judging sentence(s), verbatim — everything it said
       * between the attempt closing and the sentinel that classified it.
       *
       * Present only for 'affirmed' | 'corrected', because only those are a
       * judgment: 'off-script' means the tutor did not judge (the accumulated
       * text is unclassified chatter) and 'no-verdict' means it said nothing
       * at all. Keeping the field to the judging branches is what lets a
       * consumer ship it straight into `DiagnosisEvidence.judgeFeedback`
       * (Misconception Loop Tier A) without laundering noise into evidence.
       *
       * Since the 2026-07-25 contrastive-correction ruling a correction NAMES
       * the error ("My turn: not one — two plus one is three."), so this
       * string is the diagnosis the judge already articulated. Additive and
       * optional: consumers that only need `judgment` are unaffected.
       *
       * ⚠ This is what the tutor had said AT CLASSIFICATION TIME, which is
       * usually a fragment. Output transcription streams in sub-word chunks
       * (hence `couldBecomeOpener` below), and the verdict deliberately fires
       * on the chunk that completes the sentinel so progression is not
       * delayed — so this is often just "My turn". The part that NAMES the
       * error arrives afterwards: see the 'verdict-text' emission.
       */
      verdictText?: string;
    }
  | {
      /**
       * The tutor's judging line, COMPLETE — emitted once that line has
       * finished streaming (its audio fell, or the learner answered over it).
       *
       * Produced by `useJudgedSpeechLoop`, not by the reducer: only the
       * runtime knows when a turn is over. It lives in this union so a
       * consumer's `switch (emission.kind)` stays exhaustive over one type.
       *
       * WHY IT EXISTS. `verdict.verdictText` is truncated at the sentinel by
       * construction, and for a contrastive correction the sentinel is the
       * one part that carries no diagnosis ("My turn:" — not what was wrong).
       * Everything downstream of it does: "not one — two plus one is three."
       * A consumer building Misconception-Loop evidence logs the miss at the
       * verdict and upgrades its `judgeFeedback` here.
       */
      kind: 'verdict-text';
      judgment: 'affirmed' | 'corrected';
      text: string;
    }
  | { kind: 'unanchored-verdict'; judgment: 'affirmed' | 'corrected' }
  | {
      /**
       * A real voice turn closed while the run was LIVE but the loop was not
       * armed. The learner is answering into a surface that cannot record
       * attempts: no attempt opens, no verdict binds, and the pack sits on its
       * item forever while the tutor keeps talking.
       *
       * Hook-produced, like 'session-resumed' and 'session-dead' — the reducer
       * stays inert when disarmed (DI-3), and only the runtime knows whether a
       * run is in progress or the loop is simply idle between runs.
       *
       * WHY IT EXISTS (2026-08-06). A whole lesson run failed exactly this way
       * and left no trace: 9 voice turns above the bar, `attempts: 0`, and
       * every counter in the run log reading precisely as if the child had
       * never spoken. Consumers treat it as a defect signal, not a pedagogical
       * event: log it and re-arm. It should never fire now that disabling
       * disarms on the falling edge only — one in a run log is a bug to chase.
       */
      kind: 'loop-deaf';
      turn: VoiceTurnRecord;
    }
  | { kind: 'resync'; misses: number }
  | {
      /**
       * The Live session was RESUMED — a transparent server-side Gemini resume
       * (GoAway / drop) or a warm client-socket reconnect; both end in the
       * server's `session_resumed` message, surfaced by the context as
       * `sessionResumeCount`. Produced by `useJudgedSpeechLoop`, never by the
       * reducer; it lives in this union so a consumer's switch stays
       * exhaustive over one type.
       *
       * WHY IT EXISTS (DI BACKLOG item 5, suspect (a)). A resume restores the
       * CONVERSATION but not the item in flight: the verdict pending when the
       * old connection died is gone, and nothing re-elicits the item — the
       * child keeps answering into a session that will never judge them. The
       * engine stays pedagogy-free — it does NOT resend cue text; the consumer
       * re-cues its current item (packs share this with their 'resync'
       * branch). Because a re-cued [DI_ITEM] carries the full item contract,
       * this also makes the backend's COLD retry (conversation history lost)
       * safe for DI.
       */
      kind: 'session-resumed';
    }
  | {
      /**
       * Consecutive cues went out and the tutor NEVER made a sound — no audio
       * rise and no output transcription within CUE_DEAD_MS of each send. The
       * session behind the socket is dead (a mid-attempt GoAway whose resume
       * restored nothing, or a wedged generation): re-cueing into it is not
       * recovery. Detection is cue→tutor-AUDIO liveness, never cue→verdict —
       * child think-time is unbounded (35.9s observed benign) and must never
       * trip this.
       *
       * Hook-produced (only the runtime owns the clocks). Consumers respond by
       * reconnecting the transport (ctx.reconnect(), warm via the stashed
       * handle); the session_resumed that follows converges on
       * 'session-resumed' → re-cue. If the silence continues, another emission
       * follows after each further SESSION_DEAD_CUES × CUE_DEAD_MS, so a
       * failed recovery surfaces as a second emission — packs escalate to a
       * visible recovery card, never a silent "Listening…".
       */
      kind: 'session-dead';
      deadCues: number;
    };

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
      // Inert when disarmed (DI-3) — the deaf-loop signal this state produces is
      // raised by useJudgedSpeechLoop, which alone knows a run is live.
      if (!state.armed) return { state, emissions };
      const attempt: LoopAttempt = { source: 'voice', turn: event.turn, transcript: null, transcriptAt: null };
      if (state.attempt) emissions.push({ kind: 'attempt-superseded', attempt: state.attempt });
      emissions.push({ kind: 'attempt-open', attempt });
      return {
        state: {
          ...state,
          attempt,
          // A real attempt supersedes any unanchored trace: whatever the blip
          // was, this turn is what the tutor will be judging.
          unanchoredSignal: null,
          verdictText: '',
          sawSentenceSinceAttempt: false,
          sawQuietSinceAttempt: false,
        },
        emissions,
      };
    }

    case 'gesture-close': {
      // Same shape as `voice-close`, one deliberate difference: a gesture
      // NEVER supersedes an open attempt. A voice turn may (the learner spoke
      // twice); a manipulation landing while speech is awaiting judgment is the
      // learner fiddling with tiles mid-verdict, and cancelling the judgment
      // they are waiting on would strand it.
      if (!state.armed || state.attempt) return { state, emissions };
      const attempt: LoopAttempt = {
        source: 'gesture',
        turn: { openedAt: event.at, closedAt: event.at, durationMs: 0, peak: 0, duringTutorAudio: false },
        transcript: null,
        transcriptAt: null,
      };
      emissions.push({ kind: 'attempt-open', attempt });
      return {
        state: {
          ...state,
          attempt,
          unanchoredSignal: null,
          verdictText: '',
          sawSentenceSinceAttempt: false,
          sawQuietSinceAttempt: false,
        },
        emissions,
      };
    }

    case 'voice-blip': {
      // Deliberately opens NO attempt — the turn was below the voice bar and
      // may be noise. But activityEnd went to Gemini regardless, so if a verdict
      // arrives with nothing anchored, this is what it was judging.
      if (!state.armed || state.attempt) return { state, emissions };
      return {
        state: {
          ...state,
          unanchoredSignal: { at: event.turn.closedAt, turn: event.turn, transcript: null },
        },
        emissions,
      };
    }

    case 'transcript': {
      if (!state.armed) return { state, emissions };
      const attempt = state.attempt;
      if (!attempt) {
        // Gemini heard the learner and the loop has nothing to bind it to. Still
        // reported as a phantom (it IS one), but kept as the strongest possible
        // retro-anchor: it carries the learner's actual words.
        emissions.push({ kind: 'phantom-transcript', text: event.text, at: event.at });
        return {
          state: {
            ...state,
            unanchoredSignal: {
              at: event.at,
              turn: state.unanchoredSignal?.turn ?? null,
              transcript: event.text,
            },
          },
          emissions,
        };
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
        const stray = scanForSentinel(event.text, config.sentinels);
        if (stray !== 'affirmed' && stray !== 'corrected') return { state, emissions };
        // The tutor judged something. If the learner left a trace we declined to
        // anchor — a sub-minimum blip, a transcript with no attempt — this
        // verdict is ABOUT that trace, and dropping it loses a real answer the
        // tutor already affirmed (the 2026-07-26 stall). Rebuild the attempt and
        // let progression run; the flag marks that it came off the safety net.
        const signal = state.unanchoredSignal;
        if (signal && event.at - signal.at <= config.retroAnchorWindowMs) {
          const retro: LoopAttempt = {
            // Retro-anchoring only ever reconstructs SPEECH — a sub-minimum
            // blip or a transcript. A gesture leaves no unanchored trace
            // (nothing reaches Gemini but the cue we sent ourselves).
            source: 'voice',
            turn: signal.turn ?? {
              openedAt: signal.at, closedAt: signal.at, durationMs: 0, peak: 0, duringTutorAudio: false,
            },
            transcript: signal.transcript,
            transcriptAt: signal.transcript == null ? null : signal.at,
          };
          emissions.push({
            kind: 'verdict',
            judgment: stray,
            attempt: retro,
            misses: 0,
            verdictText: normalizeSpeech(event.text),
            retroAnchored: true,
          });
          return {
            state: {
              ...state,
              unanchoredSignal: null,
              verdictText: '',
              sawSentenceSinceAttempt: false,
              sawQuietSinceAttempt: false,
              consecutiveMisses: 0,
            },
            emissions,
          };
        }
        // Nothing to bind it to at all — the tutor spoke a sentinel on its own.
        emissions.push({ kind: 'unanchored-verdict', judgment: stray });
        return { state, emissions };
      }
      const verdictText = `${state.verdictText} ${event.text}`;
      const scan = scanForSentinel(verdictText, config.sentinels);
      if (scan === 'affirmed' || scan === 'corrected') {
        // Ship the sentence, not just the classification. The reducer already
        // has it; dropping it is what forced consumers to guess at WHY the
        // tutor corrected (Misconception Loop Tier B) instead of quoting the
        // judge that already said so (Tier A). Whitespace is collapsed because
        // the accumulator seeds from '' and joins fragments with a space that
        // the fragments often already carry — and this string is quoted
        // verbatim into evidence.
        emissions.push({
          kind: 'verdict',
          judgment: scan,
          attempt: state.attempt,
          misses: 0,
          verdictText: normalizeSpeech(verdictText),
        });
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
