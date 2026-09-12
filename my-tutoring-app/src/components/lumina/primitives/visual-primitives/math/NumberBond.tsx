'use client';

/**
 * Number Bond uses the shared DI runner. Decompose and ten-and-ones expand
 * each source split into a reversible hand construction and one spoken count.
 * Incomplete placements remain exploration; full placements settle into a
 * code-checked attempt, including duplicates and incorrect teen splits.
 * Part numerals/equations are withheld until the spoken interpretation.
 * The remaining modes transform stable counter groups before a spoken or
 * symbolic response. numberBondScript owns source gates and arithmetic
 * contracts; numberBondSplit and numberBondModes own state-dependent phases
 * and logical-outcome aggregation.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  bondEquationVerdictCue,
  buildBondItems,
  factFamilyForms,
  familyHelperExample,
  numberBondPackBase,
  parseBondEquation,
  splitVerdictCue,
  tenAndOnesVerdictCue,
  BOND_TEN,
  type BondModelAction,
  type NumberBondItem,
} from './numberBondScript';
import { numberWordFor } from './countingBoardScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';
import SplitAndSayBoard from './SplitAndSayBoard';
import { hasPair, moveBondCounter, prepareSplit, sortedPair, splitAndSayCue,
  splitAndSayVerdict, splitCounts, splitQuestion, wholeCounters,
  type BondCounters, type BondPlace } from './numberBondSplit';
import {
  bondActionOf,
  countersForAction,
  equationEvidenceFor,
  expandNumberBondInteractions,
  familyEquationVerdictCue,
  groupsForBond,
  initialCountersForInteraction,
  modeActionVerdictCue,
  numberBondInteractionCue,
  numberBondInteractionSummary,
  relatedQuestion,
  type BondActionEvidence,
  type BondEquationEvidence,
} from './numberBondModes';


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
   * it. (Render-side tier lever — survives the judged loop.)
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

const COUNTER_COLORS = {
  left: { fill: '#ef4444' },
  right: { fill: '#3b82f6' },
};

// SVG layout constants
const BOND_WIDTH = 400;
const BOND_HEIGHT = 280;
const WHOLE_CX = BOND_WIDTH / 2;
const WHOLE_CY = 60;
const WHOLE_R = 40;
const PART_R = 35;
const PART_LEFT_CX = BOND_WIDTH / 2 - 100;
const PART_RIGHT_CX = BOND_WIDTH / 2 + 100;
const PART_CY = 200;

/**
 * HOW LONG EACH SHAPE MAY STAY STILL BEFORE IT COMMITS. The window itself is
 * the runner's (`armStillness`, 19c) — these are the per-shape numbers, which
 * genuinely differ: a two-part split is not a four-equation grid.
 * Every one of them is STRUCTURAL, never correctness-gated.
 */
/** A two-part split, placed one counter at a time. */
const SPLIT_SETTLE_MS = 3000;
/** A FULL split (left + right = whole) is a terminal shape; it still waits a
 *  beat rather than committing on the tap — structural, never correctness-
 *  gated (a full DUPLICATE pair commits through this same window and is
 *  corrected). */
const SPLIT_FULL_SETTLE_MS = 1200;
/** The tile tray: five deliberate taps, mid-build pauses are normal. */
const EQUATION_SETTLE_MS = 4500;
/** A finished sentence N op N = N shortens the window ("3 + 2 = 1" is a
 *  complete sentence on its way to "3 + 2 = 10" — never commit on the tap). */
const EQUATION_COMPLETE_SETTLE_MS = 1200;

// ============================================================================
// Sub-components
// ============================================================================

