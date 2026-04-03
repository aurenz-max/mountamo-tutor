'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CoinCounterMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type CoinType = 'penny' | 'nickel' | 'dime' | 'quarter' | 'half-dollar' | 'dollar';

export interface CoinDef {
  type: CoinType;
  count: number;
}

export interface CoinCounterChallenge {
  id: string;
  type: 'identify' | 'count' | 'make-amount' | 'compare' | 'make-change';
  instruction: string;

  // identify — "Which coin is a nickel?"
  coins?: CoinDef[];
  targetCoin?: CoinType;
  options?: CoinType[];

  // count — "How much money is shown?"
  displayedCoins?: CoinDef[];
  correctTotal?: number; // in cents

  // make-amount — "Make 47¢ using coins"
  targetAmount?: number;
  availableCoins?: CoinType[];

  // compare — "Which group has more money?"
  groupA?: CoinDef[];
  groupB?: CoinDef[];
  correctGroup?: 'A' | 'B' | 'equal';

  // make-change — "You pay 75¢ with $1. What coins do you get back?"
  paidAmount?: number;
  itemCost?: number;
  correctChange?: number;

  hint?: string;
}

export interface CoinCounterData {
  title: string;
  description?: string;
  challenges: CoinCounterChallenge[];
  gradeBand?: 'K' | '1' | '2' | '3';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CoinCounterMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const COIN_VALUES: Record<CoinType, number> = {
  penny: 1,
  nickel: 5,
  dime: 10,
  quarter: 25,
  'half-dollar': 50,
  dollar: 100,
};

const COIN_DISPLAY: Record<CoinType, { emoji: string; label: string; color: string; size: string }> = {
  penny: { emoji: '🟤', label: '1¢', color: 'bg-amber-700/60 border-amber-600/80', size: 'w-10 h-10' },
  nickel: { emoji: '⚪', label: '5¢', color: 'bg-slate-400/40 border-slate-300/60', size: 'w-11 h-11' },
  dime: { emoji: '⚪', label: '10¢', color: 'bg-slate-300/40 border-slate-200/60', size: 'w-9 h-9' },
  quarter: { emoji: '⚪', label: '25¢', color: 'bg-slate-400/50 border-slate-300/70', size: 'w-12 h-12' },
  'half-dollar': { emoji: '⚪', label: '50¢', color: 'bg-slate-500/40 border-slate-400/60', size: 'w-14 h-14' },
  dollar: { emoji: '🟡', label: '$1', color: 'bg-yellow-500/40 border-yellow-400/60', size: 'w-14 h-14' },
};

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify: { label: 'Identify', icon: '🔍', accentColor: 'blue' },
  count: { label: 'Count', icon: '🔢', accentColor: 'emerald' },
  'make-amount': { label: 'Make Amount', icon: '🎯', accentColor: 'purple' },
  compare: { label: 'Compare', icon: '⚖️', accentColor: 'amber' },
  'make-change': { label: 'Make Change', icon: '💰', accentColor: 'orange' },
};

// ============================================================================
// Coin Visual Component
// ============================================================================

interface CoinVisualProps {
  type: CoinType;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  showValue?: boolean;
  className?: string;
}

