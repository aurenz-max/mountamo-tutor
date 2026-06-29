import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { resolveScopeRange } from "../scopeRangeResolver";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import type {
  PolygonAreaBuilderData,
  PolygonAreaChallenge,
  PolygonAreaChallengeType,
  CompositeRect,
  PolygonVertex,
} from "../../primitives/visual-primitives/math/PolygonAreaBuilder";

// ---------------------------------------------------------------------------
// Challenge type docs (one per eval mode)
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  decompose: {
    promptDoc:
      `"decompose": Grade 6 entry. The student slides the cut triangle off a parallelogram to rebuild it as a rectangle, `
      + `then finds base × height. Teaches conservation of area. Whole-number base/height.`,
    schemaDescription: "'decompose' (rearrange a parallelogram into a rectangle)",
  },
  find_area_triangle_parallelogram: {
    promptDoc:
      `"find_area_triangle_parallelogram": Grade 6. Given a labeled triangle (½·b·h) or parallelogram (b·h), the student computes the area. `
      + `Whole-number dimensions; perpendicular height is shown.`,
    schemaDescription: "'find_area_triangle_parallelogram' (area of a triangle or parallelogram)",
  },
  find_area_trapezoid: {
    promptDoc:
      `"find_area_trapezoid": Grade 6-7. Trapezoid area via the average-of-bases method ½·(b1+b2)·h. `
      + `Whole-number bases and height with clean (integer) area.`,
    schemaDescription: "'find_area_trapezoid' (area of a trapezoid)",
  },
  composite_area: {
    promptDoc:
      `"composite_area": Grade 6-7. An L-shaped figure built from labeled rectangles. The student decomposes it `
      + `into the known rectangles and sums the areas.`,
    schemaDescription: "'composite_area' (decompose an irregular figure into rectangles)",
  },
  coordinate_polygon: {
    promptDoc:
      `"coordinate_polygon": Grade 7. A polygon plotted on a coordinate grid with labeled vertices. The student finds `
      + `its area by decomposition or bounding-box reasoning. Integer vertices in the first quadrant; clean area.`,
    schemaDescription: "'coordinate_polygon' (area of a polygon from vertex coordinates)",
  },
};

// ---------------------------------------------------------------------------
// Support tiers (within-mode scaffolding withdrawal) — FIXED harness
// ---------------------------------------------------------------------------
// Second axis of the two-field contract: targetEvalMode = WHICH skill (the
// figure family), config.difficulty = HOW MUCH decomposition scaffolding within
// it. SCAFFOLDING ONLY — it NEVER changes the polygon's dimensions (the numbers
// stay from the local randInt builders; magnitude is owned by the eval mode +
// grade scope). easy = the canvas shows HOW to decompose (cut guidelines + a
// per-region area sub-label so the student can self-check); hard = guidelines
// withdrawn, the student chooses the decomposition unaided. The dimension labels
// needed to COMPUTE the area stay on at every tier (removing them changes the
// task, not the support).

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** Decomposition guidelines: the dashed cut/slot lines that show the student
   *  WHERE to split the figure (decompose target-slot, composite piece-split
   *  outlines, trapezoid/coordinate bounding-box & cut lines). Withdrawn at hard
   *  so the student chooses the decomposition. */
  showDecompositionGuides: boolean;
  /** A worked per-region area sub-label on ONE region (composite easy only).
   *  ANSWER-LEAK GUARD: the regions' areas sum to the asked total, so the
   *  component shows the sub-area for ONLY the FIRST region — never the full set,
   *  and never on the answer-bearing figure. */
  showRegionAreaLabel: boolean;
  /** Unit grid behind the figure (triangle / parallelogram / trapezoid) so the
   *  student can count squares to self-check. Composite & coordinate modes draw
   *  their grid unconditionally (it's intrinsic), so this only gates the three
   *  ungridded figure families. */
  showGridOverlay: boolean;
  /** Prompt lines describing the tier to Gemini (tone only — Gemini writes the
   *  session title/description, never the dimensions). */
  promptLines: string[];
}

const TIER_GUARDRAIL =
  'This tier changes the problem\'s SHAPE and on-screen DECOMPOSITION SCAFFOLDING, '
  + 'never its MAGNITUDE. Axis 1 (scaffolding): cut guidelines, per-region area '
  + 'sub-labels, and a self-check grid are withdrawn at higher tiers. Axis 2 '
  + '(structure): harder tiers use a structurally harder FIGURE — more rectangle '
  + 'pieces, more vertices, a less-symmetric trapezoid, or more figures needing the '
  + 'extra ½ step — built from the SAME small number bands. The dimensions stay in '
  + 'their existing grade-band ranges at every tier; "harder" is more steps, not '
  + 'bigger numbers, and never a different eval mode.';

