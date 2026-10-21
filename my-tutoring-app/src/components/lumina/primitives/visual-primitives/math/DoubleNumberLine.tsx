'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  usePrimitiveEvaluation,
  type DoubleNumberLineMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaPrompt,
  LuminaCallout,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaActionButton,
  LuminaBadge,
  answerStateClass,
  type AnswerChoiceState,
} from '../../../ui';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  answerLabel, describeRatioWork, ratioLineMiss, valuesCorrect, workspaceScene,
} from './doubleNumberLineWorkspace';
import {
  GROW_MODEL_CAPTION, GROW_MODEL_LEVER, RATIO_LINE_LEVERS, SPLIT_GIVEN_LEVER, UNIT_JUMPS_LEVER, jumpsFor, splitFor,
} from './doubleNumberLineLevers';
import { doubleNumberLineBoss } from './doubleNumberLine.boss';

/**
 * Double Number Line — Multi-instance proportional reasoning primitive.
 *
 * A single session walks the student through 3-6 ratio challenges that all
 * share ONE ratio relationship (same topLabel / bottomLabel / unitRate) for
 * context coherence. Each challenge highlights one target ask-point; the
 * student enters the missing value, gets feedback, and advances.
 *
 * The 3-phase explore→practice→apply walk from the previous design was
 * collapsed per PRD §5 rule 13: the IRT-pinned challengeType IS the phase.
 */

export type DoubleNumberLineChallengeType =
  | 'equivalent_ratios'
  | 'find_missing'
  | 'unit_rate';

export interface LinkedPoint {
  topValue: number;
  bottomValue: number;
  label?: string;
}

export interface ScaleConfig {
  min: number;
  max: number;
  interval: number;
}

export interface DoubleNumberLineChallenge {
  id: string;
  /** Calibration stamp when the ratio-missing-value item space picked the ask. Never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
  challengeType: DoubleNumberLineChallengeType;
  prompt: string;
  hint: string;
  givenPoints: LinkedPoint[];
  targetPoints: LinkedPoint[];
  topScale: ScaleConfig;
  bottomScale: ScaleConfig;
}

export interface DoubleNumberLineData {
  title: string;
  description: string;
  topLabel: string;
  bottomLabel: string;
  unitRate: number;
  contextQuestion: string;
  /** 3-6 challenges. Required. Walked sequentially. */
  challenges: DoubleNumberLineChallenge[];

