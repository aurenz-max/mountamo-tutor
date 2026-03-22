'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { PulseBand, ItemFrontierContext, SessionFrontierContext, IrtProbabilityData, GateProgress } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FrontierContextCardProps {
  band: PulseBand;
  itemContext?: ItemFrontierContext;
  sessionContext?: SessionFrontierContext;
  isColdStart?: boolean;
  /** IRT probability data from the most recent result */
  irt?: IrtProbabilityData;
  /** Gate progress from the most recent result */
  gateProgress?: GateProgress;
  /** Current sigma (uncertainty) */
  sigma?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pCorrectColor(p: number): string {
  if (p >= 0.7) return 'text-emerald-400';
  if (p >= 0.4) return 'text-amber-400';
  return 'text-rose-400';
}

function pCorrectBg(p: number): string {
  if (p >= 0.7) return 'bg-emerald-500/15 border-emerald-500/20';
  if (p >= 0.4) return 'bg-amber-500/15 border-amber-500/20';
  return 'bg-rose-500/15 border-rose-500/20';
}

function confidenceLabel(sigma: number): { label: string; color: string } {
  if (sigma <= 0.8) return { label: 'High', color: 'text-emerald-400' };
  if (sigma <= 1.2) return { label: 'Medium', color: 'text-amber-400' };
  return { label: 'Low', color: 'text-slate-500' };
}

const GATE_LABELS: Record<number, string> = {
  1: 'Emerging',
  2: 'Developing',
  3: 'Proficient',
  4: 'Mastered',
};

// ---------------------------------------------------------------------------
// Unit Progress Ring (SVG donut)
// ---------------------------------------------------------------------------

