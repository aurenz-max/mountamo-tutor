'use client';

import React, { useState } from 'react';
import { LuminaButton, LuminaCard, LuminaCardContent, LuminaInput } from '../ui';
import { DRAWER_CATALOG } from '../service/manifest/catalog/drawers';
import { PRIMITIVE_REGISTRY } from '../config/primitiveRegistry';
import type { ComponentId } from '../types';

/**
 * Dev-only lab for drawers: generate one drawer through the real generator (the eval-test route)
 * and render it with its registered component. Every drawer kind in DRAWER_CATALOG appears here.
 */
/** A topic and grade each kind fits, so switching kind gives a sensible first generation. */
const EXAMPLES: Record<string, [string, string]> = {
  'drawer-model-slider': ['Stopping distance and speed', 'grade 7'],
  'drawer-part-whole': ['What air is made of', 'grade 5'],
  'drawer-cause-chain': ['Sea otters, urchins and kelp forests', 'grade 5'],
  'drawer-magnitude-ladder': ['Sizes from a cell to a planet', 'grade 6'],
  'drawer-band-scale': ['Acids, bases and the pH scale', 'grade 7'],
  'drawer-range-bars': ['How animals hear different sounds', 'grade 4'],
  'drawer-metric-switch': ['Comparing the planets', 'grade 5'],
  'drawer-unit-chain': ['How many times does your heart beat in a lifetime', 'grade 6'],
  'drawer-ratio-scaler': ['Scaling a recipe with ratios', 'grade 6'],
  'drawer-growth-race': ['Linear and exponential growth', 'grade 8'],
  'drawer-chance-run': ['Probability with two dice', 'grade 7'],
  'drawer-cycle-wheel': ['The water cycle', 'grade 2'],
  'drawer-story-arc': ['The Three Little Pigs: beginning, middle and end', 'grade 1'],
  'drawer-then-and-now': ['Daily life long ago and today', 'grade 2'],
  'drawer-perspective-lens': ['The Boston Tea Party', 'grade 5'],
  'drawer-word-anatomy': ['Prefixes un- and re- and the suffix -able', 'grade 3'],
  'drawer-shades-of-meaning': ['Shades of meaning: words for big', 'kindergarten'],
  'drawer-rhythm-grid': ['Steady beat and rhythm: quarter and eighth notes', 'grade 2'],
};

export default function DrawerLab() {
  const [kind, setKind] = useState<string>(DRAWER_CATALOG[0].id);
  const [topic, setTopic] = useState('Stopping distance and speed');
  const [grade, setGrade] = useState('grade 7');
  const [data, setData] = useState<unknown>(null);
  const [status, setStatus] = useState('');

  const generate = async () => {
    setStatus('Generating…'); setData(null);
    const u = new URL('/api/lumina/eval-test', window.location.origin);
    u.searchParams.set('componentId', kind); u.searchParams.set('evalMode', 'default');
    u.searchParams.set('topic', topic); u.searchParams.set('gradeLevel', grade);
    const t0 = performance.now();
    try {
      const r = await (await fetch(u)).json();
      if (r.status !== 'pass') { setStatus(`Failed: ${r.error ?? r.status}`); return; }
      setData(r.fullData ?? r.data);
      setStatus(`Generated in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    } catch (e) { setStatus(`Failed: ${(e as Error).message}`); }
  };

  const Component = PRIMITIVE_REGISTRY[kind as ComponentId]?.component as React.ComponentType<{ data: unknown }> | undefined;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-light text-slate-100">Drawer lab</h1>
      <LuminaCard>
        <LuminaCardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap gap-2">
            {DRAWER_CATALOG.map(d => (
              <LuminaButton key={d.id} tone={d.id === kind ? 'primary' : 'ghost'} onClick={() => { setKind(d.id); setData(null); setStatus(''); if (EXAMPLES[d.id]) { setTopic(EXAMPLES[d.id][0]); setGrade(EXAMPLES[d.id][1]); } }}>{d.id.replace('drawer-', '')}</LuminaButton>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <LuminaInput aria-label="Topic" value={topic} onChange={e => setTopic(e.target.value)} />
            <LuminaInput aria-label="Grade" value={grade} onChange={e => setGrade(e.target.value)} />
            <LuminaButton tone="primary" onClick={generate}>Generate</LuminaButton>
          </div>
          {status && <p className="text-sm text-slate-400" data-testid="drawer-lab-status">{status}</p>}
        </LuminaCardContent>
      </LuminaCard>
      {Component && data ? <Component data={data} /> : null}
      {data ? (
        <details className="text-xs text-slate-400"><summary className="cursor-pointer">Spec</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900/60 p-3">{JSON.stringify(data, null, 2)}</pre></details>
      ) : null}
    </div>
  );
}
