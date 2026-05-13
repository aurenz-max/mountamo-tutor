'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePrimitiveEvaluation, type FactorTreeMetrics, type PrimitiveEvaluationResult } from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

export interface TreeNode {
  value: number;
  factors?: [number, number];
  isPrime?: boolean;
}

export interface FactorTreeChallenge {
  id: string;
  rootValue: number;
}

export interface FactorTreeData {
  title: string;
  description: string;
  /** 3-6 factor-tree challenges, walked sequentially. */
  challenges: FactorTreeChallenge[];
  highlightPrimes?: boolean;
  showExponentForm?: boolean;
  guidedMode?: boolean;
  allowReset?: boolean;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FactorTreeMetrics>) => void;
}

interface FactorTreeProps {
  data: FactorTreeData;
  className?: string;
}

// ============================================================================
// Pure helpers (no hooks)
// ============================================================================

const isPrime = (n: number): boolean => {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false;
  }
  return true;
};

const getFactorPairs = (n: number): Array<[number, number]> => {
  const pairs: Array<[number, number]> = [];
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) pairs.push([i, n / i]);
  }
  return pairs;
};

const getLeavesFromTree = (t: Map<string, TreeNode>): number[] => {
  const leaves: number[] = [];
  t.forEach((node) => { if (!node.factors) leaves.push(node.value); });
  return leaves.sort((a, b) => a - b);
};

const allLeavesPrime = (t: Map<string, TreeNode>): boolean =>
  getLeavesFromTree(t).every(isPrime);

const getPrimeFactorization = (t: Map<string, TreeNode>): string => {
  const leaves = getLeavesFromTree(t);
  const counts = new Map<number, number>();
  leaves.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([prime, count]) => (count === 1 ? `${prime}` : `${prime}^${count}`))
    .join(' × ');
};

const optimalSplitsFor = (n: number): number => {
  let count = 0;
  let temp = n;
  for (let i = 2; i <= temp; i++) {
    while (temp % i === 0) { count++; temp /= i; }
  }
  return Math.max(0, count - 1);
};

const treeDepth = (t: Map<string, TreeNode>, nodeId: string): number => {
  const node = t.get(nodeId);
  if (!node || !node.factors) return 0;
  return 1 + Math.max(
    treeDepth(t, `${nodeId}-0`),
    treeDepth(t, `${nodeId}-1`),
  );
};

// ============================================================================
// Phase config (single phase — same challenge type across the session)
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  factor: { label: 'Factor', icon: '🌳', accentColor: 'amber' },
};

const RETRY_PENALTY = 0.15;

// ============================================================================
// Component
// ============================================================================

