'use client';

import React, { useMemo, useState } from 'react';
import { LuminaSlider } from '../../../ui';
import { shadesOfMeaningProblems, type DrawerShadesOfMeaningData } from './textSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerShadesOfMeaningData } from './textSpecs';

/**
 * Shades of meaning: words for one idea from weakest to strongest, each dropped into the same
 * sentence. The circle grows with the word, so the words read as stronger and weaker versions
 * of one idea. Ungraded.
 */
const DrawerShadesOfMeaning: React.FC<{ data: DrawerShadesOfMeaningData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => shadesOfMeaningProblems(data), [data]);
  const [i, setI] = useState(0);
  if (problems.length) return <DrawerFrame kind="shades-of-meaning" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const n = data.words.length;
  const [before, after] = data.frame.split('___');
  const size = 36 + (i / (n - 1)) * 104;

  return (
    <DrawerFrame kind="shades-of-meaning" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex h-40 items-center justify-center" aria-hidden="true">
        <div className="rounded-full bg-pink-400/85 transition-all duration-300" style={{ width: size, height: size }} />
      </div>

      <p className="text-center text-2xl text-slate-200" aria-live="polite">
        {before}<strong className="text-cyan-300">{data.words[i]}</strong>{after}
      </p>

      <div className="flex flex-col gap-2">
        <LuminaSlider accent="cyan" min={0} max={n - 1} step={1} value={[i]} onValueChange={([v]) => setI(Math.round(v))} aria-label="Word strength" />
        <div className="flex justify-between gap-1 text-xs">
          {data.words.map((w, k) => (
            <button key={w} type="button" onClick={() => setI(k)}
              className={`flex-1 truncate rounded px-1 py-0.5 text-center ${k === i ? 'font-semibold text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>{w}</button>
          ))}
        </div>
        <div className="flex justify-between font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <span>{data.weakLabel}</span><span>{data.strongLabel}</span>
        </div>
      </div>
    </DrawerFrame>
  );
};

export default DrawerShadesOfMeaning;
