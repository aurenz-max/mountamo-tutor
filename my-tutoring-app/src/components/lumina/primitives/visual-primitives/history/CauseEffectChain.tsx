'use client';

/**
 * CauseEffectChain — runs only on the shared tutor/JEV teaching workspace (workspace
 * rollout C8; the scripted runner was retired, LA-14, user ruling 09-23: one path).
 * The observer judges each spoken answer, the activity checks the built chain, and the
 * runtime owns progression. There is no Next or Check button, no mic panel, and no
 * answer on screen before credit. An unbound mount shows the shared "needs the tutor"
 * card; the adapter refuses a lesson with no askable chain.
 *
 * ⭐ THE ANSWER-MATERIAL FORK (`causeEffectChainScript.ts`, standing gate 1):
 *   identify_cause     SPOKEN — one yes/no per card      the child SAYS it
 *   build_chain        HANDS  — the cards placed in order the arrangement IS the answer
 *   root_vs_proximate  SPOKEN — which card                the child SAYS it
 * The click era answered all three by tapping chips and pressing Check, and the
 * costume test cleared two of the three in one pass: a child who cannot reason
 * about causation can still tap a chip. The third — ordering the cards — is
 * the one action a child at a table would do ON THE PAGE, so the page stays.
 *
 * WHAT THE JUDGED SURFACE DELETES, and why each was the answer rather than chrome:
 *  - the PICK CHIPS on identify_cause and root_vs_proximate — a menu with a tap
 *    on it; the cards survive as the page (root) or the stimulus (identify),
 *    the TAP is what goes.
 *  - the CHECK button per rung and the two-strikes REVEAL ladder — the tutor's
 *    verdict is the check, its correction is the second try, and a chain
 *    commits on STILLNESS once every slot is filled.
 *  - the NEXT button — the runtime owns progression.
 *  - the HINT DISCLOSURE — a hint the child dispenses to themselves is not a
 *    scaffold a tier can withdraw.
 *  - the EXPLANATION under the feedback card — it names the answer, so it is a
 *    reveal, and reveals ride `runner.revealHeld` (18b).
 *  - tap-to-hear the question: with the tutor present, the learner asks it to repeat.
 *
 * WHAT IT KEEPS, deliberately: the BACKGROUND panel with its read-aloud (a silent
 * host request for the paragraph, the pre-reader's channel to the setting —
 * question-side by construction, it never states what caused what), the CHAIN
 * BOARD (the page a build_chain child works on), and two L3 render levers:
 * `showSlotNumbers` on the board and `showCategoryLabels` on every card (the ICON
 * stays at every tier — it is the emerging reader's channel).
 *
 * HOW A HANDS TURN CLOSES. A voice turn closes on SILENCE; the chain closes on
 * STILLNESS: when every slot is filled and the board stops changing for
 * `CHAIN_SETTLE_MS`, the activity checks the order and commits it. It is
 * completeness-gated — an unfinished chain is thinking, not an answer — and
 * never correctness-gated: a wrong full chain commits exactly as readily as a
 * right one.
 *
 * Asks and build gates live in `causeEffectChainScript.ts`; the assignment and
 * scene the tutor receives live in `causeEffectChainWorkspace.ts`.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaSectionLabel,
  LuminaChallengeCounter,
  LuminaPrompt,
  LuminaChip,
  LuminaChipBank,
  LuminaDropZone,
  LuminaReadAloud,
  type DropZoneState,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CauseEffectChainMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import {
  correctChoiceOf,
  type CauseEffectChainItem,
  type ChainCard,
  type ChainKind,
  type ChainTier,
} from './causeEffectChainScript';
import {
  causeEffectAssignment,
  causeEffectItems,
  causeEffectScene,
  chainMatches,
  chainMiss,
  describeChain,
  hearBackgroundRequest,
} from './causeEffectChainWorkspace';
import {
  ENDS_MODEL_LEVER, MODEL_CHAIN_LEVER, ROLE_MODEL_LEVER, ROLE_TAG, TWO_TESTS_LEVER,
  causeEffectLevers, chainModelFor, leversOnScreen, orderedPractice, practiceItem, roleModelFor, startingLevers,
  type ChainSession,
} from './causeEffectChainLevers';
import { useStimulusPipSurface } from '../../../pip/useStimulusPipSurface';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

/**
 * The causal-reasoning moves this primitive evaluates — the PRD's own three
 * phases, and the L1 eval-mode ladder.
 *
 *   identify_cause     is THIS card a cause of the ending? (one spoken yes/no per card)
 *   build_chain        order the causes into the chain that produced the outcome (hands)
 *   root_vs_proximate  name the ROOT cause, or the one right before the outcome (spoken)
 *
 * All three run off ONE emission. `nodes` is always exactly what is on screen
 * and `correctOrder` is always the causes in causal order, so each mode is a
 * different QUESTION over identical content rather than a different payload.
 */
