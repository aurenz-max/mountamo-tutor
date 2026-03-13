'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '../components/SpotlightCard';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { PulseActivityRenderer } from './PulseActivityRenderer';
import { pulseApi } from './pulseApi';
import type { GradeLevel } from '../components/GradeLevelSelector';
import type {
  PulseSessionSummary,
  PulseSessionResponse,
  PulseResultResponse,
  LeapfrogEvent,
  ThetaUpdate,
  PulseBand,
  PulseItemSpec,
  RecentPrimitive,
  SkillDetail,
  SkillUnlockProgress,
} from './types';
import { BAND_LABELS, BAND_COLORS } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG = '[Pulse]';
const PULSE_STORAGE_KEY = 'lumina-pulse-session';

// ---------------------------------------------------------------------------
// Session-level phases (not item-level — that's in PulseActivityRenderer)
// ---------------------------------------------------------------------------

type SessionPhase = 'ready' | 'creating' | 'active' | 'summary' | 'error';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

interface PulseSessionStorage {
  sessionId: string;
  subject: string;
  startedAt: string;
}

function saveToStorage(data: PulseSessionStorage) {
  try { localStorage.setItem(PULSE_STORAGE_KEY, JSON.stringify(data)); } catch { /* */ }
}
function clearStorage() {
  try { localStorage.removeItem(PULSE_STORAGE_KEY); } catch { /* */ }
}
function loadFromStorage(): PulseSessionStorage | null {
  try {
    const raw = localStorage.getItem(PULSE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PulseSessionStorage;
    const age = Date.now() - new Date(data.startedAt).getTime();
    if (age > 2 * 60 * 60 * 1000) { clearStorage(); return null; }
    return data;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PulseSessionProps {
  onBack: () => void;
  initialSubject?: string;
  gradeLevel?: GradeLevel;
  onComplete?: (summary: PulseSessionSummary) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PulseSession: React.FC<PulseSessionProps> = ({
  onBack,
  initialSubject,
  gradeLevel = 'elementary',
  onComplete,
}) => {
  // Session-level state
  const [phase, setPhase] = useState<SessionPhase>('ready');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(initialSubject ?? null);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');

  // Active session data (set after creation)
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionItems, setSessionItems] = useState<PulseItemSpec[]>([]);
  const [recentPrimitives, setRecentPrimitives] = useState<RecentPrimitive[]>([]);
  const [isColdStart, setIsColdStart] = useState(false);

  // Summary data (set after session completes)
  const [summary, setSummary] = useState<PulseSessionSummary | null>(null);
  const [sessionLeapfrogs, setSessionLeapfrogs] = useState<LeapfrogEvent[]>([]);

  // Resume detection
  const [savedSession, setSavedSession] = useState<PulseSessionStorage | null>(null);
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) setSavedSession(stored);
  }, []);

  // -------------------------------------------------------------------------
  // Create a new session
  // -------------------------------------------------------------------------

  const startSession = useCallback(async (subject: string, itemCount?: number) => {
    setPhase('creating');
    setError(null);
    setStreamingMessage('Setting up your session...');
    console.log(`${LOG} Creating session for subject="${subject}"`);

    try {
      const response: PulseSessionResponse = await pulseApi.createSession(subject, itemCount);
      console.log(`${LOG} Session created: id=${response.session_id} items=${response.items.length} cold_start=${response.is_cold_start}`);

      setSessionId(response.session_id);
      setSessionItems(response.items);
      setRecentPrimitives(response.recent_primitives ?? []);
      setIsColdStart(response.is_cold_start);
      setSelectedSubject(subject);

      saveToStorage({
        sessionId: response.session_id,
        subject: response.subject,
        startedAt: new Date().toISOString(),
      });

      if (response.items.length === 0) {
        throw new Error('No items returned from Pulse engine');
      }

      setPhase('active');
      setStreamingMessage('');
    } catch (err) {
      console.error(`${LOG} Failed to create session:`, err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setPhase('error');
      setStreamingMessage('');
    }
  }, []);

  // -------------------------------------------------------------------------
  // Resume a saved session
  // -------------------------------------------------------------------------

  const resumeSession = useCallback(async () => {
    const stored = savedSession ?? loadFromStorage();
    if (!stored) return;

    setPhase('creating');
    setError(null);
    setStreamingMessage('Resuming your session...');
    setSavedSession(null);
    console.log(`${LOG} Resuming session: id=${stored.sessionId}`);

    try {
      const response = await pulseApi.getSession(stored.sessionId);
      const items: PulseItemSpec[] = (response as unknown as { items: PulseItemSpec[] }).items ?? [];

      // Find first uncompleted item
      const rawItems = (response as unknown as { items: Array<PulseItemSpec & { score?: number | null }> }).items ?? [];
      let resumeIndex = 0;
      for (let i = 0; i < rawItems.length; i++) {
        if (rawItems[i].score == null) { resumeIndex = i; break; }
      }

      if (resumeIndex >= items.length) {
        // All done — go to summary
        try {
          const summaryData = await pulseApi.getSummary(stored.sessionId);
          setSummary(summaryData);
        } catch { /* continue */ }
        clearStorage();
        setPhase('summary');
        return;
      }

      setSessionId(stored.sessionId);
      setSessionItems(items);
      setIsColdStart((response as unknown as { is_cold_start?: boolean }).is_cold_start ?? false);
      setSelectedSubject(stored.subject);
      setPhase('active');
      setStreamingMessage('');
    } catch (err) {
      console.error(`${LOG} Failed to resume session:`, err);
      clearStorage();
      setSavedSession(null);
      setError(err instanceof Error ? err.message : 'Failed to resume session');
      setPhase('error');
      setStreamingMessage('');
    }
  }, [savedSession]);

  // -------------------------------------------------------------------------
  // Handle session completion (callback from PulseActivityRenderer)
  // -------------------------------------------------------------------------

  const handleSessionComplete = useCallback(async (leapfrogs: LeapfrogEvent[], _results: PulseResultResponse[]) => {
    console.log(`${LOG} Session complete! Fetching summary...`);
    setSessionLeapfrogs(leapfrogs);

    if (sessionId) {
      try {
        const summaryData = await pulseApi.getSummary(sessionId);
        setSummary(summaryData);
        console.log(`${LOG} Summary loaded: ${summaryData.items_completed} items, ${summaryData.skills_advanced.length} skills advanced`);
      } catch (err) {
        console.warn(`${LOG} Failed to fetch summary:`, err);
      }
    }

    clearStorage();
    setPhase('summary');
  }, [sessionId]);

  // -------------------------------------------------------------------------
  // Reset everything
  // -------------------------------------------------------------------------

  const reset = useCallback(() => {
    setPhase('ready');
    setSessionId(null);
    setSessionItems([]);
    setRecentPrimitives([]);
    setIsColdStart(false);
    setSummary(null);
    setSessionLeapfrogs([]);
    setError(null);
    setStreamingMessage('');
    setSavedSession(null);
    clearStorage();
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <LuminaAIProvider>
      <div className="min-h-screen">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-between max-w-5xl mx-auto px-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 hover:text-white text-sm gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
            <h1 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-100 to-slate-400">
              Lumina Pulse
            </h1>
            <div className="w-20" />
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 pb-12">
          {/* ---- READY ---- */}
          {phase === 'ready' && (
            <>
              {savedSession && (
                <ResumePrompt
                  subject={savedSession.subject}
                  startedAt={savedSession.startedAt}
                  onResume={resumeSession}
                  onDismiss={() => { clearStorage(); setSavedSession(null); }}
                />
              )}
              <PulseWelcome
                subject={selectedSubject}
                onSelectSubject={setSelectedSubject}
                onStart={(subj) => startSession(subj)}
              />
            </>
          )}

          {/* ---- CREATING ---- */}
          {phase === 'creating' && (
            <div className="flex items-center justify-center py-16 animate-fade-in">
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 max-w-md w-full">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-violet-500/20 flex items-center justify-center">
                      <span className="text-3xl">&#9889;</span>
                    </div>
                    <div className="absolute inset-0 rounded-2xl border-2 border-violet-400/40 animate-ping" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-200 text-lg font-medium">
                      {streamingMessage || 'Preparing your session...'}
                    </p>
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ---- ACTIVE SESSION (delegated to PulseActivityRenderer) ---- */}
          {phase === 'active' && sessionId && sessionItems.length > 0 && (
            <PulseActivityRenderer
              sessionId={sessionId}
              items={sessionItems}
              gradeLevel={gradeLevel}
              recentPrimitives={recentPrimitives}
              onSessionComplete={handleSessionComplete}
            />
          )}

          {/* ---- SUMMARY ---- */}
          {phase === 'summary' && (
            <PulseSummaryCard
              summary={summary}
              leapfrogs={sessionLeapfrogs}
              isColdStart={isColdStart}
              onDone={() => {
                if (summary) onComplete?.(summary);
                onBack();
              }}
              onPlayAgain={() => {
                reset();
                if (selectedSubject) startSession(selectedSubject);
              }}
            />
          )}

          {/* ---- ERROR ---- */}
          {phase === 'error' && (
            <div className="animate-fade-in">
              <Card className="backdrop-blur-xl bg-red-900/20 border-red-500/20 max-w-lg mx-auto">
                <CardContent className="p-8 text-center space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/30 to-rose-500/30 border border-red-500/20 flex items-center justify-center mx-auto">
                    <span className="text-3xl">&#128533;</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Something went wrong</h3>
                  <p className="text-slate-400 text-sm">{error || 'An unexpected error occurred.'}</p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="ghost" onClick={reset} className="bg-white/5 border border-white/20 hover:bg-white/10">
                      Try Again
                    </Button>
                    <Button variant="ghost" onClick={onBack} className="bg-white/5 border border-white/20 hover:bg-white/10">
                      Go Back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </LuminaAIProvider>
  );
};

// ===========================================================================
// Sub-components (session-level only — item chrome is in PulseActivityRenderer)
// ===========================================================================

// ---------------------------------------------------------------------------
// Resume prompt
// ---------------------------------------------------------------------------

const PULSE_SUBJECTS: { value: string; label: string; icon: string; color: string }[] = [
  { value: 'mathematics', label: 'Mathematics', icon: '\u{1F522}', color: '56, 189, 248' },
  { value: 'science', label: 'Science', icon: '\u{1F52C}', color: '74, 222, 128' },
  { value: 'language-arts', label: 'Language Arts', icon: '\u{1F4D6}', color: '168, 85, 247' },
  { value: 'reading', label: 'Reading', icon: '\u{1F4DA}', color: '244, 114, 182' },
];

function ResumePrompt({ subject, startedAt, onResume, onDismiss }: {
  subject: string; startedAt: string; onResume: () => void; onDismiss: () => void;
}) {
  const label = PULSE_SUBJECTS.find((s) => s.value === subject)?.label || subject;
  const ago = formatTimeAgo(startedAt);

  return (
    <div className="max-w-lg mx-auto mb-6 animate-fade-in">
      <Card className="backdrop-blur-xl bg-amber-900/20 border-amber-500/20">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/20 flex items-center justify-center shrink-0">
            <span className="text-lg">{'\u23F3'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 font-medium">Unfinished session</p>
            <p className="text-xs text-slate-500 truncate">{label} &middot; started {ago}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={onResume} className="bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-200 text-xs px-3 py-1.5 h-auto">
              Resume
            </Button>
            <Button variant="ghost" onClick={onDismiss} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1.5 h-auto">
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimeAgo(isoString: string): string {
  try {
    const ms = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  } catch { return 'recently'; }
}

// ---------------------------------------------------------------------------
// Welcome
// ---------------------------------------------------------------------------

function PulseWelcome({ subject, onSelectSubject, onStart }: {
  subject: string | null; onSelectSubject: (s: string | null) => void; onStart: (subject: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-fade-in">
      <SpotlightCard color="139, 92, 246" className="bg-gradient-to-br from-violet-900/20 to-blue-900/20 max-w-lg w-full">
        <div className="p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-violet-500/20 flex items-center justify-center mx-auto">
            <span className="text-4xl">{'\u26A1'}</span>
          </div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-100 to-slate-300">
            Ready for Pulse?
          </h2>
          <p className="text-slate-400 leading-relaxed">
            A mix of new challenges, skill building, and quick reviews —
            all tuned to where you are right now. Let&apos;s see what you can do!
          </p>

          {!subject && (
            <div className="space-y-3">
              <h4 className="text-[10px] uppercase tracking-widest font-mono text-slate-500">Pick a subject</h4>
              <div className="grid grid-cols-2 gap-3">
                {PULSE_SUBJECTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => onSelectSubject(s.value)}
                    className="glass-panel rounded-xl border border-white/10 p-4 text-center hover:border-white/25 transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <span className="text-2xl block mb-1">{s.icon}</span>
                    <span className="text-sm text-slate-200">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {subject && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">{PULSE_SUBJECTS.find((s) => s.value === subject)?.icon || '\u{1F4DD}'}</span>
              <span className="text-slate-200 font-medium">{PULSE_SUBJECTS.find((s) => s.value === subject)?.label || subject}</span>
              <button onClick={() => onSelectSubject(null)} className="text-xs text-slate-500 hover:text-slate-300 ml-1">change</button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="glass-panel rounded-xl border border-violet-500/20 p-3 text-center">
              <div className="text-violet-400 text-lg font-bold">20%</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Explore</div>
            </div>
            <div className="glass-panel rounded-xl border border-blue-500/20 p-3 text-center">
              <div className="text-blue-400 text-lg font-bold">65%</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Build</div>
            </div>
            <div className="glass-panel rounded-xl border border-emerald-500/20 p-3 text-center">
              <div className="text-emerald-400 text-lg font-bold">15%</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Review</div>
            </div>
          </div>

          <Button
            onClick={() => subject && onStart(subject)}
            disabled={!subject}
            className="bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white px-10 py-4 text-lg rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-400/30 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Pulse
          </Button>
        </div>
      </SpotlightCard>
      <p className="text-xs text-slate-600 max-w-sm text-center">
        About 10-15 minutes. Activities are adapted to your level in real-time.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

/** Shorten skill IDs for display */
function formatSkillId(id: string): string {
  const parts = id.split('.');
  return parts.length > 2 ? parts.slice(1).join('.') : id;
}

function PulseSummaryCard({ summary, leapfrogs, isColdStart, onDone, onPlayAgain }: {
  summary: PulseSessionSummary | null; leapfrogs: LeapfrogEvent[]; isColdStart: boolean;
  onDone: () => void; onPlayAgain: () => void;
}) {
  const [expandedLeapfrog, setExpandedLeapfrog] = useState<number | null>(null);

  return (
    <div className="animate-fade-in max-w-lg mx-auto space-y-6">
      <SpotlightCard color="139, 92, 246" className="bg-gradient-to-br from-violet-900/20 to-blue-900/20">
        <div className="p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-violet-500/20 flex items-center justify-center mx-auto">
            <span className="text-4xl">&#127881;</span>
          </div>

          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-100 to-slate-300">
            {summary?.celebration_message || 'Great work!'}
          </h2>

          {isColdStart && (
            <p className="text-slate-400">We&apos;ve mapped your starting point. Future sessions will build from here!</p>
          )}

          {summary && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="glass-panel rounded-xl border border-white/10 p-4">
                <div className="text-2xl font-bold text-white">{summary.items_completed}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Completed</div>
              </div>
              <div className="glass-panel rounded-xl border border-white/10 p-4">
                <div className="text-2xl font-bold text-white">
                  {summary.duration_ms > 0 ? `${Math.round(summary.duration_ms / 60000)}m` : '--'}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Duration</div>
              </div>
            </div>
          )}

          {summary && Object.keys(summary.bands).length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-[10px] uppercase tracking-widest font-mono text-slate-500">Session breakdown</h4>
              {Object.entries(summary.bands).map(([band, stats]) => (
                <div key={band} className="flex items-center justify-between glass-panel rounded-lg border border-white/10 px-4 py-2">
                  <span className={`text-sm font-medium ${BAND_COLORS[band as PulseBand] || 'text-slate-300'}`}>
                    {BAND_LABELS[band as PulseBand] || band}
                  </span>
                  <span className="text-slate-400 text-sm">
                    {stats.items_completed}/{stats.items_total} &middot; {Math.round(stats.avg_score * 10)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Leapfrogs — expandable */}
          {leapfrogs.length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-[10px] uppercase tracking-widest font-mono text-violet-400">Leapfrogs</h4>
              {leapfrogs.map((lf, i) => {
                const isExpanded = expandedLeapfrog === i;
                return (
                  <div key={i}>
                    <button
                      onClick={() => setExpandedLeapfrog(isExpanded ? null : i)}
                      className="w-full glass-panel rounded-lg border border-violet-500/20 px-4 py-2 text-left hover:border-violet-500/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-violet-300">
                          &#128640; Skipped {lf.inferred_skills.length} {lf.inferred_skills.length === 1 ? 'skill' : 'skills'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Score: {Math.round(lf.aggregate_score * 10)}%</span>
                          <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <LeapfrogDetail leapfrog={lf} />
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Skills Advanced — show which skills leveled up */}
          {summary && summary.skills_advanced.length > 0 && (
            <SkillsAdvancedSection skillsAdvanced={summary.skills_advanced} />
          )}

          {summary && summary.theta_changes.length > 0 && (
            <ThetaGrowthSection thetaChanges={summary.theta_changes} />
          )}

          {summary && (
            <FrontierDeltaSection summary={summary} leapfrogs={leapfrogs} />
          )}

          <div className="flex gap-3 justify-center mt-6">
            <Button onClick={onPlayAgain} className="bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white px-6 py-3 rounded-xl">
              Play Again
            </Button>
            <Button variant="ghost" onClick={onDone} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">
              Done
            </Button>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theta growth helpers & components
// ---------------------------------------------------------------------------

function thetaColor(theta: number): string {
  if (theta < 2.0) return '#34d399';
  if (theta < 3.0) return '#2dd4bf';
  if (theta < 4.5) return '#38bdf8';
  if (theta < 6.0) return '#60a5fa';
  if (theta < 7.5) return '#a78bfa';
  return '#fb7185';
}

function deduplicateThetaChanges(changes: ThetaUpdate[]): ThetaUpdate[] {
  const map = new Map<string, ThetaUpdate>();
  for (const c of changes) map.set(c.skill_id, c);
  return Array.from(map.values());
}

function ThetaGrowthSection({ thetaChanges }: { thetaChanges: ThetaUpdate[] }) {
  const unique = deduplicateThetaChanges(thetaChanges);
  if (unique.length === 0) return null;
  const useChart = unique.length >= 4;

  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-[10px] uppercase tracking-widest font-mono text-blue-400 flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Ability Growth
      </h4>
      {useChart ? <ThetaLineChart changes={unique} /> : <ThetaBarList changes={unique} />}
    </div>
  );
}

function ThetaBarList({ changes }: { changes: ThetaUpdate[] }) {
  return (
    <div className="space-y-2">
      {changes.map((c) => {
        const delta = c.new_theta - c.old_theta;
        const isPositive = delta >= 0;
        const oldPct = Math.min(100, (c.old_theta / 10) * 100);
        const newPct = Math.min(100, (c.new_theta / 10) * 100);
        return (
          <div key={c.skill_id} className="glass-panel rounded-lg border border-white/10 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-300 font-mono truncate max-w-[60%]">{formatSkillId(c.skill_id)}</span>
              <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}{delta.toFixed(1)}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${oldPct}%`, backgroundColor: thetaColor(c.old_theta) }} />
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: thetaColor(c.new_theta) }}
                initial={{ width: `${oldPct}%` }}
                animate={{ width: `${newPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-600">{c.old_theta.toFixed(1)}</span>
              <span className="text-[10px] text-slate-400 font-medium">EL {c.earned_level.toFixed(1)}</span>
              <span className="text-[10px] text-slate-600">10.0</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ThetaLineChart({ changes }: { changes: ThetaUpdate[] }) {
  const data = changes.map((c) => ({
    skill: formatSkillId(c.skill_id),
    before: Number(c.old_theta.toFixed(1)),
    after: Number(c.new_theta.toFixed(1)),
  }));

  return (
    <div className="glass-panel rounded-xl border border-white/10 p-4">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="skill" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} interval={0} angle={-20} textAnchor="end" height={45} />
          <YAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} width={28} />
          <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} />
          <Line type="monotone" dataKey="before" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={{ fill: '#64748b', strokeWidth: 0, r: 3 }} name="Before" />
          <Line type="monotone" dataKey="after" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }} activeDot={{ fill: '#60a5fa', r: 5 }} name="After" />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="w-3 h-0.5 bg-slate-500 rounded inline-block" style={{ borderTop: '1px dashed' }} /> Before
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-blue-400">
          <span className="w-3 h-0.5 bg-blue-400 rounded inline-block" /> After
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leapfrog Detail (expanded view)
// ---------------------------------------------------------------------------

function LeapfrogDetail({ leapfrog }: { leapfrog: LeapfrogEvent }) {
  const probed = leapfrog.probed_details ?? [];
  const inferred = leapfrog.inferred_details ?? [];

  // Group inferred skills by parent skill
  const groupedInferred = new Map<string, { skill_description: string; count: number }>();
  for (const d of inferred) {
    const key = d.skill_id || 'unknown';
    const existing = groupedInferred.get(key);
    if (existing) {
      existing.count++;
    } else {
      groupedInferred.set(key, { skill_description: d.skill_description || key, count: 1 });
    }
  }

  return (
    <div className="glass-panel rounded-lg border border-violet-500/10 mx-1 mt-1 px-4 py-3 text-left space-y-3">
      {probed.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest font-mono text-slate-500 mb-1">You demonstrated mastery of</div>
          <div className="flex flex-wrap gap-1.5">
            {probed.map((p) => (
              <span key={p.subskill_id} className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                {p.skill_description || formatSkillId(p.subskill_id)}
              </span>
            ))}
          </div>
        </div>
      )}
      {groupedInferred.size > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest font-mono text-slate-500 mb-1">Which let you skip ahead on</div>
          <div className="space-y-1">
            {Array.from(groupedInferred.entries()).map(([skillId, { skill_description, count }]) => (
              <div key={skillId} className="flex items-center justify-between px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/15">
                <span className="text-xs text-violet-300">{skill_description}</span>
                <span className="text-[10px] text-slate-500">{count} {count === 1 ? 'subskill' : 'subskills'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skills Advanced Section
// ---------------------------------------------------------------------------

const GATE_LABELS: Record<number, string> = {
  0: 'Not started',
  1: 'Initial mastery',
  2: 'Retest 1',
  3: 'Retest 2',
  4: 'Mastered',
};

function SkillsAdvancedSection({ skillsAdvanced }: { skillsAdvanced: PulseSessionSummary['skills_advanced'] }) {
  // Group by parent skill
  const grouped = new Map<string, { skill_description: string; advances: typeof skillsAdvanced }>();
  for (const gu of skillsAdvanced) {
    const key = gu.skill_id || 'unknown';
    const existing = grouped.get(key);
    if (existing) {
      existing.advances.push(gu);
    } else {
      grouped.set(key, { skill_description: gu.skill_description || formatSkillId(gu.subskill_id), advances: [gu] });
    }
  }

  return (
    <div className="space-y-2 mt-4">
      <h4 className="text-[10px] uppercase tracking-widest font-mono text-emerald-400 flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        Skills Advanced
      </h4>
      {Array.from(grouped.entries()).map(([skillId, { skill_description, advances }]) => (
        <div key={skillId} className="glass-panel rounded-lg border border-emerald-500/15 px-4 py-2 text-left">
          <div className="text-sm text-emerald-300 font-medium">{skill_description}</div>
          {advances.map((gu) => (
            <div key={gu.subskill_id} className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500 font-mono">{formatSkillId(gu.subskill_id)}</span>
              <span className="text-[10px] text-slate-600">
                {GATE_LABELS[gu.old_gate] ?? `Gate ${gu.old_gate}`}
              </span>
              <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-[10px] text-emerald-400 font-medium">
                {GATE_LABELS[gu.new_gate] ?? `Gate ${gu.new_gate}`}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frontier Delta Section (Knowledge Map with skill progress)
// ---------------------------------------------------------------------------

function FrontierDeltaSection({ summary, leapfrogs }: { summary: PulseSessionSummary; leapfrogs: LeapfrogEvent[] }) {
  const gateAdvances = summary.skills_advanced.length;
  const leapfrogSkills = leapfrogs.reduce((sum, lf) => sum + lf.inferred_skills.length, 0);
  const totalUnlocked = gateAdvances + leapfrogSkills;
  const skillProgress = summary.skill_progress ?? [];

  if (totalUnlocked === 0 && !summary.frontier_expanded && skillProgress.length === 0) return null;

  // Unique parent skill names from progress
  const skillNames = skillProgress.map((sp) => sp.skill_description).filter(Boolean);
  const progressLabel = skillNames.length > 0
    ? `You've unlocked new subskills in ${skillNames.join(' and ')}`
    : 'Your frontier expanded — new skills are now reachable!';

  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-[10px] uppercase tracking-widest font-mono text-violet-400 flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        Knowledge Map
      </h4>
      <div className="glass-panel rounded-xl border border-white/10 p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[80px] opacity-15 bg-gradient-to-br from-violet-500 to-blue-500" />
        <div className="relative z-10 space-y-4">
          {totalUnlocked > 0 && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="flex items-center justify-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/20 to-blue-500/20 border border-violet-500/30">
                <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-blue-300">+{totalUnlocked}</span>
                <span className="text-sm text-slate-300">{totalUnlocked === 1 ? 'subskill' : 'subskills'} unlocked</span>
              </span>
            </motion.div>
          )}

          {/* Per-skill progress bars */}
          {skillProgress.length > 0 && (
            <div className="space-y-3">
              {skillProgress.map((sp) => {
                const pct = sp.total_subskills > 0 ? (sp.unlocked_subskills / sp.total_subskills) * 100 : 0;
                return (
                  <div key={sp.skill_id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">{sp.skill_description}</span>
                      <span className="text-xs text-slate-500 font-mono">{sp.unlocked_subskills}/{sp.total_subskills}</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stat boxes */}
          <div className="grid grid-cols-2 gap-3">
            {gateAdvances > 0 && (
              <div className="text-center p-3 rounded-lg bg-white/5 border border-white/5">
                <div className="text-lg font-bold text-emerald-400">{gateAdvances}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Gate advances</div>
              </div>
            )}
            {leapfrogSkills > 0 && (
              <div className="text-center p-3 rounded-lg bg-white/5 border border-white/5">
                <div className="text-lg font-bold text-violet-400">{leapfrogSkills}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Leapfrog skips</div>
              </div>
            )}
          </div>

          {summary.frontier_expanded && (
            <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center text-sm text-violet-300 font-light">
              {progressLabel}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}
