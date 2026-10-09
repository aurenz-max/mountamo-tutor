// @vitest-environment jsdom
/**
 * Two-way table on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { TwoWayTableChallenge, TwoWayTableData } from './TwoWayTable';
import { TWO_WAY_MISSES_BY_MODE, locateTarget, twoWayMiss } from './twoWayTableWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const input = (h: WorkspaceHarness) => h.view.container.querySelector<HTMLInputElement>('input[aria-label="Your answer"]');
const type = (h: WorkspaceHarness, text: string) => act(() => {
  expect(input(h), 'the answer box').toBeTruthy();
  fireEvent.change(input(h)!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');

/** Pet preference by gender: Male 28 Dogs, 12 Cats; Female 18 Dogs, 22 Cats (rows 40, 40; columns 46, 34; 80). */
const base = {
  scenario: 'Pet preference by gender', rowLabel: 'Gender', columnLabel: 'Pet preference',
  rowCategories: ['Male', 'Female'], columnCategories: ['Dogs', 'Cats'], frequencies: [[28, 12], [18, 22]],
  tolerance: 0.02, hint: 'Divide 12 by 80: the answer is 0.15.',
};
const joint: TwoWayTableChallenge = { ...base, id: 'j1', challengeType: 'joint_probability', showTotals: true,
  question: 'What is P(Male AND Cats)? Enter your answer as a decimal between 0 and 1 (round to 2 decimals).',
  expectedProbability: 0.15, target: { row: 0, col: 1 } };
const marginal: TwoWayTableChallenge = { ...base, id: 'm1', challengeType: 'marginal_distribution', showTotals: false,
  question: 'What is P(Male)? Enter your answer as a decimal between 0 and 1 (round to 2 decimals).',
  expectedProbability: 0.5, target: { row: 0 } };
const conditional: TwoWayTableChallenge = { ...base, id: 'c1', challengeType: 'conditional_probability', showTotals: false,
  question: 'Given a member is Female, what is the probability they are Cats? Enter P(Cats | Female) as a decimal (round to 2 decimals).',
  expectedProbability: 0.55, target: { row: 1, col: 1, given: 'row' } };
const independence: TwoWayTableChallenge = { ...base, id: 'i1', challengeType: 'independence_test', showTotals: true,
  question: 'If Male and Cats were independent, the expected joint probability would be P(Male) × P(Cats). Compute this expected joint probability (round to 2 decimals).',
  expectedProbability: 0.2125, target: { row: 0, col: 1 } };
const table = (challenges: TwoWayTableChallenge[]): TwoWayTableData => ({ title: 'Two-way tables', description: '', challenges,
  challengeType: challenges[0].challengeType });

