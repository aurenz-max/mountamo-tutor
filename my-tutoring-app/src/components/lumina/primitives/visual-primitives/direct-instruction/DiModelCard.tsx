'use client';

/**
 * The DI "my turn" card: a DIFFERENT item, solved, on screen only while the tutor's model lever is pulled.
 *
 * A plain nested panel with an amber rail. Not the purple dashed outline: that outline marks what the tutor is pointing
 * at, so a model drawn in it read as part of the child's question. No speaking glyph: it read as "say this one".
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { LuminaPanel } from '../../../ui';

export const DiModelCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { lever: string }>(
  ({ lever, className, ...props }, ref) =>
    <LuminaPanel ref={ref} accent="amber" data-lever={lever} className={cn('rounded-xl px-4 py-2 text-slate-100', className)} {...props} />,
);
DiModelCard.displayName = 'DiModelCard';
