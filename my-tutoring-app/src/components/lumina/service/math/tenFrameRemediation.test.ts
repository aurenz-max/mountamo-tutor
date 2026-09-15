import { expect, it } from 'vitest';
import {
  compiledSameFirstContrast, eligibleTenFrameTeaching, legalSeconds, selectSameFirstContrast, tenFrameDeliveryEligible, tenFrameTeachingFor,
} from './tenFrameRemediation';
import type { TenFrameChallenge } from '../../primitives/visual-primitives/math/TenFrame';
import { itemsFromChallenges } from '../../primitives/visual-primitives/math/tenFrameScript';

const MOVE = 'contrast_same_first_number_different_second' as const;
const sub = (id: string, start: number, removed: number): TenFrameChallenge =>
  ({ id, type: 'subtract', startCount: start, targetCount: start - removed, instruction: '', hint: 'h', narration: 'n' });
const add = (id: string, a: number, b: number): TenFrameChallenge =>
  ({ id, type: 'add', addend1: a, addend2: b, targetCount: a + b, instruction: '', hint: 'h', narration: 'n' });
const seeded = (seed: number) => () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
const said = (c: TenFrameChallenge) => (c.type === 'add' ? `${c.addend1}+${c.addend2}` : `${c.startCount}-${c.startCount! - c.targetCount}`);
const crosses = (c: TenFrameChallenge) => (c.type === 'add' ? c.addend1! < 10 && c.targetCount > 10 : c.startCount! > 10 && c.targetCount < 10);

it('gates: operate only, Kindergarten to Grade 2', () => {
  for (const grade of ['K', 'k', '1', '2']) expect(eligibleTenFrameTeaching({ grade, mode: 'operate' })).toBe(true);
  for (const mode of ['make_ten', 'subitize', 'build', 'decompose', 'build_teen', 'decompose_teen', undefined]) {
    expect(eligibleTenFrameTeaching({ grade: '1', mode })).toBe(false);
    expect(tenFrameTeachingFor(mode)).toBeNull();
  }
  expect(eligibleTenFrameTeaching({ grade: '3', mode: 'operate' })).toBe(false);
  expect(eligibleTenFrameTeaching({ mode: 'operate' })).toBe(false);
  expect(tenFrameDeliveryEligible({ targetEvalMode: 'operate' })).toBe(true);
  expect(tenFrameDeliveryEligible({ targetEvalMode: 'make_ten' })).toBe(false);
  expect(tenFrameDeliveryEligible({})).toBe(false);
});

it('compiled recheck: neighbouring items of one operation with the same first number and a different second', () => {
  expect(compiledSameFirstContrast([sub('a', 7, 1), sub('b', 7, 3)], 10)).toEqual({ targets: ['a', 'b'], count: 2 });
  expect(compiledSameFirstContrast([add('a', 8, 3), add('b', 8, 5)], 20).count).toBe(2);
  expect(compiledSameFirstContrast([sub('a', 7, 3), sub('b', 7, 3)], 10).count).toBe(0);      // same item twice
  expect(compiledSameFirstContrast([sub('a', 5, 2), sub('b', 6, 2)], 10).count).toBe(0);      // same second, different first
  expect(compiledSameFirstContrast([add('a', 3, 4), sub('b', 3, 1)], 10).count).toBe(0);      // different operations
  expect(compiledSameFirstContrast([sub('a', 7, 1), sub('x', 9, 2), sub('b', 7, 3)], 10).count).toBe(0); // not neighbours
  expect(compiledSameFirstContrast([add('a', 8, 3), add('b', 8, 5)], 10).count).toBe(0);      // 13 does not fit one frame
  expect(compiledSameFirstContrast([{ ...add('a', 3, 1), targetCount: 5 }, add('b', 3, 2)], 10).count).toBe(0); // key does not close
});

it('legal second numbers stay inside the session bounds, keep the ten-crossing, and never answer with a said number', () => {
  expect(legalSeconds('subtract', 8, { maxAnswer: 5, maxSecond: 5, crosses: false })).toEqual([3, 5]); // 8-4=4 answers with the 4
  expect(legalSeconds('add', 8, { maxAnswer: 14, maxSecond: 6, crosses: true })).toEqual([3, 4, 5, 6]);
  expect(legalSeconds('add', 8, { maxAnswer: 14, maxSecond: 6, crosses: false })).toEqual([1, 2]);
  expect(legalSeconds('subtract', 15, { maxAnswer: 9, maxSecond: 9, crosses: true })).toEqual([6, 7, 8, 9]);
  expect(legalSeconds('add', 2, { maxAnswer: 5, maxSecond: 3, crosses: false })).toEqual([1, 2, 3]);
  expect(legalSeconds('subtract', 6, { maxAnswer: 5, maxSecond: 5, crosses: false })).toEqual([1, 2, 4, 5]); // 6-3 answers with the 3
});

