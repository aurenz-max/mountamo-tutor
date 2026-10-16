// @vitest-environment jsdom
/**
 * race-track-lab on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every item is a code-keyed closed choice, tapped and checked or said aloud: the key is published only as the spoken
 * expectedAnswer, nothing on screen states it before credit (no speed readout, the predict race and the graph's race
 * wait for credit, the log's speed reads "?"), observe and measure wait for Run the race, a wrong tap names its miss,
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
import type { RaceTrackLabData } from './RaceTrackLab';
import {
  buildRaceItems, choicesOf, endOf, fastestIndex, frontIndex, hasHeadStart, keyChoice, movedOf, RACE_MISSES, raceHarnessAnswers,
  raceItems, raceMiss, seededRng, validRaceItem, winnerIndex, workspaceAssignment, workspaceScene,
  type RaceCar, type RaceItem, type RaceMode, type RaceTier,
} from './raceTrackWorkspace';
import {
  GAP_BRACKET_LEVER, leverFact, numberLeak, ONE_SECOND_LEVER, possibleMisses, raceLevers, SECOND_MARKS_LEVER, simplerItem,
  SIMPLER_LEVERS, stepMarksLeak, STEP_MARKS_LEVER, TO_GO_LEVER, TRAIL_COUNT_LEVER, TRAIL_TICKS_LEVER,
} from './raceTrackLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: RaceMode[] = ['observe', 'predict', 'measure', 'calculate', 'graph'];
const TIERS: RaceTier[] = ['easy', 'medium', 'hard'];

const car = (name: string, speed: number, start = 0, time?: number): RaceCar =>
  ({ name, color: '#fff', speed, start, ...(time ? { time } : {}) });
const R = 'Red car', B = 'Blue car', G = 'Green car', Y = 'Yellow car';

// Hand-built items, two per mode: the plain shape, then the shape a head start (or a second step) makes harder.
const O1: RaceItem = { id: 'observe-1', mode: 'observe', ask: 'fastest', racers: [car(R, 2), car(B, 4)], trackLength: 12, time: 2 };
const O2: RaceItem = { id: 'observe-2', mode: 'observe', ask: 'fastest', racers: [car(G, 1, 6), car(Y, 3)], trackLength: 12, time: 2 };
const P1: RaceItem = { id: 'predict-1', mode: 'predict', ask: 'winner', racers: [car(R, 1), car(B, 3)], trackLength: 12, time: 0, given: 'per_second' };
const P2: RaceItem = { id: 'predict-2', mode: 'predict', ask: 'winner', racers: [car(G, 1, 8), car(Y, 2)], trackLength: 12, time: 0, given: 'per_second' };
const M1: RaceItem = { id: 'measure-1', mode: 'measure', ask: 'distance', racers: [car(R, 3), car(B, 2)], trackLength: 16, time: 3, target: 0 };
const M2: RaceItem = { id: 'measure-2', mode: 'measure', ask: 'distance', racers: [car(R, 2, 4), car(B, 3)], trackLength: 16, time: 3, target: 0 };
const C1: RaceItem = { id: 'calculate-1', mode: 'calculate', ask: 'speed', racers: [car(R, 4)], trackLength: 20, time: 3, target: 0 };
const C2: RaceItem = { id: 'calculate-2', mode: 'calculate', ask: 'faster_speed', racers: [car(R, 4, 0, 2), car(B, 2, 0, 5)], trackLength: 20, time: 0 };
const G1: RaceItem = { id: 'graph-1', mode: 'graph', ask: 'fastest', racers: [car(G, 1, 8), car(Y, 2)], trackLength: 20, time: 4 };
const G2: RaceItem = { id: 'graph-2', mode: 'graph', ask: 'speed', racers: [car(R, 2, 6), car(B, 3)], trackLength: 20, time: 4, target: 0 };
const BY_MODE: Record<RaceMode, RaceItem[]> = { observe: [O1, O2], predict: [P1, P2], measure: [M1, M2], calculate: [C1, C2], graph: [G1, G2] };

const data = (mode: RaceMode, items = BY_MODE[mode]): RaceTrackLabData =>
  ({ title: 'Toy Car Races', description: 'Blue car wins!', challengeTypes: [mode], items, grade: '3' });
const mount = (mode: RaceMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'race-track-lab', evalMode: mode, instanceId: 'race-track-lab', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/Check Answer/); h.settle(); };
const run = (h: WorkspaceHarness) => { h.press('Run the race'); h.settle(); };
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds as a spoken-or-tapped choice whose key stays out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(getComponentById('race-track-lab')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  expect(demand(h).response).toBe('speech');
  expect(h.state().task!.workspace!.expectedAnswer).toContain(keyChoice(item));
  // The key is never in the scene facts beyond the choice list, and no speed readout, medal or Next is on screen.
  const facts = { ...demand(h) } as Record<string, unknown>;
  delete facts.choices; delete facts.question;
  // (A car's name is in the lanes and the graph's lines for every car alike; a number key is nowhere.)
  if (mode === 'measure' || mode === 'calculate') expect(JSON.stringify(facts)).not.toContain(keyChoice(item));
  expect(JSON.stringify(facts)).not.toMatch(/crossed first|now reads|fastest is/i);
  expect(text(h)).not.toMatch(/sq\/s|🥇|wins!|Next →|Finish/);
  if (mode !== 'calculate' && mode !== 'predict') expect(text(h)).not.toMatch(/per second/);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  // observe and measure: nothing to answer from until the race is run.
  if (mode === 'observe' || mode === 'measure') {
    expect(demand(h).presentation).toBe('not ready');
    expect(h.view.container.querySelector(`button[aria-label="${choicesOf(item)[0]}"]`)!.hasAttribute('disabled')).toBe(true);
    run(h);
    expect(demand(h).presentation).toBe('ready');
    expect(String(demand(h).run)).toMatch(/not given to you/);
  }
  if (mode === 'calculate') expect(h.view.container.querySelector('table[aria-label="The race log"]')!.textContent).toMatch(/\?/);
  h.close();
});

it('observe: a wrong tap names its miss and closes the choices; Try again keeps the race; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('observe');
  run(h);
  answer(h, R);
  expect(last(h)).toMatchObject({ correct: false, miss: 'slower_racer' });
  expect(demand(h).learnerWork).toBe(`Chose "${R}"`);
  expect(h.view.container.querySelector(`button[aria-label="${B}"]`)!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet', presentation: 'ready' });
  answer(h, B);
  expect(last(h)).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('observe-2');
  // The head-start car ends in front and is not the fastest: choosing it is its own miss.
  expect(raceMiss(O2, G)).toBe('ahead_not_fastest');
  run(h);
  h.say('the yellow car'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'race-track-lab', challengesCompleted: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'slower_racer'], [true, null], [true, null]]);
  h.close();
});

it('observe: trail_count is refused before the race and commits after it, riding the next attempt', () => {
  const h = mount('observe');
  expect(levers(h)).toEqual([[TRAIL_COUNT_LEVER, 'help', false]]);
  expect(h.dispatch('pull_lever', { lever: TRAIL_COUNT_LEVER }).status).not.toBe('committed');
  run(h);
  answer(h, raceHarnessAnswers(O1).plainWrong);
  expect(nextLever(h.state().task!.workspace!.levers!, last(h)!.miss!)).toBe(TRAIL_COUNT_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: TRAIL_COUNT_LEVER });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/numbered 1, 2, 3/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, keyChoice(O1));
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [TRAIL_COUNT_LEVER] });
  // The head-start item offers a simpler race (two cars from square 0); the plain one is already that.
  expect(raceLevers(O2, []).map(l => l.id)).toEqual([TRAIL_COUNT_LEVER, SIMPLER_LEVERS.observe]);
  h.close();
});

it('predict: the race waits for credit; step_marks and squares_to_go commit; simpler_race opens other cars, then the full item', () => {
  const h = mount('predict', [P2, P1]);
  expect(levers(h).map(([id]) => id)).toEqual([STEP_MARKS_LEVER, TO_GO_LEVER, SIMPLER_LEVERS.predict]);
  expect(keyChoice(P2)).toBe(G);
  answer(h, Y);
  expect(last(h)!.miss).toBe('fastest_not_winner');
  expect(demand(h).run).toBeUndefined();
  expect(nextLever(h.state().task!.workspace!.levers!, 'fastest_not_winner')).toBe(STEP_MARKS_LEVER);
  expect(h.dispatch('pull_lever', { lever: TO_GO_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/Green car 4, Yellow car 12/);
  const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVERS.predict });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 'predict-2~simpler' });
  const simpler = simplerItem(P2)!;
  expect(simpler.racers.some(r => r.name === G || r.name === Y)).toBe(false);
  expect(h.view.container.querySelector('[data-practice="simpler"]')).not.toBeNull();
  answer(h, keyChoice(simpler));
  expect(last(h)).toMatchObject({ itemId: 'predict-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'predict-2' });
  answer(h, G);
  expect(last(h)).toMatchObject({ itemId: 'predict-2', correct: true, levers: [TO_GO_LEVER, SIMPLER_LEVERS.predict] });
  expect(String(demand(h).run)).toMatch(/Green car crossed first/);
  h.close();
});

it('measure: the stop square is a named miss; trail_ticks needs the race, then commits', () => {
  const h = mount('measure', [M2, M1]);
  expect(choicesOf(M2)).toEqual(['6 squares', '7 squares', '9 squares', '10 squares']);
  expect(keyChoice(M2)).toBe('6 squares');
  expect(['10 squares', '9 squares', '7 squares'].map(c => raceMiss(M2, c))).toEqual(['read_position', 'other_racer', 'off_by_one']);
  expect(h.dispatch('pull_lever', { lever: TRAIL_TICKS_LEVER }).status).not.toBe('committed');
  run(h);
  answer(h, '10 squares');
  expect(last(h)!.miss).toBe('read_position');
  expect(nextLever(h.state().task!.workspace!.levers!, 'read_position')).toBe(TRAIL_TICKS_LEVER);
  expect(h.dispatch('pull_lever', { lever: TRAIL_TICKS_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/Red car's trail has a small tick/);
  expect(String(demand(h).onScreen)).not.toMatch(/\b6\b/);
  expect(choicesOf(M1)).toEqual(['3 squares', '6 squares', '9 squares', '10 squares']);
  expect(raceMiss(M1, '3 squares')).toBe('time_as_distance');
  const by: RaceItem = { ...M1, ask: 'farther_by', target: 0, other: 1 };
  expect(choicesOf(by)).toEqual(['3 squares', '6 squares', '9 squares', '15 squares']);
  expect(raceLevers(by, []).map(l => l.id)[0]).toBe(GAP_BRACKET_LEVER);
  h.close();
});

it('calculate: the log reads "?" until credit; each wrong number is a named miss; second_marks and simpler_numbers', () => {
  const h = mount('calculate', [C2, C1]);
  expect(choicesOf(C2)).toEqual(['2 squares per second', '4 squares per second', '8 squares per second', '16 squares per second']);
  expect(['2 squares per second', '8 squares per second', '16 squares per second'].map(c => raceMiss(C2, c)))
    .toEqual(['farther_racer', 'distance_as_speed', 'multiplied']);
  // The slower car moved farther: the faster car is found by dividing, not by the longer trail.
  expect(movedOf(C2, C2.racers[1])).toBeGreaterThan(movedOf(C2, C2.racers[0]));
  answer(h, '2 squares per second');
  expect(last(h)!.miss).toBe('farther_racer');
  expect(nextLever(h.state().task!.workspace!.levers!, 'farther_racer')).toBe(SECOND_MARKS_LEVER);
  expect(h.dispatch('pull_lever', { lever: SECOND_MARKS_LEVER }).status).toBe('committed');
  h.dispatch('retry'); h.confirmVisible();
  answer(h, '4 squares per second');
  expect(String(demand(h).run)).toMatch(/now reads 4 squares per second/);
  expect(choicesOf(C1)).toEqual(['4 squares per second', '12 squares per second', '36 squares per second']);
  const medium: RaceItem = { ...C1, racers: [car(R, 4, 4)], time: 2 };
  expect(choicesOf(medium)).toEqual(['4 squares per second', '6 squares per second', '8 squares per second', '16 squares per second']);
  expect(raceMiss(medium, '6 squares per second')).toBe('ignored_start');
  expect(raceLevers(C2, []).map(l => l.id)).toEqual([SECOND_MARKS_LEVER, SIMPLER_LEVERS.calculate]);
  h.close();
});

it('graph: the line that ends highest is a named miss; one_second_step commits; a speed from a line past 0', () => {
  const h = mount('graph');
  expect(frontIndex(G1)).not.toBe(fastestIndex(G1));
  answer(h, G);
  expect(last(h)!.miss).toBe('highest_line');
  expect(nextLever(h.state().task!.workspace!.levers!, 'highest_line')).toBe(ONE_SECOND_LEVER);
  expect(h.dispatch('pull_lever', { lever: ONE_SECOND_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/On every line, a step/);
  expect(choicesOf(G2)).toEqual(['2 squares per second', '3.5 squares per second', '8 squares per second', '14 squares per second']);
  expect(['3.5 squares per second', '14 squares per second', '8 squares per second'].map(c => raceMiss(G2, c)))
    .toEqual(['ignored_start', 'read_position', 'distance_as_speed']);
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: RaceMode) => TIERS.flatMap(tier => [0, 1, 2, 3, 4, 5].flatMap(seed =>
    buildRaceItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) }).map(i => ({ i, tier }))));

  it.each(MODES)('%s builds items at every tier, each valid, keyed by its numbers, with distinct choices', mode => {
    for (const tier of TIERS) for (let seed = 0; seed < 6; seed++) {
      const items = buildRaceItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) });
      expect(items.length, `${mode} ${tier}`).toBeGreaterThanOrEqual(3);
      for (const i of items) {
        expect(validRaceItem(i), JSON.stringify(i)).toBe(true);
        expect(new Set(choicesOf(i)).size).toBe(choicesOf(i).length);
        expect(choicesOf(i)).toContain(keyChoice(i));
        if (i.mode !== 'predict') for (const r of i.racers) expect(endOf(i, r)).toBeLessThanOrEqual(i.trackLength);
        if (i.mode === 'observe' || i.mode === 'measure') for (const r of i.racers) expect(endOf(i, r)).toBeLessThan(i.trackLength);
      }
    }
  });

  it('the tiers are structural: easy is two cars from square 0; harder adds a head start, a difference, or a second step', () => {
    for (const mode of ['observe', 'predict', 'graph'] as const) for (const { i, tier } of all(mode)) {
      if (tier === 'easy') { expect(hasHeadStart(i)).toBe(false); expect(i.racers.length).toBe(2); }
    }
    for (const { i, tier } of all('observe')) if (tier === 'hard') expect(hasHeadStart(i)).toBe(true);
    for (const { i, tier } of all('predict')) {
      if (tier === 'medium') expect(i.given).toBe('in_time');
      if (tier === 'hard') expect(hasHeadStart(i)).toBe(true);
    }
    for (const { i, tier } of all('measure')) {
      expect(i.ask).toBe(tier === 'medium' ? 'farther_by' : 'distance');
      expect(hasHeadStart(i)).toBe(tier === 'hard');
    }
    for (const { i, tier } of all('calculate')) {
      expect(i.ask).toBe(tier === 'hard' ? 'faster_speed' : 'speed');
      if (tier === 'medium') expect(i.racers[0].start).toBeGreaterThan(0);
      if (tier === 'hard') {
        const f = i.racers[fastestIndex(i)], s = i.racers.find(r => r !== f)!;
        expect(movedOf(i, s)).toBeGreaterThan(movedOf(i, f));
      }
    }
    for (const { i, tier } of all('graph')) {
      if (tier === 'medium') expect(hasHeadStart(i)).toBe(true);
      if (tier === 'hard') { expect(i.ask).toBe('speed'); expect(i.racers[i.target!].start).toBeGreaterThan(0); }
    }
    // The first head-start item of a band is the one where the eye is fooled: the car in front, or the head start winning.
    for (let seed = 0; seed < 6; seed++) {
      const [o] = buildRaceItems({ modes: ['observe'], tier: 'hard', rng: seededRng(`o${seed}`) });
      expect(frontIndex(o)).not.toBe(fastestIndex(o));
      const [p] = buildRaceItems({ modes: ['predict'], tier: 'hard', rng: seededRng(`p${seed}`) });
      expect(winnerIndex(p)).not.toBe(fastestIndex(p));
      const [g] = buildRaceItems({ modes: ['graph'], tier: 'medium', rng: seededRng(`g${seed}`) });
      expect(frontIndex(g)).not.toBe(fastestIndex(g));
    }
  });

  it('the key is spread over the lanes, never always the top or the bottom one', () => {
    for (const mode of ['observe', 'predict', 'graph'] as const) {
      const lanes = new Set(all(mode).filter(({ i }) => i.ask !== 'speed').map(({ i }) => choicesOf(i).indexOf(keyChoice(i))));
      expect(lanes.size, mode).toBeGreaterThan(1);
    }
  });

  it('every wrong choice names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('race-track-lab')!;
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...RACE_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        for (const c of choicesOf(i)) expect(!!raceMiss(i, c), `${i.id} ${c}`).toBe(c !== keyChoice(i));
        const ls = raceLevers(i, []);
        for (const miss of possibleMisses(i)) expect(ls.find(l => l.id === nextLever(ls, miss))!.kind, `${i.id} ${miss}`).toBe('help');
        for (const l of ls) expect(`${l.when} ${l.does}`).not.toContain(keyChoice(i));
      }
    }
    expect(entry.teachingWorkspace!.levers).toBe(true);
  });

  it('no lever draws the key: step marks stop short of the finish, numbered levers never show the key number, facts name no key', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      expect(stepMarksLeak(i)).toBe(false);
      const ids = raceLevers(i, []).filter(l => l.kind === 'help').map(l => l.id);
      for (const id of ids) {
        expect(numberLeak(i, id), `${i.id} ${id}`).toBe(false);
        const fact = leverFact(i, [id]);
        if (i.mode !== 'predict') expect(fact, `${i.id} ${id}`).not.toContain(keyChoice(i));
      }
      const scene = workspaceScene(i, { choice: null, ran: true, solved: false }).facts;
      expect(JSON.stringify({ ...scene, choices: '', question: '' }), i.id).not.toMatch(new RegExp(`"${keyChoice(i)}"|now reads|crossed`));
    }
  });

  it('the simpler race is the same mode with other cars and another key, and never shrinks twice', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = simplerItem({ ...i, id: `${i.mode}-1` });
      if (!s) continue;
      expect(s.mode).toBe(mode);
      expect(s.racers.some(r => i.racers.some(o => o.name === r.name))).toBe(false);
      expect(keyChoice(s)).not.toBe(keyChoice(i));
      expect(validRaceItem(s)).toBe(true);
      expect(simplerItem(s)).toBeNull();
      expect(raceLevers(s, [])).toEqual([]);
    }
    expect(simplerItem(O1)).toBeNull();
  });

  it('a legacy lesson (challenges with types) still builds code items in its modes, the same everywhere', () => {
    const legacy = { title: 'Racers', challenges: [{ type: 'observe' }, { type: 'calculate' }] };
    const items = raceItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['observe', 'calculate']));
    expect(raceItems(legacy)).toEqual(items);
    expect(raceItems({ title: 'K races', grade: 'K' }).every(i => i.mode === 'observe')).toBe(true);
  });
});
