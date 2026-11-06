import { describe, expect, it } from 'vitest';
import {
  LEVELS, frequency, knockCandidates, knockFair, knockMatches, knockMiss, knocksDown, makeKnock, pickKnocks, seededRng,
  spacingSquares, waveAt, waveEnergy, wavelength, type Tier,
} from './waveModel';

describe('the waves', () => {
  it('pushing faster makes the crests closer together; the waves move at one speed', () => {
    expect(spacingSquares(1)).toBe(12);
    expect(spacingSquares(3)).toBe(4);
    for (let s = 1; s <= LEVELS; s++) expect(wavelength(s) * frequency(s)).toBeCloseTo(wavelength(1) * frequency(1));
  });

  it('a bigger push makes taller crests; a crest is drawn where the train is, flat water elsewhere', () => {
    const peak = (size: number) => Math.max(...Array.from({ length: 200 }, (_, i) => waveAt(i * 0.05, 3, size, 2)));
    expect(peak(4)).toBeGreaterThan(peak(2));
    expect(waveAt(11, 1, 3, 2)).toBe(0);
  });

  it('energy grows with size and with speed, and doubling one quadruples it', () => {
    expect(waveEnergy(2, 2)).toBeGreaterThan(waveEnergy(1, 2));
    expect(waveEnergy(2, 2)).toBeGreaterThan(waveEnergy(2, 1));
    expect(waveEnergy(4, 1)).toBe(4 * waveEnergy(2, 1));
  });
});

describe('knock_it_down items', () => {
  it.each(['easy', 'medium', 'hard'] as Tier[])('%s: every item is fair, and the pool is not empty', (tier) => {
    const pool = knockCandidates(tier);
    expect(pool.length).toBeGreaterThan(3);
    for (const c of pool) expect(knockFair(c)).toBe(true);
  });

  it('easy: one step up on either setting knocks it down', () => {
    for (const c of knockCandidates('easy')) {
      expect(knocksDown(c, c.start.size + 1, c.start.speed)).toBe(true);
      expect(knocksDown(c, c.start.size, c.start.speed + 1)).toBe(true);
    }
  });

  it('medium: one step is not enough on either setting, and either alone can still do it', () => {
    for (const c of knockCandidates('medium')) {
      expect(knocksDown(c, c.start.size + 1, c.start.speed)).toBe(false);
      expect(knocksDown(c, c.start.size, c.start.speed + 1)).toBe(false);
      expect(knocksDown(c, LEVELS, c.start.speed)).toBe(true);
      expect(knocksDown(c, c.start.size, LEVELS)).toBe(true);
    }
  });

  it('hard: the size is stuck, so only pushing faster (more than one step) works', () => {
    for (const c of knockCandidates('hard')) {
      expect(c.sizeCap).toBe(c.start.size);
      expect(c.instruction).toContain('stuck');
      expect(knocksDown(c, c.start.size, c.start.speed + 1)).toBe(false);
      expect(knocksDown(c, c.start.size, LEVELS)).toBe(true);
    }
  });

  it('a session has distinct ids and different starting settings, and varies by seed', () => {
    const a = pickKnocks(3, 'medium', seededRng(1));
    expect(new Set(a.map(c => c.id)).size).toBe(3);
    expect(new Set(a.map(c => `${c.start.size}x${c.start.speed}`)).size).toBe(3);
    const seen = new Set(Array.from({ length: 10 }, (_, i) => JSON.stringify(pickKnocks(3, 'medium', seededRng(i)).map(c => [c.start, c.need]))));
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('the check', () => {
  const c = makeKnock('w', { size: 2, speed: 2 }, 8);

  it('one setting raised enough passes, by size or by speed', () => {
    expect(knockMatches(c, { size: 4, speed: 2, runs: [] })).toBe(true);
    expect(knockMatches(c, { size: 2, speed: 4, runs: [] })).toBe(true);
  });

  it('names the miss', () => {
    expect(knockMiss(c, { size: 2, speed: 2, runs: [] })).toBe('no_change');
    expect(knockMiss(c, { size: 5, speed: 5, runs: [] })).toBe('changed_both');
    expect(knockMiss(c, { size: 1, speed: 2, runs: [] })).toBe('weaker');
    expect(knockMiss(c, { size: 3, speed: 2, runs: [] })).toBe('too_small');
    expect(knockMiss(c, { size: 4, speed: 2, runs: [] })).toBeUndefined();
  });
});
