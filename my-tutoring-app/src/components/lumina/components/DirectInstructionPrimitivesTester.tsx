'use client';

import React, { useState, useCallback } from 'react';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { EvaluationProvider } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import DiLetterSounds, { type DiLetterSoundsData } from '../primitives/visual-primitives/direct-instruction/DiLetterSounds';

interface Props { onBack: () => void; }

// The generator is server-only (it imports geminiClient). A client tester must
// NEVER import it directly — generate via the eval-test API route instead.
const DirectInstructionPrimitivesTesterContent: React.FC<Props> = ({ onBack }) => {
  const [data, setData] = useState<DiLetterSoundsData | null>(null);
  const [topic, setTopic] = useState('letter sounds m, s, a, f');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({
        componentId: 'di-letter-sounds',
        evalMode: 'letter_sound',
        topic,
        gradeLevel: 'kindergarten',
        intent: topic,
      });
      const res = await fetch(`/api/lumina/eval-test?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.fullData) {
        throw new Error(json.error || 'Generation failed');
      }
      setData(json.fullData as DiLetterSoundsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }, [topic]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm text-white hover:bg-slate-700/50">← Back</button>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Direct Instruction — Letter Sounds</h1>
          <p className="text-xs text-slate-400">Generate objective-scoped items, then tap the mic to run the live-judged loop.</p>
        </div>
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-1 rounded border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" placeholder="objective / target letters" />
        <button onClick={() => void generate()} disabled={loading} className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 disabled:opacity-40">{loading ? 'Generating…' : 'Generate'}</button>
      </div>
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      {data && <DiLetterSounds {...data} instanceId="di-tester-1" onEvaluationSubmit={(r) => console.log('[DI eval]', r)} />}
    </div>
  );
};

const DirectInstructionPrimitivesTester: React.FC<Props> = (props) => (
  <EvaluationProvider><ExhibitProvider objectives={[]} manifestItems={[]}><LuminaAIProvider><DirectInstructionPrimitivesTesterContent {...props} /></LuminaAIProvider></ExhibitProvider></EvaluationProvider>
);

export default DirectInstructionPrimitivesTester;
