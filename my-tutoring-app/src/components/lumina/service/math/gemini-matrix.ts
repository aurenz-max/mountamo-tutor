import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

/**
 * Matrix Display Data Interface
 *
 * Multi-instance schema (PRD §6l): a session walks the student through 3-6 matrix
 * problems of the same eval mode, surfaced sequentially with judgment per challenge.
 * Per-challenge data (rows, columns, values, secondMatrix) is pre-selected by the local
 * pool service — Gemini structured output converges per-call, so it cannot deliver
 * variance. Gemini contributes only session-level wrapper metadata.
 */

export type MatrixChallengeType =
  | 'transpose'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'determinant'
  | 'inverse';

export interface MatrixDisplayChallenge {
  id: string;
  challengeType: MatrixChallengeType;
  instruction: string;
  rows: number;
  columns: number;
  values: number[][];
  secondMatrix?: {
    rows: number;
    columns: number;
    values: number[][];
    label?: string;
  };
  /** Pre-computed correct result. Single number for determinant; matrix for others. */
  expectedScalar?: number;
  expectedMatrix?: number[][];
  hint: string;
  /** Support tier (modality #4): when true, "Show steps" is withheld until the student
   *  has made at least one attempt. Undefined/false = available up front. */
  stepsAfterAttempt?: boolean;
}

export interface MatrixDisplayData {
  title: string;
  description: string;
  /** 3-6 challenges. Required. Built in-generator from the local pool service. */
  challenges: MatrixDisplayChallenge[];
  /** Session-level challenge type for AI tutor context. */
  challengeType: MatrixChallengeType;
  /** Educational context narrative, session-level. */
  educationalContext?: string;
  gradeBand?: '7-8' | 'algebra2' | 'precalculus' | 'advanced';
  /** Within-mode support tier when present — surfaced for a future live tutor's reveal
   *  policy (the catalog has a tutoring block; the component is not yet wired). */
  supportTier?: SupportTier;

