import { describe, expect, it } from 'vitest';
import { pictureVocabularyRemediationMoveFor } from './gemini-picture-vocabulary';

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
