import type { SubskillData } from '@/lib/studentAnalyticsAPI';

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function scorePct(v: number): string {
  return `${Math.round(v * 10)}%`;
}

export function masteryColor(v: number): string {
  if (v >= 0.8) return 'emerald';
  if (v >= 0.5) return 'amber';
  return 'red';
}

export function masteryGradient(v: number): string {
  if (v >= 0.8) return 'from-emerald-500 to-emerald-400';
  if (v >= 0.5) return 'from-amber-500 to-amber-400';
  return 'from-red-500 to-red-400';
}

export function gateStatusBadge(ss: SubskillData) {
  const gate = ss.current_gate ?? 0;
  const lessonCount = ss.lesson_eval_count ?? 0;
  const isReady = ss.readiness_status?.toLowerCase() === 'ready';

  if (gate === 4) return { label: 'Mastered', bg: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-400' };
  if (gate === 3) return { label: 'Reviewing', bg: 'bg-cyan-500/20 border-cyan-500/30', text: 'text-cyan-400' };
  if (gate === 2) return { label: 'Reviewing', bg: 'bg-blue-500/20 border-blue-500/30', text: 'text-blue-400' };
  if (gate === 1) return { label: 'Initial Mastery', bg: 'bg-amber-500/20 border-amber-500/30', text: 'text-amber-400' };
  // Gate 0
  if (lessonCount > 0) return { label: `Learning (${lessonCount}/3)`, bg: 'bg-teal-500/20 border-teal-500/30', text: 'text-teal-400' };
  if (isReady) return { label: 'Not Started', bg: 'bg-slate-500/20 border-slate-500/30', text: 'text-slate-400' };
  return { label: 'Locked', bg: 'bg-slate-700/20 border-slate-700/30', text: 'text-slate-600' };
}

export function isRetestOverdue(nextRetestEligible: string | null | undefined): boolean {
  if (!nextRetestEligible) return false;
  try { return new Date(nextRetestEligible) < new Date(); } catch { return false; }
}

export function bandSuccessLabel(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}
