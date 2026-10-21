/**
 * matrix-display's in-item levers (/add-support-tiers; report qa/eval-reports/matrix-display-levers-2026-10-09.md).
 * The misses are what `matrixMiss` observes in the typed grid or determinant; there is no real-learner evidence.
 *
 * Declared once as a lever set (`MATRIX_LEVERS`, `bossLevers.ts`); the lesson context is the answer box being worked,
 * which the tracking levers follow:
 * - `row_bands` (layout, transpose): each row of the matrix and the matching column of the answer grid share a colour.
 * - `position_tracking` (marks, add / subtract): the box the learner is on is outlined and the entries in the same
 *   position in A and B are lit.
 * - `row_column_tracking` (marks, multiply): the box the learner is on is outlined, with its row of A and column of B lit.
 * - `term_list` (layout, multiply): under the grid, the outlined box written as a sum of products by position
 *   (A₁₁·B₁₂ + A₁₂·B₂₂), letters and subscripts only.
 * - `diagonal_marks` (marks, 2×2 determinant): the main diagonal tinted green, the other red, "green − red".
 * - `cofactor_signs` (marks, 3×3 determinant): + − + over the top row, captioned with the expansion.
 * - `swap_negate_letters` (marks, inverse): the entries lettered a b c d and the pattern [[d, −b], [−c, a]] ÷ (ad − bc)
 *   in letters beside the grid.
 * - `model_example` (model, every type; when it comes is the set's `support`): a worked example outside the item whose every number differs from every
 *   entry of the item's answer (transpose: a lettered matrix, no numbers at all).
 * - `simpler_problem` (easier, every type): the same operation on a smaller or friendlier matrix, built here;
 *   ungraded practice.
 *
 * Leak rules (code): no lever's `when`/`does` text or scene fact carries a digit; the tracking, bands, marks, signs
 * and letters write no number; the model never shows a number equal (in size) to an answer entry or the determinant;
 * a practice problem has its own id and ask, other values and another key, keeps the operation, and (determinant)
 * shows no number equal to the item's determinant.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { MatrixChallengeType, MatrixDisplayChallenge } from './MatrixDisplay';
import {
  MATRIX_MISSES_BY_MODE, MATRIX_MISSES_BY_TYPE, addOf, boxName, determinantOf, inverseOf, productOf, subtractOf, transposeOf,
} from './matrixDisplayWorkspace';

export const ROW_BANDS_LEVER = 'row_bands';
export const POSITION_LEVER = 'position_tracking';
export const ROW_COLUMN_LEVER = 'row_column_tracking';
export const TERMS_LEVER = 'term_list';
export const DIAGONALS_LEVER = 'diagonal_marks';
export const SIGNS_LEVER = 'cofactor_signs';
export const LETTERS_LEVER = 'swap_negate_letters';
export const MODEL_LEVER = 'model_example';
export const SIMPLER_LEVER = 'simpler_problem';

const SIMPLER = '~simpler';
export const isPracticeMatrix = (c: Pick<MatrixDisplayChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

/** The sizes of every number the item's answer holds (each result entry, or the determinant). */
export function keySizes(c: MatrixDisplayChallenge): Set<number> {
  return new Set((c.expectedScalar !== undefined ? [c.expectedScalar] : (c.expectedMatrix ?? []).flat()).map(Math.abs));
}

// ── the worked example outside the item ─────────────────────────────────

export type MatrixModel =
  | { kind: 'transpose'; from: string[][]; to: string[][] }
  | { kind: 'entrywise'; op: '+' | '−'; a: number[]; b: number[]; r: number[] }
  | { kind: 'dot'; row: number[]; col: number[]; products: number[]; sum: number }
  | { kind: 'det'; m: number[][]; ad: number; bc: number; det: number }
  | { kind: 'inverse'; m: number[][]; inv: number[][] };

/** Every number a model shows. */
export function modelNumbers(m: MatrixModel): number[] {
  switch (m.kind) {
    case 'transpose': return [];
    case 'entrywise': return [...m.a, ...m.b, ...m.r];
    case 'dot': return [...m.row, ...m.col, ...m.products, m.sum];
    case 'det': return [...m.m.flat(), m.ad, m.bc, m.det];
    case 'inverse': return [...m.m.flat(), ...m.inv.flat()];
  }
}

