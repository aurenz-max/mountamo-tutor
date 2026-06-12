/**
 * Difficulty Context — IRT-derived within-mode difficulty for generators.
 *
 * THE CONTRACT (two orthogonal axes, owned by different authorities):
 *   - Eval MODE = WHAT is taught. Pinned by pedagogy (the objective / curator /
 *     Pulse), never by ability. Modes are content, not a difficulty ladder —
 *     mode 2 is frequently a different skill, not "mode 1 but harder".
 *   - DIFFICULTY = HOW HARD, expressed WITHIN the pinned mode's own beta band.
 *     Computed by code from the student's theta — never an adjective, never
 *     chosen by an LLM.
 *
 * Pipeline: the snapshot endpoint returns theta per resolved objective →
 * flattenManifestToLayout stamps config.studentTheta → the generator (the only
 * place the mode is certain) calls computeDifficultyTuple with its resolved
 * mode definition, maps withinModeLevel through its own param spec, and
 * appends buildDifficultyPromptSection to the prompt.
 *
 * Pure IRT: targetBeta = theta − logit(P*)/a (2PL inverted at the productive-
 * struggle target P* = 0.70), clamped into the mode's band. No hand-tuned
 * multipliers anywhere.
 */

import type { EvalModeDefinition } from '../../types';

/** Productive-struggle target: generate items the student answers correctly ~70% of the time. */
const TARGET_P_CORRECT = 0.70;
const LOGIT_TARGET = Math.log(TARGET_P_CORRECT / (1 - TARGET_P_CORRECT)); // ≈ 0.847

/** Backend DEFAULT_DISCRIMINATION_PRIOR (discrimination_priors.py) — used when a mode doesn't declare one. */
const DEFAULT_DISCRIMINATION = 1.4;

/**
 * Half-width of a mode's within-mode difficulty band around its prior beta.
 * Matches the /add-eval-modes convention: "within-mode adjustments of
 * ±0.5–1.0 are allowed for number range, operation type, distractor quality".
 */
const MODE_BAND_HALF_WIDTH = 0.75;

export interface DifficultyTuple {
  /** The pinned eval mode key (null when generating mixed modes). */
  evalMode: string | null;
  /** Student ability estimate (0–10 IRT scale), as provided by the snapshot. */
  studentTheta: number;
  /** Unclamped target item difficulty: theta − logit(0.70)/a. */
  targetBeta: number;
  /** targetBeta clamped into the mode's band [beta−0.75, beta+0.75]. */
  clampedBeta: number;
  /**
   * Position of clampedBeta within the mode band: 0 = easiest parameterization
   * of this mode, 1 = hardest. This is what param specs consume.
   */
  withinModeLevel: number;
  /**
   * Non-null when the student's target fell outside the mode's band.
   * 'high' = student likely above this mode (lesson still teaches it, at max).
   * 'low'  = mode likely above student (teach at the mode's gentlest setting).
   * A signal for observability/mastery, not an error.
   */
  saturated: 'low' | 'high' | null;
}

/**
 * Compute the difficulty tuple for a pinned eval mode.
 * Returns null when no student theta is available — generators then behave
 * exactly as they do today (grade-band defaults). Fail-soft by construction.
 */
export function computeDifficultyTuple(
  studentTheta: number | null | undefined,
  mode: Pick<EvalModeDefinition, 'evalMode' | 'beta' | 'discrimination'> | null,
): DifficultyTuple | null {
  if (studentTheta == null || !Number.isFinite(studentTheta)) return null;

  const a = mode?.discrimination ?? DEFAULT_DISCRIMINATION;
  const targetBeta = studentTheta - LOGIT_TARGET / a;

  if (!mode) {
    // Mixed-mode generation: no band to position within. Expose the raw
    // target so generators can still bias their range selection coarsely.
    return {
      evalMode: null,
      studentTheta,
      targetBeta,
      clampedBeta: targetBeta,
      withinModeLevel: 0.5,
      saturated: null,
    };
  }

  const lo = mode.beta - MODE_BAND_HALF_WIDTH;
  const hi = mode.beta + MODE_BAND_HALF_WIDTH;
  const clampedBeta = Math.min(hi, Math.max(lo, targetBeta));
  const withinModeLevel = (clampedBeta - lo) / (hi - lo);
  const saturated = targetBeta < lo ? 'low' : targetBeta > hi ? 'high' : null;

  return {
    evalMode: mode.evalMode,
    studentTheta,
    targetBeta,
    clampedBeta,
    withinModeLevel,
    saturated,
  };
}

