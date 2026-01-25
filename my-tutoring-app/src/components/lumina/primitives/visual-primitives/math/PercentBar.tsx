'use client';

import React, { useState } from 'react';
import {
  usePrimitiveEvaluation,
  type PercentBarMetrics,
} from '../../../evaluation';

/**
 * PercentBar - Interactive percent problem-solving primitive
 *
 * K-8 Math Primitive for understanding:
 * - Part-whole relationships as percentages (Grade 5-8)
 * - Percent of a number calculations (Grade 6-8)
 * - Real-world percent applications: tax, tips, discounts (Grade 7-8)
 * - Benchmark percentages and estimation (Grade 5-7)
 *
 * EDUCATIONAL DESIGN:
 * - Guided 3-phase learning: Explore → Practice → Apply
 * - Phase 1: Students discover the target percentage through contextual questioning
 * - Phase 2: Students practice finding related percentages (2-3 practice problems)
 * - Phase 3: Students solve the main problem with precision
 * - Visual feedback helps students estimate and refine their answers
 *
 * EVALUATION INTEGRATION:
 * - Tracks accuracy, attempts, and hint usage across all three phases
 * - Submits comprehensive metrics when the main problem is solved
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

// Context for understanding different percent formulations
export interface PercentContext {
  problemType: 'addition' | 'subtraction' | 'direct' | 'comparison';
  initialValue: number;
  changeRate: number; // Signed percentage: +8 for tax, -20 for discount, 0 for direct
  discountFactor: number; // Multiplier as decimal: 1.08 for tax, 0.80 for 20% off, 0.50 for "50% of"
  finalValue: number;
}

// Multi-phase practice question
export interface PracticeQuestion {
  question: string;
  targetPercent: number;
  hint: string;
  context: PercentContext;
}

export interface PercentBarData {
  // Header and context
  title: string;
  description: string;
  scenario: string;

  // Whole value configuration
  wholeValue: number;
  wholeValueLabel: string;

  // Phase 1: Explore
  exploreQuestion: string;
  exploreTargetPercent: number;
  exploreHint: string;
  exploreContext: PercentContext;

  // Phase 2: Practice (2-3 questions)
  practiceQuestions: PracticeQuestion[];

  // Phase 3: Apply (main problem)
  mainQuestion: string;
  mainTargetPercent: number;
  mainHint: string;
  mainContext: PercentContext;

  // Visual configuration
  showPercentLabels?: boolean;
  showValueLabels?: boolean;
  benchmarkLines?: number[];
  doubleBar?: boolean;

  // Evaluation integration (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: import('../../../evaluation').PrimitiveEvaluationResult<import('../../../evaluation').PrimitiveMetrics>
  ) => void;
}

interface PercentBarProps {
  data: PercentBarData;
  className?: string;
}

type LearningPhase = 'explore' | 'practice' | 'apply' | 'completed';

const PercentBar: React.FC<PercentBarProps> = ({ data, className }) => {
  const {
    title,
    description,
    scenario,
    wholeValue,
    wholeValueLabel,
    exploreQuestion,
    exploreTargetPercent,
    exploreHint,
    exploreContext,
    practiceQuestions,
    mainQuestion,
    mainTargetPercent,
    mainHint,
    mainContext,
    showPercentLabels = true,
    showValueLabels = true,
    benchmarkLines = [25, 50, 75],
    doubleBar = false,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Phase management
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('explore');
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);

  // Student interaction
  const [currentPercent, setCurrentPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  // Feedback and hints
  const [feedback, setFeedback] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [hoveredBenchmark, setHoveredBenchmark] = useState<number | null>(null);

  // Tracking metrics for evaluation
  const [exploreAttempts, setExploreAttempts] = useState(0);
  const [exploreHintsUsed, setExploreHintsUsed] = useState(0);
  const [practiceAttempts, setPracticeAttempts] = useState(0);
  const [practiceHintsUsed, setPracticeHintsUsed] = useState(0);
  const [practiceCorrectCount, setPracticeCorrectCount] = useState(0);
  const [mainAttempts, setMainAttempts] = useState(0);
  const [mainHintsUsed, setMainHintsUsed] = useState(0);

  // Initialize evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<PercentBarMetrics>({
    primitiveType: 'percent-bar',
    instanceId: instanceId || `percent-bar-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Calculate the actual value based on the percentage
  const currentValue = (currentPercent / 100) * wholeValue;

  // Tolerance for accepting answers (±2%)
  const TOLERANCE = 2;

  const isWithinTolerance = (studentPercent: number, targetPercent: number): boolean => {
    return Math.abs(studentPercent - targetPercent) <= TOLERANCE;
  };

  const getAccuracyScore = (studentPercent: number, targetPercent: number): number => {
    const error = Math.abs(studentPercent - targetPercent);
    if (error === 0) return 100;
    if (error <= TOLERANCE) return 100 - (error / TOLERANCE) * 10; // 90-100 within tolerance
    return Math.max(0, 100 - error * 2); // Decreasing score beyond tolerance
  };

  // Handle click or drag to adjust percentage
  const handleBarInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setCurrentPercent(Math.round(percentage));
    setFeedback(''); // Clear feedback when adjusting
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleBarInteraction(e);
    }
  };

  const handleShowHint = () => {
    setShowHint(true);
    if (currentPhase === 'explore') {
      setExploreHintsUsed(prev => prev + 1);
    } else if (currentPhase === 'practice') {
      setPracticeHintsUsed(prev => prev + 1);
    } else if (currentPhase === 'apply') {
      setMainHintsUsed(prev => prev + 1);
    }
  };

  const handleExploreCheck = () => {
    setExploreAttempts(prev => prev + 1);

    if (isWithinTolerance(currentPercent, exploreTargetPercent)) {
      setFeedback('🎉 Excellent! You found the right percentage! Let\'s practice with similar problems.');
      setTimeout(() => {
        setCurrentPhase('practice');
        setCurrentPercent(50); // Reset for practice
        setFeedback('');
        setShowHint(false);
      }, 2000);
    } else {
      const diff = currentPercent - exploreTargetPercent;
      if (Math.abs(diff) <= 5) {
        setFeedback('🔍 Very close! Adjust slightly and try again.');
      } else if (diff > 0) {
        setFeedback('📉 Too high. Try a lower percentage.');
      } else {
        setFeedback('📈 Too low. Try a higher percentage.');
      }
    }
  };

  const handlePracticeCheck = () => {
    setPracticeAttempts(prev => prev + 1);
    const targetPercent = practiceQuestions[currentPracticeIndex].targetPercent;

    if (isWithinTolerance(currentPercent, targetPercent)) {
      setPracticeCorrectCount(prev => prev + 1);
      setFeedback('✅ Correct! Great job!');

      setTimeout(() => {
        if (currentPracticeIndex < practiceQuestions.length - 1) {
          // More practice questions
          setCurrentPracticeIndex(prev => prev + 1);
          setCurrentPercent(50);
          setFeedback('');
          setShowHint(false);
        } else {
          // Practice complete, move to apply phase
          setFeedback('🌟 Practice complete! Now let\'s solve the main problem.');
          setTimeout(() => {
            setCurrentPhase('apply');
            setCurrentPercent(50);
            setFeedback('');
            setShowHint(false);
          }, 2000);
        }
      }, 1500);
    } else {
      const diff = currentPercent - targetPercent;
      if (Math.abs(diff) <= 5) {
        setFeedback('🔍 Very close! Adjust slightly.');
      } else if (diff > 0) {
        setFeedback('📉 Too high. Try lower.');
      } else {
        setFeedback('📈 Too low. Try higher.');
      }
    }
  };

  const handleMainSubmit = () => {
    if (hasSubmitted) return;

    setMainAttempts(prev => prev + 1);
    const accuracy = getAccuracyScore(currentPercent, mainTargetPercent);
    const isCorrect = isWithinTolerance(currentPercent, mainTargetPercent);

    if (isCorrect) {
      setFeedback('🎊 Perfect! You\'ve mastered this percent problem!');
      setCurrentPhase('completed');

      // Calculate comprehensive metrics
      const totalAttempts = exploreAttempts + practiceAttempts + mainAttempts;
      const totalHints = exploreHintsUsed + practiceHintsUsed + mainHintsUsed;
      const averageAccuracy = (
        getAccuracyScore(currentPercent, exploreTargetPercent) +
        (practiceCorrectCount / practiceQuestions.length) * 100 +
        accuracy
      ) / 3;

      const metrics: PercentBarMetrics = {
        type: 'percent-bar',

        // Goal achievement
        allPhasesCompleted: true,
        finalSuccess: true,

        // Phase completion
        explorePhaseCompleted: true,
        practicePhaseCompleted: true,
        applyPhaseCompleted: true,

        // Per-phase performance
        exploreAccuracy: getAccuracyScore(currentPercent, exploreTargetPercent),
        exploreAttempts,
        exploreHintsUsed,

        practiceQuestionsCorrect: practiceCorrectCount,
        practiceTotalQuestions: practiceQuestions.length,
        practiceAttempts,
        practiceHintsUsed,

        mainProblemAccuracy: accuracy,
        mainProblemAttempts: mainAttempts,
        mainProblemHintsUsed: mainHintsUsed,

        // Overall performance
        totalAttempts,
        totalHintsUsed: totalHints,
        averageAccuracy,

        // Precision analysis
        targetPercent: mainTargetPercent,
        finalStudentPercent: currentPercent,
        percentageError: Math.abs(currentPercent - mainTargetPercent),

        // Efficiency
        solvedWithoutHints: totalHints === 0,
        firstAttemptSuccess: mainAttempts === 1,
      };

      submitResult(true, accuracy, metrics, {
        studentWork: {
          explorePercent: currentPercent,
          practiceAnswers: practiceQuestions.map((_, i) => i <= currentPracticeIndex),
          finalPercent: currentPercent,
        },
      });
    } else {
      const diff = currentPercent - mainTargetPercent;
      if (Math.abs(diff) <= 5) {
        setFeedback(`🔍 Very close! You're at ${currentPercent}%, target is ${mainTargetPercent}%`);
      } else if (diff > 0) {
        setFeedback(`📉 Too high. You're at ${currentPercent}%, try lower.`);
      } else {
        setFeedback(`📈 Too low. You're at ${currentPercent}%, try higher.`);
      }
    }
  };

  const handleReset = () => {
    setCurrentPhase('explore');
    setCurrentPracticeIndex(0);
    setCurrentPercent(50);
    setFeedback('');
    setShowHint(false);
    setExploreAttempts(0);
    setExploreHintsUsed(0);
    setPracticeAttempts(0);
    setPracticeHintsUsed(0);
    setPracticeCorrectCount(0);
    setMainAttempts(0);
    setMainHintsUsed(0);
    resetAttempt();
  };

  const getCurrentQuestion = (): string => {
    if (currentPhase === 'explore') return exploreQuestion;
    if (currentPhase === 'practice') return practiceQuestions[currentPracticeIndex].question;
    if (currentPhase === 'apply') return mainQuestion;
    return 'Problem completed!';
  };

  const getCurrentHint = (): string => {
    if (currentPhase === 'explore') return exploreHint;
    if (currentPhase === 'practice') return practiceQuestions[currentPracticeIndex].hint;
    if (currentPhase === 'apply') return mainHint;
    return '';
  };

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">Percent Problem Solving</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-16 rounded-3xl border border-emerald-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Problem Context */}
          <div className="mb-8 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light mb-4">{description}</p>
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <p className="text-blue-200 text-sm italic">{scenario}</p>
            </div>
          </div>

          {/* Phase Progress Indicator */}
          <div className="flex justify-center gap-2 mb-8">
            <div className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentPhase === 'explore'
                ? 'bg-emerald-500 text-white'
                : currentPhase === 'completed'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-700 text-slate-400'
            }`}>
              1. Explore
            </div>
            <div className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentPhase === 'practice'
                ? 'bg-emerald-500 text-white'
                : currentPhase === 'apply' || currentPhase === 'completed'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-700 text-slate-400'
            }`}>
              2. Practice ({currentPracticeIndex + 1}/{practiceQuestions.length})
            </div>
            <div className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentPhase === 'apply'
                ? 'bg-emerald-500 text-white'
                : currentPhase === 'completed'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-700 text-slate-400'
            }`}>
              3. Apply
            </div>
          </div>

          {/* Current Question */}
          <div className="mb-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="text-lg font-semibold text-white mb-2">
              {currentPhase === 'completed' ? '✅ Challenge Complete!' : getCurrentQuestion()}
            </div>
            {feedback && (
              <div className={`mt-3 p-3 rounded-lg ${
                feedback.includes('🎉') || feedback.includes('✅') || feedback.includes('🎊')
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : feedback.includes('🔍')
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {feedback}
              </div>
            )}
          </div>

          {/* Current Values Display */}
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Current Percentage</div>
              <div className="text-3xl font-bold text-emerald-400">{currentPercent}%</div>
            </div>
            {showValueLabels && (
              <>
                <div className="text-center">
                  <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Part Value</div>
                  <div className="text-3xl font-bold text-white">{currentValue.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">{wholeValueLabel}</div>
                  <div className="text-3xl font-bold text-slate-400">{wholeValue}</div>
                </div>
              </>
            )}
          </div>

          {/* Percent Bar Visualization */}
          <div className="w-full max-w-3xl mx-auto px-8 py-12 space-y-8">
            {/* Main Percent Bar */}
            <div className="relative">
              {/* Label */}
              <div className="absolute -top-8 left-0 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
                Percentage (0% - 100%)
              </div>

              {/* Interactive Bar Container */}
              <div
                className="relative h-16 bg-slate-700 rounded-xl cursor-pointer shadow-inner overflow-hidden border border-slate-600"
                onClick={handleBarInteraction}
                onMouseMove={handleMouseMove}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                {/* Shaded Portion */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-200 rounded-l-xl"
                  style={{ width: `${currentPercent}%` }}
                >
                  {/* Shimmer Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                </div>

                {/* Benchmark Lines */}
                {benchmarkLines.map((benchmark, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-0.5 bg-slate-400/50 cursor-help"
                    style={{ left: `${benchmark}%` }}
                    onMouseEnter={() => setHoveredBenchmark(benchmark)}
                    onMouseLeave={() => setHoveredBenchmark(null)}
                  >
                    {/* Benchmark Label */}
                    {showPercentLabels && (
                      <div className={`absolute -top-8 left-1/2 -translate-x-1/2 text-xs transition-all ${hoveredBenchmark === benchmark ? 'text-emerald-300 font-bold scale-110' : 'text-slate-400'}`}>
                        {benchmark}%
                      </div>
                    )}
                    {/* Tooltip on Hover */}
                    {hoveredBenchmark === benchmark && showValueLabels && (
                      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 text-white text-xs rounded whitespace-nowrap pointer-events-none">
                        {((benchmark / 100) * wholeValue).toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}

                {/* End Labels */}
                {showPercentLabels && (
                  <>
                    <div className="absolute -bottom-8 left-0 text-xs text-slate-400 font-mono">0%</div>
                    <div className="absolute -bottom-8 right-0 text-xs text-slate-400 font-mono">100%</div>
                  </>
                )}
              </div>
            </div>

            {/* Double Bar - Value Bar */}
            {doubleBar && (
              <div className="relative mt-16">
                {/* Label */}
                <div className="absolute -top-8 left-0 text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Actual Value (0 - {wholeValue})
                </div>

                {/* Value Bar */}
                <div className="relative h-12 bg-slate-700 rounded-xl shadow-inner border border-slate-600">
                  {/* Shaded Portion */}
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-200 rounded-l-xl"
                    style={{ width: `${currentPercent}%` }}
                  ></div>

                  {/* Tick Marks for Values */}
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => {
                    const value = fraction * wholeValue;
                    const percent = fraction * 100;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 h-full w-px bg-slate-400/50"
                        style={{ left: `${percent}%` }}
                      >
                        {showValueLabels && (
                          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-slate-400 font-mono">
                            {value % 1 === 0 ? value : value.toFixed(1)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Calculation Display */}
          <div className="mt-12 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="text-center text-slate-300">
              <div className="text-sm uppercase tracking-wider text-slate-400 mb-2">Calculation</div>
              <div className="text-lg font-mono">
                <span className="text-emerald-400">{currentPercent}%</span>
                {' of '}
                <span className="text-white">{wholeValue}</span>
                {' = '}
                <span className="text-emerald-300 font-bold">{currentValue.toFixed(2)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                ({currentPercent} ÷ 100) × {wholeValue} = {currentValue.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex gap-3">
              {currentPhase === 'explore' && (
                <button
                  onClick={handleExploreCheck}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-emerald-500/50"
                >
                  Check Answer
                </button>
              )}
              {currentPhase === 'practice' && (
                <button
                  onClick={handlePracticeCheck}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-emerald-500/50"
                >
                  Check Answer
                </button>
              )}
              {currentPhase === 'apply' && (
                <button
                  onClick={handleMainSubmit}
                  disabled={hasSubmitted}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-blue-500/50"
                >
                  {hasSubmitted ? '✅ Submitted' : 'Submit Final Answer'}
                </button>
              )}
              {currentPhase === 'completed' && (
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-lg transition-all"
                >
                  Try Again
                </button>
              )}
            </div>

            {/* Hint Button */}
            {currentPhase !== 'completed' && (
              <div className="flex flex-col items-center gap-2">
                {!showHint ? (
                  <button
                    onClick={handleShowHint}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-all"
                  >
                    💡 Show Hint
                  </button>
                ) : (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg max-w-md">
                    <div className="text-yellow-300 text-sm">
                      <span className="font-semibold">Hint:</span> {getCurrentHint()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interactive Instructions */}
          <div className="mt-8 text-center text-sm text-slate-400">
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path>
              </svg>
              Click or drag on the bar to adjust the percentage
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PercentBar;