/** easy → hard decomposition-support gradient, per challenge type. */
function resolveSupportStructure(type: PolygonAreaChallengeType, tier: SupportTier): SupportScaffold {
  switch (type) {
    case 'decompose':
      // The dashed target-slot is the guideline that tells the student where the
      // cut triangle slides. Easy/medium show it; hard hides it so the student
      // works out the rearrangement (the cut triangle is still draggable).
      return {
        showDecompositionGuides: tier !== 'hard',
        showRegionAreaLabel: false,
        showGridOverlay: false,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'hard'
            ? 'HARD: the dashed target slot is hidden — the student figures out where to slide the cut triangle to rebuild the rectangle, unaided.'
            : 'EASY/MEDIUM: the dashed target slot shows exactly where the cut triangle goes.',
        ],
      };
    case 'composite_area':
      // Easy/medium render the figure already split into its labelled rectangle
      // pieces (the decomposition is GIVEN); hard renders the union outline only,
      // so the student chooses where to cut. Easy adds ONE region's worked area.
      return {
        showDecompositionGuides: tier !== 'hard',
        showRegionAreaLabel: tier === 'easy',
        showGridOverlay: false, // composite always draws its unit grid intrinsically
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: the figure is pre-split into its rectangle pieces and ONE piece shows its worked area as a model — the student finishes the rest and adds.'
            : tier === 'medium'
              ? 'MEDIUM: the figure is pre-split into rectangle pieces (dimensions labelled), but no area is worked for the student.'
              : 'HARD: the figure is shown as ONE L-shaped outline — the student decides where to cut it into rectangles. Hint must not say where to split.',
        ],
      };
    case 'coordinate_polygon':
      // Grid + axis labels are intrinsic (needed to read vertices). The guideline
      // is the bounding-box / decomposition overlay; withdraw it at hard.
      return {
        showDecompositionGuides: tier !== 'hard',
        showRegionAreaLabel: false,
        showGridOverlay: false, // coordinate always draws its grid intrinsically
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'hard'
            ? 'HARD: no bounding-box or cut overlay — the student decomposes the plotted polygon on the grid unaided (vertex coordinates and grid stay).'
            : 'EASY/MEDIUM: a faint bounding-box / decomposition overlay suggests how to break the polygon into a rectangle and triangles.',
        ],
      };
    case 'find_area_trapezoid':
      return {
        showDecompositionGuides: tier === 'easy', // easy shows the rect+triangle split lines
        showRegionAreaLabel: false,
        showGridOverlay: tier === 'easy',
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: a unit grid plus faint cut lines split the trapezoid into a rectangle and triangles, so the student can count/self-check.'
            : tier === 'medium'
              ? 'MEDIUM: no grid, no cut lines — the student applies ½·(b1+b2)·h to the labelled bases and height.'
              : 'HARD: bare figure with only the dimension labels — the student averages the bases and multiplies by height unaided.',
        ],
      };
    case 'find_area_triangle_parallelogram':
    default:
      // Perception/self-check grid behind the figure; the dimension labels and
      // the dashed perpendicular height stay on at every tier (intrinsic to the
      // task). Easy shows the grid so the student can count squares.
      return {
        showDecompositionGuides: false,
        showRegionAreaLabel: false,
        showGridOverlay: tier === 'easy',
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: a faint unit grid sits behind the figure so the student can count squares to self-check the base × height (or ½·b·h).'
            : tier === 'medium'
              ? 'MEDIUM: no grid — the student reads the labelled base and height and applies the formula.'
              : 'HARD: no grid, no extra cues — only the dimension labels and the perpendicular-height mark remain.',
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Structural PROBLEM difficulty (the SECOND thing config.difficulty drives) —
// axis 2, distinct from the scaffolding-withdrawal axis above.
//
// This makes the generated PROBLEM itself structurally harder per tier WITHOUT
// inflating magnitude (the figure dimensions stay in their existing randInt
// bands) and WITHOUT crossing into another eval mode (the eval mode is the task
// identity). Each mode exposes ONE in-mode SHAPE lever, clamped to [floor, cap]
// from the design brief:
//   decompose                      → NONE (no honest structural dial; the task
//                                    is invariant "slide the one cut triangle".
//                                    Brief: honest skip — do not invent one.)
//   find_area_triangle_parallelogram → formula-step depth via figure-variant MIX
//                                    (parallelogram-weighted b·h → triangle-
//                                    weighted ½·b·h). FLOOR: both variants stay
//                                    representable (never collapse to one type).
//   find_area_trapezoid            → decomposition asymmetry via topOffset:
//                                    isosceles → right (one vertical side) →
//                                    scalene (two different side triangles).
//                                    FLOOR: still a trapezoid (b1≠b2); area
//                                    identical ½·(b1+b2)·h, kept integer.
//   composite_area                 → # of rectangle pieces to sum: 2 → 3.
//                                    FLOOR: ≥2 (1 piece = not composite). CAP at
//                                    the guides-shown tiers — the hard-tier union
//                                    outline render is 2-rect only (see concerns).
//   coordinate_polygon             → vertex / decomposition depth: axis-aligned
//                                    rectangle (4v, w·h) → right triangle (3v,
//                                    ½·b·h) → L-shaped hexagon (6v, multi-piece).
//                                    FLOOR: ≥3 first-quadrant integer vertices,
//                                    clean integer area.
//
// Magnitude is HELD at every tier by reusing the existing per-figure randInt
// bands — more pieces / more vertices, not bigger numbers. The answer recomputes
// deterministically (sum-of-parts / shoelace) so it can never desync.
// ---------------------------------------------------------------------------

type TrapezoidVariant = 'isosceles' | 'right' | 'scalene';
type CoordinateVariant = 'rectangle' | 'right_triangle' | 'l_shape';

interface ProblemShape {
  /** Prompt lines describing what "harder" means structurally for this tier. */
  promptLines: string[];
  /** find_area_triangle_parallelogram: P(figure is a triangle) for the pool. */
  triangleBias?: number;
  /** find_area_trapezoid: the enforced asymmetry variant. */
  trapezoidVariant?: TrapezoidVariant;
  /** composite_area: exact # of rectangle pieces to decompose-and-sum (≥2). */
  pieceCount?: number;
  /** coordinate_polygon: the enforced vertex-count variant. */
  coordinateVariant?: CoordinateVariant;
}

/** One tier → one structural intent, clamped to [floor, cap]. Single source of
 *  truth consumed by BOTH the prompt section and the post-process re-selection. */
function resolveProblemShape(type: PolygonAreaChallengeType, tier: SupportTier): ProblemShape {
  switch (type) {
    case 'find_area_triangle_parallelogram':
      // Re-weight the figure mix toward the extra ½ step at hard. FLOOR: both
      // variants stay possible (the pool still guarantees ≥1 of each), so the
      // mode keeps its "triangle OR parallelogram" identity at every tier.
      return {
        triangleBias: tier === 'easy' ? 0.25 : tier === 'medium' ? 0.5 : 0.8,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: mostly parallelograms (area = base × height, no halving step).'
            : tier === 'medium'
              ? 'PROBLEM: a balanced mix of triangles and parallelograms.'
              : 'PROBLEM: mostly triangles — every figure needs the extra ½ step (½ × base × height), and the student must use the perpendicular height, not a slanted side.',
        ],
      };
    case 'find_area_trapezoid':
      return {
        trapezoidVariant: tier === 'easy' ? 'isosceles' : tier === 'medium' ? 'right' : 'scalene',
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: a symmetric (isosceles) trapezoid — the top base is centered, so the two side triangles are mirror images.'
            : tier === 'medium'
              ? 'PROBLEM: a right trapezoid — one vertical (square-corner) side and a single slanted side.'
              : 'PROBLEM: a scalene trapezoid — the top base is off-center, so the two side triangles are different and the decomposition is less obvious.',
        ],
      };
    case 'composite_area':
      // 2 → 3 rectangle pieces. CAP: hard withdraws the decomposition guides, and
      // the union-outline render is 2-rect only, so 3 pieces are only renderable
      // at easy/medium. Pin hard back to 2 (the extra structural step at hard is
      // the guide withdrawal, owned by the scaffolding axis). See concerns.
      return {
        pieceCount: tier === 'hard' ? 2 : tier === 'medium' ? 3 : 2,
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: a 2-rectangle L-shape — two pieces to find and add.'
            : tier === 'medium'
              ? 'PROBLEM: a 3-rectangle figure (e.g. a T or stair) — three pieces to decompose and sum, with no growth in overall size.'
              : 'PROBLEM: a 2-rectangle L-shape shown as ONE outline — the student also decides where to cut (guides withdrawn).',
        ],
      };
    case 'coordinate_polygon':
      return {
        coordinateVariant: tier === 'easy' ? 'rectangle' : tier === 'medium' ? 'right_triangle' : 'l_shape',
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM: an axis-aligned rectangle (4 vertices) — area is width × height, no decomposition.'
            : tier === 'medium'
              ? 'PROBLEM: a right triangle (3 vertices) — one ½ × base × height split.'
              : 'PROBLEM: an L-shaped hexagon (6 vertices) — the student decomposes it into rectangles (or uses the shoelace method) over several steps.',
        ],
      };
    case 'decompose':
    default:
      // Brief: NONE. The task is invariant (slide the one cut triangle, then
      // b·h); the only "harder" dials are banned magnitude or geometric skew
      // noise. No structural branch — scaffolding axis only.
      return { promptLines: [] };
  }
}

