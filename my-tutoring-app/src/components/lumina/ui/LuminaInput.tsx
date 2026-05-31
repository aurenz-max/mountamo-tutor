/**
 * LuminaInput — the canonical glassy answer-entry input.
 *
 * Replaces the generic native inputs scattered across primitives
 * (`<input type="number" className="bg-slate-700 border-slate-600 …">`) — which
 * render with ugly OS spinner arrows and an off-brand slate fill. This is a
 * glass input with the spinners suppressed (keeps `type="number"` semantics,
 * drops the arrows) and a cyan focus ring. Pass grading borders via className
 * (they win via tw-merge): `className={correct ? 'border-emerald-400' : ''}`.
 *
 *   <LuminaInput type="number" inputMode="numeric" value={v} onChange={…}
 *     placeholder="Enter answer" />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LuminaInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const LuminaInput = React.forwardRef<HTMLInputElement, LuminaInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-slate-100 placeholder:text-slate-500 transition-colors',
        'focus:outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20',
        'disabled:opacity-60',
        // Suppress native number spinners (keeps type="number" semantics).
        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        className
      )}
      {...props}
    />
  )
);
LuminaInput.displayName = 'LuminaInput';
