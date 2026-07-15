/**
 * LuminaProgress — a thin accent progress bar.
 *
 * The slim trackers in primitives ("0/3 explored"). Faint white rail with an
 * accent-filled indicator. Wraps shadcn's Radix Progress.
 *
 *   <LuminaProgress value={66} accent="cyan" />
 */
import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';
import { accentSolidBg, type LuminaAccent } from './tokens';

export interface LuminaProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** 0–100. */
  value?: number;
  accent?: LuminaAccent;
}

export const LuminaProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  LuminaProgressProps
>(({ className, value = 0, accent = 'cyan', ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-white/10', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        'h-full w-full flex-1 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out',
        accentSolidBg[accent]
      )}
      style={{ transform: `translateX(-${100 - value}%)` }}
    />
  </ProgressPrimitive.Root>
));
LuminaProgress.displayName = 'LuminaProgress';
