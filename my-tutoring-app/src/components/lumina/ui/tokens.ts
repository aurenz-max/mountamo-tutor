/**
 * Lumina design tokens — the single source of truth for the glass aesthetic.
 *
 * Before this file existed, the glass-card class string
 * (`backdrop-blur-xl bg-slate-900/40 border-white/10`) was hand-copied into
 * 140+ primitives. Evolving the theme meant editing 140 files. Now the look
 * lives here and flows through the Lumina* components that consume it — tweak
 * a token once, and every primitive moves with it.
 *
 * IMPORTANT (Tailwind JIT): class names must appear as complete literal
 * strings somewhere in the source for Tailwind to generate them. That's why
 * the accent maps below spell out every `text-orange-300` etc. in full —
 * never build them with interpolation like `text-${accent}-300`.
 */

// ── Surfaces ────────────────────────────────────────────────────────────
// The card/panel backgrounds. `glass` is the default Lumina card; `nested`
// is for sections inside a card; `elevated` is for modals / focal surfaces.
export const surface = {
  glass: 'backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl',
  nested: 'bg-black/20 border-white/10',
  elevated: 'backdrop-blur-xl bg-slate-900/60 border-white/15 shadow-2xl',
} as const;

export type LuminaSurface = keyof typeof surface;

// ── Text hierarchy ──────────────────────────────────────────────────────
export const text = {
  primary: 'text-slate-100', // main content
  secondary: 'text-slate-400', // descriptions, captions
  muted: 'text-slate-600', // labels, metadata
} as const;

// ── Interactive chrome ──────────────────────────────────────────────────
export const interactive = {
  ghost: 'bg-white/5 border border-white/20 hover:bg-white/10',
  hover: 'hover:bg-white/10 hover:border-white/20',
} as const;

// ── Motion ──────────────────────────────────────────────────────────────
// The feedback motion language — answerStateClasses, applied to time.
// Pop-on-correct, shake-on-wrong, and reveal are pedagogical feedback: they
// must feel identical in every primitive, so they are named here rather than
// hand-rolled per file. Keyframes live in tailwind.config.ts. The
// `motion-safe:` prefix disables them under prefers-reduced-motion for free.
export const motion = {
  /** Correct answer lands — 350ms spring overshoot (scale 1 → 1.08 → 1). */
  pop: 'motion-safe:animate-lumina-pop',
  /** Incorrect attempt — 350ms decaying horizontal shake. Gentle: "try again", not punishment. */
  shake: 'motion-safe:animate-lumina-shake',
  /** Feedback / results / hints entering — 300ms fade + 10px rise. */
  reveal: 'motion-safe:animate-lumina-reveal',
  /** Every tappable compresses on press. */
  press: 'active:scale-95 transition-transform duration-150',
  /** The default transition for hover and state changes. */
  transition: 'transition-all duration-200',
  /** Slower — grading reveals and surface shifts. */
  transitionSlow: 'transition-all duration-300',
} as const;

export type LuminaMotion = keyof typeof motion;

// ── Accents ─────────────────────────────────────────────────────────────
// Kingdom / category / phase colors. Aligned with the PhaseConfig accent
// union used by usePhaseResults / PhaseSummaryPanel.
export const LUMINA_ACCENTS = [
  'orange',
  'emerald',
  'cyan',
  'amber',
  'blue',
  'purple',
  'pink',
  'rose',
  'indigo',
  'teal',
] as const;

export type LuminaAccent = (typeof LUMINA_ACCENTS)[number];

// Full literal class names (see Tailwind JIT note above).
export const accentText: Record<LuminaAccent, string> = {
  orange: 'text-orange-300',
  emerald: 'text-emerald-300',
  cyan: 'text-cyan-300',
  amber: 'text-amber-300',
  blue: 'text-blue-300',
  purple: 'text-purple-300',
  pink: 'text-pink-300',
  rose: 'text-rose-300',
  indigo: 'text-indigo-300',
  teal: 'text-teal-300',
};

