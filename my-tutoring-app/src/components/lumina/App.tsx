'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { GenerativeBackground } from './primitives/GenerativeBackground';
import { DetailDrawer } from './primitives/DetailDrawer';
import { LiveAssistant } from './service/LiveAssistant';
import { GameState, ExhibitData, ExhibitManifest } from './types';
import { useExhibitSession } from './hooks/useExhibitSession';
import type { GradeLevel } from './components/GradeLevelSelector';
import { ManifestViewer } from './components/ManifestViewer';
import { ObjectivesViewer } from './components/ObjectivesViewer';
import { ComponentViewer } from './components/ComponentViewer';
import { ObjectCollection } from './primitives/visual-primitives/ObjectCollection';
import { ComparisonPanel as VisualComparisonPanel } from './primitives/visual-primitives/ComparisonPanel';
import { AlphabetSequence } from './primitives/visual-primitives/AlphabetSequence';
import { RhymingPairs } from './primitives/visual-primitives/RhymingPairs';
import { SightWordCard } from './primitives/visual-primitives/SightWordCard';
import { SoundSort } from './primitives/visual-primitives/SoundSort';
import { LetterPicture } from './primitives/visual-primitives/LetterPicture';
import { ManifestOrderRenderer } from './components/ManifestOrderRenderer';
import { KnowledgeCheckTester } from './components/KnowledgeCheckTester';
import { MediaPlayerTester } from './components/MediaPlayerTester';
import { MathPrimitivesTester } from './components/MathPrimitivesTester';
import { EngineeringPrimitivesTester } from './components/EngineeringPrimitivesTester';
import AstronomyPrimitivesTester from './components/AstronomyPrimitivesTester';
import { PhysicsPrimitivesTester } from './components/PhysicsPrimitivesTester';
import { FeatureExhibitTester } from './components/FeatureExhibitTester';
import BiologyPrimitivesTester from './components/BiologyPrimitivesTester';
import ChemistryPrimitivesTester from './components/ChemistryPrimitivesTester';
import LanguageArtsPrimitivesTester from './components/LanguageArtsPrimitivesTester';
import LuminaTutorTester from './components/LuminaTutorTester';
import { PulseSession } from './pulse/PulseSession';
import { ExhibitProvider } from './contexts/ExhibitContext';
import { ScratchPad } from './components/scratch-pad';
import { PlannerDashboard } from './components/PlannerDashboard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { DiagnosticSession, KnowledgeMapPanel } from './diagnostic';
import { EvaluationProvider, useEvaluationContext } from './evaluation';
import { LuminaAIProvider, useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { LessonConnectionInfo } from '@/contexts/LuminaAIContext';
import type { CurriculumContext } from './components/CurriculumBrowser';
import { IdleScreen } from './components/IdleScreen';
import { DailyLessonPlan } from './DailyLessonPlan';
import type { DailySessionPlan, LessonBlock } from '@/lib/sessionPlanAPI';
import ExhibitCompleteFooter from './components/ExhibitCompleteFooter';
import SessionBreakScreen from './components/SessionBreakScreen';

// Simple evaluation results indicator
const EvaluationResultsIndicator: React.FC = () => {
  const context = useEvaluationContext();

  // Log only when a new result is added
  const prevCountRef = React.useRef(0);
  React.useEffect(() => {
    if (context && context.submittedResults.length > prevCountRef.current) {
      const newResult = context.submittedResults[context.submittedResults.length - 1];
      console.log('✅ New evaluation result:', {
        primitive: newResult.primitiveType,
        success: newResult.success,
        score: Math.round(newResult.score),
        duration: `${Math.round(newResult.durationMs / 1000)}s`
      });
      prevCountRef.current = context.submittedResults.length;
    }
  }, [context?.submittedResults.length]);

  if (!context || context.submittedResults.length === 0) {
    return null;
  }

  const { submittedResults } = context;
  const lastResult = submittedResults[submittedResults.length - 1];

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm animate-fade-in">
      <div className={`p-4 rounded-xl border backdrop-blur-sm shadow-xl ${
        lastResult.success
          ? 'bg-green-500/20 border-green-500/50'
          : 'bg-red-500/20 border-red-500/50'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            lastResult.success ? 'bg-green-500/30' : 'bg-red-500/30'
          }`}>
            <span className="text-2xl">{lastResult.success ? '✓' : '✗'}</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white capitalize">
              {lastResult.primitiveType.replace(/-/g, ' ')}
            </div>
            <div className={`text-sm font-bold ${
              lastResult.success ? 'text-green-400' : 'text-red-400'
            }`}>
              Score: {Math.round(lastResult.score)}%
            </div>
          </div>
        </div>
        {submittedResults.length > 1 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="text-xs text-slate-400">
              Total attempts: {submittedResults.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Bootstraps the lesson-mode AI session when the exhibit mounts.
// Must be rendered inside LuminaAIProvider + ExhibitProvider.
const LessonAIBootstrap: React.FC<{
  exhibit: ExhibitData;
  gradeLevel: string;
}> = ({ exhibit, gradeLevel }) => {
  const aiContext = useLuminaAIContext();
  const hasBootstrappedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasBootstrappedRef.current) return;

    const orderedComponents = exhibit.orderedComponents || [];
    if (orderedComponents.length === 0) return;

    const first = orderedComponents[0];
    const info: LessonConnectionInfo = {
      exhibit_id: exhibit.topic || 'unknown',
      topic: exhibit.topic || 'Learning Activity',
      grade_level: gradeLevel,
      firstPrimitive: {
        primitive_type: first.componentId,
        instance_id: first.instanceId,
        primitive_data: first.data || {},
        exhibit_id: exhibit.topic || 'unknown',
        topic: exhibit.topic,
        grade_level: gradeLevel,
      },
    };

    hasBootstrappedRef.current = true;
    aiContext.connectLesson(info);

    return () => {
      aiContext.disconnect();
      hasBootstrappedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default function App() {
  // Core lesson pipeline (brief → manifest → exhibit)
  const { phase, brief, exhibit, progress, generate, reset: resetSession } = useExhibitSession();

  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');

  // Single panel state replaces 17 individual booleans
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // Manifest Viewer State (dev tools)
  const [manifest, setManifest] = useState<ExhibitManifest | null>(null);
  const [isGeneratingManifest, setIsGeneratingManifest] = useState(false);

  // Auto-scroll when generation starts
  useEffect(() => {
    if (phase === GameState.GENERATING) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [phase]);

  // Error handling
  useEffect(() => {
    if (phase === GameState.ERROR) {
      alert("Failed to generate exhibit. Please try a different topic or check API key.");
      resetSession();
    }
  }, [phase, resetSession]);

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<string | null>(null);

  // Visual Primitives Testing State
  const [currentVisualIndex, setCurrentVisualIndex] = useState(0);

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

  // Sample data for visual primitives tester
  const visualPrimitiveExamples = [
    {
      name: 'Object Collection',
      component: (
        <ObjectCollection
          data={{
            instruction: 'Count the apples',
            items: [
              { name: 'apple', count: 5, icon: '🍎' },
              { name: 'orange', count: 3, icon: '🍊' }
            ],
            layout: 'grid'
          }}
        />
      )
    },
    {
      name: 'Comparison Panel',
      component: (
        <VisualComparisonPanel
          data={{
            panels: [
              {
                label: 'Group A',
                collection: {
                  instruction: 'Red fruits',
                  items: [{ name: 'apple', count: 4, icon: '🍎' }],
                  layout: 'grid'
                }
              },
              {
                label: 'Group B',
                collection: {
                  instruction: 'Yellow fruits',
                  items: [{ name: 'banana', count: 3, icon: '🍌' }],
                  layout: 'grid'
                }
              }
            ]
          }}
        />
      )
    },
    {
      name: 'Alphabet Sequence',
      component: (
        <AlphabetSequence
          data={{
            sequence: ['A', 'B', '_', 'D', 'E'],
            missing: ['C'],
            highlightMissing: true,
            showImages: true
          }}
        />
      )
    },
    {
      name: 'Rhyming Pairs',
      component: (
        <RhymingPairs
          data={{
            pairs: [
              { word1: 'cat', image1: '🐱', word2: 'hat', image2: '🎩' },
              { word1: 'dog', image1: '🐶', word2: 'log', image2: '🪵' }
            ],
            showConnectingLines: true
          }}
        />
      )
    },
    {
      name: 'Sight Word Card',
      component: (
        <SightWordCard
          data={{
            word: 'the',
            fontSize: 'large',
            showInContext: true,
            sentence: 'Look at the cat in the hat.',
            highlightWord: true
          }}
        />
      )
    },
    {
      name: 'Sound Sort',
      component: (
        <SoundSort
          data={{
            targetSound: 'short a',
            categories: [
              { label: 'Has short a', words: ['cat', 'hat', 'bat', 'mat'] },
              { label: 'No short a', words: ['dog', 'run', 'pig'] }
            ],
            showPictures: true
          }}
        />
      )
    },
    {
      name: 'Letter Picture',
      component: (
        <LetterPicture
          data={{
            letter: 'B',
            items: [
              { name: 'Ball', image: '🏀', highlight: true },
              { name: 'Book', image: '📚', highlight: true },
              { name: 'Cat', image: '🐱', highlight: false },
              { name: 'Bear', image: '🐻', highlight: true }
            ]
          }}
        />
      )
    }
  ];

  // Handle curriculum browser selection
  const handleCurriculumSelect = useCallback((topicString: string, grade?: GradeLevel, curriculum?: CurriculumContext) => {
    if (grade) {
      setGradeLevel(grade);
    }
    setCurriculumContext(curriculum ?? null);
    setTopic(topicString);
    generate({ topic: topicString, gradeLevel: grade || gradeLevel });
  }, [generate, gradeLevel]);

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
    generate({ topic: params.topic, gradeLevel: params.gradeLevel, preBuiltObjectives: params.preBuiltObjectives });
  }, [generate]);

  const reset = () => {
    resetSession();
    setTopic('');
    setCurriculumContext(null);
    setManifest(null);
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
  }, [activePanel]);

  const handleBlockStart = useCallback((block: LessonBlock) => {
    setSessionCompletedBlocks(prev => new Set(Array.from(prev).concat(block.block_id)));
    setSessionStats(prev => prev ? { ...prev, completed: prev.completed + 1 } : prev);
    setSessionCurrentBlock(block);
    setSessionEvalCount(0);
    setSessionReturn('daily-session');

    // Set curriculum context from block data so EvaluationProvider passes real
    // subskill IDs to the backend instead of falling back to primitive-type defaults.
    // Uses the first subskill; per-primitive attribution (DL-010) is a later enhancement.
    const firstSubskill = block.subskills[0];
    if (firstSubskill) {
      const subskillId = firstSubskill.subskill_id;
      // Derive parent skill_id: "RF.K.2.C" → "RF.K.2"
      const lastDot = subskillId.lastIndexOf('.');
      const skillId = lastDot > 0 ? subskillId.substring(0, lastDot) : subskillId;
      setCurriculumContext({ subject: block.subject, skillId, subskillId });
    } else {
      setCurriculumContext(null);
    }

    generate({ topic: `${block.subject}: ${block.title}`, gradeLevel });
    // TODO (backend integration): POST session block start to record attempt
    // authApi.post(`/api/daily-activities/daily-plan/1/session/start-block`, {
    //   block_id: block.block_id, lesson_group_id: block.lesson_group_id,
    // });
  }, [generate, gradeLevel]);

  // Derived: next block in session (for break screen preview)
  const currentBlockIndex = sessionCurrentBlock
    ? sessionBlocks.findIndex(b => b.block_id === sessionCurrentBlock.block_id)
    : -1;
  const nextSessionBlock = currentBlockIndex >= 0 && currentBlockIndex < sessionBlocks.length - 1
    ? sessionBlocks[currentBlockIndex + 1]
    : null;

  // Transition from exhibit completion → break screen
  const handleExhibitComplete = useCallback(() => {
    resetSession();
    setTopic('');
    setCurriculumContext(null);
    setManifest(null);
    setSessionPhase('break');
    // Session tracking state preserved: sessionReturn, sessionCurrentBlock, sessionEvalCount, sessionStats, sessionCompletedBlocks
  }, [resetSession]);

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
            {/* Exhibit tracker — shown during an exhibit launched from a session block */}
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
                            : i === sessionStats.completed - 1
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
            onGenerate={generate}
            onCurriculumSelect={handleCurriculumSelect}
            onLaunchGroupLesson={handleLaunchGroupLesson}
            onNavigate={setActivePanel}
          />
        )}

        {/* MANIFEST VIEWER STATE */}
        {phase === GameState.IDLE && activePanel === 'manifest-viewer' && (
          <div className="flex-1 animate-fade-in">
            <div className="mb-8 text-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Home
              </button>
            </div>
            <ManifestViewer manifest={manifest} isLoading={isGeneratingManifest} />
          </div>
        )}

        {/* KNOWLEDGE CHECK TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'knowledge-check-tester' && (
          <div className="flex-1 animate-fade-in">
            <KnowledgeCheckTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* MEDIA PLAYER TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'media-player-tester' && (
          <div className="flex-1 animate-fade-in">
            <MediaPlayerTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* MATH PRIMITIVES TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'math-primitives-tester' && (
          <div className="flex-1 animate-fade-in">
            <MathPrimitivesTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* ENGINEERING PRIMITIVES TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'engineering-primitives-tester' && (
          <div className="flex-1 animate-fade-in">
            <EngineeringPrimitivesTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* ASTRONOMY PRIMITIVES TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'astronomy-primitives-tester' && (
          <div className="flex-1 animate-fade-in">
            <AstronomyPrimitivesTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* PHYSICS PRIMITIVES TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'physics-primitives-tester' && (
          <div className="flex-1 animate-fade-in">
            <PhysicsPrimitivesTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* FEATURE EXHIBIT TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'feature-exhibit-tester' && (
          <div className="flex-1 animate-fade-in">
            <FeatureExhibitTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* BIOLOGY PRIMITIVES TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'biology-primitives-tester' && (
          <div className="flex-1 animate-fade-in">
            <BiologyPrimitivesTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* CHEMISTRY PRIMITIVES TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'chemistry-primitives-tester' && (
          <div className="flex-1 animate-fade-in">
            <ChemistryPrimitivesTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* LANGUAGE ARTS PRIMITIVES TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'language-arts-tester' && (
          <div className="flex-1 animate-fade-in">
            <LanguageArtsPrimitivesTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* LUMINA TUTOR TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'lumina-tutor-tester' && (
          <div className="flex-1 animate-fade-in">
            <LuminaTutorTester onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* PRACTICE MODE STATE */}
        {phase === GameState.IDLE && activePanel === 'practice-mode' && (
          <div className="flex-1 animate-fade-in">
            <PulseSession
              onBack={() => setActivePanel(null)}
              gradeLevel={gradeLevel}
            />
          </div>
        )}

        {/* SCRATCH PAD STATE */}
        {phase === GameState.IDLE && activePanel === 'scratch-pad' && (
          <div className="flex-1 animate-fade-in">
            <ScratchPad
              onBack={() => setActivePanel(null)}
              gradeLevel={gradeLevel}
            />
          </div>
        )}

        {/* PLANNER DASHBOARD STATE */}
        {phase === GameState.IDLE && activePanel === 'planner-dashboard' && (
          <div className="flex-1 animate-fade-in">
            <PlannerDashboard onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* DIAGNOSTIC PLACEMENT STATE */}
        {phase === GameState.IDLE && activePanel === 'diagnostic' && (
          <div className="flex-1 animate-fade-in">
            <DiagnosticSession
              onBack={() => setActivePanel(null)}
              gradeLevel={gradeLevel}
              onComplete={() => setActivePanel(null)}
            />
          </div>
        )}

        {/* KNOWLEDGE MAP STATE */}
        {phase === GameState.IDLE && activePanel === 'knowledge-map' && (
          <div className="flex-1 animate-fade-in">
            <KnowledgeMapPanel
              onBack={() => setActivePanel(null)}
              onNavigateDiagnostic={() => setActivePanel('diagnostic')}
            />
          </div>
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
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-white mb-1">Today's Session</h2>
              <p className="text-slate-500 text-base">Complete your blocks in order. Each block takes 5–18 minutes.</p>
            </div>
            <DailyLessonPlan
              studentId="1"
              completedBlockIds={sessionCompletedBlocks}
              blockResults={sessionBlockResults}
              initialPlan={sessionPlan}
              onPlanLoaded={(plan: DailySessionPlan) => {
                // Only initialize on first load — don't clobber progress on remount re-fetch
                if (!sessionPlan) {
                  setSessionStats({ total: plan.blocks.length, completed: 0 });
                  setSessionPlan(plan);
                }
              }}
              onBlockStart={handleBlockStart}
            />
          </div>
        )}

        {/* ANALYTICS DASHBOARD STATE */}
        {phase === GameState.IDLE && activePanel === 'analytics-dashboard' && (
          <div className="flex-1 animate-fade-in">
            <AnalyticsDashboard onBack={() => setActivePanel(null)} />
          </div>
        )}

        {/* VISUAL PRIMITIVES TESTER STATE */}
        {phase === GameState.IDLE && activePanel === 'visual-tester' && (
          <div className="flex-1 animate-fade-in">
            <div className="mb-8 text-center">
              <button
                onClick={() => setActivePanel(null)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Home
              </button>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-2">Visual Primitives Gallery</h2>
              <p className="text-slate-400">Preview all early learning visual components</p>
            </div>

            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={() => setCurrentVisualIndex(Math.max(0, currentVisualIndex - 1))}
                disabled={currentVisualIndex === 0}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Previous
              </button>

              <div className="px-6 py-3 bg-slate-800/80 rounded-lg border border-slate-600">
                <span className="text-white font-bold">
                  {currentVisualIndex + 1} / {visualPrimitiveExamples.length}
                </span>
                <span className="text-slate-400 ml-2">- {visualPrimitiveExamples[currentVisualIndex].name}</span>
              </div>

              <button
                onClick={() => setCurrentVisualIndex(Math.min(visualPrimitiveExamples.length - 1, currentVisualIndex + 1))}
                disabled={currentVisualIndex === visualPrimitiveExamples.length - 1}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-4xl mx-auto">
              {visualPrimitiveExamples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentVisualIndex(index)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentVisualIndex === index
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {example.name}
                </button>
              ))}
            </div>

            <div className="max-w-5xl mx-auto">
              {visualPrimitiveExamples[currentVisualIndex].component}
            </div>
          </div>
        )}

        {/* GENERATING STATE */}
        {phase === GameState.GENERATING && (
            <div className="flex-1 flex flex-col justify-center items-center text-center">
                <div className="relative w-32 h-32 mb-8">
                    <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                    <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin shadow-[0_0_30px_rgba(59,130,246,0.5)]"></div>
                    <div className="absolute inset-4 border-t-4 border-purple-500 rounded-full animate-spin direction-reverse shadow-[0_0_30px_rgba(168,85,247,0.5)]" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
                </div>
                <h3 className="text-2xl font-bold text-white animate-pulse">{progress.message}</h3>
                <p className="text-slate-500 mt-2 font-mono text-sm">Generative AI is curating...</p>
                <div className="mt-4 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
                  <span className="text-xs text-slate-400">
                    Tailoring for: <span className="text-blue-400 font-medium capitalize">{gradeLevel.replace('-', ' ')}</span>
                  </span>
                </div>

                {/* Objectives Display - Show after curator brief is generated */}
                {brief && brief.objectives && (
                  <div className="mt-12 w-full px-4">
                    <ObjectivesViewer
                      objectives={brief.objectives}
                      topic={brief.topic}
                    />
                  </div>
                )}

                {/* Component Build Progress */}
                {progress.componentStatuses.length > 0 && (
                  <div className="mt-8 w-full px-4">
                    <ComponentViewer components={progress.componentStatuses} />
                  </div>
                )}

                {/* AI Thinking Display */}
                {progress.thoughts.length > 0 && (
                  <div className="mt-8 max-w-2xl w-full px-4">
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">AI Thinking</span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {progress.thoughts.map((thought, index) => (
                          <div
                            key={index}
                            className="text-sm text-slate-300 bg-slate-900/40 rounded-lg p-3 animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            {thought}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
            </div>
        )}

        {/* EXHIBIT STATE */}
        {phase === GameState.PLAYING && exhibit && (
            <EvaluationProvider
                sessionId={`exhibit-${Date.now()}`}
                exhibitId={exhibit.topic || 'unknown'}
                topic={exhibit.topic}
                gradeLevel={gradeLevel}
                curriculumSubject={curriculumContext?.subject}
                curriculumSkillId={curriculumContext?.skillId}
                curriculumSubskillId={curriculumContext?.subskillId}
                localOnly={false}
                onCompetencyUpdate={(updates) => {
                    console.log('Competency updates:', updates);
                    if (sessionReturn) {
                      // Increment eval count for header tracker
                      setSessionEvalCount(prev => prev + 1);
                      // Accumulate score for block results display
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
            >
                <ExhibitProvider
                    objectives={exhibit.introBriefing?.objectives || []}
                    manifestItems={exhibit.manifest?.layout || []}
                >
                <LuminaAIProvider>
                    <LessonAIBootstrap exhibit={exhibit} gradeLevel={gradeLevel} />
                    <div className="w-full animate-fade-in-up">
                    {/* Title Section */}
                    <div className="mb-8 text-center">
                        <h2 className="text-5xl font-bold text-white tracking-tight">{exhibit.topic}</h2>
                    </div>

                {/* Manifest-Ordered Components - Renders all components in the order defined by the manifest */}
                <ManifestOrderRenderer
                    orderedComponents={exhibit.orderedComponents || []}
                    onDetailItemClick={handleDetailItemClick}
                    onTermClick={handleDetailItemClick}
                />

                {/* Evaluation Results Indicator */}
                <EvaluationResultsIndicator />

                {/* Exhibit Complete Footer — shown during daily session mode */}
                {sessionReturn === 'daily-session' && sessionCurrentBlock && (
                  <ExhibitCompleteFooter
                    block={sessionCurrentBlock}
                    evalCount={sessionEvalCount}
                    onContinue={handleExhibitComplete}
                  />
                )}

                {/* Related Topics — hidden during daily session mode (footer replaces it) */}
                {!sessionReturn && exhibit.relatedTopics && exhibit.relatedTopics.length > 0 && (
                    <div className="mt-24 mb-12 max-w-5xl mx-auto">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                            <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">Related Exhibits</span>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {exhibit.relatedTopics.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => generate({ topic: item.topic, gradeLevel })}
                                    className="group relative p-6 flex flex-col h-full rounded-2xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-white/5 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-2 overflow-hidden text-left"
                                >
                                    <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors duration-500"></div>
                                    <div className="relative z-10 flex-1">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                                                {item.category}
                                            </span>
                                            <span className="text-xs text-slate-600 font-mono group-hover:text-blue-400 transition-colors">0{i + 1}</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-200 transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-sm text-slate-400 leading-relaxed">
                                            {item.teaser}
                                        </p>
                                    </div>
                                    <div className="relative z-10 mt-4 flex items-center text-xs font-bold text-blue-500/70 uppercase tracking-wider group-hover:text-blue-400 transition-colors">
                                        <span>Enter Portal</span>
                                        <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            </LuminaAIProvider>
            </ExhibitProvider>
            </EvaluationProvider>
        )}

      </main>

      {/* Voice Curator - Available during exhibit viewing */}
      {phase === GameState.PLAYING && exhibit && (
        <LiveAssistant
            exhibitData={exhibit}
        />
      )}
    </div>
  );
}
