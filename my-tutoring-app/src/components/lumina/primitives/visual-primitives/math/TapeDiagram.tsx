'use client';

import React, { useState, useMemo } from 'react';
import CalculatorInput from '../../input-primitives/CalculatorInput';
import {
  usePrimitiveEvaluation,
  type TapeDiagramMetrics,
} from '../../../evaluation';

// ---------------------------------------------------------------------------
// Data Interfaces
// ---------------------------------------------------------------------------

export interface BarSegment {
  value?: number;
  label: string;
  isUnknown?: boolean;
}

export interface BarConfig {
  segments: BarSegment[];
  totalLabel?: string;
  color?: string;
}

export type TapeDiagramChallengeType =
  | 'represent'
  | 'solve_part_whole'
  | 'solve_comparison'
  | 'multi_step';

export interface TapeDiagramData {
  title: string;
  description: string;
  bars: BarConfig[];
  comparisonMode?: boolean;
  showBrackets?: boolean;
  unknownSegment?: number | null;

  /** Discriminates the interaction mode */
  challengeType?: TapeDiagramChallengeType;
  /** Word problem text (represent, comparison, multi_step modes) */
  wordProblem?: string;
  /** Comparison-specific metadata */
  comparisonData?: {
    quantity1: number;
    quantity2: number;
    difference: number;
    comparisonWord: string;
    unknownPart: string;
  };
  /** Multi-step-specific metadata */
  multiStepData?: {
    step1Hint: string;
    step2Hint: string;
    solveOrder: number[]; // segment indices to solve in order
  };

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: import('../../../evaluation').PrimitiveEvaluationResult<TapeDiagramMetrics>
  ) => void;
}

