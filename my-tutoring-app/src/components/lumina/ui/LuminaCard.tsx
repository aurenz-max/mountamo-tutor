/**
 * LuminaCard — the canonical Lumina glass card.
 *
 * Replaces the hand-typed `<Card className="backdrop-blur-xl bg-slate-900/40
 * border-white/10 shadow-2xl">` pattern (236 copies across 140 files).
 * Wraps the shadcn Card so all shadcn behavior is preserved; only the surface
 * styling is baked in and centralized via design tokens.
 *
 *   <LuminaCard>...</LuminaCard>                  // default glass
 *   <LuminaCard surface="nested">...</LuminaCard> // section inside a card
 *   <LuminaCard surface="elevated">...</LuminaCard>
 *
 * Use the themed title/description so the text hierarchy is consistent too.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { surface, text, accentSolidBg, type LuminaAccent } from './tokens';

const luminaCardVariants = cva('', {
  variants: {
    surface: {
      glass: surface.glass,
      nested: surface.nested,
      elevated: surface.elevated,
    },
  },
  defaultVariants: { surface: 'glass' },
});

export interface LuminaCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof luminaCardVariants> {
  /**
   * Optional thin accent bar across the top edge — a consistent, token-driven
   * "active/focus" affordance. Replaces the one-off gradient bars some
   * primitives hand-roll (e.g. FactFile's blue line). Default off.
   */
  topAccent?: LuminaAccent;
}

export const LuminaCard = React.forwardRef<HTMLDivElement, LuminaCardProps>(
  ({ className, surface: surfaceVariant, topAccent, children, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(
        luminaCardVariants({ surface: surfaceVariant }),
        topAccent && 'relative overflow-hidden',
        className
      )}
      {...props}
    >
      {topAccent && (
        <span className={cn('absolute inset-x-0 top-0 h-0.5', accentSolidBg[topAccent])} />
      )}
      {children}
    </Card>
  )
);
LuminaCard.displayName = 'LuminaCard';

// Header/Content/Footer carry no Lumina-specific styling — re-export as-is so
// a primitive can pull everything from `lumina/ui`.
export const LuminaCardHeader = CardHeader;
export const LuminaCardContent = CardContent;
export const LuminaCardFooter = CardFooter;

// Title/Description bake in the slate text hierarchy.
export const LuminaCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <CardTitle ref={ref} className={cn(text.primary, 'text-xl', className)} {...props} />
));
LuminaCardTitle.displayName = 'LuminaCardTitle';

export const LuminaCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <CardDescription ref={ref} className={cn(text.secondary, className)} {...props} />
));
LuminaCardDescription.displayName = 'LuminaCardDescription';
