'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useEvaluationContext } from '../evaluation';
import type { PrimitiveEvaluationResult } from '../evaluation';

// ── Performance tiers ────────────────────────────────────────────

type PerformanceTier = 'perfect' | 'great' | 'good' | 'needs-work';

function getTier(score: number): PerformanceTier {
  if (score >= 100) return 'perfect';
  if (score >= 80) return 'great';
  if (score >= 50) return 'good';
  return 'needs-work';
}

const TIER: Record<
  PerformanceTier,
  { label: string; icon: string; ring: string; text: string; bg: string; border: string; glow: string }
> = {
  perfect: {
    label: 'Perfect!',
    icon: '\u2728',
    ring: 'stroke-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20',
  },
  great: {
    label: 'Great Job!',
    icon: '\u2B50',
    ring: 'stroke-blue-400',
    text: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
  },
  good: {
    label: 'Good Work',
    icon: '\uD83D\uDC4D',
    ring: 'stroke-amber-400',
    text: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/20',
  },
  'needs-work': {
    label: 'Keep Practicing',
    icon: '\uD83D\uDCAA',
    ring: 'stroke-rose-400',
    text: 'text-rose-400',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/20',
  },
};

// ── Helpers ──────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatPrimitiveType(type: string): string {
  return type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Mini score ring (SVG) ────────────────────────────────────────

const MiniScoreRing: React.FC<{ score: number; size?: number }> = ({
  score,
  size = 44,
}) => {
  const tier = getTier(score);
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="fill-none stroke-white/10"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`fill-none ${TIER[tier].ring}`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold ${TIER[tier].text}`}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
};

// ── History row ──────────────────────────────────────────────────

const HistoryRow: React.FC<{
  result: PrimitiveEvaluationResult;
  index: number;
  isLatest: boolean;
}> = ({ result, index, isLatest }) => {
  const tier = getTier(result.score);
  const t = TIER[tier];

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${
        isLatest ? `${t.bg} ${t.border} border` : 'hover:bg-white/5'
      }`}
      style={{
        animation: isLatest ? 'slideIn 300ms ease-out' : undefined,
      }}
    >
      <MiniScoreRing score={result.score} size={36} />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">
          {formatPrimitiveType(result.primitiveType)}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{formatDuration(result.durationMs)}</span>
          <span className="w-px h-3 bg-slate-700" />
          <span className={t.text}>{t.label}</span>
        </div>
      </div>

      <div className="flex-shrink-0">
        {result.success ? (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────

export const EvaluationResultsIndicator: React.FC = () => {
  const context = useEvaluationContext();
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const prevCountRef = useRef(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const submittedResults = context?.submittedResults ?? [];

  // Animate in when a new result arrives; auto-collapse after 8s
  useEffect(() => {
    if (submittedResults.length > prevCountRef.current) {
      const newResult = submittedResults[submittedResults.length - 1];
      console.log('New evaluation result:', {
        primitive: newResult.primitiveType,
        success: newResult.success,
        score: Math.round(newResult.score),
        duration: `${Math.round(newResult.durationMs / 1000)}s`,
      });

      setVisible(true);
      setExpanded(false);

      // Auto-collapse (not hide) after 8 seconds if user hasn't expanded
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        setExpanded(false);
      }, 8000);

      prevCountRef.current = submittedResults.length;
    }
  }, [submittedResults.length]);

  // Session aggregate stats
  const stats = useMemo(() => {
    if (submittedResults.length === 0) return null;
    const scores = submittedResults.map(r => r.score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const correct = submittedResults.filter(r => r.success).length;

    // Current streak
    let streak = 0;
    for (let i = submittedResults.length - 1; i >= 0; i--) {
      if (submittedResults[i].success) streak++;
      else break;
    }

    return { avg, correct, total: submittedResults.length, streak };
  }, [submittedResults]);

  if (!context || submittedResults.length === 0 || !visible) {
    return null;
  }

  const lastResult = submittedResults[submittedResults.length - 1];
  const tier = getTier(lastResult.score);
  const t = TIER[tier];

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80">
      {/* Keyframes for slide-in animation */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <Card
        className={`backdrop-blur-xl bg-slate-900/70 border-white/10 shadow-2xl ${t.glow} overflow-hidden transition-all duration-300`}
        style={{ animation: 'fadeInUp 400ms ease-out' }}
      >
        <CardContent className="p-0">
          {/* ── Latest result header ── */}
          <Collapsible open={expanded} onOpenChange={(open) => {
            setExpanded(open);
            if (open) clearTimeout(dismissTimerRef.current);
          }}>
            <CollapsibleTrigger asChild>
              <button className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left">
                <MiniScoreRing score={lastResult.score} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-100 truncate">
                      {formatPrimitiveType(lastResult.primitiveType)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 border ${t.bg} ${t.text} ${t.border}`}
                    >
                      {t.icon} {t.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{formatDuration(lastResult.durationMs)}</span>
                    {stats && stats.total > 1 && (
                      <>
                        <span className="w-px h-3 bg-slate-700" />
                        <span>{stats.correct}/{stats.total} correct</span>
                      </>
                    )}
                    {stats && stats.streak >= 2 && (
                      <>
                        <span className="w-px h-3 bg-slate-700" />
                        <span className="text-amber-400">{stats.streak} streak</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Expand chevron */}
                <svg
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 flex-shrink-0 ${
                    expanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              {/* ── Session stats bar ── */}
              {stats && stats.total > 1 && (
                <div className="px-4 pb-3">
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex-1 text-center">
                      <div className={`text-lg font-bold ${TIER[getTier(stats.avg)].text}`}>
                        {stats.avg}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Avg</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700" />
                    <div className="flex-1 text-center">
                      <div className="text-lg font-bold text-slate-200">
                        {stats.correct}/{stats.total}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Correct</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700" />
                    <div className="flex-1 text-center">
                      <div className={`text-lg font-bold ${stats.streak >= 3 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {stats.streak}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Streak</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── History list ── */}
              <div className="px-4 pb-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-2 px-1">
                  History
                </div>
              </div>
              <ScrollArea className="max-h-52">
                <div className="px-4 pb-4 space-y-1">
                  {[...submittedResults].reverse().map((result, i) => (
                    <HistoryRow
                      key={result.attemptId}
                      result={result}
                      index={i}
                      isLatest={i === 0}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* ── Dismiss button ── */}
              <div className="px-4 pb-3">
                <Button
                  variant="ghost"
                  className="w-full h-8 text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400"
                  onClick={() => setVisible(false)}
                >
                  Dismiss
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvaluationResultsIndicator;
