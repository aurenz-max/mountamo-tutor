'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { EvaluationProvider } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import DiDiceRoll, { type DiDiceRollData } from '../primitives/visual-primitives/direct-instruction/DiDiceRoll';
import DiLetterSounds, { type DiLetterSoundsData } from '../primitives/visual-primitives/direct-instruction/DiLetterSounds';
import DiWordReading, { type DiWordReadingData } from '../primitives/visual-primitives/direct-instruction/DiWordReading';
import DiMathFacts, { type DiMathFactsData } from '../primitives/visual-primitives/direct-instruction/DiMathFacts';
import DiShapes, { type DiShapesData } from '../primitives/visual-primitives/direct-instruction/DiShapes';
import DiSentenceReading, { type DiSentenceReadingData } from '../primitives/visual-primitives/direct-instruction/DiSentenceReading';
import DiSpokenPractice, { type DiSpokenPracticeData } from '../primitives/visual-primitives/direct-instruction/DiSpokenPractice';
import { DiSpokenPracticeScriptPanel } from '../primitives/visual-primitives/direct-instruction/DiSpokenPracticeScriptPanel';
import DiWorkedProcedure, { type DiWorkedProcedureData } from '../primitives/visual-primitives/direct-instruction/DiWorkedProcedure';
import DiDeduction, { type DiDeductionData } from '../primitives/visual-primitives/direct-instruction/DiDeduction';
import DiWordProblemSetup, { type DiWordProblemSetupData } from '../primitives/visual-primitives/direct-instruction/DiWordProblemSetup';
import { DiRunLogPanel } from '../primitives/visual-primitives/direct-instruction/DiRunLogPanel';
import {
  DI_TESTER_PRESETS,
  DI_TESTER_PRIMITIVES,
  getDiTesterPrimitive,
  type DiPrimitiveId,
  type DiSupportTier,
  type DiTesterPreset,
} from './di-tester/diTesterLibrary';

interface Props {
  onBack: () => void;
}

type TesterMode = 'presets' | 'custom';

type DiData =
  | { id: 'di-dice-roll'; data: DiDiceRollData }
  | { id: 'di-letter-sounds'; data: DiLetterSoundsData }
  | { id: 'di-word-reading'; data: DiWordReadingData }
  | { id: 'di-math-facts'; data: DiMathFactsData }
  | { id: 'di-shapes'; data: DiShapesData }
  | { id: 'di-sentence-reading'; data: DiSentenceReadingData }
  | { id: 'di-spoken-practice'; data: DiSpokenPracticeData }
  | { id: 'di-worked-procedure'; data: DiWorkedProcedureData }
  | { id: 'di-deduction'; data: DiDeductionData }
  | { id: 'di-word-problem-setup'; data: DiWordProblemSetupData };

interface RunRequest {
  primitiveId: DiPrimitiveId;
  evalMode: string;
  objective: string;
  gradeLevel: string;
  difficulty: DiSupportTier;
  presetId?: string;
}

interface RunValidation {
  challengeCount?: number;
  typesFound?: string[];
  disallowedTypes?: string[];
  error?: string;
  payloadBytes?: number;
  runawaySuspect?: boolean;
  runawayError?: string;
}

interface CompletedRun extends RunRequest {
  status: 'pass' | 'fail' | 'unknown';
  duration?: number;
  validation?: RunValidation;
}

const GRADE_OPTIONS = [
  'kindergarten',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
];

const inputClass =
  'w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10';

