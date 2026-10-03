import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import { SIGHT_LOOKALIKES } from '../literacy/spokenReadingMisses';
import { buildWordReadingItems, diWordReadingSpokenMisses, type DiWordReadingChallenge, type WordReadingItem } from './diWordReadingDomain';
import type { DiWordReadingChallengeType } from './diWordReadingModes';
import { BLEND_SLIDE, MODEL_WORD, SHORT_WORD, SOUND_DOTS, TRACKING_ARROW, blendOf, modelFor, modelLeaks, shortWordFor,
  startingLevers, wordLeverFacts, wordLevers } from './diWordReadingLevers';
import cvcReading from '../../../components/live-activity/runtime/testing/w1-payloads/di-word-reading.cvc_reading.json';
import readWord from '../../../components/live-activity/runtime/testing/w1-payloads/di-word-reading.read_word.json';
import sightWord from '../../../components/live-activity/runtime/testing/w1-payloads/di-word-reading.sight_word.json';
import review from '../../../components/live-activity/runtime/testing/w1-payloads/di-word-reading.word_reading_review.json';

const CVC = ['sam', 'mat', 'cat', 'hat', 'pan', 'map', 'red', 'hen', 'net', 'pen', 'bed', 'leg', 'pig', 'sit', 'pin', 'lip', 'dig', 'big',
  'dog', 'pot', 'hot', 'log', 'mop', 'top', 'sun', 'cup', 'bug', 'run', 'tub', 'mud'];
const SIGHT = ['the', 'see', 'go', 'to', 'is', 'we', 'my', 'and'];
const word = (w: string, type: DiWordReadingChallengeType, i = 0, tier?: 'easy' | 'medium' | 'hard'): DiWordReadingChallenge =>
  SIGHT.includes(w) ? { id: `${w}-${i}`, challengeType: type, word: w, wordType: 'sight', ...(tier ? { supportTier: tier } : {}) }
    : { id: `${w}-${i}`, challengeType: type, word: w, wordType: 'cvc', graphemes: w.split(''), ...(tier ? { supportTier: tier } : {}) };
const items = (words: string[], type: DiWordReadingChallengeType, tier?: 'easy' | 'medium' | 'hard') =>
  buildWordReadingItems(words.map((w, i) => word(w, type, i, tier)));
const SAVED: WordReadingItem[][] = [cvcReading, readWord, sightWord, review].map(p => buildWordReadingItems(p.data.challenges as DiWordReadingChallenge[]));
const CATALOG = DI_CATALOG.find(c => c.id === 'di-word-reading')!.teachingWorkspace!;

describe('model_word: a different word that gives no route to this one', () => {
  it.each([
    ['a session word', 'cat', 'sam', ['sam', 'cat'], true],
    ['a word sharing a letter (mat beside cat)', 'mat', 'cat', ['cat'], true],
    ['the word reversed (top beside pot)', 'top', 'pot', ['pot'], true],
    ['a sight look-alike (they beside the)', 'they', 'the', ['the'], true],
    ['a clean word (sun beside cat)', 'sun', 'cat', ['cat'], false],
  ] as const)('%s', (_, model, w, session, leaks) => {
    const s = items([...session], 'read_word');
    expect(modelLeaks(model, s.find(i => i.word === w)!, s)).toBe(leaks);
  });

  it('every menu word has a non-leaking model, alone and in a worst-case session of six', () => {
    for (const w of [...CVC, ...SIGHT]) {
      const [alone] = items([w], 'read_word');
      const model = modelFor(alone, [alone]);
      expect(model, w).not.toBeNull();
      expect(model!.word.split('').some(l => w.includes(l)), `${model!.word} shares a letter with ${w}`).toBe(false);
      if (SIGHT.includes(w)) expect(SIGHT_LOOKALIKES[w] ?? []).not.toContain(model!.word);
    }
    const sightSession = items(['the', 'see', 'go', 'to', 'is', 'we'], 'sight_word');
    for (const it0 of sightSession) {
      const model = modelFor(it0, sightSession);
      expect(model, it0.word).not.toBeNull();
      expect(sightSession.map(i => i.word)).not.toContain(model!.word);
    }
    const cvcSession = items(['cat', 'hen', 'pig', 'dog', 'sun', 'map'], 'cvc_reading');
    for (const it0 of cvcSession) expect(modelFor(it0, cvcSession), it0.word).not.toBeNull();
  });

  it('every saved item has a model, and no scene fact says the item\'s word', () => {
    for (const session of SAVED) for (const it0 of session) {
      expect(modelFor(it0, session), it0.word).not.toBeNull();
      const fact = wordLeverFacts(it0, wordLevers(it0, [], session).map(l => l.id), session);
      // The fact names the model in quotes; the item's own word is never the model.
      expect(fact, it0.word).not.toContain(`"${it0.word}"`);
    }
  });

  it('a decodable model is read as a blend; the blend is its own letters', () => {
    expect(blendOf('sun')).toBe('sss-uuu-nnn');
    expect(blendOf('cat')).toBe('k-aaa-t');
  });
});

