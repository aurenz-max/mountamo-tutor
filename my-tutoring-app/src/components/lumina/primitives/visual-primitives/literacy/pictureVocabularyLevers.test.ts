/**
 * picture-vocabulary's misses and levers (`/add-support-tiers`, handoff 22 L4), on a real generation: a wrong tap is
 * named from the recorded kinds, no clue leaks the word or its sounds, and the practice item never shows a session
 * answer or a card of the current item.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { clueLeak, itemsFromChallenges, type PictureVocabItem } from './pictureVocabularyScript';
import { CLUE_LEVER, MODEL_LEVER, TWO_CARDS_LEVER, leversOnScreen, modelFor, modelLeak, pictureVocabLevers, pictureVocabMiss, practiceItemFor,
  practiceLeak } from './pictureVocabularyLevers';
import { PICTURE_VOCAB_SPOKEN_MISSES, pictureVocabSpokenMisses } from './pictureVocabularyWorkspace';

const load = (file: string): PictureVocabItem[] => itemsFromChallenges(JSON.parse(readFileSync(join(__dirname,
  '../../../components/live-activity/runtime/testing/w1-payloads', file), 'utf8')).data.challenges);
const tap = load('picture-vocabulary.receptive_match.levers.json');
const say = load('picture-vocabulary.naming.levers.json');
const old = load('picture-vocabulary.receptive_match.json');
const entry = LITERACY_CATALOG.find(x => x.id === 'picture-vocabulary')!.teachingWorkspace!;

describe('picture-vocabulary misses', () => {
  it('a wrong tap is named against the target kind; right taps and spoken items name none', () => {
    for (const item of tap) {
      const target = item.options!.find(o => o.word === item.word)!;
      expect(pictureVocabMiss(item, item.word)).toBeUndefined();
      for (const o of item.options!.filter(o => o.word !== item.word))
        expect(pictureVocabMiss(item, o.word)).toBe(o.category === target.category ? 'same_category' : 'other_category');
    }
    expect(pictureVocabMiss(say[0], 'anything')).toBeUndefined();
  });

  it('an older payload with no kinds names other_picture and offers no pictures practice', () => {
    const [item] = old;
    const wrong = item.options!.find(o => o.word !== item.word)!.word;
    expect(pictureVocabMiss(item, wrong)).toBe('other_picture');
    expect(pictureVocabLevers(item, [], old).map(l => l.id)).not.toContain(TWO_CARDS_LEVER);
  });
});

describe('picture-vocabulary levers', () => {
  it('clue: offered on every generated noun item, never the word, a form of it, or its sounds', () => {
    for (const item of [...tap, ...say]) {
      expect(item.clue, item.word).toBeTruthy();
      expect(clueLeak(item.clue!, item.word)).toBe(false);
      expect(pictureVocabLevers(item, [], tap).map(l => l.id)).toContain(CLUE_LEVER);
    }
    expect(clueLeak('it starts with a d sound', 'dog')).toBe(true);
    expect(clueLeak('a small dog that barks', 'dog')).toBe(true);
    expect(clueLeak('it says /m/ /oo/', 'cow')).toBe(true);
    expect(clueLeak('it barks and wags its tail', 'dog')).toBe(false);
  });

  it('practice: two cards of different kinds, never a session answer or a card of the current item', () => {
    let built = 0;
    for (const item of tap) {
      const practice = practiceItemFor(item, tap);
      if (!practice) continue;
      built += 1;
      expect(practice.options).toHaveLength(2);
      expect(new Set(practice.options!.map(o => o.category)).size).toBe(2);
      expect(practice.options!.some(o => o.word === practice.word)).toBe(true);
      expect(practiceLeak(practice, item, tap)).toBe(false);
      expect(practice.kind).toBe('receptive_match');
    }
    expect(built).toBeGreaterThan(0);
  });

  it('every catalog miss is answered; a named miss picks its lever; carriers are shown or both', () => {
    expect(entry.levers).toBe(true);
    for (const [mode, items] of [['receptive_match', tap], ['naming', say]] as const) {
      const levers = pictureVocabLevers(items[0], [], tap);
      for (const miss of entry.misses![mode]) expect(levers.some(l => l.answers?.includes(miss)), `${mode} ${miss}`).toBe(true);
      for (const l of levers) expect(['shown', 'both']).toContain(l.carrier);
    }
    const levers = pictureVocabLevers(tap[0], [], tap);
    expect(nextLever(levers, 'same_category')).toBe(CLUE_LEVER);
    expect(nextLever(levers.map(l => l.id === CLUE_LEVER ? { ...l, pulled: true } : l), 'same_category')).toBe(TWO_CARDS_LEVER);
    // A relation mode gets its own model lever, never the clue or the practice cards.
    expect(pictureVocabLevers({ ...tap[0], kind: 'opposite' }, [], tap).map(l => l.id)).toEqual(['opposite_model']);
  });
});

describe('relation modes: a worked model on other words (handoff 24)', () => {
  const RELATION = ['opposite', 'association', 'gradable_scale', 'sentence_frame'] as const;
  const saved = Object.fromEntries(RELATION.map(m => [m, load(`picture-vocabulary.${m}.json`)])) as Record<typeof RELATION[number], PictureVocabItem[]>;

  it.each(RELATION)('%s: every saved item gets a model that uses no session word, and one lever answering every miss', mode => {
    for (const item of saved[mode]) {
      const model = modelFor(item, saved[mode])!;
      expect(model, item.id).toBeTruthy();
      expect(modelLeak(model, saved[mode])).toBe(false);
      const levers = pictureVocabLevers(item, [], saved[mode]);
      expect(levers.map(l => [l.id, l.kind, l.carrier])).toEqual([[MODEL_LEVER[mode], 'help', 'both']]);
      expect([...levers[0].answers!].sort()).toEqual([...entry.misses![mode]].sort());
      for (const miss of entry.misses![mode]) expect(nextLever(levers, miss)).toBe(MODEL_LEVER[mode]);
      // The scene fact names the model, never the item's answer.
      const fact = leversOnScreen(item, [MODEL_LEVER[mode]!], saved[mode])!;
      expect(fact.toLowerCase()).not.toMatch(new RegExp(`\\b${item.word.toLowerCase()}\\b`));
    }
  });

  it('the spoken misses the item sends are the catalog\'s, in the catalog\'s order', () => {
    for (const mode of [...RELATION, 'naming'] as const) {
      expect(entry.misses![mode]).toEqual(PICTURE_VOCAB_SPOKEN_MISSES[mode]);
      const item = mode === 'naming' ? say[0] : saved[mode][0];
      expect(pictureVocabSpokenMisses(item).map(m => m.id)).toEqual(entry.misses![mode]);
    }
  });

  it('a model whose word is a session word is refused: the next one in the pool is used', () => {
    const item = { ...saved.opposite[0], word: 'cold', baseWord: 'hot' };
    expect(modelFor(item, [item])!.cards.map(c => c.word)).toEqual(['up', 'down']);
  });
});
