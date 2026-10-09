'use client';

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { Button } from '@/components/ui/button';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { StrategyPickerMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  BOTH_SAME, CHECK_LABEL, STEP_DOWN, STEP_UP, describeStrategyPickerCheck, menuLabel, optionLabel, strategyLabel,
  strategyPickerAssignment, strategyPickerMatches, strategyPickerMiss, strategyPickerScene, type StrategyPickerView,
} from './strategyPickerWorkspace';
import {
  PARTS_LEVER, PICTURES_LEVER, PRACTICE_NOTE, exampleProblem, optionPictures, partsFact, picturesFact, practiceItem,
  strategyPickerLevers,
} from './strategyPickerLevers';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type StrategyId =
  | 'counting-on'
  | 'counting-back'
  | 'make-ten'
  | 'doubles'
  | 'near-doubles'
  | 'tally-marks'
  | 'draw-objects';

export type ChallengeType =
  | 'guided-strategy'
  | 'try-another'
  | 'compare'
  | 'choose-your-strategy'
  | 'match-strategy';

export interface StrategyPickerChallenge {
  id: string;
  type: ChallengeType;
  instruction: string;
  problem: {
    equation: string;
    operation: 'addition' | 'subtraction';
    operand1: number;
    operand2: number;
    result: number;
  };
  // guided-strategy & try-another
  assignedStrategy?: StrategyId;
  strategySteps?: string[];
  // compare
  strategies?: string[];
  comparisonQuestion?: string;
  // choose-your-strategy
  availableStrategies?: StrategyId[];
  // match-strategy
  workedSolution?: string;
  strategyOptions?: string[];
  correctStrategy?: string;

  // ── Within-mode support tier (config.difficulty) — scaffolding only. ──
  // These NEVER change which strategy is correct or the numbers; they only
  // withdraw on-screen recognition aids as the tier hardens.
  /** 'easy' | 'medium' | 'hard' — set per challenge when a tier is applied. */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Show a problem-agnostic description of each visible strategy option. */
  showStrategyDescriptions?: boolean;
  /** Show a neutral worked exemplar (mini viz preview) for each option. */
  showStrategyExemplars?: boolean;
  /** Show a hint naming the PROBLEM FEATURES to attend to (never a strategy). */
  showFeatureHint?: boolean;
  /** Per-option strategy glossary (strategyId → short description). Populated
   *  only for the options actually on screen, so it can never leak the answer. */
  strategyDescriptions?: Record<string, string>;
}

export interface StrategyPickerData {
  title: string;
  description?: string;
  challenges: StrategyPickerChallenge[];
  maxNumber: number;
  operations: ('addition' | 'subtraction')[];
  strategiesIntroduced: StrategyId[];
  gradeBand: 'K' | '1';