describe('short_word (R7): a two-letter word, the same act with one sound fewer', () => {
  it('never a session word, nor the start or end of one; refused on a sight word', () => {
    const s = items(['cat', 'pin', 'hen'], 'cvc_reading');
    const easier = shortWordFor(s[0], s)!;
    expect(easier.id).toBe(`${s[0].id}~simpler`);
    expect(easier.challengeType).toBe('cvc_reading');
    expect(easier.word).toHaveLength(2);
    for (const i of s) expect(i.word.startsWith(easier.word) || i.word.endsWith(easier.word), `${easier.word} in ${i.word}`).toBe(false);
    const [sight] = items(['the'], 'sight_word');
    expect(shortWordFor(sight, [sight])).toBeNull();
  });
});

describe('the lever set, and which lever answers which miss', () => {
  it('a decodable word gets the model, three silent print levers and short_word; a sight word only the model (R6)', () => {
    const [cvc] = items(['cat'], 'cvc_reading');
    expect(wordLevers(cvc, [], [cvc]).map(l => l.id)).toEqual([MODEL_WORD, BLEND_SLIDE, SOUND_DOTS, TRACKING_ARROW, SHORT_WORD]);
    const [sight] = items(['the'], 'sight_word');
    expect(wordLevers(sight, [], [sight]).map(l => l.id)).toEqual([MODEL_WORD]);
  });

  it('easy (or no tier) starts with the model; medium and hard with nothing', () => {
    const [easy] = items(['cat'], 'read_word'), [hard] = items(['cat'], 'read_word', 'hard');
    expect(startingLevers(easy, [easy])).toEqual([MODEL_WORD]);
    expect(startingLevers(hard, [hard])).toEqual([]);
  });

  it.each([
    ['sounds_no_word', [MODEL_WORD], BLEND_SLIDE],
    ['middle_sound_changed', [MODEL_WORD], SOUND_DOTS],
    ['read_backwards', [MODEL_WORD], TRACKING_ARROW],
    ['letter_name', [MODEL_WORD], SHORT_WORD],
    ['letter_name', [], MODEL_WORD],
  ] as const)('cvc: %s with %j on screen → %s', (miss, pulled, expected) => {
    const [cvc] = items(['pan'], 'cvc_reading');
    expect(nextLever(wordLevers(cvc, pulled, [cvc]), miss)).toBe(expected);
  });

  it('every catalog miss is answered on the saved payloads, and every named miss is listed for its mode', () => {
    const answered = new Map<string, Set<string>>();
    for (const session of SAVED) for (const it0 of session) {
      const set = answered.get(it0.challengeType) ?? new Set<string>();
      wordLevers(it0, [], session).forEach(l => l.answers?.forEach(a => set.add(a)));
      answered.set(it0.challengeType, set);
      for (const m of diWordReadingSpokenMisses(it0)) expect(CATALOG.misses![it0.challengeType], `${it0.id} ${m.id}`).toContain(m.id);
    }
    for (const [mode, set] of Array.from(answered)) for (const miss of CATALOG.misses![mode])
      expect(set.has(miss), `${mode}: ${miss}`).toBe(true);
  });
});
