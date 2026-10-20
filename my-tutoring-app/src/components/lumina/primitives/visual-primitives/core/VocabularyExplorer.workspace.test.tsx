// @vitest-environment jsdom
/**
 * vocabulary-explorer on its boss (`vocabularyExplorer.card.ts` + `.boss.ts`) and its lever set: what is its own. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * The word cards come first and nothing is answerable until Start the check. match is a gesture checked by code;
 * fill_blank and context are one word, tapped and checked or said aloud, with the key published only as the spoken
 * expectedAnswer. A wrong answer names its miss, and every miss has a help lever first.
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
import type { VocabularyExplorerData } from './VocabularyExplorer';
import {
  askOf, asCheck, buildVocabItems, clozeOf, clueText, composition, extraMeaning, modeOfKind, namesWord, posOf, seededRng,
  validVocabItem, vocabCorrect, vocabHarnessAnswers, vocabItems, vocabMiss, VOCAB_MISSES,
  type ChoiceItem, type MatchItem, type VocabItem, type VocabKind, type VocabMode, type VocabTerm, type VocabTier,
} from './vocabularyExplorerWorkspace';
import {
  DROP_LEVER, EXAMPLES_LEVER, exampleLeaks, FEWER_LEVER, KINDS_LEVER, meaningsShown, MEANINGS_LEVER, possibleMisses,
  simplerMatch, VOCAB_LEVERS,
} from './vocabularyExplorerLevers';
import { vocabularyExplorerBoss } from './vocabularyExplorer.boss';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const T = (id: string, word: string, partOfSpeech: string, definition: string, exampleSentence: string, clozeSentence: string,
  scenario: string, relatedWords: string[]): VocabTerm => ({ id, word, partOfSpeech, definition, exampleSentence, clozeSentence, scenario, relatedWords });
const BANK: VocabTerm[] = [
  T('t1', 'evaporation', 'noun', 'When liquid water is warmed and turns into a gas that rises into the air.',
    'On a hot day, evaporation dries the puddles on the playground.', "The sun's heat causes evaporation from the lake every afternoon.",
    'A wet towel hung in the sun is dry by lunchtime because the water went up into the air.', ['condensation', 'vapor']),
  T('t2', 'condensation', 'noun', 'When water vapor cools and turns back into tiny drops of liquid.',
    'Condensation formed on the outside of my cold glass of lemonade.', 'Clouds form through condensation high in the cold sky.',
    'Tiny drops of water appear on the bathroom mirror after a hot shower.', ['evaporation', 'cloud']),
  T('t3', 'precipitation', 'noun', 'Water that falls from clouds to the ground as rain, snow, sleet or hail.',
    'The weather report said there would be lots of precipitation tomorrow.', 'Heavy precipitation filled the rain gauge in our garden.',
    'Big gray clouds open up and snowflakes drift down onto the school yard.', ['rain', 'snow']),
  T('t4', 'collect', 'verb', 'To gather together in one place.', 'Rainwater can collect in low spots on the ground.',
    'Rivers collect water from many small streams.', 'After the storm, all the water from the hills ends up together in one big pond.', ['gather', 'pool']),
  T('t5', 'humid', 'adjective', 'Feeling damp because there is a lot of water vapor in the air.', 'The air felt humid and sticky before the storm.',
    'Our classroom felt humid after the rain stopped.', 'Your shirt sticks to your back on a warm, damp summer afternoon.', ['damp', 'moist']),
  T('t6', 'runoff', 'noun', 'Rain or melted snow that flows over the ground into streams and rivers.', 'Runoff from the hills carried mud into the creek.',
    'The runoff rushed down the street into the drain.', 'Melted snow trickles down the hill and into the creek.', ['stream', 'collect']),
];

// A hard match (four words, one extra meaning), an easy match (three words), a sentence item keyed "evaporation" and a
// situation item keyed "condensation".
const HARD_MATCH: MatchItem = { id: 'match-1', kind: 'match', terms: ['t3', 't1', 't4', 't2'], defs: ['t1', 't5', 't2', 't3', 't4'] };
const EASY_MATCH: MatchItem = { id: 'match-2', kind: 'match', terms: ['t1', 't2', 't3'], defs: ['t3', 't1', 't2'] };
const FILL: ChoiceItem = { id: 'fill_blank-1', kind: 'fill_blank', term: 't1', options: ['t2', 't1', 't4', 't3'], clue: 'sentence' };
const SITUATION: ChoiceItem = { id: 'context-2', kind: 'context', term: 't2', options: ['t5', 't6', 't2', 't1'], clue: 'scenario' };
const MODES: VocabMode[] = ['explore', 'recall', 'apply'];
const KINDS: Record<VocabMode, VocabKind[]> = { explore: ['match'], recall: ['match', 'fill_blank'], apply: ['fill_blank', 'context'] };
const BY_MODE: Record<VocabMode, VocabItem[]> = { explore: [HARD_MATCH, EASY_MATCH], recall: [HARD_MATCH, FILL], apply: [FILL, SITUATION] };
/** An item as the boss carries it (its mode and the bank), and the lever set read on it with no pull. */
const chk = (i: VocabItem, mode: VocabMode) => asCheck(i, modeOfKind(i.kind, KINDS[mode]), BANK);
const leversOn = (i: VocabItem, mode: VocabMode) => VOCAB_LEVERS.declare(chk(i, mode), { dropped: [], picked: [] }, []);