const SMALL = [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

export function matrixModel(c: MatrixDisplayChallenge): MatrixModel | null {
  const taken = keySizes(c);
  const free = (ns: number[]) => ns.every(n => !taken.has(Math.abs(n)));
  switch (c.challengeType) {
    case 'transpose':
      return { kind: 'transpose', from: [['p', 'q', 'r'], ['s', 't', 'u']], to: [['p', 's'], ['q', 't'], ['r', 'u']] };
    case 'add':
    case 'subtract': {
      const op = c.challengeType === 'add' ? '+' : '−';
      for (const x1 of SMALL) for (const y1 of SMALL) for (const x2 of SMALL) for (const y2 of SMALL) {
        if (x1 === y1 || x2 === y2 || x1 === x2) continue;
        const r = op === '+' ? [x1 + y1, x2 + y2] : [x1 - y1, x2 - y2];
        if (op === '−' && r.some(v => v <= 0)) continue;
        const m: MatrixModel = { kind: 'entrywise', op, a: [x1, x2], b: [y1, y2], r };
        if (free(modelNumbers(m)) && new Set(modelNumbers(m)).size === 6) return m;
      }
      return null;
    }
    case 'multiply':
      for (const r1 of SMALL.slice(0, 8)) for (const r2 of SMALL.slice(0, 8)) for (const c1 of SMALL.slice(0, 8)) for (const c2 of SMALL.slice(0, 8)) {
        const products = [r1 * c1, r2 * c2];
        const m: MatrixModel = { kind: 'dot', row: [r1, r2], col: [c1, c2], products, sum: products[0] + products[1] };
        if (free(modelNumbers(m))) return m;
      }
      return null;
    case 'determinant':
      for (const p of SMALL.slice(0, 8)) for (const q of SMALL.slice(0, 8)) for (const r of SMALL.slice(0, 8)) for (const s of SMALL.slice(0, 8)) {
        const ad = p * s, bc = q * r;
        if (ad <= bc) continue;
        const m: MatrixModel = { kind: 'det', m: [[p, q], [r, s]], ad, bc, det: ad - bc };
        if (free(modelNumbers(m))) return m;
      }
      return null;
    case 'inverse':
      for (let p = 1; p <= 12; p++) for (let q = 1; q <= 12; q++) for (let r = 1; r <= 12; r++) {
        const s = (1 + q * r) / p;
        if (!Number.isInteger(s) || s > 12) continue;
        const m: MatrixModel = { kind: 'inverse', m: [[p, q], [r, s]], inv: inverseOf([[p, q], [r, s]]) };
        if (free(modelNumbers(m))) return m;
      }
      return null;
  }
}

// ── simplify ─────────────────────────────────────────────────────────────

const RULE: Record<MatrixChallengeType, string> = {
  transpose: 'Row i of A becomes column i of Aᵀ.',
  add: 'Add corresponding entries: result[i][j] = A[i][j] + B[i][j].',
  subtract: 'Subtract corresponding entries: result[i][j] = A[i][j] − B[i][j].',
  multiply: 'Result[i][j] = row i of A · column j of B.',
  determinant: 'For [[a, b], [c, d]], det = ad − bc.',
  inverse: 'For [[a, b], [c, d]] with det = ad − bc, A⁻¹ = (1/det) · [[d, −b], [−c, a]].',
};

const inRange = (m: number[][], lo: number, hi: number) => m.flat().every(v => Number.isInteger(v) && v >= lo && v <= hi);
const same = (a: number[][], b: number[][]) => JSON.stringify(a) === JSON.stringify(b);

/** Candidate practice matrices per type, smallest and friendliest first. */
const PRACTICE: Record<MatrixChallengeType, number[][][][]> = {
  transpose: [[[[1, 2, 3], [4, 5, 6]]], [[[2, 4, 6], [1, 3, 5]]]],
  add: [[[[3, 1], [2, 4]], [[1, 2], [2, 1]]], [[[2, 4], [1, 3]], [[2, 1], [3, 2]]]],
  subtract: [[[[5, 3], [4, 2]], [[2, 1], [3, 1]]], [[[6, 4], [5, 3]], [[1, 2], [2, 1]]]],
  multiply: [[[[1, 2], [0, 1]], [[2, 1], [1, 3]]], [[[2, 0], [1, 1]], [[1, 2], [3, 1]]]],
  determinant: [[[[3, 1], [2, 4]]], [[[4, 2], [1, 3]]], [[[5, 2], [1, 3]]], [[[4, 1], [3, 2]]], [[[3, 2], [1, 3]]]],
  inverse: [[[[2, 1], [1, 1]]], [[[3, 1], [2, 1]]], [[[2, 3], [1, 2]]], [[[3, 2], [1, 1]]]],
};

/** Already as small and friendly as the mode allows: nothing simpler to offer. */
function alreadySimple(c: MatrixDisplayChallenge): boolean {
  const a = c.values, b = c.secondMatrix?.values ?? [];
  switch (c.challengeType) {
    // The 2×3 / 3×2 shape is the mode's floor; on it the counting numbers are the simpler version.
    case 'transpose': return a.length * (a[0]?.length ?? 0) <= 6 && a.flat().every((v, i, all) => i === 0 || v === all[i - 1] + 1);
    case 'add': return a.length === 2 && a[0].length === 2 && inRange(a, 0, 5) && inRange(b, 0, 5);
    case 'subtract': return a.length === 2 && a[0].length === 2 && inRange(a, 0, 6) && inRange(b, 0, 6)
      && a.every((row, i) => row.every((v, j) => v >= b[i][j]));
    case 'multiply': return a[0]?.length === 2 && inRange(a, 0, 3) && inRange(b, 0, 3);
    case 'determinant': return a.length === 2 && inRange(a, 1, 5);
    case 'inverse': return determinantOf(a) === 1 && inRange(a, 0, 3);
  }
}

function practiceFrom(c: MatrixDisplayChallenge, mats: number[][][]): MatrixDisplayChallenge {
  const [a, b] = mats, t = c.challengeType;
  const base: MatrixDisplayChallenge = { id: `${c.id}${SIMPLER}`, challengeType: t, rows: a.length, columns: a[0].length, values: a,
    instruction: '', hint: c.hint?.trim() ? RULE[t] : '' };
  const size = `${a.length}×${a[0].length}`;
  switch (t) {
    case 'transpose':
      return { ...base, expectedMatrix: transposeOf(a), instruction: `Practice first: transpose this ${size} matrix. Enter each entry of the ${a[0].length}×${a.length} result.` };
    case 'add':
    case 'subtract':
      return { ...base, secondMatrix: { rows: b.length, columns: b[0].length, values: b, label: 'Matrix B' },
        expectedMatrix: t === 'add' ? addOf(a, b) : subtractOf(a, b),
        instruction: t === 'add' ? 'Practice first: add Matrix A and Matrix B entry by entry.' : 'Practice first: subtract Matrix B from Matrix A entry by entry.' };
    case 'multiply':
      return { ...base, secondMatrix: { rows: b.length, columns: b[0].length, values: b, label: 'Matrix B' }, expectedMatrix: productOf(a, b),
        instruction: 'Practice first: multiply A (2×2) by B (2×2). Enter each entry of the 2×2 result.' };
    case 'determinant':
      return { ...base, expectedScalar: determinantOf(a), instruction: 'Practice first: find the determinant of this 2×2 matrix.' };
    case 'inverse':
      return { ...base, expectedMatrix: inverseOf(a), instruction: 'Practice first: find the inverse of this 2×2 matrix.' };
  }
}

/** The easier practice problem for `c`: the same operation on a smaller or friendlier matrix. Null when there is none. */
export function simplerMatrix(c: MatrixDisplayChallenge): MatrixDisplayChallenge | null {
  if (isPracticeMatrix(c) || alreadySimple(c)) return null;
  for (const mats of PRACTICE[c.challengeType]) {
    const practice = practiceFrom(c, mats);
    if (!practiceLeaks(c, practice)) return practice;
  }
  return null;
}

/** Leak rule for a practice problem: never the learner's item (id, ask, values, key), the same operation, and on a
 *  determinant no number on screen equal to the item's determinant. */
export function practiceLeaks(parent: MatrixDisplayChallenge, practice: MatrixDisplayChallenge): boolean {
  if (practice.id === parent.id || practice.instruction === parent.instruction || practice.challengeType !== parent.challengeType) return true;
  if (same(practice.values, parent.values)) return true;
  if (parent.expectedScalar !== undefined) {
    const det = Math.abs(parent.expectedScalar);
    return practice.expectedScalar === parent.expectedScalar || practice.values.flat().some(v => Math.abs(v) === det);
  }
  return !!practice.expectedMatrix && !!parent.expectedMatrix && same(practice.expectedMatrix, parent.expectedMatrix);
}

// ── the lever set ────────────────────────────────────────────────────────

/** The lesson context the levers read: the answer box being worked (row, column), which the tracking levers follow. */
export interface MatrixLeverCtx { active: [number, number] }
export const FIRST_BOX: MatrixLeverCtx = { active: [0, 0] };

/** The eval mode an item's type belongs to. */
const MODE_OF: Record<MatrixChallengeType, string> = {
  transpose: 'transpose', add: 'add_subtract', subtract: 'add_subtract', multiply: 'multiply',
  determinant: 'determinant_inverse', inverse: 'determinant_inverse',
};
const own = (c: MatrixDisplayChallenge) => MATRIX_MISSES_BY_TYPE[c.challengeType];
const boxOf = (ctx: MatrixLeverCtx) => `the ${boxName(ctx.active[0], ctx.active[1])} box`;
const EVERY_MISS = Array.from(new Set(Object.values(MATRIX_MISSES_BY_TYPE).flat()));

/**
 * The levers, declared once (`bossLevers.ts`). A picture lever is offered on the types it draws for (`offer`); the
 * misses it answers on an item are that type's (`answersOn`). None is offered on a practice problem: the component
 * declares nothing while one is on screen.
 */
export const MATRIX_LEVERS = leverSet<MatrixDisplayChallenge, MatrixLeverCtx>({
  modeOf: c => MODE_OF[c.challengeType],
  missesOf: mode => MATRIX_MISSES_BY_MODE[mode] ?? [],
  support: { tier: c => c.supportTier ?? 'medium', different: 'a worked example outside the item, with its own numbers',
    own: 'this item\'s answer' },
  specs: [
    { id: ROW_BANDS_LEVER, type: 'layout', modes: ['transpose'], answers: MATRIX_MISSES_BY_TYPE.transpose,
      when: 'The learner fills the new grid in reading order, or loses track of which row goes where.',
      does: 'Gives each row of the matrix its own colour band and the matching column of the answer grid the same colour, so '
        + 'each row visibly becomes a column. No number is written.',
      fact: 'Each row of the matrix and the matching column of the answer grid share a colour band.' },
    { id: POSITION_LEVER, type: 'marks', modes: ['add_subtract'], answers: MATRIX_MISSES_BY_MODE.add_subtract, answersOn: own,
      when: 'The learner pairs entries from different positions, does the other operation, or slips on one box.',
      does: 'Outlines the answer box the learner is on, lights the entries in the same position in Matrix A and Matrix B, and '
        + 'writes the box under the grid as A entry plus or minus B entry, in letters with small position marks. It '
        + 'follows the box the learner clicks. No value is written.',
      fact: (_content, c, ctx) => `The answer box being worked (${boxOf(ctx)}) is outlined, the entries in the same position `
        + 'in Matrix A and Matrix B are lit, and under the grid the box is written as A entry '
        + `${c.challengeType === 'subtract' ? 'minus' : 'plus'} B entry, in letters.` },
    { id: ROW_COLUMN_LEVER, type: 'marks', modes: ['multiply'],
      answers: ['entrywise', 'reversed_order', 'row_times_row', 'one_entry', 'some_entries'],
      when: 'The learner multiplies matching entries, reverses the order, or uses the wrong row or column.',
      does: 'Outlines the answer box the learner is on and lights its row of Matrix A and its column of Matrix B. It follows '
        + 'the box the learner clicks. No number is written.',
      fact: (_content, _c, ctx) => `The answer box being worked (${boxOf(ctx)}) is outlined, with its row of Matrix A and its `
        + 'column of Matrix B lit.' },
    { id: TERMS_LEVER, type: 'layout', modes: ['multiply'],
      answers: ['missed_term', 'entrywise', 'row_times_row', 'sign_error', 'one_entry', 'some_entries'],
      when: 'The learner drops a product from a sum or loses which entries to multiply.',
      does: 'Writes the outlined box under the grid as a sum of products by position, A entry times B entry for each term, '
        + 'in letters with small position marks and no values.',
      fact: 'Under the grid the outlined box is written as a sum of products by position, in letters with no values.' },
    { id: DIAGONALS_LEVER, type: 'marks', modes: ['determinant_inverse'], answers: MATRIX_MISSES_BY_TYPE.determinant,
      offer: c => c.challengeType === 'determinant' && c.values.length === 2,
      when: 'The learner adds the products, subtracts them the wrong way round, or uses one product only.',
      does: 'Tints the main diagonal green and the other diagonal red, captioned green product minus red product. No number '
        + 'is written.',
      fact: 'The main diagonal is tinted green and the other diagonal red, captioned green product minus red product.' },
    { id: SIGNS_LEVER, type: 'marks', modes: ['determinant_inverse'],
      answers: MATRIX_MISSES_BY_TYPE.determinant.filter(m => m !== 'one_product'),
      offer: c => c.challengeType === 'determinant' && c.values.length === 3,
      when: 'The learner adds every term of the expansion or gets the sign wrong.',
      does: 'Writes plus, minus, plus over the top row, captioned that each top entry is multiplied by the small determinant '
        + 'left when its row and column are covered. No number is written.',
      fact: 'Plus, minus, plus is written over the top row, captioned with the expansion along the top row.' },
    { id: LETTERS_LEVER, type: 'marks', modes: ['determinant_inverse'], answers: MATRIX_MISSES_BY_TYPE.inverse,
      offer: c => c.challengeType === 'inverse',
      when: 'The learner forgets to swap, to negate, or to divide by the determinant.',
      does: 'Letters the matrix entries a, b, c and d, and shows beside the grid the pattern d, minus b, minus c, a, all over '
        + 'a times d minus b times c, in letters only.',
      fact: 'The entries are lettered a, b, c, d, and beside the grid is the pattern d, minus b, minus c, a over a times d '
        + 'minus b times c, in letters.' },
    { id: MODEL_LEVER, type: 'model', answers: 'all', answersOn: own,
      when: 'The learner does not know how the operation is carried out.',
      does: c => (c.challengeType === 'transpose'
        ? 'Shows a worked transpose outside the item, with letters for entries: each row of letters becomes a column. '
          + 'Read it aloud; it never shows the item\'s answer.'
        : 'Shows a worked example outside the item, with its own small numbers, every step written. Read it aloud; '
          + 'none of its numbers is an entry of the item\'s answer.'),
      content: c => matrixModel(c),
      fact: 'Beside the matrices is a worked example outside the item, with its own numbers.' },
    { id: SIMPLER_LEVER, type: 'easier', answers: EVERY_MISS.filter(m => m !== 'sign_error'),
      answersOn: c => own(c).filter(m => m !== 'sign_error'),
      when: 'This matrix is too big or its numbers too hard to work with yet.',
      does: 'Opens an easier problem with the same operation first, on a smaller or friendlier matrix. It is not graded; the '
        + 'full item comes back after it.',
      content: c => simplerMatrix(c) },
  ],
});

/** Leak rule for the levers' words and facts: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);

/** The sum of products the term list writes for box (i, j) of an inner dimension k, in subscripts. */
const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
export function termList(i: number, j: number, k: number): string {
  return Array.from({ length: k }, (_, n) => `A${SUB[i + 1]}${SUB[n + 1]}·B${SUB[n + 1]}${SUB[j + 1]}`).join(' + ');
}

/** The recipe the position lever writes for box (i, j) of an add or subtract item, in subscripts. */
export const positionRecipe = (i: number, j: number, op: '+' | '−') => `A${SUB[i + 1]}${SUB[j + 1]} ${op} B${SUB[i + 1]}${SUB[j + 1]}`;
