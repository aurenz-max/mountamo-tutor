'use client';

/**
 * DiWordReading — DI family primitive #2. Live-judged call-response word
 * reading: the Live tutor MODELS a printed word (sound-out blend for a
 * decodable CVC word, whole-word recall for a sight word), GUIDES the learner
 * through it, then TESTS ("your turn, what word?") and judges the audio it
 * heard in-band. The learner READS the printed word into an open mic; the
 * judged-loop engine anchors each attempt to the local voice turn and reads
 * the tutor's verdict from its sentinel opener.
 *
 * The Live tutor IS the interaction surface (living-simulation doctrine) —
 * the committed engine (useJudgedSpeechLoop → judgedLoopModel +
 * useLiveVoiceTurns) owns the loop mechanics; this component owns DI
 * progression (advance / retry / move-on after capped corrections), the
 * kid-facing printed-word display, and evaluation. Items are generator-scoped
 * to the objective; the script and judging contract are hand-authored
 * (diWordReadingScript). Separate content pack — the di-letter-sounds files
 * are frozen and untouched.
 *
 * ANSWER-LEAK RULE (differs from letter-sounds): decoding print IS the skill,
 * so the stage shows the PRINTED WORD ONLY — no picture, no emoji, no audio
 * pre-cue before the child reads. A challenge's emoji appears only AFTER an
 * affirmed read (reward) and in the completion recap.
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
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { PrimitiveEvaluationResult } from '../../../evaluation/types';
import type { DiWordReadingMetrics } from '../../../evaluation/types';
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
  type DiWordReadingChallenge,
  type DiWordReadingChallengeType,
} from './diWordReadingScript';
import {
  buildDiDiagnosisEvidence,
  completeLatestJudgeFeedback,
  pushFailedVerdict,
  type DiFailedVerdict,
} from './diDiagnosisEvidence';
import { DiStallCard } from './DiStallCard';
import { useDiStallRecovery } from './useDiStallRecovery';
import { useDiPostRunDisconnect } from './useDiPostRunDisconnect';

export type { DiWordReadingChallenge, DiWordReadingChallengeType } from './diWordReadingScript';

export interface DiWordReadingData {
  title: string;
  description: string;
  /** 3-6 printed-word items. REQUIRED. Built by the menu-scoped generator. */
  challenges: DiWordReadingChallenge[];
  /** Representative session task identity (first item on blend/mixed paths). */
  challengeType: DiWordReadingChallengeType;
  /** Flat "sam, mat, cat, hat" item-set summary, attached by the generator for
   *  the tutoring scaffold's RUNTIME STATE (catalog contextKey `words`). Like
   *  di-sentence-reading's `sentences`, there is no answer side to withhold —
   *  the printed word IS the target and is already on the child's screen — but
   *  the list does name words not yet shown, which the catalog's WORD READING
   *  directive covers with an explicit never-preview clause. */
  words?: string;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiWordReadingMetrics>) => void;
}

/** Corrections the tutor may run on one word before the lesson moves on anyway.
 *  Per-turn judging is strict; a weak word resurfaces through distributed
 *  review, not by drilling a frustrated five-year-old in place. */
const MAX_CORRECTIONS_PER_ITEM = 2;

/** Manual voice-activity mode: the engine's amplitude detector brackets every
 *  learner turn (Gemini's speech-likeness VAD is unusable for short spoken
 *  responses — bench run-3 ruling). Passed at connect time. */
const DI_AUDIO_INPUT = { manual_activity: true };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One resolved item outcome, accumulated synchronously for metrics. */
interface ItemOutcome {
  id: string;
  correct: boolean;
  attempts: number;
  score: number;
  responseMs: number | null;
}

const scoreForCorrections = (corrections: number): number =>
  corrections <= 0 ? 100 : corrections === 1 ? 67 : 33;

/**
 * Misconception Loop S1 — how the task is NAMED to the distiller.
 *
 * L1 now exposes distinct decodable, base, sight-word, and review identities.
 * `wordType` remains diagnostically important inside base/review: failing a
 * decodable CVC word is a BLENDING failure and failing an irregular sight word
 * is a RECALL failure. Naming both the identity and word type prevents the
 * evidence from conflating those processes.
 */
const TASK_PHRASE: Record<DiWordReadingChallengeType, string> = {
  cvc_reading: 'blending and reading ONE decodable CVC word aloud',
  read_word: 'reading ONE printed word aloud',
  sight_word: 'recalling and reading ONE irregular sight word aloud',
  word_reading_review: 'reviewing ONE previously taught printed word aloud',
};

