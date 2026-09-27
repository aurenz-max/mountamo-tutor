'use client';

import React, { useEffect, useState } from 'react';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { LiveRuntimeContext, usePrimitiveRuntime, useRuntimeSnapshot } from './LiveRuntimeContext';
import { LiveRuntimeSurface, SupportArtifactCard } from './LiveRuntimeSurface';
import { DEMO_FIXTURES, demonstrationArtifact } from '../demo/demoFixtures';
import { createRuntimeFixture } from './runtimeFixture';

export function ReferenceTask({ fixture, onChecked }: { fixture: ReturnType<typeof createRuntimeFixture>; onChecked?: () => void }) {
  const { runtime, changed } = usePrimitiveRuntime(fixture.mount);
  const [draft, setDraft] = useState('');
  const state = useRuntimeSnapshot(runtime!);
  useEffect(() => { setDraft(''); }, [state.task?.itemId]);
  return <div className="space-y-4">
    <p className={fixture.pointed ? 'text-amber-300' : ''}>{state.task?.task}</p>
    {state.task?.support.level === 3 && <p>Subtracting means taking away. The amount gets smaller.</p>}
    <label className="block">Your answer <input aria-label="Your answer" value={draft}
      className="ml-3 rounded border p-2 text-slate-950" onChange={e => setDraft(e.target.value)} /></label>
    <button onClick={() => { if (fixture.respond(draft)) { changed(); onChecked?.(); } }}>Check answer</button>
    <p>Checked result: {state.task?.evidence.correctness ?? 'unknown'}</p>
    <p>Instruction replays: {fixture.replays}</p>
  </div>;
}

/** Composed demonstrations (LA-15) drawn in the detour card, from the bench's own scripts. */
function DemonstrationPreview() {
  const [id, setId] = useState(DEMO_FIXTURES[0].id);
  const fixture = DEMO_FIXTURES.find(f => f.id === id)!;
  return <section aria-label="Composed demonstrations" className="space-y-4">
    <h2 className="text-xl font-bold">Composed demonstrations</h2>
    <div className="flex flex-wrap gap-3">
      {DEMO_FIXTURES.map(f => <button key={f.id} data-demo-fixture={f.id} aria-pressed={f.id === id}
        className={`rounded border px-3 py-2 ${f.id === id ? 'border-cyan-400 text-cyan-200' : ''}`} onClick={() => setId(f.id)}>{f.id}</button>)}
    </div>
    <p className="text-slate-400">Student: {fixture.obstacle}</p>
    <SupportArtifactCard key={id} label="Demonstration preview" artifact={demonstrationArtifact(fixture.script, `demo-${id}`)} />
  </section>;
}

/** No model, microphone, generation or learning-record writes. A repeatable infrastructure proof. */
export default function LiveRuntimeLab() {
  const [runtime] = useState(() => new LiveLessonRuntime('runtime-lab', {
    maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true,
  }));
  const [fixture] = useState(() => createRuntimeFixture());
  const state = useRuntimeSnapshot(runtime);
  const [lastReceipt, setLastReceipt] = useState('No commands yet');
  const [releaseTurn, setReleaseTurn] = useState<(() => void) | null>(null);
  const [completions, setCompletions] = useState(0);
  useEffect(() => runtime.onCompletion(() => setCompletions(n => n + 1)), [runtime]);
  return <LiveRuntimeContext.Provider value={runtime}>
    <main className="min-h-screen space-y-6 bg-slate-950 p-8 text-slate-100">
      <h1 className="text-2xl font-bold">Live lesson runtime lab</h1>
      <a className="underline" href="/lumina/live-activity">Open the existing live activity demo</a>
      <p>Infrastructure reference task. No real tutor or student records. This example exposes the answer; assistance stays recorded after return.</p>
      <LiveRuntimeSurface runtime={runtime}><ReferenceTask fixture={fixture} /></LiveRuntimeSurface>
      <div className="flex flex-wrap gap-3" aria-label="Legal tutor actions">
        {state.affordances.map(a => <button key={JSON.stringify(a.action)} className="rounded border px-3 py-2"
          onClick={() => {
            const result = runtime.dispatch({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(), instanceId: state.instanceId,
              itemId: state.task?.itemId, expectedRevision: state.revision, action: a.action });
            setLastReceipt(result.status);
          }}>{a.description}</button>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <button disabled={!!releaseTurn} onClick={() => setReleaseTurn(() => runtime.holdTeachingTurn())}>Hold teaching turn</button>
        <button disabled={!releaseTurn} onClick={() => { releaseTurn?.(); setReleaseTurn(null); }}>Settle teaching turn</button>
        <button onClick={() => runtime.requestCompletion()}>Report terminal completion</button>
        <button onClick={() => runtime.stop()}>Stop lesson</button>
      </div>
      <p role="status">{state.status} · owner: {state.owner} · revision: {state.revision} · visible: {state.visibleRevision ?? 'awaiting paint'} · last receipt: {lastReceipt} · completion events: {completions}</p>
      {state.blockedReason && <p>{state.blockedReason}</p>}
      <DemonstrationPreview />
      <details><summary>Semantic state and assistance history</summary><pre className="overflow-auto">{JSON.stringify(state, null, 2)}</pre></details>
    </main>
  </LiveRuntimeContext.Provider>;
}