  /** Session-level support tier (mirrors per-challenge supportTier) — lets the
   *  AI tutor calibrate how much it reveals. NEVER changes the assessed answer. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StrategyPickerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'guided-strategy':      { label: 'Guided Strategy',      icon: '🎯', accentColor: 'purple' },
  'try-another':          { label: 'Try Another',          icon: '🔄', accentColor: 'blue' },
  'compare':              { label: 'Compare',              icon: '⚖️', accentColor: 'amber' },
  'choose-your-strategy': { label: 'Choose Strategy',      icon: '🧠', accentColor: 'emerald' },
  'match-strategy':       { label: 'Match Strategy',       icon: '🔍', accentColor: 'cyan' },
};

const STRATEGY_INFO: Record<StrategyId, { label: string; icon: string; color: string }> = {
  'counting-on':   { label: 'Counting On',   icon: '➡️', color: 'blue' },
  'counting-back': { label: 'Counting Back', icon: '⬅️', color: 'indigo' },
  'make-ten':      { label: 'Make Ten',      icon: '🔟', color: 'emerald' },
  'doubles':       { label: 'Doubles',       icon: '🪞', color: 'purple' },
  'near-doubles':  { label: 'Near Doubles',  icon: '🔢', color: 'pink' },
  'tally-marks':   { label: 'Tally Marks',   icon: '📊', color: 'amber' },
  'draw-objects':  { label: 'Draw Objects',  icon: '✏️', color: 'orange' },
};

// ============================================================================
// Strategy Visualizations (SVG)
// ============================================================================

const SVG_W = 420;
const SVG_H = 140;
const FIRST_COLOR = '#3b82f6';
const SECOND_COLOR = '#eab308';

/** The help lever `two_parts`: a swatch and the number for each part of the picture, the equation's own numbers. */
function PartsLegend({ first, second, y }: { first: number; second: number; y: number }) {
  const cx = SVG_W / 2;
  return (
    <g data-lever="two-parts">
      {([[first, FIRST_COLOR, cx - 50], [second, SECOND_COLOR, cx + 20]] as const).map(([n, color, x]) => (
        <g key={color}>
          <rect x={x} y={y - 11} width={14} height={14} rx={3} fill={color} />
          <text x={x + 20} y={y} fontSize={14} fontWeight="bold" fill="rgba(255,255,255,0.9)" data-part-label>{n}</text>
        </g>
      ))}
    </g>
  );
}

function NumberLineViz({ operand1, operand2, operation, hopsRevealed, parts }: {
  operand1: number; operand2: number; operation: 'addition' | 'subtraction'; hopsRevealed: number; parts?: boolean;
}) {
  const max = Math.max(operand1 + operand2 + 2, 12);
  const startNum = operation === 'subtraction' ? operand1 : operand1;
  const hopCount = operand2;
  const direction = operation === 'subtraction' ? -1 : 1;
  const lineY = 100;
  const margin = 30;
  const usable = SVG_W - margin * 2;
  const step = usable / max;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {/* Number line */}
      <line x1={margin} y1={lineY} x2={SVG_W - margin} y2={lineY} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
      {/* Ticks and numbers */}
      {Array.from({ length: max + 1 }, (_, i) => {
        const x = margin + i * step;
        return (
          <g key={i}>
            <line x1={x} y1={lineY - 6} x2={x} y2={lineY + 6} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
            <text x={x} y={lineY + 20} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.6)">{i}</text>
          </g>
        );
      })}
      {/* Start marker; the help lever `two_parts` rings it */}
      {parts && <circle data-lever="two-parts" cx={margin + startNum * step} cy={lineY} r={11} fill="none" stroke="#fbbf24" strokeWidth={2} />}
      <circle cx={margin + startNum * step} cy={lineY} r={6} fill="#3b82f6" />
      {/* Hop arcs */}
      {Array.from({ length: Math.min(hopsRevealed, hopCount) }, (_, i) => {
        const fromNum = startNum + i * direction;
        const toNum = fromNum + direction;
        const x1 = margin + fromNum * step;
        const x2 = margin + toNum * step;
        const midX = (x1 + x2) / 2;
        return (
          <g key={`hop-${i}`}>
            <path
              d={`M ${x1} ${lineY} Q ${midX} ${lineY - 35} ${x2} ${lineY}`}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={2}
              strokeDasharray={i === hopsRevealed - 1 ? '4 2' : 'none'}
            />
            <circle cx={x2} cy={lineY} r={4} fill="#60a5fa" />
            <text x={midX} y={lineY - 38} textAnchor="middle" fontSize={9} fill="#93c5fd">
              {direction === -1 ? '−1' : '+1'}
            </text>
            {/* The help lever `two_parts`: each hop numbered in order, over its arc, never at a tick */}
            {parts && (
              <text x={midX} y={lineY - 52} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#fbbf24" data-hop-number>
                {i + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TenFrameViz({ operand1, operand2, parts }: { operand1: number; operand2: number; parts?: boolean }) {
  const total = operand1 + operand2;
  const cellW = 36;
  const cellH = 36;
  const gap = 3;
  const cols = 5;
  const rows = 2;
  const frameW = cols * (cellW + gap) - gap;
  const startX = (SVG_W - frameW) / 2;
  const startY = 20;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {/* Frame cells */}
      {Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = startX + col * (cellW + gap);
        const y = startY + row * (cellH + gap);
        const filled = i < total;
        const isFirstGroup = i < operand1;

        return (
          <g key={i}>
            <rect
              x={x} y={y} width={cellW} height={cellH} rx={4}
              fill={filled ? (isFirstGroup ? 'rgba(59,130,246,0.3)' : 'rgba(234,179,8,0.3)') : 'rgba(255,255,255,0.05)'}
              stroke={filled ? (isFirstGroup ? 'rgba(59,130,246,0.6)' : 'rgba(234,179,8,0.6)') : 'rgba(255,255,255,0.15)'}
              strokeWidth={1.5}
            />
            {filled && (
              <circle
                cx={x + cellW / 2} cy={y + cellH / 2} r={12}
                fill={isFirstGroup ? '#3b82f6' : '#eab308'}
              />
            )}
          </g>
        );
      })}
      {/* The help lever `two_parts`: the top row of five outlined, and each colour's number */}
      {parts && (
        <rect data-lever="two-parts" data-five-row x={startX - 4} y={startY - 4} width={frameW + 8} height={cellH + 8} rx={6}
          fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="6 3" />
      )}
      {parts && <PartsLegend first={operand1} second={operand2} y={startY + rows * (cellH + gap) + 24} />}
    </svg>
  );
}

function DoublesViz({ operand1, operand2, isNearDoubles, parts }: {
  operand1: number; operand2: number; isNearDoubles: boolean; parts?: boolean;
}) {
  const base = Math.min(operand1, operand2);
  const extra = Math.abs(operand1 - operand2);
  const dotR = 10;
  const dotGap = 26;
  const groupGap = 50;
  const colsPerGroup = Math.min(base, 5);
  const rowsPerGroup = Math.ceil(base / 5);

  const groupW = colsPerGroup * dotGap;
  const totalW = groupW * 2 + groupGap + (isNearDoubles ? dotGap : 0);
  const startX = (SVG_W - totalW) / 2;
  const startY = 20;

  const renderDots = (count: number, offsetX: number, color: string) =>
    Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / 5);
      const col = i % 5;
      return (
        <circle
          key={i}
          cx={offsetX + col * dotGap + dotR}
          cy={startY + row * dotGap + dotR}
          r={dotR}
          fill={color}
        />
      );
    });

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {/* Mirror line */}
      <line
        x1={startX + groupW + groupGap / 2}
        y1={10}
        x2={startX + groupW + groupGap / 2}
        y2={SVG_H - 20}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      {/* Left group */}
      {renderDots(base, startX, '#a78bfa')}
      {/* Right group */}
      {renderDots(base, startX + groupW + groupGap, '#a78bfa')}
      {/* Extra dot for near-doubles */}
      {isNearDoubles && extra > 0 && (
        <circle
          cx={startX + groupW * 2 + groupGap + dotGap / 2 + dotR}
          cy={startY + (rowsPerGroup - 1) * dotGap + dotR}
          r={dotR}
          fill="#f472b6"
          strokeWidth={2}
          stroke="#f472b6"
        />
      )}
      {/* The help lever `two_parts`: each equal group labelled with its number, the extra dot +1 */}
      {parts && (
        <g data-lever="two-parts">
          {[startX + groupW / 2, startX + groupW + groupGap + groupW / 2].map((x, i) => (
            <text key={i} x={x} y={startY + rowsPerGroup * dotGap + 22} textAnchor="middle" fontSize={14} fontWeight="bold"
              fill="#fbbf24" data-part-label>{base}</text>
          ))}
          {isNearDoubles && extra > 0 && (
            <text x={startX + groupW * 2 + groupGap + dotGap / 2 + dotR} y={startY + rowsPerGroup * dotGap + 22}
              textAnchor="middle" fontSize={14} fontWeight="bold" fill="#f472b6" data-part-label>+1</text>
          )}
        </g>
      )}
    </svg>
  );
}

function TallyViz({ total, split }: { total: number; split?: number }) {
  /** The help lever `two_parts` colours the first number's marks apart from the second's. */
  const colorOf = (i: number) => (split === undefined ? '#eab308' : i < split ? FIRST_COLOR : SECOND_COLOR);
  const groups = Math.floor(total / 5);
  const remainder = total % 5;
  const tallyGap = 14;
  const groupGap = 30;
  const lineH = 50;
  const startY = 25;

  const allGroups = groups + (remainder > 0 ? 1 : 0);
  const totalW = allGroups * groupGap + groups * 4 * tallyGap;
  const startX = Math.max((SVG_W - totalW) / 2, 20);

  let x = startX;
  const elements: React.ReactNode[] = [];

  for (let g = 0; g < groups; g++) {
    // 4 vertical lines
    for (let i = 0; i < 4; i++) {
      elements.push(
        <line key={`g${g}-v${i}`} x1={x} y1={startY} x2={x} y2={startY + lineH}
          stroke={colorOf(g * 5 + i)} strokeWidth={3} strokeLinecap="round" />
      );
      x += tallyGap;
    }
    // Diagonal cross
    elements.push(
      <line key={`g${g}-d`} x1={x - 4 * tallyGap + 2} y1={startY + lineH - 5}
        x2={x - 2} y2={startY + 5}
        stroke={colorOf(g * 5 + 4)} strokeWidth={3} strokeLinecap="round" />
    );
    x += groupGap;
  }

  // Remainder
  for (let i = 0; i < remainder; i++) {
    elements.push(
      <line key={`rem-${i}`} x1={x} y1={startY} x2={x} y2={startY + lineH}
        stroke={colorOf(groups * 5 + i)} strokeWidth={3} strokeLinecap="round" />
    );
    x += tallyGap;
  }

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {elements}
      {split !== undefined && <PartsLegend first={split} second={total - split} y={startY + lineH + 32} />}
    </svg>
  );
}

