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
  CircleExplorerData,
  CircleExplorerChallenge,
  CircleExplorerChallengeType,
  CircleCompositeShape,
} from "../../primitives/visual-primitives/math/CircleExplorer";

// ---------------------------------------------------------------------------
// Challenge type docs (one per eval mode)
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  discover_pi: {
    promptDoc:
      `"discover_pi": Grade 7 entry. The student unrolls a circle's circumference and measures it against the diameter, `
      + `discovering that C ÷ d is always about 3.14 (π). They enter the ratio. Whole-number diameters.`,
    schemaDescription: "'discover_pi' (estimate the ratio C ÷ d ≈ π)",
  },
  circumference: {
    promptDoc:
      `"circumference": Grade 7. Given a labeled radius or diameter, the student computes the circumference `
      + `(C = 2·π·r = π·d) using π ≈ 3.14. Whole-number given measure.`,
    schemaDescription: "'circumference' (find C from r or d)",
  },
  area: {
    promptDoc:
      `"area": Grade 7. Given a labeled radius (or diameter), the student computes the area (A = π·r²) using π ≈ 3.14. `
      + `Answer is in square units.`,
    schemaDescription: "'area' (find A from r)",
  },
  reverse: {
    promptDoc:
      `"reverse": Grade 7. The circumference OR area is given; the student works backward to find the radius `
      + `(r = C ÷ 2π, or r = √(A ÷ π)). Radii are whole numbers.`,
    schemaDescription: "'reverse' (find r given C or A)",
  },
  composite: {
    promptDoc:
      `"composite": Grade 7. Semicircle area (½·π·r²), semicircle perimeter (π·r + 2·r), or a circle inscribed in a `
      + `square — find the shaded leftover area (s² − π·(s/2)²). Whole-number measures.`,
    schemaDescription: "'composite' (semicircles / circle-in-square)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — second axis of the two-field
// contract. targetEvalMode = WHICH skill; difficulty = HOW MUCH on-screen help
// within it. A tier NEVER changes the radii, given values, or answers (those are
// pre-built and fixed); it only withdraws scaffolding. See memory
// [[structural-difficulty-not-numeric]] / [[feedback_llm-window-code-builds-structure]].
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; current behavior stands). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/** CircleExplorer's support levers (all scaffolding — never magnitude):
 *  #2 instruction-as-scaffold (name the formula? hint = formula vs conceptual nudge)
 *  #1/#3 perception/CPA (show the explicit formula label on the canvas manipulative reveal). */
interface SupportScaffold {
  /** easy: the instruction itself names the formula; med/hard: generic instruction. */
  nameFormulaInInstruction: boolean;
  /** 'formula' = hint states the formula (easy/medium); 'conceptual' = hint is a nudge only (hard). */
  hintStyle: 'formula' | 'conceptual';
  /** Show the explicit C=2πr / A=πr² / ≈3.14d labels on the manipulative reveal (off at hard). */
  showFormulaReveal: boolean;
  promptLines: string[];
}

/** Tier → scaffold. The withdrawal is tier-driven (mode-agnostic booleans); the
 *  per-mode formula/nudge TEXT is built separately by formulaFor / conceptualHintFor. */
