import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Coffee, ChevronRight, BookOpen, Sparkles } from 'lucide-react';
import type { LessonBlock } from '@/lib/sessionPlanAPI';

// ─── Styling constants (subset from DailyLessonPlan) ───────────────────────

const SUBJECT_COLORS: Record<string, string> = {
  ELA: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Math: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Science: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Social Studies': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const BLOCK_TYPE_STYLES: Record<string, string> = {
  lesson: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  practice: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  retest: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

const BLOOM_DOTS: Record<string, string> = {
  identify: 'bg-indigo-400',
  explain: 'bg-violet-400',
  apply: 'bg-emerald-400',
};

const BREAK_DURATION = 60; // seconds

// ─── Component ──────────────────────────────────────────────────────────────

interface SessionBreakScreenProps {
  completedBlock: LessonBlock;
  nextBlock: LessonBlock | null;
  stats: { total: number; completed: number } | null;
  blocks: LessonBlock[];
  completedBlockIds: Set<string>;
  evalCount: number;
  onContinue: () => void;
  onFinish: () => void;
}

export default function SessionBreakScreen({
  completedBlock,
  nextBlock,
  stats,
  blocks,
  completedBlockIds,
  evalCount,
  onContinue,
  onFinish,
}: SessionBreakScreenProps) {
  const [timeRemaining, setTimeRemaining] = useState(BREAK_DURATION);
  const [visible, setVisible] = useState(false);

  // Staggered entry animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemaining]);

  const isLastBlock = nextBlock === null;
  const completedCount = stats?.completed ?? 0;
  const totalBlocks = stats?.total ?? blocks.length;
  const progress = totalBlocks > 0 ? completedCount / totalBlocks : 0;

  // SVG ring dimensions
  const ringSize = 100;
  const strokeWidth = 6;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const timerProgress = timeRemaining / BREAK_DURATION;
  const dashOffset = circumference * (1 - timerProgress);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full px-4 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* ─── Section A: Progress Recap ─── */}
      <div className="text-center mb-8">
        <p className="text-emerald-400 text-sm font-medium mb-3 uppercase tracking-wider">
          {isLastBlock ? 'Session Complete' : 'Block Complete'}
        </p>
        <h2 className="text-3xl font-bold text-white mb-2">
          {completedBlock.celebration_message || 'Great work!'}
        </h2>
        <p className="text-slate-400 text-base">
          {completedCount} of {totalBlocks} blocks completed
          {evalCount > 0 && <span className="text-slate-500"> &middot; {evalCount} questions answered</span>}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {blocks.map((block, i) => {
          const done = completedBlockIds.has(block.block_id);
          const isCurrent = block.block_id === completedBlock.block_id;
          return (
            <div
              key={block.block_id}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                done
                  ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)]'
                  : 'bg-slate-700'
              } ${isCurrent && done ? 'ring-2 ring-cyan-400/50 ring-offset-1 ring-offset-slate-900' : ''}`}
              title={`Block ${i + 1}: ${block.title}`}
            />
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md h-2 bg-white/5 rounded-full overflow-hidden mb-10">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-700"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* ─── Section B: Timed Break ─── */}
      {!isLastBlock && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 w-full mb-8">
          <CardContent className="p-6 flex items-center gap-6">
            {/* Countdown ring */}
            <div className="flex-shrink-0">
              <svg width={ringSize} height={ringSize} className="transform -rotate-90">
                {/* Background ring */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={strokeWidth}
                />
                {/* Progress ring */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  fill="none"
                  stroke={timeRemaining > 0 ? 'rgb(251, 191, 36)' : 'rgb(52, 211, 153)'}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute flex items-center justify-center" style={{ marginTop: -ringSize, width: ringSize, height: ringSize }}>
                <span className={`text-lg font-bold ${timeRemaining > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {timeRemaining > 0 ? formatTime(timeRemaining) : ''}
                </span>
              </div>
            </div>

            <div className="flex-1">
              {timeRemaining > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Coffee className="w-4 h-4 text-amber-400" />
                    <p className="text-amber-300 font-medium text-base">Take a breather</p>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Stretch, get some water, rest your eyes.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <p className="text-emerald-300 font-medium text-base">Break&apos;s over!</p>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Ready when you are.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Section C: Next Block Preview / Session Complete ─── */}
      {isLastBlock ? (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-emerald-500/20 ring-1 ring-emerald-500/10 w-full mb-8">
          <CardContent className="p-8 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-2xl font-bold text-emerald-300 mb-2">Amazing work today!</p>
            <p className="text-slate-400 text-base">
              You finished all {totalBlocks} blocks. Time to celebrate!
            </p>
          </CardContent>
        </Card>
      ) : nextBlock && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 w-full mb-8">
          <CardContent className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">Coming Up Next</p>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-slate-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-lg font-semibold text-white">{nextBlock.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    SUBJECT_COLORS[nextBlock.subject] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                  }`}>
                    {nextBlock.subject}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    BLOCK_TYPE_STYLES[nextBlock.type] ?? ''
                  }`}>
                    {nextBlock.type}
                  </span>
                </div>

                {nextBlock.unit_title && (
                  <p className="text-slate-500 text-sm mb-2">{nextBlock.unit_title}</p>
                )}

                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    ~{nextBlock.estimated_minutes} min
                  </span>
                  <span>{nextBlock.subskills.length} subskill{nextBlock.subskills.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Bloom phase dots */}
                {nextBlock.bloom_phases.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    {nextBlock.bloom_phases.map((bp, i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-full ${BLOOM_DOTS[bp.phase] ?? 'bg-slate-500'}`}
                        title={`${bp.phase}: ${bp.subskill_name}`}
                      />
                    ))}
                    <span className="text-slate-600 text-xs ml-1">
                      {Array.from(new Set(nextBlock.bloom_phases.map(bp => bp.phase))).join(' → ')}
                    </span>
                  </div>
                )}

                {/* Subskill names */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {nextBlock.subskills.map(sk => (
                    <span
                      key={sk.subskill_id}
                      className="text-xs px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5"
                    >
                      {sk.subskill_name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Section D: CTA ─── */}
      <Button
        onClick={isLastBlock ? onFinish : onContinue}
        className={`px-10 py-4 text-lg font-semibold rounded-xl transition-all duration-200 hover:scale-105 ${
          isLastBlock
            ? 'bg-emerald-600/80 hover:bg-emerald-500/80 text-white border border-emerald-400/30'
            : 'bg-cyan-600/80 hover:bg-cyan-500/80 text-white border border-cyan-400/30'
        }`}
      >
        {isLastBlock ? 'Finish Session' : "I'm Ready"}
        <ChevronRight className="w-5 h-5 ml-1" />
      </Button>
    </div>
  );
}