function DrawObjectsViz({ total, split }: { total: number; split?: number }) {
  const cols = Math.min(total, 5);
  const rows = Math.ceil(total / 5);
  const r = 14;
  const gap = 36;
  const totalW = cols * gap;
  const startX = (SVG_W - totalW) / 2 + gap / 2;
  const startY = 25;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="max-w-full h-auto">
      {Array.from({ length: total }, (_, i) => {
        const row = Math.floor(i / 5);
        const col = i % 5;
        return (
          <circle
            key={i}
            cx={startX + col * gap}
            cy={startY + row * gap}
            r={r}
            fill={split === undefined ? 'rgba(251,146,60,0.3)' : i < split ? 'rgba(59,130,246,0.3)' : 'rgba(234,179,8,0.3)'}
            stroke={split === undefined ? '#fb923c' : i < split ? FIRST_COLOR : SECOND_COLOR}
            strokeWidth={2}
          />
        );
      })}
      {/* The help lever `two_parts`: the first number's circles apart from the second's, each part's number */}
      {split !== undefined && <PartsLegend first={split} second={total - split} y={startY + rows * gap + 14} />}
    </svg>
  );
}

function StrategyVisualization({ strategy, problem, hopsRevealed, parts }: {
  strategy: StrategyId;
  problem: StrategyPickerChallenge['problem'];
  hopsRevealed: number;
  /** The help lever `two_parts` is pulled: mark the picture's parts (`partsMarks`). */
  parts?: boolean;
}) {
  const split = parts ? problem.operand1 : undefined;
  switch (strategy) {
    case 'counting-on':
    case 'counting-back':
      return <NumberLineViz operand1={problem.operand1} operand2={problem.operand2}
        operation={problem.operation} hopsRevealed={hopsRevealed} parts={parts} />;
    case 'make-ten':
      return <TenFrameViz operand1={problem.operand1} operand2={problem.operand2} parts={parts} />;
    case 'doubles':
      return <DoublesViz operand1={problem.operand1} operand2={problem.operand2} isNearDoubles={false} parts={parts} />;
    case 'near-doubles':
      return <DoublesViz operand1={problem.operand1} operand2={problem.operand2} isNearDoubles={true} parts={parts} />;
    case 'tally-marks':
      return <TallyViz total={problem.operand1 + problem.operand2} split={split} />;
    case 'draw-objects':
      return <DrawObjectsViz total={problem.operand1 + problem.operand2} split={split} />;
    default:
      return null;
  }
}

