import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeekProjectionData, EndOfYearScenarios, MonthlyWarning, SubjectMonthlyProjection } from './types';

export const ProjectionChart: React.FC<{ weeks: WeekProjectionData[]; total: number }> = ({ weeks, total }) => {
  if (weeks.length === 0) return null;

  const maxMastered = total || Math.max(...weeks.map(w => w.cumulativeMastered.optimistic), 1);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-wider mb-2">
        <span>Week-by-week mastery projection</span>
        <span>{total} total skills</span>
      </div>
      <div className="flex gap-[2px] h-32">
        {weeks.map((w) => {
          const optH = (w.cumulativeMastered.optimistic / maxMastered) * 100;
          const bestH = (w.cumulativeMastered.bestEstimate / maxMastered) * 100;
          const pessH = (w.cumulativeMastered.pessimistic / maxMastered) * 100;

          return (
            <div
              key={w.week}
              className="flex-1 h-full relative group"
              title={`Week ${w.week} (${w.weekOf})\nOpt: ${w.cumulativeMastered.optimistic}\nBest: ${w.cumulativeMastered.bestEstimate}\nPess: ${w.cumulativeMastered.pessimistic}`}
            >
              {/* Optimistic bar (lightest, background) */}
              <div
                className="w-full rounded-t-sm bg-emerald-500/15 absolute bottom-0"
                style={{ height: `${optH}%` }}
              />
              {/* Best estimate bar */}
              <div
                className="w-full rounded-t-sm bg-cyan-500/30 absolute bottom-0"
                style={{ height: `${bestH}%` }}
              />
              {/* Pessimistic bar (darkest, foreground) */}
              <div
                className="w-full rounded-t-sm bg-blue-500/50 absolute bottom-0"
                style={{ height: `${pessH}%` }}
              />
              {/* Hover tooltip */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-slate-800 border border-white/10 rounded px-2 py-1 text-[10px] text-slate-300 whitespace-nowrap shadow-lg">
                <div className="font-medium">Wk {w.week}</div>
                <div className="text-emerald-400">Opt: {w.cumulativeMastered.optimistic}</div>
                <div className="text-cyan-400">Best: {w.cumulativeMastered.bestEstimate}</div>
                <div className="text-blue-400">Pess: {w.cumulativeMastered.pessimistic}</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex gap-4 justify-center mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-emerald-500/15 border border-emerald-500/30" />
          <span className="text-[10px] text-slate-500">Optimistic</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-cyan-500/30 border border-cyan-500/40" />
          <span className="text-[10px] text-slate-500">Best est.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-blue-500/50 border border-blue-500/40" />
          <span className="text-[10px] text-slate-500">Pessimistic</span>
        </div>
      </div>
    </div>
  );
};

export const EndOfYearCard: React.FC<{ scenarios: EndOfYearScenarios; total: number }> = ({ scenarios, total }) => {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">Optimistic</div>
        <div className="text-xl font-bold text-emerald-400">{scenarios.optimistic.closed}</div>
        <div className="text-[10px] text-slate-500">
          {scenarios.optimistic.remainingGap > 0
            ? `${scenarios.optimistic.remainingGap} gap`
            : 'Complete'
          }
        </div>
        <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500/60"
            style={{ width: `${total > 0 ? (scenarios.optimistic.closed / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
        <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1">Best Est.</div>
        <div className="text-xl font-bold text-cyan-400">{scenarios.bestEstimate.closed}</div>
        <div className="text-[10px] text-slate-500">
          {scenarios.bestEstimate.remainingGap > 0
            ? `${scenarios.bestEstimate.remainingGap} gap`
            : 'Complete'
          }
        </div>
        <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-500/60"
            style={{ width: `${total > 0 ? (scenarios.bestEstimate.closed / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">Pessimistic</div>
        <div className="text-xl font-bold text-blue-400">{scenarios.pessimistic.closed}</div>
        <div className="text-[10px] text-slate-500">
          {scenarios.pessimistic.remainingGap > 0
            ? `${scenarios.pessimistic.remainingGap} gap`
            : 'Complete'
          }
        </div>
        <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500/60"
            style={{ width: `${total > 0 ? (scenarios.pessimistic.closed / total) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export const MonthlyWarningRow: React.FC<{ warning: MonthlyWarning }> = ({ warning }) => {
  const typeConfig: Record<string, { label: string; color: string }> = {
    review_overload_projected: { label: 'Overload', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
    zero_new_capacity_projected: { label: 'No Capacity', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  };
  const cfg = typeConfig[warning.type] || { label: warning.type, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-xs font-mono text-slate-500 w-10 text-right flex-shrink-0">Wk {warning.week}</span>
      <span className={`px-2 py-0.5 rounded text-[10px] border flex-shrink-0 ${cfg.color}`}>
        {cfg.label}
      </span>
      <span className="text-slate-300">{warning.message}</span>
    </div>
  );
};

export const WeekByWeekTable: React.FC<{ weeks: WeekProjectionData[] }> = ({ weeks }) => {
  const [expanded, setExpanded] = useState(false);
  const displayWeeks = expanded ? weeks : weeks.slice(0, 4);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Week-by-Week Detail</div>
        {weeks.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {expanded ? 'Show less' : `Show all ${weeks.length} weeks`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-white/5">
              <th className="text-left py-1.5 pr-3 font-medium">Wk</th>
              <th className="text-left py-1.5 pr-3 font-medium">Date</th>
              <th className="text-right py-1.5 pr-3 font-medium">
                Reviews
                <span className="block text-[8px] text-slate-600 font-normal">2w/4w/6w</span>
              </th>
              <th className="text-right py-1.5 pr-3 font-medium">New</th>
              <th className="text-right py-1.5 pr-3 font-medium">Closures</th>
              <th className="text-right py-1.5 pr-3 font-medium">Open Inv.</th>
              <th className="text-right py-1.5 font-medium">Mastered</th>
            </tr>
          </thead>
          <tbody>
            {displayWeeks.map((w) => (
              <tr key={w.week} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="py-1.5 pr-3 text-slate-400 font-mono">{w.week}</td>
                <td className="py-1.5 pr-3 text-slate-400">{w.weekOf}</td>
                <td className="py-1.5 pr-3 text-right font-mono">
                  <span className="text-blue-400">{w.projectedReviewsDue}</span>
                </td>
                <td className="py-1.5 pr-3 text-right text-emerald-400 font-mono">{w.projectedNewIntroductions}</td>
                <td className="py-1.5 pr-3 text-right text-cyan-400 font-mono">{w.projectedClosures}</td>
                <td className="py-1.5 pr-3 text-right text-slate-300 font-mono">{w.projectedOpenInventory}</td>
                <td className="py-1.5 text-right font-mono">
                  <span className="text-emerald-400">{w.cumulativeMastered.optimistic}</span>
                  <span className="text-slate-600 mx-0.5">/</span>
                  <span className="text-cyan-400">{w.cumulativeMastered.bestEstimate}</span>
                  <span className="text-slate-600 mx-0.5">/</span>
                  <span className="text-blue-400">{w.cumulativeMastered.pessimistic}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const SubjectProjectionCard: React.FC<{ name: string; projection: SubjectMonthlyProjection }> = ({ name, projection }) => {
  const { currentState, weekByWeek, endOfYearProjection, warnings } = projection;
  const total = currentState.total;
  const currentProgress = total > 0 ? ((currentState.closed + currentState.inReview) / total) * 100 : 0;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-100 capitalize flex items-center justify-between">
          {name}
          <span className="text-xs font-normal text-slate-500">
            {currentState.closed}/{total} closed ({Math.round(currentProgress)}%)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current state summary */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-white/5">
            <div className="text-lg font-bold text-white">{total}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-lg font-bold text-emerald-400">{currentState.closed}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Closed</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-lg font-bold text-blue-400">{currentState.inReview}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">In Review</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
            <div className="text-lg font-bold text-slate-400">{currentState.notStarted}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Not Started</div>
          </div>
        </div>

        {/* Projection chart */}
        <div className="p-3 rounded-lg bg-slate-800/30 border border-white/5">
          <ProjectionChart weeks={weekByWeek} total={total} />
        </div>

        {/* End of year scenarios */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">End of Year Projection</div>
          <EndOfYearCard scenarios={endOfYearProjection} total={total} />
        </div>

        {/* Week-by-week detail table (collapsible) */}
        {weekByWeek.length > 0 && (
          <WeekByWeekTable weeks={weekByWeek} />
        )}

        {/* Subject warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="text-[10px] text-amber-400 uppercase tracking-wider">Warnings</div>
            {warnings.map((w, i) => (
              <MonthlyWarningRow key={`${w.type}-${w.week}-${i}`} warning={w} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
