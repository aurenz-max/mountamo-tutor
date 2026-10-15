/**
 * Word spaces for cvc-speller (service/wordSpace): every CVC word a letter group (and an optional vowel
 * focus or word family) allows, with a structural beta per mode. The tutor says the word; no word is shown,
 * so an unpictured word is still an item (the picture is a self-check cue when the tier shows one).
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/cvc-speller/before.txt`, K, 2 runs per tier):
 * fill_vowel gave cat bed pig mop bug or close to it at every tier; spell_word cat bed/hen pig dog bus at
 * every tier (only the distractor letters changed); word_sort cat cup map rug bag bus; rug pictured as yarn.
 *
 * Difficulty features (logits; refit from first-try results):
 * - fill_vowel (say the middle sound, open answer): short e and i are the vowels K children confuse most,
 *   then u and o; a nasal after the vowel (pen, pin) blurs it; stops on both sides clip it.
 * - word_sort (the pool mixes two vowels; say each middle sound): the PAIR is the difficulty. Far pairs
 *   (a/i, a/u) are easy, near pairs (e/i, o/u, a/e) hard. Within the pair, the word features above.
 * - spell_word (place 3 letters): /k/ spelled c or k is a choice (kid vs cat); x spells two sounds; b/d
 *   reverse; e/i vowels. The tier also sets the distractor letters (generator, unchanged).
 */
import { CONTINUANTS, isVowel, lexWord, type LexWord } from './lexicon';
import type { WordSpaceItem } from './pick';
import { blendTiles } from './phonicsSpaces';
import { decodableWords, gpcsForLetters, type LetterScope } from './scope';

export type CvcSpellerMode = 'fill-vowel' | 'spell-word' | 'word-sort';
export interface CvcSpellerPayload {
  targetWord: string; targetLetters: string[]; targetPhonemes: string[]; emoji: string; imageDescription: string;
}

const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const VOWEL_BETA: Readonly<Record<string, number>> = { a: 0, o: 0.15, u: 0.2, i: 0.3, e: 0.45 };
/** Vowel pairs by how often children confuse them (near = hard). */
export const PAIR_BETA: Readonly<Record<string, number>> = {
  'a/i': 0, 'a/u': 0.1, 'e/o': 0.1, 'i/o': 0.15, 'e/u': 0.2, 'i/u': 0.3, 'a/o': 0.4, 'a/e': 0.7, 'o/u': 0.8, 'e/i': 1.0,
};
export const pairKey = (a: string, b: string): string => [a, b].sort().join('/');

const vowelOf = (x: LexWord): string => x.w[1];
const isStop = (p: string) => !isVowel(p) && !CONTINUANTS.has(p);

/** The cvc-speller scope: 3-letter CVC words spelled only with the group's letters. */
export function cvcScope(groupLetters: readonly string[], vowelFocus: string | null, family: string | null): LetterScope {
  const letters = groupLetters.filter((l) => l.length === 1);
  const vowels = letters.filter((l) => 'aeiou'.includes(l));
  const focusVowels = vowelFocus ? [vowelFocus] : vowels;
  return {
    known: gpcsForLetters(letters), focus: null, focusRule: null, shapes: ['CVC'], singleLetters: true,
    vowels: focusVowels, onsetClusters: null, codaClusters: null, family, group: null, knownLetters: letters,
    focusLetters: null, label: `letters ${letters.join('')}${vowelFocus ? `, short ${vowelFocus}` : ''}${family ? `, -${family}` : ''}`,
  };
}

function payloadOf(x: LexWord): CvcSpellerPayload {
  return {
    targetWord: x.w, targetLetters: x.w.split(''), targetPhonemes: blendTiles(x).map((t) => t.sound),
    emoji: x.emoji ?? '', imageDescription: x.w,
  };
}

/** Every 3-letter CVC word in scope; `vowels` limits the middle vowel. */
function words(scope: LetterScope, grade: string, vowels: readonly string[]): LexWord[] {
  return decodableWords(scope, { grade })
    .filter((x) => x.w.length === 3 && x.phones.length === 3 && vowels.includes(vowelOf(x)) && /^[bcdfghjklmnprstvwyz][aeiou][bcdfgklmnprstvxz]$/.test(x.w));
}

