'use client';

/**
 * DailyLessonPlan — the student-facing outline for today's planned blocks.
 *
 * When embedded beneath SessionRibbon, the ribbon owns session progress and
 * the primary action. This component then shows one focused current block and
 * compact rows for everything already completed or coming later.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  RefreshCw,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  fetchDailySessionPlan,
  prettySubject,
  type BlockType,
  type DailySessionPlan,
  type LessonBlock,
} from '@/lib/sessionPlanAPI';

const BLOCK_TYPE_CONFIG: Record<BlockType, {
  label: string;
  icon: React.ElementType;
}> = {
  lesson: { label: 'New Lesson', icon: BookOpen },
  practice: { label: 'Practice', icon: Brain },
  retest: { label: 'Mastery Check', icon: Zap },
  pulse: { label: 'Daily Pulse', icon: Activity },
};

function BlockNumber({ index, completed = false }: { index: number; completed?: boolean }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
      completed
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        : 'border-white/10 bg-white/[0.04] text-slate-400'
    }`}>
      {completed ? <Check className="h-4 w-4" /> : index}
    </span>
  );
}

function BlockIdentity({ block }: { block: LessonBlock }) {
  const cfg = BLOCK_TYPE_CONFIG[block.type];
  const Icon = cfg.icon;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {cfg.label}
      </span>
      <span aria-hidden="true" className="text-slate-700">·</span>
      <span>{prettySubject(block.subject)}</span>
      <span aria-hidden="true" className="text-slate-700">·</span>
      <span className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        {block.estimated_minutes} min
      </span>
    </div>
  );
}

function CurrentBlockCard({
  block,
  result,
  showStartAction,
  onStart,
}: {
  block: LessonBlock;
  result?: BlockResult;
  showStartAction: boolean;
  onStart: (block: LessonBlock) => void;
}) {
  const primaryGoal = block.subskills[0]?.subskill_name;
  const additionalGoals = block.subskills.slice(1);

  return (
    <Card className="border-blue-500/25 bg-slate-900/45 ring-1 ring-blue-500/10 backdrop-blur-xl">
      <CardHeader className="px-5 pb-3 pt-5 md:px-6">
        <div className="flex items-start gap-3">
          <BlockNumber index={block.block_index} />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="border-blue-500/20 bg-blue-500/10 px-2 py-0 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                Now
              </Badge>
              <BlockIdentity block={block} />
            </div>
            <h3 className="text-xl font-semibold leading-tight text-slate-100">
              {block.title}
            </h3>
            {block.unit_title && block.unit_title !== block.title && (
              <p className="mt-1 text-xs text-slate-500">{block.unit_title}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 md:px-6">
        {primaryGoal && (
          <div className="ml-11 border-t border-white/5 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              What you&apos;ll explore
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              {primaryGoal}
            </p>

            {additionalGoals.length > 0 && (
              <details className="group mt-2">
                <summary className="w-fit cursor-pointer list-none text-xs text-slate-500 transition-colors hover:text-slate-300">
                  <span className="group-open:hidden">
                    + {additionalGoals.length} more {additionalGoals.length === 1 ? 'goal' : 'goals'}
                  </span>
                  <span className="hidden group-open:inline">Hide additional goals</span>
                </summary>
                <ul className="mt-2 space-y-1.5 border-l border-white/10 pl-3 text-xs leading-relaxed text-slate-500">
                  {additionalGoals.map((subskill, index) => (
                    <li key={`${subskill.subskill_id}-${index}`}>{subskill.subskill_name}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {showStartAction && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => onStart(block)}
              className="bg-gradient-to-r from-blue-500 to-violet-500 px-5 font-semibold text-white hover:from-blue-400 hover:to-violet-400"
            >
              Start
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {result && result.evalCount > 0 && (
          <p className="mt-3 text-right text-xs text-slate-500">
            {result.evalCount} answered · avg {Math.round(result.scoreSum / result.evalCount)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CompactBlockRow({
  block,
  completed,
  isNext,
  result,
}: {
  block: LessonBlock;
  completed: boolean;
  isNext: boolean;
  result?: BlockResult;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 transition-colors md:px-5 ${
      completed
        ? 'border-emerald-500/10 bg-emerald-500/[0.025]'
        : 'border-white/[0.07] bg-slate-900/25'
    }`}>
      <div className="flex items-center gap-3">
        <BlockNumber index={block.block_index} completed={completed} />

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${completed ? 'text-slate-500' : 'text-slate-300'}`}>
            {block.title}
          </p>
          <BlockIdentity block={block} />
        </div>

        <div className="shrink-0 text-right">
          {completed ? (
            <>
              <span className="text-xs font-medium text-emerald-400/80">Done</span>
              {result && result.evalCount > 0 && (
                <p className="mt-0.5 text-[10px] text-slate-600">
                  {Math.round(result.scoreSum / result.evalCount)}%
                </p>
              )}
            </>
          ) : (
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${
              isNext ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {isNext ? 'Up next' : 'Later'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BreakDivider() {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5 text-[11px] text-slate-600">
      <Coffee className="h-3.5 w-3.5" />
      <span>Break after this block</span>
    </div>
  );
}

/** Per-block evaluation results (passed from App.tsx session state). */
export interface BlockResult {
  evalCount: number;
  scoreSum: number;
}

