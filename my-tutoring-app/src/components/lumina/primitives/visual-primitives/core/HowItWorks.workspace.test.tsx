// @vitest-environment jsdom
/**
 * how-it-works on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * The learner reads the steps first (the scene says so and is not ready); then code-built questions keyed by the steps'
 * order. A step's name (identify, predict) is said aloud or tapped: the key is published only as the spoken
 * expectedAnswer. An order or a purpose is tapped and checked by code. A wrong answer names its miss, and every miss an
 * item can show has a lever.
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
import type { HowItWorksData } from './HowItWorks';
import {
  askOf, blankTitle, buildHowItems, cardText, choiceText, clueOf, HOW_MISSES, HOW_MODES, howCorrect, howHarnessAnswers, howItems,
  howMiss, isChoice, keyStep, processSteps, seededRng, titleWords, validHowItem, workspaceAssignment,
  type HowItem, type HowMode, type HowTier, type ProcessStep,
} from './howItWorksWorkspace';
import {
  crossedOut, EASIER_ITEM_LEVER, FEWER_CARDS_LEVER, howLevers, LAST_STEP_LEVER, leverFacts, leverLeaks, lastStepLine,
  possibleMisses, SHOW_STEP_LEVER, SHOW_WHY_LEVER, showStepLine, simplerItem, STEP_NUMBERS_LEVER, TWO_CHOICES_LEVER, whyLine,
} from './howItWorksLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const STEPS: HowItWorksData['steps'] = [
  { stepNumber: 1, title: 'Pushing the Pedals', description: 'Your legs press down on the foot rests, which act as levers around an axle. This starts the turning motion.', imagePrompt: 'a foot on a pedal', purpose: 'It starts the turning motion that the rest of the bicycle passes along.' },
  { stepNumber: 2, title: 'Turning the Chainrings', description: 'The crank arms spin the big toothed wheel at the front. Its teeth grab the links of the chain.', imagePrompt: 'a front gear', purpose: 'It hands the motion from your legs to the metal loop of links.' },
  { stepNumber: 3, title: 'Pulling the Chain', description: 'The metal loop travels around and drags its links toward the back. It carries the force to the rear.', imagePrompt: 'a chain', purpose: 'It carries the force from the front gear back to the rear wheel.' },
  { stepNumber: 4, title: 'Spinning the Cog', description: 'The small toothed wheel at the back turns faster than the feet do. It is fixed to the back hub.', imagePrompt: 'a rear gear', purpose: 'It makes the back wheel turn quickly enough to move the bike forward.' },
  { stepNumber: 5, title: 'Rolling the Tire', description: 'The rubber grips the road and pushes backward on the ground. The ground pushes the bike forward.', imagePrompt: 'a tyre on a road', purpose: 'It changes the spinning of the wheel into the bike moving along the road.' },
];
const BASE = { title: 'How a Bicycle Works', subtitle: '', overview: 'Pedals to pavement.', steps: STEPS, summary: { text: 'x', keyTakeaway: 'y' } };
const steps = processSteps(BASE);

// Hand-built items over the five steps: identify with the step list (guided), an order of four cards and an identify
// with no list (sequence), what comes after the first two steps and why the chainrings matter (predict).
const BY_MODE: Record<HowMode, HowItem[]> = {
  guided: [
    { id: 'identify-1', mode: 'guided', kind: 'identify', target: 2, options: [3, 2, 1, 0], strip: true },
    { id: 'identify-2', mode: 'guided', kind: 'identify', target: 0, options: [0, 3, 4], strip: true },
  ],
  sequence: [
    { id: 'sequence-1', mode: 'sequence', kind: 'sequence', cards: [1, 2, 3, 4], bank: [3, 1, 4, 2], asClues: false },
    { id: 'identify-2', mode: 'sequence', kind: 'identify', target: 3, options: [3, 4, 0, 1], strip: false },
  ],
  predict: [
    { id: 'predict-1', mode: 'predict', kind: 'predict', shown: 2, options: [3, 2, 4] },
    { id: 'explain-2', mode: 'predict', kind: 'explain', target: 1, options: [1, 4, 2] },
  ],
};

const data = (mode: HowMode, items = BY_MODE[mode]): HowItWorksData => ({ ...BASE, modes: [mode], items });
const mount = (mode: HowMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'how-it-works', evalMode: mode, instanceId: 'how-it-works', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const start = (h: WorkspaceHarness) => { h.press('Start the questions'); h.settle(); };
const tap = (h: WorkspaceHarness, item: HowItem, ...choices: number[]) => {
  for (const c of choices) h.press(item.kind === 'sequence' ? cardText(steps, item, c) : choiceText(steps, item, c));
  h.press(/Check Answer/); h.settle();
};
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(HOW_MODES)('%s opens on the reading, then binds each question with its key out of the scene and off the screen', mode => {
  const h = mount(mode);
  expect(getComponentById('how-it-works')!.evalModes!.map(m => m.evalMode)).toEqual(HOW_MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(demand(h).phase).toBe('reading');
  expect(String(demand(h).step3)).toMatch(/Pulling the Chain/);
  expect(text(h)).toMatch(/Your legs press down/);
  start(h);
  const item = BY_MODE[mode][0];
  expect(demand(h).phase).toBe('question');
  expect(demand(h).step1).toBeUndefined();
  expect(h.state().task!.task).toBe(workspaceAssignment(steps, item, false).task);
  expect(text(h)).not.toMatch(/Your legs press down|Next Question|See Results/);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(JSON.stringify(demand(h))).not.toMatch(/credited|\bcorrect\b/i);
  if (item.kind === 'identify' || item.kind === 'predict') {
    expect(demand(h).response).toBe('speech');
    expect(h.state().task!.workspace!.expectedAnswer).toContain(`"${steps[keyStep(item)].title}"`);
    expect(String(demand(h).question)).not.toContain(steps[keyStep(item)].title);
  } else {
    expect(demand(h).response).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  }
  h.close();
});

it('guided: the clue blanks its own step name; a neighbour is named; two_choices crosses out; spoken credit; submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('guided');
  start(h);
  const [first] = BY_MODE.guided;
  expect(clueOf(steps, 2, false)).not.toMatch(/chain/i);
  expect(text(h)).toContain(clueOf(steps, 2, false));
  // The step list is on screen in order (guided), so no step_numbers lever.
  expect(h.view.container.querySelector('[data-step-strip]')).not.toBeNull();
  expect(levers(h)).toEqual([[TWO_CHOICES_LEVER, 'help', false], [EASIER_ITEM_LEVER, 'simplify', false]]);
  tap(h, first, 1);
  expect(last(h)).toMatchObject({ correct: false, miss: 'neighbour_step' });
  expect(demand(h).learnerWork).toBe('Chose "Turning the Chainrings"');
  expect(h.view.container.querySelector('button[aria-label="Pulling the Chain"]')!.hasAttribute('disabled')).toBe(true);
  expect(nextLever(h.state().task!.workspace!.levers!, 'neighbour_step')).toBe(TWO_CHOICES_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: TWO_CHOICES_LEVER });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/2 choices are crossed out/);
  expect(String(demand(h).choices)).toMatch(/Turning the Chainrings \(crossed out\)/);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).learnerWork).toBe('Nothing chosen yet');
  // Crossed-out choices stay closed on Try again; the key and the far step remain.
  expect(h.view.container.querySelector('button[aria-label="Turning the Chainrings"]')!.hasAttribute('disabled')).toBe(true);
  tap(h, first, 2);
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [TWO_CHOICES_LEVER] });
  expect(text(h)).toMatch(/That describes step 3, "Pulling the Chain"/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('identify-2');
  h.say('pushing the pedals'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'how-it-works', identifyAccuracy: 100 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'neighbour_step'], [true, null], [true, null]]);
  h.close();
});

it('sequence: a swapped pair is named; show_why writes what each step makes possible; fewer_cards opens three cards; identify gets step numbers', () => {
  const h = mount('sequence');
  start(h);
  const [order, ident] = BY_MODE.sequence;
  expect(String(demand(h).cards)).toMatch(/mixed up, not in order/);
  expect(levers(h)).toEqual([[SHOW_WHY_LEVER, 'help', false], [FEWER_CARDS_LEVER, 'simplify', false]]);
  tap(h, order, 2, 1, 3, 4);
  expect(last(h)).toMatchObject({ correct: false, miss: 'adjacent_swap' });
  expect(text(h)).toMatch(/That order is not right yet/);
  expect(h.dispatch('pull_lever', { lever: SHOW_WHY_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="show-why"]').length).toBe(4);
  expect(String(demand(h).why1)).toContain(whyLine(steps, 3));
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).learnerWork).toBe('No card placed yet');
  const fewer = h.dispatch('pull_lever', { lever: FEWER_CARDS_LEVER });
  expect(fewer.state.task).toMatchObject({ itemId: 'sequence-1~simpler' });
  expect(h.view.container.querySelector('[data-practice="easier"]')!.textContent).toMatch(/Put these 3 steps in order/);
  const practice = simplerItem(steps, order, false)!;
  tap(h, practice, 1, 2, 3);
  expect(last(h)).toMatchObject({ itemId: 'sequence-1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'sequence-1' });
  tap(h, order, 1, 2, 3, 4);
  expect(last(h)).toMatchObject({ itemId: 'sequence-1', correct: true });
  h.dispatch('advance'); h.confirmVisible();
  // No step list on screen in sequence mode: step_numbers is the help.
  expect(h.view.container.querySelector('[data-step-strip]')).toBeNull();
  expect(levers(h).map(([id]) => id)).toEqual([STEP_NUMBERS_LEVER, TWO_CHOICES_LEVER, EASIER_ITEM_LEVER]);
  tap(h, ident, 0);
  expect(last(h)!.miss).toBe('far_step');
  expect(h.dispatch('pull_lever', { lever: STEP_NUMBERS_LEVER }).status).toBe('committed');
  expect(text(h)).toMatch(/Step 4/);
  h.close();
});

it('predict: a later step is skipped_ahead; last_step shows the shown step with the next name blanked; explain: show_step and the easier item', () => {
  const h = mount('predict');
  start(h);
  const [next, why] = BY_MODE.predict;
  expect(String(demand(h).shown)).toMatch(/Steps 1 to 2 are on screen in order: 1\) Pushing the Pedals {2}2\) Turning the Chainrings\. The later steps are hidden\./);
  tap(h, next, 3);
  expect(last(h)).toMatchObject({ correct: false, miss: 'skipped_ahead' });
  expect(levers(h).map(([id]) => id)).toEqual([LAST_STEP_LEVER, TWO_CHOICES_LEVER, EASIER_ITEM_LEVER]);
  expect(h.dispatch('pull_lever', { lever: LAST_STEP_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="last-step"]')!.textContent).toContain(lastStepLine(steps, next as never));
  expect(lastStepLine(steps, next as never)).not.toMatch(/chain\b/i);
  h.dispatch('retry'); h.confirmVisible();
  tap(h, next, 2);
  expect(last(h)).toMatchObject({ correct: true, levers: [LAST_STEP_LEVER] });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('explain-2');
  expect(levers(h).map(([id]) => id)).toEqual([SHOW_STEP_LEVER, TWO_CHOICES_LEVER, EASIER_ITEM_LEVER]);
  tap(h, why, 2);
  expect(last(h)).toMatchObject({ correct: false, miss: 'neighbour_step' });
  expect(h.dispatch('pull_lever', { lever: SHOW_STEP_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="show-step"]')!.textContent).toContain(showStepLine(steps, why as never));
  const easier = h.dispatch('pull_lever', { lever: EASIER_ITEM_LEVER });
  expect(easier.state.task).toMatchObject({ itemId: 'explain-2~simpler' });
  const practice = simplerItem(steps, why, false)!;
  expect(isChoice(practice) && practice.options.length).toBe(2);
  tap(h, practice, keyStep(practice as never));
  expect(last(h)).toMatchObject({ itemId: 'explain-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'explain-2' });
  tap(h, why, 1);
  expect(last(h)).toMatchObject({ itemId: 'explain-2', correct: true });
  h.close();
});

describe('the pure rules', () => {
  const TIERS: HowTier[] = ['easy', 'medium', 'hard'];
  const four = processSteps({ steps: STEPS.slice(0, 4) });
  const six = processSteps({ steps: [...STEPS, { stepNumber: 6, title: 'Stopping with Brakes', description: 'Rubber pads squeeze the wheel rim until it slows. The bike comes to rest.', imagePrompt: '', purpose: 'It lets the rider end the ride safely at the right spot.' }] });
  const pics = processSteps({ preReader: { question: 'Put the tow truck steps in order.', steps: [
    { id: 'p0', emoji: '🚗', label: 'Car stops', spoken: 'The car stops on the road.' },
    { id: 'p1', emoji: '⛓️', label: 'Hook the car', spoken: 'The truck hooks the car.' },
    { id: 'p2', emoji: '🚚', label: 'Tow away', spoken: 'The truck pulls the car away.' },
  ] } });
  const all = () => [four, steps, six].flatMap(s => TIERS.flatMap(tier => HOW_MODES.map(mode => ({ s, tier, mode, pictures: false,
    items: buildHowItems({ steps: s, modes: [mode], tier, pictures: false, rng: seededRng(`${mode}${tier}${s.length}`) }) }))))
    .concat(HOW_MODES.map(mode => ({ s: pics, tier: 'medium' as HowTier, mode, pictures: true,
      items: buildHowItems({ steps: pics, modes: [mode], tier: 'medium', pictures: true, rng: seededRng(mode) }) })));

  it('every mode builds valid, keyed items at every tier, for readers and pre-readers', () => {
    for (const { s, tier, mode, items } of all()) {
      expect(items.length, `${mode} ${tier} ${s.length}`).toBeGreaterThan(0);
      for (const i of items) {
        expect(validHowItem(i, s), `${mode} ${tier} ${i.id}`).toBe(true);
        expect(i.mode).toBe(mode);
        const a = howHarnessAnswers(i);
        expect(howCorrect(i, a.correct)).toBe(true);
        expect(howCorrect(i, a.plainWrong)).toBe(false);
        expect(HOW_MISSES[mode]).toContain(howMiss(i, a.plainWrong));
        // The tray never shows the order, or the order backwards.
        if (i.kind === 'sequence' && i.cards.length > 2) {
          expect(i.bank).not.toEqual(i.cards);
          expect(i.bank).not.toEqual([...i.cards].reverse());
        }
      }
      if (mode === 'guided') expect(items.every(i => i.kind === 'identify' && i.strip)).toBe(true);
      if (mode === 'sequence') expect(items[0].kind).toBe('sequence');
    }
  });

  it('the tiers are structural', () => {
    const seqSize = (tier: HowTier) => (buildHowItems({ steps: six, modes: ['sequence'], tier, pictures: false, rng: seededRng(tier) })[0] as Extract<HowItem, { kind: 'sequence' }>);
    expect(seqSize('easy').cards.length).toBe(3);
    expect(seqSize('medium').cards.length).toBe(4);
    expect(seqSize('hard')).toMatchObject({ cards: [0, 1, 2, 3, 4, 5], asClues: true });
    for (const { s, tier, items } of all().filter(x => !x.pictures)) {
      for (const i of items) {
        if (i.kind === 'predict' && tier === 'hard') expect([...i.options].sort()).toEqual([i.shown, i.shown + 1, i.shown + 2]);
        if (i.kind === 'identify' && tier === 'easy') expect(i.options.filter(o => Math.abs(o - i.target) === 1).length).toBeLessThanOrEqual(i.options.length - 2);
        if (i.kind === 'identify' && tier === 'hard') for (const nb of [i.target - 1, i.target + 1]) if (nb >= 0 && nb < s.length && i.options.length >= 4) expect(i.options).toContain(nb);
      }
    }
  });

  it('every miss an item can show is in its mode list and answered by a lever on that item', () => {
    const entry = getComponentById('how-it-works')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of HOW_MODES) expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...HOW_MISSES[mode]].sort());
    for (const { s, mode, items, pictures } of all()) for (const i of items) {
      const ls = howLevers(s, i, [], pictures);
      for (const m of possibleMisses(i)) {
        expect(HOW_MISSES[mode]).toContain(m);
        expect(nextLever(ls, m), `${i.id} ${m}`).toBeTruthy();
        if (ls.some(l => l.kind === 'help')) expect(ls.find(l => l.id === nextLever(ls, m))!.kind, `${i.id} ${m}`).toBe('help');
      }
    }
  });

  it('no clue, card, lever line or ask names the item\'s key', () => {
    for (const { s, items, pictures } of all()) for (const i of items) {
      const pulled = howLevers(s, i, [], pictures).filter(l => l.kind === 'help').map(l => l.id);
      for (const line of Object.values(leverFacts(s, i, pulled))) expect(leverLeaks(s, i, line), `${i.id}: ${line}`).toBe(false);
      if (i.kind === 'predict') expect(leverLeaks(s, i, lastStepLine(s, i))).toBe(false);
      if (!pictures && i.kind === 'identify') {
        const clue = clueOf(s, i.target, false).toLowerCase();
        for (const w of titleWords(s[i.target].title)) expect(clue, i.id).not.toContain(w);
      }
      if (isChoice(i) && i.kind !== 'explain') expect(askOf(s, i, pictures)).not.toContain(s[keyStep(i)].title);
      if (isChoice(i)) expect(crossedOut(i)).not.toContain(keyStep(i));
      if (isChoice(i) && crossedOut(i).length) expect(i.options.length - crossedOut(i).length).toBe(2);
    }
    expect(blankTitle('Your legs push down on the pedals.', 'Pushing the Pedals')).toBe('Your legs ___ down on the ___.');
  });

  it('the easier item stays in its kind, never has the item\'s key, and never shrinks twice', () => {
    for (const { s, items, pictures } of all()) for (const i of items) {
      const e = simplerItem(s, i, pictures);
      if (!e) continue;
      expect(e.kind).toBe(i.kind);
      expect(e.id).toBe(`${i.id}~simpler`);
      expect(simplerItem(s, e, pictures)).toBeNull();
      expect(howLevers(s, e, [], pictures)).toEqual([]);
      expect(validHowItem({ ...e, id: 'x' }, s)).toBe(true);
      if (isChoice(e) && isChoice(i)) { expect(keyStep(e)).not.toBe(keyStep(i)); expect(e.options).not.toContain(keyStep(i)); }
      if (e.kind === 'sequence' && i.kind === 'sequence') expect(e.cards.length).toBeLessThan(i.cards.length);
    }
  });

  it('a legacy lesson (model-written questions) still builds code items in its kinds; stored items are kept', () => {
    const legacy = { ...BASE, challenges: [{ type: 'sequence' }, { type: 'explain' }] };
    const items = howItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['sequence', 'predict']));
    expect(howItems(legacy)).toEqual(items);
    expect(howItems(data('guided'))).toEqual(BY_MODE.guided);
    const outOfRange = { ...BY_MODE.guided[0], target: 9 } as HowItem;
    expect(howItems({ ...BASE, items: [outOfRange] })).not.toEqual([outOfRange]);
    // No mode pinned: one of each kind for readers, the picture order for a pre-reader.
    expect(howItems(BASE).map(i => i.kind)).toEqual(['identify', 'sequence', 'predict', 'explain']);
    expect(howItems({ preReader: { question: 'q', steps: [{ emoji: '🚗', label: 'a', spoken: 'a.' }, { emoji: '⛓️', label: 'b', spoken: 'b.' }, { emoji: '🚚', label: 'c', spoken: 'c.' }] } })
      .map(i => i.kind)).toEqual(['sequence']);
    const spoken = workspaceAssignment(steps, BY_MODE.predict[0], false);
    expect(spoken).toMatchObject({ response: 'speech', acceptsGesture: true });
    expect(spoken.misses!.map(m => m.id)).toEqual(['skipped_ahead']);
    expect(spoken.expectedAnswer).toMatch(/"Pulling the Chain".*"Spinning the Cog", "Rolling the Tire" are wrong/);
  });
});
