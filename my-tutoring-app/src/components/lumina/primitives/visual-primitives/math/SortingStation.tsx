'use client';

/**
 * SortingStation — the JUDGED-LOOP stage (seventh math DI port, qa/di/BACKLOG.md
 * item 18). The tutor asks, the child answers OUT LOUD, the tutor's verdict
 * moves the lesson, and this file only follows.
 *
 * ── WHAT THIS REWRITE DELETED, AND WHY ─────────────────────────────────────
 *
 * Everything the child used to touch. The drag/tap-to-bin placement, the Check
 * Sort / Check Counts / Check Tallies buttons, the attribute-choice buttons, the
 * number steppers, the odd-one-out tap, the ≥2-attempt hint ladder and the
 * feedback prose that named the answer. `sortingStationScript.ts`'s docblock
 * carries the costume argument; the short form is that a child who cannot
 * categorise at all could still drag until the Check button went green.
 *
 * ⚠️ R7 IS RE-BASED HERE, NOT IGNORED. The contract pins the Check button:
 * "Sort-family challenges are multi-part construction and keep the explicit
 * Check even at K — decluttering must not remove the commit-your-work step."
 * What R7 protects is the COMMIT STEP for multi-part construction. The judged
 * loop does not remove the commit; it removes the multi-part construction. One
 * object is now one atomic judged turn, and its commit is the child's spoken
 * answer plus the tutor's verdict. C3 in that contract warns that "the tempting
 * over-general edit is exactly what a future declutter pass would reach for" —
 * this is not that pass, because nothing here grades partial work.
 *
 * ⚠️ R4 IS PRESERVED VERBATIM IN SPIRIT — it was the live regression risk of a
 * whole-file rewrite. At Kindergarten the trays are still `bucketEmoji`-primary
 * (falling back to a colour-coded circle), the object cards are still enlarged
 * and emoji-primary, and adult chrome — progress dots, badges, description,
 * helper prose — is still hidden. `isPreReader` is the one gate and nothing
 * leaks across it.
 *
 * ── THE THREE RUNNER GATES, USED AS RULED ─────────────────────────────────
 *
 *  - interaction (such as it is — tap-to-hear) is gated on `runner.canAttempt`,
 *    NEVER on `runner.stage`, which goes to 'affirmed' and opens the next item
 *    in the same dispatch.
 *  - the reveal is gated on `runner.revealHeld`, never on `currentSolved` or
 *    `stage`, and is NOT cleared in `onItemOpened` (18b — that clear and the
 *    `onAffirmed` that set it land in one React batch, so the reveal would paint
 *    on the last item and nowhere else).
 *  - no timer effect depends on `runner`. There is no timed stimulus in this
 *    stage at all: every ask is a question about pictures that are already on
 *    screen, so there is nothing to flash and no `onPresentStimulus` to declare.
 *
 * ── THE PIXEL LEAK THIS PORT HAD TO CLOSE ─────────────────────────────────
 *
 * `showCounts` drew a live tally badge on every tray. Under a Check button that
 * was progress; the moment "how many are in the Need group?" became a spoken
 * ask it was the answer, printed, before the child said it (ten-frame's R6
 * lesson: hunt the leak in PIXELS, not only in strings). The badge is now gated
 * on `!item.hidesCounts`, and `count_group`/`compare` items set it true.
 *
 * The filed-object reveal is the same rule from the other side: an object moves
 * into its tray only once the tutor has AFFIRMED it, which is what that
 * animation always meant.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SortingStationMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
  type JudgedScriptRunnerOptions,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  itemsFromChallenges,
  type SortingStationItem,
  type SortingItemKind,
  sortingStationPackBase,
} from './sortingStationScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { sortingStationPipPose } from '../../../pip/sortingStationPipPose';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { useLiveAutoStart } from '../../../components/live-activity/runtime/useLiveAutoStart';
import { useSortingStationRuntime } from './useSortingStationRuntime';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type LiveRun, type WorkspaceRunOptions }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { workspaceAssignment, workspaceScene } from './sortingStationWorkspace';
import { CHECKS_LEVER, EXAMPLES_LEVER, FOCUS_LEVER, LINE_UP_LEVER, ODD_MODEL_LEVER, PICTURES_LEVER, SHOW_TRAYS_LEVER,
  SIMPLIFY_LEVERS, TAP_LEVER, TRY_EACH_LEVER, sortingLeverFacts, sortingLevers, sortingSimpler, trayExamples,
  type CreditedCard, type Easier } from './sortingStationLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SortingObject {
  id: string;
  label: string;
  emoji: string;
  attributes: Record<string, string>;
}

export interface SortingCategory {
  label: string;
  rule: Record<string, string>;
  /** Picture-primary tray icon for the pre-reader (K) render — a single emoji
   *  that stands for the whole group (e.g. Need → 🏠, Want → 🎁). Non-load-
   *  bearing: correctness is by `rule`, never by the icon. Missing → the K
   *  render falls back to a colour-coded circle (R4). */
  bucketEmoji?: string;
}

