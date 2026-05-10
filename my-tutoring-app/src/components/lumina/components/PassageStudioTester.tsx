'use client';

import React, { useMemo, useState } from 'react';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import PassageStudio from '../primitives/visual-primitives/core/passage-studio/PassageStudio';
import {
  SAMPLE_FIXTURES,
  type FixtureEntry,
} from '../primitives/visual-primitives/core/passage-studio/sample-fixtures';
import type {
  PassageBlock,
  PassageLayout,
  PassageStudioData,
} from '../primitives/visual-primitives/core/passage-studio/types';

interface PassageStudioTesterProps {
  onBack: () => void;
}

type Mode = 'generate' | 'fixture';

type GradeLevel =
  | 'kindergarten'
  | 'elementary'
  | 'middle-school'
  | 'high-school'
  | 'undergraduate';
type EvalMode = 'default' | 'explore' | 'recall' | 'apply' | 'analyze';

const LAYOUT_OPTIONS: Array<{ value: PassageLayout; label: string; description: string }> = [
  { value: 'stack', label: 'Stack', description: 'Vertical flow — passage block + everything else linear' },
  { value: 'split_passage', label: 'Split Passage', description: 'Passage pinned left, blocks scroll right' },
  { value: 'reveal_beat', label: 'Reveal Beat', description: 'Sequential reveal — blocks unlock in order' },
  { value: 'annotated_passage', label: 'Annotated Passage', description: 'Passage center, blocks as margin notes' },
];

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'kindergarten', label: 'Kindergarten' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'middle-school', label: 'Middle School' },
  { value: 'high-school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate' },
];

const EVAL_MODE_OPTIONS: Array<{ value: EvalMode; label: string; description: string }> = [
  { value: 'default', label: 'Default', description: 'Balanced mix of display + evaluables' },
  { value: 'explore', label: 'Explore', description: 'Mostly display, 1–2 easy comprehension' },
  { value: 'recall', label: 'Recall', description: 'Direct comprehension + vocab' },
  { value: 'apply', label: 'Apply', description: 'Comprehension + evidence + vocab' },
  { value: 'analyze', label: 'Analyze', description: 'Inference + theme-statement (rubric judge)' },
];

const EXAMPLE_TOPICS: Array<{ label: string; subject: string }> = [
  // Literature
  { label: 'Metaphor in haiku', subject: 'Poetry' },
  { label: "Symbolism in 'The Great Gatsby'", subject: 'Fiction' },
  { label: "Character voice in 'The Tell-Tale Heart'", subject: 'Fiction' },
  { label: "Theme and irony in 'The Necklace'", subject: 'Fiction' },
  { label: 'Imagery in Emily Dickinson', subject: 'Poetry' },
  // Rhetoric & primary sources
  { label: "Rhetoric in MLK's 'I Have a Dream'", subject: 'Rhetoric' },
  { label: 'The Gettysburg Address', subject: 'History' },
  { label: 'Excerpts from the Federalist Papers', subject: 'History' },
  { label: "Frederick Douglass on the Fourth of July", subject: 'History' },
  // Informational / science
  { label: 'How mRNA vaccines work', subject: 'Science' },
  { label: 'Evidence for climate change', subject: 'Science' },
  { label: 'The discovery of DNA structure', subject: 'Science' },
  { label: 'Why the sky is blue', subject: 'Science' },
  // Social studies & ethics
  { label: 'The ethics of AI in classrooms', subject: 'Ethics' },
  { label: 'Comparing democratic systems', subject: 'Civics' },
  { label: 'Causes of World War I', subject: 'History' },
];

// ── Block-type colour map (mirrors orchestrator accents) ────────────

