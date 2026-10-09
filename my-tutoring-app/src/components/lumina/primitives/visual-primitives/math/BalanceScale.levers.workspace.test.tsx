// @vitest-environment jsdom
/**
 * balance-scale's spoken-step levers (`balanceScaleLevers.ts`) on the shared teaching workspace, mounted the way a
 * lesson mounts it. A pull changes the screen and the scene in one commit and states no answer; the next attempt
 * records the lever; a refused pull changes nothing; a simplify pull opens an ungraded practice step, and the full
 * item comes back blank and is credited, as assisted.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const x = (parcels = 1) => ({ value: parcels, isVariable: true });
const ch = (type: string, leftSide: object[], rightSide: object[], variableValue: number) =>
  ({ type, leftSide, rightSide, variableValue, instruction: `Solve ${type}.`, hint: 'Keep it balanced.' });
const data = (...challenges: object[]) => ({ title: 'Balance', description: 'Balance it.', gradeBand: 'K-2', leftSide: [], rightSide: [],
  variableValue: 0, challenges });
const mount = (evalMode: string, ...challenges: object[]) =>
  mountWorkspace({ primitiveId: 'balance-scale', evalMode, data: data(...challenges), instanceId: 'scale' });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
/** Finish a hands step with the real controls, then advance to the next step. */
const hands = (h: WorkspaceHarness, ...labels: string[]) => {
  labels.forEach(label => h.press(label));
  h.settle(2000);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
};

it('equality total: unit_cells redraws the load as unit squares in the same commit; a refused pull changes nothing', () => {
  const h = mount('equality', ch('equality', [x()], [{ value: 7 }], 7), ch('equality', [x()], [{ value: 9 }], 9));
  hands(h, 'Add 3 weight', 'Add 3 weight', 'Add 1 weight');
  expect(h.state().task!.itemId).toBe('balance-1-total');
  expect(levers(h)).toEqual([['unit_cells', false], ['two_blocks', false]]);
  h.say('six'); h.feedback('incorrect', 'retry');
  expect(observerLever(h.state(), true)).toBe('unit_cells');
  expect(q(h, '[data-unit-cell]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'unit_cells' });
  expect(receipt.status).toBe('committed');
  const cells = q(h, '[data-unit-cell]') as HTMLElement[];
  expect(cells).toHaveLength(7);
  expect(cells.map(c => c.style.marginLeft)).toEqual(['', '', '', '', '', '12px', '']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/unit squares in one row/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\b7\b/);
  expect(h.view.container.textContent).not.toMatch(/=\s*7/);

  // Refused: already pulled. The screen, the levers and the attempts stay as they were.
  const before = { levers: levers(h), attempts: h.state().task!.workspace!.attempts.length, cells: q(h, '[data-unit-cell]').length };
  h.dispatch('pull_lever', { lever: 'unit_cells' });
  expect({ levers: levers(h), attempts: h.state().task!.workspace!.attempts.length, cells: q(h, '[data-unit-cell]').length }).toEqual(before);

  h.say('seven'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['unit_cells'] });
  h.close();
});

it('equality total: two_blocks opens an ungraded two-weight scale, then the full total comes back blank and is credited', () => {
  const h = mount('equality', ch('equality', [x()], [{ value: 7 }], 7), ch('equality', [x()], [{ value: 9 }], 9));
  hands(h, 'Add 3 weight', 'Add 3 weight', 'Add 1 weight');
  const full = h.state().task!.itemId;
  h.say('nine'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'two_blocks' });
  const task = h.state().task!;
  expect(task.itemId).toBe(`${full}~simpler`);
  expect(task.workspace!.practice).toEqual({ returnsTo: full });
  expect(task.workspace!.expectedAnswer).toBe('6');
  expect(q(h, '[aria-label^="Remove "]').map(b => b.getAttribute('aria-label'))).toEqual(['Remove 5 weight, block -1', 'Remove 1 weight, block -2']);
  h.say('five'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  expect(q(h, '[aria-label^="Remove "]')).toHaveLength(2);
  h.say('six'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  expect(q(h, '[aria-label^="Remove "]')).toHaveLength(3);
  expect(h.view.container.textContent).toMatch(/Say the total/);
  h.say('seven'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!a.practice])).toEqual([['balance-1-build', true, false],
    [full, false, false], [`${full}~simpler`, false, true], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['two_blocks'] });
  h.close();
});