export const accentBorder: Record<LuminaAccent, string> = {
  orange: 'border-orange-400/30',
  emerald: 'border-emerald-400/30',
  cyan: 'border-cyan-400/30',
  amber: 'border-amber-400/30',
  blue: 'border-blue-400/30',
  purple: 'border-purple-400/30',
  pink: 'border-pink-400/30',
  rose: 'border-rose-400/30',
  indigo: 'border-indigo-400/30',
  teal: 'border-teal-400/30',
};

export const accentGlow: Record<LuminaAccent, string> = {
  orange: 'bg-orange-500/10',
  emerald: 'bg-emerald-500/10',
  cyan: 'bg-cyan-500/10',
  amber: 'bg-amber-500/10',
  blue: 'bg-blue-500/10',
  purple: 'bg-purple-500/10',
  pink: 'bg-pink-500/10',
  rose: 'bg-rose-500/10',
  indigo: 'bg-indigo-500/10',
  teal: 'bg-teal-500/10',
};

// ── Callout treatment ───────────────────────────────────────────────────
// The stronger accent weight used by icon-chip panels (KEY DIFFERENCES,
// IN CONTEXT, SELF-CHECK, MISCONCEPTION) and section labels. Extracted
// verbatim from ComparisonPanel.tsx + MachineProfile.tsx — the
// reference-quality primitives. Distinct from the label weight (-300) above.

// Solid fill — accent bars, status dots, progress indicators.
export const accentSolidBg: Record<LuminaAccent, string> = {
  orange: 'bg-orange-500',
  emerald: 'bg-emerald-500',
  cyan: 'bg-cyan-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  rose: 'bg-rose-500',
  indigo: 'bg-indigo-500',
  teal: 'bg-teal-500',
};

// Soft tinted panel background — the callout body.
export const accentSoftBg: Record<LuminaAccent, string> = {
  orange: 'bg-orange-500/5',
  emerald: 'bg-emerald-500/5',
  cyan: 'bg-cyan-500/5',
  amber: 'bg-amber-500/5',
  blue: 'bg-blue-500/5',
  purple: 'bg-purple-500/5',
  pink: 'bg-pink-500/5',
  rose: 'bg-rose-500/5',
  indigo: 'bg-indigo-500/5',
  teal: 'bg-teal-500/5',
};

// Icon-chip background — the rounded square holding the callout icon.
export const accentChipBg: Record<LuminaAccent, string> = {
  orange: 'bg-orange-500/20',
  emerald: 'bg-emerald-500/20',
  cyan: 'bg-cyan-500/20',
  amber: 'bg-amber-500/20',
  blue: 'bg-blue-500/20',
  purple: 'bg-purple-500/20',
  pink: 'bg-pink-500/20',
  rose: 'bg-rose-500/20',
  indigo: 'bg-indigo-500/20',
  teal: 'bg-teal-500/20',
};

// Soft border — the callout panel edge.
export const accentSoftBorder: Record<LuminaAccent, string> = {
  orange: 'border-orange-500/20',
  emerald: 'border-emerald-500/20',
  cyan: 'border-cyan-500/20',
  amber: 'border-amber-500/20',
  blue: 'border-blue-500/20',
  purple: 'border-purple-500/20',
  pink: 'border-pink-500/20',
  rose: 'border-rose-500/20',
  indigo: 'border-indigo-500/20',
  teal: 'border-teal-500/20',
};

// Strong accent text — callout labels and icons (-400, brighter than -300).
export const accentStrongText: Record<LuminaAccent, string> = {
  orange: 'text-orange-400',
  emerald: 'text-emerald-400',
  cyan: 'text-cyan-400',
  amber: 'text-amber-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  pink: 'text-pink-400',
  rose: 'text-rose-400',
  indigo: 'text-indigo-400',
  teal: 'text-teal-400',
};

