/**
 * LuminaChoiceChip — a selectable pill with a status dot.
 *
 * The labelled selectors in explore-style primitives (FactFile's
 * Tracks / House / Boom). Each chip carries its own accent (shown via the
 * dot); selecting it fills the dot and lifts the pill with the accent tint.
 *
 *   <LuminaChoiceChip accent="cyan"   selected label="Tracks"   onClick={…} />
 *   <LuminaChoiceChip accent="orange"          label="The House" onClick={…} />
 *   <LuminaChoiceChip accent="emerald"         label="The Boom"  onClick={…} />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { accentSolidBg, accentSoftBg, accentSoftBorder, accentText, type LuminaAccent } from './tokens';

// Dot ring color when unselected (full literal names for JIT).
const dotRing: Record<LuminaAccent, string> = {
  orange: 'border-orange-400',
  emerald: 'border-emerald-400',
  cyan: 'border-cyan-400',
  amber: 'border-amber-400',
  blue: 'border-blue-400',
  purple: 'border-purple-400',
  pink: 'border-pink-400',
  rose: 'border-rose-400',
};

export interface LuminaChoiceChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  accent?: LuminaAccent;
  selected?: boolean;
}

export const LuminaChoiceChip = React.forwardRef<HTMLButtonElement, LuminaChoiceChipProps>(
  ({ className, label, accent = 'cyan', selected, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-all',
        selected
          ? cn(accentSoftBg[accent], accentSoftBorder[accent], 'text-slate-100')
          : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'w-3 h-3 rounded-full flex-shrink-0 transition-all',
          selected ? accentSolidBg[accent] : cn('border-2 bg-transparent', dotRing[accent])
        )}
      />
      <span className={cn(selected && accentText[accent])}>{label}</span>
    </button>
  )
);
LuminaChoiceChip.displayName = 'LuminaChoiceChip';
