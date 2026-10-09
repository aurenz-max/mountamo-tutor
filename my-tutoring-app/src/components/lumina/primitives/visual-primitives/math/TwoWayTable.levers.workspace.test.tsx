// @vitest-environment jsdom
/**
 * two-way-table levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit, the
 * next attempt records it, a refused pull changes nothing, and the easier table is ungraded practice with the full
 * item back after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { TwoWayTableChallenge, TwoWayTableData } from './TwoWayTable';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const type = (h: WorkspaceHarness, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector('input[aria-label="Your answer"]')!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

/** Sport by grade, 3 x 3, every total hidden (the hard tier). Grade 7 row 22 + 16 + 8 = 46; Tennis column 46; 144. */
const base = {
  scenario: 'Sport by grade', rowLabel: 'Grade', columnLabel: 'Sport', rowCategories: ['Grade 6', 'Grade 7', 'Grade 8'],
  columnCategories: ['Soccer', 'Tennis', 'Track'], frequencies: [[18, 10, 14], [22, 16, 8], [12, 20, 24]], tolerance: 0.02,
  hint: '', showTotals: false, supportTier: 'hard' as const, showRowTotals: false, showColTotals: false, showGrandTotal: false,
};
const conditional: TwoWayTableChallenge = { ...base, id: 'c1', challengeType: 'conditional_probability',
  question: 'Given a member is Grade 7, what is the probability they are Tennis? Enter P(Tennis | Grade 7) as a decimal (round to 2 decimals).',
  expectedProbability: 0.3478, target: { row: 1, col: 1, given: 'row' } };
const marginal: TwoWayTableChallenge = { ...base, id: 'm1', challengeType: 'marginal_distribution',
  question: 'What is P(Grade 7)? Enter your answer as a decimal between 0 and 1 (round to 2 decimals).',
  expectedProbability: 0.3194, target: { row: 1 } };
const table = (c: TwoWayTableChallenge): TwoWayTableData => ({ title: 'Tables', description: '', challenges: [c], challengeType: c.challengeType });
const mount = (c: TwoWayTableChallenge) => {
  const h = mountWorkspace({ primitiveId: 'two-way-table', evalMode: c.challengeType, data: table(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('conditional: the outline draws in the same commit; the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount(conditional);
  expect(levers(h)).toEqual([['outline_question', false], ['sum_frame', false], ['out_of_frame', false], ['model_table', false],
    ['simpler_table', false]]);
  type(h, '0.11'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'joint_instead' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'joint_instead')).toBe('out_of_frame');
  const receipt = h.dispatch('pull_lever', { lever: 'outline_question' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/outlined/);
  expect(q(h, '[data-lever="outline"], [data-lever="outline-mark"]').map(e => e.textContent)).toEqual(['22', '16', '8']);
  expect(q(h, '[data-lever="outline-mark"]').map(e => e.textContent)).toEqual(['16']);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'outline_question' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  type(h, '0.35'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'c1', correct: true, levers: ['outline_question'] });
});

it('every help lever draws without the answer or a hidden total', () => {
  const h = mount(marginal);
  type(h, '0.15'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'one_cell' });
  for (const id of ['outline_question', 'sum_frame', 'out_of_frame', 'model_table']) expect(h.dispatch('pull_lever', { lever: id }).status, id).toBe('committed');
  expect(q(h, '[data-lever="sum-frame"] p').map(p => p.textContent)).toEqual(['Grade 7 row: 22 + 16 + 8 = ?',
    'Everyone: 18 + 10 + 14 + 22 + 16 + 8 + 12 + 20 + 24 = ?']);
  expect(q(h, '[data-lever="out-of-frame"]')[0].textContent).toBe('P(Grade 7) = (all Grade 7: the whole row added up) ÷ (everyone in the table)');
  expect(q(h, '[data-lever="model-table"]')).toHaveLength(1);
  expect(h.view.container.textContent).not.toMatch(/0\.32|\b46\b|\b144\b/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/0\.32|\b46\b|\b144\b/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
});

it('the simpler table is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount(conditional);
  type(h, '0.11'); check(h);
  const r = h.dispatch('pull_lever', { lever: 'simpler_table' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('c1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'c1' });
  expect(r.state.task!.demand).toMatchObject({ cells: 'Grade 6: Soccer 3, Tennis 2; Grade 7: Soccer 1, Tennis 4', learnerWork: 'nothing typed yet' });
  type(h, '0.4'); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c1');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'nothing typed yet' });
  type(h, '0.35'); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['c1', false, false], ['c1~simpler', true, true], ['c1', true, false]]);
});
