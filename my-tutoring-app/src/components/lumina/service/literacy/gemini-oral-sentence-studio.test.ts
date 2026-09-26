import { describe, expect, it } from 'vitest';
import { spokenSpanOf, validateJudgedScriptPack } from '../../hooks/judgedScriptContract';
import {
  challengeAskable,
  itemCue,
  itemsFromChallenges,
  oralSentenceStudioPack,
} from '../../primitives/visual-primitives/literacy/oralSentenceStudioScript';
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

  it('keeps at least three askable fallbacks for every task identity', () => {
    for (const type of ['describe_scene', 'guided_writing_rehearsal', 'use_story_words'] as const) {
      expect(ORAL_SENTENCE_STUDIO_FALLBACKS.filter((c) => c.type === type && challengeAskable(c)).length)
        .toBeGreaterThanOrEqual(3);
    }
  });

  it('admits a rehearsal step only with an order word and a prior step', () => {
    const rehearsal = {
      ...flatPayload(),
      type: 'guided_writing_rehearsal',
      sceneTitle: 'Our Caterpillar Story',
      priorStepLabel: 'finding a leaf',
      targetWord0: 'next',
      meaning0: 'right after that',
      sceneMeaning: 'Next, curious Mina looks closely at a tiny caterpillar.',
      acceptedSentence0: 'Next, Mina looks at the tiny caterpillar.',
      acceptedSentence1: 'We saw the tiny caterpillar crawl next.',
      acceptedSentence2: 'Next, the caterpillar climbs onto a tiny twig.',
      targetWord1: 'tiny',
    };
    const challenge = validateOralSentenceStudioPayload(rehearsal, 0, 'guided_writing_rehearsal');
    expect(challenge).toMatchObject({ type: 'guided_writing_rehearsal', priorStepLabel: 'finding a leaf' });
    expect(validateOralSentenceStudioPayload({ ...rehearsal, targetWord0: 'curious', meaning0: 'wanting to learn more',
      sceneMeaning: 'Curious Mina looks closely at a tiny caterpillar.',
      acceptedSentence0: 'Curious Mina looks at the tiny caterpillar.',
      acceptedSentence1: 'We saw the tiny caterpillar crawl and felt curious.',
      acceptedSentence2: 'The curious caterpillar climbs onto a tiny twig.' }, 0, 'guided_writing_rehearsal')).toBeNull();
    const { priorStepLabel: _omit, ...noPrior } = rehearsal;
    expect(validateOralSentenceStudioPayload(noPrior, 0, 'guided_writing_rehearsal')).toBeNull();
    // A payload of the wrong type for the slot is refused.
    expect(validateOralSentenceStudioPayload(rehearsal, 0, 'describe_scene')).toBeNull();
  });

  it('admits story words only when no anchor repeats a story line', () => {
    const story = {
      ...flatPayload(),
      type: 'use_story_words',
      storyText: 'Mina was curious about a bug in the garden. She found a tiny caterpillar on a leaf.',
      acceptedSentence0: 'I am curious about the tiny ant on my shoe.',
      acceptedSentence1: 'A tiny puppy looked curious at the park.',
      acceptedSentence2: 'My curious friend held a tiny shell.',
    };
    expect(validateOralSentenceStudioPayload(story, 1, 'use_story_words')).toMatchObject({
      id: 'oral-sentence-studio-2',
      type: 'use_story_words',
    });
    expect(validateOralSentenceStudioPayload({
      ...story,
      acceptedSentence2: 'She found a tiny caterpillar on a curious leaf.',
    }, 1, 'use_story_words')).toBeNull();
    expect(validateOralSentenceStudioPayload({
      ...story,
      storyText: 'Mina was in the garden. She found a caterpillar on a leaf.',
    }, 1, 'use_story_words')).toBeNull();
  });

  it('every mode builds a valid pack whose spoken ask never carries a model sentence', () => {
    const items = itemsFromChallenges(ORAL_SENTENCE_STUDIO_FALLBACKS);
    expect(items).toHaveLength(ORAL_SENTENCE_STUDIO_FALLBACKS.length);
    expect(validateJudgedScriptPack(oralSentenceStudioPack(items))).toEqual([]);
    for (const item of items) {
      const ask = spokenSpanOf(itemCue(item));
      for (const sentence of item.challenge.acceptedSentences) expect(ask).not.toContain(sentence);
      if (item.mode === 'use_story_words') expect(ask).toContain(item.challenge.storyText);
      if (item.mode === 'guided_writing_rehearsal') expect(ask).toContain(item.challenge.priorStepLabel);
    }
  });
});
