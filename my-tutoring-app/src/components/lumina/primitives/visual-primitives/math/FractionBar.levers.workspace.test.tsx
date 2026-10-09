// @vitest-environment jsdom
/**
 * fraction-bar three-step levers (`fractionBarLevers.ts`: identify, build, compare, add_subtract), mounted the way a
 * lesson mounts it. The model is a different fraction; the counting levers show the learner's own bar; the practice
 * fraction is ungraded and gives the full item back from step one; only the full item's answer is credited, with the
 * levers recorded.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever, observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { FractionBarChallenge, FractionBarChallengeType, FractionBarData } from './FractionBar';
import { fractionBarMiss, type FractionBarPhase } from './fractionBarWorkspace';
import {
  MODEL_LEVER, NUMBER_PARTS_LEVER, SMALLER_FRACTION_LEVER, STEP_COUNT_LEVER, modelFraction, modelLeaks, practiceLeaks,
  smallerFraction, stepLeverFacts, stepLevers,
} from './fractionBarLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

type Step = Exclude<FractionBarChallengeType, 'build_equal'>;
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
/** Every fraction the generator can make per mode (`gemini-fraction-bar.ts` *Operands). */
const WINDOWS: Record<Step, Array<[number, number]>> = {
  identify: [2, 3, 4, 6, 8].map(d => [1, d]),
  build: range(3, 6).flatMap(d => range(2, d - 1).map(n => [n, d] as [number, number])),
  compare: range(4, 12).flatMap(d => range(1, d - 1).map(n => [n, d] as [number, number])),
  add_subtract: range(3, 10).flatMap(d => range(1, d - 1).map(n => [n, d] as [number, number])),
};
const PLAINEST: Record<Step, number> = { identify: 2, build: 3, compare: 4, add_subtract: 3 };
const make = (id: string, n: number, d: number): FractionBarChallenge => ({ id, numerator: n, denominator: d,
  numeratorChoices: [n, d, d + 1, d + 2], denominatorChoices: [d, n, d + 1, d + 2] });
const OFF = { readout: false, numerals: false };

