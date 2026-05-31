'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '../components/SpotlightCard';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { PracticeManifestRenderer } from '../components/PracticeManifestRenderer';
import type { GradeLevel } from '../components/GradeLevelSelector';
import type { PracticeItemResult } from '../types';
import { useAdaptiveSession } from './adaptiveEngine/useAdaptiveSession';
import { ADAPTIVE } from './adaptiveEngine/constants';
import { AdaptiveTransition } from './AdaptiveTransition';
import { AdaptiveSessionSummary } from './AdaptiveSessionSummary';
import { AdaptiveDebugPanel } from './AdaptiveDebugPanel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUBJECTS = [
  { value: 'mathematics', label: 'Mathematics', icon: '\u{1F522}', color: '56, 189, 248' },
  { value: 'engineering', label: 'Engineering', icon: '\u{2699}\uFE0F', color: '251, 146, 60' },
  { value: 'physics', label: 'Physics', icon: '\u{269B}\uFE0F', color: '129, 140, 248' },
  { value: 'chemistry', label: 'Chemistry', icon: '\u{1F9EA}', color: '52, 211, 153' },
  { value: 'biology', label: 'Biology', icon: '\u{1F9EC}', color: '74, 222, 128' },
  { value: 'astronomy', label: 'Astronomy', icon: '\u{1F52D}', color: '192, 132, 252' },
  { value: 'language-arts', label: 'Language Arts', icon: '\u{1F4D6}', color: '168, 85, 247' },
  { value: 'reading', label: 'Reading', icon: '\u{1F4DA}', color: '244, 114, 182' },
];

