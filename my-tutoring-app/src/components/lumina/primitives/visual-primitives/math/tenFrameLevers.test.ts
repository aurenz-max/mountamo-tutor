import { describe, expect, it } from 'vitest';
import { fiveFrameLeaks, smallerBuild, tenFrameLevers } from './tenFrameLevers';
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
  it('declares nothing on other kinds yet', () => {
    const [makeTen] = itemsFromChallenges([{ id: 'm', type: 'make_ten', targetCount: 6 }], { capacity: 10, band: 'K' });
    expect(tenFrameLevers(makeTen, [], 'K')).toEqual([]);
  });
});
