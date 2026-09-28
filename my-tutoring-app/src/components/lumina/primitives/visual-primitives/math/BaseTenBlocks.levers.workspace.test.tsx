// @vitest-environment jsdom
/**
 * The base-ten-blocks build_number levers on the shared teaching workspace (handoff 21 M1), mounted the way a lesson
 * mounts it. A pull changes the mat in the same commit and states no number; the plainer build is ungraded practice
 * that returns to the full item on an empty mat, and only the full item is credited, with its lever recorded.
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

const data = (tier: { showColumnCounts?: boolean; showBlocksTotal?: boolean }) => ({ title: 'Build', description: 'Build numbers.',
  numberValue: 24, interactionMode: 'build', maxPlace: 'tens', gradeBand: 'K-1',
  challenges: [24, 35].map((n, i) => ({ id: `b${i}`, type: 'build_number', instruction: `Build the number ${n} with blocks.`,
    targetNumber: n, hint: 'Count the tens, then the ones.', ...tier })) });
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const blocks = (h: WorkspaceHarness, tens: number, ones: number) => {
  for (let i = 0; i < tens; i++) h.press('Add one to Tens');
  for (let i = 0; i < ones; i++) h.press('Add one to Ones');
  h.press(/check my blocks/i);
};
const hidden = { showColumnCounts: false, showBlocksTotal: false };

it('column_counts shows the count of the learner\'s own blocks in the same commit, and the scene states no number', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'build_number', data: data(hidden), instanceId: 'blocks' });
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['column_counts', 'help', false], ['blocks_total', 'help', false],
    ['plainer_build', 'simplify', false]]);
  blocks(h, 2, 3);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_short' });
  h.dispatch('pull_lever', { lever: 'column_counts' });
  const counts = Array.from(h.view.container.querySelectorAll('[data-base-ten-mat="click"] .text-2xl')).map(e => e.textContent);
  expect(counts.slice(-2)).toEqual(['2', '3']);
  expect(h.state().task!.demand.onScreen).toMatch(/how many of the learner's blocks/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b24\b/);
  h.dispatch('retry');
  blocks(h, 2, 4);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['column_counts'] });
  h.close();
});

it('ten_bracket appears once a column of the learner\'s holds ten or more, and brackets only that column', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'build_number', data: data(hidden), instanceId: 'blocks' });
  expect(levers(h).map(l => l.id)).not.toContain('ten_bracket');
  blocks(h, 1, 14);
  expect(levers(h).map(l => l.id)).toContain('ten_bracket');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'not_traded_up' });
  h.dispatch('pull_lever', { lever: 'ten_bracket' });
  expect(h.view.container.querySelectorAll('[data-lever="ten-bracket"]')).toHaveLength(1);
  h.close();
});

it('the plainer build is ungraded practice, then the full build on an empty mat is credited with its lever', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'build_number', data: data({}), instanceId: 'blocks' });
  // Untiered: counts and total start pulled; that is not a pull.
  expect(levers(h).filter(l => l.pulled).map(l => l.id)).toEqual(['column_counts', 'blocks_total']);
  const full = h.state().task!.itemId;
  blocks(h, 5, 0);
  h.dispatch('pull_lever', { lever: 'plainer_build' });
  expect(h.state().task).toMatchObject({ itemId: `${full}~plainer`, task: 'Build the number 12 with blocks.' });
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: full });
  blocks(h, 1, 2);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: full, task: 'Build the number 24 with blocks.' });
  expect(h.state().task!.demand.learnerBlocks).toMatch(/^(0|no)/i);
  blocks(h, 2, 4);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~plainer`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['plainer_build'], assisted: true });
  h.close();
});
