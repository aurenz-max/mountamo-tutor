/**
 * Array Grid Generator — multi-instance pool-service generator.
 *
 * Each session walks the student through 3-4 distinct (rows, columns) pairs in
 * the SAME eval mode. Per PRD §6a #1, array-grid is value-only (per-challenge
 * data is just (rows, columns)), so we follow the pool-service pattern
 * (factor-tree, place-value-chart, area-model precedent):
 *  - Gemini emits ONLY wrapper metadata (title, description, display flags).
 *  - Local code deterministically builds N ArrayGridChallenge tuples per
 *    mode-appropriate dimension ranges.
 *  - Structured-output Gemini converges per-call (PRD §6a #2), so any
 *    per-challenge variance comes from local randomness, not the prompt.
 */

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

// Single source of truth for the data type lives in the component file.
import {
  ArrayGridData,
  ArrayGridChallenge,
  ArrayGridChallengeType,
  ArrayGridIconType,
} from "../../primitives/visual-primitives/math/ArrayGrid";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build_array: {
    promptDoc:
      `"build_array": Student builds an array with given row and column counts. `
      + `Concrete manipulative — small dimensions (2-5). Grades 2-3.`,
    schemaDescription: "'build_array' (build array with given dimensions)",
  },
  count_array: {
    promptDoc:
      `"count_array": Array is displayed pre-built, student counts the total. `
      + `Skip counting or multiplication. Grades 2-3.`,
    schemaDescription: "'count_array' (count total from displayed array)",
  },
  multiply_array: {
    promptDoc:
      `"multiply_array": Array is shown, student writes the multiplication sentence (rows × columns = total). Grades 3-4.`,
    schemaDescription: "'multiply_array' (write multiplication sentence from array)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — SECOND AXIS of the contract.
//   targetEvalMode = WHICH skill;  difficulty = HOW MUCH on-screen support.
// A tier withdraws SCAFFOLDING, never changes the (rows, columns) numbers —
// those are owned entirely by dimensionRangeFor / selectDimensionPairs.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * ArrayGrid's support levers (discovered from the component, ArrayGrid.tsx):
 *  - showLabels (perception #1): row/column index labels number the DIMENSIONS,
 *    never the product → always answer-safe.
 *  - strategyHint (instruction #2): number-free tip naming the approach.
 * Both are session-level (array-grid runs one mode per session).
 */
interface ArrayGridSupportScaffold {
  /** Axis index labels (rows 1..R / columns 1..C). */
  showLabels: boolean;
  /** Strategy-naming hint shown under the task header. null = withdrawn. */
  strategyHint: string | null;
  /** Prompt lines describing the tier to the LLM (title/description tone only). */
  promptLines: string[];
}

/** Number-free, answer-free strategy tips — names the approach, not the result. */
const STRATEGY_HINT_BY_MODE: Record<ArrayGridChallengeType, string> = {
  build_array:
    'Set the rows first, then the columns, then count every item to find the total.',
  count_array:
    'Skip-count one row at a time instead of counting each item one by one.',
  multiply_array:
    'Count how many rows, then how many are in each row — then multiply those two numbers.',
};

/**
 * Map easy→hard to the on-screen scaffold. The gradient withdraws SUPPORT only:
 *   easy   = axis labels ON  + strategy tip shown
 *   medium = axis labels ON  + tip withdrawn (student recalls the approach)
 *   hard   = axis labels OFF + tip withdrawn (count rows/columns unaided)
 */
function resolveSupportStructure(
  type: ArrayGridChallengeType,
  tier: SupportTier,
): ArrayGridSupportScaffold {
  const hint = STRATEGY_HINT_BY_MODE[type];
  const base =
    'This tier changes ON-SCREEN SUPPORT only — never the row/column counts or the product (the dimension ranges own those).';
  switch (tier) {
    case 'easy':
      return {
        showLabels: true,
        strategyHint: hint,
        promptLines: [
          base,
          'EASY: axis labels number every row and column, and a strategy tip is shown. Write a warm, encouraging title/description that invites the student in.',
        ],
      };
    case 'medium':
      return {
        showLabels: true,
        strategyHint: null,
        promptLines: [
          base,
          'MEDIUM: axis labels stay on but the strategy tip is withdrawn — the student recalls the approach. Keep the title/description neutral and matter-of-fact.',
        ],
      };
    case 'hard':
      return {
        showLabels: false,
        strategyHint: null,
        promptLines: [
          base,
          'HARD: no axis labels and no strategy tip — the student counts rows and columns unaided and justifies the total. Keep the title/description brief and challenge-oriented.',
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Wrapper schema — Gemini emits session-level metadata only.
// Per-challenge (rows, columns) pairs are built locally below.
// ---------------------------------------------------------------------------

const arrayGridWrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: {
      type: Type.STRING,
      enum: ["build_array", "count_array", "multiply_array"],
      description:
        "Challenge type controlling difficulty: 'build_array' (2-3), 'count_array' (2-3), 'multiply_array' (3-4).",
    },
    title: {
      type: Type.STRING,
      description:
        "Short session title. MUST NOT contain multiplication notation like \"3 × 5\" or specific numbers — the session uses multiple (rows, columns) pairs (e.g. 'Star Array Challenge', 'Build Arrays', 'Count the Stars').",
    },
    description: {
      type: Type.STRING,
      description:
        "1-2 sentence warm introduction motivating arrays-as-multiplication (or repeated addition, depending on grade). MUST NOT contain specific numbers — the session covers multiple pairs.",
    },
    iconType: {
      type: Type.STRING,
      enum: ["dot", "square", "star"],
      description:
        "Display icon: 'star' (engaging for young students), 'dot' (general), 'square' (area-like contexts).",
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Grade level string (e.g., 'Grade 3').",
    },
  },
  required: ["challengeType", "title", "description"],
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a

const DEFAULT_INSTANCE_COUNT = 7; // tier fallback (T1)
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<ArrayGridChallengeType, number> = {
  build_array: 5,
  count_array: 7,
  multiply_array: 7,
};

// Component-side caps (the row/column button panels max out at these counts).
const ROW_BUTTON_CAP = 6;
const COL_BUTTON_CAP = 8;

// Smallest number of DISTINCT array cards a session may ship. Below this the
// constraint set is unusable (the oracle also flags <3 as a demo-sized set), so
// the ceiling is relaxed rather than the same card repeated. See MIN-CARDS guard.
const MIN_DISTINCT_CARDS = 3;

// ---------------------------------------------------------------------------
// Local randomness helpers (Gemini convergence per PRD §6a #2)
// ---------------------------------------------------------------------------

interface DimensionPair {
  rows: number;
  columns: number;
}

function canonKey(a: number, b: number): string {
  // Treat (3,5) and (5,3) as the same shape for dedup — commutative property.
  return a <= b ? `${a}x${b}` : `${b}x${a}`;
}

/** Ordered identity — what the student actually sees. (3,5) ≠ (5,3): different
 *  visual, and different rows/columns answers in multiply_array. Two challenges
 *  sharing this key are a byte-identical card (the oracle's clustering check). */
function cardKey(p: DimensionPair): string {
  return `${p.rows}x${p.columns}`;
}

/** Fisher-Yates. The admissible set is enumerated deterministically, so this is
 *  the only source of between-session variance. */
function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Parse a PRODUCT ceiling ("to 20", "within 25", "up to 12") from the lesson
 * scope. The dimensions are code-owned and `resolveScopeRange` only narrows the
 * dimension band — it never bounds the PRODUCT, and it doesn't fire topic-only.
 * But "multiplication to 20" is a product ceiling: a 6×8 array has fine
 * dimensions yet a product of 48. We scan the topic + objective + intent for the
 * same `to|within|up to N` bound the oracle checks (service/qa/oracles/helpers
 * parseScopeCeiling), so the generator and the content check agree. Returns
 * undefined when no bound is stated → the grade-band dimension ranges stand.
 */
function parseProductCeiling(scope: {
  topic?: string;
  objectiveText?: string;
  intent?: string;
}): number | undefined {
  const text = [scope.topic, scope.objectiveText, scope.intent].filter(Boolean).join(' ');
  const m = text.match(/\b(?:to|within|up to)\s+(\d{1,4})\b/i);
  return m ? parseInt(m[1], 10) : undefined;
}

// ---------------------------------------------------------------------------
// Per-mode dimension generators
// ---------------------------------------------------------------------------

/**
 * Returns the (min, max) dimension range for the given challenge type.
 * Honors the button-panel caps so the UI can render every pair.
 */
function dimensionRangeFor(
  type: ArrayGridChallengeType,
): { rowMin: number; rowMax: number; colMin: number; colMax: number } {
  switch (type) {
    case 'build_array':
      // Concrete manipulative — keep dimensions small so building is quick.
      return { rowMin: 2, rowMax: 5, colMin: 2, colMax: 5 };
    case 'count_array':
      // Slightly larger so skip-counting feels useful.
      return { rowMin: 2, rowMax: 6, colMin: 3, colMax: 8 };
    case 'multiply_array':
      // Multiplication facts through 6 × 8.
      return { rowMin: 2, rowMax: 6, colMin: 2, colMax: 8 };
  }
}

interface DimensionBand {
  rowMin: number;
  rowMax: number;
  colMin: number;
  colMax: number;
}

/** Apply the Tier-2 scope cap to a mode's grade band. Narrows ONLY — never widens
 *  past the mode's band — and stays inside the component's button panels so every
 *  emitted pair is selectable in build mode. */
function narrowBand(type: ArrayGridChallengeType, cap?: { min: number; max: number }): DimensionBand {
  let { rowMin, rowMax, colMin, colMax } = dimensionRangeFor(type);
  if (cap) {
    rowMax = Math.min(rowMax, cap.max);
    colMax = Math.min(colMax, cap.max);
    rowMin = Math.min(Math.max(rowMin, cap.min), rowMax);
    colMin = Math.min(Math.max(colMin, cap.min), colMax);
  }
  return {
    rowMin,
    rowMax: Math.min(rowMax, ROW_BUTTON_CAP),
    colMin,
    colMax: Math.min(colMax, COL_BUTTON_CAP),
  };
}

/**
 * Every (rows, columns) card the band + product ceiling admit, split by shape.
 *
 * The whole space is at most 6×8 = 48 pairs, so we ENUMERATE it rather than
 * rejection-sample. Rejection sampling was the bug this replaced: when the
 * constraints admitted few (or zero) non-square pairs, the sampler exhausted its
 * attempt budget and fell through to a fallback that dropped the non-square AND
 * dedup guards, shipping the same card N times ("2×2" on every problem).
 */
function enumerateAdmissible(
  band: DimensionBand,
  productMax?: number,
): { nonSquare: DimensionPair[]; squares: DimensionPair[]; total: number } {
  const nonSquare: DimensionPair[] = [];
  const squares: DimensionPair[] = [];
  for (let rows = Math.max(2, band.rowMin); rows <= band.rowMax; rows++) {
    for (let columns = Math.max(2, band.colMin); columns <= band.colMax; columns++) {
      // Trivial 1×N / N×1 arrays are excluded by the max(2, …) floors above.
      if (productMax !== undefined && rows * columns > productMax) continue;
      (rows === columns ? squares : nonSquare).push({ rows, columns });
    }
  }
  return { nonSquare, squares, total: nonSquare.length + squares.length };
}

/**
 * MIN-CARDS guard. A product ceiling this primitive cannot express is not a
 * usable ceiling: the smallest non-square array is 2×3 = 6, so any ceiling below
 * 6 admits nothing but 2×2 and collapses the session onto one card.
 *
 * That happens for real lesson text, because the ceiling is regex-read from prose
 * (parseProductCeiling): "build arrays up to 4 rows" and "relate repeated addition
 * to 4 equal groups" bound a DIMENSION or a GROUP COUNT, not a product, yet both
 * yield productMax = 4.
 *
 * Rather than drop the bound outright, raise it to the SMALLEST value that admits
 * `target` distinct cards — the least relaxation that still lets the session teach.
 * Per the trust-intent rule, a cap that starves the visual is a bug in the cap, and
 * of every input here the regex-read ceiling is the least trustworthy: the band
 * comes from a schema-constrained resolver, the session length is a product
 * requirement. So the ceiling is what yields. Returns undefined (no product bound)
 * when even the unbounded band cannot reach `target`.
 */
function relaxProductCeiling(
  band: DimensionBand,
  productMax: number | undefined,
  target: number,
): number | undefined {
  if (productMax === undefined) return undefined;
  if (enumerateAdmissible(band, productMax).total >= target) return productMax;
  const bandMaxProduct = band.rowMax * band.colMax;
  for (let p = productMax + 1; p <= bandMaxProduct; p++) {
    if (enumerateAdmissible(band, p).total >= target) return p;
  }
  return undefined;
}

/**
 * Second-stage guard. When the DIMENSION band alone (ceiling already dropped)
 * cannot supply MIN_DISTINCT_CARDS — e.g. a {min:2,max:3} scope cap leaves
 * count_array with just 2×3 and 3×3 — widen it back toward the mode's grade band.
 * Same trust-intent logic as above, applied one level up; a scope cap that leaves
 * the primitive unable to present its own subject matter is not a usable cap.
 */
function widenBandToFloor(type: ArrayGridChallengeType, band: DimensionBand): DimensionBand {
  const full = dimensionRangeFor(type);
  const rowCeil = Math.min(full.rowMax, ROW_BUTTON_CAP);
  const colCeil = Math.min(full.colMax, COL_BUTTON_CAP);
  const widened = { ...band };
  while (enumerateAdmissible(widened, undefined).total < MIN_DISTINCT_CARDS) {
    if (widened.rowMax >= rowCeil && widened.colMax >= colCeil) break;
    if (widened.rowMax < rowCeil) widened.rowMax++;
    if (widened.colMax < colCeil) widened.colMax++;
  }
  return widened;
}

/**
 * Pick up to `count` DISTINCT array cards, in descending order of pedagogical
 * preference. No tier ever repeats an ordered (rows, columns) pair — if the
 * admissible set is smaller than `count` the session is SHORTENED, never padded
 * with a duplicate card.
 *
 *  1. distinct non-square SHAPES (one of 2×3 / 3×2, one of 3×4 / 4×3, …) —
 *     maximum product spread, and rows stay visibly distinguishable from columns.
 *  2. squares (3×3) — a distinct card carrying a product no other tier supplies.
 *  3. commutative reflections (5×3 after 3×5) — distinct student tasks (different
 *     visual, different rows/columns answers), but they REPEAT a product, so they
 *     come last: the oracle's variety check wants products to spread.
 */
function selectDimensionPairs(
  type: ArrayGridChallengeType,
  count: number,
  /** Tier-2 scope cap (from resolveScopeRange). Narrows the per-mode dimension band
   *  to the lesson's scope; absent → the mode's grade-band default stands. */
  cap?: { min: number; max: number },
  /** Objective PRODUCT ceiling (rows × columns) from parseProductCeiling. A pair
   *  whose product exceeds it is out of scope ("multiplication to 20" → 5×8=40 is
   *  past the objective); absent → no product bound. Narrows only, and is subject
   *  to the MIN-CARDS guard above. */
  productMax?: number,
): DimensionPair[] {
  const requested = narrowBand(type, cap);

  // Stage 1 — yield the (regex-read, least trustworthy) product ceiling first.
  let band = requested;
  let effectiveMax = relaxProductCeiling(band, productMax, count);
  // Stage 2 — if the band ALONE still can't reach the floor, widen the band too.
  if (enumerateAdmissible(band, effectiveMax).total < MIN_DISTINCT_CARDS) {
    band = widenBandToFloor(type, band);
    effectiveMax = relaxProductCeiling(band, productMax, count);
  }

  if (productMax !== undefined && effectiveMax !== productMax) {
    console.warn(
      `⊞ Array Grid product ceiling ${productMax} admits too few distinct arrays in band `
      + `${requested.rowMin}-${requested.rowMax} × ${requested.colMin}-${requested.colMax} — `
      + `relaxed to ${effectiveMax ?? 'none'}. (A "to N" in the scope text may bound rows or groups, not the product.)`,
    );
  }
  if (band !== requested) {
    console.warn(
      `⊞ Array Grid scope cap left only ${enumerateAdmissible(requested, undefined).total} arrays in band `
      + `${requested.rowMin}-${requested.rowMax} × ${requested.colMin}-${requested.colMax} — `
      + `widened to ${band.rowMin}-${band.rowMax} × ${band.colMin}-${band.colMax}.`,
    );
  }

  const { nonSquare, squares } = enumerateAdmissible(band, effectiveMax);

  const picked: DimensionPair[] = [];
  const usedShapes = new Set<string>();
  const usedCards = new Set<string>();

  const take = (pair: DimensionPair) => {
    usedShapes.add(canonKey(pair.rows, pair.columns));
    usedCards.add(cardKey(pair));
    picked.push(pair);
  };

  // 1 — one card per distinct non-square shape.
  for (const pair of shuffle(nonSquare)) {
    if (picked.length >= count) break;
    if (usedShapes.has(canonKey(pair.rows, pair.columns))) continue;
    take(pair);
  }
  // 2 — squares.
  for (const pair of shuffle(squares)) {
    if (picked.length >= count) break;
    take(pair);
  }
  // 3 — commutative reflections of shapes already used.
  for (const pair of shuffle(nonSquare)) {
    if (picked.length >= count) break;
    if (usedCards.has(cardKey(pair))) continue;
    take(pair);
  }

  if (picked.length < count) {
    console.warn(
      `⊞ Array Grid: only ${picked.length} distinct arrays available for ${count} requested `
      + `(band ${band.rowMin}-${band.rowMax} × ${band.colMin}-${band.colMax}`
      + `${effectiveMax !== undefined ? `, product ≤ ${effectiveMax}` : ''}) — shipping a shorter session `
      + `rather than repeating a card.`,
    );
  }

  return picked;
}

// ---------------------------------------------------------------------------
// Build challenges array
// ---------------------------------------------------------------------------

function buildChallenges(
  type: ArrayGridChallengeType,
  count: number,
  cap?: { min: number; max: number },
  productMax?: number,
): ArrayGridChallenge[] {
  const pairs = selectDimensionPairs(type, count, cap, productMax);
  return pairs.map((pair, idx) => ({
    id: `array-grid-${idx + 1}`,
    targetRows: pair.rows,
    targetColumns: pair.columns,
  }));
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

type ArrayGridConfig = Partial<ArrayGridData> & {
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /** Number of challenges in this session. Default 4 (PRD §5 floor). */
    instanceCount?: number;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
     */
    difficulty?: string;
};

export const generateArrayGrid = async (
  ctx: GenerationContext,
): Promise<ArrayGridData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as ArrayGridConfig;
  // ── Eval-mode constraint resolution ──────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'array-grid',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ArrayGrid', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(arrayGridWrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : arrayGridWrapperSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // Derive the mode early so the per-mode instance count can drive the clamp.
  // When the eval constraint pins a single allowed type, use it; otherwise the
  // mode isn't known until Gemini responds, so fall back to DEFAULT.
  const resolvedMode: ArrayGridChallengeType | undefined =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ArrayGridChallengeType)
      : undefined;

  const instanceCount = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      config?.instanceCount
        ?? (resolvedMode ? COUNT_BY_MODE[resolvedMode] : undefined)
        ?? DEFAULT_INSTANCE_COUNT,
    ),
  );

  // ── Within-mode support tier ─────────────────────────────────────
  // supportTier is the STUDENT's tier — it drives the deterministic application
  // at the end. pinnedType (the single resolved mode) only tones the prompt.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType = resolvedMode; // single pinned mode, or undefined when unresolved
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Gemini wrapper call (metadata only) ──────────────────────────
  const prompt = `
Create the wrapper metadata for a MULTI-CHALLENGE array session for "${topic}" (${gradeLevel}).

This session walks the student through ${instanceCount} DIFFERENT (rows, columns) pairs of the SAME challenge type.

${challengeTypeSection}
${tierSection}
DO NOT include specific numbers in the title or description — the system picks ${instanceCount} dimension pairs locally and the same session covers all of them.

GUIDELINES:
- title: short and number-free, e.g., "Star Array Challenge", "Build Some Arrays", "Count the Dots". NO multiplication notation like "3 × 5".
- description: 1-2 sentences warmly introducing the multi-challenge session. Motivate arrays-as-multiplication (or repeated addition for younger grades). NO specific numbers.
- iconType: pick 'star' for K-2 engagement, 'dot' for grades 3+, 'square' for area-like contexts.
- gradeLevel: echo back "${gradeLevel}"

Return ONLY the wrapper metadata in the response schema.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid array grid wrapper returned from Gemini API');
  }

  // ── Local: build challenges array ─────────────────────────────────
  const challengeType: ArrayGridChallengeType =
    (wrapper.challengeType as ArrayGridChallengeType) ||
    (evalConstraint?.allowedTypes[0] as ArrayGridChallengeType) ||
    'build_array';

  // ── Tier-2: narrow the code-owned dimension band to the lesson scope (CLASS-3) ──
  // The dimensions are code-picked for variety, so intent can't reach them via the
  // prompt. Resolve a {min,max} cap from topic+intent and clamp the band. Gated inside
  // resolveScopeRange on scope carrying intent/objective; null → grade-band default
  // (no regression). Ceiling = the component button caps (2..8) so it can only narrow.
  const scopeCap = await resolveScopeRange(
    ctx.scope,
    gradeLevel,
    'the array dimensions (the rows and columns, i.e. the multiplication facts practiced)',
    { min: 2, max: Math.max(ROW_BUTTON_CAP, COL_BUTTON_CAP) },
  );
  if (scopeCap) {
    console.log(`⊞ Array Grid scope cap → ${scopeCap.min}..${scopeCap.max} (from intent)`);
  }

  // Objective PRODUCT ceiling ("multiplication to 20" → 20). Distinct from the
  // dimension cap above: this bounds rows × columns so an in-dimension array
  // (6×8, both within the button panel) can't exceed the objective's fact range.
  const productCeiling = parseProductCeiling(ctx.scope);
  if (productCeiling !== undefined) {
    console.log(`⊞ Array Grid product ceiling → ${productCeiling} (from scope)`);
  }

  const challenges = buildChallenges(challengeType, instanceCount, scopeCap ?? undefined, productCeiling);

  const iconType: ArrayGridIconType =
    (config?.iconType as ArrayGridIconType) ||
    (wrapper.iconType as ArrayGridIconType) ||
    (challengeType === 'multiply_array' ? 'dot' : 'star');

  // ── Apply the support tier deterministically (code owns the scaffold) ──
  // Resolved from the session's actual mode; array-grid is single-mode so the
  // scaffold is session-level. An explicit config.showLabels override wins.
  let showLabels = config?.showLabels !== undefined ? config.showLabels : true;
  let strategyHint: string | undefined;
  if (supportTier) {
    const sc = resolveSupportStructure(challengeType, supportTier);
    if (config?.showLabels === undefined) showLabels = sc.showLabels;
    strategyHint = sc.strategyHint ?? undefined;
    console.log(
      `[ArrayGrid] Support tier "${supportTier}" applied (single-mode ${challengeType}): ` +
        `showLabels=${showLabels}, strategyHint=${strategyHint ? 'shown' : 'withdrawn'}`,
    );
  }

  console.log('⊞ Array Grid generated:', {
    topic,
    challengeType,
    instanceCount: challenges.length,
    pairs: challenges.map((c) => ({ rows: c.targetRows, cols: c.targetColumns })),
  });

  return {
    title: wrapper.title || 'Array Builder',
    description:
      wrapper.description ||
      // challenges.length, not instanceCount — the selector ships a shorter session
      // rather than repeating a card when the scope admits fewer distinct arrays.
      `Practice ${challenges.length} ${challengeType.replace('_', ' ')} problems with arrays.`,
    challenges,
    challengeType,
    iconType,
    showLabels,
    maxRows: config?.maxRows ?? ROW_BUTTON_CAP,
    maxColumns: config?.maxColumns ?? COL_BUTTON_CAP,
    supportTier: supportTier ?? undefined,
    strategyHint,
  };
};
