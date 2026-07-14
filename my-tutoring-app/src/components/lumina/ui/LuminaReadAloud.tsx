'use client';

/**
 * LuminaReadAloud — the one "read this to me" affordance.
 *
 * Every primitive that offers tutor read-aloud previously rolled its own
 * surface: an indigo pill with a lucide Volume2 (CuratorBrief), a raw 🔊
 * emoji on a LuminaButton (DeepDive quiz blocks), a local "Listen" pill
 * (PassageStudio), a "🔊 Read to me" text label (ProseBlock). Same promise
 * to the student — "tap this and the tutor's voice reads it to you" — four
 * different looks. This is the single kit surface for that promise.
 *
 * The glyph is the Aurora Core reading aloud: three text lines (the "this"),
 * then the luminous brand core (the tutor — the same light-source dot as
 * LuminaMark), emitting sound arcs. Text becomes voice. Pre-readers can't
 * read the label, so the glyph IS the affordance — it must be the same mark
 * everywhere so it's learned once, and it ripples while the tutor is
 * actually speaking (pass `speaking`) so cause and effect stay connected.
 *
 *   <LuminaReadAloud onClick={readSection} />                        // default pill
 *   <LuminaReadAloud size="lg" onClick={...} />                      // pre-reader tier
 *   <LuminaReadAloud iconOnly size="sm" aria-label="Hear the question again" />
 *   <LuminaReadAloud speaking={tutorSpeaking} onClick={...} />       // arcs ripple
 *
 * Accent doctrine: audio OUT (the tutor's voice) is cyan across Lumina, the
 * counterpart to the mic-in orb's emerald (LuminaMicListener). Override only
 * when a primitive's whole surface runs on another accent.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  accentBorder,
  accentGlow,
  accentText,
  type LuminaAccent,
} from './tokens';

// SVG paint — accent hues at the Tailwind-400 weight. Same documented paint
// exception as LuminaMicListener/LuminaScoreRing: SVG stroke/fill can't use
// Tailwind class strings, so canvas-style paint resolves to hex here.
const ACCENT_HEX: Record<LuminaAccent, string> = {
  orange: '#fb923c',
  emerald: '#34d399',
  cyan: '#22d3ee',
  amber: '#fbbf24',
  blue: '#60a5fa',
  purple: '#c084fc',
  pink: '#f472b6',
  rose: '#fb7185',
  indigo: '#818cf8',
  teal: '#2dd4bf',
};

// Hover fills need full literal class names (Tailwind JIT), and tokens.ts has
// no hover-weight map — kept local to the one component that needs it.
const HOVER_BG: Record<LuminaAccent, string> = {
  orange: 'hover:bg-orange-500/20',
  emerald: 'hover:bg-emerald-500/20',
  cyan: 'hover:bg-cyan-500/20',
  amber: 'hover:bg-amber-500/20',
  blue: 'hover:bg-blue-500/20',
  purple: 'hover:bg-purple-500/20',
  pink: 'hover:bg-pink-500/20',
  rose: 'hover:bg-rose-500/20',
  indigo: 'hover:bg-indigo-500/20',
  teal: 'hover:bg-teal-500/20',
};

export interface LuminaReadAloudGlyphProps {
  /** Rendered square size in px. Default 20. */
  size?: number;
  accent?: LuminaAccent;
  /** Ripple the sound arcs + halo while the tutor voice is playing. */
  speaking?: boolean;
  className?: string;
}

// Glyph geometry (32×32 viewBox): text lines left, voice core at (17.5, 16),
// arcs opening rightward across ±50°.
const ARC_SPECS = [
  { d: 'M21.36 11.4 A6 6 0 0 1 21.36 20.6', width: 2.2, idle: 0.85, delay: '0s' },
  { d: 'M23.61 8.72 A9.5 9.5 0 0 1 23.61 23.28', width: 2.1, idle: 0.55, delay: '-0.45s' },
  { d: 'M25.86 6.04 A13 13 0 0 1 25.86 25.96', width: 2.0, idle: 0.32, delay: '-0.9s' },
] as const;

