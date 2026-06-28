import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import type {
  AngleWorkshopData,
  AngleWorkshopChallenge,
  AngleWorkshopChallengeType,
  AnglePairRelationship,
  SolveConfig,
  TransversalShape,
  TransversalRelation,
} from "../../primitives/visual-primitives/math/AngleWorkshop";

// ---------------------------------------------------------------------------
// Challenge type docs (one per eval mode) — feeds the constrained prompt
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  measure: {
    promptDoc:
      `"measure": Grade 7 entry. The student places a virtual protractor on a drawn angle and reads its measure in degrees. `
      + `Integer angle (multiple of 5). The measure is NEVER printed — reading it is the skill.`,
    schemaDescription: "'measure' (read an angle with a protractor)",
  },
  classify_pairs: {
    promptDoc:
      `"classify_pairs": Grade 7. The student sees two angles in a configuration and names the relationship: `
      + `complementary (add to 90°), supplementary (add to 180°), vertical (opposite, equal), or adjacent (share a side).`,
    schemaDescription: "'classify_pairs' (identify the angle-pair relationship)",
  },
  solve_unknown: {
    promptDoc:
      `"solve_unknown": Grade 7. One angle is labeled; the student uses a relationship `
      + `(complementary / supplementary / vertical / angles around a point) to find the unknown angle in degrees.`,
    schemaDescription: "'solve_unknown' (find a missing angle from a relationship)",
  },
  solve_algebraic: {
    promptDoc:
      `"solve_algebraic": Grade 7-8. The angles are labeled with linear expressions like (2x+10)°. The student sets up `
      + `an equation from the relationship and solves for x. Integer solutions only.`,
    schemaDescription: "'solve_algebraic' (set up and solve an equation for x)",
  },
  transversal: {
    promptDoc:
      `"transversal": Grade 8. Parallel lines cut by a transversal (corresponding / alternate / co-interior angles), `
      + `or triangle angle-sum and exterior-angle problems. The student finds the unknown angle in degrees.`,
    schemaDescription: "'transversal' (parallel-line transversal & triangle angle problems)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding level, NOT numbers
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ---------------------------------------------------------------------------
// Structural PROBLEM difficulty (axis 2) — config.difficulty also makes the
// PROBLEM itself genuinely harder per tier, STRUCTURALLY, never by inflating
// magnitude beyond the existing degree/x bands and never by crossing into
// another eval mode (the eval mode is the task identity; see memory
// [[structural-difficulty-not-numeric]]). Distinct from the scaffolding axis
// (resolveSupportStructure) which only withdraws on-screen help.
//
// Each mode exposes ONE in-mode structural lever, all CODE-ENFORCED because
// angle-workshop builds every challenge config locally with back-solved
// answers (recomputeExpected auto-corrects):
//   measure          → scale-reading ambiguity (which protractor scale the 2nd
//                      ray lands on): acute-off-rising-scale → obtuse inner/outer
//                      discrimination → near-90 / near-boundary confusable read.
//   classify_pairs   → distractor distance: how close the `adjacent` pair's outer
//                      total sits to 90/180 (obvious → tempting → ~5-10 off but
//                      still UNIQUELY adjacent). Other relations stay canonical.
//   solve_unknown    → step depth: 0-1 operation (vertical / single subtraction)
//                      → 2 operations (around_point, x = 360 − k1 − k2).
//   solve_algebraic  → equation structure: unit-coefficient collect (a1=a2=1)
//                      → mixed-coefficient collect (a1,a2 ∈ 1-3) → variable on
//                      BOTH sides of an equality (vertical, a1 ≠ a2).
//   transversal      → reasoning chain: direct-equality parallel relation (1 step)
//                      → one-operation (co-interior / triangle sum) → exterior-angle
//                      (sum of the two remote interiors).
// The lever re-selects the config/shape/coefficients (or the enforced numeric
// range for measure/classify); the back-solved answer recomputes — the magnitude
// stays inside the existing bands. Clamped to [floor, cap] INSIDE the resolver.
// ---------------------------------------------------------------------------

const TIER_GUARDRAIL =
  'This tier changes problem STRUCTURE (which relationship/shape, equation structure, '
  + 'step depth, distractor distance) and on-screen help — NOT the size of the angles or x. '
  + 'Angles stay in their existing degree bands and x stays small; never just "make the numbers bigger".';

interface ProblemShape {
  promptLines: string[];
  /** measure: enforced angle band [min,max] (multiples of 5) for the reading lever. */
  measureBand?: { min: number; max: number; nearBoundary?: boolean };
  /** classify_pairs: enforced outer-total band for the `adjacent` distractor lever. */
  adjacentBand?: { min: number; max: number };
  /** solve_unknown: which solveConfigs this tier may draw (step-depth lever). */
  solveConfigs?: SolveConfig[];
  /** solve_algebraic: equation-structure lever. */
  algStructure?: 'unit_collect' | 'mixed_collect' | 'both_sides';
  /** transversal: which shapes/relations this tier may draw (chain-length lever). */
  transShapes?: TransversalShape[];
  transRelations?: TransversalRelation[];
}

function resolveProblemShape(
  mode: AngleWorkshopChallengeType,
  tier: SupportTier,
): ProblemShape {
  switch (mode) {
    case 'measure':
      // Lever = which protractor scale the 2nd ray lands on (reading ambiguity).
      // Framed as scale-discrimination, NOT "bigger degrees". Floor: still a
      // single drawn angle read in degrees (mult of 5). Cap: 15-165, no reflex.
      if (tier === 'easy') {
        return {
          measureBand: { min: 15, max: 60 }, // acute, reads off the rising scale
          promptLines: ['PROBLEM (measure): an acute angle that reads unambiguously off the rising (inner) protractor scale — no inner-vs-outer confusion.'],
        };
      }
      if (tier === 'medium') {
        return {
          measureBand: { min: 95, max: 150 }, // obtuse → inner-vs-outer discrimination
          promptLines: ['PROBLEM (measure): an obtuse angle, so the student must discriminate the inner vs. outer protractor scale rather than read the first number it touches.'],
        };
      }
      // hard — near 90 / near a scale boundary where the two scales are easiest to confuse.
      return {
        measureBand: { min: 80, max: 100, nearBoundary: true },
        promptLines: ['PROBLEM (measure): an angle very near 90°, the protractor crossover where the two scales are easiest to confuse — the read must be made carefully.'],
      };

    case 'classify_pairs':
      // Lever = distractor distance for the `adjacent` pair: how close its outer
      // total sits to 90/180. The other three relations stay canonical (their
      // identity is the answer). Cap: outer total must stay UNIQUELY ≠ 90 and
      // ≠ 180 within the 0.5 tolerance, so the adjacent label is unambiguous.
      if (tier === 'easy') {
        return {
          adjacentBand: { min: 120, max: 150 }, // clearly neither 90 nor 180
          promptLines: ['PROBLEM (classify): the adjacent pair\'s outer total is clearly off any special total — obviously not complementary or supplementary.'],
        };
      }
      if (tier === 'medium') {
        return {
          adjacentBand: { min: 100, max: 170 }, // tempting near a special total
          promptLines: ['PROBLEM (classify): the adjacent pair\'s outer total sits near a special total (around 100 or 170) — tempting, but still clearly not 90 or 180.'],
        };
      }
      // hard — within ~5-10 of 90 or 180 (but never exactly, so still uniquely adjacent).
      return {
        adjacentBand: { min: 80, max: 175 }, // refined per-build to ±5-10 of 90/180
        promptLines: ['PROBLEM (classify): the adjacent pair\'s outer total is within ~5-10° of 90° or 180°, so it visually mimics complementary/supplementary — yet the true relationship is still uniquely adjacent.'],
      };

    case 'solve_unknown':
      // Lever = step depth. Floor: still finding a missing angle in degrees from a
      // relationship (NOT an x-equation → that is solve_algebraic). Cap: operands
      // stay in the existing 10-160 bands; depth rises, magnitude does not.
      if (tier === 'easy') {
        return {
          solveConfigs: ['vertical', 'complementary', 'supplementary'], // 0-1 operation
          promptLines: ['PROBLEM (solve): a single-step relationship — vertical (x equals the known) or one subtraction (complementary / supplementary).'],
        };
      }
      // medium & hard — two-operation depth (around_point: x = 360 − k1 − k2).
      // True chained two-step (intermediate angle fed into a second relationship)
      // has no distinct renderable figure in the current component, so the depth
      // lever SATURATES at around_point's two subtractions. (See concerns.)
      return {
        solveConfigs: ['around_point'],
        promptLines: [tier === 'hard'
          ? 'PROBLEM (solve): an angles-around-a-point figure — two knowns, so reaching x takes two subtractions (x = 360 − k1 − k2), the deepest the current figure supports.'
          : 'PROBLEM (solve): an angles-around-a-point figure with two knowns — two subtractions to reach x (x = 360 − k1 − k2).'],
      };

    case 'solve_algebraic':
      // Lever = equation structure depth. Floor: still a linear equation in x with
      // an integer solution from complementary/supplementary/vertical. Cap: x stays
      // 4-12, angles 20-160, coefficients 1-3 — raise STRUCTURE, not size.
      if (tier === 'easy') {
        return {
          algStructure: 'unit_collect', // both coefficients 1: 2x + (b1+b2) = T, one collect+isolate
          promptLines: ['PROBLEM (algebraic): both labeled expressions use a UNIT coefficient on x, so the student collects to 2x + constant = total and isolates in one move.'],
        };
      }
      if (tier === 'medium') {
        return {
          algStructure: 'mixed_collect', // a1,a2 ∈ 1-3, summing to a target: collect like terms then isolate
          promptLines: ['PROBLEM (algebraic): the two expressions carry DIFFERENT coefficients on x and sum to the total — the student must collect like terms before isolating.'],
        };
      }
      // hard — variable on BOTH sides of an equality (vertical, a1 ≠ a2).
      return {
        algStructure: 'both_sides',
        promptLines: ['PROBLEM (algebraic): the variable appears on BOTH sides of an equality (vertical angles, two different coefficients) — the student moves the x-terms across before isolating.'],
      };

    case 'transversal':
      // Lever = reasoning chain length. Floor: still a parallel-transversal or
      // triangle angle problem to a degree answer. Cap: given angles stay 30-140;
      // lengthen the chain, not the numbers.
      if (tier === 'easy') {
        return {
          transShapes: ['parallel_transversal'],
          transRelations: ['corresponding', 'alternate_interior', 'alternate_exterior'], // direct equality, x = given
          promptLines: ['PROBLEM (transversal): a direct-equality parallel relation (corresponding / alternate) — x equals the marked angle in one step.'],
        };
      }
      if (tier === 'medium') {
        return {
          transShapes: ['parallel_transversal', 'triangle_sum'],
          transRelations: ['co_interior'], // one operation: x = 180 − given (parallel) or 180 − g1 − g2 (triangle)
          promptLines: ['PROBLEM (transversal): a one-operation relation — co-interior (x = 180 − given) or triangle angle-sum (x = 180 − g1 − g2).'],
        };
      }
      // hard — exterior_angle: x = sum of the two remote interior angles (two-part).
      return {
        transShapes: ['exterior_angle'],
        promptLines: ['PROBLEM (transversal): an exterior-angle figure — x equals the SUM of the two remote interior angles, so the student must identify the remote-interior pair, not just copy a marked angle.'],
      };

    default:
      return { promptLines: [] };
  }
}

/** Format the full structural-difficulty prompt block for a pinned single mode. */
function buildStructuralPromptSection(
  mode: AngleWorkshopChallengeType,
  tier: SupportTier,
): string {
  const lines = [TIER_GUARDRAIL, ...resolveProblemShape(mode, tier).promptLines];
  return `\n## STRUCTURAL PROBLEM DIFFICULTY ("${tier}" — harder SHAPE, NOT bigger numbers)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Per-mode instance counts
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<AngleWorkshopChallengeType, number> = {
  measure: 4,
  classify_pairs: 4,
  solve_unknown: 4,
  solve_algebraic: 4,
  transversal: 5,
};

// ---------------------------------------------------------------------------
// Helpers (deterministic local pool — per-challenge values built in code)
// ---------------------------------------------------------------------------

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

/** Round to the nearest multiple of 5 (protractor-friendly measures). */
const r5 = (n: number): number => Math.round(n / 5) * 5;

const MEASURE_CTX = [
  'A skateboard ramp', 'The hands of a clock', 'An open laptop', 'A pair of scissors',
  'A slice of pie', 'A folding fan', 'A camera tripod leg', 'A drawbridge',
];
const PAIR_CTX = [
  'Two roads meeting at a corner', 'A pair of chopsticks crossing', 'Roof rafters',
  'A folded map', 'Two beams in a bridge', 'Street markings at an intersection',
];
const SOLVE_CTX = [
  'A signpost', 'A kite frame', 'A tile pattern', 'A window frame', 'A garden trellis',
  'A bracket on a shelf',
];
const TRANSVERSAL_CTX = [
  'Train tracks crossed by a road', 'Notebook lines crossed by a diagonal',
  'A ladder leaning across two shelves', 'Parallel fence rails cut by a brace',
];
const TRIANGLE_CTX = [
  'A triangular sail', 'A yield sign', 'A slice of triangular pizza', 'A roof truss',
];

type RawChallenge = Omit<AngleWorkshopChallenge, 'id'>;

// ---------------------------------------------------------------------------
// measure
// ---------------------------------------------------------------------------

function buildMeasure(shape?: ProblemShape): RawChallenge {
  let angleMeasure: number;
  if (shape?.measureBand) {
    const { min, max, nearBoundary } = shape.measureBand;
    if (nearBoundary) {
      // Hard: cluster near the 90° protractor crossover where the inner/outer
      // scales are easiest to confuse. Multiples of 5 in the band, biased to the
      // closest-to-90 values; never exactly 90 (an unambiguous square read).
      const candidates = [80, 85, 95, 100].filter((v) => v >= min && v <= max);
      angleMeasure = candidates.length ? pick(candidates) : 85;
    } else {
      const lo = Math.ceil(min / 5), hi = Math.floor(max / 5);
      angleMeasure = randInt(lo, hi) * 5;
    }
    // Cap: stay 15-165 (no reflex, on-protractor).
    angleMeasure = Math.max(15, Math.min(165, angleMeasure));
  } else {
    angleMeasure = randInt(3, 33) * 5; // 15..165, multiples of 5 (no-tier default)
  }
  return {
    type: 'measure',
    narration: `${pick(MEASURE_CTX)} opens to this angle.`,
    instruction: 'Place the protractor on the angle and read its measure.',
    hint: 'Line up the protractor’s center on the vertex and its baseline on one ray. Read where the other ray crosses the scale.',
    answerKind: 'degrees',
    angleMeasure,
    expectedAnswer: angleMeasure,
    tolerance: 2,
  };
}

// ---------------------------------------------------------------------------
// classify_pairs
// ---------------------------------------------------------------------------

function buildClassify(rel: AnglePairRelationship, shape?: ProblemShape): RawChallenge {
  const base = {
    type: 'classify_pairs' as const,
    narration: `${pick(PAIR_CTX)} form this pair of angles.`,
    instruction: 'Look at how the two angles meet. What is their relationship?',
    hint: 'Do the outer rays make a straight line (180°), a right angle (90°), or do two lines cross? Equal opposite angles are vertical.',
    answerKind: 'relationship' as const,
    relationship: rel,
    expectedRelationship: rel,
    expectedAnswer: 0,
    tolerance: 0.5,
  };
  if (rel === 'complementary') {
    return { ...base, splitAngle: randInt(2, 16) * 5 }; // 10..80 within a 90° corner
  }
  if (rel === 'supplementary') {
    return { ...base, splitAngle: r5(randInt(30, 150)) }; // 30..150 within a straight line
  }
  if (rel === 'vertical') {
    return { ...base, crossAngle: r5(randInt(25, 80)) };
  }
  // adjacent — the structural lever lives here: how close the outer total sits
  // to a special total (90/180). Default: deliberately not 90 or 180.
  let outerAngle: number;
  if (shape?.adjacentBand) {
    // Hard band is wide (80-175); refine to values within ~5-10 of 90 or 180,
    // but NEVER exactly 90/180 so the pair stays uniquely adjacent under tol 0.5.
    const { min, max } = shape.adjacentBand;
    if (min <= 85 && max >= 170) {
      outerAngle = pick([80, 85, 95, 100, 170, 175]); // ±5-10 of 90 or 180, never on it
    } else {
      const lo = Math.ceil(min / 5), hi = Math.floor(max / 5);
      let v = randInt(lo, hi) * 5;
      if (v === 90) v = 95;
      if (v === 180) v = 175;
      outerAngle = v;
    }
  } else {
    outerAngle = r5(randInt(110, 165));
  }
  // Cap: keep the figure renderable — outer 60-175, split leaves ≥ 20 on each side.
  outerAngle = Math.max(60, Math.min(175, outerAngle));
  const splitLo = 20;
  const splitHi = Math.max(splitLo + 5, outerAngle - 20);
  return { ...base, outerAngle, splitAngle: r5(randInt(splitLo, splitHi)) };
}

// ---------------------------------------------------------------------------
// solve_unknown
// ---------------------------------------------------------------------------

function buildSolveUnknown(cfg: SolveConfig): RawChallenge {
  const ctx = pick(SOLVE_CTX);
  if (cfg === 'complementary') {
    const knownAngle = randInt(2, 16) * 5; // 10..80
    return {
      type: 'solve_unknown', narration: `${ctx} has two angles that form a right angle.`,
      instruction: 'These two angles are complementary (they add to 90°). Find the unknown angle x.',
      hint: 'Complementary angles add to 90°, so x = 90° − the known angle.',
      answerKind: 'degrees', solveConfig: 'complementary', knownAngle,
      expectedAnswer: 90 - knownAngle, tolerance: 1,
    };
  }
  if (cfg === 'supplementary') {
    const knownAngle = r5(randInt(20, 160));
    return {
      type: 'solve_unknown', narration: `${ctx} has two angles that sit on a straight line.`,
      instruction: 'These two angles are supplementary (they add to 180°). Find the unknown angle x.',
      hint: 'Angles on a straight line add to 180°, so x = 180° − the known angle.',
      answerKind: 'degrees', solveConfig: 'supplementary', knownAngle,
      expectedAnswer: 180 - knownAngle, tolerance: 1,
    };
  }
  if (cfg === 'vertical') {
    const knownAngle = r5(randInt(25, 160));
    return {
      type: 'solve_unknown', narration: `${ctx} has two lines crossing.`,
      instruction: 'x and the labeled angle are vertical angles. Find x.',
      hint: 'Vertical angles (opposite each other where two lines cross) are equal, so x equals the known angle.',
      answerKind: 'degrees', solveConfig: 'vertical', knownAngle,
      expectedAnswer: knownAngle, tolerance: 1,
    };
  }
  // around_point — three angles meeting at a point sum to 360
  const knownAngle = r5(randInt(80, 150));
  const knownAngle2 = r5(randInt(80, 150));
  return {
    type: 'solve_unknown', narration: `${ctx} has three angles meeting at a point.`,
    instruction: 'The three angles go all the way around the point (360°). Find the unknown angle x.',
    hint: 'Angles around a point add to 360°, so x = 360° − the two known angles.',
    answerKind: 'degrees', solveConfig: 'around_point', knownAngle, knownAngle2,
    expectedAnswer: 360 - knownAngle - knownAngle2, tolerance: 1,
  };
}

// ---------------------------------------------------------------------------
// solve_algebraic — back-solve from an integer x so the figure is consistent
// ---------------------------------------------------------------------------

function buildAlgebraic(
  cfg: 'complementary' | 'supplementary' | 'vertical',
  shape?: ProblemShape,
): RawChallenge {
  const ctx = pick(SOLVE_CTX);
  // Structural lever: equation-structure depth. The tier may OVERRIDE cfg —
  // both_sides forces vertical (variable on both sides), unit/mixed_collect force
  // a summed relationship (complementary/supplementary). The chosen structure also
  // constrains the coefficients (unit = a1=a2=1; mixed = a1≠a2; both_sides = a1≠a2).
  const structure = shape?.algStructure;
  if (structure === 'both_sides' && cfg !== 'vertical') cfg = 'vertical';
  if ((structure === 'unit_collect' || structure === 'mixed_collect') && cfg === 'vertical') {
    cfg = 'supplementary';
  }
  const target = cfg === 'complementary' ? 90 : 180;

  for (let tries = 0; tries < 300; tries++) {
    const x = randInt(4, 12);
    const a1 = structure === 'unit_collect' ? 1 : randInt(1, 3);
    const b1 = randInt(0, 6) * 5; // 0..30
    const angle1 = a1 * x + b1;

    if (cfg === 'vertical') {
      // both_sides (or no-tier vertical): two DIFFERENT coefficients → variable on
      // both sides of the equality. a1 ≠ a2 is required for a unique x.
      let a2 = randInt(1, 3);
      if (a2 === a1) a2 = a1 === 3 ? 2 : a1 + 1;
      const b2 = angle1 - a2 * x; // makes angle2 === angle1 (vertical → equal)
      if (angle1 < 20 || angle1 > 160) continue;
      if (b2 < -40 || b2 > 60) continue;
      return {
        type: 'solve_algebraic',
        narration: `${ctx} has two crossing lines with angles labeled by expressions.`,
        instruction: 'These two angles are vertical angles, so they are equal. Set the expressions equal and solve for x.',
        hint: 'Vertical angles are equal: set the two expressions equal to each other, then solve for x.',
        answerKind: 'x_value', algConfig: 'vertical', a1, b1, a2, b2,
        expectedAnswer: x, tolerance: 0.01,
      };
    }

    if (angle1 <= 5 || angle1 >= target - 5) continue;
    const angle2 = target - angle1;
    // unit_collect: a2 = 1 too (both unit → collect to 2x + const). mixed_collect:
    // force a2 ≠ a1 so the two coefficients genuinely differ. Else: free 1-3.
    let a2: number;
    if (structure === 'unit_collect') {
      a2 = 1;
    } else if (structure === 'mixed_collect') {
      a2 = randInt(1, 3);
      if (a2 === a1) a2 = a1 === 3 ? 1 : a1 + 1;
    } else {
      a2 = randInt(1, 3);
    }
    const b2 = angle2 - a2 * x;
    // Cap the constant term so the label stays readable. Supplementary angles
    // (sum 180) routinely have a larger second angle than complementary (sum 90),
    // so scale the upper bound with the target — a flat 70 cap starved the
    // supplementary branch and forced it into the fallback every time. With
    // unit_collect (a2=1) on a supplementary sum the second constant runs higher
    // still (b2 = 180 − 2x − b1), so widen the cap there too — the value stays an
    // in-band angle constant, NOT inflated magnitude.
    const b2Max = structure === 'unit_collect'
      ? (cfg === 'supplementary' ? 175 : 90)
      : (cfg === 'supplementary' ? 150 : 70);
    if (b2 < -40 || b2 > b2Max) continue;
    return {
      type: 'solve_algebraic',
      narration: `${ctx} has angles labeled by expressions.`,
      instruction:
        cfg === 'complementary'
          ? 'These two angles are complementary (add to 90°). Write an equation and solve for x.'
          : 'These two angles are supplementary (add to 180°). Write an equation and solve for x.',
      hint:
        cfg === 'complementary'
          ? 'Add the two expressions, set the sum equal to 90, and solve for x.'
          : 'Add the two expressions, set the sum equal to 180, and solve for x.',
      answerKind: 'x_value', algConfig: cfg, a1, b1, a2, b2,
      expectedAnswer: x, tolerance: 0.01,
    };
  }

  // Fallback — guaranteed-valid simple case
  const x = 10;
  if (cfg === 'vertical') {
    return {
      type: 'solve_algebraic', narration: `${ctx} has two crossing lines.`,
      instruction: 'These two angles are vertical angles, so they are equal. Set the expressions equal and solve for x.',
      hint: 'Vertical angles are equal: set the two expressions equal, then solve for x.',
      answerKind: 'x_value', algConfig: 'vertical', a1: 2, b1: 10, a2: 1, b2: 20,
      expectedAnswer: x, tolerance: 0.01,
    };
  }
  // Honor the structural lever even on the (rare) fallback: unit_collect forces
  // a1=a2=1; every other path keeps the original 2/1 (mixed_collect already differs,
  // and the no-tier path is byte-identical: a1=2, a2=1).
  const a1 = structure === 'unit_collect' ? 1 : 2;
  const a2 = 1;
  const b1 = 10, angle1 = a1 * x + b1, angle2 = target - angle1, b2 = angle2 - a2 * x;
  return {
    type: 'solve_algebraic', narration: `${ctx} has angles labeled by expressions.`,
    instruction:
      cfg === 'complementary'
        ? 'These two angles are complementary (add to 90°). Write an equation and solve for x.'
        : 'These two angles are supplementary (add to 180°). Write an equation and solve for x.',
    hint: 'Add the two expressions, set the sum equal to the total, and solve for x.',
    answerKind: 'x_value', algConfig: cfg, a1, b1, a2, b2,
    expectedAnswer: x, tolerance: 0.01,
  };
}

// ---------------------------------------------------------------------------
// transversal / triangle
// ---------------------------------------------------------------------------

const TRANS_RELATIONS: TransversalRelation[] = [
  'corresponding', 'alternate_interior', 'alternate_exterior', 'co_interior',
];

const RELATION_LABEL: Record<TransversalRelation, string> = {
  corresponding: 'corresponding angles',
  alternate_interior: 'alternate interior angles',
  alternate_exterior: 'alternate exterior angles',
  co_interior: 'co-interior (same-side interior) angles',
};

function buildTransversal(shape: TransversalShape, relation?: TransversalRelation): RawChallenge {
  if (shape === 'parallel_transversal') {
    const rel = relation ?? pick(TRANS_RELATIONS);
    const givenAngle = r5(randInt(40, 140));
    const isSupp = rel === 'co_interior';
    return {
      type: 'transversal',
      narration: `${pick(TRANSVERSAL_CTX)} — two parallel lines cut by a transversal.`,
      instruction: `The marked angle and x are ${RELATION_LABEL[rel]}. Find x.`,
      hint: isSupp
        ? 'Co-interior (same-side interior) angles are supplementary — they add to 180°. So x = 180° − the marked angle.'
        : `${RELATION_LABEL[rel].replace(/s$/, '')} pairs are equal when the lines are parallel, so x equals the marked angle.`,
      answerKind: 'degrees', transversalShape: 'parallel_transversal',
      givenAngle, transRelation: rel,
      expectedAnswer: isSupp ? 180 - givenAngle : givenAngle, tolerance: 1,
    };
  }
  if (shape === 'triangle_sum') {
    let g1 = r5(randInt(35, 90));
    let g2 = r5(randInt(35, 90));
    while (g1 + g2 > 150) { g1 = r5(randInt(35, 80)); g2 = r5(randInt(35, 80)); }
    return {
      type: 'transversal',
      narration: `${pick(TRIANGLE_CTX)} forms a triangle.`,
      instruction: 'The three angles of a triangle add to 180°. Two are given — find the third, x.',
      hint: 'The angles of any triangle add to 180°, so x = 180° − the two known angles.',
      answerKind: 'degrees', transversalShape: 'triangle_sum',
      givenAngle: g1, givenAngle2: g2,
      expectedAnswer: 180 - g1 - g2, tolerance: 1,
    };
  }
  // exterior_angle — exterior = sum of the two remote interior angles
  let g1 = r5(randInt(30, 80));
  let g2 = r5(randInt(30, 80));
  while (g1 + g2 > 150) { g1 = r5(randInt(30, 70)); g2 = r5(randInt(30, 70)); }
  return {
    type: 'transversal',
    narration: `${pick(TRIANGLE_CTX)} has one side extended past a corner.`,
    instruction: 'The exterior angle x equals the sum of the two remote interior angles. Find x.',
    hint: 'An exterior angle of a triangle equals the sum of the two non-adjacent (remote) interior angles.',
    answerKind: 'degrees', transversalShape: 'exterior_angle',
    givenAngle: g1, givenAngle2: g2,
    expectedAnswer: g1 + g2, tolerance: 1,
  };
}

// ---------------------------------------------------------------------------
// Canonical key for de-duplication within a session
// ---------------------------------------------------------------------------

function canonicalKey(ch: RawChallenge): string {
  switch (ch.type) {
    case 'measure':
      return `m|${ch.angleMeasure}`;
    case 'classify_pairs':
      return `c|${ch.relationship}|${ch.splitAngle ?? ''}|${ch.outerAngle ?? ''}|${ch.crossAngle ?? ''}`;
    case 'solve_unknown':
      return `su|${ch.solveConfig}|${ch.knownAngle}|${ch.knownAngle2 ?? ''}`;
    case 'solve_algebraic':
      return `sa|${ch.algConfig}|${ch.a1}x${ch.b1}|${ch.a2}x${ch.b2}`;
    case 'transversal':
      return `t|${ch.transversalShape}|${ch.givenAngle}|${ch.givenAngle2 ?? ''}|${ch.transRelation ?? ''}`;
  }
}

// ---------------------------------------------------------------------------
// Recompute the expected answer from the figure (self-check guard vs drift)
// ---------------------------------------------------------------------------

function recomputeExpected(ch: AngleWorkshopChallenge): number | null {
  switch (ch.type) {
    case 'measure':
      return ch.angleMeasure ?? null;
    case 'classify_pairs':
      return null; // relationship answer — nothing numeric to recompute
    case 'solve_unknown': {
      const k = ch.knownAngle ?? 0;
      switch (ch.solveConfig) {
        case 'complementary': return 90 - k;
        case 'supplementary': return 180 - k;
        case 'vertical': return k;
        case 'around_point': return 360 - k - (ch.knownAngle2 ?? 0);
        default: return null;
      }
    }
    case 'solve_algebraic': {
      const a1 = ch.a1 ?? 0, b1 = ch.b1 ?? 0, a2 = ch.a2 ?? 0, b2 = ch.b2 ?? 0;
      if (ch.algConfig === 'vertical') {
        if (a1 === a2) return null;
        return (b2 - b1) / (a1 - a2);
      }
      const target = ch.algConfig === 'complementary' ? 90 : 180;
      if (a1 + a2 === 0) return null;
      return (target - b1 - b2) / (a1 + a2);
    }
    case 'transversal': {
      const g1 = ch.givenAngle ?? 0, g2 = ch.givenAngle2 ?? 0;
      switch (ch.transversalShape) {
        case 'parallel_transversal':
          return ch.transRelation === 'co_interior' ? 180 - g1 : g1;
        case 'triangle_sum': return 180 - g1 - g2;
        case 'exterior_angle': return g1 + g2;
        default: return null;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Build N distinct challenges for a single-mode session, with variance rules
// ---------------------------------------------------------------------------

export function selectAngleWorkshopChallenges(
  challengeType: AngleWorkshopChallengeType,
  count?: number,
  /**
   * Structural-difficulty tier (axis 2). Present ONLY for single-mode pinned
   * sessions — when set, the config/shape rotation and enforced numeric bands are
   * constrained to resolveProblemShape(challengeType, tier). Absent → the original
   * byte-identical rotation (every structural branch below is gated on `tier`).
   */
  tier?: SupportTier | null,
): AngleWorkshopChallenge[] {
  const target = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, count ?? COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT),
  );

  // Axis-2 structural intent for the pinned mode (null on the no-tier path).
  const shape: ProblemShape | null = tier ? resolveProblemShape(challengeType, tier) : null;

  const raw: RawChallenge[] = [];
  const seen = new Set<string>();
  const tryPush = (ch: RawChallenge): boolean => {
    const key = canonicalKey(ch);
    if (seen.has(key)) return false;
    seen.add(key);
    raw.push(ch);
    return true;
  };

  // Variance rule: rotate through structural variants, guaranteeing ≥1 of each
  // category before back-filling (mirrors factor-tree / circle-explorer).
  if (challengeType === 'measure') {
    for (let a = 0; a < target * 12 && raw.length < target; a++) tryPush(buildMeasure(shape ?? undefined));
  } else if (challengeType === 'classify_pairs') {
    // The four relationships ARE the task identity — keep them all. The tier only
    // tightens the `adjacent` distractor distance (shape.adjacentBand), which the
    // builder reads; the other three relations are untouched.
    const rels: AnglePairRelationship[] = ['complementary', 'supplementary', 'vertical', 'adjacent'];
    let i = 0;
    for (let a = 0; a < target * 16 && raw.length < target; a++) {
      const rel = i < rels.length ? rels[i] : pick(rels);
      i++;
      tryPush(buildClassify(rel, shape ?? undefined));
    }
  } else if (challengeType === 'solve_unknown') {
    // Step-depth lever: a tier constrains which solveConfigs may be drawn.
    const cfgs: SolveConfig[] = shape?.solveConfigs ?? ['complementary', 'supplementary', 'vertical', 'around_point'];
    let i = 0;
    for (let a = 0; a < target * 16 && raw.length < target; a++) {
      const cfg = i < cfgs.length ? cfgs[i] : pick(cfgs);
      i++;
      tryPush(buildSolveUnknown(cfg));
    }
  } else if (challengeType === 'solve_algebraic') {
    // Equation-structure lever: shape.algStructure pins the structure inside the
    // builder; cfg rotation just supplies relationship variety where the structure
    // allows it (unit/mixed → summed; both_sides → vertical).
    const cfgs: Array<'complementary' | 'supplementary' | 'vertical'> =
      shape?.algStructure === 'both_sides'
        ? ['vertical']
        : shape?.algStructure
          ? ['supplementary', 'complementary'] // summed relationships only
          : ['supplementary', 'complementary', 'vertical'];
    let i = 0;
    for (let a = 0; a < target * 18 && raw.length < target; a++) {
      const cfg = i < cfgs.length ? cfgs[i] : pick(cfgs);
      i++;
      tryPush(buildAlgebraic(cfg, shape ?? undefined));
    }
  } else {
    // transversal — chain-length lever: a tier constrains shapes/relations.
    const shapes: TransversalShape[] = shape?.transShapes ?? ['parallel_transversal', 'triangle_sum', 'exterior_angle'];
    const rels: TransversalRelation[] = shape?.transRelations ?? TRANS_RELATIONS;
    let i = 0;
    let relIdx = 0;
    for (let a = 0; a < target * 18 && raw.length < target; a++) {
      const sh = i < shapes.length ? shapes[i] : pick(shapes);
      i++;
      const rel = sh === 'parallel_transversal' ? rels[relIdx++ % rels.length] : undefined;
      tryPush(buildTransversal(sh, rel));
    }
  }

  // Fallback — accept duplicates if the candidate space was too narrow. Honors the
  // tier's constrained config/shape sets so a small (saturated) band never leaks an
  // off-tier (easier/harder) problem in to pad the count.
  while (raw.length < target) {
    switch (challengeType) {
      case 'measure': raw.push(buildMeasure(shape ?? undefined)); break;
      case 'classify_pairs': raw.push(buildClassify(pick(['complementary', 'supplementary', 'vertical', 'adjacent']), shape ?? undefined)); break;
      case 'solve_unknown': raw.push(buildSolveUnknown(pick(shape?.solveConfigs ?? ['complementary', 'supplementary', 'vertical', 'around_point']))); break;
      case 'solve_algebraic': raw.push(buildAlgebraic(
        pick(shape?.algStructure === 'both_sides' ? ['vertical'] : shape?.algStructure ? ['supplementary', 'complementary'] : ['supplementary', 'complementary', 'vertical']),
        shape ?? undefined,
      )); break;
      default: {
        const fbShapes = shape?.transShapes ?? ['parallel_transversal', 'triangle_sum', 'exterior_angle'];
        const fbShape = pick(fbShapes);
        const fbRel = fbShape === 'parallel_transversal' ? pick(shape?.transRelations ?? TRANS_RELATIONS) : undefined;
        raw.push(buildTransversal(fbShape, fbRel));
        break;
      }
    }
  }

  // Order easier → harder by a per-mode difficulty proxy.
  const difficulty = (ch: RawChallenge): number => {
    switch (ch.type) {
      case 'measure': return ch.angleMeasure ?? 0;
      case 'classify_pairs': return ['complementary', 'supplementary', 'vertical', 'adjacent'].indexOf(ch.relationship ?? 'adjacent');
      case 'solve_unknown': return ['vertical', 'complementary', 'supplementary', 'around_point'].indexOf(ch.solveConfig ?? 'vertical');
      case 'solve_algebraic': return (ch.a1 ?? 1) + (ch.a2 ?? 1);
      case 'transversal': return ['triangle_sum', 'parallel_transversal', 'exterior_angle'].indexOf(ch.transversalShape ?? 'triangle_sum');
    }
  };
  const sorted = raw.sort((a, b) => difficulty(a) - difficulty(b));
  return sorted.map((ch, i) => ({ ...ch, id: `aw-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const angleWorkshopSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-problem angle session (e.g., 'Solving for Unknown Angles'). Do NOT name specific angle measures or values — the session walks through several figures.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: ['measure', 'classify_pairs', 'solve_unknown', 'solve_algebraic', 'transversal'],
      description: "Difficulty tier of the session. The system uses this to build the angle problem pool.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['7', '8'],
      description: "Target grade band (7 for measure/classify/solve, 8 for transversal-heavy work).",
    },
  },
  required: ['title', 'description', 'challengeType'],
};

