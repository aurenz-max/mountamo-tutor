import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import { buildLetterSoundItems, diLetterSoundSpokenMisses, type DiLetterSoundChallenge, type LetterSoundItem } from './diLetterSoundsDomain';
import type { DiLetterSoundChallengeType } from './diLetterSoundsModes';
import { LETTER_SOUND_MENU } from './diLetterSoundsMenu';
import { FIRST_BOX, KEYWORD_PICTURE, KEYWORD_SOUNDS, MODEL_SOUND, SOUND_ARROW, letterLeverFacts, letterLevers, modelFor,
  pictureShown, startingLevers } from './diLetterSoundsLevers';
import letterSound from '../../../components/live-activity/runtime/testing/w1-payloads/di-letter-sounds.letter_sound.json';
import stops from '../../../components/live-activity/runtime/testing/w1-payloads/di-letter-sounds.letter_sound-stops.json';
import review from '../../../components/live-activity/runtime/testing/w1-payloads/di-letter-sounds.letter_sound_review.json';
import onset from '../../../components/live-activity/runtime/testing/w1-payloads/di-letter-sounds.first_sound_in_word.json';

const HELD = ['m', 's', 'f', 'r', 'n', 'l', 'v', 'z'];
const PARTNERS = [['m', 'n'], ['f', 'v'], ['s', 'z'], ['t', 'd'], ['p', 'b'], ['k', 'g'], ['c', 'g'], ['c', 'k'], ['e', 'i']];
const challenge = (letter: string, type: DiLetterSoundChallengeType, i = 0, tier?: 'easy' | 'medium' | 'hard'): DiLetterSoundChallenge => {
  const m = LETTER_SOUND_MENU[letter];
  return { id: `${type}-${letter}-${i}`, challengeType: type, letter: m.letter, spoken: m.spoken, keyword: m.keyword, emoji: m.emoji,
    elicitation: m.elicitation, ...(m.articulation ? { articulation: m.articulation } : {}), ...(tier ? { supportTier: tier } : {}) };
};
const items = (letters: string[], type: DiLetterSoundChallengeType, tier?: 'easy' | 'medium' | 'hard') =>
  buildLetterSoundItems(letters.map((l, i) => challenge(l, type, i, tier)));
const SAVED: LetterSoundItem[][] = [letterSound, stops, review, onset].map(p => buildLetterSoundItems(p.data.challenges as DiLetterSoundChallenge[]));
const CATALOG = DI_CATALOG.find(c => c.id === 'di-letter-sounds')!.teachingWorkspace!;
const kind = (l: string) => LETTER_SOUND_MENU[l].elicitation === 'keyword' ? 'vowel' : LETTER_SOUND_MENU[l].articulation === 'clipped' ? 'clipped' : 'held';

function expectSafeModel(item: LetterSoundItem, session: LetterSoundItem[]) {
  const model = modelFor(item, session);
  if (!model) return null;
  const l = item.letter, coming = session.slice(session.findIndex(i => i.id === item.id) + 1);
  expect(model.letter, l).not.toBe(l);
  expect(model.spoken, `${l}: same sound`).not.toBe(item.spoken);
  expect(PARTNERS.some(([a, b]) => (a === l && b === model.letter) || (b === l && a === model.letter)), `${l}/${model.letter} partners`).toBe(false);
  expect(item.keyword.includes(model.letter), `${model.letter} is in "${item.keyword}"`).toBe(false);
  expect(coming.map(i => i.letter), `${model.letter} comes later`).not.toContain(model.letter);
  expect(kind(model.letter)).toBe(item.challengeType === 'first_sound_in_word' ? 'held' : kind(l));
  return model;
}

describe('model_sound: a different letter of the same kind, never a route to this sound', () => {
  it('every menu letter, asked alone, has a model; every held letter has an onset model', () => {
    for (const l of Object.keys(LETTER_SOUND_MENU)) {
      const [it0] = items([l], 'letter_sound');
      expect(expectSafeModel(it0, [it0]), l).not.toBeNull();
    }
    for (const l of HELD) {
      const [it0] = items([l], 'first_sound_in_word');
      expect(expectSafeModel(it0, [it0]), l).not.toBeNull();
    }
  });

  it('every saved payload item has a safe model', () => {
    for (const session of SAVED) for (const it0 of session) expect(expectSafeModel(it0, session), it0.id).not.toBeNull();
  });

  it('a long review: every model is safe; the items with none have nothing left of their kind (reported)', () => {
    const order = ['m', 's', 'a', 'f', 'r', 'i', 'n', 'l', 'o', 'v', 'z', 'u', 'e', 't', 'p', 'c', 'k', 'h', 'd', 'g'];
    const session = items(order, 'letter_sound_review');
    const without = session.filter(i => !expectSafeModel(i, session)).map(i => i.letter);
    // The early items of a 20-letter review have every other letter still to come. Pinned so a change is seen.
    expect(without).toEqual(['m', 'a']);
    for (const l of without) expect(letterLevers(session.find(i => i.letter === l)!, [], session).map(x => x.id)).not.toContain(MODEL_SOUND);
  });
});

