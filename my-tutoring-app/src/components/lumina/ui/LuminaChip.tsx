/**
 * LuminaChip + LuminaChipBank — selectable word/token chips and their tray.
 *
 * The chip-bank pattern: a wrapping row of pickable tokens (FillInBlanks word
 * bank, WordSorter unsorted words, SentenceBuilder, PhonicsBlender). The two
 * existing hand-rolled versions had DIVERGED — WordSorter was glassy/on-brand,
 * FillInBlanks used bright solid pills (bg-emerald-600 etc., off-brand). This
 * standardizes on the glassy look and REUSES `answerStateClasses`, so a chip
 * grades the same green/red/blue as every other answer surface in the kit.
 *
 *   <LuminaChipBank label="Word Bank">
 *     {words.map(w => (
 *       <LuminaChip key={w} state={chipState(w)} onClick={() => pick(w)} disabled={submitted}>
 *         {w}
 *       </LuminaChip>
 *     ))}
 *   </LuminaChipBank>
 *
 * Chips don't render a ✓ (that's LuminaAnswerChoice / LuminaFillBlankSlot) —
 * they're compact tokens you pick up and place.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { answerStateClasses, type AnswerChoiceState } from './tokens';

// A chip's state is the same grading language as answers: idle (available),
// selected (held/placed), correct, incorrect, dimmed (spent/taken).
export type ChipState = AnswerChoiceState;

export interface LuminaChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  state?: ChipState;
}

export const LuminaChip = React.forwardRef<HTMLButtonElement, LuminaChipProps>(
  ({ className, state = 'idle', children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-all disabled:pointer-events-none',
        answerStateClasses[state],
        state === 'selected' && 'scale-105', // a "held/picked-up" lift, chip-specific
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
LuminaChip.displayName = 'LuminaChip';

export interface LuminaChipBankProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional heading rendered above the chips (e.g. "Word Bank"). */
  label?: string;
}

export const LuminaChipBank = React.forwardRef<HTMLDivElement, LuminaChipBankProps>(
  ({ className, label, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border border-white/10 bg-white/[0.02] p-4', className)}
      {...props}
    >
      {label && <h4 className="mb-3 text-sm font-semibold text-slate-300">{label}</h4>}
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  )
);
LuminaChipBank.displayName = 'LuminaChipBank';
