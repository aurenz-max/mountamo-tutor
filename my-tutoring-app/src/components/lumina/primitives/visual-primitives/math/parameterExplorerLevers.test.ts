import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ParameterExplorerChallenge, ParameterExplorerData } from './ParameterExplorer';
import { PARAMETER_MISSES_BY_MODE, askedOutput, formatOutput, formulaDirection } from './parameterExplorerWorkspace';
import {
  doubleMarks, doublingModel, leverFacts, leverTextLeaks, modelPair, parameterLevers, practiceLeaks, scalingModel,
  simplerParameter, substitutionLeaks, substitutionText,
} from './parameterExplorerLevers';

const p = (symbol: string, name: string, min: number, max: number, step: number, def: number) =>
  ({ symbol, name, unit: 'u', min, max, step, default: def, description: '' });
const lab = (formula: string, jsExpression: string, parameters: ParameterExplorerData['parameters']): ParameterExplorerData =>
  ({ title: 'Lab', formula, jsExpression, outputName: 'Output', outputUnit: 'J', context: '', parameters, challenges: [] });
/** a = F / m: F only multiplies, m divides. */
const motion = lab('a = \\frac{F}{m}', 'F / m', [p('F', 'Force', 1, 100, 1, 20), p('m', 'Mass', 1, 50, 1, 5)]);
/** KE = ½ m v²: m only multiplies, v is squared. */
const energy = lab('KE = \\frac{1}{2}mv^2', '0.5 * m * Math.pow(v, 2)', [p('m', 'Mass', 1, 100, 1, 10), p('v', 'Velocity', 0, 20, 0.5, 5)]);
/** P = k + c·t: t only adds (with c), k is a plain term. */
const sum = lab('P = k + 3t', 'k + 3 * t', [p('k', 'Base', 0, 50, 1, 10), p('t', 'Time', 0, 20, 1, 4)]);

const dir = (d: ParameterExplorerData, vary: string, newValue: number): ParameterExplorerChallenge => {
  const c: ParameterExplorerChallenge = { id: `d-${vary}-${newValue}`, type: 'predict-direction', instruction: '',
    prediction: { varyParameter: vary, newValue, explanation: '' } };
  return { ...c, prediction: { ...c.prediction!, correctDirection: formulaDirection(d, c)! } };
};
const val = (d: ParameterExplorerData, vary: string, newValue: number): ParameterExplorerChallenge => {
  const c: ParameterExplorerChallenge = { id: `v-${vary}-${newValue}`, type: 'predict-value', instruction: '',
    prediction: { varyParameter: vary, newValue, tolerance: 0.1, explanation: '' } };
  return { ...c, prediction: { ...c.prediction!, correctValue: askedOutput(d, c)! } };
};
const idf = (): ParameterExplorerChallenge => ({ id: 'i1', type: 'identify-relationship', instruction: '', correctParameter: 'v' });
const ON = { outputShown: true };
const ids = (levers: { id: string }[]) => levers.map(l => l.id);

const ITEMS: Array<[ParameterExplorerData, ParameterExplorerChallenge]> = [
  [motion, dir(motion, 'm', 10)], [motion, dir(motion, 'F', 40)], [energy, dir(energy, 'v', 8)], [sum, dir(sum, 't', 9)],
  [motion, val(motion, 'F', 30)], [motion, val(motion, 'm', 10)], [energy, val(energy, 'v', 10)], [energy, val(energy, 'm', 20)],
  [sum, val(sum, 't', 9)], [energy, idf()],
];

