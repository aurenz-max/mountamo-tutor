/**
 * LuminaChallengeCounter — "Challenge X of Y" progress indicator.
 *
 * Two renderings appear across primitives: a plain muted text ("Challenge 1
 * of 5", CountingBoard/TenFrame) and a dotted-dots strip ("CHALLENGE 1 OF 4
 * ●○○○", RatioTable). Codified so they stop being hand-rolled per primitive.
 *
 *   <LuminaChallengeCounter current={1} total={5} />               // text
 *   <LuminaChallengeCounter current={1} total={4} variant="dots" accent="purple" />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { accentSolidBg, type LuminaAccent } from './tokens';

export interface LuminaChallengeCounterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 1-based index of the active challenge. */
  current: number;
  total: number;
  variant?: 'text' | 'dots';
  accent?: LuminaAccent;
}

export const LuminaChallengeCounter: React.FC<LuminaChallengeCounterProps> = ({
  current,
  total,
  variant = 'text',
  accent = 'cyan',
  className,
  ...props
}) => {
  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center gap-3', className)} {...props}>
        <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
          Challenge {current} of {total}
        </span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i < current ? accentSolidBg[accent] : 'bg-slate-600'
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <span className={cn('text-slate-500 text-xs', className)} {...props}>
      Challenge {current} of {total}
    </span>
  );
};
