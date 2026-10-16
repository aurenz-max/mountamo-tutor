// @vitest-environment jsdom
/**
 * stoichiometry-lab on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every item is built and keyed by code from one reaction: convert is a tapped chain of factor cards, limiting a
 * spoken-or-tapped choice, yield a spoken-or-typed number. The key is published only as a spoken expectedAnswer,
 * nothing on screen computes it before credit, a wrong check names its miss, and every miss has a help lever.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { StoichChallenge, StoichiometryLabData } from './StoichiometryLab';
import {
  atomsOf, BOTH, buildStoichChallenges, cardLabel, convertKey, convertMiss, extentOf, limitingMiss, limitingOf, molarMassOf,
  molesOf, normalizeReaction, reactionFromLibrary, REACTIONS, STOICH_MISSES, STOICH_MODES, STOICH_TIERS, stoichCorrect,
  stoichHarnessAnswers, stoichItems, stoichMiss, stoichSpokenMisses, workspaceAssignment, yieldDistractors, yieldMiss, yieldOf,
  type ConvertItem, type LimitingItem, type StoichItem, type StoichMode, type YieldItem,
} from './stoichiometryLabWorkspace';
import {
  amountLeverLeaks, EASIER_LEVER, easierItem, leverFact, MAP_LEVER, mapLeaks, mapStations, MOLES_LEVER, RECIPE_LEVER,
  recipeLine, moleLine, stoichLevers, UNITS_LEVER,
} from './stoichiometryLabLevers';
import { eligibleReactions, reactionByTopic } from '../../../service/chemistry/gemini-stoichiometry-lab';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const WATER = reactionFromLibrary(REACTIONS.find(r => r.id === 'water')!);
const CHALLENGES: Record<StoichMode, StoichChallenge[]> = {
  convert: [
    { id: 'convert-1', type: 'convert', tier: 'easy', givenFormulaA: 'H2', givenMassA: 4, answerFormula: 'H2', answerUnit: 'mol' },
    { id: 'convert-2', type: 'convert', tier: 'hard', givenFormulaA: 'O2', givenMassA: 16, answerFormula: 'H2O', answerUnit: 'g' },
  ],
  limiting: [
    { id: 'limiting-1', type: 'limiting', tier: 'medium', givenFormulaA: 'H2', givenMassA: 4, givenFormulaB: 'O2', givenMassB: 16 },
    { id: 'limiting-2', type: 'limiting', tier: 'hard', givenFormulaA: 'H2', givenMassA: 6, givenFormulaB: 'O2', givenMassB: 64 },
    { id: 'limiting-3', type: 'limiting', tier: 'easy', givenFormulaA: 'H2', givenMassA: 4, givenFormulaB: 'O2', givenMassB: 32 },
  ],
  yield: [
    { id: 'yield-1', type: 'yield', tier: 'medium', givenFormulaA: 'H2', givenMassA: 8, givenFormulaB: 'O2', givenMassB: 48, answerFormula: 'H2O', answerUnit: 'g' },
  ],
};
const MODES: StoichMode[] = ['convert', 'limiting', 'yield'];
const data = (mode: StoichMode, challenges = CHALLENGES[mode]): StoichiometryLabData =>
  ({ title: 'Water from hydrogen', description: 'Oxygen runs out first!', reaction: WATER, challenges, challengeTypes: [mode], gradeBand: '9-10' });
const mount = (mode: StoichMode, challenges = CHALLENGES[mode]) => {
  const h = mountWorkspace({ primitiveId: 'stoichiometry-lab', evalMode: mode, instanceId: 'stoichiometry-lab', data: data(mode, challenges) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const current = (h: WorkspaceHarness, mode: StoichMode) => stoichItems(data(mode)).find(i => i.id === h.state().task!.itemId)!;
const chain = (h: WorkspaceHarness, labels: string[]) => { for (const l of labels) h.press(l); h.press('Check chain'); h.settle(); };
const type = (h: WorkspaceHarness, item: YieldItem, grams: string) => {
  const input = h.view.container.querySelector<HTMLInputElement>(`input[aria-label="Grams of ${item.product}"]`)!;
  act(() => { fireEvent.change(input, { target: { value: grams } }); });
  h.press('Check Answer'); h.settle();
};
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds with its key out of the scene and nothing computed on screen', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('stoichiometry-lab')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  const ws = h.state().task!.workspace!;
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/runs out first\.|limiting reactant is|answer is|correct/i);
  // No description, no mole counts, no running units, no recipe, no Next before a lever or credit.
  expect(text(h)).not.toMatch(/Oxygen runs out first|Next →|Finish/);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(text(h)).not.toMatch(/\d mol\b(?! [A-Z])/);
  if (item.mode === 'convert') {
    expect(demand(h).response).toBe('gesture');
    expect(ws.expectedAnswer).toBeUndefined();
    expect(text(h)).not.toContain('Take back');
  } else {
    expect(demand(h).response).toBe('speech');
    expect(ws.expectedAnswer).toContain(item.mode === 'limiting' ? limitingOf(item.rx, item.a, item.b) : String(yieldOf(item)));
    expect(facts).not.toContain(`${molesOf(item.rx, item.a)} mol`);
  }
  h.close();
});

it('convert: an upside-down ratio names its miss and closes the tray; Try again clears the chain; unit_track shows the units', () => {
  const h = mount('convert', [CHALLENGES.convert[1]]);
  const item = current(h, 'convert') as ConvertItem;
  expect(levers(h)).toEqual([[UNITS_LEVER, 'help', false], [MAP_LEVER, 'help', false], [EASIER_LEVER, 'simplify', false]]);
  const answers = stoichHarnessAnswers(item);
  chain(h, answers.plainWrong);
  expect(last(h)).toMatchObject({ correct: false, miss: 'upside_down_ratio' });
  expect(String(demand(h).learnerWork)).toMatch(/^Chain: 1 mol O2 per 32 g O2, then 1 mol O2 per 2 mol H2O/);
  expect(h.view.container.querySelector(`button[aria-label="${cardLabel(item, `H2O|mol>g`)}"]`)!.hasAttribute('disabled')).toBe(true);
  expect(text(h)).not.toMatch(/18 g H2O =|= 1 mol/);
  expect(nextLever(h.state().task!.workspace!.levers!, last(h)!.miss!)).toBe(UNITS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: UNITS_LEVER });
  expect(receipt.status).toBe('committed');
  const marks = Array.from(h.view.container.querySelectorAll('[data-lever="unit-track"]')).map(n => n.textContent);
  expect(marks).toEqual(['→ mol O2', 'does not cancel', 'does not cancel']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/unit the chain has reached/);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).learnerWork).toBe('Nothing in the chain yet');
  chain(h, answers.correct);
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [UNITS_LEVER] });
  expect(text(h)).toContain('16 g O2 = 0.5 mol O2 = 1 mol H2O = 18 g H2O.');
  h.close();
});

it('convert: mole_map marks the start and goal and names no card or number; easier_item opens a shorter chain', () => {
  const h = mount('convert', [CHALLENGES.convert[1]]);
  const item = current(h, 'convert') as ConvertItem;
  expect(h.dispatch('pull_lever', { lever: MAP_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="mole-map"]')!.textContent).toMatch(/grams of O2 \(start\).*grams of H2O \(goal\)/);
  expect(mapLeaks(mapStations(item).map(s => s.label))).toBe(false);
  const receipt = h.dispatch('pull_lever', { lever: EASIER_LEVER });
  expect(receipt.status).toBe('committed');
  const simpler = easierItem(item, [item]) as ConvertItem;
  expect(simpler.tier).toBe('medium');
  expect(convertKey(simpler)).toHaveLength(2);
  expect(receipt.state.task).toMatchObject({ itemId: `${item.id}~easier` });
  expect(h.view.container.querySelector('[data-practice="easier-item"]')).not.toBeNull();
  chain(h, stoichHarnessAnswers(simpler).correct);
  expect(last(h)).toMatchObject({ itemId: `${item.id}~easier`, correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: item.id });
  chain(h, stoichHarnessAnswers(item).correct);
  expect(last(h)).toMatchObject({ itemId: item.id, correct: true, levers: [MAP_LEVER, EASIER_LEVER] });
  h.close();
});

it('limiting: a wrong tap names its miss; mole_counts and recipe_card draw without comparing; spoken right submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('limiting', CHALLENGES.limiting.slice(0, 2));
  expect(h.state().task!.itemId).toBe('limiting-1');
  h.press('H2'); h.press('Check Answer'); h.settle();
  expect(last(h)).toMatchObject({ correct: false, miss: 'smaller_mass' });
  expect(text(h)).not.toMatch(/runs out first\./);
  expect(levers(h).map(([id]) => id)).toEqual([MOLES_LEVER, RECIPE_LEVER, EASIER_LEVER]);
  expect(h.dispatch('pull_lever', { lever: MOLES_LEVER }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="mole-count"]')).map(n => n.textContent)).toEqual(['= 2 mol H2', '= 0.5 mol O2']);
  expect(h.dispatch('pull_lever', { lever: RECIPE_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="recipe-card"] span.rounded-full')).toHaveLength(2 + 1 + 2);
  const item = current(h, 'limiting');
  expect(amountLeverLeaks(item, leverFact(item, [MOLES_LEVER, RECIPE_LEVER]))).toBe(false);
  h.dispatch('retry'); h.confirmVisible();
  h.press('O2'); h.press('Check Answer'); h.settle();
  expect(last(h)).toMatchObject({ correct: true, levers: [MOLES_LEVER, RECIPE_LEVER] });
  expect(text(h)).toContain('O2 runs out first.');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('limiting-2');
  h.say('hydrogen'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'stoichiometry-lab', limitingReagentTotal: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'smaller_mass'], [true, null], [true, null]]);
  h.close();
});

it('yield: a typed excess-reactant amount names from_excess; the right grams credit and show the worked result', () => {
  const h = mount('yield');
  const item = current(h, 'yield') as YieldItem;
  expect(yieldOf(item)).toBe(54);
  type(h, item, '72');
  expect(last(h)).toMatchObject({ correct: false, miss: 'from_excess' });
  expect(demand(h).learnerWork).toBe('Typed 72 g');
  expect(text(h)).not.toMatch(/\b54\b/);
  h.dispatch('retry'); h.confirmVisible();
  expect(h.view.container.querySelector<HTMLInputElement>('input[aria-label="Grams of H2O"]')!.value).toBe('');
  type(h, item, '54');
  expect(last(h)).toMatchObject({ correct: true });
  expect(text(h)).toContain('O2 runs out first. 3 mol H2O forms, which is 54 g.');
  h.close();
});

describe('the pure rules', () => {
  it('every library reaction is balanced, and its molar masses come from the formulas', () => {
    for (const r of REACTIONS) {
      const count = (side: Array<[string, number]>) => side.reduce<Record<string, number>>((acc, [f, c]) => {
        for (const [el, k] of Object.entries(atomsOf(f)!)) acc[el] = (acc[el] ?? 0) + k * c;
        return acc;
      }, {});
      expect(count(r.reactants), r.id).toEqual(count(r.products));
    }
    expect([molarMassOf('H2O'), molarMassOf('Al2O3'), molarMassOf('Cu(NO3)2'), molarMassOf('NaCl'), molarMassOf('Xx2')])
      .toEqual([18, 102, 187.5, 58.5, null]);
    // A model's wrong molar mass is replaced by the formula's.
    expect(normalizeReaction({ equation: '', reactants: [{ formula: 'H2', molarMass: 3, coefficient: 2 }, { formula: 'O2', molarMass: 32, coefficient: 1 }],
      products: [{ formula: 'H2O', molarMass: 20, coefficient: 2 }] })!.subs.map(s => s.M)).toEqual([2, 32, 18]);
  });

  it('every reaction builds every mode it allows at every tier, with the tier\'s structure or an honest lower tier', () => {
    for (const r of REACTIONS) {
      const reaction = reactionFromLibrary(r);
      for (const mode of STOICH_MODES) {
        for (const tier of STOICH_TIERS) {
          const cs = buildStoichChallenges(reaction, [mode], tier, 7);
          const rx = normalizeReaction(reaction)!;
          if (mode !== 'convert' && rx.subs.filter(s => s.side === 'reactant').length < 2) { expect(cs).toEqual([]); continue; }
          expect(cs.length, `${r.id} ${mode} ${tier}`).toBe(3);
          const items = stoichItems({ ...data(mode, cs), reaction });
          expect(items).toHaveLength(3);
          for (const item of items) {
            expect(STOICH_TIERS.indexOf(item.tier)).toBeLessThanOrEqual(STOICH_TIERS.indexOf(tier));
            if (item.mode === 'convert') expect(convertKey(item)).toHaveLength(STOICH_TIERS.indexOf(item.tier) + 1);
            if (item.mode === 'yield') {
              expect(Number.isInteger(yieldOf(item)), `${r.id} yield key ${yieldOf(item)}`).toBe(true);
              expect(yieldDistractors(item).map(d => d.id)).toContain('from_excess');
            }
            if (item.mode !== 'convert' && limitingOf(item.rx, item.a, item.b) !== BOTH) {
              const lim = limitingOf(item.rx, item.a, item.b), L = lim === item.a.formula ? item.a : item.b, O = L === item.a ? item.b : item.a;
              const massTrap = L.grams > O.grams, moleTrap = molesOf(item.rx, L) > molesOf(item.rx, O);
              if (item.tier === 'easy') expect(massTrap || moleTrap).toBe(false);
              if (item.tier === 'medium') expect([massTrap, moleTrap]).toEqual([true, false]);
              if (item.tier === 'hard') expect(moleTrap).toBe(true);
              expect(Math.abs(extentOf(item.rx, item.a) - extentOf(item.rx, item.b)) / Math.max(extentOf(item.rx, item.a), extentOf(item.rx, item.b))).toBeGreaterThanOrEqual(0.2);
            }
          }
          if (mode === 'limiting') expect(items.filter(i => i.mode === 'limiting' && limitingOf(i.rx, i.a, i.b) === BOTH)).toHaveLength(1);
        }
      }
    }
  });

  it('the hard tiers realize their traps on the reactions that allow them', () => {
    const items = stoichItems({ ...data('limiting', buildStoichChallenges(WATER, ['limiting'], 'hard', 3)) }) as LimitingItem[];
    expect(items.filter(i => limitingOf(i.rx, i.a, i.b) !== BOTH).every(i => i.tier === 'hard')).toBe(true);
    const convert = stoichItems(data('convert', buildStoichChallenges(WATER, ['convert'], null, 3))) as ConvertItem[];
    expect(convert.map(i => convertKey(i).length)).toEqual([1, 2, 3]);
  });

  it('convert misses read the chain\'s pattern', () => {
    const item = stoichItems(data('convert'))[1] as ConvertItem; // 16 g O2 -> g H2O
    const m = (chain: string[]) => convertMiss(item, chain);
    expect(m(['O2|g>mol', 'H2O|per|O2'])).toBe('stopped_short');
    expect(m(['O2|g>mol', 'H2O|per|O2', 'H2O|mol>g', 'O2|per|H2O'])).toBe('extra_step');
    expect(m(['O2|mol>g'])).toBe('upside_down_molar_mass');
    expect(m(['O2|g>mol', 'O2|per|H2O'])).toBe('upside_down_ratio');
    expect(m(['O2|g>mol', 'H2O|mol>g'])).toBe('skipped_ratio');
    expect(m(['H2O|per|O2', 'O2|g>mol'])).toBe('out_of_order');
    expect(m(['O2|g>mol', 'H2O|per|O2', 'H2O|g>mol'])).toBe('upside_down_molar_mass');
    expect(m(['H2O|g>mol'])).toBe('other_substance');
    expect(m(['O2|per|H2O'])).toBe('wrong_card');
    expect(m(convertKey(item))).toBeUndefined();
  });

  it('limiting and yield misses read the choice and the number', () => {
    const [med, hard, both] = stoichItems(data('limiting')) as LimitingItem[];
    expect([limitingOf(med.rx, med.a, med.b), limitingOf(hard.rx, hard.a, hard.b), limitingOf(both.rx, both.a, both.b)]).toEqual(['O2', 'H2', BOTH]);
    expect([limitingMiss(med, 'H2'), limitingMiss(med, BOTH), limitingMiss(hard, 'O2'), limitingMiss(both, 'H2')])
      .toEqual(['smaller_mass', 'said_both', 'fewer_moles', 'missed_both']);
    const y = stoichItems(data('yield'))[0] as YieldItem;
    expect(yieldDistractors(y)).toEqual([{ id: 'from_excess', grams: 72 }, { id: 'skipped_ratio', grams: 27 },
      { id: 'upside_down_ratio', grams: 13.5 }, { id: 'mass_sum', grams: 56 }]);
    expect(['72', '27', '13.5', '56', '100', '54', '54.3', 'many'].map(t => yieldMiss(y, t)))
      .toEqual(['from_excess', 'skipped_ratio', 'upside_down_ratio', 'mass_sum', 'other_amount', undefined, undefined, undefined]);
    expect(stoichCorrect(y, { chain: [], choice: null, typed: '54 g' })).toBe(true);
  });

  it('every wrong answer names a catalog miss, every miss has a help lever first, and no lever names the key', () => {
    const entry = getComponentById('stoichiometry-lab')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...STOICH_MISSES[mode]].sort());
      const items: StoichItem[] = stoichItems(data(mode, buildStoichChallenges(WATER, [mode], null, 11)));
      for (const item of items) {
        const wrong = stoichHarnessAnswers(item).plainWrong;
        const work = item.mode === 'convert' ? { chain: convertKey(item).length === 1 ? ['H2|mol>g', 'O2|mol>g'].filter(x => x.startsWith(item.given.formula)) : [], choice: null, typed: '' }
          : item.mode === 'limiting' ? { chain: [], choice: wrong[0], typed: '' } : { chain: [], choice: null, typed: wrong[0] };
        if (item.mode !== 'convert') expect(STOICH_MISSES[mode]).toContain(stoichMiss(item, work));
        const ls = stoichLevers(item, [], items);
        for (const miss of STOICH_MISSES[mode]) expect(ls.find(l => l.id === nextLever(ls, miss))!.kind, `${item.id} ${miss}`).toBe('help');
        const key = item.mode === 'yield' ? String(yieldOf(item)) : item.mode === 'limiting' ? `${limitingOf(item.rx, item.a, item.b)} runs out` : '';
        for (const l of ls) if (key) expect(`${l.when} ${l.does}`).not.toContain(key);
        if (item.mode !== 'convert') {
          expect(amountLeverLeaks(item, `${moleLine(item.rx, item.a)} ${moleLine(item.rx, item.b)} ${recipeLine(item.rx)}`)).toBe(false);
          for (const m of stoichSpokenMisses(item)) expect(STOICH_MISSES[mode]).toContain(m.id);
        }
        const simpler = easierItem(item, items);
        if (item.tier === 'easy') expect(simpler).toBeNull();
        else {
          expect(simpler!.mode).toBe(item.mode);
          expect(STOICH_TIERS.indexOf(simpler!.tier)).toBeLessThan(STOICH_TIERS.indexOf(item.tier));
          expect(JSON.stringify({ ...simpler, id: '', rx: null, tier: '' })).not.toBe(JSON.stringify({ ...item, id: '', rx: null, tier: '' }));
        }
      }
    }
  });

  it('the generator picks among reactions every requested mode can use, and falls back on topic words', () => {
    expect(eligibleReactions(['limiting'], '9-10').map(r => r.id)).not.toContain('peroxide');
    expect(eligibleReactions(['convert'], '8').every(r => r.intro)).toBe(true);
    expect(reactionByTopic('The Haber process and fertilizer', eligibleReactions(['yield'], '11-12')).id).toBe('ammonia');
  });
});
