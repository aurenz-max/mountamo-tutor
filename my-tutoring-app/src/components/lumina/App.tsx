'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GenerativeBackground } from './primitives/GenerativeBackground';
import { DetailDrawer } from './primitives/DetailDrawer';
import { GameState } from './types';
import { useExhibitSession, type GenerateOptions } from './hooks/useExhibitSession';
import type { GradeLevel } from './components/GradeLevelSelector';
import type { CurriculumContext } from './components/CurriculumBrowser';
import { IdleScreen } from './components/IdleScreen';
import { LessonScreen } from './components/LessonScreen';
import { DevPanelRouter } from './components/DevPanelRouter';
import { GeneratingScreen } from './components/GeneratingScreen';
import { GenerationErrorScreen } from './components/GenerationErrorScreen';
import { DailyLessonPlan } from './DailyLessonPlan';
import { DailySessionView } from './components/PlannerDashboard/DailySessionView';
import { markSessionBlockComplete, type DailySessionPlan, type LessonBlock } from '@/lib/sessionPlanAPI';
import SessionBreakScreen from './components/SessionBreakScreen';
import { StudentProvider, useStudent } from './contexts/StudentContext';
import StudentBadge from './components/StudentBadge';
import { SaveProgressPrompt } from './components/SaveProgressPrompt';
import { LuminaMark } from './ui';


export interface AppProps {
  /** Topic handed in from the landing page (`/lumina?topic=…`) — auto-starts a lesson on mount. */
  initialTopic?: string;
  /** Grade band handed in alongside the topic. */
  initialGrade?: GradeLevel;
}

export default function App({ initialTopic, initialGrade }: AppProps = {}) {
  return (
    <StudentProvider>
      <LuminaApp initialTopic={initialTopic} initialGrade={initialGrade} />
    </StudentProvider>
  );
}

