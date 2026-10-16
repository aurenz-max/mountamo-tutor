// @vitest-environment jsdom
/**
 * transport-challenge on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every mode is a code-keyed pick of one vehicle, tapped and checked or said aloud: the key is published only as the
 * spoken expectedAnswer, and no trips or totals are on screen before a pick is checked. A wrong pick names its miss,
 * and every miss has a help lever first.
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
import type { TransportChallengeData } from './TransportChallenge';
import {
  askOf, buildItem, buildTransportItems, DEFAULT_FRAMES, fillsEvenly, keyVehicle, seededRng, totalFor, TRANSPORT_MISSES,
  transportCorrect, transportHarnessAnswers, transportItems, transportMiss, tripsFor, validTransportItem, vehicleMiss,
  workspaceAssignment, type TransportItem, type TransportMode, type TransportTier,
} from './transportWorkspace';
import {
  leverFact, leverLeak, possibleMisses, SHOW_TRIPS_LEVER, simplerItem, SMALLER_JOB_LEVER, TIMES_SETUP_LEVER, timesLines,
  transportLevers, tripLine,
} from './transportLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: TransportMode[] = ['single_constraint', 'multi_constraint', 'full_optimization'];
const TIERS: TransportTier[] = ['easy', 'medium', 'hard'];

const car = { id: 'car', name: 'Car', emoji: '🚗', capacity: 4, cost: 15, hours: 1, co2: 5 };
const minivan = { id: 'minivan', name: 'Minivan', emoji: '🚐', capacity: 8, cost: 25, hours: 1, co2: 8 };
const shuttle = { id: 'shuttle', name: 'Shuttle', emoji: '🚎', capacity: 12, cost: 30, hours: 1, co2: 9 };
const bus = { id: 'bus', name: 'Bus', emoji: '🚌', capacity: 40, cost: 90, hours: 2, co2: 30 };
const plane = { id: 'plane', name: 'Plane', emoji: '✈️', capacity: 150, cost: 1500, hours: 1, co2: 500 };
const job = { title: 'Festival day', origin: 'Maple Station', destination: 'Riverside Fairground' };

// Hand-built jobs. ROUND: 44 people under $140; the minivan's 6th trip carries 4 (5.5 trips would pass), the shuttle
// (4 trips, $120) answers. EVEN: 40 people under $100, the bus answers. MULTI: $200 and 6 hours; the car keeps the
// budget only, the bus the time only, the minivan both. FULL: no vehicle keeps all three; the bus breaks only CO2.
const ROUND: TransportItem = { id: 'single_constraint-1', mode: 'single_constraint', ...job, load: { kind: 'people', amount: 44, name: 'festival visitors' },
  limits: [{ type: 'budget', max: 140 }], vehicles: [car, minivan, shuttle], shows: ['budget', 'time', 'co2'] };
const EVEN: TransportItem = { ...ROUND, id: 'single_constraint-2', load: { ...ROUND.load, amount: 40 }, limits: [{ type: 'budget', max: 100 }],
  vehicles: [car, minivan, bus], shows: ['budget'] };
const MULTI: TransportItem = { id: 'multi_constraint-1', mode: 'multi_constraint', ...job, load: { kind: 'people', amount: 40, name: 'fans' },
  limits: [{ type: 'budget', max: 200 }, { type: 'time', max: 6 }], vehicles: [car, minivan, { ...bus, cost: 250 }], shows: ['budget', 'time', 'co2'] };
const FULL: TransportItem = { id: 'full_optimization-1', mode: 'full_optimization', ...job, load: { kind: 'people', amount: 40, name: 'students' },
  limits: [{ type: 'budget', max: 120 }, { type: 'time', max: 4 }, { type: 'co2', max: 25 }], vehicles: [car, minivan, bus, plane], shows: ['budget', 'time', 'co2'] };
const BY_MODE: Record<TransportMode, TransportItem[]> = {
  single_constraint: [ROUND, EVEN], multi_constraint: [MULTI], full_optimization: [FULL],
};

const data = (mode: TransportMode, items = BY_MODE[mode]): TransportChallengeData =>
  ({ title: 'Transport Challenge', description: 'Plan the jobs.', challengeTypes: [mode], items });
const mount = (mode: TransportMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'transport-challenge', evalMode: mode, instanceId: 'transport-challenge', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const pickAndCheck = (h: WorkspaceHarness, name: string) => { h.press(name); h.press(/Check my pick/); h.settle(); };
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it('the hand-built jobs are keyed as described', () => {
  expect(keyVehicle(ROUND)?.id).toBe('shuttle');
  expect(vehicleMiss(ROUND, minivan)).toBe('forgot_round_up');
  expect(vehicleMiss(ROUND, car)).toBe('cheapest_per_trip');
  expect(keyVehicle(EVEN)?.id).toBe('bus');
  expect(keyVehicle(MULTI)?.id).toBe('minivan');
  expect(vehicleMiss(MULTI, car)).toBe('one_limit_only');
  expect(keyVehicle(FULL)?.id).toBe('bus');
  expect(vehicleMiss(FULL, plane)).toBe('fewest_trips');
  for (const i of [ROUND, EVEN, MULTI, FULL]) expect(validTransportItem(i), i.id).toBe(true);
});

it.each(MODES)('%s binds with its key out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(getComponentById('transport-challenge')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  expect(demand(h).response).toBe('speech');
  expect(h.state().task!.workspace!.expectedAnswer).toContain(`"${keyVehicle(item)!.name}"`);
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/was run|Credited|within\)|over\)/);
  // No trips, totals, verdict, table or lever before a checked pick.
  expect(text(h)).not.toMatch(/\d+ trips|of \$|Next job|Finish/);
  expect(h.view.container.querySelector('[data-lever], [data-run], [data-compare]')).toBeNull();
  expect(h.view.container.querySelector('[aria-label="Read the job to me"]')).toBeNull();
  h.close();
});

it('single: a wrong tap names its miss, runs only that vehicle and closes the cards; Try again clears; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('single_constraint');
  expect(h.state().task!.itemId).toBe('single_constraint-1');
  pickAndCheck(h, 'Minivan');
  expect(last(h)).toMatchObject({ correct: false, miss: 'forgot_round_up' });
  expect(demand(h).learnerWork).toBe('Picked the minivan');
  expect(String(demand(h).run)).toMatch(/the minivan makes 6 trips: \$150 against the \$140 budget \(over\)/);
  expect(h.view.container.querySelector('[data-run="minivan"]')).not.toBeNull();
  // Only the learner's own pick has run: no other vehicle's totals, no table.
  expect(h.view.container.querySelector('[data-compare]')).toBeNull();
  expect(String(demand(h).run)).not.toMatch(/shuttle/i);
  expect(h.view.container.querySelector('button[aria-label="Shuttle"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing picked yet' });
  expect(demand(h).run).toBeUndefined();
  pickAndCheck(h, 'Shuttle');
  expect(last(h)).toMatchObject({ correct: true });
  expect(String(demand(h).run)).toMatch(/^Credited/);
  expect(h.view.container.querySelector('[data-compare]')).not.toBeNull();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('single_constraint-2');
  h.say('the bus'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'transport-challenge', totalScenarios: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'forgot_round_up'], [true, null], [true, null]]);
  h.close();
});

it('show_trips and times_setup change the screen and the scene in one commit; smaller_job opens a practice job', () => {
  const h = mount('single_constraint');
  expect(levers(h)).toEqual([[SHOW_TRIPS_LEVER, 'help', false], [TIMES_SETUP_LEVER, 'help', false], [SMALLER_JOB_LEVER, 'simplify', false]]);
  pickAndCheck(h, 'Car');
  expect(last(h)!.miss).toBe('cheapest_per_trip');
  expect(nextLever(h.state().task!.workspace!.levers!, 'cheapest_per_trip')).toBe(SHOW_TRIPS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: SHOW_TRIPS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="show-trips"]').length).toBe(3);
  expect(text(h)).toMatch(/6 trips: 5 full, the last one carrying 4 people/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/Minivan, 6 trips: 5 full/);
  expect(h.dispatch('pull_lever', { lever: TIMES_SETUP_LEVER }).status).toBe('committed');
  expect(text(h)).toMatch(/6 trips × \$25 a trip/);
  expect(String(demand(h).onScreen)).not.toMatch(/\$150|\$120\b/);
  h.dispatch('retry'); h.confirmVisible();
  pickAndCheck(h, 'Shuttle');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [SHOW_TRIPS_LEVER, TIMES_SETUP_LEVER] });
  h.dispatch('advance'); h.confirmVisible();
  // A fresh item starts with every lever released.
  expect(levers(h).every(([, , p]) => p === false)).toBe(true);
  pickAndCheck(h, 'Car');
  const practice = simplerItem(EVEN)!;
  const step = h.dispatch('pull_lever', { lever: SMALLER_JOB_LEVER });
  expect(step.status).toBe('committed');
  expect(step.state.task).toMatchObject({ itemId: 'single_constraint-2~simpler' });
  expect(h.view.container.querySelector('[data-practice="simpler"]')!.textContent).toContain(`Move ${practice.load.amount} festival visitors`);
  expect(levers(h)).toEqual([]);
  pickAndCheck(h, keyVehicle(practice)!.name);
  expect(last(h)).toMatchObject({ itemId: 'single_constraint-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'single_constraint-2' });
  pickAndCheck(h, 'Bus');
  expect(last(h)).toMatchObject({ itemId: 'single_constraint-2', correct: true });
  h.close();
});

it.each([['multi_constraint', 'Car', 'one_limit_only', 'Minivan'], ['full_optimization', 'Plane', 'fewest_trips', 'Bus']] as const)(
  '%s: a wrong pick names %s and its run, a right one credits', (mode, wrong, miss, right) => {
    const h = mount(mode);
    pickAndCheck(h, wrong);
    expect(last(h)).toMatchObject({ correct: false, miss });
    expect(nextLever(h.state().task!.workspace!.levers!, miss)).toBe(TIMES_SETUP_LEVER);
    h.dispatch('retry'); h.confirmVisible();
    pickAndCheck(h, right);
    expect(last(h)).toMatchObject({ correct: true });
    h.close();
  });

describe('the pure rules', () => {
  const all = (mode: TransportMode) => TIERS.flatMap(tier => [0, 1].flatMap(f =>
    [0, 1, 2, 3].flatMap(s => { const i = buildItem(mode, tier, DEFAULT_FRAMES[f], seededRng(`${mode}${tier}${f}${s}`), `${mode}-${s}`); return i ? [{ i, tier }] : []; })));

  it.each(MODES)('%s builds valid, single-keyed jobs at every tier and load kind', mode => {
    const built = all(mode);
    expect(built.length).toBe(TIERS.length * 2 * 4);
    for (const { i } of built) {
      expect(validTransportItem(i), i.id).toBe(true);
      expect(i.vehicles.every(v => tripsFor(i, v) <= 40), i.id).toBe(true);
    }
  });

  it('the tiers are structural', () => {
    for (const mode of MODES) for (const { i, tier } of all(mode)) {
      const key = keyVehicle(i)!, wrong = i.vehicles.filter(v => v.id !== key.id);
      const even = i.vehicles.every(v => fillsEvenly(i, v));
      if (tier === 'easy') { expect(even, i.id).toBe(true); expect(i.shows).toEqual(i.limits.map(l => l.type)); }
      else expect(even, i.id).toBe(false);
      if (tier === 'hard') expect(wrong.some(v => vehicleMiss(i, v) === 'forgot_round_up'), i.id).toBe(true);
      if (mode === 'full_optimization') expect(i.vehicles.every(v => totalFor(i, v, 'budget') > i.limits[0].max || i.limits.some(l => totalFor(i, v, l.type) > l.max))).toBe(true);
    }
  });

  it('every wrong pick names a catalog miss, and every miss a job can show is answered by a help lever first', () => {
    const entry = getComponentById('transport-challenge')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...TRANSPORT_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        const ls = transportLevers(i, []);
        for (const m of possibleMisses(i, v => vehicleMiss(i, v))) {
          expect(TRANSPORT_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
        const a = transportHarnessAnswers(i);
        const id = (name: string) => i.vehicles.find(v => v.name === name)!.id;
        expect(transportCorrect(i, { picked: id(a.correct) })).toBe(true);
        expect(transportCorrect(i, { picked: id(a.plainWrong) })).toBe(false);
        expect(transportMiss(i, { picked: id(a.plainWrong) })).toBeDefined();
      }
    }
  });

  it('no lever line, scene fact or ask states a total or a verdict', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      for (const v of i.vehicles) for (const line of [tripLine(i, v), ...timesLines(i, v)]) expect(leverLeak(i, line, v), `${i.id}: ${line}`).toBe(false);
      const fact = leverFact(i, [SHOW_TRIPS_LEVER, TIMES_SETUP_LEVER]);
      expect(leverLeak(i, fact), fact).toBe(false);
      // The fact is the same per-vehicle lines, checked above, joined by vehicle.
      expect(askOf(i)).not.toContain(keyVehicle(i)!.name);
    }
  });

  it('the smaller job stays in the mode, fills its trips, never answers with this job\'s answer, and never shrinks twice', () => {
    let built = 0;
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = simplerItem(i);
      if (!s) continue;
      built++;
      expect(s.mode).toBe(mode);
      expect(validTransportItem(s)).toBe(true);
      expect(s.vehicles.map(v => v.id)).toEqual(i.vehicles.slice(0, 2).map(v => v.id));
      expect(s.vehicles.every(v => fillsEvenly(s, v))).toBe(true);
      expect(keyVehicle(s)!.id).not.toBe(keyVehicle(i)!.id);
      expect(simplerItem(s)).toBeNull();
      expect(transportLevers(s, [])).toEqual([]);
    }
    expect(built).toBeGreaterThan(30);
  });

  it('a legacy lesson (model-written scenarios) still builds code jobs in its modes and names', () => {
    const legacy = { title: 'Old Transport', scenarios: [
      { type: 'single_constraint', title: 'Hospital run', origin: 'Pine Hill', destination: 'County General', load: { kind: 'people', name: 'patients' } },
      { type: 'full_optimization', title: 'Lumber haul', origin: 'Mill', destination: 'Site', load: { kind: 'cargo', name: 'lumber' } }] };
    const items = transportItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['single_constraint', 'full_optimization']));
    expect(items.every(validTransportItem)).toBe(true);
    expect(items[0].title).toBe('Hospital run');
    expect(transportItems(legacy)).toEqual(items);
    expect(buildTransportItems({ modes: ['multi_constraint'], tier: 'medium', frames: [], rng: seededRng('x') }).length).toBe(3);
  });
});