/** kebab/snake id → Title Case, e.g. "spatial-scene" → "Spatial Scene". */
function prettify(id: string): string {
  return id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Tailwind chip classes for a difficulty label. */
function difficultyChip(d: string): string {
  const v = d.toLowerCase();
  if (v.includes('easy') || v.includes('low'))
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (v.includes('hard') || v.includes('high'))
    return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  return 'bg-amber-500/15 text-amber-300 border-amber-500/30'; // medium / default
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PulseAdaptiveSessionProps {
  onBack: () => void;
  initialSubject?: string;
  /** Pre-filled practice topic carried over from the home screen. */
  initialTopic?: string;
  /** When true (with a topic/subject present), skip the setup screen and
   *  start the session immediately. Used by the home-screen Practice slider. */
  autoStart?: boolean;
  gradeLevel?: GradeLevel;
  debugMode?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PulseAdaptiveSession: React.FC<PulseAdaptiveSessionProps> = ({
  onBack,
  initialSubject,
  initialTopic,
  autoStart = false,
  gradeLevel: initialGrade = 'elementary',
  debugMode = false,
}) => {
  const session = useAdaptiveSession();

  // Setup state (local to this component, not in the hook)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(initialSubject ?? null);
  const [topicInput, setTopicInput] = useState('');
  const [showDebug, setShowDebug] = useState(debugMode);

  // Auto-start: when launched from the home-screen Practice slider, the student
  // has already typed their topic — skip the subject grid and dive straight in.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    const topic = (initialTopic ?? '').trim() || initialSubject || '';
    if (!topic) return;
    autoStartedRef.current = true;
    session.startSession(topic, initialGrade, initialSubject ?? '');
  }, [autoStart, initialTopic, initialSubject, initialGrade, session]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleStart = useCallback(() => {
    if (!selectedSubject) return;
    const topic = topicInput.trim() || selectedSubject;
    session.startSession(topic, initialGrade, selectedSubject);
  }, [selectedSubject, topicInput, initialGrade, session]);

  const handleItemComplete = useCallback(
    (result: PracticeItemResult) => {
      session.handleItemComplete(result);
    },
    [session],
  );

  const handleDone = useCallback(() => {
    session.reset();
    onBack();
  }, [session, onBack]);

  const handleRestart = useCallback(() => {
    session.reset();
  }, [session]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <LuminaAIProvider>
      <div className="relative min-h-[60vh]">
        {/* Back button */}
        {session.phase === 'setup' && (
          <button
            onClick={onBack}
            className="text-sm text-slate-500 hover:text-slate-300 mb-4 flex items-center gap-1 transition-colors"
          >
            &larr; Back
          </button>
        )}

        {/* ============================================================= */}
        {/* SETUP PHASE                                                    */}
        {/* ============================================================= */}
        {session.phase === 'setup' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-fade-in">
            <SpotlightCard
              color="139, 92, 246"
              className="bg-gradient-to-br from-violet-900/20 to-cyan-900/20 max-w-2xl w-full"
            >
              <div className="p-8 text-center space-y-6">
                {/* Header */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 border border-violet-500/20 flex items-center justify-center mx-auto">
                  <span className="text-4xl">{'\u26A1'}</span>
                </div>
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-100 to-slate-300">
                  Lumina Pulse
                </h2>
                <p className="text-slate-400 leading-relaxed">
                  Adaptive practice that responds to you in real-time.
                  The challenges get smarter with every answer.
                </p>

                {/* Subject picker */}
                {!selectedSubject && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase tracking-widest font-mono text-slate-500">
                      Pick a subject
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {SUBJECTS.map((s) => (
                        <SpotlightCard
                          key={s.value}
                          color={s.color}
                          onClick={() => setSelectedSubject(s.value)}
                          className="bg-slate-900/40"
                        >
                          <div className="p-4 flex flex-col items-center text-center gap-2">
                            <span className="text-3xl">{s.icon}</span>
                            <span className="text-sm font-medium text-slate-200 group-hover:text-blue-200 transition-colors">{s.label}</span>
                          </div>
                        </SpotlightCard>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected subject + topic input */}
                {selectedSubject && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg">
                        {SUBJECTS.find((s) => s.value === selectedSubject)?.icon || '\u{1F4DD}'}
                      </span>
                      <span className="text-slate-200 font-medium">
                        {SUBJECTS.find((s) => s.value === selectedSubject)?.label || selectedSubject}
                      </span>
                      <button
                        onClick={() => setSelectedSubject(null)}
                        className="text-xs text-slate-500 hover:text-slate-300 ml-1"
                      >
                        change
                      </button>
                    </div>

                    {/* Optional topic refinement */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-mono text-slate-500 block">
                        Focus on (optional)
                      </label>
                      <input
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        placeholder="e.g., adding fractions, place value, telling time..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none transition-colors"
                        onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                      />
                    </div>

                    <Button
                      onClick={handleStart}
                      className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white px-10 py-4 text-lg rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-400/30 hover:scale-[1.02]"
                    >
                      Start Pulse
                    </Button>
                  </div>
                )}
              </div>
            </SpotlightCard>
            <p className="text-xs text-slate-600 max-w-sm text-center">
              3-10 adaptive items. The session adjusts difficulty, switches visuals when
              you&apos;re stuck, and stops early when you&apos;ve mastered it.
            </p>
          </div>
        )}

        {/* ============================================================= */}
        {/* LOADING PHASE                                                  */}
        {/* ============================================================= */}
        {session.phase === 'loading' && (
          <div className="animate-fade-in">
            <div className="flex flex-col items-center justify-center py-16 space-y-8 max-w-xl mx-auto">
              {/* Bolt cradled in glowing dual rings */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                <div
                  className="absolute inset-0 rounded-full border-t-2 border-violet-500 animate-spin shadow-[0_0_30px_rgba(139,92,246,0.45)]"
                  style={{ animationDuration: '2.2s' }}
                />
                <div
                  className="absolute inset-3 rounded-full border-t-2 border-cyan-400 animate-spin shadow-[0_0_24px_rgba(34,211,238,0.4)]"
                  style={{ animationDirection: 'reverse', animationDuration: '1.6s' }}
                />
                <motion.div
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 border border-violet-500/20 flex items-center justify-center"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-2xl">{'\u26A1'}</span>
                </motion.div>
              </div>

              {/* Heading + grade pill */}
              <div className="space-y-3 text-center">
                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-100 to-cyan-200 animate-pulse">
                  {session.streamingMessage ||
                    (session.topic
                      ? `Building practice on ${session.topic}`
                      : 'Preparing your session')}
                </h3>
                <div className="inline-flex px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <span className="text-xs text-slate-400">
                    Tailoring for:{' '}
                    <span className="text-violet-300 font-medium capitalize">
                      {initialGrade.replace('-', ' ')}
                    </span>
                  </span>
                </div>
              </div>

              {/* Planner metadata once the manifest streams in \u2014 shimmer until then */}
              <div className="w-full rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 text-left">
                {session.manifestPreview.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-violet-300/80">
                        Planned practice
                      </span>
                      <span className="text-[10px] font-mono text-slate-600">
                        {session.manifestPreview.length} item
                        {session.manifestPreview.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {session.sessionBrief?.hook && (
                      <p className="text-sm italic leading-relaxed text-slate-400">
                        {session.sessionBrief.hook}
                      </p>
                    )}

                    <div className="space-y-2">
                      {session.manifestPreview.map((p, i) => (
                        <motion.div
                          key={p.instanceId}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                        >
                          <span className="mt-0.5 text-xs font-mono text-slate-600">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-200 line-clamp-2">
                              {p.problemText ||
                                (p.isVisual ? 'Interactive challenge' : 'Practice problem')}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                                  p.isVisual
                                    ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                                    : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                }`}
                              >
                                {p.kind ? prettify(p.kind) : p.isVisual ? 'Interactive' : 'Text'}
                              </span>
                              {p.bloomLevel && (
                                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 text-[10px] capitalize text-indigo-300">
                                  {p.bloomLevel}
                                </span>
                              )}
                              {p.difficulty && (
                                <span
                                  className={`rounded-full border px-1.5 py-0.5 text-[10px] capitalize ${difficultyChip(p.difficulty)}`}
                                >
                                  {p.difficulty}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="h-5 w-2/3 rounded-md bg-white/10 animate-pulse" />
                    <div
                      className="h-3 w-1/2 rounded bg-white/5 animate-pulse"
                      style={{ animationDelay: '120ms' }}
                    />
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-16 rounded-xl bg-white/5 border border-white/10 animate-pulse"
                          style={{ animationDelay: `${150 + i * 120}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* PRACTICING PHASE                                               */}
        {/* ============================================================= */}
        {session.phase === 'practicing' && session.currentItem && (
          <div className="animate-fade-in">
            {/* \u2500\u2500 Header: exit \u00B7 topic identity \u00B7 (dev) \u2500\u2500 */}
            <div className="max-w-5xl mx-auto mb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <button
                  onClick={onBack}
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                >
                  &larr; Exit
                </button>

                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{'\u26A1'}</span>
                  <span className="text-sm font-medium text-slate-300 truncate capitalize">
                    {session.topic}
                  </span>
                </div>

                {/* Debug toggle \u2014 dev only */}
                {debugMode ? (
                  <button
                    onClick={() => setShowDebug((d) => !d)}
                    className="text-xs text-slate-700 hover:text-slate-500 transition-colors"
                    title="Toggle debug panel"
                  >
                    {showDebug ? '\u{1F41E}' : '\u00B7'}
                  </button>
                ) : (
                  <span className="w-8" aria-hidden />
                )}
              </div>

              {/* Pip progress \u2014 honest about adaptive length (grows from min) */}
              <div className="flex items-center justify-center gap-2">
                {Array.from({
                  length: Math.min(
                    ADAPTIVE.MAX_ITEMS,
                    Math.max(ADAPTIVE.MIN_ITEMS, session.itemIndex + 1),
                  ),
                }).map((_, i) => {
                  const done = i < session.itemIndex;
                  const active = i === session.itemIndex;
                  return (
                    <motion.span
                      key={i}
                      className={`h-2 rounded-full ${
                        active
                          ? 'w-6 bg-gradient-to-r from-violet-400 to-cyan-400'
                          : done
                            ? 'w-2 bg-violet-400/70'
                            : 'w-2 bg-white/10'
                      }`}
                      animate={active ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
                      transition={
                        active ? { duration: 1.6, repeat: Infinity } : { duration: 0.3 }
                      }
                    />
                  );
                })}
              </div>
            </div>

            {/* The primitive */}
            <PracticeManifestRenderer
              key={session.currentItem.manifestItem.instanceId}
              item={session.currentItem}
              itemIndex={session.itemIndex}
              onItemComplete={handleItemComplete}
            />

            {/* Skip \u2014 clearly secondary */}
            <div className="max-w-5xl mx-auto flex justify-center mt-6">
              <button
                onClick={session.skipItem}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors underline-offset-4 hover:underline"
              >
                Skip this one
              </button>
            </div>

            {/* Loading overlay for when we're waiting on hydration mid-session */}
            {session.isHydrating && session.streamingMessage && (
              <div className="mt-4 text-center">
                <p className="text-slate-500 text-sm animate-pulse">
                  {session.streamingMessage}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* TRANSITION PHASE                                               */}
        {/* ============================================================= */}
        {session.phase === 'transitioning' && session.transitionType && (
          <AdaptiveTransition
            type={session.transitionType}
            onComplete={session.handleTransitionEnd}
          />
        )}

        {/* ============================================================= */}
        {/* EXTENDING PHASE                                                */}
        {/* ============================================================= */}
        {session.phase === 'extending' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-fade-in">
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 max-w-md">
              <CardContent className="p-8 text-center space-y-6">
                <motion.div
                  className="text-5xl"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {'\u{1F525}'}
                </motion.div>
                <h2 className="text-xl font-bold text-slate-100">
                  You&apos;re on fire!
                </h2>
                <p className="text-slate-400">
                  Want to keep going? I&apos;ll generate a couple more challenges.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={session.declineExtension}
                    variant="ghost"
                    className="flex-1 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                  >
                    I&apos;m done
                  </Button>
                  <Button
                    onClick={session.acceptExtension}
                    variant="ghost"
                    className="flex-1 bg-cyan-500/20 border border-cyan-400/30 hover:bg-cyan-500/30 text-cyan-300"
                  >
                    Keep going!
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============================================================= */}
        {/* SUMMARY PHASE                                                  */}
        {/* ============================================================= */}
        {session.phase === 'summary' && (
          <div className="py-8 animate-fade-in">
            <AdaptiveSessionSummary
              results={session.results}
              decisions={session.decisions}
              sessionStartedAt={session.sessionStartedAt}
              topic={session.topic}
              onDone={handleDone}
              showExtension={session.decisions.some((d) => d.action === 'early-exit')}
              onKeepGoing={session.acceptExtension}
            />
          </div>
        )}

        {/* ============================================================= */}
        {/* ERROR PHASE                                                    */}
        {/* ============================================================= */}
        {session.phase === 'error' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 animate-fade-in">
            <Card className="backdrop-blur-xl bg-red-900/20 border-red-500/20 max-w-md">
              <CardContent className="p-6 text-center space-y-4">
                <span className="text-4xl block">{'\u{26A0}\uFE0F'}</span>
                <p className="text-slate-300">{session.error || 'Something went wrong'}</p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={handleRestart}
                    variant="ghost"
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                  >
                    Try again
                  </Button>
                  <Button
                    onClick={onBack}
                    variant="ghost"
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
                  >
                    Go back
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============================================================= */}
        {/* DEBUG PANEL                                                    */}
        {/* ============================================================= */}
        {showDebug && session.phase !== 'setup' && (
          <AdaptiveDebugPanel
            results={session.results}
            decisions={session.decisions}
            latencyLog={session.latencyLog}
            currentScaffoldingMode={session.currentScaffoldingMode}
            workedExamplesInserted={session.workedExamplesInserted}
            isHydrating={session.isHydrating}
            sessionHistory={session.getSessionHistory()}
            prefetchedCount={session.prefetchedCount}
            onRestart={handleRestart}
          />
        )}
      </div>
    </LuminaAIProvider>
  );
};

export default PulseAdaptiveSession;
