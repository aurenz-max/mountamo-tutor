// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real AreaModel on the shared teaching workspace, mounted the way a lesson
 * mounts it. A right cell is kept and is not a commit; a wrong cell, the sum, the perimeter and the parts commit a
 * checked gesture with their named miss; Try again clears only the wrong entry; the runtime owns progression; no
 * product, total, perimeter or part reaches the tutor.
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
import type { AreaModelChallenge, AreaModelChallengeType } from './AreaModel';
import { areaMiss, partsFit } from './areaModelWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const item = (id: string, factor1Parts: number[], factor2Parts: number[], extra: Partial<AreaModelChallenge> = {}): AreaModelChallenge =>
  ({ id, factor1Parts, factor2Parts, showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null, ...extra });
const ITEMS: Record<AreaModelChallengeType, AreaModelChallenge> = {
  build_model: item('b', [7], [20, 4]),
  find_area: item('f', [30, 4], [40, 3]),
  multiply: item('m', [200, 30, 6], [40, 2]),
  perimeter: item('p', [12], [7]),
  factor: item('x', [20, 5], [30, 6], { showPartialProducts: true, showDimensions: false }),
};
/** Every product, total, perimeter and part the learner must find, as a word on its own. */
const KEYS: Record<AreaModelChallengeType, number[]> = {
  build_model: [140, 28, 168], find_area: [1200, 160, 90, 12, 1462], multiply: [8000, 1200, 240, 400, 60, 12, 9912],
  perimeter: [38, 84], factor: [20, 5, 30, 6],
};

const mount = (mode: AreaModelChallengeType, challenges: AreaModelChallenge[]) =>
  mountWorkspace({ primitiveId: 'area-model', evalMode: mode, instanceId: 'area',
    data: { title: 'Area model', description: 'Use the area model', challengeType: mode, challenges } });
const write = (h: WorkspaceHarness, label: string, text: string | number) => act(() => {
  const input = h.view.container.querySelector(`input[aria-label="${label}"]`);
  expect(input, `no input ${label}`).toBeTruthy();
  fireEvent.change(input!, { target: { value: String(text) } });
});
const cell = (h: WorkspaceHarness, row: number, col: number, value: number) => {
  h.press(`Cell row ${row + 1} column ${col + 1}`); write(h, 'Cell product', value); h.press('Check');
};
/** The right work for an item, through the real controls. */
function solve(h: WorkspaceHarness, mode: AreaModelChallengeType, c: AreaModelChallenge) {
  const w = c.factor1Parts.reduce((s, v) => s + v, 0), l = c.factor2Parts.reduce((s, v) => s + v, 0);
  if (mode === 'perimeter') { write(h, 'Perimeter', 2 * (w + l)); h.press('Submit'); return; }
  if (mode === 'factor') {
    c.factor1Parts.forEach((v, i) => write(h, `Column part ${i + 1}`, v));
    c.factor2Parts.forEach((v, i) => write(h, `Row part ${i + 1}`, v));
    h.press('Check My Factors'); return;
  }
  c.factor2Parts.forEach((row, r) => c.factor1Parts.forEach((col, k) => cell(h, r, k, row * col)));
  write(h, 'Sum of the cell products', w * l); h.press('Submit Final Answer');
}
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts ?? [];

it.each(Object.keys(ITEMS) as AreaModelChallengeType[])('%s mounts under tutor ownership with no scripted cue and no published key', mode => {
  const c = ITEMS[mode];
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toMatch(mode === 'perimeter' ? /perimeter/ : mode === 'factor' ? /column parts/ : /area model/);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  const facts = JSON.stringify(demand(h)) + h.state().task!.task;
  // The factor grid prints its cells, and a cell can equal a part: only the parts are keys there, and only as headers.
  const keys = mode === 'factor' ? [] : KEYS[mode];
  for (const k of keys) expect(facts).not.toMatch(new RegExp(`(?<!\\d)${k}(?!\\d)`));
  if (mode === 'factor') expect(demand(h).headers).toMatch(/^blank/);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.container.textContent).not.toMatch(/Next Problem|Last problem/);
  // Right first time: checked by the activity, credited, then the runtime advances and the lesson completes.
  solve(h, mode, c);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(attempts(h)).toHaveLength(1);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  h.close();
});

