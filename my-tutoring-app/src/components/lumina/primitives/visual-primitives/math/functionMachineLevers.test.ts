import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { FunctionMachineChallenge, FunctionMachineChallengeType } from './FunctionMachine';
import { evaluateRule, makeRuleTarget, rulesEquivalent } from './functionMachineDomain';
import {
  MODEL_LEVER, OUTPUT_STEPS_LEVER, RUN_MACHINE_LEVER, SHAPES_LEVER, SIMPLER_LEVER, STEP_ORDER_LEVER, CHECK_PAIRS_LEVER,
  MACHINE_LEVERS, containsPhrase, isPracticeMachine, machineModel, machineRun, machineShapes, modelText, outputSteps,
  pairMarks, practiceItem, practiceLeaks, ruleSteps, simplerMachine, type MachineLeverContext,
} from './functionMachineLevers';
import type { FunctionMachineItem } from './functionMachineWorkspace';
import { buildMakeRuleChallenges } from '../../../service/math/gemini-function-machine';

const RULES = ['x + 1', 'x + 4', 'x + 7', 'x - 2', 'x - 5', '2*x', '3*x', '4*x', '10*x', 'x/2', 'x/5', '2*x + 1', '3*x - 2',
  '5*x + 3', 'x^2', 'x^2 + 1'];
const QUEUES: Record<string, number[]> = { predict: [2, 3, 4, 6, 8], discover_rule: [0, 1, 2, 3, 4], create_rule: [0, 1, 2, 3, 5] };
const item = (rule: string, mode: string): FunctionMachineChallenge =>
  ({ id: `fm-${rule}`, rule, inputQueue: QUEUES[mode], showRule: mode === 'predict' });
const outputs = (c: FunctionMachineChallenge) => c.inputQueue.map(x => String(evaluateRule(c.rule, x)));
const pairsOf = (c: FunctionMachineChallenge, n = c.inputQueue.length) =>
  c.inputQueue.slice(0, n).map(input => ({ input, output: evaluateRule(c.rule, input)! }));
const ctx = (mode: FunctionMachineChallengeType, c: FunctionMachineChallenge, extra: Partial<MachineLeverContext> = {}): MachineLeverContext =>
  ({ pairs: mode === 'predict' ? [] : pairsOf(c, 2), lastGuess: '', lastMachine: [], ...extra });
const asItem = (c: FunctionMachineChallenge, mode: FunctionMachineChallengeType): FunctionMachineItem => ({ ...c, mode });

describe('model_machine never shows the item\'s answer', () => {
  it.each(RULES)('predict %s: a model exists, of another rule, and none of its numbers is an output of the item', rule => {
    const c = item(rule, 'predict'), m = machineModel(c, 'predict')!;
    expect(m).not.toBeNull();
    expect(rulesEquivalent(m.rule, c.rule)).toBe(false);
    for (const o of outputs(c)) expect(containsPhrase(modelText(m), o), `${modelText(m)} has ${o}`).toBe(false);
  });
  it.each(RULES.flatMap(r => [[r, 'discover_rule'], [r, 'create_rule']] as const))('%s %s: a model exists and never writes the rule', (rule, mode) => {
    const c = item(rule, mode), m = machineModel(c, mode)!;
    expect(m).not.toBeNull();
    expect(m.pairs).toHaveLength(3);
    expect(rulesEquivalent(m.rule, c.rule)).toBe(false);
    expect(containsPhrase(modelText(m), c.rule)).toBe(false);
  });
});

describe('help levers draw only what is already the learner\'s or on screen', () => {
  it('step_order: two steps with exactly the rule\'s own numbers, or nothing', () => {
    expect(ruleSteps('2*x + 1')).toEqual(['× 2', '+ 1']);
    expect(ruleSteps('3*x - 2')).toEqual(['× 3', '− 2']);
    expect(ruleSteps('2*(x+1)')).toBeNull();
    expect(ruleSteps('4*x')).toBeNull();
  });
  it('output_steps: changes between pairs one input apart, from the pairs shown', () => {
    expect(outputSteps([{ input: 1, output: 3 }, { input: 0, output: 1 }, { input: 2, output: 5 }]))
      .toEqual([{ from: 0, to: 1, change: '+2' }, { from: 1, to: 2, change: '+2' }]);
    expect(outputSteps([{ input: 0, output: 4 }, { input: 2, output: 6 }])).toEqual([]);
  });
  it('check_pairs: the learner\'s rule marked on each pair; nothing for a rule that cannot run', () => {
    expect(pairMarks('x + 1', [{ input: 0, output: 1 }, { input: 1, output: 3 }]))
      .toEqual([{ input: 0, output: 1, fits: true }, { input: 1, output: 3, fits: false }]);
    expect(pairMarks('x +', [{ input: 0, output: 1 }])).toBeNull();
  });
  it('run_machine: the learner\'s own machine worked through, never the stored one', () => {
    expect(machineRun(['x', '+', '9'], 4)).toEqual(['4 + 9 = 13', '5 + 9 = 14']);
    expect(machineRun(['3', 'x'], 5)).toEqual(['3 × 5 = 15', '3 × 6 = 18']);
    expect(machineRun(['x', '+'], 4)).toBeNull();
  });
  it('machine_shapes: no number', () => {
    for (const band of ['oneStep', 'twoStep', 'expression']) expect(machineShapes(band).join(' ')).not.toMatch(/\d/);
  });
});

