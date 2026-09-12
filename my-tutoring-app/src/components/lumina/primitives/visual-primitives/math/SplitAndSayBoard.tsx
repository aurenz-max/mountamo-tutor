'use client';
import React, { useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { BondCounters, BondPlace } from './numberBondSplit';
import type { BondGroup } from './numberBondModes';

export default function SplitAndSayBoard({ whole, counters, canMove, onMove, answerSide, answerGroup, groups, teen, layoutKey, hint, allowedPlaces }: {
  whole: number; counters: BondCounters; canMove: boolean; onMove: (index: number, destination: BondPlace) => void;
  answerSide?: 'left' | 'right'; answerGroup?: BondGroup; groups?: readonly BondGroup[];
  teen: boolean; layoutKey: string; hint?: string; allowedPlaces?: readonly BondPlace[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const move = (index: number, place: BondPlace) => { if (canMove) { onMove(index, place); setSelected(null); } };
  const zone = (place: BondPlace) => {
    const placeCanMove = canMove && (!allowedPlaces || allowedPlaces.includes(place));
    const answerHere = answerSide === place || (!!answerGroup && counters.some((current, index) => current === place && groups?.[index] === answerGroup));
    return <section key={place} aria-label={`${place} counter tray`}
    onDragOver={(event) => { if (placeCanMove) event.preventDefault(); }} onDrop={(event) => {
      if (!placeCanMove) return;
      event.preventDefault(); const raw = event.dataTransfer.getData('text/plain'); if (/^\d+$/.test(raw)) move(Number(raw), place);
    }} className={`min-h-36 rounded-3xl border-2 p-3 ${answerHere ? 'border-amber-300 bg-amber-400/10' : place === 'whole'
      ? 'border-purple-300/40 bg-purple-500/10' : place === 'left' ? 'border-rose-300/40 bg-rose-500/10' : 'border-cyan-300/40 bg-cyan-500/10'}`}>
    <button type="button" aria-label={`Move counter to ${place}`} disabled={!placeCanMove}
      onClick={() => { const index = selected ?? (place === 'whole' ? counters.findIndex((p) => p !== 'whole') : counters.indexOf('whole')); if (index >= 0) move(index, place); }}
      className="mb-2 min-h-11 w-full rounded-xl text-center font-semibold text-slate-200 focus-visible:outline focus-visible:outline-cyan-200">
      {place === 'whole' ? `Whole: ${whole}` : answerSide === place ? 'How many here?' : place === 'left' ? 'Red group' : 'Blue group'}
    </button>
    <div className={`flex min-h-12 flex-wrap justify-center gap-1 ${teen && place !== 'whole' && counters.filter((p) => p === place).length === 10 ? 'rounded-xl border border-purple-300/50 p-1' : ''}`}>
      {counters.map((location, index) => location === place ? <motion.button key={index} type="button" layout layoutId={`${layoutKey}-counter-${index}`}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 28 }}
        draggable={canMove} disabled={!canMove} aria-label={`Counter ${index + 1}${groups?.[index] ? `, ${groups[index] === 'left' ? 'red' : 'blue'} group` : ''}`} aria-pressed={selected === index}
        onDragStartCapture={(event) => { if (canMove) { event.dataTransfer.setData('text/plain', String(index)); setSelected(index); } }}
        onClick={() => setSelected(selected === index ? null : index)}
        className={`flex h-11 w-11 items-center justify-center rounded-full border ${selected === index || groups?.[index] === answerGroup ? 'border-amber-200 bg-amber-300/30' : 'border-white/20'}`}>
        <span aria-hidden="true" className={`h-7 w-7 rounded-full ${groups?.[index]
          ? groups[index] === 'left' ? 'bg-rose-300' : 'bg-cyan-300'
          : place === 'whole' ? 'bg-purple-300' : place === 'left' ? 'bg-rose-300' : 'bg-cyan-300'}`} />
      </motion.button> : null)}
    </div>
  </section>;
  };
  return <LayoutGroup id={layoutKey}><div className="w-full max-w-xl space-y-2">
    {zone('whole')}
    <svg aria-hidden="true" viewBox="0 0 400 30" className="mx-auto h-8 w-full"><path d="M200 0 L200 10 L100 30 M200 10 L300 30" fill="none" stroke="rgb(148 163 184)" strokeWidth="2" /></svg>
    <div className={`grid gap-3 ${(!allowedPlaces || allowedPlaces.includes('right')) ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {(!allowedPlaces || allowedPlaces.includes('left')) && zone('left')}
      {(!allowedPlaces || allowedPlaces.includes('right')) && zone('right')}
    </div>
    <p className="text-center text-sm text-slate-400">{hint ?? (canMove ? 'Move a counter between parts, or bring it back to the whole.' : 'Look at the same counters and answer the tutor.')}</p>
  </div></LayoutGroup>;
}
