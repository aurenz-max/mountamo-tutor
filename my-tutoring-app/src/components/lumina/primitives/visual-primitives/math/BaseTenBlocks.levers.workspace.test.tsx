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
import { readFileSync } from 'fs';
import { join } from 'path';
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

// ── operate (slice 2): the typed result is the answer, so the total is never a lever ──

const operate = (tier: { showColumnCounts?: boolean } = {}) => ({ title: 'Add', description: 'Add with blocks.',
  numberValue: 148, interactionMode: 'operate', maxPlace: 'hundreds', gradeBand: '2-3',
  challenges: [[148, 76], [37, 25]].map(([a, b], i) => ({ id: `o${i}`, type: 'add_with_blocks', instruction: `Add ${a} + ${b} using blocks.`,
    targetNumber: a + b, secondNumber: b, hint: 'Start with the ones column.', ...tier })) });
const model = (h: WorkspaceHarness, ...numbers: number[]) => {
  for (const n of numbers) String(n).padStart(3, '0').split('').forEach((d, i) => {
    for (let k = 0; k < Number(d); k++) h.press(`Add one to ${['Hundreds', 'Tens', 'Ones'][i]}`);
  });
};
const type = (h: WorkspaceHarness, n: number) => { for (const key of String(n)) h.press(key); h.press('✓'); };

it('operate: a lost carry on an untraded mat offers ten_bracket, which brackets the learner\'s full columns and no count', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'operate', data: operate({ showColumnCounts: false }), instanceId: 'blocks' });
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([['column_counts', false], ['trade_mark', false], ['single_regroup', false]]);
  model(h, 148, 76);
  type(h, 214);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_ten_off' });
  expect(levers(h).map(l => l.id)).toContain('ten_bracket');
  h.dispatch('pull_lever', { lever: 'ten_bracket' });
  expect(h.view.container.querySelectorAll('[data-lever="ten-bracket"]')).toHaveLength(2);
  expect(h.state().task!.demand.onScreen).toMatch(/bracket/);
  expect(h.view.container.textContent).not.toMatch(/Blocks Total/);
  h.close();
});

it('operate: single_regroup is an ungraded operation with fewer trades, then the full item on an empty mat is credited', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'operate', data: operate(), instanceId: 'blocks' });
  const full = h.state().task!.itemId;
  type(h, 300);
  h.dispatch('pull_lever', { lever: 'single_regroup' });
  const task = h.state().task!.task;
  const [, a, b] = task.match(/^Add (\d+) \+ (\d+) using blocks\.$/)!.map(Number);
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  expect([a, b].sort()).not.toEqual([76, 148]);
  expect(a + b).not.toBe(224);
  type(h, a + b);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: full, task: 'Add 148 + 76 using blocks.' });
  expect(h.state().task!.demand.learnerBlocks).toMatch(/^(0|no)/i);
  type(h, 224);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['single_regroup'], assisted: true });
  // The one-trade item has no simpler operation.
  h.dispatch('advance');
  expect(levers(h).map(l => l.id)).toEqual(['column_counts', 'trade_mark']);
  h.close();
});

// ── per-item gaps (J12, 2026-10-09): a lost borrow on a one-trade subtraction, and a mixed deck's read and trade ──

const snapshot = (h: WorkspaceHarness) => ({ screen: h.view.container.innerHTML, levers: JSON.stringify(levers(h)),
  attempts: JSON.stringify(h.state().task!.workspace!.attempts), facts: JSON.stringify(h.state().task!.demand) });

it('operate: trade_mark marks the column a lost borrow needed in the same commit, with no number; a repeat pull changes nothing', () => {
  const data = { ...operate({ showColumnCounts: false }), challenges: [{ id: 's0', type: 'subtract_with_blocks',
    instruction: 'Subtract 28 from 73 using blocks.', targetNumber: 45, secondNumber: 28, hint: 'Start with the ones column.',
    showColumnCounts: false }] };
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'operate', data, instanceId: 'blocks' });
  expect(levers(h).map(l => [l.id, l.kind])).toEqual([['column_counts', 'help'], ['trade_mark', 'help']]);
  type(h, 55);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_ten_off' });
  expect(h.view.container.querySelectorAll('[data-lever="trade-mark"]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'trade_mark' });
  const marks = h.view.container.querySelectorAll('[data-lever="trade-mark"]');
  expect(marks).toHaveLength(1);
  expect(marks[0].closest('[data-base-ten-mat] > div')!.textContent).toMatch(/^Ones/);
  expect(h.state().task!.demand.onScreen).toMatch(/needs a trade are marked/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b45\b/);
  expect(h.view.container.textContent).not.toMatch(/\b45\b/);
  // Refused: already pulled. Nothing on screen, in the levers or in the attempts changes.
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'trade_mark' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  type(h, 45);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['trade_mark'] });
  h.close();
});

const mixed = () => JSON.parse(readFileSync(join(process.cwd(),
  'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/base-ten-blocks.mixed.json'), 'utf-8')).data;
/** The mixed deck's first item, build 142, built right and advanced past. */
const pastBuild = (h: WorkspaceHarness) => {
  h.press('Add one to Hundreds');
  blocks(h, 4, 2);
  h.dispatch('advance');
};

it('mixed read_blocks: ten_model draws a ten-stick beside the mat in the same commit; the next answer records it', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'mixed', data: mixed(), instanceId: 'blocks' });
  pastBuild(h);
  expect(h.state().task!.itemId).toBe('read_blocks-1');
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['ten_model', 'help', false], ['plainer_read', 'simplify', false]]);
  type(h, 225);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_ten_off' });
  expect(h.view.container.querySelector('[data-lever="ten-model"]')).toBeNull();
  h.dispatch('pull_lever', { lever: 'ten_model' });
  expect(h.view.container.querySelector('[data-lever="ten-model"]')).not.toBeNull();
  expect(h.state().task!.demand.onScreen).toMatch(/smaller blocks it is worth/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b215\b/);
  h.dispatch('retry');
  type(h, 215);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['ten_model'] });
  h.close();
});

it('mixed read_blocks: plainer_read is an ungraded read of a plainer mat, then the full mat comes back and is credited', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'mixed', data: mixed(), instanceId: 'blocks' });
  pastBuild(h);
  const full = h.state().task!.itemId;
  type(h, 900);
  h.dispatch('pull_lever', { lever: 'plainer_read' });
  // 215 -> every digit about half, at least one: 113. The mat holds it, and the keypad is empty.
  expect(h.state().task!.itemId).toBe(`${full}~plainer`);
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: full });
  type(h, 113);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe(full);
  type(h, 215);
  const attempts = h.state().task!.workspace!.attempts.filter(a => a.itemId.startsWith(full));
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~plainer`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['plainer_read'], assisted: true });
  h.close();
});

it('mixed regroup: a check with no trade offers ten_model, which draws beside the mat; the trade after it records the lever', () => {
  const h = mountWorkspace({ primitiveId: 'base-ten-blocks', evalMode: 'mixed', data: mixed(), instanceId: 'blocks' });
  pastBuild(h);
  type(h, 215);
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('regroup-2');
  h.press(/check my trade/i);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'no_trade' });
  expect(levers(h).map(l => l.id)).toEqual(['ten_model']);
  h.dispatch('pull_lever', { lever: 'ten_model' });
  expect(h.view.container.querySelector('[data-lever="ten-model"]')).not.toBeNull();
  h.dispatch('retry');
  h.press(/1 → 10 Tens/);
  h.press(/check my trade/i);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['ten_model'] });
  h.close();
});
