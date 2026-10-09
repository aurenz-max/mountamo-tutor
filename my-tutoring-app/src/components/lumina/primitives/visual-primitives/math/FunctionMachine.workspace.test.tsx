// @vitest-environment jsdom
/**
 * Function machine on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { FunctionMachineChallenge, FunctionMachineChallengeType, FunctionMachineData } from './FunctionMachine';
import { evaluateRule, rulesEquivalent } from './functionMachineDomain';
import { guessMiss, predictMiss, ruleTiles } from './functionMachineWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  const input = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, label).toBeTruthy();
  fireEvent.change(input!, { target: { value: text } });
});
const tiles = (h: WorkspaceHarness, rule: string) => ruleTiles(rule).forEach(t => h.press(`Add ${t}`));
const learnerWork = (h: WorkspaceHarness) => String(h.state().task!.demand.learnerWork);

const ch = (id: string, rule: string, inputQueue: number[], extra: Partial<FunctionMachineChallenge> = {}): FunctionMachineChallenge =>
  ({ id, rule, inputQueue, showRule: false, ...extra });
const data = (challengeType: FunctionMachineChallengeType, challenges: FunctionMachineChallenge[]): FunctionMachineData =>
  ({ title: 'Machines', description: '', challengeType, challenges });
const mount = (mode: FunctionMachineChallengeType, challenges: FunctionMachineChallenge[]) =>
  mountWorkspace({ primitiveId: 'function-machine', evalMode: mode, data: data(mode, challenges) as unknown as Record<string, unknown> });

type Case = { mode: FunctionMachineChallengeType; item: FunctionMachineChallenge; wrong?: (h: WorkspaceHarness) => void; miss?: string;
  right: (h: WorkspaceHarness) => void; secret: RegExp; cleared?: RegExp };
const CASES: Case[] = [
  { mode: 'observe', item: ch('o', 'x + 2', [1, 2, 3, 4], { showRule: true }), secret: /\b5\b|\b6\b/,
    right: h => { [1, 2, 3].forEach(x => h.press(`Feed ${x}`)); h.press('Continue →'); } },
  { mode: 'predict', item: ch('p', '4*x', [2, 3], { showRule: true }), secret: /\b8\b|\b12\b/, miss: 'added_not_multiplied',
    wrong: h => { write(h, 'My prediction', '6'); h.press('Feed 2'); },
    right: h => { write(h, 'My prediction', '8'); h.press('Feed 2'); write(h, 'My prediction', '12'); h.press('Feed 3'); },
    cleared: /No prediction typed yet/ },
  { mode: 'discover_rule', item: ch('d', '2*x + 1', [0, 1, 2, 3]), secret: /2\s*\*\s*x\s*\+\s*1/, miss: 'fits_some_pairs',
    wrong: h => { h.press('Feed 0'); h.press('Feed 1'); write(h, 'Your rule', 'x + 1'); h.press('Check'); },
    right: h => { write(h, 'Your rule', '1 + 2x'); h.press('Check'); }, cleared: /No rule typed yet/ },
  { mode: 'create_rule', item: ch('c', '3*x', [0, 1, 2, 5]), secret: /3\s*\*\s*x/, miss: 'added_not_multiplied',
    wrong: h => { write(h, 'Your rule', 'x + 3'); h.press('Check'); },
    right: h => { write(h, 'Your rule', '3x'); h.press('Check'); }, cleared: /No rule typed yet/ },
  { mode: 'make_rule', item: ch('m', '3*x', [4], { makeInput: 4, makeOutput: 12 }), secret: /3\s*\*?\s*x|x\s*\+\s*8/, miss: 'wrong_output',
    wrong: h => { tiles(h, 'x+9'); h.press("I'm done!"); },
    right: h => { h.press('Start over'); tiles(h, '3*x'); h.press("I'm done!"); tiles(h, 'x+8'); h.press("I'm done!"); },
    cleared: /Building f\(x\) = x \+ 9/ },
];

it('every catalog mode has a case; observe alone has no miss list', () => {
  const entry = getComponentById('function-machine')!;
  expect((entry.evalModes ?? []).map(m => m.evalMode).sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(Object.keys(entry.teachingWorkspace!.misses!).sort()).toEqual(CASES.filter(c => c.miss).map(c => c.mode).sort());
  for (const c of CASES) if (c.miss) expect(entry.teachingWorkspace!.misses![c.mode], c.mode).toContain(c.miss);
});

it.each(CASES)('$mode: checked by the activity, no key published; a miss names itself and Try again reopens; the right answer completes once',
  async ({ mode, item, wrong, miss, right, secret, cleared }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(mode, [item]);
    const task = h.state().task!;
    expect(h.state().owner).toBe('tutor');
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    // The hidden rule is never in the ask; observe and predict show it on the machine, so their ask states it.
    if (mode === 'observe' || mode === 'predict') expect(task.task).toContain(item.rule);
    else expect(task.task).not.toContain(item.rule);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    if (wrong) {
      wrong(h);
      expect(h.state().task!.evidence.correctness).toBe('incorrect');
      expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
      expect(JSON.stringify(h.state().task!.demand)).not.toMatch(secret);
      if (mode === 'predict') expect(h.view.container.textContent).not.toMatch(/\b8\b/);
      h.dispatch('retry');
      expect(h.state().task!.phase).toBe('working');
      expect(learnerWork(h)).toMatch(cleared!);
    }
    right(h);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('predict: a wrong prediction keeps the input and hides its output; earlier right ones stay on screen; Next is the shell\'s', () => {
  const h = mount('predict', [ch('p', 'x + 5', [1, 2, 3], { showRule: true }), ch('q', '2*x', [1, 2], { showRule: true })]);
  write(h, 'My prediction', '6'); h.press('Feed 1');
  expect(h.state().task!.phase).toBe('working');
  write(h, 'My prediction', '10'); h.press('Feed 2');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'multiplied_not_added' });
  expect(h.state().task!.demand).toMatchObject({ pairsOnScreen: '1 → 6', inputsToFeed: '2, 3' });
  // Closed until Try again.
  expect(h.view.container.querySelector<HTMLInputElement>('input[aria-label="My prediction"]')!.disabled).toBe(true);
  h.dispatch('retry');
  write(h, 'My prediction', '7'); h.press('Feed 2');
  write(h, 'My prediction', '8'); h.press('Feed 3');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.view.container.textContent).not.toMatch(/Next Function/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('q');
  expect(h.state().task!.demand).toMatchObject({ pairsOnScreen: 'none yet', inputsToFeed: '1, 2', learnerWork: 'No prediction typed yet' });
});

it('make_rule: the first machine is progress, not a commit; a same machine is a named miss; the row stays through Try again', () => {
  const h = mount('make_rule', [ch('m', '3*x', [4], { makeInput: 4, makeOutput: 12 })]);
  expect(h.state().task!.task).toBe('Make a machine that turns 4 into 12. Then make a different machine that also turns 4 into 12.');
  tiles(h, 'x+8'); h.press("I'm done!");
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(h.state().task!.demand).toMatchObject({ machinesAccepted: 'f(x) = x + 8', learnerWork: 'The machine row is empty' });
  tiles(h, '8+x'); h.press("I'm done!");
  expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe('same_machine');
  h.dispatch('retry');
  expect(learnerWork(h)).toBe('Building f(x) = 8 + x');
});

it('the live host (no evaluation provider) never submits', async () => {
  const h = mount('create_rule', [ch('c', 'x + 7', [0, 1, 2])]);
  write(h, 'Your rule', 'x+7'); h.press('Check');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the rule box suggests no rule', () => {
  mount('create_rule', [ch('c', 'x + 3', [0, 1, 2])]);
  expect(document.querySelector('input[aria-label="Your rule"]')!.getAttribute('placeholder')).not.toMatch(/\d/);
});

it('a typed rule may write multiplication by position', () => {
  expect(evaluateRule('1 + 2x', 3)).toBe(7);
  expect(evaluateRule('3(x + 1)', 2)).toBe(9);
  expect(evaluateRule('x × 4 − 1', 2)).toBe(7);
  expect(rulesEquivalent('1 + 2x', '2*x + 1')).toBe(true);
  expect(evaluateRule('x +', 2)).toBeNull();
});

it('predictMiss and guessMiss name each signature error', () => {
  expect(predictMiss('4*x', 3, '3')).toBe('gave_input');
  expect(predictMiss('4*x', 3, '7')).toBe('added_not_multiplied');
  expect(predictMiss('x/2', 8, '6')).toBe('added_not_multiplied');
  expect(predictMiss('x + 3', 4, '12')).toBe('multiplied_not_added');
  expect(predictMiss('2*x + 1', 4, '8')).toBe('one_step_only');
  expect(predictMiss('2*x + 1', 4, '10')).toBe('wrong_order');
  expect(predictMiss('2*x + 1', 4, '20')).toBe('too_high');
  expect(predictMiss('2*x + 1', 4, '9')).toBeUndefined();
  const pairs = [0, 1, 2].map(input => ({ input, output: 2 * input + 1 }));
  expect(guessMiss('x +', '2*x + 1', pairs)).toBe('not_a_rule');
  expect(guessMiss('x + 1', '2*x + 1', pairs)).toBe('fits_some_pairs');
  expect(guessMiss('x + 5', '2*x + 1', pairs)).toBe('one_step_only');
  expect(guessMiss('2*(x + 1)', '2*x + 1', pairs)).toBe('wrong_order');
  expect(guessMiss('x + 3', '3*x', [{ input: 0, output: 0 }, { input: 2, output: 6 }])).toBe('added_not_multiplied');
  expect(guessMiss('3x', 'x + 3', [{ input: 0, output: 3 }, { input: 2, output: 5 }])).toBe('multiplied_not_added');
  expect(guessMiss('x*x', '2*x + 1', pairs)).toBe('wrong_rule');
  expect(guessMiss('2x+1', '2*x + 1', pairs)).toBeUndefined();
});
