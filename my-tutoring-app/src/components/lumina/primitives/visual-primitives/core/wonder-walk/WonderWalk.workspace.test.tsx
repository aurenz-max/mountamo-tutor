// @vitest-environment jsdom
/**
 * wonder-walk on the shared teaching workspace (W1, plain shape): what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Each stop is one challenge. A stop whose answer can be said (a picture's name, a letter, a number) is a spoken item
 * that also takes the tap: the tutor gets the key code derived (`wonderWalkSpoken.ts`) and the activity checks a tap.
 * A stop answered on screen (a place, a move, a sort, a track) is a gesture item and its key never reaches the tutor.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../../service/manifest/catalog';
import { wonderWalkBoss } from './wonderWalk.boss';
import { wonderWalkCard } from './wonderWalk.card';
import { stopAsk, stopHarnessTaps } from './wonderWalkWorkspace';
import { respondOf, stopSpokenKey } from './wonderWalkSpoken';
import type { WonderWalkData, WonderWalkStop } from './WonderWalk';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const stop = (n: number, right: [string, string], wrong: Array<[string, string, 'looks_like' | 'goes_with' | 'other']>): WonderWalkStop => ({
  id: `stop-${n}`, challengeType: 'which-one', idea: 'Living things grow.',
  narration: 'A puppy eats and grows into a dog. It is alive!', ask: 'Which one is alive too?',
  why: 'Living things eat and grow.', sceneWords: ['puppy'], sceneEmoji: ['🐶'], sceneImage: null,
  options: [
    ...wrong.map(([word, emoji, trap], k) => ({ id: `s${n}-${'bc'[k]}`, word, emoji, trap })),
    { id: `s${n}-a`, word: right[0], emoji: right[1], trap: null },
  ],
  correctOptionId: `s${n}-a`,
});
const walk = (): WonderWalkData => ({
  title: 'Alive or not?', bigIdea: 'Living things eat, drink and grow.', domain: 'science', gradeBand: 'K', challengeType: 'which-one',
  challenges: [
    stop(1, ['frog', '🐸'], [['rock', '🪨', 'other'], ['car', '🚗', 'looks_like']]),
    stop(2, ['tree', '🌳'], [['sun', '☀️', 'goes_with']]),
  ],
});
const mount = (d: WonderWalkData, evalMode: string = d.challengeType) =>
  mountWorkspace({ primitiveId: 'wonder-walk', evalMode, data: d as unknown as Record<string, unknown>, instanceId: 'wonder-walk-k' });

/** The saved math payloads (real generations). */
const payload = (mode: string): WonderWalkData =>
  JSON.parse(readFileSync(join(process.cwd(), `src/components/lumina/components/live-activity/runtime/testing/w1-payloads/wonder-walk.${mode}.json`), 'utf8')).data;

