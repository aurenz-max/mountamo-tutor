/**
 * LuminaMark — the Aurora Core brand mark, which doubles as a progress ring.
 *
 * The same luminous glyph used for the favicon (src/app/icon.svg): a gradient
 * tile, a soft halo, a crisp ring, and a bright light-source core. Omit
 * `progress` and it renders as the static brand logo. Pass `progress` (0–100)
 * and the ring fills clockwise from the top while the core brightens and grows
 * — so the same mark that brands the app also visualizes lesson progress.
 *
 *   <LuminaMark />                         // static logo (tile)
 *   <LuminaMark variant="bare" size={24} /> // inline mark, no tile
 *   <LuminaMark progress={pct} />          // fills as the lesson advances
 *
 * Geometry is locked to the 32×32 viewBox of the favicon so the tab icon and
 * the in-app logo are pixel-identical.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LuminaMarkProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rendered diameter in px. Default 32. */
  size?: number;
  /**
   * 0–100 ring fill. Omit for the static brand mark (a full, evenly-lit ring).
   * When provided, a faint track shows the remainder and a bright arc fills in.
   */
  progress?: number;
  /** 'tile' = gradient rounded-square lockup (logo/favicon); 'bare' = transparent glyph for inline UI. Default 'tile'. */
  variant?: 'tile' | 'bare';
  /** Animate ring/core transitions when `progress` changes. Default true. */
  animate?: boolean;
}

// Ring geometry within the 32×32 viewBox (matches icon.svg).
const CX = 16;
const CY = 16;
const RING_R = 8.4;
const RING_W = 1.7;
const CIRC = 2 * Math.PI * RING_R;

export const LuminaMark: React.FC<LuminaMarkProps> = ({
  className,
  size = 32,
  progress,
  variant = 'tile',
  animate = true,
  ...props
}) => {
  const uid = React.useId().replace(/:/g, '');
  const tileId = `lm-tile-${uid}`;
  const sheenId = `lm-sheen-${uid}`;
  const glowId = `lm-glow-${uid}`;
  const strokeId = `lm-stroke-${uid}`;

  const hasProgress = progress != null;
  const pct = hasProgress ? Math.max(0, Math.min(100, progress)) : 0;
  const t = pct / 100;

  // On a gradient tile the mark is white; bare on dark glass it uses the brand gradient.
  const inkSolid = '#FFFFFF';
  const ringInk = variant === 'tile' ? inkSolid : `url(#${strokeId})`;
  const coreInk = variant === 'tile' ? inkSolid : `url(#${strokeId})`;

  // The core "lights up" as the lesson completes: grows + glows.
  const coreR = hasProgress ? 3.9 + 1.1 * t : 4.8;
  const glowOpacity = hasProgress ? 0.4 + 0.55 * t : 0.92;

  const ringTransition = animate
    ? 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)'
    : undefined;
  const coreTransition = animate ? 'r 700ms cubic-bezier(0.22,1,0.36,1)' : undefined;

  return (
    <div
      className={cn('relative inline-block', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={hasProgress ? `Lumina — ${Math.round(pct)}% complete` : 'Lumina'}
      {...props}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id={tileId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60A5FA" />
            <stop offset="1" stopColor="#A855F7" />
          </linearGradient>
          <linearGradient id={sheenId} x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.28" />
            <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={strokeId} x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7DB6FB" />
            <stop offset="1" stopColor="#C084FC" />
          </linearGradient>
          <radialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.22" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Brand tile */}
        {variant === 'tile' && (
          <>
            <rect width="32" height="32" rx="8" fill={`url(#${tileId})`} />
            <rect width="32" height="32" rx="8" fill={`url(#${sheenId})`} />
          </>
        )}

        {/* Luminous halo radiating from the core */}
        <circle
          cx={CX}
          cy={CY}
          r="14"
          fill={`url(#${glowId})`}
          style={{ opacity: glowOpacity, transition: animate ? 'opacity 700ms ease-out' : undefined }}
        />

        {hasProgress ? (
          <>
            {/* Track (remaining) */}
            <circle
              cx={CX}
              cy={CY}
              r={RING_R}
              fill="none"
              stroke={variant === 'tile' ? '#FFFFFF' : '#94A3B8'}
              strokeOpacity={variant === 'tile' ? 0.2 : 0.25}
              strokeWidth={RING_W}
            />
            {/* Progress arc — fills clockwise from the top */}
            <circle
              cx={CX}
              cy={CY}
              r={RING_R}
              fill="none"
              stroke={ringInk}
              strokeWidth={RING_W}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - t)}
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{ transition: ringTransition }}
            />
          </>
        ) : (
          /* Static brand ring — evenly lit */
          <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke={ringInk} strokeOpacity={0.55} strokeWidth={1.5} />
        )}

        {/* Bright light-source core */}
        <circle cx={CX} cy={CY} r={coreR} fill={coreInk} style={{ transition: coreTransition }} />
      </svg>
    </div>
  );
};
