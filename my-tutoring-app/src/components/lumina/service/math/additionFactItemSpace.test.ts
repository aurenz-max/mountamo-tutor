import { describe, expect, it } from 'vitest';
import { factItem, factStamp, tierFactPool } from './additionFactItemSpace';
import { buildAdditionFactSession, sessionCount, strategyPool } from './gemini-addition-fact-strategies';
import type { AdditionFactStrategy } from '../../primitives/visual-primitives/math/AdditionFactStrategies';

const TIERS = ['easy', 'medium', 'hard'] as const;
const meanBeta = (pairs: [number, number][]) => pairs.reduce((s, [a, b]) => s + (factItem(a, b)?.beta ?? -3), 0) / pairs.length;
const ON_SPACE: AdditionFactStrategy[] = ['turnaround', 'facts_3_4', 'facts_mixed'];
const OFF_SPACE: AdditionFactStrategy[] = ['plus_zero', 'plus_one', 'plus_two', 'doubles', 'facts_5_6', 'facts_7_8'];

describe('addition-fact-strategies tier pools', () => {
  it('one-structure families stay off the space', () => {
    for (const s of OFF_SPACE) expect(tierFactPool(s, 18, 'hard', sessionCount(s)), s).toBeNull();
  });

  it('every fact without a zero is in the space', () => {
    for (const s of ['plus_one', 'doubles', 'turnaround', 'plus_two', 'facts_3_4', 'facts_5_6', 'facts_7_8', 'facts_mixed'] as const) {
      for (const [a, b] of strategyPool(s)) if (a && b) expect(factItem(a, b), `${s} ${a}+${b}`).not.toBeNull();
    }
  });

  for (const s of ON_SPACE) {
    it(`${s}: each tier's window fills a session, inside the family, and easy < medium < hard`, () => {
      const n = sessionCount(s);
      const family = new Set(strategyPool(s).map(([a, b]) => `${a}+${b}`));
      const windows = TIERS.map((t) => tierFactPool(s, 18, t, n)!);
      for (const w of windows) {
        expect(w.length).toBeGreaterThan(n);
        for (const [a, b] of w) expect(family.has(`${a}+${b}`)).toBe(true);
      }
      const [e, m, h] = windows.map(meanBeta);
      expect(e).toBeLessThan(m);
      expect(m).toBeLessThan(h);
    });
  }

  it('facts_mixed hard holds more facts that cross ten than easy', () => {
    const bridges = (t: (typeof TIERS)[number]) => tierFactPool('facts_mixed', 18, t, 10)!
      .filter(([a, b]) => factItem(a, b)!.features.bridges > 0).length;
    expect(bridges('hard')).toBeGreaterThan(bridges('easy'));
  });

  it('a session from a tier window stays in it and is stamped', () => {
    const pool = tierFactPool('facts_mixed', 18, 'hard', 10)!;
    const keys = new Set(pool.map(([a, b]) => `${a}+${b}`));
    const session = buildAdditionFactSession('facts_mixed', Math.random, 18, pool);
    expect(session.challenges).toHaveLength(10);
    for (const c of session.challenges) {
      expect(keys.has(`${c.a}+${c.b}`)).toBe(true);
      expect(c.itemSpace).toEqual(factStamp(c.a, c.b));
    }
  });

  it('a lesson sum window bounds the tier window', () => {
    for (const t of TIERS) for (const [a, b] of tierFactPool('turnaround', 12, t, sessionCount('turnaround', 12)) ?? []) expect(a + b).toBeLessThanOrEqual(12);
  });
});
