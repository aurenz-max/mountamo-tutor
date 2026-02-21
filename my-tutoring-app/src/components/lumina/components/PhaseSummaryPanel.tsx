'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ── Types ────────────────────────────────────────────────────────

/** Performance tier derived from score value */
export type PerformanceTier = 'perfect' | 'great' | 'good' | 'needs-work';

/** A single phase's result for display */
export interface PhaseResult {
  /** Human-readable label, e.g. "Identify Numerator" */
  label: string;
  /** Score 0-100 for this phase */
  score: number;
  /** Number of attempts the student made */
  attempts: number;
  /** Whether the student got it right on the first try */
  firstTry: boolean;
  /** Optional icon/emoji for the phase */
  icon?: string;
  /** Optional accent color for the progress bar */
  accentColor?: 'purple' | 'blue' | 'emerald' | 'amber' | 'cyan' | 'pink' | 'orange';
}

/** Props accepted by PhaseSummaryPanel */
export interface PhaseSummaryPanelProps {
  /** Array of per-phase results, in display order */
  phases: PhaseResult[];
  /** Overall score (0-100). If not provided, computed as average of phase scores */
  overallScore?: number;
  /** Total elapsed time in milliseconds */
  durationMs?: number;
  /** Optional heading text. Defaults to "Your Results" */
  heading?: string;
  /** Optional celebration message shown above the breakdown */
  celebrationMessage?: string;
  /** Whether to show the entry animation. Defaults to true */
  animate?: boolean;
  /** Optional callback when the panel finishes its entry animation */
  onAnimationComplete?: () => void;
  /** Additional className for the outer wrapper */
  className?: string;
}

// ── Tier config ──────────────────────────────────────────────────

function getPerformanceTier(score: number): PerformanceTier {
  if (score === 100) return 'perfect';
  if (score >= 80) return 'great';
  if (score >= 50) return 'good';
  return 'needs-work';
}

const TIER_CONFIG: Record<
  PerformanceTier,
  {
    label: string;
    emoji: string;
    ringColor: string;
    glowColor: string;
    badgeClasses: string;
    textColor: string;
  }
> = {
  perfect: {
    label: 'Perfect!',
    emoji: '\uD83C\uDF1F',
    ringColor: 'stroke-emerald-400',
    glowColor: 'bg-emerald-500',
    badgeClasses: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    textColor: 'text-emerald-400',
  },
  great: {
    label: 'Great Job!',
    emoji: '\u2B50',
    ringColor: 'stroke-blue-400',
    glowColor: 'bg-blue-500',
    badgeClasses: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    textColor: 'text-blue-400',
  },
  good: {
    label: 'Good Work',
    emoji: '\uD83D\uDC4D',
    ringColor: 'stroke-amber-400',
    glowColor: 'bg-amber-500',
    badgeClasses: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    textColor: 'text-amber-400',
  },
  'needs-work': {
    label: 'Keep Practicing',
    emoji: '\uD83D\uDCAA',
    ringColor: 'stroke-rose-400',
    glowColor: 'bg-rose-500',
    badgeClasses: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    textColor: 'text-rose-400',
  },
};

const ACCENT_BAR_CLASSES: Record<string, string> = {
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  cyan: 'bg-cyan-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
};

const TIER_BAR_CLASSES: Record<PerformanceTier, string> = {
  perfect: 'bg-emerald-500',
  great: 'bg-blue-500',
  good: 'bg-amber-500',
  'needs-work': 'bg-rose-500',
};

// ── Helpers ──────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

// ── Component ────────────────────────────────────────────────────