// ---------------------------------------------------------------------------
// Per-mode instance counts
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<PolygonAreaChallengeType, number> = {
  decompose: 4,
  find_area_triangle_parallelogram: 4,
  find_area_trapezoid: 4,
  composite_area: 4,
  coordinate_polygon: 4,
};

// ---------------------------------------------------------------------------
// Auto (mixed) session — tier difficulty order (easy → hard)
// ---------------------------------------------------------------------------
// Used only on the unconstrained "Auto" path: every IRT-pinned eval mode still
// passes a single type. The mixed session interleaves all five tiers and is
// sorted by this rank so difficulty scales low → high (SP-21 round-robin).

const TIER_ORDER: PolygonAreaChallengeType[] = [
  'decompose',                       // Grade 6 entry — easiest
  'find_area_triangle_parallelogram',// Grade 6
  'find_area_trapezoid',             // Grade 6-7
  'composite_area',                  // Grade 6-7
  'coordinate_polygon',              // Grade 7 — hardest
];

const TIER_RANK: Record<PolygonAreaChallengeType, number> = TIER_ORDER.reduce(
  (acc, t, i) => { acc[t] = i; return acc; },
  {} as Record<PolygonAreaChallengeType, number>,
);

const MIXED_INSTANCE_COUNT = 8;  // all 5 tiers once + 3 repeats of easier tiers
const MIXED_MAX_COUNT = 12;

// ---------------------------------------------------------------------------
// Pool helpers (deterministic, per-challenge values built locally)
// ---------------------------------------------------------------------------

const UNIT_POOL = ['cm', 'm', 'ft', 'in', 'yd', 'units'];

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const TRIANGLE_CTX = ['A sail on a sailboat', 'A slice of pizza', 'A triangular pennant flag', 'A yield road sign', 'A triangular garden bed'];
const PARA_CTX = ['A parking space painted at a slant', 'A floor tile', 'The side panel of a ramp', 'A leaning bookshelf panel'];
const TRAP_CTX = ['A table top', 'The cross-section of a bucket', 'A garden plot', 'A lampshade panel', 'A dam wall cross-section'];
const COMP_CTX = ['An L-shaped room floor', 'An L-shaped garden bed', 'A deck wrapping a corner', 'The side profile of a staircase'];
const COORD_CTX = ['A park drawn on a city map grid', 'A plot of land on a survey grid', 'A field marked on graph paper'];

