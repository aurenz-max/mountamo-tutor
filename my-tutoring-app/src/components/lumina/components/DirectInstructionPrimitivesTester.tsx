'use client';

import React, { useState, useCallback } from 'react';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { EvaluationProvider } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import DiLetterSounds, { type DiLetterSoundsData } from '../primitives/visual-primitives/direct-instruction/DiLetterSounds';
import DiWordReading, { type DiWordReadingData } from '../primitives/visual-primitives/direct-instruction/DiWordReading';

interface Props { onBack: () => void; }

// The generators are server-only (they import geminiClient). A client tester
// must NEVER import them directly — generate via the eval-test API route.
// One picker drives every DI pack; eval modes must mirror catalog/di.ts.
// 'mixed' pins nothing → generator spread (letter-sounds L1 only).
type DiPrimitiveId = 'di-letter-sounds' | 'di-word-reading';

interface DiPrimitiveOption {
  id: DiPrimitiveId;
  label: string;
  subtitle: string;
  defaultTopic: string;
  evalModes: ReadonlyArray<{ key: string; label: string }>;
}

const DI_PRIMITIVES: DiPrimitiveOption[] = [
  {
    id: 'di-letter-sounds',
    label: 'Letter Sounds',
    subtitle: 'Continuous letter sounds, spoken call-response.',
    defaultTopic: 'letter sounds m, s, a, f',
    evalModes: [
      { key: 'letter_sound', label: 'Letter Sound (isolated)' },
      { key: 'letter_sound_review', label: 'Sound Review (mixed set)' },
      { key: 'first_sound_in_word', label: 'First Sound in a Word' },
      { key: 'mixed', label: 'Mixed (all modes)' },
    ],
  },
  {
    id: 'di-word-reading',
    label: 'Word Reading',
    subtitle: 'Read printed CVC + sight words aloud ("What word?").',
    defaultTopic: 'reading short a words',
    evalModes: [
      { key: 'read_word', label: 'Read a Word' },
    ],
  },
];

type DiData =
  | { id: 'di-letter-sounds'; data: DiLetterSoundsData }
  | { id: 'di-word-reading'; data: DiWordReadingData };

const DirectInstructionPrimitivesTesterContent: React.FC<Props> = ({ onBack }) => {
  const [primitive, setPrimitive] = useState<DiPrimitiveOption>(DI_PRIMITIVES[0]);
  const [generated, setGenerated] = useState<DiData | null>(null);
  const [topic, setTopic] = useState(DI_PRIMITIVES[0].defaultTopic);
  const [evalMode, setEvalMode] = useState<string>(DI_PRIMITIVES[0].evalModes[0].key);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPrimitive = useCallback((opt: DiPrimitiveOption) => {
    setPrimitive(opt);
    setTopic(opt.defaultTopic);
    setEvalMode(opt.evalModes[0].key);
    setGenerated(null);
    setError(null);
  }, []);

  const generate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({
        componentId: primitive.id,
        evalMode,
        topic,
        gradeLevel: 'kindergarten',
        intent: topic,
      });
      const res = await fetch(`/api/lumina/eval-test?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.fullData) {
        throw new Error(json.error || 'Generation failed');
      }
      setGenerated({ id: primitive.id, data: json.fullData } as DiData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }, [topic, evalMode, primitive.id]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm text-white hover:bg-slate-700/50">← Back</button>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Direct Instruction — {primitive.label}</h1>
          <p className="text-xs text-slate-400">{primitive.subtitle} Generate objective-scoped items, then tap the mic to run the live-judged loop.</p>
        </div>
      </div>
      <div className="mb-4 flex items-center gap-2">
        {DI_PRIMITIVES.map((opt) => (
          <button
            key={opt.id}
            onClick={() => pickPrimitive(opt)}
            className={`rounded-full border px-4 py-2 text-sm ${opt.id === primitive.id
              ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
              : 'border-white/10 bg-slate-900/40 text-slate-300 hover:bg-slate-800/50'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-1 rounded border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" placeholder="objective / target items" />
        <select value={evalMode} onChange={(e) => setEvalMode(e.target.value)} className="rounded border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
          {primitive.evalModes.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <button onClick={() => void generate()} disabled={loading} className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 disabled:opacity-40">{loading ? 'Generating…' : 'Generate'}</button>
      </div>
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      {generated?.id === 'di-letter-sounds' && (
        <DiLetterSounds {...generated.data} instanceId="di-tester-1" onEvaluationSubmit={(r) => console.log('[DI eval]', r)} />
      )}
      {generated?.id === 'di-word-reading' && (
        <DiWordReading {...generated.data} instanceId="di-tester-1" onEvaluationSubmit={(r) => console.log('[DI eval]', r)} />
      )}
    </div>
  );
};

const DirectInstructionPrimitivesTester: React.FC<Props> = (props) => (
  <EvaluationProvider><ExhibitProvider objectives={[]} manifestItems={[]}><LuminaAIProvider><DirectInstructionPrimitivesTesterContent {...props} /></LuminaAIProvider></ExhibitProvider></EvaluationProvider>
);

export default DirectInstructionPrimitivesTester;
