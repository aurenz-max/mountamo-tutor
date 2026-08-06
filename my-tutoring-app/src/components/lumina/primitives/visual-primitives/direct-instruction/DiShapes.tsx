'use client';

/**
 * DiShapes — DI family primitive #5 (born 2026-08-06). Live-judged
 * call-response shape naming: the Live tutor MODELS a drawn 2D shape's name
 * ("Listen: this shape is a triangle."), GUIDES the learner through it, then
 * TESTS ("Your turn. What shape is this?") and judges the spoken SHAPE NAME
 * from the audio it heard in-band. The learner SEES the drawn shape and
 * SPEAKS its name into an open mic; the judged-loop engine anchors each
 * attempt to the local voice turn and reads the tutor's verdict from its
 * sentinel opener.
 *
 * The Live tutor IS the interaction surface (living-simulation doctrine) —
 * the committed engine (useJudgedSpeechLoop → judgedLoopModel +
 * useLiveVoiceTurns) owns the loop mechanics; this component owns DI
 * progression (advance / retry / move-on after capped corrections), the
 * kid-facing drawn-shape stage, and evaluation. Shapes are generator-scoped
 * to the objective; the script and judging contract are hand-authored
 * (diShapesScript). Separate content pack — the four sibling packs are frozen
 * and untouched.
 *
 * ANSWER-LEAK RULE: the stage draws the SHAPE ONLY — its name never appears
 * before the child says it. The labeled shape ("triangle" under the drawing)
 * renders only AFTER an affirmed answer (reward) and in the completion recap
 * for affirmed items; missed shapes recap without their names.
 *
 * GEOMETRY IS THE PEDAGOGY GUARD: rectangles draw clearly elongated (≥1.6:1)
 * and ovals clearly non-circular, so square-vs-rectangle and circle-vs-oval
 * each have exactly ONE defensible name per drawing (the rule-#1 / R12
 * class). Rotation comes stamped per challenge by the generator — K.G.2 is
 * "name shapes regardless of orientation", so orientation must actually vary.
 *
 * FLUENCY: per-item response time is captured SILENTLY from the engine's
 * attempt timing into metrics (meanResponseMs). No visible timer, ever
 * (no-timer ruling).
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
import type { DiShapesMetrics } from '../../../evaluation/types';
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
  type DiShapesChallenge,
  type DiShapesChallengeType,
  type DiShapeName,
} from './diShapesScript';
import {
  buildDiDiagnosisEvidence,
  completeLatestJudgeFeedback,
  pushFailedVerdict,
  type DiFailedVerdict,
} from './diDiagnosisEvidence';
import { DiStallCard } from './DiStallCard';
import { useDiStallRecovery } from './useDiStallRecovery';
import { useDiPostRunDisconnect } from './useDiPostRunDisconnect';

export type { DiShapesChallenge, DiShapesChallengeType, DiShapeName } from './diShapesScript';

export interface DiShapesData {
  title: string;
  description: string;
  /** 3-6 drawn shapes. REQUIRED. Built by the menu-scoped generator. */
  challenges: DiShapesChallenge[];
  /** Session core task identity (L0 = name_shape). */
  challengeType: DiShapesChallengeType;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiShapesMetrics>) => void;
}

/** Corrections the tutor may run on one shape before the lesson moves on. */
const MAX_CORRECTIONS_PER_ITEM = 2;

/** Manual voice-activity mode (family transport — bench run-3 ruling). */
const DI_AUDIO_INPUT = { manual_activity: true };

/** Floor/ceiling for the labeled-shape reward beat (see DiMathFacts). */
const REWARD_BEAT_MIN_MS = 900;
const REWARD_BEAT_MAX_MS = 3000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One resolved item outcome, accumulated synchronously for metrics. */
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

/** Misconception Loop S1 naming — task identity inside the summary so a
 *  primitive-scoped diagnosis stays self-limiting (family pattern). */
const challengeSummaryFor = (item: DiShapesChallenge): string =>
  'Direct Instruction shape naming — a flat 2D shape was DRAWN on screen '
  + `(${item.shape}, rotated ${item.rotationDeg}°) and the tutor asked what shape it is. `
  + 'The learner answers by SPEAKING the shape name; the tutor judges the audio.';

const expectedFor = (item: DiShapesChallenge): string =>
  `Say the shape name "${item.shapeWord}".`;

