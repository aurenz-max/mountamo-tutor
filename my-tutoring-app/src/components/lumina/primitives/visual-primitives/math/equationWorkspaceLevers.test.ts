import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { EquationWorkspaceChallenge } from './EquationWorkspace';
import { equationMiss, type EquationMiss } from './equationWorkspaceDomain';
import {
  FEWER_LEVER, INVERSE_TEXT, MODEL_LEVER, buildLinear, builtLeaks, equationLevers, fewerSteps, itemNumbers, leverFacts,
  leverTextLeaks, markedSides, orderText, practiceLeaks, sidesLeak, workedModel,
} from './equationWorkspaceLevers';

const op = (verb: string, k: string | number, label: string) => ({ id: `algebraic_${verb}${k === '' ? '' : `_${k}`}`, label, category: 'algebraic' as const });
const step = (o: { id: string; label: string }, resultLatex: string) => ({ operation: o.label, operationId: o.id, resultLatex });
const SUB15 = op('subtract', 15, 'Subtract 15 from both sides'), ADD15 = op('add', 15, 'Add 15 to both sides');
const DIV4 = op('divide', 4, 'Divide both sides by 4'), MUL4 = op('multiply', 4, 'Multiply both sides by 4');
const SUB47 = op('subtract', 47, 'Subtract 47 from both sides');
const twoStep = (type: EquationWorkspaceChallenge['type'], id = 'eq-1'): EquationWorkspaceChallenge => ({
  id, type, instruction: '', equation: '4 \\cdot x + 15 = 47', targetVariable: 'x',
  solutionSteps: [step(SUB15, '4 \\cdot x = 32'), step(DIV4, 'x = 8')], availableOperations: [ADD15, DIV4, SUB47, SUB15, MUL4],
  ...(type === 'identify-operation' ? { correctOperationId: SUB15.id } : {}),
});
const DIST = op('distribute', 3, 'Distribute the 3'), COMBINE = op('combine', '', 'Combine like terms');
const SUB1 = op('subtract', 1, 'Subtract 1 from both sides'), DIV3 = op('divide', 3, 'Divide both sides by 3');
const fourStep: EquationWorkspaceChallenge = {
  id: 'eq-m', type: 'multi-step', instruction: '', equation: '3(x + 2) - 5 = 16', targetVariable: 'x',
  solutionSteps: [step(DIST, '3x + 6 - 5 = 16'), step(COMBINE, '3x + 1 = 16'), step(SUB1, '3x = 15'), step(DIV3, 'x = 5')],
  availableOperations: [op('add', 5, 'Add 5 to both sides'), DIV3, DIST, SUB1, COMBINE],
};
const MODES: EquationWorkspaceChallenge['type'][] = ['guided-solve', 'identify-operation', 'solve'];
const ctx = { reminderShown: false, done: 0 };
const ALL: EquationMiss[] = ['later_step', 'not_inverse', 'wrong_number', 'other_operation'];

describe('declarations', () => {
  it.each(MODES)('%s: five levers on a linear item; every miss answered; help before simplify', mode => {
    const levers = equationLevers(twoStep(mode), [], ctx);
    expect(levers.map(l => [l.id, l.kind])).toEqual([['inverse_reminder', 'help'], ['layer_order', 'help'],
      ['sides_marked', 'help'], ['worked_model', 'help'], ['fewer_steps', 'simplify']]);
    for (const miss of ALL) expect(levers.some(l => l.answers?.includes(miss)), miss).toBe(true);
    expect(nextLever(levers, 'not_inverse')).toBe('inverse_reminder');
    expect(nextLever(levers, 'later_step')).toBe('layer_order');
    expect(nextLever(levers, 'wrong_number')).toBe('sides_marked');
    for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), l.id).toBe(false);
  });

  it('multi-step with a distribute step: no model and no simplify, every miss still answered by a help lever', () => {
    const levers = equationLevers(fourStep, [], ctx);
    expect(levers.map(l => l.id)).toEqual(['inverse_reminder', 'layer_order', 'sides_marked']);
    for (const miss of ALL) expect(levers.some(l => l.answers?.includes(miss)), miss).toBe(true);
    expect(orderText(fourStep)).toMatch(/^First tidy each side/);
    expect(orderText(twoStep('solve'))).toMatch(/^Undo in reverse order/);
  });

  it('the easy tier reminder is a starting position, declared pulled; a practice item has no levers', () => {
    expect(equationLevers(twoStep('solve'), [], { reminderShown: true, done: 0 })[0].pulled).toBe(true);
    expect(equationLevers(fewerSteps(twoStep('solve')), [], ctx)).toEqual([]);
  });
});

