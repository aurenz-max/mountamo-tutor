'use client';

/**
 * DiSentenceReading — DI family primitive #4, and the family's first CONNECTED
 * TEXT pack. Live-judged call-response sentence reading: the Live tutor MODELS
 * a printed sentence fluently ("Listen: The cat sat."), reads it TOGETHER with
 * the learner, then TESTS ("Your turn. Read it.") and judges the audio it heard
 * in-band — every word, in order. The learner SEES the printed sentence and
 * READS it aloud into an open mic; the judged-loop engine anchors each attempt
 * to the local voice turn and reads the tutor's verdict from its sentinel
 * opener.
 *
 * The Live tutor IS the interaction surface (living-simulation doctrine) — the
 * committed engine (useJudgedSpeechLoop → judgedLoopModel + useLiveVoiceTurns)
 * owns the loop mechanics; this component owns DI progression (advance / retry
 * / move-on after capped corrections), the kid-facing printed-sentence stage,
 * and evaluation. Sentences are generator-scoped to the objective; the script
 * and judging contract are hand-authored and bench-proven
 * (diSentenceReadingScript — standing gate 1 PASSED 2026-07-25). Separate
 * content pack: the letter-sounds, word-reading, and math-facts files are
 * frozen and untouched.
 *
 * WHY THIS PACK EXISTS: `read-aloud-studio` already owns G1-6 read-aloud, and
 * its own catalog says "Student self-assessment only, no AI speech grading" —
 * it has a mic, records, tracks WPM, and judges nothing, so it produces no
 * evidence the IRT model can use. A beginning reader cannot self-assess their
 * own accuracy. This pack takes judged short-sentence accuracy at G1-2; the
 * fork (never a conversion) keeps read-aloud-studio's calibrated eval modes
 * meaning what they already mean.
 *
 * VOICE TURN LENGTH — the one engineering result the bench sitting forced
 * (finding 2, ship-blocking): a child reading connected text PAUSES
 * mid-sentence, and the family default `silenceCloseMs: 500` (tuned for
 * one-word answers) split one read into TWO voice turns three times in ten
 * items. That broke the alias cross-check and nulled `responseMs` on second
 * fragments. This pack passes ~1100ms; a mid-sentence pause is part of the
 * response, not the end of it. The family default is deliberately NOT changed —
 * 500ms is correct for the three short-response packs.
 *
 * ANSWER-LEAK RULE (inherited from di-word-reading): decoding print IS the
 * skill, so the stage shows the PRINTED SENTENCE ONLY — no picture, emoji, or
 * hint before the read. The reward emoji renders only after an affirmed read.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaBadge,
  LuminaChallengeCounter,
  LuminaMicListener,
  motion,
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { PrimitiveEvaluationResult } from '../../../evaluation/types';
import type { DiSentenceReadingMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { useJudgedSpeechLoop } from '../../../hooks/useJudgedSpeechLoop';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
import {
  flushDiRunLog,
  logDiCue,
  logDiEmission,
  logDiStage,
  logDiTutorText,
  logDiVoiceClose,
  startDiRunLog,
} from './diRunLog';
import { mintRunId, setClientRunId } from '../../../service/clientRunId';
import {
  completeCue,
  itemCue,
  moveOnCue,
  type DiSentenceReadingChallenge,
  type DiSentenceReadingChallengeType,
} from './diSentenceReadingScript';
import {
  buildDiDiagnosisEvidence,
  completeLatestJudgeFeedback,
  pushFailedVerdict,
  type DiFailedVerdict,
} from './diDiagnosisEvidence';
import { DiStallCard } from './DiStallCard';
import { useDiStallRecovery } from './useDiStallRecovery';
import { useDiPostRunDisconnect } from './useDiPostRunDisconnect';

export type {
  DiSentenceReadingChallenge,
  DiSentenceReadingChallengeType,
} from './diSentenceReadingScript';

export interface DiSentenceReadingData {
  title: string;
  description: string;
  /** 3-6 printed sentences. REQUIRED. Built by the menu-scoped generator. */
  challenges: DiSentenceReadingChallenge[];
  /** Session core task identity — the resolved/primary eval-mode skill. */
  challengeType: DiSentenceReadingChallengeType;
  /** Flat "The cat sat. | I see a pig." item-set summary, attached by the
   *  generator for the tutoring scaffold's RUNTIME STATE (catalog contextKey
   *  `sentences`). Unlike the sibling packs there is nothing to withhold here —
   *  the printed sentence is both stimulus and target, and is already on the
   *  child's screen. */
  sentences?: string;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiSentenceReadingMetrics>) => void;
}

