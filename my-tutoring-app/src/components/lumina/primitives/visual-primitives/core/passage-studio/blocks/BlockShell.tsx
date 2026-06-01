'use client';

import React from 'react';
import { LuminaCard, LuminaCardContent } from '../../../../../ui';

export type BlockAccent = 'slate' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'cyan';

// Bespoke left-accent rail — a structural accent border the kit doesn't yet
// expose. 'slate' and 'indigo' are intentionally outside the kit accent union.
const ACCENT_BORDER: Record<BlockAccent, string> = {
  slate: 'border-l-slate-400/50',
  indigo: 'border-l-indigo-400/60',
  amber: 'border-l-amber-400/60',
  emerald: 'border-l-emerald-400/60',
  rose: 'border-l-rose-400/60',
  cyan: 'border-l-cyan-400/60',
};

const ACCENT_LABEL: Record<BlockAccent, string> = {
  slate: 'text-slate-400/70',
  indigo: 'text-indigo-300/80',
  amber: 'text-amber-300/80',
  emerald: 'text-emerald-300/80',
  rose: 'text-rose-300/80',
  cyan: 'text-cyan-300/80',
};

interface BlockShellProps {
  children: React.ReactNode;
  label?: string;
  accent?: BlockAccent;
  /** Pass-through ref for intersection-observer wiring in split_passage layout. */
  innerRef?: React.Ref<HTMLDivElement>;
  blockId?: string;
  className?: string;
}

const BlockShell: React.FC<BlockShellProps> = ({
  children,
  label,
  accent = 'slate',
  innerRef,
  blockId,
  className,
}) => {
  return (
    <div ref={innerRef} data-block-id={blockId}>
      <LuminaCard
        className={`border-l-2 ${ACCENT_BORDER[accent]} shadow-lg overflow-hidden ${className || ''}`}
      >
        <LuminaCardContent className="p-5">
          {label && (
            <div className={`text-[10px] font-mono uppercase tracking-widest ${ACCENT_LABEL[accent]} mb-3`}>
              {label}
            </div>
          )}
          {children}
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

export default BlockShell;
