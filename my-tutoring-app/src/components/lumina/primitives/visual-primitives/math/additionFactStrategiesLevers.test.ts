import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { AdditionFactChallenge, AdditionFactStrategy } from './AdditionFactStrategies';
import { ADDITION_FACT_STRATEGIES, strategyPool } from './additionFactPools';
import {
  ADDITION_FACT_LEVERS, helpLevers, leverNumbers, smallerFact, startLevers,
} from './additionFactStrategiesLevers';
import { additionFactMiss } from './additionFactStrategiesWorkspace';

/** A fact of a family: its `type` is the strategy (contract R1). */
const of = (type: AdditionFactStrategy, a: number, b: number, id = 'f'): AdditionFactChallenge =>
  ({ id, type, a, b, sum: a + b, ...(type === 'turnaround' ? { knownFact: { a: b, b: a } } : {}) });
const fact = (a: number, b: number, id = 'f', turn = false) => of(turn ? 'turnaround' : 'facts_mixed', a, b, id);
const declared = (c: AdditionFactChallenge, session: AdditionFactChallenge[] = [c]) =>
  ADDITION_FACT_LEVERS.declare(c, { session }, []);

describe('which levers a fact offers', () => {
  it.each([
    ['plus_zero', fact(6, 0), ['count_groups']],
    ['plus_one', fact(1, 7), ['hop_strip', 'count_groups']],
    ['doubles', fact(3, 3), ['count_groups']],
    ['turnaround', fact(7, 8, 'f', true), ['known_fact', 'near_double', 'count_groups']],
    ['turnaround', fact(2, 9, 'f', true), ['known_fact', 'hop_strip', 'count_groups']],
    ['plus_two', fact(5, 2), ['hop_strip', 'count_groups']],
    ['facts_7_8', fact(7, 8), ['near_double', 'count_groups']],
    ['facts_3_4', fact(3, 9), ['hop_strip', 'count_groups']],
    ['facts_mixed', fact(4, 9), ['count_groups']],
  ] as const)('%s %o', (strategy, c, ids) => {
    expect(helpLevers({ ...c, type: strategy })).toEqual(ids);
  });
});

describe('this wrong answer, then this lever (nextLever over the declared levers)', () => {
  const levers = (strategy: AdditionFactStrategy, c: AdditionFactChallenge) => declared({ ...c, type: strategy });
  it.each([
    ['plus_one', fact(1, 7), 9, 'hop_strip'],
    ['plus_one', fact(1, 7), 7, 'count_groups'],
    ['plus_two', fact(5, 2), 6, 'hop_strip'],
    ['plus_zero', fact(6, 0), 7, 'count_groups'],
    ['plus_zero', fact(6, 0), 0, 'count_groups'],
    ['doubles', fact(6, 6), 14, 'count_groups'],
    ['doubles', fact(6, 6), 11, 'count_groups'],
    ['plus_zero', fact(6, 0), 5, 'count_groups'],
    ['turnaround', fact(3, 8, 'f', true), 12, 'known_fact'],
    ['facts_7_8', fact(7, 8), 14, 'near_double'],
    ['facts_7_8', fact(7, 8), 7, 'count_groups'],
    ['facts_mixed', fact(4, 9), 11, 'count_groups'],
  ] as const)('%s %o, tapped %s → %s', (strategy, c, tapped, lever) => {
    expect(nextLever(levers(strategy, c), additionFactMiss(c, tapped))).toBe(lever);
  });
});

describe('leak rules', () => {
  it('no help lever prints the total of the fact, except the flipped fact card, whose total IS the turn-around', () => {
    for (const strategy of ADDITION_FACT_STRATEGIES) {
      for (const [a, b] of strategyPool(strategy)) {
        const c = of(strategy, a, b);
        for (const id of helpLevers(c)) {
          const hops = Math.min(a, b);
          // A hop shows its number only once tapped: before the last hop, the total is not on screen.
          const printed = leverNumbers(id, c, Math.max(0, hops - 1));
          if (id === 'known_fact') expect(printed).toEqual([b, a, a + b]);
          else expect(printed, `${strategy} ${a}+${b} ${id}`).not.toContain(a + b);
        }
      }
    }
  });

  it('easy starts with the objects to count; medium and hard start released', () => {
    expect(startLevers('easy', fact(3, 4))).toEqual(['count_groups']);
    expect(startLevers('medium', fact(3, 4))).toEqual([]);
    expect(startLevers('hard', fact(3, 4))).toEqual([]);
    expect(startLevers(undefined, fact(3, 4))).toEqual([]);
  });
});

describe('smaller_fact', () => {
  it('over every fact of every family: the same family, a smaller total, never a session fact or this fact\'s total', () => {
    let built = 0;
    for (const strategy of ADDITION_FACT_STRATEGIES) {
      const pool = strategyPool(strategy);
      for (const [a, b] of pool) {
        const c = fact(a, b, 'f', strategy === 'turnaround');
        const session = [c, fact(b, a, 'g')];
        const s = smallerFact(strategy, c, session);
        if (!s) continue;
        built++;
        expect(pool.some(([x, y]) => x === s.a && y === s.b), `${strategy}: ${s.a}+${s.b} not in the family`).toBe(true);
        expect(s.sum).toBeLessThan(c.sum);
        expect(s.sum).toBe(s.a + s.b);
        expect([`${a}|${b}`, `${b}|${a}`]).not.toContain(`${s.a}|${s.b}`);
        expect(s.id).toBe('f~simpler');
        if (strategy === 'turnaround') expect(s.knownFact).toEqual({ a: s.b, b: s.a });
      }
    }
    expect(built).toBeGreaterThan(100);
  });

  it('refuses when the fact is the smallest in its family', () => {
    expect(smallerFact('doubles', fact(1, 1), [fact(1, 1)])).toBeNull();
    expect(declared(of('doubles', 1, 1)).map(l => l.id)).toEqual(['count_groups']);
  });
});

describe('the lever set', () => {
  it('declares every lever the old switch did, in order, with the same kinds, answers and carrier', () => {
    const c = of('turnaround', 7, 8);
    expect(declared(c).map(l => [l.id, l.kind, l.carrier, l.answers])).toEqual([
      ['known_fact', 'help', 'shown', ['addend', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
      ['near_double', 'help', 'shown', ['one_short', 'one_over', 'short_by_more', 'over_by_more']],
      ['count_groups', 'help', 'shown', ['addend', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
      ['smaller_fact', 'simplify', 'shown', ['short_by_more', 'over_by_more']],
    ]);
  });

  it('a pulled lever fact names what is drawn and never the total; the simplify lever opens the smaller fact', () => {
    const c = of('facts_7_8', 7, 8);
    const facts = ADDITION_FACT_LEVERS.onScreen(c, { session: [c] }, ['near_double', 'count_groups']);
    expect(facts).toContain('7 + 7');
    expect(facts).not.toMatch(/14|15/);
    expect(ADDITION_FACT_LEVERS.simpler(c, { session: [c] }, 'smaller_fact')).toEqual(smallerFact('facts_7_8', c, [c]));
  });
});
