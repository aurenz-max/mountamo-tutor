'use client';

/**
 * History Primitives Tester — the browser drive surface for the C3 social
 * studies suite.
 *
 * The domain shipped its first primitive (`era-explorer`, L0→L4) with no
 * tester, so every layer of it was verified in jsdom and through the eval-test
 * API and NEVER driven in Chrome — its own L3 report says so. This panel closes
 * that for the whole domain rather than for one primitive: pick a primitive,
 * pick a grade, type a topic, generate through the real pipeline, and play the
 * result with evaluation submission live.
 *
 * `LuminaAIProvider` is NOT optional: both primitives call `useLuminaAI`, which
 * throws outright without it.
 */

import React, { useState } from 'react';
import EraExplorer from '../primitives/visual-primitives/history/EraExplorer';
import CauseEffectChain from '../primitives/visual-primitives/history/CauseEffectChain';
import { EvaluationProvider, useEvaluationContext } from '../evaluation';
import type { PrimitiveEvaluationResult } from '../evaluation';
import { getComponentById } from '../service/manifest/catalog';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';

interface HistoryPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'era-explorer' | 'cause-effect-chain';
type GradeLevel = 'kindergarten' | '1' | '2' | '3' | '4' | '5' | '6';

const PRIMITIVE_OPTIONS: Array<{
  value: PrimitiveType;
  label: string;
  icon: string;
  topic: string;
}> = [
  { value: 'era-explorer', label: 'Era Explorer', icon: '🏛️', topic: 'Life in pioneer times' },
  { value: 'cause-effect-chain', label: 'Cause & Effect Chain', icon: '🔗', topic: 'Why towns grew along the railroad' },
];

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'kindergarten', label: 'Kindergarten' },
  { value: '1', label: 'Grade 1' },
  { value: '2', label: 'Grade 2' },
  { value: '3', label: 'Grade 3' },
  { value: '4', label: 'Grade 4' },
  { value: '5', label: 'Grade 5' },
  { value: '6', label: 'Grade 6' },
];

const EXAMPLE_TOPICS = [
  'Why towns grew along the railroad',
  'Why families moved west',
  'How the printing press changed Europe',
  'Life in Ancient Egypt',
  'Why our community has rules',
  'How new farm machines changed daily life',
];

/**
 * Both primitives take ONE `data` prop. Nothing is spread and nothing is mocked
 * — the generator's payload goes straight through, so a generator change is
 * visible here immediately (the fixture-bug guard).
 */
const PrimitiveRenderer: React.FC<{
  componentId: PrimitiveType;
  data: unknown;
  onEvaluationSubmit: (result: PrimitiveEvaluationResult) => void;
}> = ({ componentId, data, onEvaluationSubmit }) => {
  if (!data) return null;

  switch (componentId) {
    case 'era-explorer':
      return (
        <EraExplorer
          data={{
            ...(data as Parameters<typeof EraExplorer>[0]['data']),
            instanceId: `era-explorer-${Date.now()}`,
            onEvaluationSubmit,
          }}
        />
      );
    case 'cause-effect-chain':
      return (
        <CauseEffectChain
          data={{
            ...(data as Parameters<typeof CauseEffectChain>[0]['data']),
            instanceId: `cause-effect-chain-${Date.now()}`,
            onEvaluationSubmit,
          }}
        />
      );
    default:
      return <div className="text-slate-400">Unknown primitive: {componentId}</div>;
  }
};

/** Session results + the per-primitive metrics breakdown. */
const EvaluationResultsPanel: React.FC<{ lastResult: PrimitiveEvaluationResult | null }> = ({ lastResult }) => {
  const context = useEvaluationContext();
  const summary = context?.getSessionSummary();
  const metrics = lastResult?.metrics;

  return (
    <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <h4 className="text-lg font-semibold text-white">Evaluation Results</h4>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-slate-700/50 p-3 text-center">
          <div className="text-2xl font-bold text-white">{summary?.totalAttempts ?? 0}</div>
          <div className="text-xs text-slate-400">Attempts</div>
        </div>
        <div className="rounded-lg bg-slate-700/50 p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{summary?.successfulAttempts ?? 0}</div>
          <div className="text-xs text-slate-400">Successes</div>
        </div>
        <div className="rounded-lg bg-slate-700/50 p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {Math.round(summary?.averageScore ?? 0)}%
          </div>
          <div className="text-xs text-slate-400">Avg Score</div>
        </div>
      </div>

      {metrics?.type === 'cause-effect-chain' && (
        <div className="grid grid-cols-2 gap-1 text-xs text-slate-400">
          <span>Mode: {metrics.challengeType}</span>
          <span>Correct: {metrics.correctCount}/{metrics.totalChallenges}</span>
          <span>First try: {metrics.firstTryCount}</span>
          <span>Attempts: {metrics.attemptsCount}</span>
          <span>Avg attempts: {metrics.averageAttemptsPerChallenge.toFixed(1)}</span>
          <span>Hints viewed: {metrics.hintsViewed}</span>
          <span>Accuracy: {metrics.overallAccuracy.toFixed(0)}%</span>
        </div>
      )}

      {metrics?.type === 'era-explorer' && (
        <div className="grid grid-cols-2 gap-1 text-xs text-slate-400">
          <span>Mode: {metrics.challengeType}</span>
          <span>Correct: {metrics.correctCount}/{metrics.totalChallenges}</span>
          <span>First try: {metrics.firstTryCount}</span>
          <span>Attempts: {metrics.attemptsCount}</span>
          <span>Avg attempts: {metrics.averageAttemptsPerChallenge.toFixed(1)}</span>
          <span>Hints viewed: {metrics.hintsViewed}</span>
          <span>Accuracy: {metrics.overallAccuracy.toFixed(0)}%</span>
        </div>
      )}

      {!metrics && (
        <p className="text-sm text-slate-500">
          No evaluation submitted yet — finish every challenge to see the metrics payload.
        </p>
      )}
    </div>
  );
};

