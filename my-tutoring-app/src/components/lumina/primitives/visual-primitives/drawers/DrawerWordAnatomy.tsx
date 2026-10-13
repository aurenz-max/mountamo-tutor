'use client';

import React, { useMemo, useState } from 'react';
import { LuminaChoiceChip, LuminaPanel } from '../../../ui';
import { formFor, orderedPieces, wordAnatomyProblems, type DrawerWordAnatomyData, type WordPieceType } from './textSpecs';
import { DrawerFrame } from './DrawerFrame';

export type { DrawerWordAnatomyData } from './textSpecs';

const TONE: Record<WordPieceType, { text: string; border: string; accent: 'indigo' | 'emerald' | 'amber' }> = {
  prefix: { text: 'text-indigo-300', border: 'border-indigo-400', accent: 'indigo' },
  root: { text: 'text-emerald-300', border: 'border-emerald-400', accent: 'emerald' },
  suffix: { text: 'text-amber-300', border: 'border-amber-400', accent: 'amber' },
};

/**
 * Word anatomy: a word in prefix, root and suffix. The learner switches the parts on and off
 * and sees whether the combination is a real word and what it means. Only the root starts on,
 * so the full word is built, not shown. Ungraded.
 */
const DrawerWordAnatomy: React.FC<{ data: DrawerWordAnatomyData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => wordAnatomyProblems(data), [data]);
  const [on, setOn] = useState<string[]>(() => (data.pieces ?? []).filter(p => p.type === 'root').map(p => p.text));
  if (problems.length) return <DrawerFrame kind="word-anatomy" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const pieces = orderedPieces(data);
  const active = pieces.filter(p => on.includes(p.text));
  const form = formFor(data, active.map(p => p.text));
  const toggle = (t: string) => setOn(o => (o.includes(t) ? o.filter(x => x !== t) : [...o, t]));

  return (
    <DrawerFrame kind="word-anatomy" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="flex flex-wrap gap-2">
        {pieces.map(p => (
          <LuminaChoiceChip key={p.text} accent={TONE[p.type].accent} selected={on.includes(p.text)} disabled={p.type === 'root'}
            label={`${p.type === 'prefix' ? `${p.text}-` : p.type === 'suffix' ? `-${p.text}` : p.text} · ${p.meaning}`}
            onClick={() => toggle(p.text)} />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-1 text-4xl font-bold tracking-wide" aria-hidden="true">
        {active.map(p => <span key={p.text} className={`border-b-4 px-0.5 ${TONE[p.type].text} ${TONE[p.type].border}`}>{p.text}</span>)}
      </div>

      <LuminaPanel className="min-h-[72px] p-4" aria-live="polite">
        {form ? (
          <>
            <p className="text-xl font-semibold text-slate-100">{form.word}</p>
            <p className="text-sm text-slate-300">{form.meaning}</p>
          </>
        ) : (
          <p className="text-sm text-rose-300">{active.map(p => p.text).join(' + ')} is not a word.</p>
        )}
      </LuminaPanel>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        {(['prefix', 'root', 'suffix'] as const).filter(t => pieces.some(p => p.type === t)).map(t => (
          <span key={t} className={TONE[t].text}>{t}</span>
        ))}
      </div>
    </DrawerFrame>
  );
};

export default DrawerWordAnatomy;
