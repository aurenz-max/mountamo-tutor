'use client';

/**
 * CountingBoard — DI modality. The Live tutor owns the clock in every mode.
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - count_all / group_count / count_on / compare: they TAP each object to
 *    count (one-to-one correspondence — the manipulative survives, it is the
 *    working surface, not the answer) and SAY HOW MANY ALOUD into an open
 *    mic. The tutor asks, waits, judges the audio in-band, corrects
 *    contrastively, and its own affirmation is the advance.
 *  - subitize (K): the objects flash then hide, and the child SAYS how many
 *    they saw. Grade 1 keeps the objects visible.
 *  - subitize_perceptual (Pre-K): pre-numeric — the child TAPS the hand that
 *    matches the quantity. The tap is the commit (gesture anchor, second
 *    production caller after cvc-speller's spell_word); the tutor's verdict
 *    is the advance, and the whole item is number-free in the tutor's mouth.
 *
 * WHAT CHANGED (first non-literacy consumer of useJudgedScriptRunner;
 * qa/di/BACKLOG.md item 16 extraction). Deleted: the Check Answer button, the
 * Next Challenge button, the Try Again button and its retry penalty, the −/+
 * numeral steppers for subitize and count-on, and the feedback card that
 * printed the target. There is no advance timer and no advance button
 * anywhere in this file.
 *
 * ⚠️ THE CHECK BUTTON WAS MEASURING THE WRONG THING, and that is this port's
 * finding. count_all's check compared tapped-set size to the target — tap
 * every object once, know no number word, pass. The counting SKILL
 * (cardinality: say how many altogether) was delegated to a rhetorical
 * [CARDINALITY_CHECK] the tutor asked after the grade was already recorded.
 * The spoken answer IS now the graded act; the tapping is the strategy that
 * gets the child there.
 *
 * ANSWER-LEAK RULE. The objects are the stimulus and are shown. The COUNT is
 * the answer: the running tally no longer prints "/ total" (it printed the
 * answer next to the child's progress), success feedback no longer names the
 * target, and the number chip appears only AFTER the tutor has affirmed. The
 * child's own tap badges (1, 2, 3… on counted objects) stay — they are the
 * count trace the child constructs, tier-governed via showLastNumber, not an
 * offered option.
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor is quiet by default (it speaks only scripted lines);
 * no visible timers (the subitize flash is stimulus presentation, not an
 * advance clock — nothing moves forward when it ends); "Show again" re-shows
 * the STIMULUS and never the answer; adult chrome is hidden for pre-readers.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaPrompt,
  LuminaChallengeCounter,
  answerStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CountingBoardMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import { judgedAnswerMix, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  completeCue,
  handVerdictCue,
  itemCue,
  moveOnCue,
  numberWordFor,
  responseClassFor,
  type CountingItem,
  type CountingItemKind,
} from './countingBoardScript';
import HandIcon from './HandIcon';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CountingBoardChallenge {
  id: string;
  type: 'count_all' | 'subitize' | 'subitize_perceptual' | 'count_on' | 'group_count' | 'compare';
  instruction: string;
  targetAnswer: number;
  count: number;
  arrangement: 'scattered' | 'line' | 'groups' | 'circle';
  groupSize?: number | null;
  startFrom?: number | null;    // for count_on mode
  flashDuration?: number | null; // ms the objects stay visible in K subitize flash-then-hide
  hint: string;
  narration: string;
}

export interface CountingBoardData {
  title: string;
  description?: string;
  objects: {
    type: 'bears' | 'apples' | 'stars' | 'blocks' | 'fish' | 'butterflies' | 'custom';
  };
  challenges: CountingBoardChallenge[];
  showOptions?: {
    showRunningCount?: boolean;
    showGroupCircles?: boolean;
    highlightOnTap?: boolean;
    showLastNumber?: boolean;
  };
  imagePrompt?: string | null;
  gradeBand?: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CountingBoardMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  count_all: { label: 'Count All', icon: '🔢' },
  subitize: { label: 'Subitize', icon: '⚡' },
  subitize_perceptual: { label: 'See & Show', icon: '✋' },
  group_count: { label: 'Group Count', icon: '🎯' },
  count_on: { label: 'Count On', icon: '➕' },
  compare: { label: 'Compare', icon: '⚖️' },
};

const OBJECT_EMOJI: Record<string, string> = {
  bears: '🧸',
  apples: '🍎',
  stars: '⭐',
  blocks: '🟦',
  fish: '🐟',
  butterflies: '🦋',
  custom: '⬤',
};

const WORKSPACE_WIDTH = 480;
const WORKSPACE_HEIGHT = 320;
const OBJECT_SIZE = 40;
const OBJECT_PADDING = 24;

// K subitize flash-then-hide timing. Objects appear for the flash window, then
// hide before the spoken answer — genuine subitizing is instant recognition,
// not tap-counting a static scene (reader-fit item 13). The flash is stimulus
// presentation, NOT an advance clock: when it ends, nothing progresses — the
// tutor is still waiting for the child's answer.
// WHEN the flash starts is the runner's `onPresentStimulus` gate (19c): the
// tutor has to have spoken for THIS item and stopped. This port used to start
// it on an 800ms beat measured from item-open, which is exactly the defect
// ten-frame drive 3 heard - the counters came and went while she was still
// saying "watch the board". The prep beat is the runner's default now.
const SUBITIZE_FLASH_MS = 1500;   // default; overridable per-challenge via flashDuration

// ============================================================================
// Position Generators
// ============================================================================

function generateScatteredPositions(count: number, seed: number = 42): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  };

  const padX = OBJECT_PADDING + OBJECT_SIZE / 2;
  const padY = OBJECT_PADDING + OBJECT_SIZE / 2;
  const maxX = WORKSPACE_WIDTH - padX;
  const maxY = WORKSPACE_HEIGHT - padY;

  for (let i = 0; i < count; i++) {
    let bestX = padX + rand() * (maxX - padX);
    let bestY = padY + rand() * (maxY - padY);

    for (let attempt = 0; attempt < 20; attempt++) {
      const x = padX + rand() * (maxX - padX);
      const y = padY + rand() * (maxY - padY);
      let tooClose = false;
      for (const p of positions) {
        const dx = x - p.x;
        const dy = y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < OBJECT_SIZE + 4) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        bestX = x;
        bestY = y;
        break;
      }
    }
    positions.push({ x: bestX, y: bestY });
  }
  return positions;
}

function generateLinePositions(count: number): Array<{ x: number; y: number }> {
  const idealSpacing = OBJECT_SIZE + 12;
  const usableWidth = WORKSPACE_WIDTH - 2 * OBJECT_PADDING;
  const maxPerRow = Math.max(1, Math.floor(usableWidth / idealSpacing));

  // Single row if everything fits
  if (count <= maxPerRow) {
    const spacing = Math.min(usableWidth / Math.max(count - 1, 1), idealSpacing);
    const totalWidth = spacing * (count - 1);
    const startX = (WORKSPACE_WIDTH - totalWidth) / 2;
    const y = WORKSPACE_HEIGHT / 2;
    return Array.from({ length: count }, (_, i) => ({ x: startX + i * spacing, y }));
  }

  // Grid fallback for larger counts
  const cols = maxPerRow;
  const rows = Math.ceil(count / cols);
  const colSpacing = usableWidth / Math.max(cols - 1, 1);
  const rowSpacing = Math.min(OBJECT_SIZE + 14, (WORKSPACE_HEIGHT - 2 * OBJECT_PADDING) / Math.max(rows - 1, 1));
  const totalHeight = rowSpacing * (rows - 1);
  const startY = (WORKSPACE_HEIGHT - totalHeight) / 2;

  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const itemsInRow = Math.min(cols, count - row * cols);
    const rowWidth = colSpacing * (itemsInRow - 1);
    const rowStartX = (WORKSPACE_WIDTH - rowWidth) / 2;
    return { x: rowStartX + col * colSpacing, y: startY + row * rowSpacing };
  });
}

function generateGroupPositions(count: number, groupSize: number): Array<{ x: number; y: number }> {
  const numGroups = Math.ceil(count / groupSize);
  const itemSpacing = OBJECT_SIZE + 6;
  const subCols = Math.min(3, groupSize);
  const groupWidth = (subCols - 1) * itemSpacing + OBJECT_SIZE;
  const groupGap = 20;

  const usableWidth = WORKSPACE_WIDTH - 2 * OBJECT_PADDING;
  const maxGroupsPerRow = Math.max(1, Math.floor((usableWidth + groupGap) / (groupWidth + groupGap)));
  const groupRows = Math.ceil(numGroups / maxGroupsPerRow);

  // Height of one group (tallest possible)
  const subRows = Math.ceil(groupSize / subCols);
  const groupHeight = (subRows - 1) * itemSpacing + OBJECT_SIZE;
  const groupRowGap = 16;
  const totalGroupHeight = groupRows * groupHeight + (groupRows - 1) * groupRowGap;
  const startY = (WORKSPACE_HEIGHT - totalGroupHeight) / 2 + OBJECT_SIZE / 2;

  const positions: Array<{ x: number; y: number }> = [];

  for (let g = 0; g < numGroups; g++) {
    const gRow = Math.floor(g / maxGroupsPerRow);
    const gCol = g % maxGroupsPerRow;
    const groupsInThisRow = Math.min(maxGroupsPerRow, numGroups - gRow * maxGroupsPerRow);
    const rowTotalWidth = groupsInThisRow * groupWidth + (groupsInThisRow - 1) * groupGap;
    const rowStartX = (WORKSPACE_WIDTH - rowTotalWidth) / 2 + groupWidth / 2;

    const groupCenterX = rowStartX + gCol * (groupWidth + groupGap);
    const groupTopY = startY + gRow * (groupHeight + groupRowGap);

    const itemsInGroup = Math.min(groupSize, count - g * groupSize);
    for (let i = 0; i < itemsInGroup; i++) {
      const row = Math.floor(i / subCols);
      const col = i % subCols;
      const itemsInRow = Math.min(subCols, itemsInGroup - row * subCols);
      const rowStartXLocal = groupCenterX - ((itemsInRow - 1) * itemSpacing) / 2;

      positions.push({
        x: rowStartXLocal + col * itemSpacing,
        y: groupTopY + row * itemSpacing,
      });
    }
  }
  return positions;
}

function generateCirclePositions(count: number): Array<{ x: number; y: number }> {
  const cx = WORKSPACE_WIDTH / 2;
  const cy = WORKSPACE_HEIGHT / 2;
  const radius = Math.min(WORKSPACE_WIDTH, WORKSPACE_HEIGHT) / 2 - OBJECT_PADDING - OBJECT_SIZE / 2;

  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

function generatePositions(count: number, arrangement: string, groupSize?: number | null, seed: number = 42): Array<{ x: number; y: number }> {
  switch (arrangement) {
    case 'line': return generateLinePositions(count);
    case 'groups': return generateGroupPositions(count, groupSize || 5);
    case 'circle': return generateCirclePositions(count);
    case 'scattered':
    default: return generateScatteredPositions(count, seed);
  }
}

// ============================================================================
// Props
// ============================================================================

interface CountingBoardProps {
  data: CountingBoardData;
  className?: string;
}

const ACTION_FOR_KIND: Record<CountingItemKind, string> = {
  count_all: 'count',
  group_count: 'count',
  compare: 'compare',
  count_on: 'count-on',
  subitize: 'look',
  subitize_perceptual: 'hands',
};

// ============================================================================
// Component
// ============================================================================

const CountingBoard: React.FC<CountingBoardProps> = ({ data, className }) => {
  const {
    title,
    description,
    objects,
    challenges = [],
    showOptions = {},
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showRunningCount = true,
    showGroupCircles = false,
    highlightOnTap = true,
    showLastNumber = true,
  } = showOptions;

  const emoji = OBJECT_EMOJI[objects.type] || OBJECT_EMOJI.custom;
  const objectWord = objects.type === 'custom' ? 'objects' : objects.type;
  const isPreReader = gradeBand === 'K';

  // ── Stage-payload state (the runner owns progression; this is the board) ──
  const [countedObjects, setCountedObjects] = useState<Set<number>>(new Set());
  const [countOrder, setCountOrder] = useState<Map<number, number>>(new Map());
  const [alreadyCountedNote, setAlreadyCountedNote] = useState(false);
  const [handChoice, setHandChoice] = useState<number | null>(null);
  const [preCountedCount, setPreCountedCount] = useState(0);
  /** The count JUST affirmed — post-answer only (answer-leak rule), cleared
   *  the moment the next item opens. 'match' = pre-numeric affirm (no digits). */
  const [reward, setReward] = useState<string | null>(null);

  // K subitize flash-then-hide lifecycle (visual-only; advances nothing).
  const [isSubitizeFlashing, setIsSubitizeFlashing] = useState(false);
  const [subitizeAnswerReady, setSubitizeAnswerReady] = useState(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `counting-board-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const handChoiceRef = useRef<number | null>(null);
  /** Any double-tap on an already-counted object this run (one-to-one signal). */
  const doubleCountEverRef = useRef(false);

  const evaluation = usePrimitiveEvaluation<CountingBoardMetrics>({
    primitiveType: 'counting-board',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── The pack: generator challenges → judged items + hand-authored script ──
  const items = useMemo<CountingItem[]>(() =>
    challenges.map((ch) => ({
      id: ch.id,
      kind: ch.type,
      answerKind: ch.type === 'subitize_perceptual' ? 'gesture' : 'voice',
      responseClass: responseClassFor({ kind: ch.type, target: ch.targetAnswer }),
      action: ACTION_FOR_KIND[ch.type],
      objectWord,
      count: ch.count,
      target: ch.targetAnswer,
      startFrom: ch.startFrom ?? undefined,
      groupSize: ch.groupSize ?? undefined,
    })),
    [challenges, objectWord],
  );

  const pack = useMemo<JudgedScriptPack<CountingItem>>(() => ({
    primitiveType: 'counting-board',
    activityLine: 'live direct instruction counting practice',
    items,
    itemCue,
    moveOnCue,
    completeCue,
    contextFor: (item) => ({
      challengeType: item.kind,
      objectType: item.objectWord,
      targetCount: String(item.target),
    }),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.kind === 'subitize_perceptual'
        ? 'Look, then tap the hand that matches.'
        : 'Listen, then say how many out loud.',
      retry: (item) => item.kind === 'subitize_perceptual'
        ? 'Look again — then tap the hand that matches.'
        : 'Have another go — say how many.',
      noVerdict: () => 'One more time — say how many.',
      affirmedNext: 'Yes! You counted it.',
      done: 'Great counting today!',
    },
    diagnosisObservation: (item, { lastHeard }) =>
      item.kind === 'subitize_perceptual'
        ? {
            challenge: `See ${item.count} ${item.objectWord} and tap the matching hand.`,
            expected: `The hand with ${item.target} fingers.`,
            observed: handChoiceRef.current != null
              ? `Tapped the hand with ${handChoiceRef.current} fingers.`
              : 'Tapped a hand that did not match.',
          }
        : {
            challenge: `Count ${item.count} ${item.objectWord} and say how many altogether.`,
            expected: `${numberWordFor(item.target)} (${item.target})`,
            observed: lastHeard
              ? `Heard "${lastHeard}".`
              : 'The tutor judged the answer wrong from the audio.',
          },
  }), [items]);

  // ── Per-item board reset ──────────────────────────────────────────────────
  const resetBoardFor = useCallback((item: CountingItem) => {
    setAlreadyCountedNote(false);
    setHandChoice(null);
    handChoiceRef.current = null;
    if (flashTimeoutRef.current) { clearTimeout(flashTimeoutRef.current); flashTimeoutRef.current = null; }
    setIsSubitizeFlashing(false);
    setSubitizeAnswerReady(false);

    if (item.kind === 'count_on') {
      const startFrom = item.startFrom || Math.floor(item.target / 2);
      setPreCountedCount(startFrom);
      const preCounted = new Set<number>();
      const preOrder = new Map<number, number>();
      for (let i = 0; i < startFrom && i < item.count; i++) {
        preCounted.add(i);
        preOrder.set(i, i + 1);
      }
      setCountedObjects(preCounted);
      setCountOrder(preOrder);
    } else {
      setPreCountedCount(0);
      setCountedObjects(new Set());
      setCountOrder(new Map());
    }
  }, []);

  // ── Metrics ───────────────────────────────────────────────────────────────
  // The K subitize flash - WHAT is shown; the runner decides WHEN.
  // Called from `onPresentStimulus` once the tutor has finished her line for
  // this item. Takes the item and its index rather than reading `currentItem`,
  // so it holds no runner identity and cannot go stale.
  const presentFlash = useCallback((_item: CountingItem, index: number) => {
    const challenge = challenges[index];
    if (!challenge) return;
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setSubitizeAnswerReady(false);
    setIsSubitizeFlashing(true);
    const duration = challenge.flashDuration || SUBITIZE_FLASH_MS;
    flashTimeoutRef.current = setTimeout(() => {
      setIsSubitizeFlashing(false);
      setSubitizeAnswerReady(true);
      flashTimeoutRef.current = null;
    }, duration);
  }, [challenges]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const byId = new Map(challenges.map((ch) => [ch.id, ch]));
    const subitizeOutcomes = summary.outcomes.filter((o) => byId.get(o.id)?.type === 'subitize');
    const oneToOne = !doubleCountEverRef.current;

    const metrics: CountingBoardMetrics = {
      type: 'counting-board',
      evalMode: challenges[0]?.type ?? 'default',
      countingAccuracy: summary.accuracy,
      oneToOneCorrespondence: oneToOne,
      subitizeAccuracy: subitizeOutcomes.length > 0
        ? Math.round((subitizeOutcomes.filter((o) => o.solved).length / subitizeOutcomes.length) * 100)
        : 0,
      subitizeSpeed: subitizeOutcomes.length > 0
        ? Math.round(
            subitizeOutcomes.reduce((s, o) => s + (o.seconds ?? 0) * 1000, 0) / subitizeOutcomes.length,
          )
        : 0,
      countOnUsed: summary.outcomes.some((o) => byId.get(o.id)?.type === 'count_on' && o.solved),
      groupingUsed: challenges.some((ch) => ch.type === 'group_count'),
      cardinalityUnderstood: oneToOne && summary.accuracy >= 80,
      attemptsCount: summary.attemptsCount,
    };

    evaluation.submitResult(
      summary.solvedCount === challenges.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [challenges, evaluation]);

  const runner = useJudgedScriptRunner<CountingItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: resetBoardFor,
    // THE TUTOR OWNS THE STIMULUS CLOCK (19c). Before this the flash fired on a
    // wall-clock beat from item-open and raced her sentence - ten-frame's drive-3
    // defect, still live on this port because that fix had been written into one
    // component instead of into the runner.
    onPresentStimulus: presentFlash,
    stimulus: { when: (item) => gradeBand === 'K' && item.kind === 'subitize' },
    onAffirmed: (item) => {
      // `revealHeld` keeps this on screen for the length of her affirmation (18b).
      setReward(item.kind === 'subitize_perceptual' ? 'match' : String(item.target));
    },
    onCorrectionRetry: (item) => {
      // The tutor's correction re-modeled and re-asked in-band; restore the
      // working surface for another go.
      if (item.kind === 'subitize_perceptual') {
        setHandChoice(null);
        handChoiceRef.current = null;
      } else if (item.kind === 'subitize') {
        // Re-arm the flash - the runner re-arms its gate on this path, so the
        // re-flash waits for her CORRECTION to finish, on the same gate as the
        // first ask.
        if (flashTimeoutRef.current) { clearTimeout(flashTimeoutRef.current); flashTimeoutRef.current = null; }
        setIsSubitizeFlashing(false);
        setSubitizeAnswerReady(false);
      } else {
        resetBoardFor(item);
      }
    },
  });

  const currentItem = runner.currentItem;
  const currentChallenge = challenges[runner.currentIndex] ?? null;

  // ── Per-challenge layout ──────────────────────────────────────────────────
  const challengeCount = currentChallenge?.count ?? 5;
  const challengeArrangement = currentChallenge?.arrangement ?? 'scattered';
  const challengeGroupSize = currentChallenge?.groupSize;

  const isKSubitize = gradeBand === 'K' && currentItem?.kind === 'subitize';

  const scatterSeed = useMemo(() => {
    const src = currentChallenge?.id ?? `${runner.currentIndex}`;
    let h = 0;
    for (let i = 0; i < src.length; i++) {
      h = (h * 31 + src.charCodeAt(i)) >>> 0;
    }
    return (h % 2147483646) + 1; // Lehmer RNG needs a seed in 1..2147483646 (never 0)
  }, [currentChallenge?.id, runner.currentIndex]);

  const positions = useMemo(() =>
    generatePositions(challengeCount, challengeArrangement, challengeGroupSize, scatterSeed),
    [challengeCount, challengeArrangement, challengeGroupSize, scatterSeed]
  );

  // Pre-K subitize: three hand options (1, 2, 3 fingers), shuffled per
  // challenge with a stable per-challenge seed — the matching hand is never in
  // a predictable position.
  const handOptions = useMemo<number[]>(() => {
    if (currentItem?.kind !== 'subitize_perceptual') return [];
    const base = [1, 2, 3];
    const seedSource = currentChallenge?.id ?? `${runner.currentIndex}`;
    let h = 0;
    for (let i = 0; i < seedSource.length; i++) {
      h = (h * 31 + seedSource.charCodeAt(i)) >>> 0;
    }
    const rand = () => {
      h = (h * 1664525 + 1013904223) >>> 0;
      return h / 0xFFFFFFFF;
    };
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base;
  }, [currentItem?.kind, currentChallenge?.id, runner.currentIndex]);

  // Cancel timers on unmount.
  useEffect(() => () => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
  }, []);

  // ── Tap-to-count — the working surface, never the commit ──────────────────
  const handleObjectTap = useCallback((objectIndex: number) => {
    if (!runner.canAttempt || evaluation.hasSubmitted) return;
    const kind = currentItem?.kind;
    // Subitizing is perceptual recognition, never tap-counting.
    if (kind === 'subitize' || kind === 'subitize_perceptual') return;

    if (countedObjects.has(objectIndex)) {
      SoundManager.invalid();
      doubleCountEverRef.current = true;
      // On-screen nudge only — never a tutor interruption during working time.
      setAlreadyCountedNote(true);
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
      noteTimerRef.current = setTimeout(() => setAlreadyCountedNote(false), 1500);
      return;
    }

    SoundManager.tap();
    const newCount = countedObjects.size + 1;
    setCountedObjects((prev) => {
      const next = new Set(prev);
      next.add(objectIndex);
      return next;
    });
    setCountOrder((prev) => {
      const next = new Map(prev);
      next.set(objectIndex, newCount);
      return next;
    });
  }, [runner, evaluation.hasSubmitted, currentItem?.kind, countedObjects]);

  // ── The hand pick (subitize_perceptual) — the tap IS the commit ───────────
  const handleHandPick = useCallback((fingers: number) => {
    const item = runner.currentItem;
    if (!runner.canAttempt || evaluation.hasSubmitted) return;
    if (!item || item.kind !== 'subitize_perceptual') return;
    // Synchronous ref: `canAttempt` closes the pending window through batched
    // state, this stops a second pick inside the same tick.
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setHandChoice(fingers);
    handChoiceRef.current = fingers;
    runner.submitGestureAttempt(handVerdictCue(item, fingers));
  }, [runner, evaluation.hasSubmitted]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  /** `subitize_perceptual` is answered by picking a hand, so an all-perceptual
   *  run was never counted "out loud". */
  const celebrationMessage = useMemo(() => {
    const n = runner.summary?.solvedCount ?? 0;
    const boards = `${n} board${n === 1 ? '' : 's'} of ${objectWord}`;
    switch (judgedAnswerMix(items)) {
      case 'gesture':
        return `You matched ${boards} — you saw how many!`;
      case 'mixed':
        return `You counted ${boards}!`;
      default:
        return `You counted ${boards} out loud!`;
    }
  }, [items, objectWord, runner.summary]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(challenges, runner.summary, (ch) => {
      const config = CHALLENGE_TYPE_CONFIG[ch.type] ?? { label: ch.type, icon: '🔢' };
      return { label: `${config.label} — ${ch.count} ${objectWord}`, icon: config.icon };
    });
  }, [evaluation.hasSubmitted, runner.summary, challenges, objectWord]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!currentChallenge && !evaluation.hasSubmitted) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No counting challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const kind = currentItem?.kind;
  const boardTappable = kind !== 'subitize' && kind !== 'subitize_perceptual';
  const stageWord = runner.stage === 'affirmed'
    ? 'yes!'
    : runner.stage === 'judging'
      ? 'let’s see…'
      : runner.stage === 'asking'
        ? (kind === 'subitize_perceptual' ? 'which hand?' : 'how many?')
        : 'get ready';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade / mode badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                {/* isPreReader gates this block, so only Grade 1 reaches it. */}
                <LuminaBadge accent="orange" className="text-xs">
                  Grade 1
                </LuminaBadge>
                {kind && (
                  <LuminaBadge accent="emerald" className="text-xs">
                    {CHALLENGE_TYPE_CONFIG[kind]?.icon} {CHALLENGE_TYPE_CONFIG[kind]?.label}
                  </LuminaBadge>
                )}
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">
            {kind === 'subitize_perceptual' ? 'Tap the hand' : 'Say it out loud'}
          </LuminaBadge>
        </div>
        {!isPreReader && description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && currentChallenge && (
          <>
            {!isPreReader && challenges.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, challenges.length)}
                  total={challenges.length}
                  variant="dots"
                />
              </div>
            )}

            {!isPreReader && currentChallenge.instruction && (
              <LuminaPrompt className="text-sm">
                {currentChallenge.instruction}
              </LuminaPrompt>
            )}

            {/* Counting Workspace */}
            <div className="flex justify-center">
              <svg
                width={WORKSPACE_WIDTH}
                height={WORKSPACE_HEIGHT}
                viewBox={`0 0 ${WORKSPACE_WIDTH} ${WORKSPACE_HEIGHT}`}
                className="max-w-full h-auto rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <rect
                  x={1}
                  y={1}
                  width={WORKSPACE_WIDTH - 2}
                  height={WORKSPACE_HEIGHT - 2}
                  rx={12}
                  ry={12}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth={1.5}
                />

                {/* Group circles */}
                {showGroupCircles && challengeArrangement === 'groups' && challengeGroupSize && (
                  (() => {
                    const gs = challengeGroupSize;
                    const numGroups = Math.ceil(challengeCount / gs);
                    const itemSpacing = OBJECT_SIZE + 6;
                    const subCols = Math.min(3, gs);
                    const gw = (subCols - 1) * itemSpacing + OBJECT_SIZE;
                    const gGap = 20;

                    const usable = WORKSPACE_WIDTH - 2 * OBJECT_PADDING;
                    const maxGPR = Math.max(1, Math.floor((usable + gGap) / (gw + gGap)));
                    const gRows = Math.ceil(numGroups / maxGPR);

                    const subRowsMax = Math.ceil(gs / subCols);
                    const gh = (subRowsMax - 1) * itemSpacing + OBJECT_SIZE;
                    const gRowGap = 16;
                    const totalGH = gRows * gh + (gRows - 1) * gRowGap;
                    const gStartY = (WORKSPACE_HEIGHT - totalGH) / 2 + OBJECT_SIZE / 2;

                    return Array.from({ length: numGroups }, (_, g) => {
                      const gRow = Math.floor(g / maxGPR);
                      const gCol = g % maxGPR;
                      const groupsInRow = Math.min(maxGPR, numGroups - gRow * maxGPR);
                      const rowTotalW = groupsInRow * gw + (groupsInRow - 1) * gGap;
                      const rowStartX = (WORKSPACE_WIDTH - rowTotalW) / 2 + gw / 2;

                      const cx = rowStartX + gCol * (gw + gGap);
                      const topY = gStartY + gRow * (gh + gRowGap);

                      const itemsInGroup = Math.min(gs, challengeCount - g * gs);
                      const rows = Math.ceil(itemsInGroup / subCols);
                      const cols = Math.min(subCols, itemsInGroup);
                      const cy = topY + ((rows - 1) * itemSpacing) / 2;
                      const rx = Math.max(((cols - 1) * itemSpacing) / 2 + OBJECT_SIZE / 2 + 8, OBJECT_SIZE);
                      const ry = Math.max(((rows - 1) * itemSpacing) / 2 + OBJECT_SIZE / 2 + 8, OBJECT_SIZE);

                      return (
                        <ellipse
                          key={`group-${g}`}
                          cx={cx}
                          cy={cy}
                          rx={rx}
                          ry={ry}
                          fill="rgba(234,179,8,0.05)"
                          stroke="rgba(234,179,8,0.2)"
                          strokeWidth={1.5}
                          strokeDasharray="6 3"
                        />
                      );
                    });
                  })()
                )}

                {/* Objects — hidden during the K subitize answer phase (flash-then-hide) */}
                {!(isKSubitize && !isSubitizeFlashing) && positions.map((pos, index) => {
                  const isCounted = countedObjects.has(index);
                  const countNum = countOrder.get(index);
                  const isPreCounted = kind === 'count_on' && index < preCountedCount;

                  return (
                    <g
                      key={index}
                      className={boardTappable ? 'cursor-pointer' : undefined}
                      onClick={boardTappable ? () => handleObjectTap(index) : undefined}
                    >
                      {highlightOnTap && isCounted && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={OBJECT_SIZE / 2 + 4}
                          fill="none"
                          stroke={isPreCounted ? 'rgba(59,130,246,0.5)' : 'rgba(234,179,8,0.5)'}
                          strokeWidth={2.5}
                          className="transition-all duration-200"
                        />
                      )}

                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={OBJECT_SIZE / 2}
                        fill={isCounted
                          ? (isPreCounted ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.12)')
                          : 'rgba(255,255,255,0.04)'
                        }
                        className="transition-colors duration-150"
                      />

                      <text
                        x={pos.x}
                        y={pos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={OBJECT_SIZE * 0.6}
                        className="select-none pointer-events-none"
                        style={{ opacity: isCounted ? 1 : 0.7 }}
                      >
                        {emoji}
                      </text>

                      {showLastNumber && isCounted && countNum !== undefined && (
                        <g>
                          <circle
                            cx={pos.x + OBJECT_SIZE / 2 - 4}
                            cy={pos.y - OBJECT_SIZE / 2 + 4}
                            r={10}
                            fill={isPreCounted ? '#3b82f6' : '#eab308'}
                            stroke="rgba(0,0,0,0.3)"
                            strokeWidth={1}
                          />
                          <text
                            x={pos.x + OBJECT_SIZE / 2 - 4}
                            y={pos.y - OBJECT_SIZE / 2 + 4}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={11}
                            fill="white"
                            fontWeight="bold"
                            className="pointer-events-none select-none"
                          >
                            {countNum}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Running count — the child's own trace ONLY. The "/ total" the
                old tally printed was the answer, typeset next to the child's
                progress; it does not survive the spoken-answer port. */}
            {showRunningCount && boardTappable && countedObjects.size > 0 && (
              <div className="flex items-center justify-center text-sm">
                <span className="text-slate-300">
                  Counted: <span className="text-orange-300 font-bold text-lg">{countedObjects.size}</span>
                </span>
              </div>
            )}

            {alreadyCountedNote && (
              <p className="text-center text-xs text-amber-300">
                You already counted that one — try a different {objectWord.replace(/s$/, '')}!
              </p>
            )}

            {/* Pre-K hand picker (no numerals anywhere; the tap is the commit) */}
            {kind === 'subitize_perceptual' && (
              <div className="flex flex-col items-center gap-3">
                <span className="text-slate-300 text-sm">Which hand shows how many you saw?</span>
                <div className="flex items-center justify-center gap-4">
                  {handOptions.map((choice) => {
                    const isPicked = handChoice === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        aria-label="Pick this hand"
                        className={`h-24 w-24 p-2 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-50 ${answerStateClass(isPicked ? 'selected' : 'idle')}`}
                        onClick={() => handleHandPick(choice)}
                        disabled={!runner.canAttempt}
                      >
                        <HandIcon fingerCount={choice as 1 | 2 | 3} size={72} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* K subitize flash prompt + re-show (stimulus support — it re-shows
                the objects, never the answer, and is never withdrawn) */}
            {isKSubitize && (
              <div className="flex flex-col items-center gap-2">
                {!subitizeAnswerReady && (
                  <span className="text-orange-300 text-sm font-medium">
                    👀 {isSubitizeFlashing ? 'Look quick!' : 'Get ready to look…'}
                  </span>
                )}
                {subitizeAnswerReady && runner.running && currentItem && (
                  <LuminaButton
                    tone="subtle"
                    className="text-xs"
                    // Direct, not gated: the CHILD asked for this one, so it is
                    // not waiting on anybody's voice.
                    onClick={() => presentFlash(currentItem, runner.currentIndex)}
                  >
                    Show again
                  </LuminaButton>
                )}
              </div>
            )}

            {/* Count-on stimulus line (the start number is the stimulus, not
                the answer) */}
            {kind === 'count_on' && !isPreReader && (
              <p className="text-center text-sm text-slate-300">
                There are <span className="text-blue-400 font-bold">{preCountedCount}</span> already counted.
              </p>
            )}

            {/* The reward — the first moment the count may appear on screen. */}
            {/* Gated on `revealHeld`, never on the stage word or `currentSolved`:
                the runner opens the next item in the same dispatch, so by the
                time this renders the current item is the NEXT one (18b). */}
            {reward && runner.revealHeld && (
              <LuminaPanel className="p-3 text-center">
                {reward === 'match' ? (
                  <span className="text-emerald-300 text-lg font-black animate-bounce inline-block">
                    ✋ That hand matches!
                  </span>
                ) : (
                  <span className="text-emerald-300 text-lg font-black animate-bounce inline-block">
                    {reward} — {numberWordFor(Number(reward))} {objectWord}!
                  </span>
                )}
              </LuminaPanel>
            )}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                {kind === 'subitize_perceptual'
                  ? 'Look at the objects, then tap the matching hand.'
                  : 'Tap each object as you count, then say how many out loud.'}
              </p>
            )}

            {/* The pre-K hand pick is answered with the hands — the orb names
                that turn instead of claiming to listen for it. */}
            <JudgedMicPanel run={runner} gestureLabel="Your turn — tap the hand" />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Counting Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default CountingBoard;
