'use client';

import React, { useState } from 'react';
import { getPrimitive } from '../config/primitiveRegistry';
import type { FeatureExhibitData } from '../service/feature-exhibit/gemini-feature-exhibit';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';

interface FeatureExhibitTesterProps {
  onBack: () => void;
}

type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'toddler', label: 'Toddler' },
  { value: 'preschool', label: 'Preschool' },
  { value: 'kindergarten', label: 'Kindergarten' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'middle-school', label: 'Middle School' },
  { value: 'high-school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'phd', label: 'PhD' },
];

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
                {/* Show FeatureExhibit-specific metrics */}
                {result.metrics.type === 'feature-exhibit' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Explore: {result.metrics.exploreIsCorrect ? '✓' : '✗'}</span>
                    <span>Evidence: {Math.round(result.metrics.evidenceMatchingAccuracy)}%</span>
                    <span>Synthesis: {result.metrics.synthesisIsCorrect ? '✓' : '✗'}</span>
                    <span>Overall: {Math.round(result.metrics.overallAccuracy)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {submittedResults.length === 0 && pendingSubmissions.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-4">
          No evaluations yet. Complete all three phases to see results!
        </p>
      )}
    </div>
  );
};

// Inner component that uses the evaluation context
const FeatureExhibitTesterInner: React.FC<FeatureExhibitTesterProps> = ({ onBack }) => {
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<FeatureExhibitData | null>(null);
  const [lastEvaluationResult, setLastEvaluationResult] = useState<PrimitiveEvaluationResult | null>(null);

  const evaluationContext = useEvaluationContext();

  // Get the FeatureExhibit component from the registry
  const primitiveConfig = getPrimitive('feature-exhibit');
  const FeatureExhibitComponent = primitiveConfig?.component;

  // Callback when an evaluation is submitted
  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    console.log('Evaluation submitted:', result);
    setLastEvaluationResult(result);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Use the API route to generate the feature exhibit
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: 'feature-exhibit',
            topic: topic,
            gradeLevel: gradeLevel,
            config: {
              intent: 'Provide comprehensive exploration of the topic with 3-phase evaluation',
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
      setError(err instanceof Error ? err.message : 'Failed to generate feature exhibit');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTermClick = (term: string) => {
    console.log('Term clicked:', term);
    // In a real app, this would open a detail drawer or new exhibit
    alert(`Would open exhibit for: ${term}`);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-4 text-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-1">Feature Exhibit Tester</h2>
        <p className="text-sm text-slate-400">AI-generated deep-dive content with 3-phase comprehension evaluation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4 px-4">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 h-fit">
          <h3 className="text-xl font-bold text-white mb-4">Generate</h3>

          {/* Topic Input */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-300 mb-1">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. dinosaurs..."
              className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleGenerate();
                }
              }}
            />
          </div>

          {/* Grade Level */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-300 mb-1">Grade Level</label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
              className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              {GRADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
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
            disabled={isGenerating || !topic.trim()}
            className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <span>✨</span>
                Generate Feature Exhibit
              </>
            )}
          </button>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 className="text-xs font-bold text-blue-300 mb-1">3-Phase Evaluation</h4>
            <ul className="text-[10px] text-slate-400 space-y-0.5">
              <li>• <strong>Explore:</strong> True/False</li>
              <li>• <strong>Practice:</strong> Match evidence</li>
              <li>• <strong>Apply:</strong> Synthesis</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Preview (Full Width) */}
        <div className="flex flex-col gap-4">
          {/* Preview Area */}
          <div className="flex-1 bg-slate-800/50 rounded-2xl p-4 border border-slate-700 min-h-[calc(100vh-200px)]">
            {generatedData && FeatureExhibitComponent ? (
              <div className="bg-slate-900/50 rounded-xl overflow-hidden h-full">
                <FeatureExhibitComponent
                  data={{
                    ...generatedData,
                    // Inject evaluation props using ManifestOrderRenderer pattern
                    instanceId: `feature-exhibit-${Date.now()}`,
                    exhibitId: evaluationContext?.exhibitId,
                    skillId: 'reading-comprehension',
                    subskillId: 'deep-reading',
                    objectiveId: 'synthesize-information',
                    onEvaluationSubmit: handleEvaluationSubmit,
                  }}
                  onTermClick={handleTermClick}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <span className="text-6xl mb-4">📰</span>
                <p className="text-center">Enter a topic and click "Generate" to create a feature exhibit</p>
                <p className="text-xs text-slate-600 mt-2">Complete all 3 phases to see evaluation results</p>
              </div>
            )}
          </div>

          {/* Evaluation Results - Below Preview */}
          <div className="space-y-4">
            <EvaluationResultsPanel />

            {/* Last Result Quick View */}
            {lastEvaluationResult && (
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Last Evaluation (Raw JSON)</h4>
                <pre className="text-xs text-slate-400 overflow-auto max-h-48 bg-slate-900/50 p-3 rounded-lg">
                  {JSON.stringify(lastEvaluationResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main export - wraps with EvaluationProvider for tracking
export const FeatureExhibitTester: React.FC<FeatureExhibitTesterProps> = (props) => {
  return (
    <EvaluationProvider
      sessionId={`feature-exhibit-tester-${Date.now()}`}
      exhibitId="feature-exhibit-tester"
      // In production, pass actual studentId from auth context
      // studentId={currentUser?.studentId}
      onCompetencyUpdate={(updates) => {
        console.log('Competency updates received:', updates);
      }}
    >
      <FeatureExhibitTesterInner {...props} />
    </EvaluationProvider>
  );
};

export default FeatureExhibitTester;
