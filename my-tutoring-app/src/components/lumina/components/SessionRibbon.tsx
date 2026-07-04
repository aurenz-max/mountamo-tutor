'use client';

/**
 * SessionRibbon — Today's Session as ambient state on the home screen.
 *
 * The approved home direction (Home Lab mock): the "learn anything" hero is
 * sacred and untouched; the daily session lives in ONE compact ribbon under
 * it — progress ring, per-block beat dots, next-up label, a single
 * Continue/Start button that launches the next block through the existing
 * handleBlockStart path, and an expandable drawer holding the full
 * DailyLessonPlan. This replaces the two-click path (Today's Session card →
 * Phase 1/2 interstitial → Start), both of which are gone.
 *
 * Detours count visibly: evidence from free-form hero lessons already
 * attributes server-side, so the ribbon says so instead of guilt-tripping.
 * Done-state celebrates INTO exploration — never a gate on curiosity.
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Play, RefreshCw } from 'lucide-react';
import type { DailySessionPlan, LessonBlock, BlockType } from '@/lib/sessionPlanAPI';

// Beat-dot palette keyed by block type (matches DailyLessonPlan badges)
const BEAT_COLORS: Record<BlockType, { done: string; next: string; todo: string }> = {
  pulse: {
    done: 'bg-fuchsia-400',
    next: 'bg-fuchsia-500/40 ring-2 ring-fuchsia-400/60',
    todo: 'bg-fuchsia-500/25',
  },
  lesson: {
    done: 'bg-cyan-400',
    next: 'bg-cyan-500/40 ring-2 ring-cyan-400/60',
    todo: 'bg-cyan-500/25',
  },
  practice: {
    done: 'bg-amber-400',
    next: 'bg-amber-500/40 ring-2 ring-amber-400/60',
    todo: 'bg-amber-500/25',
  },
  retest: {
    done: 'bg-rose-400',
    next: 'bg-rose-500/40 ring-2 ring-rose-400/60',
    todo: 'bg-rose-500/25',
  },
};

const TYPE_EMOJI: Record<BlockType, string> = {
  pulse: '⚡',
  lesson: '🔷',
  practice: '🔶',
  retest: '🎯',
};

interface SessionRibbonProps {
  plan: DailySessionPlan | null;
  loading?: boolean;
  /** Merged server + optimistic completions (App owns this). */
  completedBlockIds: Set<string>;
  /** Free-form lessons finished today whose evidence attributed. */
  detourCount?: number;
  onContinue: (block: LessonBlock) => void;
  /** Drawer content — the App-wired DailyLessonPlan. */
  children?: React.ReactNode;
}

export function SessionRibbon({
  plan,
  loading,
  completedBlockIds,
  detourCount = 0,
  onContinue,
  children,
}: SessionRibbonProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading && !plan) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-4 px-5 flex items-center gap-3 text-slate-500 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Setting up today&apos;s session…
        </CardContent>
      </Card>
    );
  }

  if (!plan || plan.blocks.length === 0) return null;

  const blocks = plan.blocks;
  const total = blocks.length;
  const done = blocks.filter(b => completedBlockIds.has(b.block_id)).length;
  const allDone = done >= total;
  const nextBlock = blocks.find(b => !completedBlockIds.has(b.block_id)) ?? null;
  const minutesLeft = blocks
    .filter(b => !completedBlockIds.has(b.block_id))
    .reduce((sum, b) => sum + b.estimated_minutes, 0);

  const statusLine = allDone
    ? 'Session complete! 🎉'
    : done === 0
      ? `Ready — ${total} beat${total !== 1 ? 's' : ''}, ~${minutesLeft} min`
      : `Nice — ${done} down, ${minutesLeft} min left`;

  // Progress ring
  const ringSize = 44;
  const stroke = 4;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? done / total : 0;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card
        className={`backdrop-blur-xl bg-slate-900/50 border-white/10 transition-all duration-300 ${
          allDone ? 'ring-1 ring-emerald-500/25' : ''
        }`}
      >
        <CardContent className="py-3.5 px-4 md:px-5">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Progress ring */}
            <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
              <svg width={ringSize} height={ringSize} className="-rotate-90">
                <circle
                  cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none"
                  stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}
                />
                <circle
                  cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none"
                  stroke={allDone ? 'rgb(52,211,153)' : 'rgb(34,211,238)'}
                  strokeWidth={stroke} strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-200">
                {done}/{total}
              </span>
            </div>

            {/* Status + next-up */}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm md:text-base font-semibold text-slate-100 truncate">
                {statusLine}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {allDone ? (
                  <>Explore anything you like — detours always count.</>
                ) : nextBlock && (
                  <>
                    Next: <span className="text-slate-300">{TYPE_EMOJI[nextBlock.type]} {nextBlock.title}</span>
                    {detourCount > 0 && (
                      <span className="text-cyan-300/90"> · 🌊 {detourCount === 1 ? 'detour' : `${detourCount} detours`} · counted</span>
                    )}
                  </>
                )}
              </p>
            </div>

            {/* Beat dots — one per block, colored by type */}
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              {blocks.map(b => {
                const isDone = completedBlockIds.has(b.block_id);
                const isNext = nextBlock?.block_id === b.block_id;
                const palette = BEAT_COLORS[b.type];
                return (
                  <span
                    key={b.block_id}
                    title={`${b.title} · ~${b.estimated_minutes}m`}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      isNext ? 'w-7' : 'w-5'
                    } ${isDone ? palette.done : isNext ? palette.next : palette.todo}`}
                  />
                );
              })}
            </div>

            {/* Expand drawer */}
            <button
              onClick={() => setExpanded(prev => !prev)}
              aria-label={expanded ? 'Hide session details' : 'Show session details'}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shrink-0"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {/* The one launch button */}
            {!allDone && nextBlock && (
              <Button
                onClick={() => onContinue(nextBlock)}
                className="shrink-0 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white font-semibold shadow-lg shadow-blue-500/25 px-5"
              >
                <Play className="w-4 h-4 mr-1.5" />
                {done === 0 ? 'Start' : 'Continue'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expandable drawer — the full plan, same component as always */}
      {expanded && (
        <div className="mt-4 animate-fade-in text-left">
          {children}
        </div>
      )}
    </div>
  );
}

export default SessionRibbon;
