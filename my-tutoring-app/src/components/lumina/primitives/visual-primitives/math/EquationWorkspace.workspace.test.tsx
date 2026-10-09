// @vitest-environment jsdom
/**
 * Equation workspace on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { EquationWorkspaceChallenge, EquationWorkspaceData } from './EquationWorkspace';
import { COMBINED_LABEL, EQUATION_MISSES_BY_MODE, equationHarnessChoices, equationMiss, latexToText, mergeCommutingSteps, stepsDoneFrom } from './equationWorkspaceDomain';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const op = (verb: string, k: string | number, label: string, category: 'arithmetic' | 'algebraic' = 'algebraic') =>
  ({ id: `${category}_${verb}${k === '' ? '' : `_${k}`}`, label, category });
const step = (o: { id: string; label: string }, resultLatex: string) => ({ operation: o.label, operationId: o.id, resultLatex });

const SUB15 = op('subtract', 15, 'Subtract 15 from both sides'), ADD15 = op('add', 15, 'Add 15 to both sides');
const DIV4 = op('divide', 4, 'Divide both sides by 4'), MUL4 = op('multiply', 4, 'Multiply both sides by 4');
const SUB47 = op('subtract', 47, 'Subtract 47 from both sides');
/** 4x + 15 = 47: subtract 15, then divide by 4. */
const twoStep = (type: EquationWorkspaceChallenge['type'], id = 'eq-1'): EquationWorkspaceChallenge => ({
  id, type, instruction: 'Find the number of hours.', equation: '4 \\cdot x + 15 = 47', targetVariable: 'x',
  solutionSteps: [step(SUB15, '4 \\cdot x = 32'), step(DIV4, 'x = 8')],
  availableOperations: [ADD15, DIV4, SUB47, SUB15, MUL4],
  ...(type === 'identify-operation' ? { correctOperationId: SUB15.id } : {}),
});
const DIST = op('distribute', 3, 'Distribute the 3'), COMBINE = op('combine', '', 'Combine like terms');
const ADD5 = op('add', 5, 'Add 5 to both sides'), SUB1 = op('subtract', 1, 'Subtract 1 from both sides');
const DIV3 = op('divide', 3, 'Divide both sides by 3'), SUB16 = op('subtract', 16, 'Subtract 16 from both sides');
/** 3(x + 2) - 5 = 16: distribute, combine, subtract 1, divide by 3. */
const fourStep = (id = 'eq-1'): EquationWorkspaceChallenge => ({
  id, type: 'multi-step', instruction: 'Solve for x.', equation: '3(x + 2) - 5 = 16', targetVariable: 'x',
  solutionSteps: [step(DIST, '3x + 6 - 5 = 16'), step(COMBINE, '3x + 1 = 16'), step(SUB1, '3x = 15'), step(DIV3, 'x = 5')],
  availableOperations: [ADD5, SUB16, DIV3, DIST, SUB1, COMBINE],
});
const lesson = (...challenges: EquationWorkspaceChallenge[]): EquationWorkspaceData => ({ title: 'Equations', challenges });

type Case = { mode: string; item: EquationWorkspaceChallenge; before: string[]; wrong: string; miss: string; rest: string[]; key: RegExp };
const CASES: Case[] = [
  { mode: 'guided-solve', item: twoStep('guided-solve'), before: [], wrong: ADD15.label, miss: 'not_inverse', rest: [SUB15.label, DIV4.label], key: /x = 8|\b32\b/ },
  { mode: 'identify-operation', item: twoStep('identify-operation'), before: [], wrong: DIV4.label, miss: 'later_step', rest: [SUB15.label, 'Check'], key: /x = 8|\b32\b|algebraic_subtract_15/ },
  { mode: 'solve', item: twoStep('solve'), before: [SUB15.label], wrong: MUL4.label, miss: 'not_inverse', rest: [DIV4.label], key: /x = 8/ },
  { mode: 'multi-step', item: fourStep(), before: [DIST.label], wrong: SUB16.label, miss: 'other_operation', rest: [COMBINE.label, SUB1.label, DIV3.label], key: /x = 5|3x = 15|\b15\b/ },
];

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('equation-workspace')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(EQUATION_MISSES_BY_MODE);
  for (const { mode, item } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'equation-workspace', pin: mode, objectiveIds: ['o'],
      data: lesson(item) as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: operations checked by the activity, no key published; a wrong one names its miss and Try again keeps the applied steps; the finishing step completes once',
  async ({ mode, item, before, wrong, miss, rest, key }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'equation-workspace', evalMode: mode, data: lesson(item) as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task)).not.toMatch(key);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/Next Challenge|Finish|Hint \(/);

    // Right steps that leave the variable attached commit nothing.
    for (const label of before) h.press(label);
    expect(h.state().task!.evidence.attemptNumber).toBe(0);
    const applied = h.state().task!.demand.stepsApplied;
    h.press(wrong);
    if (mode === 'identify-operation') h.press(/^check/i);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(key);
    // Input is closed until Try again.
    const labels = item.availableOperations.map(o => o.label);
    const open = Array.from(h.view.container.querySelectorAll<HTMLButtonElement>('button'))
      .filter(b => !b.disabled && (labels.includes(b.getAttribute('aria-label') ?? '') || /^check$/i.test((b.textContent ?? '').trim())));
    expect(open).toEqual([]);
    h.dispatch('retry');
    expect(h.state().task!.demand.stepsApplied).toBe(applied);
    expect(h.view.container.textContent).not.toMatch(/isn't the right step|Not quite/);

    for (const label of rest) h.press(label === 'Check' ? /^check/i : label);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'equation-workspace', evalMode: 'solve', data: lesson(twoStep('solve')) as unknown as Record<string, unknown> });
  h.press(SUB15.label); h.press(DIV4.label);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told the lines reached and the menu, never a line to come', () => {
  const h = mountWorkspace({ primitiveId: 'equation-workspace', evalMode: 'solve', data: lesson(twoStep('solve'), twoStep('solve', 'eq-2')) as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ equation: '4 × x + 15 = 47', solveFor: 'x', stepsApplied: 'none yet',
    currentEquation: '4 × x + 15 = 47', operations: expect.stringContaining('Subtract 47 from both sides') });
  h.press(SUB15.label);
  expect(h.state().task!.demand).toMatchObject({ stepsApplied: 'Subtract 15 from both sides', currentEquation: '4 × x = 32' });
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/x = 8/);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
});

