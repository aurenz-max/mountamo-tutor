'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EquationBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface EquationBuilderChallenge {
  id: string;
  type: 'build' | 'missing-value' | 'true-false' | 'balance' | 'rewrite';
  instruction: string;

  // build — "Build the equation: 3 plus 2 equals 5"
  targetEquation?: string;        // "3 + 2 = 5"
  availableTiles?: string[];      // ["3", "2", "5", "+", "=", "4", "-"]

  // missing-value — "What number makes this true? 4 + ? = 7"
  equation?: string;              // "4 + ? = 7"
  missingPosition?: number;       // index of the blank
  correctValue?: number;
  options?: number[];             // MC choices

  // true-false — "Is 3 + 2 = 6 true or false?"
  displayEquation?: string;
  isTrue?: boolean;

  // balance — "Make both sides equal: 3 + 4 = ? + 2"
  leftSide?: string;
  rightSide?: string;
  correctAnswer?: number;

  // rewrite — "Write this another way: 5 = ? + 3"
  originalEquation?: string;
  acceptedForms?: string[];
}

export interface EquationBuilderData {
  title: string;
  description?: string;
  challenges: EquationBuilderChallenge[];
  maxNumber: number;
  gradeBand: 'K' | '1' | '2';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EquationBuilderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build:           { label: 'Build',           icon: '🧱', accentColor: 'purple' },
  'missing-value': { label: 'Missing Value',   icon: '❓', accentColor: 'blue' },
  'true-false':    { label: 'True or False',   icon: '⚖️', accentColor: 'emerald' },
  balance:         { label: 'Balance',          icon: '🟰', accentColor: 'amber' },
  rewrite:         { label: 'Rewrite',          icon: '🔄', accentColor: 'cyan' },
};

// Tile appearance
const TILE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  number: { bg: 'bg-indigo-500/20', border: 'border-indigo-400/40', text: 'text-indigo-200' },
  operator: { bg: 'bg-amber-500/20', border: 'border-amber-400/40', text: 'text-amber-200' },
  equals: { bg: 'bg-emerald-500/20', border: 'border-emerald-400/40', text: 'text-emerald-200' },
  blank: { bg: 'bg-slate-500/10', border: 'border-slate-400/30 border-dashed', text: 'text-slate-500' },
};

function getTileType(tile: string): keyof typeof TILE_COLORS {
  if (tile === '=' || tile === '==') return 'equals';
  if (tile === '+' || tile === '-' || tile === '×' || tile === '÷') return 'operator';
  if (tile === '?' || tile === '_') return 'blank';
  return 'number';
}

// ============================================================================
// Sub-components
// ============================================================================

