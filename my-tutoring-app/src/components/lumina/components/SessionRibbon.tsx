'use client';

import React, { useState } from 'react';
import { ChevronDown, Play, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DailySessionPlan, LessonBlock } from '@/lib/sessionPlanAPI';

interface SessionRibbonProps {
  plan: DailySessionPlan | null;
  loading?: boolean;
  completedBlockIds: Set<string>;
  /** Free-form lessons finished today whose evidence attributed. */
  detourCount?: number;
  onContinue: (block: LessonBlock) => void;
  /** Full DailyLessonPlan shown on demand. */
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
      <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
        <CardContent className="flex items-center gap-3 px-5 py-4 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Setting up today&apos;s path…
        </CardContent>
      </Card>
    );
  }

  if (!plan || plan.blocks.length === 0) return null;

  const blocks = plan.blocks;
  const total = blocks.length;
  const done = blocks.filter(block => completedBlockIds.has(block.block_id)).length;
  const allDone = done >= total;
  const nextBlock = blocks.find(block => !completedBlockIds.has(block.block_id)) ?? null;
  const minutesLeft = blocks
    .filter(block => !completedBlockIds.has(block.block_id))
    .reduce((sum, block) => sum + block.estimated_minutes, 0);
  const progress = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card
        className={`overflow-hidden border-white/10 bg-slate-900/45 backdrop-blur-xl transition-colors ${
          allDone ? 'border-emerald-500/25' : ''
        }`}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-3 px-4 py-3.5 md:gap-4 md:px-5">
            <div className="min-w-0 flex-1 text-left">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Today&apos;s path
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {done} of {total}
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-slate-100 md:text-base">
                {allDone ? 'Path complete — follow your curiosity' : nextBlock?.title}
              </p>
              <p className="truncate text-xs text-slate-500">
                {allDone
                  ? 'Everything you explore next still counts.'
                  : `About ${minutesLeft} min remaining${
                      detourCount > 0 ? ` · ${detourCount} free-form ${detourCount === 1 ? 'lesson' : 'lessons'} counted` : ''
                    }`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setExpanded(previous => !previous)}
              aria-expanded={expanded}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-200"
            >
              <span className="hidden sm:inline">Plan</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {!allDone && nextBlock && (
              <Button
                onClick={() => onContinue(nextBlock)}
                className="shrink-0 bg-gradient-to-r from-blue-500 to-violet-500 px-4 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-400 hover:to-violet-400 md:px-5"
              >
                <Play className="mr-1.5 h-4 w-4" />
                {done === 0 ? 'Start' : 'Continue'}
              </Button>
            )}
          </div>

          <div className="h-px bg-white/5">
            <div
              className={`h-full transition-[width] duration-500 ${
                allDone ? 'bg-emerald-400' : 'bg-gradient-to-r from-cyan-400 to-violet-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {expanded && (
        <div className="mt-4 animate-fade-in text-left">
          {children}
        </div>
      )}
    </div>
  );
}

export default SessionRibbon;
