import { describe, expect, it } from 'vitest';
import { compareItems, solveCompare } from '../itemSpace/compareStories';
import {
  comparisonChallengeFromItem, comparisonStoryFits, multiStepBars, multiStepChallengeFromItem, multiStepStoryFits,
  plainComparison, plainMultiStep,
} from './tapeDiagramItemSpace';
import { addSub20Items, solveAddSub20 } from '../itemSpace/addSub20';
/** TapeDiagram's WHOLE_SEGMENT (importing the component pulls Firebase into the test). */
const WHOLE_SEGMENT = -1;
import { tapeDiagramOracle } from '../qa/oracles/tape-diagram';

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

describe('tape-diagram multi_step: one part-whole bar per step', () => {
  const twoStep = addSub20Items().filter((it) => it.steps.length === 2);

  it('every add-sub-20 two-step item draws two bars whose wholes are their parts, the second starting from the first result', () => {
    for (const it of twoStep.filter((_, i) => i % 7 === 0)) {
      const ch = multiStepChallengeFromItem(it, plainMultiStep(it), 'add-sub-20', 'medium');
      const [s1, s2] = it.steps;
      expect(ch.bars).toHaveLength(2);
      const mid = s1.op === '+' ? s1.a + s1.b : s1.a - s1.b;
      ch.bars.forEach((bar) => {
        expect(bar.whole?.value).toBe(bar.segments.reduce((s, x) => s + (x.value ?? 0), 0));
        expect(bar.totalLabel).toBeUndefined();
      });
      const unknownOf = (b: number) => {
        const st = ch.multiStepData!.steps![b];
        return st.segment === WHOLE_SEGMENT ? ch.bars[st.bar].whole : ch.bars[st.bar].segments[st.segment];
      };
      expect(unknownOf(0)?.isUnknown).toBe(true);
      expect(unknownOf(0)?.value).toBe(mid);
      expect(unknownOf(1)?.value).toBe(solveAddSub20(it).answer);
      const carried = [ch.bars[1].whole!, ...ch.bars[1].segments].find((s) => s.carriedFromStep === 0);
      expect(carried?.value).toBe(mid);
      // Adding asks for the whole; taking away asks for the part left.
      expect(ch.multiStepData!.steps![1].segment).toBe(s2.op === '+' ? WHOLE_SEGMENT : 1);
      expect(multiStepStoryFits(it, plainMultiStep(it))).toBe(true);
      expect(tapeDiagramOracle.verify({ challenges: [ch, ch, ch].map((c, i) => ({ ...c, id: `c${i}` })) }, { topic: 'within 20', gradeLevel: 'grade 1' } as never)
        .violations.filter((v) => v.check === 'answer-key-desync')).toEqual([]);
    }
  });

  it('a story that states the intermediate or the answer does not fit', () => {
    const it = twoStep.find((x) => x.steps[0].a === 8 && x.steps[0].b === 6 && x.steps[0].op === '+' && x.steps[1].b === 5)!;
    const ok = { story: 'Ava has 8 shells. She finds 6 more. Then she gives 5 away. How many shells does Ava have now?', thing: 'shells', change1: 'found', change2: 'given away' };
    expect(multiStepStoryFits(it, ok)).toBe(true);
    expect(multiStepStoryFits(it, { ...ok, story: 'Ava has 8 shells. She finds 6 more, so she has 14. Then she gives 5 away. How many shells does Ava have now?' })).toBe(false);
    expect(multiStepStoryFits(it, { ...ok, story: 'Ava has 8 shells, finds 6 and gives 5 away, leaving 9. How many shells does Ava have?' })).toBe(false);
  });

  it('the oracle flags the old one-bar shape ("Total = 37" for 8 + 6 - 5)', () => {
    const old = {
      id: 'c1', challengeType: 'multi_step',
      bars: [{ segments: [{ value: 8, label: 'a' }, { value: 6, label: 'b' }, { value: 14, label: 'm', isUnknown: true }, { value: 9, label: 'r', isUnknown: true }], totalLabel: 'Total = 37' }],
    };
    const v = tapeDiagramOracle.verify({ challenges: [old, { ...old, id: 'c2' }, { ...old, id: 'c3' }] }, { topic: 't', gradeLevel: 'grade 1' } as never).violations;
    expect(v.some((x) => /total over the chain/.test(x.detail))).toBe(true);
  });

  it('multiStepBars refuses a chain that drops below one', () => {
    expect(multiStepBars(5, 'a', [{ op: '-', value: 5, label: 'x', resultLabel: 'y' }])).toBeNull();
  });
});