// ── The drawn-shape stage (code-owned geometry) ─────────────────────
// One 200×200 viewBox, shape centered at (100,100). The aspect ratios ARE
// pedagogy: rectangle ≥1.6:1 and oval clearly non-circular, so the near-name
// is never defensible for the drawing on screen.
const SHAPE_SVG: Record<DiShapeName, React.ReactNode> = {
  circle: <circle cx={100} cy={100} r={70} />,
  oval: <ellipse cx={100} cy={100} rx={85} ry={50} />,
  triangle: <polygon points="100,28 32,140 168,140" />,
  square: <rect x={40} y={40} width={120} height={120} />,
  rectangle: <rect x={20} y={56} width={160} height={88} />,
  hexagon: <polygon points="172,100 136,162 64,162 28,100 64,38 136,38" />,
  pentagon: <polygon points="100,25 171,77 144,161 56,161 29,77" />,
  rhombus: <polygon points="100,30 165,100 100,170 35,100" />,
  trapezoid: <polygon points="55,60 145,60 175,140 25,140" />,
};

const ShapeStage: React.FC<{ shape: DiShapeName; rotationDeg: number }> = ({ shape, rotationDeg }) => (
  <svg viewBox="0 0 200 200" className="h-44 w-44" role="img" aria-label="shape to name">
    <g
      transform={`rotate(${rotationDeg} 100 100)`}
      fill="rgba(34,211,238,0.14)"
      stroke="#67e8f9"
      strokeWidth={6}
      strokeLinejoin="round"
    >
      {SHAPE_SVG[shape]}
    </g>
  </svg>
);

/** PLATFORM PROP CONTRACT: every renderer mounts a registry primitive as
 *  `<Component data={…} index={…} />` (the 2026-08-06 props-are-data class is
 *  a compile error now — this pack is born on the right side of it). */
