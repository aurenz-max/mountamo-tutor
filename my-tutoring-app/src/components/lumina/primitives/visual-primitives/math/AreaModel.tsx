'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type AreaModelMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SoundManager } from '../../../utils/SoundManager';

/**
 * Area Model — multi-challenge multiplication / area / perimeter / factoring.
 *
 * Session walks the student through 3-6 distinct factor pairs in the SAME eval
 * mode. Per PRD §6e (area-model post-mortem), per-challenge state must reset
 * on advance; the stale-state guard lives in submit handlers (§6a #8), not in
 * a completion effect.
 */

// ============================================================================
// Sizing helpers
// ============================================================================

// Log-scaled cell dimensions: proportional (300-part visibly wider than 8-part)
// but bounded so 3-digit factors don't overflow the max-w-6xl (~1152px) container.
// At part=1 → floor (100/80). At part=300 → ~258px wide / ~198px tall.
const cellWidthForPart = (part: number) =>
  Math.max(100, Math.log10(Math.max(1, part)) * 80 + 60);
const cellHeightForPart = (part: number) =>
  Math.max(80, Math.log10(Math.max(1, part)) * 60 + 50);

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type AreaModelChallengeType =
  | 'build_model'
  | 'find_area'
  | 'perimeter'
  | 'multiply'
  | 'factor';

export interface AreaModelChallenge {
  id: string;
  factor1Parts: number[];
  factor2Parts: number[];
  showPartialProducts: boolean;
  showDimensions: boolean;
  algebraicMode: boolean;
  highlightCell: [number, number] | null;
  labels?: {
    factor1?: string[];
    factor2?: string[];
  };
}

export interface AreaModelData {
  title: string;
  description: string;
  /** 1-6 challenges. Walked sequentially by the component. */
  challenges: AreaModelChallenge[];
  /** Eval mode pinned for this session (all challenges share one mode). */
  challengeType: AreaModelChallengeType;
  gradeLevel?: string;

  // Evaluation integration (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AreaModelMetrics>) => void;
}

interface AreaModelProps {
  data: AreaModelData;
  className?: string;
}

interface CellState {
  row: number;
  col: number;
  studentAnswer: string;
  isCorrect: boolean | null;
  attempts: number;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build_model: { label: 'Build Model', icon: '🔨', accentColor: 'blue' },
  find_area:   { label: 'Find Area',   icon: '📐', accentColor: 'blue' },
  perimeter:   { label: 'Perimeter',   icon: '🔲', accentColor: 'emerald' },
  multiply:    { label: 'Multiply',    icon: '✖️', accentColor: 'purple' },
  factor:      { label: 'Factor',      icon: '🔍', accentColor: 'pink' },
};

/** Per-challenge score: 100 first try, then -20 per extra attempt, floored at 20. */
function phaseScore(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.max(20, 100 - (attempts - 1) * 20);
}

// ============================================================================
// Component
// ============================================================================

