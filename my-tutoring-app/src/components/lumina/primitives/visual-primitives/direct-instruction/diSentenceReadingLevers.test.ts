import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { wordsOf } from '../literacy/decodablePracticeLines';
import { buildSentenceReadingItems, type DiSentenceReadingChallenge, type SentenceReadingItem } from './diSentenceReadingDomain';
import type { DiSentenceReadingChallengeType } from './diSentenceReadingModes';
import { SENTENCE_MENU } from './diSentenceReadingMenu';
import { MODEL_SENTENCE, SHORT_LINE, SHORT_SIGHT_LINE, SOUND_DOTS, TRACKING_UNDERLINE, isCvcWord, modelFor, sentenceLeverFacts,
  sentenceLevers, simplerLine, startingLevers } from './diSentenceReadingLevers';
import decodable from '../../../components/live-activity/runtime/testing/w1-payloads/di-sentence-reading.decodable_sentence.json';
import read from '../../../components/live-activity/runtime/testing/w1-payloads/di-sentence-reading.read_sentence.json';
import review from '../../../components/live-activity/runtime/testing/w1-payloads/di-sentence-reading.sentence_review.json';
import sight from '../../../components/live-activity/runtime/testing/w1-payloads/di-sentence-reading.sight_phrase_sentence.json';

const line = (text: string, type: DiSentenceReadingChallengeType, i = 0, tier?: 'easy' | 'medium' | 'hard'): DiSentenceReadingChallenge =>
  ({ id: `${type}-${i}`, challengeType: type, text, wordCount: wordsOf(text).length, ...(tier ? { supportTier: tier } : {}) });
const items = (texts: string[], type: DiSentenceReadingChallengeType, tier?: 'easy' | 'medium' | 'hard') =>
  buildSentenceReadingItems(texts.map((t, i) => line(t, type, i, tier)));
const SAVED: SentenceReadingItem[][] = [decodable, read, review, sight].map(p => buildSentenceReadingItems(p.data.challenges as DiSentenceReadingChallenge[]));
const MENU = Object.values(SENTENCE_MENU);
const shares = (a: string, b: string) => wordsOf(a).some(w => wordsOf(b).includes(w));

describe('model_sentence: a different sentence that reads no word of the child\'s', () => {
  it('every menu sentence, in each mode it can appear in, has a model sharing no word with it', () => {
    for (const e of MENU) {
      const modes: DiSentenceReadingChallengeType[] = ['read_sentence', 'sentence_review',
        ...(e.decodable ? ['decodable_sentence' as const] : []), ...(e.sightHeavy ? ['sight_phrase_sentence' as const] : [])];
      for (const mode of modes) {
        const [it0] = items([e.text], mode);
        const model = modelFor(it0, [it0]);
        expect(model, `${mode}: ${e.text}`).not.toBeNull();
        expect(shares(model!, e.text), `${model} beside ${e.text}`).toBe(false);
        const menu = MENU.find(m => m.text === model);
        // A decodable model is a decodable menu sentence or an all-CVC practice line; a sight model is sight-heavy.
        if (mode === 'decodable_sentence') expect(menu ? !!menu.decodable : wordsOf(model!).every(w => isCvcWord(w) || w === 'a')).toBe(true);
        if (mode === 'sight_phrase_sentence') expect(menu?.sightHeavy).toBe(true);
      }
    }
  });

  it('every saved item has a model that is no session sentence; its fact quotes only the model', () => {
    for (const session of SAVED) for (const it0 of session) {
      const model = modelFor(it0, session);
      expect(model, it0.text).not.toBeNull();
      expect(session.map(i => i.text)).not.toContain(model);
      expect(sentenceLeverFacts(it0, [MODEL_SENTENCE], session)).not.toContain(it0.text);
    }
  });
});

