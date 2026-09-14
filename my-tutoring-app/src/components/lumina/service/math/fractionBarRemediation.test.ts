import { expect, it } from 'vitest';
import { compiledSharedDigitRoleContrast, eligibleFractionBarTeaching, selectSharedDigitRoleContrast } from './fractionBarRemediation';
import type { FractionBarChallenge } from '../../primitives/visual-primitives/math/FractionBar';

// Mirrors the generator's 'wide' builder shape: both numbers of the fraction are offered.
const choicesFor = ({ numerator: n, denominator: d }: { numerator: number; denominator: number }) => ({
  numeratorChoices: [n, d, n - 1, n + 1], denominatorChoices: [d, n, d - 1, d + 1] });
const fraction = (n: number, d: number, i: number): FractionBarChallenge => ({ id: `fraction-bar-${i + 1}`, numerator: n, denominator: d, ...choicesFor({ numerator: n, denominator: d }) });
const set = (...pairs: [number, number][]) => pairs.map(([n, d], i) => fraction(n, d, i));
const seeded = (seed = 7) => () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
const keys = (list: readonly FractionBarChallenge[]) => list.map(c => `${c.numerator}/${c.denominator}`);

it('offers the move only for build, where fractions are non-unit', () => {
  expect(eligibleFractionBarTeaching({ mode: 'build', tier: 'hard' })).toBe(true);
  for (const mode of ['identify', 'compare', 'add_subtract', undefined]) expect(eligibleFractionBarTeaching({ mode, tier: 'medium' })).toBe(false);
});

it('recognizes only consecutive fractions whose shared number changes role with both numbers offered', () => {
  expect(compiledSharedDigitRoleContrast(set([3, 4], [4, 5], [2, 6])).targets).toEqual(['fraction-bar-1', 'fraction-bar-2']);
  expect(compiledSharedDigitRoleContrast(set([3, 4], [2, 6], [4, 5])).count).toBe(0);
  expect(compiledSharedDigitRoleContrast(set([3, 4], [3, 5])).count).toBe(0); // same role, no contrast
  const withheld = set([3, 4], [4, 5]);
  withheld[1] = { ...withheld[1], denominatorChoices: [5, 6, 7, 3] };
  expect(compiledSharedDigitRoleContrast(withheld).count).toBe(0);
});

it('leaves content unchanged without a move or when the contrast already exists', () => {
  const baseline = set([3, 4], [4, 5], [2, 6]);
  expect(selectSharedDigitRoleContrast(baseline, null, choicesFor)).toMatchObject({ challenges: baseline, status: 'no-focus' });
  expect(selectSharedDigitRoleContrast(baseline, 'contrast_shared_digit_roles', choicesFor)).toMatchObject({ challenges: baseline, status: 'already-targeted', count: 2 });
});

it('reorders an existing non-adjacent pair before changing any fraction', () => {
  const baseline = set([3, 4], [2, 6], [4, 5]);
  const out = selectSharedDigitRoleContrast(baseline, 'contrast_shared_digit_roles', choicesFor, seeded());
  expect(out.status).toBe('targeted');
  expect(keys(out.challenges).sort()).toEqual(keys(baseline).sort());
  expect(keys(out.challenges)).toEqual(['3/4', '4/5', '2/6']);
  expect(out.challenges.map(c => c.id)).toEqual(['fraction-bar-1', 'fraction-bar-2', 'fraction-bar-3']);
});

it('replaces one fraction within the build window when no pair exists, holding count and uniqueness', () => {
  const baseline = set([2, 3], [2, 5], [2, 6]); // every numerator is 2 and no denominator is 2
  for (let seed = 1; seed <= 25; seed++) {
    const out = selectSharedDigitRoleContrast(baseline, 'contrast_shared_digit_roles', choicesFor, seeded(seed));
    expect(out.status).toBe('targeted');
    expect(out.count).toBe(2);
    expect(out.challenges).toHaveLength(3);
    expect(new Set(keys(out.challenges)).size).toBe(3);
    expect(out.challenges.every(c => c.numerator >= 2 && c.numerator < c.denominator && c.denominator >= 3 && c.denominator <= 6)).toBe(true);
    expect(keys(out.challenges).filter((k, i) => k !== keys(baseline)[i])).toHaveLength(1);
  }
});

it('reports insufficient capacity instead of fabricating targeting outside the window', () => {
  for (const baseline of [set([1, 4], [1, 6]), set([3, 8], [4, 5]), set([3, 4]), set([3, 4], [3, 4])]) {
    const out = selectSharedDigitRoleContrast(baseline, 'contrast_shared_digit_roles', choicesFor);
    expect(out).toMatchObject({ challenges: baseline, status: 'insufficient-capacity' });
  }
});