  // Evaluation props (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvaluationSubmit?: (result: any) => void;
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  transpose: {
    promptDoc:
      `"transpose": Swap rows and columns. Simplest operation. `
      + `Use 2×3 or 3×2 matrices so the shape change is visible to the student.`,
    schemaDescription: "'transpose' (swap rows and columns)",
  },
  add: {
    promptDoc:
      `"add": Element-wise addition of same-dimension matrices. Use small integers.`,
    schemaDescription: "'add' (element-wise addition)",
  },
  subtract: {
    promptDoc:
      `"subtract": Element-wise subtraction. Result can be negative.`,
    schemaDescription: "'subtract' (element-wise subtraction)",
  },
  multiply: {
    promptDoc:
      `"multiply": Row-by-column dot products. Matrix A columns must equal Matrix B rows. `
      + `Use small integers to keep dot-product sums manageable.`,
    schemaDescription: "'multiply' (matrix multiplication)",
  },
  determinant: {
    promptDoc:
      `"determinant": Calculate det(A) for a square matrix. Use integers that produce clean, `
      + `non-zero determinants. 2×2: det = ad − bc. 3×3: rule of Sarrus.`,
    schemaDescription: "'determinant' (calculate determinant)",
  },
  inverse: {
    promptDoc:
      `"inverse": Find A⁻¹ for a 2×2 square matrix with det = ±1 so entries are clean integers. `
      + `A⁻¹ = (1/det) · [[d, −b], [−c, a]].`,
    schemaDescription: "'inverse' (find inverse matrix)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty)
// ---------------------------------------------------------------------------
// Second field of the two-field contract: targetEvalMode = WHICH operation,
// difficulty = HOW MUCH support within it. Drives two axes, both grade/scope-bound:
//   • scaffolding withdrawal — hint detail (modality #2) + "Show steps" gating (#4)
//   • structural problem shape — matrix size / dot-product depth (NEVER the number range)
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface MatrixSupportScaffold {
  /** modality #2 (instruction-as-scaffold): how explicit the per-challenge hint is. */
  hintLevel: 'formula' | 'concept' | 'none';
  /** modality #4 (worked-example fading): when the "Show steps" walkthrough is offered. */
  stepsGating: 'always' | 'afterAttempt';
  promptLines: string[];
}

/** Scaffolding axis — mode-independent (hint + steps apply to every matrix operation).
 *  Structural axis lives in the build functions (grade-clamped per mode). */
function resolveSupportStructure(tier: SupportTier): MatrixSupportScaffold {
  const hintLevel: MatrixSupportScaffold['hintLevel'] =
    tier === 'easy' ? 'formula' : tier === 'medium' ? 'concept' : 'none';
  const stepsGating: MatrixSupportScaffold['stepsGating'] =
    tier === 'hard' ? 'afterAttempt' : 'always';
  return {
    hintLevel,
    stepsGating,
    promptLines: [
      // TIER_GUARDRAIL: support level + structural SIZE only — never the number range or answer.
      'This tier changes only how much on-screen help the student gets and the structural SIZE of each '
        + 'matrix problem (entry count / dot-product depth). It NEVER changes the number range or the answer.',
      `The per-challenge hint is ${
        hintLevel === 'formula' ? 'an explicit formula/rule'
        : hintLevel === 'concept' ? 'a conceptual nudge only — no formula'
        : 'withdrawn entirely — the student recalls the procedure unaided'
      }.`,
      `The "Show steps" walkthrough is ${
        stepsGating === 'always' ? 'offered up front' : 'withheld until the student has attempted the problem'
      }.`,
      'Keep the title and description neutral — never state the support level or reveal an answer.',
    ],
  };
}

/** Conceptual nudge per operation (medium tier) — the idea, with NO formula/symbols. */
function conceptHintFor(type: MatrixChallengeType): string {
  switch (type) {
    case 'transpose': return 'Picture each row of the original turning into a column of the result — track how the shape flips.';
    case 'add': return 'Work position by position: combine the entries that sit in the same spot of each matrix.';
    case 'subtract': return 'Work position by position, keeping the order A then B for each matching spot.';
    case 'multiply': return 'Pair a row of A with a column of B, combine the matching entries, and total them — one result cell at a time.';
    case 'determinant': return 'Think about the two diagonals of the square and how their products combine into a single number.';
    case 'inverse': return 'Rearrange the four entries and scale by the determinant — watch the signs as you go.';
  }
}

// ---------------------------------------------------------------------------
// Pool builders (one per challenge type)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// Matrix is T2, but per-mode interaction is heavier than other T2 entries —
// the §5a table holds matrix at 4 (not the T2 default of 5). B4 sweep bumps
// every mode 3 → 4.

const DEFAULT_INSTANCE_COUNT = 4; // matrix-specific T2 fallback (see §5a note)
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<MatrixChallengeType, number> = {
  transpose: 4,    // T2 — B4 bump 3 → 4
  add: 4,          // T2 — B4 bump 3 → 4
  subtract: 4,     // T2 — B4 bump 3 → 4
  multiply: 4,     // T2 — B4 bump 3 → 4
  determinant: 4,  // T2 — B4 bump 3 → 4
  inverse: 4,      // T2 — B4 bump 3 → 4
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randInRange(min: number, max: number, excludeZero = false): number {
  let v = randInt(min, max);
  if (excludeZero && v === 0) v = v === 0 ? randInt(1, max) : v;
  return v;
}

function makeMatrix(rows: number, cols: number, min: number, max: number, excludeZero = false): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) row.push(randInRange(min, max, excludeZero));
    m.push(row);
  }
  return m;
}

function transposeMatrix(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const out: number[][] = [];
  for (let j = 0; j < cols; j++) {
    out.push([]);
    for (let i = 0; i < rows; i++) out[j].push(m[i][j]);
  }
  return out;
}

function addMatrices(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

function subtractMatrices(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((v, j) => v - b[i][j]));
}

function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const ar = a.length;
  const ac = a[0].length;
  const bc = b[0].length;
  const out: number[][] = [];
  for (let i = 0; i < ar; i++) {
    const row: number[] = [];
    for (let j = 0; j < bc; j++) {
      let s = 0;
      for (let k = 0; k < ac; k++) s += a[i][k] * b[k][j];
      row.push(s);
    }
    out.push(row);
  }
  return out;
}

