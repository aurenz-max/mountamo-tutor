'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '../components/SpotlightCard';
import { EvaluationProvider } from '../evaluation';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { ProbeActivity } from './ProbeActivity';
import { DiagnosticProfileCard } from './DiagnosticProfileCard';
import { useDiagnosticSession } from './useDiagnosticSession';
import type { GradeLevel } from '../components/GradeLevelSelector';
import type { KnowledgeProfileResponse } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiagnosticSessionProps {
  onBack: () => void;
  subjects?: string[];
  gradeLevel?: GradeLevel;
  onComplete?: (profile: KnowledgeProfileResponse) => void;
}

// ---------------------------------------------------------------------------
// Encouraging transition messages (cycled between probes)
// ---------------------------------------------------------------------------

const TRANSITION_MESSAGES = [
  "Nice work! Let's keep exploring!",
  "You're doing great! Ready for more?",
  "Awesome! Let's try another area!",
  'Way to go! Moving along nicely!',
  "Fantastic! Let's discover more!",
  "You're a natural! Next up...",
];

function getTransitionMessage(index: number): string {
  return TRANSITION_MESSAGES[index % TRANSITION_MESSAGES.length];
}

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: 'math',
  math: 'math',
  science: 'science',
  'language-arts': 'language arts',
  'language arts': 'language arts',
  reading: 'reading',
  writing: 'writing',
  'social-studies': 'social studies',
  'social studies': 'social studies',
};

const SUBJECT_ICONS: Record<string, string> = {
  mathematics: '🔢',
  math: '🔢',
  science: '🔬',
  'language-arts': '📖',
  'language arts': '📖',
  reading: '📚',
  writing: '✍️',
  'social-studies': '🌍',
  'social studies': '🌍',
};

const SUBJECT_COLORS: Record<string, string> = {
  mathematics: 'from-cyan-500/30 to-blue-500/30',
  math: 'from-cyan-500/30 to-blue-500/30',
  science: 'from-green-500/30 to-emerald-500/30',
  'language-arts': 'from-purple-500/30 to-violet-500/30',
  'language arts': 'from-purple-500/30 to-violet-500/30',
  reading: 'from-rose-500/30 to-pink-500/30',
  writing: 'from-violet-500/30 to-indigo-500/30',
  'social-studies': 'from-amber-500/30 to-yellow-500/30',
  'social studies': 'from-amber-500/30 to-yellow-500/30',
};

