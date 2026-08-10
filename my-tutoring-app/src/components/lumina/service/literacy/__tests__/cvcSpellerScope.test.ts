/**
 * cvc-speller SCOPE resolution — the code-owned half of what the generator
 * sends Gemini, pinned so it cannot silently narrow again.
 *
 * WHY THIS FILE EXISTS. The primitive shipped with a private, vowel-stripped
 * fork of the shared letter-group progression (group 1 = `s t m p`) plus a
 * `vowelFocus` that defaulted to `short-a` on any topic that did not literally
 * match /short[ -]?[aeiou]/. Together those left a group-1 lesson a legal word
 * space of about nine words, and a real draw came back `sat, pat, mat, map` —
 * three sharing a rime, every answer the same sound. Neither half was visible
 * from a type or a test; both are now.
 */
import { describe, it, expect } from 'vitest';
import {
  LETTER_GROUPS,
  cumulativeLetters,
  cvcUsableLetters,
  groupVowels,
  normalizeLetterGroup,
  smallestGroupContaining,
} from '../letterGroups';
import {
  enforceCvcScopeAndVariety,
  resolveCvcLetterGroup,
  resolveCvcVowelFocus,
} from '../gemini-cvc-speller';

const word = (w: string) => ({ targetWord: w, targetLetters: w.split('') });

describe('letterGroups · the canonical progression carries its own vowels', () => {
  it('group 1 is satpin — and it already spans TWO vowels', () => {
    expect(cumulativeLetters(1)).toEqual(['s', 'a', 't', 'i', 'p', 'n']);
    expect(groupVowels(1)).toEqual(['a', 'i']);
  });

  it('groups are cumulative, and vowels accrue a,i → +e → +o,u', () => {
    expect(groupVowels(2)).toEqual(['a', 'e', 'i']);
    expect(groupVowels(3)).toEqual(['a', 'e', 'i', 'o', 'u']);
    expect(groupVowels(4)).toEqual(['a', 'e', 'i', 'o', 'u']);
    for (const g of [2, 3, 4] as const) {
      for (const letter of LETTER_GROUPS[g - 1]) expect(LETTER_GROUPS[g]).toContain(letter);
    }
  });

  it('matches the copies letter-spotter and letter-sound-link already ship', () => {
    // If this fails, the shared module has drifted from its unmigrated
    // consumers and the phonics sequence is no longer coherent across
    // primitives — which is the exact failure this module was created to end.
    expect(cumulativeLetters(2)).toEqual(
      ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd'],
    );
    expect(cumulativeLetters(3)).toEqual(
      ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b'],
    );
  });

  it('drops `qu` from CVC-usable letters — it cannot sit in one Elkonin box', () => {
    expect(cumulativeLetters(4)).toContain('qu');
    expect(cvcUsableLetters(4)).not.toContain('qu');
    expect(cvcUsableLetters(4).every(l => l.length === 1)).toBe(true);
  });

  it('finds the smallest group that admits a letter', () => {
    expect(smallestGroupContaining('a')).toBe(1);
    expect(smallestGroupContaining('e')).toBe(2);
    expect(smallestGroupContaining('o')).toBe(3);
    expect(smallestGroupContaining('u')).toBe(3);
    expect(smallestGroupContaining('z')).toBe(4);
    expect(smallestGroupContaining('!')).toBeNull();
  });

  it('normalizes junk rather than trusting the manifest', () => {
    expect(normalizeLetterGroup(2)).toBe(2);
    expect(normalizeLetterGroup('3')).toBe(3);
    expect(normalizeLetterGroup(0)).toBeNull();
    expect(normalizeLetterGroup(5)).toBeNull();
    expect(normalizeLetterGroup(undefined)).toBeNull();
    expect(normalizeLetterGroup(2.5)).toBeNull();
  });
});

describe('resolveCvcVowelFocus · a focus ONLY when something names one', () => {
  it('returns null for an unscoped objective instead of defaulting to short-a', () => {
    // ⭐ THE REGRESSION THIS FILE EXISTS FOR. Every one of these used to come
    // back 'short-a', so an unscoped lesson had the same spoken answer in every
    // item and nobody could see why.
    for (const topic of ['Spell simple CVC words', 'CVC words', 'Kindergarten phonics', '']) {
      expect(resolveCvcVowelFocus(topic)).toBeNull();
    }
  });

  it('honors a vowel named in the topic', () => {
    expect(resolveCvcVowelFocus('short a words')).toBe('short-a');
    expect(resolveCvcVowelFocus('Practice short-o words')).toBe('short-o');
  });

  it('reads the per-component OBJECTIVE, not just the lesson topic', () => {
    // The narrowing usually arrives on `intent` — the topic is the whole lesson.
    expect(resolveCvcVowelFocus('Kindergarten phonics', undefined, 'decode short i words')).toBe('short-i');
  });

  it('config wins over both, and junk config does not become a focus', () => {
    expect(resolveCvcVowelFocus('short a words', 'short-u')).toBe('short-u');
    expect(resolveCvcVowelFocus('CVC words', 'short-y')).toBeNull();
  });
});

