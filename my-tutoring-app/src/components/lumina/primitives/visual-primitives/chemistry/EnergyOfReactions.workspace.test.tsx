// @vitest-environment jsdom
/**
 * energy-of-reactions on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every item is a code-keyed closed choice, tapped and checked or said aloud: the key is published only as the spoken
 * expectedAnswer, nothing on screen states it before credit, a wrong tap names its miss, and every miss has a lever.
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
import type { EnergyOfReactionsData } from './EnergyOfReactions';
import {
  ABSORB, BOND_REACTIONS, bondCandidates, bondDeltaH, classifyReactions, DIAGRAMS, diagramCandidates, energyCorrect, energyHarnessAnswers,
  energyItems, energyMiss, ENERGY_MISSES, keyChoice, NAME_LEAKS, RELEASE, releases, THERMO_REACTIONS, workspaceAssignment,
  type DiagramKind, type EnergyItem, type EnergyMode,
} from './energyOfReactionsWorkspace';
import {
  energyLevers, FEWER_LEVER, FLOW_LEVER, LINE_LEVER, MARK_LEVER, ROWS_LEVER, SIMPLER_LEVER, simplerItem, totalsLeak, totalsLines,
  TOTALS_LEVER, VALUES_LEVER,
} from './energyOfReactionsLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: EnergyMode[] = ['classify', 'diagram', 'bond_energy'];
const IDS = ['baking_soda_vinegar', 'magnesium_hcl', 'citric_acid_baking_soda', 'peroxide_yeast'];
const data = (mode: EnergyMode, gradeBand: '5-6' | '7-8' = '7-8'): EnergyOfReactionsData =>
  ({ title: 'Energy Lab', description: 'Baking soda and vinegar gets cold!', reactionIds: IDS, challengeTypes: [mode], gradeBand });
const mount = (mode: EnergyMode, gradeBand: '5-6' | '7-8' = '7-8') => {
  const h = mountWorkspace({ primitiveId: 'energy-of-reactions', evalMode: mode, instanceId: 'energy-of-reactions', data: data(mode, gradeBand) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/Check Answer/); h.settle(); };
const current = (h: WorkspaceHarness, mode: EnergyMode) => energyItems(data(mode)).find(i => i.id === h.state().task!.itemId)!;
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds as a spoken-or-tapped choice whose key stays out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('energy-of-reactions')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  const ws = h.state().task!.workspace!;
  expect(demand(h).response).toBe('speech');
  expect(ws.expectedAnswer).toContain(keyChoice(item));
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/answer is|correct|gets cold/i);
  if (item.mode === 'classify') expect(facts).not.toContain(item.reaction.fact);
  // No description, no type badge or real-world line, no Next, no lever panel, no arrows or values on the diagram.
  const screen = text(h).replace(RELEASE, '').replace(ABSORB, '');
  expect(screen).not.toMatch(/gets cold|exothermic|endothermic|Next →|Finish/i);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(h.view.container.querySelector('[data-reveal]')).toBeNull();
  if (item.mode === 'classify') expect(screen).not.toContain(item.reaction.fact);
  if (item.mode === 'bond_energy') expect(screen).not.toMatch(/total|energy in|energy out/i);
  h.close();
});

it('classify: Run changes the reading; a wrong tap names its miss and closes the choices; Try again keeps the run; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('classify');
  const first = current(h, 'classify');
  expect(first.mode === 'classify' && releases(first.reaction)).toBe(false);
  expect(demand(h).thermometer).toMatch(/Not run yet/);
  expect(text(h)).toContain('Thermometer: 21 °C');
  h.press('Run the reaction'); h.settle();
  expect(demand(h).thermometer).toBe('After the reaction runs in the water, the thermometer reads 16 °C; it read 21 °C before.');
  expect(text(h)).toContain('Thermometer now: 16 °C');
  answer(h, RELEASE);
  expect(last(h)).toMatchObject({ correct: false, miss: 'cooling_called_release' });
  expect(demand(h).learnerWork).toBe(`Chose "${RELEASE}"`);
  expect(h.view.container.querySelector(`button[aria-label="${ABSORB}"]`)!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  expect(demand(h).thermometer).toMatch(/^After the reaction/);
  answer(h, ABSORB);
  expect(last(h)).toMatchObject({ correct: true });
  expect(text(h)).toMatch(/The water went from 21 °C to 16 °C\. Energy moved out of the water into the reaction/);
  h.dispatch('advance'); h.confirmVisible();
  // The remaining three: two spoken, one tapped.
  for (let n = 0; n < 3; n++) {
    const item = current(h, 'classify');
    if (n === 1) { h.press('Run the reaction'); h.settle(); answer(h, keyChoice(item)); h.dispatch('advance'); h.confirmVisible(); continue; }
    h.say(releases((item as Extract<EnergyItem, { mode: 'classify' }>).reaction) ? 'it releases energy' : 'it absorbs energy');
    await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  }
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'energy-of-reactions', classificationTotal: 4 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]).slice(0, 2))
    .toEqual([[false, 'cooling_called_release'], [true, null]]);
  h.close();
});

it('classify: start_mark is refused before the run, then marks the start; heat_flow_card rides the next attempt', () => {
  const h = mount('classify');
  expect(levers(h)).toEqual([[MARK_LEVER, 'help', false], [FLOW_LEVER, 'help', false]]);
  expect(h.dispatch('pull_lever', { lever: MARK_LEVER }).status).toBe('blocked');
  h.press('Run the reaction'); h.settle();
  answer(h, energyHarnessAnswers(current(h, 'classify')).plainWrong);
  expect(nextLever(h.state().task!.workspace!.levers!, last(h)!.miss!)).toBe(MARK_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: MARK_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="start-mark"]')).not.toBeNull();
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/starting reading, 21 °C/);
  expect(h.dispatch('pull_lever', { lever: FLOW_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="heat-flow"]')!.textContent).toMatch(/Water gets colder/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, keyChoice(current(h, 'classify')));
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [MARK_LEVER, FLOW_LEVER] });
  h.close();
});

it('diagram: level_values and start_line draw on the diagram; fewer_choices opens a different diagram with three values', () => {
  const h = mount('diagram');
  expect(current(h, 'diagram')).toMatchObject({ kind: 'direction' });
  expect(levers(h)).toEqual([[VALUES_LEVER, 'help', false]]);
  answer(h, energyHarnessAnswers(current(h, 'diagram')).correct);
  h.dispatch('advance'); h.confirmVisible();
  const item = current(h, 'diagram');
  expect(item).toMatchObject({ kind: 'delta_h' });
  expect(levers(h).map(([id]) => id)).toEqual([VALUES_LEVER, LINE_LEVER, FEWER_LEVER]);
  answer(h, energyHarnessAnswers(item).plainWrong);
  expect(last(h)).toMatchObject({ correct: false, miss: 'sign_flipped' });
  expect(h.dispatch('pull_lever', { lever: VALUES_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="level-values"]')!.textContent).toMatch(/100 kJ.*300 kJ.*450 kJ/);
  expect(h.view.container.querySelector('[data-reveal]')).toBeNull();
  expect(h.dispatch('pull_lever', { lever: LINE_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="start-line"]')).not.toBeNull();
  const receipt = h.dispatch('pull_lever', { lever: FEWER_LEVER });
  expect(receipt.status).toBe('committed');
  const simpler = simplerItem(item)!;
  expect(receipt.state.task).toMatchObject({ itemId: `${item.id}~practice` });
  expect(h.view.container.querySelectorAll('button[aria-label$=" kJ"]')).toHaveLength(3);
  answer(h, keyChoice(simpler));
  expect(last(h)).toMatchObject({ itemId: `${item.id}~practice`, correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: item.id });
  expect(h.view.container.querySelectorAll('button[aria-label$=" kJ"]')).toHaveLength(4);
  answer(h, keyChoice(item));
  expect(last(h)).toMatchObject({ itemId: item.id, correct: true, levers: [VALUES_LEVER, LINE_LEVER, FEWER_LEVER] });
  expect(h.view.container.querySelector('[data-reveal="arrows"]')).not.toBeNull();
  h.close();
});

it('bond_energy: row_totals and in_out_totals never show the difference; simpler_reaction opens a smaller table', () => {
  const h = mount('bond_energy');
  const first = current(h, 'bond_energy');
  // The smallest table has no simpler reaction to offer.
  expect(levers(h)).toEqual([[ROWS_LEVER, 'help', false], [TOTALS_LEVER, 'help', false]]);
  answer(h, energyHarnessAnswers(first).plainWrong);
  expect(last(h)).toMatchObject({ correct: false, miss: 'subtracted_backwards' });
  expect(h.dispatch('pull_lever', { lever: TOTALS_LEVER }).status).toBe('committed');
  const panel = h.view.container.querySelector('[data-lever="in-out-totals"]')!.textContent!;
  expect(panel).toMatch(/Energy in, to break bonds: 679 kJ/);
  expect(panel).not.toMatch(/185/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, keyChoice(first));
  expect(last(h)).toMatchObject({ correct: true, levers: [TOTALS_LEVER] });
  expect(text(h)).toMatch(/ΔH = 679 − 864 = −185 kJ/);
  h.dispatch('advance'); h.confirmVisible();
  const second = current(h, 'bond_energy');
  expect(levers(h).map(([id]) => id)).toEqual([ROWS_LEVER, TOTALS_LEVER, SIMPLER_LEVER]);
  expect(h.dispatch('pull_lever', { lever: ROWS_LEVER }).status).toBe('committed');
  expect(text(h)).toMatch(/4 × 463 = 1852 kJ/);
  const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: `${second.id}~practice` });
  expect(h.view.container.querySelector('[data-practice="simpler_reaction"]')).not.toBeNull();
  h.close();
});

describe('the pure rules', () => {
  const all = (band: '5-6' | '7-8') => MODES.flatMap(m => energyItems(data(m, band)));

  it('every item: the key is a choice, every wrong choice names a catalog miss, and every miss is answered by a help lever first', () => {
    const entry = getComponentById('energy-of-reactions')!;
    for (const mode of MODES) expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...ENERGY_MISSES[mode]].sort());
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const item of [...all('5-6'), ...all('7-8')]) {
      expect(item.choices).toContain(keyChoice(item));
      expect(new Set(item.choices).size).toBe(item.choices.length);
      for (const c of item.choices) {
        expect(!!energyMiss(item, c), `${item.id} ${c}`).toBe(c !== keyChoice(item));
        expect(energyCorrect(item, c)).toBe(c === keyChoice(item));
      }
      const ls = energyLevers(item, []);
      for (const c of item.choices.filter(c => c !== keyChoice(item))) {
        expect(ls.find(l => l.id === nextLever(ls, energyMiss(item, c)!))!.kind, `${item.id} ${c}`).toBe('help');
      }
      for (const l of ls) expect(`${l.when} ${l.does}`).not.toContain(keyChoice(item));
    }
  });

  it('diagram keys are arithmetic on the drawn levels, with every distractor a different number', () => {
    for (const [t, l] of Object.entries(DIAGRAMS)) {
      for (const kind of (l.catalyst !== undefined ? ['catalyst'] : ['amount', 'delta_h', 'activation']) as DiagramKind[]) {
        expect(diagramCandidates(kind, l), `${t} ${kind}`).toHaveLength(4);
      }
    }
    expect(energyItems(data('diagram', '7-8')).map(keyChoice)).toEqual([RELEASE, '+200 kJ', '150 kJ', '100 kJ']);
    expect(energyItems(data('diagram', '5-6')).map(keyChoice)).toEqual([ABSORB, '250 kJ', '350 kJ']);
  });

  it('bond keys are energy in minus energy out, with every distractor a different number', () => {
    for (const r of BOND_REACTIONS) expect(bondCandidates(r).map(([v]) => v), r.id).toHaveLength(4);
    expect(BOND_REACTIONS.map(r => [r.id, bondDeltaH(r)])).toEqual([['h2_cl2', -185], ['h2_br2', -103], ['hi_split', 11],
      ['water_split', 482], ['ammonia', -93], ['ethene_h2', -124], ['methane_o2', -802]]);
    for (const item of energyItems(data('bond_energy'))) for (const line of totalsLines(item)) expect(totalsLeak(item, line), line).toBe(false);
  });

  it('classify reactions: names never say how they feel, both kinds always present, kinds alternate', () => {
    for (const r of THERMO_REACTIONS) expect(NAME_LEAKS.test(r.name), r.name).toBe(false);
    const allWarm = classifyReactions(['magnesium_hcl', 'hcl_naoh', 'peroxide_yeast'], 3);
    expect(allWarm.some(r => !releases(r))).toBe(true);
    expect(classifyReactions(undefined, 5).map(releases)).toEqual([false, true, false, true, false]);
  });

  it('the simpler item keeps the mode and question, is never the learner\'s own, and never shrinks twice', () => {
    for (const item of all('7-8')) {
      const simpler = simplerItem(item);
      if (item.mode === 'classify' || (item.mode === 'diagram' && item.kind === 'direction')) { expect(simpler).toBeNull(); continue; }
      if (!simpler) { expect(item.id).toBe('bond-h2_cl2'); continue; }
      expect(simpler.mode).toBe(item.mode);
      if (simpler.mode === 'diagram' && item.mode === 'diagram') {
        expect(simpler.kind).toBe(item.kind);
        expect(simpler.template).not.toBe(item.template);
        expect(simpler.choices).toHaveLength(3);
      }
      if (simpler.mode === 'bond_energy' && item.mode === 'bond_energy') expect(simpler.reaction.id).not.toBe(item.reaction.id);
      expect(simpler.choices).toContain(keyChoice(simpler));
      expect(simplerItem(simpler)).toBeNull();
      expect(energyLevers(simpler, [])).toEqual([]);
    }
  });
});
