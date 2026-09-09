'use client';

/**
 * MeasureLab — the K weight-and-capacity bench (K.MD.A.1, K.MD.A.2).
 *
 * A living simulation, not a picture with a question under it: the component
 * owns the physics and the child owns the objects. A pan balance TIPS because
 * of what the child put on it; a container FILLS because the child poured a cup
 * in. Gemini supplies only the vocabulary — what the things are called and how
 * the question is worded. Every weight and every capacity is code-owned and
 * never printed, so the only way to know is to test it.
 *
 * The four things a five-year-old does here:
 *   balance_predict  — say which is heavier, then put both on the scale and watch
 *   capacity_predict — say which holds more, then pour both full and count
 *   pour_count       — fill one container with cups and say how many it took
 *   order_capacity   — put three identical jars in order, least to most
 *
 * PREDICTION BEFORE TEST is the pedagogy, so it is also the mechanic: the
 * prediction modes will not run the test until the child has committed, and the
 * score is the prediction, never the pouring.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaPrompt,
  LuminaButton,
  LuminaSectionLabel,
  LuminaChallengeCounter,
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  answerStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type MeasureLabMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';

// ---------------------------------------------------------------------------
// Public types (mirrored by the generator)
// ---------------------------------------------------------------------------

export type MeasureLabChallengeType =
  | 'balance_predict'
  | 'capacity_predict'
  | 'pour_count'
  | 'order_capacity';

export interface MeasureObject {
  id: string;
  /** What the child hears it called ("the apple"). */
  name: string;
  emoji: string;
  /** Code-owned and NEVER rendered — the pan's tip is the only evidence. */
  weight: number;
}

export type ContainerShape = 'tall' | 'wide' | 'round';

export interface MeasureContainer {
  id: string;
  name: string;
  shape: ContainerShape;
  /** In cups. Code-owned and NEVER rendered. */
  capacity: number;
  /** order_capacity only: how much is already in it, in cups. */
  filled?: number;
}

export interface MeasureLabChallenge {
  id: string;
  type: MeasureLabChallengeType;
  prompt: string;
  hint?: string;

  /** balance_predict */
  left?: MeasureObject;
  right?: MeasureObject;

  /** pour_count */
  container?: MeasureContainer;

  /** capacity_predict */
  containerA?: MeasureContainer;
  containerB?: MeasureContainer;

  /** order_capacity — three identical jars, different amounts inside. */
  containers?: MeasureContainer[];

  /** The unit the child pours with ("cups"). */
  unitName?: string;
  unitEmoji?: string;

  // ── Answer key, derived in code ──
  /** balance_predict / capacity_predict: the id that wins. */
  expectedChoice?: string;
  /** pour_count: how many units fill it. */
  expectedCount?: number;
  /** pour_count: the numbers offered. */
  options?: number[];
  /** order_capacity: container ids, least → most. */
  expectedOrder?: string[];
}

export interface MeasureLabData {
  title: string;
  description: string;
  /** 3-6 challenges. Required — one session walks them in order. */
  challenges: MeasureLabChallenge[];
  /** Session task identity. Widened by /add-eval-modes. */
  challengeType: MeasureLabChallengeType;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MeasureLabMetrics>) => void;
}

interface MeasureLabProps {
  data: MeasureLabData;
  className?: string;
}

// ---------------------------------------------------------------------------
// The bench — SVG geometry the simulation runs on
// ---------------------------------------------------------------------------

const STAGE_W = 620;
const STAGE_H = 300;

/** Beam tilt in degrees, from the weight difference. Capped so the pans stay
 *  on the bench; the SIGN is the answer the child reads, not the angle. */
const tiltFor = (leftW: number, rightW: number): number => {
  const diff = rightW - leftW;
  if (diff === 0) return 0;
  const magnitude = Math.min(14, 4 + Math.abs(diff) * 2);
  return diff > 0 ? magnitude : -magnitude;
};

/** Outline of a container, by shape. Sizes are SHAPE, never capacity — a tall
 *  narrow jug holding less than a wide bowl is the whole point of the compare. */
const shapeBox = (shape: ContainerShape): { w: number; h: number } => {
  switch (shape) {
    case 'tall': return { w: 62, h: 150 };
    case 'wide': return { w: 128, h: 78 };
    case 'round':
    default: return { w: 96, h: 104 };
  }
};