function resolveSupportStructure(_type: CircleExplorerChallengeType, tier: SupportTier): SupportScaffold {
  switch (tier) {
    case 'easy':
      return {
        nameFormulaInInstruction: true,
        hintStyle: 'formula',
        showFormulaReveal: true,
        promptLines: [
          'This tier changes ONLY the scaffolding — never the radii, given values, or answers (those are pre-built and fixed).',
          'EASY = maximum support: the instruction names the exact formula, the hint restates it, and the figure prints the formula on the manipulative reveal.',
        ],
      };
    case 'medium':
      return {
        nameFormulaInInstruction: false,
        hintStyle: 'formula',
        showFormulaReveal: true,
        promptLines: [
          'This tier changes ONLY the scaffolding — never the numbers.',
          'MEDIUM = the instruction is generic; the formula lives in the hint and on the manipulative reveal.',
        ],
      };
    case 'hard':
      return {
        nameFormulaInInstruction: false,
        hintStyle: 'conceptual',
        showFormulaReveal: false,
        promptLines: [
          'This tier changes ONLY the scaffolding — never the numbers.',
          'HARD = minimum support: the instruction does NOT name the formula, the hint is a conceptual nudge only, and the figure withholds the explicit formula labels. The student recalls and applies the relationship unaided.',
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Structural PROBLEM difficulty (the SECOND thing config.difficulty drives).
//
// Distinct from the scaffolding above: this makes the generated PROBLEM itself
// genuinely harder per tier — but STRUCTURALLY (operation/step depth), never by
// inflating magnitude beyond the whole-number band and never by crossing into
// another eval mode (the eval mode is the task identity; see memory
// [[structural-difficulty-not-numeric]]). This primitive is a MULTI-STEP-SOLVER:
// difficulty IS the chain depth, which the builders already encode as discrete
// sub-variant flags. The lever just pins the deeper-chain variant per tier:
//   discover_pi  → NONE. Its answer is the invariant constant 3.14 (recognizing
//                  the ratio C÷d IS the task); any "harder" is bigger radius
//                  (banned numeric) or more circles (instance-count, not shape).
//   circumference→ given diameter (C = πd, one multiply) → given radius
//                  (C = 2πr, double THEN multiply). Caps at this 2-op chain.
//   area         → given radius (square directly) → given diameter (halve to r,
//                  THEN square, THEN ×π). Caps at this 3-op chain.
//   reverse      → from circumference (1 inverse op, ÷2π) → from area (2 inverse
//                  ops, ÷π then √). The √ step is the depth ceiling.
//   composite    → semicircle_area (1 scaled formula) → semicircle_perimeter
//                  (curved + straight, summed) → circle_in_square (two areas,
//                  subtracted). Part-count rises; magnitude band fixed.
//
// The forced variant is the [floor, cap] of each mode's lever: below the floor
// you became a different mode; above the cap you only have bigger numbers left.
// Bands saturate honestly where a mode has fewer rungs than tiers (e.g.
// circumference/area/reverse have only 2 variants, so medium == hard).
// ---------------------------------------------------------------------------

const TIER_GUARDRAIL =
  'This tier changes the PROBLEM\'S STRUCTURE (how many chained operations the '
  + 'student must perform: which length is given, forward vs inverse, part-count) '
  + 'and the on-screen scaffolding — NEVER the magnitude of the radii or answers. '
  + 'π stays ≈ 3.14 and every measure stays a whole number in the same band.';

type CircumferenceVariant = 'radius' | 'diameter';
type AreaVariant = 'radius' | 'diameter';
type ReverseVariant = 'circumference' | 'area';

interface ProblemShape {
  /** circumference: which given length forces the chain depth. */
  circumferenceVariant?: CircumferenceVariant;
  /** area: which given length forces the chain depth. */
  areaVariant?: AreaVariant;
  /** reverse: which given quantity forces the inverse-step depth. */
  reverseVariant?: ReverseVariant;
  /** composite: which figure forces the part-count. */
  compositeShape?: CircleCompositeShape;
  /** Soft description folded into the tier prompt block. */
  promptLines: string[];
}

/** ONE source of truth: a tier → the deeper-chain variant for that mode.
 *  discover_pi returns no enforced variant (lever = none — see brief). */
function resolveProblemShape(type: CircleExplorerChallengeType, tier: SupportTier): ProblemShape {
  switch (type) {
    case 'circumference': {
      // floor = given diameter (1 multiply); cap = given radius (double + multiply).
      const v: CircumferenceVariant = tier === 'easy' ? 'diameter' : 'radius';
      return {
        circumferenceVariant: v,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: the DIAMETER is given — a single-step solve, C = π × d.'
            : 'PROBLEM: the RADIUS is given — a two-step chain: double it to get the diameter (or use C = 2 × π × r), then multiply by π.',
        ],
      };
    }
    case 'area': {
      // floor = given radius (square directly); cap = given diameter (halve→square→×π).
      const v: AreaVariant = tier === 'easy' ? 'radius' : 'diameter';
      return {
        areaVariant: v,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: the RADIUS is given — square it directly, then multiply by π (A = π × r²).'
            : 'PROBLEM: the DIAMETER is given — a three-step chain: halve it to get the radius, square that, then multiply by π.',
        ],
      };
    }
    case 'reverse': {
      // floor = from circumference (1 inverse op); cap = from area (÷π then √).
      const v: ReverseVariant = tier === 'easy' ? 'circumference' : 'area';
      return {
        reverseVariant: v,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: the CIRCUMFERENCE is given — one inverse step, r = C ÷ (2 × π).'
            : 'PROBLEM: the AREA is given — two inverse steps, r = √(A ÷ π): divide by π THEN take the square root.',
        ],
      };
    }
    case 'composite': {
      // floor = semicircle_area (1 op); mid = semicircle_perimeter (2 summed terms);
      // cap = circle_in_square (two areas subtracted).
      const shape: CircleCompositeShape =
        tier === 'easy' ? 'semicircle_area'
          : tier === 'medium' ? 'semicircle_perimeter'
            : 'circle_in_square';
      return {
        compositeShape: shape,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: a SEMICIRCLE AREA — one scaled formula, ½ × π × r².'
            : tier === 'medium'
              ? 'PROBLEM: a SEMICIRCLE PERIMETER — two summed terms: the curved part (π × r) plus the straight diameter (2 × r).'
              : 'PROBLEM: a CIRCLE-IN-SQUARE shaded area — compute the square area AND the inscribed-circle area, then SUBTRACT (s² − π × (s ÷ 2)²).',
        ],
      };
    }
    case 'discover_pi':
    default:
      // Lever = NONE. The answer is the invariant constant 3.14; the only honest
      // "harder" would be bigger numbers (banned) or more circles (instance-count).
      return { promptLines: [] };
  }
}

