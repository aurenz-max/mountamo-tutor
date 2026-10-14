import { describe, expect, it } from 'vitest';
import { ADD_SUB_20, addSub20Distractors, addSub20Items, pickAddSub20, solveAddSub20, structureOf } from './addSub20';
import { difficultyBand, TIER_BANDS } from './index';
import { questionFitsSpec } from '../knowledge-check/itemSpaceProblems';

describe('add-sub-20 item space', () => {
  it('every item is inside 1..20 at every step and its answer is the unknown slot', () => {
    for (const it of addSub20Items()) {
      for (const s of it.steps) {
        const r = s.op === '+' ? s.a + s.b : s.a - s.b;
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(20);
      }
      const { answer, shown } = solveAddSub20(it);
      const s = it.steps[0];
      if (it.steps.length === 1 && it.unknown === 'change') expect(answer).toBe(s.b);
      if (it.steps.length === 1 && it.unknown === 'start') expect(answer).toBe(s.a);
      expect(shown.length).toBe(it.steps.length === 2 ? 3 : 2);
    }
  });

  it('a tier band yields items inside it, across more than one structure, with no repeats', () => {
    for (const [lo, hi] of Object.values(TIER_BANDS)) {
      const picks = pickAddSub20(8, lo, hi);
      expect(picks).toHaveLength(8);
      expect(picks.every((p) => p.beta >= lo && p.beta <= hi)).toBe(true);
      expect(new Set(picks.map(structureOf)).size).toBeGreaterThan(2);
      expect(new Set(picks.map((p) => solveAddSub20(p).expr)).size).toBe(8);
    }
  });

  it('harder tiers hold harder structures: two steps, crossing ten, a hidden start', () => {
    const share = (tier: keyof typeof TIER_BANDS, f: (p: ReturnType<typeof pickAddSub20>[number]) => boolean) => {
      const picks = pickAddSub20(40, ...TIER_BANDS[tier]);
      return picks.filter(f).length / picks.length;
    };
    const hard = (p: ReturnType<typeof pickAddSub20>[number]) => p.features.twoStep + p.features.bridges + p.features.unknownStart > 0;
    expect(share('hard', hard)).toBeGreaterThan(share('easy', hard));
  });

  it('three wrong options, never the answer, within 20, at least one far', () => {
    for (const it of pickAddSub20(60, -3, 4)) {
      const d = addSub20Distractors(it);
      const { answer } = solveAddSub20(it);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.every((x) => x.value !== answer && x.value >= 0 && x.value <= 20)).toBe(true);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
    }
  });

  it('difficulty band: a tier maps to its band; an unknown or missing tier is none', () => {
    expect(difficultyBand('Medium')).toEqual(TIER_BANDS.medium);
    expect(difficultyBand('challenging')).toBeNull();
    expect(difficultyBand(undefined)).toBeNull();
  });

  it('a written question must keep the given numbers, ask, and not state the answer', () => {
    expect(questionFitsSpec('Sam has 9 apples and gets 6 more. How many now?', ['9', '6'], '15')).toBe(true);
    expect(questionFitsSpec('Sam has 9 apples and gets 6 more, so 15. How many now?', ['9', '6'], '15')).toBe(false);
    expect(questionFitsSpec('Sam has 9 apples and gets 6 more.', ['9', '6'], '15')).toBe(false);
    expect(questionFitsSpec('Sam has 9 apples and gets more. How many now?', ['9', '6'], '15')).toBe(false);
    expect(questionFitsSpec('Sam has 8 apples, eats 4, then picks 4. How many now?', ['8', '4', '4'], '8')).toBe(true);
    // Quantities are tokens, so a strand whose answers are not whole numbers uses the same check.
    expect(questionFitsSpec('Ana eats 1/4 of a pizza and Ben eats 2/4. How much is eaten?', ['1/4', '2/4'], '3/4')).toBe(true);
    expect(questionFitsSpec('Ana eats 1/4 and Ben eats 2/4, so 3/4 is gone. How much is eaten?', ['1/4', '2/4'], '3/4')).toBe(false);
  });

  it('meets the ItemSpace contract: picks in band, three distinct wrong options, a plain question that fits', () => {
    for (const it of ADD_SUB_20.pick(40, -3, 4)) {
      const sol = ADD_SUB_20.solve(it);
      const d = ADD_SUB_20.distractors(it);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.value)).size).toBe(3);
      expect(d.some((x) => x.value === sol.answer)).toBe(false);
      expect(d.some((x) => x.distance === 'far')).toBe(true);
      expect(questionFitsSpec(ADD_SUB_20.plainQuestion(it), sol.shown, sol.answer)).toBe(true);
    }
  });
});
