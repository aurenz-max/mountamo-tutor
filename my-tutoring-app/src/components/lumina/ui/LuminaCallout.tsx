/**
 * LuminaCallout — icon-chip + uppercase accent label + body.
 *
 * The single most-repeated pattern in Lumina primitives: KEY DIFFERENCES,
 * KEY SIMILARITIES, WHEN TO USE, COMMON MISCONCEPTION, IN CONTEXT, SELF-CHECK.
 * Extracted verbatim from ComparisonPanel.tsx's synthesis panels.
 *
 *   <LuminaCallout accent="rose" label="Key Differences" icon={<X />}>
 *     <ul>…</ul>
 *   </LuminaCallout>
 *
 *   <LuminaCallout accent="amber" label="Common Misconception" icon={<AlertTriangle />} italic>
 *     Many people think tracks are just heavy metal…
 *   </LuminaCallout>
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  accentSoftBg,
  accentSoftBorder,
  accentChipBg,
  accentStrongText,
  type LuminaAccent,
} from './tokens';

export interface LuminaCalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  accent: LuminaAccent;
  label: string;
  /** Icon node (e.g. a lucide icon). Rendered in the accent chip. */
  icon?: React.ReactNode;
  /** Italicize the body — used for misconceptions / quotes. */
  italic?: boolean;
}

export const LuminaCallout = React.forwardRef<HTMLDivElement, LuminaCalloutProps>(
  ({ className, accent, label, icon, italic, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border p-6', accentSoftBg[accent], accentSoftBorder[accent], className)}
      {...props}
    >
      <div className="flex items-center gap-2 mb-4">
        {icon && (
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              accentChipBg[accent],
              accentStrongText[accent]
            )}
          >
            {icon}
          </div>
        )}
        <h5 className={cn('text-sm font-bold uppercase tracking-wider', accentStrongText[accent])}>
          {label}
        </h5>
      </div>
      <div className={cn('text-sm text-slate-200 leading-relaxed', italic && 'italic')}>
        {children}
      </div>
    </div>
  )
);
LuminaCallout.displayName = 'LuminaCallout';
