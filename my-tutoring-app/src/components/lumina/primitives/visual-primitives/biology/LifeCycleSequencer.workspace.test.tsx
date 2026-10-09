// @vitest-environment jsdom
/**
 * Life cycle sequencer on the teaching workspace (W1, plain shape): what is its own. The payload is one sequence, so
 * the session has one item; the bank never shows the order, the order never reaches the tutor, the Hint and the
 * misconception card are off, a wrong Check Answer commits its named miss and Try again clears the board, a right one
 * completes once. The generic W1 contract runs in `runtime/workspaceContract.test.tsx`.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { LifeCycleSequencerData } from './LifeCycleSequencer';
import { bankOrder, cycleMiss, lifeCycleItem } from './lifeCycleSequencerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const stages = (labels: string[]) => labels.map((label, i) => ({ id: `s${i}`, label, imagePrompt: `PROMPT ${label}`,
  description: `What happens at ${label}.`, correctPosition: i, transitionToNext: `NEXT-AFTER-${label}`, duration: null }));
const payload = (gradeBand: LifeCycleSequencerData['gradeBand'], cycleType: LifeCycleSequencerData['cycleType'],
  labels: string[]): LifeCycleSequencerData => ({
  title: 'A life cycle', instructions: 'Put the pictures in order from start to finish.', cycleType, gradeBand,
  scaleContext: 'about a month', stages: stages(labels),
  misconceptionTrap: { commonError: 'COMMON-ERROR', correction: 'CORRECTION-STATES-ORDER' } });

/** Every catalog mode on hand-built items: the K-2 tap-to-place band and a select-then-slot band. */
const MODES = (getComponentById('life-cycle-sequencer')?.evalModes ?? []).map(m => m.evalMode);
const BANDS: Array<[LifeCycleSequencerData['gradeBand'], LifeCycleSequencerData['cycleType']]> = [['K-2', 'linear'], ['3-5', 'circular']];
const CASES = MODES.flatMap(mode => BANDS.map(([band, cycle]) => [mode, band, cycle] as const));
const LABELS = ['Seed', 'Sprout', 'Bud', 'Flower', 'Fruit'];

const mount = (mode: string, data: LifeCycleSequencerData) =>
  mountWorkspace({ primitiveId: 'life-cycle-sequencer', evalMode: mode, instanceId: 'cycle',
    data: data as unknown as Record<string, unknown> });
const touch = (h: WorkspaceHarness, id: string) => act(() => {
  const el = h.view.container.querySelector(`[data-pip-object="${id}"]`);
  if (!el) throw new Error(`no ${id}`);
  fireEvent.click(el);
});
/** Place each stage (by label) left to right through the band's own controls, then Check Answer. */
const place = (h: WorkspaceHarness, data: LifeCycleSequencerData, labels: string[]) => {
  labels.forEach((label, i) => {
    touch(h, `card-${data.stages.find(s => s.label === label)!.id}`);
    if (data.gradeBand !== 'K-2') touch(h, `slot-${i + 1}`);
  });
  h.press('Check Answer');
};

it('the catalog declares one mode, sequence', () => { expect(MODES).toEqual(['sequence']); });

