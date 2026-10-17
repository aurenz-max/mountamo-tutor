// @vitest-environment jsdom
/**
 * mission-planner on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every mode is a code-keyed closed choice, tapped and checked or said aloud: the key is published only as the spoken
 * expectedAnswer. Nothing that answers the question is drawn before the answer. A wrong answer names its miss, and every
 * miss is answered by a lever. K-1 is the ungraded story and never binds.
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
import { validateMissionPlannerData } from '../../../components/live-activity/adapters/missionPlannerLive';
import { getComponentById } from '../../../service/manifest/catalog';
import type { MissionPlannerData } from './MissionPlanner';
import {
  askOf, buildMissionItems, keyOf, MISSION_MISSES, missionCorrect, missionHarnessAnswers, missionItems, missionMiss,
  optionCount, packsNeeded, PLACE_AU, PLACES, revealText, seededRng, separation, slipValue, validMissionItem,
  windowDistance, workspaceAssignment, workspaceScene,
  type AssistItem, type FartherItem, type MissionItem, type MissionMode, type MissionTier, type PackItem, type WindowItem,
} from './missionWorkspace';
import {
  ASK_ARROW_LEVER, ASSIST_CARD_LEVER, CREW_ROWS_LEVER, DISTANCE_LINES_LEVER, DROP_LEVER, FUEL_CARD_LEVER, HOME_LEG_LEVER, leverFacts,
  LIMIT_LINE_LEVER, missionLevers, NO_LEVERS, possibleMisses,
} from './missionLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: MissionMode[] = ['farther_closer', 'pick_window', 'pack_days', 'assist_tradeoff'];
const TIERS: MissionTier[] = ['easy', 'medium', 'hard'];

// Hand-built items. Farthest of four (Uranus is next in line); the July window is the close one; a crew of 3 for 3 days
// there and 2 staying (key 24; 15 forgets the way home); four routes with a limit of 6 years (B: two flybys, in time).
const FAR: FartherItem = { id: 'farther_closer-1', mode: 'farther_closer', ask: 'far', places: ['mars', 'neptune', 'uranus', 'jupiter'] };
const WINDOW: WindowItem = { id: 'pick_window-1', mode: 'pick_window', target: 'mars', ask: 'least', windows: [
  { month: 'March 2027', earth: 0, planet: 180 }, { month: 'July 2027', earth: 120, planet: 130 }, { month: 'October 2027', earth: 210, planet: 280 }] };
const PACK: PackItem = { id: 'pack_days-1', mode: 'pack_days', there: 3, stay: 2, crew: 3, options: [15, 24, 8, 30] };
const ASSIST: AssistItem = { id: 'assist_tradeoff-1', mode: 'assist_tradeoff', target: 'jupiter', limit: 6, routes: [
  { flybys: [], years: 3 }, { flybys: ['venus', 'earth'], years: 5 }, { flybys: ['venus', 'venus', 'earth'], years: 8 }, { flybys: ['mars'], years: 6 }] };
const BY_MODE: Record<MissionMode, MissionItem[]> = { farther_closer: [FAR], pick_window: [WINDOW], pack_days: [PACK], assist_tradeoff: [ASSIST] };

const data = (mode: MissionMode): MissionPlannerData =>
  ({ title: 'Mission Control', overview: 'Plan.', challengeTypes: [mode], items: BY_MODE[mode], gradeLevel: '4' });
const mount = (mode: MissionMode) => {
  const h = mountWorkspace({ primitiveId: 'mission-planner', evalMode: mode, instanceId: 'mission-planner', data: data(mode) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const all = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel).length;
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/check/i); h.settle(); };
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds with its key out of the scene and nothing answered on screen', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(validMissionItem(item)).toBe(true);
  expect(getComponentById('mission-planner')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(all(h, '[data-distance-strip], [data-ship-path], [data-distance-line], [data-limit-line], [data-day="home"]')).toBe(0);
  expect(h.view.container.textContent).not.toMatch(/Next →|Finish|Best|optimal|closest!/);
  expect(demand(h).credited).toBeUndefined();
  expect(demand(h).response).toBe('speech');
  const expected = { farther_closer: /^"Neptune" \(choice 2 of 4\)/, pick_window: /^"July 2027" \(choice 2 of 3\)/,
    pack_days: /^"24 packs" \(choice 2 of 4\)/, assist_tradeoff: /^"Route B" \(choice 2 of 4\)/ }[mode];
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(expected);
  expect(levers(h)).toEqual({ farther_closer: [ASK_ARROW_LEVER, DROP_LEVER], pick_window: [DISTANCE_LINES_LEVER, FUEL_CARD_LEVER, DROP_LEVER],
    pack_days: [HOME_LEG_LEVER, CREW_ROWS_LEVER, DROP_LEVER], assist_tradeoff: [ASSIST_CARD_LEVER, LIMIT_LINE_LEVER, DROP_LEVER] }[mode]);
  h.close();
});

it('farther_closer: the next place in line names next_in_line; ask_arrow and drop_one; the map comes after the credit', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('farther_closer');
  answer(h, 'Uranus');
  expect(last(h)).toMatchObject({ correct: false, miss: 'next_in_line' });
  expect(all(h, '[data-distance-strip]')).toBe(0);
  expect(nextLever(h.state().task!.workspace!.levers!, 'next_in_line')).toBe(DROP_LEVER);
  expect(nextLever(h.state().task!.workspace!.levers!, 'other_end')).toBe(ASK_ARROW_LEVER);
  expect(h.dispatch('pull_lever', { lever: ASK_ARROW_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="ask-arrow"]')!.textContent).toMatch(/farthest from Earth/);
  // The arrow names no place.
  expect(h.view.container.querySelector('[data-lever="ask-arrow"]')!.textContent).not.toMatch(/Mars|Neptune|Uranus|Jupiter/);
  expect(h.dispatch('pull_lever', { lever: DROP_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('button[aria-label="Mars"]')!.hasAttribute('disabled')).toBe(true);
  expect(String(demand(h).onScreen)).toMatch(/Mars is greyed out/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'Neptune');
  expect(last(h)).toMatchObject({ correct: true, assisted: true });
  expect(all(h, '[data-distance-strip]')).toBe(1);
  expect(h.view.container.textContent).toMatch(/Neptune is the farthest/);
  h.dispatch('advance'); h.confirmVisible(); h.settle(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'mission-planner', challengeType: 'farther_closer' });
  h.close();
  expect(missionMiss(FAR, { pick: 0 })).toBe('other_end');
  expect(missionMiss(FAR, { pick: 3 })).toBe('in_between');
});

it('pick_window: the far-apart month names far_apart; fuel_card first; distance lines on every month; the path after credit', () => {
  const h = mount('pick_window');
  answer(h, 'March 2027');
  expect(last(h)).toMatchObject({ correct: false, miss: 'far_apart' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'far_apart')).toBe(FUEL_CARD_LEVER);
  expect(h.dispatch('pull_lever', { lever: DISTANCE_LINES_LEVER }).status).toBe('committed');
  expect(all(h, '[data-distance-line]')).toBe(3);
  expect(h.dispatch('pull_lever', { lever: FUEL_CARD_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="fuel-card"]')!.textContent).toMatch(/least fuel when/);
  h.dispatch('retry'); h.confirmVisible();
  expect(all(h, '[data-ship-path]')).toBe(0);
  answer(h, 'July 2027');
  expect(last(h)).toMatchObject({ correct: true, assisted: true });
  expect(all(h, '[data-ship-path]')).toBe(1);
  h.close();
  expect(missionMiss(WINDOW, { pick: 2 })).toBe('in_between_window');
});

it('pack_days: forgetting the way home names forgot_home; home_leg draws it; crew_rows; said aloud and credited', async () => {
  const h = mount('pack_days');
  expect(all(h, '[data-day="there"]')).toBe(3);
  expect(all(h, '[data-day="stay"]')).toBe(2);
  answer(h, '15 packs');
  expect(last(h)).toMatchObject({ correct: false, miss: 'forgot_home' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'forgot_home')).toBe(HOME_LEG_LEVER);
  expect(h.dispatch('pull_lever', { lever: HOME_LEG_LEVER }).status).toBe('committed');
  expect(all(h, '[data-day="home"]')).toBe(3);
  expect(h.dispatch('pull_lever', { lever: CREW_ROWS_LEVER }).status).toBe('committed');
  expect(all(h, '[data-crew-pack]')).toBe(3);
  expect(String(demand(h).onScreen)).toMatch(/no total is written/);
  h.dispatch('retry'); h.confirmVisible();
  h.say('twenty-four packs'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  h.close();
  expect(missionMiss(PACK, { pick: 2 })).toBe('forgot_crew');
  expect(missionMiss(PACK, { pick: 3 })).toBe('stay_twice');
});

it('assist_tradeoff: the slow route names too_slow; limit_line marks every route; the key credits', () => {
  const h = mount('assist_tradeoff');
  answer(h, 'Route C');
  expect(last(h)).toMatchObject({ correct: false, miss: 'too_slow' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'too_slow')).toBe(LIMIT_LINE_LEVER);
  expect(h.dispatch('pull_lever', { lever: LIMIT_LINE_LEVER }).status).toBe('committed');
  expect(all(h, '[data-limit-line]')).toBe(4);
  expect(h.dispatch('pull_lever', { lever: ASSIST_CARD_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="assist-card"]')!.textContent).toMatch(/free push/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'Route B');
  expect(last(h)).toMatchObject({ correct: true, assisted: true });
  expect(h.view.container.textContent).toMatch(/Route B: it gets to Jupiter in 5 years/);
  h.close();
  expect(missionMiss(ASSIST, { pick: 0 })).toBe('picked_direct');
  expect(missionMiss(ASSIST, { pick: 3 })).toBe('fewer_flybys');
});

describe('the pure rules', () => {
  const many = (mode: MissionMode, tier: MissionTier, n = 5, tag = '') => Array.from({ length: n }, (_, s) =>
    buildMissionItems({ modes: [mode], tier, rng: seededRng(`${tag}${mode}${tier}${s}`) })).flat();

  it.each(MODES)('%s builds four valid, keyed items at every tier', mode => {
    for (const tier of TIERS) for (const seed of [1, 2, 3, 4, 5]) {
      const items = buildMissionItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) });
      expect(items, `${mode} ${tier} ${seed}`).toHaveLength(4);
      for (const i of items) expect(validMissionItem(i), `${mode} ${tier} ${i.id}`).toBe(true);
    }
  });

  it('the tiers are structural', () => {
    for (const tier of TIERS) {
      const n = tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4;
      for (const mode of MODES) for (const i of many(mode, tier)) expect(optionCount(i), `${i.id} ${tier}`).toBe(n);
      for (const i of many('farther_closer', tier) as FartherItem[]) {
        const idx = i.places.map(p => PLACES.indexOf(p)).sort((a, b) => a - b);
        const gaps = idx.slice(1).map((x, k) => x - idx[k]);
        if (tier === 'easy') expect(gaps[0]).toBeGreaterThanOrEqual(3);
        if (tier === 'medium') expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2);
        if (tier === 'hard') expect(i.ask === 'far' ? gaps.at(-1) : gaps[0]).toBe(1);
      }
      for (const i of many('pack_days', tier) as PackItem[]) expect(i.crew > 1).toBe(tier === 'hard');
      for (const i of many('pick_window', tier) as WindowItem[]) {
        const s = i.windows.map(w => (i.ask === 'least' ? separation(w) : 180 - separation(w))).sort((a, b) => a - b);
        if (tier === 'hard') { expect(s[1]).toBeGreaterThanOrEqual(45); expect(s[1]).toBeLessThanOrEqual(75); }
        if (tier === 'easy') expect(s[1]).toBeGreaterThanOrEqual(140);
      }
    }
    for (const mode of MODES) expect(new Set(TIERS.flatMap(t => many(mode, t)).map(keyOf)).size, mode).toBeGreaterThan(1);
  });

  it('no fixed strategy wins a mode at any tier (160 items per tier, each at most 75%)', () => {
    // A learner who does not use the idea: the first or last choice, the biggest planet, always the farthest place,
    // always the closest planets, the biggest, smallest or middle number, the most flybys, the fastest, the slowest that
    // still arrives in time. Sizes are the real order of planet size (the pictures are drawn the same size).
    const SIZE: Record<string, number> = { moon: 1, mars: 2, asteroids: 0, jupiter: 7, saturn: 6, uranus: 5, neptune: 4.9 };
    const argBy = <T,>(xs: T[], f: (x: T) => number, dir: 1 | -1) => xs.reduce((b, x, k) => (dir * (f(x) - f(xs[b])) > 0 ? k : b), 0);
    const nth = (xs: number[], k: number) => xs.indexOf([...xs].sort((a, b) => b - a)[k]);
    const S: Record<MissionMode, Record<string, (i: never) => number>> = {
      farther_closer: {
        first: () => 0, last: (i: FartherItem) => i.places.length - 1,
        biggest_planet: (i: FartherItem) => argBy(i.places, p => SIZE[p], 1),
        always_farthest: (i: FartherItem) => argBy(i.places, p => PLACE_AU[p], 1),
      },
      pick_window: {
        first: () => 0, last: (i: WindowItem) => i.windows.length - 1,
        always_closest: (i: WindowItem) => argBy(i.windows, w => windowDistance(i.target, w), -1),
        always_far_apart: (i: WindowItem) => argBy(i.windows, w => windowDistance(i.target, w), 1),
      },
      pack_days: {
        first: () => 0, biggest: (i: PackItem) => nth(i.options, 0), second_biggest: (i: PackItem) => nth(i.options, 1),
        smallest: (i: PackItem) => nth(i.options, i.options.length - 1),
        second_smallest: (i: PackItem) => nth(i.options, i.options.length - 2),
      },
      assist_tradeoff: {
        first: () => 0,
        most_flybys: (i: AssistItem) => argBy(i.routes, r => r.flybys.length, 1),
        second_most_flybys: (i: AssistItem) => i.routes.map((r, k) => ({ f: r.flybys.length, k })).sort((a, b) => b.f - a.f)[1].k,
        fastest: (i: AssistItem) => argBy(i.routes, r => r.years, -1),
        slowest: (i: AssistItem) => argBy(i.routes, r => r.years, 1),
        slowest_in_time: (i: AssistItem) => argBy(i.routes, r => (r.years <= i.limit ? r.years : -1), 1),
      },
    };
    const table: string[] = [];
    for (const mode of MODES) for (const tier of TIERS) {
      const items = many(mode, tier, 40, 'strat');
      expect(items.length).toBe(160);
      const row: string[] = [];
      for (const [name, f] of Object.entries(S[mode])) {
        const rate = items.filter(i => f(i as never) === keyOf(i)).length / items.length;
        row.push(`${name} ${(rate * 100).toFixed(0)}%`);
        expect(rate, `${mode} ${tier} ${name} wins ${(rate * 100).toFixed(0)}%`).toBeLessThanOrEqual(0.75);
      }
      table.push(`${mode} ${tier}: ${row.join(', ')}`);
    }
    if (process.env.MISSION_STRATEGY_TABLE) console.log(table.join('\n'));
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a lever on it', () => {
    const entry = getComponentById('mission-planner')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...MISSION_MISSES[mode]].sort());
      for (const i of TIERS.flatMap(t => many(mode, t))) {
        const ls = missionLevers(i, NO_LEVERS);
        const misses = possibleMisses(i);
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(MISSION_MISSES[mode]).toContain(m);
          expect(ls.some(l => l.answers?.includes(m)), `${i.id} ${m}`).toBe(true);
          // farther_closer is recall: no help lever may order the places, so next_in_line and in_between go to simplify.
          if (m !== 'next_in_line' && m !== 'in_between') expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
        const a = missionHarnessAnswers(i);
        expect(missionCorrect(i, a.correct), i.id).toBe(true);
        expect(missionCorrect(i, a.plainWrong), i.id).toBe(false);
        expect(missionMiss(i, a.plainWrong), i.id).toBeDefined();
      }
    }
  });

  it('pack_days: every button is the key or a named slip', () => {
    for (const i of TIERS.flatMap(t => many('pack_days', t)) as PackItem[]) {
      for (const v of i.options) {
        expect(v === packsNeeded(i) || MISSION_MISSES.pack_days.some(m => slipValue(i, m as never) === v), `${i.id} ${v}`).toBe(true);
      }
    }
  });

  it('no ask, scene or lever line states the key, an order, a distance or a total before the answer', () => {
    for (const mode of MODES) for (const i of TIERS.flatMap(t => many(mode, t))) {
      const s = { ...NO_LEVERS, pulled: missionLevers(i, NO_LEVERS).filter(l => l.kind === 'help').map(l => l.id) };
      const scene = workspaceScene(i, { work: { pick: null }, solved: false });
      const lines = [askOf(i), ...Object.values(scene.facts!).map(String), leverFacts(i, s) ?? ''];
      for (const v of Object.values(scene.facts!)) expect(String(v).length, i.id).toBeLessThanOrEqual(500);
      expect(scene.facts!.credited).toBeUndefined();
      for (const l of lines) {
        expect(l, `${i.id}: ${l}`).not.toMatch(/\b(best|optimal|closest together|farthest apart|in all|altogether|total of \d|AU)\b/);
      }
    }
  });

  it('the reveal explains the key', () => {
    for (const mode of MODES) for (const i of TIERS.flatMap(t => many(mode, t))) expect(revealText(i).length, i.id).toBeGreaterThan(30);
    expect(revealText(PACK)).toMatch(/^24 packs: 3 days there, 2 days staying and 3 days home make 8 days/);
    expect(revealText(WINDOW)).toMatch(/^July 2027: Earth and Mars are closest together/);
  });

  it('K-1 is the story: no items, and the adapter refuses it; a legacy payload builds by grade', () => {
    expect(missionItems({ title: 'Trip', gradeLevel: 'K' })).toEqual([]);
    expect(() => validateMissionPlannerData({ title: 'Trip', gradeLevel: '1', items: [], story: { places: ['moon', 'mars'] } }))
      .toThrow(/ungraded/);
    const legacy = { title: 'Mars Mission', gradeLevel: '2', destinations: [], launchWindows: [] };
    const items = missionItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['farther_closer', 'pick_window']));
    expect(missionItems(legacy)).toEqual(items);
  });
});
