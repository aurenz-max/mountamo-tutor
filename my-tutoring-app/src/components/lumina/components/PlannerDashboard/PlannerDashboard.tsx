'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/authApiClient';
import { PracticeMode } from '../PracticeModeEnhanced';
import type { Subject } from '../SubjectSelector';

import type {
  WeeklyPlan, DailyPlan, MonthlyPlan,
  VelocityData, MasterySummary, MasteryForecast,
  SessionItem,
} from './types';

import { SubjectCard } from './SubjectCard';
import { SessionRow, SectionDivider, WeekProgressBar } from './SessionRow';
import { DailySessionView } from './DailySessionView';
import { PulseSession } from '@/components/lumina/pulse/PulseSession';
import { SubjectProjectionCard, MonthlyWarningRow } from './MonthlyComponents';
import { VelocityGauge, TrendSparkline, SubjectVelocityCard, getVelocityColor } from './VelocityComponents';
import { GATE_LABELS, GATE_COLORS, GateDistributionBar, SubjectMasteryCard, UnitForecastRow } from './MasteryComponents';
import { MasterySeedPanel } from './MasterySeedPanel';
import type { SkillProgressResponse } from '@/lib/skillProgressApi';
import { CraftingCard, AlmostReadyList, ProgressOverview } from '@/components/dashboard/skill-progress';

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

interface PlannerDashboardProps {
  onBack: () => void;
}

