// @vitest-environment jsdom
/**
 * ratio-table levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit, the
 * next attempt records it, a refused pull changes nothing, and the easier problem is ungraded practice with the full
 * item back after it.
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
import type { RatioTableChallenge, RatioTableData } from './RatioTable';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const type = (h: WorkspaceHarness, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector('input[aria-label="Your answer"]')!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const labels: [string, string] = ['Cups of Flour', 'Cookies'];
const missing: RatioTableChallenge = { id: 'm1', type: 'missing-value', baseRatio: [3, 12], targetMultiplier: 2.5, hiddenValue: 'scaled-second',
  rowLabels: labels, hint: '', instruction: 'If 3 cups make 12 cookies, how many cookies do 7.5 cups make?' };
const find: RatioTableChallenge = { id: 'f1', type: 'find-multiplier', baseRatio: [5, 8], targetMultiplier: 4.5, rowLabels: labels, hint: '',
  instruction: '5 cups and 8 cookies became 22.5 cups and 36 cookies. What multiplier was used?' };
const rate: RatioTableChallenge = { id: 'u1', type: 'unit-rate', baseRatio: [4, 52], targetMultiplier: 1, rowLabels: labels, hint: '',
  instruction: '4 cups make 52 cookies. How many cookies per cup?' };
// The hard tier's starting position: no unit-rate banner, no bar chart.
const table = (c: RatioTableChallenge): RatioTableData => ({ title: 'Ratios', description: '', challenges: [c],
  showUnitRate: false, showBarChart: false, maxMultiplier: 10 });
const mount = (mode: string, c: RatioTableChallenge) => {
  const h = mountWorkspace({ primitiveId: 'ratio-table', evalMode: mode, data: table(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('missing_value: the arrows draw in the same commit; the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount('missing_value', missing);
  expect(levers(h)).toEqual([['bar_chart', false], ['unit_rate_banner', false], ['times_arrows', false], ['model_ratio', false],
    ['simpler_problem', false]]);
  type(h, '16.5'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'added_difference' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'added_difference')).toBe('bar_chart');
  const receipt = h.dispatch('pull_lever', { lever: 'times_arrows' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/arrow on each row/);
  expect(q(h, '[data-lever="times-arrows"]')[0].textContent).toMatch(/3→ ×2\.5 →7\.5.*12→ ×2\.5 →\?/);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'times_arrows' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  type(h, '30'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'm1', correct: true, levers: ['times_arrows'] });
});

it('find_multiplier: every help lever draws without the multiplier', () => {
  const h = mount('find_multiplier', find);
  type(h, '17.5'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'difference' });
  for (const id of ['bar_chart', 'times_arrows', 'division_frame', 'model_ratio']) expect(h.dispatch('pull_lever', { lever: id }).status, id).toBe('committed');
  expect(q(h, '[data-lever="times-arrows"]')[0].textContent).toMatch(/× \?/);
  expect(q(h, '[data-lever="division-frame"]')[0].textContent).toBe('Cups of Flour: 22.5 ÷ 5 = ?');
  expect(q(h, '[data-lever="model-ratio"]')).toHaveLength(1);
  expect(h.view.container.textContent).not.toMatch(/4\.5/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/4\.5/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
});

it('unit_rate: the equal-groups boxes hold no number; the rate itself is never drawn', () => {
  const h = mount('unit_rate', rate);
  type(h, '0.08'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'inverse_rate' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'inverse_rate')).toBe('equal_groups');
  expect(h.dispatch('pull_lever', { lever: 'equal_groups' }).status).toBe('committed');
  const boxes = q(h, '[data-lever="equal-groups"] div div');
  expect(boxes).toHaveLength(4);
  for (const b of boxes) expect(b.textContent).toBe('?');
  expect(h.dispatch('pull_lever', { lever: 'model_ratio' }).status).toBe('committed');
  expect(h.view.container.textContent).not.toMatch(/\b13\b/);
});

it('the simpler problem is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount('missing_value', missing);
  type(h, '16.5'); check(h);
  const r = h.dispatch('pull_lever', { lever: 'simpler_problem' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('m1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'm1' });
  expect(r.state.task!.demand).toMatchObject({ baseColumn: '2 Cups of Flour to 6 Cookies', learnerWork: 'nothing typed yet' });
  expect(JSON.stringify(r.state.task!.demand)).not.toMatch(/\b30\b/);
  type(h, '12'); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('m1');
  expect(h.state().task!.demand).toMatchObject({ baseColumn: '3 Cups of Flour to 12 Cookies', learnerWork: 'nothing typed yet' });
  type(h, '30'); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['m1', false, false], ['m1~simpler', true, true], ['m1', true, false]]);
});
