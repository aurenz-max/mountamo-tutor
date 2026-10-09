// @vitest-environment jsdom
/**
 * bar-model levers (`barModelLevers.ts`) on the modes other than make_graph, mounted the way a lesson mounts it: a help
 * pull changes the graph and the scene fact in one commit and the next attempt records it; a refused pull changes
 * nothing; an easier graph is ungraded, keeps itself on Try again, and gives the full graph back unanswered, which is
 * then credited with the levers recorded.
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
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { BarModelChallenge } from './BarModel';

beforeEach(() => { installRuntimeTimers(); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) }))); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const ROWS = [{ label: 'Blocks', value: 8, emoji: '🧱' }, { label: 'Bears', value: 3, emoji: '🧸' }, { label: 'Balls', value: 6, emoji: '⚽' }];
const mount = (mode: string, ...challenges: object[]) => mountWorkspace({ primitiveId: 'bar-model', evalMode: mode,
  data: { title: 'Our toys', description: '', challenges }, instanceId: 'graph' });
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const read = (id: string, extra: Partial<BarModelChallenge> = {}): BarModelChallenge => ({ id, evalMode: 'read_one_to_one',
  graphStyle: 'picture', values: ROWS, scale: { step: 1, max: 8, iconValue: 1 }, prompt: 'How many blocks are in the toy bin?',
  expectedValue: 8, options: [7, 8, 9, 10], targetBarIndex: 0, showTargetHighlight: false, ...extra });

it('read_one_to_one: a miss, then group_fives draws the gaps and states them in one commit; a refused pull changes nothing', () => {
  const h = mount('read_one_to_one', read('g1'));
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['mark_row', 'help', false], ['group_fives', 'help', false],
    ['simpler_graph', 'simplify', false]]);
  expect(q(h, '[data-five-gap]')).toHaveLength(0);
  h.press('7');
  expect(last(h)).toMatchObject({ correct: false, miss: 'one_short' });
  expect(observerLever(h.state(), true)).toBe('group_fives');
  const receipt = h.dispatch('pull_lever', { lever: 'group_fives' });
  expect(receipt.status).toBe('committed');
  // The two long rows (8 and 6 pictures) each get one gap after the fifth picture; no number is written.
  expect(q(h, '[data-five-gap]')).toHaveLength(2);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/gap after every fifth picture/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d/);

  const before = { screen: h.view.container.innerHTML, levers: JSON.stringify(levers(h)), attempts: h.state().task!.workspace!.attempts.length };
  expect(h.dispatch('pull_lever', { lever: 'group_fives' }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: 'no_such_lever' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before.screen);
  expect(JSON.stringify(levers(h))).toBe(before.levers);
  expect(h.state().task!.workspace!.attempts).toHaveLength(before.attempts);

  h.dispatch('pull_lever', { lever: 'mark_row' });
  expect(q(h, '.border-amber-400')).toHaveLength(1);
  h.dispatch('retry');
  h.press('8');
  expect(last(h)).toMatchObject({ itemId: 'g1', correct: true, assisted: true, levers: ['group_fives', 'mark_row'] });
  h.close();
});

it('read_one_to_one: the easier graph is ungraded, keeps itself on Try again, and the full graph comes back unanswered', () => {
  const h = mount('read_one_to_one', read('g1'), read('g2', { targetBarIndex: 2, expectedValue: 6, options: [5, 6, 7, 8], prompt: 'How many balls?' }));
  h.press('9');
  h.dispatch('pull_lever', { lever: 'simpler_graph' });
  expect(h.state().task).toMatchObject({ itemId: 'g1~simpler', task: 'How many blocks are in the toy bin?' });
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: 'g1' });
  expect(levers(h)).toEqual([]);
  expect(q(h, '[data-practice-graph]')).toHaveLength(1);
  // Two rows: blocks (4 pictures) and bears; the easier graph's choices are its own.
  expect(q(h, '[data-pip-object^="row-"]')).toHaveLength(2);
  h.press('5');
  expect(last(h)).toMatchObject({ itemId: 'g1~simpler', correct: false });
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('g1~simpler');
  expect(q(h, '[data-pip-object^="row-"]')).toHaveLength(2);
  h.press('4');
  expect(last(h)).toMatchObject({ itemId: 'g1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('g1');
  expect(q(h, '[data-pip-object^="row-"]')).toHaveLength(3);
  expect(q(h, '[data-practice-graph]')).toHaveLength(0);
  expect(h.view.container.textContent).not.toContain("That's correct.");
  h.press('8');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['g1', false, false], ['g1~simpler', false, true], ['g1~simpler', true, true], ['g1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['simpler_graph'] });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('g2');
  expect(levers(h).every(l => !l.pulled || l.id === 'mark_row')).toBe(true);
  h.close();
});

it('build_one_to_one: sort_pile sorts the pile in place; the two-kind practice chart keeps its stickers apart from the full chart', () => {
  const pile = [1, 0, 1, 2, 1, 0, 0, 2, 0].map(k => ({ emoji: ROWS[k].emoji, categoryIndex: k }));
  const h = mount('build_one_to_one', { id: 'g1', evalMode: 'build_one_to_one', graphStyle: 'picture', prompt: 'Put one sticker in a row for each toy.',
    values: ROWS.map(r => ({ ...r, value: 0 })), scale: { step: 1, max: 6, iconValue: 1 }, sourceItems: pile, sourceScattered: true,
    expectedCounts: [4, 3, 2] });
  h.press('Blocks row'); h.press('Check my chart');
  expect(last(h)).toMatchObject({ correct: false, miss: 'several_rows_off' });
  const receipt = h.dispatch('pull_lever', { lever: 'sort_pile' });
  expect(q(h, '[data-pile-line]')).toHaveLength(3);
  expect(Array.from(q(h, '[data-pile-line]')).map(l => l.textContent)).toEqual(['🧱🧱🧱🧱', '🧸🧸🧸', '⚽⚽']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/pile is sorted/);
  h.dispatch('retry');
  h.dispatch('pull_lever', { lever: 'simpler_graph' });
  expect(h.state().task!.itemId).toBe('g1~simpler');
  expect(q(h, '[data-pip-object^="row-"]')).toHaveLength(2);
  expect(q(h, '[data-pile-line]')).toHaveLength(0);
  for (const _ of [1, 2, 3]) h.press('Blocks row');
  for (const _ of [1, 2]) h.press('Bears row');
  h.press('Check my chart');
  expect(last(h)).toMatchObject({ itemId: 'g1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('g1');
  expect(h.state().task!.demand.learnerWork).toBe('Stickers placed: Blocks 0, Bears 0, Balls 0');
  for (const [row, n] of [['Blocks', 4], ['Bears', 3], ['Balls', 2]] as const) for (let i = 0; i < n; i++) h.press(`${row} row`);
  h.press('Check my chart');
  expect(last(h)).toMatchObject({ itemId: 'g1', correct: true, assisted: true, levers: ['sort_pile', 'simpler_graph'] });
  h.close();
});

it('build_graph: step_marks is refused before a bar is set and changes nothing; then it counts marks to the learner\'s tallest bar', () => {
  const h = mount('build_graph', { id: 'g1', evalMode: 'build_graph', graphStyle: 'scaled_bar', scale: { step: 2, max: 20 },
    prompt: 'Build the graph: Lions=12, Zebras=8.', values: [{ label: 'Lions', value: 0 }, { label: 'Zebras', value: 0 }],
    expectedDataset: [{ label: 'Lions', value: 12 }, { label: 'Zebras', value: 8 }], expectedScaleStep: 2, availableScaleSteps: [1, 2, 5] });
  const before = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'step_marks' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before);
  expect(levers(h).find(l => l.id === 'step_marks')!.pulled).toBe(false);
  for (let i = 0; i < 10; i++) h.press('Increase Lions');
  const receipt = h.dispatch('pull_lever', { lever: 'step_marks' });
  expect(receipt.status).toBe('committed');
  expect(Array.from(q(h, '[data-lever="step-marks"]')).map(e => e.textContent)).toEqual(['10 marks', '5 marks', '2 marks']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/step 2, 5 marks/);
  h.dispatch('pull_lever', { lever: 'data_beside' });
  expect(Array.from(q(h, '[data-lever="data-beside"]')).map(e => e.textContent)).toEqual(['(12)', '(8)']);
  // The step buttons keep their own names.
  h.press('Step of 2');
  h.close();
});

it('match_to_bar: pile_row draws the group as a row in the graph\'s columns, unmarked; compare_two_graphs pairs the rows', () => {
  const h = mount('match_to_bar', { id: 'g1', evalMode: 'match_to_bar', graphStyle: 'picture', prompt: 'Which row shows the same number?',
    values: [{ label: 'Emma', value: 6, emoji: '🧱' }, { label: 'Noah', value: 7, emoji: '🧱' }, { label: 'Mia', value: 3, emoji: '🧱' }],
    scale: { step: 1, max: 7, iconValue: 1 }, sourceItems: Array.from({ length: 6 }, () => ({ emoji: '🧱', categoryIndex: 0 })),
    stimulusCount: 6, targetBarIndex: 0 });
  h.press('Noah row');
  expect(last(h)).toMatchObject({ correct: false, miss: 'one_over' });
  const receipt = h.dispatch('pull_lever', { lever: 'pile_row' });
  const row = q(h, '[data-lever="pile-row"]')[0];
  expect(row.textContent!.match(/🧱/g)).toHaveLength(6);
  expect(row.querySelector('button')!.hasAttribute('disabled')).toBe(true);
  expect(q(h, '.border-amber-400')).toHaveLength(0);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d|Emma/);
  h.close();

  const g = mount('compare_two_graphs', { id: 'g2', evalMode: 'compare_two_graphs', graphStyle: 'picture', prompt: 'Tell me one thing that changed.',
    values: ROWS.slice(0, 2), secondValues: [{ ...ROWS[0], value: 2 }, ROWS[1]], graphLabel: 'Morning', secondGraphLabel: 'Afternoon',
    scale: { step: 1, max: 8, iconValue: 1 }, comparisonFocus: 'different' });
  expect(levers(g).map(l => l.id)).toEqual(['pair_rows', 'word_model']);
  expect(g.view.container.textContent).toContain('Afternoon');
  const paired = g.dispatch('pull_lever', { lever: 'pair_rows' });
  expect(q(g, '[data-lever="pair-rows"]')).toHaveLength(1);
  expect(Array.from(q(g, '[data-pip-object^="row-"]')).map(r => r.textContent!.replace(/[^A-Za-z: ]/g, '').trim())).toEqual(
    ['Blocks: Morning', 'Blocks: Afternoon', 'Bears: Morning', 'Bears: Afternoon']);
  expect(String(paired.state.task!.demand.onScreen)).toMatch(/Morning above Afternoon/);
  g.dispatch('pull_lever', { lever: 'word_model' });
  expect(q(g, '[data-lever="word-model"]')[0].textContent).toBe('more⭐⭐⭐⭐⭐fewer⭐⭐');
  g.close();
});

it('scaled_bar_graph: the guide line and the unlabelled marks are drawn, and the numbered ticks stay as they were', () => {
  const h = mount('scaled_bar_graph', { id: 'g1', evalMode: 'scaled_bar_graph', graphStyle: 'scaled_bar', prompt: 'How many chose swings?',
    values: [{ label: 'Slides', value: 10 }, { label: 'Swings', value: 14 }], scale: { step: 5, max: 20 }, targetBarIndex: 1,
    expectedValue: 14, options: [9, 14, 19, 24], showBarValues: false });
  const ticks = () => Array.from(q(h, '.font-mono.text-slate-400')).map(t => t.textContent);
  const numbered = ticks();
  h.dispatch('pull_lever', { lever: 'guide_line' });
  expect((q(h, '[data-lever="guide-line"]')[0] as HTMLElement).style.left).toBe('70%');
  h.dispatch('pull_lever', { lever: 'minor_ticks' });
  expect(q(h, '[data-lever="minor-tick"]')).toHaveLength(16);
  expect(ticks()).toEqual(numbered);
  h.press('14');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: ['guide_line', 'minor_ticks'] });
  h.close();
});
