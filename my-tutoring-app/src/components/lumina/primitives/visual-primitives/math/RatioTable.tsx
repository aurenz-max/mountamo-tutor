'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  usePrimitiveEvaluation,
  type RatioTableMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

export interface RatioTableData {
  title: string;
  description: string;
  rowLabels: [string, string]; // Names for the two quantities
  baseRatio: [number, number]; // The reference ratio (locked first column)

  // Task configuration
  taskType?: 'missing-value' | 'find-multiplier' | 'build-ratio' | 'unit-rate-challenge' | 'explore';
  targetMultiplier?: number; // For missing-value, find-multiplier, and build-ratio tasks
  questionPrompt?: string; // Custom question for the task
  hiddenValue?: 'scaled-first' | 'scaled-second'; // Which value to hide for missing-value task

  maxMultiplier?: number; // Maximum multiplier value for the slider
  showUnitRate?: boolean; // Highlight ratio to 1
  showBarChart?: boolean; // Display visual bar chart

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RatioTableMetrics>) => void;
}

interface RatioTableProps {
  data: RatioTableData;
  className?: string;
}

const RatioTable: React.FC<RatioTableProps> = ({ data, className }) => {
  const {
    rowLabels,
    baseRatio,
    taskType = 'explore',
    targetMultiplier = 1,
    questionPrompt,
    hiddenValue = 'scaled-second',
    maxMultiplier = 10,
    showUnitRate = true,
    showBarChart = true,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State for the multiplier (starts at 1 for explore, or a random value for tasks)
  const [multiplier, setMultiplier] = useState<number>(taskType === 'missing-value' ? targetMultiplier : 1);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [sliderAdjustments, setSliderAdjustments] = useState<number>(0);
  const [exploredMultipliers, setExploredMultipliers] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | null>(null);
  const [hintsUsed, setHintsUsed] = useState<number>(0);

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<RatioTableMetrics>({
    primitiveType: 'ratio-table',
    instanceId: instanceId || `ratio-table-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as
      | ((result: PrimitiveEvaluationResult) => void)
      | undefined,
  });

  // Track exploration for evaluation
  useEffect(() => {
    if (!exploredMultipliers.includes(multiplier)) {
      setExploredMultipliers((prev) => [...prev, multiplier]);
    }
  }, [multiplier, exploredMultipliers]);

  // Calculate the second column based on multiplier
  const secondColumn: [number, number] = [
    baseRatio[0] * multiplier,
    baseRatio[1] * multiplier,
  ];

  // Determine which value is hidden for missing-value task
  const targetValue = hiddenValue === 'scaled-first'
    ? baseRatio[0] * targetMultiplier
    : baseRatio[1] * targetMultiplier;

  // Calculate the constant ratio
  const getConstantRatio = (): string => {
    if (baseRatio[0] === 0) return 'N/A';
    const ratio = baseRatio[1] / baseRatio[0];
    return ratio.toFixed(2);
  };

  // Calculate unit rate
  const getUnitRate = (): string => {
    if (baseRatio[0] === 0) return 'N/A';
    const rate = baseRatio[1] / baseRatio[0];
    return rate.toFixed(2);
  };

  // AI Tutoring hook
  const resolvedInstanceId = instanceId || `ratio-table-${Date.now()}`;
  const hasIntroducedRef = useRef(false);

  const aiPrimitiveData = useMemo(() => ({
    rowLabels,
    baseRatio,
    taskType,
    multiplier,
    studentAnswer,
    targetMultiplier,
    targetValue,
    unitRate: getUnitRate(),
    hintsUsed,
    sliderAdjustments,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rowLabels, baseRatio, taskType, multiplier, studentAnswer, targetMultiplier, targetValue, hintsUsed, sliderAdjustments]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'ratio-table',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
  });

  // Introduce the activity when AI connects
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    if (taskType === 'missing-value') {
      sendText(
        `[ACTIVITY_START] Student is solving a missing-value ratio problem. `
        + `Base ratio: ${baseRatio[0]} ${rowLabels[0]} to ${baseRatio[1]} ${rowLabels[1]}. `
        + `They need to find the missing scaled value (×${targetMultiplier}). `
        + `${questionPrompt ? `Question: "${questionPrompt}". ` : ''}`
        + `Introduce the problem warmly and ask them to look at the reference ratio first.`,
        { silent: true }
      );
    } else {
      sendText(
        `[ACTIVITY_START] Student is exploring equivalent ratios. `
        + `Base ratio: ${baseRatio[0]} ${rowLabels[0]} to ${baseRatio[1]} ${rowLabels[1]}. `
        + `They can adjust a multiplier slider to see how both values scale proportionally. `
        + `Introduce the ratio table and encourage them to try different multipliers.`,
        { silent: true }
      );
    }
  }, [isConnected, baseRatio, rowLabels, taskType, targetMultiplier, questionPrompt, sendText]);

  // Handle multiplier input change
  const handleMultiplierChange = (value: string) => {
    if (hasSubmittedEvaluation) return;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;
    if (numValue > maxMultiplier) {
      setMultiplier(maxMultiplier);
    } else {
      setMultiplier(numValue);
    }
    setSliderAdjustments((prev) => prev + 1);
  };

  // Handle slider change
  const handleSliderChange = (value: number) => {
    if (hasSubmittedEvaluation) return;
    setMultiplier(value);
    setSliderAdjustments((prev) => prev + 1);
    setFeedback(null);
  };

  // Hint system
  const provideHint = () => {
    if (hasSubmittedEvaluation) return;
    setHintsUsed((prev) => prev + 1);

    if (taskType === 'missing-value') {
      if (hintsUsed === 0) {
        setFeedback(`Hint: The unit rate is ${getUnitRate()} ${rowLabels[1]} per ${rowLabels[0]}. Use this to find the missing value.`);
        setFeedbackType('hint');
      } else if (hintsUsed === 1) {
        setFeedback(`Hint: Multiply the unit rate (${getUnitRate()}) by the known quantity to find the missing value.`);
        setFeedbackType('hint');
      } else {
        setFeedback(`Hint: The answer is ${targetValue.toFixed(2)}`);
        setFeedbackType('hint');
      }
    }

    sendText(
      `[HINT_REQUESTED] Student requested hint ${hintsUsed + 1}/3. `
      + `Base ratio: ${baseRatio[0]}:${baseRatio[1]}. Unit rate: ${getUnitRate()}. `
      + `Acknowledge they asked for help and provide scaffolding at the appropriate level.`,
      { silent: true }
    );
  };

  // Submit handler for evaluation
  const handleSubmit = () => {
    if (hasSubmittedEvaluation) return;

    let success = false;
    let score = 0;
    let answerCorrect = false;
    let strategyUsed: 'calculation' | 'trial-and-error' | 'pattern-recognition' | 'unknown' = 'unknown';

    if (taskType === 'missing-value') {
      const parsedAnswer = parseFloat(studentAnswer);
      const percentError = Math.abs((parsedAnswer - targetValue) / targetValue) * 100;
      answerCorrect = percentError < 1; // Within 1% tolerance

      if (answerCorrect) {
        success = true;
        score = 100;
        setFeedback(`Perfect! The answer is ${parsedAnswer.toFixed(2)}. You've correctly solved the proportional relationship.`);
        setFeedbackType('success');
        sendText(
          `[ANSWER_CORRECT] Student answered ${parsedAnswer.toFixed(2)} which is correct! `
          + `They used ${hintsUsed} hints and ${sliderAdjustments} slider adjustments. `
          + `Celebrate briefly and reinforce the proportional reasoning they used.`,
          { silent: true }
        );
      } else if (percentError < 5) {
        score = 75;
        setFeedback(`Very close! Your answer ${parsedAnswer.toFixed(2)} is nearly correct. The exact answer is ${targetValue.toFixed(2)}.`);
        setFeedbackType('hint');
        sendText(
          `[ANSWER_CLOSE] Student answered ${parsedAnswer.toFixed(2)} but the exact answer is ${targetValue.toFixed(2)} (${percentError.toFixed(1)}% off). `
          + `Encourage them — they are very close. Suggest checking their arithmetic or rounding.`,
          { silent: true }
        );
      } else if (percentError < 20) {
        score = 50;
        setFeedback(`Not quite. Your answer ${parsedAnswer.toFixed(2)} is off. Try using the unit rate: ${getUnitRate()} ${rowLabels[1]} per ${rowLabels[0]}.`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student answered ${parsedAnswer.toFixed(2)} but the correct answer is ${targetValue.toFixed(2)} (${percentError.toFixed(1)}% off). `
          + `Guide them toward using the unit rate (${getUnitRate()}) without revealing the answer.`,
          { silent: true }
        );
      } else {
        score = 0;
        setFeedback(`That's not correct. Remember: the ratio stays constant. Try calculating the unit rate first.`);
        setFeedbackType('error');
        sendText(
          `[ANSWER_FAR_OFF] Student answered ${parsedAnswer.toFixed(2)} but the correct answer is ${targetValue.toFixed(2)} (${percentError.toFixed(1)}% off). `
          + `They may not understand the proportional relationship yet. `
          + `Start with scaffolding level 1: ask them to look at the base ratio and find the unit rate.`,
          { silent: true }
        );
      }

      // Determine strategy based on behavior
      if (sliderAdjustments < 3) {
        strategyUsed = 'calculation';
      } else if (sliderAdjustments < 10) {
        strategyUsed = 'pattern-recognition';
      } else {
        strategyUsed = 'trial-and-error';
      }
    }

    const unitRate = baseRatio[0] !== 0 ? baseRatio[1] / baseRatio[0] : 0;
    const explorationRange: [number, number] = exploredMultipliers.length > 0
      ? [Math.min(...exploredMultipliers), Math.max(...exploredMultipliers)]
      : [multiplier, multiplier];

    const metrics: RatioTableMetrics = {
      type: 'ratio-table',
      taskType,
      goalMet: success,
      baseRatio,
      unitRate,
      targetMultiplier: taskType === 'missing-value' ? targetMultiplier : undefined,
      targetValue: taskType === 'missing-value' ? targetValue : undefined,
      studentAnswer: taskType === 'missing-value' ? parseFloat(studentAnswer) : undefined,
      answerCorrect,
      answerPrecision: taskType === 'missing-value'
        ? Math.max(0, 100 - Math.abs((parseFloat(studentAnswer) - targetValue) / targetValue) * 100)
        : undefined,
      attempts: 1,
      hintsRequested: hintsUsed,
      sliderAdjustments,
      explorationRange,
      usedCalculation: strategyUsed === 'calculation',
      strategyUsed,
      finalMultiplier: multiplier,
      finalScaledValues: secondColumn,
    };

    submitEvaluation(success, score, metrics, {
      studentWork: {
        taskType,
        studentAnswer: taskType === 'missing-value' ? studentAnswer : undefined,
        finalMultiplier: multiplier,
        sliderAdjustments,
        hintsUsed,
      },
    });
  };

  // Reset handler
  const handleReset = () => {
    setStudentAnswer('');
    setMultiplier(taskType === 'missing-value' ? targetMultiplier : 1);
    setSliderAdjustments(0);
    setExploredMultipliers([]);
    setFeedback(null);
    setFeedbackType(null);
    setHintsUsed(0);
    resetEvaluationAttempt();

    sendText(
      `[RETRY] Student is trying the problem again. `
      + `Encourage them warmly and suggest a fresh approach — maybe start by finding the unit rate.`,
      { silent: true }
    );
  };

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30 text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Ratio Table</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            <p className="text-xs text-teal-400 font-mono uppercase tracking-wider">Proportional Relationships</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-teal-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#14b8a6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Task-Specific Question Prompt */}
          {taskType === 'missing-value' && questionPrompt && (
            <div className="mb-6 p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl border-2 border-purple-400/50 relative overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/30 flex items-center justify-center border border-purple-400/50">
                    <span className="text-purple-200 text-xl">?</span>
                  </div>
                  <h4 className="text-lg font-bold text-purple-200 uppercase tracking-wide">Challenge Question</h4>
                </div>
                <p className="text-white text-lg font-medium">{questionPrompt}</p>
              </div>
            </div>
          )}

          {/* Constant Ratio Display */}
          {showUnitRate && (
            <div className="mb-6 p-4 bg-teal-500/20 backdrop-blur-sm rounded-xl border border-teal-400/40 text-center shadow-[0_0_25px_rgba(20,184,166,0.2)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <p className="text-sm text-teal-300 font-mono relative z-10">
                Constant Ratio: <span className="text-2xl font-bold text-teal-100">{getConstantRatio()}</span>
                {' '}
                <span className="text-teal-400">
                  ({rowLabels[1]} per {rowLabels[0]})
                </span>
              </p>
            </div>
          )}

          {/* Ratio Table */}
          <div className="mb-8 p-6 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none rounded-2xl"></div>

            <div className="relative z-10 grid grid-cols-2 gap-6">
              {/* First Column - Reference (Locked) */}
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <span className="text-teal-400 font-mono text-sm uppercase tracking-wider">Reference Ratio</span>
                </div>

                {/* Row 1 - First Column */}
                <div className="p-4 bg-teal-600/20 backdrop-blur-sm rounded-xl border-2 border-teal-500/40 text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-xs text-teal-400 mb-1 font-medium">{rowLabels[0]}</p>
                    <p className="text-3xl font-bold text-white font-mono">{baseRatio[0]}</p>
                  </div>
                  <div className="absolute inset-0 border-2 border-teal-400/0 group-hover:border-teal-400/30 rounded-xl transition-all pointer-events-none"></div>
                </div>

                {/* Row 2 - First Column */}
                <div className="p-4 bg-teal-600/20 backdrop-blur-sm rounded-xl border-2 border-teal-500/40 text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-xs text-teal-400 mb-1 font-medium">{rowLabels[1]}</p>
                    <p className="text-3xl font-bold text-white font-mono">{baseRatio[1]}</p>
                  </div>
                  <div className="absolute inset-0 border-2 border-teal-400/0 group-hover:border-teal-400/30 rounded-xl transition-all pointer-events-none"></div>
                </div>

                {/* Unit Rate */}
                {showUnitRate && (
                  <div className="p-3 bg-slate-700/30 backdrop-blur-sm rounded-lg border border-slate-600/40 text-center">
                    <p className="text-xs text-slate-400 mb-1">Unit Rate</p>
                    <p className="text-lg font-mono text-slate-300">{getUnitRate()}</p>
                  </div>
                )}
              </div>

              {/* Second Column - Adjustable or Hidden for Tasks */}
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <span className="text-purple-400 font-mono text-sm uppercase tracking-wider">
                    {taskType === 'missing-value' ? 'Find the Missing Value' : `Scaled by ×${multiplier.toFixed(1)}`}
                  </span>
                </div>

                {/* Row 1 - Second Column */}
                <div className="p-4 bg-purple-500/20 backdrop-blur-sm rounded-xl border-2 border-purple-400/50 text-center relative overflow-hidden group hover:border-purple-400/70 transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-xs text-purple-400 mb-1 font-medium">{rowLabels[0]}</p>
                    {taskType === 'missing-value' && hiddenValue === 'scaled-first' && !hasSubmittedEvaluation ? (
                      <p className="text-3xl font-bold text-purple-300 font-mono">?</p>
                    ) : (
                      <p className="text-3xl font-bold text-white font-mono">{secondColumn[0].toFixed(1)}</p>
                    )}
                  </div>
                </div>

                {/* Row 2 - Second Column */}
                <div className="p-4 bg-purple-500/20 backdrop-blur-sm rounded-xl border-2 border-purple-400/50 text-center relative overflow-hidden group hover:border-purple-400/70 transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-xs text-purple-400 mb-1 font-medium">{rowLabels[1]}</p>
                    {taskType === 'missing-value' && hiddenValue === 'scaled-second' && !hasSubmittedEvaluation ? (
                      <p className="text-3xl font-bold text-purple-300 font-mono">?</p>
                    ) : (
                      <p className="text-3xl font-bold text-white font-mono">{secondColumn[1].toFixed(1)}</p>
                    )}
                  </div>
                </div>

                {/* Unit Rate */}
                {showUnitRate && (
                  <div className="p-3 bg-slate-700/30 backdrop-blur-sm rounded-lg border border-slate-600/40 text-center">
                    <p className="text-xs text-slate-400 mb-1">Unit Rate</p>
                    <p className="text-lg font-mono text-slate-300">{getUnitRate()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Answer Input for Missing-Value Task */}
          {taskType === 'missing-value' && (
            <div className="mb-8 p-6 bg-gradient-to-br from-pink-500/20 to-purple-500/20 backdrop-blur-sm border-2 border-pink-400/50 rounded-2xl relative overflow-hidden shadow-[0_0_30px_rgba(236,72,153,0.2)]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <label className="text-pink-200 font-bold text-lg mb-4 block">Your Answer</label>
                <div className="flex gap-4 items-center">
                  <input
                    type="number"
                    step="0.01"
                    value={studentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    disabled={hasSubmittedEvaluation}
                    placeholder="Enter your answer"
                    className="flex-1 px-6 py-4 bg-slate-800/50 backdrop-blur-sm text-white text-2xl rounded-xl border-2 border-pink-400/40 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/30 focus:outline-none text-center font-mono font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={provideHint}
                    disabled={hasSubmittedEvaluation}
                    className="px-6 py-4 bg-yellow-500/20 backdrop-blur-sm text-yellow-200 rounded-xl border-2 border-yellow-400/50 hover:border-yellow-400/80 hover:bg-yellow-500/30 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Hint ({hintsUsed}/3)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Multiplier Control (only for explore mode) */}
          {taskType !== 'missing-value' && (
            <div className="mb-8 p-6 bg-purple-500/20 backdrop-blur-sm border-2 border-purple-400/50 rounded-2xl relative overflow-hidden shadow-[0_0_25px_rgba(168,85,247,0.2)]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-purple-200 font-bold text-lg">Adjust Multiplier</label>
                  <input
                    type="number"
                    min="0"
                    max={maxMultiplier}
                    step="0.1"
                    value={multiplier}
                    onChange={(e) => handleMultiplierChange(e.target.value)}
                    className="w-24 px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg border border-purple-400/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none text-center font-mono font-bold transition-all"
                  />
                </div>

                <input
                  type="range"
                  min="0"
                  max={maxMultiplier}
                  step="0.1"
                  value={multiplier}
                  onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                  className="w-full h-3 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
                  style={{
                    background: `linear-gradient(to right, rgba(168,85,247,0.4) 0%, rgba(168,85,247,0.4) ${(multiplier / maxMultiplier) * 100}%, rgba(51,65,85,0.5) ${(multiplier / maxMultiplier) * 100}%, rgba(51,65,85,0.5) 100%)`
                  }}
                />

                <div className="flex justify-between mt-2 text-xs text-purple-300 font-mono">
                  <span>0</span>
                  <span>{maxMultiplier}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bar Chart Visualization */}
          {showBarChart && (
            <div className="mb-8 p-6 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none rounded-2xl"></div>

              <div className="relative z-10">
                <h4 className="text-sm font-mono uppercase tracking-wider text-teal-400 mb-6 text-center">Visual Comparison</h4>

                <div className="space-y-8">
                  {/* Reference Column */}
                  <div>
                    <p className="text-sm text-teal-400 font-mono uppercase tracking-wider mb-3 text-center">Reference Ratio</p>
                    <div className="space-y-3">
                      {/* Reference - First quantity */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-32 text-right">{rowLabels[0]}</span>
                        <div
                          className="relative group flex-shrink-0"
                          onMouseEnter={() => setHoveredBar(0)}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{ width: '150px' }}
                        >
                          <div className="h-12 bg-teal-500/30 backdrop-blur-sm rounded-lg border-2 border-teal-400/50 flex items-center justify-center relative overflow-hidden transition-all group-hover:border-teal-400/80 group-hover:shadow-[0_0_20px_rgba(20,184,166,0.4)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-transparent pointer-events-none"></div>
                            <span className="text-white font-bold font-mono relative z-10">{baseRatio[0]}</span>
                          </div>
                        </div>
                      </div>

                      {/* Reference - Second quantity */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-32 text-right">{rowLabels[1]}</span>
                        <div
                          className="relative group flex-shrink-0"
                          onMouseEnter={() => setHoveredBar(1)}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{ width: '150px' }}
                        >
                          <div className="h-12 bg-teal-500/30 backdrop-blur-sm rounded-lg border-2 border-teal-400/50 flex items-center justify-center relative overflow-hidden transition-all group-hover:border-teal-400/80 group-hover:shadow-[0_0_20px_rgba(20,184,166,0.4)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-transparent pointer-events-none"></div>
                            <span className="text-white font-bold font-mono relative z-10">{baseRatio[1]}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scaled Column */}
                  <div>
                    <p className="text-sm text-purple-400 font-mono uppercase tracking-wider mb-3 text-center">Scaled (×{multiplier.toFixed(1)})</p>
                    <div className="space-y-3">
                      {/* Scaled - First quantity */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-32 text-right">{rowLabels[0]}</span>
                        <div
                          className="relative group flex-shrink-0 transition-all duration-300"
                          onMouseEnter={() => setHoveredBar(2)}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{ width: `${150 * multiplier}px` }}
                        >
                          <div className="h-12 bg-purple-500/30 backdrop-blur-sm rounded-lg border-2 border-purple-400/50 flex items-center justify-center relative overflow-hidden transition-all group-hover:border-purple-400/80 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-transparent pointer-events-none"></div>
                            <span className="text-white font-bold font-mono relative z-10">{secondColumn[0].toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Scaled - Second quantity */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-32 text-right">{rowLabels[1]}</span>
                        <div
                          className="relative group flex-shrink-0 transition-all duration-300"
                          onMouseEnter={() => setHoveredBar(3)}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{ width: `${150 * multiplier}px` }}
                        >
                          <div className="h-12 bg-purple-500/30 backdrop-blur-sm rounded-lg border-2 border-purple-400/50 flex items-center justify-center relative overflow-hidden transition-all group-hover:border-purple-400/80 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-transparent pointer-events-none"></div>
                            <span className="text-white font-bold font-mono relative z-10">{secondColumn[1].toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-6 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-teal-500/30 border-2 border-teal-400/50 rounded"></div>
                    <span className="text-slate-300">Reference</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-500/30 border-2 border-purple-400/50 rounded"></div>
                    <span className="text-slate-300">Scaled (×{multiplier.toFixed(1)})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Display */}
          {feedback && (
            <div className={`mb-6 p-6 backdrop-blur-sm rounded-2xl border-2 relative overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.2)] ${
              feedbackType === 'success'
                ? 'bg-green-500/20 border-green-400/50'
                : feedbackType === 'error'
                ? 'bg-red-500/20 border-red-400/50'
                : 'bg-yellow-500/20 border-yellow-400/50'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
              <div className="relative z-10 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 ${
                  feedbackType === 'success'
                    ? 'bg-green-500/30 border-green-400/50'
                    : feedbackType === 'error'
                    ? 'bg-red-500/30 border-red-400/50'
                    : 'bg-yellow-500/30 border-yellow-400/50'
                }`}>
                  {feedbackType === 'success' ? '✓' : feedbackType === 'error' ? '✗' : '💡'}
                </div>
                <p className={`text-lg font-medium flex-1 ${
                  feedbackType === 'success'
                    ? 'text-green-100'
                    : feedbackType === 'error'
                    ? 'text-red-100'
                    : 'text-yellow-100'
                }`}>
                  {feedback}
                </p>
              </div>
            </div>
          )}

          {/* Submit and Reset Buttons */}
          {taskType !== 'explore' && (
            <div className="mb-6 flex gap-4 items-center justify-center">
              <button
                onClick={handleSubmit}
                disabled={hasSubmittedEvaluation || (taskType === 'missing-value' && !studentAnswer)}
                className="px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-teal-500 disabled:hover:to-cyan-500 text-lg"
              >
                {hasSubmittedEvaluation ? 'Submitted ✓' : 'Submit Answer'}
              </button>
              {hasSubmittedEvaluation && (
                <button
                  onClick={handleReset}
                  className="px-8 py-4 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <h4 className="text-sm font-mono uppercase tracking-wider text-teal-400 mb-4">
                {taskType === 'missing-value' ? 'How to Solve' : 'How to Use'}
              </h4>
              <ul className="text-sm text-slate-200 space-y-2">
                {taskType === 'missing-value' ? (
                  <>
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-teal-400 mt-1">▸</span>
                      <span>Look at the reference ratio to understand the relationship</span>
                    </li>
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-teal-400 mt-1">▸</span>
                      <span>Calculate the unit rate (divide the second quantity by the first)</span>
                    </li>
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-teal-400 mt-1">▸</span>
                      <span>Use the unit rate to find the missing value in the scaled column</span>
                    </li>
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-teal-400 mt-1">▸</span>
                      <span>Click "Hint" if you need help solving the problem</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-teal-400 mt-1">▸</span>
                      <span>The reference ratio shows the base proportional relationship</span>
                    </li>
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-teal-400 mt-1">▸</span>
                      <span>Use the slider to adjust the multiplier and see how values scale</span>
                    </li>
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-teal-400 mt-1">▸</span>
                      <span>The bar chart visualizes how both quantities scale proportionally</span>
                    </li>
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-teal-400 mt-1">▸</span>
                      <span>Notice how the unit rate remains constant regardless of scaling</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RatioTable;