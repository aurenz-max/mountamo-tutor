'use client';

import React from 'react';
import type { MisconceptionBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import BlockTutorHelp from './BlockTutorHelp';
import { LuminaMathText } from '../../../../../ui';

interface MisconceptionBlockProps {
  data: MisconceptionBlockData;
  index: number;
  onAskTutor?: (message: string) => void;
}

/** A wrong idea students often hold, set against what is true, with the evidence that settles it. */
const MisconceptionBlock: React.FC<MisconceptionBlockProps> = ({ data, index, onAskTutor }) => (
  <BlockWrapper label={data.label} index={index} accent="rose" variant="default">
    <div className="grid gap-3 sm:grid-cols-2" data-misconception>
      <div className="rounded-xl border border-rose-400/25 bg-rose-500/5 p-4">
        <p className="text-xs uppercase tracking-wide text-rose-300/80 mb-1">You might think</p>
        <p className="text-slate-300 text-[15px] leading-relaxed"><LuminaMathText text={data.belief} /></p>
      </div>
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4">
        <p className="text-xs uppercase tracking-wide text-emerald-300/80 mb-1">Actually</p>
        <p className="text-slate-100 text-[15px] leading-relaxed"><LuminaMathText text={data.actually} /></p>
      </div>
    </div>
    <p className="mt-3 text-sm text-slate-400 leading-relaxed"><LuminaMathText text={data.why} /></p>
    <BlockTutorHelp
      onAskTutor={onAskTutor}
      label="Talk about this with your tutor"
      className="mt-4"
      message={`[MISCONCEPTION_EXPLORE] The student wants to talk about a common wrong idea: "${data.belief}". What is true: "${data.actually}". Why: ${data.why} Say why the wrong idea is tempting, then give one everyday case that shows what is true. Two or three sentences.`}
    />
  </BlockWrapper>
);

export default MisconceptionBlock;
