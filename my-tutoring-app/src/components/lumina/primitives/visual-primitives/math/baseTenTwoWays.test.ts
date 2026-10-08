/**
 * build_two_ways (base-ten-blocks' open build), pure: the check, the levers' answers and leak rules, and the
 * generator's code-owned targets. The mounted flow is BaseTenBlocks.twoWays.workspace.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { baseTenLevers, leverFacts, smallerTwoWaysNumber, startLevers, COUNTS_LEVER, SMALLER_LEVER, TEN_MODEL_LEVER }
  from './baseTenLevers';
import { describeTwoWaysCheck, sameWay, twoWaysInstruction, twoWaysMiss, twoWaysScene } from './baseTenWorkspace';
import { normalizeTwoWaysTargets } from '../../../service/math/gemini-base-ten-blocks';
import type { BaseTenBlocksChallenge } from './BaseTenBlocks';
import { MATH_CATALOG } from '../../../service/manifest/catalog/math';

const miss = (target: number, now: Record<string, number>, first: Record<string, number> | null = null) => {
  const got = (now.hundreds ?? 0) * 100 + (now.tens ?? 0) * 10 + (now.ones ?? 0);
  return twoWaysMiss({ got, target, unit: 1, now, first });
};
const reversed = (n: number) => Number(String(n).split('').reverse().join(''));

describe('the check: the value, then different from the first way', () => {
  it('any blocks with the value pass the first way, standard or not', () => {
    expect(miss(34, { tens: 3, ones: 4 })).toBeUndefined();
    expect(miss(34, { tens: 2, ones: 14 })).toBeUndefined();
    expect(miss(34, { ones: 34 })).toBeUndefined();
  });
  it('a value off by a ten or by one is named', () => {
    expect(miss(34, { tens: 2, ones: 4 })).toBe('one_ten_off');
    expect(miss(34, { tens: 4, ones: 4 })).toBe('one_ten_off');
    expect(miss(34, { tens: 3, ones: 3 })).toBe('one_short');
    expect(miss(34, { tens: 3, ones: 5 })).toBe('one_over');
    expect(miss(34, { tens: 4, ones: 3 })).toBe('digits_swapped');
    expect(miss(34, { tens: 1 })).toBe('short_by_more');
  });
  it('the second way must differ from the first', () => {
    expect(miss(34, { tens: 3, ones: 4 }, { tens: 3, ones: 4 })).toBe('same_as_first');
    expect(miss(34, { hundreds: 0, tens: 3, ones: 4 }, { tens: 3, ones: 4 })).toBe('same_as_first');
    expect(miss(34, { tens: 2, ones: 14 }, { tens: 3, ones: 4 })).toBeUndefined();
    // A wrong value on the second way is the value miss, not same_as_first.
    expect(miss(34, { tens: 2, ones: 4 }, { tens: 3, ones: 4 })).toBe('one_ten_off');
    expect(sameWay({ tens: 1 }, { tens: 1, ones: 0 })).toBe(true);
  });
  it('the check sent to the tutor is the learner\'s blocks in words, never the value', () => {
    const places = ['hundreds', 'tens', 'ones'];
    expect(describeTwoWaysCheck({ tens: 3, ones: 4 }, null, places)).toBe('First way: 3 tens and 4 ones');
    expect(describeTwoWaysCheck({ tens: 2, ones: 14 }, { tens: 3, ones: 4 }, places))
      .toBe('Second way: 2 tens and 14 ones (first way: 3 tens and 4 ones)');
  });
  it('the scene publishes the made value and each place as numbers, and no key', () => {
    const scene = twoWaysScene({ columns: { tens: 2, ones: 14 }, places: ['hundreds', 'tens', 'ones'], value: 34, first: null });
    expect(scene.facts).toMatchObject({ way: 'first', valueMade: 34, hundredsOnMat: 0, tensOnMat: 2, onesOnMat: 14 });
    expect(Object.values(scene.facts).filter(v => typeof v === 'number')).toHaveLength(4);
  });
});

describe('levers', () => {
  const item = { type: 'build_two_ways', targetNumber: 34 };
  it('start bare at every tier, whatever the flags say', () => {
    expect(startLevers('build_two_ways', {})).toEqual([]);
    expect(startLevers('build_two_ways', { showColumnCounts: true, showBlocksTotal: true })).toEqual([]);
  });
  it('every catalog miss for the mode is answered by a lever', () => {
    const entry = MATH_CATALOG.find(c => c.id === 'base-ten-blocks')!;
    const declared = entry.teachingWorkspace!.misses!.build_two_ways!;
    const answered = new Set(baseTenLevers(item, []).flatMap(l => l.answers));
    expect(declared.filter(m => !answered.has(m))).toEqual([]);
    expect(baseTenLevers(item, []).map(l => l.id)).toEqual([COUNTS_LEVER, TEN_MODEL_LEVER, SMALLER_LEVER]);
    // A same-as-first miss routes to the swap picture; far off routes to a lever too.
    const levers = baseTenLevers(item, []);
    expect(nextLever(levers, 'same_as_first')).toBe(TEN_MODEL_LEVER);
    expect(['column_counts', 'smaller_number']).toContain(nextLever(levers, 'over_by_more'));
  });
  it('no lever text or lever fact carries a number, and the total is never a lever', () => {
    for (const l of baseTenLevers(item, [])) {
      expect(`${l.when} ${l.does}`).not.toMatch(/\d|\b(one|two|three|four|five|six|seven|eight|nine)\b/i);
      expect(`${l.when} ${l.does}`).toMatch(/\b(builds?|blocks|mat)\b/i);
    }
    expect(baseTenLevers(item, []).map(l => l.id)).not.toContain('blocks_total');
    expect(leverFacts([COUNTS_LEVER, TEN_MODEL_LEVER], [])).not.toMatch(/\d/);
  });
  it('smaller_number over every number to 999: at least ten, smaller, never the number or its reversal', () => {
    for (let t = 10; t <= 999; t++) {
      const s = smallerTwoWaysNumber(t);
      if (s === null) { expect(t, `${t}`).toBe(10); continue; }
      expect(s, `${t}`).toBeGreaterThanOrEqual(10);
      expect(s, `${t}`).toBeLessThan(t);
      expect(s, `${t}`).not.toBe(reversed(t));
    }
    expect(smallerTwoWaysNumber(34)).toBe(17);
  });
});

describe('generator: code owns the targets and the words', () => {
  const deck = (n: number): BaseTenBlocksChallenge[] => Array.from({ length: n }, () =>
    ({ type: 'build_two_ways', instruction: 'Build 7 as 7 ones and also 1 ten minus 3', targetNumber: 7, hint: 'Use 3 tens and 4 ones' }));
  it('targets are distinct, at least ten, inside the range; instruction and hint are rewritten', () => {
    for (let run = 0; run < 50; run++) {
      const challenges = deck(5);
      expect(normalizeTwoWaysTargets(challenges, { min: 1, max: 20 }, [3, 12, 12, 19, 40])).toBe(5);
      const targets = challenges.map(c => c.targetNumber);
      expect(new Set(targets).size).toBe(5);
      for (const c of challenges) {
        expect(c.targetNumber).toBeGreaterThanOrEqual(10);
        expect(c.targetNumber).toBeLessThanOrEqual(20);
        expect(c.instruction).toBe(twoWaysInstruction(c.targetNumber));
        // The component hides a hint with a digit or a count word (contract R12); this one is shown.
        expect(c.hint).not.toMatch(/\d|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
      }
      // Pool numbers in range come first.
      expect(targets.slice(0, 2)).toEqual([12, 19]);
    }
  });
  it('leaves other challenge types alone', () => {
    const other: BaseTenBlocksChallenge = { type: 'build_number', instruction: 'Build the number 45 with blocks.', targetNumber: 45, hint: 'x' };
    expect(normalizeTwoWaysTargets([other], { min: 1, max: 99 }, [])).toBe(0);
    expect(other.targetNumber).toBe(45);
  });
});