const data = (mode: VocabMode, items = BY_MODE[mode]): VocabularyExplorerData =>
  ({ title: 'Water Cycle Words', topic: 'The water cycle', introduction: 'Words for how water moves.', terms: BANK, challengeTypes: KINDS[mode], items });
const mount = (mode: VocabMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'vocabulary-explorer', evalMode: mode, instanceId: 'vocabulary-explorer', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const start = (h: WorkspaceHarness) => { h.press('Start the check'); h.settle(); };
const pair = (h: WorkspaceHarness, item: MatchItem, pairs: Record<string, string>) => {
  item.terms.forEach((t, i) => { h.touch(`term-${i + 1}`); h.touch(`meaning-${item.defs.indexOf(pairs[t]) + 1}`); });
  h.press(/Check Matches/); h.settle();
};
const right = (item: MatchItem) => Object.fromEntries(item.terms.map(t => [t, t]));
const choose = (h: WorkspaceHarness, word: string) => { h.press(word); h.press(/Check Answer/); h.settle(); };
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s opens on the word cards, then binds the check with its key out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(getComponentById('vocabulary-explorer')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  // The cards: nothing to answer yet, no levers, the card's meaning on screen and in the scene.
  expect(demand(h)).toMatchObject({ kind: 'study', presentation: 'not ready' });
  expect(String(demand(h).card)).toContain('evaporation');
  expect(h.state().task!.workspace!.levers ?? []).toEqual([]);
  start(h);
  expect(h.state().task!.task).toBe(vocabularyExplorerBoss.assignment(chk(item, mode)).task);
  expect(demand(h).presentation).toBe('ready');
  expect(text(h)).not.toMatch(/What it means|In a sentence/);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(text(h)).not.toMatch(/Next →|Finish/);
  if (item.kind === 'match') {
    expect(demand(h).response).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  } else {
    expect(demand(h).response).toBe('speech');
    expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^"evaporation"\./);
    expect(namesWord(String(demand(h).question), 'evaporation')).toBe(false);
    expect(JSON.stringify(demand(h))).not.toMatch(/turns into a gas/);
  }
  h.close();
});

