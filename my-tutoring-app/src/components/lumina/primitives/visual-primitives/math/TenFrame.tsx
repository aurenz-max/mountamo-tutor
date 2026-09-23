'use client';

/**
 * TenFrame — DI modality. The Live tutor owns the clock in every mode.
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - subitize: counters flash, then HIDE, and the child SAYS how many they saw
 *    into an open mic. The tutor asks, waits, judges the audio in-band,
 *    corrects contrastively, and its own affirmation is what moves the lesson.
 *  - make_ten @ Grades 1-2: the frame shows some counters; the child SAYS how
 *    many more make ten.
 *  - add / subtract: the frame is the working surface — the child places or
 *    removes counters — and the SUM or DIFFERENCE is spoken.
 *  - build: the child PLACES counters. The placement is the answer.
 *  - make_ten @ K: the child TAPS EMPTY CELLS to fill the frame; the counters
 *    they placed are the enacted complement (contract R6, untouched).
 *  - build_teen: the TOP frame opens full — that is a ten — and the child TAPS
 *    the empty boxes below it until the two frames hold the teen number the
 *    tutor asked for. The ones they place are the answer (K.NBT.1).
 *  - decompose_teen: a teen group arrives SCATTERED over both frames, all red,
 *    and the child TURNS TEN OF THEM YELLOW. The scatter is load-bearing: a
 *    group seeded top-frame-first would make "flip the full row" a layout cue
 *    a child who cannot count to ten could follow.
 *  - split: the frame opens with the whole group already on it, all red, and
 *    the child TURNS SOME YELLOW. Where they put the line between the colours
 *    is the decomposition (contract R9). Taps flip; nothing is added or taken
 *    away, so the total cannot drift and the partition is the only variable.
 *    A later item on the same total asks for a DIFFERENT way — "in more than
 *    one way" is half of K.OA.3 and no single item can assess it.
 *
 * WHY TWO MODES KEPT THEIR HANDS. Apply the costume test — can a child who
 * cannot do the skill still perform this action correctly? A stepper: yes,
 * anyone can operate one, so the steppers died. Placing counters: no — placing
 * five counters IS building the quantity five. In literacy the clicking almost
 * always stood in for a mouth; IN MATH THE MANIPULATIVE IS OFTEN THE SKILL, so
 * `build` and K make-ten keep their surface and gain a JUDGE. The full fork and
 * its evidence live in `tenFrameScript.ts`.
 *
 * WHAT CHANGED (first math consumer of useJudgedScriptRunner; qa/di/BACKLOG.md
 * item 18). Deleted: the subitize -/+ numeral stepper, the Grades 1-2 make-ten
 * stepper, the Check control, the Next control, the printed hint ladder, the
 * feedback card that named the target, and every improvised tutor turn. There
 * is no progression timer and no progression control anywhere in this file —
 * progression here has exactly one cause: a tutor verdict.
 *
 * HOW A HANDS-ONLY TURN CLOSES. A voice turn closes on SILENCE (the mic's
 * amplitude bracket). A hands turn closes on STILLNESS: when the frame stops
 * changing for `PLACEMENT_SETTLE_MS` the placement is described to the tutor
 * and judged. The WINDOW is the runner's (`armStillness`, 19c) — as is the
 * stimulus gate that decides when the subitize flash may run
 * (`onPresentStimulus`). This port wrote both first and gave them up; the ~40
 * lines and two footguns that used to live here are now inherited by every
 * judged port instead of retyped by each one. K make-ten additionally commits the moment the frame is full,
 * which is R6's literal rule — but stillness is what makes the item JUDGEABLE,
 * because stopping early is now a wrong answer the tutor corrects. Neither
 * commit is correctness-gated: a wrong placement commits exactly as readily as
 * a right one, which is the property a Check button used to fake.
 *
 * ANSWER-LEAK RULE — AND HERE THE LEAK IS PIXELS, NOT STRINGS.
 *  - R4 holds: subitize counters hide BEFORE the answer is asked for, and the
 *    frame cannot be tapped while hidden. If the loop left them on screen,
 *    subitizing would become counting and the mode would be destroyed.
 *  - R5 holds harder than before: the empty-space readout is not rendered at
 *    all — on a make-ten item it IS the answer.
 *  - The running count readout is withdrawn for add/subtract: it equals the
 *    number the child is about to say. It survives for build and make-ten as
 *    the child's own trace of what they placed (R3/R7, tier-governed).
 *  - The number only appears on screen AFTER the tutor has affirmed.
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor is quiet by default (it speaks only scripted lines); no
 * visible timers (the subitize flash is stimulus presentation — when it ends,
 * nothing moves forward); "Show again" re-shows the STIMULUS and never the
 * answer; adult chrome is hidden for pre-readers.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useTenFrameRuntime } from './useTenFrameRuntime';
import { commitGesture, useWorkspaceRunner, type LiveRun, type WorkspaceRunOptions }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { countsFlips, describeFrameResponse, evalModeForKind, workspaceAssignment, workspaceScene }
  from './tenFrameWorkspace';
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
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
  type JudgedScriptRunnerOptions,
} from '../../../hooks/useJudgedScriptRunner';
import { judgedAnswerMix, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  frameVerdictCue,
  isTeenKind,
  itemsFromChallenges,
  judgeSplit,
  judgeTeen,
  splitKey,
  teenTotalFor,
  tenFramePackBase,
  SPLIT_COLOR_A,
  SPLIT_COLOR_B,
  TEEN_TEN,
  type SplitVerdict,
  type TenFrameBand,
  type TenFrameItem,
} from './tenFrameScript';
import { tenFrameEvidenceSummary, tenFrameObservation } from './tenFrameEvidence';
import { numberWordFor } from './countingBoardScript';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { tenFramePipPose } from '../../../pip/tenFramePipPose';

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
  return item.kind === 'subitize'
    ? `${item.answer} — ${numberWordFor(item.answer)} ${item.answer === 1 ? 'counter' : 'counters'}!`
    : item.kind === 'split'
      // The pair the CHILD produced, not a target — this is the only moment
      // either part may appear on screen, and it appears as a record of their
      // own work.
      ? `${item.answer - yellow} + ${yellow} = ${item.answer}`
    : isTeenKind(item.kind)
      // The decomposition the child just built. On both teen modes it reads the
      // same way — ten and the ones — which is the sentence K.NBT.1 asks them
      // to be able to see.
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
 *  is the runner's (`armStillness`, 19c); this is the one number that is a
 *  property of THIS board — ten counters placed one at a time. */
