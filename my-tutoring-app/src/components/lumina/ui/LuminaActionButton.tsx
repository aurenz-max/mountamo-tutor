/**
 * LuminaActionButton — the submit → reset → advance lifecycle button.
 *
 * Codifies the 129+ hand-rolled "Check Answer" / "Try Again" / "Next" buttons.
 * Crucially this ships the ON-BRAND version: primitives currently hand-roll a
 * solid `bg-blue-600` fill (flagged earlier as off-brand); this uses the kit's
 * glass tones instead. Built on LuminaButton.
 *
 *   <LuminaActionButton action="check" disabled={!answer} onClick={submit} />
 *   <LuminaActionButton action="retry" onClick={reset} />
 *   <LuminaActionButton action="next" onClick={advance} />
 *
 * Children override the default label.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { LuminaButton, type LuminaButtonProps } from './LuminaButton';

export type ActionKind = 'check' | 'retry' | 'next';

const ACTIONS: Record<ActionKind, { tone: LuminaButtonProps['tone']; label: string }> = {
  check: { tone: 'primary', label: 'Check Answer' },
  retry: { tone: 'subtle', label: 'Try Again' },
  next: { tone: 'primary', label: 'Next →' },
};

export interface LuminaActionButtonProps extends Omit<LuminaButtonProps, 'tone'> {
  action: ActionKind;
}

export const LuminaActionButton = React.forwardRef<HTMLButtonElement, LuminaActionButtonProps>(
  ({ className, action, children, ...props }, ref) => {
    const { tone, label } = ACTIONS[action];
    return (
      <LuminaButton
        ref={ref}
        tone={tone}
        className={cn('rounded-full px-8 font-bold tracking-wide', className)}
        {...props}
      >
        {children ?? label}
      </LuminaButton>
    );
  }
);
LuminaActionButton.displayName = 'LuminaActionButton';
