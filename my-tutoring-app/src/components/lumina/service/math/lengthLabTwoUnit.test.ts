import { describe, expect, it } from 'vitest';
import { twoUnitItems } from './lengthLabTwoUnit';

describe('length-lab two_unit_compare items (8.1i)', () => {
  it('the answer is the unit with the larger count, and it is the first unit on some items and the second on others', () => {
    let first = 0;
    let second = 0;
    for (const tier of ['easy', 'medium', 'hard', null] as const) {
      for (let run = 0; run < 20; run++) {
        const items = twoUnitItems(tier, 4, 'cubes');
        for (const it of items) {
          const more = it.correctUnitCount > it.correctUnitCountB ? it.unitType : it.unitTypeB;
          expect(it.correctAnswer).toBe(more);
          expect(it.unitType).not.toBe(it.unitTypeB);
          expect(it.objectLength0).toBeLessThanOrEqual(12);
          // Whole units both times.
          expect(Number.isInteger(it.objectLength0 / it.correctUnitCount)).toBe(true);
          expect(Number.isInteger(it.objectLength0 / it.correctUnitCountB)).toBe(true);
          if (more === it.unitType) first++; else second++;
        }
        expect(new Set(items.map((it) => it.correctAnswer === it.unitType)).size).toBe(2);
      }
    }
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(0);
  });

  it('the tier sets the units: easy 1 and 3 cubes wide, medium 1 and 2, hard 2 and 3', () => {
    const ratio = (it: ReturnType<typeof twoUnitItems>[number]) =>
      Math.max(it.correctUnitCount, it.correctUnitCountB) / Math.min(it.correctUnitCount, it.correctUnitCountB);
    expect(twoUnitItems('easy', 3, 'cubes').every((it) => ratio(it) === 3)).toBe(true);
    expect(twoUnitItems('medium', 3, 'cubes').every((it) => ratio(it) === 2)).toBe(true);
    expect(twoUnitItems('hard', 3, 'cubes').every((it) => ratio(it) === 1.5 && !['cubes'].includes(it.unitType))).toBe(true);
  });
});
