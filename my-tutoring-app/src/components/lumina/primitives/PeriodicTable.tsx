'use client';

/**
 * PeriodicTable — TWO surfaces, forked on whether challenges arrived:
 *
 *  - EXPLORATION (no challenges — every pre-DI lesson): the free table. Click
 *    a box for the element modal, search, filter by family; the tutor gets
 *    silent [ELEMENT_SELECTED]/[GROUP_TREND] nudges and reacts as a guide.
 *    This surface is the primitive's manifest identity and it survives the
 *    port untouched — the DI conversion must not ablate the reference use.
 *
 *  - JUDGED (challenges present): runs only on the shared tutor/JEV teaching
 *    workspace (workspace rollout C8; the scripted runner was retired, LA-14,
 *    user ruling 09-23: one path). A find is a tap the activity checks; the
 *    other asks are spoken and the observer judges them; the runtime owns
 *    progression. An unbound mount shows the shared "needs the tutor" card.
 *
 * What the judged surface DELETES from the exploration chrome, and why:
 *  - the SEARCH BAR (type "gold", get Au — the whole find/name ask answered);
 *  - the CATEGORY FILTER CHIPS (highlight a family = a free elimination);
 *  - the TAP-TO-OPEN ELEMENT MODAL (shells + valence on screen during a trend
 *    item is the answer in PIXELS — the leak no string scan sees);
 *  - tap-to-hear the question: with the tutor present, the learner asks it to repeat.
 *  The element card returns as the REVEAL, rendered behind `runner.revealHeld`
 *  (18b: set in onAffirmed, never cleared in onItemOpened).
 *
 * Asks, build gates and pools live in `chemistry-primitives/periodicTableScript.ts`;
 * the assignment and scene the tutor receives live in `periodicTableWorkspace.ts`.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, Atom } from 'lucide-react';
import { PeriodicTableData } from '../types';
import { ChemicalElement } from './chemistry-primitives/types';
import { ELEMENTS, getCategoryStyle } from './chemistry-primitives/constants';
import { PeriodicTableGrid } from './chemistry-primitives/PeriodicTableGrid';
import { ElementModal } from './chemistry-primitives/ElementModal';
import { useLuminaAI } from '../hooks/useLuminaAI';
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
import { useStimulusPipSurface } from '../pip/useStimulusPipSurface';
import PhaseSummaryPanel, { type PhaseResult } from '../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../hooks/usePhaseResults';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import type { PeriodicTableMetrics } from '../evaluation/types';
import type { TeachingWorkspace } from '../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../components/live-activity/runtime/useWorkspaceRunner';
import {
  numberWord,
  type ElementFacts,
  type PeriodicKind,
  type PeriodicTableItem,
} from './chemistry-primitives/periodicTableScript';
import { cellMatches, periodicAssignment, periodicItems, periodicMiss, periodicScene } from './chemistry-primitives/periodicTableWorkspace';

interface PeriodicTableProps {
  data: PeriodicTableData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Judged surface (DI modality)
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

  /** Build gates drop what cannot be asked. */
  const items = useMemo<PeriodicTableItem[]>(
    () => periodicItems({ challenges, supportTier }),
    [challenges, supportTier],
  );

  // ── Per-item stage state ───────────────────────────────────────────────────
  /** Wrong tap: the red-ringed box, cleared on retry and item open. */
  const [wrongTapNumber, setWrongTapNumber] = useState<number | null>(null);
  const [tappedName, setTappedName] = useState<string | null>(null);
  /** The reveal payload (18b): set in onAffirmed, rendered behind
   *  `runner.revealHeld`, deliberately NOT cleared in onItemOpened. */
  const [reveal, setReveal] = useState<{ facts: ElementFacts; line: string | null } | null>(null);

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
    assignment: periodicAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: clearTap,
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

  // What the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation; every item is answerable once it opens.
  useLayoutEffect(() => {
    const item = runner.currentItem;
    if (!item) return;
    workspace.current = { ...periodicScene(item, tappedName) };
  });

  const currentItem = runner.currentItem;
  // Pip: the table is the question side and every cell is a possible answer, so
  // Pip outlines the table as a region and watches it after a find tap; it never
  // rings a cell.
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The periodic table', finished: showSummary,
    gesture: currentItem?.kind === 'find',
  });

  // ── The tap IS the commit (find items only; one tap = one checked attempt) ──
  const handleCellTap = (element: ChemicalElement) => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'find' || !item.element) return;
    if (!runner.canAttempt || showSummary) return;
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    pip.look('stimulus');
    setTappedName(element.name);
    const correct = cellMatches(item, element.number);
    if (!correct) setWrongTapNumber(element.number);
    commitGesture(runner, { response: `Tapped ${element.name}'s box.`, correct, cue: () => '',
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
    () => (runner.revealHeld && reveal ? [reveal.facts.number] : []),
    [runner.revealHeld, reveal],
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

            {/* The table IS the page. No search, no filter chips, no modal —
                the exploration apparatus would answer the asks for the child. */}
            {pip.store && <div {...pip.dock} />}
            <div {...pip.target('stimulus')} className="w-full overflow-x-auto pb-2">
              <PeriodicTableGrid
                elements={ELEMENTS}
                onSelectElement={handleCellTap}
                hoveredCategory={null}
                setHoveredCategory={noopHover}
                revealNumbers={revealNumbers}
                incorrectNumber={wrongTapNumber}
                tapTargets
              />
            </div>

            {/* Reveal-on-credit: the element card, while the credit is held
                (runner.revealHeld). */}
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
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
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
// Exploration surface (pre-DI behavior, preserved)
// ============================================================================

const PeriodicTableExplorer: React.FC<PeriodicTableProps> = ({ data, className }) => {
  const [selectedElement, setSelectedElement] = useState<ChemicalElement | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(data.focusCategory || null);
  const [searchTerm, setSearchTerm] = useState('');

  // Track exploration for AI context
  const elementsExploredRef = useRef<Set<number>>(new Set());
  const categoriesExploredRef = useRef<Set<string>>(new Set());
  const groupsExploredRef = useRef<Map<number, string[]>>(new Map());

  const { instanceId, gradeBand } = data;
  const stableInstanceIdRef = useRef(instanceId || `periodic-table-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const filteredElements = useMemo(() => {
    if (!searchTerm) return ELEMENTS;
    const lower = searchTerm.toLowerCase();
    return ELEMENTS.filter(e =>
      e.name.toLowerCase().includes(lower) ||
      e.symbol.toLowerCase().includes(lower) ||
      e.number.toString() === lower
    );
  }, [searchTerm]);

  const categories = Array.from(new Set(ELEMENTS.map(e => e.category)));

  // AI primitive data — the SAME two context keys the judged pack pushes
  // (the catalog tutoring block interpolates challengeType + stimulus only;
  // the rich per-click detail rides the sendText nudges below).
  const aiPrimitiveData = useMemo(() => ({
    challengeType: 'free-exploration',
    stimulus: selectedElement
      ? `${selectedElement.name}'s card is open — element ${selectedElement.number}, a ${selectedElement.category}`
      : 'the full periodic table, open for free exploration',
  }), [selectedElement]);

  const { sendText } = useLuminaAI({
    primitiveType: 'periodic-table',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand,
  });

  // Handle element selection with AI triggers
  const handleSelectElement = useCallback((element: ChemicalElement) => {
    SoundManager.select();
    setSelectedElement(element);

    const isFirstExploration = elementsExploredRef.current.size === 0;
    elementsExploredRef.current.add(element.number);
    categoriesExploredRef.current.add(element.category);
    const explored = elementsExploredRef.current.size;

    // Track group exploration for trend detection
    const group = element.group;
    if (group) {
      const groupElements = groupsExploredRef.current.get(group) || [];
      if (!groupElements.includes(element.name)) {
        groupElements.push(element.name);
        groupsExploredRef.current.set(group, groupElements);
      }
    }

    const valence = element.electron_shells[element.electron_shells.length - 1];

    if (isFirstExploration) {
      // First element click — introduce and encourage exploration
      sendText(
        `[ELEMENT_SELECTED] Student clicked their first element: ${element.name} (${element.symbol}), ` +
        `atomic number ${element.number}, a ${element.category}. ` +
        `It has ${valence} valence electrons and is a ${element.phase.toLowerCase()} at room temperature. ` +
        `Briefly introduce this element and encourage the student to explore more elements, ` +
        `especially others in the same group (column ${element.group}) to discover patterns.`,
        { silent: true }
      );
    } else if (group && (groupsExploredRef.current.get(group)?.length || 0) >= 2) {
      // Student explored 2+ elements in the same group — highlight periodic trend
      const groupMembers = groupsExploredRef.current.get(group)!;
      sendText(
        `[GROUP_TREND] Student clicked ${element.name} (${element.symbol}) in group ${group}. ` +
        `They've now explored ${groupMembers.length} elements in this group: ${groupMembers.join(', ')}. ` +
        `Briefly point out what these elements have in common (similar valence electrons, ` +
        `similar reactivity) and one key trend (e.g., atomic radius increases going down the group).`,
        { silent: true }
      );
    } else if (explored === 10) {
      // Milestone — explored 10 unique elements
      sendText(
        `[EXPLORATION_MILESTONE] Student has now explored 10 unique elements! ` +
        `Just clicked ${element.name} (${element.symbol}). ` +
        `Categories explored: ${Array.from(categoriesExploredRef.current).join(', ')}. ` +
        `Celebrate their curiosity and summarize one interesting pattern they might have noticed.`,
        { silent: true }
      );
    } else {
      // Regular element selection — brief context
      sendText(
        `[ELEMENT_SELECTED] Student clicked ${element.name} (${element.symbol}), ` +
        `atomic number ${element.number}, group ${element.group}, period ${element.period}. ` +
        `Category: ${element.category}. Phase: ${element.phase}. Valence: ${valence}. ` +
        `${explored} elements explored so far. ` +
        `Give a brief, interesting fact about this element or its position in the table.`,
        { silent: true }
      );
    }
  }, [sendText]);

  // Handle category filter click with AI trigger
  const handleCategoryClick = useCallback((cat: string) => {
    const newCategory = hoveredCategory === cat ? (data.focusCategory || null) : cat;
    SoundManager.toggle(newCategory === cat);
    setHoveredCategory(newCategory);

    if (newCategory && newCategory !== hoveredCategory) {
      sendText(
        `[CATEGORY_EXPLORED] Student clicked the "${cat}" category filter, highlighting all ` +
        `${cat} elements on the table. Briefly describe what makes this family of elements special ` +
        `(shared properties, reactivity, common uses). Keep it to 1-2 sentences.`,
        { silent: true }
      );
    }
  }, [hoveredCategory, data.focusCategory, sendText]);

  return (
    <div className={`w-full ${className || ''}`}>
      {/* Title Section */}
      {data.title && (
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-slate-100 mb-2">{data.title}</h3>
          {data.description && (
            <p className="text-slate-400 text-sm leading-relaxed">{data.description}</p>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search by name, symbol, or atomic number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 text-slate-200 text-sm rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent block w-full pl-10 p-2 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Atom size={16} />
          <span>{filteredElements.length} elements</span>
        </div>
      </div>

      {/* Category Legend / Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onMouseEnter={() => setHoveredCategory(cat)}
            onMouseLeave={() => setHoveredCategory(data.focusCategory || null)}
            onClick={() => handleCategoryClick(cat)}
            className={`
              text-[10px] uppercase font-bold px-3 py-1 rounded-full border transition-all
              ${hoveredCategory === cat
                ? 'bg-white text-slate-900 border-white scale-105 shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                : 'bg-slate-900/40 text-slate-500 border-slate-800 hover:border-slate-600'}
            `}
          >
            {cat.replace('unknown, ', '')}
          </button>
        ))}
      </div>

      {/* Periodic Table - Horizontal scroll on mobile */}
      <div className="w-full overflow-x-auto pb-6 custom-scrollbar">
        <PeriodicTableGrid
          elements={filteredElements}
          onSelectElement={handleSelectElement}
          hoveredCategory={hoveredCategory}
          setHoveredCategory={setHoveredCategory}
        />
      </div>

      {/* Element Detail Modal */}
      {selectedElement && (
        <ElementModal
          element={selectedElement}
          allElements={ELEMENTS}
          onClose={() => setSelectedElement(null)}
        />
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 0.8);
        }
        .glass-panel {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
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