/** RGB spotlight colors for SpotlightCard per subject */
const SUBJECT_SPOTLIGHT: Record<string, string> = {
  mathematics: '34, 211, 238',
  math: '34, 211, 238',
  science: '74, 222, 128',
  'language-arts': '168, 85, 247',
  'language arts': '168, 85, 247',
  reading: '244, 114, 182',
  writing: '139, 92, 246',
  'social-studies': '250, 204, 21',
  'social studies': '250, 204, 21',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DiagnosticSession: React.FC<DiagnosticSessionProps> = ({
  onBack,
  subjects,
  gradeLevel = 'elementary',
  onComplete,
}) => {
  // Session key to reset EvaluationProvider between probes
  const [evalSessionKey, setEvalSessionKey] = useState(0);

  const session = useDiagnosticSession({ subjects, gradeLevel });

  const {
    phase,
    currentProbe,
    hydratedItems,
    currentItemIndex,
    progress,
    knowledgeProfile,
    completionResponse,
    error,
    streamingMessage,
    hasResumableSession,
  } = session;

  // Bump eval key when phase transitions to probing (new probe)
  const prevPhaseRef = React.useRef(phase);
  React.useEffect(() => {
    if (phase === 'probing' && prevPhaseRef.current !== 'probing') {
      setEvalSessionKey((k) => k + 1);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  return (
    <LuminaAIProvider>
      <EvaluationProvider
        key={evalSessionKey}
        localOnly
        curriculumSubject={currentProbe?.subject}
        curriculumSkillId={currentProbe?.skill_id}
        curriculumSubskillId={currentProbe?.subskill_id}
      >
        <div className="min-h-screen">
          {/* Header bar */}
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
              <h1 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-400">
                Skills Explorer
              </h1>
              <div className="w-20" /> {/* spacer to balance the button */}
            </div>

            {/* Progress bar (shown during active probing) */}
            {(phase === 'probing' ||
              phase === 'probe-intro' ||
              phase === 'transition' ||
              phase === 'generating') &&
              progress.totalCount > 0 && (
                <div className="mt-4 max-w-md mx-auto">
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, progress.coveragePct)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {phase === 'probing' && hydratedItems.length > 0
                      ? `Set ${progress.probesCompleted + 1} · Activity ${currentItemIndex + 1} of ${hydratedItems.length}`
                      : progress.probesCompleted === 0
                        ? 'Getting started...'
                        : `${progress.probesCompleted} ${progress.probesCompleted === 1 ? 'set' : 'sets'} completed`
                    }
                  </p>
                </div>
              )}
          </div>

          <div className="max-w-5xl mx-auto px-4 pb-12">
            {/* ---- WELCOME PHASE ---- */}
            {phase === 'welcome' && (
              <WelcomeScreen
                hasResume={hasResumableSession}
                onStart={session.startSession}
                onResume={session.resumeSession}
                onDismissResume={session.dismissResume}
              />
            )}

            {/* ---- GENERATING PHASE ---- */}
            {phase === 'generating' && (
              <div className="flex items-center justify-center py-16 animate-fade-in">
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 max-w-md w-full">
                  <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-cyan-500/20 flex items-center justify-center">
                        <span className="text-3xl">🔍</span>
                      </div>
                      {/* Pulsing ring */}
                      <div className="absolute inset-0 rounded-2xl border-2 border-cyan-400/40 animate-ping" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-slate-200 text-lg font-medium">
                        {streamingMessage || 'Preparing activities...'}
                      </p>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                          style={{ animationDelay: '0.15s' }}
                        />
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                          style={{ animationDelay: '0.3s' }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ---- PROBE INTRO PHASE ---- */}
            {phase === 'probe-intro' && currentProbe && (
              <ProbeIntroCard
                probe={currentProbe}
                hydratedItems={hydratedItems}
                probesCompleted={progress.probesCompleted}
                onStart={session.confirmProbeStart}
              />
            )}

            {/* ---- PROBING PHASE ---- */}
            {phase === 'probing' && currentProbe && hydratedItems.length > 0 && (
              <div className="animate-fade-in">
                <ProbeActivity
                  probe={currentProbe}
                  hydratedItems={hydratedItems}
                  currentItemIndex={currentItemIndex}
                  onItemComplete={session.handleItemComplete}
                  onNext={session.handleNextItem}
                  totalActivitiesDone={
                    progress.probesCompleted * 3 // rough estimate
                  }
                />
              </div>
            )}

            {/* ---- TRANSITION PHASE ---- */}
            {phase === 'transition' && (
              <div className="flex items-center justify-center py-16 animate-fade-in">
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 max-w-md w-full">
                  <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-yellow-500/30 border border-amber-500/20 flex items-center justify-center">
                      <span className="text-3xl">✨</span>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold text-white">
                        {getTransitionMessage(progress.probesCompleted)}
                      </h2>
                      {session.probeQueue.length > 0 && (
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <div
                            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${
                              SUBJECT_COLORS[session.probeQueue[0].subject.toLowerCase()] ||
                              'from-slate-500/30 to-slate-600/30'
                            } flex items-center justify-center`}
                          >
                            <span className="text-base">
                              {SUBJECT_ICONS[session.probeQueue[0].subject.toLowerCase()] || '📝'}
                            </span>
                          </div>
                          <p className="text-slate-400">
                            Next up:{' '}
                            {SUBJECT_LABELS[
                              session.probeQueue[0].subject.toLowerCase()
                            ] || session.probeQueue[0].subject}{' '}
                            activities
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
                      <div
                        className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: '0.15s' }}
                      />
                      <div
                        className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: '0.3s' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ---- COMPLETING PHASE ---- */}
            {phase === 'completing' && (
              <div className="flex items-center justify-center py-16 animate-fade-in">
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 max-w-md w-full">
                  <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-500/30 border border-green-500/20 flex items-center justify-center">
                        <span className="text-3xl">🏗️</span>
                      </div>
                      <div className="absolute inset-0 rounded-2xl border-2 border-green-400/40 animate-ping" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-slate-200 text-lg font-medium">
                        Building your learning plan...
                      </p>
                      <p className="text-slate-500 text-sm">
                        Analyzing your strengths and creating a path just for you
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ---- PROFILE PHASE ---- */}
            {phase === 'profile' &&
              knowledgeProfile &&
              completionResponse && (
                <div className="animate-fade-in">
                  <DiagnosticProfileCard
                    profile={knowledgeProfile}
                    completionResponse={completionResponse}
                    onStartLearning={() => {
                      onComplete?.(knowledgeProfile);
                      onBack();
                    }}
                  />
                </div>
              )}

            {/* ---- ERROR PHASE ---- */}
            {phase === 'error' && (
              <div className="animate-fade-in">
                <Card className="backdrop-blur-xl bg-red-900/20 border-red-500/20 max-w-lg mx-auto">
                  <CardContent className="p-8 text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/30 to-rose-500/30 border border-red-500/20 flex items-center justify-center mx-auto">
                      <span className="text-3xl">😕</span>
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
// Welcome sub-component
// ---------------------------------------------------------------------------

function WelcomeScreen({
  hasResume,
  onStart,
  onResume,
  onDismissResume,
}: {
  hasResume: boolean;
  onStart: () => void;
  onResume: () => void;
  onDismissResume: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-fade-in">
      {/* Resume prompt */}
      {hasResume && (
        <Card className="backdrop-blur-xl bg-cyan-900/20 border-cyan-500/20 max-w-md w-full">
          <CardContent className="p-5 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
                <span className="text-base">📂</span>
              </div>
              <p className="text-slate-300 font-medium">
                You have an exploration in progress.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={onResume}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400"
              >
                Continue
              </Button>
              <Button
                variant="ghost"
                onClick={onDismissResume}
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
              >
                Start Fresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main welcome card — SpotlightCard for signature hover glow */}
      <SpotlightCard
        color="34, 211, 238"
        className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 max-w-lg w-full"
      >
        <div className="p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/30 to-yellow-500/30 border border-amber-500/20 flex items-center justify-center mx-auto">
            <span className="text-4xl">🧭</span>
          </div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-300">
            Let&apos;s explore what you already know!
          </h2>
          <p className="text-slate-400 leading-relaxed">
            We&apos;ll show you some fun activities across different subjects.
            Just do your best — there are no wrong answers here! This helps us
            build the perfect learning path just for you.
          </p>
          <Button
            onClick={onStart}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white px-10 py-4 text-lg rounded-xl shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-400/30 hover:scale-[1.02]"
          >
            Let&apos;s Go!
          </Button>
        </div>
      </SpotlightCard>

      {/* Helpful note */}
      <p className="text-xs text-slate-600 max-w-sm text-center">
        This usually takes about 20-30 minutes. You can take breaks anytime —
        we&apos;ll save your progress!
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Probe Intro sub-component — context card before each probe
// ---------------------------------------------------------------------------

import type { ProbeRequest } from './types';
import type { HydratedPracticeItem } from '../types';

/** Map visual primitive componentId → friendly icon */
const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  'ordinal-line': '📏',
  'sorting-station': '🗂️',
  'ten-frame': '🔟',
  'counting-board': '🧮',
  'number-line': '📐',
  'function-machine': '⚙️',
  'pattern-builder': '🧩',
  'fraction-bar': '📊',
  'place-value-chart': '🔢',
  'lever-lab': '⚖️',
  'categorization': '📋',
};

/** Map standard problem types → friendly icon */
const PROBLEM_TYPE_ICONS: Record<string, string> = {
  multiple_choice: '🔘',
  true_false: '✅',
  fill_in_blank: '✏️',
  short_answer: '💬',
  matching: '🔗',
};

function getActivityIcon(item: HydratedPracticeItem): string {
  if (item.manifestItem.visualPrimitive) {
    return ACTIVITY_TYPE_ICONS[item.manifestItem.visualPrimitive.componentId] || '🎨';
  }
  if (item.manifestItem.standardProblem) {
    return PROBLEM_TYPE_ICONS[item.manifestItem.standardProblem.problemType] || '📝';
  }
  return '📝';
}

function getActivityTypeLabel(item: HydratedPracticeItem): string {
  if (item.manifestItem.visualPrimitive) {
    return 'Interactive';
  }
  if (item.manifestItem.standardProblem) {
    const t = item.manifestItem.standardProblem.problemType;
    return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return 'Activity';
}

function ProbeIntroCard({
  probe,
  hydratedItems,
  probesCompleted,
  onStart,
}: {
  probe: ProbeRequest;
  hydratedItems: HydratedPracticeItem[];
  probesCompleted: number;
  onStart: () => void;
}) {
  const subjectKey = probe.subject.toLowerCase();
  const subjectLabel =
    SUBJECT_LABELS[subjectKey] || probe.subject;
  const subjectIcon = SUBJECT_ICONS[subjectKey] || '📝';
  const spotlightColor =
    SUBJECT_SPOTLIGHT[subjectKey] || '120, 119, 198';
  const gradientClass =
    SUBJECT_COLORS[subjectKey] || 'from-slate-500/30 to-slate-600/30';

  // Use backend-provided descriptions, fall back to humanized slugs
  const humanize = (slug: string) =>
    slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const skillLabel = probe.skill_description || humanize(probe.skill_id);
  const subskillLabel = probe.description || humanize(probe.subskill_id);

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-full border border-white/10 backdrop-blur-sm mb-4">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: `rgb(${spotlightColor})` }} />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
            {probesCompleted === 0 ? 'First Exploration' : 'Next Exploration'}
          </span>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: `rgb(${spotlightColor})`, animationDelay: '0.2s' }} />
        </div>

        {/* Breadcrumb: Subject → Skill → Subskill */}
        <div className="flex items-center justify-center gap-1.5 text-sm mb-3 flex-wrap">
          <div
            className={`w-5 h-5 rounded bg-gradient-to-br ${gradientClass} flex items-center justify-center flex-shrink-0`}
          >
            <span className="text-[10px]">{subjectIcon}</span>
          </div>
          <span className="capitalize text-slate-400">{subjectLabel}</span>
          <svg className="w-3 h-3 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-300">{skillLabel}</span>
          <svg className="w-3 h-3 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium" style={{ color: `rgb(${spotlightColor})` }}>{subskillLabel}</span>
        </div>

        {/* Description */}
        <h3 className="text-2xl font-bold text-white mb-2">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
            {subskillLabel}
          </span>
        </h3>
        <p className="text-slate-500 text-sm">
          {hydratedItems.length} {hydratedItems.length === 1 ? 'activity' : 'activities'} · just do your best!
        </p>
      </div>

      {/* Activity cards grid */}
      <div className={`grid gap-4 ${
        hydratedItems.length <= 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto' :
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {hydratedItems.map((item, index) => {
          const icon = getActivityIcon(item);
          const typeLabel = getActivityTypeLabel(item);

          return (
            <SpotlightCard
              key={item.manifestItem.instanceId}
              color={spotlightColor}
              className="bg-slate-900/40 backdrop-blur-sm"
            >
              <div
                className="p-5 h-full flex flex-col"
                style={{
                  animationDelay: `${index * 150}ms`,
                  animation: 'fade-in-up 0.6s ease-out backwards',
                }}
              >
                {/* Icon + counter */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                    style={{
                      backgroundColor: `rgba(${spotlightColor}, 0.15)`,
                      border: `1px solid rgba(${spotlightColor}, 0.3)`,
                    }}
                  >
                    <span className="text-xl">{icon}</span>
                  </div>
                  <div
                    className="text-xs font-bold px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: `rgba(${spotlightColor}, 0.2)`,
                      color: `rgb(${spotlightColor})`,
                    }}
                  >
                    {index + 1}/{hydratedItems.length}
                  </div>
                </div>

                {/* Type label */}
                <div className="mb-2">
                  <span
                    className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `rgba(${spotlightColor}, 0.15)`,
                      color: `rgb(${spotlightColor})`,
                      border: `1px solid rgba(${spotlightColor}, 0.3)`,
                    }}
                  >
                    {typeLabel}
                  </span>
                </div>

                {/* Problem text */}
                <p className="text-slate-200 text-sm leading-relaxed flex-1">
                  {item.manifestItem.problemText}
                </p>
              </div>
            </SpotlightCard>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-8 text-center">
        <Button
          onClick={onStart}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white px-10 py-4 text-lg rounded-xl shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-400/30 hover:scale-[1.02]"
        >
          Let&apos;s Explore!
        </Button>
        <p className="text-xs text-slate-600 mt-3">
          There are no wrong answers — this helps us find your starting point!
        </p>
      </div>
    </div>
  );
}
