// @vitest-environment jsdom
/**
 * function-machine make_rule open build on the teaching workspace: a miss keeps the row, the first machine is kept,
 * a machine that works like the first is refused, and two different machines pass. An older payload with no pair
 * takes it from its rule.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { FunctionMachineChallenge, FunctionMachineChallengeType } from './FunctionMachine';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const item = (id: string, input: number, output: number, rule: string): FunctionMachineChallenge => ({
  id, rule, inputQueue: [input], showRule: false, makeInput: input, makeOutput: output,
});
const mount = (mode: FunctionMachineChallengeType, challenges: FunctionMachineChallenge[]) => mountWorkspace({
  primitiveId: 'function-machine', evalMode: mode,
  data: { title: 'Machines', description: 'Make machines', challengeType: mode, ruleComplexity: 'oneStep', challenges } as unknown as Record<string, unknown> });
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelector(sel);
const tap = (h: WorkspaceHarness, ...keys: string[]) => keys.forEach(k => h.press(`Add ${k}`));
const rowTiles = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('[data-make-row] button')).map(b => b.textContent);
const verdict = (h: WorkspaceHarness) => q(h, '[data-make-verdict]');

describe('function-machine make_rule open build', () => {
  it('one over -> miss keeps the row -> fix -> first machine kept -> same machine refused -> Start over -> a different machine passes', () => {
    const h = mount('make_rule', [item('m1', 4, 12, '3*x'), item('m2', 3, 15, '5*x'), item('m3', 20, 5, 'x/4')]);
    // Opens empty: the ask states the pair, the stored machine is never on screen, and nothing to check yet.
    expect(q(h, '[data-make-ask]')!.textContent).toBe('Make a machine that turns 4 into 12.');
    expect(h.view.container.textContent).not.toMatch(/3\s*\*?\s*x/);
    expect(rowTiles(h)).toEqual([]);
    expect((h.view.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);

    // One over: x + 9 gives 13.
    tap(h, 'x', '+', '9');
    expect(q(h, '[data-make-machine]')!.textContent).toBe('f(x) = x + 9');
    h.press("I'm done!");
    expect(verdict(h)!.getAttribute('data-make-verdict')).toBe('wrong_output');
    expect(verdict(h)!.textContent).toContain('Your machine turns 4 into 13, not 12.');
    expect(q(h, '[data-make-output]')!.textContent).toBe('13');
    h.dispatch('retry');
    expect(rowTiles(h)).toEqual(['x', '+', '9']); // Try again keeps the build

    // Fix it: take the 9 out, put 8 in.
    h.press('Take out 9');
    tap(h, '8');
    h.press("I'm done!");
    expect(verdict(h)!.getAttribute('data-make-verdict')).toBe('way');
    expect(q(h, '[data-made-machines]')!.textContent).toContain('Machine 1: f(x) = x + 8');
    expect(q(h, '[data-make-ask]')!.textContent).toBe('Now make a different machine that also turns 4 into 12.');
    expect(rowTiles(h)).toEqual([]);

    // The same machine written the other way round.
    tap(h, '8', '+', 'x');
    h.press("I'm done!");
    expect(verdict(h)!.getAttribute('data-make-verdict')).toBe('same_machine');
    h.dispatch('retry');
    expect(rowTiles(h)).toEqual(['8', '+', 'x']);
    h.press('Start over');
    expect(rowTiles(h)).toEqual([]);

    // A different machine: 3x.
    tap(h, '3', 'x');
    h.press("I'm done!");
    const compare = q(h, '[data-make-compare]')!;
    expect(compare.textContent).toContain('Both your machines turn 4 into 12. Feed them 5:');
    expect(compare.textContent).toContain('f(x) = x + 8 gives 13');
    expect(compare.textContent).toContain('f(x) = 3x gives 15');
    expect(h.state().task!.workspace!.attempts.map(a => [a.correct, a.miss])).toEqual([
      [false, 'wrong_output'], [false, 'same_machine'], [true, undefined]]);

    // Next item opens empty.
    h.dispatch('advance');
    expect(q(h, '[data-make-ask]')!.textContent).toBe('Make a machine that turns 3 into 15.');
    expect(rowTiles(h)).toEqual([]);
    expect(q(h, '[data-made-machines]')).toBeNull();
  });

  it('an older make_rule payload with no pair takes it from its rule; other modes render as before', () => {
    const h = mount('make_rule', [{ id: 'o1', rule: '2*x', inputQueue: [6], showRule: false }]);
    expect(q(h, '[data-make-ask]')!.textContent).toBe('Make a machine that turns 6 into 12.');
    h.close(); cleanup();
    const c = mount('create_rule', [{ id: 'c1', rule: '2*x + 1', inputQueue: [0, 1, 2], showRule: false }]);
    expect(c.view.getByText('Write the rule')).toBeTruthy();
    expect(c.view.queryByRole('button', { name: "I'm done!" })).toBeNull();
  });
});
