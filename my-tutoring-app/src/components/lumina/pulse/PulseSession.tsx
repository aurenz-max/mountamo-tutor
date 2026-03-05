'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '../components/SpotlightCard';
import { EvaluationProvider } from '../evaluation';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { PracticeManifestRenderer } from '../components/PracticeManifestRenderer';
import { usePulseSession } from './usePulseSession';
import type { GradeLevel } from '../components/GradeLevelSelector';
import type { PulseSessionSummary, LeapfrogEvent, PulseBand } from './types';
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
    isColdStart,
    error,
    streamingMessage,
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
              <PulseWelcome
                subject={selectedSubject}
                onSelectSubject={setSelectedSubject}
                onStart={(subj: string) => { session.startSession(subj); }}
              />
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
                {/* Band indicator */}
                <div className="mb-4 flex items-center justify-center">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono uppercase tracking-wider ${BAND_BG_COLORS[currentItem.band]} ${BAND_COLORS[currentItem.band]}`}>
                    <BandIcon band={currentItem.band} />
                    {BAND_LABELS[currentItem.band]}
                  </span>
                </div>

                {/* Activity renderer */}
                <PracticeManifestRenderer
                  item={hydratedItem}
                  itemIndex={currentItemIndex}
                  onItemComplete={(result) => {
                    session.handleItemComplete(result);
                    // Show Next button after completion
                  }}
                />

                {/* Next button — always visible, triggers submission */}
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
// Leapfrog celebration sub-component
// ---------------------------------------------------------------------------

function PulseLeapfrog({ leapfrog }: { leapfrog?: LeapfrogEvent }) {
  if (!leapfrog) return null;

  return (
    <div className="flex items-center justify-center py-16 animate-fade-in">
      <Card className="backdrop-blur-xl bg-violet-900/20 border-violet-500/20 max-w-md w-full">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-amber-500/30 border border-violet-500/20 flex items-center justify-center">
              <span className="text-4xl">&#128640;</span>
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-amber-400/40 animate-ping" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-amber-300">
              Leapfrog!
            </h2>
            <p className="text-slate-300 text-lg">
              You just skipped ahead! Your strong performance unlocked
              {leapfrog.inferred_skills.length > 0
                ? ` ${leapfrog.inferred_skills.length} additional ${leapfrog.inferred_skills.length === 1 ? 'skill' : 'skills'}`
                : ' new skills'
              }.
            </p>
            <p className="text-slate-500 text-sm">
              Score: {Math.round(leapfrog.aggregate_score * 10)}%
            </p>
          </div>
        </CardContent>
      </Card>
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
