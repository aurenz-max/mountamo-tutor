'use client';

import React, { useState } from 'react';
// ============================================================================
// Primitive Imports — uncomment as each primitive is implemented
// ============================================================================
// RF: Reading Foundational Skills
// import PhonicsBlender from '../primitives/visual-primitives/literacy/PhonicsBlender';
// import DecodableReader from '../primitives/visual-primitives/literacy/DecodableReader';
// RL: Reading Literature
import StoryMap from '../primitives/visual-primitives/literacy/StoryMap';
// import CharacterWeb from '../primitives/visual-primitives/literacy/CharacterWeb';
// import PoetryLab from '../primitives/visual-primitives/literacy/PoetryLab';
// import GenreExplorer from '../primitives/visual-primitives/literacy/GenreExplorer';
// RI: Reading Informational Text
// import TextStructureAnalyzer from '../primitives/visual-primitives/literacy/TextStructureAnalyzer';
// import EvidenceFinder from '../primitives/visual-primitives/literacy/EvidenceFinder';
// W: Writing
import ParagraphArchitect from '../primitives/visual-primitives/literacy/ParagraphArchitect';
// import StoryPlanner from '../primitives/visual-primitives/literacy/StoryPlanner';
// import OpinionBuilder from '../primitives/visual-primitives/literacy/OpinionBuilder';
// import RevisionWorkshop from '../primitives/visual-primitives/literacy/RevisionWorkshop';
// SL: Speaking & Listening
import ListenAndRespond from '../primitives/visual-primitives/literacy/ListenAndRespond';
// import ReadAloudStudio from '../primitives/visual-primitives/literacy/ReadAloudStudio';
// L: Language
import SentenceBuilder from '../primitives/visual-primitives/literacy/SentenceBuilder';
// import ContextCluesDetective from '../primitives/visual-primitives/literacy/ContextCluesDetective';
// import FigurativeLanguageFinder from '../primitives/visual-primitives/literacy/FigurativeLanguageFinder';
// import SpellingPatternExplorer from '../primitives/visual-primitives/literacy/SpellingPatternExplorer';

import {
  EvaluationProvider,
  useEvaluationContext,
} from '../evaluation';

interface LanguageArtsPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType =
  | 'phonics-blender' | 'decodable-reader'
  | 'story-map' | 'character-web' | 'poetry-lab' | 'genre-explorer'
  | 'text-structure-analyzer' | 'evidence-finder'
  | 'paragraph-architect' | 'story-planner' | 'opinion-builder' | 'revision-workshop'
  | 'listen-and-respond' | 'read-aloud-studio'
  | 'sentence-builder' | 'context-clues-detective' | 'figurative-language-finder' | 'spelling-pattern-explorer';

type GradeLevel = 'K' | '1' | '2' | '3' | '4' | '5' | '6';

interface PrimitiveOption {
  value: PrimitiveType;
  label: string;
  icon: string;
  topic: string;
  strand: string;
  wave: number; // implementation priority wave from PRD
}

