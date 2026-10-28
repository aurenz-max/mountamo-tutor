import { describe, expect, it } from 'vitest';
import { ADD_SUB_20, addSub20Items } from '../itemSpace/addSub20';
import { TIER_BANDS, tierPick } from '../itemSpace';
import { answerOf, fluencyOptions, itemAsFluencyFact, lessonMixesOperations, matchEquations, operationScope, pickFluencyFacts, type FluencyMode } from './mathFactFluencyItemSpace';

const MODES: FluencyMode[] = ['visual-fact', 'equation-solve', 'speed-round', 'match', 'missing-number'];

describe('math-fact-fluency item-space adapter', () => {
  it('result modes take result-unknown facts; missing-number takes a hidden operand; all within scope', () => {
    for (const mode of MODES) for (const it of addSub20Items()) {
      const f = itemAsFluencyFact('add-sub-20', it, mode, 10, true);
      if (!f) continue;
      expect(Math.max(f.operand1, f.operand2, f.result)).toBeLessThanOrEqual(10);
      expect(f.result).toBe(f.operation === 'addition' ? f.operand1 + f.operand2 : f.operand1 - f.operand2);
      expect(f.unknownPosition === 'result').toBe(mode !== 'missing-number');
    }
  });

  it('addition-only lessons get no subtraction', () => {
    for (const it of addSub20Items()) {
      const f = itemAsFluencyFact('add-sub-20', it, 'speed-round', 20, false);
      if (f) expect(f.operation).toBe('addition');
    }
  });

  it('every mode fills a session at every tier within 20 and within 10, distinct, ordered easy < hard', () => {
    for (const mode of MODES) for (const maxNumber of [10, 20]) {
      const scope = (it: unknown) => itemAsFluencyFact('add-sub-20', it, mode, maxNumber, true) !== null;
      const means = (['easy', 'medium', 'hard'] as const).map((tier) => {
        const facts = pickFluencyFacts({ space: 'add-sub-20', pick: tierPick(ADD_SUB_20, undefined, scope), band: TIER_BANDS[tier], count: 8, mode, maxNumber, subtraction: true });
        expect(facts).toHaveLength(8);
        expect(new Set(facts.map((f) => `${f.fact.operand1}${f.fact.operation}${f.fact.operand2}`)).size).toBe(8);
        return facts.reduce((s, f) => s + f.itemSpace.beta, 0) / facts.length;
      });
      expect(means[0]).toBeLessThan(means[2]);
    }
  });

  it('options: four distinct, the answer once, all inside 0..maxNumber; near spread stays within 3', () => {
    for (const it of addSub20Items().slice(0, 3000)) {
      const f = itemAsFluencyFact('add-sub-20', it, 'equation-solve', 10, true);
      if (!f) continue;
      for (const spread of ['far', 'near'] as const) {
        const opts = fluencyOptions(ADD_SUB_20, it, f, 10, spread);
        expect(new Set(opts).size).toBe(4);
        expect(opts.filter((o) => o === answerOf(f))).toHaveLength(1);
        expect(opts.every((o) => o >= 0 && o <= 10)).toBe(true);
        if (spread === 'near') expect(opts.every((o) => Math.abs(o - answerOf(f)) <= 3)).toBe(true);
      }
    }
  });

  it('match equations: the correct one, three others with different results inside the range', () => {
    for (const it of addSub20Items()) {
      const f = itemAsFluencyFact('add-sub-20', it, 'match', 20, true);
      if (!f) continue;
      const eqs = matchEquations(f, 20, 2);
      const results = eqs.map((e) => Number(e.split('=')[1]));
      expect(eqs).toHaveLength(4);
      expect(new Set(results).size).toBe(4);
      expect(results.every((r) => r >= 1 && r <= 20)).toBe(true);
      expect(eqs.filter((e) => Number(e.split('=')[1]) === f.result)).toHaveLength(1);
    }
  });
});

const BALANCE = {
  addition: tierPick(ADD_SUB_20, undefined, operationScope('add-sub-20', 'equation-solve', 20, 'addition')),
  subtraction: tierPick(ADD_SUB_20, undefined, operationScope('add-sub-20', 'equation-solve', 20, 'subtraction')),
};

describe('mixed sets (OPS002-04-c)', () => {
  it('reads a mixed-set lesson, not a one-operation one', () => {
    expect(lessonMixesOperations('Complete a mixed set of timed addition and subtraction problems within 20. Constraints: randomized operation sequence')).toBe(true);
    expect(lessonMixesOperations('Develop automaticity with addition facts for sums up to 20')).toBe(false);
    expect(lessonMixesOperations('Subtraction facts within 20')).toBe(false);
  });

  it('a mixed set is half of each operation, in no fixed order, every number within 20', () => {
    const orders = new Set<string>();
    for (const tier of ['easy', 'medium', 'hard'] as const) for (let run = 0; run < 30; run++) {
      const scope = (it: unknown) => itemAsFluencyFact('add-sub-20', it, 'equation-solve', 20, true) !== null;
      const facts = pickFluencyFacts({ space: 'add-sub-20', pick: tierPick(ADD_SUB_20, undefined, scope), band: TIER_BANDS[tier],
        count: 8, mode: 'equation-solve', maxNumber: 20, subtraction: true, balance: BALANCE });
      expect(facts).toHaveLength(8);
      const ops = facts.map((f) => (f.fact.operation === 'addition' ? '+' : '-')).join('');
      expect(ops.split('-').length - 1).toBe(4);
      orders.add(ops);
      for (const { fact } of facts) expect(Math.max(fact.operand1, fact.operand2, fact.result)).toBeLessThanOrEqual(20);
    }
    // Not alternating, not blocked: many orders.
    expect(orders.size).toBeGreaterThan(20);
  });

  it('within 20 a hard mixed set reaches subtraction from the teens', () => {
    const scope = (it: unknown) => itemAsFluencyFact('add-sub-20', it, 'equation-solve', 20, true) !== null;
    let teen = 0;
    for (let run = 0; run < 30; run++) {
      const facts = pickFluencyFacts({ space: 'add-sub-20', pick: tierPick(ADD_SUB_20, undefined, scope), band: TIER_BANDS.hard,
        count: 8, mode: 'equation-solve', maxNumber: 20, subtraction: true, balance: BALANCE });
      teen += facts.filter(({ fact }) => fact.operation === 'subtraction' && fact.operand1 > 10).length;
    }
    expect(teen).toBeGreaterThan(30);
  });
});