describe('declarations', () => {
  it('every checked mode answers every miss on its items with a help lever; explore has none', () => {
    for (const [d, c] of ITEMS) {
      const levers = parameterLevers(d, c, [], ON);
      for (const miss of PARAMETER_MISSES_BY_MODE[c.type]) {
        expect(levers.filter(l => l.kind === 'help').some(l => l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
        expect(nextLever(levers, miss), `${c.id} ${miss}`).toBeTruthy();
      }
    }
    expect(parameterLevers(motion, { id: 'e', type: 'explore', instruction: 'Move it.' }, [], ON)).toEqual([]);
  });

  it('predict-direction: a divisor gets the ring, the model pair and the simpler problem; a multiplier has nothing simpler', () => {
    expect(ids(parameterLevers(motion, dir(motion, 'm', 10), [], ON))).toEqual(['find_parameter', 'model_pair', 'simpler_problem']);
    expect(ids(parameterLevers(motion, dir(motion, 'F', 40), [], ON))).toEqual(['find_parameter', 'model_pair']);
    expect(nextLever(parameterLevers(motion, dir(motion, 'm', 10), [], ON), 'opposite_direction')).toBe('find_parameter');
    expect(nextLever(parameterLevers(motion, dir(motion, 'm', 10), ['find_parameter'], ON), 'opposite_direction')).toBe('model_pair');
  });

  it('predict-value and identify pull the lever made for each miss', () => {
    expect(nextLever(parameterLevers(energy, val(energy, 'v', 10), [], ON), 'assumed_proportional')).toBe('substitution');
    expect(nextLever(parameterLevers(energy, val(energy, 'v', 10), ['substitution'], ON), 'assumed_proportional')).toBe('scaling_model');
    expect(nextLever(parameterLevers(energy, idf(), [], ON), 'largest_value')).toBe('double_marks');
    expect(nextLever(parameterLevers(energy, idf(), ['double_marks'], ON), 'largest_value')).toBe('doubling_model');
    // With the output hidden (hard tier) there is nothing to test against: no marks.
    expect(ids(parameterLevers(energy, idf(), [], { outputShown: false }))).toEqual(['doubling_model']);
  });
});

describe('leak rules', () => {
  it('no lever text or fact names a direction', () => {
    for (const [d, c] of ITEMS) {
      const levers = parameterLevers(d, c, [], ON);
      for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), `${c.id} ${l.id}`).toBe(false);
      expect(leverTextLeaks(leverFacts(d, c, ids(levers))), c.id).toBe(false);
    }
  });

  it('the models use none of the item\'s letters or numbers', () => {
    for (const [d, c] of ITEMS) {
      const avoid = new Set([...d.parameters.flatMap(x => [x.default, x.default * 2, x.min, x.max]), c.prediction?.newValue,
        askedOutput(d, c)].filter((v): v is number => typeof v === 'number').map(formatOutput));
      for (const model of [modelPair(d, c), scalingModel(d, c), doublingModel(d, c)]) {
        if (!model) continue;
        const text = model.rows.map(r => `${r.rule} ${r.from} ${r.to} ${formatOutput(r.outFrom)} ${formatOutput(r.outTo)}`).join(' ');
        for (const n of text.match(/\d+(\.\d+)?/g) ?? []) expect(avoid.has(n), `${c.id} ${n}`).toBe(false);
        for (const s of d.parameters.map(x => x.symbol)) expect([model.input, model.output]).not.toContain(s);
      }
    }
    expect(modelPair(motion, dir(motion, 'm', 10))!.rows.map(r => r.rule)).toEqual(['y = 42 × x', 'y = 42 ÷ x']);
  });

  it('the substitution writes the setting in and never the answer', () => {
    expect(substitutionText(motion, val(motion, 'F', 30))).toBe('a = 30 ÷ 5');
    expect(substitutionText(energy, val(energy, 'v', 10))).toBe('KE = 0.5 × 10 × 10^2');
    expect(substitutionLeaks(energy, val(energy, 'v', 10))).toBe(false);
    // k + 3t with t = 0 prints "10 + 3 × 0": the answer 10 is one of its numbers, so it is not offered.
    const leaky = val(sum, 't', 0);
    expect(substitutionLeaks(sum, leaky)).toBe(true);
    expect(ids(parameterLevers(sum, leaky, [], ON))).not.toContain('substitution');
  });

  it('the doubling marks sit at each start and its double, only where the double fits', () => {
    expect(doubleMarks(energy)).toEqual([{ symbol: 'm', start: 10, double: 20 }, { symbol: 'v', start: 5, double: 10 }]);
    expect(doubleMarks(lab('y = x', 'x * w', [p('x', 'X', 0, 15, 1, 10), p('w', 'W', 0, 9, 1, 3)])).map(m => m.symbol)).toEqual(['w']);
  });
});

describe('simpler problems', () => {
  it('stay in the mode, take a new id, never repeat the item, and answer on the slider grid', () => {
    let built = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;
      const d = [motion, energy, sum][seed % 3];
      const q = d.parameters[Math.floor(r(1) * d.parameters.length)];
      const steps = Math.round((q.max - q.min) / q.step);
      const newValue = q.min + Math.round(r(2) * steps) * q.step;
      if (newValue === q.default) continue;
      for (const c of [dir(d, q.symbol, newValue), val(d, q.symbol, newValue)]) {
        const s = simplerParameter(d, c);
        if (!s) continue;
        built++;
        expect(s.id).toBe(`${c.id}~simpler`);
        expect(s.type).toBe(c.type);
        expect(practiceLeaks(d, c, s)).toBe(false);
        const sp = d.parameters.find(x => x.symbol === s.prediction!.varyParameter)!;
        expect(s.prediction!.newValue! >= sp.min && s.prediction!.newValue! <= sp.max).toBe(true);
        if (c.type === 'predict-direction') expect(s.prediction!.correctDirection).toBe(formulaDirection(d, s));
        else expect(s.prediction!.correctValue).toBe(askedOutput(d, s));
        expect(simplerParameter(d, s)).toBeNull();
      }
    }
    expect(built).toBeGreaterThan(50);
  });

  it('predict-direction: offered only when the item\'s parameter does not only multiply, on one that does', () => {
    expect(simplerParameter(motion, dir(motion, 'F', 40))).toBeNull();
    expect(simplerParameter(motion, dir(motion, 'm', 10))!.prediction).toMatchObject({ varyParameter: 'F', newValue: 40, correctDirection: 'increase' });
    expect(simplerParameter(energy, dir(energy, 'v', 8))!.prediction).toMatchObject({ varyParameter: 'm', newValue: 20 });
  });
});