/** Corrections the tutor may run on one sentence before the lesson moves on
 *  anyway. Per-turn judging is strict; a hard sentence resurfaces through
 *  distributed review, not by drilling a discouraged reader in place. */
const MAX_CORRECTIONS_PER_ITEM = 2;

/** Manual voice-activity mode: the engine's amplitude detector brackets every
 *  learner turn (Gemini's speech-likeness VAD is unusable for these responses —
 *  bench run-3 ruling). Resolved from the catalog on both connect paths; passed
 *  here for the standalone fallback. */
const DI_AUDIO_INPUT = { manual_activity: true };

/**
 * Silence that closes a learner voice turn, for CONNECTED TEXT (bench sitting
 * 2026-07-25, finding 2 — the pack's ship-blocking fix). The family default is
 * 500ms, tuned for one-word answers; a child reading a sentence pauses between
 * words and that pause is part of ONE response. Three of ten probe items split
 * into two turns at 500ms, which broke the alias cross-check and lost timing on
 * the second fragment. Pack-level only — the engine default is untouched.
 */
const SENTENCE_SILENCE_CLOSE_MS = 1100;

/** Floor for the affirmed-sentence beat — a read sentence stays marked on
 *  screen this long even if the tutor's audio ends early, so the child always
 *  sees their read land. Ceiling releases the stage if the edge never arrives.
 *  Matters MORE here than for facts: the affirm restates the WHOLE sentence. */
const REWARD_BEAT_MIN_MS = 900;
const REWARD_BEAT_MAX_MS = 3500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One resolved sentence outcome, accumulated synchronously for metrics. */
interface ItemOutcome {
  id: string;
  correct: boolean;
  attempts: number;
  score: number;
  /** Silent latency signal: tutor-audio-fall → learner attempt (ms). */
  responseMs: number | null;
  /** Sentence length actually read — the pack's difficulty axis. */
  wordCount: number;
}

const scoreForCorrections = (corrections: number): number =>
  corrections <= 0 ? 100 : corrections === 1 ? 67 : 33;

/** Print size for a beginning reader: as large as the sentence allows without
 *  wrapping into a wall. Length is the only variable that matters here. */
const sentenceSizeClass = (wordCount: number): string =>
  wordCount <= 4 ? 'text-5xl' : wordCount <= 6 ? 'text-4xl' : 'text-3xl';

/**
 * Misconception Loop S1 — how each task identity is NAMED to the distiller.
 *
 * The pack is primitive-scoped, so one misconception is stored per student
 * across all four modes. That tension is MILDER here than in di-math-facts:
 * every mode is "read this printed sentence aloud", so a diagnosis about how
 * this reader decodes genuinely does transfer. Naming the identity anyway
 * keeps the distilled sentence honest about what was actually observed —
 * failing a sight-word sentence and failing a fully decodable one are
 * different findings even when both transfer.
 */
const TASK_PHRASE: Record<DiSentenceReadingChallengeType, string> = {
  decodable_sentence: 'reading a sentence whose every content word is sound-it-out decodable (blending carried into connected text)',
  read_sentence: 'reading a printed short sentence aloud — every word, in order',
  sentence_review: 're-reading sentences of the kind already taught, drawn as a mixed review set',
  sight_phrase_sentence: 'reading a sentence dense in IRREGULAR high-frequency (sight) words that cannot be sounded out',
};

const challengeSummaryFor = (item: DiSentenceReadingChallenge): string =>
  `Direct Instruction sentence reading — ${TASK_PHRASE[item.challengeType]}. `
  + `The ${item.wordCount}-word sentence "${item.text}" was printed on screen. `
  + 'The learner READS it aloud; the tutor judges the audio word by word — a '
  + 'skipped, added, or swapped word is a miss however small the word.';

const expectedFor = (item: DiSentenceReadingChallenge): string =>
  `Read the sentence aloud accurately, every word in order: "${item.text}".`;

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — the generated data arrives as ONE `data`
 *  prop (evaluation props merged in), never spread across props. */