const HistoryPrimitivesTesterContent: React.FC<HistoryPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('cause-effect-chain');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('3');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<unknown>(null);
  const [lastResult, setLastResult] = useState<PrimitiveEvaluationResult | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** '' = leave it unpinned, so the generator resolves the rung from intent. */
  const [evalMode, setEvalMode] = useState('');
  /** '' = no tier, the untiered baseline. Otherwise the manifest's config.difficulty. */
  const [difficulty, setDifficulty] = useState('');

  const selectedOption = PRIMITIVE_OPTIONS.find((p) => p.value === selectedPrimitive);
  /**
   * Read straight from the catalog rather than a local list: the catalog IS the
   * eval-mode source of truth, so a rung added by `/add-eval-modes` shows up
   * here without anyone remembering to mirror it.
   */
  const evalModes = getComponentById(selectedPrimitive)?.evalModes ?? [];

  const generate = async (topicOverride?: string) => {
    setIsGenerating(true);
    setError(null);
    setGeneratedData(null);
    setLastResult(null);

    try {
      const currentTopic = (topicOverride ?? topic).trim() || selectedOption?.topic || 'Life long ago';
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: selectedPrimitive,
            topic: currentTopic,
            gradeLevel: selectedGrade,
            // A pin wins over intent resolution with no LLM call; omitting it is
            // the only way to exercise the intent path, so '' must stay absent
            // rather than be sent as an empty string.
            config: {
              ...(evalMode ? { targetEvalMode: evalMode } : {}),
              ...(difficulty ? { difficulty } : {}),
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
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-amber-950/40 to-slate-950">
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <button onClick={onBack} className="text-slate-400 transition-colors hover:text-white">
            ← Back
          </button>
          <div className="h-6 w-px bg-slate-700" />
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <span>🏛️</span>
            <span>History Primitives Tester</span>
          </h1>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        <div className="w-64 flex-shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900/30 p-4 backdrop-blur">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Primitive
              </label>
              <div className="space-y-1">
                {PRIMITIVE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSelectedPrimitive(option.value);
                      // The pin belongs to the primitive that owns the key —
                      // carrying it across resolves to nothing and silently
                      // reads as "mixed" instead of as the wrong mode.
                      setEvalMode('');
                      setGeneratedData(null);
                      setLastResult(null);
                      setError(null);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left transition-all ${
                      selectedPrimitive === option.value
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
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

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Grade Level
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value as GradeLevel)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>

            {evalModes.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Eval Mode
                </label>
                <select
                  value={evalMode}
                  onChange={(e) => setEvalMode(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                >
                  <option value="">Auto (resolve from intent)</option>
                  {evalModes.map((m) => (
                    <option key={m.evalMode} value={m.evalMode}>
                      {m.label} · β{m.beta}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Support Tier
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="">None (untiered baseline)</option>
                <option value="easy">easy · help shown, links visible</option>
                <option value="medium">medium · strategy withdrawn</option>
                <option value="hard">hard · no aids, indirect links</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Topic
              </label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={selectedOption?.topic}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <button
              onClick={() => generate()}
              disabled={isGenerating}
              className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
            >
              {isGenerating ? 'Generating…' : 'Generate'}
            </button>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Quick Topics
              </label>
              <div className="space-y-1">
                {EXAMPLE_TOPICS.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTopic(t); generate(t); }}
                    className="w-full rounded-lg bg-slate-800/50 px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <EvaluationResultsPanel lastResult={lastResult} />

            <button
              onClick={() => setShowJson((v) => !v)}
              className="w-full rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
            >
              {showJson ? 'Hide' : 'Show'} generated JSON
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {isGenerating && (
              <div className="py-16 text-center text-slate-400">Generating through the real pipeline…</div>
            )}

            {showJson && generatedData != null && (
              <pre className="max-h-96 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-4 text-xs text-slate-300">
                {JSON.stringify(generatedData, null, 2)}
              </pre>
            )}

            {generatedData != null && (
              <PrimitiveRenderer
                componentId={selectedPrimitive}
                data={generatedData}
                onEvaluationSubmit={setLastResult}
              />
            )}

            {!isGenerating && generatedData == null && !error && (
              <div className="py-16 text-center text-slate-500">
                Pick a primitive and a topic, then Generate.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const HistoryPrimitivesTester: React.FC<HistoryPrimitivesTesterProps> = (props) => (
  <LuminaAIProvider>
    <EvaluationProvider>
      <HistoryPrimitivesTesterContent {...props} />
    </EvaluationProvider>
  </LuminaAIProvider>
);

export default HistoryPrimitivesTester;
