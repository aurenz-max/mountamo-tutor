'use client';

/**
 * Number Bond — taught on the shared tutor/JEV workspace (`numberBond.boss.ts`); a mount with no tutor shows the shared
 * "needs the tutor" card (`withWorkspaceOnly`).
 *
 * Each challenge expands into steps on one persistent counter model (`numberBondModes`, `numberBondSplit`):
 *  - decompose / ten-and-ones: the learner SPLITS the counters into two parts, then SAYS how many are in the
 *    highlighted part of the split they built (the say step carries that split as `askedSplit`).
 *  - missing-part: the learner SAYS the covered part; counters are optional support.
 *  - related-fact: the learner joins the groups and says the missing addend, then moves that group out and says the
 *    remainder.
 *  - build-equation / fact-family: the learner makes a move with the groups, then BUILDS the number sentence for it.
 * Incomplete placements are exploration; a full split, a whole-group move or an equation settles on stillness into a
 * code-checked attempt. Part numerals and equations stay off screen until the step is checked right (`revealHeld`).
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaInput,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { NumberBondMetrics } from '../../../evaluation/types';
import type { JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import { useWorkspaceRunner, type TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  bondEquationFaultOf,
  factFamilyForms,
  familyHelperExample,
  parseBondEquation,
  type BondModelAction,
  type NumberBondItem,
} from './numberBondDomain';
import { workspaceScene, type NumberBondView } from './numberBondWorkspace';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary, practiceScore } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';
import SplitAndSayBoard from './SplitAndSayBoard';
import { COUNTERS_LEVER, EQ_FRAME_LEVER, FRAME_LEVER, MOVE_LEVER, NUMBER_BOND_LEVERS, STRIP_LEVER, WAYS_LEVER,
  equationMove, isEquationBuild, isRelatedSay, madeWaysOrder, moveStrip, type NumberBondLeverContext,
  type StripFrame } from './numberBondLevers';
import { hasPair, moveBondCounter, prepareSplit, sortedPair, splitCounts, splitQuestion, validSplit, wholeCounters,
  type BondCounters, type BondPlace } from './numberBondSplit';
import {
  bondActionOf,
  bondMiss,
  countersForAction,
  equationEvidenceFor,
  familyEquationFaultOf,
  groupsForBond,
  initialCountersForInteraction,
  numberBondInteractionSummary,
  type BondActionEvidence,
  type BondEquationEvidence,
} from './numberBondModes';
import { numberBondBoss, numberBondItems } from './numberBond.boss';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';


// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface NumberBondChallenge {
  id: string;
  type: 'decompose' | 'missing-part' | 'related-fact' | 'ten-and-ones' | 'fact-family' | 'build-equation';
  instruction: string;
  whole: number;
  part1?: number | null;
  part2?: number | null;
  allPairs?: [number, number][] | null;
  factFamily?: string[] | null;
  targetEquation?: string | null;
  /** Item-space calibration stamp (bonds-10): never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
}

export interface NumberBondData {
  title: string;
  description?: string;
  challenges: NumberBondChallenge[];
  maxNumber: number;
  showCounters: boolean;
  showEquation: boolean;
  /**
   * Whether the fact-family worked-example helper is shown. Defaults to true
   * when omitted so the no-tier path is unchanged. The hard support tier hides
   * it. (Render-side tier lever.)
   */
  showFactFamilyHelper?: boolean;
  /** Per-component support tier from the manifest ('easy' | 'medium' | 'hard'). */
  supportTier?: 'easy' | 'medium' | 'hard';
  gradeBand: 'K' | '1';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<NumberBondMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  decompose:        { label: 'Decompose',      icon: '🔀' },
  'missing-part':   { label: 'Missing Part',   icon: '❓' },
  'related-fact':   { label: 'Related Facts',  icon: '🔁' },
  'ten-and-ones':   { label: 'Ten and Ones',   icon: '🔟' },
  'fact-family':    { label: 'Fact Family',    icon: '🔄' },
  'build-equation': { label: 'Build Equation', icon: '🧩' },
};

/**
 * HOW LONG EACH SHAPE MAY STAY STILL BEFORE IT COMMITS. The window itself is
 * the runner's (`armStillness`) — these are the per-shape numbers, which
 * genuinely differ: a two-part split is not an equation. Every one of them is
 * STRUCTURAL, never correctness-gated.
 */
/** A FULL split (left + right = whole) or a complete whole-group move is a
 *  terminal shape; it still waits a beat rather than committing on the tap. */
const SPLIT_FULL_SETTLE_MS = 1200;
/** The tile tray: five deliberate taps, mid-build pauses are normal. */
const EQUATION_SETTLE_MS = 4500;
/** A finished sentence N op N = N shortens the window ("3 + 2 = 1" is a
 *  complete sentence on its way to "3 + 2 = 10" — never commit on the tap). */
const EQUATION_COMPLETE_SETTLE_MS = 1200;

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Fact-family worked example — collapsible conceptual explainer. The triple is
 * CODE-PICKED to differ from the current item's bond (`familyHelperExample`):
 * the old hardcoded 2+3=5 was the answer sheet whenever the item was that bond.
 */
