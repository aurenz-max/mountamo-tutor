import { describe, expect, it } from 'vitest';
import { challengeAskable } from '../../primitives/visual-primitives/literacy/oralSentenceStudioScript';
import {
  ORAL_SENTENCE_STUDIO_FALLBACKS,
  validateOralSentenceStudioPayload,
} from './gemini-oral-sentence-studio';

const flatPayload = () => ({
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
  targetWord0: 'curious',
  targetWord1: 'tiny',
  meaning0: 'wanting to learn more',
  meaning1: 'very small',
  sceneMeaning: 'Curious Mina looks closely at a tiny caterpillar.',
  acceptedSentence0: 'Curious Mina studies the tiny caterpillar.',
  acceptedSentence1: 'Mina is curious about the tiny caterpillar.',
  acceptedSentence2: 'The tiny caterpillar makes curious Mina look closely.',
});

describe('gemini oral-sentence-studio contract', () => {
  it('keeps a full bank of valid, distinct fallback challenges', () => {
    expect(ORAL_SENTENCE_STUDIO_FALLBACKS.length).toBeGreaterThanOrEqual(3);
    expect(ORAL_SENTENCE_STUDIO_FALLBACKS.every(challengeAskable)).toBe(true);
    const sceneKeys = ORAL_SENTENCE_STUDIO_FALLBACKS.map((challenge) =>
      [challenge.settingLabel, challenge.actorLabel, challenge.actionLabel, challenge.objectLabel].join('|'));
    expect(new Set(sceneKeys).size).toBe(sceneKeys.length);
  });

  it('reconstructs flat arrays and assigns an index-derived id', () => {
    const challenge = validateOralSentenceStudioPayload(flatPayload(), 2);
    expect(challenge).toMatchObject({
      id: 'oral-sentence-studio-3',
      type: 'describe_scene',
      targetWords: ['curious', 'tiny'],
      wordMeanings: ['wanting to learn more', 'very small'],
    });
    expect(challenge?.acceptedSentences).toHaveLength(3);
    expect(challengeAskable(challenge!)).toBe(true);
  });

  it('rejects missing, malformed, repeated, or semantically ungrounded fields', () => {
    const valid = flatPayload();
    expect(validateOralSentenceStudioPayload({ ...valid, acceptedSentence2: '' }, 0)).toBeNull();
    expect(validateOralSentenceStudioPayload({ ...valid, actorEmoji: 'child' }, 0)).toBeNull();
    expect(validateOralSentenceStudioPayload({ ...valid, targetWord1: 'curious' }, 0)).toBeNull();
    expect(validateOralSentenceStudioPayload({
      ...valid,
      acceptedSentence2: valid.acceptedSentence0,
    }, 0)).toBeNull();
    expect(validateOralSentenceStudioPayload({
      ...valid,
      sceneMeaning: 'Mina looks closely at a caterpillar.',
    }, 0)).toBeNull();
    expect(validateOralSentenceStudioPayload({
      ...valid,
      acceptedSentence1: 'Curious birds watch a tiny cloud.',
    }, 0)).toBeNull();
  });
});