const CoinVisual: React.FC<CoinVisualProps> = ({ type, onClick, selected, disabled, showValue = true, className = '' }) => {
  const display = COIN_DISPLAY[type];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        ${display.size} rounded-full ${display.color} border-2
        flex flex-col items-center justify-center
        transition-all duration-200 cursor-pointer select-none
        ${selected ? 'ring-2 ring-emerald-400 scale-110 shadow-lg shadow-emerald-500/30' : 'hover:scale-105'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <span className="text-xs font-bold text-white leading-none">{showValue ? display.label : ''}</span>
      <span className="text-[10px] text-white/70 leading-none mt-0.5 capitalize">{type === 'half-dollar' ? '50¢' : type}</span>
    </button>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function calcTotalCents(coins: CoinDef[]): number {
  return coins.reduce((sum, c) => sum + COIN_VALUES[c.type] * c.count, 0);
}

function expandCoins(coins: CoinDef[]): CoinType[] {
  const result: CoinType[] = [];
  for (const c of coins) {
    for (let i = 0; i < c.count; i++) result.push(c.type);
  }
  return result;
}

function formatCents(cents: number): string {
  if (cents >= 100) {
    const dollars = Math.floor(cents / 100);
    const remainder = cents % 100;
    return remainder > 0 ? `$${dollars}.${String(remainder).padStart(2, '0')}` : `$${dollars}.00`;
  }
  return `${cents}¢`;
}

// ============================================================================
// Props
// ============================================================================

interface CoinCounterProps {
  data: CoinCounterData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const CoinCounter: React.FC<CoinCounterProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = '1',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Challenge Progress (shared hooks) ──────────────────────────────
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

  // ── State ──────────────────────────────────────────────────────────
  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // identify mode
  const [selectedCoin, setSelectedCoin] = useState<CoinType | null>(null);

  // count mode
  const [countInput, setCountInput] = useState('');

  // make-amount mode
  const [placedCoins, setPlacedCoins] = useState<CoinType[]>([]);

  // compare mode
  const [selectedGroup, setSelectedGroup] = useState<'A' | 'B' | 'equal' | null>(null);

  // make-change mode
  const [changeInput, setChangeInput] = useState('');

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `coin-counter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Evaluation Hook ────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<CoinCounterMetrics>({
    primitiveType: 'coin-counter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ────────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'count',
    instruction: currentChallenge?.instruction ?? '',
    targetCoin: currentChallenge?.targetCoin,
    correctTotal: currentChallenge?.correctTotal,
    targetAmount: currentChallenge?.targetAmount,
    correctGroup: currentChallenge?.correctGroup,
    correctChange: currentChallenge?.correctChange,
    attemptNumber: currentAttempts + 1,
  }), [
    gradeBand, challenges.length, currentChallengeIndex, currentChallenge, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'coin-counter',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : `Grade ${gradeBand}`,
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Coin Counter activity for Grade ${gradeBand}. `
      + `${challenges.length} challenges. First: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}). `
      + `Introduce warmly: "Let's learn about coins and money!" Then read the first instruction.`,
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // ── Reset domain state on challenge change ─────────────────────────
  const resetDomainState = useCallback(() => {
    setSelectedCoin(null);
    setCountInput('');
    setPlacedCoins([]);
    setSelectedGroup(null);
    setChangeInput('');
    setFeedback('');
    setFeedbackType('');
  }, []);

  // ── Check Handlers ─────────────────────────────────────────────────

  const handleCheckIdentify = useCallback(() => {
    if (!currentChallenge || !selectedCoin) return;
    incrementAttempts();
    const correct = selectedCoin === currentChallenge.targetCoin;

    if (correct) {
      setFeedback(`Correct! That's a ${currentChallenge.targetCoin} — worth ${formatCents(COIN_VALUES[currentChallenge.targetCoin!])}.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student identified ${currentChallenge.targetCoin} correctly. `
        + `Congratulate: "Great job! You know your coins!"`,
        { silent: true },
      );
    } else {
      setFeedback(`That's a ${selectedCoin}, not a ${currentChallenge.targetCoin}. Try again!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedCoin}" but correct is "${currentChallenge.targetCoin}". `
        + `Hint about size/color: "${currentChallenge.hint || `Look at the coin's value and name.`}"`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, selectedCoin, incrementAttempts, sendText]);

  const handleCheckCount = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    const answer = parseInt(countInput, 10);
    const target = currentChallenge.correctTotal ?? 0;
    const correct = answer === target;

    if (correct) {
      setFeedback(`Yes! The total is ${formatCents(target)}!`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly counted ${formatCents(target)}. Congratulate briefly.`,
        { silent: true },
      );
    } else {
      setFeedback(`You said ${formatCents(answer || 0)}, but the total is different. Try counting again!`);
      setFeedbackType('error');
      const coins = currentChallenge.displayedCoins || [];
      const coinList = coins.map(c => `${c.count} ${c.type}${c.count > 1 ? 's' : ''}`).join(', ');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer}¢ but correct is ${target}¢. `
        + `Coins shown: ${coinList}. Hint: "Try skip-counting. Start with the biggest coins first."`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, countInput, incrementAttempts, sendText]);

  const handleCheckMakeAmount = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    const placed = placedCoins.reduce((sum, c) => sum + COIN_VALUES[c], 0);
    const target = currentChallenge.targetAmount ?? 0;
    const correct = placed === target;

    if (correct) {
      setFeedback(`Perfect! You made exactly ${formatCents(target)}!`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student made ${formatCents(target)} using ${placedCoins.length} coins. Celebrate!`,
        { silent: true },
      );
    } else {
      setFeedback(`You have ${formatCents(placed)} — ${placed < target ? 'you need more!' : 'that\'s too much!'}`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student placed ${formatCents(placed)} but needs ${formatCents(target)}. `
        + `Difference: ${formatCents(Math.abs(target - placed))}. Give a hint about which coin to add or remove.`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, placedCoins, incrementAttempts, sendText]);

  const handleCheckCompare = useCallback(() => {
    if (!currentChallenge || !selectedGroup) return;
    incrementAttempts();
    const correct = selectedGroup === currentChallenge.correctGroup;

    const aTotal = calcTotalCents(currentChallenge.groupA || []);
    const bTotal = calcTotalCents(currentChallenge.groupB || []);

    if (correct) {
      const explanation = currentChallenge.correctGroup === 'equal'
        ? `Both groups have ${formatCents(aTotal)}!`
        : `Group ${currentChallenge.correctGroup} has more (${formatCents(Math.max(aTotal, bTotal))} vs ${formatCents(Math.min(aTotal, bTotal))})!`;
      setFeedback(`Correct! ${explanation}`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student correctly compared groups. ${explanation}`, { silent: true });
    } else {
      setFeedback('Not quite. Count each group carefully!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedGroup}" but correct is "${currentChallenge.correctGroup}". `
        + `Group A = ${formatCents(aTotal)}, Group B = ${formatCents(bTotal)}. Hint: "Count each group separately."`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, selectedGroup, incrementAttempts, sendText]);

  const handleCheckMakeChange = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    const answer = parseInt(changeInput, 10);
    const target = currentChallenge.correctChange ?? 0;
    const correct = answer === target;

    if (correct) {
      setFeedback(`Yes! The change is ${formatCents(target)}!`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student correctly calculated ${formatCents(target)} change. Congratulate!`, { silent: true });
    } else {
      setFeedback(`Not quite. How much is ${formatCents(currentChallenge.paidAmount ?? 0)} minus ${formatCents(currentChallenge.itemCost ?? 0)}?`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer}¢ but change is ${target}¢. `
        + `Paid: ${currentChallenge.paidAmount}¢, Cost: ${currentChallenge.itemCost}¢. `
        + `Hint: "Subtract the cost from what you paid."`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, changeInput, incrementAttempts, sendText]);

  // ── Master Check Handler ───────────────────────────────────────────
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let correct = false;
    switch (currentChallenge.type) {
      case 'identify': correct = handleCheckIdentify() ?? false; break;
      case 'count': correct = handleCheckCount() ?? false; break;
      case 'make-amount': correct = handleCheckMakeAmount() ?? false; break;
      case 'compare': correct = handleCheckCompare() ?? false; break;
      case 'make-change': correct = handleCheckMakeChange() ?? false; break;
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    }
  }, [currentChallenge, currentAttempts, handleCheckIdentify, handleCheckCount, handleCheckMakeAmount, handleCheckCompare, handleCheckMakeChange, recordResult]);

  // ── Advance to Next Challenge ──────────────────────────────────────
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their money skills!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter((r) => r.correct).length;
        const score = Math.round((correctCount / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

        const metrics: CoinCounterMetrics = {
          type: 'coin-counter',
          accuracy: score,
          totalAttempts,
          challengesCompleted: correctCount,
          challengesTotal: challenges.length,
        };

        submitEvaluation(
          correctCount === challenges.length,
          score,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    // Reset domain state and announce next challenge
    resetDomainState();
    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). Read it to the student.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challengeResults, challenges, sendText,
    hasSubmittedEvaluation, submitEvaluation, resetDomainState, currentChallengeIndex,
  ]);

  // Auto-submit when all complete
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ── Computed ───────────────────────────────────────────────────────
  const isCurrentChallengeCorrect = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round(
      (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
    );
  }, [allChallengesComplete, challenges, challengeResults]);

  const placedTotal = useMemo(
    () => placedCoins.reduce((sum, c) => sum + COIN_VALUES[c], 0),
    [placedCoins],
  );

  // ── Render Helpers ─────────────────────────────────────────────────

  const renderCoinGroup = (coins: CoinDef[], label?: string) => {
    const expanded = expandCoins(coins);
    return (
      <div className="flex flex-col items-center gap-2">
        {label && <span className="text-slate-400 text-sm font-medium">{label}</span>}
        <div className="flex flex-wrap gap-2 justify-center p-3 rounded-xl bg-slate-800/30 border border-white/5 min-h-[60px]">
          {expanded.map((coin, i) => (
            <CoinVisual key={`${coin}-${i}`} type={coin} disabled />
          ))}
        </div>
      </div>
    );
  };

  const renderIdentifyChallenge = () => {
    if (!currentChallenge) return null;
    const coinOptions = currentChallenge.options || ['penny', 'nickel', 'dime', 'quarter'] as CoinType[];
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 justify-center">
          {coinOptions.map((coin) => (
            <CoinVisual
              key={coin}
              type={coin}
              selected={selectedCoin === coin}
              onClick={() => !isCurrentChallengeCorrect && setSelectedCoin(coin)}
              disabled={isCurrentChallengeCorrect}
              showValue={false}
            />
          ))}
        </div>
        <p className="text-slate-500 text-xs text-center">Tap the coin to select it</p>
      </div>
    );
  };

  const renderCountChallenge = () => {
    if (!currentChallenge) return null;
    const coins = currentChallenge.displayedCoins || [];
    return (
      <div className="space-y-4">
        {renderCoinGroup(coins)}
        <div className="flex items-center gap-3 justify-center">
          <span className="text-slate-400 text-sm">Total:</span>
          <input
            type="number"
            min={0}
            value={countInput}
            onChange={(e) => setCountInput(e.target.value)}
            disabled={isCurrentChallengeCorrect}
            placeholder="¢"
            className="w-24 bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-center text-slate-100 text-lg placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          />
          <span className="text-slate-400">cents</span>
        </div>
      </div>
    );
  };

  const renderMakeAmountChallenge = () => {
    if (!currentChallenge) return null;
    const available = currentChallenge.availableCoins || ['penny', 'nickel', 'dime', 'quarter'] as CoinType[];
    const target = currentChallenge.targetAmount ?? 0;

    return (
      <div className="space-y-4">
        <div className="text-center">
          <span className="text-2xl font-bold text-emerald-300">{formatCents(target)}</span>
          <p className="text-slate-500 text-xs mt-1">Target amount</p>
        </div>

        {/* Available coins to add */}
        <div className="flex flex-wrap gap-2 justify-center">
          {available.map((coin) => (
            <CoinVisual
              key={coin}
              type={coin}
              onClick={() => {
                if (!isCurrentChallengeCorrect) setPlacedCoins((prev) => [...prev, coin]);
              }}
              disabled={isCurrentChallengeCorrect}
            />
          ))}
        </div>
        <p className="text-slate-500 text-xs text-center">Tap a coin to add it</p>

        {/* Placed coins workspace */}
        <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5 min-h-[60px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs">Your coins:</span>
            <span className={`text-sm font-bold ${placedTotal === target ? 'text-emerald-300' : 'text-slate-300'}`}>
              {formatCents(placedTotal)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {placedCoins.map((coin, i) => (
              <CoinVisual
                key={`placed-${i}`}
                type={coin}
                onClick={() => {
                  if (!isCurrentChallengeCorrect) {
                    setPlacedCoins((prev) => {
                      const next = [...prev];
                      next.splice(i, 1);
                      return next;
                    });
                  }
                }}
                disabled={isCurrentChallengeCorrect}
                className="hover:ring-2 hover:ring-red-400/50"
              />
            ))}
            {placedCoins.length === 0 && (
              <span className="text-slate-600 text-sm py-2">Tap coins above to add them here</span>
            )}
          </div>
        </div>

        {!isCurrentChallengeCorrect && placedCoins.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPlacedCoins([])}
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 text-xs mx-auto block"
          >
            Clear All
          </Button>
        )}
      </div>
    );
  };

  const renderCompareChallenge = () => {
    if (!currentChallenge) return null;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => !isCurrentChallengeCorrect && setSelectedGroup('A')}
            disabled={isCurrentChallengeCorrect}
            className={`p-3 rounded-xl border-2 transition-all ${
              selectedGroup === 'A'
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-white/10 bg-slate-800/30 hover:border-white/20'
            }`}
          >
            {renderCoinGroup(currentChallenge.groupA || [], 'Group A')}
          </button>
          <button
            type="button"
            onClick={() => !isCurrentChallengeCorrect && setSelectedGroup('B')}
            disabled={isCurrentChallengeCorrect}
            className={`p-3 rounded-xl border-2 transition-all ${
              selectedGroup === 'B'
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-white/10 bg-slate-800/30 hover:border-white/20'
            }`}
          >
            {renderCoinGroup(currentChallenge.groupB || [], 'Group B')}
          </button>
        </div>
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => !isCurrentChallengeCorrect && setSelectedGroup('equal')}
            disabled={isCurrentChallengeCorrect}
            className={`text-sm ${
              selectedGroup === 'equal'
                ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400'
            }`}
          >
            They&apos;re Equal
          </Button>
        </div>
      </div>
    );
  };

  const renderMakeChangeChallenge = () => {
    if (!currentChallenge) return null;
    const paid = currentChallenge.paidAmount ?? 0;
    const cost = currentChallenge.itemCost ?? 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <span className="text-slate-400 text-xs block">You paid</span>
            <span className="text-xl font-bold text-blue-300">{formatCents(paid)}</span>
          </div>
          <span className="text-slate-600 text-xl">−</span>
          <div className="text-center">
            <span className="text-slate-400 text-xs block">Item costs</span>
            <span className="text-xl font-bold text-orange-300">{formatCents(cost)}</span>
          </div>
          <span className="text-slate-600 text-xl">=</span>
          <div className="text-center">
            <span className="text-slate-400 text-xs block">Change</span>
            <span className="text-xl font-bold text-emerald-300">?</span>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-center">
          <input
            type="number"
            min={0}
            value={changeInput}
            onChange={(e) => setChangeInput(e.target.value)}
            disabled={isCurrentChallengeCorrect}
            placeholder="¢"
            className="w-24 bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-center text-slate-100 text-lg placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
          <span className="text-slate-400">cents</span>
        </div>
      </div>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : `Grade ${gradeBand}`}
            </Badge>
            {challenges.length > 0 && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
                {currentChallengeIndex + 1}/{challenges.length}
              </Badge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase badges */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              const hasThisType = challenges.some((c) => c.type === type);
              if (!hasThisType) return null;
              const isActive = currentChallenge?.type === type;
              return (
                <Badge
                  key={type}
                  className={`text-xs ${
                    isActive
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Summary panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="Great work with coins and money!"
            className="mb-6"
          />
        )}

        {/* Current challenge */}
        {currentChallenge && !allChallengesComplete && (
          <div className="space-y-4">
            {/* Instruction */}
            <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5">
              <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            </div>

            {/* Challenge-type-specific UI */}
            {currentChallenge.type === 'identify' && renderIdentifyChallenge()}
            {currentChallenge.type === 'count' && renderCountChallenge()}
            {currentChallenge.type === 'make-amount' && renderMakeAmountChallenge()}
            {currentChallenge.type === 'compare' && renderCompareChallenge()}
            {currentChallenge.type === 'make-change' && renderMakeChangeChallenge()}

            {/* Feedback */}
            {feedback && (
              <div
                className={`p-3 rounded-xl text-sm font-medium text-center ${
                  feedbackType === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-400/30 text-emerald-300'
                    : feedbackType === 'error'
                    ? 'bg-red-500/10 border border-red-400/30 text-red-300'
                    : 'bg-blue-500/10 border border-blue-400/30 text-blue-300'
                }`}
              >
                {feedback}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              {!isCurrentChallengeCorrect ? (
                <Button
                  variant="ghost"
                  onClick={handleCheckAnswer}
                  disabled={
                    (currentChallenge.type === 'identify' && !selectedCoin) ||
                    (currentChallenge.type === 'count' && !countInput) ||
                    (currentChallenge.type === 'make-amount' && placedCoins.length === 0) ||
                    (currentChallenge.type === 'compare' && !selectedGroup) ||
                    (currentChallenge.type === 'make-change' && !changeInput)
                  }
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                >
                  Check Answer
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={advanceToNextChallenge}
                  className="bg-emerald-500/20 border border-emerald-400/50 hover:bg-emerald-500/30 text-emerald-300"
                >
                  {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'See Results'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {challenges.length === 0 && (
          <div className="text-center py-8">
            <span className="text-4xl">🪙</span>
            <p className="text-slate-400 mt-2">No challenges loaded</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CoinCounter;
