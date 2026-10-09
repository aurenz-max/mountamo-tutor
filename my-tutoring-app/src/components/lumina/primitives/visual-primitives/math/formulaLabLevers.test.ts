import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { FormulaLabChallenge, FormulaLabChallengeType, FormulaLabData } from './FormulaLab';
import {
  FORMULA_MISSES_BY_MODE, formulaCheck, formulaHarnessInput, formatNumber, observedPosition, type FormulaWork,
} from './formulaLabWorkspace';
import {
  formulaLevers, leverFacts, leverTextLeaks, modelPair, orderCard, practiceLeaks, simplerFormula, substitutionLeaks,
  substitutionText,
} from './formulaLabLevers';
import { evaluateFormulaExpression } from './formulaLabMath';

const v = (symbol: string, name: string, min: number, max: number, step = 1) =>
  ({ symbol, name, unit: 'u', min, max, step, defaultValue: min, accent: 'cyan' as const });
const lab = (expression: string, variables: FormulaLabData['variables']): FormulaLabData => ({
  title: 'Lab', description: '', context: '', transferContext: 'A new setting.', formulaLatex: '', expression, outputSymbol: 'E',
  outputName: 'energy', outputUnit: 'J', variables, sceneKind: 'relationship', challengeType: 'predict-direction', challenges: [], gradeBand: 'Grade 8',
});
const out = (d: FormulaLabData, values: number[]) =>
  evaluateFormulaExpression(d.expression, Object.fromEntries(d.variables.map((x, i) => [x.symbol, values[i]])))!;
const item = (d: FormulaLabData, type: FormulaLabChallengeType, changed: string, base: number[], target: number[]): FormulaLabChallenge => {
  const from = out(d, base), to = out(d, target);
  return { id: `${type}-${changed}-${target.join('_')}`, type, changedVariableSymbol: changed, baselineValues: base, targetValues: target,
    expectedBaselineOutput: from, expectedTargetOutput: to, correctDirection: to > from ? 'increase' : to < from ? 'decrease' : 'stay-same' };
};
const ke = lab('0.5 * m * v ^ 2', [v('m', 'mass', 1, 50), v('v', 'speed', 1, 20, 0.5)]);
const speed = lab('d / t', [v('d', 'distance', 1, 100), v('t', 'time', 1, 20)]);
const NONE = { tokensGrouped: false, substitutionShown: false };
const ids = (levers: { id: string }[]) => levers.map(l => l.id);

describe('declarations', () => {
  it('every checked mode answers every miss on its items with a lever; free-explore has none', () => {
    const items = [
      item(ke, 'predict-direction', 'v', [10, 4], [10, 8]), item(ke, 'predict-direction', 'm', [10, 4], [20, 4]),
      item(speed, 'predict-direction', 't', [40, 4], [40, 8]),
      item(ke, 'predict-magnitude', 'v', [10, 4], [10, 6]), item(ke, 'predict-magnitude', 'm', [10, 4], [5, 4]),
      item(ke, 'construct-formula', 'm', [10, 4], [20, 4]), item(speed, 'construct-formula', 'd', [40, 4], [60, 4]),
      item(ke, 'transfer-apply', 'm', [10, 4], [30, 7]), item(speed, 'transfer-apply', 'd', [40, 4], [90, 6]),
    ];
    for (const c of items) {
      const d = c.changedVariableSymbol === 'm' || c.changedVariableSymbol === 'v' ? ke : speed;
      for (const ctx of [NONE, { tokensGrouped: true, substitutionShown: true }]) {
        const levers = formulaLevers(d, c, [], ctx);
        for (const miss of FORMULA_MISSES_BY_MODE[c.type]) {
          expect(levers.filter(l => l.kind === 'help').some(l => l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
          expect(nextLever(levers, miss), `${c.id} ${miss}`).toBeTruthy();
        }
      }
    }
    expect(formulaLevers(ke, item(ke, 'free-explore', 'm', [10, 4], [20, 4]), [], NONE)).toEqual([]);
  });

  it.each([
    ['opposite_direction', 'find_quantity'], ['missed_change', 'find_quantity'], ['invented_change', 'find_quantity'],
  ])('predict-direction: %s pulls %s first, then the model pair', (miss, first) => {
    const c = item(speed, 'predict-direction', 't', [40, 4], [40, 8]);
    expect(ids(formulaLevers(speed, c, [], NONE))).toEqual(['find_quantity', 'model_pair', 'simpler_problem']);
    expect(nextLever(formulaLevers(speed, c, [], NONE), miss)).toBe(first);
    if (miss !== 'invented_change') expect(nextLever(formulaLevers(speed, c, [first], NONE), miss)).toBe('model_pair');
  });

  it('magnitude: strength misses pull the track scale; construct and transfer pull the lever made for each miss', () => {
    const mag = item(ke, 'predict-magnitude', 'v', [10, 4], [10, 6]);
    expect(nextLever(formulaLevers(ke, mag, [], NONE), 'too_weak')).toBe('track_scale');
    expect(nextLever(formulaLevers(ke, mag, [], NONE), 'too_strong')).toBe('track_scale');
    const build = item(speed, 'construct-formula', 'd', [40, 4], [60, 4]);
    expect(nextLever(formulaLevers(speed, build, [], NONE), 'incomplete')).toBe('group_tokens');
    expect(nextLever(formulaLevers(speed, build, [], NONE), 'inverted')).toBe('value_check');
    expect(ids(formulaLevers(speed, build, [], { ...NONE, tokensGrouped: true }))).toEqual(['value_check', 'order_card']);
    const tr = item(speed, 'transfer-apply', 'd', [40, 4], [90, 6]);
    expect(nextLever(formulaLevers(speed, tr, [], NONE), 'used_starting_inputs')).toBe('substitution');
    expect(nextLever(formulaLevers(speed, tr, ['substitution'], NONE), 'used_starting_inputs')).toBe('new_inputs');
    expect(nextLever(formulaLevers(speed, tr, [], NONE), 'power_as_multiply')).toBe('order_card');
  });
});

describe('leak rules', () => {
  it('no predict lever or fact names a direction or an amount', () => {
    for (const c of [item(speed, 'predict-direction', 't', [40, 4], [40, 8]), item(ke, 'predict-magnitude', 'v', [10, 4], [10, 6])]) {
      const d = c.changedVariableSymbol === 't' ? speed : ke;
      const levers = formulaLevers(d, c, [], NONE);
      for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), l.id).toBe(false);
      expect(leverTextLeaks(leverFacts(d, c, levers.map(l => l.id)))).toBe(false);
    }
  });

  it('the model pair and the order card use none of the item\'s letters, and the pair none of its numbers', () => {
    const xy = lab('k * x / y', [v('k', 'k', 1, 10), v('x', 'x', 1, 10), v('y', 'y', 1, 10)]);
    const c = item(xy, 'predict-direction', 'x', [2, 3, 4], [2, 6, 4]);
    const pair = modelPair(xy, c)!;
    expect([pair.input, pair.output]).toEqual(['p', 'q']);
    const shown = pair.rows.flatMap(r => [r.from, r.to, r.outFrom, r.outTo]).map(formatNumber);
    const theirs = [...c.baselineValues, ...c.targetValues, c.expectedBaselineOutput, c.expectedTargetOutput].map(formatNumber);
    expect(shown.filter(n => theirs.includes(n))).toEqual([]);
    for (const line of orderCard(speed)) expect(line).not.toMatch(/\b[dt]\b/);
    // Every number set collides: no pair is offered.
    const crowded = { ...c, baselineValues: [2, 3, 4, 5, 6, 9], targetValues: [5, 12, 20], expectedBaselineOutput: 6, expectedTargetOutput: 3 };
    expect(modelPair(xy, crowded)).toBeNull();
    expect(ids(formulaLevers(xy, crowded, [], NONE))).not.toContain('model_pair');
  });

  it('the substitution is refused when it would print the answer', () => {
    const identity = lab('x * 1', [v('x', 'x', 1, 50)]);
    const c = item(identity, 'transfer-apply', 'x', [3], [7]);
    expect(substitutionText(identity, c)).toBe('7 × 1');
    expect(substitutionLeaks(identity, c)).toBe(true);
    expect(ids(formulaLevers(identity, c, [], NONE))).not.toContain('substitution');
    expect(substitutionLeaks(speed, item(speed, 'transfer-apply', 'd', [40, 4], [90, 6]))).toBe(false);
  });
});

