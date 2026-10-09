/** build_hops (open build): the judge, the ways, the easier build and the levers. */
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../service/geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { selectBuildHopsTasks } from '../../../service/math/gemini-number-line';
import { numberLineOracle } from '../../../service/qa/oracles/number-line';
import type { NumberLineChallenge } from './NumberLine';
import { HOPS_LEVER, SIMPLER_LEVER } from './numberLineLevers';
import {
  WAYS_LEVER, buildHopsFeedback, buildHopsInstruction, buildHopsLevers, buildHopsMiss, hopsHarnessBuilds, hopsTaskOf,
  simplerHops, waysFor, waysModel,
} from './numberLineBuildHops';

const item = (target: number, start = 0, hopCount = 2): NumberLineChallenge => ({
  id: 'build_hops-0', type: 'build_hops', instruction: buildHopsInstruction({ start, target, hopCount }),
  hint: '', startValue: start, targetValues: [target], hopCount,
});
const line = { min: 0, max: 20 };

describe('buildHopsMiss', () => {
  const twelve = item(12);
  it('passes any two hops that land on the target, and a different second way', () => {
    expect(buildHopsMiss(twelve, [5, 7])).toBeUndefined();
    expect(buildHopsMiss(twelve, [6, 6])).toBeUndefined();
    expect(buildHopsMiss(twelve, [10, 2])).toBeUndefined();
    expect(buildHopsMiss(twelve, [10, 2], [5, 7])).toBeUndefined();
  });
  it('names one over and one under with the jump mode landing check, and further off', () => {
    expect(buildHopsMiss(twelve, [5, 8])).toBe('one_past');
    expect(buildHopsMiss(twelve, [5, 6])).toBe('one_short');
    expect(buildHopsMiss(twelve, [5, 3])).toBe('off_by_more');
    expect(buildHopsMiss(twelve, [9, 6])).toBe('off_by_more');
  });
  it('names the same hops again, in either order, on the second way', () => {
    expect(buildHopsMiss(twelve, [5, 7], [5, 7])).toBe('same_way_again');
    expect(buildHopsMiss(twelve, [7, 5], [5, 7])).toBe('same_way_again');
  });
  it('names the right number made in fewer hops than asked', () => {
    expect(buildHopsMiss(item(8), [8])).toBe('other_hop_count');
    expect(buildHopsMiss(item(9, 0, 3), [4, 5])).toBe('other_hop_count');
    expect(buildHopsMiss(item(9, 0, 3), [4, 4, 1])).toBeUndefined();
  });
  it('judges from a start that is not zero', () => {
    expect(buildHopsMiss(item(104, 92), [6, 6])).toBeUndefined();
    expect(buildHopsMiss(item(104, 92), [6, 7])).toBe('one_past');
  });
  it('is undefined on any other item', () => {
    expect(buildHopsMiss({ ...twelve, type: 'show_jump' }, [1])).toBeUndefined();
    expect(hopsTaskOf(null)).toBeNull();
  });
});

describe('ways', () => {
  it('lists every hop set once, largest hop first, within the hop buttons', () => {
    expect(waysFor(4, 2)).toEqual([[3, 1], [2, 2]]);
    expect(waysFor(12, 2)).toEqual([[10, 2], [9, 3], [8, 4], [7, 5], [6, 6]]);
    expect(waysFor(20, 2)).toEqual([[10, 10]]);
    expect(waysFor(6, 3)).toEqual([[4, 1, 1], [3, 2, 1], [2, 2, 2]]);
  });
  it('gives the driver two different right ways and a wrong build one short', () => {
    const builds = hopsHarnessBuilds({ start: 0, target: 12, hopCount: 2 });
    expect(builds).toEqual({ first: [10, 2], second: [6, 6], wrong: [9, 2] });
    expect(buildHopsMiss(item(12), builds.wrong)).toBe('one_short');
    expect(buildHopsMiss(item(12), builds.second, builds.first)).toBeUndefined();
  });
});