const formatBytes = (bytes: number | undefined) => {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const RenderedPrimitive: React.FC<{ generated: DiData; runKey: number }> = ({ generated, runKey }) => {
  const evaluationProps = {
    instanceId: `di-tester-${runKey}`,
    onEvaluationSubmit: (result: unknown) => console.log('[DI tester evaluation]', result),
  };

  switch (generated.id) {
    case 'di-dice-roll':
      return <DiDiceRoll key={runKey} data={{ ...generated.data, ...evaluationProps }} />;
    case 'di-letter-sounds':
      return <DiLetterSounds key={runKey} data={{ ...generated.data, ...evaluationProps }} />;
    case 'di-word-reading':
      return <DiWordReading key={runKey} data={{ ...generated.data, ...evaluationProps }} />;
    case 'di-math-facts':
      return <DiMathFacts key={runKey} data={{ ...generated.data, ...evaluationProps }} />;
    case 'di-shapes':
      return <DiShapes key={runKey} data={{ ...generated.data, ...evaluationProps }} />;
    case 'di-sentence-reading':
      return <DiSentenceReading key={runKey} data={{ ...generated.data, ...evaluationProps }} />;
    case 'di-spoken-practice':
      return (
        <>
          <DiSpokenPractice key={runKey} data={{ ...generated.data, ...evaluationProps }} />
          <DiSpokenPracticeScriptPanel items={generated.data.items} />
        </>
      );
    case 'di-worked-procedure':
      return <DiWorkedProcedure key={runKey} data={{ ...generated.data, ...evaluationProps }} />;
    case 'di-deduction':
      return <DiDeduction key={runKey} data={{ ...generated.data, ...evaluationProps }} />;
    case 'di-word-problem-setup':
      return <DiWordProblemSetup key={runKey} data={{ ...generated.data, ...evaluationProps }} />;
  }
};

const DirectInstructionPrimitivesTesterContent: React.FC<Props> = ({ onBack }) => {
  const initialPrimitive = DI_TESTER_PRIMITIVES[0];
  const initialPreset = initialPrimitive.presets[0];
  const [mode, setMode] = useState<TesterMode>('presets');
  const [primitiveId, setPrimitiveId] = useState<DiPrimitiveId>(initialPrimitive.id);
  const [evalMode, setEvalMode] = useState(initialPreset.evalMode);
  const [objective, setObjective] = useState(initialPreset.objective);
  const [gradeLevel, setGradeLevel] = useState(initialPreset.gradeLevel);
  const [difficulty, setDifficulty] = useState<DiSupportTier>(initialPreset.difficulty);
  const [generated, setGenerated] = useState<DiData | null>(null);
  const [completedRun, setCompletedRun] = useState<CompletedRun | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const primitive = useMemo(() => getDiTesterPrimitive(primitiveId), [primitiveId]);
  const selectedMode = primitive.evalModes.find((candidate) => candidate.evalMode === evalMode)
    ?? primitive.evalModes[0];

  const applyPreset = useCallback((preset: DiTesterPreset) => {
    setPrimitiveId(preset.primitiveId);
    setEvalMode(preset.evalMode);
    setObjective(preset.objective);
    setGradeLevel(preset.gradeLevel);
    setDifficulty(preset.difficulty);
    setError(null);
  }, []);

  const selectPrimitive = useCallback((id: DiPrimitiveId) => {
    const next = getDiTesterPrimitive(id);
    const preset = next.presets[0];
    setPrimitiveId(id);
    setEvalMode(preset.evalMode);
    setObjective(preset.objective);
    setGradeLevel(preset.gradeLevel);
    setDifficulty(preset.difficulty);
    setError(null);
  }, []);

  const selectCustomMode = useCallback((nextEvalMode: string) => {
    setEvalMode(nextEvalMode);
    const preset = primitive.presets.find((candidate) => candidate.evalMode === nextEvalMode);
    if (preset) {
      setObjective(preset.objective);
      setGradeLevel(preset.gradeLevel);
      setDifficulty(preset.difficulty);
    }
  }, [primitive.presets]);

  const generate = useCallback(async (request: RunRequest) => {
    if (!request.objective.trim()) {
      setError('Add an objective before generating a run.');
      return;
    }

    setLoadingId(request.presetId ?? 'custom');
    setError(null);
    setCopied(false);
    try {
      const params = new URLSearchParams({
        componentId: request.primitiveId,
        evalMode: request.evalMode,
        topic: request.objective.trim(),
        gradeLevel: request.gradeLevel,
        intent: request.objective.trim(),
      });
      if (request.difficulty) params.set('difficulty', request.difficulty);

      const response = await fetch(`/api/lumina/eval-test?${params.toString()}`);
      const json = await response.json();
      if (!response.ok || !json.fullData) {
        throw new Error(json.error || 'Generation failed');
      }

      setGenerated({ id: request.primitiveId, data: json.fullData } as DiData);
      setCompletedRun({
        ...request,
        status: json.status === 'pass' || json.status === 'fail' ? json.status : 'unknown',
        duration: typeof json.duration === 'number' ? json.duration : undefined,
        validation: json.validation,
      });
      setRunKey((key) => key + 1);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Generation failed');
    } finally {
      setLoadingId(null);
    }
  }, []);

  const runPreset = useCallback((preset: DiTesterPreset) => {
    applyPreset(preset);
    void generate({
      primitiveId: preset.primitiveId,
      evalMode: preset.evalMode,
      objective: preset.objective,
      gradeLevel: preset.gradeLevel,
      difficulty: preset.difficulty,
      presetId: preset.id,
    });
  }, [applyPreset, generate]);

  const runCustom = useCallback(() => {
    void generate({ primitiveId, evalMode, objective, gradeLevel, difficulty });
  }, [difficulty, evalMode, generate, gradeLevel, objective, primitiveId]);

  const copyPayload = useCallback(async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(JSON.stringify(generated.data, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [generated]);

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 pb-20 sm:px-6">
      <header className="flex flex-col gap-5 border-b border-white/10 py-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <button onClick={onBack} className="mt-0.5 inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm text-white transition hover:bg-slate-800">
            <span aria-hidden="true">←</span> Back
          </button>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Developer test surface</p>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">Direct Instruction Lab</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">Run a curated example for every production evaluation mode, or build an objective-scoped run of your own.</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 pl-0 sm:pl-4">
          <span className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">{DI_TESTER_PRIMITIVES.length} primitives</span>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200">{DI_TESTER_PRESETS.length} eval modes</span>
        </div>
      </header>

      <section className="py-6">
        <div className="mb-5 inline-flex rounded-xl border border-white/10 bg-slate-950/50 p-1" role="tablist" aria-label="Tester mode">
          <button type="button" role="tab" aria-selected={mode === 'presets'} onClick={() => setMode('presets')} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === 'presets' ? 'bg-cyan-500/20 text-cyan-100 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Example library</button>
          <button type="button" role="tab" aria-selected={mode === 'custom'} onClick={() => setMode('custom')} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === 'custom' ? 'bg-cyan-500/20 text-cyan-100 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Custom run</button>
        </div>

        {mode === 'presets' ? (
          <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <nav className="rounded-2xl border border-white/10 bg-slate-900/40 p-2" aria-label="Direct Instruction primitives">
              <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Primitive family</p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
                {DI_TESTER_PRIMITIVES.map((candidate) => (
                  <button key={candidate.id} type="button" onClick={() => selectPrimitive(candidate.id)} className={`flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${candidate.id === primitiveId ? 'bg-cyan-500/15 text-cyan-100 ring-1 ring-inset ring-cyan-400/30' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                    <span className="truncate text-sm font-medium">{candidate.shortLabel}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${candidate.id === primitiveId ? 'bg-cyan-400/15 text-cyan-200' : 'bg-slate-800 text-slate-500'}`}>{candidate.presets.length}</span>
                  </button>
                ))}
              </div>
            </nav>

            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 sm:p-5">
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">{primitive.label}</h2>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">{primitive.id}</span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{primitive.subtitle}</p>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {primitive.presets.map((preset) => {
                  const isLoading = loadingId === preset.id;
                  const isActive = evalMode === preset.evalMode;
                  return (
                    <article key={preset.id} className={`flex flex-col rounded-xl border p-4 transition ${isActive ? 'border-cyan-400/30 bg-cyan-500/[0.06]' : 'border-white/10 bg-slate-950/30 hover:border-white/20'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-slate-100">{preset.label}</h3>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">{preset.evalMode}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-400">β {preset.beta}</span>
                          <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-400">Mode {preset.scaffoldingMode}</span>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-400">{preset.description}</p>
                      <div className="mt-3 rounded-lg border border-white/[0.07] bg-slate-950/50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Preset objective</p>
                        <p className="mt-1 text-sm text-slate-200">{preset.objective}</p>
                        <p className="mt-1.5 text-[11px] text-slate-500">{preset.gradeLevel} · {preset.difficulty || 'default support'}</p>
                      </div>
                      <button type="button" disabled={loadingId !== null} onClick={() => runPreset(preset)} className="mt-3 inline-flex items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-wait disabled:opacity-50">
                        {isLoading ? 'Generating…' : 'Run this example'}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">Custom generation</h2>
              <p className="mt-1 text-sm text-slate-400">Use the real eval-test route with explicit production inputs.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">Primitive</span>
                <select value={primitiveId} onChange={(event) => selectPrimitive(event.target.value as DiPrimitiveId)} className={inputClass}>
                  {DI_TESTER_PRIMITIVES.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">Evaluation mode</span>
                <select value={evalMode} onChange={(event) => selectCustomMode(event.target.value)} className={inputClass}>
                  {primitive.evalModes.map((candidate) => <option key={candidate.evalMode} value={candidate.evalMode}>{candidate.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">Grade</span>
                <select value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)} className={inputClass}>
                  {GRADE_OPTIONS.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">Support tier</span>
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as DiSupportTier)} className={inputClass}>
                  <option value="">Default (easy)</option>
                  <option value="easy">Easy — model + guide</option>
                  <option value="medium">Medium — model only</option>
                  <option value="hard">Hard — cold ask</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Objective / content scope</span>
              <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={2} className={`${inputClass} resize-y`} placeholder="Describe exactly what this generated run should practice" />
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">β {selectedMode.beta} · scaffolding mode {selectedMode.scaffoldingMode} · {selectedMode.description}</p>
              <button type="button" onClick={runCustom} disabled={loadingId !== null || !objective.trim()} className="shrink-0 rounded-xl border border-cyan-400/30 bg-cyan-500/20 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-wait disabled:opacity-50">
                {loadingId === 'custom' ? 'Generating…' : 'Generate run'}
              </button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"><span className="font-semibold">Generation failed:</span> {error}</div>
      )}

      <section aria-label="Generated Direct Instruction run" className="border-t border-white/10 pt-6">
        {!generated || !completedRun ? (
          <div className="flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/10 text-xl text-cyan-300" aria-hidden="true">▶</div>
              <h2 className="font-medium text-slate-200">No test run loaded</h2>
              <p className="mt-1 text-sm text-slate-500">Choose any example above for a known-good starting point.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${completedRun.status === 'pass' ? 'bg-emerald-500/15 text-emerald-300' : completedRun.status === 'fail' ? 'bg-amber-500/15 text-amber-200' : 'bg-slate-700 text-slate-300'}`}>Contract {completedRun.status}</span>
                    <span className="font-medium text-white">{getDiTesterPrimitive(completedRun.primitiveId).label}</span>
                    <span className="font-mono text-xs text-cyan-300">{completedRun.evalMode}</span>
                  </div>
                  <p className="mt-2 truncate text-sm text-slate-300">{completedRun.objective}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {completedRun.gradeLevel} · {completedRun.difficulty || 'default support'}
                    {completedRun.duration != null ? ` · generated in ${(completedRun.duration / 1000).toFixed(1)}s` : ''}
                    {completedRun.validation?.challengeCount != null ? ` · ${completedRun.validation.challengeCount} challenges` : ''}
                    {formatBytes(completedRun.validation?.payloadBytes) ? ` · ${formatBytes(completedRun.validation?.payloadBytes)}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setRunKey((key) => key + 1)} className="shrink-0 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700">Reset this run</button>
              </div>
              {completedRun.status === 'fail' && (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{completedRun.validation?.runawayError || completedRun.validation?.error || `Unexpected challenge types: ${(completedRun.validation?.disallowedTypes ?? []).join(', ') || 'see payload'}`}</p>
              )}
            </div>

            <RenderedPrimitive generated={generated} runKey={runKey} />
            <DiRunLogPanel />

            <details className="rounded-2xl border border-white/10 bg-slate-900/40">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-300 hover:text-white">Generated payload</summary>
              <div className="border-t border-white/10 p-4">
                <div className="mb-2 flex justify-end">
                  <button type="button" onClick={() => void copyPayload()} className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">{copied ? 'Copied' : 'Copy JSON'}</button>
                </div>
                <pre className="max-h-[34rem] overflow-auto rounded-xl bg-slate-950/70 p-4 text-xs leading-5 text-slate-300">{JSON.stringify(generated.data, null, 2)}</pre>
              </div>
            </details>
          </div>
        )}
      </section>
    </div>
  );
};

const DirectInstructionPrimitivesTester: React.FC<Props> = (props) => (
  <EvaluationProvider>
    <ExhibitProvider objectives={[]} manifestItems={[]}>
      <LuminaAIProvider>
        <DirectInstructionPrimitivesTesterContent {...props} />
      </LuminaAIProvider>
    </ExhibitProvider>
  </EvaluationProvider>
);

export default DirectInstructionPrimitivesTester;