export type CauseEffectChallengeType = ChainKind;

/**
 * Within-mode support tier — the second field of the two-field contract. The
 * eval mode says WHICH causal move; the tier says how much help there is inside
 * it. Since the port, the strategy line is SPOKEN (the guide line, easy only),
 * the hint is gone (the scripted correction re-models), and two levers are
 * still rendered: slot numbers and category labels. The L4 shape axis is
 * generator-side and untouched. Never the chain length, which is grade fidelity.
 */
export type CauseEffectSupportTier = ChainTier;

/**
 * A cause category. Colour-coded per the PRD so a student can SEE that the
 * causes of one event come from different corners of life. Never correlates
 * with chain position, so it can never be read as an ordering hint.
 */
export type CauseCategory = 'political' | 'economic' | 'social' | 'technological';

/** One event in the chain — a cause card, or the outcome that anchors it. */
export interface CauseEffectNode {
  id: string;
  /**
   * The event, as a plain statement. Never carries its own position: the
   * generator rejects ordinal words, causal connectives and dates — and, since
   * the port, anything that cannot be READ ALOUD (a double quote, a sentinel
   * opener), because every card is now spoken.
   */
  text: string;
  category: CauseCategory;
  /** Single depicting emoji. */
  icon: string;
}

export interface CauseEffectChainChallenge {
  id: string;
  /** Which causal move this challenge asks for. Code-stamped by the generator. */
  type: CauseEffectChallengeType;
  /** `root_vs_proximate` only: which END of the chain this round asks for. */
  ask?: 'root' | 'proximate';
  /** The generator's distinctness key. Not rendered. */
  chainTheme: string;
  /** The effect the chain has to explain. The one thing every ask may name. */
  outcome: CauseEffectNode;
  /**
   * Everything on the page, ALWAYS emitted shuffled. On an `identify_cause`
   * round this also holds the non-causes; a card is a cause only if
   * `correctOrder` names it.
   */
  nodes: CauseEffectNode[];
  /** The CAUSES in causal order, earliest first. The outcome is not listed. */
  correctOrder: string[];
  /** Why the chain runs this way — rendered behind `revealHeld`, never spoken. */
  explanation: string;
  /** Retained on the payload; the judged loop renders no hint disclosure. */
  hint?: string;

  // ---- Support tier (generator-side, per challenge; see CauseEffectSupportTier) ----
  /** Retained; the strategy is the SPOKEN guide line now (easy tier only). */
  showStrategy?: boolean;
  /** The category chip label on each card. The icon stays at every tier. */
  showCategoryLabels?: boolean;
  /** The 1/2/3 badge on each chain slot (`build_chain`). */
  showSlotNumbers?: boolean;
  /** Retained; the judged loop offers no hint. */
  showHint?: boolean;
}

