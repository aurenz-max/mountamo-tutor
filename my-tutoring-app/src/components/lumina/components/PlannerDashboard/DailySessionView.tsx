'use client';

/**
 * DailySessionView — PRD Daily Learning v2.0 §3.4, §4.2
 *
 * Two-phase session overview: Lesson Phase → Pulse Phase.
 * Shows both phases as visual cards with a flow indicator between them.
 * DailyLessonPlan renders below for lesson block detail.
 * Pulse launches full-screen via onStartPulse callback.
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Zap, ChevronRight, ChevronDown, Play } from 'lucide-react';
import { DailyLessonPlan } from '@/components/lumina/DailyLessonPlan';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DailySessionViewProps {
  studentId: string;
  onStartPulse: () => void;
  /** Optional custom lesson plan renderer (App.tsx passes its own with session state) */
  renderLessonPlan?: () => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DailySessionView: React.FC<DailySessionViewProps> = ({
  studentId,
  onStartPulse,
  renderLessonPlan,
}) => {
  const [showLessons, setShowLessons] = useState(false);

  return (
    <div className="space-y-6">
      {/* ── Two-phase session overview ── */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-6 pb-5">
          {/* Header */}
          <div className="text-center mb-5">
            <h2 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-violet-200">
              Today&apos;s Session
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Focused lessons followed by adaptive practice
            </p>
          </div>

          {/* Phase cards */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-stretch">
            {/* ── Lesson Phase ── */}
            <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/15 p-5 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-cyan-300">Phase 1: Lessons</h3>
                  <p className="text-[10px] text-slate-500">~25 min &middot; Bloom&apos;s scaffolded</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Focused instruction on subjects where you need the most growth.
                Identify &rarr; Explain &rarr; Apply.
              </p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                  1-3 lesson blocks
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                  EL-driven selection
                </span>
              </div>

              <div className="mt-auto">
                <Button
                  onClick={() => setShowLessons(!showLessons)}
                  variant="ghost"
                  className="w-full bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 text-cyan-300 text-sm"
                >
                  {showLessons ? (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1.5" />
                      Hide Lesson Blocks
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4 mr-1.5" />
                      View Lesson Blocks
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* ── Flow arrow ── */}
            <div className="hidden md:flex flex-col items-center justify-center gap-1 text-slate-600">
              <ChevronRight className="w-6 h-6" />
              <span className="text-[9px] uppercase tracking-widest font-mono">then</span>
            </div>
            <div className="md:hidden flex justify-center py-1">
              <div className="flex items-center gap-2 text-slate-600">
                <div className="h-px w-8 bg-slate-700" />
                <span className="text-[9px] uppercase tracking-widest font-mono">then</span>
                <div className="h-px w-8 bg-slate-700" />
              </div>
            </div>

            {/* ── Pulse Phase ── */}
            <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 p-5 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-violet-300">Phase 2: Pulse</h3>
                  <p className="text-[10px] text-slate-500">~45 min &middot; IRT-calibrated</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Adaptive practice across all subjects. Reviews, skill building,
                and frontier probes tuned to your level.
              </p>

              {/* 3-band preview */}
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                <div className="text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
                  <div className="text-emerald-400 text-sm font-bold">15%</div>
                  <div className="text-[9px] text-slate-500 uppercase">Review</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/15">
                  <div className="text-blue-400 text-sm font-bold">65%</div>
                  <div className="text-[9px] text-slate-500 uppercase">Build</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-violet-500/10 border border-violet-500/15">
                  <div className="text-violet-400 text-sm font-bold">20%</div>
                  <div className="text-[9px] text-slate-500 uppercase">Explore</div>
                </div>
              </div>

              <div className="mt-auto space-y-1.5">
                <Button
                  onClick={onStartPulse}
                  className="w-full bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white shadow-lg shadow-violet-500/20 text-sm"
                >
                  <Play className="w-4 h-4 mr-1.5" />
                  Start Pulse
                </Button>
                <p className="text-[10px] text-slate-600 text-center">
                  Best after lessons, but can start anytime
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Lesson blocks detail ── */}
      {showLessons && (
        renderLessonPlan ? renderLessonPlan() : <DailyLessonPlan studentId={studentId} />
      )}
    </div>
  );
};
