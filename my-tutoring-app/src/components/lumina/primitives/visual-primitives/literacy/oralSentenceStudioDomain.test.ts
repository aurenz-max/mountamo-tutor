import { describe, expect, it } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import type { OralSentenceStudioChallenge } from './OralSentenceStudio';
import { ORAL_SENTENCE_MISSES } from './oralSentenceStudio.card';
import {
  askFor,
  challengeAskable,
  itemsFromChallenges,
  oralSentenceHarnessAnswers,
  oralSentenceKey,
  oralSentenceScene,
  oralSentenceSpokenMisses,
} from './oralSentenceStudioDomain';

const challenge: OralSentenceStudioChallenge = {
  id: 'oral-sentence-studio-1',
  type: 'describe_scene',
  sceneTitle: 'A Garden Discovery',
  settingEmoji: '🌿',
  settingLabel: 'in the garden',
  actorEmoji: '🧒',
  actorLabel: 'Mina',
  actionEmoji: '🔎',
  actionLabel: 'looks closely at',
  objectEmoji: '🐛',
  objectLabel: 'a caterpillar',
  targetWords: ['curious', 'tiny'],
  wordMeanings: ['wanting to learn more', 'very small'],
  sceneMeaning: 'Mina looks closely at a small caterpillar in the garden.',
  acceptedSentences: [
    'Curious Mina studies the tiny caterpillar.',
    'Mina is curious about the tiny caterpillar.',
    'The tiny caterpillar makes curious Mina look closely.',
  ],
};

describe('oral-sentence-studio domain', () => {
  const [item] = itemsFromChallenges([challenge]);

  it('builds a spoken item from a valid challenge', () => {
    expect(challengeAskable(challenge)).toBe(true);
    expect(item).toMatchObject({ id: challenge.id, mode: 'describe_scene', modelResponse: challenge.acceptedSentences[0] });
  });

  it('the ask says both words and their meanings and never an example sentence or the scene meaning', () => {
    const ask = askFor(item);
    expect(ask).toContain('Make one whole sentence');
    for (const word of [...challenge.targetWords, ...challenge.wordMeanings]) expect(ask).toContain(word);
    expect(ask).not.toContain(challenge.sceneMeaning);
    expect(askLeaks(ask, oralSentenceKey(item))).toEqual([]);
  });

  it('the key is judged on meaning, with the three sentences as examples and the misses named', () => {
    const key = oralSentenceKey(item);
    expect(key.meaning?.idea).toContain(challenge.sceneMeaning);
    expect([key.answer, ...key.alsoAccept]).toEqual(challenge.acceptedSentences);
    const text = spokenKeyText(key);
    for (const sentence of challenge.acceptedSentences) expect(text).toContain(sentence);
    expect(text).toMatch(/a fragment, the two words listed/);
    expect(text).toMatch(/not about this picture/);
  });

  it('the misses follow the card, concrete to the item', () => {
    const misses = oralSentenceSpokenMisses(item);
    expect(misses.map(m => m.id)).toEqual([...ORAL_SENTENCE_MISSES]);
    expect(misses.find(m => m.id === 'words_listed')!.examples).toEqual(['curious tiny']);
  });

  it('the scene names what is drawn and printed, never an example sentence', () => {
    const scene = JSON.stringify(oralSentenceScene(item));
    expect(scene).toContain('A Garden Discovery');
    expect(scene).toContain('curious');
    expect(scene).not.toContain(challenge.sceneMeaning);
    for (const sentence of challenge.acceptedSentences) expect(scene).not.toContain(sentence);
  });

  it('the harness says an example right and a fragment wrong', () => {
    expect(oralSentenceHarnessAnswers(item)).toEqual({
      correct: challenge.acceptedSentences[0], plainWrong: 'curious tiny a caterpillar' });
  });

  it('rejects malformed challenge payloads at the component seam', () => {
    expect(challengeAskable({ ...challenge, acceptedSentences: [
      'Curious Mina studies the tiny caterpillar.',
      'Curious Mina studies the tiny caterpillar.',
      'Tiny curious caterpillar.',
    ] })).toBe(false);
    expect(challengeAskable({ ...challenge, targetWords: ['curious', 'curious'] })).toBe(false);
    expect(challengeAskable({ ...challenge, sceneMeaning: 'A sentence about the moon.' })).toBe(false);
  });
});
