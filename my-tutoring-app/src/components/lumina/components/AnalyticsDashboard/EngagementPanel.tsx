import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EngagementMetricsResponse } from '@/lib/studentAnalyticsAPI';
import { StatPill } from './shared';

function EngagementBars({ breakdown }: { breakdown: EngagementMetricsResponse['daily_breakdown'] }) {
  if (!breakdown.length) return <div className="text-slate-500 text-sm">No data</div>;

  const maxAttempts = Math.max(...breakdown.map(d => d.attempts), 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {breakdown.map((day, i) => {
        const heightPct = (day.attempts / maxAttempts) * 100;
        const isActive = day.attempts > 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${day.date}: ${day.attempts} attempts, avg ${day.avg_score.toFixed(1)}`}>
            <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
              <div
                className={`w-full rounded-t ${isActive ? 'bg-gradient-to-t from-blue-600 to-cyan-400' : 'bg-slate-800'}`}
                style={{ height: `${Math.max(heightPct, 2)}%`, minHeight: '2px' }}
              />
            </div>
            <span className="text-[7px] text-slate-600 truncate w-full text-center">
              {day.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function EngagementPanel({ data }: { data: EngagementMetricsResponse | null }) {
  if (!data) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-8 text-center text-slate-500">
          No engagement data. Load a student first.
        </CardContent>
      </Card>
    );
  }

  const s = data.summary;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatPill label="Active Days" value={s.total_active_days.toString()} color="blue" />
        <StatPill label="Current Streak" value={`${s.streak_current}d`} color="emerald" />
        <StatPill label="Longest Streak" value={`${s.streak_longest}d`} color="purple" />
        <StatPill label="Avg Daily" value={s.avg_daily_attempts.toFixed(1)} color="cyan" />
      </div>

      {/* Daily breakdown bar chart */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-100">
            Daily Activity (last {data.days_analyzed} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EngagementBars breakdown={data.daily_breakdown} />
        </CardContent>
      </Card>

      {/* Total attempts */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-4 flex items-center justify-between">
          <span className="text-sm text-slate-400">Total Attempts</span>
          <span className="text-lg font-bold text-slate-100">{s.total_attempts.toLocaleString()}</span>
        </CardContent>
      </Card>
    </div>
  );
}
