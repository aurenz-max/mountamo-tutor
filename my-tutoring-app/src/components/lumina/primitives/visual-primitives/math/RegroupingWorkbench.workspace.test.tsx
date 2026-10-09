// @vitest-environment jsdom
/**
 * Regrouping workbench on the teaching workspace: what is its own. The generic W1 contract
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
import type { RegroupingChallenge, RegroupingWorkbenchData } from './RegroupingWorkbench';
import { regroupMiss, type RegroupView } from './regroupingWorkbenchWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const NAMES = ['Ones', 'Tens', 'Hundreds'];
/** Digits typed into the place boxes, ones first. */
const type = (h: WorkspaceHarness, digits: number[]) => digits.forEach((d, i) => act(() => {
  const input = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${NAMES[i]} digit"]`);
  expect(input, `${NAMES[i]} digit`).toBeTruthy();
  fireEvent.change(input!, { target: { value: String(d) } });
}));

const challenge = (id: string, mode: string, problem: string, regroups: number): RegroupingChallenge => ({
  id, type: mode, problem, requiresRegrouping: regroups > 0, regroupCount: regroups,
  hint: 'Add the ones first: 7 + 5 = 12.', narration: '',
});
const bench = (operation: 'addition' | 'subtraction', challenges: RegroupingChallenge[],
  showOptions: RegroupingWorkbenchData['showOptions'] = {}): RegroupingWorkbenchData => ({
  title: 'Regrouping', operation, operand1: 10, operand2: 10, maxPlace: 'tens', gradeBand: '1-2', challenges, showOptions,
});

type Case = { mode: string; data: RegroupingWorkbenchData; wrong: number[]; right: number[]; miss: string; secret: RegExp };
const CASES: Case[] = [
  { mode: 'add_no_regroup', data: bench('addition', [challenge('a1', 'add_no_regroup', '23 + 14', 0)]),
    wrong: [8, 3], right: [7, 3], miss: 'column_slip', secret: /\b37\b/ },
  { mode: 'subtract_no_regroup', data: bench('subtraction', [challenge('s1', 'subtract_no_regroup', '58 - 23', 0)]),
    wrong: [3, 5], right: [5, 3], miss: 'misplaced_digits', secret: /\b35\b/ },
  { mode: 'add_regroup', data: bench('addition', [challenge('a2', 'add_regroup', '27 + 45', 1)]),
    wrong: [2, 6], right: [2, 7], miss: 'no_carry', secret: /\b72\b/ },
  { mode: 'subtract_regroup', data: bench('subtraction', [challenge('s2', 'subtract_regroup', '52 - 17', 1)]),
    wrong: [5, 4], right: [5, 3], miss: 'smaller_from_larger', secret: /\b35\b/ },
];

it('every catalog mode binds', () => {
  const modes = (getComponentById('regrouping-workbench')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'regrouping-workbench', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: typed digits checked by the activity, no key published; a wrong check names its miss and Try again clears the digits; the right one completes once',
  async ({ mode, data, wrong, right, miss, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'regrouping-workbench', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/correctAnswer|hint/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // The blocks start as the problem's own blocks, never as the result's digits.
    expect(h.view.container.textContent).not.toMatch(/next problem/i);

    type(h, wrong);
    h.press('Check Answer');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(JSON.stringify(h.state().task)).toContain(`"${miss}"`);
    // The miss names no right number, and the generated hint (which can carry a column sum) stays off screen.
    expect(h.view.container.textContent).not.toMatch(secret);
    expect(h.view.container.textContent).not.toMatch(/Add the ones first/);
    // Input is closed until Try again.
    const open = Array.from(h.view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'))
      .filter(el => !el.disabled && /digit|Carry|Borrow|Check Answer/.test((el.getAttribute('aria-label') ?? '') + el.textContent));
    expect(open).toEqual([]);
    h.dispatch('retry');
    expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No digits written yet' });

    type(h, right);
    h.press('Check Answer');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'regrouping-workbench', evalMode: 'add_regroup', data: CASES[2].data as unknown as Record<string, unknown> });
  type(h, [2, 7]);
  h.press('Check Answer');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn: the problem, the blocks before and after a trade, the aids; Try again keeps the trade', () => {
  const h = mountWorkspace({ primitiveId: 'regrouping-workbench', evalMode: 'add_regroup',
    data: bench('addition', [challenge('a2', 'add_regroup', '27 + 45', 1)], { showRegroupHints: false, showPlaceColumns: false }) as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ problem: '27 + 45 = ?', blocks: 'tens 6, ones 12', placeLabels: 'hidden',
    tradeButton: expect.stringContaining('no column is marked') });
  h.press('Carry from the ones');
  expect(h.state().task!.demand).toMatchObject({ blocks: 'tens 7, ones 2', learnerWork: expect.stringContaining('1 carry trade') });
  type(h, [2, 6]);
  h.press('Check Answer');
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ blocks: 'tens 7, ones 2', learnerWork: expect.stringMatching(/No digits written yet$/) });
});

