'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Lock, Hammer } from 'lucide-react';
import type { CraftingNowItem, PrerequisiteStatus } from '@/lib/skillProgressApi';

interface CraftingCardProps {
  item: CraftingNowItem;
  onStart?: (subskillId: string) => void;
}

function formatSubject(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function gateLabel(gate: number): string {
  if (gate >= 4) return 'Mastered';
  if (gate >= 1) return `Gate ${gate}/4`;
  return 'Not started';
}

function PrerequisiteRow({ prereq }: { prereq: PrerequisiteStatus }) {
  const pct = Math.round(prereq.completion_pct * 100);

  let Icon = Lock;
  let iconColor = 'text-slate-500';
  let barColor = 'bg-slate-600';

  if (prereq.met) {
    Icon = CheckCircle;
    iconColor = 'text-emerald-400';
    barColor = 'bg-emerald-500';
  } else if (prereq.current_gate > 0) {
    Icon = Clock;
    iconColor = 'text-amber-400';
    barColor = 'bg-amber-500';
  }

  return (
    <div className="flex items-center gap-3">
      <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-300 truncate">{prereq.name}</span>
          <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
            {prereq.met ? 'Done' : gateLabel(prereq.current_gate)}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-700/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${prereq.met ? 100 : pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const CraftingCard: React.FC<CraftingCardProps> = ({ item, onStart }) => {
  // Find the bottleneck: unmet prerequisite with highest gate (closest to done)
  const bottleneck = item.prerequisites
    .filter((p) => !p.met)
    .sort((a, b) => b.current_gate - a.current_gate)[0];

  const metCount = item.prerequisites.filter((p) => p.met).length;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Hammer className="w-4 h-4 text-blue-400" />
            {item.skill_name}
          </CardTitle>
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-xs"
          >
            {formatSubject(item.subject)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1.5 flex-1 rounded-full bg-slate-700/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${item.overall_readiness * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">
            {metCount}/{item.prerequisites.length} prereqs
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {item.prerequisites.map((prereq) => (
          <PrerequisiteRow key={prereq.subskill_id} prereq={prereq} />
        ))}

        {bottleneck && onStart && (
          <Button
            variant="ghost"
            className="w-full mt-2 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-200"
            onClick={() => onStart(bottleneck.subskill_id)}
          >
            Practice {bottleneck.name}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default CraftingCard;
