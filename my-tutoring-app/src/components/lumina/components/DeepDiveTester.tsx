'use client';

import React, { useState, useMemo } from 'react';
import { getPrimitive } from '../config/primitiveRegistry';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import type { DeepDiveData, DeepDiveBlock, WrapperLayout } from '../primitives/visual-primitives/core/deep-dive/types';
import { getTemplates } from '../primitives/visual-primitives/core/deep-dive/composition-templates';

interface DeepDiveTesterProps {
  onBack: () => void;
}

type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';
type EvalMode = 'default' | 'explore' | 'recall' | 'apply' | 'analyze';
type LayoutChoice = 'auto' | WrapperLayout;

const LAYOUT_OPTIONS: Array<{ value: LayoutChoice; label: string; description: string }> = [
  { value: 'auto', label: 'Auto (LLM picks)', description: 'Orchestrator chooses based on topic & eval mode' },
  { value: 'stack', label: 'Stack', description: 'Vertical single-column — narrative-heavy linear flow' },
  { value: 'grid_2col', label: 'Grid 2-col', description: 'Two-column grid — comparison/analytical content' },
  { value: 'reveal_progressive', label: 'Reveal', description: 'Cards appear one at a time — misconception repair, guided reasoning' },
  { value: 'masonry', label: 'Masonry', description: 'Pinterest-style variable-height grid — broad overviews' },
];

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

const EVAL_MODE_OPTIONS: Array<{ value: EvalMode; label: string; description: string }> = [
  { value: 'default', label: 'Default', description: 'Balanced mix of display + interactive' },
  { value: 'explore', label: 'Explore', description: 'Mostly display, 1-2 easy MC' },
  { value: 'recall', label: 'Recall', description: 'Direct recall MC questions' },
  { value: 'apply', label: 'Apply', description: 'Cross-referencing + multi-step' },
  { value: 'analyze', label: 'Analyze', description: 'Synthesis + analysis questions' },
];

// ── Block type accent colors (matches block components) ─────────────

const BLOCK_TYPE_COLORS: Record<string, string> = {
  'hero-image': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'key-facts': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'data-table': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'multiple-choice': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'fill-in-blank': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'pull-quote': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'prose': 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  'timeline': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  'compare-contrast': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
};

function blockTypeColor(blockType: string): string {
  return BLOCK_TYPE_COLORS[blockType] || 'bg-slate-600/50 text-slate-400 border-slate-500/30';
}

// ── Template Picker ─────────────────────────────────────────────────

