// @vitest-environment jsdom
/**
 * number-line plot / identify / order / between levers (`numberLineLevers.ts`), mounted the way a lesson mounts it.
 * A help pull changes the line and the scene fact in one commit and draws no answer; the next attempt records the
 * lever; a refused pull changes nothing; a simplify pull opens an ungraded practice item, then the full item comes
 * back blank and only its answer is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { NumberLineChallenge } from './NumberLine';

beforeEach(() => {
  installRuntimeTimers();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const plot = (id: string, t: number): NumberLineChallenge => ({ id, type: 'plot_point', instruction: `Place a point at ${t} on the number line.`, hint: 'Count.', targetValues: [t] });
const order = (id: string, vals: number[]): NumberLineChallenge => ({ id, type: 'order_values', instruction: `Put ${vals.join(', ')} in order.`, hint: 'Look.', targetValues: vals });
const between = (id: string, lo: number, hi: number, exact?: number): NumberLineChallenge => ({ id, type: 'find_between',
  instruction: `Find a number between ${lo} and ${hi}.`, hint: 'Look.', targetValues: [lo, hi], ...(exact !== undefined ? { exactTargetValue: exact } : {}) });
const lesson = (challenges: NumberLineChallenge[], max = 10, supportTier?: 'easy') => ({ title: 'Line', range: { min: 0, max }, gradeBand: 'K-2',
  numberType: 'integer', interactionMode: 'plot', challenges, ...(supportTier ? { supportTier } : {}) });
const mount = (mode: string, challenges: NumberLineChallenge[], max = 10, tier?: 'easy') =>
  mountWorkspace({ primitiveId: 'number-line', evalMode: mode, data: lesson(challenges, max, tier) as never, instanceId: 'line' });

const tap = (h: WorkspaceHarness, value: number) => {
  const svg = h.view.container.querySelector('svg[viewBox="0 0 760 240"]')!;
  const view = h.controls()!.getState();
  act(() => { fireEvent.click(svg, { clientX: 60 + ((value - view.visibleMin) / (view.visibleMax - view.visibleMin)) * 640 }); });
};
const check = (h: WorkspaceHarness) => h.press(/check/i);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const labels = (h: WorkspaceHarness, kind: string) => Array.from(h.view.container.querySelectorAll(`[data-lever="${kind}"] text`)).map(t => t.textContent);
const PLOTS = () => [plot('p0', 6), plot('p1', 2), plot('p2', 9), plot('p3', 0), plot('p4', 8)];

it('plot: a target is not the centre of the line; every item of the session shows the same window', () => {
  const h = mount('plot', PLOTS());
  const first = h.controls()!.getState();
  expect([first.visibleMin, first.visibleMax]).toEqual([0, 10]);
  h.close();
});

it('plot: a wrong point, then count hops: the screen and the scene change in one commit, and the next try records the lever', () => {
  const h = mount('plot', PLOTS());
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['count_hops', 'help', false], ['nearer_number', 'simplify', false]]);
  tap(h, 5); check(h);
  expect(last(h)).toMatchObject({ itemId: 'p0', correct: false, miss: 'one_short' });
  expect(observerLever(h.state(), true)).toBe('count_hops');
  const receipt = h.dispatch('pull_lever', { lever: 'count_hops' });
  expect(receipt.status).toBe('committed');
  expect(labels(h, 'count-hops')).toEqual(['1', '2', '3', '4', '5']);
  expect(receipt.state.task!.demand.onScreen).toMatch(/Numbered hops counted from 0/);
  expect(receipt.state.task!.demand.learnerWork).toBe('Placed a point at 5 (hops drawn from 0: 5)');
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\b6\b/);

  // Refused: pulled already. Nothing on screen, in the levers or in the attempts changes.
  const before = { levers: JSON.stringify(levers(h)), attempts: h.state().task!.workspace!.attempts.length, hops: labels(h, 'count-hops') };
  expect(h.dispatch('pull_lever', { lever: 'count_hops' }).status).toBe('blocked');
  expect({ levers: JSON.stringify(levers(h)), attempts: h.state().task!.workspace!.attempts.length, hops: labels(h, 'count-hops') }).toEqual(before);

  h.dispatch('retry');
  // A blank line: only hop 1 from 0, which stops short of the target.
  expect(labels(h, 'count-hops')).toEqual([]);
  expect(labels(h, 'count-model-hop')).toEqual(['1']);
  tap(h, 6); check(h);
  expect(last(h)).toMatchObject({ itemId: 'p0', correct: true, assisted: true, levers: ['count_hops'] });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('p1');
  expect(levers(h).every(l => !l.pulled)).toBe(true);
  h.close();
});

it('plot: the easier point is ungraded, then the full item comes back blank and alone is credited', () => {
  const h = mount('plot', PLOTS());
  const receipt = h.dispatch('pull_lever', { lever: 'nearer_number' });
  expect(receipt.state.task).toMatchObject({ itemId: 'p0~simpler', task: 'Place a point at 3 on the number line.' });
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'p0' });
  expect(levers(h)).toEqual([]);
  tap(h, 4); check(h);
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('p0~simpler');
  tap(h, 3); check(h);
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'p0', task: 'Place a point at 6 on the number line.' });
  expect(h.state().task!.demand.learnerWork).toBe('Placed a point at none yet');
  tap(h, 6); check(h);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['p0~simpler', false, true], ['p0~simpler', true, true], ['p0', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['nearer_number'] });
  h.close();
});

it('identify: a target one from where counting starts has no lever until the learner places a point away from it', () => {
  const h = mount('identify', [plot('i0', 1), plot('i1', 9), plot('i2', 4)]);
  expect(h.offer('pull_lever')).toBeUndefined();
  tap(h, 3); check(h);
  expect(last(h)).toMatchObject({ miss: 'off_by_more' });
  expect(levers(h).map(l => l.id)).toEqual(['count_hops']);
  h.dispatch('pull_lever', { lever: 'count_hops' });
  expect(labels(h, 'count-hops')).toEqual(['1', '2', '3']);
  h.close();
});

it('identify: a target at the first label (0) has no count start; after a wrong point the last-try ring answers it (J12 plot_point-3)', () => {
  const h = mount('identify', [plot('i0', 0), plot('i1', 9)]);
  expect(h.offer('pull_lever')).toBeUndefined();
  tap(h, 1); check(h);
  expect(last(h)).toMatchObject({ itemId: 'i0', correct: false, miss: 'one_past' });
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['last_try', 'help', false]]);
  expect(observerLever(h.state(), true)).toBe('last_try');
  h.dispatch('retry');
  const ring = () => h.view.container.querySelector('[data-lever="last-try"]');
  expect(ring()).toBeNull();
  // Refused: a lever this item does not declare. The line, the levers and the attempts are unchanged.
  const before = { levers: JSON.stringify(levers(h)), attempts: h.state().task!.workspace!.attempts.length, svg: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'count_hops' }).status).toBe('blocked');
  expect({ levers: JSON.stringify(levers(h)), attempts: h.state().task!.workspace!.attempts.length, svg: h.view.container.innerHTML }).toEqual(before);
  const receipt = h.dispatch('pull_lever', { lever: 'last_try' });
  expect(receipt.status).toBe('committed');
  // The ring is on the learner's own try, kept after Try again; the target is not marked.
  expect(ring()?.getAttribute('data-value')).toBe('1');
  expect(receipt.state.task!.demand.onScreen).toBe("A dashed ring marks 1, where the learner's last checked point was.");


  tap(h, 0); check(h);
  expect(last(h)).toMatchObject({ itemId: 'i0', correct: true, assisted: true, levers: ['last_try'] });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('i1');
  expect(ring()).toBeNull();
  expect(levers(h).map(l => l.id)).not.toContain('last_try');
  h.close();
});

it('order: reversed, then the arrow (no number marked); then the two-number practice set, ungraded', () => {
  const h = mount('order', [order('o0', [8, 5, 7]), order('o1', [3, 6, 4])]);
  for (const [v, at] of [[8, 5], [5, 8], [7, 7]]) { h.press(String(v)); tap(h, at); }
  check(h);
  expect(last(h)).toMatchObject({ itemId: 'o0', correct: false, miss: 'reversed' });
  const receipt = h.dispatch('pull_lever', { lever: 'bigger_arrow' });
  expect(labels(h, 'bigger-arrow')).toEqual(['smaller', 'bigger']);
  expect(receipt.state.task!.demand.onScreen).toMatch(/arrow under the line points right/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d/);
  const simpler = h.dispatch('pull_lever', { lever: 'fewer_numbers' });
  expect(simpler.state.task!.itemId).toBe('o0~simpler');
  const practice = (simpler.state.task!.task.match(/\d+/g) ?? []).map(Number);
  expect(practice).toHaveLength(2);
  for (const v of practice) expect([8, 5, 7]).not.toContain(v);
  expect(practice[0]).toBeGreaterThan(practice[1]);
  // The arrow stays on the practice set; it is the item's help, not the practice's.
  expect(labels(h, 'bigger-arrow')).toEqual(['smaller', 'bigger']);
  for (const v of [...practice].sort((a, b) => a - b)) { h.press(String(v)); tap(h, v); }
  check(h);
  expect(last(h)).toMatchObject({ itemId: 'o0~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('o0');
  expect(h.state().task!.demand.learnerWork).toBe('Placed in order, left to right: none yet');
  for (const v of [5, 7, 8]) { h.press(String(v)); tap(h, v); }
  check(h);
  expect(last(h)).toMatchObject({ itemId: 'o0', correct: true, assisted: true, levers: ['bigger_arrow', 'fewer_numbers'] });
  h.close();
});

it('between: on an end, then rings on the two given numbers (none between them), then a wider practice pair', () => {
  const h = mount('between', [between('b0', 3, 6), between('b1', 1, 4), between('b2', 2, 5)]);
  tap(h, 3); check(h);
  expect(last(h)).toMatchObject({ itemId: 'b0', correct: false, miss: 'on_end' });
  const receipt = h.dispatch('pull_lever', { lever: 'end_marks' });
  expect(labels(h, 'end-marks')).toEqual(['3', '6']);
  expect(receipt.state.task!.demand.onScreen).toBe('Rings mark 3 and 6 on the line, each with its number above it.');
  const simpler = h.dispatch('pull_lever', { lever: 'wider_gap' });
  expect(simpler.state.task).toMatchObject({ itemId: 'b0~simpler', task: 'Find a number between 2 and 7. Place a point there.' });
  // The item's help stays on through the practice pair, as the jump's hops do.
  expect(labels(h, 'end-marks')).toEqual(['2', '7']);
  tap(h, 5); check(h);
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('b0');
  expect(labels(h, 'end-marks')).toEqual(['3', '6']);
  tap(h, 4); check(h);
  expect(last(h)).toMatchObject({ itemId: 'b0', correct: true, assisted: true, levers: ['end_marks', 'wider_gap'] });
  h.close();
});

it('exact between (a missing number): count hops only; no rings, which would leave the answer alone between them', () => {
  const h = mount('between', [between('e0', 102, 104, 103), between('e1', 96, 98, 97), between('e2', 108, 110, 109)], 120);
  expect(levers(h).map(l => l.id)).toEqual(['count_hops']);
  tap(h, 104); check(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'on_end' });
  const receipt = h.dispatch('pull_lever', { lever: 'count_hops' });
  expect(receipt.state.task!.demand.onScreen).toMatch(/counted from 100/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\b103\b/);
  h.close();
});

it('easy starts with the help shown, and that is not a pull', () => {
  const h = mount('plot', PLOTS(), 10, 'easy');
  expect(levers(h).find(l => l.id === 'count_hops')!.pulled).toBe(true);
  expect(labels(h, 'count-model-hop')).toEqual(['1']);
  tap(h, 6); check(h);
  expect(last(h)!.levers).toBeUndefined();
  h.close();
});
