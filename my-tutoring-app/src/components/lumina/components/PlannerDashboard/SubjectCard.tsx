import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SubjectWeeklyStats } from './types';

export const SubjectCard: React.FC<{ name: string; stats: SubjectWeeklyStats }> = ({ name, stats }) => {
  const progress = stats.total_skills > 0
    ? ((stats.closed + stats.in_review) / stats.total_skills) * 100
    : 0;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-100 capitalize flex items-center justify-between">
          {name}
          {stats.behind_by > 0 && (
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {Math.round(stats.behind_by)} behind
            </span>
          )}
          {stats.behind_by === 0 && (
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              on track
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{stats.closed} closed / {stats.total_skills} total</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-lg font-bold text-emerald-400">{stats.closed}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Closed</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-lg font-bold text-blue-400">{stats.in_review}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">In Review</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
            <div className="text-lg font-bold text-slate-400">{stats.not_started}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Not Started</div>
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-white/5">
          <span>Weekly target: <span className="text-slate-300 font-medium">{stats.weekly_new_target} new</span></span>
          <span>Reserve: <span className="text-slate-300 font-medium">{stats.review_reserve}</span></span>
        </div>
      </CardContent>
    </Card>
  );
};