it('which-one binds as a spoken item that also takes the tap: the scene and its pictures, nothing to read', () => {
  const h = mount(walk());
  expect(getComponentById('wonder-walk')!.evalModes!.map(m => m.evalMode)).toEqual(['which-one', 'how-many', 'more-fewer', 'count-out', 'add-take', 'parts', 'teens', 'sort-count', 'count-on', ...WORDS]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(wonderWalkBoss.assignment(walk().challenges[0]).task);
  // The picture's name is the answer a child can say; the tutor judges it, and a tap is still checked by the activity.
  expect(wonderWalkBoss.assignment(walk().challenges[0])).toMatchObject({ response: 'speech', acceptsGesture: true });
  expect(h.state().task!.workspace!.expectedAnswer).toBe('"frog" (also accept "frogs").');
  const demand = h.state().task!.demand as Record<string, unknown>;
  expect(demand).toMatchObject({ kind: 'which-one', pictures: 'rock, car, frog', narration: walk().challenges[0].narration });
  expect(JSON.stringify(demand)).not.toContain('s1-a');
  expect(JSON.stringify(demand)).not.toContain('trap');
  // One stop on screen; no counter, meter or prompt text the child must read.
  expect(h.view.container.querySelectorAll('[data-pip-object^="option-"]')).toHaveLength(3);
  expect(h.view.container.textContent).not.toMatch(/\d+\s*\/\s*\d+|\d+%|Which one is alive/);
  expect(seam.legacyAI).not.toHaveBeenCalled();
});

it('a wrong tap is a named miss and brings up the why-card; Try again keeps it; the same picture again is a repeat; right completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(walk());
  h.touch('option-s1-c');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'looks_like', response: 'Tapped the car picture' });
  expect(h.view.container.querySelector('[data-pip-object="why"]')!.textContent).toContain('Living things eat and grow.');
  expect((h.state().task!.demand as Record<string, unknown>).whyCard).toBe('Living things eat and grow.');
  // Closed until the observer reopens it.
  h.touch('option-s1-b');
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  h.dispatch('retry'); h.confirmVisible();
  expect(h.view.container.querySelector('[data-pip-object="why"]')).not.toBeNull();
  h.touch('option-s1-c');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'repeated_pick' });
  h.dispatch('retry'); h.confirmVisible();
  h.touch('option-s1-a');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('stop-2');
  expect(h.view.container.querySelector('[data-pip-object="why"]')).toBeNull();
  h.touch('option-s2-b');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'goes_with' });
  h.dispatch('retry'); h.confirmVisible();
  h.touch('option-s2-a');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , metrics] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(metrics).toMatchObject({ type: 'wonder-walk', totalChallenges: 2, correctCount: 2, firstTryCount: 0 });
});

it('the live host (no evaluation provider) submits nothing', () => {
  const h = mount(walk());
  h.touch('option-s1-a');
  h.dispatch('advance'); h.confirmVisible();
  h.touch('option-s2-a');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
});

it('validate rejects a stop whose ask or narration says its answer', () => {
  const d = walk();
  d.challenges[0].ask = 'Which one is the frog?';
  expect(() => wonderWalkBoss.validate(d)).toThrow(/says its answer/);
  const e = walk();
  e.challenges[1].narration = 'Trees grow tall.';
  expect(() => wonderWalkBoss.validate(e)).toThrow(/says its answer/);
});

it('a mount with no tutor renders the shared "needs the tutor" card, never a drill', async () => {
  const { render } = await import('@testing-library/react');
  const { default: WonderWalk } = await import('./WonderWalk');
  const view = render(<WonderWalk data={walk()} />);
  expect(view.container.textContent).toContain('This activity needs the tutor');
  expect(view.container.querySelector('[data-pip-object^="option-"]')).toBeNull();
});

const MATH = ['how-many', 'more-fewer', 'count-out', 'add-take', 'parts', 'teens', 'sort-count', 'count-on'] as const;
const WORDS = ['rhyme', 'first-sound', 'last-sound', 'middle-sound', 'syllables', 'blend', 'change-sound', 'letter-name', 'letter-sound',
  'spell-word', 'word-kinds', 'one-many', 'where-is', 'story-detail', 'story-order', 'sentence'] as const;

/** A stop that can be said is a spoken item with its key and the tap beside it; a shown stop is a gesture with no key. */
function assertChannel(s: WonderWalkStop) {
  const a = wonderWalkBoss.assignment(s);
  const key = stopSpokenKey(s);
  if (respondOf(s) === 'show') { expect(a).toEqual({ id: s.id, task: stopAsk(s), response: 'gesture' }); expect(key).toBeNull(); return; }
  expect(a).toMatchObject({ response: 'speech', acceptsGesture: true });
  expect(key).not.toBeNull();
  // A said stop only lives in a mode the card wires to take speech.
  expect(wonderWalkCard.modes[s.challengeType]).toMatchObject({ judge: 'either' });
}

