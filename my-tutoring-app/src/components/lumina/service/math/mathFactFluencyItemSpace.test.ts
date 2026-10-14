import { describe, expect, it } from 'vitest';
import { ADD_SUB_20, addSub20Items } from '../itemSpace/addSub20';
import { TIER_BANDS, tierPick } from '../itemSpace';
import { answerOf, fluencyOptions, itemAsFluencyFact, matchEquations, pickFluencyFacts, type FluencyMode } from './mathFactFluencyItemSpace';

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