export const PlannerDashboard: React.FC<PlannerDashboardProps> = ({ onBack }) => {
  const [studentId, setStudentId] = useState('1');
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
  const [velocityData, setVelocityData] = useState<VelocityData | null>(null);
  const [masterySummary, setMasterySummary] = useState<MasterySummary | null>(null);
  const [masteryForecast, setMasteryForecast] = useState<MasteryForecast | null>(null);
  const [skillProgress, setSkillProgress] = useState<SkillProgressResponse | null>(null);
  const [loading, setLoading] = useState<'idle' | 'weekly' | 'daily' | 'monthly' | 'velocity' | 'mastery' | 'progress' | 'all'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily' | 'session' | 'monthly' | 'velocity' | 'mastery' | 'progress'>('session');

  // Active practice session — when set, renders PracticeModeEnhanced instead of dashboard
  const [activeSession, setActiveSession] = useState<{ session: SessionItem; gate: number } | null>(null);
  // Active Pulse session — when set, renders PulseSession full-screen
  const [activePulse, setActivePulse] = useState(false);

  // Look up the mastery gate for a skill from loaded mastery data.
  // TODO: Replace with real-time per-skill gate lookup from backend API
  const getGateForSkill = useCallback((skillId: string): number | undefined => {
    if (!masterySummary) return undefined;
    for (const subjectData of Object.values(masterySummary.by_subject)) {
      for (const entry of subjectData.subskills) {
        if (entry.skill_id === skillId || entry.subskill_id === skillId) {
          return entry.current_gate;
        }
      }
    }
    return undefined;
  }, [masterySummary]);

  // Map session subject string to the Subject union type
  const mapSubject = (subjectStr: string): Subject => {
    const mapping: Record<string, Subject> = {
      mathematics: 'mathematics', math: 'mathematics',
      science: 'science',
      'language-arts': 'language-arts', 'language arts': 'language-arts',
      reading: 'reading',
      writing: 'writing',
      'social-studies': 'social-studies', 'social studies': 'social-studies',
    };
    return mapping[subjectStr.toLowerCase()] || 'mathematics';
  };

  // Handle starting a session from the daily plan
  const handleStartSession = useCallback((session: SessionItem, gate: number) => {
    if (gate >= 2) {
      // Gate 2+ → practice mode
      setActiveSession({ session, gate });
    } else {
      // TODO: Gate 1 → route to standard Lumina learning phase
      console.log('Gate 1 (lesson) routing not yet implemented for:', session.skill_id);
    }
  }, []);

  const fetchWeeklyPlan = async () => {
    setLoading('weekly');
    setError(null);
    try {
      const data = await authApi.get<WeeklyPlan>(`/api/weekly-planner/${studentId}`);
      setWeeklyPlan(data);
    } catch (e: any) {
      setError(`Weekly plan error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchDailyPlan = async () => {
    setLoading('daily');
    setError(null);
    try {
      const data = await authApi.get<DailyPlan>(`/api/daily-activities/daily-plan/${studentId}`);
      setDailyPlan(data);
    } catch (e: any) {
      setError(`Daily plan error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchMonthlyPlan = async () => {
    setLoading('monthly');
    setError(null);
    try {
      const data = await authApi.get<MonthlyPlan>(`/api/weekly-planner/${studentId}/monthly`);
      setMonthlyPlan(data);
    } catch (e: any) {
      setError(`Monthly plan error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchVelocity = async () => {
    setLoading('velocity');
    setError(null);
    try {
      const data = await authApi.get<VelocityData>(`/api/velocity/${studentId}`);
      setVelocityData(data);
    } catch (e: any) {
      setError(`Velocity error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchMastery = async () => {
    setLoading('mastery');
    setError(null);
    try {
      const [summary, forecast] = await Promise.all([
        authApi.get<MasterySummary>(`/api/mastery/${studentId}/summary`),
        authApi.get<MasteryForecast>(`/api/mastery/${studentId}/forecast`),
      ]);
      setMasterySummary(summary);
      setMasteryForecast(forecast);
    } catch (e: any) {
      setError(`Mastery error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const seedMasteryData = async () => {
    setLoading('mastery');
    setError(null);
    try {
      await authApi.post(`/api/mastery/debug/seed/${studentId}`, {});
      // Re-fetch after seeding
      const [summary, forecast] = await Promise.all([
        authApi.get<MasterySummary>(`/api/mastery/${studentId}/summary`),
        authApi.get<MasteryForecast>(`/api/mastery/${studentId}/forecast`),
      ]);
      setMasterySummary(summary);
      setMasteryForecast(forecast);
    } catch (e: any) {
      setError(`Seed error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchProgress = async () => {
    setLoading('progress');
    setError(null);
    try {
      const data = await authApi.get<SkillProgressResponse>(`/api/skill-progress/${studentId}`);
      setSkillProgress(data);
    } catch (e: any) {
      setError(`Skill progress error: ${e.message}`);
    } finally {
      setLoading('idle');
    }
  };

  const fetchAll = async () => {
    setLoading('all');
    setError(null);
    try {
      const [weekly, daily, monthly, velocity, mSummary, mForecast, progress] = await Promise.allSettled([
        authApi.get<WeeklyPlan>(`/api/weekly-planner/${studentId}`),
        authApi.get<DailyPlan>(`/api/daily-activities/daily-plan/${studentId}`),
        authApi.get<MonthlyPlan>(`/api/weekly-planner/${studentId}/monthly`),
        authApi.get<VelocityData>(`/api/velocity/${studentId}`),
        authApi.get<MasterySummary>(`/api/mastery/${studentId}/summary`),
        authApi.get<MasteryForecast>(`/api/mastery/${studentId}/forecast`),
        authApi.get<SkillProgressResponse>(`/api/skill-progress/${studentId}`),
      ]);

      const errors: string[] = [];
      if (weekly.status === 'fulfilled') setWeeklyPlan(weekly.value);
      else errors.push(`Weekly: ${weekly.reason?.message}`);

      if (daily.status === 'fulfilled') setDailyPlan(daily.value);
      else errors.push(`Daily: ${daily.reason?.message}`);

      if (monthly.status === 'fulfilled') setMonthlyPlan(monthly.value);
      else errors.push(`Monthly: ${monthly.reason?.message}`);

      if (velocity.status === 'fulfilled') setVelocityData(velocity.value);
      else errors.push(`Velocity: ${velocity.reason?.message}`);

      if (mSummary.status === 'fulfilled') setMasterySummary(mSummary.value);
      else errors.push(`Mastery Summary: ${mSummary.reason?.message}`);

      if (mForecast.status === 'fulfilled') setMasteryForecast(mForecast.value);
      else errors.push(`Mastery Forecast: ${mForecast.reason?.message}`);

      if (progress.status === 'fulfilled') setSkillProgress(progress.value);
      else errors.push(`Skill Progress: ${progress.reason?.message}`);

      if (errors.length > 0) setError(errors.join('\n'));
    } finally {
      setLoading('idle');
    }
  };

  // ---- Render ----

  // When Pulse is active, render PulseSession full-screen
  if (activePulse) {
    return (
      <PulseSession
        onBack={() => setActivePulse(false)}
        gradeLevel="elementary"
      />
    );
  }

  // When a practice session is active, render PracticeModeEnhanced full-screen
  if (activeSession) {
    const { session: activeSessionItem, gate: activeGate } = activeSession;
    const skillContext = [
      activeSessionItem.subskill_description || activeSessionItem.skill_name,
      activeSessionItem.skill_description,
      activeSessionItem.unit_title,
    ].filter(Boolean).join('. ');

    return (
      <PracticeMode
        onBack={() => setActiveSession(null)}
        initialSubject={mapSubject(activeSessionItem.subject)}
        initialSkillContext={skillContext}
        initialGradeLevel="elementary" // TODO: resolve from student profile
        initialGateNumber={activeGate}
        onSessionComplete={async (result) => {
          console.log('[PlannerDashboard] Gate session complete:', result);
          try {
            await authApi.post(`/api/mastery/${studentId}/eval`, {
              subskill_id: activeSessionItem.skill_id,
              subject: activeSessionItem.subject,
              skill_id: activeSessionItem.skill_id,
              score: result.scorePercent / 10, // convert percentage to 0-10 scale
              source: 'practice',
            });
            console.log('[PlannerDashboard] Eval result posted to backend');
          } catch (e) {
            console.error('[PlannerDashboard] Failed to post eval result:', e);
          }
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-400">
            Planner Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Weekly pacing + daily session router + monthly projection (Firestore-native)
          </p>
        </div>
        <Button
          variant="ghost"
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
          onClick={onBack}
        >
          Back
        </Button>
      </div>

      {/* Controls */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Student ID</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/60 border border-white/10 rounded-lg text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                placeholder="e.g. 1"
              />
            </div>
            <Button
              variant="ghost"
              className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300"
              onClick={fetchWeeklyPlan}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'weekly' ? 'Loading...' : 'Fetch Weekly'}
            </Button>
            <Button
              variant="ghost"
              className="bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-300"
              onClick={fetchDailyPlan}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'daily' ? 'Loading...' : 'Fetch Daily'}
            </Button>
            <Button
              variant="ghost"
              className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300"
              onClick={fetchMonthlyPlan}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'monthly' ? 'Loading...' : 'Fetch Monthly'}
            </Button>
            <Button
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300"
              onClick={fetchVelocity}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'velocity' ? 'Loading...' : 'Fetch Velocity'}
            </Button>
            <Button
              variant="ghost"
              className="bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-300"
              onClick={fetchMastery}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'mastery' ? 'Loading...' : 'Fetch Mastery'}
            </Button>
            <Button
              variant="ghost"
              className="bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300"
              onClick={fetchProgress}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'progress' ? 'Loading...' : 'Fetch Progress'}
            </Button>
            <Button
              variant="ghost"
              className="bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300"
              onClick={fetchAll}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'all' ? 'Loading...' : 'Fetch All'}
            </Button>
            <Button
              variant="ghost"
              className={`border text-xs ${showRawJson ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}
              onClick={() => setShowRawJson(!showRawJson)}
            >
              {showRawJson ? 'Hide JSON' : 'Raw JSON'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="backdrop-blur-xl bg-red-900/20 border-red-500/30">
          <CardContent className="pt-6">
            <pre className="text-red-400 text-sm whitespace-pre-wrap">{error}</pre>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/60 rounded-lg border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab('weekly')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'weekly'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Weekly Plan {weeklyPlan && '(loaded)'}
        </button>
        <button
          onClick={() => setActiveTab('session')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'session'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Today&apos;s Session
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'daily'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Daily Plan {dailyPlan && '(loaded)'}
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'monthly'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Monthly Projection {monthlyPlan && '(loaded)'}
        </button>
        <button
          onClick={() => setActiveTab('velocity')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'velocity'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Velocity {velocityData && '(loaded)'}
        </button>
        <button
          onClick={() => setActiveTab('mastery')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'mastery'
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Mastery {masterySummary && '(loaded)'}
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'progress'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Skill Progress {skillProgress && '(loaded)'}
        </button>
      </div>

      {/* ================================================================ */}
      {/* WEEKLY TAB                                                        */}
      {/* ================================================================ */}
      {activeTab === 'weekly' && (
        <div className="space-y-6 animate-fade-in">
          {!weeklyPlan && loading !== 'weekly' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Weekly&quot; to load the weekly pacing snapshot.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'weekly' || loading === 'all') && !weeklyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Loading weekly plan...</div>
              </CardContent>
            </Card>
          )}

          {weeklyPlan && (
            <>
              {/* School Year Overview */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">School Year Pacing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">
                        {Math.round((weeklyPlan.school_year.fractionElapsed || 0) * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Year Elapsed</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">{weeklyPlan.school_year.weeksRemaining}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Weeks Left</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-cyan-400">{weeklyPlan.daily_session_capacity}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Daily Capacity</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-emerald-400">{weeklyPlan.sustainable_new_per_day.toFixed(1)}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Sustainable New/Day</div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>Week of: {weeklyPlan.week_of}</span>
                    <span>{weeklyPlan.school_year.start} → {weeklyPlan.school_year.end}</span>
                  </div>
                  {/* Year progress bar */}
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${(weeklyPlan.school_year.fractionElapsed || 0) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {weeklyPlan.warnings && weeklyPlan.warnings.length > 0 && (
                <Card className="backdrop-blur-xl bg-amber-900/20 border-amber-500/30">
                  <CardContent className="pt-6">
                    <div className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Warnings</div>
                    <ul className="space-y-1">
                      {weeklyPlan.warnings.map((w, i) => (
                        <li key={i} className="text-sm text-amber-300/80">{w}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Subject Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(weeklyPlan.subjects).map(([name, stats]) => (
                  <SubjectCard key={name} name={name} stats={stats} />
                ))}
              </div>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && weeklyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Weekly Plan — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(weeklyPlan, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* DAILY TAB                                                         */}
      {/* ================================================================ */}
      {activeTab === 'daily' && (
        <div className="space-y-6 animate-fade-in">
          {!dailyPlan && loading !== 'daily' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Daily&quot; to load today&apos;s session queue.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'daily' || loading === 'all') && !dailyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Loading daily plan...</div>
              </CardContent>
            </Card>
          )}

          {dailyPlan && (
            <>
              {/* Daily overview */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    {dailyPlan.day_of_week}, {dailyPlan.date}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">{dailyPlan.capacity}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Capacity</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="text-2xl font-bold text-blue-400">{dailyPlan.review_slots}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Review Slots</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-2xl font-bold text-emerald-400">{dailyPlan.new_slots}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">New Slots</div>
                    </div>
                  </div>

                  {/* Interleaving category breakdown */}
                  {dailyPlan.sessions.some(s => s.session_category) && (
                    <div className="flex gap-3 mt-3 pt-3 border-t border-white/5 text-center">
                      <div className="flex-1 p-2 rounded-lg bg-cyan-500/5">
                        <div className="text-sm font-bold text-cyan-400">
                          {dailyPlan.sessions.filter(s => s.session_category === 'interleaved').length}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase">Core</div>
                      </div>
                      <div className="flex-1 p-2 rounded-lg bg-slate-500/5">
                        <div className="text-sm font-bold text-slate-400">
                          {dailyPlan.sessions.filter(s => s.session_category === 'tail').length}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase">Cool Down</div>
                      </div>
                    </div>
                  )}

                  {/* Week progress */}
                  {Object.keys(dailyPlan.week_progress).length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-white/5">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Week Progress</div>
                      {Object.entries(dailyPlan.week_progress).map(([subject, progress]) => (
                        <WeekProgressBar key={subject} subject={subject} progress={progress} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Warnings */}
              {dailyPlan.warnings && dailyPlan.warnings.length > 0 && (
                <Card className="backdrop-blur-xl bg-amber-900/20 border-amber-500/30">
                  <CardContent className="pt-6">
                    <div className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Warnings</div>
                    <ul className="space-y-1">
                      {dailyPlan.warnings.map((w, i) => (
                        <li key={i} className="text-sm text-amber-300/80">{w}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Session Queue */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Session Queue ({dailyPlan.sessions.length} items)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyPlan.sessions.length === 0 ? (
                    <p className="text-slate-500 text-sm py-4 text-center">No sessions scheduled.</p>
                  ) : (
                    <div className="space-y-2">
                      {dailyPlan.sessions.map((session, i) => {
                        const prevCategory = i > 0 ? dailyPlan.sessions[i - 1].session_category : null;
                        const showDivider = session.session_category && session.session_category !== prevCategory;

                        return (
                          <React.Fragment key={`${session.skill_id}-${i}`}>
                            {showDivider && <SectionDivider category={session.session_category!} />}
                            <SessionRow
                              session={session}
                              gate={getGateForSkill(session.skill_id)}
                              onStart={handleStartSession}
                            />
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && dailyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Daily Plan — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(dailyPlan, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* SESSION TAB — Two-phase daily session (Lessons + Pulse)           */}
      {/* ================================================================ */}
      {activeTab === 'session' && (
        <div className="animate-fade-in">
          <DailySessionView
            studentId={studentId}
            onStartPulse={() => setActivePulse(true)}
          />
        </div>
      )}

      {/* ================================================================ */}
      {/* MONTHLY TAB                                                       */}
      {/* ================================================================ */}
      {activeTab === 'monthly' && (
        <div className="space-y-6 animate-fade-in">
          {!monthlyPlan && loading !== 'monthly' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Monthly&quot; to load the forward projection.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'monthly' || loading === 'all') && !monthlyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Running forward simulation...</div>
              </CardContent>
            </Card>
          )}

          {monthlyPlan && (
            <>
              {/* School Year Overview */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Monthly Forward Projection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">
                        {Math.round((monthlyPlan.schoolYear.fractionElapsed || 0) * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Year Elapsed</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">{monthlyPlan.schoolYear.weeksRemaining}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Weeks Remaining</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-amber-400">
                        {Object.keys(monthlyPlan.projections).length}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Subjects Projected</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500 text-right">
                    Generated: {new Date(monthlyPlan.generatedAt).toLocaleString()}
                  </div>
                  {/* Year progress bar */}
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                      style={{ width: `${(monthlyPlan.schoolYear.fractionElapsed || 0) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Aggregate warnings across all subjects */}
              {(() => {
                const allWarnings = Object.entries(monthlyPlan.projections).flatMap(
                  ([subj, proj]) => proj.warnings.map(w => ({ ...w, subject: subj }))
                );
                if (allWarnings.length === 0) return null;
                return (
                  <Card className="backdrop-blur-xl bg-amber-900/20 border-amber-500/30">
                    <CardContent className="pt-6">
                      <div className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">
                        Projected Warnings ({allWarnings.length})
                      </div>
                      <div className="space-y-2">
                        {allWarnings.map((w, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <span className="text-xs text-slate-500 capitalize w-24 truncate flex-shrink-0">{w.subject}</span>
                            <MonthlyWarningRow warning={w} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Per-subject projection cards */}
              <div className="space-y-6">
                {Object.entries(monthlyPlan.projections).map(([name, projection]) => (
                  <SubjectProjectionCard key={name} name={name} projection={projection} />
                ))}
              </div>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && monthlyPlan && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Monthly Plan — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(monthlyPlan, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* VELOCITY TAB (PRD Section 15)                                    */}
      {/* ================================================================ */}
      {activeTab === 'velocity' && (
        <div className="space-y-6 animate-fade-in">
          {!velocityData && loading !== 'velocity' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Velocity&quot; to load the mastery velocity report.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'velocity' || loading === 'all') && !velocityData && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Computing pipeline-adjusted velocity...</div>
              </CardContent>
            </Card>
          )}

          {velocityData && (
            <>
              {/* Aggregate velocity overview */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Mastery Velocity — Pipeline-Adjusted
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Headline gauge */}
                    <VelocityGauge velocity={velocityData.aggregate.velocity} label="Overall Velocity" size="lg" />

                    {/* Earned vs Expected */}
                    <div className="flex flex-col justify-center space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Earned Mastery</span>
                        <span className="text-white font-mono font-bold">{velocityData.aggregate.earnedMastery}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Expected Mastery</span>
                        <span className="text-white font-mono font-bold">{velocityData.aggregate.adjustedExpectedMastery}</span>
                      </div>
                      <div className="pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">8-Week Trend</span>
                          <TrendSparkline trend={velocityData.aggregate.trend} />
                        </div>
                      </div>
                    </div>

                    {/* School year context */}
                    <div className="flex flex-col justify-center space-y-2">
                      <div className="text-center p-3 rounded-lg bg-white/5">
                        <div className="text-2xl font-bold text-white">
                          {Math.round(velocityData.schoolYear.fractionElapsed * 100)}%
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Year Elapsed</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 rounded-lg bg-white/5">
                          <div className="text-lg font-bold text-white">{velocityData.schoolYear.weeksCompleted}</div>
                          <div className="text-[9px] text-slate-500 uppercase">Wks Done</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-white/5">
                          <div className="text-lg font-bold text-white">{velocityData.schoolYear.weeksRemaining}</div>
                          <div className="text-[9px] text-slate-500 uppercase">Wks Left</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>As of: {velocityData.asOfDate}</span>
                    <span>
                      Velocity = Earned ({velocityData.aggregate.earnedMastery}) / Expected ({velocityData.aggregate.adjustedExpectedMastery})
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Per-subject velocity gauges (compact row) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(velocityData.subjects).map(([name, subj]) => (
                  <VelocityGauge key={name} velocity={subj.velocity} label={name} />
                ))}
              </div>

              {/* Per-subject detailed cards */}
              <div className="space-y-4">
                {Object.entries(velocityData.subjects).map(([name, subj]) => (
                  <SubjectVelocityCard key={name} name={name} data={subj} />
                ))}
              </div>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && velocityData && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Velocity — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(velocityData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* MASTERY TAB (PRD Section 6.2 — 4-Gate Lifecycle)                */}
      {/* ================================================================ */}
      {activeTab === 'mastery' && (
        <div className="space-y-6 animate-fade-in">
          {!masterySummary && loading !== 'mastery' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center space-y-4">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Mastery&quot; to load the 4-gate mastery lifecycle.</p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="ghost"
                    className="bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-300"
                    onClick={fetchMastery}
                    disabled={loading !== 'idle' || !studentId}
                  >
                    Fetch Mastery
                  </Button>
                  <Button
                    variant="ghost"
                    className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300"
                    onClick={seedMasteryData}
                    disabled={loading !== 'idle' || !studentId}
                  >
                    Seed Demo Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Curriculum seed picker — always visible when no data loaded */}
          {!masterySummary && loading !== 'mastery' && loading !== 'all' && (
            <MasterySeedPanel
              studentId={studentId}
              loading={loading !== 'idle'}
              onSeeded={fetchMastery}
              onError={(msg) => setError(msg)}
              onLoadingChange={(isLoading) => setLoading(isLoading ? 'mastery' : 'idle')}
            />
          )}

          {(loading === 'mastery' || loading === 'all') && !masterySummary && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Loading mastery lifecycle data...</div>
              </CardContent>
            </Card>
          )}

          {masterySummary && (
            <>
              {/* Overview card */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Mastery Lifecycle Overview
                  </CardTitle>
                  <Button
                    variant="ghost"
                    className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs h-7 px-3"
                    onClick={seedMasteryData}
                    disabled={loading !== 'idle'}
                  >
                    {loading === 'mastery' ? 'Seeding...' : 'Seed Demo Data'}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <div className="text-2xl font-bold text-white">{masterySummary.total_subskills}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Subskills Tracked</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-2xl font-bold text-emerald-400">{masterySummary.fully_mastered}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Fully Mastered</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <div className="text-2xl font-bold text-cyan-400">
                        {Math.round(masterySummary.average_completion_pct * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Avg Completion</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="text-2xl font-bold text-blue-400">
                        {Math.round(masterySummary.global_practice_pass_rate * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Global Pass Rate</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="text-2xl font-bold text-amber-400">
                        {Object.keys(masterySummary.by_subject).length}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Subjects</div>
                    </div>
                  </div>

                  {/* Overall gate distribution */}
                  <div className="p-3 rounded-lg bg-slate-800/30 border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Gate Distribution (All Subjects)</div>
                    <GateDistributionBar byGate={masterySummary.by_gate} total={masterySummary.total_subskills} />
                  </div>

                  {/* Gate legend */}
                  <div className="flex flex-wrap gap-3 mt-3 justify-center">
                    {GATE_LABELS.map((label, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${GATE_COLORS[i]}`} />
                        <span className="text-[10px] text-slate-500">G{i}: {label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-slate-500 text-right">
                    Queried: {masterySummary.queried_at ? new Date(masterySummary.queried_at).toLocaleString() : '—'}
                  </div>
                </CardContent>
              </Card>

              {/* Curriculum-based seed picker */}
              <MasterySeedPanel
                studentId={studentId}
                loading={loading !== 'idle'}
                onSeeded={fetchMastery}
                onError={(msg) => setError(msg)}
                onLoadingChange={(isLoading) => setLoading(isLoading ? 'mastery' : 'idle')}
              />

              {/* Forecast summary by subject */}
              {masteryForecast && Object.keys(masteryForecast.by_subject).length > 0 && (
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                      Subject ETAs (Workload Forecast)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Object.entries(masteryForecast.by_subject).map(([subj, data]) => (
                        <div key={subj} className="text-center p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 capitalize">{subj}</div>
                          <div className="text-2xl font-bold text-amber-400 font-mono">
                            {Math.round(data.estimated_days)}d
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">estimated remaining</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Unit-level forecast */}
              {masteryForecast && Object.keys(masteryForecast.by_unit).length > 0 && (
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                      Unit Forecasts ({Object.keys(masteryForecast.by_unit).length} units)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {Object.entries(masteryForecast.by_unit).map(([unitId, data]) => (
                        <UnitForecastRow key={unitId} unitId={unitId} data={data} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Per-subject mastery cards */}
              <div className="space-y-6">
                {Object.entries(masterySummary.by_subject).map(([name, summary]) => (
                  <SubjectMasteryCard
                    key={name}
                    name={name}
                    summary={summary}
                    forecasts={masteryForecast?.subskill_forecasts.filter(f => f.subject === name) || []}
                    subjectEta={masteryForecast?.by_subject[name]}
                  />
                ))}
              </div>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && masterySummary && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Mastery Summary — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(masterySummary, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
          {showRawJson && masteryForecast && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Mastery Forecast — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(masteryForecast, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* SKILL PROGRESS TAB — 3-Layer Crafting Projection                */}
      {/* ================================================================ */}
      {activeTab === 'progress' && (
        <div className="space-y-6 animate-fade-in">
          {!skillProgress && loading !== 'progress' && loading !== 'all' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Progress&quot; to load the skill progress panel.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'progress' || loading === 'all') && !skillProgress && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <div className="animate-pulse text-slate-400">Computing prerequisite readiness...</div>
              </CardContent>
            </Card>
          )}

          {skillProgress && (
            <>
              {/* Layer 1: Crafting Now */}
              {skillProgress.crafting_now.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    Working Toward
                  </h3>
                  {skillProgress.crafting_now.map((item) => (
                    <CraftingCard key={item.skill_id} item={item} />
                  ))}
                </div>
              )}

              {/* Layer 2: Almost Ready */}
              {skillProgress.almost_ready.length > 0 && (
                <AlmostReadyList items={skillProgress.almost_ready} />
              )}

              {/* Layer 3: Progress Overview */}
              {Object.keys(skillProgress.progress_overview).length > 0 && (
                <ProgressOverview subjects={skillProgress.progress_overview} />
              )}

              {skillProgress.crafting_now.length === 0 &&
                skillProgress.almost_ready.length === 0 &&
                Object.keys(skillProgress.progress_overview).length === 0 && (
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardContent className="py-12 text-center">
                    <p className="text-slate-500">No skill progress data available. Seed mastery data first to see prerequisites.</p>
                  </CardContent>
                </Card>
              )}

              <div className="text-xs text-slate-500 text-right">
                Generated: {new Date(skillProgress.generated_at).toLocaleString()}
              </div>
            </>
          )}

          {/* Raw JSON */}
          {showRawJson && skillProgress && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Skill Progress — Raw JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(skillProgress, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