const BLOCK_TYPE_COLORS: Record<string, string> = {
  'passage-display': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'pull-quote': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'vocab-card': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'author-context': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'comprehension-mcq': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'evidence-highlight': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'vocab-in-context': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'inference-builder': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  'theme-statement': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

function blockTypeColor(blockType: string): string {
  return BLOCK_TYPE_COLORS[blockType] || 'bg-slate-600/50 text-slate-400 border-slate-500/30';
}

// ── Plan summary ────────────────────────────────────────────────────

const PlanDisplay: React.FC<{ data: PassageStudioData }> = ({ data }) => {
  const evalCount = data.blocks.filter(
    (b) =>
      b.blockType === 'comprehension-mcq' ||
      b.blockType === 'evidence-highlight' ||
      b.blockType === 'vocab-in-context' ||
      b.blockType === 'inference-builder' ||
      b.blockType === 'theme-statement',
  ).length;
  const types = new Set(data.blocks.map((b) => b.blockType));

  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
      <h4 className="text-xs font-bold text-slate-300 mb-2">Plan</h4>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <div className="text-lg font-bold text-white">{data.blocks.length}</div>
          <div className="text-[10px] text-slate-500">Blocks</div>
        </div>
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <div className="text-lg font-bold text-emerald-400">{evalCount}</div>
          <div className="text-[10px] text-slate-500">Interactive</div>
        </div>
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <div className="text-lg font-bold text-blue-400">{types.size}</div>
          <div className="text-[10px] text-slate-500">Types</div>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-600/50 text-slate-400 border border-slate-500/30">
          layout: {data.layout || 'stack'}
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
          {data.stimulus.kind}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {data.blocks.map((b, i) => (
          <span key={i} className={`px-2 py-0.5 text-[10px] rounded border ${blockTypeColor(b.blockType)}`}>
            {b.blockType}
          </span>
        ))}
      </div>
      {data.narrativeArc && (
        <p className="mt-2 text-[10px] text-slate-500 italic">{data.narrativeArc}</p>
      )}
    </div>
  );
};

// ── Block inspector ─────────────────────────────────────────────────

const BlockInspector: React.FC<{
  blocks: PassageBlock[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}> = ({ blocks, selectedIndex, onSelect }) => {
  const selected = blocks[selectedIndex];
  if (!selected) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {blocks.map((b, i) => (
          <button
            key={b.id}
            onClick={() => onSelect(i)}
            className={`px-2 py-1 text-xs rounded border transition-all ${
              i === selectedIndex
                ? blockTypeColor(b.blockType)
                : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-slate-200'
            }`}
          >
            {i + 1}. {b.blockType}
          </button>
        ))}
      </div>
      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${blockTypeColor(selected.blockType)}`}>
            {selected.blockType}
          </span>
          <span className="text-sm text-slate-200">{selected.label}</span>
        </div>
        {selected.tutoringBrief && (
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded text-xs">
            <span className="text-indigo-400 font-medium">AI Brief: </span>
            <span className="text-slate-300">{selected.tutoringBrief}</span>
          </div>
        )}
        {selected.transitionCue && (
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
            <span className="text-amber-400 font-medium">Transition: </span>
            <span className="text-slate-300">{selected.transitionCue}</span>
          </div>
        )}
        <details>
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">Raw JSON</summary>
          <pre className="mt-1 p-2 bg-slate-900 rounded text-[10px] text-slate-400 overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

// ── Evaluation results panel ────────────────────────────────────────

const EvaluationResultsPanel: React.FC = () => {
  const ctx = useEvaluationContext();
  if (!ctx) return null;
  const { submittedResults, getSessionSummary } = ctx;
  const summary = getSessionSummary();

  if (submittedResults.length === 0) {
    return (
      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
        <p className="text-slate-500 text-xs text-center py-2">
          Complete interactive blocks to see evaluation results
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 space-y-2">
      <h4 className="text-xs font-bold text-slate-300">Evaluation Results</h4>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <div className="text-lg font-bold text-white">{summary.totalAttempts}</div>
          <div className="text-[10px] text-slate-500">Attempts</div>
        </div>
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <div className="text-lg font-bold text-green-400">{summary.successfulAttempts}</div>
          <div className="text-[10px] text-slate-500">Successes</div>
        </div>
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <div className="text-lg font-bold text-amber-400">{Math.round(summary.averageScore)}%</div>
          <div className="text-[10px] text-slate-500">Avg Score</div>
        </div>
      </div>
      {submittedResults
        .slice(-3)
        .reverse()
        .map((r) => (
          <div
            key={r.attemptId}
            className={`p-2 rounded border text-xs ${
              r.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex justify-between">
              <span className="text-slate-200">{r.primitiveType}</span>
              <span className={r.success ? 'text-green-400' : 'text-red-400'}>{Math.round(r.score)}%</span>
            </div>
          </div>
        ))}
    </div>
  );
};