// ---------------------------------------------------------------------------
// Per-mode instance counts
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<CircleExplorerChallengeType, number> = {
  discover_pi: 4,
  circumference: 4,
  area: 4,
  reverse: 4,
  composite: 4,
};

// ---------------------------------------------------------------------------
// Auto (mixed) session — tier difficulty order (easy → hard)
// ---------------------------------------------------------------------------
// Used only on the unconstrained "Auto" path: every IRT-pinned eval mode still
// passes a single type. The mixed session interleaves all five tiers and is
// sorted by this rank so difficulty scales low → high (SP-21 round-robin).

const TIER_ORDER: CircleExplorerChallengeType[] = [
  'discover_pi',   // Grade 7 entry — discover π
  'circumference', // apply π forward (C)
  'area',          // apply π forward (A)
  'reverse',       // work backward to r
  'composite',     // semicircles / circle-in-square — hardest
];

const TIER_RANK: Record<CircleExplorerChallengeType, number> = TIER_ORDER.reduce(
  (acc, t, i) => { acc[t] = i; return acc; },
  {} as Record<CircleExplorerChallengeType, number>,
);

const MIXED_INSTANCE_COUNT = 8;  // all 5 tiers once + 3 repeats of easier tiers
const MIXED_MAX_COUNT = 12;

// ---------------------------------------------------------------------------
// Math constants & helpers (deterministic, per-challenge values built locally)
// ---------------------------------------------------------------------------

/** Students are told to use π ≈ 3.14; expected answers are computed the same way. */
const PI_APPROX = 3.14;

const UNIT_POOL = ['cm', 'm', 'ft', 'in', 'mm'];

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Tolerance band: covers the π≈3.14 vs true-π gap plus light rounding. */
const lengthTol = (expected: number): number => Math.max(0.5, Math.abs(expected) * 0.02);
const areaTol = (expected: number): number => Math.max(0.5, Math.abs(expected) * 0.02);

const DISCOVER_CTX = [
  'A bike wheel', 'A pizza', 'A clock face', 'A coin', 'A round pond', 'A dinner plate',
];
const CIRC_CTX = [
  'A circular running track', 'A trampoline', 'A round rug', 'A bicycle tire', 'A garden fountain',
];
const AREA_CTX = [
  'A circular pizza', 'A round tabletop', 'A pond', 'A circular flower bed', 'A drum head',
];
const REVERSE_CTX = [
  'A circular pool', 'A round window', 'A ferris wheel', 'A circular garden', 'A round mirror',
];
const SEMICIRCLE_CTX = [
  'A half-circle window', 'A semicircular rug', 'A half-moon garden bed',
  'A protractor', 'A half-pizza',
];
const CIRCLE_IN_SQUARE_CTX = [
  'A circular fountain in a square plaza', 'A round table in a square room',
  'A circular pool in a square deck', 'A round clock on a square wall',
];

// ---------------------------------------------------------------------------
// Per-challenge builders (return a challenge without an id)
// ---------------------------------------------------------------------------

type RawChallenge = Omit<CircleExplorerChallenge, 'id'>;

function buildDiscoverPi(): RawChallenge {
  const radius = randInt(3, 10);     // whole-number diameter (2r) in [6, 20]
  const unitLabel = pick(UNIT_POOL);
  return {
    type: 'discover_pi',
    narration: `${pick(DISCOVER_CTX)} is shaped like this circle.`,
    instruction: 'Unroll the circumference, then find how many diameters fit around: C ÷ d.',
    hint: 'Divide the circumference by the diameter. For EVERY circle this ratio is the same — a little more than 3.',
    unitLabel,
    radius,
    given: 'diameter',
    usePiApprox: true,
    answerKind: 'ratio',
    expectedAnswer: 3.14,
    tolerance: 0.15,
  };
}

