'use client';

/**
 * DiMathFacts — DI family primitive #3. Live-judged call-response math facts:
 * the Live tutor MODELS a printed addition fact ("Listen: two plus one is
 * three."), GUIDES the learner through it, then TESTS ("Your turn. What is
 * two plus one?") and judges the spoken NUMBER WORD from the audio it heard
 * in-band. The learner SEES the printed problem and SPEAKS the answer into an
 * open mic; the judged-loop engine anchors each attempt to the local voice
 * turn and reads the tutor's verdict from its sentinel opener.
 *
 * The Live tutor IS the interaction surface (living-simulation doctrine) —
 * the committed engine (useJudgedSpeechLoop → judgedLoopModel +
 * useLiveVoiceTurns) owns the loop mechanics; this component owns DI
 * progression (advance / retry / move-on after capped corrections), the
 * kid-facing printed-problem display, and evaluation. Facts are
 * generator-scoped to the objective; the script and judging contract are
 * hand-authored (diMathFactsScript, bench-proven wording — probe sitting
 * 2026-07-24). Separate content pack — the letter-sounds and word-reading
 * files are frozen and untouched.
 *
 * ANSWER-LEAK RULE: the stage shows the PRINTED PROBLEM ONLY ("2 + 1") — the
 * sum never appears before the child answers. The completed equation
 * ("2 + 1 = 3") renders only AFTER an affirmed answer (reward) and in the
 * completion recap for affirmed facts; missed facts recap without the answer.
 *
 * FLUENCY (the reason this pack exists): per-fact response time is captured
 * SILENTLY from the engine's attempt timing into metrics (meanResponseMs).
 * No visible timer, ever — speed is measured, never performed (no-timer
 * ruling). The bench probe showed commit lag is ~constant (~933ms), so
 * responseMs is a stable think-time proxy.
 *
 * MISCONCEPTION EVIDENCE (2026-07-25): a miss now records WHAT the child said
 * and WHAT the tutor said about it, and a failed session ships a Tier-A
 * `DiagnosisEvidence` packet (`diDiagnosisEvidence.ts`) as submitResult's 6th
 * arg. Everything on that path is DATA for the shared distiller — it is never
 * rendered and never spoken, because in this family a stray write to a status
 * line would be read aloud by the tutor.
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
import type { DiMathFactsMetrics } from '../../../evaluation/types';
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
  type DiMathFactsChallenge,
  type DiMathFactsChallengeType,
} from './diMathFactsScript';
import {
  buildDiDiagnosisEvidence,
  completeLatestJudgeFeedback,
  pushFailedVerdict,
  type DiFailedVerdict,
} from './diDiagnosisEvidence';
import { DiStallCard } from './DiStallCard';
import { useDiStallRecovery } from './useDiStallRecovery';
import { useDiPostRunDisconnect } from './useDiPostRunDisconnect';

export type { DiMathFactsChallenge, DiMathFactsChallengeType, DiMathFactsSupportTier } from './diMathFactsScript';

export interface DiMathFactsData {
  title: string;
  description: string;
  /** 3-6 printed addition facts. REQUIRED. Built by the scoped fact pool. */
  challenges: DiMathFactsChallenge[];
  /** Session core task identity — the resolved/primary eval-mode skill. */
  challengeType: DiMathFactsChallengeType;
  /** Flat "2 + 1, 3 + 1" item-set summary (printed problems only, never the
   *  answers), attached by the generator for the tutoring scaffold's RUNTIME
   *  STATE (catalog contextKey `facts`). */
  facts?: string;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiMathFactsMetrics>) => void;
}

/** Corrections the tutor may run on one fact before the lesson moves on anyway.
 *  Per-turn judging is honest but warm; a weak fact resurfaces through
 *  distributed review, not by drilling a frustrated five-year-old in place. */
const MAX_CORRECTIONS_PER_ITEM = 2;

/** Manual voice-activity mode: the engine's amplitude detector brackets every
 *  learner turn (Gemini's speech-likeness VAD is unusable for short spoken
 *  responses — bench run-3 ruling). Passed at connect time. */
