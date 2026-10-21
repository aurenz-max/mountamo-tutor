'use client';

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaButton,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaInput,
} from '../../../ui';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { MultiplicationExplorerMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  askFor, askedSlot, describeAnswer, distributiveSplit, equationText, explorerItems, hintFor, modelShown,
  multiplicationAnswerCorrect, multiplicationMiss, resolveChallengeFact, workspaceScene, type ExplorerView,
} from './multiplicationExplorerWorkspace';
import {
  BREAK_APART_LEVER, MULTIPLICATION_LEVERS, SHOW_MODEL_LEVER, SKIP_LINE_LEVER, SKIP_STRIP_LEVER, skipLine, skipStripTotals,
} from './multiplicationExplorerLevers';
import { multiplicationExplorerBoss } from './multiplicationExplorer.boss';

// =============================================================================
// Data Interface (Single Source of Truth)
// =============================================================================

export type MultiplicationRepresentation =
  | 'groups'
  | 'array'
  | 'repeated_addition'
  | 'number_line'
  | 'area_model'
  | 'all';

export interface MultiplicationExplorerChallenge {
  id: string;
  type: 'build' | 'connect' | 'commutative' | 'distributive' | 'missing_factor' | 'fluency';
  instruction: string;
  targetFact: string; // e.g., '3 × 4 = 12'
  hiddenValue: 'factor1' | 'factor2' | 'product' | null;
  timeLimit: number | null; // seconds, for fluency mode
  hint: string;
  narration: string;

  /**
   * This challenge's OWN fact — the structured form of `targetFact`, stamped by
   * the generator from a code-owned pool so a session is N DIFFERENT facts rather
   * than one fact asked N ways. Preferred over parsing `targetFact`; absent on
   * pre-redesign data, which still parses (see resolveChallengeFact).
   */
  fact?: { factor1: number; factor2: number };

  /**
   * The modality THIS challenge is seen through. One representation per challenge
   * is what makes a session cover the modalities rather than re-showing one fact
   * in every panel. 'all' shows the five side by side — the `connect` mode, where
   * holding one fact across representations IS the lesson.
   */
  representation?: MultiplicationRepresentation;

  /** Item-space calibration stamp (a tier on a fitting strand): never rendered or sent to the tutor. */
  itemSpace?: { space: string; structure: string; beta: number };
}

export interface MultiplicationExplorerData {
  primitiveType?: 'multiplication-explorer';
  title: string;
  description?: string;
  fact: {
    factor1: number;
    factor2: number;
    product: number;
  };
  representations: {
    equalGroups: boolean;
    array: boolean;
    repeatedAddition: boolean;
    numberLine: boolean;
    areaModel: boolean;
  };
  activeRepresentation: 'groups' | 'array' | 'repeated_addition' | 'number_line' | 'area_model' | 'all';
  challenges: MultiplicationExplorerChallenge[];
  showOptions: {
    showProduct: boolean;
    showFactFamily: boolean;
    showCommutativeFlip: boolean;
    showDistributiveBreakdown: boolean;
  };
  imagePrompt: string | null;
  gradeBand: '2-3' | '3-4';

  /** Within-mode support tier from the manifest ('easy' | 'medium' | 'hard'), set by the generator when a tier is present. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MultiplicationExplorerMetrics>) => void;
}

interface MultiplicationExplorerProps {
  data: MultiplicationExplorerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// =============================================================================
// Sub-Components: Representation Panels
// =============================================================================

/** Equal Groups: circles with dots inside */
const EqualGroupsPanel: React.FC<{
  factor1: number;
  factor2: number;
  product: number;
  showProduct: boolean;
  flipped: boolean;
}> = ({ factor1, factor2, product, showProduct, flipped }) => {
  const groups = flipped ? factor2 : factor1;
  const perGroup = flipped ? factor1 : factor2;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300 text-center">
        {groups} group{groups !== 1 ? 's' : ''} of {perGroup}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {Array.from({ length: groups }).map((_, gi) => (
          <div
            key={gi}
            className="flex flex-wrap items-center justify-center gap-1 p-2 rounded-full border-2 border-violet-400/40 bg-violet-500/10 min-w-[48px]"
            style={{ maxWidth: `${Math.max(60, perGroup * 20)}px` }}
          >
            {Array.from({ length: perGroup }).map((_, di) => (
              <div
                key={di}
                className="w-4 h-4 rounded-full bg-violet-400 shadow-sm shadow-violet-400/50"
              />
            ))}
          </div>
        ))}
      </div>
      {showProduct && (
        <p className="text-center text-lg font-bold text-violet-300">
          {groups} &times; {perGroup} = {product}
        </p>
      )}
    </div>
  );
};

