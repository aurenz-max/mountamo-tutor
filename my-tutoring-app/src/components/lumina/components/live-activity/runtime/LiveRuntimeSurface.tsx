'use client';

import React, { useEffect } from 'react';
import type { LiveLessonRuntime } from './LiveLessonRuntime';
import { useRuntimeSnapshot } from './LiveRuntimeContext';

/** Keeps the SAME child mounted. Suspension is an adapter guarantee, not a CSS hiding trick. */
export function LiveRuntimeSurface({ runtime, children }: { runtime: LiveLessonRuntime; children: React.ReactNode }) {
  const state = useRuntimeSnapshot(runtime);
  const artifact = state.supportArtifact;
  useEffect(() => {
    // Two animation frames certify a paint opportunity separately from a state commit.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => runtime.acknowledgeVisible(state.revision));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [runtime, state.revision]);
  return <section aria-label="Lesson workspace">
    <div hidden={!!artifact || state.status === 'stopped'}>
      <fieldset disabled={!!artifact || state.status !== 'active'} className="m-0 min-w-0 border-0 p-0">{children}</fieldset>
    </div>
    {artifact && <aside aria-label="Worked example" className="rounded-xl border border-indigo-300 p-6">
      <h2 className="text-xl font-semibold">{artifact.title}</h2>
      <div role="img" aria-label={artifact.altText} className="my-6 flex flex-wrap gap-3">
        {Array.from({ length: artifact.total }, (_, i) => <span key={i} aria-hidden="true"
          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${i < artifact.removed ? 'border-slate-500 text-slate-500' : 'border-cyan-400 bg-cyan-400 text-slate-950'}`}>
          {i < artifact.removed ? (artifact.operation === 'make-ten' ? '+' : '×') : '●'}
        </span>)}
      </div>
      <p>{artifact.operation === 'make-ten'
        ? `${artifact.total - artifact.removed} + ${artifact.removed} = ${artifact.total}`
        : artifact.operation === 'count' ? `${artifact.total} counters`
          : `${artifact.total} − ${artifact.removed} = ${artifact.total - artifact.removed}`}</p>
      <p className="mt-2">This is a worked example. Your task is saved.</p>
    </aside>}
    {state.status === 'stopped' && <p role="status">Lesson stopped. Unfinished work has not been marked complete.</p>}
    {state.status === 'faulted' && <p role="alert">This activity needs recovery. Your tutor cannot move it forward yet.</p>}
  </section>;
}
