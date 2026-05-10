'use client';

import React from 'react';
import BlockShell from './BlockShell';
import type { AuthorContextBlockData } from '../types';

interface AuthorContextBlockProps {
  data: AuthorContextBlockData;
  innerRef?: React.Ref<HTMLDivElement>;
}

const AuthorContextBlock: React.FC<AuthorContextBlockProps> = ({ data, innerRef }) => {
  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="indigo">
      <div className="space-y-3">
        {(data.era || data.genre) && (
          <div className="flex items-center gap-2 flex-wrap">
            {data.era && (
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                {data.era}
              </span>
            )}
            {data.genre && (
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/50">
                {data.genre}
              </span>
            )}
          </div>
        )}
        {data.paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-slate-300 leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </BlockShell>
  );
};

export default AuthorContextBlock;
