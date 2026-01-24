'use client';

import React, { useState } from 'react';
import {
  usePrimitiveEvaluation,
  type DoubleNumberLineMetrics,
} from '../../../evaluation';

/**
 * Double Number Line - Interactive proportional reasoning tool for teaching ratio relationships
 *
 * K-8 Math Primitive for understanding:
 * - Equivalent ratios and proportional relationships (Grade 6-7)
 * - Unit rates and scaling (Grade 6-8)
 * - Visual representation of multiplicative thinking (Grade 5-7)
 * - Cross-quantity relationships (e.g., distance/time, cost/quantity)
 *
 * Real-world connections: recipes, unit pricing, speed/distance, currency conversion
 *
 * EDUCATIONAL DESIGN:
 * - Guided 3-phase learning: Explore → Practice → Apply
 * - Phase 1: Students discover the relationship by finding the unit rate
 * - Phase 2: Students scale up to find equivalent ratios
 * - Phase 3: Students apply understanding to solve the full problem
 * - Visual guides help students see the multiplicative relationship
 *
 * EVALUATION INTEGRATION:
 * - Tracks unit rate identification, scaling accuracy, and proportional reasoning
 * - Submits evaluation metrics when all target points are correctly identified
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

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

export interface DoubleNumberLineData {
  title: string;
  description: string;
  topLabel: string;
  bottomLabel: string;
  topScale: ScaleConfig;
  bottomScale: ScaleConfig;

  // Problem-solving: Points student must discover
  targetPoints: LinkedPoint[];

  // Optional hints shown to help students
  givenPoints?: LinkedPoint[];
  showUnitRate?: boolean; // Whether to highlight unit rate in hints
  showVerticalGuides?: boolean;

  // Educational scaffolding
  contextQuestion?: string; // Real-world question to frame the problem
  unitRateQuestion?: string; // Question to guide finding unit rate

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: import('../../../evaluation').PrimitiveEvaluationResult<DoubleNumberLineMetrics>
  ) => void;
}

interface DoubleNumberLineProps {
  data: DoubleNumberLineData;
  className?: string;
}

interface StudentPoint {
  topValue: string; // Input as string
  bottomValue: string; // Input as string
  topCorrect: boolean;
  bottomCorrect: boolean;
}

type LearningPhase = 'explore' | 'practice' | 'apply';

const DoubleNumberLine: React.FC<DoubleNumberLineProps> = ({ data, className }) => {
  const {
    topLabel,
    bottomLabel,
    topScale,
    bottomScale,
    targetPoints,
    givenPoints = [],
    showUnitRate = false,
    showVerticalGuides = true,
    contextQuestion,
    unitRateQuestion,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Learning phases
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('explore');
  const [unitRateFound, setUnitRateFound] = useState(false);
  const [studentUnitRate, setStudentUnitRate] = useState('');

  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [studentPoints, setStudentPoints] = useState<StudentPoint[]>(
    targetPoints.map(() => ({ topValue: '', bottomValue: '', topCorrect: false, bottomCorrect: false }))
  );
  const [attemptCount, setAttemptCount] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<DoubleNumberLineMetrics>({
    primitiveType: 'double-number-line',
    instanceId: instanceId || `double-number-line-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as
      | ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void)
      | undefined,
  });

  // Helper: check if value is within tolerance
  const isWithinTolerance = (student: number, target: number, tolerance = 0.1): boolean => {
    return Math.abs(student - target) <= tolerance;
  };

  // Helper: calculate ratio from first given point or first target point
  const calculateRatio = (): string => {
    const point = givenPoints[0] || targetPoints[0];
    if (!point || point.topValue === 0) return '1:1';
    const ratio = point.bottomValue / point.topValue;
    return `1:${ratio.toFixed(2)}`;
  };

  // Find the unit rate point (where top value = 1) from given or target points
  const findUnitRatePoint = (): LinkedPoint | null => {
    const allPoints = [...givenPoints, ...targetPoints];
    return allPoints.find(p => Math.abs(p.topValue - 1) < 0.01) || null;
  };

  // Check if student found the unit rate
  const handleCheckUnitRate = () => {
    const unitRatePoint = findUnitRatePoint();
    if (!unitRatePoint) {
      setFeedback('This problem doesn\'t have a unit rate point to find. Moving to practice phase!');
      setFeedbackType('hint');
      setUnitRateFound(true);
      setCurrentPhase('practice');
      return;
    }

    const bottomValue = parseFloat(studentUnitRate);

    // We automatically know the top value is 1 (that's what we're asking)
    const bottomCorrect = !isNaN(bottomValue) && isWithinTolerance(bottomValue, unitRatePoint.bottomValue);

    if (bottomCorrect) {
      setFeedback(`Perfect! You found the unit rate: 1 ${topLabel.toLowerCase()} = ${unitRatePoint.bottomValue} ${bottomLabel.toLowerCase()}. This is the key to solving the whole problem!`);
      setFeedbackType('success');
      setUnitRateFound(true);
      setTimeout(() => setCurrentPhase('practice'), 2000);
    } else {
      const hint = unitRatePoint.bottomValue < 10
        ? `Hint: Look at the number lines carefully. When ${topLabel} = 1, what value on the ${bottomLabel} line matches up?`
        : `Hint: Think about the relationship shown in the context question above.`;
      setFeedback(hint);
      setFeedbackType('error');
    }
  };

  // Handle input changes
  const handleInputChange = (index: number, field: 'topValue' | 'bottomValue', value: string) => {
    if (hasSubmittedEvaluation) return;

    const newPoints = [...studentPoints];
    newPoints[index] = { ...newPoints[index], [field]: value };
    setStudentPoints(newPoints);
    setFeedback(null);
  };

  // Check answers
  const handleCheckAnswers = () => {
    if (hasSubmittedEvaluation) return;

    setAttemptCount(prev => prev + 1);
    const newPoints = [...studentPoints];
    let allCorrect = true;
    let correctCount = 0;

    for (let i = 0; i < targetPoints.length; i++) {
      const target = targetPoints[i];
      const studentBottom = parseFloat(newPoints[i].bottomValue);

      // Students are only entering bottom values (top values are given)
      const bottomCorrect = !isNaN(studentBottom) && isWithinTolerance(studentBottom, target.bottomValue);

      // Mark top as automatically correct since it's given
      newPoints[i].topCorrect = true;
      newPoints[i].bottomCorrect = bottomCorrect;

      if (bottomCorrect) {
        correctCount++;
      } else {
        allCorrect = false;
      }
    }

    setStudentPoints(newPoints);

    if (allCorrect) {
      setFeedback('Perfect! All points are correctly placed on both number lines!');
      setFeedbackType('success');
      handleSubmit(newPoints);
    } else {
      setFeedback(`${correctCount} of ${targetPoints.length} points correct. Check your work and try again!`);
      setFeedbackType('error');
    }
  };

  // Submit evaluation
  const handleSubmit = (finalPoints: StudentPoint[]) => {
    if (hasSubmittedEvaluation) return;

    // Calculate metrics
    const pointResults = targetPoints.map((target, i) => {
      const studentTop = parseFloat(finalPoints[i].topValue);
      const studentBottom = parseFloat(finalPoints[i].bottomValue);
      return {
        index: i,
        targetTop: target.topValue,
        targetBottom: target.bottomValue,
        studentTop: isNaN(studentTop) ? null : studentTop,
        studentBottom: isNaN(studentBottom) ? null : studentBottom,
        topCorrect: finalPoints[i].topCorrect,
        bottomCorrect: finalPoints[i].bottomCorrect,
        bothCorrect: finalPoints[i].topCorrect && finalPoints[i].bottomCorrect,
      };
    });

    const correctPoints = pointResults.filter(p => p.bothCorrect).length;
    const allPointsCorrect = correctPoints === targetPoints.length;
    const topCorrect = pointResults.filter(p => p.topCorrect).length;
    const bottomCorrect = pointResults.filter(p => p.bottomCorrect).length;

    // Check if unit rate was identified (top = 1)
    const unitRateIdentified = pointResults.some(p =>
      Math.abs(p.targetTop - 1) < 0.01 && p.bothCorrect
    );

    const metrics: DoubleNumberLineMetrics = {
      type: 'double-number-line',
      totalTargetPoints: targetPoints.length,
      correctPoints,
      allPointsCorrect,
      unitRateIdentified,
      correctRatio: calculateRatio(),
      pointResults,
      attemptsCount: attemptCount,
      hintsUsed: showHints ? 1 : 0,
      usedGivenPoints: givenPoints.length > 0,
      topValueAccuracy: (topCorrect / targetPoints.length) * 100,
      bottomValueAccuracy: (bottomCorrect / targetPoints.length) * 100,
      overallAccuracy: (correctPoints / targetPoints.length) * 100,
    };

    const score = (correctPoints / targetPoints.length) * 100;

    submitEvaluation(allPointsCorrect, score, metrics, {
      studentWork: { studentPoints: finalPoints },
    });
  };

  // Reset and try again
  const handleReset = () => {
    setStudentPoints(targetPoints.map(() => ({ topValue: '', bottomValue: '', topCorrect: false, bottomCorrect: false })));
    setAttemptCount(0);
    setShowHints(false);
    setFeedback(null);
    setFeedbackType(null);
    setCurrentPhase('explore');
    setUnitRateFound(false);
    setStudentUnitRate('');
    setShowExplanation(false);
    resetEvaluationAttempt();
  };

  // Calculate positions for tick marks
  const topTickCount = Math.floor((topScale.max - topScale.min) / topScale.interval) + 1;
  const bottomTickCount = Math.floor((bottomScale.max - bottomScale.min) / bottomScale.interval) + 1;

  const getTopPosition = (value: number): number => {
    return ((value - topScale.min) / (topScale.max - topScale.min)) * 100;
  };

  const getBottomPosition = (value: number): number => {
    return ((value - bottomScale.min) / (bottomScale.max - bottomScale.min)) * 100;
  };

  // Generate tick marks for top line
  const topTicks = Array.from({ length: topTickCount }, (_, i) => {
    const value = topScale.min + i * topScale.interval;
    const position = getTopPosition(value);
    return { value, position };
  });

  // Generate tick marks for bottom line
  const bottomTicks = Array.from({ length: bottomTickCount }, (_, i) => {
    const value = bottomScale.min + i * bottomScale.interval;
    const position = getBottomPosition(value);
    return { value, position };
  });

  // Display points are the given hints
  const displayPoints = givenPoints;

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
            <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">Proportional Reasoning</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-16 rounded-3xl border border-purple-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Phase Progress Indicator */}
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-2 bg-slate-800/60 px-6 py-3 rounded-full border border-slate-700/50">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${currentPhase === 'explore' ? 'bg-blue-500/20 border border-blue-500/50' : 'opacity-50'}`}>
                <span className={`w-2 h-2 rounded-full ${currentPhase === 'explore' ? 'bg-blue-400' : 'bg-slate-500'}`}></span>
                <span className="text-xs font-semibold">1. Explore</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${currentPhase === 'practice' ? 'bg-yellow-500/20 border border-yellow-500/50' : 'opacity-50'}`}>
                <span className={`w-2 h-2 rounded-full ${currentPhase === 'practice' ? 'bg-yellow-400' : 'bg-slate-500'}`}></span>
                <span className="text-xs font-semibold">2. Practice</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${currentPhase === 'apply' ? 'bg-green-500/20 border border-green-500/50' : 'opacity-50'}`}>
                <span className={`w-2 h-2 rounded-full ${currentPhase === 'apply' ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                <span className="text-xs font-semibold">3. Apply</span>
              </div>
            </div>
          </div>

          <div className="mb-12 text-center max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>

            {/* Context Question */}
            {contextQuestion && (
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-200 font-medium">
                  {contextQuestion}
                </p>
              </div>
            )}

            {/* Phase-specific instructions */}
            {currentPhase === 'explore' && (
              <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-sm text-purple-200">
                  <strong>Step 1: Find the Unit Rate</strong><br />
                  {unitRateQuestion || `Look at the number lines. Find where ${topLabel} = 1, and see what ${bottomLabel} value lines up with it. This is the "unit rate" - the key to solving the whole problem!`}
                </p>
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline"
                >
                  {showExplanation ? 'Hide' : 'Show'} What is a unit rate?
                </button>
                {showExplanation && (
                  <div className="mt-3 p-3 bg-slate-900/50 rounded text-left">
                    <p className="text-xs text-slate-300">
                      A <strong>unit rate</strong> tells you how much of one quantity corresponds to exactly <strong>1 unit</strong> of another.
                      For example, "3 cups of yogurt per 1 banana" is a unit rate. Once you know this, you can multiply to find any amount!
                    </p>
                  </div>
                )}
              </div>
            )}

            {currentPhase === 'practice' && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-200">
                  <strong>Step 2: Practice Scaling</strong><br />
                  Great! Now use the unit rate to find the other missing values. Multiply the unit rate by the {topLabel} value to get the {bottomLabel} value.
                </p>
              </div>
            )}

            {currentPhase === 'apply' && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-green-200">
                  <strong>Step 3: Apply Your Understanding</strong><br />
                  You've got the pattern! Now find all the remaining values using the relationship you discovered.
                </p>
              </div>
            )}
          </div>

          {/* Double Number Line Visualization */}
          <div className="w-full max-w-3xl mx-auto px-8 py-12 space-y-24">
            {/* Top Number Line */}
            <div className="relative">
              {/* Label */}
              <div className="absolute -top-8 left-0 text-sm font-semibold text-purple-300 uppercase tracking-wide">
                {topLabel}
              </div>

              {/* Line */}
              <div className="relative h-1 bg-slate-600 rounded-full">
                {/* Ticks */}
                {topTicks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute w-px h-4 bg-slate-500 top-full mt-1 flex flex-col items-center -translate-x-1/2"
                    style={{ left: `${tick.position}%` }}
                  >
                    <span className="mt-2 text-sm text-slate-400 font-mono font-semibold">
                      {tick.value}
                    </span>
                  </div>
                ))}

                {/* Only show given hint points (not target points the student needs to find) */}
                {displayPoints.map((point, i) => {
                  const position = getTopPosition(point.topValue);
                  const isHovered = hoveredPoint === i;
                  const isUnitRate = showUnitRate && Math.abs(point.topValue - 1) < 0.01;
                  return (
                    <div
                      key={`display-${i}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${position}%` }}
                      onMouseEnter={() => setHoveredPoint(i)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <div className={`w-4 h-4 rounded-full ${isUnitRate ? 'bg-yellow-500' : 'bg-purple-500'} border-2 border-white shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-300 cursor-help ${isHovered ? 'scale-150' : ''}`}></div>
                      {(point.label || isUnitRate) && (
                        <div className={`absolute bottom-full mb-3 px-3 py-1 ${isUnitRate ? 'bg-yellow-600' : 'bg-purple-600'} text-white text-xs rounded transition-opacity whitespace-nowrap pointer-events-none ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                          {isUnitRate ? 'Unit Rate' : point.label}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Show target points ONLY after student has entered values in practice/apply phase */}
                {(currentPhase === 'practice' || currentPhase === 'apply') && targetPoints.map((point, i) => {
                  // In practice phase, only show first 2 points
                  if (currentPhase === 'practice' && i >= 2) return null;

                  const position = getTopPosition(point.topValue);
                  const studentValue = parseFloat(studentPoints[i].topValue);
                  const hasValue = !isNaN(studentValue) && studentPoints[i].topValue !== '';
                  const isCorrect = studentPoints[i].topCorrect && attemptCount > 0;

                  // Only show if student has entered a value OR after checking
                  if (!hasValue && attemptCount === 0) {
                    // Show empty placeholder dot
                    return (
                      <div
                        key={`target-top-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${position}%` }}
                      >
                        <div className="w-3 h-3 rounded-full border-2 border-slate-600 bg-slate-800/50 transition-all duration-300"></div>
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-slate-500 font-semibold whitespace-nowrap">
                          Point {i + 1}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`target-top-${i}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${position}%` }}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 ${isCorrect ? 'bg-green-500 border-green-300' : hasValue ? 'bg-blue-400 border-blue-300' : 'bg-slate-700 border-slate-500'} transition-all duration-300`}></div>
                      {hasValue && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-800/90 px-2 py-1 rounded whitespace-nowrap">
                          {studentValue}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vertical Alignment Guides - only show for given points */}
            {showVerticalGuides && displayPoints.map((point, i) => {
              const topPosition = getTopPosition(point.topValue);
              const isHovered = hoveredPoint === i;
              return (
                <div
                  key={`guide-${i}`}
                  className={`absolute h-24 w-px -mt-12 transition-all duration-300 pointer-events-none ${isHovered ? 'bg-purple-400/60' : 'bg-purple-400/20'}`}
                  style={{ left: `${topPosition}%`, transform: 'translateX(-50%)' }}
                >
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-px transition-all duration-300 ${isHovered ? 'bg-purple-400/60' : 'bg-purple-400/20'}`}></div>
                </div>
              );
            })}

            {/* Bottom Number Line */}
            <div className="relative">
              {/* Label */}
              <div className="absolute -top-8 left-0 text-sm font-semibold text-purple-300 uppercase tracking-wide">
                {bottomLabel}
              </div>

              {/* Line */}
              <div className="relative h-1 bg-slate-600 rounded-full">
                {/* Ticks */}
                {bottomTicks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute w-px h-4 bg-slate-500 top-full mt-1 flex flex-col items-center -translate-x-1/2"
                    style={{ left: `${tick.position}%` }}
                  >
                    <span className="mt-2 text-sm text-slate-400 font-mono font-semibold">
                      {tick.value}
                    </span>
                  </div>
                ))}

                {/* Display Points on Bottom Line - only given hints */}
                {displayPoints.map((point, i) => {
                  const position = getBottomPosition(point.bottomValue);
                  const isHovered = hoveredPoint === i;
                  return (
                    <div
                      key={`display-bottom-${i}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${position}%` }}
                      onMouseEnter={() => setHoveredPoint(i)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <div className={`w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-300 cursor-help ${isHovered ? 'scale-150' : ''}`}></div>
                    </div>
                  );
                })}

                {/* Student Target Points on Bottom - only in practice/apply phase */}
                {(currentPhase === 'practice' || currentPhase === 'apply') && targetPoints.map((point, i) => {
                  // In practice phase, only show first 2 points
                  if (currentPhase === 'practice' && i >= 2) return null;

                  const position = getBottomPosition(point.bottomValue);
                  const studentValue = parseFloat(studentPoints[i].bottomValue);
                  const hasValue = !isNaN(studentValue) && studentPoints[i].bottomValue !== '';
                  const isCorrect = studentPoints[i].bottomCorrect && attemptCount > 0;

                  // Only show if student has entered a value OR after checking
                  if (!hasValue && attemptCount === 0) {
                    return (
                      <div
                        key={`target-bottom-${i}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: `${position}%` }}
                      >
                        <div className="w-3 h-3 rounded-full border-2 border-slate-600 bg-slate-800/50 transition-all duration-300"></div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`target-bottom-${i}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${position}%` }}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 ${isCorrect ? 'bg-green-500 border-green-300' : hasValue ? 'bg-blue-400 border-blue-300' : 'bg-slate-700 border-slate-500'} transition-all duration-300`}></div>
                      {hasValue && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-800/90 px-2 py-1 rounded whitespace-nowrap">
                          {studentValue}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className="mt-12 space-y-6">
            {/* Phase 1: Explore - Find Unit Rate */}
            {currentPhase === 'explore' && !unitRateFound && (
              <div className="max-w-md mx-auto">
                <h4 className="text-lg font-semibold text-white text-center mb-4">Find the Unit Rate</h4>
                <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-blue-200 block mb-4 text-center">
                        When {topLabel} = <span className="text-lg font-bold text-white">{findUnitRatePoint()?.topValue || 1}</span>, what is {bottomLabel}?
                      </label>
                      <div className="max-w-xs mx-auto">
                        <label className="text-xs text-slate-400 block mb-2">{bottomLabel}:</label>
                        <input
                          type="number"
                          step="0.1"
                          value={studentUnitRate}
                          onChange={(e) => setStudentUnitRate(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-600 rounded-lg text-white text-lg font-semibold focus:outline-none focus:border-blue-500"
                          placeholder="?"
                          autoFocus
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleCheckUnitRate}
                      className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      Check Unit Rate
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 2 & 3: Practice and Apply - Find all points */}
            {(currentPhase === 'practice' || currentPhase === 'apply' || unitRateFound) && (
              <>
                <h4 className="text-lg font-semibold text-white text-center mb-2">
                  {currentPhase === 'practice' ? 'Practice with a Few Points' : 'Find All Missing Values'}
                </h4>
                <p className="text-sm text-slate-400 text-center mb-6">
                  {currentPhase === 'practice'
                    ? 'Fill in the values below, and they will appear on the number lines above.'
                    : 'Use what you learned to find all the remaining points on the number lines.'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {targetPoints.map((target, i) => {
                    // In practice phase, only show first 2 points
                    if (currentPhase === 'practice' && i >= 2) return null;

                    const topFilled = studentPoints[i].topValue !== '';
                    const bottomFilled = studentPoints[i].bottomValue !== '';
                    const bothFilled = topFilled && bottomFilled;

                    return (
                      <div
                        key={i}
                        className={`p-5 rounded-xl border-2 transition-all ${
                          bothFilled && attemptCount > 0 && studentPoints[i].topCorrect && studentPoints[i].bottomCorrect
                            ? 'bg-green-500/10 border-green-500/50'
                            : bothFilled
                            ? 'bg-blue-500/10 border-blue-500/50'
                            : 'bg-slate-800/40 border-slate-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            bothFilled && attemptCount > 0 && studentPoints[i].topCorrect && studentPoints[i].bottomCorrect
                              ? 'bg-green-500 text-white'
                              : bothFilled
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-700 text-slate-400'
                          }`}>
                            {i + 1}
                          </div>
                          <span className="text-sm font-semibold text-white">
                            Point {i + 1}
                            {bothFilled && attemptCount > 0 && studentPoints[i].topCorrect && studentPoints[i].bottomCorrect &&
                              <span className="ml-2 text-green-400">✓</span>
                            }
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                              {topLabel} = <span className="text-purple-300">{target.topValue}</span>
                            </label>
                            <div className="text-xs text-slate-500 mb-1">What is {bottomLabel}?</div>
                            <input
                              type="number"
                              step="0.1"
                              value={studentPoints[i].bottomValue}
                              onChange={(e) => handleInputChange(i, 'bottomValue', e.target.value)}
                              disabled={hasSubmittedEvaluation}
                              className={`w-full px-4 py-2.5 bg-slate-900 border-2 ${
                                studentPoints[i].bottomCorrect && attemptCount > 0
                                  ? 'border-green-500'
                                  : studentPoints[i].bottomValue && attemptCount > 0 && !studentPoints[i].bottomCorrect
                                  ? 'border-red-500'
                                  : 'border-slate-600'
                              } rounded-lg text-white text-base font-semibold focus:outline-none focus:border-purple-500 disabled:opacity-50 transition-colors`}
                              placeholder="?"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

              {/* Feedback */}
              {feedback && (
                <div className={`p-4 rounded-lg border ${feedbackType === 'success' ? 'bg-green-500/10 border-green-500/30' : feedbackType === 'error' ? 'bg-red-500/10 border-red-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                  <p className={`text-sm ${feedbackType === 'success' ? 'text-green-200' : feedbackType === 'error' ? 'text-red-200' : 'text-blue-200'}`}>
                    {feedback}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center flex-wrap">
                {!hasSubmittedEvaluation && currentPhase !== 'explore' && (
                  <>
                    <button
                      onClick={() => {
                        if (currentPhase === 'practice') {
                          // Check first 2 points only (students only enter bottom values)
                          const practiceCorrect = studentPoints.slice(0, 2).every((p, i) => {
                            const target = targetPoints[i];
                            const bottomVal = parseFloat(p.bottomValue);
                            return !isNaN(bottomVal) && isWithinTolerance(bottomVal, target.bottomValue);
                          });

                          if (practiceCorrect) {
                            setFeedback('Excellent! You\'ve got the pattern. Now try finding all the remaining points!');
                            setFeedbackType('success');
                            setCurrentPhase('apply');
                          } else {
                            handleCheckAnswers();
                          }
                        } else {
                          handleCheckAnswers();
                        }
                      }}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      {currentPhase === 'practice' ? 'Check Practice Points' : 'Check Answers'}
                    </button>
                    {givenPoints.length > 0 && (
                      <button
                        onClick={() => setShowHints(!showHints)}
                        className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        {showHints ? 'Hide' : 'Show'} Hint Points
                      </button>
                    )}
                    {currentPhase === 'practice' && (
                      <button
                        onClick={() => setCurrentPhase('apply')}
                        className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        Skip to Apply Phase →
                      </button>
                    )}
                  </>
                )}
                {hasSubmittedEvaluation && (
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DoubleNumberLine;
