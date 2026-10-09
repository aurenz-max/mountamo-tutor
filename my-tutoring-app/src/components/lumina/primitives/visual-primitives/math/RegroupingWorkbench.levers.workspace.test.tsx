// @vitest-environment jsdom
/**
 * regrouping-workbench levers on the teaching workspace: a pull changes the screen and the scene fact in the same
 * commit, the next attempt records it, a refused pull changes nothing, and the easier problem is ungraded practice
 * with the full item back after it.
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
import type { RegroupingChallenge, RegroupingWorkbenchData } from './RegroupingWorkbench';
import { smallerProblem } from './regroupingWorkbenchLevers';
import { operandsOf, resultOf, digitsOf } from './regroupingWorkbenchWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const NAMES = ['Ones', 'Tens', 'Hundreds'];
const type = (h: WorkspaceHarness, digits: number[]) => digits.forEach((d, i) => act(() => {
  fireEvent.change(h.view.container.querySelector(`input[aria-label="${NAMES[i]} digit"]`)!, { target: { value: String(d) } });
}));
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const challenge = (id: string, problem: string): RegroupingChallenge => ({ id, problem, requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' });
const bench = (operation: 'addition' | 'subtraction', c: RegroupingChallenge, maxPlace: RegroupingWorkbenchData['maxPlace'] = 'tens'): RegroupingWorkbenchData => ({
  title: 'Regrouping', operation, operand1: 10, operand2: 10, maxPlace, gradeBand: '1-2', challenges: [c],
  // The hard tier's starting position: no regroup marks, no place labels.
  showOptions: { showRegroupHints: false, showPlaceColumns: false },
});
const mount = (mode: string, data: RegroupingWorkbenchData) => {
  const h = mountWorkspace({ primitiveId: 'regrouping-workbench', evalMode: mode, data: data as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};
const ADD = challenge('a1', '27 + 45');

it('add: the regroup marks show in the same commit, the fact draws no digit, the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount('add_regroup', bench('addition', ADD));
  expect(levers(h)).toEqual([['column_colors', false], ['operation_model', false], ['regroup_marks', false], ['trade_model', false],
    ['smaller_problem', false]]);
  type(h, [2, 6]); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'no_carry' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'no_carry')).toBe('regroup_marks');
  expect(q(h, '.text-red-400.font-mono')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'regroup_marks' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/drawn red/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d/);
  expect(receipt.state.task!.demand).toMatchObject({ tradeButton: expect.stringContaining('only under a column that needs a trade') });
  // The ones column (12 blocks) is marked; nothing of the answer (72) is written.
  expect(q(h, '.text-red-400.font-mono').map(e => e.textContent)).toEqual(['12']);
  expect(h.view.container.textContent).not.toMatch(/\b72\b/);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'regroup_marks' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  type(h, [2, 7]); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'a1', correct: true, levers: ['regroup_marks'] });
});

it('the regroup marks are refused, with nothing changed, once the learner has made the trades', () => {
  const h = mount('add_regroup', bench('addition', ADD));
  h.press('Carry from the ones');
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'regroup_marks' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
});

it('the pictures and the column colours draw on their own, with no digit and none of the item\'s numbers', () => {
  const h = mount('add_regroup', bench('addition', ADD));
  type(h, [7, 2]); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'misplaced_digits' });
  expect(h.dispatch('pull_lever', { lever: 'column_colors' }).status).toBe('committed');
  expect(q(h, '[data-lever="column-names"]')[0].textContent).toBe('TensOnes');
  for (const id of ['trade_model', 'operation_model']) expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  expect(q(h, '[data-lever="trade-model"]')[0].textContent).toBe('→ten ones make one ten');
  expect(q(h, '[data-lever="operation-model"]')[0].textContent).toMatch(/put together/);
  for (const sel of ['[data-lever="trade-model"]', '[data-lever="operation-model"]', '[data-lever="column-names"]'])
    expect(q(h, sel)[0].textContent).not.toMatch(/\d/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  cleanup();
  const s = mount('subtract_regroup', bench('subtraction', challenge('s1', '52 - 17')));
  s.dispatch('pull_lever', { lever: 'trade_model' });
  expect(q(s, '[data-lever="trade-model"]')[0].textContent).toMatch(/one ten makes ten ones, and the tens have one less/);
});

it('the smaller problem is ungraded practice of the same operation; the full item comes back blank and is credited after', () => {
  const data = bench('addition', challenge('a3', '358 + 267'), 'hundreds');
  const h = mount('add_regroup', data);
  type(h, [5, 1, 5]); h.press('Check Answer');
  const r = h.dispatch('pull_lever', { lever: 'smaller_problem' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('a3~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'a3' });
  const easier = smallerProblem(data.challenges[0], 'addition', data)!;
  const [x, y] = operandsOf(easier, data);
  expect(r.state.task!.demand).toMatchObject({ problem: `${x} + ${y} = ?`, learnerWork: 'No digits written yet' });
  expect(JSON.stringify(r.state.task!.demand)).not.toMatch(/358|267|625/);
  type(h, digitsOf(resultOf('addition', x, y), String(x + y).length)); h.press('Check Answer');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('a3');
  expect(h.state().task!.demand).toMatchObject({ problem: '358 + 267 = ?', blocks: 'hundreds 5, tens 11, ones 15', learnerWork: 'No digits written yet' });
  type(h, [5, 2, 6]); h.press('Check Answer');
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['a3', false, false], ['a3~simpler', true, true], ['a3', true, false]]);
});
