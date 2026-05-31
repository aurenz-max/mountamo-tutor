/**
 * LuminaAnswerChoice — the answer option with its full feedback state machine.
 *
 * The single most-repeated eval pattern (255+ hand-rolled instances across
 * True/False, MCQ, categorize, match). Our LuminaChoiceChip is the *picker*
 * dot-pill; this is the *answerable* option that reveals correctness. Extracted
 * from TrueFalseProblem.tsx's statusClass FSM.
 *
 * The primitive computes which `state` each option is in:
 *   idle      — not selected, still answerable
 *   selected  — chosen, not yet submitted (blue)
 *   correct   — revealed correct answer (emerald + ✓)
 *   incorrect — the chosen-but-wrong answer (rose, dimmed)
 *   dimmed    — a non-chosen wrong answer after reveal (faded out)
 *
 *   <LuminaAnswerChoice
 *     state={!submitted ? (picked===v ? 'selected' : 'idle')
 *            : v===correct ? 'correct'
 *            : picked===v ? 'incorrect' : 'dimmed'}
 *     onClick={() => pick(v)} disabled={submitted}>
 *     {label}
 *   </LuminaAnswerChoice>
 */
import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
// The grading-state color language lives in tokens so interaction surfaces
// (matching/categorize/sequence) share it. Mechanics stay bespoke there.
import { answerStateClasses, type AnswerChoiceState } from './tokens';

export type { AnswerChoiceState };

export interface LuminaAnswerChoiceProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  state: AnswerChoiceState;
}

export const LuminaAnswerChoice = React.forwardRef<HTMLButtonElement, LuminaAnswerChoiceProps>(
  ({ className, state, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'relative w-full rounded-xl border p-6 text-left transition-all duration-300',
        answerStateClasses[state],
        className
      )}
      {...props}
    >
      {children}
      {state === 'correct' && (
        <CheckCircle2 className="absolute top-2 right-2 w-6 h-6 text-emerald-400" />
      )}
    </button>
  )
);
LuminaAnswerChoice.displayName = 'LuminaAnswerChoice';
