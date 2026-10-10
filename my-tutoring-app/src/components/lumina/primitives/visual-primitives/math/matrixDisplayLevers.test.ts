/**
 * matrix-display levers: the leak rules per type, the simplify builder over many item shapes, and "this wrong answer,
 * then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { MatrixChallengeType, MatrixDisplayChallenge } from './MatrixDisplay';
import {
  DIAGONALS_LEVER, LETTERS_LEVER, MODEL_LEVER, POSITION_LEVER, ROW_BANDS_LEVER, ROW_COLUMN_LEVER, SIGNS_LEVER, SIMPLER_LEVER,
  TERMS_LEVER, keySizes, leverFacts, leverTextLeaks, matrixLevers, matrixModel, modelNumbers, practiceLeaks, simplerMatrix,
} from './matrixDisplayLevers';
import {
  MATRIX_MISSES_BY_MODE, MATRIX_MISSES_BY_TYPE, MATRIX_MODE_TYPES, addOf, determinantOf, inverseOf, matrixCorrect, matrixMiss,
  productOf, subtractOf, transposeOf, type MatrixWork,
} from './matrixDisplayWorkspace';

/** A seeded generator, so a failure names a reproducible item. */
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const matrix = (r: () => number, rows: number, cols: number, lo: number, hi: number) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => int(r, lo, hi)));

/** Items of a type as the generator draws them: every band's range and every tier's shape (gemini-matrix.ts). */
function items(type: MatrixChallengeType, n = 60): MatrixDisplayChallenge[] {
  const r = rng(type.length * 7919 + 13), out: MatrixDisplayChallenge[] = [];
  const ranges: Array<[number, number]> = [[1, 9], [-9, 9], [-10, 10], [-12, 12]];
  for (let k = 0; k < n; k++) {
    const [lo, hi] = ranges[k % ranges.length];
    const base = { id: `${type}-${k}`, challengeType: type, instruction: `Item ${k}.`, hint: k % 3 === 2 ? '' : 'Rule.' };
    let c: MatrixDisplayChallenge;
    if (type === 'transpose') {
      const [rows, cols] = [[2, 3], [3, 2], [3, 4], [4, 3]][k % 4];
      const a = matrix(r, rows, cols, lo, hi);
      c = { ...base, rows, columns: cols, values: a, expectedMatrix: transposeOf(a) };
    } else if (type === 'add' || type === 'subtract') {
      const [rows, cols] = [[2, 2], [2, 3], [3, 3]][k % 3];
      const a = matrix(r, rows, cols, lo, hi), b = matrix(r, rows, cols, lo, hi);
      c = { ...base, rows, columns: cols, values: a, secondMatrix: { rows, columns: cols, values: b },
        expectedMatrix: type === 'add' ? addOf(a, b) : subtractOf(a, b) };
    } else if (type === 'multiply') {
      const inner = k % 2 === 0 ? 2 : 3;
      const a = matrix(r, 2, inner, Math.max(lo, -6), Math.min(hi, 6)), b = matrix(r, inner, 2, Math.max(lo, -6), Math.min(hi, 6));
      c = { ...base, rows: 2, columns: inner, values: a, secondMatrix: { rows: inner, columns: 2, values: b }, expectedMatrix: productOf(a, b) };
    } else if (type === 'determinant') {
      const size = k % 2 === 0 ? 2 : 3;
      let a = matrix(r, size, size, lo, hi);
      while (determinantOf(a) === 0) a = matrix(r, size, size, lo, hi);
      c = { ...base, rows: size, columns: size, values: a, expectedScalar: determinantOf(a) };
    } else {
      let a: number[][] = [[2, 1], [1, 1]];
      for (let tries = 0; tries < 500; tries++) {
        const [p, q, s] = [int(r, -5, 5), int(r, -5, 5), int(r, -5, 5)];
        const det = r() < 0.5 ? 1 : -1;
        if (p === 0 || (det + q * s) % p !== 0) continue;
        const d = (det + q * s) / p;
        if (Math.abs(d) > 7) continue;
        a = [[p, q], [s, d]]; break;
      }
      c = { ...base, rows: 2, columns: 2, values: a, expectedMatrix: inverseOf(a) };
    }
    out.push(c);
  }
  return out;
}
const TYPES: MatrixChallengeType[] = ['transpose', 'add', 'subtract', 'multiply', 'determinant', 'inverse'];

