import { describe, expect, it } from 'vitest';
import { deriveWordFlipAnswer } from '../gemini-word-flip';

describe('word-flip eval-mode transformation oracle', () => {
  it('accepts only clean add-s nouns in plural_s', () => {
    expect(deriveWordFlipAnswer('plural_s', 'dog')).toBe('dogs');
    expect(deriveWordFlipAnswer('plural_s', 'dish')).toBeNull();
    expect(deriveWordFlipAnswer('plural_s', 'baby')).toBeNull();
    expect(deriveWordFlipAnswer('plural_s', 'mouse')).toBeNull();
  });

  it('accepts the bounded add-es family and rejects ambiguous endings', () => {
    expect(deriveWordFlipAnswer('plural_es', 'bus')).toBe('buses');
    expect(deriveWordFlipAnswer('plural_es', 'fox')).toBe('foxes');
    expect(deriveWordFlipAnswer('plural_es', 'dish')).toBe('dishes');
    expect(deriveWordFlipAnswer('plural_es', 'church')).toBe('churches');
    expect(deriveWordFlipAnswer('plural_es', 'quiz')).toBeNull();
    expect(deriveWordFlipAnswer('plural_es', 'potato')).toBeNull();
  });

  it('changes consonant-y to -ies and rejects vowel-y nouns', () => {
    expect(deriveWordFlipAnswer('plural_y', 'baby')).toBe('babies');
    expect(deriveWordFlipAnswer('plural_y', 'puppy')).toBe('puppies');
    expect(deriveWordFlipAnswer('plural_y', 'city')).toBe('cities');
    expect(deriveWordFlipAnswer('plural_y', 'toy')).toBeNull();
    expect(deriveWordFlipAnswer('plural_y', 'key')).toBeNull();
  });

  it('derives irregular answers only from the code-owned dictionary', () => {
    expect(deriveWordFlipAnswer('irregulars', 'mouse')).toBe('mice');
    expect(deriveWordFlipAnswer('irregulars', 'child')).toBe('children');
    expect(deriveWordFlipAnswer('irregulars', 'sheep')).toBeNull();
    expect(deriveWordFlipAnswer('irregulars', 'puppy')).toBeNull();
  });

  it('derives bounded regular and irregular past forms', () => {
    expect(deriveWordFlipAnswer('past_ed', 'jump')).toBe('jumped');
    expect(deriveWordFlipAnswer('past_ed', 'play')).toBe('played');
    expect(deriveWordFlipAnswer('past_ed', 'stop')).toBeNull();
    expect(deriveWordFlipAnswer('past_irregular', 'run')).toBe('ran');
    expect(deriveWordFlipAnswer('past_irregular', 'go')).toBe('went');
    expect(deriveWordFlipAnswer('past_irregular', 'jump')).toBeNull();
  });
});
