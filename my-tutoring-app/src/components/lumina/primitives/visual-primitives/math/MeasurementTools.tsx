'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MeasurementToolsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import CalculatorInput from '../../input-primitives/CalculatorInput';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// =============================================================================
// Data Interface (Single Source of Truth)
// =============================================================================

export type ToolType = 'ruler' | 'scale' | 'measuring_cup' | 'thermometer';
export type MeasurementType = 'length' | 'weight' | 'capacity' | 'temperature';
export type ChallengeType = 'estimate' | 'read' | 'convert';
export type Precision = 'whole' | 'half' | 'quarter';

export interface MeasurementChallenge {
  id: string;
  type: ChallengeType;
  objectName: string;
  objectEmoji: string;
  value: number;
  targetAnswer: number;
  targetUnit: string;
  acceptableMin?: number;
  acceptableMax?: number;
  hint: string;
  instruction: string;
}

export interface MeasurementToolsData {
  primitiveType?: string;
  toolType: ToolType;
  measurementType: MeasurementType;
  unit: string;
  precision: Precision;
  gradeBand: '1-2' | '3-5';
  challenges: MeasurementChallenge[];
  conversionFact?: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MeasurementToolsMetrics>) => void;
}

interface MeasurementToolsProps {
  data: MeasurementToolsData;
  className?: string;
}

// =============================================================================
// Constants & Helpers
// =============================================================================

const TOOL_ICONS: Record<ToolType, string> = {
  ruler: '📏',
  scale: '⚖️',
  measuring_cup: '🧪',
  thermometer: '🌡️',
};

const TOOL_LABELS: Record<ToolType, string> = {
  ruler: 'Ruler',
  scale: 'Scale',
  measuring_cup: 'Measuring Cup',
  thermometer: 'Thermometer',
};

const MEASUREMENT_TYPE_COLORS: Record<MeasurementType, string> = {
  length: 'text-blue-300',
  weight: 'text-amber-300',
  capacity: 'text-cyan-300',
  temperature: 'text-red-300',
};

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  estimate: { label: 'Estimate', icon: '🤔', accentColor: 'amber' },
  read: { label: 'Measure', icon: '📏', accentColor: 'blue' },
  convert: { label: 'Convert', icon: '🔄', accentColor: 'purple' },
};

function getPrecisionStep(precision: Precision): number {
  switch (precision) {
    case 'whole': return 1;
    case 'half': return 0.5;
    case 'quarter': return 0.25;
  }
}

function computeMaxScale(value: number, toolType: ToolType): number {
  if (toolType === 'thermometer') {
    return Math.ceil(value * 1.3 / 10) * 10;
  }
  // For ruler/scale/cup: round up to a nice number with ~25% headroom
  const headroom = value * 1.25;
  if (headroom <= 10) return Math.ceil(headroom);
  if (headroom <= 50) return Math.ceil(headroom / 5) * 5;
  return Math.ceil(headroom / 10) * 10;
}

function computeMinScale(toolType: ToolType, unit: string): number {
  if (toolType === 'thermometer') {
    return unit === '°F' ? 0 : -10;
  }
  return 0;
}

// =============================================================================
// Tool Visualization Components (all read-only)
// =============================================================================

interface ToolVisualizationProps {
  value: number;
  maxScale: number;
  minScale: number;
  unit: string;
  precision: Precision;
  objectEmoji: string;
  objectName: string;
}