describe('the lever rules', () => {
  it.each(Object.keys(WINDOWS) as Step[])('%s: every fraction gets a model that shares no number with it', mode => {
    for (const [n, d] of WINDOWS[mode]) {
      const model = modelFraction({ numerator: n, denominator: d })!;
      expect(model, `${n}/${d}`).toBeTruthy();
      expect(modelLeaks({ numerator: n, denominator: d }, model)).toBe(false);
      expect([model.numerator, model.denominator]).not.toContain(n);
      expect([model.numerator, model.denominator]).not.toContain(d);
    }
  });
  it('the model leak rule catches a shared number and an equal value', () => {
    expect(modelLeaks({ numerator: 3, denominator: 5 }, { numerator: 3, denominator: 4 })).toBe(true);
    expect(modelLeaks({ numerator: 3, denominator: 5 }, { numerator: 2, denominator: 5 })).toBe(true);
    expect(modelLeaks({ numerator: 1, denominator: 2 }, { numerator: 3, denominator: 6 })).toBe(true);
    expect(modelLeaks({ numerator: 3, denominator: 5 }, { numerator: 4, denominator: 7 })).toBe(false);
  });
  it.each(Object.keys(WINDOWS) as Step[])('%s: the practice fraction has fewer parts, stays in the window, two choices, never the item', mode => {
    const window = WINDOWS[mode];
    for (const [n, d] of window) {
      const item = make('c', n, d);
      const p = smallerFraction(mode, item);
      if (d === PLAINEST[mode]) { expect(p, `${n}/${d}`).toBeNull(); continue; }
      expect(p, `${n}/${d}`).toBeTruthy();
      expect(p!.id).toBe('c~smaller');
      expect(p!.denominator).toBeLessThan(d);
      expect(window).toContainEqual([p!.numerator, p!.denominator]);
      expect(practiceLeaks(item, p!)).toBe(false);
      expect(p!.numerator * d).not.toBe(n * p!.denominator);
      expect([...p!.numeratorChoices].sort()).toEqual([p!.numerator, p!.denominator].sort());
      expect([...p!.denominatorChoices].sort()).toEqual([p!.numerator, p!.denominator].sort());
    }
  });
  it.each<[FractionBarPhase, number | null, number, string | undefined]>([
    ['identify-numerator', 5, 0, 'chose_denominator'], ['identify-numerator', 4, 0, 'other_numerator'],
    ['identify-numerator', 3, 0, undefined], ['identify-denominator', 3, 0, 'chose_numerator'],
    ['identify-denominator', 6, 0, 'other_denominator'], ['build-fraction', null, 5, 'shaded_all'],
    ['build-fraction', null, 2, 'shaded_the_rest'], ['build-fraction', null, 4, 'one_over'],
    ['build-fraction', null, 1, 'short_by_more'], ['build-fraction', null, 3, undefined],
  ])('3/5 at %s, picked %s, shaded %s: %s', (phase, picked, shaded, miss) => {
    expect(fractionBarMiss(make('c', 3, 5), { phase, picked, shaded })).toBe(miss);
  });
  it.each<[FractionBarPhase, string, string[], string | null]>([
    ['identify-numerator', 'chose_denominator', [], MODEL_LEVER],
    ['identify-numerator', 'chose_denominator', [MODEL_LEVER], SMALLER_FRACTION_LEVER],
    ['identify-denominator', 'other_denominator', [], MODEL_LEVER],
    ['build-fraction', 'one_over', [], STEP_COUNT_LEVER],
    ['build-fraction', 'one_short', [STEP_COUNT_LEVER], NUMBER_PARTS_LEVER],
    ['build-fraction', 'short_by_more', [STEP_COUNT_LEVER, NUMBER_PARTS_LEVER], SMALLER_FRACTION_LEVER],
    ['build-fraction', 'shaded_the_rest', [], MODEL_LEVER],
    ['build-fraction', 'shaded_all', [MODEL_LEVER], SMALLER_FRACTION_LEVER],
  ])('build 3/5 at %s, after %s with %j pulled, the next lever is %s', (phase, miss, pulled, want) => {
    expect(nextLever(stepLevers('build', make('c', 3, 5), phase, pulled, OFF), miss)).toBe(want);
  });
  it('the plainest item (identify 1/2) has the model only; spent, a pick miss has no lever', () => {
    expect(stepLevers('identify', make('c', 1, 2), 'identify-numerator', [], OFF).map(l => l.id)).toEqual([MODEL_LEVER]);
    expect(nextLever(stepLevers('identify', make('c', 1, 2), 'identify-numerator', [MODEL_LEVER], OFF), 'chose_denominator')).toBeNull();
  });
  it('the tier starts the counting levers pulled; the pick steps have no counting levers', () => {
    const shade = stepLevers('build', make('c', 3, 5), 'build-fraction', [], { readout: true, numerals: true });
    expect(shade.filter(l => l.pulled).map(l => l.id)).toEqual([STEP_COUNT_LEVER, NUMBER_PARTS_LEVER]);
    expect(stepLevers('build', make('c', 3, 5), 'identify-numerator', [], OFF).map(l => l.id)).toEqual([MODEL_LEVER, SMALLER_FRACTION_LEVER]);
    expect(stepLevers('build_equal', make('c', 3, 5), 'build-fraction', [], OFF)).toEqual([]);
  });
  it('the facts say what is drawn: the model\'s own numbers, never the item\'s', () => {
    const [fact] = stepLeverFacts('build', make('c', 3, 5), 'identify-numerator', [MODEL_LEVER]);
    expect(fact).toMatch(/4\/7/);
    expect(fact).not.toMatch(/\b3\b|\b5\b/);
    expect(stepLeverFacts('build', make('c', 3, 5), 'identify-numerator', [STEP_COUNT_LEVER])).toEqual([]);
  });
});

const lesson = (mode: Step, challenges: FractionBarChallenge[], tier = OFF): FractionBarData => ({ title: 'Fractions',
  description: 'Bars', challengeType: mode, challenges, showDecimal: false, showShadedReadout: tier.readout,
  showPartitionNumerals: tier.numerals });
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const pick = (h: WorkspaceHarness, n: number) => { h.press(String(n)); h.press('Check Answer'); };
const shade = (h: WorkspaceHarness, n: number) => { h.touch(`part-${n - 1}`); h.press('Submit Fraction'); };

