'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import type { AlmostReadyItem } from '@/lib/skillProgressApi';

interface AlmostReadyListProps {
  items: AlmostReadyItem[];
}

function formatSubject(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const AlmostReadyList: React.FC<AlmostReadyListProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Almost Ready
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item.skill_id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/5"
          >
            {/* Readiness indicator */}
            <div className="relative w-9 h-9 flex-shrink-0">
              <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18" cy="18" r="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-slate-700/50"
                />
                <circle
                  cx="18" cy="18" r="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${item.readiness * 94.2} 94.2`}
                  strokeLinecap="round"
                  className="text-amber-400"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-300">
                {Math.round(item.readiness * 100)}%
              </span>
            </div>

            {/* Skill info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200 truncate">
                  {item.skill_name}
                </span>
                <Badge
                  variant="outline"
                  className="bg-white/5 text-slate-400 border-white/10 text-[10px] px-1.5 py-0 flex-shrink-0"
                >
                  {formatSubject(item.subject)}
                </Badge>
              </div>
              {item.blockers.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  needs:{' '}
                  {item.blockers
                    .map((b) => `${b.name} (gate ${b.current_gate}/${b.target_gate})`)
                    .join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AlmostReadyList;
