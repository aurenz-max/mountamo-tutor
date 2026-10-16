import { describe, expect, it } from 'vitest';
import { namedNumberRange } from './numberScope';
import { COMPARE_NUMBERS } from './compareNumbers';
import { COMPARE_100 } from './compareStories';
import { tierPick, TIER_BANDS } from './index';
import { mathSymbolOptions } from '../knowledge-check/gemini-knowledge-check';

describe('8.1c: compare spaces take the range an objective names', () => {
  it('reads the range words', () => {
    expect(namedNumberRange('Compare two two-digit numbers using >, =, <')).toEqual({ min: 10, max: 99 });
    expect(namedNumberRange('Compare numbers within 20')).toEqual({ min: 0, max: 20 });
    expect(namedNumberRange('teen numbers')).toEqual({ min: 11, max: 19 });
    expect(namedNumberRange('Compare two numbers')).toBeUndefined();
  });

  it('a two-digit objective draws only two-digit pairs at every tier', () => {
    const scope = COMPARE_NUMBERS.scopeOf!('Compare two two-digit numbers based on meanings of the tens and ones digits')!;
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = tierPick(COMPARE_NUMBERS, undefined, scope)(5, lo, hi, Math.random, scope);
      expect(picks.length).toBe(5);
      for (const p of picks) expect(Math.min(p.left, p.right)).toBeGreaterThanOrEqual(10);
    }
  });

  it('compare stories within 50 state no amount above 50', () => {
    const scope = COMPARE_100.scopeOf!('Solve comparison word problems within 50')!;
    expect(COMPARE_100.items!().filter(scope).every((it) => it.larger <= 50)).toBe(true);
  });
});

describe('8.1c: symbol questions offer only math symbols', () => {
  it('replaces a glyph far option with an unused math symbol and keeps its tag', () => {
    const out = mathSymbolOptions([
      { id: 'A', text: '<', distance: 'key' }, { id: 'B', text: '>', distance: 'near' },
      { id: 'C', text: '=', distance: 'near' }, { id: 'D', text: '十', distance: 'far' },
    ], 'A');
    expect(out.map((o) => o.text)).toEqual(['<', '>', '=', '+']);
    expect(out[3].distance).toBe('far');
  });

  it('leaves a question whose key is not a symbol alone', () => {
    const opts = [{ id: 'A', text: '12' }, { id: 'B', text: 'twelve' }];
    expect(mathSymbolOptions(opts, 'A')).toBe(opts);
  });
});