it('match: a swap names its miss and closes the board; Try again clears it; show_examples draws; right, then on', () => {
  const h = mount('explore');
  start(h);
  expect(levers(h)).toEqual([[EXAMPLES_LEVER, 'help', false]]);
  pair(h, HARD_MATCH, { ...right(HARD_MATCH), t3: 't1', t1: 't3' });
  expect(last(h)).toMatchObject({ correct: false, miss: 'swapped_pair' });
  expect(String(demand(h).learnerWork)).toMatch(/"precipitation" with meaning A/);
  expect(text(h)).toMatch(/Not every word is with its meaning\./);
  expect(h.view.container.querySelector('[data-pip-object="term-1"]')!.hasAttribute('disabled')).toBe(true);
  expect(nextLever(h.state().task!.workspace!.levers!, 'swapped_pair')).toBe(EXAMPLES_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: EXAMPLES_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="examples"]').length).toBe(4);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/under "precipitation"/);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).learnerWork).toBe('No pairs made yet');
  // The extra meaning is a miss of its own.
  pair(h, HARD_MATCH, { ...right(HARD_MATCH), t4: 't5' });
  expect(last(h)).toMatchObject({ correct: false, miss: 'extra_meaning' });
  h.dispatch('retry'); h.confirmVisible();
  pair(h, HARD_MATCH, right(HARD_MATCH));
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [EXAMPLES_LEVER] });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('match-2');
  // Three words leave three others for a smaller match.
  expect(levers(h).map(([id]) => id)).toEqual([EXAMPLES_LEVER, FEWER_LEVER]);
  const fewer = h.dispatch('pull_lever', { lever: FEWER_LEVER });
  expect(fewer.state.task).toMatchObject({ itemId: 'match-2~simpler' });
  const practice = simplerMatch(EASY_MATCH, BANK)!;
  expect(practice.terms.some(t => EASY_MATCH.defs.includes(t))).toBe(false);
  expect(h.view.container.querySelector('[data-practice="simpler"]')).not.toBeNull();
  pair(h, practice, right(practice));
  expect(last(h)).toMatchObject({ itemId: 'match-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'match-2' });
  h.close();
});