type Case = { mode: string; item: TwoWayTableChallenge; wrong: string; miss: string; right: string; secret: RegExp };
const CASES: Case[] = [
  { mode: 'joint_probability', item: joint, wrong: '0.30', miss: 'row_denominator', right: '0.15', secret: /0\.15\b/ },
  { mode: 'marginal_distribution', item: marginal, wrong: '0.35', miss: 'one_cell', right: '0.5', secret: /0\.50?\b|\b40\b/ },
  { mode: 'conditional_probability', item: conditional, wrong: '0.28', miss: 'joint_instead', right: '0.55', secret: /0\.55\b|\b40\b/ },
  { mode: 'independence_test', item: independence, wrong: '0.15', miss: 'observed_joint', right: '0.21', secret: /0\.21/ },
];

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('two-way-table')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(TWO_WAY_MISSES_BY_MODE);
  for (const { mode, item } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'two-way-table', pin: mode, objectiveIds: ['o'],
      data: table([item]) as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss and Try again clears it; the right one completes once',
  async ({ mode, item, wrong, miss, right, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'two-way-table', evalMode: mode, data: table([item]) as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/expectedProbability|hint|answer is/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // The hint, Next and Skip are the tutor's; the placeholder is no number a key could be.
    expect(h.view.container.textContent).not.toMatch(/Show hint|Next Table|Skip|answer is/);
    expect(h.view.container.textContent).not.toMatch(secret);
    expect(input(h)!.placeholder).toBe('0.00');

    type(h, wrong); check(h);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(secret);
    // Input is closed until Try again.
    expect(input(h)!.disabled).toBe(true);
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toBe('nothing typed yet');
    expect(input(h)!.value).toBe('');

    type(h, right); check(h);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'two-way-table', evalMode: 'joint_probability', data: table([joint]) as unknown as Record<string, unknown> });
  type(h, '0.15'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told the cells and only the totals the table draws', () => {
  const h = mountWorkspace({ primitiveId: 'two-way-table', evalMode: 'marginal_distribution', data: table([marginal]) as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ cells: 'Male: Dogs 28, Cats 12; Female: Dogs 18, Cats 22',
    totals: 'row totals hidden; column totals hidden; grand total hidden', learnerWork: 'nothing typed yet' });
  cleanup();
  const g = mountWorkspace({ primitiveId: 'two-way-table', evalMode: 'joint_probability', data: table([joint]) as unknown as Record<string, unknown> });
  expect(String(g.state().task!.demand.totals)).toBe('row totals drawn: Male 40, Female 40; column totals drawn: Dogs 46, Cats 34; grand total drawn: 80');
});

it('a non-number is not a check', () => {
  const h = mountWorkspace({ primitiveId: 'two-way-table', evalMode: 'joint_probability', data: table([joint]) as unknown as Record<string, unknown> });
  type(h, 'abc'); check(h);
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
});

it('twoWayMiss names the pattern the number shows', () => {
  expect(twoWayMiss(joint, '0.15')).toBeUndefined();
  expect(twoWayMiss(joint, '15%')).toBeUndefined();
  expect(twoWayMiss(joint, '0.3')).toBe('row_denominator');
  expect(twoWayMiss(joint, '0.35')).toBe('column_denominator');
  expect(twoWayMiss(joint, '0.5')).toBe('marginal_instead');
  expect(twoWayMiss(joint, '0.27')).toBe('wrong_cell');
  expect(twoWayMiss(joint, '0.19')).toBe('near_miss');
  expect(twoWayMiss(joint, '0.9')).toBe('too_high');
  expect(twoWayMiss(marginal, '0.15')).toBe('one_cell');
  expect(twoWayMiss(marginal, '0.57')).toBe('other_marginal');
  expect(twoWayMiss(marginal, '40')).toBe('typed_count');
  expect(twoWayMiss(conditional, '0.65')).toBe('reversed_condition');
  expect(twoWayMiss(conditional, '0.45')).toBe('wrong_cell');
  expect(twoWayMiss(conditional, '0.5')).toBe('marginal_instead');
  expect(twoWayMiss(independence, '0.43')).toBe('one_factor');
  expect(twoWayMiss(independence, '0.93')).toBe('added_factors');
  expect(twoWayMiss(independence, '0.15')).toBe('observed_joint');
  expect(twoWayMiss(independence, '0.01')).toBe('too_low');
  // A count from the table typed whole (read as a percent: 80 is 0.8, which is no pattern here).
  expect(twoWayMiss(independence, '80')).toBe('typed_count');
});

it('an older payload with no target is located from its question and key', () => {
  const { target: _t, ...old } = conditional;
  expect(locateTarget(old as TwoWayTableChallenge)).toEqual({ row: 1, col: 1, given: 'row' });
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['two-way-table'].validate;
  expect(() => validate(table([{ ...joint, frequencies: [[28, 12]] }]))).toThrow();
  expect(() => validate(table([{ ...joint, expectedProbability: 0.9, target: undefined }]))).toThrow();
  expect(validate(table([joint, marginal, conditional, independence]))).toBeTruthy();
});
