// @vitest-environment jsdom
/**
 * The ten-frame levers on decompose, decompose_teen, make_ten, subitize and operate (handoff 32), mounted the way a
 * lesson mounts them. A pull changes the frame or puts a model beside it in the same commit, the scene fact states no
 * answer, a simpler item is ungraded practice that returns to the full item, and only the full item is credited.
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

type Ch = { type: string; targetCount: number; addend1?: number; addend2?: number; startCount?: number };
const data = (gradeBand: 'K' | '1-2', challenges: Ch[]) => ({ title: 'Frame', gradeBand,
  mode: challenges.some(c => c.type.endsWith('_teen')) ? 'double' : 'single',
  showOptions: { showCount: false, showEquation: false, showEmptyCount: false, allowFlip: true },
  challenges: challenges.map((c, i) => ({ id: `c${i}`, instruction: 'Use the frame.', ...c })) });
const mount = (evalMode: string, gradeBand: 'K' | '1-2', challenges: Ch[]) =>
  mountWorkspace({ primitiveId: 'ten-frame', evalMode, data: data(gradeBand, challenges), instanceId: 'frame' });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
/** Counters on the item's own frame (a model frame beside it has circles too). */
const onFrame = (h: WorkspaceHarness) => q(h, '[data-pip-object="frame"] circle').length;
const tapCells = (h: WorkspaceHarness, cells: number[]) => { for (const c of cells) h.touch(`cell-${c}`); h.settle(3500); };
const demand = (h: WorkspaceHarness) => JSON.stringify(h.state().task!.demand);
const credited = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts
  .map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice]);

it('decompose: a model split sits beside the frame; the smaller split is practice and its way never enters the ledger', () => {
  const h = mount('decompose', 'K', [{ type: 'split', targetCount: 5 }, { type: 'split', targetCount: 5 }]);
  expect(levers(h)).toEqual([['split_model', false], ['smaller_total', false]]);
  tapCells(h, [0, 1, 2, 3, 4]);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'all_flipped' });
  expect(observerLever(h.state(), true)).toBe('split_model');
  h.dispatch('pull_lever', { lever: 'split_model' });
  expect(q(h, '[data-lever="model-frame"]')).toHaveLength(1);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/4 red and 2 yellow make 6/);
  h.dispatch('pull_lever', { lever: 'smaller_total' });
  expect(h.state().task).toMatchObject({ itemId: 'c0~smaller' });
  expect(onFrame(h)).toBe(3);
  tapCells(h, [0]);                                                   // 2 red and 1 yellow
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'c0' });
  expect(onFrame(h)).toBe(5);
  tapCells(h, [0, 1]);                                                // 3 red and 2 yellow
  expect(credited(h)).toEqual([['c0', false, false], ['c0~smaller', true, true], ['c0', true, false]]);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ assisted: true, levers: ['split_model', 'smaller_total'] });
  h.dispatch('advance');
  // The same total again: the learner's own way (3+2) can be shown; the practice way (2+1) never entered the ledger.
  expect(levers(h)).toEqual([['split_model', false], ['ways_shown', false], ['smaller_total', false]]);
  h.dispatch('pull_lever', { lever: 'ways_shown' });
  expect(q(h, '[data-lever="ways-shown"]')).toHaveLength(1);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/already showed: 3 red and 2 yellow\.$/);
  h.close();
});

it('decompose_teen: the yellow count and a model ten; the smaller teen is practice, then the full item', () => {
  const h = mount('decompose_teen', 'K', [{ type: 'decompose_teen', targetCount: 14 }]);
  expect(levers(h)).toEqual([['running_count', false], ['ten_model', false], ['smaller_teen', false]]);
  const seeded = Array.from(h.view.container.querySelectorAll('[data-pip-object^="cell-"]'))
    .filter(el => el.nextElementSibling?.tagName === 'circle').map(el => Number(el.getAttribute('data-pip-object')!.slice(5)));
  expect(seeded).toHaveLength(14);
  h.dispatch('pull_lever', { lever: 'running_count' });
  expect(q(h, '[data-lever="running-count"]')[0].textContent).toMatch(/Yellow:\s*0/);
  tapCells(h, seeded.slice(0, 11));
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_over' });
  expect(q(h, '[data-lever="running-count"]')[0].textContent).toMatch(/Yellow:\s*11/);
  h.dispatch('pull_lever', { lever: 'ten_model' });
  expect(q(h, '[data-lever="model-frame"] circle')).toHaveLength(10);
  expect(demand(h)).not.toMatch(/\b4\b|four/);
  h.dispatch('pull_lever', { lever: 'smaller_teen' });
  expect(h.state().task).toMatchObject({ itemId: 'c0~smaller' });
  expect(onFrame(h)).toBe(12);
  h.close();
});

