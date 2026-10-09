// @vitest-environment jsdom
/**
 * periodic-table levers (`periodicTableLevers.ts`), mounted the way a lesson mounts it: a help pull changes the table
 * and the scene fact in one commit and is recorded on the next attempt; a refused pull changes nothing; the simpler
 * item is ungraded, the full item comes back blank after it, and only the full item's answer is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../components/live-activity/runtime/testing/workspaceHarness';
import { AXIS_LEVER, COLUMN_LEVER, KEY_LEVER, PAIR_LEVER, SIMPLER_LEVER, TALL_LEVER } from './chemistry-primitives/periodicTableLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const mount = (mode: string, challenges: any[], supportTier: 'easy' | 'medium' | 'hard' = 'medium') => mountWorkspace({
  primitiveId: 'periodic-table', evalMode: mode, data: { title: 'The Periodic Table', challenges, supportTier }, instanceId: 'periodic-table' });
const tap = (h: WorkspaceHarness, name: string) => h.touch(`element-${name}`);
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts
  .map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice]);
const frozen = (h: WorkspaceHarness) => {
  const t = h.state().task!;
  return JSON.stringify({ demand: t.demand, levers: t.workspace!.levers, attempts: t.workspace!.attempts, html: h.view.container.innerHTML });
};
/** A spoken answer the observer reads as right or wrong. */
const answer = (h: WorkspaceHarness, text: string, verdict: 'correct' | 'incorrect') => { h.say(text); h.feedback(verdict); };

const BARIUM = [{ id: 'f1', challengeType: 'explore', findBy: 'position', targetNumber: 56 }];

it('Element Hunt: a wrong tap, then the axis marks: rung numbers and their fact in one commit; a refused pull changes nothing', () => {
  const h = mount('explore', BARIUM);
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([[AXIS_LEVER, 'help', false], [SIMPLER_LEVER, 'simplify', false]]);
  expect(q(h, '[data-axis-mark]')).toHaveLength(0);
  tap(h, 'calcium');
  expect(last(h)).toMatchObject({ itemId: 'f1', correct: false, miss: 'same_column' });
  const receipt = h.dispatch('pull_lever', { lever: AXIS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(Array.from(q(h, '[data-axis-mark]')).map(el => [el.getAttribute('data-axis-mark'), el.textContent?.trim()]))
    .toEqual([['group', '2'], ['period', '6']]);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/group number 2 at the top and the period number 6 at the side are ringed; no box is marked/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/barium/i);
  expect(q(h, '[data-ringed], [data-lit]')).toHaveLength(0);
  const before = frozen(h);
  expect(h.dispatch('pull_lever', { lever: AXIS_LEVER }).status).toBe('blocked');
  expect(frozen(h)).toBe(before);
  h.dispatch('retry'); h.confirmVisible();
  tap(h, 'barium');
  expect(last(h)).toMatchObject({ itemId: 'f1', correct: true, assisted: true, levers: [AXIS_LEVER] });
  h.close();
});

it('Element Hunt: the simpler item is a find in the first two rows, ungraded; the full item comes back blank and is credited', () => {
  const h = mount('explore', BARIUM);
  tap(h, 'radium');
  const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.state().task).toMatchObject({ itemId: 'f1~simpler' });
  expect(h.state().task!.task).toMatch(/group 1, period 2/);
  expect(h.state().task!.demand.practice).toBeTruthy();
  expect(q(h, '[data-practice]')).toHaveLength(1);
  expect(q(h, '.ring-red-400')).toHaveLength(0);
  expect(levers(h)).toEqual([]);
  tap(h, 'beryllium');
  expect(last(h)).toMatchObject({ itemId: 'f1~simpler', correct: false });
  h.dispatch('retry'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'f1~simpler' });
  tap(h, 'lithium');
  expect(last(h)).toMatchObject({ itemId: 'f1~simpler', correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'f1' });
  expect(q(h, '[data-practice]')).toHaveLength(0);
  expect(q(h, '.ring-red-400, .ring-emerald-400')).toHaveLength(0);
  tap(h, 'barium');
  expect(attempts(h)).toEqual([['f1', false, false], ['f1~simpler', false, true], ['f1~simpler', true, true], ['f1', true, false]]);
  expect(last(h)).toMatchObject({ assisted: true, levers: [SIMPLER_LEVER] });
  h.close();
});

const IRON = [{ id: 'n1', challengeType: 'identify', clueBy: 'symbol', targetNumber: 26 }];