it('a swapped pick, then the model: drawn in the same commit, a different fraction, recorded on the credited answer', () => {
  const h = mountWorkspace({ primitiveId: 'fraction-bar', evalMode: 'build', data: lesson('build', [make('q1', 3, 5)]) as never });
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[MODEL_LEVER, false], [SMALLER_FRACTION_LEVER, false]]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  pick(h, 5);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'chose_denominator' });
  expect(observerLever(h.state(), true)).toBe(MODEL_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: MODEL_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="model_fraction"]')).toHaveLength(1);
  expect(q(h, '[data-model-part="shaded"]')).toHaveLength(4);
  expect(q(h, '[data-model-part]')).toHaveLength(7);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/4\/7.*numerator.*denominator/);

  // A refused pull (already pulled) changes nothing: not the scene, the levers or the attempts.
  const before = { demand: h.state().task!.demand, levers: levers(h), attempts: attempts(h).length };
  expect(h.dispatch('pull_lever', { lever: MODEL_LEVER }).status).toBe('blocked');
  expect({ demand: h.state().task!.demand, levers: levers(h), attempts: attempts(h).length }).toEqual(before);
  expect(q(h, '[data-lever="model_fraction"]')).toHaveLength(1);

  h.dispatch('retry');
  pick(h, 3); pick(h, 5);
  // The shade step adds the counting levers, released on this (hard) item.
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[STEP_COUNT_LEVER, false], [NUMBER_PARTS_LEVER, false],
    [MODEL_LEVER, true], [SMALLER_FRACTION_LEVER, false]]);
  shade(h, 4);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'one_over' });
  expect(observerLever(h.state(), true)).toBe(STEP_COUNT_LEVER);
  const count = h.dispatch('pull_lever', { lever: STEP_COUNT_LEVER });
  expect(count.status).toBe('committed');
  expect(q(h, '[data-lever="running_count"]')).toHaveLength(1);
  expect(count.state.task!.demand).toMatchObject({ partsShaded: 4 });
  expect(String(count.state.task!.demand.onScreen)).toMatch(/how many parts the learner has shaded/);
  h.dispatch('retry');
  h.touch('part-2');
  // The count never turns into a verdict: nothing goes green at the right number.
  expect(q(h, '[data-lever="running_count"] .text-emerald-300')).toHaveLength(0);
  expect(h.view.container.querySelector('[data-pip-object="part-0"]')!.parentElement!.className).not.toMatch(/emerald/);
  h.press('Submit Fraction');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'q1', correct: true, assisted: true, levers: [MODEL_LEVER, STEP_COUNT_LEVER] });
  h.close();
});

it('the practice fraction is ungraded and keeps its step on Try again; the full item comes back at step one and is credited', () => {
  const h = mountWorkspace({ primitiveId: 'fraction-bar', evalMode: 'build', data: lesson('build', [make('q1', 3, 5)]) as never });
  pick(h, 5);
  h.dispatch('pull_lever', { lever: MODEL_LEVER });
  const receipt = h.dispatch('pull_lever', { lever: SMALLER_FRACTION_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.state().task).toMatchObject({ itemId: 'q1~smaller' });
  expect(h.state().task!.demand).toMatchObject({ printedFraction: '2/3', step: 'numerator' });
  expect(levers(h)).toEqual([]);
  // The model is the session item's; it is not drawn on the practice item. Two choices per pick.
  expect(q(h, '[data-lever="model_fraction"]')).toHaveLength(0);
  expect(Array.from(h.view.container.querySelectorAll('button')).map(b => b.textContent!.trim()).filter(t => /^\d+$/.test(t)))
    .toEqual(['3', '2']);
  pick(h, 3);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'q1~smaller', correct: false, miss: 'chose_denominator' });
  h.dispatch('retry');
  expect(h.state().task).toMatchObject({ itemId: 'q1~smaller' });
  pick(h, 2); pick(h, 3); shade(h, 2);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'q1~smaller', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'q1' });
  expect(h.state().task!.demand).toMatchObject({ printedFraction: '3/5', step: 'numerator' });
  expect(q(h, '[data-lever="model_fraction"]')).toHaveLength(1);
  pick(h, 3); pick(h, 5); shade(h, 3);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['q1', false, false], ['q1~smaller', false, true], ['q1~smaller', true, true], ['q1', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ assisted: true, levers: [MODEL_LEVER, SMALLER_FRACTION_LEVER] });
  h.close();
});

it('the tier\'s readout and numerals are starting positions, not pulls', () => {
  const h = mountWorkspace({ primitiveId: 'fraction-bar', evalMode: 'identify',
    data: lesson('identify', [make('q1', 1, 4)], { readout: true, numerals: true }) as never });
  pick(h, 1); pick(h, 4);
  expect(levers(h).filter(l => l.pulled).map(l => l.id)).toEqual([STEP_COUNT_LEVER, NUMBER_PARTS_LEVER]);
  expect(q(h, '[data-lever="running_count"]')).toHaveLength(1);
  expect(q(h, '[data-lever="number_parts"]')).toHaveLength(1);
  expect(h.dispatch('pull_lever', { lever: STEP_COUNT_LEVER }).status).toBe('blocked');
  shade(h, 1);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  expect(attempts(h).at(-1)!.levers).toBeUndefined();
  h.close();
});
