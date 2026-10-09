// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real MeasurementTools on the shared teaching workspace, mounted the way a lesson
 * mounts it. One item per shape (put it on the ruler, type the length, Check; convert then converts), plus compare's
 * ordering item. The activity's own check commits a checked gesture with its named miss; Try again clears the item
 * (a conversion keeps its checked measurement); the runtime owns progression; no width, converted length or order
 * reaches the tutor.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { MeasurementToolsChallenge, MeasurementToolsData } from './MeasurementTools';
import { EMPTY_VIEW, ORDER_ITEM_ID, lessonOf, measurementItems, measurementMiss } from './measurementToolsWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const shape = (id: string, label: string, widthInches: number): MeasurementToolsChallenge =>
  ({ id, label, widthInches, heightInches: 1, shapeType: 'rectangle', color: 'rgba(99,102,241,0.35)', hint: 'Start at 0.' });
const SHAPES = [shape('a', 'Red Rectangle', 7), shape('b', 'Blue Rectangle', 3), shape('c', 'Green Rectangle', 5)];

const session = (challengeType: MeasurementToolsData['challengeType'], challenges = SHAPES): MeasurementToolsData => ({
  title: 'Measure the Shapes', challengeType, challenges, rulerLengthInches: 12, unit: 'inches',
  precision: challengeType === 'estimate' ? 'half' : 'whole', gradeBand: '3-5', convertToUnit: 'centimeters',
});
const ESTIMATE = [shape('a', 'Red Rectangle', 6.5), shape('b', 'Blue Rectangle', 2.5)];
const DATA: Record<string, MeasurementToolsData> = {
  measure: session('measure'), compare: session('compare'), estimate: session('estimate', ESTIMATE), convert: session('convert'),
};

const mount = (mode: string, data = DATA[mode]) =>
  mountWorkspace({ primitiveId: 'measurement-tools', evalMode: mode, instanceId: 'ruler', data: { ...data } });
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const type = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  const input = Array.from(h.view.container.querySelectorAll('input')).find(i => i.getAttribute('aria-label') === label);
  if (!input) throw new Error(`no input ${label}`);
  fireEvent.change(input, { target: { value: text } });
});
const measure = (h: WorkspaceHarness, value: number) => {
  if (!String(demand(h).placed).startsWith('on the ruler')) h.press('Put it on the ruler');
  type(h, 'Length in inches', String(value)); h.press('Check Answer'); h.settle(1000);
};
const convert = (h: WorkspaceHarness, value: number) => { type(h, 'Length in centimeters', String(value)); h.press('Check Conversion'); h.settle(1000); };
/** The right answer for the open item, through the real controls. */
const answerRight = (h: WorkspaceHarness, data: MeasurementToolsData) => {
  const id = h.state().task!.itemId;
  if (id === ORDER_ITEM_ID) {
    [...data.challenges].sort((x, y) => x.widthInches - y.widthInches).forEach(c => h.press(c.label));
    h.press('Check Order'); h.settle(1000); return;
  }
  const c = data.challenges.find(x => x.id === id)!;
  if (demand(h).step !== 'convert') measure(h, c.widthInches);
  if (data.challengeType === 'convert') convert(h, Math.round(c.widthInches * 25.4) / 10);
};

it.each(Object.keys(DATA))('%s mounts under tutor ownership with no scripted cue and no published key, and completes', mode => {
  const data = DATA[mode];
  const h = mount(mode);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toContain(data.challenges[0].label);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  // No width before a try: the facts carry no digit but the ruler's 0.
  expect(JSON.stringify(demand(h)).replace(/edge at 0/g, '')).not.toMatch(/\d/);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.container.textContent).not.toMatch(/Next|Finish/);
  const items = measurementItems(data.challengeType, data.challenges);
  items.forEach((item, i) => {
    expect(h.state().task!.itemId).toBe(item.id);
    answerRight(h, data);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    if (i < items.length - 1) expect(h.state().status).toBe('active');
  });
  expect(h.state().status).toBe('completed');
  h.close();
});

it('measure: one over is one_over, the closed item refuses another check, and Try again clears the length with the shape kept on the ruler', () => {
  seam.evaluationContext = { lesson: 'test' };
  const data = session('measure', SHAPES.slice(0, 2));
  const h = mount('measure', data);
  h.press('Put it on the ruler');
  expect(demand(h)).toMatchObject({ placed: 'on the ruler, its left edge at 0', learnerWork: 'On the ruler; no length entered yet' });
  type(h, 'Length in inches', '8'); h.press('Check Answer');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_over', response: 'On the ruler; answered 8 inches' });
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(String(facts)).not.toMatch(/\b7\b/);
  // Closed until Try again: another typed answer does not check.
  type(h, 'Length in inches', '7'); h.press('Check Answer');
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ placed: 'on the ruler, its left edge at 0', learnerWork: 'On the ruler; no length entered yet' });
  measure(h, 7);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('b');
  measure(h, 3);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , , work, , evidence] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'a', miss: 'one_over' })]);
  h.close();
});