function buildCircumference(variant: 'radius' | 'diameter'): RawChallenge {
  const unitLabel = pick(UNIT_POOL);
  if (variant === 'diameter') {
    const d = randInt(4, 24);
    const radius = d / 2;
    const expected = round2(PI_APPROX * d);
    return {
      type: 'circumference',
      narration: `${pick(CIRC_CTX)} has the diameter shown.`,
      instruction: 'Find the circumference — the distance all the way around.',
      hint: 'Circumference = π × d (or 2 × π × r). Use π ≈ 3.14.',
      unitLabel,
      radius,
      given: 'diameter',
      usePiApprox: true,
      answerKind: 'length',
      expectedAnswer: expected,
      tolerance: lengthTol(expected),
    };
  }
  const r = randInt(2, 15);
  const expected = round2(2 * PI_APPROX * r);
  return {
    type: 'circumference',
    narration: `${pick(CIRC_CTX)} has the radius shown.`,
    instruction: 'Find the circumference — the distance all the way around.',
    hint: 'Circumference = 2 × π × r. Use π ≈ 3.14.',
    unitLabel,
    radius: r,
    given: 'radius',
    usePiApprox: true,
    answerKind: 'length',
    expectedAnswer: expected,
    tolerance: lengthTol(expected),
  };
}

function buildArea(variant: 'radius' | 'diameter'): RawChallenge {
  const unitLabel = pick(UNIT_POOL);
  let r: number;
  let given: 'radius' | 'diameter';
  if (variant === 'diameter') {
    const d = 2 * randInt(2, 10); // even diameter → whole radius
    r = d / 2;
    given = 'diameter';
  } else {
    r = randInt(2, 12);
    given = 'radius';
  }
  const expected = round2(PI_APPROX * r * r);
  return {
    type: 'area',
    narration: `${pick(AREA_CTX)} is shaped like this circle.`,
    instruction: 'Find the area — the amount of space inside the circle.',
    hint: 'Area = π × r². Square the radius first, then multiply by π ≈ 3.14. Area is in square units.',
    unitLabel,
    radius: r,
    given,
    usePiApprox: true,
    answerKind: 'area',
    expectedAnswer: expected,
    tolerance: areaTol(expected),
  };
}

function buildReverse(variant: 'circumference' | 'area'): RawChallenge {
  const unitLabel = pick(UNIT_POOL);
  const r = randInt(3, 15);
  if (variant === 'circumference') {
    const givenValue = round1(2 * PI_APPROX * r);
    return {
      type: 'reverse',
      narration: `${pick(REVERSE_CTX)} has the circumference shown.`,
      instruction: 'The circumference is given. Work backward to find the radius.',
      hint: 'C = 2 × π × r, so r = C ÷ (2 × π). Divide by 2 × 3.14.',
      unitLabel,
      radius: r,
      given: 'radius',
      usePiApprox: true,
      answerKind: 'length',
      reverseGiven: 'circumference',
      givenValue,
      expectedAnswer: r,
      tolerance: 0.2,
    };
  }
  const givenValue = round1(PI_APPROX * r * r);
  return {
    type: 'reverse',
    narration: `${pick(REVERSE_CTX)} has the area shown.`,
    instruction: 'The area is given. Work backward to find the radius.',
    hint: 'A = π × r², so r = √(A ÷ π). Divide by 3.14, then take the square root.',
    unitLabel,
    radius: r,
    given: 'radius',
    usePiApprox: true,
    answerKind: 'length',
    reverseGiven: 'area',
    givenValue,
    expectedAnswer: r,
    tolerance: 0.2,
  };
}

function buildComposite(shape: CircleCompositeShape): RawChallenge {
  const unitLabel = pick(UNIT_POOL);
  if (shape === 'circle_in_square') {
    const s = 2 * randInt(2, 8); // even side → whole inscribed radius
    const r = s / 2;
    const expected = round2(s * s - PI_APPROX * r * r);
    return {
      type: 'composite',
      narration: `${pick(CIRCLE_IN_SQUARE_CTX)} — a circle fits exactly inside the square.`,
      instruction: 'A circle is inscribed in the square. Find the shaded area left over.',
      hint: 'Shaded = square area − circle area = s² − π × (s ÷ 2)². The circle\'s radius is half the side.',
      unitLabel,
      radius: r,
      given: 'radius',
      usePiApprox: true,
      answerKind: 'area',
      compositeShape: 'circle_in_square',
      squareSide: s,
      expectedAnswer: expected,
      tolerance: areaTol(expected),
    };
  }
  const r = randInt(2, 12);
  if (shape === 'semicircle_perimeter') {
    const expected = round2(PI_APPROX * r + 2 * r);
    return {
      type: 'composite',
      narration: `${pick(SEMICIRCLE_CTX)} is shaped like this semicircle.`,
      instruction: 'Find the perimeter of this semicircle — the curved part plus the straight diameter.',
      hint: 'Perimeter = half the circumference + the diameter = π × r + 2 × r.',
      unitLabel,
      radius: r,
      given: 'radius',
      usePiApprox: true,
      answerKind: 'length',
      compositeShape: 'semicircle_perimeter',
      expectedAnswer: expected,
      tolerance: lengthTol(expected),
    };
  }
  // semicircle_area
  const expected = round2(0.5 * PI_APPROX * r * r);
  return {
    type: 'composite',
    narration: `${pick(SEMICIRCLE_CTX)} is shaped like this semicircle.`,
    instruction: 'Find the area of this semicircle — half of a full circle.',
    hint: 'A semicircle is half a circle: area = ½ × π × r².',
    unitLabel,
    radius: r,
    given: 'radius',
    usePiApprox: true,
    answerKind: 'area',
    compositeShape: 'semicircle_area',
    expectedAnswer: expected,
    tolerance: areaTol(expected),
  };
}