// ---------------------------------------------------------------------------
// Support-tier scaffold — which on-screen helps are withdrawn (per pinned mode).
// INVARIANT: a tier only removes scaffolding; it never touches an angle measure,
// a given value, or an expectedAnswer. The per-mode build tables own the numbers.
// ---------------------------------------------------------------------------

interface AngleSupportScaffold {
  /** measure: show the dot marking where the 2nd ray crosses the protractor scale. */
  showReadingCue?: boolean;
  /** classify_pairs: show the right-angle square / equal-angle marks that reveal the relationship. */
  showPerceptionMarks?: boolean;
  /** solving modes: name the governing relationship in the instruction. */
  nameRelationship?: boolean;
  /** solving modes: 'formula' = explicit rule in the hint; 'concept' = nudge only. */
  hintLevel?: 'formula' | 'concept';
  /** solve_algebraic: hand the student the pre-assembled equation (easy) vs. make them set it up. */
  showEquationSetup?: boolean;
  promptLines: string[];
}

function resolveSupportStructure(
  pinnedType: AngleWorkshopChallengeType,
  tier: SupportTier,
): AngleSupportScaffold {
  const lead =
    'This tier changes only how much on-screen help the student gets. It NEVER changes the '
    + 'angle measures, the given values, or the answer.';

  if (pinnedType === 'measure') {
    const showReadingCue = tier !== 'hard';
    return {
      showReadingCue,
      promptLines: [
        lead,
        `The protractor reading cue (a dot where the second ray crosses the scale) is ${showReadingCue ? 'shown to help locate the reading' : 'withdrawn — the student reads the scale unaided'}.`,
        'Keep the title and description neutral — never state the support level or name an angle measure.',
      ],
    };
  }

  if (pinnedType === 'classify_pairs') {
    const showPerceptionMarks = tier !== 'hard';
    return {
      showPerceptionMarks,
      promptLines: [
        lead,
        `Relationship perception marks (right-angle square, equal-angle labels) are ${showPerceptionMarks ? 'shown' : 'withdrawn — the student judges the bare rays'}.`,
        'Keep the title and description neutral — never state the support level or the relationship.',
      ],
    };
  }

  // solving modes: solve_unknown / solve_algebraic / transversal
  const nameRelationship = tier !== 'hard';
  const hintLevel: 'formula' | 'concept' = tier === 'easy' ? 'formula' : 'concept';
  const showEquationSetup = pinnedType === 'solve_algebraic' && tier === 'easy';
  return {
    nameRelationship,
    hintLevel,
    showEquationSetup,
    promptLines: [
      lead,
      `The governing relationship is ${nameRelationship ? 'named in the instruction' : 'NOT named — the student identifies it from the figure (right-angle corner, straight line, crossing lines, or parallel marks) before solving'}.`,
      ...(pinnedType === 'solve_algebraic'
        ? [`The equation is ${showEquationSetup ? 'pre-assembled in the instruction — the student only solves it for x' : 'NOT given — the student sets it up from the relationship before solving'}.`]
        : []),
      `The hint is ${hintLevel === 'formula' ? 'an explicit formula/rule' : 'a conceptual nudge only — no formula'}.`,
      'Keep the title and description neutral — never state the support level, the relationship, or the answer.',
    ],
  };
}