  showVerticalGuides?: boolean;
  showUnitRate?: boolean;
  /**
   * Tick value-label density. 'all' (default) labels every tick; 'endpoints'
   * keeps only the first + last tick label; 'none' hides interior labels but
   * the min/max ENDPOINTS are ALWAYS kept so the scale magnitude is preserved.
   */
  showTickLabels?: 'all' | 'endpoints' | 'none';
  /**
   * Whether the given-pair value badge is shown on the bottom line (the dot
   * always stays). Defaults true. A support-tier scaffold withdrawal.
   */
  showGivenValues?: boolean;
  /** Active support tier: the scaffolds above are set from it. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: PrimitiveEvaluationResult<DoubleNumberLineMetrics>
  ) => void;
}

interface DoubleNumberLineProps {
  data: DoubleNumberLineData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ---------------------------------------------------------------------------
// Number stepper input — the bespoke answer-entry interaction surface.
// (The −/+ stepper IS the manipulable object here; left as painting.)
// ---------------------------------------------------------------------------

interface LuminaNumberStepperProps {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  borderColor?: string;
  ariaLabel?: string;
}

const LuminaNumberStepper: React.FC<LuminaNumberStepperProps> = ({
  value,
  onChange,
  step = 1,
  placeholder = '?',
  disabled = false,
  autoFocus = false,
  borderColor = 'border-slate-600',
  ariaLabel,
}) => {
  const numValue = parseFloat(value);

  const handleStep = (direction: 1 | -1) => {
    if (disabled) return;
    SoundManager.tick();
    const current = isNaN(numValue) ? 0 : numValue;
    const next = Math.round((current + direction * step) * 100) / 100;
    onChange(String(next));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-' || /^-?\d*\.?\d*$/.test(raw)) {
      onChange(raw);
    }
  };

  return (
    <div className="flex items-stretch gap-0">
      <button
        type="button"
        onClick={() => handleStep(-1)}
        disabled={disabled}
        className="px-3 bg-slate-800/60 border-2 border-r-0 border-slate-600 rounded-l-lg text-slate-300 hover:bg-purple-500/20 hover:text-white hover:border-purple-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bold text-lg select-none"
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value}
        onChange={handleTextChange}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={`flex-1 min-w-0 px-4 py-2.5 bg-slate-900 border-2 ${borderColor} text-white text-base font-semibold text-center focus:outline-none focus:border-purple-500 disabled:opacity-50 transition-colors`}
      />
      <button
        type="button"
        onClick={() => handleStep(1)}
        disabled={disabled}
        className="px-3 bg-slate-800/60 border-2 border-l-0 border-slate-600 rounded-r-lg text-slate-300 hover:bg-purple-500/20 hover:text-white hover:border-purple-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bold text-lg select-none"
      >
        +
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Lever marks (`doubleNumberLineLevers.ts`): drawn on a line's own percent scale, never labelled.
// ---------------------------------------------------------------------------

const JumpArc: React.FC<{ from: number; to: number }> = ({ from, to }) => (
  <div data-lever="unit-jumps" aria-hidden="true"
    className="absolute bottom-full mb-1 h-4 border-t-2 border-x-2 rounded-t-full border-cyan-300/70 pointer-events-none"
    style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%` }} />
);

const SplitMarks: React.FC<{ band: number; marks: number[] }> = ({ band, marks }) => (
  <>
    <div data-lever="split-given" aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 h-2 left-0 bg-amber-300/30 rounded pointer-events-none"
      style={{ width: `${band}%` }} />
    {marks.map((m, j) => (
      <div key={j} data-lever="split-given" aria-hidden="true"
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-5 bg-amber-300 pointer-events-none" style={{ left: `${m}%` }} />
    ))}
  </>
);

// ---------------------------------------------------------------------------
// Phase config (one phase — every challenge in a session shares challengeType)
// ---------------------------------------------------------------------------

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  equivalent_ratios: { label: 'Equivalent Ratios', icon: '⚖️', accentColor: 'purple' },
  find_missing: { label: 'Find Missing', icon: '🔍', accentColor: 'amber' },
  unit_rate: { label: 'Unit Rate', icon: '🎯', accentColor: 'emerald' },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const useDoubleNumberLineProgress = useWorkspaceProgressFor('double-number-line');
const PRACTICE_NOTE = 'An easier practice item is on screen in place of the item. It is not graded; the full item comes back after it.';

const DoubleNumberLineSurface = ({ data, className, runtimePlanItemId }: DoubleNumberLineProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    topLabel,
    bottomLabel,
    contextQuestion,
    challenges = [],
    showVerticalGuides = true,
    showUnitRate = true,
    showTickLabels = 'all',
    showGivenValues = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `double-number-line-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progression: the teaching workspace owns it. ──
  /** Bound below, once the setters and the evaluation exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useDoubleNumberLineProgress({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: doubleNumberLineBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or the next item. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: (c) => c.challengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Evaluation hook ───────────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<DoubleNumberLineMetrics>({
    primitiveType: 'double-number-line',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // In-item levers (`doubleNumberLineLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<DoubleNumberLineChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // ── Per-challenge interaction state ────────────────────────────────────────
  // One input string per target point in the current challenge.
  const [studentValues, setStudentValues] = useState<string[]>(
    () => (currentChallenge?.targetPoints ?? []).map(() => ''),
  );
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const recordedRef = useRef(false);

  // Reset per-challenge state when the active challenge changes, and when an item opens or Try again reopens it.
  const resetChallenge = (ch: DoubleNumberLineChallenge | null) => {
    if (!ch) return;
    setStudentValues(ch.targetPoints.map(() => ''));
    setFeedback(null);
    recordedRef.current = false;
  };
  useEffect(() => {
    resetChallenge(currentChallenge);
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  openItem.current = (index, retry) => {
    // Try again on a practice item keeps it; a fresh item (or the full item back after practice) drops it.
    if (retry) resetChallenge(practice ?? challenges[index] ?? null);
    else { setPractice(null); resetChallenge(challenges[index] ?? null); }
  };

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0) return;
    const metrics: DoubleNumberLineMetrics = {
      type: 'double-number-line',
      challengeType: challenges[0].challengeType,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleCheckAnswers = useCallback(() => {
    if (!currentChallenge || feedback === 'correct' || isComplete || learnerBlocked()) return;

    // Stale-state guard: setStudentValues from the reset effect is async — on
    // the render immediately after advance(), `studentValues` still holds the
    // previous challenge's values while `currentChallenge` has already moved
    // on. Only proceed when the slot count matches.
    if (studentValues.length !== currentChallenge.targetPoints.length) return;

    // The checked gesture: counts the attempt and records the verdict.
    const allCorrect = valuesCorrect(currentChallenge, studentValues);
    const response = describeRatioWork(currentChallenge, studentValues, bottomLabel, topLabel);

    if (allCorrect) {
      SoundManager.playCorrect();
      setFeedback('correct');
      if (!recordedRef.current) {
        recordedRef.current = true;
        progress.commitCheck(response, true);
      }
    } else {
      SoundManager.playIncorrect();
      setFeedback('incorrect');
      progress.commitCheck(response, false, ratioLineMiss(currentChallenge, studentValues));
    }
  }, [
    currentChallenge, feedback, isComplete, studentValues, bottomLabel, topLabel, progress.commitCheck,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Position helpers (per current challenge's scales) ──────────────────────
  const topScale = currentChallenge?.topScale;
  const bottomScale = currentChallenge?.bottomScale;

  const getTopPosition = (value: number): number => {
    if (!topScale) return 0;
    return ((value - topScale.min) / Math.max(0.0001, topScale.max - topScale.min)) * 100;
  };
  const getBottomPosition = (value: number): number => {
    if (!bottomScale) return 0;
    return ((value - bottomScale.min) / Math.max(0.0001, bottomScale.max - bottomScale.min)) * 100;
  };

  const topTicks = useMemo(() => {
    if (!topScale) return [];
    const count = Math.floor((topScale.max - topScale.min) / topScale.interval) + 1;
    return Array.from({ length: count }, (_, i) => {
      const value = topScale.min + i * topScale.interval;
      return { value: Math.round(value * 100) / 100, position: getTopPosition(value) };
    });
  }, [topScale]);

  const bottomTicks = useMemo(() => {
    if (!bottomScale) return [];
    const count = Math.floor((bottomScale.max - bottomScale.min) / bottomScale.interval) + 1;
    return Array.from({ length: count }, (_, i) => {
      const value = bottomScale.min + i * bottomScale.interval;
      return { value: Math.round(value * 100) / 100, position: getBottomPosition(value) };
    });
  }, [bottomScale]);

  // Tick value-label visibility per support tier. 'all' → every tick;
  // 'endpoints' → first + last only; 'none' → still keep first + last so the
  // scale magnitude is NEVER hidden (hiding all labels could read as a
  // magnitude change). Interior labels are withdrawn at 'endpoints'/'none'.
  const showTickLabelAt = useCallback(
    (index: number, total: number): boolean => {
      if (showTickLabels === 'all') return true;
      return index === 0 || index === total - 1; // endpoints always kept
    },
    [showTickLabels],
  );

  /** What the pulled drawn levers put on the lines (never on a practice item). */
  const leverJumps = currentChallenge && leverOn(UNIT_JUMPS_LEVER) ? jumpsFor(currentChallenge) : null;
  const leverSplit = currentChallenge && leverOn(SPLIT_GIVEN_LEVER) ? splitFor(currentChallenge) : null;

