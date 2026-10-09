// @vitest-environment jsdom
/**
 * Distribution explorer on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../components/live-activity/activityContract';
import { workspaceBinding } from '../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../service/manifest/catalog';
import type { DistributionChallenge, DistributionExplorerData } from './distribution-explorer/types';
import { DISTRIBUTION_MISSES_BY_MODE, computeMiss, distributionMiss } from './distribution-explorer/distributionExplorerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const button = (h: WorkspaceHarness, label: string) =>
  Array.from(h.view.container.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label);
const slide = (h: WorkspaceHarness, label: string, value: string) => act(() => {
  const input = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, label).toBeTruthy();
  fireEvent.change(input!, { target: { value } });
});

const explore: DistributionChallenge = { id: 'e1', type: 'guided_exploration', prompt: 'Drag p from 0.1 to 0.9. What happens to the skew?',
  rationale: 'At p = 0.5 the binomial is symmetric.' };
const identify: DistributionChallenge = { id: 'i1', type: 'identify', prompt: 'Defaults among 50 independent loans, each 8% likely. Which family?',
  rationale: 'Fixed trials, same success chance: binomial.', correctFamily: 'binomial', distractors: ['poisson', 'exponential'] };
const compute: DistributionChallenge = { id: 'c1', type: 'compute', scenario: 'Claims arrive at λ = 3 per day.', prompt: 'P(no claims tomorrow) = ?',
  rationale: 'e^-3 = 0.0498.', correctValue: 0.0498, distractors: [0.1494, 0.9502, 0.0025], decimals: 4 };
const shape: DistributionChallenge = { id: 's1', type: 'predict_shape', prompt: 'Poisson with λ = 2: what is its shape?',
  rationale: 'The tail runs to the right.', acceptableAnswers: ['right-skewed', 'skewed right'], distractors: ['symmetric', 'left-skewed'] };
const lesson = (mode: DistributionExplorerData['evalMode'], challenges: DistributionChallenge[]): DistributionExplorerData => ({
  title: 'Distributions', subject: 'Probability', evalMode: mode, lessonContext: 'Counting claims.',
  initial: { family: mode === 'explore' ? 'binomial' : 'poisson', parameters: mode === 'explore' ? { n: 10, p: 0.5 } : { lambda: 3 } }, challenges });

type Case = { mode: string; data: DistributionExplorerData; wrong: () => (h: WorkspaceHarness) => void; miss: string;
  right: (h: WorkspaceHarness) => void; secret: RegExp };
const pick = (label: string) => (h: WorkspaceHarness) => { h.press(label); h.press('Check'); };
const CASES: Case[] = [
  { mode: 'explore', data: lesson('explore', [explore]), wrong: () => h => h.press('Got it'), miss: 'not_explored',
    right: h => { slide(h, 'p (success probability)', '0.8'); h.press('Got it'); }, secret: /symmetric at|At p = 0\.5/ },
  { mode: 'identify', data: lesson('identify', [identify]), wrong: () => pick('Exponential'), miss: 'discrete_continuous',
    right: pick('Binomial'), secret: /Fixed trials/ },
  { mode: 'compute_basic', data: lesson('compute_basic', [compute]), wrong: () => pick('0.9502'), miss: 'complement',
    right: pick('0.0498'), secret: /e\^-3/ },
  { mode: 'compute_advanced', data: lesson('compute_advanced', [shape, compute]), wrong: () => pick('left-skewed'), miss: 'reversed_skew',
    right: pick('right-skewed'), secret: /tail runs/ },
];

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('distribution-explorer')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(DISTRIBUTION_MISSES_BY_MODE);
  for (const { mode, data } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'distribution-explorer', pin: mode, objectiveIds: ['o'],
      data: data as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss and Try again clears it; the right one completes',
  async ({ mode, data, wrong, miss, right, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'distribution-explorer', evalMode: mode, data: data as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(h.state().task)).not.toMatch(/correctFamily|correctValue|acceptableAnswers|rationale/);
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/Next challenge/);

    wrong()(h);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    // A wrong check shows neither the rationale nor the key.
    expect(h.view.container.textContent).not.toMatch(secret);
    expect(h.view.container.querySelector('button[aria-label].bg-emerald-500\\/15')).toBeNull();
    // Closed until Try again, which clears the pick.
    const first = mode === 'explore' ? 'Got it' : mode === 'identify' ? 'Binomial' : mode === 'compute_basic' ? '0.0498' : 'right-skewed';
    expect(button(h, first)!.disabled).toBe(true);
    h.dispatch('retry');
    expect(button(h, first)!.disabled).toBe(false);
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/nothing picked yet|has not moved/);

    right(h);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    if (mode === 'compute_advanced') {
      h.dispatch('advance'); h.confirmVisible();
      pick('0.0498')(h);
    }
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('identify hides the family on the workbench; compute hides the moments until the check', () => {
  const h = mountWorkspace({ primitiveId: 'distribution-explorer', evalMode: 'identify',
    data: { ...lesson('identify', [identify]), initial: { family: 'binomial', parameters: { n: 50, p: 0.08 } } } as unknown as Record<string, unknown> });
  const text = () => h.view.container.textContent ?? '';
  expect(text()).toMatch(/Mystery distribution/);
  expect(text()).not.toMatch(/Bernoulli|n \(trials\)|Parameters/);
  expect(String(h.state().task!.demand.workbench)).not.toMatch(/Binomial/);
  cleanup();
  const g = mountWorkspace({ primitiveId: 'distribution-explorer', evalMode: 'compute_basic', data: lesson('compute_basic', [compute]) as unknown as Record<string, unknown> });
  expect(g.view.container.textContent).not.toMatch(/Mean μ|Variance σ²/);
  pick('0.0498')(g);
  expect(g.view.container.textContent).toMatch(/Mean μ/);
});

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'distribution-explorer', evalMode: 'compute_basic', data: lesson('compute_basic', [compute]) as unknown as Record<string, unknown> });
  pick('0.0498')(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('distributionMiss names the pattern the pick shows', () => {
  const w = (picked: string | null, explored = false) => ({ picked, explored, family: 'poisson' as const, params: { lambda: 3 } });
  expect(distributionMiss(explore, w(null))).toBe('not_explored');
  expect(distributionMiss(explore, w(null, true))).toBeUndefined();
  expect(distributionMiss(identify, w('poisson'))).toBe('binomial_poisson');
  expect(distributionMiss(identify, w('exponential'))).toBe('discrete_continuous');
  expect(distributionMiss(identify, w('binomial'))).toBeUndefined();
  expect(computeMiss(0.9502, 0.0498)).toBe('complement');
  expect(computeMiss(0.25, 4)).toBe('reciprocal');
  expect(computeMiss(0.0548, 0.0498)).toBe('near_value');
  expect(computeMiss(16, 4)).toBe('wrong_value');
  expect(distributionMiss(shape, w('left-skewed'))).toBe('reversed_skew');
  expect(distributionMiss(shape, w('symmetric'))).toBe('said_symmetric');
  expect(distributionMiss(shape, w('uniform'))).toBe('wrong_shape');
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['distribution-explorer'].validate;
  expect(() => validate(lesson('compute_basic', [{ ...compute, distractors: [0.04981] } as DistributionChallenge]))).toThrow();
  expect(() => validate(lesson('identify', [{ ...identify, distractors: [] } as DistributionChallenge]))).toThrow();
  expect(validate(lesson('compute_advanced', [explore, identify, compute, shape]))).toBeTruthy();
});
