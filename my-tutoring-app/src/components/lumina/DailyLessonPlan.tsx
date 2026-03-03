'use client';

/**
 * DailyLessonPlan — PRD Daily Learning Experience §4 (Session Runner: Tier 1)
 *
 * Shows today's 4–5 lesson blocks in Lumina glass-card style.
 * Each block is a grouped set of related subskills ordered by Bloom's taxonomy.
 * "Start Block" navigates to the session driver (session runner — TBD).
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
  ELA:         'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Math:        'bg-blue-500/20   text-blue-300   border-blue-500/30',
  Science:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Social Studies': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  _default:    'bg-slate-500/20 text-slate-300 border-slate-500/30',
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
  onStart,
}: {
  block: LessonBlock;
  canStart: boolean;
  onStart: (block: LessonBlock) => void;
}) {
  const cfg   = BLOCK_TYPE_CONFIG[block.type];
  const Icon  = cfg.icon;

  return (
    <Card
      className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ring-1 ${cfg.ringClass} transition-all duration-200`}
    >
      {/* Block header */}
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Block number */}
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              {block.block_index}
            </span>

            {/* Block type badge */}
            <Badge className={`text-[10px] border px-2 py-0.5 ${cfg.badgeClass}`}>
              <Icon className="w-3 h-3 mr-1 inline" />
              {cfg.label}
            </Badge>

            {/* Subject badge */}
            <Badge className={`text-[10px] border px-2 py-0.5 ${subjectBadgeClass(block.subject)}`}>
              {block.subject}
            </Badge>

            {/* Duration */}
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ~{block.estimated_minutes} min
            </span>
          </div>
        </div>

        {/* Block title */}
        <h3 className="text-base font-semibold text-slate-100 mt-2">
          {block.title}
        </h3>
        {block.unit_title && block.unit_title !== block.title && (
          <p className="text-[11px] text-slate-500 mt-0.5">{block.unit_title}</p>
        )}
      </CardHeader>

      <CardContent className="px-5 pb-4">
        {/* Bloom's phase breakdown */}
        <div className="space-y-2 mb-4">
          {block.subskills.map((ss, i) => {
            const bloomCfg = BLOOM_CONFIG[ss.bloom_phase];
            return (
              <div key={`${ss.subskill_id}-${i}`} className="flex items-start gap-2">
                {/* Bloom dot */}
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${bloomCfg.dotClass}`} />
                {/* Phase label */}
                <span className="text-[10px] text-slate-500 uppercase tracking-wider w-14 shrink-0 pt-0.5">
                  {bloomCfg.label}
                </span>
                {/* Subskill name */}
                <span className={`text-xs leading-snug ${STATUS_CONFIG[ss.status]}`}>
                  {ss.subskill_name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Start button */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canStart}
            onClick={() => onStart(block)}
            className={
              canStart
                ? 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100 text-xs'
                : 'opacity-40 cursor-not-allowed text-slate-500 text-xs'
            }
          >
            {canStart ? (
              <>
                Start Block
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </>
            ) : (
              'Complete previous block first'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-white/5" />
      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
        <Coffee className="w-3.5 h-3.5 text-amber-400/60" />
        <span>Break point — stretch or get some water</span>
      </div>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DailyLessonPlanProps {
  studentId: string | number;
}

export function DailyLessonPlan({ studentId }: DailyLessonPlanProps) {
  const [plan, setPlan]         = useState<DailySessionPlan | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailySessionPlan(studentId);
      setPlan(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load session plan');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const handleStartBlock = useCallback((block: LessonBlock) => {
    // TODO: Navigate to session runner / lesson executor
    // For now: mark block as "in progress" and log
    console.log('[DailyLessonPlan] Starting block:', block);
    // Future: router.push(`/session/${block.lesson_group_id}?block=${block.block_id}`)
    alert(`Session runner coming soon!\n\nBlock: ${block.title}\nSubskills: ${block.subskills.length}`);
    setCompletedBlocks(prev => new Set(Array.from(prev).concat(block.block_id)));
  }, []);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Building today's session plan…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-6">
        <p className="text-rose-400 text-sm mb-3">{error}</p>
        <Button variant="ghost" size="sm" onClick={fetchPlan}
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100 text-xs">
          Try again
        </Button>
      </Card>
    );
  }

  if (!plan) return null;

  const completedCount = completedBlocks.size;
  const totalBlocks    = plan.blocks.length;
  const progressPct    = totalBlocks > 0 ? Math.round((completedCount / totalBlocks) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ---- Session header ---- */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-slate-100">
                  {plan.day_of_week}'s Session
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {totalBlocks} block{totalBlocks !== 1 ? 's' : ''} · ~{plan.estimated_total_minutes} min · {plan.total_subskills} subskills
              </p>
            </div>

            {/* Stats pills */}
            <div className="flex gap-2 flex-wrap justify-end">
              {plan.new_subskills > 0 && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                  {plan.new_subskills} new
                </span>
              )}
              {plan.review_subskills > 0 && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  {plan.review_subskills} review
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>{completedCount} of {totalBlocks} blocks complete</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Budget breakdown */}
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/5 text-center">
            <div className="flex-1">
              <div className="text-sm font-bold text-cyan-400">{plan.intro_budget_minutes} min</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">New Material</div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-amber-400">{plan.review_budget_minutes} min</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Reviews</div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-300">{plan.budget_minutes} min</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Total Budget</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Warnings ---- */}
      {plan.warnings.length > 0 && (
        <div className="space-y-1">
          {plan.warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* ---- Empty state ---- */}
      {plan.blocks.length === 0 && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-10 text-center">
            <Star className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-slate-300 text-sm font-medium">No blocks scheduled today</p>
            <p className="text-slate-500 text-xs mt-1">
              Your planner will schedule new content as prerequisites are met.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ---- Lesson blocks ---- */}
      {plan.blocks.map((block, i) => {
        const prevCompleted = i === 0 || completedBlocks.has(plan.blocks[i - 1].block_id);
        const isCompleted   = completedBlocks.has(block.block_id);

        return (
          <React.Fragment key={block.block_id}>
            <div className={`transition-opacity duration-200 ${isCompleted ? 'opacity-50' : 'opacity-100'}`}>
              <BlockCard
                block={block}
                canStart={prevCompleted && !isCompleted}
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

      {/* ---- Refresh ---- */}
      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={fetchPlan} disabled={loading}
          className="text-slate-500 hover:text-slate-300 text-xs">
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh plan
        </Button>
      </div>
    </div>
  );
}