describe('simpler_machine', () => {
  it.each(RULES.flatMap(r => (['predict', 'discover_rule', 'create_rule'] as const).map(m => [r, m] as const)))(
    '%s %s: same mode, own id, never the item\'s rule, and on predict none of its outputs', (rule, mode) => {
      const c = item(rule, mode), p = simplerMachine(c, mode);
      if (!p) return;
      expect(isPracticeMachine(p)).toBe(true);
      expect(practiceLeaks(c, mode, p)).toBe(false);
      expect(rulesEquivalent(p.rule, c.rule)).toBe(false);
      expect(p.showRule).toBe(mode === 'predict');
      if (mode === 'predict') for (const o of outputs(p)) expect(outputs(c)).not.toContain(o);
      expect(simplerMachine(p, mode)).toBeNull();
    });
  it('an item already one step with a small number has no simpler version', () => {
    expect(simplerMachine(item('x + 3', 'discover_rule'), 'discover_rule')).toBeNull();
    expect(simplerMachine(item('2*x', 'create_rule'), 'create_rule')).toBeNull();
    expect(simplerMachine(item('x + 4', 'discover_rule'), 'discover_rule')!.rule).toBe('x + 2');
  });
  it('make_rule: a smaller pair, never the item\'s pair, over 200 generated sessions per band', () => {
    let rng = 7;
    const random = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
    for (const band of ['oneStep', 'twoStep', 'expression'] as const) for (let i = 0; i < 200; i++) {
      for (const c of buildMakeRuleChallenges(band, 3, random)) {
        const p = simplerMachine(c, 'make_rule');
        const t = makeRuleTarget(c)!;
        if (Math.max(t.input, t.output) <= 9) { expect(p).toBeNull(); continue; }
        const q = makeRuleTarget(p!)!;
        expect(q.output).toBeLessThanOrEqual(9);
        expect(q.input === t.input && q.output === t.output).toBe(false);
        expect(evaluateRule(p!.rule, q.input)).toBe(q.output);
      }
    }
  });
});