export interface CauseEffectChainData {
  title: string;
  description: string;
  /** The setting all the chains sit in. Frames the period, never the causes. */
  context: string;
  /** Short period tag for the header badge. */
  periodLabel: string;
  /** 3-5 challenges. REQUIRED for the judged loop. Built by the generator. */
  challenges: CauseEffectChainChallenge[];
  /**
   * Session-level task identity, or 'mixed'. REPRESENTATIVE METADATA ONLY —
   * every ask is built from the per-challenge `type`.
   */
  challengeType: CauseEffectChallengeType | 'mixed';
  /** Canonical grade key ('K'|'1'…) stamped by the generator. K-2 hear the cards. */
  gradeLevel?: string;
  /** Session-level tier, stamped by the generator when the manifest sent one. */
  supportTier?: CauseEffectSupportTier;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CauseEffectChainMetrics>) => void;
}

interface CauseEffectChainProps {
  data: CauseEffectChainData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Presentation constants
// ============================================================================

const MODE_META: Record<ChainKind, { badge: string; icon: string; accent: LuminaAccent }> = {
  identify_cause: { badge: 'Find the Causes', icon: '🔍', accent: 'amber' },
  build_chain: { badge: 'Build the Chain', icon: '🔗', accent: 'amber' },
  root_vs_proximate: { badge: 'Root or Right Before', icon: '🌱', accent: 'amber' },
};

/** The question, printed for a reader under the badge. Never the answer. */
const questionFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause': return 'Did this event help cause the ending?';
    case 'build_chain': return 'What led to what?';
    case 'root_vs_proximate':
      return item.ask === 'proximate' ? 'Which one came right before the ending?' : 'Which one is the root?';
  }
};

/**
 * Category chrome. Colours are the PRD's so the same kind of cause reads the
 * same way across every chain in the suite.
 */