/** Format a linear expression a·x + b for an equation label, e.g. "(2x + 10)", "x", "(−x − 5)". */
function fmtAlgExpr(a: number, b: number): string {
  const xPart = a === 1 ? 'x' : a === -1 ? '−x' : `${a}x`;
  if (b === 0) return xPart;
  const sign = b > 0 ? '+' : '−';
  return `(${xPart} ${sign} ${Math.abs(b)})`;
}

/** The pre-assembled equation handed to the student at the easy tier (solve_algebraic). */
function equationSetup(ch: AngleWorkshopChallenge): string {
  const e1 = fmtAlgExpr(ch.a1 ?? 1, ch.b1 ?? 0);
  const e2 = fmtAlgExpr(ch.a2 ?? 1, ch.b2 ?? 0);
  if (ch.algConfig === 'vertical') return `${e1} = ${e2}`;
  const target = ch.algConfig === 'complementary' ? 90 : 180;
  return `${e1} + ${e2} = ${target}`;
}

/** Easy-tier instruction: relationship named AND equation handed over — student only solves. */
function easyAlgInstruction(ch: AngleWorkshopChallenge): string {
  const rel =
    ch.algConfig === 'vertical' ? 'vertical angles, so they are equal'
    : ch.algConfig === 'complementary' ? 'complementary (they add to 90°)'
    : 'supplementary (they add to 180°)';
  return `These two angles are ${rel}. Solve the equation ${equationSetup(ch)} for x.`;
}