function determinant2x2(m: number[][]): number {
  return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}

function determinant3x3(m: number[][]): number {
  const [a, b, c] = m[0];
  const [d, e, f] = m[1];
  const [g, h, i] = m[2];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function determinantOf(m: number[][]): number {
  if (m.length === 2) return determinant2x2(m);
  if (m.length === 3) return determinant3x3(m);
  return 0;
}

/** Inverse of a 2×2 matrix with non-zero determinant. Returns integer-valued matrix when det = ±1. */
function inverse2x2(m: number[][]): number[][] {
  const det = determinant2x2(m);
  if (det === 0) throw new Error('Matrix is singular');
  const [a, b] = m[0];
  const [c, d] = m[1];
  return [
    [d / det, -b / det],
    [-c / det, a / det],
  ];
}

// ----- Per-type builders ----------------------------------------------------

interface BuildContext {
  gradeBand: '7-8' | 'algebra2' | 'precalculus' | 'advanced';
  /** Structural-difficulty axis. null/'medium' = current alternating shapes (byte-identical
   *  to the pre-tier behavior); 'easy' = floor shape; 'hard' = ceiling shape (grade-clamped).
   *  Changes SHAPE/depth only — number ranges stay bound by rangeForGrade. */
  tier: SupportTier | null;
}

function rangeForGrade(gradeBand: BuildContext['gradeBand']): [number, number] {
  switch (gradeBand) {
    case '7-8': return [1, 9];
    case 'algebra2': return [-9, 9];
    case 'precalculus': return [-10, 10];
    case 'advanced': return [-12, 12];
  }
}

function buildTransposeChallenge(ctx: BuildContext, idx: number): MatrixDisplayChallenge {
  const [min, max] = rangeForGrade(ctx.gradeBand);
  // Structural lever: entry count / shape size (numbers stay in grade range).
  // easy = 2×3 (6 entries); hard = 3×4 / 4×3 (12 entries, bigger shape flip);
  // medium/no-tier = alternate 2×3 / 3×2 so the shape change is visible.
  const isWide = idx % 2 === 0;
  let rows: number, cols: number;
  if (ctx.tier === 'easy') {
    rows = 2; cols = 3;
  } else if (ctx.tier === 'hard') {
    rows = isWide ? 3 : 4; cols = isWide ? 4 : 3;
  } else {
    rows = isWide ? 2 : 3; cols = isWide ? 3 : 2;
  }
  const values = makeMatrix(rows, cols, min, max);
  const expectedMatrix = transposeMatrix(values);
  return {
    id: `matrix-${idx + 1}`,
    challengeType: 'transpose',
    instruction: `Transpose the ${rows}×${cols} matrix. Enter each entry of the resulting ${cols}×${rows} matrix.`,
    rows,
    columns: cols,
    values,
    expectedMatrix,
    hint: `Row i of A becomes column i of Aᵀ. The transpose of a ${rows}×${cols} matrix is a ${cols}×${rows} matrix.`,
  };
}

function buildAddSubtractChallenge(
  ctx: BuildContext,
  operation: 'add' | 'subtract',
  idx: number,
): MatrixDisplayChallenge {
  const [min, max] = rangeForGrade(ctx.gradeBand);
  // Structural lever: entries to coordinate (both matrices stay the same size).
  // easy = 2×2 (4 entries); hard = 3×3 (9 entries); medium/no-tier = alternate 2×2 / 2×3.
  let rows: number, cols: number;
  if (ctx.tier === 'easy') {
    rows = 2; cols = 2;
  } else if (ctx.tier === 'hard') {
    rows = 3; cols = 3;
  } else {
    rows = 2; cols = idx % 2 === 1 ? 3 : 2;
  }
  const a = makeMatrix(rows, cols, min, max);
  const b = makeMatrix(rows, cols, min, max);
  const expectedMatrix = operation === 'add' ? addMatrices(a, b) : subtractMatrices(a, b);
  return {
    id: `matrix-${idx + 1}`,
    challengeType: operation,
    instruction: operation === 'add'
      ? `Add Matrix A and Matrix B element-by-element. Enter each entry of the result.`
      : `Subtract Matrix B from Matrix A element-by-element. Enter each entry of the result.`,
    rows,
    columns: cols,
    values: a,
    secondMatrix: { rows, columns: cols, values: b, label: 'Matrix B' },
    expectedMatrix,
    hint: operation === 'add'
      ? `Add corresponding entries: result[i][j] = A[i][j] + B[i][j].`
      : `Subtract corresponding entries: result[i][j] = A[i][j] − B[i][j].`,
  };
}

function buildMultiplyChallenge(ctx: BuildContext, idx: number): MatrixDisplayChallenge {
  const [min, max] = ctx.gradeBand === '7-8' ? [1, 6] : ctx.gradeBand === 'algebra2' ? [-6, 6] : rangeForGrade(ctx.gradeBand);
  // Structural lever: dot-product DEPTH (result is 2×2 either way; numbers stay in range).
  // easy = 2×2 × 2×2 (2-term dot products); hard = 2×3 × 3×2 (3-term dot products);
  // medium/no-tier = alternate so dimensions vary.
  const aRows = 2;
  const bCols = 2;
  let aCols: number;
  if (ctx.tier === 'easy') {
    aCols = 2;
  } else if (ctx.tier === 'hard') {
    aCols = 3;
  } else {
    aCols = idx % 2 === 0 ? 2 : 3;
  }
  const bRows = aCols;
  const a = makeMatrix(aRows, aCols, min, max);
  const b = makeMatrix(bRows, bCols, min, max);
  const expectedMatrix = multiplyMatrices(a, b);
  return {
    id: `matrix-${idx + 1}`,
    challengeType: 'multiply',
    instruction: `Multiply A (${aRows}×${aCols}) by B (${bRows}×${bCols}). Enter each entry of the ${aRows}×${bCols} result.`,
    rows: aRows,
    columns: aCols,
    values: a,
    secondMatrix: { rows: bRows, columns: bCols, values: b, label: 'Matrix B' },
    expectedMatrix,
    hint: `Result[i][j] = row i of A · column j of B = Σ A[i][k] × B[k][j].`,
  };
}

function buildDeterminantChallenge(ctx: BuildContext, idx: number): MatrixDisplayChallenge {
  const [min, max] = rangeForGrade(ctx.gradeBand);
  // Structural lever: matrix order = computation depth (2×2 → 2 products; 3×3 → Sarrus).
  // Grade ceiling wins: 7-8 stays 2×2 at EVERY tier (3×3 is out of grade scope).
  // easy = 2×2; hard = 3×3 (algebra2+); medium/no-tier = alternate 2×2 / 3×3 (algebra2+).
  const allow3x3 = ctx.gradeBand !== '7-8';
  let size: number;
  if (!allow3x3) {
    size = 2;
  } else if (ctx.tier === 'easy') {
    size = 2;
  } else if (ctx.tier === 'hard') {
    size = 3;
  } else {
    size = idx % 2 === 1 ? 3 : 2;
  }
  // Retry up to 12× to avoid det = 0.
  let m: number[][] = [];
  let det = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    m = makeMatrix(size, size, min, max);
    det = determinantOf(m);
    if (det !== 0) break;
  }
  if (det === 0) {
    // Last-resort fallback: bump m[0][0] until non-singular.
    m[0][0] = m[0][0] + 1;
    det = determinantOf(m);
  }
  return {
    id: `matrix-${idx + 1}`,
    challengeType: 'determinant',
    instruction: `Calculate the determinant of this ${size}×${size} matrix. Enter the integer value.`,
    rows: size,
    columns: size,
    values: m,
    expectedScalar: det,
    hint: size === 2
      ? `For [[a, b], [c, d]], det = ad − bc.`
      : `For a 3×3, use the Rule of Sarrus or cofactor expansion along the first row.`,
  };
}