function LuminaApp({ initialTopic, initialGrade }: AppProps) {
  // Student identity — resolved once by StudentProvider, never a literal.
  // `ready` gates student-scoped data surfaces so they never fetch (and cache)
  // the fallback student's data while the profile is still in flight.
  const { studentId, isAnonymous, ready: studentReady } = useStudent();

  // Core lesson pipeline (brief → manifest → exhibit), personalized per student
  const { phase, brief, exhibit, progress, generate, reset: resetSession } = useExhibitSession(studentId);

  const [topic, setTopic] = useState(initialTopic ?? '');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(initialGrade ?? 'elementary');

  // Single panel state replaces 17 individual booleans
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // Topic carried from the home-screen Practice slider into a Pulse session.
  // When set, the Pulse setup screen is skipped and the session auto-starts.
  const [practiceTopic, setPracticeTopic] = useState('');

  const handleStartPractice = useCallback((t: string) => {
    setPracticeTopic(t);
    setActivePanel('practice-mode');
  }, []);

  // Last generate request — lets the error screen retry without losing
  // session or curriculum state.
  const lastGenerateRef = useRef<GenerateOptions | null>(null);
  const startGenerate = useCallback((options: GenerateOptions) => {
    lastGenerateRef.current = options;
    void generate(options);
  }, [generate]);

  // Topic handed in from the landing page (`/lumina?topic=…`) → start the
  // lesson straight away, exactly once, skipping the home screen.
  const handoffStarted = useRef(false);
  useEffect(() => {
    if (handoffStarted.current) return;
    const handoff = initialTopic?.trim();
    if (!handoff) return;
    handoffStarted.current = true;
    startGenerate({ topic: handoff, gradeLevel: initialGrade ?? gradeLevel });
  }, [initialTopic, initialGrade, gradeLevel, startGenerate]);

  // Auto-scroll when generation starts
  useEffect(() => {
    if (phase === GameState.GENERATING) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [phase]);

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<string | null>(null);

  // "Sign up to save" on-ramp — shown once to anonymous visitors at the first
  // real signal of progress (a competency update), then suppressed for the
  // rest of the browser session once resolved so it never nags.
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const savePromptResolvedRef = useRef(false);

  const maybeOfferSaveProgress = useCallback(() => {
    if (!isAnonymous || savePromptResolvedRef.current) return;
    const dismissed =
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem('lumina:savePromptDismissed') === '1';
    if (dismissed) {
      savePromptResolvedRef.current = true;
      return;
    }
    savePromptResolvedRef.current = true;
    setShowSavePrompt(true);
  }, [isAnonymous]);

  const handleDismissSavePrompt = useCallback(() => {
    setShowSavePrompt(false);
    savePromptResolvedRef.current = true;
    try {
      window.sessionStorage.setItem('lumina:savePromptDismissed', '1');
    } catch {
      /* sessionStorage unavailable (private mode) — dismiss for this mount only */
    }
  }, []);

  // Curriculum context (set when lesson initiated from CurriculumBrowser)
  const [curriculumContext, setCurriculumContext] = useState<CurriculumContext | null>(null);

  // Daily session driver state
  const [sessionStats, setSessionStats] = useState<{ total: number; completed: number } | null>(null);
  // Panel to return to after an exhibit launched from a session block
  const [sessionReturn, setSessionReturn] = useState<string | null>(null);
  // Completed block IDs — lifted out of DailyLessonPlan to persist across remounts
  const [sessionCompletedBlocks, setSessionCompletedBlocks] = useState<Set<string>>(new Set());
  // Block currently being exhibited (for header tracker)
  const [sessionCurrentBlock, setSessionCurrentBlock] = useState<LessonBlock | null>(null);
  // Count of evaluation results received during current exhibit block
  const [sessionEvalCount, setSessionEvalCount] = useState(0);
  // Per-block results: block_id → { evalCount, scoreSum } (for showing results on completed blocks)
  const [sessionBlockResults, setSessionBlockResults] = useState<
    Record<string, { evalCount: number; scoreSum: number }>
  >({});
  // Full session plan — lifted to App to prevent re-fetch from clobbering block IDs
  const [sessionPlan, setSessionPlan] = useState<DailySessionPlan | null>(null);
  // Convenience: block list derived from plan
  const sessionBlocks = sessionPlan?.blocks ?? [];
  // Session sub-phase: null = normal, 'break' = showing break/transition screen
  const [sessionPhase, setSessionPhase] = useState<'break' | null>(null);

  // Handle curriculum browser selection
  const handleCurriculumSelect = useCallback((topicString: string, grade?: GradeLevel, curriculum?: CurriculumContext) => {
    if (grade) {
      setGradeLevel(grade);
    }
    setCurriculumContext(curriculum ?? null);
    setTopic(topicString);
    // Single known subskill → the personalization step keys straight into β,
    // skipping the embedding sweep that would otherwise re-derive it.
    startGenerate({ topic: topicString, gradeLevel: grade || gradeLevel, curriculumContext: curriculum });
  }, [startGenerate, gradeLevel]);

  // Handle lesson group launch from IdleScreen
  const handleLaunchGroupLesson = useCallback((params: {
    topic: string;
    gradeLevel: GradeLevel;
    preBuiltObjectives: Array<{
      id: string; text: string; verb: string; icon: string;
      subskillId?: string; skillId?: string; grade?: string;
    }>;
    curriculum: CurriculumContext;
  }) => {
    setTopic(params.topic);
    setGradeLevel(params.gradeLevel);
    setCurriculumContext(params.curriculum);
    startGenerate({ topic: params.topic, gradeLevel: params.gradeLevel, preBuiltObjectives: params.preBuiltObjectives });
  }, [startGenerate]);

  const reset = () => {
    resetSession();
    setTopic('');
    setCurriculumContext(null);
    setSessionPhase(null);
    const returnPanel = sessionReturn;
    setSessionReturn(null);
    setSessionCurrentBlock(null);
    setSessionEvalCount(0);
    if (!returnPanel) {
      setSessionStats(null);
      setSessionCompletedBlocks(new Set());
      setSessionPlan(null);
      setSessionBlockResults({});
    }
    setActivePanel(returnPanel);
  };

  // Clear session state when leaving the daily-session panel via ← Back
  const handleBackFromPanel = useCallback(() => {
    if (activePanel === 'daily-session') {
      setSessionStats(null);
      setSessionCompletedBlocks(new Set());
      setSessionPlan(null);
      setSessionBlockResults({});
      setSessionCurrentBlock(null);
      setSessionEvalCount(0);
      setSessionPhase(null);
    }
    setActivePanel(null);
    setPracticeTopic('');
  }, [activePanel]);

  // Back handler for dev panels (testers, dashboards, practice mode)
  const handlePanelBack = useCallback(() => {
    setActivePanel(null);
    setPracticeTopic('');
  }, []);

  const handleBlockStart = useCallback((block: LessonBlock) => {
    setSessionCurrentBlock(block);
    setSessionEvalCount(0);
    setSessionReturn('daily-session');

    // Set curriculum context from block data so EvaluationProvider passes real
    // subskill IDs to the backend instead of falling back to primitive-type defaults.
    // Uses the first subskill; per-primitive attribution (DL-010) is a later enhancement.
    const firstSubskill = block.subskills[0];
    if (firstSubskill) {
      const subskillId = firstSubskill.subskill_id;
      // Prefer the curriculum-resolved parent skill carried on the block;
      // dot-trimming remains only as a fallback for plans fetched before
      // skill_id was added to the payload.
      const lastDot = subskillId.lastIndexOf('.');
      const skillId = firstSubskill.skill_id
        || (lastDot > 0 ? subskillId.substring(0, lastDot) : subskillId);
      setCurriculumContext({ subject: block.subject, skillId, subskillId });
    } else {
      setCurriculumContext(null);
    }

    // Generate against the block's own subskills, not just a topic string —
    // they ride the existing preBuiltObjectives path so the manifest targets
    // what the block actually teaches.
    const preBuiltObjectives = block.subskills.length > 0
      ? block.subskills.map(ss => ({
          id: ss.subskill_id,
          text: ss.subskill_name,
          verb: ss.bloom_phase.charAt(0).toUpperCase() + ss.bloom_phase.slice(1),
          icon: '🎯',
          // Carry the real IDs so personalization keys into β per subskill
          // instead of re-deriving each via embedding retrieval.
          subskillId: ss.subskill_id,
          skillId: ss.skill_id
            || (ss.subskill_id.lastIndexOf('.') > 0
                ? ss.subskill_id.substring(0, ss.subskill_id.lastIndexOf('.'))
                : ss.subskill_id),
        }))
      : undefined;

    startGenerate({ topic: `${block.subject}: ${block.title}`, gradeLevel, preBuiltObjectives });
  }, [startGenerate, gradeLevel]);

  // Derived: next block in session (for break screen preview)
  const currentBlockIndex = sessionCurrentBlock
    ? sessionBlocks.findIndex(b => b.block_id === sessionCurrentBlock.block_id)
    : -1;
  const nextSessionBlock = currentBlockIndex >= 0 && currentBlockIndex < sessionBlocks.length - 1
    ? sessionBlocks[currentBlockIndex + 1]
    : null;

  // Transition from exhibit completion → break screen
  const handleExhibitComplete = useCallback(() => {
    // Completion is recorded here — when the student finishes the exhibit —
    // not at block launch. Abandoned blocks stay incomplete.
    if (sessionCurrentBlock && !sessionCompletedBlocks.has(sessionCurrentBlock.block_id)) {
      setSessionCompletedBlocks(prev => new Set(prev).add(sessionCurrentBlock.block_id));
      setSessionStats(prev => prev ? { ...prev, completed: prev.completed + 1 } : prev);
      // Persist onto today's plan doc so progress survives backing out,
      // reloads, and device switches. Local state is already optimistic.
      void markSessionBlockComplete(studentId, sessionCurrentBlock.block_id, sessionPlan?.date)
        .catch(err => console.warn('[Session] Failed to persist block completion:', err));
    }
    resetSession();
    setTopic('');
    setCurriculumContext(null);
    setSessionPhase('break');
    // Session tracking state preserved: sessionReturn, sessionCurrentBlock, sessionEvalCount, sessionStats, sessionCompletedBlocks
  }, [resetSession, sessionCurrentBlock, sessionCompletedBlocks, studentId, sessionPlan]);

  // Break screen → start next block
  const handleBreakContinue = useCallback(() => {
    setSessionPhase(null);
    if (nextSessionBlock) {
      handleBlockStart(nextSessionBlock);
    }
  }, [nextSessionBlock, handleBlockStart]);

  // Break screen → finish session (last block)
  const handleSessionFinish = useCallback(() => {
    setSessionPhase(null);
    setSessionReturn(null);
    setSessionCurrentBlock(null);
    setSessionEvalCount(0);
    setActivePanel('daily-session');
  }, []);

  const handleDetailItemClick = (item: string) => {
      setSelectedDetailItem(item);
      setIsDrawerOpen(true);
  };


  return (
    <div className="relative min-h-screen overflow-x-hidden selection:bg-blue-500/30">

      {/* Detail Drawer for Table Items & Feature Terms */}
      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        contextTopic={exhibit?.topic || ''}
        itemName={selectedDetailItem}
      />

      {/* Dynamic Background */}
      <GenerativeBackground
        color={exhibit?.cards[0]?.themeColor || '#475569'}
        intensity={0.3}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 w-full px-6 py-4 z-50 flex justify-between items-center bg-slate-900/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={reset}>
             {/* Aurora Core brand mark — fills as the daily session progresses */}
             <LuminaMark
               size={32}
               progress={
                 sessionStats && sessionStats.total > 0
                   ? Math.round((sessionStats.completed / sessionStats.total) * 100)
                   : undefined
               }
             />
             <span className="text-xl font-bold tracking-tight text-white">Lumina <span className="text-slate-500 font-light">Exhibits</span></span>
        </div>
        <div className="flex items-center gap-4 text-xs md:text-sm font-mono text-slate-400">
            {/* Signed-in student identity + user menu (progress, sign out) */}
            <StudentBadge onOpenActivity={() => setActivePanel('my-activity')} />
            {/* Session progress dots — shown while viewing the session panel (IDLE) */}
            {phase === GameState.IDLE && activePanel === 'daily-session' && sessionStats && sessionStats.total > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <div className="flex items-center gap-1">
                  {Array.from({ length: sessionStats.total }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-300 ${
                        i < sessionStats.completed
                          ? 'w-2 h-2 bg-cyan-400'
                          : i === sessionStats.completed
                          ? 'w-2.5 h-2.5 bg-cyan-400/60 animate-pulse'
                          : 'w-2 h-2 bg-white/15'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-400">
                  {sessionStats.completed}/{sessionStats.total}
                </span>
              </div>
            )}
            {/* Exhibit tracker — shown during an exhibit launched from a session block.
                completed excludes the in-flight block, so the dot at index
                `completed` is the one currently being worked. */}
            {phase === GameState.PLAYING && sessionReturn === 'daily-session' && sessionCurrentBlock && (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                {sessionStats && sessionStats.total > 0 && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: sessionStats.total }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-full transition-all duration-300 ${
                          i < sessionStats.completed
                            ? 'w-2 h-2 bg-cyan-400'
                            : i === sessionStats.completed
                            ? 'w-2.5 h-2.5 bg-cyan-400/50 animate-pulse'
                            : 'w-2 h-2 bg-white/15'
                        }`}
                      />
                    ))}
                  </div>
                )}
                <span className="text-xs text-slate-300 font-medium max-w-[160px] truncate">
                  {sessionCurrentBlock.title}
                </span>
                {sessionEvalCount > 0 && (
                  <span className="text-xs font-semibold text-emerald-400">{sessionEvalCount} ✓</span>
                )}
              </div>
            )}
            {phase === GameState.PLAYING && (
                <button onClick={reset} className="hover:text-white transition-colors">
                   {sessionReturn ? '← Return to Session' : '← New Topic'}
                </button>
            )}
            {activePanel && (
                <button onClick={handleBackFromPanel} className="hover:text-white transition-colors">
                   ← Back
                </button>
            )}
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 min-h-screen flex flex-col pt-24 pb-12">

        {/* IDLE STATE — Home Screen */}
        {phase === GameState.IDLE && activePanel === null && (
          <IdleScreen
            topic={topic}
            onTopicChange={setTopic}
            gradeLevel={gradeLevel}
            onGradeLevelChange={setGradeLevel}
            onGenerate={startGenerate}
            onStartPractice={handleStartPractice}
            onCurriculumSelect={handleCurriculumSelect}
            onLaunchGroupLesson={handleLaunchGroupLesson}
            onNavigate={setActivePanel}
          />
        )}

        {/* DEV PANELS — testers, dashboards, labs (everything except the student flow) */}
        {phase === GameState.IDLE && activePanel !== null && activePanel !== 'daily-session' && (
          <DevPanelRouter
            activePanel={activePanel}
            gradeLevel={gradeLevel}
            practiceTopic={practiceTopic}
            onBack={handlePanelBack}
            onNavigate={setActivePanel}
          />
        )}

        {/* SESSION BREAK SCREEN — between blocks */}
        {phase === GameState.IDLE && sessionPhase === 'break' && sessionCurrentBlock && (
          <SessionBreakScreen
            completedBlock={sessionCurrentBlock}
            nextBlock={nextSessionBlock}
            stats={sessionStats}
            blocks={sessionBlocks}
            completedBlockIds={sessionCompletedBlocks}
            evalCount={sessionEvalCount}
            onContinue={handleBreakContinue}
            onFinish={handleSessionFinish}
          />
        )}

        {/* DAILY SESSION DRIVER STATE */}
        {phase === GameState.IDLE && activePanel === 'daily-session' && !sessionPhase && !studentReady && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-slate-400 animate-pulse">Loading your profile…</span>
          </div>
        )}
        {phase === GameState.IDLE && activePanel === 'daily-session' && !sessionPhase && studentReady && (
          <div className="flex-1 animate-fade-in max-w-4xl mx-auto w-full pt-2">
            <DailySessionView
              studentId={studentId}
              onStartPulse={() => setActivePanel('practice-mode')}
              renderLessonPlan={() => (
                <DailyLessonPlan
                  studentId={studentId}
                  completedBlockIds={sessionCompletedBlocks}
                  blockResults={sessionBlockResults}
                  initialPlan={sessionPlan}
                  onPlanLoaded={(plan: DailySessionPlan) => {
                    // Always adopt the fetched plan (a manual refresh must not
                    // leave the parent holding stale block ids), and seed
                    // completion from the server-persisted set — merged with
                    // any optimistic completions from this visit.
                    setSessionPlan(plan);
                    const merged = new Set(plan.completed_block_ids ?? []);
                    sessionCompletedBlocks.forEach(id => merged.add(id));
                    setSessionCompletedBlocks(merged);
                    const inPlan = new Set(plan.blocks.map(b => b.block_id));
                    setSessionStats({
                      total: plan.blocks.length,
                      completed: Array.from(merged).filter(id => inPlan.has(id)).length,
                    });
                  }}
                  onBlockStart={handleBlockStart}
                />
              )}
            />
          </div>
        )}

        {/* GENERATING STATE */}
        {phase === GameState.GENERATING && (
          <GeneratingScreen progress={progress} brief={brief} gradeLevel={gradeLevel} />
        )}

        {/* ERROR STATE — retry preserves session/curriculum state */}
        {phase === GameState.ERROR && (
          <GenerationErrorScreen
            topic={lastGenerateRef.current?.topic ?? topic}
            canRetry={lastGenerateRef.current !== null}
            backLabel={sessionReturn ? 'Return to Session' : 'Back to Home'}
            onRetry={() => {
              if (lastGenerateRef.current) {
                void generate(lastGenerateRef.current);
              }
            }}
            onBack={reset}
          />
        )}

        {/* EXHIBIT STATE */}
        {phase === GameState.PLAYING && exhibit && (
          <LessonScreen
            exhibit={exhibit}
            gradeLevel={gradeLevel}
            curriculumContext={curriculumContext}
            sessionReturn={sessionReturn}
            sessionCurrentBlock={sessionCurrentBlock}
            sessionEvalCount={sessionEvalCount}
            onCompetencyUpdate={(updates) => {
              console.log('Competency updates:', updates);
              // Anonymous visitor just earned real progress that's being
              // attributed to the shared fallback student — invite them to
              // claim it with a free account before it's lost.
              maybeOfferSaveProgress();
              if (sessionReturn) {
                setSessionEvalCount(prev => prev + 1);
                if (sessionCurrentBlock && updates.length > 0) {
                  const avgScore = updates.reduce((sum, u) => sum + u.averageScore, 0) / updates.length;
                  setSessionBlockResults(prev => {
                    const blockId = sessionCurrentBlock!.block_id;
                    const existing = prev[blockId] ?? { evalCount: 0, scoreSum: 0 };
                    return {
                      ...prev,
                      [blockId]: {
                        evalCount: existing.evalCount + 1,
                        scoreSum: existing.scoreSum + avgScore,
                      },
                    };
                  });
                }
              }
            }}
            onDetailItemClick={handleDetailItemClick}
            onExhibitComplete={handleExhibitComplete}
            onGenerateRelated={startGenerate}
            onExitLesson={reset}
          />
        )}

      </main>

      {/* Anonymous → account on-ramp. Carries the live topic + grade into signup
          so the visitor resumes this exact lesson, now personalized. */}
      {showSavePrompt && (
        <SaveProgressPrompt
          topic={exhibit?.topic || topic}
          gradeLevel={gradeLevel}
          onDismiss={handleDismissSavePrompt}
        />
      )}

      {/* The Curator now lives inside LessonScreen (CuratorConsole), bound to the
          scaffold-aware lesson session rather than a separate browser-direct one. */}
    </div>
  );
}
