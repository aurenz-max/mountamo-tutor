'use client';

import React, { useState } from 'react';
import SolarSystemExplorer from '../primitives/visual-primitives/astronomy/SolarSystemExplorer';
import ScaleComparator from '../primitives/visual-primitives/astronomy/ScaleComparator';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';

interface AstronomyPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'solar-system-explorer' | 'scale-comparator';
type GradeLevel = 'K' | '1' | '2' | '3' | '4' | '5';

const PRIMITIVE_OPTIONS: Array<{ value: PrimitiveType; label: string; icon: string; topic: string }> = [
  { value: 'solar-system-explorer', label: 'Solar System', icon: '🪐', topic: 'Exploring our solar system' },
  { value: 'scale-comparator', label: 'Scale Comparator', icon: '📏', topic: 'Understanding cosmic scales' },
];

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'K', label: 'Kindergarten' },
  { value: '1', label: 'Grade 1' },
  { value: '2', label: 'Grade 2' },
  { value: '3', label: 'Grade 3' },
  { value: '4', label: 'Grade 4' },
  { value: '5', label: 'Grade 5' },
];

// Dynamic renderer that maps componentId to the appropriate primitive component
const PrimitiveRenderer: React.FC<{
  componentId: PrimitiveType;
  data: unknown;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}> = ({ componentId, data, onEvaluationSubmit }) => {
  if (!data) return null;

  switch (componentId) {
    case 'solar-system-explorer':
      return (
        <SolarSystemExplorer
          data={{
            ...(data as Parameters<typeof SolarSystemExplorer>[0]['data']),
          }}
        />
      );
    case 'scale-comparator':
      return (
        <ScaleComparator
          data={{
            ...(data as Parameters<typeof ScaleComparator>[0]['data']),
            onEvaluationSubmit,
          }}
        />
      );
    default:
      return <div className="text-slate-400">Unknown primitive: {componentId}</div>;
  }
};

// Evaluation Results Panel - Shows submitted results from the session
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

      {/* Session Summary */}
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

      {/* Pending Submissions */}
      {pendingSubmissions.length > 0 && (
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <p className="text-amber-400 text-xs">
            {pendingSubmissions.length} evaluation(s) pending sync...
          </p>
        </div>
      )}

      {/* Recent Results */}
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
                {result.feedback && (
                  <p className="text-xs text-slate-400 mt-1">{result.feedback}</p>
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

// Main component with content generation
const AstronomyPrimitivesTesterContent: React.FC<AstronomyPrimitivesTesterProps> = ({ onBack }) => {
  const context = useEvaluationContext();
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('solar-system-explorer');
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
      const currentTopic = topic || selectedOption?.topic || 'Understanding astronomy';
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

  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    if (context) {
      context.submitEvaluation(result);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
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
              <span>🪐</span>
              <span>Astronomy Primitives Tester</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Main Layout - Compact Left Sidebar */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Compact Left Panel */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-4">
            {/* Primitive Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Primitive
              </label>
              <div className="space-y-1">
                {PRIMITIVE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedPrimitive(option.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                      selectedPrimitive === option.value
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{option.icon}</span>
                      <span className="text-sm font-medium">{option.label}</span>
                    </div>
                  </button>
                ))}
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
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
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

            {/* Evaluation Results (Compact) */}
            <div className="pt-4 border-t border-slate-700">
              <EvaluationResultsPanel />
            </div>
          </div>
        </div>

        {/* Main Content Area - Large Primitive Display */}
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
                  <div className="text-6xl mb-4">🪐</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Welcome to Astronomy Primitives
                  </h3>
                  <p className="text-slate-400 max-w-md">
                    Select a primitive, choose a grade level, and click Generate to explore
                    interactive astronomy visualizations.
                  </p>
                </div>
              </div>
            )}

            {generatedData && (
              <div className="space-y-6">
                <PrimitiveRenderer
                  componentId={selectedPrimitive}
                  data={generatedData}
                  onEvaluationSubmit={handleEvaluationSubmit}
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
const AstronomyPrimitivesTester: React.FC<AstronomyPrimitivesTesterProps> = (props) => {
  return (
    <EvaluationProvider>
      <AstronomyPrimitivesTesterContent {...props} />
    </EvaluationProvider>
  );
};

export default AstronomyPrimitivesTester;