const PRIMITIVE_OPTIONS: PrimitiveOption[] = [
  // ===== RF: Reading Foundational Skills =====
  { value: 'phonics-blender', label: 'Phonics Blender', icon: '🔤', topic: 'CVC word building with phonemes', strand: 'RF', wave: 2 },
  { value: 'decodable-reader', label: 'Decodable Reader', icon: '📖', topic: 'Controlled-vocabulary reading passage', strand: 'RF', wave: 2 },
  // ===== RL: Reading Literature =====
  { value: 'story-map', label: 'Story Map', icon: '🗺️', topic: 'Plot structure of a short story', strand: 'RL', wave: 1 },
  { value: 'character-web', label: 'Character Web', icon: '🕸️', topic: 'Character analysis and relationships', strand: 'RL', wave: 3 },
  { value: 'poetry-lab', label: 'Poetry Lab', icon: '📝', topic: 'Analyzing a poem with figurative language', strand: 'RL', wave: 4 },
  { value: 'genre-explorer', label: 'Genre Explorer', icon: '📚', topic: 'Comparing fiction vs nonfiction', strand: 'RL', wave: 4 },
  // ===== RI: Reading Informational Text =====
  { value: 'text-structure-analyzer', label: 'Text Structure', icon: '🏗️', topic: 'Cause and effect in science text', strand: 'RI', wave: 3 },
  { value: 'evidence-finder', label: 'Evidence Finder', icon: '🔍', topic: 'Finding text evidence for claims', strand: 'RI', wave: 2 },
  // ===== W: Writing =====
  { value: 'paragraph-architect', label: 'Paragraph Architect', icon: '🍔', topic: 'Building an informational paragraph', strand: 'W', wave: 1 },
  { value: 'story-planner', label: 'Story Planner', icon: '✏️', topic: 'Planning a narrative story', strand: 'W', wave: 4 },
  { value: 'opinion-builder', label: 'Opinion Builder', icon: '💬', topic: 'Should students have recess every day?', strand: 'W', wave: 3 },
  { value: 'revision-workshop', label: 'Revision Workshop', icon: '🔧', topic: 'Strengthening word choice in a draft', strand: 'W', wave: 4 },
  // ===== SL: Speaking & Listening =====
  { value: 'listen-and-respond', label: 'Listen & Respond', icon: '🎧', topic: 'Listening comprehension of a story', strand: 'SL', wave: 1 },
  { value: 'read-aloud-studio', label: 'Read Aloud Studio', icon: '🎙️', topic: 'Fluency practice with model reading', strand: 'SL', wave: 4 },
  // ===== L: Language =====
  { value: 'sentence-builder', label: 'Sentence Builder', icon: '🧱', topic: 'Building compound sentences', strand: 'L', wave: 1 },
  { value: 'context-clues-detective', label: 'Context Clues', icon: '🕵️', topic: 'Determining word meaning from context', strand: 'L', wave: 2 },
  { value: 'figurative-language-finder', label: 'Figurative Language', icon: '🎨', topic: 'Finding similes and metaphors', strand: 'L', wave: 3 },
  { value: 'spelling-pattern-explorer', label: 'Spelling Patterns', icon: '🔠', topic: 'Silent-e spelling rule', strand: 'L', wave: 4 },
];

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'K', label: 'Kindergarten' },
  { value: '1', label: 'Grade 1' },
  { value: '2', label: 'Grade 2' },
  { value: '3', label: 'Grade 3' },
  { value: '4', label: 'Grade 4' },
  { value: '5', label: 'Grade 5' },
  { value: '6', label: 'Grade 6' },
];

const STRAND_LABELS: Record<string, { label: string; color: string }> = {
  RF: { label: 'Foundational Skills', color: 'text-rose-400' },
  RL: { label: 'Literature', color: 'text-violet-400' },
  RI: { label: 'Informational Text', color: 'text-cyan-400' },
  W: { label: 'Writing', color: 'text-emerald-400' },
  SL: { label: 'Speaking & Listening', color: 'text-amber-400' },
  L: { label: 'Language', color: 'text-blue-400' },
};

