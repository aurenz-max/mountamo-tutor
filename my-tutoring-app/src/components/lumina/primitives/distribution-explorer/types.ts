/**
 * Distribution Explorer types.
 *
 * The orchestrator produces a `DistributionExplorerData` payload; the
 * `DistributionExplorer` component consumes it. The math engine in
 * `lumina/lib/probability` evaluates the chosen family at the current
 * parameter values to produce `EvaluatedDistribution` for the chart.
 */

// ── Family registry shapes (consumed by lib/probability/families.ts) ──

/**
 * Wave-1 distribution families. Add to this union (and to `FAMILIES` in
 * `families.ts`) to expand the engine.
 */
export type DistributionFamily = 'binomial' | 'poisson' | 'exponential';

export type DistributionKind = 'discrete' | 'continuous';

export interface ParameterSchema {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  /** When true, slider produces integer values (e.g. n in Binomial). */
  integer?: boolean;
}

export interface FamilyDefinition {
  family: DistributionFamily;
  label: string;
  kind: DistributionKind;
  parameters: ParameterSchema[];
  description: string;
  /** KaTeX source, no $ wrapping. Rendered in the formula panel. */
  formula: string;
  evaluate: (params: Record<string, number>) => EvaluatedDistribution;
}

// ── Evaluated distribution (engine output) ───────────────────────────

export interface PMFPoint {
  x: number;
  /** Probability mass at x. */
  p: number;
}

export interface PDFPoint {
  x: number;
  /** Density at x. */
  density: number;
}

export interface MomentSet {
  mean: number;
  variance: number;
  skewness: number;
  kurtosis: number;
}

export interface DiscreteEvaluation {
  kind: 'discrete';
  pmf: PMFPoint[];
  /** Cumulative — same x grid as `pmf`, with `p` replaced by running sum. */
  cdf: PMFPoint[];
  moments: MomentSet;
  support: { lower: number; upper: number };
}

export interface ContinuousEvaluation {
  kind: 'continuous';
  pdf: PDFPoint[];
  /** Same x grid as `pdf`, with `density` replaced by F(x). */
  cdf: PDFPoint[];
  moments: MomentSet;
  support: { lower: number; upper: number };
}

export type EvaluatedDistribution = DiscreteEvaluation | ContinuousEvaluation;

// ── Phase + eval mode taxonomy (mirrors the PRD ladder) ──────────────

/**
 * Phase ladder for Wave 1. Drops `relationships` and `exam_practice` from
 * the full PRD ladder — those need overlay/morph features the MVP doesn't
 * ship.
 */
export type DistributionEvalMode =
  | 'explore'
  | 'identify'
  | 'compute_basic'
  | 'compute_advanced';

export interface EvalModeDescriptor {
  mode: DistributionEvalMode;
  label: string;
  beta: number;
  description: string;
}

export const DISTRIBUTION_EVAL_MODES: EvalModeDescriptor[] = [
  {
    mode: 'explore',
    label: 'Explore',
    beta: 1.0,
    description: 'Free parameter manipulation with guided prompts',
  },
  {
    mode: 'identify',
    label: 'Identify',
    beta: 3.0,
    description: 'Identify distribution from shape, moments, or support',
  },
  {
    mode: 'compute_basic',
    label: 'Compute (basic)',
    beta: 4.5,
    description: 'Single-distribution probability calculations',
  },
  {
    mode: 'compute_advanced',
    label: 'Compute (advanced)',
    beta: 6.5,
    description: 'Conditional probabilities, tail probabilities, percentile lookups',
  },
];

// ── Challenges (orchestrator output) ─────────────────────────────────

/**
 * Each phase's challenge type. The component renders different UIs per type:
 * - `identify`: radio of family options + (optionally) param ranges
 * - `compute`: numeric input with tolerance check
 * - `predict_shape`: short text/MCQ ("right-skewed", "symmetric", etc.)
 * - `guided_exploration`: a prompt only, no graded answer (explore mode)
 */