describe('the lever set per mode', () => {
  it.each([
    ['held letter_sound', items(['m'], 'letter_sound')[0], [MODEL_SOUND, SOUND_ARROW, KEYWORD_PICTURE]],
    ['clipped stop', items(['t'], 'letter_sound')[0], [MODEL_SOUND, KEYWORD_PICTURE]],
    ['short vowel', items(['a'], 'letter_sound_review')[0], [MODEL_SOUND, KEYWORD_PICTURE]],
    ['onset', items(['f'], 'first_sound_in_word')[0], [MODEL_SOUND, FIRST_BOX]],
  ] as const)('%s', (_, it0, expected) => {
    expect(letterLevers(it0, [], [it0]).map(l => l.id)).toEqual(expected);
    expect(letterLevers(it0, [], [it0]).every(l => l.kind === 'help')).toBe(true);
  });

  it('the keyword picture is drawn on an onset item always, on a letter item only as the lever (R4)', () => {
    const [letter] = items(['m'], 'letter_sound'), [word] = items(['m'], 'first_sound_in_word');
    expect(pictureShown(letter, [])).toBe(false);
    expect(pictureShown(letter, [KEYWORD_PICTURE])).toBe(true);
    expect(pictureShown(word, [])).toBe(true);
  });

  it('easy starts with the model (and the picture on a letter item); medium and hard with nothing', () => {
    const [easy] = items(['m'], 'letter_sound', 'easy'), [none] = items(['m'], 'letter_sound');
    expect(startingLevers(easy, [easy])).toEqual([MODEL_SOUND, KEYWORD_PICTURE]);
    expect(startingLevers(none, [none])).toEqual([MODEL_SOUND, KEYWORD_PICTURE]);
    const [medium] = items(['m'], 'letter_sound', 'medium');
    expect(startingLevers(medium, [medium])).toEqual([]);
    const [onsetEasy] = items(['m'], 'first_sound_in_word', 'easy');
    expect(startingLevers(onsetEasy, [onsetEasy])).toEqual([MODEL_SOUND]);
  });

  it('first_box has one box per sound of the word, from a code table', () => {
    for (const l of HELD) expect(KEYWORD_SOUNDS[LETTER_SOUND_MENU[l].keyword]).toBeGreaterThanOrEqual(3);
    expect(KEYWORD_SOUNDS.fish).toBe(3);
  });

  it('a scene fact never says the item\'s sound', () => {
    for (const session of SAVED) for (const it0 of session) {
      const fact = letterLeverFacts(it0, letterLevers(it0, [], session).map(l => l.id), session);
      expect(fact, it0.id).not.toContain(it0.spoken);
    }
  });
});

describe('this wrong answer, then this lever', () => {
  it.each([
    ['added_vowel', 'm', 'letter_sound', [MODEL_SOUND], SOUND_ARROW],
    ['other_sound', 'm', 'letter_sound', [MODEL_SOUND], KEYWORD_PICTURE],
    ['letter_name', 't', 'letter_sound', [], MODEL_SOUND],
    ['last_sound', 'm', 'first_sound_in_word', [MODEL_SOUND], FIRST_BOX],
    ['keyword_word', 'm', 'first_sound_in_word', [], MODEL_SOUND],
  ] as const)('%s on %s (%s), with %j on screen → %s', (miss, l, type, pulled, expected) => {
    const [it0] = items([l], type);
    expect(nextLever(letterLevers(it0, pulled, [it0]), miss)).toBe(expected);
  });

  it('every catalog miss is answered on the saved payloads, and every named miss is listed for its mode', () => {
    const answered = new Map<string, Set<string>>();
    for (const session of SAVED) for (const it0 of session) {
      const set = answered.get(it0.challengeType) ?? new Set<string>();
      letterLevers(it0, [], session).forEach(l => l.answers?.forEach(a => set.add(a)));
      answered.set(it0.challengeType, set);
      for (const m of diLetterSoundSpokenMisses(it0)) expect(CATALOG.misses![it0.challengeType], `${it0.id} ${m.id}`).toContain(m.id);
    }
    for (const [mode, set] of Array.from(answered)) for (const miss of CATALOG.misses![mode]) expect(set.has(miss), `${mode}: ${miss}`).toBe(true);
  });
});