  /** A bottom tick that sits at an asked point's value (to the tick's rounding). */
  const askedBottom = (value: number) =>
    !!currentChallenge?.targetPoints.some((t) => Math.abs(Math.round(t.bottomValue * 100) / 100 - value) < 1e-6);
  /** A bottom tick at a drawn given point's value (the unit-rate point only while it is drawn). */
  const givenBottom = (value: number) =>
    !!currentChallenge?.givenPoints.some((p) => (showUnitRate || !(Math.abs(p.topValue - 1) < 0.01 && p.label === 'Unit Rate'))
      && Math.abs(Math.round(p.bottomValue * 100) / 100 - value) < 1e-6);

  // What the tutor and the observer are shown, republished every render. Every mode declares levers
  // (`RATIO_LINE_LEVERS`).
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const labels = { topLabel, bottomLabel };
    const scene = workspaceScene(currentChallenge, {
      topLabel, bottomLabel, contextQuestion, values: studentValues,
      showVerticalGuides, showUnitRate, showTickLabels, showGivenValues,
    });
    const levers = practice ? [] : RATIO_LINE_LEVERS.declare(sessionChallenge, labels, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : RATIO_LINE_LEVERS.support(sessionChallenge, labels),
      onScreen: practice ? '' : RATIO_LINE_LEVERS.onScreen(sessionChallenge, labels, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = RATIO_LINE_LEVERS.simpler(sessionChallenge, labels, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetChallenge(easier);
          return { practice: doubleNumberLineBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetChallenge(sessionChallenge); },
    };
  });