/** A single equation tile (draggable from pool or placed in workspace) */
function Tile({
  value,
  onClick,
  disabled,
  size = 'md',
  highlight,
  className = '',
}: {
  value: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  highlight?: 'correct' | 'incorrect' | null;
  className?: string;
}) {
  const tileType = getTileType(value);
  const colors = TILE_COLORS[tileType];
  const sizeClasses = {
    sm: 'w-10 h-10 text-lg',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  };

  const highlightClasses = highlight === 'correct'
    ? 'ring-2 ring-emerald-400/60 bg-emerald-500/20'
    : highlight === 'incorrect'
    ? 'ring-2 ring-red-400/60 bg-red-500/20'
    : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]} ${colors.bg} ${colors.text}
        border ${colors.border} rounded-xl
        font-bold select-none
        flex items-center justify-center
        transition-all duration-150
        ${!disabled ? 'hover:scale-110 hover:brightness-125 cursor-pointer active:scale-95' : 'opacity-50 cursor-not-allowed'}
        ${highlightClasses}
        ${className}
      `}
    >
      {value}
    </button>
  );
}

/** Equation display — shows a formatted equation with optional blanks */
function EquationDisplay({
  parts,
  blankIndex,
  size = 'lg',
}: {
  parts: string[];
  blankIndex?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {parts.map((part, i) => (
        <Tile
          key={i}
          value={i === blankIndex ? '?' : part}
          disabled
          size={size}
        />
      ))}
    </div>
  );
}

/** Workspace slots where the student builds the equation */
function BuildWorkspace({
  slots,
  maxSlots,
  onRemoveSlot,
  disabled,
}: {
  slots: string[];
  maxSlots: number;
  onRemoveSlot: (index: number) => void;
  disabled: boolean;
}) {
  const emptySlots = Math.max(0, maxSlots - slots.length);
  return (
    <div className="flex items-center justify-center gap-2 min-h-[70px] flex-wrap">
      {slots.map((tile, i) => (
        <Tile
          key={`slot-${i}`}
          value={tile}
          onClick={() => !disabled && onRemoveSlot(i)}
          disabled={disabled}
          size="md"
        />
      ))}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="w-14 h-14 border border-dashed border-slate-600/40 rounded-xl
                     flex items-center justify-center text-slate-600 text-2xl"
        >
          _
        </div>
      ))}
    </div>
  );
}

/** Available tile pool — student picks from here */
function TilePool({
  tiles,
  onPickTile,
  disabled,
}: {
  tiles: string[];
  onPickTile: (index: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {tiles.map((tile, i) => (
        <Tile
          key={`pool-${i}-${tile}`}
          value={tile}
          onClick={() => onPickTile(i)}
          disabled={disabled}
          size="md"
        />
      ))}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** Parse a display equation like "3 + 2 = 5" into tokens */
function parseEquationTokens(eq: string): string[] {
  return eq.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

/** Evaluate a simple equation string to check if it's mathematically true */
function evaluateEquation(eq: string): boolean {
  const normalized = eq.replace(/\s+/g, '');

  // Handle both "a op b = c" and "c = a op b"
  const eqParts = normalized.split('=');
  if (eqParts.length !== 2) return false;

  const evalSide = (side: string): number | null => {
    // Try simple single number
    const num = parseInt(side, 10);
    if (!isNaN(num) && String(num) === side) return num;

    // Try "a + b" or "a - b"
    const addMatch = side.match(/^(\d+)\+(\d+)$/);
    if (addMatch) return parseInt(addMatch[1], 10) + parseInt(addMatch[2], 10);

    const subMatch = side.match(/^(\d+)-(\d+)$/);
    if (subMatch) return parseInt(subMatch[1], 10) - parseInt(subMatch[2], 10);

    return null;
  };

  const left = evalSide(eqParts[0]);
  const right = evalSide(eqParts[1]);
  if (left === null || right === null) return false;
  return left === right;
}

/** Check if a built equation matches the target (normalized comparison) */
function equationsMatch(built: string[], target: string): boolean {
  const builtStr = built.join(' ').replace(/\s+/g, '');
  const targetStr = target.replace(/\s+/g, '');
  return builtStr === targetStr;
}

/** Check if a built equation is in the accepted forms list (for rewrite) */
function matchesAcceptedForm(built: string[], acceptedForms: string[]): boolean {
  const builtStr = built.join(' ').replace(/\s+/g, '');
  return acceptedForms.some(form => form.replace(/\s+/g, '') === builtStr);
}

// ============================================================================
// Props
// ============================================================================

interface EquationBuilderProps {
  data: EquationBuilderData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const EquationBuilder: React.FC<EquationBuilderProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    maxNumber = 10,
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Shared challenge progress
  // -------------------------------------------------------------------------
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // Domain-specific state
  // -------------------------------------------------------------------------
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [challengeSolved, setChallengeSolved] = useState(false);

  // Build / Rewrite state — tiles in workspace + tiles in pool
  const [workspaceSlots, setWorkspaceSlots] = useState<string[]>([]);
  const [poolTiles, setPoolTiles] = useState<string[]>([]);

  // Missing-value state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // True-false state
  const [selectedTruthValue, setSelectedTruthValue] = useState<boolean | null>(null);

  // Balance state
  const [balanceAnswer, setBalanceAnswer] = useState('');

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `equation-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<EquationBuilderMetrics>({
    primitiveType: 'equation-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? 'build',
    instruction: currentChallenge?.instruction ?? '',
    equation: currentChallenge?.equation ?? currentChallenge?.displayEquation ?? currentChallenge?.targetEquation ?? '',
    attemptNumber: currentAttempts + 1,
    gradeBand,
    maxNumber,
    currentChallengeIndex,
    totalChallenges: challenges.length,
  }), [currentChallenge, currentAttempts, gradeBand, maxNumber, currentChallengeIndex, challenges.length]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'equation-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : gradeBand === '1' ? 'Grade 1' : 'Grade 2',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Equation Builder for ${gradeBand === 'K' ? 'Kindergarten' : `Grade ${gradeBand}`}. `
      + `${challenges.length} challenges. Max number: ${maxNumber}. `
      + `First challenge: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}). `
      + `Introduce warmly: "Let's explore equations! An equation uses the = sign to show two sides are the same."`,
      { silent: true }
    );
  }, [isConnected, challenges.length, maxNumber, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Reset domain state when challenge changes
  // -------------------------------------------------------------------------
  const resetDomainState = useCallback(() => {
    setFeedback('');
    setFeedbackType('');
    setChallengeSolved(false);
    setWorkspaceSlots([]);
    setPoolTiles([]);
    setSelectedOption(null);
    setSelectedTruthValue(null);
    setBalanceAnswer('');
  }, []);

  // Initialize tiles when challenge changes (build / rewrite types)
  useEffect(() => {
    if (!currentChallenge) return;
    resetDomainState();
    if (currentChallenge.type === 'build' || currentChallenge.type === 'rewrite') {
      const tiles = currentChallenge.availableTiles ?? [];
      // Shuffle tiles for the pool
      const shuffled = [...tiles].sort(() => Math.random() - 0.5);
      setPoolTiles(shuffled);
      setWorkspaceSlots([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallengeIndex]);

  // -------------------------------------------------------------------------
  // Build / Rewrite: tile management
  // -------------------------------------------------------------------------
  const handlePickTile = useCallback((poolIndex: number) => {
    if (hasSubmittedEvaluation || challengeSolved) return;
    setPoolTiles(prev => {
      const tile = prev[poolIndex];
      if (!tile) return prev;
      setWorkspaceSlots(ws => [...ws, tile]);
      return prev.filter((_, i) => i !== poolIndex);
    });
  }, [hasSubmittedEvaluation, challengeSolved]);

  const handleRemoveSlot = useCallback((slotIndex: number) => {
    if (hasSubmittedEvaluation || challengeSolved) return;
    setWorkspaceSlots(prev => {
      const tile = prev[slotIndex];
      if (!tile) return prev;
      setPoolTiles(p => [...p, tile]);
      return prev.filter((_, i) => i !== slotIndex);
    });
  }, [hasSubmittedEvaluation, challengeSolved]);

  const handleClearWorkspace = useCallback(() => {
    if (hasSubmittedEvaluation || challengeSolved) return;
    setPoolTiles(prev => [...prev, ...workspaceSlots]);
    setWorkspaceSlots([]);
  }, [hasSubmittedEvaluation, challengeSolved, workspaceSlots]);

  // -------------------------------------------------------------------------
  // Build: check equation
  // -------------------------------------------------------------------------
  const handleCheckBuild = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'build') return;
    incrementAttempts();

    const target = currentChallenge.targetEquation ?? '';
    const correct = equationsMatch(workspaceSlots, target);

    if (correct) {
      setFeedback('You built it! Great job!');
      setFeedbackType('success');
      setChallengeSolved(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student correctly built equation "${target}". Congratulate briefly.`,
        { silent: true }
      );
    } else {
      const builtStr = workspaceSlots.join(' ');
      // Check if mathematically valid but wrong target
      const isValidMath = evaluateEquation(builtStr);
      setFeedback(
        isValidMath
          ? `That's a true equation, but not the one we need. Try to build: ${target}`
          : 'That doesn\'t make a true equation yet. Keep trying!'
      );
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student built "${builtStr}" but target is "${target}". `
        + `${isValidMath ? 'Valid math but wrong target.' : 'Not valid math.'} `
        + `Attempt ${currentAttempts + 1}. Give a hint without revealing the answer.`,
        { silent: true }
      );
    }
  }, [currentChallenge, workspaceSlots, currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Missing-value: check selection
  // -------------------------------------------------------------------------
  const handleCheckMissingValue = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'missing-value' || selectedOption === null) return;
    incrementAttempts();

    const correct = selectedOption === currentChallenge.correctValue;

    if (correct) {
      const filledEq = (currentChallenge.equation ?? '').replace('?', String(selectedOption));
      setFeedback(`Yes! ${filledEq} is true!`);
      setFeedbackType('success');
      setChallengeSolved(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student found missing value: ${selectedOption}. Equation: "${currentChallenge.equation}". Congratulate briefly.`,
        { silent: true }
      );
    } else {
      setFeedback('Not quite. Remember, both sides of = must be the same amount!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose ${selectedOption} but correct is ${currentChallenge.correctValue}. `
        + `Equation: "${currentChallenge.equation}". Attempt ${currentAttempts + 1}. `
        + `Hint about what = means — both sides must balance.`,
        { silent: true }
      );
    }
  }, [currentChallenge, selectedOption, currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // True-false: check answer
  // -------------------------------------------------------------------------
  const handleCheckTrueFalse = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'true-false' || selectedTruthValue === null) return;
    incrementAttempts();

    const correct = selectedTruthValue === currentChallenge.isTrue;

    if (correct) {
      const eq = currentChallenge.displayEquation ?? '';
      setFeedback(
        currentChallenge.isTrue
          ? `Correct! ${eq} is true — both sides are equal!`
          : `Correct! ${eq} is false — the two sides are not equal.`
      );
      setFeedbackType('success');
      setChallengeSolved(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student correctly identified "${eq}" as ${currentChallenge.isTrue ? 'true' : 'false'}. Congratulate briefly.`,
        { silent: true }
      );
    } else {
      setFeedback('Think again. Check each side of the = sign. Are they the same amount?');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student said ${selectedTruthValue ? 'true' : 'false'} but "${currentChallenge.displayEquation}" is ${currentChallenge.isTrue ? 'true' : 'false'}. `
        + `Attempt ${currentAttempts + 1}. Guide them to compute each side separately.`,
        { silent: true }
      );
    }
  }, [currentChallenge, selectedTruthValue, currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Balance: check answer
  // -------------------------------------------------------------------------
  const handleCheckBalance = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'balance') return;
    incrementAttempts();

    const answer = parseInt(balanceAnswer, 10);
    const correct = answer === currentChallenge.correctAnswer;

    if (correct) {
      setFeedback(`Yes! ${currentChallenge.leftSide} = ${(currentChallenge.rightSide ?? '').replace('?', String(answer))} — both sides balance!`);
      setFeedbackType('success');
      setChallengeSolved(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student found balance answer: ${answer}. `
        + `${currentChallenge.leftSide} = ${(currentChallenge.rightSide ?? '').replace('?', String(answer))}. `
        + `Congratulate and reinforce that = means "same amount on both sides."`,
        { silent: true }
      );
    } else {
      setFeedback('The two sides aren\'t equal yet. What number makes both sides the same?');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer} but correct is ${currentChallenge.correctAnswer}. `
        + `Left: "${currentChallenge.leftSide}", Right: "${currentChallenge.rightSide}". `
        + `Attempt ${currentAttempts + 1}. Guide: compute the left side first, then figure out what makes the right side match.`,
        { silent: true }
      );
    }
  }, [currentChallenge, balanceAnswer, currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Rewrite: check equation
  // -------------------------------------------------------------------------
  const handleCheckRewrite = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'rewrite') return;
    incrementAttempts();

    const acceptedForms = currentChallenge.acceptedForms ?? [];
    const builtStr = workspaceSlots.join(' ');
    const correct = matchesAcceptedForm(workspaceSlots, acceptedForms);

    if (correct) {
      setFeedback(`Great! ${builtStr} says the same thing a different way!`);
      setFeedbackType('success');
      setChallengeSolved(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student rewrote "${currentChallenge.originalEquation}" as "${builtStr}". `
        + `Congratulate and reinforce that = can go either way.`,
        { silent: true }
      );
    } else {
      const isValidMath = evaluateEquation(builtStr);
      // Check if it matches the original (not rewritten)
      const originalNorm = (currentChallenge.originalEquation ?? '').replace(/\s+/g, '');
      const builtNorm = builtStr.replace(/\s+/g, '');
      const isSameAsOriginal = originalNorm === builtNorm;

      setFeedback(
        isSameAsOriginal
          ? 'That\'s the same equation! Try writing it a different way.'
          : isValidMath
          ? 'That\'s true, but try a different form of the original equation.'
          : 'That doesn\'t make a true equation. Remember both sides of = must be equal!'
      );
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student wrote "${builtStr}" to rewrite "${currentChallenge.originalEquation}". `
        + `Accepted forms: ${acceptedForms.join(', ')}. `
        + `Attempt ${currentAttempts + 1}. Hint: the = sign can go in different places.`,
        { silent: true }
      );
    }
  }, [currentChallenge, workspaceSlots, currentAttempts, incrementAttempts, recordResult, sendText]);

  // -------------------------------------------------------------------------
  // Advance to next challenge
  // -------------------------------------------------------------------------
  const handleNext = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges complete — handled by evaluation submission below
      return;
    }
    // resetDomainState is handled by the useEffect on currentChallengeIndex
    if (currentChallenge) {
      const next = challenges[currentChallengeIndex + 1];
      if (next) {
        sendText(
          `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
          + `Type: ${next.type}. "${next.instruction}". Introduce briefly.`,
          { silent: true }
        );
      }
    }
  }, [advanceProgress, currentChallenge, challenges, currentChallengeIndex, sendText]);

  // -------------------------------------------------------------------------
  // Submit evaluation when all challenges complete
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation) return;

    const totalCorrect = challengeResults.filter(r => r.correct).length;
    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const overallPct = Math.round((totalCorrect / challenges.length) * 100);

    submitEvaluation(
      overallPct >= 60,
      overallPct,
      {
        type: 'equation-builder',
        totalChallenges: challenges.length,
        correctCount: totalCorrect,
        totalAttempts,
        averageAttemptsPerChallenge: totalAttempts / challenges.length,
        challengeBreakdown: challengeResults.map(r => ({
          challengeId: r.challengeId,
          correct: r.correct,
          attempts: r.attempts,
        })),
      },
    );

    // AI celebration
    const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
      + `Give encouraging phase-specific feedback. Reinforce the meaning of =.`,
      { silent: true }
    );
  }, [allChallengesComplete, hasSubmittedEvaluation, challengeResults, challenges, submitEvaluation, phaseResults, sendText]);

  // -------------------------------------------------------------------------
  // Compute overall score for display
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challengeResults.length) * 100);
  }, [allChallengesComplete, challengeResults]);

  // -------------------------------------------------------------------------
  // Render current challenge
  // -------------------------------------------------------------------------
  const renderChallenge = () => {
    if (!currentChallenge) return null;
    const isDisabled = hasSubmittedEvaluation || challengeSolved;

    switch (currentChallenge.type) {
      case 'build':
        return renderBuildChallenge(isDisabled);
      case 'missing-value':
        return renderMissingValueChallenge(isDisabled);
      case 'true-false':
        return renderTrueFalseChallenge(isDisabled);
      case 'balance':
        return renderBalanceChallenge(isDisabled);
      case 'rewrite':
        return renderRewriteChallenge(isDisabled);
      default:
        return null;
    }
  };

  const renderBuildChallenge = (disabled: boolean) => {
    const target = currentChallenge?.targetEquation ?? '';
    const targetTokenCount = parseEquationTokens(target).length;
    return (
      <div className="space-y-6">
        {/* Workspace */}
        <div className="bg-slate-800/30 rounded-2xl p-4 border border-white/5">
          <p className="text-xs text-slate-500 mb-2 text-center">Your equation</p>
          <BuildWorkspace
            slots={workspaceSlots}
            maxSlots={targetTokenCount}
            onRemoveSlot={handleRemoveSlot}
            disabled={disabled}
          />
        </div>

        {/* Tile pool */}
        <div>
          <p className="text-xs text-slate-500 mb-2 text-center">Available tiles</p>
          <TilePool tiles={poolTiles} onPickTile={handlePickTile} disabled={disabled} />
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <Button
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            onClick={handleClearWorkspace}
            disabled={disabled || workspaceSlots.length === 0}
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-200"
            onClick={handleCheckBuild}
            disabled={disabled || workspaceSlots.length === 0}
          >
            Check
          </Button>
        </div>
      </div>
    );
  };

  const renderMissingValueChallenge = (disabled: boolean) => {
    const eq = currentChallenge?.equation ?? '';
    const tokens = parseEquationTokens(eq);
    const blankIdx = currentChallenge?.missingPosition ?? tokens.indexOf('?');
    const options = currentChallenge?.options ?? [];

    return (
      <div className="space-y-6">
        {/* Display equation with blank */}
        <EquationDisplay parts={tokens} blankIndex={blankIdx} size="lg" />

        {/* MC options */}
        <div className="flex justify-center gap-3 flex-wrap">
          {options.map((opt) => (
            <Button
              key={opt}
              variant="ghost"
              className={`
                w-16 h-16 text-2xl font-bold rounded-xl border
                ${selectedOption === opt
                  ? 'bg-indigo-500/30 border-indigo-400/50 text-indigo-100'
                  : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => !disabled && setSelectedOption(opt)}
              disabled={disabled}
            >
              {opt}
            </Button>
          ))}
        </div>

        {/* Check */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-200"
            onClick={handleCheckMissingValue}
            disabled={disabled || selectedOption === null}
          >
            Check
          </Button>
        </div>
      </div>
    );
  };

  const renderTrueFalseChallenge = (disabled: boolean) => {
    const eq = currentChallenge?.displayEquation ?? '';
    const tokens = parseEquationTokens(eq);

    return (
      <div className="space-y-6">
        {/* Display equation */}
        <EquationDisplay parts={tokens} size="lg" />

        {/* True / False buttons */}
        <div className="flex justify-center gap-4">
          <Button
            variant="ghost"
            className={`
              px-8 py-4 text-lg font-bold rounded-xl border
              ${selectedTruthValue === true
                ? 'bg-emerald-500/30 border-emerald-400/50 text-emerald-100'
                : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={() => !disabled && setSelectedTruthValue(true)}
            disabled={disabled}
          >
            True
          </Button>
          <Button
            variant="ghost"
            className={`
              px-8 py-4 text-lg font-bold rounded-xl border
              ${selectedTruthValue === false
                ? 'bg-red-500/30 border-red-400/50 text-red-100'
                : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={() => !disabled && setSelectedTruthValue(false)}
            disabled={disabled}
          >
            False
          </Button>
        </div>

        {/* Check */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-200"
            onClick={handleCheckTrueFalse}
            disabled={disabled || selectedTruthValue === null}
          >
            Check
          </Button>
        </div>
      </div>
    );
  };

  const renderBalanceChallenge = (disabled: boolean) => {
    const leftTokens = parseEquationTokens(currentChallenge?.leftSide ?? '');
    const rightTokens = parseEquationTokens(currentChallenge?.rightSide ?? '');
    const blankIdx = rightTokens.indexOf('?');

    return (
      <div className="space-y-6">
        {/* Balance display: left = right */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            {leftTokens.map((t, i) => (
              <Tile key={`l-${i}`} value={t} disabled size="md" />
            ))}
          </div>
          <Tile value="=" disabled size="md" />
          <div className="flex items-center gap-1">
            {rightTokens.map((t, i) => (
              <Tile key={`r-${i}`} value={i === blankIdx ? '?' : t} disabled size="md" />
            ))}
          </div>
        </div>

        {/* Number input */}
        <div className="flex justify-center items-center gap-3">
          <span className="text-slate-400 text-sm">? =</span>
          <input
            type="number"
            min={0}
            max={maxNumber * 2}
            value={balanceAnswer}
            onChange={(e) => !disabled && setBalanceAnswer(e.target.value)}
            disabled={disabled}
            className="w-20 h-14 text-center text-2xl font-bold rounded-xl
                       bg-slate-800/50 border border-white/20 text-slate-100
                       focus:outline-none focus:ring-2 focus:ring-indigo-400/50
                       disabled:opacity-50"
            placeholder="?"
          />
        </div>

        {/* Check */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-200"
            onClick={handleCheckBalance}
            disabled={disabled || balanceAnswer === ''}
          >
            Check
          </Button>
        </div>
      </div>
    );
  };

  const renderRewriteChallenge = (disabled: boolean) => {
    const original = currentChallenge?.originalEquation ?? '';
    const originalTokens = parseEquationTokens(original);
    // For rewrite, show the original equation + workspace to build a new form
    return (
      <div className="space-y-6">
        {/* Original equation */}
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-2">Original equation</p>
          <EquationDisplay parts={originalTokens} size="md" />
        </div>

        {/* Workspace */}
        <div className="bg-slate-800/30 rounded-2xl p-4 border border-white/5">
          <p className="text-xs text-slate-500 mb-2 text-center">Build a different way to write it</p>
          <BuildWorkspace
            slots={workspaceSlots}
            maxSlots={originalTokens.length}
            onRemoveSlot={handleRemoveSlot}
            disabled={disabled}
          />
        </div>

        {/* Tile pool */}
        <div>
          <p className="text-xs text-slate-500 mb-2 text-center">Available tiles</p>
          <TilePool tiles={poolTiles} onPickTile={handlePickTile} disabled={disabled} />
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <Button
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            onClick={handleClearWorkspace}
            disabled={disabled || workspaceSlots.length === 0}
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-200"
            onClick={handleCheckRewrite}
            disabled={disabled || workspaceSlots.length === 0}
          >
            Check
          </Button>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  if (challenges.length === 0) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
        <CardContent className="p-6 text-center text-slate-400">
          No challenges available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
          <Badge variant="outline" className="border-white/20 text-slate-400 text-xs">
            {currentChallengeIndex + 1} / {challenges.length}
          </Badge>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Phase Summary — shown when all complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="You explored equations like a pro!"
            className="mb-6"
          />
        )}

        {/* Current challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Challenge type badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-white/20 text-slate-300 text-xs">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            </div>

            {/* Instruction */}
            <p className="text-slate-200 text-lg text-center font-medium">
              {currentChallenge.instruction}
            </p>

            {/* Challenge content */}
            {renderChallenge()}

            {/* Feedback */}
            {feedback && (
              <div className={`text-center text-sm font-medium p-3 rounded-xl ${
                feedbackType === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-400/20 text-emerald-300'
                  : 'bg-red-500/10 border border-red-400/20 text-red-300'
              }`}>
                {feedback}
              </div>
            )}

            {/* Next button — shown when current challenge is solved */}
            {challengeSolved && !allChallengesComplete && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-200"
                  onClick={handleNext}
                >
                  Next Challenge
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EquationBuilder;
