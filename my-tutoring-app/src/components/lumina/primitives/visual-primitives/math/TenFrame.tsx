'use client';

/**
 * TenFrame — taught on the shared tutor/JEV workspace (`tenFrame.boss.ts`); a mount with no tutor shows the shared
 * "needs the tutor" card (`withWorkspaceOnly`).
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - subitize: counters flash, then HIDE, and the child SAYS how many they saw. The first look is started by the
 *    tutor's `present` or the child's Show me; "Show again" re-shows the stimulus, never the answer.
 *  - make_ten @ Grades 1-2: the frame shows some counters; the child SAYS how many more make ten.
 *  - add / subtract: the frame is the working surface — the child places or removes counters — and the SUM or
 *    DIFFERENCE is spoken.
 *  - build: the child PLACES counters. The placement is the answer.
 *  - make_ten @ K: the child TAPS EMPTY CELLS to fill the frame; the counters they placed are the enacted complement
 *    (contract R6). It commits the moment the frame is full.
 *  - build_teen: the TOP frame opens full — that is a ten — and the child taps the empty boxes below it until the two
 *    frames hold the teen number asked for (K.NBT.1).
 *  - decompose_teen: a teen group arrives SCATTERED over both frames, all red, and the child turns ten of them yellow.
 *    The scatter is load-bearing: seeded top-frame-first, "flip the full row" would be a layout cue.
 *  - build_pair (open build): the frame opens EMPTY; the child picks red or yellow and taps boxes to make the number
 *    from two colours, any pair, then presses "I'm done!". Try again keeps the build.
 *  - split: the whole group is already on the frame, all red, and the child turns some yellow (contract R9). Taps
 *    flip; nothing is added or taken away. A later item on the same total asks for a DIFFERENT way.
 *
 * A hands turn closes on STILLNESS (`armStillness`): when the frame stops changing for `PLACEMENT_SETTLE_MS` the
 * frame checks the placement with its own code judge (`judgeSplit`, `judgeTeen`, a count match). No commit is
 * correctness-gated.
 *
 * ANSWER-LEAK RULE — HERE THE LEAK IS PIXELS, NOT STRINGS.
 *  - R4: subitize counters hide before the answer is asked for, and a hidden frame cannot be tapped.
 *  - R5: the empty-space readout is never rendered — on a make-ten item it IS the answer.
 *  - The running count is a lever on build, build_teen and build_pair, and withdrawn on add/subtract (it equals the
 *    number about to be said). The number appears on screen only after a checked success (`revealHeld`).
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { useBuildWatcher } from '../../build-layer/buildLayer';
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
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TenFrameMetrics } from '../../../evaluation/types';
import { judgedAnswerMix } from '../../../hooks/judgedScriptContract';
import {
  isTeenKind,
  judgeSplit,
  judgeTeen,
  splitKey,
  teenTotalFor,
  SPLIT_COLOR_A,
  SPLIT_COLOR_B,
  TEEN_TEN,
  type TenFrameBand,
  type TenFrameItem,
} from './tenFrameDomain';
import { countsFlips, describeFrameResponse, evalModeForKind, frameMiss, workspaceScene } from './tenFrameWorkspace';
import { COUNT_LEVER, TEN_FRAME_LEVERS, leverView, type ModelFrame, type TenFrameLeverContext } from './tenFrameLevers';
import { tenFrameBoss, tenFrameItems } from './tenFrame.boss';
import { numberWordFor } from './countingBoardDomain';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary, practiceScore } from '../../../hooks/usePhaseResults';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { SupportTier } from '../../../components/live-activity/supportFact';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface TenFrameChallenge {
  id: string;
  type:
    | 'build'
    | 'subitize'
    | 'make_ten'
    | 'split'
    | 'build_teen'
    | 'decompose_teen'
    | 'build_pair'
    | 'add'
    | 'subtract';
  /** Student-facing prompt. Synthesized deterministically by the generator from
   *  the numeric fields below — never authored by the LLM (see SP-17). Shown to
   *  readers only; the tutor SPEAKS the problem for everyone. */
  instruction: string;
  targetCount: number;
  startCount?: number; // for subtract: how many counters are on the frame before removal
  addend1?: number; // for add: first addend (addend1 + addend2 = targetCount)
  addend2?: number; // for add: second addend
  flashDuration?: number | null; // ms, for subitize mode
  hint: string;
  narration: string;
  /** Item-space calibration stamp (add-sub-20): never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
  /** The lesson's support tier, stamped by the generator: when a model lever comes. Absent on older payloads. */
  supportTier?: SupportTier;
}

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
export interface TenFrameData {
  /** Safe adaptation metadata; `source` is stamped only by the observation delivery server. */
  learningAdaptation?: LearningAdaptation<'contrast_same_first_number_different_second'>;
  title: string;
  description?: string;
  mode: 'single' | 'double';
  counters: {
    count: number;
    color: string;
    positions: number[];
  };
  twoColorMode?: {
    enabled: boolean;
    color1Count: number;
    color2Count: number;
    color1: string;
    color2: string;
  };
  challenges: TenFrameChallenge[];
  showOptions?: {
    showCount?: boolean;
    showEquation?: boolean;
    /** Retained so the generator contract is unchanged. NEVER rendered: on a
     *  make-ten item the empty-space count is the answer (R5). */
    showEmptyCount?: boolean;
    allowFlip?: boolean;
  };
  imagePrompt?: string | null;
  gradeBand?: TenFrameBand;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TenFrameMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  build: { label: 'Build', icon: '🧱' },
  subitize: { label: 'Subitize', icon: '👁️' },
  make_ten: { label: 'Make Ten', icon: '🎯' },
  split: { label: 'Split', icon: '🔴🟡' },
  build_teen: { label: 'Ten and Some More', icon: '🔟' },
  decompose_teen: { label: 'Find the Ten', icon: '🔍' },
  build_pair: { label: 'Make It Two Colours', icon: '🎨' },
  add: { label: 'Add', icon: '➕' },
  subtract: { label: 'Subtract', icon: '➖' },
};

