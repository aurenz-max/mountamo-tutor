// @vitest-environment jsdom
/**
 * area-model levers on the real component under the shared teaching workspace: each pull changes the screen and the
 * scene fact in the same commit, names no answer, is refused when it would change nothing, and is recorded on the next
 * attempt; a simplify pull opens an ungraded easier item and the full item comes back blank after it.
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
import type { AreaModelChallenge, AreaModelChallengeType } from './AreaModel';
import { practiceItem } from './areaModelLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const item = (id: string, f1: number[], f2: number[], extra: Partial<AreaModelChallenge> = {}): AreaModelChallenge =>
  ({ id, factor1Parts: f1, factor2Parts: f2, showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null, ...extra });
// The hard tier: nothing on screen to start with.
const FIND = item('f', [30, 4], [40, 3], { showCellEquations: false });
const BUILD = item('b', [7], [20, 4], { showCellEquations: false });
const PER = item('p', [12], [7], { showPerimeterExpansion: false });
const FAC = item('x', [20, 5], [30, 6], { showPartialProducts: true, showDimensions: false });

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
const cells = (h: WorkspaceHarness, c: AreaModelChallenge) =>
  c.factor2Parts.forEach((r, i) => c.factor1Parts.forEach((k, j) => cell(h, i, j, r * k)));
const total = (c: AreaModelChallenge) => c.factor1Parts.reduce((s, v) => s + v, 0) * c.factor2Parts.reduce((s, v) => s + v, 0);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const onScreen = (h: WorkspaceHarness) => String((h.state().task!.demand as Record<string, unknown>).onScreen ?? '');

it('find_area: zeros dropped → tens_split, drawn in the same commit with no product; a repeat pull and an early stack change nothing', () => {
  const h = mount('find_area', [FIND]);
  expect(levers(h)).toEqual([['cell_labels', false], ['tens_split', false], ['cell_dots', false], ['stack_products', false], ['easier_model', false]]);
  cell(h, 0, 0, 120);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'dropped_zeros' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'dropped_zeros')).toBe('tens_split');
  expect(q(h, '[data-lever="tens_split"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'tens_split' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/split into a one-digit fact and its tens/);
  expect(onScreen(h)).not.toMatch(/\d/);
  // One split per cell with a tens part: 30 × 40, 4 × 40, 30 × 3. Never a product.
  expect(q(h, '[data-lever="tens_split"]').map(e => e.textContent)).toEqual(['3 × 4 × 10 × 10', '4 × 4 × 10', '3 × 3 × 10']);
  expect(h.view.container.textContent).not.toMatch(/1200|160|1462/);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'tens_split' }).status).not.toBe('committed');
  expect(h.dispatch('pull_lever', { lever: 'stack_products' }).status).not.toBe('committed');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML }).toEqual(before);

  h.dispatch('retry');
  expect(q(h, '[data-lever="tens_split"]')).toHaveLength(3);
  cells(h, FIND);
  // At the sum, the stack stands the right products in one column, no total.
  expect(h.dispatch('pull_lever', { lever: 'stack_products' }).status).toBe('committed');
  const stack = q(h, '[data-lever="stack_products"]')[0];
  expect(Array.from(stack.firstElementChild!.children).map(d => d.textContent)).toEqual(['1200', '160', '90', '+ 12']);
  expect(stack.textContent).not.toContain('1462');
  write(h, 'Sum of the cell products', 1462); h.press('Submit Final Answer');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'f', correct: true, levers: ['tens_split', 'stack_products'] });
  h.close();
});

it('cell_labels at the hard tier writes each cell\'s two parts; at the easy tier it is already on screen', () => {
  const h = mount('find_area', [FIND]);
  expect(h.view.container.textContent).not.toContain('30 × 40');
  expect(h.dispatch('pull_lever', { lever: 'cell_labels' }).status).toBe('committed');
  expect(h.view.container.querySelector('[aria-label="Cell row 1 column 1"]')!.textContent).toContain('30 × 40');
  expect((h.state().task!.demand as Record<string, unknown>).cellLabels).toBe('each cell shows its column part × its row part');
  h.close();
  cleanup();
  const easy = mount('find_area', [{ ...FIND, showCellEquations: true }]);
  expect(levers(easy)[0]).toEqual(['cell_labels', true]);
  easy.close();
});

it('build_model: cell_dots draws the small cell as rows of dots, no number; the tens cell gets none', () => {
  const h = mount('build_model', [BUILD]);
  cell(h, 1, 0, 11);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'added_not_multiplied' });
  expect(h.dispatch('pull_lever', { lever: 'cell_dots' }).status).toBe('committed');
  const dots = q(h, '[data-lever="cell_dots"]');
  expect(dots).toHaveLength(1);
  expect(dots[0].querySelectorAll('span')).toHaveLength(28);
  expect(dots[0].children).toHaveLength(4);
  expect(dots[0].textContent).toBe('');
  h.close();
});

it('easier_model opens an ungraded model of the same shape; the full item comes back blank and is credited after it', () => {
  const h = mount('find_area', [FIND]);
  cell(h, 0, 1, 160);
  cell(h, 0, 0, 120);
  const easier = practiceItem(FIND, 'find_area')!;
  const receipt = h.dispatch('pull_lever', { lever: 'easier_model' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('f~easier');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'f' });
  expect(h.view.container.textContent).toMatch(/Practice/);
  expect(receipt.state.task!.workspace!.levers ?? []).toEqual([]);
  cells(h, easier);
  write(h, 'Sum of the cell products', total(easier)); h.press('Submit Final Answer');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('f');
  expect((h.state().task!.demand as Record<string, unknown>).learnerWork).toBe('No cell right yet, 4 to fill');
  expect(h.view.container.textContent).not.toMatch(/Practice/);
  cells(h, FIND);
  write(h, 'Sum of the cell products', 1462); h.press('Submit Final Answer');
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['f', false, false], ['f~easier', true, true], ['f', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['easier_model'] });
  h.close();
});

it('perimeter: all_sides labels the bottom and the right; side_sum writes the addition with no total; the small rectangle is practice', () => {
  const h = mount('perimeter', [PER]);
  expect(levers(h)).toEqual([['all_sides', false], ['side_sum', false], ['smaller_rectangle', false]]);
  write(h, 'Perimeter', 19); h.press('Submit');
  expect(nextLever(h.state().task!.workspace!.levers!, 'two_sides_only')).toBe('all_sides');
  expect(h.dispatch('pull_lever', { lever: 'all_sides' }).status).toBe('committed');
  expect(q(h, '[data-lever="all_sides"]').map(e => e.textContent)).toEqual(['7', '12']);
  expect(h.dispatch('pull_lever', { lever: 'side_sum' }).status).toBe('committed');
  expect(h.view.container.textContent).toContain('Perimeter = 12 + 7 + 12 + 7');
  expect(h.view.container.textContent).not.toMatch(/38/);
  expect(onScreen(h)).not.toMatch(/\d/);
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_rectangle' });
  expect(receipt.state.task!.itemId).toBe('p~easier');
  expect(q(h, '[data-lever="all_sides"]')).toHaveLength(0);
  h.close();
});

it('factor: start_cell highlights the top-left cell; shared_parts colours each blank part and its cells; the easier grid is practice', () => {
  const h = mount('factor', [FAC]);
  expect(levers(h)).toEqual([['start_cell', false], ['shared_parts', false], ['easier_grid', false]]);
  [30, 6].forEach((v, i) => write(h, `Column part ${i + 1}`, v));
  [20, 5].forEach((v, i) => write(h, `Row part ${i + 1}`, v));
  h.press('Check My Factors');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'swapped' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'swapped')).toBe('shared_parts');
  expect(h.dispatch('pull_lever', { lever: 'shared_parts' }).status).toBe('committed');
  const top = h.view.container.querySelector('input[aria-label="Column part 1"]') as HTMLInputElement;
  expect(top.style.boxShadow).toMatch(/56, 189, 248|#38bdf8/);
  expect(h.dispatch('pull_lever', { lever: 'start_cell' }).status).toBe('committed');
  expect(q(h, '.bg-yellow-500\\/40')).toHaveLength(1);
  expect(onScreen(h)).not.toMatch(/\d/);
  const receipt = h.dispatch('pull_lever', { lever: 'easier_grid' });
  expect(receipt.state.task!.itemId).toBe('x~easier');
  expect(receipt.state.task!.demand.kind).toBe('factor');
  h.close();
});
