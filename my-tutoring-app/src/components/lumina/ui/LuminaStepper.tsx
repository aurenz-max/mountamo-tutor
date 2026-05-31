/**
 * LuminaStepper — the canonical −/value/+ number entry control.
 *
 * Replaces the hand-rolled steppers in ~29 math primitives (CountingBoard,
 * TenFrame, RatioTable…). Those drifted independently — TenFrame's even
 * shipped with a broken Tailwind class (`bg-white\5`, a backslash) so its
 * buttons rendered untinted. One control, clamped and consistent.
 *
 *   <LuminaStepper value={count} onChange={setCount} min={0} max={6} accent="orange" />
 *   <LuminaStepper value={n} onChange={setN} min={0} editable />   // typed input variant
 *
 * Plays SoundManager.tick() on each press (pass `silent` to suppress).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { LuminaButton } from './LuminaButton';
import { accentText, type LuminaAccent } from './tokens';
import { SoundManager } from '../utils/SoundManager';

export interface LuminaStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accent for the value display. Omit for neutral slate-100. */
  accent?: LuminaAccent;
  /** Render a typed numeric input between the buttons instead of static text. */
  editable?: boolean;
  /** Suppress the tick sound on press. */
  silent?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

export const LuminaStepper: React.FC<LuminaStepperProps> = ({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  accent,
  editable,
  silent,
  disabled,
  'aria-label': ariaLabel,
  className,
}) => {
  const clamp = (n: number) => {
    let next = n;
    if (min != null) next = Math.max(next, min);
    if (max != null) next = Math.min(next, max);
    return next;
  };

  const commit = (n: number) => {
    if (!silent) SoundManager.tick();
    onChange(clamp(n));
  };

  const atMin = min != null && value <= min;
  const atMax = max != null && value >= max;

  const buttonClass = 'w-14 h-14 text-2xl rounded-xl p-0';

  return (
    <div className={cn('flex items-center gap-3', className)} role="group" aria-label={ariaLabel}>
      <LuminaButton
        type="button"
        aria-label="Decrease"
        disabled={disabled || atMin}
        onClick={() => commit(value - step)}
        className={buttonClass}
      >
        −
      </LuminaButton>

      {editable ? (
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={Number.isNaN(value) ? '' : value}
          disabled={disabled}
          onChange={(e) => {
            const parsed = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
            onChange(Number.isNaN(parsed) ? min : clamp(parsed));
          }}
          className={cn(
            'w-20 h-14 rounded-xl bg-white/5 border border-white/20 text-center text-2xl font-bold',
            'focus:outline-none focus:ring-2 focus:ring-white/30',
            accent ? accentText[accent] : 'text-slate-100'
          )}
        />
      ) : (
        <span
          className={cn(
            'min-w-[3rem] text-center text-2xl font-bold tabular-nums',
            accent ? accentText[accent] : 'text-slate-100'
          )}
        >
          {value}
        </span>
      )}

      <LuminaButton
        type="button"
        aria-label="Increase"
        disabled={disabled || atMax}
        onClick={() => commit(value + step)}
        className={buttonClass}
      >
        +
      </LuminaButton>
    </div>
  );
};