it('convert: a right measurement opens the conversion without committing; keeping the number is same_number; Try again keeps the measurement', () => {
  const h = mount('convert', session('convert', [SHAPES[1]]));
  measure(h, 3);
  expect(h.state().task!.workspace!.attempts ?? []).toHaveLength(0);
  expect(demand(h)).toMatchObject({ step: 'convert', conversion: 'the screen shows 1 inch = 2.54 centimeters' });
  expect(JSON.stringify(demand(h))).not.toMatch(/7\.6|7\.62/);
  convert(h, 3);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'same_number' });
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ step: 'convert', learnerWork: 'Measured 3 inches; no conversion entered yet' });
  convert(h, 1.2);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ miss: 'wrong_operation' });
  h.dispatch('retry');
  convert(h, 7.5);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('convert at the hard tier: neither the scene nor the wrong-answer card states the rule', () => {
  const h = mount('convert', { ...session('convert', [SHAPES[1]]), showConversionFactor: false });
  measure(h, 3);
  expect(String(demand(h).conversion)).not.toMatch(/2\.54/);
  convert(h, 3);
  expect(h.view.container.textContent).not.toMatch(/2\.54|multiply|divid/i);
  h.close();
});

it('compare: the ordering is the last item, listed never shortest first; longest first is longest_first', () => {
  const sorted = [shape('s1', 'Red Rectangle', 2), shape('s2', 'Blue Rectangle', 4), shape('s3', 'Green Rectangle', 6)];
  const data = session('compare', sorted);
  const h = mount('compare', data);
  for (let i = 0; i < 3; i++) { answerRight(h, data); h.dispatch('advance'); h.confirmVisible(); }
  expect(h.state().task!.itemId).toBe(ORDER_ITEM_ID);
  const listed = Array.from(h.view.container.querySelectorAll('button[aria-label$="Rectangle"]')).map(b => b.getAttribute('aria-label'));
  expect(listed).not.toEqual(['Red Rectangle', 'Blue Rectangle', 'Green Rectangle']);
  ['Green Rectangle', 'Blue Rectangle', 'Red Rectangle'].forEach(l => h.press(l));
  h.press('Check Order');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'longest_first' });
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ learnerWork: 'No shape tapped yet' });
  answerRight(h, data);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  h.close();
});

it('measurementMiss names each step\'s signature error', () => {
  const v = EMPTY_VIEW;
  const item = { id: 'a', kind: 'shape' as const, challenge: SHAPES[0] };
  const m = lessonOf(session('measure'));
  expect(measurementMiss(item, m, { ...v, measure: 6 })).toBe('one_short');
  expect(measurementMiss(item, m, { ...v, measure: 9 })).toBe('too_long');
  expect(measurementMiss(item, m, { ...v, measure: 4 })).toBe('too_short');
  expect(measurementMiss(item, m, { ...v, measure: 7.5 })).toBeUndefined();
  const est = lessonOf(session('estimate', ESTIMATE));
  const half = { id: 'a', kind: 'shape' as const, challenge: ESTIMATE[0] };
  expect(measurementMiss(half, est, { ...v, measure: 7 })).toBe('whole_not_half');
  expect(measurementMiss(half, est, { ...v, measure: 6 })).toBe('whole_not_half');
  expect(measurementMiss(half, est, { ...v, measure: 7.5 })).toBe('one_over');
  const conv = lessonOf(session('convert'));
  expect(measurementMiss(item, conv, { ...v, convertStep: true, converted: 7 })).toBe('same_number');
  expect(measurementMiss(item, conv, { ...v, convertStep: true, converted: 2.8 })).toBe('wrong_operation');
  expect(measurementMiss(item, conv, { ...v, convertStep: true, converted: 14 })).toBe('too_small');
  expect(measurementMiss(item, conv, { ...v, convertStep: true, converted: 25 })).toBe('too_large');
  expect(measurementMiss(item, conv, { ...v, convertStep: true, converted: 18 })).toBeUndefined();
  const cmp = lessonOf(session('compare'));
  const order = { id: ORDER_ITEM_ID, kind: 'order' as const };
  expect(measurementMiss(order, cmp, { ...v, order: ['a', 'c', 'b'] })).toBe('longest_first');
  expect(measurementMiss(order, cmp, { ...v, order: ['c', 'b', 'a'] })).toBe('two_swapped');
  expect(measurementMiss(order, cmp, { ...v, order: ['c', 'a', 'b'] })).toBe('out_of_order');
  expect(measurementMiss(order, cmp, { ...v, order: ['b', 'c', 'a'] })).toBeUndefined();
});