const FactorTree: React.FC<FactorTreeProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    highlightPrimes = true,
    showExponentForm = true,
    guidedMode = true,
    allowReset = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Challenge progress (shared hooks) ──────────────────────────────────────
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
    getChallengeType: () => 'factor',
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;
  const currentRootValue = currentChallenge?.rootValue ?? 0;

  // ── Per-challenge tree state ──────────────────────────────────────────────
  const [tree, setTree] = useState<Map<string, TreeNode>>(
    () => new Map([['0', { value: currentRootValue, isPrime: isPrime(currentRootValue) }]])
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [factorInput, setFactorInput] = useState<{ factor1: string; factor2: string }>({ factor1: '', factor2: '' });
  const [error, setError] = useState<string | null>(null);

  // Per-challenge tracking (resets each challenge)
  const [perChallengeInvalidSplits, setPerChallengeInvalidSplits] = useState(0);
  const [perChallengeHintsUsed, setPerChallengeHintsUsed] = useState(0);
  const [perChallengeManualInputs, setPerChallengeManualInputs] = useState(0);
  const [perChallengeResetCount, setPerChallengeResetCount] = useState(0);

  const treeCompleteTriggeredRef = useRef(false);
  const hasIntroducedRef = useRef(false);

  // Reset all per-challenge state when the challenge changes.
  useEffect(() => {
    if (!currentChallenge) return;
    setTree(new Map([['0', { value: currentRootValue, isPrime: isPrime(currentRootValue) }]]));
    setSelectedNode(null);
    setFactorInput({ factor1: '', factor2: '' });
    setError(null);
    setPerChallengeInvalidSplits(0);
    setPerChallengeHintsUsed(0);
    setPerChallengeManualInputs(0);
    setPerChallengeResetCount(0);
    treeCompleteTriggeredRef.current = false;
  }, [currentChallenge?.id, currentRootValue]);

  // ── Evaluation hook ───────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `factor-tree-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FactorTreeMetrics>({
    primitiveType: 'factor-tree',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI tutoring ───────────────────────────────────────────────────────────
  const leavesNow = useMemo(() => getLeavesFromTree(tree), [tree]);
  const treeNowComplete = useMemo(() => allLeavesPrime(tree) && leavesNow.length > 1, [tree, leavesNow.length]);

  const aiPrimitiveData = useMemo(() => ({
    rootValue: currentRootValue,
    currentFactorization: leavesNow.join(' × '),
    leavesCount: leavesNow.length,
    allPrime: allLeavesPrime(tree),
    guidedMode,
    currentChallengeIndex,
    totalChallenges: challenges.length,
  }), [currentRootValue, tree, leavesNow, guidedMode, currentChallengeIndex, challenges.length]);

  const { sendText } = useLuminaAI({
    primitiveType: 'factor-tree',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    exhibitId,
  });

  // Activity introduction
  useEffect(() => {
    if (hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Factor-tree session with ${challenges.length} challenges. ` +
      `First number: ${currentRootValue}. ` +
      `Guided mode: ${guidedMode ? 'on (suggested factor pairs shown)' : 'off'}. ` +
      `Briefly introduce the session and the first factorization.`,
      { silent: true }
    );
  }, [challenges.length, currentRootValue, guidedMode, sendText]);

  // ── Tree mutations ────────────────────────────────────────────────────────
  const splitNode = useCallback((nodeId: string, factor1: number, factor2: number): boolean => {
    const node = tree.get(nodeId);
    if (!node || node.factors) return false;

    if (factor1 * factor2 !== node.value) {
      setError(`${factor1} × ${factor2} ≠ ${node.value}`);
      setPerChallengeInvalidSplits((n) => n + 1);
      incrementAttempts();
      sendText(
        `[SPLIT_INVALID] Student tried ${node.value} = ${factor1} × ${factor2} ` +
        `(actually ${factor1 * factor2}). Remind them factors must multiply to ${node.value}.`,
        { silent: true }
      );
      return false;
    }

    if (factor1 === 1 || factor2 === 1) {
      setError('Factor pairs cannot include 1');
      setPerChallengeInvalidSplits((n) => n + 1);
      incrementAttempts();
      sendText(
        `[SPLIT_INVALID] Student used 1 as a factor of ${node.value}. ` +
        `Explain both factors must be greater than 1.`,
        { silent: true }
      );
      return false;
    }

    setError(null);
    incrementAttempts();

    const newTree = new Map(tree);
    newTree.set(nodeId, { ...node, factors: [factor1, factor2] });
    newTree.set(`${nodeId}-0`, { value: factor1, isPrime: isPrime(factor1) });
    newTree.set(`${nodeId}-1`, { value: factor2, isPrime: isPrime(factor2) });

    setTree(newTree);
    setSelectedNode(null);
    setFactorInput({ factor1: '', factor2: '' });

    // AI commentary (skip when the tree is now complete — completion effect handles it)
    if (!allLeavesPrime(newTree)) {
      const c1Prime = isPrime(factor1);
      const c2Prime = isPrime(factor2);
      const primeNote = c1Prime && c2Prime
        ? `Both ${factor1} and ${factor2} are prime — those branches are done!`
        : c1Prime || c2Prime
        ? `${c1Prime ? factor1 : factor2} is prime; ${c1Prime ? factor2 : factor1} still needs splitting.`
        : `Both ${factor1} and ${factor2} are composite — keep splitting.`;
      sendText(
        `[SPLIT_CORRECT] Split ${node.value} into ${factor1} × ${factor2}. ${primeNote} ` +
        `Current leaves: ${getLeavesFromTree(newTree).join(', ')}. Acknowledge and guide next step.`,
        { silent: true }
      );
    }
    return true;
  }, [tree, incrementAttempts, sendText]);

  const handleNodeSelect = useCallback((nodeId: string, currentlySelected: boolean) => {
    if (currentlySelected) { setSelectedNode(null); return; }
    const node = tree.get(nodeId);
    if (!node) return;
    setSelectedNode(nodeId);
    const pairs = getFactorPairs(node.value);
    sendText(
      `[NODE_SELECTED] Student selected ${node.value} to split. ` +
      `Valid pairs: ${pairs.map(([a, b]) => `${a}×${b}`).join(', ')}. ` +
      `${guidedMode ? 'Suggested pairs are visible.' : 'No hints — student enters factors manually.'}`,
      { silent: true }
    );
  }, [tree, sendText, guidedMode]);

  const resetTree = useCallback(() => {
    if (!currentChallenge) return;
    setTree(new Map([['0', { value: currentRootValue, isPrime: isPrime(currentRootValue) }]]));
    setSelectedNode(null);
    setFactorInput({ factor1: '', factor2: '' });
    setError(null);
    setPerChallengeResetCount((n) => n + 1);
    treeCompleteTriggeredRef.current = false;
    sendText(
      `[TREE_RESET] Student reset tree for ${currentRootValue}. Encourage another attempt.`,
      { silent: true }
    );
  }, [currentChallenge, currentRootValue, sendText]);

  // ── Per-challenge completion ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentChallenge) return;
    if (!treeNowComplete) return;
    if (treeCompleteTriggeredRef.current) return;
    // Stale-tree guard: the reset useEffect's setTree() is async — on the render
    // immediately after `advanceProgress()`, `tree` still holds the previous
    // challenge's fully-factored tree (so treeNowComplete is true) while
    // `currentChallenge` has already advanced. Only record when the tree's root
    // matches the active challenge's rootValue.
    const rootNode = tree.get('0');
    if (!rootNode || rootNode.value !== currentChallenge.rootValue) return;
    treeCompleteTriggeredRef.current = true;

    const splits = tree.size - leavesNow.length;
    const optimal = optimalSplitsFor(currentRootValue);
    const factorization = getPrimeFactorization(tree);
    const score = Math.max(
      0,
      100 - (perChallengeInvalidSplits * 10) - (perChallengeResetCount * 15)
    );

    recordResult({
      challengeId: currentChallenge.id,
      correct: true,
      attempts: currentAttempts,
      score,
      rootValue: currentRootValue,
      invalidSplits: perChallengeInvalidSplits,
      hintsUsed: perChallengeHintsUsed,
      manualInputs: perChallengeManualInputs,
      resetCount: perChallengeResetCount,
      totalSplits: splits,
      optimalSplits: optimal,
      treeDepth: treeDepth(tree, '0'),
      uniquePrimes: Array.from(new Set(leavesNow)).sort((a, b) => a - b),
      finalFactorization: factorization,
    });

    sendText(
      `[TREE_COMPLETE] ${currentRootValue} = ${factorization}. ` +
      `Splits: ${splits}. Invalid attempts: ${perChallengeInvalidSplits}. Hints used: ${perChallengeHintsUsed}. ` +
      `Celebrate, then preview the next factorization if there is one.`,
      { silent: true }
    );
  }, [
    treeNowComplete, currentChallenge, currentRootValue, tree, leavesNow,
    perChallengeInvalidSplits, perChallengeHintsUsed, perChallengeManualInputs, perChallengeResetCount,
    currentAttempts, recordResult, sendText,
  ]);

  // ── Advance to next challenge / submit on all-complete ────────────────────
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges done → AI summary + evaluation submit
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = challenges.length > 0
        ? Math.round((challengeResults.filter((r) => r.correct).length / challenges.length) * 100)
        : 0;

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. ` +
        `Celebrate completion of the full factor-tree session.`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation && challenges.length > 0) {
        // Aggregate per-challenge metrics into a session-level FactorTreeMetrics.
        const totalInvalid = challengeResults.reduce((s, r) => s + ((r.invalidSplits as number) || 0), 0);
        const totalSplits = challengeResults.reduce((s, r) => s + ((r.totalSplits as number) || 0), 0);
        const totalOptimal = challengeResults.reduce((s, r) => s + ((r.optimalSplits as number) || 0), 0);
        const totalHints = challengeResults.reduce((s, r) => s + ((r.hintsUsed as number) || 0), 0);
        const totalManual = challengeResults.reduce((s, r) => s + ((r.manualInputs as number) || 0), 0);
        const totalResets = challengeResults.reduce((s, r) => s + ((r.resetCount as number) || 0), 0);
        const maxDepth = challengeResults.reduce((m, r) => Math.max(m, (r.treeDepth as number) || 0), 0);

        const uniquePrimesSet = new Set<number>();
        const factorDistribution: Record<number, number> = {};
        for (const r of challengeResults) {
          for (const p of ((r.uniquePrimes as number[]) || [])) uniquePrimesSet.add(p);
        }
        // Approximate distribution by summing per-challenge contributions.
        // (Per-challenge distribution wasn't stored to keep the result row lean;
        // unique primes are the high-signal metric here.)

        const avgScore = challengeResults.length > 0
          ? Math.round(
              challengeResults.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0)
              / challengeResults.length
            )
          : 0;

        const primaryRoot = challenges[0].rootValue;
        const lastResult = challengeResults[challengeResults.length - 1];

        const metrics: FactorTreeMetrics = {
          type: 'factor-tree',
          targetNumber: primaryRoot,
          factorizationComplete: allChallengesComplete,
          finalFactorization: (lastResult?.finalFactorization as string) ?? '',
          allFactorsValid: totalInvalid === 0,
          invalidSplitAttempts: totalInvalid,
          totalPrimeFactors: challengeResults.reduce(
            (s, r) => s + (((r.uniquePrimes as number[]) || []).length),
            0
          ),
          uniquePrimes: Array.from(uniquePrimesSet).sort((a, b) => a - b),
          factorDistribution,
          totalSplits,
          optimalSplits: totalOptimal,
          efficiency: totalSplits > 0 ? totalOptimal / totalSplits : 1,
          usedLargestFactorFirst: false,
          hintsUsed: totalHints,
          manualInputs: totalManual,
          resetCount: totalResets,
          treeDepth: maxDepth,
        };

        submitEvaluation(allChallengesComplete, avgScore, metrics, {
          studentWork: {
            challengeCount: challenges.length,
            rootValues: challenges.map((c) => c.rootValue),
            factorizations: challengeResults.map((r) => r.finalFactorization),
          },
        });
      }
      return;
    }
    // advanceProgress() incremented index. Per-challenge state reset is handled by the
    // useEffect keyed on currentChallenge.id.
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, allChallengesComplete, submitEvaluation,
  ]);

  // Auto-submit when the last challenge completes (no manual submit on session end).
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderNode = (nodeId: string, depth: number = 0): JSX.Element | null => {
    const node = tree.get(nodeId);
    if (!node) return null;
    const isLeaf = !node.factors;
    const isSelected = selectedNode === nodeId;
    const canSplit = isLeaf && !node.isPrime;

    return (
      <div key={nodeId} className="flex flex-col items-center">
        <button
          onClick={() => canSplit && handleNodeSelect(nodeId, isSelected)}
          disabled={!canSplit}
          className={`
            w-16 h-16 rounded-full border-2 flex items-center justify-center font-bold text-lg
            transition-all duration-300 mb-2 relative backdrop-blur-sm
            ${
              node.isPrime && highlightPrimes
                ? 'bg-green-500/30 border-green-400/60 text-green-100 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:bg-green-500/40 hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] hover:scale-105'
                : isSelected
                ? 'bg-purple-500/40 border-purple-400/70 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-105 ring-2 ring-purple-400/50'
                : canSplit
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-100 hover:bg-amber-500/30 hover:border-amber-400/70 cursor-pointer hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:scale-105'
                : 'bg-slate-800/40 border-slate-600/50 text-slate-400'
            }
            ${!canSplit && !node.isPrime ? 'opacity-50' : ''}
          `}
          title={node.isPrime ? 'Prime number' : canSplit ? 'Click to split' : 'Already split'}
        >
          {(node.isPrime || canSplit) && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          )}
          <span className="relative z-10">{node.value}</span>
        </button>

        {node.factors && (
          <div className="flex gap-8 relative">
            <svg className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2" width="200" height="40">
              <defs>
                <linearGradient id={`line-gradient-${nodeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <line x1="100" y1="0" x2="50" y2="40" stroke={`url(#line-gradient-${nodeId})`} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="100" y1="0" x2="150" y2="40" stroke={`url(#line-gradient-${nodeId})`} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="pt-8">{renderNode(`${nodeId}-0`, depth + 1)}</div>
            <div className="pt-8">{renderNode(`${nodeId}-1`, depth + 1)}</div>
          </div>
        )}
      </div>
    );
  };

  const validPairs = selectedNode ? getFactorPairs(tree.get(selectedNode)?.value || 0) : [];

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const sum = challengeResults.reduce(
      (s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)),
      0
    );
    return Math.round(sum / challenges.length);
  }, [allChallengesComplete, challenges.length, challengeResults]);

  // ── Empty / error state ───────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className={`w-full max-w-6xl mx-auto my-16 ${className || ''}`}>
        <div className="glass-panel p-8 rounded-3xl border border-amber-500/20 text-center">
          <p className="text-slate-300">No factor-tree challenges available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Factor Tree</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <p className="text-xs text-amber-400 font-mono uppercase tracking-wider">Prime Factorization Tool</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-amber-500/20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-6 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Progress bar */}
          <div className="mb-6 flex items-center justify-center gap-3 text-xs text-amber-300 font-mono uppercase tracking-wider">
            <span>Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}</span>
            <div className="flex gap-1.5">
              {challenges.map((ch, idx) => {
                const done = challengeResults.some((r) => r.challengeId === ch.id);
                const isCurrent = idx === currentChallengeIndex && !allChallengesComplete;
                return (
                  <div
                    key={ch.id}
                    className={`w-2.5 h-2.5 rounded-full border ${
                      done
                        ? 'bg-green-400/70 border-green-300/80 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                        : isCurrent
                        ? 'bg-amber-400/70 border-amber-300/80 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                        : 'bg-slate-700/40 border-slate-600/50'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Per-challenge banner */}
          {currentChallenge && !allChallengesComplete && (
            <div className="mb-6 p-4 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-amber-500/20 text-center">
              <p className="text-amber-300 text-xs uppercase tracking-wider font-medium mb-1">
                Find the prime factorization of
              </p>
              <p className="text-3xl font-bold text-white">{currentRootValue}</p>
            </div>
          )}

          {/* Tree-complete banner (per-challenge advance UI) */}
          {treeNowComplete && !allChallengesComplete && (
            <div className="mb-6 p-6 bg-green-500/20 backdrop-blur-sm border-2 border-green-400/60 rounded-2xl text-center animate-fade-in shadow-[0_0_30px_rgba(34,197,94,0.3)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-green-400/30 flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
                    </svg>
                  </div>
                  <span className="text-green-200 font-bold text-xl">All leaves are prime!</span>
                </div>
                {showExponentForm && (
                  <div className="text-white font-mono text-xl bg-slate-900/30 backdrop-blur-sm py-2 px-4 rounded-lg border border-green-400/20 mb-4">
                    {currentRootValue} = {getPrimeFactorization(tree)}
                  </div>
                )}
                <button
                  onClick={advanceToNextChallenge}
                  className="px-6 py-3 bg-green-500/40 backdrop-blur-sm hover:bg-green-500/60 border border-green-400/50 hover:border-green-400/80 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:scale-105"
                >
                  {currentChallengeIndex + 1 < challenges.length ? 'Next Challenge →' : 'Finish Session'}
                </button>
              </div>
            </div>
          )}

          {/* Tree Visualization */}
          {!allChallengesComplete && (
            <div className="mb-8 p-8 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-amber-500/20 overflow-x-auto relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none rounded-2xl"></div>
              <div className="min-w-max mx-auto flex justify-center relative z-10">{renderNode('0')}</div>
            </div>
          )}

          {/* Factor Input Panel */}
          {selectedNode && !treeNowComplete && (
            <div className="mb-6 p-6 bg-purple-500/20 backdrop-blur-sm border-2 border-purple-400/60 rounded-2xl animate-fade-in shadow-[0_0_25px_rgba(168,85,247,0.3)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <h4 className="text-purple-200 font-bold mb-5 text-center text-lg">
                  Split {tree.get(selectedNode)?.value} into factors
                </h4>
                <div className="flex items-center gap-4 justify-center mb-4">
                  <input
                    type="number"
                    value={factorInput.factor1}
                    onChange={(e) => setFactorInput({ ...factorInput, factor1: e.target.value })}
                    placeholder="Factor 1"
                    className="w-24 px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg border border-purple-400/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none text-center transition-all"
                  />
                  <span className="text-purple-300 text-xl font-bold">&times;</span>
                  <input
                    type="number"
                    value={factorInput.factor2}
                    onChange={(e) => setFactorInput({ ...factorInput, factor2: e.target.value })}
                    placeholder="Factor 2"
                    className="w-24 px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg border border-purple-400/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none text-center transition-all"
                  />
                  <button
                    onClick={() => {
                      const f1 = parseInt(factorInput.factor1);
                      const f2 = parseInt(factorInput.factor2);
                      if (!isNaN(f1) && !isNaN(f2)) {
                        setPerChallengeManualInputs((n) => n + 1);
                        splitNode(selectedNode, f1, f2);
                      }
                    }}
                    className="px-6 py-2 bg-purple-500/40 backdrop-blur-sm hover:bg-purple-500/60 border border-purple-400/50 hover:border-purple-400/80 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:scale-105"
                  >
                    Split
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 backdrop-blur-sm border border-red-400/60 rounded-lg text-center shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <span className="text-red-200 text-sm font-medium">{error}</span>
                  </div>
                )}

                {guidedMode && validPairs.length > 0 && (
                  <div className="mt-4">
                    <p className="text-purple-300 text-sm mb-3 text-center font-medium">Suggested factor pairs:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {validPairs.map(([f1, f2], idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setPerChallengeHintsUsed((n) => n + 1);
                            const nodeValue = tree.get(selectedNode)?.value;
                            const success = splitNode(selectedNode, f1, f2);
                            if (success) {
                              sendText(
                                `[HINT_USED] Student used suggested pair for ${nodeValue}: ${f1} × ${f2}. ` +
                                `Encourage finding factors independently next time.`,
                                { silent: true }
                              );
                            }
                          }}
                          className="px-4 py-2 bg-slate-700/50 backdrop-blur-sm hover:bg-amber-500/30 text-white rounded-lg text-sm transition-all border border-slate-600/50 hover:border-amber-400/60 hover:shadow-[0_0_12px_rgba(251,191,36,0.3)] hover:scale-105"
                        >
                          {f1} &times; {f2}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current Factorization */}
          {!treeNowComplete && showExponentForm && leavesNow.length > 1 && !allChallengesComplete && (
            <div className="mb-6 p-5 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/40 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <p className="text-amber-400 text-sm mb-2 font-medium uppercase tracking-wide">Current factorization:</p>
                <p className="text-white font-mono text-lg">
                  {currentRootValue} = {leavesNow.join(' × ')}
                </p>
              </div>
            </div>
          )}

          {/* Legend & Controls */}
          {!allChallengesComplete && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-amber-400 mb-4">Legend</h4>
                  <div className="space-y-3 text-sm text-slate-200">
                    {highlightPrimes && (
                      <div className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-green-500/30 border-2 border-green-400/60 backdrop-blur-sm transition-all group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(34,197,94,0.4)]"></div>
                        <span className="group-hover:text-white transition-colors">Prime numbers (cannot be split further)</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 border-2 border-amber-400/50 backdrop-blur-sm transition-all group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.4)]"></div>
                      <span className="group-hover:text-white transition-colors">Composite numbers (can be split)</span>
                    </div>
                    <div className="flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded-full bg-purple-500/40 border-2 border-purple-400/70 backdrop-blur-sm ring-2 ring-purple-400/30 transition-all group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]"></div>
                      <span className="group-hover:text-white transition-colors">Selected node (ready to split)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-amber-400 mb-4">How to Use</h4>
                  <ul className="text-sm text-slate-200 space-y-2">
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-amber-400 mt-1">&#9656;</span>
                      <span>Click on a composite number to select it</span>
                    </li>
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-amber-400 mt-1">&#9656;</span>
                      <span>Enter two factors that multiply to the selected number</span>
                    </li>
                    {guidedMode && (
                      <li className="flex items-start gap-2 hover:text-white transition-colors">
                        <span className="text-amber-400 mt-1">&#9656;</span>
                        <span>Or choose from suggested factor pairs</span>
                      </li>
                    )}
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-amber-400 mt-1">&#9656;</span>
                      <span>Continue until all leaves are prime numbers</span>
                    </li>
                  </ul>

                  {allowReset && !treeNowComplete && (
                    <button
                      onClick={resetTree}
                      className="mt-5 w-full px-4 py-2 bg-red-500/30 backdrop-blur-sm hover:bg-red-500/50 border border-red-400/50 hover:border-red-400/80 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:scale-105"
                    >
                      Reset Tree
                      {perChallengeResetCount > 0 && ` (−${Math.round(perChallengeResetCount * RETRY_PENALTY * 100)}%)`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Phase Summary Panel */}
          {allChallengesComplete && phaseResults.length > 0 && (
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={submittedResult?.score ?? localOverallScore}
              durationMs={elapsedMs}
              heading="Factor-Tree Session Complete!"
              celebrationMessage={`You factored ${challenges.length} composite ${challenges.length === 1 ? 'number' : 'numbers'}!`}
              className="mt-4"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FactorTree;
