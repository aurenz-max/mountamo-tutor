import { describe, expect, it } from 'vitest';
import { BONDS_10, bondKey, bonds10Items, pickBonds10 } from './bonds10';
import { TIER_BANDS } from './index';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

describe('bonds-10 item space', () => {
  it('every item is a bond within 10 with parts 1..whole-1 and its answer in the unknown slot', () => {
    for (const it of bonds10Items()) {
      expect(it.whole).toBeGreaterThanOrEqual(2);
      expect(it.whole).toBeLessThanOrEqual(10);
      expect(it.known).toBeGreaterThanOrEqual(1);
      expect(it.known + it.other).toBe(it.whole);
      expect(BONDS_10.solve(it).answer).toBe(String(it.unknown === 'part' ? it.other : it.whole));
    }
  });

  it('a tier band yields distinct bonds inside it across more than two structures', () => {
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = pickBonds10(6, lo, hi);
      expect(picks).toHaveLength(6);
      expect(picks.every((p) => p.beta >= lo && p.beta <= hi)).toBe(true);
      expect(new Set(picks.map((p) => p.structure)).size).toBeGreaterThan(2);
      expect(new Set(picks.map(bondKey)).size).toBe(6);
    }
  });

  it('harder tiers hold missing parts of larger wholes; easier ones the anchors and missing wholes', () => {
    const share = (tier: keyof typeof TIER_BANDS, f: (p: ReturnType<typeof pickBonds10>[number]) => boolean) => {
      const picks = pickBonds10(8, ...TIER_BANDS[tier]);
      return picks.filter(f).length / picks.length;
    };
    expect(share('hard', (p) => p.unknown === 'part' && p.whole >= 7)).toBeGreaterThan(share('easy', (p) => p.unknown === 'part' && p.whole >= 7));
    expect(share('easy', (p) => p.features.partOne + p.features.double > 0 || p.unknown === 'whole'))
      .toBeGreaterThan(share('hard', (p) => p.features.partOne + p.features.double > 0 || p.unknown === 'whole'));
  });

  it('jitter control: items of one structure differ in beta only by whole size', () => {
    const groups = new Map<string, number[]>();
    for (const it of bonds10Items()) groups.set(it.structure, [...(groups.get(it.structure) ?? []), it.beta]);
    for (const betas of Array.from(groups.values())) expect(Math.max(...betas) - Math.min(...betas)).toBeLessThanOrEqual(1.0);
  });

  it('meets the ItemSpace contract: three distinct wrong options in 0..10, one far, a plain question that fits', () => {
    for (const it of bonds10Items()) {
      const sol = BONDS_10.solve(it);
      const d = BONDS_10.distractors(it);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.some((x) => x.value === sol.answer)).toBe(false);
      expect(d.every((x) => Number(x.value) >= 0 && Number(x.value) <= 10)).toBe(true);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
      expect(questionFitsSpec(BONDS_10.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
    }
  });
});