/**
 * The bare mark, exported for surfaces that need the icon without the button
 * chrome (e.g. inside an answer-choice card). Interactive placements should
 * use LuminaReadAloud so the tap target and a11y come for free.
 */
export const LuminaReadAloudGlyph: React.FC<LuminaReadAloudGlyphProps> = ({
  size = 20,
  accent = 'cyan',
  speaking = false,
  className,
}) => {
  const haloId = `lra-halo-${React.useId().replace(/:/g, '')}`;
  const color = ACCENT_HEX[accent];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <defs>
        <radialGradient id={haloId} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor={color} stopOpacity={speaking ? 0.55 : 0.3} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The "this" being read — three text lines in neutral ink. */}
      <path d="M3 10.2H12" stroke="#E2E8F0" strokeOpacity="0.85" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 16H9.5" stroke="#E2E8F0" strokeOpacity="0.6" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 21.8H11" stroke="#E2E8F0" strokeOpacity="0.75" strokeWidth="2.2" strokeLinecap="round" />

      {/* The tutor — the luminous Aurora core (see LuminaMark), haloed. */}
      <circle
        cx="17.5"
        cy="16"
        r="7.5"
        fill={`url(#${haloId})`}
        className={speaking ? 'animate-pulse' : undefined}
      />
      <circle cx="17.5" cy="16" r="2.7" fill={color} />

      {/* Its voice — arcs ripple outward while actually speaking. */}
      {ARC_SPECS.map((arc) => (
        <path
          key={arc.d}
          d={arc.d}
          stroke={color}
          strokeWidth={arc.width}
          strokeLinecap="round"
          opacity={arc.idle}
          className={speaking ? 'animate-pulse' : undefined}
          style={speaking ? { animationDelay: arc.delay, animationDuration: '1.4s' } : undefined}
        />
      ))}
    </svg>
  );
};

const SIZES = {
  sm: { icon: 16, pad: 'px-2.5 py-1 gap-1.5', iconPad: 'p-1.5', text: 'text-xs font-medium' },
  md: { icon: 20, pad: 'px-4 py-2 gap-2', iconPad: 'p-2', text: 'text-sm font-medium' },
  // lg = the pre-reader tier: ≥44px tap target, emphasized presence.
  lg: { icon: 27, pad: 'px-5 py-3 gap-2.5', iconPad: 'p-3', text: 'text-base font-semibold' },
} as const;

export interface LuminaReadAloudProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Button copy; also the default aria-label. */
  label?: string;
  /** Copy swapped in while `speaking`. */
  speakingLabel?: string;
  /** Glyph-only round tap target (label still announced to screen readers). */
  iconOnly?: boolean;
  size?: keyof typeof SIZES;
  accent?: LuminaAccent;
  /** True while the tutor voice is playing — the glyph ripples. */
  speaking?: boolean;
}

export const LuminaReadAloud = React.forwardRef<HTMLButtonElement, LuminaReadAloudProps>(
  (
    {
      label = 'Read this to me',
      speakingLabel = 'Reading to you…',
      iconOnly = false,
      size = 'md',
      accent = 'cyan',
      speaking = false,
      className,
      type,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const sz = SIZES[size];
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        aria-label={ariaLabel ?? label}
        className={cn(
          'inline-flex items-center justify-center rounded-full border transition-all',
          'hover:scale-[1.03] active:scale-95',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
          'disabled:opacity-40 disabled:pointer-events-none',
          accentGlow[accent],
          accentBorder[accent],
          HOVER_BG[accent],
          accentText[accent],
          iconOnly ? sz.iconPad : sz.pad,
          sz.text,
          size === 'lg' && 'shadow-lg',
          className
        )}
        {...props}
      >
        <LuminaReadAloudGlyph size={sz.icon} accent={accent} speaking={speaking} />
        {!iconOnly && <span>{speaking ? speakingLabel : label}</span>}
      </button>
    );
  }
);
LuminaReadAloud.displayName = 'LuminaReadAloud';