function buildInverseChallenge(ctx: BuildContext, idx: number): MatrixDisplayChallenge {
  // Always 2×2 with det = ±1 so the inverse has integer entries.
  void ctx;
  // Generate (a, b, c, d) integers with ad − bc ∈ {±1}.
  // Strategy: pick a, b, c freely; solve for d so ad − bc = ±1; reject if d not integer.
  for (let attempt = 0; attempt < 100; attempt++) {
    const a = randInt(-5, 5);
    const b = randInt(-5, 5);
    const c = randInt(-5, 5);
    const targetDet = Math.random() < 0.5 ? 1 : -1;
    // ad − bc = targetDet → d = (targetDet + bc) / a
    if (a === 0) continue;
    const numerator = targetDet + b * c;
    if (numerator % a !== 0) continue;
    const d = numerator / a;
    if (d < -7 || d > 7) continue;
    if (a === 1 && b === 0 && c === 0 && d === 1) continue;     // skip identity
    if (a === -1 && b === 0 && c === 0 && d === -1) continue;   // skip negative identity
    const values: number[][] = [[a, b], [c, d]];
    const expectedMatrix = inverse2x2(values);
    return {
      id: `matrix-${idx + 1}`,
      challengeType: 'inverse',
      instruction: `Find the inverse of this 2×2 matrix. Enter each entry of A⁻¹.`,
      rows: 2,
      columns: 2,
      values,
      expectedMatrix,
      hint: `For [[a, b], [c, d]] with det = ad − bc, A⁻¹ = (1/det) · [[d, −b], [−c, a]].`,
    };
  }
  // Fallback to a known clean matrix.
  const values: number[][] = [[2, 1], [3, 2]]; // det = 1
  return {
    id: `matrix-${idx + 1}`,
    challengeType: 'inverse',
    instruction: `Find the inverse of this 2×2 matrix. Enter each entry of A⁻¹.`,
    rows: 2,
    columns: 2,
    values,
    expectedMatrix: inverse2x2(values),
    hint: `For [[a, b], [c, d]] with det = ad − bc, A⁻¹ = (1/det) · [[d, −b], [−c, a]].`,
  };
}