it('make_ten at K: the empty boxes pulse; the near-ten frame is practice the frame checks when full', () => {
  const h = mount('make_ten', 'K', [{ type: 'make_ten', targetCount: 6 }]);
  expect(levers(h)).toEqual([['empty_glow', false], ['near_ten', false]]);
  h.dispatch('pull_lever', { lever: 'empty_glow' });
  expect(q(h, '[data-lever="empty-glow"]')).toHaveLength(4);
  expect(String(h.state().task!.demand.onScreen)).toBe('The empty boxes on the frame pulse.');
  h.dispatch('pull_lever', { lever: 'near_ten' });
  expect(h.state().task).toMatchObject({ itemId: 'c0~smaller' });
  expect(onFrame(h)).toBe(7);
  tapCells(h, [7, 8, 9]);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'c0' });
  expect(onFrame(h)).toBe(6);
  h.close();
});

it('make_ten at grades 1-2: a five-frame model and the five-frame, never the answer; near ten is spoken practice', () => {
  const h = mount('make_ten', '1-2', [{ type: 'make_ten', targetCount: 3 }]);
  expect(levers(h)).toEqual([['fill_model', false], ['five_frame', false], ['near_ten', false]]);
  h.say('three'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'fill_model' });
  expect(q(h, '[data-lever="model-frame"]')[0].textContent).toMatch(/4 and 1 more make 5/);
  h.dispatch('pull_lever', { lever: 'five_frame' });
  expect(q(h, '[data-lever="five-frame"]')).toHaveLength(1);
  expect(demand(h)).not.toMatch(/\b7\b|seven/);
  h.dispatch('pull_lever', { lever: 'near_ten' });
  expect(h.state().task).toMatchObject({ itemId: 'c0~smaller' });
  expect(h.state().task!.workspace!.expectedAnswer).toBe('3');
  h.say('three'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('c0');
  h.say('seven'); h.feedback('correct');
  expect(credited(h)).toEqual([['c0', false, false], ['c0~smaller', true, true], ['c0', true, false]]);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ assisted: true });
  h.close();
});

it('subitize: empty boxes fade, the long look lasts twice as long and still hides; fewer dots is spoken practice', () => {
  const h = mount('subitize', 'K', [{ type: 'subitize', targetCount: 7 }]);
  expect(levers(h)).toEqual([['hide_empty', false], ['five_frame', false], ['longer_look', false], ['fewer_dots', false]]);
  h.dispatch('pull_lever', { lever: 'hide_empty' });
  expect(q(h, '[data-lever="hide-empty"]')).toHaveLength(10);
  h.dispatch('pull_lever', { lever: 'longer_look' });
  expect(q(h, '[data-lever="longer-look"]')).toHaveLength(1);
  expect(demand(h)).not.toMatch(/\b7\b|seven/);
  h.dispatch('present');
  expect(onFrame(h)).toBe(7);
  expect(q(h, '[data-lever="hide-empty"]')).toHaveLength(3);
  h.settle(2000);
  expect(onFrame(h)).toBe(7);                                         // a plain look is gone at 1.5 s
  h.settle(1200);
  expect(onFrame(h)).toBe(0);
  h.dispatch('pull_lever', { lever: 'fewer_dots' });
  expect(h.state().task).toMatchObject({ itemId: 'c0~smaller' });
  expect(h.state().task!.workspace!.expectedAnswer).toBe('4');
  h.close();
});

it('operate: a model problem beside the frame, never this one; smaller numbers is spoken practice', () => {
  const h = mount('operate', '1-2', [{ type: 'add', targetCount: 8, addend1: 5, addend2: 3 },
    { type: 'subtract', targetCount: 4, startCount: 7 }]);
  expect(levers(h)).toEqual([['operation_model', false], ['five_frame', false], ['smaller_numbers', false]]);
  h.say('five'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'operation_model' });
  expect(q(h, '[data-lever="model-frame"]')[0].textContent).toMatch(/3 and 2 make 5/);
  expect(demand(h)).not.toMatch(/\b8\b|eight/);
  h.dispatch('pull_lever', { lever: 'smaller_numbers' });
  expect(h.state().task).toMatchObject({ itemId: 'c0~smaller' });
  expect(h.state().task!.workspace!.expectedAnswer).toBe('5');
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('c0');
  h.say('eight'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(credited(h)).toEqual([['c0', false, false], ['c0~smaller', true, true], ['c0', true, false]]);
  // The take-away: its model crosses counters out on the model, never on the item's frame.
  expect(h.state().task!.itemId).toBe('c1');
  h.dispatch('pull_lever', { lever: 'operation_model' });
  expect(q(h, '[data-lever="model-frame"] path')).not.toHaveLength(0);
  expect(q(h, '[data-pip-object="frame"] path')).toHaveLength(0);
  expect(demand(h)).not.toMatch(/\b4\b|leaves four/);
  h.close();
});
