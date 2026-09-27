// @vitest-environment jsdom
/**
 * Equation builder on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { EquationBuilderChallenge } from './EquationBuilder';
import { buildMatches, equationBuilderHarnessInputs } from './equationBuilderWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const build: EquationBuilderChallenge = { id: 'b1', type: 'build', instruction: 'Build an addition equation that equals 5.',
  targetEquation: '3 + 2 = 5', availableTiles: ['2', '+', '3', '=', '5', '4', '-'] };
const missingResult: EquationBuilderChallenge = { id: 'm1', type: 'missing-value', instruction: 'What number makes it true?',
  equation: '4 + 3 = ?', missingPosition: 4, correctValue: 7, options: [6, 7, 8] };
const missingOperand: EquationBuilderChallenge = { id: 'm2', type: 'missing-value', instruction: 'What number is missing?',
  equation: '4 + ? = 7', missingPosition: 2, correctValue: 3, options: [2, 3, 4] };
const truth: EquationBuilderChallenge = { id: 't1', type: 'true-false', instruction: 'Is this equation true or false?',
  displayEquation: '3 + 2 = 6', isTrue: false };
const balance: EquationBuilderChallenge = { id: 'bal', type: 'balance', instruction: 'Make both sides equal.',
  leftSide: '3 + 4', rightSide: '? + 2', correctAnswer: 5 };
const rewrite: EquationBuilderChallenge = { id: 'r1', type: 'rewrite', instruction: 'Write this equation another way.',
  originalEquation: '3 + 2 = 5', acceptedForms: ['2 + 3 = 5', '5 = 3 + 2'], availableTiles: ['3', '+', '2', '=', '5', '4'] };
const BY_MODE: Record<string, EquationBuilderChallenge> = {
  'build-simple': build, 'missing-result': missingResult, 'true-false': truth, 'missing-operand': missingOperand,
  'balance-both-sides': balance, rewrite,
};
const builder = (challenges: EquationBuilderChallenge[]) => ({ title: 'Equations', challenges, maxNumber: 10, gradeBand: '1' });

type Mounted = ReturnType<typeof mountWorkspace>;
/** The journey's own inputs, performed through the builder's controls. */
function perform(h: Mounted, c: EquationBuilderChallenge, wrong: boolean) {
  for (const input of equationBuilderHarnessInputs(c, wrong)) {
    if (input.type === 'choose') h.press(input.label);
    else if (input.type === 'touch') h.touch(input.target);
    else act(() => { fireEvent.change(h.view.container.querySelector(`input[aria-label="${input.label}"]`)!, { target: { value: input.text } }); });
  }
}
const slotCount = (h: Mounted) => h.view.container.querySelectorAll('[data-pip-object^="slot-"]').length;

it('every catalog mode binds', () => {
  const modes = (getComponentById('equation-builder')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(Object.keys(BY_MODE).sort());
  for (const mode of modes) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'equation-builder', pin: mode, objectiveIds: ['o'],
      data: builder([BY_MODE[mode]]) }), mode).not.toBeNull();
  }
});

it.each(Object.entries(BY_MODE))('%s: a checked gesture that publishes no key; a wrong Check reopens clean on Try again, the right one completes once',
  async (mode, c) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: mode, data: builder([c]) });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    const published = JSON.stringify(task);
    for (const key of ['targetEquation', 'correctValue', 'isTrue', 'correctAnswer', 'acceptedForms']) expect(published).not.toContain(key);
    if (c.type === 'build') expect(published).not.toMatch(/3 \+ 2 = 5/);
    if (c.type === 'rewrite') expect(published).not.toMatch(/2 \+ 3 = 5|5 = 3 \+ 2/);

    perform(h, c, true);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    // Input is closed until Try again: no second Check on the same miss.
    const check = () => Array.from(h.view.container.querySelectorAll('button')).find(b => b.textContent === 'Check')!;
    expect(check().disabled).toBe(true);
    h.dispatch('retry');
    // Try again clears the rejected work.
    expect(slotCount(h)).toBe(0);
    // Check stays closed until new work: the tiles, choice or number are gone.
    expect(check().disabled).toBe(true);

    perform(h, c, false);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it('a build is the target in any order that keeps it true and equal to the same amount', () => {
  expect(buildMatches(['3', '+', '2', '=', '5'], '3 + 2 = 5')).toBe(true);
  expect(buildMatches(['2', '+', '3', '=', '5'], '3 + 2 = 5')).toBe(true);
  expect(buildMatches(['5', '=', '2', '+', '3'], '3 + 2 = 5')).toBe(true);
  expect(buildMatches(['5', '-', '3', '=', '2'], '5 - 2 = 3')).toBe(false);
  expect(buildMatches(['4', '+', '1', '=', '5'], '3 + 2 = 5')).toBe(false);
  expect(buildMatches(['3', '+', '2', '='], '3 + 2 = 5')).toBe(false);
});

it('the tutor is told what is drawn: the printed equation, the tiles and the choices', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'missing-operand', data: builder([missingOperand]) });
  expect(h.state().task!.demand).toMatchObject({ equation: '4 + ? = 7', choices: '2 | 3 | 4' });
  cleanup();
  const b = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'balance-both-sides', data: builder([balance]) });
  expect(b.state().task!.demand).toMatchObject({ equation: '3 + 4 = ? + 2' });
});

it('a missed build does not show the target', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'build-simple', data: builder([build]) });
  for (const t of ['5', '-', '3', '=', '2']) h.press(`Tile ${t}`);
  h.press('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.view.container.textContent).not.toMatch(/3 \+ 2 = 5/);
});

it('the adapter refuses a challenge its controls cannot answer', () => {
  expect(() => LIVE_ADAPTERS['equation-builder'].validate(builder([{ ...missingOperand, options: [2, 4] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['equation-builder'].validate(builder([{ ...build, availableTiles: ['3', '+', '=', '5'] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['equation-builder'].validate(builder([{ ...rewrite, availableTiles: ['3', '+', '2', '='] }]))).toThrow();
  expect(LIVE_ADAPTERS['equation-builder'].validate(builder([truth]))).toBeTruthy();
});