const COUNTER_COLORS: Record<string, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  blue: '#3b82f6',
  green: '#22c55e',
};

/**
 * The number that may appear on screen once an item is solved, and never before
 * (answer-leak rule). `yellow` is the flip count the child committed on `split`.
 */
function rewardFor(item: TenFrameItem, yellow: number): string {
  return item.kind === 'build_pair'
    // The pair the learner MADE, shown only after the check passed.
    ? `${item.answer - yellow} + ${yellow} = ${item.answer}`
    : item.kind === 'subitize'
    ? `${item.answer} — ${numberWordFor(item.answer)} ${item.answer === 1 ? 'counter' : 'counters'}!`
    : item.kind === 'split'
      // The pair the CHILD produced, not a target — the only moment either part appears on screen.
      ? `${item.answer - yellow} + ${yellow} = ${item.answer}`
    : isTeenKind(item.kind)
      // The decomposition the child just built: ten and the ones (K.NBT.1).
      ? `${TEEN_TEN} + ${teenTotalFor(item) - TEEN_TEN} = ${teenTotalFor(item)}`
    : item.kind === 'make_ten'
      ? `${item.shown} + ${item.answer} = ${item.capacity}`
      : item.kind === 'add'
        ? `${item.addend1} + ${item.addend2} = ${item.answer}`
        : item.kind === 'subtract'
          ? `${item.shown} − ${item.removed} = ${item.answer}`
          : `${item.answer} ${item.answer === 1 ? 'counter' : 'counters'}!`;
}

const CELL_SIZE = 56;
const CELL_GAP = 4;
const CELL_RADIUS = 8;
const COUNTER_RADIUS = 18;
const FRAME_COLS = 5;
const FRAME_ROWS = 2;
const FRAME_PADDING = 8;

/** How long a hands turn may stay still before it commits. The window itself
 *  is the runner's (`armStillness`); this is the one number that is a property
 *  of THIS board — ten counters placed one at a time. */
const PLACEMENT_SETTLE_MS = 3000;

/** How long the counters stay visible once the flash runs. The flash is
 *  STIMULUS PRESENTATION, not a progression clock — when it ends nothing
 *  advances. WHEN it starts is the workspace's `onPresentStimulus`. */
const SUBITIZE_FLASH_MS = 1500;   // default; per-challenge `flashDuration` wins (R7 tier lever)

// ============================================================================
// Props
// ============================================================================