it.each(CASES)('%s %s %s binds with no scripted cue, a mixed-up bank and no order in the packet', (mode, band, cycle) => {
  const data = payload(band, cycle, LABELS);
  const h = mount(mode, data);
  const task = h.state().task!;
  expect(h.state().owner).toBe('tutor');
  expect(task.itemId).toBe('cycle');
  expect(task.task).toBe(data.instructions);
  expect(task.workspace!.expectedAnswer).toBeUndefined();
  const packet = JSON.stringify(task);
  expect(packet).not.toMatch(/correctPosition|NEXT-AFTER|CORRECTION-STATES-ORDER|PROMPT /);
  // The bank never reads as the answer, and the scene lists it in the bank's order.
  const bank = Array.from(h.view.container.querySelectorAll('[data-pip-object^="card-"]')).map(el => el.getAttribute('aria-label'));
  expect(bank).toHaveLength(LABELS.length);
  expect(bank).not.toEqual(LABELS);
  expect(String(task.demand.stages).replace(/ \(.*$/, '').split('; ')).toEqual(bank);
  // No Hint (it selects the first stage), no read-aloud, no scripted Try Again, no tutorial.
  const text = h.view.container.textContent ?? '';
  expect(text).not.toMatch(/Hint|How to Play|Try Again/);
  expect(h.view.container.querySelector('[aria-label="Read the instructions to me"]')).toBeNull();
  expect(seam.legacyAI).not.toHaveBeenCalled();
  h.close();
});

it('a wrong order commits its named miss and closes the board; Try again clears it; the right order completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const data = payload('3-5', 'linear', LABELS);
  const h = mount('sequence', data);
  const [a, b, ...rest] = LABELS;
  place(h, data, [b, a, ...rest]);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(JSON.stringify(h.state().task)).toContain('adjacent_swap');
  expect(h.state().task!.demand).toMatchObject({ checkedMarks: expect.stringMatching(/3 of 5 slots right .* 2 wrong/) });
  // The misconception card's correction can state the order: never shown with the tutor.
  expect(h.view.container.textContent).not.toContain('CORRECTION-STATES-ORDER');
  // Closed until Try again: a tap on a placed card changes nothing.
  touch(h, 'card-s1');
  expect(String(h.state().task!.demand.learnerWork)).toContain('slot 1 "Sprout"');
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No stage placed yet' });
  expect(h.state().task!.demand.checkedMarks).toBeUndefined();
  place(h, data, LABELS);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work, , evidence] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'life-cycle-sequencer', allStagesCorrect: true, totalStages: 5 });
  expect(work.teachingAttempts).toHaveLength(2);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'cycle', miss: 'adjacent_swap' })]);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  h.close();
});

it('K-2: one tap places a picture in the next slot; the live host has no evaluation provider and submits nothing', () => {
  const data = payload('K-2', 'circular', ['Egg', 'Caterpillar', 'Chrysalis', 'Butterfly']);
  const h = mount('sequence', data);
  place(h, data, ['Chrysalis', 'Butterfly', 'Egg', 'Caterpillar']);
  expect(JSON.stringify(h.state().task)).toContain('cycle_rotated');
  h.dispatch('retry');
  place(h, data, ['Egg', 'Caterpillar', 'Chrysalis', 'Butterfly']);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
  h.close();
});

it('cycleMiss names each order error; the bank is stable and never in order', () => {
  const lin = lifeCycleItem(payload('3-5', 'linear', ['A', 'B', 'C', 'D', 'E']));
  const circ = lifeCycleItem(payload('3-5', 'circular', ['A', 'B', 'C', 'D', 'E']));
  const order = (...ps: number[]) => ps.map(p => `s${p}`);
  expect(cycleMiss(lin, order(0, 1, 2, 3, 4))).toBeUndefined();
  expect(cycleMiss(lin, order(4, 3, 2, 1, 0))).toBe('reversed');
  expect(cycleMiss(lin, order(0, 2, 1, 3, 4))).toBe('adjacent_swap');
  expect(cycleMiss(lin, order(3, 1, 2, 0, 4))).toBe('two_swapped');
  expect(cycleMiss(lin, order(1, 2, 3, 0, 4))).toBe('one_moved');
  expect(cycleMiss(lin, order(2, 0, 4, 1, 3))).toBe('mixed_order');
  expect(cycleMiss(circ, order(2, 3, 4, 0, 1))).toBe('cycle_rotated');
  expect(cycleMiss(lin, order(2, 3, 4, 0, 1))).toBe('mixed_order');
  expect(cycleMiss(lin, [null, 's1', null, null, null])).toBeUndefined();
  for (const title of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    const item = { ...lin, stages: stages([`${title}1`, `${title}2`, `${title}3`, `${title}4`]) };
    const positions = bankOrder(item).map(s => s.correctPosition);
    expect(bankOrder(item).map(s => s.id)).toEqual(bankOrder(item).map(s => s.id));
    expect(positions).not.toEqual([0, 1, 2, 3]);
    expect(positions).not.toEqual([3, 2, 1, 0]);
  }
});
