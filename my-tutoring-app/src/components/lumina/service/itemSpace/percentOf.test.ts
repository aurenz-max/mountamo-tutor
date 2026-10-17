import { describe, expect, it } from 'vitest';
import { PERCENT_OF, percentAnswer, percentItems, percentKind } from './percentOf';
import { TIER_BANDS } from './index';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

describe('percent-of', () => {
  it('every item is a whole-dollar part of a whole, never on a whole of 100', () => {
    for (const it of percentItems()) {
      expect(it.part).toBe((it.percent * it.whole) / 100);
      expect(Number.isInteger(it.part) && it.part >= 1).toBe(true);
      expect(it.whole).not.toBe(100);
      expect(percentAnswer(it)).toBe(it.unknown === 'part' ? it.part : it.whole);
    }
  });

  it('each tier fills 4 distinct items for each unknown; easy is benchmarks, hard is never one', () => {
    for (const unknown of ['part', 'whole'] as const) {
      const kinds = Object.values(TIER_BANDS).map(([lo, hi]) => {
        const picks = PERCENT_OF.pick(4, lo, hi, Math.random, (it) => it.unknown === unknown);
        expect(picks).toHaveLength(4);
        expect(new Set(picks.map((p) => `${p.percent}|${p.whole}`)).size).toBe(4);
        expect(new Set(picks.map((p) => p.percent)).size).toBeGreaterThan(1);
        return picks.map((p) => percentKind(p.percent));
      });
      for (const k of kinds[0]) expect(['tenth', 'half', 'quarter', 'threeQuarters']).toContain(k);
      for (const k of kinds[2]) expect(['tenth', 'half', 'quarter']).not.toContain(k);
    }
  });

  it('finding the whole is harder than finding the part on the same numbers', () => {
    const items = percentItems();
    for (const it of items.filter((x) => x.unknown === 'part')) {
      const inverse = items.find((x) => x.unknown === 'whole' && x.percent === it.percent && x.whole === it.whole);
      if (!inverse) continue; // a whole equal to the percent has no find-whole twin
      expect(inverse.beta).toBeGreaterThan(it.beta - 0.31);
    }
  });

  it('contract: three distinct wrong options, one far, never the key; a plain question that fits', () => {
    for (const it of percentItems().filter((_, i) => i % 4 === 0)) {
      const sol = PERCENT_OF.solve(it);
      const d = PERCENT_OF.distractors(it);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.some((x) => x.value === sol.answer)).toBe(false);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
      expect(questionFitsSpec(PERCENT_OF.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
    }
  });
});
