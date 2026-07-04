import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, BookOpen, Brain, Clock, Coffee, Play, ChevronRight, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { prettySubject, type LessonBlock, type BlockType } from '@/lib/sessionPlanAPI';
import { analyticsApi, type SessionProgressTarget } from '@/lib/studentAnalyticsAPI';

// ─── Styling constants (matches DailyLessonPlan / SessionRibbon) ───────────

const SUBJECT_COLORS: Record<string, string> = {
  ELA: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'Language Arts': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Math: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Mathematics: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Science: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Social Studies': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};


// Full type identity — student-facing label, icon, and glass tints. Keep in
// sync with DailyLessonPlan's BLOCK_TYPE_CONFIG.
const BLOCK_TYPE_META: Record<BlockType, {
  label: string;
  icon: React.ElementType;
  badgeClass: string;
  tileClass: string;
  ringClass: string;
}> = {
  lesson: {
    label: 'New Lesson',
    icon: BookOpen,
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    tileClass: 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/25 text-cyan-300',
    ringClass: 'ring-cyan-500/20',
  },
  practice: {
    label: 'Practice',
    icon: Brain,
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    tileClass: 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/25 text-amber-300',
    ringClass: 'ring-amber-500/20',
  },
  retest: {
    label: 'Mastery Check',
    icon: Zap,
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    tileClass: 'bg-gradient-to-br from-rose-500/20 to-pink-500/20 border-rose-500/25 text-rose-300',
    ringClass: 'ring-rose-500/20',
  },
  pulse: {
    label: 'Daily Pulse',
    icon: Activity,
    badgeClass: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
    tileClass: 'bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border-fuchsia-500/25 text-fuchsia-300',
    ringClass: 'ring-fuchsia-500/20',
  },
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
  /** Needed for the evidence recap; recap is skipped when absent. */
  studentId?: string | number;
  /** ISO timestamp of when the completed block was launched ("since"). */
  blockStartedAt?: string | null;
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
  studentId,
  blockStartedAt,
  onContinue,
  onFinish,
}: SessionBreakScreenProps) {
  const [timeRemaining, setTimeRemaining] = useState(BREAK_DURATION);
  const [visible, setVisible] = useState(false);
  const [evidence, setEvidence] = useState<SessionProgressTarget[] | null>(null);

  // Evidence recap: what this block's work actually earned — gate advances,
  // first measurements, P(correct) movement. Server-side before/after from
  // theta_history/gate_history, so no client snapshot is needed. Fails
  // quietly: the recap section simply doesn't render. Pulse blocks may span
  // subjects, so targets are grouped and fetched per subject.
  useEffect(() => {
    if (!studentId || !blockStartedAt || completedBlock.subskills.length === 0) return;
    let cancelled = false;

    const bySubject = new Map<string, Array<{ subskillId: string; skillId: string }>>();
    for (const ss of completedBlock.subskills) {
      const subject = ss.subject || completedBlock.subject;
      if (!subject) continue;
      const lastDot = ss.subskill_id.lastIndexOf('.');
      const skillId = ss.skill_id
        || (lastDot > 0 ? ss.subskill_id.substring(0, lastDot) : ss.subskill_id);
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject)!.push({ subskillId: ss.subskill_id, skillId });
    }

    Promise.all(
      Array.from(bySubject.entries()).map(([subject, targets]) =>
        analyticsApi
          .getSessionProgress(Number(studentId), { subject, since: blockStartedAt, targets })
          .then(r => r.targets)
          .catch(() => [] as SessionProgressTarget[]),
      ),
    ).then(rows => {
      if (!cancelled) setEvidence(rows.flat());
    });

    return () => { cancelled = true; };
  }, [studentId, blockStartedAt, completedBlock]);

  // Only rows where something actually moved are worth celebrating.
  const evidenceRows = (evidence ?? []).filter(
    t => t.gateAdvanced || t.firstMeasurement
      || (t.pBefore != null && t.pAfter != null && Math.abs(t.pAfter - t.pBefore) >= 0.01),
  );

  // Student-facing names come from the block itself — the delta endpoint's
  // description is best-effort and can be empty, and a raw subskill ID must
  // never reach the student.
  const subskillNameById = new Map(
    completedBlock.subskills.map(ss => [ss.subskill_id, ss.subskill_name]),
  );
  const rowName = (row: SessionProgressTarget) =>
    subskillNameById.get(row.subskillId) || row.description || 'One of today’s skills';

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

  // ── Handoff copy — deterministic continuity between blocks ──
  // "Great work on your Language Arts lesson — now we're moving to Social
  // Studies, where we'll explore Places and Environments." Composed in code
  // from what we already know; no LLM, no latency, never generic.
  const doneSubject = prettySubject(completedBlock.subject);
  const headline = (() => {
    switch (completedBlock.type) {
      case 'pulse':    return 'Pulse done — evidence locked in!';
      case 'retest':   return `${doneSubject} mastery check complete!`;
      case 'practice': return `Great ${doneSubject} practice!`;
      default:         return `Great work on your ${doneSubject} lesson!`;
    }
  })();
  const handoff = (() => {
    if (!nextBlock) return null;
    const nextSubject = prettySubject(nextBlock.subject);
    const sameSubject = nextSubject === doneSubject;
    const title = nextBlock.title;
    switch (nextBlock.type) {
      case 'pulse':
        return 'Next up: a quick Daily Pulse to lock in your progress.';
      case 'retest':
        return sameSubject
          ? `Next, a quick mastery check on ${title} — show what stuck!`
          : `Next we hop over to ${nextSubject} for a quick mastery check on ${title}.`;
      case 'practice':
        return sameSubject
          ? `Staying with ${nextSubject} — time to practice ${title}.`
          : `Now we're moving to ${nextSubject} to practice ${title}.`;
      default:
        return sameSubject
          ? `Staying with ${nextSubject} — next we'll explore ${title}.`
          : `Now we're moving to ${nextSubject}, where we'll explore ${title}.`;
    }
  })();

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
      {/* ─── Section A: Progress Recap + handoff ─── */}
      <div className="text-center mb-8">
        <p className="text-emerald-400 text-sm font-medium mb-3 uppercase tracking-wider">
          {isLastBlock ? 'Session Complete' : 'Block Complete'}
        </p>
        <h2 className="text-3xl font-bold text-white mb-2">
          {headline}
        </h2>
        {handoff && (
          <p className="text-slate-300 text-lg mb-2">{handoff}</p>
        )}
        <p className="text-slate-500 text-sm">
          {completedCount} of {totalBlocks} blocks completed
          {evalCount > 0 && <span> &middot; {evalCount} questions answered</span>}
        </p>
      </div>

      {/* ─── Evidence recap: what this block's work earned ─── */}
      {evidenceRows.length > 0 && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 ring-1 ring-fuchsia-500/20 w-full mb-8">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-fuchsia-400" />
              <p className="text-fuchsia-300 font-medium text-sm uppercase tracking-wider">
                Your evidence counted
              </p>
            </div>
            <div className="space-y-2">
              {evidenceRows.map(row => (
                <div
                  key={row.subskillId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-slate-200 leading-snug min-w-0 truncate">
                    {rowName(row)}
                  </span>
                  <span className="shrink-0 text-xs">
                    {row.gateAdvanced ? (
                      <span className="text-emerald-300 font-semibold">
                        Gate {row.gateBefore} → {row.gateAfter} 🎉
                      </span>
                    ) : row.firstMeasurement ? (
                      <span className="text-cyan-300 font-medium">First evidence captured ✨</span>
                    ) : row.pBefore != null && row.pAfter != null && row.pAfter >= row.pBefore ? (
                      <span className="text-emerald-300/90">
                        {Math.round(row.pBefore * 100)}% → {Math.round(row.pAfter * 100)}% sure
                      </span>
                    ) : (
                      <span className="text-amber-300/90">Marked for another look</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
      ) : nextBlock && (() => {
        const meta = BLOCK_TYPE_META[nextBlock.type] ?? BLOCK_TYPE_META.lesson;
        const NextIcon = meta.icon;
        return (
        <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ring-1 ${meta.ringClass} w-full mb-8`}>
          <CardContent className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">Coming Up Next</p>

            <div className="flex items-start gap-4">
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.tileClass}`}>
                <NextIcon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-lg font-semibold text-white">{nextBlock.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    SUBJECT_COLORS[prettySubject(nextBlock.subject)] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                  }`}>
                    {prettySubject(nextBlock.subject)}
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
        );
      })()}

      {/* ─── Section D: CTA — same action identity as the ribbon's launch ─── */}
      <Button
        onClick={isLastBlock ? onFinish : onContinue}
        className={`px-10 py-6 text-lg font-semibold rounded-2xl transition-all duration-200 hover:scale-[1.03] text-white shadow-lg ${
          isLastBlock
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/25'
            : 'bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 shadow-blue-500/25'
        }`}
      >
        {isLastBlock ? (
          <>
            Finish Session
            <Sparkles className="w-5 h-5 ml-2" />
          </>
        ) : (
          <>
            <Play className="w-5 h-5 mr-2" />
            I&apos;m Ready
            <ChevronRight className="w-5 h-5 ml-1" />
          </>
        )}
      </Button>
    </div>
  );
}
