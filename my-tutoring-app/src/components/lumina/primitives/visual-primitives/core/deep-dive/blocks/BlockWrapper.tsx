'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export type BlockVariant = 'compact' | 'default' | 'feature';
export type BlockAccent = 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' | 'none';

interface BlockWrapperProps {
  children: React.ReactNode;
  /** Optional label shown as a subtle header inside the card */
  label?: string;
  /** Block index for scroll-snap targeting */
  index?: number;
  /** Visual weight: compact (tight padding), default, feature (extra padding + emphasis) */
  variant?: BlockVariant;
  /** Left-border accent color for instant block-type recognition */
  accent?: BlockAccent;
  className?: string;
}

const ACCENT_STYLES: Record<BlockAccent, string> = {
  blue: 'border-l-2 border-l-blue-400/60',
  emerald: 'border-l-2 border-l-emerald-400/60',
  amber: 'border-l-2 border-l-amber-400/60',
  purple: 'border-l-2 border-l-purple-400/60',
  rose: 'border-l-2 border-l-rose-400/60',
  indigo: 'border-l-2 border-l-indigo-400/60',
  none: '',
};

const ACCENT_LABEL_COLORS: Record<BlockAccent, string> = {
  blue: 'text-blue-400/70',
  emerald: 'text-emerald-400/70',
  amber: 'text-amber-400/70',
  purple: 'text-purple-400/70',
  rose: 'text-rose-400/70',
  indigo: 'text-indigo-400/70',
  none: 'text-slate-500',
};

const VARIANT_PADDING: Record<BlockVariant, string> = {
  compact: 'p-4',
  default: 'p-6',
  feature: 'p-7',
};

/**
 * Shared wrapper for all DeepDive blocks.
 * Now supports visual variants (compact/default/feature) and accent colors
 * for instant block-type differentiation at scroll speed.
 */
const BlockWrapper: React.FC<BlockWrapperProps> = ({
  children,
  label,
  index,
  variant = 'default',
  accent = 'none',
  className,
}) => {
  const accentClass = ACCENT_STYLES[accent];
  const labelColor = ACCENT_LABEL_COLORS[accent];
  const padding = VARIANT_PADDING[variant];

  return (
    <Card
      data-block-index={index}
      className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-lg overflow-hidden ${accentClass} ${className || ''}`}
    >
      <CardContent className={padding}>
        {label && (
          <div className={`text-xs font-mono uppercase tracking-widest ${labelColor} mb-4`}>
            {label}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
};

export default BlockWrapper;