/** Array: rows × columns grid */
const ArrayPanel: React.FC<{
  factor1: number;
  factor2: number;
  product: number;
  showProduct: boolean;
  flipped: boolean;
}> = ({ factor1, factor2, product, showProduct, flipped }) => {
  const rows = flipped ? factor2 : factor1;
  const cols = flipped ? factor1 : factor2;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300 text-center">
        {rows} rows &times; {cols} columns
      </p>
      <div className="flex flex-col items-center gap-1">
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="flex gap-1">
            {Array.from({ length: cols }).map((_, ci) => (
              <div
                key={ci}
                className="w-6 h-6 rounded-sm bg-emerald-400/80 border border-emerald-300/30"
              />
            ))}
          </div>
        ))}
      </div>
      {showProduct && (
        <p className="text-center text-lg font-bold text-emerald-300">
          {rows} &times; {cols} = {product}
        </p>
      )}
    </div>
  );
};

/** Repeated Addition: equation */
const RepeatedAdditionPanel: React.FC<{
  factor1: number;
  factor2: number;
  product: number;
  showProduct: boolean;
  flipped: boolean;
}> = ({ factor1, factor2, product, showProduct, flipped }) => {
  const times = flipped ? factor2 : factor1;
  const addend = flipped ? factor1 : factor2;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300 text-center">
        Add {addend}, {times} time{times !== 1 ? 's' : ''}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-amber-300 text-xl font-mono">
        {Array.from({ length: times }).map((_, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-500">+</span>}
            <span className="bg-amber-500/10 border border-amber-400/30 rounded px-2 py-1">
              {addend}
            </span>
          </React.Fragment>
        ))}
        {showProduct && (
          <>
            <span className="text-slate-500">=</span>
            <span className="bg-amber-500/20 border border-amber-400/50 rounded px-2 py-1 font-bold">
              {product}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Number Line with jumps. The landing point is labelled only when the product may be shown: the multiples before it are
 * the skip count the learner reads, the last one is the answer.
 */
const NumberLinePanel: React.FC<{
  factor1: number;
  factor2: number;
  product: number;
  showProduct: boolean;
  flipped: boolean;
}> = ({ factor1, factor2, product, showProduct, flipped }) => {
  const jumps = flipped ? factor2 : factor1;
  const jumpSize = flipped ? factor1 : factor2;
  const maxVal = product + 2;

  // SVG dimensions
  const width = 500;
  const height = 100;
  const margin = 30;
  const lineY = 70;
  const usableWidth = width - 2 * margin;

  const toX = (val: number) => margin + (val / maxVal) * usableWidth;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300 text-center">
        Skip count by {jumpSize}, {jumps} time{jumps !== 1 ? 's' : ''}
      </p>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[500px] mx-auto">
          {/* Number line */}
          <line x1={margin} y1={lineY} x2={width - margin} y2={lineY} stroke="#64748b" strokeWidth="2" />
          {/* Tick marks */}
          {Array.from({ length: product + 1 }).map((_, i) => {
            const x = toX(i);
            const isMajor = i % jumpSize === 0;
            return (
              <g key={i}>
                <line
                  x1={x} y1={lineY - (isMajor ? 8 : 4)} x2={x} y2={lineY + (isMajor ? 8 : 4)}
                  stroke={isMajor ? '#94a3b8' : '#475569'} strokeWidth={isMajor ? 2 : 1}
                />
                {isMajor && (i !== product || showProduct) && (
                  <text x={x} y={lineY + 20} textAnchor="middle" className="fill-slate-400" fontSize="10">
                    {i}
                  </text>
                )}
              </g>
            );
          })}
          {/* Jump arcs */}
          {Array.from({ length: jumps }).map((_, i) => {
            const startVal = i * jumpSize;
            const endVal = (i + 1) * jumpSize;
            const sx = toX(startVal);
            const ex = toX(endVal);
            const midX = (sx + ex) / 2;
            const arcHeight = 25 + (i % 2) * 5;
            return (
              <g key={`jump-${i}`}>
                <path
                  d={`M ${sx} ${lineY} Q ${midX} ${lineY - arcHeight} ${ex} ${lineY}`}
                  fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2"
                />
                <circle cx={sx} cy={lineY} r="3" className="fill-sky-400" />
                <text x={midX} y={lineY - arcHeight - 4} textAnchor="middle" className="fill-sky-300" fontSize="9" fontWeight="bold">
                  +{jumpSize}
                </text>
              </g>
            );
          })}
          {/* Landing dot */}
          <circle cx={toX(product)} cy={lineY} r="4" className="fill-sky-400" />
          {showProduct && (
            <text x={toX(product)} y={lineY - 12} textAnchor="middle" className="fill-sky-300" fontSize="12" fontWeight="bold">
              {product}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
};

/** Area Model grid */
const AreaModelPanel: React.FC<{
  factor1: number;
  factor2: number;
  product: number;
  showProduct: boolean;
  flipped: boolean;
}> = ({ factor1, factor2, product, showProduct, flipped }) => {
  const h = flipped ? factor2 : factor1;
  const w = flipped ? factor1 : factor2;

  const cellSize = Math.min(28, Math.floor(240 / Math.max(h, w)));

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300 text-center">
        Rectangle: {h} &times; {w}
      </p>
      <div className="flex flex-col items-center">
        {/* Column header */}
        <div className="flex items-center mb-1">
          <div style={{ width: cellSize }} />
          <div
            className="text-center text-xs font-bold text-rose-300"
            style={{ width: w * cellSize }}
          >
            {w}
          </div>
        </div>
        <div className="flex">
          {/* Row header */}
          <div
            className="flex items-center justify-center text-xs font-bold text-rose-300 pr-1"
            style={{ width: cellSize, height: h * cellSize }}
          >
            {h}
          </div>
          {/* Grid */}
          <div
            className="border border-rose-400/30 bg-rose-500/10"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${w}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${h}, ${cellSize}px)`,
            }}
          >
            {Array.from({ length: h * w }).map((_, i) => (
              <div
                key={i}
                className="border border-rose-400/20"
                style={{ width: cellSize, height: cellSize }}
              />
            ))}
          </div>
        </div>
      </div>
      {showProduct && (
        <p className="text-center text-lg font-bold text-rose-300">
          Area = {h} &times; {w} = {product}
        </p>
      )}
    </div>
  );
};

/** Fact Family display */
const FactFamilyDisplay: React.FC<{
  f1: number;
  f2: number;
  p: number;
}> = ({ f1, f2, p }) => (
  <div className="flex flex-wrap gap-2 justify-center">
    {[
      `${f1} × ${f2} = ${p}`,
      `${f2} × ${f1} = ${p}`,
      `${p} ÷ ${f1} = ${f2}`,
      `${p} ÷ ${f2} = ${f1}`,
    ].map((eq) => (
      <LuminaBadge key={eq} className="text-slate-200 text-xs font-mono">
        {eq}
      </LuminaBadge>
    ))}
  </div>
);

/** Distributive property visual: e.g. 7×6 = 5×6 + 2×6. The sum is `?` until the item is solved: it is the answer. */
const DistributiveDisplay: React.FC<{
  factor1: number;
  factor2: number;
  product: number;
  showProduct: boolean;
}> = ({ factor1, factor2, product, showProduct }) => {
  const [a, b] = distributiveSplit({ factor1, factor2, product });

  return (
    <LuminaPanel className="space-y-2 p-3">
      <p className="text-sm text-slate-300 text-center font-medium">
        Distributive Property
      </p>
      <div className="text-center text-slate-200 font-mono space-y-1">
        <p>
          {factor1} &times; {factor2} is hard? Break it up!
        </p>
        <p className="text-lg">
          <span className="text-cyan-300">{a} &times; {factor2}</span>
          <span className="text-slate-500"> + </span>
          <span className="text-amber-300">{b} &times; {factor2}</span>
        </p>
        <p>
          <span className="text-cyan-300">{a * factor2}</span>
          <span className="text-slate-500"> + </span>
          <span className="text-amber-300">{b * factor2}</span>
          <span className="text-slate-500"> = </span>
          <span className="text-emerald-300 font-bold">{showProduct ? product : '?'}</span>
        </p>
      </div>
    </LuminaPanel>
  );
};

/**
 * The skip_strip lever: one box per group holding the group size, the running total under every box but the last,
 * which shows `?`. The count stops one group short of the product.
 */
const SkipStrip: React.FC<{ groups: number; each: number; totals: number[] }> = ({ groups, each, totals }) => (
  <div className="flex flex-wrap justify-center gap-2" data-lever="skip-strip">
    {Array.from({ length: groups }).map((_, i) => (
      <div key={i} className="flex flex-col items-center gap-1">
        <span className="rounded-md border border-violet-400/40 bg-violet-500/15 px-2 py-1 font-mono text-violet-200">{each}</span>
        <span className="text-xs font-mono text-slate-400">{i < totals.length ? totals[i] : '?'}</span>
      </div>
    ))}
  </div>
);

/**
 * The skip_line lever (missing factor): equal jumps of the known factor from 0, two past the product. Only 0 and the
 * product are labelled; the learner counts the jumps it takes to reach the product.
 */
const SkipLine: React.FC<{ step: number; jumps: number; product: number }> = ({ step, jumps, product }) => {
  const width = 500, margin = 24, lineY = 60, end = step * jumps;
  const toX = (v: number) => margin + (v / end) * (width - 2 * margin);
  return (
    <svg viewBox={`0 0 ${width} 90`} className="w-full max-w-[500px] mx-auto" data-lever="skip-line">
      <line x1={margin} y1={lineY} x2={width - margin} y2={lineY} stroke="#64748b" strokeWidth="2" />
      {Array.from({ length: jumps }).map((_, i) => {
        const sx = toX(i * step), ex = toX((i + 1) * step), mid = (sx + ex) / 2;
        return (
          <g key={i}>
            <path d={`M ${sx} ${lineY} Q ${mid} ${lineY - 26} ${ex} ${lineY}`} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2" />
            <line x1={ex} y1={lineY - 6} x2={ex} y2={lineY + 6} stroke="#94a3b8" strokeWidth="2" />
          </g>
        );
      })}
      <text x={toX(0)} y={lineY + 22} textAnchor="middle" className="fill-slate-400" fontSize="11">0</text>
      <circle cx={toX(product)} cy={lineY} r="5" className="fill-amber-400" />
      <text x={toX(product)} y={lineY + 22} textAnchor="middle" className="fill-amber-300" fontSize="12" fontWeight="bold">{product}</text>
    </svg>
  );
};

// =============================================================================
// Phase Indicator
// =============================================================================

type Phase = 'groups' | 'array' | 'connect' | 'strategy';

/**
 * Maps each CHALLENGE type to its display config for the end-of-session
 * PhaseSummaryPanel. These are the assessed dimensions — distinct from the
 * Groups/Array/Connect/Strategy navigation phases, which are exploration tabs.
 */
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build:          { label: 'Build',          icon: '🔨', accentColor: 'purple' },
  connect:        { label: 'Connect',        icon: '🔗', accentColor: 'emerald' },
  commutative:    { label: 'Commutative',    icon: '🔄', accentColor: 'cyan' },
  distributive:   { label: 'Distributive',   icon: '✂️', accentColor: 'amber' },
  missing_factor: { label: 'Missing Factor', icon: '❓', accentColor: 'pink' },
  fluency:        { label: 'Fluency',        icon: '⚡', accentColor: 'orange' },
};

const PHASE_LABELS: Record<Phase, { label: string; icon: string }> = {
  groups: { label: 'Groups', icon: '1' },
  array: { label: 'Array', icon: '2' },
  connect: { label: 'Connect', icon: '3' },
  strategy: { label: 'Strategy', icon: '4' },
};

const PhaseIndicator: React.FC<{ current: Phase }> = ({ current }) => {
  const phases: Phase[] = ['groups', 'array', 'connect', 'strategy'];
  const currentIdx = phases.indexOf(current);

  return (
    <div className="flex items-center gap-1 justify-center">
      {phases.map((p, i) => {
        const info = PHASE_LABELS[p];
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <React.Fragment key={p}>
            {i > 0 && (
              <div className={`h-px w-6 ${isDone ? 'bg-emerald-400' : 'bg-slate-700'}`} />
            )}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-violet-500/30 border border-violet-400/50 text-violet-200'
                  : isDone
                  ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300'
                  : 'bg-slate-800/50 border border-slate-700/50 text-slate-500'
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center rounded-full bg-black/20 text-[10px]">
                {isDone ? '✓' : info.icon}
              </span>
              {info.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

const useExplorerProgress = useWorkspaceProgressFor('multiplication-explorer');
const PRACTICE_NOTE = 'An easier practice fact is on screen in place of the item. It is not graded; the full item comes back after it.';

/**
 * Taught on the shared teaching workspace only: the typed answer commits through `progress.commitCheck` with its named
 * miss (`multiplicationMiss`), and the runtime owns the challenge index, retry and advance.
 *
 * The open item never shows its answer: the asked value is `?` in the equation, a picture that would show it is not
 * drawn (`modelShown`), and the product readouts, the landing label, the break-apart sum and the fact family wait until
 * the item is solved.
 */
const MultiplicationExplorerSurface = ({ data, className, runtimePlanItemId }: MultiplicationExplorerProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    fact,
    showOptions,
    gradeBand,
    representations,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  /** Each item stamped with its own fact (`explorerItems`): the panels, the check and the levers read it alone. */
  const challenges = useMemo(() => explorerItems(data), [data]);

  const stableInstanceIdRef = useRef(instanceId || `multiplication-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress: the teaching workspace owns it. ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useExplorerProgress({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: multiplicationExplorerBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex: challengeIndex, results: challengeResults, mergeResult } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  // State
  const [currentPhase, setCurrentPhase] = useState<Phase>('groups');
  const [flipped, setFlipped] = useState(false);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [missingFactorCorrect, setMissingFactorCorrect] = useState(0);
  const [missingFactorTotal, setMissingFactorTotal] = useState(0);
  const [representationsUsed, setRepresentationsUsed] = useState<Set<string>>(new Set());
  const [commutativeExplored, setCommutativeExplored] = useState(false);
  const [distributiveUsed, setDistributiveUsed] = useState(false);
  const [factFamilyCompleted, setFactFamilyCompleted] = useState(false);
  const [fluencyTimes, setFluencyTimes] = useState<number[]>([]);
  const [fluencyStart, setFluencyStart] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>(data.activeRepresentation === 'all' ? 'groups' : data.activeRepresentation);
  /** A wrong check in the learner's terms, for the tutor, until Try again clears it. */
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  // Levers (`MULTIPLICATION_LEVERS`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place. The item starts bare: no lever comes from the tier.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<MultiplicationExplorerChallenge | null>(null);
  const sessionChallenge = challenges[challengeIndex] ?? null;
  /** What is on screen: the easier fact while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // The fact the CURRENT challenge asks about — drives the equation display, EVERY
  // representation panel, and grading, so all three always agree. See
  // resolveChallengeFact for why the visuals must read this and not `data.fact`.
  const activeFact = useMemo(
    () => resolveChallengeFact(currentChallenge, fact),
    [currentChallenge, fact],
  );

  /** This item is solved: what it asked may now be shown. */
  const solved = feedback?.correct === true;
  const slot = currentChallenge ? askedSlot(currentChallenge) : 'product';
  /** The product readouts: the session's choice where the product is given, and always once the item is solved. */
  const productShown = solved || (showOptions.showProduct && slot !== 'product');
  /** The panels: never while they would show the asked value (`modelShown`). */
  const picturesShown = !currentChallenge || solved || modelShown(currentChallenge);

  // The modality THIS challenge is seen through. Pinning one representation per
  // challenge is what makes a session COVER the modalities (fact A as groups, fact
  // B on a number line, …) instead of re-drawing one fact in every panel.
  const challengeRepresentation = currentChallenge?.representation;

  // 'all' = the five side by side (the connect mode). The student can also reach
  // that view manually via the Connect phase button.
  const showAllRepresentations =
    challengeRepresentation === 'all' || currentPhase === 'connect';

  // A fresh item and Try again both clear what was typed and the verdict.
  const clearItem = () => {
    setAnswer('');
    setFeedback(null);
    setLastWrong(null);
  };
  openItem.current = (index, retry) => {
    clearItem();
    // Try again on an easier item keeps it; a fresh item, or the full item back after it, ends it.
    if (retry) return;
    setPractice(null);
    setFluencyStart(null);
    // The item's own picture, in the same update that opens it: a tab set by the effect below would republish the
    // scene one render later and supersede the item's visible receipt.
    const representation = challenges[index]?.representation;
    if (representation && representation !== 'all') setActiveTab(representation);
  };

  // Evaluation
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<MultiplicationExplorerMetrics>({
    primitiveType: 'multiplication-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  /** The summary, once every item is solved. */
  const showSummary = progress.isComplete;

  // Per-challenge-type breakdown for the end-of-session summary. Per-challenge
  // score: 100 first try, then -20 per extra attempt, floored at 20.
  const phaseResults = usePhaseResults<MultiplicationExplorerChallenge>({
    challenges,
    results: challengeResults,
    isComplete: showSummary,
    getChallengeType: (c) => c.type,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) =>
      rs.length === 0
        ? 0
        : Math.round(
            rs.reduce((s, r) => s + Number(r.score ?? (r.correct ? 100 : 0)), 0) / rs.length,
          ),
  });

  // Track representations used
  useEffect(() => {
    setRepresentationsUsed((prev) => {
      const next = new Set(Array.from(prev));
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Follow the challenge's pinned modality when it advances. This only sets the
  // STARTING lens — the student can still switch tabs freely within a challenge.
  useEffect(() => {
    if (challengeRepresentation && challengeRepresentation !== 'all') {
      setActiveTab(challengeRepresentation);
    }
  }, [challengeRepresentation, currentChallenge?.id]);

  // Start fluency timer when entering fluency challenges
  useEffect(() => {
    if (currentChallenge?.type === 'fluency' && !fluencyStart) {
      setFluencyStart(Date.now());
    }
  }, [currentChallenge, fluencyStart]);

  const handleSubmitAnswer = () => {
    if (!currentChallenge || solved || learnerBlocked() || !answer.trim()) return;
    const isCorrect = multiplicationAnswerCorrect(currentChallenge, activeFact, answer);
    const nextChallengeAttempts = progress.currentAttempts + 1;

    // An easier item (the simplify lever) is practice: it counts toward no session tally.
    if (!practice && currentChallenge.type === 'missing_factor') {
      setMissingFactorTotal((t) => t + 1);
    }
    progress.commitCheck(describeAnswer(currentChallenge, answer), isCorrect,
      isCorrect ? undefined : multiplicationMiss(currentChallenge, activeFact, answer));

    if (isCorrect) {
      SoundManager.playCorrect();
      if (!practice && currentChallenge.type === 'missing_factor') {
        setMissingFactorCorrect((c) => c + 1);
      }
      // This challenge's score (first correct), for the phase summary.
      if (!practice) mergeResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: nextChallengeAttempts,
        score: Math.max(20, 100 - (nextChallengeAttempts - 1) * 20),
      });

      // Fluency timing
      if (currentChallenge.type === 'fluency' && fluencyStart) {
        const elapsed = (Date.now() - fluencyStart) / 1000;
        setFluencyTimes((prev) => [...prev, elapsed]);
        setFluencyStart(null);
      }

      setFeedback({ correct: true, message: 'Correct!' });
      setLastWrong(null);
    } else {
      SoundManager.playIncorrect();
      setFeedback({ correct: false, message: hintFor(currentChallenge, activeFact) });
      setLastWrong(describeAnswer(currentChallenge, answer));
    }
  };

  const handlePhaseTransition = (newPhase: Phase) => {
    SoundManager.navigate();
    setCurrentPhase(newPhase);
  };

  const handleFlip = () => {
    SoundManager.toggle(!flipped);
    setFlipped((f) => !f);
    setCommutativeExplored(true);
  };

  const handleShowFactFamily = () => {
    SoundManager.pop();
    setFactFamilyCompleted(true);
  };

  const handleShowDistributive = () => {
    SoundManager.pop();
    setDistributiveUsed(true);
  };

  const metricsFor = (correct: number, total: number, attempts: number): MultiplicationExplorerMetrics => ({
    type: 'multiplication-explorer',
    factsCorrect: correct,
    factsTotal: total,
    representationsUsed: Array.from(representationsUsed),
    commutativePropertyExplored: commutativeExplored,
    distributiveStrategyUsed: distributiveUsed,
    factFamilyCompleted,
    fluencySpeed: fluencyTimes.length > 0 ? fluencyTimes.reduce((s, t) => s + t, 0) / fluencyTimes.length : 0,
    missingFactorCorrect,
    missingFactorTotal,
    attemptsCount: attempts,
  });

  const studentWork = () => ({
    // Every fact the session practiced — one per challenge.
    facts: challenges.map((c) => {
      const f = resolveChallengeFact(c, fact);
      return { type: c.type, fact: `${f.factor1} × ${f.factor2} = ${f.product}` };
    }),
    phases: currentPhase,
    challengeIndex,
    flipped,
  });

  // Under a lesson's evaluation provider only: the scored session, whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    submitResult(result.passed, result.accuracy, metricsFor(result.solvedCount, result.attemptsCount, result.attemptsCount),
      { studentWork: studentWork(), challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Determine which representations to show based on tab
  const representationTabs = useMemo(() => {
    const tabs: Array<{ value: string; label: string; enabled: boolean }> = [
      { value: 'groups', label: 'Equal Groups', enabled: representations.equalGroups },
      { value: 'array', label: 'Array', enabled: representations.array },
      { value: 'repeated_addition', label: 'Repeated Addition', enabled: representations.repeatedAddition },
      { value: 'number_line', label: 'Number Line', enabled: representations.numberLine },
      { value: 'area_model', label: 'Area Model', enabled: representations.areaModel },
    ];
    return tabs.filter((t) => t.enabled);
  }, [representations]);

  // activeFact, not the session fact — the picture must show the fact being asked.
  const panelProps = {
    factor1: activeFact.factor1,
    factor2: activeFact.factor2,
    product: activeFact.product,
    showProduct: productShown,
    flipped,
  };

  const renderRepresentation = (tabValue: string) => {
    switch (tabValue) {
      case 'groups': return <EqualGroupsPanel {...panelProps} />;
      case 'array': return <ArrayPanel {...panelProps} />;
      case 'repeated_addition': return <RepeatedAdditionPanel {...panelProps} />;
      case 'number_line': return <NumberLinePanel {...panelProps} />;
      case 'area_model': return <AreaModelPanel {...panelProps} />;
      default: return null;
    }
  };

  // Connect: the five representations of ONE fact, side by side. This is the one
  // place a constant fact IS the pedagogy — the insight is that they all encode the
  // same thing — so it still renders a single fact, just the ACTIVE challenge's.
  const renderAllRepresentations = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {representations.equalGroups && (
        <LuminaPanel className="p-3">
          <p className="text-xs font-medium text-violet-400 mb-2">Equal Groups</p>
          <EqualGroupsPanel {...panelProps} />
        </LuminaPanel>
      )}
      {representations.array && (
        <LuminaPanel className="p-3">
          <p className="text-xs font-medium text-emerald-400 mb-2">Array</p>
          <ArrayPanel {...panelProps} />
        </LuminaPanel>
      )}
      {representations.repeatedAddition && (
        <LuminaPanel className="p-3">
          <p className="text-xs font-medium text-amber-400 mb-2">Repeated Addition</p>
          <RepeatedAdditionPanel {...panelProps} />
        </LuminaPanel>
      )}
      {representations.numberLine && (
        <LuminaPanel className="p-3">
          <p className="text-xs font-medium text-sky-400 mb-2">Number Line</p>
          <NumberLinePanel {...panelProps} />
        </LuminaPanel>
      )}
      {representations.areaModel && (
        <LuminaPanel className="p-3">
          <p className="text-xs font-medium text-rose-400 mb-2">Area Model</p>
          <AreaModelPanel {...panelProps} />
        </LuminaPanel>
      )}
    </div>
  );

  const breakdownShown = picturesShown && showOptions.showDistributiveBreakdown && currentPhase === 'strategy' && distributiveUsed;

  // ── What the tutor and the observer are shown, republished every render. ──
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const view: ExplorerView = {
      answer,
      representation: showAllRepresentations ? 'all' : (activeTab as ExplorerView['representation']),
      flipped,
      breakdownShown,
      lastWrong,
    };
    const scene = workspaceScene(currentChallenge, activeFact, view);
    const ctx = { breakdownShown };
    const levers = practice ? [] : MULTIPLICATION_LEVERS.declare(sessionChallenge, ctx, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : MULTIPLICATION_LEVERS.support(sessionChallenge, ctx),
      onScreen: practice ? '' : MULTIPLICATION_LEVERS.onScreen(sessionChallenge, ctx, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = MULTIPLICATION_LEVERS.simpler(sessionChallenge, ctx, id);
          if (!easier) return 'This item has no smaller fact; try a help lever.';
          setLeverState(pulled); clearItem(); setPractice(easier);
          return { practice: multiplicationExplorerBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const inputClosed = showSummary || solved || learnerBlocked();

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <LuminaCardTitle>
              {data.title || 'Multiplication Explorer'}
            </LuminaCardTitle>
            <LuminaCardDescription className="mt-1">
              {data.description || 'Explore multiplication through multiple representations'}
            </LuminaCardDescription>
          </div>
          <LuminaBadge accent="purple">
            Grades {gradeBand}
          </LuminaBadge>
        </div>

        {/* Phase Indicator */}
        <div className="mt-3">
          <PhaseIndicator current={currentPhase} />
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Fact Display: the asked value is `?` until the item is solved. */}
        <div className="text-center py-2">
          <p className="text-3xl font-bold text-slate-100 font-mono tracking-wider" data-equation>
            {currentChallenge && !solved
              ? equationText(currentChallenge, activeFact, flipped)
              : `${flipped ? activeFact.factor2 : activeFact.factor1} × ${flipped ? activeFact.factor1 : activeFact.factor2}${productShown ? ` = ${activeFact.product}` : ''}`}
          </p>
        </div>

        {/* Commutative Flip Button (not on a missing factor: its label would print the factor) */}
        {showOptions.showCommutativeFlip && picturesShown && slot === 'product' && (
          <div className="flex justify-center">
            <LuminaButton className="text-sm" onClick={handleFlip}>
              Flip: {activeFact.factor1} &times; {activeFact.factor2} ↔ {activeFact.factor2} &times; {activeFact.factor1}
            </LuminaButton>
          </div>
        )}

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the models and the answer box
            as one region. */}
        {!showSummary && <PipDock />}
        <PipWorkspace className="space-y-4">
        {/* Representations */}
        {!picturesShown ? null : showAllRepresentations ? (
          /* Connect: the five representations of one fact, side by side */
          renderAllRepresentations()
        ) : (
          /* Other phases: tabbed view */
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800/50 border border-white/10 w-full flex-wrap h-auto gap-1 p-1">
              {representationTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs data-[state=active]:bg-violet-500/30 data-[state=active]:text-violet-200"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {representationTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-3">
                <div className="min-h-[120px] flex items-center justify-center">
                  {renderRepresentation(tab.value)}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Fact Family: every equation in it is an answer, so it opens once the item is solved. */}
        {showOptions.showFactFamily && solved && (
          <div className="space-y-2">
            <LuminaButton className="text-xs w-full" onClick={handleShowFactFamily}>
              Show Fact Family (× and ÷)
            </LuminaButton>
            {factFamilyCompleted && (
              <FactFamilyDisplay f1={activeFact.factor1} f2={activeFact.factor2} p={activeFact.product} />
            )}
          </div>
        )}

        {/* Distributive Property (Strategy phase) */}
        {showOptions.showDistributiveBreakdown && currentPhase === 'strategy' && picturesShown && (
          <div className="space-y-2">
            <LuminaButton className="text-xs w-full" onClick={handleShowDistributive}>
              Break It Up! (Distributive Property)
            </LuminaButton>
            {distributiveUsed && (
              <DistributiveDisplay
                factor1={activeFact.factor1}
                factor2={activeFact.factor2}
                product={activeFact.product}
                showProduct={productShown}
              />
            )}
          </div>
        )}

        {/* Levers the tutor pulled on this item (`multiplicationExplorerLevers.ts`); none on an easier item. */}
        {currentChallenge && !solved && leverOn(SHOW_MODEL_LEVER) && (
          <ArrayPanel factor1={activeFact.factor1} factor2={activeFact.factor2} product={activeFact.product} showProduct={false} flipped={false} />
        )}
        {currentChallenge && !solved && leverOn(BREAK_APART_LEVER) && !breakdownShown && (
          <div data-lever="break-apart">
            <DistributiveDisplay factor1={activeFact.factor1} factor2={activeFact.factor2} product={activeFact.product} showProduct={false} />
          </div>
        )}
        {currentChallenge && !solved && leverOn(SKIP_STRIP_LEVER) && (
          <SkipStrip groups={activeFact.factor1} each={activeFact.factor2} totals={skipStripTotals(activeFact)} />
        )}
        {currentChallenge && !solved && leverOn(SKIP_LINE_LEVER) && <SkipLine {...skipLine(currentChallenge, activeFact)} />}

        {/* Challenge Area */}
        {currentChallenge && !showSummary && (
          <LuminaPanel className="rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-200">
                {askFor(currentChallenge, activeFact)}
              </p>
              <div className="flex items-center gap-2">
                {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
                <LuminaBadge className="text-slate-400 text-[10px]">
                  {challengeIndex + 1}/{challenges.length}
                </LuminaBadge>
              </div>
            </div>

            {/* Answer Input */}
            <div className="flex items-center justify-center gap-2">
              <LuminaInput
                type="number"
                inputMode="numeric"
                aria-label="Your answer"
                placeholder="?"
                value={answer}
                onChange={(e) => { if (!learnerBlocked()) setAnswer(e.target.value.replace(/[^0-9]/g, '').slice(0, 3)); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitAnswer(); }}
                disabled={inputClosed}
                className="w-28 text-center text-2xl font-mono font-bold"
              />
              <LuminaActionButton action="check" onClick={handleSubmitAnswer} disabled={inputClosed || !answer.trim()}>Check</LuminaActionButton>
            </div>

            {/* Feedback */}
            {feedback && (
              <div
                className={`p-2 rounded-lg text-sm text-center ${
                  feedback.correct
                    ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300'
                    : 'bg-red-500/20 border border-red-400/30 text-red-300'
                }`}
              >
                {feedback.message}
              </div>
            )}
          </LuminaPanel>
        )}

        </PipWorkspace>

        {/* Phase Navigation */}
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <LuminaButton
            className={`text-xs ${currentPhase === 'groups' ? 'bg-violet-500/20 border-violet-400/30' : ''}`}
            onClick={() => handlePhaseTransition('groups')}
          >
            1. Groups
          </LuminaButton>
          <LuminaButton
            className={`text-xs ${currentPhase === 'array' ? 'bg-violet-500/20 border-violet-400/30' : ''}`}
            onClick={() => handlePhaseTransition('array')}
          >
            2. Array
          </LuminaButton>
          <LuminaButton
            className={`text-xs ${currentPhase === 'connect' ? 'bg-violet-500/20 border-violet-400/30' : ''}`}
            onClick={() => handlePhaseTransition('connect')}
          >
            3. Connect
          </LuminaButton>
          <LuminaButton
            className={`text-xs ${currentPhase === 'strategy' ? 'bg-violet-500/20 border-violet-400/30' : ''}`}
            onClick={() => handlePhaseTransition('strategy')}
          >
            4. Strategy
          </LuminaButton>
        </div>

        {/* End-of-session phase breakdown (by challenge type) */}
        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? submittedResult?.score}
            durationMs={elapsedMs}
            heading="Multiplication Session Complete"
            celebrationMessage={
              challengeResults.length > 0 && challengeResults.every((r) => Number(r.score ?? 0) === 100)
                ? 'Perfect! You nailed every challenge on the first try.'
                : 'Great work exploring multiplication across every representation!'
            }
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const MultiplicationExplorer = withWorkspaceOnly<MultiplicationExplorerProps>('multiplication-explorer',
  MultiplicationExplorerSurface, props => props.data.title);

export default MultiplicationExplorer;
