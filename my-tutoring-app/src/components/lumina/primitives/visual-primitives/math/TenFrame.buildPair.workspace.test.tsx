// @vitest-environment jsdom
/**
 * ten-frame `build_pair` (open build, math wave 3) mounted the way a lesson mounts it: an empty frame, two colours,
 * "I'm done!" commits (no stillness check), the frame's code judges total, both colours and a new pair, Try again
 * keeps the build, the made pair reaches the tutor as numbers, and the levers start bare.
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

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const mount = (totals: number[]) => mountWorkspace({ primitiveId: 'ten-frame', evalMode: 'build_pair', instanceId: 'frame',
  data: { title: 'Frame', gradeBand: 'K', mode: 'single',
    showOptions: { showCount: true, showEquation: false, showEmptyCount: false, allowFlip: false },
    challenges: totals.map((t, i) => ({ id: `c${i}`, type: 'build_pair', targetCount: t, instruction: 'Make it.', hint: '', narration: '' })) } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const counters = (h: WorkspaceHarness) => q(h, '[data-pip-object="frame"] circle').map(c => c.getAttribute('fill'));
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const place = (h: WorkspaceHarness, colour: 'Red' | 'Yellow', cells: number[]) => {
  h.press(`${colour} counters`);
  for (const c of cells) h.touch(`cell-${c}`);
};

it('opens empty, with bare levers, no count and no stillness commit', () => {
  const h = mount([5, 5]);
  expect(counters(h)).toHaveLength(0);
  expect(levers(h)).toEqual([['running_count', false], ['split_model', false], ['smaller_total', false]]);
  expect(String(h.state().task!.task)).toMatch(/Make five with red and yellow counters/);
  place(h, 'Red', [0, 1, 2]);
  place(h, 'Yellow', [3, 4]);
  h.settle(8000);
  // Still open: only "I'm done!" commits an open build.
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(q(h, '[data-lever="running-count"]')).toHaveLength(0);
  expect(h.view.container.textContent).not.toMatch(/\b3 \+ 2\b/);
  expect(demand(h)).toMatchObject({ kind: 'build_pair', countersOnFrame: 5, redOnFrame: 3, yellowOnFrame: 2 });
  h.close();
});

it('one over, then Try again keeps the build; taking one off passes; workHistory records the turn back', () => {
  const h = mount([5, 5]);
  place(h, 'Red', [0, 1, 2]);
  place(h, 'Yellow', [3, 4, 5]);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: false, miss: 'one_over' });
  h.dispatch('retry');
  expect(counters(h)).toHaveLength(6);
  h.settle(2000); // a learner change, not part of the host's retry
  h.touch('cell-5');
  expect(String(demand(h).workHistory)).toMatch(/countersOnFrame 0 → 6 → 5/);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: true });
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ response: '3 red and 2 yellow on the frame (5 counters)' });
  h.close();
});

it('one colour is a miss; the same pair on the repeated total is a miss while another pair remains', () => {
  const h = mount([4, 4]);
  place(h, 'Red', [0, 1, 2, 3]);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: false, miss: 'one_colour' });
  h.dispatch('retry');
  h.touch('cell-3');
  place(h, 'Yellow', [3]);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: true });
  h.dispatch('advance');
  // The next item on four opens empty and asks for a different way.
  expect(counters(h)).toHaveLength(0);
  expect(String(h.state().task!.task)).toMatch(/DIFFERENT way/);
  place(h, 'Red', [0, 1, 2]);
  place(h, 'Yellow', [3]);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: false, miss: 'same_way_again' });
  expect(levers(h)).toContainEqual(['ways_shown', false]);
  h.dispatch('pull_lever', { lever: 'ways_shown' });
  expect(q(h, '[data-lever="ways-shown"]')).toHaveLength(1);
  h.dispatch('retry');
  h.touch('cell-2');
  place(h, 'Yellow', [2]);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: true });
  h.close();
});

it('the count lever shows the whole, never the parts; the smaller total opens an empty frame', () => {
  const h = mount([7, 7]);
  place(h, 'Red', [0, 1, 2]);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ miss: 'short_by_more' });
  h.dispatch('pull_lever', { lever: 'running_count' });
  expect(q(h, '[data-lever="running-count"]')[0].textContent).toMatch(/Counters:\s*3/);
  expect(String(demand(h).onScreen)).toMatch(/both colours together/);
  h.dispatch('pull_lever', { lever: 'smaller_total' });
  expect(h.state().task).toMatchObject({ itemId: 'c0~smaller' });
  expect(counters(h)).toHaveLength(0);
  expect(String(h.state().task!.task)).toMatch(/Make four/);
  h.close();
});
