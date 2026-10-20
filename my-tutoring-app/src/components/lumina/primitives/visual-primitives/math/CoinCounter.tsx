'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaInput,
  LuminaButton,
  motion,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CoinCounterMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { coinCounterBoss } from './coinCounter.boss';
import { COIN_CENTS, coinItems, coinKey, coinMiss, coinScene, describeCoinWork, type CoinView } from './coinCounterWorkspace';
import {
  CHANGE_BAR_LEVER, COIN_LEVERS, COIN_VALUES_LEVER, PRACTICE_NOTE, RUNNING_TOTAL_LEVER, SIZE_ROW_LEVER, SKIP_STRIP_LEVER, SORT_LEVER,
  VALUE_TAGS_LEVER, changeBar, runningValues, sizeOrder, skipStrip, sortedRows, tierPulled, type CoinLeverView,
} from './coinCounterLevers';
import { CoinBuildTray, MAX_TRAY } from './CoinBuildTray';
import { useBuildWatcher } from '../../build-layer/buildLayer';

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
  type: 'identify' | 'count' | 'make-amount' | 'compare' | 'make-change' | 'show-amount';
  instruction: string;

  // identify — "Which coin is a nickel?"
  coins?: CoinDef[];
  targetCoin?: CoinType;
  options?: CoinType[];

  // count — "How much money is shown?"
  displayedCoins?: CoinDef[];
  correctTotal?: number; // in cents
  /** Which catalog eval mode built this 'count' card. `count-like` (single denomination,
   *  β1.5) and `count-mixed` (β2.5) BOTH render as challenge type 'count', and the coin
   *  set alone CANNOT tell them apart — the generator only rejects multi-type sets for
   *  count-like, never single-type sets for count-mixed, so a G2 count-mixed card that
   *  happens to draw 3 dimes would be misread as "like". Stamped by the generator from
   *  targetEvalMode so the K/G1 enacted-count forks can never fire on a count-mixed card. */
  countMode?: 'like' | 'mixed';

  // make-amount — "Make 47¢ using coins"; show-amount (open build) — "Show 37¢ any way you like", from
  // `availableCoins` as bins onto an empty tray
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
  /** The item space the coins or prices came from (calibration only; never rendered or sent to the tutor). */
  itemSpace?: { space: string; structure: string; beta: number };
}

export interface CoinCounterData {
  title: string;
  description?: string;
  challenges: CoinCounterChallenge[];
  gradeBand?: 'K' | '1' | '2' | '3';

  // ── Within-mode support tier (config.difficulty) — set by the generator ──
  /** Show the ¢ value label on each coin (recognition aid). Withdrawn at the hard tier.
   *  Always ignored for 'identify' (revealing the value reveals the coin). Default: true. */
  showCoinValues?: boolean;
  /** Show the running placed-total in make-amount (tracking aid), AND — G1 count-like —
   *  whether the enacted tap-count displays the climbing skip-count readout/badges (easy
   *  tier: self-check workspace) or plain ✓ tags (medium/hard: the child accumulates
   *  mentally and types the total). Same easy-only fade for both. Default: true. */
  showRunningTotal?: boolean;
  /** The applied support tier — kept in sync with the tutor's reveal level. */
  supportTier?: 'easy' | 'medium' | 'hard';

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

const COIN_VALUES = COIN_CENTS;

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
  'show-amount': { label: 'Show It', icon: '🧺', accentColor: 'cyan' },
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
  /** The printed coin name. Off on identify, where the name is the answer. */
  showName?: boolean;
  ariaLabel?: string;
  className?: string;
}

