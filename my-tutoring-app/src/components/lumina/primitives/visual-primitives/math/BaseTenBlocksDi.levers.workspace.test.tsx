// @vitest-environment jsdom
/**
 * The base-ten-blocks spoken-mat levers (read_blocks, regroup; handoff 21 M1 spoken slice) on the shared teaching
 * workspace, mounted the way a lesson mounts it. A pull changes the screen and the scene in one commit, states no
 * answer and leaves the learner's mat alone; the practice mat is ungraded, judged from speech and gives the full
 * item back; only the full item's answer is credited, as assisted.
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

const data = (type: 'read_blocks' | 'regroup', ...targets: number[]) => ({ title: 'Blocks', description: 'Blocks.',
  numberValue: targets[0], maxPlace: 'hundreds', gradeBand: '2-3',
  challenges: targets.map((targetNumber, i) => ({ id: `c${i}`, type, targetNumber, instruction: 'unused', hint: 'Look.' })) });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const mat = (h: WorkspaceHarness) => q(h, '[data-base-ten-mat="judged"] section').map(s => s.querySelectorAll('button').length);

it('read_blocks: after a wrong count the observer pulls the worth key; the mat is unchanged and nothing states the count', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'read_blocks', data: data('read_blocks', 76, 58), instanceId: 'blocks' });
  expect(levers(h)).toEqual([['block_worth', false], ['dim_others', false], ['group_fives', false], ['fewer_blocks', false]]);
  const before = mat(h);
  h.say('seventy'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, response: 'seventy' });
  expect(observerLever(h.state(), true)).toBe('block_worth');
  const receipt = h.dispatch('pull_lever', { lever: 'block_worth' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="block-worth"]')[0].getAttribute('aria-label')).toBe('One ten-stick is worth 10');
  expect(mat(h)).toEqual(before);
  const fact = String(receipt.state.task!.demand.onScreen);
  expect(fact).toMatch(/one ten-stick, worth 10/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\b7\b|\b70\b/);
  h.say('seven'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['block_worth'] });
  h.close();
});

it('read_blocks: dim_others fades the ones and group_fives splits the ten-sticks five and the rest, in the same commit', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'read_blocks', data: data('read_blocks', 76), instanceId: 'blocks' });
  h.dispatch('pull_lever', { lever: 'dim_others' });
  expect(q(h, '[data-lever="dimmed"]').map(s => s.getAttribute('aria-label'))).toEqual(['ones column']);
  h.dispatch('pull_lever', { lever: 'group_fives' });
  const row = q(h, '[data-lever="group-fives"] button') as HTMLElement[];
  expect(row).toHaveLength(7);
  expect(row.map(b => b.style.marginLeft)).toEqual(['', '', '', '', '', '14px', '']);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/faded.*row of five/);
  h.close();
});

it('read_blocks: fewer_blocks is an ungraded practice mat judged from speech, then the full mat is credited', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'read_blocks', data: data('read_blocks', 76, 58), instanceId: 'blocks' });
  const full = h.state().task!.itemId;
  h.say('three'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'fewer_blocks' });
  const task = h.state().task!;
  expect(task.itemId).toBe(`${full}~simpler`);
  expect(task.workspace!.practice).toEqual({ returnsTo: full });
  expect(task.workspace!.expectedAnswer).toBe('4');
  expect(mat(h)).toEqual([4, 6]);
  h.say('five'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  expect(mat(h)).toEqual([4, 6]);
  h.say('four'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  expect(mat(h)).toEqual([7, 6]);
  h.say('seven'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, false, true], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['fewer_blocks'] });
  h.close();
});

it('regroup: the model trade and the glow sit beside the learner\'s mat; the model is no session trade', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'regroup', data: data('regroup', 25, 34), instanceId: 'blocks' });
  expect(levers(h)).toEqual([['trade_model', false], ['asked_column_glow', false], ['small_start', false]]);
  const before = mat(h);
  h.say('ten'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, response: 'ten' });
  expect(observerLever(h.state(), true)).toBe('trade_model');
  h.dispatch('pull_lever', { lever: 'trade_model' });
  expect(q(h, '[data-lever="trade-model"]')[0].textContent).toMatch(/1 ten-stick, 2 ones cubes.*12 ones cubes/);
  h.dispatch('pull_lever', { lever: 'asked_column_glow' });
  expect(q(h, '[data-lever="already-here"]').map(s => s.getAttribute('aria-label'))).toEqual(['ones column']);
  expect(mat(h)).toEqual(before);
  const demand = JSON.stringify(h.state().task!.demand);
  expect(demand).not.toMatch(/\b15\b|\b14\b/);
  h.say('fifteen'); h.feedback('correct', 'advance'); h.confirmVisible();
  // The trade step keeps only the model, answering a wrong block; the glow belongs to the prediction.
  expect(levers(h)).toEqual([['trade_model', false]]);
  h.close();
});

it('regroup: small_start opens a prediction with one ones cube, then the full prediction', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'regroup', data: data('regroup', 25, 34), instanceId: 'blocks' });
  const full = h.state().task!.itemId;
  h.dispatch('pull_lever', { lever: 'small_start' });
  const task = h.state().task!;
  expect(task).toMatchObject({ itemId: `${full}~simpler`, task: expect.stringMatching(/^You have 1 ones cube\./) });
  expect(task.workspace!.expectedAnswer).toBe('11');
  expect(mat(h)).toEqual([2, 1]);
  h.say('eleven'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  expect(mat(h)).toEqual([2, 5]);
  h.close();
});
