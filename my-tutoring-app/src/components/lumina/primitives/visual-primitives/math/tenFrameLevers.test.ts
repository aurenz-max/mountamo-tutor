import { describe, expect, it } from 'vitest';
import { fiveFrameIndex, fiveFrameLeaks, frameMiss, smallerBuild, tenFrameLevers } from './tenFrameLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { itemsFromChallenges } from './tenFrameScript';

const build = (n: number, id = `b${n}`) => itemsFromChallenges([{ id, type: 'build', targetCount: n }], { capacity: 10, band: 'K' })[0];

describe('ten-frame build levers', () => {
  it('the easier build is the same mode, about half, never the full number, and solvable', () => {
    for (let n = 1; n <= 10; n++) {
      const easier = smallerBuild(build(n), 'K');
      if (n === 1) { expect(easier).toBeNull(); continue; }
      expect(easier).toMatchObject({ kind: 'build', answer: Math.ceil(n / 2), answerKind: 'gesture', capacity: 10 });
      expect(easier!.answer).not.toBe(n);
      expect(easier!.id).not.toBe(build(n).id);
    }
  });
  it('the five-frame is never offered when five is the number to build', () => {
    expect(fiveFrameLeaks(build(5))).toBe(true);
    expect(tenFrameLevers(build(5), [], 'K').map(l => l.id)).toEqual(['running_count', 'smaller_build']);
    expect(tenFrameLevers(build(7), ['running_count'], 'K').map(l => [l.id, l.pulled]))
      .toEqual([['running_count', true], ['five_frame', false], ['smaller_build', false]]);
  });
  it('build_teen: the easier item is a teen number with about half the ones, never the same teen', () => {
    for (let n = 11; n <= 19; n++) {
      const [teen] = itemsFromChallenges([{ id: `t${n}`, type: 'build_teen', targetCount: n }], { capacity: 20, band: 'K' });
      const easier = smallerBuild(teen, 'K');
      if (n === 11) { expect(easier).toBeNull(); continue; }
      const ones = n - 10;
      expect(easier).toMatchObject({ kind: 'build_teen', shown: 10, answer: Math.ceil(ones / 2), teenTotal: 10 + Math.ceil(ones / 2), capacity: 20 });
      expect(easier!.teenTotal).not.toBe(n);
      expect(easier!.id).not.toBe(teen.id);
    }
  });
  it('build_teen: the five-frame outlines the ones frame and is never offered on fifteen', () => {
    const teen = (n: number) => itemsFromChallenges([{ id: `t${n}`, type: 'build_teen', targetCount: n }], { capacity: 20, band: 'K' })[0];
    expect(tenFrameLevers(teen(15), [], 'K').map(l => l.id)).toEqual(['running_count', 'smaller_build']);
    expect(tenFrameLevers(teen(14), [], 'K').map(l => [l.id, l.pulled]))
      .toEqual([['running_count', false], ['five_frame', false], ['smaller_build', false]]);
    expect(tenFrameLevers(teen(11), [], 'K').map(l => l.id)).toEqual(['running_count', 'five_frame']);
    expect(fiveFrameIndex(teen(14))).toBe(1);
    expect(JSON.stringify(tenFrameLevers(teen(14), [], 'K'))).not.toMatch(/fourteen|\b14\b|\b4\b/);
  });
});

describe('what a wrong placement shows, and the lever that answers it (code, not a Live run)', () => {
  const item = (type: 'make_ten' | 'split' | 'build_teen' | 'decompose_teen', targetCount: number, capacity = 10) =>
    itemsFromChallenges([{ id: `${type}${targetCount}`, type, targetCount }], { capacity, band: 'K' })[0];
  const seven = build(7), makeTen = item('make_ten', 6), split = item('split', 5);
  const buildTeen = item('build_teen', 14, 20), decomposeTeen = item('decompose_teen', 14, 20);
  const shown = new Set(['3+2']);
  it.each([
    [seven, 6, undefined, 'one_short'], [seven, 8, undefined, 'one_over'], [seven, 4, undefined, 'short_by_more'],
    [seven, 9, undefined, 'over_by_more'], [seven, 10, undefined, 'filled_frame'], [seven, 0, undefined, 'short_by_more'],
    [seven, 7, undefined, undefined], [build(9), 10, undefined, 'one_over'],
    [makeTen, 3, undefined, 'one_short'], [makeTen, 1, undefined, 'short_by_more'], [makeTen, 4, undefined, undefined],
    [split, 5, undefined, 'all_flipped'], [split, 0, undefined, 'none_flipped'], [split, 2, shown, 'same_way_again'],
    [split, 2, undefined, undefined], [split, 3, shown, undefined],
    [buildTeen, 3, undefined, 'one_short'], [buildTeen, 5, undefined, 'one_over'], [buildTeen, 10, undefined, 'filled_frame'],
    [buildTeen, 7, undefined, 'over_by_more'], [buildTeen, 4, undefined, undefined],
    [decomposeTeen, 9, undefined, 'one_short'], [decomposeTeen, 11, undefined, 'one_over'], [decomposeTeen, 14, undefined, 'all_flipped'],
    [decomposeTeen, 12, undefined, 'over_by_more'], [decomposeTeen, 6, undefined, 'short_by_more'], [decomposeTeen, 10, undefined, undefined],
  ] as const)('%#: %s placed %i -> %s', (it_, placed, shownWays, miss) => {
    expect(frameMiss(it_, { placed, shownWays })).toBe(miss);
  });

  it('a spoken item names no miss', () => {
    const [subitize] = itemsFromChallenges([{ id: 's', type: 'subitize', targetCount: 4 }], { capacity: 10, band: 'K' });
    expect(frameMiss(subitize, { placed: 3 })).toBeUndefined();
  });

  it.each([
    [[], 'one_short', 'running_count'], [[], 'one_over', 'running_count'], [[], 'filled_frame', 'running_count'],
    [[], 'short_by_more', 'five_frame'], [[], 'over_by_more', 'five_frame'],
    [['five_frame'], 'short_by_more', 'smaller_build'], [['running_count'], 'filled_frame', 'five_frame'],
    [['running_count'], 'one_short', 'five_frame'], [[], undefined, 'running_count'],
  ] as const)('%#: pulled %j, miss %s -> %s', (pulled, miss, lever) => {
    expect(nextLever(tenFrameLevers(seven, pulled, 'K'), miss)).toBe(lever);
  });

  it.each([
    [[], 'one_short', 'running_count'], [[], 'filled_frame', 'running_count'], [[], 'over_by_more', 'five_frame'],
    [['five_frame'], 'short_by_more', 'smaller_build'],
  ] as const)('build_teen %#: pulled %j, miss %s -> %s', (pulled, miss, lever) => {
    expect(nextLever(tenFrameLevers(buildTeen, pulled, 'K'), miss)).toBe(lever);
  });

  it('five is the number: the five-frame is not offered, so a miss by more opens the easier build', () => {
    expect(nextLever(tenFrameLevers(build(5), [], 'K'), 'short_by_more')).toBe('smaller_build');
  });
});