// ── Performance tiers ───────────────────────────────────────────────────
// Score → tier mapping for results/celebration. Single source of truth: this
// TIER_CONFIG was duplicated across PhaseSummaryPanel, EvaluationResultsIndicator,
// and ComparisonPanel — kit components (LuminaScoreRing, results panels) and
// primitives should read it from here.
export type PerformanceTier = 'perfect' | 'great' | 'good' | 'needs-work';

export function getPerformanceTier(score: number): PerformanceTier {
  if (score >= 100) return 'perfect';
  if (score >= 80) return 'great';
  if (score >= 50) return 'good';
  return 'needs-work';
}

export interface TierStyle {
  label: string;
  emoji: string;
  ringStroke: string; // stroke-* for the SVG score ring
  solidBg: string; // bg-* for glow/bars
  badge: string; // bg/text/border classes for the tier badge
  text: string; // accent text
}

export const TIERS: Record<PerformanceTier, TierStyle> = {
  perfect: {
    label: 'Perfect!',
    emoji: '🌟',
    ringStroke: 'stroke-emerald-400',
    solidBg: 'bg-emerald-500',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    text: 'text-emerald-400',
  },
  great: {
    label: 'Great Job!',
    emoji: '⭐',
    ringStroke: 'stroke-blue-400',
    solidBg: 'bg-blue-500',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    text: 'text-blue-400',
  },
  good: {
    label: 'Good Work',
    emoji: '👍',
    ringStroke: 'stroke-amber-400',
    solidBg: 'bg-amber-500',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    text: 'text-amber-400',
  },
  'needs-work': {
    label: 'Keep Practicing',
    emoji: '💪',
    ringStroke: 'stroke-rose-400',
    solidBg: 'bg-rose-500',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    text: 'text-rose-400',
  },
};

// ── Answer-choice state colors ──────────────────────────────────────────
// The grading-state color language shared by LuminaAnswerChoice AND the
// interaction surfaces that grade their own items (matching, categorize,
// sequence). The drag/click MECHANICS stay bespoke per primitive; these
// COLORS come from here so "selected / correct / incorrect" looks identical
// everywhere. Retune a state once → it changes across the whole system.
export type AnswerChoiceState = 'idle' | 'selected' | 'correct' | 'incorrect' | 'dimmed';

export const answerStateClasses: Record<AnswerChoiceState, string> = {
  idle: 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:border-white/20',
  selected: 'border-blue-500 bg-blue-500/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]',
  correct: 'border-emerald-500 bg-emerald-500/20 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]',
  incorrect: 'border-rose-500 bg-rose-500/20 text-white opacity-60',
  dimmed: 'border-transparent bg-black/20 text-slate-400 opacity-40',
};

export const answerStateClass = (state: AnswerChoiceState): string => answerStateClasses[state];

// ── Drop-zone state colors ──────────────────────────────────────────────
// The shared visual language for drop TARGETS (sorters, sequencers,
// categorizers). Mirrors answerStateClasses: the drag/click MECHANICS stay
// bespoke per primitive; the state COLORS come from here so "this is a
// target / release here / right / wrong" looks identical everywhere.
// dragOver reuses the blue `selected` glow; grading reuses emerald/rose —
// one color language across chips, answers, and zones. Compose motion.pop
// on correct and motion.shake on incorrect (LuminaDropZone does this).
export type DropZoneState = 'idle' | 'dragOver' | 'filled' | 'correct' | 'incorrect';

export const dropZoneStateClasses: Record<DropZoneState, string> = {
  idle: 'border-2 border-dashed border-white/15 bg-white/[0.03] text-slate-500',
  dragOver:
    'border-2 border-dashed border-blue-500 bg-blue-500/15 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.25)] scale-[1.02]',
  filled: 'border-2 border-solid border-white/20 bg-white/5 text-slate-200',
  correct:
    'border-2 border-solid border-emerald-500 bg-emerald-500/15 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]',
  incorrect: 'border-2 border-solid border-rose-500 bg-rose-500/15 text-rose-200',
};

export const dropZoneStateClass = (state: DropZoneState): string => dropZoneStateClasses[state];
