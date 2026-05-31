/**
 * LuminaButton — the canonical Lumina button.
 *
 * Replaces `<Button variant="ghost" className="bg-white/5 border
 * border-white/20 hover:bg-white/10">` — the default action button across
 * every interactive primitive.
 *
 *   <LuminaButton>Submit</LuminaButton>                  // ghost (default)
 *   <LuminaButton tone="primary">Continue</LuminaButton> // emphasized
 *   <LuminaButton tone="danger">Reset</LuminaButton>
 *
 * Built on the shadcn Button (variant="ghost") so size, asChild, disabled,
 * focus rings, and all native button props still work.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const luminaButtonVariants = cva('transition-colors', {
  variants: {
    tone: {
      ghost: 'bg-white/5 border border-white/20 text-slate-100 hover:bg-white/10',
      primary:
        'bg-cyan-500/15 border border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/25',
      danger:
        'bg-rose-500/15 border border-rose-400/40 text-rose-100 hover:bg-rose-500/25',
      subtle: 'bg-transparent border border-white/10 text-slate-300 hover:bg-white/5',
    },
  },
  defaultVariants: { tone: 'ghost' },
});

export interface LuminaButtonProps
  extends Omit<ButtonProps, 'variant'>,
    VariantProps<typeof luminaButtonVariants> {}

export const LuminaButton = React.forwardRef<HTMLButtonElement, LuminaButtonProps>(
  ({ className, tone, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      className={cn(luminaButtonVariants({ tone }), className)}
      {...props}
    />
  )
);
LuminaButton.displayName = 'LuminaButton';