  // ── Empty state ────────────────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full max-w-5xl mx-auto my-12 ${className || ''}`}>
        <LuminaCard className="rounded-3xl p-6 text-center">
          <p className="text-slate-300">No double-number-line challenges available.</p>
        </LuminaCard>
      </div>
    );
  }

  const allInputsFilled =
    !!currentChallenge && studentValues.every((v) => v !== '' && !isNaN(parseFloat(v)));

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Double Number Line</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">
              {currentChallenge ? currentChallenge.challengeType.replace(/_/g, ' ') : 'Proportional Reasoning'}
            </p>
          </div>
        </div>
      </div>

      <LuminaCard className="rounded-3xl border-purple-500/20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        <LuminaCardContent className="relative z-10 p-8 md:p-16">
          {/* Title + description */}
          <div className="mb-8 text-center max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>

            {/* Umbrella context — shared across all challenges */}
            {contextQuestion && (
              <LuminaCallout accent="blue" label="Context" className="mt-4 text-left">
                {contextQuestion}
              </LuminaCallout>
            )}
          </div>

          {/* Progress dots */}
          {!isComplete && challenges.length > 1 && (
            <div className="mb-8 flex items-center justify-center gap-3">
              <LuminaChallengeCounter
                current={Math.min(currentIndex + 1, challenges.length)}
                total={challenges.length}
                className="text-purple-300 font-mono uppercase tracking-wider"
              />
              <div className="flex gap-1.5">
                {challenges.map((ch, idx) => {
                  const done = results.some((r) => r.challengeId === ch.id);
                  const isCurrent = idx === currentIndex && !isComplete;
                  return (
                    <div
                      key={ch.id}
                      className={`w-2.5 h-2.5 rounded-full border ${
                        done
                          ? 'bg-green-400/70 border-green-300/80 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                          : isCurrent
                          ? 'bg-purple-400/70 border-purple-300/80 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                          : 'bg-slate-700/40 border-slate-600/50'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-challenge prompt */}
          {!isComplete && currentChallenge && (
            <LuminaPrompt accent="purple" center className="mb-8 max-w-2xl mx-auto">
              {practice && (
                <LuminaBadge accent="amber" className="mb-2 text-[10px] uppercase tracking-wider">Practice</LuminaBadge>
              )}
              <p>{currentChallenge.prompt}</p>
            </LuminaPrompt>
          )}

          {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the lines and the answer
              boxes as one region. */}
          {!isComplete && <PipDock />}
          <PipWorkspace>
          {/* Double Number Line Visualization */}
          {!isComplete && currentChallenge && topScale && bottomScale && (
            <div className="w-full max-w-3xl mx-auto px-8 py-12 space-y-24">
              {/* Top Number Line */}
              <div className="relative">
                <div className="absolute -top-8 left-0 text-sm font-semibold text-purple-300 uppercase tracking-wide">
                  {topLabel}
                </div>
                <div className="relative h-1 bg-slate-600 rounded-full">
                  {/* Ticks */}
                  {topTicks.map((tick, i) => (
                    <div
                      key={i}
                      className="absolute w-px h-4 bg-slate-500 top-full mt-1 flex flex-col items-center -translate-x-1/2"
                      style={{ left: `${tick.position}%` }}
                    >
                      {showTickLabelAt(i, topTicks.length) && (
                        <span className="mt-2 text-sm text-slate-400 font-mono font-semibold">
                          {tick.value}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Given (hint) points */}
                  {currentChallenge.givenPoints.map((point, i) => {
                    const isUnitRatePoint = Math.abs(point.topValue - 1) < 0.01 && point.label === 'Unit Rate';
                    // When showUnitRate is withdrawn (medium/hard), drop the
                    // unit-rate dot entirely — re-rendering it as a plain given
                    // point would leak the very cue the tier withheld.
                    if (isUnitRatePoint && !showUnitRate) return null;
                    const position = getTopPosition(point.topValue);
                    const isUnitRate = showUnitRate && isUnitRatePoint;
                    // The "Given"/unit-rate top label badge is a scaffold tag —
                    // withdrawn with the given-value badges at harder tiers.
                    // (ORIGIN's 'Start' label likewise.) The unit-rate badge
                    // rides showUnitRate, which is already false here if hidden.
                    const showLabelBadge = isUnitRate || showGivenValues;
                    return (
                      <div
                        key={`given-top-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${position}%` }}
                      >
                        <div className={`w-4 h-4 rounded-full ${isUnitRate ? 'bg-yellow-500' : 'bg-purple-500'} border-2 border-white shadow-[0_0_15px_rgba(168,85,247,0.5)]`} />
                        {point.label && showLabelBadge && (
                          <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 text-xs rounded whitespace-nowrap ${isUnitRate ? 'bg-yellow-600 text-white' : 'bg-purple-600 text-white'}`}>
                            {isUnitRate ? 'Unit Rate' : point.label}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Target points — show top value (always given to student) */}
                  {currentChallenge.targetPoints.map((point, i) => {
                    const position = getTopPosition(point.topValue);
                    return (
                      <div
                        key={`target-top-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${position}%` }}
                      >
                        <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-blue-300" />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-800/90 px-2 py-1 rounded whitespace-nowrap">
                          {point.topValue}
                        </div>
                      </div>
                    );
                  })}

                  {/* Levers on the top line: unlabelled, never a value. */}
                  {leverJumps && Array.from({ length: leverJumps.steps }, (_, k) => (
                    <JumpArc key={`jump-top-${k}`} from={getTopPosition(k)} to={getTopPosition(k + 1)} />
                  ))}
                  {leverSplit && <SplitMarks band={getTopPosition(leverSplit.top)}
                    marks={Array.from({ length: leverSplit.parts - 1 }, (_, j) => getTopPosition(((j + 1) * leverSplit.top) / leverSplit.parts))} />}
                </div>
              </div>

              {/* Vertical Alignment Guides for given points */}
              {showVerticalGuides && currentChallenge.givenPoints.map((point, i) => {
                const topPosition = getTopPosition(point.topValue);
                return (
                  <div
                    key={`guide-${i}`}
                    className="absolute h-24 w-px -mt-12 bg-purple-400/20 pointer-events-none"
                    style={{ left: `${topPosition}%`, transform: 'translateX(-50%)' }}
                  />
                );
              })}

              {/* Bottom Number Line */}
              <div className="relative">
                <div className="absolute -top-8 left-0 text-sm font-semibold text-purple-300 uppercase tracking-wide">
                  {bottomLabel}
                </div>
                <div className="relative h-1 bg-slate-600 rounded-full">
                  {/* Ticks */}
                  {bottomTicks.map((tick, i) => (
                    <div
                      key={i}
                      className="absolute w-px h-4 bg-slate-500 top-full mt-1 flex flex-col items-center -translate-x-1/2"
                      style={{ left: `${tick.position}%` }}
                    >
                      {/* The bottom values are what the learner finds, so the bottom line prints only its ends and the
                          given pairs' values, whatever the tier: with the tick interval equal to the rate, a fully
                          labelled bottom line printed every answer and the rate. The tick under an asked point shows ?. */}
                      {(askedBottom(tick.value) || ((i === 0 || i === bottomTicks.length - 1 || givenBottom(tick.value))
                        && showTickLabelAt(i, bottomTicks.length))) && (
                        <span className="mt-2 text-sm text-slate-400 font-mono font-semibold">
                          {askedBottom(tick.value) ? '?' : tick.value}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Given (hint) points on bottom */}
                  {currentChallenge.givenPoints.map((point, i) => {
                    // Mirror the top line: drop the unit-rate point's bottom dot
                    // when the unit-rate cue is withdrawn, so it can't leak.
                    const isUnitRatePoint = Math.abs(point.topValue - 1) < 0.01 && point.label === 'Unit Rate';
                    if (isUnitRatePoint && !showUnitRate) return null;
                    const position = getBottomPosition(point.bottomValue);
                    return (
                      <div
                        key={`given-bottom-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${position}%` }}
                      >
                        <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                        {/* Given-pair value badge — withdrawn at harder tiers
                            (showGivenValues=false) while the dot stays plotted. */}
                        {showGivenValues && (
                          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-800/90 px-2 py-1 rounded whitespace-nowrap">
                            {point.bottomValue}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Levers on the bottom line: the matching jumps or parts, unlabelled. */}
                  {leverJumps && Array.from({ length: leverJumps.steps }, (_, k) => (
                    <JumpArc key={`jump-bottom-${k}`} from={getBottomPosition(k * leverJumps.rate)} to={getBottomPosition((k + 1) * leverJumps.rate)} />
                  ))}
                  {leverSplit && <SplitMarks band={getBottomPosition(leverSplit.bottom)}
                    marks={Array.from({ length: leverSplit.parts - 1 }, (_, j) => getBottomPosition(((j + 1) * leverSplit.bottom) / leverSplit.parts))} />}

                  {/* Student-entered values on bottom */}
                  {currentChallenge.targetPoints.map((point, i) => {
                    const position = getBottomPosition(point.bottomValue);
                    const studentValue = parseFloat(studentValues[i] ?? '');
                    const hasValue = !isNaN(studentValue);
                    const studentPosition = hasValue ? getBottomPosition(studentValue) : position;
                    return (
                      <div
                        key={`target-bottom-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${hasValue && feedback !== 'correct' ? studentPosition : position}%` }}
                      >
                        <div className={`w-3 h-3 rounded-full border-2 ${
                          feedback === 'correct'
                            ? 'bg-green-500 border-green-300'
                            : hasValue
                            ? 'bg-blue-400 border-blue-300'
                            : 'bg-slate-700 border-slate-500'
                        }`} />
                        {hasValue && (
                          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-800/90 px-2 py-1 rounded whitespace-nowrap">
                            {studentValue}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* `grow_model` lever: a picture outside the item, with no number. */}
          {!isComplete && leverOn(GROW_MODEL_LEVER) && (
            <figure data-lever="grow-model" className="mx-auto w-64 text-center space-y-1">
              <div className="flex gap-0.5 w-1/2">
                {[0, 1, 2].map((k) => <div key={k} className="flex-1 h-3 border-t-2 border-x-2 rounded-t-full border-cyan-300/70" />)}
              </div>
              <div className="flex gap-0.5">
                {[0, 1, 2].map((k) => <div key={k} className="flex-1 h-3 border-t-2 border-x-2 rounded-t-full border-amber-300/70" />)}
              </div>
              <figcaption className="text-[11px] text-slate-400">{GROW_MODEL_CAPTION}</figcaption>
            </figure>
          )}

          {/* Input section */}
          {!isComplete && currentChallenge && (
            <div className="mt-12 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {currentChallenge.targetPoints.map((target, i) => {
                  const studentVal = parseFloat(studentValues[i] ?? '');
                  const filled = !isNaN(studentVal);
                  // Grading colors are FRAME → tokenize via answerStateClass.
                  const gradeState: AnswerChoiceState =
                    feedback === 'correct'
                      ? 'correct'
                      : feedback === 'incorrect' && filled
                      ? 'incorrect'
                      : filled
                      ? 'selected'
                      : 'idle';
                  return (
                    <div
                      key={i}
                      className={`p-5 rounded-xl border-2 transition-all ${answerStateClass(gradeState)}`}
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                            {topLabel} = <span className="text-purple-300">{target.topValue}</span>
                          </label>
                          <div className="text-xs text-slate-500 mb-1">What is {bottomLabel}?</div>
                          <LuminaNumberStepper
                            ariaLabel={answerLabel(bottomLabel, topLabel, target.topValue)}
                            value={studentValues[i] ?? ''}
                            onChange={(val) => {
                              if (feedback === 'correct' || learnerBlocked()) return;
                              setStudentValues((prev) => {
                                const next = [...prev];
                                next[i] = val;
                                return next;
                              });
                              setFeedback(null);
                            }}
                            step={1}
                            autoFocus={i === 0}
                            disabled={feedback === 'correct' || blocked}
                            borderColor={
                              feedback === 'correct'
                                ? 'border-green-500'
                                : feedback === 'incorrect' && filled
                                ? 'border-red-500'
                                : 'border-slate-600'
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feedback */}
              {feedback && (
                <LuminaFeedbackCard
                  status={feedback === 'correct' ? 'correct' : 'incorrect'}
                  className="max-w-2xl mx-auto"
                >
                  {feedback === 'correct' ? 'Correct!' : 'Not quite — check your work and try again.'}
                </LuminaFeedbackCard>
              )}

              {/* Check; the runtime retries and advances. */}
              <div className="flex gap-4 justify-center flex-wrap">
                {feedback !== 'correct' && (
                  <LuminaActionButton
                    action="check"
                    onClick={handleCheckAnswers}
                    disabled={!allInputsFilled || blocked}
                  />
                )}
              </div>
            </div>
          )}

          </PipWorkspace>

          {/* Session-complete summary panel */}
          {isComplete && phaseResults.length > 0 && (
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={practiceScore(progress.practiceSummary) ?? submittedResult?.score}
              durationMs={elapsedMs}
              heading="Ratio Session Complete!"
              celebrationMessage={`You worked through ${challenges.length} proportional reasoning ${challenges.length === 1 ? 'challenge' : 'challenges'}!`}
              className="mt-4"
            />
          )}
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const DoubleNumberLine = withWorkspaceOnly<DoubleNumberLineProps>('double-number-line', DoubleNumberLineSurface,
  props => props.data.title);

export default DoubleNumberLine;
