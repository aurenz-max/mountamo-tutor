// @vitest-environment jsdom
/**
 * vehicle-comparison-lab on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The
 * generic W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every mode is a code-keyed choice from a data table, tapped and checked or said aloud: the key is published only as
 * the spoken expectedAnswer, and nothing marks a leader before credit. A wrong answer names its miss, and every miss
 * has a help lever first.
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
import fixtures from '../../../pip/testing/workspaceFixtures.json';
import type { VehicleComparisonLabData } from './VehicleComparisonLab';
import {
  askOf, buildVehicleItems, comparisonMiss, keyName, keyOf, METRIC_LABEL, rosterOf, seededRng, VEHICLE_MISSES, vehicleCorrect,
  vehicleHarnessAnswers, vehicleItems, validVehicleItem, workspaceAssignment, feasibleRows, meets,
  METRIC_KEYS, METRIC_MEANING, NEED_JOB, type ComparisonVehicle, type EvidenceItem, type LeaderItem, type TradeoffItem, type VehicleItem, type VehicleMode, type VehicleTier,
} from './vehicleComparisonWorkspace';
import {
  COLUMN_MEANINGS_LEVER, COUNT_DIGITS_LEVER, FEWER_COLUMNS_LEVER, FOCUS_COLUMN_LEVER, leverFact, MARK_MINIMUMS_LEVER, meaningLines,
  ONE_MINIMUM_LEVER, possibleMisses, rankLeak, simplerItem, SMALLER_IS_BETTER_LEVER, smallerLine, TWO_ROWS_LEVER, vehicleLevers,
} from './vehicleComparisonLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: VehicleMode[] = ['metric_leader', 'evidence_choice', 'constraint_tradeoff'];
const TIERS: VehicleTier[] = ['easy', 'medium', 'hard'];

// Hand-built items. SPEED: the car leads top speed, the bus leads passengers (the bicycle's 25 starts with a bigger digit). CLEAN: the lowest CO2 leads.
// CROWD: the job needs passengers; the jet leads speed and range. JOB: the jet is fastest but carries too few people.
const SPEED: LeaderItem = { id: 'metric_leader-1', mode: 'metric_leader', metric: 'topSpeed', columns: ['passengerCapacity', 'topSpeed'],
  units: { topSpeed: 'km/h' }, rows: [
    { id: 'bus', name: 'School Bus', category: 'land', values: { topSpeed: 120, passengerCapacity: 72 } },
    { id: 'bike', name: 'Bicycle', category: 'land', values: { topSpeed: 25, passengerCapacity: 1 } },
    { id: 'car', name: 'Family Car', category: 'land', values: { topSpeed: 160, passengerCapacity: 5 } },
  ] };
const CLEAN: LeaderItem = { id: 'metric_leader-2', mode: 'metric_leader', metric: 'co2PerPassengerKm', columns: ['co2PerPassengerKm'],
  units: {}, rows: [
    { id: 'jet', name: 'Jet', category: 'air', values: { co2PerPassengerKm: 115 } },
    { id: 'train', name: 'Fast Train', category: 'land', values: { co2PerPassengerKm: 18 } },
    { id: 'car', name: 'Gas Car', category: 'land', values: { co2PerPassengerKm: 170 } },
  ] };
const CROWD: EvidenceItem = { id: 'evidence_choice-1', mode: 'evidence_choice', metric: 'passengerCapacity',
  columns: ['topSpeed', 'passengerCapacity', 'range'], units: { topSpeed: 'km/h', range: 'km' }, rows: [
    { id: 'jet', name: 'Jumbo Jet', category: 'air', values: { topSpeed: 920, passengerCapacity: 416, range: 14200 } },
    { id: 'train', name: 'Fast Train', category: 'land', values: { topSpeed: 300, passengerCapacity: 1323, range: 500 } },
    { id: 'bus', name: 'Coach', category: 'land', values: { topSpeed: 100, passengerCapacity: 50, range: 800 } },
    { id: 'ferry', name: 'Big Ferry', category: 'sea', values: { topSpeed: 40, passengerCapacity: 900, range: 1000 } },
  ] };
const JOB: TradeoffItem = { id: 'constraint_tradeoff-1', mode: 'constraint_tradeoff', metric: 'topSpeed',
  minimums: [{ metric: 'passengerCapacity', atLeast: 1300 }, { metric: 'range', atLeast: 750 }],
  columns: ['passengerCapacity', 'range', 'topSpeed'], units: { topSpeed: 'km/h', range: 'km' }, rows: [
    { id: 'jet', name: 'Jumbo Jet', category: 'air', values: { topSpeed: 900, passengerCapacity: 300, range: 9000 } },
    { id: 'train', name: 'Fast Train', category: 'land', values: { topSpeed: 300, passengerCapacity: 1300, range: 750 } },
    { id: 'ferry', name: 'Big Ferry', category: 'sea', values: { topSpeed: 50, passengerCapacity: 2000, range: 800 } },
    { id: 'coach', name: 'Coach', category: 'land', values: { topSpeed: 100, passengerCapacity: 60, range: 650 } },
  ] };
const BY_MODE: Record<VehicleMode, VehicleItem[]> = {
  metric_leader: [SPEED, CLEAN],
  evidence_choice: [CROWD],
  constraint_tradeoff: [JOB],
};

const data = (mode: VehicleMode, items = BY_MODE[mode]): VehicleComparisonLabData => ({
  title: 'Vehicles by the Numbers', instructions: 'Read the table to answer.', topicFocus: 'Moving people', vehicles: [],
  comparisonMetrics: ['topSpeed', 'passengerCapacity'], gradeBand: '3-5', challengeTypes: [mode], items,
});
const mount = (mode: VehicleMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'vehicle-comparison-lab', evalMode: mode, instanceId: 'vehicle-comparison-lab', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const leverIds = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const tap = (h: WorkspaceHarness, ...labels: string[]) => { for (const l of labels) h.press(l); h.press(/^Check$/); h.settle(); };
const current = (h: WorkspaceHarness, mode: VehicleMode) => vehicleItems(data(mode)).find(i => i.id === h.state().task!.itemId)!;
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds with its key only in the spoken expectedAnswer, and nothing marks a leader', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('vehicle-comparison-lab')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  expect(demand(h).response).toBe('speech');
  expect(h.state().task!.workspace!.expectedAnswer).toContain(`"${keyName(item)}"`);
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/\bleads\b|answer and its reason|\bcorrect\b/i);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(text(h)).not.toMatch(/Next →|Finish|leads the/);
  expect(h.view.container.querySelector('[aria-label="Read the question to me"]')).toBeNull();
  h.close();
});

it('metric_leader: a wrong tap names its miss and closes the table; Try again reopens; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('metric_leader');
  expect(h.state().task!.itemId).toBe('metric_leader-1');
  tap(h, 'School Bus');
  expect(last(h)).toMatchObject({ correct: false, miss: 'other_column_leader' });
  expect(demand(h).learnerWork).toBe('Chose "School Bus"');
  expect(h.view.container.querySelector('button[aria-label="Family Car"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  tap(h, 'Family Car');
  expect(last(h)).toMatchObject({ correct: true });
  expect(String(demand(h).shown)).toMatch(/Family Car leads the Top speed column with 160 km\/h/);
  expect(text(h)).toMatch(/Family Car leads the Top speed column/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('metric_leader-2');
  h.say('the fast train'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'vehicle-comparison-lab', challengesTotal: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'other_column_leader'], [true, null], [true, null]]);
  h.close();
});

it('metric_leader: focus_column and count_digits draw in one commit; smaller_is_better on CO2; two_rows opens a pair without the leader', () => {
  const h = mount('metric_leader');
  expect(leverIds(h)).toEqual([FOCUS_COLUMN_LEVER, COUNT_DIGITS_LEVER, TWO_ROWS_LEVER]);
  tap(h, 'School Bus');
  expect(nextLever(h.state().task!.workspace!.levers!, 'other_column_leader')).toBe(FOCUS_COLUMN_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: FOCUS_COLUMN_LEVER });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/Every column except Top speed is faded/);
  expect(h.dispatch('pull_lever', { lever: COUNT_DIGITS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="count-digits"]').length).toBe(3);
  expect(String(demand(h).onScreen)).toMatch(/Family Car 160 km\/h \(3 digits\)/);
  h.dispatch('retry'); h.confirmVisible();
  tap(h, 'Family Car');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [FOCUS_COLUMN_LEVER, COUNT_DIGITS_LEVER] });
  h.dispatch('advance'); h.confirmVisible();
  expect(leverIds(h)).toEqual([SMALLER_IS_BETTER_LEVER, COUNT_DIGITS_LEVER, TWO_ROWS_LEVER]);
  tap(h, 'Gas Car');
  expect(last(h)!.miss).toBe('reversed');
  expect(nextLever(h.state().task!.workspace!.levers!, 'reversed')).toBe(SMALLER_IS_BETTER_LEVER);
  expect(h.dispatch('pull_lever', { lever: SMALLER_IS_BETTER_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="smaller-is-better"]')!.textContent).toBe(smallerLine('co2PerPassengerKm'));
  const pair = h.dispatch('pull_lever', { lever: TWO_ROWS_LEVER });
  expect(pair.state.task).toMatchObject({ itemId: 'metric_leader-2~simpler' });
  expect(h.view.container.querySelector('button[aria-label="Fast Train"]')).toBeNull();
  tap(h, 'Jet');
  expect(last(h)).toMatchObject({ itemId: 'metric_leader-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'metric_leader-2' });
  tap(h, 'Fast Train');
  expect(last(h)).toMatchObject({ itemId: 'metric_leader-2', correct: true });
  h.close();
});

it('evidence_choice: both parts are needed; the right vehicle with another column is wrong_evidence; column_meanings, fewer_columns', () => {
  const h = mount('evidence_choice');
  h.press('Fast Train');
  expect((Array.from(h.view.container.querySelectorAll('button')).find(b => /^Check$/.test(b.textContent ?? '')) as HTMLButtonElement).disabled).toBe(true);
  h.press(METRIC_LABEL.range); h.press(/^Check$/); h.settle();
  expect(last(h)).toMatchObject({ correct: false, miss: 'wrong_evidence' });
  expect(demand(h).learnerWork).toBe('Chose "Fast Train", with the Range column as evidence');
  expect(leverIds(h)).toEqual([COLUMN_MEANINGS_LEVER, COUNT_DIGITS_LEVER, FEWER_COLUMNS_LEVER]);
  expect(h.dispatch('pull_lever', { lever: COLUMN_MEANINGS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="column-meanings"]')!.textContent).toBe(meaningLines(CROWD).join(''));
  h.dispatch('retry'); h.confirmVisible();
  tap(h, 'Jumbo Jet', METRIC_LABEL.topSpeed);
  expect(last(h)!.miss).toBe('other_column_leader');
  const fewer = h.dispatch('pull_lever', { lever: FEWER_COLUMNS_LEVER });
  expect(fewer.state.task).toMatchObject({ itemId: 'evidence_choice-1~simpler' });
  const practice = simplerItem(CROWD)!;
  expect(practice.rows.map(r => r.id)).not.toContain('train');
  expect(practice.columns).toHaveLength(2);
  const k = keyOf(practice);
  tap(h, practice.rows.find(r => r.id === k.vehicle)!.name, METRIC_LABEL[k.evidence!]);
  expect(last(h)).toMatchObject({ itemId: 'evidence_choice-1~simpler', correct: true });
  h.dispatch('advance');
  tap(h, 'Fast Train', METRIC_LABEL.passengerCapacity);
  expect(last(h)).toMatchObject({ itemId: 'evidence_choice-1', correct: true });
  h.close();
});

it('constraint_tradeoff: the fastest misses a minimum (ignored_minimum); mark_minimums ticks every row; one_minimum opens a smaller job', () => {
  const h = mount('constraint_tradeoff');
  expect(askOf(JOB)).toMatch(/carry at least 1,300 people and go at least 750 km without refueling/);
  tap(h, 'Jumbo Jet');
  expect(last(h)).toMatchObject({ correct: false, miss: 'ignored_minimum' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'ignored_minimum')).toBe(MARK_MINIMUMS_LEVER);
  expect(h.dispatch('pull_lever', { lever: MARK_MINIMUMS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="mark-minimums"]').length).toBe(8);
  expect(String(demand(h).onScreen)).toMatch(/Jumbo Jet Passengers cross, Range tick/);
  const one = h.dispatch('pull_lever', { lever: ONE_MINIMUM_LEVER });
  expect(one.state.task).toMatchObject({ itemId: 'constraint_tradeoff-1~simpler' });
  const practice = simplerItem(JOB) as TradeoffItem;
  expect(practice.minimums).toHaveLength(1);
  tap(h, keyName(practice));
  expect(last(h)).toMatchObject({ itemId: 'constraint_tradeoff-1~simpler', correct: true });
  h.dispatch('advance');
  tap(h, 'Fast Train');
  expect(last(h)).toMatchObject({ itemId: 'constraint_tradeoff-1', correct: true, levers: [MARK_MINIMUMS_LEVER, ONE_MINIMUM_LEVER] });
  h.close();
});

describe('the pure rules', () => {
  const metric = (value: number, unit: string) => ({ value, unit, display: `${value} ${unit}` });
  const v = (id: string, name: string, category: ComparisonVehicle['category'], s: number, w: number, p: number, c: number, r: number, y: number, co2: number | null): ComparisonVehicle => ({
    id, name, category, metrics: { topSpeed: metric(s, 'km/h'), weight: metric(w, 'kg'), passengerCapacity: metric(p, 'passengers'),
      cargoCapacity: metric(c, 'tons'), range: metric(r, 'km'), fuelType: 'x', yearIntroduced: y, costPerTrip: null, co2PerPassengerKm: co2 }, funFact: '' });
  const FREIGHT = [
    v('freight-train', 'Freight train', 'land', 100, 13000000, 2, 10000, 1500, 1830, 20),
    v('semi', 'Semi truck', 'land', 105, 36000, 1, 22, 1000, 1930, 90),
    v('cargo-plane', 'Cargo plane', 'air', 900, 448000, 4, 134, 8000, 1970, 500),
    v('container-ship', 'Container ship', 'sea', 46, 55000000, 20, 150000, 24000, 1956, 10),
    v('van', 'Delivery van', 'land', 140, 3500, 2, 2, 600, 1950, 150),
    v('barge', 'River barge', 'sea', 15, 900000, 3, 1500, 900, 1900, 15),
  ];
  const fixture = (fixtures as unknown as Record<string, { vehicles: ComparisonVehicle[]; comparisonMetrics: string[] }>)['vehicle-comparison-lab'];
  const ROSTERS = [
    rosterOf({ vehicles: fixture.vehicles, comparisonMetrics: fixture.comparisonMetrics }),
    rosterOf({ vehicles: FREIGHT, comparisonMetrics: ['topSpeed', 'cargoCapacity', 'range'] }),
  ];
  const all = (mode: VehicleMode) => TIERS.flatMap(tier => ROSTERS.flatMap((roster, ri) => [1, 2, 3].flatMap(seed =>
    buildVehicleItems({ modes: [mode], tier, roster, rng: seededRng(`${mode}${tier}${ri}${seed}`) }).map(i => ({ i, tier })))));

  it('the roster drops a placeholder number and a value in another unit', () => {
    const r = rosterOf({ vehicles: fixture.vehicles });
    expect(r.rows.find(x => x.id === fixture.vehicles.find(f => /bicycle/i.test(f.name))!.id)!.values.range).toBeUndefined();
    const mixed = rosterOf({ vehicles: [...FREIGHT.slice(0, 3), { ...FREIGHT[3], metrics: { ...FREIGHT[3].metrics, topSpeed: metric(25, 'knots') } }] });
    expect(mixed.rows[3].values.topSpeed).toBeUndefined();
    expect(mixed.rows[0].values.topSpeed).toBe(100);
  });

  it.each(MODES)('%s builds valid, keyed items at every tier on both rosters', mode => {
    for (const roster of ROSTERS) for (const tier of TIERS) {
      expect(buildVehicleItems({ modes: [mode], tier, roster, rng: seededRng(`count${tier}`) }).length, `${mode} ${tier}`).toBeGreaterThanOrEqual(2);
    }
    for (const { i, tier } of all(mode)) {
      expect(validVehicleItem(i), `${mode} ${tier} ${i.id}`).toBe(true);
      expect(keyOf(i).vehicle).not.toBe('');
      if (i.mode === 'constraint_tradeoff') {
        // The vehicle that leads the priority overall misses a minimum; at least two can do the job.
        const overall = [...i.rows].sort((a, b) => (i.metric === 'co2PerPassengerKm' ? a.values[i.metric]! - b.values[i.metric]! : b.values[i.metric]! - a.values[i.metric]!))[0];
        expect(meets(overall, i.minimums), i.id).toBe(false);
        expect(feasibleRows(i).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('the tiers are structural', () => {
    for (const { i, tier } of all('metric_leader')) if (tier === 'easy') expect(i.columns).toEqual([i.metric]);
    expect(all('metric_leader').filter(x => x.tier === 'hard').some(({ i }) => i.columns.length >= 3 && i.rows.length >= 5)).toBe(true);
    for (const { i, tier } of all('evidence_choice')) if (tier === 'easy') expect(i.columns.length).toBeLessThanOrEqual(2);
    expect(all('evidence_choice').filter(x => x.tier === 'hard').some(({ i }) => i.columns.length === 4)).toBe(true);
    for (const { i, tier } of all('constraint_tradeoff')) {
      if (i.mode !== 'constraint_tradeoff') continue;
      if (tier === 'easy') expect(i.minimums).toHaveLength(1);
    }
    expect(all('constraint_tradeoff').filter(x => x.tier !== 'easy').some(({ i }) => i.mode === 'constraint_tradeoff' && i.minimums.length === 2)).toBe(true);
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('vehicle-comparison-lab')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...VEHICLE_MISSES[mode]].sort());
      for (const { i } of [...all(mode), ...BY_MODE[mode].map(i => ({ i }))]) {
        const ls = vehicleLevers(i, []);
        const misses = possibleMisses(i);
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(VEHICLE_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
        const a = vehicleHarnessAnswers(i);
        expect(vehicleCorrect(i, a.correct), i.id).toBe(true);
        expect(vehicleCorrect(i, a.plainWrong), i.id).toBe(false);
        expect(comparisonMiss(i, a.plainWrong), i.id).toBeDefined();
      }
    }
  });

  it('no ask, lever line or scene fact names the leader or ranks a vehicle', () => {
    for (const mode of MODES) for (const { i } of [...all(mode), ...BY_MODE[mode].map(i => ({ i }))]) {
      const help = vehicleLevers(i, []).filter(l => l.kind === 'help').map(l => l.id);
      const fact = leverFact(i, help);
      expect(rankLeak(fact), `${i.id}: ${fact}`).toBe(false);
      for (const l of vehicleLevers(i, [])) expect(rankLeak(l.does), `${i.id}: ${l.does}`).toBe(false);
      expect(askOf(i)).not.toContain(keyName(i));
      if (i.mode === 'evidence_choice') {
        expect(askOf(i)).not.toMatch(new RegExp(METRIC_LABEL[i.metric], 'i'));
        // The job shares no content word with any column's meaning: the column_meanings card must not match it.
        const words = (t: string) => new Set(t.toLowerCase().match(/[a-z]{4,}/g) ?? []);
        const job = words(NEED_JOB[i.metric]!);
        for (const c of METRIC_KEYS) for (const w of Array.from(words(METRIC_MEANING[c]))) expect(job.has(w), `${c}: ${w}`).toBe(false);
      }
    }
  });

  it('the simpler item stays in the mode, never keeps the full item\'s answer vehicle, and never shrinks twice', () => {
    for (const mode of MODES) for (const { i } of [...all(mode), ...BY_MODE[mode].map(i => ({ i }))]) {
      const s = simplerItem(i);
      if (!s) continue;
      expect(s.mode).toBe(mode);
      expect(validVehicleItem(s), s.id).toBe(true);
      expect(simplerItem(s)).toBeNull();
      expect(vehicleLevers(s, [])).toEqual([]);
      expect(keyOf(s).vehicle).not.toBe(keyOf(i).vehicle);
      expect(s.rows.length).toBeLessThan(i.rows.length);
    }
  });

  it('a legacy lesson (model-keyed missions) still builds code items in its modes', () => {
    const legacy = fixtures['vehicle-comparison-lab'] as unknown as VehicleComparisonLabData;
    const items = vehicleItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['metric_leader', 'evidence_choice']));
    expect(vehicleItems(legacy)).toEqual(items);
  });
});