it('one_step added: the part-whole bar labels the whole and the known part, never the missing one', () => {
  const h = mount('one_step', ch('one_step', [x(), { value: 3 }], [{ value: 10 }], 7), ch('one_step', [x(), { value: 2 }], [{ value: 6 }], 4));
  hands(h, 'Add 5 weight', 'Add 2 weight');
  expect(h.state().task!.itemId).toBe('workshop-1-added');
  expect(levers(h)).toEqual([['part_whole_bar', false], ['unit_cells', false], ['smaller_load', false]]);
  h.dispatch('pull_lever', { lever: 'part_whole_bar' });
  const bar = q(h, '[data-lever="part-whole"]')[0];
  expect(bar.getAttribute('aria-label')).toBe('A bar for 10, split into 3 and an unlabelled part');
  expect(bar.textContent).toBe('103?');
  expect(String(h.state().task!.demand.onScreen)).toMatch(/right side's 10 is split into the left's known 3 and an unlabelled part/);
  h.say('seven'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ assisted: true, levers: ['part_whole_bar'] });
  h.close();
});

it('one_step_hard each: one_group rings group 1; fewer_parcels opens two parcels of a smaller share, then the full item', () => {
  const h = mount('one_step_hard', ch('one_step_hard', [x(3)], [{ value: 12 }], 4), ch('one_step_hard', [x(2)], [{ value: 10 }], 5));
  hands(h, ...[1, 2, 3].flatMap(g => Array(4).fill(`Place unit in group ${g}`)));
  const full = h.state().task!.itemId;
  expect(full).toBe('workshop-1-each');
  expect(levers(h)).toEqual([['one_group', false], ['fewer_parcels', false]]);
  h.say('twelve'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'one_group' });
  expect(q(h, '[data-lever="one-group"]').map(s => s.getAttribute('aria-label'))).toEqual(['Parcel group 1']);
  expect(q(h, '[data-lever="faded"]')).toHaveLength(2);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/Group 1 and its parcel are ringed/);
  expect(JSON.stringify(h.state().task!.demand.onScreen)).not.toMatch(/\b4\b/);
  h.dispatch('pull_lever', { lever: 'fewer_parcels' });
  expect(h.state().task!).toMatchObject({ itemId: `${full}~simpler` });
  expect(h.state().task!.workspace!.expectedAnswer).toBe('3');
  expect(q(h, '[aria-label^="Parcel group"]')).toHaveLength(2);
  // The practice step is not the learner's item: its levers are gone while it is open.
  expect(levers(h)).toEqual([]);
  h.say('three'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  expect(q(h, '[aria-label^="Parcel group"]')).toHaveLength(3);
  h.say('four'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: full, correct: true, assisted: true,
    levers: ['one_group', 'fewer_parcels'] });
  h.close();
});

it('two_step_intro remaining: on_scale_only fades the set-aside areas and outlines the parcels together', () => {
  const h = mount('two_step_intro', ch('two_step_intro', [x(2), { value: 1 }], [{ value: 7 }], 3), ch('two_step_intro', [x(2), { value: 2 }], [{ value: 12 }], 5));
  hands(h, 'Set aside known 1 weight', 'Unit 1');
  expect(h.state().task!.itemId).toBe('workshop-1-remaining');
  expect(levers(h)).toEqual([['on_scale_only', false], ['fewer_parcels', false]]);
  h.dispatch('pull_lever', { lever: 'on_scale_only' });
  expect(q(h, '[data-lever="parcels-together"]')).toHaveLength(1);
  expect(q(h, '[data-lever="faded"]').map(s => s.getAttribute('aria-label'))).toEqual(['Known weights set aside']);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\b6\b/);
  h.close();
});