function shoelace(vs: PolygonVertex[]): number {
  let sum = 0;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// ---- Per-figure builders (return a challenge without an id) ----

type RawChallenge = Omit<PolygonAreaChallenge, 'id'>;

// ── Tier-2 dimension scope cap (CLASS-3) ───────────────────────────────────
// The builders pick side lengths in CODE (for variety), so intent can't reach them via
// the prompt. The select functions run SYNCHRONOUSLY, so a module-scoped cap set around
// the selection is reentrancy-safe (no await between set and the builders reading it).
// Post-validation (recomputeArea) re-derives every answer, so a clamp is always correct;
// at most a structural variant degrades gracefully (still a valid figure). null → no cap.
let activeDimCap: { min: number; max: number } | null = null;

/** Narrow a [lo,hi] dimension range to the active cap, NEVER below the figure's structural
 *  floor `lo` (so a too-tight cap yields the smallest feasible figure, not an impossible one). */
function capDims(lo: number, hi: number): [number, number] {
  if (!activeDimCap) return [lo, hi];
  const hiC = Math.min(hi, Math.max(lo, activeDimCap.max));
  const loC = Math.min(Math.max(lo, activeDimCap.min), hiC);
  return [loC, hiC];
}

function buildDecompose(): RawChallenge {
  const base = randInt(...capDims(5, 12));
  const height = randInt(...capDims(3, 9));
  const skew = randInt(1, Math.min(base - 1, 4));
  const unitLabel = pick(UNIT_POOL);
  return {
    type: 'decompose',
    figureType: 'parallelogram',
    base, height, skew,
    expectedArea: base * height,
    unitLabel,
    narration: `${pick(PARA_CTX)} is shaped like this parallelogram.`,
    instruction: 'Drag the cut triangle across to rebuild it as a rectangle, then enter base × height.',
    hint: 'A parallelogram rearranges into a rectangle with the SAME base and height. Area = base × height.',
  };
}

function buildTriangleFA(): RawChallenge {
  let base = randInt(...capDims(4, 16));
  let height = randInt(...capDims(3, 12));
  if ((base * height) % 2 !== 0) {
    // make the product even so ½·b·h is an integer
    if (height < 12) height += 1; else base += 1;
  }
  const apexX = randInt(1, base - 1);
  const unitLabel = pick(UNIT_POOL);
  return {
    type: 'find_area_triangle_parallelogram',
    figureType: 'triangle',
    base, height, apexX,
    expectedArea: (base * height) / 2,
    unitLabel,
    narration: `${pick(TRIANGLE_CTX)} is shaped like this triangle.`,
    instruction: 'Find the area of this triangle.',
    hint: 'A triangle is half of a rectangle. Area = ½ × base × height. Use the perpendicular (dashed) height, not a slanted side.',
  };
}

function buildParallelogramFA(): RawChallenge {
  const base = randInt(...capDims(4, 14));
  const height = randInt(...capDims(3, 10));
  const skew = randInt(1, 4);
  const unitLabel = pick(UNIT_POOL);
  return {
    type: 'find_area_triangle_parallelogram',
    figureType: 'parallelogram',
    base, height, skew,
    expectedArea: base * height,
    unitLabel,
    narration: `${pick(PARA_CTX)} is shaped like this parallelogram.`,
    instruction: 'Find the area of this parallelogram.',
    hint: 'Area of a parallelogram = base × height. Use the perpendicular (dashed) height.',
  };
}

function buildTrapezoid(variant: TrapezoidVariant = 'isosceles'): RawChallenge {
  const base2 = randInt(...capDims(2, 8));     // top base
  // `extra` = base − base2 (must be ≥ 1 so the top base is genuinely shorter).
  // For isosceles, keep `extra` EVEN so the centered topOffset = extra/2 is an
  // integer; right/scalene place the offset at an integer directly, so any
  // extra ≥ 1 is fine there. Area = ½·(base+base2)·height is independent of the
  // offset; we keep (base+base2)·height even so the area stays an integer.
  // Bound `extra` so the bottom base (base2+extra) also respects the scope cap.
  const extraCeil = activeDimCap ? Math.max(1, activeDimCap.max - base2) : 8;
  const extra = variant === 'isosceles'
    ? 2 * randInt(1, Math.max(1, Math.min(4, Math.floor(extraCeil / 2))))
    : randInt(1, Math.max(1, Math.min(8, extraCeil)));
  const base = base2 + extra;                  // bottom base
  let height = randInt(...capDims(3, 10));
  if (((base + base2) * height) % 2 !== 0) {
    // make (b1+b2)·h even so ½·(b1+b2)·h is an integer
    height = height + 1 <= 10 ? height + 1 : height - 1;
  }
  // topOffset places the top base over the bottom base (0 ≤ off, off+base2 ≤ base):
  //   isosceles → centered (extra/2, even extra so integer);
  //   right     → flush-left (0): one vertical side, single side triangle;
  //   scalene   → off-center integer, NOT centered and NOT 0 (two different side
  //               triangles). Falls back to right/isosceles if extra is too small.
  let topOffset: number;
  if (variant === 'right') {
    topOffset = 0;
  } else if (variant === 'scalene') {
    const centered = extra / 2;
    if (extra >= 2) {
      // pick an integer offset in [1, extra-1] excluding the centered value
      const choices: number[] = [];
      for (let o = 1; o <= extra - 1; o++) if (o !== centered) choices.push(o);
      topOffset = choices.length > 0 ? pick(choices) : 0; // extra=2 has no asym → right
    } else {
      topOffset = 0; // extra=1 → only offset 0 fits → right trapezoid
    }
  } else {
    topOffset = extra / 2; // isosceles (extra is even here)
  }
  const unitLabel = pick(UNIT_POOL);
  // (base + base2) · height is even, so the area is always an integer.
  return {
    type: 'find_area_trapezoid',
    figureType: 'trapezoid',
    base, base2, height, topOffset,
    expectedArea: ((base + base2) * height) / 2,
    unitLabel,
    narration: `${pick(TRAP_CTX)} is shaped like this trapezoid.`,
    instruction: 'Find the area of this trapezoid.',
    hint: 'Average the two bases, then multiply by the height: ½ × (b₁ + b₂) × height.',
  };
}

function buildComposite(pieceCount = 2): RawChallenge {
  const pieces = Math.max(2, Math.min(3, pieceCount)); // FLOOR ≥2; CAP 3
  let parts: CompositeRect[];
  if (pieces >= 3) {
    // 3-rectangle figure: a base spanning the full width, with TWO smaller
    // rectangles stacked on top (a T / plateau outline). Per-piece bands are
    // TIGHTENED vs the 2-piece case so total area does NOT grow with the part
    // count (magnitude held — only the # of decompose-and-sum steps rises).
    const W = randInt(...capDims(5, 8));          // base width (tightened from 5-10)
    const h1 = randInt(2, 3);         // base height (tightened from 2-5)
    const wL = randInt(2, Math.max(2, W - 2)); // left top piece width
    const hL = randInt(2, 3);
    // right top piece sits to the right of the left one; keep it inside W
    const remaining = W - wL;
    const wR = remaining >= 2 ? randInt(2, remaining) : 0;
    const hR = randInt(2, 3);
    parts = [{ x: 0, y: 0, w: W, h: h1 }, { x: 0, y: h1, w: wL, h: hL }];
    if (wR >= 2) {
      parts.push({ x: wL, y: h1, w: wR, h: hR });
    } else {
      // degenerate (no room for a 3rd piece) → fall back to a clean 2-piece L
      parts = [
        { x: 0, y: 0, w: W, h: h1 },
        { x: Math.random() < 0.5 ? 0 : W - wL, y: h1, w: wL, h: hL },
      ];
    }
  } else {
    const W = randInt(...capDims(5, 10));      // bottom rectangle width
    const h1 = randInt(2, 5);      // bottom rectangle height
    const w2 = randInt(2, W - 1);  // top rectangle width (narrower → makes an L)
    const h2 = randInt(2, 5);      // top rectangle height
    const onLeft = Math.random() < 0.5;
    const topX = onLeft ? 0 : W - w2;
    parts = [
      { x: 0, y: 0, w: W, h: h1 },
      { x: topX, y: h1, w: w2, h: h2 },
    ];
  }
  const expectedArea = parts.reduce((s, p) => s + p.w * p.h, 0);
  const unitLabel = pick(UNIT_POOL);
  return {
    type: 'composite_area',
    figureType: 'composite',
    parts,
    expectedArea,
    unitLabel,
    narration: `${pick(COMP_CTX)} is shaped like this figure.`,
    instruction: 'Split the figure into rectangles, find each area, then add them up.',
    hint: parts.length >= 3
      ? 'Break the figure into the rectangles you can see. Find length × width for each piece, then add all the areas.'
      : 'Break the L-shape into two rectangles. Find length × width for each piece, then add the two areas.',
  };
}

function buildCoordinate(variant: CoordinateVariant): RawChallenge {
  const x0 = randInt(0, 3);
  const y0 = randInt(0, 3);
  let vertices: PolygonVertex[];
  let expectedArea: number;
  if (variant === 'rectangle') {
    const w = randInt(...capDims(3, 8));
    const h = randInt(...capDims(2, 6));
    vertices = [
      { x: x0, y: y0 },
      { x: x0 + w, y: y0 },
      { x: x0 + w, y: y0 + h },
      { x: x0, y: y0 + h },
    ];
    expectedArea = w * h;
  } else if (variant === 'l_shape') {
    // Axis-aligned L-shaped HEXAGON (6 integer vertices, first quadrant). Built
    // as a full-width base rectangle (W × hB) with a taller column (wC × hC) on
    // one side — a rectilinear L, so the shoelace area is ALWAYS an integer
    // (= W·hB + wC·hC). Coordinate range is held in the existing small band so
    // adding vertices does NOT grow magnitude.
    const W = randInt(...capDims(4, 7));          // overall base width
    const hB = randInt(2, 3);         // base strip height
    const wC = randInt(2, Math.max(2, W - 2)); // column width (< W → makes the notch)
    const hC = randInt(2, 4);         // column extra height above the base
    const onLeft = Math.random() < 0.5;
    // Walk the outline counter-clockwise from the origin corner.
    vertices = onLeft
      ? [
          { x: x0,          y: y0 },
          { x: x0 + W,      y: y0 },
          { x: x0 + W,      y: y0 + hB },
          { x: x0 + wC,     y: y0 + hB },
          { x: x0 + wC,     y: y0 + hB + hC },
          { x: x0,          y: y0 + hB + hC },
        ]
      : [
          { x: x0,          y: y0 },
          { x: x0 + W,      y: y0 },
          { x: x0 + W,      y: y0 + hB + hC },
          { x: x0 + W - wC, y: y0 + hB + hC },
          { x: x0 + W - wC, y: y0 + hB },
          { x: x0,          y: y0 + hB },
        ];
    expectedArea = W * hB + wC * hC;
  } else {
    let a = randInt(...capDims(3, 8));   // horizontal leg
    let b = randInt(...capDims(2, 7));   // vertical leg
    if ((a * b) % 2 !== 0) { if (b < 7) b += 1; else a += 1; } // even product → integer area
    vertices = [
      { x: x0, y: y0 },
      { x: x0 + a, y: y0 },
      { x: x0, y: y0 + b },
    ];
    expectedArea = (a * b) / 2;
  }
  return {
    type: 'coordinate_polygon',
    figureType: 'coordinate',
    vertices,
    expectedArea,
    unitLabel: 'units',
    narration: `${pick(COORD_CTX)} — find its area from the corner coordinates.`,
    instruction: 'Find the area of this polygon using its vertex coordinates.',
    hint: variant === 'l_shape'
      ? 'Break the L into two rectangles using the corner coordinates. Find length × width for each, then add them.'
      : 'Count the width and height between corners. A rectangle is width × height; a right triangle is ½ × base × height.',
  };
}

// ---- Canonical key for de-duplication within a session ----

function canonicalKey(ch: RawChallenge): string {
  switch (ch.type) {
    case 'decompose':
    case 'find_area_triangle_parallelogram':
      return `${ch.figureType}|${ch.base}|${ch.height}|${ch.skew ?? ch.apexX ?? 0}`;
    case 'find_area_trapezoid':
      return `trap|${ch.base}|${ch.base2}|${ch.height}`;
    case 'composite_area':
      return `comp|${(ch.parts ?? []).map((p) => `${p.x},${p.y},${p.w},${p.h}`).join(';')}`;
    case 'coordinate_polygon':
      return `coord|${(ch.vertices ?? []).map((v) => `${v.x},${v.y}`).join(';')}`;
  }
}

// ---------------------------------------------------------------------------
// Build N distinct challenges for a single-mode session
// ---------------------------------------------------------------------------

export function selectPolygonAreaChallenges(
  challengeType: PolygonAreaChallengeType,
  count?: number,
  tier: SupportTier | null = null,
): PolygonAreaChallenge[] {
  const target = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, count ?? COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT),
  );

  // Axis 2: when a tier is present, the structural shape is FIXED per the brief
  // (trapezoid asymmetry / composite piece-count / coordinate vertex-count /
  // triangle-vs-parallelogram bias). No tier → byte-identical legacy behaviour.
  const shape = tier ? resolveProblemShape(challengeType, tier) : null;

  const builderFor = (): RawChallenge => {
    switch (challengeType) {
      case 'decompose':
        return buildDecompose();
      case 'find_area_trapezoid':
        return buildTrapezoid(shape?.trapezoidVariant);
      case 'composite_area':
        return buildComposite(shape?.pieceCount);
      default:
        // never reached for the two multi-variant modes below
        return buildTrapezoid(shape?.trapezoidVariant);
    }
  };

  const raw: RawChallenge[] = [];
  const seen = new Set<string>();

  if (challengeType === 'find_area_triangle_parallelogram') {
    // Variance rule (FLOOR): guarantee at least one triangle AND one
    // parallelogram so the mode keeps its identity at every tier. The tier's
    // triangleBias re-weights only the REMAINING slots (axis-2 step-depth).
    const bias = shape?.triangleBias ?? 0.5;
    const pickVariant = (): (() => RawChallenge) =>
      Math.random() < bias ? buildTriangleFA : buildParallelogramFA;
    const queue: Array<() => RawChallenge> = [buildTriangleFA, buildParallelogramFA];
    let i = 0;
    for (let attempt = 0; attempt < target * 10 && raw.length < target; attempt++) {
      const ch = (i < queue.length ? queue[i] : pickVariant())();
      i++;
      const key = canonicalKey(ch);
      if (seen.has(key)) continue;
      seen.add(key);
      raw.push(ch);
    }
  } else if (challengeType === 'coordinate_polygon') {
    if (shape?.coordinateVariant) {
      // Tier fixes the vertex-count variant (the structural lever IS the
      // variant): every figure this session is the same shape family; the
      // randInt dimensions provide the within-tier variety.
      const v = shape.coordinateVariant;
      for (let attempt = 0; attempt < target * 12 && raw.length < target; attempt++) {
        const ch = buildCoordinate(v);
        const key = canonicalKey(ch);
        if (seen.has(key)) continue;
        seen.add(key);
        raw.push(ch);
      }
    } else {
      // No tier: legacy variance rule — rotate rectangle / right-triangle.
      const variants: Array<CoordinateVariant> = ['rectangle', 'right_triangle'];
      let i = 0;
      for (let attempt = 0; attempt < target * 10 && raw.length < target; attempt++) {
        const v = i < variants.length ? variants[i] : (Math.random() < 0.5 ? 'rectangle' : 'right_triangle');
        i++;
        const ch = buildCoordinate(v);
        const key = canonicalKey(ch);
        if (seen.has(key)) continue;
        seen.add(key);
        raw.push(ch);
      }
    }
  } else {
    for (let attempt = 0; attempt < target * 10 && raw.length < target; attempt++) {
      const ch = builderFor();
      const key = canonicalKey(ch);
      if (seen.has(key)) continue;
      seen.add(key);
      raw.push(ch);
    }
  }

  // Fallback — accept duplicates if the candidate space was too narrow.
  while (raw.length < target) {
    if (challengeType === 'find_area_triangle_parallelogram') {
      const bias = shape?.triangleBias ?? 0.5;
      raw.push(Math.random() < bias ? buildTriangleFA() : buildParallelogramFA());
    } else if (challengeType === 'coordinate_polygon') {
      raw.push(buildCoordinate(shape?.coordinateVariant ?? (Math.random() < 0.5 ? 'rectangle' : 'right_triangle')));
    } else {
      raw.push(builderFor());
    }
  }

  // Easier → harder by area magnitude.
  const sorted = raw.sort((a, b) => a.expectedArea - b.expectedArea);
  return sorted.map((ch, i) => ({ ...ch, id: `pab-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Build a MIXED session that interleaves all five tiers (Auto path only)
// ---------------------------------------------------------------------------

// Dispatch to the right per-type builder. The two multi-variant tiers pick a
// variant at random so a mixed session shows figure variety within a tier too.
// When a support tier is present, each type's axis-2 structural shape is applied
// (trapezoid asymmetry / composite piece-count / coordinate vertex-count /
// triangle bias) so a blended session still carries the structural difficulty.
function buildForType(type: PolygonAreaChallengeType, tier: SupportTier | null = null): RawChallenge {
  const shape = tier ? resolveProblemShape(type, tier) : null;
  switch (type) {
    case 'decompose':
      return buildDecompose();
    case 'find_area_triangle_parallelogram':
      return Math.random() < (shape?.triangleBias ?? 0.5) ? buildTriangleFA() : buildParallelogramFA();
    case 'find_area_trapezoid':
      return buildTrapezoid(shape?.trapezoidVariant);
    case 'composite_area':
      return buildComposite(shape?.pieceCount);
    case 'coordinate_polygon':
      return buildCoordinate(shape?.coordinateVariant ?? (Math.random() < 0.5 ? 'rectangle' : 'right_triangle'));
  }
}

export function selectMixedPolygonAreaChallenges(count?: number, tier: SupportTier | null = null): PolygonAreaChallenge[] {
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

  for (let attempt = 0; attempt < target * 10 && raw.length < target; attempt++) {
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

  // Scale difficulty low → high: tier rank is the primary key, area magnitude
  // the tiebreaker within a tier.
  const sorted = raw.sort((a, b) => {
    const dr = TIER_RANK[a.type] - TIER_RANK[b.type];
    return dr !== 0 ? dr : a.expectedArea - b.expectedArea;
  });
  return sorted.map((ch, i) => ({ ...ch, id: `pab-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Post-validation: recompute every expectedArea from its geometry.
// Pool builds locally, so this is a self-check that guards against drift.
// ---------------------------------------------------------------------------

function recomputeArea(ch: PolygonAreaChallenge): number | null {
  switch (ch.type) {
    case 'decompose':
      return (ch.base ?? 0) * (ch.height ?? 0);
    case 'find_area_triangle_parallelogram':
      return ch.figureType === 'triangle'
        ? ((ch.base ?? 0) * (ch.height ?? 0)) / 2
        : (ch.base ?? 0) * (ch.height ?? 0);
    case 'find_area_trapezoid':
      return ((ch.base ?? 0) + (ch.base2 ?? 0)) * (ch.height ?? 0) / 2;
    case 'composite_area':
      return (ch.parts ?? []).reduce((s, p) => s + p.w * p.h, 0);
    case 'coordinate_polygon':
      return ch.vertices && ch.vertices.length >= 3 ? shoelace(ch.vertices) : null;
  }
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const polygonAreaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-figure polygon-area session (e.g., 'Finding the Area of Polygons'). Do NOT name specific dimensions — the session walks through several figures.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: [
        'decompose',
        'find_area_triangle_parallelogram',
        'find_area_trapezoid',
        'composite_area',
        'coordinate_polygon',
      ],
      description: "Difficulty tier of the session. The system uses this to build the figure pool.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['6', '7'],
      description: "Target grade band (6 or 7).",
    },
  },
  required: ['title', 'description', 'challengeType'],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type PolygonAreaBuilderConfig = {
    instanceCount?: number;
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which figure family,
     * difficulty = how much decomposition scaffolding within it. NEVER changes the
     * polygon's dimensions.
     */
    difficulty?: string;
};

export const generatePolygonAreaBuilder = async (
  ctx: GenerationContext,
): Promise<PolygonAreaBuilderData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as PolygonAreaBuilderConfig;
  const validTypes: PolygonAreaChallengeType[] = [
    'decompose',
    'find_area_triangle_parallelogram',
    'find_area_trapezoid',
    'composite_area',
    'coordinate_polygon',
  ];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'polygon-area-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(polygonAreaSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : polygonAreaSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Resolve the support tier (the STUDENT's tier — drives application below) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType is for prompt TONE only (a mixed/auto session has no single type).
  const pinnedType: PolygonAreaChallengeType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as PolygonAreaChallengeType)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  // Fold BOTH axes of config.difficulty into one coherent tier block: the
  // scaffolding gradient (axis 1) and the structural problem shape (axis 2). The
  // wrapper LLM only writes the title/description — code builds the actual
  // figures — so these lines steer the SESSION-level prose, not the geometry.
  const tierShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier)
    : null;
  const tierLines = tierScaffold
    ? [...tierScaffold.promptLines, ...(tierShape?.promptLines ?? [])]
    : [];
  const tierSection = tierLines.length
    ? `\n## WITHIN-MODE DIFFICULTY (scaffolding level + structural problem shape — NOT figure size)\n${tierLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const prompt = `
