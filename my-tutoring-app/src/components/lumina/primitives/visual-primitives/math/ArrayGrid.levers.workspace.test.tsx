// @vitest-environment jsdom
/**
 * array-grid levers on the given-array modes (build_array, count_array, multiply_array), mounted the way a lesson
 * mounts them. A pull changes the array and the scene fact in one commit and draws no number; the next attempt
 * records the lever; a refused pull changes nothing; the smaller array is ungraded practice and the full item comes
 * back blank and is credited after it.
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

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

type Mode = 'build_array' | 'count_array' | 'multiply_array';
const mount = (mode: Mode, showLabels: boolean, dims: Array<[number, number]> = [[3, 4], [2, 5]]) => {
  const h = mountWorkspace({ primitiveId: 'array-grid', evalMode: mode, instanceId: 'arrays', data: {
    title: 'Arrays', description: 'Arrays', challengeType: mode, iconType: 'star', showLabels,
    challenges: dims.map(([r, c], i) => ({ id: `a${i}`, targetRows: r, targetColumns: c })) } });
  h.settle(2000);
  return h;
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector(`input[aria-label="${label}"]`)!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press(/check/i);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;

it('count: row strips outline each row in the same commit, the fact draws no number, the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('count_array', false);
  expect(levers(h)).toEqual([['row_strips', false], ['number_labels', false], ['smaller_array', false]]);
  write(h, 'Total', '7'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'added_sides' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'added_sides')).toBe('row_strips');
  expect(q(h, '[data-lever="row-strip"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'row_strips' });
  expect(receipt.status).toBe('committed');
  // The committed state already carries the fact; the screen shows the strips.
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/own coloured strip/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d/);
  expect(q(h, '[data-lever="row-strip"]')).toHaveLength(3);
  expect(q(h, '[data-lever="row-strip"]').every(r => !/\d/.test(r.textContent ?? ''))).toBe(true);
  // A refused pull: scene, levers and attempts unchanged.
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length,
    html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'row_strips' }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length,
    html: h.view.container.innerHTML }).toEqual(before);
  h.dispatch('retry');
  write(h, 'Total', '12'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'a0', correct: true, levers: ['row_strips'] });
});

it('count, labels hidden: number labels number every row and column; the next item opens bare', () => {
  const h = mount('count_array', false);
  expect(q(h, '[data-axis-labels]')).toHaveLength(0);
  write(h, 'Total', '8'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'one_row_off' });
  h.dispatch('pull_lever', { lever: 'row_strips' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'one_row_off')).toBe('number_labels');
  expect(h.dispatch('pull_lever', { lever: 'number_labels' }).status).toBe('committed');
  expect(q(h, '[data-axis-labels="rows"] > div').map(d => d.textContent)).toEqual(['1', '2', '3']);
  expect(q(h, '[data-axis-labels="columns"] > div').map(d => d.textContent)).toEqual(['1', '2', '3', '4']);
  expect(h.state().task!.demand).toMatchObject({ labels: 'every row and column numbered' });
  // Never the total.
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b12\b/);
  h.dispatch('retry');
  write(h, 'Total', '12'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('a1');
  expect(q(h, '[data-axis-labels]')).toHaveLength(0);
  expect(q(h, '[data-lever="row-strip"]')).toHaveLength(0);
  expect(levers(h)).toEqual([['row_strips', false], ['number_labels', false], ['smaller_array', false]]);
});

it('count: the smaller array is ungraded practice of the same mode; the full item comes back blank and is credited after', () => {
  const h = mount('count_array', true);
  expect(levers(h)).toEqual([['row_strips', false], ['smaller_array', false]]);
  write(h, 'Total', '20'); check(h);
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_array' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('a0~smaller');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'a0' });
  expect(receipt.state.task!.demand).toMatchObject({ kind: 'count_array', array: '2 rows of 4 stars' });
  expect((h.view.container.querySelector('input[aria-label="Total"]') as HTMLInputElement).value).toBe('');
  write(h, 'Total', '8'); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('a0');
  expect(h.state().task!.demand).toMatchObject({ array: '3 rows of 4 stars' });
  expect((h.view.container.querySelector('input[aria-label="Total"]') as HTMLInputElement).value).toBe('');
  write(h, 'Total', '12'); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['a0', false, false], ['a0~smaller', true, true], ['a0', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['smaller_array'] });
});

it('build: strips are refused until there is an array, then outline the built rows; multiply never offers labels', () => {
  const h = mount('build_array', false);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'row_strips' }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML }).toEqual(before);
  h.press('Rows: 3'); h.press('Columns: 4');
  write(h, 'Total', '7'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'added_sides' });
  expect(h.dispatch('pull_lever', { lever: 'row_strips' }).status).toBe('committed');
  expect(q(h, '[data-lever="row-strip"]')).toHaveLength(3);
  cleanup();
  const m = mount('multiply_array', false);
  expect(levers(m)).toEqual([['row_strips', false], ['smaller_array', false]]);
  write(m, 'Rows', '4'); write(m, 'Columns', '3'); write(m, 'Total', '12'); check(m);
  expect(attempts(m).at(-1)).toMatchObject({ miss: 'swapped_sides' });
  expect(m.dispatch('pull_lever', { lever: 'row_strips' }).status).toBe('committed');
  expect(q(m, '[data-lever="row-strip"]')).toHaveLength(3);
  expect(q(m, '[data-axis-labels]')).toHaveLength(0);
});
