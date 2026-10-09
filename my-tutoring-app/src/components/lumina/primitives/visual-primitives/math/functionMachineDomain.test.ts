import { describe, expect, it } from 'vitest';
import {
  judgeMakeRule, makeRuleAsk, makeRuleMissWords, makeRulePairs, makeRuleTarget, sameMachine, showRule, tilesToRule,
  evaluateRule, rulesEquivalent, type RuleComplexity,
} from './functionMachineDomain';
import { buildMakeRuleChallenges } from '../../../service/math/gemini-function-machine';
import { functionMachineOracle } from '../../../service/qa/oracles/function-machine';

const t = (s: string) => s.split(' ');
const ctx = { componentId: 'function-machine', evalMode: 'make_rule', topic: 'Function rules', gradeLevel: 'grade 4' };

describe('function machine rule arithmetic (moved, unchanged)', () => {
  it('still judges the older modes the same way', () => {
    expect(evaluateRule('2*x + 1', 3)).toBe(7);
    expect(rulesEquivalent('2*x+1', 'x*2 + 1')).toBe(true);
    expect(rulesEquivalent('x + 3', 'x + 4')).toBe(false);
  });
});

describe('make_rule tiles', () => {
  it('reads digits as one number and writes the implied times', () => {
    expect(tilesToRule(t('3 x'))).toBe('3*x');
    expect(tilesToRule(t('1 2 ÷ x'))).toBe('12/x');
    expect(tilesToRule(t('2 ( x + 1 )'))).toBe('2*(x+1)');
    expect(tilesToRule(t('x × x − 4'))).toBe('x*x-4');
    expect(showRule(t('3 x + 1 0'))).toBe('3x + 10');
  });
});

describe('make_rule judge: 4 into 12', () => {
  it('a pass, then a second different pass', () => {
    const first = judgeMakeRule(t('3 x'), 4, 12);
    expect(first.miss).toBeUndefined();
    const second = judgeMakeRule(t('x + 8'), 4, 12, [first.rule]);
    expect(second.miss).toBeUndefined();
    // More makes pass: 2x + 4, x^2 - 4.
    expect(judgeMakeRule(t('2 x + 4'), 4, 12, [first.rule, second.rule]).miss).toBeUndefined();
    expect(judgeMakeRule(t('x ^ 2 − 4'), 4, 12, [first.rule]).miss).toBeUndefined();
  });

  it('one over and one under name what the machine gave', () => {
    const over = judgeMakeRule(t('x + 9'), 4, 12);
    expect(over).toMatchObject({ miss: 'wrong_output', gave: 13 });
    expect(makeRuleMissWords(over, 4, 12)).toBe('Your machine turns 4 into 13, not 12. Change a tile and try again.');
    expect(judgeMakeRule(t('x + 7'), 4, 12)).toMatchObject({ miss: 'wrong_output', gave: 11 });
  });

  it('the same machine written another way is not a second machine', () => {
    expect(judgeMakeRule(t('x × 3'), 4, 12, ['3*x']).miss).toBe('same_machine');
    expect(judgeMakeRule(t('8 + x'), 4, 12, ['x+8']).miss).toBe('same_machine');
    expect(judgeMakeRule(t('x + 4 + 4'), 4, 12, ['x+8']).miss).toBe('same_machine');
    expect(sameMachine('48/x', '96/(2*x)')).toBe(true);
    expect(sameMachine('3*x', 'x+8')).toBe(false);
  });

  it('a machine that ignores its input, or cannot run, is a miss', () => {
    expect(judgeMakeRule(t('1 2'), 4, 12).miss).toBe('no_input');
    expect(judgeMakeRule(t('x − x + 1 2'), 4, 12).miss).toBe('no_input');
    expect(judgeMakeRule(t('0 x + 1 2'), 4, 12).miss).toBe('no_input');
    expect(judgeMakeRule(t('x +'), 4, 12).miss).toBe('not_a_rule');
    expect(judgeMakeRule(t('÷ 3'), 4, 12).miss).toBe('not_a_rule');
  });

  it('miss words never name a tile or a rule that would work', () => {
    for (const miss of ['not_a_rule', 'no_input', 'same_machine'] as const) {
      const words = makeRuleMissWords({ miss, gave: 12, rule: '3*x' }, 4, 12);
      expect(words).not.toMatch(/\b(3x|x \+ 8|times|plus|add \d|multiply by)\b/i);
      expect(words).not.toMatch(/\d/);
    }
  });

  it('asks state the pair, and an older payload takes its pair from the rule', () => {
    expect(makeRuleAsk(4, 12, 1)).toBe('Make a machine that turns 4 into 12.');
    expect(makeRuleAsk(4, 12, 2)).toBe('Now make a different machine that also turns 4 into 12.');
    expect(makeRuleTarget({ rule: '3*x', inputQueue: [4] })).toEqual({ input: 4, output: 12 });
    expect(makeRuleTarget({ rule: '3*x', inputQueue: [4], makeInput: 5, makeOutput: 7 })).toEqual({ input: 5, output: 7 });
  });
});

describe('make_rule pairs (code-owned)', () => {
  const bands: RuleComplexity[] = ['oneStep', 'twoStep', 'expression'];
  it.each(bands)('%s: 200 sessions, every pair makeable two different ways, nothing repeated in a session', (band) => {
    let seed = 7;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let run = 0; run < 200; run++) {
      const items = buildMakeRuleChallenges(band, 3, rng);
      const r = functionMachineOracle.verify({ challengeType: 'make_rule', gradeBand: band === 'oneStep' ? '3-4' : band === 'twoStep' ? '5' : 'advanced',
        title: 'Build your own machines', description: 'Make machines that do a job, two different ways.', challenges: items }, ctx);
      expect(r.violations).toEqual([]);
      expect(new Set(items.map((c) => c.rule)).size).toBe(items.length);
      for (const c of items) {
        const additive = c.makeOutput! >= c.makeInput! ? `x+${c.makeOutput! - c.makeInput!}` : `x-${c.makeInput! - c.makeOutput!}`;
        expect(judgeMakeRule(additive.replace('-', '−').split(''), c.makeInput!, c.makeOutput!).miss).toBeUndefined();
      }
    }
  });

  it('grades 3-4: every pair has a one-step add/subtract AND a one-step multiply/divide machine', () => {
    for (let i = 0; i < 100; i++) {
      for (const p of makeRulePairs('oneStep', 3)) {
        const big = Math.max(p.input, p.output);
        const small = Math.min(p.input, p.output);
        expect(big % small).toBe(0);
        expect(big / small).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('the oracle catches a stored machine that does not make the pair, and a shown rule', () => {
    const items = buildMakeRuleChallenges('oneStep', 3);
    items[0] = { ...items[0], rule: 'x + 1000' };
    items[1] = { ...items[1], showRule: true };
    const r = functionMachineOracle.verify({ challengeType: 'make_rule', gradeBand: '3-4', title: 'Machines', description: 'Make machines.', challenges: items }, ctx);
    expect(r.violations.map((v) => v.check)).toEqual(expect.arrayContaining(['answer-key-desync', 'answer-leak']));
  });
});
