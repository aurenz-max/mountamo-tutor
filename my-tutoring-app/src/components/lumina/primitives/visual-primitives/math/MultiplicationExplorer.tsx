'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
} from '../../../ui';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { MultiplicationExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import type { ChallengeResult } from '../../../hooks/useChallengeProgress';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import CalculatorInput from '../../input-primitives/CalculatorInput';

// =============================================================================
// Data Interface (Single Source of Truth)
// =============================================================================

export interface MultiplicationExplorerChallenge {
  id: string;
  type: 'build' | 'connect' | 'commutative' | 'distributive' | 'missing_factor' | 'fluency';
  instruction: string;
  targetFact: string; // e.g., '3 × 4 = 12'
  hiddenValue: 'factor1' | 'factor2' | 'product' | null;
  timeLimit: number | null; // seconds, for fluency mode
  hint: string;
  narration: string;
}

export interface MultiplicationExplorerData {
  primitiveType?: 'multiplication-explorer';
  title?: string;
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

  /**
   * Within-mode support tier from the manifest ('easy' | 'medium' | 'hard').
   * Set by the generator whenever a tier is present (blends included). Drives the
   * tutor's reveal level so it never names a strategy the on-screen scaffold withheld.
   */
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

/** Number Line with jumps */
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
                {isMajor && (
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

/** Distributive property visual: e.g. 7×6 = 5×6 + 2×6 */
const DistributiveDisplay: React.FC<{
  factor1: number;
  factor2: number;
  product: number;
}> = ({ factor1, factor2, product }) => {
  // Split factor1 into 5 + remainder (or another convenient split)
  const a = Math.min(5, factor1 - 1);
  const b = factor1 - a;

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
          <span className="text-emerald-300 font-bold">{product}</span>
        </p>
      </div>
    </LuminaPanel>
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

/**
 * Mode-aware reveal policy for the AI tutor, keyed off the support tier and the
 * CURRENT challenge type (correct in a blend). Keeps the tutor's coaching depth in
 * sync with the on-screen scaffold so a hard tier doesn't leak via the tutor.
 *
 * For commutative/distributive the RELATIONSHIP is the lesson — the tutor calibrates
 * how much it coaches that relationship, but never hands over the product itself.
 */
function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  challengeType: MultiplicationExplorerChallenge['type'],
): string {
  if (!tier) return '';
  const base = ' SUPPORT TIER: ';
  if (tier === 'easy') {
    switch (challengeType) {
      case 'build':
      case 'missing_factor':
        return base + 'EASY — you may name the skip-count strategy and walk the count, but never state the final answer.';
      case 'distributive':
        return base + 'EASY — you may walk the break-apart split step by step, but do not state the product.';
      case 'commutative':
        return base + 'EASY — you may explain why swapping the factors keeps the total the same, without stating the total.';
      default:
        return base + 'EASY — you may name the strategy and guide the setup, but never reveal the answer.';
    }
  }
  if (tier === 'medium') {
    return base + 'MEDIUM — the model is on screen; nudge the student to use it. Do NOT name the full strategy or solve it for them.';
  }
  // hard
  switch (challengeType) {
    case 'build':
    case 'missing_factor':
      return base + 'HARD — do NOT name the skip-count strategy. Ask what the array/groups show and let the student find it.';
    case 'distributive':
      return base + 'HARD — do NOT suggest the split. Ask how they could break the hard fact into easier ones.';
    case 'commutative':
      return base + 'HARD — do NOT confirm whether the total stays the same. Ask the student to predict first, then check.';
    default:
      return base + 'HARD — do not name the strategy or reveal the answer; ask what the student sees in the model.';
  }
}

/**
 * Parse a per-challenge `targetFact` string ("3 × 4 = 12") into its factors.
 * This primitive renders a single shared `data.fact`, but each challenge carries
 * its OWN fact — a fluency drill legitimately varies the fact per challenge. The
 * challenge's targetFact is the source of truth for what is asked and how the
 * answer is judged; `data.fact` is the fallback for the exploration modes
 * (build/connect/…), whose targetFact always equals the shared fact. Product is
 * recomputed from the factors — a shipped "= p" that disagrees is never trusted.
 */
function parseTargetFact(
  targetFact?: string,
): { factor1: number; factor2: number; product: number } | null {
  if (!targetFact) return null;
  const nums = targetFact.match(/-?\d+/g);
  if (!nums || nums.length < 2) return null;
  const factor1 = parseInt(nums[0], 10);
  const factor2 = parseInt(nums[1], 10);
  if (!Number.isFinite(factor1) || !Number.isFinite(factor2)) return null;
  return { factor1, factor2, product: factor1 * factor2 };
}

const MultiplicationExplorer: React.FC<MultiplicationExplorerProps> = ({ data, className }) => {
  const {
    fact,
    challenges,
    showOptions,
    gradeBand,
    representations,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || `multiplication-explorer-${Date.now()}`;

  // State
  const [currentPhase, setCurrentPhase] = useState<Phase>('groups');
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [attemptsCount, setAttemptsCount] = useState(0);
  // Per-challenge attempt counter (resets on advance) — drives per-challenge scoring.
  const [challengeAttempts, setChallengeAttempts] = useState(0);
  // Per-challenge results, recorded once on first correct answer. Feeds PhaseSummaryPanel.
  const [challengeResults, setChallengeResults] = useState<ChallengeResult[]>([]);
  const [factsCorrect, setFactsCorrect] = useState(0);
  const [factsTotal, setFactsTotal] = useState(0);
  const [missingFactorCorrect, setMissingFactorCorrect] = useState(0);
  const [missingFactorTotal, setMissingFactorTotal] = useState(0);
  const [representationsUsed, setRepresentationsUsed] = useState<Set<string>>(new Set());
  const [commutativeExplored, setCommutativeExplored] = useState(false);
  const [distributiveUsed, setDistributiveUsed] = useState(false);
  const [factFamilyCompleted, setFactFamilyCompleted] = useState(false);
  const [fluencyTimes, setFluencyTimes] = useState<number[]>([]);
  const [fluencyStart, setFluencyStart] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>(data.activeRepresentation === 'all' ? 'groups' : data.activeRepresentation);
  const currentChallenge = challenges[challengeIndex] ?? null;

  // The fact the CURRENT challenge asks about. Fluency challenges each carry their
  // own targetFact; the exploration modes fall back to the shared `data.fact`
  // (their targetFact equals it). This is the single source of truth for the
  // equation display AND for grading — so the two can never disagree.
  const activeFact = useMemo(
    () => parseTargetFact(currentChallenge?.targetFact) ?? fact,
    [currentChallenge, fact],
  );

  // AI tutoring integration
  const aiPrimitiveData = useMemo(() => ({
    fact: `${fact.factor1} × ${fact.factor2} = ${fact.product}`,
    currentPhase,
    challengeIndex,
    challengeType: currentChallenge?.type || 'none',
    instruction: currentChallenge?.instruction || '',
    flipped,
    attemptsCount,
    factsCorrect,
    factsTotal,
    gradeBand,
    supportTier: supportTier ?? null,
  }), [fact, currentPhase, challengeIndex, currentChallenge, flipped, attemptsCount, factsCorrect, factsTotal, gradeBand, supportTier]);

  const { sendText } = useLuminaAI({
    primitiveType: 'multiplication-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '2-3' ? '2nd Grade' : '4th Grade',
  });

  // Evaluation
  const { submitResult, hasSubmitted, submittedResult, elapsedMs, resetAttempt } = usePrimitiveEvaluation<MultiplicationExplorerMetrics>({
    primitiveType: 'multiplication-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Per-challenge-type breakdown for the end-of-session summary. Computes once
  // the student submits; groups recorded results by challenge type. Per-challenge
  // score: 100 first try, then -20 per extra attempt, floored at 20.
  const phaseResults = usePhaseResults<MultiplicationExplorerChallenge>({
    challenges,
    results: challengeResults,
    isComplete: hasSubmitted,
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

  // Start fluency timer when entering fluency challenges
  useEffect(() => {
    if (currentChallenge?.type === 'fluency' && !fluencyStart) {
      setFluencyStart(Date.now());
    }
  }, [currentChallenge, fluencyStart]);

  const getExpectedAnswer = useCallback((): number | null => {
    if (!currentChallenge) return null;
    const { hiddenValue } = currentChallenge;
    if (hiddenValue === 'product') return activeFact.product;
    if (hiddenValue === 'factor1') return activeFact.factor1;
    if (hiddenValue === 'factor2') return activeFact.factor2;
    return activeFact.product; // default: product is the answer
  }, [currentChallenge, activeFact]);

  const handleSubmitAnswer = useCallback(() => {
    const expected = getExpectedAnswer();
    if (expected === null) return;
    const userAnswer = parseInt(answer, 10);
    const isCorrect = userAnswer === expected;

    setAttemptsCount((a) => a + 1);
    setFactsTotal((t) => t + 1);
    const nextChallengeAttempts = challengeAttempts + 1;
    setChallengeAttempts(nextChallengeAttempts);

    if (currentChallenge?.type === 'missing_factor') {
      setMissingFactorTotal((t) => t + 1);
    }

    if (isCorrect) {
      SoundManager.playCorrect();
      setFactsCorrect((c) => c + 1);
      if (currentChallenge?.type === 'missing_factor') {
        setMissingFactorCorrect((c) => c + 1);
      }

      // Record this challenge's result once (first correct), for the phase summary.
      if (currentChallenge && !challengeResults.some((r) => r.challengeId === currentChallenge.id)) {
        const score = Math.max(20, 100 - (nextChallengeAttempts - 1) * 20);
        setChallengeResults((prev) => [
          ...prev,
          {
            challengeId: currentChallenge.id,
            correct: true,
            attempts: nextChallengeAttempts,
            score,
          },
        ]);
      }

      // Fluency timing
      if (currentChallenge?.type === 'fluency' && fluencyStart) {
        const elapsed = (Date.now() - fluencyStart) / 1000;
        setFluencyTimes((prev) => [...prev, elapsed]);
        setFluencyStart(null);
      }

      setFeedback({ correct: true, message: 'Correct!' });

      // AI: celebrate
      sendText(
        `[ANSWER_CORRECT] Student answered ${activeFact.factor1} × ${activeFact.factor2} = ${userAnswer} correctly ` +
        `on attempt ${attemptsCount + 1}. Challenge: "${currentChallenge?.instruction}". ` +
        `Congratulate briefly and introduce the next step.` +
        tutorRevealPolicy(supportTier, currentChallenge?.type ?? 'build'),
        { silent: true }
      );
    } else {
      SoundManager.playIncorrect();
      setFeedback({
        correct: false,
        message: currentChallenge?.hint || `Not quite. Try again!`,
      });

      // AI: hint
      sendText(
        `[ANSWER_INCORRECT] Student answered "${userAnswer}" but correct is ${expected}. ` +
        `Fact: ${activeFact.factor1} × ${activeFact.factor2} = ${activeFact.product}. ` +
        `Challenge: "${currentChallenge?.instruction}". Attempt ${attemptsCount + 1}. ` +
        `Give a brief hint without revealing the answer.` +
        tutorRevealPolicy(supportTier, currentChallenge?.type ?? 'build'),
        { silent: true }
      );
    }
  }, [answer, getExpectedAnswer, currentChallenge, activeFact, attemptsCount, challengeAttempts, challengeResults, fluencyStart, sendText, supportTier]);

  const handleNextChallenge = useCallback(() => {
    if (challengeIndex < challenges.length - 1) {
      SoundManager.navigate();
      setChallengeIndex((i) => i + 1);
      setAnswer('');
      setFeedback(null);
      setChallengeAttempts(0);
      setFluencyStart(null);

      // AI: next challenge
      const next = challenges[challengeIndex + 1];
      sendText(
        `[NEXT_CHALLENGE] Moving to challenge ${challengeIndex + 2} of ${challenges.length}: ` +
        `"${next.instruction}". Type: ${next.type}. Briefly introduce it.` +
        tutorRevealPolicy(supportTier, next.type),
        { silent: true }
      );
    }
  }, [challengeIndex, challenges, sendText, supportTier]);

  const handlePhaseTransition = useCallback((newPhase: Phase) => {
    SoundManager.navigate();
    setCurrentPhase(newPhase);
    setFeedback(null);

    sendText(
      `[PHASE_CHANGE] Student moved to phase: ${newPhase}. ` +
      `${newPhase === 'connect' ? 'All 5 representations shown simultaneously. Help student see they all show the same fact.' : ''}` +
      `${newPhase === 'strategy' ? 'Distributive property phase. Coach: "Don\'t know a hard fact? Break it into easy ones!"' : ''}` +
      `Briefly introduce this phase.` +
      tutorRevealPolicy(supportTier, currentChallenge?.type ?? 'build'),
      { silent: true }
    );
  }, [sendText, supportTier, currentChallenge]);

  const handleFlip = useCallback(() => {
    SoundManager.toggle(!flipped);
    setFlipped((f) => !f);
    setCommutativeExplored(true);

    sendText(
      `[COMMUTATIVE_FLIP] Student flipped ${fact.factor1} × ${fact.factor2} to ${fact.factor2} × ${fact.factor1}. ` +
      `Ask: "Is the total the same? Why?"`,
      { silent: true }
    );
  }, [fact, flipped, sendText]);

  const handleShowFactFamily = useCallback(() => {
    SoundManager.pop();
    setFactFamilyCompleted(true);

    sendText(
      `[FACT_FAMILY] Student explored the fact family: ` +
      `${fact.factor1}×${fact.factor2}=${fact.product}, ${fact.product}÷${fact.factor1}=${fact.factor2}, etc. ` +
      `Briefly explain how multiplication and division are connected.`,
      { silent: true }
    );
  }, [fact, sendText]);

  const handleShowDistributive = useCallback(() => {
    SoundManager.pop();
    setDistributiveUsed(true);

    const a = Math.min(5, fact.factor1 - 1);
    const b = fact.factor1 - a;
    sendText(
      `[DISTRIBUTIVE_STRATEGY] Student explored distributive property: ` +
      `${fact.factor1}×${fact.factor2} = ${a}×${fact.factor2} + ${b}×${fact.factor2} = ${a * fact.factor2} + ${b * fact.factor2} = ${fact.product}. ` +
      `Celebrate the strategy: "You broke a hard fact into easy ones!"`,
      { silent: true }
    );
  }, [fact, sendText]);

  const handleComplete = useCallback(() => {
    if (hasSubmitted) return;

    const avgFluency = fluencyTimes.length > 0
      ? fluencyTimes.reduce((s, t) => s + t, 0) / fluencyTimes.length
      : 0;

    const score = factsTotal > 0 ? Math.round((factsCorrect / factsTotal) * 100) : 0;
    const success = score >= 70;

    const metrics: MultiplicationExplorerMetrics = {
      type: 'multiplication-explorer',
      factsCorrect,
      factsTotal,
      representationsUsed: Array.from(representationsUsed),
      commutativePropertyExplored: commutativeExplored,
      distributiveStrategyUsed: distributiveUsed,
      factFamilyCompleted,
      fluencySpeed: avgFluency,
      missingFactorCorrect,
      missingFactorTotal,
      attemptsCount,
    };

    submitResult(success, score, metrics, {
      studentWork: {
        fact,
        phases: currentPhase,
        challengeIndex,
        flipped,
      },
    });

    sendText(
      `[SESSION_COMPLETE] Student finished multiplication explorer. ` +
      `Score: ${score}%. Facts: ${factsCorrect}/${factsTotal}. ` +
      `Representations used: ${Array.from(representationsUsed).join(', ')}. ` +
      `Commutative explored: ${commutativeExplored}. Distributive used: ${distributiveUsed}. ` +
      `Celebrate their work and summarize what they learned!`,
      { silent: true }
    );
  }, [
    hasSubmitted, fluencyTimes, factsCorrect, factsTotal, representationsUsed,
    commutativeExplored, distributiveUsed, factFamilyCompleted,
    missingFactorCorrect, missingFactorTotal, attemptsCount,
    fact, currentPhase, challengeIndex, flipped, submitResult, sendText,
  ]);

  const handleReset = useCallback(() => {
    setChallengeIndex(0);
    setAnswer('');
    setFeedback(null);
    setAttemptsCount(0);
    setChallengeAttempts(0);
    setChallengeResults([]);
    setFactsCorrect(0);
    setFactsTotal(0);
    setMissingFactorCorrect(0);
    setMissingFactorTotal(0);
    setRepresentationsUsed(new Set());
    setCommutativeExplored(false);
    setDistributiveUsed(false);
    setFactFamilyCompleted(false);
    setFluencyTimes([]);
    setFluencyStart(null);
    setCurrentPhase('groups');
    setFlipped(false);
    resetAttempt();
  }, [resetAttempt]);

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

  const renderRepresentation = (tabValue: string) => {
    const panelProps = {
      factor1: fact.factor1,
      factor2: fact.factor2,
      product: fact.product,
      showProduct: showOptions.showProduct,
      flipped,
    };
    switch (tabValue) {
      case 'groups': return <EqualGroupsPanel {...panelProps} />;
      case 'array': return <ArrayPanel {...panelProps} />;
      case 'repeated_addition': return <RepeatedAdditionPanel {...panelProps} />;
      case 'number_line': return <NumberLinePanel {...panelProps} />;
      case 'area_model': return <AreaModelPanel {...panelProps} />;
      default: return null;
    }
  };

  // In "connect" phase, show all 5 at once
  const renderAllRepresentations = () => {
    const panelProps = {
      factor1: fact.factor1,
      factor2: fact.factor2,
      product: fact.product,
      showProduct: showOptions.showProduct,
      flipped,
    };
    return (
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
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <LuminaCardTitle>
              {data.title || `${fact.factor1} × ${fact.factor2}`}
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
        {/* Fact Display */}
        <div className="text-center py-2">
          <p className="text-3xl font-bold text-slate-100 font-mono tracking-wider">
            {flipped ? activeFact.factor2 : activeFact.factor1} &times; {flipped ? activeFact.factor1 : activeFact.factor2}
            {showOptions.showProduct && <span> = {activeFact.product}</span>}
          </p>
        </div>

        {/* Commutative Flip Button */}
        {showOptions.showCommutativeFlip && (
          <div className="flex justify-center">
            <LuminaButton className="text-sm" onClick={handleFlip}>
              Flip: {fact.factor1} &times; {fact.factor2} ↔ {fact.factor2} &times; {fact.factor1}
            </LuminaButton>
          </div>
        )}

        {/* Representations */}
        {currentPhase === 'connect' ? (
          /* Connect phase: show all at once */
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

        {/* Fact Family */}
        {showOptions.showFactFamily && (
          <div className="space-y-2">
            <LuminaButton className="text-xs w-full" onClick={handleShowFactFamily}>
              Show Fact Family (× and ÷)
            </LuminaButton>
            {factFamilyCompleted && (
              <FactFamilyDisplay f1={fact.factor1} f2={fact.factor2} p={fact.product} />
            )}
          </div>
        )}

        {/* Distributive Property (Strategy phase) */}
        {showOptions.showDistributiveBreakdown && currentPhase === 'strategy' && (
          <div className="space-y-2">
            <LuminaButton className="text-xs w-full" onClick={handleShowDistributive}>
              Break It Up! (Distributive Property)
            </LuminaButton>
            {distributiveUsed && (
              <DistributiveDisplay
                factor1={fact.factor1}
                factor2={fact.factor2}
                product={fact.product}
              />
            )}
          </div>
        )}

        {/* Challenge Area */}
        {currentChallenge && (
          <LuminaPanel className="rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-200">
                {currentChallenge.instruction}
              </p>
              <LuminaBadge className="text-slate-400 text-[10px]">
                {challengeIndex + 1}/{challenges.length}
              </LuminaBadge>
            </div>

            {/* Answer Input */}
            <CalculatorInput
              label="Your answer"
              value={answer}
              onChange={setAnswer}
              onSubmit={handleSubmitAnswer}
              showSubmitButton={true}
              allowNegative={false}
              allowDecimal={false}
              maxLength={3}
              disabled={hasSubmitted}
            />

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

            {/* Next Challenge Button */}
            {feedback?.correct && challengeIndex < challenges.length - 1 && (
              <LuminaActionButton
                action="next"
                className="w-full"
                onClick={handleNextChallenge}
              >
                Next Challenge →
              </LuminaActionButton>
            )}
          </LuminaPanel>
        )}

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

        {/* Score Summary */}
        {factsTotal > 0 && !hasSubmitted && (
          <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
            <span>Score: {factsCorrect}/{factsTotal}</span>
            <span>Reps: {representationsUsed.size}/5</span>
            {commutativeExplored && <span className="text-emerald-400">Commutative ✓</span>}
            {distributiveUsed && <span className="text-cyan-400">Distributive ✓</span>}
          </div>
        )}

        {/* Submit / Reset */}
        <div className="flex gap-2 justify-center">
          <LuminaActionButton
            action="check"
            onClick={handleComplete}
            disabled={hasSubmitted || factsTotal === 0}
          >
            {hasSubmitted ? 'Submitted!' : 'Submit Results'}
          </LuminaActionButton>
          {hasSubmitted && (
            <LuminaActionButton action="retry" onClick={handleReset} />
          )}
        </div>

        {/* End-of-session phase breakdown (by challenge type) */}
        {hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
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

export default MultiplicationExplorer;
