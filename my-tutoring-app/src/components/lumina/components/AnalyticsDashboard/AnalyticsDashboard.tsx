'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { VelocityData } from '../PlannerDashboard/types';
import { authApi } from '@/lib/authApiClient';
import {
  analyticsApi,
  type StudentMetrics,
  type ScoreTrendsResponse,
  type EngagementMetricsResponse,
  type KnowledgeGraphProgressResponse,
  type PulseSessionHistoryResponse,
} from '@/lib/studentAnalyticsAPI';
import { OverviewPanel } from './OverviewPanel';
import { CurriculumPanel } from './CurriculumPanel';
import { VelocityPanel } from './VelocityPanel';
import { TrendsPanel } from './TrendsPanel';
import { EngagementPanel } from './EngagementPanel';
import { KnowledgeGraphPanel } from './KnowledgeGraphPanel';
import { PulseSessionsPanel } from './PulseSessionsPanel';

// ---------------------------------------------------------------------------
// Tab Types
// ---------------------------------------------------------------------------

type Tab = 'overview' | 'curriculum' | 'velocity' | 'trends' | 'engagement' | 'knowledge-graph' | 'pulse-sessions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'velocity', label: 'Velocity' },
  { id: 'trends', label: 'Score Trends' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'knowledge-graph', label: 'Knowledge Graph' },
  { id: 'pulse-sessions', label: 'Pulse Sessions' },
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
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphProgressResponse | null>(null);
  const [pulseSessions, setPulseSessions] = useState<PulseSessionHistoryResponse | null>(null);

  // Trends granularity
  const [granularity, setGranularity] = useState<'weekly' | 'monthly'>('monthly');

  const loadAll = useCallback(async () => {
    const sid = parseInt(studentId);
    if (isNaN(sid)) return;
    setLoading(true);
    setError(null);
    try {
      const [m, v, t, e, ps] = await Promise.all([
        analyticsApi.getStudentMetrics(sid),
        authApi.get<VelocityData>(`/api/velocity/${sid}`),
        analyticsApi.getScoreTrends(sid, { granularity, lookbackMonths: 6 }),
        analyticsApi.getEngagementMetrics(sid, { days: 30 }),
        analyticsApi.getPulseSessionHistory(sid, { limit: 50, includeTheta: true }),
      ]);
      setMetrics(m);
      setVelocity(v);
      setScoreTrends(t);
      setEngagement(e);
      setPulseSessions(ps);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [studentId, granularity]);

  // Knowledge graph subject selector
  const [kgSubject, setKgSubject] = useState('');
  const [kgSubjects, setKgSubjects] = useState<string[]>([]);
  const [skillLabels, setSkillLabels] = useState<Record<string, string>>({});

  // Fetch real subject names from curriculum API when KG tab is first opened
  const ensureSubjectsLoaded = useCallback(async () => {
    if (kgSubjects.length > 0) return;
    try {
      const result = await authApi.getSubjects() as ({ subject_name: string } | string)[];
      const names = (Array.isArray(result) ? result : []).map(s =>
        typeof s === 'string' ? s : s.subject_name
      );
      setKgSubjects(names);
    } catch { /* silent */ }
  }, [kgSubjects.length]);

  const loadKnowledgeGraph = useCallback(async (subject: string) => {
    const sid = parseInt(studentId);
    if (isNaN(sid)) return;
    setKgSubject(subject);
    try {
      // Fetch knowledge graph and curriculum in parallel to get skill labels
      const [kg, currData] = await Promise.all([
        analyticsApi.getKnowledgeGraphProgress(sid, { subject, includeNodes: true }),
        authApi.getSubjectCurriculum(subject) as Promise<{ curriculum: { skills: { id: string; description: string }[] }[] }>,
      ]);
      setKnowledgeGraph(kg);

      // Build skill_id → description lookup from curriculum
      const labels: Record<string, string> = {};
      for (const unit of currData?.curriculum ?? []) {
        for (const skill of unit.skills ?? []) {
          if (skill.id && skill.description) {
            labels[skill.id] = skill.description;
          }
        }
      }
      setSkillLabels(labels);
    } catch { /* silent */ }
  }, [studentId]);

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
      {activeTab === 'knowledge-graph' && (
        <KnowledgeGraphPanel
          data={knowledgeGraph}
          subject={kgSubject}
          subjects={kgSubjects}
          skillLabels={skillLabels}
          onSubjectChange={loadKnowledgeGraph}
          onMount={ensureSubjectsLoaded}
        />
      )}
      {activeTab === 'pulse-sessions' && <PulseSessionsPanel data={pulseSessions} />}
    </div>
  );
};
