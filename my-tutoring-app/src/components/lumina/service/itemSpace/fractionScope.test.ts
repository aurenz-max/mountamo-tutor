import { describe, it, expect } from 'vitest';
import { FRACTION_ADD_SUB } from './fractionAddSub';
import { TIER_BANDS, tierPick } from './index';

describe('fraction-add-sub scope', () => {
  it('an unlike-denominators objective draws no like-denominator item at any tier', () => {
    const scope = FRACTION_ADD_SUB.scopeOf!('Add and subtract fractions with unlike denominators')!;
    const pick = tierPick(FRACTION_ADD_SUB, undefined, scope);
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const items = pick(4, lo, hi, undefined, scope);
      expect(items).toHaveLength(4);
      expect(items.every((it) => it.b !== it.d)).toBe(true);
    }
  });

  it('like denominators keeps the like part; no named part keeps the whole strand', () => {
    expect(FRACTION_ADD_SUB.scopeOf!('Add fractions with like denominators')!({ b: 4, d: 4 } as any)).toBe(true);
    expect(FRACTION_ADD_SUB.scopeOf!('Add fractions with like denominators')!({ b: 4, d: 8 } as any)).toBe(false);
    expect(FRACTION_ADD_SUB.scopeOf!('Add and subtract fractions')).toBeUndefined();
  });
});
