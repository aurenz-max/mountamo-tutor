// @vitest-environment jsdom
/**
 * orbit-mechanics-lab on its boss (a SAY_OR_SHOW card on the spoken preset) and its lever set: what is its own. The
 * generic W1 contract (runtime/workspaceContract.test.tsx) and boss.test.ts cover ownership, the packet and the wiring.
 * Every mode is a code-keyed closed choice, tapped and checked or said aloud: the key is published only as the spoken
 * key (`orbitKey`). Nothing flies before the check. A wrong answer names its miss, and every miss has a help lever first.
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
import type { OrbitMechanicsLabData } from './OrbitMechanicsLab';
import {
  askOf, BURN_TEXT, buildOrbitItems, choiceKey, CIRCLE_TEXT, circleResult, craftSpeed, isTapItem, ORBIT_MISSES,
  orbitCorrect, orbitHarnessAnswers, orbitItems, orbitKey, orbitMiss, PATHS, pushLabel, pushPath, seededRng, tapKey,
  validOrbitItem, workspaceScene,
  type BurnItem, type CircleItem, type OrbitItem, type OrbitMode, type OrbitTier, type RaceItem, type SpeedItem,
} from './orbitWorkspace';
import {
  BURN_CARD_LEVER, DROP_LEVER, MARK_POINTS_LEVER, NO_LEVERS, ORBIT_LEVERS, possibleMisses, PULL_LEVER,
  SAME_SIZE_LEVER, SPEED_ARROWS_LEVER, THROW_LEVER, type OrbitLeverState,
} from './orbitLevers';
import { orbitMechanicsLabBoss } from './orbitMechanicsLab.boss';
import { askLeaks } from '../../../components/live-activity/spokenKey';

const declared = (i: OrbitItem, s: OrbitLeverState = NO_LEVERS) => ORBIT_LEVERS.declare(i, { state: s }, s.pulled);
const leverFacts = (i: OrbitItem, s: OrbitLeverState) => ORBIT_LEVERS.onScreen(i, { state: s }, s.pulled);

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: OrbitMode[] = ['pick_speed', 'orbit_speed', 'predict_burn', 'circularize'];
const TIERS: OrbitTier[] = ['easy', 'medium', 'hard'];

// Hand-built items: a circle asked among a huge, a medium and a small push; the fastest of three rockets where the
// biggest is the farthest; a small push forward; a loop to be made a circle at its far point.
const SPEED: SpeedItem = { id: 'pick_speed-1', mode: 'pick_speed', height: 1.7, ask: 'circle', pushes: [{ f: 1.6 }, { f: 1 }, { f: 0.55 }] };
const RACE: RaceItem = { id: 'orbit_speed-1', mode: 'orbit_speed', ask: 'fastest', crafts: [
  { color: 'red', radius: 3, angle: 30, size: 1.35 }, { color: 'blue', radius: 1.4, angle: 150, size: 0.8 }, { color: 'green', radius: 2, angle: 270, size: 1 }] };
const BURN: BurnItem = { id: 'predict_burn-1', mode: 'predict_burn', height: 2, dir: 'forward', size: 'small', choices: ['closer', 'same', 'farther', 'away'] };
const CIRCLE: CircleItem = { id: 'circularize-1', mode: 'circularize', near: 1.5, far: 3.2, tilt: 90, target: 'far', show: 'words', at: 'side',
  choices: ['far_up', 'far_down', 'near_up', 'near_down'] };
const BY_MODE: Record<OrbitMode, OrbitItem[]> = { pick_speed: [SPEED], orbit_speed: [RACE], predict_burn: [BURN], circularize: [CIRCLE] };

const data = (mode: OrbitMode, gradeLevel = '4'): OrbitMechanicsLabData =>
  ({ title: 'Rocket Around Earth', overview: 'Send the rocket.', challengeTypes: [mode], items: BY_MODE[mode], gradeLevel });
const mount = (mode: OrbitMode, gradeLevel?: string) => {
  const h = mountWorkspace({ primitiveId: 'orbit-mechanics-lab', evalMode: mode, instanceId: 'orbit-mechanics-lab', data: data(mode, gradeLevel) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const flight = (h: WorkspaceHarness) => h.view.container.querySelector('[data-flight]')?.getAttribute('data-flight') ?? null;
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/check/i); h.settle(); };
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds with its key out of the scene and nothing flown', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(getComponentById('orbit-mechanics-lab')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(orbitMechanicsLabBoss.assignment(item).task);
  expect(orbitMechanicsLabBoss.assignment(item)).toMatchObject({ response: 'speech', acceptsGesture: true });
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(flight(h)).toBeNull();
  expect(text(h)).not.toMatch(/Next →|Finish|km|kN/);
  expect(demand(h).credited).toBeUndefined();
  expect(demand(h).flight).toBeUndefined();
  // Every mode is a sayable closed choice (J14): the key is published only as the spoken key.
  expect(demand(h).response).toBe('speech');
  const expected = { pick_speed: /^"Medium push" \(also accept "the medium push", "the middle-sized arrow", "the second one"\)/,
    orbit_speed: /^"Blue rocket" \(also accept "the blue rocket".*"the second one"\)/, predict_burn: /^"Its loop reaches farther out/,
    circularize: /^"Speed up at the far point"/ }[mode];
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(expected);
  if (!isTapItem(item)) {
    const key = mode === 'predict_burn' ? /farther|higher|bigger loop/i : /speed up|slow down/i;
    expect(String(demand(h).shown)).not.toMatch(key);
  }
  h.close();
});

it('K: a tap on push pictures with no input, number, unit or item count, and the pre-reader rule in the scene', () => {
  const h = mount('pick_speed', 'K');
  const c = h.view.container;
  expect(c.querySelector('input')).toBeNull();
  for (const p of SPEED.pushes.map((_, i) => pushLabel(SPEED, i))) expect(c.querySelector(`button[aria-label="${p}"]`)).not.toBeNull();
  // The push buttons carry pictures, not words; the asked outcome is a picture too.
  expect(c.querySelector('button[aria-label="Medium push"]')!.textContent).toBe('');
  expect(c.querySelector('[data-asked="circle"]')).not.toBeNull();
  expect(text(h)).not.toMatch(/\d+\s*(km|kN|m\/s|°)|item \d of/);
  expect(String(demand(h).constraints)).toMatch(/no number, speed or unit/);
  h.close();
  const g4 = mount('pick_speed');
  expect(String(demand(g4).constraints)).not.toMatch(/no number, speed or unit/);
  g4.close();
});

it('a spoken push is credited like a tapped one: its flight is drawn', async () => {
  const h = mount('pick_speed');
  h.say('the medium push'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  h.close();
  const misses = orbitMechanicsLabBoss.assignment(SPEED).misses!.map(m => m.id);
  expect(misses).toEqual(['picked_slower', 'picked_faster']);
});

it('pick_speed: a small push names picked_slower and flies its crash; throw_model draws; right, after, is helped', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('pick_speed');
  expect(askOf(SPEED)).toBe('Which push makes the rocket go around and around Earth in a circle?');
  expect(levers(h)).toEqual([THROW_LEVER, DROP_LEVER]);
  answer(h, 'Small push');
  expect(last(h)).toMatchObject({ correct: false, miss: 'picked_slower' });
  expect(flight(h)).toBe('crash');
  expect(String(demand(h).flight)).toMatch(/falls back down to Earth/);
  expect(nextLever(h.state().task!.workspace!.levers!, 'picked_slower')).toBe(THROW_LEVER);
  expect(h.dispatch('pull_lever', { lever: THROW_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="throw-model"]')!.textContent).toMatch(/farther it goes before it lands/);
  expect(String(demand(h).onScreen)).toMatch(/ball thrown sideways/);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).learnerWork).toBe('Nothing picked yet');
  expect(flight(h)).toBeNull();
  answer(h, 'Medium push');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [THROW_LEVER] });
  expect(flight(h)).toBe('lap');
  h.dispatch('advance'); h.confirmVisible(); h.settle(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'orbit-mechanics-lab' });
  h.close();
});

it('orbit_speed: the biggest rocket is picked_biggest; same_size, pull_card and drop_one; nothing moves before credit', () => {
  const h = mount('orbit_speed');
  expect(levers(h)).toEqual([SAME_SIZE_LEVER, PULL_LEVER, DROP_LEVER]);
  expect(h.view.container.querySelector('animateMotion')).toBeNull();
  answer(h, 'Red rocket');
  expect(last(h)).toMatchObject({ correct: false, miss: 'picked_biggest' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'picked_biggest')).toBe(SAME_SIZE_LEVER);
  expect(h.dispatch('pull_lever', { lever: SAME_SIZE_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/same size/);
  expect(h.dispatch('pull_lever', { lever: PULL_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="pull-card"]')).not.toBeNull();
  h.dispatch('retry'); h.confirmVisible();
  // One untried foil and the key are left beside the tried one: nothing more can be greyed.
  expect(levers(h)).not.toContain(DROP_LEVER);
  answer(h, 'Blue rocket');
  expect(last(h)).toMatchObject({ correct: true, assisted: true });
  expect(h.view.container.querySelectorAll('animateMotion').length).toBe(3);
  h.close();
  expect(orbitMiss(RACE, { pick: 2, choice: null })).toBe('picked_farther');
});

it('predict_burn: too_strong; the new path stays hidden after a miss; speed_arrows; said aloud and credited, it flies', async () => {
  const h = mount('predict_burn');
  expect(levers(h)).toEqual([SPEED_ARROWS_LEVER, DROP_LEVER]);
  answer(h, BURN_TEXT.away);
  expect(last(h)).toMatchObject({ correct: false, miss: 'too_strong' });
  expect(flight(h)).toBeNull();
  expect(h.dispatch('pull_lever', { lever: SPEED_ARROWS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="speed-arrows"]')!.textContent).toMatch(/Speed before.*Speed after/);
  expect(String(demand(h).onScreen)).toMatch(/after arrow is longer/);
  h.dispatch('retry'); h.confirmVisible();
  h.say('the loop goes farther out on the other side'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  h.close();
  expect(orbitMiss(BURN, { pick: null, choice: 'closer' })).toBe('wrong_way');
  expect(orbitMiss(BURN, { pick: null, choice: 'same' })).toBe('said_no_change');
});

it('circularize: other_circle flies the near circle; mark_points, burn_card, drop_one; the key credits', () => {
  const h = mount('circularize');
  expect(levers(h)).toEqual([MARK_POINTS_LEVER, BURN_CARD_LEVER, DROP_LEVER]);
  answer(h, CIRCLE_TEXT.near_down);
  expect(last(h)).toMatchObject({ correct: false, miss: 'other_circle' });
  expect(flight(h)).toBe('lap');
  expect(String(demand(h).flight)).toMatch(/circle as close in as the near point/);
  expect(nextLever(h.state().task!.workspace!.levers!, 'other_circle')).toBe(MARK_POINTS_LEVER);
  expect(h.dispatch('pull_lever', { lever: MARK_POINTS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="mark-points"]')!.textContent).toMatch(/near point.*far point/);
  expect(h.dispatch('pull_lever', { lever: BURN_CARD_LEVER }).status).toBe('committed');
  expect(h.dispatch('pull_lever', { lever: DROP_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector(`button[aria-label="${CIRCLE_TEXT.far_down}"]`)!.hasAttribute('disabled')).toBe(true);
  expect(String(demand(h).onScreen)).toMatch(/"Slow down at the far point" is greyed out/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, CIRCLE_TEXT.far_up);
  expect(last(h)).toMatchObject({ correct: true, assisted: true });
  expect(text(h)).toMatch(/lifts the near side of the loop/);
  h.close();
  expect(circleResult(CIRCLE, 'near_up')).toBe('stretched');
});

describe('the pure rules', () => {
  const all = (mode: OrbitMode) => TIERS.flatMap(tier => [1, 2, 3, 4, 5].flatMap(seed =>
    buildOrbitItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) }).map(i => ({ i, tier }))));

  it.each(MODES)('%s builds four valid, keyed items at every tier', mode => {
    for (const tier of TIERS) for (const seed of [1, 2, 3, 4, 5]) {
      const items = buildOrbitItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) });
      expect(items, `${mode} ${tier} ${seed}`).toHaveLength(4);
      for (const i of items) expect(validOrbitItem(i), `${mode} ${tier} ${i.id}`).toBe(true);
    }
  });

  it('the tiers are structural', () => {
    for (const { i, tier } of all('pick_speed')) {
      const it = i as SpeedItem;
      expect(it.pushes.length).toBe(tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4);
      if (tier === 'hard') expect(it.pushes.map(p => pushPath(it, p)).sort()).toEqual([...PATHS].sort());
    }
    for (const { i, tier } of all('orbit_speed')) {
      const it = i as RaceItem;
      expect(it.crafts.length).toBe(tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4);
      const radii = it.crafts.map(c => c.radius).sort((a, b) => a - b);
      const gap = Math.min(...radii.slice(1).map((r, k) => r / radii[k]));
      expect(gap).toBeGreaterThanOrEqual(tier === 'easy' ? 1.8 : tier === 'medium' ? 1.3 : 1.15);
      expect(new Set(it.crafts.map(c => c.size)).size > 1).toBe(tier === 'hard');
    }
    for (const { i, tier } of all('predict_burn')) {
      const it = i as BurnItem;
      expect(it.choices.length).toBe(tier === 'easy' ? 2 : tier === 'medium' ? 3 : 5);
      if (tier === 'easy') expect(it.size).toBe('small');
    }
    for (const { i, tier } of all('circularize')) {
      const it = i as CircleItem;
      expect(it.choices.length).toBe(tier === 'easy' ? 2 : 4);
      expect(it.show).toBe(tier === 'hard' ? 'ring' : 'words');
    }
    // The key moves: pick_speed's key sits in more than one place and asks more than one outcome.
    const speed = all('pick_speed').map(({ i }) => i as SpeedItem);
    expect(new Set(speed.map(tapKey)).size).toBeGreaterThan(1);
    expect(new Set(speed.map(s => s.ask)).size).toBe(4);
    // orbit_speed asks for the closest rocket and for the farthest one.
    const race = all('orbit_speed').map(({ i }) => i as RaceItem);
    const keyIsClosest = race.map(r => craftSpeed(r.crafts[tapKey(r)]) === Math.max(...r.crafts.map(craftSpeed)));
    expect(new Set(keyIsClosest).size).toBe(2);
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('orbit-mechanics-lab')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...ORBIT_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        const ls = declared(i);
        const misses = possibleMisses(i);
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(ORBIT_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
          // drop_one greys a choice out (assisted work): a miss is first answered by a lever that teaches.
          expect(nextLever(ls, m), `${i.id} ${m}`).not.toBe(DROP_LEVER);
        }
        const a = orbitHarnessAnswers(i);
        expect(orbitCorrect(i, a.correct), i.id).toBe(true);
        expect(orbitCorrect(i, a.plainWrong), i.id).toBe(false);
        expect(orbitMiss(i, a.plainWrong), i.id).toBeDefined();
      }
    }
  });

  it('no ask, scene or lever line states the key before the answer', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = { ...NO_LEVERS, pulled: declared(i).filter(l => l.id !== DROP_LEVER).map(l => l.id) };
      const scene = workspaceScene(i, { work: { pick: null, choice: null }, solved: false, flown: false });
      const lines = [askOf(i), String(scene.facts!.shown), leverFacts(i, s)];
      expect(askLeaks(askOf(i), orbitKey(i), orbitMechanicsLabBoss.spoken!.given?.(i)), i.id).toEqual([]);
      expect(scene.facts!.flight).toBeUndefined();
      expect(scene.facts!.credited).toBeUndefined();
      if (i.mode === 'predict_burn') for (const l of lines) expect(l, `${i.id}: ${l}`).not.toMatch(new RegExp(BURN_TEXT[choiceKey(i) as keyof typeof BURN_TEXT], 'i'));
      if (i.mode === 'circularize') for (const l of lines) expect(l, `${i.id}: ${l}`).not.toMatch(new RegExp(CIRCLE_TEXT[choiceKey(i) as keyof typeof CIRCLE_TEXT], 'i'));
      if (i.mode === 'orbit_speed') for (const l of lines.slice(1)) expect(l, `${i.id}: ${l}`).not.toMatch(/faster|slower|fastest|slowest|quick/i);
    }
  });

  it('a legacy payload (thrust, rocket, challenge; no items) still builds code items by grade', () => {
    const legacy = { title: 'Orbit Maker', gradeLevel: '1', rocket: { massKg: 2000 }, challenge: { type: 'reach_altitude' } };
    const items = orbitItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['pick_speed']));
    expect(orbitItems(legacy)).toEqual(items);
  });
});
