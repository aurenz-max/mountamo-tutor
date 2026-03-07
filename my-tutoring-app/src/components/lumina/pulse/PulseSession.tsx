'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '../components/SpotlightCard';
import { EvaluationProvider } from '../evaluation';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { PracticeManifestRenderer } from '../components/PracticeManifestRenderer';
import { usePulseSession } from './usePulseSession';
import type { GradeLevel } from '../components/GradeLevelSelector';
import type { PulseSessionSummary, LeapfrogEvent, ThetaUpdate, PulseBand, GateProgress } from './types';
import { BAND_LABELS, BAND_COLORS, BAND_BG_COLORS } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PulseSessionProps {
  onBack: () => void;
  /** Pre-set subject to skip selection (used when launching from planner) */
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
  const [evalSessionKey, setEvalSessionKey] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(initialSubject ?? null);

  const session = usePulseSession({ gradeLevel });

  const {
    phase,
    currentItem,
    hydratedItem,
    items,
    currentItemIndex,
    progress,
    summary,
    leapfrogs,
    latestGateProgress,
    isColdStart,
    error,
    streamingMessage,
    savedSession,
  } = session;

  // Bump eval key when item changes
  const prevItemRef = React.useRef(currentItem?.item_id);
  React.useEffect(() => {
    if (currentItem?.item_id && currentItem.item_id !== prevItemRef.current) {
      setEvalSessionKey((k) => k + 1);
    }
    prevItemRef.current = currentItem?.item_id;
  }, [currentItem?.item_id]);

  return (
    <LuminaAIProvider>
      <EvaluationProvider
        key={evalSessionKey}
        localOnly
        curriculumSubject={currentItem?.subject}
        curriculumSkillId={currentItem?.skill_id}
        curriculumSubskillId={currentItem?.subskill_id}
      >
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

            {/* Progress bar */}
            {(phase === 'practicing' || phase === 'loading') && progress.total > 0 && (
              <div className="mt-4 max-w-md mx-auto">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-400 to-blue-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (progress.completed / progress.total) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500">
                    {progress.completed} of {progress.total} activities
                  </p>
                  {currentItem && (
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${BAND_COLORS[currentItem.band]}`}>
                      {BAND_LABELS[currentItem.band]}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="max-w-5xl mx-auto px-4 pb-12">
            {/* ---- READY PHASE ---- */}
            {phase === 'ready' && (
              <>
                {savedSession && (
                  <ResumePrompt
                    subject={savedSession.subject}
                    startedAt={savedSession.startedAt}
                    onResume={() => session.resumeSession()}
                    onDismiss={() => session.dismissSavedSession()}
                  />
                )}
                <PulseWelcome
                  subject={selectedSubject}
                  onSelectSubject={setSelectedSubject}
                  onStart={(subj: string) => { session.startSession(subj); }}
                />
              </>
            )}

            {/* ---- LOADING PHASE ---- */}
            {phase === 'loading' && (
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

            {/* ---- PRACTICING PHASE ---- */}
            {phase === 'practicing' && currentItem && hydratedItem && (
              <div className="animate-fade-in">
                {/* Band indicator + challenge level + gate progress */}
                <div className="mb-4 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono uppercase tracking-wider ${BAND_BG_COLORS[currentItem.band]} ${BAND_COLORS[currentItem.band]}`}>
                      <BandIcon band={currentItem.band} />
                      {BAND_LABELS[currentItem.band]}
                    </span>
                    <ChallengeDots mode={currentItem.target_mode} />
                  </div>
                  {latestGateProgress && (
                    <GateProgressIndicator gateProgress={latestGateProgress} />
                  )}
                </div>

                {/* Activity renderer */}
                <PracticeManifestRenderer
                  item={hydratedItem}
                  itemIndex={currentItemIndex}
                  onItemComplete={(result) => {
                    session.handleItemComplete(result);
                  }}
                />

                {/* Next button */}
                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={session.handleNextItem}
                    className="bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white px-8 py-3 rounded-xl shadow-lg shadow-violet-500/20"
                  >
                    {currentItemIndex >= items.length - 1 ? 'Finish Session' : 'Next'}
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              </div>
            )}

            {/* ---- LEAPFROG CELEBRATION ---- */}
            {phase === 'leapfrog' && (
              <PulseLeapfrog
                leapfrog={leapfrogs[leapfrogs.length - 1]}
              />
            )}

            {/* ---- SUMMARY PHASE ---- */}
            {phase === 'summary' && (
              <PulseSummaryCard
                summary={summary}
                leapfrogs={leapfrogs}
                isColdStart={isColdStart}
                onDone={() => {
                  if (summary) onComplete?.(summary);
                  onBack();
                }}
                onPlayAgain={() => {
                  session.reset();
                  if (selectedSubject) session.startSession(selectedSubject);
                }}
              />
            )}

            {/* ---- ERROR PHASE ---- */}
            {phase === 'error' && (
              <div className="animate-fade-in">
                <Card className="backdrop-blur-xl bg-red-900/20 border-red-500/20 max-w-lg mx-auto">
                  <CardContent className="p-8 text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/30 to-rose-500/30 border border-red-500/20 flex items-center justify-center mx-auto">
                      <span className="text-3xl">&#128533;</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      Something went wrong
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {error || 'An unexpected error occurred.'}
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button
                        variant="ghost"
                        onClick={session.reset}
                        className="bg-white/5 border border-white/20 hover:bg-white/10"
                      >
                        Try Again
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={onBack}
                        className="bg-white/5 border border-white/20 hover:bg-white/10"
                      >
                        Go Back
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </EvaluationProvider>
    </LuminaAIProvider>
  );
};

// ---------------------------------------------------------------------------
// Band icon
// ---------------------------------------------------------------------------

function BandIcon({ band }: { band: PulseBand }) {
  switch (band) {
    case 'frontier':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      );
    case 'current':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      );
    case 'review':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Challenge level dots (6-segment visual bar)
// ---------------------------------------------------------------------------

const CHALLENGE_GRADIENT = [
  'bg-emerald-400',   // mode 1
  'bg-teal-400',      // mode 2
  'bg-sky-400',       // mode 3
  'bg-blue-400',      // mode 4
  'bg-violet-400',    // mode 5
  'bg-rose-400',      // mode 6
];

function ChallengeDots({ mode }: { mode: number }) {
  const level = Math.max(1, Math.min(6, mode));
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/5 border border-white/10">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            i < level ? CHALLENGE_GRADIENT[i] : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate progress indicator (shows after first result)
// ---------------------------------------------------------------------------

const GATE_COLORS = [
  'bg-slate-500',     // gate 0
  'bg-emerald-400',   // gate 1
  'bg-sky-400',       // gate 2
  'bg-violet-400',    // gate 3
  'bg-amber-400',     // gate 4
];

function GateProgressIndicator({ gateProgress }: { gateProgress: GateProgress }) {
  const { current_gate, theta, next_gate_theta, thresholds } = gateProgress;
  const g4 = thresholds.g4;

  // Progress fraction towards next gate (or 100% if at gate 4)
  let progressPct = 100;
  if (current_gate < 4 && next_gate_theta != null) {
    const gateValues = [0, thresholds.g1, thresholds.g2, thresholds.g3, thresholds.g4];
    const floor = gateValues[current_gate];
    const range = next_gate_theta - floor;
    progressPct = range > 0 ? Math.min(100, Math.max(0, ((theta - floor) / range) * 100)) : 100;
  }

  return (
    <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
      {/* Gate dots */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((g) => (
          <div
            key={g}
            className={`w-2 h-2 rounded-full transition-colors ${
              g <= current_gate ? GATE_COLORS[g] : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Label */}
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
        Gate {current_gate}/4
      </span>

      {/* Mini progress bar towards next gate */}
      {current_gate < 4 && (
        <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${GATE_COLORS[current_gate + 1]}`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* θ value */}
      <span className="text-[10px] font-mono text-slate-500">
        {theta.toFixed(1)}/{g4.toFixed(1)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resume prompt sub-component
// ---------------------------------------------------------------------------

function ResumePrompt({
  subject,
  startedAt,
  onResume,
  onDismiss,
}: {
  subject: string;
  startedAt: string;
  onResume: () => void;
  onDismiss: () => void;
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
            <p className="text-sm text-slate-200 font-medium">
              Unfinished session
            </p>
            <p className="text-xs text-slate-500 truncate">
              {label} &middot; started {ago}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={onResume}
              className="bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-200 text-xs px-3 py-1.5 h-auto"
            >
              Resume
            </Button>
            <Button
              variant="ghost"
              onClick={onDismiss}
              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1.5 h-auto"
            >
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
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  } catch {
    return 'recently';
  }
}

// ---------------------------------------------------------------------------
// Welcome sub-component
// ---------------------------------------------------------------------------

interface SubjectOption {
  value: string;
  label: string;
  icon: string;
  color: string; // RGB for spotlight
}

const PULSE_SUBJECTS: SubjectOption[] = [
  { value: 'mathematics', label: 'Mathematics', icon: '\u{1F522}', color: '56, 189, 248' },
  { value: 'science', label: 'Science', icon: '\u{1F52C}', color: '74, 222, 128' },
  { value: 'language-arts', label: 'Language Arts', icon: '\u{1F4D6}', color: '168, 85, 247' },
  { value: 'reading', label: 'Reading', icon: '\u{1F4DA}', color: '244, 114, 182' },
];

function PulseWelcome({
  subject,
  onSelectSubject,
  onStart,
}: {
  subject: string | null;
  onSelectSubject: (s: string | null) => void;
  onStart: (subject: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-fade-in">
      <SpotlightCard
        color="139, 92, 246"
        className="bg-gradient-to-br from-violet-900/20 to-blue-900/20 max-w-lg w-full"
      >
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

          {/* Subject picker (shown when no subject pre-selected) */}
          {!subject && (
            <div className="space-y-3">
              <h4 className="text-[10px] uppercase tracking-widest font-mono text-slate-500">
                Pick a subject
              </h4>
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

          {/* Selected subject indicator */}
          {subject && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">
                {PULSE_SUBJECTS.find((s) => s.value === subject)?.icon || '\u{1F4DD}'}
              </span>
              <span className="text-slate-200 font-medium">
                {PULSE_SUBJECTS.find((s) => s.value === subject)?.label || subject}
              </span>
              <button
                onClick={() => onSelectSubject(null)}
                className="text-xs text-slate-500 hover:text-slate-300 ml-1"
              >
                change
              </button>
            </div>
          )}

          {/* Band preview */}
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
// Leapfrog celebration sub-component (enhanced with framer-motion)
// ---------------------------------------------------------------------------

function PulseLeapfrog({ leapfrog }: { leapfrog?: LeapfrogEvent }) {
  if (!leapfrog) return null;

  const scorePercent = Math.round(leapfrog.aggregate_score * 10);
  const circumference = 2 * Math.PI * 28; // radius 28
  const strokeOffset = circumference - (circumference * scorePercent) / 100;

  return (
    <div className="flex items-center justify-center py-12">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="max-w-md w-full"
      >
        <Card className="backdrop-blur-xl bg-violet-900/20 border-violet-500/20 relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[100px] opacity-30 bg-gradient-to-br from-violet-500 to-amber-500" />

          <CardContent className="p-8 flex flex-col items-center text-center space-y-6 relative z-10">
            {/* Icon + score ring */}
            <div className="relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500/30 to-amber-500/30 border border-violet-500/20 flex items-center justify-center"
              >
                <span className="text-5xl">&#128640;</span>
              </motion.div>
              {/* Score ring */}
              <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" viewBox="0 0 64 64">
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="2.5"
                />
                <motion.circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="url(#scoreGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: strokeOffset }}
                  transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                  transform="rotate(-90 32 32)"
                />
                <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Title */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-amber-300">
                Leapfrog!
              </h2>
              <p className="text-slate-400 text-sm">
                Score: {scorePercent}%
              </p>
            </motion.div>

            {/* Probed skills */}
            {leapfrog.probed_skills.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="w-full space-y-2"
              >
                <h4 className="text-[10px] uppercase tracking-widest font-mono text-emerald-400 flex items-center gap-2 justify-center">
                  <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                  You proved you know
                </h4>
                <div className="flex flex-wrap gap-2 justify-center">
                  {leapfrog.probed_skills.map((skillId, i) => (
                    <motion.span
                      key={skillId}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.5 + i * 0.08, type: 'spring', stiffness: 400, damping: 20 }}
                      className="glass-panel text-xs px-3 py-1.5 rounded-full border border-emerald-500/20 text-emerald-300 font-mono"
                    >
                      {formatSkillId(skillId)}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Inferred skills */}
            {leapfrog.inferred_skills.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="w-full space-y-2"
              >
                <h4 className="text-[10px] uppercase tracking-widest font-mono text-violet-400 flex items-center gap-2 justify-center">
                  <span className="w-1 h-3 bg-violet-500 rounded-full" />
                  So we unlocked
                </h4>
                <AnimatePresence>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {leapfrog.inferred_skills.map((skillId, i) => (
                      <motion.span
                        key={skillId}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.8 + i * 0.1, type: 'spring', stiffness: 400, damping: 20 }}
                        className="glass-panel text-xs px-3 py-1.5 rounded-full border border-violet-500/20 text-violet-300 font-mono"
                      >
                        {formatSkillId(skillId)}
                      </motion.span>
                    ))}
                  </div>
                </AnimatePresence>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/** Shorten skill IDs for display: "math.addition.basic" → "addition.basic" */
function formatSkillId(id: string): string {
  const parts = id.split('.');
  if (parts.length > 2) return parts.slice(1).join('.');
  return id;
}

// ---------------------------------------------------------------------------
// Theta growth helpers
// ---------------------------------------------------------------------------

/** Map theta to a Tailwind color class for the mode tier */
function thetaColor(theta: number): string {
  if (theta < 2.0) return '#34d399';   // emerald-400
  if (theta < 3.0) return '#2dd4bf';   // teal-400
  if (theta < 4.5) return '#38bdf8';   // sky-400
  if (theta < 6.0) return '#60a5fa';   // blue-400
  if (theta < 7.5) return '#a78bfa';   // violet-400
  return '#fb7185';                     // rose-400
}

/** Deduplicate theta changes by skill, keeping last entry */
function deduplicateThetaChanges(changes: ThetaUpdate[]): ThetaUpdate[] {
  const map = new Map<string, ThetaUpdate>();
  for (const c of changes) {
    map.set(c.skill_id, c);
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Theta Growth Section (in summary)
// ---------------------------------------------------------------------------

function ThetaGrowthSection({ thetaChanges }: { thetaChanges: ThetaUpdate[] }) {
  const unique = deduplicateThetaChanges(thetaChanges);
  if (unique.length === 0) return null;

  // For fewer skills, show horizontal bars. For many, show a line chart.
  const useChart = unique.length >= 4;

  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-[10px] uppercase tracking-widest font-mono text-blue-400 flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Ability Growth
      </h4>

      {useChart ? (
        <ThetaLineChart changes={unique} />
      ) : (
        <ThetaBarList changes={unique} />
      )}
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
              <span className="text-xs text-slate-300 font-mono truncate max-w-[60%]">
                {formatSkillId(c.skill_id)}
              </span>
              <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}{delta.toFixed(1)}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
              {/* Old theta (dimmed) */}
              <div
                className="absolute inset-y-0 left-0 rounded-full opacity-30"
                style={{
                  width: `${oldPct}%`,
                  backgroundColor: thetaColor(c.old_theta),
                }}
              />
              {/* New theta */}
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
  // Build data points: each skill has before & after
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
          <XAxis
            dataKey="skill"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={45}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            width={28}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey="before"
            stroke="#64748b"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ fill: '#64748b', strokeWidth: 0, r: 3 }}
            name="Before"
          />
          <Line
            type="monotone"
            dataKey="after"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
            activeDot={{ fill: '#60a5fa', r: 5 }}
            name="After"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="w-3 h-0.5 bg-slate-500 rounded inline-block" style={{ borderTop: '1px dashed' }} />
          Before
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-blue-400">
          <span className="w-3 h-0.5 bg-blue-400 rounded inline-block" />
          After
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frontier Delta Section (in summary)
// ---------------------------------------------------------------------------

function FrontierDeltaSection({
  summary,
  leapfrogs,
}: {
  summary: PulseSessionSummary;
  leapfrogs: LeapfrogEvent[];
}) {
  const gateAdvances = summary.skills_advanced.length;
  const leapfrogSkills = leapfrogs.reduce((sum, lf) => sum + lf.inferred_skills.length, 0);
  const totalUnlocked = gateAdvances + leapfrogSkills;

  if (totalUnlocked === 0 && !summary.frontier_expanded) return null;

  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-[10px] uppercase tracking-widest font-mono text-violet-400 flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        Knowledge Map
      </h4>

      <div className="glass-panel rounded-xl border border-white/10 p-5 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[80px] opacity-15 bg-gradient-to-br from-violet-500 to-blue-500" />

        <div className="relative z-10 space-y-4">
          {/* Unlocked count */}
          {totalUnlocked > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex items-center justify-center"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/20 to-blue-500/20 border border-violet-500/30">
                <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-blue-300">
                  +{totalUnlocked}
                </span>
                <span className="text-sm text-slate-300">
                  {totalUnlocked === 1 ? 'skill' : 'skills'} unlocked
                </span>
              </span>
            </motion.div>
          )}

          {/* Breakdown */}
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

          {/* Frontier expanded message */}
          {summary.frontier_expanded && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center text-sm text-violet-300 font-light"
            >
              Your frontier expanded — new skills are now reachable!
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary sub-component
// ---------------------------------------------------------------------------

function PulseSummaryCard({
  summary,
  leapfrogs,
  isColdStart,
  onDone,
  onPlayAgain,
}: {
  summary: PulseSessionSummary | null;
  leapfrogs: LeapfrogEvent[];
  isColdStart: boolean;
  onDone: () => void;
  onPlayAgain: () => void;
}) {
  return (
    <div className="animate-fade-in max-w-lg mx-auto space-y-6">
      <SpotlightCard
        color="139, 92, 246"
        className="bg-gradient-to-br from-violet-900/20 to-blue-900/20"
      >
        <div className="p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-violet-500/20 flex items-center justify-center mx-auto">
            <span className="text-4xl">&#127881;</span>
          </div>

          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-100 to-slate-300">
            {summary?.celebration_message || 'Great work!'}
          </h2>

          {isColdStart && (
            <p className="text-slate-400">
              We&apos;ve mapped your starting point. Future sessions will build from here!
            </p>
          )}

          {/* Stats grid */}
          {summary && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="glass-panel rounded-xl border border-white/10 p-4">
                <div className="text-2xl font-bold text-white">{summary.items_completed}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Completed</div>
              </div>
              <div className="glass-panel rounded-xl border border-white/10 p-4">
                <div className="text-2xl font-bold text-white">
                  {summary.duration_ms > 0
                    ? `${Math.round(summary.duration_ms / 60000)}m`
                    : '--'
                  }
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Duration</div>
              </div>
            </div>
          )}

          {/* Band breakdown */}
          {summary && Object.keys(summary.bands).length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-[10px] uppercase tracking-widest font-mono text-slate-500">
                Session breakdown
              </h4>
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

          {/* Leapfrogs */}
          {leapfrogs.length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-[10px] uppercase tracking-widest font-mono text-violet-400">
                Leapfrogs
              </h4>
              {leapfrogs.map((lf, i) => (
                <div key={i} className="glass-panel rounded-lg border border-violet-500/20 px-4 py-2 text-left">
                  <div className="text-sm text-violet-300">
                    &#128640; Skipped {lf.inferred_skills.length} {lf.inferred_skills.length === 1 ? 'skill' : 'skills'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Score: {Math.round(lf.aggregate_score * 10)}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Skills advanced */}
          {summary && summary.skills_advanced.length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-[10px] uppercase tracking-widest font-mono text-emerald-400">
                Skills Advanced
              </h4>
              <p className="text-slate-400 text-sm">
                {summary.skills_advanced.length} {summary.skills_advanced.length === 1 ? 'skill' : 'skills'} leveled up this session
              </p>
            </div>
          )}

          {/* Theta Growth */}
          {summary && summary.theta_changes.length > 0 && (
            <ThetaGrowthSection thetaChanges={summary.theta_changes} />
          )}

          {/* Frontier Delta */}
          {summary && (
            <FrontierDeltaSection summary={summary} leapfrogs={leapfrogs} />
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-center mt-6">
            <Button
              onClick={onPlayAgain}
              className="bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white px-6 py-3 rounded-xl"
            >
              Play Again
            </Button>
            <Button
              variant="ghost"
              onClick={onDone}
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            >
              Done
            </Button>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}
