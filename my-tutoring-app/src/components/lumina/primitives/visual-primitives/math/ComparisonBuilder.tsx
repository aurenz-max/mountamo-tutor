'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPrompt,
  LuminaModeTabs,
  LuminaChallengeCounter,
  LuminaActionButton,
  LuminaButton,
  LuminaFeedbackCard,
  answerStateClass,
  dropZoneStateClass,
  motion,
  type DropZoneState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
  type DiagnosisEvidence,
} from '../../../evaluation';
import type { ComparisonBuilderMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { comparisonBuilderBoss } from './comparisonBuilder.boss';
import { comparisonItems, comparisonMiss, comparisonScene, describeComparison, type ComparisonItem } from './comparisonBuilderWorkspace';
import { COMPARISON_LEVERS, HOPS_LEVER, MARKS_LEVER, MATCH_LEVER, STEPS_LEVER, TAP_LEVER, hopLabels, modelPair, quantityParts,
  slotSteps } from './comparisonBuilderLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ComparisonBuilderChallenge {
  id: string;
  type: 'compare-groups' | 'compare-numbers' | 'order' | 'one-more-one-less';
  instruction: string;
  // compare-groups
  leftGroup?: { count: number; objectType: string };
  rightGroup?: { count: number; objectType: string };
  correctAnswer?: 'more' | 'less' | 'equal';
  // compare-numbers
  leftNumber?: number;
  rightNumber?: number;
  correctSymbol?: '<' | '>' | '=';
  /** compare-numbers: calibration stamp when the compare-numbers item space picked the pair. Never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
  // order
  numbers?: number[];
  direction?: 'ascending' | 'descending';
  // one-more-one-less
  targetNumber?: number;
  askFor?: 'one-more' | 'one-less' | 'both';
}

export interface ComparisonBuilderData {
  title: string;
  description?: string;
  challenges: ComparisonBuilderChallenge[];
  gradeBand: 'K' | '1';
  showCorrespondenceLines: boolean;
  useAlligatorMnemonic: boolean;

  // Support-tier scaffold fields (set by the generator from config.difficulty;
  // all default to current behavior so a no-tier session is byte-identical).
  /** Gate the "Left: N / Right: N" count badges (compare-groups, Grade 1). Shown
   *  only once the item is answered: printed totals answer the comparison. */
  showCountBadges?: boolean;
  /** Correspondence-line lifecycle: 'on-check' = offered after answering (default),
   *  'off' = never. Legacy payloads may carry 'live'; it is read as 'on-check',
   *  because lines drawn during the solve leave the answer as the leftovers. */
  correspondenceMode?: 'live' | 'on-check' | 'off';
  /** Gate the amber number-line target pre-highlight (one-more-one-less). The
   *  amber Target box is the stimulus and is always shown regardless. */
  showTargetMarker?: boolean;
  /** Gate the slot-index placeholders (1,2,3…) in the ordering drop slots. */
  showSlotHints?: boolean;
  /** Within-mode support tier — kept in sync so the AI tutor matches the screen. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ComparisonBuilderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'compare-groups': { label: 'Compare Groups', icon: '🐻', accentColor: 'orange' },
  'compare-numbers': { label: 'Compare Numbers', icon: '🔢', accentColor: 'blue' },
  'order': { label: 'Order', icon: '📊', accentColor: 'purple' },
  'one-more-one-less': { label: 'One More / Less', icon: '➕', accentColor: 'emerald' },
};

const OBJECT_EMOJI: Record<string, string> = {
  bears: '🧸',
  apples: '🍎',
  stars: '⭐',
  blocks: '🟦',
  fish: '🐟',
  butterflies: '🦋',
  hearts: '❤️',
  flowers: '🌸',
  cookies: '🍪',
  balls: '🔴',
};

const GROUP_WIDTH = 200;
const GROUP_HEIGHT = 200;
const GAP = 80;
const SVG_WIDTH = GROUP_WIDTH * 2 + GAP;
const SVG_HEIGHT = GROUP_HEIGHT + 40;

// ============================================================================
// Position Helpers
// ============================================================================

function generateGridPositions(
  count: number,
  offsetX: number,
  offsetY: number,
): Array<{ x: number; y: number }> {
  const cols = Math.min(count, 5);
  const rows = Math.ceil(count / 5);
  const spacing = 36;
  const totalWidth = (cols - 1) * spacing;
  const totalHeight = (rows - 1) * spacing;
  const startX = offsetX + (GROUP_WIDTH - totalWidth) / 2;
  const startY = offsetY + (GROUP_HEIGHT - totalHeight) / 2;

  return Array.from({ length: count }, (_, i) => ({
    x: startX + (i % cols) * spacing,
    y: startY + Math.floor(i / cols) * spacing,
  }));
}

/**
 * Scattered positions for the HARD compare-groups tier — irregular layout (no
 * grid rows) so the student can't subitize the arrangement and must count.
 * Deterministic per (count, offset) so it's stable across re-renders.
 */
function generateScatterPositions(
  count: number,
  offsetX: number,
  offsetY: number,
): Array<{ x: number; y: number }> {
  const pad = 28;
  const w = GROUP_WIDTH - pad * 2;
  const h = GROUP_HEIGHT - pad * 2;
  const rand = (seed: number) => {
    const s = Math.sin(seed) * 43758.5453;
    return s - Math.floor(s);
  };
  return Array.from({ length: count }, (_, i) => ({
    x: offsetX + pad + rand((i + 1) * 12.9898 + offsetX) * w,
    y: offsetY + pad + rand((i + 1) * 78.233 + offsetX) * h,
  }));
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Renders an inequality symbol — optionally as a friendly alligator mouth.
 *
 * Layout: the alligator body sits behind the jaw hinge (V vertex) and the
 * mouth opens AWAY from the body toward the bigger number.
 *
 *   < (less-than):  body LEFT,  mouth opens RIGHT  →  eats bigger right number
 *   > (greater-than): body RIGHT, mouth opens LEFT  →  eats bigger left number
 */
function AlligatorSymbol({
  symbol,
  size = 48,
  useAlligator,
}: {
  symbol: '<' | '>' | '=';
  size?: number;
  useAlligator: boolean;
}) {
  if (!useAlligator || symbol === '=') {
    return (
      <span className="text-slate-100 font-bold" style={{ fontSize: size }}>
        {symbol}
      </span>
    );
  }

  const isLessThan = symbol === '<';
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 60 40" width={size} height={size * 0.67}>
        {/* Body (behind the jaw hinge) */}
        <ellipse
          cx={isLessThan ? 10 : 50}
          cy={20}
          rx={8}
          ry={7}
          fill="rgba(34,197,94,0.25)"
          stroke="rgba(34,197,94,0.5)"
          strokeWidth={1.5}
        />
        {/* Eye */}
        <circle cx={isLessThan ? 12 : 48} cy={15} r={2.5} fill="white" />
        <circle cx={isLessThan ? 12 : 48} cy={15} r={1.2} fill="#1e293b" />
        {/* Jaw V — vertex (hinge) near body, tips (opening) away from body */}
        <path
          d={
            isLessThan
              ? 'M 48 6 L 16 20 L 48 34'   /* < shape: hinge left, opens right */
              : 'M 12 6 L 44 20 L 12 34'    /* > shape: hinge right, opens left */
          }
          fill="none"
          stroke="rgba(34,197,94,0.8)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Teeth (near the mouth opening / jaw tips) */}
        {isLessThan ? (
          /* < mouth opens RIGHT — teeth near x ≈ 40-46 */
          <>
            <line x1="40" y1="11" x2="44" y2="14" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="36" y1="9" x2="40" y2="12" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="40" y1="29" x2="44" y2="26" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="36" y1="31" x2="40" y2="28" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
          </>
        ) : (
          /* > mouth opens LEFT — teeth near x ≈ 14-20 */
          <>
            <line x1="20" y1="11" x2="16" y2="14" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="24" y1="9" x2="20" y2="12" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="20" y1="29" x2="16" y2="26" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="24" y1="31" x2="20" y2="28" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

interface ComparisonBuilderProps {
  data: ComparisonBuilderData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

/** `quantity_marks` lever: a number's amount as sticks of ten and loose dots, drawn alike wherever it appears. */
const QuantityMarks = ({ n }: { n: number }) => {
  const { tens, ones } = quantityParts(n);
  return (
    <div data-lever="quantity-marks" aria-label={`${tens} tens and ${ones} ones`} className="flex items-end justify-center gap-1 min-h-[20px]">
      {Array.from({ length: tens }, (_, i) => <span key={`t${i}`} className="block w-1.5 h-5 rounded-sm bg-amber-300/80" />)}
      <span className="grid grid-cols-5 gap-0.5">
        {Array.from({ length: ones }, (_, i) => <span key={`o${i}`} className="block w-1.5 h-1.5 rounded-full bg-amber-200/90" />)}
      </span>
    </div>
  );
};

/** `model_match` lever: two rows of dots from a pair the item does not use, joined in pairs, the extras ringed. */
const ModelMatch = ({ pair }: { pair: readonly [number, number] }) => {
  const [top, bottom] = pair, gap = 22, width = top * gap + 12;
  return (
    <svg data-lever="model-match" width={width} height={62} viewBox={`0 0 ${width} 62`} role="img"
      aria-label="A model: two rows of dots joined in pairs, the extra dots ringed">
      {Array.from({ length: bottom }, (_, i) => (
        <line key={`l${i}`} x1={12 + i * gap} y1={16} x2={12 + i * gap} y2={46} stroke="rgba(168,85,247,0.5)" strokeWidth={1.5} strokeDasharray="3 2" />
      ))}
      {Array.from({ length: top }, (_, i) => (
        <g key={`t${i}`}>
          {i >= bottom && <circle cx={12 + i * gap} cy={12} r={9} fill="none" stroke="rgba(249,115,22,0.6)" strokeWidth={1.5} strokeDasharray="3 2" />}
          <circle cx={12 + i * gap} cy={12} r={5} fill="rgba(249,115,22,0.8)" />
        </g>
      ))}
      {Array.from({ length: bottom }, (_, i) => <circle key={`b${i}`} cx={12 + i * gap} cy={50} r={5} fill="rgba(59,130,246,0.8)" />)}
    </svg>
  );
};

const useComparisonProgress = useWorkspaceProgressFor('comparison-builder');

const ComparisonBuilderSurface = ({ data, className, runtimePlanItemId }: ComparisonBuilderProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    showCorrespondenceLines = true,
    useAlligatorMnemonic = true,
    // New scaffold fields default to CURRENT behavior so a no-tier session is
    // byte-identical: badges shown, lines on-check, target marker on, slot hints on.
    showCountBadges = true,
    correspondenceMode = 'on-check',
    showTargetMarker = true,
    showSlotHints = true,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Challenge progress: the teaching workspace owns it and moves the index.
  // -------------------------------------------------------------------------
  // The lesson's items: each challenge with the grade band and tier its ask, key and model lever read.
  const items = useMemo(() => comparisonItems({ challenges, gradeBand, supportTier }), [challenges, gradeBand, supportTier]);
  const stableInstanceIdRef = useRef(instanceId || `comparison-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  // A fresh challenge and Try again both start from an empty answer (bound below, once the setters exist).
  const openItem = useRef<(retry: boolean) => void>(() => {});
  /** Bound below; a spoken answer the observer credited (`onSolved`). */
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  /** The challenge a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);
  const progress = useComparisonProgress({
    challenges: items,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: comparisonBuilderBoss.assignment,
    onItemOpened: (_index, retry) => openItem.current(retry),
    onSolved: (index) => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
  } = progress;
  /** A checked answer stays closed until Try again or the next challenge. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The primitive's own check is the workspace's checked gesture. A ref, so the check callbacks keep their deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // -------------------------------------------------------------------------
  // Domain-specific state
  // -------------------------------------------------------------------------
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [orderedNumbers, setOrderedNumbers] = useState<number[]>([]);
  const [oneMoreAnswer, setOneMoreAnswer] = useState<number | null>(null);
  const [oneLessAnswer, setOneLessAnswer] = useState<number | null>(null);
  const [showLines, setShowLines] = useState(false);
  // In-item levers (`comparisonBuilderLevers.ts`), keyed by the session item they were pulled on; the easier item a
  // simplify lever put on screen in its place; and, under `tap_count`, the objects the learner has tapped, in order.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ComparisonItem | null>(null);
  const [tapped, setTapped] = useState<{ left: number[]; right: number[] }>({ left: [], right: [] });
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Transient grading flash for the order slots — drives the shared drop-zone
  // motion (pop/shake) off the same checkOrder result, then settles to filled.
  const [orderFlash, setOrderFlash] = useState<'correct' | 'incorrect' | null>(null);
  const orderFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => { if (orderFlashTimer.current) clearTimeout(orderFlashTimer.current); },
    [],
  );

  // Rule-5 feedback-on-the-object (K band): a wrong tap flashes/shakes the TAPPED
  // object itself instead of a text card (the card is hidden at K; SFX + spoken
  // hint still carry it). `wrongFlash` holds a per-element key — 'more'/'less'/
  // 'equal' (compare-groups), 'num-<symbol>' (compare-numbers), 'more-<n>'/
  // 'less-<n>' (one-more-one-less) — that the render matches to apply motion.shake.
  // Self-clears after the 350ms shake so a re-tap can re-arm it. Precedent:
  // rhyme-studio / word-workout rule-5 treatment (ring/shake + SFX, no text card).
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const wrongFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => { if (wrongFlashTimer.current) clearTimeout(wrongFlashTimer.current); },
    [],
  );
  const flashWrong = useCallback((key: string) => {
    if (wrongFlashTimer.current) clearTimeout(wrongFlashTimer.current);
    // Re-arm cleanly if the same key shakes twice in a row (null → key on the next frame).
    setWrongFlash(null);
    setWrongFlash(key);
    wrongFlashTimer.current = setTimeout(() => setWrongFlash(null), 600);
  }, []);
  /** `tap_count`: the learner taps an object to count it; each object counts once. Counting is never an answer. */
  const tapObject = useCallback((side: 'left' | 'right', index: number) => {
    SoundManager.select();
    setTapped(prev => prev[side].includes(index) ? prev : { ...prev, [side]: [...prev[side], index] });
  }, []);

  // K (pre-reader) is a hard band gate: at K the answer surface is picture-primary
  // and the adult chrome (mode tabs, counter, grade/type badges, count badges) is
  // hidden — it either strands or hands the answer to a non-reader.
  const isK = gradeBand === 'K';

  // Current challenge
  const sessionChallenge = useMemo<ComparisonItem | null>(
    () => items[currentChallengeIndex] || null,
    [items, currentChallengeIndex],
  );
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];

  // Shuffled numbers for order challenges. Derived in render, not set from an effect: an
  // effect painted the previous item's cards for one commit, and on the workspace path that
  // extra scene revision superseded the advance's visible receipt.
  const shuffledNumbers = useMemo(() => {
    if (currentChallenge?.type !== 'order' || !currentChallenge.numbers) return [];
    const nums = [...currentChallenge.numbers];
    // Simple deterministic shuffle seeded by challenge index
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.abs(((currentChallengeIndex + 1) * 7 + i * 13) % (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    return nums;
  }, [currentChallenge, currentChallengeIndex]);

  // ── Misconception Loop S1 — session-scoped wrong-answer log ────────────────
  // Every wrong submit appends one observation (what was asked, what the
  // student picked, what was expected). On a failed session these become the
  // Tier-B DiagnosisEvidence packet. DATA only — the shared distiller
  // diagnoses; nothing here is ever student-visible.
  const wrongObservationsRef = useRef<
    Array<{ challenge: string; observed: string; expected: string }>
  >([]);

  const noteWrongAnswer = useCallback(
    (asked: string, observedVal: string, expectedVal: string) => {
      const instr = currentChallenge?.instruction
        ? `"${currentChallenge.instruction}"`
        : `a ${currentChallenge?.type ?? 'comparison'} challenge`;
      // Bounded: keep the most recent 8 observations.
      const log = wrongObservationsRef.current;
      log.push({
        challenge: `${instr} — ${asked}`,
        observed: observedVal,
        expected: expectedVal,
      });
      if (log.length > 8) log.shift();
    },
    [currentChallenge],
  );

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ComparisonBuilderMetrics>({
    primitiveType: 'comparison-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // Check Answer — compare-groups
  // -------------------------------------------------------------------------
  const checkCompareGroups = useCallback((answerArg?: 'more' | 'less' | 'equal') => {
    // answerArg lets the K tap=choose path evaluate the just-tapped side without
    // waiting for setSelectedAnswer to flush; the Grade-1 Check path passes nothing.
    const answer = answerArg ?? selectedAnswer;
    if (!currentChallenge || !answer) return false;
    const correct = answer === currentChallenge.correctAnswer;
    const leftCount = currentChallenge.leftGroup?.count ?? 0;
    const rightCount = currentChallenge.rightGroup?.count ?? 0;
    const view = { selected: answer, ordered: [], oneMore: null, oneLess: null };
    if (correct) tappedCorrect.current = currentChallenge.id;
    commitCheck.current(describeComparison(currentChallenge, view), correct, comparisonMiss(currentChallenge, view));

    if (correct) {
      const answerWord = currentChallenge.correctAnswer === 'equal' ? 'the same as' : `${currentChallenge.correctAnswer === 'more' ? 'more' : 'fewer'} than`;
      setFeedback(
        `That's right! The left group (${leftCount}) has ${answerWord} the right group (${rightCount})!`,
      );
      setFeedbackType('success');
      setShowLines(true);
    } else {
      setFeedback('Not quite — count each group carefully and try again!');
      setFeedbackType('error');
      noteWrongAnswer(
        `compare the groups (left: ${leftCount} ${currentChallenge.leftGroup?.objectType ?? 'objects'}, right: ${rightCount} ${currentChallenge.rightGroup?.objectType ?? 'objects'})`,
        `picked "${answer}" for the left group`,
        `the left group has "${currentChallenge.correctAnswer}" (left ${leftCount} vs right ${rightCount})`,
      );
    }

    return correct;
  }, [
    currentChallenge, selectedAnswer, noteWrongAnswer,
  ]);

  // -------------------------------------------------------------------------
  // K tap=choose — the pre-reader taps the SIDE with more (or the equals in the
  // middle for "same"). The pictures are the answer surface; there is no text
  // "More/Fewer/The Same" to read and no separate Check button. Tapping a side
  // both selects and evaluates in one action (band contract rules 2, 3, 8).
  //   tap LEFT  → asserting the left group has more  → 'more'
  //   tap RIGHT → asserting the right group has more → left has 'less'
  //   tap SAME  → 'equal'
  // -------------------------------------------------------------------------
  const handleTapSide = useCallback(
    (answer: 'more' | 'less' | 'equal') => {
      // Inline the completion check (isCurrentChallengeComplete is declared later
      // in the body — referencing it in the dep array would hit the TDZ).
      const alreadySolved = challengeResults.some(
        (r) => r.challengeId === currentChallenge?.id && r.correct,
      );
      if (learnerBlocked() || !currentChallenge || alreadySolved || allChallengesComplete) return;
      setSelectedAnswer(answer);
      const correct = checkCompareGroups(answer);
      if (correct) {
        SoundManager.playCorrect();
      } else {
        SoundManager.playIncorrect();
        // Rule-5: the wrong feedback lands on the tapped side (shake), not a text card.
        flashWrong(answer);
      }
    },
    [
      currentChallenge, challengeResults, allChallengesComplete,
      checkCompareGroups, flashWrong,
    ],
  );

  // -------------------------------------------------------------------------
  // Check Answer — compare-numbers
  // -------------------------------------------------------------------------
  const checkCompareNumbers = useCallback((answerArg?: '<' | '>' | '=') => {
    // answerArg lets the K tap=choose path (tap the bigger numeral) evaluate the
    // just-derived symbol without waiting for setSelectedAnswer to flush; the
    // Grade-1 Check path passes nothing and reads selectedAnswer.
    const selected = answerArg ?? (selectedAnswer as '<' | '>' | '=' | null);
    if (!currentChallenge || !selected) return false;
    const correct = selected === currentChallenge.correctSymbol;
    const view = { selected, ordered: [], oneMore: null, oneLess: null };
    if (correct) tappedCorrect.current = currentChallenge.id;
    commitCheck.current(describeComparison(currentChallenge, view), correct, comparisonMiss(currentChallenge, view));

    if (correct) {
      setFeedback(
        `Yes! ${currentChallenge.leftNumber} ${currentChallenge.correctSymbol} ${currentChallenge.rightNumber}`,
      );
      setFeedbackType('success');
    } else {
      setFeedback('Not quite. Think about which number is bigger.');
      setFeedbackType('error');
      noteWrongAnswer(
        `choose the symbol comparing ${currentChallenge.leftNumber} vs ${currentChallenge.rightNumber}`,
        `picked "${selected}"`,
        `the correct symbol is "${currentChallenge.correctSymbol}" (${currentChallenge.leftNumber} ${currentChallenge.correctSymbol} ${currentChallenge.rightNumber})`,
      );
    }

    return correct;
  }, [currentChallenge, selectedAnswer, noteWrongAnswer]);

  // -------------------------------------------------------------------------
  // K tap=choose — compare-numbers. The pre-reader taps the BIGGER numeral
  // directly (K.CC.C.7 = compare two written numerals) instead of reading a
  // <, >, = symbol. The two numeral boxes + a middle "=" ARE the answer surface;
  // the tapped side derives the symbol (tap the bigger → the comparison), so
  // there are no symbol buttons, no alligator, and no Check button at K.
  //   tap LEFT  → asserting left is bigger  → '>'  (left > right)
  //   tap RIGHT → asserting right is bigger → '<'  (left < right)
  //   tap SAME  → '='
  // -------------------------------------------------------------------------
  const handleTapNumberSide = useCallback(
    (symbol: '<' | '>' | '=') => {
      const alreadySolved = challengeResults.some(
        (r) => r.challengeId === currentChallenge?.id && r.correct,
      );
      if (learnerBlocked() || !currentChallenge || alreadySolved || allChallengesComplete) return;
      setSelectedAnswer(symbol);
      const correct = checkCompareNumbers(symbol);
      if (correct) {
        SoundManager.playCorrect();
      } else {
        SoundManager.playIncorrect();
        flashWrong(`num-${symbol}`);
      }
    },
    [
      currentChallenge, challengeResults, allChallengesComplete,
      checkCompareNumbers, flashWrong,
    ],
  );

  // -------------------------------------------------------------------------
  // Check Answer — order
  // -------------------------------------------------------------------------
  const checkOrder = useCallback(() => {
    if (!currentChallenge || !currentChallenge.numbers) return false;
    const expected = [...currentChallenge.numbers].sort((a, b) =>
      currentChallenge.direction === 'descending' ? b - a : a - b,
    );
    const correct =
      orderedNumbers.length === expected.length &&
      orderedNumbers.every((n, i) => n === expected[i]);
    const view = { selected: null, ordered: orderedNumbers, oneMore: null, oneLess: null };
    commitCheck.current(describeComparison(currentChallenge, view), correct, comparisonMiss(currentChallenge, view));

    // Zone-state flash off the same grading result (visual only). Settles at 900 ms.
    if (orderFlashTimer.current) clearTimeout(orderFlashTimer.current);
    setOrderFlash(correct ? 'correct' : 'incorrect');
    orderFlashTimer.current = setTimeout(() => setOrderFlash(null), 900);

    if (correct) {
      setFeedback(`Perfect order! ${orderedNumbers.join(', ')}`);
      setFeedbackType('success');
    } else {
      setFeedback('Not quite the right order. Try again!');
      setFeedbackType('error');
      noteWrongAnswer(
        `order the numbers ${currentChallenge.numbers.join(', ')} ${currentChallenge.direction ?? 'ascending'}`,
        `ordered ${orderedNumbers.join(', ')}`,
        `the correct ${currentChallenge.direction ?? 'ascending'} order is ${expected.join(', ')}`,
      );
    }

    return correct;
  }, [currentChallenge, orderedNumbers, noteWrongAnswer]);

  // -------------------------------------------------------------------------
  // Check Answer — one-more-one-less
  // -------------------------------------------------------------------------
  const checkOneMoreOneLess = useCallback((moreArg?: number | null, lessArg?: number | null) => {
    if (!currentChallenge || currentChallenge.targetNumber === undefined) return false;
    const target = currentChallenge.targetNumber;
    const askFor = currentChallenge.askFor ?? 'both';
    // The K tap=choose path passes the just-tapped value(s) so evaluation doesn't
    // wait for setState to flush; the Grade-1 Check path passes nothing.
    const moreVal = moreArg !== undefined ? moreArg : oneMoreAnswer;
    const lessVal = lessArg !== undefined ? lessArg : oneLessAnswer;

    let correct = false;
    if (askFor === 'one-more') {
      correct = moreVal === target + 1;
    } else if (askFor === 'one-less') {
      correct = lessVal === target - 1;
    } else {
      correct = moreVal === target + 1 && lessVal === target - 1;
    }
    const view = { selected: null, ordered: [], oneMore: moreVal, oneLess: lessVal };
    if (correct) tappedCorrect.current = currentChallenge.id;
    commitCheck.current(describeComparison(currentChallenge, view), correct, comparisonMiss(currentChallenge, view));

    if (correct) {
      const parts: string[] = [];
      if (askFor !== 'one-less') parts.push(`one more is ${target + 1}`);
      if (askFor !== 'one-more') parts.push(`one less is ${target - 1}`);
      setFeedback(`That's right! ${parts.join(' and ')}.`);
      setFeedbackType('success');
    } else {
      setFeedback('Not quite. Think about counting forward or backward by 1.');
      setFeedbackType('error');
      const studentAnswers =
        askFor === 'both'
          ? `one more: ${moreVal ?? '?'}, one less: ${lessVal ?? '?'}`
          : askFor === 'one-more'
            ? `${moreVal ?? '?'}`
            : `${lessVal ?? '?'}`;
      noteWrongAnswer(
        `find one ${askFor === 'both' ? 'more and one less' : askFor === 'one-more' ? 'more' : 'less'} than ${target}`,
        `answered ${studentAnswers}`,
        `one more is ${target + 1}, one less is ${target - 1}`,
      );
    }

    return correct;
  }, [currentChallenge, oneMoreAnswer, oneLessAnswer, noteWrongAnswer]);

  // -------------------------------------------------------------------------
  // K tap=choose — one-more-one-less. Tapping a number cell IS the answer (no
  // Check). For a single ask (one-more OR one-less) the tap is atomic → evaluate
  // at once. For 'both' the first tap gives immediate rule-5 feedback if wrong,
  // then the learner taps the other row; the second tap completes and
  // evaluates. Wrong lands on the tapped cell (shake); correct records +
  // advances. Grade-1 keeps the Check-button path (handleCheckAnswer).
  // -------------------------------------------------------------------------
  const handleTapOneMoreLess = useCallback(
    (which: 'more' | 'less', n: number) => {
      const alreadySolved = challengeResults.some(
        (r) => r.challengeId === currentChallenge?.id && r.correct,
      );
      if (learnerBlocked() || !currentChallenge || currentChallenge.type !== 'one-more-one-less'
        || alreadySolved || allChallengesComplete) return;
      const target = currentChallenge.targetNumber ?? 0;
      const askFor = currentChallenge.askFor ?? 'both';

      if (which === 'more') setOneMoreAnswer(n); else setOneLessAnswer(n);

      const nextMore = which === 'more' ? n : oneMoreAnswer;
      const nextLess = which === 'less' ? n : oneLessAnswer;
      const ready =
        askFor === 'one-more' ? nextMore !== null
          : askFor === 'one-less' ? nextLess !== null
            : nextMore !== null && nextLess !== null;

      if (!ready) {
        // 'both', only one part answered — immediate feedback if THIS part is wrong;
        // otherwise wait for the other row's tap.
        const partCorrect = which === 'more' ? n === target + 1 : n === target - 1;
        if (!partCorrect) {
          SoundManager.playIncorrect();
          flashWrong(`${which}-${n}`);
        } else {
          // First part accepted: a soft tick; the other row is still open.
          SoundManager.select();
        }
        return;
      }

      const correct = checkOneMoreOneLess(nextMore, nextLess);
      if (correct) {
        SoundManager.playCorrect();
      } else {
        SoundManager.playIncorrect();
        flashWrong(`${which}-${n}`);
      }
    },
    [
      currentChallenge, challengeResults, allChallengesComplete,
      oneMoreAnswer, oneLessAnswer,
      checkOneMoreOneLess, flashWrong,
    ],
  );

  // -------------------------------------------------------------------------
  // Master check handler
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (learnerBlocked() || !currentChallenge) return;

    let correct = false;
    switch (currentChallenge.type) {
      case 'compare-groups':
        correct = checkCompareGroups();
        break;
      case 'compare-numbers':
        correct = checkCompareNumbers();
        break;
      case 'order':
        correct = checkOrder();
        break;
      case 'one-more-one-less':
        correct = checkOneMoreOneLess();
        break;
    }

    if (correct) {
      SoundManager.playCorrect();
    } else {
      SoundManager.playIncorrect();
    }
  }, [
    currentChallenge,
    checkCompareGroups, checkCompareNumbers, checkOrder, checkOneMoreOneLess,
  ]);

  // -------------------------------------------------------------------------
  // Item lifecycle
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  /** Everything a fresh challenge starts without. */
  const resetForNewChallenge = () => {
    setSelectedAnswer(null);
    setOrderedNumbers([]);
    setOneMoreAnswer(null);
    setOneLessAnswer(null);
    setShowLines(false);
    setFeedback('');
    setFeedbackType('');
    setOrderFlash(null);
    if (orderFlashTimer.current) clearTimeout(orderFlashTimer.current);
    setWrongFlash(null);
    if (wrongFlashTimer.current) clearTimeout(wrongFlashTimer.current);
    setPractice(null);
    setTapped({ left: [], right: [] });
  };

  // Completion: once every challenge is solved, submit once (only under an evaluation provider; the live host has none).
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || submittedRef.current || challenges.length === 0) return;
    if (progress.recordsEvaluation === false) return;
    submittedRef.current = true;
    const totalCorrect = challengeResults.filter((r) => r.correct).length;
    const overallAccuracy = Math.round((totalCorrect / challenges.length) * 100);

    const accuracyByType = (type: string) => {
      const chs = challenges.filter((c) => c.type === type);
      const rs = challengeResults.filter((r) => chs.some((c) => c.id === r.challengeId));
      if (chs.length === 0) return -1;
      return Math.round((rs.filter((r) => r.correct).length / chs.length) * 100);
    };

    const symbolChallenges = challenges.filter((c) => c.type === 'compare-numbers');
    const symbolCorrect = challengeResults.filter((r) =>
      symbolChallenges.some((c) => c.id === r.challengeId && r.correct),
    ).length;

    const metrics: ComparisonBuilderMetrics = {
      type: 'comparison-builder',
      overallAccuracy,
      compareGroupsAccuracy: accuracyByType('compare-groups'),
      compareNumbersAccuracy: accuracyByType('compare-numbers'),
      orderAccuracy: accuracyByType('order'),
      oneMoreOneLessAccuracy: accuracyByType('one-more-one-less'),
      symbolsCorrect: symbolCorrect,
      symbolsTotal: symbolChallenges.length,
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };

    // Misconception Loop S1 — Tier-B evidence packet on failed sessions. The latest wrong observation is the
    // headline; earlier ones become priorAttempts (the consistency signal the distiller needs to tell a mental model
    // from a slip). Clean sessions carry no packet.
    const goalMet = totalCorrect === challenges.length;
    const wrongs = wrongObservationsRef.current;
    const latest = wrongs[wrongs.length - 1];
    const diagnosisEvidence: DiagnosisEvidence | undefined = !goalMet && latest
      ? {
          challengeSummary: latest.challenge,
          expected: latest.expected,
          observed: latest.observed,
          priorAttempts: wrongs.slice(0, -1).map((w) => ({ challenge: w.challenge, observed: w.observed })),
        }
      : undefined;

    submitEvaluation(goalMet, overallAccuracy, metrics, { challengeResults }, undefined, diagnosisEvidence);
  }, [allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults, submitEvaluation, progress.recordsEvaluation]);

  /**
   * Clear THIS response and nothing else — attempts, recorded results and any
   * assistance history all survive. `retry` calls exactly this, so the tutor's
   * clear and a learner's clear are the same operation.
   */
  const clearResponse = useCallback(() => {
    setSelectedAnswer(null);
    setOrderedNumbers([]);
    setOneMoreAnswer(null);
    setOneLessAnswer(null);
    setFeedback('');
    setFeedbackType('');
    setOrderFlash(null);
    if (orderFlashTimer.current) clearTimeout(orderFlashTimer.current);
    setWrongFlash(null);
    if (wrongFlashTimer.current) clearTimeout(wrongFlashTimer.current);
    setTapped({ left: [], right: [] });
  }, []);
  // Try again clears this response (an easier practice item stays); a fresh challenge clears everything.
  openItem.current = retry => { if (retry) clearResponse(); else resetForNewChallenge(); };

  // A spoken answer the observer credited (`onSolved` fires once per challenge, for a tap too): the result a correct
  // tap records, and the credited choice shown as a tap would show it. The shared lifecycle plays the success sound.
  solvedAloud.current = (index) => {
    const solved = challenges[index];
    if (!solved || tappedCorrect.current === solved.id) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    if (solved.type === 'compare-groups') { setSelectedAnswer(solved.correctAnswer ?? null); setShowLines(true); }
    else if (solved.type === 'compare-numbers') setSelectedAnswer(solved.correctSymbol ?? null);
    else if (solved.type === 'one-more-one-less' && solved.targetNumber !== undefined) {
      if ((solved.askFor ?? 'both') === 'one-more') setOneMoreAnswer(solved.targetNumber + 1);
      else setOneLessAnswer(solved.targetNumber - 1);
    }
    setFeedback("That's right!");
    setFeedbackType('success');
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    if (practice.type === 'compare-groups') { setSelectedAnswer(practice.correctAnswer ?? null); setShowLines(true); }
    else if (practice.type === 'compare-numbers') setSelectedAnswer(practice.correctSymbol ?? null);
    else if (practice.type === 'one-more-one-less' && practice.targetNumber !== undefined) {
      if ((practice.askFor ?? 'both') === 'one-more') setOneMoreAnswer(practice.targetNumber + 1);
      else setOneLessAnswer(practice.targetNumber - 1);
    }
    setFeedback("That's right!");
    setFeedbackType('success');
  };

  // What the tutor and the observer are shown, republished every render.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    const leverCtx = { tapped: { left: tapped.left.length, right: tapped.right.length } };
    const scene = comparisonScene(currentChallenge, { selected: selectedAnswer, ordered: orderedNumbers,
      oneMore: oneMoreAnswer, oneLess: oneLessAnswer, shuffled: shuffledNumbers,
      countsShown: showCountBadges && !isK && isCurrentChallengeComplete,
      alligator: currentChallenge.type === 'compare-numbers' && !isK && useAlligatorMnemonic && !isCurrentChallengeComplete });
    const levers = practice || !sessionChallenge ? [] : COMPARISON_LEVERS.declare(sessionChallenge, leverCtx, pulledLevers);
    // On the easier item the session item's pulls stay drawn, so the scene names what is drawn on it.
    const onScreen = COMPARISON_LEVERS.onScreen(currentChallenge, leverCtx, pulledLevers);
    workspace.current = {
      ...leverScene(scene, { support: COMPARISON_LEVERS.support(practice ? null : sessionChallenge, leverCtx), onScreen }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionChallenge || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = COMPARISON_LEVERS.simpler(sessionChallenge, leverCtx, id);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState(pulled);
          clearResponse(); setShowLines(false); setPractice(easier);
          return { practice: comparisonBuilderBoss.assignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { clearResponse(); setShowLines(false); setPractice(null); },
    };
  });

  // Overall score
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter((r) => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // -------------------------------------------------------------------------
  // Can-check guard
  // -------------------------------------------------------------------------
  const canCheck = useMemo(() => {
    if (!currentChallenge || isCurrentChallengeComplete || allChallengesComplete) return false;
    switch (currentChallenge.type) {
      case 'compare-groups':
      case 'compare-numbers':
        return !!selectedAnswer;
      case 'order':
        return orderedNumbers.length === (currentChallenge.numbers?.length ?? 0);
      case 'one-more-one-less': {
        const askFor = currentChallenge.askFor ?? 'both';
        if (askFor === 'one-more') return oneMoreAnswer !== null;
        if (askFor === 'one-less') return oneLessAnswer !== null;
        return oneMoreAnswer !== null && oneLessAnswer !== null;
      }
      default:
        return false;
    }
  }, [
    currentChallenge, isCurrentChallengeComplete, allChallengesComplete,
    selectedAnswer, orderedNumbers, oneMoreAnswer, oneLessAnswer,
  ]);

  // =========================================================================
  // Render: compare-groups
  // =========================================================================
  const renderCompareGroups = () => {
    if (!currentChallenge || currentChallenge.type !== 'compare-groups') return null;

    const left = currentChallenge.leftGroup ?? { count: 3, objectType: 'stars' };
    const right = currentChallenge.rightGroup ?? { count: 5, objectType: 'stars' };
    const leftEmoji = OBJECT_EMOJI[left.objectType] || '⭐';
    const rightEmoji = OBJECT_EMOJI[right.objectType] || '⭐';

    // K (pre-reader) uses tap=choose directly on the group pictures — the two
    // groups and a middle "=" ARE the answer surface, no text buttons, no Check.
    const kTapMode = gradeBand === 'K';
    const tappable = kTapMode && !isCurrentChallengeComplete && !allChallengesComplete;
    const sameCx = GROUP_WIDTH + GAP / 2;
    const sameCy = (GROUP_HEIGHT + 12) / 2 + 4;

    // HARD tier (correspondenceMode 'off') scatters the objects so the student
    // can't read the quantity off the grid arrangement.
    const scattered = correspondenceMode === 'off';
    const leftPositions = scattered
      ? generateScatterPositions(left.count, 0, 20)
      : generateGridPositions(left.count, 0, 20);
    const rightPositions = scattered
      ? generateScatterPositions(right.count, GROUP_WIDTH + GAP, 20)
      : generateGridPositions(right.count, GROUP_WIDTH + GAP, 20);
    const pairCount = Math.min(left.count, right.count);
    const tapCountOn = pulledLevers.includes(TAP_LEVER) && !isCurrentChallengeComplete;
    const model = pulledLevers.includes(MATCH_LEVER) ? modelPair(currentChallenge) : null;

    // Correspondence lines are a reveal, never shown during the solve: the unmatched
    // leftovers ARE the answer. 'off' never draws them; 'on-check' (and a legacy
    // 'live' payload) offers them once the item is answered.
    const linesVisible =
      showCorrespondenceLines && correspondenceMode !== 'off' && showLines && isCurrentChallengeComplete;

    return (
      <div className="space-y-4">
        {/* SVG workspace */}
        <div className="flex justify-center">
          <svg
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="max-w-full h-auto"
          >
            {/* Left group bg — tappable "left has more" target at K */}
            <rect
              x={4} y={4}
              width={GROUP_WIDTH - 8} height={GROUP_HEIGHT + 12}
              rx={12}
              fill={selectedAnswer === 'more' ? 'rgba(249,115,22,0.16)' : 'rgba(249,115,22,0.06)'}
              stroke={selectedAnswer === 'more' ? 'rgba(249,115,22,0.9)' : 'rgba(249,115,22,0.2)'}
              strokeWidth={selectedAnswer === 'more' ? 3 : 1.5}
              style={{ cursor: tappable ? 'pointer' : 'default' }}
              className={wrongFlash === 'more' ? motion.shake : undefined}
              onClick={tappable ? () => handleTapSide('more') : undefined}
            />
            <text
              x={GROUP_WIDTH / 2} y={GROUP_HEIGHT + 32}
              textAnchor="middle" fontSize={13}
              fill="rgba(249,115,22,0.7)"
              className="select-none pointer-events-none"
            >
              Left
            </text>

            {/* Right group bg — tappable "right has more" (left has less) target at K */}
            <rect
              x={GROUP_WIDTH + GAP + 4} y={4}
              width={GROUP_WIDTH - 8} height={GROUP_HEIGHT + 12}
              rx={12}
              fill={selectedAnswer === 'less' ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.06)'}
              stroke={selectedAnswer === 'less' ? 'rgba(59,130,246,0.9)' : 'rgba(59,130,246,0.2)'}
              strokeWidth={selectedAnswer === 'less' ? 3 : 1.5}
              style={{ cursor: tappable ? 'pointer' : 'default' }}
              className={wrongFlash === 'less' ? motion.shake : undefined}
              onClick={tappable ? () => handleTapSide('less') : undefined}
            />
            <text
              x={GROUP_WIDTH + GAP + GROUP_WIDTH / 2} y={GROUP_HEIGHT + 32}
              textAnchor="middle" fontSize={13}
              fill="rgba(59,130,246,0.7)"
              className="select-none pointer-events-none"
            >
              Right
            </text>

            {/* Middle "=" — tappable "the same" target at K only. The two groups
                already carry the more/less choice; this gives the equal case a
                picture-primary affordance instead of a text button. */}
            {kTapMode && (
              <g
                style={{ cursor: tappable ? 'pointer' : 'default' }}
                className={wrongFlash === 'equal' ? motion.shake : undefined}
                onClick={tappable ? () => handleTapSide('equal') : undefined}
              >
                <circle
                  cx={sameCx} cy={sameCy} r={26}
                  fill={selectedAnswer === 'equal' ? 'rgba(168,85,247,0.22)' : 'rgba(168,85,247,0.08)'}
                  stroke={selectedAnswer === 'equal' ? 'rgba(168,85,247,0.9)' : 'rgba(168,85,247,0.35)'}
                  strokeWidth={selectedAnswer === 'equal' ? 3 : 2}
                />
                <text
                  x={sameCx} y={sameCy}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={26} fontWeight={700}
                  fill="rgba(216,180,254,0.95)"
                  className="select-none pointer-events-none"
                >
                  =
                </text>
              </g>
            )}

            {/* Correspondence lines */}
            {linesVisible && (
              <>
                {Array.from({ length: pairCount }, (_, i) => (
                  <line
                    key={`line-${i}`}
                    x1={leftPositions[i].x} y1={leftPositions[i].y}
                    x2={rightPositions[i].x} y2={rightPositions[i].y}
                    stroke="rgba(168,85,247,0.4)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                ))}
              </>
            )}

            {/* Left objects */}
            {leftPositions.map((pos, i) => {
              const isLeftover = linesVisible && i >= pairCount;
              const tapNumber = tapped.left.indexOf(i) + 1;
              return (
                <g key={`left-${i}`}>
                  {/* tap_count lever: the object itself is a tap target that stamps its count on this side, and
                      never answers (it stops the tap reaching the group box, which is the K answer surface). */}
                  {tapCountOn && (
                    <circle
                      data-lever="tap-count" data-side="left" data-index={i}
                      cx={pos.x} cy={pos.y} r={16} fill="transparent" pointerEvents="all"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); tapObject('left', i); }}
                    />
                  )}
                  {tapNumber > 0 && (
                    <text x={pos.x + 13} y={pos.y - 12} textAnchor="middle" fontSize={12} fontWeight={700}
                      fill="rgba(249,115,22,0.95)" className="select-none pointer-events-none" data-lever="tap-number">{tapNumber}</text>
                  )}
                  {isLeftover && (
                    <circle
                      cx={pos.x} cy={pos.y} r={18}
                      fill="none"
                      stroke="rgba(249,115,22,0.5)"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  )}
                  <text
                    x={pos.x} y={pos.y}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={24}
                    className="select-none pointer-events-none"
                  >
                    {leftEmoji}
                  </text>
                </g>
              );
            })}

            {/* Right objects */}
            {rightPositions.map((pos, i) => {
              const isLeftover = linesVisible && i >= pairCount;
              const tapNumber = tapped.right.indexOf(i) + 1;
              return (
                <g key={`right-${i}`}>
                  {/* tap_count lever: the object itself is a tap target that stamps its count on this side, and
                      never answers (it stops the tap reaching the group box, which is the K answer surface). */}
                  {tapCountOn && (
                    <circle
                      data-lever="tap-count" data-side="right" data-index={i}
                      cx={pos.x} cy={pos.y} r={16} fill="transparent" pointerEvents="all"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); tapObject('right', i); }}
                    />
                  )}
                  {tapNumber > 0 && (
                    <text x={pos.x + 13} y={pos.y - 12} textAnchor="middle" fontSize={12} fontWeight={700}
                      fill="rgba(59,130,246,0.95)" className="select-none pointer-events-none" data-lever="tap-number">{tapNumber}</text>
                  )}
                  {isLeftover && (
                    <circle
                      cx={pos.x} cy={pos.y} r={18}
                      fill="none"
                      stroke="rgba(59,130,246,0.5)"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  )}
                  <text
                    x={pos.x} y={pos.y}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={24}
                    className="select-none pointer-events-none"
                  >
                    {rightEmoji}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {model && (
          <div className="flex justify-center">
            <ModelMatch pair={model} />
          </div>
        )}

        {/* Count labels — a reveal after answering, never during the solve: two
            printed totals turn "which group has more" into a numeral comparison.
            Withdrawn entirely at the HARD tier (showCountBadges=false) and at K
            (band gate; reader-fit Audit A flagged them as a count leak). */}
        {showCountBadges && !isK && isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-8 text-sm">
            <span className="text-orange-300">
              Left: <span className="font-bold text-lg">{left.count}</span>
            </span>
            <span className="text-slate-500">vs</span>
            <span className="text-blue-300">
              Right: <span className="font-bold text-lg">{right.count}</span>
            </span>
          </div>
        )}

        {/* Answer buttons — Grade 1+. At K the tappable groups + middle "=" ARE
            the answer surface (tap=choose, picture-primary), so no text options. */}
        {!isCurrentChallengeComplete && !kTapMode && (
          <div className="space-y-2">
            <p className="text-center text-sm text-slate-400">
              The <span className="text-orange-300 font-semibold">left</span> group has…
            </p>
            <div className="flex justify-center gap-3">
              {(['more', 'less', 'equal'] as const).map((answer) => (
                <button
                  key={answer}
                  type="button"
                  className={`rounded-xl border px-6 py-3 text-base transition-all ${answerStateClass(
                    selectedAnswer === answer ? 'selected' : 'idle',
                  )}`}
                  onClick={() => {
                    if (learnerBlocked()) return;
                    SoundManager.select();
                    setSelectedAnswer(answer);
                  }}
                >
                  {answer === 'equal' ? 'The Same' : answer === 'more' ? 'More' : 'Fewer'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toggle correspondence lines button — offered after answering unless
            the tier withholds lines entirely ('off'). */}
        {showCorrespondenceLines && correspondenceMode !== 'off' && !showLines && isCurrentChallengeComplete && (
          <div className="flex justify-center">
            <LuminaButton
              tone="subtle"
              className="text-xs"
              onClick={() => setShowLines(true)}
            >
              Show matching lines
            </LuminaButton>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Render: compare-numbers
  // =========================================================================
  const renderCompareNumbers = () => {
    if (!currentChallenge || currentChallenge.type !== 'compare-numbers') return null;

    const left = currentChallenge.leftNumber ?? 0;
    const right = currentChallenge.rightNumber ?? 0;
    const marksOn = pulledLevers.includes(MARKS_LEVER);

    // K (pre-reader) picture-primary tap=choose: the child taps the BIGGER numeral
    // directly (K.CC.C.7 = compare two written numerals) instead of reading a
    // <, >, = symbol. The two numeral boxes + a middle "=" ARE the answer surface;
    // tap the bigger side (or "=" if equal), the tap derives the symbol and
    // evaluates — no symbol buttons, no alligator mnemonic, no Check button.
    if (isK) {
      const kTappable = !isCurrentChallengeComplete && !allChallengesComplete;
      // tap left → assert left bigger → '>'; tap right → '<'; tap "=" → '='.
      const numberBox = (
        value: number,
        symbol: '<' | '>' | '=',
        colorClass: string,
      ) => {
        const chosen = selectedAnswer === symbol;
        return (
          <button
            type="button"
            disabled={!kTappable}
            onClick={() => kTappable && handleTapNumberSide(symbol)}
            className={`w-28 h-28 rounded-2xl border-2 flex items-center justify-center transition-all ${colorClass} ${
              chosen ? 'ring-4 ring-white/40' : ''
            } ${wrongFlash === `num-${symbol}` ? motion.shake : ''}`}
          >
            <span className="text-5xl font-bold">{value}</span>
          </button>
        );
      };
      return (
        <div>
        <div className="flex items-center justify-center gap-4">
          {numberBox(left, '>', 'bg-orange-500/10 border-orange-400/40 text-orange-300')}
          {/* Middle "=" — tappable "the same" target, mirrors compare-groups. */}
          <button
            type="button"
            disabled={!kTappable}
            onClick={() => kTappable && handleTapNumberSide('=')}
            aria-label="the same"
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all text-3xl font-bold ${
              selectedAnswer === '='
                ? 'bg-purple-500/20 border-purple-400/90 text-purple-200 ring-4 ring-white/30'
                : 'bg-purple-500/8 border-purple-400/40 text-purple-300'
            } ${wrongFlash === 'num-=' ? motion.shake : ''}`}
          >
            =
          </button>
          {numberBox(right, '<', 'bg-blue-500/10 border-blue-400/40 text-blue-300')}
        </div>
        {marksOn && (
          <div className="flex items-start justify-center gap-4 mt-3">
            <div className="w-28"><QuantityMarks n={left} /></div>
            <div className="w-16" />
            <div className="w-28"><QuantityMarks n={right} /></div>
          </div>
        )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Large number display with symbol slot */}
        <div className="flex items-center justify-center gap-6">
          <div className="w-28 h-28 flex items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-400/30">
            <span className="text-5xl font-bold text-orange-300">{left}</span>
          </div>

          <div className="w-20 h-20 flex items-center justify-center rounded-xl bg-slate-800/40 border border-white/10">
            {selectedAnswer ? (
              <AlligatorSymbol
                symbol={selectedAnswer as '<' | '>' | '='}
                size={40}
                useAlligator={useAlligatorMnemonic}
              />
            ) : (
              <span className="text-2xl text-slate-600">?</span>
            )}
          </div>

          <div className="w-28 h-28 flex items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-400/30">
            <span className="text-5xl font-bold text-blue-300">{right}</span>
          </div>
        </div>

        {marksOn && (
          <div className="flex items-start justify-center gap-6">
            <div className="w-28"><QuantityMarks n={left} /></div>
            <div className="w-20" />
            <div className="w-28"><QuantityMarks n={right} /></div>
          </div>
        )}

        {/* Alligator hint */}
        {useAlligatorMnemonic && !isCurrentChallengeComplete && (
          <p className="text-center text-slate-500 text-xs italic">
            The alligator always eats the bigger number!
          </p>
        )}

        {/* Symbol buttons */}
        {!isCurrentChallengeComplete && (
          <div className="flex justify-center gap-3">
            {(['<', '>', '='] as const).map((symbol) => (
              <button
                key={symbol}
                type="button"
                className={`w-16 h-20 rounded-xl border text-2xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${answerStateClass(
                  selectedAnswer === symbol ? 'selected' : 'idle',
                )}`}
                onClick={() => {
                  if (learnerBlocked()) return;
                  SoundManager.select();
                  setSelectedAnswer(symbol);
                }}
              >
                {useAlligatorMnemonic && symbol !== '=' ? (
                  <>
                    <AlligatorSymbol symbol={symbol} size={28} useAlligator />
                    <span className="text-xs text-slate-500 font-mono">{symbol}</span>
                  </>
                ) : (
                  symbol
                )}
              </button>
            ))}
          </div>
        )}

        {/* Confirmed answer */}
        {isCurrentChallengeComplete && (
          <div className="flex items-center justify-center gap-3 text-2xl">
            <span className="text-orange-300 font-bold">{left}</span>
            <AlligatorSymbol
              symbol={currentChallenge.correctSymbol ?? '='}
              size={36}
              useAlligator={useAlligatorMnemonic}
            />
            <span className="text-blue-300 font-bold">{right}</span>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Render: order
  // =========================================================================
  const renderOrder = () => {
    if (!currentChallenge || currentChallenge.type !== 'order') return null;

    const direction = currentChallenge.direction ?? 'ascending';
    const totalSlots = currentChallenge.numbers?.length ?? 0;
    const availableNumbers = shuffledNumbers.filter(
      (n) => !orderedNumbers.includes(n),
    );
    const stepsOn = pulledLevers.includes(STEPS_LEVER);
    const cardMarksOn = pulledLevers.includes(MARKS_LEVER);

    return (
      <div className="space-y-5">
        {/* Direction cue. Grade-1 reads the text badge; at K (band gate) the
            direction is WORDLESS — three graduated bars matching the fill order:
            short→tall = put the smallest on the left (ascending), tall→short =
            biggest on the left (descending). The bar heights ARE the instruction,
            so a non-reader sees which way to build without decoding the words. */}
        <div className="flex justify-center">
          {isK ? (
            <svg
              width={104} height={44} viewBox="0 0 104 44"
              role="img"
              aria-label={direction === 'ascending' ? 'smallest to biggest' : 'biggest to smallest'}
            >
              {[0, 1, 2].map((i) => {
                const h = direction === 'ascending' ? 12 + i * 12 : 36 - i * 12;
                return (
                  <rect
                    key={i}
                    x={8 + i * 32} y={40 - h}
                    width={22} height={h} rx={4}
                    fill="rgba(168,85,247,0.45)"
                    stroke="rgba(168,85,247,0.7)"
                    strokeWidth={1.5}
                  />
                );
              })}
            </svg>
          ) : (
            <LuminaBadge accent="purple" className="text-xs">
              {direction === 'ascending' ? 'Least → Greatest' : 'Greatest → Least'}
            </LuminaBadge>
          )}
        </div>

        {/* Ordered slots — bespoke drop targets speaking the shared zone
            language: filled once placed, the single next slot is the active
            (dragOver) target, and grading flashes correct/incorrect. */}
        <div className="flex justify-center gap-2 min-h-[64px]">
          {Array.from({ length: totalSlots }, (_, i) => {
            const isPlaced = i < orderedNumbers.length;
            const isNext = i === orderedNumbers.length;
            const slotState: DropZoneState = isPlaced
              ? (orderFlash ?? 'filled')
              : isNext
                ? 'dragOver'
                : 'idle';
            const slotMotion = isPlaced && orderFlash === 'correct'
              ? motion.pop
              : isPlaced && orderFlash === 'incorrect'
                ? motion.shake
                : '';
            return (
            <div
              key={`slot-${i}`}
              className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${isPlaced ? 'cursor-pointer' : ''} ${dropZoneStateClass(slotState)} ${slotMotion}`}
              onClick={() => {
                if (
                  i === orderedNumbers.length - 1 &&
                  !isCurrentChallengeComplete && !learnerBlocked()
                ) {
                  setOrderedNumbers((prev) => prev.slice(0, -1));
                }
              }}
            >
              {i < orderedNumbers.length ? (
                <span className="text-xl font-bold text-slate-100">
                  {orderedNumbers[i]}
                </span>
              ) : (
                /* Slot-index hint (1,2,3…) withdrawn at the HARD tier so the
                   student tracks position unaided. */
                showSlotHints ? <span className="text-slate-600 text-sm">{i + 1}</span> : null
              )}
            </div>
            );
          })}
        </div>
        {/* slot_steps lever: a bar under each slot growing in the building direction; it names no card. */}
        {stepsOn && (
          <div data-lever="slot-steps" className="flex justify-center items-start gap-2 -mt-3">
            {slotSteps(totalSlots, direction).map((h, i) => (
              <div key={i} className="w-14 flex justify-center">
                <span className="block w-8 rounded-sm bg-purple-400/50" style={{ height: h }} />
              </div>
            ))}
          </div>
        )}

        {/* Available number cards (bespoke draggable tiles) */}
        {!isCurrentChallengeComplete && (
          <div className="flex justify-center gap-2 flex-wrap">
            {availableNumbers.map((num) => (
              <button
                key={`card-${num}`}
                type="button"
                className={`${cardMarksOn ? 'w-16 min-h-[3.5rem] py-1' : 'w-14 h-14'} rounded-xl border text-xl font-bold transition-all ${answerStateClass('idle')}`}
                onClick={() => {
                  if (learnerBlocked()) return;
                  SoundManager.snap();
                  setOrderedNumbers((prev) => [...prev, num]);
                }}
              >
                {num}
                {cardMarksOn && <QuantityMarks n={num} />}
              </button>
            ))}
          </div>
        )}

        {/* Reset button */}
        {!isCurrentChallengeComplete && orderedNumbers.length > 0 && (
          <div className="flex justify-center">
            <LuminaButton
              tone="subtle"
              className="text-xs"
              onClick={() => { if (learnerBlocked()) return; setOrderedNumbers([]); setOrderFlash(null); }}
            >
              Start Over
            </LuminaButton>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Render: one-more-one-less
  // =========================================================================
  const renderOneMoreOneLess = () => {
    if (!currentChallenge || currentChallenge.type !== 'one-more-one-less') return null;

    const target = currentChallenge.targetNumber ?? 5;
    const askFor = currentChallenge.askFor ?? 'both';
    const maxNum = Math.max(target + 5, 20);
    const bandMax = gradeBand === '1' ? 20 : 10;

    // Answer-surface cells. At K (band gate, rule 4) the full 0-20 number line
    // (up to 21 cells per row) is a load violation, so K shows only a 5-cell
    // WINDOW centered on the target ([target-2 .. target+2] clamped to the band) —
    // always containing target-1 / target / target+1, the only viable answers.
    // Grade-1 keeps the full number line.
    const cells: number[] = isK
      ? (() => {
          const lo = Math.max(0, target - 2);
          const hi = Math.min(bandMax, target + 2);
          return Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
        })()
      : Array.from({ length: Math.min(maxNum + 1, 21) }, (_, i) => i);

    const hopsOn = pulledLevers.includes(HOPS_LEVER);
    const numberRow = (
      which: 'more' | 'less',
      selected: number | null,
      label: string,
      colorClass: string,
    ) => {
      // learner_hops lever: 0 on the target, then each cell up to the learner's own pick shows its hop count.
      const hops = hopsOn ? hopLabels(target, selected) : null;
      return (
      <div className="space-y-2">
        {/* Header: WORDLESS at K — an up arrow (one more, emerald) or down arrow
            (one less, blue); the tutor voices the ask. Grade-1 reads the text. */}
        {isK ? (
          <div className="flex justify-center" aria-label={which === 'more' ? 'one more' : 'one less'}>
            <svg width={30} height={30} viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path
                d={which === 'more'
                  ? 'M12 4 L12 20 M12 4 L6 10 M12 4 L18 10'   /* up = one more */
                  : 'M12 20 L12 4 M12 20 L6 14 M12 20 L18 14'} /* down = one less */
                fill="none"
                stroke={which === 'more' ? 'rgba(52,211,153,0.95)' : 'rgba(96,165,250,0.95)'}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : (
          <p className={`text-sm font-medium text-center ${colorClass}`}>{label}</p>
        )}
        <div className="flex justify-center gap-1.5 flex-wrap">
          {cells.map((i) => {
            // Bespoke number-line cells: selected uses tokenized grading color;
            // the target marker stays an amber affordance unique to this surface.
            const cellState = selected === i ? 'selected' : 'idle';
            // Number-line target pre-highlight — withdrawn at the HARD tier
            // (showTargetMarker=false). The amber Target box above still shows the
            // number (the stimulus), so the problem stays solvable.
            const isTarget = showTargetMarker && i === target && selected !== i;
            // Rule-5: a wrong tap shakes THIS cell (K); no text card.
            const isWrong = wrongFlash === `${which}-${i}`;
            const hop = hops?.get(i);
            return (
              <button
                key={i}
                type="button"
                // The row is in the name when both rows show the same numbers; the hop badge is never in it.
                aria-label={askFor === 'both' ? `one ${which} ${i}` : String(i)}
                className={`relative w-10 h-10 rounded-lg border text-sm font-bold p-0 transition-all ${
                  isTarget
                    ? 'bg-amber-500/10 border-amber-400/30 text-amber-300'
                    : answerStateClass(cellState)
                } ${isWrong ? motion.shake : ''}`}
                onClick={() => {
                  if (isCurrentChallengeComplete || learnerBlocked()) return;
                  if (isK) {
                    // tap=choose: the handler owns SFX + evaluation + advance.
                    handleTapOneMoreLess(which, i);
                  } else {
                    SoundManager.select();
                    if (which === 'more') setOneMoreAnswer(i); else setOneLessAnswer(i);
                  }
                }}
                disabled={isCurrentChallengeComplete}
              >
                {i}
                {hop !== undefined && (
                  <span data-lever="hop" className="absolute -top-2 -right-1 rounded-full bg-emerald-400/90 px-1 text-[10px] leading-4 text-slate-900">
                    {hop}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      );
    };

    return (
      <div className="space-y-5">
        {/* Target number — the big numeral is the stimulus; the "Target" caption is
            a word, hidden at K (the tutor names it; a non-reader can't read it). */}
        <div className="flex items-center justify-center">
          <div className="w-24 h-24 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-amber-300">{target}</span>
            {!isK && <span className="text-xs text-amber-400/70 mt-1">Target</span>}
          </div>
        </div>

        {/* Number rows */}
        {(askFor === 'one-more' || askFor === 'both') &&
          numberRow(
            'more',
            oneMoreAnswer,
            `One more than ${target}?`,
            'text-emerald-400',
          )}
        {(askFor === 'one-less' || askFor === 'both') &&
          numberRow(
            'less',
            oneLessAnswer,
            `One less than ${target}?`,
            'text-blue-400',
          )}
      </div>
    );
  };

  // =========================================================================
  // Main Render
  // =========================================================================
  const activePhaseTabs = useMemo(
    () =>
      Object.entries(CHALLENGE_TYPE_CONFIG)
        .filter(([type]) => challenges.some((c) => c.type === type))
        .map(([type, config]) => ({
          value: type,
          label: `${config.icon} ${config.label}`,
        })),
    [challenges],
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {/* Grade + challenge-type badges are adult chrome — hidden at K (band gate). */}
          {!isK && (
            <div className="flex items-center gap-2">
              {/* Only reached when !isK, so the band badge is always Grade 1. */}
              <LuminaBadge accent="orange" className="text-xs">
                Grade 1
              </LuminaBadge>
              {currentChallenge && (
                <LuminaBadge accent="purple" className="text-xs">
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
                </LuminaBadge>
              )}
            </div>
          )}
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase tabs + progress — adult chrome (mode tabs + "Challenge 1 of N"
            counter), hidden at K (band gate). The K child works one tap-surface at
            a time; the tutor names the mode. */}
        {challenges.length > 0 && !isK && (
          <div className="flex items-center gap-2 flex-wrap">
            <LuminaModeTabs
              tabs={activePhaseTabs}
              active={currentChallenge?.type ?? ''}
              accent="orange"
            />
            <LuminaChallengeCounter
              current={Math.min(currentChallengeIndex + 1, challenges.length)}
              total={challenges.length}
              className="ml-auto"
            />
          </div>
        )}

        {/* Instruction. At K the tutor reads it aloud (the learner asks the tutor to repeat it). */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPrompt>{currentChallenge.instruction}</LuminaPrompt>
        )}

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock between the instruction and the
            workspace, and the workspace as one region, never a single choice. */}
        {!allChallengesComplete && <PipDock />}

        {/* Challenge workspace */}
        {!allChallengesComplete && (
          <PipWorkspace>
            {currentChallenge?.type === 'compare-groups' && renderCompareGroups()}
            {currentChallenge?.type === 'compare-numbers' && renderCompareNumbers()}
            {currentChallenge?.type === 'order' && renderOrder()}
            {currentChallenge?.type === 'one-more-one-less' && renderOneMoreOneLess()}
          </PipWorkspace>
        )}

        {/* Feedback — text card at Grade 1+. At K (band gate, rule 5) the feedback
            lands on the touched object instead (group/side/cell shake for wrong,
            order slots flash), with SFX + a spoken tutor hint; a non-reader can't
            read a card, so it is hidden here and the object + voice carry it. */}
        {feedback && feedbackType && !isK && (
          <LuminaFeedbackCard
            status={feedbackType === 'success' ? 'correct' : 'incorrect'}
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Action buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {/* No Check at K for the tap=choose modes — compare-groups (tap a side),
                compare-numbers (tap the bigger numeral), one-more-one-less (tap the
                number cell). Order keeps Check at K: it is a multi-part construction
                (place N numbers in sequence), which the band contract allows. */}
            {!isCurrentChallengeComplete && !allChallengesComplete
              && !(isK && (
                currentChallenge?.type === 'compare-groups'
                || currentChallenge?.type === 'compare-numbers'
                || currentChallenge?.type === 'one-more-one-less'
              )) && (
              <LuminaActionButton
                action="check"
                onClick={handleCheckAnswer}
                disabled={!canCheck || hasSubmittedEvaluation || progress.canAttempt === false}
              />
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter((r) => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
            durationMs={elapsedMs}
            heading="Comparison Complete!"
            celebrationMessage={`You completed all ${challenges.length} comparison challenges!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const ComparisonBuilder = withWorkspaceOnly<ComparisonBuilderProps>(
  'comparison-builder', ComparisonBuilderSurface, (props) => props.data.title,
);

export default ComparisonBuilder;
