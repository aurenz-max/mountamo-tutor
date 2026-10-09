'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { usePrimitiveEvaluation, type FactorTreeMetrics, type PrimitiveEvaluationResult } from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import type { ChallengeResult } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  describeFactorWork, factorMiss, factorPairs, isPrime, splitCorrect, treeComplete, treeLeaves,
  workspaceAssignment, workspaceScene, type FactorSplit,
} from './factorTreeWorkspace';
import {
  DIVISIBILITY_RULES, PARTNER_LEVER, PRODUCT_LEVER, RULES_LEVER, factorTreeLevers, isPracticeTree, leverFacts, partnerFrame,
  productReadout, smallerTree,
} from './factorTreeLevers';

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
  /** Within-mode support tier (#1): running "current factorization" self-check panel.
   *  Falls back to showExponentForm when absent (no-tier path unchanged). */
  showRunningFactorization?: boolean;
  /** Within-mode support tier (#2): divisibility-strategy hint panel (easy, guided modes). */
  showStrategyHint?: boolean;
  /** Support tier label ('easy'|'medium'|'hard') for live-tutor reveal calibration. */
  supportTier?: 'easy' | 'medium' | 'hard';

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
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Pure helpers (no hooks)
// ============================================================================

const getPrimeFactorization = (t: Map<string, TreeNode>): string => {
  const counts = new Map<number, number>();
  treeLeaves(t).forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
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

const freshTree = (root: number) => new Map<string, TreeNode>([['0', { value: root, isPrime: isPrime(root) }]]);

/**
 * Live-tutor reveal calibration per support tier (scripted path only). The tier already withholds on-screen
 * scaffolds; this keeps the tutor from leaking what the tier hid (Gotcha #2).
 */
const tierRevealClause = (tier?: 'easy' | 'medium' | 'hard'): string => {
  if (tier === 'easy') return ' SUPPORT TIER easy: you may name the divisibility strategy and walk the first split.';
  if (tier === 'medium') return ' SUPPORT TIER medium: nudge execution only; do not name the full strategy or hand factor pairs unasked.';
  if (tier === 'hard') return ' SUPPORT TIER hard: do NOT name the strategy or hand factor pairs. Ask what the student notices; never reveal the answer.';
  return '';
};

/** The session's metrics from the per-challenge records (both paths write the same records). */
function sessionMetrics(challenges: FactorTreeChallenge[], results: ChallengeResult[], complete: boolean): FactorTreeMetrics {
  const sum = (key: string) => results.reduce((s, r) => s + ((r[key] as number) || 0), 0);
  const totalSplits = sum('totalSplits');
  const totalOptimal = sum('optimalSplits');
  const uniquePrimes = new Set<number>();
  for (const r of results) for (const p of ((r.uniquePrimes as number[]) || [])) uniquePrimes.add(p);
  const lastResult = results[results.length - 1];
  return {
    type: 'factor-tree',
    targetNumber: challenges[0]?.rootValue ?? 0,
    factorizationComplete: complete,
    finalFactorization: (lastResult?.finalFactorization as string) ?? '',
    allFactorsValid: sum('invalidSplits') === 0,
    invalidSplitAttempts: sum('invalidSplits'),
    totalPrimeFactors: results.reduce((s, r) => s + (((r.uniquePrimes as number[]) || []).length), 0),
    uniquePrimes: Array.from(uniquePrimes).sort((a, b) => a - b),
    // Per-challenge distribution is not stored, to keep the result row lean; unique primes are the high-signal metric.
    factorDistribution: {},
    totalSplits,
    optimalSplits: totalOptimal,
    efficiency: totalSplits > 0 ? totalOptimal / totalSplits : 1,
    usedLargestFactorFirst: false,
    hintsUsed: sum('hintsUsed'),
    manualInputs: sum('manualInputs'),
    resetCount: sum('resetCount'),
    treeDepth: results.reduce((m, r) => Math.max(m, (r.treeDepth as number) || 0), 0),
  };
}

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

const FactorTreeSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  FactorTreeProps & { tutorOwned: boolean; useController: (options: ProgressOptions<FactorTreeChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    highlightPrimes = true,
    showExponentForm = true,
    guidedMode = true,
    allowReset = true,
    showRunningFactorization,
    showStrategyHint = false,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `factor-tree-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress. On the workspace path the runtime moves the index. ──
  /** Bound below, once the setters and the evaluation exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked split stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the split callback keeps its deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: () => 'factor',
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // In-item levers (`factorTreeLevers.ts`), keyed by the session item they were pulled on, and the practice tree a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<FactorTreeChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the practice tree while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const currentRootValue = currentChallenge?.rootValue ?? 0;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice tree. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const leverContext = { rulesShown: showStrategyHint };

  // ── Per-challenge tree state ──────────────────────────────────────────────
  const [tree, setTree] = useState<Map<string, TreeNode>>(() => freshTree(currentRootValue));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [factorInput, setFactorInput] = useState<{ factor1: string; factor2: string }>({ factor1: '', factor2: '' });
  const [error, setError] = useState<string | null>(null);
  /** The wrong split on screen (the workspace's learner work); cleared by the next selection or Try again. */
  const [lastSplit, setLastSplit] = useState<FactorSplit | null>(null);

  // Per-challenge tracking (resets each challenge)
  const [perChallengeInvalidSplits, setPerChallengeInvalidSplits] = useState(0);
  const [perChallengeHintsUsed, setPerChallengeHintsUsed] = useState(0);
  const [perChallengeManualInputs, setPerChallengeManualInputs] = useState(0);
  const [perChallengeResetCount, setPerChallengeResetCount] = useState(0);

  const treeCompleteTriggeredRef = useRef(false);
  const hasIntroducedRef = useRef(false);

  /** Try again keeps the right splits on the tree and clears only the split that was checked wrong. */
  const clearSplit = () => {
    setSelectedNode(null);
    setFactorInput({ factor1: '', factor2: '' });
    setError(null);
    setLastSplit(null);
  };
  const resetChallenge = (root: number) => {
    setTree(freshTree(root));
    clearSplit();
    setPerChallengeInvalidSplits(0);
    setPerChallengeHintsUsed(0);
    setPerChallengeManualInputs(0);
    setPerChallengeResetCount(0);
    treeCompleteTriggeredRef.current = false;
  };
  // `index` is the item opening: this render's challenge is still the one before it.
  openItem.current = (index, retry) => {
    // Try again on a practice tree keeps it; a fresh item (or the full item back after practice) drops it.
    if (retry) clearSplit();
    else if (challenges[index]) { setPractice(null); resetChallenge(challenges[index].rootValue); }
  };

  // Reset all per-challenge state when the challenge changes (both paths).
  useEffect(() => {
    if (!currentChallenge) return;
    resetChallenge(currentRootValue);
  }, [currentChallenge?.id, currentRootValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Evaluation hook ───────────────────────────────────────────────────────
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

  // ── AI tutoring (scripted path) ───────────────────────────────────────────
  const leavesNow = useMemo(() => treeLeaves(tree), [tree]);
  const treeNowComplete = useMemo(() => treeComplete(tree), [tree]);

  const aiPrimitiveData = useMemo(() => ({
    rootValue: currentRootValue,
    currentFactorization: leavesNow.join(' × '),
    leavesCount: leavesNow.length,
    allPrime: leavesNow.every(isPrime),
    guidedMode,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    supportTier,
  }), [currentRootValue, leavesNow, guidedMode, currentChallengeIndex, challenges.length, supportTier]);

  // Its context carries the factor pairs, so it is off on the workspace path, and its scripted cues send nothing there.
  const { sendText: sendLegacyText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'factor-tree',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    exhibitId,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // Activity introduction
  useEffect(() => {
    if (hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Factor-tree session with ${challenges.length} challenges. ` +
      `First number: ${currentRootValue}. ` +
      `Guided mode: ${guidedMode ? 'on (suggested factor pairs shown)' : 'off'}.` +
      tierRevealClause(supportTier) + ' ' +
      `Briefly introduce the session and the first factorization.`,
      { silent: true }
    );
  }, [challenges.length, currentRootValue, guidedMode, supportTier, sendText]);

  // ── Tree mutations ────────────────────────────────────────────────────────
  // Every split is checked here. A wrong split, and the split that makes every leaf prime, are the checked gestures;
  // a right split that leaves a composite on the tree is a step of the item and commits nothing.
  const splitNode = useCallback((nodeId: string, factor1: number, factor2: number): boolean => {
    if (learnerBlocked()) return false;
    const node = tree.get(nodeId);
    if (!node || node.factors) return false;
    const split: FactorSplit = { value: node.value, factor1, factor2 };

    if (!splitCorrect(split)) {
      const usedOne = (factor1 === 1 || factor2 === 1) && factor1 * factor2 === node.value;
      if (usedOne) SoundManager.invalid(); else SoundManager.playIncorrect();
      setError(usedOne ? 'Factor pairs cannot include 1' : `${factor1} × ${factor2} ≠ ${node.value}`);
      setPerChallengeInvalidSplits((n) => n + 1);
      setLastSplit(split);
      sendText(usedOne
        ? `[SPLIT_INVALID] Student used 1 as a factor of ${node.value}. Explain both factors must be greater than 1.`
        : `[SPLIT_INVALID] Student tried ${node.value} = ${factor1} × ${factor2} ` +
          `(actually ${factor1 * factor2}). Remind them factors must multiply to ${node.value}.`,
        { silent: true });
      commitCheck.current(describeFactorWork(tree, split), false, factorMiss(split));
      return false;
    }

    setError(null);
    setLastSplit(null);
    SoundManager.snap();

    const newTree = new Map(tree);
    newTree.set(nodeId, { ...node, factors: [factor1, factor2] });
    newTree.set(`${nodeId}-0`, { value: factor1, isPrime: isPrime(factor1) });
    newTree.set(`${nodeId}-1`, { value: factor2, isPrime: isPrime(factor2) });

    setTree(newTree);
    setSelectedNode(null);
    setFactorInput({ factor1: '', factor2: '' });

    if (treeComplete(newTree)) {
      // The finishing split: counts the attempt and records the verdict on both paths.
      commitCheck.current(describeFactorWork(newTree, null), true);
    } else {
      incrementAttempts();
      const c1Prime = isPrime(factor1);
      const c2Prime = isPrime(factor2);
      const primeNote = c1Prime && c2Prime
        ? `Both ${factor1} and ${factor2} are prime — those branches are done!`
        : c1Prime || c2Prime
        ? `${c1Prime ? factor1 : factor2} is prime; ${c1Prime ? factor2 : factor1} still needs splitting.`
        : `Both ${factor1} and ${factor2} are composite — keep splitting.`;
      sendText(
        `[SPLIT_CORRECT] Split ${node.value} into ${factor1} × ${factor2}. ${primeNote} ` +
        `Current leaves: ${treeLeaves(newTree).join(', ')}. Acknowledge and guide next step.`,
        { silent: true }
      );
    }
    return true;
  }, [tree, incrementAttempts, sendText]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNodeSelect = useCallback((nodeId: string, currentlySelected: boolean) => {
    if (learnerBlocked()) return;
    if (currentlySelected) { setSelectedNode(null); return; }
    const node = tree.get(nodeId);
    if (!node) return;
    SoundManager.select();
    setSelectedNode(nodeId);
    setError(null);
    setLastSplit(null);
    const pairs = factorPairs(node.value);
    sendText(
      `[NODE_SELECTED] Student selected ${node.value} to split. ` +
      `Valid pairs (for YOUR reference only): ${pairs.map(([a, b]) => `${a}×${b}`).join(', ')}. ` +
      `${guidedMode ? 'Suggested pairs are visible.' : 'No hints — student enters factors manually.'}` +
      tierRevealClause(supportTier),
      { silent: true }
    );
  }, [tree, sendText, guidedMode, supportTier]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetTree = useCallback(() => {
    if (!currentChallenge || learnerBlocked()) return;
    SoundManager.toggle(false); // falling blips — undo / clear the tree
    setTree(freshTree(currentRootValue));
    clearSplit();
    setPerChallengeResetCount((n) => n + 1);
    treeCompleteTriggeredRef.current = false;
    sendText(
      `[TREE_RESET] Student reset tree for ${currentRootValue}. Encourage another attempt.`,
      { silent: true }
    );
  }, [currentChallenge, currentRootValue, sendText]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-challenge completion: this primitive's own score fields ───────────
  useEffect(() => {
    if (!currentChallenge) return;
    if (!treeNowComplete) return;
    if (treeCompleteTriggeredRef.current) return;
    // Stale-tree guard: the reset useEffect's setTree() is async — on the render
    // immediately after the index moves, `tree` still holds the previous
    // challenge's fully-factored tree (so treeNowComplete is true) while
    // `currentChallenge` has already advanced. Only record when the tree's root
    // matches the active challenge's rootValue.
    const rootNode = tree.get('0');
    if (!rootNode || rootNode.value !== currentChallenge.rootValue) return;
    treeCompleteTriggeredRef.current = true;
    SoundManager.playCorrect();
    // A practice tree (a simplify lever) is not the session's challenge: it records nothing.
    if (isPracticeTree(currentChallenge)) return;

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

      // The workspace path submits the scored session from `onFinished` (below), not this tally.
      if (!hasSubmittedEvaluation && challenges.length > 0 && !tutorOwned) {
        const avgScore = challengeResults.length > 0
          ? Math.round(
              challengeResults.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0)
              / challengeResults.length
            )
          : 0;
        submitEvaluation(allChallengesComplete, avgScore, sessionMetrics(challenges, challengeResults, allChallengesComplete), {
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
    hasSubmittedEvaluation, allChallengesComplete, submitEvaluation, tutorOwned,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong split's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0) return;
    submitEvaluation(result.passed, result.accuracy, sessionMetrics(challenges, challengeResults, result.passed),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Auto-submit when the last challenge completes (no manual submit on session end).
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  // W1 offers no demonstration targets and no presentation.
  const runningShown = showRunningFactorization ?? showExponentForm;
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, {
      tree, selected: selectedNode ? tree.get(selectedNode)?.value ?? null : null,
      pairsListed: guidedMode, primesMarked: highlightPrimes, runningShown, lastSplit,
    });
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers, leverContext);
    const levers = practice ? [] : factorTreeLevers(sessionChallenge, pulledLevers, leverContext);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'A practice tree is on screen in place of the item. It is not graded; the full item comes back after it, blank.' } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = smallerTree(sessionChallenge);
          if (!easier) return 'This number has no smaller practice tree; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetChallenge(easier.rootValue);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetChallenge(sessionChallenge.rootValue); },
    };
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? 'tree',
    label: 'The factor tree',
    solved: treeNowComplete,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

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

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderNode = (nodeId: string, depth: number = 0): JSX.Element | null => {
    const node = tree.get(nodeId);
    if (!node) return null;
    const isLeaf = !node.factors;
    const isSelected = selectedNode === nodeId;
    const canSplit = isLeaf && !node.isPrime && !treeNowComplete;

    return (
      <div key={nodeId} className="flex flex-col items-center">
        <button
          onClick={() => canSplit && handleNodeSelect(nodeId, isSelected)}
          disabled={!canSplit || blocked}
          aria-label={canSplit ? `Split ${node.value}` : undefined}
          data-pip-object={`node-${nodeId}`}
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
          title={node.isPrime ? (highlightPrimes ? 'Prime number' : undefined) : canSplit ? 'Click to split' : 'Already split'}
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

  const validPairs = selectedNode ? factorPairs(tree.get(selectedNode)?.value || 0) : [];
  const selectedValue = selectedNode ? tree.get(selectedNode)?.value ?? null : null;
  const typedFactor = (text: string) => { const n = parseInt(text, 10); return Number.isNaN(n) ? null : n; };

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

          {/* Divisibility-strategy hint (easy tier, guided modes) — names a rule, never an answer */}
          {(showStrategyHint || leverOn(RULES_LEVER)) && currentChallenge && !allChallengesComplete && !treeNowComplete && (
            <div data-lever="divisibility-rules" className="mb-6 p-4 bg-sky-500/15 backdrop-blur-sm rounded-xl border border-sky-400/30 max-w-2xl mx-auto">
              <p className="text-sky-300 text-xs uppercase tracking-wider font-medium mb-2 text-center">
                Divisibility strategy — which factor to try
              </p>
              <ul className="text-sm text-slate-200 space-y-1.5">
                {DIVISIBILITY_RULES.map((rule) => (
                  <li key={rule} className="flex items-start gap-2"><span className="text-sky-400 mt-0.5">&#9656;</span><span>{rule}</span></li>
                ))}
              </ul>
            </div>
          )}

          {/* Tree-complete banner (per-challenge advance UI; the runtime advances on the workspace path) */}
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
                {!tutorOwned && (
                  <button
                    onClick={advanceToNextChallenge}
                    className="px-6 py-3 bg-green-500/40 backdrop-blur-sm hover:bg-green-500/60 border border-green-400/50 hover:border-green-400/80 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:scale-105"
                  >
                    {currentChallengeIndex + 1 < challenges.length ? 'Next Challenge →' : 'Finish Session'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Pip's dock sits above the workspace, which it outlines as a region. */}
          {pip.store && !allChallengesComplete && <div {...pip.dock} />}
          <div {...pip.workspace}>
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
                    aria-label="Factor 1"
                    value={factorInput.factor1}
                    disabled={blocked}
                    onChange={(e) => { if (!learnerBlocked()) setFactorInput({ ...factorInput, factor1: e.target.value }); }}
                    placeholder="Factor 1"
                    className="w-24 px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg border border-purple-400/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none text-center transition-all"
                  />
                  <span className="text-purple-300 text-xl font-bold">&times;</span>
                  <input
                    type="number"
                    aria-label="Factor 2"
                    value={factorInput.factor2}
                    disabled={blocked}
                    onChange={(e) => { if (!learnerBlocked()) setFactorInput({ ...factorInput, factor2: e.target.value }); }}
                    placeholder="Factor 2"
                    className="w-24 px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg border border-purple-400/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none text-center transition-all"
                  />
                  <button
                    disabled={blocked}
                    onClick={() => {
                      if (learnerBlocked()) return;
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
                          disabled={blocked}
                          onClick={() => {
                            if (learnerBlocked()) return;
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

          {/* `partner_frame` and `product_check` levers: the division left open, and what the typed factors make. */}
          {!treeNowComplete && !allChallengesComplete && (leverOn(PARTNER_LEVER) || leverOn(PRODUCT_LEVER)) && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
              {leverOn(PARTNER_LEVER) && (
                <div data-lever="partner-frame" className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-400/30 text-center">
                  <p className="text-cyan-300 text-xs uppercase tracking-wider font-medium mb-1">Find the partner</p>
                  <p className="text-white font-mono text-lg">{partnerFrame(selectedValue, typedFactor(factorInput.factor1))}</p>
                  <p className="text-slate-400 text-xs mt-1">Multiply back to check.</p>
                </div>
              )}
              {leverOn(PRODUCT_LEVER) && (
                <div data-lever="product-check" className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-400/30 text-center">
                  <p className="text-cyan-300 text-xs uppercase tracking-wider font-medium mb-1">Your factors make</p>
                  <p className="text-white font-mono text-lg">
                    {productReadout(selectedValue, typedFactor(factorInput.factor1), typedFactor(factorInput.factor2))
                      ?? 'Type both factors to see what they make.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Current Factorization (running self-check — withdrawn at hard tier) */}
          {!treeNowComplete && runningShown && leavesNow.length > 1 && !allChallengesComplete && (
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

          </div>

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
                      disabled={blocked}
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

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const FactorTree = withWorkspaceController<FactorTreeProps, ProgressOptions<FactorTreeChallenge>, Progress>(
  'factor-tree', FactorTreeSurface, useScriptedProgress, useWorkspaceProgressFor('factor-tree'));

export default FactorTree;
