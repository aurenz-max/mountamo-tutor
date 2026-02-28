'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/authApiClient';

// ---------------------------------------------------------------------------
// Types (mirror backend response schemas)
// ---------------------------------------------------------------------------

interface SubjectWeeklyStats {
  total_skills: number;
  closed: number;
  in_review: number;
  not_started: number;
  expected_by_now: number;
  behind_by: number;
  weekly_new_target: number;
  review_reserve: number;
  avg_ultimate: number;
}

interface WeeklyPlan {
  student_id: string;
  week_of: string;
  school_year: {
    start: string;
    end: string;
    fractionElapsed: number;
    weeksRemaining: number;
  };
  daily_session_capacity: number;
  sustainable_new_per_day: number;
  subjects: Record<string, SubjectWeeklyStats>;
  warnings: string[];
}

interface SessionItem {
  skill_id: string;
  subject: string;
  skill_name: string;
  type: 'review' | 'new';
  reason: string;
  priority: number;
  // review fields
  review_session?: number;
  estimated_ultimate?: number;
  completion_factor?: number;
  days_overdue?: number;
  // new skill fields
  prerequisites_met?: boolean;
  // enrichment fields (resolved from curriculum)
  unit_title?: string;
  skill_description?: string;
  subskill_description?: string;
}

interface SubjectWeekProgress {
  new_target: number;
  new_completed: number;
  reviews_completed: number;
}

interface DailyPlan {
  student_id: string;
  date: string;
  day_of_week: string;
  capacity: number;
  review_slots: number;
  new_slots: number;
  week_progress: Record<string, SubjectWeekProgress>;
  sessions: SessionItem[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SubjectCard: React.FC<{ name: string; stats: SubjectWeeklyStats }> = ({ name, stats }) => {
  const progress = stats.total_skills > 0
    ? ((stats.closed + stats.in_review) / stats.total_skills) * 100
    : 0;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-100 capitalize flex items-center justify-between">
          {name}
          {stats.behind_by > 0 && (
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {Math.round(stats.behind_by)} behind
            </span>
          )}
          {stats.behind_by === 0 && (
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              on track
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{stats.closed} closed / {stats.total_skills} total</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-lg font-bold text-emerald-400">{stats.closed}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Closed</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-lg font-bold text-blue-400">{stats.in_review}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">In Review</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
            <div className="text-lg font-bold text-slate-400">{stats.not_started}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Not Started</div>
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-white/5">
          <span>Weekly target: <span className="text-slate-300 font-medium">{stats.weekly_new_target} new</span></span>
          <span>Reserve: <span className="text-slate-300 font-medium">{stats.review_reserve}</span></span>
          <span>Avg ult: <span className="text-slate-300 font-medium">{stats.avg_ultimate.toFixed(1)}</span></span>
        </div>
      </CardContent>
    </Card>
  );
};

const SessionRow: React.FC<{ session: SessionItem }> = ({ session }) => {
  const isReview = session.type === 'review';

  const reasonLabels: Record<string, { label: string; color: string }> = {
    tight_loop_recovery: { label: 'Tight Loop', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
    scheduled_review: { label: 'Scheduled', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    behind_pace: { label: 'Behind Pace', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    next_in_sequence: { label: 'Next Up', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  };
  const reason = reasonLabels[session.reason] || { label: session.reason, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-white/5 hover:border-white/10 transition-colors">
      {/* Priority */}
      <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-xs font-mono text-slate-500 flex-shrink-0">
        {session.priority}
      </div>

      {/* Type badge */}
      <div className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 ${
        isReview
          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
      }`}>
        {session.type}
      </div>

      {/* Skill info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">
          {session.subskill_description || session.skill_name}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {session.unit_title && (
            <span className="text-slate-400">{session.unit_title}</span>
          )}
          {session.unit_title && session.skill_description && ' / '}
          {session.skill_description && (
            <span>{session.skill_description}</span>
          )}
          {!session.unit_title && !session.skill_description && (
            <span>{session.subject} &middot; {session.skill_id}</span>
          )}
        </div>
      </div>

      {/* Reason badge */}
      <span className={`px-2 py-0.5 rounded text-[10px] border flex-shrink-0 ${reason.color}`}>
        {reason.label}
      </span>

      {/* Review-specific details */}
      {isReview && session.completion_factor !== undefined && (
        <div className="text-right flex-shrink-0 hidden sm:block">
          <div className="text-xs text-slate-400">
            CF: <span className="text-slate-200 font-mono">{(session.completion_factor * 100).toFixed(0)}%</span>
          </div>
          {session.days_overdue !== undefined && session.days_overdue > 0 && (
            <div className="text-[10px] text-red-400">{session.days_overdue}d overdue</div>
          )}
        </div>
      )}
    </div>
  );
};

const WeekProgressBar: React.FC<{ subject: string; progress: SubjectWeekProgress }> = ({ subject, progress }) => {
  const pct = progress.new_target > 0
    ? Math.min(100, (progress.new_completed / progress.new_target) * 100)
    : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 capitalize w-24 truncate">{subject}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-500 tabular-nums w-20 text-right">
        {progress.new_completed}/{progress.new_target} new &middot; {progress.reviews_completed} rev
      </span>
    </div>
  );
};

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
  const [loading, setLoading] = useState<'idle' | 'weekly' | 'daily' | 'both'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily'>('weekly');

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

  const fetchBoth = async () => {
    setLoading('both');
    setError(null);
    try {
      const [weekly, daily] = await Promise.allSettled([
        authApi.get<WeeklyPlan>(`/api/weekly-planner/${studentId}`),
        authApi.get<DailyPlan>(`/api/daily-activities/daily-plan/${studentId}`),
      ]);

      if (weekly.status === 'fulfilled') setWeeklyPlan(weekly.value);
      else setError(`Weekly: ${weekly.reason?.message}`);

      if (daily.status === 'fulfilled') setDailyPlan(daily.value);
      else setError(prev => prev ? `${prev}\nDaily: ${daily.reason?.message}` : `Daily: ${daily.reason?.message}`);
    } finally {
      setLoading('idle');
    }
  };

  // ---- Render ----

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-400">
            Planner Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Weekly pacing engine + daily session router (Firestore-native)
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
              className="bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300"
              onClick={fetchBoth}
              disabled={loading !== 'idle' || !studentId}
            >
              {loading === 'both' ? 'Loading...' : 'Fetch Both'}
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
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'daily'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Daily Plan {dailyPlan && '(loaded)'}
        </button>
      </div>

      {/* ================================================================ */}
      {/* WEEKLY TAB                                                        */}
      {/* ================================================================ */}
      {activeTab === 'weekly' && (
        <div className="space-y-6 animate-fade-in">
          {!weeklyPlan && loading !== 'weekly' && loading !== 'both' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Weekly&quot; to load the weekly pacing snapshot.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'weekly' || loading === 'both') && !weeklyPlan && (
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
          {!dailyPlan && loading !== 'daily' && loading !== 'both' && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Enter a student ID and click &quot;Fetch Daily&quot; to load today&apos;s session queue.</p>
              </CardContent>
            </Card>
          )}

          {(loading === 'daily' || loading === 'both') && !dailyPlan && (
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
                      {dailyPlan.sessions.map((session, i) => (
                        <SessionRow key={`${session.skill_id}-${i}`} session={session} />
                      ))}
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
    </div>
  );
};