export interface SortingStationChallenge {
  id: string;
  type: 'sort-by-one' | 'sort-by-attribute' | 'count-and-compare' | 'two-attributes' | 'odd-one-out' | 'tally-record' | 'sort-variety';
  instruction: string;
  objects: SortingObject[];
  sortingAttribute?: string;
  categories?: SortingCategory[];
  oddOneOut?: string;
  oddOneOutReason?: string;
  comparisonQuestion?: string;
  correctComparison?: 'more' | 'fewer' | 'equal';
  /** two-attributes: the compound criteria, now asked one object at a time as a
   *  spoken yes/no rather than read as one written instruction (contract G2 —
   *  "what exceeds a pre-reader is the medium, not the cognition"). */
  targetCategory?: string;
  secondaryAttribute?: string;
  secondaryValue?: string;
  /**
   * Easy-tier worked example: ONE object pre-placed in its correct tray as a
   * model, EXCLUDED from the judged set (`askableObjectsOf` in the script) but
   * still on the page and still inside every count. A teacher really does lay
   * one card in a tray and say "this one goes here, see?" — honest page-work and
   * a real DISTAR fade, so it survives the port. What it may never be is the
   * question: its answer is already on screen.
   */
  modelItemId?: string;
  /** Tray index the model item is pre-placed into (its correct category). */
  modelItemBin?: number;
  /** Support-tier render levers. `namesSortCriterion: false` is the `hard`
   *  rung — the ask stops naming the groups aloud (readers only; the K band
   *  floor beats it). */
  showBucketEmojis?: boolean;
  namesSortCriterion?: boolean;
}

