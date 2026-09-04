'use client';

/**
 * CauseEffectChain — TWO surfaces, forked on whether judged items could be built:
 *
 *  - DI JUDGED LOOP (the normal path): the Live tutor owns the clock. It states
 *    the ending, reads the cards to a child who cannot read them, waits, judges
 *    the answer, corrects contrastively, and its own affirmation is the advance.
 *    No advance timer, no Next button, no Check button, no push-to-talk mic, no
 *    printed answer before the affirm.
 *
 *  - BACKGROUND ONLY (no challenges, or every one dropped by a build gate): the
 *    "story so far" on its own. The honest degrade — nothing is judged.
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
 *  - the NEXT button — the tutor owns the clock.
 *  - the HINT DISCLOSURE — a hint the child dispenses to themselves is not a
 *    scaffold a tier can withdraw; the scripted correction re-models instead.
 *  - the EXPLANATION under the feedback card — it names the answer, so it is a
 *    reveal, and reveals ride `runner.revealHeld` (18b).
 *  - every improvised tutor turn (the framing send, the per-verdict sends,
 *    the per-round send, the closing send, the tier reveal clause) — the cues
 *    carry the entire spoken surface.
 *
 * WHAT IT KEEPS, deliberately: the BACKGROUND panel with its read-aloud
 * (`contextCue`, the pre-reader's channel to the setting — question-side by
 * construction, it never states what caused what), the CHAIN BOARD (the page a
 * build_chain child works on), and two L3 render levers: `showSlotNumbers` on
 * the board and `showCategoryLabels` on every card (the ICON stays at every
 * tier — it is the emerging reader's channel).
 *
 * HOW A HANDS TURN CLOSES. A voice turn closes on SILENCE; the chain closes on
 * STILLNESS: when every slot is filled and the board stops changing for
 * `CHAIN_SETTLE_MS`, the order is described to the tutor and judged. The
 * WINDOW is the runner's (`armStillness`, 19c). It is completeness-gated —
 * an unfinished chain is thinking, not an answer — and never correctness-
 * gated: a wrong full chain commits exactly as readily as a right one.
 *
 * Cue lines, judging contracts and build gates live in the script module
 * (hand-authored, DISTAR). Nothing in this file writes a spoken line.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
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
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  causeEffectChainPackBase,
  chainVerdictCue,
  contextCue,
  correctChoiceOf,
  itemsFromChallenges,
  type CauseEffectChainItem,
  type ChainCard,
  type ChainKind,
  type ChainTier,
} from './causeEffectChainScript';

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
 *  is the runner's (`armStillness`, 19c); this is the one number that is a
 *  property of THIS board — three or four cards placed one at a time, and a
 *  child who wants to swap two has to take one out first. */
const CHAIN_SETTLE_MS = 3000;

interface RevealPayload {
  item: CauseEffectChainItem;
}

// ============================================================================
// Component
// ============================================================================