function UnitProgressRing({
  mastered,
  total,
  size = 40,
  strokeWidth = 4,
}: {
  mastered: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? mastered / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold text-slate-200">
          {mastered}/{total}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IRT Probability Pill
// ---------------------------------------------------------------------------

function ProbabilityPill({ pCorrect }: { pCorrect: number }) {
  const pct = Math.round(pCorrect * 100);
  return (
    <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${pCorrectBg(pCorrect)}`}>
      <span className={`text-[10px] font-semibold ${pCorrectColor(pCorrect)}`}>
        {pct}%
      </span>
      <span className="text-[10px] text-slate-500">likely</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence Indicator
// ---------------------------------------------------------------------------

function ConfidenceIndicator({ sigma }: { sigma: number }) {
  const { label, color } = confidenceLabel(sigma);
  return (
    <span className={`text-[10px] ${color}`}>
      Confidence: {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Gate Readiness (P(correct) at next gate's reference difficulty)
// ---------------------------------------------------------------------------

function GateReadiness({ gateProgress, irt }: { gateProgress: GateProgress; irt?: IrtProbabilityData }) {
  const nextGate = gateProgress.next_gate;
  if (!nextGate || !irt) return null;

  const pct = Math.round(irt.p_correct * 100);
  const gateLabel = GATE_LABELS[nextGate] || `Gate ${nextGate}`;

  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-1.5 flex-1 rounded-full bg-white/5 overflow-hidden`}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] text-slate-400 whitespace-nowrap">
        {pct}% ready for {gateLabel}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dot chain (visual distance indicator for frontier)
// ---------------------------------------------------------------------------

function DotChain({ distance }: { distance: number }) {
  const dots = Math.min(distance, 5);
  return (
    <div className="flex items-center gap-1">
      {/* Frontier dot (you) */}
      <div className="w-2 h-2 rounded-full bg-blue-400" />
      {/* Gap dots */}
      {Array.from({ length: dots }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/20"
        />
      ))}
      {/* Target dot */}
      <div className="w-2 h-2 rounded-full bg-violet-400 ring-2 ring-violet-400/30" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Band-specific content renderers
// ---------------------------------------------------------------------------

function FrontierContent({ ctx, irt }: { ctx: ItemFrontierContext; irt?: IrtProbabilityData }) {
  const stepsLabel = ctx.dag_distance === 1 ? '1 step' : `${ctx.dag_distance} steps`;
  const skipLabel = ctx.ancestors_if_passed === 1 ? '1 skill' : `${ctx.ancestors_if_passed} skills`;

  return (
    <div className="flex items-center gap-3">
      <DotChain distance={ctx.dag_distance} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs text-violet-300 font-medium">
            {stepsLabel} ahead of your frontier
          </p>
          {irt && <ProbabilityPill pCorrect={irt.p_correct} />}
        </div>
        {ctx.ancestors_if_passed > 0 && (
          <p className="text-[10px] text-slate-500 truncate">
            Pass it to skip {skipLabel}
            {ctx.ancestor_skill_names.length > 0 && (
              <span className="text-slate-600">
                {' '}&mdash; {ctx.ancestor_skill_names.slice(0, 3).join(', ')}
              </span>
            )}
          </p>
        )}
      </div>
      {ctx.unit_total > 0 && (
        <UnitProgressRing mastered={ctx.unit_mastered} total={ctx.unit_total} />
      )}
    </div>
  );
}

function CurrentContent({ ctx, irt, sigma, gateProgress }: {
  ctx: ItemFrontierContext;
  irt?: IrtProbabilityData;
  sigma?: number;
  gateProgress?: GateProgress;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs text-blue-300 font-medium">
              {ctx.next_skill_name
                ? `Building towards ${ctx.next_skill_name}`
                : `Building skills in ${ctx.unit_name}`
              }
            </p>
            {irt && <ProbabilityPill pCorrect={irt.p_correct} />}
          </div>
          <div className="flex items-center gap-2">
            {ctx.unit_total > 0 && (
              <p className="text-[10px] text-slate-500">
                {ctx.unit_mastered} of {ctx.unit_total} done in {ctx.unit_name}
              </p>
            )}
            {sigma !== undefined && <ConfidenceIndicator sigma={sigma} />}
          </div>
        </div>
        {ctx.unit_total > 0 && (
          <UnitProgressRing mastered={ctx.unit_mastered} total={ctx.unit_total} />
        )}
      </div>
      {gateProgress && <GateReadiness gateProgress={gateProgress} irt={irt} />}
    </div>
  );
}

function ReviewContent({ ctx, irt }: { ctx: ItemFrontierContext; irt?: IrtProbabilityData }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs text-emerald-300 font-medium">
            Reinforcing {ctx.unit_name}
          </p>
          {irt && <ProbabilityPill pCorrect={irt.p_correct} />}
        </div>
        {ctx.last_tested_ago && (
          <p className="text-[10px] text-slate-500">
            Last tested {ctx.last_tested_ago}
          </p>
        )}
      </div>
    </div>
  );
}

function ColdStartContent() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-violet-300 font-medium">
          Let&apos;s find out what you already know!
        </p>
        <p className="text-[10px] text-slate-500">
          We&apos;re mapping your starting point
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const FrontierContextCard: React.FC<FrontierContextCardProps> = ({
  band,
  itemContext,
  sessionContext,
  isColdStart = false,
  irt,
  gateProgress,
  sigma,
}) => {
  // Don't render if no context available
  if (!itemContext && !isColdStart) return null;

  const borderColor =
    band === 'frontier' ? 'border-violet-500/15' :
    band === 'current' ? 'border-blue-500/15' :
    'border-emerald-500/15';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`glass-panel rounded-xl border ${borderColor} px-4 py-3 mb-4`}
    >
      {isColdStart ? (
        <ColdStartContent />
      ) : itemContext ? (
        band === 'frontier' ? <FrontierContent ctx={itemContext} irt={irt} /> :
        band === 'current' ? <CurrentContent ctx={itemContext} irt={irt} sigma={sigma} gateProgress={gateProgress} /> :
        <ReviewContent ctx={itemContext} irt={irt} />
      ) : null}
    </motion.div>
  );
};
