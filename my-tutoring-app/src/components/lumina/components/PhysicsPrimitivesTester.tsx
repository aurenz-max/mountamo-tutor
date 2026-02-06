'use client';

import React, { useState } from 'react';
import MotionDiagram from '../primitives/visual-primitives/physics/MotionDiagram';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';

interface PhysicsPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'motion-diagram';
type GradeLevel = '6' | '7' | '8' | '9' | '10' | '11' | '12';

const PRIMITIVE_OPTIONS: Array<{ value: PrimitiveType; label: string; icon: string; topic: string }> = [
  { value: 'motion-diagram', label: 'Motion Diagram', icon: '📍', topic: 'Understanding motion through position markers' },
];

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: '6', label: 'Grade 6 (Middle School)' },
  { value: '7', label: 'Grade 7 (Middle School)' },
  { value: '8', label: 'Grade 8 (Middle School)' },
  { value: '9', label: 'Grade 9 (High School)' },
  { value: '10', label: 'Grade 10 (High School)' },
  { value: '11', label: 'Grade 11 (AP Physics)' },
  { value: '12', label: 'Grade 12 (AP Physics)' },
];

// Dynamic renderer that maps componentId to the appropriate primitive component
const PrimitiveRenderer: React.FC<{
  componentId: PrimitiveType;
  data: unknown;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}> = ({ componentId, data, onEvaluationSubmit }) => {
  if (!data) return null;

  switch (componentId) {
    case 'motion-diagram':
      return (
        <MotionDiagram
          data={{
            ...(data as Parameters<typeof MotionDiagram>[0]['data']),
            // Evaluation integration props
            instanceId: `motion-diagram-${Date.now()}`,
            skillId: 'physics-kinematics',
            subskillId: 'motion-analysis',
            objectiveId: 'understand-velocity-acceleration',
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
                {/* Show MotionDiagram-specific metrics */}
                {result.metrics.type === 'motion-diagram' && (
                  <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                    <span>Motion: {result.metrics.motionType}</span>
                    <span>Correct: {result.metrics.motionTypeCorrect ? 'Yes' : 'No'}</span>
                    <span>Markers: {result.metrics.markersPlaced}</span>
                    <span>Uniform: {result.metrics.uniformMotion ? 'Yes' : 'No'}</span>
                    <span>Velocity Vectors: {result.metrics.velocityVectorsShown}</span>
                    <span>Accel Vectors: {result.metrics.accelerationVectorsShown}</span>
                    <span>Avg Velocity: {result.metrics.averageVelocity.toFixed(1)}</span>
                    <span>Avg Accel: {result.metrics.averageAcceleration.toFixed(1)}</span>
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

// Inner component that uses the evaluation context
const PhysicsPrimitivesTesterInner: React.FC<PhysicsPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('motion-diagram');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<unknown>(null);
  const [lastEvaluationResult, setLastEvaluationResult] = useState<PrimitiveEvaluationResult | null>(null);

  const selectedOption = PRIMITIVE_OPTIONS.find(p => p.value === selectedPrimitive)!;

  // Callback when an evaluation is submitted
  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    console.log('Evaluation submitted:', result);
    setLastEvaluationResult(result);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: selectedPrimitive,
            topic: selectedOption.topic,
            gradeLevel,
            config: {},
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
      setError(err instanceof Error ? err.message : 'Failed to generate primitive');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 text-center">
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
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2">Physics Primitives Tester</h2>
        <p className="text-slate-400">AI-generated physics visualizations for Middle School - High School</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto px-4">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 h-fit">
          <h3 className="text-2xl font-bold text-white mb-6">Generate</h3>

          {/* Primitive Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">Select Primitive</label>
            <div className="grid grid-cols-1 gap-2">
              {PRIMITIVE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedPrimitive(option.value);
                    setGeneratedData(null);
                  }}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedPrimitive === option.value
                      ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option.icon}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Grade Level */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Grade Level</label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
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
            disabled={isGenerating}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
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
            Gemini will generate a {selectedOption.label.toLowerCase()} appropriate for grade {gradeLevel}
          </p>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">Preview</h3>

          {generatedData ? (
            <PrimitiveRenderer
              componentId={selectedPrimitive}
              data={generatedData}
              onEvaluationSubmit={handleEvaluationSubmit}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <span className="text-4xl mb-4">{selectedOption.icon}</span>
              <p>Click "Generate with AI" to create a {selectedOption.label.toLowerCase()}</p>
            </div>
          )}
        </div>

        {/* Evaluation Results Panel - Third Column */}
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
export const PhysicsPrimitivesTester: React.FC<PhysicsPrimitivesTesterProps> = (props) => {
  return (
    <EvaluationProvider
      sessionId={`physics-tester-${Date.now()}`}
      exhibitId="physics-primitives-tester"
      onCompetencyUpdate={(updates) => {
        console.log('Competency updates received:', updates);
      }}
    >
      <PhysicsPrimitivesTesterInner {...props} />
    </EvaluationProvider>
  );
};

export default PhysicsPrimitivesTester;