/** Generic instruction used at the hard tier, where the relationship is NOT named.
 *  Withholds the rule's name only — the figure (drawn from the same numbers) still shows it. */
function genericInstruction(ch: AngleWorkshopChallenge): string {
  switch (ch.type) {
    case 'solve_unknown':
      return 'Use the relationship shown in the figure to find the unknown angle x.';
    case 'solve_algebraic':
      return 'Decide how the angles in the figure are related, write an equation, and solve for x.';
    case 'transversal':
      switch (ch.transversalShape) {
        case 'triangle_sum':   return 'Find the missing angle x in the triangle.';
        case 'exterior_angle': return 'Find the exterior angle x.';
        default:               return 'Identify how the marked angle and x are related on the parallel lines, then find x.';
      }
    default:
      return ch.instruction;
  }
}

/** Conceptual hint (no formula). `named` = the relationship is still named in the
 *  instruction (medium tier); otherwise the nudge points the student to read the figure first. */
function conceptHint(ch: AngleWorkshopChallenge, named: boolean): string {
  if (named) {
    switch (ch.type) {
      case 'solve_unknown':   return 'You know how the two angles are related — now do the arithmetic to find x.';
      case 'solve_algebraic': return 'Set up the equation from the relationship you are given, then solve for x.';
      case 'transversal':     return 'Use the rule stated above with the given angles to find x.';
      default:                return ch.hint;
    }
  }
  switch (ch.type) {
    case 'solve_unknown':
      return 'Read the figure first — a right-angle corner, a straight line, crossing lines, or rays around a point tells you the rule. Then find x.';
    case 'solve_algebraic':
      return 'Read the figure to decide whether the angles are equal, add to 90°, or add to 180°, then write the equation.';
    case 'transversal':
      return 'Look at the figure: parallel lines cut by a transversal, or a triangle? That decides the rule for x.';
    default:
      return ch.hint;
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type AngleWorkshopConfig = {
    instanceCount?: number;
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
     */
    difficulty?: string;
};

export const generateAngleWorkshop = async (
  ctx: GenerationContext,
): Promise<AngleWorkshopData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as AngleWorkshopConfig;
  const validTypes: AngleWorkshopChallengeType[] = [
    'measure', 'classify_pairs', 'solve_unknown', 'solve_algebraic', 'transversal',
  ];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'angle-workshop',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(angleWorkshopSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : angleWorkshopSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT numbers.
  //    Applies only when the manifest pinned EXACTLY ONE eval mode (a curated blend
  //    has no single tier surface). The withdrawal happens deterministically after
  //    the pool is built; tierSection only nudges the title/description tone. ──
  const pinnedType: AngleWorkshopChallengeType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as AngleWorkshopChallengeType)
      : undefined;
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  // Two halves of config.difficulty, BOTH gated on a single pinned mode + tier:
  //   (a) scaffolding axis — resolveSupportStructure (on-screen help withdrawal)
  //   (b) structural axis  — resolveProblemShape (harder problem SHAPE, enforced in
  //       selectAngleWorkshopChallenges below; promptLines folded in here too).
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
      + (pinnedType && supportTier ? buildStructuralPromptSection(pinnedType, supportTier) : '')
    : '';

  const prompt = `
Create the wrapper metadata for a multi-problem angle geometry session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- An angle session contains 3-6 separate angle problems, all of the same challenge type.
- The system has ALREADY pre-built each problem (angle measures, relationships, expressions, and answers) — you do NOT pick numbers, angles, relationships, or answers.
- Your job is only to write the session-level title and description, and to set the challengeType + gradeBand.

${challengeTypeSection}
${tierSection}
REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific angle measure, value, or answer.
2. Provide a 1-2 sentence educational description of what students will practice.
3. Set challengeType to the correct difficulty tier (matches the constraint above).
4. Set gradeBand to "7" or "8" as appropriate.

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('AngleWorkshop', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid angle-workshop wrapper returned from Gemini API');
  }

  // ── Resolve challengeType (Gemini → eval constraint → safe default) ──
  let challengeType: AngleWorkshopChallengeType = validTypes.includes(wrapper.challengeType as AngleWorkshopChallengeType)
    ? (wrapper.challengeType as AngleWorkshopChallengeType)
    : (evalConstraint?.allowedTypes[0] as AngleWorkshopChallengeType) ?? 'measure';
  if (!validTypes.includes(challengeType)) challengeType = 'measure';

  const gradeBand: '7' | '8' = wrapper.gradeBand === '8' ? '8' : '7';

  // ── Build the per-challenge pool locally ──
  // Structural difficulty (axis 2) is a SINGLE-MODE lever: it re-selects the
  // config/shape/coefficients for the pinned mode. A blended (auto-mode) session
  // has no single tier surface, so pass the tier only when exactly one mode was
  // pinned AND it matches the resolved challengeType. The scaffolding axis still
  // applies per-challenge in the blended post-process below (unchanged).
  const structuralTier = pinnedType && pinnedType === challengeType ? supportTier : null;
  const challenges = selectAngleWorkshopChallenges(challengeType, config?.instanceCount, structuralTier);

  // ── Post-validation: every numeric expectedAnswer must match its figure ──
  for (const ch of challenges) {
    const recomputed = recomputeExpected(ch);
    if (recomputed === null) continue; // classify mode has no numeric answer
    if (Math.abs(recomputed - ch.expectedAnswer) > 1e-6) {
      console.warn(`[AngleWorkshop] Answer mismatch on ${ch.id} (${ch.type}): stored ${ch.expectedAnswer}, recomputed ${recomputed}. Correcting.`);
      ch.expectedAnswer = recomputed;
    }
  }

  // ── Within-mode support tier: withdraw on-screen scaffolding (never the numbers).
  //    Applied PER CHALLENGE from each challenge's OWN type, so a blended (auto-mode)
  //    session gets difficulty too — the tier is a student property, not a single-mode
  //    one. Runs AFTER the answer-recompute fixup so a tier can only remove help. ──
  if (supportTier) {
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      if (ch.type === 'measure') {
        ch.showReadingCue = sc.showReadingCue ?? true;
      } else if (ch.type === 'classify_pairs') {
        ch.showPerceptionMarks = sc.showPerceptionMarks ?? true;
      } else {
        if (sc.showEquationSetup && ch.type === 'solve_algebraic') {
          ch.instruction = easyAlgInstruction(ch); // easy: hand over the assembled equation
        } else if (sc.nameRelationship === false) {
          ch.instruction = genericInstruction(ch); // hard: withhold the relationship name
        }
        if (sc.hintLevel === 'concept') {
          ch.hint = conceptHint(ch, sc.nameRelationship !== false);
        }
      }
    }
    console.log(`[AngleWorkshop] Support tier "${supportTier}" applied per-challenge across ${challenges.length} challenge(s) [${pinnedType ? `single-mode ${pinnedType}` : 'blended'}].`);
  }

  const data: AngleWorkshopData = {
    title: wrapper.title,
    description: wrapper.description,
    challengeType,
    gradeBand,
    // Tell the live tutor the support level whenever a tier is present — it applies
    // in blended sessions too (the tutor's reveal policy is mode-aware per challenge).
    ...(supportTier ? { supportTier } : {}),
    challenges,
  };

  const summary = challenges
    .map((c) => {
      if (c.type === 'classify_pairs') return `classify/${c.relationship}`;
      if (c.type === 'solve_algebraic') return `alg/${c.algConfig}→x=${c.expectedAnswer}`;
      if (c.type === 'transversal') return `${c.transversalShape}→${c.expectedAnswer}`;
      if (c.type === 'solve_unknown') return `${c.solveConfig}→${c.expectedAnswer}`;
      return `measure→${c.expectedAnswer}`;
    })
    .join(', ');
  console.log(`[AngleWorkshop] Final: challengeType=${challengeType}, instances=${challenges.length} [${summary}]`);

  return data;
};