export type ChallengeType =
  | 'guided_exploration'
  | 'identify'
  | 'compute'
  | 'predict_shape';

export interface BaseChallenge {
  id: string;
  type: ChallengeType;
  /** The question shown to the student. */
  prompt: string;
  /** Optional per-challenge scenario context ("an insurance company..."). */
  scenario?: string;
  /** Optional hint, revealed after the first wrong attempt. */
  hint?: string;
  /** Plain-language explanation revealed after commit (correct or not). */
  rationale: string;
}

export interface GuidedExplorationChallenge extends BaseChallenge {
  type: 'guided_exploration';
  /** Open-ended prompt; no grade. Auto-completes when student clicks "Got it". */
}

export interface IdentifyChallenge extends BaseChallenge {
  type: 'identify';
  /** The correct family. */
  correctFamily: DistributionFamily;
  /**
   * Distractor families to show alongside the correct one. The component
   * shuffles `[correctFamily, ...distractors]` for the radio UI.
   */
  distractors: DistributionFamily[];
}

export interface ComputeChallenge extends BaseChallenge {
  type: 'compute';
  /** Numeric answer the student must select. */
  correctValue: number;
  /**
   * MCQ distractors — plausible wrong numeric answers (common errors, reciprocals,
   * off-by-one, parameter confusion, etc.). The component shuffles
   * `[correctValue, ...distractors]` for the choice grid. Must contain 2-3
   * distinct values, none equal to `correctValue`.
   */
  distractors: number[];
  /**
   * Display unit shown beside each choice ("%", "claims", "hours"). Optional.
   * The unit applies to all choices, not just one.
   */
  unit?: string;
  /**
   * Number of decimal places used to format choices. When omitted, the
   * component picks a sensible default (4 for fractional answers, 2 for ≥1).
   */
  decimals?: number;
}

export interface PredictShapeChallenge extends BaseChallenge {
  type: 'predict_shape';
  /** First entry is canonical answer; others are accepted synonyms (case-insensitive). */
  acceptableAnswers: string[];
  /**
   * MCQ distractors — wrong shape descriptions ("symmetric", "left-skewed", etc.).
   * Required: predict_shape is always rendered as multiple choice. Must contain
   * 2-3 entries that don't semantically match any acceptableAnswer.
   */
  distractors: string[];
}

export type DistributionChallenge =
  | GuidedExplorationChallenge
  | IdentifyChallenge
  | ComputeChallenge
  | PredictShapeChallenge;

// ── Top-level data ──────────────────────────────────────────────────

export interface DistributionExplorerData {
  title: string;
  /** Lesson-level subject tag for the header pill ("Probability", "Actuarial"). */
  subject: string;
  /** Eval mode this content was authored for. Drives challenge type + difficulty. */
  evalMode: DistributionEvalMode;

  /**
   * Initial distribution shown when the workbench mounts. The student can
   * change family + parameters freely from there (except in `identify`
   * challenges where the family selector is hidden until they answer).
   */
  initial: {
    family: DistributionFamily;
    /** Partial — engine fills in defaults for any missing params. */
    parameters: Partial<Record<string, number>>;
  };

  /**
   * Brief lesson framing — shown above the workbench. Sets the actuarial
   * context ("In life insurance, claim counts often follow a Poisson
   * distribution...").
   */
  lessonContext: string;

  /** Phase challenges, ordered from easy to hard. The component gates them sequentially. */
  challenges: DistributionChallenge[];

  // ── Tutoring plumbing (optional, auto-injected by the renderer) ──
  instanceId?: string;
  gradeLevel?: string;

  /** Optional debug payload — visible in the tester but not in production. */
  debug?: DistributionExplorerDebug;
}

export interface DistributionExplorerDebug {
  /** The raw orchestrator response, for inspection in the tester. */
  rawOrchestrator: unknown;
  /** Generation duration (ms). */
  durationMs: number;
}
