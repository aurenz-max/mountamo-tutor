import { describe, expect, it } from 'vitest';
import {
  buildTrack, loopCandidates, loopFair, loopMatches, loopMiss, lowestWorking, makeLoop, pegOutcomes, pickLoops, runFrom,
  seededRng, type Tier,
} from './marbleModel';

describe('the marble run', () => {
  const t = buildTrack({ pegs: [1, 2, 3, 4, 5], loopR: 1, carpet: false });

  it('needs to start well above the top of the loop, as a rolling ball does (about 2.7 loop radii, plus friction)', () => {
    // Below the loop's middle it slides back; above the middle but too slow, it drops off.
    expect(runFrom(t, 0.9).outcome).toBe('rolled_back');
    expect(runFrom(t, 1.5).outcome).toBe('fell');
    expect(runFrom(t, 2.2).outcome).toBe('fell');
    expect(runFrom(t, 2.6).outcome).toBe('fell');
    expect(runFrom(t, 3.2).outcome).toBe('made_it');
  });

  it('stops on the flat from a very low start', () => {
    expect(runFrom(t, 0.15).outcome).not.toBe('made_it');
  });

  it('a carpet before the loop takes energy, so a start that worked on wood can fail', () => {
    const wood = buildTrack({ pegs: [1, 2, 3, 4, 5], loopR: 1, carpet: false });
    const carpet = buildTrack({ pegs: [1, 2, 3, 4, 5], loopR: 1, carpet: true });
    const h = [2.7, 2.8, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4].find(x => runFrom(wood, x).outcome === 'made_it')!;
    expect(runFrom(carpet, h).outcome).not.toBe('made_it');
  });

  it('frames start on the ramp and a fall ends on the table', () => {
    const r = runFrom(t, 2.2);
    expect(r.frames[0].y).toBeGreaterThan(2);
    expect(r.leftAt).not.toBeNull();
    expect(r.frames[r.frames.length - 1].y).toBeLessThan(0.2);
  });
});

describe('items', () => {
  it.each<Tier>(['easy', 'medium', 'hard'])('%s has fair candidates and picks distinct items', tier => {
    expect(loopCandidates(tier).length).toBeGreaterThanOrEqual(6);
    const items = pickLoops(3, tier, seededRng(7));
    expect(new Set(items.map(c => c.id)).size).toBe(3);
    expect(new Set(items.map(c => c.loopR)).size).toBe(3);
    for (const c of items) expect(loopFair(c)).toBe(true);
  });

  it('varies across seeds', () => {
    const keys = new Set(Array.from({ length: 8 }, (_, s) => pickLoops(3, 'medium', seededRng(s)).map(c => `${c.loopR}|${c.pegs[0]}`).join(';')));
    expect(keys.size).toBeGreaterThan(3);
  });
});

describe('the check', () => {
  const c = makeLoop('l', 1, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4], false, 'lowest');
  const low = lowestWorking(c);

  it('the lowest working peg passes; a higher working peg is not_lowest', () => {
    expect(pegOutcomes(c).slice(low).every(o => o === 'made_it')).toBe(true);
    expect(loopMatches(c, { peg: low, runs: [] })).toBe(true);
    expect(loopMiss(c, { peg: low + 1, runs: [] })).toBe('not_lowest');
  });

  it('a peg level with the top that fails is top_height_only; lower is too_low', () => {
    expect(loopMiss(c, { peg: 3, runs: [] })).toBe('top_height_only');
    expect(loopMiss(c, { peg: 1, runs: [] })).toBe('too_low');
  });

  it('easy accepts any working peg', () => {
    const e = { ...c, goal: 'any' as const };
    expect(loopMatches(e, { peg: 7, runs: [] })).toBe(true);
    expect(loopMatches(e, { peg: null, runs: [] })).toBe(false);
  });
});
