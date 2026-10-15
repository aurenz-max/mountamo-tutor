import { describe, expect, it } from 'vitest';
import { compareItems, solveCompare } from '../itemSpace/compareStories';
import { comparisonChallengeFromItem, comparisonStoryFits, plainComparison } from './tapeDiagramItemSpace';

describe('tape-diagram comparison from the compare spaces', () => {
  for (const max of [20, 100] as const) {
    it(`compare-${max}: every item draws two bars, bar 1 the larger, and the one unknown segment holds the answer`, () => {
      for (const it of compareItems(max).filter((_, i) => i % (max === 20 ? 1 : 29) === 0)) {
        const ch = comparisonChallengeFromItem(it, plainComparison(it), `compare-${max}`);
        const unknowns = ch.bars.flatMap((b) => b.segments.filter((s) => s.isUnknown));
        expect(unknowns).toHaveLength(1);
        expect(unknowns[0].value).toBe(solveCompare(it).answer);
        const len = (i: number) => ch.bars[i].segments.reduce((s, x) => s + (x.value ?? 0), 0);
        expect(len(0)).toBe(it.larger);
        expect(len(1)).toBe(it.smaller);
        expect(ch.comparisonData?.comparisonWord).toBe(it.wording);
        expect(comparisonStoryFits(it, plainComparison(it))).toBe(true);
      }
    });
  }

  it('rejects a story that states the answer, drops a number, uses the other word or swaps in an unnamed owner', () => {
    const it = compareItems(20).find((x) => x.larger === 13 && x.smaller === 8 && x.unknown === 'smaller' && x.wording === 'more')!;
    const ok = { story: 'Liam has 13 shells. Liam has 5 more shells than Zoe. How many shells does Zoe have?', largerLabel: "Liam's shells", smallerLabel: "Zoe's shells" };
    expect(comparisonStoryFits(it, ok)).toBe(true);
    expect(comparisonStoryFits(it, { ...ok, story: 'Liam has 13 shells, 5 more than Zoe, who has 8. How many shells does Zoe have?' })).toBe(false);
    expect(comparisonStoryFits(it, { ...ok, story: 'Liam has 13 shells. Zoe has fewer. How many shells does Zoe have?' })).toBe(false);
    expect(comparisonStoryFits(it, { ...ok, story: 'Liam has 13 shells. Zoe has 5 fewer shells than Liam. How many shells does Zoe have?' })).toBe(false);
    expect(comparisonStoryFits(it, { ...ok, smallerLabel: "Mia's shells" })).toBe(false);
    expect(comparisonStoryFits(it, { ...ok, largerLabel: '13 shells' })).toBe(false);
  });
});