it('equationMiss names the pattern the operation shows; the harness choices solve the item', () => {
  const c = twoStep('solve');
  expect(equationMiss(c, 0, SUB15.id)).toBeUndefined();
  expect(equationMiss(c, 0, ADD15.id)).toBe('not_inverse');
  expect(equationMiss(c, 0, DIV4.id)).toBe('later_step');
  expect(equationMiss(c, 0, SUB47.id)).toBe('wrong_number');
  expect(equationMiss(c, 0, MUL4.id)).toBe('other_operation');
  expect(equationMiss(c, 1, MUL4.id)).toBe('not_inverse');
  expect(equationMiss(c, 1, SUB15.id)).toBe('other_operation');
  expect(equationHarnessChoices(c, 0, 'correct')).toEqual([SUB15.label, DIV4.label]);
  expect(equationHarnessChoices(c, 1, 'correct')).toEqual([DIV4.label]);
  expect(equationMiss(c, 0, c.availableOperations.find(o => o.label === equationHarnessChoices(c, 0, 'wrong')[0])!.id)).toBe('not_inverse');
  expect(equationHarnessChoices(twoStep('identify-operation'), 0, 'correct')).toEqual([SUB15.label]);
  expect(stepsDoneFrom(c, latexToText('4 \\cdot x = 32'))).toBe(1);
  expect(stepsDoneFrom(c, latexToText(c.equation))).toBe(0);
});

it('the adapter refuses an item whose answer is not in its menu', () => {
  const validate = LIVE_ADAPTERS['equation-workspace'].validate;
  expect(validate(lesson(twoStep('solve')))).toBeTruthy();
  expect(() => validate(lesson({ ...twoStep('solve'), availableOperations: [ADD15, DIV4, MUL4] }))).toThrow();
  expect(() => validate(lesson({ ...twoStep('identify-operation'), correctOperationId: 'nope' }))).toThrow();
});

/** 2(3x + 4) - 2x + 7 = 39, with combining split into two steps in either order (as the generator emits them). */
const DIST2 = op('distribute', 2, 'Distribute the 2'), CX = op('combine', 'variable_terms', 'Combine the x terms');
const CC = op('combine', 'constants', 'Combine the constants'), SUB15b = op('subtract', 15, 'Subtract 15 from both sides');
const DIV4b = op('divide', 4, 'Divide both sides by 4'), ADD15b = op('add', 15, 'Add 15 to both sides');
const splitCombine = (xFirst: boolean): EquationWorkspaceChallenge => ({
  id: 'eq-c', type: 'multi-step', instruction: 'Solve for x.', equation: '2(3x + 4) - 2x + 7 = 39', targetVariable: 'x',
  solutionSteps: [step(DIST2, '6x + 8 - 2x + 7 = 39'),
    ...(xFirst ? [step(CX, '4x + 8 + 7 = 39'), step(CC, '4x + 15 = 39')] : [step(CC, '6x - 2x + 15 = 39'), step(CX, '4x + 15 = 39')]),
    step(SUB15b, '4x = 24'), step(DIV4b, 'x = 6')],
  availableOperations: [ADD15b, CC, DIV4b, DIST2, SUB15b, CX],
});

it('adjacent combine steps are one step, so either order the generator picked is credited the same way; a step out of order is still a miss', async () => {
  for (const xFirst of [true, false]) {
    const merged = mergeCommutingSteps(splitCombine(xFirst));
    expect(merged.solutionSteps.map(s => s.operation)).toEqual([DIST2.label, COMBINED_LABEL, SUB15b.label, DIV4b.label]);
    expect(merged.solutionSteps[1].resultLatex).toBe('4x + 15 = 39');
    expect(merged.availableOperations.filter(o => /^Combine/.test(o.label)).map(o => o.label)).toEqual([COMBINED_LABEL]);
    expect(mergeCommutingSteps(merged)).toBe(merged);

    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'equation-workspace', evalMode: 'multi-step', data: lesson(splitCombine(xFirst)) as unknown as Record<string, unknown> });
    h.press(DIST2.label);
    // Undoing before tidying is a wrong order: a miss.
    h.press(SUB15b.label);
    expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'later_step' });
    h.dispatch('retry');
    h.press(COMBINED_LABEL);
    expect(h.state().task!.demand.currentEquation).toBe('4x + 15 = 39');
    h.press(SUB15b.label); h.press(DIV4b.label);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    cleanup();
  }
  expect(mergeCommutingSteps(twoStep('solve'))).toEqual(twoStep('solve'));
});