// ============================================================================
// Support-tier scaffolds (easy/medium): per-option descriptions + neutral
// worked exemplars. These teach the strategies GENERALLY without referencing
// the current problem, so they can never leak which option is correct.
// ============================================================================

/** A NEUTRAL example problem used to demo each strategy. Deliberately NOT the
 *  challenge's own problem — a doubles fact (4+4) so every visualization renders
 *  sensibly while never matching the live problem's operands. */
const NEUTRAL_EXEMPLAR_PROBLEM: StrategyPickerChallenge['problem'] = {
  equation: '4 + 4 = ?',
  operation: 'addition',
  operand1: 4,
  operand2: 4,
  result: 8,
};

function StrategyExemplarStrip({ strategies, avoid, lever }: {
  strategies: StrategyId[];
  /** The item's own problem: no exemplar is drawn on it. */
  avoid?: StrategyPickerChallenge['problem'];
  /** Drawn by the help lever `option_pictures`. */
  lever?: boolean;
}) {
  const unique = Array.from(new Set(strategies)).filter((s) => STRATEGY_INFO[s]);
  if (unique.length === 0) return null;
  return (
    <LuminaPanel className="p-3 space-y-2" data-lever={lever ? 'option-pictures' : undefined}>
      <p className="text-slate-400 text-xs font-medium text-center">
        How each strategy works, on its own example
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {unique.map((strat) => {
          // Each strategy on a problem it draws well (near doubles needs its extra one), never the item's.
          const example = exampleProblem(strat, avoid ? [avoid] : []) ?? NEUTRAL_EXEMPLAR_PROBLEM;
          return (
            <div key={strat} className="bg-slate-800/20 rounded-lg p-2 border border-white/5" data-option-picture={strat}>
              <p className="text-center text-[11px] text-slate-400 mb-1 font-medium">
                {STRATEGY_INFO[strat]?.icon} {STRATEGY_INFO[strat]?.label} · {example.equation}
              </p>
              <div className="scale-90 origin-top">
                <StrategyVisualization strategy={strat} problem={example} hopsRevealed={999} />
              </div>
            </div>
          );
        })}
      </div>
    </LuminaPanel>
  );
}

function StrategyDescriptionList({
  strategies,
  descriptions,
}: {
  strategies: StrategyId[];
  descriptions?: Record<string, string>;
}) {
  const unique = Array.from(new Set(strategies)).filter((s) => STRATEGY_INFO[s]);
  if (unique.length === 0 || !descriptions) return null;
  return (
    <LuminaPanel className="p-3 space-y-1.5">
      {unique.map((strat) =>
        descriptions[strat] ? (
          <div key={strat} className="flex items-start gap-2">
            <span className="text-sm">{STRATEGY_INFO[strat]?.icon}</span>
            <span className="text-slate-300 text-xs">
              <span className="font-medium text-slate-200">{STRATEGY_INFO[strat]?.label}:</span>{' '}
              {descriptions[strat]}
            </span>
          </div>
        ) : null,
      )}
    </LuminaPanel>
  );
}


