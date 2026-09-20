'use client';

/**
 * One counting workspace, two explicit owners.
 * The live activity host uses the shared TeachingSession: factual observations,
 * structured response checks, tutor-authored help, and explicit progression.
 * Standalone DI lessons retain their existing scripted controller and evaluation.
 * Both render this same board; tutor marks never become learner selections.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CountingBoardMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
  type JudgedScriptRunnerOptions,
} from '../../../hooks/useJudgedScriptRunner';
import { judgedAnswerMix, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  countingBoardPackBase,
  evalModeForKind,
  giveVerdictCue,
  handVerdictCue,
  itemsFromChallenges,
  numberWordFor,
  objectWordFor,
  objectSingularFor,
  type CountingItem,
} from './countingBoardScript';
import { countingBoardEvidenceSummary, countingObservation } from './countingBoardEvidence';
import { useCountingTutorController, type CountingController, type CountingControllerOptions, type CountingWorkspace } from './useCountingTutorController';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { useLiveAutoStart } from '../../../components/live-activity/runtime/useLiveAutoStart';
import HandIcon from './HandIcon';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { countingBoardPipPose } from '../../../pip/countingBoardPipPose';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CountingBoardChallenge {
  id: string;
  type:
    | 'count_all' | 'subitize' | 'subitize_perceptual' | 'count_on' | 'group_count' | 'compare'
    | 'give_me_n' | 'recount_moved' | 'take_away' | 'add_more';
  instruction: string;
  targetAnswer: number;
  count: number;
  arrangement: 'scattered' | 'line' | 'groups' | 'circle';
  groupSize?: number | null;
  /** compare: the two group sizes in board order (first = left). Code-owned, so the bigger group
   *  sits on either side. Absent on older boards, which draw the bigger group first. */
  compareGroups?: number[] | null;
  startFrom?: number | null;    // for count_on mode
  /** take_away / add_more: how many the child removes or puts on. Code-owned. */
  changeBy?: number | null;
  flashDuration?: number | null; // ms the objects stay visible in K subitize flash-then-hide
  hint: string;
  narration: string;
}

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
export interface CountingBoardData {
  /** Safe adaptation metadata; `source` is stamped only by the observation delivery server. */
  learningAdaptation?: LearningAdaptation<'contrast_same_start_different_change' | 'count_on_exactly_one_more'>;
  title: string;
  description?: string;
  objects: {
    type: 'bears' | 'apples' | 'stars' | 'blocks' | 'fish' | 'butterflies' | 'custom';
    /** A themed board's glyph, plural noun and singular noun — the three that
     *  travel together. The generator emits them only for `type: 'custom'` and
     *  only when all three validate; anything short of that falls back to the
     *  enum, so the enum is the FLOOR, never the ceiling. The emoji is what the
     *  board draws and the two words are what the tutor says, so a board that
     *  shows trucks and asks about "objects" is not reachable. */
    emoji?: string;
    word?: string;
    wordSingular?: string;
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
  give_me_n: { label: 'Give Me', icon: '🤲' },
  recount_moved: { label: 'They Moved', icon: '🔀' },
  take_away: { label: 'Take Away', icon: '➖' },
  add_more: { label: 'Add More', icon: '➕' },
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

interface GroupLayout {
  positions: Array<{ x: number; y: number }>;
  /** One ring per group, drawn around exactly the objects placed in it. */
  rings: Array<{ cx: number; cy: number; rx: number; ry: number }>;
}

/**
 * The sizes of the groups a 'groups' board draws, in board order. A compare board names its two groups
 * (bigger one on either side); every other board is cut into equal groups of `groupSize` with the
 * remainder last. `cell` is the footprint every group is laid out in.
 */
function boardGroups(count: number, groupSize?: number | null, compareGroups?: number[] | null): { sizes: number[]; cell: number } {
  if (compareGroups && compareGroups.length > 0 && compareGroups.every((n) => Number.isInteger(n) && n >= 1)
    && compareGroups.reduce((s, n) => s + n, 0) === count) {
    return { sizes: compareGroups, cell: Math.max(...compareGroups) };
  }
  const cell = groupSize || 5;
  return { sizes: Array.from({ length: Math.ceil(count / cell) }, (_, g) => Math.min(cell, count - g * cell)), cell };
}

function layoutGroups(sizes: number[], cell: number): GroupLayout {
  const numGroups = sizes.length;
  const itemSpacing = OBJECT_SIZE + 6;
  const subCols = Math.min(3, cell);
  const groupWidth = (subCols - 1) * itemSpacing + OBJECT_SIZE;
  const groupGap = 20;

  const usableWidth = WORKSPACE_WIDTH - 2 * OBJECT_PADDING;
  const maxGroupsPerRow = Math.max(1, Math.floor((usableWidth + groupGap) / (groupWidth + groupGap)));
  const groupRows = Math.ceil(numGroups / maxGroupsPerRow);

  // Height of one group (tallest possible)
  const subRows = Math.ceil(cell / subCols);
  const groupHeight = (subRows - 1) * itemSpacing + OBJECT_SIZE;
  const groupRowGap = 16;
  const totalGroupHeight = groupRows * groupHeight + (groupRows - 1) * groupRowGap;
  const startY = (WORKSPACE_HEIGHT - totalGroupHeight) / 2 + OBJECT_SIZE / 2;

  const positions: Array<{ x: number; y: number }> = [];
  const rings: GroupLayout['rings'] = [];

  for (let g = 0; g < numGroups; g++) {
    const gRow = Math.floor(g / maxGroupsPerRow);
    const gCol = g % maxGroupsPerRow;
    const groupsInThisRow = Math.min(maxGroupsPerRow, numGroups - gRow * maxGroupsPerRow);
    const rowTotalWidth = groupsInThisRow * groupWidth + (groupsInThisRow - 1) * groupGap;
    const rowStartX = (WORKSPACE_WIDTH - rowTotalWidth) / 2 + groupWidth / 2;

    const groupCenterX = rowStartX + gCol * (groupWidth + groupGap);
    const groupTopY = startY + gRow * (groupHeight + groupRowGap);

    const itemsInGroup = sizes[g];
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

    const rows = Math.ceil(itemsInGroup / subCols);
    const cols = Math.min(subCols, itemsInGroup);
    rings.push({
      cx: groupCenterX,
      cy: groupTopY + ((rows - 1) * itemSpacing) / 2,
      rx: Math.max(((cols - 1) * itemSpacing) / 2 + OBJECT_SIZE / 2 + 8, OBJECT_SIZE),
      ry: Math.max(((rows - 1) * itemSpacing) / 2 + OBJECT_SIZE / 2 + 8, OBJECT_SIZE),
    });
  }
  return { positions, rings };
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

function generatePositions(count: number, arrangement: string, seed: number = 42): Array<{ x: number; y: number }> {
  switch (arrangement) {
    case 'line': return generateLinePositions(count);
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
  /** The live host mounts without a mic-panel click; the runner still waits for a listening session. */
  autoStart?: boolean;
  /** Resolved plan metadata from the live lesson host, carried onto the runtime mount. */
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * The two controllers this board still hosts take different options: the
 * teaching workspace needs the assignment, the retiring runner needs its pack,
 * its cues and its progression policy as well. The union is declared HERE, in
 * the last file that hosts both, rather than in the teaching controller — so
 * the runner's option types die with the legacy branch at S3 (sunset slice S1,
 * qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md).
 */
type CountingBoardControllerOptions = CountingControllerOptions
  & Omit<JudgedScriptRunnerOptions<CountingItem>, 'pack' | 'items' | 'instanceId'>
  & { pack?: JudgedScriptPack<CountingItem> };

function useScriptedController(options: CountingBoardControllerOptions): CountingController {
  return useJudgedScriptRunner({ ...options, pack: options.pack! });
}

// Component boundaries keep hook ownership stable. The live path never starts a DI runner.
const CountingBoard: React.FC<CountingBoardProps> = props => {
  const runtime = useLiveRuntime();
  return <CountingBoardSurface key={runtime ? 'tutor' : 'scripted'} {...props}
    useController={runtime ? useCountingTutorController : useScriptedController} tutorOwned={!!runtime} />;
};

const CountingBoardSurface = ({ data, className, autoStart = false, runtimePlanItemId, runtimeEvalMode,
  useController, tutorOwned }: CountingBoardProps & {
    useController: (options: CountingBoardControllerOptions) => CountingController; tutorOwned: boolean;
  }) => {
  const workspace = useRef<CountingWorkspace | null>(null);
  const [demonstration, setDemonstration] = useState<string[]>([]);
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

  // A themed board carries its own glyph and nouns (slice 2 of the interests
  // work); everything else resolves from the enum exactly as before. `custom`
  // without a themed triple still lands on ⬤ / "objects".
  const emoji = objects.emoji || OBJECT_EMOJI[objects.type] || OBJECT_EMOJI.custom;
  const objectWord = objects.word || objectWordFor(objects.type);
  const objectSingularWord = objectSingularFor(objectWord, objects.wordSingular);
  const isPreReader = gradeBand === 'K';

  // ── Stage-payload state (the runner owns progression; this is the board) ──
  const [countedObjects, setCountedObjects] = useState<Set<number>>(new Set());
  const [countOrder, setCountOrder] = useState<Map<number, number>>(new Map());
  const [alreadyCountedNote, setAlreadyCountedNote] = useState(false);
  const [handChoice, setHandChoice] = useState<number | null>(null);
  const [preCountedCount, setPreCountedCount] = useState(0);
  /** recount_moved: the set has been counted and has since moved. The board
   *  stops accepting taps here — being unable to recount is the whole task. */
  const [hasMoved, setHasMoved] = useState(false);
  /** take_away: objects the child has taken off the board. */
  const [removedObjects, setRemovedObjects] = useState<Set<number>>(new Set());
  /** add_more: extra objects the child has put on (indices past the start set). */
  const [addedExtras, setAddedExtras] = useState<Set<number>>(new Set());
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
  /** How many the child handed over on the last give_me_n commit. A ref because
   *  the pack is memoized and would otherwise read a stale count. */
  const givenCountRef = useRef(0);
  /** Any double-tap on an already-counted object this run (one-to-one signal). */
  const doubleCountEverRef = useRef(false);

  const evaluationContext = useEvaluationContext();
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
  // Built through the SCRIPT MODULE's gate, not inline: the DI drive plan
  // rebuilds the same items from the same payload, so an item the harness can
  // ask is an item the child gets and vice versa.
  const items = useMemo<CountingItem[]>(
    () => itemsFromChallenges(challenges, { objectWord, objectSingular: objects.wordSingular }),
    [challenges, objectWord, objects.wordSingular],
  );

  /** Item id → the challenge it was built from. The runner's index counts
   *  ITEMS and the gate can drop a challenge, so every challenge lookup on this
   *  surface goes through the id — never `challenges[currentIndex]`. */
  const challengeById = useMemo(
    () => new Map(challenges.map((ch) => [ch.id, ch])),
    [challenges],
  );

  const pack = useMemo<JudgedScriptPack<CountingItem> | undefined>(() => tutorOwned ? undefined : ({
    ...countingBoardPackBase(items),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.kind === 'subitize_perceptual'
        ? 'Look, then tap the hand that matches.'
        : item.kind === 'give_me_n'
          ? 'Touch the ones you want to give, then hand them over.'
          : 'Listen, then say how many out loud.',
      retry: (item) => item.kind === 'subitize_perceptual'
        ? 'Look again — then tap the hand that matches.'
        : item.kind === 'give_me_n'
          ? 'Have another go — touch the ones you want to give.'
          : 'Have another go — say how many.',
      noVerdict: () => 'One more time — say how many.',
      affirmedNext: 'Yes! You counted it.',
      done: 'Great counting today!',
    },
    // Facts from the board's own fields, per mode: a take_away board is described by its start and
    // change, not as "count N". One record per attempt; right answers reach student work too.
    observation: (item, { heard }) => countingObservation(item, gradeBand,
      { heard, given: givenCountRef.current, hand: handChoiceRef.current }),
    evidenceSummary: countingBoardEvidenceSummary,
  }), [items, objectWord, gradeBand, tutorOwned]);

  // ── Per-item board reset ──────────────────────────────────────────────────
  const resetBoardFor = useCallback((item: CountingItem) => {
    setDemonstration([]);
    pip.clear();
    setAlreadyCountedNote(false);
    setHandChoice(null);
    handChoiceRef.current = null;
    setHasMoved(false);
    setRemovedObjects(new Set());
    setAddedExtras(new Set());
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
  // this item. Takes the item rather than reading `currentItem`, so it holds no
  // runner identity and cannot go stale — and looks the challenge up BY ID,
  // because the pack's build gate can drop a challenge and the runner's index
  // then counts items, not challenges.
  const presentFlash = useCallback((item: CountingItem) => {
    const challenge = challengeById.get(item.id);
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
  }, [challengeById]);

  const handleFinished = useCallback((summary: Pick<JudgedRunSummary, 'outcomes' | 'accuracy' | 'attemptsCount' | 'diagnosisEvidence' | 'solvedCount' | 'learningResponses'> & { teachingAttempts?: unknown; assistanceProvenance?: string }) => {
    const byId = new Map(challenges.map((ch) => [ch.id, ch]));
    const subitizeOutcomes = summary.outcomes.filter((o) => byId.get(o.id)?.type === 'subitize');
    const oneToOne = !doubleCountEverRef.current;

    const metrics: CountingBoardMetrics = {
      type: 'counting-board',
      // The catalog's mode name, not the challenge type: `count_all` and `group_count` are the modes
      // `count` and `group` everywhere difficulty is tracked (CNB-3).
      evalMode: challenges[0] ? evalModeForKind(challenges[0].type) : 'default',
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

    // A board right after one correction still scores 67, so wrong first answers rarely reach the
    // session score; the runner's evidence carries the first-response share the shared gate reads.
    const diagnosisEvidence = summary.diagnosisEvidence;
    evaluation.submitResult(
      summary.solvedCount === challenges.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses, diagnosisEvidence,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined,
      diagnosisEvidence,
    );
  }, [challenges, evaluation, items]);

  const runner = useController({
    items,
    workspace, objectiveId, planItemId: runtimePlanItemId, evalMode: runtimeEvalMode,
    ...(!tutorOwned && runtimePlanItemId ? { completionCue: '[CB_COMPLETE] Say exactly: "You finished this activity. Great counting!" Then wait silently for the lesson host.' } : {}),
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

  useEffect(() => {
    if (evaluationContext && runner.teachingResult && !evaluation.hasSubmitted) handleFinished(runner.teachingResult);
  }, [evaluationContext, runner.teachingResult, evaluation.hasSubmitted, handleFinished]);

  // AFTER the runtime mount is registered, never before: `start()` waits for
  // `grantOwnership('runner')`, which cannot be granted until this primitive's
  // mount exists. Declared earlier, its effect runs first and the runner spins.
  useLiveAutoStart(autoStart, resolvedInstanceId, runner.start);

  const currentItem = runner.currentItem;
  const currentChallenge = (currentItem ? challengeById.get(currentItem.id) : null) ?? null;

  // ── Per-challenge layout ──────────────────────────────────────────────────
  const startCount = currentChallenge?.count ?? 5;
  const changeBy = currentChallenge?.changeBy ?? 0;
  // add_more lays out the extras from the start (faint, waiting to be put on),
  // so putting one on never re-flows the objects the child already counted.
  const challengeCount = currentItem?.kind === 'add_more' ? startCount + changeBy : startCount;
  const challengeArrangement = currentItem?.kind === 'recount_moved' && hasMoved
    ? 'scattered'
    : (currentChallenge?.arrangement ?? 'scattered');
  const challengeGroupSize = currentChallenge?.groupSize;

  const isKSubitize = gradeBand === 'K' && currentItem?.kind === 'subitize';
  /**
   * The K route for count_on: the pre-counted group sits under a basket. At
   * Grade 1 the started objects stay visible (the band's own pedagogy, and the
   * contract's G1 gap defers that question to the EMERGING re-audit); at K a
   * visible started group can simply be counted from one, which is the skill
   * count_on exists to replace. Covered, "five already in the basket" is the
   * only way in — and the tutor speaks that number, so nothing is printed.
   */
  const isKCountOnHidden = gradeBand === 'K' && currentItem?.kind === 'count_on';
  /**
   * How many sit under the basket. Read from the CHALLENGE, not from the
   * runner-populated pre-count: `resetBoardFor` only fires when the tutor opens
   * an item, so a preCountedCount-driven cover left the whole board countable
   * from first paint — a child can count all eight before she has said a word,
   * which is the very thing count-on replaces.
   */
  const coveredCount = isKCountOnHidden ? (currentChallenge?.startFrom ?? 0) : 0;

  const scatterSeed = useMemo(() => {
    // The move IS a new seed: same objects, new places (conservation).
    const src = `${currentChallenge?.id ?? runner.currentIndex}${hasMoved ? '-moved' : ''}`;
    let h = 0;
    for (let i = 0; i < src.length; i++) {
      h = (h * 31 + src.charCodeAt(i)) >>> 0;
    }
    return (h % 2147483646) + 1; // Lehmer RNG needs a seed in 1..2147483646 (never 0)
  }, [currentChallenge?.id, runner.currentIndex, hasMoved]);

  const compareGroupsKey = currentChallenge?.compareGroups?.join(',') ?? '';
  const groupLayout = useMemo<GroupLayout | null>(() => {
    if (challengeArrangement !== 'groups') return null;
    const { sizes, cell } = boardGroups(challengeCount, challengeGroupSize,
      compareGroupsKey ? compareGroupsKey.split(',').map(Number) : null);
    return layoutGroups(sizes, cell);
  }, [challengeCount, challengeArrangement, challengeGroupSize, compareGroupsKey]);

  const positions = useMemo(() =>
    groupLayout?.positions ?? generatePositions(challengeCount, challengeArrangement, scatterSeed),
    [groupLayout, challengeCount, challengeArrangement, scatterSeed]
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

  // The primitive owns Pip's presentation. This is a projection of the runner's
  // phase and student events, never an action channel from the speech model.
  const pip = usePipTargets(currentItem?.id ?? null, runner.canAttempt);
  const pipSurface = usePipSurface(() => {
    if (!pip.dock.current || !currentItem || evaluation.hasSubmitted) return null;
    // Hidden (subitize after the flash), covered (count-on) and removed objects
    // are never published, even though their elements are known.
    const hidden = isKSubitize && !isSubitizeFlashing;
    const visibleIds = hidden ? [] : positions.flatMap((_pos, index) =>
      index < coveredCount || removedObjects.has(index) ? [] : [`object-${index}`]);
    const targets = pip.targets(visibleIds, () => objectWord);
    const pose = countingBoardPipPose({
      running: runner.running, preparing: runner.preparing,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      judging: runner.stage === 'judging', tutorSpeaking: runner.tutorSpeaking,
      cueMatchesItem: runner.cuedItemId === currentItem.id,
      perceptual: ['subitize', 'subitize_perceptual'].includes(currentItem.kind) || hasMoved,
      giving: currentItem.kind === 'give_me_n', visibleIds: targets.map((target) => target.id),
      lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentItem.id,
      label: `Counting workspace: ${objectWord}`, dock: pip.dock.current, targets, pose,
    };
  });

  // Cancel timers on unmount.
  useEffect(() => () => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
  }, []);

  // ── Tap-to-count — the working surface, never the commit ──────────────────
  const handleObjectTap = useCallback((objectIndex: number) => {
    if (!runner.canAttempt || runner.isAwaitingGesture() || evaluation.hasSubmitted) return;
    const kind = currentItem?.kind;
    // Subitizing is perceptual recognition, never tap-counting.
    if (kind === 'subitize' || kind === 'subitize_perceptual') return;
    // Once the set has moved, the number has to be HELD, not re-counted.
    if (kind === 'recount_moved' && hasMoved) return;

    // give_me_n: a tap hands one over, a second tap puts it back. Correcting an
    // over-count is the child doing the skill, so it is never scolded — the
    // numbers just re-flow to the order they were taken in.
    if (kind === 'give_me_n' && countedObjects.has(objectIndex)) {
      SoundManager.tap();
      setCountedObjects((prev) => {
        const next = new Set(prev);
        next.delete(objectIndex);
        return next;
      });
      setCountOrder((prev) => {
        const remaining = Array.from(prev.entries())
          .filter(([idx]) => idx !== objectIndex)
          .sort((a, b) => a[1] - b[1]);
        const next = new Map<number, number>();
        remaining.forEach(([idx], n) => next.set(idx, n + 1));
        return next;
      });
      return;
    }

    // take_away: the first `changeBy` taps take objects OFF the board; after
    // that the same tap counts what is left.
    if (kind === 'take_away' && !removedObjects.has(objectIndex) && removedObjects.size < (currentItem?.changeBy ?? 0)) {
      SoundManager.tap();
      setRemovedObjects((prev) => new Set(prev).add(objectIndex));
      setCountedObjects((prev) => {
        const next = new Set(prev);
        next.delete(objectIndex);
        return next;
      });
      return;
    }

    // add_more: a faint extra is put ON the board by its first tap; counting it
    // is a separate, later tap.
    if (kind === 'add_more' && objectIndex >= (currentChallenge?.count ?? 0) && !addedExtras.has(objectIndex)) {
      SoundManager.tap();
      setAddedExtras((prev) => new Set(prev).add(objectIndex));
      return;
    }

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

    // The last object counted is the moment the set moves — the child has held
    // the number, and now the board rearranges under it.
    if (kind === 'recount_moved' && newCount >= (currentChallenge?.count ?? 0)) {
      setHasMoved(true);
      // The count trace goes with the move: number tags left on the objects
      // would BE the answer, sitting on screen while the child is asked for it.
      setCountedObjects(new Set());
      setCountOrder(new Map());
    }
  }, [
    runner, evaluation.hasSubmitted, currentItem?.kind, currentItem?.changeBy,
    countedObjects, removedObjects, addedExtras, hasMoved, currentChallenge?.count,
  ]);

  // ── The give-me-N commit — the handover IS the answer ─────────────────────
  const handleGiveCommit = useCallback(() => {
    const item = runner.currentItem;
    if (!runner.canAttempt || evaluation.hasSubmitted) return;
    if (!item || item.kind !== 'give_me_n') return;
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    givenCountRef.current = countedObjects.size;
    if (runner.submitGestureResponse) runner.submitGestureResponse(countedObjects.size);
    else runner.submitGestureAttempt(giveVerdictCue(item, countedObjects.size));
  }, [runner, evaluation.hasSubmitted, countedObjects]);

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
    if (runner.submitGestureResponse) runner.submitGestureResponse(fingers);
    else runner.submitGestureAttempt(handVerdictCue(item, fingers));
  }, [runner, evaluation.hasSubmitted]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  /** `subitize_perceptual` is answered by picking a hand, so an all-perceptual
   *  run was never counted "out loud". */
  useLayoutEffect(() => {
    workspace.current = {
      objects: positions.flatMap((_pos, index) => {
        if (index < coveredCount || removedObjects.has(index) || (isKSubitize && !isSubitizeFlashing)) return [];
        const layout = boardGroups(challengeCount, challengeGroupSize, currentChallenge?.compareGroups);
        let offset = 0;
        const groupIndex = layout.sizes.findIndex(size => { offset += size; return index < offset; });
        const group = currentItem?.kind === 'compare' ? (groupIndex === 0 ? 'left' : 'right')
          : currentItem?.kind === 'group_count' ? String(groupIndex + 1) : undefined;
        const pending = currentItem?.kind === 'add_more' && index >= (currentChallenge?.count ?? 0) && !addedExtras.has(index);
        return [{ id: `object-${index}`, label: `${objectSingularWord} ${index + 1}${pending ? ' (waiting to be added)' : ''}`,
          selected: countedObjects.has(index), ...(group ? { group } : {}) }];
      }),
      demonstration,
      // `markedOnBoard`, not `counted`: this is how many objects carry a count mark
      // right now, which is zero whenever the child answers out loud. Named
      // `counted` it read to the observer as "the learner counted zero" and
      // contradicted a tutor who had just affirmed a correct spoken count.
      facts: { kind: currentItem?.kind ?? '', objects: objectWord, markedOnBoard: countedObjects.size,
        takenOff: removedObjects.size, putOn: addedExtras.size, moved: hasMoved ? 'yes' : 'no',
        startFrom: currentItem?.startFrom ?? '', changeBy: currentItem?.changeBy ?? '',
        constraints: currentItem?.kind === 'subitize_perceptual' ? 'Pre-numeric matching: use no number words. Learner picks a hand.'
          : currentItem?.kind === 'subitize' ? 'Quick look: present the stimulus before accepting an answer.'
          : currentItem?.kind === 'recount_moved' ? 'After the move, remember the quantity; do not recount.' : '' },
      canDemonstrate: !['subitize', 'subitize_perceptual'].includes(currentItem?.kind ?? '') && !hasMoved,
      canPresent: isKSubitize,
      readyForResponse: (!isKSubitize || subitizeAnswerReady)
        && (currentItem?.kind !== 'take_away' || removedObjects.size === (currentItem.changeBy ?? 0))
        && (currentItem?.kind !== 'add_more' || addedExtras.size === (currentItem.changeBy ?? 0))
        && (currentItem?.kind !== 'recount_moved' || hasMoved),
      mark: setDemonstration,
      clearPresentation: () => {
        setDemonstration([]);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
        flashTimeoutRef.current = null; noteTimerRef.current = null;
      },
    };
    runner.publishWorkspace?.();
  });

  const completionSummary = runner.practiceSummary ?? runner.summary;
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;
  const celebrationMessage = useMemo(() => {
    const n = completionSummary?.solvedCount ?? 0;
    const boards = `${n} board${n === 1 ? '' : 's'} of ${objectWord}`;
    switch (judgedAnswerMix(items)) {
      case 'gesture':
        return `You matched ${boards} — you saw how many!`;
      case 'mixed':
        return `You counted ${boards}!`;
      default:
        return `You counted ${boards} out loud!`;
    }
  }, [items, objectWord, completionSummary]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!showSummary) return [];
    return phaseResultsFromSummary(challenges, completionSummary, (ch) => {
      const config = CHALLENGE_TYPE_CONFIG[ch.type] ?? { label: ch.type, icon: '🔢' };
      const assisted = runner.practiceSummary?.outcomes.find(o => o.id === ch.id)?.assisted;
      return { label: `${config.label} — ${ch.count} ${objectWord}${assisted ? ' (with help)' : ''}`, icon: config.icon };
    }).map((phase, index) => {
      const outcome = runner.practiceSummary?.outcomes.find(o => o.id === challenges[index].id);
      return outcome ? { ...phase, attempts: outcome.attempts, firstTry: outcome.solved && outcome.attempts === 1 } : phase;
    });
  }, [showSummary, completionSummary, runner.practiceSummary, challenges, objectWord]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!currentChallenge && !showSummary) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No counting challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const kind = currentItem?.kind;
  const boardTappable = kind !== 'subitize' && kind !== 'subitize_perceptual'
    && !(kind === 'recount_moved' && hasMoved);
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
            {kind === 'subitize_perceptual' ? 'Tap the hand' : kind === 'give_me_n' ? 'Choose and give' : 'Say it out loud'}
          </LuminaBadge>
        </div>
        {!isPreReader && description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && currentChallenge && (
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
                {showGroupCircles && groupLayout?.rings.map((ring, g) => (
                  <ellipse
                    key={`group-${g}`}
                    data-group-ring={g}
                    cx={ring.cx}
                    cy={ring.cy}
                    rx={ring.rx}
                    ry={ring.ry}
                    fill="rgba(234,179,8,0.05)"
                    stroke="rgba(234,179,8,0.2)"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                  />
                ))}

                {/* The K count-on basket — the started group, covered */}
                {isKCountOnHidden && coveredCount > 0 && (() => {
                  const pre = positions.slice(0, Math.min(coveredCount, positions.length));
                  if (pre.length === 0) return null;
                  const x0 = Math.min(...pre.map((p) => p.x)) - OBJECT_SIZE;
                  const x1 = Math.max(...pre.map((p) => p.x)) + OBJECT_SIZE;
                  const y0 = Math.min(...pre.map((p) => p.y)) - OBJECT_SIZE * 0.8;
                  const y1 = Math.max(...pre.map((p) => p.y)) + OBJECT_SIZE * 0.8;
                  return (
                    <g>
                      <rect
                        x={x0} y={y0} width={x1 - x0} height={y1 - y0}
                        rx={16}
                        fill="rgba(59,130,246,0.18)"
                        stroke="rgba(59,130,246,0.45)"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                      />
                      <text
                        x={(x0 + x1) / 2} y={(y0 + y1) / 2}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize={OBJECT_SIZE}
                        className="select-none pointer-events-none"
                      >
                        🧺
                      </text>
                    </g>
                  );
                })()}

                {/* Objects — hidden during the K subitize answer phase (flash-then-hide) */}
                {!(isKSubitize && !isSubitizeFlashing) && positions.map((pos, index) => {
                  const isCounted = countedObjects.has(index);
                  const countNum = countOrder.get(index);
                  const isPreCounted = kind === 'count_on' && index < preCountedCount;
                  // Taken off the board, or still under the K basket: not drawn.
                  if ((kind === 'take_away' && removedObjects.has(index)) || index < coveredCount) {
                    return null;
                  }
                  // An extra waiting to be put on: faint until the child taps it.
                  const isPendingExtra = kind === 'add_more' && index >= startCount && !addedExtras.has(index);

                  return (
                    <g
                      key={index}
                      ref={pip.ref(`object-${index}`)}
                      data-pip-object={`object-${index}`}
                      data-tutor-demonstration={demonstration.includes(`object-${index}`) || undefined}
                      role={boardTappable ? 'button' : undefined}
                      tabIndex={boardTappable ? 0 : undefined}
                      aria-label={boardTappable ? `Touch ${objectWord}` : undefined}
                      onFocus={() => pip.look(`object-${index}`)}
                      onPointerDown={() => pip.look(`object-${index}`)}
                      onKeyDown={boardTappable ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          pip.look(`object-${index}`);
                          handleObjectTap(index);
                        }
                      } : undefined}
                      className={boardTappable ? 'cursor-pointer' : undefined}
                      onClick={boardTappable ? () => { pip.look(`object-${index}`); handleObjectTap(index); } : undefined}
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

                      {demonstration.includes(`object-${index}`) && <circle cx={pos.x} cy={pos.y}
                        r={OBJECT_SIZE / 2 + 9} fill="rgba(34,211,238,0.15)" stroke="#22d3ee" strokeWidth={4} />}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={OBJECT_SIZE / 2}
                        fill={isCounted
                          ? (isPreCounted ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.12)')
                          : 'rgba(255,255,255,0.04)'
                        }
                        stroke={isPendingExtra ? 'rgba(255,255,255,0.35)' : undefined}
                        strokeWidth={isPendingExtra ? 2 : undefined}
                        strokeDasharray={isPendingExtra ? '5 4' : undefined}
                        className="transition-colors duration-150"
                      />

                      <text
                        x={pos.x}
                        y={pos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={OBJECT_SIZE * 0.6}
                        className="select-none pointer-events-none"
                        style={{ opacity: isPendingExtra ? 0.25 : isCounted ? 1 : 0.7 }}
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

            {demonstration.length > 0 && <p className="text-center text-sm text-cyan-200" role="status">Watch my selection. Your selection stays yours.</p>}
            {pipSurface && <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
              className="mx-auto flex min-h-28 w-full max-w-[480px] items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}

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

            {/* The handover — the give_me_n commit. The pile stays on the board;
                what the child took is what they hand over. */}
            {kind === 'give_me_n' && (
              <div className="flex justify-center">
                <LuminaButton
                  tone="primary"
                  disabled={!runner.canAttempt || countedObjects.size === 0}
                  onClick={handleGiveCommit}
                >
                  Give them to me
                </LuminaButton>
              </div>
            )}

            {/* The move happened — the number has to be held, not re-counted. */}
            {kind === 'recount_moved' && hasMoved && (
              <p className="text-center text-sm text-cyan-300">
                They moved! How many now?
              </p>
            )}

            {/* What is still to take off / put on. A count of the child's own
                actions, never of the answer. */}
            {kind === 'take_away' && removedObjects.size < (currentItem?.changeBy ?? 0) && (
              <p className="text-center text-sm text-slate-300">
                Take away {numberWordFor((currentItem?.changeBy ?? 0) - removedObjects.size)} more.
              </p>
            )}
            {kind === 'add_more' && addedExtras.size < (currentItem?.changeBy ?? 0) && (
              <p className="text-center text-sm text-slate-300">
                Touch the faded ones to put them on.
              </p>
            )}

            {alreadyCountedNote && (
              <p className="text-center text-xs text-amber-300">
                You already counted that one — try a different {objectSingularWord}!
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
                    onClick={() => runner.presentStimulus ? runner.presentStimulus() : presentFlash(currentItem)}
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
                  : kind === 'give_me_n'
                    ? 'Touch the ones you want to give, then hand them over.'
                    : 'Tap each object as you count, then say how many out loud.'}
              </p>
            )}

            {/* The pre-K hand pick is answered with the hands — the orb names
                that turn instead of claiming to listen for it. */}
            <JudgedMicPanel run={runner} gestureLabel="Your turn — tap the hand" />
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
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