const CauseEffectChain: React.FC<CauseEffectChainProps> = ({ data, className }) => {
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

  /** K-2 read slowly or not at all — the read-aloud is sized to a young hand. */
  const isEmergingReader = gradeLevel === 'K' || gradeLevel === '1' || gradeLevel === '2';

  const items = useMemo(
    () => itemsFromChallenges(
      challenges.map((c) => ({
        id: c.id,
        type: c.type,
        ask: c.ask,
        outcome: c.outcome,
        nodes: c.nodes,
        correctOrder: c.correctOrder,
        explanation: c.explanation,
      })),
      { periodLabel, gradeLevel },
      { tier: supportTier },
    ),
    [challenges, periodLabel, gradeLevel, supportTier],
  );

  const judged = items.length > 0;

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

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const metrics: CauseEffectChainMetrics = {
      type: 'cause-effect-chain',
      challengeType: items.length > 0 ? sessionChallengeType : (data.challengeType ?? 'mixed'),
      // One judged ITEM per row: an identify run counts each card it asked.
      totalChallenges: items.length,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      // The background read-aloud is baseline access, not a hint, and the
      // judged loop has no hint disclosure left to count. Reported honestly.
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
      { periodLabel, challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, sessionChallengeType, data.challengeType, periodLabel, evaluation]);

  // ── The pack — wording lives in causeEffectChainScript.ts ─────────────────
  // The cue surface is SPREAD, not re-declared, so the DI drive harness reads
  // the same bytes this component sends.
  const pack = useMemo<JudgedScriptPack<CauseEffectChainItem>>(() => ({
    ...causeEffectChainPackBase(items),
    statusLines: {
      ready: (item) => (item.answerKind === 'gesture'
        ? 'Build the chain, then hold still.'
        : 'Listen, then say your answer.'),
      retry: (item) => (item.answerKind === 'gesture'
        ? 'Build the chain again, then hold still.'
        : 'Listen again — then say your answer.'),
      done: 'Great history today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = (lastHeard ?? '').trim();
      const expected = item.kind === 'identify_cause'
        ? (item.isCause ? 'yes' : 'no')
        : item.kind === 'build_chain'
          ? item.correctOrder.join(' → ')
          : correctChoiceOf(item).card.text;
      const observed = item.kind === 'build_chain'
        ? `Built ${placedRef.current.map((id) => id ?? '_').join(' → ')}.`
        : heard ? `Said "${heard}".` : 'Said something that did not match.';
      return {
        challenge: `${MODE_META[item.kind].badge}: ${item.outcome.text}`,
        expected,
        observed,
      };
    },
  }), [items]);

  const runner = useJudgedScriptRunner<CauseEffectChainItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeLevel || 'Elementary',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: (item) => resetBoard(item),
    // All-or-nothing: the whole board clears, because leaving the right cards
    // in place would hand back which ones were already right.
    onCorrectionRetry: (item) => resetBoard(item),
    onAffirmed: (item) => setReveal({ item }),
  });

  const showReveal = runner.revealHeld && reveal !== null;

  // ── Hands: place, remove, and the stillness close ─────────────────────────
  /** Called by the runner's stillness window once the full chain has sat still.
   *  Reads the board through the ref, at fire time. */
  const commitChain = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'build_chain') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const order = placedRef.current;
    if (order.length === 0 || order.some((id) => id === null)) return;
    runner.submitGestureAttempt(chainVerdictCue(item, order.join(',')));
  }, [runner]);

  /** Tap a bank card → it drops into the earliest empty slot. Filling the last
   *  slot arms the stillness window; anything short of that cancels it. */
  const handlePlace = useCallback((cardId: string) => {
    const item = runner.currentItem;
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
    const item = runner.currentItem;
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

  // ── The background read-aloud: the one cue the runner does not own ────────
  const ctx = useLuminaAIContext();
  const readContext = useCallback(() => {
    const cue = contextCue(context);
    if (!cue) return;
    ctx.sendText(cue, { silent: true, scripted: true });
    // Context methods are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  // ── Background-only fallback: the tutor as a silent guide ─────────────────
  useLuminaAI({
    primitiveType: 'cause-effect-chain',
    instanceId: resolvedInstanceId,
    /**
     * Pushed under the SAME TWO KEYS the judged pack uses, with the
     * `free_explore` sentinel for the round type (era-explorer's convention):
     * the catalog interpolates exactly those keys, and the static tutor-test
     * analyzer parses the first `primitiveData` literal it finds.
     */
    primitiveData: {
      challengeType: 'free_explore',
      stimulus: `the background for ${periodLabel}, on screen for the learner to read; `
        + 'no rounds could be built, so nothing is being judged; '
        + 'this state line is for you alone and is never spoken to the learner',
    },
    // The judged path owns the tutor through the runner; this hook is only
    // the fallback surface's guide, and must never open a second channel.
    enabled: !judged,
    gradeLevel: gradeLevel || 'Elementary',
  });

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => ({
      label: MODE_META[item.kind].badge,
      icon: MODE_META[item.kind].icon,
      accentColor: 'amber',
    }));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  /**
   * WHICH item is on the bench right now. On the advance path the runner opens
   * the next item in the SAME dispatch as the affirmation, so by render time
   * `currentItem` is already the NEXT one while the tutor is still saying the
   * verdict for the last. The reveal therefore renders its OWN item.
   */
  const staged = showReveal && reveal ? reveal.item : runner.currentItem;
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
        </div>
      </div>
    );
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
    return (
      <div className="space-y-4">
        {renderOutcome(item)}
        <div className="space-y-2">
          <LuminaSectionLabel accent="amber" size="sm">The events</LuminaSectionLabel>
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
                </div>
              );
            })}
          </div>
        </div>
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

  if (!judged) {
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
            {!evaluation.hasSubmitted && staged && (
              <LuminaBadge accent={modeMeta.accent} className="text-xs">
                {modeMeta.icon} {modeMeta.badge}
              </LuminaBadge>
            )}
            <LuminaBadge accent="amber" className="text-xs">{periodLabel}</LuminaBadge>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {!evaluation.hasSubmitted && (
          <>
            {backgroundEl}

            <div className="space-y-4 border-t border-white/10 pt-4">
              <div className="flex items-center justify-center gap-4">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, items.length)}
                  total={items.length}
                  variant="dots"
                />
                {/* Tap-to-hear the question again — the ending and the cards in
                    on-screen order. Never the answer, never a hint. */}
                <button
                  type="button"
                  onClick={runner.hearStimulus}
                  aria-label="Hear the question again"
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full
                    bg-amber-500/15 border-2 border-amber-500/30 text-amber-300
                    hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                    ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                  `}
                >
                  <Volume2 size={18} />
                </button>
              </div>

              {staged && (
                <LuminaPrompt accent="amber" center>
                  {questionFor(staged)}
                </LuminaPrompt>
              )}

              {staged && renderStage(staged)}

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

              <JudgedMicPanel run={runner} gestureLabel="Your turn — build the chain" />
            </div>
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
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

export default CauseEffectChain;
