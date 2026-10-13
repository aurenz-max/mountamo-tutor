'use client';

import React, { useEffect, useState } from 'react';
import { LuminaButton, LuminaCard, LuminaCardContent, LuminaInput } from '../ui';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import CuratorBrief from '../primitives/CuratorBrief';
import { teachingScene } from '../primitives/curatorBriefWorkspace';
import type { IntroBriefingData } from '../types';

/**
 * Dev-only lab for the lesson opening: generate one brief through the real generator (the eval-test
 * route), render it with the registered component, and show the scene facts the tutor would receive.
 * `?topic=…&grade=…&auto=1` generates on load, for headless checks.
 */
export default function BriefLab() {
  const [topic, setTopic] = useState('Recognizing and Creating Patterns: extend AB patterns with colors, shapes, or sounds');
  const [grade, setGrade] = useState('kindergarten');
  const [data, setData] = useState<IntroBriefingData | null>(null);
  const [status, setStatus] = useState('');

  const generate = async (t = topic, g = grade) => {
    setStatus('Generating…'); setData(null);
    const u = new URL('/api/lumina/eval-test', window.location.origin);
    u.searchParams.set('componentId', 'curator-brief'); u.searchParams.set('evalMode', 'default');
    u.searchParams.set('topic', t); u.searchParams.set('gradeLevel', g);
    const t0 = performance.now();
    try {
      const r = await (await fetch(u)).json();
      if (r.status !== 'pass') { setStatus(`Failed: ${r.error ?? r.status}`); return; }
      setData(r.fullData ?? r.data);
      setStatus(`Generated in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    } catch (e) { setStatus(`Failed: ${(e as Error).message}`); }
  };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('topic'), g = q.get('grade');
    if (t) setTopic(t);
    if (g) setGrade(g);
    if (q.get('auto') === '1') void generate(t ?? topic, g ?? grade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-light text-slate-100">Lesson opening lab</h1>
      <LuminaCard>
        <LuminaCardContent className="flex flex-col gap-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <LuminaInput aria-label="Topic" value={topic} onChange={e => setTopic(e.target.value)} />
            <LuminaInput aria-label="Grade" value={grade} onChange={e => setGrade(e.target.value)} />
            <LuminaButton tone="primary" onClick={() => generate()}>Generate</LuminaButton>
          </div>
          {status && <p className="text-sm text-slate-400" data-testid="brief-lab-status">{status}</p>}
        </LuminaCardContent>
      </LuminaCard>
      {/* The provider the legacy read-aloud needs. As in the primitive testers, a signed-in browser opens a
          standalone tutor session on mount; signed out (headless checks) it never connects. */}
      {data ? <LuminaAIProvider><CuratorBrief data={data} /></LuminaAIProvider> : null}
      {data ? (
        <details className="text-xs text-slate-400"><summary className="cursor-pointer">Tutor scene facts</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900/60 p-3" data-testid="brief-lab-facts">
            {JSON.stringify(teachingScene(data, { picture: 'drawn', picked: null, started: false }), null, 2)}
          </pre></details>
      ) : null}
    </div>
  );
}
