import { describe, expect, it } from 'vitest';
import {
  BED_SLOTS, SCOOP_TONS, buildLoadChallenge, loadMiss, pickLoads, sendFeedback,
} from './constructionModel';

describe('construction site loads', () => {
  it('K-2 asks name the count; 3-5 asks give the limit and one scoop, never the count', () => {
    const k = buildLoadChallenge({ units: 'scoops', material: 'sand', target: 4 }, 'the new playground', 'a');
    expect(k.instruction).toBe('Put 4 scoops of sand in the dump truck for the new playground, then send the truck.');
    const g = buildLoadChallenge({ units: 'tons', material: 'gravel', target: 5 }, 'the bridge ramp', 'b');
    expect(g.capacityTons).toBe(5 * SCOOP_TONS.gravel);
    expect(g.instruction).toContain('20 tons');
    expect(g.instruction).toContain('4 tons');
    expect(g.instruction).not.toMatch(/\b5\b/);
  });

  it('every session has different counts, every material before a repeat, and fits the bed', () => {
    for (const band of ['K-2', '3-5'] as const) for (let seed = 0; seed < 30; seed++) {
      const loads = pickLoads(band, 5);
      expect(new Set(loads.map(l => l.target)).size).toBe(5);
      expect(new Set(loads.slice(0, 4).map(l => l.material)).size).toBe(4);
      for (const l of loads) expect(l.target).toBeLessThan(BED_SLOTS);
    }
  });

  it('names the miss and the feedback never says the count needed', () => {
    const c = buildLoadChallenge({ units: 'tons', material: 'dirt', target: 6 }, 'the garden beds', 'c');
    expect(loadMiss(c, 6)).toBeUndefined();
    expect(loadMiss(c, 5)).toBe('one_short');
    expect(loadMiss(c, 7)).toBe('one_over');
    expect(loadMiss(c, 2)).toBe('too_few');
    expect(loadMiss(c, 9)).toBe('too_many');
    expect(sendFeedback(c, 4)).toBe('The scale reads 8 tons. The truck can safely carry more. A truck that goes half empty makes extra trips.');
    expect(sendFeedback(c, 7)).toContain('Too heavy');
    for (const n of [0, 4, 7]) expect(sendFeedback(c, n)).not.toMatch(/\b6 scoops\b/);
  });
});