// ---------------------------------------------------------------------------
// Canonical-key dedup + selection
// ---------------------------------------------------------------------------

function canonKey(ch: MatrixDisplayChallenge): string {
  const a = ch.values.map((row) => row.join(',')).join('|');
  const b = ch.secondMatrix ? ch.secondMatrix.values.map((row) => row.join(',')).join('|') : '';
  return `${ch.challengeType}#${ch.rows}x${ch.columns}#${a}#${b}`;
}

export interface SelectMatrixChallengesOptions {
  count?: number;
  gradeBand?: '7-8' | 'algebra2' | 'precalculus' | 'advanced';
  /** Structural-difficulty tier (drives per-mode matrix shape/depth). Defaults to null. */
  tier?: SupportTier | null;
}

function buildChallengeOfType(
  type: MatrixChallengeType,
  ctx: BuildContext,
  idx: number,
): MatrixDisplayChallenge {
  switch (type) {
    case 'transpose': return buildTransposeChallenge(ctx, idx);
    case 'add': return buildAddSubtractChallenge(ctx, 'add', idx);
    case 'subtract': return buildAddSubtractChallenge(ctx, 'subtract', idx);
    case 'multiply': return buildMultiplyChallenge(ctx, idx);
    case 'determinant': return buildDeterminantChallenge(ctx, idx);
    case 'inverse': return buildInverseChallenge(ctx, idx);
  }
}

