import { describe, expect, it } from 'vitest';
import { ratioItems, ratioAnswer } from '../itemSpace/ratioMissingValue';
import { plainRatio, ratioChallengeFromItem, ratioStoryFits, ratioTableAccepts } from './ratioTableItemSpace';
import { ratioKey, shownMultiplier, formatNum } from '../../primitives/visual-primitives/math/ratioTableWorkspace';

describe('ratio-table from the ratio space', () => {
  for (const mode of ['missing-value', 'unit-rate'] as const) {
    it(`${mode}: every drawable item maps to a challenge whose key is the item's answer; the plain story fits`, () => {
      const drawable = ratioItems().filter((it) => ratioTableAccepts(mode, it));
      expect(drawable.length).toBeGreaterThan(30);
      for (const it of drawable) {
        const ch = ratioChallengeFromItem(mode, it, plainRatio(mode, it), 0);
        expect(Math.abs(ratioKey(ch) - ratioAnswer(it))).toBeLessThan(1e-6);
        if (mode === 'missing-value') {
          const m = shownMultiplier(ch);
          if (m !== null) expect(Number(formatNum(m))).toBeCloseTo(m, 6);
        }
        expect(ratioStoryFits(mode, it, plainRatio(mode, it))).toBe(true);
      }
    });
  }

  it('rejects a story that states the answer or adds a number', () => {
    const it = ratioItems().find((x) => x.a === 4 && x.b === 6 && x.k === 10 && x.hidden === 'second')!;
    const ok = { instruction: 'A mix uses 4 cups of water for 6 cups of juice. How much juice for 10 cups of water?', firstLabel: 'Water (cups)', secondLabel: 'Juice (cups)' };
    expect(ratioStoryFits('missing-value', it, ok)).toBe(true);
    expect(ratioStoryFits('missing-value', it, { ...ok, instruction: 'A mix uses 4 cups of water for 6 cups of juice, so 10 cups make 15. How much juice?' })).toBe(false);
    expect(ratioStoryFits('missing-value', it, { ...ok, instruction: 'A mix uses 4 cups of water for 6 cups of juice in 2 jugs. How much juice for 10 cups of water?' })).toBe(false);
  });
});