interface TapeDiagramProps {
  data: TapeDiagramData;
  className?: string;
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type LearningPhase = 'explore' | 'practice' | 'apply';

interface SegmentAttempt {
  barIndex: number;
  segmentIndex: number;
  attempts: number;
  correctOnFirstTry: boolean;
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const COLOR_PALETTE = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-green-500 to-green-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
];

function getBarColor(barIndex: number, customColor?: string) {
  if (customColor) return customColor;
  return COLOR_PALETTE[barIndex % COLOR_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TapeDiagram: React.FC<TapeDiagramProps> = ({ data, className }) => {
  const {
    bars = [],
    comparisonMode = false,
    showBrackets = true,
    challengeType = 'solve_part_whole',
    wordProblem,
    comparisonData,
    multiStepData,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // --- Shared state ---
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, 'correct' | 'incorrect' | null>>({});
  const [segmentAttempts, setSegmentAttempts] = useState<Map<string, SegmentAttempt>>(new Map());
  const [showHints, setShowHints] = useState(false);
  const [totalHintsUsed, setTotalHintsUsed] = useState(0);

  // --- Part-whole specific state ---
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('explore');
  const [wholeValue, setWholeValue] = useState('');
  const [wholeFound, setWholeFound] = useState(false);
  const [phaseAttempts, setPhaseAttempts] = useState({ explore: 0, practice: 0, apply: 0 });
  const [phaseHints, setPhaseHints] = useState({ explore: 0, practice: 0, apply: 0 });

  // --- Multi-step specific state ---
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // --- Evaluation hook ---
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<TapeDiagramMetrics>({
    primitiveType: 'tape-diagram',
    instanceId: instanceId || `tape-diagram-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as
      | ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void)
      | undefined,
  });

  // --- Helpers ---
  const getSegmentKey = (barIndex: number, segmentIndex: number) => `${barIndex}-${segmentIndex}`;

  const getAllUnknownSegments = useMemo(() => {
    const unknowns: Array<{ barIndex: number; segmentIndex: number }> = [];
    bars.forEach((bar, barIndex) => {
      bar.segments.forEach((segment, segmentIndex) => {
        if (segment.isUnknown) {
          unknowns.push({ barIndex, segmentIndex });
        }
      });
    });
    return unknowns;
  }, [bars]);

  const handleAnswerChange = (barIndex: number, segmentIndex: number, value: string) => {
    const key = getSegmentKey(barIndex, segmentIndex);
    setUserAnswers(prev => ({ ...prev, [key]: value }));
    if (feedback[key]) {
      setFeedback(prev => ({ ...prev, [key]: null }));
    }
  };

  const trackAttempt = (barIndex: number, segmentIndex: number, isCorrect: boolean) => {
    const key = getSegmentKey(barIndex, segmentIndex);
    const current = segmentAttempts.get(key) || {
      barIndex, segmentIndex, attempts: 0, correctOnFirstTry: false,
    };
    current.attempts += 1;
    if (isCorrect && current.attempts === 1) current.correctOnFirstTry = true;
    setSegmentAttempts(new Map(segmentAttempts.set(key, current)));
  };

  const handleShowHints = () => {
    if (!showHints) {
      setTotalHintsUsed(prev => prev + 1);
      if (challengeType === 'solve_part_whole') {
        setPhaseHints(prev => ({ ...prev, [currentPhase]: prev[currentPhase] + 1 }));
      }
    }
    setShowHints(!showHints);
  };

  const handleReset = () => {
    setUserAnswers({});
    setFeedback({});
    setSegmentAttempts(new Map());
    setShowHints(false);
    setTotalHintsUsed(0);
    setCurrentPhase('explore');
    setWholeValue('');
    setWholeFound(false);
    setPhaseAttempts({ explore: 0, practice: 0, apply: 0 });
    setPhaseHints({ explore: 0, practice: 0, apply: 0 });
    setCurrentStepIndex(0);
    resetEvaluationAttempt();
  };

  // --- Build evaluation metrics for any mode ---
  const buildMetrics = (overrides?: Partial<TapeDiagramMetrics>): TapeDiagramMetrics => {
    const allUnknowns = getAllUnknownSegments;
    const totalUnknowns = allUnknowns.length;
    const correctCount = allUnknowns.filter(({ barIndex, segmentIndex }) => {
      return feedback[getSegmentKey(barIndex, segmentIndex)] === 'correct';
    }).length;

    const segmentRelationships = allUnknowns.map(({ barIndex, segmentIndex }) => {
      const key = getSegmentKey(barIndex, segmentIndex);
      const segment = bars[barIndex].segments[segmentIndex];
      const attempt = segmentAttempts.get(key);
      return {
        barIndex,
        segmentIndex,
        segmentLabel: segment.label,
        expectedValue: segment.value || 0,
        studentValue: parseFloat(userAnswers[key]) || null,
        correctOnFirstTry: attempt?.correctOnFirstTry || false,
        attempts: attempt?.attempts || 0,
      };
    });

    const totalAttemptCount = Array.from(segmentAttempts.values()).reduce((s, a) => s + a.attempts, 0);
    const accuracy = totalUnknowns > 0 ? (correctCount / totalUnknowns) * 100 : 100;

    return {
      type: 'tape-diagram',
      challengeType,

      // Overall
      allPhasesCompleted: true,
      finalSuccess: correctCount === totalUnknowns,
      totalAttempts: totalAttemptCount,
      totalHintsUsed,
      firstAttemptSuccess: totalAttemptCount === totalUnknowns,
      solvedWithoutHints: totalHintsUsed === 0,
      averageAttemptsPerUnknown: totalUnknowns > 0 ? totalAttemptCount / totalUnknowns : 0,

      // Phase defaults (overridden by part-whole mode)
      explorePhaseCompleted: true,
      practicePhaseCompleted: true,
      applyPhaseCompleted: true,
      wholeCorrectlyIdentified: true,
      exploreAttempts: 0,
      exploreHintsUsed: 0,
      practiceUnknownsTotal: 0,
      practiceUnknownsCorrect: 0,
      practiceAccuracy: 100,
      practiceAttempts: 0,
      practiceHintsUsed: 0,
      totalUnknownSegments: totalUnknowns,
      correctUnknownSegments: correctCount,
      accuracyPercentage: accuracy,
      applyAttempts: 0,
      applyHintsUsed: 0,
      solvedInSequence: true,
      usedPartWholeStrategy: true,
      segmentRelationships,

      ...overrides,
    };
  };

  // =========================================================================
  // RENDER: Shared bar visualization
  // =========================================================================

  const renderBar = (
    bar: BarConfig,
    barIndex: number,
    options: {
      visibleSegmentIndices?: number[];
      showBracket?: boolean;
      bracketLabel?: string;
      showUnknownInputs?: boolean;
      isSegmentLocked?: (segIdx: number) => boolean;
      onSegmentSubmit?: (barIdx: number, segIdx: number) => void;
    } = {}
  ) => {
    const {
      visibleSegmentIndices,
      showBracket = false,
      bracketLabel = '',
      showUnknownInputs = true,
      isSegmentLocked,
      onSegmentSubmit,
    } = options;

    const indices = visibleSegmentIndices || bar.segments.map((_, i) => i);
    const visibleSegments = indices.map(idx => ({ segment: bar.segments[idx], originalIndex: idx }));
    const total = bar.segments.reduce((s, seg) => s + (seg.value || 0), 0);

    return (
      <div key={barIndex} className="relative">
        {/* Bracket */}
        {showBracket && bracketLabel && (
          <div className="absolute -top-16 left-0 right-0 flex items-start justify-center">
            <div className="flex flex-col items-center">
              <svg width="100%" height="30" className="mb-1">
                <path
                  d="M 0 25 L 0 5 Q 0 0 5 0 L 95% 0 Q 100% 0 100% 5 L 100% 25"
                  fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"
                />
              </svg>
              <div className="text-sm font-bold text-white bg-slate-800/80 px-3 py-1 rounded-full border border-slate-600">
                {bracketLabel}
              </div>
            </div>
          </div>
        )}

        {/* Bar label (for comparison mode) */}
        {comparisonMode && bar.totalLabel && (
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
            {bar.totalLabel}
          </div>
        )}

        {/* Segments */}
        <div className={`flex ${comparisonMode ? 'items-start' : 'items-stretch'} gap-1`}>
          {visibleSegments.map(({ segment, originalIndex: segIdx }) => {
            const key = getSegmentKey(barIndex, segIdx);
            const isUnknown = segment.isUnknown;
            const locked = isSegmentLocked?.(segIdx) || false;
            const segFeedback = feedback[key];
            const widthPct = segment.value ? (segment.value / (total || 1)) * 100 : 100 / bar.segments.length;

            return (
              <div
                key={segIdx}
                className="relative flex-1"
                style={{ minWidth: '80px', flex: comparisonMode ? `0 0 ${widthPct}%` : 1 }}
              >
                <div
                  className={`
                    w-full h-20 rounded-lg border-2 transition-all duration-200 flex items-center justify-center shadow-lg
                    ${isUnknown
                      ? locked
                        ? 'bg-slate-800/50 border-slate-600 opacity-50'
                        : segFeedback === 'correct'
                          ? 'bg-green-900/30 border-green-500'
                          : 'bg-slate-700/50 border-yellow-500 border-dashed'
                      : `bg-gradient-to-br ${getBarColor(barIndex, bar.color)} border-slate-600`
                    }
                  `}
                >
                  <div className="text-center">
                    {isUnknown ? (
                      segFeedback === 'correct' ? (
                        <div className="text-2xl font-bold text-green-400">{segment.value}</div>
                      ) : locked ? (
                        <div className="text-2xl font-bold text-slate-600">🔒</div>
                      ) : (
                        <div className="text-3xl font-bold text-yellow-400">?</div>
                      )
                    ) : (
                      segment.value !== undefined && (
                        <div className="text-2xl font-bold text-white">{segment.value}</div>
                      )
                    )}
                    <div className="text-xs font-medium text-white/90 px-2 truncate">
                      {segment.label}
                    </div>
                  </div>
                </div>

                {/* Input for unknown segments */}
                {isUnknown && showUnknownInputs && !locked && segFeedback !== 'correct' && !hasSubmittedEvaluation && (
                  <div className="mt-3">
                    <CalculatorInput
                      label={`${segment.label} =`}
                      value={userAnswers[key] || ''}
                      onChange={(v) => handleAnswerChange(barIndex, segIdx, v)}
                      onSubmit={() => onSegmentSubmit?.(barIndex, segIdx)}
                      showSubmitButton={true}
                      allowNegative={false}
                      allowDecimal={true}
                      className="mb-2"
                    />
                    {segFeedback === 'incorrect' && (
                      <div className="text-center text-red-400 text-sm font-semibold">Not quite — try again!</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison alignment line */}
        {comparisonMode && barIndex < bars.length - 1 && (
          <div className="mt-4 mb-4 h-px bg-slate-600/50"></div>
        )}
      </div>
    );
  };

  // =========================================================================
  // MODE: Represent
  // =========================================================================

  const renderRepresentMode = () => {
    const allUnknowns = getAllUnknownSegments;
    const allCorrect = allUnknowns.every(({ barIndex, segmentIndex }) =>
      feedback[getSegmentKey(barIndex, segmentIndex)] === 'correct'
    );

    const handleRepresentSubmit = (barIndex: number, segmentIndex: number) => {
      if (hasSubmittedEvaluation) return;
      const key = getSegmentKey(barIndex, segmentIndex);
      const userVal = parseFloat(userAnswers[key]);
      const segment = bars[barIndex]?.segments[segmentIndex];
      if (isNaN(userVal) || !segment?.value) return;

      const isCorrect = Math.abs(userVal - segment.value) < 0.01;
      trackAttempt(barIndex, segmentIndex, isCorrect);

      const newFeedback = { ...feedback, [key]: (isCorrect ? 'correct' : 'incorrect') as 'correct' | 'incorrect' };
      setFeedback(newFeedback);

      // Check if all done
      if (isCorrect) {
        const nowAllCorrect = allUnknowns.every(({ barIndex: bi, segmentIndex: si }) =>
          (bi === barIndex && si === segmentIndex) ? isCorrect : newFeedback[getSegmentKey(bi, si)] === 'correct'
        );
        if (nowAllCorrect) {
          const metrics = buildMetrics();
          submitEvaluation(metrics.finalSuccess, metrics.accuracyPercentage, metrics, { studentWork: { userAnswers } });
        }
      }
    };

    return (
      <>
        {/* Word problem */}
        {wordProblem && (
          <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-2">Read the Problem</div>
            <p className="text-lg text-blue-100 leading-relaxed">{wordProblem}</p>
          </div>
        )}

        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
          <p className="text-sm text-yellow-200">Fill in each segment value from the word problem above.</p>
        </div>

        {/* Bars */}
        <div className="space-y-16">
          {bars.map((bar, barIndex) =>
            renderBar(bar, barIndex, {
              showBracket: false,
              showUnknownInputs: true,
              onSegmentSubmit: handleRepresentSubmit,
            })
          )}
        </div>

        {/* Hint */}
        {Object.values(feedback).some(f => f === 'incorrect') && !allCorrect && (
          <div className="mt-4 text-center">
            <button onClick={handleShowHints} className="px-6 py-2 bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold">
              {showHints ? 'Hide Hint' : 'Need a Hint?'}
            </button>
            {showHints && wordProblem && (
              <div className="mt-3 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl text-sm text-blue-200">
                Re-read the word problem carefully. Each number mentioned corresponds to one segment on the diagram.
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // MODE: Solve Part-Whole (original 3-phase behavior)
  // =========================================================================

  const renderPartWholeMode = () => {
    const allUnknowns = getAllUnknownSegments;

    // Phase-specific visible segments
    const getVisibleSegments = (barIndex: number): number[] => {
      const bar = bars[barIndex];
      if (!bar) return [];
      if (currentPhase === 'explore') return [0, 1];
      if (currentPhase === 'practice') return [0, 2];
      return bar.segments.map((_, i) => i);
    };

    const getVisibleUnknowns = (): Array<{ barIndex: number; segmentIndex: number }> => {
      if (currentPhase === 'explore') return [];
      if (currentPhase === 'practice') return allUnknowns.slice(0, 1);
      return allUnknowns;
    };

    const visibleUnknowns = getVisibleUnknowns();

    const handleCheckWhole = () => {
      if (hasSubmittedEvaluation) return;
      const inputWhole = parseFloat(wholeValue);
      if (isNaN(inputWhole)) return;

      const firstBar = bars[0];
      if (!firstBar) return;

      let actualTotal = 0;
      for (let i = 0; i < 2 && i < firstBar.segments.length; i++) {
        const seg = firstBar.segments[i];
        if (seg.value !== undefined) actualTotal += seg.value;
      }

      setPhaseAttempts(prev => ({ ...prev, explore: prev.explore + 1 }));

      if (Math.abs(inputWhole - actualTotal) < 0.01) {
        setWholeFound(true);
        setFeedback({ explore: 'correct' });
        setTimeout(() => { setCurrentPhase('practice'); setFeedback({}); }, 2000);
      } else {
        setFeedback({ explore: 'incorrect' });
      }
    };

    const handlePartWholeSubmit = (barIndex: number, segmentIndex: number) => {
      if (hasSubmittedEvaluation) return;
      const key = getSegmentKey(barIndex, segmentIndex);
      const userVal = parseFloat(userAnswers[key]);
      const segment = bars[barIndex]?.segments[segmentIndex];
      if (isNaN(userVal) || !segment?.value) return;

      const isCorrect = Math.abs(userVal - segment.value) < 0.01;
      trackAttempt(barIndex, segmentIndex, isCorrect);
      setPhaseAttempts(prev => ({ ...prev, [currentPhase]: prev[currentPhase] + 1 }));

      const newFeedback = { ...feedback, [key]: (isCorrect ? 'correct' : 'incorrect') as 'correct' | 'incorrect' };
      setFeedback(newFeedback);

      if (isCorrect) {
        if (currentPhase === 'practice') {
          const firstUnknown = allUnknowns[0];
          if (firstUnknown && getSegmentKey(firstUnknown.barIndex, firstUnknown.segmentIndex) === key) {
            setTimeout(() => setCurrentPhase('apply'), 1500);
          }
        } else if (currentPhase === 'apply') {
          const allSolved = allUnknowns.every(({ barIndex: bi, segmentIndex: si }) =>
            newFeedback[getSegmentKey(bi, si)] === 'correct'
          );
          if (allSolved) {
            const practiceUnknowns = allUnknowns.slice(0, 1);
            const practiceCorrect = practiceUnknowns.filter(({ barIndex: bi, segmentIndex: si }) =>
              newFeedback[getSegmentKey(bi, si)] === 'correct'
            ).length;

            const totalAttemptCount = phaseAttempts.explore + phaseAttempts.practice + phaseAttempts.apply + 1;
            const correctCount = allUnknowns.length;

            const metrics = buildMetrics({
              explorePhaseCompleted: wholeFound,
              practicePhaseCompleted: practiceCorrect === practiceUnknowns.length,
              applyPhaseCompleted: true,
              wholeCorrectlyIdentified: wholeFound,
              exploreAttempts: phaseAttempts.explore,
              exploreHintsUsed: phaseHints.explore,
              practiceUnknownsTotal: practiceUnknowns.length,
              practiceUnknownsCorrect: practiceCorrect,
              practiceAccuracy: practiceUnknowns.length > 0 ? (practiceCorrect / practiceUnknowns.length) * 100 : 100,
              practiceAttempts: phaseAttempts.practice,
              practiceHintsUsed: phaseHints.practice,
              applyAttempts: phaseAttempts.apply + 1,
              applyHintsUsed: phaseHints.apply,
              totalAttempts: totalAttemptCount,
              usedPartWholeStrategy: wholeFound,
            });
            submitEvaluation(metrics.finalSuccess, metrics.accuracyPercentage, metrics, {
              studentWork: { userAnswers, phaseAttempts },
            });
          }
        }
      }
    };

    // Compute phase total for bracket label
    const bar = bars[0];
    const visibleIndices = bar ? getVisibleSegments(0) : [];
    let phaseTotal = 0;
    visibleIndices.forEach(idx => {
      const seg = bar?.segments[idx];
      if (seg?.value !== undefined) phaseTotal += seg.value;
    });

    let bracketLabel = '';
    if (currentPhase === 'practice') bracketLabel = `Total = ${phaseTotal}`;
    else if (currentPhase === 'apply') bracketLabel = bar?.totalLabel || `Total = ${phaseTotal}`;

    return (
      <>
        {/* Phase Progress */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {(['explore', 'practice', 'apply'] as LearningPhase[]).map((phase, i) => {
            const isActive = currentPhase === phase;
            const isDone = phase === 'explore' ? wholeFound
              : phase === 'practice' ? (currentPhase === 'apply')
              : false;
            return (
              <React.Fragment key={phase}>
                {i > 0 && <div className="h-px w-8 bg-slate-600"></div>}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                  isActive ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                    : isDone ? 'bg-green-500/20 border-green-500/50 text-green-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400'
                }`}>
                  {isDone ? '✓' : i + 1} {phase === 'explore' ? 'Explore' : phase === 'practice' ? 'Practice' : 'Apply'}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Phase instructions */}
        {!hasSubmittedEvaluation && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center">
            <div className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-2">
              {currentPhase === 'explore' && 'Step 1: Find the Whole'}
              {currentPhase === 'practice' && 'Step 2: Find the Unknown Part'}
              {currentPhase === 'apply' && 'Step 3: Solve with Multiple Parts'}
            </div>
            <p className="text-sm text-blue-200">
              {currentPhase === 'explore' && 'Add the two parts together to find the total'}
              {currentPhase === 'practice' && 'Use the total and known part to find the unknown part'}
              {currentPhase === 'apply' && 'Use all the parts to find the missing values'}
            </p>
          </div>
        )}

        {/* Bars (phase-filtered) */}
        <div className="space-y-16">
          {bars.map((bar, barIndex) =>
            renderBar(bar, barIndex, {
              visibleSegmentIndices: getVisibleSegments(barIndex),
              showBracket: showBrackets && currentPhase !== 'explore',
              bracketLabel,
              showUnknownInputs: currentPhase !== 'explore',
              onSegmentSubmit: handlePartWholeSubmit,
            })
          )}
        </div>

        {/* Phase 1: Find the whole */}
        {currentPhase === 'explore' && !hasSubmittedEvaluation && (
          <div className="mt-8">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-orange-400 text-sm font-mono uppercase tracking-widest">Phase 1: Explore</span>
              <div className="h-px flex-1 bg-gradient-to-r from-orange-700 to-transparent"></div>
            </div>
            <div className="mb-6 text-center">
              <h5 className="text-2xl font-bold text-white">
                What is the <span className="text-orange-400">total</span> of all the known parts?
              </h5>
            </div>
            <CalculatorInput
              label="Total ="
              value={wholeValue}
              onChange={setWholeValue}
              onSubmit={handleCheckWhole}
              showSubmitButton={true}
              allowNegative={false}
              allowDecimal={true}
              className="mb-6"
            />
            {feedback.explore === 'correct' && (
              <div className="p-4 bg-green-500/20 border-2 border-green-500/50 rounded-xl text-center">
                <div className="text-green-400 font-bold text-lg">Perfect!</div>
                <div className="text-green-300/80 text-sm">You found the whole. Now let&apos;s find the unknowns!</div>
              </div>
            )}
            {feedback.explore === 'incorrect' && renderFeedbackIncorrect('Try adding all the known values together.')}
          </div>
        )}

        {/* Phase 2 & 3: Solve unknowns — handled by renderBar's inline inputs */}
        {(currentPhase === 'practice' || currentPhase === 'apply') && !hasSubmittedEvaluation && visibleUnknowns.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-orange-400 text-sm font-mono uppercase tracking-widest">
                {currentPhase === 'practice' ? 'Phase 2: Practice' : 'Phase 3: Apply'}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-orange-700 to-transparent"></div>
            </div>
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // MODE: Solve Comparison
  // =========================================================================

  const renderComparisonMode = () => {
    const allUnknowns = getAllUnknownSegments;

    const handleComparisonSubmit = (barIndex: number, segmentIndex: number) => {
      if (hasSubmittedEvaluation) return;
      const key = getSegmentKey(barIndex, segmentIndex);
      const userVal = parseFloat(userAnswers[key]);
      const segment = bars[barIndex]?.segments[segmentIndex];
      if (isNaN(userVal) || !segment?.value) return;

      const isCorrect = Math.abs(userVal - segment.value) < 0.01;
      trackAttempt(barIndex, segmentIndex, isCorrect);

      const newFeedback = { ...feedback, [key]: (isCorrect ? 'correct' : 'incorrect') as 'correct' | 'incorrect' };
      setFeedback(newFeedback);

      if (isCorrect) {
        const allSolved = allUnknowns.every(({ barIndex: bi, segmentIndex: si }) =>
          newFeedback[getSegmentKey(bi, si)] === 'correct'
        );
        if (allSolved) {
          const metrics = buildMetrics();
          submitEvaluation(metrics.finalSuccess, metrics.accuracyPercentage, metrics, {
            studentWork: { userAnswers, comparisonData },
          });
        }
      }
    };

    return (
      <>
        {/* Word problem */}
        {wordProblem && (
          <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-2">Comparison Problem</div>
            <p className="text-lg text-blue-100 leading-relaxed">{wordProblem}</p>
          </div>
        )}

        {/* Two bars for comparison */}
        <div className="space-y-8">
          {bars.map((bar, barIndex) =>
            renderBar(bar, barIndex, {
              showBracket: false,
              showUnknownInputs: true,
              onSegmentSubmit: handleComparisonSubmit,
            })
          )}
        </div>

        {/* Comparison visual cue */}
        {comparisonData && (
          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl text-center">
            <p className="text-sm text-purple-200">
              {comparisonData.unknownPart === 'difference'
                ? `How many ${comparisonData.comparisonWord} does the first group have?`
                : `Find the missing quantity.`
              }
            </p>
          </div>
        )}

        {/* Hint */}
        {Object.values(feedback).some(f => f === 'incorrect') && (
          <div className="mt-4 text-center">
            <button onClick={handleShowHints} className="px-6 py-2 bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold">
              {showHints ? 'Hide Hint' : 'Need a Hint?'}
            </button>
            {showHints && comparisonData && (
              <div className="mt-3 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl text-sm text-blue-200">
                {comparisonData.unknownPart === 'difference'
                  ? `Subtract the smaller value (${comparisonData.quantity2}) from the larger value (${comparisonData.quantity1}).`
                  : comparisonData.unknownPart === 'quantity2'
                    ? `The difference is ${comparisonData.difference}. Subtract it from the larger value.`
                    : `The difference is ${comparisonData.difference}. Add it to the smaller value.`
                }
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // MODE: Multi-Step
  // =========================================================================

  const renderMultiStepMode = () => {
    const solveOrder = multiStepData?.solveOrder || [2, 3];
    const currentSolveSegIdx = solveOrder[currentStepIndex];
    const totalSteps = solveOrder.length;

    const isSegmentLocked = (segIdx: number) => {
      const orderIdx = solveOrder.indexOf(segIdx);
      if (orderIdx < 0) return false;
      return orderIdx > currentStepIndex;
    };

    const handleMultiStepSubmit = (barIndex: number, segmentIndex: number) => {
      if (hasSubmittedEvaluation) return;
      if (segmentIndex !== currentSolveSegIdx) return; // Can only solve current step

      const key = getSegmentKey(barIndex, segmentIndex);
      const userVal = parseFloat(userAnswers[key]);
      const segment = bars[barIndex]?.segments[segmentIndex];
      if (isNaN(userVal) || !segment?.value) return;

      const isCorrect = Math.abs(userVal - segment.value) < 0.01;
      trackAttempt(barIndex, segmentIndex, isCorrect);

      const newFeedback = { ...feedback, [key]: (isCorrect ? 'correct' : 'incorrect') as 'correct' | 'incorrect' };
      setFeedback(newFeedback);

      if (isCorrect) {
        const nextStep = currentStepIndex + 1;
        if (nextStep >= totalSteps) {
          // All steps complete
          const metrics = buildMetrics();
          submitEvaluation(metrics.finalSuccess, metrics.accuracyPercentage, metrics, {
            studentWork: { userAnswers, stepsCompleted: totalSteps },
          });
        } else {
          setTimeout(() => {
            setCurrentStepIndex(nextStep);
            setShowHints(false);
          }, 1500);
        }
      }
    };

    const currentHint = currentStepIndex === 0
      ? multiStepData?.step1Hint
      : multiStepData?.step2Hint;

    return (
      <>
        {/* Word problem */}
        {wordProblem && (
          <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-2">Multi-Step Problem</div>
            <p className="text-lg text-blue-100 leading-relaxed">{wordProblem}</p>
          </div>
        )}

        {/* Step progress */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {solveOrder.map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div className="h-px w-8 bg-slate-600"></div>}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                i === currentStepIndex ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                  : i < currentStepIndex ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : 'bg-slate-700/50 border-slate-600 text-slate-400'
              }`}>
                {i < currentStepIndex ? '✓' : i + 1} Step {i + 1}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Current step instruction */}
        {!hasSubmittedEvaluation && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
            <div className="text-sm font-mono uppercase tracking-wider text-yellow-400 mb-1">
              Step {currentStepIndex + 1} of {totalSteps}
            </div>
            <p className="text-sm text-yellow-200">
              Find the value of <span className="font-bold text-yellow-300">
                {bars[0]?.segments[currentSolveSegIdx]?.label || 'the unknown'}
              </span>
            </p>
          </div>
        )}

        {/* Bars with locking */}
        <div className="space-y-16">
          {bars.map((bar, barIndex) =>
            renderBar(bar, barIndex, {
              showBracket: showBrackets,
              bracketLabel: bar.totalLabel || '',
              showUnknownInputs: true,
              isSegmentLocked,
              onSegmentSubmit: handleMultiStepSubmit,
            })
          )}
        </div>

        {/* Hint */}
        {Object.values(feedback).some(f => f === 'incorrect') && !hasSubmittedEvaluation && (
          <div className="mt-4 text-center">
            <button onClick={handleShowHints} className="px-6 py-2 bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold">
              {showHints ? 'Hide Hint' : 'Need a Hint?'}
            </button>
            {showHints && currentHint && (
              <div className="mt-3 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl text-sm text-blue-200">
                {currentHint}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // Shared feedback helper
  // =========================================================================

  const renderFeedbackIncorrect = (message: string) => (
    <div className="space-y-3">
      <div className="p-4 bg-red-500/20 border-2 border-red-500/50 rounded-xl text-center">
        <div className="text-red-400 font-bold text-lg">Not Quite</div>
        <div className="text-red-300/80 text-sm">{message}</div>
      </div>
      <div className="text-center">
        <button onClick={handleShowHints} className="px-6 py-2 bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold">
          {showHints ? 'Hide Hint' : 'Need a Hint?'}
        </button>
      </div>
    </div>
  );

  // =========================================================================
  // Mode label
  // =========================================================================

  const modeLabel = {
    represent: 'Diagram Builder',
    solve_part_whole: 'Part-Whole Visualization',
    solve_comparison: 'Comparison Model',
    multi_step: 'Multi-Step Problem',
  }[challengeType] || 'Part-Whole Visualization';

  // =========================================================================
  // Main render
  // =========================================================================

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Tape Diagram / Bar Model</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            <p className="text-xs text-orange-400 font-mono uppercase tracking-wider">{modeLabel}</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-orange-500/20 relative overflow-hidden">
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#f97316 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Mode-specific content */}
          {challengeType === 'represent' && renderRepresentMode()}
          {challengeType === 'solve_part_whole' && renderPartWholeMode()}
          {challengeType === 'solve_comparison' && renderComparisonMode()}
          {challengeType === 'multi_step' && renderMultiStepMode()}

          {/* Final success state */}
          {hasSubmittedEvaluation && (
            <div className="mt-8 p-6 bg-green-500/20 border-2 border-green-500/50 rounded-xl text-center">
              <div className="text-green-400 font-bold text-xl mb-1">All Complete!</div>
              <div className="text-green-300/80 mb-4">You&apos;ve mastered this tape diagram problem.</div>
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-orange-600/20 border-2 border-orange-500/40 text-orange-400 rounded-lg hover:bg-orange-600/30 transition-all font-semibold"
              >
                Try Another Problem
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
            <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">Interactive Controls</h4>
            <ul className="text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-1">▸</span>
                <span>
                  {challengeType === 'represent'
                    ? 'Read the word problem and enter the value for each segment'
                    : challengeType === 'solve_comparison'
                    ? 'Compare the two bars and find the missing value'
                    : challengeType === 'multi_step'
                    ? 'Solve each step in order — later steps unlock as you progress'
                    : 'Follow the 3-step progression: Explore → Practice → Apply'
                  }
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-1">▸</span>
                <span>Yellow dashed segments with &ldquo;?&rdquo; represent values to solve for</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TapeDiagram;