describe('leak rules', () => {
  it.each([...MODES, 'multi-step' as const])('%s: the panels and their facts carry no digit; the marked sides are the line itself', mode => {
    const c = mode === 'multi-step' ? fourStep : twoStep(mode);
    expect(leverTextLeaks(INVERSE_TEXT)).toBe(false);
    expect(leverTextLeaks(orderText(c))).toBe(false);
    const facts = leverFacts(c, ['inverse_reminder', 'layer_order'], ctx);
    expect(leverTextLeaks(facts)).toBe(false);
    const line = c.equation;
    const sides = markedSides(line, c.targetVariable)!;
    expect(sides).not.toBeNull();
    expect(sidesLeak(sides, line)).toBe(false);
    expect(sidesLeak({ variableSide: sides.variableSide, otherSide: '8' }, line)).toBe(true);
  });

  it('marks the variable side either way round, and refuses a line with the variable on both sides', () => {
    expect(markedSides('47 = 4 \\cdot x + 15', 'x')).toEqual({ variableSide: '4 \\cdot x + 15', otherSide: '47' });
    expect(markedSides('3x + 2 = x + 10', 'x')).toBeNull();
    expect(markedSides('\\frac{V}{I} = R', 'R')).toEqual({ variableSide: 'R', otherSide: '\\frac{V}{I}' });
    expect(markedSides('V = I \\cdot R', 'I')).toEqual({ variableSide: 'I \\cdot R', otherSide: 'V' });
  });

  it.each(MODES)('%s: the worked model is another equation with the same kinds of steps and none of the item\'s numbers', mode => {
    const c = twoStep(mode);
    const m = workedModel(c)!;
    expect(m.variable).toBe('y');
    expect(m.steps.map(s => s.verb)).toEqual(['subtract', 'divide']);
    expect(builtLeaks(c, m)).toBe(false);
    const avoid = itemNumbers(c);
    for (const n of (JSON.stringify(m).match(/\d+/g) ?? []).map(Number)) expect(avoid.has(n), String(n)).toBe(false);
    expect(m.steps.at(-1)!.resultLatex).toBe(`y = ${m.solution}`);
    expect(leverFacts(c, [MODEL_LEVER], ctx)).toMatch(/different equation/);
  });
});

describe('builders', () => {
  it('buildLinear keeps whole numbers on every line and undoes in the order given', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const verbs of [['subtract', 'divide'], ['add', 'divide'], ['subtract', 'multiply'], ['divide'], ['subtract'], ['add', 'multiply', 'subtract']]) {
        const b = buildLinear(verbs, 'y', new Set([15, 47, 4, 8, 32]), seed);
        if (!b) continue;
        expect(b.steps.map(s => s.verb)).toEqual(verbs);
        for (const s of b.steps) expect(Number(s.resultLatex.split('=')[1])).toSatisfy((n: number) => Number.isInteger(n) && n > 0);
        expect(b.steps.at(-1)!.resultLatex).toBe(`y = ${b.solution}`);
        for (const n of [b.solution, ...b.steps.map(s => s.k)]) expect([15, 47, 4, 8, 32]).not.toContain(n);
      }
    }
    expect(buildLinear(['distribute', 'subtract'], 'y', new Set(), 1)).toBeNull();
  });

  it.each(MODES)('%s: the practice equation keeps the mode, drops one step, shares no number and checks with its own menu', mode => {
    for (let i = 0; i < 40; i++) {
      const c = twoStep(mode, `eq-${i}`);
      const p = fewerSteps(c)!;
      expect(p).not.toBeNull();
      expect(p.type).toBe(mode);
      expect(p.id).toBe(`eq-${i}~simpler`);
      expect(p.solutionSteps).toHaveLength(1);
      expect(practiceLeaks(c, p)).toBe(false);
      const ids = p.availableOperations.map(o => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(p.solutionSteps[0].operationId);
      expect(ids.length).toBeGreaterThanOrEqual(3);
      // The practice item's menu names the same misses the item's check does.
      const wrong = p.availableOperations.filter(o => o.id !== p.solutionSteps[0].operationId).map(o => equationMiss(p, 0, o.id));
      expect(wrong).toContain('not_inverse');
      expect(p.solutionSteps[0].operation).toMatch(/^Subtract \d+ from both sides$/);
      if (mode === 'identify-operation') expect(p.correctOperationId).toBe(p.solutionSteps[0].operationId);
    }
    expect(fewerSteps(fourStep)).toBeNull();
    expect(equationLevers(twoStep(mode), [FEWER_LEVER], ctx).find(l => l.id === FEWER_LEVER)?.pulled).toBe(true);
  });
});
