'use client';

import React, { useState } from 'react';
import { AnnotatedExample } from '../primitives/AnnotatedExample';
import { EvaluationProvider, useEvaluationContext } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import type { RichAnnotatedExampleData, StepType } from '../primitives/annotated-example/types';

interface AnnotatedExampleTesterProps {
  onBack: () => void;
}

type GradeLevel = 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate';

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'elementary', label: 'Elementary' },
  { value: 'middle-school', label: 'Middle School' },
  { value: 'high-school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
];

const EXAMPLE_TOPICS = [
  { label: 'Solve 2x + 5 = 13', subject: 'Algebra' },
  { label: 'Integrate x² sin(x) by parts', subject: 'Calculus' },
  { label: 'Find eigenvalues of a 3x3 matrix', subject: 'Linear Algebra' },
  { label: 'Solve |2x - 3| > 5', subject: 'Algebra' },
  { label: 'Newton\'s Second Law: inclined plane with friction', subject: 'Physics' },
  { label: 'Prove √2 is irrational', subject: 'Proof' },
  { label: 'Find area between y = x² and y = 2x', subject: 'Calculus' },
  { label: 'Factor x³ - 8', subject: 'Algebra' },
  { label: 'Compound interest with continuous compounding', subject: 'Finance' },
  { label: 'Bayes theorem: medical testing', subject: 'Probability' },
];

const STEP_TYPE_COLORS: Record<StepType, string> = {
  algebra: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  substitution: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  table: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  diagram: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'graph-sketch': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  'case-split': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  verification: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

// ── Evaluation Results Panel ─────────────────────────────────────────

const EvaluationResultsPanel: React.FC = () => {
  const context = useEvaluationContext();

  if (!context) {
    return (
      <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <p className="text-slate-500 text-xs">No evaluation context</p>
      </div>
    );
  }

  const { submittedResults, getSessionSummary } = context;
  const summary = getSessionSummary();

  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3">
      <h4 className="text-sm font-semibold text-white">Evaluation</h4>
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-slate-700/50 rounded-lg text-center">
          <div className="text-lg font-bold text-white">{summary.totalAttempts}</div>
          <div className="text-[10px] text-slate-400">Attempts</div>
        </div>
        <div className="p-2 bg-slate-700/50 rounded-lg text-center">
          <div className="text-lg font-bold text-green-400">{summary.successfulAttempts}</div>
          <div className="text-[10px] text-slate-400">Success</div>
        </div>
        <div className="p-2 bg-slate-700/50 rounded-lg text-center">
          <div className="text-lg font-bold text-amber-400">{Math.round(summary.averageScore)}%</div>
          <div className="text-[10px] text-slate-400">Avg</div>
        </div>
      </div>
      {submittedResults.length === 0 && (
        <p className="text-slate-500 text-xs text-center py-2">No results yet</p>
      )}
    </div>
  );
};

// ── Step Manifest Panel ──────────────────────────────────────────────

const StepManifestPanel: React.FC<{ data: RichAnnotatedExampleData }> = ({ data }) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-white">Step Manifest</h4>
      <div className="space-y-1.5">
        {data.steps.map((step, i) => (
          <div
            key={step.id}
            className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50"
          >
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-200 truncate">{step.title}</p>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
              STEP_TYPE_COLORS[step.content.type] || 'bg-slate-600/50 text-slate-400 border-slate-500/30'
            }`}>
              {step.content.type}
            </span>
          </div>
        ))}
      </div>

      {/* Dependency visualization */}
      <div className="pt-2 border-t border-slate-700/50">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Strategy</p>
        <p className="text-xs text-slate-400 leading-relaxed">{data.solutionStrategy}</p>
      </div>
    </div>
  );
};

// ── JSON Inspector ───────────────────────────────────────────────────

const JsonInspector: React.FC<{ data: unknown }> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        {isOpen ? '▾ Hide' : '▸ View'} raw JSON
      </button>
      {isOpen && (
        <pre className="mt-2 p-3 bg-black/30 rounded-lg text-[10px] text-slate-400 overflow-auto max-h-64 border border-white/5 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ── Main Content ─────────────────────────────────────────────────────

const AnnotatedExampleTesterContent: React.FC<AnnotatedExampleTesterProps> = ({ onBack }) => {
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('high-school');
  const [topic, setTopic] = useState('');
  const [intent, setIntent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<RichAnnotatedExampleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedData(null);
    setGenerationTime(null);

    const startTime = Date.now();

    try {
      const currentTopic = topic || 'Solve 2x + 5 = 13';
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: 'annotated-example',
            topic: currentTopic,
            gradeLevel: selectedGrade,
            config: {
              ...(intent ? { intent } : {}),
            },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate content');
      }

      const result = await response.json();
      setGeneratedData(result.data || result);
      setGenerationTime(Date.now() - startTime);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors"
            >
              &larr; Back
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>📝</span>
              <span>Annotated Example</span>
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Orchestrated
            </span>
          </div>
          {generationTime != null && (
            <span className="text-xs text-slate-500">
              Generated in {(generationTime / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel — Controls */}
        <div className="w-72 border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-5">
            {/* Grade Level */}
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
                Problem / Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Solve 2x + 5 = 13"
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Quick Topic Pills */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Quick Topics
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_TOPICS.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => setTopic(ex.label)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                      topic === ex.label
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Intent (optional) */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Intent <span className="text-slate-600 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="Demonstrate systematic equation solving"
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
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" fill="none"
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
                'Generate Worked Example'
              )}
            </button>

            {/* Step Manifest (when generated) */}
            {generatedData && (
              <div className="pt-4 border-t border-slate-700">
                <StepManifestPanel data={generatedData} />
              </div>
            )}

            {/* Evaluation Results */}
            <div className="pt-4 border-t border-slate-700">
              <EvaluationResultsPanel />
            </div>

            {/* JSON Inspector */}
            {generatedData && (
              <div className="pt-4 border-t border-slate-700">
                <JsonInspector data={generatedData} />
              </div>
            )}
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

            {isGenerating && (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin mx-auto" />
                  </div>
                  <div>
                    <p className="text-slate-300 font-medium">Orchestrating solution...</p>
                    <p className="text-slate-500 text-sm mt-1">
                      Stage 1: Solution Architect plans steps<br />
                      Stage 2: Parallel generators produce content
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!generatedData && !error && !isGenerating && (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Orchestrated Annotated Example
                  </h3>
                  <p className="text-slate-400 max-w-lg mb-6">
                    Two-stage generation: a Solution Architect plans the step manifest with typed steps
                    and a dependency graph, then parallel generators produce rich content with KaTeX
                    transitions, tables, diagrams, and case splits.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {(['algebra', 'substitution', 'table', 'diagram', 'graph-sketch', 'case-split', 'verification'] as StepType[]).map((type) => (
                      <span
                        key={type}
                        className={`text-[10px] px-2 py-1 rounded-full border ${
                          STEP_TYPE_COLORS[type]
                        }`}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {generatedData != null && !isGenerating && (
              <AnnotatedExample data={generatedData} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Wrapper with providers ───────────────────────────────────────────

const AnnotatedExampleTester: React.FC<AnnotatedExampleTesterProps> = (props) => {
  return (
    <EvaluationProvider>
      <ExhibitProvider objectives={[]} manifestItems={[]}>
        <AnnotatedExampleTesterContent {...props} />
      </ExhibitProvider>
    </EvaluationProvider>
  );
};

export default AnnotatedExampleTester;
