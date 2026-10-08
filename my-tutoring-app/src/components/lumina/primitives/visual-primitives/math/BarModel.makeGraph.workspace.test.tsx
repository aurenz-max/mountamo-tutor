// @vitest-environment jsdom
/**
 * Bar model's open build (`make_graph`) on the shared teaching workspace, mounted the way a lesson mounts it: the
 * graph starts empty, the learner's bars are published as numbers, "I'm done!" commits the code check, Try again keeps
 * the graph, and the levers start bare and change the graph in the same commit.
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
import { makeGraphAsk, type GraphRule } from './barModelBuild';

beforeEach(() => { installRuntimeTimers(); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) }))); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const LABELS = ['apples', 'pears', 'plums'];
const graph = (id: string, graphRule: GraphRule) => ({ id, evalMode: 'make_graph', graphStyle: 'picture', graphRule,
  prompt: makeGraphAsk(LABELS, graphRule), values: LABELS.map((label, i) => ({ label, value: 0, emoji: ['🍎', '🍐', '🟣'][i] })) });
const data = (...challenges: object[]) => ({ title: 'Our fruit', description: '', instanceId: 'graph', challenges });
const mount = (...challenges: object[]) => mountWorkspace({ primitiveId: 'bar-model', evalMode: 'make_graph', data: data(...challenges), instanceId: 'graph' });

/** Tap column `row` until its bar holds `n` (taps a column to add, the top picture to take one out). */
function setBar(h: WorkspaceHarness, row: number, n: number) {
  const now = () => h.view.container.querySelectorAll(`[data-graph-column="${row}"] [data-graph-picture]`).length;
  while (now() < n) h.touch(`row-${row}`);
  while (now() > n) h.touch(`top-${row}`);
}
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];

it('starts empty, publishes each bar as a number, and judges a tie when "most" was asked; Try again keeps the graph', () => {
  const h = mount(graph('g1', { kind: 'most', a: 0 }), graph('g2', { kind: 'same', a: 1, b: 2 }));
  expect(h.state().task!.task).toBe('Make a graph where apples have the most.');
  expect(h.state().task!.demand).toMatchObject({ kind: 'make_graph', apples: 0, pears: 0, plums: 0, response: 'gesture' });
  expect(h.view.container.querySelectorAll('[data-graph-picture]')).toHaveLength(0);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(Array.from(h.view.container.querySelectorAll('button')).find(b => /I.m done/.test(b.textContent ?? ''))?.disabled).toBe(true);

  setBar(h, 0, 2); setBar(h, 1, 2); setBar(h, 2, 1);
  expect(h.state().task!.demand).toMatchObject({ apples: 2, pears: 2, plums: 1 });
  h.press(/I.m done/);
  expect(last(h)).toMatchObject({ correct: false, miss: 'tied', response: 'Made a graph: apples 2, pears 2, plums 1' });
  expect(h.view.container.textContent).toContain('On your graph apples are tied with pears.');

  h.dispatch('retry');
  expect(h.view.container.querySelectorAll('[data-graph-picture]')).toHaveLength(5);
  expect(h.view.container.textContent).toContain('On your graph apples are tied with pears.');
  h.settle(2000);
  setBar(h, 0, 4); setBar(h, 0, 3);
  // The work history names where the apples bar turned back.
  expect(h.state().task!.demand.workHistory).toBe('apples 0 → 4 → 3');
  h.press(/I.m done/);
  expect(last(h)).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('g2');
  expect(h.view.container.querySelectorAll('[data-graph-picture]')).toHaveLength(0);
  h.close();
});

it('wrong bar highest is other_row; a lever pull draws on the graph in the same commit and states no number the ask needs', () => {
  const h = mount(graph('g1', { kind: 'most', a: 0 }));
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['level_line', 'help', false], ['bar_counts', 'help', false],
    ['two_bars', 'simplify', false]]);
  setBar(h, 0, 3); setBar(h, 1, 5);
  h.press(/I.m done/);
  expect(last(h)).toMatchObject({ correct: false, miss: 'other_row' });
  h.dispatch('pull_lever', { lever: 'level_line' });
  const line = h.view.container.querySelector('[data-lever="level-line"]');
  expect(line?.getAttribute('data-aid')).toBe('level-line');
  expect(h.view.container.querySelectorAll('[data-lever="bar-counts"]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'bar_counts' });
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="bar-counts"]')).map(t => t.textContent)).toEqual(['3', '5', '0']);
  h.dispatch('retry');
  setBar(h, 1, 2);
  h.press(/I.m done/);
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: ['level_line', 'bar_counts'] });
  h.close();
});

it('simplify opens an ungraded two-bar graph with the same ask, then the full graph comes back empty', () => {
  const h = mount(graph('g1', { kind: 'more_than', a: 2, b: 0, by: 2 }));
  setBar(h, 2, 2); setBar(h, 0, 2);
  h.press(/I.m done/);
  expect(last(h)).toMatchObject({ correct: false, miss: 'short_by_more' });
  h.dispatch('pull_lever', { lever: 'two_bars' });
  expect(h.state().task).toMatchObject({ itemId: 'g1~two', task: 'Make a graph where there are two more plums than apples.' });
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: 'g1' });
  expect(h.view.container.querySelectorAll('[data-graph-column]')).toHaveLength(2);
  expect(h.view.container.querySelectorAll('[data-graph-picture]')).toHaveLength(0);
  setBar(h, 0, 1); setBar(h, 1, 3);
  h.press(/I.m done/);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'g1' });
  expect(h.view.container.querySelectorAll('[data-graph-column]')).toHaveLength(3);
  expect(h.view.container.querySelectorAll('[data-graph-picture]')).toHaveLength(0);
  setBar(h, 0, 1); setBar(h, 2, 3);
  h.press(/I.m done/);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['g1', false, false], ['g1~two', true, true], ['g1', true, false]]);
  h.close();
});
