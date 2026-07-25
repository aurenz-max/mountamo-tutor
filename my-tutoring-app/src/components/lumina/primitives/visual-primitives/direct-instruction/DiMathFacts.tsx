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
import type { DiMathFactsMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { useJudgedSpeechLoop } from '../../../hooks/useJudgedSpeechLoop';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
import {
  completeCue,
  itemCue,
  moveOnCue,
  DI_MATH_FACTS_TUTORING,
  type DiMathFactsChallenge,
  type DiMathFactsChallengeType,
} from './diMathFactsScript';

export type { DiMathFactsChallenge, DiMathFactsChallengeType } from './diMathFactsScript';

export interface DiMathFactsData {
  title: string;
  description: string;
  /** 3-6 printed addition facts. REQUIRED. Built by the scoped fact pool. */
  challenges: DiMathFactsChallenge[];
  /** Session core task identity — one mode at birth (`answer_fact`). */
  challengeType: DiMathFactsChallengeType;
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

export const DiMathFacts: React.FC<DiMathFactsData> = (data) => {
  const ctx = useLuminaAIContext();

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-math-facts-${Math.round(performance.now())}`,
    [data.instanceId],
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
  /** The fact JUST affirmed, VALUE-CAPTURED at verdict time — never derived
   *  from currentChallenge, which advance() has already moved to the NEXT fact
   *  by the time this renders (deriving it printed the next fact's sum before
   *  the child answered — an answer leak, browser-caught 2026-07-24). Post-
   *  answer reward only; cleared the moment the next attempt opens. */
  const [reward, setReward] = useState<{ display: string; answer: number } | null>(null);

  // Progression authority is useChallengeProgress; mirror the index into a ref
  // so the emission handler (fires inside the loop's dispatch) reads it live.
  const idxRef = useRef(0);
  idxRef.current = currentIndex;
  const correctionsRef = useRef(new Map<string, number>());
  const outcomesRef = useRef<ItemOutcome[]>([]);
  const lastResponseMsRef = useRef<number | null>(null);
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
    evaluation.submitResult(
      overallAccuracy >= 50,
      overallAccuracy,
      metrics,
      { outcomes },
    );
    setRunning(false);
    setPhase('done');
    setStatusLine('Great work today!');
  }, [data.challenges.length, data.challengeType, evaluation]);

  // ── DI progression over an engine verdict ────────────────────────
  const loopRef = useRef<ReturnType<typeof useJudgedSpeechLoop> | null>(null);

  const applyVerdict = useCallback(
    (judgment: 'affirmed' | 'corrected' | 'off-script') => {
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
        if (used <= MAX_CORRECTIONS_PER_ITEM) {
          // The tutor's correction line already re-modeled and re-elicited
          // in-band; just reflect it and keep listening.
          setPhase('listening');
          setStatusLine('Let’s try that one again.');
          return;
        }
        // Corrections capped — record a miss and move the lesson forward.
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
      // Post-answer reward only — the sum never precedes the answer.
      setReward({ display: item.display, answer: item.answerNumeral });
      const next = data.challenges[idxRef.current + 1] ?? null;
      if (next) {
        setStatusLine('Yes! Quick thinking.');
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

  const handleEmission = useCallback(
    (emission: LoopEmission) => {
      switch (emission.kind) {
        case 'attempt-open':
          setPhase('judging');
          setStatusLine('Listening…');
          setReward(null);
          return;
        case 'attempt-transcript':
          lastResponseMsRef.current = emission.responseMs;
          return;
        case 'verdict':
          if (emission.judgment === 'no-verdict') {
            setStatusLine('One more time—what is it?');
            return;
          }
          applyVerdict(emission.judgment);
          return;
        case 'resync':
          setStatusLine('Let’s hear that one again.');
          if (loopRef.current) {
            const item = currentOf();
            if (item) loopRef.current.queueCue(itemCue(item));
          }
          return;
        default:
          return;
      }
    },
    [applyVerdict, currentOf],
  );

  const loop = useJudgedSpeechLoop({
    enabled: running,
    onEmission: handleEmission,
  });
  loopRef.current = loop;

  // ── Connect + open mic (student gesture) ─────────────────────────
  const prepareLive = useCallback(async () => {
    if (preparing) return;
    setPreparing(true);
    setStatusLine('Getting ready…');
    try {
      // Only self-connect from a standalone/idle context. In a lesson the
      // shared session owns the connection; the family lesson-mode wiring
      // (catalog audioInput scan in connectLesson) opens it with
      // manual_activity, and the catalog tutoring move is this pack's L2.
      if (!connectedRef.current && ctx.sessionMode === 'idle') {
        weConnectedRef.current = true;
        await ctx.connect({
          primitive_type: 'di-math-facts',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction math facts',
            facts: data.challenges.map((c) => c.display),
          },
          grade_level: data.gradeLevel || 'kindergarten',
          tutoring: DI_MATH_FACTS_TUTORING,
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
  }, [ctx, data.challenges, data.gradeLevel, preparing, resolvedInstanceId]);

  const startRun = useCallback(() => {
    const first = data.challenges[0];
    if (!first) return;
    correctionsRef.current.clear();
    outcomesRef.current = [];
    lastResponseMsRef.current = null;
    submittedRef.current = false;
    setReward(null);
    loop.reset();
    setRunning(true);
    setPhase('listening');
    setStatusLine('Listen, then say the answer.');
    loop.sendCueNow(itemCue(first, true));
    loop.arm();
  }, [data.challenges, loop]);

  // Unmount cleanup — never leave Live holding the mic or an open turn.
  useEffect(() => () => {
    ctx.stopListening();
    if (weConnectedRef.current) ctx.disconnect();
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

        {/* The kid-facing stage: the PRINTED PROBLEM ONLY, always the LIVE
            challenge (advance() moves it right after an affirm). The completed
            equation for the JUST-affirmed fact renders as a separate chip
            below, from value-captured `reward` — never from currentChallenge,
            whose sum belongs to the next, unanswered fact. No timer, ever. */}
        {!isComplete && currentChallenge && (
          <div className="mb-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
            <div className="text-7xl font-bold tracking-wide text-white">
              {currentChallenge.display}
            </div>
            {reward && phase === 'affirmed' && (
              <div className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-1.5 text-3xl font-bold text-emerald-300">
                {reward.display} = {reward.answer}
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
                      {ok ? `${ch.display} = ${ch.answerNumeral}` : ch.display}
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

export default DiMathFacts;
