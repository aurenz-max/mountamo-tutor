'use client';

import React, { useCallback, useRef, useState } from 'react';
import { PipSurfaceContext, usePipScene, usePipSurface } from './PipSurfaceContext';
import { PipSurfaceStore, type PipSurfacePhase } from './PipSurfaceStore';
import { PipSurfaceActor } from './PipSurfaceActor';
import { countingBoardPipPose } from './countingBoardPipPose';

/** A local phase audition. Uses the same pose policy as Counting Board.
 * No tutor connection and no grading: success is explicitly simulated here.
 */
export default function PipSurfacePlayground() {
  const [store] = useState(() => {
    const value = new PipSurfaceStore();
    value.setActive('pip-playground');
    return value;
  });
  return <PipSurfaceContext.Provider value={store}><Workspace /></PipSurfaceContext.Provider>;
}

const PHASE_COPY: Record<PipSurfacePhase, string> = {
  idle: 'Ready when you are.',
  introducing: 'Let’s put some apples on the tray.',
  working: 'Your turn. Touch the apples you want to give me.',
  checking: 'You’ve handed me your apples.',
  celebrating: 'We did it together!',
};

function Workspace() {
  const [round, setRound] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [lastTouched, setLastTouched] = useState<number | null>(null);
  const [phase, setPhase] = useState<PipSurfacePhase>('introducing');
  const dock = useRef<HTMLDivElement>(null);
  const objects = useRef(new Map<number, HTMLButtonElement>());
  const build = useCallback(() => {
    if (!dock.current) return null;
    const targets = Array.from(objects.current, ([index, element]) => ({ id: `apple-${index}`, label: 'apple', element }));
    return {
      instanceId: 'pip-playground', scopeId: `round-${round}`, label: 'Apple workspace', dock: dock.current, targets,
      pose: countingBoardPipPose({
        running: true, preparing: false, currentSolved: phase === 'celebrating', revealHeld: false,
        judging: phase === 'checking', tutorSpeaking: phase === 'introducing', cueMatchesItem: true,
        perceptual: false, giving: true, visibleIds: targets.map((target) => target.id),
        lastTouchedId: lastTouched === null ? undefined : `apple-${lastTouched}`,
      }),
    };
  }, [round, phase, lastTouched, selected]);
  usePipSurface(build);
  const { surface } = usePipScene();

  return <section className="mx-auto w-full max-w-3xl px-4 py-8 text-slate-100">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Pip Surface Lab</p>
    <h1 className="mt-2 text-3xl font-semibold">A workspace to share</h1>
    <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
      Walk through the activity’s phases. Pip points during the introduction, follows your touches,
      receives the handover, and celebrates success. Every gesture is controlled by the activity’s code.
    </p>
    <div className="mt-7 overflow-hidden rounded-3xl border border-cyan-200/15 bg-slate-900 p-4 sm:p-6">
      <div className="relative h-80 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800 to-slate-900">
        <div className="absolute inset-x-3 bottom-3 h-24 rounded-2xl border-2 border-dashed border-cyan-300/25 bg-cyan-900/15">
          <span className="absolute bottom-1 right-3 text-xs text-cyan-300/70">Pip’s tray</span>
        </div>
        {[0, 1, 2, 3, 4].map((index) => <button key={index}
          ref={(element) => { if (element) objects.current.set(index, element); else objects.current.delete(index); }}
          aria-label={`Apple ${index + 1}`} aria-pressed={selected.includes(index)} data-pip-object={`apple-${index}`}
          disabled={phase !== 'working'}
          className="absolute flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl enabled:hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          style={{ left: `${12 + index * 19}%`, top: selected.includes(index) ? 235 : 60 + (index % 2) * 55 }}
          onClick={() => {
            setLastTouched(index);
            setSelected((old) => old.includes(index) ? old.filter((n) => n !== index) : [...old, index]);
          }}>🍎</button>)}
      </div>
      <div ref={dock} data-pip-dock="pip-playground" className="mt-3 min-h-28" />
    </div>
    {surface && <PipSurfaceActor surface={surface} mood="happy" speech={PHASE_COPY[phase]} />}
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {phase === 'introducing' && <button className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
        onClick={() => setPhase('working')}>Start activity</button>}
      {phase === 'working' && <button className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
        disabled={selected.length === 0} onClick={() => setPhase('checking')}>Hand to Pip</button>}
      {phase === 'checking' && <button className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
        onClick={() => setPhase('celebrating')}>Show success phase</button>}
      <button className="rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-300"
        onClick={() => { setRound((n) => n + 1); setSelected([]); setLastTouched(null); setPhase('introducing'); }}>New board</button>
      <span className="text-xs text-slate-400">Phase: {phase}</span>
    </div>
    <p className="mt-5 text-xs leading-relaxed text-slate-500">This is a phase preview, with no microphone or scoring. In a lesson the existing activity runner controls success.</p>
  </section>;
}
