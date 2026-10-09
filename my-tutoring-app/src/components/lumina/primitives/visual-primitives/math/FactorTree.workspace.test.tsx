// @vitest-environment jsdom
/**
 * Factor tree on the teaching workspace: what is its own. The generic W1 contract
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
import type { FactorTreeData } from './FactorTree';
import { FACTOR_TREE_MISSES_BY_MODE, factorHarnessSplits, factorMiss } from './factorTreeWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const type = (h: WorkspaceHarness, label: string, value: number) => act(() => {
  const input = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, label).toBeTruthy();
  fireEvent.change(input!, { target: { value: String(value) } });
});
const split = (h: WorkspaceHarness, value: number, a: number, b: number) => {
  h.press(`Split ${value}`);
  type(h, 'Factor 1', a); type(h, 'Factor 2', b);
  h.press('Split');
};

const FLAGS: Record<string, Partial<FactorTreeData>> = {
  guided_small: { guidedMode: true, allowReset: true }, guided_medium: { guidedMode: true, allowReset: true },
  unguided: { guidedMode: false, allowReset: true }, unguided_large: { guidedMode: false, allowReset: true },
  assessment_intro: { guidedMode: false, allowReset: false }, assessment: { guidedMode: false, allowReset: false },
};
const tree = (mode: string, ...roots: number[]): FactorTreeData => ({ title: 'Factor trees', description: '',
  challenges: roots.map((rootValue, i) => ({ id: `ft-${i + 1}`, rootValue })), highlightPrimes: true, showExponentForm: true,
  ...FLAGS[mode] });

/** `before`: right splits made first (not commits); `wrong`: the split checked wrong and its miss; then the rest right. */
type Split = [number, number, number];
type Case = { mode: string; root: number; before: Split[]; wrong: Split; miss: string; rest: Split[]; key: RegExp };
const CASES: Case[] = [
  { mode: 'guided_small', root: 12, before: [], wrong: [12, 1, 12], miss: 'used_one', rest: [[12, 2, 6], [6, 2, 3]], key: /2\^2 × 3|2 × 2 × 3/ },
  { mode: 'guided_medium', root: 36, before: [[36, 4, 9]], wrong: [9, 4, 5], miss: 'added', rest: [[9, 3, 3], [4, 2, 2]], key: /2\^2 × 3\^2/ },
  { mode: 'unguided', root: 30, before: [], wrong: [30, 5, 7], miss: 'wrong_partner', rest: [[30, 5, 6], [6, 2, 3]], key: /2 × 3 × 5/ },
  { mode: 'unguided_large', root: 72, before: [[72, 8, 9]], wrong: [8, 3, 3], miss: 'not_a_factor', rest: [[8, 2, 4], [4, 2, 2], [9, 3, 3]], key: /2\^3 × 3\^2/ },
  { mode: 'assessment_intro', root: 45, before: [], wrong: [45, 9, 6], miss: 'wrong_partner', rest: [[45, 9, 5], [9, 3, 3]], key: /3\^2 × 5/ },
  { mode: 'assessment', root: 84, before: [[84, 2, 42]], wrong: [42, 7, 7], miss: 'wrong_partner', rest: [[42, 6, 7], [6, 2, 3]], key: /2\^2 × 3 × 7/ },
];

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('factor-tree')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(FACTOR_TREE_MISSES_BY_MODE);
  for (const { mode, root } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'factor-tree', pin: mode, objectiveIds: ['o'],
      data: tree(mode, root) as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: splits checked by the activity, no key published; a wrong split names its miss and Try again keeps the right splits; the finishing split completes once',
  async ({ mode, root, before, wrong, miss, rest, key }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'factor-tree', evalMode: mode, data: tree(mode, root) as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task)).not.toMatch(key);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/Next Challenge|Finish Session/);

    // Right splits that leave a composite on the tree commit nothing.
    for (const [v, a, b] of before) split(h, v, a, b);
    expect(h.state().task!.evidence.attemptNumber).toBe(0);
    const splitsBefore = h.state().task!.demand.splits;
    split(h, ...wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(key);
    // Input is closed until Try again.
    const open = Array.from(h.view.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'))
      .filter(el => !el.disabled && /^(Split|Factor|Reset)/.test((el.getAttribute('aria-label') ?? '') + (el.textContent ?? '').trim()));
    expect(open).toEqual([]);
    h.dispatch('retry');
    expect(h.state().task!.demand.splits).toBe(splitsBefore);
    expect(h.state().task!.demand.selected).toBeUndefined();
    expect(h.view.container.textContent).not.toMatch(/≠|cannot include 1/);

    for (const [v, a, b] of rest) split(h, v, a, b);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'factor-tree', evalMode: 'unguided', data: tree('unguided', 15) as unknown as Record<string, unknown> });
  split(h, 15, 3, 5);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told the tree as built: the splits, the leaves, which aids are drawn, never a pair to come', () => {
  const h = mountWorkspace({ primitiveId: 'factor-tree', evalMode: 'unguided',
    data: { ...tree('unguided', 36), highlightPrimes: false, showExponentForm: false } as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ number: '36', splits: 'none yet', leaves: '36',
    primeLeaves: expect.stringContaining('not colored'), factorPairs: expect.stringContaining('not listed') });
  expect(h.state().task!.demand.runningFactorization).toBeUndefined();
  split(h, 36, 4, 9);
  h.press('Split 9');
  expect(h.state().task!.demand).toMatchObject({ splits: '36 = 4 × 9', leaves: '4, 9', selected: '9, waiting for two factors' });
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/3 × 3|2 × 2|\b18\b|\b12\b/);
});

it('factorMiss names the pattern the split shows; the harness splits finish the tree', () => {
  const s = (value: number, factor1: number, factor2: number) => ({ value, factor1, factor2 });
  expect(factorMiss(s(12, 3, 4))).toBeUndefined();
  expect(factorMiss(s(12, 12, 1))).toBe('used_one');
  expect(factorMiss(s(12, 5, 7))).toBe('added');
  expect(factorMiss(s(12, 3, 5))).toBe('wrong_partner');
  expect(factorMiss(s(35, 3, 11))).toBe('not_a_factor');
  expect(factorHarnessSplits([2, 18], 'correct')).toEqual([s(18, 2, 9), s(9, 3, 3)]);
  expect(factorMiss(factorHarnessSplits([36], 'wrong')[0])).toBe('wrong_partner');
});

it('the adapter refuses a root that is not a composite', () => {
  const validate = LIVE_ADAPTERS['factor-tree'].validate;
  expect(() => validate(tree('unguided', 13))).toThrow();
  expect(() => validate(tree('unguided', 1))).toThrow();
  expect(validate(tree('unguided', 12, 45))).toBeTruthy();
});
