/**
 * LuminaSectionLabel — uppercase eyebrow with an accent left-bar.
 *
 * The section header pattern: SYNTHESIS & ANALYSIS, MACHINE PROFILE,
 * FOUNDATIONAL CONCEPTS. Extracted from ComparisonPanel.tsx's synthesis header.
 *
 *   <LuminaSectionLabel accent="purple">Synthesis & Analysis</LuminaSectionLabel>
 *   <LuminaSectionLabel accent="cyan" size="sm">In the Diagram</LuminaSectionLabel>
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { accentSolidBg, accentStrongText, type LuminaAccent } from './tokens';

const labelText = cva('font-bold uppercase', {
  variants: {
    size: {
      sm: 'text-xs tracking-widest',
      lg: 'text-lg tracking-widest',
    },
  },
  defaultVariants: { size: 'lg' },
});

const barSize = cva('rounded-full flex-shrink-0', {
  variants: {
    size: {
      sm: 'w-0.5 h-4',
      lg: 'w-1 h-7',
    },
  },
  defaultVariants: { size: 'lg' },
});

export interface LuminaSectionLabelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof labelText> {
  accent?: LuminaAccent;
}

export const LuminaSectionLabel = React.forwardRef<HTMLDivElement, LuminaSectionLabelProps>(
  ({ className, accent = 'cyan', size, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-3', className)} {...props}>
      <span className={cn(barSize({ size }), accentSolidBg[accent])} />
      <span className={cn(labelText({ size }), accentStrongText[accent])}>{children}</span>
    </div>
  )
);
LuminaSectionLabel.displayName = 'LuminaSectionLabel';
