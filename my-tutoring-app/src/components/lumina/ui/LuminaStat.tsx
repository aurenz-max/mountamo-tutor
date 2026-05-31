/**
 * LuminaStat — a label / value / unit readout tile.
 *
 * The metric tiles in living simulations (HydraulicsLab: Pressure 4.0 N/cm²,
 * Output Force 450 N, Multiplier 9.0x, Load Status Stuck). Value takes the
 * accent color; label and unit use the muted ramp.
 *
 *   <LuminaStat label="Pressure" value="4.0" unit="N/cm²" />
 *   <LuminaStat label="Output Force" value={450} unit="Newtons" accent="amber" />
 *   <LuminaStat label="Load Status" value="Stuck" accent="rose" />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { surface, accentStrongText, type LuminaAccent } from './tokens';

export interface LuminaStatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Accent for the value text. Omit for neutral slate-100. */
  accent?: LuminaAccent;
}

export const LuminaStat = React.forwardRef<HTMLDivElement, LuminaStatProps>(
  ({ className, label, value, unit, accent, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(surface.nested, 'rounded-lg border p-4 text-center', className)}
      {...props}
    >
      <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', accent ? accentStrongText[accent] : 'text-slate-100')}>
        {value}
      </p>
      {unit && <p className="text-[11px] text-slate-500 mt-0.5">{unit}</p>}
    </div>
  )
);
LuminaStat.displayName = 'LuminaStat';