Create the wrapper metadata for a multi-figure polygon-area session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A polygon-area session contains several separate geometric figures the student finds the area of.
- The system has ALREADY pre-built each figure (dimensions, coordinates, rectangle pieces) — you do NOT pick numbers, lengths, or coordinates.
- Your job is only to write the session-level title and description, and to set the challengeType + gradeBand.

${challengeTypeSection}
${tierSection}
REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific dimension or area value.
2. Provide a 1-2 sentence educational description of what students will practice.
3. Set challengeType to the correct difficulty tier (matches the constraint above).
4. Set gradeBand to "6" or "7".

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('PolygonAreaBuilder', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid polygon-area wrapper returned from Gemini API');
  }

  // ── Auto (mixed) path: no eval-mode constraint → interleave ALL five tiers,
  //    scaled easy→hard, as a single longer session (SP-21). IRT-pinned modes
  //    always have a constraint and fall through to the single-type path below.
  const isMixed = evalConstraint === null;

  // ── Resolve challengeType (Gemini → eval constraint → safe default) ──
  // For mixed sessions this is representative metadata only: the component
  // renders per-challenge from `currentChallenge.type`, never the top-level field.
  let challengeType: PolygonAreaChallengeType = isMixed
    ? 'decompose' // lowest tier — where the mixed session begins
    : validTypes.includes(wrapper.challengeType as PolygonAreaChallengeType)
      ? (wrapper.challengeType as PolygonAreaChallengeType)
      : (evalConstraint?.allowedTypes[0] as PolygonAreaChallengeType) ?? 'find_area_triangle_parallelogram';
  if (!validTypes.includes(challengeType)) challengeType = 'find_area_triangle_parallelogram';

  // ── Tier-2: narrow the code-owned side-length band to the lesson scope (CLASS-3) ──
  // Dimensions are code-picked for variety; intent can't reach them via the prompt. Resolve
  // a {min,max} for the side lengths from topic+intent. Ceiling = widest builder span (2..16)
  // → narrow-only; null → grade default. Post-validation recomputes area, so correct always.
  const dimCap = await resolveScopeRange(
    ctx.scope,
    gradeLevel,
    'the polygon side lengths (base, height, and vertex spans)',
    { min: 2, max: 16 },
  );
  if (dimCap) console.log(`▱ Polygon Area dimension cap → ${dimCap.min}..${dimCap.max} (from intent)`);

  // ── Build the per-challenge pool locally ──
  // Axis 2: pass supportTier so the constructive builders make the structurally
  // HARDER shape per tier (trapezoid asymmetry / composite piece-count /
  // coordinate vertex-count / triangle bias). supportTier is null when
  // config.difficulty is absent → byte-identical legacy figures. activeDimCap is read by
  // the builders' capDims; set it across the SYNCHRONOUS selection only, then clear it.
  activeDimCap = dimCap;
  const challenges = isMixed
    ? selectMixedPolygonAreaChallenges(config?.instanceCount, supportTier)
    : selectPolygonAreaChallenges(challengeType, config?.instanceCount, supportTier);
  activeDimCap = null;

  // ── Post-validation: every expectedArea must match its geometry ──
  for (const ch of challenges) {
    const recomputed = recomputeArea(ch);
    if (recomputed === null || Math.abs(recomputed - ch.expectedArea) > 1e-6) {
      console.warn(`[PolygonAreaBuilder] Area mismatch on ${ch.id} (${ch.figureType}): stored ${ch.expectedArea}, recomputed ${recomputed}. Correcting.`);
      if (recomputed !== null) ch.expectedArea = recomputed;
    }
  }

  // ── Apply the support tier PER CHALLENGE (each from its OWN type) ──
  // Gated only on a tier being present, so a blended/auto session gets it too.
  // SCAFFOLDING ONLY: writes show* display flags + supportTier; never touches a
  // dimension or expectedArea (the checker reads expectedArea, independent of any
  // flag — the answer can't leak or be invalidated by a withdrawn scaffold).
  if (supportTier) {
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      ch.showDecompositionGuides = sc.showDecompositionGuides;
      ch.showRegionAreaLabel = sc.showRegionAreaLabel;
      ch.showGridOverlay = sc.showGridOverlay;
      ch.supportTier = supportTier;
    }
    console.log(
      `[PolygonAreaBuilder] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'mixed'})`,
    );
  }

  const gradeBand: '6' | '7' = isMixed
    ? '7' // mixed sessions reach the Grade 7 coordinate-polygon tier
    : wrapper.gradeBand === '7' || wrapper.gradeBand === '6'
      ? wrapper.gradeBand
      : (challengeType === 'coordinate_polygon' ? '7' : '6');

  const data: PolygonAreaBuilderData = {
    title: wrapper.title,
    description: wrapper.description,
    challengeType,
    gradeBand,
    challenges,
  };

  const summary = challenges
    .map((c) => `${c.figureType}=${c.expectedArea}${c.unitLabel}²`)
    .join(', ');
  console.log(`[PolygonAreaBuilder] Final: challengeType=${challengeType}, instances=${challenges.length} [${summary}]`);

  return data;
};