const CoinVisual: React.FC<CoinVisualProps> = ({ type, onClick, selected, disabled, showValue = true, showName = true, ariaLabel, className = '' }) => {
  const display = COIN_DISPLAY[type];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
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
      {showName && <span className="text-[10px] text-white/70 leading-none mt-0.5 capitalize">{type === 'half-dollar' ? 'half' : type}</span>}
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
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const useCoinProgress = useWorkspaceProgressFor('coin-counter');

const CoinCounterSurface = ({ data, className, runtimePlanItemId }: CoinCounterProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    gradeBand = '1',
    showCoinValues = true,
    showRunningTotal = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Challenge progress: the teaching workspace owns it and moves the index. ──
  // The lesson's items: each challenge with the grade band its key reads (an enacted like count has none).
  const items = useMemo(() => coinItems({ challenges, gradeBand }), [challenges, gradeBand]);
  const stableInstanceIdRef = useRef(instanceId || `coin-counter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  /** Bound below; a spoken answer the observer credited (`onSolved`). */
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  /** The challenge a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);
  const progress = useCoinProgress({
    challenges: items,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: coinCounterBoss.assignment,
    onItemOpened: (_index, retry) => openItem.current(retry),
    onFinished: result => finish.current(result),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    incrementAttempts,
  } = progress;
  /** A checked answer stays closed until Try again or the next challenge. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the check callbacks keep their deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;
  const coinView = useRef<CoinView>({ selectedCoin: null, countInput: '', counted: 0, enacted: null, placed: [],
    selectedGroup: null, changeInput: '', valuesShown: true, runningTotalShown: true });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // ── State ──────────────────────────────────────────────────────────
  // Levers (`coinCounterLevers.ts`), keyed by the session item they were pulled on, and the easier ask a simplify
  // lever put on screen in its place. A tier aid already on screen (make-amount's running total) counts as pulled.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<(typeof items)[number] | null>(null);
  const sessionChallenge = items[currentChallengeIndex] ?? null;
  /** What is on screen: the easier ask while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  /** Coin values on the coins (never on identify): the tier's, or the coin_values lever. */
  const valuesOn = showCoinValues || leverOn(COIN_VALUES_LEVER);
  const leverView: CoinLeverView = {
    valuesShown: showCoinValues, valuesOn, runningTotalShown: showRunningTotal,
    enactedTap: gradeBand === 'K' && sessionChallenge?.type === 'count' && sessionChallenge.countMode === 'like',
  };
  // A tier aid already on screen (make-amount's running total) is offered as pulled.
  const itemLevers = practice || !sessionChallenge ? []
    : COIN_LEVERS.declare(sessionChallenge, leverView, [...pulledLevers, ...tierPulled(sessionChallenge, leverView)]);
  /** make-amount's running total: the tier's, or the lever. */
  const makeTotalOn = showRunningTotal || leverOn(RUNNING_TOTAL_LEVER);

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // identify mode
  const [selectedCoin, setSelectedCoin] = useState<CoinType | null>(null);

  // count mode
  const [countInput, setCountInput] = useState('');

  // count mode @ K/G1 (count-like only) — the coins are tapped-to-count. Kept in TAP
  // ORDER (not a Set) so each counted coin keeps the running skip-count total it was
  // stamped with; re-tapping never renumbers the ones already counted.
  const [countedOrder, setCountedOrder] = useState<number[]>([]);
  const [wrongCoin, setWrongCoin] = useState<number | null>(null);
  const wrongCoinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Per-challenge auto-judge latch (declared with its state so `resetDomainState`,
   *  defined above the enacted block, can clear it without a use-before-declare hop). */
  const hasJudgedEnactedRef = useRef(false);
  useEffect(
    () => () => { if (wrongCoinTimer.current) clearTimeout(wrongCoinTimer.current); },
    [],
  );

  // make-amount mode
  const [placedCoins, setPlacedCoins] = useState<CoinType[]>([]);

  // compare mode
  const [selectedGroup, setSelectedGroup] = useState<'A' | 'B' | 'equal' | null>(null);

  // make-change mode
  const [changeInput, setChangeInput] = useState('');

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

  // ── Reset domain state on challenge change ─────────────────────────
  const resetDomainState = useCallback(() => {
    setSelectedCoin(null);
    setCountInput('');
    setPlacedCoins([]);
    setSelectedGroup(null);
    setChangeInput('');
    setFeedback('');
    setFeedbackType('');
    // Enacted-count state + its per-challenge latch. Clearing the latch HERE as well as
    // in the id-keyed effect is deliberate: a stale latch would soft-lock the next K
    // card (it would never auto-judge).
    setCountedOrder([]);
    setWrongCoin(null);
    if (wrongCoinTimer.current) clearTimeout(wrongCoinTimer.current);
    hasJudgedEnactedRef.current = false;
  }, []);
  // A fresh challenge starts empty. Try again clears the answer (the pick, the typed number, the placed coins)
  // and the feedback, but keeps a Grade 1 count's tags: every coin was already tagged once, which is right.
  // On the open build (show-amount) Try again keeps the tray and the verdict's words: the learner revises the build.
  openItem.current = (retry) => {
    if (!retry) { resetDomainState(); setPractice(null); return; }
    if (currentChallenge?.type === 'show-amount') return;
    setSelectedCoin(null);
    setPlacedCoins([]);
    setCountInput('');
    setSelectedGroup(null);
    setChangeInput('');
    setFeedback('');
    setFeedbackType('');
  };

  // ── Check Handlers ─────────────────────────────────────────────────
  // Each returns the verdict and shows its words; the workspace records the check (`commitCheck`, below).

  const handleCheckIdentify = useCallback(() => {
    if (!currentChallenge || !selectedCoin) return;
    const correct = selectedCoin === currentChallenge.targetCoin;
    setFeedback(correct
      ? `Correct! That's a ${currentChallenge.targetCoin} — worth ${formatCents(COIN_VALUES[currentChallenge.targetCoin!])}.`
      : `That's a ${selectedCoin}, not a ${currentChallenge.targetCoin}. Try again!`);
    setFeedbackType(correct ? 'success' : 'error');
    return correct;
  }, [currentChallenge, selectedCoin]);

  const handleCheckCount = useCallback(() => {
    if (!currentChallenge) return;
    const answer = parseInt(countInput, 10);
    const target = currentChallenge.correctTotal ?? 0;
    const correct = answer === target;
    setFeedback(correct ? `Yes! The total is ${formatCents(target)}!`
      : `You said ${formatCents(answer || 0)}, but the total is different. Try counting again!`);
    setFeedbackType(correct ? 'success' : 'error');
    return correct;
  }, [currentChallenge, countInput]);

  const handleCheckMakeAmount = useCallback(() => {
    if (!currentChallenge) return;
    const placed = placedCoins.reduce((sum, c) => sum + COIN_VALUES[c], 0);
    const target = currentChallenge.targetAmount ?? 0;
    const correct = placed === target;
    setFeedback(correct ? `Perfect! You made exactly ${formatCents(target)}!`
      : `You have ${formatCents(placed)} — ${placed < target ? 'you need more!' : 'that\'s too much!'}`);
    setFeedbackType(correct ? 'success' : 'error');
    return correct;
  }, [currentChallenge, placedCoins]);

  const handleCheckCompare = useCallback(() => {
    if (!currentChallenge || !selectedGroup) return;
    const correct = selectedGroup === currentChallenge.correctGroup;
    const aTotal = calcTotalCents(currentChallenge.groupA || []);
    const bTotal = calcTotalCents(currentChallenge.groupB || []);
    const explanation = currentChallenge.correctGroup === 'equal'
      ? `Both groups have ${formatCents(aTotal)}!`
      : `Group ${currentChallenge.correctGroup} has more (${formatCents(Math.max(aTotal, bTotal))} vs ${formatCents(Math.min(aTotal, bTotal))})!`;
    setFeedback(correct ? `Correct! ${explanation}` : 'Not quite. Count each group carefully!');
    setFeedbackType(correct ? 'success' : 'error');
    return correct;
  }, [currentChallenge, selectedGroup]);

  const handleCheckMakeChange = useCallback(() => {
    if (!currentChallenge) return;
    const answer = parseInt(changeInput, 10);
    const target = currentChallenge.correctChange ?? 0;
    const correct = answer === target;
    setFeedback(correct ? `Yes! The change is ${formatCents(target)}!`
      : `Not quite. How much is ${formatCents(currentChallenge.paidAmount ?? 0)} minus ${formatCents(currentChallenge.itemCost ?? 0)}?`);
    setFeedbackType(correct ? 'success' : 'error');
    return correct;
  }, [currentChallenge, changeInput]);

  /** show-amount ("I'm done!"): any coins that add up to the amount pass. The words name no amount or direction. */
  const handleCheckShowAmount = useCallback(() => {
    if (!currentChallenge) return;
    const target = currentChallenge.targetAmount ?? 0;
    const correct = placedCoins.reduce((sum, c) => sum + COIN_VALUES[c], 0) === target;
    setFeedback(correct ? `Yes! Your coins make ${formatCents(target)}!` : 'Not yet. Count what your coins are worth, then fix your tray.');
    setFeedbackType(correct ? 'success' : 'error');
    return correct;
  }, [currentChallenge, placedCoins]);

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
      case 'show-amount': correct = handleCheckShowAmount() ?? false; break;
    }

    if (correct) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    if (correct) tappedCorrect.current = currentChallenge.id;
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    const work = coinView.current;
    commitCheck.current(describeCoinWork(currentChallenge, work), correct,
      correct ? undefined : coinMiss(currentChallenge, work));
  }, [currentChallenge, handleCheckIdentify, handleCheckCount, handleCheckMakeAmount, handleCheckCompare, handleCheckMakeChange,
    handleCheckShowAmount]);

  // Under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss (`diagnosisEvidence.phases`).
  finish.current = (result) => {
    if (hasSubmittedEvaluation) return;
    const metrics: CoinCounterMetrics = {
      type: 'coin-counter',
      accuracy: result.accuracy,
      totalAttempts: result.attemptsCount,
      challengesCompleted: result.solvedCount,
      challengesTotal: challenges.length,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // A spoken total, group or change the observer credited (`onSolved` fires once per challenge, for a tap too): the
  // result a correct tap records, and the credited answer shown as a correct tap shows it. The shared lifecycle plays
  // the success sound.
  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || !coinKey(solved)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    if (solved.type === 'count') {
      setCountInput(String(solved.correctTotal ?? 0));
      setFeedback(`Yes! The total is ${formatCents(solved.correctTotal ?? 0)}!`);
    } else if (solved.type === 'make-change') {
      setChangeInput(String(solved.correctChange ?? 0));
      setFeedback(`Yes! The change is ${formatCents(solved.correctChange ?? 0)}!`);
    } else {
      setSelectedGroup(solved.correctGroup ?? null);
      setFeedback(solved.correctGroup === 'equal' ? 'Correct! Both groups are worth the same.' : `Correct! Group ${solved.correctGroup} has more.`);
    }
    setFeedbackType('success');
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice || !coinKey(practice)) return;
    if (practice.type === 'count') {
      setCountInput(String(practice.correctTotal ?? 0));
      setFeedback(`Yes! The total is ${formatCents(practice.correctTotal ?? 0)}!`);
    } else if (practice.type === 'make-change') {
      setChangeInput(String(practice.correctChange ?? 0));
      setFeedback(`Yes! The change is ${formatCents(practice.correctChange ?? 0)}!`);
    } else {
      setSelectedGroup(practice.correctGroup ?? null);
      setFeedback(practice.correctGroup === 'equal' ? 'Correct! Both groups are worth the same.' : `Correct! Group ${practice.correctGroup} has more.`);
    }
    setFeedbackType('success');
  };

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

  // ── Enacted count (K + count-like) ─────────────────────────────────
  // At K the counting act itself must be ENACTED, not computed-then-typed: the child
  // taps each coin and the running skip-count total climbs (5, 10, 15…), which IS the
  // "skip counting and summation" skill count-like exists to teach. Fork is band+mode:
  // G1 count-like gets its own tag-then-type variant (below); Grade 2+ and every
  // count-mixed card keep the number input + Check untouched.
  const enactedCoins = useMemo(
    () => (currentChallenge?.type === 'count' ? expandCoins(currentChallenge.displayedCoins || []) : []),
    [currentChallenge],
  );

  const isEnactedCount =
    gradeBand === 'K'
    && currentChallenge?.type === 'count'
    && currentChallenge?.countMode === 'like'
    && enactedCoins.length > 0;

  // ── Enacted count, Grade-1 VARIANT (reader-fit 14b) ────────────────
  // MEAS001-07-c's authored focus is "skip counting AND summation", and G1 count-like
  // is a live β1.5 item — so G1 does NOT inherit K's auto-judge. The child tags each
  // coin by tapping (a re-tap is a rejected double-count, as at K), and the number
  // input + Check appear only once every coin is tagged: the typed total keeps the
  // summation half student-produced and the answer act identical to the item history.
  // `showRunningTotal` (support tier) decides whether taps stamp the climbing
  // skip-count (easy) or a plain ✓ tag (medium/hard). Grade 2+ and every count-mixed
  // card keep the original inert-coins + typed path.
  const isEnactedCountG1 =
    gradeBand === '1'
    && currentChallenge?.type === 'count'
    && currentChallenge?.countMode === 'like'
    && enactedCoins.length > 0;

  const allEnactedCounted =
    enactedCoins.length > 0 && countedOrder.length === enactedCoins.length;

  // The learner's work as the check and the tutor read it. Written every render, read by the check handlers.
  const currentView: CoinView = {
    selectedCoin, countInput, counted: countedOrder.length,
    enacted: isEnactedCount ? 'tap' : isEnactedCountG1 ? 'tag' : null,
    placed: placedCoins, selectedGroup, changeInput,
    valuesShown: valuesOn && currentChallenge?.type !== 'identify',
    runningTotalShown: currentChallenge?.type === 'make-amount' ? makeTotalOn : showRunningTotal,
  };
  coinView.current = currentView;

  // What the tutor and the observer are shown, republished every render. No demonstration targets; every mode
  // declares its levers (`COIN_LEVERS`), and the lever set writes what a pulled one put on screen.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = coinScene(currentChallenge, coinView.current);
    const onScreen = practice ? '' : COIN_LEVERS.onScreen(sessionChallenge, leverView, pulledLevers);
    const levers = itemLevers;
    const published = leverScene(scene, { support: COIN_LEVERS.support(practice ? null : sessionChallenge, leverView), onScreen });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = COIN_LEVERS.simpler(sessionChallenge, leverView, id);
          if (!easier) return 'This item has no easier ask; try a help lever.';
          // The practice item and the full item share no work: both start blank.
          setLeverState(pulled); resetDomainState(); setPractice(easier);
          return { practice: coinCounterBoss.assignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { resetDomainState(); setPractice(null); },
    };
  });

  // ── Open build (show-amount): the tray, the live line, the commit ──
  const trayRef = useRef<SVGSVGElement | null>(null);
  const isShowAmount = currentChallenge?.type === 'show-amount';
  const buildOpen = isShowAmount && !isCurrentChallengeCorrect && progress.canAttempt !== false;
  // The live line (shared build layer): what the tray looks like so far, NEVER a number — adding up is the task.
  const buildSeeing = useBuildWatcher({
    buildKey: placedCoins.join('|'),
    enabled: buildOpen && placedCoins.length > 0,
    svg: trayRef,
    request: { task: currentChallenge?.instruction ?? '',
      sceneNote: 'A green coin tray. The coin bins the learner takes coins from sit outside the picture.', numbers: 'never' },
  });

  /** Running total after the first `n` taps — the value stamped on the nth coin. */
  const runningTotalAt = useCallback(
    (n: number) => countedOrder.slice(0, n).reduce((sum, idx) => sum + COIN_VALUES[enactedCoins[idx]], 0),
    [countedOrder, enactedCoins],
  );

  const handleEnactedCoinTap = useCallback((idx: number) => {
    if (isCurrentChallengeCorrect || learnerBlocked()) return;
    // Re-tapping an already-counted coin is the classic K double-count error. Feedback
    // lands ON the touched object (Audit-C rule 5) — shake + SFX, no text card.
    if (countedOrder.includes(idx)) {
      incrementAttempts();
      SoundManager.playIncorrect();
      if (wrongCoinTimer.current) clearTimeout(wrongCoinTimer.current);
      setWrongCoin(null);
      setWrongCoin(idx);
      wrongCoinTimer.current = setTimeout(() => setWrongCoin(null), 600);
      return;
    }
    SoundManager.tap();
    setCountedOrder((prev) => [...prev, idx]);
  }, [isCurrentChallengeCorrect, countedOrder, incrementAttempts]);

  // Auto-judge the moment every coin has been counted exactly once — no Check button
  // at K. Latched per challenge so the effect can never re-fire and double-record.
  useEffect(() => {
    hasJudgedEnactedRef.current = false;
  }, [currentChallenge?.id]);

  useEffect(() => {
    if (!isEnactedCount || hasJudgedEnactedRef.current || !currentChallenge) return;
    if (countedOrder.length !== enactedCoins.length) return;
    hasJudgedEnactedRef.current = true;

    const target = currentChallenge.correctTotal ?? 0;
    SoundManager.playCorrect();
    setFeedback(`You counted ${formatCents(target)}!`);
    setFeedbackType('success');
    commitCheck.current(describeCoinWork(currentChallenge, coinView.current), true);
  }, [isEnactedCount, currentChallenge, countedOrder.length, enactedCoins.length]);

  // ── Render Helpers ─────────────────────────────────────────────────

  const renderCoinGroup = (coins: CoinDef[], label?: string) => {
    const expanded = expandCoins(coins);
    // The sort_coins lever: one row per kind, most valuable first only when values are on screen.
    const rows = leverOn(SORT_LEVER) ? sortedRows(coins, valuesOn) : null;
    return (
      <div className="flex flex-col items-center gap-2">
        {label && <span className="text-slate-400 text-sm font-medium">{label}</span>}
        {rows ? (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-800/30 border border-white/5 min-h-[60px]">
            {rows.map(row => (
              <div key={row.type} data-lever="sorted-row" data-kind={row.type} className="flex flex-wrap gap-2 justify-center">
                {expandCoins([row]).map((coin, i) => (
                  <CoinVisual key={`${coin}-${i}`} type={coin} disabled showValue={valuesOn} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center p-3 rounded-xl bg-slate-800/30 border border-white/5 min-h-[60px]">
            {expanded.map((coin, i) => (
              <CoinVisual key={`${coin}-${i}`} type={coin} disabled showValue={valuesOn} />
            ))}
          </div>
        )}
      </div>
    );
  };

  /** The skip_strip lever: a strip counting by one coin's value, past the total, nothing marked. */
  const renderSkipStrip = () => {
    const strip = leverOn(SKIP_STRIP_LEVER) && currentChallenge ? skipStrip(currentChallenge) : null;
    if (!strip) return null;
    return (
      <div data-lever="skip-strip" className="flex flex-wrap justify-center gap-1">
        {strip.map(n => (
          <span key={n} data-step className="min-w-9 px-1.5 py-1 rounded-md bg-slate-800/60 border border-white/10 text-center text-xs text-slate-200 tabular-nums">
            {n}
          </span>
        ))}
      </div>
    );
  };

  const renderIdentifyChallenge = () => {
    if (!currentChallenge) return null;
    const coinOptions = currentChallenge.options || ['penny', 'nickel', 'dime', 'quarter'] as CoinType[];
    // The size_row lever: every option on one shelf, smallest first, bottoms even. Each keeps its own label.
    const sizeRow = leverOn(SIZE_ROW_LEVER);
    const order = sizeRow ? sizeOrder(coinOptions) : coinOptions.map((_, i) => i);
    return (
      <div className="space-y-4">
        <div {...(sizeRow ? { 'data-lever': 'size-row' } : {})}
          className={sizeRow ? 'flex gap-3 justify-center items-end border-b-4 border-amber-700/60 pb-1 px-4 mx-auto w-fit'
            : 'flex flex-wrap gap-3 justify-center'}>
          {order.map(i => [coinOptions[i], i] as const).map(([coin, i]) => (
            <CoinVisual
              key={coin}
              type={coin}
              selected={selectedCoin === coin}
              onClick={() => {
                if (isCurrentChallengeCorrect || learnerBlocked()) return;
                SoundManager.select();
                setSelectedCoin(coin);
              }}
              disabled={isCurrentChallengeCorrect}
              showValue={false}
              // The coin's name is the answer: only its size and color are drawn, and its label is its position.
              showName={false}
              ariaLabel={`Coin ${i + 1}`}
            />
          ))}
        </div>
        <p className="text-slate-500 text-xs text-center">Tap the coin to select it</p>
      </div>
    );
  };

  /** K + count-like: the coins are the answer surface. No number input, no Check. */
  const renderEnactedCountChallenge = () => {
    if (!currentChallenge) return null;
    const total = runningTotalAt(countedOrder.length);
    const allCounted = countedOrder.length === enactedCoins.length;

    return (
      <div className="space-y-4">
        {/* Running skip-count readout. Starts at 0 and is BUILT by the taps — it never
            shows the answer before the child has counted there. */}
        <div className="flex justify-center">
          <span
            data-testid="enacted-running-total"
            className={`text-4xl font-bold tabular-nums transition-colors ${
              allCounted ? 'text-emerald-300' : 'text-slate-200'
            }`}
          >
            {formatCents(total)}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 justify-center p-3 rounded-xl bg-slate-800/30 border border-white/5 min-h-[60px]">
          {enactedCoins.map((coin, i) => {
            const order = countedOrder.indexOf(i);
            const counted = order >= 0;
            return (
              <div key={`enacted-${coin}-${i}`} className="relative">
                <CoinVisual
                  type={coin}
                  onClick={() => handleEnactedCoinTap(i)}
                  selected={counted}
                  disabled={isCurrentChallengeCorrect}
                  showValue={valuesOn}
                  ariaLabel={`Coin ${i + 1}`}
                  className={wrongCoin === i ? motion.shake : ''}
                />
                {counted && (
                  <span
                    data-testid={`coin-count-badge-${i}`}
                    className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-emerald-500 border border-emerald-300/60 text-white text-[11px] font-bold flex items-center justify-center pointer-events-none select-none shadow"
                  >
                    {runningTotalAt(order + 1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /** Grade 1 + count-like (14b): the child TAGS each coin by tapping — the
   *  organization of the skip count is enacted, a re-tap is a rejected
   *  double-count — then TYPES the total once every coin is tagged. The
   *  "summation" half of MEAS001-07-c stays student-produced. `showRunningTotal`
   *  decides whether taps stamp the climbing skip-count values + readout (easy
   *  tier: self-check workspace) or a plain ✓ tag (medium/hard: the child
   *  accumulates mentally). */
  const renderEnactedCountG1Challenge = () => {
    if (!currentChallenge) return null;

    return (
      <div className="space-y-4">
        {showRunningTotal && (
          <div className="flex justify-center">
            <span
              data-testid="enacted-running-total-g1"
              className={`text-4xl font-bold tabular-nums transition-colors ${
                allEnactedCounted ? 'text-emerald-300' : 'text-slate-200'
              }`}
            >
              {formatCents(runningTotalAt(countedOrder.length))}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center p-3 rounded-xl bg-slate-800/30 border border-white/5 min-h-[60px]">
          {enactedCoins.map((coin, i) => {
            const order = countedOrder.indexOf(i);
            const counted = order >= 0;
            return (
              <div key={`enacted-g1-${coin}-${i}`} className="relative">
                <CoinVisual
                  type={coin}
                  onClick={() => handleEnactedCoinTap(i)}
                  selected={counted}
                  disabled={isCurrentChallengeCorrect}
                  showValue={valuesOn}
                  ariaLabel={`Coin ${i + 1}`}
                  className={wrongCoin === i ? motion.shake : ''}
                />
                {counted && (
                  <span
                    data-testid={`coin-count-badge-${i}`}
                    className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-emerald-500 border border-emerald-300/60 text-white text-[11px] font-bold flex items-center justify-center pointer-events-none select-none shadow"
                  >
                    {showRunningTotal ? runningTotalAt(order + 1) : '✓'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {renderSkipStrip()}

        {!allEnactedCounted ? (
          /* Short cue in house style ("Tap a coin to add it"); its spoken twin is
             enactedCountG1Clause on every challenge-start message. */
          <p className="text-slate-500 text-xs text-center">Tap each coin to count it!</p>
        ) : (
          <div className="flex items-center gap-3 justify-center">
            <span className="text-slate-400 text-sm">Total:</span>
            <LuminaInput
              type="number"
              inputMode="numeric"
              min={0}
              value={countInput}
              onChange={(e) => { if (!learnerBlocked()) setCountInput(e.target.value); }}
              disabled={isCurrentChallengeCorrect}
              aria-label="Total in cents"
              placeholder="¢"
              className="w-24 px-3 py-2 text-center text-lg"
            />
            <span className="text-slate-400">cents</span>
          </div>
        )}
      </div>
    );
  };

  const renderCountChallenge = () => {
    if (!currentChallenge) return null;
    if (isEnactedCount) return renderEnactedCountChallenge();
    if (isEnactedCountG1) return renderEnactedCountG1Challenge();
    const coins = currentChallenge.displayedCoins || [];
    return (
      <div className="space-y-4">
        {renderCoinGroup(coins)}
        {renderSkipStrip()}
        <div className="flex items-center gap-3 justify-center">
          <span className="text-slate-400 text-sm">Total:</span>
          <LuminaInput
            type="number"
            inputMode="numeric"
            min={0}
            value={countInput}
            onChange={(e) => { if (!learnerBlocked()) setCountInput(e.target.value); }}
            disabled={isCurrentChallengeCorrect}
            aria-label="Total in cents"
            placeholder="¢"
            className="w-24 px-3 py-2 text-center text-lg"
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
    const placedTags = leverOn(VALUE_TAGS_LEVER) ? runningValues(placedCoins) : null;

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
                if (isCurrentChallengeCorrect || learnerBlocked()) return;
                SoundManager.tap();
                setPlacedCoins((prev) => [...prev, coin]);
              }}
              disabled={isCurrentChallengeCorrect}
              showValue={valuesOn}
              ariaLabel={`Add a ${coin}`}
            />
          ))}
        </div>
        <p className="text-slate-500 text-xs text-center">Tap a coin to add it</p>

        {/* Placed coins workspace */}
        <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5 min-h-[60px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs">Your coins:</span>
            {makeTotalOn && (
              <span data-lever={leverOn(RUNNING_TOTAL_LEVER) ? 'running-total' : undefined}
                className={`text-sm font-bold ${placedTotal === target ? 'text-emerald-300' : 'text-slate-300'}`}>
                {formatCents(placedTotal)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {placedCoins.map((coin, i) => (
              <div key={`placed-${i}`} className="relative">
              <CoinVisual
                type={coin}
                onClick={() => {
                  if (isCurrentChallengeCorrect || learnerBlocked()) return;
                  SoundManager.tap();
                  setPlacedCoins((prev) => {
                    const next = [...prev];
                    next.splice(i, 1);
                    return next;
                  });
                }}
                disabled={isCurrentChallengeCorrect}
                showValue={valuesOn}
                ariaLabel={`Take out a ${coin}`}
                className="hover:ring-2 hover:ring-red-400/50"
              />
              {/* The value_tags lever: what the coins add up to at this coin, in the order put in. */}
              {placedTags && (
                <span data-lever="value-tag" className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center pointer-events-none select-none">
                  {placedTags[i]}
                </span>
              )}
              </div>
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
            onClick={() => { if (!learnerBlocked()) setPlacedCoins([]); }}
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 text-xs mx-auto block"
          >
            Clear All
          </Button>
        )}
      </div>
    );
  };

  /** Open build: bins above an empty tray. No target on screen beside the coins; the ask states the amount. */
  const renderShowAmountChallenge = () => {
    if (!currentChallenge) return null;
    const bins = currentChallenge.availableCoins || ['penny', 'nickel', 'dime'] as CoinType[];
    const full = placedCoins.length >= MAX_TRAY;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 justify-center">
          {bins.map((coin) => (
            <CoinVisual
              key={coin}
              type={coin}
              onClick={() => {
                if (!buildOpen || full) return;
                SoundManager.tap();
                setPlacedCoins((prev) => [...prev, coin]);
              }}
              disabled={!buildOpen || full}
              showValue={valuesOn}
              ariaLabel={`Add a ${coin}`}
            />
          ))}
        </div>
        <p className="text-slate-500 text-xs text-center">Tap a coin to put it on your tray. Tap a coin on the tray to take it off.</p>
        <div className="flex justify-center">
          <CoinBuildTray ref={trayRef} coins={placedCoins} valuesShown={valuesOn}
            tags={leverOn(VALUE_TAGS_LEVER) ? runningValues(placedCoins) : null} disabled={!buildOpen}
            onRemove={(i) => {
              if (!buildOpen) return;
              SoundManager.tap();
              setPlacedCoins((prev) => prev.filter((_, j) => j !== i));
            }} />
        </div>
        <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
          {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
        </div>
        {leverOn(RUNNING_TOTAL_LEVER) && (
          <div className="flex items-center justify-center text-sm" data-lever="running-total">
            <span className="text-slate-300">On your tray: <span className="text-orange-300 font-bold text-lg">{formatCents(placedTotal)}</span></span>
          </div>
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
            onClick={() => {
              if (isCurrentChallengeCorrect || learnerBlocked()) return;
              SoundManager.select();
              setSelectedGroup('A');
            }}
            disabled={isCurrentChallengeCorrect}
            aria-label="Group A"
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
            onClick={() => {
              if (isCurrentChallengeCorrect || learnerBlocked()) return;
              SoundManager.select();
              setSelectedGroup('B');
            }}
            disabled={isCurrentChallengeCorrect}
            aria-label="Group B"
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
            onClick={() => {
              if (isCurrentChallengeCorrect || learnerBlocked()) return;
              SoundManager.select();
              setSelectedGroup('equal');
            }}
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

  /** The change_bar lever: a bar for what was paid, the cost shaded, the rest "?" with unlabelled ticks every 5¢.
   *  Its only numbers are the paid amount and the cost, both already on screen (`changeBarLabels`). */
  const renderChangeBar = () => {
    const bar = leverOn(CHANGE_BAR_LEVER) && currentChallenge ? changeBar(currentChallenge) : null;
    if (!bar) return null;
    const W = 300, X0 = 10, L = 280, x = (c: number) => X0 + (c / bar.paid) * L;
    return (
      <svg data-lever="change-bar" viewBox={`0 0 ${W} 64`} width={W} height={64} className="mx-auto max-w-full"
        role="img" aria-label="A bar for what was paid, the cost shaded">
        <rect x={X0} y={8} width={L} height={24} rx={4} fill="#1e293b" stroke="#94a3b8" />
        <rect x={X0} y={8} width={x(bar.cost) - X0} height={24} rx={4} fill="#f97316" fillOpacity={0.6} />
        {bar.ticks.map(t => <line key={t} x1={x(t)} x2={x(t)} y1={22} y2={32} stroke="#cbd5e1" strokeWidth={1.5} />)}
        <text x={(x(bar.cost) + X0 + L) / 2} y={24} fontSize={13} fill="#6ee7b7" textAnchor="middle" fontWeight="bold">?</text>
        <text x={x(bar.cost)} y={48} fontSize={11} fill="#fdba74" textAnchor="middle">{formatCents(bar.cost)}</text>
        <text x={X0 + L} y={48} fontSize={11} fill="#93c5fd" textAnchor="end">{formatCents(bar.paid)}</text>
      </svg>
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
        {renderChangeBar()}
        <div className="flex items-center gap-3 justify-center">
          <LuminaInput
            type="number"
            inputMode="numeric"
            min={0}
            value={changeInput}
            onChange={(e) => { if (!learnerBlocked()) setChangeInput(e.target.value); }}
            disabled={isCurrentChallengeCorrect}
            aria-label="Change in cents"
            placeholder="¢"
            className="w-24 px-3 py-2 text-center text-lg"
          />
          <span className="text-slate-400">cents</span>
        </div>
      </div>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="emerald" className="text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : `Grade ${gradeBand}`}
            </LuminaBadge>
            {challenges.length > 0 && (
              <LuminaBadge accent="blue" className="text-xs">
                {currentChallengeIndex + 1}/{challenges.length}
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase badges */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              const hasThisType = challenges.some((c) => c.type === type);
              if (!hasThisType) return null;
              const isActive = currentChallenge?.type === type;
              return (
                <LuminaBadge
                  key={type}
                  accent={isActive ? 'emerald' : undefined}
                  className={`text-xs ${
                    isActive
                      ? 'bg-emerald-500/20 border-emerald-400/50'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </LuminaBadge>
              );
            })}
          </div>
        )}

        {/* Summary panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
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
            {practice && <div className="text-center text-xs text-amber-300" data-practice>Practice</div>}
            <LuminaPanel className="p-3 rounded-xl">
              <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            </LuminaPanel>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above the workspace, and the
                workspace as one region, never a single coin. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
            {/* Challenge-type-specific UI */}
            {currentChallenge.type === 'identify' && renderIdentifyChallenge()}
            {currentChallenge.type === 'count' && renderCountChallenge()}
            {currentChallenge.type === 'make-amount' && renderMakeAmountChallenge()}
            {currentChallenge.type === 'compare' && renderCompareChallenge()}
            {currentChallenge.type === 'make-change' && renderMakeChangeChallenge()}
            {currentChallenge.type === 'show-amount' && renderShowAmountChallenge()}
            </PipWorkspace>

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
              {/* The enacted K count has no Check — the taps ARE the answer and it
                  auto-judges, so a Check button would be a dead control. The G1 enacted
                  count keeps Check, but only once every coin is tagged (it appears
                  together with the total input). */}
              {/* The open build commits with "I'm done!" through the same check; there is no auto-check. */}
              {isShowAmount && !isCurrentChallengeCorrect ? (
                <LuminaButton tone="primary" disabled={!buildOpen || placedCoins.length === 0}
                  onClick={() => { if (!learnerBlocked()) handleCheckAnswer(); }}>
                  I&apos;m done!
                </LuminaButton>
              ) : !isCurrentChallengeCorrect ? (
                isEnactedCount || (isEnactedCountG1 && !allEnactedCounted) ? null : (
                <LuminaActionButton
                  action="check"
                  onClick={() => { if (!learnerBlocked()) handleCheckAnswer(); }}
                  disabled={
                    progress.canAttempt === false ||
                    (currentChallenge.type === 'identify' && !selectedCoin) ||
                    (currentChallenge.type === 'count' && !countInput) ||
                    (currentChallenge.type === 'make-amount' && placedCoins.length === 0) ||
                    (currentChallenge.type === 'compare' && !selectedGroup) ||
                    (currentChallenge.type === 'make-change' && !changeInput)
                  }
                />
                )
              ) : null}
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
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const CoinCounter = withWorkspaceOnly<CoinCounterProps>('coin-counter', CoinCounterSurface, (props) => props.data.title);

export default CoinCounter;
