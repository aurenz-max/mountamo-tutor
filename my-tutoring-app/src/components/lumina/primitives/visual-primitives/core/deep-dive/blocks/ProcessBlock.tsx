'use client';

import React, { useState } from 'react';
import type { ProcessBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import { LuminaMathText } from '../../../../../ui';
import { useTapTutor, TapHint } from './TapTutor';

interface ProcessBlockProps {
  data: ProcessBlockData;
  index: number;
  onAskTutor?: (message: string) => void;
}

/**
 * The stages of a one-way process in order, with arrows: left to right for up to four stages on a wide screen, a
 * column otherwise. Tapping a stage marks it and, with a tutor, asks about it. A cycle is the catalog's cycle wheel.
 */
const ProcessBlock: React.FC<ProcessBlockProps> = ({ data, index, onAskTutor }) => {
  const { stages } = data;
  const [active, setActive] = useState<number | null>(null);
  const { enabled, activeKey, ask } = useTapTutor(onAskTutor);

  const choose = (i: number) => {
    setActive(i);
    const s = stages[i];
    ask(`stage-${i}`, `[PROCESS_EXPLORE] In the process "${data.label || 'process'}" (${stages.map((x) => x.title).join(' -> ')}), the student tapped stage ${i + 1}, "${s.title}": ${s.description} Explain what happens at this stage and what it hands to the next one, in 2-3 short sentences. Do not quiz them.`);
  };

  const stage = (i: number) => {
    const s = stages[i];
    const on = i === active || activeKey === `stage-${i}`;
    return (
      <button
        type="button"
        onClick={() => choose(i)}
        data-process-stage={i}
        className={`h-full w-full rounded-xl border p-3 text-left transition-colors ${on ? 'border-teal-400/60 bg-teal-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
      >
        <span className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>{s.icon}</span>
          <span className="text-[11px] font-mono text-teal-300/80">{i + 1}</span>
          <span className="text-sm font-medium text-slate-100"><LuminaMathText text={s.title} /></span>
        </span>
        <span className="mt-1 block text-sm text-slate-400 leading-snug"><LuminaMathText text={s.description} /></span>
      </button>
    );
  };

  const column = (
    <ol className="space-y-1">
      {stages.map((_, i) => (
        <li key={i}>
          {stage(i)}
          {i < stages.length - 1 && <p className="py-0.5 text-center text-sm text-teal-300/60" aria-hidden>↓</p>}
        </li>
      ))}
    </ol>
  );

  return (
    <BlockWrapper label={data.label} index={index} accent="teal" variant="default">
      <div data-process>
        {stages.length <= 4 ? (
          <>
            <div className="hidden sm:flex items-stretch gap-1">
              {stages.map((_, i) => (
                <React.Fragment key={i}>
                  <div className="min-w-0 flex-1">{stage(i)}</div>
                  {i < stages.length - 1 && <span className="self-center text-teal-300/60" aria-hidden>→</span>}
                </React.Fragment>
              ))}
            </div>
            <div className="sm:hidden">{column}</div>
          </>
        ) : column}
        {enabled && <TapHint text="Tap a stage to hear more from your tutor" />}
      </div>
    </BlockWrapper>
  );
};

export default ProcessBlock;