const DI_AUDIO_INPUT = { manual_activity: true };

/**
 * Close timing for sessions carrying COMPOUND numerals (answers past twenty —
 * the item-10 counting extension). "One hundred … seven" is ONE answer said in
 * pieces; the family 500ms close would split a mid-numeral pause into two
 * voice turns (the exact break di-sentence-reading hit on connected text — it
 * raised pack-scoped to 1100ms). PACK-scoped, content-gated: single-word
 * sessions keep the family default's snap. Standalone path only — in a lesson
 * the provider owns close timing (lessonVoiceTurnPolicy). #63(b) is the
 * acceptance check on this number.
 */
const COMPOUND_NUMERAL_SILENCE_CLOSE_MS = 1000;

/** Floor for the completed-equation beat — a resolved fact stays on screen this
 *  long even if the tutor's audio ends early, so the child always sees their
 *  answer land. Ceiling releases the stage if the audio edge never arrives. */
const REWARD_BEAT_MIN_MS = 900;
const REWARD_BEAT_MAX_MS = 3000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One resolved fact outcome, accumulated synchronously for metrics. */
interface ItemOutcome {
  id: string;
  correct: boolean;
  attempts: number;
  score: number;
  /** Silent fluency signal: tutor-audio-fall → learner attempt (ms). */
  responseMs: number | null;
}

const scoreForCorrections = (corrections: number): number =>
  corrections <= 0 ? 100 : corrections === 1 ? 67 : 33;

/**
 * Misconception Loop S1 — how each task identity is NAMED to the distiller.
 *
 * This is the cross-identity mitigation, not decoration. `misconceptionScope:
 * 'primitive'` stores ONE misconception per pack per student, but this pack
 * carries four TASK IDENTITIES: "counts up instead of back" is a real
 * diagnosis on `subtraction_fact` and is the CORRECT move on `counting_next`.
 * Naming the task inside `challengeSummary` makes the distilled sentence
 * self-limiting ("when subtracting, the student…"), so S5/S7 can apply it
 * narrowly even though the identity key is coarse. If that proves
 * insufficient the escalation is a PRD amendment (identity += eval-mode
 * family) — NOT flipping this pack to `'skill'` scope, which would gate the
 * standalone tester path out entirely.
 */
const TASK_PHRASE: Record<DiMathFactsChallengeType, string> = {
  counting_next: 'saying the number that comes AFTER a given number (the rote counting sequence)',
  answer_fact: 'answering a printed ADDITION fact aloud',
  fact_review: 'answering already-taught facts drawn as a mixed review set aloud',
  subtraction_fact: 'answering a printed SUBTRACTION (take-away) fact aloud',
};

const challengeSummaryFor = (item: DiMathFactsChallenge): string =>
  `Direct Instruction math facts — ${TASK_PHRASE[item.challengeType]}. `
  + `"${item.display}" was printed on screen and the tutor asked what ${item.problem} is. `
  + 'The learner answers by SPEAKING a number word; the tutor judges the audio.';

const expectedFor = (item: DiMathFactsChallenge): string =>
  `Say the number word "${item.answerWord}" (${item.answerNumeral}).`;

/** PLATFORM PROP CONTRACT: every renderer (ManifestOrderRenderer,
 *  PrimitiveRenderer, PracticeManifestRenderer, PulseActivityRenderer) mounts a
 *  registry primitive as `<Component data={…} index={…} />` — the generated data
 *  arrives as ONE `data` prop, with the evaluation props merged into it. This
 *  pack originally took the data object AS its props object (bench-only path:
 *  the DI tester spreads), which rendered fine in the tester and crashed on
 *  `data.challenges` the first time DI landed in a real lesson. */
