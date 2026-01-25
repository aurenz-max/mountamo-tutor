'use client';

import React, { useState } from 'react';
import ImagePanel from '@/components/lumina/primitives/ImagePanel';
import type { ImagePanelData } from '@/components/lumina/primitives/ImagePanel';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '@/components/lumina/evaluation';
import { SAMPLE_DATASETS, getAvailableDatasets } from '@/components/lumina/test-data/image-panel-samples';

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
                  <span className="text-sm font-medium text-white">
                    {result.primitiveType}
                  </span>
                  <span className={`text-sm font-bold ${
                    result.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {Math.round(result.score)}%
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Duration: {Math.round(result.durationMs / 1000)}s
                  {result.success ? ' • Passed!' : ' • Try again'}
                </div>
                {/* Show ImagePanel-specific metrics */}
                {result.metrics.type === 'image-panel' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Correct: {result.metrics.correctAnnotations}/{result.metrics.totalAnnotations}</span>
                    <span>Accuracy: {Math.round(result.metrics.annotationAccuracy)}%</span>
                    <span>Proximity: {Math.round(result.metrics.averageProximityScore)}</span>
                    <span>All Placed: {result.metrics.allAnnotationsPlaced ? 'Yes' : 'No'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {submittedResults.length === 0 && pendingSubmissions.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-4">
          No evaluations yet. Complete a challenge to see results!
        </p>
      )}
    </div>
  );
};

interface TestImagePanelPageInnerProps {}

const TestImagePanelPageInner: React.FC<TestImagePanelPageInnerProps> = () => {
  const [selectedDataset, setSelectedDataset] = useState<string>('trex');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<ImagePanelData | null>(null);
  const [lastEvaluationResult, setLastEvaluationResult] = useState<PrimitiveEvaluationResult | null>(null);

  const currentData = SAMPLE_DATASETS[selectedDataset as keyof typeof SAMPLE_DATASETS];

  // Callback when an evaluation is submitted
  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    console.log('Evaluation submitted:', result);
    setLastEvaluationResult(result);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedData(null);

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: 'image-panel',
            topic: 'Anatomy of a Tyrannosaurus Rex',
            gradeLevel: 'elementary',
            config: {
              category: 'science',
              interactionMode: 'identify',
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      setGeneratedData(result.data || result);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate image panel');
    } finally {
      setIsGenerating(false);
    }
  };

  // Use generated data if available, otherwise use sample data with evaluation props
  const displayData: ImagePanelData = generatedData || {
    ...currentData,
    // Add evaluation props for the primitive
    instanceId: `image-panel-${Date.now()}`,
    skillId: 'science-anatomy',
    subskillId: 'identify-features',
    objectiveId: 'understand-anatomy',
    onEvaluationSubmit: handleEvaluationSubmit,
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-4xl font-bold text-white mb-2">Image Panel Tester</h2>
        <p className="text-slate-400">AI-powered image annotation and evaluation system</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto px-4">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 h-fit">
          <h3 className="text-2xl font-bold text-white mb-6">Controls</h3>

          {/* Dataset Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">Select Sample Dataset</label>
            <div className="grid grid-cols-1 gap-2">
              {getAvailableDatasets().map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDataset(key);
                    setGeneratedData(null);
                  }}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedDataset === key
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <span className="text-sm font-medium">
                    {SAMPLE_DATASETS[key as keyof typeof SAMPLE_DATASETS].title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <span>✨</span>
                Generate with AI
              </>
            )}
          </button>

          {/* Info */}
          <p className="mt-4 text-xs text-slate-500 text-center">
            AI will generate an interactive image panel with annotations
          </p>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">Preview</h3>

          <ImagePanel data={displayData} />
        </div>

        {/* Evaluation Results Panel - Full Width Below */}
        <div className="lg:col-span-2">
          <EvaluationResultsPanel />

          {/* Last Result Quick View */}
          {lastEvaluationResult && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Last Evaluation (Raw JSON)</h4>
              <pre className="text-xs text-slate-400 overflow-auto max-h-48 bg-slate-900/50 p-3 rounded-lg">
                {JSON.stringify(lastEvaluationResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main export - wraps with EvaluationProvider for tracking
export default function TestImagePanelPage() {
  return (
    <EvaluationProvider
      sessionId={`image-panel-tester-${Date.now()}`}
      exhibitId="image-panel-tester"
      // In production, pass actual studentId from auth context
      // studentId={currentUser?.studentId}
      onCompetencyUpdate={(updates) => {
        console.log('Competency updates received:', updates);
      }}
    >
      <TestImagePanelPageInner />
    </EvaluationProvider>
  );
}