const TemplatePicker: React.FC<{
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}> = ({ selectedId, onSelect }) => {
  const templates = useMemo(() => getTemplates(), []);
  const [expanded, setExpanded] = useState(false);

  const selected = templates.find((t) => t.id === selectedId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-slate-300">
          Composition Template
        </label>
        {selectedId && (
          <button
            onClick={() => onSelect(null)}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Selected template summary */}
      {selected && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-left p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/15 transition-all"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-indigo-300">{selected.id}</span>
            <span className="text-[10px] text-slate-500">{selected.wrapperLayout}</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">{selected.description}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {selected.slots.map((slot, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 text-[9px] rounded border ${blockTypeColor(slot.primitive)}`}
              >
                {slot.primitive}
              </span>
            ))}
          </div>
        </button>
      )}

      {/* Template list */}
      {(expanded || !selectedId) && (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
          {templates.map((template) => {
            const isSelected = template.id === selectedId;
            return (
              <button
                key={template.id}
                onClick={() => {
                  onSelect(isSelected ? null : template.id);
                  setExpanded(false);
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-indigo-500/15 border-indigo-500/40'
                    : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50 hover:border-slate-500/50'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-medium ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {template.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-600 font-mono">{template.wrapperLayout}</span>
                    <span className="text-[9px] text-slate-600">{template.estimatedDurationMinutes}m</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-1.5">{template.description}</p>
                <div className="flex items-center gap-1">
                  {template.slots.map((slot, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="text-slate-700 text-[8px]">&rarr;</span>}
                      <span
                        className={`px-1 py-0.5 text-[8px] rounded border ${blockTypeColor(slot.primitive)}`}
                        title={`${slot.primitive} (${slot.role})`}
                      >
                        {slot.primitive.replace('multiple-choice', 'MC').replace('fill-in-blank', 'FIB').replace('compare-contrast', 'C&C').replace('hero-image', 'hero').replace('key-facts', 'facts').replace('data-table', 'table').replace('pull-quote', 'quote')}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Block Inspector Panel ───────────────────────────────────────────

const BlockInspector: React.FC<{ blocks: DeepDiveBlock[]; selectedIndex: number; onSelect: (i: number) => void }> = ({
  blocks,
  selectedIndex,
  onSelect,
}) => {
  const selected = blocks[selectedIndex];
  if (!selected) return null;

  return (
    <div className="space-y-3">
      {/* Block selector */}
      <div className="flex flex-wrap gap-1">
        {blocks.map((block, i) => (
          <button
            key={block.id}
            onClick={() => onSelect(i)}
            className={`px-2 py-1 text-xs rounded border transition-all ${
              i === selectedIndex
                ? blockTypeColor(block.blockType)
                : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-slate-200'
            }`}
          >
            {i + 1}. {block.blockType}
          </button>
        ))}
      </div>

      {/* Selected block details */}
      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 space-y-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${blockTypeColor(selected.blockType)}`}>
            {selected.blockType}
          </span>
          <span className="text-sm text-slate-200">{selected.label}</span>
        </div>

        {/* Tutoring brief */}
        {selected.tutoringBrief && (
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded text-xs">
            <span className="text-indigo-400 font-medium">AI Brief: </span>
            <span className="text-slate-300">{selected.tutoringBrief}</span>
          </div>
        )}

        {/* Transition cue */}
        {selected.transitionCue && (
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
            <span className="text-amber-400 font-medium">Transition: </span>
            <span className="text-slate-300">{selected.transitionCue}</span>
          </div>
        )}

        {/* Raw JSON (collapsed) */}
        <details>
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
            Raw JSON
          </summary>
          <pre className="mt-1 p-2 bg-slate-900 rounded text-[10px] text-slate-400 overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

// ── Orchestrator Plan Display ───────────────────────────────────────

const OrchestratorPlanDisplay: React.FC<{ data: DeepDiveData; templateId?: string | null }> = ({ data, templateId }) => {
  const evaluableCount = data.blocks.filter(
    (b) => b.blockType === 'multiple-choice' || b.blockType === 'fill-in-blank',
  ).length;

  // Count unique block types
  const blockTypes = new Set(data.blocks.map((b) => b.blockType));

  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
      <h4 className="text-xs font-bold text-slate-300 mb-2">Orchestrator Plan</h4>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <div className="text-lg font-bold text-white">{data.blocks.length}</div>
          <div className="text-[10px] text-slate-500">Blocks</div>
        </div>
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <div className="text-lg font-bold text-emerald-400">{evaluableCount}</div>
          <div className="text-[10px] text-slate-500">Interactive</div>
        </div>
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <div className="text-lg font-bold text-blue-400">{blockTypes.size}</div>
          <div className="text-[10px] text-slate-500">Types</div>
        </div>
      </div>

      {/* Layout badge */}
      {data.layout && (
        <div className="mb-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-600/50 text-slate-400 border border-slate-500/30">
            layout: {data.layout}
          </span>
          {templateId && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 ml-1">
              template: {templateId}
            </span>
          )}
        </div>
      )}

      {/* Block flow */}
      <div className="flex flex-wrap gap-1">
        {data.blocks.map((block, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 text-[10px] rounded border ${blockTypeColor(block.blockType)}`}
          >
            {block.blockType}
          </span>
        ))}
      </div>
      {data.narrativeArc && (
        <p className="mt-2 text-[10px] text-slate-500 italic">{data.narrativeArc}</p>
      )}
    </div>
  );
};

// ── Evaluation Results Panel ────────────────────────────────────────

const EvaluationResultsPanel: React.FC = () => {
  const context = useEvaluationContext();
  if (!context) return null;

  const { submittedResults, getSessionSummary } = context;
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
      {submittedResults.slice(-3).reverse().map((result) => (
        <div
          key={result.attemptId}
          className={`p-2 rounded border text-xs ${
            result.success
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <div className="flex justify-between">
            <span className="text-slate-200">{result.primitiveType}</span>
            <span className={result.success ? 'text-green-400' : 'text-red-400'}>
              {Math.round(result.score)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main Tester Inner Component ─────────────────────────────────────

const DeepDiveTesterInner: React.FC<DeepDiveTesterProps> = ({ onBack }) => {
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [evalMode, setEvalMode] = useState<EvalMode>('default');
  const [layoutChoice, setLayoutChoice] = useState<LayoutChoice>('auto');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<DeepDiveData | null>(null);
  const [inspectorIndex, setInspectorIndex] = useState(0);
  const [generateTimeMs, setGenerateTimeMs] = useState<number | null>(null);

  const evaluationContext = useEvaluationContext();
  const primitiveConfig = getPrimitive('deep-dive');
  const DeepDiveComponent = primitiveConfig?.component;

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    setError(null);
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
            componentId: 'deep-dive',
            topic: topic,
            gradeLevel: gradeLevel,
            config: {
              targetEvalMode: evalMode === 'default' ? undefined : evalMode,
              templateId: templateId || undefined,
              layoutOverride: layoutChoice === 'auto' ? undefined : layoutChoice,
              intent: `Generate a DeepDive exploration on "${topic}"`,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      setGeneratedData(result.data || result);
      setGenerateTimeMs(Date.now() - startTime);
    } catch (err) {
      console.error('[DeepDiveTester] Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    console.log('[DeepDiveTester] Evaluation submitted:', result);
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

      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-1">DeepDive Tester</h2>
        <p className="text-sm text-slate-400">
          Orchestrated multi-block learning experiences with parallel Gemini generation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4 px-4">
        {/* Left Column: Controls + Inspector */}
        <div className="space-y-4">
          {/* Generation Controls */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Generate</h3>

            {/* Topic */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. photosynthesis, the civil war, volcanoes..."
                className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerate();
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
                {GRADE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Eval Mode */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">Eval Mode</label>
              <select
                value={evalMode}
                onChange={(e) => setEvalMode(e.target.value as EvalMode)}
                className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                {EVAL_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                {EVAL_MODE_OPTIONS.find((o) => o.value === evalMode)?.description}
              </p>
            </div>

            {/* Layout Override */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">Layout</label>
              <select
                value={layoutChoice}
                onChange={(e) => setLayoutChoice(e.target.value as LayoutChoice)}
                className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                {LAYOUT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                {LAYOUT_OPTIONS.find((o) => o.value === layoutChoice)?.description}
              </p>
            </div>

            {/* Template Picker */}
            <div className="mb-4">
              <TemplatePicker selectedId={templateId} onSelect={setTemplateId} />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="w-full px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Orchestrating...
                </>
              ) : (
                'Generate DeepDive'
              )}
            </button>

            {generateTimeMs && (
              <p className="text-[10px] text-slate-500 text-center mt-2">
                Generated in {(generateTimeMs / 1000).toFixed(1)}s
              </p>
            )}
          </div>

          {/* Orchestrator Plan */}
          {generatedData && (
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
              <OrchestratorPlanDisplay data={generatedData} templateId={templateId} />
            </div>
          )}

          {/* Block Inspector */}
          {generatedData && (
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
              <h3 className="text-sm font-bold text-white mb-3">Block Inspector</h3>
              <BlockInspector
                blocks={generatedData.blocks}
                selectedIndex={inspectorIndex}
                onSelect={setInspectorIndex}
              />
            </div>
          )}

          {/* Evaluation Results */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
            <EvaluationResultsPanel />
          </div>
        </div>

        {/* Right Column: Full Render Preview */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 min-h-[calc(100vh-200px)]">
          {generatedData && DeepDiveComponent ? (
            <div className="bg-slate-900/50 rounded-xl overflow-hidden">
              <DeepDiveComponent
                data={{
                  ...generatedData,
                  instanceId: `deep-dive-${Date.now()}`,
                  exhibitId: evaluationContext?.exhibitId,
                  skillId: 'topic-comprehension',
                  subskillId: 'deep-dive-exploration',
                  objectiveId: 'understand-topic',
                  onEvaluationSubmit: handleEvaluationSubmit,
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <span className="text-6xl mb-4">{isGenerating ? '' : '\uD83D\uDD2D'}</span>
              {isGenerating ? (
                <div className="text-center space-y-3">
                  <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
                  <p className="text-slate-300">Orchestrating blocks...</p>
                  <p className="text-xs text-slate-500">Planning layout, then generating all blocks in parallel</p>
                </div>
              ) : (
                <>
                  <p className="text-center">Enter a topic and click Generate to create a DeepDive</p>
                  <p className="text-xs text-slate-600 mt-2">
                    1 orchestrator call + parallel Flash calls = cohesive multi-block lesson
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

// ── Wrapper with EvaluationProvider ─────────────────────────────────

const DeepDiveTester: React.FC<DeepDiveTesterProps> = ({ onBack }) => {
  return (
    <LuminaAIProvider>
      <EvaluationProvider studentId="tester" exhibitId={`deep-dive-test-${Date.now()}`}>
        <DeepDiveTesterInner onBack={onBack} />
      </EvaluationProvider>
    </LuminaAIProvider>
  );
};

export default DeepDiveTester;
