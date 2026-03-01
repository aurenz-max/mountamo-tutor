import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SubskillMasteryEntry, SubjectMasterySummary, SubskillForecast, UnitForecast as UnitForecastType } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GATE_LABELS = ['Not Started', 'Initial Mastery', 'Retest 1', 'Retest 2', 'Durable Mastery'];
export const GATE_COLORS = [
  'bg-slate-600',
  'bg-amber-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-emerald-500',
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const GateProgressDots: React.FC<{ gate: number }> = ({ gate }) => (
  <div className="flex items-center gap-1">
    {[0, 1, 2, 3, 4].map((g) => (
      <div
        key={g}
        className={`w-2.5 h-2.5 rounded-full transition-colors ${
          g <= gate ? GATE_COLORS[g] : 'bg-slate-700 border border-slate-600'
        }`}
        title={`Gate ${g}: ${GATE_LABELS[g]}`}
      />
    ))}
    <span className="ml-1.5 text-[10px] text-slate-500 font-mono">{gate}/4</span>
  </div>
);

export const GateDistributionBar: React.FC<{ byGate: Record<string, number>; total: number }> = ({ byGate, total }) => {
  if (total === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="h-3 rounded-full overflow-hidden flex">
        {[4, 3, 2, 1, 0].map((g) => {
          const count = byGate[String(g)] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={g}
              className={`h-full ${GATE_COLORS[g]} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`Gate ${g} (${GATE_LABELS[g]}): ${count}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-slate-500">
        {[0, 1, 2, 3, 4].map((g) => (
          <span key={g} className="flex items-center gap-0.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${GATE_COLORS[g]}`} />
            {byGate[String(g)] || 0}
          </span>
        ))}
      </div>
    </div>
  );
};

const SubskillMasteryRow: React.FC<{ entry: SubskillMasteryEntry; forecast?: SubskillForecast }> = ({ entry, forecast }) => {
  const completionPct = Math.round(entry.completion_pct * 100);
  const total = entry.passes + entry.fails;
  const passRate = total > 0 ? Math.round((entry.passes / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 border border-white/5 hover:border-white/10 transition-colors">
      <GateProgressDots gate={entry.current_gate} />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">{entry.subskill_id}</div>
        <div className="text-[10px] text-slate-500">{entry.skill_id}</div>
      </div>

      {/* Completion bar */}
      <div className="w-24 flex-shrink-0">
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-400 text-right mt-0.5 font-mono">{completionPct}%</div>
      </div>

      {/* Pass/fail stats */}
      <div className="text-right flex-shrink-0 hidden sm:block w-16">
        <div className="text-xs text-slate-400 font-mono">{entry.passes}P/{entry.fails}F</div>
        <div className="text-[10px] text-slate-500">{passRate}% pass</div>
      </div>

      {/* ETA */}
      {forecast && forecast.status === 'in_progress' && (
        <div className="text-right flex-shrink-0 hidden md:block w-16">
          <div className="text-xs text-amber-400 font-mono">{forecast.estimated_days}d</div>
          <div className="text-[10px] text-slate-500">{forecast.estimated_remaining_attempts} left</div>
        </div>
      )}
      {forecast && forecast.status === 'mastered' && (
        <div className="text-right flex-shrink-0 hidden md:block w-16">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Mastered
          </span>
        </div>
      )}
    </div>
  );
};

export const SubjectMasteryCard: React.FC<{
  name: string;
  summary: SubjectMasterySummary;
  forecasts: SubskillForecast[];
  subjectEta?: { estimated_days: number };
}> = ({ name, summary, forecasts, subjectEta }) => {
  const completionPct = Math.round(summary.average_completion_pct * 100);
  const [expanded, setExpanded] = useState(false);

  const forecastMap = new Map(forecasts.map(f => [f.subskill_id, f]));
  const displaySubskills = expanded ? summary.subskills : summary.subskills.slice(0, 5);

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-100 capitalize flex items-center justify-between">
          {name}
          <div className="flex items-center gap-2">
            {subjectEta && (
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                ~{Math.round(subjectEta.estimated_days)}d remaining
              </span>
            )}
            <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${
              summary.fully_mastered === summary.total
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
            }`}>
              {summary.fully_mastered}/{summary.total} mastered
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Completion bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Actuarial completion factor</span>
            <span className="font-mono">{completionPct}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        {/* Gate distribution */}
        <GateDistributionBar byGate={summary.by_gate} total={summary.total} />

        {/* Subskill rows */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">
            Subskills ({summary.subskills.length})
          </div>
          {displaySubskills.map((entry) => (
            <SubskillMasteryRow
              key={entry.subskill_id}
              entry={entry}
              forecast={forecastMap.get(entry.subskill_id)}
            />
          ))}
          {summary.subskills.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full text-center text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors py-1"
            >
              {expanded ? 'Show less' : `Show all ${summary.subskills.length} subskills`}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const UnitForecastRow: React.FC<{ unitId: string; data: UnitForecastType }> = ({ unitId, data }) => {
  const masteredPct = data.subskill_count > 0
    ? Math.round((data.mastered_count / data.subskill_count) * 100)
    : 0;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 border border-white/5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">{unitId}</div>
        <div className="text-[10px] text-slate-500 capitalize">{data.subject}</div>
      </div>
      <div className="w-20 flex-shrink-0">
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
            style={{ width: `${masteredPct}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-400 text-right mt-0.5">
          {data.mastered_count}/{data.subskill_count}
        </div>
      </div>
      <div className="text-right flex-shrink-0 w-16">
        {data.max_eta_days > 0 ? (
          <div className="text-xs text-amber-400 font-mono">{Math.round(data.max_eta_days)}d</div>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Done
          </span>
        )}
      </div>
    </div>
  );
};