interface ContainerViewProps {
  container: MeasureContainer;
  /** Units currently in it. */
  poured: number;
  /** Units it takes to fill — used only for the fill fraction. */
  capacity: number;
  selected?: boolean;
  state?: 'idle' | 'selected' | 'correct' | 'incorrect';
  badge?: string;
  onClick?: () => void;
}

const ContainerView: React.FC<ContainerViewProps> = ({
  container, poured, capacity, state = 'idle', badge, onClick,
}) => {
  const { w, h } = shapeBox(container.shape);
  const fillFrac = capacity > 0 ? Math.max(0, Math.min(1, poured / capacity)) : 0;
  const fillH = Math.round(h * fillFrac);
  const rounded = container.shape === 'round' ? 28 : 8;

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${answerStateClass(state)} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <svg width={w + 16} height={h + 16} viewBox={`0 0 ${w + 16} ${h + 16}`} aria-hidden>
        {/* the water, drawn from the bottom up */}
        <rect
          x={8}
          y={8 + (h - fillH)}
          width={w}
          height={fillH}
          rx={Math.min(rounded, fillH / 2)}
          fill="rgba(56,189,248,0.55)"
          className="transition-all duration-500"
        />
        {/* the glass */}
        <rect
          x={8} y={8} width={w} height={h} rx={rounded}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2.5}
        />
      </svg>
      <span className="text-sm text-slate-200">{container.name}</span>
      {badge ? <span className="text-xs font-mono text-cyan-300">{badge}</span> : null}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Phase config
