import { describe, expect, it } from 'vitest';
import { IDENTIFY_TARGETS, selectBuildHopsTasks } from './gemini-number-line';

describe('number-line tier targets for identify and build_hops', () => {
  it('identify: each tier holds a full session (5) on 0-10, and harder tiers need more ticks counted from 0', () => {
    const farFromEnds = (v: number) => (v === 10 ? 0 : v);
    const mean = (xs: number[]) => xs.reduce((s, v) => s + farFromEnds(v), 0) / xs.length;
    for (const pool of Object.values(IDENTIFY_TARGETS)) {
      expect(new Set(pool).size).toBeGreaterThanOrEqual(5);
      expect(pool.every((v) => Number.isInteger(v) && v >= 0 && v <= 10)).toBe(true);
    }
    expect(mean(IDENTIFY_TARGETS.easy)).toBeLessThan(mean(IDENTIFY_TARGETS.medium));
    expect(mean(IDENTIFY_TARGETS.medium)).toBeLessThan(mean(IDENTIFY_TARGETS.hard));
  });

  it('build_hops: easy targets within ten, medium past ten, distinct and reachable two ways', () => {
    for (let run = 0; run < 20; run++) {
      const easy = selectBuildHopsTasks({ min: 0, max: 20 }, 2, 3, 'within-ten')!;
      const medium = selectBuildHopsTasks({ min: 0, max: 20 }, 2, 3, 'past-ten')!;
      expect(easy.tasks.every((t) => t.target <= 10)).toBe(true);
      expect(medium.tasks.every((t) => t.target > 10)).toBe(true);
      expect(new Set(medium.tasks.map((t) => t.target)).size).toBe(3);
    }
  });

  it('build_hops: a line too short for the reach keeps every distance', () => {
    const short = selectBuildHopsTasks({ min: 0, max: 10 }, 2, 3, 'past-ten')!;
    expect(short.tasks).toHaveLength(3);
  });
});
