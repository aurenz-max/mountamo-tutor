/**
 * LuminaPrompt — the task / question banner.
 *
 * The full-width panel that states what the student must do ("There are 3
 * stars already counted. Can you count on to find the total?"). Appears above
 * the interaction surface in every multi-phase primitive. Neutral glass by
 * default; pass an accent to tint it.
 *
 *   <LuminaPrompt>{currentChallenge.instruction}</LuminaPrompt>
 *   <LuminaPrompt accent="purple" center>Use the unit rate to find…</LuminaPrompt>
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { accentSoftBg, accentSoftBorder, type LuminaAccent } from './tokens';

export interface LuminaPromptProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: LuminaAccent;
  center?: boolean;
}

export const LuminaPrompt = React.forwardRef<HTMLDivElement, LuminaPromptProps>(
  ({ className, accent, center, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border p-4',
        accent ? cn(accentSoftBg[accent], accentSoftBorder[accent]) : 'bg-white/5 border-white/10',
        center && 'text-center',
        className
      )}
      {...props}
    >
      <div className="text-slate-100 font-medium leading-relaxed">{children}</div>
    </div>
  )
);
LuminaPrompt.displayName = 'LuminaPrompt';