it('sentence and situation: a wrong word names its miss; the levers draw; a spoken word completes and submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('apply');
  start(h);
  // drop_choice narrows the item in place, so it is a help lever (custom), not a practice item.
  expect(levers(h)).toEqual([[KINDS_LEVER, 'help', false], [MEANINGS_LEVER, 'help', false], [DROP_LEVER, 'help', false]]);
  expect(text(h)).toContain("The sun's heat causes _____ from the lake every afternoon.");
  choose(h, 'collect');
  expect(last(h)).toMatchObject({ correct: false, miss: 'wrong_kind_of_word' });
  expect(demand(h).learnerWork).toBe('Chose "collect"');
  expect(nextLever(h.state().task!.workspace!.levers!, 'wrong_kind_of_word')).toBe(KINDS_LEVER);
  expect(h.dispatch('pull_lever', { lever: KINDS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="kinds"]').length).toBe(4);
  expect(String(demand(h).onScreen)).toMatch(/collect \(verb\)/);
  expect(h.dispatch('pull_lever', { lever: MEANINGS_LEVER }).status).toBe('committed');
  const meanings = Array.from(h.view.container.querySelectorAll('[data-lever="meanings"]')).map(e => e.textContent ?? '');
  expect(meanings.length).toBe(4);
  for (const m of meanings) for (const w of ['evaporation', 'condensation', 'collect', 'precipitation']) expect(namesWord(m, w), m).toBe(false);
  // The dropped choice is one the learner has not tapped, of another kind or unrelated, never the answer.
  expect(h.dispatch('pull_lever', { lever: DROP_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/"precipitation", is greyed out/);
  expect(h.view.container.querySelector('button[aria-label="precipitation"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  choose(h, 'evaporation');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [KINDS_LEVER, MEANINGS_LEVER, DROP_LEVER] });
  expect(text(h)).toContain("The sun's heat causes evaporation from the lake every afternoon.");
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('context-2');
  // A situation has no kinds lever: its words are not fitted into a sentence.
  expect(levers(h).map(([id]) => id)).toEqual([MEANINGS_LEVER, DROP_LEVER]);
  h.say('condensation'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'vocabulary-explorer', totalTerms: 6 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'wrong_kind_of_word'], [true, null], [true, null]]);
  h.close();
});

describe('the pure rules', () => {
  const TIERS: VocabTier[] = ['easy', 'medium', 'hard'];
  const all = (mode: VocabMode) => TIERS.flatMap(tier => [0, 1, 2, 3].flatMap(seed =>
    buildVocabItems({ bank: BANK, kinds: KINDS[mode], tier, rng: seededRng(`${mode}${tier}${seed}`) }).map(i => ({ i, tier }))));

  it.each(MODES)('%s builds valid, keyed items of its kinds at every tier', mode => {
    for (const { i, tier } of all(mode)) {
      expect(validVocabItem(i, BANK), `${mode} ${tier} ${i.id}`).toBe(true);
      expect(KINDS[mode]).toContain(i.kind);
      const a = vocabHarnessAnswers(i, BANK);
      expect(vocabCorrect(i, a.correct)).toBe(true);
      expect(vocabCorrect(i, a.plainWrong)).toBe(false);
      expect(vocabMiss(i, a.plainWrong, BANK)).toBeDefined();
    }
    expect(all(mode).filter(x => x.tier === 'medium').map(x => x.i.kind).slice(0, composition(KINDS[mode]).length)).toEqual(composition(KINDS[mode]));
  });

  it('the tiers are structural', () => {
    for (const mode of MODES) for (const { i, tier } of all(mode)) {
      if (i.kind === 'match') {
        expect(i.terms.length).toBe(tier === 'easy' ? 3 : 4);
        expect(!!extraMeaning(i)).toBe(tier === 'hard');
        expect(i.terms.every((t, k) => i.defs[k] === t)).toBe(false);
      } else {
        expect(i.options.length).toBe(tier === 'easy' ? 3 : 4);
        const key = BANK.find(t => t.id === i.term)!;
        const foils = i.options.filter(o => o !== i.term).map(o => BANK.find(t => t.id === o)!);
        // easy: the other words are of another kind where the bank has them (here every key's kind has two others).
        if (tier === 'easy') expect(foils.filter(f => posOf(f) !== posOf(key)).length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('vocabulary-explorer')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...VOCAB_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        const ls = leversOn(i, mode);
        const misses = possibleMisses(i, BANK);
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(VOCAB_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
      }
    }
  });

  it('no ask, clue or lever names the answer', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      if (i.kind === 'match') continue;
      const key = BANK.find(t => t.id === i.term)!;
      expect(namesWord(askOf(i, BANK), key.word), i.id).toBe(false);
      expect(namesWord(clueText(i, BANK), key.word), i.id).toBe(false);
      for (const m of meaningsShown(i, BANK)) expect(namesWord(m.meaning, key.word), m.meaning).toBe(false);
    }
    // A sentence the model already blanked is taken; one with the word and a blank, or a form of the word, is not.
    expect(clozeOf({ ...BANK[1], clozeSentence: 'Drops form on the lid through ________ when steam meets cold glass.' }))
      .toEqual({ text: 'Drops form on the lid through _____ when steam meets cold glass.', clue: 'sentence' });
    expect(clozeOf({ ...BANK[1], clozeSentence: 'Drops of ____ condense on the lid.' })!.clue).toBe('example');
    expect(exampleLeaks({ ...BANK[0], exampleSentence: 'Evaporation is when liquid water is warmed and turns into a gas.' })).toBe(true);
    expect(BANK.some(exampleLeaks)).toBe(false);
  });

  it('the smaller match uses no word of the item and never shrinks twice', () => {
    for (const mode of ['explore', 'recall'] as VocabMode[]) for (const { i } of all(mode)) {
      const s = simplerMatch(i, BANK);
      if (!s) continue;
      expect(s.kind).toBe('match');
      expect(s.terms.length).toBeGreaterThanOrEqual(2);
      expect(s.terms.some(t => (i as MatchItem).defs.includes(t))).toBe(false);
      expect(simplerMatch(s, BANK)).toBeNull();
      expect(leversOn(s, mode)).toEqual([]);
    }
    expect(simplerMatch(HARD_MATCH, BANK)).toBeNull();
  });

  it('a legacy lesson (model-written challenges, no sentences or situations) still builds code items', () => {
    const legacy = { title: 'Old Words', terms: BANK.map(({ clozeSentence: _c, scenario: _s, ...t }) => t),
      challenges: [{ type: 'match' }, { type: 'fill_blank' }, { type: 'identify' }] };
    const items = vocabItems(legacy);
    expect(new Set(items.map(i => i.kind))).toEqual(new Set(['match', 'fill_blank']));
    expect(vocabItems(legacy)).toEqual(items);
    const fill = items.find(i => i.kind === 'fill_blank') as ChoiceItem;
    expect(fill.clue).toBe('example');
    expect(clozeOf(legacy.terms.find(t => t.id === fill.term)!)!.clue).toBe('example');
  });
});
