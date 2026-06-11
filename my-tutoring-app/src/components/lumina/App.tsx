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
import type { DailySessionPlan, LessonBlock } from '@/lib/sessionPlanAPI';
import SessionBreakScreen from './components/SessionBreakScreen';
import { StudentProvider, useStudent } from './contexts/StudentContext';
import StudentBadge from './components/StudentBadge';


export default function App() {
  return (
    <StudentProvider>
      <LuminaApp />
    </StudentProvider>
  );
}

function LuminaApp() {
  // Student identity — resolved once by StudentProvider, never a literal
  const { studentId } = useStudent();

  // Core lesson pipeline (brief → manifest → exhibit), personalized per student
  const { phase, brief, exhibit, progress, generate, reset: resetSession } = useExhibitSession(studentId);

  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');

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

  // Auto-scroll when generation starts
  useEffect(() => {
    if (phase === GameState.GENERATING) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [phase]);

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<string | null>(null);

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
    startGenerate({ topic: topicString, gradeLevel: grade || gradeLevel });
  }, [startGenerate, gradeLevel]);

  // Handle lesson group launch from IdleScreen
  const handleLaunchGroupLesson = useCallback((params: {
    topic: string;
    gradeLevel: GradeLevel;
    preBuiltObjectives: Array<{ id: string; text: string; verb: string; icon: string }>;
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
        }))
      : undefined;

    startGenerate({ topic: `${block.subject}: ${block.title}`, gradeLevel, preBuiltObjectives });
    // TODO (backend integration): POST session block start to record attempt
    // authApi.post(`/api/daily-activities/daily-plan/1/session/start-block`, {
    //   block_id: block.block_id, lesson_group_id: block.lesson_group_id,
    // });
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
    }
    resetSession();
    setTopic('');
    setCurriculumContext(null);
    setSessionPhase('break');
    // Session tracking state preserved: sessionReturn, sessionCurrentBlock, sessionEvalCount, sessionStats, sessionCompletedBlocks
  }, [resetSession, sessionCurrentBlock, sessionCompletedBlocks]);

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
        <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
             <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="font-bold text-white text-lg">L</span>
             </div>
             <span className="text-xl font-bold tracking-tight text-white">Lumina <span className="text-slate-500 font-light">Exhibits</span></span>
        </div>
        <div className="flex items-center gap-4 text-xs md:text-sm font-mono text-slate-400">
            {/* Signed-in student identity */}
            <StudentBadge />
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
        {phase === GameState.IDLE && activePanel === 'daily-session' && !sessionPhase && (
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
                    if (!sessionPlan) {
                      setSessionStats({ total: plan.blocks.length, completed: 0 });
                      setSessionPlan(plan);
                    }
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

      {/* The Curator now lives inside LessonScreen (CuratorConsole), bound to the
          scaffold-aware lesson session rather than a separate browser-direct one. */}
    </div>
  );
}