describe('help on the sentence draws marks, and dots only under words that can be sounded out', () => {
  it.each([['cat', true], ['Sam', true], ['the', false], ['was', false], ['see', false], ['red.', true], ['ball', false]] as const)(
    '%s is a CVC word: %s', (w, cvc) => expect(isCvcWord(w)).toBe(cvc));

  it('sight_phrase_sentence gets no dots; a sentence with no CVC word gets none either', () => {
    const [s] = items(['I can see it.'], 'sight_phrase_sentence');
    expect(sentenceLevers(s, [], [s]).map(l => l.id)).not.toContain(SOUND_DOTS);
    const [none] = items(['You and I can go.'], 'read_sentence');
    expect(sentenceLevers(none, [], [none]).map(l => l.id)).toContain(SOUND_DOTS); // "can" is CVC
    const [noCvc] = items(['Look at me!'], 'read_sentence');
    expect(sentenceLevers(noCvc, [], [noCvc]).map(l => l.id)).not.toContain(SOUND_DOTS);
  });
});

describe('simplify: a shorter line of the same mode', () => {
  it('short_line: 3 words, sharing no word with anything the session prints; all-CVC on decodable_sentence', () => {
    const session = items(['The red hen ran to the pen.', 'The dog sat on a log.'], 'decodable_sentence');
    const easier = simplerLine(session[0], SHORT_LINE, session)!;
    expect(easier.id).toBe(`${session[0].id}~simpler`);
    expect(easier.challengeType).toBe('decodable_sentence');
    expect(easier.wordCount).toBe(3);
    for (const i of session) expect(shares(easier.text, i.text), `${easier.text} / ${i.text}`).toBe(false);
    expect(wordsOf(easier.text).every(w => isCvcWord(w) || w === 'a')).toBe(true);
  });

  it('refused on a 3-word item (the mode floor)', () => {
    const [three] = items(['The rat ran.'], 'read_sentence');
    expect(simplerLine(three, SHORT_LINE, [three])).toBeNull();
    expect(sentenceLevers(three, [], [three]).filter(l => l.kind === 'simplify')).toEqual([]);
  });

  it('short_sight_line (R8): a shorter sight-heavy sentence sharing no word with the item', () => {
    const [it0] = items(['We like to look at my big dog.'], 'sight_phrase_sentence');
    const easier = simplerLine(it0, SHORT_SIGHT_LINE, [it0])!;
    expect(easier).not.toBeNull();
    expect(MENU.find(m => m.text === easier.text)!.sightHeavy).toBe(true);
    expect(easier.wordCount).toBeLessThan(it0.wordCount);
    expect(shares(easier.text, it0.text)).toBe(false);
    expect(simplerLine(it0, SHORT_LINE, [it0])).toBeNull();
  });
});

describe('the lever set and which lever answers which miss', () => {
  it('easy (or no tier) starts with the model; medium and hard with nothing', () => {
    const [easy] = items(['The dog is hot.'], 'read_sentence'), [hard] = items(['The dog is hot.'], 'read_sentence', 'hard');
    expect(startingLevers(easy, [easy])).toEqual([MODEL_SENTENCE]);
    expect(startingLevers(hard, [hard])).toEqual([]);
  });

  it.each([
    ['word_skip', [], MODEL_SENTENCE],
    ['word_skip', [MODEL_SENTENCE], TRACKING_UNDERLINE],
    ['word_swap', [MODEL_SENTENCE], SOUND_DOTS],
    ['word_swap', [MODEL_SENTENCE, SOUND_DOTS, TRACKING_UNDERLINE], SHORT_LINE],
  ] as const)('%s with %j on screen → %s', (miss, pulled, expected) => {
    const [it0] = items(['The big pig had a red hat on.'], 'read_sentence', 'hard');
    expect(nextLever(sentenceLevers(it0, pulled, [it0]), miss)).toBe(expected);
  });

  it('both named misses are answered on every saved payload', () => {
    for (const session of SAVED) {
      const answered = new Set(session.flatMap(i => sentenceLevers(i, [], session).flatMap(l => l.answers ?? [])));
      expect(answered.has('word_skip') && answered.has('word_swap')).toBe(true);
    }
  });
});