describe('resolveCvcLetterGroup · the group is a ceiling that intent can RAISE', () => {
  it('defaults to the group carrying all five short vowels', () => {
    // LA001-03-B names all five outright ("Match short vowel sounds (a, e, i,
    // o, u)…"), so a cap below that is a cap below stated intent.
    expect(resolveCvcLetterGroup(undefined, null)).toBe(3);
    expect(groupVowels(resolveCvcLetterGroup(undefined, null))).toHaveLength(5);
  });

  it('lets the manifest pin a narrower group', () => {
    expect(resolveCvcLetterGroup(1, null)).toBe(1);
    expect(resolveCvcLetterGroup(2, null)).toBe(2);
  });

  it('RAISES a pinned group that cannot spell the vowel the objective named', () => {
    // A "short o" objective against group 1 has no `o` at all. Silently dropping
    // the o would answer a different question than the one asked.
    expect(resolveCvcLetterGroup(1, 'short-o')).toBe(3);
    expect(resolveCvcLetterGroup(1, 'short-e')).toBe(2);
  });

  it('never LOWERS a group to match a focus', () => {
    expect(resolveCvcLetterGroup(4, 'short-a')).toBe(4);
    expect(resolveCvcLetterGroup(3, 'short-i')).toBe(3);
  });

  it('a group-1 lesson can still pose a real two-way contrast', () => {
    // word_sort needs two vowels in scope; satpin supplies them, which is what
    // the canonical progression introduces group 1 for.
    expect(groupVowels(1).length).toBeGreaterThanOrEqual(2);
  });
});

describe('enforceCvcScopeAndVariety · the prompt is not trusted', () => {
  const g3 = cvcUsableLetters(3);

  it('drops the exact defect that started this — a repeated rime', () => {
    // ⭐ Observed live: the prompt told the model to vary rimes and it returned
    // `pat` next to `sat` anyway.
    const { challenges, dropped } = enforceCvcScopeAndVariety(
      ['sat', 'pin', 'pat', 'nap', 'tip'].map(word), g3,
    );
    expect(dropped).toEqual(['pat:duplicate-rime(-at)']);
    expect(challenges.map(c => c.targetWord)).toEqual(['sat', 'pin', 'nap', 'tip']);
  });

  it('drops a word whose letters the bank could not spell', () => {
    // Live: `jam` (j) and `fox` (x) both came back for a group-3 lesson.
    const { challenges, dropped } = enforceCvcScopeAndVariety(
      ['cat', 'jam', 'pin', 'fox', 'bug'].map(word), g3,
    );
    expect(dropped).toEqual(['jam:out-of-group(j)', 'fox:out-of-group(x)']);
    expect(challenges).toHaveLength(3);
  });

  it('drops duplicates and malformed items', () => {
    const { dropped } = enforceCvcScopeAndVariety(
      [word('cat'), word('pin'), word('cat'), word('bug'), { targetWord: 'stop', targetLetters: ['s', 't', 'o', 'p'] }],
      g3,
    );
    expect(dropped).toContain('cat:duplicate-word');
    expect(dropped).toContain('stop:not-3-letters');
  });

  it('REFUSES to cut below the floor — a stub lesson is the worse failure', () => {
    // The reported draw, verbatim. Rimes are -at,-at,-at,-ap, so `pat` and
    // `mat` go and only `sat`,`map` survive — below the floor of 3, so nothing
    // is cut and the caller warns instead. The starvation has to be fixed at
    // the SOURCE (the letter group), which is what this whole change did;
    // filtering downstream can only ever report it.
    const input = ['sat', 'pat', 'mat', 'map'].map(word);
    const { challenges, dropped, truncated } = enforceCvcScopeAndVariety(input, g3);
    expect(truncated).toBe(true);
    expect(dropped).toEqual(['pat:duplicate-rime(-at)', 'mat:duplicate-rime(-at)']);
    expect(challenges).toBe(input);           // untouched, and reported loudly
  });

  it('is a no-op on a clean set, and never invents a word', () => {
    const input = ['cat', 'hen', 'pig', 'dog', 'bug'].map(word);
    const { challenges, dropped, truncated } = enforceCvcScopeAndVariety(input, g3);
    expect(dropped).toEqual([]);
    expect(truncated).toBe(false);
    expect(challenges).toBe(input);
  });

  it('respects a narrower group', () => {
    const { dropped } = enforceCvcScopeAndVariety(['sat', 'pin', 'dog'].map(word), cvcUsableLetters(1));
    expect(dropped).toEqual(['dog:out-of-group(dog)']);
  });
});
