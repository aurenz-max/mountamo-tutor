'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { MeasurementToolsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// =============================================================================
// Data Interface (Single Source of Truth)
// =============================================================================

export type ToolType = 'ruler' | 'tape_measure' | 'scale' | 'balance' | 'measuring_cup' | 'thermometer';
export type MeasurementType = 'length' | 'weight' | 'capacity' | 'temperature';
export type MeasurementUnit = 'cm' | 'm' | 'in' | 'ft' | 'g' | 'kg' | 'lb' | 'mL' | 'L' | 'cup' | '°C' | '°F';
export type Precision = 'whole' | 'half' | 'quarter' | 'tenth';
export type ChallengeType = 'measure' | 'estimate' | 'compare' | 'convert' | 'choose_tool' | 'choose_unit';
export type ObjectCategory = 'school' | 'kitchen' | 'nature' | 'sports' | 'animals';
export type Phase = 'explore' | 'estimate' | 'precision' | 'convert';

export interface MeasurementChallenge {
  id: string;
  type: ChallengeType;
  instruction: string;
  targetAnswer: number | string;
  acceptableRange?: { min: number; max: number };
  hint: string;
  narration: string;
}

export interface ObjectToMeasure {
  name: string;
  actualValue: number;
  imagePrompt: string;
  category: ObjectCategory;
}

export interface ConversionEntry {
  from: string;
  to: string;
  factor: number;
  description: string;
}

