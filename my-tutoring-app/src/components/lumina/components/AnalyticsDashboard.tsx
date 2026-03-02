'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GateProgressDots } from './PlannerDashboard/MasteryComponents';
import { VelocityGauge as PlannerVelocityGauge, TrendSparkline, SubjectVelocityCard, getVelocityColor } from './PlannerDashboard/VelocityComponents';
import type { VelocityData } from './PlannerDashboard/types';
import { authApi } from '@/lib/authApiClient';
import {
  analyticsApi,
  type StudentMetrics,
  type UnitData,
  type SkillData,
  type SubskillData,
  type ScoreTrendsResponse,
  type SubjectTrend,
  type TrendPeriod,
  type EngagementMetricsResponse,
} from '@/lib/studentAnalyticsAPI';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function scorePct(v: number): string {
  return `${Math.round(v * 10)}%`;
}

function masteryColor(v: number): string {
  if (v >= 0.8) return 'emerald';
  if (v >= 0.5) return 'amber';
  return 'red';
}

function masteryGradient(v: number): string {
  if (v >= 0.8) return 'from-emerald-500 to-emerald-400';
  if (v >= 0.5) return 'from-amber-500 to-amber-400';
  return 'from-red-500 to-red-400';
}


function gateStatusBadge(ss: SubskillData) {
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

function isRetestOverdue(nextRetestEligible: string | null | undefined): boolean {
  if (!nextRetestEligible) return false;
  try { return new Date(nextRetestEligible) < new Date(); } catch { return false; }
}

// ---------------------------------------------------------------------------
// Stat Pill
// ---------------------------------------------------------------------------

function StatPill({ label, value, color = 'blue' }: { label: string; value: string; color?: string }) {
  return (
    <div className={`p-3 rounded-lg bg-${color}-500/10 border border-${color}-500/20 text-center`}>
      <div className={`text-lg font-bold text-${color}-400`}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mastery Bar
// ---------------------------------------------------------------------------

function MasteryBar({ value, className = '' }: { value: number; className?: string }) {
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


// ---------------------------------------------------------------------------
// Score Trend Sparkline (SVG)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Engagement Bar Chart
// ---------------------------------------------------------------------------

function EngagementBars({ breakdown }: { breakdown: EngagementMetricsResponse['daily_breakdown'] }) {
  if (!breakdown.length) return <div className="text-slate-500 text-sm">No data</div>;

  const maxAttempts = Math.max(...breakdown.map(d => d.attempts), 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {breakdown.map((day, i) => {
        const heightPct = (day.attempts / maxAttempts) * 100;
        const isActive = day.attempts > 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${day.date}: ${day.attempts} attempts, avg ${day.avg_score.toFixed(1)}`}>
            <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
              <div
                className={`w-full rounded-t ${isActive ? 'bg-gradient-to-t from-blue-600 to-cyan-400' : 'bg-slate-800'}`}
                style={{ height: `${Math.max(heightPct, 2)}%`, minHeight: '2px' }}
              />
            </div>
            <span className="text-[7px] text-slate-600 truncate w-full text-center">
              {day.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Types
// ---------------------------------------------------------------------------

type Tab = 'overview' | 'curriculum' | 'velocity' | 'trends' | 'engagement';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'velocity', label: 'Velocity' },
  { id: 'trends', label: 'Score Trends' },
  { id: 'engagement', label: 'Engagement' },
];

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

interface AnalyticsDashboardProps {
  onBack: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onBack }) => {
  const [studentId, setStudentId] = useState('1');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [metrics, setMetrics] = useState<StudentMetrics | null>(null);
  const [velocity, setVelocity] = useState<VelocityData | null>(null);
  const [scoreTrends, setScoreTrends] = useState<ScoreTrendsResponse | null>(null);
  const [engagement, setEngagement] = useState<EngagementMetricsResponse | null>(null);

  // Trends granularity
  const [granularity, setGranularity] = useState<'weekly' | 'monthly'>('monthly');

  const loadAll = useCallback(async () => {
    const sid = parseInt(studentId);
    if (isNaN(sid)) return;
    setLoading(true);
    setError(null);
    try {
      const [m, v, t, e] = await Promise.all([
        analyticsApi.getStudentMetrics(sid),
        authApi.get<VelocityData>(`/api/velocity/${sid}`),
        analyticsApi.getScoreTrends(sid, { granularity, lookbackMonths: 6 }),
        analyticsApi.getEngagementMetrics(sid, { days: 30 }),
      ]);
      setMetrics(m);
      setVelocity(v);
      setScoreTrends(t);
      setEngagement(e);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [studentId, granularity]);

  // Reload trends when granularity changes (if already loaded)
  const reloadTrends = useCallback(async (g: 'weekly' | 'monthly') => {
    setGranularity(g);
    const sid = parseInt(studentId);
    if (isNaN(sid) || !scoreTrends) return;
    try {
      const t = await analyticsApi.getScoreTrends(sid, {
        granularity: g,
        lookbackWeeks: g === 'weekly' ? 26 : undefined,
        lookbackMonths: g === 'monthly' ? 12 : undefined,
      });
      setScoreTrends(t);
    } catch { /* silent */ }
  }, [studentId, scoreTrends]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-slate-100">Analytics Dashboard</h1>

        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            placeholder="Student ID"
            className="w-28 px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
          <Button
            onClick={loadAll}
            disabled={loading}
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-sm"
          >
            {loading ? 'Loading...' : 'Load'}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-slate-900/60 border border-white/5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {!metrics && !loading && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-12 text-center text-slate-500">
            Enter a student ID and click Load to view analytics
          </CardContent>
        </Card>
      )}

      {metrics && activeTab === 'overview' && <OverviewPanel metrics={metrics} />}
      {metrics && activeTab === 'curriculum' && <CurriculumPanel metrics={metrics} />}
      {activeTab === 'velocity' && <VelocityPanel data={velocity} />}
      {activeTab === 'trends' && (
        <TrendsPanel data={scoreTrends} granularity={granularity} onGranularityChange={reloadTrends} />
      )}
      {activeTab === 'engagement' && <EngagementPanel data={engagement} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab 1: Overview
// ---------------------------------------------------------------------------

function OverviewPanel({ metrics }: { metrics: StudentMetrics }) {
  const s = metrics.summary;
  return (
    <div className="space-y-4">
      {/* Primary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatPill label="Mastery" value={pct(s.mastery)} color="emerald" />
        <StatPill label="Proficiency" value={pct(s.proficiency)} color="blue" />
        <StatPill label="Avg Score" value={scorePct(s.avg_score)} color="cyan" />
        <StatPill label="Completion" value={pct(s.completion)} color="purple" />
      </div>
      {/* Secondary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatPill label="Attempted" value={`${s.attempted_items} / ${s.total_items}`} color="slate" />
        <StatPill label="Total Attempts" value={s.attempt_count.toLocaleString()} color="slate" />
        <StatPill label="Ready Items" value={s.ready_items.toString()} color="emerald" />
        <StatPill label="Recommended" value={s.recommended_items.toString()} color="amber" />
      </div>
      {/* Overall mastery bar */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Overall Mastery</span>
            <span className="text-slate-100 font-bold">{pct(s.mastery)}</span>
          </div>
          <MasteryBar value={s.mastery} />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Curriculum (hierarchical)
// ---------------------------------------------------------------------------

function CurriculumPanel({ metrics }: { metrics: StudentMetrics }) {
  const units = metrics.hierarchical_data;

  if (!units.length) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-8 text-center text-slate-500">No curriculum data available</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <Accordion type="multiple" className="space-y-2">
        {units.map(unit => (
          <AccordionItem key={unit.unit_id} value={unit.unit_id} className="border-0">
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors [&[data-state=open]]:bg-white/5">
                <div className="flex-1 text-left space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-100">{unit.unit_title}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{unit.attempted_skills}/{unit.total_skills} skills</span>
                      <span>{unit.attempt_count} attempts</span>
                      <span className={`font-bold text-${masteryColor(unit.mastery)}-400`}>
                        {pct(unit.mastery)}
                      </span>
                    </div>
                  </div>
                  <MasteryBar value={unit.mastery} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <SkillsList skills={unit.skills} />
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function SkillsList({ skills }: { skills: SkillData[] }) {
  return (
    <Accordion type="multiple" className="space-y-1 mt-2">
      {skills.map(skill => (
        <AccordionItem key={skill.skill_id} value={skill.skill_id} className="border-0">
          <div className="rounded-lg bg-slate-800/50 border border-white/5 overflow-hidden">
            <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-white/5 transition-colors text-sm [&[data-state=open]]:bg-white/5">
              <div className="flex-1 text-left space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-200 text-xs">{skill.skill_description}</span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-shrink-0">
                    <span>{skill.attempted_subskills}/{skill.total_subskills}</span>
                    <span>{skill.attempt_count} att</span>
                    <span className={`font-bold text-${masteryColor(skill.mastery)}-400`}>
                      {pct(skill.mastery)}
                    </span>
                  </div>
                </div>
                <MasteryBar value={skill.mastery} className="h-1.5" />
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-2">
              <SubskillList subskills={skill.subskills} />
            </AccordionContent>
          </div>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function SubskillList({ subskills }: { subskills: SubskillData[] }) {
  return (
    <div className="space-y-1 mt-1">
      {subskills.map(ss => {
        const gate = ss.current_gate ?? 0;
        const completionPct = Math.round((ss.completion_pct ?? 0) * 100);
        const status = gateStatusBadge(ss);
        const overdue = isRetestOverdue(ss.next_retest_eligible);
        const passes = ss.passes ?? 0;
        const fails = ss.fails ?? 0;

        return (
          <div key={ss.subskill_id}
            className="flex items-center gap-3 px-3 py-2 rounded-md bg-slate-900/60 border border-white/5">
            {/* Gate progress dots */}
            <GateProgressDots gate={gate} />
            {/* Description + completion bar */}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-300 truncate">{ss.subskill_description}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">{completionPct}%</span>
              </div>
            </div>
            {/* Pass/fail stats (gate >= 2 only) */}
            {gate >= 2 && (
              <div className="text-right flex-shrink-0 w-14">
                <div className="text-[10px] text-slate-400 font-mono">{passes}P/{fails}F</div>
              </div>
            )}
            {/* Stats */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-slate-500">{ss.attempt_count} att</span>
              {overdue && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-red-500/20 border-red-500/30 text-red-400">
                  Retest due
                </span>
              )}
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${status.bg} ${status.text}`}>
                {status.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Velocity
// ---------------------------------------------------------------------------

function VelocityPanel({ data }: { data: VelocityData | null }) {
  if (!data) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-8 text-center text-slate-500">
          No velocity data. Load a student first.
        </CardContent>
      </Card>
    );
  }

  const subjects = Object.entries(data.subjects);
  const aggColor = getVelocityColor(data.aggregate.velocity);

  return (
    <div className="space-y-6">
      {/* Aggregate overview */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Mastery Velocity — Pipeline-Adjusted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Overall gauge */}
            <PlannerVelocityGauge velocity={data.aggregate.velocity} label="Overall Velocity" size="lg" />

            {/* Earned / Expected */}
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <span className="text-slate-400">Earned Mastery</span>
                <span className="text-white font-mono font-bold">{data.aggregate.earnedMastery}</span>
                <span className="text-slate-400">Expected Mastery</span>
                <span className="text-white font-mono font-bold">{data.aggregate.adjustedExpectedMastery}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">8-week Trend</span>
                <TrendSparkline trend={data.aggregate.trend} />
              </div>
            </div>

            {/* School year progress */}
            <div className="text-center">
              <div className={`text-3xl font-bold font-mono ${aggColor.text}`}>
                {Math.round(data.schoolYear.fractionElapsed * 100)}%
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Year Elapsed</div>
              <div className="flex gap-2 mt-3">
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-white/5 text-center">
                  <div className="text-lg font-bold text-white">{data.schoolYear.weeksCompleted}</div>
                  <div className="text-[9px] text-slate-500 uppercase">Wks Done</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-white/5 text-center">
                  <div className="text-lg font-bold text-white">{data.schoolYear.weeksRemaining}</div>
                  <div className="text-[9px] text-slate-500 uppercase">Wks Left</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between text-[10px] text-slate-600 mt-4 pt-3 border-t border-white/5">
            <span>As of: {data.asOfDate}</span>
            <span>Velocity = Earned ({data.aggregate.earnedMastery}) / Expected ({data.aggregate.adjustedExpectedMastery})</span>
          </div>
        </CardContent>
      </Card>

      {/* Per-subject compact gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {subjects.map(([name, subj]) => (
          <PlannerVelocityGauge key={name} velocity={subj.velocity} label={name} />
        ))}
      </div>

      {/* Per-subject detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {subjects.map(([name, subj]) => (
          <SubjectVelocityCard key={name} name={name} data={subj} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Score Trends
// ---------------------------------------------------------------------------

function TrendsPanel({
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

// ---------------------------------------------------------------------------
// Tab 5: Engagement
// ---------------------------------------------------------------------------

function EngagementPanel({ data }: { data: EngagementMetricsResponse | null }) {
  if (!data) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-8 text-center text-slate-500">
          No engagement data. Load a student first.
        </CardContent>
      </Card>
    );
  }

  const s = data.summary;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatPill label="Active Days" value={s.total_active_days.toString()} color="blue" />
        <StatPill label="Current Streak" value={`${s.streak_current}d`} color="emerald" />
        <StatPill label="Longest Streak" value={`${s.streak_longest}d`} color="purple" />
        <StatPill label="Avg Daily" value={s.avg_daily_attempts.toFixed(1)} color="cyan" />
      </div>

      {/* Daily breakdown bar chart */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-100">
            Daily Activity (last {data.days_analyzed} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EngagementBars breakdown={data.daily_breakdown} />
        </CardContent>
      </Card>

      {/* Total attempts */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-4 flex items-center justify-between">
          <span className="text-sm text-slate-400">Total Attempts</span>
          <span className="text-lg font-bold text-slate-100">{s.total_attempts.toLocaleString()}</span>
        </CardContent>
      </Card>
    </div>
  );
}
