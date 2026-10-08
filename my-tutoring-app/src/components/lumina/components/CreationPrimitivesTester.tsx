'use client';

import React, { useId, useState } from 'react';
import OpenBuilder, { type OpenBuilderData } from '../primitives/visual-primitives/creation/OpenBuilder';
import { SCENES, SCENE_IDS, presetProjects, type SceneId } from '../primitives/visual-primitives/creation/openBuilderModel';
import { TesterWorkspace, testerBinds } from './live-activity/TesterWorkspace';
import { EvaluationProvider, useEvaluationContext, type PrimitiveEvaluationResult } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';

interface CreationPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'open-builder';
type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school';

const PRIMITIVE_OPTIONS: Array<{ value: PrimitiveType; label: string; icon: string; topic: string; evalMode: string }> = [
  { value: 'open-builder', label: 'Open Builder', icon: '🧱', topic: 'Engineering design: build something that does a job', evalMode: 'build_to_goal' },
];

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'toddler', label: 'Toddler' },
  { value: 'preschool', label: 'Preschool' },
  { value: 'kindergarten', label: 'Kindergarten' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'middle-school', label: 'Middle School' },
  { value: 'high-school', label: 'High School' },
];

/** The tester's own render, used only when the catalog does not bind this family to the workspace. */
const PrimitiveRenderer: React.FC<{
  componentId: PrimitiveType;
  data: unknown;
  instanceId: string;
  onEvaluationSubmit: (result: PrimitiveEvaluationResult) => void;
}> = ({ componentId, data, instanceId, onEvaluationSubmit }) => {
  switch (componentId) {
    case 'open-builder':
      return <OpenBuilder data={{ ...(data as OpenBuilderData), instanceId, onEvaluationSubmit }} />;
    default:
      return null;
  }
};