export const DiSentenceReading: React.FC<{ data: DiSentenceReadingData; index?: number }> = ({ data }) => {
  const ctx = useLuminaAIContext();

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-sentence-reading-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  /** RUNTIME STATE contextKey `sentences` — the generator's flat summary,
   *  derived here as a fallback so the tutor never reads "(not set)" for a
   *  session built before the field existed. */
  const sentencesSummary = useMemo(
    () => data.sentences || data.challenges.map((c) => c.text).join(' | '),
    [data.sentences, data.challenges],
  );

  const {
    currentIndex,
    results: challengeResults,
    isComplete,
    recordResult,
    advance,
  } = useChallengeProgress<DiSentenceReadingChallenge>({
    challenges: data.challenges,
    getChallengeId: (ch) => ch.id,
  });

  const currentChallenge = data.challenges[currentIndex] ?? null;

  const evaluation = usePrimitiveEvaluation<DiSentenceReadingMetrics>({
    primitiveType: 'di-sentence-reading',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    componentIntent: data.componentIntent,
    objectiveText: data.objectiveText,
    onSubmit: data.onEvaluationSubmit,
  });

  // ── Runtime state ────────────────────────────────────────────────
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'ready' | 'listening' | 'judging' | 'affirmed' | 'done'>('idle');
  const [statusLine, setStatusLine] = useState('Tap the microphone to start.');
  /** The sentence JUST affirmed, VALUE-CAPTURED at verdict time (never derived
   *  from currentChallenge — that read would print the NEXT sentence while the
   *  tutor is still restating the last one). During the beat it REPLACES the
   *  stage sentence rather than stacking a second one under it. */
  const [reward, setReward] = useState<{ text: string; wordCount: number; emoji?: string } | null>(null);

  // Progression authority is useChallengeProgress; mirror the index into a ref
  // so the emission handler (fires inside the loop's dispatch) reads it live.
  const idxRef = useRef(0);
  idxRef.current = currentIndex;
  const correctionsRef = useRef(new Map<string, number>());
  const outcomesRef = useRef<ItemOutcome[]>([]);
  const lastResponseMsRef = useRef<number | null>(null);
  /** What the child read aloud on the OPEN attempt — the engine emits it on
   *  `attempt-transcript` and every DI pack used to drop it. Cleared at
   *  `attempt-open` so a missing transcript can never inherit the last one. */
  const lastHeardRef = useRef<string | null>(null);
  /** Misconception Loop S1 — judge-backed misses, bounded. DATA only, never
   *  student-visible: in this family a stray write to a status line would be
   *  spoken aloud by the tutor. */
  const failedVerdictsRef = useRef<DiFailedVerdict[]>([]);
  /** A miss is logged at verdict time holding only the sentinel opener;
   *  this marks it as awaiting the complete line from `verdict-text`. */
  const awaitingJudgeTextRef = useRef(false);
  const submittedRef = useRef(false);
  const weConnectedRef = useRef(false);
  const connectedRef = useRef(ctx.isConnected);
  const listeningRef = useRef(ctx.isListening);
  connectedRef.current = ctx.isConnected;
  listeningRef.current = ctx.isListening;

  const currentOf = useCallback(
    () => data.challenges[idxRef.current] ?? null,
    [data.challenges],
  );

  // ── Session-liveness recovery (BACKLOG item 5) ───────────────────
  // The engine detects a dead session (cues out, tutor silent) and emits
  // session-dead; this hook reconnects warm and, when recovery fails, flips
  // `stalled` so the stage renders DiStallCard instead of a silent Listening….
  const {
    stalled,
    noteDead: noteSessionDead,
    noteResumed: noteSessionResumed,
    retry: retryStall,
    reset: resetStall,
  } = useDiStallRecovery({
    running,
    currentItemId: () => currentOf()?.id ?? null,
    onStatus: setStatusLine,
  });

  // (iii-a) Standalone tester path: close the session once the run is truly
  // over (recap sent + played), removing the post-run GoAway-flap trigger.
  const postRun = useDiPostRunDisconnect({ done: phase === 'done', weConnectedRef });

  // ── The reward beat ──────────────────────────────────────────────
  // A resolved sentence does NOT advance the stage on the spot. The child
  // reads, the tutor restates the whole sentence back, the read sentence is
  // marked in place, and only THEN does the next one appear. Advancing at
  // verdict time would put the next sentence on screen while the tutor is
  // still saying the last one — two sentences at once, overload for a
  // beginning reader (the fix di-math-facts made after a browser check).
  //
  // The swap is edge-driven, not timed: the engine sends the next [DI_ITEM]
  // cue 400ms after the tutor's audio falls (VERIFY_BEAT_MS), so that falling
  // edge is the exact moment the tutor stops talking about THIS sentence. The
  // timers below are only a floor and a failsafe, never the primary clock.
  const pendingAdvanceRef = useRef(false);
  const rewardStartedAtRef = useRef(0);
  const advanceTimerRef = useRef<number | null>(null);
  const tutorAudioRef = useRef(ctx.isAudioPlaying);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  /** End the reward beat and move the stage to the next sentence. Idempotent. */
  const commitAdvance = useCallback(() => {
    if (!pendingAdvanceRef.current) return;
    pendingAdvanceRef.current = false;
    clearAdvanceTimer();
    // Bump the index ref with the state, not a render later: emissions fire
    // inside the loop's dispatch, so a verdict landing before React re-renders
    // would otherwise resolve against the sentence we just left.
    idxRef.current = Math.min(idxRef.current + 1, data.challenges.length - 1);
    setReward(null);
    setPhase('listening');
    setStatusLine('Listen, then read it.');
    advance();
  }, [advance, clearAdvanceTimer, data.challenges.length]);

  /** Hold the read sentence on screen; the audio-fall edge (or cap) releases it. */
  const scheduleAdvance = useCallback(() => {
    pendingAdvanceRef.current = true;
    rewardStartedAtRef.current = performance.now();
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      commitAdvance();
    }, REWARD_BEAT_MAX_MS);
  }, [clearAdvanceTimer, commitAdvance]);

  // The release edge: the tutor's line about THIS sentence finished. Held to a
  // floor so a clipped affirmation can't flash the marked sentence past the
  // child. The restating affirm is long here, so the edge usually wins.
  useEffect(() => {
    const wasPlaying = tutorAudioRef.current;
    tutorAudioRef.current = ctx.isAudioPlaying;
    if (!wasPlaying || ctx.isAudioPlaying) return;
    if (!pendingAdvanceRef.current) return;
    const shown = performance.now() - rewardStartedAtRef.current;
    if (shown >= REWARD_BEAT_MIN_MS) {
      commitAdvance();
      return;
    }
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      commitAdvance();
    }, REWARD_BEAT_MIN_MS - shown);
  }, [ctx.isAudioPlaying, clearAdvanceTimer, commitAdvance]);

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer]);

  const finishAndSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    pendingAdvanceRef.current = false;
    clearAdvanceTimer();
    const outcomes = outcomesRef.current;
    const correctCount = outcomes.filter((o) => o.correct).length;
    const firstTryCount = outcomes.filter((o) => o.correct && o.attempts === 1).length;
    const attemptsCount = outcomes.reduce((sum, o) => sum + o.attempts, 0);
    const overallAccuracy = outcomes.length
      ? Math.round(outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length)
      : 0;
    // Silent latency signal (no-timer ruling): time from the tutor's prompt to
    // the learner starting to read. L0 NEVER judges it — the judging contract
    // explicitly refuses to penalise slowness — but hesitation-to-start is real
    // reading signal and a later pace/fluency mode would need it.
    const timed = outcomes.filter((o) => o.responseMs != null) as Array<ItemOutcome & { responseMs: number }>;
    const meanResponseMs = timed.length
      ? Math.round(timed.reduce((sum, o) => sum + o.responseMs, 0) / timed.length)
      : null;
    // The set's actual difficulty: a 4-word set and an 8-word set are not the
    // same task, and sentence length is exactly the axis /add-structural-
    // difficulty will modulate. Without it the metrics cannot tell them apart.
    const meanSentenceWords = outcomes.length
      ? Math.round((outcomes.reduce((sum, o) => sum + o.wordCount, 0) / outcomes.length) * 10) / 10
      : 0;
    const metrics: DiSentenceReadingMetrics = {
      type: 'di-sentence-reading',
      challengeType: data.challengeType,
      evalMode: data.challengeType,
      totalChallenges: data.challenges.length,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: 0,
      overallAccuracy,
      averageAttemptsPerChallenge: outcomes.length
        ? Math.round((attemptsCount / outcomes.length) * 10) / 10
        : 0,
      meanResponseMs,
      meanSentenceWords,
    };
    // Misconception Loop S1 — the packet, on diagnosable sessions only. The
    // threshold mirrors `captureMisconception`'s OWN failure gate
    // (`success === false || score < 60`) rather than this pack's success bar
    // of 50, so evidence exists exactly when the loop would use it.
    const diagnosisEvidence = overallAccuracy < 60
      ? buildDiDiagnosisEvidence(failedVerdictsRef.current)
      : undefined;
    evaluation.submitResult(
      overallAccuracy >= 50,
      overallAccuracy,
      metrics,
      { outcomes },
      undefined,
      diagnosisEvidence,
    );
    setRunning(false);
    setPhase('done');
    setStatusLine('Great reading today!');
    // Diagnosis telemetry: mark run end and upload the run log so the artifact
    // exists without a human Copy click. Fire-and-forget — never gates the UI.
    logDiStage('run-end', 'run complete — submitting + flushing run log');
    void flushDiRunLog('run-end');
    // The [DI_COMPLETE] cue and its audio land seconds after submit; re-flush
    // once so the artifact carries the tail (deduped away if nothing changed —
    // the smoke run's spurious cuesStalled:1 was this truncation).
    setTimeout(() => void flushDiRunLog('run-end-tail'), 6000);
  }, [clearAdvanceTimer, data.challenges.length, data.challengeType, evaluation]);

  // ── DI progression over an engine verdict ────────────────────────
  const loopRef = useRef<ReturnType<typeof useJudgedSpeechLoop> | null>(null);

  const applyVerdict = useCallback(
    (judgment: 'affirmed' | 'corrected' | 'off-script', verdictText?: string) => {
      const item = currentOf();
      const loop = loopRef.current;
      if (!item || !loop) return;

      if (judgment === 'off-script') {
        // Neither branch — the engine will resync/re-cue. Keep listening.
        return;
      }

      const prevCorrections = correctionsRef.current.get(item.id) ?? 0;

      if (judgment === 'corrected') {
        const used = prevCorrections + 1;
        correctionsRef.current.set(item.id, used);
        // Misconception Loop S1 — log EVERY correction, not just the capped
        // one. The #54 live run's reader repeated the SAME substitution three
        // times on one sentence; that repeat is precisely the `priorAttempts`
        // consistency signal, and it only exists if every retry is logged.
        failedVerdictsRef.current = pushFailedVerdict(failedVerdictsRef.current, {
          challenge: challengeSummaryFor(item),
          expected: expectedFor(item),
          heard: lastHeardRef.current,
          judgeFeedback: verdictText ?? '',
        });
        awaitingJudgeTextRef.current = true;
        if (used <= MAX_CORRECTIONS_PER_ITEM) {
          // The tutor's correction line already re-modeled the whole sentence
          // and re-elicited in-band; just reflect it and keep listening.
          setPhase('listening');
          setStatusLine('Let’s read that one again.');
          return;
        }
        // Corrections capped — record a miss and move the lesson forward.
        // Flagged in the run log: [DI_MOVE_ON] had never fired in ANY pack live
        // before the sustained-miss sitting, so this is a first-observation path.
        logDiStage(
          'move-on',
          `correction cap (${MAX_CORRECTIONS_PER_ITEM}) reached — moving on`,
          { itemId: item.id, itemDisplay: item.text },
          'move-on',
        );
        outcomesRef.current.push({
          id: item.id, correct: false, attempts: used, score: 0,
          responseMs: lastResponseMsRef.current, wordCount: item.wordCount,
        });
        recordResult({ challengeId: item.id, correct: false, attempts: used, score: 0 });
        const next = data.challenges[idxRef.current + 1] ?? null;
        lastResponseMsRef.current = null;
        if (next) {
          setStatusLine('Good try. Let’s keep going.');
          loop.queueCue(moveOnCue(item, next));
          // No reward to show, but the stage still holds: the move-on cue
          // CONTAINS the next sentence's model line, so the swap belongs at the
          // same audio edge, not before "Good try" has been said.
          scheduleAdvance();
        } else {
          loop.queueCue(moveOnCue(item));
          finishAndSubmit();
        }
        return;
      }

      // affirmed
      const attempts = prevCorrections + 1;
      const score = scoreForCorrections(prevCorrections);
      outcomesRef.current.push({
        id: item.id, correct: true, attempts, score,
        responseMs: lastResponseMsRef.current, wordCount: item.wordCount,
      });
      recordResult({ challengeId: item.id, correct: true, attempts, score });
      lastResponseMsRef.current = null;
      setPhase('affirmed');
      // Post-read reward only — nothing pictures the sentence before it is read.
      setReward({ text: item.text, wordCount: item.wordCount, emoji: item.emoji });
      const next = data.challenges[idxRef.current + 1] ?? null;
      if (next) {
        setStatusLine('Yes! Nice reading.');
        loop.queueCue(itemCue(next));
        scheduleAdvance();
      } else {
        setStatusLine('You did it!');
        loop.queueCue(completeCue());
        finishAndSubmit();
      }
    },
    [currentOf, data.challenges, finishAndSubmit, recordResult, scheduleAdvance],
  );

  /** Item context for the run log. Diagnostics only. */
  const logCtx = useCallback(() => {
    const item = currentOf();
    return { itemId: item?.id, itemDisplay: item?.text };
  }, [currentOf]);

  const handleEmission = useCallback(
    (emission: LoopEmission) => {
      // Run log FIRST, before the switch — so the three kinds this pack
      // deliberately ignores for progression (attempt-superseded,
      // phantom-transcript, unanchored-verdict) are still recorded on their way
      // to `default: return`. For THIS pack attempt-superseded matters most: it
      // is the mid-sentence-pause split that `silenceCloseMs: 1100` exists to
      // prevent, and the run log is where its numeric proof now lives.
      logDiEmission(emission, logCtx());

      switch (emission.kind) {
        case 'attempt-open':
          // The child got ahead of the beat — flush it FIRST so a read sentence
          // can never be up while they are already reading the next one.
          commitAdvance();
          // A fresh attempt has no transcript yet; stale text would be
          // attributed to the wrong read in the evidence packet.
          lastHeardRef.current = null;
          awaitingJudgeTextRef.current = false;
          setPhase('judging');
          setStatusLine('Listening…');
          setReward(null);
          return;
        case 'attempt-transcript':
          lastResponseMsRef.current = emission.responseMs;
          // What the CHILD read. Kept, not dropped — the misread words are
          // half the misconception evidence.
          lastHeardRef.current = emission.text;
          return;
        case 'verdict':
          if (emission.judgment === 'no-verdict') {
            setStatusLine('One more time—read it for me.');
            return;
          }
          // …and what the TUTOR said about it. Nothing on this path is ever
          // rendered or spoken; it goes to the distiller only.
          applyVerdict(emission.judgment, emission.verdictText);
          return;
        case 'verdict-text': {
          // The tutor's judging line finished streaming. A verdict fires on the
          // chunk that completes the sentinel ("My turn"), which for a
          // contrastive correction is the one part carrying NO diagnosis —
          // "not four — three minus one is two" arrives after it. Upgrade the
          // miss logged at verdict time from that opener to the whole sentence.
          if (emission.judgment === 'corrected' && awaitingJudgeTextRef.current) {
            awaitingJudgeTextRef.current = false;
            failedVerdictsRef.current = completeLatestJudgeFeedback(
              failedVerdictsRef.current,
              emission.text,
            );
          }
          return;
        }
        case 'session-resumed':
        case 'resync': {
          // A resume restored the SESSION but not the item in flight — the
          // pending verdict died with the old connection (item 5 suspect (a)).
          // Recover exactly like a resync: re-cue the current item verbatim.
          if (emission.kind === 'session-resumed') noteSessionResumed();
          // Mid-beat, the next sentence's cue is ALREADY queued by applyVerdict
          // — re-cueing here would fight it. Just settle the beat.
          if (pendingAdvanceRef.current) {
            commitAdvance();
            return;
          }
          setStatusLine('Let’s read that one again.');
          if (loopRef.current) {
            const item = currentOf();
            if (item) loopRef.current.queueCue(itemCue(item));
          }
          return;
        }
        case 'session-dead':
          // Ladder level 2: cues were going out and the tutor was proven
          // silent — re-cueing into a dead session is not recovery. Reconnect
          // warm; success converges on the 'session-resumed' branch above.
          noteSessionDead();
          return;
        default:
          return;
      }
    },
    [applyVerdict, commitAdvance, currentOf, noteSessionDead, noteSessionResumed],
  );

  const loop = useJudgedSpeechLoop({
    enabled: running,
    // The pack's one engine parameter: a mid-sentence pause is part of the
    // response (bench finding 2). Family default stays 500ms.
    voice: { config: { silenceCloseMs: SENTENCE_SILENCE_CLOSE_MS } },
    onEmission: handleEmission,
    // Diagnostics: the tutor's raw output transcription + mic turn telemetry.
    // The bench has wired both since the open-mic runs; the packs shipped with
    // neither, so a decohered run had no record of what the tutor actually SAID
    // (the only way to see contrastive-correction drift, a spoken ⟨ ⟩ marker, or
    // a missed sentinel) and none of the floors data that explains a split turn.
    onTutorText: (text) => logDiTutorText(text, logCtx()),
    onVoiceTurnClose: (event) => logDiVoiceClose(event, logCtx()),
    onCue: (event) => {
      logDiCue(event, logCtx());
      // (iii-a): lets the post-run disconnect see the closing cue go out.
      postRun.noteCue(event);
    },
  });
  loopRef.current = loop;

  // ── Connect + open mic (student gesture) ─────────────────────────
  const prepareLive = useCallback(async () => {
    if (preparing) return;
    setPreparing(true);
    setStatusLine('Getting ready…');
    // Register the upcoming run's id BEFORE connect so the WS auth message
    // carries it as client_run_id — the server-ledger correlation key.
    // startDiRunLog claims this same id when the run arms.
    setClientRunId(mintRunId());
    try {
      // Only self-connect from a standalone/idle context. In a lesson the
      // shared session owns the connection and is already opened with the DI
      // tutoring block + manual_activity — both resolved from the catalog entry
      // (catalog/di.ts `tutoring` / `audioInput`), same as this fallback path.
      if (!connectedRef.current && ctx.sessionMode === 'idle') {
        weConnectedRef.current = true;
        await ctx.connect({
          primitive_type: 'di-sentence-reading',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction sentence reading',
            // Resolved against the catalog contextKeys. The tutor MODELS these
            // aloud by design — the printed sentence is the stimulus, and the
            // model line is the instruction — so unlike the sibling packs there
            // is no answer side to keep out of RUNTIME STATE.
            challengeType: data.challengeType,
            sentences: sentencesSummary,
            text: data.challenges[0]?.text ?? '',
            wordCount: data.challenges[0]?.wordCount ?? 0,
            // The support tier the cue is composed at, so the tutor's own
            // scaffolding channel cannot re-read a sentence a `hard` item
            // deliberately withheld.
            supportTier: data.challenges[0]?.supportTier ?? 'easy',
          },
          grade_level: data.gradeLevel || 'first grade',
          audio_input: DI_AUDIO_INPUT,
        });
        const started = performance.now();
        while (!connectedRef.current && performance.now() - started < 12_000) await sleep(100);
        if (!connectedRef.current) throw new Error('The tutor did not connect.');
      }

      ctx.startListening();
      const micStarted = performance.now();
      while (!listeningRef.current && performance.now() - micStarted < 10_000) await sleep(100);
      if (!listeningRef.current) throw new Error('The microphone did not open.');

      setPhase('ready');
      setStatusLine('Ready! We’ll start with the first sentence.');
      startRun();
    } catch (error) {
      setStatusLine(error instanceof Error ? error.message : 'Could not start.');
      setPhase('idle');
    } finally {
      setPreparing(false);
    }
    // startRun is stable via ref below; deps intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, data.challenges, data.challengeType, data.gradeLevel, sentencesSummary, preparing, resolvedInstanceId]);

  // Keep the tutor's RUNTIME STATE truthful as sentences advance — the catalog
  // contextKeys (challengeType / text / wordCount / sentences) resolve against
  // this bag. updateContext is the SILENT channel (no end_of_turn), so these
  // never perturb the judged loop; the context provider dedupes by value.
  useEffect(() => {
    if (!ctx.isConnected || !currentChallenge) return;
    ctx.updateContext({
      challengeType: data.challengeType,
      text: currentChallenge.text,
      wordCount: currentChallenge.wordCount,
      sentences: sentencesSummary,
      supportTier: currentChallenge.supportTier ?? 'easy',
    });
    // Context methods are stable; keyed on the current item + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentChallenge, data.challengeType, sentencesSummary]);

  const startRun = useCallback(() => {
    const first = data.challenges[0];
    if (!first) return;
    correctionsRef.current.clear();
    outcomesRef.current = [];
    lastResponseMsRef.current = null;
    lastHeardRef.current = null;
    failedVerdictsRef.current = [];
    awaitingJudgeTextRef.current = false;
    submittedRef.current = false;
    pendingAdvanceRef.current = false;
    clearAdvanceTimer();
    setReward(null);
    resetStall();
    loop.reset();
    // Fresh diagnostics timeline for this run (diagnostics only). supportTier is
    // pinned because at `hard` the tutor must never speak the sentence — a cold
    // read that leaks is only readable against the tier the run actually used.
    startDiRunLog({
      primitiveId: 'di-sentence-reading',
      challengeType: data.challengeType,
      gradeLevel: data.gradeLevel,
      supportTier: first.supportTier ?? 'easy',
      totalItems: data.challenges.length,
      silenceCloseMs: loop.voiceTurns.config.silenceCloseMs,
    });
    setRunning(true);
    setPhase('listening');
    setStatusLine('Listen, then read it.');
    loop.sendCueNow(itemCue(first, true));
    loop.arm();
    logDiStage('run-start', `armed with ${data.challenges.length} items`, {
      itemId: first.id,
      itemDisplay: first.text,
    });
  }, [clearAdvanceTimer, data.challenges, data.challengeType, data.gradeLevel, loop, resetStall]);

  // Unmount cleanup — never leave Live holding the mic or an open turn.
  useEffect(() => () => {
    if (weConnectedRef.current) {
      ctx.stopListening();
      ctx.disconnect();
    }
    // Diagnosis telemetry: an abandoned or broken run still leaves its record
    // (deduped against the run-end flush by (runId, seq)).
    void flushDiRunLog('teardown');
    // Context methods are stable; unmount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ───────────────────────────────────────────────────────
  const total = data.challenges.length;
  const isSupported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const micState = preparing
    ? 'opening'
    : phase === 'idle'
      ? 'idle'
    : ctx.isListening
      ? 'armed'
      : 'idle';

  return (
    <LuminaCard surface="elevated" className="max-w-3xl mx-auto">
      <LuminaCardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <LuminaCardTitle>{data.title || 'Sentence Reading'}</LuminaCardTitle>
            <LuminaCardDescription>{data.description}</LuminaCardDescription>
          </div>
          <LuminaBadge accent="cyan">Read it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent>
        {total > 0 && !isComplete && (
          <div className="mb-4 flex justify-center">
            <LuminaChallengeCounter current={currentIndex + 1} total={total} variant="dots" />
          </div>
        )}

        {/* The kid-facing stage holds exactly ONE sentence at a time. Before the
            read: the printed sentence alone — decoding print IS the skill, so no
            picture, emoji, or hint precedes it. After the tutor affirms: the
            SAME sentence is marked read in place (emerald + pop) for the reward
            beat, and only when that beat releases does the next sentence
            appear. The marked form is value-captured `reward`, never derived
            from currentChallenge. No timer, ever. */}
        {/* Level-3 stall: the session died and recovery failed. The card takes
            the stage's place — visible state, never a silent "Listening…". */}
        {!isComplete && currentChallenge && stalled && (
          <DiStallCard onRetry={retryStall} />
        )}

        {!isComplete && currentChallenge && !stalled && (
          <div className="mb-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
            {reward && phase === 'affirmed' ? (
              <div
                key={`read-${reward.text}`}
                className={`rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-3 font-bold leading-snug tracking-wide text-emerald-300 ${sentenceSizeClass(reward.wordCount)} ${motion.pop}`}
              >
                {reward.text}
              </div>
            ) : (
              <div
                key={`sentence-${currentChallenge.id}`}
                className={`font-bold leading-snug tracking-wide text-white ${sentenceSizeClass(currentChallenge.wordCount)} ${motion.reveal}`}
              >
                {currentChallenge.text}
              </div>
            )}
            {reward?.emoji && phase === 'affirmed' && (
              <div className="mt-3 text-5xl leading-none" aria-hidden="true">{reward.emoji}</div>
            )}
            <div className="mt-3 text-xs uppercase tracking-[0.25em] text-cyan-300">
              {phase === 'judging' ? 'listening' : phase === 'affirmed' ? 'yes!' : phase === 'listening' ? 'read it' : 'get ready'}
            </div>
          </div>
        )}

        {/* Completion recap — a per-sentence mark, kit-styled. Every sentence
            was already printed on the stage, so showing them all is safe. */}
        {isComplete && (
          <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-6 text-center">
            <div className="text-2xl font-semibold text-emerald-200">Great reading today!</div>
            <div className="mt-4 flex flex-col items-center gap-2">
              {data.challenges.map((ch) => {
                const r = challengeResults.find((res) => res.challengeId === ch.id);
                const ok = r?.correct;
                return (
                  <div
                    key={ch.id}
                    className={`flex w-full max-w-md items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left ${ok ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-amber-400/30 bg-amber-500/10'}`}
                  >
                    <span className="text-lg font-semibold text-white">{ch.text}</span>
                    <span className="text-lg" aria-hidden="true">{ok ? (ch.emoji ?? '✅') : '🔁'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Voice control: the whole interaction runs through the mic. */}
        {!isComplete && (
          <div className="flex flex-col items-center gap-3">
            <LuminaMicListener
              state={micState}
              level={ctx.micLevel}
              isSupported={isSupported}
              onStart={() => void prepareLive()}
              onCancel={running || ctx.sessionMode === 'lesson' ? undefined : ctx.stopListening}
              size="lg"
              idleLabel="Tap to start"
              openingLabel="Getting ready…"
              listeningLabel="I’m listening"
            />
            <p className="text-sm text-slate-300">{statusLine}</p>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DiSentenceReading;
