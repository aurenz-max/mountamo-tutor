'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { LengthLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface LengthLabChallenge {
  id: string;
  type: 'compare' | 'tile_and_count' | 'order' | 'indirect';
  instruction: string;
  hint: string;
  narration: string;
  /** Objects to display — names and lengths (in unit cells) */
  objectName0: string;
  objectLength0: number;
  objectColor0: string;
  objectName1: string;
  objectLength1: number;
  objectColor1: string;
  /** Third object for 'order' challenges */
  objectName2?: string;
  objectLength2?: number;
  objectColor2?: string;
  /** For compare: 'longer' | 'shorter' | 'same' */
  correctAnswer: string;
  /** For tile_and_count: correct unit count */
  correctUnitCount?: number;
  /** Unit type for tiling */
  unitType?: string;
  /** For order: correct sequence CSV (e.g. "pencil,crayon,marker") shortest→longest */
  correctOrderCsv?: string;
  /** For indirect: the reference object info */
  referenceObjectName?: string;
  referenceObjectLength?: number;
  referenceObjectColor?: string;
  /** Indirect comparison clue (e.g. "The pencil is shorter than the string") */
  clue0?: string;
  clue1?: string;
}

export interface LengthLabData {
  title: string;
  description: string;
  challenges: LengthLabChallenge[];
  unitType: string; // 'cubes' | 'paper_clips' | 'bears' | 'erasers'
  gradeBand: 'K' | '1';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LengthLabMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  compare:        { label: 'Compare',        icon: '\u2194\uFE0F', accentColor: 'blue' },
  tile_and_count: { label: 'Tile & Count',   icon: '\uD83E\uDDF1', accentColor: 'emerald' },
  order:          { label: 'Order',           icon: '\uD83D\uDCCF', accentColor: 'purple' },
  indirect:       { label: 'Indirect',        icon: '\uD83D\uDD0D', accentColor: 'amber' },
};

const UNIT_EMOJI: Record<string, string> = {
  cubes: '\uD83D\uDFE6',
  paper_clips: '\uD83D\uDCCE',
  bears: '\uD83E\uDDF8',
  erasers: '\u25AC',
};

const UNIT_WIDTH = 36; // px per unit cell
const MAX_BAR_UNITS = 12;

// ============================================================================
// Helper: Object Bar Renderer
// ============================================================================

interface ObjectBarProps {
  name: string;
  length: number;
  color: string;
  maxUnits: number;
  showLabel?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  className?: string;
}