// ---------------------------------------------------------------------------
// Canonical key for de-duplication within a session
// ---------------------------------------------------------------------------

function canonicalKey(ch: RawChallenge): string {
  switch (ch.type) {
    case 'discover_pi':
      return `pi|${ch.radius}`;
    case 'circumference':
    case 'area':
      return `${ch.type}|${ch.given}|${ch.radius}`;
    case 'reverse':
      return `rev|${ch.reverseGiven}|${ch.radius}`;
    case 'composite':
      return `comp|${ch.compositeShape}|${ch.squareSide ?? ch.radius}`;
  }
}

// ---------------------------------------------------------------------------
// Recompute the expected answer from geometry (self-check guard against drift)
// ---------------------------------------------------------------------------

function recomputeExpected(ch: CircleExplorerChallenge): number | null {
  const r = ch.radius;
  switch (ch.type) {
    case 'discover_pi':
      return 3.14;
    case 'circumference':
      return round2(2 * PI_APPROX * r);
    case 'area':
      return round2(PI_APPROX * r * r);
    case 'reverse':
      return r; // the radius is the answer
    case 'composite':
      switch (ch.compositeShape) {
        case 'circle_in_square':
          return round2((ch.squareSide ?? 2 * r) ** 2 - PI_APPROX * r * r);
        case 'semicircle_perimeter':
          return round2(PI_APPROX * r + 2 * r);
        case 'semicircle_area':
          return round2(0.5 * PI_APPROX * r * r);
        default:
          return null;
      }
  }
}

// ---------------------------------------------------------------------------
// Support-tier text helpers (per mode) — used when a tier is applied at the end
// ---------------------------------------------------------------------------

/** The formula the easy instruction names and the formula hint states. */
function formulaFor(ch: RawChallenge): string {
  switch (ch.type) {
    case 'discover_pi':
      return 'C ÷ d';
    case 'circumference':
      return ch.given === 'diameter' ? 'C = π × d' : 'C = 2 × π × r';
    case 'area':
      return 'A = π × r²';
    case 'reverse':
      return ch.reverseGiven === 'area' ? 'r = √(A ÷ π)' : 'r = C ÷ (2 × π)';
    case 'composite':
      switch (ch.compositeShape) {
        case 'circle_in_square':
          return 'shaded = s² − π × (s ÷ 2)²';
        case 'semicircle_perimeter':
          return 'P = π × r + 2 × r';
        case 'semicircle_area':
          return 'A = ½ × π × r²';
        default:
          return '';
      }
  }
}

/** A conceptual nudge (NO formula) — the hard-tier hint. Names a relationship to
 *  look for, never the operation to perform. */
function conceptualHintFor(ch: RawChallenge): string {
  switch (ch.type) {
    case 'discover_pi':
      return 'Compare the unrolled length to one diameter — how many diameters wrap around the edge?';
    case 'circumference':
      return 'Which measurement traces all the way around the edge? It depends on π and how wide the circle is across.';
    case 'area':
      return 'Area is the space inside. Picture the circle re-cut into a rectangle — how do its sides relate to the radius?';
    case 'reverse':
      return ch.reverseGiven === 'area'
        ? 'You know the space inside. Work the area relationship backward to get the radius.'
        : 'You know the distance around. What single operation undoes "multiply by 2 × π"?';
    case 'composite':
      switch (ch.compositeShape) {
        case 'circle_in_square':
          return 'Start from the whole square, then take away the part the circle covers.';
        case 'semicircle_perimeter':
          return 'Trace the boundary: the curved part plus the straight edge across.';
        case 'semicircle_area':
          return 'It is half of a full circle — find the whole, then take half.';
        default:
          return ch.hint;
      }
  }
}

// ---------------------------------------------------------------------------
// Build N distinct challenges for a single-mode session, with variance rules
// ---------------------------------------------------------------------------

