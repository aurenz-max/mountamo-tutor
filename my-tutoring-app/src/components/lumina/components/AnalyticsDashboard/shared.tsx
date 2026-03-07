import React from 'react';
import { masteryGradient } from './helpers';

export function StatPill({ label, value, color = 'blue' }: { label: string; value: string; color?: string }) {
  return (
    <div className={`p-3 rounded-lg bg-${color}-500/10 border border-${color}-500/20 text-center`}>
      <div className={`text-lg font-bold text-${color}-400`}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

export function MasteryBar({ value, className = '' }: { value: number; className?: string }) {
  const grad = masteryGradient(value);
  return (
    <div className={`h-2 bg-slate-800 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-500`}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}