describe('declarations (MACHINE_LEVERS): every checked miss has a lever on the item', () => {
  const MISSES: Record<string, string[]> = {
    predict: ['gave_input', 'added_not_multiplied', 'multiplied_not_added', 'one_step_only', 'wrong_order', 'too_high', 'too_low'],
    discover_rule: ['not_a_rule', 'fits_some_pairs', 'added_not_multiplied', 'multiplied_not_added', 'one_step_only', 'wrong_order', 'wrong_rule'],
    create_rule: ['not_a_rule', 'fits_some_pairs', 'added_not_multiplied', 'multiplied_not_added', 'one_step_only', 'wrong_order', 'wrong_rule'],
  };
  it.each(RULES.flatMap(r => Object.keys(MISSES).map(m => [r, m] as const)))('%s %s', (rule, mode) => {
    const m = mode as FunctionMachineChallengeType, c = item(rule, m);
    const levers = MACHINE_LEVERS.declare(asItem(c, m), ctx(m, c), []);
    for (const miss of MISSES[mode]) expect(levers.find(l => l.id === nextLever(levers, miss))?.answers, miss).toContain(miss);
    if (mode === 'predict') expect(levers.map(l => l.id)).not.toContain(CHECK_PAIRS_LEVER);
    expect(levers.some(l => l.id === STEP_ORDER_LEVER)).toBe(mode === 'predict' && !!ruleSteps(rule));
  });
  it('check_pairs is offered once a checked rule runs on the pairs', () => {
    const c = item('2*x + 1', 'discover_rule'), one = asItem(c, 'discover_rule');
    const ids = (lastGuess: string) => MACHINE_LEVERS.declare(one, ctx('discover_rule', c, { lastGuess }), []).map(l => l.id);
    expect(ids('')).not.toContain(CHECK_PAIRS_LEVER);
    expect(ids('x +')).not.toContain(CHECK_PAIRS_LEVER);
    expect(ids('x + 1')).toContain(CHECK_PAIRS_LEVER);
  });
  it('make_rule: run_machine once a checked machine runs, first after a wrong output; shapes after a machine that cannot run or repeats the first', () => {
    const [c] = buildMakeRuleChallenges('oneStep', 1, () => 0.5);
    const one = asItem(c, 'make_rule'), simpler = simplerMachine(c, 'make_rule') ? [SIMPLER_LEVER] : [];
    expect(MACHINE_LEVERS.declare(one, { pairs: [], lastGuess: '', lastMachine: [] }, []).map(l => l.id)).toEqual([SHAPES_LEVER, ...simpler]);
    const levers = MACHINE_LEVERS.declare(one, { pairs: [], lastGuess: '', lastMachine: ['x', '+', '9'] }, []);
    expect(nextLever(levers, 'wrong_output')).toBe(RUN_MACHINE_LEVER);
    expect(nextLever(levers, 'not_a_rule')).toBe(SHAPES_LEVER);
    expect(nextLever(levers, 'same_machine')).toBe(SHAPES_LEVER);
    expect(levers.map(l => l.id)).toEqual([RUN_MACHINE_LEVER, SHAPES_LEVER, ...simpler]);
  });
  it('observe has none, and a practice machine has no easier one of its own', () => {
    const c = item('x + 2', 'predict');
    expect(MACHINE_LEVERS.declare(asItem(c, 'observe'), ctx('observe', c), [])).toEqual([]);
    const practice = practiceItem(asItem(item('4*x', 'predict'), 'predict'))!;
    expect(practice.mode).toBe('predict');
    expect(practiceItem(practice)).toBeNull();
  });
  it('lever words carry no digit, so no lever names a number', () => {
    for (const rule of RULES) for (const mode of Object.keys(MISSES) as FunctionMachineChallengeType[]) {
      const c = item(rule, mode);
      for (const l of MACHINE_LEVERS.declare(asItem(c, mode), ctx(mode, c, { lastGuess: 'x + 1' }), [])) {
        expect(`${l.when} ${l.does}`).not.toMatch(/\d/);
      }
    }
  });
});

describe('scene facts for pulled levers (MACHINE_LEVERS.onScreen)', () => {
  it('predict: the model is described, with no output of the item', () => {
    const c = item('4*x', 'predict');
    const facts = MACHINE_LEVERS.onScreen(asItem(c, 'predict'), ctx('predict', c), [MODEL_LEVER, STEP_ORDER_LEVER]);
    expect(facts).toMatch(/different machine of the same kind: f\(x\) = \d+x/);
    for (const o of outputs(c)) expect(containsPhrase(facts, o), o).toBe(false);
  });
  it('discover: the marks, the changes and the model never write the item\'s rule', () => {
    const c = item('2*x + 1', 'discover_rule');
    const facts = MACHINE_LEVERS.onScreen(asItem(c, 'discover_rule'), ctx('discover_rule', c, { lastGuess: 'x + 1' }),
      [MODEL_LEVER, CHECK_PAIRS_LEVER, OUTPUT_STEPS_LEVER]);
    expect(facts).toMatch(/0 → 1 fits, 1 → 3 does not fit/);
    expect(facts).toMatch(/0 to 1: \+2/);
    expect(containsPhrase(facts, c.rule)).toBe(false);
  });
  it('make: the learner\'s machine worked through', () => {
    const c: FunctionMachineChallenge = { id: 'm', rule: '3*x', inputQueue: [4], showRule: false, makeInput: 4, makeOutput: 12 };
    expect(MACHINE_LEVERS.onScreen(asItem(c, 'make_rule'), { pairs: [], lastGuess: '', lastMachine: ['x', '+', '9'] },
      [RUN_MACHINE_LEVER, SHAPES_LEVER]))
      .toBe('The learner\'s machine f(x) = x + 9 is worked through: 4 + 9 = 13; 5 + 9 = 14. Empty machine shapes are shown, '
        + 'each using x with a box for a number.');
  });
  it('support: the model comes by the session tier, medium when none', () => {
    const c = item('4*x', 'predict');
    expect(MACHINE_LEVERS.support(asItem(c, 'predict'), ctx('predict', c))).toMatch(/after a miss, model a different machine/);
    expect(MACHINE_LEVERS.support({ ...asItem(c, 'predict'), supportTier: 'hard' }, ctx('predict', c))).toMatch(/this machine's outputs/);
  });
});
