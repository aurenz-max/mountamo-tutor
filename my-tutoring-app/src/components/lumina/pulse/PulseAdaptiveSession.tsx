'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '../components/SpotlightCard';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { PracticeManifestRenderer } from '../components/PracticeManifestRenderer';
import type { GradeLevel } from '../components/GradeLevelSelector';
import type { PracticeItemResult } from '../types';
import { useAdaptiveSession } from './adaptiveEngine/useAdaptiveSession';
import { AdaptiveTransition } from './AdaptiveTransition';
import { AdaptiveSessionSummary } from './AdaptiveSessionSummary';
import { AdaptiveDebugPanel } from './AdaptiveDebugPanel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUBJECTS = [
  { value: 'mathematics', label: 'Mathematics', icon: '\u{1F522}', color: '56, 189, 248' },
  { value: 'science', label: 'Science', icon: '\u{1F52C}', color: '74, 222, 128' },
  { value: 'language-arts', label: 'Language Arts', icon: '\u{1F4D6}', color: '168, 85, 247' },
  { value: 'reading', label: 'Reading', icon: '\u{1F4DA}', color: '244, 114, 182' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PulseAdaptiveSessionProps {
  onBack: () => void;
  initialSubject?: string;
  gradeLevel?: GradeLevel;
  debugMode?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PulseAdaptiveSession: React.FC<PulseAdaptiveSessionProps> = ({
  onBack,
  initialSubject,
  gradeLevel: initialGrade = 'elementary',
  debugMode = false,
}) => {
  const session = useAdaptiveSession();

  // Setup state (local to this component, not in the hook)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(initialSubject ?? null);
  const [topicInput, setTopicInput] = useState('');
  const [showDebug, setShowDebug] = useState(debugMode);

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
              className="bg-gradient-to-br from-violet-900/20 to-cyan-900/20 max-w-lg w-full"
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
                    <div className="grid grid-cols-2 gap-3">
                      {SUBJECTS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setSelectedSubject(s.value)}
                          className="glass-panel rounded-xl border border-white/10 p-4 text-center hover:border-white/25 transition-all hover:scale-[1.02] cursor-pointer"
                        >
                          <span className="text-2xl block mb-1">{s.icon}</span>
                          <span className="text-sm text-slate-200">{s.label}</span>
                        </button>
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
            {/* Show progress bar if mid-session (not initial load) */}
            {session.itemIndex > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">&larr;</button>
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full"
                    animate={{ width: `${Math.min(100, ((session.itemIndex + 1) / 10) * 100)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-slate-600 font-mono">{session.itemIndex + 1}</span>
              </div>
            )}
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
              <motion.div
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 border border-violet-500/20 flex items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-3xl">{'\u26A1'}</span>
              </motion.div>
              <p className="text-slate-400 text-sm animate-pulse">
                {session.streamingMessage || 'Preparing your session...'}
              </p>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* PRACTICING PHASE                                               */}
        {/* ============================================================= */}
        {session.phase === 'practicing' && session.currentItem && (
          <div className="animate-fade-in">
            {/* Progress indicator */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={onBack}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                &larr;
              </button>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full"
                  animate={{
                    width: `${Math.min(100, ((session.itemIndex + 1) / 10) * 100)}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-xs text-slate-600 font-mono">
                {session.itemIndex + 1}
              </span>
              {/* Hidden debug toggle: triple-click header area */}
              <button
                onClick={() => setShowDebug((d) => !d)}
                className="text-xs text-slate-700 hover:text-slate-500 transition-colors"
                title="Toggle debug panel"
              >
                {showDebug ? '\u{1F41E}' : '\u00B7'}
              </button>
            </div>

            {/* The primitive */}
            <PracticeManifestRenderer
              key={session.currentItem.manifestItem.instanceId}
              item={session.currentItem}
              itemIndex={session.itemIndex}
              onItemComplete={handleItemComplete}
            />

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
