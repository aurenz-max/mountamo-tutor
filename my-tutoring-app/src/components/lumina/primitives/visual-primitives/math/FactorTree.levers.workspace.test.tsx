// @vitest-environment jsdom
/**
 * factor-tree levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit, the
 * next attempt records it, a refused pull changes nothing, and the practice tree is ungraded with the full item back
 * after it.
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
import type { FactorTreeData } from './FactorTree';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const type = (h: WorkspaceHarness, label: string, value: number) => act(() => {
  fireEvent.change(h.view.container.querySelector(`input[aria-label="${label}"]`)!, { target: { value: String(value) } });
});
const split = (h: WorkspaceHarness, value: number, a: number, b: number) => {
  h.press(`Split ${value}`); type(h, 'Factor 1', a); type(h, 'Factor 2', b); h.press('Split');
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

// The hard unguided starting position: no listed pairs, no rules panel, no prime coloring, no running product.
const data = (rootValue: number, extra: Partial<FactorTreeData> = {}): FactorTreeData => ({ title: 'Factor trees', description: '',
  challenges: [{ id: 'ft-1', rootValue }], guidedMode: false, allowReset: true, highlightPrimes: false, showExponentForm: false,
  showRunningFactorization: false, ...extra });
const mount = (mode: string, d: FactorTreeData) => {
  const h = mountWorkspace({ primitiveId: 'factor-tree', evalMode: mode, data: d as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('unguided: the partner frame draws in the same commit and never works the division; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('unguided_large', data(63));
  expect(levers(h)).toEqual([['divisibility_rules', false], ['partner_frame', false], ['product_check', false], ['smaller_tree', false]]);
  split(h, 63, 3, 22);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'wrong_partner' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'wrong_partner')).toBe('partner_frame');
  const receipt = h.dispatch('pull_lever', { lever: 'partner_frame' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/never shows the result/);
  expect(q(h, '[data-lever="partner-frame"]')[0].textContent).toMatch(/63 ÷ 3 = \?/);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'partner_frame' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  expect(q(h, '[data-lever="partner-frame"]')[0].textContent).toMatch(/the number ÷ your first factor = \?/);
  h.press('Split 63'); type(h, 'Factor 1', 7);
  expect(q(h, '[data-lever="partner-frame"]')[0].textContent).toMatch(/63 ÷ 7 = \?/);
  type(h, 'Factor 2', 9); h.press('Split');
  split(h, 9, 3, 3);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'ft-1', correct: true, levers: ['partner_frame'] });
});

it('every help lever draws without the partner or the factorization; the product readout shows only the learner\'s own product', () => {
  const h = mount('assessment', data(63, { allowReset: false }));
  split(h, 63, 3, 22);
  for (const id of ['divisibility_rules', 'partner_frame', 'product_check']) expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  expect(q(h, '[data-lever="divisibility-rules"]')[0].textContent).not.toMatch(/\d/);
  expect(q(h, '[data-lever="product-check"]')[0].textContent).toMatch(/3 × 22 = 66, not 63/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  expect(h.view.container.textContent).not.toMatch(/\b21\b|3\^2|3 × 3 × 7/);
  h.dispatch('retry');
  expect(q(h, '[data-lever="product-check"]')[0].textContent).toMatch(/Type both factors/);
  h.press('Split 63'); type(h, 'Factor 1', 9); type(h, 'Factor 2', 7);
  expect(q(h, '[data-lever="product-check"]')[0].textContent).toMatch(/9 × 7 = 63, which is 63/);
});

it('the easy tier\'s rules panel is a starting position: declared pulled, not recorded, and a pull is refused', () => {
  const h = mount('guided_small', data(12, { guidedMode: true, showStrategyHint: true }));
  expect(levers(h)[0]).toEqual(['divisibility_rules', true]);
  expect(q(h, '[data-lever="divisibility-rules"]')).toHaveLength(1);
  expect(h.dispatch('pull_lever', { lever: 'divisibility_rules' }).status).toBe('blocked');
  split(h, 12, 3, 4); split(h, 4, 2, 2);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  expect((attempts(h).at(-1) as { levers?: string[] }).levers ?? []).toEqual([]);
});

it('the practice tree is ungraded, one split shorter and not a factor of the item; the full item comes back blank and is credited after', () => {
  const h = mount('unguided', data(36));
  split(h, 36, 30, 6);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'added' });
  const r = h.dispatch('pull_lever', { lever: 'smaller_tree' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('ft-1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'ft-1' });
  expect(r.state.task!.demand).toMatchObject({ number: '30', splits: 'none yet', leaves: '30' });
  split(h, 30, 5, 6); split(h, 6, 2, 3);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('ft-1');
  expect(h.state().task!.demand).toMatchObject({ number: '36', splits: 'none yet', leaves: '36' });
  split(h, 36, 4, 9); split(h, 4, 2, 2); split(h, 9, 3, 3);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['ft-1', false, false], ['ft-1~simpler', true, true], ['ft-1', true, false]]);
});