export const DiShapes: React.FC<{ data: DiShapesData; index?: number }> = ({ data }) => {
  const ctx = useLuminaAIContext();

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-shapes-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  const {
    currentIndex,
    results: challengeResults,
    isComplete,
    recordResult,
    advance,
  } = useChallengeProgress<DiShapesChallenge>({
    challenges: data.challenges,
    getChallengeId: (ch) => ch.id,
  });

  const currentChallenge = data.challenges[currentIndex] ?? null;

  const evaluation = usePrimitiveEvaluation<DiShapesMetrics>({
    primitiveType: 'di-shapes',
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
  /** The shape JUST affirmed, VALUE-CAPTURED at verdict time (never derived
   *  from currentChallenge — the sibling pack's answer-leak lesson). During
   *  the reward beat it replaces the unnamed shape with the labeled one. */
  const [reward, setReward] = useState<{ shape: DiShapeName; rotationDeg: number; label: string } | null>(null);

  const idxRef = useRef(0);
  idxRef.current = currentIndex;
  const correctionsRef = useRef(new Map<string, number>());
  const outcomesRef = useRef<ItemOutcome[]>([]);
  const lastResponseMsRef = useRef<number | null>(null);
  const lastHeardRef = useRef<string | null>(null);
  const failedVerdictsRef = useRef<DiFailedVerdict[]>([]);
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

  // ── Session-liveness recovery (family item 5) ────────────────────
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

  const postRun = useDiPostRunDisconnect({ done: phase === 'done', weConnectedRef });

  // ── The reward beat (edge-driven; see DiMathFacts for the rationale) ──
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

  const commitAdvance = useCallback(() => {
    if (!pendingAdvanceRef.current) return;
    pendingAdvanceRef.current = false;
    clearAdvanceTimer();
    idxRef.current = Math.min(idxRef.current + 1, data.challenges.length - 1);
    setReward(null);
    setPhase('listening');
    setStatusLine('Listen, then say the shape.');
    advance();
  }, [advance, clearAdvanceTimer, data.challenges.length]);

  const scheduleAdvance = useCallback(() => {
    pendingAdvanceRef.current = true;
    rewardStartedAtRef.current = performance.now();
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      commitAdvance();
    }, REWARD_BEAT_MAX_MS);
  }, [clearAdvanceTimer, commitAdvance]);

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
    const timed = outcomes.filter((o) => o.responseMs != null) as Array<ItemOutcome & { responseMs: number }>;
    const meanResponseMs = timed.length
      ? Math.round(timed.reduce((sum, o) => sum + o.responseMs, 0) / timed.length)
      : null;
    const metrics: DiShapesMetrics = {
      type: 'di-shapes',
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
    logDiStage('run-end', 'run complete — submitting + flushing run log');
    void flushDiRunLog('run-end');
    setTimeout(() => void flushDiRunLog('run-end-tail'), 6000);
  }, [clearAdvanceTimer, data.challenges.length, data.challengeType, evaluation]);

  // ── DI progression over an engine verdict ────────────────────────
  const loopRef = useRef<ReturnType<typeof useJudgedSpeechLoop> | null>(null);

  const applyVerdict = useCallback(
    (judgment: 'affirmed' | 'corrected' | 'off-script', verdictText?: string) => {
      const item = currentOf();
      const loop = loopRef.current;
      if (!item || !loop) return;

      if (judgment === 'off-script') return;

      const prevCorrections = correctionsRef.current.get(item.id) ?? 0;

      if (judgment === 'corrected') {
        const used = prevCorrections + 1;
        correctionsRef.current.set(item.id, used);
        failedVerdictsRef.current = pushFailedVerdict(failedVerdictsRef.current, {
          challenge: challengeSummaryFor(item),
          expected: expectedFor(item),
          heard: lastHeardRef.current,
          judgeFeedback: verdictText ?? '',
        });
        awaitingJudgeTextRef.current = true;
        if (used <= MAX_CORRECTIONS_PER_ITEM) {
          setPhase('listening');
          setStatusLine('Let’s try that one again.');
          return;
        }
        logDiStage(
          'move-on',
          `correction cap (${MAX_CORRECTIONS_PER_ITEM}) reached — moving on`,
          { itemId: item.id, itemDisplay: item.shape },
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
      // Post-answer reward only — the name never precedes the answer.
      setReward({ shape: item.shape, rotationDeg: item.rotationDeg, label: item.shapeWord });
      const next = data.challenges[idxRef.current + 1] ?? null;
      if (next) {
        setStatusLine('Yes! You know your shapes.');
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
    return { itemId: item?.id, itemDisplay: item?.shape };
  }, [currentOf]);

  const handleEmission = useCallback(
    (emission: LoopEmission) => {
      logDiEmission(emission, logCtx());

      switch (emission.kind) {
        case 'attempt-open':
          commitAdvance();
          lastHeardRef.current = null;
          awaitingJudgeTextRef.current = false;
          setPhase('judging');
          setStatusLine('Listening…');
          setReward(null);
          return;
        case 'attempt-transcript':
          lastResponseMsRef.current = emission.responseMs;
          lastHeardRef.current = emission.text;
          return;
        case 'verdict':
          if (emission.judgment === 'no-verdict') {
            setStatusLine('One more time—what shape is it?');
            return;
          }
          applyVerdict(emission.judgment, emission.verdictText);
          return;
        case 'verdict-text': {
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
          if (emission.kind === 'session-resumed') noteSessionResumed();
          if (pendingAdvanceRef.current) {
            commitAdvance();
            return;
          }
          setStatusLine('Let’s look at that one again.');
          if (loopRef.current) {
            const item = currentOf();
            if (item) loopRef.current.queueCue(itemCue(item));
          }
          return;
        }
        case 'session-dead':
          noteSessionDead();
          return;
        case 'loop-deaf':
          // Family recovery (piloted on math-facts): re-arm so the NEXT thing
          // the child says is heard; no re-cue (the tutor already asked).
          loopRef.current?.arm();
          return;
        default:
          return;
      }
    },
    [applyVerdict, commitAdvance, currentOf, noteSessionDead, noteSessionResumed],
  );

  const loop = useJudgedSpeechLoop({
    enabled: running,
    onEmission: handleEmission,
    onTutorText: (text) => logDiTutorText(text, logCtx()),
    onVoiceTurnClose: (event) => logDiVoiceClose(event, logCtx()),
    onCue: (event) => {
      logDiCue(event, logCtx());
      postRun.noteCue(event);
    },
  });
  loopRef.current = loop;

  // ── Connect + open mic (student gesture) ─────────────────────────
  const prepareLive = useCallback(async () => {
    if (preparing) return;
    setPreparing(true);
    setStatusLine('Getting ready…');
    setClientRunId(mintRunId());
    try {
      if (!connectedRef.current && ctx.sessionMode === 'idle') {
        weConnectedRef.current = true;
        await ctx.connect({
          primitive_type: 'di-shapes',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction shape naming',
            challengeType: data.challengeType,
            // Stimulus side only — the shape NAMES are the answers, so no
            // list of them ever enters RUNTIME STATE (answer-leak rule; the
            // target reaches the tutor inside each [DI_ITEM] contract).
            shapeCount: String(data.challenges.length),
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
  }, [ctx, data.challenges, data.challengeType, data.gradeLevel, preparing, resolvedInstanceId]);

  // RUNTIME STATE stays stimulus-side: the task identity only. The current
  // shape's NAME is the answer and never enters the context bag.
  useEffect(() => {
    if (!ctx.isConnected || !currentChallenge) return;
    ctx.updateContext({
      challengeType: data.challengeType,
    });
    // Context methods are stable; keyed on the current item + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentChallenge, data.challengeType]);

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
    startDiRunLog({
      primitiveId: 'di-shapes',
      challengeType: data.challengeType,
      gradeLevel: data.gradeLevel,
      totalItems: data.challenges.length,
      silenceCloseMs: loop.voiceTurns.config.silenceCloseMs,
    });
    setRunning(true);
    setPhase('listening');
    setStatusLine('Listen, then say the shape.');
    loop.sendCueNow(itemCue(first, true));
    loop.arm();
    logDiStage('run-start', `armed with ${data.challenges.length} items`, {
      itemId: first.id,
      itemDisplay: first.shape,
    });
  }, [clearAdvanceTimer, data.challenges, data.challengeType, data.gradeLevel, loop, resetStall]);

  // Unmount cleanup — never leave Live holding the mic or an open turn.
  useEffect(() => () => {
    if (weConnectedRef.current) {
      ctx.stopListening();
      ctx.disconnect();
    }
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
            <LuminaCardTitle>{data.title || 'Shape Time'}</LuminaCardTitle>
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

        {!isComplete && currentChallenge && stalled && (
          <DiStallCard onRetry={retryStall} />
        )}

        {/* The kid-facing stage holds exactly ONE shape at a time. Before the
            answer: the drawn shape alone — no name anywhere. After the tutor
            affirms: the SAME shape gains its name underneath (emerald + pop)
            for the reward beat, and only when that beat releases does the next
            shape appear. */}
        {!isComplete && currentChallenge && !stalled && (
          <div className="mb-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
            {reward && phase === 'affirmed' ? (
              <div
                key={`solved-${reward.shape}`}
                className={`flex flex-col items-center rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-3 ${motion.pop}`}
              >
                <ShapeStage shape={reward.shape} rotationDeg={reward.rotationDeg} />
                <div className="mt-1 text-3xl font-bold tracking-wide text-emerald-300">
                  {reward.label}
                </div>
              </div>
            ) : (
              <div key={`shape-${currentChallenge.id}`} className={motion.reveal}>
                <ShapeStage shape={currentChallenge.shape} rotationDeg={currentChallenge.rotationDeg} />
              </div>
            )}
            <div className="mt-3 text-xs uppercase tracking-[0.25em] text-cyan-300">
              {phase === 'judging' ? 'listening' : phase === 'affirmed' ? 'yes!' : phase === 'listening' ? 'say the shape' : 'get ready'}
            </div>
          </div>
        )}

        {/* Completion recap — labels are safe ONLY for affirmed shapes; a
            missed shape recaps unnamed (it resurfaces through review, and the
            recap must not leak what the child never produced). */}
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
                    className={`flex flex-col items-center rounded-xl border px-3 py-2 ${ok ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-amber-400/30 bg-amber-500/10'}`}
                  >
                    <svg viewBox="0 0 200 200" className="h-14 w-14" aria-hidden="true">
                      <g
                        transform={`rotate(${ch.rotationDeg} 100 100)`}
                        fill="rgba(34,211,238,0.14)"
                        stroke="#67e8f9"
                        strokeWidth={8}
                        strokeLinejoin="round"
                      >
                        {SHAPE_SVG[ch.shape]}
                      </g>
                    </svg>
                    {ok && <span className="text-sm font-semibold text-white">{ch.shapeWord}</span>}
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

export default DiShapes;