export interface MeasurementToolsData {
  primitiveType?: string;
  toolType: ToolType;
  measurementType: MeasurementType;
  unit: {
    primary: MeasurementUnit;
    secondary?: MeasurementUnit | null;
    precision: Precision;
  };
  objectToMeasure: ObjectToMeasure;
  challenges: MeasurementChallenge[];
  nonStandardUnits?: {
    enabled: boolean;
    unitName: string;
    unitLength: number;
  };
  conversionReference?: {
    enabled: boolean;
    conversions: ConversionEntry[];
  };
  imagePrompt?: string | null;
  gradeBand: '1-2' | '3-5';

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
// Tool Icons & Display Helpers
// =============================================================================

const TOOL_ICONS: Record<ToolType, string> = {
  ruler: '📏',
  tape_measure: '📐',
  scale: '⚖️',
  balance: '⚖️',
  measuring_cup: '🧪',
  thermometer: '🌡️',
};

const TOOL_LABELS: Record<ToolType, string> = {
  ruler: 'Ruler',
  tape_measure: 'Tape Measure',
  scale: 'Scale',
  balance: 'Balance',
  measuring_cup: 'Measuring Cup',
  thermometer: 'Thermometer',
};

const MEASUREMENT_TYPE_COLORS: Record<MeasurementType, string> = {
  length: 'text-blue-300',
  weight: 'text-amber-300',
  capacity: 'text-cyan-300',
  temperature: 'text-red-300',
};

const PHASE_LABELS: Record<Phase, string> = {
  explore: 'Explore',
  estimate: 'Estimate',
  precision: 'Precision',
  convert: 'Convert',
};

function getUnitLabel(unit: MeasurementUnit): string {
  const labels: Record<MeasurementUnit, string> = {
    cm: 'cm', m: 'm', in: 'in', ft: 'ft',
    g: 'g', kg: 'kg', lb: 'lb',
    mL: 'mL', L: 'L', cup: 'cups',
    '°C': '°C', '°F': '°F',
  };
  return labels[unit] || unit;
}

function getPrecisionStep(precision: Precision): number {
  switch (precision) {
    case 'whole': return 1;
    case 'half': return 0.5;
    case 'quarter': return 0.25;
    case 'tenth': return 0.1;
  }
}

// =============================================================================
// Tool Visualization Components
// =============================================================================

const RulerVisualization: React.FC<{
  value: number;
  maxValue: number;
  unit: MeasurementUnit;
  precision: Precision;
  onValueChange: (v: number) => void;
  disabled: boolean;
}> = ({ value, maxValue, unit, precision, onValueChange, disabled }) => {
  const step = getPrecisionStep(precision);
  const ticks = Math.ceil(maxValue / step);
  const displayMax = Math.min(ticks, 60);

  return (
    <div className="relative">
      {/* Ruler body */}
      <div className="bg-amber-100/10 border border-amber-500/30 rounded-lg p-4 relative overflow-hidden">
        {/* Tick marks */}
        <div className="flex items-end h-16 relative mb-2">
          {Array.from({ length: displayMax + 1 }, (_, i) => {
            const tickValue = i * step;
            const isWhole = tickValue % 1 === 0;
            const isHalf = tickValue % 0.5 === 0 && !isWhole;
            const isFilled = tickValue <= value;

            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center cursor-pointer"
                onClick={() => !disabled && onValueChange(tickValue)}
              >
                <div
                  className={`w-px transition-all ${
                    isWhole ? 'h-10' : isHalf ? 'h-6' : 'h-3'
                  } ${isFilled ? 'bg-blue-400' : 'bg-slate-500'}`}
                />
                {isWhole && tickValue <= maxValue && (
                  <span className={`text-[9px] mt-1 ${isFilled ? 'text-blue-300' : 'text-slate-500'}`}>
                    {tickValue}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Slider control */}
        <input
          type="range"
          min={0}
          max={maxValue}
          step={step}
          value={value}
          onChange={(e) => !disabled && onValueChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />

        {/* Current value display */}
        <div className="text-center mt-2">
          <span className="text-2xl font-bold text-blue-300">{value}</span>
          <span className="text-sm text-slate-400 ml-1">{getUnitLabel(unit)}</span>
        </div>
      </div>
    </div>
  );
};

const ScaleVisualization: React.FC<{
  value: number;
  maxValue: number;
  unit: MeasurementUnit;
  precision: Precision;
  onValueChange: (v: number) => void;
  disabled: boolean;
  objectName: string;
}> = ({ value, maxValue, unit, precision, onValueChange, disabled, objectName }) => {
  const step = getPrecisionStep(precision);

  return (
    <div className="relative">
      <div className="bg-slate-800/50 border border-amber-500/30 rounded-lg p-4">
        {/* Scale platform */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-32 h-20 bg-slate-700/50 rounded-lg border border-slate-600 flex items-center justify-center relative">
            <span className="text-2xl">📦</span>
            <span className="absolute -bottom-5 text-xs text-slate-400">{objectName}</span>
          </div>
        </div>

        {/* Digital display */}
        <div className="bg-black/40 rounded-lg p-3 text-center mb-3 border border-slate-600">
          <span className="text-3xl font-mono font-bold text-green-400">{value.toFixed(precision === 'tenth' ? 1 : 0)}</span>
          <span className="text-sm text-green-300 ml-1">{getUnitLabel(unit)}</span>
        </div>

        {/* Weight slider */}
        <input
          type="range"
          min={0}
          max={maxValue}
          step={step}
          value={value}
          onChange={(e) => !disabled && onValueChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
      </div>
    </div>
  );
};

const MeasuringCupVisualization: React.FC<{
  value: number;
  maxValue: number;
  unit: MeasurementUnit;
  precision: Precision;
  onValueChange: (v: number) => void;
  disabled: boolean;
}> = ({ value, maxValue, unit, precision, onValueChange, disabled }) => {
  const step = getPrecisionStep(precision);
  const fillPercent = Math.min((value / maxValue) * 100, 100);

  return (
    <div className="relative">
      <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
        {/* Cup visualization */}
        <div className="flex justify-center mb-4">
          <div className="w-24 h-40 bg-slate-700/30 border-2 border-cyan-500/40 rounded-b-lg relative overflow-hidden">
            {/* Liquid fill */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-cyan-500/30 transition-all duration-300"
              style={{ height: `${fillPercent}%` }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400/60" />
            </div>

            {/* Measurement lines */}
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 flex items-center"
                style={{ bottom: `${((i + 1) / 5) * 100}%` }}
              >
                <div className="w-3 h-px bg-slate-400" />
                <span className="text-[8px] text-slate-500 ml-1">
                  {Math.round((maxValue / 5) * (i + 1))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Value display */}
        <div className="text-center mb-3">
          <span className="text-2xl font-bold text-cyan-300">{value}</span>
          <span className="text-sm text-slate-400 ml-1">{getUnitLabel(unit)}</span>
        </div>

        {/* Fill slider */}
        <input
          type="range"
          min={0}
          max={maxValue}
          step={step}
          value={value}
          onChange={(e) => !disabled && onValueChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
      </div>
    </div>
  );
};

const ThermometerVisualization: React.FC<{
  value: number;
  minValue: number;
  maxValue: number;
  unit: MeasurementUnit;
  precision: Precision;
  onValueChange: (v: number) => void;
  disabled: boolean;
}> = ({ value, minValue, maxValue, unit, precision, onValueChange, disabled }) => {
  const step = getPrecisionStep(precision);
  const range = maxValue - minValue;
  const fillPercent = Math.min(((value - minValue) / range) * 100, 100);

  const getTemperatureColor = (v: number): string => {
    if (unit === '°C') {
      if (v <= 0) return 'bg-blue-500/40';
      if (v <= 20) return 'bg-green-500/40';
      if (v <= 35) return 'bg-yellow-500/40';
      return 'bg-red-500/40';
    }
    if (v <= 32) return 'bg-blue-500/40';
    if (v <= 68) return 'bg-green-500/40';
    if (v <= 95) return 'bg-yellow-500/40';
    return 'bg-red-500/40';
  };

  return (
    <div className="relative">
      <div className="bg-slate-800/50 border border-red-500/30 rounded-lg p-4">
        {/* Thermometer */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            {/* Tube */}
            <div className="w-6 h-36 bg-slate-700/30 border-2 border-red-500/40 rounded-t-full relative overflow-hidden mx-auto">
              <div
                className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${getTemperatureColor(value)}`}
                style={{ height: `${fillPercent}%` }}
              />
              {/* Tick marks */}
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-full flex items-center ml-1"
                  style={{ bottom: `${((i + 1) / 5) * 100}%` }}
                >
                  <div className="w-2 h-px bg-slate-400" />
                  <span className="text-[8px] text-slate-500 ml-1">
                    {Math.round(minValue + (range / 5) * (i + 1))}
                  </span>
                </div>
              ))}
            </div>
            {/* Bulb */}
            <div className={`w-10 h-10 rounded-full border-2 border-red-500/40 mx-auto -mt-1 ${getTemperatureColor(value)}`} />
          </div>
        </div>

        {/* Temperature display */}
        <div className="text-center mb-3">
          <span className="text-2xl font-bold text-red-300">{value}</span>
          <span className="text-sm text-slate-400 ml-1">{getUnitLabel(unit)}</span>
        </div>

        {/* Temperature slider */}
        <input
          type="range"
          min={minValue}
          max={maxValue}
          step={step}
          value={value}
          onChange={(e) => !disabled && onValueChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
        />
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
    objectToMeasure,
    challenges,
    nonStandardUnits,
    conversionReference,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Phase management
  const [currentPhase, setCurrentPhase] = useState<Phase>('explore');
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);

  // Measurement state
  const [measurementValue, setMeasurementValue] = useState(0);
  const [estimateValue, setEstimateValue] = useState('');
  const [conversionAnswer, setConversionAnswer] = useState('');
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<MeasurementUnit | null>(null);

  // Feedback state
  const [feedback, setFeedback] = useState<{ message: string; correct: boolean } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showConversionRef, setShowConversionRef] = useState(false);

  // Tracking state
  const [measurementsCorrect, setMeasurementsCorrect] = useState(0);
  const [measurementsTotal, setMeasurementsTotal] = useState(0);
  const [estimateErrors, setEstimateErrors] = useState<number[]>([]);
  const [toolSelectionsCorrect, setToolSelectionsCorrect] = useState(0);
  const [toolSelectionsTotal, setToolSelectionsTotal] = useState(0);
  const [unitSelectionsCorrect, setUnitSelectionsCorrect] = useState(0);
  const [unitSelectionsTotal, setUnitSelectionsTotal] = useState(0);
  const [conversionsCorrect, setConversionsCorrect] = useState(0);
  const [conversionsTotal, setConversionsTotal] = useState(0);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [measurementTypesExplored, setMeasurementTypesExplored] = useState<Set<MeasurementType>>(new Set());
  const hasSentPhaseIntro = useRef<Set<Phase>>(new Set());

  // Derived values
  const currentChallenge = challenges[currentChallengeIndex] || null;
  const resolvedInstanceId = instanceId || `measurement-tools-${Date.now()}`;
  const maxMeasurementValue = objectToMeasure.actualValue * 2;
  const minTempValue = unit.primary === '°C' ? -20 : -4;
  const maxTempValue = unit.primary === '°C' ? 120 : 248;

  // AI Tutoring
  const aiPrimitiveData = useMemo(() => ({
    toolType,
    measurementType,
    objectName: objectToMeasure.name,
    actualValue: objectToMeasure.actualValue,
    unit: unit.primary,
    currentPhase,
    measurementValue,
    estimateValue,
    challengeType: currentChallenge?.type,
    attemptNumber: attemptsCount,
    gradeBand,
  }), [toolType, measurementType, objectToMeasure, unit.primary, currentPhase, measurementValue, estimateValue, currentChallenge, attemptsCount, gradeBand]);

  const { sendText } = useLuminaAI({
    primitiveType: 'measurement-tools',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '1-2' ? '1st Grade' : '3rd Grade',
  });

  // Evaluation
  const {
    submitResult,
    hasSubmitted,
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

  // Track measurement type explored
  useEffect(() => {
    setMeasurementTypesExplored(prev => new Set(prev).add(measurementType));
  }, [measurementType]);

  // Send phase introduction
  useEffect(() => {
    if (!hasSentPhaseIntro.current.has(currentPhase)) {
      hasSentPhaseIntro.current.add(currentPhase);
      const phaseMessages: Record<Phase, string> = {
        explore: `[PHASE_START] Student is starting the Explore phase. They can freely measure the ${objectToMeasure.name} using the ${TOOL_LABELS[toolType]}. Introduce the tool and encourage them to try measuring.`,
        estimate: `[PHASE_START] Student is starting the Estimate phase. They need to estimate the measurement of the ${objectToMeasure.name} before using the tool. Ask them to make their best guess.`,
        precision: `[PHASE_START] Student is starting the Precision phase. They need to read measurements to the nearest ${unit.precision}-unit. Encourage careful reading of the ${TOOL_LABELS[toolType]}.`,
        convert: `[PHASE_START] Student is starting the Convert phase. They need to convert measurements between ${unit.primary} and ${unit.secondary || 'another unit'}. Remind them of the conversion relationship.`,
      };
      sendText(phaseMessages[currentPhase], { silent: true });
    }
  }, [currentPhase, objectToMeasure.name, toolType, unit, sendText]);

  // Check answer
  const checkAnswer = useCallback(() => {
    if (!currentChallenge) return;

    setAttemptsCount(prev => prev + 1);
    let isCorrect = false;
    const challengeType = currentChallenge.type;

    if (challengeType === 'measure' || challengeType === 'estimate') {
      const studentAnswer = challengeType === 'estimate' ? parseFloat(estimateValue) : measurementValue;
      const target = typeof currentChallenge.targetAnswer === 'number'
        ? currentChallenge.targetAnswer
        : parseFloat(currentChallenge.targetAnswer as string);

      if (currentChallenge.acceptableRange) {
        isCorrect = studentAnswer >= currentChallenge.acceptableRange.min && studentAnswer <= currentChallenge.acceptableRange.max;
      } else {
        const tolerance = getPrecisionStep(unit.precision);
        isCorrect = Math.abs(studentAnswer - target) <= tolerance;
      }

      if (challengeType === 'measure') {
        setMeasurementsTotal(prev => prev + 1);
        if (isCorrect) setMeasurementsCorrect(prev => prev + 1);
      } else {
        const error = Math.abs(((studentAnswer - target) / target) * 100);
        setEstimateErrors(prev => [...prev, error]);
      }
    } else if (challengeType === 'choose_tool') {
      isCorrect = selectedTool === currentChallenge.targetAnswer;
      setToolSelectionsTotal(prev => prev + 1);
      if (isCorrect) setToolSelectionsCorrect(prev => prev + 1);
    } else if (challengeType === 'choose_unit') {
      isCorrect = selectedUnit === currentChallenge.targetAnswer;
      setUnitSelectionsTotal(prev => prev + 1);
      if (isCorrect) setUnitSelectionsCorrect(prev => prev + 1);
    } else if (challengeType === 'convert') {
      const studentConversion = parseFloat(conversionAnswer);
      const target = typeof currentChallenge.targetAnswer === 'number'
        ? currentChallenge.targetAnswer
        : parseFloat(currentChallenge.targetAnswer as string);
      const tolerance = getPrecisionStep(unit.precision);
      isCorrect = Math.abs(studentConversion - target) <= tolerance;
      setConversionsTotal(prev => prev + 1);
      if (isCorrect) setConversionsCorrect(prev => prev + 1);
    } else if (challengeType === 'compare') {
      const studentAnswer = measurementValue;
      isCorrect = studentAnswer === currentChallenge.targetAnswer;
      setMeasurementsTotal(prev => prev + 1);
      if (isCorrect) setMeasurementsCorrect(prev => prev + 1);
    }

    setFeedback({ message: isCorrect ? 'Correct!' : 'Not quite — try again!', correct: isCorrect });

    // AI tutoring triggers
    if (isCorrect) {
      sendText(
        `[ANSWER_CORRECT] Student correctly answered the ${challengeType} challenge: "${currentChallenge.instruction}". ` +
        `Attempt ${attemptsCount + 1}. Congratulate briefly and encourage them to continue.`,
        { silent: true }
      );
    } else {
      sendText(
        `[ANSWER_INCORRECT] Student's answer was wrong for: "${currentChallenge.instruction}". ` +
        `Challenge type: ${challengeType}. Attempt ${attemptsCount + 1}. ` +
        `Give a brief hint without revealing the answer.`,
        { silent: true }
      );
    }

    if (isCorrect) {
      // Move to next challenge or phase
      setTimeout(() => {
        setFeedback(null);
        setShowHint(false);

        if (currentChallengeIndex < challenges.length - 1) {
          setCurrentChallengeIndex(prev => prev + 1);
          setMeasurementValue(0);
          setEstimateValue('');
          setConversionAnswer('');
          setSelectedTool(null);
          setSelectedUnit(null);

          const nextChallenge = challenges[currentChallengeIndex + 1];
          sendText(
            `[NEXT_CHALLENGE] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: ` +
            `"${nextChallenge.instruction}". Briefly introduce this challenge.`,
            { silent: true }
          );
        } else {
          // All challenges complete
          handleComplete();
        }
      }, 1500);
    }
  }, [currentChallenge, measurementValue, estimateValue, conversionAnswer, selectedTool, selectedUnit, unit, attemptsCount, currentChallengeIndex, challenges, sendText]);

  // Handle completion
  const handleComplete = useCallback(() => {
    const avgEstimationError = estimateErrors.length > 0
      ? estimateErrors.reduce((a, b) => a + b, 0) / estimateErrors.length
      : 0;

    const totalCorrect = measurementsCorrect + toolSelectionsCorrect + unitSelectionsCorrect + conversionsCorrect;
    const totalAttempted = measurementsTotal + toolSelectionsTotal + unitSelectionsTotal + conversionsTotal;
    const score = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
    const success = score >= 70;

    const metrics: MeasurementToolsMetrics = {
      type: 'measurement-tools',
      measurementsCorrect,
      measurementsTotal,
      estimationAccuracy: Math.max(0, 100 - avgEstimationError),
      toolSelectionCorrect: toolSelectionsCorrect,
      toolSelectionTotal: toolSelectionsTotal,
      unitSelectionCorrect: unitSelectionsCorrect,
      unitSelectionTotal: unitSelectionsTotal,
      conversionCorrect: conversionsCorrect,
      conversionTotal: conversionsTotal,
      precisionAchieved: unit.precision,
      measurementTypesExplored: Array.from(measurementTypesExplored),
      attemptsCount,
    };

    submitResult(success, score, metrics, {
      studentWork: {
        toolType,
        objectMeasured: objectToMeasure.name,
        challengesCompleted: challenges.length,
        phaseReached: currentPhase,
      },
    });

    sendText(
      `[SESSION_COMPLETE] Student completed all ${challenges.length} challenges! ` +
      `Score: ${Math.round(score)}%. Measurements: ${measurementsCorrect}/${measurementsTotal}. ` +
      `Celebrate their achievement and summarize what they learned about ${measurementType} measurement.`,
      { silent: true }
    );
  }, [measurementsCorrect, measurementsTotal, estimateErrors, toolSelectionsCorrect, toolSelectionsTotal, unitSelectionsCorrect, unitSelectionsTotal, conversionsCorrect, conversionsTotal, unit.precision, measurementTypesExplored, attemptsCount, submitResult, challenges, currentPhase, toolType, objectToMeasure, measurementType, sendText]);

  // Handle reset
  const handleReset = () => {
    setCurrentChallengeIndex(0);
    setMeasurementValue(0);
    setEstimateValue('');
    setConversionAnswer('');
    setSelectedTool(null);
    setSelectedUnit(null);
    setFeedback(null);
    setShowHint(false);
    setMeasurementsCorrect(0);
    setMeasurementsTotal(0);
    setEstimateErrors([]);
    setToolSelectionsCorrect(0);
    setToolSelectionsTotal(0);
    setUnitSelectionsCorrect(0);
    setUnitSelectionsTotal(0);
    setConversionsCorrect(0);
    setConversionsTotal(0);
    setAttemptsCount(0);
    hasSentPhaseIntro.current.clear();
    resetAttempt();
  };

  // Phase navigation
  const advancePhase = () => {
    const phases: Phase[] = ['explore', 'estimate', 'precision', 'convert'];
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < phases.length - 1) {
      setCurrentPhase(phases[currentIndex + 1]);
    }
  };

  // Tool selector for choose_tool challenges
  const toolOptions: ToolType[] = ['ruler', 'scale', 'measuring_cup', 'thermometer'];

  // Unit selector for choose_unit challenges
  const unitOptions: MeasurementUnit[] = ['cm', 'm', 'g', 'kg', 'mL', 'L', '°C', '°F'];

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
                Measure the {objectToMeasure.name} using {TOOL_LABELS[toolType]}
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

        {/* Phase Progress Indicator */}
        <div className="flex items-center gap-1 mt-4">
          {(['explore', 'estimate', 'precision', 'convert'] as Phase[]).map((phase, i) => {
            const phases: Phase[] = ['explore', 'estimate', 'precision', 'convert'];
            const currentIdx = phases.indexOf(currentPhase);
            const isActive = phase === currentPhase;
            const isComplete = i < currentIdx;

            return (
              <React.Fragment key={phase}>
                {i > 0 && <div className={`h-px flex-1 ${isComplete ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                    isActive ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : isComplete ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800/50 text-slate-500'
                  }`}
                >
                  {isComplete ? '✓' : `${i + 1}`}
                  <span className="hidden sm:inline">{PHASE_LABELS[phase]}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Object Display */}
        <div className="bg-black/20 rounded-lg p-4 text-center">
          <div className="text-4xl mb-2">📦</div>
          <p className="text-slate-200 font-medium">{objectToMeasure.name}</p>
          <p className="text-xs text-slate-500 mt-1">Category: {objectToMeasure.category}</p>
          {nonStandardUnits?.enabled && (
            <p className="text-xs text-amber-300 mt-1">
              Measuring with: {nonStandardUnits.unitName}
            </p>
          )}
        </div>

        {/* Challenge Instructions */}
        {currentChallenge && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-purple-200 text-sm font-medium">
              Challenge {currentChallengeIndex + 1} of {challenges.length}
            </p>
            <p className="text-slate-200 mt-1">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Tool Visualization */}
        {currentChallenge?.type === 'measure' || currentChallenge?.type === 'compare' || currentPhase === 'explore' ? (
          <div>
            {(toolType === 'ruler' || toolType === 'tape_measure') && (
              <RulerVisualization
                value={measurementValue}
                maxValue={maxMeasurementValue}
                unit={nonStandardUnits?.enabled ? 'cm' : unit.primary}
                precision={unit.precision}
                onValueChange={setMeasurementValue}
                disabled={hasSubmitted}
              />
            )}
            {(toolType === 'scale' || toolType === 'balance') && (
              <ScaleVisualization
                value={measurementValue}
                maxValue={maxMeasurementValue}
                unit={unit.primary}
                precision={unit.precision}
                onValueChange={setMeasurementValue}
                disabled={hasSubmitted}
                objectName={objectToMeasure.name}
              />
            )}
            {toolType === 'measuring_cup' && (
              <MeasuringCupVisualization
                value={measurementValue}
                maxValue={maxMeasurementValue}
                unit={unit.primary}
                precision={unit.precision}
                onValueChange={setMeasurementValue}
                disabled={hasSubmitted}
              />
            )}
            {toolType === 'thermometer' && (
              <ThermometerVisualization
                value={measurementValue}
                minValue={minTempValue}
                maxValue={maxTempValue}
                unit={unit.primary}
                precision={unit.precision}
                onValueChange={setMeasurementValue}
                disabled={hasSubmitted}
              />
            )}
          </div>
        ) : null}

        {/* Estimate Input */}
        {currentChallenge?.type === 'estimate' && (
          <div className="bg-black/20 rounded-lg p-4">
            <label className="text-sm text-slate-300 mb-2 block">
              Your estimate ({getUnitLabel(unit.primary)}):
            </label>
            <input
              type="number"
              value={estimateValue}
              onChange={(e) => setEstimateValue(e.target.value)}
              placeholder={`Estimate in ${getUnitLabel(unit.primary)}`}
              disabled={hasSubmitted}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              step={getPrecisionStep(unit.precision)}
            />
          </div>
        )}

        {/* Tool Selection */}
        {currentChallenge?.type === 'choose_tool' && (
          <div className="grid grid-cols-2 gap-2">
            {toolOptions.map(tool => (
              <Button
                key={tool}
                variant="ghost"
                className={`bg-white/5 border hover:bg-white/10 ${
                  selectedTool === tool ? 'border-purple-500 bg-purple-500/20' : 'border-white/20'
                }`}
                onClick={() => setSelectedTool(tool)}
                disabled={hasSubmitted}
              >
                <span className="mr-2">{TOOL_ICONS[tool]}</span>
                {TOOL_LABELS[tool]}
              </Button>
            ))}
          </div>
        )}

        {/* Unit Selection */}
        {currentChallenge?.type === 'choose_unit' && (
          <div className="grid grid-cols-4 gap-2">
            {unitOptions.map(u => (
              <Button
                key={u}
                variant="ghost"
                className={`bg-white/5 border hover:bg-white/10 ${
                  selectedUnit === u ? 'border-purple-500 bg-purple-500/20' : 'border-white/20'
                }`}
                onClick={() => setSelectedUnit(u)}
                disabled={hasSubmitted}
              >
                {getUnitLabel(u)}
              </Button>
            ))}
          </div>
        )}

        {/* Conversion Input */}
        {currentChallenge?.type === 'convert' && (
          <div className="bg-black/20 rounded-lg p-4 space-y-3">
            <label className="text-sm text-slate-300 block">
              Convert your answer:
            </label>
            <input
              type="number"
              value={conversionAnswer}
              onChange={(e) => setConversionAnswer(e.target.value)}
              placeholder={`Enter value in ${unit.secondary ? getUnitLabel(unit.secondary) : 'target unit'}`}
              disabled={hasSubmitted}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              step={getPrecisionStep(unit.precision)}
            />

            {/* Conversion Reference Toggle */}
            {conversionReference?.enabled && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs"
                onClick={() => setShowConversionRef(!showConversionRef)}
              >
                {showConversionRef ? 'Hide' : 'Show'} Conversion Reference
              </Button>
            )}

            {showConversionRef && conversionReference?.conversions && (
              <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
                {conversionReference.conversions.map((conv, i) => (
                  <p key={i} className="text-xs text-slate-300">
                    1 {conv.from} = {conv.factor} {conv.to} — {conv.description}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-lg p-3 border ${
            feedback.correct
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <p className={`text-sm font-medium ${
              feedback.correct ? 'text-emerald-300' : 'text-red-300'
            }`}>
              {feedback.message}
            </p>
          </div>
        )}

        {/* Hint */}
        {showHint && currentChallenge && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-amber-200 text-sm">{currentChallenge.hint}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {!hasSubmitted && currentChallenge && (
            <>
              <Button
                onClick={checkAnswer}
                variant="ghost"
                className="bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 text-purple-200"
              >
                Check Answer
              </Button>
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                onClick={() => setShowHint(true)}
              >
                Need a Hint?
              </Button>
              {currentPhase !== 'convert' && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                  onClick={advancePhase}
                >
                  Skip to Next Phase
                </Button>
              )}
            </>
          )}
          {hasSubmitted && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            >
              Try Again
            </Button>
          )}
        </div>

        {/* Progress Summary */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-slate-100">{measurementsCorrect}/{measurementsTotal}</div>
              <div className="text-xs text-slate-500">Measurements</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-100">
                {estimateErrors.length > 0
                  ? `${Math.round(100 - estimateErrors.reduce((a, b) => a + b, 0) / estimateErrors.length)}%`
                  : '—'}
              </div>
              <div className="text-xs text-slate-500">Est. Accuracy</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-100">{conversionsCorrect}/{conversionsTotal}</div>
              <div className="text-xs text-slate-500">Conversions</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MeasurementTools;
