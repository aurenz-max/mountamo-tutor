import { describe, expect, it } from 'vitest';
import {
  pictureVocabularyRemediationMoveFor,
  validateAssociationPairs,
} from './gemini-picture-vocabulary';

describe('PictureVocabulary remediation affordances', () => {
  it.each([
    ['receptive_match', 'semantic_contrast'],
    ['naming', 'semantic_contrast'],
    ['association', 'relation_contrast'],
    ['opposite', 'reverse_relation'],
    ['sentence_frame', 'context_contrast'],
    ['gradable_scale', 'adjacent_scale'],
  ] as const)('maps %s to %s', (mode, expected) => {
    expect(pictureVocabularyRemediationMoveFor(mode, 'A stable vocabulary confusion.')).toBe(expected);
  });

  it('keeps baseline generation untagged', () => {
    expect(pictureVocabularyRemediationMoveFor('naming')).toBeUndefined();
  });
});

describe('PictureVocabulary association picture validation', () => {
  it('rejects the preserved PV-3 text stimulus while retaining a valid pair', () => {
    expect(validateAssociationPairs({
      pairs: [
        {
          word: 'bed',
          emoji: '\u{1F6CF}\uFE0F',
          relatedWord: 'pillow',
          relatedEmoji: 'pillows',
        },
        {
          word: 'sock',
          emoji: '\u{1F9E6}',
          relatedWord: 'shoe',
          relatedEmoji: '\u{1F45F}',
        },
      ],
    })).toEqual([
      {
        word: 'sock',
        emoji: '\u{1F9E6}',
        relatedWord: 'shoe',
        relatedEmoji: '\u{1F45F}',
      },
    ]);
  });

  it('rejects prose or multiple pictures in either field and preserves one ZWJ picture', () => {
    expect(validateAssociationPairs({
      pairs: [
        { word: 'sock', emoji: 'sock', relatedWord: 'shoe', relatedEmoji: '\u{1F45F}' },
        { word: 'cup', emoji: '\u{1F964}', relatedWord: 'plate', relatedEmoji: '\u{1F37D}\uFE0F\u{1F944}' },
        { word: 'astronaut', emoji: '\u{1F469}\u200D\u{1F680}', relatedWord: 'moon', relatedEmoji: '\u{1F315}' },
      ],
    })).toEqual([
      {
        word: 'astronaut',
        emoji: '\u{1F469}\u200D\u{1F680}',
        relatedWord: 'moon',
        relatedEmoji: '\u{1F315}',
      },
    ]);
  });
});
