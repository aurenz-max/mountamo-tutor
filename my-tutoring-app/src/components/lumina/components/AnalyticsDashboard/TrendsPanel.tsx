import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScoreTrendsResponse, SubjectTrend, TrendPeriod } from '@/lib/studentAnalyticsAPI';

function TrendChart({ periods }: { periods: TrendPeriod[] }) {
  if (!periods.length) return <div className="text-slate-500 text-sm">No data</div>;

  const w = 400;
  const h = 120;
  const pad = { top: 10, right: 10, bottom: 24, left: 30 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const maxScore = 10;
  const points = periods.map((p, i) => ({
    x: pad.left + (i / Math.max(periods.length - 1, 1)) * chartW,
    y: pad.top + chartH - (p.avg_score / maxScore) * chartH,
    label: p.period_label,
    score: p.avg_score,
    reviews: p.total_reviews,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {/* Y-axis labels */}
      {[0, 5, 10].map(v => (
        <text key={v} x={pad.left - 6} y={pad.top + chartH - (v / maxScore) * chartH}
          textAnchor="end" dominantBaseline="central" className="fill-slate-600" fontSize="9">
          {v}
        </text>
      ))}
      {/* Grid lines */}
      {[0, 5, 10].map(v => (
        <line key={v} x1={pad.left} x2={w - pad.right}
          y1={pad.top + chartH - (v / maxScore) * chartH}
          y2={pad.top + chartH - (v / maxScore) * chartH}
          stroke="#334155" strokeWidth="0.5" />
      ))}
      {/* Line */}
      <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#60a5fa" />
      ))}
      {/* X-axis labels (show first, last, middle) */}
      {points.filter((_, i) => i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2)).map((p, i) => (
        <text key={i} x={p.x} y={h - 4} textAnchor="middle" className="fill-slate-500" fontSize="8">
          {p.label.length > 12 ? p.label.slice(0, 12) : p.label}
        </text>
      ))}
    </svg>
  );
}

export function TrendsPanel({
  data,
  granularity,
  onGranularityChange,
}: {
  data: ScoreTrendsResponse | null;
  granularity: 'weekly' | 'monthly';
  onGranularityChange: (g: 'weekly' | 'monthly') => void;
}) {
  if (!data) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-8 text-center text-slate-500">
          No score trend data. Load a student first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Granularity toggle */}
      <div className="flex gap-1 p-1 rounded-lg bg-slate-900/60 border border-white/5 w-fit">
        {(['weekly', 'monthly'] as const).map(g => (
          <button
            key={g}
            onClick={() => onGranularityChange(g)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              granularity === g ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {g === 'weekly' ? 'Weekly' : 'Monthly'}
          </button>
        ))}
      </div>

      {data.trends.map((trend: SubjectTrend) => (
        <Card key={trend.subject} className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-100">{trend.subject}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart periods={trend.periods} />
            {trend.periods.length > 0 && (
              <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                <span>Total reviews: {trend.periods.reduce((s, p) => s + p.total_reviews, 0)}</span>
                <span>Latest avg: {trend.periods[trend.periods.length - 1].avg_score.toFixed(1)} / 10</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {!data.trends.length && (
        <div className="text-center text-slate-500 text-sm py-4">No trend data available for this period</div>
      )}
    </div>
  );
}
