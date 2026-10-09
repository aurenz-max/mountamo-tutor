// @vitest-environment jsdom
/**
 * Timeline builder on the teaching workspace (W1, plain shape): what is its own. The bank never shows the time
 * order, the order never reaches the tutor, a wrong Check Order commits its named miss and Try again clears the
 * board, a right one completes once. The generic W1 contract runs in `runtime/workspaceContract.test.tsx`.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { TimelineBuilderChallenge } from './TimelineBuilder';
import { bankOrder, timelineMiss } from './timelineBuilderWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const events = (labels: string[]) => labels.map((label, i) => ({ id: `evt-${i}`, label, correctPosition: i }));
const challenge = (id: string, type: TimelineBuilderChallenge['type'], labels: string[], scale: [string, string]): TimelineBuilderChallenge =>
  ({ id, type, title: `${type} order`, instruction: `Put these in order from ${scale[0]} to ${scale[1]}.`,
    scaleStart: scale[0], scaleEnd: scale[1], events: events(labels), hint: 'Think about what happens first.', narration: '' });

const BY_MODE: Record<string, TimelineBuilderChallenge> = {
  'sequence-daily': challenge('d', 'daily', ['Wake Up', 'Eat Breakfast', 'Go to School', 'Eat Dinner'], ['Morning', 'Night']),
  'sequence-yearly': challenge('y', 'yearly', ['New Year', 'Spring Break', 'Summer Camp', 'Halloween'], ['January', 'December']),
  'place-historical': challenge('h', 'historical', ['Telephone', 'Airplane', 'Television', 'Smartphone'], ['1870', '2010']),
};

const mount = (mode: string, challenges: TimelineBuilderChallenge[]) => mountWorkspace({ primitiveId: 'timeline-builder',
  evalMode: mode, instanceId: 'timeline', data: { title: 'Timelines', gradeBand: '2-3', challenges } });

/** Tap each event, then its slot, left to right, then Check Order. */
const place = (h: WorkspaceHarness, labels: string[]) => {
  labels.forEach((label, i) => { h.press(label); h.press(`Slot ${i + 1}`); });
  h.press('Check Order');
};
const inOrder = (c: TimelineBuilderChallenge) => c.events.map(e => e.label);

it.each(Object.keys(BY_MODE))('%s binds with no scripted cue, a mixed-up bank and no order in the packet', mode => {
  const c = BY_MODE[mode];
  const h = mount(mode, [c]);
  const task = h.state().task!;
  expect(h.state().owner).toBe('tutor');
  expect(task.task).toBe(c.instruction);
  expect(task.workspace!.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(task.demand)).not.toMatch(/correctPosition|"slot 1 /i);
  // The bank never reads left to right as the answer.
  const bank = Array.from(h.view.container.querySelectorAll('button[aria-label]'))
    .map(b => b.getAttribute('aria-label')!).filter(l => inOrder(c).includes(l));
  expect(bank).toHaveLength(c.events.length);
  expect(bank).not.toEqual(inOrder(c));
  expect(String(task.demand.events).split('; ').map(e => e.replace(/ \(.*$/, ''))).toEqual(bank);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.container.textContent).not.toMatch(/Next Timeline|See Results/);
  h.close();
});

it('a wrong order commits its named miss and closes the board; Try again clears it; the right order completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const c = BY_MODE['sequence-daily'], next = BY_MODE['place-historical'];
  const h = mount('sequence-daily', [c, next]);
  const [a, b, ...rest] = inOrder(c);
  place(h, [b, a, ...rest]);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(JSON.stringify(h.state().task)).toContain('adjacent_swap');
  expect(h.state().task!.demand).toMatchObject({ checkedMarks: expect.stringMatching(/2 of 4 slots right .* 2 wrong/) });
  // Closed until Try again: a tap on the board changes nothing.
  h.press('Slot 1');
  expect(String(h.state().task!.demand.learnerWork)).toContain(`slot 1 "${b}"`);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No event placed yet' });
  expect(h.state().task!.demand.checkedMarks).toBeUndefined();
  place(h, inOrder(c));
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('h');
  place(h, inOrder(next));
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work, , evidence] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'timeline-builder', orderCorrect: true });
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'd', miss: 'adjacent_swap' })]);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  h.close();
});

it('timelineMiss names each order error', () => {
  const c = challenge('m', 'daily', ['A', 'B', 'C', 'D', 'E'], ['start', 'end']);
  const order = (...ids: number[]) => Object.fromEntries(ids.map((p, slot) => [slot, `evt-${p}`]));
  expect(timelineMiss(c, order(0, 1, 2, 3, 4))).toBeUndefined();
  expect(timelineMiss(c, order(4, 3, 2, 1, 0))).toBe('reversed');
  expect(timelineMiss(c, order(0, 2, 1, 3, 4))).toBe('adjacent_swap');
  expect(timelineMiss(c, order(3, 1, 2, 0, 4))).toBe('two_swapped');
  expect(timelineMiss(c, order(1, 2, 3, 0, 4))).toBe('one_moved');
  expect(timelineMiss(c, order(2, 0, 4, 1, 3))).toBe('mixed_order');
  expect(timelineMiss(c, { 0: 'evt-0' })).toBeUndefined();
  // Stable, and never the time order, even for a challenge whose shuffle lands on it.
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    const ch = { ...c, id };
    expect(bankOrder(ch).map(e => e.id)).toEqual(bankOrder(ch).map(e => e.id));
    expect(bankOrder(ch).map(e => e.correctPosition)).not.toEqual([0, 1, 2, 3, 4]);
    expect(bankOrder(ch).map(e => e.correctPosition)).not.toEqual([4, 3, 2, 1, 0]);
  }
});
