'use client';

/**
 * DailyLessonPlan — PRD Daily Learning Experience §4 (Session Runner: Tier 1)
 *
 * Shows today's 4–5 lesson blocks in Lumina glass-card style.
 * Each block is a grouped set of related subskills ordered by Bloom's taxonomy.
 * "Start Block" fires onBlockStart(block) so the parent can launch the exhibit.
 *
 * completedBlockIds is an externally managed set passed from App.tsx so that
 * block completion state persists across remounts (e.g. after returning from
 * an exhibit). Internal completedBlocks is merged as an optimistic overlay.
 *
 * TODO (backend integration): On block completion, POST to
 *   /api/daily-activities/daily-plan/{studentId}/session/complete-block
 * with { block_id, lesson_group_id, subskill_ids[], eval_results[] }.
 * This lets the backend:
 *   - Update mastery lifecycle gate transitions
 *   - Mark the block as done so it doesn't re-appear tomorrow
 *   - Persist session progress for cross-device resumption
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  Coffee,
  RefreshCw,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';

import {
  fetchDailySessionPlan,
  type DailySessionPlan,
  type LessonBlock,
  type BloomLevel,
  type BlockType,
  type SkillStatus,
} from '@/lib/sessionPlanAPI';

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const BLOCK_TYPE_CONFIG: Record<BlockType, {
  label: string;
  badgeClass: string;
  icon: React.ElementType;
  ringClass: string;
}> = {
  lesson: {
    label: 'New Lesson',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    icon: BookOpen,
    ringClass: 'ring-cyan-500/30',
  },
  practice: {
    label: 'Practice',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: Brain,
    ringClass: 'ring-amber-500/30',
  },
  retest: {
    label: 'Mastery Check',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    icon: Zap,
    ringClass: 'ring-rose-500/30',
  },
};

const BLOOM_CONFIG: Record<BloomLevel, { label: string; dotClass: string }> = {
  identify: { label: 'Identify', dotClass: 'bg-indigo-400' },
  explain:  { label: 'Explain',  dotClass: 'bg-violet-400' },
  apply:    { label: 'Apply',    dotClass: 'bg-emerald-400' },
};

const STATUS_CONFIG: Record<SkillStatus, string> = {
  new:      'text-cyan-300',
  review:   'text-amber-300',
  retest:   'text-rose-300',
  mastered: 'text-emerald-300',
};

const SUBJECT_COLORS: Record<string, string> = {
  ELA:              'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Math:             'bg-blue-500/20   text-blue-300   border-blue-500/30',
  Science:          'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Social Studies': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  _default:         'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function subjectBadgeClass(subject: string): string {
  return SUBJECT_COLORS[subject] ?? SUBJECT_COLORS._default;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BlockCard({
  block,
  canStart,
  isCompleted,
  result,
  onStart,
}: {
  block: LessonBlock;
  canStart: boolean;
  isCompleted: boolean;
  result?: BlockResult;
  onStart: (block: LessonBlock) => void;
}) {
  const cfg  = BLOCK_TYPE_CONFIG[block.type];
  const Icon = cfg.icon;

  return (
    <Card
      className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ring-1 ${cfg.ringClass} transition-all duration-200`}
    >
      {/* Block header */}
      <CardHeader className="pb-4 pt-5 px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Block number + completion check */}
            <span className={`text-sm font-bold uppercase tracking-wider w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${
              isCompleted
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-white/5 border-white/10 text-slate-500'
            }`}>
              {isCompleted ? '✓' : block.block_index}
            </span>

            {/* Block type badge */}
            <Badge className={`text-xs border px-2.5 py-0.5 ${cfg.badgeClass}`}>
              <Icon className="w-3.5 h-3.5 mr-1 inline" />
              {cfg.label}
            </Badge>

            {/* Subject badge */}
            <Badge className={`text-xs border px-2.5 py-0.5 ${subjectBadgeClass(block.subject)}`}>
              {block.subject}
            </Badge>

            {/* Duration */}
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              ~{block.estimated_minutes} min
            </span>
          </div>
        </div>

        {/* Block title */}
        <h3 className="text-xl font-semibold text-slate-100 mt-3">
          {block.title}
        </h3>
        {block.unit_title && block.unit_title !== block.title && (
          <p className="text-xs text-slate-500 mt-1">{block.unit_title}</p>
        )}
      </CardHeader>

      <CardContent className="px-6 pb-5">
        {/* Bloom's phase breakdown */}
        <div className="space-y-2.5 mb-5">
          {block.subskills.map((ss, i) => {
            const bloomCfg = BLOOM_CONFIG[ss.bloom_phase];
            return (
              <div key={`${ss.subskill_id}-${i}`} className="flex items-start gap-3">
                {/* Bloom dot */}
                <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${bloomCfg.dotClass}`} />
                {/* Phase label */}
                <span className="text-xs text-slate-500 uppercase tracking-wider w-16 shrink-0 pt-0.5">
                  {bloomCfg.label}
                </span>
                {/* Subskill name */}
                <span className={`text-sm leading-snug ${STATUS_CONFIG[ss.status]}`}>
                  {ss.subskill_name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Start / Complete button */}
        <div className="flex justify-end">
          {isCompleted ? (
            <div className="flex items-center gap-3">
              {result && result.evalCount > 0 && (
                <span className="text-sm text-slate-400">
                  {result.evalCount} answered · avg {Math.round(result.scoreSum / result.evalCount)}%
                </span>
              )}
              <span className="text-sm text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">✓</span>
                Done
              </span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="default"
              disabled={!canStart}
              onClick={() => onStart(block)}
              className={
                canStart
                  ? 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100 text-sm px-5'
                  : 'opacity-40 cursor-not-allowed text-slate-500 text-sm'
              }
            >
              {canStart ? (
                <>
                  Start Block
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                'Complete previous block first'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BreakDivider() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-white/5" />
      <div className="flex items-center gap-2 text-slate-500 text-xs">
        <Coffee className="w-4 h-4 text-amber-400/60" />
        <span>Break point — stretch or get some water</span>
      </div>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/** Per-block evaluation results (passed from App.tsx session state). */
export interface BlockResult {
  evalCount: number;
  scoreSum: number;
}

interface DailyLessonPlanProps {
  studentId: string | number;
  /** Externally managed completed block IDs — persists across component remounts. */
  completedBlockIds?: Set<string>;
  /** Per-block evaluation results keyed by block_id. */
  blockResults?: Record<string, BlockResult>;
  /** Pre-loaded plan from parent — skips fetch when provided to avoid clobbering block IDs. */
  initialPlan?: DailySessionPlan | null;
  onPlanLoaded?: (plan: DailySessionPlan) => void;
  /** Called when the student clicks "Start Block". Parent should launch the exhibit. */
  onBlockStart?: (block: LessonBlock) => void;
}

export function DailyLessonPlan({
  studentId,
  completedBlockIds,
  blockResults,
  initialPlan,
  onPlanLoaded,
  onBlockStart,
}: DailyLessonPlanProps) {
  const [plan, setPlan]         = useState<DailySessionPlan | null>(initialPlan ?? null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  // Internal optimistic state: merged with external completedBlockIds below
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());

  // Merge external (persisted) + internal (optimistic) completed state
  const effectiveCompleted: Set<string> = (() => {
    const merged = new Set(Array.from(completedBlockIds ?? []));
    localCompleted.forEach(id => merged.add(id));
    return merged;
  })();

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailySessionPlan(studentId);
      setPlan(data);
      onPlanLoaded?.(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load session plan');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    // Skip fetch if parent already provided a plan (preserves block IDs across remounts)
    if (initialPlan) return;
    fetchPlan();
  }, [fetchPlan, initialPlan]);

  const handleStartBlock = useCallback((block: LessonBlock) => {
    console.log('[DailyLessonPlan] Starting block:', block.block_id, block.title);
    // Optimistic local mark (also set by parent via completedBlockIds on return)
    setLocalCompleted(prev => new Set(Array.from(prev).concat(block.block_id)));
    // Notify parent to launch the exhibit + track completion in App-level state
    onBlockStart?.(block);
    // TODO (backend integration): POST block start event
    // authApi.post(`/api/daily-activities/daily-plan/${studentId}/session/start-block`, {
    //   block_id: block.block_id,
    //   lesson_group_id: block.lesson_group_id,
    //   subskill_ids: block.subskills.map(s => s.subskill_id),
    // });
  }, [onBlockStart]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Building today's session plan…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-6">
        <p className="text-rose-400 text-sm mb-3">{error}</p>
        <Button variant="ghost" size="sm" onClick={fetchPlan}
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100 text-sm">
          Try again
        </Button>
      </Card>
    );
  }

  if (!plan) return null;

  const completedCount = effectiveCompleted.size;
  const totalBlocks    = plan.blocks.length;
  const progressPct    = totalBlocks > 0 ? Math.round((completedCount / totalBlocks) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ---- Session header ---- */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-6 pb-5 px-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-slate-100">
                  {plan.day_of_week}'s Session
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {totalBlocks} block{totalBlocks !== 1 ? 's' : ''} · ~{plan.estimated_total_minutes} min · {plan.total_subskills} subskills
              </p>
            </div>

            {/* Stats pills */}
            <div className="flex gap-2 flex-wrap justify-end">
              {plan.new_subskills > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                  {plan.new_subskills} new
                </span>
              )}
              {plan.review_subskills > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  {plan.review_subskills} review
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{completedCount} of {totalBlocks} blocks complete</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Budget breakdown */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-white/5 text-center">
            <div className="flex-1">
              <div className="text-base font-bold text-cyan-400">{plan.intro_budget_minutes} min</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">New Material</div>
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-amber-400">{plan.review_budget_minutes} min</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Reviews</div>
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-slate-300">{plan.budget_minutes} min</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Total Budget</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Warnings ---- */}
      {plan.warnings.length > 0 && (
        <div className="space-y-1.5">
          {plan.warnings.map((w, i) => (
            <div key={i} className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* ---- Empty state ---- */}
      {plan.blocks.length === 0 && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-12 text-center">
            <Star className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-slate-300 text-base font-medium">No blocks scheduled today</p>
            <p className="text-slate-500 text-sm mt-1">
              Your planner will schedule new content as prerequisites are met.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ---- Lesson blocks ---- */}
      {plan.blocks.map((block, i) => {
        const prevCompleted = i === 0 || effectiveCompleted.has(plan.blocks[i - 1].block_id);
        const isCompleted   = effectiveCompleted.has(block.block_id);

        return (
          <React.Fragment key={block.block_id}>
            <div className={`transition-opacity duration-200 ${isCompleted ? 'opacity-60' : 'opacity-100'}`}>
              <BlockCard
                block={block}
                canStart={prevCompleted && !isCompleted}
                isCompleted={isCompleted}
                result={blockResults?.[block.block_id]}
                onStart={handleStartBlock}
              />
            </div>

            {/* Break prompt between blocks */}
            {block.insert_break_after && (
              <BreakDivider />
            )}
          </React.Fragment>
        );
      })}

      {/* ---- Session complete celebration ---- */}
      {completedCount > 0 && completedCount === totalBlocks && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-emerald-500/20 ring-1 ring-emerald-500/20">
          <CardContent className="py-8 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-emerald-300 text-lg font-semibold">Session Complete!</p>
            <p className="text-slate-500 text-sm mt-1">
              You finished all {totalBlocks} blocks. Great work today!
            </p>
            {/* TODO (backend integration): POST session completion
                authApi.post(`/api/daily-activities/daily-plan/${studentId}/session/complete`) */}
          </CardContent>
        </Card>
      )}

      {/* ---- Refresh ---- */}
      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={fetchPlan} disabled={loading}
          className="text-slate-500 hover:text-slate-300 text-sm">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh plan
        </Button>
      </div>
    </div>
  );
}