export function selectMatrixChallenges(
  challengeTypes: MatrixChallengeType | MatrixChallengeType[],
  options: SelectMatrixChallengesOptions = {},
): MatrixDisplayChallenge[] {
  const allowedTypes: MatrixChallengeType[] = Array.isArray(challengeTypes)
    ? (challengeTypes.length > 0 ? challengeTypes : ['determinant'])
    : [challengeTypes];

  // Per-mode count applies when a session pins to a single type. Bundled
  // sessions (multi-type) use the default fallback since interleaving across
  // types changes the effective per-instance time.
  const modeCount = allowedTypes.length === 1 ? COUNT_BY_MODE[allowedTypes[0]] : undefined;
  const target = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      options.count ?? modeCount ?? DEFAULT_INSTANCE_COUNT,
    ),
  );
  const ctx: BuildContext = { gradeBand: options.gradeBand ?? 'algebra2', tier: options.tier ?? null };

  // For bundled modes, interleave the allowed types across the session so every advertised
  // type is surfaced. Shuffle once per session so order varies session-to-session (e.g.
  // [add, subtract, add] one time, [subtract, add, subtract] the next).
  const sessionOrder = allowedTypes.length > 1 ? shuffle(allowedTypes) : allowedTypes;
  const pickType = (idx: number): MatrixChallengeType => sessionOrder[idx % sessionOrder.length];

  const seen = new Set<string>();
  const out: MatrixDisplayChallenge[] = [];

  let attempts = 0;
  while (out.length < target && attempts < target * 8) {
    const idx = out.length;
    const ch = buildChallengeOfType(pickType(idx), ctx, idx);
    const key = canonKey(ch);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(ch);
    }
    attempts++;
  }

  // If dedup was too aggressive, fill remainder with duplicates rather than blocking.
  while (out.length < target) {
    const idx = out.length;
    out.push(buildChallengeOfType(pickType(idx), ctx, idx));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Session title. Do NOT mention specific matrices — the session walks through several.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: ['transpose', 'add', 'subtract', 'multiply', 'determinant', 'inverse'],
      description: "Challenge type for the session. All challenges share this type.",
    },
    educationalContext: {
      type: Type.STRING,
      description: "Optional short context paragraph explaining when/why this operation matters.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['7-8', 'algebra2', 'precalculus', 'advanced'],
      description: "Grade band — drives number-size pool selection.",
    },
  },
  required: ["title", "description", "challengeType"],
};

// ---------------------------------------------------------------------------
// Grade-band inference
// ---------------------------------------------------------------------------

