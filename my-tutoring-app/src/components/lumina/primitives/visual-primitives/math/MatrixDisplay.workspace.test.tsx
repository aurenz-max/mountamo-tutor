// @vitest-environment jsdom
/**
 * Matrix display on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { MatrixDisplayChallenge, MatrixDisplayData } from './MatrixDisplay';
import { MATRIX_MISSES_BY_MODE, SCALAR_LABEL, boxLabel, matrixMiss } from './matrixDisplayWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const write = (h: WorkspaceHarness, label: string, text: string) => act(() => {
  const el = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(el, label).toBeTruthy();
  fireEvent.change(el!, { target: { value: text } });
});
type Answer = number | string | number[][];
const enter = (h: WorkspaceHarness, a: Answer) => {
  if (!Array.isArray(a)) write(h, SCALAR_LABEL, String(a));
  else a.forEach((row, i) => row.forEach((v, j) => write(h, boxLabel(i, j), String(v))));
  h.press('Check Answer');
};

const item = (c: Omit<MatrixDisplayChallenge, 'rows' | 'columns' | 'hint'>): MatrixDisplayChallenge =>
  ({ ...c, rows: c.values.length, columns: c.values[0].length, hint: 'Row i of A becomes column i of Aᵀ.' });
const transpose = item({ id: 't1', challengeType: 'transpose', instruction: 'Transpose the 2×3 matrix.',
  values: [[1, 2, 3], [4, 5, 6]], expectedMatrix: [[1, 4], [2, 5], [3, 6]] });
const subtract = item({ id: 's1', challengeType: 'subtract', instruction: 'Subtract Matrix B from Matrix A.',
  values: [[9, 7], [8, 6]], secondMatrix: { rows: 2, columns: 2, values: [[2, 3], [5, 1]], label: 'Matrix B' }, expectedMatrix: [[7, 4], [3, 5]] });
const multiply = item({ id: 'm1', challengeType: 'multiply', instruction: 'Multiply A (2×2) by B (2×2).',
  values: [[1, 2], [3, 4]], secondMatrix: { rows: 2, columns: 2, values: [[5, 6], [7, 8]], label: 'Matrix B' }, expectedMatrix: [[19, 22], [43, 50]] });
const determinant = item({ id: 'd1', challengeType: 'determinant', instruction: 'Calculate the determinant of this 2×2 matrix.',
  values: [[4, 3], [2, 5]], expectedScalar: 14 });
const inverse = item({ id: 'i1', challengeType: 'inverse', instruction: 'Find the inverse of this 2×2 matrix.',
  values: [[2, 1], [5, 3]], expectedMatrix: [[3, -1], [-5, 2]] });
const lesson = (challenges: MatrixDisplayChallenge[]): MatrixDisplayData => ({ title: 'Matrices', description: '', challenges,
  challengeType: challenges[0].challengeType, gradeBand: 'algebra2' });

type Case = { mode: string; data: MatrixDisplayData; wrong: Answer; miss: string; right: Answer; secret: RegExp; cleared: RegExp };
const CASES: Case[] = [
  { mode: 'transpose', data: lesson([transpose]), wrong: [[1, 2], [3, 4], [5, 6]], miss: 'reshaped', right: transpose.expectedMatrix!,
    secret: /\[1, 4\]/, cleared: /\[1, _\] \[_, _\] \[_, 6\]/ },
  { mode: 'add_subtract', data: lesson([subtract]), wrong: [[11, 10], [13, 7]], miss: 'wrong_operation', right: subtract.expectedMatrix!,
    secret: /\[7, 4\]/, cleared: /nothing typed yet/ },
  { mode: 'multiply', data: lesson([multiply]), wrong: [[5, 12], [21, 32]], miss: 'entrywise', right: multiply.expectedMatrix!,
    secret: /\b(19|22|43|50)\b/, cleared: /nothing typed yet/ },
  { mode: 'determinant_inverse', data: lesson([determinant]), wrong: 26, miss: 'added_products', right: 14,
    secret: /\b14\b/, cleared: /nothing typed yet/ },
];

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('matrix-display')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(MATRIX_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'matrix-display', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss and Try again clears the wrong boxes; the right one completes once',
  async ({ mode, data, wrong, miss, right, secret, cleared }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'matrix-display', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/expectedMatrix|expectedScalar|answer is/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // Show steps, Skip and Next are the tutor's.
    expect(h.view.container.textContent).not.toMatch(/Show steps|Skip|Next Matrix|Walkthrough/);
    expect(h.view.container.textContent).not.toMatch(secret);

    enter(h, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(secret);
    // Input is closed until Try again.
    const open = Array.from(h.view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'))
      .filter(el => !el.disabled && /Answer row|Determinant answer|Check Answer/.test((el.getAttribute('aria-label') ?? '') + el.textContent));
    expect(open).toEqual([]);
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(cleared);
    expect(h.state().task!.demand.checkMarks).toBeUndefined();

    enter(h, right);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'matrix-display', evalMode: 'determinant_inverse', data: lesson([determinant]) as unknown as Record<string, unknown> });
  enter(h, 14);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn and which boxes a check marked wrong, in words, never the answer', () => {
  const h = mountWorkspace({ primitiveId: 'matrix-display', evalMode: 'determinant_inverse', data: lesson([inverse]) as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ matrix: '2×2: [2, 1] [5, 3]', answerBoxes: 'a 2×2 grid of answer boxes',
    learnerWork: 'nothing typed yet' });
  expect(String(h.state().task!.demand.ruleLine)).toMatch(/Row i of A/);
  enter(h, [[3, 1], [5, 2]]);
  expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe('no_negation');
  expect(h.state().task!.demand.checkMarks).toBe('boxes marked wrong: first row, second column; second row, first column; every other box is marked right');
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/-1\b|-5\b/);
  h.dispatch('retry');
  expect(h.state().task!.demand.learnerWork).toBe('answer grid (_ is an empty box): [3, _] [_, 2]');
});

it('a box that is not a number is not a check', () => {
  const h = mountWorkspace({ primitiveId: 'matrix-display', evalMode: 'determinant_inverse', data: lesson([determinant]) as unknown as Record<string, unknown> });
  enter(h, 'abc');
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(h.view.container.textContent).toMatch(/Type a number in every box/);
  // A typed minus sign (−) reads as a minus.
  enter(h, '−7');
  expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe('too_low');
});

it('matrixMiss names the pattern the typed grid or number shows', () => {
  const grid = (cells: number[][]) => ({ scalar: '', cells: cells.map(r => r.map(String)) });
  const num = (v: number) => ({ scalar: String(v), cells: [] });
  expect(matrixMiss(transpose, grid([[1, 4], [2, 5], [3, 6]]))).toBeUndefined();
  expect(matrixMiss(transpose, grid([[1, 2], [3, 4], [5, 6]]))).toBe('reshaped');
  expect(matrixMiss(transpose, grid([[1, 4], [2, 5], [3, 7]]))).toBe('one_entry');
  expect(matrixMiss(subtract, grid([[11, 10], [13, 7]]))).toBe('wrong_operation');
  expect(matrixMiss(subtract, grid([[-7, -4], [-3, -5]]))).toBe('reversed_subtraction');
  expect(matrixMiss(subtract, grid([[7, -4], [3, 5]]))).toBe('sign_error');
  expect(matrixMiss(subtract, grid([[7, 1], [3, 1]]))).toBe('some_entries');
  expect(matrixMiss(multiply, grid([[5, 12], [21, 32]]))).toBe('entrywise');
  expect(matrixMiss(multiply, grid([[23, 34], [31, 46]]))).toBe('reversed_order');
  expect(matrixMiss(multiply, grid([[17, 23], [39, 53]]))).toBe('row_times_row');
  expect(matrixMiss(multiply, grid([[5, 6], [15, 18]]))).toBe('missed_term');
  expect(matrixMiss(determinant, num(26))).toBe('added_products');
  expect(matrixMiss(determinant, num(-14))).toBe('opposite_sign');
  expect(matrixMiss(determinant, num(20))).toBe('one_product');
  expect(matrixMiss(determinant, num(15))).toBe('near_miss');
  expect(matrixMiss(determinant, num(40))).toBe('too_high');
  expect(matrixMiss(inverse, grid([[3, 1], [5, 2]]))).toBe('no_negation');
  expect(matrixMiss(inverse, grid([[2, -1], [-5, 3]]))).toBe('no_swap');
  expect(matrixMiss(inverse, grid([[2, 1], [5, 3]]))).toBe('original');
  const negDet = { ...inverse, values: [[1, 2], [1, 1]], expectedMatrix: [[-1, 2], [1, -1]] };
  expect(matrixMiss(negDet, grid([[1, -2], [-1, 1]]))).toBe('unscaled');
  // det = 1(0 − 24) − 2(0 − 20) + 3(0 − 5) = 1; every term added: −24 − 40 − 15.
  const threeByThree = { ...determinant, values: [[1, 2, 3], [0, 1, 4], [5, 6, 0]], expectedScalar: 1 };
  expect(matrixMiss(threeByThree, num(-79))).toBe('added_products');
  expect(matrixMiss(threeByThree, num(-1))).toBe('opposite_sign');
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['matrix-display'].validate;
  expect(() => validate(lesson([{ ...determinant, expectedScalar: undefined }]))).toThrow();
  expect(() => validate(lesson([{ ...subtract, secondMatrix: undefined }]))).toThrow();
  expect(() => validate(lesson([{ ...transpose, expectedMatrix: [[1, 4], [2]] }]))).toThrow();
  expect(validate(lesson([transpose, subtract, multiply, determinant, inverse]))).toBeTruthy();
});