/** The classic number bond diagram (circle + branches). */
function BondDiagram({
  whole,
  leftValue,
  rightValue,
  showWhole,
  showLeft,
  showRight,
  highlightLeft,
  highlightRight,
  leftCounters,
  rightCounters,
  interactive,
  onDropLeft,
  onDropRight,
}: {
  whole: number;
  leftValue: number | string;
  rightValue: number | string;
  showWhole: boolean;
  showLeft: boolean;
  showRight: boolean;
  highlightLeft?: boolean;
  highlightRight?: boolean;
  leftCounters?: number;
  rightCounters?: number;
  interactive?: boolean;
  onDropLeft?: () => void;
  onDropRight?: () => void;
}) {
  return (
    <svg
      width={BOND_WIDTH}
      height={BOND_HEIGHT}
      viewBox={`0 0 ${BOND_WIDTH} ${BOND_HEIGHT}`}
      className="max-w-full h-auto"
    >
      <line
        x1={WHOLE_CX} y1={WHOLE_CY + WHOLE_R}
        x2={PART_LEFT_CX} y2={PART_CY - PART_R}
        stroke="rgba(255,255,255,0.2)" strokeWidth={2.5}
      />
      <line
        x1={WHOLE_CX} y1={WHOLE_CY + WHOLE_R}
        x2={PART_RIGHT_CX} y2={PART_CY - PART_R}
        stroke="rgba(255,255,255,0.2)" strokeWidth={2.5}
      />

      <circle
        cx={WHOLE_CX} cy={WHOLE_CY} r={WHOLE_R}
        fill="rgba(168,85,247,0.15)" stroke="rgba(168,85,247,0.5)" strokeWidth={2}
      />
      <text
        x={WHOLE_CX} y={WHOLE_CY}
        textAnchor="middle" dominantBaseline="central"
        fill={showWhole ? '#e2e8f0' : 'rgba(148,163,184,0.4)'}
        fontSize={28} fontWeight="bold"
        className="select-none"
      >
        {showWhole ? whole : '?'}
      </text>

      <circle
        cx={PART_LEFT_CX} cy={PART_CY} r={PART_R}
        fill={highlightLeft ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)'}
        stroke={highlightLeft ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.3)'}
        strokeWidth={2}
        className={interactive ? 'cursor-pointer' : ''}
        onClick={onDropLeft}
      />
      <text
        x={PART_LEFT_CX} y={PART_CY}
        textAnchor="middle" dominantBaseline="central"
        fill={showLeft ? '#fca5a5' : 'rgba(148,163,184,0.4)'}
        fontSize={24} fontWeight="bold"
        className="select-none"
        style={{ pointerEvents: 'none' }}
      >
        {showLeft ? leftValue : '?'}
      </text>

      <circle
        cx={PART_RIGHT_CX} cy={PART_CY} r={PART_R}
        fill={highlightRight ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)'}
        stroke={highlightRight ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.3)'}
        strokeWidth={2}
        className={interactive ? 'cursor-pointer' : ''}
        onClick={onDropRight}
      />
      <text
        x={PART_RIGHT_CX} y={PART_CY}
        textAnchor="middle" dominantBaseline="central"
        fill={showRight ? '#93c5fd' : 'rgba(148,163,184,0.4)'}
        fontSize={24} fontWeight="bold"
        className="select-none"
        style={{ pointerEvents: 'none' }}
      >
        {showRight ? rightValue : '?'}
      </text>

      {leftCounters !== undefined && leftCounters > 0 && (
        <CounterPips cx={PART_LEFT_CX} cy={PART_CY} count={leftCounters} color={COUNTER_COLORS.left.fill} r={PART_R} />
      )}
      {rightCounters !== undefined && rightCounters > 0 && (
        <CounterPips cx={PART_RIGHT_CX} cy={PART_CY} count={rightCounters} color={COUNTER_COLORS.right.fill} r={PART_R} />
      )}
    </svg>
  );
}

