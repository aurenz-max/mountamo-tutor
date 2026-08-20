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

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
}

const SortingStation: React.FC<SortingStationProps> = ({ data, className }) => {
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

  const pack = useMemo<JudgedScriptPack<SortingStationItem>>(() => ({
    ...sortingStationPackBase(items),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: () => 'Listen, then say your answer out loud.',
      retry: () => 'Have another go — say your answer.',
      done: 'Great sorting today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the answer wrong from the audio.';
      switch (item.kind) {
        case 'sort':
          return {
            challenge: `sort: which group ${item.stimulus} belongs with (sorting by ${item.ruleName ?? 'the rule'}; groups: ${item.choices.join(', ')}).`,
            expected: item.answer,
            observed: heard,
          };
        case 'pick_rule':
          return {
            challenge: `pick_rule: which way to sort the set (options: ${item.choices.join(', ')}).`,
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
  }), [items]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback((summary: JudgedRunSummary) => {
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
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useJudgedScriptRunner<SortingStationItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    exhibitId,
    onFinished: handleFinished,
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

  const currentItem = runner.currentItem;
  const currentChallenge = currentItem
    ? challengeById.get(currentItem.challengeId) ?? null
    : null;

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
    if (currentItem.kind === 'count_group' || currentItem.kind === 'compare') {
      return currentChallenge.categories ?? [];
    }
    return [];
  }, [currentItem, currentChallenge]);

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
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => (
      PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🎨' }
    ));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render
  // ============================================================================

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
        {!evaluation.hasSubmitted && currentItem && (
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
                <LuminaPanel className="px-8 py-5 flex flex-col items-center gap-2">
                  <span className={isPreReader ? 'text-7xl' : 'text-5xl'}>{focusObject.emoji}</span>
                  {/* The label is a caption, never the gate — the tutor said it. */}
                  <span className={`text-slate-300 ${isPreReader ? 'text-base' : 'text-sm'}`}>
                    {focusObject.label}
                  </span>
                </LuminaPanel>
              </div>
            )}

            {/* ── The row of cards: odd-one-out and pick-the-rule look at all
                   of them at once. No card is tappable — the answer is said. */}
            {(currentItem.kind === 'odd_one' || currentItem.kind === 'pick_rule') && (
              <div className={`flex flex-wrap justify-center ${isPreReader ? 'gap-4' : 'gap-3'}`}>
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

            {/* ── The trays. R4: at K a tray is a PICTURE with the word as a
                   small caption; the word never gates, the tutor names each one. */}
            {trays.length > 0 && (
              <div className={`grid ${isPreReader ? 'gap-5 max-w-[840px] mx-auto' : 'gap-3'} ${
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
                    : objectsInTray(cat.label);
                  const isRevealedTray = runner.revealHeld
                    && currentItem.kind === 'sort'
                    && cat.label.toLowerCase() === currentItem.answer.toLowerCase();
                  return (
                    <LuminaPanel
                      key={cat.label}
                      className={`transition-all duration-200 ${color.bg} ${
                        isRevealedTray ? 'ring-2 ring-emerald-400 scale-105' : ''
                      } ${isPreReader ? 'min-h-[168px] p-3' : 'min-h-[100px] p-2'}`}
                    >
                      {isPreReader ? (
                        <div className="flex flex-col items-center gap-1 mb-2">
                          <span className="text-5xl leading-none" aria-hidden>
                            {cat.bucketEmoji || FALLBACK_BIN_EMOJI[idx % FALLBACK_BIN_EMOJI.length]}
                          </span>
                          <span className={`text-sm font-semibold ${color.text}`}>{cat.label}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${color.text}`}>{cat.label}</span>
                          {/* ⭐ The count badge is the ANSWER on a count ask. The
                              easy-tier lever turns it on; `hidesCounts` overrides
                              that until the tutor has affirmed the number. */}
                          {showCounts && (!currentItem.hidesCounts || runner.revealHeld) && (
                            <LuminaBadge accent="cyan" className="text-xs">{inTray.length}</LuminaBadge>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap justify-center gap-2">
                        {inTray.map((obj) => (
                          <div key={obj.id} className="flex flex-col items-center gap-0.5">
                            <span className={isPreReader ? 'text-4xl' : 'text-xl'}>{obj.emoji}</span>
                          </div>
                        ))}
                      </div>
                    </LuminaPanel>
                  );
                })}
              </div>
            )}

            {/* ── two-attributes: the two criteria as picture-free word cues.
                   The question is spoken; these only anchor what "both" means. */}
            {currentItem.kind === 'both_criteria' && currentItem.criteria && (
              <div className="flex justify-center gap-3">
                <LuminaBadge accent="purple" className="text-sm capitalize">
                  {currentItem.criteria.primary}
                </LuminaBadge>
                <span className="text-slate-500 self-center text-sm">and</span>
                <LuminaBadge accent="cyan" className="text-sm capitalize">
                  {currentItem.criteria.secondary}
                </LuminaBadge>
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

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
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

export default SortingStation;