export function selectCircleExplorerChallenges(
  challengeType: CircleExplorerChallengeType,
  count?: number,
  /**
   * SECOND AXIS — structural difficulty. When a support tier is present, the
   * sub-variant (chain depth) is PINNED to that tier's forced variant via
   * resolveProblemShape, instead of rotating through all variants. Absent → the
   * byte-identical original variance behavior (rotate, guarantee ≥1 of each).
   */
  tier?: SupportTier | null,
): CircleExplorerChallenge[] {
  const target = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, count ?? COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT),
  );

  const raw: RawChallenge[] = [];
  const seen = new Set<string>();

  const tryPush = (ch: RawChallenge): boolean => {
    const key = canonicalKey(ch);
    if (seen.has(key)) return false;
    seen.add(key);
    raw.push(ch);
    return true;
  };

  // STRUCTURAL TIER PATH: pin the deeper-chain variant for this tier (no
  // rotation). The only remaining variance is the radius/unit/context, which the
  // builders randomize and the dedup key separates. Gated on `tier` so the
  // no-tier path below is byte-identical to the original.
  const shape = tier ? resolveProblemShape(challengeType, tier) : null;
  if (shape) {
    const attemptCap = target * 16;
    if (challengeType === 'circumference' && shape.circumferenceVariant) {
      const v = shape.circumferenceVariant;
      for (let a = 0; a < attemptCap && raw.length < target; a++) tryPush(buildCircumference(v));
      while (raw.length < target) raw.push(buildCircumference(v)); // saturate honestly
    } else if (challengeType === 'area' && shape.areaVariant) {
      const v = shape.areaVariant;
      for (let a = 0; a < attemptCap && raw.length < target; a++) tryPush(buildArea(v));
      while (raw.length < target) raw.push(buildArea(v));
    } else if (challengeType === 'reverse' && shape.reverseVariant) {
      const v = shape.reverseVariant;
      for (let a = 0; a < attemptCap && raw.length < target; a++) tryPush(buildReverse(v));
      while (raw.length < target) raw.push(buildReverse(v));
    } else if (challengeType === 'composite' && shape.compositeShape) {
      const v = shape.compositeShape;
      for (let a = 0; a < attemptCap && raw.length < target; a++) tryPush(buildComposite(v));
      while (raw.length < target) raw.push(buildComposite(v));
    } else {
      // discover_pi (lever = none): the tier withdraws scaffolding only; the
      // problem shape is unchanged from the no-tier path (distinct radii).
      for (let a = 0; a < attemptCap && raw.length < target; a++) tryPush(buildDiscoverPi());
      while (raw.length < target) raw.push(buildDiscoverPi());
    }
    // Saturated variants leave the radius the only easy→hard cue.
    const sortedTier = raw.sort((a, b) => a.radius - b.radius);
    return sortedTier.map((ch, i) => ({ ...ch, id: `ce-${i + 1}` }));
  }

  // ── NO-TIER PATH (byte-identical to the original) ──
  // Variance rule: rotate through structural variants, guaranteeing ≥1 of each
  // before back-filling. Mirrors factor-tree's "≥1 odd composite" pattern.
  if (challengeType === 'circumference') {
    const variants: Array<'radius' | 'diameter'> = ['radius', 'diameter'];
    let i = 0;
    for (let attempt = 0; attempt < target * 12 && raw.length < target; attempt++) {
      const v = i < variants.length ? variants[i] : pick(variants);
      i++;
      tryPush(buildCircumference(v));
    }
  } else if (challengeType === 'area') {
    const variants: Array<'radius' | 'diameter'> = ['radius', 'diameter'];
    let i = 0;
    for (let attempt = 0; attempt < target * 12 && raw.length < target; attempt++) {
      const v = i < variants.length ? variants[i] : pick(variants);
      i++;
      tryPush(buildArea(v));
    }
  } else if (challengeType === 'reverse') {
    const variants: Array<'circumference' | 'area'> = ['circumference', 'area'];
    let i = 0;
    for (let attempt = 0; attempt < target * 12 && raw.length < target; attempt++) {
      const v = i < variants.length ? variants[i] : pick(variants);
      i++;
      tryPush(buildReverse(v));
    }
  } else if (challengeType === 'composite') {
    const variants: CircleCompositeShape[] = ['semicircle_area', 'semicircle_perimeter', 'circle_in_square'];
    let i = 0;
    for (let attempt = 0; attempt < target * 14 && raw.length < target; attempt++) {
      const v = i < variants.length ? variants[i] : pick(variants);
      i++;
      tryPush(buildComposite(v));
    }
  } else {
    // discover_pi — just distinct radii
    for (let attempt = 0; attempt < target * 12 && raw.length < target; attempt++) {
      tryPush(buildDiscoverPi());
    }
  }

  // Fallback — accept duplicates if the candidate space was too narrow.
  while (raw.length < target) {
    switch (challengeType) {
      case 'circumference': raw.push(buildCircumference(pick(['radius', 'diameter']))); break;
      case 'area': raw.push(buildArea(pick(['radius', 'diameter']))); break;
      case 'reverse': raw.push(buildReverse(pick(['circumference', 'area']))); break;
      case 'composite': raw.push(buildComposite(pick(['semicircle_area', 'semicircle_perimeter', 'circle_in_square']))); break;
      default: raw.push(buildDiscoverPi());
    }
  }

  // Easier → harder by the magnitude of the radius (the structural difficulty driver).
  const sorted = raw.sort((a, b) => a.radius - b.radius);
  return sorted.map((ch, i) => ({ ...ch, id: `ce-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Build a MIXED session that interleaves all five tiers (Auto path only)
// ---------------------------------------------------------------------------

const shuffle = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Dispatch to the right per-type builder. With NO tier the multi-variant types
// pick a variant at random (structural variety within a mixed session). With a
// tier present, the variant is PINNED to that tier's forced chain depth via
// resolveProblemShape — so a blended session also honors the second axis.
function buildForType(type: CircleExplorerChallengeType, tier?: SupportTier | null): RawChallenge {
  const shape = tier ? resolveProblemShape(type, tier) : null;
  switch (type) {
    case 'discover_pi':
      return buildDiscoverPi();
    case 'circumference':
      return buildCircumference(shape?.circumferenceVariant ?? pick(['radius', 'diameter']));
    case 'area':
      return buildArea(shape?.areaVariant ?? pick(['radius', 'diameter']));
    case 'reverse':
      return buildReverse(shape?.reverseVariant ?? pick(['circumference', 'area']));
    case 'composite':
      return buildComposite(shape?.compositeShape ?? pick(['semicircle_area', 'semicircle_perimeter', 'circle_in_square']));
  }
}

export function selectMixedCircleExplorerChallenges(count?: number, tier?: SupportTier | null): CircleExplorerChallenge[] {
  // Cover every tier at least once; default to a session of 8.
  const target = Math.max(
    TIER_ORDER.length,
    Math.min(MIXED_MAX_COUNT, count ?? MIXED_INSTANCE_COUNT),
  );

  // Round-robin over a shuffled permutation so all five tiers are represented
  // and the leading tier varies session-to-session. The first TIER_ORDER.length
  // slots are guaranteed to cover all tiers (it's a permutation); later slots
  // repeat tiers in the same rotation.
  const rotation = shuffle(TIER_ORDER);
  const raw: RawChallenge[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < target * 12 && raw.length < target; attempt++) {
    const type = rotation[raw.length % rotation.length];
    const ch = buildForType(type, tier);
    const key = canonicalKey(ch);
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push(ch);
  }

  // Fallback — accept duplicates if dedup starved a slot (narrow candidate space).
  let slot = raw.length;
  while (raw.length < target) {
    raw.push(buildForType(rotation[slot % rotation.length], tier));
    slot++;
  }

  // Scale difficulty low → high: tier rank is the primary key, radius magnitude
  // the tiebreaker within a tier.
  const sorted = raw.sort((a, b) => {
    const dr = TIER_RANK[a.type] - TIER_RANK[b.type];
    return dr !== 0 ? dr : a.radius - b.radius;
  });
  return sorted.map((ch, i) => ({ ...ch, id: `ce-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const circleExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-circle session (e.g., 'Circumference of a Circle'). Do NOT name specific radii or values — the session walks through several circles.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: ['discover_pi', 'circumference', 'area', 'reverse', 'composite'],
      description: "Difficulty tier of the session. The system uses this to build the circle pool.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['7'],
      description: "Target grade band (always 7 for circles, CCSS 7.G.B.4).",
    },
  },
  required: ['title', 'description', 'challengeType'],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type CircleExplorerConfig = {
    instanceCount?: number;
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
     */
    difficulty?: string;
};

export const generateCircleExplorer = async (
  ctx: GenerationContext,
): Promise<CircleExplorerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as CircleExplorerConfig;
  const validTypes: CircleExplorerChallengeType[] = [
    'discover_pi',
    'circumference',
    'area',
    'reverse',
    'composite',
  ];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'circle-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(circleExplorerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : circleExplorerSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Within-mode support tier (the STUDENT's tier — drives application below) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType is ONLY for the prompt tone (a blended/auto session has no single
  // mode to describe to the LLM); the per-challenge application keys off each
  // challenge's own type, so blended sessions get difficulty too.
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as CircleExplorerChallengeType)
      : undefined;
  const tierScaffold = pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  // ONE coherent "what HARD means here": scaffolding withdrawal (axis 1) PLUS
  // structural chain-depth (axis 2 = resolveProblemShape). Both keyed off the
  // same tier enum so the LLM sees one consistent picture.
  const tierProblemShape = pinnedType && supportTier ? resolveProblemShape(pinnedType, supportTier) : null;
  const tierLines = tierScaffold
    ? [TIER_GUARDRAIL, ...tierScaffold.promptLines, ...(tierProblemShape?.promptLines ?? [])]
    : [];
  const tierSection = tierLines.length
    ? `\n## WITHIN-MODE SUPPORT TIER "${supportTier}" (scaffolding + structural chain-depth — NOT number size)\n${tierLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const prompt = `