const PhaseSummaryPanel: React.FC<PhaseSummaryPanelProps> = ({
  phases,
  overallScore,
  durationMs,
  heading = 'Your Results',
  celebrationMessage,
  animate = true,
  onAnimationComplete,
  className,
}) => {
  const [visible, setVisible] = useState(!animate);
  const [ringProgress, setRingProgress] = useState(0);
  const [visibleRows, setVisibleRows] = useState<boolean[]>(
    phases.map(() => !animate),
  );

  const computedScore = useMemo(
    () =>
      overallScore ??
      (phases.length > 0
        ? Math.round(phases.reduce((sum, p) => sum + p.score, 0) / phases.length)
        : 0),
    [overallScore, phases],
  );

  const tier = getPerformanceTier(computedScore);
  const tierConfig = TIER_CONFIG[tier];

  // SVG ring math
  const ringRadius = 52;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference - (ringProgress / 100) * circumference;

  // Animation sequence on mount
  useEffect(() => {
    if (!animate) {
      setRingProgress(computedScore);
      return;
    }

    // 1. Fade in container
    const frameId = requestAnimationFrame(() => setVisible(true));

    // 2. Animate ring
    const ringTimer = setTimeout(() => setRingProgress(computedScore), 200);

    // 3. Stagger phase rows
    const rowTimers = phases.map((_, i) =>
      setTimeout(() => {
        setVisibleRows((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, 400 + i * 150),
    );

    // 4. Fire completion callback
    const completeTimer = setTimeout(
      () => onAnimationComplete?.(),
      400 + phases.length * 150 + 300,
    );

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(ringTimer);
      rowTimers.forEach(clearTimeout);
      clearTimeout(completeTimer);
    };
    // Run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card
      className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl overflow-hidden relative transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className || ''}`}
    >
      {/* Ambient glow */}
      <div
        className={`absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-20 ${tierConfig.glowColor}`}
      />

      <CardContent className="p-8 relative z-10">
        {/* ── Heading ─────────────────────────────────── */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-light text-white mb-2">
            {tierConfig.emoji} {heading} {tierConfig.emoji}
          </h3>
          {celebrationMessage && (
            <p className="text-slate-300 leading-relaxed">{celebrationMessage}</p>
          )}
        </div>

        {/* ── Score Ring ──────────────────────────────── */}
        <div className="flex justify-center mb-8">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              {/* Background ring */}
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                className="fill-none stroke-white/10"
                strokeWidth="8"
              />
              {/* Score ring */}
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                className={`fill-none ${tierConfig.ringColor}`}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{computedScore}%</span>
              <Badge className={`mt-1 text-xs border ${tierConfig.badgeClasses}`}>
                {tierConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* ── Duration ────────────────────────────────── */}
        {durationMs !== undefined && durationMs > 0 && (
          <div className="text-center text-sm text-slate-500 mb-6">
            Completed in {formatDuration(durationMs)}
          </div>
        )}

        {/* ── Phase Breakdown ─────────────────────────── */}
        <div className="space-y-4">
          <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">
            Phase Breakdown
          </h4>

          {phases.map((phase, i) => {
            const phaseTier = getPerformanceTier(phase.score);
            const barColor = phase.accentColor
              ? ACCENT_BAR_CLASSES[phase.accentColor]
              : TIER_BAR_CLASSES[phaseTier];
            const scoreTextColor = phase.accentColor
              ? `text-${phase.accentColor}-400`
              : TIER_CONFIG[phaseTier].textColor;

            return (
              <div
                key={i}
                className={`transition-all duration-300 ${
                  visibleRows[i]
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-2'
                }`}
                style={{
                  transitionDelay: animate ? `${i * 150}ms` : '0ms',
                }}
              >
                {/* Label row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{phase.icon || `${i + 1}.`}</span>
                    <span className="text-sm font-medium text-slate-200">
                      {phase.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono font-bold ${scoreTextColor}`}>
                      {phase.score}%
                    </span>
                    {phase.firstTry && (
                      <span
                        className="text-amber-400 animate-bounce-in"
                        title="First try!"
                      >
                        {'\u2605'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                    style={{ width: visibleRows[i] ? `${phase.score}%` : '0%' }}
                  />
                </div>

                {/* Attempt count */}
                <div className="text-xs text-slate-500 mt-1">
                  {phase.attempts === 1 ? '1 attempt' : `${phase.attempts} attempts`}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default PhaseSummaryPanel;
