// @vitest-environment jsdom
/**
 * double-number-line levers on the teaching workspace: a pull changes the screen and the scene fact in the same
 * commit, the next attempt records it, a refused pull changes nothing, and the easier item is ungraded practice with
 * the full item back after it.
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
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { DoubleNumberLineChallenge, DoubleNumberLineData } from './DoubleNumberLine';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const type = (h: WorkspaceHarness, top: number, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector(`input[aria-label="Cookies when Cups is ${top}"]`)!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const scales = { topScale: { min: 0, max: 8, interval: 1 }, bottomScale: { min: 0, max: 24, interval: 3 } };
const ORIGIN = { topValue: 0, bottomValue: 0, label: 'Start' };
const missing: DoubleNumberLineChallenge = { id: 'm1', challengeType: 'find_missing', ...scales,
  prompt: 'Given 2 Cups = 6 Cookies, find Cookies when Cups = 7.', hint: '',
  givenPoints: [ORIGIN, { topValue: 2, bottomValue: 6, label: 'Given' }], targetPoints: [{ topValue: 7, bottomValue: 21, label: 'Find for 7' }] };
const rate: DoubleNumberLineChallenge = { id: 'u1', challengeType: 'unit_rate', ...scales,
  prompt: 'Given 4 Cups = 12 Cookies, find the unit rate: when Cups = 1, what is Cookies?', hint: '',
  givenPoints: [ORIGIN, { topValue: 4, bottomValue: 12, label: 'Given' }], targetPoints: [{ topValue: 1, bottomValue: 3, label: 'Unit Rate' }] };
// The hard tier's starting position: no guides, end labels only, no given badges.
const line = (c: DoubleNumberLineChallenge): DoubleNumberLineData => ({ title: 'Baking', description: '', topLabel: 'Cups',
  bottomLabel: 'Cookies', unitRate: 3, contextQuestion: '', challenges: [c], showVerticalGuides: false, showUnitRate: false,
  showTickLabels: 'none', showGivenValues: false });
const mount = (mode: string, c: DoubleNumberLineChallenge) => {
  const h = mountWorkspace({ primitiveId: 'double-number-line', evalMode: mode, data: line(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('find_missing: the given pair is cut into parts in the same commit, with no digit; the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount('find_missing', missing);
  expect(levers(h)).toEqual([['split_given', false], ['unit_jumps', false], ['grow_model', false], ['smaller_ask', false]]);
  type(h, 7, '11'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'added_difference' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'added_difference')).toBe('split_given');
  const receipt = h.dispatch('pull_lever', { lever: 'split_given' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/cut into equal parts on both lines/);
  // One band and one mark (two parts) on each line.
  expect(q(h, '[data-lever="split-given"]')).toHaveLength(4);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'split_given' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  type(h, 7, '21'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'm1', correct: true, levers: ['split_given'] });
});

it('every help lever draws without a digit or the item\'s answer', () => {
  const h = mount('find_missing', missing);
  type(h, 7, '10'); check(h);
  for (const id of ['split_given', 'unit_jumps', 'grow_model']) expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  // Seven jumps on each line.
  expect(q(h, '[data-lever="unit-jumps"]')).toHaveLength(14);
  for (const el of q(h, '[data-lever]:not([data-lever="grow-model"])')) expect(el.textContent).toBe('');
  expect(q(h, '[data-lever="grow-model"]')[0].textContent).not.toMatch(/\d/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  expect(h.view.container.textContent).not.toMatch(/\b21\b/);
});

it('unit_rate find-the-rate item: no jumps (one step is the answer) and no easier item; a pull of either is refused with nothing changed', () => {
  const h = mount('unit_rate', rate);
  expect(levers(h)).toEqual([['split_given', false], ['grow_model', false]]);
  type(h, 1, '12'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'gave_given' });
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'unit_jumps' }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: 'smaller_ask' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  expect(h.dispatch('pull_lever', { lever: 'split_given' }).status).toBe('committed');
  // Four parts: one band and three marks on each line, none labelled.
  expect(q(h, '[data-lever="split-given"]')).toHaveLength(8);
  h.dispatch('retry');
  type(h, 1, '3'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['split_given'] });
});

it('the easier item is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount('find_missing', missing);
  type(h, 7, '11'); check(h);
  const r = h.dispatch('pull_lever', { lever: 'smaller_ask' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('m1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'm1' });
  expect(r.state.task!.demand).toMatchObject({ ask: 'Practice first: given 2 Cups = 6 Cookies, find Cookies when Cups = 4.',
    learnerWork: 'nothing typed yet for Cookies at Cups = 4' });
  expect(JSON.stringify(r.state.task!.demand)).not.toMatch(/\b21\b|\b12\b/);
  type(h, 4, '12'); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('m1');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'nothing typed yet for Cookies at Cups = 7' });
  type(h, 7, '21'); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['m1', false, false], ['m1~simpler', true, true], ['m1', true, false]]);
});