describe('generator asks', () => {
  it('asks targets with at least two ways, on the line, distinct, from 0', () => {
    for (let run = 0; run < 50; run++) {
      const picked = selectBuildHopsTasks({ min: 0, max: 20 }, 2, 3)!;
      expect(picked.line).toEqual({ min: 0, max: 20 });
      const targets = picked.tasks.map(t => t.target);
      expect(new Set(targets).size).toBe(3);
      for (const t of picked.tasks) {
        expect(t.start).toBe(0);
        expect(waysFor(t.target - t.start, t.hopCount).length).toBeGreaterThanOrEqual(2);
        expect(t.target).toBeLessThanOrEqual(20);
      }
    }
  });
  it('stays inside a narrow scope and a Grade 1 window, and asks three hops when told', () => {
    const ten = selectBuildHopsTasks({ min: 0, max: 10 }, 2, 3)!;
    expect(ten.tasks.every(t => t.target <= 10 && t.target >= 4)).toBe(true);
    const window = selectBuildHopsTasks({ min: 90, max: 110 }, 2, 3)!;
    expect(window.tasks.every(t => t.start === 90 && t.target > 93 && t.target <= 110)).toBe(true);
    const hard = selectBuildHopsTasks({ min: 0, max: 20 }, 3, 3)!;
    expect(hard.tasks.every(t => t.hopCount === 3 && waysFor(t.target, 3).length >= 2)).toBe(true);
  });
  it('passes the oracle', () => {
    const picked = selectBuildHopsTasks({ min: 0, max: 20 }, 2, 3)!;
    const challenges = picked.tasks.map((t, i) => ({ ...item(t.target, t.start, t.hopCount), id: `build_hops-${i}` }));
    const result = numberLineOracle.verify({ range: picked.line, numberType: 'integer', challenges } as never,
      { topic: 'Add within 20' } as never);
    expect(result.violations).toEqual([]);
    expect(result.checkedChallenges).toBe(3);
  });
});

describe('the easier build and the levers', () => {
  it('halves the distance, keeps the hop count, and never asks the item target', () => {
    const easier = simplerHops(item(12), line)!;
    expect(easier.targetValues).toEqual([6]);
    expect(easier.hopCount).toBe(2);
    expect(easier.instruction).toBe('Start at 0 and land on 6 in two hops.');
    expect(simplerHops(item(6), line)).toBeNull();
  });
  it('the ways model is two ways to a number that is never the learner\'s', () => {
    for (const target of [4, 5, 6, 12]) {
      const model = waysModel({ start: 0, target, hopCount: 2 });
      expect(model.target).not.toBe(target);
      expect(model.ways[0]).not.toEqual(model.ways[1]);
      for (const w of model.ways) expect(w.reduce((a, b) => a + b, 0)).toBe(model.target);
    }
  });
  it('starts bare (nothing pulled), and declares numbered hops once a hop is on', () => {
    const bare = buildHopsLevers(item(12), [], line, [], null);
    expect(bare.map(l => l.id)).toEqual([WAYS_LEVER, SIMPLER_LEVER]);
    expect(bare.some(l => l.pulled)).toBe(false);
    const levers = buildHopsLevers(item(12), [], line, [5], [5, 7]);
    expect(levers.map(l => l.id)).toEqual([HOPS_LEVER, WAYS_LEVER, SIMPLER_LEVER]);
    // Each lever's text names the build, never the jump mode's "place the landing".
    for (const l of levers) expect(`${l.when} ${l.does}`).not.toMatch(/place|landing value/i);
    expect(levers.flatMap(l => l.answers ?? [])).toEqual(expect.arrayContaining(['one_short', 'one_past', 'off_by_more', 'same_way_again']));
  });
  it('feedback never says where a wrong build landed or a hop to use', () => {
    const task = { start: 0, target: 12, hopCount: 2 };
    const wrong = buildHopsFeedback(task, [5, 8], 'one_past', null);
    expect(wrong).not.toMatch(/13|7|\b8\b|\b5\b/);
    expect(buildHopsFeedback(task, [5, 7], undefined, null)).toBe('Yes! 5 + 7 = 12. Now land on 12 a different way.');
    expect(buildHopsFeedback(task, [6, 6], undefined, [5, 7])).toBe('Two ways to land on 12: 5 + 7 and 6 + 6!');
  });
});
