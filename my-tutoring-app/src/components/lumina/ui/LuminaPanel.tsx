/**
 * LuminaPanel — a nested section surface inside a LuminaCard.
 *
 * Replaces the ad-hoc `<div className="bg-black/20 border border-white/10
 * rounded-lg p-4">` blocks used for sub-sections, readouts, and control
 * groups. Optional `accent` adds a left rail to label the section's category.
 *
 *   <LuminaPanel>...</LuminaPanel>
 *   <LuminaPanel accent="cyan">Controls</LuminaPanel>
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { surface, accentBorder, type LuminaAccent } from './tokens';

export interface LuminaPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: LuminaAccent;
}

export const LuminaPanel = React.forwardRef<HTMLDivElement, LuminaPanelProps>(
  ({ className, accent, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        surface.nested,
        'rounded-lg border p-4',
        accent && cn('border-l-2', accentBorder[accent]),
        className
      )}
      {...props}
    />
  )
);
LuminaPanel.displayName = 'LuminaPanel';