// ============================================================================
// Component
// ============================================================================

interface StrategyPickerProps {
  data: StrategyPickerData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const useStrategyPickerProgress = useWorkspaceProgressFor('strategy-picker');

function StrategyPickerSurface({ data, className, runtimePlanItemId }: StrategyPickerProps) {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    strategiesIntroduced = [],
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `strategy-picker-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  /** Bound after the state it clears is declared; the progress hook calls it only after render. */
  const reopen = useRef<(retry: boolean) => void>(() => {});

  // -------------------------------------------------------------------------
  // Challenge progress: the teaching workspace owns it
  // -------------------------------------------------------------------------
  const progress = useStrategyPickerProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: strategyPickerAssignment,
    onItemOpened: (_index, retry) => reopen.current(retry),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
  } = progress;
  const canAttempt = progress.canAttempt !== false;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [answerInput, setAnswerInput] = useState('');
  // The menu choice belongs to its challenge, so a fresh challenge reads none during render (the
  // scene publishes it) and Try again keeps it: only the number is rejected.
  const [chosen, setChosen] = useState<{ challengeId: string; strategy: StrategyId } | null>(null);
  const [matchSelection, setMatchSelection] = useState<string | null>(null);
  const [compareAnswer, setCompareAnswer] = useState<string | null>(null);
  const [hopsRevealed, setHopsRevealed] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [strategiesUsed, setStrategiesUsed] = useState<Set<string>>(new Set());

  // In-item levers (`strategyPickerLevers.ts`), keyed by the session item they were pulled on, and the easier
  // practice item a simplify lever puts in place of the session item until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<StrategyPickerChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = sessionChallenge && leverState.item === sessionChallenge.id ? leverState.pulled : [];
  const chosenStrategy = chosen && chosen.challengeId === currentChallenge?.id ? chosen.strategy : null;

  // A fresh challenge, or the same one after Try again, starts with no number or pick. A practice item stays through
  // its own Try again; a fresh item, or the full item back after it, drops it.
  reopen.current = (retry) => {
    if (!retry) setPractice(null);
    setAnswerInput('');
    setMatchSelection(null);
    setCompareAnswer(null);
    setFeedback('');
    setFeedbackType('');
  };

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<StrategyPickerMetrics>({
    primitiveType: 'strategy-picker',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Animate number line hops for counting strategies
  useEffect(() => {
    if (!currentChallenge) return;
    const strategy = currentChallenge.assignedStrategy ?? chosenStrategy;
    if (strategy !== 'counting-on' && strategy !== 'counting-back') {
      setHopsRevealed(999); // show all for non-hop strategies
      return;
    }
    setHopsRevealed(0);
    const hopCount = currentChallenge.problem.operand2;
    let hop = 0;
    const timer = setInterval(() => {
      hop++;
      setHopsRevealed(hop);
      if (hop >= hopCount) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [currentChallengeIndex, currentChallenge, chosenStrategy]);

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  /** Learner input is closed while a checked answer waits for Try again, and once the challenge is solved. */
  const learnerBlocked = () => !canAttempt || isCurrentChallengeComplete || hasSubmittedEvaluation || allChallengesComplete;

  // -------------------------------------------------------------------------
  // Check button disabled logic
  // -------------------------------------------------------------------------
  const isCheckDisabled = useMemo(() => {
    if (!currentChallenge || hasSubmittedEvaluation || !canAttempt) return true;
    const { type } = currentChallenge;
    if (type === 'guided-strategy' || type === 'try-another') return !answerInput;
    if (type === 'choose-your-strategy') return !chosenStrategy || !answerInput;
    if (type === 'compare') return !compareAnswer;
    if (type === 'match-strategy') return !matchSelection;
    return false;
  }, [currentChallenge, hasSubmittedEvaluation, canAttempt, answerInput, chosenStrategy, compareAnswer, matchSelection]);

  // -------------------------------------------------------------------------
  // Every Check: the picker's own verdict, committed to the workspace
  // -------------------------------------------------------------------------
  const view: StrategyPickerView = { answer: answerInput, chosen: chosenStrategy, match: matchSelection, compare: compareAnswer };

  const handleCheckAnswer = () => {
    if (!currentChallenge || isCheckDisabled || learnerBlocked()) return;
    const { type, problem } = currentChallenge;
    const correct = strategyPickerMatches(currentChallenge, view);

    if (correct && practice) {
      // An easier practice item is ungraded: its success records nothing for the session.
      SoundManager.playCorrect();
      setFeedbackType('success');
      setFeedback(type === 'match-strategy' ? `Yes! That's ${strategyLabel(matchSelection ?? '')}!` : 'Correct! Now back to the full problem.');
    } else if (correct) {
      SoundManager.playCorrect();
      setFeedbackType('success');
      if (type === 'match-strategy') {
        setFeedback(`Yes! That's ${strategyLabel(matchSelection ?? '')}!`);
      } else if (type === 'compare') {
        // Compare is a reflection: every choice counts.
        setFeedback('Great thinking! Both strategies give the same answer.');
      } else {
        const strat = currentChallenge.assignedStrategy ?? chosenStrategy ?? 'unknown';
        // The generator prints the equation without "= ?" ("2 + 5"); both forms read as a whole fact.
        setFeedback(`Correct! ${problem.equation.includes('?')
          ? problem.equation.replace('?', String(problem.result)) : `${problem.equation} = ${problem.result}`}`);
        setStrategiesUsed(prev => new Set(prev).add(strat));
      }
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        ...(type === 'compare' ? { compareChoice: compareAnswer } : {}),
        ...(type !== 'compare' && type !== 'match-strategy'
          ? { strategyUsed: currentChallenge.assignedStrategy ?? chosenStrategy ?? 'unknown' } : {}),
      });
    } else {
      SoundManager.playIncorrect();
      setFeedbackType('error');
      setFeedback(type === 'match-strategy' ? 'Not quite — look at the steps again.' : 'Not quite. Try again!');
    }
    progress.commitCheck(describeStrategyPickerCheck(currentChallenge, view), correct, strategyPickerMiss(currentChallenge, view));
  };

  // -------------------------------------------------------------------------
  // Completion: the runtime advances; once every challenge is solved, submit once
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || hasAutoSubmittedRef.current) return;
    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation === false) return;
    hasAutoSubmittedRef.current = true;
    const correct = challengeResults.filter(r => r.correct).length;
    const score = Math.round((correct / challenges.length) * 100);
    const metrics: StrategyPickerMetrics = {
      type: 'strategy-picker',
      accuracy: score,
      strategiesUsed: Array.from(strategiesUsed),
      strategyFlexibility: strategiesUsed.size >= 2,
      comparisonCompleted: challengeResults.some(r =>
        challenges.find(c => c.id === r.challengeId)?.type === 'compare' && r.correct
      ),
      attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
    };
    submitEvaluation(correct === challenges.length, score, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmittedEvaluation, progress.recordsEvaluation, challengeResults, challenges,
      strategiesUsed, submitEvaluation]);

  // What the tutor and the observer are shown, republished every render. Derived from the challenge and
  // the menu choice alone, so opening an item adds no revision after the advance.
  // The session item's levers; a help picture is drawn on the session item only while it is pulled (or from the start
  // on easy), never on a practice item.
  const itemLevers = sessionChallenge ? strategyPickerLevers(sessionChallenge, data, pulledLevers) : [];
  const helpOn = (id: string) => !practice && itemLevers.some(l => l.id === id && l.pulled);
  const partsOn = helpOn(PARTS_LEVER);
  const picturesOn = helpOn(PICTURES_LEVER);
  const drawnStrategy = currentChallenge?.assignedStrategy ?? chosenStrategy;

  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = strategyPickerScene(currentChallenge, { chosen: chosenStrategy, supportTier }, strategiesIntroduced);
    const levers = practice ? [] : itemLevers;
    const onScreen = partsOn && drawnStrategy ? partsFact(drawnStrategy, currentChallenge.problem)
      : picturesOn ? picturesFact(optionPictures(currentChallenge)) : undefined;
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        if (id === PARTS_LEVER && !drawnStrategy) return 'Nothing is drawn yet: the learner picks a strategy from the menu first.';
        const next = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge, data);
          if (!easier) return 'This problem is already the smallest of its kind.';
          setLeverState(next); setPractice(easier); reopen.current(true);
          return { practice: strategyPickerAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full item, blank: the practice work is not the learner's work on it.
      endPractice: () => { setPractice(null); setChosen(null); reopen.current(true); },
    };
  });

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  const activeStrategy = currentChallenge?.assignedStrategy ?? chosenStrategy;
  const blocked = learnerBlocked();

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The strategy workspace',
    solved: isCurrentChallengeComplete,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="purple" className="text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </LuminaBadge>
            {currentChallenge && (
              <LuminaBadge accent="cyan" className="text-xs">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Progress */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex items-center gap-2 flex-wrap">
            {challenges.map((ch, i) => {
              const done = challengeResults.some(r => r.challengeId === ch.id && r.correct);
              const active = i === currentChallengeIndex;
              return (
                <div
                  key={ch.id}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-all ${
                    done
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : active
                        ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                        : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </div>
              );
            })}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Pip's dock sits above the problem, strategy picture and answer
            controls, which it outlines together as the workspace. */}
        {pip.store && !allChallengesComplete && <div {...pip.dock} />}

        {/* Problem Display */}
        {currentChallenge && !allChallengesComplete && (
          <div {...pip.workspace} className="space-y-4">
            {/* Equation */}
            <div className="text-center">
              <span className="text-3xl font-bold text-white tracking-wider">
                {currentChallenge.problem.equation}
              </span>
            </div>

            {/* Instruction */}
            <LuminaPanel className="p-3">
              <p className="text-slate-200 text-sm font-medium text-center">
                {currentChallenge.instruction}
              </p>
              {practice && <p className="text-amber-300 text-xs text-center mt-1" data-practice>Practice problem</p>}
            </LuminaPanel>

            {/* Support tier (easy): feature hint — names what to NOTICE about the
                problem, never which strategy to use (would leak the answer in
                recognition modes). */}
            {currentChallenge.showFeatureHint && (
              <LuminaPanel className="p-2 text-center border-amber-400/20">
                <p className="text-amber-300/80 text-xs">
                  💡 Look closely: is it {currentChallenge.problem.operation === 'subtraction' ? 'a take-away' : 'a put-together'} problem? Are the two numbers the same, close, or far apart?
                </p>
              </LuminaPanel>
            )}

            {/* Strategy Steps (guided-strategy, try-another) */}
            {(currentChallenge.type === 'guided-strategy' || currentChallenge.type === 'try-another') &&
              currentChallenge.strategySteps && currentChallenge.strategySteps.length > 0 && (
              <LuminaPanel className="p-3 space-y-1.5">
                {currentChallenge.strategySteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-purple-400 text-xs font-mono mt-0.5">{i + 1}.</span>
                    <span className="text-slate-300 text-sm">{step}</span>
                  </div>
                ))}
              </LuminaPanel>
            )}

            {/* Strategy Visualization */}
            {activeStrategy && (currentChallenge.type === 'guided-strategy' ||
              currentChallenge.type === 'try-another' || currentChallenge.type === 'choose-your-strategy') && (
              <div className="flex justify-center bg-slate-800/10 rounded-lg p-2 border border-white/5">
                <StrategyVisualization
                  strategy={activeStrategy}
                  problem={currentChallenge.problem}
                  hopsRevealed={hopsRevealed}
                  parts={partsOn}
                />
              </div>
            )}

            {/* Compare: two strategies side by side */}
            {currentChallenge.type === 'compare' && currentChallenge.strategies && (
              <div className="grid grid-cols-2 gap-3">
                {currentChallenge.strategies.map((strat) => (
                  <div key={strat} className="bg-slate-800/20 rounded-lg p-3 border border-white/5">
                    <p className="text-center text-xs text-slate-400 mb-2 font-medium">
                      {STRATEGY_INFO[strat as StrategyId]?.icon} {STRATEGY_INFO[strat as StrategyId]?.label}
                    </p>
                    <StrategyVisualization
                      strategy={strat as StrategyId}
                      problem={currentChallenge.problem}
                      hopsRevealed={999}
                    />
                  </div>
                ))}
                {/* Same answer badge */}
                <div className="col-span-2 text-center">
                  <LuminaBadge accent="emerald" className="text-xs">
                    Same answer: {currentChallenge.problem.result}
                  </LuminaBadge>
                </div>
              </div>
            )}

            {/* Choose-your-strategy: support-tier glossary + exemplars above menu */}
            {currentChallenge.type === 'choose-your-strategy' && !chosenStrategy &&
              currentChallenge.showStrategyDescriptions && (
              <StrategyDescriptionList
                strategies={(currentChallenge.availableStrategies ?? strategiesIntroduced) as StrategyId[]}
                descriptions={currentChallenge.strategyDescriptions}
              />
            )}
            {currentChallenge.type === 'choose-your-strategy' && !chosenStrategy &&
              currentChallenge.showStrategyExemplars && (
              <StrategyExemplarStrip
                strategies={(currentChallenge.availableStrategies ?? strategiesIntroduced) as StrategyId[]}
                avoid={currentChallenge.problem}
              />
            )}

            {/* Choose-your-strategy: strategy menu */}
            {currentChallenge.type === 'choose-your-strategy' && !chosenStrategy && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(currentChallenge.availableStrategies ?? strategiesIntroduced).map((strat) => {
                  const info = STRATEGY_INFO[strat];
                  return (
                    <Button
                      key={strat}
                      variant="ghost"
                      aria-label={menuLabel(strat)}
                      disabled={blocked}
                      className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 h-auto py-3 flex flex-col gap-1"
                      onClick={() => {
                        if (learnerBlocked()) return;
                        SoundManager.select();
                        setChosen({ challengeId: currentChallenge.id, strategy: strat });
                      }}
                    >
                      <span className="text-xl">{info.icon}</span>
                      <span className="text-xs">{info.label}</span>
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Match-strategy: worked solution + options */}
            {currentChallenge.type === 'match-strategy' && (
              <>
                {currentChallenge.workedSolution && (
                  <LuminaPanel>
                    <p className="text-slate-300 text-sm whitespace-pre-line">
                      {currentChallenge.workedSolution}
                    </p>
                  </LuminaPanel>
                )}
                {/* Support tier (easy/medium): per-option strategy glossary +
                    neutral exemplars. Problem-agnostic — never leaks the answer. */}
                {currentChallenge.showStrategyDescriptions && (
                  <StrategyDescriptionList
                    strategies={(currentChallenge.strategyOptions ?? []) as StrategyId[]}
                    descriptions={currentChallenge.strategyDescriptions}
                  />
                )}
                {/* The help lever `option_pictures`: every choice on its own example, never this problem. */}
                {picturesOn && (
                  <StrategyExemplarStrip
                    strategies={(currentChallenge.strategyOptions ?? []) as StrategyId[]}
                    avoid={currentChallenge.problem}
                    lever
                  />
                )}
                <div className="flex flex-wrap gap-2 justify-center">
                  {(currentChallenge.strategyOptions ?? []).map((opt) => (
                    <Button
                      key={opt}
                      variant="ghost"
                      aria-label={optionLabel(opt)}
                      disabled={blocked}
                      className={`border text-sm ${
                        matchSelection === opt
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                      }`}
                      onClick={() => { if (learnerBlocked()) return; SoundManager.select(); setMatchSelection(opt); }}
                    >
                      {STRATEGY_INFO[opt as StrategyId]?.icon ?? '?'}{' '}
                      {STRATEGY_INFO[opt as StrategyId]?.label ?? opt}
                    </Button>
                  ))}
                </div>
              </>
            )}

            {/* Compare question */}
            {currentChallenge.type === 'compare' && currentChallenge.comparisonQuestion && (
              <div className="space-y-2">
                <p className="text-slate-300 text-sm text-center font-medium">
                  {currentChallenge.comparisonQuestion}
                </p>
                <div className="flex gap-2 justify-center">
                  {[...(currentChallenge.strategies ?? []), BOTH_SAME].map((strat) => (
                    <Button
                      key={strat}
                      variant="ghost"
                      aria-label={optionLabel(strat)}
                      disabled={blocked}
                      className={`border text-sm ${
                        compareAnswer === strat
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                      }`}
                      onClick={() => { if (learnerBlocked()) return; SoundManager.select(); setCompareAnswer(strat); }}
                    >
                      {optionLabel(strat)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Answer Input (for strategy-solving types) */}
            {(currentChallenge.type === 'guided-strategy' ||
              currentChallenge.type === 'try-another' ||
              (currentChallenge.type === 'choose-your-strategy' && chosenStrategy)) &&
              !isCurrentChallengeComplete && (
              <div className="flex items-center justify-center gap-4">
                <span className="text-slate-400 text-sm">Answer:</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    aria-label={STEP_DOWN}
                    className="w-11 h-11 rounded-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-xl font-medium p-0"
                    onClick={() => {
                      if (learnerBlocked()) return;
                      SoundManager.tick();
                      setAnswerInput(prev => String(Math.max(0, (parseInt(prev, 10) || 0) - 1)));
                    }}
                    disabled={blocked || !answerInput || parseInt(answerInput, 10) <= 0}
                  >
                    −
                  </Button>
                  <div className="w-16 h-14 flex items-center justify-center rounded-xl bg-slate-800/60 border border-white/15 tabular-nums">
                    <span className="text-2xl font-bold text-white">
                      {answerInput || '?'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    aria-label={STEP_UP}
                    className="w-11 h-11 rounded-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 text-xl font-medium p-0"
                    onClick={() => {
                      if (learnerBlocked()) return;
                      SoundManager.tick();
                      setAnswerInput(prev => String(Math.min(20, (parseInt(prev, 10) || 0) + 1)));
                    }}
                    disabled={blocked}
                  >
                    +
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Check; the runtime advances (no Next button) */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <LuminaActionButton
                action="check"
                onClick={handleCheckAnswer}
                disabled={isCheckDisabled}
              >
                {CHECK_LABEL}
              </LuminaActionButton>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-1">All challenges complete!</p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                  {strategiesUsed.size > 0 && ` · ${strategiesUsed.size} strategies used`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint: stays up through Try again after two misses */}
        {currentChallenge?.strategySteps && !isCurrentChallengeComplete && !allChallengesComplete && currentAttempts >= 2 && (
          <LuminaPanel className="p-2 text-center">
            <p className="text-slate-400 text-xs italic">
              Follow the steps above carefully — each step brings you closer to the answer.
            </p>
          </LuminaPanel>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Strategy Practice Complete!"
            celebrationMessage={`You solved problems ${strategiesUsed.size} different way${strategiesUsed.size !== 1 ? 's' : ''}!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const StrategyPicker = withWorkspaceOnly<StrategyPickerProps>('strategy-picker', StrategyPickerSurface, props => props.data.title);

export default StrategyPicker;