describe('simplify builders', () => {
  const rand = (n: number) => Math.floor(Math.random() * n);
  it('predict: a quantity that only multiplies, doubled or halved, same mode, never the item; none when the item already multiplies', () => {
    for (let n = 0; n < 200; n++) {
      const type = n % 2 ? 'predict-direction' : 'predict-magnitude';
      const base = [1 + rand(50), 1 + rand(39) * 0.5];
      const target = [base[0], Math.min(20, base[1] + 0.5 + rand(10) * 0.5)];
      const c = item(ke, type, 'v', base, target);
      const p = simplerFormula(ke, c);
      expect(p, c.id).not.toBeNull();
      expect(p!.type).toBe(type);
      expect(p!.changedVariableSymbol).toBe('m');
      expect(p!.targetValues[1]).toBe(base[1]);
      expect([base[0] * 2, base[0] / 2, Math.round(base[0] / 2), Math.floor(base[0] / 2)]).toContain(p!.targetValues[0]);
      expect(p!.expectedTargetOutput).toBeCloseTo(out(ke, p!.targetValues));
      expect(practiceLeaks(c, p!)).toBe(false);
      const right = formulaHarnessInput(ke, p!, 'correct')!;
      const work: FormulaWork = { prediction: right.kind === 'predict' ? right.percent / 100 : null, tokens: [], answer: '', value: null };
      expect(formulaCheck(ke, p!, work).correct).toBe(true);
      if (type === 'predict-magnitude') expect(Math.abs(observedPosition(p!))).toBeGreaterThanOrEqual(0.45);
    }
    expect(simplerFormula(ke, item(ke, 'predict-direction', 'm', [10, 4], [20, 4]))).toBeNull();
  });

  it('transfer: the same formula on small whole inputs, none the item\'s, an answer not near the item\'s', () => {
    for (let n = 0; n < 200; n++) {
      const base = [1 + rand(50), 1 + rand(20)], target = [1 + rand(50), 1 + rand(20)];
      const c = item(speed, 'transfer-apply', 'd', base, target);
      const p = simplerFormula(speed, c);
      if (!p) continue;
      expect(p.type).toBe('transfer-apply');
      expect(p.targetValues.every(x => [1, 2, 3, 4, 5, 10].includes(x))).toBe(true);
      expect(p.targetValues.some((x, i) => x === c.targetValues[i])).toBe(false);
      expect(Math.abs(p.expectedTargetOutput - c.expectedTargetOutput)).toBeGreaterThan(0.05 * Math.abs(c.expectedTargetOutput));
      expect(p.showSubstitutionSetup).toBe(true);
    }
    expect(simplerFormula(speed, item(speed, 'construct-formula', 'd', [40, 4], [60, 4]))).toBeNull();
  });
});
