// @vitest-environment jsdom
/**
 * mixing-and-dissolving on its boss (a SAY_OR_SHOW card on the spoken preset) and its lever set, mounted the way a
 * lesson mounts it. One tapped choice and Submit Answer commits a checked gesture with its named miss, or a spoken
 * answer is judged; Try again clears the choice; the runtime owns progression; the key is published only as the spoken
 * key (`dissolvingKey`), never in the scene. Nothing on screen states the answer while a challenge is open. Levers change the
 * screen in the same commit and never draw the answer.
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
import type { DissolvingChallenge, MixingAndDissolvingData, SubstanceEntry } from './MixingAndDissolving';
import {
  buildClassifyItems, buildSortItems, dissolvingHarnessAnswers, dissolvingMiss, shuffledChallenge,
} from './mixingAndDissolvingWorkspace';
import { farChoice, modelsFor, modelsLeak, NO_LEVERS } from './mixingAndDissolvingLevers';
import { mixingAndDissolvingBoss } from './mixingAndDissolving.boss';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const sub = (id: string, name: string, type: SubstanceEntry['type']): SubstanceEntry =>
  ({ id, name, formula: null, type, maxSolubility: type === 'soluble' ? 36 : null, solubilityVsTemp: 'unchanged', color: '#ffffff', particleColor: '#cccccc' });
const SUBSTANCES = [sub('salt', 'Table Salt', 'soluble'), sub('sand', 'Sand', 'insoluble'), sub('oil', 'Cooking Oil', 'immiscible_liquid')];
const SOLVENT = { name: 'Water', formula: 'H2O', volume: 200, temperature: 20 };
const PARTICLE: DissolvingChallenge = { id: 'p1', type: 'particle_explain', answerType: 'multiple_choice',
  instruction: 'Add the salt and open the particle view. What happened to the salt particles?',
  options: ['They disappeared completely', 'They spread out among the water particles', 'They sank to the bottom', 'They turned into water'],
  correctOptionIndex: 1, hint: 'Look closely.', narration: '' };
const SEPARATE: DissolvingChallenge = { id: 's1', type: 'separate', answerType: 'multiple_choice',
  instruction: 'How would you get the salt back out of salt water?', options: ['Filtration', 'Evaporation', 'Using a magnet', 'Decanting'],
  correctOptionIndex: 1, hint: 'Think.', narration: '' };
const LAB = { solvent: SOLVENT, substances: SUBSTANCES };

const CHALLENGES: Record<string, DissolvingChallenge[]> = {
  dissolve: [...buildSortItems(SUBSTANCES, 'Water'), PARTICLE],
  classify: buildClassifyItems(SUBSTANCES, 'Water'),
  separate: [SEPARATE],
};
const MODES = ['dissolve', 'classify', 'separate'] as const;

const mount = (mode: string, challenges: DissolvingChallenge[]) => {
  const data: MixingAndDissolvingData = { title: 'Kitchen lab', solvent: SOLVENT, substances: SUBSTANCES, separationMethods: [
    { method: 'filtration', worksFor: ['Sand'], description: 'Filter it.', animation: '' },
    { method: 'evaporation', worksFor: ['Table Salt'], description: 'Boil it away.', animation: '' }],
  challenges, gradeBand: '3-5' };
  const h = mountWorkspace({ primitiveId: 'mixing-and-dissolving', evalMode: mode, instanceId: 'dissolving', data: { ...data } });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press('Submit Answer'); h.settle(); };
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

describe('code-built items', () => {
  it('sort and classify keys come from the substance type the beaker draws', () => {
    expect(buildSortItems(SUBSTANCES, 'Water').map(c => [c.id, c.options[c.correctOptionIndex]]).sort())
      .toEqual([['sort-oil', "Doesn't dissolve"], ['sort-salt', 'Dissolves'], ['sort-sand', "Doesn't dissolve"]]);
    expect(buildClassifyItems(SUBSTANCES, 'Water').map(c => [c.id, c.options[c.correctOptionIndex]]).sort())
      .toEqual([['classify-oil', 'Two layers'], ['classify-salt', 'A solution'], ['classify-sand', 'A suspension']]);
    // A partly soluble substance has no one answer, so it gets no item.
    expect(buildSortItems([sub('cocoa', 'Cocoa', 'partially_soluble')], 'Water')).toEqual([]);
  });
  it('a multiple-choice item keeps its key through the fixed shuffle; true-false keeps its order', () => {
    const s = shuffledChallenge(SEPARATE);
    expect(s.options[s.correctOptionIndex]).toBe('Evaporation');
    expect(shuffledChallenge(s)).toEqual(shuffledChallenge(s));
    const tf = buildSortItems(SUBSTANCES, 'Water')[0];
    expect(shuffledChallenge(tf)).toBe(tf);
  });
  it.each([
    [buildSortItems(SUBSTANCES, 'Water').find(c => c.id === 'sort-sand')!, 0, 'chose_dissolves'],
    [buildSortItems(SUBSTANCES, 'Water').find(c => c.id === 'sort-salt')!, 1, 'chose_does_not_dissolve'],
    [PARTICLE, 0, 'chose_disappeared'], [PARTICLE, 2, 'chose_sank'], [PARTICLE, 3, 'other_choice'],
    [buildClassifyItems(SUBSTANCES, 'Water').find(c => c.id === 'classify-sand')!, 0, 'called_solution'],
    [buildClassifyItems(SUBSTANCES, 'Water').find(c => c.id === 'classify-salt')!, 2, 'called_layers'],
    [SEPARATE, 0, 'filter_for_dissolved'], [SEPARATE, 2, 'other_method'],
    [{ ...SEPARATE, correctOptionIndex: 0 }, 1, 'evaporate_for_undissolved'],
  ] as const)('%#: the miss a wrong choice names', (ch, i, miss) => {
    expect(dissolvingMiss(ch, i)).toBe(miss);
  });
  it('model beakers never share a word with a lesson substance, and a mode with no free model offers none', () => {
    const classify = buildClassifyItems(SUBSTANCES, 'Water')[0];
    const models = modelsFor(classify, LAB)!;
    expect(models.map(m => m.look)).toEqual(['dissolves', 'sinks', 'layers']);
    expect(models.find(m => m.look === 'layers')!.name).toBe('Liquid wax'); // "Lamp oil" shares "oil" with Cooking Oil
    expect(modelsLeak(models, LAB)).toBe(false);
    const crowded = { solvent: SOLVENT, substances: [...SUBSTANCES, sub('wax', 'Liquid Wax', 'immiscible_liquid')] };
    expect(modelsFor(classify, crowded)).toBeNull();
    expect(modelsFor(PARTICLE, LAB)).toBeNull();
  });
  it('drop_far_choice greys the choice sharing fewest words with the key, while two untried wrong ones remain', () => {
    expect(farChoice(PARTICLE, NO_LEVERS)).toBe(2);
    expect(farChoice(PARTICLE, { ...NO_LEVERS, picked: [0, 3] })).toBeNull();
    expect(farChoice(buildSortItems(SUBSTANCES, 'Water')[0], NO_LEVERS)).toBeNull();
  });
});

it.each(MODES)('%s: a spoken-or-tapped question whose key stays out of the scene and off the screen', mode => {
  const h = mount(mode, CHALLENGES[mode]);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  const ch = CHALLENGES[mode][0];
  expect(h.state().task!.task).toContain(ch.instruction);
  expect(demand(h).response).toBe('speech');
  const ws = h.state().task!.workspace!;
  expect(mixingAndDissolvingBoss.assignment(ch)).toMatchObject({ response: 'speech', acceptsGesture: true });
  expect(ws.expectedAnswer).toMatch(new RegExp(`^"${ch.options[ch.correctOptionIndex].replace(/[.']/g, '.')}" \\(also accept "the `));
  expect(String(demand(h).choices)).toBe(ch.options.map((o, i) => `${i + 1}) ${o}`).join('  '));
  // Nothing on screen or in the scene names the rule or what a substance did.
  h.press('Add Table Salt'); h.press('Add Sand'); h.settle();
  expect(String(demand(h).beaker)).toBe('In the beaker so far: Table Salt 5 g, Sand 5 g.');
  expect(JSON.stringify(demand(h))).not.toMatch(/correct|answer is/i);
  expect(text(h)).not.toMatch(/Does not dissolve|What is dissolving|spread out among/);
  if (mode === 'separate') expect(text(h)).not.toContain('Separation Tools');
  expect(text(h)).not.toMatch(/Next Challenge|Finish/);
  answer(h, ch.options[ch.correctOptionIndex]);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it('a wrong tap commits its miss and closes the choices; Try again clears it; spoken credit completes; submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const items = [buildClassifyItems(SUBSTANCES, 'Water').find(c => c.id === 'classify-sand')!, buildClassifyItems(SUBSTANCES, 'Water').find(c => c.id === 'classify-salt')!];
  const h = mount('classify', items);
  answer(h, 'A solution');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'called_solution' });
  expect(demand(h)).toMatchObject({ learnerWork: 'Chose "A solution"' });
  expect(text(h)).toContain('Not quite.');
  expect(h.view.container.querySelector('button[aria-label="A suspension"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  expect(text(h)).not.toContain('Not quite.');
  answer(h, 'A suspension');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.task).toContain('Add the table salt to the water');
  h.say('a solution'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , , work] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'called_solution'], [true, null], [true, null]]);
  h.close();
});

it('model_beakers draws tagged models not in the lesson; a repeat pull changes nothing; the next attempt records it', () => {
  const sand = buildSortItems(SUBSTANCES, 'Water').find(c => c.id === 'sort-sand')!;
  const h = mount('dissolve', [sand]);
  expect(levers(h)).toEqual([['model_beakers', false]]);
  answer(h, 'Dissolves');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'chose_dissolves' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'chose_dissolves')).toBe('model_beakers');
  expect(h.dispatch('pull_lever', { lever: 'model_beakers' }).status).toBe('committed');
  const panel = h.view.container.querySelector('[data-lever="model-beakers"]')!;
  expect(panel.textContent).toMatch(/Drink powder.*Pebbles.*Liquid wax/);
  expect(panel.textContent).not.toMatch(/Sand|Salt|Oil/);
  expect(String(demand(h).onScreen)).toMatch(/model beakers of things not in this lesson/);
  // Its only lever is on screen: the tutor is offered no second pull.
  expect(h.state().affordances.some(a => (a.action as { operation?: string }).operation === 'pull_lever')).toBe(false);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, "Doesn't dissolve");
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['model_beakers'] });
  h.close();
});

it('particle_view opens the learner\'s own beaker view, refused while empty; drop_far_choice greys a wrong choice', () => {
  const h = mount('dissolve', [PARTICLE]);
  // Empty beaker: no particle lever yet.
  expect(levers(h).map(([id]) => id)).toEqual(['drop_far_choice']);
  h.press('Add Table Salt'); h.settle();
  expect(levers(h).map(([id]) => id)).toEqual(['particle_view', 'drop_far_choice']);
  expect(h.dispatch('pull_lever', { lever: 'particle_view' }).status).toBe('committed');
  expect(text(h)).toContain('Particle View');
  const view = Array.from(h.view.container.querySelectorAll('p')).find(p => /Blue circles/.test(p.textContent ?? ''))!;
  expect(view.textContent).not.toMatch(/spread|dissolv/i);
  expect(h.dispatch('pull_lever', { lever: 'drop_far_choice' }).status).toBe('committed');
  expect(h.view.container.querySelector('button[aria-label="They sank to the bottom"]')!.getAttribute('data-dropped')).toBe('true');
  expect(String(demand(h).onScreen)).toMatch(/Choice 3, "They sank to the bottom", is greyed out and is not the answer/);
  answer(h, 'They spread out among the water particles');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['particle_view', 'drop_far_choice'] });
  h.close();
});

it('method_cards shows what each method on the choices catches, none marked', () => {
  const h = mount('separate', [SEPARATE]);
  expect(levers(h).map(([id]) => id)).toEqual(['method_cards', 'drop_far_choice']);
  expect(h.dispatch('pull_lever', { lever: 'method_cards' }).status).toBe('committed');
  const cards = h.view.container.querySelector('[data-lever="method-cards"]')!;
  expect(cards.textContent).toMatch(/Filtration:.*Evaporation:.*Magnet:.*Decanting:/);
  expect(cards.textContent).not.toMatch(/salt/i);
  h.close();
});

it('every saved payload challenge names a miss for each wrong choice, and the journey answers are its key and a wrong choice', () => {
  for (const mode of MODES) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { data } = require(`../../../components/live-activity/runtime/testing/w1-payloads/mixing-and-dissolving.${mode}.json`);
    for (const ch of data.challenges as DissolvingChallenge[]) {
      ch.options.forEach((_, i) => expect(!!dissolvingMiss(ch, i), `${mode} ${ch.id} ${i}`).toBe(i !== ch.correctOptionIndex));
      const a = dissolvingHarnessAnswers(ch);
      expect(a.correct).toBe(ch.options[ch.correctOptionIndex]);
      expect(a.plainWrong).not.toBe(a.correct);
    }
  }
});