// ---------------------------------------------------------------------------

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  balance_predict: { label: 'Heavier', icon: '⚖️', accentColor: 'amber' },
  capacity_predict: { label: 'Holds More', icon: '🫗', accentColor: 'cyan' },
  pour_count: { label: 'How Many Cups', icon: '🥤', accentColor: 'emerald' },
  order_capacity: { label: 'Least to Most', icon: '📶', accentColor: 'purple' },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MeasureLab: React.FC<MeasureLabProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `measure-lab-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const {
    currentIndex,
    currentAttempts,
    results,
    isComplete,
    recordResult,
    incrementAttempts,
    advance,
  } = useChallengeProgress({ challenges, getChallengeId: (c) => c.id });

  const currentChallenge = challenges[currentIndex] ?? null;

  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: (c) => c.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const evaluation = usePrimitiveEvaluation<MeasureLabMetrics>({
    primitiveType: 'measure-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Per-challenge interaction state ───────────────────────────────────────
  /** The prediction the child committed BEFORE testing (id), or null. */
  const [prediction, setPrediction] = useState<string | null>(null);
  /** Objects placed on the balance pans, by side. */
  const [placed, setPlaced] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  /** Units poured, per container id. */
  const [poured, setPoured] = useState<Record<string, number>>({});
  /** order_capacity: the order the child has tapped so far. */
  const [order, setOrder] = useState<string[]>([]);
  /** pour_count: the number the child chose. */
  const [chosenCount, setChosenCount] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const recordedRef = useRef(false);
  const completeFiredRef = useRef(false);
  /**
   * The beam-settling delay, owned by a ref rather than by an effect.
   *
   * The first version put the `setTimeout` inside a `useEffect` keyed on
   * [bothPlaced, prediction, currentChallenge, feedback, submit]. `submit` is
   * rebuilt whenever the tutor hook re-renders, so any re-render inside the
   * 900ms window would have cleared the pending timer and swallowed the verdict.
   * It was not observed failing in the Chrome drive, but a delay that any
   * unrelated re-render can cancel is a race waiting for a slower machine, so
   * the timer is owned here where nothing else can reach it.
   */
  const verdictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Always the latest `submit`, so the timer never fires a stale closure. */
  const submitRef = useRef<(correct: boolean, extras?: Record<string, unknown>) => void>(() => {});

  // Per-challenge reset — every slot above that depends on the active challenge.
  useEffect(() => {
    if (!currentChallenge) return;
    setPrediction(null);
    setPlaced({ left: false, right: false });
    setPoured({});
    setOrder([]);
    setChosenCount(null);
    setFeedback(null);
    setShowHint(false);
    recordedRef.current = false;
    if (verdictTimerRef.current) { clearTimeout(verdictTimerRef.current); verdictTimerRef.current = null; }
  }, [currentChallenge?.id]);

  useEffect(() => () => {
    if (verdictTimerRef.current) clearTimeout(verdictTimerRef.current);
  }, []);

  // ── AI tutoring ───────────────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    title,
    challengeType: currentChallenge?.type,
    currentChallengeIndex: currentIndex,
    totalChallenges: challenges.length,
    currentPrompt: currentChallenge?.prompt,
    attemptNumber: currentAttempts,
    // Stimulus only — no weight, no capacity, no answer.
    objects: currentChallenge?.left && currentChallenge?.right
      ? `${currentChallenge.left.name} and ${currentChallenge.right.name}`
      : undefined,
    containers: [
      currentChallenge?.containerA?.name,
      currentChallenge?.containerB?.name,
      ...(currentChallenge?.containers ?? []).map((c) => c.name),
      currentChallenge?.container?.name,
    ].filter(Boolean).join(', '),
    unitName: currentChallenge?.unitName,
  }), [title, currentChallenge, currentIndex, challenges.length, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'measure-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K',
  });

  const introducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || introducedRef.current || !currentChallenge) return;
    introducedRef.current = true;
    sendText(
      `[ACTIVITY_START] ${title}. ${challenges.length} measuring challenges. First: ${currentChallenge.prompt}`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, challenges.length, title, sendText]);

  const announcedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected || !currentChallenge || !introducedRef.current) return;
    if (announcedRef.current === null) { announcedRef.current = currentChallenge.id; return; }
    if (announcedRef.current === currentChallenge.id) return;
    announcedRef.current = currentChallenge.id;
    sendText(
      `[NEXT_ITEM] Challenge ${currentIndex + 1} of ${challenges.length}. ${currentChallenge.prompt}`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, currentIndex, challenges.length, sendText]);

  // ── Judging ───────────────────────────────────────────────────────────────
  const submit = useCallback((correct: boolean, extras: Record<string, unknown> = {}) => {
    if (!currentChallenge) return;
    incrementAttempts();
    setFeedback(correct ? 'correct' : 'incorrect');
    if (!correct) {
      SoundManager.playIncorrect();
      setShowHint(true);
      sendText(
        `[ANSWER_INCORRECT] ${currentChallenge.type}: the child's answer was wrong on attempt ${currentAttempts + 1}. Give one short hint — never the answer.`,
        { silent: true },
      );
      return;
    }
    SoundManager.playCorrect();
    if (recordedRef.current) return;
    recordedRef.current = true;
    recordResult({
      challengeId: currentChallenge.id,
      correct: true,
      attempts: currentAttempts + 1,
      ...extras,
    });
    sendText(
      `[ANSWER_CORRECT] ${currentChallenge.type} solved on attempt ${currentAttempts + 1}. Congratulate briefly.`,
      { silent: true },
    );
  }, [currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText]);

  submitRef.current = submit;

  // ── Session complete ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComplete || completeFiredRef.current || challenges.length === 0) return;
    completeFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => r.correct && r.attempts === 1).length;
    const perChallenge = (r: typeof results[number]) =>
      r.correct ? Math.max(20, 100 - (r.attempts - 1) * 20) : 0;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + perChallenge(r), 0) / Math.max(1, results.length),
    );

    const metrics: MeasureLabMetrics = {
      type: 'measure-lab',
      challengeType: challenges[0].type,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed: results.filter((r) => r.attempts > 1).length,
      overallAccuracy,
      averageAttemptsPerChallenge:
        Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10,
    };

    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseResults.map((p) => `${p.label} ${p.score}%`).join(', ')}. Overall ${overallAccuracy}%. Celebrate the measuring work.`,
      { silent: true },
    );

    if (!evaluation.hasSubmitted) {
      evaluation.submitResult(correctCount === challenges.length, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          prompts: challenges.map((c) => c.prompt),
        },
      });
    }
  }, [isComplete, results, challenges, phaseResults, sendText, evaluation]);

  // ── Interactions ──────────────────────────────────────────────────────────
  const bothPlaced = placed.left && placed.right;

  const handlePlace = (side: 'left' | 'right') => {
    if (!currentChallenge || prediction === null || feedback === 'correct') return;
    if (placed[side]) return;
    SoundManager.tick();
    const next = { ...placed, [side]: true };
    setPlaced(next);

    // The balance settling IS the verdict, and what it grades is the prediction
    // the child already committed to. The wait lets the beam finish tipping, so
    // the child sees the evidence before the words.
    if (next.left && next.right && !recordedRef.current) {
      const expected = currentChallenge.expectedChoice;
      if (verdictTimerRef.current) clearTimeout(verdictTimerRef.current);
      verdictTimerRef.current = setTimeout(() => {
        verdictTimerRef.current = null;
        submitRef.current(prediction === expected, { prediction });
      }, 900);
    }
  };

  const handlePour = (containerId: string, capacity: number) => {
    if (!currentChallenge || feedback === 'correct') return;
    const already = poured[containerId] ?? 0;
    if (already >= capacity) return; // it is full — pouring more would spill
    SoundManager.tick();
    setPoured((prev) => ({ ...prev, [containerId]: already + 1 }));
  };

  const handleCapacityTest = () => {
    if (!currentChallenge?.containerA || !currentChallenge?.containerB) return;
    const a = currentChallenge.containerA;
    const b = currentChallenge.containerB;
    setPoured({ [a.id]: a.capacity, [b.id]: b.capacity });
    setTimeout(() => {
      if (recordedRef.current) return;
      submit(prediction === currentChallenge.expectedChoice, { prediction });
    }, 900);
  };

  const handleOrderTap = (containerId: string) => {
    if (!currentChallenge || feedback === 'correct') return;
    if (order.includes(containerId)) {
      setOrder((prev) => prev.filter((id) => id !== containerId));
      return;
    }
    SoundManager.tick();
    const next = [...order, containerId];
    setOrder(next);
    if (next.length === (currentChallenge.containers?.length ?? 0)) {
      const expected = currentChallenge.expectedOrder ?? [];
      submit(next.length === expected.length && next.every((id, i) => id === expected[i]), { order: next });
    }
  };

  const handleCountChoice = (n: number) => {
    if (!currentChallenge || feedback === 'correct') return;
    setChosenCount(n);
    submit(n === currentChallenge.expectedCount, { chosen: n });
  };

  const advanceToNext = () => { advance(); };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full max-w-4xl mx-auto my-12 ${className || ''}`}>
        <LuminaCard className="rounded-3xl p-6 text-center">
          <p className="text-slate-300">No measuring challenges available.</p>
        </LuminaCard>
      </div>
    );
  }

  const ch = currentChallenge;
  const unitEmoji = ch?.unitEmoji || '🥤';
  const unitName = ch?.unitName || 'cups';

  return (
    <div className={`w-full max-w-4xl mx-auto my-12 animate-fade-in ${className || ''}`}>
      <LuminaCard className="rounded-3xl">
        <LuminaCardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            </div>
            {ch ? (
              <LuminaBadge accent="cyan" className="text-xs">
                {PHASE_TYPE_CONFIG[ch.type]?.icon} {PHASE_TYPE_CONFIG[ch.type]?.label}
              </LuminaBadge>
            ) : null}
          </div>
        </LuminaCardHeader>

        <LuminaCardContent className="space-y-5">
          {!isComplete && challenges.length > 1 ? (
            <div className="flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(currentIndex + 1, challenges.length)}
                total={challenges.length}
                variant="dots"
                accent="cyan"
              />
            </div>
          ) : null}

          {!isComplete && ch ? (
            <>
              <LuminaPrompt accent="cyan" center>
                <span className="text-base">{ch.prompt}</span>
              </LuminaPrompt>

              {/* ── balance_predict ───────────────────────────────────────── */}
              {ch.type === 'balance_predict' && ch.left && ch.right ? (
                <div className="space-y-4">
                  {prediction === null ? (
                    <div className="space-y-2">
                      <div className="text-center">
                        <LuminaSectionLabel accent="amber" size="sm">
                          First — which one do you think is heavier?
                        </LuminaSectionLabel>
                      </div>
                      <div className="flex justify-center gap-4">
                        {[ch.left, ch.right].map((obj) => (
                          <button
                            key={obj.id}
                            type="button"
                            onClick={() => { SoundManager.select(); setPrediction(obj.id); }}
                            className={`flex flex-col items-center gap-1 rounded-2xl border px-6 py-4 transition ${answerStateClass('idle')}`}
                          >
                            <span className="text-4xl leading-none">{obj.emoji}</span>
                            <span className="text-sm text-slate-200">{obj.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <LuminaSectionLabel accent="amber" size="sm">
                        Now put them both on the scale
                      </LuminaSectionLabel>
                    </div>
                  )}

                  {/* The bench. The beam tips because of what is on it. */}
                  <div className="flex justify-center">
                    <svg width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} className="max-w-full h-auto">
                      {(() => {
                        const cx = STAGE_W / 2;
                        const beamY = 96;
                        const arm = 170;
                        const tilt = bothPlaced ? tiltFor(ch.left!.weight, ch.right!.weight) : 0;
                        const dy = Math.tan((tilt * Math.PI) / 180) * arm;
                        return (
                          <g>
                            {/* stand */}
                            <rect x={cx - 8} y={beamY} width={16} height={150} rx={6} fill="rgba(255,255,255,0.12)" />
                            <rect x={cx - 70} y={STAGE_H - 40} width={140} height={14} rx={7} fill="rgba(255,255,255,0.16)" />
                            {/* beam */}
                            <g className="transition-transform duration-700" style={{ transformOrigin: `${cx}px ${beamY}px`, transform: `rotate(${tilt}deg)` }}>
                              <rect x={cx - arm} y={beamY - 5} width={arm * 2} height={10} rx={5} fill="rgba(148,163,184,0.85)" />
                            </g>
                            {/* pans, hanging level from the beam ends */}
                            {([['left', -1], ['right', 1]] as const).map(([side, dir]) => {
                              const px = cx + dir * arm;
                              const py = beamY + dir * dy + 60;
                              const obj = side === 'left' ? ch.left! : ch.right!;
                              const on = placed[side];
                              return (
                                <g key={side} className="transition-transform duration-700" style={{ transform: `translateY(${dir * dy}px)` }}>
                                  <line x1={px} y1={beamY} x2={px} y2={py - 12} stroke="rgba(148,163,184,0.6)" strokeWidth={2} />
                                  <rect x={px - 52} y={py - 12} width={104} height={12} rx={6} fill="rgba(148,163,184,0.7)" />
                                  {on ? (
                                    <text x={px} y={py - 30} textAnchor="middle" fontSize={34} className="select-none">
                                      {obj.emoji}
                                    </text>
                                  ) : null}
                                </g>
                              );
                            })}
                          </g>
                        );
                      })()}
                    </svg>
                  </div>

                  {prediction !== null && !bothPlaced ? (
                    <div className="flex justify-center gap-4">
                      {(['left', 'right'] as const).map((side) => {
                        const obj = side === 'left' ? ch.left! : ch.right!;
                        if (placed[side]) return null;
                        return (
                          <button
                            key={side}
                            type="button"
                            onClick={() => handlePlace(side)}
                            className={`flex flex-col items-center gap-1 rounded-2xl border px-6 py-3 transition ${answerStateClass('idle')}`}
                          >
                            <span className="text-4xl leading-none">{obj.emoji}</span>
                            <span className="text-xs text-slate-300">Put {obj.name} on</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* ── capacity_predict ──────────────────────────────────────── */}
              {ch.type === 'capacity_predict' && ch.containerA && ch.containerB ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <LuminaSectionLabel accent="cyan" size="sm">
                      {prediction === null
                        ? 'First — which one do you think holds more?'
                        : `Now fill them both with ${unitName} and see`}
                    </LuminaSectionLabel>
                  </div>
                  <div className="flex justify-center items-end gap-8">
                    {[ch.containerA, ch.containerB].map((c) => (
                      <ContainerView
                        key={c.id}
                        container={c}
                        poured={poured[c.id] ?? 0}
                        capacity={c.capacity}
                        state={prediction === c.id ? 'selected' : 'idle'}
                        badge={poured[c.id] ? `${poured[c.id]} ${unitName}` : undefined}
                        onClick={prediction === null && feedback !== 'correct'
                          ? () => { SoundManager.select(); setPrediction(c.id); }
                          : undefined}
                      />
                    ))}
                  </div>
                  {prediction !== null && !Object.keys(poured).length ? (
                    <div className="flex justify-center">
                      <LuminaActionButton action="check" onClick={handleCapacityTest}>
                        Pour {unitName} into both
                      </LuminaActionButton>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* ── pour_count ────────────────────────────────────────────── */}
              {ch.type === 'pour_count' && ch.container ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <ContainerView
                      container={ch.container}
                      poured={poured[ch.container.id] ?? 0}
                      capacity={ch.container.capacity}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <LuminaSectionLabel accent="emerald" size="sm">
                      Tap a {unitName.replace(/s$/, '')} to pour it in
                    </LuminaSectionLabel>
                    <div className="flex flex-wrap justify-center gap-2">
                      {Array.from({ length: ch.container.capacity + 2 }).map((_, i) => {
                        const used = i < (poured[ch.container!.id] ?? 0);
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={used || feedback === 'correct'}
                            onClick={() => handlePour(ch.container!.id, ch.container!.capacity)}
                            className={`text-3xl leading-none transition ${used ? 'opacity-20' : 'hover:scale-110'}`}
                            aria-label="Pour one in"
                          >
                            {unitEmoji}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {(poured[ch.container.id] ?? 0) >= ch.container.capacity ? (
                    <div className="space-y-2">
                      <p className="text-center text-sm text-cyan-300">It is full! How many did it take?</p>
                      <div className="flex flex-wrap justify-center gap-3">
                        {(ch.options ?? []).map((opt) => (
                          <LuminaAnswerChoice
                            key={opt}
                            state={
                              chosenCount === opt
                                ? (feedback === 'correct' ? 'correct' : 'incorrect')
                                : feedback === 'correct' && opt === ch.expectedCount ? 'correct' : 'idle'
                            }
                            disabled={feedback === 'correct'}
                            onClick={() => handleCountChoice(opt)}
                            className="w-auto min-w-[64px] pl-5 pr-9 py-3 text-center font-mono text-lg"
                          >
                            {opt}
                          </LuminaAnswerChoice>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* ── order_capacity ────────────────────────────────────────── */}
              {ch.type === 'order_capacity' && ch.containers ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <LuminaSectionLabel accent="purple" size="sm">
                      Tap them in order — the least first
                    </LuminaSectionLabel>
                  </div>
                  <div className="flex justify-center items-end gap-6">
                    {ch.containers.map((c) => {
                      const pos = order.indexOf(c.id);
                      return (
                        <ContainerView
                          key={c.id}
                          container={c}
                          poured={c.filled ?? 0}
                          capacity={c.capacity}
                          state={pos >= 0 ? 'selected' : 'idle'}
                          badge={pos >= 0 ? `#${pos + 1}` : undefined}
                          onClick={feedback === 'correct' ? undefined : () => handleOrderTap(c.id)}
                        />
                      );
                    })}
                  </div>
                  {order.length > 0 && feedback !== 'correct' ? (
                    <div className="flex justify-center">
                      <LuminaButton tone="ghost" onClick={() => setOrder([])}>Start over</LuminaButton>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {feedback ? (
                <LuminaFeedbackCard
                  status={feedback === 'correct' ? 'correct' : 'incorrect'}
                  label={feedback === 'correct' ? 'Nice work' : 'Not quite'}
                  teachingNote={feedback === 'incorrect' && showHint ? ch.hint : undefined}
                >
                  {feedback === 'correct' ? 'You tested it and you were right.' : 'Look at what happened, then try again.'}
                </LuminaFeedbackCard>
              ) : null}

              {feedback === 'correct' ? (
                <div className="text-center">
                  <LuminaActionButton action="next" onClick={advanceToNext}>
                    {currentIndex + 1 < challenges.length ? 'Next →' : 'Finish'}
                  </LuminaActionButton>
                </div>
              ) : null}
            </>
          ) : null}

          {isComplete && phaseResults.length > 0 ? (
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={evaluation.submittedResult?.score}
              durationMs={evaluation.elapsedMs}
              heading="Measuring Complete!"
              celebrationMessage={`You tested ${challenges.length} ${challenges.length === 1 ? 'thing' : 'things'} yourself!`}
              className="mt-4"
            />
          ) : null}
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

export default MeasureLab;
