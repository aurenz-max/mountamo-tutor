// @vitest-environment jsdom
/**
 * life-cycle-sequencer levers mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit and draws no unmarked stage; the next attempt records the lever; a refused pull changes nothing; the practice
 * sequence is ungraded, shares no stage with the item, and the full item comes back and is credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { LifeCycleSequencerData } from './LifeCycleSequencer';
import { lifeCycleItem } from './lifeCycleSequencerWorkspace';
import { practiceCycle } from './lifeCycleSequencerLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const payload = (gradeBand: LifeCycleSequencerData['gradeBand'], cycleType: LifeCycleSequencerData['cycleType'],
  labels: string[], title: string): LifeCycleSequencerData => ({
  title, instructions: 'Put the pictures in order from start to finish.', cycleType, gradeBand, scaleContext: '',
  misconceptionTrap: { commonError: '', correction: '' },
  stages: labels.map((label, i) => ({ id: `s${i}`, label, imagePrompt: '', description: `A picture of ${label}.`,
    correctPosition: i, transitionToNext: '', duration: null })) });
const FROG = payload('3-5', 'linear', ['Frog Eggs', 'Tadpole', 'Froglet', 'Adult Frog'], 'Life of a frog');
const BUTTERFLY = payload('K-2', 'circular', ['Egg', 'Caterpillar', 'Chrysalis', 'Butterfly'], 'Life of a butterfly');

const mount = (data: LifeCycleSequencerData) => mountWorkspace({ primitiveId: 'life-cycle-sequencer', evalMode: 'sequence',
  instanceId: 'cycle', data: data as unknown as Record<string, unknown> });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const touch = (h: WorkspaceHarness, id: string) => act(() => {
  const el = h.view.container.querySelector(`[data-pip-object="${id}"]`);
  if (!el) throw new Error(`no ${id}`);
  fireEvent.click(el);
});
/** The journey's input: each stage's card (then its slot, past K-2) left to right; a kept card or slot is a no-op. */
const place = (h: WorkspaceHarness, band: string, ids: string[]) => {
  ids.forEach((id, i) => { touch(h, `card-${id}`); if (band !== 'K-2') touch(h, `slot-${i + 1}`); });
  h.press('Check Answer');
};
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;

it('a swap pulls keep_right in the same commit: the right stages lock, the rest go back; the next attempt records it', () => {
  const h = mount(FROG);
  expect(levers(h)).toEqual([['time_arrow', false], ['keep_right', false], ['fewer_stages', false]]);
  // Before any check there is nothing to lock: refused, and nothing changes.
  const before = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'keep_right' }).status).not.toBe('committed');
  expect(h.view.container.innerHTML).toBe(before);
  place(h, '3-5', ['s1', 's0', 's2', 's3']);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'adjacent_swap' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'adjacent_swap')).toBe('keep_right');
  const receipt = h.dispatch('pull_lever', { lever: 'keep_right' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="kept"]')).toHaveLength(2);
  const fact = String(receipt.state.task!.demand.onScreen);
  expect(fact).toMatch(/slot 3 "Froglet", slot 4 "Adult Frog"/);
  expect(fact).not.toMatch(/Tadpole|Frog Eggs/);
  expect(receipt.state.task!.demand.learnerWork).toBe('Placed: slot 1 empty, slot 2 empty, slot 3 "Froglet", slot 4 "Adult Frog"');
  // A repeat pull is refused and changes nothing.
  const html = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'keep_right' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(html);
  h.dispatch('retry');
  // Try again keeps the locked stages; a tap on one does not take it out.
  touch(h, 'card-s2');
  expect(q(h, '[data-lever="kept"]')).toHaveLength(2);
  place(h, '3-5', ['s0', 's1', 's2', 's3']);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'cycle', correct: true, levers: ['keep_right'] });
});

it('K-2 circle: reversed pulls the arrow with its way back, naming no stage; taps fill the slots around the locked ones', () => {
  const h = mount(BUTTERFLY);
  place(h, 'K-2', ['s3', 's2', 's1', 's0']);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'reversed' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'reversed')).toBe('time_arrow');
  expect(h.dispatch('pull_lever', { lever: 'time_arrow' }).status).toBe('committed');
  expect(q(h, '[data-lever="time-arrow"]')).toHaveLength(1);
  expect(q(h, '[data-lever="time-arrow-return"]')).toHaveLength(1);
  const fact = String(h.state().task!.demand.onScreen);
  expect(fact).toMatch(/slot 1 \(flagged: the start\) to slot 4 .* back to slot 1/);
  expect(BUTTERFLY.stages.some(s => fact.includes(s.label))).toBe(false);
  // Reversed has nothing marked right: keep_right is refused with a reason.
  expect(h.dispatch('pull_lever', { lever: 'keep_right' }).status).not.toBe('committed');
  h.dispatch('retry');
  expect(q(h, '[data-lever="time-arrow"]')).toHaveLength(1);
  place(h, 'K-2', ['s0', 's1', 's2', 's3']);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['time_arrow'] });
});

it('fewer stages: an ungraded practice sequence of the same shape with none of the item\'s stages; the full item comes back and is credited', () => {
  const h = mount(FROG);
  place(h, '3-5', ['s1', 's0', 's2', 's3']);
  const receipt = h.dispatch('pull_lever', { lever: 'fewer_stages' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('cycle~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'cycle' });
  expect(receipt.state.task!.demand).toMatchObject({ practice: expect.any(String) });
  expect(receipt.state.task!.workspace!.levers ?? []).toEqual([]);
  expect(q(h, '[data-practice]')).toHaveLength(1);
  const cards = q(h, '[data-pip-object^="card-"]').map(el => el.getAttribute('aria-label')!);
  expect(cards).toHaveLength(3);
  expect(cards.some(l => FROG.stages.some(s => s.label === l))).toBe(false);
  const p = practiceCycle(lifeCycleItem(FROG))!;
  place(h, '3-5', p.stages.map(s => s.id));
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('cycle');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No stage placed yet' });
  expect(q(h, '[data-practice]')).toHaveLength(0);
  place(h, '3-5', ['s0', 's1', 's2', 's3']);
  expect(attempts(h).map(x => [x.itemId, x.correct, !!(x as { practice?: boolean }).practice])).toEqual([
    ['cycle', false, false], ['cycle~simpler', true, true], ['cycle', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['fewer_stages'] });
});