it.each(WORDS)('%s: every stop of the saved walk is solved by the journey taps; a wrong answer is a named miss; no printed word', mode => {
  seam.evaluationContext = { lesson: 'test' };
  const d = payload(mode);
  wonderWalkBoss.validate(d);
  for (const s of d.challenges) {
    const h = mount({ ...d, challenges: [s, { ...s, id: 'stop-x' }] });
    const demand = () => h.state().task!.demand as Record<string, unknown>;
    expect(demand().kind).toBe(s.challengeType);
    expect(JSON.stringify(demand())).not.toMatch(/"(answer|traps|correctOptionId|phones)"/);
    if (s.correctOptionId) expect(JSON.stringify(demand())).not.toContain(s.correctOptionId);
    if (s.words?.sentence) {
      // A sentence stop's cards are word tiles, printed by design. A child who cannot read them hears every one named.
      const said = wonderWalkBoss.assignment(s).task;
      for (const t of s.words.things) if (t.tile && /[a-z]/i.test(t.tile)) expect(said.toLowerCase().split(/[^a-z']+/)).toContain(t.tile.toLowerCase());
    } else {
      // No printed word anywhere a child looks: cards are pictures or single letters.
      expect(h.view.container.querySelector('[data-pip-object="scene"]')!.textContent).not.toMatch(/[a-z]{2,}/i);
      for (const el of Array.from(h.view.container.querySelectorAll('[data-pip-object^="thing-"]'))) expect(el.textContent).not.toMatch(/[a-z]{2,}/i);
    }
    // The tap path on every stop (a said stop takes the tap too); the spoken path is the journey's (`drive.play`).
    const play = (right: boolean) => { const t = stopHarnessTaps(s); (right ? t.correct : t.wrong!).forEach(x => h.touch(x)); };
    assertChannel(s);
    play(false);
    const miss = h.state().task!.workspace!.attempts.at(-1)!;
    expect(miss.correct).toBe(false);
    expect(wonderWalkCard.modes[s.challengeType].misses).toContain(miss.miss);
    h.dispatch('retry'); h.confirmVisible();
    play(true);
    expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true });
    cleanup();
  }
});

it.each(MATH)('%s: the taps solve stop 1; a wrong answer is a named miss; the tutor scene carries no key', mode => {
  seam.evaluationContext = { lesson: 'test' };
  const d = payload(mode);
  const s = d.challenges[0];
  const h = mount(d);
  const demand = () => h.state().task!.demand as Record<string, unknown>;
  expect(demand().kind).toBe(mode);
  expect(JSON.stringify(demand())).not.toContain(s.correctOptionId || '"goal"');
  expect(JSON.stringify(demand())).not.toMatch(/"(answer|traps|correctOptionId)"/);
  // Nothing to read: no words on the world, numerals only on number buttons.
  const scene = h.view.container.querySelector('[data-pip-object="scene"]')!;
  expect(scene.textContent).not.toMatch(/[a-z]{2,}|\d/i);
  // The tap path on every stop (a said stop takes the tap too); the spoken path is the journey's (`drive.play`).
    const play = (right: boolean) => { const t = stopHarnessTaps(s); (right ? t.correct : t.wrong!).forEach(x => h.touch(x)); };
    assertChannel(s);
  play(false);
  const miss = h.state().task!.workspace!.attempts.at(-1)!;
  expect(miss.correct).toBe(false);
  expect(wonderWalkCard.modes[mode].misses).toContain(miss.miss);
  expect(h.view.container.querySelector('[data-pip-object="why"]')).not.toBeNull();
  h.dispatch('retry'); h.confirmVisible();
  play(true);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true });
});

it('a move world: a thing with one place to go moves on one tap; with two, it waits for the place; Try again puts it back', () => {
  const d = payload('parts');
  const s = d.challenges.find(x => x.world!.places.filter(p => p.droppable).length > 2) ?? d.challenges[0];
  const h = mount({ ...d, challenges: [s, { ...s, id: 'stop-x' }] });
  const thing = s.world!.objects.find(o => o.event !== 'leave' && s.world!.places.find(p => p.id === o.place)!.kind !== 'plate')!;
  const plate = s.world!.places.find(p => p.kind === 'plate')!;
  h.touch(`obj-${thing.id}`);
  h.touch(`place-${plate.id}`);
  expect(h.view.container.querySelector(`[data-pip-object="place-${plate.id}"] [data-pip-object="obj-${thing.id}"]`)).not.toBeNull();
  h.touch('done');
  expect(h.state().task!.workspace!.attempts.at(-1)!.correct).toBe(false);
  h.dispatch('retry'); h.confirmVisible();
  expect(h.view.container.querySelector(`[data-pip-object="place-${plate.id}"] [data-pip-object="obj-${thing.id}"]`)).toBeNull();

  const c = payload('count-out');
  const s2 = c.challenges[0];
  const h2 = mount(c);
  const first = s2.world!.objects[0];
  const basket = s2.world!.places.find(p => p.droppable && p.id !== first.place)!;
  h2.touch(`obj-${first.id}`);
  expect(h2.view.container.querySelector(`[data-pip-object="place-${basket.id}"] [data-pip-object="obj-${first.id}"]`)).not.toBeNull();
  expect(String((h2.state().task!.demand as Record<string, unknown>).learnerWork)).toMatch(/holds 1 /);
});