const PLACEMENT_SETTLE_MS = 3000;

/** How long the counters stay visible once the flash runs. The flash is
 *  STIMULUS PRESENTATION, not a progression clock — when it ends nothing
 *  advances; the tutor is still waiting for the child's answer. WHEN it starts
 *  is the runner's `onPresentStimulus` gate, never a beat from item-open. */
const SUBITIZE_FLASH_MS = 1500;   // default; per-challenge `flashDuration` wins (R7 tier lever)

// ============================================================================
// Props
// ============================================================================

interface TenFrameProps {
  data: TenFrameData;
  className?: string;
  /** The live sandbox opts in only after its correlated mount handoff. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the mount; selects the teaching workspace inside a live runtime. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * The scripted runner's options beside the workspace controller's. The union is
 * declared here, in the file that hosts both, so the runner's types leave with
 * the scripted branch. `frame` feeds the runner-era runtime registration only.
 */
type TenFrameControllerOptions = Omit<WorkspaceRunOptions<TenFrameItem>, 'primitiveId' | 'assignment'>
  & Omit<JudgedScriptRunnerOptions<TenFrameItem>, 'pack' | 'instanceId' | 'onItemOpened' | 'onPresentStimulus'>
  & { pack?: JudgedScriptPack<TenFrameItem>;
    frame: { filledCells: Set<number>; flippedCells: Set<number>; cancelPresentation: () => void } };

function useScriptedController(options: TenFrameControllerOptions): LiveRun<TenFrameItem> {
  const runner = useJudgedScriptRunner<TenFrameItem>({ ...options, pack: options.pack! });
  useTenFrameRuntime({ runner, instanceId: options.instanceId, objectiveId: options.objectiveId,
    planItemId: options.planItemId, evalMode: options.evalMode, ...options.frame });
  return runner;
}

const useWorkspaceController = (options: TenFrameControllerOptions): LiveRun<TenFrameItem> =>
  useWorkspaceRunner<TenFrameItem>({ ...options, primitiveId: 'ten-frame', assignment: workspaceAssignment });

const TenFrameSurface = ({ data, className, autoStart = false, runtimePlanItemId, runtimeEvalMode, tutorOwned, useController }:
  TenFrameProps & { tutorOwned: boolean; useController: (options: TenFrameControllerOptions) => LiveRun<TenFrameItem> }) => {
  const live = useLuminaAIContext();
  const runtime = useLiveRuntime();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const autoStartedRef = useRef(false);
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

  // ── Stage-payload state (the runner owns progression; this is the frame) ──
  const [filledCells, setFilledCells] = useState<Set<number>>(new Set());
  /** `split` only: which of the seeded counters the child has turned yellow.
   *  Always a subset of `filledCells` — a split tap FLIPS a counter, it never
   *  adds or removes one, so the group the child is partitioning cannot change
   *  size under them and the only thing the item can measure is the partition. */
  const [flippedCells, setFlippedCells] = useState<Set<number>>(new Set());
  const [countersVisible, setCountersVisible] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashAnswerReady, setFlashAnswerReady] = useState(false);
  /** The number JUST affirmed — post-answer only (answer-leak rule). It is NOT
   *  cleared when the next item opens: that clear and the `onAffirmed` that set
   *  it landed in one React batch, so the reveal painted on the last item and
   *  nowhere else (18b). `runner.revealHeld` is the gate now. */
  const [reward, setReward] = useState<string | null>(null);

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What the frame held when it last stopped changing. On `split` this is the
   *  number turned YELLOW — the total is fixed by the item, so one number is
   *  the whole pair and the gesture channel needs no second field. */
  const pendingPlacementRef = useRef(0);
  const placementChangesRef = useRef(0);
  const fullFrameEverRef = useRef(false);
  /**
   * Every partition the child has already shown, per total: `5 → {"3+2"}`.
   *
   * THE SESSION IS THE UNIT, not the item — "decompose in more than one way"
   * (K.OA.3) cannot be assessed by any single item however well it is judged,
   * so a repeat on a later item is a wrong answer the tutor corrects. Keyed by
   * total because one session interleaves totals; a ref because a re-render in
   * the middle of a settle window must not lose what came before.
   */
  const shownSplitsRef = useRef<Map<number, Set<string>>>(new Map());
  /** Evidence only: the code verdict on the last committed split, and "Show again" taps on this item. */
  const splitVerdictRef = useRef<SplitVerdict | null>(null);
  const reshowsRef = useRef(0);

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

