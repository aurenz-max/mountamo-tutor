'use client';

import React from 'react';
import BlockShell from './BlockShell';
import { LuminaBadge } from '../../../../../ui';
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
              <LuminaBadge accent="blue" className="text-[10px] font-mono uppercase tracking-wider">
                {data.era}
              </LuminaBadge>
            )}
            {data.genre && (
              <LuminaBadge className="text-[10px] font-mono uppercase tracking-wider">
                {data.genre}
              </LuminaBadge>
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
