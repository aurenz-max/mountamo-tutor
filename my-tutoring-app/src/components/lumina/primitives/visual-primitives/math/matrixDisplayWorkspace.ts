/**
 * Matrix display on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C20).
 *
 * Pure: the component and any probe read the same assignment and scene. Every mode is a gesture item checked by the
 * activity's own Check: every box of the answer grid against the result matrix, or the one determinant box against
 * the determinant. The tutor is never handed the answer: no result entry, no determinant.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { MatrixChallengeType, MatrixDisplayChallenge } from './MatrixDisplay';

/** Catalog eval mode -> the challenge types it generates. */
export const MATRIX_MODE_TYPES: Record<string, readonly MatrixChallengeType[]> = {
  transpose: ['transpose'], add_subtract: ['add', 'subtract'], multiply: ['multiply'], determinant_inverse: ['determinant', 'inverse'],
};

// ── matrix arithmetic (the practice builders recompute their own keys) ─────

export const transposeOf = (m: number[][]) => (m[0] ?? []).map((_, j) => m.map(row => row[j]));
export const addOf = (a: number[][], b: number[][]) => a.map((row, i) => row.map((v, j) => v + b[i][j]));
export const subtractOf = (a: number[][], b: number[][]) => a.map((row, i) => row.map((v, j) => v - b[i][j]));
export const productOf = (a: number[][], b: number[][]) =>
  a.map(row => (b[0] ?? []).map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
export function determinantOf(m: number[][]): number {
  if (m.length === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}
export function inverseOf(m: number[][]): number[][] {
  const det = determinantOf(m), [[a, b], [c, d]] = m;
  return [[d / det, -b / det], [-c / det, a / det]].map(row => row.map(v => (Object.is(v, -0) ? 0 : v)));
}

export const formatEntry = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));
const sameMatrix = (a: number[][], b: number[][]) =>
  a.length === b.length && a.every((row, i) => row.length === b[i]?.length && row.every((v, j) => Math.abs(v - b[i][j]) < 1e-6));

// ── the learner's work and the activity's check ───────────────────────────

/** What the learner has typed: the determinant box, or the answer grid (rows of strings, '' for an empty box). */
export interface MatrixWork {
  scalar: string;
  cells: string[][];
}

export const isScalarItem = (ch: MatrixDisplayChallenge) => ch.expectedScalar !== undefined;

/** The answer grid's shape, or null for a determinant (one box). */
export function answerShape(ch: MatrixDisplayChallenge): [number, number] | null {
  const m = ch.expectedMatrix;
  return isScalarItem(ch) || !m ? null : [m.length, m[0]?.length ?? 0];
}

export const blankGrid = (ch: MatrixDisplayChallenge): string[][] => {
  const shape = answerShape(ch);
  return shape ? Array.from({ length: shape[0] }, () => Array.from({ length: shape[1] }, () => '')) : [];
};

