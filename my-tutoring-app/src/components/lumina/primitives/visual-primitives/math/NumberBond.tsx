'use client';

/**
 * NumberBond — DI modality. The Live tutor owns the clock in every mode
 * (qa/di/BACKLOG.md item 18 P3-correction; the third MATH port).
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - missing-part (K + 1): the tutor states the bond aloud and asks; the child
 *    SAYS the missing part into an open mic. The −/+ stepper and its Check
 *    button are deleted — a child who cannot find the part can still operate a
 *    stepper, so the stepper was a costume (and a 0…max row is a weak menu).
 *  - decompose (K + 1): the child SPLITS the counters into the two part
 *    circles. One judged turn per pair — "make five with two parts", then
 *    "find a different way" — the same one-pair-at-a-time pacing the click era
 *    ran through its Submit Pair button.
 *  - fact-family (1): the child WRITES all four equations in the boxes. The
 *    page a teacher pushes across the table; form is the skill.
 *  - build-equation (1): the child BUILDS the number sentence from tiles.
 *
 * WHAT CHANGED. Deleted: the stepper and every Check control, the Next
 * control, the ≥2-attempt hint panel, the feedback strings that printed the
 * answer ("Yes! 5 = 3 + 2"), the old tutor hook and all of its improvised
 * turns, and the per-tier reveal clauses that governed them (render-side tier
 * levers — dots, the equation mirror, the worked-example helper — survive
 * untouched). There is no progression timer and no progression control
 * anywhere in this file — progression has exactly one cause: a tutor verdict.
 *
 * HOW A HANDS-ONLY TURN CLOSES. A voice turn closes on SILENCE; a hands turn
 * closes on STILLNESS, with a STRUCTURAL shape shortening the window (a full
 * split; four parseable equations; a finished number sentence) — and no close
 * is correctness-gated: an under-full split, a repeated pair, a wrong fact and
 * a wrong sentence all commit exactly as readily as right ones, which is what
 * gives the tutor something to teach. Settle timers are armed in the tap
 * handlers through refs, never in effects keyed on the runner (its identity
 * churns per audio frame — the ten-frame flash bug).
 *
 * ANSWER-LEAK RULE — INCLUDING IN PIXELS. The missing part renders as "?" until
 * the tutor affirms; the fact-family worked example is code-picked from a
 * triple the current item is NOT (`familyHelperExample`); nothing on screen
 * names an answer before the child has produced it.
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor speaks only scripted lines; no visible timers;
 * tap-to-hear re-speaks the QUESTION; adult chrome hidden for pre-readers.
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
  familyHelperExample,
  familyVerdictCue,
  numberBondPackBase,
  parseBondEquation,
  splitVerdictCue,
  type NumberBondItem,
} from './numberBondScript';
import { numberWordFor } from './countingBoardScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface NumberBondChallenge {
  id: string;
  type: 'decompose' | 'missing-part' | 'fact-family' | 'build-equation';
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
/** Typing four equations is long work with mid-equation pauses. */
const FAMILY_SETTLE_MS = 6000;
/** All four boxes hold a parseable equation — parseable, not correct. */
const FAMILY_COMPLETE_SETTLE_MS = 2000;
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
  const [familyInputs, setFamilyInputs] = useState<string[]>(['', '', '', '']);
  const [equationSlots, setEquationSlots] = useState<string[]>([]);
  const [availableTiles, setAvailableTiles] = useState<string[]>([]);
  /** Post-answer only (answer-leak rule). NOT cleared when the next item opens:
   *  that clear and the `onAffirmed` that set it landed in one React batch, so
   *  the reveal painted on the last item and nowhere else (18b).
   *  `runner.revealHeld` is the gate now. */
  const [reward, setReward] = useState<string | null>(null);
  /** What the workspace held when it last stopped changing. */
  const pendingSplitRef = useRef({ left: 0, right: 0 });
  const pendingFamilyRef = useRef<string[]>(['', '', '', '']);
  const pendingTilesRef = useRef<string[]>([]);
  const prevSourceRef = useRef<string | null>(null);

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
  const items = built.items;

  const pack = useMemo<JudgedScriptPack<NumberBondItem>>(() => ({
    ...numberBondPackBase(items),
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
      switch (item.kind) {
        case 'missing-part':
          return {
            challenge: `missing-part: the whole is ${item.whole}, the shown part is ${item.knownPart}.`,
            expected: `${numberWordFor(item.answer)} (${item.answer})`,
            observed: lastHeard
              ? `Heard "${lastHeard}".`
              : 'The tutor judged the answer wrong from the audio.',
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
            expected: `all four equations over exactly those three numbers`,
            observed: `Wrote "${pendingFamilyRef.current.filter(Boolean).join(' ; ') || 'nothing'}".`,
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
    setLeftCount(0);
    setRightCount(0);
    pendingSplitRef.current = { left: 0, right: 0 };
    setFamilyInputs(['', '', '', '']);
    pendingFamilyRef.current = ['', '', '', ''];
    setEquationSlots([]);
    pendingTilesRef.current = [];
    // The found-pairs ledger spans one CHALLENGE (several decompose items).
    if (item.sourceId !== prevSourceRef.current) {
      prevSourceRef.current = item.sourceId;
      setFoundPairs([]);
    }
    if (item.kind === 'build-equation') {
      setAvailableTiles(seededShuffle(
        [String(item.whole), String(item.knownPart), String(item.otherPart), '+', '-', '='],
        index * 31 + item.whole,
      ));
    } else {
      setAvailableTiles([]);
    }
  }, []);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const itemOf = (id: string) => items.find((i) => i.id === id);
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
      summary.solvedCount === items.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes },
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
      // The first moment an answer may appear on screen.
      if (item.kind === 'decompose') {
        const { left, right } = pendingSplitRef.current;
        const pair: [number, number] = [Math.min(left, right), Math.max(left, right)];
        setFoundPairs((prev) => [...prev, pair]);
        setReward(`${left} + ${right} = ${item.whole}`);
        return;
      }
      if (item.kind === 'missing-part') {
        setReward(`${item.knownPart} + ${item.answer} = ${item.whole}`);
        return;
      }
      if (item.kind === 'build-equation') {
        setReward(pendingTilesRef.current.join(' '));
        return;
      }
      setReward(`${item.knownPart} + ${item.otherPart} = ${item.whole} — the whole family!`);
    },
    onCorrectionRetry: (item) => {
      // The tutor's correction re-modeled and re-asked in-band; restore the
      // working surface for another go. The settle window is re-armed by the
      // runner on this path.
      if (item.kind === 'decompose') {
        setLeftCount(0);
        setRightCount(0);
        pendingSplitRef.current = { left: 0, right: 0 };
        return;
      }
      if (item.kind === 'build-equation') {
        // The tray clears: the tiles are indistinguishable, so there is no
        // "wrong slot" to preserve.
        setEquationSlots([]);
        pendingTilesRef.current = [];
        setAvailableTiles(seededShuffle(
          [String(item.whole), String(item.knownPart), String(item.otherPart), '+', '-', '='],
          item.whole * 7 + 3,
        ));
      }
      // fact-family keeps the child's equations — the correction names the
      // fault and the child EDITS; editing re-arms the close.
    },
  });

  const currentItem = runner.currentItem;
  const currentSolved = runner.currentSolved;
  const kind = currentItem?.kind;
  const whole = currentItem?.whole ?? 0;

  // ── The gesture commits ───────────────────────────────────────────────────
  // No Check control: nothing on screen may carry the child forward. Each
  // close describes the committed artifact; the MATCH IS COMPUTED IN CODE.
  const commitSplit = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'decompose') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const { left, right } = pendingSplitRef.current;
    runner.submitGestureAttempt(splitVerdictCue(item, left, right, foundPairs));
  }, [runner, foundPairs]);

  const commitFamily = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'fact-family') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    runner.submitGestureAttempt(familyVerdictCue(item, pendingFamilyRef.current));
  }, [runner]);

  const commitEquation = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'build-equation') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    if (pendingTilesRef.current.length === 0) return;
    runner.submitGestureAttempt(bondEquationVerdictCue(item, pendingTilesRef.current));
  }, [runner]);

  /** A hands turn closes on stillness; further touches reset the window, and
   *  the runner cancels it at item open, at a correction, and at the commit. */
  const armSplitSettle = useCallback((left: number, right: number) => {
    const item = runner.currentItem;
    pendingSplitRef.current = { left, right };
    const wait = item && left + right === item.whole ? SPLIT_FULL_SETTLE_MS : SPLIT_SETTLE_MS;
    runner.armStillness(commitSplit, wait);
  }, [runner, commitSplit]);

  const armFamilySettle = useCallback((inputs: string[]) => {
    const item = runner.currentItem;
    pendingFamilyRef.current = inputs;
    const complete = !!item
      && inputs.every((s) => s.trim().length > 0
        && parseBondEquation(s, item.whole, item.knownPart, item.otherPart) !== null);
    runner.armStillness(commitFamily, complete ? FAMILY_COMPLETE_SETTLE_MS : FAMILY_SETTLE_MS);
  }, [runner, commitFamily]);

  const armEquationSettle = useCallback((tiles: string[]) => {
    const item = runner.currentItem;
    pendingTilesRef.current = tiles;
    const complete = !!item
      && parseBondEquation(tiles.join(''), item.whole, item.knownPart, item.otherPart) !== null;
    runner.armStillness(commitEquation, complete ? EQUATION_COMPLETE_SETTLE_MS : EQUATION_SETTLE_MS);
  }, [runner, commitEquation]);

  // ── Decompose interactions ────────────────────────────────────────────────
  // NEVER gate interaction on the stage word — `canAttempt` reads the solved
  // ledger (a stage-gated board ships dead from item 2 on; ten-frame drive 1).
  const remaining = whole - leftCount - rightCount;

  const addCounter = useCallback((side: 'left' | 'right') => {
    if (!currentItem || currentItem.kind !== 'decompose') return;
    if (!runner.canAttempt || runner.isAwaitingGesture() || remaining <= 0) return;
    SoundManager.tap();
    const left = leftCount + (side === 'left' ? 1 : 0);
    const right = rightCount + (side === 'right' ? 1 : 0);
    setLeftCount(left);
    setRightCount(right);
    armSplitSettle(left, right);
  }, [currentItem, runner, remaining, leftCount, rightCount, armSplitSettle]);

  const resetCounters = useCallback(() => {
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setLeftCount(0);
    setRightCount(0);
    pendingSplitRef.current = { left: 0, right: 0 };
    // Starting over is thinking, not an answer — nothing to commit, so the
    // window is cleared rather than re-armed (mirrors item-open state).
    runner.clearStillness();
  }, [runner]);

  // ── Fact-family / equation-tray interactions ──────────────────────────────
  const editFamilyInput = useCallback((index: number, value: string) => {
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const next = [...familyInputs];
    next[index] = value;
    setFamilyInputs(next);
    armFamilySettle(next);
  }, [runner, familyInputs, armFamilySettle]);

  const addTile = useCallback((tile: string, tileIndex: number) => {
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setAvailableTiles((prev) => prev.filter((_, i) => i !== tileIndex));
    const next = [...equationSlots, tile];
    setEquationSlots(next);
    armEquationSettle(next);
  }, [runner, equationSlots, armEquationSettle]);

  const removeTile = useCallback((slotIndex: number) => {
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    SoundManager.tap();
    const tile = equationSlots[slotIndex];
    const next = equationSlots.filter((_, i) => i !== slotIndex);
    setEquationSlots(next);
    setAvailableTiles((prev) => [...prev, tile]);
    armEquationSettle(next);
  }, [runner, equationSlots, armEquationSettle]);

  // ── Live equation bar (render lever, unchanged semantics) ─────────────────
  const liveEquation = useMemo(() => {
    if (!currentItem || !showEquation) return null;
    if (currentItem.kind === 'decompose') {
      return `${leftCount || '?'} + ${rightCount || '?'} = ${currentItem.whole}`;
    }
    if (currentItem.kind === 'missing-part') {
      return `${currentItem.knownPart} + ${currentSolved ? currentItem.answer : '?'} = ${currentItem.whole}`;
    }
    return null;
  }, [currentItem, showEquation, leftCount, rightCount, currentSolved]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => (
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
              {kind === 'decompose' && (
                <BondDiagram
                  whole={whole}
                  leftValue={leftCount || '?'}
                  rightValue={rightCount || '?'}
                  showWhole={true}
                  showLeft={leftCount > 0}
                  showRight={rightCount > 0}
                  highlightLeft={remaining > 0}
                  highlightRight={remaining > 0}
                  interactive={remaining > 0 && runner.canAttempt}
                  onDropLeft={() => addCounter('left')}
                  onDropRight={() => addCounter('right')}
                  leftCounters={showCounters ? leftCount : undefined}
                  rightCounters={showCounters ? rightCount : undefined}
                />
              )}
              {kind === 'missing-part' && (
                <BondDiagram
                  whole={whole}
                  leftValue={currentItem.knownPart}
                  rightValue={currentSolved ? currentItem.answer : '?'}
                  showWhole={true}
                  showLeft={true}
                  showRight={currentSolved}
                />
              )}
              {(kind === 'fact-family' || kind === 'build-equation') && (
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

            {/* === Decompose workspace === */}
            {kind === 'decompose' && !currentSolved && (
              <div className="space-y-3">
                <div className="flex justify-center gap-3">
                  <LuminaButton
                    className="bg-red-500/10 border border-red-400/30 hover:bg-red-500/20 text-red-300"
                    onClick={() => addCounter('left')}
                    disabled={remaining <= 0 || !runner.canAttempt}
                  >
                    + Left ({leftCount})
                  </LuminaButton>
                  <LuminaButton
                    className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300"
                    onClick={() => addCounter('right')}
                    disabled={remaining <= 0 || !runner.canAttempt}
                  >
                    + Right ({rightCount})
                  </LuminaButton>
                  <LuminaButton
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
                    onClick={resetCounters}
                    disabled={!runner.canAttempt}
                  >
                    Start over
                  </LuminaButton>
                </div>
              </div>
            )}

            {/* Found pairs — the child's own banked work (kept at every tier). */}
            {kind === 'decompose' && foundPairs.length > 0 && (
              <LuminaPanel className="p-3 bg-slate-800/20">
                <p className="text-slate-400 text-xs mb-2">
                  Ways found: {foundPairs.length} of {currentItem.pairCount}
                </p>
                <div className="flex flex-wrap gap-2">
                  {foundPairs.map((pair, i) => (
                    <LuminaBadge key={i} accent="purple" className="bg-purple-500/15 border-purple-400/30 text-xs">
                      {pair[0]} + {pair[1]}
                    </LuminaBadge>
                  ))}
                </div>
              </LuminaPanel>
            )}

            {/* === Fact-family workspace === */}
            {kind === 'fact-family' && !currentSolved && (
              <div className="space-y-3">
                <p className="text-slate-400 text-sm text-center">
                  Write all 4 equations using{' '}
                  <span className="text-purple-300 font-semibold">{currentItem.knownPart}</span>,{' '}
                  <span className="text-purple-300 font-semibold">{currentItem.otherPart}</span>, and{' '}
                  <span className="text-purple-300 font-semibold">{whole}</span>:
                </p>
                {showFactFamilyHelper && (
                  <FactFamilyHelper
                    triple={familyHelperExample(currentItem)}
                    defaultOpen={supportTier === 'easy'}
                  />
                )}
                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                  {familyInputs.map((val, i) => (
                    <LuminaInput
                      key={i}
                      type="text"
                      placeholder={i < 2 ? '_ + _ = _' : '_ − _ = _'}
                      value={val}
                      onChange={(e) => editFamilyInput(i, e.target.value)}
                      className="w-full text-center text-sm"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* === Build-equation workspace === */}
            {kind === 'build-equation' && !currentSolved && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-1 min-h-[44px] bg-slate-800/30 rounded-lg p-2 border border-white/5">
                  {equationSlots.length === 0 ? (
                    <span className="text-slate-600 text-sm">Tap the tiles to build the number sentence</span>
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
                  ? 'Write the four equations'
                  : kind === 'build-equation'
                    ? 'Build the number sentence'
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
