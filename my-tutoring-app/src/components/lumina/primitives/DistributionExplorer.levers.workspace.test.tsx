// @vitest-environment jsdom
/**
 * distribution-explorer levers on the teaching workspace: a pull changes the screen and the scene fact in the same
 * commit, the next attempt records it, a refused pull changes nothing, and the easier item is ungraded practice with the
 * full item back after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../components/live-activity/runtime/observerLever';
import type { DistributionChallenge, DistributionExplorerData } from './distribution-explorer/types';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const pick = (h: WorkspaceHarness, label: string) => { h.press(label); h.press('Check'); };

const explore: DistributionChallenge = { id: 'e1', type: 'guided_exploration', prompt: 'Drag p from 0.1 to 0.9 and watch the skew.', rationale: '' };
const identify: DistributionChallenge = { id: 'i1', type: 'identify', prompt: 'Defaults among 50 loans, each 8% likely. Which family?',
  rationale: 'Fixed trials.', correctFamily: 'binomial', distractors: ['poisson', 'exponential'] };
const tail: DistributionChallenge = { id: 'c1', type: 'compute', scenario: 'X ~ Poisson(λ = 5).', prompt: 'Find P(X ≥ 3).',
  rationale: '1 − P(X ≤ 2).', correctValue: 0.8753, distractors: [0.1247, 0.735, 0.1755], decimals: 4 };
const shape: DistributionChallenge = { id: 's1', type: 'predict_shape', prompt: 'Poisson with λ = 2: what is its shape?',
  rationale: 'Tail to the right.', acceptableAnswers: ['right-skewed'], distractors: ['symmetric', 'left-skewed'] };
const lesson = (mode: DistributionExplorerData['evalMode'], c: DistributionChallenge): DistributionExplorerData => ({
  title: 'Distributions', subject: 'Probability', evalMode: mode, lessonContext: '',
  initial: { family: 'binomial', parameters: { n: 10, p: 0.5 } }, challenges: [c] });
const mount = (mode: DistributionExplorerData['evalMode'], c: DistributionChallenge) => {
  const h = mountWorkspace({ primitiveId: 'distribution-explorer', evalMode: mode, data: lesson(mode, c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('compute: the strip and the worked model draw in the same commit, print no choice, and the next attempt records them', () => {
  const h = mount('compute_advanced', tail);
  expect(levers(h)).toEqual([['event_strip', false], ['worked_model', false], ['simpler_compute', false]]);
  pick(h, '0.1247');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'complement' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'complement')).toBe('event_strip');
  expect(h.dispatch('pull_lever', { lever: 'event_strip' }).status).toBe('committed');
  expect(q(h, '[data-lever="event-strip"]')[0].textContent).toBe('Asked: 3, 4, 5, 6, … | Left out: 0, 1, 2');
  expect(String(h.state().task!.demand.onScreen)).toMatch(/strip of whole counts/);
  const before = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'event_strip' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before);
  expect(h.dispatch('pull_lever', { lever: 'worked_model' }).status).toBe('committed');
  const steps = q(h, '[data-lever="worked-model"]')[0].textContent!;
  expect(steps).toMatch(/Poisson\(λ = 7\)/);
  expect(steps).not.toMatch(/0\.8753|0\.1247|0\.735\b|0\.1755/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/0\.8753|0\.1247/);
  h.dispatch('retry');
  pick(h, '0.8753');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'c1', correct: true, levers: ['event_strip', 'worked_model'] });
});

it('identify: the facts go under every choice, name no family, and the choices keep their labels', () => {
  const h = mount('identify', identify);
  pick(h, 'Exponential');
  expect(h.dispatch('pull_lever', { lever: 'family_facts' }).status).toBe('committed');
  expect(q(h, '[data-lever="family-facts"]')).toHaveLength(3);
  for (const n of q(h, '[data-lever="family-facts"]')) expect(n.textContent).not.toMatch(/binomial|poisson|exponential/i);
  h.dispatch('retry');
  pick(h, 'Binomial');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['family_facts'] });
});

it('explore and shape: the ring and the shape card', () => {
  const h = mount('explore', explore);
  h.press('Got it');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'not_explored' });
  expect(h.dispatch('pull_lever', { lever: 'slider_glow' }).status).toBe('committed');
  expect(q(h, '[data-lever="slider-glow"]')).toHaveLength(1);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/ring glows around the p slider/);
  cleanup();
  const g = mount('compute_advanced', shape);
  pick(g, 'left-skewed');
  expect(attempts(g).at(-1)).toMatchObject({ miss: 'reversed_skew' });
  expect(g.dispatch('pull_lever', { lever: 'shape_guide' }).status).toBe('committed');
  expect(q(g, '[data-lever="shape-guide"] li')).toHaveLength(3);
});

it('the easier item is ungraded practice; the full item comes back blank and is credited after', () => {
  const h = mount('compute_advanced', tail);
  pick(h, '0.1247');
  const r = h.dispatch('pull_lever', { lever: 'simpler_compute' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('c1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'c1' });
  expect(String(r.state.task!.task)).toMatch(/Poisson\(λ = 7\)\. Find P\(X = 3\)/);
  // P(X = 3) for λ = 7.
  pick(h, '0.0521');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c1');
  expect(String(h.state().task!.demand.learnerWork)).toBe('nothing picked yet');
  pick(h, '0.8753');
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['c1', false, false], ['c1~simpler', true, true], ['c1', true, false]]);
});