export const DiMathFacts: React.FC<{ data: DiMathFactsData; index?: number }> = ({ data }) => {
  const ctx = useLuminaAIContext();

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-math-facts-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  /** RUNTIME STATE contextKey `facts` — the generator's flat summary, derived
   *  here as a fallback so the tutor never reads "(not set)" for a session
   *  built before the field existed. Printed problems only, never answers. */
  const factsSummary = useMemo(
    () => data.facts || data.challenges.map((c) => c.display).join(', '),
    [data.facts, data.challenges],
  );

  const {
    currentIndex,
    results: challengeResults,
    isComplete,
    recordResult,
    advance,
  } = useChallengeProgress<DiMathFactsChallenge>({
    challenges: data.challenges,
    getChallengeId: (ch) => ch.id,
  });

  const currentChallenge = data.challenges[currentIndex] ?? null;

  const evaluation = usePrimitiveEvaluation<DiMathFactsMetrics>({
    primitiveType: 'di-math-facts',
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
  /** The fact JUST affirmed, VALUE-CAPTURED at verdict time (never derived from
   *  currentChallenge — that read printed the NEXT fact's sum before the child
   *  answered, an answer leak browser-caught 2026-07-24). During the reward
   *  beat it REPLACES the printed problem on the stage rather than stacking a
   *  second chip under it, so only one fact is ever on screen. */
  const [reward, setReward] = useState<{ display: string; answer: number } | null>(null);

  // Progression authority is useChallengeProgress; mirror the index into a ref
  // so the emission handler (fires inside the loop's dispatch) reads it live.
  const idxRef = useRef(0);
  idxRef.current = currentIndex;
  const correctionsRef = useRef(new Map<string, number>());
  const outcomesRef = useRef<ItemOutcome[]>([]);
  const lastResponseMsRef = useRef<number | null>(null);
  /** What the child said on the OPEN attempt — the engine emits it on
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
  // A resolved fact does NOT advance the stage on the spot. The child answers,
  // the tutor confirms, the equation completes in place ("3 - 2" → "3 - 2 = 1"),
  // and only THEN does the next problem appear. Advancing at verdict time put
  // the next problem and the last answer on screen together — two facts at once
  // reads as overload to a five-year-old (user browser check 2026-07-25).
  //
  // The swap is edge-driven, not timed: the engine sends the next [DI_ITEM] cue
  // 400ms after the tutor's audio falls (VERIFY_BEAT_MS), so the falling edge of
  // that audio is the exact moment the tutor stops talking about THIS fact and
  // starts modelling the NEXT one. The visual rides that edge. The timers below
  // are only floors and failsafes, never the primary clock.
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

  /** End the reward beat and move the stage to the next fact. Idempotent. */
  const commitAdvance = useCallback(() => {
    if (!pendingAdvanceRef.current) return;
    pendingAdvanceRef.current = false;
    clearAdvanceTimer();
    // Bump the index ref with the state, not a render later: emissions fire
    // inside the loop's dispatch, so a verdict landing before React re-renders
    // would otherwise resolve against the fact we just left. The render pass
    // reassigns this from currentIndex to the same value.
    idxRef.current = Math.min(idxRef.current + 1, data.challenges.length - 1);
    setReward(null);
    setPhase('listening');
    setStatusLine('Listen, then say the answer.');
    advance();
  }, [advance, clearAdvanceTimer, data.challenges.length]);

  /** Hold the resolved fact on screen; the audio-fall edge (or the cap) releases it. */
  const scheduleAdvance = useCallback(() => {
    pendingAdvanceRef.current = true;
    rewardStartedAtRef.current = performance.now();
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      commitAdvance();
    }, REWARD_BEAT_MAX_MS);
  }, [clearAdvanceTimer, commitAdvance]);

  // The release edge: the tutor's line about THIS fact finished. Held to a floor
  // so a clipped affirmation can't flash the completed equation past the child.
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
    // Silent fluency signal (no-timer ruling): mean response time across the
    // attempts that carried timing. Null when the engine timed none.
    const timed = outcomes.filter((o) => o.responseMs != null) as Array<ItemOutcome & { responseMs: number }>;
    const meanResponseMs = timed.length
      ? Math.round(timed.reduce((sum, o) => sum + o.responseMs, 0) / timed.length)
      : null;
    const metrics: DiMathFactsMetrics = {
      type: 'di-math-facts',
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
    };
    // Misconception Loop S1 — the packet, on diagnosable sessions only. The
    // threshold mirrors `captureMisconception`'s OWN failure gate
    // (`success === false || score < 60`) rather than this pack's success bar
    // of 50, so evidence exists exactly when the loop would use it: no dead
    // packets, and no session that the gate calls failed arriving empty.
    const diagnosable = overallAccuracy < 60;
    const diagnosisEvidence = diagnosable
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
    setStatusLine('Great work today!');
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

      // DI-120-1 design ruling (BACKLOG item 12): a no-transcript correction
      // STILL counts toward the cap. Transcript absence is not evidence of
      // silence — DI-1's whole thesis is that ASR is a lossy annotation while
      // the judge heard real audio ("Shh." for /s/). The empty-attempt burn
      // that opened the question was noise-opened turns under a miscalibrated
      // barge bar, and the fix is the MIN_BARGE_BAR floor in
      // voiceTurnCalibration — the channel is closed where the turn opens,
      // not second-guessed here where a real lost-ASR answer would pay for it.
      if (judgment === 'corrected') {
        const used = prevCorrections + 1;
        correctionsRef.current.set(item.id, used);
        // Misconception Loop S1 — log EVERY correction, not just the capped
        // one. A wrong-then-right item is still a wrong answer, and the repeat
        // of the same item is the consistency signal (`priorAttempts`) that
        // separates a mental model from a slip. Logged here, judged nowhere:
        // the shared distiller decides what it means.
        failedVerdictsRef.current = pushFailedVerdict(failedVerdictsRef.current, {
          challenge: challengeSummaryFor(item),
          expected: expectedFor(item),
          heard: lastHeardRef.current,
          judgeFeedback: verdictText ?? '',
        });
        awaitingJudgeTextRef.current = true;
        if (used <= MAX_CORRECTIONS_PER_ITEM) {
          // The tutor's correction line already re-modeled and re-elicited
          // in-band; just reflect it and keep listening.
          setPhase('listening');
          setStatusLine('Let’s try that one again.');
          return;
        }
        // Corrections capped — record a miss and move the lesson forward.
        // Flagged in the run log: [DI_MOVE_ON] had never fired in ANY pack live
        // before the sustained-miss sitting, so this is a first-observation path.
        logDiStage(
          'move-on',
          `correction cap (${MAX_CORRECTIONS_PER_ITEM}) reached — moving on`,
          { itemId: item.id, itemDisplay: item.display },
          'move-on',
        );
        outcomesRef.current.push({
          id: item.id, correct: false, attempts: used, score: 0,
          responseMs: lastResponseMsRef.current,
        });
        recordResult({ challengeId: item.id, correct: false, attempts: used, score: 0 });
        const next = data.challenges[idxRef.current + 1] ?? null;
        lastResponseMsRef.current = null;
        if (next) {
          setStatusLine('Good try. Let’s keep going.');
          loop.queueCue(moveOnCue(item, next));
          // No reward to show (the fact went unanswered), but the stage still
          // holds: the move-on cue CONTAINS the next fact's model line, so the
          // swap belongs at the same audio edge, not before "Good try" is said.
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
        responseMs: lastResponseMsRef.current,
      });
      recordResult({ challengeId: item.id, correct: true, attempts, score });
      lastResponseMsRef.current = null;
      setPhase('affirmed');
      // Post-answer reward only — the sum never precedes the answer. This
      // REPLACES the printed problem for the beat rather than stacking under it.
      setReward({ display: item.solvedDisplay, answer: item.answerNumeral });
      const next = data.challenges[idxRef.current + 1] ?? null;
      if (next) {
        setStatusLine('Yes! Quick thinking.');
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
    return { itemId: item?.id, itemDisplay: item?.display };
  }, [currentOf]);

  const handleEmission = useCallback(
    (emission: LoopEmission) => {
      // Run log FIRST, before the switch — so the three kinds this pack
      // deliberately ignores for progression (attempt-superseded,
      // phantom-transcript, unanchored-verdict) are still recorded on their way
      // to `default: return`. Those three are exactly what a decohered sitting
      // needs and what the packs used to drop without trace. Logging must never
      // influence the loop: nothing below reads it.
      logDiEmission(emission, logCtx());

      switch (emission.kind) {
        case 'attempt-open':
          // The child got ahead of the beat — flush it FIRST so the stage can
          // never show a resolved fact while they are answering the next one.
          commitAdvance();
          // A fresh attempt has no transcript yet; stale text would be
          // attributed to the wrong answer in the evidence packet.
          lastHeardRef.current = null;
          awaitingJudgeTextRef.current = false;
          setPhase('judging');
          setStatusLine('Listening…');
          setReward(null);
          return;
        case 'attempt-transcript':
          lastResponseMsRef.current = emission.responseMs;
          // What the CHILD said. Kept, not dropped — this is the "they said
          // 'four' both times" half of the misconception evidence.
          lastHeardRef.current = emission.text;
          return;
        case 'verdict':
          if (emission.judgment === 'no-verdict') {
            setStatusLine('One more time—what is it?');
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
          // Mid-beat, the next fact's cue is ALREADY queued by applyVerdict —
          // re-cueing here would fight it. Just settle the beat.
          if (pendingAdvanceRef.current) {
            commitAdvance();
            return;
          }
          setStatusLine('Let’s hear that one again.');
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
        case 'loop-deaf':
          // The child spoke and the engine had no armed loop to record it. This
          // is OUR defect, not theirs (2026-08-06: a whole lesson run ran deaf
          // and every counter read as silence), so recover rather than stall —
          // re-arm so the NEXT thing they say is heard. Deliberately no re-cue:
          // the tutor is mid-item and already asked; a second ask on top of it
          // would talk over the child who is answering right now.
          loopRef.current?.arm();
          return;
        default:
          return;
      }
    },
    [applyVerdict, commitAdvance, currentOf, noteSessionDead, noteSessionResumed],
  );

  // Content-gated close timing: only sessions that can hear a compound
  // numeral pay the slower close (see COMPOUND_NUMERAL_SILENCE_CLOSE_MS).
  const hasCompoundAnswers = useMemo(
    () => data.challenges.some((c) => c.answerNumeral > 20),
    [data.challenges],
  );

  const loop = useJudgedSpeechLoop({
    enabled: running,
    voice: hasCompoundAnswers
      ? { config: { silenceCloseMs: COMPOUND_NUMERAL_SILENCE_CLOSE_MS } }
      : undefined,
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
        const first = data.challenges[0];
        await ctx.connect({
          primitive_type: 'di-math-facts',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction math facts',
            challengeType: data.challengeType,
            // Stimulus side only — never solvedDisplay/answerWord (answer-leak rule).
            facts: factsSummary,
            display: first?.display ?? '',
            problem: first?.problem ?? '',
            // The support tier the cue is composed at, so the tutor's own
            // scaffolding channel cannot volunteer a fact a `hard` item
            // deliberately withheld before the answer.
            supportTier: first?.supportTier ?? 'easy',
          },
          grade_level: data.gradeLevel || 'kindergarten',
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
      setStatusLine('Ready! We’ll start with the first one.');
      startRun();
    } catch (error) {
      setStatusLine(error instanceof Error ? error.message : 'Could not start.');
      setPhase('idle');
    } finally {
      setPreparing(false);
    }
    // startRun is stable via ref below; deps intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, data.challenges, data.challengeType, data.gradeLevel, factsSummary, preparing, resolvedInstanceId]);

  // Keep the tutor's RUNTIME STATE truthful as facts advance — the catalog
  // contextKeys (challengeType / display / problem / facts) resolve against this
  // bag. updateContext is the silent channel (no end-of-turn), so these never
  // perturb the judged loop; the context provider dedupes by value. Stimulus
  // side only: the answer reaches the tutor inside the [DI_ITEM] judging
  // contract, never through RUNTIME STATE.
  useEffect(() => {
    if (!ctx.isConnected || !currentChallenge) return;
    ctx.updateContext({
      challengeType: data.challengeType,
      display: currentChallenge.display,
      problem: currentChallenge.problem,
      facts: factsSummary,
      supportTier: currentChallenge.supportTier ?? 'easy',
    });
    // Context methods are stable; keyed on the current item + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentChallenge, data.challengeType, factsSummary]);

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
    // Fresh diagnostics timeline for this run (diagnostics only). supportTier
    // is pinned because at `hard` the tutor must never say the fact or its
    // answer pre-attempt — a cold answer that leaks is only readable against
    // the tier the run actually used.
    startDiRunLog({
      primitiveId: 'di-math-facts',
      challengeType: data.challengeType,
      gradeLevel: data.gradeLevel,
      supportTier: first.supportTier ?? 'easy',
      totalItems: data.challenges.length,
      silenceCloseMs: loop.voiceTurns.config.silenceCloseMs,
    });
    setRunning(true);
    setPhase('listening');
    setStatusLine('Listen, then say the answer.');
    loop.sendCueNow(itemCue(first, true));
    loop.arm();
    logDiStage('run-start', `armed with ${data.challenges.length} items`, {
      itemId: first.id,
      itemDisplay: first.display,
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
            <LuminaCardTitle>{data.title || 'Math Facts'}</LuminaCardTitle>
            <LuminaCardDescription>{data.description}</LuminaCardDescription>
          </div>
          <LuminaBadge accent="cyan">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent>
        {total > 0 && !isComplete && (
          <div className="mb-4 flex justify-center">
            <LuminaChallengeCounter current={currentIndex + 1} total={total} variant="dots" />
          </div>
        )}

        {/* The kid-facing stage holds exactly ONE fact at a time. Before the
            answer: the printed problem alone ("3 - 2"). After the tutor affirms:
            the SAME fact completes in place ("3 - 2 = 1", emerald + pop) for the
            reward beat, and only when that beat releases does the next problem
            appear. Showing the next problem while the last answer was still up
            put two facts on screen at once — overload at this age (user browser
            check 2026-07-25). The completed form is value-captured `reward`,
            never derived from currentChallenge. No timer, ever. */}
        {/* Level-3 stall: the session died and recovery failed. The card takes
            the stage's place — visible state, never a silent "Listening…". */}
        {!isComplete && currentChallenge && stalled && (
          <DiStallCard onRetry={retryStall} />
        )}

        {!isComplete && currentChallenge && !stalled && (
          <div className="mb-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
            {reward && phase === 'affirmed' ? (
              <div
                key={`solved-${reward.display}`}
                className={`rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-2 text-7xl font-bold tracking-wide text-emerald-300 ${motion.pop}`}
              >
                {reward.display}
              </div>
            ) : (
              <div
                key={`problem-${currentChallenge.id}`}
                className={`text-7xl font-bold tracking-wide text-white ${motion.reveal}`}
              >
                {currentChallenge.display}
              </div>
            )}
            <div className="mt-3 text-xs uppercase tracking-[0.25em] text-cyan-300">
              {phase === 'judging' ? 'listening' : phase === 'affirmed' ? 'yes!' : phase === 'listening' ? 'say the answer' : 'get ready'}
            </div>
          </div>
        )}

        {/* Completion recap — a per-fact mark, kit-styled. Completed equations
            are safe ONLY for affirmed facts; a missed fact recaps without its
            answer (it resurfaces through review, and the recap must not leak
            what the child never produced). */}
        {isComplete && (
          <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-6 text-center">
            <div className="text-2xl font-semibold text-emerald-200">Great work today!</div>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {data.challenges.map((ch) => {
                const r = challengeResults.find((res) => res.challengeId === ch.id);
                const ok = r?.correct;
                return (
                  <div
                    key={ch.id}
                    className={`flex flex-col items-center rounded-xl border px-4 py-2 ${ok ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-amber-400/30 bg-amber-500/10'}`}
                  >
                    <span className="text-2xl font-bold text-white">
                      {ok ? ch.solvedDisplay : ch.display}
                    </span>
                    <span className="text-lg" aria-hidden="true">{ok ? '✅' : '🔁'}</span>
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

export default DiMathFacts;
