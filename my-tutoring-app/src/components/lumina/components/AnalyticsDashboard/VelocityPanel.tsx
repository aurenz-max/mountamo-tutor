import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VelocityGauge as PlannerVelocityGauge, TrendSparkline, SubjectVelocityCard, getVelocityColor } from '../PlannerDashboard/VelocityComponents';
import type { VelocityData } from '../PlannerDashboard/types';

export function VelocityPanel({ data }: { data: VelocityData | null }) {
  if (!data) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-8 text-center text-slate-500">
          No velocity data. Load a student first.
        </CardContent>
      </Card>
    );
  }

  const subjects = Object.entries(data.subjects);
  const aggColor = getVelocityColor(data.aggregate.velocity);

  return (
    <div className="space-y-6">
      {/* Aggregate overview */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Mastery Velocity — Pipeline-Adjusted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Overall gauge */}
            <PlannerVelocityGauge velocity={data.aggregate.velocity} label="Overall Velocity" size="lg" />

            {/* Earned / Expected */}
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <span className="text-slate-400">Earned Mastery</span>
                <span className="text-white font-mono font-bold">{data.aggregate.earnedMastery}</span>
                <span className="text-slate-400">Expected Mastery</span>
                <span className="text-white font-mono font-bold">{data.aggregate.adjustedExpectedMastery}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">8-week Trend</span>
                <TrendSparkline trend={data.aggregate.trend} />
              </div>
            </div>

            {/* School year progress */}
            <div className="text-center">
              <div className={`text-3xl font-bold font-mono ${aggColor.text}`}>
                {Math.round(data.schoolYear.fractionElapsed * 100)}%
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Year Elapsed</div>
              <div className="flex gap-2 mt-3">
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-white/5 text-center">
                  <div className="text-lg font-bold text-white">{data.schoolYear.weeksCompleted}</div>
                  <div className="text-[9px] text-slate-500 uppercase">Wks Done</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-white/5 text-center">
                  <div className="text-lg font-bold text-white">{data.schoolYear.weeksRemaining}</div>
                  <div className="text-[9px] text-slate-500 uppercase">Wks Left</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between text-[10px] text-slate-600 mt-4 pt-3 border-t border-white/5">
            <span>As of: {data.asOfDate}</span>
            <span>Velocity = Earned ({data.aggregate.earnedMastery}) / Expected ({data.aggregate.adjustedExpectedMastery})</span>
          </div>
        </CardContent>
      </Card>

      {/* Per-subject compact gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {subjects.map(([name, subj]) => (
          <PlannerVelocityGauge key={name} velocity={subj.velocity} label={name} />
        ))}
      </div>

      {/* Per-subject detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {subjects.map(([name, subj]) => (
          <SubjectVelocityCard key={name} name={name} data={subj} />
        ))}
      </div>
    </div>
  );
}
