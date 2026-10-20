// @vitest-environment jsdom
/**
 * gas-laws-simulator on its boss (a SAY_OR_SHOW card on the spoken preset) and its lever set, mounted the way a lesson
 * mounts it. Every item is a code-keyed closed choice, tapped and checked or said aloud: the key is published only as
 * the spoken key (`gasKey`), nothing on screen states it before credit (the container shows the gas before the change,
 * the table shows "?"), a wrong tap names its miss, and every miss has a help lever first.
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
import type { GasLawsSimulatorData } from './GasLawsSimulator';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import {
  askOf, buildGasItems, choicesOf, directionOf, gasHarnessAnswers, gasItems, gasKey, gasMiss, heldVars, keyChoice,
  numericChoices, seededRng, showValue, stateAfter, validGasItem,
  type GasItem, type GasLawFocus, type GasMode, type GasTier,
} from './gasLawsWorkspace';
import {
  directionLeak, factorLines, FACTOR_LEVER, GAS_LEVER_CONTEXT, GAS_LEVERS, heldLines, HELD_LEVER, KELVIN_LEVER, ONE_CHANGE_LEVER,
  particleLines, PARTICLE_LEVER, possibleMisses, relationLines, RELATION_LEVER, simplerItem, SIMPLER_LEVER, valueLeak,
} from './gasLawsLevers';
import { GAS_MISSES } from './gasLawsSimulator.card';
import { gasLawsSimulatorBoss } from './gasLawsSimulator.boss';

const gasLevers = (item: GasItem) => GAS_LEVERS.declare(item, GAS_LEVER_CONTEXT, []);

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: GasMode[] = ['observe', 'predict', 'calculate'];
const TIERS: GasTier[] = ['easy', 'medium', 'hard'];
const FOCI: GasLawFocus[] = ['boyle', 'charles', 'gay_lussac', 'combined', 'kmt_only'];

// Hand-built items: a tank heated (observe), a syringe pushed in (predict), a cylinder pressed and heated (calculate),
// and a Celsius tank (predict hard).
const TANK: GasItem = { id: 'observe-1', mode: 'observe', apparatus: 'tank', gas: 'air', before: { P: 2, V: 4, T: 300, n: 1 },
  changes: [{ v: 'T', to: 450 }], asked: 'P', celsius: false, heldNamed: true };
const STAYS: GasItem = { id: 'observe-2', mode: 'observe', apparatus: 'piston', gas: 'air', before: { P: 2, V: 4, T: 300, n: 1 },
  changes: [{ v: 'T', to: 600 }], asked: 'P', celsius: false, heldNamed: false };
const SYRINGE: GasItem = { id: 'predict-1', mode: 'predict', apparatus: 'syringe', gas: 'air', before: { P: 2, V: 6, T: 300, n: 1 },
  changes: [{ v: 'V', to: 4 }], asked: 'P', celsius: false, heldNamed: true };
const CELSIUS: GasItem = { id: 'predict-2', mode: 'predict', apparatus: 'tank', gas: 'helium', before: { P: 2, V: 4, T: 300, n: 1 },
  changes: [{ v: 'T', to: 600 }], asked: 'P', celsius: true, heldNamed: true };
const CYLINDER: GasItem = { id: 'calculate-1', mode: 'calculate', apparatus: 'cylinder', gas: 'air', before: { P: 1, V: 4, T: 300, n: 1 },
  changes: [{ v: 'P', to: 2 }, { v: 'T', to: 900 }], asked: 'V', celsius: false, heldNamed: true };
const BY_MODE: Record<GasMode, GasItem[]> = { observe: [TANK, STAYS], predict: [SYRINGE, CELSIUS], calculate: [CYLINDER, { ...CYLINDER, id: 'calculate-2', changes: [{ v: 'V', to: 2 }, { v: 'T', to: 450 }], asked: 'P' }] };

const data = (mode: GasMode, items = BY_MODE[mode]): GasLawsSimulatorData =>
  ({ title: 'Squeeze and Heat', description: 'The pressure doubles!', challengeTypes: [mode], items, gradeBand: '9-10' });
const mount = (mode: GasMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'gas-laws-simulator', evalMode: mode, instanceId: 'gas-laws-simulator', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/Check Answer/); h.settle(); };
const current = (h: WorkspaceHarness, mode: GasMode, items = BY_MODE[mode]) => gasItems(data(mode, items)).find(i => i.id === h.state().task!.itemId)!;
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds as a spoken-or-tapped choice whose key stays out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('gas-laws-simulator')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(gasLawsSimulatorBoss.assignment(item).task);
  expect(gasLawsSimulatorBoss.assignment(item)).toMatchObject({ response: 'speech', acceptsGesture: true });
  expect(demand(h).response).toBe('speech');
  // The scene's rule is this item's fact, never how the learner answers (the card's moves).
  expect(String(demand(h).constraints)).not.toMatch(/tap|Check Answer/i);
  expect(h.state().task!.workspace!.expectedAnswer).toContain(mode === 'observe' ? keyChoice(item).toLowerCase() : keyChoice(item));
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/\bnow\b|has been run|\bcorrect\b/i);
  // No description, no Next, no lever card, and the asked quantity's after value is "?".
  expect(text(h)).not.toMatch(/doubles|Next →|Finish/);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  const row = Array.from(h.view.container.querySelectorAll('tr')).find(r => r.textContent!.startsWith(item.asked === 'P' ? 'pressure' : item.asked === 'V' ? 'volume' : 'temperature'))!;
  expect(row.lastElementChild!.textContent).toBe('?');
  if (mode !== 'observe') expect(row.textContent).not.toContain(showValue(item, item.asked, stateAfter(item)[item.asked]));
  h.close();
});

it('observe: a wrong tap names its miss and closes the choices; Try again reopens; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('observe');
  expect(h.state().task!.itemId).toBe('observe-1');
  answer(h, 'Goes down');
  expect(last(h)).toMatchObject({ correct: false, miss: 'opposite_direction' });
  expect(demand(h).learnerWork).toBe('Chose "Goes down"');
  expect(text(h)).not.toMatch(/3 atm/);
  expect(h.view.container.querySelector('button[aria-label="Goes up"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  answer(h, 'Goes up');
  expect(last(h)).toMatchObject({ correct: true });
  // The change runs once credited: the table and the reveal show the new pressure.
  expect(text(h)).toContain('3 atm');
  expect(String(demand(h).run)).toMatch(/now reads 3 atm/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('observe-2');
  // The held quantities are not named on this item: the learner infers them from the free piston.
  expect(String(demand(h).held)).toMatch(/^Not stated/);
  // The tutor is told not to settle what the container holds for the learner.
  expect(String(demand(h).constraints)).toMatch(/^What the container keeps the same is part of the question/);
  expect(askOf(STAYS)).not.toMatch(/stays? the same/);
  h.say('it stays the same'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'gas-laws-simulator', directionalPredictionTotal: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'opposite_direction'], [true, null], [true, null]]);
  h.close();
});

it('observe: particle_card changes the screen and the scene fact in one commit and rides the next attempt; held_label only where the ask names nothing held', () => {
  const h = mount('observe');
  expect(levers(h)).toEqual([[PARTICLE_LEVER, 'help', false]]);
  answer(h, gasHarnessAnswers(TANK).plainWrong);
  expect(nextLever(h.state().task!.workspace!.levers!, last(h)!.miss!)).toBe(PARTICLE_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: PARTICLE_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="particle-card"]')!.textContent).toMatch(/Heating makes the particles move faster/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/particle card/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, keyChoice(TANK));
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [PARTICLE_LEVER] });
  // The stays-the-same item asks about a held quantity: no held_label (it would state the answer).
  expect(gasLevers(STAYS).map(l => l.id)).toEqual([PARTICLE_LEVER]);
  const unnamed: GasItem = { ...TANK, heldNamed: false };
  expect(gasLevers(unnamed).map(l => l.id)).toEqual([PARTICLE_LEVER, HELD_LEVER]);
  expect(heldLines(unnamed).join(' ')).toMatch(/cannot stretch/);
  h.close();
});

it('predict: relation_card and factor_line name no after value; simpler_numbers opens the same question doubled, then the full item', () => {
  const h = mount('predict');
  expect(levers(h).map(([id]) => id)).toEqual([RELATION_LEVER, FACTOR_LEVER, SIMPLER_LEVER]);
  answer(h, gasHarnessAnswers(SYRINGE).plainWrong);
  expect(last(h)!.miss).toBe('inverse_factor');
  expect(nextLever(h.state().task!.workspace!.levers!, 'inverse_factor')).toBe(RELATION_LEVER);
  expect(h.dispatch('pull_lever', { lever: FACTOR_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="factor-line"]')!.textContent).toBe('Volume: 6 L to 4 L, two thirds as much.');
  const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 'predict-1~simpler' });
  const simpler = simplerItem(SYRINGE)!;
  expect(simpler.changes[0].to).toBe(3);
  expect(h.view.container.querySelector('[data-practice="simpler"]')).not.toBeNull();
  answer(h, keyChoice(simpler));
  expect(last(h)).toMatchObject({ itemId: 'predict-1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'predict-1' });
  answer(h, keyChoice(SYRINGE));
  expect(last(h)).toMatchObject({ itemId: 'predict-1', correct: true, levers: [FACTOR_LEVER, SIMPLER_LEVER] });
  h.close();
});

it('predict (Celsius): the Celsius ratio is a named miss answered by kelvin_scale first', () => {
  const h = mount('predict', [CELSIUS]);
  expect(choicesOf(CELSIUS)).toEqual(['1 atm', '2 atm', '4 atm', '24.22 atm']);
  expect(askOf(CELSIUS)).toMatch(/27 °C to 327 °C/);
  answer(h, '24.22 atm');
  expect(last(h)!.miss).toBe('celsius_ratio');
  expect(nextLever(h.state().task!.workspace!.levers!, 'celsius_ratio')).toBe(KELVIN_LEVER);
  expect(String(demand(h).constraints)).toMatch(/degrees Celsius; a gas-law ratio needs kelvin/);
  expect(h.dispatch('pull_lever', { lever: KELVIN_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/^Beside the table: 27 °C = 300 K/);
  expect(h.view.container.querySelector('[data-lever="kelvin-scale"]')!.textContent).toMatch(/27 °C = 300 K/);
  h.close();
});

it('calculate: one_change opens the cylinder with one change; each one-change answer is a named miss', () => {
  const h = mount('calculate');
  expect(choicesOf(CYLINDER)).toEqual(['0.67 L', '2 L', '6 L', '12 L']);
  expect(keyChoice(CYLINDER)).toBe('6 L');
  expect(['2 L', '12 L', '0.67 L'].map(c => gasMiss(CYLINDER, c))).toEqual(['first_change_only', 'second_change_only', 'ratio_inverted']);
  answer(h, '2 L');
  expect(last(h)!.miss).toBe('first_change_only');
  const receipt = h.dispatch('pull_lever', { lever: ONE_CHANGE_LEVER });
  expect(receipt.status).toBe('committed');
  const one = simplerItem(CYLINDER)!;
  expect(one.changes).toHaveLength(1);
  expect(askOf(one)).toMatch(/The pressure is raised from 1 atm to 2 atm\. The temperature and the amount of air stay the same\./);
  answer(h, keyChoice(one));
  expect(last(h)).toMatchObject({ itemId: 'calculate-1~simpler', correct: true });
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: GasMode) => TIERS.flatMap(tier => FOCI.flatMap(focus =>
    buildGasItems({ modes: [mode], tier, focus, gas: 'air', rng: seededRng(`${mode}${tier}${focus}`) }).map(i => ({ i, tier, focus }))));

  it.each(MODES)('%s builds items at every tier and focus, each valid, keyed by PV/nT, with distinct choices', mode => {
    for (const tier of TIERS) for (const focus of FOCI) {
      const items = buildGasItems({ modes: [mode], tier, focus, gas: 'air', rng: seededRng(`${mode}${tier}${focus}`) });
      expect(items.length, `${mode} ${tier} ${focus}`).toBeGreaterThanOrEqual(2);
      for (const i of items) {
        expect(validGasItem(i)).toBe(true);
        const a = stateAfter(i), b = i.before;
        expect((a.P * a.V) / (a.n * a.T)).toBeCloseTo((b.P * b.V) / (b.n * b.T), 9);
        expect(new Set(choicesOf(i)).size).toBe(choicesOf(i).length);
        expect(choicesOf(i)).toContain(keyChoice(i));
      }
    }
  });

  it('the tiers are structural: easy names what is held with whole factors; hard hides it (observe) or writes Celsius', () => {
    for (const { i, tier } of all('observe')) {
      expect(i.heldNamed).toBe(tier !== 'hard');
      if (tier !== 'hard') expect(directionOf(i)).not.toBe('Stays the same');
    }
    expect(all('observe').some(({ i, tier }) => tier === 'hard' && directionOf(i) === 'Stays the same')).toBe(true);
    for (const { i, tier } of all('predict')) {
      const f = i.changes[0].to / i.before[i.changes[0].v];
      if (tier === 'easy') expect([2, 3, 0.5, 1 / 3].some(x => Math.abs(x - f) < 1e-9), `${f}`).toBe(true);
      if (tier === 'hard') expect(i.celsius || !i.heldNamed).toBe(true);
    }
    for (const { i, tier } of all('calculate')) expect(i.celsius).toBe(tier === 'hard');
    // Every hard predict session whose containers can be heated has a Celsius item; no changed value is rounded.
    for (const focus of FOCI.filter(f => f !== 'boyle')) {
      const items = buildGasItems({ modes: ['predict'], tier: 'hard', focus, gas: 'air', rng: seededRng(focus) });
      expect(items.some(i => i.celsius), focus).toBe(true);
    }
    for (const mode of MODES) for (const { i } of all(mode)) for (const c of i.changes) {
      expect(Math.abs(c.to / i.before[c.v] * 12 - Math.round(c.to / i.before[c.v] * 12)), `${i.id} ${c.v}`).toBeLessThan(1e-9);
    }
  });

  it('every wrong choice names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('gas-laws-simulator')!;
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...GAS_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        for (const c of choicesOf(i)) expect(!!gasMiss(i, c), `${i.id} ${c}`).toBe(c !== keyChoice(i));
        const ls = gasLevers(i);
        for (const miss of possibleMisses(i)) expect(ls.find(l => l.id === nextLever(ls, miss))!.kind, `${i.id} ${miss}`).toBe('help');
        for (const l of ls) expect(`${l.when} ${l.does}`).not.toContain(keyChoice(i));
      }
    }
    expect(entry.teachingWorkspace!.levers).toBe(true);
  });

  it('no ask, held line or lever card states the asked quantity\'s direction or value', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const lines = [askOf(i), ...particleLines(i), ...(heldVars(i).includes(i.asked) ? [] : heldLines(i)), ...factorLines(i)];
      for (const line of lines) {
        expect(directionLeak(line, i), `${i.id}: ${line}`).toBe(false);
        expect(valueLeak(line, i), `${i.id}: ${line}`).toBe(false);
      }
      // The relation card names what product or ratio stays the same, never a value.
      for (const line of relationLines(i)) expect(valueLeak(line, i) || /\d/.test(line), `${i.id}: ${line}`).toBe(false);
    }
  });

  it('the simpler item is the same mode and question, never the learner\'s own item or key, and never shrinks twice', () => {
    for (const mode of ['predict', 'calculate'] as const) for (const { i } of all(mode)) {
      const s = simplerItem(i);
      if (!s) continue;
      expect(s.mode).toBe(mode);
      expect(s.asked).toBe(i.asked);
      expect(numericChoices(s)).not.toBeNull();
      expect(keyChoice(s)).not.toBe(keyChoice(i));
      expect(simplerItem(s)).toBeNull();
      expect(GAS_LEVERS.simpler(s, GAS_LEVER_CONTEXT, mode === 'predict' ? SIMPLER_LEVER : ONE_CHANGE_LEVER)).toBeNull();
      if (mode === 'calculate') expect(s.changes).toHaveLength(1);
    }
    expect(simplerItem(TANK)).toBeNull();
  });

  it('no ask says its spoken key, and the key takes the ways a learner says the choice', () => {
    for (const mode of MODES) for (const { i } of all(mode)) expect(askLeaks(askOf(i), gasKey(i)), i.id).toEqual([]);
    expect(gasKey(TANK)).toMatchObject({ answer: 'goes up' });
    expect(gasKey(TANK).alsoAccept).toContain('increases');
    expect(gasKey(STAYS).alsoAccept).toContain('unchanged');
    // The bare number is a rule, so a number the ask states for another quantity is not read as the answer.
    expect(gasKey(CYLINDER)).toMatchObject({ answer: '6 L', acceptRule: 'The number 6 said any way, with or without "L", counts.' });
    expect(gasKey(CYLINDER).alsoAccept).toEqual(['the third one']);
  });

  it('a legacy lesson (scenario + challenges) still builds code items in its modes', () => {
    const legacy = { title: 'Boyle', scenario: { lawFocus: 'boyle' }, challenges: [{ type: 'observe' }, { type: 'predict' }] };
    const items = gasItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['observe', 'predict']));
    expect(items.every(i => i.apparatus === 'syringe')).toBe(true);
    expect(gasItems(legacy)).toEqual(items);
  });
});
