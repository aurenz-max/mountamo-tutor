'use client';

import React, { useState, useCallback } from 'react';
import { GenerativeBackground } from './primitives/GenerativeBackground';
import { CuratorBrief } from './primitives/CuratorBrief';
import { DetailDrawer } from './primitives/DetailDrawer';
import { LiveAssistant } from './service/LiveAssistant';
import {
  generateExhibitManifest,
  generateIntroBriefing,
  generateExhibitManifestWithObjectivesStreaming,
  buildCompleteExhibitFromManifest,
  type ManifestProgressCallback
} from './service/geminiClient-api';
import { GameState, ExhibitData, ExhibitManifest } from './types';
import { GradeLevelSelector, GradeLevel } from './components/GradeLevelSelector';
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
import { FeatureExhibitTester } from './components/FeatureExhibitTester';
import { PracticeMode } from './components/PracticeModeEnhanced';
import { SpotlightCard } from './components/SpotlightCard';
import { ExhibitProvider } from './contexts/ExhibitContext';
import { ScratchPad } from './components/scratch-pad';
import { EvaluationProvider, useEvaluationContext } from './evaluation';

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

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [exhibitData, setExhibitData] = useState<ExhibitData | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);
  const [componentStatuses, setComponentStatuses] = useState<Array<{
    id: string;
    name: string;
    status: 'pending' | 'building' | 'completed';
    index: number;
    total: number;
    title?: string;
    intent?: string;
    objectiveId?: string;
    objectiveText?: string;
    objectiveVerb?: string;
  }>>([]);

  // Manifest Viewer State
  const [showManifestViewer, setShowManifestViewer] = useState(false);
  const [manifest, setManifest] = useState<ExhibitManifest | null>(null);
  const [isGeneratingManifest, setIsGeneratingManifest] = useState(false);

  // Curator Brief State (for displaying objectives during generation)
  const [curatorBrief, setCuratorBrief] = useState<any>(null);

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<string | null>(null);

  // Visual Primitives Testing State
  const [showVisualTester, setShowVisualTester] = useState(false);
  const [currentVisualIndex, setCurrentVisualIndex] = useState(0);

  // Knowledge Check Testing State
  const [showKnowledgeCheckTester, setShowKnowledgeCheckTester] = useState(false);

  // Media Player Testing State
  const [showMediaPlayerTester, setShowMediaPlayerTester] = useState(false);

  // Math Primitives Testing State
  const [showMathPrimitivesTester, setShowMathPrimitivesTester] = useState(false);

  // Engineering Primitives Testing State
  const [showEngineeringPrimitivesTester, setShowEngineeringPrimitivesTester] = useState(false);

  // Feature Exhibit Testing State
  const [showFeatureExhibitTester, setShowFeatureExhibitTester] = useState(false);

  // Practice Mode State
  const [showPracticeMode, setShowPracticeMode] = useState(false);

  // Scratch Pad State
  const [showScratchPad, setShowScratchPad] = useState(false);

  // Sample data for each visual primitive
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

  const startExhibit = useCallback(async (topicOverride?: string) => {
    const searchTopic = topicOverride || topic;
    if (!searchTopic.trim()) return;

    if (topicOverride) setTopic(topicOverride);

    setGameState(GameState.GENERATING);
    setLoadingMessage(`Curating exhibit: ${searchTopic.substring(0, 30)}...`);
    setThinkingMessages([]); // Clear previous thinking messages
    setComponentStatuses([]); // Clear previous component statuses
    setCuratorBrief(null); // Clear previous curator brief

    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      // CURATOR-BRIEF-FIRST ARCHITECTURE
      // STEP 1: Generate curator brief with learning objectives
      setLoadingMessage('🎯 Defining learning objectives...');
      const generatedBrief = await generateIntroBriefing(searchTopic, gradeLevel);
      console.log('📚 Curator brief generated with objectives:', generatedBrief.objectives);

      // Store curator brief in state to display objectives
      setCuratorBrief(generatedBrief);

      // STEP 2: Use learning objectives to guide manifest generation WITH STREAMING
      setLoadingMessage('📋 Generating exhibit blueprint...');

      // Define streaming callbacks for real-time progress
      const manifestCallbacks: ManifestProgressCallback = {
        onProgress: (message: string) => {
          console.log('🔄 Manifest Progress:', message);
          setLoadingMessage(message);
        },
        onThinking: (thought: string) => {
          console.log('🧠 AI Thinking:', thought);
          setThinkingMessages(prev => [...prev.slice(-4), thought]); // Keep last 5 thoughts
        },
        onPartialManifest: (partial) => {
          console.log('📦 Partial Manifest:', partial);
          // Could show partial progress in UI
        }
      };

      const manifest = await generateExhibitManifestWithObjectivesStreaming(
        searchTopic,
        gradeLevel,
        generatedBrief.objectives,
        manifestCallbacks
      );
      console.log('🗺️ Manifest generated based on learning objectives');

      // STEP 3: Build complete exhibit from manifest
      setLoadingMessage('🎨 Building components in parallel...');
      setThinkingMessages([]); // Clear thinking messages for next phase

      // Initialize component statuses from manifest with rich metadata
      const totalComponents = manifest.layout?.length || 0;
      const initialStatuses = (manifest.layout || []).map((item, index) => ({
        id: item.instanceId,
        name: item.componentId,
        status: 'pending' as const,
        index: index + 1,
        total: totalComponents,
        // Learning-specific metadata
        title: item.title,
        intent: item.intent,
        objectiveId: item.config?.objectiveId,
        objectiveText: item.config?.objectiveText,
        objectiveVerb: item.config?.objectiveVerb,
      }));
      setComponentStatuses(initialStatuses);

      // Simulate realistic component building progress
      // Components are built in parallel, so we'll randomize completion times
      let buildComplete = false;
      const activeTimeouts: NodeJS.Timeout[] = [];

      const simulateProgress = () => {
        // Mark 1-3 random pending components as building
        setComponentStatuses(prev => {
          const pending = prev.filter(c => c.status === 'pending');
          if (pending.length === 0) return prev;

          const toBuild = Math.min(3, pending.length);
          const selected = pending.slice(0, toBuild);

          return prev.map(c =>
            selected.find(s => s.id === c.id)
              ? { ...c, status: 'building' as const }
              : c
          );
        });

        // After random delay, mark building as completed
        const timeout = setTimeout(() => {
          setComponentStatuses(prev => {
            const updated = prev.map(c =>
              c.status === 'building'
                ? { ...c, status: 'completed' as const }
                : c
            );

            // Check if all are completed and build is done
            const allCompleted = updated.every(c => c.status === 'completed');
            if (allCompleted && buildComplete) {
              // Clean up any remaining intervals/timeouts
              activeTimeouts.forEach(t => clearTimeout(t));
            }

            return updated;
          });
        }, 800 + Math.random() * 1200);

        activeTimeouts.push(timeout);
      };

      // Start simulation with faster initial pace
      const interval = setInterval(() => {
        simulateProgress();
      }, 1000);

      // Build the actual data
      const data = await buildCompleteExhibitFromManifest(manifest, generatedBrief);
      buildComplete = true;

      // Don't force completion - let simulation finish naturally
      // Just clear the interval so no new components start building
      clearInterval(interval);

      // If there are still pending components, complete them after a short delay
      setTimeout(() => {
        setComponentStatuses(prev => {
          const stillPending = prev.some(c => c.status !== 'completed');
          if (stillPending) {
            return prev.map(c => ({ ...c, status: 'completed' as const }));
          }
          return prev;
        });
        activeTimeouts.forEach(t => clearTimeout(t));
      }, 2500); // Give simulation 2.5s to finish naturally

      setExhibitData(data);
      setGameState(GameState.PLAYING);
    } catch (error) {
      console.error(error);
      setGameState(GameState.ERROR);
      alert("Failed to generate exhibit. Please try a different topic or check API key.");
      setGameState(GameState.IDLE);
    }
  }, [topic, gradeLevel]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startExhibit();
  };

  // Handle transition from practice to learning exhibit
  const handleLearnMoreFromPractice = useCallback((subject: string, practiceLevelGrade: GradeLevel) => {
    setShowPracticeMode(false);
    setGradeLevel(practiceLevelGrade);

    // Map subject to a topic string for exhibit generation
    const subjectTopicMap: Record<string, string> = {
      'mathematics': 'Mathematics',
      'science': 'Science',
      'language-arts': 'Language Arts',
      'social-studies': 'Social Studies',
      'reading': 'Reading',
      'writing': 'Writing'
    };

    const exhibitTopic = subjectTopicMap[subject] || subject;
    startExhibit(exhibitTopic);
  }, [startExhibit]);

  const reset = () => {
    setGameState(GameState.IDLE);
    setTopic('');
    setExhibitData(null);
    setShowManifestViewer(false);
    setManifest(null);
    setCuratorBrief(null);
  };

  const generateManifest = useCallback(async () => {
    if (!topic.trim()) return;

    setIsGeneratingManifest(true);
    setShowManifestViewer(true);
    setManifest(null);

    try {
      const generatedManifest = await generateExhibitManifest(topic, gradeLevel);
      setManifest(generatedManifest);
    } catch (error) {
      console.error('Manifest generation error:', error);
      alert('Failed to generate manifest. Please try again.');
      setShowManifestViewer(false);
    } finally {
      setIsGeneratingManifest(false);
    }
  }, [topic, gradeLevel]);

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
        contextTopic={exhibitData?.topic || ''}
        itemName={selectedDetailItem}
      />

      {/* Dynamic Background */}
      <GenerativeBackground 
        color={exhibitData?.cards[0]?.themeColor || '#475569'} 
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
        <div className="flex gap-4 text-xs md:text-sm font-mono text-slate-400">
            {gameState === GameState.PLAYING && (
                <button onClick={reset} className="hover:text-white transition-colors">
                   ← New Topic
                </button>
            )}
            {showVisualTester && (
                <button onClick={() => setShowVisualTester(false)} className="hover:text-white transition-colors">
                   ← Exit Tester
                </button>
            )}
            {showKnowledgeCheckTester && (
                <button onClick={() => setShowKnowledgeCheckTester(false)} className="hover:text-white transition-colors">
                   ← Exit Tester
                </button>
            )}
            {showMediaPlayerTester && (
                <button onClick={() => setShowMediaPlayerTester(false)} className="hover:text-white transition-colors">
                   ← Exit Tester
                </button>
            )}
            {showMathPrimitivesTester && (
                <button onClick={() => setShowMathPrimitivesTester(false)} className="hover:text-white transition-colors">
                   ← Exit Tester
                </button>
            )}
            {showEngineeringPrimitivesTester && (
                <button onClick={() => setShowEngineeringPrimitivesTester(false)} className="hover:text-white transition-colors">
                   ← Exit Tester
                </button>
            )}
            {showFeatureExhibitTester && (
                <button onClick={() => setShowFeatureExhibitTester(false)} className="hover:text-white transition-colors">
                   ← Exit Tester
                </button>
            )}
            {showPracticeMode && (
                <button onClick={() => setShowPracticeMode(false)} className="hover:text-white transition-colors">
                   ← Exit Practice
                </button>
            )}
            {showScratchPad && (
                <button onClick={() => setShowScratchPad(false)} className="hover:text-white transition-colors">
                   ← Exit Scratch Pad
                </button>
            )}
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 min-h-screen flex flex-col pt-24 pb-12">
        
        {/* IDLE STATE */}
        {gameState === GameState.IDLE && !showManifestViewer && !showVisualTester && !showKnowledgeCheckTester && !showMediaPlayerTester && !showMathPrimitivesTester && !showEngineeringPrimitivesTester && !showFeatureExhibitTester && !showPracticeMode && !showScratchPad && (
          <div className="flex-1 flex flex-col justify-center items-center text-center animate-fade-in">
             <div className="space-y-6 max-w-2xl">
                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-slate-500">
                    What will you learn?
                </h1>
                <p className="text-slate-400 text-xl md:text-2xl font-light leading-relaxed">
                    Enter any topic to generate an interactive museum exhibit.
                </p>

                {/* Grade Level Selector */}
                <div className="max-w-md mx-auto mt-8">
                  <label className="block text-sm font-medium text-slate-400 mb-2 text-center">
                    Learning Level
                  </label>
                  <GradeLevelSelector
                    value={gradeLevel}
                    onChange={setGradeLevel}
                  />
                </div>

                <form onSubmit={handleFormSubmit} className="relative group max-w-lg mx-auto mt-8">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. Quantum Mechanics, The Roman Empire, Jazz..."
                            className="w-full px-8 py-5 bg-slate-900 text-white rounded-full border border-slate-700 focus:border-blue-400/50 focus:outline-none text-lg shadow-2xl transition-all"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="absolute right-2 p-3 bg-white text-slate-900 rounded-full hover:bg-blue-50 transition-transform active:scale-95 disabled:opacity-50"
                            disabled={!topic}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>
                </form>

                {/* Suggested Topics - Card Style */}
                <div className="pt-8 max-w-5xl mx-auto">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                        <span className="text-slate-500 text-xs font-mono uppercase tracking-widest">Popular Topics</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { topic: 'Industrial Revolution', icon: '⚙️', color: '250, 204, 21', description: 'Explore the transformation of manufacturing and society' },
                            { topic: 'Botany', icon: '🌿', color: '74, 222, 128', description: 'Discover the science of plants and their ecosystems' },
                            { topic: 'Cubism', icon: '🎨', color: '192, 132, 252', description: 'Learn about geometric abstraction in modern art' },
                            { topic: 'Black Holes', icon: '🌌', color: '56, 189, 248', description: 'Journey into the mysteries of spacetime' }
                        ].map(({ topic: suggestion, icon, color, description }) => (
                            <SpotlightCard
                                key={suggestion}
                                color={color}
                                onClick={() => { setTopic(suggestion); startExhibit(suggestion); }}
                                className="bg-slate-900/40"
                            >
                                <div className="p-5 flex flex-col items-center text-center gap-3">
                                    <div className="text-4xl">{icon}</div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-1 group-hover:text-blue-200 transition-colors">
                                            {suggestion}
                                        </h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            {description}
                                        </p>
                                    </div>
                                </div>
                            </SpotlightCard>
                        ))}
                    </div>
                </div>

                {/* Main Actions Section */}
                <div className="pt-8 max-w-2xl mx-auto">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                    <span className="text-slate-500 text-xs font-mono uppercase tracking-widest">Quick Start</span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                  </div>

                  {/* Quick Start Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Practice Mode Button */}
                    <SpotlightCard
                      color="74, 222, 128"
                      onClick={() => setShowPracticeMode(true)}
                      className="bg-gradient-to-br from-green-900/20 to-emerald-900/20"
                    >
                      <div className="p-6 flex items-start gap-4">
                        <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <span className="text-2xl">🎯</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-1 group-hover:text-green-200 transition-colors">
                            Practice Session
                          </h3>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            Auto-generated questions tailored to your subject and grade level
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-slate-600 group-hover:text-green-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                      </div>
                    </SpotlightCard>

                    {/* Scratch Pad Button */}
                    <SpotlightCard
                      color="168, 85, 247"
                      onClick={() => setShowScratchPad(true)}
                      className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20"
                    >
                      <div className="p-6 flex items-start gap-4">
                        <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <span className="text-2xl">✏️</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-200 transition-colors">
                            Scratch Pad
                          </h3>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            AI-powered whiteboard with real-time feedback on your work
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                      </div>
                    </SpotlightCard>
                  </div>

                  {/* Developer Tools Section */}
                  <div className="pt-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                      <span className="text-slate-500 text-xs font-mono uppercase tracking-widest">Developer Tools</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Media Player Tester */}
                      <SpotlightCard
                        color="139, 92, 246"
                        onClick={() => setShowMediaPlayerTester(true)}
                        className="bg-gradient-to-br from-purple-900/20 to-violet-900/20"
                      >
                        <div className="p-6 flex items-start gap-4">
                          <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <span className="text-2xl">🎬</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-200 transition-colors">
                              Media Player Tester
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              Test audio-visual lesson generation with AI narration and images
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                          </svg>
                        </div>
                      </SpotlightCard>

                      {/* Knowledge Check Tester */}
                      <SpotlightCard
                        color="59, 130, 246"
                        onClick={() => setShowKnowledgeCheckTester(true)}
                        className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20"
                      >
                        <div className="p-6 flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <span className="text-2xl">📝</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-200 transition-colors">
                              Knowledge Check Tester
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              Test AI-generated assessment problems across multiple formats
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                          </svg>
                        </div>
                      </SpotlightCard>

                      {/* Math Primitives Tester */}
                      <SpotlightCard
                        color="236, 72, 153"
                        onClick={() => setShowMathPrimitivesTester(true)}
                        className="bg-gradient-to-br from-pink-900/20 to-rose-900/20"
                      >
                        <div className="p-6 flex items-start gap-4">
                          <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <span className="text-2xl">🧮</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-pink-200 transition-colors">
                              Math Primitives Tester
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              Test and configure visual math components like fraction bars and place value charts
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-pink-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                          </svg>
                        </div>
                      </SpotlightCard>

                      {/* Engineering Primitives Tester */}
                      <SpotlightCard
                        color="249, 115, 22"
                        onClick={() => setShowEngineeringPrimitivesTester(true)}
                        className="bg-gradient-to-br from-orange-900/20 to-red-900/20"
                      >
                        <div className="p-6 flex items-start gap-4">
                          <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <span className="text-2xl">⚙️</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-orange-200 transition-colors">
                              Engineering Primitives Tester
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              Test lever labs, pulley systems, and other simple machine components
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-orange-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                          </svg>
                        </div>
                      </SpotlightCard>

                      {/* Feature Exhibit Tester */}
                      <SpotlightCard
                        color="14, 165, 233"
                        onClick={() => setShowFeatureExhibitTester(true)}
                        className="bg-gradient-to-br from-sky-900/20 to-blue-900/20"
                      >
                        <div className="p-6 flex items-start gap-4">
                          <div className="w-12 h-12 bg-sky-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <span className="text-2xl">📰</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-sky-200 transition-colors">
                              Feature Exhibit Tester
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              Test deep-dive editorial content with 3-phase comprehension evaluation
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-sky-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                          </svg>
                        </div>
                      </SpotlightCard>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* MANIFEST VIEWER STATE */}
        {gameState === GameState.IDLE && showManifestViewer && (
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
        {gameState === GameState.IDLE && showKnowledgeCheckTester && (
          <div className="flex-1 animate-fade-in">
            <KnowledgeCheckTester onBack={() => setShowKnowledgeCheckTester(false)} />
          </div>
        )}

        {/* MEDIA PLAYER TESTER STATE */}
        {gameState === GameState.IDLE && showMediaPlayerTester && (
          <div className="flex-1 animate-fade-in">
            <MediaPlayerTester onBack={() => setShowMediaPlayerTester(false)} />
          </div>
        )}

        {/* MATH PRIMITIVES TESTER STATE */}
        {gameState === GameState.IDLE && showMathPrimitivesTester && (
          <div className="flex-1 animate-fade-in">
            <MathPrimitivesTester onBack={() => setShowMathPrimitivesTester(false)} />
          </div>
        )}

        {/* ENGINEERING PRIMITIVES TESTER STATE */}
        {gameState === GameState.IDLE && showEngineeringPrimitivesTester && (
          <div className="flex-1 animate-fade-in">
            <EngineeringPrimitivesTester onBack={() => setShowEngineeringPrimitivesTester(false)} />
          </div>
        )}

        {/* FEATURE EXHIBIT TESTER STATE */}
        {gameState === GameState.IDLE && showFeatureExhibitTester && (
          <div className="flex-1 animate-fade-in">
            <FeatureExhibitTester onBack={() => setShowFeatureExhibitTester(false)} />
          </div>
        )}

        {/* PRACTICE MODE STATE */}
        {gameState === GameState.IDLE && showPracticeMode && (
          <div className="flex-1 animate-fade-in">
            <PracticeMode
              onBack={() => setShowPracticeMode(false)}
              onLearnMore={handleLearnMoreFromPractice}
            />
          </div>
        )}

        {/* SCRATCH PAD STATE */}
        {gameState === GameState.IDLE && showScratchPad && (
          <div className="flex-1 animate-fade-in">
            <ScratchPad
              onBack={() => setShowScratchPad(false)}
              gradeLevel={gradeLevel}
            />
          </div>
        )}

        {/* VISUAL PRIMITIVES TESTER STATE */}
        {gameState === GameState.IDLE && showVisualTester && (
          <div className="flex-1 animate-fade-in">
            {/* Header with back button */}
            <div className="mb-8 text-center">
              <button
                onClick={() => setShowVisualTester(false)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Home
              </button>
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-2">Visual Primitives Gallery</h2>
              <p className="text-slate-400">Preview all early learning visual components</p>
            </div>

            {/* Navigation Controls */}
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

            {/* Quick Jump Buttons */}
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

            {/* Current Visual Component Display */}
            <div className="max-w-5xl mx-auto">
              {visualPrimitiveExamples[currentVisualIndex].component}
            </div>
          </div>
        )}

        {/* GENERATING STATE */}
        {gameState === GameState.GENERATING && (
            <div className="flex-1 flex flex-col justify-center items-center text-center">
                <div className="relative w-32 h-32 mb-8">
                    <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                    <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin shadow-[0_0_30px_rgba(59,130,246,0.5)]"></div>
                    <div className="absolute inset-4 border-t-4 border-purple-500 rounded-full animate-spin direction-reverse shadow-[0_0_30px_rgba(168,85,247,0.5)]" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
                </div>
                <h3 className="text-2xl font-bold text-white animate-pulse">{loadingMessage}</h3>
                <p className="text-slate-500 mt-2 font-mono text-sm">Generative AI is curating...</p>
                <div className="mt-4 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
                  <span className="text-xs text-slate-400">
                    Tailoring for: <span className="text-blue-400 font-medium capitalize">{gradeLevel.replace('-', ' ')}</span>
                  </span>
                </div>

                {/* Objectives Display - Show after curator brief is generated */}
                {curatorBrief && curatorBrief.objectives && (
                  <div className="mt-12 w-full px-4">
                    <ObjectivesViewer
                      objectives={curatorBrief.objectives}
                      topic={curatorBrief.topic}
                    />
                  </div>
                )}

                {/* Component Build Progress */}
                {componentStatuses.length > 0 && (
                  <div className="mt-8 w-full px-4">
                    <ComponentViewer components={componentStatuses} />
                  </div>
                )}

                {/* AI Thinking Display */}
                {thinkingMessages.length > 0 && (
                  <div className="mt-8 max-w-2xl w-full px-4">
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">AI Thinking</span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {thinkingMessages.map((thought, index) => (
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
        {gameState === GameState.PLAYING && exhibitData && (
            <EvaluationProvider
                sessionId={`exhibit-${Date.now()}`}
                exhibitId={exhibitData.topic || 'unknown'}
                localOnly={true}
                onCompetencyUpdate={(updates) => {
                    console.log('Competency updates:', updates);
                }}
            >
                <ExhibitProvider
                    objectives={exhibitData.introBriefing?.objectives || []}
                    manifestItems={exhibitData.manifest?.layout || []}
                >
                    <div className="w-full animate-fade-in-up">
                    {/* Title Section */}
                    <div className="mb-12 text-center space-y-4">
                        <h2 className="text-5xl font-bold text-white tracking-tight">{exhibitData.topic}</h2>
                        <div className="max-w-4xl mx-auto">
                            <CuratorBrief
                                data={exhibitData.introBriefing || exhibitData.intro}
                            />
                        </div>
                    </div>

                {/* Manifest-Ordered Components - Renders all components in the order defined by the manifest */}
                <ManifestOrderRenderer
                    orderedComponents={exhibitData.orderedComponents || []}
                    onDetailItemClick={handleDetailItemClick}
                    onTermClick={handleDetailItemClick}
                />

                {/* Evaluation Results Indicator */}
                <EvaluationResultsIndicator />

                {/* Related Topics */}
                {exhibitData.relatedTopics && exhibitData.relatedTopics.length > 0 && (
                    <div className="mt-24 mb-12 max-w-5xl mx-auto">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                            <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">Related Exhibits</span>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {exhibitData.relatedTopics.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => startExhibit(item.topic)}
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
            </ExhibitProvider>
            </EvaluationProvider>
        )}

      </main>

      {/* Voice Curator - Available during exhibit viewing */}
      {gameState === GameState.PLAYING && exhibitData && (
        <LiveAssistant
            exhibitData={exhibitData}
        />
      )}
    </div>
  );
}
