/**
 * strategy-picker at K (OPS001-01-F): the default set serves the strategies the objective names (ten frames, tally
 * marks, doubles), and every strategy a challenge offers fits its problem (`fits`): doubles only on equal addends, near
 * doubles one apart, a ten frame only within ten. No model is called: Gemini returns nothing and the fallbacks stand.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn(async () => ({ text: '' })) } } }));
// The objective's number window: "within 10" on a K objective resolves to 10 (the real resolver calls a model).
vi.mock('../objectiveNumberWindow', () => ({ resolveObjectiveNumberWindow: vi.fn(async () => 10) }));

import type { GenerationContext } from '../generation/generationContext';
import type { StrategyId, StrategyPickerChallenge } from '../../primitives/visual-primitives/math/StrategyPicker';
import { fits, makeProblem, offeredStrategies, strategyMisfits } from '../../primitives/visual-primitives/math/strategyPickerLevers';
import { validateStrategyPickerData } from '../../primitives/visual-primitives/math/strategyPicker.boss';
import { K_DEFAULT_STRATEGIES, enforceStrategyFit, generateStrategyPicker } from './gemini-strategy-picker';

const ctx = (targetEvalMode?: string): GenerationContext => ({
  topic: 'Use multiple strategies (ten frames, tally marks, doubles) to solve addition problems within 10',
  gradeContext: 'Kindergarten students (ages 5-6)',
  scope: { objectiveText: 'Use multiple strategies (ten frames, tally marks, doubles) to solve addition problems within 10' },
  raw: { gradeBand: 'K', ...(targetEvalMode ? { targetEvalMode } : {}) },
} as unknown as GenerationContext);

describe('fits: the one strategy-fit rule', () => {
  it.each([
    ['doubles', 4, 4, true], ['doubles', 3, 4, false], ['doubles', 2, 6, false],
    ['near-doubles', 3, 4, true], ['near-doubles', 4, 4, false], ['near-doubles', 2, 5, false],
    ['ten-frame', 6, 4, true], ['ten-frame', 7, 5, false], ['make-ten', 7, 3, true], ['make-ten', 2, 3, false],
  ] as const)('%s on %i + %i → %s', (s, a, b, ok) => {
    expect(fits(s as StrategyId, makeProblem(a, b, 'addition'))).toBe(ok);
  });
  it('no addition strategy fits a subtraction problem except counting back', () => {
    const sub = makeProblem(7, 3, 'subtraction');
    for (const s of K_DEFAULT_STRATEGIES) expect(fits(s, sub)).toBe(false);
    expect(fits('counting-back', sub)).toBe(true);
  });
});

describe('the fit gate', () => {
  const guided = (s: string, a: number, b: number): StrategyPickerChallenge => ({ id: `${s}-${a}-${b}`, type: 'guided-strategy',
    instruction: 'Solve it.', problem: makeProblem(a, b, 'addition'), assignedStrategy: s as StrategyId, strategySteps: ['Look.'] });
  it('the boss rejects a doubles item on unequal addends and a ten frame past ten', () => {
    expect(strategyMisfits(guided('doubles', 3, 5))).toEqual(['doubles']);
    expect(() => validateStrategyPickerData({ title: 't', challenges: [guided('doubles', 3, 5)] })).toThrow();
    expect(() => validateStrategyPickerData({ title: 't', challenges: [guided('ten-frame', 6, 6)] })).toThrow();
    expect(validateStrategyPickerData({ title: 't', challenges: [guided('doubles', 3, 3)] }).challenges).toHaveLength(1);
  });
  it('the generator drops a misfit and trims a menu to the strategies that fit', () => {
    const choose: StrategyPickerChallenge = { id: 'c', type: 'choose-your-strategy', instruction: 'Pick.',
      problem: makeProblem(2, 5, 'addition'), availableStrategies: ['doubles', 'ten-frame', 'counting-on'] };
    const out = enforceStrategyFit([guided('doubles', 2, 5), choose]);
    expect(out.map(c => c.id)).toEqual(['c']);
    expect(out[0].availableStrategies).toEqual(['ten-frame', 'counting-on']);
  });
});

describe('generateStrategyPicker at K, within 10', () => {
  const modes = ['guided', 'match', 'try_another', 'compare', 'choose', undefined];
  it.each(modes)('mode %s: 25 runs, every offered strategy fits its problem, within ten, addition only', async mode => {
    for (let run = 0; run < 25; run++) {
      const data = await generateStrategyPicker(ctx(mode));
      expect(data.gradeBand).toBe('K');
      expect(data.strategiesIntroduced).toEqual(expect.arrayContaining(['doubles', 'ten-frame', 'tally-marks']));
      expect(data.strategiesIntroduced).not.toContain('make-ten');
      expect(data.challenges.length).toBeGreaterThan(0);
      for (const c of data.challenges) {
        expect(c.problem.operation).toBe('addition');
        expect(c.problem.result).toBeLessThanOrEqual(10);
        expect(offeredStrategies(c).length).toBeGreaterThan(0);
        expect(strategyMisfits(c), `${c.type} ${c.problem.equation} ${offeredStrategies(c)}`).toEqual([]);
      }
      expect(() => validateStrategyPickerData(data)).not.toThrow();
    }
  });
  it('guided at K serves doubles and the ten frame as named strategies across runs', async () => {
    const seen = new Set<string>();
    for (let run = 0; run < 15; run++) {
      for (const c of (await generateStrategyPicker(ctx('guided'))).challenges) seen.add(c.assignedStrategy!);
    }
    expect(seen).toContain('doubles');
    expect(seen).toContain('ten-frame');
  });
  it('a match worked solution never names the ten frame or a double', async () => {
    for (let run = 0; run < 25; run++) {
      for (const c of (await generateStrategyPicker(ctx('match'))).challenges) {
        expect(c.workedSolution!.toLowerCase()).not.toMatch(/ten frame|double/);
      }
    }
  });
});
