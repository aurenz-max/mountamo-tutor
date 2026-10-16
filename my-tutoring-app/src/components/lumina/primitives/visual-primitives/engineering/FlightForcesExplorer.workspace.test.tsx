// @vitest-environment jsdom
/**
 * flight-forces-explorer on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The
 * generic W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * predict and observe are code-keyed closed choices, tapped and checked or said aloud: the key is published only as
 * the spoken expectedAnswer, and the plane holds still until credit. adjust is a setting checked by code against the
 * goal. A wrong answer names its miss, and every miss has a help lever first.
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
import type { FlightForcesExplorerData } from './FlightForcesExplorer';
import {
  AIRCRAFT_IDS, askedAxes, askOf, buildFlightItems, choicesFor, emptyWork, FLIGHT_MISSES, flightCorrect, flightHarnessAnswers,
  flightItems, flightMiss, forcesAt, goalMet, keyLabel, keyOf, pressesTo, seededRng, solution, validFlightItem,
  workspaceAssignment, type AdjustItem, type FlightItem, type FlightMode, type FlightTier, type ObserveItem, type PredictItem,
} from './flightForcesWorkspace';
import {
  countLines, COUNT_UNITS_LEVER, flightLevers, FORCE_LINK_LEVER, forceLinkLines, leverFact, motionLeak, ONE_AXIS_LEVER,
  ONE_CONTROL_LEVER, ONE_STEP_LEVER, PAIR_UP_LEVER, possibleMisses, SHOW_ARROWS_LEVER, simplerItem, STALL_MARK_LEVER,
  stallLine, TARGET_MARKS_LEVER,
} from './flightForcesLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: FlightMode[] = ['predict', 'observe', 'adjust'];
const TIERS: FlightTier[] = ['easy', 'medium', 'hard'];

// Hand-built items: the landing gear lowered (predict, key "Slows down"), a stall (predict hard, key "Sinks"),
// one direction read from wide arrows (observe), both directions with the nose drawn up while the plane sinks, a
// coupled nose with a stall step (adjust hard) and a two-control level goal (adjust medium).
const GEAR: PredictItem = { id: 'predict-1', mode: 'predict', aircraft: 'cessna', change: 'gear_down', asked: 'speed', named: false, later: false };
const STALL: PredictItem = { id: 'predict-2', mode: 'predict', aircraft: 'cessna', change: 'stall', asked: 'height', named: false, later: false };
const WIDE: ObserveItem = { id: 'observe-1', mode: 'observe', aircraft: 'jumbo_jet', forces: { lift: 7, weight: 4, thrust: 3, drag: 3 }, asked: 'height', noseUp: false };
const NOSE: ObserveItem = { id: 'observe-2', mode: 'observe', aircraft: 'jumbo_jet', forces: { lift: 5, weight: 6, thrust: 4, drag: 3 }, asked: 'both', noseUp: true };
const CLIMB: AdjustItem = { id: 'adjust-1', mode: 'adjust', aircraft: 'cessna', weight: 6, lift0: 3, drag0: 3, start: { thrust: 3, nose: 0 },
  goal: { height: 'Climbs', speed: 'Keeps its speed' }, controls: ['thrust', 'nose'], coupled: true, stall: true, story: 'The plane must climb over a ridge ahead.' };
const LEVEL_GOAL: AdjustItem = { id: 'adjust-2', mode: 'adjust', aircraft: 'cessna', weight: 6, lift0: 4, drag0: 4, start: { thrust: 2, nose: 0 },
  goal: { height: 'Stays level', speed: 'Keeps its speed' }, controls: ['thrust', 'nose'], coupled: false, stall: false, story: 'The plane has taken on a heavy load of water, and its landing gear is down.' };
const BY_MODE: Record<FlightMode, FlightItem[]> = { predict: [GEAR, STALL], observe: [WIDE, NOSE], adjust: [CLIMB, LEVEL_GOAL] };

const data = (mode: FlightMode, items = BY_MODE[mode]): FlightForcesExplorerData =>
  ({ title: 'Four Forces Lab', overview: 'Fly a plane.', challengeTypes: [mode], items, gradeBand: '3-5' });
const mount = (mode: FlightMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'flight-forces-explorer', evalMode: mode, instanceId: 'flight-forces-explorer', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const tap = (h: WorkspaceHarness, ...labels: string[]) => { for (const l of labels) h.press(l); h.press(/Check Answer/); h.settle(); };
const fly = (h: WorkspaceHarness, item: AdjustItem, to: { thrust: number; nose: number }) => {
  for (const l of pressesTo(item.start, to)) h.press(l);
  h.press(/Fly and check/); h.settle();
};
const current = (h: WorkspaceHarness, mode: FlightMode) => flightItems(data(mode)).find(i => i.id === h.state().task!.itemId)!;
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds with its key out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('flight-forces-explorer')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/has been run|now moves|flew the setting|\bcorrect\b/i);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(text(h)).not.toMatch(/Next →|Finish|CLIMBING|CRUISING|STALL!/);
  // No read-aloud that would send text to the tutor on the workspace path.
  expect(h.view.container.querySelector('[aria-label="Read the question to me"]')).toBeNull();
  if (mode === 'adjust') {
    expect(demand(h).response).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  } else {
    expect(demand(h).response).toBe('speech');
    const key = keyLabel(item as PredictItem | ObserveItem, askedAxes(item)[0]);
    expect(h.state().task!.workspace!.expectedAnswer).toContain(`"${key}"`);
    expect(String(demand(h).question)).not.toContain(key === 'Stays level' ? 'Stays level' : key);
  }
  h.close();
});

it('predict: a wrong tap names its miss and closes the choices; Try again reopens; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('predict');
  expect(h.state().task!.itemId).toBe('predict-1');
  tap(h, 'Speeds up');
  expect(last(h)).toMatchObject({ correct: false, miss: 'opposite_way' });
  expect(demand(h).learnerWork).toBe('Chose "Speeds up"');
  expect(demand(h).run).toBeUndefined();
  expect(h.view.container.querySelector('button[aria-label="Slows down"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  tap(h, 'Slows down');
  expect(last(h)).toMatchObject({ correct: true });
  // The change runs once credited.
  expect(String(demand(h).run)).toMatch(/drag 6/);
  expect(text(h)).toMatch(/Drag \(6\) is bigger than thrust \(4\)/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('predict-2');
  h.say('it sinks'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'flight-forces-explorer', challengesTotal: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'opposite_way'], [true, null], [true, null]]);
  h.close();
});

it('predict: force_link and show_arrows change the screen and the scene in one commit; one_step opens a simpler stall item', () => {
  const h = mount('predict');
  expect(levers(h)).toEqual([[FORCE_LINK_LEVER, 'help', false], [SHOW_ARROWS_LEVER, 'help', false]]);
  tap(h, 'Keeps its speed');
  expect(last(h)!.miss).toBe('said_no_change');
  expect(nextLever(h.state().task!.workspace!.levers!, 'said_no_change')).toBe(FORCE_LINK_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: FORCE_LINK_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="force-link"]')!.textContent).toMatch(/more drag/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/more drag/);
  expect(h.dispatch('pull_lever', { lever: SHOW_ARROWS_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/drag 6/);
  h.dispatch('retry'); h.confirmVisible();
  tap(h, 'Slows down');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [FORCE_LINK_LEVER, SHOW_ARROWS_LEVER] });
  h.dispatch('advance'); h.confirmVisible();
  expect(levers(h).map(([id]) => id)).toEqual([FORCE_LINK_LEVER, SHOW_ARROWS_LEVER, ONE_STEP_LEVER]);
  tap(h, 'Climbs');
  expect(last(h)!.miss).toBe('stall_more_lift');
  const step = h.dispatch('pull_lever', { lever: ONE_STEP_LEVER });
  expect(step.status).toBe('committed');
  expect(step.state.task).toMatchObject({ itemId: 'predict-2~simpler' });
  expect(h.view.container.querySelector('[data-practice="simpler"]')!.textContent).toMatch(/a little, to 6°/);
  tap(h, 'Climbs');
  expect(last(h)).toMatchObject({ itemId: 'predict-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'predict-2' });
  tap(h, 'Sinks');
  expect(last(h)).toMatchObject({ itemId: 'predict-2', correct: true });
  h.close();
});

it('observe: both rows are needed; the nose-up miss is named; pair_up and count_units draw, one_axis asks the height first', () => {
  const h = mount('observe');
  tap(h, 'Climbs');
  expect(last(h)).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('observe-2');
  // The Check stays closed until both rows have a choice.
  h.press('Speeds up');
  expect((Array.from(h.view.container.querySelectorAll('button')).find(b => /Check Answer/.test(b.textContent ?? '')) as HTMLButtonElement).disabled).toBe(true);
  h.press('Climbs'); h.press(/Check Answer/); h.settle();
  expect(last(h)).toMatchObject({ correct: false, miss: 'followed_nose' });
  expect(levers(h).map(([id]) => id)).toEqual([PAIR_UP_LEVER, COUNT_UNITS_LEVER, ONE_AXIS_LEVER]);
  expect(h.dispatch('pull_lever', { lever: PAIR_UP_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="pair-up"]')).not.toBeNull();
  expect(h.dispatch('pull_lever', { lever: COUNT_UNITS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="pair-up"]')!.textContent).toMatch(/lift.*5.*weight.*6/i);
  expect(String(demand(h).onScreen)).toMatch(/Lift 5, Weight 6, Thrust 4, Drag 3/);
  const axis = h.dispatch('pull_lever', { lever: ONE_AXIS_LEVER });
  expect(axis.state.task).toMatchObject({ itemId: 'observe-2~simpler' });
  tap(h, 'Sinks');
  expect(last(h)).toMatchObject({ itemId: 'observe-2~simpler', correct: true });
  h.dispatch('advance');
  tap(h, 'Sinks', 'Speeds up');
  expect(last(h)).toMatchObject({ itemId: 'observe-2', correct: true });
  h.close();
});

it('adjust: a flight is the check; tilting the nose without more thrust is forgot_drag; target_marks, stall_mark and one_control', () => {
  const h = mount('adjust');
  expect(levers(h).map(([id]) => id)).toEqual([TARGET_MARKS_LEVER, STALL_MARK_LEVER, ONE_CONTROL_LEVER]);
  fly(h, CLIMB, { thrust: 3, nose: 4 });
  expect(last(h)).toMatchObject({ correct: false, miss: 'forgot_drag' });
  // The learner's own flight runs, and says what that setting did; never the goal setting.
  expect(String(demand(h).run)).toMatch(/climbs and slows down/);
  expect(text(h)).toMatch(/The plane climbs and slows down\. That is not the goal\./);
  expect(h.view.container.querySelector('button[aria-label="More thrust"]')!.hasAttribute('disabled')).toBe(true);
  expect(h.dispatch('pull_lever', { lever: TARGET_MARKS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="target-marks"]')).not.toBeNull();
  h.dispatch('retry'); h.confirmVisible();
  expect(String(demand(h).learnerWork)).toMatch(/Thrust set to 3, nose angle 0°/);
  expect(demand(h).run).toBeUndefined();
  fly(h, CLIMB, { thrust: 3, nose: 5 });
  expect(last(h)!.miss).toBe('stalled');
  expect(nextLever(h.state().task!.workspace!.levers!, 'stalled')).toBe(STALL_MARK_LEVER);
  expect(h.dispatch('pull_lever', { lever: STALL_MARK_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="stall-mark"]')!.textContent).toBe(stallLine(CLIMB));
  h.dispatch('retry'); h.confirmVisible();
  fly(h, CLIMB, solution(CLIMB)!);
  expect(last(h)).toMatchObject({ correct: true, levers: [TARGET_MARKS_LEVER, STALL_MARK_LEVER] });
  h.dispatch('advance'); h.confirmVisible();
  const one = h.dispatch('pull_lever', { lever: ONE_CONTROL_LEVER });
  expect(one.state.task).toMatchObject({ itemId: 'adjust-2~simpler' });
  expect(h.view.container.querySelector('button[aria-label="More thrust"]')!.hasAttribute('disabled')).toBe(true);
  const practice = simplerItem(LEVEL_GOAL) as AdjustItem;
  fly(h, practice, solution(practice)!);
  expect(last(h)).toMatchObject({ itemId: 'adjust-2~simpler', correct: true });
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: FlightMode) => TIERS.flatMap(tier => AIRCRAFT_IDS.flatMap(aircraft =>
    buildFlightItems({ modes: [mode], tier, aircraft, rng: seededRng(`${mode}${tier}${aircraft}`) }).map(i => ({ i, tier }))));

  it.each(MODES)('%s builds valid, keyed items at every tier', mode => {
    for (const { i, tier } of all(mode)) {
      expect(validFlightItem(i), `${mode} ${tier} ${i.id}`).toBe(true);
      if (i.mode === 'adjust') {
        expect(goalMet(i, i.start)).toBe(false);
        expect(solution(i)).not.toBeNull();
      } else {
        for (const a of askedAxes(i)) expect(choicesFor(a)).toContain(keyLabel(i, a));
      }
    }
    expect(all(mode).filter(x => x.tier === 'medium').length).toBeGreaterThanOrEqual(AIRCRAFT_IDS.length * 3);
  });

  it('the tiers are structural', () => {
    for (const { i, tier } of all('predict')) {
      if (i.mode !== 'predict') continue;
      expect(i.named).toBe(tier === 'easy');
      if (tier !== 'hard') expect(i.later || i.change === 'stall').toBe(false);
    }
    expect(all('predict').filter(x => x.tier === 'hard').every(({ i }) => i.mode === 'predict' && (i.later || ['stall', 'gear_and_throttle', 'crate_and_nose'].includes(i.change)))).toBe(true);
    for (const { i, tier } of all('observe')) {
      if (i.mode !== 'observe') continue;
      const gaps = [Math.abs(i.forces.lift - i.forces.weight), Math.abs(i.forces.thrust - i.forces.drag)];
      if (tier === 'easy') expect(i.asked).not.toBe('both');
      if (tier === 'hard') { expect(i.asked).toBe('both'); expect(Math.max(...gaps)).toBeLessThanOrEqual(1); }
    }
    expect(all('observe').some(({ i, tier }) => tier === 'hard' && i.mode === 'observe' && i.noseUp && keyOf(i).height !== 'Climbs')).toBe(true);
    for (const { i, tier } of all('adjust')) {
      if (i.mode !== 'adjust') continue;
      expect(i.controls.length).toBe(tier === 'easy' ? 1 : 2);
      expect(i.coupled && i.stall).toBe(tier === 'hard');
    }
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('flight-forces-explorer')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...FLIGHT_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        const ls = flightLevers(i, []);
        const misses = possibleMisses(i);
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(FLIGHT_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
      }
    }
    // The harness's wrong answer is wrong and named; its right answer is right.
    for (const mode of MODES) for (const { i } of all(mode)) {
      const a = flightHarnessAnswers(i);
      expect(flightCorrect(i, a.correct), i.id).toBe(true);
      expect(flightCorrect(i, a.plainWrong), i.id).toBe(false);
      expect(flightMiss(i, a.plainWrong), i.id).toBeDefined();
    }
  });

  it('no lever line or ask names a motion the learner must work out', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const lines = [...(i.mode === 'predict' ? forceLinkLines(i) : []), ...(i.mode === 'observe' ? countLines(i.forces) : []),
        ...(i.mode === 'adjust' && i.stall ? [stallLine(i)] : []), leverFact(i, flightLevers(i, []).filter(l => l.kind === 'help').map(l => l.id))];
      for (const line of lines) expect(motionLeak(line), `${i.id}: ${line}`).toBe(false);
      if (i.mode !== 'adjust') {
        // The ask states the plane before the change ("flying level at a steady speed"), never the asked motion.
        const ask = askOf(i).replace('flying level at a steady speed', '');
        for (const a of askedAxes(i)) expect(ask, i.id).not.toContain(keyLabel(i, a).toLowerCase());
      }
    }
  });

  it('the simpler item stays in the mode, never repeats the key, and never shrinks twice', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = simplerItem(i);
      if (!s) continue;
      expect(s.mode).toBe(mode);
      expect(simplerItem(s)).toBeNull();
      expect(flightLevers(s, [])).toEqual([]);
      if (s.mode === 'predict' && i.mode === 'predict') expect(keyLabel(s, s.asked)).not.toBe(keyLabel(i, i.asked));
      if (s.mode === 'adjust') { expect(s.controls).toEqual(['nose']); expect(goalMet(s, s.start)).toBe(false); expect(solution(s)).not.toBeNull(); }
    }
    expect(simplerItem(GEAR)).toBeNull();
    expect(simplerItem(WIDE)).toBeNull();
  });

  it('a legacy lesson (model-written challenges) still builds code items in its modes', () => {
    const legacy = { title: 'Sky Forces', aircraftType: 'glider', challenges: [{ type: 'predict' }, { type: 'observe' }] };
    const items = flightItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['predict', 'observe']));
    expect(items.every(i => i.aircraft === 'cessna')).toBe(true);
    expect(flightItems(legacy)).toEqual(items);
    expect(emptyWork(CLIMB).setting).toEqual(CLIMB.start);
    expect(forcesAt(CLIMB, { thrust: 7, nose: 4 })).toEqual({ lift: 7, weight: 6, thrust: 7, drag: 7 });
  });
});
