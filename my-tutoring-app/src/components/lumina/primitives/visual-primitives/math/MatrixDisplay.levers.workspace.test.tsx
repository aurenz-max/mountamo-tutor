// @vitest-environment jsdom
/**
 * matrix-display levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit, the
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
import type { MatrixDisplayChallenge, MatrixDisplayData } from './MatrixDisplay';
import { SCALAR_LABEL, boxLabel } from './matrixDisplayWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const input = (h: WorkspaceHarness, label: string) => h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const enter = (h: WorkspaceHarness, a: number | number[][]) => {
  act(() => {
    if (typeof a === 'number') fireEvent.change(input(h, SCALAR_LABEL), { target: { value: String(a) } });
    else a.forEach((row, i) => row.forEach((v, j) => fireEvent.change(input(h, boxLabel(i, j)), { target: { value: String(v) } })));
  });
  h.press('Check Answer');
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const multiply: MatrixDisplayChallenge = { id: 'm1', challengeType: 'multiply', instruction: 'Multiply A (2×2) by B (2×2).', hint: '',
  rows: 2, columns: 2, values: [[1, 2], [3, 4]], secondMatrix: { rows: 2, columns: 2, values: [[5, 6], [7, 8]], label: 'Matrix B' },
  expectedMatrix: [[19, 22], [43, 50]] };
const det: MatrixDisplayChallenge = { id: 'd1', challengeType: 'determinant', instruction: 'Calculate the determinant of this 2×2 matrix.',
  hint: '', rows: 2, columns: 2, values: [[7, 3], [2, 5]], expectedScalar: 29 };
const inverse: MatrixDisplayChallenge = { id: 'i1', challengeType: 'inverse', instruction: 'Find the inverse of this 2×2 matrix.', hint: '',
  rows: 2, columns: 2, values: [[-3, -5], [-1, -2]], expectedMatrix: [[-2, 5], [1, -3]] };
const transpose: MatrixDisplayChallenge = { id: 't1', challengeType: 'transpose', instruction: 'Transpose the 2×3 matrix.', hint: '',
  rows: 2, columns: 3, values: [[-6, 0, 1], [1, -4, -8]], expectedMatrix: [[-6, 1], [0, -4], [1, -8]] };
const lesson = (c: MatrixDisplayChallenge): MatrixDisplayData => ({ title: 'Matrices', description: '', challenges: [c],
  challengeType: c.challengeType, gradeBand: 'algebra2' });
const mount = (mode: string, c: MatrixDisplayChallenge) => {
  const h = mountWorkspace({ primitiveId: 'matrix-display', evalMode: mode, data: lesson(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('multiply: tracking lights the row and column in the same commit; it follows the clicked box; a repeat pull changes nothing; the next attempt records it', () => {
  const h = mount('multiply', multiply);
  expect(levers(h)).toEqual([['row_column_tracking', false], ['term_list', false], ['model_example', false], ['simpler_problem', false]]);
  enter(h, [[5, 12], [21, 32]]);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'entrywise' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'entrywise')).toBe('row_column_tracking');
  const receipt = h.dispatch('pull_lever', { lever: 'row_column_tracking' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/first row, first column.*row of Matrix A and its column of Matrix B lit/);
  expect(q(h, '.ring-cyan-300').length).toBe(2 + 2 + 1);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'row_column_tracking' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  act(() => { fireEvent.focus(input(h, boxLabel(1, 0))); });
  expect(String(h.state().task!.demand.onScreen)).toMatch(/second row, first column/);
  expect(h.dispatch('pull_lever', { lever: 'term_list' }).status).toBe('committed');
  expect(q(h, '[data-lever="term-list"]')[0].textContent).toBe('This box = A₂₁·B₁₁ + A₂₂·B₂₁');
  expect(h.view.container.textContent).not.toMatch(/\b(19|22|43|50)\b/);
  enter(h, multiply.expectedMatrix!);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'm1', correct: true, levers: ['row_column_tracking', 'term_list'] });
});

it('determinant: the diagonal marks write no number; the model never shows the determinant', () => {
  const h = mount('determinant_inverse', det);
  enter(h, 41);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'added_products' });
  for (const id of ['diagonal_marks', 'model_example']) expect(h.dispatch('pull_lever', { lever: id }).status, id).toBe('committed');
  expect(q(h, '[data-lever="diagonal-marks"]')[0].textContent).not.toMatch(/\d/);
  expect(q(h, '.bg-emerald-500\\/25')).toHaveLength(2);
  expect(q(h, '[data-lever="model-example"]')).toHaveLength(1);
  expect(h.view.container.textContent).not.toMatch(/\b29\b/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
});

it('inverse: the letters and the pattern carry no number; transpose: the bands colour rows and columns', () => {
  const h = mount('determinant_inverse', inverse);
  enter(h, [[-2, -5], [-1, -3]]);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'no_negation' });
  expect(h.dispatch('pull_lever', { lever: 'swap_negate_letters' }).status).toBe('committed');
  expect(q(h, '[data-lever="swap-negate-letters"]')[0].textContent).not.toMatch(/\d/);
  expect(h.view.container.textContent).toMatch(/a-3/);
  cleanup();
  const t = mount('transpose', transpose);
  enter(t, [[-6, 0], [1, 1], [-4, -8]]);
  expect(attempts(t).at(-1)).toMatchObject({ miss: 'reshaped' });
  expect(t.dispatch('pull_lever', { lever: 'row_bands' }).status).toBe('committed');
  expect(q(t, '.bg-cyan-500\\/20')).toHaveLength(3 + 3);
  expect(String(t.state().task!.demand.onScreen)).toMatch(/colour band/);
});

it('the simpler problem is ungraded practice of the same operation; the full item comes back blank and is credited after', () => {
  const h = mount('multiply', multiply);
  enter(h, [[5, 12], [21, 32]]);
  const r = h.dispatch('pull_lever', { lever: 'simpler_problem' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('m1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'm1' });
  expect(r.state.task!.demand).toMatchObject({ matrixA: '2×2: [1, 2] [0, 1]', learnerWork: 'nothing typed yet' });
  enter(h, [[4, 7], [1, 3]]);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('m1');
  expect(h.state().task!.demand).toMatchObject({ matrixA: '2×2: [1, 2] [3, 4]', learnerWork: 'nothing typed yet' });
  enter(h, multiply.expectedMatrix!);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['m1', false, false], ['m1~simpler', true, true], ['m1', true, false]]);
});