/** A typed entry as a number: the minus may be typed as − or –; anything else that is not a number is null. */
export function parseEntry(raw: string | undefined): number | null {
  const t = (raw ?? '').trim().replace(/[−–]/g, '-');
  if (!t || !/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Every box the check reads holds a number. An incomplete grid is not a check (Check stays off). */
export function workComplete(ch: MatrixDisplayChallenge, work: MatrixWork): boolean {
  if (isScalarItem(ch)) return parseEntry(work.scalar) !== null;
  const shape = answerShape(ch);
  if (!shape) return false;
  for (let i = 0; i < shape[0]; i++) for (let j = 0; j < shape[1]; j++) if (parseEntry(work.cells[i]?.[j]) === null) return false;
  return true;
}

/** The learner's grid as numbers (null for an empty box). */
const typedGrid = (ch: MatrixDisplayChallenge, work: MatrixWork) =>
  (ch.expectedMatrix ?? []).map((row, i) => row.map((_, j) => parseEntry(work.cells[i]?.[j])));

/** Which boxes match the result (the marks a check draws). Undefined for a determinant. */
export function boxMarks(ch: MatrixDisplayChallenge, work: MatrixWork): boolean[][] | undefined {
  if (isScalarItem(ch) || !ch.expectedMatrix) return undefined;
  const typed = typedGrid(ch, work);
  return ch.expectedMatrix.map((row, i) => row.map((v, j) => typed[i][j] !== null && Math.abs(typed[i][j]! - v) < 1e-6));
}

/** The activity's own check. */
export function matrixCorrect(ch: MatrixDisplayChallenge, work: MatrixWork): boolean {
  if (isScalarItem(ch)) {
    const v = parseEntry(work.scalar);
    return v !== null && Math.abs(v - ch.expectedScalar!) < 1e-6;
  }
  const marks = boxMarks(ch, work);
  return !!marks && marks.length > 0 && marks.every(row => row.every(Boolean));
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
/** A box named in words ("the second row, first column"), so the name carries no digit a key could be. */
export const boxName = (i: number, j: number) => `${ORDINAL[i] ?? `row ${i + 1}`} row, ${ORDINAL[j] ?? `column ${j + 1}`} column`;

/** The learner's work in words, never the key. */
export function describeMatrixWork(ch: MatrixDisplayChallenge, work: MatrixWork): string {
  if (isScalarItem(ch)) {
    const t = work.scalar.trim();
    return t ? `typed ${t} in the determinant box` : 'nothing typed yet';
  }
  const shape = answerShape(ch);
  if (!shape) return 'nothing typed yet';
  const rows = Array.from({ length: shape[0] }, (_, i) =>
    Array.from({ length: shape[1] }, (_, j) => (work.cells[i]?.[j] ?? '').trim() || '_').join(', '));
  if (rows.every(r => /^(_, )*_$/.test(r))) return 'nothing typed yet';
  return `answer grid (_ is an empty box): ${rows.map(r => `[${r}]`).join(' ')}`;
}

// ── misses ─────────────────────────────────────────────────────────────────

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), drawn from the catalog's commonStruggles (wrong
 * determinant formula, multiplication order, inverse confusion, transpose dimensions) and the typed grid:
 * - transpose: `reshaped` A's entries typed in reading order into the new shape, not swapped;
 * - add / subtract: `wrong_operation` the other operation done; `reversed_subtraction` B − A;
 * - multiply: `entrywise` matching entries multiplied; `reversed_order` B·A; `row_times_row` row of A times row of B;
 *   `missed_term` every box one product short (the last term of each sum dropped);
 * - determinant: `added_products` the products added (2×2 ad + bc; 3×3 every cofactor term added);
 *   `opposite_sign` the determinant's negative; `one_product` only ad or only bc typed; else `near_miss` (within 2),
 *   `too_high`, `too_low`;
 * - inverse: `no_negation` a and d swapped, b and c not negated; `no_swap` b and c negated, a and d not swapped;
 *   `unscaled` not divided by a determinant of −1; `original` A itself typed;
 * - any grid: `sign_error` every wrong box is the right number with the wrong sign; `one_entry` one box wrong;
 *   `some_entries` more than one.
 */
export type MatrixMiss = 'reshaped' | 'wrong_operation' | 'reversed_subtraction' | 'entrywise' | 'reversed_order'
  | 'row_times_row' | 'missed_term' | 'added_products' | 'opposite_sign' | 'one_product' | 'near_miss' | 'too_high'
  | 'too_low' | 'no_negation' | 'no_swap' | 'unscaled' | 'original' | 'sign_error' | 'one_entry' | 'some_entries';

const GRID: readonly MatrixMiss[] = ['sign_error', 'one_entry', 'some_entries'];
export const MATRIX_MISSES_BY_TYPE: Record<MatrixChallengeType, readonly MatrixMiss[]> = {
  transpose: ['reshaped', ...GRID],
  add: ['wrong_operation', ...GRID],
  subtract: ['wrong_operation', 'reversed_subtraction', ...GRID],
  multiply: ['entrywise', 'reversed_order', 'row_times_row', 'missed_term', ...GRID],
  determinant: ['added_products', 'opposite_sign', 'one_product', 'near_miss', 'too_high', 'too_low'],
  inverse: ['no_negation', 'no_swap', 'unscaled', 'original', ...GRID],
};
export const MATRIX_MISSES_BY_MODE: Record<string, readonly MatrixMiss[]> = Object.fromEntries(
  Object.entries(MATRIX_MODE_TYPES).map(([mode, types]) =>
    [mode, Array.from(new Set(types.flatMap(t => MATRIX_MISSES_BY_TYPE[t])))]));

/** The values each signature miss stands for on this item, most specific first. Shared by the check and the harness. */
export function signatureMatrices(ch: MatrixDisplayChallenge): Array<[MatrixMiss, number[][]]> {
  const a = ch.values, b = ch.secondMatrix?.values, key = ch.expectedMatrix;
  if (!key) return [];
  const out: Array<[MatrixMiss, number[][]]> = [];
  const shapeOk = (m: number[][]) => m.length === key.length && m[0]?.length === key[0]?.length;
  switch (ch.challengeType) {
    case 'transpose': {
      const flat = a.flat(), cols = key[0]?.length ?? 0;
      out.push(['reshaped', key.map((row, i) => row.map((_, j) => flat[i * cols + j]))]);
      break;
    }
    case 'add': if (b) out.push(['wrong_operation', subtractOf(a, b)]); break;
    case 'subtract': if (b) out.push(['wrong_operation', addOf(a, b)], ['reversed_subtraction', subtractOf(b, a)]); break;
    case 'multiply': {
      if (!b) break;
      if (a.length === b.length && a[0]?.length === b[0]?.length) out.push(['entrywise', a.map((row, i) => row.map((v, j) => v * b[i][j]))]);
      if (b[0]?.length === a.length) out.push(['reversed_order', productOf(b, a)]);
      if (a[0]?.length === b[0]?.length) out.push(['row_times_row', productOf(a, transposeOf(b))]);
      const k = a[0]?.length ?? 0;
      if (k > 1) out.push(['missed_term', productOf(a.map(row => row.slice(0, k - 1)), b.slice(0, k - 1))]);
      break;
    }
    case 'inverse': {
      const [[p, q], [r, s]] = a, det = determinantOf(a);
      out.push(['no_negation', [[s / det, q / det], [r / det, p / det]]], ['no_swap', [[p / det, -q / det], [-r / det, s / det]]]);
      if (det !== 1) out.push(['unscaled', [[s, -q], [-r, p]]]);
      out.push(['original', a]);
      break;
    }
    default: break;
  }
  return out.filter(([, m]) => shapeOk(m) && !sameMatrix(m, key));
}

/** The determinant values each signature miss stands for. */
export function signatureScalars(ch: MatrixDisplayChallenge): Array<[MatrixMiss, number]> {
  if (!isScalarItem(ch)) return [];
  const m = ch.values, det = ch.expectedScalar!;
  const out: Array<[MatrixMiss, number]> = [];
  if (m.length === 2) {
    const ad = m[0][0] * m[1][1], bc = m[0][1] * m[1][0];
    out.push(['added_products', ad + bc], ['opposite_sign', -det], ['one_product', ad], ['one_product', bc]);
  } else {
    const [[a, b, c], [d, e, f], [g, h, i]] = m;
    out.push(['added_products', a * (e * i - f * h) + b * (d * i - f * g) + c * (d * h - e * g)], ['opposite_sign', -det]);
  }
  return out.filter(([, v]) => v !== det);
}

export function matrixMiss(ch: MatrixDisplayChallenge, work: MatrixWork): MatrixMiss | undefined {
  if (!workComplete(ch, work) || matrixCorrect(ch, work)) return undefined;
  if (isScalarItem(ch)) {
    const v = parseEntry(work.scalar)!, det = ch.expectedScalar!;
    const hit = signatureScalars(ch).find(([, s]) => Math.abs(s - v) < 1e-6);
    if (hit) return hit[0];
    if (Math.abs(v - det) <= 2) return 'near_miss';
    return v > det ? 'too_high' : 'too_low';
  }
  const typed = typedGrid(ch, work) as number[][];
  const hit = signatureMatrices(ch).find(([, m]) => sameMatrix(m, typed));
  if (hit) return hit[0];
  const key = ch.expectedMatrix!;
  const wrong = key.flatMap((row, i) => row.flatMap((v, j) => (Math.abs(typed[i][j] - v) < 1e-6 ? [] : [[v, typed[i][j]]])));
  if (wrong.every(([v, t]) => v !== 0 && Math.abs(t + v) < 1e-6)) return 'sign_error';
  return wrong.length === 1 ? 'one_entry' : 'some_entries';
}

// ── assignment and scene ──────────────────────────────────────────────────

export function workspaceAssignment(ch: MatrixDisplayChallenge): TeachingAssignment {
  return { id: ch.id, task: ch.instruction, response: 'gesture' };
}

const KIND: Record<MatrixChallengeType, string> = {
  transpose: 'transpose: the rows of the matrix become the columns of the answer',
  add: 'add: Matrix A plus Matrix B, entry by entry',
  subtract: 'subtract: Matrix A minus Matrix B, entry by entry',
  multiply: 'multiply: Matrix A times Matrix B, each answer box a row of A times a column of B',
  determinant: 'determinant: one number from the square matrix',
  inverse: 'inverse: the 2 by 2 matrix that undoes Matrix A',
};

/** A drawn matrix as words: its size and its rows. */
export const describeMatrix = (m: number[][]) =>
  `${m.length}×${m[0]?.length ?? 0}: ${m.map(row => `[${row.map(formatEntry).join(', ')}]`).join(' ')}`;

/** What the session draws beside the matrices. */
export interface MatrixView extends MatrixWork {
  /** The marks a check left on the grid, until Try again. */
  marks?: boolean[][];
}

/** What is drawn and asked. No result entry and no determinant is named. */
export function workspaceScene(ch: MatrixDisplayChallenge, view: MatrixView): WorkspaceScene {
  const facts: Record<string, string> = {
    kind: KIND[ch.challengeType],
    [ch.secondMatrix ? 'matrixA' : 'matrix']: describeMatrix(ch.values),
  };
  if (ch.secondMatrix) facts.matrixB = describeMatrix(ch.secondMatrix.values);
  const shape = answerShape(ch);
  facts.answerBoxes = shape ? `a ${shape[0]}×${shape[1]} grid of answer boxes` : 'one answer box for the determinant';
  facts.ruleLine = ch.hint?.trim() ? `under the matrices: "${ch.hint.trim()}"` : 'none: no rule is written on screen at this level';
  if (view.marks) {
    const wrong = view.marks.flatMap((row, i) => row.flatMap((ok, j) => (ok ? [] : [boxName(i, j)])));
    facts.checkMarks = wrong.length ? `boxes marked wrong: ${wrong.join('; ')}; every other box is marked right` : 'every box marked right';
  }
  facts.learnerWork = describeMatrixWork(ch, view);
  facts.constraints = shape
    ? 'The learner types a number in every box of the answer grid and presses Check. The activity checks every box '
      + 'itself and marks each one right or wrong. You cannot type or press Check.'
    : 'The learner types one number in the determinant box and presses Check. The activity checks it itself. '
      + 'You cannot type or press Check.';
  return { objects: [], facts };
}

// ── the journey row's input ───────────────────────────────────────────────

/** The input a journey row performs: each box's text, or the determinant box's. */
export type MatrixHarnessInput = { kind: 'scalar'; text: string } | { kind: 'grid'; cells: string[][] };

/** The aria-label of an answer box (unique on screen; the journey writes by it). */
export const boxLabel = (i: number, j: number) => `Answer row ${i + 1}, column ${j + 1}`;
export const SCALAR_LABEL = 'Determinant answer';

/**
 * `correct`: the key. `wrong`: the item's first signature miss, else (a grid) the top-left box one more, or (a
 * determinant) five more.
 */
export function matrixHarnessInput(ch: MatrixDisplayChallenge, intent: 'correct' | 'wrong'): MatrixHarnessInput {
  if (isScalarItem(ch)) {
    const det = ch.expectedScalar!;
    const v = intent === 'correct' ? det : (signatureScalars(ch)[0]?.[1] ?? det + 5);
    return { kind: 'scalar', text: formatEntry(v) };
  }
  const key = ch.expectedMatrix ?? [];
  // A wrong grid that types a box's answer with its sign flipped ("-5" for 5) would echo the key's digits back in the
  // learner's own response; prefer a signature that does not, so the sweep reads only what the miss adds.
  const signatures = signatureMatrices(ch);
  const flipsKey = (m: number[][]) => m.some((row, i) => row.some((v, j) => v !== 0 && v === -key[i][j]));
  const wrongGrid = (signatures.find(([, m]) => !flipsKey(m)) ?? signatures[0])?.[1];
  const m = intent === 'correct' ? key
    : wrongGrid ?? key.map((row, i) => row.map((v, j) => (i === 0 && j === 0 ? v + 1 : v)));
  return { kind: 'grid', cells: m.map(row => row.map(formatEntry)) };
}
