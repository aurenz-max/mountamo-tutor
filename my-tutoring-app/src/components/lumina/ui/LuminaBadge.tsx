/**
 * LuminaBadge — the canonical Lumina badge / category chip.
 *
 * Replaces `<Badge className="bg-slate-800/50 border-slate-700/50
 * text-orange-300">`. The `accent` prop drives the text color from the shared
 * accent palette, so kingdom/category/phase colors stay consistent.
 *
 *   <LuminaBadge>Default</LuminaBadge>
 *   <LuminaBadge accent="emerald">Mastered</LuminaBadge>
 *   <LuminaBadge accent="amber">In Progress</LuminaBadge>
 */
import * as React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { accentText, type LuminaAccent } from './tokens';

export interface LuminaBadgeProps extends Omit<BadgeProps, 'variant'> {
  accent?: LuminaAccent;
}

export const LuminaBadge: React.FC<LuminaBadgeProps> = ({
  className,
  accent,
  ...props
}) => (
  <Badge
    variant="outline"
    className={cn(
      'bg-slate-800/50 border-slate-700/50 font-medium',
      accent ? accentText[accent] : 'text-slate-300',
      className
    )}
    {...props}
  />
);
