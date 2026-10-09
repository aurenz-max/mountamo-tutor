// @vitest-environment jsdom
/**
 * circle-explorer levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit, the
 * next attempt records it, a refused pull changes nothing, and the easier problem is ungraded practice with the full
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
import type { CircleExplorerChallenge, CircleExplorerData } from './CircleExplorer';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const type = (h: WorkspaceHarness, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector('input[aria-label="Your answer"]')!, { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check');
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const base = { narration: 'A pond is shaped like this circle.', hint: '', unitLabel: 'cm', usePiApprox: true };
const discover: CircleExplorerChallenge = { ...base, id: 'p1', type: 'discover_pi', given: 'diameter', radius: 5, answerKind: 'ratio',
  instruction: 'Unroll the circumference, then find how many diameters fit around: C ÷ d.', expectedAnswer: 3.14, tolerance: 0.15 };
const around: CircleExplorerChallenge = { ...base, id: 'c1', type: 'circumference', given: 'radius', radius: 7, answerKind: 'length',
  instruction: 'Find the circumference — the distance all the way around.', expectedAnswer: 43.96, tolerance: 0.88, showFormulaReveal: false };
const back: CircleExplorerChallenge = { ...base, id: 'r1', type: 'reverse', given: 'radius', radius: 9, answerKind: 'length',
  reverseGiven: 'area', givenValue: 254.3, instruction: 'The area is given. Work backward to find the radius.', expectedAnswer: 9, tolerance: 0.2 };
const square: CircleExplorerChallenge = { ...base, id: 's1', type: 'composite', given: 'radius', radius: 6, answerKind: 'area',
  compositeShape: 'circle_in_square', squareSide: 12, instruction: 'A circle is inscribed in the square. Find the shaded area left over.',
  expectedAnswer: 30.96, tolerance: 0.62 };
const lesson = (c: CircleExplorerChallenge): CircleExplorerData => ({ title: 'Circles', description: '', challengeType: c.type, challenges: [c] });
const mount = (mode: string, c: CircleExplorerChallenge) => {
  const h = mountWorkspace({ primitiveId: 'circle-explorer', evalMode: mode, data: lesson(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('circumference (hard tier): other_length draws in the same commit; the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount('circumference', around);
  expect(levers(h)).toEqual([['formula_labels', false], ['other_length', false], ['diameters_around', false], ['simpler_problem', false]]);
  type(h, '21.98'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'pi_times_radius' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'pi_times_radius')).toBe('formula_labels');
  const receipt = h.dispatch('pull_lever', { lever: 'other_length' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/diameter is drawn across the circle, named d equals r plus r/);
  expect(q(h, '[data-lever="other-length"]')[0].textContent).toMatch(/two radii end to end/);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'other_length' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  // The formula lever turns the withheld labels back on, in the scene too.
  expect(String(h.state().task!.demand.formulaLabels)).toMatch(/^withheld/);
  expect(h.dispatch('pull_lever', { lever: 'formula_labels' }).status).toBe('committed');
  expect(String(h.state().task!.demand.formulaLabels)).toMatch(/^shown/);
  expect(h.view.container.textContent).not.toMatch(/43\.96|\b44\b/);
  h.dispatch('retry');
  type(h, '43.96'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'c1', correct: true, levers: ['other_length', 'formula_labels'] });
});

it('discover π: the ratio frame writes the figure\'s own numbers and never the ratio; the tenths need the unrolled line', () => {
  const h = mount('discover_pi', discover);
  expect(levers(h).map(([id]) => id)).toEqual(['ratio_frame']);
  h.press('Unroll the circumference');
  expect(levers(h).map(([id]) => id)).toEqual(['ratio_frame', 'tenth_marks']);
  type(h, '0.32'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'inverse_ratio' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'inverse_ratio')).toBe('ratio_frame');
  for (const id of ['ratio_frame', 'tenth_marks']) expect(h.dispatch('pull_lever', { lever: id }).status, id).toBe('committed');
  expect(q(h, '[data-lever="ratio-frame"]')[0].textContent).toBe('C ÷ d = 31.4 ÷ 10 = ?');
  expect(q(h, '[data-lever="tenth-marks"]')).toHaveLength(1);
  expect(h.view.container.textContent).not.toMatch(/3\.14|3\.1\b/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/3\.14/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  // No easier discover π: any circle's answer is π.
  expect(levers(h).map(([id]) => id)).not.toContain('simpler_problem');
});

it('reverse and composite: the undo chain and the shaded corners carry no answer', () => {
  const h = mount('reverse', back);
  type(h, '81'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'no_square_root' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'no_square_root')).toBe('undo_chain');
  expect(h.dispatch('pull_lever', { lever: 'undo_chain' }).status).toBe('committed');
  expect(q(h, '[data-lever="undo-chain"]')[0].textContent).toBe('r → square it → × π → AA → ÷ π → square root → r');
  expect(h.view.container.textContent).not.toMatch(/\b9\b/);
  cleanup();
  const g = mount('composite', square);
  type(g, '113.04'); check(g);
  expect(attempts(g).at(-1)).toMatchObject({ miss: 'circle_area' });
  expect(g.dispatch('pull_lever', { lever: 'shade_corners' }).status).toBe('committed');
  expect(q(g, '[data-lever="shade-corners"]')[0].textContent).toMatch(/square the circle does not cover/);
  expect(g.view.container.textContent).not.toMatch(/30\.96/);
});

it('the simpler problem is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount('reverse', back);
  type(h, '81'); check(h);
  const r = h.dispatch('pull_lever', { lever: 'simpler_problem' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('r1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'r1' });
  expect(r.state.task!.demand).toMatchObject({ figure: 'a circle labelled C = 31.4 cm; a dashed radius labelled r = ?', learnerWork: 'nothing typed yet' });
  expect(JSON.stringify(r.state.task!.demand)).not.toMatch(/\b9\b/);
  type(h, '5'); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('r1');
  expect(h.state().task!.demand).toMatchObject({ figure: 'a circle labelled A = 254.3 cm²; a dashed radius labelled r = ?', learnerWork: 'nothing typed yet' });
  type(h, '9'); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['r1', false, false], ['r1~simpler', true, true], ['r1', true, false]]);
});
