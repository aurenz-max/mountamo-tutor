'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AdaptiveItemResult, SessionDecision } from './adaptiveEngine/types';

// ── Types ────────────────────────────────────────────────────────

type PerformanceTier = 'perfect' | 'great' | 'good' | 'needs-work';

interface SkillSummary {
  topic: string;
  scores: number[];
  avgScore: number;
  label: 'solid' | 'growing' | 'new!';
  delta: number;
}

interface AdaptiveSessionSummaryProps {
  results: AdaptiveItemResult[];
  decisions: SessionDecision[];
  sessionStartedAt: number | null;
  topic: string;
  onDone: () => void;
  onKeepGoing?: () => void;
  showExtension?: boolean;
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
  }
> = {
  perfect: {
    label: 'Perfect!',
    emoji: '\uD83C\uDF1F',
    ringColor: 'stroke-emerald-400',
    glowColor: 'bg-emerald-500',
    badgeClasses: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  great: {
    label: 'Great Job!',
    emoji: '\u2B50',
    ringColor: 'stroke-blue-400',
    glowColor: 'bg-blue-500',
    badgeClasses: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  good: {
    label: 'Good Work',
    emoji: '\uD83D\uDC4D',
    ringColor: 'stroke-amber-400',
    glowColor: 'bg-amber-500',
    badgeClasses: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  'needs-work': {
    label: 'Keep Practicing',
    emoji: '\uD83D\uDCAA',
    ringColor: 'stroke-rose-400',
    glowColor: 'bg-rose-500',
    badgeClasses: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
};

const SKILL_BAR_CLASSES: Record<SkillSummary['label'], string> = {
  solid: 'bg-emerald-500',
  growing: 'bg-cyan-500',
  'new!': 'bg-purple-500',
};

const SKILL_TEXT_CLASSES: Record<SkillSummary['label'], string> = {
  solid: 'text-emerald-400',
  growing: 'text-cyan-400',
  'new!': 'text-purple-400',
};

// ── Helpers ──────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** Convert kebab-case componentId to a readable name, e.g. "balance-scale" → "Balance Scale" */
function prettifyPrimitiveId(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function computeSkillSummaries(results: AdaptiveItemResult[]): SkillSummary[] {
  const scored = results.filter((r) => !r.isWorkedExample);
  if (scored.length === 0) return [];

  // Group by primitive (or "standard" for non-visual items)
  const byPrimitive = new Map<string, AdaptiveItemResult[]>();
  for (const r of scored) {
    const key = r.primitiveId ?? 'standard';
    const group = byPrimitive.get(key) ?? [];
    group.push(r);
    byPrimitive.set(key, group);
  }

  const summaries: SkillSummary[] = [];
  Array.from(byPrimitive.entries()).forEach(([primitiveKey, items]) => {
    const scores = items.map((r: AdaptiveItemResult) => r.score);
    const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    const first = scores[0];
    const last = scores[scores.length - 1];
    const delta = last - first;

    let label: SkillSummary['label'] = 'growing';
    if (avg >= 85) label = 'solid';
    else if (items.length === 1) label = 'new!';

    summaries.push({
      topic: primitiveKey === 'standard' ? 'Practice' : prettifyPrimitiveId(primitiveKey),
      scores,
      avgScore: avg,
      label,
      delta,
    });
  });

  return summaries;
}

function generateMessage(results: AdaptiveItemResult[], decisions: SessionDecision[]): string {
  const scored = results.filter((r) => !r.isWorkedExample);
  const earlyExit = decisions.some((d) => d.action === 'early-exit');
  const avgScore =
    scored.length > 0 ? scored.reduce((a, r) => a + r.score, 0) / scored.length : 0;

  if (earlyExit)
    return "You crushed it! Mastery demonstrated \u2014 want to keep going or call it a win?";
  if (avgScore >= 85)
    return "Fantastic work! You're showing real confidence with this material.";
  if (avgScore >= 65)
    return "Great effort! You're building solid understanding \u2014 keep practicing!";
  return "Good work sticking with it! Every attempt makes you stronger.";
}

// ── Component ────────────────────────────────────────────────────

export const AdaptiveSessionSummary: React.FC<AdaptiveSessionSummaryProps> = ({
  results,
  decisions,
  sessionStartedAt,
  topic,
  onDone,
  onKeepGoing,
  showExtension = false,
}) => {
  const scored = results.filter((r) => !r.isWorkedExample);
  const summaries = useMemo(() => computeSkillSummaries(results), [results]);
  const message = useMemo(() => generateMessage(results, decisions), [results, decisions]);

  const avgScore = useMemo(
    () =>
      scored.length > 0
        ? Math.round(scored.reduce((a, r) => a + r.score, 0) / scored.length)
        : 0,
    [scored],
  );

  const tier = getPerformanceTier(avgScore);
  const tierConfig = TIER_CONFIG[tier];

  const durationMs = sessionStartedAt ? Date.now() - sessionStartedAt : 0;
  const switchCount = decisions.filter((d) => d.action === 'switch-representation').length;
  const exampleCount = decisions.filter((d) => d.action === 'insert-example').length;

  // SVG ring math
  const ringRadius = 52;
  const circumference = 2 * Math.PI * ringRadius;

  // Animation state
  const [visible, setVisible] = useState(false);
  const [ringProgress, setRingProgress] = useState(0);
  const [visibleRows, setVisibleRows] = useState<boolean[]>(summaries.map(() => false));

  const strokeDashoffset = circumference - (ringProgress / 100) * circumference;

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setVisible(true));
    const ringTimer = setTimeout(() => setRingProgress(avgScore), 200);

    const rowTimers = summaries.map((_, i) =>
      setTimeout(() => {
        setVisibleRows((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, 400 + i * 150),
    );

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(ringTimer);
      rowTimers.forEach(clearTimeout);
    };
    // Run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card
      className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl overflow-hidden relative max-w-lg mx-auto transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Ambient glow */}
      <div
        className={`absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-20 ${tierConfig.glowColor}`}
      />

      <CardContent className="p-8 relative z-10">
        {/* ── Heading ─────────────────────────────────── */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-light text-white mb-1">
            {tierConfig.emoji} Today&apos;s Session {tierConfig.emoji}
          </h3>
          <p className="text-slate-400 text-sm">{topic}</p>
        </div>

        {/* ── Score Ring ──────────────────────────────── */}
        <div className="flex justify-center mb-8">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                className="fill-none stroke-white/10"
                strokeWidth="8"
              />
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
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{avgScore}%</span>
              <Badge className={`mt-1 text-xs border ${tierConfig.badgeClasses}`}>
                {tierConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* ── Message ─────────────────────────────────── */}
        <p className="text-slate-300 text-center text-sm mb-6 leading-relaxed">{message}</p>

        {/* ── Duration + Stats ─────────────────────────── */}
        {durationMs > 0 && (
          <div className="flex items-center justify-center gap-3 text-sm text-slate-500 mb-6">
            <span>Completed in {formatDuration(durationMs)}</span>
            <span>&middot;</span>
            <span>{scored.length} items</span>
            {switchCount > 0 && (
              <>
                <span>&middot;</span>
                <span>
                  {switchCount} switch{switchCount > 1 ? 'es' : ''}
                </span>
              </>
            )}
            {exampleCount > 0 && (
              <>
                <span>&middot;</span>
                <span>
                  {exampleCount} example{exampleCount > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        )}

        {/* ── Skill Breakdown ─────────────────────────── */}
        {summaries.length > 0 && (
          <div className="space-y-4 mb-6">
            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">
              Skill Breakdown
            </h4>

            {summaries.map((s, i) => {
              const barColor = SKILL_BAR_CLASSES[s.label];
              const textColor = SKILL_TEXT_CLASSES[s.label];

              return (
                <div
                  key={i}
                  className={`transition-all duration-300 ${
                    visibleRows[i]
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-2'
                  }`}
                  style={{ transitionDelay: `${i * 150}ms` }}
                >
                  {/* Label row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{`${i + 1}.`}</span>
                      <span className="text-sm font-medium text-slate-200">{s.topic}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-mono font-bold ${textColor}`}>
                        {Math.round(s.avgScore)}%
                      </span>
                      <Badge
                        className={`text-[10px] border px-1.5 py-0 ${
                          s.label === 'solid'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : s.label === 'growing'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        }`}
                      >
                        {s.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                      style={{
                        width: visibleRows[i] ? `${Math.min(100, s.avgScore)}%` : '0%',
                      }}
                    />
                  </div>

                  {/* Score count */}
                  <div className="text-xs text-slate-500 mt-1">
                    {s.scores.length === 1
                      ? '1 item'
                      : `${s.scores.length} items`}
                    {s.delta > 0 && (
                      <span className="text-emerald-400 ml-2">+{Math.round(s.delta)} growth</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Actions ─────────────────────────────────── */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={onDone}
            variant="ghost"
            className="flex-1 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
          >
            Done
          </Button>
          {showExtension && onKeepGoing && (
            <Button
              onClick={onKeepGoing}
              variant="ghost"
              className="flex-1 bg-cyan-500/20 border border-cyan-400/30 hover:bg-cyan-500/30 text-cyan-300"
            >
              Keep Going?
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdaptiveSessionSummary;
