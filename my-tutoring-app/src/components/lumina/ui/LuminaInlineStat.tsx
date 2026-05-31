/**
 * LuminaInlineStat — a compact dot-anchored readout.
 *
 * The lightweight counters that sit under the interaction surface
 * ("Counted: 8 / 6", "Counters: 8", "Empty: 12"). An accent dot anchors each
 * one; the value leads (large, accent) with the label beneath (small, muted).
 * More compact than LuminaStat (the boxed tile) — these sit in a row.
 * Extracted from CountingBoard.tsx + TenFrame.tsx.
 *
 *   <LuminaInlineStat label="Counted" value={count} suffix={`/ ${total}`} accent="orange" />
 *   <LuminaInlineStat label="Empty" value={empty} />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { accentText, accentSolidBg, type LuminaAccent } from './tokens';

export interface LuminaInlineStatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** Muted trailing text, e.g. "/ 6". */
  suffix?: React.ReactNode;
  accent?: LuminaAccent;
}

export const LuminaInlineStat: React.FC<LuminaInlineStatProps> = ({
  label,
  value,
  suffix,
  accent,
  className,
  ...props
}) => (
  <div className={cn('inline-flex items-center gap-2.5', className)} {...props}>
    <span
      className={cn(
        'w-2 h-2 rounded-full flex-shrink-0',
        accent ? accentSolidBg[accent] : 'bg-slate-500'
      )}
    />
    <div className="flex flex-col leading-none">
      <span className={cn('text-xl font-bold tabular-nums', accent ? accentText[accent] : 'text-slate-100')}>
        {value}
        {suffix != null && <span className="text-sm font-medium text-slate-500"> {suffix}</span>}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
    </div>
  </div>
);