it('validate re-derives every math key from the world', () => {
  const tap = payload('more-fewer');
  const t = tap.challenges.find(x => x.world!.answer.kind === 'tap')!;
  t.correctOptionId = `place-${t.world!.places.find(p => p.choosable && `place-${p.id}` !== t.correctOptionId)!.id}`;
  expect(() => wonderWalkBoss.validate(tap)).toThrow(/key is not the place the rule names/);
  const num = payload('add-take');
  const n = num.challenges.find(x => x.world!.answer.kind === 'number')!;
  n.world!.objects = n.world!.objects.filter(o => o.event !== 'join').concat(n.world!.objects.filter(o => o.event === 'join').slice(1));
  expect(() => wonderWalkBoss.validate(num)).toThrow(/key is not the count/);
  const mv = payload('count-out');
  const m = mv.challenges[0];
  if (m.world!.answer.kind === 'move') m.world!.answer.goal = [{ places: [m.world!.places[0].id], atLeast: 1 }];
  expect(() => wonderWalkBoss.validate(mv)).toThrow(/goal holds before anything moves/);
});

it('authored levers: a help shows more of the same stop; a simplify opens ungraded practice; the stop comes back blank', () => {
  const base = stop(1, ['frog', '🐸'], [['rock', '🪨', 'other'], ['car', '🚗', 'looks_like']]);
  const lever = (id: string, kind: 'help' | 'simplify', item: WonderWalkStop) => ({ id, kind, when: 'after a wrong tap', says: kind === 'help' ? 'Here are two living things.' : 'Just two pictures.', item });
  base.levers = [
    lever('help_1', 'help', { ...base, id: 'stop-1-help_1', sceneWords: ['puppy', 'cow'], sceneEmoji: ['🐶', '🐮'] }),
    lever('simpler_1', 'simplify', { ...base, id: 'stop-1-simpler_1', options: base.options.filter(o => o.word !== 'car') }),
  ];
  const d = walk();
  d.challenges[0] = base;
  expect(() => wonderWalkBoss.validate(d)).not.toThrow();
  const h = mount(d);
  const offered = h.state().task!.workspace!.levers!;
  expect(offered.map(l => [l.id, l.kind, l.does])).toEqual([['help_1', 'help', 'Here are two living things.'], ['simpler_1', 'simplify', 'Just two pictures.']]);

  h.touch('option-s1-b');
  expect(h.dispatch('pull_lever', { lever: 'help_1' }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-pip-object="scene"]')!.textContent).toContain('🐮');
  expect(h.state().task!.itemId).toBe('stop-1');

  const r = h.dispatch('pull_lever', { lever: 'simpler_1' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('stop-1~simpler_1');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'stop-1' });
  expect(h.view.container.querySelectorAll('[data-pip-object^="option-"]')).toHaveLength(2);
  h.touch('option-s1-a');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('stop-1');
  expect(h.view.container.querySelectorAll('[data-pip-object^="option-"]')).toHaveLength(3);
});

it('validate checks a lever stop like any stop: a help whose stop says its answer is refused', () => {
  const base = stop(1, ['frog', '🐸'], [['rock', '🪨', 'other']]);
  base.levers = [{ id: 'help_1', kind: 'help', when: 'w', says: 's', item: { ...base, id: 'stop-1-help_1', ask: 'Is the frog alive?' } }];
  const d = walk();
  d.challenges[0] = base;
  expect(() => wonderWalkBoss.validate(d)).toThrow(/says its answer/);
});
