// @vitest-environment jsdom
/**
 * reaction-lab on its boss (a SAY_OR_SHOW card on the spoken preset) and its lever set, mounted the way a lesson mounts it.
 * A predict challenge is asked beside the unmixed substances; any other challenge waits for Mix Substances! (no
 * response yet). One tapped choice and Check Answer commits a checked gesture with its named miss, or a spoken answer is
 * judged; Try again clears the choice; the runtime owns progression; the key is published only as the spoken
 * key (`reactionKey`). Levers change the screen in the same commit and never draw the answer.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ReactionChallenge } from './ReactionLab';
import { itemChoices, keyValue, reactionHarnessAnswers, reactionItems, reactionMiss } from './reactionLabWorkspace';
import { legendLeak } from './reactionLabLevers';
import { reactionLabBoss } from './reactionLab.boss';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const mc = (id: string, type: ReactionChallenge['type'], instruction: string, options: string[], key: number): ReactionChallenge =>
  ({ id, type, instruction, options: options.map((text, i) => ({ id: 'ABCD'[i], text })), correctOptionId: 'ABCD'[key],
    targetAnswer: options[key], hint: 'Look again.', narration: 'You got it!' });
const PREDICT = mc('p1', 'predict', 'What will happen when we pour the vinegar onto the baking soda?',
  ['Bubbles will form and it will fizz', 'The liquid will turn purple', 'Nothing at all will happen', 'It will turn into rock'], 0);
const OBSERVE = mc('o1', 'observe', 'What did you see right after mixing?',
  ['The powder stayed dry', 'Bubbles formed and it fizzed', 'Nothing happened at all', 'It glowed in the dark'], 1);
const CLASSIFY: ReactionChallenge = { id: 'c1', type: 'classify', instruction: 'Is this a chemical or a physical change?',
  targetAnswer: 'chemical', hint: 'Was something new made?', narration: 'Yes, a new gas formed.' };
const EXPLAIN = mc('e1', 'explain', 'Why did bubbles appear?',
  ['The water dissolved the powder', 'The particles rearranged into a new gas', 'The vinegar melted the powder', 'Air got trapped in the cup'], 1);
const CONSERVE: ReactionChallenge = { id: 'k1', type: 'conservation', instruction: 'The atoms at the start equal the atoms at the end.',
  targetAnswer: 'true', isTrueFalse: true, correctBoolean: true, hint: 'Atoms rearrange.', narration: 'Atoms are never lost.' };
const BALANCE = mc('b1', 'balance', 'Which equation is balanced?', ['H₂ + O₂ → H₂O', '2H₂ + O₂ → 2H₂O', '2H₂ + 2O₂ → 2H₂O'], 1);

const lab = (challenges: ReactionChallenge[], extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: 'Fizzy Volcano', description: 'Mix and watch.', gradeBand: '3-5',
  experiment: { name: 'Baking soda and vinegar', category: 'acid_base', safetyLevel: 'safe', realWorldConnection: 'Cakes rise.' },
  substances: [{ id: 's1', name: 'baking soda', formula: 'NaHCO3', state: 'solid', color: 'white', safetyInfo: 'Do not taste.', amount: '2 spoons' },
    { id: 's2', name: 'vinegar', formula: 'CH3COOH', state: 'liquid', color: 'clear', safetyInfo: 'Avoid eyes.', amount: '100 mL' }],
  reaction: { type: 'chemical', signs: ['fizzing', 'gas_produced'], isReversible: false, equation: 'NaHCO3 + CH3COOH → NaCH3COO + H2O + CO2',
    energyChange: 'endothermic', particleDescription: 'The particles rearranged into a new gas called carbon dioxide.' },
  animation: { realView: { duration: 3, effects: ['bubbles', 'foam'], temperatureChange: -2 },
    particleView: { reactantMolecules: ['NaHCO3', 'CH3COOH'], productMolecules: ['NaCH3COO', 'H2O', 'CO2'], bondBreaking: true, bondForming: true } },
  challenges,
  notebook: { predictPrompt: 'What will happen?', observePrompts: ['What did you see?'], explainPrompt: 'Why?' },
  showOptions: { showParticleView: true, showEquation: true, showConservationCounter: true },
  ...extra,
});

const mount = (mode: string, challenges: ReactionChallenge[], extra: Record<string, unknown> = {}) => {
  const h = mountWorkspace({ primitiveId: 'reaction-lab', evalMode: mode, instanceId: 'reaction', data: lab(challenges, extra) });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press('Check Answer'); h.settle(); };
const mix = (h: WorkspaceHarness) => { h.press('Mix Substances!'); h.settle(100); };
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each([
  ['predict', PREDICT, 'Bubbles will form and it will fizz'],
  ['observe', OBSERVE, 'Bubbles formed and it fizzed'],
  ['explain', EXPLAIN, 'The particles rearranged into a new gas'],
] as const)('%s: a spoken-or-tapped challenge whose key stays out of the scene', (mode, challenge, key) => {
  const h = mount(mode, [challenge]);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  if (mode !== 'predict') {
    // Nothing is asked until the reaction has run.
    expect(demand(h).presentation).toBe('not ready');
    expect(text(h)).not.toContain(challenge.instruction);
    mix(h);
  }
  expect(demand(h).presentation).toBe('ready');
  expect(text(h)).toContain(challenge.instruction);
  expect(demand(h).response).toBe('speech');
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(new RegExp(`^"${key}" \\(also accept "choice [A-D]", "the `));
  expect(reactionLabBoss.assignment(reactionItems([challenge])[0])).toMatchObject({ response: 'speech', acceptsGesture: true });
  expect(String(demand(h).choices)).toContain(key);
  expect(JSON.stringify(demand(h))).not.toMatch(/correct|answer is|right choice/i);
  // No Next, no notebook, no hint on the workspace path; the reaction is not drawn before a prediction.
  expect(text(h)).not.toMatch(/Next Challenge|Observation Notebook|Submit Prediction|Done Observing/);
  if (mode === 'predict') expect(text(h)).not.toMatch(/Real View|Mix Substances!/);
  answer(h, key);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  // The last item: the session completes and shows its result.
  expect(text(h)).toContain('Experiment Complete!');
  h.close();
});

it('the shown order is not the generated order, and the letters follow the screen', () => {
  // Every fixture lists its key first or second; across them the key does not sit in one place.
  const firsts = [PREDICT, OBSERVE, EXPLAIN, BALANCE].map(c => itemChoices(c).findIndex(x => x.value === keyValue(c)));
  expect(new Set(firsts).size).toBeGreaterThan(1);
  for (const c of [PREDICT, OBSERVE, EXPLAIN]) expect(itemChoices(c).map(x => x.letter)).toEqual(['A', 'B', 'C', 'D']);
  // Stable across renders.
  expect(itemChoices(PREDICT)).toEqual(itemChoices(PREDICT));
});

it('a wrong tap commits its miss and closes the choices; Try again clears it; the session submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('observe', [OBSERVE, CLASSIFY]);
  mix(h);
  answer(h, 'Nothing happened at all');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'no_change' });
  expect(demand(h)).toMatchObject({ learnerWork: 'Chose "Nothing happened at all"' });
  // No right answer, narration or hint is shown, and nothing more can be tapped until Try again.
  expect(text(h)).not.toMatch(/You got it!|Look again\./);
  expect(h.view.container.querySelector('button[aria-label="Bubbles formed and it fizzed"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet', presentation: 'ready' });
  answer(h, 'Bubbles formed and it fizzed');
  h.dispatch('advance'); h.confirmVisible();
  // The classify challenge: said aloud this time, credited by the observer. The reaction is still shown.
  expect(h.state().task!.task).toMatch(/^Is this a chemical or a physical change\? \(Chemical Change or Physical Change\)/);
  // A menu key: the ask says both words, and the judge reads the menu.
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^"chemical" .*chooses one word from "chemical", "physical"/);
  expect(demand(h).presentation).toBe('ready');
  h.say('chemical'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , , work] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'no_change'], [true, null], [true, null]]);
  h.close();
});

it('the miss names the pattern on screen, per answer form', () => {
  const [p, o, c, e, k, b] = reactionItems([PREDICT, OBSERVE, CLASSIFY, EXPLAIN, CONSERVE, BALANCE]);
  expect(p.id).toBe('p1'); // predict first
  expect(reactionMiss(p, 'C')).toBe('no_change');
  expect(reactionMiss(p, 'B')).toBe('other_choice');
  expect(reactionMiss(o, 'C')).toBe('no_change');
  expect(reactionMiss(c, 'physical')).toBe('chemical_physical_swap');
  expect(reactionMiss(e, 'A')).toBe('other_choice');
  expect(reactionMiss(k, 'false')).toBe('true_false_flipped');
  expect(reactionMiss(b, 'A')).toBe('unbalanced_equation');
  for (const item of [p, o, c, e, k, b]) expect(reactionMiss(item, keyValue(item.challenge))).toBeUndefined();
});

it('predict: the equation bar and the reaction are hidden; signs_legend draws every sign unmarked; drop_far_choice greys one', () => {
  const h = mount('predict', [PREDICT], { gradeBand: '6-8' });
  // The equation prints the products, the prediction's answer.
  expect(text(h)).not.toContain('CO2');
  expect(demand(h).equation).toBeUndefined();
  expect(levers(h)).toEqual([['signs_legend', false], ['drop_far_choice', false]]);
  answer(h, 'The liquid will turn purple');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'other_choice' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'other_choice')).toBe('signs_legend');
  expect(h.dispatch('pull_lever', { lever: 'signs_legend' }).status).toBe('committed');
  const legend = h.view.container.querySelector('[data-lever="signs-legend"]')!;
  expect(legend.textContent).toMatch(/Fizzing \/ Bubbles.*Color Change.*New Smell/);
  expect(String(demand(h).onScreen)).toMatch(/none is marked/);
  const before = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'signs_legend' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before);
  // Purple is tried; the untried wrong choice sharing the fewest words with the key goes grey.
  expect(h.dispatch('pull_lever', { lever: 'drop_far_choice' }).status).toBe('committed');
  const dropped = h.view.container.querySelector('button[data-dropped="true"]')!;
  expect(dropped.getAttribute('aria-label')).not.toBe('Bubbles will form and it will fizz');
  expect(String(demand(h).onScreen)).toMatch(/is greyed out and is not the answer/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'Bubbles will form and it will fizz');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['signs_legend', 'drop_far_choice'] });
  h.close();
});

it('explain: the particle view opens with no caption; replay plays the reaction; the counter and a balance key stay hidden', () => {
  const h = mount('explain', [EXPLAIN, BALANCE, CONSERVE], { gradeBand: '6-8' });
  mix(h);
  // The conservation counter prints "=", the answer to a conservation statement.
  expect(text(h)).not.toMatch(/Conservation of Mass/);
  // While the first run plays there is nothing to replay.
  expect(levers(h).map(([id]) => id)).toEqual(['particle_view', 'drop_far_choice']);
  h.settle(4000);
  expect(levers(h).map(([id]) => id)).toEqual(['replay_reaction', 'particle_view', 'drop_far_choice']);
  answer(h, 'The water dissolved the powder');
  expect(h.dispatch('pull_lever', { lever: 'particle_view' }).status).toBe('committed');
  const view = h.view.container.querySelector('[data-lever="particle-view"]')!;
  expect(view.textContent).toContain('CO2');
  expect(view.textContent).not.toContain('rearranged into a new gas');
  expect(h.dispatch('pull_lever', { lever: 'replay_reaction' }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/playing again/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'The particles rearranged into a new gas');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['particle_view', 'replay_reaction'] });
  h.dispatch('advance'); h.confirmVisible(); h.settle();
  // A balance challenge: the equation bar would print the balanced equation.
  expect(h.state().task!.task).toMatch(/^Which equation is balanced\?/);
  expect(text(h)).not.toContain('NaHCO3 + CH3COOH');
  answer(h, 'H₂ + O₂ → H₂O');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'unbalanced_equation' });
  h.close();
});

it('signs_legend is withheld where a choice is a sign on the card, or a signs question has one sign choice', () => {
  const [short] = reactionItems([mc('s', 'identify_signs', 'Which sign did you see?', ['Color Change', 'Fizzing / Bubbles', 'New Smell'], 1)]);
  expect(legendLeak(short)).toMatch(/is a sign on the card/);
  const [single] = reactionItems([mc('t', 'identify_signs', 'Which is a sign of a chemical change?', ['Fizzing and bubbling', 'Cutting paper', 'Melting butter'], 0)]);
  expect(legendLeak(single)).toMatch(/single it out/);
  expect(legendLeak(reactionItems([OBSERVE])[0])).toBeNull();
});

it('every saved payload challenge names a miss for each wrong choice, and the journey answers are its key and a wrong choice', () => {
  for (const mode of ['predict', 'observe', 'explain']) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { data } = require(`../../../components/live-activity/runtime/testing/w1-payloads/reaction-lab.${mode}.json`);
    const items = reactionItems(data.challenges, { checkedOnly: true });
    expect(items.length, mode).toBeGreaterThan(0);
    for (const item of items) {
      for (const x of itemChoices(item.challenge)) expect(!!reactionMiss(item, x.value), `${mode} ${item.id} ${x.value}`).toBe(x.value !== keyValue(item.challenge));
      const a = reactionHarnessAnswers(item);
      expect(a.correct).toBe(itemChoices(item.challenge).find(x => x.value === keyValue(item.challenge))!.label);
      expect(a.plainWrong).not.toBe(a.correct);
    }
  }
});
