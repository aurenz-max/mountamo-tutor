'use client';

/**
 * PeriodicTable: two faces, forked on whether an askable challenge arrived.
 *
 *  - EXPLORATION (no askable challenge): the free table, in `chemistry-primitives/PeriodicTableExplorer.tsx`, with
 *    search, family filters and the element modal, and its own tutor voice. No workspace session binds it.
 *  - JUDGED (challenges present): taught on the shared teaching workspace only (the boss: `periodicTable.card.ts` +
 *    `periodicTable.boss.ts`). A mount with no tutor shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 *    An Element Hunt is one tap on a box, checked by the activity (`commitGesture`); Name It and Trends are spoken and
 *    the tutor judges them against the key.
 *
 * What the judged face leaves out of the exploration chrome, and why: the search bar (type "gold", get Au: the find or
 * name ask answered), the family filter chips (a free elimination), and the tap-to-open element modal (shells on screen
 * during a valence item are the answer in pixels). The element card returns as the reveal, while the credit is held.
 *
 * The domain (build gates, ask, key, misses, scene) is `chemistry-primitives/periodicTableDomain.ts`; the levers
 * `chemistry-primitives/periodicTableLevers.ts`. Nothing in this file writes a spoken line.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PeriodicTableData } from '../types';
import { ChemicalElement } from './chemistry-primitives/types';
import { ELEMENTS, getCategoryStyle } from './chemistry-primitives/constants';
import { PeriodicTableGrid } from './chemistry-primitives/PeriodicTableGrid';
import { PeriodicTableExplorer } from './chemistry-primitives/PeriodicTableExplorer';
import { SoundManager } from '../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../ui';
import PhaseSummaryPanel, { type PhaseResult } from '../components/PhaseSummaryPanel';
import { phaseResultsFromSummary, practiceScore } from '../hooks/usePhaseResults';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import type { PeriodicTableMetrics } from '../evaluation/types';
import type { TeachingWorkspace, WorkspaceScene } from '../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../components/live-activity/runtime/useWorkspaceRunner';
import { leverScene } from '../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../pip/WorkspacePip';
import {
  cellMatches, describeCellTap, numberWord, periodicMiss, periodicScene,
  type ElementFacts, type PeriodicKind, type PeriodicTableItem,
} from './chemistry-primitives/periodicTableDomain';
import { periodicItems, periodicTableBoss } from './periodicTable.boss';
import {
  AXIS_LEVER, COLUMN_LEVER, KEY_LEVER, LETTER_LEVER, PAIR_LEVER, PERIODIC_LEVERS, PRACTICE_NOTE, RANGES_LEVER, ROW_RANGES,
  TALL_LEVER, boxKey, columnModel, helpShownFromStart, letterLit,
} from './chemistry-primitives/periodicTableLevers';

interface PeriodicTableProps {
  data: PeriodicTableData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Judged face
// ============================================================================

const MODE_META: Record<PeriodicKind, { badge: string; icon: string; accent: LuminaAccent }> = {
  find: { badge: 'Element Hunt', icon: '🔎', accent: 'blue' },
  name: { badge: 'Name It', icon: '🗣️', accent: 'purple' },
  compare: { badge: 'Compare', icon: '⚖️', accent: 'emerald' },
  valence: { badge: 'Outer Shell', icon: '⚡', accent: 'amber' },
};

const PeriodicTableJudged: React.FC<PeriodicTableProps> = ({ data, className, runtimePlanItemId }) => {
  const {
    title,
    challenges = [],
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `periodic-table-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const workspace = useRef<TeachingWorkspace | null>(null);

  /** The boss's builder: the component, the boss and the journey drop the same unaskable items. */
  const items = useMemo<PeriodicTableItem[]>(
    () => periodicItems({ challenges, supportTier }),
    [challenges, supportTier],
  );

  // ── Per-item stage state ───────────────────────────────────────────────────
  /** Wrong tap: the red-ringed box, cleared on retry and item open. */
  const [wrongTapNumber, setWrongTapNumber] = useState<number | null>(null);
  const [tappedName, setTappedName] = useState<string | null>(null);
  /** The reveal: set when the credit lands, rendered while the runner holds it, not cleared on item open. */
  const [reveal, setReveal] = useState<{ facts: ElementFacts; line: string | null } | null>(null);
  // In-item levers (`periodicTableLevers.ts`), keyed by the session item they were pulled on, and the easier
  // practice item a simplify lever puts in place of the session item until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPracticeState] = useState<PeriodicTableItem | null>(null);
  const practiceRef = useRef<PeriodicTableItem | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const setPractice = (next: PeriodicTableItem | null) => { practiceRef.current = next; setPracticeState(next); setPracticeSolved(false); };

  const evaluation = usePrimitiveEvaluation<PeriodicTableMetrics>({
    primitiveType: 'periodic-table',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const rate = (predicate: (item: PeriodicTableItem) => boolean) => {
      const scoped = items.filter(predicate);
      if (scoped.length === 0) return 100;
      const solved = scoped.filter(
        (item) => summary.outcomes.find((o) => o.id === item.id)?.solved,
      ).length;
      return Math.round((solved / scoped.length) * 100);
    };

    const metrics: PeriodicTableMetrics = {
      type: 'periodic-table',
      challengesCorrect: summary.solvedCount,
      challengesTotal: items.length,
      findAccuracy: rate((item) => item.challengeType === 'explore'),
      identifyAccuracy: rate((item) => item.challengeType === 'identify'),
      trendAccuracy: rate((item) => item.challengeType === 'trend'),
      attemptsCount: summary.attemptsCount,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const clearTap = () => { setWrongTapNumber(null); setTappedName(null); };
  const runner = useWorkspaceRunner<PeriodicTableItem>({
    primitiveId: 'periodic-table',
    assignment: periodicTableBoss.assignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: () => { clearTap(); setPractice(null); },
    onCorrectionRetry: clearTap,
    onAffirmed: (item) => {
      const facts = item.kind === 'compare'
        ? item.pair?.find((e) => e.name === item.answerName) ?? null
        : item.element ?? null;
      if (!facts) return;
      const line = item.kind === 'compare'
        ? (item.axis === 'reactivity'
          ? 'The more reactive one in this family.'
          : 'Lower in the column — more shells, bigger atom.')
        : item.kind === 'valence'
          ? `${numberWord(item.answerCount ?? 0)} outer electrons.`
          : null;
      setReveal({ facts, line });
    },
  });
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  const sessionItem = runner.currentItem;
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const leverCtx = useMemo(() => ({ items }), [items]);
  const runtimePulls = sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  /** What is on screen on the session item: the runtime's pulls, plus every help lever on easy (not a pull). */
  const shownLevers = useMemo(
    () => Array.from(new Set([...helpShownFromStart(sessionItem, leverCtx), ...runtimePulls])),
    [sessionItem, leverCtx, runtimePulls],
  );
  // A help lever is drawn only on the session item, never on a practice item.
  const helpOn = (id: string) => !practice && shownLevers.includes(id);
  const lit = sessionItem && helpOn(LETTER_LEVER) ? letterLit(sessionItem) : null;
  const axisOn = helpOn(AXIS_LEVER) && !!sessionItem?.element;
  const shownKey = sessionItem && helpOn(KEY_LEVER) ? boxKey(sessionItem, items) : null;
  const shownColumn = sessionItem && helpOn(COLUMN_LEVER) ? columnModel(sessionItem, items) : null;
  const ringed = helpOn(PAIR_LEVER) && sessionItem?.pair ? sessionItem.pair.map(e => e.number) : undefined;

  // What the tutor and the observer are shown, republished every render. The lever set writes the support and
  // on-screen facts; a practice item carries no levers.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem) return;
    const levers = practice ? [] : PERIODIC_LEVERS.declare(sessionItem, leverCtx, shownLevers);
    const scene: WorkspaceScene = periodicScene(currentItem, tappedName);
    workspace.current = {
      ...leverScene(practice ? { ...scene, facts: { ...scene.facts, practice: PRACTICE_NOTE } } : scene, {
        support: practice ? '' : PERIODIC_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : PERIODIC_LEVERS.onScreen(sessionItem, leverCtx, shownLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...runtimePulls, id] };
        if (lever.kind === 'simplify') {
          const easier = PERIODIC_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!easier) return 'This item is already the plainest of its kind.';
          setLeverState(next); setPractice(easier); clearTap();
          return { practice: periodicTableBoss.assignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full item, blank: the practice item is not the learner's work on it.
      endPractice: () => { setPractice(null); clearTap(); },
    };
  });

  // ── The tap IS the commit (find items only; one tap = one checked attempt) ──
  const handleCellTap = (element: ChemicalElement) => {
    const item = practiceRef.current ?? runner.currentItem;
    if (!item || item.kind !== 'find' || !item.element) return;
    if (!runner.canAttempt || showSummary) return;
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setTappedName(element.name);
    const correct = cellMatches(item, element.number);
    if (!correct) setWrongTapNumber(element.number);
    else if (practiceRef.current) setPracticeSolved(true);
    commitGesture(runner, { response: describeCellTap(element.name), correct, cue: () => '',
      miss: correct ? undefined : periodicMiss(item, element.number) });
  };

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => {
      const meta = MODE_META[item.kind];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [runner.practiceSummary, items]);

  const revealNumbers = useMemo(
    () => (runner.revealHeld && reveal ? [reveal.facts.number]
      : practiceSolved && practice?.element ? [practice.element.number] : []),
    [runner.revealHeld, reveal, practiceSolved, practice],
  );

  const modeMeta = MODE_META[currentItem?.kind ?? 'find'];
  const noopHover = useCallback(() => {}, []);

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title || 'Periodic Table'}</LuminaCardTitle>
          {!showSummary && currentItem && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {/* The table IS the page. No search, no filter chips, no modal: the exploration apparatus would answer
                the asks for the learner. */}
            <PipDock />
            <PipWorkspace className="w-full overflow-x-auto pb-2">
              <PeriodicTableGrid
                elements={ELEMENTS}
                onSelectElement={handleCellTap}
                hoveredCategory={null}
                setHoveredCategory={noopHover}
                revealNumbers={revealNumbers}
                incorrectNumber={wrongTapNumber}
                tapTargets
                litNumbers={lit}
                ringNumbers={ringed}
                markGroup={axisOn ? sessionItem?.element?.group ?? null : null}
                markPeriod={axisOn ? sessionItem?.element?.period ?? null : null}
                rowRanges={helpOn(RANGES_LEVER) ? ROW_RANGES : null}
                dimMiddle={helpOn(TALL_LEVER)}
              />
            </PipWorkspace>

            {practice && <div className="text-center text-xs text-amber-300" data-practice>Practice item</div>}

            {/* `box_key`: another element's box, its three parts labelled. Never this item's box. */}
            {shownKey && (
              <div className="flex justify-center" data-lever="box-key">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-slate-100">
                  <div className="flex flex-col items-center rounded border border-white/20 px-3 py-1">
                    <span className="self-start text-xs font-mono opacity-70">{shownKey.number}</span>
                    <span className="text-xl font-bold">{shownKey.symbol}</span>
                    <span className="text-[10px] opacity-80">{shownKey.name}</span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>top: atomic number</div>
                    <div>big letters: symbol</div>
                    <div>bottom: name</div>
                  </div>
                </div>
              </div>
            )}

            {/* `column_model`: another group's column, each atom a circle of its size. */}
            {shownColumn && (
              <div className="flex justify-center" data-lever="column-model">
                <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2">
                  <div className="text-[10px] text-slate-400">Group {shownColumn.group}</div>
                  {shownColumn.members.map((m) => (
                    <div key={m.name} className="flex items-center gap-2" data-model-atom={m.name}>
                      <span className="w-20 text-right text-xs text-slate-300">{m.name}</span>
                      <span className="rounded-full border border-sky-300/70 bg-sky-400/10"
                        style={{ width: 6 + m.shells * 6, height: 6 + m.shells * 6 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reveal on credit: the element card, while the credit is held (runner.revealHeld). */}
            {runner.revealHeld && reveal && (
              <div className="flex justify-center">
                <div
                  className="flex items-center gap-4 rounded-2xl border-2 px-6 py-3 animate-in fade-in duration-300"
                  style={getCategoryStyle(reveal.facts.category)}
                >
                  <div className="text-center">
                    <div className="text-4xl font-bold tracking-tighter">{reveal.facts.symbol}</div>
                    <div className="text-sm font-medium">{reveal.facts.name}</div>
                  </div>
                  <div className="text-xs opacity-90 space-y-0.5">
                    <div>Element {reveal.facts.number}</div>
                    {reveal.facts.group != null && (
                      <div>Group {reveal.facts.group} · Period {reveal.facts.period}</div>
                    )}
                    <div className="capitalize">{reveal.facts.category}</div>
                    {reveal.line && <div className="font-medium">{reveal.line}</div>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? (evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy)}
            durationMs={evaluation.elapsedMs}
            heading="Periodic Table Complete!"
            celebrationMessage={`You worked the table across ${items.length} rounds!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ============================================================================
// Fork
// ============================================================================

/** Challenges run only on the teaching workspace; an unbound mount shows the "needs the tutor" card. */
const PeriodicTableBound = withWorkspaceOnly<PeriodicTableProps>('periodic-table', PeriodicTableJudged,
  (props) => props.data.title);

/** A payload with an askable challenge is the judged table; anything else is the ungraded exploration table. */
const PeriodicTable: React.FC<PeriodicTableProps> = (props) => {
  // The fork is structural (per payload), so each child keeps its own hook order.
  const askable = useMemo(() => periodicItems(props.data).length > 0, [props.data]);
  return askable ? <PeriodicTableBound {...props} /> : <PeriodicTableExplorer data={props.data} className={props.className} />;
};

export default PeriodicTable;