const CATEGORY_META: Record<string, { label: string; className: string }> = {
  political: { label: 'Political', className: 'text-sky-300 border-sky-400/30 bg-sky-400/10' },
  economic: { label: 'Economic', className: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' },
  social: { label: 'Social', className: 'text-orange-300 border-orange-400/30 bg-orange-400/10' },
  technological: { label: 'Technological', className: 'text-purple-300 border-purple-400/30 bg-purple-400/10' },
};

/** How long a full chain may stay still before it commits. The window itself
 *  is the controller's (`armStillness`); this is the one number that is a
 *  property of THIS board — three or four cards placed one at a time, and a
 *  child who wants to swap two has to take one out first. */
const CHAIN_SETTLE_MS = 3000;

interface RevealPayload {
  item: CauseEffectChainItem;
}

// ============================================================================
// Component
// ============================================================================

const CauseEffectChainSurface: React.FC<CauseEffectChainProps> = ({ data, className, runtimePlanItemId }) => {
  const {
    title,
    description,
    context,
    periodLabel,
    challenges = [],
    gradeLevel,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `cause-effect-chain-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const workspace = useRef<TeachingWorkspace | null>(null);

  /** K-2 read slowly or not at all — the read-aloud is sized to a young hand. */
  const isEmergingReader = gradeLevel === 'K' || gradeLevel === '1' || gradeLevel === '2';

  const items = useMemo(
    () => causeEffectItems({ challenges, periodLabel, gradeLevel, supportTier }),
    [challenges, periodLabel, gradeLevel, supportTier],
  );

  /** The per-challenge render levers, looked up by the staged item's challenge. */
  const leversFor = useCallback((challengeId: string) => {
    const ch = challenges.find((c) => c.id === challengeId);
    return {
      showCategoryLabels: ch?.showCategoryLabels ?? true,
      showSlotNumbers: ch?.showSlotNumbers ?? true,
    };
  }, [challenges]);

  // ── The board (build_chain) ───────────────────────────────────────────────
  /** Card id per chain slot, earliest first. `null` = still empty. A ref
   *  shadows it so the stillness commit reads the board at FIRE time. */
  const [placed, setPlaced] = useState<(string | null)[]>([]);
  const placedRef = useRef<(string | null)[]>([]);
  const resetBoard = useCallback((item: CauseEffectChainItem | null) => {
    const slots = item?.kind === 'build_chain'
      ? new Array<string | null>(item.correctOrder.length).fill(null)
      : [];
    placedRef.current = slots;
    setPlaced(slots);
  }, []);

  /** The reveal payload (18b): set in `onAffirmed`, rendered behind
   *  `runner.revealHeld`, deliberately NOT cleared in `onItemOpened`. */
  const [reveal, setReveal] = useState<RevealPayload | null>(null);

  // In-item levers (`causeEffectChainLevers.ts`), keyed by the session item they were pulled on, and the easier
  // practice item a simplify lever puts in place of the session item until the observer returns to it. A ref
  // shadows the practice item so a retry on it rebuilds ITS board, not the session item's.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPracticeState] = useState<CauseEffectChainItem | null>(null);
  const practiceRef = useRef<CauseEffectChainItem | null>(null);
  const setPractice = useCallback((p: CauseEffectChainItem | null) => {
    practiceRef.current = p;
    setPracticeState(p);
  }, []);
  const session = useMemo<ChainSession>(() => ({ items, gradeLevel, tier: supportTier }), [items, gradeLevel, supportTier]);

  const evaluation = usePrimitiveEvaluation<CauseEffectChainMetrics>({
    primitiveType: 'cause-effect-chain',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const sessionChallengeType: CauseEffectChainMetrics['challengeType'] = useMemo(() => {
    const kinds = Array.from(new Set(items.map((i) => i.kind)));
    return kinds.length === 1 ? kinds[0] : 'mixed';
  }, [items]);

  const finish = (summary: TeachingEvaluationResult) => {
    const metrics: CauseEffectChainMetrics = {
      type: 'cause-effect-chain',
      challengeType: items.length > 0 ? sessionChallengeType : (data.challengeType ?? 'mixed'),
      // One judged ITEM per row: an identify run counts each card it asked.
      totalChallenges: items.length,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      // The background read-aloud is baseline access, not a hint, and there is
      // no hint disclosure left to count. Reported honestly.
      hintsViewed: 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: items.length
        ? Math.round((summary.attemptsCount / items.length) * 10) / 10
        : 0,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { periodLabel, challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<CauseEffectChainItem>({
    primitiveId: 'cause-effect-chain',
    assignment: causeEffectAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: (item) => { setPractice(null); resetBoard(item); },
    // All-or-nothing: the whole board clears, because leaving the right cards
    // in place would hand back which ones were already right. A retry on a
    // practice item keeps the practice item and clears its board.
    onCorrectionRetry: (item) => resetBoard(practiceRef.current ?? item),
    // The full item back after its practice item: empty, the practice board is not work on it.
    onPracticeClosed: (item) => { setPractice(null); resetBoard(item); },
    onAffirmed: (item) => setReveal({ item }),
  });
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const sessionItem = runner.currentItem;
  const shownItem = practice ?? sessionItem;
  const starting = practice ? [] : startingLevers(supportTier, sessionItem);
  const pulledLevers = practice || !sessionItem || leverState.item !== sessionItem.id ? [] : leverState.pulled;
  const leverOn = (id: string) => !practice && (starting.includes(id) || pulledLevers.includes(id));
  const roleModel = sessionItem && leverOn(ROLE_MODEL_LEVER) ? roleModelFor(sessionItem, session) : null;
  const chainModel = sessionItem && (leverOn(MODEL_CHAIN_LEVER) || leverOn(ENDS_MODEL_LEVER))
    ? chainModelFor(sessionItem, session) : null;

  // What the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation; every item is answerable once it opens.
  useLayoutEffect(() => {
    if (!sessionItem || !shownItem) return;
    const scene = causeEffectScene(shownItem, context, placedRef.current);
    const levers = practice ? [] : causeEffectLevers(sessionItem, session, pulledLevers, starting);
    const onScreen = practice ? null : leversOnScreen(sessionItem, [...starting, ...pulledLevers], session);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: `An easier practice item, ungraded. The full item comes back after it.${orderedPractice(practice)
          ? ' Its cards are drawn in order, earliest at the top, each leading to the next and the ending last.' : ''}` } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionItem, session);
          if (!easier) return 'This item is already the plainest of its kind.';
          setLeverState(next); setPractice(easier); resetBoard(easier);
          return { practice: causeEffectAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setPractice(null); resetBoard(sessionItem); },
    };
  });

  const showReveal = runner.revealHeld && reveal !== null;
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The ending and the events', finished: showSummary,
    handover: runner.currentItem?.kind === 'build_chain',
  });

  // ── Hands: place, remove, and the stillness close ─────────────────────────
  /** Called by the stillness window once the full chain has sat still. Reads the
   *  board through the ref, at fire time; the activity's own check is the verdict. */
  const commitChain = useCallback(() => {
    const item = practiceRef.current ?? runner.currentItem;
    if (!item || item.kind !== 'build_chain') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const order = placedRef.current;
    if (order.length === 0 || order.some((id) => id === null)) return;
    commitGesture(runner, { response: describeChain(item, order), correct: chainMatches(item, order), cue: () => '',
      miss: chainMiss(item, order) });
  }, [runner]);

  /** Tap a bank card → it drops into the earliest empty slot. Filling the last
   *  slot arms the stillness window; anything short of that cancels it. */
  const handlePlace = useCallback((cardId: string) => {
    const item = practiceRef.current ?? runner.currentItem;
    if (!item || item.kind !== 'build_chain') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const prev = placedRef.current;
    const firstEmpty = prev.indexOf(null);
    if (firstEmpty === -1 || prev.includes(cardId)) return;
    const next = [...prev];
    next[firstEmpty] = cardId;
    placedRef.current = next;
    setPlaced(next);
    if (next.every((id) => id !== null)) {
      // The completing placement is a CHOICE committed, not one more tap.
      SoundManager.select();
      runner.armStillness(commitChain, CHAIN_SETTLE_MS);
    } else {
      SoundManager.tap();
      runner.clearStillness();
    }
    // `armStillness`/`clearStillness` are identity-stable; `runner` is not, but
    // this is an event handler, never an effect dep.
  }, [runner, commitChain]);

  /** Tap a placed card → it returns to the bank. Starting over is thinking. */
  const handleRemove = useCallback((slotIndex: number) => {
    const item = practiceRef.current ?? runner.currentItem;
    if (!item || item.kind !== 'build_chain') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const prev = placedRef.current;
    if (prev[slotIndex] === null) return;
    const next = [...prev];
    next[slotIndex] = null;
    placedRef.current = next;
    setPlaced(next);
    SoundManager.tap();
    runner.clearStillness();
  }, [runner]);

  // ── The background read-aloud: a silent host request, never an answer ─────
  const ctx = useLuminaAIContext();
  const readContext = () => {
    if (context) ctx.sendText(hearBackgroundRequest(context), { silent: true, author: 'host' });
  };

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => ({
      label: MODE_META[item.kind].badge,
      icon: MODE_META[item.kind].icon,
      accentColor: 'amber',
    }));
  }, [runner.practiceSummary, items]);

  /** WHICH item is on the bench right now: the reveal renders its OWN item while it is held. */
  const staged = showReveal && reveal ? reveal.item : shownItem;
  const modeMeta = MODE_META[staged?.kind ?? 'build_chain'];
  const levers = leversFor(staged?.challengeId ?? '');

  // ── Render: one card body ─────────────────────────────────────────────────
  const renderCardBody = (card: ChainCard) => (
    <span className="flex items-start gap-2 text-left">
      <span className="text-lg leading-none shrink-0">{card.icon}</span>
      <span className="min-w-0">
        <span className="block whitespace-normal break-words">{card.text}</span>
        {levers.showCategoryLabels && CATEGORY_META[card.category] && (
          <span
            className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_META[card.category].className}`}
          >
            {CATEGORY_META[card.category].label}
          </span>
        )}
      </span>
    </span>
  );

  /** The ending — the one thing on screen every ask may name. Locked, and
   *  visually distinct so it never reads as a card to be placed. */
  const renderOutcome = (item: CauseEffectChainItem) => (
    <div className="flex items-start gap-2">
      <span className="mt-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/20 text-xs font-semibold text-amber-100">
        🏁
      </span>
      <LuminaPanel accent="amber" className="flex-1 py-3">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">
          What happened in the end
        </span>
        <span className="block text-sm font-medium text-slate-100">
          {renderCardBody(item.outcome)}
        </span>
      </LuminaPanel>
    </div>
  );

  // ── Render: identify_cause — the ending, and ONE card ─────────────────────
  const renderIdentify = (item: Extract<CauseEffectChainItem, { kind: 'identify_cause' }>) => {
    const revealed = showReveal && reveal?.item.id === item.id;
    const ring = !revealed
      ? 'border-white/10 bg-slate-900/40'
      : item.isCause
        ? 'border-emerald-400/40 bg-emerald-500/10'
        : 'border-rose-400/40 bg-rose-500/10';
    const roleLine = item.role === 'cause'
      ? 'A cause — it came before, and the ending needed it.'
      : item.role === 'consequence'
        ? 'Not a cause — it could only happen once the ending had.'
        : 'Not a cause — true at the time, but it pushed nothing along.';
    return (
      <div className="space-y-4">
        {renderOutcome(item)}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <LuminaSectionLabel accent="amber" size="sm">One event</LuminaSectionLabel>
            <span className="text-[11px] text-slate-500">
              {item.ordinal + 1} of {item.runSize}
            </span>
          </div>
          <div className={`rounded-2xl border-2 px-4 py-4 text-sm font-medium text-slate-100 transition-colors ${ring}`}>
            {renderCardBody(item.card)}
            {revealed && (
              <p className={`mt-2 text-xs ${item.isCause ? 'text-emerald-200' : 'text-rose-200'}`}>{roleLine}</p>
            )}
          </div>
          {/* The help lever `two_tests`: two EMPTY checks under the card. Nothing ever ticks them. */}
          {leverOn(TWO_TESTS_LEVER) && !revealed && (
            <div data-lever="two-tests" className="space-y-1 pl-2 text-xs text-slate-300">
              <p>☐ Did it happen before the ending?</p>
              <p>☐ Did the ending need it?</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  /** The help levers' models: an everyday chain or ending BESIDE the item, never on a learner's card. */
  const renderModels = () => {
    if (roleModel) {
      return (
        <LuminaPanel accent="amber" className="py-3" data-lever="role-model">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">
            A model, from everyday life
          </span>
          <p className="text-xs text-slate-200">{roleModel.chain.icon} In the end: {roleModel.chain.outcome}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {roleModel.cards.map((c) => (
              <li key={c.text}>{c.text} <span className="text-amber-200/80">({ROLE_TAG[c.role]})</span></li>
            ))}
          </ul>
        </LuminaPanel>
      );
    }
    if (chainModel) {
      const tagged = leverOn(ENDS_MODEL_LEVER);
      const last = chainModel.causes.length - 1;
      return (
        <LuminaPanel accent="amber" className="py-3" data-lever={tagged ? 'ends-model' : 'model-chain'}>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">
            A model chain, from everyday life
          </span>
          <ol className="space-y-0.5 text-xs text-slate-300">
            {chainModel.causes.map((t, i) => (
              <li key={t}>
                {chainModel.chain.icon} {t}
                {tagged && i === 0 && <span className="ml-1 text-amber-200/80">(root)</span>}
                {tagged && i === last && <span className="ml-1 text-amber-200/80">(right before the ending)</span>}
                <span className="block pl-4 text-slate-500" aria-hidden>↓</span>
              </li>
            ))}
            <li className="font-medium text-slate-100">🏁 {chainModel.chain.outcome}</li>
          </ol>
        </LuminaPanel>
      );
    }
    return null;
  };

  // ── Render: build_chain — the board ───────────────────────────────────────
  const renderBuild = (item: Extract<CauseEffectChainItem, { kind: 'build_chain' }>) => {
    const revealed = showReveal && reveal?.item.id === item.id;
    const slots = revealed ? item.correctOrder : placed;
    const byId = new Map(item.cards.map((c) => [c.id, c]));
    const taken = new Set(slots.filter((id): id is string => id !== null));
    const bank = item.cards.filter((c) => !taken.has(c.id));
    const slotState = (id: string | null): DropZoneState => {
      if (revealed) return 'correct';
      return id ? 'filled' : 'idle';
    };
    const live = runner.canAttempt && !runner.isAwaitingGesture();

    return (
      <div className="space-y-4">
        <div className="space-y-1">
          {slots.map((id, slotIndex) => {
            const card = id ? byId.get(id) ?? null : null;
            return (
              <div key={`slot-${slotIndex}`}>
                <div className="flex items-start gap-2">
                  <span
                    className="mt-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-xs font-semibold text-amber-200"
                    aria-label={`Chain slot ${slotIndex + 1}`}
                  >
                    {levers.showSlotNumbers ? slotIndex + 1 : '·'}
                  </span>
                  <LuminaDropZone
                    state={slotState(id)}
                    className="min-h-[68px] flex-1 justify-start text-left"
                    emptyPrompt={
                      <span className="text-xs font-normal text-slate-500">
                        Tap a card below to put it here
                      </span>
                    }
                  >
                    {card && (
                      <button
                        type="button"
                        className="w-full text-left text-sm font-medium text-slate-100 disabled:cursor-default"
                        onClick={() => handleRemove(slotIndex)}
                        disabled={!live || revealed}
                        aria-label={revealed || !live ? card.text : `Remove "${card.text}" from the chain`}
                      >
                        {renderCardBody(card)}
                      </button>
                    )}
                  </LuminaDropZone>
                </div>
                <div className="flex items-center gap-2 pl-8 py-0.5 text-[11px] text-slate-500">
                  <span aria-hidden>↓</span>
                  <span>which led to</span>
                </div>
              </div>
            );
          })}
          {renderOutcome(item)}
        </div>

        {!revealed && (
          <LuminaChipBank label={bank.length > 0 ? 'Events' : 'All events placed — hold still'}>
            {bank.map((card) => (
              <LuminaChip
                key={card.id}
                state="idle"
                className="max-w-full whitespace-normal py-3 text-left"
                onClick={() => handlePlace(card.id)}
                disabled={!live}
                aria-label={`Place "${card.text}"`}
              >
                {renderCardBody(card)}
              </LuminaChip>
            ))}
          </LuminaChipBank>
        )}
      </div>
    );
  };

  // ── Render: root_vs_proximate — the ending, and the cards in a row ────────
  const renderRoot = (item: Extract<CauseEffectChainItem, { kind: 'root_vs_proximate' }>) => {
    const revealed = showReveal && reveal?.item.id === item.id;
    const answerId = correctChoiceOf(item).card.id;
    // The simplify lever `ordered_chain`: a practice chain drawn in causal order, the ending last.
    const ordered = orderedPractice(item);
    return (
      <div className="space-y-4">
        {!ordered && renderOutcome(item)}
        <div className="space-y-2" data-lever={ordered ? 'ordered-chain' : undefined}>
          <LuminaSectionLabel accent="amber" size="sm">{ordered ? 'The chain, in order' : 'The events'}</LuminaSectionLabel>
          {/* Numbered in on-screen order — the generator's shuffle, provably
              not the answer order — so "the second one" is a fair answer. */}
          <div className="space-y-2">
            {item.cards.map((card, i) => {
              const isAnswer = revealed && card.id === answerId;
              return (
                <div
                  key={card.id}
                  className={`flex items-start gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-medium text-slate-100 transition-colors ${
                    isAnswer ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-slate-900/40'
                  }`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-xs font-semibold text-amber-200">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">{renderCardBody(card)}</div>
                  {ordered && <span className="self-end text-[11px] text-slate-500" aria-hidden>↓ which led to</span>}
                </div>
              );
            })}
          </div>
        </div>
        {ordered && renderOutcome(item)}
      </div>
    );
  };

  const renderStage = (item: CauseEffectChainItem) => {
    switch (item.kind) {
      case 'identify_cause': return renderIdentify(item);
      case 'build_chain': return renderBuild(item);
      case 'root_vs_proximate': return renderRoot(item);
    }
  };

  const backgroundEl = (
    <div className="space-y-2">
      <LuminaSectionLabel accent="amber" size="sm">The story so far</LuminaSectionLabel>
      <LuminaPanel accent="amber" className="py-3">
        <p className="text-sm leading-relaxed text-slate-300">{context}</p>
        <div className="mt-3">
          {/* The pre-reader's channel to the setting. Question-side by
              construction: the background never states what caused what. */}
          <LuminaReadAloud
            size={isEmergingReader ? 'lg' : 'sm'}
            speaking={runner.tutorSpeaking}
            label="Read this to me"
            onClick={readContext}
          />
        </div>
      </LuminaPanel>
    </div>
  );

  if (items.length === 0) {
    return (
      <LuminaCard className={className} topAccent="amber">
        <LuminaCardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔗</span>
              <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            </div>
            <LuminaBadge accent="amber" className="text-xs">{periodLabel}</LuminaBadge>
          </div>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </LuminaCardHeader>
        <LuminaCardContent className="space-y-4">
          {context ? backgroundEl : (
            <p className="text-slate-400 text-center">No chains available.</p>
          )}
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className} topAccent="amber">
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔗</span>
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          </div>
          <div className="flex items-center gap-2">
            {!showSummary && staged && (
              <LuminaBadge accent={modeMeta.accent} className="text-xs">
                {modeMeta.icon} {modeMeta.badge}
              </LuminaBadge>
            )}
            <LuminaBadge accent="amber" className="text-xs">{periodLabel}</LuminaBadge>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {!showSummary && (
          <>
            {backgroundEl}

            <div className="space-y-4 border-t border-white/10 pt-4">
              <div className="flex items-center justify-center gap-4">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, items.length)}
                  total={items.length}
                  variant="dots"
                />
              </div>

              {staged && (
                <LuminaPrompt accent="amber" center>
                  {questionFor(staged)}
                </LuminaPrompt>
              )}

              {pip.store && <div {...pip.dock} />}
              {practice && !showReveal && (
                <div className="text-center text-xs text-amber-300" data-practice>Practice — an easier one first</div>
              )}
              {staged && <div {...pip.target('stimulus')}>{renderStage(staged)}</div>}
              {!showReveal && renderModels()}

              {/* Reveal-on-affirm: the teaching note, for exactly as long as the
                  tutor's affirmation is being spoken (runner.revealHeld). Not on
                  an identify card — the note names the whole chain, and the
                  rest of that run may still be unasked. */}
              {showReveal && reveal && reveal.item.kind !== 'identify_cause' && reveal.item.explanation && (
                <div className="flex justify-center">
                  <p className="rounded-2xl border-2 border-emerald-400/30 bg-emerald-500/10 px-5 py-2.5 text-center text-xs text-emerald-100 max-w-md animate-in fade-in duration-300">
                    {reveal.item.explanation}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Chains Built!"
            celebrationMessage={`You traced what caused what in ${periodLabel}.`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** Runs only on the teaching workspace; an unbound mount shows the "needs the tutor" card. */
const CauseEffectChain = withWorkspaceOnly<CauseEffectChainProps>('cause-effect-chain', CauseEffectChainSurface,
  (props) => props.data.title);

export default CauseEffectChain;
