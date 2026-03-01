import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SubjectVelocity as SubjectVelocityType } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const getVelocityColor = (velocity: number): { text: string; bg: string; border: string; label: string } => {
  if (velocity >= 1.2) return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Well Ahead' };
  if (velocity >= 1.0) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'On Track' };
  if (velocity >= 0.8) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Slightly Behind' };
  if (velocity >= 0.6) return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'Behind' };
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Critically Behind' };
};

const getVelocityGradient = (velocity: number): string => {
  if (velocity >= 1.2) return 'from-blue-500 to-cyan-400';
  if (velocity >= 1.0) return 'from-emerald-500 to-green-400';
  if (velocity >= 0.8) return 'from-amber-500 to-yellow-400';
  if (velocity >= 0.6) return 'from-orange-500 to-amber-400';
  return 'from-red-500 to-orange-400';
};

const driverLabels: Record<string, string> = {
  introduction: 'Introduction',
  pass_through: 'Pass-through',
  closure: 'Closure',
  all_healthy: 'All healthy',
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const VelocityGauge: React.FC<{ velocity: number; label: string; size?: 'lg' | 'sm' }> = ({ velocity, label, size = 'sm' }) => {
  const color = getVelocityColor(velocity);
  const pct = Math.min(velocity * 100, 200);
  const displayPct = Math.round(velocity * 100);
  const isLarge = size === 'lg';

  return (
    <div className={`text-center ${isLarge ? 'p-4' : 'p-3'} rounded-xl ${color.bg} border ${color.border}`}>
      <div className={`${isLarge ? 'text-4xl' : 'text-2xl'} font-bold ${color.text} font-mono`}>
        {displayPct}%
      </div>
      <div className={`${isLarge ? 'text-sm' : 'text-[10px]'} text-slate-500 uppercase tracking-wider mt-1`}>
        {label}
      </div>
      <div className={`mt-2 ${isLarge ? 'h-2' : 'h-1.5'} bg-slate-800 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getVelocityGradient(velocity)} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className={`mt-1 text-[10px] ${color.text}`}>{color.label}</div>
    </div>
  );
};

export const TrendSparkline: React.FC<{ trend: number[]; height?: number }> = ({ trend, height = 32 }) => {
  if (trend.length < 2) return <span className="text-[10px] text-slate-600">No trend data</span>;

  const min = Math.min(...trend) * 0.9;
  const max = Math.max(...trend) * 1.1;
  const range = max - min || 1;
  const w = 100;
  const stepX = w / (trend.length - 1);

  const points = trend.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const lastVal = trend[trend.length - 1];
  const prevVal = trend[trend.length - 2];
  const trendDir = lastVal > prevVal ? 'text-emerald-400' : lastVal < prevVal ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="flex items-center gap-2">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-24 h-8" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-cyan-400"
        />
        {/* Dots at each point */}
        {trend.map((v, i) => {
          const x = i * stepX;
          const y = height - ((v - min) / range) * height;
          return <circle key={i} cx={x} cy={y} r="1.5" className="fill-cyan-400" />;
        })}
      </svg>
      <span className={`text-xs font-mono ${trendDir}`}>
        {lastVal > prevVal ? '+' : ''}{Math.round((lastVal - prevVal) * 100)}%
      </span>
    </div>
  );
};

const DecompositionBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const color = getVelocityColor(value);
  const pct = Math.min(value * 100, 200);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={`font-mono ${color.text}`}>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getVelocityGradient(value)} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};

export const SubjectVelocityCard: React.FC<{ name: string; data: SubjectVelocityType }> = ({ name, data }) => {
  const color = getVelocityColor(data.velocity);

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-100 capitalize flex items-center justify-between">
          {name}
          <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${color.bg} ${color.text} border ${color.border}`}>
            {color.label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gauge + Trend row */}
        <div className="flex items-center gap-4">
          <VelocityGauge velocity={data.velocity} label="Velocity" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Earned: <span className="text-slate-200 font-mono">{data.earnedMastery}</span></span>
              <span>Expected: <span className="text-slate-200 font-mono">{data.adjustedExpectedMastery}</span></span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Closed: <span className="text-emerald-400 font-mono">{data.closed}</span></span>
              <span>Pipeline: <span className="text-blue-400 font-mono">+{data.inReviewEarned.toFixed(1)}</span></span>
              <span>Total: <span className="text-slate-200 font-mono">{data.totalSkills}</span></span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Trend</span>
              <TrendSparkline trend={data.trend} />
            </div>
          </div>
        </div>

        {/* Decomposition */}
        <div className="p-3 rounded-lg bg-slate-800/30 border border-white/5 space-y-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Velocity Decomposition</div>
          <DecompositionBar label="Introduction" value={data.decomposition.introductionVelocity} />
          <DecompositionBar label="Pass-through" value={data.decomposition.passThroughVelocity} />
          <DecompositionBar label="Closure" value={data.decomposition.closureVelocity} />
        </div>

        {/* Primary driver callout */}
        <div className={`p-3 rounded-lg border ${
          data.primaryDriver.component === 'all_healthy'
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              data.primaryDriver.component === 'all_healthy' ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              Primary Driver: {driverLabels[data.primaryDriver.component] || data.primaryDriver.component}
            </span>
            {data.primaryDriver.value !== null && (
              <span className={`text-xs font-mono ${getVelocityColor(data.primaryDriver.value).text}`}>
                ({Math.round(data.primaryDriver.value * 100)}%)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{data.primaryDriver.explanation}</p>
        </div>
      </CardContent>
    </Card>
  );
};