it('Name It: the box key is another element\'s box, labelled, drawn with its fact; the next answer records it', () => {
  const h = mount('identify', IRON);
  expect(levers(h).map(l => l.id)).toEqual(['letter_lit', KEY_LEVER, SIMPLER_LEVER]);
  answer(h, 'F e', 'incorrect');
  const receipt = h.dispatch('pull_lever', { lever: KEY_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="box-key"]')).toHaveLength(1);
  expect(q(h, '[data-lever="box-key"]')[0].textContent).toMatch(/Cu.*Copper.*atomic number.*symbol.*name/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/a key: Copper's box.*It is not this item's element/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/iron/i);
  const before = frozen(h);
  expect(h.dispatch('pull_lever', { lever: KEY_LEVER }).status).toBe('blocked');
  expect(frozen(h)).toBe(before);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'iron', 'correct');
  expect(last(h)).toMatchObject({ itemId: 'n1', correct: true, assisted: true, levers: [KEY_LEVER] });
  h.close();
});

it('Name It: the simpler item is spoken practice in the first two rows; the full item comes back and is credited', () => {
  const h = mount('identify', IRON);
  answer(h, 'cobalt', 'incorrect');
  const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.state().task).toMatchObject({ itemId: 'n1~simpler' });
  expect(h.state().task!.task).toMatch(/symbol is L, i/);
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^"Lithium"/);
  answer(h, 'lithium', 'correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'n1' });
  answer(h, 'iron', 'correct');
  expect(attempts(h)).toEqual([['n1', false, false], ['n1~simpler', true, true], ['n1', true, false]]);
  expect(last(h)).toMatchObject({ assisted: true, levers: [SIMPLER_LEVER] });
  h.close();
});

const TRENDS = [{ id: 't1', challengeType: 'trend', axis: 'size', pairNumbers: [3, 19] },
  { id: 't2', challengeType: 'trend', axis: 'valence', targetNumber: 15 }];

it('Trends, size: the model column of another group and the ringed pair, each with its fact, never which is bigger', () => {
  const h = mount('trend', TRENDS);
  expect(levers(h).map(l => l.id)).toEqual([COLUMN_LEVER, PAIR_LEVER]);
  answer(h, 'lithium', 'incorrect');
  const receipt = h.dispatch('pull_lever', { lever: COLUMN_LEVER });
  expect(receipt.status).toBe('committed');
  expect(Array.from(q(h, '[data-model-atom]')).map(el => el.getAttribute('data-model-atom')))
    .toEqual(['Carbon', 'Silicon', 'Germanium', 'Tin', 'Lead']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/model column of group 14 \(not this pair's group\)/);
  h.dispatch('pull_lever', { lever: PAIR_LEVER });
  expect(Array.from(q(h, '[data-ringed]')).map(el => el.getAttribute('data-pip-object'))).toEqual(['element-lithium', 'element-potassium']);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/bigger|lower|more reactive/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'potassium', 'correct');
  expect(last(h)).toMatchObject({ itemId: 't1', correct: true, assisted: true, levers: [COLUMN_LEVER, PAIR_LEVER] });
  h.close();
});

it('Trends, outer electrons: the middle block dims; the simpler item is a group 1 or 2 count, then the full item', () => {
  const h = mount('trend', TRENDS);
  answer(h, 'potassium', 'correct'); h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 't2' });
  answer(h, 'fifteen', 'incorrect');
  h.dispatch('pull_lever', { lever: TALL_LEVER });
  const dimmed = Array.from(q(h, '[data-dimmed]')).map(el => el.getAttribute('data-pip-object'));
  expect(dimmed).toContain('element-iron');
  expect(dimmed).not.toContain('element-phosphorus');
  expect(String(h.state().task!.demand.onScreen)).toMatch(/groups 3 to 12\) is dimmed/);
  h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
  // Lithium is in the session's first item, so the practice count is beryllium's.
  expect(h.state().task).toMatchObject({ itemId: 't2~simpler' });
  expect(h.state().task!.task).toMatch(/Find Beryllium/);
  expect(q(h, '[data-dimmed]')).toHaveLength(0);
  answer(h, 'two', 'correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 't2' });
  expect(q(h, '[data-dimmed]').length).toBeGreaterThan(0);
  answer(h, 'five', 'correct');
  expect(last(h)).toMatchObject({ itemId: 't2', correct: true, assisted: true, levers: [TALL_LEVER, SIMPLER_LEVER] });
  h.close();
});

it('easy starts with the help on screen, and that is not a pull', () => {
  const h = mount('explore', BARIUM, 'easy');
  expect(levers(h).find(l => l.id === AXIS_LEVER)!.pulled).toBe(true);
  expect(q(h, '[data-axis-mark]')).toHaveLength(2);
  tap(h, 'barium');
  expect(last(h)).toMatchObject({ correct: true });
  expect(last(h)!.levers).toBeUndefined();
  h.close();
});
