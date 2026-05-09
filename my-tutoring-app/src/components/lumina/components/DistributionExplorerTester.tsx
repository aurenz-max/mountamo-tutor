'use client';

import React, { useState } from 'react';
import { DistributionExplorer } from '../primitives/DistributionExplorer';
import { EvaluationProvider } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import {
  DISTRIBUTION_EVAL_MODES,
  type DistributionEvalMode,
  type DistributionExplorerData,
  type DistributionFamily,
} from '../primitives/distribution-explorer/types';
import { FAMILY_LIST } from '../lib/probability';

interface DistributionExplorerTesterProps {
  onBack: () => void;
}

type GradeLevel = 'high-school' | 'undergraduate' | 'graduate' | 'actuarial';

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'high-school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'actuarial', label: 'Actuarial' },
];

const QUICK_TOPICS = [
  { label: 'Modeling claim counts in a Poisson process', subject: 'Actuarial' },
  { label: 'Coin flips and binomial probabilities', subject: 'Probability' },
  { label: 'Equipment lifetime and the memoryless property', subject: 'Reliability' },
  { label: 'Polling a sample of voters', subject: 'Probability' },
  { label: 'Time between customer arrivals at a help desk', subject: 'Operations' },
  { label: 'Defective parts in a manufacturing batch', subject: 'Quality' },
];

// ── JSON inspector ──────────────────────────────────────────────────

const JsonInspector: React.FC<{ data: unknown; label?: string }> = ({ data, label = 'raw JSON' }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        {open ? '▾ Hide' : '▸ View'} {label}
      </button>
      {open && (
        <pre className="mt-2 p-3 bg-black/30 rounded-lg text-[10px] text-slate-400 overflow-auto max-h-64 border border-white/5 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ── Lesson manifest panel ───────────────────────────────────────────

const LessonManifestPanel: React.FC<{ data: DistributionExplorerData }> = ({ data }) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-white">Lesson Manifest</h4>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Family</span>
          <span className="text-indigo-300 font-mono">{data.initial.family}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Eval mode</span>
          <span className="text-fuchsia-300 font-mono">{data.evalMode}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Initial params</span>
          <span className="text-slate-300 font-mono">
            {Object.entries(data.initial.parameters)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-700/50">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
          Challenges ({data.challenges.length})
        </p>
        <ul className="space-y-1.5">
          {data.challenges.map((c, i) => (
            <li
              key={c.id}
              className="text-xs leading-relaxed p-2 rounded bg-slate-800/50 border border-slate-700/50"
            >
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-slate-500 font-mono">{i + 1}.</span>
                <span className="text-[10px] uppercase tracking-wider text-fuchsia-300/80 bg-fuchsia-500/10 px-1.5 py-0.5 rounded">
                  {c.type.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-slate-300">{c.prompt}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// ── Main tester ─────────────────────────────────────────────────────

const DistributionExplorerTesterContent: React.FC<DistributionExplorerTesterProps> = ({ onBack }) => {
  const [grade, setGrade] = useState<GradeLevel>('undergraduate');
  const [evalMode, setEvalMode] = useState<DistributionEvalMode>('explore');
  const [family, setFamily] = useState<DistributionFamily | ''>('');
  const [topic, setTopic] = useState('');
  const [intent, setIntent] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DistributionExplorerData | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setData(null);
    setGenerationTime(null);

    const start = Date.now();
    try {
      const currentTopic = topic || QUICK_TOPICS[0].label;
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateDistributionExplorer',
          params: {
            topic: currentTopic,
            gradeContext: grade,
            evalMode,
            ...(family ? { family } : {}),
            ...(intent ? { intent } : {}),
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate distribution explorer');
      }

      const result = (await response.json()) as DistributionExplorerData;
      setData(result);
      setGenerationTime(Date.now() - start);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
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
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
              &larr; Back
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>📊</span>
              <span>Distribution Explorer</span>
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Wave 1 · Binomial · Poisson · Exponential
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {generationTime != null && (
              <span>Generated in {(generationTime / 1000).toFixed(1)}s</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left panel — controls */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-5">
            {/* Grade */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Grade Level
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as GradeLevel)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Eval mode */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Eval Mode
              </label>
              <div className="space-y-1.5">
                {DISTRIBUTION_EVAL_MODES.map((m) => {
                  const isActive = evalMode === m.mode;
                  return (
                    <button
                      key={m.mode}
                      onClick={() => setEvalMode(m.mode)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-indigo-600/30 border-indigo-400 text-indigo-100'
                          : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{m.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono">β={m.beta}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{m.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Family pin */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Pin Family <span className="text-slate-600 font-normal">(optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setFamily('')}
                  className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                    family === ''
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  Auto
                </button>
                {FAMILY_LIST.map((def) => (
                  <button
                    key={def.family}
                    onClick={() => setFamily(def.family)}
                    className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                      family === def.family
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {def.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Modeling claim counts..."
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Quick topics */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Quick Topics
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TOPICS.map((t) => {
                  const isSelected = topic === t.label;
                  return (
                    <button
                      key={t.label}
                      onClick={() => setTopic(t.label)}
                      disabled={isGenerating}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={t.subject}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intent */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Intent <span className="text-slate-600 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="Steering text"
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating…
                </span>
              ) : (
                'Generate Lesson'
              )}
            </button>

            {/* Manifest */}
            {data && (
              <div className="pt-4 border-t border-slate-700">
                <LessonManifestPanel data={data} />
              </div>
            )}

            {/* JSON */}
            {data && (
              <div className="pt-4 border-t border-slate-700">
                <JsonInspector data={data} label="lesson JSON" />
              </div>
            )}
          </div>
        </div>

        {/* Right panel — render */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {!data && !isGenerating && !error && (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Distribution Explorer</h3>
                  <p className="text-slate-400 max-w-lg mb-6">
                    A live workbench for any probability distribution. Pick an eval mode + topic and
                    Gemini authors a lesson with framing, initial parameters, and phase-gated
                    challenges. The math runs client-side from the chosen family.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {FAMILY_LIST.map((f) => (
                      <span
                        key={f.family}
                        className="text-[10px] px-2 py-1 rounded-full border bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                      >
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin mx-auto" />
                  <div>
                    <p className="text-slate-300 font-medium">Authoring lesson…</p>
                    <p className="text-slate-500 text-sm mt-1">
                      Orchestrator picking family, parameters, and challenges.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg max-w-2xl mx-auto">
                <p className="text-red-400 text-sm font-medium mb-2">Generation failed</p>
                <p className="text-red-400/80 text-xs mb-3">{error}</p>
                <button
                  onClick={handleGenerate}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {data && <DistributionExplorer data={data} />}
          </div>
        </div>
      </div>
    </div>
  );
};

const DistributionExplorerTester: React.FC<DistributionExplorerTesterProps> = (props) => {
  return (
    <EvaluationProvider>
      <ExhibitProvider objectives={[]} manifestItems={[]}>
        <DistributionExplorerTesterContent {...props} />
      </ExhibitProvider>
    </EvaluationProvider>
  );
};

export default DistributionExplorerTester;