function inferGradeBand(gradeLevel: string): '7-8' | 'algebra2' | 'precalculus' | 'advanced' {
  const g = gradeLevel.toLowerCase();
  if (g.includes('precalc') || g.includes('11') || g.includes('12')) return 'precalculus';
  if (g.includes('linear algebra') || g.includes('advanced') || g.includes('college')) return 'advanced';
  if (g.includes('algebra 2') || g.includes('algebra ii') || g.includes('10') || g.includes('9')) return 'algebra2';
  return '7-8';
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateMatrix = async (
  topic: string,
  gradeLevel: string,
  config?: {
    /** Legacy single-operation override (ignored if targetEvalMode is set). */
    operation?: 'determinant' | 'inverse' | 'transpose' | 'multiply' | 'add' | 'subtract' | 'rowOperation' | 'solve';
    /** How many matrix challenges per session. Defaults from COUNT_BY_MODE (4 per §5a T2 matrix-specific hold). */
    instanceCount?: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which operation,
     * difficulty = how much scaffolding + how structurally deep within it.
     * NEVER changes the number range.
     */
    difficulty?: string;
  }
): Promise<MatrixDisplayData> => {
  console.log('[Matrix Gen] Starting generation:', { topic, gradeLevel, config });

  const evalConstraint = resolveEvalModeConstraint('matrix-display', config?.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('Matrix', config?.targetEvalMode, evalConstraint);

  // ── Within-mode support tier (config.difficulty): scaffolding level + structural
  //    size, NOT the number range. tierSection only nudges the wrapper title/description
  //    tone; the real withdrawal/shaping happens deterministically in code below. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold = supportTier ? resolveSupportStructure(supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level + structural size — NOT number range)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(wrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : wrapperSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-challenge matrix practice session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A matrix session contains 3-6 separate problems of the same matrix operation, surfaced sequentially.
- The system has ALREADY pre-selected the matrix values for each challenge; you do NOT pick numbers, dimensions, or any per-challenge data.
- Your job is ONLY to write the session-level title, description, and choose the challenge type.

${challengeTypeSection}
${tierSection}
REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific matrix — the session walks through several.
2. Provide a 1-2 sentence educational description of what students will practice.
3. Set challengeType to the correct operation.
4. Optionally provide a short educational context paragraph.

Return ONLY the wrapper fields described above.
`;

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
    throw new Error('No valid matrix wrapper returned from Gemini API');
  }

  // ── Determine allowed challenge types for the session ────────────
  // For bundled eval modes (e.g., add_subtract, determinant_inverse) the constraint carries
  // multiple allowed types; selectMatrixChallenges interleaves them across the session so
  // every advertised type is surfaced (SP-18 fix).
  const validTypes: MatrixChallengeType[] = ['transpose', 'add', 'subtract', 'multiply', 'determinant', 'inverse'];
  let allowedChallengeTypes: MatrixChallengeType[];
  if (evalConstraint && evalConstraint.allowedTypes.length > 0) {
    allowedChallengeTypes = evalConstraint.allowedTypes as MatrixChallengeType[];
  } else if (wrapper.challengeType && validTypes.includes(wrapper.challengeType)) {
    allowedChallengeTypes = [wrapper.challengeType as MatrixChallengeType];
  } else if (config?.operation && validTypes.includes(config.operation as MatrixChallengeType)) {
    allowedChallengeTypes = [config.operation as MatrixChallengeType];
  } else {
    allowedChallengeTypes = ['determinant'];
  }
  // Session-level challengeType reported on the wrapper — uses the first allowed type as a
  // representative descriptor. Per-challenge rendering reads `ch.challengeType` and handles
  // every type in the bundle.
  const sessionChallengeType: MatrixChallengeType = allowedChallengeTypes[0];

  const gradeBand = (wrapper.gradeBand as '7-8' | 'algebra2' | 'precalculus' | 'advanced' | undefined) ?? inferGradeBand(gradeLevel);

  // ── Pre-select challenges (local, deterministic-variance) ────────
  //    The structural tier shapes each matrix at build time (grade-clamped per mode);
  //    tier=null reproduces the prior alternating shapes byte-for-byte.
  const challenges = selectMatrixChallenges(allowedChallengeTypes, {
    count: config?.instanceCount,
    gradeBand,
    tier: supportTier,
  });

  // ── Within-mode support tier: withdraw on-screen scaffolding (never the numbers).
  //    Applied PER CHALLENGE (from each challenge's OWN type) so a blended session gets
  //    difficulty too — the tier is a student property, not a single-mode one. The
  //    scaffolding levers are mode-independent, so one resolved scaffold covers all. ──
  if (supportTier) {
    const sc = resolveSupportStructure(supportTier);
    for (const ch of challenges) {
      if (sc.hintLevel === 'concept') ch.hint = conceptHintFor(ch.challengeType);
      else if (sc.hintLevel === 'none') ch.hint = '';
      // 'formula' → keep the existing formula-rich hint each build function wrote.
      if (sc.stepsGating === 'afterAttempt') ch.stepsAfterAttempt = true;
    }
    const pinnedType = evalConstraint && evalConstraint.allowedTypes.length === 1
      ? evalConstraint.allowedTypes[0]
      : undefined;
    console.log(`[Matrix Gen] Support tier "${supportTier}" applied per-challenge across ${challenges.length} challenge(s) [${pinnedType ? `single-mode ${pinnedType}` : 'blended'}].`);
  }

  console.log(
    `[Matrix Gen] Final: allowedTypes=[${allowedChallengeTypes.join(',')}], instances=${challenges.length}, surfaced=[${challenges.map(c => c.challengeType).join(',')}], gradeBand=${gradeBand}`
  );

  return {
    title: wrapper.title,
    description: wrapper.description,
    challenges,
    challengeType: sessionChallengeType,
    educationalContext: wrapper.educationalContext,
    gradeBand,
    // Surface the tier whenever present — for a future live tutor's reveal policy.
    ...(supportTier ? { supportTier } : {}),
  };
};