const RulerVisualization: React.FC<ToolVisualizationProps> = ({
  value, maxScale, unit, precision, objectEmoji, objectName,
}) => {
  const step = getPrecisionStep(precision);
  const tickCount = Math.round(maxScale / step);
  const barWidthPercent = (value / maxScale) * 100;

  return (
    <div className="bg-slate-800/50 border border-blue-500/20 rounded-lg p-4">
      {/* Object bar sitting on ruler */}
      <div className="relative mb-1 h-10">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500/30 to-blue-400/50 rounded border border-blue-400/40 flex items-center justify-center overflow-hidden"
          style={{ width: `${barWidthPercent}%`, minWidth: '40px' }}
        >
          <span className="text-sm text-blue-100 truncate px-2">
            {objectEmoji} {objectName}
          </span>
        </div>
      </div>

      {/* Ruler tick marks */}
      <div className="relative h-12 border-t border-slate-400/60">
        {Array.from({ length: tickCount + 1 }, (_, i) => {
          const tickValue = i * step;
          if (tickValue > maxScale) return null;
          const isWhole = Math.abs(tickValue - Math.round(tickValue)) < 0.001;
          const isHalf = Math.abs((tickValue * 2) - Math.round(tickValue * 2)) < 0.001 && !isWhole;
          const posPercent = (tickValue / maxScale) * 100;

          return (
            <div
              key={i}
              className="absolute top-0"
              style={{ left: `${posPercent}%` }}
            >
              <div
                className={`w-px ${
                  isWhole ? 'h-6 bg-slate-300' : isHalf ? 'h-4 bg-slate-500' : 'h-2 bg-slate-600'
                }`}
              />
              {isWhole && (
                <span className="absolute top-7 text-[10px] text-slate-400 -translate-x-1/2 select-none">
                  {Math.round(tickValue)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Unit label */}
      <div className="text-right mt-1">
        <span className="text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  );
};

const ScaleVisualization: React.FC<ToolVisualizationProps> = ({
  value, maxScale, unit, precision, objectEmoji, objectName,
}) => {
  const step = getPrecisionStep(precision);
  const fillPercent = Math.min((value / maxScale) * 100, 100);
  const totalTicks = Math.round(maxScale / step);

  // Only show labels at reasonable intervals
  const labelInterval = maxScale <= 20 ? 1 : maxScale <= 100 ? 5 : 10;

  return (
    <div className="bg-slate-800/50 border border-amber-500/20 rounded-lg p-4">
      <div className="flex items-end gap-6">
        {/* Vertical gauge */}
        <div className="relative flex-shrink-0" style={{ width: '60px', height: '200px' }}>
          {/* Background bar */}
          <div className="absolute inset-0 bg-slate-700/50 rounded border border-slate-600/50" />

          {/* Fill bar */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-500/40 to-amber-400/60 rounded-b transition-all"
            style={{ height: `${fillPercent}%` }}
          />

          {/* Indicator line at value */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
            style={{ bottom: `${fillPercent}%` }}
          >
            <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-400 rotate-45" />
          </div>

          {/* Tick marks */}
          {Array.from({ length: totalTicks + 1 }, (_, i) => {
            const tickValue = i * step;
            if (tickValue > maxScale) return null;
            const isWhole = Math.abs(tickValue - Math.round(tickValue)) < 0.001;
            const showLabel = isWhole && (tickValue % labelInterval === 0);
            const posPercent = (tickValue / maxScale) * 100;

            return (
              <div
                key={i}
                className="absolute left-0 flex items-center"
                style={{ bottom: `${posPercent}%` }}
              >
                <div className={`${isWhole ? 'w-3 bg-slate-400' : 'w-1.5 bg-slate-600'} h-px`} />
                {showLabel && (
                  <span className="absolute -left-7 text-[9px] text-slate-400 select-none">
                    {Math.round(tickValue)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Object display + unit */}
        <div className="flex-1 flex flex-col items-center justify-center pb-4">
          {/* Platform */}
          <div className="w-28 h-20 bg-slate-700/30 rounded-lg border border-slate-600/50 flex flex-col items-center justify-center mb-2">
            <span className="text-3xl">{objectEmoji}</span>
            <span className="text-xs text-slate-400 mt-1 truncate max-w-[100px]">{objectName}</span>
          </div>
          <span className="text-xs text-slate-500">{unit}</span>
        </div>
      </div>
    </div>
  );
};

const MeasuringCupVisualization: React.FC<ToolVisualizationProps> = ({
  value, maxScale, unit, precision, objectEmoji, objectName,
}) => {
  const step = getPrecisionStep(precision);
  const fillPercent = Math.min((value / maxScale) * 100, 100);
  const totalTicks = Math.round(maxScale / step);
  const labelInterval = maxScale <= 10 ? 1 : maxScale <= 50 ? 5 : 10;

  return (
    <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
      <div className="flex justify-center">
        <div className="relative" style={{ width: '120px', height: '200px' }}>
          {/* Cup outline — wider at top, narrower at bottom */}
          <div
            className="absolute inset-0 border-2 border-cyan-500/30 rounded-b-lg bg-slate-800/30"
            style={{
              clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)',
            }}
          >
            {/* Liquid fill */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-cyan-500/25 transition-all duration-500"
              style={{ height: `${fillPercent}%` }}
            >
              {/* Meniscus / surface line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-400/50" />
            </div>
          </div>

          {/* Graduation marks on right side */}
          {Array.from({ length: totalTicks + 1 }, (_, i) => {
            const tickValue = i * step;
            if (tickValue > maxScale || tickValue === 0) return null;
            const isWhole = Math.abs(tickValue - Math.round(tickValue)) < 0.001;
            const showLabel = isWhole && (tickValue % labelInterval === 0);
            const posPercent = (tickValue / maxScale) * 100;

            return (
              <div
                key={i}
                className="absolute flex items-center"
                style={{ bottom: `${posPercent}%`, right: '-28px' }}
              >
                <div className={`${isWhole ? 'w-3 bg-cyan-400/60' : 'w-1.5 bg-cyan-600/40'} h-px`} />
                {showLabel && (
                  <span className="ml-1 text-[9px] text-slate-400 select-none">
                    {Math.round(tickValue)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Object + unit label */}
      <div className="text-center mt-3">
        <span className="text-lg mr-1">{objectEmoji}</span>
        <span className="text-sm text-slate-300">{objectName}</span>
        <span className="text-xs text-slate-500 ml-2">({unit})</span>
      </div>
    </div>
  );
};

const ThermometerVisualization: React.FC<ToolVisualizationProps> = ({
  value, maxScale, minScale, unit, precision,
}) => {
  const step = getPrecisionStep(precision);
  const range = maxScale - minScale;
  const fillPercent = Math.min(Math.max(((value - minScale) / range) * 100, 0), 100);
  const totalTicks = Math.round(range / step);
  const labelInterval = range <= 20 ? 2 : range <= 100 ? 10 : 20;

  const getTemperatureColor = (v: number): string => {
    if (unit === '°C') {
      if (v <= 0) return 'from-blue-600/50 to-blue-500/60';
      if (v <= 20) return 'from-green-600/50 to-green-500/60';
      if (v <= 35) return 'from-yellow-600/50 to-yellow-500/60';
      return 'from-red-600/50 to-red-500/60';
    }
    // °F
    if (v <= 32) return 'from-blue-600/50 to-blue-500/60';
    if (v <= 68) return 'from-green-600/50 to-green-500/60';
    if (v <= 95) return 'from-yellow-600/50 to-yellow-500/60';
    return 'from-red-600/50 to-red-500/60';
  };

  return (
    <div className="bg-slate-800/50 border border-red-500/20 rounded-lg p-4">
      <div className="flex justify-center">
        <div className="relative" style={{ width: '80px', height: '220px' }}>
          {/* Tube */}
          <div className="absolute left-1/2 -translate-x-1/2 w-6 rounded-t-full bg-slate-700/30 border-2 border-red-500/30"
            style={{ top: 0, bottom: '24px' }}
          >
            {/* Mercury fill */}
            <div
              className={`absolute bottom-0 left-0 right-0 rounded-t-full bg-gradient-to-t transition-all duration-500 ${getTemperatureColor(value)}`}
              style={{ height: `${fillPercent}%` }}
            />
          </div>

          {/* Bulb */}
          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-2 border-red-500/30 bg-gradient-to-t ${getTemperatureColor(value)}`} />

          {/* Scale marks on right side */}
          {Array.from({ length: totalTicks + 1 }, (_, i) => {
            const tickValue = minScale + i * step;
            if (tickValue > maxScale) return null;
            const isWhole = Math.abs(tickValue - Math.round(tickValue)) < 0.001;
            const showLabel = isWhole && (Math.round(tickValue) % labelInterval === 0);
            const posPercent = ((tickValue - minScale) / range) * 100;
            // Map posPercent to the tube's height region (bottom 24px is the bulb)
            const tubeHeight = 196; // 220 - 24
            const bottomOffset = 24 + (posPercent / 100) * tubeHeight;

            return (
              <div
                key={i}
                className="absolute flex items-center"
                style={{ bottom: `${bottomOffset}px`, right: '0px' }}
              >
                <div className={`${isWhole ? 'w-3 bg-slate-400' : 'w-1.5 bg-slate-600'} h-px`} />
                {showLabel && (
                  <span className="ml-1 text-[9px] text-slate-400 select-none whitespace-nowrap">
                    {Math.round(tickValue)}°
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Unit label */}
      <div className="text-center mt-2">
        <span className="text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

const MeasurementTools: React.FC<MeasurementToolsProps> = ({ data, className }) => {
  const {
    toolType,
    measurementType,
    unit,
    precision,
    gradeBand,
    challenges,
    conversionFact,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || `measurement-tools-${Date.now()}`;

  // ── Shared hooks ──────────────────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete,
    recordResult,
    incrementAttempts,
    advance,
    reset,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_CONFIG,
  });

  const {
    submitResult,
    hasSubmitted,
    elapsedMs,
    resetAttempt,
  } = usePrimitiveEvaluation<MeasurementToolsMetrics>({
    primitiveType: 'measurement-tools',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Local state ───────────────────────────────────────────────
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const hasIntroducedRef = useRef(false);

  const currentChallenge = challenges[currentIndex] ?? null;

  // ── AI Tutoring ───────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    toolType,
    measurementType,
    unit,
    precision,
    gradeBand,
    currentChallengeIndex: currentIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type,
    instruction: currentChallenge?.instruction,
    objectName: currentChallenge?.objectName,
    currentAttempts,
  }), [toolType, measurementType, unit, precision, gradeBand, currentIndex, challenges.length, currentChallenge, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'measurement-tools',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '1-2' ? '1st Grade' : '3rd Grade',
  });

  // Activity introduction
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Measurement activity using ${TOOL_LABELS[toolType]}. ` +
      `${challenges.length} challenges about ${measurementType} in ${unit}. ` +
      `First challenge: "${currentChallenge.instruction}". Introduce warmly and read the first instruction.`,
      { silent: true },
    );
  }, [isConnected, currentChallenge, toolType, challenges.length, measurementType, unit, sendText]);

  // ── Answer checking ───────────────────────────────────────────
  const checkAnswer = useCallback(() => {
    if (!currentChallenge) return;

    const studentNum = parseFloat(answerInput);
    if (isNaN(studentNum)) {
      setFeedback({ message: 'Please enter a number!', correct: false });
      return;
    }

    incrementAttempts();
    let isCorrect = false;

    switch (currentChallenge.type) {
      case 'estimate': {
        const min = currentChallenge.acceptableMin ?? currentChallenge.targetAnswer * 0.75;
        const max = currentChallenge.acceptableMax ?? currentChallenge.targetAnswer * 1.25;
        isCorrect = studentNum >= min && studentNum <= max;
        break;
      }
      case 'read': {
        const tolerance = getPrecisionStep(precision) / 2;
        isCorrect = Math.abs(studentNum - currentChallenge.targetAnswer) <= tolerance;
        break;
      }
      case 'convert': {
        const convTolerance = Math.max(getPrecisionStep(precision), currentChallenge.targetAnswer * 0.02);
        isCorrect = Math.abs(studentNum - currentChallenge.targetAnswer) <= convTolerance;
        break;
      }
    }

    // Record result
    recordResult({
      challengeId: currentChallenge.id,
      correct: isCorrect,
      attempts: currentAttempts + 1,
      score: isCorrect ? 100 : 0,
      challengeType: currentChallenge.type,
      studentAnswer: studentNum,
      targetAnswer: currentChallenge.targetAnswer,
    });

    setFeedback({
      message: isCorrect ? 'Correct!' : 'Not quite — try again!',
      correct: isCorrect,
    });

    // AI tutoring trigger
    if (isCorrect) {
      sendText(
        `[ANSWER_CORRECT] Student answered ${studentNum} for "${currentChallenge.instruction}". ` +
        `Correct answer: ${currentChallenge.targetAnswer} ${currentChallenge.targetUnit}. ` +
        `Attempts: ${currentAttempts + 1}. Congratulate briefly.`,
        { silent: true },
      );
    } else {
      sendText(
        `[ANSWER_INCORRECT] Student answered ${studentNum} for "${currentChallenge.instruction}". ` +
        `Challenge type: ${currentChallenge.type}. Attempt: ${currentAttempts + 1}. ` +
        `Give a brief hint without revealing the answer.`,
        { silent: true },
      );
    }

    if (isCorrect) {
      setTimeout(() => {
        setFeedback(null);
        setAnswerInput('');
        setShowHint(false);
        const advanced = advance();
        if (advanced) {
          const nextCh = challenges[currentIndex + 1];
          if (nextCh) {
            sendText(
              `[NEXT_ITEM] Challenge ${currentIndex + 2} of ${challenges.length}: ` +
              `"${nextCh.instruction}". Introduce briefly.`,
              { silent: true },
            );
          }
        }
        // If not advanced, isComplete becomes true → triggers evaluation submit
      }, 1200);
    }
  }, [currentChallenge, answerInput, currentAttempts, precision, incrementAttempts, recordResult, advance, currentIndex, challenges, sendText]);

  // ── Evaluation submission on completion ────────────────────────
  useEffect(() => {
    if (!isComplete || hasSubmitted) return;

    const byType = (t: ChallengeType) =>
      challengeResults.filter((r) => {
        const ch = challenges.find((c) => c.id === r.challengeId);
        return ch?.type === t;
      });

    const estResults = byType('estimate');
    const readResults = byType('read');
    const convResults = byType('convert');

    const totalCorrect = challengeResults.filter((r) => r.correct).length;
    const score = Math.round((totalCorrect / challenges.length) * 100);

    const metrics: MeasurementToolsMetrics = {
      type: 'measurement-tools',
      estimateCorrect: estResults.filter((r) => r.correct).length,
      estimateTotal: estResults.length,
      readCorrect: readResults.filter((r) => r.correct).length,
      readTotal: readResults.length,
      convertCorrect: convResults.filter((r) => r.correct).length,
      convertTotal: convResults.length,
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };

    submitResult(totalCorrect === challenges.length, score, metrics, {
      challengeResults,
    });

    // AI celebration
    const phaseScoreStr = phaseResults
      .map((p) => `${p.label} ${p.score}%`)
      .join(', ');
    sendText(
      `[ALL_COMPLETE] Student finished all ${challenges.length} measurement challenges! ` +
      `Score: ${score}%. Phase scores: ${phaseScoreStr}. ` +
      `Celebrate and give encouraging phase-specific feedback.`,
      { silent: true },
    );
  }, [isComplete, hasSubmitted, challengeResults, challenges, submitResult, phaseResults, sendText]);

  // ── Reset handler ─────────────────────────────────────────────
  const handleReset = () => {
    reset();
    resetAttempt();
    setAnswerInput('');
    setFeedback(null);
    setShowHint(false);
    hasIntroducedRef.current = false;
  };

  // ── Computed values for current challenge ─────────────────────
  const maxScale = currentChallenge ? computeMaxScale(currentChallenge.value, toolType) : 10;
  const minScale = computeMinScale(toolType, unit);

  // ── Determine which phases exist ──────────────────────────────
  const challengeTypes = useMemo(
    () => Array.from(new Set(challenges.map((c) => c.type))),
    [challenges],
  );

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{TOOL_ICONS[toolType]}</span>
            <div>
              <CardTitle className="text-slate-100 text-xl">
                Measurement Tools
              </CardTitle>
              <p className="text-sm text-slate-400 mt-0.5">
                {currentChallenge
                  ? `Measure with ${TOOL_LABELS[toolType]}`
                  : 'Complete!'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`bg-slate-800/50 border-slate-700/50 ${MEASUREMENT_TYPE_COLORS[measurementType]}`}>
              {measurementType}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-300">
              Grades {gradeBand}
            </Badge>
          </div>
        </div>

        {/* Phase progress indicator */}
        <div className="flex items-center gap-1 mt-4">
          {challengeTypes.map((type, i) => {
            const config = PHASE_CONFIG[type];
            // Determine if this phase is active, complete, or upcoming
            const phaseChallenges = challenges.filter((c) => c.type === type);
            const phaseComplete = phaseChallenges.every((c) =>
              challengeResults.some((r) => r.challengeId === c.id && r.correct),
            );
            const phaseActive = !phaseComplete && currentChallenge?.type === type;

            return (
              <React.Fragment key={type}>
                {i > 0 && (
                  <div className={`h-px flex-1 ${phaseComplete ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                )}
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                    phaseActive
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : phaseComplete
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800/50 text-slate-500'
                  }`}
                >
                  {phaseComplete ? '✓' : config?.icon || '•'}
                  <span className="hidden sm:inline">{config?.label || type}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Results panel (when complete) */}
        {isComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={Math.round(
              phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length,
            )}
            durationMs={elapsedMs}
            heading="Measurement Complete!"
            celebrationMessage="Great job measuring!"
            className="mb-4"
          />
        )}

        {/* Current challenge */}
        {currentChallenge && !isComplete && (
          <>
            {/* Challenge instruction */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <p className="text-purple-200 text-sm font-medium">
                Challenge {currentIndex + 1} of {challenges.length}
              </p>
              <p className="text-slate-200 mt-1">{currentChallenge.instruction}</p>
            </div>

            {/* ── Estimate: show object, no tool ── */}
            {currentChallenge.type === 'estimate' && (
              <div className="bg-black/20 rounded-lg p-6 text-center">
                <span className="text-5xl">{currentChallenge.objectEmoji}</span>
                <p className="text-slate-200 font-medium mt-3">{currentChallenge.objectName}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Estimate in {currentChallenge.targetUnit}
                </p>
              </div>
            )}

            {/* ── Read: show read-only tool visualization ── */}
            {currentChallenge.type === 'read' && (
              <>
                {toolType === 'ruler' && (
                  <RulerVisualization
                    value={currentChallenge.value}
                    maxScale={maxScale}
                    minScale={0}
                    unit={unit}
                    precision={precision}
                    objectEmoji={currentChallenge.objectEmoji}
                    objectName={currentChallenge.objectName}
                  />
                )}
                {toolType === 'scale' && (
                  <ScaleVisualization
                    value={currentChallenge.value}
                    maxScale={maxScale}
                    minScale={0}
                    unit={unit}
                    precision={precision}
                    objectEmoji={currentChallenge.objectEmoji}
                    objectName={currentChallenge.objectName}
                  />
                )}
                {toolType === 'measuring_cup' && (
                  <MeasuringCupVisualization
                    value={currentChallenge.value}
                    maxScale={maxScale}
                    minScale={0}
                    unit={unit}
                    precision={precision}
                    objectEmoji={currentChallenge.objectEmoji}
                    objectName={currentChallenge.objectName}
                  />
                )}
                {toolType === 'thermometer' && (
                  <ThermometerVisualization
                    value={currentChallenge.value}
                    maxScale={maxScale}
                    minScale={minScale}
                    unit={unit}
                    precision={precision}
                    objectEmoji={currentChallenge.objectEmoji}
                    objectName={currentChallenge.objectName}
                  />
                )}
              </>
            )}

            {/* ── Convert: show stated measurement + conversion fact ── */}
            {currentChallenge.type === 'convert' && (
              <div className="bg-black/20 rounded-lg p-4 space-y-3">
                <div className="text-center">
                  <span className="text-3xl">{currentChallenge.objectEmoji}</span>
                  <p className="text-slate-200 mt-2">
                    The {currentChallenge.objectName} measures{' '}
                    <span className="text-purple-300 font-bold">
                      {currentChallenge.value} {unit}
                    </span>
                  </p>
                </div>
                {conversionFact && (
                  <div className="bg-slate-700/30 rounded p-2 text-center">
                    <p className="text-xs text-slate-400">Conversion reference:</p>
                    <p className="text-sm text-slate-200">{conversionFact}</p>
                  </div>
                )}
                <p className="text-center text-sm text-slate-400">
                  Answer in {currentChallenge.targetUnit}
                </p>
              </div>
            )}

            {/* Answer input */}
            <CalculatorInput
              label={`Your answer (${currentChallenge.targetUnit})`}
              value={answerInput}
              onChange={setAnswerInput}
              onSubmit={checkAnswer}
              placeholder="?"
              disabled={hasSubmitted}
              showSubmitButton={true}
              allowDecimal={precision !== 'whole'}
              allowNegative={toolType === 'thermometer'}
            />

            {/* Feedback */}
            {feedback && (
              <div
                className={`rounded-lg p-3 border ${
                  feedback.correct
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    feedback.correct ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {feedback.message}
                </p>
              </div>
            )}

            {/* Hint */}
            {showHint && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-amber-200 text-sm">{currentChallenge.hint}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {!feedback?.correct && currentAttempts >= 2 && !showHint && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                  onClick={() => setShowHint(true)}
                >
                  Need a Hint?
                </Button>
              )}
            </div>
          </>
        )}

        {/* Reset button after completion */}
        {isComplete && (
          <div className="flex justify-center">
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MeasurementTools;