/** Small dots arranged inside a part circle to represent counters. */
function CounterPips({ cx, cy, count, color, r }: {
  cx: number; cy: number; count: number; color: string; r: number;
}) {
  const DOT_R = 4;
  const positions = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    if (count <= 0) return pts;
    const cols = Math.min(count, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / cols);
    const spacing = Math.min((r * 1.2) / Math.max(cols, 1), (r * 1.2) / Math.max(rows, 1));
    const startX = cx - ((cols - 1) * spacing) / 2;
    const startY = cy - ((rows - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      pts.push({ x: startX + col * spacing, y: startY + row * spacing });
    }
    return pts;
  }, [cx, cy, count, r]);

  return (
    <>
      {positions.map((p, i) => (
        <circle
          key={i} cx={p.x} cy={p.y} r={DOT_R}
          fill={color} opacity={0.7}
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </>
  );
}

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

const interactionKeyFor = (item: NumberBondItem): string =>
  `${item.logicalId ?? item.sourceId}${item.familyForm ? `::${item.familyForm}` : ''}`;

// ============================================================================
// Component
// ============================================================================

interface NumberBondProps {
  data: NumberBondData;
  className?: string;
}

const NumberBond: React.FC<NumberBondProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    maxNumber = 10,
    showCounters = true,
    showEquation = true,
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

  // ── Stage-payload state (the runner owns progression; this is the page) ───
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [foundPairs, setFoundPairs] = useState<[number, number][]>([]);
  const [familyRecord, setFamilyRecord] = useState<Array<{ form: string; equation: string; assisted: boolean }>>([]);
  const [missingSupportActive, setMissingSupportActive] = useState(false);
  const [revealedMissing, setRevealedMissing] = useState<{ sourceId: string; whole: number; known: number; answer: number } | null>(null);
  const [equationSlots, setEquationSlots] = useState<string[]>([]);
  const [availableTiles, setAvailableTiles] = useState<string[]>([]);
  /** Post-answer only (answer-leak rule). NOT cleared when the next item opens:
   *  that clear and the `onAffirmed` that set it landed in one React batch, so
   *  the reveal painted on the last item and nowhere else (18b).
   *  `runner.revealHeld` is the gate now. */
  const [reward, setReward] = useState<string | null>(null);
  /** What the workspace held when it last stopped changing. */
  const pendingSplitRef = useRef({ left: 0, right: 0 });
  const pendingTilesRef = useRef<string[]>([]);
  const prevSourceRef = useRef<string | null>(null);
  const [splitCounters, setSplitCounters] = useState<BondCounters>([]);
  const splitCountersRef = useRef<BondCounters>([]);
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
    setLeftCount(left); setRightCount(right); pendingSplitRef.current = { left, right };
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

  // ── The pack: generated challenges → judged items + hand-authored script ──
  // Unaskable items are DROPPED (invalid parts, out-of-range wholes, symbolic
  // modes at K, consecutive duplicates); decompose expands one challenge into
  // one judged turn per pair. Nothing is backfilled.
  const built = useMemo(
    () => buildBondItems(challenges, { band: gradeBand, maxNumber }),
    [challenges, gradeBand, maxNumber],
  );
  const items = useMemo(() => expandNumberBondInteractions(built.items), [built.items]);

  const pack = useMemo<JudgedScriptPack<NumberBondItem>>(() => ({
    ...numberBondPackBase(items),
    itemCue: (item, opts) => item.splitPhase
      ? splitAndSayCue(item, opts, splitCountersRef.current, foundPairsRef.current)
      : item.interactionPhase && item.interactionPhase !== 'missing-infer'
        ? numberBondInteractionCue(item, opts, splitCountersRef.current)
        : numberBondPackBase(items).itemCue(item, opts),
    pronounceCue: (item) => item.splitPhase
      ? '[NS_HEAR] Do not judge anything just heard. ' + splitAndSayCue(item, {}, splitCountersRef.current, foundPairsRef.current)
      : item.interactionPhase && item.interactionPhase !== 'missing-infer'
        ? '[NB_HEAR] Do not judge anything just heard. ' + numberBondInteractionCue(item, {}, splitCountersRef.current)
        : numberBondPackBase(items).pronounceCue!(item),
    moveOnCue: (item, next, opts) => next?.splitPhase
      ? splitAndSayCue(next, opts, splitCountersRef.current, foundPairsRef.current, true)
      : next?.interactionPhase && next.interactionPhase !== 'missing-infer'
        ? numberBondInteractionCue(next, opts, splitCountersRef.current)
        : numberBondPackBase(items).moveOnCue(item, next, opts),
    contextFor: (item) => item.splitPhase ? {
      challengeType: item.kind,
      stimulus: item.splitPhase === 'build' ? 'Move the same counters between the whole and its parts.'
        : 'Say the count in the highlighted part of the split just constructed.',
    } : item.interactionPhase && item.interactionPhase !== 'missing-infer' ? {
      challengeType: item.kind,
      stimulus: item.interactionPhase.includes('say')
        ? 'Answer from the committed counter model.'
        : item.interactionPhase.includes('build')
          ? 'Construct the equation that describes the committed model.'
          : 'Transform the persistent counter groups as directed.',
    } : numberBondPackBase(items).contextFor(item),

    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.answerKind === 'gesture'
        ? 'Listen, then show me on the screen.'
        : 'Listen, then say the missing part out loud.',
      retry: (item) => item.answerKind === 'gesture'
        ? 'Have another go — show me again.'
        : 'Have another go — say your answer.',
      done: 'Great number bond work today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      if (item.splitPhase === 'say') {
        const question = splitQuestion(item, splitCountersRef.current);
        return { challenge: question.ask, expected: String(question.answer), observed: lastHeard ?? 'No intelligible response.' };
      }

      if (item.interactionPhase === 'related-say-addend' || item.interactionPhase === 'related-say-remainder') {
        const question = relatedQuestion(item, splitCountersRef.current);
        return { challenge: question.ask, expected: String(question.answer), observed: lastHeard ?? 'No intelligible response.' };
      }
      if (item.interactionPhase?.endsWith('model') || item.interactionPhase === 'related-join' || item.interactionPhase === 'related-separate') {
        const action = bondActionOf(splitCountersRef.current, groupsForBond(item));
        return { challenge: `Transform the ${item.kind} counter model.`, expected: String(item.bondAction ?? 'one meaningful action'), observed: action ?? 'incomplete model' };
      }

      switch (item.kind) {
        case 'missing-part':
          return {
            challenge: `missing-part: the whole is ${item.whole}, the shown part is ${item.knownPart}.`,
            expected: `${numberWordFor(item.answer)} (${item.answer})`,
            observed: lastHeard
              ? `Heard "${lastHeard}".`
              : 'The tutor judged the answer wrong from the audio.',
          };
        case 'related-fact':
          return {
            challenge: item.pairIndex === 0
              ? `related-fact turn 1 of 2 (addition): ${item.knownPart} and how many more make ${item.whole}?`
              : `related-fact turn 2 of 2 (the related subtraction): ${item.whole} take away ${item.knownPart}.`,
            expected: `${numberWordFor(item.answer)} (${item.answer})`,
            observed: lastHeard
              ? `Heard "${lastHeard}".`
              : 'The tutor judged the answer wrong from the audio.',
          };
        case 'ten-and-ones':
          return {
            challenge: `ten-and-ones: break ${item.whole} into a full ten and the ones left over.`,
            expected: `${BOND_TEN} and ${item.otherPart}`,
            observed: `Split ${pendingSplitRef.current.left} and ${pendingSplitRef.current.right}.`,
          };
        case 'decompose':
          return {
            challenge: `decompose: find a new pair that makes ${item.whole}.`,
            expected: `two parts that make ${item.whole}, not yet found`,
            observed: `Split ${pendingSplitRef.current.left} and ${pendingSplitRef.current.right}.`,
          };
        case 'fact-family':
          return {
            challenge: `fact-family for ${item.knownPart}, ${item.otherPart}, ${item.whole}.`,
            expected: `${factFamilyForms(item.knownPart, item.otherPart).length} distinct equation forms over exactly those three numbers`,
            observed: `Built "${pendingTilesRef.current.join(' ') || 'nothing'}" for ${item.familyForm ?? 'the current move'}.`,
          };
        default:
          return {
            challenge: `build-equation for the bond ${item.knownPart}+${item.otherPart}=${item.whole}.`,
            expected: `any valid number sentence over exactly those three numbers`,
            observed: `Built "${pendingTilesRef.current.join(' ') || 'nothing'}".`,
          };
      }
    },
  }), [items]);

  // ── Per-item reset — every item owns its starting state ───────────────────
  const resetStageFor = useCallback((item: NumberBondItem, index: number) => {
    if (index === 0) {
      prevSourceRef.current = null; previousSplitItem.current = null; foundPairsRef.current = [];
      splitEvidence.current = {}; splitMoves.current = []; setFoundPairs([]);
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
        const prepared = prepareSplit(item, next, foundPairsRef.current);
        next = prepared.counters;
        splitEvidence.current[item.id] = { counters: [...next], modeled: prepared.modeled, affirmed: false };
      }
      publishSplitCounters(next); splitUndo.current = [];
    } else if (item.interactionPhase === 'missing-infer') {
      publishSplitCounters(wholeCounters(item.whole));
      splitUndo.current = [];
      missingEvidence.current[item.logicalId ?? item.id] ??= { support: 'independent', counterMoves: 0 };
    } else if (item.interactionPhase) {
      const isActionPhase = item.interactionPhase.endsWith('model')
        || item.interactionPhase === 'related-join'
        || item.interactionPhase === 'related-separate';
      let next = isActionPhase ? initialCountersForInteraction(item) : splitCountersRef.current;
      const key = interactionKeyFor(item);
      let expected = item.bondAction;
      if (item.interactionPhase === 'equation-build') {
        expected = committedActions.current[key] ?? 'join';
        committedActions.current[key] = expected;
      }
      if (!isActionPhase && expected && bondActionOf(next, groupsForBond(item)) !== expected) {
        const before = [...next];
        next = countersForAction(item, expected);
        actionEvidence.current.push({
          itemId: item.id,
          logicalId: item.logicalId ?? item.sourceId,
          expected,
          committed: expected,
          matched: true,
          modeled: true,
          before,
          after: [...next],
        });
      }
      publishSplitCounters(next);
      splitUndo.current = [];
    } else {
      setLeftCount(0); setRightCount(0); pendingSplitRef.current = { left: 0, right: 0 };
    }
    previousSplitItem.current = item.splitPhase ? item : null;
    setEquationSlots([]);
    pendingTilesRef.current = [];
    // The found-pairs ledger spans one CHALLENGE (several decompose items).
    if (item.sourceId !== prevSourceRef.current) {
      prevSourceRef.current = item.sourceId;
      setFoundPairs([]);
    }
    if (item.interactionPhase === 'equation-build' || item.interactionPhase === 'family-build') {
      setAvailableTiles(seededShuffle(
        [String(item.whole), String(item.knownPart), String(item.otherPart), '+', '-', '='],
        index * 31 + item.whole,
      ));
    } else {
      setAvailableTiles([]);
    }
  }, []);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback((rawSummary: JudgedRunSummary) => {
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
      { interactionVersion: 'number-bond-model-v2', challengeResults: summary.outcomes,
        turnOutcomes: rawSummary.outcomes, splitEvidence: splitEvidence.current, splitMoves: splitMoves.current,
        actionEvidence: actionEvidence.current, equationEvidence: equationEvidence.current,
        missingPartEvidence: missingEvidence.current, assistedRelations: Array.from(assistedRelations.current) },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  const runner = useJudgedScriptRunner<NumberBondItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: resetStageFor,
    onAffirmed: (item) => {
      setRevealedMissing(null);
      if (item.splitPhase) {
        if (item.splitPhase === 'say') {
          bankSplit(item, true);
          const { left, right } = splitCounts(splitCountersRef.current);
          setReward(`${left} + ${right} = ${item.whole}`);
        } else setReward(null); // The hand verdict must not speak or print the coming answer.
        return;
      }

      if (item.interactionPhase?.endsWith('model')
        || item.interactionPhase === 'related-join'
        || item.interactionPhase === 'related-separate') {
        const key = interactionKeyFor(item);
        const committed = bondActionOf(splitCountersRef.current, groupsForBond(item));
        if (committed) committedActions.current[key] = committed;
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
        const action = committedActions.current[key];
        equationEvidence.current.push(equationEvidenceFor(item, pendingTilesRef.current, action, assistedEquations.current.has(key)));
        setReward(pendingTilesRef.current.join(' '));
        return;
      }

      // The first moment an answer may appear on screen.
      if (item.kind === 'decompose') {
        const { left, right } = pendingSplitRef.current;
        const pair: [number, number] = [Math.min(left, right), Math.max(left, right)];
        setFoundPairs((prev) => [...prev, pair]);
        setReward(`${left} + ${right} = ${item.whole}`);
        return;
      }
      if (item.kind === 'ten-and-ones') {
        // The place-value sentence the child just built, in the objective's
        // own form (14 = 10 + 4).
        setReward(`${item.whole} = ${BOND_TEN} + ${item.otherPart}`);
        return;
      }
      if (item.kind === 'missing-part') {
        const key = item.logicalId ?? item.id;
        if (missingEvidence.current[key]?.support !== 'revealed') {
          missingEvidence.current[key] = {
            support: missingSupportActive ? 'counters' : 'independent',
            counterMoves: missingEvidence.current[key]?.counterMoves ?? 0,
          };
        }
        setRevealedMissing({ sourceId: item.sourceId, whole: item.whole, known: item.knownPart, answer: item.answer });
        setReward(`${item.knownPart} + ${item.answer} = ${item.whole}`);
        return;
      }
      // The reward mirrors the FORM the turn asked for, so the two turns of one
      // bond print the two related facts rather than the same sum twice.
      if (item.kind === 'related-fact') {
        setReward(item.pairIndex === 0
          ? `${item.knownPart} + ${item.answer} = ${item.whole}`
          : `${item.whole} − ${item.knownPart} = ${item.answer}`);
        return;
      }
      if (item.kind === 'build-equation') {
        setReward(pendingTilesRef.current.join(' '));
        return;
      }
      setReward(`${item.knownPart} + ${item.otherPart} = ${item.whole} — the whole family!`);
    },
    onCorrectionRetry: (item) => {
      if (item.splitPhase) return; // Keep the student's split available for repair or counting.
      if (item.interactionPhase === 'missing-infer') {
        const key = item.logicalId ?? item.id;
        missingEvidence.current[key] = {
          support: 'revealed',
          counterMoves: missingEvidence.current[key]?.counterMoves ?? 0,
        };
        setRevealedMissing({ sourceId: item.sourceId, whole: item.whole, known: item.knownPart, answer: item.answer });
        return;
      }
      if (item.interactionPhase === 'related-say-addend' || item.interactionPhase === 'related-say-remainder') {
        assistedRelations.current.add(item.logicalId ?? item.id);
        return; // Keep the exact committed transformation visible.
      }
      // The tutor's correction re-modeled and re-asked in-band; restore the
      // working surface for another go. The settle window is re-armed by the
      // runner on this path.
      if (item.kind === 'decompose' || item.kind === 'ten-and-ones') {
        setLeftCount(0);
        setRightCount(0);
        pendingSplitRef.current = { left: 0, right: 0 };
        return;
      }
      if (item.interactionPhase === 'equation-build' || item.interactionPhase === 'family-build') {
        assistedEquations.current.add(interactionKeyFor(item));
        // The tray clears: the tiles are indistinguishable, so there is no
        // "wrong slot" to preserve.
        setEquationSlots([]);
        pendingTilesRef.current = [];
        setAvailableTiles(seededShuffle(
          [String(item.whole), String(item.knownPart), String(item.otherPart), '+', '-', '='],
          item.whole * 7 + 3,
        ));
      }
    },
  });

  const currentItem = runner.currentItem;
  const currentSolved = runner.currentSolved;
  const canSplitMove = currentItem?.splitPhase === 'build' && runner.canAttempt
    && !runner.isAwaitingGesture() && runner.cuedItemId === currentItem.id;
  const isModeAction = !!currentItem && (currentItem.interactionPhase?.endsWith('model')
    || currentItem.interactionPhase === 'related-join'
    || currentItem.interactionPhase === 'related-separate');
  const canModeMove = isModeAction && runner.canAttempt
    && !runner.isAwaitingGesture() && runner.cuedItemId === currentItem?.id;
  const kind = currentItem?.kind;
  const whole = currentItem?.whole ?? 0;

  // ── The gesture commits ───────────────────────────────────────────────────
  // No Check control: nothing on screen may carry the child forward. Each
  // close describes the committed artifact; the MATCH IS COMPUTED IN CODE.
  const commitSplit = useCallback(() => {
    const item = runner.currentItem;
    if (!item || (item.kind !== 'decompose' && item.kind !== 'ten-and-ones')) return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    if (item.splitPhase) {
      if (item.splitPhase !== 'build') return;
      runner.submitGestureAttempt(splitAndSayVerdict(item, splitCountersRef.current, foundPairsRef.current));
      return;
    }
    const { left, right } = pendingSplitRef.current;
    // One gesture, two accept sets: decompose wants a pair it has not banked
    // yet, ten-and-ones wants the one pair that contains a full ten.
    runner.submitGestureAttempt(
      item.kind === 'ten-and-ones'
        ? tenAndOnesVerdictCue(item, left, right)
        : splitVerdictCue(item, left, right, foundPairs),
    );
  }, [runner, foundPairs]);

  const commitModeAction = useCallback(() => {
    const item = runner.currentItem;
    if (!item || !(item.interactionPhase?.endsWith('model')
      || item.interactionPhase === 'related-join'
      || item.interactionPhase === 'related-separate')) return;
    if (!runner.canAttempt || runner.isAwaitingGesture() || runner.cuedItemId !== item.id) return;
    const result = modeActionVerdictCue(item, splitCountersRef.current);
    const key = interactionKeyFor(item);
    if (result.committed && result.matched) {
      committedActions.current[key] = result.committed;
    }
    actionEvidence.current.push({
      itemId: item.id,
      logicalId: item.logicalId ?? item.sourceId,
      expected: item.interactionPhase === 'equation-model' ? 'choice' : item.bondAction ?? 'choice',
      committed: result.committed,
      matched: result.matched,
      modeled: false,
      before: splitUndo.current[0] ? [...splitUndo.current[0]] : initialCountersForInteraction(item),
      after: [...splitCountersRef.current],
    });
    runner.submitGestureAttempt(result.cue);
  }, [runner]);

  const commitEquation = useCallback(() => {
    const item = runner.currentItem;
    if (!item || (item.interactionPhase !== 'equation-build' && item.interactionPhase !== 'family-build')) return;
    if (!runner.canAttempt || runner.isAwaitingGesture() || runner.cuedItemId !== item.id) return;
    if (pendingTilesRef.current.length === 0) return;
    runner.submitGestureAttempt(item.interactionPhase === 'family-build'
      ? familyEquationVerdictCue(item, pendingTilesRef.current)
      : bondEquationVerdictCue(item, pendingTilesRef.current, committedActions.current[interactionKeyFor(item)]));
  }, [runner]);

  /** A hands turn closes on stillness; further touches reset the window, and
   *  the runner cancels it at item open, at a correction, and at the commit. */
  const armSplitSettle = useCallback((left: number, right: number) => {
    if (runner.currentItem?.splitPhase) {
      if (runner.currentItem.splitPhase === 'build' && left + right === runner.currentItem.whole) {
        runner.armStillness(commitSplit, SPLIT_FULL_SETTLE_MS);
      } else runner.clearStillness();
      return;
    }
    const item = runner.currentItem;
    pendingSplitRef.current = { left, right };
    const wait = item && left + right === item.whole ? SPLIT_FULL_SETTLE_MS : SPLIT_SETTLE_MS;
    runner.armStillness(commitSplit, wait);
  }, [runner, commitSplit]);

  const armEquationSettle = useCallback((tiles: string[]) => {
    const item = runner.currentItem;
    pendingTilesRef.current = tiles;
    const complete = !!item
      && parseBondEquation(tiles.join(''), item.whole, item.knownPart, item.otherPart) !== null;
    runner.armStillness(commitEquation, complete ? EQUATION_COMPLETE_SETTLE_MS : EQUATION_SETTLE_MS);
  }, [runner, commitEquation]);

  const armModeSettle = useCallback((next: BondCounters) => {
    const item = runner.currentItem;
    if (!item) return;
    const action = bondActionOf(next, groupsForBond(item));
    if (action) runner.armStillness(commitModeAction, SPLIT_FULL_SETTLE_MS);
    else runner.clearStillness();
  }, [runner, commitModeAction]);

  // ── Decompose interactions ────────────────────────────────────────────────
  const moveSplitCounter = (index: number, destination: BondPlace) => {
    if (currentItem?.splitPhase !== 'build' || !runner.canAttempt || runner.isAwaitingGesture() || runner.cuedItemId !== currentItem.id) return;
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
    const isModel = currentItem.interactionPhase.endsWith('model')
      || currentItem.interactionPhase === 'related-join'
      || currentItem.interactionPhase === 'related-separate';
    if (!isModel && currentItem.interactionPhase !== 'missing-infer') return;
    if (currentItem.interactionPhase === 'missing-infer' && (!missingSupportActive || destination === 'right')) return;
    const next = moveBondCounter(splitCountersRef.current, index, destination);
    if (!next) return;
    splitUndo.current.push([...splitCountersRef.current]);
    splitMoves.current.push({ itemId: currentItem.id, before: [...splitCountersRef.current], after: [...next] });
    publishSplitCounters(next);
    if (currentItem.interactionPhase === 'missing-infer') {
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
  const addTile = useCallback((tile: string, tileIndex: number) => {
    const item = runner.currentItem;
    if (!item || (item.interactionPhase !== 'equation-build' && item.interactionPhase !== 'family-build')
      || !runner.canAttempt || runner.isAwaitingGesture() || runner.cuedItemId !== item.id) return;
    SoundManager.tap();
    setAvailableTiles((prev) => prev.filter((_, i) => i !== tileIndex));
    const next = [...equationSlots, tile];
    setEquationSlots(next);
    armEquationSettle(next);
  }, [runner, equationSlots, armEquationSettle]);

  const removeTile = useCallback((slotIndex: number) => {
    const item = runner.currentItem;
    if (!item || (item.interactionPhase !== 'equation-build' && item.interactionPhase !== 'family-build')
      || !runner.canAttempt || runner.isAwaitingGesture() || runner.cuedItemId !== item.id) return;
    SoundManager.tap();
    const tile = equationSlots[slotIndex];
    const next = equationSlots.filter((_, i) => i !== slotIndex);
    setEquationSlots(next);
    setAvailableTiles((prev) => [...prev, tile]);
    armEquationSettle(next);
  }, [runner, equationSlots, armEquationSettle]);

  const editEquation = useCallback((value: string) => {
    const item = runner.currentItem;
    if (!item || (item.interactionPhase !== 'equation-build' && item.interactionPhase !== 'family-build')
      || !runner.canAttempt || runner.isAwaitingGesture() || runner.cuedItemId !== item.id) return;
    const next = value.match(/\d+|[+\-=−]/g)?.map((token) => token === '−' ? '-' : token) ?? [];
    setEquationSlots(next);
    if (next.length === 0) {
      pendingTilesRef.current = [];
      runner.clearStillness();
    } else {
      armEquationSettle(next);
    }
  }, [runner, armEquationSettle]);

  // ── Live equation bar (render lever, unchanged semantics) ─────────────────
  const liveEquation = useMemo(() => {
    if (!currentItem || !showEquation) return null;
    if (currentItem.splitPhase || currentItem.interactionPhase) return null;
    if (currentItem.kind === 'decompose' || currentItem.kind === 'ten-and-ones') {
      return `${leftCount || '?'} + ${rightCount || '?'} = ${currentItem.whole}`;
    }
    if (currentItem.kind === 'missing-part') {
      return `${currentItem.knownPart} + ${currentSolved ? currentItem.answer : '?'} = ${currentItem.whole}`;
    }
    if (currentItem.kind === 'related-fact') {
      return currentItem.pairIndex === 0
        ? `${currentItem.knownPart} + ${currentSolved ? currentItem.answer : '?'} = ${currentItem.whole}`
        : `${currentItem.whole} − ${currentItem.knownPart} = ${currentSolved ? currentItem.answer : '?'}`;
    }
    return null;
  }, [currentItem, showEquation, leftCount, rightCount, currentSolved]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    const seen = new Set<string>();
    const logicalItems = items.flatMap((item) => {
      const isResult = item.splitPhase !== 'build'
        && !(item.interactionPhase?.endsWith('model'))
        && item.interactionPhase !== 'related-join'
        && item.interactionPhase !== 'related-separate';
      if (!isResult) return [];
      const id = item.interactionPhase === 'family-build' || item.interactionPhase === 'equation-build'
        || item.interactionPhase === 'related-say-addend' || item.interactionPhase === 'related-say-remainder'
        ? item.logicalId ?? item.id
        : item.id;
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ ...item, id }];
    });
    return phaseResultsFromSummary(logicalItems, runner.summary ? numberBondInteractionSummary(items, runner.summary) : runner.summary, (item) => (
      PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' }
    ));
  }, [evaluation.hasSubmitted, runner.summary, items]);

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

  const stageWord = runner.stage === 'judging'
    ? 'let’s see…'
    : currentSolved
      ? 'yes!'
      : runner.running
        ? (isGestureItem ? 'your turn' : 'say it out loud')
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
                <LuminaBadge accent="purple" className="text-xs">Grade 1</LuminaBadge>
                {kind && (
                  <LuminaBadge accent="emerald" className="text-xs">
                    {PHASE_TYPE_CONFIG[kind]?.icon} {PHASE_TYPE_CONFIG[kind]?.label}
                  </LuminaBadge>
                )}
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">
            {isGestureItem ? 'Show me' : 'Say it out loud'}
          </LuminaBadge>
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

            {/* Bond diagram — the missing part stays "?" until the tutor
                affirms (reveal-on-affirm; answer-leak rule). */}
            <div className="flex justify-center">
              {currentItem.splitPhase && <SplitAndSayBoard key={currentItem.sourceId} layoutKey={resolvedInstanceId + '-' + currentItem.sourceId}
                whole={whole} counters={splitCounters} teen={kind === 'ten-and-ones'}
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
                    <div aria-label={revealedMissing?.sourceId === currentItem.sourceId
                      ? `${currentItem.answer} covered counters revealed`
                      : 'Covered part, quantity hidden'}
                      className="flex min-h-36 items-center justify-center rounded-3xl border-2 border-slate-400/50 bg-slate-800/80 p-4">
                      {revealedMissing?.sourceId === currentItem.sourceId
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
              {(kind === 'missing-part' || kind === 'related-fact') && !currentItem.interactionPhase && (
                <BondDiagram
                  whole={whole}
                  leftValue={currentItem.knownPart}
                  rightValue={currentSolved ? currentItem.answer : '?'}
                  showWhole={true}
                  showLeft={true}
                  showRight={currentSolved}
                />
              )}
              {(kind === 'fact-family' || kind === 'build-equation') && !currentItem.interactionPhase && (
                <BondDiagram
                  whole={whole}
                  leftValue={currentItem.knownPart}
                  rightValue={currentItem.otherPart}
                  showWhole={true}
                  showLeft={true}
                  showRight={true}
                />
              )}
            </div>

            {liveEquation && (
              <div className="text-center">
                <span className="inline-block bg-slate-800/50 border border-white/10 rounded-lg px-4 py-2 text-slate-200 text-lg font-mono tracking-wider">
                  {liveEquation}
                </span>
              </div>
            )}

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
              {!missingSupportActive ? <div className="text-center">
                <LuminaButton disabled={!runner.canAttempt} onClick={() => {
                  setMissingSupportActive(true);
                  const key = currentItem.logicalId ?? currentItem.id;
                  missingEvidence.current[key] = {
                    support: missingEvidence.current[key]?.support === 'revealed' ? 'revealed' : 'counters',
                    counterMoves: missingEvidence.current[key]?.counterMoves ?? 0,
                  };
                  SoundManager.tap();
                }}>Use counters</LuminaButton>
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
              <FactFamilyHelper triple={familyHelperExample(currentItem)} defaultOpen={supportTier === 'easy'} />
            )}

            {/* === Shared build-equation / fact-family workspace === */}
            {(currentItem.interactionPhase === 'equation-build' || currentItem.interactionPhase === 'family-build') && !currentSolved && (
              <div className="space-y-3">
                <p className="text-center text-sm text-slate-300">Build the equation for the action shown above.</p>
                <LuminaInput
                  type="text"
                  inputMode="text"
                  aria-label="Equation keyboard entry"
                  placeholder="_ + _ = _"
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

            {/* The reward — the first moment an answer may appear. */}
            {/* Gated on `revealHeld`, never on `currentSolved`: the runner opens
                the next item in the same dispatch, so by the time this renders
                the current item is the NEXT one and is not solved (18b). */}
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
                  ? 'Make the bond match the task — the tutor checks when you stop.'
                  : 'Look at the bond, then say the missing part out loud.'}
              </p>
            )}

            {/* The orb tells the truth about the turn: a hands item is not
                "I'm listening". */}
            <JudgedMicPanel
              run={runner}
              gestureLabel={
                kind === 'fact-family'
                  ? 'Build the matching family equation'
                  : kind === 'build-equation'
                    ? 'Build the number sentence'
                    : kind === 'ten-and-ones'
                      ? 'Show me the ten and the ones'
                      : 'Show me your way'
              }
            />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
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

export default NumberBond;
