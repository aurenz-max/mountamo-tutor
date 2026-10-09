// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real MeasureLab on the shared teaching workspace, mounted the way a lesson
 * mounts it. The activity runs the test and its own check commits a checked gesture with its named miss; Try again
 * clears the bench; the runtime owns progression; no weight, capacity, count or order reaches the tutor before the
 * test shows it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { MeasureLabChallenge } from './MeasureLab';
import { EMPTY_VIEW, measureMiss } from './measureLabWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const jar = (id: string, name: string, filled: number) => ({ id, name, shape: 'round' as const, capacity: 8, filled });
const CHALLENGES: Record<string, MeasureLabChallenge> = {
  balance_predict: { id: 'b', type: 'balance_predict', prompt: 'Which is heavier — the book or the feather?',
    left: { id: 'l', name: 'book', emoji: '📖', weight: 8 }, right: { id: 'r', name: 'feather', emoji: '🪶', weight: 2 }, expectedChoice: 'l' },
  capacity_predict: { id: 'c', type: 'capacity_predict', prompt: 'Which holds more — the vase or the bowl?', unitName: 'cups',
    containerA: { id: 'a', name: 'vase', shape: 'tall', capacity: 3 }, containerB: { id: 'w', name: 'bowl', shape: 'wide', capacity: 7 }, expectedChoice: 'w' },
  pour_count: { id: 'p', type: 'pour_count', prompt: 'Fill the pot with cups. How many does it take?', unitName: 'cups',
    container: { id: 'pot', name: 'pot', shape: 'round', capacity: 5 }, expectedCount: 5, options: [4, 5, 6, 7] },
  order_capacity: { id: 'o', type: 'order_capacity', prompt: 'Put the jars in order. Start with the one that has the least.',
    containers: [jar('j1', 'jar 1', 7), jar('j2', 'jar 2', 1), jar('j3', 'jar 3', 4)], expectedOrder: ['j2', 'j3', 'j1'] },
};
/** The right taps for each item, through the real controls. */
const RIGHT: Record<string, string[]> = {
  balance_predict: ['book', 'Put book on', 'Put feather on'],
  capacity_predict: ['bowl', 'Pour cups into both'],
  pour_count: [...Array(5).fill('Pour one in'), '5'],
  order_capacity: ['jar 2', 'jar 3', 'jar 1'],
};

const mount = (mode: string, challenges: MeasureLabChallenge[]) =>
  mountWorkspace({ primitiveId: 'measure-lab', evalMode: mode, instanceId: 'measure',
    data: { title: 'Measuring', description: 'Test it', challengeType: mode, challenges } });
const tap = (h: WorkspaceHarness, labels: string[]) => { for (const label of labels) h.press(label); h.settle(1000); };
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;

it.each(Object.keys(CHALLENGES))('%s mounts under tutor ownership with no scripted cue and no published key', mode => {
  const c = CHALLENGES[mode];
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(c.prompt);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  // No weight, capacity, fill level, count or winner before the test: no number but the jars' own names.
  const facts = JSON.stringify(demand(h)).replace(/jar \d|\d identical/g, 'jar');
  expect(facts).not.toMatch(/\d|went down|one took/);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.container.textContent).not.toMatch(/Next|Finish/);
  // Right first time: checked by the activity, credited, then the runtime advances and the lesson completes.
  tap(h, RIGHT[mode]);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  h.close();
});

it('balance: a lighter guess commits picked_lighter after the beam tips, stays closed, and Try again clears the bench', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('balance_predict', [CHALLENGES.balance_predict, { ...CHALLENGES.balance_predict, id: 'b2' }]);
  h.press('feather'); h.press('Put book on');
  expect(h.state().task!.workspace!.attempts ?? []).toHaveLength(0);
  h.press('Put feather on');
  // The verdict waits for the beam to settle.
  expect(h.state().task!.evidence.correctness).not.toBe('incorrect');
  h.settle(1000);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'picked_lighter' });
  expect(demand(h)).toMatchObject({ scale: 'both on; the left pan went down', learnerWork: 'Guessed the feather is heavier; put both on the scale' });
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).not.toContain('book');

  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ scale: 'empty and level', learnerWork: 'No guess yet' });
  tap(h, RIGHT.balance_predict);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('b2');
  expect(demand(h)).toMatchObject({ learnerWork: 'No guess yet' });
  tap(h, RIGHT.balance_predict);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , , work, , evidence] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'b', phase: 'balance_predict', miss: 'picked_lighter' })]);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  h.close();
});

it('capacity: guessing the tall one that holds less is tall_means_more; the cups each took are a fact only after the pour', () => {
  const h = mount('capacity_predict', [CHALLENGES.capacity_predict]);
  h.press('vase');
  expect(demand(h).afterPouring).toBeUndefined();
  h.press('Pour cups into both'); h.settle(1000);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'tall_means_more' });
  expect(demand(h).afterPouring).toBe('the left one took 3 cups, the right one took 7 cups');
  h.dispatch('retry');
  expect(demand(h).afterPouring).toBeUndefined();
  expect(demand(h)).toMatchObject({ learnerWork: 'No guess yet' });
  h.close();
});

it('pour_count: one cup short is one_short; the closed bench refuses another number until Try again empties it', () => {
  const h = mount('pour_count', [CHALLENGES.pour_count]);
  for (let i = 0; i < 5; i++) h.press('Pour one in');
  expect(demand(h)).toMatchObject({ level: 'full', learnerWork: 'Filled it' });
  h.press('4');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_short' });
  h.press('5');
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ level: 'empty', learnerWork: 'Nothing poured yet' });
  expect(h.view.container.textContent).not.toMatch(/How many did it take/);
  h.close();
});

it('order_capacity: most to least is most_to_least; Try again clears the taps', () => {
  const h = mount('order_capacity', [CHALLENGES.order_capacity]);
  tap(h, ['jar 1', 'jar 3', 'jar 2']);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'most_to_least' });
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ learnerWork: 'No jar tapped yet' });
  h.close();
});

it('measureMiss names each type\'s signature error', () => {
  const v = EMPTY_VIEW;
  expect(measureMiss(CHALLENGES.balance_predict, { ...v, prediction: 'r' })).toBe('picked_lighter');
  expect(measureMiss(CHALLENGES.balance_predict, { ...v, prediction: 'l' })).toBeUndefined();
  expect(measureMiss(CHALLENGES.capacity_predict, { ...v, prediction: 'a' })).toBe('tall_means_more');
  const wideLess = { ...CHALLENGES.capacity_predict, expectedChoice: 'a', containerA: { ...CHALLENGES.capacity_predict.containerA!, capacity: 9 } };
  expect(measureMiss(wideLess, { ...v, prediction: 'w' })).toBe('picked_less');
  expect(measureMiss(CHALLENGES.pour_count, { ...v, chosenCount: 6 })).toBe('one_over');
  expect(measureMiss(CHALLENGES.pour_count, { ...v, chosenCount: 7 })).toBe('too_many');
  expect(measureMiss(CHALLENGES.pour_count, { ...v, chosenCount: 3 })).toBe('too_few');
  expect(measureMiss(CHALLENGES.order_capacity, { ...v, order: ['j3', 'j2', 'j1'] })).toBe('two_swapped');
  expect(measureMiss(CHALLENGES.order_capacity, { ...v, order: ['j3', 'j1', 'j2'] })).toBe('out_of_order');
  expect(measureMiss(CHALLENGES.order_capacity, { ...v, order: ['j2', 'j3', 'j1'] })).toBeUndefined();
});
