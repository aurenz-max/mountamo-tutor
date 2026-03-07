import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { StudentMetrics } from '@/lib/studentAnalyticsAPI';
import { pct, scorePct } from './helpers';
import { StatPill, MasteryBar } from './shared';

export function OverviewPanel({ metrics }: { metrics: StudentMetrics }) {
  const s = metrics.summary;
  return (
    <div className="space-y-4">
      {/* Primary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatPill label="Mastery" value={pct(s.mastery)} color="emerald" />
        <StatPill label="Proficiency" value={pct(s.proficiency)} color="blue" />
        <StatPill label="Avg Score" value={scorePct(s.avg_score)} color="cyan" />
        <StatPill label="Completion" value={pct(s.completion)} color="purple" />
      </div>
      {/* Secondary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatPill label="Attempted" value={`${s.attempted_items} / ${s.total_items}`} color="slate" />
        <StatPill label="Total Attempts" value={s.attempt_count.toLocaleString()} color="slate" />
        <StatPill label="Ready Items" value={s.ready_items.toString()} color="emerald" />
        <StatPill label="Recommended" value={s.recommended_items.toString()} color="amber" />
      </div>
      {/* Overall mastery bar */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Overall Mastery</span>
            <span className="text-slate-100 font-bold">{pct(s.mastery)}</span>
          </div>
          <MasteryBar value={s.mastery} />
        </CardContent>
      </Card>
    </div>
  );
}