Create the wrapper metadata for a multi-circle geometry session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A circle session contains several separate circle problems the student solves.
- The system has ALREADY pre-built each circle (radii, diameters, given values, composite dimensions, and answers) — you do NOT pick numbers, radii, or answers.
- Your job is only to write the session-level title and description, and to set the challengeType + gradeBand.

${challengeTypeSection}
${tierSection}
REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific radius, value, or answer.
2. Provide a 1-2 sentence educational description of what students will practice.
3. Set challengeType to the correct difficulty tier (matches the constraint above).
4. Set gradeBand to "7".

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('CircleExplorer', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid circle-explorer wrapper returned from Gemini API');
  }

  // ── Auto (mixed) path: no eval-mode constraint → interleave ALL five tiers,
  //    scaled easy→hard, as a single longer session (SP-21). IRT-pinned modes
  //    always have a constraint and fall through to the single-type path below.
  const isMixed = evalConstraint === null;

  // ── Resolve challengeType (Gemini → eval constraint → safe default) ──
  // For mixed sessions this is representative metadata only: the component
  // renders per-challenge from `currentChallenge.type`, never the top-level field.
  let challengeType: CircleExplorerChallengeType = isMixed
    ? 'discover_pi' // lowest tier — where the mixed session begins
    : validTypes.includes(wrapper.challengeType as CircleExplorerChallengeType)
      ? (wrapper.challengeType as CircleExplorerChallengeType)
      : (evalConstraint?.allowedTypes[0] as CircleExplorerChallengeType) ?? 'circumference';
  if (!validTypes.includes(challengeType)) challengeType = 'circumference';

  // ── Build the per-challenge pool locally ──
  // supportTier is threaded into the pool builders so the SECOND axis (structural
  // chain-depth via resolveProblemShape) is enforced at construction. Absent →
  // null → byte-identical original variance behavior.
  const challenges = isMixed
    ? selectMixedCircleExplorerChallenges(config?.instanceCount, supportTier)
    : selectCircleExplorerChallenges(challengeType, config?.instanceCount, supportTier);

  // ── Post-validation: every expectedAnswer must match its geometry ──
  for (const ch of challenges) {
    const recomputed = recomputeExpected(ch);
    if (recomputed === null) {
      console.warn(`[CircleExplorer] Could not recompute expected for ${ch.id} (${ch.type}/${ch.compositeShape ?? '-'}).`);
      continue;
    }
    if (Math.abs(recomputed - ch.expectedAnswer) > 1e-6) {
      console.warn(`[CircleExplorer] Answer mismatch on ${ch.id} (${ch.type}): stored ${ch.expectedAnswer}, recomputed ${recomputed}. Correcting.`);
      ch.expectedAnswer = recomputed;
    }
  }

  // ── Apply the support tier deterministically, per challenge (mode-correct) ──
  // Gated only on a tier being present (NOT on pinnedType) so blended/auto
  // sessions get difficulty too. Runs AFTER post-validation: it only rewrites
  // instruction/hint text and toggles the formula reveal — never the numbers.
  if (supportTier) {
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      ch.showFormulaReveal = sc.showFormulaReveal;

      // Hint: formula (easy/medium baseline) vs conceptual nudge (hard).
      if (sc.hintStyle === 'conceptual') {
        ch.hint = conceptualHintFor(ch);
      }

      // Instruction: easy names the formula; discover_pi already names "C ÷ d",
      // so don't double it — instead soften it at hard so it stops naming the op.
      const formula = formulaFor(ch);
      if (sc.nameFormulaInInstruction && formula && ch.type !== 'discover_pi') {
        ch.instruction = `${ch.instruction} Use ${formula}.`;
      }
      if (ch.type === 'discover_pi' && supportTier === 'hard') {
        ch.instruction = 'Unroll the circumference, then estimate how many diameters fit around the edge.';
      }
    }
    console.log(
      `[CircleExplorer] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`,
    );
  }

  const data: CircleExplorerData = {
    title: wrapper.title,
    description: wrapper.description,
    challengeType,
    gradeBand: '7',
    challenges,
    ...(supportTier ? { supportTier } : {}),
  };

  const summary = challenges
    .map((c) => `${c.type}${c.compositeShape ? `/${c.compositeShape}` : ''} r=${c.radius}→${c.expectedAnswer}`)
    .join(', ');
  console.log(`[CircleExplorer] Final: challengeType=${challengeType}, instances=${challenges.length} [${summary}]`);

  return data;
};