it('find_area: a right cell is kept and not committed; a cell with its zeros dropped commits, closes, and Try again clears only it', () => {
  seam.evaluationContext = { lesson: 'test' };
  const c = ITEMS.find_area;
  const h = mount('find_area', [c, { ...c, id: 'f2', factor1Parts: [20, 5], factor2Parts: [30, 6] }]);
  cell(h, 0, 1, 160);
  expect(attempts(h)).toHaveLength(0);
  expect(demand(h).learnerWork).toBe('1 of 4 cells right (160 in row 1, column 2)');
  cell(h, 0, 0, 120);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'dropped_zeros' });
  expect(demand(h).learnerWork).toMatch(/^Typed 120 in the cell in row 1, column 1 \(labelled 30 × 40\), marked wrong/);
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).not.toMatch(/1200|1462/);
  // Closed until Try again: the entry is shut and another cell cannot be opened.
  expect((h.view.container.querySelector('input[aria-label="Cell product"]') as HTMLInputElement).disabled).toBe(true);
  h.press('Cell row 2 column 1');
  expect(h.view.container.querySelector('label')?.textContent).toContain('30 × 40');

  h.dispatch('retry');
  expect(demand(h).learnerWork).toBe('1 of 4 cells right (160 in row 1, column 2)');
  expect(h.view.container.querySelector('[aria-label="Cell row 1 column 1"]')?.textContent).not.toContain('120');
  expect(h.view.container.querySelector('input[aria-label="Cell product"]')).toBeNull();
  cell(h, 0, 0, 1200); cell(h, 1, 0, 90); cell(h, 1, 1, 12);
  expect(demand(h).learnerWork).toMatch(/Every cell is right; the sum is next$/);
  write(h, 'Sum of the cell products', 1462); h.press('Submit Final Answer');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('f2');
  expect(demand(h).learnerWork).toBe('No cell right yet, 4 to fill');
  solve(h, 'find_area', { ...c, factor1Parts: [20, 5], factor2Parts: [30, 6] });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, , work, , evidence] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(score).toBe(84);
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.firstResponseScore).toBe(50);
  expect(evidence.phases).toContainEqual(expect.objectContaining({ itemId: 'f', phase: 'cell', observed: 'Incorrect: entered 120', miss: 'dropped_zeros' }));
  h.close();
});

it('a wrong sum is left_out_part; Try again keeps every right cell and clears the sum', () => {
  const c = ITEMS.find_area;
  const h = mount('find_area', [c]);
  cell(h, 0, 0, 1200); cell(h, 0, 1, 160); cell(h, 1, 0, 90); cell(h, 1, 1, 12);
  write(h, 'Sum of the cell products', 1462 - 90); h.press('Submit Final Answer');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'left_out_part' });
  h.dispatch('retry');
  expect(demand(h).learnerWork).toMatch(/^4 of 4 cells right/);
  expect((h.view.container.querySelector('input[aria-label="Sum of the cell products"]') as HTMLInputElement).value).toBe('');
  write(h, 'Sum of the cell products', 1462); h.press('Submit Final Answer');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('perimeter: length plus width is two_sides_only, and Try again clears the typed number', () => {
  const h = mount('perimeter', [ITEMS.perimeter]);
  write(h, 'Perimeter', 19); h.press('Submit');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'two_sides_only' });
  expect(h.view.container.textContent).not.toMatch(/Attempts/);
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ learnerWork: 'No perimeter typed yet' });
  expect((h.view.container.querySelector('input[aria-label="Perimeter"]') as HTMLInputElement).value).toBe('');
  h.close();
});

it('factor: swapped parts commit `swapped`; any parts that make every cell are right', () => {
  const h = mount('factor', [ITEMS.factor]);
  [30, 6].forEach((v, i) => write(h, `Column part ${i + 1}`, v));
  [20, 5].forEach((v, i) => write(h, `Row part ${i + 1}`, v));
  h.press('Check My Factors');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'swapped' });
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ learnerWork: 'No parts typed yet' });
  // 600, 150 / 120, 30 is also 40 + 10 by 15 + 3.
  [40, 10].forEach((v, i) => write(h, `Column part ${i + 1}`, v));
  [15, 3].forEach((v, i) => write(h, `Row part ${i + 1}`, v));
  h.press('Check My Factors');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('areaMiss names each step\'s signature error', () => {
  const f = ITEMS.find_area;
  const at = (entered: number, row = 0, col = 0) => areaMiss(f, { step: 'cell', row, col, entered: String(entered) });
  expect(at(70)).toBe('added_not_multiplied');
  expect(at(120)).toBe('dropped_zeros');
  expect(at(12)).toBe('dropped_zeros');
  expect(at(12000)).toBe('extra_zeros');
  expect(at(1230)).toBe('one_group_off');
  expect(at(1100)).toBe('wrong_product');
  expect(at(1200)).toBeUndefined();
  const sum = (entered: number) => areaMiss(f, { step: 'sum', entered: String(entered) });
  expect(sum(1462 - 160)).toBe('left_out_part');
  expect(sum(1452)).toBe('carry_slip');
  expect(sum(1500)).toBe('sum_off');
  const per = (entered: number) => areaMiss(ITEMS.perimeter, { step: 'perimeter', entered: String(entered) });
  expect([per(84), per(19), per(31), per(26), per(40), per(38)]).toEqual(['gave_area', 'two_sides_only', 'three_sides', 'three_sides', 'perimeter_off', undefined]);
  const parts = (top: number[], left: number[]) => areaMiss(ITEMS.factor, { step: 'dimensions', top: top.map(String), left: left.map(String) });
  expect(parts([30, 6], [20, 5])).toBe('swapped');
  expect(parts([20, 4], [30, 6])).toBe('one_part_wrong');
  expect(parts([2, 5], [3, 6])).toBe('parts_wrong');
  expect(parts([40, 10], [15, 3])).toBeUndefined();
  expect(partsFit(ITEMS.factor, ['40', '10'], ['15', '3'])).toBe(true);
});