  // ── The pack: generated challenges → judged items + hand-authored script ──
  // Unaskable items are DROPPED here (zero answers, out-of-bench counts,
  // incoherent operations). Nothing is backfilled: a placeholder in a judged
  // loop becomes a spoken ask the tutor has to judge.
  const items = useMemo<TenFrameItem[]>(
    () => itemsFromChallenges(challenges, { capacity: totalCells, band: gradeBand }),
    [challenges, totalCells, gradeBand],
  );

  const challengeById = useMemo(
    () => new Map(challenges.map((ch) => [ch.id, ch])),
    [challenges],
  );

  const observe = useCallback((item: TenFrameItem, heard: string | null) => tenFrameObservation(item, {
    heard, onFrame: pendingPlacementRef.current, splitVerdict: splitVerdictRef.current, reshows: reshowsRef.current,
    equationShown: showEquation && !isPreReader && (item.kind === 'add' || item.kind === 'subtract'),
    countShown: showCount && (item.kind === 'build' || item.kind === 'make_ten' || item.kind === 'build_teen'),
  }), [showEquation, showCount, isPreReader]);

  // The cue surface (everything the tutor is ever sent) comes from the script
  // module, so the headless judged-loop harness drives the SAME cues this
  // screen does. Below it: what only a mounted component can own.
  const pack = useMemo<JudgedScriptPack<TenFrameItem> | undefined>(() => tutorOwned ? undefined : ({
    ...tenFramePackBase(items),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.answerKind === 'gesture'
        ? 'Listen, then use the frame.'
        : 'Listen, then say your answer out loud.',
      retry: (item) => item.answerKind === 'gesture'
        ? 'Have another go on the frame.'
        : 'Have another go — say your answer.',
      done: 'Great number work today!',
    },
    // Facts from the item's own fields and the committed frame, per mode; one record per attempt, so
    // right answers reach student work too. Read before the verdict resets the frame.
    observation: (item, { heard }) => observe(item, heard),
    evidenceSummary: tenFrameEvidenceSummary,
  }), [items, observe, tutorOwned]);

  // ── Per-item frame reset — every item owns its starting state (R6) ────────
  const resetFrameFor = useCallback((item: TenFrameItem) => {
    pip.clear();
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setIsFlashing(false);
    setFlashAnswerReady(false);
    splitVerdictRef.current = null;
    reshowsRef.current = 0;

    // A completed frame never carries into the next challenge: build and add
    // start empty, make-ten seeds its shown group, subtract seeds its start,
    // split seeds the WHOLE group the child is about to partition, build_teen
    // seeds the full top frame, and decompose_teen seeds its group at the
    // SCATTERED positions the script computed for this item.
    const seeded = item.kind === 'subitize' ? 0 : item.shown;
    setFilledCells(new Set(
      item.seedCells ?? Array.from({ length: seeded }, (_, i) => i),
    ));
    // Every split item starts all-red. Nothing about the previous partition
    // survives into the next ask — a carried-over flip would be a free part.
    setFlippedCells(new Set());
    // Flip modes count YELLOWS from zero; placement modes count what is on the
    // frame, so their pending value starts at whatever was seeded.
    pendingPlacementRef.current =
      item.kind === 'split' || item.kind === 'decompose_teen' ? 0 : seeded;
    // Subitize hides its counters until the flash runs; every other mode shows
    // whatever is on the frame.
    setCountersVisible(item.kind !== 'subitize');
  }, []);

  // ── The subitize flash — WHAT is shown; the runner decides WHEN ───────────
  // Called from `onPresentStimulus` once the tutor has finished her line for
  // this item (19c). Takes the item as an argument rather than reading
  // `currentItem`, so it holds no runner identity and cannot go stale.
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
    const duration = challengeById.get(item.id)?.flashDuration || SUBITIZE_FLASH_MS;
    flashTimeoutRef.current = setTimeout(() => {
      setCountersVisible(false);
      setIsFlashing(false);
      setFlashAnswerReady(true);
      flashTimeoutRef.current = null;
    }, duration);
  }, [challengeById, totalCells]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback((summary: Pick<JudgedRunSummary, 'outcomes' | 'accuracy' | 'attemptsCount' | 'diagnosisEvidence' | 'solvedCount' | 'learningResponses'>
    & { teachingAttempts?: unknown; assistanceProvenance?: string }) => {
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
        ? Math.round(
            subitizeOutcomes.reduce((s, o) => s + (o.seconds ?? 0) * 1000, 0) / subitizeOutcomes.length,
          )
        : 0,
      makeTenCorrect: makeTenOutcomes.filter((o) => o.solved).length,
      makeTenTotal: makeTenOutcomes.length,
      usedMakeTenStrategy: fullFrameEverRef.current,
      counterPlacementEfficiency: placementChangesRef.current <= targetSum,
      // Finally a real number: DISTINCT partitions the child produced across
      // the session, summed over every total they were asked to split. This
      // field has carried a hardcoded 0 since the metric was written; `split`
      // is the mode that measures it.
      twoColorDecompositionsExplored: Array.from(shownSplitsRef.current.values())
        .reduce((sum, ways) => sum + ways.size, 0),
      attemptsCount: summary.attemptsCount,
    };

    // An item right after one correction still scores 67, so wrong first answers rarely reach the
    // session score; the evidence carries the first-response share the shared gate reads.
    const diagnosisEvidence = summary.diagnosisEvidence;
    evaluation.submitResult(
      summary.solvedCount === items.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses, diagnosisEvidence,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined,
      diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useController({
    items, workspace, objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode ?? (items[0] ? evalModeForKind(items[0].kind) : 'default'),
    frame: { filledCells, flippedCells, cancelPresentation: () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    } },
    runtime,
    ...(!tutorOwned && runtimePlanItemId ? { completionCue: '[TF_COMPLETE] Say exactly: "You finished this activity. Nice work!" Then wait silently for the lesson host.' } : {}),
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1-2',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: resetFrameFor,
    // THE TUTOR OWNS THE STIMULUS CLOCK. The runner fires this once she has
    // spoken for THIS item and stopped — on the first ask, on every subsequent
    // challenge, and on a correction's re-flash. There is no window here to
    // tune and no wall-clock beat to race her sentence; see the option's
    // docblock for the two drives that wrote it.
    onPresentStimulus: presentFlash,
    stimulus: { when: (item) => item.kind === 'subitize' },
    onAffirmed: (item) => {
      // The first moment a number may appear on screen — and, for subitize, the
      // moment R4's "a correct response restores the counters" now hangs off
      // (it used to hang off a Check click that no longer exists).
      if (item.kind === 'subitize') setCountersVisible(true);
      setReward(rewardFor(item, pendingPlacementRef.current));
    },
    onCorrectionRetry: (item) => {
      // The tutor's correction re-modeled and re-asked in-band; restore the
      // working surface for another go. The settle window and the flash gate
      // are both re-armed by the runner on this path.
      if (item.kind === 'subitize') {
        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = null;
        }
        setIsFlashing(false);
        // The runner re-flashes after its correction. The workspace does not, so a look the
        // learner already saw stays answerable; re-showing stays available, as assisted.
        setFlashAnswerReady(ready => tutorOwned && ready);
        setCountersVisible(false);
        return;
      }
      // Gesture items clear back to their opening state: the counters are
      // indistinguishable, so there is no "wrong slot" to clear the way
      // cvc-speller does. Voice items keep whatever the child built.
      if (item.answerKind === 'gesture') {
        pip.clear();
        setFilledCells(new Set(
          item.seedCells ?? Array.from({ length: item.shown }, (_, i) => i),
        ));
        // The flip modes go back to all-red for the retry, and their pending
        // gesture is a FLIP count, so it resets to zero rather than to the
        // group size. A decompose_teen retry keeps the SAME scatter — moving
        // the counters between tries would make the correction unfollowable.
        setFlippedCells(new Set());
        pendingPlacementRef.current =
          item.kind === 'split' || item.kind === 'decompose_teen' ? 0 : item.shown;
      }
    },
  });

  const currentItem = runner.currentItem;
  const startRunnerRef = useRef(runner.start); startRunnerRef.current = runner.start;
  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !live.isConnected || !live.isListening
        || (live.sessionMode === 'lesson' && live.activePrimitiveId !== resolvedInstanceId)) return;
    autoStartedRef.current = true;
    void startRunnerRef.current();
  }, [autoStart, live.isConnected, live.isListening, live.sessionMode, live.activePrimitiveId, resolvedInstanceId]);
  const currentChallenge = currentItem ? challengeById.get(currentItem.id) ?? null : null;

  // Pip's presentation is a projection of the runner's phase and the child's
  // own taps; it never places, flips, commits, or advances anything.
  const pip = usePipTargets(currentItem?.id ?? null, runner.canAttempt);

  // ── The gesture commit ────────────────────────────────────────────────────
  // No Check control: nothing on screen may carry the child forward. The cue
  // goes out through `submitGestureAttempt`, which opens the attempt when the
  // cue is actually SENT — an attempt opened at commit time would block the
  // very cue meant to provoke its verdict (cvc-speller's finding).
  const commitPlacement = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.answerKind !== 'gesture') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const onFrame = pendingPlacementRef.current;
    if (item.kind === 'split') {
      // The gesture payload is the YELLOW count; the verdict — including "you
      // already showed that way" — is computed in the script module against the
      // session ledger. RECORDED BEFORE THE CUE, and unconditionally: a way the
      // child showed is a way they showed, whether or not the tutor liked it,
      // and a repeat that is only recorded on success would let the same pair
      // be re-offered forever.
      const shown = shownSplitsRef.current.get(item.answer) ?? new Set<string>();
      const alreadyShown = new Set(shown);
      splitVerdictRef.current = judgeSplit(item, { a: item.answer - onFrame, b: onFrame }, alreadyShown);
      if (onFrame > 0 && onFrame < item.answer) {
        shown.add(splitKey({ a: item.answer - onFrame, b: onFrame }));
        shownSplitsRef.current.set(item.answer, shown);
      }
      commitGesture(runner, { response: describeFrameResponse(item, onFrame), correct: splitVerdictRef.current === 'correct',
        cue: () => frameVerdictCue(item, onFrame, { alreadyShown }) });
      return;
    }
    // `make_ten` and `build_teen` both commit what the child ADDED to a seeded
    // frame; `decompose_teen` commits its flip count, which `armSettle` already
    // wrote. Everything else commits what is on the frame.
    const enacted = item.kind === 'make_ten' || item.kind === 'build_teen'
      ? Math.max(0, onFrame - item.shown)
      : onFrame;
    // The frame checks its own placement, with the same code judge the cue reports.
    commitGesture(runner, { response: describeFrameResponse(item, enacted),
      correct: isTeenKind(item.kind) ? judgeTeen(item, enacted) === 'correct' : enacted === item.answer,
      cue: () => frameVerdictCue(item, enacted) });
  }, [runner]);

  /** A hands turn closes on stillness. Any further tap resets the window, and
   *  the runner cancels it at item open, at a correction, and at the commit. */
  const armSettle = useCallback((onFrame: number) => {
    pendingPlacementRef.current = onFrame;
    runner.armStillness(commitPlacement, PLACEMENT_SETTLE_MS);
    // `armStillness` is identity-stable (refs inside); `runner` is not, but this
    // is an event-handler callback, never an effect dep.
  }, [runner, commitPlacement]);

  // ── Frame taps ────────────────────────────────────────────────────────────
  const handleCellClick = useCallback((cellIndex: number) => {
    if (runtime && runner.runtimeControls?.getState().suspended) return;
    const item = runner.currentItem;
    // NEVER gate interaction on the stage word — the runner sets `affirmed` and
    // opens the next item in the same dispatch, so a stage-gated frame ships
    // dead from item 2 on. `canAttempt` is the runner's own answer to the live
    // question ("is THIS item still open?"); it reads the solved ledger, not
    // the stage word. See its docblock for the drive that proved it.
    if (!item || !runner.canAttempt || evaluation.hasSubmitted) return;
    if (runner.isAwaitingGesture()) return;
    // R4: subitizing is perceptual recognition, never tap-counting, and hidden
    // counters can never be manipulated.
    if (item.kind === 'subitize') return;

    // split: the counters are the answer surface and the EMPTY cells are inert.
    // A tap FLIPS a counter between red and yellow — it never adds or removes
    // one, so the total the child was handed is the total they hand back and
    // the only variable the item measures is where the line between the two
    // groups falls. (This is the two-colour counter, in software: one disc, red
    // on one face, yellow on the other. `allowFlip` finally has a mode.)
    if (item.kind === 'split' || item.kind === 'decompose_teen') {
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

    // K make-ten and build_teen: only the EMPTY cells are the answer surface.
    // The seeded counters are fixed and placed ones stay placed (R6).
    //
    // ONLY make-ten auto-commits on a full frame. It has a terminal state and
    // R6 makes reaching it the answer; `build_teen` has none — the frame holds
    // twenty and the teen number is short of it — so it closes on stillness
    // like `build`. Reading `commitAt` directly rather than falling back to
    // `capacity` is what keeps those two apart.
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

    // `build` closes on stillness; add/subtract are voice items whose turn the
    // child closes by answering, so the frame there is a working surface only.
    if (item.answerKind === 'gesture') armSettle(placed.size);
    else pendingPlacementRef.current = placed.size;
  }, [
    runner, evaluation.hasSubmitted, filledCells, flippedCells, totalCells,
    armSettle, commitPlacement,
  ]);

  const isSubitize = currentItem?.kind === 'subitize';

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets; `present` runs the subitize flash.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentItem) return;
    workspace.current = {
      ...workspaceScene(currentItem, { onFrame: filledCells.size, yellow: countsFlips(currentItem) ? flippedCells.size : 0,
        hidden: isSubitize && !countersVisible }),
      demonstration: [], canDemonstrate: false, canPresent: isSubitize,
      readyForResponse: !isSubitize || flashAnswerReady,
      mark: () => {},
      clearPresentation: () => {
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      },
    };
    runner.publishWorkspace?.();
  });

  // The workspace path shows its summary without an evaluation provider (the live host has none).
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;

  // WHEN the flash runs is the runner's `onPresentStimulus` gate (19c): she has
  // to have spoken for THIS item and stopped. The ~40 lines that used to live
  // here — a `tutorHasSpoken` latch, a fallback timer, a prep-beat effect and
  // the two footguns they carried — are the runner's now, so the next port with
  // a timed stimulus inherits the drives instead of repeating them.

  // Cancel the flash on unmount (the stillness window is the runner's).
  useEffect(() => () => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
  }, []);

  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentItem || showSummary) return null;
    // Subitize publishes the frame only: its boxes sit over counters that are
    // hidden, and Pip does not single out anything the child cannot see.
    const subitize = currentItem.kind === 'subitize';
    const visibleIds = ['frame', ...(subitize ? [] : Array.from({ length: totalCells }, (_, i) => `cell-${i}`))];
    const targets = pip.targets(visibleIds, (id) => (id === 'frame' ? 'Ten frame' : 'A box on the frame'));
    const pose = tenFramePipPose({
      running: runner.running, preparing: runner.preparing,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      judging: runner.stage === 'judging', tutorSpeaking: runner.tutorSpeaking,
      cueMatchesItem: runner.cuedItemId === currentItem.id,
      subitize, gesture: currentItem.answerKind === 'gesture',
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentItem.id,
      label: 'Ten frame', dock: pip.dock.current, targets, pose,
    };
  });

  // ── Rendering helpers ─────────────────────────────────────────────────────
  const colorForCell = useCallback((index: number): string => {
    // `split` owns its palette outright: the tutor's lines NAME red and yellow,
    // so a generator-chosen colour here would make her mouth disagree with the
    // child's screen (tenFrameScript's SPLIT_COLOR_* docblock).
    if (currentItem?.kind === 'split' || currentItem?.kind === 'decompose_teen') {
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

        cells.push(
          <g key={cellIndex}>
            <rect
              ref={pip.ref(`cell-${cellIndex}`)}
              data-pip-object={`cell-${cellIndex}`}
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={CELL_RADIUS}
              ry={CELL_RADIUS}
              className="cursor-pointer transition-colors duration-150"
              fill={shouldShowCounter ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.5}
              onClick={() => { pip.look(`cell-${cellIndex}`); handleCellClick(cellIndex); }}
            />
            {shouldShowCounter && (
              <circle
                cx={x + CELL_SIZE / 2}
                cy={y + CELL_SIZE / 2}
                r={COUNTER_RADIUS}
                fill={COUNTER_COLORS[colorForCell(cellIndex)] || colorForCell(cellIndex)}
                className="transition-all duration-200"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                onClick={() => { pip.look(`cell-${cellIndex}`); handleCellClick(cellIndex); }}
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
      </g>
    );
  }, [filledCells, countersVisible, colorForCell, handleCellClick, pip]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  /** `build` runs never speak an answer and `subitize` runs never place one —
   *  only a mixed set earned the old "voice and hands" line. */
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
    const practice = runner.practiceSummary;
    return phaseResultsFromSummary(items, practice ?? runner.summary, (item) => {
      const config = CHALLENGE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' };
      return practice?.outcomes.find(o => o.id === item.id)?.assisted ? { ...config, label: `${config.label} (with help)` } : config;
    }).map((phase, index) => {
      const outcome = practice?.outcomes.find(o => o.id === items[index].id);
      return outcome ? { ...phase, attempts: outcome.attempts, firstTry: outcome.solved && outcome.attempts === 1 } : phase;
    });
  }, [showSummary, runner.summary, runner.practiceSummary, items]);

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
  /** Is the item ON SCREEN closed? The runner's `stage` cannot answer this — it
   *  stays 'affirmed' across the advance — so everything that means "this item
   *  is finished" reads the solved ledger instead. */
  const currentSolved = runner.currentSolved;
  // The running count is the child's own trace of what they placed (R3/R7,
  // tier-governed) — but on add/subtract it EQUALS the number they are about to
  // say, so it is withdrawn there.
  // `split` is deliberately absent: the honest readout there would be the two
  // PARTS, which is the answer, and the total is already both on screen and in
  // the ask. There is nothing left for a count readout to add.
  // `build_teen` joins them: its readout is the total on the frames, which the
  // ask already states aloud — the child's own trace toward a public target.
  // `decompose_teen` is deliberately absent for `split`'s reason — the honest
  // readout there would be the yellow count, which IS what is being asked for.
  const showTrace = showCount && countersVisible
    && (kind === 'build' || kind === 'make_ten' || kind === 'build_teen')
    && filledCells.size > 0;

  const stageWord = runner.stage === 'judging'
    ? 'let’s see…'
    : currentSolved
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
          <LuminaBadge accent="cyan" className="text-xs">
            {kind === 'split'
              ? 'Make two groups'
              : kind === 'decompose_teen'
                ? 'Find the ten'
                : isGestureItem ? 'Use the frame' : 'Say it out loud'}
          </LuminaBadge>
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

            <div className="flex justify-center">
              <svg
                ref={pip.ref('frame')}
                data-pip-object="frame"
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="max-w-full h-auto"
              >
                {Array.from({ length: frameCount }, (_, i) => renderFrame(i))}
              </svg>
            </div>

            {pipStore && <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
              className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}

            {/* The child's own placement trace. Never an empty-space readout —
                on a make-ten item that number IS the answer (R5). */}
            {showTrace && (
              <div className="flex items-center justify-center text-sm">
                <span className="text-slate-300">
                  Counters: <span className="text-orange-300 font-bold text-lg">{filledCells.size}</span>
                </span>
              </div>
            )}

            {/* The FACT, for readers — the same thing the tutor says aloud. It
                is the question side; the answer stays off the screen. */}
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

            {/* Subitize flash prompt + re-show. "Show again" re-shows the
                STIMULUS and is never withdrawn; the tutor's matching
                tap-to-hear re-asks the QUESTION and never narrates the count. */}
            {isSubitize && (
              <div className="flex flex-col items-center gap-2">
                {!flashAnswerReady && (
                  <span className="text-orange-300 text-sm font-medium">
                    👀 {isFlashing ? 'Look quick!' : 'Get ready to look…'}
                  </span>
                )}
                {/* Workspace: the first look is the learner's to start as well as the tutor's
                    (`present`), so an item never waits on a tool call to become answerable. */}
                {runner.presentStimulus && !flashAnswerReady && !isFlashing && runner.canAttempt && (
                  <LuminaButton tone="primary" className="text-sm" onClick={() => runner.presentStimulus?.()}>
                    Show me
                  </LuminaButton>
                )}
                {flashAnswerReady && runner.running && !currentSolved && (
                  <LuminaButton
                    tone="subtle"
                    className="text-xs"
                    onClick={() => {
                      // Counted via hearStimulus → summary.hearTaps (the
                      // contract's successor to the old reflash penalty).
                      // Direct, not gated: the CHILD asked for this one, so it
                      // is not waiting on anybody's voice.
                      reshowsRef.current += 1;
                      // Workspace: a repeat through the shared lifecycle records assistance.
                      if (runner.presentStimulus) { runner.presentStimulus(); return; }
                      runner.hearStimulus?.();
                      if (currentItem) presentFlash(currentItem);
                    }}
                  >
                    Show again
                  </LuminaButton>
                )}
              </div>
            )}

            {/* The reward — the first moment a number may appear on screen, and
                it HOLDS for the length of her affirmation (18b). Gated on
                `revealHeld`, never on `currentSolved`: the runner opens the next
                item in the same dispatch, so by the time this renders the
                current item is the NEXT one and is not solved. */}
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
                {kind === 'split' || kind === 'decompose_teen'
                  ? 'Tap a counter to turn it yellow — the tutor checks when you stop.'
                  : isGestureItem
                    ? 'Tap the frame to place your counters — the tutor checks when you stop.'
                    : 'Work it out on the frame, then say your answer out loud.'}
              </p>
            )}

            {/* "I’m listening" over an item whose answer is a placement is a lie
                in the UI (add-di-loop step 3) — the hands items hold the
                bracket, so the orb says what the turn actually is. */}
            <JudgedMicPanel run={runner} gestureLabel="Show me on the frame" />
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
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

// The workspace path never mounts the runner, whose context push and cue loop would run beside the tutor.
const TenFrame = withWorkspaceController<TenFrameProps, TenFrameControllerOptions, LiveRun<TenFrameItem>>(
  'ten-frame', TenFrameSurface, useScriptedController, useWorkspaceController);

export default TenFrame;