/**
 * A generator's within-mode difficulty spec: maps the 0–1 within-mode level to
 * concrete, binding parameter constraints (prompt lines). Banded step functions
 * are expected — most parameters (counts, group sizes, frame modes) are discrete.
 * The optional scopeCeiling caps numeric bands so a difficulty band NEVER
 * conflicts with the pedagogical scope in the prompt (scope is the ceiling;
 * prompt-level "scope wins" instructions are not reliable under conflict —
 * the LLM splits the difference. Verified 2026-06-11).
 * Keyed by eval mode; exported from each generator so /eval-test can sweep it.
 */
export type DifficultyParamSpec = Record<
  string,
  (level: number, scopeCeiling?: number | null) => string[]
>;

/** Standard 3-band split helper for specs (low / mid / high). */
export function band<T>(level: number, low: T, mid: T, high: T): T {
  return level < 1 / 3 ? low : level < 2 / 3 ? mid : high;
}

/**
 * NOTE on scope-window discovery: pool-service generators (the preferred
 * architecture — see gemini-ten-frame.ts / gemini-place-value.ts) read the
 * window via a `windowMax` field in their OWN wrapper schema — the LLM call
 * they already make does the language understanding ("counting to five" → 5),
 * and code intersects window ∩ mode range ∩ difficulty band. Do NOT regex-parse
 * scope language (brittle: word numbers, phrasing) and do NOT add fields to
 * the manifest schema (cognitive-load budget).
 */

/**
 * Cap a numeric [lo, hi] band at the scope ceiling. When the ceiling sits
 * below the band, the band collapses to [ceiling, ceiling] — the hardest
 * parameterization the scope allows.
 */
export function capBand(b: [number, number], ceiling: number | null | undefined): [number, number] {
  if (ceiling == null) return b;
  const hi = Math.min(b[1], ceiling);
  const lo = Math.min(b[0], hi);
  return [lo, hi];
}

/**
 * Build the difficulty section for a generator prompt.
 * Returns '' when there is no tuple (no student data) — prompt unchanged.
 *
 * The numbers are presented for transparency; the binding instructions are the
 * concrete param lines from the generator's spec. Difficulty NEVER overrides
 * the pedagogical scope (scope is the ceiling; difficulty selects within it).
 */
export function buildDifficultyPromptSection(
  tuple: DifficultyTuple | null,
  paramLines: string[],
): string {
  if (!tuple) return '';

  const levelLabel =
    tuple.withinModeLevel < 1 / 3 ? 'LOW' : tuple.withinModeLevel < 2 / 3 ? 'MID' : 'HIGH';

  const saturationNote =
    tuple.saturated === 'high'
      ? '\n- NOTE: this student is likely ABOVE this mode — generate at the very top of its range.'
      : tuple.saturated === 'low'
        ? '\n- NOTE: this mode is likely ABOVE this student — generate at its gentlest setting.'
        : '';

  const params =
    paramLines.length > 0
      ? `\nBINDING PARAMETERS for this difficulty level:\n${paramLines.map((l) => `- ${l}`).join('\n')}`
      : '';

  return `
## STUDENT DIFFICULTY CALIBRATION (computed by the IRT system — not optional)
- Student ability θ = ${tuple.studentTheta.toFixed(1)} → target item difficulty β = ${tuple.targetBeta.toFixed(2)}${tuple.evalMode ? ` → within-mode level ${tuple.withinModeLevel.toFixed(2)} (${levelLabel})` : ''}${saturationNote}${params}
- These difficulty parameters select WITHIN the pedagogical scope above. The scope is the ceiling — if scope and difficulty conflict, SCOPE WINS.
- Never mention ability, difficulty levels, or calibration in any student-facing text.`;
}

/**
 * Log the computed tuple for observability (mirrors logEvalModeResolution).
 */
export function logDifficultyResolution(label: string, tuple: DifficultyTuple | null): void {
  if (!tuple) {
    console.log(`[${label}] No studentTheta — grade-band default difficulty`);
    return;
  }
  console.log(
    `[${label}] θ=${tuple.studentTheta.toFixed(2)} → targetβ=${tuple.targetBeta.toFixed(2)}` +
      (tuple.evalMode
        ? ` → mode "${tuple.evalMode}" level=${tuple.withinModeLevel.toFixed(2)}${tuple.saturated ? ` (saturated ${tuple.saturated})` : ''}`
        : ' (mixed modes)'),
  );
}
