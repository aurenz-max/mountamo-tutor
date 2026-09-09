import { describe, expect, it } from 'vitest';
import { spokenSpanOf, validateJudgedScriptPack } from '../../../hooks/judgedScriptContract';
import type { OralSentenceStudioChallenge } from './OralSentenceStudio';
import {
  challengeAskable,
  fragmentCorrectionFor,
  itemCue,
  itemsFromChallenges,
  misuseCorrectionFor,
  oralSentenceHarnessAnswers,
  oralSentenceStudioPack,
  relevanceCorrectionFor,
  vocabularyCorrectionFor,
} from './oralSentenceStudioScript';

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

describe('oral-sentence-studio birth contract', () => {
  const [item] = itemsFromChallenges([challenge]);

  it('builds a valid semantic spoken item and passes the shared runner contract', () => {
    expect(challengeAskable(challenge)).toBe(true);
    expect(item).toMatchObject({
      id: challenge.id,
      answerKind: 'voice',
      responseClass: 'vocabulary_sentence',
      mode: 'describe_scene',
    });
    expect(validateJudgedScriptPack(oralSentenceStudioPack([item]))).toEqual([]);
  });

  it('keeps all model sentences and the private scene meaning out of the spoken ask', () => {
    const spokenAsk = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }));
    expect(spokenAsk).toContain('Make one whole sentence');
    expect(spokenAsk).toContain('curious');
    expect(spokenAsk).toContain('tiny');
    expect(spokenAsk).not.toContain(challenge.sceneMeaning);
    for (const sentence of challenge.acceptedSentences) {
      expect(spokenAsk).not.toContain(sentence);
    }
  });

  it('defines several valid answers while separating fragments and unrelated sentences', () => {
    const answers = oralSentenceHarnessAnswers(item);
    expect(answers.valid).toEqual(challenge.acceptedSentences);
    expect(new Set(answers.valid)).toHaveLength(3);
    expect(answers.fragment).toBe('curious tiny a caterpillar');
    expect(answers.unrelated).toBe('I remember this sentence from yesterday.');

    const cue = itemCue(item);
    expect(cue).toContain('Private examples of different valid answers');
    expect(cue).toContain('A noun or verb fragment');
    expect(cue).toContain('a complete but unrelated memorized sentence');
    expect(cue).toContain('These examples are anchors, not an exhaustive answer key');
  });

  it('gives structure-specific revision feedback only after an attempt', () => {
    for (const correction of [
      fragmentCorrectionFor(item),
      vocabularyCorrectionFor(item),
      misuseCorrectionFor(item),
      relevanceCorrectionFor(item),
    ]) {
      expect(correction).toMatch(/^My turn:/);
      expect(correction).toContain(item.modelResponse);
    }
    expect(fragmentCorrectionFor(item)).toContain('A whole sentence tells who or what and what happens');
    expect(vocabularyCorrectionFor(item)).toContain('use both new words');
    expect(misuseCorrectionFor(item)).toContain('does not fit its meaning');
    expect(relevanceCorrectionFor(item)).toContain('does not tell about this picture');
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

  it('publishes visible task context without leaking a private model', () => {
    const context = oralSentenceStudioPack([item]).contextFor(item);
    expect(context).toMatchObject({
      challengeType: 'describe_scene',
      sceneTitle: 'A Garden Discovery',
      targetWords: 'curious, tiny',
      currentTurn: '1',
      totalTurns: '1',
    });
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain(challenge.sceneMeaning);
    for (const sentence of challenge.acceptedSentences) {
      expect(serialized).not.toContain(sentence);
    }
  });
});
