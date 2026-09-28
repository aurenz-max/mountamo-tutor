// @vitest-environment jsdom
/**
 * number-bond on the shared teaching workspace, mounted the way a lesson mounts it (handoff 21 M1): what the
 * screen may show before a try (contract R12), then the in-item levers.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const payload = (mode: string) => JSON.parse(readFileSync(join(process.cwd(),
  `src/components/lumina/components/live-activity/runtime/testing/w1-payloads/number-bond.${mode}.json`), 'utf-8')).data;

it.each(['build_equation', 'fact_family'])('%s: the empty equation entry shows no operator and no number before a try (R12)', (mode) => {
  const h = mountWorkspace({ primitiveId: 'number-bond', evalMode: mode, data: payload(mode), instanceId: 'bond' });
  h.settle();
  h.press('Join the groups');
  h.settle();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  h.settle();
  const entry = h.view.container.querySelector('input[aria-label="Equation keyboard entry"]') as HTMLInputElement | null;
  expect(entry, 'the equation phase is on screen').toBeTruthy();
  expect(entry!.value).toBe('');
  expect(entry!.placeholder).not.toMatch(/[+\-−=]|\d/);
  h.close();
});

// ── The levers ────────────────────────────────────────────────────────────────

const bondData = (challenges: object[], maxNumber = 19) => ({ title: 'Bonds', gradeBand: 'K', maxNumber, showCounters: true,
  showEquation: true, challenges });
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
/** Everything back to the whole, then `left` and `right` through the board's own buttons; the split settles and commits. */
const split = (h: WorkspaceHarness, left: number, right: number) => {
  const placed = Number(h.state().task!.demand.countersInLeftPart ?? 0) + Number(h.state().task!.demand.countersInRightPart ?? 0);
  for (let i = 0; i < placed; i++) h.press('Move counter to whole');
  for (let i = 0; i < left; i++) h.press('Move counter to left');
  for (let i = 0; i < right; i++) h.press('Move counter to right');
  h.settle();
};

it('ten_frame_part lays each part out in a ten-frame outline in the same commit, and states no count', () => {
  const h = mountWorkspace({ primitiveId: 'number-bond', evalMode: 'ten_and_ones', instanceId: 'bond',
    data: bondData([{ id: 't', type: 'ten-and-ones', whole: 14 }]) });
  h.settle();
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['ten_frame_part', 'help', false], ['smaller_teen', 'simplify', false]]);
  split(h, 9, 5);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'ten_one_off' });
  expect(h.view.container.querySelector('[data-lever="ten-frame-part"]')).toBeNull();
  h.dispatch('pull_lever', { lever: 'ten_frame_part' });
  expect(h.view.container.querySelectorAll('[data-lever="ten-frame-part"]')).toHaveLength(2);
  expect(h.state().task!.demand.onScreen).toMatch(/ten-frame outline/);
  h.dispatch('retry'); h.settle();
  split(h, 10, 4);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['ten_frame_part'] });
  h.close();
});

it('smaller_teen is an ungraded split of eleven, then the full teen on a whole board, credited with its lever', () => {
  const h = mountWorkspace({ primitiveId: 'number-bond', evalMode: 'ten_and_ones', instanceId: 'bond',
    data: bondData([{ id: 't', type: 'ten-and-ones', whole: 14 }]) });
  h.settle();
  const full = h.state().task!.itemId;
  split(h, 7, 7);
  h.dispatch('pull_lever', { lever: 'smaller_teen' });
  expect(h.state().task!.itemId).toBe('t~smaller::build');
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: full });
  expect(h.state().task!.demand).toMatchObject({ bondWhole: 11, countersInWhole: 11 });
  split(h, 10, 1);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance'); h.settle();
  expect(h.state().task!.itemId).toBe(full);
  expect(h.state().task!.demand).toMatchObject({ bondWhole: 14, countersInWhole: 14 });
  split(h, 10, 4);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], ['t~smaller::build', true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['smaller_teen'], assisted: true });
  h.close();
});

it('show_move highlights the move button on a related-fact move step', () => {
  const h = mountWorkspace({ primitiveId: 'number-bond', evalMode: 'related_fact', data: payload('related_fact'), instanceId: 'bond' });
  h.settle();
  expect(levers(h).map(l => l.id)).toEqual(['show_move']);
  h.dispatch('pull_lever', { lever: 'show_move' });
  expect(h.view.container.querySelector('[data-lever="show-move"]')).toBeTruthy();
  h.close();
});

it('open_counters opens the tray for the learner; the covered part stays covered and the support is recorded', () => {
  const h = mountWorkspace({ primitiveId: 'number-bond', evalMode: 'missing_part', data: payload('missing_part'), instanceId: 'bond' });
  h.settle();
  expect(levers(h).map(l => l.id)).toEqual(['open_counters']);
  expect(h.view.container.textContent).toContain('Use counters');
  h.dispatch('pull_lever', { lever: 'open_counters' });
  expect(h.view.container.textContent).not.toContain('Use counters');
  expect(h.view.container.querySelector('[aria-label="left counter tray"]')).toBeTruthy();
  expect(h.state().task!.demand.onScreen).toMatch(/covered part stays covered/);
  expect(levers(h).find(l => l.id === 'open_counters')!.pulled).toBe(true);
  h.close();
});
