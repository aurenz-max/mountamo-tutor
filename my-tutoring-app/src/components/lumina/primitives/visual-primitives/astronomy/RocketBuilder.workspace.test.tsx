// @vitest-environment jsdom
/**
 * rocket-builder on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every mode is a code-keyed closed choice, tapped and checked or said aloud: the key is published only as the spoken
 * expectedAnswer. Nothing launches before the check (add_to_lift launches the learner's own part after any check). A
 * wrong answer names its miss, and every miss has a help lever first.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { RocketBuilderData } from './RocketBuilder';
import {
  askOf, buildRocketItems, costOf, flightOf, keyOf, lifts, optionCount, pushOf, revealText, ROCKET_MISSES,
  rocketCorrect, rocketHarnessAnswers, rocketItems, rocketMiss, seededRng, tanksOf, validRocketItem, weightOf,
  workspaceAssignment, workspaceScene,
  type AddItem, type BudgetItem, type LiftItem, type Part, type ReachItem, type RocketItem, type RocketMode, type RocketTier,
} from './rocketWorkspace';
import {
  COUNT_LEVER, DROP_LEVER, FUEL_CARD_LEVER, leverFacts, LIFT_CARD_LEVER, NO_LEVERS, OWN_WEIGHT_LEVER, possibleMisses,
  rocketLevers,
} from './rocketLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: RocketMode[] = ['can_it_lift', 'add_to_lift', 'on_budget', 'reach_target'];
const TIERS: RocketTier[] = ['easy', 'medium', 'hard'];

const E = (push: number, weight: number, extra: Partial<Part> = {}): Part => ({ kind: 'engine', push, weight, ...extra });
const T = (extra: Partial<Part> = {}): Part => ({ kind: 'tank', weight: 2, ...extra });
const C = (weight: number, extra: Partial<Part> = {}): Part => ({ kind: 'capsule', weight, ...extra });

// Hand-built items: two engines whose push only equals the weight; a grounded rocket whose biggest-push option is too
// heavy; a budget where one rocket is over and one stays down; three rockets where the one with the most fuel never lifts.
const LIFT: LiftItem = { id: 'can_it_lift-1', mode: 'can_it_lift', rocket: { color: 'red', parts: [E(3, 1), E(3, 1), T(), C(2)] } };
const ADD: AddItem = { id: 'add_to_lift-1', mode: 'add_to_lift', rocket: { color: 'red', parts: [E(3, 1), T(), C(2)] },
  options: [E(8, 6, { color: 'green' }), T(), E(5, 2, { color: 'red' }), E(2, 1, { color: 'blue' })] };
const BUDGET: BudgetItem = { id: 'on_budget-1', mode: 'on_budget', budget: 8, rockets: [
  { color: 'red', parts: [E(6, 1, { cost: 3 }), T({ cost: 2 }), C(2, { cost: 2 })] },
  { color: 'blue', parts: [E(8, 1, { cost: 4 }), T({ cost: 2 }), C(1, { cost: 3 })] },
  { color: 'green', parts: [E(3, 1, { cost: 2 }), T({ cost: 1 }), C(2, { cost: 1 })] }] };
const REACH: ReachItem = { id: 'reach_target-1', mode: 'reach_target', ask: 'highest', rockets: [
  { color: 'red', parts: [E(9, 1), T(), T(), C(2)] },
  { color: 'blue', parts: [E(9, 1), T(), T(), T(), T(), C(2)] },
  { color: 'green', parts: [E(9, 1), T(), T(), C(2)], staged: true }] };
const BY_MODE: Record<RocketMode, RocketItem[]> = { can_it_lift: [LIFT], add_to_lift: [ADD], on_budget: [BUDGET], reach_target: [REACH] };

const data = (mode: RocketMode): RocketBuilderData =>
  ({ title: 'Ready for Lift-Off?', overview: 'Predict.', challengeTypes: [mode], items: BY_MODE[mode], gradeLevel: '4' });
const mount = (mode: RocketMode) => {
  const h = mountWorkspace({ primitiveId: 'rocket-builder', evalMode: mode, instanceId: 'rocket-builder', data: data(mode) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const launches = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('[data-launch]')).map(e => e.getAttribute('data-launch'));
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/check/i); h.settle(); };
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds with its key out of the scene and nothing launched', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(validRocketItem(item)).toBe(true);
  expect(getComponentById('rocket-builder')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(launches(h).every(l => l === 'none')).toBe(true);
  expect(text(h)).not.toMatch(/Next →|Finish|\bkg\b|\bkN\b|ratio/);
  expect(demand(h).credited).toBeUndefined();
  expect(demand(h).flight).toBeUndefined();
  expect(demand(h).response).toBe('speech');
  const expected = { can_it_lift: /^"No, it stays on the pad" \(choice 2 of 2\): "no"/, add_to_lift: /^"Red engine" \(choice 3 of 4\): "the red engine"/,
    on_budget: /^"Red rocket" \(choice 1 of 3\)/, reach_target: /^"Green rocket" \(choice 3 of 3\)/ }[mode];
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(expected);
  h.close();
});

it('can_it_lift: "yes" on equal push and weight names said_equal_lifts; lift_card comes first; the right answer is helped', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('can_it_lift');
  expect(levers(h)).toEqual([COUNT_LEVER, LIFT_CARD_LEVER]);
  answer(h, 'Yes, it lifts off');
  expect(last(h)).toMatchObject({ correct: false, miss: 'said_equal_lifts' });
  expect(launches(h)).toEqual(['none']);
  expect(nextLever(h.state().task!.workspace!.levers!, 'said_equal_lifts')).toBe(LIFT_CARD_LEVER);
  expect(h.dispatch('pull_lever', { lever: LIFT_CARD_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="lift-card"]')!.textContent).toMatch(/push is more than its weight/);
  expect(h.dispatch('pull_lever', { lever: COUNT_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-count]').length).toBe(6);
  expect(String(demand(h).onScreen)).toMatch(/no total is shown/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'No, it stays on the pad');
  expect(last(h)).toMatchObject({ correct: true, assisted: true });
  expect(launches(h)).toEqual(['stays']);
  expect(text(h)).toMatch(/only as big as its weight/);
  h.dispatch('advance'); h.confirmVisible(); h.settle(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'rocket-builder', challengeType: 'can_it_lift' });
  h.close();
});

it('add_to_lift: the heavy engine names heavy_engine and its own launch stays down; own_weight and drop_one', () => {
  const h = mount('add_to_lift');
  expect(levers(h)).toEqual([COUNT_LEVER, OWN_WEIGHT_LEVER, LIFT_CARD_LEVER, DROP_LEVER]);
  answer(h, 'Green engine');
  expect(last(h)).toMatchObject({ correct: false, miss: 'heavy_engine' });
  expect(launches(h)).toEqual(['stays']);
  expect(String(demand(h).flight)).toMatch(/green engine was added and the rocket still stayed/);
  expect(nextLever(h.state().task!.workspace!.levers!, 'heavy_engine')).toBe(OWN_WEIGHT_LEVER);
  expect(h.dispatch('pull_lever', { lever: OWN_WEIGHT_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-own-weight]').length).toBe(4);
  expect(h.dispatch('pull_lever', { lever: DROP_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('button[aria-label="Fuel tank"]')!.hasAttribute('disabled')).toBe(true);
  expect(String(demand(h).onScreen)).toMatch(/fuel tank is greyed out/);
  h.dispatch('retry'); h.confirmVisible();
  expect(launches(h)).toEqual(['none']);
  answer(h, 'Red engine');
  expect(last(h)).toMatchObject({ correct: true, assisted: true });
  expect(launches(h)).toEqual(['up']);
  h.close();
  expect(rocketMiss(ADD, { pick: 3 })).toBe('too_weak');
  expect(rocketMiss(ADD, { pick: 1 })).toBe('added_no_push');
});

it('on_budget: over_budget, then count_marks writes the coins; said aloud and credited, every rocket launches', async () => {
  const h = mount('on_budget');
  expect(levers(h)).toEqual([COUNT_LEVER, LIFT_CARD_LEVER, DROP_LEVER]);
  answer(h, 'Blue rocket');
  expect(last(h)).toMatchObject({ correct: false, miss: 'over_budget' });
  expect(launches(h).every(l => l === 'none')).toBe(true);
  expect(nextLever(h.state().task!.workspace!.levers!, 'over_budget')).toBe(COUNT_LEVER);
  expect(h.dispatch('pull_lever', { lever: COUNT_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/and coins; no total/);
  h.dispatch('retry'); h.confirmVisible();
  h.say('the red rocket'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  h.close();
  expect(rocketMiss(BUDGET, { pick: 2 })).toBe('no_lift');
});

it('reach_target: the rocket with the most fuel names picked_no_lift; fuel_card; the key credits and all launch', () => {
  const h = mount('reach_target');
  expect(levers(h)).toEqual([COUNT_LEVER, FUEL_CARD_LEVER, DROP_LEVER]);
  answer(h, 'Blue rocket');
  expect(last(h)).toMatchObject({ correct: false, miss: 'picked_no_lift' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'picked_no_lift')).toBe(FUEL_CARD_LEVER);
  expect(h.dispatch('pull_lever', { lever: FUEL_CARD_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="fuel-card"]')!.textContent).toMatch(/fuel is heavy/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'Green rocket');
  expect(last(h)).toMatchObject({ correct: true, assisted: true });
  expect(launches(h)).toEqual(['up', 'stays', 'up']);
  expect(text(h)).toMatch(/drops each fuel tank/);
  h.close();
  expect(rocketMiss(REACH, { pick: 0 })).toBe('picked_lower');
});

describe('the pure rules', () => {
  const all = (mode: RocketMode) => TIERS.flatMap(tier => [1, 2, 3, 4, 5].flatMap(seed =>
    buildRocketItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) }).map(i => ({ i, tier }))));

  it.each(MODES)('%s builds four valid, keyed items at every tier', mode => {
    for (const tier of TIERS) for (const seed of [1, 2, 3, 4, 5]) {
      const items = buildRocketItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) });
      expect(items, `${mode} ${tier} ${seed}`).toHaveLength(4);
      for (const i of items) expect(validRocketItem(i), `${mode} ${tier} ${i.id}`).toBe(true);
    }
  });

  it('the tiers are structural', () => {
    for (const { i, tier } of all('can_it_lift')) {
      const it = i as LiftItem, gap = Math.abs(pushOf(it.rocket) - weightOf(it.rocket));
      const engines = it.rocket.parts.filter(p => p.kind === 'engine').length;
      expect(engines).toBe(tier === 'hard' ? 2 : 1);
      if (tier === 'easy') expect(gap).toBeGreaterThanOrEqual(3);
      if (tier === 'medium') expect([1, 2]).toContain(gap);
      if (tier === 'hard') expect(gap).toBeLessThanOrEqual(1);
    }
    for (const { i, tier } of all('add_to_lift')) {
      const it = i as AddItem;
      expect(it.options.length).toBe(tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4);
      const key = it.options[keyOf(it)];
      // hard: the engine with the biggest push is never the answer.
      if (tier === 'hard') expect(Math.max(...it.options.map(p => p.push ?? 0))).toBeGreaterThan(key.push!);
    }
    for (const { i, tier } of all('on_budget')) {
      const it = i as BudgetItem;
      expect(it.rockets.length).toBe(tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4);
      if (tier === 'hard') expect(it.rockets.some(r => costOf(r) === it.budget + 1)).toBe(true);
    }
    for (const { i, tier } of all('reach_target')) {
      const it = i as ReachItem;
      expect(it.rockets.length).toBe(tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4);
      if (tier === 'hard') {
        // The rocket with the most fuel never lifts off.
        const most = it.rockets.reduce((a, b) => (tanksOf(b) > tanksOf(a) ? b : a));
        expect(lifts(most)).toBe(false);
        expect(it.rockets.filter(r => !lifts(r)).length).toBe(1);
      }
    }
    // The key moves: every mode's key sits in more than one place, and can_it_lift asks both answers.
    for (const mode of MODES) expect(new Set(all(mode).map(({ i }) => keyOf(i))).size, mode).toBeGreaterThan(1);
  });

  it('add_to_lift: no fixed strategy wins every item at any tier', () => {
    // A learner who never counts: the first engine, the biggest push, the first option, the lightest part (screen order
    // breaks ties). Each must lose a real share of items at every tier (coordinator 10-16).
    const pick = {
      always_engine: (i: AddItem) => i.options.findIndex(p => p.kind === 'engine'),
      biggest_push: (i: AddItem) => i.options.reduce((b, p, k) => ((p.push ?? 0) > (i.options[b].push ?? 0) ? k : b), 0),
      always_first: () => 0,
      lightest: (i: AddItem) => i.options.reduce((b, p, k) => (p.weight < i.options[b].weight ? k : b), 0),
    };
    for (const tier of TIERS) {
      const items = Array.from({ length: 40 }, (_, s) => buildRocketItems({ modes: ['add_to_lift'], tier, rng: seededRng(`strat${tier}${s}`) }))
        .flat() as AddItem[];
      for (const [name, f] of Object.entries(pick)) {
        const rate = items.filter(i => f(i) === keyOf(i)).length / items.length;
        expect(rate, `${tier} ${name} wins ${(rate * 100).toFixed(0)}%`).toBeLessThanOrEqual(0.75);
      }
      if (tier !== 'easy') expect(items.filter(i => pick.biggest_push(i) === keyOf(i)).length / items.length, tier).toBeLessThanOrEqual(tier === 'hard' ? 0 : 0.6);
    }
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('rocket-builder')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...ROCKET_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        const ls = rocketLevers(i, NO_LEVERS);
        const misses = possibleMisses(i);
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(ROCKET_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
        const a = rocketHarnessAnswers(i);
        expect(rocketCorrect(i, a.correct), i.id).toBe(true);
        expect(rocketCorrect(i, a.plainWrong), i.id).toBe(false);
        expect(rocketMiss(i, a.plainWrong), i.id).toBeDefined();
      }
    }
  });

  it('no ask, scene or lever line states the key, a total, or the comparison before the answer', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = { ...NO_LEVERS, pulled: rocketLevers(i, NO_LEVERS).filter(l => l.kind === 'help').map(l => l.id) };
      const scene = workspaceScene(i, { work: { pick: null }, solved: false, flown: false });
      const lines = [askOf(i), String(scene.facts!.shown), leverFacts(i, s) ?? '',
        ...Object.entries(scene.facts!).filter(([k]) => k.startsWith('rocket_')).map(([, v]) => String(v))];
      for (const v of Object.values(scene.facts!)) expect(String(v).length, i.id).toBeLessThanOrEqual(500);
      expect(scene.facts!.flight).toBeUndefined();
      expect(scene.facts!.credited).toBeUndefined();
      for (const l of lines) {
        expect(l, `${i.id}: ${l}`).not.toMatch(/\b(in all|altogether|total of \d|more push than|less push than|over budget)\b/i);
        expect(l, `${i.id}: ${l}`).not.toMatch(/\b(red|blue|green|yellow|purple) (rocket|engine) (lifts|stays|cannot|never|flies|is too|costs too)/i);
      }
    }
  });

  it('the reveal explains the key', () => {
    for (const mode of MODES) for (const { i } of all(mode)) expect(revealText(i).length, i.id).toBeGreaterThan(20);
    expect(revealText(REACH)).toMatch(/green rocket flies highest: compared with the red rocket, it drops each fuel tank/);
    expect(flightOf(REACH.rockets[1])).toBe(0);
  });

  it('a legacy payload (parts library, target altitude; no items) still builds code items by grade', () => {
    const legacy = { title: 'Space Launch', gradeLevel: '1', availableComponents: [], targetAltitudeKm: 15 };
    const items = rocketItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['can_it_lift']));
    expect(rocketItems(legacy)).toEqual(items);
    expect(items.every(i => optionCount(i) === 2)).toBe(true);
  });
});