function FactFamilyHelper({ triple, defaultOpen = false }: {
  triple: readonly [number, number, number];
  defaultOpen?: boolean;
}) {
  const [a, b, w] = triple;
  const equations = [
    { eq: `${a} + ${b} = ${w}`, tip: 'Start with the two parts. Add them together to get the whole.' },
    { eq: `${b} + ${a} = ${w}`, tip: 'Swap the parts — addition works in any order!' },
    { eq: `${w} − ${a} = ${b}`, tip: 'Start with the whole. Take away one part and the other part is left.' },
    { eq: `${w} − ${b} = ${a}`, tip: 'Same idea — take away the other part instead.' },
  ];
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mx-auto">
          <span>💡</span>
          <span className="underline underline-offset-2 decoration-slate-600">How do fact families work?</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 bg-slate-800/30 rounded-xl p-4 border border-white/5 space-y-3">
          <div className="flex justify-center">
            <svg width={160} height={100} viewBox="0 0 160 100" className="max-w-full h-auto">
              <line x1={80} y1={30} x2={40} y2={75} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
              <line x1={80} y1={30} x2={120} y2={75} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
              <circle cx={80} cy={22} r={18} fill="rgba(168,85,247,0.15)" stroke="rgba(168,85,247,0.4)" strokeWidth={1.5} />
              <text x={80} y={22} textAnchor="middle" dominantBaseline="central" fill="#e2e8f0" fontSize={16} fontWeight="bold" className="select-none">{w}</text>
              <circle cx={40} cy={78} r={16} fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.3)" strokeWidth={1.5} />
              <text x={40} y={78} textAnchor="middle" dominantBaseline="central" fill="#fca5a5" fontSize={14} fontWeight="bold" className="select-none">{a}</text>
              <circle cx={120} cy={78} r={16} fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.3)" strokeWidth={1.5} />
              <text x={120} y={78} textAnchor="middle" dominantBaseline="central" fill="#93c5fd" fontSize={14} fontWeight="bold" className="select-none">{b}</text>
            </svg>
          </div>
          <p className="text-slate-500 text-xs text-center">
            These 3 numbers make <span className="text-slate-300">4 related equations</span>:
          </p>
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
            {equations.map(({ eq, tip }) => (
              <div key={eq} className="group relative">
                <div className="bg-slate-700/30 border border-white/10 rounded-lg px-3 py-1.5 text-center text-sm font-mono text-slate-200 cursor-default hover:bg-slate-700/50 transition-colors">
                  {eq}
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-52 pointer-events-none">
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl text-xs text-slate-300 text-center">
                    {tip}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Deterministic shuffle (seeded LCG) — build-equation tiles must not depend
 *  on render-time randomness. */
function seededShuffle<T>(values: T[], seed: number): T[] {
  const out = [...values];
  let s = (seed * 16807 + 11) % 2147483647;
  const rand = () => { s = (s * 16807) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const tilesFor = (item: NumberBondItem, seed: number) =>
  seededShuffle([String(item.whole), String(item.knownPart), String(item.otherPart), '+', '-', '='], seed);

const interactionKeyFor = (item: NumberBondItem): string =>
  `${item.logicalId ?? item.sourceId}${item.familyForm ? `::${item.familyForm}` : ''}`;

/** A step whose answer is a whole-group move. */
const isMoveStep = (item: NumberBondItem | null | undefined) => !!item && (item.interactionPhase?.endsWith('model')
  || item.interactionPhase === 'related-join' || item.interactionPhase === 'related-separate');

const STRIP_DOT: Record<'red' | 'blue', string> = { red: 'bg-rose-400', blue: 'bg-sky-400' };

/** `move_strip`: the move before and after, as dots in the group colours. No numeral, operator or equals sign. */
function MoveStrip({ frames }: { frames: StripFrame[] }) {
  if (frames.length < 2) return null;
  const dots = (tone: 'red' | 'blue', count: number, key: string) => Array.from({ length: count }, (_, i) =>
    <span key={`${key}-${i}`} aria-hidden="true" className={`h-3 w-3 rounded-full ${STRIP_DOT[tone]}`} />);
  const frame = (f: StripFrame, k: string) => <div className="flex items-center gap-2">
    <div className="flex min-h-8 min-w-10 flex-wrap items-center gap-1 rounded-full border border-white/20 px-2 py-1">
      {dots('red', f.inWhole.red, `${k}w-r`)}{dots('blue', f.inWhole.blue, `${k}w-b`)}
    </div>
    {f.aside.map((g, i) => <div key={i} className="flex flex-wrap gap-1">{dots(g.tone, g.count, `${k}a${i}`)}</div>)}
  </div>;
  return <div data-lever="move-strip" aria-label="The move, before and after, as dots"
    className="flex items-center justify-center gap-3 rounded-lg border border-white/10 bg-slate-800/30 p-2">
    {frame(frames[0], 'b')}<span aria-hidden="true" className="text-slate-400">→</span>{frame(frames[1], 'a')}
  </div>;
}

// ============================================================================
// Component
// ============================================================================

interface NumberBondProps {
  data: NumberBondData;
  className?: string;
  /** Kept for hosts that still pass it; the workspace starts with the lesson. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the mount; selects the teaching workspace inside a live runtime. */
  runtimeEvalMode?: string;
}

const NumberBondSurface = ({ data, className, runtimePlanItemId }: NumberBondProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    maxNumber = 10,
    showFactFamilyHelper = true,
    supportTier,
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const isPreReader = gradeBand === 'K';

  // ── The board (the workspace owns progression) ────────────────────────────
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [foundPairs, setFoundPairs] = useState<[number, number][]>([]);
  const [familyRecord, setFamilyRecord] = useState<Array<{ form: string; equation: string; assisted: boolean }>>([]);
  const [missingSupportActive, setMissingSupportActive] = useState(false);
  const [revealedMissing, setRevealedMissing] = useState<{ sourceId: string; whole: number; known: number; answer: number } | null>(null);
  const [equationSlots, setEquationSlots] = useState<string[]>([]);
  const [availableTiles, setAvailableTiles] = useState<string[]>([]);
  /** Post-answer only (answer-leak rule); `runner.revealHeld` gates it. */
  const [reward, setReward] = useState<string | null>(null);
  /** The split each decompose / ten-and-ones say step asks about, fixed when the step opens. */
  const [askedSplits, setAskedSplits] = useState<Record<string, { left: number; right: number }>>({});
  const pendingTilesRef = useRef<string[]>([]);
  const prevSourceRef = useRef<string | null>(null);
  const [splitCounters, setSplitCounters] = useState<BondCounters>([]);
  const splitCountersRef = useRef<BondCounters>([]);
  // In-item levers, keyed by the session item they were pulled on, and the easier item a simplify lever put on
  // screen in its place. The refs are what event handlers read.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<NumberBondItem | null>(null);
  const practiceRef = useRef<NumberBondItem | null>(null);
  const displayItemRef = useRef<NumberBondItem | null>(null);
  const foundPairsRef = useRef<[number, number][]>([]);
  const previousSplitItem = useRef<NumberBondItem | null>(null);
  const splitEvidence = useRef<Record<string, { counters: BondCounters; modeled: boolean; affirmed: boolean }>>({});
  const splitMoves = useRef<{ itemId: string; before: BondCounters; after: BondCounters }[]>([]);
  const splitUndo = useRef<BondCounters[]>([]);
  const actionEvidence = useRef<BondActionEvidence[]>([]);
  const equationEvidence = useRef<BondEquationEvidence[]>([]);
  const committedActions = useRef<Record<string, BondModelAction>>({});
  const assistedEquations = useRef<Set<string>>(new Set());
  const assistedRelations = useRef<Set<string>>(new Set());
  const missingEvidence = useRef<Record<string, { support: 'independent' | 'counters' | 'revealed'; counterMoves: number }>>({});
  const publishSplitCounters = (next: BondCounters) => {
    splitCountersRef.current = next; setSplitCounters(next);
    const { left, right } = splitCounts(next);
    setLeftCount(left); setRightCount(right);
  };
  const bankSplit = (item: NumberBondItem, affirmed: boolean) => {
    const evidence = splitEvidence.current[item.id];
    if (evidence) evidence.affirmed = affirmed;
    if (item.kind !== 'decompose') return;
    const pair = sortedPair(evidence?.counters ?? splitCountersRef.current);
    if (!hasPair(foundPairsRef.current, pair)) {
      foundPairsRef.current = [...foundPairsRef.current, pair];
      setFoundPairs(foundPairsRef.current);
    }
  };

  const stableInstanceIdRef = useRef(instanceId || `number-bond-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const evaluation = usePrimitiveEvaluation<NumberBondMetrics>({
    primitiveType: 'number-bond',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // The boss's steps: unaskable challenges are DROPPED (invalid parts, out-of-range wholes, symbolic modes at K,
  // consecutive duplicates); each challenge expands into its steps. Nothing is backfilled.
  const items = useMemo(() => numberBondItems({ challenges, gradeBand, maxNumber }), [challenges, gradeBand, maxNumber]);
  // A say step asks about the split on the board when it opened: the item carries it, so its ask and key read it.
  const runItems = useMemo(() => items.map(item => (askedSplits[item.id] ? { ...item, askedSplit: askedSplits[item.id] } : item)),
    [items, askedSplits]);

  // ── Per-item reset — every item owns its starting state ───────────────────
  const resetStageFor = useCallback((item: NumberBondItem, index: number) => {
    if (index === 0) {
      prevSourceRef.current = null; previousSplitItem.current = null; foundPairsRef.current = [];
      splitEvidence.current = {}; splitMoves.current = []; setFoundPairs([]); setAskedSplits({});
      actionEvidence.current = []; equationEvidence.current = []; committedActions.current = {};
      assistedEquations.current = new Set(); assistedRelations.current = new Set(); missingEvidence.current = {}; setFamilyRecord([]);
      setRevealedMissing(null);
    }
    // Bank the constructed pair after its spoken turn, including a coached/capped answer.
    // Credit remains in the outcome ledger; a modeled pair is never called independently solved.
    if (previousSplitItem.current?.splitPhase === 'say') {
      const previous = previousSplitItem.current;
      bankSplit(previous, splitEvidence.current[previous.id]?.affirmed ?? false);
    }
    const changedSource = item.sourceId !== prevSourceRef.current;
    if (changedSource) {
      foundPairsRef.current = []; setFoundPairs([]); setFamilyRecord([]); setMissingSupportActive(false);
    }
    if (item.splitPhase) {
      let next = changedSource ? wholeCounters(item.whole) : splitCountersRef.current;
      if (item.splitPhase === 'say') {
        // A capped build leaves an unfinished split: the step shows a made one instead, attributed to the tutor.
        const prepared = prepareSplit(item, next, foundPairsRef.current);
        next = prepared.counters;
        splitEvidence.current[item.id] = { counters: [...next], modeled: prepared.modeled, affirmed: false };
        const { left, right } = splitCounts(next);
        setAskedSplits(previous => ({ ...previous, [item.id]: { left, right } }));
      }
      publishSplitCounters(next); splitUndo.current = [];
    } else if (item.interactionPhase === 'missing-infer') {
      publishSplitCounters(wholeCounters(item.whole));
      splitUndo.current = [];
      missingEvidence.current[item.logicalId ?? item.id] ??= { support: 'independent', counterMoves: 0 };
    } else if (item.interactionPhase) {
      const moveStep = isMoveStep(item);
      let next = moveStep ? initialCountersForInteraction(item) : splitCountersRef.current;
      const key = interactionKeyFor(item);
      let expected = item.bondAction;
      if (item.interactionPhase === 'equation-build') {
        expected = committedActions.current[key] ?? 'join';
        committedActions.current[key] = expected;
      }
      // A say or equation step asks about the move the step before it made: a move never made is shown, as the tutor's.
      if (!moveStep && expected && bondActionOf(next, groupsForBond(item)) !== expected) {
        const before = [...next];
        next = countersForAction(item, expected);
        actionEvidence.current.push({ itemId: item.id, logicalId: item.logicalId ?? item.sourceId, expected,
          committed: expected, matched: true, modeled: true, before, after: [...next] });
      }
      publishSplitCounters(next);
      splitUndo.current = [];
    }
    previousSplitItem.current = item.splitPhase ? item : null;
    setEquationSlots([]);
    pendingTilesRef.current = [];
    // The found-pairs ledger spans one CHALLENGE (several decompose items).
    if (item.sourceId !== prevSourceRef.current) {
      prevSourceRef.current = item.sourceId;
      setFoundPairs([]);
    }
    setAvailableTiles(isEquationBuild(item) ? tilesFor(item, index * 31 + item.whole) : []);
  }, []);

  // ── The submission, once, from the scored session ─────────────────────────
  const handleFinished = useCallback((finished: TeachingEvaluationResult) => {
    // The workspace record carries the same outcome and evidence fields the aggregator reads.
    const rawSummary = finished as unknown as JudgedRunSummary;
    const summary = numberBondInteractionSummary(items, rawSummary);
    const itemOf = (id: string) => items.find((i) => i.id === id || i.logicalId === id);
    const solvedOf = (kind: NumberBondItem['kind']) =>
      summary.outcomes.filter((o) => itemOf(o.id)?.kind === kind && o.solved).length;

    const metrics: NumberBondMetrics = {
      type: 'number-bond',
      accuracy: summary.accuracy,
      decomposePairsFound: solvedOf('decompose'),
      factFamilyComplete: solvedOf('fact-family') > 0,
      attemptsCount: summary.attemptsCount,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { interactionVersion: 'number-bond-model-v2', challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        turnOutcomes: rawSummary.outcomes, splitEvidence: splitEvidence.current, splitMoves: splitMoves.current,
        actionEvidence: actionEvidence.current, equationEvidence: equationEvidence.current,
        missingPartEvidence: missingEvidence.current, assistedRelations: Array.from(assistedRelations.current),
        teachingAttempts: finished.teachingAttempts, assistanceProvenance: finished.assistanceProvenance },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useWorkspaceRunner<NumberBondItem>({
    primitiveId: 'number-bond',
    assignment: numberBondBoss.assignment,
    items: runItems,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    instanceId: resolvedInstanceId,
    onFinished: handleFinished,
    // A fresh item never carries an easier item over from the last one.
    onItemOpened: (item, index) => { practiceRef.current = null; setPractice(null); resetStageFor(item, index); },
    onAffirmed: (item) => {
      setRevealedMissing(null);
      if (item.splitPhase) {
        if (item.splitPhase === 'say') {
          bankSplit(item, true);
          const { left, right } = splitCounts(splitCountersRef.current);
          setReward(`${left} + ${right} = ${item.whole}`);
        } else setReward(null); // The hand verdict must not print the coming answer.
        return;
      }
      if (isMoveStep(item)) {
        const committed = bondActionOf(splitCountersRef.current, groupsForBond(item));
        if (committed) committedActions.current[interactionKeyFor(item)] = committed;
        setReward(null);
        return;
      }
      if (item.interactionPhase === 'family-build') {
        const equation = pendingTilesRef.current.join(' ');
        const key = interactionKeyFor(item);
        const assisted = assistedEquations.current.has(key);
        equationEvidence.current.push(equationEvidenceFor(item, pendingTilesRef.current, item.bondAction, assisted));
        setFamilyRecord((previous) => previous.some((entry) => entry.form === item.familyForm)
          ? previous
          : [...previous, { form: item.familyForm ?? '', equation, assisted }]);
        setReward(equation);
        return;
      }
      if (item.interactionPhase === 'equation-build') {
        const key = interactionKeyFor(item);
        equationEvidence.current.push(equationEvidenceFor(item, pendingTilesRef.current, committedActions.current[key],
          assistedEquations.current.has(key)));
        setReward(pendingTilesRef.current.join(' '));
        return;
      }
      // The first moment an answer may appear on screen.
      if (item.kind === 'missing-part') {
        const key = item.logicalId ?? item.id;
        if (missingEvidence.current[key]?.support !== 'revealed') {
          missingEvidence.current[key] = { support: trayOpen ? 'counters' : 'independent',
            counterMoves: missingEvidence.current[key]?.counterMoves ?? 0 };
        }
        setRevealedMissing({ sourceId: item.sourceId, whole: item.whole, known: item.knownPart, answer: item.answer });
        setReward(`${item.knownPart} + ${item.answer} = ${item.whole}`);
        return;
      }
      // The reward mirrors the FORM the step asked for, so the two say steps of one bond print the two related facts.
      if (item.kind === 'related-fact') {
        setReward(item.pairIndex === 0
          ? `${item.knownPart} + ${item.answer} = ${item.whole}`
          : `${item.whole} − ${item.knownPart} = ${item.answer}`);
      }
    },
    onCorrectionRetry: (item) => {
      if (item.splitPhase) return; // Keep the learner's split available for repair or counting.
      if (item.interactionPhase === 'missing-infer') {
        const key = item.logicalId ?? item.id;
        missingEvidence.current[key] = { support: 'revealed', counterMoves: missingEvidence.current[key]?.counterMoves ?? 0 };
        setRevealedMissing({ sourceId: item.sourceId, whole: item.whole, known: item.knownPart, answer: item.answer });
        return;
      }
      if (isRelatedSay(item)) {
        assistedRelations.current.add(item.logicalId ?? item.id);
        return; // Keep the exact committed transformation visible.
      }
      if (isEquationBuild(item)) {
        assistedEquations.current.add(interactionKeyFor(item));
        // The tray clears: the tiles are indistinguishable, so there is no "wrong slot" to preserve. A retry on an
        // easier step keeps that step's tiles.
        const shown = practiceRef.current ?? item;
        setEquationSlots([]);
        pendingTilesRef.current = [];
        setAvailableTiles(tilesFor(shown, shown.whole * 7 + 3));
      }
    },
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  displayItemRef.current = currentItem;
  const runtimePulls = leverState.item === sessionItem?.id ? leverState.pulled : [];
  // Easy starts with the equation frame drawn: a starting position, published as pulled, never recorded as a pull.
  const pulledLevers = supportTier === 'easy' && isEquationBuild(sessionItem) && !runtimePulls.includes(EQ_FRAME_LEVER)
    ? [...runtimePulls, EQ_FRAME_LEVER] : runtimePulls;
  /** The move this equation step must describe, for the move strip. */
  const committedMove = sessionItem ? committedActions.current[interactionKeyFor(sessionItem)] : undefined;
  /** missing_part: the counters tray is open, by the learner's button or the lever. */
  const trayOpen = missingSupportActive || pulledLevers.includes(COUNTERS_LEVER);
  const leverCtx: NumberBondLeverContext = { pairsMade: foundPairsRef.current.length, countersOpen: missingSupportActive,
    session: items, committed: committedMove };
  const currentSolved = runner.currentSolved;
  // The workspace cues the session item; its easier stand-in is worked under that cue.
  const canSplitMove = currentItem?.splitPhase === 'build' && runner.canAttempt
    && !runner.isAwaitingGesture() && runner.cuedItemId === sessionItem?.id;
  const isModeAction = isMoveStep(currentItem);
  const canModeMove = isModeAction && runner.canAttempt
    && !runner.isAwaitingGesture() && runner.cuedItemId === currentItem?.id;
  const kind = currentItem?.kind;
  const whole = currentItem?.whole ?? 0;

  // Opening the tray is support on a missing-part step, recorded once it opens (button or lever).
  useEffect(() => {
    if (!trayOpen || sessionItem?.interactionPhase !== 'missing-infer') return;
    const key = sessionItem.logicalId ?? sessionItem.id;
    const was = missingEvidence.current[key];
    missingEvidence.current[key] = { support: was?.support === 'revealed' ? 'revealed' : 'counters', counterMoves: was?.counterMoves ?? 0 };
  }, [trayOpen, sessionItem]);

  // ── The gesture commits ───────────────────────────────────────────────────
  // No Check control: nothing on screen may carry the child forward. Each close describes the committed artifact;
  // the MATCH IS COMPUTED IN CODE.
  const commitSplit = useCallback(() => {
    const item = displayItemRef.current;
    if (item?.splitPhase !== 'build' || !runner.canAttempt || runner.isAwaitingGesture()) return;
    const counters = splitCountersRef.current, found = foundPairsRef.current;
    const { left, right, whole: unplaced } = splitCounts(counters);
    runner.commitGesture({ response: `${left} in one part and ${right} in the other${unplaced ? `, ${unplaced} still in the whole` : ''}`,
      correct: validSplit(item, counters, found), miss: bondMiss(item, { split: { left, right, unplaced }, found }), cue: () => '' });
  }, [runner]);

  const commitModeAction = useCallback(() => {
    const item = runner.currentItem;
    if (!isMoveStep(item) || !runner.canAttempt || runner.isAwaitingGesture() || runner.cuedItemId !== item.id) return;
    const committed = bondActionOf(splitCountersRef.current, groupsForBond(item));
    // build_equation's move is the learner's choice among join and the two take-aways; every other move step names one.
    const expected = item.interactionPhase === 'equation-model' ? null : item.bondAction ?? null;
    const matched = !!committed && (item.interactionPhase === 'equation-model' ? committed !== 'swap' : !expected || committed === expected);
    if (committed && matched) committedActions.current[interactionKeyFor(item)] = committed;
    actionEvidence.current.push({
      itemId: item.id,
      logicalId: item.logicalId ?? item.sourceId,
      expected: item.interactionPhase === 'equation-model' ? 'choice' : item.bondAction ?? 'choice',
      committed,
      matched,
      modeled: false,
      before: splitUndo.current[0] ? [...splitUndo.current[0]] : initialCountersForInteraction(item),
      after: [...splitCountersRef.current],
    });
    runner.commitGesture({ response: committed ? `made the move "${committed}"` : 'no complete whole-group move',
      correct: matched, miss: bondMiss(item, { move: committed, matched }), cue: () => '' });
  }, [runner]);

  const commitEquation = useCallback(() => {
    // The shown item: an easier step a simplify lever opened is checked on its own bond, under the session item's cue.
    const item = practiceRef.current ?? runner.currentItem;
    if (!isEquationBuild(item)) return;
    if (!runner.canAttempt || runner.isAwaitingGesture() || runner.cuedItemId !== runner.currentItem?.id) return;
    if (pendingTilesRef.current.length === 0) return;
    const tiles = pendingTilesRef.current, action = committedActions.current[interactionKeyFor(item)];
    runner.commitGesture({ response: `built "${tiles.join(' ')}"`,
      correct: item.interactionPhase === 'family-build' ? familyEquationFaultOf(item, tiles.join('')) === 'match'
        : bondEquationFaultOf(item, tiles, action) === 'match',
      miss: bondMiss(item, { tiles, action }), cue: () => '' });
  }, [runner]);

  /** A hands turn closes on stillness; further touches reset the window, and the runner cancels it at item open, at
   *  a correction, and at the commit. A split commits only once every counter is in a part. */
  const armSplitSettle = useCallback((left: number, right: number) => {
    const shown = displayItemRef.current;
    if (shown?.splitPhase === 'build' && left + right === shown.whole) runner.armStillness(commitSplit, SPLIT_FULL_SETTLE_MS);
    else runner.clearStillness();
  }, [runner, commitSplit]);

  const armEquationSettle = useCallback((tiles: string[]) => {
    const item = practiceRef.current ?? runner.currentItem;
    pendingTilesRef.current = tiles;
    const complete = !!item
      && parseBondEquation(tiles.join(''), item.whole, item.knownPart, item.otherPart) !== null;
    runner.armStillness(commitEquation, complete ? EQUATION_COMPLETE_SETTLE_MS : EQUATION_SETTLE_MS);
  }, [runner, commitEquation]);

  const armModeSettle = useCallback((next: BondCounters) => {
    const item = runner.currentItem;
    if (!item) return;
    if (bondActionOf(next, groupsForBond(item))) runner.armStillness(commitModeAction, SPLIT_FULL_SETTLE_MS);
    else runner.clearStillness();
  }, [runner, commitModeAction]);

  // ── Counter moves ─────────────────────────────────────────────────────────
  const moveSplitCounter = (index: number, destination: BondPlace) => {
    if (!canSplitMove || !currentItem) return;
    const next = moveBondCounter(splitCountersRef.current, index, destination);
    if (!next) return;
    splitUndo.current.push(splitCountersRef.current);
    splitMoves.current.push({ itemId: currentItem.id, before: splitCountersRef.current, after: next });
    publishSplitCounters(next);
    const { left, right } = splitCounts(next);
    armSplitSettle(left, right); SoundManager.tap();
  };

  const moveModeCounter = (index: number, destination: BondPlace) => {
    if (!currentItem || !currentItem.interactionPhase || !runner.canAttempt
      || runner.isAwaitingGesture() || runner.cuedItemId !== currentItem.id) return;
    const missing = currentItem.interactionPhase === 'missing-infer';
    if (!isMoveStep(currentItem) && !missing) return;
    if (missing && (!trayOpen || destination === 'right')) return;
    const next = moveBondCounter(splitCountersRef.current, index, destination);
    if (!next) return;
    splitUndo.current.push([...splitCountersRef.current]);
    splitMoves.current.push({ itemId: currentItem.id, before: [...splitCountersRef.current], after: [...next] });
    publishSplitCounters(next);
    if (missing) {
      const key = currentItem.logicalId ?? currentItem.id;
      missingEvidence.current[key] = {
        support: missingEvidence.current[key]?.support === 'revealed' ? 'revealed' : 'counters',
        counterMoves: (missingEvidence.current[key]?.counterMoves ?? 0) + 1,
      };
      runner.clearStillness();
    } else {
      armModeSettle(next);
    }
    SoundManager.tap();
  };

  const moveWholeGroup = (action: BondModelAction) => {
    if (!currentItem || !canModeMove) return;
    const before = [...splitCountersRef.current];
    const next = countersForAction(currentItem, action);
    splitUndo.current.push(before);
    splitMoves.current.push({ itemId: currentItem.id, before, after: [...next] });
    publishSplitCounters(next);
    armModeSettle(next);
    SoundManager.tap();
  };

  // ── Shared equation workspace ─────────────────────────────────────────────
  const canBuild = (item: NumberBondItem | null): item is NumberBondItem => isEquationBuild(item)
    && runner.canAttempt && !runner.isAwaitingGesture() && runner.cuedItemId === runner.currentItem?.id;

  const addTile = useCallback((tile: string, tileIndex: number) => {
    if (!canBuild(practiceRef.current ?? runner.currentItem)) return;
    SoundManager.tap();
    setAvailableTiles((prev) => prev.filter((_, i) => i !== tileIndex));
    const next = [...equationSlots, tile];
    setEquationSlots(next);
    armEquationSettle(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, equationSlots, armEquationSettle]);

  const removeTile = useCallback((slotIndex: number) => {
    if (!canBuild(practiceRef.current ?? runner.currentItem)) return;
    SoundManager.tap();
    const tile = equationSlots[slotIndex];
    const next = equationSlots.filter((_, i) => i !== slotIndex);
    setEquationSlots(next);
    setAvailableTiles((prev) => [...prev, tile]);
    armEquationSettle(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, equationSlots, armEquationSettle]);

  const editEquation = useCallback((value: string) => {
    if (!canBuild(practiceRef.current ?? runner.currentItem)) return;
    const next = value.match(/\d+|[+\-=−]/g)?.map((token) => token === '−' ? '-' : token) ?? [];
    setEquationSlots(next);
    if (next.length === 0) {
      pendingTilesRef.current = [];
      runner.clearStillness();
    } else {
      armEquationSettle(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, armEquationSettle]);

  // ── The scene and the levers, republished after every render ──────────────
  const view = (): NumberBondView => ({ counters: splitCountersRef.current, found: foundPairsRef.current, tiles: equationSlots });
  /** An easier item a simplify lever opened: its own board, its own tiles. */
  const openPractice = (easier: NumberBondItem) => {
    practiceRef.current = easier; setPractice(easier);
    publishSplitCounters(isEquationBuild(easier) && easier.bondAction ? countersForAction(easier, easier.bondAction)
      : wholeCounters(easier.whole));
    splitUndo.current = []; runner.clearStillness();
    setEquationSlots([]); pendingTilesRef.current = [];
    setAvailableTiles(isEquationBuild(easier) ? tilesFor(easier, easier.whole * 11 + 5) : []);
  };
  useLayoutEffect(() => {
    if (!currentItem) return;
    const levers = practice ? [] : NUMBER_BOND_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    workspace.current = {
      ...leverScene(workspaceScene(currentItem, view()), {
        support: practice ? '' : NUMBER_BOND_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : NUMBER_BOND_LEVERS.onScreen(sessionItem, leverCtx, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the board changes before this returns.
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !sessionItem || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        const pulled = { item: sessionItem.id, pulled: [...runtimePulls, id] };
        if (lever.kind === 'simplify') {
          const easier = NUMBER_BOND_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState(pulled);
          openPractice(easier);
          return { practice: numberBondBoss.assignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      // Back to the full item: its board opens whole again, or with its own move, its own tiles and an empty entry.
      endPractice: () => {
        practiceRef.current = null; setPractice(null);
        if (sessionItem?.splitPhase) { publishSplitCounters(wholeCounters(sessionItem.whole)); splitUndo.current = []; }
        const move = equationMove(sessionItem, committedMove);
        if (sessionItem && isEquationBuild(sessionItem) && move) {
          publishSplitCounters(countersForAction(sessionItem, move)); splitUndo.current = [];
          setEquationSlots([]); pendingTilesRef.current = [];
          setAvailableTiles(tilesFor(sessionItem, sessionItem.whole * 7 + 3));
        }
      },
    };
  });

  // ── Phase summary ─────────────────────────────────────────────────────────
  // The workspace shows its summary without an evaluation provider (the live host has none).
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;
  const finishedSummary = (runner.practiceSummary as unknown as JudgedRunSummary | null | undefined) ?? null;
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!showSummary) return [];
    const seen = new Set<string>();
    const logicalItems = items.flatMap((item) => {
      if (item.splitPhase === 'build' || isMoveStep(item)) return [];
      const id = isEquationBuild(item) || isRelatedSay(item) ? item.logicalId ?? item.id : item.id;
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ ...item, id }];
    });
    return phaseResultsFromSummary(logicalItems, finishedSummary ? numberBondInteractionSummary(items, finishedSummary) : null, (item) => (
      PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' }
    ));
  }, [showSummary, finishedSummary, items]);

  const celebrationMessage = useMemo(() => {
    const spoken = items.some((i) => i.answerKind === 'voice');
    const hands = items.some((i) => i.answerKind === 'gesture');
    if (spoken && hands) return 'You worked with your voice and your hands!';
    if (spoken) return 'You said every missing part out loud!';
    return 'You built every bond with your own hands!';
  }, [items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No number bond challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const isGestureItem = currentItem?.answerKind === 'gesture';
  const stageWord = currentSolved ? 'yes!' : runner.running ? (isGestureItem ? 'your turn' : 'say it out loud') : 'get ready';
  const coveredShown = revealedMissing?.sourceId === currentItem?.sourceId;

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade / mode badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge accent="purple" className="text-xs">Grade 1</LuminaBadge>
                {kind && (
                  <LuminaBadge accent="emerald" className="text-xs">
                    {PHASE_TYPE_CONFIG[kind]?.icon} {PHASE_TYPE_CONFIG[kind]?.label}
                  </LuminaBadge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
            <LuminaBadge accent="cyan" className="text-xs">
              {isGestureItem ? 'Show me' : 'Say it out loud'}
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

            <PipDock />
            {/* Pip outlines the board and its answer controls as a whole, never one counter. */}
            <PipWorkspace className="space-y-4">
            {/* The bond board — the missing part stays covered until the step is checked right (answer-leak rule). */}
            <div data-pip-object="board" className="flex justify-center">
              {currentItem.splitPhase && <SplitAndSayBoard key={currentItem.sourceId} layoutKey={resolvedInstanceId + '-' + currentItem.sourceId}
                whole={whole} counters={splitCounters} teen={kind === 'ten-and-ones'}
                frame={pulledLevers.includes(FRAME_LEVER) && (kind === 'ten-and-ones' || currentItem.splitPhase === 'say')}
                canMove={canSplitMove}
                onMove={moveSplitCounter}
                answerSide={currentItem.splitPhase === 'say' ? splitQuestion(currentItem, splitCounters).answerSide : undefined} />}
              {currentItem.interactionPhase && currentItem.interactionPhase !== 'missing-infer' && (
                <SplitAndSayBoard
                  key={`${currentItem.sourceId}-${currentItem.interactionPhase}-${currentItem.familyForm ?? ''}`}
                  layoutKey={`${resolvedInstanceId}-${currentItem.sourceId}-persistent`}
                  whole={whole}
                  counters={splitCounters}
                  groups={groupsForBond(currentItem)}
                  teen={false}
                  frame={pulledLevers.includes(FRAME_LEVER) && isRelatedSay(currentItem) ? 'whole' : undefined}
                  canMove={canModeMove}
                  onMove={moveModeCounter}
                  answerGroup={currentItem.interactionPhase === 'related-say-addend'
                    ? 'right'
                    : currentItem.interactionPhase === 'related-say-remainder' ? 'left' : undefined}
                  hint={isModeAction
                    ? 'Keep each colored group together as you transform the model.'
                    : currentItem.interactionPhase.includes('build')
                      ? 'Use the same model to build its equation.'
                      : 'The highlighted counters are the quantity to say.'}
                />
              )}
              {currentItem.interactionPhase === 'missing-infer' && (
                <section aria-label="Missing part model" className="w-full max-w-lg space-y-4">
                  <div className="mx-auto w-28 rounded-3xl border-2 border-purple-300/50 bg-purple-500/10 p-4 text-center">
                    <p className="text-xs uppercase tracking-wider text-purple-200">Whole</p>
                    <p className="text-3xl font-black text-white">{whole}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-h-36 rounded-3xl border-2 border-rose-300/40 bg-rose-500/10 p-4 text-center">
                      <p className="font-semibold text-rose-100">Known part: {currentItem.knownPart}</p>
                      <div aria-label={`${currentItem.knownPart} visible counters`} className="mt-3 flex flex-wrap justify-center gap-1">
                        {Array.from({ length: currentItem.knownPart }, (_, index) => (
                          <span key={index} aria-hidden="true" className="h-7 w-7 rounded-full bg-rose-300" />
                        ))}
                      </div>
                    </div>
                    <div aria-label={coveredShown ? `${currentItem.answer} covered counters revealed` : 'Covered part, quantity hidden'}
                      className="flex min-h-36 items-center justify-center rounded-3xl border-2 border-slate-400/50 bg-slate-800/80 p-4">
                      {coveredShown
                        ? <div className="flex flex-wrap justify-center gap-1">
                          {Array.from({ length: currentItem.answer }, (_, index) => (
                            <span key={index} aria-hidden="true" className="h-7 w-7 rounded-full bg-sky-300" />
                          ))}
                        </div>
                        : <span className="text-center font-semibold text-slate-200">Covered part</span>}
                    </div>
                  </div>
                </section>
              )}
            </div>

            {currentItem.splitPhase === 'build' && <div className="flex justify-center gap-3">
              <LuminaButton disabled={!canSplitMove || !splitUndo.current.length}
                onClick={() => {
                  if (!canSplitMove) return;
                  const next = splitUndo.current.pop();
                  if (next) { splitMoves.current.push({ itemId: currentItem.id, before: splitCountersRef.current, after: next }); publishSplitCounters(next); const counts = splitCounts(next); armSplitSettle(counts.left, counts.right); }
                }}>Undo</LuminaButton>
              <LuminaButton disabled={!canSplitMove}
                onClick={() => {
                  if (!canSplitMove) return;
                  splitUndo.current.push(splitCountersRef.current);
                  const next = wholeCounters(whole);
                  splitMoves.current.push({ itemId: currentItem.id, before: splitCountersRef.current, after: next });
                  publishSplitCounters(next); runner.clearStillness();
                }}>Bring back together</LuminaButton>
            </div>}
            {isModeAction && <div className="flex flex-wrap justify-center gap-3">
              {currentItem.interactionPhase === 'equation-model' ? <>
                <LuminaButton disabled={!canModeMove} onClick={() => moveWholeGroup('join')}>Join the groups</LuminaButton>
                <LuminaButton disabled={!canModeMove} onClick={() => moveWholeGroup('separate-left')}>Take away red</LuminaButton>
                <LuminaButton disabled={!canModeMove} onClick={() => moveWholeGroup('separate-right')}>Take away blue</LuminaButton>
              </> : <LuminaButton disabled={!canModeMove || !currentItem.bondAction}
                data-lever={pulledLevers.includes(MOVE_LEVER) ? 'show-move' : undefined}
                className={pulledLevers.includes(MOVE_LEVER) ? 'ring-4 ring-amber-300/70' : undefined}
                onClick={() => currentItem.bondAction && moveWholeGroup(currentItem.bondAction)}>
                {currentItem.bondAction === 'join' ? 'Join the groups'
                  : currentItem.bondAction === 'swap' ? 'Swap the groups'
                    : currentItem.bondAction === 'separate-left' ? 'Move red group away' : 'Move blue group away'}
              </LuminaButton>}
              <LuminaButton disabled={!canModeMove || !splitUndo.current.length} onClick={() => {
                if (!canModeMove) return;
                const next = splitUndo.current.pop();
                if (!next) return;
                splitMoves.current.push({ itemId: currentItem.id, before: [...splitCountersRef.current], after: [...next] });
                publishSplitCounters(next);
                armModeSettle(next);
              }}>Undo</LuminaButton>
            </div>}
            {currentItem.splitPhase === 'say' && splitEvidence.current[currentItem.id]?.modeled
              && <p className="text-center text-amber-200">Tutor's example</p>}

            {currentItem.interactionPhase === 'missing-infer' && <div className="space-y-3">
              {!trayOpen ? <div className="text-center">
                <LuminaButton disabled={!runner.canAttempt} onClick={() => { setMissingSupportActive(true); SoundManager.tap(); }}>
                  Use counters
                </LuminaButton>
                {supportTier === 'easy' && <p className="mt-2 text-sm text-slate-400">You can set aside the known part and inspect what remains.</p>}
              </div> : <SplitAndSayBoard
                whole={whole}
                counters={splitCounters}
                teen={false}
                layoutKey={`${resolvedInstanceId}-${currentItem.sourceId}-missing-support`}
                canMove={runner.canAttempt && runner.cuedItemId === currentItem.id && !runner.isAwaitingGesture()}
                onMove={moveModeCounter}
                allowedPlaces={['whole', 'left']}
                hint={`Set aside the known ${currentItem.knownPart}. The counters that remain help you reason about the covered part.`}
              />}
            </div>}

            {/* Found pairs — the child's own banked work (kept at every tier). */}
            {kind === 'decompose' && foundPairs.length > 0 && (
              <LuminaPanel className="p-3 bg-slate-800/20">
                <p className="text-slate-400 text-xs mb-2">
                  Ways found: {foundPairs.length} of {currentItem.pairCount}
                </p>
                <div className="flex flex-wrap gap-2">
                  {foundPairs.map((pair, i) => {
                    const assisted = items.some((entry) => {
                      const evidence = splitEvidence.current[entry.id];
                      return entry.sourceId === currentItem.sourceId && evidence
                        && hasPair([sortedPair(evidence.counters)], pair) && (evidence.modeled || !evidence.affirmed);
                    });
                    return <LuminaBadge key={i} accent="purple" className="bg-purple-500/15 border-purple-400/30 text-xs">
                      {pair[0]} + {pair[1]}{assisted ? ' (with help)' : ''}
                    </LuminaBadge>;
                  })}
                </div>
              </LuminaPanel>
            )}

            {/* made_ways lever: the learner's own ways as dot pictures, in the order made; the one on the board now glows. */}
            {kind === 'decompose' && pulledLevers.includes(WAYS_LEVER) && foundPairs.length > 0 && (
              <div data-lever="made-ways" className="flex flex-wrap justify-center gap-3">
                {madeWaysOrder(foundPairs).map(([a, b], i) => {
                  const shown = [leftCount, rightCount].sort((x, y) => x - y);
                  const onBoard = shown[0] === Math.min(a, b) && shown[1] === Math.max(a, b);
                  return <div key={i} data-way={onBoard ? 'on-board' : 'made'}
                    className={`flex items-center gap-2 rounded-xl border px-2 py-1 ${onBoard ? 'border-amber-300 bg-amber-400/10' : 'border-white/15'}`}>
                    <span className="flex gap-0.5">{Array.from({ length: a }, (_, k) => <span key={k} className="h-2.5 w-2.5 rounded-full bg-rose-300" />)}</span>
                    <span className="flex gap-0.5">{Array.from({ length: b }, (_, k) => <span key={k} className="h-2.5 w-2.5 rounded-full bg-cyan-300" />)}</span>
                  </div>;
                })}
              </div>
            )}

            {kind === 'fact-family' && familyRecord.length > 0 && (
              <LuminaPanel className="p-3">
                <p className="mb-2 text-center text-xs uppercase tracking-wider text-slate-400">
                  Family record: {familyRecord.length} of {factFamilyForms(currentItem.knownPart, currentItem.otherPart).length}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {familyRecord.map((entry) => <LuminaBadge key={entry.form} accent="purple" className="font-mono">
                    {entry.equation}{entry.assisted ? ' (with help)' : ''}
                  </LuminaBadge>)}
                </div>
              </LuminaPanel>
            )}

            {kind === 'fact-family' && currentItem.interactionPhase === 'family-model' && showFactFamilyHelper && (
              <FactFamilyHelper triple={familyHelperExample(currentItem, items)} defaultOpen={supportTier === 'easy'} />
            )}

            {/* === Shared build-equation / fact-family workspace === */}
            {isEquationBuild(currentItem) && !currentSolved && (
              <div className="space-y-3">
                <p className="text-center text-sm text-slate-300">Build the equation for the action shown above.</p>
                {pulledLevers.includes(STRIP_LEVER) && <MoveStrip frames={moveStrip(currentItem, equationMove(currentItem, practice ? undefined : committedMove))} />}
                {pulledLevers.includes(EQ_FRAME_LEVER) && (
                  // Slot shapes only: no tile, number or operator in any of them (contract R12).
                  <div data-lever="equation-frame" aria-label="Equation slots: a number, a sign, a number, equals, a number"
                    className="flex items-center justify-center gap-2">
                    <span aria-hidden="true" className="h-9 w-9 rounded-md border-2 border-dashed border-cyan-300/60" />
                    <span aria-hidden="true" className="h-8 w-8 rounded-full border-2 border-dashed border-amber-300/60" />
                    <span aria-hidden="true" className="h-9 w-9 rounded-md border-2 border-dashed border-cyan-300/60" />
                    <span aria-hidden="true" className="text-xl font-bold text-slate-300">=</span>
                    <span aria-hidden="true" className="h-9 w-9 rounded-md border-2 border-dashed border-cyan-300/60" />
                  </div>
                )}
                <LuminaInput
                  type="text"
                  inputMode="text"
                  aria-label="Equation keyboard entry"
                  // No operator or number before a try: choosing + or − is part of the answer (contract R12).
                  placeholder="Type the number sentence"
                  value={equationSlots.join(' ')}
                  onChange={(event) => editEquation(event.target.value)}
                  className="mx-auto max-w-sm text-center font-mono text-lg"
                />
                <div className="flex items-center justify-center gap-1 min-h-[44px] bg-slate-800/30 rounded-lg p-2 border border-white/5">
                  {equationSlots.length === 0 ? (
                    <span className="text-slate-600 text-sm">Type above or tap the tiles</span>
                  ) : (
                    equationSlots.map((tile, i) => (
                      <LuminaButton
                        key={i}
                        className="bg-purple-500/20 border border-purple-400/30 text-purple-200 text-lg font-mono h-9 w-9 p-0 hover:bg-red-500/20 hover:border-red-400/30"
                        onClick={() => removeTile(i)}
                        title="Tap to remove"
                      >
                        {tile}
                      </LuminaButton>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-1">
                  {availableTiles.map((tile, i) => (
                    <LuminaButton
                      key={`${tile}-${i}`}
                      className="text-slate-200 text-sm font-mono h-8 w-8 p-0"
                      onClick={() => addTile(tile, i)}
                    >
                      {tile}
                    </LuminaButton>
                  ))}
                </div>
              </div>
            )}
            </PipWorkspace>

            {/* The reward — the first moment an answer may appear. Gated on `revealHeld`, never on `currentSolved`:
                the next item opens in the same dispatch. */}
            {reward && runner.revealHeld && (
              <LuminaPanel className="p-3 text-center">
                <span className="text-emerald-300 text-lg font-black animate-bounce inline-block font-mono">
                  {reward}
                </span>
                {revealedMissing && (
                  <div aria-label={`${revealedMissing.answer} revealed counters joining the known part`}
                    className="mt-3 flex flex-wrap items-center justify-center gap-1">
                    {Array.from({ length: revealedMissing.known }, (_, index) => (
                      <span key={`known-${index}`} aria-hidden="true" className="h-6 w-6 rounded-full bg-rose-300" />
                    ))}
                    <span aria-hidden="true" className="mx-1 text-slate-300">+</span>
                    {Array.from({ length: revealedMissing.answer }, (_, index) => (
                      <span key={`answer-${index}`} aria-hidden="true" className="h-6 w-6 rounded-full bg-sky-300" />
                    ))}
                    <span className="ml-2 text-sm text-slate-300">join to make {revealedMissing.whole}</span>
                  </div>
                )}
              </LuminaPanel>
            )}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                {isGestureItem
                  ? 'Make the bond match the task — the board checks when you stop.'
                  : 'Look at the bond, then say the missing part out loud.'}
              </p>
            )}
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Number Bonds Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// One path: the tutor teaches on the workspace; a mount with no tutor shows the shared "needs the tutor" card.
const NumberBond = withWorkspaceOnly<NumberBondProps>('number-bond', NumberBondSurface, props => props.data.title);

export default NumberBond;
