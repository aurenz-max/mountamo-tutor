'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { BaseTenBlocksMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface BaseTenBlocksChallenge {
  type: 'build_number' | 'read_blocks' | 'regroup' | 'add_with_blocks' | 'subtract_with_blocks';
  instruction: string;
  targetNumber: number;
  secondNumber?: number; // For operations
  hint: string;
}

export interface BaseTenBlocksData {
  title: string;
  description: string;
  numberValue: number;
  interactionMode?: 'build' | 'decompose' | 'regroup' | 'operate';
  decimalMode?: boolean;
  maxPlace?: 'ones' | 'tens' | 'hundreds' | 'thousands';
  supplyTray?: boolean;
  challenges?: BaseTenBlocksChallenge[];
  gradeBand?: 'K-1' | '2-3' | '4-5';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<BaseTenBlocksMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type PlaceValue = 'thousands' | 'hundreds' | 'tens' | 'ones' | 'tenths' | 'hundredths';

const PLACE_CONFIG: Record<PlaceValue, { label: string; value: number; color: string; borderColor: string; bgColor: string }> = {
  thousands: { label: 'Thousands', value: 1000, color: 'text-amber-300', borderColor: 'border-amber-400', bgColor: 'bg-amber-500' },
  hundreds: { label: 'Hundreds', value: 100, color: 'text-blue-300', borderColor: 'border-blue-400', bgColor: 'bg-blue-500' },
  tens: { label: 'Tens', value: 10, color: 'text-purple-300', borderColor: 'border-purple-400', bgColor: 'bg-purple-500' },
  ones: { label: 'Ones', value: 1, color: 'text-emerald-300', borderColor: 'border-emerald-400', bgColor: 'bg-emerald-500' },
  tenths: { label: 'Tenths', value: 0.1, color: 'text-cyan-300', borderColor: 'border-cyan-400', bgColor: 'bg-cyan-500' },
  hundredths: { label: 'Hundredths', value: 0.01, color: 'text-pink-300', borderColor: 'border-pink-400', bgColor: 'bg-pink-500' },
};

function getActivePlaces(maxPlace: string, decimalMode: boolean): PlaceValue[] {
  const places: PlaceValue[] = [];
  if (maxPlace === 'thousands') places.push('thousands');
  places.push('hundreds', 'tens', 'ones');
  if (decimalMode) places.push('tenths', 'hundredths');
  return places;
}

function decomposeNumber(num: number, places: PlaceValue[]): Record<PlaceValue, number> {
  const result: Record<string, number> = {};
  let remaining = Math.abs(num);
  for (const place of places) {
    const pv = PLACE_CONFIG[place].value;
    result[place] = Math.floor(remaining / pv);
    remaining = Math.round((remaining - result[place] * pv) * 100) / 100;
  }
  return result as Record<PlaceValue, number>;
}

function computeTotal(columns: Record<PlaceValue, number>, places: PlaceValue[]): number {
  let total = 0;
  for (const place of places) {
    total += (columns[place] || 0) * PLACE_CONFIG[place].value;
  }
  return Math.round(total * 100) / 100;
}

// ============================================================================
// Component
// ============================================================================

interface BaseTenBlocksProps {
  data: BaseTenBlocksData;
  className?: string;
}

const BaseTenBlocks: React.FC<BaseTenBlocksProps> = ({ data, className }) => {
  const {
    title,
    description,
    numberValue,
    interactionMode = 'build',
    decimalMode = false,
    maxPlace = 'hundreds',
    supplyTray = true,
    challenges = [],
    gradeBand = '2-3',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const activePlaces = useMemo(() => getActivePlaces(maxPlace, decimalMode), [maxPlace, decimalMode]);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const initialColumns = useMemo(() => {
    if (interactionMode === 'decompose' || interactionMode === 'regroup') {
      return decomposeNumber(numberValue, activePlaces);
    }
    // For 'build' and 'operate', start empty
    const empty: Record<string, number> = {};
    activePlaces.forEach(p => { empty[p] = 0; });
    return empty as Record<PlaceValue, number>;
  }, [numberValue, interactionMode, activePlaces]);

  const [columns, setColumns] = useState<Record<PlaceValue, number>>(initialColumns);
  const [regroupAnimating, setRegroupAnimating] = useState<PlaceValue | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Challenge state
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengeResults, setChallengeResults] = useState<Array<{ correct: boolean; attempts: number; regroupsUsed: number }>>([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [regroupCount, setRegroupCount] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `base-ten-blocks-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const currentTotal = useMemo(() => computeTotal(columns, activePlaces), [columns, activePlaces]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<BaseTenBlocksMetrics>({
    primitiveType: 'base-ten-blocks',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    numberValue,
    interactionMode,
    decimalMode,
    gradeBand,
    currentTotal,
    columns: Object.fromEntries(activePlaces.map(p => [p, columns[p] || 0])),
    targetNumber: currentChallenge?.targetNumber ?? numberValue,
    challengeType: currentChallenge?.type ?? interactionMode,
    instruction: currentChallenge?.instruction ?? description,
    attemptNumber: currentAttempts + 1,
    regroupsUsed: regroupCount,
  }), [numberValue, interactionMode, decimalMode, gradeBand, currentTotal, activePlaces, columns, currentChallenge, currentAttempts, regroupCount, description]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'base-ten-blocks',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-1' ? 'Kindergarten' : gradeBand === '2-3' ? 'Grade 2' : 'Grade 4',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    const mode = interactionMode === 'build' ? 'building numbers with blocks'
      : interactionMode === 'decompose' ? 'breaking apart numbers'
      : interactionMode === 'regroup' ? 'regrouping (trading blocks)'
      : 'adding and subtracting with blocks';
    sendText(
      `[ACTIVITY_START] Base-ten blocks activity for ${gradeBand}. Mode: ${mode}. `
      + `Number: ${numberValue}. ${challenges.length} challenges. `
      + `Introduce warmly: "Let's explore place value with our blocks!" `
      + `${currentChallenge ? `First challenge: "${currentChallenge.instruction}"` : ''}`,
      { silent: true }
    );
  }, [isConnected, interactionMode, gradeBand, numberValue, challenges.length, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------
  const addBlock = useCallback((place: PlaceValue) => {
    if (hasSubmittedEvaluation) return;
    setColumns(prev => ({ ...prev, [place]: (prev[place] || 0) + 1 }));
  }, [hasSubmittedEvaluation]);

  const removeBlock = useCallback((place: PlaceValue) => {
    if (hasSubmittedEvaluation) return;
    setColumns(prev => {
      if ((prev[place] || 0) <= 0) return prev;
      return { ...prev, [place]: prev[place] - 1 };
    });
  }, [hasSubmittedEvaluation]);

  // Regroup: merge 10 smaller units into 1 larger unit
  const regroupUp = useCallback((place: PlaceValue) => {
    if (hasSubmittedEvaluation) return;
    const placeIdx = activePlaces.indexOf(place);
    if (placeIdx <= 0) return; // Can't regroup up from the largest place
    const higherPlace = activePlaces[placeIdx - 1];
    if ((columns[place] || 0) < 10) {
      setFeedback(`You need at least 10 ${PLACE_CONFIG[place].label.toLowerCase()} to regroup!`);
      setFeedbackType('error');
      return;
    }
    setRegroupAnimating(place);
    setTimeout(() => {
      setColumns(prev => ({
        ...prev,
        [place]: prev[place] - 10,
        [higherPlace]: (prev[higherPlace] || 0) + 1,
      }));
      setRegroupAnimating(null);
      setRegroupCount(c => c + 1);
      setFeedback(`10 ${PLACE_CONFIG[place].label.toLowerCase()} = 1 ${PLACE_CONFIG[higherPlace].label.toLowerCase().slice(0, -1)}!`);
      setFeedbackType('success');
      sendText(
        `[REGROUP_UP] Student regrouped 10 ${place} into 1 ${higherPlace}. `
        + `Encourage: "Great trading! 10 ${place} always makes 1 ${higherPlace}."`,
        { silent: true }
      );
    }, 400);
  }, [hasSubmittedEvaluation, activePlaces, columns, sendText]);

  // Regroup: break 1 larger unit into 10 smaller units
  const regroupDown = useCallback((place: PlaceValue) => {
    if (hasSubmittedEvaluation) return;
    const placeIdx = activePlaces.indexOf(place);
    if (placeIdx >= activePlaces.length - 1) return; // Can't break down the smallest
    const lowerPlace = activePlaces[placeIdx + 1];
    if ((columns[place] || 0) < 1) {
      setFeedback(`You need at least 1 ${PLACE_CONFIG[place].label.toLowerCase().slice(0, -1)} to break apart!`);
      setFeedbackType('error');
      return;
    }
    setRegroupAnimating(place);
    setTimeout(() => {
      setColumns(prev => ({
        ...prev,
        [place]: prev[place] - 1,
        [lowerPlace]: (prev[lowerPlace] || 0) + 10,
      }));
      setRegroupAnimating(null);
      setRegroupCount(c => c + 1);
      setFeedback(`1 ${PLACE_CONFIG[place].label.toLowerCase().slice(0, -1)} = 10 ${PLACE_CONFIG[lowerPlace].label.toLowerCase()}!`);
      setFeedbackType('success');
      sendText(
        `[REGROUP_DOWN] Student broke 1 ${place} into 10 ${lowerPlace}. `
        + `Encourage: "You unpacked it! 1 ${place} is the same as 10 ${lowerPlace}."`,
        { silent: true }
      );
    }, 400);
  }, [hasSubmittedEvaluation, activePlaces, columns, sendText]);

  const resetColumns = useCallback(() => {
    setColumns(initialColumns);
    setFeedback('');
    setFeedbackType('');
    setRegroupCount(0);
  }, [initialColumns]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  const checkAnswer = useCallback(() => {
    if (!currentChallenge) return;
    const target = currentChallenge.targetNumber;
    const correct = Math.abs(currentTotal - target) < 0.01;
    setCurrentAttempts(a => a + 1);

    if (correct) {
      setFeedback(`Correct! ${currentTotal} is right!`);
      setFeedbackType('success');
      setChallengeResults(prev => [...prev, { correct: true, attempts: currentAttempts + 1, regroupsUsed: regroupCount }]);
      sendText(
        `[ANSWER_CORRECT] Student built ${currentTotal} correctly! `
        + `${regroupCount > 0 ? `Used ${regroupCount} regroups. ` : ''}`
        + `Celebrate briefly.`,
        { silent: true }
      );
    } else {
      setFeedback(`Your blocks show ${currentTotal}, but the target is ${target}. Try again!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student has ${currentTotal} but target is ${target}. `
        + `Attempt ${currentAttempts + 1}. `
        + `Help: "Look at each column. How many ${currentTotal < target ? 'more' : 'fewer'} do you need?"`,
        { silent: true }
      );
    }
  }, [currentChallenge, currentTotal, currentAttempts, regroupCount, sendText]);

  const advanceChallenge = useCallback(() => {
    const nextIdx = currentChallengeIndex + 1;
    if (nextIdx >= challenges.length) {
      // All complete
      sendText(
        `[ALL_COMPLETE] Student finished all ${challenges.length} challenges! Celebrate.`,
        { silent: true }
      );
      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const accuracy = Math.round((correctCount / challenges.length) * 100);
        const totalRegroups = challengeResults.reduce((s, r) => s + r.regroupsUsed, 0);
        const metrics: BaseTenBlocksMetrics = {
          type: 'base-ten-blocks',
          representationAccuracy: accuracy,
          regroupingCorrect: totalRegroups > 0,
          regroupCount: totalRegroups,
          placeValuesUsed: activePlaces,
          decimalModeUsed: decimalMode,
          challengesCompleted: correctCount,
          totalChallenges: challenges.length,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };
        submitEvaluation(correctCount === challenges.length, accuracy, metrics, { challengeResults });
      }
      return;
    }
    setCurrentChallengeIndex(nextIdx);
    setCurrentAttempts(0);
    setRegroupCount(0);
    setFeedback('');
    setFeedbackType('');
    // Reset columns for next challenge
    const next = challenges[nextIdx];
    if (next.type === 'read_blocks' || next.type === 'regroup') {
      setColumns(decomposeNumber(next.targetNumber, activePlaces));
    } else {
      const empty: Record<string, number> = {};
      activePlaces.forEach(p => { empty[p] = 0; });
      setColumns(empty as Record<PlaceValue, number>);
    }
    sendText(
      `[NEXT_ITEM] Challenge ${nextIdx + 1} of ${challenges.length}: "${next.instruction}". Introduce it.`,
      { silent: true }
    );
  }, [currentChallengeIndex, challenges, challengeResults, hasSubmittedEvaluation, activePlaces, decimalMode, submitEvaluation, sendText]);

  const isCurrentComplete = challengeResults.length > currentChallengeIndex && challengeResults[currentChallengeIndex]?.correct;
  const allComplete = challenges.length > 0 && challengeResults.filter(r => r.correct).length >= challenges.length;

  // -------------------------------------------------------------------------
  // Block Rendering Helpers
  // -------------------------------------------------------------------------
  const renderBlockVisual = (place: PlaceValue, count: number) => {
    const config = PLACE_CONFIG[place];
    const isAnimating = regroupAnimating === place;
    const maxShow = place === 'thousands' ? 3 : place === 'hundreds' ? 5 : place === 'tens' ? 12 : 15;
    const showCount = Math.min(count, maxShow);
    const overflow = count > maxShow;

    if (count === 0) {
      return <span className="text-slate-600 text-xs italic">empty</span>;
    }

    return (
      <div className={`flex flex-wrap gap-1 justify-center transition-all duration-300 ${isAnimating ? 'scale-90 opacity-50' : ''}`}>
        {Array.from({ length: showCount }).map((_, i) => (
          <div key={i} className={`${config.bgColor}/20 border ${config.borderColor}/40 rounded transition-all duration-200 hover:scale-110 ${
            place === 'thousands' ? 'w-10 h-10' :
            place === 'hundreds' ? 'w-8 h-8' :
            place === 'tens' ? 'w-2.5 h-8' :
            place === 'ones' ? 'w-3 h-3' :
            place === 'tenths' ? 'w-2 h-2' :
            'w-1.5 h-1.5'
          }`}>
            {place === 'hundreds' && (
              <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-px p-px">
                {Array.from({ length: 25 }).map((_, j) => (
                  <div key={j} className={`${config.bgColor}/30`} />
                ))}
              </div>
            )}
            {place === 'thousands' && (
              <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-px p-0.5">
                {Array.from({ length: 25 }).map((_, j) => (
                  <div key={j} className={`${config.bgColor}/40`} />
                ))}
              </div>
            )}
          </div>
        ))}
        {overflow && (
          <span className={`text-xs ${config.color} font-mono`}>+{count - maxShow}</span>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
              {gradeBand}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
              {interactionMode}
            </Badge>
            {decimalMode && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
                Decimal
              </Badge>
            )}
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1">{description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-xs">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
            <div className="flex gap-1">
              {challenges.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${
                  i < challengeResults.length && challengeResults[i]?.correct ? 'bg-emerald-400' :
                  i === currentChallengeIndex ? 'bg-blue-400 animate-pulse' :
                  'bg-slate-700'
                }`} />
              ))}
            </div>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Place Value Columns */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${activePlaces.length}, 1fr)` }}>
          {activePlaces.map(place => {
            const config = PLACE_CONFIG[place];
            const count = columns[place] || 0;
            const placeIdx = activePlaces.indexOf(place);

            return (
              <div key={place} className="flex flex-col items-center gap-2 bg-slate-800/20 rounded-xl p-3 border border-white/5">
                {/* Column Header */}
                <div className="text-center">
                  <span className={`text-xs font-mono uppercase tracking-wider ${config.color}`}>
                    {config.label}
                  </span>
                  <div className={`text-2xl font-bold ${config.color}`}>{count}</div>
                </div>

                {/* Block Visual */}
                <div className="min-h-[60px] flex items-center justify-center w-full">
                  {renderBlockVisual(place, count)}
                </div>

                {/* Add/Remove Buttons */}
                {supplyTray && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                      onClick={() => removeBlock(place)}
                      disabled={count <= 0 || hasSubmittedEvaluation}
                    >
                      -
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                      onClick={() => addBlock(place)}
                      disabled={hasSubmittedEvaluation}
                    >
                      +
                    </Button>
                  </div>
                )}

                {/* Regroup Buttons */}
                <div className="flex flex-col gap-1 w-full">
                  {placeIdx > 0 && count >= 10 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 text-[10px] ${config.bgColor}/10 border ${config.borderColor}/30 hover:${config.bgColor}/20 ${config.color} w-full`}
                      onClick={() => regroupUp(place)}
                      disabled={hasSubmittedEvaluation}
                    >
                      10 &rarr; 1 {PLACE_CONFIG[activePlaces[placeIdx - 1]].label.slice(0, 4)}
                    </Button>
                  )}
                  {placeIdx < activePlaces.length - 1 && count >= 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 text-[10px] ${config.bgColor}/10 border ${config.borderColor}/30 hover:${config.bgColor}/20 ${config.color} w-full`}
                      onClick={() => regroupDown(place)}
                      disabled={hasSubmittedEvaluation}
                    >
                      1 &rarr; 10 {PLACE_CONFIG[activePlaces[placeIdx + 1]].label.slice(0, 4)}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Display */}
        <div className="flex items-center justify-center gap-4 bg-slate-800/30 rounded-lg p-3 border border-white/5">
          <span className="text-slate-400 text-sm">Total:</span>
          <span className="text-white font-bold text-2xl font-mono">{currentTotal}</span>
          {currentChallenge && (
            <>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400 font-mono text-lg">{currentChallenge.targetNumber}</span>
            </>
          )}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-3">
          {challenges.length > 0 && !isCurrentComplete && !allComplete && (
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={checkAnswer}
              disabled={hasSubmittedEvaluation}
            >
              Check Answer
            </Button>
          )}
          {isCurrentComplete && !allComplete && (
            <Button
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
              onClick={advanceChallenge}
            >
              Next Challenge
            </Button>
          )}
          <Button
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
            onClick={resetColumns}
            disabled={hasSubmittedEvaluation}
          >
            Reset
          </Button>
        </div>

        {allComplete && (
          <div className="text-center">
            <p className="text-emerald-400 text-sm font-medium mb-1">All challenges complete!</p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
            </p>
          </div>
        )}

        {/* Hint */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </div>
        )}

        {/* No-challenge mode: display info */}
        {challenges.length === 0 && (
          <p className="text-slate-500 text-xs text-center">
            Add and remove blocks to explore place value. Use regroup buttons to trade between places.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default BaseTenBlocks;