const AreaModel: React.FC<AreaModelProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    challengeType: sessionChallengeType,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `area-model-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress ─────────────────────────────────────────
  const {
    currentIndex,
    results,
    isComplete,
    recordResult,
    advance,
  } = useChallengeProgress<AreaModelChallenge>({
    challenges,
    getChallengeId: (c) => c.id,
  });

  const currentChallenge = challenges[currentIndex] ?? null;
  const factor1Parts = currentChallenge?.factor1Parts ?? [10, 2];
  const factor2Parts = currentChallenge?.factor2Parts ?? [10, 3];
  const showPartialProducts = currentChallenge?.showPartialProducts ?? true;
  const showDimensions = currentChallenge?.showDimensions ?? true;
  const algebraicMode = currentChallenge?.algebraicMode ?? false;
  const highlightCell = currentChallenge?.highlightCell ?? null;
  const labels = currentChallenge?.labels;

  const isFactorMode = sessionChallengeType === 'factor';
  const isPerimeterMode = sessionChallengeType === 'perimeter';

  // ── Derived values for current challenge ───────────────────────
  const factor1Total = useMemo(() => factor1Parts.reduce((s, v) => s + v, 0), [factor1Parts]);
  const factor2Total = useMemo(() => factor2Parts.reduce((s, v) => s + v, 0), [factor2Parts]);
  const totalProduct = factor1Total * factor2Total;
  const totalCells = factor1Parts.length * factor2Parts.length;
  const totalPerimeter = 2 * (factor1Total + factor2Total);

  const partialProducts = useMemo(() => {
    const products: number[][] = [];
    for (let row = 0; row < factor2Parts.length; row++) {
      products[row] = [];
      for (let col = 0; col < factor1Parts.length; col++) {
        products[row][col] = factor1Parts[col] * factor2Parts[row];
      }
    }
    return products;
  }, [factor1Parts, factor2Parts]);

  // ── Per-challenge interaction state (resets on advance) ────────
  // Forward mode (build_model / find_area / multiply)
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(new Map());
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [sumInput, setSumInput] = useState('');
  const [sumAttempted, setSumAttempted] = useState(false);
  const [sumCorrect, setSumCorrect] = useState<boolean | null>(null);
  const [sumAttempts, setSumAttempts] = useState(0);

  // Factor mode
  const [factorTopInputs, setFactorTopInputs] = useState<string[]>([]);
  const [factorLeftInputs, setFactorLeftInputs] = useState<string[]>([]);
  const [factorChecked, setFactorChecked] = useState(false);
  const [factorTopCorrect, setFactorTopCorrect] = useState<(boolean | null)[]>([]);
  const [factorLeftCorrect, setFactorLeftCorrect] = useState<(boolean | null)[]>([]);
  const [factorAttempts, setFactorAttempts] = useState(0);

  // Perimeter mode
  const [perimeterInput, setPerimeterInput] = useState('');
  const [perimeterAttempts, setPerimeterAttempts] = useState(0);
  const [perimeterCorrect, setPerimeterCorrect] = useState<boolean | null>(null);

  // Shared per-challenge
  const [challengeHintCount, setChallengeHintCount] = useState(0);
  const [challengeDone, setChallengeDone] = useState(false);

  const recordedRef = useRef(false);
  const sessionCompleteFiredRef = useRef(false);

  // ── Reset every per-challenge slot when the active challenge changes ──
  // PRD §6c: missing any slot leaks state from challenge N into challenge N+1.
  useEffect(() => {
    if (!currentChallenge) return;
    setCellStates(new Map());
    setSelectedCell(null);
    setCurrentInput('');
    setSumInput('');
    setSumAttempted(false);
    setSumCorrect(null);
    setSumAttempts(0);
    setFactorTopInputs(currentChallenge.factor1Parts.map(() => ''));
    setFactorLeftInputs(currentChallenge.factor2Parts.map(() => ''));
    setFactorChecked(false);
    setFactorTopCorrect(currentChallenge.factor1Parts.map(() => null));
    setFactorLeftCorrect(currentChallenge.factor2Parts.map(() => null));
    setFactorAttempts(0);
    setPerimeterInput('');
    setPerimeterAttempts(0);
    setPerimeterCorrect(null);
    setChallengeHintCount(0);
    setChallengeDone(false);
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  // ── Evaluation hook ────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<AreaModelMetrics>({
    primitiveType: 'area-model',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── PhaseSummaryPanel: one row, aggregated by eval mode ────────
  const phaseResults = usePhaseResults({
    challenges,
    results,
    isComplete,
    getChallengeType: () => sessionChallengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) =>
      rs.length === 0
        ? 0
        : Math.round(rs.reduce((s, r) => s + Number(r.score ?? 0), 0) / rs.length),
  });

  // ── Per-challenge content match (stale-state guard, §6a #8) ────
  const stateMatchesChallenge = useCallback(
    (challenge: AreaModelChallenge | null): boolean => {
      if (!challenge) return false;
      // Match on the active challenge's factor totals against what derived
      // state thinks they are. If reset is still pending, these diverge.
      const expectedF1 = challenge.factor1Parts.reduce((s, v) => s + v, 0);
      const expectedF2 = challenge.factor2Parts.reduce((s, v) => s + v, 0);
      return expectedF1 === factor1Total && expectedF2 === factor2Total;
    },
    [factor1Total, factor2Total],
  );

  // ── Per-challenge completion (called from submit handlers) ─────
  const completeCurrentChallenge = useCallback(
    (
      correct: boolean,
      score: number,
      attempts: number,
      extras: Record<string, unknown> = {},
    ) => {
      if (!currentChallenge) return;
      if (recordedRef.current) return;
      if (!stateMatchesChallenge(currentChallenge)) return;
      recordedRef.current = true;
      setChallengeDone(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct,
        attempts,
        score,
        hintsUsed: challengeHintCount,
        ...extras,
      });
    },
    [currentChallenge, stateMatchesChallenge, recordResult, challengeHintCount],
  );

  // ── Session complete → aggregate metrics + submitEvaluation ────
  useEffect(() => {
    if (!isComplete) return;
    if (sessionCompleteFiredRef.current) return;
    if (challenges.length === 0) return;
    sessionCompleteFiredRef.current = true;

    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const correctCount = results.filter((r) => r.correct).length;
    const firstTryCount = results.filter((r) => Number(r.score ?? 0) === 100).length;
    const hintsViewed = results.filter((r) => Number(r.hintsUsed ?? 0) > 0).length;
    const overallAccuracy = Math.round(
      results.reduce((s, r) => s + Number(r.score ?? 0), 0) / Math.max(1, results.length),
    );
    const averageAttemptsPerChallenge =
      Math.round((totalAttempts / Math.max(1, results.length)) * 10) / 10;

    const metrics: AreaModelMetrics = {
      type: 'area-model',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge,
    };

    if (!hasSubmittedEvaluation) {
      const goalMet = correctCount === challenges.length;
      submitEvaluation(goalMet, overallAccuracy, metrics, {
        studentWork: {
          challengeCount: challenges.length,
          challengeType: sessionChallengeType,
          pairs: challenges.map((c) => ({
            factor1: c.factor1Parts,
            factor2: c.factor2Parts,
          })),
          scoresPerChallenge: challenges.map((c) => {
            const r = results.find((rr) => rr.challengeId === c.id);
            return Number(r?.score ?? 0);
          }),
        },
      });
    }
  }, [
    isComplete, results, challenges, sessionChallengeType,
    submitEvaluation, hasSubmittedEvaluation,
  ]);

  // ── Helpers ────────────────────────────────────────────────────
  const getCellKey = (row: number, col: number): string => `${row},${col}`;

  const getCellState = (row: number, col: number): CellState | undefined =>
    cellStates.get(getCellKey(row, col));

  const allCellsComplete = (): boolean => {
    for (let row = 0; row < factor2Parts.length; row++) {
      for (let col = 0; col < factor1Parts.length; col++) {
        if (!getCellState(row, col)?.isCorrect) return false;
      }
    }
    return true;
  };

  // ── Forward-mode handlers (build_model / find_area / multiply) ──
  const handleCellClick = (row: number, col: number) => {
    if (challengeDone || isFactorMode || isPerimeterMode) return;
    const cellState = getCellState(row, col);
    if (cellState?.isCorrect) return;
    SoundManager.tap();
    setSelectedCell([row, col]);
    setCurrentInput(cellState?.studentAnswer || '');
  };

  const handleCellSubmit = () => {
    if (!selectedCell || challengeDone) return;
    const [row, col] = selectedCell;
    const cellKey = getCellKey(row, col);
    const correctAnswer = factor1Parts[col] * factor2Parts[row];
    const studentAnswerNum = parseInt(currentInput, 10);
    const isCorrect = studentAnswerNum === correctAnswer;

    const existingState = getCellState(row, col);
    const newState: CellState = {
      row,
      col,
      studentAnswer: currentInput,
      isCorrect,
      attempts: (existingState?.attempts || 0) + 1,
    };

    const next = new Map(cellStates);
    next.set(cellKey, newState);
    setCellStates(next);

    if (isCorrect) {
      SoundManager.playCorrect();
      setSelectedCell(null);
      setCurrentInput('');
    } else {
      SoundManager.playIncorrect();
    }
  };

  const handleSumSubmit = () => {
    if (challengeDone || !currentChallenge) return;
    if (!sumInput) return;

    const studentSumNum = parseInt(sumInput, 10);
    const correctSum = totalProduct;
    const isCorrect = studentSumNum === correctSum;

    const nextSumAttempts = sumAttempts + 1;
    setSumAttempts(nextSumAttempts);
    setSumAttempted(true);
    setSumCorrect(isCorrect);

    if (!isCorrect) {
      SoundManager.playIncorrect();
      return; // let the student try again
    }
    SoundManager.playCorrect();

    // All cells were already correct (sum button is only enabled then).
    let cellAttempts = 0;
    let correctCells = 0;
    cellStates.forEach((s) => {
      cellAttempts += s.attempts;
      if (s.isCorrect) correctCells++;
    });

    const partialAccuracy = totalCells > 0 ? correctCells / totalCells : 0;
    const cellsFirstTry =
      correctCells === totalCells && cellAttempts === totalCells;
    const sumFirstTry = nextSumAttempts === 1;
    const isPerfect = cellsFirstTry && sumFirstTry;

    // Score: weighted 70% partials × cell-attempt decay + 30% sum-attempt decay.
    const avgCellAttempts = totalCells > 0 ? cellAttempts / totalCells : 1;
    const cellComponent = partialAccuracy * phaseScore(Math.round(avgCellAttempts));
    const sumComponent = phaseScore(nextSumAttempts);
    const score = Math.round((cellComponent * 0.7) + (sumComponent * 0.3));

    completeCurrentChallenge(true, isPerfect ? 100 : score, cellAttempts + nextSumAttempts, {
      cellAttempts,
      sumAttempts: nextSumAttempts,
    });
  };

  // ── Perimeter handler ──────────────────────────────────────────
  const handlePerimeterSubmit = () => {
    if (challengeDone || !currentChallenge) return;
    if (!perimeterInput) return;

    const studentPerimeter = parseInt(perimeterInput, 10);
    const isCorrect = studentPerimeter === totalPerimeter;
    const nextAttempts = perimeterAttempts + 1;

    setPerimeterCorrect(isCorrect);
    setPerimeterAttempts(nextAttempts);

    if (!isCorrect) {
      SoundManager.playIncorrect();
      return;
    }
    SoundManager.playCorrect();

    const score = phaseScore(nextAttempts);
    completeCurrentChallenge(true, score, nextAttempts, {
      perimeterAttempts: nextAttempts,
    });
  };

  // ── Factor handlers ────────────────────────────────────────────
  const handleFactorTopChange = (index: number, value: string) => {
    const next = [...factorTopInputs];
    next[index] = value;
    setFactorTopInputs(next);
    if (factorChecked) {
      setFactorChecked(false);
      setFactorTopCorrect(factor1Parts.map(() => null));
      setFactorLeftCorrect(factor2Parts.map(() => null));
    }
  };

  const handleFactorLeftChange = (index: number, value: string) => {
    const next = [...factorLeftInputs];
    next[index] = value;
    setFactorLeftInputs(next);
    if (factorChecked) {
      setFactorChecked(false);
      setFactorTopCorrect(factor1Parts.map(() => null));
      setFactorLeftCorrect(factor2Parts.map(() => null));
    }
  };

  const handleFactorCheck = () => {
    if (challengeDone || !currentChallenge) return;
    const nextAttempts = factorAttempts + 1;
    setFactorAttempts(nextAttempts);

    const topNums = factorTopInputs.map((v) => parseInt(v, 10));
    const leftNums = factorLeftInputs.map((v) => parseInt(v, 10));

    const topResults = topNums.map((n, i) => n === factor1Parts[i]);
    const leftResults = leftNums.map((n, i) => n === factor2Parts[i]);
    setFactorTopCorrect(topResults);
    setFactorLeftCorrect(leftResults);
    setFactorChecked(true);

    const allCorrect = topResults.every(Boolean) && leftResults.every(Boolean);
    if (!allCorrect) {
      SoundManager.playIncorrect();
      return;
    }
    SoundManager.playCorrect();

    const score = phaseScore(nextAttempts);
    completeCurrentChallenge(true, score, nextAttempts, {
      factorAttempts: nextAttempts,
    });
  };

  // ── Hints (per-challenge counter) ──────────────────────────────
  const handleShowHint = () => {
    if (challengeDone) return;
    setChallengeHintCount((c) => c + 1);
  };

  // ── Advance to next challenge ──────────────────────────────────
  const handleNextChallenge = () => {
    advance();
  };

  // ── UI helpers ─────────────────────────────────────────────────
  const formatLabel = (value: number, labelArray?: string[], index?: number): string => {
    if (labelArray && index !== undefined) return labelArray[index];
    return String(value);
  };

  const formatCellEquation = (row: number, col: number): string => {
    const f1 = formatLabel(factor1Parts[col], labels?.factor1, col);
    const f2 = formatLabel(factor2Parts[row], labels?.factor2, row);
    return `${f1} × ${f2}`;
  };

  const getCellColor = (row: number, col: number): string => {
    if (isFactorMode) {
      if (highlightCell && highlightCell[0] === row && highlightCell[1] === col) {
        return 'bg-yellow-500/40 border-yellow-400';
      }
      const colorIndex = (row + col) % 4;
      const colors = [
        'bg-slate-500/20 border-slate-400/50',
        'bg-purple-500/20 border-purple-400/50',
        'bg-pink-500/20 border-pink-400/50',
        'bg-indigo-500/20 border-indigo-400/50',
      ];
      return colors[colorIndex];
    }

    const state = getCellState(row, col);
    if (state?.isCorrect) return 'bg-green-500/30 border-green-400';
    if (state && !state.isCorrect) return 'bg-red-500/30 border-red-400';
    if (selectedCell && selectedCell[0] === row && selectedCell[1] === col) {
      return 'bg-blue-500/40 border-blue-400 ring-2 ring-blue-400';
    }
    if (highlightCell && highlightCell[0] === row && highlightCell[1] === col) {
      return 'bg-yellow-500/40 border-yellow-400';
    }
    const colorIndex = (row + col) % 4;
    const colors = [
      'bg-slate-500/20 border-slate-400/50',
      'bg-purple-500/20 border-purple-400/50',
      'bg-pink-500/20 border-pink-400/50',
      'bg-indigo-500/20 border-indigo-400/50',
    ];
    return colors[colorIndex];
  };

  const getFactorInputStyle = (isCorrect: boolean | null): string => {
    if (isCorrect === null) return 'border-slate-600 focus:border-blue-400';
    if (isCorrect) return 'border-green-400 bg-green-500/10';
    return 'border-red-400 bg-red-500/10';
  };

  // Auto-focus input when cell selected
  useEffect(() => {
    if (selectedCell) {
      const input = document.getElementById('cell-input');
      input?.focus();
    }
  }, [selectedCell]);

  // ── Derived UI state ───────────────────────────────────────────
  const correctCells = Array.from(cellStates.values()).filter((s) => s.isCorrect).length;
  const showSumSection = !isFactorMode && !isPerimeterMode && allCellsComplete();
  const allFactorInputsFilled =
    factorTopInputs.every((v) => v.trim() !== '') &&
    factorLeftInputs.every((v) => v.trim() !== '');
  const factorAllCorrect =
    factorChecked &&
    factorTopCorrect.every((v) => v === true) &&
    factorLeftCorrect.every((v) => v === true);
  const hasNextChallenge = currentIndex + 1 < challenges.length;

  // ── Empty state ────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="max-w-6xl mx-auto p-8 text-center text-slate-400">
          No area model challenges available.
        </div>
      </div>
    );
  }

  // ── Session summary ────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className={`w-full max-w-6xl mx-auto my-16 ${className || ''}`}>
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score}
          durationMs={elapsedMs}
          heading="Area Model Session Complete"
          celebrationMessage={
            results.every((r) => r.correct)
              ? 'Perfect! You solved every problem.'
              : 'Great work — review where you struggled and try again next time.'
          }
        />
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Area Model</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 text-xs font-mono uppercase tracking-wider">
              {isFactorMode
                ? 'Factor Discovery'
                : isPerimeterMode
                  ? 'Perimeter Practice'
                  : algebraicMode
                    ? 'Algebraic Multiplication'
                    : 'Interactive Multiplication'}
            </Badge>
          </div>
        </div>
      </div>

      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
        <div
          className="absolute inset-0 opacity-10 rounded-3xl"
          style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <CardHeader className="relative z-10 text-center">
          <CardTitle className="text-xl text-slate-100">{title}</CardTitle>
          <CardDescription className="text-slate-300">{description}</CardDescription>
        </CardHeader>

        <CardContent className="relative z-10">
          {/* Session progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {challenges.map((c, idx) => {
              const r = results.find((rr) => rr.challengeId === c.id);
              const isDone = !!r;
              const isCurrent = idx === currentIndex && !challengeDone;
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-center rounded-full border text-xs font-mono w-8 h-8 ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isCurrent
                        ? 'bg-blue-500/20 text-blue-200 border-blue-400/50 shadow-lg scale-105'
                        : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {idx + 1}
                </div>
              );
            })}
            <span className="ml-3 text-xs font-mono uppercase tracking-wider text-slate-400">
              Problem {currentIndex + 1} / {challenges.length}
            </span>
          </div>

          {/* Forward mode progress */}
          {!isFactorMode && !isPerimeterMode && !challengeDone && (
            <div className="mb-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Progress</span>
                <span className="text-sm font-mono text-blue-400">
                  {correctCells} / {totalCells} cells complete
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(correctCells / totalCells) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Perimeter mode progress */}
          {isPerimeterMode && !challengeDone && (
            <div className="mb-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">
                  Find the perimeter of this rectangle
                </span>
                <span className="text-sm font-mono text-emerald-400">
                  {factor1Total} × {factor2Total}
                </span>
              </div>
              {perimeterAttempts > 0 && (
                <div className="text-xs text-slate-500 mt-1">
                  Attempts: {perimeterAttempts}
                </div>
              )}
            </div>
          )}

          {/* Factor mode progress */}
          {isFactorMode && !challengeDone && (
            <div className="mb-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">
                  Find the dimensions that produce these partial products
                </span>
                <span className="text-sm font-mono text-purple-400">
                  Total area = {totalProduct}
                </span>
              </div>
              {factorAttempts > 0 && (
                <div className="text-xs text-slate-500 mt-1">
                  Attempts: {factorAttempts}
                </div>
              )}
            </div>
          )}

          {/* Equation Display */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-3 text-2xl font-bold font-mono">
              {isFactorMode ? (
                <>
                  <span className="text-blue-300">?</span>
                  <span className="text-slate-500">&times;</span>
                  <span className="text-purple-300">?</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-pink-300">{totalProduct}</span>
                </>
              ) : isPerimeterMode ? (
                <>
                  <span className="text-slate-400 text-lg">Perimeter =</span>
                  <span className="text-slate-500">2 &times; (</span>
                  <span className="text-blue-300">{factor1Total}</span>
                  <span className="text-slate-500">+</span>
                  <span className="text-purple-300">{factor2Total}</span>
                  <span className="text-slate-500">) =</span>
                  <span className="text-pink-300">?</span>
                </>
              ) : (
                <>
                  {(algebraicMode || factor1Parts.length > 1) && <span className="text-slate-500">(</span>}
                  <span className="text-blue-300">
                    {labels?.factor1
                      ? labels.factor1.join(' + ')
                      : factor1Parts.length > 1
                        ? factor1Parts.join(' + ')
                        : factor1Parts[0]}
                  </span>
                  {(algebraicMode || factor1Parts.length > 1) && <span className="text-slate-500">)</span>}
                  <span className="text-slate-500">&times;</span>
                  {(algebraicMode || factor2Parts.length > 1) && <span className="text-slate-500">(</span>}
                  <span className="text-purple-300">
                    {labels?.factor2
                      ? labels.factor2.join(' + ')
                      : factor2Parts.length > 1
                        ? factor2Parts.join(' + ')
                        : factor2Parts[0]}
                  </span>
                  {(algebraicMode || factor2Parts.length > 1) && <span className="text-slate-500">)</span>}
                  <span className="text-slate-500">=</span>
                  <span className="text-pink-300">?</span>
                </>
              )}
            </div>
          </div>

          {/* Area Model Grid */}
          <div className="flex justify-center items-center">
            <div className="relative inline-block">
              {/* Top dimension labels / inputs */}
              {isFactorMode ? (
                <div className="flex mb-2 ml-16">
                  {factor1Parts.map((part, index) => (
                    <div
                      key={`top-input-${index}`}
                      className="flex items-center justify-center"
                      style={{ width: `${cellWidthForPart(part)}px` }}
                    >
                      <input
                        type="number"
                        value={factorTopInputs[index] ?? ''}
                        onChange={(e) => handleFactorTopChange(index, e.target.value)}
                        disabled={challengeDone || factorAllCorrect}
                        className={`w-16 px-2 py-1 text-center font-mono font-bold text-sm rounded-lg
                          bg-slate-700/80 text-blue-300 border ${getFactorInputStyle(factorTopCorrect[index] ?? null)}
                          focus:outline-none focus:ring-1 focus:ring-blue-400
                          disabled:opacity-60`}
                        placeholder="?"
                      />
                    </div>
                  ))}
                </div>
              ) : showDimensions ? (
                <div className="flex mb-2 ml-16">
                  {factor1Parts.map((part, index) => (
                    <div
                      key={`top-${index}`}
                      className="flex items-center justify-center text-blue-300 font-mono font-bold text-sm"
                      style={{ width: `${cellWidthForPart(part)}px` }}
                    >
                      {formatLabel(part, labels?.factor1, index)}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex">
                {/* Left dimension labels / inputs */}
                {isFactorMode ? (
                  <div className="flex flex-col mr-2 justify-start">
                    {factor2Parts.map((part, index) => (
                      <div
                        key={`left-input-${index}`}
                        className="flex items-center justify-center"
                        style={{ height: `${cellHeightForPart(part)}px` }}
                      >
                        <input
                          type="number"
                          value={factorLeftInputs[index] ?? ''}
                          onChange={(e) => handleFactorLeftChange(index, e.target.value)}
                          disabled={challengeDone || factorAllCorrect}
                          className={`w-16 px-2 py-1 text-center font-mono font-bold text-sm rounded-lg
                            bg-slate-700/80 text-purple-300 border ${getFactorInputStyle(factorLeftCorrect[index] ?? null)}
                            focus:outline-none focus:ring-1 focus:ring-purple-400
                            disabled:opacity-60`}
                          placeholder="?"
                        />
                      </div>
                    ))}
                  </div>
                ) : showDimensions ? (
                  <div className="flex flex-col mr-2 justify-start">
                    {factor2Parts.map((part, index) => (
                      <div
                        key={`left-${index}`}
                        className="flex items-center justify-center text-purple-300 font-mono font-bold text-sm"
                        style={{ height: `${cellHeightForPart(part)}px` }}
                      >
                        {formatLabel(part, labels?.factor2, index)}
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Grid */}
                <div
                  className="grid gap-2 transition-all duration-500"
                  style={{
                    gridTemplateColumns: `repeat(${factor1Parts.length}, minmax(100px, 1fr))`,
                  }}
                >
                  {factor2Parts.map((_, rowIndex) =>
                    factor1Parts.map((_, colIndex) => {
                      const cellState = getCellState(rowIndex, colIndex);
                      const isSelected =
                        selectedCell &&
                        selectedCell[0] === rowIndex &&
                        selectedCell[1] === colIndex;

                      return (
                        <div
                          key={`cell-${rowIndex}-${colIndex}`}
                          className={`
                            border-2 rounded-lg flex flex-col items-center justify-center p-4
                            transition-all duration-300
                            ${isFactorMode || isPerimeterMode ? '' : 'cursor-pointer'}
                            ${getCellColor(rowIndex, colIndex)}
                            ${!isFactorMode && !isPerimeterMode && !cellState?.isCorrect && !challengeDone ? 'hover:scale-105' : ''}
                          `}
                          style={{
                            minHeight: `${cellHeightForPart(factor2Parts[rowIndex])}px`,
                            minWidth: `${cellWidthForPart(factor1Parts[colIndex])}px`,
                          }}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                        >
                          {isPerimeterMode ? null : isFactorMode ? (
                            <div className="text-center">
                              <div className="text-white font-mono font-bold text-lg">
                                {partialProducts[rowIndex][colIndex]}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-xs text-slate-400 mb-2">
                                {formatCellEquation(rowIndex, colIndex)}
                              </div>

                              {cellState?.isCorrect && (
                                <div className="text-center">
                                  <div className="text-white font-mono font-bold text-lg">
                                    {cellState.studentAnswer}
                                  </div>
                                  <div className="text-xs text-green-400 mt-1">&#x2713;</div>
                                </div>
                              )}

                              {cellState && !cellState.isCorrect && (
                                <div className="text-center">
                                  <div className="text-white font-mono font-bold text-lg line-through opacity-50">
                                    {cellState.studentAnswer}
                                  </div>
                                  <div className="text-xs text-red-400 mt-1">Try again</div>
                                </div>
                              )}

                              {!cellState && !isSelected && (
                                <div className="text-slate-500 text-lg">?</div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cell input — forward mode */}
          {!isFactorMode && !isPerimeterMode && selectedCell && !challengeDone && (
            <Card className="mt-8 bg-blue-900/20 border-blue-500/30">
              <CardHeader>
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-blue-400">
                  Step 1: Calculate Partial Product
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    What is {formatCellEquation(selectedCell[0], selectedCell[1])}?
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="cell-input"
                      type="number"
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCellSubmit();
                      }}
                      className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
                      placeholder="Enter answer"
                      disabled={challengeDone}
                    />
                    <Button
                      onClick={handleCellSubmit}
                      disabled={!currentInput || challengeDone}
                      variant="ghost"
                      className="bg-blue-500/80 text-white border border-blue-400/30 hover:bg-blue-500"
                    >
                      Check
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sum section — forward mode */}
          {showSumSection && !challengeDone && (
            <Card className="mt-8 bg-purple-900/20 border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-purple-400">
                  Step 2: Add All Partial Products
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center font-mono text-slate-300">
                  {Array.from(cellStates.values())
                    .filter((s) => s.isCorrect)
                    .map((s) => s.studentAnswer)
                    .join(' + ')}
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    What is the sum of all partial products?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={sumInput}
                      onChange={(e) => setSumInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSumSubmit();
                      }}
                      className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
                      placeholder="Enter sum"
                    />
                    <Button
                      onClick={handleSumSubmit}
                      disabled={!sumInput || challengeDone}
                      variant="ghost"
                      className="bg-purple-500/80 text-white border border-purple-400/30 hover:bg-purple-500"
                    >
                      Submit Final Answer
                    </Button>
                  </div>
                  {sumAttempted && sumCorrect === false && (
                    <div className="mt-2 text-sm text-red-400">
                      Not quite. Double-check your addition of the partial products.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Perimeter input */}
          {isPerimeterMode && !challengeDone && (
            <Card className="mt-8 bg-emerald-900/20 border-emerald-500/30">
              <CardHeader>
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-emerald-400">
                  Find the Perimeter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center font-mono text-slate-300">
                  The rectangle has sides of {factor1Total} and {factor2Total}.
                  <br />
                  Perimeter = {factor1Total} + {factor2Total} + {factor1Total} + {factor2Total}
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    What is the perimeter of this rectangle?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={perimeterInput}
                      onChange={(e) => {
                        setPerimeterInput(e.target.value);
                        if (perimeterCorrect !== null) setPerimeterCorrect(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handlePerimeterSubmit();
                      }}
                      className={`flex-1 px-4 py-2 bg-slate-700 border rounded-lg text-white font-mono ${
                        perimeterCorrect === true
                          ? 'border-green-400'
                          : perimeterCorrect === false
                            ? 'border-red-400'
                            : 'border-slate-600'
                      }`}
                      placeholder="Enter perimeter"
                      disabled={challengeDone}
                    />
                    <Button
                      onClick={handlePerimeterSubmit}
                      disabled={!perimeterInput || challengeDone}
                      variant="ghost"
                      className="bg-emerald-500/80 text-white border border-emerald-400/30 hover:bg-emerald-500"
                    >
                      Submit
                    </Button>
                  </div>
                  {perimeterCorrect === false && !challengeDone && (
                    <div className="mt-2 text-sm text-red-400">
                      Not quite. Remember: the perimeter is the total distance around the rectangle. Try adding all four sides.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Factor mode: Check Factors button */}
          {isFactorMode && !challengeDone && !factorAllCorrect && (
            <div className="mt-8 flex justify-center">
              <Button
                onClick={handleFactorCheck}
                disabled={!allFactorInputsFilled}
                variant="ghost"
                className="bg-purple-500/80 text-white border border-purple-400/30 hover:bg-purple-500 px-8 py-3 text-lg"
              >
                Check My Factors
              </Button>
            </div>
          )}

          {/* Factor mode: hint after wrong attempt */}
          {isFactorMode && factorChecked && !factorAllCorrect && !challengeDone && (
            <Card className="mt-6 bg-yellow-900/20 border-yellow-500/30">
              <CardContent className="pt-6">
                <p className="text-sm text-yellow-300">
                  Not quite! Look at the partial products in the grid. Each cell equals
                  its column header &times; its row header. Try using one cell to figure out
                  a dimension, then check the others.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Between-challenge interstitial: shown after the current challenge is done */}
          {challengeDone && (
            <Card className="mt-8 bg-green-900/20 border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-green-400">
                    &#x2713; Problem {currentIndex + 1} complete!
                  </h4>
                  {hasNextChallenge ? (
                    <Button
                      onClick={handleNextChallenge}
                      variant="ghost"
                      className="bg-blue-500/80 text-white border border-blue-400/30 hover:bg-blue-500"
                    >
                      Next Problem →
                    </Button>
                  ) : (
                    <span className="text-sm text-slate-400 font-mono uppercase tracking-wider">
                      Last problem
                    </span>
                  )}
                </div>

                <div className="text-sm text-slate-300 space-y-2">
                  {isPerimeterMode ? (
                    <p>
                      Perimeter = 2 &times; ({factor1Total} + {factor2Total}) ={' '}
                      <span className="font-bold text-white">{totalPerimeter}</span>
                    </p>
                  ) : isFactorMode ? (
                    <p>
                      The factors are ({factor1Parts.join(' + ')}) &times; ({factor2Parts.join(' + ')})
                      = {factor1Total} &times; {factor2Total} ={' '}
                      <span className="font-bold text-white">{totalProduct}</span>
                    </p>
                  ) : (
                    <p>
                      You found <span className="font-bold text-white">{totalProduct}</span> from{' '}
                      {factor1Total} &times; {factor2Total}.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Accordion type="single" collapsible className="mt-8" onValueChange={(v) => {
            if (v === 'instructions') handleShowHint();
          }}>
            <AccordionItem value="instructions" className="border-white/10 bg-slate-800/30 rounded-xl px-6">
              <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
                <span className="text-sm font-mono uppercase tracking-wider text-slate-400">
                  How to Use This Tool
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-4">
                {isFactorMode ? (
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-400 mt-0.5">1</Badge>
                      <span>Look at the partial products shown in each cell of the grid</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-400 mt-0.5">2</Badge>
                      <span>Figure out what numbers go on top and on the left side</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-400 mt-0.5">3</Badge>
                      <span>Each cell = its column header &times; its row header</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-400 mt-0.5">4</Badge>
                      <span>Type your answers into the input fields and click &quot;Check My Factors&quot;</span>
                    </li>
                  </ul>
                ) : isPerimeterMode ? (
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 mt-0.5">1</Badge>
                      <span>Look at the two side lengths labeled on the rectangle</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 mt-0.5">2</Badge>
                      <span>Perimeter is the total distance around the outside of a shape</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 mt-0.5">3</Badge>
                      <span>Rectangle shortcut: Perimeter = 2 &times; (length + width)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 mt-0.5">4</Badge>
                      <span>Type your answer and press Submit</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 mt-0.5">1</Badge>
                      <span>Click on each cell and calculate the partial product (e.g., 30 &times; 4 = 120)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 mt-0.5">2</Badge>
                      <span>Complete all cells to unlock Step 2</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 mt-0.5">3</Badge>
                      <span>Add all your partial products together to get the final answer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 mt-0.5">4</Badge>
                      <span>This demonstrates the Distributive Property of multiplication</span>
                    </li>
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default AreaModel;