// Dynamic renderer — add cases as primitives are implemented
const PrimitiveRenderer: React.FC<{
  componentId: PrimitiveType;
  data: unknown;
}> = ({ componentId, data }) => {
  if (!data) return null;

  // Uncomment each case as the primitive component is built:
  switch (componentId) {
    // case 'phonics-blender':
    //   return <PhonicsBlender data={data as Parameters<typeof PhonicsBlender>[0]['data']} />;
    // case 'decodable-reader':
    //   return <DecodableReader data={data as Parameters<typeof DecodableReader>[0]['data']} />;
    case 'story-map':
      return <StoryMap data={data as Parameters<typeof StoryMap>[0]['data']} />;
    // case 'character-web':
    //   return <CharacterWeb data={data as Parameters<typeof CharacterWeb>[0]['data']} />;
    // case 'poetry-lab':
    //   return <PoetryLab data={data as Parameters<typeof PoetryLab>[0]['data']} />;
    // case 'genre-explorer':
    //   return <GenreExplorer data={data as Parameters<typeof GenreExplorer>[0]['data']} />;
    // case 'text-structure-analyzer':
    //   return <TextStructureAnalyzer data={data as Parameters<typeof TextStructureAnalyzer>[0]['data']} />;
    // case 'evidence-finder':
    //   return <EvidenceFinder data={data as Parameters<typeof EvidenceFinder>[0]['data']} />;
    case 'paragraph-architect':
      return <ParagraphArchitect data={data as Parameters<typeof ParagraphArchitect>[0]['data']} />;
    // case 'story-planner':
    //   return <StoryPlanner data={data as Parameters<typeof StoryPlanner>[0]['data']} />;
    // case 'opinion-builder':
    //   return <OpinionBuilder data={data as Parameters<typeof OpinionBuilder>[0]['data']} />;
    // case 'revision-workshop':
    //   return <RevisionWorkshop data={data as Parameters<typeof RevisionWorkshop>[0]['data']} />;
    case 'listen-and-respond':
      return <ListenAndRespond data={data as Parameters<typeof ListenAndRespond>[0]['data']} />;
    // case 'read-aloud-studio':
    //   return <ReadAloudStudio data={data as Parameters<typeof ReadAloudStudio>[0]['data']} />;
    case 'sentence-builder':
      return <SentenceBuilder data={data as Parameters<typeof SentenceBuilder>[0]['data']} />;
    // case 'context-clues-detective':
    //   return <ContextCluesDetective data={data as Parameters<typeof ContextCluesDetective>[0]['data']} />;
    // case 'figurative-language-finder':
    //   return <FigurativeLanguageFinder data={data as Parameters<typeof FigurativeLanguageFinder>[0]['data']} />;
    // case 'spelling-pattern-explorer':
    //   return <SpellingPatternExplorer data={data as Parameters<typeof SpellingPatternExplorer>[0]['data']} />;
    default:
      return (
        <div className="max-w-4xl mx-auto">
          <div className="backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-2xl shadow-2xl p-8">
            <div className="text-center space-y-4">
              <div className="text-5xl">{PRIMITIVE_OPTIONS.find(p => p.value === componentId)?.icon || '📝'}</div>
              <h3 className="text-xl font-semibold text-slate-100">
                {PRIMITIVE_OPTIONS.find(p => p.value === componentId)?.label || componentId}
              </h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                This primitive is ready to be built. See <code className="text-amber-300">PRD_LANGUAGE_ARTS_SUITE.md</code> for
                the full specification.
              </p>
              <div className="pt-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                  <span className="text-amber-300 text-xs font-medium">Wave {PRIMITIVE_OPTIONS.find(p => p.value === componentId)?.wave || '?'} Priority</span>
                </div>
              </div>
              {data && (
                <details className="text-left mt-6">
                  <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-300 transition-colors">
                    View generated JSON data
                  </summary>
                  <pre className="mt-2 p-4 bg-black/30 rounded-lg text-xs text-slate-400 overflow-auto max-h-96 border border-white/5">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
  }
};

// Evaluation Results Panel
const EvaluationResultsPanel: React.FC = () => {
  const context = useEvaluationContext();

  if (!context) {
    return (
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <p className="text-slate-500 text-sm">Evaluation tracking not available (no provider)</p>
      </div>
    );
  }

  const { submittedResults, pendingSubmissions, isOnline, getSessionSummary } = context;
  const summary = getSessionSummary();

  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">Evaluation Results</h4>
        <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
          isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{summary.totalAttempts}</div>
          <div className="text-xs text-slate-400">Attempts</div>
        </div>
        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-400">{summary.successfulAttempts}</div>
          <div className="text-xs text-slate-400">Successes</div>
        </div>
        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-amber-400">{Math.round(summary.averageScore)}%</div>
          <div className="text-xs text-slate-400">Avg Score</div>
        </div>
      </div>

      {pendingSubmissions.length > 0 && (
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <p className="text-amber-400 text-xs">
            {pendingSubmissions.length} evaluation(s) pending sync...
          </p>
        </div>
      )}

      {submittedResults.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-slate-300">Recent Results</h5>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {submittedResults.slice(-5).reverse().map((result) => (
              <div
                key={result.attemptId}
                className={`p-3 rounded-lg border ${
                  result.success
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${
                    result.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {result.success ? '✓ Success' : '✗ Incomplete'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {result.score}%
                  </span>
                </div>
                {result.metrics && 'type' in result.metrics && (
                  <p className="text-xs text-slate-400 mt-1">{result.metrics.type}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {submittedResults.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          No evaluation results yet. Complete a primitive activity to see results.
        </div>
      )}
    </div>
  );
};

// Main content component
const LanguageArtsPrimitivesTesterContent: React.FC<LanguageArtsPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('paragraph-architect');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('3');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedOption = PRIMITIVE_OPTIONS.find((p) => p.value === selectedPrimitive);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedData(null);

    try {
      const currentTopic = topic || selectedOption?.topic || 'Reading and writing';
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: selectedPrimitive,
            topic: currentTopic,
            gradeLevel: selectedGrade,
            config: {},
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate content');
      }

      const result = await response.json();
      setGeneratedData(result.data || result);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  // Group primitives by strand for the sidebar
  const strands = ['RF', 'RL', 'RI', 'W', 'SL', 'L'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>📚</span>
              <span>Language Arts Primitives Tester</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Compact Left Panel */}
        <div className="w-72 border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-4">
            {/* Primitive Selector grouped by strand */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Primitive
              </label>
              <div className="space-y-3">
                {strands.map((strand) => {
                  const strandPrimitives = PRIMITIVE_OPTIONS.filter(p => p.strand === strand);
                  const strandInfo = STRAND_LABELS[strand];
                  return (
                    <div key={strand}>
                      <div className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${strandInfo.color}`}>
                        {strand}: {strandInfo.label}
                      </div>
                      <div className="space-y-1">
                        {strandPrimitives.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSelectedPrimitive(option.value);
                              setGeneratedData(null);
                              setError(null);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                              selectedPrimitive === option.value
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{option.icon}</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium block truncate">{option.label}</span>
                              </div>
                              <span className="text-[9px] text-slate-500 font-mono">W{option.wave}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grade Level Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Grade Level
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value as GradeLevel)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Topic (optional)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={selectedOption?.topic || 'Enter topic...'}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                '✨ Generate Content'
              )}
            </button>

            {/* Evaluation Results */}
            <div className="pt-4 border-t border-slate-700">
              <EvaluationResultsPanel />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium">Error: {error}</p>
              </div>
            )}

            {!generatedData && !error && (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center">
                  <div className="text-6xl mb-4">📚</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    K-6 Language Arts Primitives
                  </h3>
                  <p className="text-slate-400 max-w-md mb-6">
                    Select a primitive from the sidebar, choose a grade level, and click Generate
                    to test interactive language arts components.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {strands.map((strand) => {
                      const info = STRAND_LABELS[strand];
                      const count = PRIMITIVE_OPTIONS.filter(p => p.strand === strand).length;
                      return (
                        <span key={strand} className={`text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 ${info.color}`}>
                          {strand}: {count} primitives
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {generatedData != null && (
              <div className="space-y-6">
                <PrimitiveRenderer
                  componentId={selectedPrimitive}
                  data={generatedData}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper with EvaluationProvider
const LanguageArtsPrimitivesTester: React.FC<LanguageArtsPrimitivesTesterProps> = (props) => {
  return (
    <EvaluationProvider>
      <LanguageArtsPrimitivesTesterContent {...props} />
    </EvaluationProvider>
  );
};

export default LanguageArtsPrimitivesTester;