// ── Inner ───────────────────────────────────────────────────────────

const PassageStudioTesterInner: React.FC<PassageStudioTesterProps> = ({ onBack }) => {
  const [mode, setMode] = useState<Mode>('generate');

  // Generate-mode state
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('middle-school');
  const [evalMode, setEvalMode] = useState<EvalMode>('default');
  const [layoutChoice, setLayoutChoice] = useState<PassageLayout | 'auto'>('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<PassageStudioData | null>(null);
  const [generateTimeMs, setGenerateTimeMs] = useState<number | null>(null);

  // Fixture-mode state
  const [fixtureId, setFixtureId] = useState<string>(SAMPLE_FIXTURES[0].id);
  const [fixtureLayoutOverride, setFixtureLayoutOverride] = useState<PassageLayout | 'auto'>('auto');

  const [inspectorIndex, setInspectorIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const evaluationContext = useEvaluationContext();
  const selectedFixture: FixtureEntry =
    SAMPLE_FIXTURES.find((f) => f.id === fixtureId) ?? SAMPLE_FIXTURES[0];

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);
    setGeneratedData(null);
    setInspectorIndex(0);
    const startTime = Date.now();

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: 'passage-studio',
            topic,
            gradeLevel,
            config: {
              targetEvalMode: evalMode === 'default' ? undefined : evalMode,
              layoutOverride: layoutChoice === 'auto' ? undefined : layoutChoice,
            },
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Generation failed');
      }

      const result = await response.json();
      setGeneratedData(result.data || result);
      setGenerateTimeMs(Date.now() - startTime);
      setResetKey((k) => k + 1);
    } catch (err) {
      console.error('[PassageStudioTester] Generation error:', err);
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  // Resolve the active data based on mode
  const data: PassageStudioData | null = useMemo(() => {
    if (mode === 'generate') {
      if (!generatedData) return null;
      return {
        ...generatedData,
        layout: layoutChoice === 'auto' ? generatedData.layout : layoutChoice,
        instanceId: `passage-studio-gen-${resetKey}`,
        exhibitId: evaluationContext?.exhibitId,
        skillId: 'passage-comprehension',
        subskillId: 'passage-studio-test',
        objectiveId: 'analyze-passage',
      };
    }
    return {
      ...selectedFixture.data,
      layout: fixtureLayoutOverride === 'auto' ? selectedFixture.data.layout : fixtureLayoutOverride,
      instanceId: `passage-studio-fix-${fixtureId}-${resetKey}`,
      exhibitId: evaluationContext?.exhibitId,
      skillId: 'passage-comprehension',
      subskillId: 'passage-studio-test',
      objectiveId: 'analyze-passage',
    };
  }, [
    mode,
    generatedData,
    layoutChoice,
    selectedFixture,
    fixtureLayoutOverride,
    fixtureId,
    resetKey,
    evaluationContext?.exhibitId,
  ]);

  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    console.log('[PassageStudioTester] Evaluation submitted:', result);
  };

  return (
    <div className="min-h-screen">
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

      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-1">Passage Studio Tester</h2>
        <p className="text-sm text-slate-400">
          Multi-block close-reading orchestrator. Live Gemini generation or hand-authored fixtures.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4 px-4">
        {/* Left column: controls + plan + inspector */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
            {/* Mode toggle */}
            <div className="flex gap-1 mb-4 p-1 bg-slate-900/50 rounded-lg border border-slate-700">
              <button
                onClick={() => setMode('generate')}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                  mode === 'generate'
                    ? 'bg-pink-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Generate
              </button>
              <button
                onClick={() => setMode('fixture')}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                  mode === 'fixture'
                    ? 'bg-pink-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fixture
              </button>
            </div>

            {mode === 'generate' && (
              <>
                <h3 className="text-xl font-bold text-white mb-4">Generate</h3>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Topic</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. metaphor in haiku, the rhetoric of speeches…"
                    className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerate();
                    }}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Quick Topics</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLE_TOPICS.map((ex) => {
                      const isSelected = topic === ex.label;
                      return (
                        <button
                          key={ex.label}
                          onClick={() => setTopic(ex.label)}
                          disabled={isGenerating}
                          className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                            isSelected
                              ? 'bg-pink-600 text-white border-pink-500'
                              : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={ex.subject}
                        >
                          {ex.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Grade Level</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                    className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  >
                    {GRADE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Eval Mode</label>
                  <select
                    value={evalMode}
                    onChange={(e) => setEvalMode(e.target.value as EvalMode)}
                    className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  >
                    {EVAL_MODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {EVAL_MODE_OPTIONS.find((o) => o.value === evalMode)?.description}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Layout</label>
                  <select
                    value={layoutChoice}
                    onChange={(e) => setLayoutChoice(e.target.value as PassageLayout | 'auto')}
                    className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  >
                    <option value="auto">Auto (LLM picks)</option>
                    {LAYOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {layoutChoice === 'auto'
                      ? 'Orchestrator chooses based on stimulus kind & eval mode'
                      : LAYOUT_OPTIONS.find((o) => o.value === layoutChoice)?.description}
                  </p>
                </div>

                {generateError && (
                  <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                    <p className="text-red-400 text-sm">{generateError}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !topic.trim()}
                  className="w-full px-4 py-2 text-sm bg-pink-600 hover:bg-pink-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Orchestrating…
                    </>
                  ) : (
                    'Generate PassageStudio'
                  )}
                </button>

                {generateTimeMs && (
                  <p className="text-[10px] text-slate-500 text-center mt-2">
                    Generated in {(generateTimeMs / 1000).toFixed(1)}s
                  </p>
                )}
              </>
            )}

            {mode === 'fixture' && (
              <>
                <h3 className="text-xl font-bold text-white mb-4">Fixture</h3>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Sample</label>
                  <select
                    value={fixtureId}
                    onChange={(e) => {
                      setFixtureId(e.target.value);
                      setInspectorIndex(0);
                      setResetKey((k) => k + 1);
                    }}
                    className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  >
                    {SAMPLE_FIXTURES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">{selectedFixture.description}</p>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Layout override</label>
                  <select
                    value={fixtureLayoutOverride}
                    onChange={(e) =>
                      setFixtureLayoutOverride(e.target.value as PassageLayout | 'auto')
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  >
                    <option value="auto">Auto (use fixture default)</option>
                    {LAYOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setResetKey((k) => k + 1)}
                  className="w-full px-4 py-2 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-semibold transition-all"
                >
                  Reset Progress
                </button>
              </>
            )}
          </div>

          {data && (
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
              <PlanDisplay data={data} />
            </div>
          )}

          {data && (
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
              <h3 className="text-sm font-bold text-white mb-3">Block Inspector</h3>
              <BlockInspector
                blocks={data.blocks}
                selectedIndex={inspectorIndex}
                onSelect={setInspectorIndex}
              />
            </div>
          )}

          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
            <EvaluationResultsPanel />
          </div>
        </div>

        {/* Right column: render */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 min-h-[calc(100vh-200px)]">
          {data ? (
            <div className="bg-slate-900/50 rounded-xl p-4">
              <PassageStudio
                key={resetKey}
                data={{
                  ...data,
                  onEvaluationSubmit: handleEvaluationSubmit as PassageStudioData['onEvaluationSubmit'],
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              {isGenerating ? (
                <div className="text-center space-y-3">
                  <div className="w-10 h-10 border-3 border-pink-500/30 border-t-pink-400 rounded-full animate-spin mx-auto" />
                  <p className="text-slate-300">Orchestrating blocks…</p>
                  <p className="text-xs text-slate-500">
                    Stage 1: planning → Stage 2a: stimulus → Stage 2b: parallel block hydration
                  </p>
                </div>
              ) : (
                <>
                  <span className="text-6xl mb-4">📖</span>
                  <p className="text-center">Enter a topic and Generate, or switch to Fixture mode</p>
                  <p className="text-xs text-slate-600 mt-2">
                    1 orchestrator + 1 stimulus + N parallel block calls
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PassageStudioTester: React.FC<PassageStudioTesterProps> = ({ onBack }) => {
  return (
    <LuminaAIProvider>
      <EvaluationProvider studentId="tester" exhibitId={`passage-studio-test-${Date.now()}`}>
        <PassageStudioTesterInner onBack={onBack} />
      </EvaluationProvider>
    </LuminaAIProvider>
  );
};

export default PassageStudioTester;
