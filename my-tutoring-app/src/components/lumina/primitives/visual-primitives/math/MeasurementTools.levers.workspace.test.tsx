// @vitest-environment jsdom
/**
 * measurement-tools levers, mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit and writes no number; the next attempt records the lever; a refused pull changes nothing; an easier item is
 * ungraded practice of the same mode, and the full item comes back blank and is credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { MeasurementToolsChallenge, MeasurementToolsData } from './MeasurementTools';
import { ORDER_ITEM_ID } from './measurementToolsWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const shape = (id: string, label: string, widthInches: number): MeasurementToolsChallenge =>
  ({ id, label, widthInches, heightInches: 1, shapeType: 'rectangle', color: 'rgba(99,102,241,0.35)', hint: 'Start at 0.' });
const session = (challengeType: MeasurementToolsData['challengeType'], challenges: MeasurementToolsChallenge[]): MeasurementToolsData => ({
  title: 'Measure the Shapes', challengeType, challenges, rulerLengthInches: 12, unit: 'inches',
  precision: challengeType === 'estimate' ? 'half' : 'whole', gradeBand: '3-5', convertToUnit: 'centimeters',
});
const mount = (mode: MeasurementToolsData['challengeType'], challenges: MeasurementToolsChallenge[]) =>
  mountWorkspace({ primitiveId: 'measurement-tools', evalMode: mode, instanceId: 'ruler', data: { ...session(mode, challenges) } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const type = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  const input = Array.from(h.view.container.querySelectorAll('input')).find(i => i.getAttribute('aria-label') === label)!;
  fireEvent.change(input, { target: { value: text } });
});
const measure = (h: WorkspaceHarness, value: number) => {
  if (!String(demand(h).placed).startsWith('on the ruler')) h.press('Put it on the ruler');
  type(h, 'Length in inches', String(value)); h.press('Check Answer'); h.settle(1000);
};
const convert = (h: WorkspaceHarness, value: number) => { type(h, 'Length in centimeters', String(value)); h.press('Check Conversion'); h.settle(1000); };

it('measure: the shaded spaces show in the same commit and write no number; a repeat pull changes nothing; the next attempt records it', () => {
  const h = mount('measure', [shape('a', 'Red Rectangle', 6)]);
  expect(levers(h)).toEqual([['space_shading', false], ['edge_line', false], ['shorter_shape', false]]);
  measure(h, 7);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'one_over' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'one_over')).toBe('space_shading');
  const text = h.view.container.textContent;
  const receipt = h.dispatch('pull_lever', { lever: 'space_shading' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/tinted along the whole ruler/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d/);
  // Every other space of the whole twelve-inch ruler, not the shape's six: six tinted spaces, and no new text.
  expect(q(h, '[data-lever="space-shade"]')).toHaveLength(6);
  expect(h.view.container.textContent).toBe(text);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length, html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'space_shading' }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length, html: h.view.container.innerHTML }).toEqual(before);
  h.dispatch('retry');
  expect(q(h, '[data-lever="space-shade"]')).toHaveLength(6);
  measure(h, 6);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'a', correct: true, levers: ['space_shading'] });
  h.close();
});

it('measure: the edge line is refused until the shape is on the ruler, then drops from its right edge', () => {
  const h = mount('measure', [shape('a', 'Red Rectangle', 6)]);
  const html = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'edge_line' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(html);
  h.press('Put it on the ruler');
  expect(h.dispatch('pull_lever', { lever: 'edge_line' }).status).toBe('committed');
  const line = q(h, '[data-lever="edge-line"]');
  expect(line).toHaveLength(1);
  expect(demand(h).onScreen).toMatch(/dashed line drops from the shape's right edge/);
  h.close();
});

it('estimate: half marks are drawn taller, with no label added', () => {
  const h = mount('estimate', [shape('a', 'Red Rectangle', 6.5)]);
  measure(h, 7);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'whole_not_half' });
  const text = h.view.container.textContent;
  expect(h.dispatch('pull_lever', { lever: 'half_marks' }).status).toBe('committed');
  expect(q(h, '[data-lever="half-mark"]')).toHaveLength(12);
  expect(h.view.container.textContent).toBe(text);
  h.close();
});

it('measure: the shorter shape is ungraded practice; the full item comes back blank and is credited after it', () => {
  const h = mount('measure', [shape('a', 'Red Rectangle', 6)]);
  measure(h, 7);
  const receipt = h.dispatch('pull_lever', { lever: 'shorter_shape' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('a~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'a' });
  expect(h.view.container.textContent).toMatch(/Practice shape/);
  expect(h.view.container.textContent).not.toMatch(/Red Rectangle/);
  expect(demand(h)).toMatchObject({ placed: 'not on the ruler yet', practice: expect.stringMatching(/ungraded/) });
  measure(h, 3);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('a');
  expect(demand(h)).toMatchObject({ placed: 'not on the ruler yet', learnerWork: 'Not on the ruler yet' });
  expect(h.view.container.textContent).not.toMatch(/Practice/);
  measure(h, 6);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['a', false, false], ['a~simpler', true, true], ['a', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['shorter_shape'] });
  h.close();
});

it('convert: the inch model shows on the conversion step only, with no digit; the smaller length is practice', () => {
  const h = mount('convert', [shape('a', 'Red Rectangle', 4)]);
  expect(levers(h).map(([id]) => id)).toEqual(['space_shading', 'edge_line', 'smaller_length']);
  measure(h, 4);
  expect(levers(h).map(([id]) => id)).toEqual(['inch_model', 'smaller_length']);
  convert(h, 4);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'same_number' });
  expect(h.dispatch('pull_lever', { lever: 'inch_model' }).status).toBe('committed');
  const model = q(h, '[data-lever="inch-model"]');
  expect(model).toHaveLength(1);
  expect(model[0].textContent).not.toMatch(/\d/);
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ step: 'convert' });
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_length' });
  expect(receipt.state.task!.itemId).toBe('a~simpler');
  expect(demand(h)).toMatchObject({ step: 'measure', kind: 'convert' });
  measure(h, 1);
  convert(h, 2.5);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('a');
  expect(demand(h)).toMatchObject({ step: 'measure' });
  measure(h, 4); convert(h, 10);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'a', correct: true });
  h.close();
});

it('compare: the ordering\'s levers show the measured lengths and the growing bars; three shapes is practice', () => {
  const shapes = [shape('a', 'Red Rectangle', 5), shape('b', 'Blue Rectangle', 4), shape('c', 'Green Rectangle', 6)];
  const h = mount('compare', shapes);
  for (const c of shapes) { measure(h, c.widthInches); h.dispatch('advance'); h.confirmVisible(); }
  expect(h.state().task!.itemId).toBe(ORDER_ITEM_ID);
  expect(levers(h)).toEqual([['order_steps', false], ['own_lengths', false], ['three_shapes', false]]);
  ['Red Rectangle', 'Blue Rectangle', 'Green Rectangle'].forEach(l => h.press(l));
  h.press('Check Order');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'two_swapped' });
  expect(h.dispatch('pull_lever', { lever: 'own_lengths' }).status).toBe('committed');
  expect(q(h, '[data-lever="own-length"]').map(e => e.textContent)).toEqual(['5 inches', '4 inches', '6 inches']);
  expect(h.dispatch('pull_lever', { lever: 'order_steps' }).status).toBe('committed');
  expect(q(h, '[data-lever="order-steps"]')).toHaveLength(1);
  expect(String(demand(h).onScreen)).not.toMatch(/\d/);
  const receipt = h.dispatch('pull_lever', { lever: 'three_shapes' });
  expect(receipt.state.task!.itemId).toBe(`${ORDER_ITEM_ID}~simpler`);
  expect(h.view.container.textContent).not.toMatch(/Red Rectangle|Blue Rectangle|Green Rectangle/);
  const listed = q(h, 'button[aria-label$="Rectangle"]').map(b => b.getAttribute('aria-label'));
  expect(listed).toEqual(['Pink Rectangle', 'Orange Rectangle', 'Gray Rectangle']);
  ['Gray Rectangle', 'Pink Rectangle', 'Orange Rectangle'].forEach(l => h.press(l));
  h.press('Check Order');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe(ORDER_ITEM_ID);
  ['Blue Rectangle', 'Red Rectangle', 'Green Rectangle'].forEach(l => h.press(l));
  h.press('Check Order');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: ORDER_ITEM_ID, correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  h.close();
});
