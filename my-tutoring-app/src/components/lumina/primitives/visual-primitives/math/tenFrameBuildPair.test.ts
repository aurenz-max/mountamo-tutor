import { describe, expect, it } from 'vitest';
import { askFor, frameVerdictCue, itemsFromChallenges } from './tenFrameScript';
import { frameMiss, tenFrameLevers } from './tenFrameLevers';
import { workspaceAssignment } from './tenFrameWorkspace';
import { pairTotals } from '../../../service/math/gemini-ten-frame';

const items = (totals: number[]) => itemsFromChallenges(
  totals.map((t, i) => ({ id: `c${i}`, type: 'build_pair' as const, targetCount: t })), { capacity: 10, band: 'K' });

describe('ten-frame build_pair (open build)', () => {
  it('is a gesture item on an empty frame; a repeated total asks for a different way; a total under two drops', () => {
    const [a, b, c] = items([5, 5, 6]);
    expect(a).toMatchObject({ kind: 'build_pair', answerKind: 'gesture', shown: 0, answer: 5, splitOrdinal: 1 });
    expect(b.splitOrdinal).toBe(2);
    expect(c.splitOrdinal).toBe(1);
    expect(askFor(a)).toBe('Make five with red and yellow counters. Your turn — use both colours.');
    expect(askFor(b)).toMatch(/DIFFERENT way/);
    expect(items([1, 11])).toHaveLength(0);
    expect(workspaceAssignment(a)).toMatchObject({ response: 'gesture' });
  });

  it('names the misses: one over, one under, one colour, the same pair again', () => {
    const [item] = items([5]);
    expect(frameMiss(item, { placed: 6, yellow: 2 })).toBe('one_over');
    expect(frameMiss(item, { placed: 4, yellow: 2 })).toBe('one_short');
    expect(frameMiss(item, { placed: 10, yellow: 0 })).toBe('filled_frame');
    expect(frameMiss(item, { placed: 5, yellow: 0 })).toBe('one_colour');
    expect(frameMiss(item, { placed: 5, yellow: 5 })).toBe('one_colour');
    expect(frameMiss(item, { placed: 5, yellow: 2, shownWays: new Set(['3+2']) })).toBe('same_way_again');
    expect(frameMiss(item, { placed: 5, yellow: 2 })).toBeUndefined();
  });

  it('the verdict names the pair only on a pass; the levers name the build and never a pair of this total', () => {
    const [item] = items([5]);
    expect(frameVerdictCue(item, 5, { yellow: 2 })).toMatch(/Yes! Three red and two yellow make five/);
    const miss = frameVerdictCue(item, 5, { yellow: 0 });
    expect(miss).toMatch(/both colours/);
    expect(miss.split('Say exactly:')[1]).not.toMatch(/\b(one|two|three|four)\b/);
    const levers = tenFrameLevers(item, [], 'K', { session: [item] });
    expect(levers.map(l => l.id)).toEqual(['running_count', 'split_model', 'smaller_total']);
    expect(levers.every(l => !l.pulled)).toBe(true);
    expect(levers.find(l => l.id === 'split_model')!.does).toMatch(/Never a pair for this number/);
  });

  it('pairTotals: each total twice, inside the bound, at least three', () => {
    let seed = 1;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const five = pairTotals(6, 5, rand);
    expect(five).toHaveLength(6);
    expect(new Set(five)).toEqual(new Set([3, 4, 5]));
    expect(five[0]).toBe(five[1]);
    const ten = pairTotals(6, 10, rand);
    expect(ten.every(t => t >= 3 && t <= 10)).toBe(true);
    expect(new Set(ten).size).toBe(3);
    expect(pairTotals(4, 2, rand).every(t => t === 3)).toBe(true);
  });
});
