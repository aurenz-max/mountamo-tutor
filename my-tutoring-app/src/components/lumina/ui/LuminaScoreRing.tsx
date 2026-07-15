/**
 * LuminaScoreRing — the circular results score indicator.
 *
 * Extracted from PhaseSummaryPanel + EvaluationResultsIndicator (both hand-roll
 * their own SVG ring). Score-fills a ring, tier-colored, with the percentage
 * and tier label in the center. Tier comes from the shared TIERS config in
 * tokens (score → perfect/great/good/needs-work).
 *
 *   <LuminaScoreRing score={87} />
 *   <LuminaScoreRing score={42} size={96} showTier={false} />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { getPerformanceTier, TIERS } from './tokens';

export interface LuminaScoreRingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  score: number;
  /** Rendered diameter in px. Default 128. */
  size?: number;
  strokeWidth?: number;
  /** Show the tier badge ("Great Job!") beneath the percentage. Default true. */
  showTier?: boolean;
}

export const LuminaScoreRing: React.FC<LuminaScoreRingProps> = ({
  className,
  score,
  size = 128,
  strokeWidth = 8,
  showTier = true,
  ...props
}) => {
  const clamped = Math.max(0, Math.min(100, score));
  const tier = TIERS[getPerformanceTier(clamped)];
  const r = 60 - strokeWidth; // viewBox is 120×120
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} className="fill-none stroke-white/10" strokeWidth={strokeWidth} />
        <circle
          cx="60"
          cy="60"
          r={r}
          className={cn(
            'fill-none motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out',
            tier.ringStroke
          )}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{Math.round(clamped)}%</span>
        {showTier && (
          <span className={cn('mt-1 rounded-full border px-2 py-0.5 text-xs font-semibold', tier.badge)}>
            {tier.label}
          </span>
        )}
      </div>
    </div>
  );
};