interface TenFrameProps {
  data: TenFrameData;
  className?: string;
  /** Kept for hosts that still pass it; the workspace starts with the lesson. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the mount; selects the teaching workspace inside a live runtime. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const TenFrameSurface = ({ data, className, runtimePlanItemId }: TenFrameProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    mode = 'single',
    counters: initialCounters,
    twoColorMode,
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

  const { showCount = true, showEquation = false } = showOptions;

  const totalCells = mode === 'double' ? 20 : 10;
  const isPreReader = gradeBand === 'K';
  const counterColor = initialCounters?.color || 'red';

  // ── The frame (the workspace owns progression) ──
  const [filledCells, setFilledCells] = useState<Set<number>>(new Set());
  /** `split` / `decompose_teen`: which seeded counters the child has turned yellow. A flip never adds or removes a
   *  counter, so the group cannot change size and the only thing the item measures is the partition. */
  const [flippedCells, setFlippedCells] = useState<Set<number>>(new Set());
  const [countersVisible, setCountersVisible] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashAnswerReady, setFlashAnswerReady] = useState(false);
  /** The number JUST checked right — post-answer only (answer-leak rule); `revealHeld` gates it. */
  const [reward, setReward] = useState<string | null>(null);
  // In-item levers, keyed by the session item they were pulled on, and the easier item a simplify lever put on
  // screen in its place. The ref is what event handlers read.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<TenFrameItem | null>(null);
  const practiceRef = useRef<TenFrameItem | null>(null);
  /** The `longer_look` lever: the next quick look lasts twice as long. Read by the flash, set from the lever view. */
  const longLookRef = useRef(false);
  const displayItemRef = useRef<TenFrameItem | null>(null);

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What the frame held when it last stopped changing. On `split` this is the number turned YELLOW — the total is
   *  fixed by the item, so one number is the whole pair. */
  const pendingPlacementRef = useRef(0);
  /** build_pair: what was on the frame at the last "I'm done!", both colours. */
  const pairPlacedRef = useRef({ total: 0, yellow: 0 });
  const placementChangesRef = useRef(0);
  const fullFrameEverRef = useRef(false);
  /**
   * Every partition the child has already shown, per total: `5 → {"3+2"}`. THE SESSION IS THE UNIT — "decompose in
   * more than one way" (K.OA.3) cannot be assessed by any single item — so a repeat on a later item is a miss.
   */
  const shownSplitsRef = useRef<Map<number, Set<string>>>(new Map());
  /** build_pair: the same ledger for the pairs the learner MADE, kept apart from split's (another task). */
  const madePairsRef = useRef<Map<number, Set<string>>>(new Map());
  /** build_pair: the colour the next tapped box gets. */
  const [pairColour, setPairColour] = useState<'red' | 'yellow'>('red');
  /** build_pair: the frame svg, for the build watcher's picture. */
  const frameSvgRef = useRef<SVGSVGElement | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `ten-frame-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const evaluation = usePrimitiveEvaluation<TenFrameMetrics>({
    primitiveType: 'ten-frame',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // The boss's items: the family's build gate drops an unaskable challenge (zero answers, out-of-bench counts).
  const items = useMemo<TenFrameItem[]>(() => tenFrameItems(data), [data]);

  const challengeById = useMemo(
    () => new Map(challenges.map((ch) => [ch.id, ch])),
    [challenges],
  );

  // ── Per-item frame reset — every item owns its starting state (R6) ────────
  const resetFrameFor = useCallback((item: TenFrameItem) => {
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setIsFlashing(false);
    setFlashAnswerReady(false);

    // build and add start empty, make-ten seeds its shown group, subtract its start, split the WHOLE group,
    // build_teen the full top frame, and decompose_teen its group at the SCATTERED cells computed for this item.
    const seeded = item.kind === 'subitize' ? 0 : item.shown;
    setFilledCells(new Set(item.seedCells ?? Array.from({ length: seeded }, (_, i) => i)));
    // Every split item starts all-red: a carried-over flip would be a free part.
    setFlippedCells(new Set());
    setPairColour('red');
    // Flip modes count YELLOWS from zero; placement modes count what is on the frame.
    pendingPlacementRef.current = countsFlips(item) ? 0 : seeded;
    // Subitize hides its counters until the flash runs.
    setCountersVisible(item.kind !== 'subitize');
  }, []);

  // ── The subitize flash — WHAT is shown; the workspace decides WHEN ───────
  const presentFlash = useCallback((item: TenFrameItem) => {
    if (item.kind !== 'subitize') return;
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setFilledCells(new Set(Array.from({ length: Math.min(item.answer, totalCells) }, (_, i) => i)));
    setFlashAnswerReady(false);
    setCountersVisible(true);
    setIsFlashing(true);
    const duration = (challengeById.get(item.id)?.flashDuration || SUBITIZE_FLASH_MS) * (longLookRef.current ? 2 : 1);
    flashTimeoutRef.current = setTimeout(() => {
      setCountersVisible(false);
      setIsFlashing(false);
      setFlashAnswerReady(true);
      flashTimeoutRef.current = null;
    }, duration);
  }, [challengeById, totalCells]);

  // ── The submission, once, from the scored session ─────────────────────────
  const handleFinished = useCallback((summary: TeachingEvaluationResult) => {
    const kindOf = (id: string) => items.find((i) => i.id === id)?.kind;
    const subitizeOutcomes = summary.outcomes.filter((o) => kindOf(o.id) === 'subitize');
    const makeTenOutcomes = summary.outcomes.filter((o) => kindOf(o.id) === 'make_ten');
    const targetSum = items.reduce((sum, item) => sum + item.answer, 0);

    const metrics: TenFrameMetrics = {
      type: 'ten-frame',
      // The catalog's mode name, not the challenge type: `split`, `add` and `subtract` are the modes
      // `decompose` and `operate` everywhere difficulty is tracked.
      evalMode: items[0] ? evalModeForKind(items[0].kind) : 'default',
      challengesCompleted: summary.solvedCount,
      challengesTotal: items.length,
      subitizeAccuracy: subitizeOutcomes.length > 0
        ? Math.round((subitizeOutcomes.filter((o) => o.solved).length / subitizeOutcomes.length) * 100)
        : 0,
      subitizeAverageTime: subitizeOutcomes.length > 0
        ? Math.round(subitizeOutcomes.reduce((s, o) => s + (o.seconds ?? 0) * 1000, 0) / subitizeOutcomes.length)
        : 0,
      makeTenCorrect: makeTenOutcomes.filter((o) => o.solved).length,
      makeTenTotal: makeTenOutcomes.length,
      usedMakeTenStrategy: fullFrameEverRef.current,
      counterPlacementEfficiency: placementChangesRef.current <= targetSum,
      // DISTINCT partitions the child produced across the session, summed over every total they split.
      twoColorDecompositionsExplored: Array.from(shownSplitsRef.current.values())
        .reduce((sum, ways) => sum + ways.size, 0),
      attemptsCount: summary.attemptsCount,
    };

    // The workspace's evidence carries the first-response share the shared gate reads.
    const diagnosisEvidence = summary.diagnosisEvidence;
    evaluation.submitResult(
      summary.solvedCount === items.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses, diagnosisEvidence,
        teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance },
      undefined,
      diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useWorkspaceRunner<TenFrameItem>({
    primitiveId: 'ten-frame',
    assignment: tenFrameBoss.assignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    instanceId: resolvedInstanceId,
    onFinished: handleFinished,
    // A fresh item never carries an easier item over from the last one.
    onItemOpened: (item) => { practiceRef.current = null; setPractice(null); resetFrameFor(item); },
    // THE TUTOR OWNS THE STIMULUS CLOCK: the flash waits for `present` or Show me, never a beat from item-open.
    onPresentStimulus: presentFlash,
    onAffirmed: (item) => {
      // The first moment a number may appear on screen; a correct quick look restores its counters (R4).
      if (item.kind === 'subitize') setCountersVisible(true);
      setReward(rewardFor(item, item.kind === 'build_pair' ? pairPlacedRef.current.yellow : pendingPlacementRef.current));
    },
    onCorrectionRetry: (sessionItem) => {
      // Try again on the easier item keeps it: reset ITS frame, not the full item's.
      const item = practiceRef.current ?? sessionItem;
      // An open build's Try again KEEPS the build, so the learner revises what they made.
      if (item.kind === 'build_pair') return;
      if (item.kind === 'subitize') {
        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = null;
        }
        setIsFlashing(false);
        // A look the learner already saw stays answerable; re-showing stays available, as assisted.
        setCountersVisible(false);
        return;
      }
      // Gesture items clear back to their opening state: the counters are indistinguishable, so there is no
      // "wrong slot" to clear. A decompose_teen retry keeps the SAME scatter. Voice items keep what was built.
      if (item.answerKind === 'gesture') {
        setFilledCells(new Set(item.seedCells ?? Array.from({ length: item.shown }, (_, i) => i)));
        setFlippedCells(new Set());
        pendingPlacementRef.current = countsFlips(item) ? 0 : item.shown;
      }
    },
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  displayItemRef.current = currentItem;
  // Every build lever starts withdrawn at every tier: a count running under the frame from the first tap
  // lets the child tap until it reads the target, which skips the counting the item measures.
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  const leverKind = currentItem?.kind === 'build' || currentItem?.kind === 'build_teen' || currentItem?.kind === 'build_pair';
  // What a lever reads beyond the item: the session (numbers still ahead stay out of models and practice) and,
  // on a split or a pair, the ways already shown for its total.
  const leverCtx: TenFrameLeverContext = { band: gradeBand, session: items,
    shownWays: sessionItem?.kind === 'split' ? shownSplitsRef.current.get(sessionItem.answer)
      : sessionItem?.kind === 'build_pair' ? madePairsRef.current.get(sessionItem.answer) : undefined };
  const view = leverView(sessionItem, pulledLevers, leverCtx);
  longLookRef.current = view.longLook;
  const fiveOnFrame = view.five;
  const fiveOn = fiveOnFrame >= 0;
  const currentChallenge = currentItem ? challengeById.get(currentItem.id) ?? null : null;

  // ── The gesture commit: the frame checks the placement with its own code judge ──
  const commitPlacement = useCallback(() => {
    const item = displayItemRef.current;
    if (!item || item.answerKind !== 'gesture') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const onFrame = pendingPlacementRef.current;
    if (item.kind === 'split') {
      // The payload is the YELLOW count; the verdict — including "you already showed that way" — is judged against
      // the session ledger, recorded BEFORE the check and unconditionally (a repeat recorded only on success could
      // be re-offered forever).
      const shown = shownSplitsRef.current.get(item.answer) ?? new Set<string>();
      const alreadyShown = new Set(shown);
      const verdict = judgeSplit(item, { a: item.answer - onFrame, b: onFrame }, alreadyShown);
      // An easier practice split is ungraded: its ways never enter the session's ledger.
      if (onFrame > 0 && onFrame < item.answer && !practiceRef.current) {
        shown.add(splitKey({ a: item.answer - onFrame, b: onFrame }));
        shownSplitsRef.current.set(item.answer, shown);
      }
      runner.commitGesture({ response: describeFrameResponse(item, onFrame), correct: verdict === 'correct',
        miss: frameMiss(item, { placed: onFrame, shownWays: alreadyShown }), cue: () => '' });
      return;
    }
    // `make_ten` and `build_teen` commit what the child ADDED to a seeded frame; `decompose_teen` its flip count.
    const enacted = item.kind === 'make_ten' || item.kind === 'build_teen'
      ? Math.max(0, onFrame - item.shown)
      : onFrame;
    runner.commitGesture({ response: describeFrameResponse(item, enacted),
      correct: isTeenKind(item.kind) ? judgeTeen(item, enacted) === 'correct' : enacted === item.answer,
      miss: frameMiss(item, { placed: enacted }), cue: () => '' });
  }, [runner]);

  // ── Open build (build_pair): "I'm done!" commits what is on the frame, both colours ──
  // Judged by `judgeSplit` against this total's ledger. The pair is recorded when it is a two-colour pair of the
  // right total (a practice item's never), as split records its ways.
  const commitPair = useCallback(() => {
    const item = displayItemRef.current;
    if (!item || item.kind !== 'build_pair' || !runner.canAttempt || evaluation.hasSubmitted) return;
    if (runner.isAwaitingGesture()) return;
    const total = filledCells.size;
    const yellow = Array.from(flippedCells).filter(c => filledCells.has(c)).length;
    pairPlacedRef.current = { total, yellow };
    const pair = { a: total - yellow, b: yellow };
    const made = madePairsRef.current.get(item.answer) ?? new Set<string>();
    const alreadyShown = new Set(made);
    const verdict = judgeSplit(item, pair, alreadyShown);
    if (total === item.answer && pair.a > 0 && pair.b > 0 && !practiceRef.current) {
      made.add(splitKey(pair));
      madePairsRef.current.set(item.answer, made);
    }
    SoundManager.tap();
    runner.commitGesture({ response: describeFrameResponse(item, total, yellow), correct: verdict === 'correct',
      miss: frameMiss(item, { placed: total, yellow, shownWays: alreadyShown }), cue: () => '' });
  }, [runner, evaluation.hasSubmitted, filledCells, flippedCells]);

  /** A hands turn closes on stillness. Any further tap resets the window. */
  const armSettle = useCallback((onFrame: number) => {
    pendingPlacementRef.current = onFrame;
    runner.armStillness(commitPlacement, PLACEMENT_SETTLE_MS);
  }, [runner, commitPlacement]);

  // ── Frame taps ────────────────────────────────────────────────────────────
  const handleCellClick = useCallback((cellIndex: number) => {
    const item = displayItemRef.current;
    // `canAttempt` is the live question ("is THIS item still open?"), never the stage word.
    if (!item || !runner.canAttempt || evaluation.hasSubmitted) return;
    if (runner.isAwaitingGesture()) return;
    // R4: subitizing is perceptual recognition, never tap-counting, and hidden counters can never be manipulated.
    if (item.kind === 'subitize') return;

    // build_pair: an empty box takes a counter of the chosen colour, a counter comes off. "I'm done!" commits.
    if (item.kind === 'build_pair') {
      SoundManager.tap();
      const placed = new Set(filledCells);
      const yellow = new Set(flippedCells);
      if (placed.has(cellIndex)) { placed.delete(cellIndex); yellow.delete(cellIndex); }
      else { placed.add(cellIndex); if (pairColour === 'yellow') yellow.add(cellIndex); }
      setFilledCells(placed);
      setFlippedCells(yellow);
      placementChangesRef.current += 1;
      if (placed.size >= totalCells) fullFrameEverRef.current = true;
      return;
    }

    // split / decompose_teen: a tap FLIPS a counter between red and yellow; empty cells are inert.
    if (countsFlips(item)) {
      if (!filledCells.has(cellIndex)) return;
      SoundManager.tap();
      const flipped = new Set(flippedCells);
      if (flipped.has(cellIndex)) flipped.delete(cellIndex);
      else flipped.add(cellIndex);
      setFlippedCells(flipped);
      placementChangesRef.current += 1;
      armSettle(flipped.size);
      return;
    }

    // K make-ten and build_teen: only the EMPTY cells are the answer surface; seeded and placed counters stay (R6).
    // ONLY make-ten commits on a full frame (`commitAt`); build_teen has no terminal state and closes on stillness.
    if ((item.kind === 'make_ten' || item.kind === 'build_teen') && item.answerKind === 'gesture') {
      if (filledCells.has(cellIndex)) return;
      SoundManager.tap();
      const placed = new Set(filledCells);
      placed.add(cellIndex);
      setFilledCells(placed);
      placementChangesRef.current += 1;
      if (placed.size >= totalCells) fullFrameEverRef.current = true;
      if (item.commitAt != null && placed.size >= item.commitAt) {
        runner.clearStillness();
        pendingPlacementRef.current = placed.size;
        commitPlacement();
      } else {
        armSettle(placed.size);
      }
      return;
    }

    SoundManager.tap();
    const placed = new Set(filledCells);
    if (placed.has(cellIndex)) placed.delete(cellIndex);
    else placed.add(cellIndex);
    setFilledCells(placed);
    placementChangesRef.current += 1;
    if (placed.size >= totalCells) fullFrameEverRef.current = true;

    // `build` closes on stillness; add/subtract are spoken items, so the frame there is a working surface only.
    if (item.answerKind === 'gesture') armSettle(placed.size);
    else pendingPlacementRef.current = placed.size;
  }, [
    runner, evaluation.hasSubmitted, filledCells, flippedCells, totalCells,
    armSettle, commitPlacement, pairColour,
  ]);

  const isSubitize = currentItem?.kind === 'subitize';

  // ── The scene and the levers, republished after every render ──────────────
  useLayoutEffect(() => {
    if (!currentItem) return;
    const scene = workspaceScene(currentItem, { onFrame: filledCells.size,
      yellow: countsFlips(currentItem) || currentItem.kind === 'build_pair' ? flippedCells.size : 0,
      hidden: isSubitize && !countersVisible });
    const levers = practice ? [] : TEN_FRAME_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    workspace.current = {
      ...leverScene(scene, {
        support: practice ? '' : TEN_FRAME_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : TEN_FRAME_LEVERS.onScreen(sessionItem, leverCtx, pulledLevers) }),
      canPresent: isSubitize,
      readyForResponse: !isSubitize || flashAnswerReady,
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the frame changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionItem || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const easier = TEN_FRAME_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          practiceRef.current = easier; setPractice(easier); resetFrameFor(easier);
          return { practice: tenFrameBoss.assignment(easier) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => { practiceRef.current = null; setPractice(null); },
      clearPresentation: () => {
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      },
    };
  });

  // The workspace shows its summary without an evaluation provider (the live host has none).
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;

  // Cancel the flash on unmount (the stillness window is the runner's).
  useEffect(() => () => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
  }, []);

  // The live line (shared build layer) on build_pair: what the frame looks like so far, NEVER a number.
  const buildSeeing = useBuildWatcher({
    buildKey: `${currentItem?.id}:${Array.from(filledCells).sort((a, b) => a - b).map(c => `${c}${flippedCells.has(c) ? 'y' : 'r'}`).join(',')}`,
    enabled: currentItem?.kind === 'build_pair' && filledCells.size > 0 && runner.canAttempt && !evaluation.hasSubmitted,
    svg: frameSvgRef,
    request: { task: currentItem?.kind === 'build_pair' ? `Make ${currentItem.answer} with red and yellow counters` : '',
      sceneNote: 'A ten frame: two rows of five boxes. The learner puts red and yellow counters in the boxes.', numbers: 'never' },
  });

  // ── Rendering helpers ─────────────────────────────────────────────────────
  const colorForCell = useCallback((index: number): string => {
    // The two-colour modes own their palette: the ask NAMES red and yellow, so a generator colour here would make
    // the tutor's words disagree with the child's screen (SPLIT_COLOR_* in tenFrameDomain).
    if (currentItem?.kind === 'split' || currentItem?.kind === 'decompose_teen' || currentItem?.kind === 'build_pair') {
      return flippedCells.has(index) ? SPLIT_COLOR_B : SPLIT_COLOR_A;
    }
    if (twoColorMode?.enabled) {
      return index < (twoColorMode.color1Count || 5)
        ? (twoColorMode.color1 || 'red')
        : (twoColorMode.color2 || 'yellow');
    }
    return counterColor;
  }, [twoColorMode, counterColor, flippedCells, currentItem?.kind]);

  const frameCount = mode === 'double' ? 2 : 1;
  const svgWidth = frameCount * (FRAME_COLS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2)
    + (frameCount - 1) * 24;
  const svgHeight = FRAME_ROWS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2;

  const renderFrame = useCallback((frameIndex: number) => {
    const offsetX = frameIndex * (FRAME_COLS * (CELL_SIZE + CELL_GAP) + FRAME_PADDING * 2 + 24);
    const cells: React.ReactNode[] = [];

    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        const cellIndex = frameIndex * 10 + row * FRAME_COLS + col;
        const x = offsetX + FRAME_PADDING + col * (CELL_SIZE + CELL_GAP);
        const y = FRAME_PADDING + row * (CELL_SIZE + CELL_GAP);
        const isFilled = filledCells.has(cellIndex);
        const shouldShowCounter = isFilled && countersVisible;
        // Levers on the empty boxes: `empty_glow` pulses them (K make-ten), `hide_empty` fades them (quick look).
        const glow = view.emptyGlow && !isFilled;
        const faded = view.hideEmpty && !shouldShowCounter;

        cells.push(
          <g key={cellIndex}>
            <rect
              data-pip-object={`cell-${cellIndex}`}
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={CELL_RADIUS}
              ry={CELL_RADIUS}
              className={`cursor-pointer transition-colors duration-150${glow ? ' animate-pulse' : ''}`}
              data-lever={glow ? 'empty-glow' : faded ? 'hide-empty' : undefined}
              fill={shouldShowCounter ? 'rgba(255,255,255,0.08)' : glow ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.03)'}
              stroke={glow ? 'rgba(250,204,21,0.7)' : 'rgba(255,255,255,0.15)'}
              strokeWidth={glow ? 2.5 : 1.5}
              opacity={faded ? 0.2 : 1}
              onClick={() => handleCellClick(cellIndex)}
            />
            {shouldShowCounter && (
              <circle
                cx={x + CELL_SIZE / 2}
                cy={y + CELL_SIZE / 2}
                r={COUNTER_RADIUS}
                fill={COUNTER_COLORS[colorForCell(cellIndex)] || colorForCell(cellIndex)}
                className="transition-all duration-200"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                onClick={() => handleCellClick(cellIndex)}
              />
            )}
          </g>
        );
      }
    }

    const frameWidth = FRAME_COLS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2;
    const frameHeight = FRAME_ROWS * (CELL_SIZE + CELL_GAP) - CELL_GAP + FRAME_PADDING * 2;
    const thisFrameFull = countersVisible
      && Array.from(filledCells).filter(c => c >= frameIndex * 10 && c < (frameIndex + 1) * 10).length === 10;

    return (
      <g key={`frame-${frameIndex}`}>
        <rect
          x={offsetX}
          y={0}
          width={frameWidth}
          height={frameHeight}
          rx={12}
          ry={12}
          fill="none"
          stroke={thisFrameFull ? 'rgba(234,179,8,0.6)' : 'rgba(255,255,255,0.2)'}
          strokeWidth={thisFrameFull ? 3 : 2}
          className="transition-colors duration-300"
        />
        {cells}
        {/* Five-frame lever: the top row outlined and marked 5. Never offered when five is the number to build. */}
        {fiveOnFrame === frameIndex && (
          <g data-lever="five-frame" data-aid pointerEvents="none">
            <rect x={offsetX + FRAME_PADDING - 5} y={FRAME_PADDING - 5} width={FRAME_COLS * (CELL_SIZE + CELL_GAP) - CELL_GAP + 10}
              height={CELL_SIZE + 10} rx={CELL_RADIUS + 4} fill="none" stroke="rgba(56,189,248,0.8)" strokeWidth={3} strokeDasharray="8 5" />
            <text x={offsetX + frameWidth + 4} y={FRAME_PADDING + CELL_SIZE / 2 + 6} fill="rgba(125,211,252,1)" fontSize={20} fontWeight={700}>5</text>
          </g>
        )}
      </g>
    );
  }, [filledCells, countersVisible, colorForCell, handleCellClick, fiveOnFrame, view.emptyGlow, view.hideEmpty]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  /** `build` runs never speak an answer and `subitize` runs never place one — only a mixed set earns "voice and hands". */
  const celebrationMessage = useMemo(() => {
    switch (judgedAnswerMix(items)) {
      case 'gesture':
        return 'You worked the ten frame with your own hands!';
      case 'mixed':
        return 'You worked the ten frame with your voice and your hands!';
      default:
        return 'You read the ten frame out loud!';
    }
  }, [items]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!showSummary) return [];
    const summary = runner.practiceSummary;
    return phaseResultsFromSummary(items, summary, (item) => {
      const config = CHALLENGE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' };
      return summary?.outcomes.find(o => o.id === item.id)?.assisted ? { ...config, label: `${config.label} (with help)` } : config;
    }).map((phase, index) => {
      const outcome = summary?.outcomes.find(o => o.id === items[index].id);
      return outcome ? { ...phase, attempts: outcome.attempts, firstTry: outcome.solved && outcome.attempts === 1 } : phase;
    });
  }, [showSummary, runner.practiceSummary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No ten frame challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const kind = currentItem?.kind;
  const isGestureItem = currentItem?.answerKind === 'gesture';
  const currentSolved = runner.currentSolved;
  // The running count is the child's own trace of what they placed. On add/subtract it EQUALS the number they are
  // about to say, and on split / decompose_teen the honest readout would be the parts, so it is absent there. On
  // `build`, `build_teen` and `build_pair` it is the running-count lever, off until pulled at every tier; once pulled
  // it shows even on an empty frame, so the pull changes the screen. `make_ten` keeps the tier's `showCount`.
  const countPulled = leverKind && pulledLevers.includes(COUNT_LEVER);
  const showTrace = (leverKind ? countPulled : showCount) && countersVisible
    && (kind === 'build' || kind === 'make_ten' || kind === 'build_teen' || kind === 'build_pair')
    && (filledCells.size > 0 || countPulled);

  const stageWord = currentSolved
    ? 'yes!'
    : runner.running
      ? (isGestureItem ? 'your hands' : 'how many?')
      : 'get ready';

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade / mode badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge accent="orange" className="text-xs">Grade 1-2</LuminaBadge>
                {kind && (
                  <LuminaBadge accent="emerald" className="text-xs">
                    {CHALLENGE_TYPE_CONFIG[kind]?.icon} {CHALLENGE_TYPE_CONFIG[kind]?.label}
                  </LuminaBadge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
            <LuminaBadge accent="cyan" className="text-xs">
              {kind === 'split'
                ? 'Make two groups'
                : kind === 'build_pair'
                  ? 'Build it'
                : kind === 'decompose_teen'
                  ? 'Find the ten'
                  : isGestureItem ? 'Use the frame' : 'Say it out loud'}
            </LuminaBadge>
          </div>
        </div>
        {!isPreReader && description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && currentItem && (
          <>
            {!isPreReader && (
              <div className="flex justify-center">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, items.length)}
                  total={items.length}
                  variant="dots"
                />
              </div>
            )}

            {/* Readers get the printed problem; the tutor SPEAKS it for everyone. */}
            {!isPreReader && currentChallenge?.instruction && (
              <LuminaPrompt>
                <span className="text-sm">{currentChallenge.instruction}</span>
              </LuminaPrompt>
            )}

            <PipDock />
            {/* Pip outlines the frame and its answer controls as a whole, never one box. */}
            <PipWorkspace className="space-y-4">
            <div className="flex justify-center">
              <svg
                ref={frameSvgRef}
                data-pip-object="frame"
                width={svgWidth + (fiveOn ? 30 : 0)}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth + (fiveOn ? 30 : 0)} ${svgHeight}`}
                className="max-w-full h-auto"
              >
                {Array.from({ length: frameCount }, (_, i) => renderFrame(i))}
              </svg>
            </div>

            {/* Open build (build_pair): the two colours, the live line (never a number), and the commit. */}
            {kind === 'build_pair' && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3" role="group" aria-label="Counter colour">
                  {(['red', 'yellow'] as const).map(c => (
                    <button key={c} type="button" aria-pressed={pairColour === c} aria-label={`${c === 'red' ? 'Red' : 'Yellow'} counters`}
                      onClick={() => setPairColour(c)}
                      className={`flex h-14 w-14 items-center justify-center rounded-full border-4 transition-transform ${pairColour === c ? 'scale-110 border-white' : 'border-white/20'}`}>
                      <span className="block h-9 w-9 rounded-full" style={{ background: COUNTER_COLORS[c] }} />
                    </button>
                  ))}
                </div>
                <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
                  {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
                </div>
                <LuminaButton tone="primary" disabled={!runner.canAttempt || filledCells.size === 0 || evaluation.hasSubmitted}
                  onClick={commitPair}>
                  I&apos;m done!
                </LuminaButton>
              </div>
            )}

            {/* Subitize flash prompt + re-show. "Show again" re-shows the STIMULUS and is never withdrawn. */}
            {isSubitize && (
              <div className="flex flex-col items-center gap-2">
                {view.longLook && (
                  <span className="text-cyan-300 text-xs font-medium" data-lever="longer-look">🐢 Long look</span>
                )}
                {!flashAnswerReady && (
                  <span className="text-orange-300 text-sm font-medium">
                    👀 {isFlashing ? 'Look quick!' : 'Get ready to look…'}
                  </span>
                )}
                {/* The first look is the learner's to start as well as the tutor's (`present`), so an item never
                    waits on a tool call to become answerable. */}
                {!flashAnswerReady && !isFlashing && runner.canAttempt && (
                  <LuminaButton tone="primary" className="text-sm" onClick={() => runner.presentStimulus()}>
                    Show me
                  </LuminaButton>
                )}
                {flashAnswerReady && runner.running && !currentSolved && (
                  // The CHILD asked for this one: the workspace records the replay as assistance.
                  <LuminaButton tone="subtle" className="text-xs" onClick={() => runner.presentStimulus()}>
                    Show again
                  </LuminaButton>
                )}
              </div>
            )}
            </PipWorkspace>

            {/* The child's own placement trace. Never an empty-space readout — on a make-ten item that number IS the
                answer (R5). */}
            {showTrace && (
              <div className="flex items-center justify-center text-sm" data-lever="running-count">
                <span className="text-slate-300">
                  Counters: <span className="text-orange-300 font-bold text-lg">{filledCells.size}</span>
                </span>
              </div>
            )}

            {/* decompose_teen's running-count lever: the yellow counters only; the leftover is never shown. */}
            {view.yellowCount && (
              <div className="flex items-center justify-center text-sm" data-lever="running-count">
                <span className="text-slate-300">
                  Yellow: <span className="text-yellow-300 font-bold text-lg">{flippedCells.size}</span>
                </span>
              </div>
            )}

            {/* Model levers: a small frame BESIDE the item, never on it; and on a split, the learner's own ways. */}
            {(view.models.length > 0 || view.ways.length > 0) && (
              <div className="flex flex-wrap items-end justify-center gap-4">
                {view.models.map((m, i) => <ModelFrameView key={`m${i}`} model={m} lever="model-frame" />)}
                {view.ways.map(w => (
                  <ModelFrameView key={`${w.a}+${w.b}`} lever="ways-shown"
                    model={{ whole: 10, red: w.a, yellow: w.b, crossed: 0, says: '' }} />
                ))}
              </div>
            )}

            {/* The FACT, for readers — the same thing the tutor says aloud. The answer stays off the screen. */}
            {showEquation && !isPreReader && kind === 'add' && (
              <p className="text-center text-sm text-slate-300 font-mono">
                {currentItem.addend1} + {currentItem.addend2} = ?
              </p>
            )}
            {showEquation && !isPreReader && kind === 'subtract' && (
              <p className="text-center text-sm text-slate-300 font-mono">
                {currentItem.shown} − {currentItem.removed} = ?
              </p>
            )}

            {/* The reward — the first moment a number may appear on screen. Gated on `revealHeld`, never on
                `currentSolved`: the next item opens in the same dispatch. */}
            {reward && runner.revealHeld && (
              <LuminaPanel className="p-3 text-center">
                <span className="text-emerald-300 text-lg font-black animate-bounce inline-block">
                  {reward}
                </span>
              </LuminaPanel>
            )}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                {kind === 'build_pair'
                  ? 'Pick a colour, tap the boxes to put counters on, tap a counter to take it off. Press I’m done! when it is finished.'
                  : kind === 'split' || kind === 'decompose_teen'
                  ? 'Tap a counter to turn it yellow — the frame checks when you stop.'
                  : isGestureItem
                    ? 'Tap the frame to place your counters — the frame checks when you stop.'
                    : 'Work it out on the frame, then say your answer out loud.'}
              </p>
            )}
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** A lever's small model frame, drawn beside the item: red counters, then yellow, then red ones crossed out. */
function ModelFrameView({ model, lever }: { model: ModelFrame; lever: string }) {
  const size = 22, gap = 3, cols = 5, rows = model.whole === 5 ? 1 : 2;
  const colours = [
    ...Array<string>(model.red).fill(COUNTER_COLORS.red), ...Array<string>(model.yellow).fill(COUNTER_COLORS.yellow),
    ...Array<string>(model.crossed).fill('crossed'),
  ];
  return (
    <div className="flex flex-col items-center gap-1" data-lever={lever}>
      <svg width={cols * (size + gap) + gap} height={rows * (size + gap) + gap} aria-hidden="true">
        {Array.from({ length: cols * rows }, (_, i) => {
          const x = gap + (i % cols) * (size + gap), y = gap + Math.floor(i / cols) * (size + gap), c = colours[i];
          return (
            <g key={i}>
              <rect x={x} y={y} width={size} height={size} rx={4} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.25)" />
              {c && <circle cx={x + size / 2} cy={y + size / 2} r={7} fill={c === 'crossed' ? COUNTER_COLORS.red : c}
                opacity={c === 'crossed' ? 0.45 : 1} />}
              {c === 'crossed' && <path d={`M${x + 4} ${y + 4} L${x + size - 4} ${y + size - 4} M${x + size - 4} ${y + 4} L${x + 4} ${y + size - 4}`}
                stroke="rgba(248,250,252,0.9)" strokeWidth={2} />}
            </g>
          );
        })}
      </svg>
      {model.says && <span className="text-xs text-slate-400">{model.says}</span>}
    </div>
  );
}

// One path: the tutor teaches on the workspace; a mount with no tutor shows the shared "needs the tutor" card.
const TenFrame = withWorkspaceOnly<TenFrameProps>('ten-frame', TenFrameSurface, props => props.data.title);

export default TenFrame;