function ObjectBar({ name, length, color, maxUnits, showLabel = true, highlighted = false, onClick, className = '' }: ObjectBarProps) {
  const widthPx = Math.min(length, maxUnits) * UNIT_WIDTH;
  return (
    <div className={`flex items-center gap-3 ${className}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div
        className={`rounded-md transition-all duration-300 ${highlighted ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900' : ''}`}
        style={{
          width: `${widthPx}px`,
          height: '28px',
          backgroundColor: color,
          minWidth: '24px',
          opacity: 0.85,
        }}
      />
      {showLabel && (
        <span className="text-slate-300 text-sm whitespace-nowrap">{name}</span>
      )}
    </div>
  );
}

// ============================================================================
// Helper: Tiling Workspace
// ============================================================================

interface TilingWorkspaceProps {
  objectName: string;
  objectLength: number;
  objectColor: string;
  unitType: string;
  correctCount: number;
  onComplete: (count: number) => void;
  disabled: boolean;
}

function TilingWorkspace({ objectName, objectLength, objectColor, unitType, correctCount, onComplete, disabled }: TilingWorkspaceProps) {
  const [placedUnits, setPlacedUnits] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const objectWidthPx = Math.min(objectLength, MAX_BAR_UNITS) * UNIT_WIDTH;
  const unitEmoji = UNIT_EMOJI[unitType] || '\uD83D\uDFE6';

  const addUnit = useCallback(() => {
    if (disabled || submitted) return;
    setPlacedUnits(prev => Math.min(prev + 1, MAX_BAR_UNITS + 2));
  }, [disabled, submitted]);

  const removeUnit = useCallback(() => {
    if (disabled || submitted) return;
    setPlacedUnits(prev => Math.max(prev - 1, 0));
  }, [disabled, submitted]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    onComplete(placedUnits);
  }, [placedUnits, onComplete]);

  // Reset when challenge changes
  useEffect(() => {
    setPlacedUnits(0);
    setSubmitted(false);
  }, [objectName, correctCount]);

  const unitWidthPx = placedUnits * UNIT_WIDTH;
  const isCorrect = submitted && placedUnits === correctCount;
  const isWrong = submitted && placedUnits !== correctCount;

  return (
    <div className="space-y-4">
      {/* Object to measure */}
      <div className="space-y-1">
        <span className="text-slate-400 text-xs uppercase tracking-wider">Object: {objectName}</span>
        <div
          className="rounded-md"
          style={{ width: `${objectWidthPx}px`, height: '28px', backgroundColor: objectColor, minWidth: '24px', opacity: 0.85 }}
        />
      </div>

      {/* Unit tiles below */}
      <div className="space-y-1">
        <span className="text-slate-400 text-xs uppercase tracking-wider">Your tiles ({unitType.replace('_', ' ')})</span>
        <div className="flex items-center gap-0 min-h-[32px]">
          {Array.from({ length: placedUnits }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-center border border-white/20 bg-white/10 text-lg"
              style={{ width: `${UNIT_WIDTH}px`, height: '28px' }}
            >
              {unitEmoji}
            </div>
          ))}
          {placedUnits === 0 && (
            <span className="text-slate-500 text-sm italic">Tap + to add tiles</span>
          )}
        </div>
        {/* Alignment feedback */}
        {placedUnits > 0 && !submitted && (
          <div className="text-xs text-slate-500">
            {unitWidthPx < objectWidthPx ? 'Not enough tiles yet...' :
             unitWidthPx > objectWidthPx ? 'Too many tiles! Remove some.' :
             'Looks like a perfect fit!'}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-lg px-3"
          onClick={removeUnit}
          disabled={disabled || submitted || placedUnits === 0}
        >
          -
        </Button>
        <span className="text-slate-200 text-xl font-semibold min-w-[2ch] text-center">{placedUnits}</span>
        <Button
          variant="ghost"
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-lg px-3"
          onClick={addUnit}
          disabled={disabled || submitted}
        >
          +
        </Button>
        {!submitted && placedUnits > 0 && (
          <Button
            variant="ghost"
            className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300 ml-auto"
            onClick={handleSubmit}
            disabled={disabled}
          >
            Check
          </Button>
        )}
      </div>

      {/* Feedback */}
      {isCorrect && (
        <div className="text-emerald-400 text-sm font-medium">
          Correct! The {objectName} is {correctCount} {unitType.replace('_', ' ')} long.
        </div>
      )}
      {isWrong && (
        <div className="text-red-400 text-sm font-medium">
          Not quite. You placed {placedUnits}, but the {objectName} is {correctCount} {unitType.replace('_', ' ')} long.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper: Ordering Workspace
// ============================================================================

interface OrderItem {
  name: string;
  length: number;
  color: string;
}

interface OrderingWorkspaceProps {
  items: OrderItem[];
  correctOrderCsv: string;
  onComplete: (correct: boolean) => void;
  disabled: boolean;
}

function OrderingWorkspace({ items, correctOrderCsv, onComplete, disabled }: OrderingWorkspaceProps) {
  const [slots, setSlots] = useState<(OrderItem | null)[]>([null, null, null]);
  const [availableItems, setAvailableItems] = useState<OrderItem[]>([...items]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Reset on challenge change
  useEffect(() => {
    setSlots([null, null, null]);
    setAvailableItems([...items]);
    setSubmitted(false);
    setIsCorrect(false);
  }, [items, correctOrderCsv]);

  const placeItem = useCallback((item: OrderItem) => {
    if (disabled || submitted) return;
    const firstEmpty = slots.findIndex(s => s === null);
    if (firstEmpty === -1) return;
    const newSlots = [...slots];
    newSlots[firstEmpty] = item;
    setSlots(newSlots);
    setAvailableItems(prev => prev.filter(i => i.name !== item.name));
  }, [disabled, submitted, slots]);

  const removeFromSlot = useCallback((index: number) => {
    if (disabled || submitted) return;
    const item = slots[index];
    if (!item) return;
    const newSlots = [...slots];
    newSlots[index] = null;
    setSlots(newSlots);
    setAvailableItems(prev => [...prev, item]);
  }, [disabled, submitted, slots]);

  const handleSubmit = useCallback(() => {
    const correctOrder = correctOrderCsv.split(',').map(s => s.trim());
    const studentOrder = slots.map(s => s?.name || '');
    const correct = correctOrder.every((name, i) => name === studentOrder[i]);
    setIsCorrect(correct);
    setSubmitted(true);
    onComplete(correct);
  }, [slots, correctOrderCsv, onComplete]);

  const allFilled = slots.every(s => s !== null);

  return (
    <div className="space-y-4">
      {/* Available items */}
      <div className="space-y-1">
        <span className="text-slate-400 text-xs uppercase tracking-wider">Objects to arrange</span>
        <div className="flex flex-wrap gap-2">
          {availableItems.map(item => (
            <Button
              key={item.name}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 flex items-center gap-2"
              onClick={() => placeItem(item)}
              disabled={disabled || submitted}
            >
              <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
              {item.name}
            </Button>
          ))}
          {availableItems.length === 0 && !submitted && (
            <span className="text-slate-500 text-sm italic">All placed! Check your order.</span>
          )}
        </div>
      </div>

      {/* Slots: shortest → longest */}
      <div className="space-y-1">
        <span className="text-slate-400 text-xs uppercase tracking-wider">
          Shortest → Longest
        </span>
        <div className="flex items-end gap-3">
          {slots.map((slot, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`min-w-[80px] min-h-[44px] rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                  slot
                    ? 'border-white/30 bg-white/5'
                    : 'border-white/10 bg-white/[0.02]'
                } ${submitted && isCorrect ? 'border-emerald-400/50' : ''} ${submitted && !isCorrect ? 'border-red-400/50' : ''}`}
                onClick={() => removeFromSlot(i)}
              >
                {slot ? (
                  <div className="flex items-center gap-2 px-3 py-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: slot.color }} />
                    <span className="text-slate-200 text-sm">{slot.name}</span>
                  </div>
                ) : (
                  <span className="text-slate-600 text-xs">{i + 1}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      {!submitted && allFilled && (
        <Button
          variant="ghost"
          className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300"
          onClick={handleSubmit}
          disabled={disabled}
        >
          Check Order
        </Button>
      )}

      {submitted && isCorrect && (
        <div className="text-emerald-400 text-sm font-medium">
          Perfect! You arranged them from shortest to longest!
        </div>
      )}
      {submitted && !isCorrect && (
        <div className="text-red-400 text-sm font-medium">
          Not quite. Try comparing the lengths more carefully.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

interface LengthLabProps {
  data: LengthLabData;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

const LengthLab: React.FC<LengthLabProps> = ({ data }) => {
  const {
    title,
    description,
    challenges = [],
    unitType = 'cubes',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Evaluation ──
  const resolvedInstanceId = instanceId || 'length-lab-default';
  const [hasSubmittedEval, setHasSubmittedEval] = useState(false);

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<LengthLabMetrics>({
    primitiveType: 'length-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ──
  const aiPrimitiveData = useMemo(() => ({
    unitType,
    gradeBand: data.gradeBand,
    challengeCount: challenges.length,
  }), [unitType, data.gradeBand, challenges.length]);

  const { sendText } = useLuminaAI({
    primitiveType: 'length-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // ── Challenge Progress (shared hook) ──
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // ── Current challenge ──
  const currentChallenge = challenges[currentIndex] || null;
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // ── Stable order items (memoized so OrderingWorkspace doesn't reset on every parent re-render) ──
  const orderItems = useMemo<OrderItem[]>(() => {
    const ch = currentChallenge;
    if (!ch || ch.type !== 'order') return [];
    const items: OrderItem[] = [
      { name: ch.objectName0, length: ch.objectLength0, color: ch.objectColor0 },
      { name: ch.objectName1, length: ch.objectLength1, color: ch.objectColor1 },
    ];
    if (ch.objectName2 && ch.objectLength2 && ch.objectColor2) {
      items.push({ name: ch.objectName2, length: ch.objectLength2, color: ch.objectColor2 });
    }
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [currentChallenge]);

  // Reset local state when challenge changes
  useEffect(() => {
    setSelectedAnswer(null);
    setShowFeedback(false);
  }, [currentIndex]);

  // ── Announce challenge to AI ──
  useEffect(() => {
    if (!currentChallenge) return;
    if (currentIndex === 0) {
      sendText(`[ACTIVITY_START] Length Lab: "${title}". ${challenges.length} challenges. First: ${currentChallenge.type} — ${currentChallenge.instruction}`, { silent: true });
    } else {
      sendText(`[NEXT_ITEM] Challenge ${currentIndex + 1} of ${challenges.length}: ${currentChallenge.type} — ${currentChallenge.instruction}`, { silent: true });
    }
  }, [currentIndex, currentChallenge, challenges.length, title, sendText]);

  // ── Submit evaluation when all complete ──
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEval) return;
    setHasSubmittedEval(true);

    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const overallPct = Math.round((correctCount / challenges.length) * 100);
    const elapsed = elapsedMs;

    const metrics: LengthLabMetrics = {
      type: 'length-lab',
      totalChallenges: challenges.length,
      correctAnswers: correctCount,
      totalAttempts,
      accuracy: overallPct / 100,
      averageTimePerChallenge: Math.round(elapsed / challenges.length),
    };

    submitEvaluation(
      correctCount === challenges.length,
      overallPct,
      metrics,
      { challengeResults },
    );

    // AI celebration
    const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
    sendText(`[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. Give encouraging phase-specific feedback about measuring and comparing lengths.`, { silent: true });
  }, [allChallengesComplete, hasSubmittedEval, challengeResults, challenges.length, phaseResults, submitEvaluation, sendText, elapsedMs]);

  // ── Handle compare answer ──
  const handleCompareAnswer = useCallback((answer: string) => {
    if (!currentChallenge || showFeedback) return;
    setSelectedAnswer(answer);
    setShowFeedback(true);
    incrementAttempts();

    const correct = answer === currentChallenge.correctAnswer;

    if (correct) {
      sendText(`[ANSWER_CORRECT] Student correctly identified "${currentChallenge.objectName0}" vs "${currentChallenge.objectName1}" — answered "${answer}".`, { silent: true });
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    } else {
      sendText(`[ANSWER_INCORRECT] Student chose "${answer}" but correct is "${currentChallenge.correctAnswer}" for "${currentChallenge.objectName0}" vs "${currentChallenge.objectName1}". Give a hint.`, { silent: true });
      recordResult({
        challengeId: currentChallenge.id,
        correct: false,
        attempts: currentAttempts + 1,
      });
    }
  }, [currentChallenge, showFeedback, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Handle tile completion ──
  const handleTileComplete = useCallback((count: number) => {
    if (!currentChallenge) return;
    incrementAttempts();
    const correct = count === currentChallenge.correctUnitCount;

    if (correct) {
      sendText(`[ANSWER_CORRECT] Student correctly tiled ${count} ${unitType} for "${currentChallenge.objectName0}".`, { silent: true });
    } else {
      sendText(`[ANSWER_INCORRECT] Student placed ${count} ${unitType} but correct is ${currentChallenge.correctUnitCount} for "${currentChallenge.objectName0}". Hint about gaps or overlaps.`, { silent: true });
    }

    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts: currentAttempts + 1,
    });
    setShowFeedback(true);
  }, [currentChallenge, currentAttempts, unitType, incrementAttempts, recordResult, sendText]);

  // ── Handle order completion ──
  const handleOrderComplete = useCallback((correct: boolean) => {
    if (!currentChallenge) return;
    incrementAttempts();

    if (correct) {
      sendText(`[ANSWER_CORRECT] Student correctly ordered objects from shortest to longest.`, { silent: true });
    } else {
      sendText(`[ANSWER_INCORRECT] Student ordered incorrectly. The correct order is: ${currentChallenge.correctOrderCsv}. Encourage comparing two at a time.`, { silent: true });
    }

    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts: currentAttempts + 1,
    });
    setShowFeedback(true);
  }, [currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Handle indirect answer ──
  const handleIndirectAnswer = useCallback((answer: string) => {
    if (!currentChallenge || showFeedback) return;
    setSelectedAnswer(answer);
    setShowFeedback(true);
    incrementAttempts();

    const correct = answer === currentChallenge.correctAnswer;

    if (correct) {
      sendText(`[ANSWER_CORRECT] Student correctly used indirect comparison: "${answer}".`, { silent: true });
    } else {
      sendText(`[ANSWER_INCORRECT] Student chose "${answer}" but correct is "${currentChallenge.correctAnswer}". Remind them about the clues: "${currentChallenge.clue0}" and "${currentChallenge.clue1}".`, { silent: true });
    }

    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts: currentAttempts + 1,
    });
  }, [currentChallenge, showFeedback, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Advance ──
  const handleNext = useCallback(() => {
    if (!advanceProgress()) return; // already at end
    setSelectedAnswer(null);
    setShowFeedback(false);
  }, [advanceProgress]);

  // ── Render challenge content ──
  const renderChallenge = () => {
    if (!currentChallenge) return null;
    const ch = currentChallenge;

    switch (ch.type) {
      case 'compare': {
        const isCorrect = showFeedback && selectedAnswer === ch.correctAnswer;
        const isWrong = showFeedback && selectedAnswer !== ch.correctAnswer;

        return (
          <div className="space-y-5">
            {/* Two objects on shared baseline */}
            <div className="space-y-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <ObjectBar name={ch.objectName0} length={ch.objectLength0} color={ch.objectColor0} maxUnits={MAX_BAR_UNITS} />
              <ObjectBar name={ch.objectName1} length={ch.objectLength1} color={ch.objectColor1} maxUnits={MAX_BAR_UNITS} />
            </div>

            {/* Answer buttons */}
            <div className="flex flex-wrap gap-2">
              {['longer', 'shorter', 'same'].map(answer => {
                const label = answer === 'longer' ? `${ch.objectName0} is longer` :
                              answer === 'shorter' ? `${ch.objectName0} is shorter` :
                              'They are the same length';
                const isSelected = selectedAnswer === answer;
                return (
                  <Button
                    key={answer}
                    variant="ghost"
                    className={`bg-white/5 border border-white/20 hover:bg-white/10 ${
                      isSelected && isCorrect ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' :
                      isSelected && isWrong ? 'bg-red-500/20 border-red-400/30 text-red-300' :
                      ''
                    }`}
                    onClick={() => handleCompareAnswer(answer)}
                    disabled={showFeedback}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>

            {isCorrect && <div className="text-emerald-400 text-sm font-medium">That&apos;s right!</div>}
            {isWrong && <div className="text-red-400 text-sm font-medium">Not quite. Look at the bars — which one sticks out farther?</div>}
          </div>
        );
      }

      case 'tile_and_count':
        return (
          <TilingWorkspace
            objectName={ch.objectName0}
            objectLength={ch.objectLength0}
            objectColor={ch.objectColor0}
            unitType={ch.unitType || unitType}
            correctCount={ch.correctUnitCount || ch.objectLength0}
            onComplete={handleTileComplete}
            disabled={allChallengesComplete}
          />
        );

      case 'order': {
        return (
          <div className="space-y-5">
            {/* Show all objects */}
            <div className="space-y-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              {orderItems.map(item => (
                <ObjectBar key={item.name} name={item.name} length={item.length} color={item.color} maxUnits={MAX_BAR_UNITS} />
              ))}
            </div>

            <OrderingWorkspace
              key={ch.id}
              items={orderItems}
              correctOrderCsv={ch.correctOrderCsv || ''}
              onComplete={handleOrderComplete}
              disabled={allChallengesComplete}
            />
          </div>
        );
      }

      case 'indirect': {
        const isCorrect = showFeedback && selectedAnswer === ch.correctAnswer;
        const isWrong = showFeedback && selectedAnswer !== ch.correctAnswer;

        return (
          <div className="space-y-5">
            {/* Clues */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Clues</span>
              {ch.clue0 && <p className="text-slate-200 text-sm">{ch.clue0}</p>}
              {ch.clue1 && <p className="text-slate-200 text-sm">{ch.clue1}</p>}
              {ch.referenceObjectName && (
                <div className="mt-2">
                  <ObjectBar
                    name={`Reference: ${ch.referenceObjectName}`}
                    length={ch.referenceObjectLength || 5}
                    color={ch.referenceObjectColor || '#888'}
                    maxUnits={MAX_BAR_UNITS}
                  />
                </div>
              )}
            </div>

            {/* Question: which is longer? */}
            <div className="flex flex-wrap gap-2">
              {[ch.objectName0, ch.objectName1, 'same'].map(answer => {
                const label = answer === 'same' ? 'Same length' : `${answer} is longer`;
                const isSelected = selectedAnswer === answer;
                return (
                  <Button
                    key={answer}
                    variant="ghost"
                    className={`bg-white/5 border border-white/20 hover:bg-white/10 ${
                      isSelected && isCorrect ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' :
                      isSelected && isWrong ? 'bg-red-500/20 border-red-400/30 text-red-300' :
                      ''
                    }`}
                    onClick={() => handleIndirectAnswer(answer)}
                    disabled={showFeedback}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>

            {isCorrect && <div className="text-emerald-400 text-sm font-medium">Great thinking! You used the clues to compare.</div>}
            {isWrong && <div className="text-red-400 text-sm font-medium">Think about the clues. If A is shorter than the string, and the string is shorter than B, which is longer?</div>}
          </div>
        );
      }

      default:
        return null;
    }
  };

  // ── Hint display ──
  const showHint = currentAttempts >= 2 && currentChallenge && !showFeedback;

  // ── Empty state ──
  if (!challenges.length) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-8 text-center text-slate-400">
          No challenges available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
          {currentChallenge && (
            <Badge variant="outline" className="border-white/20 text-slate-300">
              {currentIndex + 1} / {challenges.length}
            </Badge>
          )}
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Phase summary when complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)}
            durationMs={elapsedMs}
            heading="Length Lab Complete!"
            celebrationMessage="You explored measuring and comparing lengths!"
            className="mb-6"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <div className="space-y-4">
            {/* Challenge type badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-white/20 text-slate-300">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            </div>

            {/* Instruction */}
            <p className="text-slate-200 text-base font-medium">{currentChallenge.instruction}</p>

            {/* Challenge content */}
            {renderChallenge()}

            {/* Hint */}
            {showHint && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-400/20 text-amber-300 text-sm">
                {currentChallenge.hint}
              </div>
            )}

            {/* Next button */}
            {showFeedback && !allChallengesComplete && currentIndex < challenges.length - 1 && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleNext}
              >
                Next Challenge
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LengthLab;
