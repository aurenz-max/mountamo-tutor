'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle } from '../../ui';
import { validIndices, visualSize, visualState, type DirectVisualData } from './directVisualContract';

export interface DirectVisualControls {
  highlight: (indices: number[]) => boolean;
  getState: () => Record<string, unknown>;
}

export default function DirectVisual({ data, onVisible, onState, onControls }: {
  data: DirectVisualData;
  onVisible: (state: Record<string, unknown>) => void;
  onState: (state: Record<string, unknown>) => void;
  onControls: (controls: DirectVisualControls | null) => void;
}) {
  const [surface, setSurface] = useState(data);
  const latest = useRef(surface); latest.current = surface;
  const onVisibleRef = useRef(onVisible); onVisibleRef.current = onVisible;
  const getState = useCallback(() => visualState(latest.current), []);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => onVisibleRef.current(getState())); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [getState]);
  useEffect(() => {
    onControls({ getState, highlight: indices => {
      if (!validIndices(indices, visualSize(latest.current))) return false;
      setSurface(old => ({ ...old, highlightedIndices: [...indices] }));
      return true;
    } });
    return () => onControls(null);
  }, [getState, onControls]);
  useEffect(() => { onState(visualState(surface)); }, [surface, onState]);
  const toggle = (indices: number[], index: number) => indices.includes(index)
    ? indices.filter(i => i !== index) : [...indices, index].sort((a, b) => a - b);
  const pointStyle = (i: number) => surface.highlightedIndices.includes(i)
    ? 'ring-4 ring-amber-300 ring-offset-4 ring-offset-slate-900' : '';
  const label = surface.kind === 'counters' ? 'Counters' : surface.kind === 'fraction' ? 'Fraction bar' : 'Letter tiles';

  return <LuminaCard><LuminaCardHeader><LuminaCardTitle>{label}</LuminaCardTitle></LuminaCardHeader>
    <LuminaCardContent>
      <p className="mb-8 text-center text-xl text-slate-100">{surface.instruction}</p>
      <div className="flex min-h-56 items-center justify-center py-8" aria-label={label}>
        {surface.kind === 'counters' && <div className="grid w-full max-w-lg grid-cols-5 gap-3">
          {Array.from({ length: surface.layout === 'ten_frame' ? (surface.count > 10 ? 20 : 10) : surface.count }, (_, i) =>
            <div key={i} className={`flex aspect-square items-center justify-center rounded-xl ${surface.layout === 'ten_frame' ? 'border-2 border-slate-600 bg-slate-900/60' : ''}`}>
              {i < surface.count && <button aria-label={`Counter ${i + 1}`} aria-pressed={surface.removedIndices.includes(i)}
                onClick={() => setSurface(old => old.kind === 'counters' ? { ...old, removedIndices: toggle(old.removedIndices, i) } : old)}
                className={`flex h-3/4 w-3/4 items-center justify-center rounded-full border-2 text-3xl transition-colors ${pointStyle(i)} ${surface.removedIndices.includes(i) ? 'border-cyan-800 bg-cyan-950 text-cyan-400' : 'border-cyan-200 bg-cyan-400 text-slate-950'}`}>
                {surface.removedIndices.includes(i) ? '×' : ''}
              </button>}
            </div>)}
          {surface.count === 0 && surface.layout === 'rows' && <p className="col-span-5 text-center text-slate-400">No counters yet</p>}
        </div>}
        {surface.kind === 'fraction' && <div className="grid h-36 w-full max-w-3xl gap-2" style={{ gridTemplateColumns: `repeat(${surface.denominator}, minmax(0, 1fr))` }}>
          {Array.from({ length: surface.denominator }, (_, i) => <button key={i} aria-label={`Part ${i + 1}`} aria-pressed={surface.shadedIndices.includes(i)}
            onClick={() => setSurface(old => old.kind === 'fraction' ? { ...old, shadedIndices: toggle(old.shadedIndices, i) } : old)}
            className={`rounded-lg border-2 transition-colors ${pointStyle(i)} ${surface.shadedIndices.includes(i) ? 'border-violet-200 bg-violet-500' : 'border-slate-500 bg-slate-900'}`} />)}
        </div>}
        {surface.kind === 'letters' && <div className="flex max-w-3xl flex-wrap justify-center gap-5">
          {surface.tiles.map((tile, i) => <button key={i} aria-label={`Tile ${i + 1}: ${tile}`} aria-pressed={surface.selectedIndices.includes(i)}
            onClick={() => setSurface(old => old.kind === 'letters' ? { ...old, selectedIndices: toggle(old.selectedIndices, i) } : old)}
            className={`min-h-28 min-w-24 rounded-2xl border-2 px-5 py-4 text-6xl font-semibold ${pointStyle(i)} ${surface.selectedIndices.includes(i) ? 'border-emerald-200 bg-emerald-800 text-white' : 'border-slate-600 bg-slate-800 text-white'}`}>{tile}</button>)}
        </div>}
      </div>
      <p className="mt-6 text-center text-sm text-slate-400">{surface.kind === 'counters' ? 'Tap a counter to cross it out or bring it back.'
        : surface.kind === 'fraction' ? 'Tap a part to shade it or clear it.' : 'Tap a tile to select it. Talk to your tutor when you’re ready.'}</p>
    </LuminaCardContent>
  </LuminaCard>;
}