it('selector: one rewritten item follows its neighbour; count, ids, operations, crossing, bounds and distinct items hold', () => {
  const baselines = [
    [sub('c1', 5, 2), sub('c2', 6, 2), sub('c3', 7, 5), sub('c4', 8, 3), sub('c5', 9, 5)],
    [add('c1', 1, 1), add('c2', 2, 1), add('c3', 4, 1), add('c4', 2, 3)],
    [add('c1', 8, 3), add('c2', 7, 5), add('c3', 9, 5), sub('c4', 13, 7), sub('c5', 15, 7)],
    [sub('c1', 5, 2), sub('c2', 6, 2), add('c3', 4, 3), sub('c4', 8, 6), sub('c5', 10, 5)],
  ];
  baselines.forEach((baseline, b) => {
    const capacity = b === 2 ? 20 : 10;
    for (let seed = 1; seed <= 30; seed++) {
      const out = selectSameFirstContrast(baseline, MOVE, capacity, seeded(seed));
      expect(out.status, `baseline ${b}`).toBe('targeted');
      expect(out.challenges.map(c => [c.id, c.type])).toEqual(baseline.map(c => [c.id, c.type]));
      const changed = out.challenges.map((c, i) => (c === baseline[i] ? -1 : i)).filter(i => i >= 0);
      expect(changed).toHaveLength(1);
      const [i] = changed;
      const [prev, next] = [out.challenges[i - 1], out.challenges[i]];
      expect(prev.type).toBe(next.type);
      expect(next.type === 'add' ? next.addend1 : next.startCount).toBe(prev.type === 'add' ? prev.addend1 : prev.startCount);
      expect(crosses(next)).toBe(crosses(baseline[i]));
      const sameType = baseline.filter(c => c.type === next.type);
      expect(next.targetCount).toBeLessThanOrEqual(Math.max(...sameType.map(c => c.targetCount)));
      expect(new Set(out.challenges.map(said)).size).toBe(out.challenges.length);
      expect(out.count).toBeGreaterThanOrEqual(2);
      expect(itemsFromChallenges(out.challenges, { capacity, band: capacity === 20 ? '1-2' : 'K' })).toHaveLength(baseline.length);
    }
  });
});

it('selector keeps a neighbouring same-second pair the baseline already had when another slot works', () => {
  const baseline = [sub('c1', 5, 2), sub('c2', 6, 2), sub('c3', 7, 5), sub('c4', 8, 3), sub('c5', 9, 5)];
  for (let seed = 1; seed <= 30; seed++) {
    const out = selectSameFirstContrast(baseline, MOVE, 10, seeded(seed));
    expect(out.challenges.slice(0, 2)).toEqual(baseline.slice(0, 2));
  }
});

it('already-targeted, no focus and a capacity miss return the baseline unchanged', () => {
  const targeted = [sub('c1', 7, 1), sub('c2', 7, 3), sub('c3', 9, 2)];
  expect(selectSameFirstContrast(targeted, MOVE, 10)).toMatchObject({ status: 'already-targeted', challenges: targeted, count: 2 });
  const plain = [sub('c1', 5, 2), sub('c2', 8, 3)];
  expect(selectSameFirstContrast(plain, null, 10)).toMatchObject({ status: 'no-focus', challenges: plain });
  // Alternating operations: no two neighbours share an operation.
  const alternating = [add('c1', 2, 1), sub('c2', 4, 2), add('c3', 2, 2), sub('c4', 5, 2)];
  expect(selectSameFirstContrast(alternating, MOVE, 10)).toMatchObject({ status: 'insufficient-capacity', challenges: alternating });
  expect(selectSameFirstContrast([sub('c1', 5, 2)], MOVE, 10).status).toBe('insufficient-capacity');
  expect(selectSameFirstContrast([sub('c1', 5, 2), { ...sub('c2', 6, 2), type: 'make_ten' }], MOVE, 10).status).toBe('insufficient-capacity');
  // 2-1 then 3-1: the only first number to follow is 2, whose only other second number (2) answers 0.
  const noRoom = [sub('c1', 2, 1), sub('c2', 3, 1)];
  expect(selectSameFirstContrast(noRoom, MOVE, 10)).toMatchObject({ status: 'insufficient-capacity', challenges: noRoom });
});
