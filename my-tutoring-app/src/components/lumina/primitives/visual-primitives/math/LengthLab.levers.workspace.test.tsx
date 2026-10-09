// @vitest-environment jsdom
/**
 * length-lab levers, mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one commit
 * and draws no number; the next attempt records the lever; a refused pull changes nothing; a simpler item is ungraded
 * practice of the same mode and the full item comes back blank and is credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { LengthLabChallenge } from './LengthLab';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const base = { hint: '', narration: '', objectColor0: '#f00', objectColor1: '#0f0' };
const lab = (challenges: LengthLabChallenge[]) => ({ title: 'Lengths', description: '', unitType: 'cubes', gradeBand: 'K', challenges });
const mount = (mode: LengthLabChallenge['type'], challenges: LengthLabChallenge[]) => {
  const h = mountWorkspace({ primitiveId: 'length-lab', evalMode: mode, data: lab(challenges) });
  h.settle(2000);
  return h;
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const add = (h: WorkspaceHarness, unit: string, n: number) => { for (let i = 0; i < n; i++) h.press(`Add ${unit}`); };
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const COMPARE: LengthLabChallenge = { ...base, id: 'c1', type: 'compare', instruction: 'Which is longer?', objectName0: 'pencil',
  objectLength0: 6, objectName1: 'crayon', objectLength1: 5, correctAnswer: 'longer' };
const TILE: LengthLabChallenge = { ...base, id: 't1', type: 'tile_and_count', instruction: 'How many cubes long is the straw?',
  objectName0: 'straw', objectLength0: 8, objectName1: 'placeholder', objectLength1: 1, correctAnswer: '8', correctUnitCount: 8, unitType: 'cubes' };

it('compare: the word model shows in the same commit, its fact draws no number or object, the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('compare', [COMPARE]);
  expect(levers(h)).toEqual([['word_model', false], ['end_lines', false], ['unit_marks', false], ['far_pair', false]]);
  h.press('pencil is shorter');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'reversed' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'reversed')).toBe('word_model');
  expect(q(h, '[data-lever="word-model"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'word_model' });
  expect(receipt.status).toBe('committed');
  const onScreen = String(receipt.state.task!.demand.onScreen);
  expect(onScreen).toMatch(/tagged longer/);
  expect(onScreen).not.toMatch(/\d|pencil|crayon/);
  expect(q(h, '[data-lever="word-model"]')).toHaveLength(1);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'word_model' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  h.press('pencil is longer');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'c1', correct: true, levers: ['word_model'] });
});

it('compare: end lines and unit marks draw on the bars', () => {
  const h = mount('compare', [COMPARE]);
  h.press('They are the same length');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'said_same' });
  h.dispatch('pull_lever', { lever: 'end_lines' });
  expect(q(h, '[data-lever="end-line"]')).toHaveLength(2);
  h.dispatch('pull_lever', { lever: 'unit_marks' });
  expect(h.state().task!.demand).toMatchObject({ unitMarks: 'shown: each bar is split into unit cells' });
});

it('compare: the far pair is ungraded practice of the same mode; the full item comes back and is credited after', () => {
  const h = mount('compare', [COMPARE]);
  h.press('They are the same length');
  const receipt = h.dispatch('pull_lever', { lever: 'far_pair' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('c1~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'c1' });
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/pencil|crayon/);
  // The practice pair's first object is the short one (the item's answer was "longer").
  h.press('blue ribbon is shorter');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c1');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No choice yet' });
  h.press('pencil is longer');
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['c1', false, false], ['c1~simpler', true, true], ['c1', true, false]]);
});

it('tile: the outline sits behind the units and names no count; the shorter object is practice, then the full item', () => {
  const h = mount('tile_and_count', [TILE]);
  expect(levers(h)).toEqual([['object_outline', false], ['shorter_object', false]]);
  add(h, 'cubes', 9); h.press('Check');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'one_over' });
  expect(h.dispatch('pull_lever', { lever: 'object_outline' }).status).toBe('committed');
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  h.dispatch('retry');
  expect(q(h, '[data-lever="object-outline"]')).toHaveLength(1);
  const r = h.dispatch('pull_lever', { lever: 'shorter_object' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('t1~simpler');
  expect(q(h, '[data-lever="object-outline"]')).toHaveLength(0);
  add(h, 'cubes', 4); h.press('Check');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('t1');
  add(h, 'cubes', 8); h.press('Check');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 't1', correct: true });
});

it('estimate: the outline is refused before the guess, with nothing changed', () => {
  const h = mount('estimate_then_tile', [{ ...TILE, id: 'e1', type: 'estimate_then_tile', estimateOptions: [7, 8, 9, 10] }]);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'object_outline' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.press('7');
  expect(h.dispatch('pull_lever', { lever: 'object_outline' }).status).toBe('committed');
  expect(q(h, '[data-lever="object-outline"]')).toHaveLength(1);
});

it('two units, order and indirect: each model or picture shows on its own mode', () => {
  const u = mount('two_unit_compare', [{ ...base, id: 'u1', type: 'two_unit_compare', instruction: 'Measure twice.', objectName0: 'straw',
    objectLength0: 6, objectName1: 'placeholder', objectLength1: 1, correctAnswer: 'cubes', unitType: 'cubes', correctUnitCount: 6,
    unitTypeB: 'bears', correctUnitCountB: 2 }]);
  u.dispatch('pull_lever', { lever: 'unit_model' });
  expect(q(u, '[data-lever="unit-model"]')).toHaveLength(1);
  cleanup();
  const o = mount('order', [{ ...base, id: 'o1', type: 'order', instruction: 'Shortest to longest.', objectName0: 'crayon',
    objectLength0: 3, objectName1: 'pencil', objectLength1: 6, objectName2: 'straw', objectLength2: 7, objectColor2: '#00f',
    correctAnswer: 'crayon,pencil,straw', correctOrderCsv: 'crayon,pencil,straw' }]);
  expect(levers(o).map(l => l[0])).toEqual(['order_steps', 'end_lines', 'unit_marks', 'far_three']);
  o.dispatch('pull_lever', { lever: 'order_steps' });
  expect(q(o, '[data-lever="order-step"]')).toHaveLength(3);
  expect(q(o, '[data-lever="order-step"]').every(e => !e.textContent)).toBe(true);
  cleanup();
  const i = mount('indirect', [{ ...base, id: 'i1', type: 'indirect', instruction: 'Which is longer?', objectName0: 'fork',
    objectLength0: 4, objectName1: 'straw', objectLength1: 7, correctAnswer: 'straw', clue0: 'The fork is shorter than the paintbrush.',
    clue1: 'The paintbrush is shorter than the straw.', referenceObjectName: 'paintbrush', referenceObjectLength: 6 }]);
  expect(levers(i)).toEqual([['chain_model', false]]);
  i.dispatch('pull_lever', { lever: 'chain_model' });
  expect(q(i, '[data-lever="chain-model"]')[0].textContent).not.toMatch(/fork|straw|paintbrush/);
});