describe('simplify builder', () => {
  it.each(TYPES)('%s: same operation, its own id and ask, other values and key, solvable, deterministic', (type) => {
    let built = 0;
    for (const c of items(type)) {
      const s = simplerMatrix(c);
      if (!s) continue;
      built++;
      expect(s.id).toBe(`${c.id}~simpler`);
      expect(s.challengeType).toBe(c.challengeType);
      expect(practiceLeaks(c, s)).toBe(false);
      // Smaller or the same size, never bigger.
      expect(s.values.flat().length).toBeLessThanOrEqual(c.values.flat().length);
      // Its own check accepts its own key.
      const work: MatrixWork = s.expectedScalar !== undefined
        ? { scalar: String(s.expectedScalar), cells: [] }
        : { scalar: '', cells: s.expectedMatrix!.map(row => row.map(String)) };
      expect(matrixCorrect(s, work)).toBe(true);
      expect(s.expectedMatrix?.flat().every(Number.isInteger) ?? true).toBe(true);
      expect(simplerMatrix(c)).toEqual(s);
      expect(simplerMatrix(s)).toBeNull();
    }
    expect(built).toBeGreaterThan(40);
  });

  it('an item already small and friendly has no easier version', () => {
    const add = { ...items('add')[0], values: [[1, 2], [3, 4]], secondMatrix: { rows: 2, columns: 2, values: [[1, 1], [2, 0]] } };
    expect(simplerMatrix(add)).toBeNull();
    const det = { ...items('determinant')[0], values: [[3, 1], [2, 4]], expectedScalar: 10 };
    expect(simplerMatrix(det)).toBeNull();
  });

  it('the leak rule refuses the learner\'s own values, ask, operation, and a determinant shown on a practice matrix', () => {
    const parent = items('determinant').find(c => c.values.length === 3)!;
    const kid = simplerMatrix(parent)!;
    expect(practiceLeaks(parent, { ...kid, values: parent.values })).toBe(true);
    expect(practiceLeaks(parent, { ...kid, instruction: parent.instruction })).toBe(true);
    expect(practiceLeaks(parent, { ...kid, challengeType: 'inverse' })).toBe(true);
    expect(practiceLeaks({ ...parent, expectedScalar: 4 }, { ...kid, values: [[4, 1], [1, 1]] })).toBe(true);
  });
});

describe('declarations', () => {
  it.each(Object.entries(MATRIX_MODE_TYPES))('%s: every catalog miss of each type is answered by a help lever on every item; no lever text or fact carries a digit; the model shows no answer number', (mode, types) => {
    expect(getComponentById('matrix-display')!.teachingWorkspace!.misses![mode]).toEqual(MATRIX_MISSES_BY_MODE[mode]);
    for (const type of types) for (const c of items(type)) {
      const levers = matrixLevers(c, []);
      const help = levers.filter(l => l.kind === 'help');
      for (const miss of MATRIX_MISSES_BY_TYPE[type]) expect(help.some(l => l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
      for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), l.id).toBe(false);
      expect(leverTextLeaks(leverFacts(c, levers.map(l => l.id), [1, 0]))).toBe(false);
      const model = matrixModel(c);
      expect(model, c.id).not.toBeNull();
      const taken = keySizes(c);
      for (const n of modelNumbers(model!)) expect(taken.has(Math.abs(n)), `${c.id} model ${n}`).toBe(false);
    }
  });

  it('each type gets its own picture levers; a practice problem has none', () => {
    const ids = (c: MatrixDisplayChallenge) => matrixLevers(c, []).map(l => l.id);
    const big = (type: MatrixChallengeType) => items(type).find(c => simplerMatrix(c))!;
    expect(ids(big('transpose'))).toEqual([ROW_BANDS_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    expect(ids(big('add'))).toEqual([POSITION_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    expect(ids(big('multiply'))).toEqual([ROW_COLUMN_LEVER, TERMS_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    expect(ids(items('determinant').find(c => c.values.length === 2 && simplerMatrix(c))!)).toEqual([DIAGONALS_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    expect(ids(items('determinant').find(c => c.values.length === 3)!)).toEqual([SIGNS_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    expect(ids(big('inverse'))).toEqual([LETTERS_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    expect(matrixLevers(simplerMatrix(big('multiply'))!, [])).toEqual([]);
  });

  // "This wrong answer, then this lever": the typed grid or number, the miss, the first open lever.
  const multiply: MatrixDisplayChallenge = { id: 'm', challengeType: 'multiply', instruction: 'x', hint: '', rows: 2, columns: 2,
    values: [[1, 2], [3, 4]], secondMatrix: { rows: 2, columns: 2, values: [[5, 6], [7, 8]] }, expectedMatrix: [[19, 22], [43, 50]] };
  const det: MatrixDisplayChallenge = { id: 'd', challengeType: 'determinant', instruction: 'x', hint: '', rows: 2, columns: 2,
    values: [[4, 3], [2, 5]], expectedScalar: 14 };
  const grid = (m: number[][]): MatrixWork => ({ scalar: '', cells: m.map(r => r.map(String)) });
  it.each([
    [multiply, grid([[5, 12], [21, 32]]), 'entrywise', ROW_COLUMN_LEVER],
    [multiply, grid([[5, 6], [15, 18]]), 'missed_term', TERMS_LEVER],
    [multiply, grid([[19, -22], [43, 50]]), 'sign_error', TERMS_LEVER],
    [det, { scalar: '26', cells: [] as string[][] }, 'added_products', DIAGONALS_LEVER],
    [det, { scalar: '40', cells: [] as string[][] }, 'too_high', DIAGONALS_LEVER],
  ] as const)('%#: %s', (c, work, miss, lever) => {
    expect(matrixMiss(c, work as MatrixWork)).toBe(miss);
    expect(nextLever(matrixLevers(c, []), miss)).toBe(lever);
  });

  it('with the first lever pulled, the next one for the same miss comes up', () => {
    expect(nextLever(matrixLevers(multiply, [ROW_COLUMN_LEVER]), 'entrywise')).toBe(TERMS_LEVER);
    expect(nextLever(matrixLevers(multiply, [ROW_COLUMN_LEVER, TERMS_LEVER]), 'entrywise')).toBe(MODEL_LEVER);
  });
});
