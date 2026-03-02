'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import type { SubjectProgressSummary } from '@/lib/skillProgressApi';

interface ProgressOverviewProps {
  subjects: Record<string, SubjectProgressSummary>;
}

function formatSubject(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ProgressOverview: React.FC<ProgressOverviewProps> = ({ subjects }) => {
  const entries = Object.entries(subjects).filter(([, s]) => s.total > 0);

  if (entries.length === 0) return null;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Your Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([subject, summary]) => {
          const masteredPct = summary.total > 0 ? (summary.mastered / summary.total) * 100 : 0;
          const inProgressPct = summary.total > 0 ? (summary.in_progress / summary.total) * 100 : 0;

          return (
            <div key={subject} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">
                  {formatSubject(subject)}
                </span>
                <span className="text-xs text-slate-400">
                  {summary.mastered}/{summary.total} mastered
                </span>
              </div>
              {/* Segmented progress bar: green (mastered) + blue (in-progress) + gray (not started) */}
              <div className="h-2 w-full rounded-full bg-slate-700/50 overflow-hidden flex">
                {masteredPct > 0 && (
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${masteredPct}%` }}
                  />
                )}
                {inProgressPct > 0 && (
                  <div
                    className="h-full bg-blue-500/70 transition-all"
                    style={{ width: `${inProgressPct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-500">Mastered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500/70" />
            <span className="text-xs text-slate-500">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700/50" />
            <span className="text-xs text-slate-500">Not Started</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressOverview;