it('a borrow across a zero breaks the next column first', () => {
  const h = mountWorkspace({ primitiveId: 'regrouping-workbench', evalMode: 'subtract_regroup',
    data: { ...bench('subtraction', [challenge('s3', 'subtract_regroup', '305 - 78', 2)], { showRegroupHints: false }), maxPlace: 'hundreds' } as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ blocks: 'hundreds 3, tens 0, ones 5' });
  h.press('Borrow for the ones');
  expect(h.state().task!.demand).toMatchObject({ blocks: 'hundreds 3, tens 0, ones 5' });
  h.press('Borrow for the tens');
  h.press('Borrow for the ones');
  expect(h.state().task!.demand).toMatchObject({ blocks: 'hundreds 2, tens 9, ones 15' });
});

it('regroupMiss names the pattern the typed digits show', () => {
  const v = (operation: 'addition' | 'subtraction', a: number, b: number, digits: (number | null)[]): RegroupView => ({
    operation, a, b, places: 3, digits, blocks: [], trades: 0, regroupMarks: true, placeLabels: true, carryRow: true,
    columnBadges: false, algorithmShown: true });
  expect(regroupMiss(v('addition', 27, 45, [2, 7, null]))).toBeUndefined();
  expect(regroupMiss(v('addition', 27, 45, [2, null, null]))).toBe('left_blank');
  expect(regroupMiss(v('subtraction', 52, 17, [9, 6, null]))).toBe('wrong_operation');
  expect(regroupMiss(v('addition', 27, 45, [2, 6, null]))).toBe('no_carry');
  expect(regroupMiss(v('addition', 27, 45, [7, 2, null]))).toBe('misplaced_digits');
  expect(regroupMiss(v('addition', 27, 45, [3, 7, null]))).toBe('column_slip');
  expect(regroupMiss(v('addition', 27, 45, [9, 9, null]))).toBe('other_answer');
  expect(regroupMiss(v('subtraction', 52, 17, [5, 4, null]))).toBe('smaller_from_larger');
  // 403 − 248: the smaller digit from the larger writes 245; giving ten without making the next place one less writes 265.
  expect(regroupMiss(v('subtraction', 403, 248, [5, 6, 2]))).toBe('forgot_to_reduce');
  expect(regroupMiss(v('subtraction', 403, 248, [5, 4, 2]))).toBe('smaller_from_larger');
  expect(regroupMiss(v('subtraction', 403, 248, [5, 5, 1]))).toBeUndefined();
});

it('the adapter refuses a challenge its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['regrouping-workbench'].validate;
  expect(() => validate(bench('addition', [challenge('x', 'add_regroup', '27 - 45', 1)]))).toThrow();
  expect(() => validate(bench('subtraction', [challenge('x', 'subtract_regroup', '17 - 52', 1)]))).toThrow();
  expect(() => validate(bench('addition', [challenge('x', 'add_regroup', 'twenty plus five', 1)]))).toThrow();
  expect(validate(bench('addition', [CASES[0].data.challenges[0], CASES[2].data.challenges[0]]))).toBeTruthy();
});