interface DailyLessonPlanProps {
  studentId: string | number;
  completedBlockIds?: Set<string>;
  blockResults?: Record<string, BlockResult>;
  initialPlan?: DailySessionPlan | null;
  onPlanLoaded?: (plan: DailySessionPlan) => void;
  onBlockStart?: (block: LessonBlock) => void;
  /** The parent surface owns the session summary, progress, and primary CTA. */
  embedded?: boolean;
}

export function DailyLessonPlan({
  studentId,
  completedBlockIds,
  blockResults,
  initialPlan,
  onPlanLoaded,
  onBlockStart,
  embedded = false,
}: DailyLessonPlanProps) {
  const [plan, setPlan] = useState<DailySessionPlan | null>(initialPlan ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCompleted: Set<string> = (() => {
    const merged = new Set(plan?.completed_block_ids ?? []);
    completedBlockIds?.forEach(id => merged.add(id));
    return merged;
  })();

  const fetchPlan = useCallback(async (options?: { refresh?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailySessionPlan(studentId, options);
      setPlan(data);
      onPlanLoaded?.(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load session plan');
    } finally {
      setLoading(false);
    }
  }, [studentId, onPlanLoaded]);

  useEffect(() => {
    if (initialPlan) return;
    fetchPlan();
  }, [fetchPlan, initialPlan]);

  const handleStartBlock = useCallback((block: LessonBlock) => {
    onBlockStart?.(block);
  }, [onBlockStart]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">Building today&apos;s session plan…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
        <p className="mb-3 text-sm text-rose-400">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchPlan()}
          className="border border-white/20 bg-white/5 text-sm text-slate-100 hover:bg-white/10"
        >
          Try again
        </Button>
      </Card>
    );
  }

  if (!plan) return null;

  const totalBlocks = plan.blocks.length;
  const completedCount = plan.blocks.filter(block => effectiveCompleted.has(block.block_id)).length;
  const currentIndex = plan.blocks.findIndex(block => !effectiveCompleted.has(block.block_id));

  return (
    <div className="space-y-3">
      {!embedded && (
        <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
          <CardContent className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h2 className="truncate text-base font-semibold text-slate-100">
                  {plan.day_of_week}&apos;s Session
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {completedCount} of {totalBlocks} complete · about {plan.estimated_total_minutes} min
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {plan.warnings.length > 0 && (
        <div className="space-y-1.5">
          {plan.warnings.map((warning, index) => (
            <div key={index} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
              {warning}
            </div>
          ))}
        </div>
      )}

      {plan.blocks.length === 0 && (
        <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
          <CardContent className="py-12 text-center">
            <Star className="mx-auto mb-3 h-10 w-10 text-amber-400" />
            <p className="text-base font-medium text-slate-300">No blocks scheduled today</p>
            <p className="mt-1 text-sm text-slate-500">
              Your planner will schedule new content as prerequisites are met.
            </p>
          </CardContent>
        </Card>
      )}

      {plan.blocks.map((block, index) => {
        const completed = effectiveCompleted.has(block.block_id);
        const isCurrent = index === currentIndex;
        const isNext = currentIndex >= 0 && index === currentIndex + 1;

        return (
          <React.Fragment key={block.block_id}>
            {isCurrent ? (
              <CurrentBlockCard
                block={block}
                result={blockResults?.[block.block_id]}
                showStartAction={!embedded}
                onStart={handleStartBlock}
              />
            ) : (
              <CompactBlockRow
                block={block}
                completed={completed}
                isNext={isNext}
                result={blockResults?.[block.block_id]}
              />
            )}

            {block.insert_break_after && <BreakDivider />}
          </React.Fragment>
        );
      })}

      {completedCount > 0 && completedCount === totalBlocks && (
        <Card className="border-emerald-500/20 bg-slate-900/40 ring-1 ring-emerald-500/20 backdrop-blur-xl">
          <CardContent className="py-7 text-center">
            <p className="text-lg font-semibold text-emerald-300">Session complete!</p>
            <p className="mt-1 text-sm text-slate-500">
              You finished all {totalBlocks} blocks. Great work today!
            </p>
          </CardContent>
        </Card>
      )}

      {!embedded && (
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchPlan({ refresh: true })}
            disabled={loading}
            className="text-sm text-slate-500 hover:text-slate-300"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh plan
          </Button>
        </div>
      )}
    </div>
  );
}
