// @vitest-environment jsdom
/**
 * gravity-drop-tower on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every item is code-keyed from one physics model: the key is published only as the spoken expectedAnswer, nothing on
 * screen or in the scene states it before credit (the asked drop has not run, the asked row reads "?"), observe opens
 * its choices only after the learner drops, a wrong answer names its miss, and every miss has a help lever first.
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
import type { GravityDropTowerData } from './GravityDropTower';
import {
  askOf, buildDropItems, choicesOf, DROP_MISSES, dropHarnessAnswers, dropItems, dropMiss, fallen, FALLERS, fallTime, G, keyChoice,
  keyOrder, landTogether, seededRng, tapLabel, validDropItem, workspaceAssignment,
  type DropItem, type DropMode, type DropTier,
} from './gravityDropWorkspace';
import {
  AIR_LEVER, airLines, dropLevers, FALL_LEVER, fallLines, FILL_LEVER, fillLines, FORMULA_LEVER, formulaLines, leverLeak,
  MOON_LEVER, MOON_LINES, ONE_ROW_LEVER, OUTCOME_LEVER, PATTERN_LEVER, patternLines, possibleMisses, SAME_LOOK_LEVER,
  simplerItem, SLOW_LEVER, TIME_FIRST_LEVER, TWO_DROPS_LEVER,
} from './gravityDropLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: DropMode[] = ['observe', 'predict', 'compare', 'measure', 'calculate'];
const TIERS: DropTier[] = ['easy', 'medium', 'hard'];

const OBS_AIR: DropItem = { id: 'observe-1', mode: 'observe', ask: 'first', air: true, drops: [{ obj: 'bowling_ball', height: 10 }, { obj: 'feather', height: 10 }] };
const OBS_NOAIR: DropItem = { id: 'observe-2', mode: 'observe', ask: 'first', air: false, drops: [{ obj: 'tennis_ball', height: 10 }, { obj: 'rock', height: 10 }] };
const PRED_NOAIR: DropItem = { id: 'predict-1', mode: 'predict', ask: 'first', air: false, drops: [{ obj: 'bowling_ball', height: 8 }, { obj: 'feather', height: 8 }] };
const PRED_REASON: DropItem = { id: 'predict-2', mode: 'predict', ask: 'reason', air: true, drops: [{ obj: 'feather', height: 8 }, { obj: 'hammer', height: 8 }] };
const CMP: DropItem = { id: 'compare-1', mode: 'compare', ask: 'order', air: false, drops: [{ obj: 'rock', height: 10 }, { obj: 'baseball', height: 5 }, { obj: 'brick', height: 20 }] };
const MEAS: DropItem = { id: 'measure-1', mode: 'measure', ask: 'time', air: false, measured: [5, 20], drops: [{ obj: 'rock', height: 80 }] };
const CALC: DropItem = { id: 'calculate-1', mode: 'calculate', ask: 'impact', air: false, drops: [{ obj: 'rock', height: 19.6 }] };
const BY_MODE: Record<DropMode, DropItem[]> = {
  observe: [OBS_AIR, OBS_NOAIR], predict: [PRED_NOAIR, PRED_REASON], compare: [CMP, { ...CMP, id: 'compare-2', drops: [{ obj: 'hammer', height: 3 }, { obj: 'watermelon', height: 12 }, { obj: 'rock', height: 6 }] }],
  measure: [MEAS], calculate: [CALC, { ...CALC, id: 'calculate-2', ask: 'time' }],
};

const data = (mode: DropMode, items = BY_MODE[mode]): GravityDropTowerData =>
  ({ title: 'The Great Drop', description: 'Heavy and light land together!', challengeTypes: [mode], items });
const mount = (mode: DropMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'gravity-drop-tower', evalMode: mode, instanceId: 'gravity-drop-tower', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const button = (h: WorkspaceHarness, label: string) => h.view.container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
const answer = (h: WorkspaceHarness, labels: string[]) => { for (const l of labels) h.press(l); h.press(/Check Answer/); h.settle(); };
const current = (h: WorkspaceHarness, mode: DropMode) => dropItems(data(mode)).find(i => i.id === h.state().task!.itemId)!;
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds with its key out of the scene and off the screen, and nothing has fallen', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('gravity-drop-tower')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  expect(demand(h).response).toBe(mode === 'compare' ? 'gesture' : 'speech');
  if (mode !== 'compare') expect(h.state().task!.workspace!.expectedAnswer).toContain(keyChoice(item));
  else expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  // The constraints line names the question it forbids ("Which one landed first?"); the rest must not state the outcome.
  const facts = JSON.stringify({ ...demand(h), constraints: '' });
  expect(facts).not.toMatch(/has run|landed first|landed together:|sped up the/i);
  expect(demand(h).run).toBeUndefined();
  // No description, no Next, no lever card, no stopwatch reading or reveal.
  expect(text(h)).not.toMatch(/land together!|Next →|Finish|stopwatch reads/);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  if (mode === 'measure') expect(text(h)).toContain('80 m?');
  h.close();
});

it('observe: the choices open only after a drop; a wrong tap names its miss; Try again reopens; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('observe');
  expect(h.state().task!.itemId).toBe('observe-1');
  expect(demand(h).presentation).toBe('not ready');
  expect(button(h, 'The bowling ball').disabled).toBe(true);
  expect(String(demand(h).watched)).toMatch(/has not dropped/);
  h.press('Drop'); h.settle(6000);
  expect(demand(h).presentation).toBe('ready');
  expect(String(demand(h).watched)).toMatch(/dropped them once/);
  // Watching prints no time or speed, and the scene does not say what happened.
  expect(text(h)).not.toMatch(/\d s\b|m\/s/);
  expect(JSON.stringify({ ...demand(h), constraints: '' })).not.toMatch(/landed first|has run/);
  answer(h, ['They landed together']);
  expect(last(h)).toMatchObject({ correct: false, miss: 'said_together' });
  expect(button(h, 'The bowling ball').disabled).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  answer(h, ['The bowling ball']);
  expect(last(h)).toMatchObject({ correct: true });
  expect(String(demand(h).run)).toMatch(/bowling ball landed first/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('observe-2');
  h.press('Drop'); h.settle(6000);
  h.say('they landed at the same time'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'gravity-drop-tower' });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'said_together'], [true, null], [true, null]]);
  h.close();
});

it('observe: slow_replay replays the drop and rides the next attempt', () => {
  const h = mount('observe');
  expect(levers(h)).toEqual([[SLOW_LEVER, 'help', false]]);
  const receipt = h.dispatch('pull_lever', { lever: SLOW_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="slow-replay"]')!.textContent).toMatch(/line joining the two objects/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/quarter of the speed/);
  h.settle(20000);
  // The slow replay counts as watching: the choices are open.
  expect(button(h, 'The bowling ball').disabled).toBe(false);
  answer(h, ['The bowling ball']);
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [SLOW_LEVER] });
  h.close();
});

it('predict: nothing falls before credit; heavier_first is answered by moon_card; credit runs the drop', () => {
  const h = mount('predict');
  expect(choicesOf(PRED_NOAIR)).toEqual(['The bowling ball first', 'The feather first', 'They land together']);
  expect(levers(h).map(([id]) => id)).toEqual([MOON_LEVER]);
  answer(h, ['The bowling ball first']);
  expect(last(h)!.miss).toBe('heavier_first');
  expect(demand(h).run).toBeUndefined();
  expect(nextLever(h.state().task!.workspace!.levers!, 'heavier_first')).toBe(MOON_LEVER);
  expect(h.dispatch('pull_lever', { lever: MOON_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="moon-card"]')!.textContent).toMatch(/hammer and a falcon feather/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, ['They land together']);
  expect(last(h)).toMatchObject({ correct: true, levers: [MOON_LEVER] });
  expect(String(demand(h).run)).toMatch(/landed together/);
  expect(text(h)).toMatch(/gravity speeds every object up the same/);
  h.close();
});

it('predict (reason): the right object for the wrong reason is a named miss; outcome_only opens the same pair, then the full item', () => {
  const h = mount('predict', [PRED_REASON]);
  expect(keyChoice(PRED_REASON)).toBe('The hammer first: air slows the feather more');
  expect(levers(h).map(([id]) => id)).toEqual([AIR_LEVER, MOON_LEVER, OUTCOME_LEVER]);
  answer(h, ['The hammer first: heavier things fall faster']);
  expect(last(h)!.miss).toBe('heavier_reason');
  expect(nextLever(h.state().task!.workspace!.levers!, 'heavier_reason')).toBe(AIR_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: OUTCOME_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 'predict-2~simpler' });
  expect(h.view.container.querySelector('[data-practice="simpler"]')).not.toBeNull();
  answer(h, ['The hammer first']);
  expect(last(h)).toMatchObject({ itemId: 'predict-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'predict-2' });
  answer(h, [keyChoice(PRED_REASON)]);
  expect(last(h)).toMatchObject({ itemId: 'predict-2', correct: true });
  h.close();
});

it('compare: ordering by mass is ranked_by_mass; same_look hides the masses; two_drops orders a pair; the key order is credited', () => {
  const h = mount('compare');
  expect(keyOrder(CMP)).toEqual([1, 0, 2]);
  expect(dropHarnessAnswers(CMP).plainWrong).toEqual(['Rock from 10 m', 'Brick from 20 m', 'Baseball from 5 m']);
  answer(h, dropHarnessAnswers(CMP).plainWrong);
  expect(last(h)).toMatchObject({ correct: false, miss: 'ranked_by_mass' });
  expect(demand(h).learnerWork).toBe('Tapped in order: rock, brick, baseball');
  expect(nextLever(h.state().task!.workspace!.levers!, 'ranked_by_mass')).toBe(SAME_LOOK_LEVER);
  expect(h.dispatch('pull_lever', { lever: SAME_LOOK_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="same-look"]')).not.toBeNull();
  const receipt = h.dispatch('pull_lever', { lever: TWO_DROPS_LEVER });
  expect(receipt.status).toBe('committed');
  const pair = simplerItem(CMP)!;
  expect(pair.drops).toHaveLength(2);
  answer(h, keyOrder(pair).map(i => tapLabel(pair, i)));
  expect(last(h)).toMatchObject({ itemId: 'compare-1~simpler', correct: true });
  h.dispatch('advance');
  answer(h, keyOrder(CMP).map(i => tapLabel(CMP, i)));
  expect(last(h)).toMatchObject({ itemId: 'compare-1', correct: true });
  expect(String(demand(h).run)).toMatch(/baseball, then rock, then brick/);
  h.close();
});

it('measure: time in step with the height is linear_scaling; pattern_line names the table\'s pattern, not the asked value', () => {
  const h = mount('measure');
  expect(choicesOf(MEAS)).toEqual(['2.02 s', '3.03 s', '4.04 s', '8.08 s']);
  expect(keyChoice(MEAS)).toBe('4.04 s');
  answer(h, ['8.08 s']);
  expect(last(h)!.miss).toBe('linear_scaling');
  expect(dropMiss(MEAS, { choice: '3.03 s', order: [] })).toBe('added_step');
  expect(h.dispatch('pull_lever', { lever: PATTERN_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="pattern-line"]')!.textContent)
    .toBe('From 5 m to 20 m the height is 4 times as much, and the time is 2 times as much.');
  const one = simplerItem(MEAS)!;
  expect(one).toMatchObject({ measured: [5], drops: [{ height: 20 }] });
  expect(keyChoice(one)).toBe('2.02 s');
  h.close();
});

it('calculate: the fall time given as the speed is gave_time; formula_card and fill_in state no value; time_first asks the time first', () => {
  const h = mount('calculate');
  expect(choicesOf(CALC)).toEqual(['2 m/s', '13.86 m/s', '19.6 m/s', '384.16 m/s']);
  answer(h, ['2 m/s']);
  expect(last(h)!.miss).toBe('gave_time');
  expect(levers(h).map(([id]) => id)).toEqual([FORMULA_LEVER, FILL_LEVER, TIME_FIRST_LEVER]);
  expect(h.dispatch('pull_lever', { lever: FILL_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="fill-in"]')!.textContent).toBe('t = √(2 × 19.6 ÷ 9.8)v = 9.8 × t');
  const first = simplerItem(CALC)!;
  expect(first.ask).toBe('time');
  expect(keyChoice(first)).toBe('2 s');
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: DropMode) => TIERS.flatMap(tier => [1, 2, 3].flatMap(seed =>
    buildDropItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) }).map(i => ({ i, tier }))));

  it('the physics: no air is h = 1/2 g t^2 for every object; with air a feather is far slower; fallen inverts fallTime', () => {
    expect(fallTime('feather', 5, false)).toBeCloseTo(Math.sqrt(10 / G), 9);
    expect(fallTime('bowling_ball', 5, false)).toBe(fallTime('feather', 5, false));
    expect(fallTime('feather', 5, true)).toBeGreaterThan(3 * fallTime('bowling_ball', 5, true));
    for (const obj of ['feather', 'rock', 'paper_ball'] as const) for (const h of [2, 10, 80]) {
      expect(fallen(obj, fallTime(obj, h, true), true)).toBeCloseTo(h, 6);
    }
  });

  it.each(MODES)('%s builds valid items at every tier, with distinct choices and a computed key', mode => {
    for (const tier of TIERS) for (const seed of [1, 2, 3]) {
      const items = buildDropItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) });
      expect(items.length, `${mode} ${tier}`).toBeGreaterThanOrEqual(2);
      for (const i of items) {
        expect(validDropItem(i), JSON.stringify(i)).toBe(true);
        if (i.ask !== 'order') {
          expect(new Set(choicesOf(i)).size).toBe(choicesOf(i).length);
          expect(choicesOf(i)).toContain(keyChoice(i));
        }
      }
    }
  });

  it('the tiers are structural', () => {
    for (const { i, tier } of all('observe')) {
      if (tier === 'easy') expect(i.air && i.ask === 'first').toBe(true);
    }
    expect(all('observe').some(({ i, tier }) => tier === 'hard' && i.ask === 'speed')).toBe(true);
    expect(all('observe').some(({ i, tier }) => tier === 'medium' && landTogether(i))).toBe(true);
    for (const { i, tier } of all('predict')) expect(i.ask).toBe(tier === 'hard' ? 'reason' : 'first');
    expect(all('predict').some(({ i, tier }) => tier === 'medium' && i.drops.some(d => d.obj === 'paper_sheet'))).toBe(true);
    for (const { i, tier } of all('compare')) {
      expect(i.air).toBe(tier === 'hard');
      if (tier === 'easy') expect(new Set(i.drops.map(d => d.obj)).size).toBe(1);
      const by = (f: (k: number) => number) => [0, 1, 2].sort((a, b) => f(a) - f(b));
      const massOrder = by(k => -FALLERS[i.drops[k].obj].mass), heightOrder = by(k => i.drops[k].height);
      // medium: heaviest-first is a wrong order; hard: so is lowest-first (air changes it).
      if (tier !== 'easy') expect(massOrder).not.toEqual(keyOrder(i));
      if (tier === 'hard') expect(heightOrder).not.toEqual(keyOrder(i));
    }
    for (const { i, tier } of all('measure')) {
      expect(i.ask).toBe(tier === 'hard' ? 'height' : 'time');
      expect(i.drops[0].height / i.measured![0]).toBe(tier === 'easy' ? 16 : 9);
    }
    for (const { i, tier } of all('calculate')) expect(i.ask).toBe(tier === 'easy' ? 'time' : tier === 'medium' ? 'height' : 'impact');
  });

  it('a session does not always have the same key', () => {
    for (const mode of ['observe', 'predict'] as const) for (const tier of TIERS) {
      const keys = new Set(buildDropItems({ modes: [mode], tier, rng: seededRng(`k${mode}${tier}`) }).map(i => keyChoice(i).split(' ')[0] + landTogether(i)));
      if (!(mode === 'observe' && tier === 'easy')) expect(keys.size, `${mode} ${tier}`).toBeGreaterThan(1);
    }
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('gravity-drop-tower')!;
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...DROP_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        if (i.ask !== 'order') for (const c of choicesOf(i)) expect(!!dropMiss(i, { choice: c, order: [] }), `${i.id} ${c}`).toBe(c !== keyChoice(i));
        const ls = dropLevers(i, []);
        for (const miss of possibleMisses(i)) {
          expect(DROP_MISSES[mode]).toContain(miss);
          expect(ls.find(l => l.id === nextLever(ls, miss))?.kind, `${i.id} ${miss}`).toBe('help');
        }
        if (i.ask !== 'order') for (const l of ls) expect(`${l.when} ${l.does}`).not.toContain(keyChoice(i));
      }
    }
    expect(entry.teachingWorkspace!.levers).toBe(true);
  });

  it('no ask or lever card states the key or the landing outcome', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const lines = i.mode === 'predict' ? [...airLines(i), ...MOON_LINES] : i.mode === 'compare' ? [...airLines(i), ...fallLines(i)]
        : i.mode === 'measure' ? patternLines(i) : i.mode === 'calculate' ? [...formulaLines(i), ...fillLines(i)] : [];
      for (const line of lines) expect(leverLeak(line, i), `${i.id}: ${line}`).toBe(false);
      if (i.mode === 'measure' || i.mode === 'calculate') expect(leverLeak(askOf(i), i), askOf(i)).toBe(false);
      if (i.mode === 'predict' || i.mode === 'observe') expect(askOf(i)).not.toMatch(/\b(heavier|lighter) (one )?(lands|falls)/i);
    }
  });

  it('the simpler item is the same mode, never the learner\'s own item or key, and never shrinks twice', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = simplerItem(i);
      if (!s) continue;
      expect(s.mode).toBe(mode);
      expect(validDropItem(s)).toBe(true);
      expect(keyChoice(s)).not.toBe(keyChoice(i));
      expect(simplerItem(s)).toBeNull();
      expect(dropLevers(s, [])).toEqual([]);
    }
    expect(simplerItem(OBS_AIR)).toBeNull();
    expect(dropLevers(OBS_AIR, []).map(l => l.id)).toEqual([SLOW_LEVER]);
    expect(dropLevers(CMP, []).map(l => l.id)).toEqual([SAME_LOOK_LEVER, FALL_LEVER, TWO_DROPS_LEVER]);
    expect(dropLevers(MEAS, []).map(l => l.id)).toEqual([PATTERN_LEVER, ONE_ROW_LEVER]);
  });

  it('a legacy lesson (challenges with types) still builds code items in its modes, the same every time', () => {
    const legacy = { title: 'Drop it', challenges: [{ type: 'predict' }, { type: 'measure' }] };
    const items = dropItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['predict', 'measure']));
    expect(dropItems(legacy)).toEqual(items);
  });
});