const challengeSummaryFor = (item: DiWordReadingChallenge): string =>
  `Direct Instruction word reading — ${TASK_PHRASE[item.challengeType]}. `
  + (item.wordType === 'sight'
    ? `The IRREGULAR high-frequency (sight) word "${item.word}" was printed on screen — it cannot be sounded out and must be recognised whole. `
    : `The decodable CVC word "${item.word}" was printed on screen — it is read by blending its sounds. `)
  + 'Nothing but the printed word is shown; the learner READS it aloud and the tutor judges the audio.';

const expectedFor = (item: DiWordReadingChallenge): string =>
  `Read the printed word aloud as "${item.word}".`;

export const DiWordReading: React.FC<DiWordReadingData> = (data) => {
  const ctx = useLuminaAIContext();

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-word-reading-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  /** RUNTIME STATE contextKey `words` — the generator's flat summary, derived
   *  here as a fallback so the tutor never reads "(not set)" for a session
   *  built before the field existed. */
  const wordsSummary = useMemo(
    () => data.words || data.challenges.map((c) => c.word).join(', '),
    [data.words, data.challenges],
  );

  const {
    currentIndex,
    results: challengeResults,
    isComplete,
    recordResult,
    advance,
  } = useChallengeProgress<DiWordReadingChallenge>({
    challenges: data.challenges,
    getChallengeId: (ch) => ch.id,
  });

  const currentChallenge = data.challenges[currentIndex] ?? null;

  const evaluation = usePrimitiveEvaluation<DiWordReadingMetrics>({
    primitiveType: 'di-word-reading',
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
  /** Reward picture for the word JUST affirmed — post-read only (answer-leak
   *  rule), cleared the moment the next attempt opens. */
  const [rewardEmoji, setRewardEmoji] = useState<string | null>(null);

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

  const finishAndSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const outcomes = outcomesRef.current;
    const correctCount = outcomes.filter((o) => o.correct).length;
    const firstTryCount = outcomes.filter((o) => o.correct && o.attempts === 1).length;
    const attemptsCount = outcomes.reduce((sum, o) => sum + o.attempts, 0);
    const overallAccuracy = outcomes.length
      ? Math.round(outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length)
      : 0;
    const metrics: DiWordReadingMetrics = {
      type: 'di-word-reading',
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
  }, [data.challenges.length, data.challengeType, evaluation]);

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
        // one. This pack's signature error class is the NEAR NEIGHBOUR
        // (sun/son, red/read), and a near neighbour repeated across retries is
        // exactly the `priorAttempts` consistency signal.
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
          setStatusLine('Let’s try that word again.');
          return;
        }
        // Corrections capped — record a miss and move the lesson forward.
        // Flagged in the run log: [DI_MOVE_ON] had never fired in ANY pack live
        // before the sustained-miss sitting, so this is a first-observation path.
        logDiStage(
          'move-on',
          `correction cap (${MAX_CORRECTIONS_PER_ITEM}) reached — moving on`,
          { itemId: item.id, itemDisplay: item.word },
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
          advance();
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
      // Post-read reward only — the picture never precedes the read.
      setRewardEmoji(item.emoji ?? null);
      const next = data.challenges[idxRef.current + 1] ?? null;
      if (next) {
        setStatusLine('Yes! Nice reading.');
        loop.queueCue(itemCue(next));
        advance();
      } else {
        setStatusLine('You did it!');
        loop.queueCue(completeCue());
        finishAndSubmit();
      }
    },
    [advance, currentOf, data.challenges, finishAndSubmit, recordResult],
  );

  /** Item context for the run log. Diagnostics only. */
  const logCtx = useCallback(() => {
    const item = currentOf();
    return { itemId: item?.id, itemDisplay: item?.word };
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
          // A fresh attempt has no transcript yet; stale text would be
          // attributed to the wrong read in the evidence packet.
          lastHeardRef.current = null;
          awaitingJudgeTextRef.current = false;
          setPhase('judging');
          setStatusLine('Listening…');
          setRewardEmoji(null);
          return;
        case 'attempt-transcript':
          lastResponseMsRef.current = emission.responseMs;
          // What the CHILD read. Kept, not dropped — the misread word is half
          // the evidence, and for this pack it names the near neighbour.
          lastHeardRef.current = emission.text;
          return;
        case 'verdict':
          if (emission.judgment === 'no-verdict') {
            setStatusLine('One more time—what word?');
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
          setStatusLine('Let’s read that word again.');
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
    [applyVerdict, currentOf, noteSessionDead, noteSessionResumed],
  );

  const loop = useJudgedSpeechLoop({
    enabled: running,
    onEmission: handleEmission,
    // Diagnostics: the tutor's raw output transcription + mic turn telemetry.
    // The bench has wired both since the open-mic runs; the packs shipped with
    // neither, so a decohered run had no record of what the tutor actually SAID.
    // For THIS pack the tutor text is also the near-neighbour check — whether it
    // affirmed "matt" for "mat" is only visible in what it said.
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
          primitive_type: 'di-word-reading',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction word reading',
            // Resolved against the catalog contextKeys. The printed word is
            // both stimulus and target — the tutor MODELS it by design and the
            // child is already looking at it — so, like di-sentence-reading,
            // there is no answer side to keep out of RUNTIME STATE.
            challengeType: data.challengeType,
            words: wordsSummary,
            word: data.challenges[0]?.word ?? '',
            // Decodable → blended; irregular sight word → recalled whole and
            // never sounded out. The blend itself stays in the [DI_ITEM] cue.
            wordType: data.challenges[0]?.wordType ?? 'cvc',
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
      setStatusLine('Ready! We’ll start with the first word.');
      startRun();
    } catch (error) {
      setStatusLine(error instanceof Error ? error.message : 'Could not start.');
      setPhase('idle');
    } finally {
      setPreparing(false);
    }
    // startRun is stable via ref below; deps intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, data.challenges, data.challengeType, data.gradeLevel, wordsSummary, preparing, resolvedInstanceId]);

  // Keep the tutor's RUNTIME STATE truthful as words advance — the catalog
  // contextKeys (challengeType / word / wordType / words) resolve against this
  // bag. updateContext is the SILENT channel (no end_of_turn), so these never
  // perturb the judged loop; the context provider dedupes by value.
  useEffect(() => {
    if (!ctx.isConnected || !currentChallenge) return;
    ctx.updateContext({
      challengeType: data.challengeType,
      word: currentChallenge.word,
      wordType: currentChallenge.wordType,
      words: wordsSummary,
    });
    // Context methods are stable; keyed on the current item + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentChallenge, data.challengeType, wordsSummary]);

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
    setRewardEmoji(null);
    resetStall();
    loop.reset();
    // Fresh diagnostics timeline for this run (diagnostics only).
    startDiRunLog({
      primitiveId: 'di-word-reading',
      challengeType: data.challengeType,
      gradeLevel: data.gradeLevel,
      totalItems: data.challenges.length,
      silenceCloseMs: loop.voiceTurns.config.silenceCloseMs,
    });
    setRunning(true);
    setPhase('listening');
    setStatusLine('Listen, then read the word.');
    loop.sendCueNow(itemCue(first, true));
    loop.arm();
    logDiStage('run-start', `armed with ${data.challenges.length} items`, {
      itemId: first.id,
      itemDisplay: first.word,
    });
  }, [data.challenges, data.challengeType, data.gradeLevel, loop, resetStall]);

  // Unmount cleanup — never leave Live holding the mic or an open turn.
  useEffect(() => () => {
    ctx.stopListening();
    if (weConnectedRef.current) ctx.disconnect();
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
    : ctx.isListening
      ? 'armed'
      : 'idle';

  return (
    <LuminaCard surface="elevated" className="max-w-3xl mx-auto">
      <LuminaCardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <LuminaCardTitle>{data.title || 'Word Reading'}</LuminaCardTitle>
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

        {/* The kid-facing stage: the PRINTED WORD ONLY. Decoding print IS the
            skill, so no picture, emoji, or hint appears before the read — the
            reward emoji renders only after an affirmed read. */}
        {/* Level-3 stall: the session died and recovery failed. The card takes
            the stage's place — visible state, never a silent "Listening…". */}
        {!isComplete && currentChallenge && stalled && (
          <DiStallCard onRetry={retryStall} />
        )}

        {!isComplete && currentChallenge && !stalled && (
          <div className="mb-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
            <div className="text-7xl font-bold lowercase tracking-wide text-white">
              {currentChallenge.word}
            </div>
            {rewardEmoji && phase === 'affirmed' && (
              <div className="mt-3 text-5xl leading-none" aria-hidden="true">{rewardEmoji}</div>
            )}
            <div className="mt-3 text-xs uppercase tracking-[0.25em] text-cyan-300">
              {phase === 'judging' ? 'listening' : phase === 'affirmed' ? 'yes!' : phase === 'listening' ? 'what word?' : 'get ready'}
            </div>
          </div>
        )}

        {/* Completion recap — a per-word mark, kit-styled. Emojis are safe
            here: every word has already been read. */}
        {isComplete && (
          <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-6 text-center">
            <div className="text-2xl font-semibold text-emerald-200">Great reading today!</div>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {data.challenges.map((ch) => {
                const r = challengeResults.find((res) => res.challengeId === ch.id);
                const ok = r?.correct;
                return (
                  <div
                    key={ch.id}
                    className={`flex flex-col items-center rounded-xl border px-4 py-2 ${ok ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-amber-400/30 bg-amber-500/10'}`}
                  >
                    <span className="text-2xl font-bold lowercase text-white">{ch.word}</span>
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
              onCancel={running ? undefined : ctx.stopListening}
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

export default DiWordReading;
