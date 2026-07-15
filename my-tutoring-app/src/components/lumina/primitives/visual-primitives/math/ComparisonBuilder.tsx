'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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
  /** Gate the always-on "Left: N / Right: N" count badges (compare-groups). */
  showCountBadges?: boolean;
  /** Correspondence-line lifecycle: 'live' = during solve, 'on-check' = after
   *  answering (legacy default), 'off' = never. */
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
}

// ============================================================================
// Component
// ============================================================================

const ComparisonBuilder: React.FC<ComparisonBuilderProps> = ({ data, className }) => {
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

  // -------------------------------------------------------------------------
  // Domain-specific state
  // -------------------------------------------------------------------------
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [orderedNumbers, setOrderedNumbers] = useState<number[]>([]);
  const [oneMoreAnswer, setOneMoreAnswer] = useState<number | null>(null);
  const [oneLessAnswer, setOneLessAnswer] = useState<number | null>(null);
  const [showLines, setShowLines] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Shuffled numbers for order challenges
  const [shuffledNumbers, setShuffledNumbers] = useState<number[]>([]);

  // Transient grading flash for the order slots — drives the shared drop-zone
  // motion (pop/shake) off the same checkOrder result, then settles to filled.
  const [orderFlash, setOrderFlash] = useState<'correct' | 'incorrect' | null>(null);
  const orderFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => { if (orderFlashTimer.current) clearTimeout(orderFlashTimer.current); },
    [],
  );

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `comparison-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // Current challenge
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  // Shuffle numbers when entering an order challenge
  useEffect(() => {
    if (currentChallenge?.type === 'order' && currentChallenge.numbers) {
      const nums = [...currentChallenge.numbers];
      // Simple deterministic shuffle seeded by challenge index
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.abs(((currentChallengeIndex + 1) * 7 + i * 13) % (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      setShuffledNumbers(nums);
    }
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
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? 'compare-groups',
    leftCount: currentChallenge?.leftGroup?.count,
    rightCount: currentChallenge?.rightGroup?.count,
    leftNumber: currentChallenge?.leftNumber,
    rightNumber: currentChallenge?.rightNumber,
    correctAnswer: currentChallenge?.correctAnswer ?? currentChallenge?.correctSymbol,
    targetNumber: currentChallenge?.targetNumber,
    askFor: currentChallenge?.askFor,
    gradeBand,
    useAlligatorMnemonic,
    supportTier,
    instruction: currentChallenge?.instruction ?? '',
    totalChallenges: challenges.length,
    currentChallengeIndex,
    attemptNumber: currentAttempts + 1,
  }), [
    currentChallenge, gradeBand, useAlligatorMnemonic, supportTier,
    challenges.length, currentChallengeIndex, currentAttempts,
  ]);

  // -------------------------------------------------------------------------
  // Tutor reveal policy — keeps the tutor's coaching depth in sync with the
  // on-screen scaffold so it doesn't leak what a hard tier withheld. Mode-aware:
  // for compare-numbers the > / < relationship IS the answer, so the tutor must
  // never name it at any tier (only dial coaching depth).
  // -------------------------------------------------------------------------
  const tutorRevealClause = useCallback(
    (type: ComparisonBuilderChallenge['type']): string => {
      const tier = supportTier;
      if (!tier) return '';
      if (type === 'compare-numbers') {
        // The relationship is the answer — never name it; tier dials depth only.
        return tier === 'easy'
          ? ' [TIER easy] You may remind them the alligator eats the bigger number; do NOT state the symbol.'
          : tier === 'medium'
            ? ' [TIER medium] Nudge: ask which number is bigger; do NOT name the symbol.'
            : ' [TIER hard] No mnemonic on screen — ask which digit to compare (tens, then ones); never name the symbol.';
      }
      if (type === 'compare-groups') {
        return tier === 'easy'
          ? ' [TIER easy] You may name the matching/one-to-one strategy and which side has more.'
          : tier === 'medium'
            ? ' [TIER medium] Nudge them to count each side; do NOT state which has more.'
            : ' [TIER hard] Counts are hidden and objects scattered — ask them to count each group themselves; do NOT name which side has more or state either count.';
      }
      if (type === 'one-more-one-less') {
        return tier === 'easy'
          ? ' [TIER easy] You may count forward/backward by one aloud with them.'
          : tier === 'medium'
            ? ' [TIER medium] Nudge them to count by one in the asked direction.'
            : ' [TIER hard] No number-line highlight — ask them to find the target then count one step each way; do NOT state the answers.';
      }
      // order
      return tier === 'easy'
        ? ' [TIER easy] You may name the smallest/largest to start and the direction.'
        : tier === 'medium'
          ? ' [TIER medium] Nudge them toward the next number; do NOT order it for them.'
          : ' [TIER hard] Descending with no slot hints — ask which is biggest first; do NOT name the sequence.';
    },
    [supportTier],
  );

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'comparison-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    const types = Array.from(new Set(challenges.map((c) => c.type))).join(', ');
    sendText(
      `[ACTIVITY_START] Comparison activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges covering: ${types}. `
      + `${useAlligatorMnemonic ? 'Using alligator mnemonic for inequality symbols. ' : ''}`
      + `First challenge: "${currentChallenge?.instruction}". Introduce warmly.`
      + (currentChallenge ? tutorRevealClause(currentChallenge.type) : ''),
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, useAlligatorMnemonic, currentChallenge, tutorRevealClause, sendText]);

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
    incrementAttempts();

    if (correct) {
      const answerWord = currentChallenge.correctAnswer === 'equal' ? 'the same as' : `${currentChallenge.correctAnswer === 'more' ? 'more' : 'fewer'} than`;
      setFeedback(
        `That's right! The left group (${leftCount}) has ${answerWord} the right group (${rightCount})!`,
      );
      setFeedbackType('success');
      setShowLines(true);
      sendText(
        `[ANSWER_CORRECT] Student correctly identified that left (${leftCount}) has ${answerWord} right (${rightCount}). `
        + `Congratulate briefly! ${showCorrespondenceLines ? 'Point out the matching lines.' : ''}`,
        { silent: true },
      );
    } else {
      setFeedback('Not quite — count each group carefully and try again!');
      setFeedbackType('error');
      noteWrongAnswer(
        `compare the groups (left: ${leftCount} ${currentChallenge.leftGroup?.objectType ?? 'objects'}, right: ${rightCount} ${currentChallenge.rightGroup?.objectType ?? 'objects'})`,
        `picked "${answer}" for the left group`,
        `the left group has "${currentChallenge.correctAnswer}" (left ${leftCount} vs right ${rightCount})`,
      );
      sendText(
        `[ANSWER_INCORRECT] Student chose "${answer}" but correct is "${currentChallenge.correctAnswer}". `
        + `Left has ${leftCount}, right has ${rightCount}. Attempt ${currentAttempts + 1}. `
        + `${useAlligatorMnemonic
          ? 'Hint: "Count the objects on each side. Which side has more?"'
          : 'Give a gentle hint to count each group.'}`
        + tutorRevealClause('compare-groups'),
        { silent: true },
      );
    }

    return correct;
  }, [
    currentChallenge, selectedAnswer, incrementAttempts, noteWrongAnswer,
    showCorrespondenceLines, useAlligatorMnemonic, currentAttempts, sendText, tutorRevealClause,
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
      if (!currentChallenge || alreadySolved || allChallengesComplete) return;
      setSelectedAnswer(answer);
      const correct = checkCompareGroups(answer);
      if (correct) {
        SoundManager.playCorrect();
        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
        });
      } else {
        SoundManager.playIncorrect();
      }
    },
    [
      currentChallenge, challengeResults, allChallengesComplete,
      checkCompareGroups, recordResult, currentAttempts,
    ],
  );

  // -------------------------------------------------------------------------
  // Check Answer — compare-numbers
  // -------------------------------------------------------------------------
  const checkCompareNumbers = useCallback(() => {
    if (!currentChallenge || !selectedAnswer) return false;
    const correct = selectedAnswer === currentChallenge.correctSymbol;
    incrementAttempts();

    if (correct) {
      setFeedback(
        `Yes! ${currentChallenge.leftNumber} ${currentChallenge.correctSymbol} ${currentChallenge.rightNumber}`,
      );
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly chose ${currentChallenge.correctSymbol} `
        + `for ${currentChallenge.leftNumber} vs ${currentChallenge.rightNumber}. Congratulate!`,
        { silent: true },
      );
    } else {
      setFeedback('Not quite. Think about which number is bigger.');
      setFeedbackType('error');
      noteWrongAnswer(
        `choose the symbol comparing ${currentChallenge.leftNumber} vs ${currentChallenge.rightNumber}`,
        `picked "${selectedAnswer}"`,
        `the correct symbol is "${currentChallenge.correctSymbol}" (${currentChallenge.leftNumber} ${currentChallenge.correctSymbol} ${currentChallenge.rightNumber})`,
      );
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedAnswer}" but correct is "${currentChallenge.correctSymbol}" `
        + `for ${currentChallenge.leftNumber} vs ${currentChallenge.rightNumber}. `
        + `Attempt ${currentAttempts + 1}. `
        + `${useAlligatorMnemonic
          ? '"Remember, the alligator always eats the bigger number! Which number is bigger?"'
          : 'Give a hint about which is bigger.'}`
        + tutorRevealClause('compare-numbers'),
        { silent: true },
      );
    }

    return correct;
  }, [currentChallenge, selectedAnswer, incrementAttempts, noteWrongAnswer, useAlligatorMnemonic, currentAttempts, sendText, tutorRevealClause]);

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
    incrementAttempts();

    // Zone-state flash off the same grading result (visual only). Settles at 900 ms.
    if (orderFlashTimer.current) clearTimeout(orderFlashTimer.current);
    setOrderFlash(correct ? 'correct' : 'incorrect');
    orderFlashTimer.current = setTimeout(() => setOrderFlash(null), 900);

    if (correct) {
      setFeedback(`Perfect order! ${orderedNumbers.join(', ')}`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly ordered numbers ${currentChallenge.direction}: `
        + `${orderedNumbers.join(', ')}. Celebrate!`,
        { silent: true },
      );
    } else {
      setFeedback('Not quite the right order. Try again!');
      setFeedbackType('error');
      noteWrongAnswer(
        `order the numbers ${currentChallenge.numbers.join(', ')} ${currentChallenge.direction ?? 'ascending'}`,
        `ordered ${orderedNumbers.join(', ')}`,
        `the correct ${currentChallenge.direction ?? 'ascending'} order is ${expected.join(', ')}`,
      );
      sendText(
        `[ANSWER_INCORRECT] Student ordered: ${orderedNumbers.join(', ')} but correct is: `
        + `${expected.join(', ')} (${currentChallenge.direction}). `
        + `Attempt ${currentAttempts + 1}. `
        + `Hint: "Which number is the ${currentChallenge.direction === 'ascending' ? 'smallest' : 'biggest'}? Start with that one."`
        + tutorRevealClause('order'),
        { silent: true },
      );
    }

    return correct;
  }, [currentChallenge, orderedNumbers, incrementAttempts, noteWrongAnswer, currentAttempts, sendText, tutorRevealClause]);

  // -------------------------------------------------------------------------
  // Check Answer — one-more-one-less
  // -------------------------------------------------------------------------
  const checkOneMoreOneLess = useCallback(() => {
    if (!currentChallenge || currentChallenge.targetNumber === undefined) return false;
    const target = currentChallenge.targetNumber;
    const askFor = currentChallenge.askFor ?? 'both';
    incrementAttempts();

    let correct = false;
    if (askFor === 'one-more') {
      correct = oneMoreAnswer === target + 1;
    } else if (askFor === 'one-less') {
      correct = oneLessAnswer === target - 1;
    } else {
      correct = oneMoreAnswer === target + 1 && oneLessAnswer === target - 1;
    }

    if (correct) {
      const parts: string[] = [];
      if (askFor !== 'one-less') parts.push(`one more is ${target + 1}`);
      if (askFor !== 'one-more') parts.push(`one less is ${target - 1}`);
      setFeedback(`That's right! ${parts.join(' and ')}.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student correctly found one ${askFor} of ${target}. `
        + `${askFor === 'both' ? `One more: ${target + 1}, one less: ${target - 1}.` : ''} Congratulate!`,
        { silent: true },
      );
    } else {
      setFeedback('Not quite. Think about counting forward or backward by 1.');
      setFeedbackType('error');
      const studentAnswers =
        askFor === 'both'
          ? `one more: ${oneMoreAnswer ?? '?'}, one less: ${oneLessAnswer ?? '?'}`
          : askFor === 'one-more'
            ? `${oneMoreAnswer ?? '?'}`
            : `${oneLessAnswer ?? '?'}`;
      noteWrongAnswer(
        `find one ${askFor === 'both' ? 'more and one less' : askFor === 'one-more' ? 'more' : 'less'} than ${target}`,
        `answered ${studentAnswers}`,
        `one more is ${target + 1}, one less is ${target - 1}`,
      );
      sendText(
        `[ANSWER_INCORRECT] Target: ${target}, askFor: ${askFor}. Student answered: ${studentAnswers}. `
        + `Correct: one more=${target + 1}, one less=${target - 1}. `
        + `Attempt ${currentAttempts + 1}. `
        + `Hint: "Start at ${target} and count ${askFor === 'one-less' ? 'backward' : 'forward'} by one."`
        + tutorRevealClause('one-more-one-less'),
        { silent: true },
      );
    }

    return correct;
  }, [currentChallenge, oneMoreAnswer, oneLessAnswer, incrementAttempts, noteWrongAnswer, currentAttempts, sendText, tutorRevealClause]);

  // -------------------------------------------------------------------------
  // Master check handler
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

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
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    } else {
      SoundManager.playIncorrect();
    }
  }, [
    currentChallenge, currentAttempts,
    checkCompareGroups, checkCompareNumbers, checkOrder, checkOneMoreOneLess,
    recordResult,
  ]);

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges complete
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their comparison skills!`,
        { silent: true },
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const totalCorrect = challengeResults.filter((r) => r.correct).length;
        const overallAccuracy = Math.round(
          (totalCorrect / challenges.length) * 100,
        );

        const accuracyByType = (type: string) => {
          const chs = challenges.filter((c) => c.type === type);
          const rs = challengeResults.filter((r) =>
            chs.some((c) => c.id === r.challengeId),
          );
          if (chs.length === 0) return -1;
          return Math.round(
            (rs.filter((r) => r.correct).length / chs.length) * 100,
          );
        };

        const symbolChallenges = challenges.filter(
          (c) => c.type === 'compare-numbers',
        );
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

        // Misconception Loop S1 — Tier-B evidence packet on failed sessions.
        // Latest wrong observation is the headline; earlier ones become
        // priorAttempts (the consistency signal the distiller needs to tell a
        // mental model from a slip). Clean sessions carry no packet.
        const goalMet = totalCorrect === challenges.length;
        const wrongs = wrongObservationsRef.current;
        const latest = wrongs[wrongs.length - 1];
        const diagnosisEvidence: DiagnosisEvidence | undefined =
          !goalMet && latest
            ? {
                challengeSummary: latest.challenge,
                expected: latest.expected,
                observed: latest.observed,
                priorAttempts: wrongs
                  .slice(0, -1)
                  .map((w) => ({ challenge: w.challenge, observed: w.observed })),
              }
            : undefined;

        submitEvaluation(
          goalMet,
          overallAccuracy,
          metrics,
          { challengeResults },
          undefined,
          diagnosisEvidence,
        );
      }
      return;
    }

    // Reset domain-specific state for next challenge
    setSelectedAnswer(null);
    setOrderedNumbers([]);
    setOneMoreAnswer(null);
    setOneLessAnswer(null);
    setShowLines(false);
    setFeedback('');
    setFeedbackType('');
    setOrderFlash(null);
    if (orderFlashTimer.current) clearTimeout(orderFlashTimer.current);

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). `
      + `Read the instruction and encourage the student.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
  ]);

  // Auto-submit when all complete
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

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

    // Correspondence-line visibility:
    //   'live'     → drawn during solve (strongest self-check) AND after answering
    //   'on-check' → only after the student answers (legacy default)
    //   'off'      → never
    const linesVisible =
      showCorrespondenceLines &&
      (correspondenceMode === 'live' || (correspondenceMode === 'on-check' && showLines));

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
              return (
                <g key={`left-${i}`}>
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
              return (
                <g key={`right-${i}`}>
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

        {/* Count labels — withdrawn at the HARD tier (showCountBadges=false) so the
            student must count both groups; the post-answer feedback still names the
            counts, which is fine (it's the reveal, not a pre-answer crutch). */}
        {showCountBadges && (
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

        {/* Toggle correspondence lines button — only relevant in 'on-check' mode
            ('live' already shows them; 'off' withholds them entirely). */}
        {showCorrespondenceLines && correspondenceMode === 'on-check' && !showLines && isCurrentChallengeComplete && (
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

    return (
      <div className="space-y-5">
        {/* Direction label */}
        <div className="text-center">
          <LuminaBadge accent="purple" className="text-xs">
            {direction === 'ascending' ? 'Least → Greatest' : 'Greatest → Least'}
          </LuminaBadge>
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
                  !isCurrentChallengeComplete
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

        {/* Available number cards (bespoke draggable tiles) */}
        {!isCurrentChallengeComplete && (
          <div className="flex justify-center gap-2 flex-wrap">
            {availableNumbers.map((num) => (
              <button
                key={`card-${num}`}
                type="button"
                className={`w-14 h-14 rounded-xl border text-xl font-bold transition-all ${answerStateClass('idle')}`}
                onClick={() => {
                  SoundManager.snap();
                  setOrderedNumbers((prev) => [...prev, num]);
                }}
              >
                {num}
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
              onClick={() => { setOrderedNumbers([]); setOrderFlash(null); }}
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

    const numberRow = (
      selected: number | null,
      onSelect: (n: number) => void,
      label: string,
      colorClass: string,
    ) => (
      <div className="space-y-2">
        <p className={`text-sm font-medium text-center ${colorClass}`}>{label}</p>
        <div className="flex justify-center gap-1.5 flex-wrap">
          {Array.from({ length: Math.min(maxNum + 1, 21) }, (_, i) => {
            // Bespoke number-line cells: selected uses tokenized grading color;
            // the target marker stays an amber affordance unique to this surface.
            const cellState = selected === i ? 'selected' : 'idle';
            // Number-line target pre-highlight — withdrawn at the HARD tier
            // (showTargetMarker=false). The amber Target box above still shows the
            // number (the stimulus), so the problem stays solvable.
            const isTarget = showTargetMarker && i === target && selected !== i;
            return (
              <button
                key={i}
                type="button"
                className={`w-10 h-10 rounded-lg border text-sm font-bold p-0 transition-all ${
                  isTarget
                    ? 'bg-amber-500/10 border-amber-400/30 text-amber-300'
                    : answerStateClass(cellState)
                }`}
                onClick={() => {
                  if (!isCurrentChallengeComplete) {
                    SoundManager.select();
                    onSelect(i);
                  }
                }}
                disabled={isCurrentChallengeComplete}
              >
                {i}
              </button>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="space-y-5">
        {/* Target number */}
        <div className="flex items-center justify-center">
          <div className="w-24 h-24 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-amber-300">{target}</span>
            <span className="text-xs text-amber-400/70 mt-1">Target</span>
          </div>
        </div>

        {/* Number rows */}
        {(askFor === 'one-more' || askFor === 'both') &&
          numberRow(
            oneMoreAnswer,
            setOneMoreAnswer,
            `One more than ${target}?`,
            'text-emerald-400',
          )}
        {(askFor === 'one-less' || askFor === 'both') &&
          numberRow(
            oneLessAnswer,
            setOneLessAnswer,
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
          <div className="flex items-center gap-2">
            <LuminaBadge accent="orange" className="text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </LuminaBadge>
            {currentChallenge && (
              <LuminaBadge accent="purple" className="text-xs">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase tabs + progress */}
        {challenges.length > 0 && (
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

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPrompt>{currentChallenge.instruction}</LuminaPrompt>
        )}

        {/* Challenge workspace */}
        {!allChallengesComplete && (
          <>
            {currentChallenge?.type === 'compare-groups' && renderCompareGroups()}
            {currentChallenge?.type === 'compare-numbers' && renderCompareNumbers()}
            {currentChallenge?.type === 'order' && renderOrder()}
            {currentChallenge?.type === 'one-more-one-less' && renderOneMoreOneLess()}
          </>
        )}

        {/* Feedback */}
        {feedback && feedbackType && (
          <LuminaFeedbackCard
            status={feedbackType === 'success' ? 'correct' : 'incorrect'}
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Action buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {/* No Check at K compare-groups — tapping a group is the atomic answer. */}
            {!isCurrentChallengeComplete && !allChallengesComplete
              && !(gradeBand === 'K' && currentChallenge?.type === 'compare-groups') && (
              <LuminaActionButton
                action="check"
                onClick={handleCheckAnswer}
                disabled={!canCheck || hasSubmittedEvaluation}
              />
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <LuminaActionButton
                action="next"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </LuminaActionButton>
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
            overallScore={submittedResult?.score ?? localOverallScore}
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

export default ComparisonBuilder;
