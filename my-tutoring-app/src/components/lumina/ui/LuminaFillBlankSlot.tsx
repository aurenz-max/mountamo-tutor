/**
 * LuminaFillBlankSlot — an inline fill-in-the-blank target.
 *
 * The blank slot in cloze/fill-in primitives (FillInBlanksProblem, SentenceBuilder
 * frames, CvcSpeller Elkonin boxes). Four states: empty (dashed drop target),
 * filled (pre-submit), correct, incorrect — with a ✓/✗ corner badge once graded.
 * The filled/correct/incorrect colors come from the shared `answerStateClasses`
 * token, so a blank grades the same green/red as every other answer surface.
 *
 *   <LuminaFillBlankSlot state="empty" />                              // "Drop word here"
 *   <LuminaFillBlankSlot state="filled" value="photosynthesis" onClick={remove} />
 *   <LuminaFillBlankSlot state={isCorrect ? 'correct' : 'incorrect'} value={word} />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { answerStateClasses, motion } from './tokens';

export type FillBlankState = 'empty' | 'filled' | 'correct' | 'incorrect';

const SLOT_STATE: Record<FillBlankState, string> = {
  empty: 'border-dashed border-blue-400/50 bg-blue-500/10 text-slate-400',
  filled: answerStateClasses.selected,
  correct: answerStateClasses.correct,
  incorrect: answerStateClasses.incorrect,
};

export interface LuminaFillBlankSlotProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: FillBlankState;
  /** The placed word; empty/undefined renders the placeholder. */
  value?: string;
  placeholder?: string;
}

export const LuminaFillBlankSlot = React.forwardRef<HTMLSpanElement, LuminaFillBlankSlotProps>(
  ({ className, state, value, placeholder = 'Drop word here', ...props }, ref) => (
    <span className="relative inline-block mx-1">
      <span
        ref={ref}
        className={cn(
          'inline-flex min-w-[140px] cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-2',
          motion.press,
          motion.transitionSlow,
          SLOT_STATE[state],
          state === 'correct' && motion.pop,
          state === 'incorrect' && motion.shake,
          className
        )}
        {...props}
      >
        {value ? (
          <span className="font-medium">{value}</span>
        ) : (
          <span className="text-sm">{placeholder}</span>
        )}
      </span>
      {(state === 'correct' || state === 'incorrect') && (
        <span
          className={cn(
            'absolute -top-2 -right-2 text-lg',
            state === 'correct' ? 'text-emerald-400' : 'text-rose-400'
          )}
        >
          {state === 'correct' ? '✓' : '✗'}
        </span>
      )}
    </span>
  )
);
LuminaFillBlankSlot.displayName = 'LuminaFillBlankSlot';