function wordBeta(mode: CvcSpellerMode, x: LexWord): number {
  const [a, , c] = x.phones;
  const nasal = c === 'M' || c === 'N';
  const clipped = isStop(a) && isStop(c);
  if (mode === 'spell-word') {
    return (x.w.includes('c') || x.w.includes('k') ? 0.4 : 0) + (x.w.endsWith('x') ? 0.3 : 0) + (/[bd]/.test(x.w) ? 0.2 : 0)
      + (VOWEL_BETA[vowelOf(x)] ?? 0) + famBeta(x);
  }
  return (VOWEL_BETA[vowelOf(x)] ?? 0) + (nasal ? 0.2 : 0) + (clipped ? 0.15 : 0) + famBeta(x);
}

/** fill-vowel and spell-word: one item per word. The rime rides in `words`, so no two picks share one. */
export function cvcSpellerSpace(mode: 'fill-vowel' | 'spell-word', scope: LetterScope, grade: string): WordSpaceItem<CvcSpellerPayload>[] {
  return words(scope, grade, scope.vowels ?? ['a', 'e', 'i', 'o', 'u']).map((x) => {
    const v = vowelOf(x);
    const nasal = x.phones[2] === 'M' || x.phones[2] === 'N';
    return {
      beta: +(0.3 + wordBeta(mode, x)).toFixed(2),
      structure: mode === 'spell-word' ? `${v}:${/[ck]/.test(x.w) ? 'c-or-k' : 'plain'}` : `${v}:${nasal ? 'nasal' : 'oral'}`,
      key: v,
      words: [x.w, `-${x.w.slice(1)}`],
      payload: payloadOf(x),
    };
  });
}

/**
 * word-sort: the words of one vowel pair. `key` is the vowel, so a pick alternates the two vowels and both
 * are always in the set. The pair is chosen by the caller (`wordSortPair`).
 */
export function wordSortSpace(pair: readonly [string, string], scope: LetterScope, grade: string): WordSpaceItem<CvcSpellerPayload>[] {
  const pb = PAIR_BETA[pairKey(pair[0], pair[1])] ?? 0.5;
  return words(scope, grade, pair).map((x) => ({
    beta: +(pb + wordBeta('word-sort', x)).toFixed(2),
    structure: `${pairKey(pair[0], pair[1])}:${vowelOf(x)}`,
    key: vowelOf(x),
    words: [x.w, `-${x.w.slice(1)}`],
    payload: payloadOf(x),
  }));
}

/**
 * The vowel pair for a word-sort session: easy takes the farthest pair the scope allows, hard the nearest.
 * With a vowel focus, the pair always includes it. Pairs whose words cannot fill `n` picks are skipped.
 */
export function wordSortPair(scope: LetterScope, grade: string, tier: 'easy' | 'medium' | 'hard', focus: string | null, n: number): [string, string] | null {
  const vowels = (scope.knownLetters ?? []).filter((l) => 'aeiou'.includes(l));
  const pairs: Array<[string, string]> = [];
  for (const a of vowels) for (const b of vowels) if (a < b && (!focus || a === focus || b === focus)) pairs.push([a, b]);
  const usable = pairs
    .filter((p) => words(scope, grade, p).length >= n + 2 && p.every((v) => words(scope, grade, [v]).length >= 2))
    .sort((p, q) => (PAIR_BETA[pairKey(...p)] ?? 0.5) - (PAIR_BETA[pairKey(...q)] ?? 0.5));
  if (!usable.length) return null;
  return tier === 'easy' ? usable[0] : tier === 'hard' ? usable[usable.length - 1] : usable[Math.floor((usable.length - 1) / 2)];
}

/** Test helper: the middle vowel of a word, from its phonemes. */
export const middleVowelLetter = (w: string): string | null => {
  const x = lexWord(w);
  return x ? ({ AE: 'a', EH: 'e', IH: 'i', AA: 'o', AO: 'o', AH: 'u' } as Record<string, string>)[x.phones[1]] ?? null : null;
};