export interface SortingStationData {
  title: string;
  description?: string;
  challenges: SortingStationChallenge[];
  maxCategories: number;
  /** Easy-tier self-check aid: per-tray count badges. It SURVIVES the port as a
   *  render lever, but it is overridden per item — on a `count_group` or
   *  `compare` ask the badge IS the answer, so `item.hidesCounts` wins until the
   *  tutor has affirmed. */
  showCounts: boolean;
  showTallyChart: boolean;
  gradeBand: 'K' | '1';
  /** Within-mode support tier ('easy' = max scaffolding). Drives how rich the
   *  spoken INTRODUCTION is and whether the ask names the groups. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SortingStationMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<SortingItemKind, { label: string; icon: string }> = {
  sort:          { label: 'Sort It',       icon: '🎨' },
  pick_rule:     { label: 'Pick the Rule', icon: '🔍' },
  odd_one:       { label: 'Odd One Out',   icon: '🤔' },
  count_group:   { label: 'Count It',      icon: '🔢' },
  compare:       { label: 'Compare',       icon: '📊' },
  both_criteria: { label: 'Both Things',   icon: '🔗' },
};

const BIN_COLORS = [
  { bg: 'bg-red-500/10', border: 'border-red-400/30', text: 'text-red-300' },
  { bg: 'bg-blue-500/10', border: 'border-blue-400/30', text: 'text-blue-300' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-400/30', text: 'text-emerald-300' },
  { bg: 'bg-amber-500/10', border: 'border-amber-400/30', text: 'text-amber-300' },
];

/** Guaranteed picture-primary tray icon for the pre-reader render when the
 *  generator supplied no `bucketEmoji` — colour-coded, aligned to BIN_COLORS
 *  order. Ensures K trays are NEVER text-only (R4). */
const FALLBACK_BIN_EMOJI = ['🔴', '🔵', '🟢', '🟡'];

// ============================================================================
// Component
// ============================================================================

interface SortingStationProps {
  data: SortingStationData;
  className?: string;
  /** The live host opts in only after its correlated mount handoff. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

/** The scripted runner's options beside the workspace controller's (compare-objects' shape). */
type SortingStationControllerOptions = Omit<WorkspaceRunOptions<SortingStationItem>, 'primitiveId' | 'assignment' | 'onFinished'>
  & { /** The scripted path's runtime registration only (it goes with that path); the workspace reads the lesson's pin. */
    scriptedEvalMode: string }
  & Omit<JudgedScriptRunnerOptions<SortingStationItem>, 'pack' | 'instanceId' | 'onItemOpened' | 'onFinished'>
  & { pack?: JudgedScriptPack<SortingStationItem>; onFinished: (summary: SortingFinish) => void };

/** What the metrics read, from either controller's finished record. */
type SortingFinish = Pick<JudgedRunSummary, 'outcomes' | 'accuracy' | 'attemptsCount' | 'diagnosisEvidence' | 'solvedCount' | 'learningResponses'>
  & { teachingAttempts?: unknown; assistanceProvenance?: string };

function useScriptedController(options: SortingStationControllerOptions): LiveRun<SortingStationItem> {
  const runner = useJudgedScriptRunner<SortingStationItem>({ ...options, pack: options.pack! });
  // The SESSION's mode, never `runner.currentItem`: a mount's identity must not change while the runner owns it.
  useSortingStationRuntime({ runner, instanceId: options.instanceId, objectiveId: options.objectiveId,
    planItemId: options.planItemId, evalMode: options.scriptedEvalMode });
  return runner;
}

const useWorkspaceController = (options: SortingStationControllerOptions): LiveRun<SortingStationItem> =>
  useWorkspaceRunner<SortingStationItem>({ ...options, primitiveId: 'sorting-station', assignment: workspaceAssignment });

const SortingStationSurface = ({ data, className, autoStart = false, runtimePlanItemId, runtimeEvalMode, tutorOwned, useController }:
  SortingStationProps & { tutorOwned: boolean; useController: (options: SortingStationControllerOptions) => LiveRun<SortingStationItem> }) => {
  const liveRuntime = useLiveRuntime();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    showCounts = true,
    gradeBand = 'K',
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Pre-reader (Kindergarten) presentation gate (R4). At K the student cannot
  // read tray labels, counters or helper prose — the render goes picture-primary
  // and adult chrome is hidden. Grade 1 keeps the full chrome. Nothing leaks.
  const isPreReader = gradeBand === 'K';

  // ── Stage-payload state (the runner owns progression; this is the page) ───
  /** Objects the tutor has AFFIRMED into a tray, id → group label. Progress,
   *  never a hint: an object files only after its verdict. */
  const [filed, setFiled] = useState<Record<string, string>>({});
  /** Post-answer only (answer-leak rule). NOT cleared when the next item opens:
   *  that clear and the `onAffirmed` that set it land in one React batch, so the
   *  reveal would paint on the last item and nowhere else (18b).
   *  `runner.revealHeld` is the gate. */
  const [reward, setReward] = useState<string | null>(null);
  // In-item levers (`sortingStationLevers.ts`), keyed by the session item they were pulled on; the easier item a
  // simplify lever put on screen in its place (with its own page); the learner's taps on the tap_marks pictures and the
  // check_boxes, keyed by the item on screen.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<Easier | null>(null);
  const [marks, setMarks] = useState<{ item: string; ids: string[] }>({ item: '', ids: [] });
  const [checks, setChecks] = useState<{ item: string; values: Record<string, 'yes' | 'no'> }>({ item: '', values: {} });

  const stableInstanceIdRef = useRef(
    instanceId || `sorting-station-${Math.round(performance.now())}`,
  );
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const evaluation = usePrimitiveEvaluation<SortingStationMetrics>({
    primitiveType: 'sorting-station',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── The pack: generated challenges → judged items + hand-authored script ──
  // Unaskable challenges are DROPPED, never repaired (labels the judge cannot
  // separate by ear, an object that IS a tray label, an empty group whose count
  // would be zero, a yes/no set with only one verdict reachable). Nothing is
  // backfilled — a placeholder in a judged loop becomes a spoken ask the tutor
  // has to stand behind.
  const items = useMemo(
    () => itemsFromChallenges(challenges, { tier: supportTier, isPreReader }),
    [challenges, supportTier, isPreReader],
  );

  /** The generated challenge behind an item — the page's own data (the full
   *  object set, the tray pictures), which the judged item deliberately does not
   *  carry in full. */
  const challengeById = useMemo(() => {
    const map = new Map<string, SortingStationChallenge>();
    for (const ch of challenges) map.set(ch.id, ch);
    return map;
  }, [challenges]);

  const pack = useMemo<JudgedScriptPack<SortingStationItem> | undefined>(() => tutorOwned ? undefined : ({
    ...sortingStationPackBase(items),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: () => 'Listen, then say your answer out loud.',
      retry: () => 'Have another go — say your answer.',
      done: 'Great sorting today!',
    },
    // One factual record per attempt, right or corrected: the card or group asked about and what was heard.
    // Never the verdict, because the same text is kept for right answers.
    observation: (item, { heard: transcript }) => {
      const heard = transcript ? `Heard "${transcript}".` : 'No transcript was captured.';
      switch (item.kind) {
        case 'sort':
          return {
            challenge: `sort: which group ${item.stimulus} belongs with (sorting by ${item.ruleName ?? 'the rule'}; groups: ${item.choices.join(', ')}).`,
            expected: item.answer,
            observed: heard,
          };
        case 'pick_rule':
          return {
            challenge: `pick_rule: which way to sort the ${item.stimulus} on screen (options: ${item.choices.join(', ')}).`,
            expected: item.answer,
            observed: heard,
          };
        case 'odd_one':
          return {
            challenge: `odd_one: which of ${item.choices.join(', ')} does not belong.`,
            expected: item.answer,
            observed: heard,
          };
        case 'count_group':
          return {
            challenge: `count_group: how many objects are in the ${item.stimulus} group.`,
            expected: `${item.answer} (${item.answerValue})`,
            observed: heard,
          };
        case 'compare':
          return {
            challenge: `compare: which of ${item.stimulus} has more.`,
            expected: item.answer,
            observed: heard,
          };
        case 'both_criteria':
        default:
          return {
            challenge: `both_criteria: is ${item.stimulus} both a ${item.criteria?.primary} and ${item.criteria?.secondary}.`,
            expected: item.answer,
            observed: heard,
          };
      }
    },
  }), [items, tutorOwned]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback((summary: SortingFinish) => {
    const metrics: SortingStationMetrics = {
      type: 'sorting-station',
      sortingAccuracy: summary.accuracy,
      categoriesUsed: new Set(
        items.flatMap((i) => (i.kind === 'sort' ? i.choices : [])),
      ).size,
      attemptsCount: summary.attemptsCount,
    };

    evaluation.submitResult(
      summary.solvedCount === items.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useController({
    items, workspace, objectiveId, planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount, never `runner.currentItem`: a mount's
    // identity must not change while the runner owns it.
    scriptedEvalMode: runtimeEvalMode || items[0]?.mode || 'default',
    // Load-bearing for the live host: without it the runner's `resume()` early-returns,
    // its speech holds never settle, and the completion handoff has nothing to read.
    runtime: liveRuntime,
    ...(!tutorOwned && runtimePlanItemId ? { completionCue: '[SS_COMPLETE] Say exactly: "You finished this activity. Nice work!" Then wait silently for the lesson host.' } : {}),
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    exhibitId,
    onFinished: handleFinished,
    // A fresh item never carries an easier item over from the last one.
    onItemOpened: () => { setPractice(null); },
    onAffirmed: (item) => {
      // The first moment an answer may appear on screen.
      switch (item.kind) {
        case 'sort':
          setFiled((prev) => ({ ...prev, [item.id]: item.answer }));
          setReward(item.answer);
          break;
        case 'count_group':
          setReward(String(item.answerValue ?? item.answer));
          break;
        case 'both_criteria':
          setReward(item.answer === 'yes' ? 'Yes — both!' : 'No — not both');
          break;
        default:
          setReward(item.answer);
      }
    },
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentItem = practice?.item ?? sessionItem;
  // The workspace path shows its summary without an evaluation provider (the live host has none).
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;
  const sessionChallenge = sessionItem ? challengeById.get(sessionItem.challengeId) ?? null : null;
  const currentChallenge = (practice?.challenge as SortingStationChallenge | undefined)
    ?? (currentItem ? challengeById.get(currentItem.challengeId) ?? null : null);
  const pulledLevers = !practice && leverState.item === sessionItem?.id ? leverState.pulled : [];
  const pulled = (id: string) => pulledLevers.includes(id);
  const markedIds = marks.item === currentItem?.id ? marks.ids : [];
  const checkValues = checks.item === currentItem?.id ? checks.values : {};
  /** Every card credited on a sort so far, for `tray_examples`. */
  const credited = useMemo<CreditedCard[]>(() => Object.entries(filed).flatMap(([key, group]) => {
    const [challengeId, objectId] = key.split('::');
    const ch = challengeById.get(challengeId), obj = ch?.objects.find(o => o.id === objectId);
    return ch && obj && ch.sortingAttribute ? [{ challengeId, label: obj.label, emoji: obj.emoji, group, rule: ch.sortingAttribute }] : [];
  }), [filed, challengeById]);
  const leverContext = { challenge: sessionChallenge, preReader: isPreReader, credited };
  const examples = pulled(EXAMPLES_LEVER) ? trayExamples(sessionItem, leverContext) : new Map<string, CreditedCard>();
  const showTraysPulled = pulled(SHOW_TRAYS_LEVER);

  // ── The page: what is on the table for this item ─────────────────────────

  /** Every object of the current challenge, in generated order. The bank stays
   *  WHOLE for the whole challenge — no elimination — so the last ask is as
   *  hard as the first (word-sorter's elimination-leak lesson). */
  const boardObjects = currentChallenge?.objects ?? [];

  const trays = useMemo(() => {
    if (!currentItem || !currentChallenge) return [];
    if (currentItem.kind === 'sort') {
      return (currentChallenge.categories ?? []).filter((c) =>
        currentItem.choices.some((l) => l.toLowerCase() === c.label.toLowerCase()),
      );
    }
    // show_trays: the empty trays under the cards on a pick-the-rule ask.
    if (currentItem.kind === 'count_group' || currentItem.kind === 'compare'
      || (currentItem.kind === 'pick_rule' && showTraysPulled)) {
      return currentChallenge.categories ?? [];
    }
    return [];
  }, [currentItem, currentChallenge, showTraysPulled]);

  /** Which objects belong to a tray, for the count/compare board and for the
   *  filed reveal on a sort. */
  const objectsInTray = useCallback((label: string) => {
    const attr = currentItem?.ruleName;
    if (!attr) return [];
    return boardObjects.filter(
      (o) => (o.attributes?.[attr] ?? '').toLowerCase() === label.toLowerCase(),
    );
  }, [boardObjects, currentItem]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!showSummary) return [];
    const practice = runner.practiceSummary;
    return phaseResultsFromSummary(items, practice ?? runner.summary, (item) => {
      const config = PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🎨' };
      return practice?.outcomes.find(o => o.id === item.id)?.assisted ? { ...config, label: `${config.label} (with help)` } : config;
    }).map((phase, index) => {
      const outcome = practice?.outcomes.find(o => o.id === items[index].id);
      return outcome ? { ...phase, attempts: outcome.attempts, firstTry: outcome.solved && outcome.attempts === 1 } : phase;
    });
  }, [showSummary, runner.summary, runner.practiceSummary, items]);

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of the runner's phase onto what the ask names; Pip never
  // answers, files a card, or advances.
  const pip = usePipTargets(currentItem?.id ?? null, false);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentItem || showSummary) return null;
    const targets = pip.targets(undefined, (id) => (id.startsWith('tray-') ? id.slice('tray-'.length) : id));
    const pose = sortingStationPipPose({
      running: runner.running, preparing: runner.preparing,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      judging: runner.stage === 'judging', tutorSpeaking: runner.tutorSpeaking,
      cueMatchesItem: runner.cuedItemId === currentItem.id,
      kind: currentItem.kind,
      namedTrayId: currentItem.kind === 'count_group' ? `tray-${currentItem.stimulus.toLowerCase()}` : undefined,
      visibleIds: targets.map((target) => target.id),
    });
    return { instanceId: resolvedInstanceId, scopeId: currentItem.id, label: 'Sorting station', dock: pip.dock.current, targets, pose };
  });

  // ============================================================================
  // Render
  // ============================================================================

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentItem) return;
    const scene = workspaceScene(currentItem);
    const onScreen = sortingLeverFacts(currentItem, pulledLevers);
    // No lever on an easier item: it is practice, and the full item's levers come back with it.
    const levers = practice ? [] : sortingLevers(sessionItem, pulledLevers, leverContext);
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionItem || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if ((SIMPLIFY_LEVERS as readonly string[]).includes(id)) {
          const easier = sortingSimpler(id, sessionItem, sessionChallenge);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState(next);
          setPractice(easier);
          return { practice: workspaceAssignment(easier.item) };
        }
        setLeverState(next);
        return true;
      },
      endPractice: () => { setPractice(null); },
    };
  });
  // AFTER the runtime mount is registered, never before: `start()` waits for
  // `grantOwnership('runner')`, which cannot be granted until this primitive's
  // mount exists. Declared earlier, its effect runs first and the runner spins.
  useLiveAutoStart(autoStart, resolvedInstanceId, runner.start);

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No sorting challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const stageWord = runner.stage === 'judging'
    ? 'let’s see…'
    : runner.currentSolved
      ? 'yes!'
      : runner.running
        ? 'say it out loud'
        : 'get ready';

  /** The card the ask is ABOUT. Enlarged and centred so a pre-reader knows what
   *  the tutor just named without reading anything. */
  const focusObject = currentItem && (currentItem.kind === 'sort' || currentItem.kind === 'both_criteria')
    ? boardObjects.find((o) => currentItem.id.endsWith(`::${o.id}`)) ?? null
    : null;

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Mode badges are adult chrome — hidden for pre-readers (R4). */}
            {!isPreReader && currentItem && (
              <div className="flex items-center gap-2">
                <LuminaBadge accent="emerald" className="text-xs">
                  {PHASE_TYPE_CONFIG[currentItem.kind]?.icon} {PHASE_TYPE_CONFIG[currentItem.kind]?.label}
                </LuminaBadge>
                {currentItem.ruleName && currentItem.kind !== 'pick_rule' && (
                  <LuminaBadge accent="purple" className="text-xs capitalize">
                    by {currentItem.ruleName}
                  </LuminaBadge>
                )}
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Say it out loud</LuminaBadge>
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

            {/* ── The focus card: what the tutor just named ─────────────── */}
            {focusObject && (
              <div className="flex justify-center">
                <LuminaPanel ref={pip.ref('focus')} data-pip-object="focus" className="px-8 py-5 flex flex-col items-center gap-2">
                  <span className={isPreReader ? 'text-7xl' : 'text-5xl'}>{focusObject.emoji}</span>
                  {/* The label is a caption, never the gate — the tutor said it. */}
                  <span className={`text-slate-300 ${isPreReader ? 'text-base' : 'text-sm'}`}>
                    {focusObject.label}
                  </span>
                </LuminaPanel>
              </div>
            )}

            {/* Pip's dock sits between the named card and the answer surfaces, so a
                pointer to the card never crosses a tray or card on its way. */}
            {pipStore && <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
              className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}

            {/* ── The row of cards: odd-one-out and pick-the-rule look at all
                   of them at once. No card is tappable — the answer is said. */}
            {(currentItem.kind === 'odd_one' || currentItem.kind === 'pick_rule') && (
              <div ref={pip.ref('cards')} data-pip-object="cards" className={`flex flex-wrap justify-center ${isPreReader ? 'gap-4' : 'gap-3'}`}>
                {boardObjects.map((obj) => {
                  const isAnswer = runner.revealHeld
                    && currentItem.kind === 'odd_one'
                    && obj.label.toLowerCase() === currentItem.answer.toLowerCase();
                  return (
                    <div
                      key={obj.id}
                      className={`flex flex-col items-center gap-1 rounded-2xl border transition-all duration-200 ${
                        isPreReader ? 'px-6 py-5 min-w-[128px]' : 'px-3 py-2'
                      } ${
                        isAnswer
                          ? 'bg-emerald-500/20 border-emerald-400 scale-110'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <span className={isPreReader ? 'text-6xl' : 'text-3xl'}>{obj.emoji}</span>
                      <span className={`leading-tight text-center break-words ${
                        isPreReader ? 'text-sm text-slate-300 max-w-[120px]' : 'text-[11px] text-slate-400 max-w-[80px]'
                      }`}>
                        {obj.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* odd_model lever: a fixed model row beside the cards, never the cards themselves. */}
            {currentItem.kind === 'odd_one' && pulled(ODD_MODEL_LEVER) && (
              <div data-lever="odd-model" className="flex items-center justify-center gap-3 py-2" aria-label="a model row">
                {['circle', 'circle', 'circle', 'square'].map((shape, i) => (
                  <span key={i} data-model-shape={shape}
                    className={shape === 'circle' ? 'h-8 w-8 rounded-full bg-blue-400/80' : 'h-8 w-8 rounded-md bg-red-400/80'} />
                ))}
              </div>
            )}

            {/* ── The trays. R4: at K a tray is a PICTURE with the word as a
                   small caption; the word never gates, the tutor names each one. */}
            {trays.length > 0 && (
              <div ref={pip.ref('trays')} data-pip-object="trays" className={`grid ${isPreReader ? 'gap-5 max-w-[840px] mx-auto' : 'gap-3'} ${
                trays.length <= 2 ? 'grid-cols-2' : trays.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
              }`}>
                {trays.map((cat, idx) => {
                  const color = BIN_COLORS[idx % BIN_COLORS.length];
                  // A sort tray shows what the tutor has AFFIRMED into it, PLUS
                  // the easy-tier worked example, which was pre-placed before
                  // the run began and is never asked about.
                  const modelHere = currentChallenge?.modelItemId
                    && currentChallenge.modelItemBin === idx
                    ? boardObjects.filter((o) => o.id === currentChallenge.modelItemId)
                    : [];
                  const inTray = currentItem.kind === 'sort'
                    ? [
                        ...modelHere,
                        ...boardObjects.filter(
                          (o) => filed[`${currentItem.challengeId}::${o.id}`] === cat.label,
                        ),
                      ]
                    // show_trays on a pick-the-rule ask: the trays stay EMPTY (filled, they are the next asks' answers).
                    : currentItem.kind === 'pick_rule' ? [] : objectsInTray(cat.label);
                  const isRevealedTray = runner.revealHeld
                    && currentItem.kind === 'sort'
                    && cat.label.toLowerCase() === currentItem.answer.toLowerCase();
                  const example = currentItem.kind === 'sort' ? examples.get(cat.label.toLowerCase()) : undefined;
                  // focus_tray: every tray but the counted one dims. tap_marks: the counted tray's pictures take a ring.
                  const counted = currentItem.kind === 'count_group' && cat.label.toLowerCase() === currentItem.stimulus.toLowerCase();
                  const dimmed = currentItem.kind === 'count_group' && pulled(FOCUS_LEVER) && !counted;
                  const tappable = counted && pulled(TAP_LEVER);
                  return (
                    <LuminaPanel
                      key={cat.label}
                      ref={pip.ref(`tray-${cat.label.toLowerCase()}`)}
                      data-pip-object={`tray-${cat.label.toLowerCase()}`}
                      data-dimmed={dimmed ? 'true' : undefined}
                      className={`transition-all duration-200 ${color.bg} ${
                        isRevealedTray ? 'ring-2 ring-emerald-400 scale-105' : ''
                      } ${dimmed ? 'opacity-25' : ''} ${isPreReader ? 'min-h-[168px] p-3' : 'min-h-[100px] p-2'}`}
                    >
                      {/* try_each lever: the card's picture with a question mark on EVERY tray; no tray is marked. */}
                      {currentItem.kind === 'sort' && pulled(TRY_EACH_LEVER) && focusObject && (
                        <div data-lever="try-each" className="mb-1 flex items-center justify-center gap-1 opacity-70">
                          <span className="text-2xl">{focusObject.emoji || focusObject.label}</span><span className="text-lg">❓</span>
                        </div>
                      )}
                      {isPreReader ? (
                        <div className="flex flex-col items-center gap-1 mb-2">
                          <span className="text-5xl leading-none" aria-hidden>
                            {cat.bucketEmoji || FALLBACK_BIN_EMOJI[idx % FALLBACK_BIN_EMOJI.length]}
                          </span>
                          <span className={`text-sm font-semibold ${color.text}`}>{cat.label}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${color.text}`}>
                            {/* tray_pictures lever (readers; the pre-reader render always shows it), and show_trays. */}
                            {((currentItem.kind === 'sort' && pulled(PICTURES_LEVER)) || currentItem.kind === 'pick_rule') && cat.bucketEmoji && (
                              <span data-lever="tray-picture" className="mr-1 text-xl">{cat.bucketEmoji}</span>
                            )}
                            {cat.label}
                          </span>
                          {/* ⭐ The count badge is the ANSWER on a count ask. The
                              easy-tier lever turns it on; `hidesCounts` overrides
                              that until the tutor has affirmed the number. */}
                          {showCounts && currentItem.kind !== 'pick_rule' && (!currentItem.hidesCounts || runner.revealHeld) && (
                            <LuminaBadge accent="cyan" className="text-xs">{inTray.length}</LuminaBadge>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap justify-center gap-2">
                        {inTray.map((obj) => tappable ? (
                          <button key={obj.id} type="button" data-tap-mark={obj.id}
                            data-ringed={markedIds.includes(obj.id) ? 'true' : 'false'}
                            onClick={() => setMarks(prev => {
                              const ids = prev.item === currentItem.id ? prev.ids : [];
                              return { item: currentItem.id, ids: ids.includes(obj.id) ? ids.filter(i => i !== obj.id) : [...ids, obj.id] };
                            })}
                            className={`flex flex-col items-center gap-0.5 rounded-full p-1 ${
                              markedIds.includes(obj.id) ? 'ring-2 ring-amber-300' : ''}`}>
                            <span className={isPreReader ? 'text-4xl' : 'text-xl'}>{obj.emoji}</span>
                          </button>
                        ) : (
                          <div key={obj.id} className="flex flex-col items-center gap-0.5">
                            <span className={isPreReader ? 'text-4xl' : 'text-xl'}>{obj.emoji}</span>
                          </div>
                        ))}
                        {/* tray_examples lever: a card credited in an earlier round, on the tray it went to. */}
                        {example && (
                          <div data-lever="tray-example" className="flex flex-col items-center gap-0.5 opacity-60">
                            <span className={isPreReader ? 'text-4xl' : 'text-xl'}>{example.emoji}</span>
                          </div>
                        )}
                      </div>
                    </LuminaPanel>
                  );
                })}
              </div>
            )}

            {/* line_up lever: each group's pictures in a row, one per column, from the same left edge. No numbers. */}
            {currentItem.kind === 'compare' && pulled(LINE_UP_LEVER) && (
              <div data-lever="line-up" className="mx-auto flex w-fit flex-col gap-2 rounded-2xl border border-white/10 p-3">
                {trays.map((cat, idx) => (
                  <div key={cat.label} data-line-row={cat.label.toLowerCase()} className="flex items-center gap-2">
                    <span className="w-10 text-center text-2xl">{cat.bucketEmoji || FALLBACK_BIN_EMOJI[idx % FALLBACK_BIN_EMOJI.length]}</span>
                    {objectsInTray(cat.label).map((obj) => (
                      <span key={obj.id} data-line-cell className="w-10 text-center text-3xl">{obj.emoji}</span>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* ── two-attributes: the two criteria as picture-free word cues.
                   The question is spoken; these only anchor what "both" means.
                   check_boxes lever: an empty box beside each; only the learner's taps fill it. */}
            {currentItem.kind === 'both_criteria' && currentItem.criteria && (
              <div className="flex justify-center gap-3">
                {(['primary', 'secondary'] as const).map((part, i) => (
                  <React.Fragment key={part}>
                    {i === 1 && <span className="text-slate-500 self-center text-sm">and</span>}
                    <LuminaBadge accent={part === 'primary' ? 'purple' : 'cyan'} className="text-sm capitalize">
                      {currentItem.criteria![part]}
                    </LuminaBadge>
                    {pulled(CHECKS_LEVER) && (
                      <button type="button" data-lever="check-box" data-check={part} data-value={checkValues[part] ?? ''}
                        aria-label={`mark ${currentItem.criteria![part]}`}
                        onClick={() => setChecks(prev => {
                          const values = prev.item === currentItem.id ? prev.values : {};
                          const now = values[part], nextValue = now === undefined ? 'yes' : now === 'yes' ? 'no' : undefined;
                          const { [part]: _drop, ...rest } = values;
                          return { item: currentItem.id, values: nextValue ? { ...rest, [part]: nextValue } : rest };
                        })}
                        className="h-9 w-9 self-center rounded-lg border-2 border-white/40 text-xl leading-none">
                        {checkValues[part] === 'yes' ? '✓' : checkValues[part] === 'no' ? '✗' : ''}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* The reward — the first moment an answer may appear.
                Gated on `revealHeld`, never on `currentSolved` (18b). */}
            {reward && runner.revealHeld && (
              <LuminaPanel className="p-3 text-center">
                <span className="text-emerald-300 text-lg font-black animate-bounce inline-block">
                  {reward}
                </span>
              </LuminaPanel>
            )}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">
              {stageWord}
            </div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                Listen to the question, then say your answer out loud.
              </p>
            )}

            <JudgedMicPanel run={runner} />
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Sorting Complete!"
            celebrationMessage="You said every answer out loud!"
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the runner, whose context push and cue loop would run beside the tutor.
const SortingStation = withWorkspaceController<SortingStationProps, SortingStationControllerOptions, LiveRun<SortingStationItem>>(
  'sorting-station', SortingStationSurface, useScriptedController, useWorkspaceController);

export default SortingStation;