const EvaluationResultsPanel: React.FC = () => {
  const context = useEvaluationContext();
  if (!context) {
    return (
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <p className="text-slate-500 text-sm">Evaluation tracking not available (no provider)</p>
      </div>
    );
  }
  const { submittedResults, getSessionSummary } = context;
  const summary = getSessionSummary();

  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-4">
      <h4 className="text-lg font-semibold text-white">Evaluation Results</h4>
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

      {submittedResults.length > 0 ? (
        <div className="max-h-48 overflow-y-auto space-y-2">
          {submittedResults.slice(-5).reverse().map((result) => (
            <div key={result.attemptId} className={`p-3 rounded-lg border ${
              result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                  {result.success ? '✓ Success' : '✗ Incomplete'}
                </span>
                <span className="text-xs text-slate-400">{result.score}%</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{result.metrics.type}</p>
              {result.metrics.type === 'open-builder' && (
                <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                  <span>Mode: {result.metrics.challengeType}</span>
                  <span>Correct: {result.metrics.correctCount}/{result.metrics.totalChallenges}</span>
                  <span>First try: {result.metrics.firstTryCount}</span>
                  <span>Attempts: {result.metrics.attemptsCount}</span>
                  <span>Avg attempts: {result.metrics.averageAttemptsPerChallenge.toFixed(1)}</span>
                  <span>Accuracy: {result.metrics.overallAccuracy.toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 text-sm">
          No evaluation results yet. Complete a primitive activity to see results.
        </div>
      )}
    </div>
  );
};

const CreationPrimitivesTesterInner: React.FC<CreationPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('open-builder');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<unknown>(null);
  const [generationKey, setGenerationKey] = useState(0);
  const [showJson, setShowJson] = useState(false);
  // Offline: play the bound item on the real runtime and lever ladder, with no paid Live session.
  const [tutorMode, setTutorMode] = useState<'offline' | 'live'>('offline');
  const helperId = useId();
  const previewInstanceId = `creation-helper-${helperId}-${selectedPrimitive}-${generationKey}`;

  const selectedOption = PRIMITIVE_OPTIONS.find(p => p.value === selectedPrimitive)!;
  const currentTopic = topic.trim() || selectedOption.topic;
  const evalMode = selectedOption.evalMode;

  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    console.log('Evaluation submitted:', result);
  };

  /** Hand-made projects from the scenes, no generation call: one scene, or all of them in a row. */
  const [presetScene, setPresetScene] = useState<SceneId | 'all'>('all');
  const loadPreset = () => {
    const challenges = presetProjects(presetScene === 'all' ? SCENE_IDS : [presetScene]);
    const data: OpenBuilderData = { title: 'Little Builders', description: 'Build with blocks to do what the project asks. There are lots of ways to do it!',
      challenges, challengeType: 'build_to_goal', gradeBand: 'K-2' };
    setError(null); setGeneratedData(data); setGenerationKey(k => k + 1);
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
          params: { componentId: selectedPrimitive, topic: currentTopic, gradeLevel, config: { targetEvalMode: evalMode } },
        }),
      });
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      const result = await response.json();
      setGeneratedData(result.data || result);
      setGenerationKey(k => k + 1);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate primitive');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <EvaluationProvider sessionId={`creation-tester-${helperId}`} exhibitId="creation-primitives-tester"
      topic={currentTopic} gradeLevel={gradeLevel}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-amber-950/20 to-slate-950">
        <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
          <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors text-sm">&larr; Back</button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><span>🏗️</span><span>Creation Primitives Tester</span></h1>
          </div>
        </div>

        <div className="flex h-[calc(100vh-73px)]">
          <div className="w-[300px] border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0 space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Primitive</label>
              <div className="space-y-1">
                {PRIMITIVE_OPTIONS.map(option => (
                  <button key={option.value} onClick={() => { setSelectedPrimitive(option.value); setGeneratedData(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${selectedPrimitive === option.value
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                    <span className="text-lg mr-2">{option.icon}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Topic</label>
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder={selectedOption.topic}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Grade Level</label>
              <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value as GradeLevel)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg"><p className="text-red-400 text-xs">{error}</p></div>
            )}

            <button onClick={handleGenerate} disabled={isGenerating}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isGenerating ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>) : (<><span>✨</span>Generate with AI</>)}
            </button>
            <p className="text-xs text-slate-500 text-center">Mode: {evalMode}</p>

            {selectedPrimitive === 'open-builder' && (
              <div className="space-y-2 border-t border-slate-800 pt-4">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Preset scene (no generation)</label>
                <select aria-label="Preset scene" value={presetScene} onChange={e => setPresetScene(e.target.value as SceneId | 'all')}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="all">All {SCENE_IDS.length} scenes in a row</option>
                  {SCENE_IDS.map(id => <option key={id} value={id}>{SCENES[id].title}</option>)}
                </select>
                <button onClick={loadPreset}
                  className="w-full rounded-lg border border-amber-600/60 bg-slate-800 py-2 text-sm font-semibold text-amber-200 hover:bg-slate-700">
                  Load preset
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-[1600px] mx-auto space-y-6">
              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Preview</h3>
                  {generatedData != null && testerBinds(selectedPrimitive, previewInstanceId, evalMode, generatedData) && (
                    <div role="radiogroup" aria-label="Tutor" className="flex rounded-lg border border-slate-600 text-xs">
                      {(['offline', 'live'] as const).map(m => (
                        <button key={m} type="button" role="radio" aria-checked={tutorMode === m} onClick={() => setTutorMode(m)}
                          className={`px-3 py-1 ${tutorMode === m ? 'bg-cyan-600/40 text-cyan-100' : 'text-slate-400'}`}>
                          {m === 'offline' ? 'Offline levers (free)' : 'Live tutor (paid)'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {generatedData != null ? (
                  <div key={`${previewInstanceId}-${tutorMode}`} data-primitive-instance-id={previewInstanceId}>
                    <TesterWorkspace primitiveId={selectedPrimitive} instanceId={previewInstanceId} evalMode={evalMode}
                      offline={tutorMode === 'offline'} data={generatedData} topic={currentTopic} gradeLevel={gradeLevel}
                      onEvaluationSubmit={handleEvaluationSubmit}>
                      <PrimitiveRenderer componentId={selectedPrimitive} data={generatedData} instanceId={previewInstanceId}
                        onEvaluationSubmit={handleEvaluationSubmit} />
                    </TesterWorkspace>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
                    <span className="text-5xl mb-4">{selectedOption.icon}</span>
                    <p className="text-base">Click <span className="text-amber-400">Generate with AI</span> to create an {selectedOption.label.toLowerCase()} item</p>
                  </div>
                )}
              </div>

              <EvaluationResultsPanel />

              {generatedData != null && (
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <button onClick={() => setShowJson(!showJson)}
                    className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1">
                    <span className={`inline-block transition-transform ${showJson ? 'rotate-90' : ''}`}>&#9654;</span>
                    Generated JSON
                  </button>
                  {showJson && (
                    <pre className="mt-2 text-xs text-slate-400 overflow-auto max-h-64 bg-slate-900/50 p-3 rounded-lg">
                      {JSON.stringify(generatedData, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </EvaluationProvider>
  );
};

export const CreationPrimitivesTester: React.FC<CreationPrimitivesTesterProps> = (props) => (
  <ExhibitProvider objectives={[]} manifestItems={[]}>
    <LuminaAIProvider>
      <CreationPrimitivesTesterInner {...props} />
    </LuminaAIProvider>
  </ExhibitProvider>
);

export default CreationPrimitivesTester;
