// @vitest-environment jsdom
/**
 * Addition fact strategies on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { AdditionFactStrategiesData, AdditionFactStrategy } from './AdditionFactStrategies';
import { additionFactHarnessInputs, additionFactMiss } from './additionFactStrategiesWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const session = (strategy: AdditionFactStrategy, facts: Array<[number, number]>, introExample?: { a: number; b: number }):
  AdditionFactStrategiesData & Record<string, unknown> => ({
  title: 'Facts', description: 'Practise', challengeType: 'recall', strategy, objectEmoji: '🍎',
  ...(introExample ? { introExample } : {}),
  challenges: facts.map(([a, b], i) => ({ id: `afs-${i + 1}`, type: strategy, a, b, sum: a + b,
    ...(strategy === 'turnaround' ? { knownFact: { a: b, b: a } } : {}) })),
});

/** One hand-built session per catalog mode, from the mode's first strategy. */
const FACTS: Record<string, Array<[number, number]>> = {
  plus_zero: [[6, 0]], plus_one: [[1, 7]], doubles: [[6, 6]], turnaround: [[3, 8]], plus_two: [[5, 2]],
  facts_3_4: [[4, 7]],
};
const MODES = (getComponentById('addition-fact-strategies')?.evalModes ?? [])
  .map(m => [m.evalMode, m.challengeTypes![0] as AdditionFactStrategy] as const);

function perform(h: ReturnType<typeof mountWorkspace>, data: AdditionFactStrategiesData, wrong: boolean) {
  const c = data.challenges.find(x => x.id === h.state().task!.itemId)!;
  for (const input of additionFactHarnessInputs(c, wrong)) h.press(input.label);
}

it('every catalog mode binds', () => {
  expect(MODES.length).toBe(6);
  for (const [mode, strategy] of MODES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'addition-fact-strategies', pin: mode, objectiveIds: ['o'],
      data: session(strategy, FACTS[strategy]) }), mode).not.toBeNull();
  }
});

it.each(MODES)('%s: a checked tap that publishes no key; a wrong tap draws nothing on its own, Try again reopens the pad, the right one completes once',
  async (mode, strategy) => {
    const data = session(strategy, FACTS[strategy]);
    const [[a, b]] = FACTS[strategy];
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'addition-fact-strategies', evalMode: mode, data });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(task.demand).toMatchObject({ problem: `${a} + ${b} = ?` });
    const published = JSON.stringify(task);
    expect(published).not.toMatch(/"sum"|knownFact/);
    expect(published).not.toContain(`= ${a + b}`);

    perform(h, data, true);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe('one_over');
    // The pad is closed until Try again, and the miss never shows the answer.
    expect((h.view.container.querySelector('button[aria-label="Answer 0"]') as HTMLButtonElement).disabled).toBe(true);
    expect(h.view.container.textContent).not.toContain(`${a} + ${b} = ${a + b}`);
    // Help comes from a lever (the tutor's, or the observer's after a second miss), never from the miss itself.
    expect(h.view.container.querySelector('[data-lever]')).toBeNull();
    expect(h.state().task!.demand).not.toHaveProperty('onScreen');

    h.dispatch('retry');
    expect((h.view.container.querySelector('button[aria-label="Answer 0"]') as HTMLButtonElement).disabled).toBe(false);

    perform(h, data, false);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it('the worked example sits beside the first fact only, and its total never reaches the tutor', () => {
  const data = session('doubles', [[6, 6], [3, 3]], { a: 4, b: 4 });
  const h = mountWorkspace({ primitiveId: 'addition-fact-strategies', evalMode: 'doubles', data });
  expect(h.view.container.textContent).toContain('4 + 4 = 8');
  expect(h.state().task!.demand).toMatchObject({ example: expect.stringContaining('4 + 4') });
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b8\b/);
  perform(h, data, false);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('afs-2');
  expect(h.view.container.textContent).not.toContain('4 + 4 = 8');
  expect(h.state().task!.demand).not.toHaveProperty('example');
});

it('nothing advances on a clock after a right answer', () => {
  const data = session('plus_one', [[1, 7], [4, 1]]);
  const h = mountWorkspace({ primitiveId: 'addition-fact-strategies', evalMode: 'plus_one', data });
  perform(h, data, false);
  h.settle(30000);
  expect(h.state().task!.itemId).toBe('afs-1');
});

it.each([
  [5, 'addend'], [2, 'addend'], [6, 'one_short'], [8, 'one_over'], [3, 'short_by_more'], [12, 'over_by_more'], [7, undefined],
] as const)('a tap of %s on 5 + 2 is a %s miss', (value, miss) => {
  expect(additionFactMiss({ id: 'x', type: 'plus_two', a: 5, b: 2, sum: 7 }, value)).toBe(miss);
});

it('the adapter refuses a fact the pad cannot answer', () => {
  expect(() => LIVE_ADAPTERS['addition-fact-strategies'].validate({ ...session('doubles', [[6, 6]]),
    challenges: [{ id: 'x', type: 'doubles', a: 6, b: 6, sum: 13 }] })).toThrow();
  expect(() => LIVE_ADAPTERS['addition-fact-strategies'].validate({ ...session('doubles', [[6, 6]]),
    challenges: [{ id: 'x', type: 'doubles', a: 12, b: 1, sum: 13 }] })).toThrow();
});
