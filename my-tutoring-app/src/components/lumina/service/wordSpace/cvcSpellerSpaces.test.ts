import { describe, expect, it } from 'vitest';
import { mulberry32, tierPick } from './pick';
import { PAIR_BETA, cvcScope, cvcSpellerSpace, middleVowelLetter, pairKey, wordSortPair, wordSortSpace } from './cvcSpellerSpaces';
import { cvcUsableLetters, isCvcSpelling, type LetterGroup } from '../literacy/letterGroups';
import { enforceCvcScopeAndVariety } from '../literacy/gemini-cvc-speller';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const scopeFor = (group: LetterGroup, vowel: string | null = null, family: string | null = null) => cvcScope(cvcUsableLetters(group), vowel, family);

describe.each([[3, 'K'], [4, 'K'], [3, '1']] as const)('cvc-speller spaces, group %s grade %s', (group, grade) => {
  const scope = scopeFor(group);
  it.each(['fill-vowel', 'spell-word'] as const)('%s: every word is in scope, keys re-derive, tiers ordered', (mode) => {
    const space = cvcSpellerSpace(mode, scope, grade);
    expect(space.length).toBeGreaterThanOrEqual(15);
    for (const it of space) {
      const p = it.payload;
      expect(isCvcSpelling(p.targetWord)).toBe(true);
      expect(p.targetLetters.join('')).toBe(p.targetWord);
      expect(p.targetPhonemes).toHaveLength(3);
      expect(middleVowelLetter(p.targetWord)).toBe(p.targetWord[1]);
      expect(enforceCvcScopeAndVariety([p], cvcUsableLetters(group)).dropped).toEqual([]);
    }
    const means = TIERS.map((t) => {
      const picks = tierPick(space, t, 5, mulberry32(4));
      expect(picks).toHaveLength(5);
      // No repeated rime in a session (the generator's variety rule).
      expect(enforceCvcScopeAndVariety(picks.map((x) => x.payload), cvcUsableLetters(group)).dropped).toEqual([]);
      return picks.reduce((s, x) => s + x.beta, 0) / 5;
    });
    expect(means[0]).toBeLessThan(means[1]);
    expect(means[1]).toBeLessThan(means[2]);
  });
  it('word-sort: easy pairs a far vowel pair, hard a near one; both vowels in every set', () => {
    const betas = TIERS.map((t) => {
      const pair = wordSortPair(scope, grade, t, null, 5)!;
      const picks = tierPick(wordSortSpace(pair, scope, grade), 'medium', 5, mulberry32(9));
      expect(picks).toHaveLength(5);
      expect(new Set(picks.map((x) => x.payload.targetWord[1])).size).toBe(2);
      return PAIR_BETA[pairKey(...pair)];
    });
    expect(betas[0]).toBeLessThan(betas[2]);
  });
});

describe('cvc-speller scope rules', () => {
  it('a vowel focus keeps fill-vowel on that vowel and word-sort pairs on it', () => {
    const scope = scopeFor(3, 'o');
    expect(cvcSpellerSpace('fill-vowel', scope, 'K').every((x) => x.payload.targetWord[1] === 'o')).toBe(true);
    for (const t of TIERS) expect(wordSortPair(scope, 'K', t, 'o', 5)).toContain('o');
  });
  it('group 1 spells only with s a t i p n', () => {
    for (const x of cvcSpellerSpace('spell-word', scopeFor(1), '1')) expect(Array.from(x.payload.targetWord).every((c) => 'satipn'.includes(c))).toBe(true);
  });
  it('a word family keeps every word in it', () => {
    expect(cvcSpellerSpace('spell-word', scopeFor(3, null, 'at'), 'K').every((x) => x.payload.targetWord.endsWith('at'))).toBe(true);
  });
});
